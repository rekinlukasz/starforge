import { MISSIONS, MISSION_MAP } from '../../data/missions.js';
import { evaluateConditions } from './Conditions.js';
import { BigNumber } from '../utils/BigNumber.js';

// Mission states: locked (prerequisite missions unclaimed) -> active ->
// completed (goal met, reward waiting) -> claimed. Completion is latched in
// the save so a goal met once stays met even if, e.g., stock is spent.
export class MissionSystem {
  constructor(game) {
    this.game = game;
  }

  entry(id) {
    const m = this.game.state.missions;
    if (!m[id]) m[id] = { completed: false, claimed: false };
    return m[id];
  }

  status(id) {
    const e = this.game.state.missions[id];
    if (e?.claimed) return 'claimed';
    if (e?.completed) return 'completed';
    const def = MISSION_MAP[id];
    const unlocked = def.after.every((a) => this.game.state.missions[a]?.claimed);
    return unlocked ? 'active' : 'locked';
  }

  progress(id) {
    return evaluateConditions(this.game.state, MISSION_MAP[id].goal);
  }

  // Latches completion for active missions. Cheap enough to run every step.
  evaluate() {
    for (const m of MISSIONS) {
      if (this.status(m.id) !== 'active') continue;
      if (this.progress(m.id).met) {
        this.entry(m.id).completed = true;
        this.game.events.emit('missionCompleted', m.id);
      }
    }
  }

  // Resources that would be lost to full storage if claimed now.
  overflow(id) {
    const res = this.game.resources;
    return Object.entries(MISSION_MAP[id].reward).filter(([r, v]) => {
      const cap = res.cap(r);
      return cap && res.amount(r).add(v).gt(cap);
    }).map(([r]) => r);
  }

  // Grants the reward exactly once.
  claim(id) {
    if (!MISSION_MAP[id] || this.status(id) !== 'completed') return false;
    const e = this.entry(id);
    e.claimed = true; // mark first: no double grant even if an event handler re-enters
    for (const [r, v] of Object.entries(MISSION_MAP[id].reward)) this.game.resources.add(r, BigNumber.from(v));
    this.game.events.emit('missionClaimed', id);
    this.evaluate(); // follow-up missions may already be satisfied
    return true;
  }

  // Most relevant mission for the home screen: claimable first, then active tutorial, then any active.
  featured() {
    const list = MISSIONS.map((m) => ({ m, s: this.status(m.id) }));
    return (list.find((x) => x.s === 'completed')
      ?? list.find((x) => x.s === 'active' && x.m.type === 'tutorial')
      ?? list.find((x) => x.s === 'active'))?.m ?? null;
  }

  claimableCount() {
    return MISSIONS.filter((m) => this.status(m.id) === 'completed').length;
  }
}
