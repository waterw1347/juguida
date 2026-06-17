import { describe, it, expect } from 'vitest';
import { CatchMechanic } from '../src/game/CatchMechanic';
import type { CatchCandidate } from '../src/game/CatchMechanic';
import type { Rng, Vec3 } from '../src/game/types';

const FRONT: Vec3 = { x: 0, y: 0, z: -1 };
const OFF_AXIS: Vec3 = { x: 0.5, y: 0, z: -Math.sqrt(1 - 0.25) }; // ~30° off front

function cand(id: string, dir: Vec3, over: Partial<CatchCandidate> = {}): CatchCandidate {
  return {
    instanceId: id,
    dir,
    catchDifficulty: 1,
    catchProbability: 1,
    skittishness: 0,
    ...over,
  };
}

const always = (v: number): Rng => () => v;

describe('CatchMechanic', () => {
  it('targets the ghost nearest the reticle center and ignores off-axis ones', () => {
    const m = new CatchMechanic();
    const r = m.update({
      cameraForward: FRONT,
      candidates: [cand('a', FRONT), cand('b', OFF_AXIS)],
      holding: false,
      dt: 0.016,
      rng: always(0),
    });
    expect(r.targetedId).toBe('a');

    const none = m.update({
      cameraForward: FRONT,
      candidates: [cand('b', OFF_AXIS)],
      holding: false,
      dt: 0.016,
      rng: always(0),
    });
    expect(none.targetedId).toBeNull();
  });

  it('fills the gauge while held and captures on a successful roll', () => {
    const m = new CatchMechanic();
    const r = m.update({
      cameraForward: FRONT,
      candidates: [cand('a', FRONT, { catchDifficulty: 1, catchProbability: 1 })],
      holding: true,
      dt: 0.4, // > fillTime (0.32) so the gauge tops out this tick
      rng: always(0),
    });
    expect(r.outcome).toEqual({ type: 'caught', instanceId: 'a' });
  });

  it('flees on a failed roll', () => {
    const m = new CatchMechanic();
    const r = m.update({
      cameraForward: FRONT,
      candidates: [cand('a', FRONT, { catchProbability: 0.3 })],
      holding: true,
      dt: 0.4,
      rng: always(0.9), // 0.9 < 0.3 is false → flee
    });
    expect(r.outcome).toEqual({ type: 'fled', instanceId: 'a' });
  });

  it('decays the gauge when not holding', () => {
    const m = new CatchMechanic();
    m.update({ cameraForward: FRONT, candidates: [cand('a', FRONT, { catchDifficulty: 5 })], holding: true, dt: 0.3, rng: always(0) });
    const before = m.state.gauge;
    expect(before).toBeGreaterThan(0);
    const r = m.update({ cameraForward: FRONT, candidates: [cand('a', FRONT, { catchDifficulty: 5 })], holding: false, dt: 0.1, rng: always(0) });
    expect(r.gauge).toBeLessThan(before);
  });

  it('resets progress when the target changes', () => {
    const m = new CatchMechanic();
    m.update({ cameraForward: FRONT, candidates: [cand('a', FRONT, { catchDifficulty: 5 })], holding: true, dt: 0.3, rng: always(0) });
    expect(m.state.gauge).toBeGreaterThan(0);
    // 'a' leaves, 'b' is now centered → gauge resets.
    const r = m.update({ cameraForward: FRONT, candidates: [cand('b', FRONT, { catchDifficulty: 5 })], holding: true, dt: 0.016, rng: always(0) });
    expect(r.targetedId).toBe('b');
    expect(r.gauge).toBeLessThan(0.1);
  });

  it('takes longer to fill for higher difficulty / skittishness', () => {
    const easy = new CatchMechanic();
    const hard = new CatchMechanic();
    const input = { cameraForward: FRONT, holding: true, dt: 0.3, rng: always(0) };
    const e = easy.update({ ...input, candidates: [cand('a', FRONT, { catchDifficulty: 1, skittishness: 0 })] });
    const h = hard.update({ ...input, candidates: [cand('a', FRONT, { catchDifficulty: 8, skittishness: 0.8 })] });
    expect(h.gauge).toBeLessThan(e.gauge);
  });
});
