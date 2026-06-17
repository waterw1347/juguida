import * as THREE from 'three';

/**
 * Maps the browser `deviceorientation` event to a Three.js camera quaternion.
 *
 * Three.js removed `DeviceOrientationControls` (a reliable cross-device build was
 * deemed impossible), so the canonical algorithm is vendored here. It is stable;
 * the inputs are the hard part — see notes below.
 *
 * Coordinate notes:
 *  - alpha/beta/gamma arrive in degrees and are converted to radians.
 *  - `q1` rotates -90° about X so the camera (which looks down -Z) points out the
 *    back of an upright phone toward the horizon.
 *  - `screenAngle` corrects for device rotation (portrait/landscape).
 *
 * Heading: we do NOT try to align to true north. iOS `alpha` (compass) is often
 * uncalibrated and drifts. Ghosts are spawned relative to the camera's current
 * forward vector at spawn time (see SpawnManager), so absolute heading is
 * irrelevant and compass error never matters.
 */

const DEG2RAD = Math.PI / 180;
const ZEE = new THREE.Vector3(0, 0, 1);
const EULER = new THREE.Euler();
const Q0 = new THREE.Quaternion();
// -90° about the X axis: (-sin(π/4), 0, 0, cos(π/4)).
const Q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
}

export class OrientationController {
  private alpha = 0;
  private beta = 0;
  private gamma = 0;
  private screenAngle = 0;
  private reading = false;
  private listening = false;

  /** True once at least one usable sensor reading has arrived. */
  get hasData(): boolean {
    return this.reading;
  }

  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.screenAngle = this.readScreenAngle() * DEG2RAD;
    window.addEventListener('deviceorientation', this.handleOrientation, true);
    window.addEventListener('orientationchange', this.handleScreenChange);
    screen.orientation?.addEventListener('change', this.handleScreenChange);
  }

  stop(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener('deviceorientation', this.handleOrientation, true);
    window.removeEventListener('orientationchange', this.handleScreenChange);
    screen.orientation?.removeEventListener('change', this.handleScreenChange);
  }

  /** Writes the sensor-derived orientation into `out` and returns it. */
  getQuaternion(out: THREE.Quaternion): THREE.Quaternion {
    EULER.set(this.beta, this.alpha, -this.gamma, 'YXZ');
    out.setFromEuler(EULER);
    out.multiply(Q1);
    out.multiply(Q0.setFromAxisAngle(ZEE, -this.screenAngle));
    return out;
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    if (event.alpha == null && event.beta == null && event.gamma == null) return;
    this.alpha = (event.alpha ?? 0) * DEG2RAD;
    this.beta = (event.beta ?? 0) * DEG2RAD;
    this.gamma = (event.gamma ?? 0) * DEG2RAD;
    this.reading = true;
  };

  private readonly handleScreenChange = (): void => {
    this.screenAngle = this.readScreenAngle() * DEG2RAD;
  };

  private readScreenAngle(): number {
    const angle = screen.orientation?.angle;
    if (typeof angle === 'number') return angle;
    const legacy = (window as unknown as { orientation?: number }).orientation;
    return typeof legacy === 'number' ? legacy : 0;
  }
}

/**
 * iOS 13+ requires a user-gesture-triggered permission for motion sensors.
 * Other platforms expose no such API and need no permission. Returns whether
 * orientation data is permitted.
 */
export async function requestOrientationPermission(): Promise<boolean> {
  const ctor = window.DeviceOrientationEvent as unknown as
    | DeviceOrientationEventStatic
    | undefined;
  if (ctor && typeof ctor.requestPermission === 'function') {
    try {
      const result = await ctor.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}
