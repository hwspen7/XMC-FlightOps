import { fractionForReverse, IDLE_TRAVEL_FRACTION } from './throttleLeverLogic';

export interface ThrottleScaleMark {
  zone: 'forward' | 'reverse';
  value: number;
  fraction: number;
  major: boolean;
  label: string | null;
  detent?: 'idle' | 'reverse-idle' | 'max-reverse';
}

/**
 * Visual scale only: a tick for each 5% of forward travel. Keep actual
 * throttle commands continuously adjustable at 1% resolution.
 * Label every 20% so the iPhone landscape scale stays readable.
 */
const forwardMarks: ThrottleScaleMark[] = Array.from({ length: 21 }, (_, step) => {
  const value = 100 - step * 5;
  return {
    zone: 'forward',
    value,
    fraction: IDLE_TRAVEL_FRACTION * step / 20,
    major: value % 10 === 0,
    label: value === 0 ? 'IDLE' : value % 20 === 0 ? String(value) : null,
    ...(value === 0 ? { detent: 'idle' as const } : {}),
  };
});

/**
 * Reverse-idle is a touch-control reference, NOT a measured reverser deployment
 * position or a fixed thrust setting on the real aircraft. The existing native
 * interlocks remain authoritative for ground, idle, and supported reverse.
 */
export const REVERSE_IDLE_REFERENCE_PERCENT = 25;
export const REVERSE_IDLE_REFERENCE_FRACTION = fractionForReverse(REVERSE_IDLE_REFERENCE_PERCENT);

const reverseMarks: ThrottleScaleMark[] = [
  {
    zone: 'reverse', value: REVERSE_IDLE_REFERENCE_PERCENT,
    fraction: REVERSE_IDLE_REFERENCE_FRACTION,
    major: true, label: 'RIDLE', detent: 'reverse-idle',
  },
  ...[50, 75].map(value => ({
    zone: 'reverse' as const, value, fraction: fractionForReverse(value),
    major: value === 50, label: null,
  })),
  {
    zone: 'reverse', value: 100, fraction: 1,
    major: true, label: 'MAX', detent: 'max-reverse',
  },
];

export const THROTTLE_SCALE_MARKS: readonly ThrottleScaleMark[] = [
  ...forwardMarks,
  ...reverseMarks,
];
