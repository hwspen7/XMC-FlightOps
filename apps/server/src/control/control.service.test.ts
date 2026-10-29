import { describe, expect, it, vi } from 'vitest';
import { ControlService, validateFrame } from './control.service';
import { XPlaneService } from '../xplane/xplane.service';

describe('Control safety and ownership', () => {
  it('rejects out-of-range and non-finite frames', () => {
    expect(validateFrame({ sequence: 1, roll: 2, pitch: 0 })).toBe(false);
    expect(validateFrame({ sequence: 1, roll: NaN, pitch: 0 })).toBe(false);
    expect(validateFrame({ sequence: 1, roll: 0.5, pitch: -0.5 })).toBe(true);
  });
  it('allows only the owner and releases control after timeout', () => {
    const sim = { activate: vi.fn(), update: vi.fn(), deactivate: vi.fn(), suspend: vi.fn() } as unknown as XPlaneService;
    const control = new ControlService(sim);
    const owner = {};
    const stranger = {};
    expect(control.arm(owner)).toBe(true);
    expect(control.metrics().lastFrameAgeMs).toBeNull();
    expect(control.arm(stranger)).toBe(false);
    expect(control.accept(stranger, { sequence: 0, roll: 0.2, pitch: 0 })).toBe(false);
    expect(control.accept(owner, { sequence: 0, roll: 0.2, pitch: 0 })).toBe(true);
    expect(control.metrics().framesAccepted).toBe(1);
    expect(control.metrics().lastFrameAgeMs).not.toBeNull();
    expect(control.accept(owner, { sequence: 0, roll: 0.3, pitch: 0 })).toBe(false);
    expect(control.checkTimeout(Date.now() + 1000)).toBe(true);
    expect(sim.suspend).toHaveBeenCalledOnce();
    expect(sim.deactivate).not.toHaveBeenCalled();
    expect(control.isArmed()).toBe(false);
    expect(control.metrics().lastFrameAgeMs).toBeNull();
  });
  it('does not confuse pairing with native plugin acknowledgement', () => {
    const status = { outputEnabled: true, transport: 'native', reachable: true, nativeArmed: false };
    const sim = {
      activate: vi.fn(), update: vi.fn(), deactivate: vi.fn(), status: vi.fn(() => status),
    } as unknown as XPlaneService;
    const control = new ControlService(sim);
    const owner = {};
    expect(control.arm(owner)).toBe(true);
    expect(control.checkNativeAuthority(Date.now() + 300)).toBeNull();
    expect(control.checkNativeAuthority(Date.now() + 1000)).toBe('unconfirmed');
    expect(control.isArmed()).toBe(false);
    expect(sim.deactivate).toHaveBeenCalledOnce();
  });
  it('releases control if confirmed native authority subsequently disappears', () => {
    const status = { outputEnabled: true, transport: 'native', reachable: true, nativeArmed: true };
    const sim = {
      activate: vi.fn(), update: vi.fn(), deactivate: vi.fn(), suspend: vi.fn(), status: vi.fn(() => status),
    } as unknown as XPlaneService;
    const control = new ControlService(sim);
    const owner = {};
    expect(control.arm(owner)).toBe(true);
    expect(control.checkNativeAuthority()).toBeNull();
    status.nativeArmed = false;
    expect(control.checkNativeAuthority()).toBe('lost');
    expect(control.isArmed()).toBe(false);
  });
  it('distinguishes intentional disarm from unexpected interruption', () => {
    const sim = { activate: vi.fn(), deactivate: vi.fn(), suspend: vi.fn() } as unknown as XPlaneService;
    const control = new ControlService(sim);
    const owner = {};
    expect(control.arm(owner)).toBe(true);
    expect(control.suspend({})).toBe(false); // A non-owner cannot pause another controller.
    expect(control.suspend(owner)).toBe(true);
    expect(sim.suspend).toHaveBeenCalledOnce();
    expect(sim.deactivate).not.toHaveBeenCalled();
    expect(control.arm(owner)).toBe(true);
    expect(control.disarm(owner)).toBe(true);
    expect(sim.deactivate).toHaveBeenCalledOnce();
  });

  it('will not resume while unpaired, without fresh control or without native-owned pause', () => {
    const status = { outputEnabled: true, transport: 'native', reachable: true,
      nativeArmed: true, simPaused: true, nativeInterrupted: true, pauseOwned: true };
    const sim = {
      activate: vi.fn(), update: vi.fn(), resume: vi.fn(() => true), status: vi.fn(() => status),
    } as unknown as XPlaneService;
    const control = new ControlService(sim);
    const owner = {};
    expect(control.resume(owner)).toBe(false);
    expect(control.arm(owner)).toBe(true);
    expect(control.resume(owner)).toBe(false); // ARM alone is not a fresh CTRL frame.
    expect(control.accept(owner, { sequence: 1, roll: 0, pitch: 0 })).toBe(true);
    expect(control.resume({})).toBe(false);
    expect(control.resume(owner, Date.now() + 1000)).toBe(false);
    expect(control.resume(owner)).toBe(true);
    status.pauseOwned = false;
    expect(control.resume(owner)).toBe(false);
  });

  it('retains ownership in monitor-only preview without simulator override', () => {
    const sim = {
      activate: vi.fn(), deactivate: vi.fn(), status: vi.fn(() => ({ outputEnabled: false, transport: 'native', reachable: true, nativeArmed: false })),
    } as unknown as XPlaneService;
    const control = new ControlService(sim);
    expect(control.arm({})).toBe(true);
    expect(control.checkNativeAuthority(Date.now() + 2000)).toBeNull();
    expect(control.isArmed()).toBe(true);
  });
});
