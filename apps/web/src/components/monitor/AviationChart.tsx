import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import type { HistoryPoint } from '../../hooks/useTelemetryHistory';
import { CHART_MODES, bearingDegrees, clampZoom, deltaWorldX, isLikelyFaaCoverage, project, unproject, validGeo, visibleTiles, type AviationChartMode, type GeoPoint } from '../../telemetry/aviationMap';
import '../../styles/aviation-chart.css';

interface Props { t: FlightTelemetry; history: HistoryPoint[]; live: boolean }
const valid = (x:number|null|undefined):x is number=>typeof x==='number'&&Number.isFinite(x);
const fmt=(x:number|null|undefined,digits=2)=>valid(x)?x.toFixed(digits):'—';

export function AviationChart({t,history,live}:Props) {
  const aircraft=live && validGeo(t.latitudeDegrees,t.longitudeDegrees)
    ? {latitude:t.latitudeDegrees!,longitude:t.longitudeDegrees!} : null;
  const [mode,setMode]=useState<AviationChartMode>('vfr');
  const [zoom,setZoom]=useState(10);
  const [follow,setFollow]=useState(true);
  const [center,setCenter]=useState<GeoPoint|null>(null);
  const [dimensions,setDimensions]=useState({width:480,height:250});
  const [failed,setFailed]=useState(false);
  const viewport=useRef<HTMLDivElement|null>(null);
  const drag=useRef<{x:number;y:number;center:GeoPoint;active:boolean}|null>(null);
  const localCenter=follow && aircraft ? aircraft : center;
  const chart=CHART_MODES.find(c=>c.id===mode)!;
  const z=clampZoom(mode,zoom);
  const canDraw=localCenter!==null&&validGeo(localCenter.latitude,localCenter.longitude);
  const coverage=aircraft&&isLikelyFaaCoverage(aircraft.latitude,aircraft.longitude);

  useEffect(()=>{if(aircraft && !center) setCenter(aircraft);},[aircraft?.latitude,aircraft?.longitude,center]);
  useEffect(()=>{
    const element=viewport.current;
    if(!element || typeof ResizeObserver==='undefined') return;
    const resize=new ResizeObserver(([entry])=>{
      if(!entry) return;
      const width=Math.round(entry.contentRect.width),height=Math.round(entry.contentRect.height);
      setDimensions(old=>old.width===width && old.height===height?old:{width,height});
    });
    resize.observe(element);
    return ()=>resize.disconnect();
  },[]);
  const tiles=useMemo(()=>canDraw&&localCenter?visibleTiles(mode,localCenter,z,dimensions.width,dimensions.height):[],[mode,localCenter?.latitude,localCenter?.longitude,z,dimensions.width,dimensions.height]);
  const centerPixels=canDraw&&localCenter?project(localCenter.latitude,localCenter.longitude,z):null;
  const screen=(latitude:number,longitude:number)=>{
    if(!centerPixels) return {x:0,y:0};
    const pt=project(latitude,longitude,z);
    return {x:dimensions.width/2+deltaWorldX(pt.x,centerPixels.x,z), y:dimensions.height/2+pt.y-centerPixels.y};
  };
  const trace=history.filter(p=>validGeo(p.latitude,p.longitude));
  const lastObserved=trace.at(-1);
  const lastMoving=lastObserved?[...trace].reverse().slice(1).find(p=>
    Math.abs(p.latitude!-lastObserved.latitude!)+Math.abs(p.longitude!-lastObserved.longitude!)>0.00005):undefined;
  const observedTrack=lastObserved&&lastMoving?bearingDegrees(
    {latitude:lastMoving.latitude!,longitude:lastMoving.longitude!},
    {latitude:lastObserved.latitude!,longitude:lastObserved.longitude!}):null;
  let track=''; let last: {x:number;y:number}|null=null;
  for(const p of trace) {
    const q=screen(p.latitude!,p.longitude!);
    if(!Number.isFinite(q.x)||!Number.isFinite(q.y)) continue;
    track+=`${last && Math.abs(q.x-last.x)<dimensions.width/2?'L':'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)} `;
    last=q;
  }
  const aircraftScreen=aircraft?screen(aircraft.latitude,aircraft.longitude):null;
  const updateMode=(next:AviationChartMode)=>{setMode(next);setFailed(false);setZoom(v=>clampZoom(next,v));};
  const adjustZoom=(delta:number)=>setZoom(old=>clampZoom(mode,old+delta));
  const onWheel=(e:WheelEvent<HTMLDivElement>)=>{e.preventDefault();adjustZoom(e.deltaY<0?1:-1);};
  const pointerDown=(e:PointerEvent<HTMLDivElement>)=>{
    if(e.button!==0||!localCenter) return;
    setFollow(false);
    setCenter(localCenter);
    drag.current={x:e.clientX,y:e.clientY,center:localCenter,active:true};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pointerMove=(e:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current?.active) return;
    const base=project(drag.current.center.latitude,drag.current.center.longitude,z);
    const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;
    setCenter(unproject(base.x-dx,base.y-dy,z));
  };
  const pointerUp=(e:PointerEvent<HTMLDivElement>)=>{
    drag.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return <div className="xav-chart">
    <div className="xav-mode-row" role="group" aria-label="Aeronautical chart layers">
      {CHART_MODES.map(c=><button key={c.id} type="button" aria-pressed={mode===c.id} className={mode===c.id?'selected':''} onClick={()=>updateMode(c.id)}>{c.label}</button>)}
    </div>
    <div className="xav-map" ref={viewport} onWheel={onWheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      {canDraw&&tiles.map(tile=><img key={tile.id} src={tile.src} style={{left:tile.left,top:tile.top}} alt="" draggable={false} decoding="async" onError={()=>setFailed(true)}/>)}
      {canDraw&&<svg className="xav-track" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="none" aria-label="Observed aircraft position and five-minute ground track">
        <path d={track} fill="none" stroke="#081722" strokeWidth="5" strokeLinejoin="round" opacity=".85"/>
        <path d={track} fill="none" stroke="#11c2e8" strokeWidth="2.6" strokeLinejoin="round"/>
        {aircraftScreen&&<g transform={`translate(${aircraftScreen.x} ${aircraftScreen.y}) rotate(${valid(t.headingDegrees)?t.headingDegrees:0})`}>
          <circle r="18" fill="#032333" fillOpacity=".88" stroke="#61ecdd" strokeWidth="1"/>
          <path d="M0 -13 L3 -3 L13 4 L13 7 L2 4 L2 12 L5 14 L5 16 L0 14 L-5 16 L-5 14 L-2 12 L-2 4 L-13 7 L-13 4 L-3 -3 Z" fill="#c4ffeb"/>
          <path d="M0 -30V-19" stroke="#55e2ca" strokeWidth="2"/>
        </g>}
      </svg>}
      <div className="xav-controls">
        <button type="button" title="Zoom in" onPointerDown={(e:PointerEvent<HTMLButtonElement>)=>e.stopPropagation()} onClick={()=>adjustZoom(1)}>+</button>
        <button type="button" title="Zoom out" onPointerDown={(e:PointerEvent<HTMLButtonElement>)=>e.stopPropagation()} onClick={()=>adjustZoom(-1)}>−</button>
        <button type="button" title="Follow aircraft" aria-pressed={follow} className={follow?'selected':''} onPointerDown={(e:PointerEvent<HTMLButtonElement>)=>e.stopPropagation()} onClick={()=>{if(aircraft){setFollow(true);setCenter(aircraft);}}}>⌖</button>
      </div>
      {!canDraw && <div className="xav-empty">AWAITING VALID AIRCRAFT COORDINATES</div>}
      {mode!=='street'&&aircraft&&!coverage&&<div className="xav-notice">FAA chart coverage is regional. Select STREET outside the United States.</div>}
      {failed&&<div className="xav-notice xav-network">One or more chart tiles unavailable. Check network, zoom or geographic coverage.</div>}
      <div className="xav-attribution">{chart.attribution} · NOT FOR NAVIGATION</div>
      {canDraw&&<div className="xav-zoom-label">Z{z} · {follow?'FOLLOW':'FREE PAN'}</div>}
    </div>
    <div className="xav-readout"><span>LAT {fmt(aircraft?.latitude,5)}°</span><span>LON {fmt(aircraft?.longitude,5)}°</span><span>TRK {fmt(live?observedTrack:null,1)}°</span><span>FPA {fmt(live?t.flightPathDegrees:null,1)}°</span><span>{trace.length} PTS</span></div>
  </div>;
}
