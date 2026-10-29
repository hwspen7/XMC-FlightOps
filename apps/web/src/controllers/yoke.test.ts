import { describe, expect, it } from 'vitest';
import { fromDeviceOrientation } from '../motion/quaternion';
import { FIXED_FLIGHT_RESPONSE, YokeController, response } from './yoke';

const neutral = fromDeviceOrientation(0, 0, 0);

/** Independent expectation for the static soft-center phone-to-yoke mapping. */
function expectedRollFromTilt(tiltDegrees: number): number {
  const magnitude = Math.min(1, Math.abs(tiltDegrees) / FIXED_FLIGHT_RESPONSE.rollTravelDegrees);
  if (magnitude <= FIXED_FLIGHT_RESPONSE.deadZone) return 0;
  const deflection = (magnitude - FIXED_FLIGHT_RESPONSE.deadZone) / (1 - FIXED_FLIGHT_RESPONSE.deadZone);
  const shaped = deflection * (FIXED_FLIGHT_RESPONSE.centerGain +
    (1 - FIXED_FLIGHT_RESPONSE.centerGain) * deflection ** 2);
  return tiltDegrees > 0 ? -shaped : shaped;
}

describe('fixed, low-latency yoke input mapping', () => {
  it('uses an instantaneous monotonic response with a small noise dead zone', () => {
    expect(response(0.01)).toBe(0);
    expect(response(-0.01)).toBe(0);
    expect(response(3)).toBe(1);
    expect(response(-3)).toBe(-1);
    const x = (0.5 - FIXED_FLIGHT_RESPONSE.deadZone) / (1 - FIXED_FLIGHT_RESPONSE.deadZone);
    const expected = x * (FIXED_FLIGHT_RESPONSE.centerGain + (1 - FIXED_FLIGHT_RESPONSE.centerGain) * x ** 2);
    expect(response(0.5)).toBeCloseTo(expected);
    expect(response(0.5)).toBeLessThan(x);
    for (let i = 1; i <= 100; i++) {
      expect(response(i / 100)).toBeGreaterThanOrEqual(response((i - 1) / 100));
      expect(response(-i / 100)).toBeCloseTo(-response(i / 100));
    }
  });

  it('outputs zero immediately at the calibrated neutral position', () => {
    const controller = new YokeController();
    const reference = fromDeviceOrientation(20, 30, 2);
    controller.calibrate(reference, 90);
    expect(controller.update(reference, 90)).toMatchObject({ roll: 0, pitch: 0 });
  });

  it('converts phone-local roll into X-Plane yoke sign without flipping the attitude display', () => {
    const controller = new YokeController();
    controller.calibrate(neutral, 90);
    const left = controller.update(fromDeviceOrientation(15, 0, 0), 90);
    const right = controller.update(fromDeviceOrientation(-15, 0, 0), 90);
    expect(left.rawRollDegrees).toBeGreaterThan(0); // Phone-local rotation retains its original sign.
    expect(left.roll).toBeLessThan(0);                // X-Plane: negative = left.
    expect(right.roll).toBeGreaterThan(0);            // X-Plane: positive = right.
    expect(left.roll).toBeCloseTo(expectedRollFromTilt(15), 6);
    expect(right.roll).toBeCloseTo(expectedRollFromTilt(-15), 6);
  });

  it('keeps the X-Plane roll polarity after recentering in the other landscape orientation', () => {
    const controller = new YokeController();
    controller.calibrate(neutral, 270);
    const left = controller.update(fromDeviceOrientation(15, 0, 0), 270);
    const right = controller.update(fromDeviceOrientation(-15, 0, 0), 270);
    expect(left.roll).toBeLessThan(0);
    expect(right.roll).toBeGreaterThan(0);
    expect(left.roll).toBeCloseTo(expectedRollFromTilt(15), 6);
    expect(right.roll).toBeCloseTo(expectedRollFromTilt(-15), 6);
  });

  it('maps nose up to positive pitch in both landscape orientations', () => {
    const controller = new YokeController();
    controller.calibrate(neutral, 90);
    expect(controller.update(fromDeviceOrientation(0, 0, -10), 90).pitch).toBeGreaterThan(0);
    controller.calibrate(neutral, 270);
    expect(controller.update(fromDeviceOrientation(0, 0, 10), 270).pitch).toBeGreaterThan(0);
  });

  it('does not reuse the old reference after the screen is rotated', () => {
    const controller = new YokeController();
    controller.calibrate(neutral, 90);
    expect(controller.update(fromDeviceOrientation(15, 0, 0), 270)).toEqual({ roll: 0, pitch: 0, rawRollDegrees: 0, rawPitchDegrees: 0 });
  });
});
