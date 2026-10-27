import { useMemo } from 'react';
import type { HistoryPoint } from '../../hooks/useTelemetryHistory';

interface Point { x:number; y:number; }

function projectTrack(history: HistoryPoint[]): { points: Point[]; range: string } | null {
  const samples = history.filter((p) => p.latitude !== null && p.longitude !== null);
  if (samples.length < 2) return null;
  const referenceLatitude = samples[0].latitude! * Math.PI / 180;
  const scaleX = 111320 * Math.cos(referenceLatitude);
  const scaleY = 111320;
  const coords = samples.map((p) => ({ x: (p.longitude! - samples[0].longitude!) * scaleX, y: (p.latitude! - samples[0].latitude!) * scaleY }));
  const minX = Math.min(...coords.map(p => p.x));
  const maxX = Math.max(...coords.map(p => p.x));
  const minY = Math.min(...coords.map(p => p.y));
  const maxY = Math.max(...coords.map(p => p.y));
  const range = Math.max(maxX-minX,maxY-minY, 150);
  const points = coords.map(p => ({ x: 300+(p.x-(minX+maxX)/2)*470/range, y: 94-(p.y-(minY+maxY)/2)*130/range }));
  return { points, range:range<1000?`${Math.round(range)} M`: `${(range/1000).toFixed(1)} KM` };
}

export function GroundTrack({history}: { history: HistoryPoint[] }) {
  const plot = useMemo(() => projectTrack(history), [history]);
  const latest = plot?.points[plot.points.length-1];
  return <section className="monitor-card trend-card">
    <div className="card-heading"><div><span className="micro-label">POSITION HISTORY / LOCAL PROJECTION</span><h2>Ground track <em>/ 2D</em></h2><p className="chart-subtitle">Relative movement from GPS coordinates</p></div><span className="chart-unit">{plot?.range??'METERS'}</span></div>
    <div className="chart-plot"><svg viewBox="0 0 600 191" role="img" aria-label="Aircraft ground track from simulator latitude and longitude" preserveAspectRatio="none">
      {[0,1,2,3,4].map(i => <g key={i}><path d={`M${47+i*133.5} 16 V164`} stroke="#25445c" strokeDasharray="3 7"/><path d={`M47 ${16+i*37} H581`} stroke="#25445c" strokeDasharray="3 7"/></g>)}
      {plot ? <><polyline points={plot.points.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#6bbfe9" strokeWidth="2.8" fill="none" strokeLinejoin="round"/><circle cx={latest!.x} cy={latest!.y} r="5" fill="#eac27b" stroke="#fff" strokeWidth="1"/></> : <text x="300" y="95" fontSize="14" fill="#7895ac" textAnchor="middle">AWAITING POSITION HISTORY</text>}
      <text x="300" y="183" fontSize="10" fill="#749bb2" textAnchor="middle">NORTH ↑ · RELATIVE POSITION · NO MAP TILES</text>
    </svg></div><div className="chart-legend"><span><i style={{backgroundColor:'#6bbfe9'}}/>Recorded track</span><span><i style={{backgroundColor:'#eac27b'}}/>Current sample</span></div>
  </section>;
}
