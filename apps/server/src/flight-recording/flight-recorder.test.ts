import { describe, expect, it } from 'vitest';
import { FlightRecorder } from './flight-recorder';
import { emptyTelemetry } from '../xplane/telemetry';
import type { ControlMonitor, SimulatorStatus } from '@xplane/shared';
const control: ControlMonitor = { framesAccepted: 1, lastFrameAgeMs: 0, timeoutMs: 350,
  inputRoll: 0.2, inputPitch: -0.1, tiltRollDegrees: 10, tiltPitchDegrees: 5,
  sensorRateHz: 60, inputRateHz: 60, lastAction: null, lastActionAt: null, throttleCommand: null };
const sim: SimulatorStatus = { reachable: true, transport: 'native', outputEnabled: true,
  host: '127.0.0.1', port: 49051, telemetryFresh: true,
  lastHeartbeatAgeMs: 0, receivedFields: 1, subscribedFields: 1,
  nativeArmed: true, simPaused: false,
  telemetry: { ...emptyTelemetry(), rollDegrees: -12, verticalSpeedFpm: -440, indicatedAirspeedKnots: 125 } };
describe('bounded session flight recorder', () => {
 it('samples only every 100ms and exports normalized CSV', () => {
   const recorder = new FlightRecorder(); recorder.start(1000);
   recorder.capture(sim, control, 1000); recorder.capture(sim, control, 1010);
   recorder.capture(sim, control, 1100);
   expect(recorder.status(1200).samples).toBe(2);
   expect(recorder.status(1200).maxBankDegrees).toBe(12);
   expect(recorder.status(1200).maxAbsoluteVerticalSpeedFpm).toBe(440);
   recorder.stop(); expect(recorder.csv()).toContain('"-12"');
   expect(recorder.status(1200).active).toBe(false);
 });
 it('does not record offline data', () => { const recorder = new FlightRecorder(); recorder.start(1000);
   recorder.capture({ ...sim, reachable: false }, control, 1000); expect(recorder.status().samples).toBe(0); });
});
