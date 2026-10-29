import { describe, expect, it } from 'vitest';
import { horizonTransform, liveAircraftAttitude } from './attitude';

describe('shared X-Plane aircraft attitude mapping', () => {
  const sample = { rollDegrees: 25, pitchDegrees: 10 };

  it('reads aircraft phi/theta, not phone motion or commanded yoke travel', () => {
    expect(liveAircraftAttitude(sample, true)).toEqual({ roll: 25, pitch: 10 });
  });

  it('matches the desktop horizon bank and pitch sign', () => {
    const attitude = liveAircraftAttitude(sample, true)!;
    expect(horizonTransform(attitude, 380, 182, 3.6))
      .toBe('translate(380 182) rotate(-25) translate(0 36)');
    expect(horizonTransform(attitude, 180, 172, 3.4))
      .toBe('translate(180 172) rotate(-25) translate(0 34)');
  });

  it('keeps nose-down and left-bank polarity consistent', () => {
    expect(horizonTransform({ roll: -20, pitch: -5 }, 180, 172, 3.4))
      .toBe('translate(180 172) rotate(20) translate(0 -17)');
  });

  it('never presents stale or missing telemetry as level flight', () => {
    expect(liveAircraftAttitude(sample, false)).toBeNull();
    expect(liveAircraftAttitude({ rollDegrees: null, pitchDegrees: 0 }, true)).toBeNull();
    expect(liveAircraftAttitude({ rollDegrees: 0, pitchDegrees: null }, true)).toBeNull();
    expect(liveAircraftAttitude({ rollDegrees: NaN, pitchDegrees: 2 }, true)).toBeNull();
  });

  it('accepts a genuinely level aircraft while telemetry is live', () => {
    expect(liveAircraftAttitude({ rollDegrees: 0, pitchDegrees: 0 }, true))
      .toEqual({ roll: 0, pitch: 0 });
  });
});
