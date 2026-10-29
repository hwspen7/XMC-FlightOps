import type { FlightTelemetry } from '@xplane/shared';

export const EMPTY_FLIGHT_TELEMETRY: FlightTelemetry = {
  rollDegrees: null, pitchDegrees: null, headingDegrees: null, magneticHeadingDegrees: null,
  indicatedAirspeedKnots: null, trueAirspeedKnots: null, groundSpeedKnots: null,
  altitudeFeet: null, aglFeet: null, verticalSpeedFpm: null,
  angleOfAttackDegrees: null, sideslipDegrees: null, rollRateDegreesPerSecond: null,
  pitchRateDegreesPerSecond: null, yawRateDegreesPerSecond: null,
  latitudeDegrees: null, longitudeDegrees: null, flightPathDegrees: null,
  machNumber: null, throttleRatio: null, flapRatio: null,
  flapHandleRatio: null, flapDeployRatio: null, flapDetentCount: null, aircraftIcao: null,
  speedbrakeRatio: null,
  elevatorTrimRatio: null, gearHandleDown: null, autopilotServosOn: null,
  n1LeftPercent: null, n1RightPercent: null,
  simJoystickRollRatio: null, simJoystickPitchRatio: null,
  cockpitYokeRollRatio: null, cockpitYokePitchRatio: null,
  effectiveRollRatio: null, effectivePitchRatio: null,
  rollOverrideState: null, pitchOverrideState: null,
  nativeCommandRollRatio: null, nativeCommandPitchRatio: null,
  rudderRatio: null, rudderOverrideState: null, leftBrakeRatio: null, rightBrakeRatio: null,
  wheelBrakeRatio: null, reverseHandleRatio: null, reverseActive: null, onGround: null,
  autothrottleOn: null, mouseYokeActive: null, mouseYokeHideAvailable: null,
  receivedAt: null,
};

export function displayValue(value: number | null, decimals = 0): string {
  if (value === null || !Number.isFinite(value)) return '---';
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function normalizedHeading(heading: number | null): string {
  if (heading === null || !Number.isFinite(heading)) return '---';
  return String(((Math.round(heading) % 360) + 360) % 360).padStart(3, '0');
}

export function percentDeflection(value: number): string {
  return `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
}
