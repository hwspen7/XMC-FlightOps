import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { FlightTelemetry, ServerStatus } from '@xplane/shared';
import type { HistoryPoint } from '../../hooks/useTelemetryHistory';
import { aircraftToWorld, project3d, toLocalTrack, toTrackScene, validPosition, type Vec3 } from '../../telemetry/spatialMath';
import '../../styles/spatial-monitor.css';

const finite=(v:number|null|undefined):v is number=>typeof v==='number'&&Number.isFinite(v);
const fmt=(v:number|null|undefined,n=1)=>finite(v)?v.toFixed(n):'—';
const C={cyan:'#61d7f5',lime:'#4ce2b1',amber:'#eabd70',violet:'#b5affb'};
type Camera='ISO'|'REAR'|'TOP';
const cameras:Record<Camera,{a:number;e:number}>={ISO:{a:45,e:30},REAR:{a:0,e:18},TOP:{a:45,e:85}};
const fuselage:Vec3[]=[{x:9,y:0,z:0},{x:5,y:.7,z:0},{x:-7,y:.7,z:0},{x:-10,y:0,z:.2},{x:-7,y:-.7,z:0},{x:5,y:-.7,z:0}];
const wings:Vec3[]=[{x:2,y:-11,z:0},{x:-1,y:-11,z:.35},{x:-3,y:-.9,z:0},{x:-3,y:.9,z:0},{x:-1,y:11,z:.35},{x:2,y:11,z:0},{x:2,y:0,z:0}];
const tail:Vec3[]=[{x:-6,y:-4.6,z:.6},{x:-9,y:-4.6,z:.6},{x:-9,y:4.6,z:.6},{x:-6,y:4.6,z:.6}];
const fin:Vec3[]=[{x:-8,y:0,z:0},{x:-9.7,y:0,z:4},{x:-6.4,y:0,z:2},{x:-6,y:0,z:0}];

