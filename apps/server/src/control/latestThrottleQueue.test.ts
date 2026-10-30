import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LatestThrottleQueue } from './latestThrottleQueue';

describe('forward-throttle transport reliability', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T20:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('keeps the final fast slider change instead of dropping it', () => {
    const queue = new LatestThrottleQueue(95);
    const sent: number[] = [];
    const offer = (value: number) => queue.offer(value, () => { sent.push(value); return true; });
    expect(offer(.2)).toBe(true);
    vi.advanceTimersByTime(25);
    expect(offer(.4)).toBe(true);
    vi.advanceTimersByTime(25);
    expect(offer(.8)).toBe(true);
    expect(sent).toEqual([.2]);
    vi.advanceTimersByTime(45);
    expect(sent).toEqual([.2, .8]);
  });

  it('forwards urgent IDLE immediately and cancels an older pending high thrust', () => {
    const queue = new LatestThrottleQueue();
    const sent: number[] = [];
    const offer = (v: number) => queue.offer(v, () => { sent.push(v); return true; });
    offer(.6);
    vi.advanceTimersByTime(10);
    offer(.9);
    offer(0);
    vi.advanceTimersByTime(300);
    expect(sent).toEqual([.6, 0]);
  });

  it('never sends queued throttle after disarm or loss of ownership', () => {
    const queue = new LatestThrottleQueue();
    const sent: number[] = [];
    queue.offer(.1, () => { sent.push(.1); return true; });
    vi.advanceTimersByTime(20);
    queue.offer(.8, () => { sent.push(.8); return true; });
    queue.reset();
    vi.advanceTimersByTime(200);
    expect(sent).toEqual([.1]);
  });

  it('does not record a denied simulator write as successful', () => {
    const queue = new LatestThrottleQueue();
    expect(queue.offer(.5, () => false)).toBe(false);
    expect(queue.offer(.7, () => true)).toBe(true);
  });
});
