import type { Quaternion } from '../motion/quaternion';
import { relativeRotationDegrees } from '../motion/quaternion';

export interface YokeSettings {
  rollTravelDegrees: number;
  pitchTravelDegrees: number;
  deadZone: number;
  responseExponent: number;
  smoothingMs: number;
  invertRoll: boolean;
  invertPitch: boolean;
}

export interface YokeOutput {
  roll: number;
  pitch: number;
  rawRollDegrees: number;
  rawPitchDegrees: number;
}

export const DEFAULT_YOKE_SETTINGS: YokeSettings = {
  rollTravelDegrees: 55,
  pitchTravelDegrees: 28,
  deadZone: 0.035,
  responseExponent: 1.4,
  smoothingMs: 65,
  invertRoll: false,
  invertPitch: false,
};

export const ZERO_OUTPUT: YokeOutput = {
  roll: 0, pitch: 0, rawRollDegrees: 0, rawPitchDegrees: 0,
};

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function response(value: number, deadZone: number, exponent: number): number {
  const magnitude = Math.abs(clamp(value));
  if (magnitude <= deadZone) return 0;
  const normalized = (magnitude - deadZone) / (1 - deadZone);
  return Math.sign(value) * normalized ** exponent;
}

export class YokeController {
  private neutral: Quaternion | null = null;
  private previousAt: number | null = null;
  private filteredRoll = 0;
  private filteredPitch = 0;

  constructor(private settings: YokeSettings = DEFAULT_YOKE_SETTINGS) {}

  isCalibrated(): boolean { return this.neutral !== null; }

  configure(settings: YokeSettings): void {
    this.settings = settings;
  }

  calibrate(current: Quaternion): void {
    this.neutral = { ...current };
    this.previousAt = null;
    this.filteredRoll = 0;
    this.filteredPitch = 0;
  }

  reset(): void {
    this.neutral = null;
    this.previousAt = null;
    this.filteredRoll = 0;
    this.filteredPitch = 0;
  }

  update(current: Quaternion, timestampMs: number): YokeOutput {
    if (!this.neutral) return ZERO_OUTPUT;
    const rotation = relativeRotationDegrees(this.neutral, current);
    const rollAngle = rotation.z;
    const pitchAngle = rotation.y;
    const rollDirection = this.settings.invertRoll ? -1 : 1;
    const pitchDirection = this.settings.invertPitch ? -1 : 1;
    const targetRoll = response(rollDirection * rollAngle / this.settings.rollTravelDegrees,
      this.settings.deadZone, this.settings.responseExponent);
    const targetPitch = response(pitchDirection * pitchAngle / this.settings.pitchTravelDegrees,
      this.settings.deadZone, this.settings.responseExponent);
    const elapsed = this.previousAt === null ? Infinity : Math.max(0, Math.min(250, timestampMs - this.previousAt));
    const alpha = this.settings.smoothingMs <= 0 ? 1 : 1 - Math.exp(-elapsed / this.settings.smoothingMs);
    this.previousAt = timestampMs;
    this.filteredRoll += alpha * (targetRoll - this.filteredRoll);
    this.filteredPitch += alpha * (targetPitch - this.filteredPitch);
    return {
      roll: clamp(this.filteredRoll),
      pitch: clamp(this.filteredPitch),
      rawRollDegrees: rollAngle,
      rawPitchDegrees: pitchAngle,
    };
  }
}
