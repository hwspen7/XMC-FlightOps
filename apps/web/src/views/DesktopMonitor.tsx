import { Activity, BarChart3, Compass, Gauge, Radio, Smartphone, Waves, ArrowUpRight, Database, ShieldCheck } from 'lucide-react';
import type { ServerStatus } from '@xplane/shared';
import { FlightDisplay } from '../components/monitor/FlightDisplay';
import { AttitudeModel3D } from '../components/monitor/AttitudeModel3D';
import { HistoryChart, type ChartSeries } from '../components/monitor/HistoryChart';
import { TelemetryGrid } from '../components/monitor/TelemetryGrid';
import { SignalPanel } from '../components/monitor/SignalPanel';
import { GroundTrack } from '../components/monitor/GroundTrack';
import { FlightAssessment, EngineSystems } from '../components/monitor/FlightAssessment';
import { useTelemetryHistory } from '../hooks/useTelemetryHistory';
import { displayValue, normalizedHeading } from '../telemetry/format';
import '../styles/monitor-operations.css';

interface Props { status: ServerStatus; connected: boolean; onMobile: () => void; }
const chart=(...rows:[ChartSeries['key'],string,string][]):ChartSeries[]=>rows.map(([key,label,color])=>({key,label,color}));
const BLUE='#5dc6f7', GOLD='#f1c177', GREEN='#54dcb5', VIOLET='#a9a5ff', RED='#f37d8f';

