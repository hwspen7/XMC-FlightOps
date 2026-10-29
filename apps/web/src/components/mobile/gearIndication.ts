/** Read-back only. Handle position is not proof of mechanical lock. */
export interface GearReadback {
  state: 'unknown' | 'selected-up' | 'selected-down' | 'up' | 'down' | 'unsafe';
  headline: string;
  detail: string;
  lamps: readonly ('off' | 'green' | 'red' | 'unknown')[];
}

export function gearReadback(
  handle: number | null,
  ratios: readonly (number | null)[],
  live: boolean,
): GearReadback {
  if (!live || handle === null || !Number.isFinite(handle)) {
    return { state: 'unknown', headline: 'NO DATA', detail: 'NOT VERIFIED', lamps: ['unknown', 'unknown', 'unknown'] };
  }
  const selectedDown = handle > 0.5;
  if (ratios.length < 3 || ratios.some(v => v === null || !Number.isFinite(v) || v < 0 || v > 1)) {
    return { state: selectedDown ? 'selected-down' : 'selected-up', headline: selectedDown ? 'DOWN SEL' : 'UP SEL', detail: 'POSITION UNVERIFIED', lamps: ['unknown', 'unknown', 'unknown'] };
  }
  const values = ratios as number[];
  const down = values.every(v => v >= 0.985);
  const up = values.every(v => v <= 0.015);
  if (selectedDown && down) {
    return { state: 'down', headline: 'DOWN', detail: 'DOWN INDICATED', lamps: ['green', 'green', 'green'] };
  }
  if (!selectedDown && up) {
    return { state: 'up', headline: 'UP', detail: 'UP INDICATED', lamps: ['off', 'off', 'off'] };
  }
  return { state: 'unsafe', headline: 'UNSAFE', detail: 'IN TRANSIT / DISAGREE', lamps: values.map(v => selectedDown && v >= 0.985 ? 'green' : 'red') };
}
