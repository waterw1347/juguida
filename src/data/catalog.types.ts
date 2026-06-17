/** Ghost catalog schema. Designers tune balance via JSON; code reads these types. */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITIES: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

export type OriginCountry = 'KR' | 'JP' | 'CN' | 'EU' | 'US' | 'GLOBAL';

export const ORIGIN_COUNTRIES: readonly OriginCountry[] = [
  'KR',
  'JP',
  'CN',
  'EU',
  'US',
  'GLOBAL',
] as const;

export interface LocalizedText {
  ko: string;
  en: string;
}

/** Sprite-sheet reference. Until real art lands, the renderer falls back to a
 *  procedural placeholder tinted by rarity, so missing atlases never break play. */
export interface SpriteRef {
  atlas: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
}

export interface GhostDef {
  id: string;
  name: LocalizedText;
  origin: OriginCountry;
  rarity: Rarity;
  /** Relative weight within its rarity tier. */
  spawnWeight: number;
  /** 1..10 — higher fills the catch gauge slower. */
  catchDifficulty: number;
  /** 0..1 — success roll once the gauge is full. */
  catchProbability: number;
  /** 0..1 — tendency to jitter/flee while targeted. */
  skittishness: number;
  /** Base credits awarded on capture. */
  creditReward: number;
  lore: LocalizedText;
  sprite: SpriteRef;
  /** Milliseconds the ghost stays catchable after a "확!" reveal before fleeing. */
  activeWindowMs: number;
  /** 0..1 — preference for ambush (behind/out-of-view) reveals over探색 reveals. */
  ambushBias: number;
  /** 0..1 — scales the reveal effect (shake/flash/SFX). */
  revealIntensity: number;
}

export interface Catalog {
  version: number;
  ghosts: GhostDef[];
}
