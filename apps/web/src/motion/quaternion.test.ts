import { describe, expect, it } from 'vitest';
import { fromDeviceOrientation, relativeRotationDegrees } from './quaternion';

describe('relative device orientation', () => {
  it('calibrates to a zero rotation', () => {
    const q = fromDeviceOrientation(210, 35, -12);
    const output = relativeRotationDegrees(q, q);
    expect(output.x).toBeCloseTo(0);
    expect(output.y).toBeCloseTo(0);
    expect(output.z).toBeCloseTo(0);
  });
  it('handles the alpha wraparound without a full revolution', () => {
    const before = fromDeviceOrientation(359, 0, 0);
    const after = fromDeviceOrientation(1, 0, 0);
    expect(relativeRotationDegrees(before, after).z).toBeCloseTo(2);
  });
});
