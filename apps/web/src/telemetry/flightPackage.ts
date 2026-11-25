import { archiveCrcUpdate, archiveCrcHex, type FlightTelemetry, type ControlMonitor } from '@xplane/shared';

export interface FlightSample { type: 'sample'; at: number; telemetry: FlightTelemetry; control: ControlMonitor; }
export interface FlightPackage { aircraft: string; source: string; samples: FlightSample[]; complete: boolean; reason: string; integrity?: 'verified'|'legacy'|'incomplete'; totalSamples?:number; segment?:boolean; }
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function parseFlightPackage(raw: string): FlightPackage {
  return parseFlightLines(raw.split(/\r?\n/));
}
function parseFlightLines(lines:Iterable<string>):FlightPackage {
  const iterator=lines[Symbol.iterator]();
  let first=iterator.next();while(!first.done&&!first.value.trim())first=iterator.next();
  const header = JSON.parse(first.done?'{}':first.value);
  let crc=archiveCrcUpdate(0xffffffff,first.done?'':first.value+'\n');
  if (header.type !== 'manifest' || header.schema !== 'xmc.flight-package.v1') throw Error('Unsupported flight package');
  const samples: FlightSample[] = [];
  let end: { samples: number; reason: string; crc32?:string } | null = null;
  for (let next=iterator.next();!next.done;next=iterator.next()) {
    const line=next.value;if(!line.trim())continue;
    const p = JSON.parse(line);
    if(!p||typeof p!=='object')throw Error('Invalid archive row');
    if (end) throw Error('Unexpected data after archive footer');
    if (p.type === 'end') { if(!Number.isSafeInteger(p.samples)||typeof p.reason!=='string')throw Error('Invalid footer');end = p; continue; }
    if (p.type !== 'sample' || !Number.isSafeInteger(p.at) || !p.telemetry || !p.control ||
        typeof p.telemetry !== 'object' || typeof p.control !== 'object' || Array.isArray(p.telemetry)||Array.isArray(p.control)||p.at<0 ||
        (samples.length && p.at <= samples[samples.length - 1].at)) throw Error('Invalid or unordered sample');
    crc=archiveCrcUpdate(crc,line+'\n');samples.push(p);
  }
  if(end&&header.integrity==='crc32-jsonl'&&end.crc32!==archiveCrcHex(crc))throw Error('Archive checksum mismatch');
  if (!samples.length || (end && end.samples !== samples.length)) throw Error('Missing samples or count mismatch');
  return { aircraft: typeof header.aircraftIcao === 'string' ? header.aircraftIcao : 'UNKNOWN',
    source: String(header.source ?? 'unknown'), samples, complete: Boolean(end), reason: end?.reason ?? 'unfinalized',integrity:!end?'incomplete':header.integrity==='crc32-jsonl'?'verified':'legacy' };
}

