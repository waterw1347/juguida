import type { GhostDef } from '../data/catalog.types';
import type { RaritySystem } from './RaritySystem';
import type { Rng } from './rng';
import { randRange } from './rng';
import type { Clock, GhostInstance, SpawnEvent, SpawnPosition, Vec3 } from './types';

const DEG2RAD = Math.PI / 180;
const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };

export interface SpawnConfig {
  /** Max concurrent ghosts on screen. Kept low so each "확!" lands. */
  maxActive: number;
  /** Randomized dwell [min, max] (ms) the player must look steadily before a gaze pop. */
  gazeDwellMs: [number, number];
  /** Minimum gap between gaze pops, milliseconds. */
  gazeCooldownMs: number;
  /** Fractional jitter (0..1) on the gaze cooldown. */
  gazeCooldownJitter: number;
  /** Probability a due gaze pop actually fires (keeps it unpredictable). */
  gazeChance: number;
  /** Angular offset [min, max] from screen center where a gaze ghost pops. Radians. */
  gazeOffset: [number, number];
  /** Above this view rotation speed (rad/s) the player is "searching" — dwell resets. */
  steadyMaxSpeed: number;
  /** Average gap between behind-you ambushes, milliseconds. */
  ambushIntervalMs: number;
  /** Fractional jitter (0..1) on the ambush interval. */
  ambushJitter: number;
  /** Dread-message lead time before an ambush ghost pops. 0 disables the warning. */
  ambushWarningMs: number;
  /** Azimuth spread of behind-the-player ambushes, radians. */
  ambushSpread: number;
  /** Elevation band [min, max] for ambush spawns, radians. */
  ambushElevation: [number, number];
}

export const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  // Rare + anticipated = scary. Few on screen, each one an event.
  maxActive: 2,
  // You must stare into a spot for 1.2–2.8s before something appears there.
  gazeDwellMs: [1200, 2800],
  // Long, jittered gap after a pop so it never feels metronomic.
  gazeCooldownMs: 5000,
  gazeCooldownJitter: 0.5,
  // Sometimes the dwell completes and nothing happens — keeps you uneasy.
  gazeChance: 0.7,
  gazeOffset: [6 * DEG2RAD, 22 * DEG2RAD],
  steadyMaxSpeed: 1.4,
  // Behind-you ambush every ~8–24s.
  ambushIntervalMs: 16000,
  ambushJitter: 0.5,
  ambushWarningMs: 950,
  ambushSpread: 50 * DEG2RAD,
  ambushElevation: [-12 * DEG2RAD, 16 * DEG2RAD],
};

export interface SpawnManagerDeps {
  catalog: readonly GhostDef[];
  rarity: RaritySystem;
  rng: Rng;
  clock: Clock;
  config?: Partial<SpawnConfig>;
}

/**
 * Decides WHEN and WHERE a ghost bursts into view ("확!"). Ghosts are created
 * already active — no pre-placed pool that predictably fades in. Two triggers:
 *   - gaze pop: the player's view settles → a ghost snaps into being right where
 *     they're looking (slightly off-center). This is the "비추면 거기서 팍" feel.
 *   - ambush: a timer fires → a ghost pops behind/beside the player.
 *
 * Pure logic: no Three.js, no DOM. `update()` returns the events that occurred,
 * which the engine turns into a hard sprite pop + screen effects.
 */
export class SpawnManager {
  private readonly defs: Map<string, GhostDef>;
  private readonly rarity: RaritySystem;
  private readonly rng: Rng;
  private readonly clock: Clock;
  private readonly config: SpawnConfig;

  private instances: GhostInstance[] = [];
  private instanceCounter = 0;
  private lastForward: Vec3 | null = null;
  private dwellMs = 0;
  private dwellTarget: number;
  private gazeCooldownUntil = 0;
  private nextAmbushAt: number | null = null;
  private pendingAmbushAt: number | null = null;

  constructor(deps: SpawnManagerDeps) {
    this.defs = new Map(deps.catalog.map((d) => [d.id, d]));
    this.rarity = deps.rarity;
    this.rng = deps.rng;
    this.clock = deps.clock;
    this.config = { ...DEFAULT_SPAWN_CONFIG, ...deps.config };
    this.dwellTarget = this.rollDwellTarget();
  }

  /** All active ghosts. */
  get ghosts(): readonly GhostInstance[] {
    return this.instances;
  }

  defOf(instance: GhostInstance): GhostDef | undefined {
    return this.defs.get(instance.defId);
  }

  /**
   * Advance the simulation. `cameraForward` is a unit vector of where the player
   * looks; `dtSeconds` is the frame delta. Returns events emitted this tick.
   */
  update(cameraForward: Vec3, dtSeconds: number): SpawnEvent[] {
    const now = this.clock();
    if (this.nextAmbushAt === null) this.scheduleNextAmbush(now);

    const events: SpawnEvent[] = [];
    this.expireStale(now, events);
    this.trackDwell(cameraForward, dtSeconds);
    this.maybeGazePop(cameraForward, now, events);
    this.maybeAmbush(cameraForward, now, events);
    return events;
  }

  /** Remove a ghost (e.g. captured). Returns it, or null if not tracked. */
  remove(instanceId: string): GhostInstance | null {
    const idx = this.instances.findIndex((g) => g.instanceId === instanceId);
    if (idx === -1) return null;
    const [removed] = this.instances.splice(idx, 1);
    return removed;
  }

