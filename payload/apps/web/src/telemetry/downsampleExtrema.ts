import type { HistoryPoint } from '../hooks/useTelemetryHistory';

/**
 * Preserve chart extrema while bounding SVG geometry. Buckets retain first,
 * last, minimum and maximum; time ordering is restored before returning.
 * Existing gaps (null samples) are preserved as independent path breaks.
 */
export function downsampleExtrema<K extends keyof HistoryPoint>(
  history: readonly HistoryPoint[], key: K, buckets = 200,
): HistoryPoint[] {
  if (!Number.isSafeInteger(buckets) || buckets < 2) throw new RangeError('Invalid bucket count');
  if (history.length <= buckets * 4) return [...history];
  const step = Math.ceil(history.length / buckets);
  const selected = new Set<number>();
  for (let from = 0; from < history.length; from += step) {
    const to = Math.min(history.length, from + step);
    selected.add(from);
    selected.add(to - 1);
    let minimum = Infinity;
    let maximum = -Infinity;
    let minAt = -1;
    let maxAt = -1;
    let firstGap = -1;
    let lastGap = -1;
    for (let i = from; i < to; ++i) {
      const v = history[i][key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        if (firstGap === -1) firstGap = i;
        lastGap = i;
        continue;
      }
      if (v < minimum) { minimum = v; minAt = i; }
      if (v > maximum) { maximum = v; maxAt = i; }
    }
    if (firstGap >= 0) { selected.add(firstGap); selected.add(lastGap); }
    if (minAt >= 0) selected.add(minAt);
    if (maxAt >= 0) selected.add(maxAt);
  }
  return [...selected].sort((a, b) => a - b).map(i => history[i]);
}
