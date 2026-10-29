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
  speedVsoKnots: number | null;
  speedVsKnots: number | null;
  speedVfeKnots: number | null;
  speedVnoKnots: number | null;
  speedVneKnots: number | null;
  selectedAltitudeFeet: number | null;
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
  gearDeploy0Ratio: number | null;
  gearDeploy1Ratio: number | null;
  gearDeploy2Ratio: number | null;
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
  normalLoadG: number | null;
  outsideAirTempC: number | null;
  n2LeftPercent: number | null;
  n2RightPercent: number | null;
  egtLeftC: number | null;
  egtRightC: number | null;
  fuelFlowLeftKgS: number | null;
  fuelFlowRightKgS: number | null;
  oilPressureLeftPsi: number | null;
  oilPressureRightPsi: number | null;
  grossWeightKg: number | null;
  fuelWeightKg: number | null;
  engineRunningLeft: number | null;
  engineRunningRight: number | null;
  selectedHeadingDegrees: number | null;
  selectedVerticalSpeedFpm: number | null;
  flightDirectorMode: number | null;
  autopilotHeadingMode: number | null;
  autopilotAltitudeMode: number | null;
  autopilotNavMode: number | null;
  autopilotApproachMode: number | null;
  navDeviationDots: number | null;
  glideslopeDeviationDots: number | null;
  electricalBusVolts: number | null;
  batteryVolts: number | null;
  generatorLeftOn: number | null;
  generatorRightOn: number | null;
  hydraulicPressure1Raw: number | null;
  hydraulicPressure2Raw: number | null;
  hydraulicFluid1Ratio: number | null;
  cabinAltitudeFeet: number | null;
  cabinDifferentialPsi: number | null;
  cabinVerticalSpeedFpm: number | null;
  pitotHeatOn: number | null;
  wingAntiIceOn: number | null;
  wingIceRatio: number | null;
  nativeRiskScore: number | null;
  nativeFlightPhase?: number | null;
  nativeHandlingRisk?: number | null;
  nativePropulsionRisk?: number | null;
  nativeSystemsRisk?: number | null;
  nativeApproachRisk?: number | null;
  nativeAlertFlags: number | null;
  nativeEventCount: number | null;
  nativeAnalysisSamples: number | null;
  nativeIasTrendKtMin: number | null;
  nativeAltitudeTrendFpm: number | null;
  nativeBankRmsDegrees: number | null;
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

export interface FlightAdvisoryEvent {
  id: number;
  at: number;
  flag: number;
  event: 'raised' | 'cleared';
}

export interface SimulatorStatus {
  transport?: 'udp' | 'native';
  nativeArmed?: boolean | null;
  nativeArmError?: NativeArmError | null;
  nativeDiagnostics?: NativeControlDiagnostics | null;
  advisoryEvents?: FlightAdvisoryEvent[];
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
