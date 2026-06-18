import { ARScene } from '../engine/ARScene';
import { CameraFeed, CameraError } from '../engine/CameraFeed';
import { requestOrientationPermission } from '../engine/OrientationController';
import { CatalogService } from '../services/CatalogService';
import { CollectionService } from '../services/CollectionService';
import { SettingsService } from '../services/SettingsService';
import { SaveStore } from '../services/persistence/SaveStore';
import { SAVE_VERSION } from '../services/persistence/schema';
import { Economy } from '../game/Economy';
import { i18n } from '../i18n/i18n';
import type { GhostDef } from '../data/catalog.types';
import { HuntController } from './HuntController';
import { GameStore } from './GameStore';

const ORIENTATION_POLL_MS = 250;

/** Dread message keys shown just before a spawn (weighted toward the title). */
const WARNING_KEYS = ['warning.1', 'warning.1', 'warning.2', 'warning.3', 'warning.4'] as const;

/**
 * Top-level orchestrator. Owns the engine pieces and the observable store, and
 * coordinates the permission → hunting startup. Lives outside React so it is
 * unaffected by StrictMode double-mounting.
 */
export class GameApp {
  readonly store = new GameStore();
  private readonly camera = new CameraFeed();
  private readonly scene = new ARScene();
  private readonly catalog = new CatalogService();
  private readonly economy = new Economy();
  private readonly collection = new CollectionService();
  private readonly saveStore = new SaveStore();
  readonly settings = new SettingsService();
  private hunt: HuntController | null = null;
  private mounted = false;
  private sessionStarted = false;
  private orientationTimer: number | null = null;
  private toastTimer: number | null = null;
  private warningTimer: number | null = null;

  /** Catalog ghost definitions (for the 도감). */
  get catalogGhosts(): GhostDef[] {
    return this.catalog.all;
  }

  constructor() {
    // Apply saved locale + theme before first paint, and keep audio in sync.
    this.settings.apply();
    this.settings.subscribe(() => {
      this.hunt?.effects.setMuted(!this.settings.getSnapshot().audio);
    });
  }

  /** Attach the camera feed and WebGL canvas to the DOM (behind the HUD). */
  mount(root: HTMLElement): void {
    if (this.mounted) return;
    this.mounted = true;
    this.camera.mount(root);
    this.scene.mount(root);
    document.addEventListener('visibilitychange', this.handleVisibility);
    void this.loadSave();
  }

  private async loadSave(): Promise<void> {
    const save = await this.saveStore.load();
    this.collection.load(save.collection);
    this.store.setState({ credits: save.credits, collection: this.collection.snapshot() });
  }

  private persist(): void {
    void this.saveStore.save({
      version: SAVE_VERSION,
      credits: this.store.value.credits,
      collection: this.collection.snapshot(),
    });
  }

  /**
   * Runs from the onboarding tap. Requests both permissions within the gesture,
   * then starts the AR session. On failure, records a PermissionIssue and stays
   * on the permission screen.
   */
  async beginSession(): Promise<void> {
    const orientationOk = await requestOrientationPermission();

    let cameraOk = true;
    let cameraMessage = '';
    try {
      await this.camera.start();
    } catch (err) {
      cameraOk = false;
      cameraMessage = describeCameraError(err);
    }

    if (!cameraOk || !orientationOk) {
      this.store.setState({
        phase: 'permission',
        permissionIssue: {
          orientation: orientationOk,
          camera: cameraOk,
          message: buildPermissionMessage(orientationOk, cameraOk, cameraMessage),
        },
      });
      // Camera is mandatory; motion-only failure still lets us show the feed.
      if (!cameraOk) return;
    }

    if (!this.sessionStarted) {
      this.hunt = new HuntController({
        scene: this.scene,
        catalog: this.catalog.all,
        rng: Math.random,
        clock: () => performance.now(),
        onCaught: (def, ambush) => this.handleCaught(def, ambush),
        onFled: (def) => this.handleFled(def),
        onWarning: () => this.showWarning(),
      });
      this.hunt.effects.setMuted(!this.settings.getSnapshot().audio);
      this.hunt.effects.unlockAudio(); // still inside the start gesture
      this.scene.onFrame((dt) => this.hunt?.tick(dt));
      this.hunt.start();
      this.scene.start();
      this.sessionStarted = true;
      this.startOrientationWatch();
    }

    this.store.setState({ phase: 'hunting', permissionIssue: null });
  }

