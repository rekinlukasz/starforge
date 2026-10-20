import { Game } from './core/Game.js';
import { GameLoop } from './core/GameLoop.js';
import { UIManager } from './ui/UIManager.js';
import { createDefaultAdapter } from './persistence/StorageAdapter.js';

const isCordova = Boolean(window.cordova);

function boot() {
  const game = new Game({ storage: createDefaultAdapter() });
  const loadResult = game.load();
  const ui = new UIManager(game, document.getElementById('root'));
  ui.mount();

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
    if (offlinePending) return;
    if (game.update()) loop.start();
    else runOffline();
  }

  function suspend() {
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

  window.starforge = { game }; // debugging aid in the browser console
}

if (isCordova) document.addEventListener('deviceready', boot, false);
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
