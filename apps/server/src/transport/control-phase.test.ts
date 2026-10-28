import { describe, expect, it } from 'vitest';
import type { SimulatorStatus } from '@xplane/shared';
import { controlPhase } from './control-phase';

const simulator = (overrides: Partial<SimulatorStatus> = {}): SimulatorStatus => ({
  reachable: true,
  transport: 'native',
  nativeArmed: false,
  outputEnabled: true,
  host: '127.0.0.1',
  port: 49051,
  telemetry: {} as SimulatorStatus['telemetry'],
  telemetryFresh: true,
  lastHeartbeatAgeMs: 40,
  receivedFields: 27,
  subscribedFields: 27,
  ...overrides,
});

describe('Native control state reporting', () => {
  it('distinguishes browser pairing and real simulator authority', () => {
    expect(controlPhase(false, simulator())).toBe('idle');
    expect(controlPhase(true, simulator({ outputEnabled: false }))).toBe('preview');
    expect(controlPhase(true, simulator({ nativeArmed: false }))).toBe('pending');
    expect(controlPhase(true, simulator({ nativeArmed: true }))).toBe('active');
    expect(controlPhase(true, simulator({ nativeArmed: null, reachable: false }))).toBe('pending');
  });
  it('never reports legacy UDP as acknowledged native control', () => {
    expect(controlPhase(true, simulator({ transport: 'udp', nativeArmed: undefined }))).toBe('unverified');
  });
});
