import { SHIPS, SHIP_MAP, SHIP_UPGRADE } from '../../data/ships.js';
import { checkConditions } from './Conditions.js';
import { BigNumber } from '../utils/BigNumber.js';

export const MAX_SHIP_QUEUE = 20;
export const REPAIR_TIME = 60; // base seconds per damaged ship
export const REPAIR_COST_SHARE = 0.25; // share of build cost

// Ships, shipyard queue, upgrades and repairs.
// owned = available + busy (expeditions, routes) + damaged (awaiting repair).
export class FleetSystem {
  constructor(game) {
    this.game = game;
  }

  get fs() {
    return this.game.state.fleet;
  }

  entry(id) {
    if (!this.fs.ships[id]) this.fs.ships[id] = { owned: 0, damaged: 0 };
    return this.fs.ships[id];
  }

  owned(id) { return this.fs.ships[id]?.owned ?? 0; }
  damaged(id) { return this.fs.ships[id]?.damaged ?? 0; }

  // Ships tied up in expeditions or logistics routes.
  busy(id) {
    let n = 0;
    for (const e of this.game.state.expeditions.active) if (e.status === 'active') n += e.ships[id] ?? 0;
    if (id === 'transporter') for (const r of this.game.state.logistics.routes) n += r.transporters;
    return n;
  }

  available(id) {
    return Math.max(0, this.owned(id) - this.damaged(id) - this.busy(id));
  }

  isUnlocked(id) {
    return checkConditions(this.game.state, SHIP_MAP[id].unlock).met;
  }

  shipyardSlots() {
    return this.game.modifiers.get().shipyardSlots; // = shipyard level
  }

  canBuild() {
    return this.shipyardSlots() > 0;
  }

  buildTime(id) {
    return SHIP_MAP[id].buildTime / this.game.modifiers.get().buildSpeed;
  }

  // Atomic: pays the full cost of `count` ships and queues them.
  build(id, count = 1) {
    const def = SHIP_MAP[id];
    const n = Math.floor(Number(count));
    if (!def || !Number.isFinite(n) || n < 1 || n > MAX_SHIP_QUEUE) return false;
    if (!this.canBuild() || !this.isUnlocked(id)) return false;
    if (this.fs.queue.length + n > MAX_SHIP_QUEUE) return false;
    const cost = Object.fromEntries(Object.entries(def.cost).map(([r, v]) => [r, BigNumber.from(v).mul(n)]));
    if (!this.game.resources.spend(cost)) return false;
    for (let i = 0; i < n; i++) this.fs.queue.push({ shipId: id, progress: 0 });
    this.game.events.emit('shipQueued', { id, count: n });
    return true;
  }

  // Cancels a queued (not yet finished) ship with a full refund.
  cancel(index) {
    const item = this.fs.queue[index];
    if (!item) return false;
    this.fs.queue.splice(index, 1);
    for (const [r, v] of Object.entries(SHIP_MAP[item.shipId].cost)) this.game.resources.add(r, v);
    return true;
  }

  tick(dt) {
    // Shipyard: the first `slots` queue entries progress in parallel.
    const slots = this.shipyardSlots();
    if (slots > 0 && this.fs.queue.length) {
      const speed = this.game.modifiers.get().buildSpeed;
      const finished = [];
      for (let i = 0; i < Math.min(slots, this.fs.queue.length); i++) {
        const item = this.fs.queue[i];
        item.progress += dt * speed;
        if (item.progress >= SHIP_MAP[item.shipId].buildTime) finished.push(i);
      }
      for (const i of finished.reverse()) {
        const [item] = this.fs.queue.splice(i, 1);
        this.entry(item.shipId).owned += 1;
        this.game.events.emit('shipBuilt', item.shipId);
      }
    }
    // Repairs: one ship at a time per repair order, sequential.
    const repair = this.fs.repairs[0];
    if (repair) {
      repair.progress += dt * this.game.modifiers.get().repairSpeed * (this.game.buildings.level('orbitalDock') > 0 ? 1 : 0.25);
      if (repair.progress >= REPAIR_TIME) {
        this.fs.repairs.shift();
        const e = this.entry(repair.shipId);
        e.damaged = Math.max(0, e.damaged - 1);
        this.game.events.emit('shipRepaired', repair.shipId);
      }
    }
  }

