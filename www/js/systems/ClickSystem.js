import { OVERCHARGE } from '../../data/upgrades.js';
import { BigNumber } from '../utils/BigNumber.js';

// Manual clicks on the orbital reactor. Kept bounded so that clicks matter
// early but never dominate later progression:
//   clickEnergy = (1 + clickAdd) * clickMult + clickRateShare * energyIncomePerSec
// The rate-share term is capped by the real production so late-game clicks
// stay proportional to the economy rather than exploding independently.
export const MAX_CLICKS_PER_SECOND = 20;
export const AUTO_CLICKS_PER_SECOND = 2;

export class ClickSystem {
  constructor(game) {
    this.game = game;
    this.recent = []; // wall timestamps of accepted clicks, rate limiting only
  }

  clickValue() {
    const m = this.game.modifiers.get();
    const flat = BigNumber.from((1 + m.clickAdd) * m.clickMult);
    const share = this.game.production.energyIncome().mul(m.clickRateShare);
    return flat.add(share);
  }

  // Returns the energy gained, or null if the click was rejected.
  click(now = Date.now()) {
    // Reject inhuman click rates (auto-clicker taps, duplicated touch events).
    this.recent = this.recent.filter((t) => now - t < 1000);
    if (this.recent.length >= MAX_CLICKS_PER_SECOND) return null;
    this.recent.push(now);

    const state = this.game.state;
    state.click.totalClicks += 1;
    const gained = this.game.resources.add('energy', this.clickValue());

    const mods = this.game.modifiers.get();
    if (mods.overchargeUnlocked && !this.game.modifiers.isOvercharged()) {
      state.click.charge = Math.min(OVERCHARGE.chargeRequired, state.click.charge + OVERCHARGE.chargePerClick);
      if (state.click.charge >= OVERCHARGE.chargeRequired) {
        state.click.charge = 0;
        state.click.overchargeUntil = state.meta.simTime + mods.overchargeDuration;
        this.game.events.emit('overcharge', { until: state.click.overchargeUntil });
      }
    }
    this.game.events.emit('click', { gained });
    return gained;
  }

  // Late-game automatic ignition: a fixed number of clicks per second, applied
  // by the simulation (so it also works offline). It never charges overcharge.
  autoTick(dt) {
    if (!this.game.modifiers.hasFeature('autoclick') || !this.game.state.automation.autoclick) return;
    this.game.resources.add('energy', this.clickValue().mul(AUTO_CLICKS_PER_SECOND * dt));
  }

  overchargeRemaining() {
    const { click, meta } = this.game.state;
    return Math.max(0, click.overchargeUntil - meta.simTime);
  }
}
