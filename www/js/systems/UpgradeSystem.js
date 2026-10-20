import { UPGRADES, UPGRADE_MAP } from '../../data/upgrades.js';
import { checkConditions } from './Conditions.js';

export class UpgradeSystem {
  constructor(game) {
    this.game = game;
  }

  isOwned(id) {
    return Boolean(this.game.state.upgrades[id]);
  }

  unlockStatus(id) {
    return checkConditions(this.game.state, UPGRADE_MAP[id].unlock);
  }

  // Upgrades visible in the UI: owned ones and those whose conditions are met.
  visible() {
    return UPGRADES.filter((u) => this.isOwned(u.id) || this.unlockStatus(u.id).met);
  }

  // Atomic, one-time purchase. Returns true on success.
  buy(id) {
    const def = UPGRADE_MAP[id];
    if (!def || this.isOwned(id)) return false;
    if (!this.unlockStatus(id).met) return false;
    if (!this.game.resources.spend(def.cost)) return false;
    this.game.state.upgrades[id] = true;
    this.game.modifiers.invalidate();
    this.game.buildings.refreshUnlocks();
    this.game.events.emit('upgradeBought', id);
    return true;
  }
}
