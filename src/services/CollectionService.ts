import type { CollectionEntry, CollectionMap } from './persistence/schema';

/** Tracks which ghosts have been captured (the 도감). Backed by the save game. */
export class CollectionService {
  private entries: CollectionMap;

  constructor(initial: CollectionMap = {}) {
    this.entries = cloneMap(initial);
  }

  /** Replace all entries (e.g. after loading a save). */
  load(map: CollectionMap): void {
    this.entries = cloneMap(map);
  }

  has(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.entries, id);
  }

  get(id: string): CollectionEntry | undefined {
    return this.entries[id];
  }

  /** Record a capture. Returns whether this was the first time for the species. */
  record(id: string, now: number): { firstCatch: boolean } {
    const existing = this.entries[id];
    if (existing) {
      existing.count += 1;
      return { firstCatch: false };
    }
    this.entries[id] = { count: 1, firstCaughtAt: now };
    return { firstCatch: true };
  }

  /** Number of distinct species captured. */
  get caughtCount(): number {
    return Object.keys(this.entries).length;
  }

  /** Deep copy for persistence / store snapshots. */
  snapshot(): CollectionMap {
    return cloneMap(this.entries);
  }
}

function cloneMap(map: CollectionMap): CollectionMap {
  const out: CollectionMap = {};
  for (const [id, entry] of Object.entries(map)) out[id] = { ...entry };
  return out;
}
