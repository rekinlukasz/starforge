import { BUILDINGS, BUILDING_MAP, MILESTONES, MILESTONE_MULTIPLIER } from '../../data/buildings.js';
import { BigNumber } from '../utils/BigNumber.js';
import { checkConditions } from './Conditions.js';

const MAX_BATCH = 100000;

export class BuildingSystem {
  constructor(game) {
    this.game = game;
  }

  def(id) {
    const d = BUILDING_MAP[id];
    if (!d) throw new Error(`Unknown building: ${id}`);
    return d;
  }

  level(id) {
    return this.game.state.buildings[id]?.level ?? 0;
  }

  isUnlocked(id) {
    return Boolean(this.game.state.buildings[id]?.unlocked);
  }

  unlockStatus(id) {
    return checkConditions(this.game.state, this.def(id).unlock);
  }

  // Marks newly available buildings as unlocked. Unlocks are permanent.
  refreshUnlocks() {
    for (const b of BUILDINGS) {
      const entry = this.game.state.buildings[b.id];
      if (!entry.unlocked && this.unlockStatus(b.id).met) {
        entry.unlocked = true;
        this.game.events.emit('buildingUnlocked', b.id);
      }
    }
  }

  // Total cost of buying `count` levels starting at the current level:
  // sum_{k=L}^{L+count-1} base * g^k = base * g^L * (g^count - 1) / (g - 1)
  cost(id, count = 1) {
    const d = this.def(id);
    const L = this.level(id);
    const g = BigNumber.from(d.growth);
    const factor = g.pow(L).mul(g.pow(count).sub(1)).div(g.sub(1)).mul(this.costMultiplier());
    const result = {};
    for (const [res, base] of Object.entries(d.baseCost)) result[res] = factor.mul(base);
    return result;
  }

  costMultiplier() {
    return this.game.modifiers.get().costMult;
  }

  maxAffordable(id) {
    const d = this.def(id);
    const L = this.level(id);
    const g = d.growth;
    const gL = BigNumber.from(g).pow(L).mul(this.costMultiplier());
    let n = MAX_BATCH;
    for (const [res, base] of Object.entries(d.baseCost)) {
      const have = this.game.resources.amount(res);
      // have >= base * g^L * (g^n - 1)/(g-1)  =>  n <= log_g(have*(g-1)/(base*g^L) + 1)
      const x = have.mul(g - 1).div(gL.mul(base)).add(1);
      n = Math.min(n, Math.floor(x.log10() / Math.log10(g)));
    }
    n = Math.max(0, n);
    // Guard against floating-point rounding at the boundary.
    while (n > 0 && !this.game.resources.canAfford(this.cost(id, n))) n -= 1;
    return n;
  }

  nextMilestone(id) {
    const L = this.level(id);
    return MILESTONES.find((m) => m > L) ?? null;
  }

  // Resolves a buy mode into a concrete count ('1' | '10' | 'next' | 'max').
  countForMode(id, mode) {
    switch (mode) {
      case '10': return 10;
      case 'next': {
        const m = this.nextMilestone(id);
        return m ? m - this.level(id) : 1;
      }
      case 'max': return Math.max(1, this.maxAffordable(id));
      default: return 1;
    }
  }

  // Atomic purchase. Returns number of levels bought (0 on failure).
  buy(id, count = 1) {
    if (!BUILDING_MAP[id]) return 0;
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > MAX_BATCH) return 0;
    if (!this.isUnlocked(id)) return 0;
    const d = this.def(id);
    if (d.maxLevel && this.level(id) + n > d.maxLevel) return 0;
    if (!this.game.resources.spend(this.cost(id, n))) return 0;
    this.game.state.buildings[id].level += n;
    this.game.state.stats.buildingsBought += n;
    this.game.modifiers.invalidate();
    this.refreshUnlocks();
    this.game.events.emit('buildingBought', { id, count: n, level: this.level(id) });
    return n;
  }

  milestoneMultiplier(id) {
    const L = this.level(id);
    const reached = MILESTONES.filter((m) => L >= m).length;
    return Math.pow(MILESTONE_MULTIPLIER, reached);
  }
}
