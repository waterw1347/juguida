import { describe, it, expect, beforeEach } from 'vitest';
import { SpawnManager } from '../src/game/SpawnManager';
import type { SpawnConfig } from '../src/game/SpawnManager';
import { RaritySystem } from '../src/game/RaritySystem';
import { mulberry32 } from '../src/game/rng';
import type { SpawnEvent, Vec3 } from '../src/game/types';
import { ONE_PER_TIER } from './fixtures';

const DEG = Math.PI / 180;
const FRONT: Vec3 = { x: 0, y: 0, z: -1 };

function revealed(events: SpawnEvent[]) {
  return events.filter((e): e is Extract<SpawnEvent, { type: 'revealed' }> => e.type === 'revealed');
}
function warnings(events: SpawnEvent[]) {
  return events.filter((e): e is Extract<SpawnEvent, { type: 'warning' }> => e.type === 'warning');
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

describe('SpawnManager', () => {
  let time = 0;
  const clock = () => time;

  function makeManager(config: Partial<SpawnConfig> = {}) {
    return new SpawnManager({
      catalog: ONE_PER_TIER,
      rarity: new RaritySystem(ONE_PER_TIER, mulberry32(5)),
      rng: mulberry32(123),
      clock,
      config,
    });
  }

  // Advance the fake clock and tick.
  function step(mgr: SpawnManager, forward: Vec3, dtMs: number): SpawnEvent[] {
    time += dtMs;
    return mgr.update(forward, dtMs / 1000);
  }

  // Gaze fires fast; warningLeadMs:1 means the pop resolves the tick after the warning.
  const GAZE: Partial<SpawnConfig> = {
    gazeDwellMs: [100, 100],
    gazeChance: 1,
    gazeCooldownMs: 1000,
    gazeCooldownJitter: 0,
    gazeOffset: [10 * DEG, 10 * DEG],
    steadyMaxSpeed: 100,
    warningLeadMs: 1,
    ambushIntervalMs: 1e9, // disable ambush in gaze tests
  };

  beforeEach(() => {
    time = 0;
  });

  it('warns first, then pops a ghost near where the player looked, after the lead', () => {
    const mgr = makeManager({ ...GAZE, warningLeadMs: 500 });
    expect(revealed(step(mgr, FRONT, 60))).toHaveLength(0); // dwell 60 < 100
    const warn = step(mgr, FRONT, 60); // dwell 120 ≥ 100 → warning only
    expect(warnings(warn).some((e) => e.ambush === false)).toBe(true);
    expect(revealed(warn)).toHaveLength(0);

    const ev = revealed(step(mgr, FRONT, 500)); // lead elapsed → pop
    expect(ev).toHaveLength(1);
    expect(ev[0].ambush).toBe(false);
    // Popped within ~the configured offset of the look direction.
    expect(dot(FRONT, ev[0].ghost.position.dir)).toBeGreaterThan(Math.cos(11 * DEG));
  });

  it('a gaze warning that fails its roll produces no ghost (fakeout)', () => {
    const mgr = makeManager({ ...GAZE, gazeChance: 0 });
    step(mgr, FRONT, 60);
    const warn = step(mgr, FRONT, 60); // dwell ≥ 100 → warning
    expect(warnings(warn)).toHaveLength(1);
    for (let i = 0; i < 10; i++) {
      expect(revealed(step(mgr, FRONT, 60))).toHaveLength(0); // never reveals
    }
    expect(mgr.ghosts.length).toBe(0);
  });

  it('does not start a second warning while one is pending', () => {
    const mgr = makeManager({ ...GAZE, warningLeadMs: 1000 });
    step(mgr, FRONT, 60);
    const first = step(mgr, FRONT, 60); // warning #1, pending ~1000ms
    expect(warnings(first)).toHaveLength(1);
    let count = 0;
    for (let i = 0; i < 10; i++) count += warnings(step(mgr, FRONT, 60)).length; // 600ms < lead
    expect(count).toBe(0);
  });

  it('never exceeds maxActive', () => {
    const mgr = makeManager({ ...GAZE, maxActive: 2, gazeCooldownMs: 0 });
    for (let i = 0; i < 40; i++) step(mgr, FRONT, 60); // < min activeWindow, so none expire
    expect(mgr.ghosts.length).toBeLessThanOrEqual(2);
  });

  it('respects the gaze cooldown between pops', () => {
    const mgr = makeManager(GAZE);
    step(mgr, FRONT, 60);
    step(mgr, FRONT, 60); // warning
    step(mgr, FRONT, 60); // resolve → first pop; cooldown 1000ms
    expect(mgr.ghosts.length).toBe(1);
    for (let i = 0; i < 8; i++) step(mgr, FRONT, 60); // ~480ms < cooldown
    expect(mgr.ghosts.length).toBe(1);
  });

  it('warns first, then fires a behind-the-player ambush after the lead time', () => {
    const mgr = makeManager({
      gazeDwellMs: [1e9, 1e9], // disable gaze pops
      ambushIntervalMs: 500,
      ambushJitter: 0,
      ambushChance: 1,
      warningLeadMs: 800,
    });
    step(mgr, FRONT, 100); // schedules ambush at now+500 = 600
    const warn = step(mgr, FRONT, 600); // now 700 ≥ 600 → warning only
    expect(warnings(warn).some((e) => e.ambush === true)).toBe(true);
    expect(revealed(warn)).toHaveLength(0);

    const ev = revealed(step(mgr, FRONT, 800)); // now 1500 ≥ 700+800 → pop behind
    expect(ev.some((e) => e.ambush)).toBe(true);
    expect(dot(FRONT, ev.find((e) => e.ambush)!.ghost.position.dir)).toBeLessThan(0);
  });

  it('an ambush warning that fails its roll produces no ghost (fakeout)', () => {
    const mgr = makeManager({
      gazeDwellMs: [1e9, 1e9],
      ambushIntervalMs: 500,
      ambushJitter: 0,
      ambushChance: 0,
      warningLeadMs: 800,
    });
    step(mgr, FRONT, 100); // schedule ambush at 600
    const warn = step(mgr, FRONT, 600); // 700 ≥ 600 → warning
    expect(warnings(warn).some((e) => e.ambush === true)).toBe(true);
    const ev = revealed(step(mgr, FRONT, 800)); // 1500 ≥ 1500 → resolve, chance 0 → fakeout
    expect(ev).toHaveLength(0);
    expect(mgr.ghosts.length).toBe(0);
    // After a fakeout the ambush timer must re-arm, or ambushes would starve.
    // Fakeout resolved at t=1500 → next ambush scheduled at ~2000 (interval 500).
    const next = warnings(step(mgr, FRONT, 500)); // t=2000
    expect(next.some((e) => e.ambush === true)).toBe(true);
  });

  it('expires an active ghost after its catch window', () => {
    const mgr = makeManager(GAZE);
    step(mgr, FRONT, 60);
    step(mgr, FRONT, 60); // warning
    step(mgr, FRONT, 60); // resolve → pop
    const ghost = mgr.ghosts[0];
    expect(ghost.expiresAt).not.toBeNull();

    const events = step(mgr, FRONT, ghost.expiresAt! - time + 1);
    expect(events.some((e) => e.type === 'expired' && e.ghost.instanceId === ghost.instanceId)).toBe(true);
    expect(mgr.ghosts.find((g) => g.instanceId === ghost.instanceId)).toBeUndefined();
  });

  it('removes a ghost by id and returns null for unknown ids', () => {
    const mgr = makeManager(GAZE);
    step(mgr, FRONT, 60);
    step(mgr, FRONT, 60); // warning
    step(mgr, FRONT, 60); // resolve → pop
    const ghost = mgr.ghosts[0];
    expect(mgr.remove(ghost.instanceId)?.instanceId).toBe(ghost.instanceId);
    expect(mgr.ghosts.find((g) => g.instanceId === ghost.instanceId)).toBeUndefined();
    expect(mgr.remove('nope')).toBeNull();
  });
});
