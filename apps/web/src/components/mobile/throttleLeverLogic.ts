/** One continuous virtual throttle quadrant with an idle/reverse detent. */
export const IDLE_TRAVEL_FRACTION = 0.76;
export const REVERSE_DETENT_MS = 180;
export const IDLE_THROTTLE_LIMIT = 0.06;

export function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Maps a continuous pointer movement to lever travel; no reverse re-anchoring. */
export function travelFromPointer(startPosition: number, deltaY: number, height: number): number {
  return clampFraction(startPosition + deltaY / Math.max(1, height));
}

export function throttleAtTravel(fraction: number): { forward: number; reverse: number } {
  const position = clampFraction(fraction);
  if (position <= IDLE_TRAVEL_FRACTION) {
    return { forward: Math.round(100 * (1 - position / IDLE_TRAVEL_FRACTION)), reverse: 0 };
  }
  return {
    forward: 0,
    reverse: Math.round(100 * (position - IDLE_TRAVEL_FRACTION) / (1 - IDLE_TRAVEL_FRACTION)),
  };
}

export function fractionForForward(percent: number): number {
  return IDLE_TRAVEL_FRACTION * (1 - clampFraction(percent / 100));
}

export function fractionForReverse(percent: number): number {
  return IDLE_TRAVEL_FRACTION + (1 - IDLE_TRAVEL_FRACTION) * clampFraction(percent / 100);
}

/** Input checks mirror, but never replace, the NestJS and C++ reverse interlocks. */
export function reverseDetentPermitted(
  active: boolean,
  onGround: boolean,
  autothrottle: boolean,
  actualThrottle: number | null,
  elapsedAtIdleMs: number,
): boolean {
  return active && onGround && !autothrottle && actualThrottle !== null &&
    Number.isFinite(actualThrottle) && actualThrottle <= IDLE_THROTTLE_LIMIT &&
    elapsedAtIdleMs >= REVERSE_DETENT_MS;
}
