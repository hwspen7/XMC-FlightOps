import { useMemo } from 'react';
import type { HistoryPoint } from '../../hooks/useTelemetryHistory';

export type HistoryKey = Exclude<keyof HistoryPoint, 'at'>;
interface ChartSeries { key: HistoryKey; label: string; color: string; }
interface Props { title: string; subtitle: string; unit: string; history: HistoryPoint[]; series: ChartSeries[]; }

const LEFT = 47;
const TOP = 20;
const WIDTH = 534;
const HEIGHT = 139;

export function HistoryChart({ title, subtitle, unit, history, series }: Props) {
  const chart = useMemo(() => {
    const available = series.flatMap((s) => history.map((p) => p[s.key]).filter((v): v is number => v !== null && Number.isFinite(v)));
    if (!available.length) return null;
    const min = Math.min(...available);
    const max = Math.max(...available);
    const padding = Math.max((max-min) * .15, max === min ? Math.max(Math.abs(max) * .03, 1) : .1);
    const lower = min - padding;
    const upper = max + padding;
    const domain = Math.max(upper - lower, 1);
    const atStart = history[0]?.at ?? 0;
    const atEnd = history[history.length - 1]?.at ?? atStart;
    const period = Math.max(5_000, atEnd - atStart);
    return {
      lower, upper,
      paths: series.map((s) => {
        let path = '';
        let active = false;
        for (const point of history) {
          const value = point[s.key];
          if (value === null || !Number.isFinite(value)) { active = false; continue; }
          const x = LEFT + ((point.at - atStart) / period) * WIDTH;
          const y = TOP + (1 - (value - lower) / domain) * HEIGHT;
          path += `${active ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `;
          active = true;
        }
        return { ...s, path };
      }),
    };
  }, [history, series]);

  return <section className="monitor-card trend-card">
    <div className="card-heading"><div><span className="micro-label">LIVE HISTORY / 90 SEC</span><h2>{title}</h2><p className="chart-subtitle">{subtitle}</p></div><span className="chart-unit">{unit}</span></div>
    <div className="chart-plot">
      <svg viewBox="0 0 600 191" role="img" aria-label={`${title} live timeline`} preserveAspectRatio="none">
        {[0,1,2,3,4].map(i => <g key={i}><path d={`M${LEFT} ${TOP+i*HEIGHT/4} H${LEFT+WIDTH}`} stroke="#25445c" strokeWidth="1" strokeDasharray="3 5"/>
          <text x="38" y={TOP + i * HEIGHT/4 + 4} textAnchor="end" fill="#7391a9" fontSize="11">{chart ? (chart.upper - i*(chart.upper-chart.lower)/4).toFixed(Math.abs(chart.upper-chart.lower)<8 ? 1 : 0) : '–'}</text></g>)}
        {[0,1,2,3,4,5].map(i => <path key={i} d={`M${LEFT+i*WIDTH/5} ${TOP} V${TOP+HEIGHT}`} stroke="#213a51" strokeWidth=".7"/>)}
        {chart?.paths.map(p => <path key={p.key} d={p.path} stroke={p.color} strokeWidth="2.4" fill="none" strokeLinejoin="round" strokeLinecap="round"/>)}
        {!chart && <text x="300" y="95" textAnchor="middle" fill="#7991a9" fontSize="14">AWAITING TELEMETRY SAMPLES</text>}
        <text x="47" y="183" fill="#7391a9" fontSize="10">START</text><text x="581" y="183" textAnchor="end" fill="#7391a9" fontSize="10">LATEST</text>
      </svg>
    </div>
    <div className="chart-legend">{series.map(s => <span key={s.key}><i style={{ backgroundColor: s.color }}/>{s.label}</span>)}</div>
  </section>;
}
