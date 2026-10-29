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
  it('uses Airbus handle-stage labels only with a matching configured count', () => {
    const a320 = buildFlapDisplay('a320', 5, 0.5, 0.25);
    expect(a320?.model).toBe('A320');
    expect(a320?.label).toBe('2');
    expect(a320?.actualPercent).toBe(25);
    expect(a320?.authoritativeLabels).toBe(true);
    expect(buildFlapDisplay('A320', 8, .5, .5)?.authoritativeLabels).toBe(false);
  });
  it('supports differing numbers of configured detents and missing telemetry', () => {
    expect(buildFlapDisplay('C172', 4, 1, 1)?.label).toBe('30');
    const custom = buildFlapDisplay('CUSTOM', 6, .5, .3);
    expect(custom?.labels.length).toBe(7);
    expect(custom?.label).toBe('POS 3');
    expect(custom?.actualPercent).toBe(30);
    expect(buildFlapDisplay('B738', null, .3, null)?.labels).toEqual([]);
    expect(buildFlapDisplay(null, null, null, null)).toBeNull();
  });

});
