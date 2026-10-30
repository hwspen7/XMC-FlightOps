import { describe, expect, it } from 'vitest';
import { displayAttitude } from './attitudePresentation';

describe('stationary ground attitude presentation', () => {
  it('does not create an attitude when telemetry is missing', () => {
    expect(displayAttitude(null, 1, 0)).toBeNull();
  });
  it('levels only tiny stationary-on-ground residuals', () => {
    expect(displayAttitude({ roll: 0.8, pitch: -1.1 }, 1, 0))
      .toEqual({ roll: 0, pitch: 0 });
  });
  it('preserves relevant nose-up or bank angles even when parked', () => {
    expect(displayAttitude({ roll: 1.8, pitch: -2.6 }, 1, 0))
      .toEqual({ roll: 1.8, pitch: -2.6 });
  });
  it('never modifies attitude while airborne or taxiing', () => {
    const pose = { roll: 0.5, pitch: 0.5 };
    expect(displayAttitude(pose, 0, 0)).toBe(pose);
    expect(displayAttitude(pose, 1, 10)).toBe(pose);
    expect(displayAttitude(pose, null, 0)).toBe(pose);
    expect(displayAttitude(pose, 1, null)).toBe(pose);
  });
});
