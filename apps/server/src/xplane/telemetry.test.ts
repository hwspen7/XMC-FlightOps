import { describe, expect, it } from 'vitest';
import { applyTelemetryValue, emptyTelemetry, TELEMETRY_DEFINITIONS } from './telemetry';

describe('simulator telemetry', () => {
  it('has distinct dataref indices', () => {
    const indices = TELEMETRY_DEFINITIONS.map((definition) => definition.index);
    expect(new Set(indices).size).toBe(indices.length);
  });
  it('converts simulator altitude meters to feet', () => {
    const next = applyTelemetryValue(emptyTelemetry(), 3106, 1000, 1234);
    expect(next.altitudeFeet).toBeCloseTo(3280.84, 1);
    expect(next.receivedAt).toBe(1234);
  });
  it('converts ground speed meters per second to knots', () => {
    expect(applyTelemetryValue(emptyTelemetry(), 3105, 100, 200).groundSpeedKnots).toBeCloseTo(194.384, 2);
  });
  it('maps engine and load telemetry without inventing absent sensors', () => {
    const initial = emptyTelemetry();
    expect(initial.egtLeftC).toBeNull();
    expect(initial.normalLoadG).toBeNull();
    expect(applyTelemetryValue(initial, 3164, 624, 900).egtLeftC).toBe(624);
    expect(applyTelemetryValue(initial, 3160, 1.15, 900).normalLoadG).toBe(1.15);
  });
  it('rejects unknown indices and non-finite values', () => {
    const current = emptyTelemetry();
    expect(applyTelemetryValue(current, 9999, 1, 100)).toBe(current);
    expect(applyTelemetryValue(current, 3101, Infinity, 100)).toBe(current);
  });
});