const rad = Math.PI / 180;
export function displacement(a: FlightTelemetry, b: FlightTelemetry): [number, number] | null {
  if (!finite(a.latitudeDegrees) || !finite(a.longitudeDegrees) || !finite(b.latitudeDegrees) || !finite(b.longitudeDegrees) || Math.abs(a.latitudeDegrees)>90 || Math.abs(b.latitudeDegrees)>90 || Math.abs(a.longitudeDegrees)>180 || Math.abs(b.longitudeDegrees)>180) return null;
  const dlon = ((b.longitudeDegrees - a.longitudeDegrees + 540) % 360) - 180;
  const dlat = (b.latitudeDegrees - a.latitudeDegrees) * rad;
  const l = dlon * rad;
  const h = Math.sin(dlat/2)**2 + Math.cos(a.latitudeDegrees*rad)*Math.cos(b.latitudeDegrees*rad)*Math.sin(l/2)**2;
  const dist = 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0,h))));
  const bearing = Math.atan2(Math.sin(l)*Math.cos(b.latitudeDegrees*rad),
    Math.cos(a.latitudeDegrees*rad)*Math.sin(b.latitudeDegrees*rad)-Math.sin(a.latitudeDegrees*rad)*Math.cos(b.latitudeDegrees*rad)*Math.cos(l));
  return [dist*Math.sin(bearing), dist*Math.cos(bearing)];
}
export function phase(t: FlightTelemetry): string {
  const native = ['Unknown','Ground','Takeoff','Climb','Cruise','Descent','Approach','Landing'][t.nativeFlightPhase ?? 0];
  if (native && native !== 'Unknown') return native;
  if (t.onGround === 1) return (t.groundSpeedKnots ?? 0) < 2 ? 'Stopped' : 'Ground movement';
  if (t.onGround !== 0) return 'Unknown';
  if (!finite(t.verticalSpeedFpm)) return 'Airborne';
  return t.verticalSpeedFpm > 300 ? 'Climb' : t.verticalSpeedFpm < -300 ? (finite(t.aglFeet) && t.aglFeet < 1500 ? 'Approach' : 'Descent') : 'Level flight';
}
export interface FlightEvent { index: number; kind: 'Liftoff' | 'Touchdown'; bracketMs: number; }
export function flightEvents(s: readonly FlightSample[]): FlightEvent[] {
  const events: FlightEvent[] = [];
  for (let i=1;i<s.length;i++) {
    const a=s[i-1], b=s[i], dt=b.at-a.at;
    const sourceA=a.telemetry.nativeSampleTimeUs,sourceB=b.telemetry.nativeSampleTimeUs;
    const seqA=a.telemetry.nativeSampleSequence,seqB=b.telemetry.nativeSampleSequence;
    const bracket=finite(sourceA)&&finite(sourceB)&&finite(seqA)&&finite(seqB)&&seqB===seqA+1&&sourceB>sourceA?(sourceB-sourceA)/1000:dt;
    if (dt<=0 || dt>1000 || (a.telemetry.onGround!==0 && a.telemetry.onGround!==1) || (b.telemetry.onGround!==0 && b.telemetry.onGround!==1)) continue;
    if (a.telemetry.onGround!==b.telemetry.onGround) events.push({index:i,kind:b.telemetry.onGround===1?'Touchdown':'Liftoff',bracketMs:bracket});
  }
  return events;
}
export function distance(s: readonly FlightSample[], start: number, end: number): number | null {
  if (start>=end) return null;
  let total=0;
  for(let i=start+1;i<=end;i++){
    const d=displacement(s[i-1].telemetry,s[i].telemetry);
    if (!d || s[i].at-s[i-1].at>1000||s[i].at<=s[i-1].at) return null;
    total+=Math.hypot(...d);
  }
  return total;
}
export function controlMetrics(s: readonly FlightSample[], axis: 'Roll'|'Pitch') {
  // Same-snapshot native commands vs joystick readback; not physical surface angles.
  const command=axis==='Roll'?'nativeCommandRollRatio':'nativeCommandPitchRatio';
  const actual=axis==='Roll'?'simJoystickRollRatio':'simJoystickPitchRatio';
  const pairs=s.flatMap(p=>{const x=p.telemetry[command],y=p.telemetry[actual];return finite(x)&&finite(y)?[{x,y,at:p.at}]:[]});
  const n=pairs.length;
  const mean=(a:number[])=>a.reduce((sum,v)=>sum+v,0)/a.length;
  const mx=n?mean(pairs.map(p=>p.x)):0, my=n?mean(pairs.map(p=>p.y)):0;
  const varX=pairs.reduce((sum,p)=>sum+(p.x-mx)**2,0);
  const cov=pairs.reduce((sum,p)=>sum+(p.x-mx)*(p.y-my),0);
  const errors=pairs.map(p=>p.y-p.x);
  return { n, rms:n?Math.sqrt(mean(errors.map(e=>e*e))):null, bias:n?mean(errors):null,
    peak:n?errors.reduce((m,e)=>Math.max(m,Math.abs(e)),0):null, gain:n>=10&&varX>0.01?cov/varX:null };
}
// Exploratory input power spectrum, restricted to nearly regular contiguous samples.
export function spectrum(s: readonly FlightSample[], key: 'nativeCommandRollRatio'|'nativeCommandPitchRatio') {
  const a=s.slice(-256);
  if(a.length<32 || a.some(p=>!finite(p.telemetry[key]))) return [];
  const dt=(a[a.length-1].at-a[0].at)/(a.length-1);
  if(dt<=0 || a.some((p,i)=>i>0&&Math.abs(p.at-a[i-1].at-dt)>dt*.2)) return [];
  const values=a.map(p=>p.telemetry[key] as number), n=values.length;
  const mean=values.reduce((x,y)=>x+y,0)/n;
  return Array.from({length:Math.floor(n/2)},(_,i)=>{
    const k=i+1; let re=0,im=0;
    values.forEach((v,j)=>{const w=.5-.5*Math.cos(2*Math.PI*j/(n-1));const x=(v-mean)*w; re+=x*Math.cos(2*Math.PI*k*j/n);im-=x*Math.sin(2*Math.PI*k*j/n);});
    return {hz:k*1000/(n*dt),power:(re*re+im*im)/(n*n)};
  });
}