  repairCost(id) {
    const mult = REPAIR_COST_SHARE * this.game.modifiers.get().repairCost;
    return Object.fromEntries(Object.entries(SHIP_MAP[id].cost).map(([r, v]) => [r, BigNumber.from(v).mul(mult)]));
  }

  // Number of damaged ships not yet scheduled for repair.
  unscheduledDamaged(id) {
    return this.damaged(id) - this.fs.repairs.filter((r) => r.shipId === id).length;
  }

  // Schedules repair of one damaged ship (cost paid now).
  repair(id) {
    if (!SHIP_MAP[id] || this.unscheduledDamaged(id) <= 0) return false;
    if (!this.game.resources.spend(this.repairCost(id))) return false;
    this.fs.repairs.push({ shipId: id, progress: 0 });
    return true;
  }

  upgradeLevel(id) {
    return this.fs.upgrades[id] ?? 0;
  }

  upgradeCost(id) {
    const lvl = this.upgradeLevel(id);
    const mult = 2 * Math.pow(SHIP_UPGRADE.costGrowth, lvl);
    return Object.fromEntries(Object.entries(SHIP_MAP[id].cost).map(([r, v]) => [r, BigNumber.from(v).mul(mult)]));
  }

  upgrade(id) {
    if (!SHIP_MAP[id] || !this.isUnlocked(id)) return false;
    if (this.upgradeLevel(id) >= SHIP_UPGRADE.maxLevel) return false;
    if (!this.game.resources.spend(this.upgradeCost(id))) return false;
    this.fs.upgrades[id] = this.upgradeLevel(id) + 1;
    this.game.events.emit('shipUpgraded', id);
    return true;
  }

  // Effective per-ship stats including upgrades and technologies.
  stats(id) {
    const base = SHIP_MAP[id].stats;
    const m = this.game.modifiers.get();
    const up = 1 + this.upgradeLevel(id) * SHIP_UPGRADE.statBonus;
    return {
      speed: base.speed * m.shipSpeed * up,
      cargo: base.cargo * m.shipCargo,
      attack: base.attack * m.shipAttack * up,
      armor: base.armor * m.shipArmor * up,
      shields: base.shields * m.shipShields * up,
      hull: base.hull * up,
    };
  }

  // Aggregate stats of a fleet { shipId: count }.
  fleetStats(fleet) {
    const t = { attack: 0, armor: 0, shields: 0, hull: 0, cargo: 0, speed: Infinity, count: 0 };
    for (const [id, n] of Object.entries(fleet)) {
      if (!n) continue;
      const s = this.stats(id);
      t.attack += s.attack * n;
      t.shields += s.shields * n;
      t.hull += s.hull * n;
      t.armor += s.armor * n; // summed; averaged below
      t.cargo += s.cargo * n;
      t.speed = Math.min(t.speed, s.speed);
      t.count += n;
    }
    t.armor = t.count ? t.armor / t.count : 0;
    if (!Number.isFinite(t.speed)) t.speed = 1;
    return t;
  }

  power(fleet) {
    const s = this.fleetStats(fleet);
    return Math.round(s.attack * 4 + s.hull * 0.5 + s.shields + s.armor * s.count * 0.5);
  }

  // Removes ships permanently (destroyed or consumed).
  remove(id, n) {
    const e = this.entry(id);
    e.owned = Math.max(0, e.owned - n);
    e.damaged = Math.min(e.damaged, e.owned);
  }

  markDamaged(id, n) {
    const e = this.entry(id);
    e.damaged = Math.min(e.owned, e.damaged + n);
  }

  all() {
    return SHIPS;
  }
}
