import { describe, expect, it } from 'vitest';
import { brakeLevelForDisplacement, viewStepForDisplacement } from './flightDeckGestures';

describe('mobile flight deck touch gestures', () => {
  it('starts at regular brake and promotes to maximum only on upward slide', () => {
    expect(brakeLevelForDisplacement(200, 200)).toBe(0.5);
    expect(brakeLevelForDisplacement(200, 166)).toBe(0.5);
    expect(brakeLevelForDisplacement(200, 165)).toBe(1);
    expect(brakeLevelForDisplacement(200, 280)).toBe(0.5);
  });
  it('turns drags into limited cockpit view commands without inventing other commands', () => {
    expect(viewStepForDisplacement(4, 5)).toBe(null);
    expect(viewStepForDisplacement(-25, 1)).toBe('view-left');
    expect(viewStepForDisplacement(22, 1)).toBe('view-right');
    expect(viewStepForDisplacement(0, -20)).toBe('view-up');
    expect(viewStepForDisplacement(0, 20)).toBe('view-down');
    expect(viewStepForDisplacement(Infinity, 20)).toBe(null);
  });
});
