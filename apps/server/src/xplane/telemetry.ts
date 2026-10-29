import type { FlightTelemetry } from '@xplane/shared';

interface TelemetryDefinition {
  index: number;
  key: Exclude<keyof FlightTelemetry, 'receivedAt' | 'aircraftIcao'>;
  path: string;
  factor: number;
  frequency: number;
}

const FT = 3.280839895;
const KNOTS = 1.943844492;

// Scalar and individually indexed array datarefs only. Unsupported datarefs remain null.
export const TELEMETRY_DEFINITIONS: readonly TelemetryDefinition[] = [
  { index: 3101, key: 'rollDegrees', path: 'sim/flightmodel/position/phi', factor: 1, frequency: 12 },
  { index: 3102, key: 'pitchDegrees', path: 'sim/flightmodel/position/theta', factor: 1, frequency: 12 },
  { index: 3103, key: 'headingDegrees', path: 'sim/flightmodel/position/psi', factor: 1, frequency: 8 },
  { index: 3104, key: 'indicatedAirspeedKnots', path: 'sim/flightmodel/position/indicated_airspeed', factor: 1, frequency: 8 },
  { index: 3153, key: 'speedVsoKnots', path: 'sim/aircraft/view/acf_Vso', factor: 1, frequency: 1 },
  { index: 3154, key: 'speedVsKnots', path: 'sim/aircraft/view/acf_Vs', factor: 1, frequency: 1 },
  { index: 3155, key: 'speedVfeKnots', path: 'sim/aircraft/view/acf_Vfe', factor: 1, frequency: 1 },
  { index: 3156, key: 'speedVnoKnots', path: 'sim/aircraft/view/acf_Vno', factor: 1, frequency: 1 },
  { index: 3157, key: 'speedVneKnots', path: 'sim/aircraft/view/acf_Vne', factor: 1, frequency: 1 },
  { index: 3158, key: 'selectedAltitudeFeet', path: 'sim/cockpit2/autopilot/altitude_dial_ft', factor: 1, frequency: 1 },
  { index: 3105, key: 'groundSpeedKnots', path: 'sim/flightmodel/position/groundspeed', factor: KNOTS, frequency: 8 },
  { index: 3106, key: 'altitudeFeet', path: 'sim/flightmodel/position/elevation', factor: FT, frequency: 8 },
  { index: 3107, key: 'verticalSpeedFpm', path: 'sim/flightmodel/position/vh_ind_fpm', factor: 1, frequency: 8 },
  { index: 3108, key: 'magneticHeadingDegrees', path: 'sim/flightmodel/position/magpsi', factor: 1, frequency: 5 },
  { index: 3109, key: 'trueAirspeedKnots', path: 'sim/flightmodel/position/true_airspeed', factor: KNOTS, frequency: 5 },
  { index: 3110, key: 'aglFeet', path: 'sim/flightmodel/position/y_agl', factor: FT, frequency: 5 },
  { index: 3111, key: 'angleOfAttackDegrees', path: 'sim/flightmodel/position/alpha', factor: 1, frequency: 8 },
  { index: 3112, key: 'sideslipDegrees', path: 'sim/flightmodel/position/beta', factor: 1, frequency: 8 },
  { index: 3113, key: 'rollRateDegreesPerSecond', path: 'sim/flightmodel/position/P', factor: 1, frequency: 8 },
  { index: 3114, key: 'pitchRateDegreesPerSecond', path: 'sim/flightmodel/position/Q', factor: 1, frequency: 8 },
  { index: 3115, key: 'yawRateDegreesPerSecond', path: 'sim/flightmodel/position/R', factor: 1, frequency: 8 },
  { index: 3116, key: 'latitudeDegrees', path: 'sim/flightmodel/position/latitude', factor: 1, frequency: 2 },
  { index: 3117, key: 'longitudeDegrees', path: 'sim/flightmodel/position/longitude', factor: 1, frequency: 2 },
  { index: 3118, key: 'flightPathDegrees', path: 'sim/flightmodel/position/vpath', factor: 1, frequency: 5 },
  { index: 3119, key: 'machNumber', path: 'sim/flightmodel/misc/machno', factor: 1, frequency: 4 },
  { index: 3120, key: 'throttleRatio', path: 'sim/cockpit2/engine/actuators/throttle_ratio_all', factor: 1, frequency: 5 },
  { index: 3121, key: 'flapRatio', path: 'sim/cockpit2/controls/flap_ratio', factor: 1, frequency: 5 },
  { index: 3144, key: 'flapHandleRatio', path: 'sim/cockpit2/controls/flap_handle_request_ratio', factor: 1, frequency: 5 },
  { index: 3145, key: 'flapDeployRatio', path: 'sim/cockpit2/controls/flap_system_deploy_ratio', factor: 1, frequency: 5 },
  { index: 3146, key: 'flapDetentCount', path: 'sim/aircraft/controls/acf_flap_detents', factor: 1, frequency: 1 },
  { index: 3122, key: 'speedbrakeRatio', path: 'sim/cockpit2/controls/speedbrake_ratio', factor: 1, frequency: 5 },
  { index: 3123, key: 'elevatorTrimRatio', path: 'sim/cockpit2/controls/elevator_trim', factor: 1, frequency: 5 },
  { index: 3124, key: 'gearHandleDown', path: 'sim/cockpit2/controls/gear_handle_down', factor: 1, frequency: 3 },
  { index: 3150, key: 'gearDeploy0Ratio', path: 'sim/flightmodel2/gear/deploy_ratio[0]', factor: 1, frequency: 5 },
  { index: 3151, key: 'gearDeploy1Ratio', path: 'sim/flightmodel2/gear/deploy_ratio[1]', factor: 1, frequency: 5 },
  { index: 3152, key: 'gearDeploy2Ratio', path: 'sim/flightmodel2/gear/deploy_ratio[2]', factor: 1, frequency: 5 },
  { index: 3125, key: 'autopilotServosOn', path: 'sim/cockpit2/autopilot/servos_on', factor: 1, frequency: 3 },
  { index: 3126, key: 'n1LeftPercent', path: 'sim/cockpit2/engine/indicators/N1_percent[0]', factor: 1, frequency: 5 },
  { index: 3128, key: 'simJoystickRollRatio', path: 'sim/joystick/yoke_roll_ratio', factor: 1, frequency: 10 },
  { index: 3129, key: 'simJoystickPitchRatio', path: 'sim/joystick/yoke_pitch_ratio', factor: 1, frequency: 10 },
  { index: 3130, key: 'cockpitYokeRollRatio', path: 'sim/cockpit2/controls/yoke_roll_ratio', factor: 1, frequency: 10 },
  { index: 3131, key: 'cockpitYokePitchRatio', path: 'sim/cockpit2/controls/yoke_pitch_ratio', factor: 1, frequency: 10 },
  { index: 3132, key: 'effectiveRollRatio', path: 'sim/cockpit2/controls/total_roll_ratio', factor: 1, frequency: 10 },
  { index: 3133, key: 'effectivePitchRatio', path: 'sim/cockpit2/controls/total_pitch_ratio', factor: 1, frequency: 10 },
  { index: 3134, key: 'rollOverrideState', path: 'sim/operation/override/override_joystick_roll', factor: 1, frequency: 8 },
  { index: 3135, key: 'pitchOverrideState', path: 'sim/operation/override/override_joystick_pitch', factor: 1, frequency: 8 },
  { index: 3136, key: 'rudderRatio', path: 'sim/joystick/yoke_heading_ratio', factor: 1, frequency: 8 },
  { index: 3137, key: 'rudderOverrideState', path: 'sim/operation/override/override_joystick_heading', factor: 1, frequency: 5 },
  { index: 3138, key: 'leftBrakeRatio', path: 'sim/cockpit2/controls/left_brake_ratio', factor: 1, frequency: 5 },
  { index: 3139, key: 'rightBrakeRatio', path: 'sim/cockpit2/controls/right_brake_ratio', factor: 1, frequency: 5 },
  { index: 3140, key: 'wheelBrakeRatio', path: 'sim/cockpit2/controls/wheel_brake_ratio', factor: 1, frequency: 5 },
  { index: 3141, key: 'reverseHandleRatio', path: 'sim/cockpit2/engine/actuators/throttle_jet_rev_ratio_all', factor: 1, frequency: 5 },
  { index: 3142, key: 'onGround', path: 'sim/flightmodel/failures/onground_any', factor: 1, frequency: 4 },
  { index: 3143, key: 'autothrottleOn', path: 'sim/cockpit2/autopilot/autothrottle_on', factor: 1, frequency: 4 },
  { index: 3127, key: 'n1RightPercent', path: 'sim/cockpit2/engine/indicators/N1_percent[1]', factor: 1, frequency: 5 },
];

const byIndex = new Map(TELEMETRY_DEFINITIONS.map((definition) => [definition.index, definition]));

export function emptyTelemetry(): FlightTelemetry {
  const telemetry: Record<string, number | string | null> = { receivedAt: null, aircraftIcao: null };
  for (const definition of TELEMETRY_DEFINITIONS) telemetry[definition.key] = null;
  for (const key of ['reverseActive', 'mouseYokeActive', 'mouseYokeHideAvailable']) telemetry[key] = null;
  return telemetry as unknown as FlightTelemetry;
}

export function applyTelemetryValue(telemetry: FlightTelemetry, index: number, value: number, receivedAt: number): FlightTelemetry {
  const definition = byIndex.get(index);
  if (!definition || !Number.isFinite(value)) return telemetry;
  const converted = value * definition.factor;
  if (!Number.isFinite(converted)) return telemetry;
  return { ...telemetry, [definition.key]: converted, receivedAt };
}

export function definitionForIndex(index: number): TelemetryDefinition | undefined { return byIndex.get(index); }
