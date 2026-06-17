import type { GhostDef } from '../data/catalog.types';

export interface RewardContext {
  /** Captured from a behind-you ambush. */
  ambush: boolean;
  /** First time this species was captured. */
  firstCatch: boolean;
}

export interface EconomyConfig {
  /** Bonus fraction of base reward for an ambush capture. */
  ambushBonusRate: number;
  /** Bonus fraction of base reward for a first-time (도감) capture. */
  firstCatchBonusRate: number;
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  ambushBonusRate: 0.25,
  firstCatchBonusRate: 0.5,
};

/** Pure reward math. Balance itself lives in the save (credits), not here. */
export class Economy {
  constructor(private readonly config: EconomyConfig = DEFAULT_ECONOMY_CONFIG) {}

  rewardFor(def: GhostDef, ctx: RewardContext): number {
    let reward = def.creditReward;
    if (ctx.ambush) reward += Math.round(def.creditReward * this.config.ambushBonusRate);
    if (ctx.firstCatch) reward += Math.round(def.creditReward * this.config.firstCatchBonusRate);
    return reward;
  }
}
