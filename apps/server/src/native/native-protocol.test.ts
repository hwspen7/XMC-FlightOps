import { describe, expect, it } from 'vitest';
import { encodeNativeAction, encodeNativeControl, parseNativeTelemetry } from './native-protocol';

const TOKEN = 'A_ValidPrivateToken123';

describe('native transport protocol', () => {
  it('decodes authenticated flight data', () => {
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|rollDegrees=12.5|altitudeFeet=4800`), TOKEN))
      .toEqual({ armed: true, armError: null, values: { rollDegrees: 12.5, altitudeFeet: 4800 } });
  });
  it('decodes native ARM rejection without treating it as flight telemetry', () => {
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|rollDegrees=1|armError=roll-override-busy`), TOKEN))
      .toEqual({ armed: false, armError: 'roll-override-busy', values: { rollDegrees: 1 } });
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|armError=none`), TOKEN))
      .toEqual({ armed: true, armError: 'none', values: {} });
  });
  it('rejects stale, malformed, and unauthorized input', () => {
    expect(parseNativeTelemetry(Buffer.from(`XMT1|invalid|armed=0|rollDegrees=0`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|unknown=22`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|rollDegrees=NaN`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|armError=secret-leak`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|armError=roll-override-busy`), TOKEN)).toBeNull();
  });
  it('validates outbound limits and action whitelist', () => {
    expect(encodeNativeControl(TOKEN, 8, -0.3, 0.5).toString()).toContain('|CTRL|8|-0.3|0.5');
    expect(() => encodeNativeControl(TOKEN, 8, 2, 0)).toThrow();
    expect(() => encodeNativeAction(TOKEN, 'unknown')).toThrow();
  });
  it('parses native flight-loop counters separately from aircraft telemetry', () => {
    const packet = Buffer.from(`XMT1|${TOKEN}|armed=1|rollDegrees=3|armError=none|nativeLoopHz=60|nativeAppliedFrames=120|nativeSkippedSeq=2|nativeMaxGapMs=34|nativeMaxApplyUs=180|nativeControlAgeMs=5|nativeAckSeq=125`);
    expect(parseNativeTelemetry(packet, TOKEN)).toEqual({
      armed: true, armError: 'none', values: { rollDegrees: 3 },
      metrics: { loopHz: 60, appliedFrames: 120, skippedSequences: 2,
        maximumInputGapMs: 34, maximumApplyUs: 180, controlAgeMs: 5, lastAckSequence: 125 },
    });
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|nativeLoopHz=60|nativeLoopHz=70`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|nativeAckSeq=-1`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|nativeAckSeq=1.5`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|nativeAckSeq=9007199254740992`), TOKEN)).toBeNull();
  });
});
