import type { Quaternion } from '../motion/quaternion';
import { relativeRotationDegrees } from '../motion/quaternion';

/**
 * Fixed, low-latency yoke response. The physical travel values represent comfortable
 * phone movement, not the aircraft's aerodynamic control-surface deflection.
 * The aircraft's own flight model still determines its actual response.
 * An instantaneous, monotonic soft-center curve improves fine corrections.
 */
export const FIXED_FLIGHT_RESPONSE = Object.freeze({
  rollTravelDegrees: 60,
  pitchTravelDegrees: 35,
  deadZone: 0.015,
  centerGain: 0.85,
});

export interface YokeOutput {
  roll: number;
  pitch: number;
  rawRollDegrees: number;
  rawPitchDegrees: number;
}

export const ZERO_OUTPUT: YokeOutput = {
  roll: 0, pitch: 0, rawRollDegrees: 0, rawPitchDegrees: 0,
};

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Static soft-center mapping, with no time-based smoothing or latency. */
export function response(value: number, deadZone = FIXED_FLIGHT_RESPONSE.deadZone): number {
  const bounded = clamp(value);
  const magnitude = Math.abs(bounded);
  if (magnitude <= deadZone) return 0;
  const normalized = (magnitude - deadZone) / (1 - deadZone);
  const shaped = normalized * (FIXED_FLIGHT_RESPONSE.centerGain +
    (1 - FIXED_FLIGHT_RESPONSE.centerGain) * normalized * normalized);
  return Math.sign(bounded) * shaped;
}

/**
 * Phone is held in landscape like a yoke. Left bank = negative roll;
 * stick pulled back / nose up = positive pitch. X-Plane accepts -1..1.
 * The screen side used for landscape reverses the phone's local pitch axis.
 */
export class YokeController {
  private neutral: Quaternion | null = null;
  private calibratedLandscape: 90 | 270 | null = null;

  isCalibrated(): boolean { return this.neutral !== null; }

  calibrate(current: Quaternion, screenAngle = 90): void {
    this.neutral = { ...current };
    this.calibratedLandscape = this.landscapeAngle(screenAngle);
  }

  reset(): void {
    this.neutral = null;
    this.calibratedLandscape = null;
  }

  matchesOrientation(screenAngle: number): boolean {
    return this.calibratedLandscape === this.landscapeAngle(screenAngle);
  }

  update(current: Quaternion, screenAngle = 90): YokeOutput {
    if (!this.neutral) return ZERO_OUTPUT;
    const landscape = this.landscapeAngle(screenAngle);
    // Orientation changes invalidate the previous center and must be recalibrated.
    if (landscape !== this.calibratedLandscape) return ZERO_OUTPUT;
    const rotation = relativeRotationDegrees(this.neutral, current);
    // The validated phone-local roll polarity is opposite to X-Plane yoke roll.
    // Preserve the raw rotation for motion diagnostics, but invert command only.
    const rollDegrees = rotation.z;
    const pitchDegrees = (landscape === 90 ? -1 : 1) * rotation.y;
    return {
      roll: response(-rollDegrees / FIXED_FLIGHT_RESPONSE.rollTravelDegrees),
      pitch: response(pitchDegrees / FIXED_FLIGHT_RESPONSE.pitchTravelDegrees),
      rawRollDegrees: rollDegrees,
      rawPitchDegrees: pitchDegrees,
    };
  }

  private landscapeAngle(angle: number): 90 | 270 {
    const normalized = ((angle % 360) + 360) % 360;
    return normalized === 270 ? 270 : 90;
  }
}
