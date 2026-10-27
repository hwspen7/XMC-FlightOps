import { describe, expect, it } from 'vitest';
import { decodeSubscriptions, encodeDataref, encodeSubscription } from './packets';

const DATAREF = 'sim/joystick/yoke_roll_ratio';

describe('X-Plane UDP packet codec', () => {
  it('encodes a fixed-width DREF packet', () => {
    const packet = encodeDataref(DATAREF, -0.25);
    expect(packet.length).toBe(509);
    expect(packet.subarray(0, 5).toString()).toBe('DREF\0');
    expect(packet.readFloatLE(5)).toBeCloseTo(-0.25);
    expect(packet.toString('ascii', 9, 9 + DATAREF.length)).toBe(DATAREF);
  });
  it('encodes a fixed-width RREF subscription', () => {
    const packet = encodeSubscription('sim/time/total_running_time_sec', 2, 2843);
    expect(packet.length).toBe(413);
    expect(packet.readInt32LE(5)).toBe(2);
    expect(packet.readInt32LE(9)).toBe(2843);
  });
  it('rejects NaN and invalid paths', () => {
    expect(() => encodeDataref(DATAREF, NaN)).toThrow();
    expect(() => encodeDataref('bad\0path', 1)).toThrow();
  });
  it('decodes heartbeat responses', () => {
    const packet = Buffer.alloc(13);
    packet.write('RREF,');
    packet.writeInt32LE(2843, 5);
    packet.writeFloatLE(123.5, 9);
    expect(decodeSubscriptions(packet)).toEqual([{ index: 2843, value: 123.5 }]);
  });
});