// Estimated lag is cross-correlation of recorded command and rate samples, not
// network latency or a proof of causal aircraft response.
export function observedLag(s: readonly FlightSample[], axis:'Roll'|'Pitch') {
  const xk=axis==='Roll'?'nativeCommandRollRatio':'nativeCommandPitchRatio';
  const yk=axis==='Roll'?'rollRateDegreesPerSecond':'pitchRateDegreesPerSecond';
  s=s.slice(-512);
  if(s.length<40 || s.some(p=>!finite(p.telemetry[xk])||!finite(p.telemetry[yk])||p.telemetry.autopilotServosOn!==0))return null;
  const dt=(s[s.length-1].at-s[0].at)/(s.length-1);
  if(dt<=0||s.some((p,i)=>i>0&&Math.abs(p.at-s[i-1].at-dt)>dt*.2))return null;
  let best=-1,bestLag=0;
  for(let lag=0;lag<=Math.min(Math.floor(2000/dt),Math.floor(s.length/4));lag++){
    const n=s.length-lag;
    const x=s.slice(0,n).map(p=>p.telemetry[xk] as number),y=s.slice(lag).map(p=>p.telemetry[yk] as number);
    const mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
    let xx=0,yy=0,xy=0;
    for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;}
    const r=xx/n>1e-4&&yy/n>1e-3?Math.abs(xy/Math.sqrt(xx*yy)):0;
    if(r>best){best=r;bestLag=lag;}
  }
  return best>=.5?{lagMs:bestLag*dt,correlation:best}:null;
}
export interface Runway { thresholdLat:number; thresholdLon:number; endLat:number; endLon:number; widthM:number; }
export function runwayPosition(r:Runway,t:FlightTelemetry) {
  if(![r.thresholdLat,r.endLat].every(x=>finite(x)&&Math.abs(x)<=90)||![r.thresholdLon,r.endLon].every(x=>finite(x)&&Math.abs(x)<=180)||!finite(r.widthM)||r.widthM<=0||r.widthM>200)return null;
  const a={latitudeDegrees:r.thresholdLat,longitudeDegrees:r.thresholdLon} as FlightTelemetry;
  const b={latitudeDegrees:r.endLat,longitudeDegrees:r.endLon} as FlightTelemetry;
  const direction=displacement(a,b),p=displacement(a,t);
  if(!direction||!p)return null;
  const length=Math.hypot(...direction);if(length<100||length>10000)return null;
  const [east,north]=direction;
  const along=(p[0]*east+p[1]*north)/length;
  const right=(p[0]*north-p[1]*east)/length;
  return {length,along,right,remaining:length-along,inside:along>=0&&along<=length&&Math.abs(right)<=r.widthM/2};
}

