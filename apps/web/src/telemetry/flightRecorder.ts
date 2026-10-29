import type { FlightTelemetry, ServerStatus } from '@xplane/shared';
import { toTimelinePoint,type TimelinePoint } from './flightAnalytics';
export interface RecorderEvent {at:number; kind:'phase'|'advisory'|'recording'|'configuration'; label:string; detail:string; }
export interface FlightArchive {schema:'xmc.flight-record.v1'; createdAt:string; source:'live'|'demonstration'; aircraftIcao:string|null; samples:TimelinePoint[];events:RecorderEvent[];}
export function archiveFrom(samples:TimelinePoint[],events:RecorderEvent[],icao:string|null,source:'live'|'demonstration'='live'):FlightArchive{
 return {schema:'xmc.flight-record.v1',createdAt:new Date().toISOString(),source,aircraftIcao:icao,samples,events};
}
const valid=(x:unknown):x is number|null=>x===null||(typeof x==='number'&&Number.isFinite(x));
export function parseArchive(raw:string):FlightArchive {
 if(raw.length>16_000_000)throw Error('Archive exceeds the import size limit');
 const v:unknown=JSON.parse(raw);if(!v||typeof v!=='object')throw Error('Invalid archive');
 const x=v as Partial<FlightArchive>;
 if(x.schema!=='xmc.flight-record.v1'||!Array.isArray(x.samples)||!Array.isArray(x.events)||x.samples.length>150000||x.events.length>5000||!(x.source==='live'||x.source==='demonstration'))throw Error('Unsupported flight archive');
 const fields=['ias','alt','vs','bank','pitch','n1l','n1r','egtl','egtr','throttle','flap','risk','gear','ap'] as const;
 let last=-Infinity;
 for(const p of x.samples){if(!p||!Number.isSafeInteger(p.at)||p.at<0||p.at<last||fields.some(f=>!valid(p[f])))throw Error('Invalid flight sample');last=p.at;}
 for(const e of x.events){if(!e||!Number.isSafeInteger(e.at)||e.at<0||!['phase','advisory','recording','configuration'].includes(e.kind)||typeof e.label!=='string'||e.label.length>200||typeof e.detail!=='string'||e.detail.length>1000)throw Error('Invalid flight event');}
 if(x.aircraftIcao!==null&&typeof x.aircraftIcao!=='string')throw Error('Invalid aircraft name');
 if(typeof x.createdAt!=='string')throw Error('Invalid creation time');
 return x as FlightArchive;
}
export function measure(samples:readonly TimelinePoint[]) {
 const validNumbers=(k:keyof TimelinePoint)=>samples.map(s=>s[k]).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
 const max=(k:keyof TimelinePoint)=>{const v=validNumbers(k);return v.length?v.reduce((m,x)=>x>m?x:m,-Infinity):null;};
 const absolute=(k:keyof TimelinePoint)=>{const v=validNumbers(k);return v.length?v.reduce((m,x)=>Math.max(m,Math.abs(x)),0):null;};
 const left=validNumbers('n1l'),right=validNumbers('n1r');
 const pairs=samples.filter(x=>x.n1l!==null&&x.n1r!==null);
 const meanAsymmetry=pairs.length?pairs.reduce((acc,p)=>acc+Math.abs(p.n1l!-p.n1r!),0)/pairs.length:null;
 return {count:samples.length,durationSeconds:samples.length?Math.max(0,(samples.at(-1)!.at-samples[0].at)/1000):0,maxIas:max('ias'),maxAltitude:max('alt'),maxAbsoluteBank:absolute('bank'),maxAbsolutePitch:absolute('pitch'),maxAbsoluteVerticalSpeed:absolute('vs'),maxAdvisoryRisk:max('risk'),meanN1Asymmetry:meanAsymmetry,engineLeftSamples:left.length,engineRightSamples:right.length};
}
export function sampleFromServer(status:ServerStatus):TimelinePoint|null {
 const t:FlightTelemetry=status.simulator.telemetry;
 if(!status.simulator.reachable||!status.simulator.telemetryFresh||t.receivedAt===null)return null;
 return toTimelinePoint(t,t.receivedAt);
}
/** Explicitly synthetic data; never mix with a real aircraft recording. */
export function demonstration(kind:'normal'|'approach'|'asymmetry'|'systems'):FlightArchive {
 const start=Date.UTC(2026,0,1,12);const samples:TimelinePoint[]=[];const events:RecorderEvent[]=[];
 for(let i=0;i<120;i++){
 const at=start+i*1000,approach=kind==='approach',asymmetric=kind==='asymmetry';
 samples.push({at,ias:approach?155-i*.27:225+i*.07,alt:approach?3400-i*24:12000+i*4,vs:approach?-1400-(i>75?450:0):240,bank:approach&&i>70?24:2*Math.sin(i/14),pitch:2.3+Math.sin(i/12),n1l:67+2*Math.sin(i/13),n1r:asymmetric&&i>60?29:66+1.5*Math.sin(i/13),egtl:635+i*.07,egtr:asymmetric&&i>60?505:637+i*.03,throttle:.61,flap:approach?.72:0,risk:i>75&&kind!=='normal'?50:0,gear:approach?1:0,ap:1});
 }
 if(kind!=='normal')events.push({at:start+76000,kind:'advisory',label:kind==='approach'?'Unstable approach (scenario)':kind==='asymmetry'?'N1 asymmetry (scenario)':'System advisory (scenario)',detail:'Synthetic demonstration event, not sourced from X-Plane'});
 return archiveFrom(samples,events,'DEMO','demonstration');
}
