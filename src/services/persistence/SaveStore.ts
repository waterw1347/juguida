import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { defaultSave, migrate } from './schema';
import type { SaveGame } from './schema';

const DB_NAME = 'joogwida';
const DB_VERSION = 1;
const STORE = 'save';
const KEY = 'current';

/**
 * Persists the (small) save game to IndexedDB. Async + non-blocking so writes
 * never jank the render loop. All operations are best-effort: iOS may evict PWA
 * storage after ~7 days unused, so a missing/failed load falls back to defaults
 * rather than throwing. Catalog + sprites are NOT stored here — they are
 * re-fetchable SW-cached assets.
 */
export class SaveStore {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        },
      });
    }
    return this.dbPromise;
  }

  async load(): Promise<SaveGame> {
    try {
      const raw = await (await this.db()).get(STORE, KEY);
      return migrate(raw ?? defaultSave());
    } catch {
      return defaultSave();
    }
  }

  async save(game: SaveGame): Promise<void> {
    try {
      await (await this.db()).put(STORE, game, KEY);
    } catch {
      // Best-effort: storage may be unavailable or evicted.
    }
  }

  async clear(): Promise<void> {
    try {
      await (await this.db()).delete(STORE, KEY);
    } catch {
      // Best-effort.
    }
  }
}
