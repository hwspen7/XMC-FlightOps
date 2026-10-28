import { Injectable } from '@nestjs/common';
import type { AuxiliaryAction, ControlFrame } from '@xplane/shared';
import { isAuxiliaryAction } from '../xplane/commands';
import { XPlaneService } from '../xplane/xplane.service';

export const TIMEOUT_MS = 350;

export function validateFrame(value: unknown): value is ControlFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as Partial<ControlFrame>;
  return Number.isSafeInteger(frame.sequence) && frame.sequence! >= 0 &&
    typeof frame.roll === 'number' && Number.isFinite(frame.roll) && Math.abs(frame.roll) <= 1 &&
    typeof frame.pitch === 'number' && Number.isFinite(frame.pitch) && Math.abs(frame.pitch) <= 1 &&
    (frame.sensorRateHz === undefined || (Number.isFinite(frame.sensorRateHz) && frame.sensorRateHz >= 0 && frame.sensorRateHz <= 240)) &&
    (frame.tiltRollDegrees === undefined || (Number.isFinite(frame.tiltRollDegrees) && Math.abs(frame.tiltRollDegrees) <= 360)) &&
    (frame.tiltPitchDegrees === undefined || (Number.isFinite(frame.tiltPitchDegrees) && Math.abs(frame.tiltPitchDegrees) <= 360));
}

@Injectable()
export class ControlService {
  private owner: object | null = null;
  private armIssuedAt = 0;
  private nativeConfirmed = false;
  private lastFrameAt = 0;
  private lastAcceptedAt = 0;
  private sequence = -1;
  private framesAccepted = 0;
  private lastInput: ControlFrame | null = null;
  private rateWindowStart = Date.now();
  private rateCount = 0;
  private inputRateHz = 0;
  private lastAction: string | null = null;
  private lastActionAt: number | null = null;
  private throttleCommand: number | null = null;
  private lastThrottleAt = 0;
  private lastAuxAt = 0;

  constructor(private readonly simulator: XPlaneService) {}

  metrics() {
    return {
      framesAccepted: this.framesAccepted,
      lastFrameAgeMs: this.lastAcceptedAt ? Math.max(0, Date.now() - this.lastAcceptedAt) : null,
      timeoutMs: TIMEOUT_MS,
      inputRoll: this.owner ? this.lastInput?.roll ?? null : null,
      inputPitch: this.owner ? this.lastInput?.pitch ?? null : null,
      tiltRollDegrees: this.owner ? this.lastInput?.tiltRollDegrees ?? null : null,
      tiltPitchDegrees: this.owner ? this.lastInput?.tiltPitchDegrees ?? null : null,
      sensorRateHz: this.owner ? this.lastInput?.sensorRateHz ?? null : null,
      inputRateHz: this.owner && Date.now() - this.lastFrameAt < 1000 ? this.inputRateHz : 0,
      lastAction: this.lastAction,
      lastActionAt: this.lastActionAt,
      throttleCommand: this.throttleCommand,
    };
  }

  isArmed(): boolean { return this.owner !== null; }
  currentOwner(): object | null { return this.owner; }
  isOwner(client: object): boolean { return this.owner === client; }

  arm(client: object): boolean {
    if (this.owner) return this.owner === client;
    this.owner = client;
    this.armIssuedAt = Date.now();
    this.nativeConfirmed = false;
    this.sequence = -1;
    this.lastAcceptedAt = 0;
    this.lastInput = null;
    this.rateWindowStart = Date.now();
    this.rateCount = 0;
    this.inputRateHz = 0;
    this.lastFrameAt = Date.now();
    this.simulator.activate();
    return true;
  }

  accept(client: object, value: unknown): boolean {
    if (!this.isOwner(client) || !validateFrame(value)) return false;
    if (value.sequence <= this.sequence) return false;
    this.sequence = value.sequence;
    this.lastFrameAt = Date.now();
    this.framesAccepted++;
    this.rateCount++;
    if (this.lastFrameAt - this.rateWindowStart >= 1000) {
      this.inputRateHz = Math.round(this.rateCount * 1000 / (this.lastFrameAt - this.rateWindowStart));
      this.rateCount = 0;
      this.rateWindowStart = this.lastFrameAt;
    }
    this.lastInput = value;
    this.lastAcceptedAt = this.lastFrameAt;
    this.simulator.update(value.roll, value.pitch);
    return true;
  }

  throttle(client: object, value: unknown): boolean {
    if (!this.isOwner(client) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return false;
    if (Date.now() - this.lastThrottleAt < 80) return false;
    this.lastThrottleAt = Date.now();
    if (!this.simulator.throttle(value)) return false;
    this.throttleCommand = value;
    this.lastAction = 'throttle';
    this.lastActionAt = Date.now();
    return true;
  }

  auxiliary(client: object, action: unknown): boolean {
    if (!this.isOwner(client) || !isAuxiliaryAction(action)) return false;
    if (Date.now() - this.lastAuxAt < 200) return false;
    this.lastAuxAt = Date.now();
    if (!this.simulator.action(action as AuxiliaryAction)) return false;
    this.lastAction = action;
    this.lastActionAt = Date.now();
    return true;
  }

  disarm(client?: object): boolean {
    if (!this.owner || (client && this.owner !== client)) return false;
    this.owner = null;
    this.armIssuedAt = 0;
    this.nativeConfirmed = false;
    this.sequence = -1;
    this.lastFrameAt = 0;
    this.lastAcceptedAt = 0;
    this.lastInput = null;
    this.inputRateHz = 0;
    this.throttleCommand = null;
    this.simulator.deactivate();
    return true;
  }

  /**
   * WebSocket pairing is not proof that the native plugin owns the flight axes.
   * Fail closed if ARM is not acknowledged or if an acknowledged override is lost.
   */
  checkNativeAuthority(now = Date.now()): 'unconfirmed' | 'lost' | null {
    if (!this.owner) return null;
    const state = this.simulator.status();
    if (!state.outputEnabled || state.transport !== 'native') return null;
    if (state.reachable && state.nativeArmed === true) {
      this.nativeConfirmed = true;
      return null;
    }
    if (this.nativeConfirmed) {
      this.disarm();
      return 'lost';
    }
    if (now - this.armIssuedAt >= 900) {
      this.disarm();
      return 'unconfirmed';
    }
    return null;
  }

  checkTimeout(now = Date.now()): boolean {
    if (!this.owner || now - this.lastFrameAt < TIMEOUT_MS) return false;
    this.disarm();
    return true;
  }
}
