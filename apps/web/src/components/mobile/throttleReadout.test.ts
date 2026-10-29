import { describe, expect, it } from 'vitest';
import { formatN1Readout } from './throttleReadout';

describe('engine N1 readback', () => {
  it('displays both engines independently', () => {
    expect(formatN1Readout(71.24, 72.86)).toBe('71.2/72.9%');
  });
  it('never substitutes throttle-command percentage for missing N1 data', () => {
    expect(formatN1Readout(null, null)).toBe('---');
    expect(formatN1Readout(65.1, null)).toBe('L 65.1%');
    expect(formatN1Readout(null, 65.1)).toBe('R 65.1%');
    expect(formatN1Readout(Number.NaN, null)).toBe('---');
  });
});
