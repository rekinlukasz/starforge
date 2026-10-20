// Minimal key-value storage interface. Swap for IndexedDB/native storage by
// implementing the same three methods.

export class LocalStorageAdapter {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }
  get(key) { return this.storage.getItem(key); }
  set(key, value) { this.storage.setItem(key, value); }
  remove(key) { this.storage.removeItem(key); }
}

export class MemoryStorageAdapter {
  constructor() { this.data = new Map(); }
  get(key) { return this.data.has(key) ? this.data.get(key) : null; }
  set(key, value) { this.data.set(key, String(value)); }
  remove(key) { this.data.delete(key); }
}

export function createDefaultAdapter() {
  try {
    const probe = '__starforge_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return new LocalStorageAdapter();
  } catch {
    console.warn('[Storage] localStorage unavailable, progress will not persist');
    return new MemoryStorageAdapter();
  }
}
