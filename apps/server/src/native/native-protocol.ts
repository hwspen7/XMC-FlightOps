import type { FlightTelemetry, NativeArmError } from '@xplane/shared';

// Wire metrics are distinct from flight model DataRefs. Unknown keys still fail closed.
export const NATIVE_METRIC_FIELDS = {
  nativeLoopHz: 'loopHz',
  nativeAppliedFrames: 'appliedFrames',
  nativeSkippedSeq: 'skippedSequences',
  nativeMaxGapMs: 'maximumInputGapMs',
  nativeMaxApplyUs: 'maximumApplyUs',
  nativeControlAgeMs: 'controlAgeMs',
  nativeAckSeq: 'lastAckSequence',
} as const;

export type NativeMetricField = keyof typeof NATIVE_METRIC_FIELDS;
export type NativeMetricValues = Partial<Record<(typeof NATIVE_METRIC_FIELDS)[NativeMetricField], number>>;

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
const ARM_ERRORS = new Set<NativeArmError>([
  'none',
  'missing-roll-override', 'missing-pitch-override',
  'missing-roll-input', 'missing-pitch-input',
  'readonly-roll-override', 'readonly-pitch-override',
  'readonly-roll-input', 'readonly-pitch-input',
  'roll-override-busy', 'pitch-override-busy',
]);
const AUXILIARY_ACTIONS = new Set([
  'trim-up', 'trim-down', 'flaps-up', 'flaps-down', 'gear-toggle', 'spoilers-toggle',
]);

export interface NativeSample {
  armed: boolean;
  armError: NativeArmError | null;
  values: Partial<Record<(typeof NATIVE_FIELDS)[number], number>>;
  metrics?: NativeMetricValues;
}

export function parseNativeTelemetry(packet: Buffer, token: string): NativeSample | null {
  if (packet.length > 4096 || packet.length < token.length + 12) return null;
  const fields = packet.toString('utf8').split('|');
  if (fields[0] !== 'XMT1' || fields[1] !== token || !/^armed=[01]$/.test(fields[2] ?? '')) return null;
  const values: NativeSample['values'] = {};
  let armError: NativeArmError | null = null;
  const metrics: NativeMetricValues = {};
  const seenMetrics = new Set<string>();
  for (const field of fields.slice(3)) {
    const index = field.indexOf('=');
    if (index <= 0) return null;
    const key = field.slice(0, index);
    const value = field.slice(index + 1);
    if (key === 'armError') {
      if (armError !== null || !ARM_ERRORS.has(value as NativeArmError)) return null;
      armError = value as NativeArmError;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(NATIVE_METRIC_FIELDS, key)) {
      const name = NATIVE_METRIC_FIELDS[key as NativeMetricField];
      if (seenMetrics.has(key) || value.length > 16 || !/^(0|[1-9]\d*)$/.test(value)) return null;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed > 1_000_000_000) return null;
      metrics[name] = parsed;
      seenMetrics.add(key);
      continue;
    }
    if (!KEYS.has(key) || value.length > 32 || value.trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    values[key as keyof typeof values] = parsed;
  }
  if (fields[2] === 'armed=1' && armError !== null && armError !== 'none') return null;
  return { armed: fields[2] === 'armed=1', armError, values, ...(seenMetrics.size ? { metrics } : {}) };
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
