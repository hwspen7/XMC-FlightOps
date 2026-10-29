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
  'normalLoadG', 'outsideAirTempC', 'n2LeftPercent', 'n2RightPercent', 'egtLeftC', 'egtRightC', 'fuelFlowLeftKgS', 'fuelFlowRightKgS', 'oilPressureLeftPsi', 'oilPressureRightPsi', 'grossWeightKg', 'fuelWeightKg',
  'rollDegrees', 'pitchDegrees', 'headingDegrees', 'indicatedAirspeedKnots',
  'speedVsoKnots', 'speedVsKnots', 'speedVfeKnots', 'speedVnoKnots', 'speedVneKnots', 'selectedAltitudeFeet',
  'groundSpeedKnots', 'altitudeFeet', 'verticalSpeedFpm', 'magneticHeadingDegrees',
  'trueAirspeedKnots', 'aglFeet', 'angleOfAttackDegrees', 'sideslipDegrees',
  'rollRateDegreesPerSecond', 'pitchRateDegreesPerSecond', 'yawRateDegreesPerSecond',
  'latitudeDegrees', 'longitudeDegrees', 'flightPathDegrees', 'machNumber',
  'throttleRatio', 'flapRatio', 'flapHandleRatio', 'flapDeployRatio', 'flapDetentCount', 'aircraftIcao', 'speedbrakeRatio', 'elevatorTrimRatio',
  'gearHandleDown', 'gearDeploy0Ratio', 'gearDeploy1Ratio', 'gearDeploy2Ratio', 'autopilotServosOn', 'n1LeftPercent', 'n1RightPercent',
  'simJoystickRollRatio', 'simJoystickPitchRatio', 'cockpitYokeRollRatio', 'cockpitYokePitchRatio',
  'effectiveRollRatio', 'effectivePitchRatio', 'rollOverrideState', 'pitchOverrideState',
  'nativeCommandRollRatio', 'nativeCommandPitchRatio',
  'rudderRatio', 'rudderOverrideState', 'leftBrakeRatio', 'rightBrakeRatio', 'wheelBrakeRatio',
  'reverseHandleRatio', 'reverseActive', 'gearDeploy0Ratio', 'gearDeploy1Ratio', 'gearDeploy2Ratio', 'onGround', 'autothrottleOn', 'mouseYokeActive', 'mouseYokeHideAvailable',
] as const satisfies readonly (keyof FlightTelemetry)[];

const KEYS = new Set<string>(NATIVE_FIELDS);
const NORMALIZED_CONTROL_FIELDS = new Set<string>([
  'simJoystickRollRatio', 'simJoystickPitchRatio',
  'cockpitYokeRollRatio', 'cockpitYokePitchRatio',
  'effectiveRollRatio', 'effectivePitchRatio',
  'nativeCommandRollRatio', 'nativeCommandPitchRatio',
  'rudderRatio', 'rudderOverrideState', 'leftBrakeRatio', 'rightBrakeRatio', 'wheelBrakeRatio',
  'reverseHandleRatio', 'reverseActive', 'gearDeploy0Ratio', 'gearDeploy1Ratio', 'gearDeploy2Ratio', 'onGround', 'autothrottleOn', 'mouseYokeActive', 'mouseYokeHideAvailable',
]);
const ARM_ERRORS = new Set<NativeArmError>([
  'none',
  'missing-roll-override', 'missing-pitch-override',
  'missing-roll-input', 'missing-pitch-input',
  'readonly-roll-override', 'readonly-pitch-override',
  'readonly-roll-input', 'readonly-pitch-input',
  'roll-override-busy', 'pitch-override-busy', 'autopilot-active',
]);
const AUXILIARY_ACTIONS = new Set([
  'trim-up', 'trim-down', 'flaps-up', 'flaps-down', 'gear-toggle', 'spoilers-toggle',
  'view-left', 'view-right', 'view-up', 'view-down',
  'view-center', 'view-zoom-in', 'view-zoom-out',
]);

export interface NativeSample {
  armed: boolean;
  pause?: { simPaused: boolean; nativeInterrupted: boolean; pauseOwned: boolean };
  armError: NativeArmError | null;
  values: Partial<Pick<FlightTelemetry, (typeof NATIVE_FIELDS)[number]>>;
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
  const pauseFields: Record<string, boolean> = {};
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
    if (key === 'simPaused' || key === 'nativeInterrupted' || key === 'pauseOwned') {
      if (Object.prototype.hasOwnProperty.call(pauseFields, key) || !/^[01]$/.test(value)) return null;
      pauseFields[key] = value === '1';
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
    if (key === 'aircraftIcao') {
      if (Object.prototype.hasOwnProperty.call(values, key) || !/^[A-Za-z0-9-]{2,8}$/.test(value)) return null;
      values.aircraftIcao = value.toUpperCase();
      continue;
    }
    if (!KEYS.has(key) || value.length > 32 || value.trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if ((NORMALIZED_CONTROL_FIELDS.has(key) && (parsed < -1.01 || parsed > 1.01)) ||
        ((key === 'rollOverrideState' || key === 'pitchOverrideState' || key === 'rudderOverrideState' ||
          key === 'reverseActive' || key === 'onGround' || key === 'autothrottleOn' || key === 'mouseYokeActive' ||
          key === 'mouseYokeHideAvailable') && parsed !== 0 && parsed !== 1)) return null;
    if (key === 'flapDetentCount' && (!Number.isInteger(parsed) || parsed < 0 || parsed > 10)) return null;
    (values as Record<string, string | number | null>)[key] = parsed;
  }
  if (fields[2] === 'armed=1' && armError !== null && armError !== 'none') return null;
  const pauseCount = Object.keys(pauseFields).length;
  if (pauseCount !== 0 && pauseCount !== 3) return null;
  if (pauseCount === 3 && pauseFields.pauseOwned && (!pauseFields.nativeInterrupted || !pauseFields.simPaused)) return null;
  return {
    armed: fields[2] === 'armed=1', armError, values,
    ...(seenMetrics.size ? { metrics } : {}),
    ...(pauseCount === 3 ? { pause: {
      simPaused: pauseFields.simPaused,
      nativeInterrupted: pauseFields.nativeInterrupted,
      pauseOwned: pauseFields.pauseOwned,
    } } : {}),
  };
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

export function encodeNativeSuspend(token: string): Buffer {
  return Buffer.from(`XMC1|${token}|SUSPEND`, 'ascii');
}

export function encodeNativeResume(token: string): Buffer {
  return Buffer.from(`XMC1|${token}|RESUME`, 'ascii');
}

export function encodeNativeThrottle(token: string, ratio: number): Buffer {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new Error('Invalid throttle ratio');
  return Buffer.from(`XMC1|${token}|THROTTLE|${ratio}`, 'ascii');
}

export function encodeNativeAction(token: string, action: string): Buffer {
  if (!AUXILIARY_ACTIONS.has(action)) throw new Error('Invalid auxiliary action');
  return Buffer.from(`XMC1|${token}|ACTION|${action}`, 'ascii');
}

export type PedalAction = 'rudder' | 'brakes' | 'reverse';
export function encodeNativePedal(token: string, action: PedalAction, value: number): Buffer {
  if (!Number.isFinite(value) || (action === 'rudder' ? Math.abs(value) > 1 : value < 0 || value > 1))
    throw new Error('Invalid native pedal control');
  const command = { rudder: 'RUDDER', brakes: 'BRAKES', reverse: 'REVERSE' }[action];
  return Buffer.from(`XMC1|${token}|${command}|${value}`, 'ascii');
}
