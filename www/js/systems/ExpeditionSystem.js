import { EXPEDITION_MAP, SECTOR_MAP, SURVEY, COLONIZE } from '../../data/sectors.js';
import { PLANET_MAP } from '../../data/planets.js';
import { SHIP_MAP } from '../../data/ships.js';
import { checkConditions } from './Conditions.js';
import { battleLosses } from './CombatSystem.js';
import { BigNumber } from '../utils/BigNumber.js';

export const MAX_ACTIVE_EXPEDITIONS = 12;

// Expeditions: active -> completed (ships home, reward waiting) -> claimed
// (record removed, reward granted exactly once).
// kinds: 'sector' (id = expedition id), 'survey' and 'colonize' (id = planet id).
export class ExpeditionSystem {
  constructor(game) {
    this.game = game;
  }

  get es() {
    return this.game.state.expeditions;
  }

  // Normalized definition for any expedition kind.
  definition(kind, id) {
    if (kind === 'sector') {
      const e = EXPEDITION_MAP[id];
      return e ? { ...e, kind, key: id } : null;
    }
    const p = PLANET_MAP[id];
    if (!p) return null;
    if (kind === 'survey') {
      return { kind, key: `survey:${id}`, id, type: 'survey', planet: id, sector: p.sector, name: `Analiza: ${p.name}`,
        ships: SURVEY.ships, altShips: SURVEY.altShips, cost: SURVEY.cost, duration: SURVEY.duration, rewards: {} };
    }
    if (kind === 'colonize') {
      return { kind, key: `colonize:${id}`, id, type: 'colonize', planet: id, sector: p.sector, name: `Kolonizacja: ${p.name}`,
        ships: COLONIZE.ships, cost: p.colonizeCost, duration: COLONIZE.duration, rewards: {}, requires: p.requires };
    }
    return null;
  }

  completions(key) {
    return this.es.completions[key] ?? 0;
  }

  isRunning(key) {
    return this.es.active.some((e) => e.key === key);
  }

  fuelCost(def) {
    const mult = this.game.modifiers.get().fuelMult;
    return Object.fromEntries(Object.entries(def.cost ?? {}).map(([r, v]) => [r, BigNumber.from(v).mul(mult)]));
  }

  duration(def, fleet) {
    const speed = this.game.fleet.fleetStats(fleet).speed;
    return (def.duration * 2) / speed * this.game.modifiers.get().expeditionDuration;
  }

  // Minimum fleet satisfied by `fleet`? Supports an alternative fleet (survey by scouts).
  meetsMinimum(def, fleet) {
    const ok = (min) => Object.entries(min).every(([s, n]) => (fleet[s] ?? 0) >= n);
    return ok(def.ships) || (def.altShips ? ok(def.altShips) : false);
  }

  defaultFleet(def) {
    const fleetOf = (min) => ({ ...min });
    const enough = (min) => Object.entries(min).every(([s, n]) => this.game.fleet.available(s) >= n);
    if (enough(def.ships) || !def.altShips) return fleetOf(def.ships);
    return enough(def.altShips) ? fleetOf(def.altShips) : fleetOf(def.ships);
  }

  // Returns { ok, reasons: [] } without changing anything.
  check(kind, id, fleet) {
    const def = this.definition(kind, id);
    const reasons = [];
    if (!def) return { ok: false, reasons: ['Nieznana ekspedycja'] };
    const planets = this.game.planets;
    if (def.sector && !planets.isSectorDiscovered(def.sector)) reasons.push('Sektor nie został odkryty');
    if (kind === 'sector' && !def.repeatable && this.completions(def.key) > 0) reasons.push('Ekspedycja już wykonana');
    if (kind === 'survey' && planets.status(id) !== 'discovered') reasons.push('Planeta nie wymaga analizy');
    if (kind === 'colonize' && planets.status(id) !== 'analyzed') reasons.push('Planeta musi być przeanalizowana');
    if (this.isRunning(def.key)) reasons.push('Ekspedycja już trwa');
    if (this.es.active.length >= MAX_ACTIVE_EXPEDITIONS) reasons.push('Zbyt wiele aktywnych ekspedycji');
    if (def.requires) reasons.push(...checkConditions(this.game.state, def.requires).missing);
    if (!this.meetsMinimum(def, fleet)) reasons.push('Za mało statków wymaganego typu');
    for (const [s, n] of Object.entries(fleet)) {
      if (!SHIP_MAP[s] || !Number.isInteger(n) || n < 0) { reasons.push('Nieprawidłowa flota'); break; }
      if (n > this.game.fleet.available(s)) reasons.push(`Brak wolnych statków: ${SHIP_MAP[s].name}`);
    }
    if (!this.game.resources.canAfford(this.fuelCost(def))) reasons.push('Brak zasobów na wyprawę');
    return { ok: reasons.length === 0, reasons, def };
  }

