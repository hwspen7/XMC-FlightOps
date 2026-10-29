export type ControlMode = 'yoke' | 'sidestick';

export interface ControlFrame {
  sequence: number;
  roll: number;
  pitch: number;
  sensorRateHz?: number;
  tiltRollDegrees?: number;
  tiltPitchDegrees?: number;
}

export type AuxiliaryAction = 'trim-up' | 'trim-down' | 'flaps-up' | 'flaps-down' | 'gear-toggle' | 'spoilers-toggle'
  | 'view-left' | 'view-right' | 'view-up' | 'view-down'
  | 'view-center' | 'view-zoom-in' | 'view-zoom-out';

export interface FlightTelemetry {
  rollDegrees: number | null;
  pitchDegrees: number | null;
  headingDegrees: number | null;
  magneticHeadingDegrees: number | null;
  indicatedAirspeedKnots: number | null;
  trueAirspeedKnots: number | null;
  groundSpeedKnots: number | null;
  altitudeFeet: number | null;
  aglFeet: number | null;
  verticalSpeedFpm: number | null;
  angleOfAttackDegrees: number | null;
  sideslipDegrees: number | null;
  rollRateDegreesPerSecond: number | null;
  pitchRateDegreesPerSecond: number | null;
  yawRateDegreesPerSecond: number | null;
  latitudeDegrees: number | null;
  longitudeDegrees: number | null;
  flightPathDegrees: number | null;
  machNumber: number | null;
  throttleRatio: number | null;
  flapRatio: number | null;
  // Lever request, actual deployment and configured positions are distinct.
  flapHandleRatio: number | null;
  flapDeployRatio: number | null;
  flapDetentCount: number | null;
  aircraftIcao: string | null;
  speedbrakeRatio: number | null;
  elevatorTrimRatio: number | null;
  gearHandleDown: number | null;
  autopilotServosOn: number | null;
  n1LeftPercent: number | null;
  n1RightPercent: number | null;
  // Readback, cockpit pilot input, and final merged controls are distinct.
  simJoystickRollRatio: number | null;
  simJoystickPitchRatio: number | null;
  cockpitYokeRollRatio: number | null;
  cockpitYokePitchRatio: number | null;
  effectiveRollRatio: number | null;
  effectivePitchRatio: number | null;
  rollOverrideState: number | null;
  pitchOverrideState: number | null;
  nativeCommandRollRatio: number | null;
  nativeCommandPitchRatio: number | null;
  rudderRatio: number | null;
  rudderOverrideState: number | null;
  leftBrakeRatio: number | null;
  rightBrakeRatio: number | null;
  wheelBrakeRatio: number | null;
  reverseHandleRatio: number | null;
  reverseActive: number | null;
  onGround: number | null;
  autothrottleOn: number | null;
  mouseYokeActive: number | null;
  mouseYokeHideAvailable: number | null;
  receivedAt: number | null;
}

// Reported by the C++ plugin. "none" means no ARM rejection was recorded.
export type NativeArmError =
  | 'none'
  | 'missing-roll-override' | 'missing-pitch-override'
  | 'missing-roll-input' | 'missing-pitch-input'
  | 'readonly-roll-override' | 'readonly-pitch-override'
  | 'readonly-roll-input' | 'readonly-pitch-input'
  | 'roll-override-busy' | 'pitch-override-busy' | 'autopilot-active';

// Native diagnostics are read-only and sampled from the X-Plane flight loop.
// feedbackRoundTripMs includes the telemetry reporting interval. It is NOT
// the one-way control or visual aircraft-response latency.
export interface NativeControlDiagnostics {
  loopHz: number | null;
  appliedFrames: number | null;
  skippedSequences: number | null;
  maximumInputGapMs: number | null;
  maximumApplyUs: number | null;
  controlAgeMs: number | null;
  lastAckSequence: number | null;
  feedbackRoundTripMs: number | null;
}

export interface SimulatorStatus {
  transport?: 'udp' | 'native';
  nativeArmed?: boolean | null;
  nativeArmError?: NativeArmError | null;
  nativeDiagnostics?: NativeControlDiagnostics | null;
  simPaused?: boolean | null;
  nativeInterrupted?: boolean | null;
  pauseOwned?: boolean | null;
  reachable: boolean;
  outputEnabled: boolean;
  host: string;
  port: number;
  telemetry: FlightTelemetry;
  telemetryFresh: boolean;
  lastHeartbeatAgeMs: number | null;
  receivedFields: number;
  subscribedFields: number;
}

export interface ControlMonitor {
  framesAccepted: number;
  lastFrameAgeMs: number | null;
  timeoutMs: number;
  inputRoll: number | null;
  inputPitch: number | null;
  tiltRollDegrees: number | null;
  tiltPitchDegrees: number | null;
  sensorRateHz: number | null;
  inputRateHz: number;
  lastAction: string | null;
  lastActionAt: number | null;
  throttleCommand: number | null;
  rudderCommand?: number | null;
  brakeCommand?: number | null;
  reverseCommand?: number | null;
}

export type ControlPhase = 'idle' | 'preview' | 'pending' | 'active' | 'unverified';

export interface RecordingStatus {
  active: boolean;
  samples: number;
  elapsedSeconds: number;
  maxBankDegrees: number | null;
  maxAbsoluteVerticalSpeedFpm: number | null;
  maxIasKnots: number | null;
  approachSamples: number;
  approachStabilityPercent: number | null;
  meanFeedbackRoundTripMs: number | null;
}
export interface ServerStatus {
  controlPhase: ControlPhase;
  armed: boolean;
  ownedByYou: boolean;
  simulator: SimulatorStatus;
  control: ControlMonitor;
  recording?: RecordingStatus;
}

export interface SocketMessage<T = unknown> {
  event: string;
  data: T;
}

export interface ArmRequest { pairingCode: string }
export interface ServerNotice { message: string; severity: 'info' | 'error' }
