import type { FlightTelemetry } from '@xplane/shared';

/** Aircraft motion, not calibrated phone attitude or a yoke command. */
export interface AircraftAttitude {
  roll: number;
  pitch: number;
}

/**
 * Use the same X-Plane phi/theta snapshot in the desktop and mobile horizons.
 * Null and stale samples must never look like level flight.
 */
export function liveAircraftAttitude(
  telemetry: Pick<FlightTelemetry, 'rollDegrees' | 'pitchDegrees'>,
  live: boolean,
): AircraftAttitude | null {
  const roll = telemetry.rollDegrees;
  const pitch = telemetry.pitchDegrees;
  if (!live || typeof roll !== 'number' || !Number.isFinite(roll) ||
      typeof pitch !== 'number' || !Number.isFinite(pitch)) return null;
  return { roll, pitch };
}

/** Shared sign convention with the desktop primary flight display. */
export function horizonTransform(
  attitude: AircraftAttitude,
  centerX: number,
  centerY: number,
  pixelsPerDegree: number,
): string {
  return `translate(${centerX} ${centerY}) rotate(${-attitude.roll}) translate(0 ${attitude.pitch * pixelsPerDegree})`;
}
