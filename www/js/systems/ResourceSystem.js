import { RESOURCE_MAP } from '../../data/resources.js';
import { BigNumber } from '../utils/BigNumber.js';

// The only module that mutates resource amounts.
export class ResourceSystem {
  constructor(game) {
    this.game = game;
  }

  entry(id) {
    const e = this.game.state.resources[id];
    if (!e) throw new Error(`Unknown resource: ${id}`);
    return e;
  }

  amount(id) {
    return this.entry(id).amount;
  }

  // Storage limit or null when unlimited.
  cap(id) {
    const def = RESOURCE_MAP[id];
    if (!def || def.cap === null) return null;
    const mods = this.game.modifiers.get();
    return BigNumber.from(def.cap).mul(mods.capMult * (mods.resourceCapMult[id] ?? 1));
  }

  // Adds a non-negative amount, clamped to the cap. Returns the amount actually stored.
  add(id, value) {
    const v = BigNumber.from(value);
    if (v.lte(0)) return BigNumber.ZERO;
    const e = this.entry(id);
    const cap = this.cap(id);
    let next = e.amount.add(v);
    if (cap && next.gt(cap)) next = BigNumber.max(cap, e.amount); // never reduce over-cap stock
    const added = next.sub(e.amount);
    e.amount = next;
    if (added.gt(0)) {
      e.totalEarned = e.totalEarned.add(added);
      if (!e.unlocked) {
        e.unlocked = true;
        this.game.events.emit('resourceUnlocked', id);
      }
    }
    return added;
  }

  // Removes up to `value`; never drops below zero. Returns the amount removed.
  remove(id, value) {
    const v = BigNumber.from(value);
    if (v.lte(0)) return BigNumber.ZERO;
    const e = this.entry(id);
    const removed = BigNumber.min(v, e.amount);
    e.amount = e.amount.sub(removed);
    if (e.amount.lt(0)) e.amount = BigNumber.ZERO;
    return removed;
  }

  // cost: { resourceId: number|BigNumber }
  canAfford(cost) {
    return Object.entries(cost).every(([id, v]) => this.amount(id).gte(v));
  }

  // List of { id, need, have } for unaffordable parts of a cost.
  shortfall(cost) {
    return Object.entries(cost)
      .filter(([id, v]) => this.amount(id).lt(v))
      .map(([id, v]) => ({ id, need: BigNumber.from(v), have: this.amount(id) }));
  }

  // Atomic: checks every component first, then deducts all or nothing.
  spend(cost) {
    if (!this.validCost(cost) || !this.canAfford(cost)) return false;
    for (const [id, v] of Object.entries(cost)) {
      const e = this.entry(id);
      e.amount = e.amount.sub(v);
    }
    return true;
  }

  validCost(cost) {
    if (!cost || typeof cost !== 'object') return false;
    return Object.entries(cost).every(([id, v]) => RESOURCE_MAP[id] && BigNumber.from(v).gte(0));
  }
}
