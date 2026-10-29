import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createSocket, type Socket } from 'node:dgram';
import type { AuxiliaryAction, FlightAdvisoryEvent, FlightTelemetry, NativeArmError, NativeControlDiagnostics, SimulatorStatus } from '@xplane/shared';
import { settings } from '../configuration/settings';
import { emptyTelemetry } from '../xplane/telemetry';
import {
  NATIVE_FIELDS, encodeNativeAction, encodeNativeArm, encodeNativeControl,
  encodeNativeDisarm, encodeNativeResume, encodeNativeSuspend, encodeNativeThrottle, encodeNativePedal, parseNativeTelemetry,
} from './native-protocol';

@Injectable()
export class NativeBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NativeBridgeService.name);
  private readonly socket: Socket = createSocket('udp4');
  private started = false;
  private lastTelemetryAt = 0;
  private lastReport: FlightTelemetry = emptyTelemetry();
  private latestFields = 0;
  private armedReported = false;
  private armErrorReported: NativeArmError | null = null;
  private sequence = 0;
  private lastMetrics: NativeControlDiagnostics | null = null;
  private readonly pendingControlFrames = new Map<number, bigint>();
  private feedbackRoundTripMs: number | null = null;
  private feedbackMeasuredAt = 0;
  private lastAckSequence = -1;
  private lastPause: { simPaused: boolean; nativeInterrupted: boolean; pauseOwned: boolean } | null = null;
  private previousAlertFlags: number | null = null;
  private readonly advisoryEvents: FlightAdvisoryEvent[] = [];
  private advisorySequence = 0;

  onModuleInit(): void {
    if (settings.transport !== 'native') return;
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(settings.nativeToken) ||
        settings.nativeToken.startsWith('REPLACE_WITH')) {
      throw new Error('Native transport requires NATIVE_SHARED_TOKEN (16-128 letters, digits, _ or -)');
    }
    this.socket.on('error', (error) => this.logger.warn(`Native UDP socket: ${error.message}`));
    this.socket.on('message', (packet, source) => {
      if (source.address !== settings.xplaneHost || source.port !== settings.nativePluginPort) return;
      const decoded = parseNativeTelemetry(packet, settings.nativeToken);
      if (!decoded) return;
      const now = Date.now();
      this.lastTelemetryAt = now;
      this.armedReported = decoded.armed;
      this.armErrorReported = decoded.armError;
      this.lastPause = decoded.pause ?? null;
      if (!decoded.armed) {
        this.pendingControlFrames.clear();
        this.lastAckSequence = -1;
        this.feedbackRoundTripMs = null;
        this.feedbackMeasuredAt = 0;
      }
      const mask = decoded.values.nativeAlertFlags;
      if (mask !== undefined && mask !== null && Number.isInteger(mask)) {
        const changed = this.previousAlertFlags === null ? mask : this.previousAlertFlags ^ mask;
        for (let i = 0; i < 11; ++i) {
          if (changed & (1 << i)) {
            this.advisoryEvents.unshift({ id: ++this.advisorySequence, at: now, flag: i,
              event: mask & (1 << i) ? 'raised' : 'cleared' });
          }
        }
        this.advisoryEvents.length = Math.min(this.advisoryEvents.length, 150);
        this.previousAlertFlags = mask;
      } else { this.previousAlertFlags = null; }
      this.latestFields = Object.keys(decoded.values).length;
      if (decoded.metrics) {
        const metrics = decoded.metrics;
        const ack = metrics.lastAckSequence;
        if (decoded.armed && ack !== undefined && ack > this.lastAckSequence) {
          this.lastAckSequence = ack;
          const sentAt = this.pendingControlFrames.get(ack);
          if (sentAt !== undefined) {
            // One monotonic Node.js clock measures send -> C++ telemetry feedback.
            // The native plugin reports an acknowledgement in its next 10 Hz
            // telemetry sample, so this is NOT actual one-way input latency.
            const elapsed = Number(process.hrtime.bigint() - sentAt) / 1_000_000;
            this.feedbackRoundTripMs = Math.round(elapsed * 10) / 10;
            this.feedbackMeasuredAt = now;
          }
          for (const sequence of this.pendingControlFrames.keys()) {
            if (sequence <= ack) this.pendingControlFrames.delete(sequence);
          }
        }
        this.lastMetrics = {
          loopHz: metrics.loopHz ?? null,
          appliedFrames: metrics.appliedFrames ?? null,
          skippedSequences: metrics.skippedSequences ?? null,
          maximumInputGapMs: metrics.maximumInputGapMs ?? null,
          maximumApplyUs: metrics.maximumApplyUs ?? null,
          controlAgeMs: metrics.controlAgeMs ?? null,
          lastAckSequence: metrics.lastAckSequence ?? null,
          feedbackRoundTripMs: this.feedbackMeasuredAt && now - this.feedbackMeasuredAt < 2000
            ? this.feedbackRoundTripMs : null,
        };
      } else {
        this.lastMetrics = null; // Compatible with older C++ plugin versions.
      }
      // Every native sample is a complete snapshot. Unsupported datarefs remain null.
      this.lastReport = { ...emptyTelemetry(), ...decoded.values, receivedAt: now };
    });
    this.socket.bind(settings.nativeListenPort, settings.nativeListenHost);
    this.started = true;
    this.logger.log(`Native transport listening at ${settings.nativeListenHost}:${settings.nativeListenPort}`);
  }

  status(): SimulatorStatus {
    const now = Date.now();
    const age = this.lastTelemetryAt ? now - this.lastTelemetryAt : null;
    const reachable = age !== null && age < 2000;
    return {
      reachable,
      transport: 'native',
      advisoryEvents: this.advisoryEvents,
      nativeArmed: reachable ? this.armedReported : null,
      nativeArmError: reachable ? this.armErrorReported : null,
      simPaused: reachable ? this.lastPause?.simPaused ?? null : null,
      nativeInterrupted: reachable ? this.lastPause?.nativeInterrupted ?? null : null,
      pauseOwned: reachable ? this.lastPause?.pauseOwned ?? null : null,
      nativeDiagnostics: reachable && this.lastMetrics ? {
        ...this.lastMetrics,
        feedbackRoundTripMs: this.feedbackMeasuredAt && now - this.feedbackMeasuredAt < 2000
          ? this.feedbackRoundTripMs : null,
      } : null,
      outputEnabled: settings.outputEnabled,
      host: settings.xplaneHost,
      port: settings.nativePluginPort,
      telemetry: reachable ? this.lastReport : emptyTelemetry(),
      telemetryFresh: reachable,
      lastHeartbeatAgeMs: age,
      receivedFields: reachable ? this.latestFields : 0,
      subscribedFields: NATIVE_FIELDS.length,
    };
  }

  activate(): void {
    if (!this.status().reachable || !settings.outputEnabled) return;
    this.sequence = 0;
    this.lastAckSequence = -1;
    this.feedbackRoundTripMs = null;
    this.feedbackMeasuredAt = 0;
    this.lastMetrics = null;
    this.pendingControlFrames.clear();
    this.send(encodeNativeArm(settings.nativeToken));
  }

  update(roll: number, pitch: number): void {
    if (!settings.outputEnabled || !this.status().reachable) return;
    const sequence = this.sequence++;
    this.pendingControlFrames.set(sequence, process.hrtime.bigint());
    // Bounded memory even if the simulator stops returning acknowledgements.
    if (this.pendingControlFrames.size > 128) {
      const oldest = this.pendingControlFrames.keys().next().value;
      if (oldest !== undefined) this.pendingControlFrames.delete(oldest);
    }
    this.send(encodeNativeControl(settings.nativeToken, sequence, roll, pitch));
  }

  deactivate(): void {
    if (!settings.outputEnabled) return;
    this.pendingControlFrames.clear();
    this.lastMetrics = null;
    this.feedbackRoundTripMs = null;
    this.feedbackMeasuredAt = 0;
    this.lastAckSequence = -1;
    // Redundant messages reduce the chance that a single lost datagram delays release.
    this.send(encodeNativeDisarm(settings.nativeToken));
    this.send(encodeNativeDisarm(settings.nativeToken));
  }

  suspend(): void {
    if (!settings.outputEnabled) return;
    this.pendingControlFrames.clear();
    this.lastAckSequence = -1;
    // Background-page messages can be lost. The independent native watchdog
    // pauses when control frames stop even if both SUSPEND packets are lost.
    this.send(encodeNativeSuspend(settings.nativeToken));
    this.send(encodeNativeSuspend(settings.nativeToken));
  }

  resume(): boolean {
    const status = this.status();
    if (!settings.outputEnabled || !status.reachable || status.nativeArmed !== true ||
        status.simPaused !== true || status.nativeInterrupted !== true || status.pauseOwned !== true) return false;
    this.send(encodeNativeResume(settings.nativeToken));
    return true;
  }

  throttle(ratio: number): boolean {
    if (!settings.outputEnabled || !this.status().reachable || !this.armedReported) return false;
    this.send(encodeNativeThrottle(settings.nativeToken, ratio));
    return true;
  }

  pedal(action: 'rudder' | 'brakes' | 'reverse', value: number): boolean {
    if (!settings.outputEnabled || !this.status().reachable || !this.armedReported) return false;
    this.send(encodeNativePedal(settings.nativeToken, action, value));
    return true;
  }

  action(action: AuxiliaryAction): boolean {
    if (!settings.outputEnabled || !this.status().reachable || !this.armedReported) return false;
    this.send(encodeNativeAction(settings.nativeToken, action));
    return true;
  }

  private send(buffer: Buffer): void {
    if (!this.started) return;
    this.socket.send(buffer, settings.nativePluginPort, settings.xplaneHost);
  }

  onModuleDestroy(): void {
    if (!this.started) return;
    this.deactivate();
    this.socket.close();
    this.started = false;
  }
}
