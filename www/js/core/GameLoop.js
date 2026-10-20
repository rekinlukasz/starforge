// Drives the game from wall-clock time. The timer only decides *when* to
// update; *how much* to simulate always comes from timestamps, so production
// is independent of timer frequency or dropped frames.
export class GameLoop {
  constructor(game, { onRender, onOffline, logicIntervalMs = 200, renderIntervalMs = 250, now = () => Date.now() }) {
    this.game = game;
    this.onRender = onRender;
    this.onOffline = onOffline;
    this.logicIntervalMs = logicIntervalMs;
    this.renderIntervalMs = renderIntervalMs;
    this.now = now;
    this.timer = null;
    this.lastRender = 0;
    this.lastAutosave = 0;
    this.paused = true;
  }

  start() {
    if (!this.paused) return;
    this.paused = false;
    this.lastAutosave = this.now();
    this.timer = setInterval(() => this.step(), this.logicIntervalMs);
    this.step();
  }

  stop() {
    this.paused = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  step() {
    if (this.paused) return;
    const now = this.now();
    const ok = this.game.update(now);
    if (!ok) {
      // Long gap (e.g. device slept without a pause event): offline flow.
      this.stop();
      this.onOffline?.();
      return;
    }
    if (now - this.lastAutosave >= this.game.state.settings.autosaveSeconds * 1000) {
      this.lastAutosave = now;
      this.game.save(now);
    }
    if (now - this.lastRender >= this.renderIntervalMs) {
      this.lastRender = now;
      this.onRender?.();
    }
  }

  // App went to background: simulate up to now and persist.
  suspend() {
    if (this.paused) return;
    this.game.update(this.now());
    this.game.save(this.now());
    this.stop();
  }
}
