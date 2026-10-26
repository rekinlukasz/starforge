import { Game } from './core/Game.js';
import { GameLoop } from './core/GameLoop.js';
import { UIManager } from './ui/UIManager.js';
import { createDefaultAdapter } from './persistence/StorageAdapter.js';
import { resolveQuality } from './render3d/layout.js';

const isCordova = Boolean(window.cordova);

function boot() {
  const game = new Game({ storage: createDefaultAdapter() });
  const loadResult = game.load();
  const ui = new UIManager(game, document.getElementById('root'));
  ui.mount();

  // ---- optional 3D layer --------------------------------------------------
  // Loaded lazily after the UI is up; any failure (no WebGL, old WebView)
  // simply leaves the 2D interface in place.
  let renderer = null;
  let applying = Promise.resolve();
  const device = { cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, dpr: window.devicePixelRatio };
  function apply3D() {
    applying = applying.then(async () => {
      const quality = resolveQuality(game.state.settings.graphics, device);
      if (renderer && (!quality || renderer.quality.name !== quality.name)) {
        ui.detach3D();
        renderer.dispose();
        renderer = null;
      }
      if (!quality || renderer) return;
      try {
        const mod = await import('./render3d/Renderer3D.js');
        if (!mod.isWebGLAvailable()) return;
        renderer = new mod.Renderer3D(game, quality, { reduceMotion: game.state.settings.reduceMotion });
        renderer.mount(document.body);
        ui.attach3D(renderer);
      } catch (err) {
        console.warn('[3D] disabled:', err);
        renderer?.dispose();
        renderer = null;
        ui.detach3D();
      }
    });
    return applying;
  }
  game.events.on('graphicsChanged', apply3D);
  game.events.on('stateReplaced', apply3D);
  game.events.on('settingsChanged', () => renderer?.setReduceMotion(game.state.settings.reduceMotion));
  apply3D();

  let offlinePending = false;
  const loop = new GameLoop(game, {
    onRender: () => ui.render(),
    onOffline: () => runOffline(),
  });

  // Long absence -> show report before granting anything. The loop stays
  // stopped while the report is open, so no time is counted twice.
  function runOffline() {
    if (offlinePending) return;
    offlinePending = true;
    const pending = game.offline.prepare();
    ui.showOfflineReport(pending, () => {
      game.offline.accept(pending);
      offlinePending = false;
      loop.start();
    });
  }

  function resume() {
    renderer?.resume();
    if (offlinePending) return;
    if (game.update()) loop.start();
    else runOffline();
  }

  function suspend() {
    renderer?.pause();
    if (offlinePending) return; // nothing simulated yet; state on disk is still valid
    loop.suspend();
  }

  // A recovery notice must be read before the (possible) offline report.
  if (loadResult.error) ui.showLoadProblem(loadResult.source, loadResult.error, resume);
  else resume();

  // Lifecycle -------------------------------------------------------------
  if (isCordova) {
    document.addEventListener('pause', suspend, false);
    document.addEventListener('resume', () => setTimeout(resume, 0), false);
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      if (offlinePending) return;
      if (!ui.handleBack()) {
        game.save();
        navigator.app?.exitApp?.();
      }
    }, false);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
    else resume();
  });
  window.addEventListener('pagehide', suspend);

  window.starforge = { game, get renderer() { return renderer; } }; // debugging aid in the browser console
}

if (isCordova) document.addEventListener('deviceready', boot, false);
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
