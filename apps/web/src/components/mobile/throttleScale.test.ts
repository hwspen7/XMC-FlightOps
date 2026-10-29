import { describe, expect, it } from 'vitest';
import { IDLE_TRAVEL_FRACTION } from './throttleLeverLogic';
import { REVERSE_IDLE_REFERENCE_PERCENT, THROTTLE_SCALE_MARKS } from './throttleScale';

describe('long throttle lever scale', () => {
  it('draws exactly one forward tick per 5% from 100% to idle', () => {
    const marks = THROTTLE_SCALE_MARKS.filter(mark => mark.zone === 'forward');
    expect(marks).toHaveLength(21);
    expect(marks.map(mark => mark.value)).toEqual(Array.from({ length: 21 }, (_, i) => 100 - i * 5));
    expect(marks[0].fraction).toBe(0);
    expect(marks[20].fraction).toBeCloseTo(IDLE_TRAVEL_FRACTION);
  });

  it('labels every 20% to avoid overlapping small phone displays', () => {
    const marks = THROTTLE_SCALE_MARKS.filter(mark => mark.zone === 'forward');
    expect(marks.filter(mark => mark.label).map(mark => mark.label)).toEqual([
      '100', '80', '60', '40', '20', 'IDLE',
    ]);
    expect(marks.filter(mark => mark.major)).toHaveLength(11);
  });

  it('keeps the reverse section below idle, without changing control mapping', () => {
    const reverse = THROTTLE_SCALE_MARKS.filter(mark => mark.zone === 'reverse');
    expect(reverse).toHaveLength(4);
    expect(reverse.every(mark => mark.fraction > IDLE_TRAVEL_FRACTION && mark.fraction <= 1)).toBe(true);
    expect(reverse.at(-1)?.label).toBe('MAX');
    expect(reverse.find(mark => mark.detent === 'reverse-idle')?.label).toBe('RIDLE');
    expect(THROTTLE_SCALE_MARKS.filter(mark => mark.detent).map(mark => mark.detent)).toEqual([
      'idle', 'reverse-idle', 'max-reverse',
    ]);
    const reverseIdle = reverse.find(mark => mark.detent === 'reverse-idle');
    expect(reverseIdle?.value).toBe(REVERSE_IDLE_REFERENCE_PERCENT);
    expect(reverseIdle!.fraction).toBeGreaterThan(IDLE_TRAVEL_FRACTION);
    expect(reverseIdle!.fraction).toBeLessThan(1);
    expect(reverse.at(-1)!.fraction).toBe(1);
  });
});
