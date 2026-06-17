import type { GhostDef, Rarity } from '../data/catalog.types';
import { RARITIES } from '../data/catalog.types';
import type { Rng } from './rng';

export type TierProbabilities = Record<Rarity, number>;

/** Default odds that a spawn rolls each tier (need not sum to exactly 1 —
 *  values are normalized, and tiers with no ghosts are excluded). */
export const DEFAULT_TIER_PROBABILITIES: TierProbabilities = {
  common: 0.55,
  uncommon: 0.25,
  rare: 0.13,
  epic: 0.055,
  legendary: 0.015,
};

/**
 * Picks which ghost spawns: roll a rarity tier, then a weighted pick within it.
 * "How often a legendary appears" (tier odds) and "which legendary" (spawnWeight)
 * stay independently tunable. Deterministic given a seeded RNG.
 */
export class RaritySystem {
  private readonly byTier: Map<Rarity, GhostDef[]>;
  private readonly tierProbabilities: TierProbabilities;

  constructor(
    catalog: readonly GhostDef[],
    private readonly rng: Rng,
    tierProbabilities: TierProbabilities = DEFAULT_TIER_PROBABILITIES,
  ) {
    this.tierProbabilities = tierProbabilities;
    this.byTier = new Map();
    for (const rarity of RARITIES) this.byTier.set(rarity, []);
    for (const def of catalog) this.byTier.get(def.rarity)?.push(def);
  }

  /** Returns a ghost definition, or null if the catalog is empty. */
  pick(): GhostDef | null {
    const tier = this.pickTier();
    if (tier === null) return null;
    return this.pickWithinTier(tier);
  }

  private pickTier(): Rarity | null {
    const available = RARITIES.filter((r) => (this.byTier.get(r)?.length ?? 0) > 0);
    if (available.length === 0) return null;

    const total = available.reduce((sum, r) => sum + this.tierProbabilities[r], 0);
    if (total <= 0) return available[available.length - 1];

    let roll = this.rng() * total;
    for (const rarity of available) {
      roll -= this.tierProbabilities[rarity];
      if (roll < 0) return rarity;
    }
    return available[available.length - 1];
  }

  private pickWithinTier(tier: Rarity): GhostDef {
    const ghosts = this.byTier.get(tier);
    if (!ghosts || ghosts.length === 0) {
      throw new Error(`RaritySystem: tier "${tier}" unexpectedly empty`);
    }
    const total = ghosts.reduce((sum, g) => sum + Math.max(0, g.spawnWeight), 0);
    if (total <= 0) return ghosts[0];

    let roll = this.rng() * total;
    for (const ghost of ghosts) {
      roll -= Math.max(0, ghost.spawnWeight);
      if (roll < 0) return ghost;
    }
    return ghosts[ghosts.length - 1];
  }
}
