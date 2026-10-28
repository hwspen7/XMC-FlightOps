import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createSocket, type Socket } from 'node:dgram';
import { isIP } from 'node:net';
import type { AuxiliaryAction, FlightTelemetry, SimulatorStatus } from '@xplane/shared';
import { settings } from '../configuration/settings';
import { NativeBridgeService } from '../native/native-bridge.service';
import { COMMAND_PATHS, encodeCommand } from './commands';
import { decodeSubscriptions, encodeDataref, encodeSubscription } from './packets';
import { applyTelemetryValue, definitionForIndex, emptyTelemetry, TELEMETRY_DEFINITIONS } from './telemetry';

const HEARTBEAT_INDEX = 2843;
const HEARTBEAT_DATAREF = 'sim/time/total_running_time_sec';
const OVERRIDE_DATAREF = 'sim/operation/override/override_joystick';
const ROLL_DATAREF = 'sim/joystick/yoke_roll_ratio';
const PITCH_DATAREF = 'sim/joystick/yoke_pitch_ratio';
const THROTTLE_DATAREF = 'sim/cockpit2/engine/actuators/throttle_ratio_all';

@Injectable()
export class XPlaneService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XPlaneService.name);
  private readonly socket: Socket = createSocket('udp4');
  private lastHeartbeat = 0;
  private telemetry: FlightTelemetry = emptyTelemetry();
  private readonly fieldReceivedAt: Record<string, number> = {};
  private probeTimer: ReturnType<typeof setInterval> | undefined;
  private active = false;
  private legacyStarted = false;

  constructor(private readonly native: NativeBridgeService) {}

  onModuleInit(): void {
    if (settings.transport === 'native') {
      this.logger.log('Using native X-Plane plugin transport; legacy UDP injection disabled');
      return;
    }
    this.legacyStarted = true;
    this.socket.on('error', (error) => this.logger.warn(`UDP socket error: ${error.message}`));
    this.socket.on('message', (packet, source) => {
      if (source.port !== settings.xplanePort) return;
      if (isIP(settings.xplaneHost) && source.address !== settings.xplaneHost) return;
      for (const response of decodeSubscriptions(packet)) {
        if (!Number.isFinite(response.value)) continue;
        if (response.index === HEARTBEAT_INDEX) this.lastHeartbeat = Date.now();
        else {
          const definition = definitionForIndex(response.index);
          if (!definition) continue;
          const receivedAt = Date.now();
          this.telemetry = applyTelemetryValue(this.telemetry, response.index, response.value, receivedAt);
          this.fieldReceivedAt[definition.key] = receivedAt;
        }
      }
    });
    this.socket.bind(0);
    if (settings.probeEnabled) {
      this.probeTimer = setInterval(() => this.probe(), 2500);
      this.probe();
    }
    if (!settings.outputEnabled) this.logger.warn('X-Plane control output is disabled');
  }

  status(): SimulatorStatus {
    if (settings.transport === 'native') return this.native.status();
    const now = Date.now();
    const reachable = this.lastHeartbeat !== 0 && now - this.lastHeartbeat < 5500;
    const recentTelemetry = this.telemetry.receivedAt !== null && now - this.telemetry.receivedAt < 2000;
    const telemetry = reachable && recentTelemetry ? { ...this.telemetry } : emptyTelemetry();
    let receivedFields = 0;
    if (reachable && recentTelemetry) {
      for (const definition of TELEMETRY_DEFINITIONS) {
        if (now - (this.fieldReceivedAt[definition.key] ?? 0) > 2000) telemetry[definition.key] = null;
        else receivedFields++;
      }
    }
    return {
      reachable, transport: 'udp', outputEnabled: settings.outputEnabled, host: settings.xplaneHost, port: settings.xplanePort,
      telemetry, telemetryFresh: reachable && recentTelemetry, lastHeartbeatAgeMs: this.lastHeartbeat ? now - this.lastHeartbeat : null,
      receivedFields, subscribedFields: TELEMETRY_DEFINITIONS.length,
    };
  }

  activate(): void {
    if (this.active || !settings.outputEnabled) return;
    if (settings.transport === 'native') {
      this.active = true;
      this.native.activate();
      return;
    }
    this.active = true;
    this.send(OVERRIDE_DATAREF, 1);
    this.send(ROLL_DATAREF, 0);
    this.send(PITCH_DATAREF, 0);
  }

  update(roll: number, pitch: number): void {
    if (!this.active || !settings.outputEnabled) return;
    if (settings.transport === 'native') { this.native.update(roll, pitch); return; }
    this.send(OVERRIDE_DATAREF, 1);
    this.send(ROLL_DATAREF, roll);
    this.send(PITCH_DATAREF, pitch);
  }

  throttle(ratio: number): boolean {
    if (settings.transport === 'native') return this.active && this.native.throttle(ratio);
    if (!this.active || !settings.outputEnabled || !this.status().reachable) return false;
    this.send(THROTTLE_DATAREF, ratio);
    return true;
  }

  action(action: AuxiliaryAction): boolean {
    if (settings.transport === 'native') return this.active && this.native.action(action);
    if (!this.active || !settings.outputEnabled || !this.status().reachable) return false;
    this.socket.send(encodeCommand(COMMAND_PATHS[action]), settings.xplanePort, settings.xplaneHost);
    return true;
  }

  deactivate(): void {
    if (!this.active) return;
    if (settings.transport === 'native') { this.native.deactivate(); this.active = false; return; }
    this.send(ROLL_DATAREF, 0);
    this.send(PITCH_DATAREF, 0);
    this.send(OVERRIDE_DATAREF, 0);
    this.active = false;
  }

  private probe(): void {
    this.socket.send(encodeSubscription(HEARTBEAT_DATAREF, 2, HEARTBEAT_INDEX), settings.xplanePort, settings.xplaneHost);
    for (const item of TELEMETRY_DEFINITIONS) {
      this.socket.send(encodeSubscription(item.path, item.frequency, item.index), settings.xplanePort, settings.xplaneHost);
    }
  }

  private send(path: string, value: number): void {
    this.socket.send(encodeDataref(path, value), settings.xplanePort, settings.xplaneHost);
  }

  onModuleDestroy(): void {
    if (!this.legacyStarted) return;
    if (this.probeTimer) clearInterval(this.probeTimer);
    this.deactivate();
    if (settings.probeEnabled) {
      const subscriptions = [{ path: HEARTBEAT_DATAREF, index: HEARTBEAT_INDEX }, ...TELEMETRY_DEFINITIONS];
      for (const item of subscriptions) this.socket.send(encodeSubscription(item.path, 0, item.index), settings.xplanePort, settings.xplaneHost);
    }
    this.socket.close();
  }
}
