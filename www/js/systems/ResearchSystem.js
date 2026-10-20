import { TECHNOLOGIES, TECH_MAP, TIER_DURATION } from '../../data/technologies.js';
import { checkConditions } from './Conditions.js';

export const MAX_QUEUE = 5;

// One active research at a time plus a short queue. Costs are paid when a
// project starts (atomically); progress advances with simulation time, so it
// runs identically offline. Completion is recorded in research.completed —
// effects are derived from that set, so they apply exactly once.
export class ResearchSystem {
  constructor(game) {
    this.game = game;
  }

  get rs() {
    return this.game.state.research;
  }

  isCompleted(id) {
    return Boolean(this.rs.completed[id]);
  }

  isActive(id) {
    return this.rs.active?.id === id;
  }

  isQueued(id) {
    return this.rs.queue.includes(id);
  }

  prerequisitesMet(id) {
    const def = TECH_MAP[id];
    return def.requires.every((r) => this.isCompleted(r)) && this.conditionMet(id);
  }

  // Extra unlock condition (e.g. prestige-only branch).
  conditionMet(id) {
    const cond = TECH_MAP[id].condition;
    return !cond || checkConditions(this.game.state, cond).met;
  }

  // 'completed' | 'active' | 'queued' | 'available' | 'locked'
  status(id) {
    if (this.isCompleted(id)) return 'completed';
    if (this.isActive(id)) return 'active';
    if (this.isQueued(id)) return 'queued';
    return this.prerequisitesMet(id) ? 'available' : 'locked';
  }

  speed() {
    return this.game.modifiers.get().researchSpeed;
  }

  // Research time in seconds at current speed.
  duration(id) {
    return TIER_DURATION[TECH_MAP[id].tier] / this.speed();
  }

  // Starts research now if nothing is running, otherwise appends to the queue
  // (queued projects are paid when they start). Returns a result code.
  start(id) {
    const def = TECH_MAP[id];
    if (!def) return 'invalid';
    const st = this.status(id);
    if (st === 'completed' || st === 'active' || st === 'queued') return st;
    if (this.rs.active) {
      // Queued techs may depend on the active/queued ones.
      const pending = new Set([this.rs.active.id, ...this.rs.queue]);
      const ok = this.conditionMet(id) && def.requires.every((r) => this.isCompleted(r) || pending.has(r));
      if (!ok) return 'locked';
      if (this.rs.queue.length >= MAX_QUEUE) return 'queueFull';
      this.rs.queue.push(id);
      this.game.events.emit('researchQueued', id);
      return 'queued';
    }
    if (st !== 'available') return st;
    if (!this.game.resources.spend(def.cost)) return 'unaffordable';
    this.rs.active = { id, progress: 0 }; // progress in base-duration seconds
    this.game.events.emit('researchStarted', id);
    return 'started';
  }

  // Queue entries can also be started out of order by tapping them; this
  // removes one from the queue (nothing was paid for it yet).
  dequeue(id) {
    const i = this.rs.queue.indexOf(id);
    if (i < 0) return false;
    this.rs.queue.splice(i, 1);
    // Drop queued techs that depended on it.
    this.rs.queue = this.rs.queue.filter((q) => TECH_MAP[q].requires.every((r) => this.isCompleted(r) || r === this.rs.active?.id || this.rs.queue.includes(r)));
    return true;
  }

  // Cancels the active project with a full refund.
  cancel() {
    const active = this.rs.active;
    if (!active) return false;
    for (const [r, v] of Object.entries(TECH_MAP[active.id].cost)) this.game.resources.add(r, v);
    this.rs.active = null;
    this.rs.queue = [];
    this.game.events.emit('researchCancelled', active.id);
    return true;
  }

  progressRatio() {
    const a = this.rs.active;
    if (!a) return 0;
    return Math.min(1, a.progress / TIER_DURATION[TECH_MAP[a.id].tier]);
  }

  remainingSeconds() {
    const a = this.rs.active;
    if (!a) return 0;
    return Math.max(0, (TIER_DURATION[TECH_MAP[a.id].tier] - a.progress) / this.speed());
  }

  tick(dt) {
    let left = dt;
    // Loop so a long step can finish several short projects in a row.
    for (let guard = 0; guard < 50 && this.rs.active && left > 0; guard++) {
      const a = this.rs.active;
      const total = TIER_DURATION[TECH_MAP[a.id].tier];
      const speed = this.speed();
      const needed = (total - a.progress) / speed;
      if (left < needed) {
        a.progress += left * speed;
        return;
      }
      left -= needed;
      this.complete(a.id);
      this.startNextQueued();
    }
  }

  complete(id) {
    if (this.rs.completed[id]) return;
    this.rs.completed[id] = true;
    this.rs.active = null;
    this.game.modifiers.invalidate();
    this.game.buildings.refreshUnlocks();
    this.game.events.emit('researchCompleted', id);
  }

  startNextQueued() {
    while (this.rs.queue.length) {
      const next = this.rs.queue.shift();
      if (this.status(next) !== 'available') continue;
      const def = TECH_MAP[next];
      if (!this.game.resources.spend(def.cost)) {
        // Not affordable yet: keep it at the head of the queue and wait.
        this.rs.queue.unshift(next);
        return;
      }
      this.rs.active = { id: next, progress: 0 };
      this.game.events.emit('researchStarted', next);
      return;
    }
  }

  // Called each step: a queue blocked by cost retries when resources arrive.
  retryQueue() {
    if (!this.rs.active && this.rs.queue.length) this.startNextQueued();
  }

  countCompleted() {
    return Object.keys(this.rs.completed).length;
  }

  all() {
    return TECHNOLOGIES;
  }
}
