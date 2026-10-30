import { describe, expect, it } from 'vitest';
import { PITCH_TICKS, pitchMark, radioAltitudeFeet } from './instrumentScale';

describe('unified cockpit pitch ladder', () => {
  it('uses symmetric 2.5-degree marks without a fake zero-degree rung', () => {
    expect(PITCH_TICKS).toContain(2.5);
    expect(PITCH_TICKS).toContain(-2.5);
    expect(PITCH_TICKS).not.toContain(0);
    expect(PITCH_TICKS.length).toBe(48);
    expect(PITCH_TICKS.every(n => PITCH_TICKS.includes(-n))).toBe(true);
  });
  it('has distinct long, medium and minor bars with majors only labeled', () => {
    expect(pitchMark(10).kind).toBe('major');
    expect(pitchMark(5).kind).toBe('medium');
    expect(pitchMark(2.5).kind).toBe('minor');
    expect(pitchMark(10).halfWidth).toBeGreaterThan(pitchMark(5).halfWidth);
    expect(pitchMark(5).halfWidth).toBeGreaterThan(pitchMark(2.5).halfWidth);
    expect(pitchMark(-20)).toEqual(pitchMark(20));
    expect(pitchMark(5).label).toBe(false);
    expect(pitchMark(10).label).toBe(true);
  });
  it('does not render stale or missing radio height', () => {
    expect(radioAltitudeFeet(null, true)).toBeNull();
    expect(radioAltitudeFeet(125, false)).toBeNull();
    expect(radioAltitudeFeet(2501, true)).toBeNull();
    expect(radioAltitudeFeet(125.4, true)).toBe(125);
  });
});
