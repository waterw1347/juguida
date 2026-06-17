import { describe, it, expect } from 'vitest';
import { RaritySystem, DEFAULT_TIER_PROBABILITIES } from '../src/game/RaritySystem';
import { mulberry32 } from '../src/game/rng';
import type { Rarity } from '../src/data/catalog.types';
import { makeDef, ONE_PER_TIER } from './fixtures';

describe('RaritySystem', () => {
  it('returns null for an empty catalog', () => {
    const sys = new RaritySystem([], mulberry32(1));
    expect(sys.pick()).toBeNull();
  });

  it('tier frequencies converge to the configured probabilities', () => {
    const sys = new RaritySystem(ONE_PER_TIER, mulberry32(42));
    const counts: Record<Rarity, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
    const N = 40000;
    for (let i = 0; i < N; i++) {
      const def = sys.pick();
      if (def) counts[def.rarity] += 1;
    }
    for (const rarity of Object.keys(counts) as Rarity[]) {
      const observed = counts[rarity] / N;
      expect(observed).toBeCloseTo(DEFAULT_TIER_PROBABILITIES[rarity], 1);
    }
  });

  it('weights selection within a tier by spawnWeight', () => {
    const catalog = [
      makeDef('light', 'common', { spawnWeight: 1 }),
      makeDef('heavy', 'common', { spawnWeight: 3 }),
    ];
    const sys = new RaritySystem(catalog, mulberry32(7));
    let heavy = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      if (sys.pick()?.id === 'heavy') heavy += 1;
    }
    // Expect ~75% heavy (3 / (1 + 3)).
    expect(heavy / N).toBeCloseTo(0.75, 1);
  });

  it('always picks from the only populated tier', () => {
    const catalog = [makeDef('only', 'legendary')];
    const sys = new RaritySystem(catalog, mulberry32(99));
    for (let i = 0; i < 1000; i++) {
      expect(sys.pick()?.rarity).toBe('legendary');
    }
  });
});
