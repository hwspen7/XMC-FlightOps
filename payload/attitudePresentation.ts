import type { AircraftAttitude } from './attitude';

/**
 * Non-certified UI stabilization for a motionless aircraft on its landing gear.
 * Small X-Plane phi/theta residuals (e.g. apron slope or model noise) should not
 * make the on-screen horizon appear tilted while the cockpit appears level.
 * Outside a confirmed stationary-on-ground condition all raw angles are used.
 * BANK/PITCH numeric readouts retain the original simulator measurements.
 */
export function displayAttitude(
  attitude: AircraftAttitude | null,
  onGround: number | null | undefined,
  groundSpeedKnots: number | null | undefined,
): AircraftAttitude | null {
  if (attitude === null) return null;
  if (onGround !== 1 || typeof groundSpeedKnots !== 'number' ||
      !Number.isFinite(groundSpeedKnots) || Math.abs(groundSpeedKnots) > 1.5) return attitude;

  // Snap only sub-degree stationary residuals, never meaningful bank/pitch.
  const tolerance = 1.25;
  return {
    roll: Math.abs(attitude.roll) <= tolerance ? 0 : attitude.roll,
    pitch: Math.abs(attitude.pitch) <= tolerance ? 0 : attitude.pitch,
  };
}
