import { describe, expect, it } from 'vitest';
import { displayValue, normalizedHeading, percentDeflection } from './format';

describe('telemetry formatting', () => {
  it('does not invent missing aircraft values', () => {
    expect(displayValue(null)).toBe('---');
    expect(normalizedHeading(null)).toBe('---');
  });
  it('normalizes course headings', () => {
    expect(normalizedHeading(361)).toBe('001');
    expect(normalizedHeading(-5)).toBe('355');
  });
  it('prints signed control percentages', () => {
    expect(percentDeflection(0.33)).toBe('+33%');
    expect(percentDeflection(-0.33)).toBe('-33%');
  });
});
