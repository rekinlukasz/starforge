import { ACHIEVEMENTS } from '../../data/achievements.js';
import { evaluateConditions } from './Conditions.js';

// Achievements unlock once, permanently; the bonus is derived from the count
// of unlocked entries in ModifierSystem.
export class AchievementSystem {
  constructor(game) {
    this.game = game;
  }

  isUnlocked(id) {
    return Boolean(this.game.state.achievements[id]);
  }

  evaluate() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (this.isUnlocked(a.id)) continue;
      if (evaluateConditions(this.game.state, a.goal).met) {
        this.game.state.achievements[a.id] = this.game.state.meta.simTime;
        changed = true;
        this.game.events.emit('achievementUnlocked', a.id);
      }
    }
    if (changed) this.game.modifiers.invalidate();
  }

  count() {
    return Object.keys(this.game.state.achievements).length;
  }
}
