import { Activity, ArrowUpRight, BarChart3, Compass, Database, Gauge, Laptop2, Radio, Smartphone, Waves } from 'lucide-react';
import type { ServerStatus } from '@xplane/shared';
import { FlightDisplay } from '../components/monitor/FlightDisplay';
import { AttitudeModel3D } from '../components/monitor/AttitudeModel3D';
import { HistoryChart } from '../components/monitor/HistoryChart';
import { TelemetryGrid } from '../components/monitor/TelemetryGrid';
import { SignalPanel } from '../components/monitor/SignalPanel';
import { GroundTrack } from '../components/monitor/GroundTrack';
import { useTelemetryHistory } from '../hooks/useTelemetryHistory';
import { displayValue, normalizedHeading } from '../telemetry/format';

interface Props { status: ServerStatus; connected: boolean; onMobile: () => void; }

const SPEED_SERIES = [
  {key:'ias' as const,label:'Indicated airspeed',color:'#46b7f1'},
  {key:'gs' as const,label:'Groundspeed',color:'#e6b465'},
];
const ATTITUDE_SERIES = [
  {key:'roll' as const,label:'Aircraft roll',color:'#58bfe3'},
  {key:'pitch' as const,label:'Aircraft pitch',color:'#efb168'},
];
const ALTITUDE_SERIES = [
  {key:'altitude' as const,label:'MSL altitude',color:'#a8c2ee'},
  {key:'agl' as const,label:'Above ground',color:'#71c4c2'},
];
const INPUT_SERIES = [
  {key:'inputRoll' as const,label:'Yoke roll command',color:'#75c8f2'},
  {key:'inputPitch' as const,label:'Yoke pitch command',color:'#efb168'},
];
const VERTICAL_SERIES = [
  {key:'verticalSpeed' as const,label:'Vertical speed',color:'#d1ad78'},
];

export function DesktopMonitor({ status, connected, onMobile }: Props) {
  const { simulator } = status;
  const live = connected && simulator.reachable && simulator.telemetryFresh;
  const t = simulator.telemetry;
  const history = useTelemetryHistory(status, connected);
  const summary = [
    { name:'INDICATED AIRSPEED', value:live?displayValue(t.indicatedAirspeedKnots):'---', unit:'KT', icon:Gauge },
    { name:'ALTITUDE MSL', value:live?displayValue(t.altitudeFeet):'---', unit:'FT', icon:ArrowUpRight },
    { name:'VERTICAL SPEED', value:live?displayValue(t.verticalSpeedFpm):'---', unit:'FPM', icon:Waves },
    { name:'TRUE HEADING', value:live?normalizedHeading(t.headingDegrees):'---', unit:'DEG', icon:Compass },
    { name:'GROUND SPEED', value:live?displayValue(t.groundSpeedKnots):'---', unit:'KT', icon:Activity },
    { name:'MACH', value:live?displayValue(t.machNumber,3):'---', unit:'M', icon:Radio },
  ];
  return <div className="monitor-shell">
    <header className="monitor-header">
      <div className="monitor-brand"><span className="brand-mark"><Activity size={22}/></span><div><strong>XPLANE <span>MOTION</span></strong><small>SIMULATOR TELEMETRY OPERATIONS</small></div></div>
      <div className="monitor-header-right"><span className="monitor-local"><Database size={14}/> X-PLANE 12 · REAL-TIME DATA</span><span className={`header-pill ${live?'live':''}`}><i/>{live?'SIMULATOR ONLINE':'AWAITING SIMULATOR'}</span><button className="view-switch" onClick={onMobile}><Smartphone size={16}/> MOBILE VIEW</button></div>
    </header>
    <main className="monitor-main">
      <div className="monitor-intro"><div><span className="overline">OPERATIONS CENTER / FLIGHT ANALYTICS</span><h1>Flight monitoring <span>dashboard</span></h1><p>Observe the aircraft response, control device, and data link. Flight input is provided by the mobile controller only.</p></div><div className="monitor-readonly"><Laptop2 size={21}/><div><strong>DESKTOP OBSERVER</strong><span>NO FLIGHT CONTROL INPUT</span></div></div></div>
      <div className="status-ribbon"><span className={connected?'good':''}><i/> SERVER {connected?'CONNECTED':'DISCONNECTED'}</span><span className={simulator.reachable?'good':''}><i/> X-PLANE {simulator.reachable?'RECEIVING':'NOT DETECTED'}</span><span className={status.armed?'good':''}><i/> MOBILE {status.armed?'ARMED':'STANDBY'}</span><span className={simulator.outputEnabled?'good':''}><i/> CONTROL OUTPUT {simulator.outputEnabled?'ENABLED':'DISABLED'}</span><span className="ribbon-count">{simulator.receivedFields} / {simulator.subscribedFields} DATAREFS</span></div>
      <div className="monitor-kpis">{summary.map(({name,value,unit,icon:Icon})=><article key={name} className="monitor-kpi"><div><span>{name}</span><Icon size={18}/></div><strong>{value}</strong><small>{unit}</small></article>)}</div>
      <div className="primary-monitor-grid"><div className="pfd-card"><FlightDisplay telemetry={t} live={live}/></div><AttitudeModel3D telemetry={t} live={live}/></div>
      <div className="monitor-section-header"><div><span className="overline">TIME SERIES</span><h2>Aircraft response <span>/ 2D plots</span></h2></div><span><BarChart3 size={16}/> UP TO 90 SECONDS IN MEMORY</span></div>
      <div className="monitor-charts">
        <HistoryChart title="Airspeed profile" subtitle="Indicated and ground speed" unit="KNOTS" history={history} series={SPEED_SERIES}/>
        <HistoryChart title="Attitude response" subtitle="Actual aircraft pitch and bank" unit="DEGREES" history={history} series={ATTITUDE_SERIES}/>
        <HistoryChart title="Altitude profile" subtitle="MSL altitude and height above ground" unit="FEET" history={history} series={ALTITUDE_SERIES}/>
        <HistoryChart title="Vertical speed" subtitle="Rate of climb or descent" unit="FEET / MIN" history={history} series={VERTICAL_SERIES}/>
        <HistoryChart title="Mobile yoke input" subtitle="Normalized command, not aircraft attitude" unit="-1 TO +1" history={history} series={INPUT_SERIES}/>
        <GroundTrack history={history}/>
      </div>
      <div className="monitor-section-header"><div><span className="overline">SIMULATOR & DEVICE</span><h2>Technical diagnostics <span>/ live parameters</span></h2></div><span>NULL VALUES INDICATE UNSUPPORTED DATAREFS</span></div>
      <div className="monitor-bottom-grid"><TelemetryGrid telemetry={t} live={live}/><SignalPanel connected={connected} status={status}/></div>
      <footer className="monitor-footer"><span>XPLANE MOTION CONTROLLER</span><span>BOEING 787-INSPIRED VISUAL STYLE · NOT AN OFFICIAL BOEING PRODUCT · NOT FOR REAL FLIGHT</span></footer>
    </main>
  </div>;
}
