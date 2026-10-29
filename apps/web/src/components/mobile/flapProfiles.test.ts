import { describe, expect, it } from 'vitest';
import { buildFlapDisplay } from './flapProfiles';

describe('aircraft-sourced flap indication', () => {
  it('uses real Boeing labels only when the aircraft and detent count agree', () => {
    const b738 = buildFlapDisplay('B738', 9, 0.375, 0.2);
    expect(b738?.label).toBe('5');
    expect(b738?.model).toBe('B738');
    expect(b738?.actualPercent).toBe(20);
    expect(b738?.moving).toBe(true);
    expect(b738?.authoritativeLabels).toBe(true);
    expect(buildFlapDisplay('B789', 9, .375, .375)?.label).toBe('15');
  });
  it('does not invent Boeing positions for unknown or mismatched aircraft', () => {
    expect(buildFlapDisplay('ZZZZ', 4, .5, .5)?.label).toBe('POS 2');
    expect(buildFlapDisplay('B738', 4, .5, .5)?.authoritativeLabels).toBe(false);
    expect(buildFlapDisplay(null, null, .375, .2)?.label).toBe('38%');
    expect(buildFlapDisplay(null, null, null, null)).toBeNull();
  });
  it('keeps handle position separate from surface deployment', () => {
    const state = buildFlapDisplay('B738', 9, .25, .05);
    expect(state?.label).toBe('2');
    expect(state?.handlePercent).toBe(25);
    expect(state?.actualPercent).toBe(5);
  });
});
