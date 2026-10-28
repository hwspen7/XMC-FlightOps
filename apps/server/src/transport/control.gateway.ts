import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { ArmRequest, ServerNotice, ServerStatus, SocketMessage } from '@xplane/shared';
import { Server, WebSocket } from 'ws';
import { ControlService } from '../control/control.service';
import { settings } from '../configuration/settings';
import { XPlaneService } from '../xplane/xplane.service';
import { controlPhase } from './control-phase';

@WebSocketGateway({ path: '/control' })
export class ControlGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(ControlGateway.name);
  private readonly clock = setInterval(() => this.tick(), 100);
  private lastStatusAt = 0;
  private readonly attempts = new WeakMap<WebSocket, { count: number; windowStart: number }>();

  @WebSocketServer() server!: Server;

  constructor(
    private readonly control: ControlService,
    private readonly simulator: XPlaneService,
  ) {}

  handleConnection(client: WebSocket): void {
    this.sendStatus(client);
  }

  handleDisconnect(client: WebSocket): void {
    if (this.control.disarm(client)) this.broadcastStatus();
  }

  @SubscribeMessage('arm')
  onArm(@ConnectedSocket() client: WebSocket, @MessageBody() data: ArmRequest): void {
    const now = Date.now();
    const previous = this.attempts.get(client);
    const attempts = previous && now - previous.windowStart < 60_000
      ? previous : { count: 0, windowStart: now };
    attempts.count++;
    this.attempts.set(client, attempts);
    if (attempts.count > 5) {
      this.notice(client, 'Too many pairing attempts. Try again shortly.', 'error');
      return;
    }
    if (!data || typeof data.pairingCode !== 'string' || data.pairingCode !== settings.pairingCode) {
      this.notice(client, 'Invalid pairing code', 'error');
      return;
    }
    if (settings.outputEnabled && !this.simulator.status().reachable) {
      this.notice(client, 'X-Plane has not responded to the simulator probe', 'error');
      return;
    }
    if (!this.control.arm(client)) {
      this.notice(client, 'Another controller is already armed', 'error');
      return;
    }
    this.logger.log('Controller armed');
    this.broadcastStatus();
  }

  @SubscribeMessage('control')
  onFrame(@ConnectedSocket() client: WebSocket, @MessageBody() data: unknown): void {
    this.control.accept(client, data);
  }

  @SubscribeMessage('throttle')
  onThrottle(@ConnectedSocket() client: WebSocket, @MessageBody() value: unknown): void {
    if (!this.control.throttle(client, value)) this.notice(client, 'Throttle command not accepted. Check arm and simulator output.', 'error');
  }

  @SubscribeMessage('auxiliary')
  onAuxiliary(@ConnectedSocket() client: WebSocket, @MessageBody() action: unknown): void {
    if (!this.control.auxiliary(client, action)) this.notice(client, 'Flight control command not accepted.', 'error');
  }

  @SubscribeMessage('disarm')
  onDisarm(@ConnectedSocket() client: WebSocket): void {
    if (this.control.disarm(client)) {
      this.logger.log('Controller disarmed');
      this.broadcastStatus();
    }
  }

  private tick(): void {
    if (this.control.checkTimeout()) {
      this.logger.warn('Controller timed out; simulator override released');
      this.broadcastStatus();
    }
    const owner = this.control.currentOwner();
    const authorityFailure = this.control.checkNativeAuthority();
    if (authorityFailure) {
      const nativeError = this.simulator.status().nativeArmError;
      const reason = nativeError && nativeError !== 'none' ? nativeError : null;
      this.logger.warn(authorityFailure === 'lost'
        ? 'Native control authority was lost; controller disarmed'
        : `Native plugin did not confirm ARM; controller disarmed${reason ? ` (${reason})` : ' (no C++ rejection reason reported)'}`);
      if (owner instanceof WebSocket) {
        const detail = reason ? ` C++ reason: ${reason}.` : ' Check X-Plane Log.txt for native ARM diagnostics.';
        this.notice(owner, authorityFailure === 'lost'
          ? 'X-Plane released control authority. Recenter and arm again.'
          : `X-Plane did not accept control.${detail}`, 'error');
      }
      this.broadcastStatus();
    }
    if (Date.now() - this.lastStatusAt > (this.simulator.status().reachable ? 150 : 1000)) {
      this.lastStatusAt = Date.now();
      this.broadcastStatus();
    }
  }

  private sendStatus(client: WebSocket): void {
    const simulator = this.simulator.status();
    this.send(client, 'status', {
      armed: this.control.isArmed(),
      ownedByYou: this.control.isOwner(client),
      simulator,
      controlPhase: controlPhase(this.control.isArmed(), simulator),
      control: this.control.metrics(),
    } satisfies ServerStatus);
  }

  private broadcastStatus(): void {
    if (!this.server) return;
    for (const client of this.server.clients) this.sendStatus(client);
  }

  private notice(client: WebSocket, message: string, severity: ServerNotice['severity']): void {
    this.send(client, 'notice', { message, severity } satisfies ServerNotice);
  }

  private send<T>(client: WebSocket, event: string, data: T): void {
    if (client.readyState !== WebSocket.OPEN) return;
    const message: SocketMessage<T> = { event, data };
    client.send(JSON.stringify(message));
  }

  onModuleDestroy(): void {
    clearInterval(this.clock);
    this.control.disarm();
  }
}