function Card({title,sub,children}:{title:string;sub:string;children:ReactNode}) {
  return <section className="xsp-card"><div className="xsp-header"><strong>{title}</strong><small>{sub}</small></div>{children}</section>;
}
function AircraftView({t,live}:{t:FlightTelemetry;live:boolean}) {
  const [camera,setCamera]=useState<Camera>('ISO');
  const pose=live && finite(t.rollDegrees)&&finite(t.pitchDegrees)&&finite(t.headingDegrees)
    ? {roll:t.rollDegrees,pitch:t.pitchDegrees,heading:t.headingDegrees}:null;
  const {a:eastAzimuth,e}=cameras[camera];
  const a=camera==='REAR'&&pose?(pose.heading+180)%360:eastAzimuth;
  const pos=(p:Vec3)=>{
    const projected=project3d(p,a,e);
    return `${(230+projected.x*7.2).toFixed(1)},${(127+projected.y*7.2).toFixed(1)}`;
  };
  const shape=(p:Vec3[])=>pose?p.map(v=>pos(aircraftToWorld(v,pose))).join(' '):'';
  const grid=Array.from({length:9},(_,i)=>(i-4)*10);
  return <Card title="3D AIRCRAFT ATTITUDE" sub="BODY AXES / ACTUAL SIMULATOR ORIENTATION">
    <div className="xsp-controls" role="group" aria-label="3D aircraft camera">
      {(['ISO','REAR','TOP'] as const).map(v=><button type="button" aria-pressed={camera===v} className={camera===v?'current':''} key={v} onClick={()=>setCamera(v)}>{v}</button>)}
    </div>
    <svg viewBox="0 0 460 252" className="xsp-svg" role="img" aria-label="Three-dimensional aircraft attitude wireframe with heading pitch and bank">
      <defs><linearGradient id="xsp-wing-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#67dafa" stopOpacity=".75"/><stop offset="1" stopColor="#164a72" stopOpacity=".55"/></linearGradient></defs>
      {grid.map(v=><g key={v} stroke="#1a4860" strokeWidth="1" opacity=".7"><polyline points={[{x:-40,y:v,z:-9},{x:40,y:v,z:-9}].map(pos).join(' ')} fill="none"/><polyline points={[{x:v,y:-40,z:-9},{x:v,y:40,z:-9}].map(pos).join(' ')} fill="none"/></g>)}
      <circle cx="230" cy="127" r="3" fill="#467388"/>
      {pose&&<>
        <polygon points={shape(wings)} fill="url(#xsp-wing-fill)" stroke={C.cyan} strokeWidth="2" strokeLinejoin="round"/>
        <polygon points={shape(tail)} fill="#28648a" fillOpacity=".75" stroke="#8ee3fc" strokeWidth="1.6"/>
        <polygon points={shape(fin)} fill="#5cc6e2" fillOpacity=".5" stroke="#a2edff" strokeWidth="1.6"/>
        <polygon points={shape(fuselage)} fill="#c9edfa" fillOpacity=".84" stroke="#eafaff" strokeWidth="1"/>
        <circle cx={pos(aircraftToWorld({x:9,y:0,z:0},pose)).split(',')[0]} cy={pos(aircraftToWorld({x:9,y:0,z:0},pose)).split(',')[1]} r="3" fill="#ffcc6a"/>
      </>}
      {!pose&&<text x="230" y="126" textAnchor="middle" fill="#94b9c9" fontSize="13">ATTITUDE SIGNAL UNAVAILABLE</text>}
      <text x="12" y="242" fontSize="10" fill="#769db6">ORTHOGRAPHIC SCHEMATIC · NOT TERRAIN</text>
    </svg>
    <div className="xsp-data"><span>BANK <b>{fmt(pose?.roll)}°</b></span><span>PITCH <b>{fmt(pose?.pitch)}°</b></span><span>HDG <b>{fmt(pose?.heading,0)}°</b></span></div>
  </Card>;
}
function TrackView({history,live,aglFeet}:{history:HistoryPoint[];live:boolean;aglFeet:number|null}) {
  const [azimuth,setAzimuth]=useState(45);
  const observed=useMemo(()=>history.filter(p=>validPosition({latitude:p.latitude,longitude:p.longitude,altitudeFeet:p.altitude})).slice(-400),[history]);
  const track=useMemo(()=>toLocalTrack(observed.map(p=>({latitude:p.latitude!,longitude:p.longitude!,altitudeFeet:p.altitude!,at:p.at}))),[observed]);
  const projected=track.map(p=>project3d(toTrackScene(p,2),azimuth,35));
  const horizontal=Math.max(.25,...track.map(p=>Math.hypot(p.x,p.y)));
  const vertical=Math.max(.2,...track.map(p=>Math.abs(toTrackScene(p,2).z)));
  const scale=Math.min(140/horizontal,72/vertical,15);
  const origin={x:202,y:163};
  const pt=(p:{x:number;y:number})=>({x:origin.x+p.x*scale,y:origin.y+p.y*scale});
  const line=(points:{x:number;y:number}[])=>points.map((p,i)=>{const q=pt(p);return `${i?'L':'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;}).join(' ');
  const flat=track.map(p=>project3d({...p,z:0},azimuth,35));
  return <Card title="3D FLIGHT PATH / ALTITUDE" sub="OBSERVED LAT / LON / MSL ALT · 5-MINUTE MEMORY">
    <div className="xsp-controls"><button type="button" onClick={()=>setAzimuth(a=>(a+45)%360)}>ROTATE VIEW ↻</button><small>VERTICAL ×2 · HORIZONTAL & VERTICAL IN KM</small></div>
    <svg viewBox="0 0 420 252" className="xsp-svg" role="img" aria-label="Three-dimensional ground track with vertical altitude profile">
      {[-2,-1,0,1,2].map(k=><g key={k} stroke="#1d5066" opacity=".65" strokeWidth="1">
        <path d={line([project3d({x:-horizontal*1.2,y:k*horizontal/2,z:0},azimuth,35),project3d({x:horizontal*1.2,y:k*horizontal/2,z:0},azimuth,35)])} fill="none"/>
        <path d={line([project3d({x:k*horizontal/2,y:-horizontal*1.2,z:0},azimuth,35),project3d({x:k*horizontal/2,y:horizontal*1.2,z:0},azimuth,35)])} fill="none"/>
      </g>)}
      {track.length>1&&<><path d={line(flat)} fill="none" stroke="#39768a" strokeWidth="1.5" strokeDasharray="5 4"/>
        {projected.filter((_,i)=>i%Math.max(1,Math.floor(projected.length/24))===0).map((p,i)=>{const ground=pt(flat[i*Math.max(1,Math.floor(projected.length/24))]);const top=pt(p);return <line key={i} x1={ground.x} y1={ground.y} x2={top.x} y2={top.y} stroke="#4ccfa9" strokeDasharray="2 5" opacity=".65"/>;})}
        <path d={line(projected)} fill="none" stroke={C.cyan} strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx={pt(projected[projected.length-1]).x} cy={pt(projected[projected.length-1]).y} r="5" stroke="#fff" strokeWidth="1.3" fill="#f2c67e"/>
      </>}
      {track.length<2&&<text x="210" y="119" textAnchor="middle" fill="#8cb3c4" fontSize="12">TRACK + ALTITUDE SAMPLES REQUIRED</text>}
      <text x="10" y="244" fontSize="10" fill="#7c9eb3">DISPLAY RELATIVE TO FIRST SAMPLE · NOT NAVIGATION GRADE</text>
    </svg>
    <div className="xsp-data"><span>VALID PTS <b>{track.length}</b></span><span>MSL Δ <b>{track.length>1?fmt((observed.at(-1)!.altitude!-observed[0].altitude!),0):'—'} FT</b></span><span>AGL <b>{fmt(live?aglFeet:null,0)} FT</b></span><span>{live?'LIVE':'STALE'}</span></div>
  </Card>;
}
function VectorView({status,live}:{status:ServerStatus;live:boolean}) {
  const t=status.simulator.telemetry,c=status.control;
  const roll=live&&finite(c.inputRoll)?Math.max(-1,Math.min(1,c.inputRoll)):null;
  const pitch=live&&finite(c.inputPitch)?Math.max(-1,Math.min(1,c.inputPitch)):null;
  const available=roll!==null&&pitch!==null;
  const neutral=project3d({x:0,y:0,z:0},42,34);
  const end=available?project3d({x:roll!*6,y:pitch!*6,z:4},42,34):neutral;
  const sx=(x:number)=>210+x*11,sy=(y:number)=>120+y*11;
  const rates=[['ROLL RATE',t.rollRateDegreesPerSecond,C.cyan],['PITCH RATE',t.pitchRateDegreesPerSecond,C.amber],['YAW RATE',t.yawRateDegreesPerSecond,C.violet]] as const;
  return <Card title="3D CONTROL VECTOR / RATES" sub="PHONE COMMAND VS ACTUAL BODY ROTATION">
    <svg viewBox="0 0 420 182" className="xsp-vector-svg" role="img" aria-label="Three-axis control vector derived from mobile roll and pitch command">
      {([{x:10,y:0,z:0,c:C.cyan,l:'R'},{x:0,y:10,z:0,c:C.amber,l:'P'},{x:0,y:0,z:10,c:C.lime,l:'UP'}]).map(v=>{const b=project3d(v,42,34);return <g key={v.l}><line x1="210" y1="120" x2={sx(b.x)} y2={sy(b.y)} stroke={v.c} strokeWidth="1.5"/><text x={sx(b.x)+4} y={sy(b.y)} fontSize="11" fill={v.c}>{v.l}</text></g>;})}
      {available&&<><line x1="210" y1="120" x2={sx(end.x)} y2={sy(end.y)} stroke="#f6f8fe" strokeWidth="3"/><circle cx={sx(end.x)} cy={sy(end.y)} r="5" fill="#f4c474" stroke="#fff"/></>}
      {!available&&<text x="205" y="95" fontSize="12" fill="#8daebe" textAnchor="middle">PHONE INPUT UNAVAILABLE</text>}
    </svg>
    <div className="xsp-mini-rates">{rates.map(([name,value,color])=><div key={name}><span>{name}</span><b>{fmt(live?value:null,2)}°/S</b><div><i style={{width:`${live&&finite(value)?Math.min(100,Math.abs(value)/20*100):0}%`,background:color}}/></div></div>)}</div>
    <div className="xsp-data"><span>PHONE R <b>{fmt(roll,2)}</b></span><span>PHONE P <b>{fmt(pitch,2)}</b></span><span>G <b>{fmt(live?t.normalLoadG:null,2)}</b></span></div>
  </Card>;
}
export function SpatialMonitor({status,connected,history}:{status:ServerStatus;connected:boolean;history:HistoryPoint[]}) {
  const live=connected&&status.simulator.reachable&&status.simulator.telemetryFresh;
  return <section className="xsp-suite" aria-label="Three-dimensional simulator monitoring">
    <div className="xsp-heading"><strong>SPATIAL FLIGHT MONITORING / 3D</strong><span>GEOMETRIC PROJECTIONS · SIMULATOR READBACK ONLY</span></div>
    <div className="xsp-grid"><AircraftView t={status.simulator.telemetry} live={live}/><TrackView history={history} live={live} aglFeet={status.simulator.telemetry.aglFeet}/><VectorView status={status} live={live}/></div>
  </section>;
}
