import * as THREE from 'three';
import { OrientationController } from './OrientationController';

/** Per-frame callback: dt is seconds since the previous frame. */
export type FrameHandler = (dt: number) => void;

const MAX_PIXEL_RATIO = 2;
/** Radius of the sphere ghosts/markers sit on, in world units. */
export const SPHERE_RADIUS = 8;

/**
 * Three.js scene rendered as a transparent overlay above the camera <video>.
 * Owns the render loop and drives the camera from device orientation.
 */
export class ARScene {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly orientation = new OrientationController();
  /** Container for ghost sprites (populated from M2 onward). */
  readonly ghostLayer = new THREE.Group();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly targetQuat = new THREE.Quaternion();
  private frameHandler: FrameHandler | null = null;
  private rafId = 0;
  private running = false;
  private quatInitialized = false;
  private lastTime = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ar-canvas';

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    this.camera.position.set(0, 0, 0);

    this.scene.add(this.ghostLayer);
    this.resize();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.canvas);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
  }

  onFrame(handler: FrameHandler): void {
    this.frameHandler = handler;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.orientation.start();
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.orientation.stop();
  }

  private readonly loop = (time: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = time;

    if (this.orientation.hasData) {
      this.orientation.getQuaternion(this.targetQuat);
      if (this.quatInitialized) {
        // Frame-rate independent smoothing to suppress sensor jitter.
        const factor = 1 - Math.pow(0.0001, dt);
        this.camera.quaternion.slerp(this.targetQuat, factor);
      } else {
        this.camera.quaternion.copy(this.targetQuat);
        this.quatInitialized = true;
      }
    }

    this.frameHandler?.(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
