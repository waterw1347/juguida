/**
 * The "확!" punch: screen shake, a color flash, a synthesized scare stinger, and
 * haptics. Shake is applied via CSS variables on the AR layers (see hud.css);
 * flash is a dedicated overlay element. Audio is synthesized (no asset needed)
 * and must be unlocked from a user gesture (see unlockAudio).
 */

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

const root = () => document.documentElement.style;

export class ScreenEffects {
  private flashEl: HTMLDivElement | null = null;
  private audio: AudioContext | null = null;
  private shake = 0;
  private flash = 0;
  private mounted = false;
  private muted = false;

  /** Mute/unmute synthesized sounds (visual shake/flash + haptics still play). */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  mount(): void {
    if (this.mounted) return;
    const el = document.createElement('div');
    el.className = 'fx-flash';
    document.body.appendChild(el);
    this.flashEl = el;
    this.mounted = true;
  }

  unmount(): void {
    this.flashEl?.remove();
    this.flashEl = null;
    root().setProperty('--ar-shake-x', '0px');
    root().setProperty('--ar-shake-y', '0px');
    this.shake = 0;
    this.flash = 0;
    this.mounted = false;
  }

  /** Call from a user gesture so the synthesized stinger can play on iOS. */
  unlockAudio(): void {
    const ctx = this.ensureAudio();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }

  /** Low dread swell that precedes an ambush (under the warning message). */
  warningCue(): void {
    if (this.muted) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(46, now);
    sub.frequency.linearRampToValueAtTime(72, now + 0.85);
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(50, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    sub.connect(gain);
    rumble.connect(gain);
    gain.connect(ctx.destination);
    sub.start(now);
    rumble.start(now);
    sub.stop(now + 1);
    rumble.stop(now + 1);
  }

  /** Fire the effect. `intensity` 0..1; ambush adds extra punch. */
  trigger(intensity: number, ambush: boolean): void {
    const i = clamp01(intensity) * (ambush ? 1.25 : 1);
    this.shake = Math.max(this.shake, 6 + i * 16);
    this.flash = Math.max(this.flash, 0.25 + i * 0.45);
    this.playStinger(i, ambush);
    this.vibrate(i, ambush);
  }

  /** Advance decay; call once per frame. */
  update(dt: number): void {
    if (this.shake > 0.05) {
      this.shake *= Math.pow(0.0015, dt);
      const x = (Math.random() * 2 - 1) * this.shake;
      const y = (Math.random() * 2 - 1) * this.shake;
      root().setProperty('--ar-shake-x', `${x.toFixed(2)}px`);
      root().setProperty('--ar-shake-y', `${y.toFixed(2)}px`);
    } else if (this.shake !== 0) {
      this.shake = 0;
      root().setProperty('--ar-shake-x', '0px');
      root().setProperty('--ar-shake-y', '0px');
    }

    if (this.flashEl) {
      if (this.flash > 0.004) {
        this.flash *= Math.pow(0.004, dt);
        this.flashEl.style.opacity = this.flash.toFixed(3);
      } else if (this.flash !== 0) {
        this.flash = 0;
        this.flashEl.style.opacity = '0';
      }
    }
  }

  private ensureAudio(): AudioContext | null {
    if (this.audio) return this.audio;
    const Ctor = window.AudioContext ?? (window as unknown as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audio = new Ctor();
    } catch {
      this.audio = null;
    }
    return this.audio;
  }

  private playStinger(intensity: number, ambush: boolean): void {
    if (this.muted) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    // Dissonant downward swoop.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(ambush ? 520 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.28);

    const gain = ctx.createGain();
    const vol = 0.1 + intensity * 0.22;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  private vibrate(intensity: number, ambush: boolean): void {
    if (typeof navigator.vibrate !== 'function') return;
    // A single sharp pulse that lands ON the pop — no buzz-pause-buzz "warning".
    // (iOS Safari ignores this; the instant visual pop is what sells the scare there.)
    navigator.vibrate(Math.round((ambush ? 70 : 45) + intensity * 90));
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
