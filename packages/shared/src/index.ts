export type ControlMode = 'yoke' | 'sidestick';

export interface ControlFrame {
  sequence: number;
  roll: number;
  pitch: number;
  sensorRateHz?: number;
  tiltRollDegrees?: number;
  tiltPitchDegrees?: number;
}

export type AuxiliaryAction = 'trim-up' | 'trim-down' | 'flaps-up' | 'flaps-down' | 'gear-toggle' | 'spoilers-toggle';

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
  speedbrakeRatio: number | null;
  elevatorTrimRatio: number | null;
  gearHandleDown: number | null;
  autopilotServosOn: number | null;
  n1LeftPercent: number | null;
  n1RightPercent: number | null;
  receivedAt: number | null;
}

export interface SimulatorStatus {
  transport?: 'udp' | 'native';
  nativeArmed?: boolean | null;
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
}

export interface ServerStatus {
  armed: boolean;
  ownedByYou: boolean;
  simulator: SimulatorStatus;
  control: ControlMonitor;
}

export interface SocketMessage<T = unknown> {
  event: string;
  data: T;
}

export interface ArmRequest { pairingCode: string }
export interface ServerNotice { message: string; severity: 'info' | 'error' }
