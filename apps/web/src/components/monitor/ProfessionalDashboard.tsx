/* XMC_CONTROL_INSTRUMENT_RELIABILITY_20261029 */
import { useMemo, useState, type PointerEvent, type ReactNode } from 'react';
import type { FlightTelemetry, ServerStatus } from '@xplane/shared';
import { useTelemetryHistory, type HistoryPoint } from '../../hooks/useTelemetryHistory';
import { picture } from '../../telemetry/flightAnalytics';
import { AviationChart } from './AviationChart';
import { SpatialMonitor } from './SpatialMonitor';
import { B787PrimaryFlightDisplay } from '../mobile/B787PrimaryFlightDisplay';
import '../../styles/professional-dashboard.css';

type TelemetryKey = Exclude<keyof HistoryPoint, 'at'>;
const C = { cyan: '#51c9f2', green: '#48dfb3', amber: '#efb75d', red: '#f07175', violet: '#b1a4fa' };
const okay = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const read = (v: number | null | undefined, digits = 0) => okay(v) ? v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const signed = (v: number | null | undefined, digits = 1) => okay(v) ? `${v >= 0 ? '+' : ''}${read(v, digits)}` : '—';
const enabled = (v: number | null | undefined) => !okay(v) ? 'UNKNOWN' : v > 0.5 ? 'ON' : 'OFF';
const visibleValue = (v: number | null | undefined, live: boolean) => live && okay(v) ? v : null;

