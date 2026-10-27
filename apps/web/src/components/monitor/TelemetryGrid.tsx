import type { FlightTelemetry } from '@xplane/shared';
import { displayValue } from '../../telemetry/format';

type NumericKey = Exclude<keyof FlightTelemetry, 'receivedAt'>;
interface Cell { key: NumericKey; name: string; unit: string; decimals?: number; ratio?: boolean; }
interface Group { heading: string; detail: string; entries: Cell[]; }

const GROUPS: Group[] = [
  { heading: 'Navigation & position', detail: 'SIMULATOR COORDINATES', entries: [
    { key:'headingDegrees',name:'True heading',unit:'DEG', decimals:1 },
    { key:'magneticHeadingDegrees',name:'Magnetic heading',unit:'DEG',decimals:1 },
    { key:'latitudeDegrees',name:'Latitude',unit:'DEG',decimals:5 },
    { key:'longitudeDegrees',name:'Longitude',unit:'DEG',decimals:5 },
    { key:'flightPathDegrees',name:'Flight path angle',unit:'DEG',decimals:1 },
  ] },
  { heading:'Flight dynamics', detail:'BODY & VELOCITY FRAME', entries: [
    { key:'angleOfAttackDegrees',name:'Angle of attack',unit:'DEG',decimals:2 },
    { key:'sideslipDegrees',name:'Sideslip',unit:'DEG',decimals:2 },
    { key:'rollRateDegreesPerSecond',name:'Roll rate',unit:'DEG/S',decimals:2 },
    { key:'pitchRateDegreesPerSecond',name:'Pitch rate',unit:'DEG/S',decimals:2 },
    { key:'yawRateDegreesPerSecond',name:'Yaw rate',unit:'DEG/S',decimals:2 },
  ] },
  { heading:'Air data', detail:'AIRCRAFT PERFORMANCE', entries:[
    { key:'trueAirspeedKnots',name:'True airspeed',unit:'KT',decimals:1 },
    { key:'machNumber',name:'Mach number',unit:'M',decimals:3 },
    { key:'aglFeet',name:'Height above ground',unit:'FT',decimals:0 },
    { key:'verticalSpeedFpm',name:'Vertical velocity',unit:'FPM',decimals:0 },
  ] },
  { heading:'Flight controls', detail:'COCKPIT & ENGINE ACTUATORS', entries:[
    { key:'throttleRatio',name:'Throttle levers',unit:'%',ratio:true },
    { key:'flapRatio',name:'Flap position',unit:'%',ratio:true },
    { key:'speedbrakeRatio',name:'Speedbrakes',unit:'%',ratio:true },
    { key:'elevatorTrimRatio',name:'Elevator trim',unit:'%',ratio:true },
    { key:'gearHandleDown',name:'Gear handle',unit:'',decimals:0 },
    { key:'autopilotServosOn',name:'Autopilot servos',unit:'',decimals:0 },
    { key:'n1LeftPercent',name:'Engine 1 N1',unit:'%',decimals:1 },
    { key:'n1RightPercent',name:'Engine 2 N1',unit:'%',decimals:1 },
  ] },
];

function cellValue(cell: Cell, telemetry: FlightTelemetry, live: boolean) {
  if (!live || telemetry[cell.key] === null) return '---';
  const value = telemetry[cell.key]!;
  if (cell.key === 'gearHandleDown') return value > .5 ? 'DOWN' : 'UP';
  if (cell.key === 'autopilotServosOn') return value > .5 ? 'ENGAGED' : 'OFF';
  return displayValue(cell.ratio ? value*100 : value, cell.decimals ?? 0);
}

export function TelemetryGrid({ telemetry, live }: { telemetry: FlightTelemetry; live: boolean }) {
  return <section className="monitor-card telemetry-grid-card">
    <div className="card-heading"><div><span className="micro-label">EXTENDED FLIGHT DATA</span><h2>Aircraft systems & performance</h2></div><span className="tag-outline">{GROUPS.reduce((n,g)=>n+g.entries.length,0)} PARAMETERS</span></div>
    <div className="telemetry-groups">
      {GROUPS.map(group=><section key={group.heading} className="telemetry-group">
        <div className="telemetry-group-head"><h3>{group.heading}</h3><small>{group.detail}</small></div>
        {group.entries.map(cell => <div className="telemetry-row" key={cell.key}><span>{cell.name}</span><div><strong className={live && telemetry[cell.key] !== null ? '' : 'missing-data'}>{cellValue(cell,telemetry,live)}</strong><small>{cell.unit}</small></div></div>)}
      </section>)}
    </div>
    <p className="data-footnote">Datarefs depend on the loaded aircraft and X-Plane installation. Unavailable or stale parameters are shown as dashes.</p>
  </section>;
}
