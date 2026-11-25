import type { FlightTelemetry, ControlMonitor } from '@xplane/shared';

export interface FlightSample { type: 'sample'; at: number; telemetry: FlightTelemetry; control: ControlMonitor; }
export interface FlightPackage { aircraft: string; source: string; samples: FlightSample[]; complete: boolean; reason: string; }
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function parseFlightPackage(raw: string): FlightPackage {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const header = JSON.parse(lines.shift() ?? '{}');
  if (header.type !== 'manifest' || header.schema !== 'xmc.flight-package.v1') throw Error('Unsupported flight package');
  const samples: FlightSample[] = [];
  let end: { samples: number; reason: string } | null = null;
  for (const line of lines) {
    const p = JSON.parse(line);
    if (end) throw Error('Unexpected data after archive footer');
    if (p.type === 'end') { end = p; continue; }
    if (p.type !== 'sample' || !Number.isSafeInteger(p.at) || !p.telemetry || !p.control ||
        typeof p.telemetry !== 'object' || typeof p.control !== 'object' ||
        (samples.length && p.at <= samples[samples.length - 1].at)) throw Error('Invalid or unordered sample');
    samples.push(p);
  }
  if (!samples.length || (end && end.samples !== samples.length)) throw Error('Missing samples or count mismatch');
  return { aircraft: typeof header.aircraftIcao === 'string' ? header.aircraftIcao : 'UNKNOWN',
    source: String(header.source ?? 'unknown'), samples, complete: Boolean(end), reason: end?.reason ?? 'unfinalized' };
}

const rad = Math.PI / 180;
export function displacement(a: FlightTelemetry, b: FlightTelemetry): [number, number] | null {
  if (!finite(a.latitudeDegrees) || !finite(a.longitudeDegrees) || !finite(b.latitudeDegrees) || !finite(b.longitudeDegrees)) return null;
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
    if (dt<=0 || dt>1000 || (a.telemetry.onGround!==0 && a.telemetry.onGround!==1) || (b.telemetry.onGround!==0 && b.telemetry.onGround!==1)) continue;
    if (a.telemetry.onGround!==b.telemetry.onGround) events.push({index:i,kind:b.telemetry.onGround===1?'Touchdown':'Liftoff',bracketMs:dt});
  }
  return events;
}
export function distance(s: readonly FlightSample[], start: number, end: number): number | null {
  if (start>=end) return null;
  let total=0;
  for(let i=start+1;i<=end;i++){
    const d=displacement(s[i-1].telemetry,s[i].telemetry);
    if (!d || s[i].at-s[i-1].at>1000) return null;
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
