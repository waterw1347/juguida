import * as THREE from 'three';
import type { Rarity } from '../data/catalog.types';
import type { Vec3 } from '../game/types';

type SpriteState = 'hidden' | 'revealing' | 'active' | 'vanishing' | 'done';

const REVEAL_DURATION = 0.16;
const VANISH_DURATION = 0.3;

const RARITY_SCALE: Record<Rarity, number> = {
  common: 1.7,
  uncommon: 1.9,
  rare: 2.1,
  epic: 2.35,
  legendary: 2.7,
};

/**
 * A billboarded ghost. THREE.Sprite always faces the camera, so panning keeps
 * the ghost readable. Holds the "확!" reveal (scale-pop with overshoot), a subtle
 * non-floaty active pulse, and a vanish used for both flee and capture.
 */
export class GhostSprite {
  readonly object: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly base: number;
  private readonly dir = new THREE.Vector3();
  private state: SpriteState = 'hidden';
  private animT = 0;
  private idleT = 0;

  constructor(texture: THREE.Texture, rarity: Rarity) {
    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.object = new THREE.Sprite(this.material);
    this.object.renderOrder = 10;
    this.object.scale.setScalar(0.0001);
    this.material.opacity = 0;
    this.base = RARITY_SCALE[rarity];
  }

  /** Place on the sphere along a unit direction. Position is fixed (not floaty). */
  setDirection(dir: Vec3, radius: number): void {
    this.dir.set(dir.x, dir.y, dir.z);
    this.object.position.copy(this.dir).multiplyScalar(radius);
  }

  reveal(): void {
    if (this.state === 'hidden') {
      this.state = 'revealing';
      this.animT = 0;
    }
  }

  vanish(): void {
    if (this.state !== 'vanishing' && this.state !== 'done') {
      this.state = 'vanishing';
      this.animT = 0;
    }
  }

  get isDone(): boolean {
    return this.state === 'done';
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  update(dt: number): void {
    switch (this.state) {
      case 'revealing': {
        this.animT += dt;
        const p = Math.min(this.animT / REVEAL_DURATION, 1);
        // Hard pop: full opacity instantly, oversized → recoil to base. No grow-in.
        const s = this.base * (1.4 - 0.4 * easeOutCubic(p));
        this.object.scale.set(s, s, 1);
        this.material.opacity = 1;
        if (p >= 1) {
          this.state = 'active';
          this.idleT = 0;
        }
        break;
      }
      case 'active': {
        this.idleT += dt;
        // Slow ominous breathing + faint unsettling sway — not floaty/cute.
        const breathe = 1 + Math.sin(this.idleT * 1.6) * 0.02;
        this.object.scale.set(this.base * breathe, this.base * breathe, 1);
        this.material.rotation = Math.sin(this.idleT * 0.9) * 0.04;
        break;
      }
      case 'vanishing': {
        this.animT += dt;
        const p = Math.min(this.animT / VANISH_DURATION, 1);
        const s = Math.max(0.0001, this.base * (1 - p));
        this.object.scale.set(s, s, 1);
        this.material.opacity = Math.max(0, 1 - p);
        if (p >= 1) this.state = 'done';
        break;
      }
      default:
        break;
    }
  }

  /** Disposes the material only; the texture is shared/cached, so leave it. */
  dispose(): void {
    this.material.dispose();
  }
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
