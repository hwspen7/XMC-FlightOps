import { describe, expect, it } from 'vitest';
import { encodeNativeAction, encodeNativeControl, parseNativeTelemetry } from './native-protocol';

const TOKEN = 'A_ValidPrivateToken123';

describe('native transport protocol', () => {
  it('decodes authenticated flight data', () => {
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|rollDegrees=12.5|altitudeFeet=4800`), TOKEN))
      .toEqual({ armed: true, values: { rollDegrees: 12.5, altitudeFeet: 4800 } });
  });
  it('rejects stale, malformed, and unauthorized input', () => {
    expect(parseNativeTelemetry(Buffer.from(`XMT1|invalid|armed=0|rollDegrees=0`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|unknown=22`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|rollDegrees=NaN`), TOKEN)).toBeNull();
  });
  it('validates outbound limits and action whitelist', () => {
    expect(encodeNativeControl(TOKEN, 8, -0.3, 0.5).toString()).toContain('|CTRL|8|-0.3|0.5');
    expect(() => encodeNativeControl(TOKEN, 8, 2, 0)).toThrow();
    expect(() => encodeNativeAction(TOKEN, 'unknown')).toThrow();
  });
});
