import { EventBus } from './EventBus.js';
import { createInitialState } from './GameState.js';
import { ModifierSystem } from '../systems/ModifierSystem.js';
import { ResourceSystem } from '../systems/ResourceSystem.js';
import { BuildingSystem } from '../systems/BuildingSystem.js';
import { ProductionSystem } from '../systems/ProductionSystem.js';
import { ClickSystem } from '../systems/ClickSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { OfflineProgressSystem } from '../systems/OfflineProgressSystem.js';
import { ResearchSystem } from '../systems/ResearchSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { AutomationSystem } from '../systems/AutomationSystem.js';
import { FleetSystem } from '../systems/FleetSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { PlanetSystem } from '../systems/PlanetSystem.js';
import { ExpeditionSystem } from '../systems/ExpeditionSystem.js';
import { ColonySystem } from '../systems/ColonySystem.js';
import { LogisticsSystem } from '../systems/LogisticsSystem.js';
import { MegastructureSystem } from '../systems/MegastructureSystem.js';
import { PrestigeSystem } from '../systems/PrestigeSystem.js';
import { TECH_MAP } from '../../data/technologies.js';
import { SaveManager } from '../persistence/SaveManager.js';
import { MemoryStorageAdapter } from '../persistence/StorageAdapter.js';
import { STORY } from '../../data/story.js';
import { sanitizeState } from '../utils/Validation.js';

export const MAX_STEP_SECONDS = 1;
// Gaps longer than this (app suspended, closed, tab hidden) go through the
// offline report instead of being silently simulated.
export const OFFLINE_THRESHOLD_SECONDS = 60;
const MAX_LOG = 50;

// Owns the state and exposes every allowed state change as a method.
// UI code calls these methods; it never writes to `state` directly.
export class Game {
  constructor({ storage = new MemoryStorageAdapter(), state = null, now = Date.now() } = {}) {
    this.events = new EventBus();
    this.saves = new SaveManager(storage);
    this.state = state ?? createInitialState(now);
    this.modifiers = new ModifierSystem(this);
    this.resources = new ResourceSystem(this);
    this.buildings = new BuildingSystem(this);
    this.production = new ProductionSystem(this);
    this.clicks = new ClickSystem(this);
    this.upgrades = new UpgradeSystem(this);
    this.offline = new OfflineProgressSystem(this);
    this.research = new ResearchSystem(this);
    this.missions = new MissionSystem(this);
    this.achievements = new AchievementSystem(this);
    this.automation = new AutomationSystem(this);
    this.fleet = new FleetSystem(this);
    this.combat = new CombatSystem(this);
    this.planets = new PlanetSystem(this);
    this.expeditions = new ExpeditionSystem(this);
    this.colonies = new ColonySystem(this);
    this.logistics = new LogisticsSystem(this);
    this.megastructures = new MegastructureSystem(this);
    this.prestige = new PrestigeSystem(this);
    this.bindStory();
    this.buildings.refreshUnlocks();
  }

  bindStory() {
    this.events.on('buildingBought', ({ id, level }) => {
      if (level > 0 && STORY.building[id] && !this.state.log.some((e) => e.key === `b:${id}`)) {
        this.addLog(STORY.building[id], `b:${id}`);
      }
    });
    this.events.on('overcharge', () => this.addLog(STORY.overcharge));
    this.events.on('researchCompleted', (id) => {
      const text = STORY.tech[id];
      if (text && !this.state.log.some((e) => e.key === `t:${id}`)) this.addLog(text, `t:${id}`);
    });
  }

  addLog(text, key) {
    this.state.log.unshift({ t: Date.now(), text, ...(key ? { key } : {}) });
    if (this.state.log.length > MAX_LOG) this.state.log.length = MAX_LOG;
    this.events.emit('log', text);
  }

  // ---- lifecycle -------------------------------------------------------

  // Loads the stored save. Returns { source, error? }.
  load(now = Date.now()) {
    const result = this.saves.load(now);
    if (result.state) this.replaceState(result.state);
    else {
      this.replaceState(createInitialState(now));
      this.addLog(STORY.start, 'start');
    }
    return { source: result.source, error: result.error };
  }

  replaceState(state) {
    this.state = state;
    this.modifiers.invalidate();
    this.buildings.refreshUnlocks();
    // Prime the production report so rates are visible before the first tick.
    this.production.lastReport = this.production.emptyReport();
    this.events.emit('stateReplaced');
  }

  clone(now = Date.now()) {
    return sanitizeState(JSON.parse(JSON.stringify(this.state)), now);
  }

  // Seconds of wall time not yet simulated (0 if the clock moved backwards).
  pendingSeconds(now = Date.now()) {
    return Math.max(0, (now - this.state.meta.lastSimulationAt) / 1000);
  }

  // Advances simulation to wall time `now`. Returns false if the gap is long
  // enough to require the offline flow (caller should use `offline`).
  update(now = Date.now()) {
    const seconds = this.pendingSeconds(now);
    if (seconds <= 0) return true; // clock rollback: wait until real time catches up
    if (seconds > OFFLINE_THRESHOLD_SECONDS) return false;
    this.simulate(seconds);
    this.state.meta.lastSimulationAt = now;
    return true;
  }

