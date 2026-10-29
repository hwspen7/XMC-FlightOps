import { useMemo, useState, type PointerEvent } from 'react';
import type { HistoryPoint } from '../../hooks/useTelemetryHistory';

export type HistoryKey = Exclude<keyof HistoryPoint, 'at'>;
export interface ChartSeries { key: HistoryKey; label: string; color: string; }
interface Props { title: string; subtitle: string; unit: string; history: HistoryPoint[]; series: ChartSeries[]; percent?: boolean; }

const LEFT=64, RIGHT=620, TOP=22, HEIGHT=180;
const WINDOWS = [30_000, 120_000, 300_000] as const;
const precise = (x: number, span: number) => x.toLocaleString('en-US', {maximumFractionDigits:span<6?2:span<60?1:0});
const valid = (x: number|null): x is number => x !== null && Number.isFinite(x);

export function HistoryChart({title,subtitle,unit,history,series,percent=false}:Props) {
  const [windowMs,setWindowMs]=useState<number>(120_000);
  const [hidden,setHidden]=useState<string[]>([]);
  const [focus,setFocus]=useState<number|null>(null);
  const visible=series.filter(s=>!hidden.includes(s.key));
  const plot=useMemo(()=>{
    const latest=history.at(-1)?.at ?? Date.now();
    const from=latest-windowMs;
    const points=history.filter(p=>p.at>=from);
    const numeric=visible.flatMap(s=>points.map(p=>p[s.key]).filter(valid).map(v=>percent?v*100:v));
    if (!numeric.length) return {points,domain:null as null|{min:number;max:number},paths:[],latest,from};
    const lo=Math.min(...numeric), hi=Math.max(...numeric);
    const pad=Math.max((hi-lo)*.12, Math.abs(hi)*.015, 0.12);
    const min=lo-pad,max=hi+pad;
    const paths=visible.map(s=>{
      let path='',linked=false,last:null|{x:number;y:number;v:number}=null;
      for(const p of points){
        const raw=p[s.key]; if(!valid(raw)){linked=false;continue;}
        const value=percent?raw*100:raw;
        const x=LEFT+(p.at-from)/windowMs*(RIGHT-LEFT);
        const y=TOP+(1-(value-min)/(max-min))*HEIGHT;
        path+=`${linked?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
        linked=true;last={x,y,v:value};
      }
      return {...s,path,last};
    });
    return {points,domain:{min,max},paths,latest,from};
  },[history,windowMs,percent,visible.map(s=>s.key).join('|')]);
  const cursor=focus===null?null:plot.points.reduce<HistoryPoint|null>((best,p)=>{
    const at=plot.from+focus*windowMs;
    return best===null||Math.abs(p.at-at)<Math.abs(best.at-at)?p:best;
  },null);
  const pointer=(e:PointerEvent<SVGSVGElement>)=>{
    const bounds=e.currentTarget.getBoundingClientRect();
    setFocus(Math.max(0,Math.min(1,((e.clientX-bounds.left)/bounds.width*660-LEFT)/(RIGHT-LEFT))));
  };
  const sampleCount=plot.points.length;
  const realValues=visible.flatMap(s=>plot.points.map(p=>p[s.key]).filter(valid).map(v=>percent?v*100:v));
  return <section className="monitor-card trend-card monitor-trend-advanced">
    <div className="card-heading"><div><span className="micro-label">LIVE TELEMETRY / {windowMs/1000} SEC</span><h2>{title}</h2><p className="chart-subtitle">{subtitle}</p></div><span className="chart-unit">{unit}</span></div>
    <div className="monitor-chart-controls"><span>{sampleCount} SAMPLES · {realValues.length?'RECEIVING':'NO VALUES'}</span><div role="group" aria-label={`${title} history range`}>{WINDOWS.map(n=><button key={n} className={windowMs===n?'selected':''} onClick={()=>{setWindowMs(n);setFocus(null);}}>{n===30000?'30s':n===120000?'2m':'5m'}</button>)}</div></div>
    <div className="chart-plot"><svg viewBox="0 0 660 253" role="img" aria-label={`${title}: real X-Plane telemetry history`} onPointerMove={pointer} onPointerLeave={()=>setFocus(null)}>
      {Array.from({length:6},(_,i)=>{const y=TOP+i*HEIGHT/5;return <g key={i}><path d={`M${LEFT} ${y}H${RIGHT}`} stroke="#28475d" strokeDasharray={i===5?'':'4 6'} strokeWidth=".9"/><text x="56" y={y+4} textAnchor="end" fontSize="11" fill="#9cb5c9">{plot.domain?precise(plot.domain.max-i*(plot.domain.max-plot.domain.min)/5,plot.domain.max-plot.domain.min):'—'}</text></g>;})}
      {Array.from({length:7},(_,i)=>{const x=LEFT+i*(RIGHT-LEFT)/6;return <g key={i}><path d={`M${x} ${TOP}V${TOP+HEIGHT}`} stroke="#203b51" strokeWidth=".8"/><text x={x} y={TOP+HEIGHT+21} fill="#839fb5" fontSize="11" textAnchor="middle">{-Math.round((1-i/6)*windowMs/1000)}s</text></g>;})}
      {plot.domain&&plot.domain.min<0&&plot.domain.max>0&&<path d={`M${LEFT} ${TOP+plot.domain.max/(plot.domain.max-plot.domain.min)*HEIGHT} H${RIGHT}`} stroke="#89a6b7" strokeDasharray="6 4" opacity=".5"/>}
      {plot.paths.map(s=><g key={s.key}><path d={s.path} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/>{s.last&&<circle cx={s.last.x} cy={s.last.y} r="4" fill={s.color} stroke="#061522" strokeWidth="1.5"/>}</g>)}
      {cursor&&focus!==null&&<path d={`M${LEFT+focus*(RIGHT-LEFT)} ${TOP}V${TOP+HEIGHT}`} stroke="#dceffd" strokeWidth="1" strokeDasharray="3 3"/>}
      {!plot.domain&&<text x="340" y="112" fill="#849bad" textAnchor="middle" fontSize="15">NO LIVE SAMPLES FOR SELECTED SIGNALS</text>}
      <text x="620" y="246" fontSize="10" textAnchor="end" fill="#789ab2">RELATIVE TO LATEST SAMPLE</text>
    </svg></div>
    {cursor&&<div className="monitor-cursor-readout"><span>AT −{((plot.latest-cursor.at)/1000).toFixed(1)}s</span>{visible.map(s=><span key={s.key} style={{color:s.color}}>{s.label}: {valid(cursor[s.key])?precise((cursor[s.key] as number)*(percent?100:1),3):'---'}</span>)}</div>}
    <div className="monitor-chart-stats-matrix">
      <div className="monitor-chart-stats-head"><span>SIGNAL</span><span>LATEST</span><span>AVERAGE</span><span>MIN</span><span>MAX</span></div>
      {visible.map(s=>{
        const readings=plot.points.map(p=>p[s.key]).filter(valid).map(v=>percent?v*100:v);
        const latest=readings.at(-1);
        const spread=readings.length?Math.max(...readings)-Math.min(...readings):0;
        const fmt=(v:number|undefined)=>v===undefined?'---':precise(v,spread);
        return <div key={s.key} className="monitor-chart-stat-row"><span style={{color:s.color}}>{s.label}</span><strong>{fmt(latest)}</strong><strong>{fmt(readings.length?readings.reduce((a,b)=>a+b,0)/readings.length:undefined)}</strong><strong>{fmt(readings.length?Math.min(...readings):undefined)}</strong><strong>{fmt(readings.length?Math.max(...readings):undefined)}</strong></div>;
      })}
    </div>
    <div className="chart-legend monitor-series-toggle">{series.map(s=><button key={s.key} type="button" aria-pressed={!hidden.includes(s.key)} className={hidden.includes(s.key)?'muted':''} onClick={()=>setHidden(prev=>prev.includes(s.key)?prev.filter(k=>k!==s.key):[...prev,s.key])}><i style={{backgroundColor:s.color}}/>{s.label}{(()=>{const last=[...plot.points].reverse().map(p=>p[s.key]).find(valid);return last===undefined?' · ---':` · ${precise(last*(percent?100:1),Math.abs(last))}`;})()}</button>)}</div>
  </section>;
}
