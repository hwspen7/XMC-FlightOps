import { describe, expect, it } from 'vitest';
import { encodeNativeAction, encodeNativeControl, encodeNativeResume, encodeNativeSuspend, encodeNativePedal, parseNativeTelemetry } from './native-protocol';

const TOKEN = 'A_ValidPrivateToken123';

describe('native transport protocol', () => {
  it('validates native rudder, brakes and ground-only reverse protocol', () => {
    expect(encodeNativePedal(TOKEN, 'rudder', -0.5).toString()).toContain('RUDDER|-0.5');
    expect(encodeNativePedal(TOKEN, 'brakes', 1).toString()).toContain('BRAKES|1');
    expect(encodeNativePedal(TOKEN, 'reverse', 0.35).toString()).toContain('REVERSE|0.35');
    expect(() => encodeNativePedal(TOKEN, 'reverse', -0.2)).toThrow();
    expect(() => encodeNativePedal(TOKEN, 'rudder', 1.2)).toThrow();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|armError=none|rudderRatio=-0.2|onGround=1|mouseYokeHideAvailable=0`), TOKEN)?.values)
      .toMatchObject({ rudderRatio: -0.2, onGround: 1, mouseYokeHideAvailable: 0 });
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|onGround=7`), TOKEN)).toBeNull();
  });
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
  it('validates interruption state and emits authenticated suspend/resume controls', () => {
    expect(encodeNativeSuspend(TOKEN).toString()).toBe(`XMC1|${TOKEN}|SUSPEND`);
    expect(encodeNativeResume(TOKEN).toString()).toBe(`XMC1|${TOKEN}|RESUME`);
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|simPaused=1|nativeInterrupted=1|pauseOwned=1`), TOKEN)).toEqual({
      armed: false, armError: null, values: {}, pause: { simPaused: true, nativeInterrupted: true, pauseOwned: true },
    });
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|simPaused=0`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|simPaused=2|nativeInterrupted=1|pauseOwned=0`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=0|simPaused=0|nativeInterrupted=1|pauseOwned=1`), TOKEN)).toBeNull();
  });

  it('decodes separate phone command, simulator input, cockpit and effective controls', () => {
    const packet = Buffer.from(`XMT1|${TOKEN}|armed=1|nativeCommandRollRatio=0.23|nativeCommandPitchRatio=-0.14|simJoystickRollRatio=0.23|simJoystickPitchRatio=-0.14|cockpitYokeRollRatio=0.2|cockpitYokePitchRatio=-0.1|effectiveRollRatio=0.3|effectivePitchRatio=0.4|rollOverrideState=1|pitchOverrideState=1`);
    const decoded = parseNativeTelemetry(packet, TOKEN);
    expect(decoded?.values).toMatchObject({
      nativeCommandRollRatio: 0.23, simJoystickRollRatio: 0.23,
      cockpitYokeRollRatio: 0.2, effectiveRollRatio: 0.3,
      rollOverrideState: 1, pitchOverrideState: 1,
    });
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|simJoystickRollRatio=4`), TOKEN)).toBeNull();
    expect(parseNativeTelemetry(Buffer.from(`XMT1|${TOKEN}|armed=1|rollOverrideState=3`), TOKEN)).toBeNull();
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
