import { describe, expect, it } from 'vitest';
import {
  clampFraction, fractionForForward, fractionForReverse, IDLE_TRAVEL_FRACTION,
  REVERSE_DETENT_MS, reverseDetentPermitted, throttleAtTravel, travelFromPointer,
} from './throttleLeverLogic';

describe('single-lever forward / reverse throttle', () => {
  it('maintains continuous pointer travel across the forward/idle/reverse boundary', () => {
    const start = 0.6;
    const height = 400;
    const distances = [0, 40, 64, 75, 100, 125];
    const output = distances.map(d => travelFromPointer(start, d, height));
    expect(output).toEqual([0.6, 0.7, 0.76, 0.7875, 0.85, 0.9125]);
    expect(output.every((value, i) => i === 0 || value >= output[i-1])).toBe(true);
    expect(travelFromPointer(0.9, 400, height)).toBe(1);
  });

  it('keeps full forward, idle and full reverse in distinct portions of one track', () => {
    expect(throttleAtTravel(0)).toEqual({ forward: 100, reverse: 0 });
    expect(throttleAtTravel(IDLE_TRAVEL_FRACTION)).toEqual({ forward: 0, reverse: 0 });
    expect(throttleAtTravel(1)).toEqual({ forward: 0, reverse: 100 });
    expect(throttleAtTravel(0.38)).toEqual({ forward: 50, reverse: 0 });
  });

  it('clamps positions and round-trips both travel ranges', () => {
    expect(clampFraction(-2)).toBe(0);
    expect(clampFraction(4)).toBe(1);
    expect(clampFraction(Infinity)).toBe(0);
    expect(throttleAtTravel(fractionForForward(80)).forward).toBe(80);
    expect(throttleAtTravel(fractionForReverse(35)).reverse).toBe(35);
  });

  it('rejects reverse in flight, with autothrottle, before idle or before detent dwell', () => {
    expect(reverseDetentPermitted(true, false, false, 0, REVERSE_DETENT_MS)).toBe(false);
    expect(reverseDetentPermitted(true, true, true, 0, REVERSE_DETENT_MS)).toBe(false);
    expect(reverseDetentPermitted(false, true, false, 0, REVERSE_DETENT_MS)).toBe(false);
    expect(reverseDetentPermitted(true, true, false, null, REVERSE_DETENT_MS)).toBe(false);
    expect(reverseDetentPermitted(true, true, false, 0.08, REVERSE_DETENT_MS)).toBe(false);
    expect(reverseDetentPermitted(true, true, false, 0, REVERSE_DETENT_MS - 1)).toBe(false);
    expect(reverseDetentPermitted(true, true, false, 0, REVERSE_DETENT_MS)).toBe(true);
  });
});
