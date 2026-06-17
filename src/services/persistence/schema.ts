/** A captured species' record in the 도감 (collection). */
export interface CollectionEntry {
  count: number;
  /** Wall-clock ms of the first capture. */
  firstCaughtAt: number;
}

export type CollectionMap = Record<string, CollectionEntry>;

export const SAVE_VERSION = 1;

export interface SaveGame {
  version: number;
  credits: number;
  collection: CollectionMap;
}

export function defaultSave(): SaveGame {
  return { version: SAVE_VERSION, credits: 0, collection: {} };
}

/**
 * Normalizes persisted data into a valid SaveGame. Guards against corruption and
 * old versions so a bad/foreign save never crashes the game — future schema bumps
 * add migration branches here.
 */
export function migrate(raw: unknown): SaveGame {
  if (!raw || typeof raw !== 'object') return defaultSave();
  const r = raw as Partial<SaveGame>;
  const credits =
    typeof r.credits === 'number' && Number.isFinite(r.credits) && r.credits >= 0
      ? Math.floor(r.credits)
      : 0;
  return { version: SAVE_VERSION, credits, collection: sanitizeCollection(r.collection) };
}

function sanitizeCollection(value: unknown): CollectionMap {
  if (!value || typeof value !== 'object') return {};
  const out: CollectionMap = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Partial<CollectionEntry>;
    const count = typeof e.count === 'number' && e.count > 0 ? Math.floor(e.count) : 0;
    if (count <= 0) continue;
    const firstCaughtAt = typeof e.firstCaughtAt === 'number' && e.firstCaughtAt >= 0 ? e.firstCaughtAt : 0;
    out[id] = { count, firstCaughtAt };
  }
  return out;
}
