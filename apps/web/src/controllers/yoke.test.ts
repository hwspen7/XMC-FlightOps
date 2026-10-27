import { describe, expect, it } from 'vitest';
import { fromDeviceOrientation } from '../motion/quaternion';
import { DEFAULT_YOKE_SETTINGS, YokeController, response } from './yoke';

describe('yoke input mapping', () => {
  it('enforces a dead zone and clamps output', () => {
    expect(response(0.02, 0.04, 1)).toBe(0);
    expect(response(-0.02, 0.04, 1)).toBe(0);
    expect(response(3, 0.04, 1)).toBe(1);
  });
  it('outputs neutral control after calibration', () => {
    const controller = new YokeController(DEFAULT_YOKE_SETTINGS);
    const neutral = fromDeviceOrientation(20, 30, 2);
    controller.calibrate(neutral);
    expect(controller.update(neutral, 100)).toMatchObject({ roll: 0, pitch: 0 });
  });
  it('generates a roll command after a turn', () => {
    const controller = new YokeController({ ...DEFAULT_YOKE_SETTINGS, smoothingMs: 0 });
    controller.calibrate(fromDeviceOrientation(0, 0, 0));
    const result = controller.update(fromDeviceOrientation(30, 0, 0), 100);
    expect(result.roll).toBeGreaterThan(0.1);
    expect(result.pitch).toBeCloseTo(0);
  });
});
