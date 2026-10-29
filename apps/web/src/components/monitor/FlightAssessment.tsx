import type { FlightTelemetry, ServerStatus } from '@xplane/shared';
import type { HistoryPoint } from '../../hooks/useTelemetryHistory';
import { displayValue, normalizedHeading } from '../../telemetry/format';

const has = (x:number|null):x is number => x !== null && Number.isFinite(x);

interface Assessment { name:string; state:string; detail:string; status:'ok'|'watch'|'unknown'; }

export function assessFlight(status:ServerStatus, live:boolean, history:HistoryPoint[]):Assessment[] {
  const t=status.simulator.telemetry;
  if(!live) return [{name:'Telemetry',state:'NO LIVE DATA',detail:'Simulator values are unavailable or stale. No flight-state inference is possible.',status:'unknown'}];
  const results:Assessment[]=[];
  const phase=t.onGround===null?'UNKNOWN':t.onGround===1?'ON GROUND':'AIRBORNE';
  results.push({name:'Flight phase',state:phase,detail:has(t.aglFeet)?`Height AGL ${displayValue(t.aglFeet)} ft · IAS ${displayValue(t.indicatedAirspeedKnots)} kt`:'Ground-contact indication from simulator',status:t.onGround===null?'unknown':'ok'});
  const recent=history.filter(p=>p.ias!==null && history.at(-1)!.at-p.at<=15_000);
  if(recent.length>2){
    const first=recent[0],last=recent.at(-1)!;
    const elapsed=(last.at-first.at)/1000;
    const acceleration=elapsed>1?(last.ias!-first.ias!)/elapsed:null;
    results.push({name:'Airspeed trend',state:acceleration===null?'UNAVAILABLE':`${acceleration>=0?'+':''}${acceleration.toFixed(2)} KT/S`,detail:'Observed indicated-airspeed change over the last 15 seconds. Not physical acceleration.',status:'ok'});
  }
  if(has(t.speedVsKnots)&&has(t.indicatedAirspeedKnots)&&t.onGround!==1){
    const margin=t.indicatedAirspeedKnots-t.speedVsKnots;
    results.push({name:'Stall-speed reference',state:`${margin>=0?'+':''}${margin.toFixed(0)} KT`,detail:'Indicated airspeed relative to configured clean stall reference (VS); not a stall warning or maneuvering margin.',status:margin<0?'watch':'ok'});
  }
  if(has(t.selectedAltitudeFeet)&&has(t.altitudeFeet)){
    const error=t.selectedAltitudeFeet-t.altitudeFeet;
    results.push({name:'Altitude select',state:`${error>=0?'+':''}${displayValue(error)} FT`,detail:`Selected ${displayValue(t.selectedAltitudeFeet)} ft · Actual ${displayValue(t.altitudeFeet)} ft · Vertical ${displayValue(t.verticalSpeedFpm)} ft/min`,status:'ok'});
  }
  const gear=[t.gearDeploy0Ratio,t.gearDeploy1Ratio,t.gearDeploy2Ratio];
  const available=gear.filter(has);
  if(t.gearHandleDown!==null){
    const selected=t.gearHandleDown>.5?'DOWN':'UP';
    const positionsComplete=available.length===3;
    const match=positionsComplete&&available.every(v=>selected==='DOWN'?v>.97:v<.03);
    results.push({name:'Landing gear',state:!positionsComplete?`${selected} / UNVERIFIED`:match?`${selected} / POSITION MATCH`:'TRANSITION / DISAGREEMENT',detail:positionsComplete?`Three reported deployment ratios: ${available.map(v=>Math.round(v*100)+'%').join(' / ')}. Ratio is not a mechanical downlock sensor.`:'Gear handle state only. Individual gear positions unavailable.',status:positionsComplete&&!match?'watch':positionsComplete?'ok':'unknown'});
  }
  if(has(t.flapHandleRatio)&&has(t.flapDeployRatio)){
    const difference=Math.abs(t.flapHandleRatio-t.flapDeployRatio);
    results.push({name:'Flap tracking',state:difference>.04?'IN TRANSIT / OFFSET':'POSITION TRACKING',detail:`Lever ${(t.flapHandleRatio*100).toFixed(0)}% · Surface ${(t.flapDeployRatio*100).toFixed(0)}%. Ratio comparison is approximate for complex flap systems.`,status:difference>.04?'watch':'ok'});
  }
  results.push({name:'Automation / control ownership',state:t.autopilotServosOn===null?'AUTOPILOT STATUS UNKNOWN':t.autopilotServosOn===1?'AUTOPILOT SERVOS ON':'SERVOS OFF',detail:`Autothrottle: ${t.autothrottleOn===null?'UNKNOWN':t.autothrottleOn===1?'ON':'OFF'} · Mobile control: ${status.armed?'ARMED':'STANDBY'}`,status:'ok'});
  return results;
}

