import { describe, expect, it } from 'vitest';
import { CONTROLLER_SESSION_TTL_MS, ControllerSession } from './controller-session';

describe('Controller session recovery', () => {
  it('keeps one unpredictable credential valid across dropped reconnect replies', () => {
    const session = new ControllerSession();
    const first = session.issue(100);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.rejoin(first, 101)).toBe(first);
    expect(session.rejoin(first, 102)).toBe(first);
  });
  it('rejects invalid and expired tickets without extending their lifetime', () => {
    const session = new ControllerSession();
    const first = session.issue(100);
    expect(session.rejoin('x'.repeat(43), 101)).toBeNull();
    expect(session.rejoin(first, 100 + CONTROLLER_SESSION_TTL_MS)).toBeNull();
    expect(session.rejoin(first, 102)).toBeNull();
  });
  it('a second pairing invalidates the previous session', () => {
    const session = new ControllerSession();
    const first = session.issue(100);
    const second = session.issue(200);
    expect(second).not.toBe(first);
    expect(session.rejoin(first, 201)).toBeNull();
    expect(session.rejoin(second, 201)).not.toBeNull();
  });
});
