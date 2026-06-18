import * as THREE from 'three';
import type { ARScene } from '../engine/ARScene';
import { SPHERE_RADIUS } from '../engine/ARScene';
import { GhostSprite } from '../engine/GhostSprite';
import { ScreenEffects } from '../engine/ScreenEffects';
import { getGhostTexture } from '../engine/ghostTexture';
import type { GhostDef } from '../data/catalog.types';
import { RaritySystem } from '../game/RaritySystem';
import { SpawnManager } from '../game/SpawnManager';
import { CatchMechanic } from '../game/CatchMechanic';
import type { CatchCandidate, CatchState } from '../game/CatchMechanic';
import type { Rng } from '../game/rng';
import type { Clock, SpawnEvent } from '../game/types';

export interface HuntControllerDeps {
  scene: ARScene;
  catalog: GhostDef[];
  rng: Rng;
  clock: Clock;
  /** Fired when a ghost is captured. */
  onCaught: (def: GhostDef, ambush: boolean) => void;
  /** Fired when a ghost escapes a failed catch. */
  onFled: (def: GhostDef) => void;
  /** Fired when a dread warning (예고) precedes a spawn. */
  onWarning: () => void;
}

const rootStyle = () => document.documentElement.style;

/**
 * Owns the hunting-phase simulation: spawns + reveals ghosts (확!) and runs the
 * catch loop, bridging pure game logic to sprites, screen effects, and the HUD's
 * reticle (gauge via a CSS variable, targeting via a root class — never per-frame
 * React state).
 */
export class HuntController {
  readonly effects = new ScreenEffects();
  private readonly scene: ARScene;
  private readonly rng: Rng;
  private readonly spawn: SpawnManager;
  private readonly catch = new CatchMechanic();
  private readonly sprites = new Map<string, GhostSprite>();
  private readonly forward = new THREE.Vector3();
  private readonly onCaught: HuntControllerDeps['onCaught'];
  private readonly onFled: HuntControllerDeps['onFled'];
  private readonly onWarning: HuntControllerDeps['onWarning'];

  private running = false;
  private paused = false;
  private holding = false;

  constructor(deps: HuntControllerDeps) {
    this.scene = deps.scene;
    this.rng = deps.rng;
    this.onCaught = deps.onCaught;
    this.onFled = deps.onFled;
    this.onWarning = deps.onWarning;
    const rarity = new RaritySystem(deps.catalog, deps.rng);
    this.spawn = new SpawnManager({
      catalog: deps.catalog,
      rarity,
      rng: deps.rng,
      clock: deps.clock,
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.effects.mount();
  }

  stop(): void {
    this.running = false;
    this.applyReticle({ targetedId: null, gauge: 0, outcome: null });
  }

  setHolding(holding: boolean): void {
    this.holding = holding;
  }

  /** Pause the simulation (e.g. while the result modal is up) without freezing
   *  the render loop, so existing sprite/vanish animations finish. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.holding = false;
      this.catch.reset();
      this.applyReticle({ targetedId: null, gauge: 0, outcome: null });
    }
  }

  tick(dt: number): void {
    if (!this.running) return;
    this.scene.camera.getWorldDirection(this.forward);

    if (!this.paused) {
      const events = this.spawn.update(
        { x: this.forward.x, y: this.forward.y, z: this.forward.z },
        dt,
      );
      for (const event of events) this.handleSpawnEvent(event);
    }

    for (const [id, sprite] of this.sprites) {
      sprite.update(dt);
      if (sprite.isDone) {
        this.scene.ghostLayer.remove(sprite.object);
        sprite.dispose();
        this.sprites.delete(id);
      }
    }

    if (!this.paused) this.updateCatch(dt);
    this.effects.update(dt);
  }

  private updateCatch(dt: number): void {
    const result = this.catch.update({
      cameraForward: this.forward,
      candidates: this.collectCandidates(),
      holding: this.holding,
      dt,
      rng: this.rng,
    });
    this.applyReticle(result);
    if (result.outcome) this.resolveOutcome(result.outcome.type, result.outcome.instanceId);
  }

  private collectCandidates(): CatchCandidate[] {
    const candidates: CatchCandidate[] = [];
    for (const ghost of this.spawn.ghosts) {
      if (ghost.lifecycle !== 'active') continue;
      const def = this.spawn.defOf(ghost);
      if (!def) continue;
      candidates.push({
        instanceId: ghost.instanceId,
        dir: ghost.position.dir,
        catchDifficulty: def.catchDifficulty,
        catchProbability: def.catchProbability,
        skittishness: def.skittishness,
      });
    }
    return candidates;
  }

  private resolveOutcome(type: 'caught' | 'fled', instanceId: string): void {
    const removed = this.spawn.remove(instanceId);
    if (!removed) return;
    const def = this.spawn.defOf(removed);
    this.sprites.get(instanceId)?.vanish();
    if (!def) return;
    if (type === 'caught') {
      this.effects.trigger(0.4, false);
      this.onCaught(def, removed.ambush);
    } else {
      this.effects.trigger(0.3, false);
      this.onFled(def);
    }
  }

  private handleSpawnEvent(event: SpawnEvent): void {
    switch (event.type) {
      case 'spawned': {
        const def = this.spawn.defOf(event.ghost);
        if (!def) return;
        const sprite = new GhostSprite(getGhostTexture(def), def.rarity);
        sprite.setDirection(event.ghost.position.dir, SPHERE_RADIUS);
        this.scene.ghostLayer.add(sprite.object);
        this.sprites.set(event.ghost.instanceId, sprite);
        break;
      }
      case 'revealed': {
        this.sprites.get(event.ghost.instanceId)?.reveal();
        const def = this.spawn.defOf(event.ghost);
        this.effects.trigger(def?.revealIntensity ?? 0.5, event.ambush);
        break;
      }
      case 'expired':
        this.sprites.get(event.ghost.instanceId)?.vanish();
        break;
      case 'removed':
        this.sprites.get(event.instanceId)?.vanish();
        break;
      case 'warning':
        this.effects.warningCue();
        this.onWarning();
        break;
    }
  }

  private applyReticle(result: CatchState): void {
    rootStyle().setProperty('--catch-gauge', result.gauge.toFixed(3));
    document.documentElement.classList.toggle('is-targeting', result.targetedId !== null);
  }
}