function number(t:FlightTelemetry,key:keyof FlightTelemetry,decimals=1):string {
  const value=t[key];return typeof value==='number'?displayValue(value,decimals):'---';
}
export function FlightAssessment({status,live,history}:{status:ServerStatus;live:boolean;history:HistoryPoint[]}){
 const t=status.simulator.telemetry;
 const items=assessFlight(status,live,history);
 return <section className="monitor-card monitor-assessment">
  <div className="card-heading"><div><span className="micro-label">SITUATION AWARENESS / SOURCE-GROUNDED</span><h2>Current aircraft state</h2><p className="chart-subtitle">Operational interpretation of live values, not certified flight warnings</p></div><span className="tag-outline">{live?`${t.aircraftIcao??'AIRCRAFT'} · ${status.simulator.transport??'SIM'}`:'NO TELEMETRY'}</span></div>
  <div className="monitor-assessment-grid">{items.map(item=><div key={item.name} className={`monitor-assessment-item ${item.status}`}><span>{item.name}</span><strong>{item.state}</strong><p>{item.detail}</p></div>)}</div>
  <div className="monitor-quick-readouts">
    <div><small>HEADING</small><strong>{live?normalizedHeading(t.headingDegrees):'---'}°</strong></div>
    <div><small>LOAD FACTOR</small><strong>{live?number(t,'normalLoadG',2):'---'} g</strong></div>
    <div><small>ANGLE OF ATTACK</small><strong>{live?number(t,'angleOfAttackDegrees',1):'---'}°</strong></div>
    <div><small>SIDESLIP</small><strong>{live?number(t,'sideslipDegrees',1):'---'}°</strong></div>
    <div><small>OUTSIDE AIR</small><strong>{live?number(t,'outsideAirTempC',1):'---'} °C</strong></div>
    <div><small>FUEL MASS</small><strong>{live?number(t,'fuelWeightKg',0):'---'} kg</strong></div>
  </div>
 </section>;
}

const metrics:[keyof FlightTelemetry,string,string,number][]=[
 ['n1LeftPercent','N1','%',1],['n2LeftPercent','N2','%',1],['egtLeftC','EGT','°C',0],['fuelFlowLeftKgS','FUEL FLOW','kg/h',0],['oilPressureLeftPsi','OIL PRESS','psi',1],
];
export function EngineSystems({t,live}:{t:FlightTelemetry;live:boolean}) {
 const rows=[{name:'ENGINE 1',keys:['n1LeftPercent','n2LeftPercent','egtLeftC','fuelFlowLeftKgS','oilPressureLeftPsi'] as const},{name:'ENGINE 2',keys:['n1RightPercent','n2RightPercent','egtRightC','fuelFlowRightKgS','oilPressureRightPsi'] as const}];
 return <section className="monitor-card monitor-engines"><div className="card-heading"><div><span className="micro-label">POWERPLANT / LIVE READBACK</span><h2>Engine condition & fuel flow</h2><p className="chart-subtitle">Values are descriptive. No aircraft-independent engine limit is assumed.</p></div><span className="tag-outline">ENGINE CHANNELS 1 / 2</span></div>
 <div className="monitor-engine-grid">{rows.map(engine=><div className="monitor-engine" key={engine.name}><h3>{engine.name}</h3>{engine.keys.map((k,i)=>{
   const label=metrics[i][1],unit=metrics[i][2];
   const raw=live?t[k]:null;
   const value=raw===null?'---':displayValue(k.startsWith('fuelFlow')?raw*3600:raw,metrics[i][3]);
   return <div className="monitor-engine-row" key={k}><span>{label}</span><strong>{value} <small>{unit}</small></strong>{(i<2&&raw!==null)&&<div className="monitor-engine-meter"><i style={{width:`${Math.max(0,Math.min(100,raw))}%`}}/></div>}</div>;
  })}</div>)}</div><p className="data-footnote">Displayed fuel flow converts simulator kg/s to kg/h. Unsupported engine measurements remain unavailable; two channels do not imply exactly two installed engines.</p></section>;
}
