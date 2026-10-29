import { Activity, AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import type { FlightAdvisoryEvent, FlightTelemetry } from '@xplane/shared';

const ALERTS = [
  { label: 'Airspeed above published Vne', severity: 'critical', group: 'Flight envelope' },
  { label: 'Airspeed near configured stall reference', severity: 'critical', group: 'Flight envelope' },
  { label: 'Bank angle exceeds 50 degrees', severity: 'caution', group: 'Flight envelope' },
  { label: 'High descent rate near terrain', severity: 'critical', group: 'Flight path' },
  { label: 'Engine N1 asymmetry', severity: 'caution', group: 'Propulsion' },
  { label: 'Gear position differs from handle', severity: 'caution', group: 'Flight controls' },
  { label: 'Electrical bus voltage low', severity: 'caution', group: 'Electrical' },
  { label: 'Hydraulic pressure low', severity: 'caution', group: 'Hydraulics' },
  { label: 'Cabin altitude above 10,000 feet', severity: 'caution', group: 'Pressurization' },
  { label: 'Wing ice with primary protection off', severity: 'caution', group: 'Anti-ice' },
  { label: 'Approach rate or bank outside advisory limits', severity: 'caution', group: 'Approach' },
] as const;

interface Props { telemetry: FlightTelemetry; live: boolean; events?: FlightAdvisoryEvent[]; }
const number = (value: number | null, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '---';
const state = (value: number | null) => value === null ? '---' : value > 0.5 ? 'ON' : 'OFF';

export function SystemsHealth({ telemetry: t, live, events = [] }: Props) {
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
    <div className="systems-subheading">Aircraft systems / live readback</div>
    <div className="systems-groups">
      <div><h3>Propulsion & fuel</h3><p>Engine 1 N1 <strong>{metric(t.n1LeftPercent, '%', 1)}</strong></p><p>Engine 2 N1 <strong>{metric(t.n1RightPercent, '%', 1)}</strong></p><p>Engine 1 EGT <strong>{metric(t.egtLeftCelsius, '°C')}</strong></p><p>Engine 2 EGT <strong>{metric(t.egtRightCelsius, '°C')}</strong></p><p>Engine 1 fuel flow <strong>{metric(t.fuelFlowLeftKgSec, ' kg/s', 2)}</strong></p><p>Engine 2 fuel flow <strong>{metric(t.fuelFlowRightKgSec, ' kg/s', 2)}</strong></p><p>Oil pressure 1 <strong>{metric(t.oilPressureLeftPsi, ' psi')}</strong></p><p>Oil pressure 2 <strong>{metric(t.oilPressureRightPsi, ' psi')}</strong></p><p>Engine 1 running <strong>{live ? state(t.engineRunningLeft) : '---'}</strong></p><p>Engine 2 running <strong>{live ? state(t.engineRunningRight) : '---'}</strong></p><p>Fuel total <strong>{metric(t.fuelTotalKilograms, ' kg')}</strong></p><p>G load <strong>{metric(t.gLoad, ' g', 2)}</strong></p></div>
      <div><h3>Autopilot & navigation</h3><p>AP servos <strong>{live ? state(t.autopilotServosOn) : '---'}</strong></p><p>Selected heading <strong>{metric(t.selectedHeadingDegrees, '°')}</strong></p><p>Selected vertical speed <strong>{metric(t.selectedVerticalSpeedFpm, ' fpm')}</strong></p><p>Flight director <strong>{live ? state(t.flightDirectorOn) : '---'}</strong></p><p>Nav deviation <strong>{metric(t.navDeviationDots, ' dots', 2)}</strong></p><p>Glideslope <strong>{metric(t.glideslopeDeviationDots, ' dots', 2)}</strong></p><p>Heading mode <strong>{metric(t.autopilotHeadingMode)}</strong></p><p>Altitude mode <strong>{metric(t.autopilotAltitudeMode)}</strong></p><p>Navigation mode <strong>{metric(t.autopilotNavMode)}</strong></p><p>Approach mode <strong>{metric(t.autopilotApproachMode)}</strong></p></div>
      <div><h3>Electrical & hydraulics</h3><p>Bus voltage <strong>{metric(t.electricalBusVolts, ' V', 1)}</strong></p><p>Battery voltage <strong>{metric(t.batteryVolts, ' V', 1)}</strong></p><p>Generator 1 <strong>{live ? state(t.generatorLeftOn) : '---'}</strong></p><p>Generator 2 <strong>{live ? state(t.generatorRightOn) : '---'}</strong></p><p>Hydraulic pressure <strong>{metric(t.hydraulicPressurePsi, ' psi')}</strong></p><p>Hydraulic pressure 2 <strong>{metric(t.hydraulicPressure2Psi, ' psi')}</strong></p></div>
      <div><h3>Pressurization & anti-ice</h3><p>Cabin altitude <strong>{metric(t.cabinAltitudeFeet, ' ft')}</strong></p><p>Cabin differential <strong>{metric(t.cabinDifferentialPsi, ' psi', 2)}</strong></p><p>Cabin climb <strong>{metric(t.cabinVerticalSpeedFpm, ' fpm')}</strong></p><p>Pitot heater <strong>{live ? state(t.pitotHeatOn) : '---'}</strong></p><p>Wing anti-ice <strong>{live ? state(t.wingAntiIceOn) : '---'}</strong></p><p>Wing ice index <strong>{metric(t.wingIceRatio, '', 2)}</strong></p></div>
    </div>
    <div className="systems-events-head"><div><strong>Advisory event timeline</strong><small>Server-session transitions; export to archive</small></div>
      <button type="button" onClick={download} disabled={!events.length}><Download size={15}/> Export CSV</button></div>
    {events.length === 0 ? <div className="systems-quiet"><Activity size={16}/> No advisory changes observed in this browser session.</div>
      : <div className="systems-events">{events.slice(0, 20).map(e => <div key={e.id}><time>{new Date(e.at).toLocaleTimeString()}</time>
        <span className={e.event === 'raised' ? 'event-raised' : 'event-cleared'}>{e.event.toUpperCase()}</span><span>{ALERTS[e.flag]?.label ?? 'Unknown advisory'}</span></div>)}</div>}
  </section>;
}
