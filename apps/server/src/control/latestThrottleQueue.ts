/**
 * Retain the latest forward-throttle request instead of discarding an input
 * that arrives inside the minimum server command interval. The idle command
 * is urgent and bypasses the interval. No queued request survives disarm.
 * This queue does not acknowledge a simulator-side DataRef write.
 */
export class LatestThrottleQueue {
  private lastSentAt = -Infinity;
  private pending: (() => boolean) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly minimumIntervalMs = 95) {
    if (!Number.isFinite(minimumIntervalMs) || minimumIntervalMs <= 0)
      throw new RangeError('Minimum interval must be positive');
  }

  offer(ratio: number, deliver: () => boolean): boolean {
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) return false;
    const now = Date.now();
    if (ratio === 0 || now - this.lastSentAt >= this.minimumIntervalMs) {
      this.cancel();
      const accepted = deliver();
      if (accepted) this.lastSentAt = now;
      return accepted;
    }
    // Coalesce intervening updates; release/final position is never discarded.
    this.pending = deliver;
    if (this.timer === null) this.schedule(Math.max(1, this.minimumIntervalMs - (now - this.lastSentAt)));
    return true;
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      const pending = this.pending;
      this.pending = null;
      if (!pending) return;
      const now = Date.now();
      const remaining = this.minimumIntervalMs - (now - this.lastSentAt);
      if (remaining > 0) {
        this.pending = pending;
        this.schedule(remaining);
        return;
      }
      if (pending()) this.lastSentAt = now;
    }, Math.ceil(delay));
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  reset(): void {
    this.cancel();
    this.lastSentAt = -Infinity;
  }
}
