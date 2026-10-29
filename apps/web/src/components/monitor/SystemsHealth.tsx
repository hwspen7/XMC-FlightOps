import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import type { ServerStatus } from '@xplane/shared';

const ALERTS = [
  { label: 'Airspeed above published Vne', severity: 'critical', group: 'Flight envelope' },
  { label: 'Airspeed near configured stall reference', severity: 'critical', group: 'Flight envelope' },
  { label: 'Bank angle exceeds 50 degrees', severity: 'caution', group: 'Flight envelope' },
  { label: 'High descent rate near terrain', severity: 'critical', group: 'Flight path' },
  { label: 'Engine N1 asymmetry', severity: 'caution', group: 'Propulsion' },
  { label: 'Gear position differs from handle', severity: 'caution', group: 'Flight controls' },
  { label: 'Electrical bus voltage low', severity: 'caution', group: 'Electrical' },
  { label: 'Hydraulic fluid quantity very low', severity: 'caution', group: 'Hydraulics' },
  { label: 'Cabin altitude above 10,000 feet', severity: 'caution', group: 'Pressurization' },
  { label: 'Wing ice with primary protection off', severity: 'caution', group: 'Anti-ice' },
  { label: 'Approach rate or bank outside advisory limits', severity: 'caution', group: 'Approach' },
] as const;

