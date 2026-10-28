import type { FlightTelemetry } from '@xplane/shared';

export const NATIVE_FIELDS = [
  'rollDegrees', 'pitchDegrees', 'headingDegrees', 'indicatedAirspeedKnots',
  'groundSpeedKnots', 'altitudeFeet', 'verticalSpeedFpm', 'magneticHeadingDegrees',
  'trueAirspeedKnots', 'aglFeet', 'angleOfAttackDegrees', 'sideslipDegrees',
  'rollRateDegreesPerSecond', 'pitchRateDegreesPerSecond', 'yawRateDegreesPerSecond',
  'latitudeDegrees', 'longitudeDegrees', 'flightPathDegrees', 'machNumber',
  'throttleRatio', 'flapRatio', 'speedbrakeRatio', 'elevatorTrimRatio',
  'gearHandleDown', 'autopilotServosOn', 'n1LeftPercent', 'n1RightPercent',
] as const satisfies readonly (keyof FlightTelemetry)[];

const KEYS = new Set<string>(NATIVE_FIELDS);
const AUXILIARY_ACTIONS = new Set([
  'trim-up', 'trim-down', 'flaps-up', 'flaps-down', 'gear-toggle', 'spoilers-toggle',
]);

export interface NativeSample {
  armed: boolean;
  values: Partial<Record<(typeof NATIVE_FIELDS)[number], number>>;
}

export function parseNativeTelemetry(packet: Buffer, token: string): NativeSample | null {
  if (packet.length > 4096 || packet.length < token.length + 12) return null;
  const fields = packet.toString('utf8').split('|');
  if (fields[0] !== 'XMT1' || fields[1] !== token || !/^armed=[01]$/.test(fields[2] ?? '')) return null;
  const values: NativeSample['values'] = {};
  for (const field of fields.slice(3)) {
    const index = field.indexOf('=');
    if (index <= 0) return null;
    const key = field.slice(0, index);
    const value = field.slice(index + 1);
    if (!KEYS.has(key) || value.length > 32 || value.trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    values[key as keyof typeof values] = parsed;
  }
  return { armed: fields[2] === 'armed=1', values };
}

export function encodeNativeControl(token: string, sequence: number, roll: number, pitch: number): Buffer {
  if (!Number.isSafeInteger(sequence) || sequence < 0 ||
      !Number.isFinite(roll) || Math.abs(roll) > 1 ||
      !Number.isFinite(pitch) || Math.abs(pitch) > 1) {
    throw new Error('Invalid native control frame');
  }
  return Buffer.from(`XMC1|${token}|CTRL|${sequence}|${roll}|${pitch}`, 'ascii');
}

export function encodeNativeArm(token: string): Buffer {
  return Buffer.from(`XMC1|${token}|ARM`, 'ascii');
}

export function encodeNativeDisarm(token: string): Buffer {
  return Buffer.from(`XMC1|${token}|DISARM`, 'ascii');
}

export function encodeNativeThrottle(token: string, ratio: number): Buffer {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new Error('Invalid throttle ratio');
  return Buffer.from(`XMC1|${token}|THROTTLE|${ratio}`, 'ascii');
}

export function encodeNativeAction(token: string, action: string): Buffer {
  if (!AUXILIARY_ACTIONS.has(action)) throw new Error('Invalid auxiliary action');
  return Buffer.from(`XMC1|${token}|ACTION|${action}`, 'ascii');
}
