import type { FlightTelemetry } from '@xplane/shared';

export const EMPTY_FLIGHT_TELEMETRY: FlightTelemetry = {
  rollDegrees: null, pitchDegrees: null, headingDegrees: null, magneticHeadingDegrees: null,
  speedVsoKnots: null, speedVsKnots: null, speedVfeKnots: null, speedVnoKnots: null, speedVneKnots: null, selectedAltitudeFeet: null,
  indicatedAirspeedKnots: null, trueAirspeedKnots: null, groundSpeedKnots: null,
  altitudeFeet: null, aglFeet: null, verticalSpeedFpm: null,
  angleOfAttackDegrees: null, sideslipDegrees: null, rollRateDegreesPerSecond: null,
  pitchRateDegreesPerSecond: null, yawRateDegreesPerSecond: null,
  latitudeDegrees: null, longitudeDegrees: null, flightPathDegrees: null,
  machNumber: null, throttleRatio: null, flapRatio: null,
  flapHandleRatio: null, flapDeployRatio: null, flapDetentCount: null, aircraftIcao: null,
  speedbrakeRatio: null,
  elevatorTrimRatio: null, gearHandleDown: null,
  gearDeploy0Ratio: null, gearDeploy1Ratio: null, gearDeploy2Ratio: null, autopilotServosOn: null,
  n1LeftPercent: null, n1RightPercent: null,
  simJoystickRollRatio: null, simJoystickPitchRatio: null,
  cockpitYokeRollRatio: null, cockpitYokePitchRatio: null,
  effectiveRollRatio: null, effectivePitchRatio: null,
  rollOverrideState: null, pitchOverrideState: null,
  nativeCommandRollRatio: null, nativeCommandPitchRatio: null,
  rudderRatio: null, rudderOverrideState: null, leftBrakeRatio: null, rightBrakeRatio: null,
  wheelBrakeRatio: null, reverseHandleRatio: null, reverseActive: null, onGround: null,
  autothrottleOn: null, mouseYokeActive: null, mouseYokeHideAvailable: null,
  normalLoadG: null, outsideAirTempC: null, n2LeftPercent: null, n2RightPercent: null,
  egtLeftC: null, egtRightC: null, fuelFlowLeftKgS: null, fuelFlowRightKgS: null,
  oilPressureLeftPsi: null, oilPressureRightPsi: null, grossWeightKg: null, fuelWeightKg: null,

  // New native system readbacks and C++ diagnostic fields start as unavailable.
  // A zero value would incorrectly imply a measured system state.
  engineRunningLeft: null, engineRunningRight: null,
  selectedHeadingDegrees: null, selectedVerticalSpeedFpm: null,
  flightDirectorMode: null, autopilotHeadingMode: null,
  autopilotAltitudeMode: null, autopilotNavMode: null,
  autopilotApproachMode: null, navDeviationDots: null,
  glideslopeDeviationDots: null, electricalBusVolts: null,
  batteryVolts: null, generatorLeftOn: null,
  generatorRightOn: null, hydraulicPressure1Raw: null,
  hydraulicPressure2Raw: null, hydraulicFluid1Ratio: null,
  cabinAltitudeFeet: null, cabinDifferentialPsi: null,
  cabinVerticalSpeedFpm: null, pitotHeatOn: null,
  wingAntiIceOn: null, wingIceRatio: null,
  nativeRiskScore: null, nativeAlertFlags: null,
  nativeEventCount: null, nativeAnalysisSamples: null,
  nativeIasTrendKtMin: null, nativeAltitudeTrendFpm: null,
  nativeBankRmsDegrees: null,

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
