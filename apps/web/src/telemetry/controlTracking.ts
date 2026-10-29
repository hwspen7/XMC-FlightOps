import type { FlightTelemetry } from '@xplane/shared';

export type TrackingState = 'unavailable' | 'matched' | 'mismatch' | 'override-lost';

export interface TrackingResult {
  state: TrackingState;
  rollError: number | null;
  pitchError: number | null;
}

/**
 * Compare commands and joystick readback from the same native snapshot.
 * Never compare phone's newest local sample with an older 10 Hz telemetry frame.
 * Cockpit/total values include aircraft linkage, stability and autopilot inputs.
 */
export function controlTracking(telemetry: FlightTelemetry, live: boolean, nativeArmed: boolean | null | undefined): TrackingResult {
  const unavailable: TrackingResult = { state: 'unavailable', rollError: null, pitchError: null };
  if (!live || nativeArmed !== true) return unavailable;
  if (telemetry.rollOverrideState === 0 || telemetry.pitchOverrideState === 0) {
    return { ...unavailable, state: 'override-lost' };
  }
  const { nativeCommandRollRatio: commandRoll, nativeCommandPitchRatio: commandPitch,
    simJoystickRollRatio: simRoll, simJoystickPitchRatio: simPitch } = telemetry;
  if (commandRoll === null || commandPitch === null || simRoll === null || simPitch === null ||
      ![commandRoll, commandPitch, simRoll, simPitch].every(Number.isFinite)) return unavailable;
  const rollError = Math.abs(commandRoll - simRoll);
  const pitchError = Math.abs(commandPitch - simPitch);
  return { state: rollError > 0.06 || pitchError > 0.06 ? 'mismatch' : 'matched', rollError, pitchError };
}

export function signedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '---';
  const percent = Math.round(value * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}
