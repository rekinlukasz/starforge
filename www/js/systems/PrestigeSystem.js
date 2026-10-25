import {
  PRESTIGE_REQUIREMENT, PRESTIGE_FORMULA, PRESTIGE_UPGRADES, PRESTIGE_UPGRADE_MAP, PRESTIGE_SPECIALIZATIONS,
} from '../../data/prestige.js';
import { TECHNOLOGIES } from '../../data/technologies.js';
import { createInitialState } from '../core/GameState.js';
import { evaluateConditions } from './Conditions.js';
import { BigNumber } from '../utils/BigNumber.js';

// Galactic Rebirth. Reset scope is documented in data/prestige.js and shown
// to the player before confirming.
export class PrestigeSystem {
  constructor(game) {
    this.game = game;
    game.modifiers.addSource((state, apply) => {
      for (const u of PRESTIGE_UPGRADES) {
        const lvl = state.prestige.upgrades[u.id] ?? 0;
        if (lvl > 0 && u.effect) apply(u.effect, lvl);
      }
      const spec = PRESTIGE_SPECIALIZATIONS[state.prestige.specialization];
      if (spec) spec.effects.forEach((e) => apply(e));
    });
  }

  get ps() {
    return this.game.state.prestige;
  }

  requirement() {
    return evaluateConditions(this.game.state, PRESTIGE_REQUIREMENT);
  }

  // Points the player would receive right now, with the breakdown.
  pointsBreakdown() {
    const energy = this.game.state.resources.energy.totalEarned;
    const fromEnergy = Math.floor(Math.sqrt(Math.max(0, energy.div(PRESTIGE_FORMULA.energyDivisor).toNumber())));
    const fromColonies = this.game.colonies.ids().length * PRESTIGE_FORMULA.perColony;
    const fromMega = this.game.megastructures.totalStages() * PRESTIGE_FORMULA.perMegastructureStage;
    return { fromEnergy, fromColonies, fromMega, total: fromEnergy + fromColonies + fromMega };
  }

  canRebirth() {
    return this.requirement().met && this.pointsBreakdown().total > 0;
  }

  upgradeLevel(id) {
    return this.ps.upgrades[id] ?? 0;
  }

  upgradeCost(id, level = this.upgradeLevel(id)) {
    const u = PRESTIGE_UPGRADE_MAP[id];
    return Math.ceil(u.base * Math.pow(u.growth, level));
  }

  // PP needed to buy `plan` ({ upgradeId: extra levels }) on top of the current
  // levels. Infinity when the plan is invalid (unknown id or above maxLevel).
  planCost(plan = {}) {
    let total = 0;
    for (const [id, n] of Object.entries(plan)) {
      const u = PRESTIGE_UPGRADE_MAP[id];
      const lvl = this.upgradeLevel(id);
      if (!u || !Number.isInteger(n) || n < 0 || lvl + n > u.maxLevel) return Infinity;
      for (let k = 0; k < n; k++) total += this.upgradeCost(id, lvl + k);
    }
    return total;
  }

  buyUpgrade(id) {
    const u = PRESTIGE_UPGRADE_MAP[id];
    if (!u || this.upgradeLevel(id) >= u.maxLevel) return false;
    const cost = this.upgradeCost(id);
    if (!this.game.resources.spend({ prestigePoints: cost })) return false;
    this.ps.upgrades[id] = this.upgradeLevel(id) + 1;
    this.game.modifiers.invalidate();
    this.game.events.emit('prestigeUpgrade', id);
    return true;
  }

  // Performs the rebirth. `specialization` must be a valid key. `plan` lists
  // prestige upgrades bought with current + incoming points before the new
  // cycle starts, so cycle-start upgrades (kit, recall, cartography) apply at once.
  rebirth(specialization, now = Date.now(), plan = {}) {
    if (!this.canRebirth() || !PRESTIGE_SPECIALIZATIONS[specialization]) return false;
    const old = this.game.state;
    const points = this.pointsBreakdown().total;
    const planCost = this.planCost(plan);
    if (planCost > old.resources.prestigePoints.amount.toNumber() + points) return false;
    const fresh = createInitialState(now);

    // Kept ------------------------------------------------------------------
    fresh.meta.createdAt = old.meta.createdAt;
    fresh.meta.simTime = old.meta.simTime; // timers stay monotonic
    fresh.meta.lastSimulationAt = Math.max(old.meta.lastSimulationAt, now);
    fresh.achievements = { ...old.achievements };
    fresh.missions = JSON.parse(JSON.stringify(old.missions));
    fresh.settings = { ...old.settings };
    fresh.log = old.log.slice(0, 40);
    fresh.stats = { ...old.stats, rebirths: (old.stats.rebirths ?? 0) + 1 };
    fresh.click.totalClicks = old.click.totalClicks;
    fresh.prestige = {
      ...old.prestige,
      upgrades: { ...old.prestige.upgrades },
      rebirths: old.prestige.rebirths + 1,
      totalEarned: old.prestige.totalEarned + points,
      specialization,
    };
    for (const [id, n] of Object.entries(plan)) {
      if (n > 0) fresh.prestige.upgrades[id] = this.upgradeLevel(id) + n;
    }
    const pp = old.resources.prestigePoints.amount.add(points).sub(planCost);
    fresh.resources.prestigePoints.amount = pp;
    fresh.resources.prestigePoints.unlocked = true;

    // Prestige upgrades that shorten the next cycle -------------------------
    const levels = fresh.prestige.upgrades;
    const kit = PRESTIGE_UPGRADE_MAP.startingKit;
    const kitLevel = levels.startingKit ?? 0;
    if (kitLevel > 0) {
      for (const [r, v] of Object.entries(kit.kit)) {
        fresh.resources[r].amount = fresh.resources[r].amount.add(BigNumber.from(v * Math.pow(10, kitLevel - 1)));
      }
    }
    const recall = levels.archiveRecall ?? 0;
    if (recall > 0) {
      for (const t of TECHNOLOGIES) if (t.tier <= recall && !t.condition) fresh.research.completed[t.id] = true;
    }
    if ((levels.cartographyMemory ?? 0) > 0) {
      fresh.space.sectors = JSON.parse(JSON.stringify(old.space.sectors));
      for (const [id, p] of Object.entries(old.space.planets)) {
        fresh.space.planets[id] = { status: p.status === 'colonized' ? 'analyzed' : p.status };
      }
    }

    this.game.replaceState(fresh);
    this.game.addLog(`Galactic Rebirth #${fresh.prestige.rebirths}. Zdobyto ${points} punktów prestiżu. Nowy cykl pod znakiem: ${PRESTIGE_SPECIALIZATIONS[specialization].name}.`);
    this.game.events.emit('rebirth', { points, rebirths: fresh.prestige.rebirths });
    this.game.save(now);
    return points;
  }
}