interface Props { status: ServerStatus; connected: boolean; }
const number = (value: number | null, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '---';
const state = (value: number | null) => value === null ? '---' : value > 0.5 ? 'ON' : 'OFF';

type LongKey = 'ias'|'altitude'|'risk'|'egt1'|'egt2';
interface LongSample { at: number; ias:number|null; altitude:number|null; risk:number|null; egt1:number|null; egt2:number|null; }
function decimate(points: readonly LongSample[], key: LongKey): LongSample[] {
  if (points.length < 600) return [...points];
  const width = Math.ceil(points.length / 130);
  const chosen = new Set<number>();
  for (let start=0; start<points.length; start+=width) {
    const end=Math.min(points.length, start+width);
    let low=Infinity, high=-Infinity, minIndex=-1, maxIndex=-1;
    chosen.add(start); chosen.add(end-1);
    for(let index=start;index<end;index++) {
      const value=points[index][key];
      if (value===null || !Number.isFinite(value)) { chosen.add(index); continue; }
      if (value<low) {low=value;minIndex=index;}
      if (value>high) {high=value;maxIndex=index;}
    }
    if (minIndex>=0) chosen.add(minIndex);
    if (maxIndex>=0) chosen.add(maxIndex);
  }
  return [...chosen].sort((a,b)=>a-b).map(index=>points[index]);
}
function LongChart({title,unit,points,windowMinutes,series}:{title:string;unit:string;points:LongSample[];windowMinutes:number;series:[LongKey,string,string][]}) {
  const result=useMemo(()=>{
    const end=points.at(-1)?.at??Date.now();
    const start=end-windowMinutes*60000;
    const inWindow=points.filter(p=>p.at>=start);
    const all=series.flatMap(([key])=>inWindow.map(p=>p[key]).filter((v):v is number=>v!==null&&Number.isFinite(v)));
    if (!all.length) return null;
    const min=Math.min(...all), max=Math.max(...all);
    const pad=Math.max(0.5,(max-min)*0.1);
    const bottom=min-pad, top=max+pad;
    const lines=series.map(([key,label,color])=>{
      let d='',continuous=false;
      for(const p of decimate(inWindow,key)) {
        const v=p[key];
        if(v===null||!Number.isFinite(v)){continuous=false;continue;}
        const x=20+(p.at-start)/(end-start||1)*560;
        const y=154-(v-bottom)/(top-bottom)*134;
        d+=`${continuous?'L':'M'}${x.toFixed(1)},${y.toFixed(1)} `;
        continuous=true;
      }
      return {key,label,color,d};
    });
    return {min:bottom,max:top,lines,count:inWindow.length};
  },[points,windowMinutes]);
  return <div className="systems-trend"><div className="systems-trend-heading"><strong>{title}</strong><small>{unit} · {result?.count??0} samples</small></div>
    <svg viewBox="0 0 600 174" role="img" aria-label={`${title} observed history`}> {[0,1,2,3,4].map(i=><path key={i} d={`M20 ${20+i*33.5} H580`} fill="none" stroke="#304960" strokeDasharray="3 5" />)}
      {result?.lines.map(line=><path key={line.key} d={line.d} stroke={line.color} strokeWidth="2" fill="none" />)}
      {!result&&<text x="300" y="90" textAnchor="middle" fill="#8aa7bc" fontSize="13">NO SAMPLES</text>}
      {result&&<><text x="22" y="13" fill="#93b1c5" fontSize="11">{result.max.toFixed(1)}</text><text x="22" y="169" fill="#93b1c5" fontSize="11">{result.min.toFixed(1)}</text></>}</svg>
    <div className="systems-chart-legend">{series.map(([key,label,color])=><span key={key}><i style={{backgroundColor:color}}/>{label}</span>)}</div>
  </div>;
}
export function SystemsHealth({ status, connected }: Props) {
  const live = connected && status.simulator.telemetryFresh && status.simulator.reachable;
  const t = status.simulator.telemetry;
  const events = status.simulator.advisoryEvents ?? [];
  const [history, setHistory] = useState<LongSample[]>([]);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const sampleAt = t.receivedAt;
  useEffect(() => {
    if (!live || sampleAt === null) return;
    setHistory(previous => {
      const last = previous.at(-1);
      if (last && sampleAt <= last.at) return previous;
      if (last && sampleAt - last.at < 190) return previous;
      const point: LongSample = { at: sampleAt, ias: t.indicatedAirspeedKnots,
        altitude: t.altitudeFeet, risk: t.nativeRiskScore, egt1: t.egtLeftC, egt2: t.egtRightC };
      return [...previous, point].filter(x => sampleAt - x.at <= 900000).slice(-4600);
    });
  }, [live, sampleAt]);
  const mask = live && t.nativeAlertFlags !== null ? Math.trunc(t.nativeAlertFlags) : null;
  const active = mask === null ? [] : ALERTS.filter((_, index) => mask & (1 << index));
  const risk = live ? t.nativeRiskScore : null;
  const metric = (value: number | null, unit = '', digits = 0) => `${number(live ? value : null, digits)}${value !== null && live ? unit : ''}`;
  const download = () => {
    const csv = ['timestamp,event,advisory', ...events.map(e =>
      `${new Date(e.at).toISOString()},${e.event.toUpperCase()},"${ALERTS[e.flag]?.label ?? 'Unknown advisory'}"`
    )].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'xplane-advisory-events.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="monitor-card systems-health-card">
    <div className="card-heading"><div><span className="micro-label">C++ FLIGHT-LOOP ANALYSIS</span>
      <h2>System state and flight advisories</h2><p className="chart-subtitle">Advisory thresholds only, not aircraft-specific certification limits</p>
    </div><span className="tag-outline">READ ONLY</span></div>
    <div className="systems-summary">
      <div className="systems-risk"><span>ADVISORY RISK</span><strong>{metric(risk)}</strong><small>0–100 / heuristic</small></div>
      <div><span>ACTIVE ADVISORIES</span><strong>{mask === null ? '---' : active.length}</strong><small>3 samples to assert; gear 30 / 5 to clear</small></div>
      <div><span>ADVISORIES RAISED</span><strong>{metric(t.nativeEventCount)}</strong><small>Since native analyzer reset</small></div>
      <div><span>ROLL RMS</span><strong>{metric(t.nativeBankRmsDegrees, '°', 1)}</strong><small>Trailing 30 seconds</small></div>
      <div><span>AIRSPEED TREND</span><strong>{metric(t.nativeIasTrendKtMin, ' kt/min', 1)}</strong><small>10+ seconds observed</small></div>
      <div><span>ALTITUDE TREND</span><strong>{metric(t.nativeAltitudeTrendFpm, ' ft/min')}</strong><small>10+ seconds observed</small></div>
    </div>
    {mask === null ? <div className="systems-quiet">Native flight analysis is unavailable. Legacy UDP does not report advisory states.</div>
      : active.length === 0 ? <div className="systems-quiet"><ShieldCheck size={18}/> No active advisories based on available sensors.</div>
      : <div className="systems-active">{ALERTS.map((item, index) => mask & (1 << index) ?
        <div key={item.label} className={`systems-alert ${item.severity}`}><AlertTriangle size={17}/>
          <span><strong>{item.label}</strong><small>{item.group} · {item.severity.toUpperCase()}</small></span></div> : null)}</div>}
    <div className="systems-events-head"><div><strong>Extended history · up to 15 minutes</strong><small>Observed readbacks only · min/max-preserving decimation · no interpolation</small></div>
      <div className="systems-window-picker" role="group" aria-label="History window">{[1,5,15].map(n=><button key={n} className={windowMinutes===n?'selected':''} type="button" onClick={()=>setWindowMinutes(n)}>{n}m</button>)}</div></div>
    <div className="systems-trends"><LongChart title="Airspeed" unit="KT" points={history} windowMinutes={windowMinutes} series={[['ias','Indicated airspeed','#58c7f4']]} />
      <LongChart title="Altitude" unit="FT" points={history} windowMinutes={windowMinutes} series={[['altitude','MSL altitude','#a5b9f0']]} />
      <LongChart title="Engine exhaust temperature" unit="°C" points={history} windowMinutes={windowMinutes} series={[['egt1','Engine 1','#62cbaa'],['egt2','Engine 2','#e7b86b']]} />
      <LongChart title="Risk index" unit="0-100" points={history} windowMinutes={windowMinutes} series={[['risk','Advisory risk','#f2ae71']]} /></div>
    <div className="systems-subheading">Aircraft systems / live readback</div>
    <div className="systems-groups">
      <div><h3>Propulsion & fuel</h3><p>Engine 1 N1 <strong>{metric(t.n1LeftPercent, '%', 1)}</strong></p><p>Engine 2 N1 <strong>{metric(t.n1RightPercent, '%', 1)}</strong></p><p>Engine 1 EGT <strong>{metric(t.egtLeftC, '°C')}</strong></p><p>Engine 2 EGT <strong>{metric(t.egtRightC, '°C')}</strong></p><p>Engine 1 fuel flow <strong>{metric(t.fuelFlowLeftKgS, ' kg/s', 2)}</strong></p><p>Engine 2 fuel flow <strong>{metric(t.fuelFlowRightKgS, ' kg/s', 2)}</strong></p><p>Oil pressure 1 <strong>{metric(t.oilPressureLeftPsi, ' psi')}</strong></p><p>Oil pressure 2 <strong>{metric(t.oilPressureRightPsi, ' psi')}</strong></p><p>Engine 1 running <strong>{live ? state(t.engineRunningLeft) : '---'}</strong></p><p>Engine 2 running <strong>{live ? state(t.engineRunningRight) : '---'}</strong></p><p>Fuel total <strong>{metric(t.fuelWeightKg, ' kg')}</strong></p><p>G load <strong>{metric(t.normalLoadG, ' g', 2)}</strong></p></div>
      <div><h3>Autopilot & navigation</h3><p>AP servos <strong>{live ? state(t.autopilotServosOn) : '---'}</strong></p><p>Selected heading <strong>{metric(t.selectedHeadingDegrees, '°')}</strong></p><p>Selected vertical speed <strong>{metric(t.selectedVerticalSpeedFpm, ' fpm')}</strong></p><p>Flight director mode <strong>{metric(t.flightDirectorMode)}</strong></p><p>Nav deviation <strong>{metric(t.navDeviationDots, ' dots', 2)}</strong></p><p>Glideslope <strong>{metric(t.glideslopeDeviationDots, ' dots', 2)}</strong></p><p>Heading mode <strong>{metric(t.autopilotHeadingMode)}</strong></p><p>Altitude mode <strong>{metric(t.autopilotAltitudeMode)}</strong></p><p>Navigation mode <strong>{metric(t.autopilotNavMode)}</strong></p><p>Approach mode <strong>{metric(t.autopilotApproachMode)}</strong></p></div>
      <div><h3>Electrical & hydraulics</h3><p>Bus voltage <strong>{metric(t.electricalBusVolts, ' V', 1)}</strong></p><p>Battery voltage <strong>{metric(t.batteryVolts, ' V', 1)}</strong></p><p>Generator 1 <strong>{live ? state(t.generatorLeftOn) : '---'}</strong></p><p>Generator 2 <strong>{live ? state(t.generatorRightOn) : '---'}</strong></p><p>Hydraulic fluid 1 <strong>{metric(t.hydraulicFluid1Ratio, '', 2)}</strong></p><p>Hydraulic system 1 pressure <strong>{metric(t.hydraulicPressure1Raw)}</strong></p><p>Hydraulic system 2 pressure <strong>{metric(t.hydraulicPressure2Raw)}</strong></p><small>Pressure units are aircraft-defined, not necessarily PSI.</small></div>
      <div><h3>Pressurization & anti-ice</h3><p>Cabin altitude <strong>{metric(t.cabinAltitudeFeet, ' ft')}</strong></p><p>Cabin differential <strong>{metric(t.cabinDifferentialPsi, ' psi', 2)}</strong></p><p>Cabin climb <strong>{metric(t.cabinVerticalSpeedFpm, ' fpm')}</strong></p><p>Pitot heater <strong>{live ? state(t.pitotHeatOn) : '---'}</strong></p><p>Wing anti-ice <strong>{live ? state(t.wingAntiIceOn) : '---'}</strong></p><p>Wing ice index <strong>{metric(t.wingIceRatio, '', 2)}</strong></p></div>
    </div>
    <div className="systems-events-head"><div><strong>Advisory event timeline</strong><small>Server-session transitions; export to archive</small></div>
      <button type="button" onClick={download} disabled={!events.length}><Download size={15}/> Export CSV</button></div>
    {events.length === 0 ? <div className="systems-quiet"><Activity size={16}/> No advisory changes reported by the server during this session.</div>
      : <div className="systems-events">{events.slice(0, 20).map(e => <div key={e.id}><time>{new Date(e.at).toLocaleTimeString()}</time>
        <span className={e.event === 'raised' ? 'event-raised' : 'event-cleared'}>{e.event.toUpperCase()}</span><span>{ALERTS[e.flag]?.label ?? 'Unknown advisory'}</span></div>)}</div>}
  </section>;
}
