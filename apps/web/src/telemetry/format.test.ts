import { describe, expect, it } from 'vitest';
import { EMPTY_FLIGHT_TELEMETRY, displayValue, normalizedHeading, percentDeflection } from './format';

describe('telemetry formatting', () => {
  it('starts with unavailable aircraft and flap configuration fields', () => {
    expect(EMPTY_FLIGHT_TELEMETRY.aircraftIcao).toBeNull();
    expect(EMPTY_FLIGHT_TELEMETRY.flapHandleRatio).toBeNull();
    expect(EMPTY_FLIGHT_TELEMETRY.flapDeployRatio).toBeNull();
    expect(EMPTY_FLIGHT_TELEMETRY.flapDetentCount).toBeNull();
  });
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
