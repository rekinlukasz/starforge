import { BUILDINGS } from '../../data/buildings.js';

export const AUTOBUY_INTERVAL = 5; // simulated seconds between auto-buy passes
export const AUTOBUY_THRESHOLDS = [0.05, 0.1, 0.25, 0.5];

// Auto-buy (tech "autoBuilders"): for each building the player enabled, buy
// one level when every cost component is at most `threshold` of the current
// stock. The player still decides *what* to grow; automation only removes
// repetitive tapping. Runs on simulation time, so it also works offline.
export class AutomationSystem {
  constructor(game) {
    this.game = game;
    this.timer = 0;
  }

  get settings() {
    return this.game.state.automation;
  }

  available() {
    return this.game.modifiers.hasFeature('autobuy');
  }

  isEnabled(id) {
    return Boolean(this.settings.autobuy[id]);
  }

  setEnabled(id, on) {
    if (!this.available() || !this.game.buildings.def(id)) return false;
    if (on) this.settings.autobuy[id] = true;
    else delete this.settings.autobuy[id];
    return true;
  }

  setThreshold(value) {
    if (!AUTOBUY_THRESHOLDS.includes(value)) return false;
    this.settings.threshold = value;
    return true;
  }

  setAutoclick(on) {
    this.settings.autoclick = Boolean(on);
  }

  tick(dt) {
    if (!this.available()) return;
    this.timer += dt;
    if (this.timer < AUTOBUY_INTERVAL) return;
    this.timer = 0;
    const threshold = this.settings.threshold;
    const res = this.game.resources;
    for (const b of BUILDINGS) {
      if (!this.isEnabled(b.id) || !this.game.buildings.isUnlocked(b.id)) continue;
      const cost = this.game.buildings.cost(b.id, 1);
      const cheap = Object.entries(cost).every(([r, v]) => res.amount(r).mul(threshold).gte(v));
      if (cheap) this.game.buildings.buy(b.id, 1);
    }
  }
}