  launch(kind, id, fleet, { repeat = false } = {}) {
    const clean = Object.fromEntries(Object.entries(fleet ?? {}).filter(([, n]) => n > 0));
    const { ok, def } = this.check(kind, id, clean);
    if (!ok) return false;
    if (!this.game.resources.spend(this.fuelCost(def))) return false;
    const now = this.game.state.meta.simTime;
    const record = {
      uid: this.es.nextUid++,
      kind, id, key: def.key,
      ships: clean,
      startedAt: now,
      endsAt: now + this.duration(def, clean),
      status: 'active',
      repeat: Boolean(repeat),
    };
    if (def.type === 'combat') record.battle = this.game.combat.forecast(def, clean);
    if (kind === 'colonize') {
      // The colony ship becomes the outpost: consumed at launch.
      this.game.fleet.remove('colonyShip', clean.colonyShip ?? 1);
      record.ships = {};
    }
    this.es.active.push(record);
    this.game.events.emit('expeditionLaunched', record);
    return record;
  }

  tick() {
    const now = this.game.state.meta.simTime;
    for (const e of this.es.active) {
      if (e.status !== 'active' || now < e.endsAt) continue;
      e.status = 'completed';
      // Ships return home; combat losses applied here, once.
      if (e.battle) {
        const { destroyed, damaged } = battleLosses(e.ships, e.battle.hullLost);
        for (const [s, n] of Object.entries(destroyed)) if (n) this.game.fleet.remove(s, n);
        for (const [s, n] of Object.entries(damaged)) if (n) this.game.fleet.markDamaged(s, n);
        e.losses = { destroyed, damaged };
      }
      this.game.events.emit('expeditionCompleted', e);
    }
    if (this.game.modifiers.hasFeature('autoclaim')) {
      for (const e of [...this.es.active]) {
        if (e.status === 'completed') {
          const repeat = e.repeat;
          const { kind, id, ships } = e;
          const result = this.claim(e.uid);
          // Never auto-repeat a lost battle: the player must decide again.
          if (repeat && result?.victory) this.launch(kind, id, ships, { repeat: true });
        }
      }
    }
  }

  // Grants rewards exactly once and removes the record.
  claim(uid) {
    const idx = this.es.active.findIndex((e) => e.uid === uid);
    if (idx < 0) return null;
    const e = this.es.active[idx];
    if (e.status !== 'completed') return null;
    this.es.active.splice(idx, 1); // remove first: a second claim finds nothing
    const def = this.definition(e.kind, e.id);
    const granted = {};
    const victory = !e.battle || e.battle.outcome === 'victory';
    if (victory) {
      this.es.completions[def.key] = this.completions(def.key) + 1;
      let rewards = { ...def.rewards };
      if (def.type === 'mining') {
        const cargo = this.game.fleet.fleetStats(e.ships).cargo;
        rewards = Object.fromEntries(Object.entries(rewards).map(([r, v]) => [r, v * Math.max(1, cargo / 60)]));
      }
      if (def.everyN && this.completions(def.key) % def.everyN.count === 0) {
        for (const [r, v] of Object.entries(def.everyN.rewards)) rewards[r] = (rewards[r] ?? 0) + v;
      }
      for (const [r, v] of Object.entries(rewards)) granted[r] = this.game.resources.add(r, v);
      for (const s of def.discovers?.sectors ?? []) this.game.planets.discoverSector(s);
      for (const p of def.discovers?.planets ?? []) this.game.planets.discoverPlanet(p);
      if (e.kind === 'survey') this.game.planets.setStatus(e.id, 'analyzed');
      if (e.kind === 'colonize') this.game.colonies.found(e.id);
      if (def.story) this.game.addLog(def.story, `x:${def.key}`);
    }
    const result = { record: e, def, granted, victory };
    this.game.events.emit('expeditionClaimed', result);
    return result;
  }

  setRepeat(uid, on) {
    const e = this.es.active.find((x) => x.uid === uid);
    if (!e) return false;
    e.repeat = Boolean(on);
    return true;
  }

  remaining(e) {
    return Math.max(0, e.endsAt - this.game.state.meta.simTime);
  }

  progress(e) {
    const total = e.endsAt - e.startedAt;
    return total > 0 ? Math.min(1, (this.game.state.meta.simTime - e.startedAt) / total) : 1;
  }

  sectorExpeditions(sectorId) {
    return (SECTOR_MAP[sectorId]?.expeditions ?? []).map((x) => this.definition('sector', x.id));
  }
}
