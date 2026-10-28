import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createSocket, type Socket } from 'node:dgram';
import type { AuxiliaryAction, FlightTelemetry, NativeArmError, SimulatorStatus } from '@xplane/shared';
import { settings } from '../configuration/settings';
import { emptyTelemetry } from '../xplane/telemetry';
import {
  NATIVE_FIELDS, encodeNativeAction, encodeNativeArm, encodeNativeControl,
  encodeNativeDisarm, encodeNativeThrottle, parseNativeTelemetry,
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
      this.latestFields = Object.keys(decoded.values).length;
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
      nativeArmed: reachable ? this.armedReported : null,
      nativeArmError: reachable ? this.armErrorReported : null,
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
    this.send(encodeNativeArm(settings.nativeToken));
  }

  update(roll: number, pitch: number): void {
    if (!settings.outputEnabled || !this.status().reachable) return;
    this.send(encodeNativeControl(settings.nativeToken, this.sequence++, roll, pitch));
  }

  deactivate(): void {
    if (!settings.outputEnabled) return;
    // Redundant messages reduce the chance that a single lost datagram delays release.
    this.send(encodeNativeDisarm(settings.nativeToken));
    this.send(encodeNativeDisarm(settings.nativeToken));
  }

  throttle(ratio: number): boolean {
    if (!settings.outputEnabled || !this.status().reachable || !this.armedReported) return false;
    this.send(encodeNativeThrottle(settings.nativeToken, ratio));
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