function Section({ title, sub, className = '', children }: { title: string; sub?: string; className?: string; children: ReactNode }) {
  return <section className={`xpd-card ${className}`}><div className="xpd-title"><strong>{title}</strong>{sub && <small>{sub}</small>}</div>{children}</section>;
}
function Metric({ label, value, unit, className = '' }: { label: string; value: string; unit?: string; className?: string }) {
  return <div className={`xpd-metric ${className}`}><small>{label}</small><div><strong>{value}</strong>{unit && <em>{unit}</em>}</div></div>;
}
function Line({ label, value, unit, positive }: { label: string; value: string; unit?: string; positive?: boolean }) {
  return <div className="xpd-line"><span>{label}</span><strong className={positive ? 'xpd-positive' : ''}>{value}{unit && <small> {unit}</small>}</strong></div>;
}
function Gauge({ label, value, max = 100, unit = '%', accent = C.green }: { label: string; value: number | null; max?: number; unit?: string; accent?: string }) {
  const pct = okay(value) ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return <div className="xpd-gauge"><div><span>{label}</span><strong>{read(value, 1)}<small> {unit}</small></strong></div><div className="xpd-gauge-track"><i style={{ width: `${pct}%`, background: accent }} /></div></div>;
}
function Horizon({ t, live }: { t: FlightTelemetry; live: boolean }) {
  // Both screens use the same flight data and identical PFD rendering code.
  return <div className="xpd-pfd xpd-pfd-mobile-clone">
    <B787PrimaryFlightDisplay telemetry={t} live={live} />
  </div>;
}
function Engine({ t, live }: { t: FlightTelemetry; live: boolean }) {
  return <div className="xpd-engine-grid"><div className="xpd-engine-labels"><span>ENGINE 1</span><span>ENGINE 2</span></div>
    <div className="xpd-engine-pair"><Gauge label="N1" value={visibleValue(t.n1LeftPercent,live)}/><Gauge label="N1" value={visibleValue(t.n1RightPercent,live)} accent={C.cyan}/></div>
    <div className="xpd-engine-pair"><Gauge label="N2" value={visibleValue(t.n2LeftPercent,live)}/><Gauge label="N2" value={visibleValue(t.n2RightPercent,live)} accent={C.cyan}/></div>
    <div className="xpd-engine-pair"><Metric label="EGT" value={read(visibleValue(t.egtLeftC,live))} unit="°C"/><Metric label="EGT" value={read(visibleValue(t.egtRightC,live))} unit="°C"/></div>
    <div className="xpd-engine-pair"><Metric label="FLOW" value={read(okay(visibleValue(t.fuelFlowLeftKgS,live))?t.fuelFlowLeftKgS!*3600:null)} unit="KG/H"/><Metric label="FLOW" value={read(okay(visibleValue(t.fuelFlowRightKgS,live))?t.fuelFlowRightKgS!*3600:null)} unit="KG/H"/></div>
    <div className="xpd-engine-pair"><Metric label="OIL" value={read(visibleValue(t.oilPressureLeftPsi,live))} unit="PSI"/><Metric label="OIL" value={read(visibleValue(t.oilPressureRightPsi,live))} unit="PSI"/></div>
  </div>;
}
function Mobile({ status, connected }: { status: ServerStatus; connected: boolean }) {
  const { control: ctl, simulator: sim } = status;
  const phase = connected && status.armed ? status.controlPhase.toUpperCase() : 'NOT ARMED';
  const input=(v:number|null)=>okay(v)?`${signed(v*100,0)}%`:'—';
  return <div className="xpd-mobile"><div className="xpd-mobile-state"><span className={`xpd-led ${status.armed&&connected?'on':''}`} /><strong>{phase}</strong><span>{status.ownedByYou?'LOCAL SESSION':'REMOTE / UNCLAIMED'}</span></div>
    <div className="xpd-mobile-matrix"><Metric label="SENSOR" value={status.armed?read(ctl.sensorRateHz):'—'} unit="HZ"/><Metric label="COMMAND" value={status.armed?read(ctl.inputRateHz):'—'} unit="FPS"/><Metric label="FRAME AGE" value={status.armed?read(ctl.lastFrameAgeMs):'—'} unit="MS"/><Metric label="TIMEOUT" value={read(ctl.timeoutMs)} unit="MS"/></div>
    <Gauge label="PHONE ROLL" value={status.armed&&okay(ctl.inputRoll)?(ctl.inputRoll+1)*50:null} accent={C.cyan}/>
    <Gauge label="PHONE PITCH" value={status.armed&&okay(ctl.inputPitch)?(ctl.inputPitch+1)*50:null} accent={C.amber}/>
    <Line label="R / P INPUT" value={`${input(status.armed?ctl.inputRoll:null)} / ${input(status.armed?ctl.inputPitch:null)}`}/>
    <Line label="NATIVE OVERRIDE" value={sim.transport==='native' ? (sim.nativeArmed===true?'CONFIRMED':sim.nativeArmed===false?'NOT ARMED':'UNKNOWN') : 'LEGACY UDP'}/>
    <Line label="ACKED SEQUENCE" value={read(sim.nativeDiagnostics?.lastAckSequence ?? null)}/>
  </div>;
}
function Systems({t,live}:{t:FlightTelemetry;live:boolean}) {
  const get=(v:number|null|undefined)=>visibleValue(v,live);
  return <div className="xpd-system-grid">
    <Section title="ELECTRICAL" sub="SOURCE INDICATION"><div className="xpd-sources"><div><span>GEN 1</span><b>{enabled(get(t.generatorLeftOn))}</b></div><div><span>BATTERY</span><b>{read(get(t.batteryVolts))} V</b></div><div><span>GEN 2</span><b>{enabled(get(t.generatorRightOn))}</b></div></div><Line label="BUS VOLTAGE" value={read(get(t.electricalBusVolts),1)} unit="V"/><p className="xpd-disclaimer">Source indications, not verified wiring topology</p></Section>
    <Section title="HYDRAULICS" sub="RAW PRESSURES"><div className="xpd-system-big"><Metric label="CHANNEL 1" value={read(get(t.hydraulicPressure1Raw),1)}/><Metric label="CHANNEL 2" value={read(get(t.hydraulicPressure2Raw),1)}/></div><Gauge label="FLUID QUANTITY 1" value={okay(get(t.hydraulicFluid1Ratio))?get(t.hydraulicFluid1Ratio)!*100:null}/><p className="xpd-disclaimer">Pressure units depend on aircraft DataRef</p></Section>
    <Section title="FLIGHT CONTROLS" sub="COMMAND / SURFACE"><Gauge label="FLAP LEVER" value={okay(get(t.flapHandleRatio))?get(t.flapHandleRatio)!*100:null} accent={C.cyan}/><Gauge label="FLAP SURFACE" value={okay(get(t.flapDeployRatio))?get(t.flapDeployRatio)!*100:null}/><div className="xpd-system-big"><Metric label="SPOILERS" value={read(okay(get(t.speedbrakeRatio))?get(t.speedbrakeRatio)!*100:null)} unit="%"/><Metric label="TRIM" value={read(okay(get(t.elevatorTrimRatio))?get(t.elevatorTrimRatio)!*100:null)} unit="%"/></div></Section>
    <Section title="AUTOPILOT / NAV" sub="SIMULATOR MODES"><div className="xpd-sources"><div><span>AP</span><b>{enabled(get(t.autopilotServosOn))}</b></div><div><span>FD</span><b>{read(get(t.flightDirectorMode))}</b></div><div><span>A/T</span><b>{enabled(get(t.autothrottleOn))}</b></div></div><Line label="SELECTED HDG" value={read(get(t.selectedHeadingDegrees))} unit="°"/><Line label="SELECTED ALT" value={read(get(t.selectedAltitudeFeet))} unit="FT"/><p className="xpd-disclaimer">Raw mode codes are not decoded FMA annunciations</p></Section>
    <Section title="ENVIRONMENT" sub="PRESSURIZATION / ICE"><div className="xpd-system-big"><Metric label="CABIN ALT" value={read(get(t.cabinAltitudeFeet))} unit="FT"/><Metric label="DELTA P" value={read(get(t.cabinDifferentialPsi),1)} unit="PSI"/></div><Line label="CABIN RATE" value={read(get(t.cabinVerticalSpeedFpm))} unit="FPM"/><Line label="PITOT HEAT" value={enabled(get(t.pitotHeatOn))}/><Line label="WING ANTI-ICE" value={enabled(get(t.wingAntiIceOn))}/></Section>
    <Section title="LANDING / BRAKES" sub="CONFIGURATION"><div className="xpd-sources"><div><span>GEAR 1</span><b>{read(okay(get(t.gearDeploy0Ratio))?get(t.gearDeploy0Ratio)!*100:null)}%</b></div><div><span>GEAR 2</span><b>{read(okay(get(t.gearDeploy1Ratio))?get(t.gearDeploy1Ratio)!*100:null)}%</b></div><div><span>GEAR 3</span><b>{read(okay(get(t.gearDeploy2Ratio))?get(t.gearDeploy2Ratio)!*100:null)}%</b></div></div><Line label="GEAR HANDLE" value={enabled(get(t.gearHandleDown))==='ON'?'DOWN':enabled(get(t.gearHandleDown))==='OFF'?'UP':'UNKNOWN'}/><Line label="WHEEL BRAKES" value={read(okay(get(t.wheelBrakeRatio))?get(t.wheelBrakeRatio)!*100:null)} unit="%"/><Line label="REVERSE" value={enabled(get(t.reverseActive))}/></Section>
  </div>;
}

