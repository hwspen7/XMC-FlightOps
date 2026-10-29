import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import type { ServerStatus } from '@xplane/shared';
import { extrema, picture, toTimelinePoint, value, type TimelinePoint, type TrendKey } from '../../telemetry/flightAnalytics';
import '../../styles/flight-analytics.css';
const colors={cyan:'#56c9ed',gold:'#f2bf7d',green:'#67d1a5',violet:'#afadf8',red:'#f17d83',muted:'#607f9b'};
const tracks:[string,TrendKey,string][]=[['Indicated airspeed','ias','KT'],['Altitude (MSL)','alt','FT'],['Vertical speed','vs','FPM'],['Bank / pitch','bank','DEG'],['N1 engine 1 / 2','n1l','%'],['Engine temperatures','egtl','°C'],['Advisory risk','risk','/100']];
const finite=(x:number|null):x is number=>x!==null&&Number.isFinite(x);
function MultiTrack({points,events}:{points:TimelinePoint[];events:{at:number;flag:number;event:string}[]}) {
 const [windowMs,setWindowMs]=useState(300000),[focus,setFocus]=useState<number|null>(null),[selected,setSelected]=useState<TrendKey>('ias');
 const last=points.at(-1)?.at??Date.now(),first=last-windowMs;
 const visible=useMemo(()=>points.filter(p=>p.at>=first),[points,first]);
 const record=focus===null?null:visible.reduce<TimelinePoint|null>((a,b)=>!a||Math.abs(b.at-focus)<Math.abs(a.at-focus)?b:a,null);
 const displayTracks=tracks.map(([title,k,unit],i)=>{
  const paired:TrendKey|null=k==='bank'?'pitch':k==='n1l'?'n1r':k==='egtl'?'egtr':null;
  const series:[TrendKey,string][]=[[k,colors.cyan],...(paired?[[paired,colors.gold] as [TrendKey,string]]:[])];
  const vals=visible.flatMap(p=>series.map(([f])=>p[f]).filter(finite));const low=vals.length?Math.min(...vals):0,high=vals.length?Math.max(...vals):1;
  const span=Math.max(high-low,1),lo=low-span*.12,hi=high+span*.12,y=36+i*72;
  const lines=series.map(([f,color])=>{
   let path='',running=false;
   for(const p of extrema(visible,f,150)) {const v=p[f];if(!finite(v)){running=false;continue;}
    const x=178+(p.at-first)/windowMs*760;const yy=y+55-(v-lo)/(hi-lo)*51;
    path+=`${running?'L':'M'}${x.toFixed(1)} ${yy.toFixed(1)} `;running=true;
   }return {path,color,key:f};});
  return <g key={k} onClick={()=>setSelected(k)} style={{cursor:'pointer'}}><rect x="1" y={y-5} width="955" height="70" rx="5" fill={selected===k?'#17364b':'#0d2233'} stroke="#29475f"/><text x="14" y={y+14} fill="#b7d7ea" fontSize="12" fontWeight="600">{title}</text><text x="14" y={y+32} fill="#719ab5" fontSize="10">{unit}  {record?value(record[k],1):'LIVE'}</text>
   {[0,1,2,3].map(j=><path key={j} d={`M178 ${y+j*18}H938`} stroke="#294054" strokeDasharray="2 6"/>)}
   <text x="934" y={y+10} textAnchor="end" fill="#7fa4bc" fontSize="9">{vals.length?high.toFixed(1):'—'}</text><text x="934" y={y+57} textAnchor="end" fill="#7fa4bc" fontSize="9">{vals.length?low.toFixed(1):'—'}</text>
   {lines.map(line=><path key={line.key} d={line.path} stroke={line.color} fill="none" strokeWidth="1.9" strokeLinejoin="round"/>)}
   {focus!==null&&<line x1={178+(focus-first)/windowMs*760} x2={178+(focus-first)/windowMs*760} y1={y-4} y2={y+64} stroke="#d7e9f8" strokeDasharray="4 4" strokeOpacity=".8"/>}
  </g>;
 });
 return <div className="xmc-advanced-card"><div className="xmc-card-head"><div><b>MULTI-TRACK FLIGHT DATA RECORDER</b><small>Linked cursor · individual track scales · min/max-preserving decimation · gaps retained</small></div><div className="xmc-controls">{[60,300,900].map(n=><button key={n} className={windowMs===n*1000?'active':''} onClick={()=>setWindowMs(n*1000)}>{n/60}m</button>)}</div></div>
 <svg className="xmc-multitrack" viewBox="0 0 965 570" role="img" aria-label="Seven linked telemetry tracks with synchronized cursor and event markers" onPointerMove={(e:PointerEvent<SVGSVGElement>)=>{const r=e.currentTarget.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*965;setFocus(first+Math.min(1,Math.max(0,(x-178)/760))*windowMs);}} onPointerLeave={()=>setFocus(null)}>
  {displayTracks}
  {events.filter(e=>e.at>=first&&e.at<=last).slice(0,40).map((e,i)=><g key={`${e.at}-${i}`}><line x1={178+(e.at-first)/windowMs*760} x2={178+(e.at-first)/windowMs*760} y1="28" y2="566" stroke={e.event==='raised'?colors.red:colors.green} strokeDasharray="3 5" opacity=".5"/><circle cx={178+(e.at-first)/windowMs*760} cy="23" r="3" fill={e.event==='raised'?colors.red:colors.green}/></g>)}
  {[0,1,2,3,4].map(i=><text key={i} x={178+760*i/4} y="567" fill="#83a4bd" textAnchor="middle" fontSize="11">{new Date(first+i*windowMs/4).toLocaleTimeString()}</text>)}
 </svg><div className="xmc-foot">{visible.length} samples visible · {events.length} events · blue = primary series, amber = secondary series · timeline is observational, not a certified flight recorder</div></div>;
}
function SpeedEnvelope({t}:{t:ServerStatus['simulator']['telemetry']}) {
 const speed=t.indicatedAirspeedKnots, bounds=[t.speedVsoKnots,t.speedVsKnots,t.speedVfeKnots,t.speedVnoKnots,t.speedVneKnots];
 const max=Math.max(180,...bounds.filter(finite).map(x=>x*1.12),finite(speed)?speed*1.12:0);const scale=(n:number)=>62+788*n/max;
 return <div className="xmc-advanced-card"><div className="xmc-card-head"><div><b>CALIBRATED AIRSPEED REFERENCE ENVELOPE</b><small>Simulator-supplied reference speeds only · not maneuvering certification</small></div><b>{value(speed,1)} KT</b></div><svg viewBox="0 0 900 132" role="img" aria-label="Airspeed reference ruler">
  <rect x="62" y="35" width="788" height="40" rx="4" fill="#18364a"/>
  {bounds.map((n,i)=>finite(n)&&<g key={i}><line x1={scale(n)} x2={scale(n)} y1="30" y2="83" stroke={[colors.gold,colors.green,colors.violet,colors.cyan,colors.red][i]} strokeWidth="2"/><text x={scale(n)} y={i%2?103:20} fontSize="10" fill="#cbdee9" textAnchor="middle">{['VSO','VS','VFE','VNO','VNE'][i]} {n.toFixed(0)}</text></g>)}
  {[0,.25,.5,.75,1].map(f=><g key={f}><path d={`M${scale(max*f)} 74v7`} stroke="#93b3c5"/><text x={scale(max*f)} y="122" fill="#8aa9bd" fontSize="11" textAnchor="middle">{Math.round(max*f)}</text></g>)}
  {finite(speed)&&<g><path d={`M${scale(speed)-8} 44l8 -16 8 16z`} fill="#fff"/><line x1={scale(speed)} x2={scale(speed)} y1="44" y2="75" stroke="white" strokeWidth="3"/></g>}
 </svg></div>;
}
function EngineCrossplot({points}:{points:TimelinePoint[]}) {
 const pairs=points.filter(p=>finite(p.n1l)&&finite(p.n1r));
 const toX=(x:number)=>58+x*4.55,toY=(x:number)=>235-x*1.95;
 return <div className="xmc-advanced-card"><div className="xmc-card-head"><div><b>ENGINE SYMMETRY PHASE SPACE</b><small>Left vs right N1 · synchronous real measurements · ±10% guide bands</small></div><small>{pairs.length} observations</small></div><svg viewBox="0 0 580 275" role="img" aria-label="Engine N1 symmetry scatter plot">
  {[0,25,50,75,100].map(n=><g key={n}><path d={`M${toX(n)} 40V235 M58 ${toY(n)}H515`} stroke="#26435a" strokeDasharray="3 6"/><text x={toX(n)} y="252" textAnchor="middle" fill="#9ab9c9" fontSize="10">{n}</text><text x="48" y={toY(n)+4} textAnchor="end" fill="#9ab9c9" fontSize="10">{n}</text></g>)}
  <path d={`M${toX(0)} ${toY(0)}L${toX(100)} ${toY(100)}`} stroke={colors.green} fill="none" strokeWidth="1.4" strokeDasharray="6 5"/>
  <path d={`M${toX(10)} ${toY(0)}L${toX(100)} ${toY(90)} M${toX(0)} ${toY(10)}L${toX(90)} ${toY(100)}`} stroke={colors.gold} fill="none" strokeOpacity=".8" strokeDasharray="4 7"/>
  {pairs.filter((_,i)=>i%Math.max(1,Math.ceil(pairs.length/450))===0).map((p,i)=><circle key={i} cx={toX(p.n1l!)} cy={toY(p.n1r!)} r="2.2" fill={colors.cyan} opacity=".7"/>)}
  <text x="290" y="271" textAnchor="middle" fill="#9ab9cb" fontSize="11">ENGINE 1 N1 (%)</text><text x="18" y="129" textAnchor="middle" transform="rotate(-90 18 129)" fill="#9ab9cb" fontSize="11">ENGINE 2 N1 (%)</text>
 </svg></div>;
}
function HeadingRose({t}:{t:ServerStatus['simulator']['telemetry']}){
 const hd=t.headingDegrees,track=t.flightPathDegrees;
 const arrow=(degrees:number|null,color:string,label:string)=>finite(degrees)?<g transform={`rotate(${degrees} 150 145)`}><path d="M150 48L144 86L150 75L156 86Z" fill={color}/><text x="150" y="38" fill={color} fontSize="11" textAnchor="middle">{label}</text></g>:null;
 return <div className="xmc-advanced-card"><div className="xmc-card-head"><div><b>HEADING / FLIGHT-PATH ROSE</b><small>Heading and vertical-plane flight-path angle are different quantities</small></div></div><svg viewBox="0 0 300 285" role="img" aria-label="Heading rose with aircraft heading">
  {[32,63,93].map(r=><circle key={r} cx="150" cy="145" r={r} fill="none" stroke="#31516a"/>)}
  {Array.from({length:24},(_,i)=>{const a=i*15*Math.PI/180;return <path key={i} d={`M${150+Math.sin(a)*85} ${145-Math.cos(a)*85}L${150+Math.sin(a)*94} ${145-Math.cos(a)*94}`} stroke="#6d96b3"/>;})}
  {['N','E','S','W'].map((s,i)=><text key={s} x={150+Math.sin(i*Math.PI/2)*110} y={148-Math.cos(i*Math.PI/2)*109} textAnchor="middle" fill="#a9c5d8" fontSize="13">{s}</text>)}
  {arrow(hd,colors.cyan,'HDG')}<circle cx="150" cy="145" r="5" fill="#d4e6ed"/><text x="150" y="262" fill="#c7e1f0" textAnchor="middle" fontSize="12">HDG {value(hd)}° · VPATH {value(track,1)}°</text>
 </svg></div>;
}
export function FlightAnalytics({status,connected}:{status:ServerStatus;connected:boolean}) {
 const t=status.simulator.telemetry,live=connected&&status.simulator.reachable&&status.simulator.telemetryFresh;
 const [points,setPoints]=useState<TimelinePoint[]>([]);
 const at=t.receivedAt;
 useEffect(()=>{if(!live||at===null)return;setPoints(prev=>{if(prev.at(-1)?.at===at)return prev;const next=toTimelinePoint(t,at);return [...prev,next].filter(p=>at-p.at<=900000).slice(-9000);});},[live,at]);
 const situation=picture(status,connected);const native=status.simulator.advisoryEvents??[];
 return <section className="xmc-pro-suite"><header className="xmc-pro-heading"><div><span>FLIGHT ANALYTICS / OBSERVATION WORKBENCH</span><h2>Flight situation & advanced analytics</h2><p>Timestamp-aligned real readbacks. Unsupported sensors are unavailable, never estimated.</p></div><span className={`xmc-condition ${situation.condition.toLowerCase()}`}>{situation.condition}</span></header>
 <div className="xmc-pro-kpis">{[['FLIGHT PHASE',situation.phase],['DATA INTEGRITY',situation.quality],['SOURCE',status.simulator.transport??'UDP'],['ADVISORY COUNT',String(situation.evidence.length)],['SAMPLES',String(points.length)]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
 <SpeedEnvelope t={t}/><MultiTrack points={points} events={native}/><div className="xmc-advanced-grid"><EngineCrossplot points={points}/><HeadingRose t={t}/></div>
 <div className="xmc-advanced-card"><div className="xmc-card-head"><div><b>OBSERVED EXCEPTIONS</b><small>Explicit source evidence · unverified heuristics are not aircraft warnings</small></div></div><div className="xmc-evidence">{situation.evidence.length?situation.evidence.map(e=><div key={e.name}><b>{e.level} · {e.name}</b><span>{e.observed}</span><small>{e.context}</small></div>):<p>None flagged from the available advisory rules. This does not imply all aircraft systems are healthy.</p>}</div></div>
 </section>;
}
