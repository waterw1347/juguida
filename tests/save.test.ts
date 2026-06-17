import { describe, it, expect } from 'vitest';
import { SaveStore } from '../src/services/persistence/SaveStore';
import { migrate, defaultSave, SAVE_VERSION } from '../src/services/persistence/schema';
import type { SaveGame } from '../src/services/persistence/schema';

describe('SaveStore (fake-indexeddb)', () => {
  it('round-trips a save through IndexedDB', async () => {
    const store = new SaveStore();
    const game: SaveGame = {
      version: SAVE_VERSION,
      credits: 540,
      collection: { kr_cheonyeo: { count: 3, firstCaughtAt: 111 } },
    };
    await store.save(game);
    expect(await store.load()).toEqual(game);
  });

  it('returns defaults after clear', async () => {
    const store = new SaveStore();
    await store.save({ version: SAVE_VERSION, credits: 99, collection: {} });
    await store.clear();
    expect(await store.load()).toEqual(defaultSave());
  });
});

describe('migrate', () => {
  it('returns a default save for null/garbage input', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate(42)).toEqual(defaultSave());
    expect(migrate('nope')).toEqual(defaultSave());
  });

  it('clamps invalid credits to 0', () => {
    expect(migrate({ credits: -10, collection: {} }).credits).toBe(0);
    expect(migrate({ credits: Number.NaN, collection: {} }).credits).toBe(0);
  });

  it('drops malformed collection entries but keeps valid ones', () => {
    const result = migrate({
      credits: 10,
      collection: {
        good: { count: 2, firstCaughtAt: 5 },
        zero: { count: 0, firstCaughtAt: 5 },
        bad: 'not-an-object',
      },
    });
    expect(result.collection).toEqual({ good: { count: 2, firstCaughtAt: 5 } });
  });
});
