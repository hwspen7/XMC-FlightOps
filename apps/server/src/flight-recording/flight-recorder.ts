import type { ControlMonitor, RecordingStatus, SimulatorStatus } from '@xplane/shared';

const LIMIT = 18_000; // 30 minutes at 10 Hz. Bounded, no persistent personal telemetry.
const COLUMNS = [
  'timeIso', 'elapsedMs', 'iasKt', 'groundSpeedKt', 'altitudeFt', 'aglFt', 'vsiFpm',
  'bankDeg', 'pitchDeg', 'headingDeg', 'inputRoll', 'inputPitch', 'rudder', 'brakes',
  'throttle', 'reverse', 'apServos', 'simPaused', 'nativeArmed', 'feedbackRttMs',
] as const;
type Sample = Record<(typeof COLUMNS)[number], string | number | null>;
const finite = (v: number | null | undefined): number | null => v !== null && v !== undefined && Number.isFinite(v) ? v : null;
export class FlightRecorder {
  private rows: Sample[] = [];
  private active = false;
  private startedAt = 0;
  private nextSampleAt = 0;
  private feedbackSum = 0;
  private feedbackCount = 0;
  private maxBank: number | null = null;
  private maxVsi: number | null = null;
  private maxIas: number | null = null;
  private approachGood = 0;
  private approachTotal = 0;

  start(now = Date.now()): void {
    this.rows = []; this.active = true; this.startedAt = now; this.nextSampleAt = now;
    this.feedbackSum = 0; this.feedbackCount = 0;
    this.maxBank = null; this.maxVsi = null; this.maxIas = null;
    this.approachGood = 0; this.approachTotal = 0;
  }
  stop(): void { this.active = false; }
  capture(sim: SimulatorStatus, control: ControlMonitor, now = Date.now()): void {
    if (!this.active || now < this.nextSampleAt) return;
    if (!sim.telemetryFresh || !sim.reachable) return;
    if (this.rows.length >= LIMIT) { this.active = false; return; }
    this.nextSampleAt = now + 100;
    const t = sim.telemetry;
    const feedback = finite(sim.nativeDiagnostics?.feedbackRoundTripMs);
    if (feedback !== null) { this.feedbackSum += feedback; this.feedbackCount++; }
    if (t.rollDegrees !== null) this.maxBank = Math.max(this.maxBank ?? 0, Math.abs(t.rollDegrees));
    if (t.verticalSpeedFpm !== null) this.maxVsi = Math.max(this.maxVsi ?? 0, Math.abs(t.verticalSpeedFpm));
    if (t.indicatedAirspeedKnots !== null) this.maxIas = Math.max(this.maxIas ?? 0, t.indicatedAirspeedKnots);
    // Informational approach heuristic, not an aircraft-specific stabilized-approach certification.
    if (t.aglFeet !== null && t.aglFeet >= 100 && t.aglFeet <= 1000 &&
        t.indicatedAirspeedKnots !== null && t.indicatedAirspeedKnots >= 60 &&
        t.rollDegrees !== null && t.verticalSpeedFpm !== null) {
      this.approachTotal++;
      if (Math.abs(t.rollDegrees) <= 10 && Math.abs(t.verticalSpeedFpm) <= 1000) this.approachGood++;
    }
    this.rows.push({
      timeIso: new Date(now).toISOString(), elapsedMs: now - this.startedAt,
      iasKt: finite(t.indicatedAirspeedKnots), groundSpeedKt: finite(t.groundSpeedKnots),
      altitudeFt: finite(t.altitudeFeet), aglFt: finite(t.aglFeet), vsiFpm: finite(t.verticalSpeedFpm),
      bankDeg: finite(t.rollDegrees), pitchDeg: finite(t.pitchDegrees), headingDeg: finite(t.headingDegrees),
      inputRoll: finite(control.inputRoll), inputPitch: finite(control.inputPitch),
      rudder: finite(t.rudderRatio), brakes: finite(t.wheelBrakeRatio), throttle: finite(t.throttleRatio),
      reverse: finite(t.reverseHandleRatio), apServos: finite(t.autopilotServosOn),
      simPaused: sim.simPaused === true ? 1 : sim.simPaused === false ? 0 : null,
      nativeArmed: sim.nativeArmed === true ? 1 : sim.nativeArmed === false ? 0 : null,
      feedbackRttMs: feedback,
    });
  }
  status(now = Date.now()): RecordingStatus {
    return {
      active: this.active, samples: this.rows.length,
      elapsedSeconds: this.startedAt ? Math.round(((this.active ? now : (this.rows.at(-1)?.elapsedMs as number | undefined ?? 0) + this.startedAt) - this.startedAt) / 1000) : 0,
      maxBankDegrees: this.maxBank,
      maxAbsoluteVerticalSpeedFpm: this.maxVsi,
      maxIasKnots: this.maxIas,
      approachSamples: this.approachTotal,
      approachStabilityPercent: this.approachTotal ? Math.round(100 * this.approachGood / this.approachTotal) : null,
      meanFeedbackRoundTripMs: this.feedbackCount ? Math.round(this.feedbackSum / this.feedbackCount) : null,
    };
  }
  csv(): string {
    const escape = (value: string | number | null): string => {
      if (value === null) return '';
      const text = String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    return [COLUMNS.join(','), ...this.rows.map(row => COLUMNS.map(column => escape(row[column])).join(','))].join('\r\n') + '\r\n';
  }
}
