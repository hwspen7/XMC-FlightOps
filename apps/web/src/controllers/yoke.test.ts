import { describe, expect, it } from 'vitest';
import { fromDeviceOrientation } from '../motion/quaternion';
import { FIXED_FLIGHT_RESPONSE, YokeController, response } from './yoke';

const neutral = fromDeviceOrientation(0, 0, 0);

describe('fixed, low-latency yoke input mapping', () => {
  it('uses a fixed, linear response with a small noise dead zone', () => {
    expect(response(0.01)).toBe(0);
    expect(response(-0.01)).toBe(0);
    expect(response(3)).toBe(1);
    expect(response(-3)).toBe(-1);
    expect(response(0.5)).toBeCloseTo((0.5 - FIXED_FLIGHT_RESPONSE.deadZone) / (1 - FIXED_FLIGHT_RESPONSE.deadZone));
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
    expect(left.rawRollDegrees).toBeGreaterThan(0); // Phone-display orientation is unchanged.
    expect(left.roll).toBeLessThan(-0.25);           // X-Plane: negative = left.
    expect(right.roll).toBeGreaterThan(0.25);        // X-Plane: positive = right.
  });

  it('keeps the X-Plane roll polarity after recentering in the other landscape orientation', () => {
    const controller = new YokeController();
    controller.calibrate(neutral, 270);
    expect(controller.update(fromDeviceOrientation(15, 0, 0), 270).roll).toBeLessThan(-0.25);
    expect(controller.update(fromDeviceOrientation(-15, 0, 0), 270).roll).toBeGreaterThan(0.25);
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
