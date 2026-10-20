import { migrate } from './SaveMigration.js';
import { sanitizeState } from '../utils/Validation.js';

export const SAVE_KEY = 'starforge.save';
export const BACKUP_KEY = 'starforge.save.backup';
export const CORRUPT_KEY = 'starforge.save.corrupt';
const MAX_IMPORT_LENGTH = 2_000_000;
const EXPORT_PREFIX = 'SF1:';

export class SaveManager {
  constructor(adapter) {
    this.adapter = adapter;
  }

  serialize(state) {
    return JSON.stringify(state); // BigNumber.toJSON -> "me<e>" strings
  }

  // Parses, migrates and validates a JSON string. Throws on failure.
  parse(json, now = Date.now()) {
    const raw = JSON.parse(json);
    return sanitizeState(migrate(raw), now);
  }

  // Writes the state; the previous valid save becomes the backup.
  save(state, now = Date.now()) {
    state.meta.lastSavedAt = now;
    const data = this.serialize(state);
    try {
      const previous = this.adapter.get(SAVE_KEY);
      if (previous && this.isValid(previous)) this.adapter.set(BACKUP_KEY, previous);
      this.adapter.set(SAVE_KEY, data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  isValid(json) {
    try {
      this.parse(json);
      return true;
    } catch {
      return false;
    }
  }

  // Returns { state, source: 'main'|'backup'|'new', error? }.
  load(now = Date.now()) {
    const main = this.adapter.get(SAVE_KEY);
    if (!main) return { state: null, source: 'new' };
    try {
      return { state: this.parse(main, now), source: 'main' };
    } catch (mainError) {
      try { this.adapter.set(CORRUPT_KEY, main); } catch { /* storage full; ignore */ }
      const backup = this.adapter.get(BACKUP_KEY);
      if (backup) {
        try {
          return { state: this.parse(backup, now), source: 'backup', error: mainError };
        } catch { /* fall through */ }
      }
      return { state: null, source: 'new', error: mainError };
    }
  }

  wipe() {
    this.adapter.remove(SAVE_KEY);
    this.adapter.remove(BACKUP_KEY);
  }

  exportString(state) {
    const json = this.serialize(state);
    return EXPORT_PREFIX + toBase64(json);
  }

  // Validates an exported string; returns a sanitized state or throws.
  importString(text, now = Date.now()) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed.startsWith(EXPORT_PREFIX)) throw new Error('To nie jest kod zapisu Starforge');
    if (trimmed.length > MAX_IMPORT_LENGTH) throw new Error('Kod zapisu jest zbyt duży');
    let json;
    try {
      json = fromBase64(trimmed.slice(EXPORT_PREFIX.length));
    } catch {
      throw new Error('Kod zapisu jest uszkodzony');
    }
    return this.parse(json, now);
  }
}

// Unicode-safe base64 helpers (btoa only handles Latin-1).
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
