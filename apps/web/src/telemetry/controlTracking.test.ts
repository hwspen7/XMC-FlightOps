import { describe, it, expect } from 'vitest';
import { EMPTY_FLIGHT_TELEMETRY } from './format';
import { controlTracking, signedPercent } from './controlTracking';

const sample = {
  ...EMPTY_FLIGHT_TELEMETRY,
  nativeCommandRollRatio: 0.23, nativeCommandPitchRatio: -0.12,
  simJoystickRollRatio: 0.23, simJoystickPitchRatio: -0.12,
  cockpitYokeRollRatio: 0.18, effectiveRollRatio: 0.4,
  rollOverrideState: 1, pitchOverrideState: 1,
};

describe('native cockpit tracking diagnostics', () => {
  it('matches command against the simulator joystick readback, not cockpit total', () => {
    expect(controlTracking(sample, true, true)).toEqual({ state: 'matched', rollError: 0, pitchError: 0 });
  });
  it('detects large readback deviations without changing flight control', () => {
    expect(controlTracking({ ...sample, simJoystickRollRatio: 0.1 }, true, true).state).toBe('mismatch');
  });
  it('detects an override released while control is reportedly armed', () => {
    expect(controlTracking({ ...sample, pitchOverrideState: 0 }, true, true).state).toBe('override-lost');
  });
  it('never reports matched when the plugin is disconnected, disarmed, or telemetry incomplete', () => {
    expect(controlTracking(sample, false, true).state).toBe('unavailable');
    expect(controlTracking(sample, true, false).state).toBe('unavailable');
    expect(controlTracking({ ...sample, simJoystickPitchRatio: null }, true, true).state).toBe('unavailable');
  });
  it('formats signed, zero and unsupported normalized inputs', () => {
    expect(signedPercent(-0.25)).toBe('-25%');
    expect(signedPercent(0)).toBe('0%');
    expect(signedPercent(0.25)).toBe('+25%');
    expect(signedPercent(null)).toBe('---');
  });
});
