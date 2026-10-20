import { describe, it, expect } from 'vitest';
import { Game } from '../www/js/core/Game.js';
import { MemoryStorageAdapter } from '../www/js/persistence/StorageAdapter.js';
import { SAVE_KEY, BACKUP_KEY, CORRUPT_KEY } from '../www/js/persistence/SaveManager.js';
import { SAVE_VERSION } from '../www/js/core/GameState.js';

const T0 = 1_700_000_000_000;

function playedGame(storage) {
  const g = new Game({ storage, now: T0 });
  g.load(T0);
  g.resources.add('metal', 400);
  g.buyUpgrade('reinforcedCoils');
  g.buyBuilding('asteroidMine', '10');
  g.simulate(30);
  return g;
}

describe('Save and load', () => {
  it('round-trips the full state', () => {
    const storage = new MemoryStorageAdapter();
    const g = playedGame(storage);
    g.save(T0 + 1000);
    const g2 = new Game({ storage, now: T0 });
    const r = g2.load(T0 + 2000);
    expect(r.source).toBe('main');
    expect(g2.buildings.level('asteroidMine')).toBe(g.buildings.level('asteroidMine'));
    expect(g2.upgrades.isOwned('reinforcedCoils')).toBe(true);
    expect(g2.resources.amount('metal').eq(g.resources.amount('metal'))).toBe(true);
    expect(g2.state.meta.simTime).toBe(g.state.meta.simTime);
  });

  it('starts a new game when nothing is stored', () => {
    const g = new Game({ storage: new MemoryStorageAdapter(), now: T0 });
    expect(g.load(T0).source).toBe('new');
    expect(g.resources.amount('energy').toNumber()).toBe(50);
  });

  it('keeps the previous valid save as backup', () => {
    const storage = new MemoryStorageAdapter();
    const g = playedGame(storage);
    g.save(T0);
    const first = storage.get(SAVE_KEY);
    g.resources.add('metal', 1);
    g.save(T0 + 1);
    expect(storage.get(BACKUP_KEY)).toBe(first);
  });

  it('recovers from a corrupted main save using the backup', () => {
    const storage = new MemoryStorageAdapter();
    const g = playedGame(storage);
    g.save(T0);
    g.save(T0 + 1);
    storage.set(SAVE_KEY, '{ broken json');
    const g2 = new Game({ storage, now: T0 });
    const r = g2.load(T0 + 5);
    expect(r.source).toBe('backup');
    expect(r.error).toBeTruthy();
    expect(g2.buildings.level('asteroidMine')).toBe(10);
    expect(storage.get(CORRUPT_KEY)).toBe('{ broken json');
  });

  it('falls back to new game when both saves are broken', () => {
    const storage = new MemoryStorageAdapter();
    storage.set(SAVE_KEY, 'garbage');
    storage.set(BACKUP_KEY, 'also garbage');
    const g = new Game({ storage, now: T0 });
    const r = g.load(T0);
    expect(r.source).toBe('new');
    expect(r.error).toBeTruthy();
  });

  it('fills missing fields with defaults and drops unknown data', () => {
    const storage = new MemoryStorageAdapter();
    storage.set(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      resources: { metal: { amount: '1.5e2' }, hacked: { amount: 1e9 } },
      buildings: { asteroidMine: { level: 3 }, fakeBuilding: { level: 99 } },
      upgrades: { reinforcedCoils: true, godMode: true },
    }));
    const g = new Game({ storage, now: T0 });
    g.load(T0);
    expect(g.resources.amount('metal').toNumber()).toBe(150);
    expect(g.resources.amount('energy').toNumber()).toBe(50); // default
    expect(g.state.resources.hacked).toBeUndefined();
    expect(g.state.buildings.fakeBuilding).toBeUndefined();
    expect(g.state.upgrades.godMode).toBeUndefined();
    expect(g.buildings.level('asteroidMine')).toBe(3);
    expect(g.state.settings.offlineCapHours).toBe(8);
  });

  it('rejects negative and non-numeric values', () => {
    const storage = new MemoryStorageAdapter();
    storage.set(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      resources: { metal: { amount: '-5e3' }, silicon: { amount: 'lots' } },
      buildings: { asteroidMine: { level: -4 } },
    }));
    const g = new Game({ storage, now: T0 });
    g.load(T0);
    expect(g.resources.amount('metal').toNumber()).toBe(0);
    expect(g.resources.amount('silicon').toNumber()).toBe(0);
    expect(g.buildings.level('asteroidMine')).toBe(0);
  });

  it('migrates a version 1 save', () => {
    const storage = new MemoryStorageAdapter();
    storage.set(SAVE_KEY, JSON.stringify({
      version: 1,
      meta: { createdAt: T0, lastSimulationAt: T0 },
      resources: { energy: 75, metal: 40 },
      buildings: { asteroidMine: 2 },
    }));
    const g = new Game({ storage, now: T0 });
    const r = g.load(T0);
    expect(r.source).toBe('main');
    expect(g.state.version).toBe(SAVE_VERSION);
    expect(g.resources.amount('metal').toNumber()).toBe(40);
    expect(g.buildings.level('asteroidMine')).toBe(2);
  });

  it('refuses saves from a newer game version', () => {
    const storage = new MemoryStorageAdapter();
    storage.set(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 1 }));
    const g = new Game({ storage, now: T0 });
    expect(g.load(T0).source).toBe('new');
  });

  it('exports and imports a save string', () => {
    const g = playedGame(new MemoryStorageAdapter());
    const code = g.exportSave();
    expect(code.startsWith('SF1:')).toBe(true);
    const g2 = new Game({ storage: new MemoryStorageAdapter(), now: T0 });
    g2.importSave(code, T0 + 10);
    expect(g2.buildings.level('asteroidMine')).toBe(10);
  });

  it('import rejects invalid input with a readable error', () => {
    const g = new Game({ storage: new MemoryStorageAdapter(), now: T0 });
    expect(() => g.importSave('hello')).toThrow(/nie jest kod/);
    expect(() => g.importSave('SF1:@@@')).toThrow();
    expect(g.resources.amount('energy').toNumber()).toBe(50);
  });

  it('keeps story journal de-duplicated across reloads', () => {
    const storage = new MemoryStorageAdapter();
    const g = playedGame(storage);
    g.save(T0);
    const g2 = new Game({ storage, now: T0 });
    g2.load(T0);
    g2.resources.add('metal', 300);
    g2.buyBuilding('asteroidMine', '1');
    expect(g2.state.log.filter((e) => e.key === 'b:asteroidMine')).toHaveLength(1);
  });
});
