import type { GhostDef, Rarity, OriginCountry } from '../src/data/catalog.types';

/** Build a catalog entry with sensible defaults for tests. */
export function makeDef(
  id: string,
  rarity: Rarity,
  overrides: Partial<GhostDef> = {},
): GhostDef {
  return {
    id,
    name: { ko: id, en: id },
    origin: 'GLOBAL' as OriginCountry,
    rarity,
    spawnWeight: 1,
    catchDifficulty: 1,
    catchProbability: 1,
    skittishness: 0,
    creditReward: 1,
    lore: { ko: '', en: '' },
    sprite: { atlas: '', frameWidth: 1, frameHeight: 1, frameCount: 1, fps: 1 },
    activeWindowMs: 5000,
    ambushBias: 0,
    revealIntensity: 0,
    ...overrides,
  };
}

/** One ghost per tier — useful for distribution tests. */
export const ONE_PER_TIER: GhostDef[] = [
  makeDef('c', 'common'),
  makeDef('u', 'uncommon'),
  makeDef('r', 'rare'),
  makeDef('e', 'epic'),
  makeDef('l', 'legendary'),
];