// Describe a measured joystick readback step only if a clean, sustained
// native-command step exists. This is not an aircraft closed-loop stability test.
export function stepTracking(s:readonly FlightSample[],axis:'Roll'|'Pitch') {
  const ck=axis==='Roll'?'nativeCommandRollRatio':'nativeCommandPitchRatio';
  const rk=axis==='Roll'?'simJoystickRollRatio':'simJoystickPitchRatio';
  s=s.slice(-1024);
  if(s.length<30)return null;
  for(let i=s.length-21;i>=8;i--){
    const before=s.slice(i-8,i),after=s.slice(i,i+21),all=[...before,...after];
    if(all.some((p,j)=>!finite(p.telemetry[ck])||!finite(p.telemetry[rk])||
      p.telemetry.autopilotServosOn!==0 || (j>0&&(p.at-all[j-1].at>250||p.at<=all[j-1].at))))continue;
    const mean=(a:readonly FlightSample[],k:typeof ck|typeof rk)=>a.reduce((sum,p)=>sum+(p.telemetry[k] as number),0)/a.length;
    const x0=mean(before,ck),x1=mean(after,ck),delta=x1-x0;
    if(Math.abs(delta)<.15||before.some(p=>Math.abs((p.telemetry[ck] as number)-x0)>.025)||
      after.some(p=>Math.abs((p.telemetry[ck] as number)-x1)>.025))continue;
    const y0=mean(before,rk),steady=mean(after.slice(-5),rk),target=y0+delta;
    if(Math.abs(y0-x0)>.08 || after.slice(-5).some(p=>Math.abs((p.telemetry[rk] as number)-steady)>.03))continue;
    const normalized=after.map(p=>((p.telemetry[rk] as number)-y0)/delta);
    const rise=normalized.findIndex(v=>v>=.9);
    let settling=-1;
    for(let j=0;j<normalized.length-4;j++){if(normalized.slice(j).every(v=>Math.abs(v-1)<=.05)){settling=j;break;}}
    return {at:after[0].at,amplitude:delta,overshootPercent:Math.max(0,...normalized.map(v=>(v-1)*100)),steadyError:target-steady,
      riseMs:rise<0?null:after[rise].at-after[0].at,settlingMs:settling<0?null:after[settling].at-after[0].at,
      observationMs:after[after.length-1].at-after[0].at};
  }
  return null;
}
// Welch H1 estimate of command-to-body angular rate. Require three segments
// of uninterrupted, near-uniform, manual control data. Low-excitation bins omitted.
export function responseSpectrum(s:readonly FlightSample[],axis:'Roll'|'Pitch') {
  const ck=axis==='Roll'?'nativeCommandRollRatio':'nativeCommandPitchRatio';
  const rk=axis==='Roll'?'rollRateDegreesPerSecond':'pitchRateDegreesPerSecond';
  const a=s.slice(-256),n=64,hop=32;
  if(a.length<128 || a.some(p=>!finite(p.telemetry[ck])||!finite(p.telemetry[rk])||p.telemetry.autopilotServosOn!==0))return [];
  const dt=(a[a.length-1].at-a[0].at)/(a.length-1);
  if(dt<=0||a.some((p,i)=>i>0&&Math.abs(p.at-a[i-1].at-dt)>dt*.2))return [];
  const sums=Array.from({length:n/2-1},()=>({xx:0,yy:0,re:0,im:0}));
  let segments=0;
  for(let off=0;off+n<=a.length;off+=hop){
    const x=a.slice(off,off+n).map(p=>p.telemetry[ck] as number),y=a.slice(off,off+n).map(p=>p.telemetry[rk] as number);
    const mx=x.reduce((u,v)=>u+v,0)/n,my=y.reduce((u,v)=>u+v,0)/n;
    segments++;
    for(let k=1;k<n/2;k++){
      let xr=0,xi=0,yr=0,yi=0;
      for(let j=0;j<n;j++){const w=.5-.5*Math.cos(2*Math.PI*j/(n-1)),c=Math.cos(2*Math.PI*k*j/n),si=-Math.sin(2*Math.PI*k*j/n);
        xr+=(x[j]-mx)*w*c;xi+=(x[j]-mx)*w*si;yr+=(y[j]-my)*w*c;yi+=(y[j]-my)*w*si;}
      const b=sums[k-1];b.xx+=xr*xr+xi*xi;b.yy+=yr*yr+yi*yi;b.re+=yr*xr+yi*xi;b.im+=yi*xr-yr*xi;
    }
  }
  return sums.flatMap((b,i)=>{if(b.xx/segments<.01||b.yy/segments<.01)return [];
    const coherence=Math.min(1,(b.re*b.re+b.im*b.im)/(b.xx*b.yy));
    if(coherence<.5)return [];
    return [{hz:(i+1)*1000/(n*dt),gain:Math.hypot(b.re,b.im)/b.xx,phaseDeg:Math.atan2(b.im,b.re)*180/Math.PI,coherence}];
  });
}
// Rotation candidate: sustained positive pitch rate before observed liftoff.
// A heuristic only, not a certified Vr or aircraft-specific rotation criterion.
export function rotationCandidate(s:readonly FlightSample[],index:number):number|null {
  if(index<2)return null;
  for(let i=index-1;i>=1&&s[index].at-s[i].at<=15000;i--){
    if(s[i].telemetry.onGround!==1 || s[i+1].at-s[i].at>1000)break;
    const p=s[i].telemetry;
    if(!finite(p.pitchRateDegreesPerSecond)||p.pitchRateDegreesPerSecond<1 || !finite(p.groundSpeedKnots)||p.groundSpeedKnots<30)continue;
    const prior=s[i-1].telemetry.pitchRateDegreesPerSecond;
    if(finite(prior)&&prior<1 && i+1<index && (s[i+1].telemetry.pitchRateDegreesPerSecond??0)>=1)return i;
  }
  return null;
}