  // Simulates `seconds` of economy in steps of at most `maxStep`.
  simulate(seconds, maxStep = MAX_STEP_SECONDS) {
    let left = seconds;
    while (left > 1e-9) {
      const step = Math.min(maxStep, left);
      this.step(step);
      left -= step;
    }
    this.buildings.refreshUnlocks();
  }

  // One simulation step. Order: production, research, automation, then
  // goal evaluation, so goals see the state at the end of the step.
  step(dt) {
    this.production.tick(dt);
    this.clicks.autoTick(dt);
    this.research.tick(dt);
    this.research.retryQueue();
    this.automation.tick(dt);
    this.colonies.tick(dt);
    this.fleet.tick(dt);
    this.logistics.tick(dt);
    this.megastructures.tick(dt);
    this.state.meta.simTime += dt;
    this.expeditions.tick();
    this.missions.evaluate();
    this.achievements.evaluate();
  }

  // ---- player actions --------------------------------------------------

  click(now = Date.now()) {
    return this.clicks.click(now);
  }

  buyBuilding(id, mode = this.state.settings.buyMode) {
    if (!this.buildings.isUnlocked(id)) return 0;
    const count = this.buildings.countForMode(id, mode);
    return this.buildings.buy(id, count);
  }

  buyUpgrade(id) {
    return this.upgrades.buy(id);
  }

  startResearch(id) {
    if (!TECH_MAP[id]) return 'invalid';
    return this.research.start(id);
  }

  cancelResearch() {
    return this.research.cancel();
  }

  dequeueResearch(id) {
    return this.research.dequeue(id);
  }

  claimMission(id) {
    return this.missions.claim(id);
  }

  setAutobuy(id, on) {
    return this.automation.setEnabled(id, on);
  }

  setAutobuyThreshold(value) {
    return this.automation.setThreshold(Number(value));
  }

  setAutoclick(on) {
    this.automation.setAutoclick(on);
  }

  // ---- space ---------------------------------------------------------------

  buildShip(id, count = 1) {
    return this.fleet.build(id, count);
  }

  cancelShip(index) {
    return this.fleet.cancel(Number(index));
  }

  upgradeShip(id) {
    return this.fleet.upgrade(id);
  }

  repairShip(id) {
    return this.fleet.repair(id);
  }

  launchExpedition(kind, id, fleet, options) {
    return this.expeditions.launch(kind, id, fleet, options);
  }

  claimExpedition(uid) {
    return this.expeditions.claim(Number(uid));
  }

  setExpeditionRepeat(uid, on) {
    return this.expeditions.setRepeat(Number(uid), on);
  }

  buildColonyBuilding(planetId, buildingId) {
    return this.colonies.build(planetId, buildingId);
  }

  specializeColony(planetId, spec) {
    return this.colonies.specialize(planetId, spec);
  }

  startTerraform(planetId) {
    return this.colonies.startTerraform(planetId);
  }

  createRoute(spec) {
    return this.logistics.createRoute(spec);
  }

  setRouteActive(id, on) {
    return this.logistics.setActive(Number(id), on);
  }

  deleteRoute(id) {
    return this.logistics.deleteRoute(Number(id));
  }

  startMegastructureStage(id) {
    return this.megastructures.startStage(id);
  }

  buyPrestigeUpgrade(id) {
    return this.prestige.buyUpgrade(id);
  }

  rebirth(specialization, now = Date.now()) {
    return this.prestige.rebirth(specialization, now);
  }

  setRetreatThreshold(value) {
    const v = Number(value);
    if (![0.25, 0.5, 0.75].includes(v)) return false;
    this.state.settings.retreatAt = v;
    return true;
  }

  setBuyMode(mode) {
    if (!['1', '10', 'next', 'max'].includes(mode)) return false;
    this.state.settings.buyMode = mode;
    this.events.emit('settingsChanged');
    return true;
  }

  setOfflineCap(hours) {
    const h = Number(hours);
    if (!Number.isFinite(h) || h < 1 || h > 48) return false;
    this.state.settings.offlineCapHours = Math.round(h);
    this.events.emit('settingsChanged');
    return true;
  }

  setReduceMotion(value) {
    this.state.settings.reduceMotion = Boolean(value);
    this.events.emit('settingsChanged');
  }

  save(now = Date.now()) {
    const result = this.saves.save(this.state, now);
    this.events.emit(result.ok ? 'saved' : 'saveFailed', result.error);
    return result;
  }

  exportSave() {
    return this.saves.exportString(this.state);
  }

  // Replaces the current game with an imported one. Throws with a readable message.
  importSave(text, now = Date.now()) {
    const state = this.saves.importString(text, now);
    // Imported progress is not credited for time before the import.
    state.meta.lastSimulationAt = Math.max(state.meta.lastSimulationAt, now);
    this.replaceState(state);
    this.save(now);
  }

  resetGame(now = Date.now()) {
    this.saves.wipe();
    this.replaceState(createInitialState(now));
    this.addLog(STORY.start, 'start');
    this.save(now);
  }
}
