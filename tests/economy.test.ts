import { describe, it, expect } from 'vitest';
import { Economy } from '../src/game/Economy';
import { makeDef } from './fixtures';

describe('Economy', () => {
  const eco = new Economy();
  const def = makeDef('x', 'rare', { creditReward: 100 });

  it('awards the base reward with no bonuses', () => {
    expect(eco.rewardFor(def, { ambush: false, firstCatch: false })).toBe(100);
  });

  it('adds a 25% ambush bonus', () => {
    expect(eco.rewardFor(def, { ambush: true, firstCatch: false })).toBe(125);
  });

  it('adds a 50% first-catch bonus', () => {
    expect(eco.rewardFor(def, { ambush: false, firstCatch: true })).toBe(150);
  });

  it('stacks both bonuses', () => {
    expect(eco.rewardFor(def, { ambush: true, firstCatch: true })).toBe(175);
  });
});
