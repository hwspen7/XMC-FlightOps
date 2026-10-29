import { randomBytes, timingSafeEqual } from 'node:crypto';

// The ticket authorizes rejoining a paired controller, not flying the aircraft.
// Flight control always requires a new explicit ARM and fresh sensor samples.
export const CONTROLLER_SESSION_TTL_MS = 30 * 60 * 1000;

export class ControllerSession {
  private ticket: string | null = null;
  private expiresAt = 0;

  issue(now = Date.now()): string {
    this.ticket = randomBytes(32).toString('base64url');
    this.expiresAt = now + CONTROLLER_SESSION_TTL_MS;
    return this.ticket;
  }

  rejoin(candidate: unknown, now = Date.now()): string | null {
    if (typeof candidate !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(candidate)) return null;
    if (!this.ticket || now >= this.expiresAt) {
      this.ticket = null;
      return null;
    }
    const actual = Buffer.from(this.ticket);
    const supplied = Buffer.from(candidate);
    if (actual.length !== supplied.length || !timingSafeEqual(actual, supplied)) return null;
    // Retain the same ticket: reconnection must survive a lost server reply.
    // Refresh the inactivity expiry, but never grant aircraft authority here.
    this.expiresAt = now + CONTROLLER_SESSION_TTL_MS;
    return this.ticket;
  }
}