interface ChartSeries {key:TelemetryKey;label:string;color:string}
function MicroChart({title,history,series,unit='',bounds,windowMs=300000,hoverAt,setHoverAt}:{title:string;history:HistoryPoint[];series:ChartSeries[];unit?:string;bounds?:{value:number|null;label:string;color:string}[];windowMs?:number;hoverAt:number|null;setHoverAt:(at:number|null)=>void}) {
  const end=history.at(-1)?.at??0; const start=end-windowMs;
  const points=history.filter(p=>p.at>=start);
  const values=series.flatMap(s=>points.map(p=>p[s.key]).filter(okay));
  const refs=bounds?.flatMap(b=>okay(b.value)?[b.value]:[]) ?? [];
  const domainValues=[...values,...refs];
  const lo=domainValues.length?Math.min(...domainValues):0,hi=domainValues.length?Math.max(...domainValues):1;
  const pad=Math.max((hi-lo)*.15,Math.abs(hi)*.012,.05),min=lo-pad,max=hi+pad;
  const y=(v:number)=>160-(v-min)/(max-min)*116, x=(at:number)=>48+(at-start)/windowMs*310;
  const plots=series.map(s=>{let d='',continuous=false,previousAt=0;for(const p of points){const v=p[s.key];if(!okay(v)){continuous=false;continue;}if(previousAt&&p.at-previousAt>5000)continuous=false;d+=`${continuous?'L':'M'}${x(p.at).toFixed(1)} ${y(v).toFixed(1)} `;continuous=true;previousAt=p.at;}return {...s,d};});
  const focused=hoverAt===null?points.at(-1):points.reduce<HistoryPoint|undefined>((a,b)=>!a||Math.abs(b.at-hoverAt)<Math.abs(a.at-hoverAt)?b:a,undefined);
  const onPointer=(e:PointerEvent<SVGSVGElement>)=>{if(!end)return;const r=e.currentTarget.getBoundingClientRect();const sx=(e.clientX-r.left)/r.width*385;setHoverAt(Math.round(start+Math.max(0,Math.min(1,(sx-48)/310))*windowMs));};
  return <Section title={title} sub={`${windowMs<60000?`${windowMs/1000} SEC`:`${Math.round(windowMs/60000)} MIN`} / ${unit}`} className="xpd-chart"><div className="xpd-chart-main"><svg viewBox="0 0 385 195" role="img" aria-label={`${title} observed simulator history`} onPointerMove={onPointer} onPointerLeave={()=>setHoverAt(null)}>
    {[0,1,2,3].map(i=><g key={i}><line x1="48" y1={44+i*38} x2="358" y2={44+i*38} stroke="#28485c" strokeDasharray="3 5"/><text x="41" y={48+i*38} fill="#7c9bb0" fontSize="10" textAnchor="end">{values.length?read(max-(max-min)*i/3,Math.abs(hi-lo)<10?1:0):'—'}</text></g>)}
    {[0,1,2,3,4].map(i=><g key={i}><line x1={48+i*77.5} y1="44" x2={48+i*77.5} y2="160" stroke="#20394b"/><text x={48+i*77.5} y="183" fill="#789eb7" fontSize="10" textAnchor="middle">{i===4?'NOW':windowMs<120000?`-${Math.round((1-i/4)*windowMs/1000)}s`:`-${((1-i/4)*windowMs/60000).toFixed(1)}m`}</text></g>)}
    {bounds?.map(b=>{const v=b.value;return okay(v)?<g key={b.label}><line x1="48" x2="358" y1={y(v)} y2={y(v)} stroke={b.color} strokeDasharray="6 4"/><text x="355" y={y(v)-4} textAnchor="end" fill={b.color} fontSize="9">{b.label}</text></g>:null})}
    {plots.map(p=><path key={p.key} d={p.d} stroke={p.color} fill="none" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round"/>)}
    {hoverAt!==null && end!==0 && hoverAt<=end && <line x1={x(hoverAt)} y1="44" x2={x(hoverAt)} y2="160" stroke="#f2f7fe" strokeDasharray="3 4"/>}
    {!values.length && <text x="200" y="109" fill="#7293a8" textAnchor="middle" fontSize="11">NO LIVE SAMPLES</text>}
  </svg></div><div className="xpd-chart-legend">{series.map(s=><span key={s.key}><i style={{background:s.color}}/>{s.label}<b>{read(focused?.[s.key],1)}</b></span>)}</div></Section>;
}
function Events({status,live}:{status:ServerStatus;live:boolean}) {
  const events=live?(status.simulator.advisoryEvents??[]):[];
  const end=Date.now();
  // Derive the active state from the latest transition for each advisory flag.
  const lastByFlag=new Map<number,(typeof events)[number]>();
  for(const e of events) lastByFlag.set(e.flag,e);
  const active=new Set([...lastByFlag.values()].filter(e=>e.event==='raised').map(e=>e.flag));
  return <Section title="EVENT TIMELINE" sub="NATIVE ADVISORY CHANGES"><div className="xpd-event-tracks">
    {['RAISED','CLEARED','ACTIVE'].map((label,row)=><div className="xpd-event-row" key={label}><span>{label}</span><div className="xpd-event-lane">{events.filter(e=>row===0?e.event==='raised':row===1?e.event==='cleared':e.event==='raised'&&active.has(e.flag)).slice(-60).map(e=>{const pct=100-(end-e.at)/300000*100;return pct>=0&&pct<=100?<i key={`${e.id}-${e.at}`} style={{left:`${pct}%`,background:row===1?C.green:row===2?C.amber:C.red}} title={`Flag ${e.flag} ${e.event}`}/>:null})}</div></div>)}
  </div><p className="xpd-disclaimer">Last 5 minutes · no inferred events · {events.length} received</p></Section>;
}
function Symmetry({history}:{history:HistoryPoint[]}) {
  const pts=history.filter(p=>okay(p.n1L)&&okay(p.n1R)).slice(-240);
  return <Section title="ENGINE SYMMETRY" sub="N1 LEFT × RIGHT"><svg viewBox="0 0 190 160" className="xpd-symplot" role="img" aria-label="Actual left and right engine N1 scatter plot">
    {[0,25,50,75,100].map(n=><g key={n}><line x1={24+n*1.36} y1="13" x2={24+n*1.36} y2="149" stroke="#1a3c50"/><line x1="24" x2="160" y1={149-n*1.36} y2={149-n*1.36} stroke="#1a3c50"/></g>)}
    <path d="M24 149L160 13" stroke={C.green} strokeDasharray="4 4"/><path d="M37.6 149L160 26.6 M24 135.4L146.4 13" stroke={C.amber} strokeDasharray="3 6" opacity=".6"/>
    {pts.map((p,i)=><circle key={i} cx={24+p.n1L!*1.36} cy={149-p.n1R!*1.36} r="2" fill={C.cyan} opacity=".7"/>)}
    {!pts.length && <text x="94" y="80" textAnchor="middle" fontSize="9" fill="#83a5b9">NO ENGINE SAMPLES</text>}
    <text x="94" y="159" textAnchor="middle" fill="#7aa5bd" fontSize="9">ENG 1 N1 (%)</text>
  </svg></Section>;
}
function Risk({t,live}:{t:FlightTelemetry;live:boolean}){
  const rows:[string,number|null,string][]=[['HANDLING',visibleValue(t.nativeHandlingRisk??null,live),C.cyan],['PROPULSION',visibleValue(t.nativePropulsionRisk??null,live),C.green],['SYSTEMS',visibleValue(t.nativeSystemsRisk??null,live),C.amber],['APPROACH',visibleValue(t.nativeApproachRisk??null,live),C.violet],['TOTAL',visibleValue(t.nativeRiskScore,live),C.red]];
  return <Section title="RISK COMPONENTS" sub="C++ ADVISORY / NOT CERTIFIED"><div className="xpd-risks">{rows.map(([label,v,color])=><div key={label}><span>{label}</span><strong>{read(v)}{okay(v)?'/100':''}</strong><div><i style={{width:`${okay(v)?Math.min(100,Math.max(0,v)):0}%`,background:color}}/></div></div>)}</div></Section>;
}
export function ProfessionalDashboard({status,connected,onMobile}:{status:ServerStatus;connected:boolean;onMobile:()=>void}){
  const history=useTelemetryHistory(status,connected);
  const [hoverAt,setHoverAt]=useState<number|null>(null);
  const [chartWindow,setChartWindow]=useState(300000);
  const sim=status.simulator,live=connected&&sim.reachable&&sim.telemetryFresh,t=sim.telemetry;
  const state=useMemo(()=>picture(status,connected),[status,connected]);
  return <main className="xpd-dashboard">
    <div className="xpd-section-bar"><strong>FLIGHT OPERATIONS OVERVIEW</strong><span>SIMULATOR READBACK · NOT CERTIFIED FOR FLIGHT</span><div><button type="button" onClick={onMobile}>OPEN MOBILE VIEW</button></div></div>
    <div className="xpd-status-strip">
      <div className="xpd-phase"><small>FLIGHT PHASE</small><strong>{state.phase}</strong><span>SIMULATOR PHASE ESTIMATE</span></div>
      {[['IAS',read(visibleValue(t.indicatedAirspeedKnots,live)),'KT'],['BARO ALT',read(visibleValue(t.altitudeFeet,live)),'FT'],['VERTICAL SPEED',signed(visibleValue(t.verticalSpeedFpm,live),0),'FPM'],['HEADING',read(visibleValue(t.headingDegrees,live)),'°'],['GROUND SPEED',read(visibleValue(t.groundSpeedKnots,live)),'KT'],['MACH',read(visibleValue(t.machNumber,live),2),''],['G LOAD',read(visibleValue(t.normalLoadG,live),2),'G']].map(([label,value,unit])=><div key={label}><Metric label={label} value={value} unit={unit}/></div>)}
      <div className={`xpd-condition xpd-condition-${state.condition.toLowerCase()}`}><small>{state.quality} TELEMETRY</small><strong>{state.condition}</strong><span>{state.evidence.length} ACTIVE ADVISORIES</span></div>
    </div>
    <div className="xpd-primary">
      <Section title="PRIMARY FLIGHT INSTRUMENT" sub="SIMULATOR ATTITUDE" className="xpd-pfd-panel"><Horizon t={t} live={live}/></Section>
      <Section title="GROUND TRACK / POSITION" sub="SIMULATOR COORDINATES" className="xpd-track-panel"><AviationChart history={history} t={t} live={live}/></Section>
      <Section title="ENGINE PARAMETERS" sub="DUAL CHANNEL READBACK" className="xpd-engines-panel"><Engine t={t} live={live}/></Section>
      <Section title="FUEL / LOADING" sub="WEIGHT / FLOW" className="xpd-fuel-panel"><Metric label="TOTAL FUEL" value={read(visibleValue(t.fuelWeightKg,live))} unit="KG"/><Gauge label="FUEL MASS / GROSS MASS" value={okay(visibleValue(t.fuelWeightKg,live))&&okay(visibleValue(t.grossWeightKg,live))&&t.grossWeightKg!>0?t.fuelWeightKg!/t.grossWeightKg!*100:null} accent={C.cyan}/><Metric label="TOTAL MASS" value={read(visibleValue(t.grossWeightKg,live))} unit="KG"/><Line label="ENG 1 FLOW" value={read(okay(visibleValue(t.fuelFlowLeftKgS,live))?t.fuelFlowLeftKgS!*3600:null)} unit="KG/H"/><Line label="ENG 2 FLOW" value={read(okay(visibleValue(t.fuelFlowRightKgS,live))?t.fuelFlowRightKgS!*3600:null)} unit="KG/H"/><p className="xpd-disclaimer">Fuel distribution not inferred from total mass</p></Section>
      <Section title="MOBILE CONTROLLER" sub="INPUT / NATIVE SYNC" className="xpd-mobile-panel"><Mobile status={status} connected={connected}/></Section>
    </div>
    <SpatialMonitor status={status} connected={connected} history={history}/>
    <Systems t={t} live={live}/>
    <div className="xpd-chart-heading"><strong>FLIGHT DATA ANALYTICS</strong><span>LINKED POINTER / REAL TELEMETRY / NO SYNTHETIC SAMPLES</span><div>{[30000,120000,300000].map(ms=><button key={ms} className={chartWindow===ms?'active':''} onClick={()=>setChartWindow(ms)}>{ms===30000?'30 SEC':ms===120000?'2 MIN':'5 MIN'}</button>)}</div></div>
    <div className="xpd-charts">
      <MicroChart title="AIRSPEED ENVELOPE" history={history} series={[{key:'ias',label:'IAS',color:C.cyan},{key:'tas',label:'TAS',color:C.green}]} bounds={[{value:visibleValue(t.speedVsoKnots,live),label:'VSO',color:C.violet},{value:visibleValue(t.speedVsKnots,live),label:'VS',color:C.green},{value:visibleValue(t.speedVfeKnots,live),label:'VFE',color:C.amber},{value:visibleValue(t.speedVneKnots,live),label:'VNE',color:C.red}]} unit="KT" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="ALTITUDE / SELECTED" history={history} series={[{key:'altitude',label:'MSL',color:C.cyan},{key:'selectedAltitude',label:'TARGET',color:C.amber}]} unit="FT" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="ENGINE N1 RESPONSE" history={history} series={[{key:'n1L',label:'ENG 1',color:C.cyan},{key:'n1R',label:'ENG 2',color:C.amber}]} unit="%" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="ENGINE EGT" history={history} series={[{key:'egtL',label:'ENG 1',color:C.cyan},{key:'egtR',label:'ENG 2',color:C.amber}]} unit="°C" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="ATTITUDE / PITCH BANK" history={history} series={[{key:'roll',label:'BANK',color:C.cyan},{key:'pitch',label:'PITCH',color:C.amber}]} unit="DEG" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="NORMAL LOAD FACTOR" history={history} series={[{key:'gload',label:'LOAD',color:C.violet}]} unit="G" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="CONTROL CHANNEL TRACKING" history={history} series={[{key:'inputRoll',label:'PHONE R',color:C.cyan},{key:'actualRoll',label:'ACTUAL R',color:C.green}]} unit="RATIO" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="FUEL FLOW" history={history} series={[{key:'fuelFlowL',label:'ENG 1',color:C.cyan},{key:'fuelFlowR',label:'ENG 2',color:C.amber}]} unit="KG/S" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="AERODYNAMIC ANGLES" history={history} series={[{key:'alpha',label:'AOA',color:C.cyan},{key:'beta',label:'SLIP',color:C.amber}]} unit="DEG" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="THREE-AXIS ANGULAR RATES" history={history} series={[{key:'rollRate',label:'P',color:C.cyan},{key:'pitchRate',label:'Q',color:C.amber},{key:'yawRate',label:'R',color:C.violet}]} unit="DEG/S" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="PITCH CONTROL RESPONSE" history={history} series={[{key:'inputPitch',label:'PHONE',color:C.amber},{key:'actualPitch',label:'SURFACE',color:C.green}]} unit="RATIO" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
      <MicroChart title="ACTUATOR CONFIGURATION" history={history} series={[{key:'flapSelected',label:'FLAP LEVER',color:C.cyan},{key:'flapActual',label:'DEPLOY',color:C.green},{key:'spoiler',label:'SPOILER',color:C.amber}]} unit="RATIO" windowMs={chartWindow} hoverAt={hoverAt} setHoverAt={setHoverAt}/>
    </div>
    <div className="xpd-bottom">
      <Events status={status} live={live}/>
      <Section title="ACTIVE ADVISORIES" sub="PHASE-AWARE / HEURISTIC"><div className="xpd-advisories">{state.evidence.length?state.evidence.slice(0,7).map((e,i)=><div key={`${e.name}-${i}`}><span className={`xpd-alert-dot xpd-${e.level.toLowerCase()}`}/><strong>{e.name}</strong><span>{e.observed}</span></div>):<p>{live?'NO ACTIVE ADVISORY CONDITIONS':'LIVE AIRCRAFT DATA REQUIRED'}</p>}</div></Section>
      <Symmetry history={history}/><Risk t={t} live={live}/>
    </div>
    <footer className="xpd-footnote">XPLANE MOTION CONTROLLER · LIVE SIMULATOR MEASUREMENTS ONLY · VEHICLE SYSTEM STATE DEPENDS ON AIRCRAFT DATAREF AVAILABILITY · ADVISORIES ARE NOT CERTIFIED WARNINGS</footer>
  </main>;
}
