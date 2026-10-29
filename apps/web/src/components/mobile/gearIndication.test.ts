import { describe, it, expect } from 'vitest';
import { gearReadback } from './gearIndication';

describe('realistic landing gear indications', () => {
  it('lights all green only when all three gear positions indicate fully down', () => {
    expect(gearReadback(1, [1, 1, 1], true)).toMatchObject({ state: 'down', lamps: ['green', 'green', 'green'] });
  });
  it('extinguishes all three lights when fully retracted', () => {
    expect(gearReadback(0, [0, 0, 0], true)).toMatchObject({ state: 'up', lamps: ['off', 'off', 'off'] });
  });
  it('shows red for transit and conflicting indicated positions', () => {
    expect(gearReadback(0, [.4, 0, .7], true).state).toBe('unsafe');
    expect(gearReadback(1, [1, .4, 1], true).lamps).toEqual(['green', 'red', 'green']);
  });
  it('never invents a locked indication when feedback is missing', () => {
    expect(gearReadback(1, [null, null, null], true).state).toBe('selected-down');
    expect(gearReadback(0, [0, 0, 0], false).state).toBe('unknown');
  });
});