export function DesktopMonitor({status,connected,onMobile}:Props){
 const sim=status.simulator,live=connected&&sim.reachable&&sim.telemetryFresh,t=sim.telemetry;
 const history=useTelemetryHistory(status,connected);
 const summary=[
  {label:'INDICATED AIRSPEED',value:live?displayValue(t.indicatedAirspeedKnots):'---',unit:'KT',Icon:Gauge},
  {label:'BARO ALTITUDE',value:live?displayValue(t.altitudeFeet):'---',unit:'FT MSL',Icon:ArrowUpRight},
  {label:'VERTICAL SPEED',value:live?displayValue(t.verticalSpeedFpm):'---',unit:'FPM',Icon:Waves},
  {label:'TRUE HEADING',value:live?normalizedHeading(t.headingDegrees):'---',unit:'DEG',Icon:Compass},
  {label:'GROUND SPEED',value:live?displayValue(t.groundSpeedKnots):'---',unit:'KT',Icon:Activity},
  {label:'MACH',value:live?displayValue(t.machNumber,3):'---',unit:'M',Icon:Radio},
 ];
 return <div className="monitor-shell monitor-operations-v2">
  <header className="monitor-unified-header">
    <div className="monitor-hero-top"><div className="monitor-brand"><span className="brand-mark"><Activity size={22}/></span><div><strong>XPLANE <span>MOTION</span></strong><small>FLIGHT TELEMETRY & SYSTEMS ANALYTICS</small></div></div>
      <div className="monitor-header-right"><span className={`header-pill ${live?'live':''}`}><i/>{live?'LIVE TELEMETRY':'TELEMETRY UNAVAILABLE'}</span><button className="view-switch" onClick={onMobile}><Smartphone size={16}/> MOBILE VIEW</button></div></div>
    <div className="monitor-hero-content"><div><span className="overline">OPERATIONS CENTER / INSTRUMENTATION</span><h1>Aircraft state <span>& flight analytics</span></h1><p>A single read-only operational picture: aircraft attitude, motion, powerplant, configuration, control response and sensor quality. Values come from X-Plane.</p></div><div className="monitor-hero-identity"><Database size={19}/><div><strong>{live?(t.aircraftIcao??'UNKNOWN AIRCRAFT'):'AIRCRAFT NOT DETECTED'}</strong><span>{sim.transport==='native'?'NATIVE X-PLANE PLUGIN':'SIMULATOR DATA LINK'} · OBSERVER ONLY</span></div></div></div>
    <div className="monitor-hero-status">
      <span className={connected?'good':''}><i/> GATEWAY {connected?'ONLINE':'OFFLINE'}</span>
      <span className={live?'good':''}><i/> AIRCRAFT {live?(t.onGround===null?'UNKNOWN':t.onGround===1?'GROUND':'AIRBORNE'):'NO SIGNAL'}</span>
      <span className={status.armed?'good':''}><i/> MOBILE {status.armed?'ARMED':'STANDBY'}</span>
      <span className={sim.outputEnabled?'good':''}><i/> OUTPUT {sim.outputEnabled?'ENABLED':'DISABLED'}</span>
      <span><ShieldCheck size={13}/> AP {live?(t.autopilotServosOn===1?'ENGAGED':'NOT ENGAGED'):'---'}</span>
      <span className="monitor-hero-count">{sim.receivedFields}/{sim.subscribedFields} DATAREFS · {displayValue(sim.lastHeartbeatAgeMs)} MS</span>
    </div>
  </header>
  <main className="monitor-main">
    <div className="monitor-kpis">{summary.map(({label,value,unit,Icon})=><article key={label} className="monitor-kpi"><div><span>{label}</span><Icon size={17}/></div><strong>{value}</strong><small>{unit}</small></article>)}</div>
    <FlightAssessment status={status} live={live} history={history}/>
    <div className="monitor-section-header"><div><span className="overline">AIRCRAFT POSITION / ORIENTATION</span><h2>Flight instruments <span>/ live aircraft response</span></h2></div><span>ACTUAL X-PLANE VALUES · NOT PHONE TILT</span></div>
    <div className="primary-monitor-grid"><div className="pfd-card"><FlightDisplay telemetry={t} live={live}/></div><AttitudeModel3D telemetry={t} live={live}/></div>
    <div className="monitor-section-header"><div><span className="overline">LIVE RECORDER / FIVE-MINUTE MEMORY</span><h2>Flight dynamics <span>/ interactive trends</span></h2><p className="monitor-section-caption">Change time window, toggle individual signals, or point at the plot for exact historical readback. Lines are broken at missing samples.</p></div><span><BarChart3 size={16}/> LIVE SAMPLE WINDOW</span></div>
    <div className="monitor-charts">
      <HistoryChart title="Air data · IAS / TAS / GS" subtitle="Indicated, true and ground speed; wind/air-density differences are not inferred" unit="KT" history={history} series={chart(['ias','IAS',BLUE],['tas','TRUE AIRSPEED',GREEN],['gs','GROUND SPEED',GOLD])}/>
      <HistoryChart title="Vertical profile & selected altitude" subtitle="Aircraft altitude, commanded autopilot altitude and height above terrain" unit="FT" history={history} series={chart(['altitude','MSL ALTITUDE',BLUE],['selectedAltitude','SELECTED ALT',VIOLET],['agl','AGL',GREEN])}/>
      <HistoryChart title="Aircraft attitude" subtitle="Pitch and bank of the aircraft, not input deflection" unit="DEG" history={history} series={chart(['roll','BANK',BLUE],['pitch','PITCH',GOLD])}/>
      <HistoryChart title="Angular dynamics" subtitle="Body-axis rotation rates P, Q and R, degrees per second" unit="DEG/S" history={history} series={chart(['rollRate','ROLL RATE',BLUE],['pitchRate','PITCH RATE',GREEN],['yawRate','YAW RATE',GOLD])}/>
      <HistoryChart title="Vertical speed" subtitle="Barometric vertical speed readback: climb and descent" unit="FT/MIN" history={history} series={chart(['verticalSpeed','VERTICAL SPEED',BLUE])}/>
      <HistoryChart title="Aerodynamic angles / load" subtitle="Angle of attack and sideslip (degrees); load factor is plotted separately" unit="DEG" history={history} series={chart(['alpha','AOA',GOLD],['beta','SIDESLIP',BLUE])}/>
      <HistoryChart title="Flight control tracking" subtitle="Phone commanded deflection versus X-Plane effective roll / pitch ratios" unit="%" history={history} percent series={chart(['inputRoll','PHONE ROLL',BLUE],['actualRoll','AIRCRAFT ROLL CONTROL',GREEN],['inputPitch','PHONE PITCH',GOLD],['actualPitch','AIRCRAFT PITCH CONTROL',VIOLET])}/>
      <HistoryChart title="Configuration & actuator movement" subtitle="Selected flaps versus actual deployment, throttle and speedbrakes" unit="%" history={history} percent series={chart(['flapSelected','FLAP LEVER',GOLD],['flapActual','FLAP SURFACE',GREEN],['spoiler','SPEEDBRAKE',RED],['throttle','THROTTLE',BLUE])}/>
      <HistoryChart title="Engine spool · dual channels" subtitle="N1 and N2 percent of each reported engine channel" unit="% RPM" history={history} series={chart(['n1L','ENG 1 N1',BLUE],['n1R','ENG 2 N1',GREEN],['n2L','ENG 1 N2',GOLD],['n2R','ENG 2 N2',VIOLET])}/>
      <HistoryChart title="Engine thermal profile" subtitle="Exhaust gas temperatures by engine channel; aircraft limits not assumed" unit="°C" history={history} series={chart(['egtL','ENG 1 EGT',BLUE],['egtR','ENG 2 EGT',GOLD])}/>
      <HistoryChart title="Fuel-flow response" subtitle="Current fuel mass flow for both channels, in kilograms per second" unit="KG/S" history={history} series={chart(['fuelFlowL','ENG 1 FLOW',GREEN],['fuelFlowR','ENG 2 FLOW',BLUE])}/>
      <HistoryChart title="Normal load factor" subtitle="Actual simulator load-factor measurement, not inferred from pitch" unit="G" history={history} series={chart(['gload','NORMAL LOAD',RED])}/>
      <HistoryChart title="Gear deployment channels" subtitle="Reported per-leg deployment fractions; not mechanical lock sensors" unit="%" history={history} percent series={chart(['gear0','GEAR 0',BLUE],['gear1','GEAR 1',GREEN],['gear2','GEAR 2',GOLD])}/>
      <GroundTrack history={history}/>
    </div>
    <div className="monitor-section-header"><div><span className="overline">ENGINE MONITORING</span><h2>Propulsion and systems <span>/ live channels</span></h2></div><span>PER-AIRCRAFT AVAILABILITY</span></div>
    <EngineSystems t={t} live={live}/>
    <div className="monitor-section-header"><div><span className="overline">TELEMETRY DIAGNOSTICS</span><h2>Detailed parameters <span>/ connection quality</span></h2></div><span>UNSUPPORTED CHANNELS SHOW ---</span></div>
    <div className="monitor-bottom-grid"><TelemetryGrid telemetry={t} live={live}/><SignalPanel status={status} connected={connected}/></div>
    <footer className="monitor-footer"><span>XPLANE MOTION CONTROLLER · PASSIVE FLIGHT OBSERVATION</span><span>NOT A CERTIFIED FLIGHT INSTRUMENT · NOT FOR REAL FLIGHT</span></footer>
  </main>
 </div>;
}
