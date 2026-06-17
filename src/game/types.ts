/** Plain 3D vector. The game layer stays free of Three.js so it unit-tests on
 *  Windows without a browser; the engine converts these to THREE.Vector3. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Monotonic clock in milliseconds (performance.now in the app; fake in tests). */
export type Clock = () => number;

export type GhostLifecycle = 'hidden' | 'active' | 'fleeing' | 'caught' | 'expired';

/** A ghost's placement on the surrounding sphere. */
export interface SpawnPosition {
  /** Heading around the vertical axis, radians. */
  azimuth: number;
  /** Angle above/below the horizon, radians. */
  elevation: number;
  /** Precomputed unit direction from the player toward the ghost. */
  dir: Vec3;
}

/** A live ghost in the world (distinct from its catalog definition). */
export interface GhostInstance {
  instanceId: string;
  defId: string;
  position: SpawnPosition;
  lifecycle: GhostLifecycle;
  /** Whether this ghost was revealed by an ambush (vs. the player looking at it). */
  ambush: boolean;
  spawnedAt: number;
  /** When the "확!" reveal happened (null while hidden). */
  revealedAt: number | null;
  /** When the active catch window ends (null while hidden). */
  expiresAt: number | null;
}

export type SpawnEvent =
  | { type: 'spawned'; ghost: GhostInstance }
  | { type: 'revealed'; ghost: GhostInstance; ambush: boolean }
  | { type: 'expired'; ghost: GhostInstance }
  | { type: 'removed'; instanceId: string }
  /** A dread warning precedes an ambush; the ghost pops after ambushWarningMs. */
  | { type: 'warning'; ambush: boolean };
