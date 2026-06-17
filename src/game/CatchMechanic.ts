import type { Rng } from './rng';
import type { Vec3 } from './types';

export interface CatchCandidate {
  instanceId: string;
  /** Unit direction from the player toward the ghost. */
  dir: Vec3;
  catchDifficulty: number;
  catchProbability: number;
  skittishness: number;
}

export interface CatchInput {
  /** Unit vector of where the camera is looking. */
  cameraForward: Vec3;
  /** Currently active (catchable) ghosts. */
  candidates: readonly CatchCandidate[];
  /** Whether the player is holding to catch. */
  holding: boolean;
  dt: number;
  rng: Rng;
}

export type CatchOutcome = { type: 'caught' | 'fled'; instanceId: string };

export interface CatchState {
  targetedId: string | null;
  gauge: number;
  outcome: CatchOutcome | null;
}

export interface CatchConfig {
  /** Half-angle of the reticle for target acquisition, radians. */
  reticleAngle: number;
  /** Seconds to fill the gauge per point of catchDifficulty (before skittishness). */
  fillPerDifficulty: number;
  /** Seconds for a full gauge to decay to empty when not held / off-target. */
  decayTime: number;
}

export const DEFAULT_CATCH_CONFIG: CatchConfig = {
  reticleAngle: (9 * Math.PI) / 180,
  fillPerDifficulty: 0.32,
  decayTime: 0.5,
};

/**
 * The core catch loop. Acquires the active ghost nearest the reticle center,
 * fills a gauge while the player holds on it (slower for high difficulty /
 * skittishness), and rolls capture vs. flee when the gauge tops out.
 *
 * Pure logic: hit-test is a dot-product against provided ghost directions (no
 * raycasting needed — the camera sits at the sphere center). Deterministic given
 * a seeded RNG.
 */
export class CatchMechanic {
  private targetedId: string | null = null;
  private gauge = 0;
  private readonly cosReticle: number;

  constructor(private readonly config: CatchConfig = DEFAULT_CATCH_CONFIG) {
    this.cosReticle = Math.cos(config.reticleAngle);
  }

  get state(): { targetedId: string | null; gauge: number } {
    return { targetedId: this.targetedId, gauge: this.gauge };
  }

  reset(): void {
    this.targetedId = null;
    this.gauge = 0;
  }

  update(input: CatchInput): CatchState {
    const target = this.pickTarget(input.cameraForward, input.candidates);

    // Switching targets (or losing one) resets progress — you must hold on one.
    if (target?.instanceId !== this.targetedId) {
      this.gauge = 0;
      this.targetedId = target?.instanceId ?? null;
    }

    let outcome: CatchOutcome | null = null;

    if (input.holding && target) {
      const fillTime = Math.max(
        0.2,
        this.config.fillPerDifficulty * target.catchDifficulty * (1 + target.skittishness * 0.5),
      );
      this.gauge += input.dt / fillTime;
      if (this.gauge >= 1) {
        const success = input.rng() < target.catchProbability;
        outcome = { type: success ? 'caught' : 'fled', instanceId: target.instanceId };
        this.gauge = 0;
        this.targetedId = null;
      }
    } else {
      this.gauge = Math.max(0, this.gauge - input.dt / this.config.decayTime);
    }

    return { targetedId: this.targetedId, gauge: this.gauge, outcome };
  }

  private pickTarget(
    forward: Vec3,
    candidates: readonly CatchCandidate[],
  ): CatchCandidate | null {
    let best: CatchCandidate | null = null;
    let bestDot = this.cosReticle;
    for (const c of candidates) {
      const d = dot(forward, c.dir);
      if (d >= bestDot) {
        bestDot = d;
        best = c;
      }
    }
    return best;
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
