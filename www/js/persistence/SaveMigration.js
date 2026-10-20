import { SAVE_VERSION } from '../core/GameState.js';

// Each migration upgrades a raw save object from version N to N+1.
const MIGRATIONS = {
  // v1 (prototype format): resources and buildings stored as flat numbers,
  // e.g. { resources: { energy: 50 }, buildings: { asteroidMine: 3 } }.
  1: (save) => {
    const resources = {};
    for (const [id, v] of Object.entries(save.resources ?? {})) {
      resources[id] = { amount: v, totalEarned: 0, unlocked: Number(v) > 0 };
    }
    const buildings = {};
    for (const [id, level] of Object.entries(save.buildings ?? {})) {
      buildings[id] = { level, unlocked: Number(level) > 0 };
    }
    return { ...save, version: 2, resources, buildings };
  },
  // v2 -> v3: research, missions, achievements and automation were added.
  // Their defaults come from sanitizeState; earlier saves simply had none.
  2: (save) => ({ ...save, version: 3 }),
  // v3 -> v4: space layer (sectors, planets, fleet, expeditions, colonies, logistics).
  3: (save) => ({ ...save, version: 4 }),
  // v4 -> v5: megastructures and Galactic Rebirth.
  4: (save) => ({ ...save, version: 5 }),
};

export function migrate(save) {
  let current = save;
  let version = Number(current.version);
  if (!Number.isInteger(version) || version < 1) throw new Error('Nieprawidłowa wersja zapisu');
  if (version > SAVE_VERSION) throw new Error('Zapis pochodzi z nowszej wersji gry');
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Brak migracji z wersji ${version}`);
    current = step(current);
    version = current.version;
  }
  return current;
}
