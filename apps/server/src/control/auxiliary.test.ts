import { describe, expect, it, vi } from 'vitest';
import { ControlService } from './control.service';
import { XPlaneService } from '../xplane/xplane.service';
import { COMMAND_PATHS, encodeCommand, isAuxiliaryAction } from '../xplane/commands';

describe('auxiliary controls', () => {
  it('encodes allowlisted simulator commands', () => {
    expect(isAuxiliaryAction('flaps-down')).toBe(true);
    expect(isAuxiliaryAction('sim/operation/quit')).toBe(false);
    expect(encodeCommand(COMMAND_PATHS['flaps-up']).toString('ascii')).toContain('CMND\0sim/flight_controls/flaps_up\0');
  });
  it('rejects non-owner actions and invalid throttle ratios', () => {
    const simulator = { activate: vi.fn(), update: vi.fn(), deactivate: vi.fn(), throttle: vi.fn(() => true), action: vi.fn(() => true), status: vi.fn(() => ({ telemetry: { autothrottleOn: 0 } })) } as unknown as XPlaneService;
    const service = new ControlService(simulator);
    const owner = {};
    const observer = {};
    service.arm(owner);
    expect(service.throttle(observer, 0.5)).toBe(false);
    expect(service.auxiliary(observer, 'flaps-up')).toBe(false);
    expect(service.throttle(owner, 1.1)).toBe(false);
    expect(service.throttle(owner, 0.55)).toBe(true);
    expect(service.auxiliary(owner, 'spoilers-toggle')).toBe(true);
  });
  it('rejects unsafe reverse without native ground confirmation', () => {
    const sim = { activate: vi.fn(), deactivate: vi.fn(), pedal: vi.fn(() => true),
      status: vi.fn(() => ({ reachable: true, transport: 'native', nativeArmed: true,
        telemetry: { onGround: 0, throttleRatio: 0, autopilotServosOn: 0 } })) } as unknown as XPlaneService;
    const ctl = new ControlService(sim); const owner = {};
    ctl.arm(owner);
    expect(ctl.pedal({}, { action: 'brakes', value: 1 })).toBe(false);
    expect(ctl.pedal(owner, { action: 'rudder', value: 2 })).toBe(false);
    expect(ctl.pedal(owner, { action: 'reverse', value: 0.5 })).toBe(false);
    expect(ctl.pedal(owner, { action: 'brakes', value: 1 })).toBe(true);
    expect(ctl.pedal(owner, { action: 'brakes', value: 0 })).toBe(true);
  });
});
