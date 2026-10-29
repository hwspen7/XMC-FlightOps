import { describe, expect, it } from 'vitest';
import { downsampleExtrema } from './downsampleExtrema';
import type { HistoryPoint } from '../hooks/useTelemetryHistory';
const point = (at: number, risk: number | null) => ({ at, risk } as HistoryPoint);
describe('downsampleExtrema', () => {
  it('keeps spikes, endpoints, gaps and time order', () => {
    const history = Array.from({ length: 2000 }, (_, i) => point(i, i === 1017 ? 100 : 5));
    history[700] = point(700, null);
    const result = downsampleExtrema(history, 'risk', 100);
    expect(result.length).toBeLessThan(500);
    expect(result[0].at).toBe(0);
    expect(result[result.length - 1].at).toBe(1999);
    expect(result.find(p => p.at === 1017)?.risk).toBe(100);
    expect(result.some(p => p.at === 700 && p.risk === null)).toBe(true);
    expect(result.every((p, i) => i === 0 || p.at > result[i - 1].at)).toBe(true);
  });
  it('does not modify short input', () => {
    const history = [point(1, 1), point(2, 3)];
    expect(downsampleExtrema(history, 'risk')).toEqual(history);
  });
});