// Stream text without a second complete raw string in memory. Retain full rows
// for replay and expose explicit memory limits rather than silently decimating.
export async function* fileLines(file:Blob):AsyncGenerator<string>{
  const magic=new Uint8Array(await file.slice(0,2).arrayBuffer());
  const bytes=magic[0]===31&&magic[1]===139?file.stream().pipeThrough(new DecompressionStream('gzip')):file.stream();
  const reader=bytes.pipeThrough(new TextDecoderStream()).getReader();
  let tail='';
  try{while(true){const {done,value}=await reader.read();if(done)break;const parts=(tail+value).split('\n');tail=parts.pop()??'';if(tail.length>1_000_000)throw Error('Archive row too large');for(const line of parts)yield line.replace(/\r$/,'');}if(tail.trim())yield tail;}finally{reader.releaseLock();}
}
export async function importFlightFile(file:Blob,range?:{startMinutes:number;durationMinutes:number}):Promise<FlightPackage>{
  if(range&&(!finite(range.startMinutes)||range.startMinutes<0||!finite(range.durationMinutes)||range.durationMinutes<=0))throw Error('Invalid replay interval');
  let totalSamples=0,lastAt=-1,firstAt:number|null=null;
  let header:Record<string,unknown>|null=null,end:{samples:number;reason:string;crc32?:string}|null=null,crc=0xffffffff;
  const samples:FlightSample[]=[];
  for await(const line of fileLines(file)){
    if(!line.trim())continue;
    const p=JSON.parse(line);
    if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid archive row');
    if(!header){if(p.type!=='manifest'||p.schema!=='xmc.flight-package.v1')throw Error('Unsupported flight package');header=p;crc=archiveCrcUpdate(crc,line+'\n');continue;}
    if(end)throw Error('Unexpected data after footer');
    if(p.type==='end'){if(!Number.isSafeInteger(p.samples)||typeof p.reason!=='string')throw Error('Invalid footer');end=p;continue;}
    if(p.type!=='sample'||!Number.isSafeInteger(p.at)||p.at<0||!p.telemetry||typeof p.telemetry!=='object'||Array.isArray(p.telemetry)||!p.control||typeof p.control!=='object'||Array.isArray(p.control)||(totalSamples>0&&p.at<=lastAt))throw Error('Invalid or unordered sample');
    lastAt=p.at;const originAt:number=firstAt??Number(p.at);firstAt=originAt;totalSamples++;
    crc=archiveCrcUpdate(crc,line+'\n');
    const relativeMs=Number(p.at)-originAt;
    if(range&&(relativeMs<range.startMinutes*60000||relativeMs>(range.startMinutes+range.durationMinutes)*60000))continue;
    if(samples.length>=500_000)throw Error('Replay memory limit: 500,000 samples. Original archive is intact.');
    samples.push(p);
  }
  if(end&&header?.integrity==='crc32-jsonl'&&end.crc32!==archiveCrcHex(crc))throw Error('Archive checksum mismatch');
  if(!header||!samples.length||(end&&end.samples!==totalSamples))throw Error('No samples in selected interval or archive count mismatch');
  return {aircraft:typeof header.aircraftIcao==='string'?header.aircraftIcao:'UNKNOWN',source:String(header.source??'unknown'),samples,complete:Boolean(end),reason:end?.reason??'unfinalized',totalSamples,segment:Boolean(range),integrity:!end?'incomplete':header.integrity==='crc32-jsonl'?'verified':'legacy'};
}
export function dataQuality(s:readonly FlightSample[]){
  let gaps=0,maxGap=0,missingPosition=0,missingControl=0,covered=0;
  for(let i=0;i<s.length;i++){
    const t=s[i].telemetry;
    if(!finite(t.latitudeDegrees)||!finite(t.longitudeDegrees))missingPosition++;
    if(!finite(t.nativeCommandRollRatio)||!finite(t.nativeCommandPitchRatio))missingControl++;
    if(i){const dt=s[i].at-s[i-1].at;maxGap=Math.max(maxGap,dt);if(dt>1000)gaps++;else covered+=dt;}
  }
  return {gaps,maxGap,missingPosition,missingControl,covered,span:s.length?s[s.length-1].at-s[0].at:0};
}
export interface AirportRunway extends Runway { airport:string; ident:string; displacedM:number; }
export function parseRunwayRow(line:string,airport:string):AirportRunway[]{
  const p=line.trim().split(/\s+/);
  if(p[0]!=='100'||p.length<26||!airport)return [];
  const widthM=Number(p[1]),latA=Number(p[9]),lonA=Number(p[10]),latB=Number(p[18]),lonB=Number(p[19]);
  const make=(ident:string,thresholdLat:number,thresholdLon:number,endLat:number,endLon:number,displacedM:number):AirportRunway=>({airport,ident,widthM,thresholdLat,thresholdLon,endLat,endLon,displacedM});
  const rows=[make(p[8],latA,lonA,latB,lonB,Number(p[11])),make(p[17],latB,lonB,latA,lonA,Number(p[20]))];
  return rows.filter(r=>{const rp=runwayPosition(r,{latitudeDegrees:r.thresholdLat,longitudeDegrees:r.thresholdLon} as FlightTelemetry);return rp&&finite(r.displacedM)&&r.displacedM>=0&&r.displacedM<rp.length;});
}
export async function importAirportRunways(file:Blob):Promise<AirportRunway[]>{
  const result:AirportRunway[]=[];let airport='';
  for await(const line of fileLines(file)){const p=line.trim().split(/\s+/,6);if(['1','16','17'].includes(p[0]))airport=p[0]==='1'?(p[4]??''):'';if(p[0]==='100')result.push(...parseRunwayRow(line,airport));}
  if(!result.length)throw Error('No supported land runways in apt.dat');return result;
}
export function matchRunway(runways:readonly AirportRunway[],t:FlightTelemetry){
  const aircraftHeading=t.headingDegrees;
  if(!finite(aircraftHeading))return null;
  const candidates=runways.flatMap(r=>{const p=runwayPosition(r,t);if(!p||p.along < -100||p.along > p.length+100||Math.abs(p.right)>r.widthM/2+15)return [];
    const v=displacement({latitudeDegrees:r.thresholdLat,longitudeDegrees:r.thresholdLon} as FlightTelemetry,{latitudeDegrees:r.endLat,longitudeDegrees:r.endLon} as FlightTelemetry);
    if(!v)return [];const heading=Math.atan2(v[0],v[1])*180/Math.PI;
    const error=Math.abs(((aircraftHeading-heading+540)%360)-180);if(error>35)return [];
    return [{runway:r,score:Math.abs(p.right)+error*2+Math.max(0,-p.along,p.along-p.length)}];}).sort((a,b)=>a.score-b.score);
  return candidates.length&&(!candidates[1]||candidates[1].score-candidates[0].score>8)?candidates[0].runway:null;
}
// Keep transient contact events separately; no fictitious wheel-level data.
export function contactDetails(s:readonly FlightSample[],event:FlightEvent){
  const i=event.index,ground=event.kind==='Touchdown'?1:0;let end=i;
  while(end+1<s.length&&s[end+1].at-s[end].at<=1000&&s[end+1].telemetry.onGround===ground&&s[end].at-s[i].at<3000)end++;
  const duration=s[end].at-s[i].at;
  const next=s[end+1],reverted=next&&next.at-s[end].at<=1000&&next.telemetry.onGround===1-ground;
  return {duration,classification:duration>=1000?'sustained':reverted?'transient':'unconfirmed',
    peakG:event.kind==='Touchdown'?s.slice(i,end+1).reduce<number|null>((m,p)=>finite(p.telemetry.normalLoadG)?Math.max(m??-Infinity,p.telemetry.normalLoadG):m,null):null};
}