  private trackDwell(forward: Vec3, dt: number): void {
    let steady = true;
    if (this.lastForward && dt > 0) {
      const angle = Math.acos(clamp(dot(forward, this.lastForward), -1, 1));
      steady = angle / dt <= this.config.steadyMaxSpeed;
    }
    this.lastForward = { ...forward };
    this.dwellMs = steady ? this.dwellMs + dt * 1000 : 0;
  }

  private maybeGazePop(forward: Vec3, now: number, events: SpawnEvent[]): void {
    if (now < this.gazeCooldownUntil) return;
    if (this.dwellMs < this.dwellTarget) return;
    if (this.instances.length >= this.config.maxActive) return;

    // Reset dwell either way so a failed roll doesn't retry every frame.
    this.dwellMs = 0;
    this.dwellTarget = this.rollDwellTarget();
    if (this.rng() > this.config.gazeChance) return;

    const [minOff, maxOff] = this.config.gazeOffset;
    const dir = offsetDirection(forward, randRange(this.rng, minOff, maxOff), this.rng() * Math.PI * 2);
    this.spawnActive(positionFromDir(dir), now, false, events);

    const { gazeCooldownMs, gazeCooldownJitter } = this.config;
    this.gazeCooldownUntil = now + gazeCooldownMs * (1 + randRange(this.rng, -gazeCooldownJitter, gazeCooldownJitter));
  }

  private maybeAmbush(forward: Vec3, now: number, events: SpawnEvent[]): void {
    // Phase 2: a warned ambush comes due → pop behind wherever the player now looks.
    if (this.pendingAmbushAt !== null) {
      if (now >= this.pendingAmbushAt) {
        this.pendingAmbushAt = null;
        if (this.instances.length < this.config.maxActive) {
          this.spawnActive(this.behindPosition(forward), now, true, events);
        }
      }
      return; // hold off scheduling another ambush while one is pending
    }

    if (this.nextAmbushAt === null || now < this.nextAmbushAt) return;
    this.scheduleNextAmbush(now);
    if (this.instances.length >= this.config.maxActive) return;

    if (this.config.ambushWarningMs > 0) {
      // Phase 1: dread message now; the ghost pops after the lead time.
      this.pendingAmbushAt = now + this.config.ambushWarningMs;
      events.push({ type: 'warning', ambush: true });
    } else {
      this.spawnActive(this.behindPosition(forward), now, true, events);
    }
  }

  private behindPosition(forward: Vec3): SpawnPosition {
    const camAz = Math.atan2(forward.x, -forward.z);
    const spread = this.config.ambushSpread;
    const azimuth = camAz + Math.PI + randRange(this.rng, -spread / 2, spread / 2);
    const [minEl, maxEl] = this.config.ambushElevation;
    return makePosition(azimuth, randRange(this.rng, minEl, maxEl));
  }

  private expireStale(now: number, events: SpawnEvent[]): void {
    const survivors: GhostInstance[] = [];
    for (const ghost of this.instances) {
      if (ghost.expiresAt !== null && now >= ghost.expiresAt) {
        ghost.lifecycle = 'expired';
        events.push({ type: 'expired', ghost });
      } else {
        survivors.push(ghost);
      }
    }
    this.instances = survivors;
  }

  private spawnActive(
    position: SpawnPosition,
    now: number,
    ambush: boolean,
    events: SpawnEvent[],
  ): void {
    const def = this.rarity.pick();
    if (!def) return;
    const ghost: GhostInstance = {
      instanceId: `g${this.instanceCounter++}`,
      defId: def.id,
      position,
      lifecycle: 'active',
      ambush,
      spawnedAt: now,
      revealedAt: now,
      expiresAt: now + def.activeWindowMs,
    };
    this.instances.push(ghost);
    // spawned → engine creates the (invisible) sprite; revealed → it pops the same tick.
    events.push({ type: 'spawned', ghost });
    events.push({ type: 'revealed', ghost, ambush });
  }

  private scheduleNextAmbush(now: number): void {
    const { ambushIntervalMs, ambushJitter } = this.config;
    this.nextAmbushAt = now + ambushIntervalMs * (1 + randRange(this.rng, -ambushJitter, ambushJitter));
  }

  private rollDwellTarget(): number {
    const [min, max] = this.config.gazeDwellMs;
    return randRange(this.rng, min, max);
  }
}

function positionFromDir(dir: Vec3): SpawnPosition {
  return {
    azimuth: Math.atan2(dir.x, -dir.z),
    elevation: Math.asin(clamp(dir.y, -1, 1)),
    dir,
  };
}

function makePosition(azimuth: number, elevation: number): SpawnPosition {
  const cosEl = Math.cos(elevation);
  return {
    azimuth,
    elevation,
    dir: { x: cosEl * Math.sin(azimuth), y: Math.sin(elevation), z: -cosEl * Math.cos(azimuth) },
  };
}

/** Unit direction `angle` radians off `forward`, rotated `roll` around the view axis. */
function offsetDirection(forward: Vec3, angle: number, roll: number): Vec3 {
  const f = normalize(forward);
  const upRef = Math.abs(dot(f, WORLD_UP)) > 0.97 ? { x: 0, y: 0, z: 1 } : WORLD_UP;
  const right = normalize(cross(upRef, f));
  const up = cross(f, right);
  const sa = Math.sin(angle);
  const ca = Math.cos(angle);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  return normalize({
    x: ca * f.x + sa * (cr * right.x + sr * up.x),
    y: ca * f.y + sa * (cr * right.y + sr * up.y),
    z: ca * f.z + sa * (cr * right.z + sr * up.z),
  });
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
