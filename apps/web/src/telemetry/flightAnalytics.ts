import type { FlightTelemetry, ServerStatus } from '@xplane/shared';

export type OperationalPhase = 'UNAVAILABLE' | 'GROUND' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'APPROACH' | 'LANDING';
export type Condition = 'UNKNOWN'|'NORMAL'|'ADVISORY'|'CAUTION'|'WARNING';
export type Quality = 'OFFLINE'|'STALE'|'PARTIAL'|'GOOD';
export interface Evidence { name:string; observed:string; context:string; level:Condition; }
export interface OperationalPicture { phase:OperationalPhase; condition:Condition; quality:Quality; evidence:Evidence[]; }
const valid = (n:number|null|undefined):n is number=>typeof n==='number'&&Number.isFinite(n);
export const value = (n:number|null|undefined,digits=0)=>valid(n)?n.toFixed(digits):'—';

/** Aircraft-agnostic advisory interpretation. Neither inferred flags nor absence of data are certified warnings. */
export function picture(status:ServerStatus, connected:boolean):OperationalPicture {
 const s=status.simulator, t=s.telemetry;
 if (!connected || !s.reachable || !s.telemetryFresh) return {phase:'UNAVAILABLE',condition:'UNKNOWN',quality:connected?'STALE':'OFFLINE',evidence:[]};
 const populated=Object.values(t).filter(x=>typeof x==='number'&&Number.isFinite(x)).length;
 const quality:Quality=populated<16?'PARTIAL':'GOOD';
 const agl=t.aglFeet, vs=t.verticalSpeedFpm, ias=t.indicatedAirspeedKnots;
 let phase:OperationalPhase='UNAVAILABLE';
 if(t.onGround===1) phase=valid(ias)&&ias>=45?'TAKEOFF':'GROUND';
 else if(t.onGround===0){
   if(valid(agl)&&agl<150&&valid(vs)&&vs<-100) phase='LANDING';
   else if(valid(agl)&&agl<1800&&valid(vs)&&vs< -150) phase='APPROACH';
   else if(valid(vs)&&vs>300) phase='CLIMB';
   else if(valid(vs)&&vs< -300) phase='DESCENT';
   else if(valid(agl)&&agl>1800) phase='CRUISE';
 }
 const evidence:Evidence[]=[];
 const push=(name:string,condition:boolean,seen:boolean,observed:string,context:string,level:Condition)=>{if(seen&&condition)evidence.push({name,observed,context,level});};
 const airborne=t.onGround===0;
 push('Vne exceedance',valid(ias)&&valid(t.speedVneKnots)&&ias>t.speedVneKnots,airborne&&valid(ias)&&valid(t.speedVneKnots),`${value(ias)} kt / Vne ${value(t.speedVneKnots)} kt`,'Published simulator reference; aircraft-specific applicability not verified','WARNING');
 push('Low-speed reference',valid(ias)&&valid(t.speedVsKnots)&&ias<1.1*t.speedVsKnots,airborne&&valid(agl)&&agl>100&&valid(t.speedVsKnots),`${value(ias)} kt / Vs ${value(t.speedVsKnots)} kt`,'Reference margin only, not a stall prediction','CAUTION');
 push('Bank excursion',valid(t.rollDegrees)&&Math.abs(t.rollDegrees)>45,airborne&&valid(t.rollDegrees),`${value(t.rollDegrees,1)}° bank`,'Phase-aware bank advisory, not an aircraft operating limit','ADVISORY');
 push('High sink near terrain',valid(vs)&&vs< -1500,airborne&&valid(agl)&&agl<600&&valid(vs),`${value(vs)} ft/min / ${value(agl)} ft AGL`,'Ground-proximity heuristic, not a terrain-warning system','CAUTION');
 push('Gear indication mismatch',valid(t.gearHandleDown)&&[t.gearDeploy0Ratio,t.gearDeploy1Ratio,t.gearDeploy2Ratio].every(valid)&&[t.gearDeploy0Ratio,t.gearDeploy1Ratio,t.gearDeploy2Ratio].some(x=>valid(x)&& (t.gearHandleDown!>0.5?x<0.9:x>0.1)),airborne&&valid(agl)&&agl<2500,'Handle and position disagree','Ignore transient disagreement during movement; C++ analyzer provides debounce','ADVISORY');
 push('Engine spool asymmetry',valid(t.n1LeftPercent)&&valid(t.n1RightPercent)&&Math.abs(t.n1LeftPercent-t.n1RightPercent)>25,airborne&&valid(t.throttleRatio)&&t.throttleRatio>0.5,`ΔN1 ${value(valid(t.n1LeftPercent)&&valid(t.n1RightPercent)?Math.abs(t.n1LeftPercent-t.n1RightPercent):null,1)}%`,'Not applicable to intentional asymmetric thrust or single-engine aircraft','ADVISORY');
 if(valid(t.nativeRiskScore)&&t.nativeRiskScore>0) evidence.push({name:'Native flight-loop risk',observed:`${value(t.nativeRiskScore)}/100`,context:'Additional debounced advisories evaluated in the C++ plugin',level:t.nativeRiskScore>=60?'WARNING':t.nativeRiskScore>=30?'CAUTION':'ADVISORY'});
 const severity:Condition=evidence.some(x=>x.level==='WARNING')?'WARNING':evidence.some(x=>x.level==='CAUTION')?'CAUTION':evidence.length?'ADVISORY':'NORMAL';
 return {phase,condition:severity,quality,evidence};
}

export interface TimelinePoint {at:number; ias:number|null; alt:number|null; vs:number|null; bank:number|null; pitch:number|null; n1l:number|null; n1r:number|null; egtl:number|null; egtr:number|null; throttle:number|null; flap:number|null; risk:number|null; gear:number|null; ap:number|null; }
export function toTimelinePoint(t:FlightTelemetry,at:number):TimelinePoint { return {at,ias:t.indicatedAirspeedKnots,alt:t.altitudeFeet,vs:t.verticalSpeedFpm,bank:t.rollDegrees,pitch:t.pitchDegrees,n1l:t.n1LeftPercent,n1r:t.n1RightPercent,egtl:t.egtLeftC,egtr:t.egtRightC,throttle:t.throttleRatio,flap:t.flapDeployRatio,risk:t.nativeRiskScore,gear:t.gearHandleDown,ap:t.autopilotServosOn}; }
export type TrendKey=Exclude<keyof TimelinePoint,'at'>;
/** Keep both extrema and gaps. Never interpolate across missing telemetry. */
export function extrema(points:readonly TimelinePoint[], key:TrendKey, buckets:number):TimelinePoint[]{
 if(points.length<=buckets*3)return [...points];
 const step=Math.max(1,Math.ceil(points.length/buckets)); const selected=new Set<number>();
 for(let start=0;start<points.length;start+=step){ const end=Math.min(points.length,start+step);selected.add(start);selected.add(end-1);let lo=Infinity,hi=-Infinity,l=-1,h=-1;
  for(let i=start;i<end;i++){const x=points[i][key];if(!valid(x)){selected.add(i);continue;}if(x<lo){lo=x;l=i;}if(x>hi){hi=x;h=i;}}
  if(l>=0)selected.add(l);if(h>=0)selected.add(h);
 }
 return [...selected].sort((a,b)=>a-b).map(i=>points[i]);
}
export function phaseLabel(phase:number|null|undefined):OperationalPhase {
 return (['UNAVAILABLE','GROUND','TAKEOFF','CLIMB','CRUISE','DESCENT','APPROACH','LANDING'] as OperationalPhase[])[Math.trunc(phase??0)]??'UNAVAILABLE';
}