// Prefer source sampling time for local numerical analysis only when all
// samples have a coherent native clock and consecutive packet sequences.
export function sourceTimedWindow(s:readonly FlightSample[]):FlightSample[]{
  if(s.length<2)return [...s];
  const first=s[0].telemetry.nativeSampleTimeUs;
  if(!finite(first)||s.some((p,i)=>!finite(p.telemetry.nativeSampleTimeUs)||!finite(p.telemetry.nativeSampleSequence)||
    (i>0&&((p.telemetry.nativeSampleSequence as number)!==(s[i-1].telemetry.nativeSampleSequence as number)+1||
    (p.telemetry.nativeSampleTimeUs as number)<=(s[i-1].telemetry.nativeSampleTimeUs as number)))))return [];
  return s.map(p=>({...p,at:((p.telemetry.nativeSampleTimeUs as number)-first)/1000}));
}

// Runway roll is restricted to contiguous in-bounds aircraft reference samples.
// No extrapolation across a gap, runway turnoff or missing contact state.
export function runwayRoll(s:readonly FlightSample[],event:FlightEvent,r:Runway){
  const i=event.index,p=runwayPosition(r,s[i].telemetry);
  if(!p?.inside)return null;
  let start=i,end=i;
  const valid=(a:number,b:number)=>{const q=runwayPosition(r,s[a].telemetry);return s[a].telemetry.onGround===1&&q?.inside&&Math.abs(s[a].at-s[b].at)<=1000;};
  if(event.kind==='Liftoff'){while(start>0&&valid(start-1,start))start--;}
  else {while(end+1<s.length&&valid(end+1,end)){end++;if(finite(s[end].telemetry.groundSpeedKnots)&&s[end].telemetry.groundSpeedKnots!<2)break;}}
  if(start===end)return null;
  const a=runwayPosition(r,s[start].telemetry),b=runwayPosition(r,s[end].telemetry);
  if(!a||!b||b.along<a.along)return null;
  const traveled=distance(s,start,end);if(traveled===null)return null;
  return {start,end,stationChangeM:b.along-a.along,pathM:traveled,
    durationS:(s[end].at-s[start].at)/1000,startsAtArchiveBoundary:start===0,endsAtArchiveBoundary:end===s.length-1,
    stopObserved:event.kind==='Touchdown'&&finite(s[end].telemetry.groundSpeedKnots)&&s[end].telemetry.groundSpeedKnots!<2};
}
export function contactSequence(s:readonly FlightSample[],events:readonly FlightEvent[]){
  return events.map((e,i)=>{
    const prev=events[i-1],next=events[i+1];
    const details=contactDetails(s,e);
    const near=(a:FlightEvent,b:FlightEvent)=>s[b.index].at-s[a.index].at<=5000&&s.slice(a.index,b.index+1).every((p,j,arr)=>j===0||p.at-arr[j-1].at<=1000);
    const bounce=e.kind==='Liftoff'&&prev?.kind==='Touchdown'&&next?.kind==='Touchdown'&&near(prev,e)&&near(e,next)&&
      s.slice(e.index,next.index+1).every(p=>finite(p.telemetry.aglFeet)&&p.telemetry.aglFeet<30);
    return {...e,...details,label:bounce?'Possible bounce':e.kind};
  });
}
export function signalQuality(s:readonly FlightSample[],axis:'Roll'|'Pitch'){
  const key=axis==='Roll'?'nativeCommandRollRatio':'nativeCommandPitchRatio';
  let n=0,squares=0,travel=0,maxRate=0,active=0,span=0,saturated=0;
  for(let i=0;i<s.length;i++){const x=s[i].telemetry[key];if(!finite(x))continue;n++;squares+=x*x;if(Math.abs(x)>=.98)saturated++;
    if(i){const prev=s[i-1].telemetry[key],dt=(s[i].at-s[i-1].at)/1000;if(finite(prev)&&dt>0&&dt<=1){const change=Math.abs(x-prev);travel+=change;span+=dt;maxRate=Math.max(maxRate,change/dt);if(Math.abs(x)>.05)active+=dt;}}}
  return {rms:n?Math.sqrt(squares/n):null,travel,peakRate:span?maxRate:null,activeFraction:span?active/span:null,saturationFraction:n?saturated/n:null};
}