  /** Player is holding to catch (pointer down/up on the hunt surface). */
  setHolding(holding: boolean): void {
    this.hunt?.setHolding(holding);
  }

  /** Dismiss the result modal and resume hunting. */
  dismissResult(): void {
    this.store.setState({ phase: 'hunting', result: null });
    this.hunt?.setPaused(false);
  }

  /** Open the 도감 (collection) overlay; pauses hunting. */
  openDogam(): void {
    this.store.setState({ phase: 'dogam' });
    this.hunt?.setPaused(true);
  }

  /** Close the 도감 and resume hunting. */
  closeDogam(): void {
    this.store.setState({ phase: 'hunting' });
    this.hunt?.setPaused(false);
  }

  /** Open the settings overlay; pauses hunting. */
  openSettings(): void {
    this.store.setState({ phase: 'settings' });
    this.hunt?.setPaused(true);
  }

  /** Close settings and resume hunting. */
  closeSettings(): void {
    this.store.setState({ phase: 'hunting' });
    this.hunt?.setPaused(false);
  }

  /** Wipe credits + 도감 (from the settings screen). */
  resetProgress(): void {
    this.collection.load({});
    this.store.setState({ credits: 0, collection: {} });
    void this.saveStore.clear();
  }

  dispose(): void {
    this.stopOrientationWatch();
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    if (this.warningTimer !== null) window.clearTimeout(this.warningTimer);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.hunt?.stop();
    this.hunt?.effects.unmount();
    this.scene.stop();
    this.camera.dispose();
  }

  private handleCaught(def: GhostDef, ambush: boolean): void {
    const { firstCatch } = this.collection.record(def.id, Date.now());
    const reward = this.economy.rewardFor(def, { ambush, firstCatch });
    this.store.setState({
      credits: this.store.value.credits + reward,
      collection: this.collection.snapshot(),
      result: { def, reward, ambush, firstCatch },
      phase: 'result',
    });
    this.hunt?.setPaused(true);
    this.persist();
  }

  private handleFled(def: GhostDef): void {
    this.showToast(i18n.t('toast.fled', { name: def.name[i18n.getLocale()] }));
  }

  private showWarning(): void {
    const msg = i18n.t(WARNING_KEYS[Math.floor(Math.random() * WARNING_KEYS.length)]);
    this.store.setState({ warning: msg });
    if (this.warningTimer !== null) window.clearTimeout(this.warningTimer);
    this.warningTimer = window.setTimeout(() => {
      this.store.setState({ warning: null });
      this.warningTimer = null;
    }, 1300);
  }

  private showToast(text: string): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.store.setState({ toast: text });
    this.toastTimer = window.setTimeout(() => {
      this.store.setState({ toast: null });
      this.toastTimer = null;
    }, 1500);
  }

  private startOrientationWatch(): void {
    this.orientationTimer = window.setInterval(() => {
      if (this.scene.orientation.hasData) {
        this.store.setState({ hasOrientationData: true });
        this.stopOrientationWatch();
      }
    }, ORIENTATION_POLL_MS);
  }

  private stopOrientationWatch(): void {
    if (this.orientationTimer !== null) {
      window.clearInterval(this.orientationTimer);
      this.orientationTimer = null;
    }
  }

  /** Pause the loop + video when backgrounded; never tear down the stream. */
  private readonly handleVisibility = (): void => {
    if (!this.sessionStarted) return;
    if (document.hidden) {
      this.scene.stop();
      this.camera.pause();
    } else {
      this.scene.start();
      void this.camera.resume();
    }
  };
}

function describeCameraError(err: unknown): string {
  const kind = err instanceof CameraError ? err.kind : 'unknown';
  return i18n.t(`permission.camera.${kind}`);
}

function buildPermissionMessage(
  orientationOk: boolean,
  cameraOk: boolean,
  cameraMessage: string,
): string {
  if (!cameraOk) return cameraMessage;
  if (!orientationOk) return i18n.t('permission.orientation.denied');
  return '';
}
