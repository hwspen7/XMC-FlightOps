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
    const sim = { activate: vi.fn(), update: vi.fn(), deactivate: vi.fn() } as unknown as XPlaneService;
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
    expect(sim.deactivate).toHaveBeenCalledOnce();
    expect(control.isArmed()).toBe(false);
    expect(control.metrics().lastFrameAgeMs).toBeNull();
  });
});
