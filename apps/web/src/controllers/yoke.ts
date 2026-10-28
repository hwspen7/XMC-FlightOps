import type { Quaternion } from '../motion/quaternion';
import { relativeRotationDegrees } from '../motion/quaternion';

/**
 * Fixed, linear yoke response. The physical travel values represent comfortable
 * phone movement, not the aircraft's aerodynamic control-surface deflection.
 * The aircraft's own flight model still determines its actual response.
 */
export const FIXED_FLIGHT_RESPONSE = Object.freeze({
  rollTravelDegrees: 45,
  pitchTravelDegrees: 25,
  deadZone: 0.015,
});

export interface YokeOutput {
  roll: number;
  pitch: number;
  rawRollDegrees: number;
  rawPitchDegrees: number;
}

export const ZERO_OUTPUT: YokeOutput = {
  roll: 0,
  pitch: 0,
  rawRollDegrees: 0,
  rawPitchDegrees: 0,
};

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** A small sensor-noise dead zone; otherwise completely linear. */
export function response(value: number, deadZone = FIXED_FLIGHT_RESPONSE.deadZone): number {
  const bounded = clamp(value);
  const magnitude = Math.abs(bounded);
  if (magnitude <= deadZone) return 0;
  return (Math.sign(bounded) * (magnitude - deadZone)) / (1 - deadZone);
}

/**
 * Phone is held in landscape like a yoke. Left bank = negative roll;
 * stick pulled back / nose up = positive pitch. X-Plane accepts -1..1.
 * The screen side used for landscape reverses the phone's local pitch axis.
 */
export class YokeController {
  private neutral: Quaternion | null = null;
  private calibratedLandscape: 90 | 270 | null = null;

  isCalibrated(): boolean {
    return this.neutral !== null;
  }

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
    // Preserve sensor roll for the attitude display. Phone-local roll orientation
    // is opposite the X-Plane yoke input convention (-1 left, +1 right).
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
