/**
 * Owns the single, long-lived camera stream rendered as the AR background.
 *
 * iOS rules baked in here:
 *  - Acquire the stream ONCE and never re-acquire on navigation. Re-acquiring or
 *    swapping the <video> element in standalone PWAs has historically dropped the
 *    feed (WebKit bugs). pause()/resume() instead of stop()/start().
 *  - The <video> must be muted + playsinline + autoplay, and play() must be
 *    called from the same user gesture that requested permissions.
 */

export type CameraErrorKind = 'denied' | 'notfound' | 'inuse' | 'unknown';

export class CameraError extends Error {
  readonly kind: CameraErrorKind;
  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
    this.kind = kind;
  }
}

export class CameraFeed {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private started = false;

  constructor() {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.className = 'ar-camera-feed';
    this.video = video;
  }

  get isStarted(): boolean {
    return this.started;
  }

  /** Attaches the video element to the DOM (behind the WebGL canvas). */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.video);
  }

  /** Acquire the rear camera and begin playback. Call from a user gesture. */
  async start(): Promise<void> {
    if (this.started) {
      await this.safePlay();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('unknown', 'getUserMedia is unavailable (needs HTTPS / a secure context).');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      throw toCameraError(err);
    }
    this.video.srcObject = this.stream;
    await this.safePlay();
    this.started = true;
  }

  pause(): void {
    if (this.started) this.video.pause();
  }

  async resume(): Promise<void> {
    if (this.started) await this.safePlay();
  }

  /** Full teardown — only on app exit, never during normal navigation. */
  dispose(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.started = false;
    this.video.srcObject = null;
  }

  private async safePlay(): Promise<void> {
    try {
      await this.video.play();
    } catch {
      // Autoplay can reject if called outside a gesture; the gesture-driven
      // start() path is the authoritative one, so a stray rejection is benign.
    }
  }
}

function toCameraError(err: unknown): CameraError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return new CameraError('denied', 'Camera permission was denied.');
      case 'NotFoundError':
      case 'OverconstrainedError':
        return new CameraError('notfound', 'No usable camera was found.');
      case 'NotReadableError':
        return new CameraError('inuse', 'The camera is in use by another app.');
      default:
        return new CameraError('unknown', `Camera error: ${err.name}`);
    }
  }
  return new CameraError('unknown', 'The camera could not be started.');
}
