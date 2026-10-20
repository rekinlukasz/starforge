import { Game } from '../www/js/core/Game.js';
import { MemoryStorageAdapter } from '../www/js/persistence/StorageAdapter.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

export const T0 = 1_700_000_000_000;

export function newGame() {
  return new Game({ storage: new MemoryStorageAdapter(), now: T0 });
}

export function give(g, cost) {
  for (const [r, v] of Object.entries(cost)) {
    g.state.resources[r].amount = g.state.resources[r].amount.add(BigNumber.from(v));
  }
}

// Plenty of everything, bypassing caps (test setup only).
export function rich(g, amount = 1e9) {
  for (const id of Object.keys(g.state.resources)) {
    g.state.resources[id].amount = BigNumber.from(amount);
  }
}

export function research(g, ...ids) {
  for (const id of ids) g.state.research.completed[id] = true;
  g.modifiers.invalidate();
  g.buildings.refreshUnlocks();
}

export function setBuilding(g, id, level) {
  g.state.buildings[id].level = level;
  g.state.buildings[id].unlocked = true;
  g.modifiers.invalidate();
}

export function addShips(g, id, n) {
  g.fleet.entry(id).owned += n;
}
