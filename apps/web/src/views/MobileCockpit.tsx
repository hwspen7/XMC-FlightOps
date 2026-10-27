import { useEffect, useState } from 'react';
import { ArrowLeft, Compass, LockKeyhole, Monitor, Radio, RotateCcw, Settings2, ShieldCheck, Smartphone, Square, Wifi, WifiOff } from 'lucide-react';
import type { ReturnTypeFlightController } from '../viewTypes';
import { MotionAttitude } from '../components/mobile/MotionAttitude';
import { FlightControls } from '../components/mobile/FlightControls';
import { MobileSettings } from '../components/mobile/MobileSettings';
import { displayValue, normalizedHeading, percentDeflection } from '../telemetry/format';

interface Props { flight: ReturnTypeFlightController; onDesktop: () => void; }

export function MobileCockpit({ flight, onDesktop }: Props) {
  const { motion, socket, output } = flight;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [throttleTouched, setThrottleTouched] = useState(false);
  const [profile, setProfile] = useState<'airliner' | 'regional' | 'light'>('airliner');
  const sensorFresh = motion.enabled && motion.available && Date.now() - motion.lastReadingAt < 800;
  const simulator = socket.serverStatus.simulator;
  const telemetry = simulator.telemetry;
  const live = socket.connected && simulator.telemetryFresh && simulator.reachable;
  const armed = socket.serverStatus.ownedByYou;
  const controlsAvailable = armed && simulator.outputEnabled && simulator.reachable;
  const ready = flight.calibrated && sensorFresh && socket.connected && /^\d{6}$/.test(flight.pairingCode.trim());

  useEffect(() => {
    if (!throttleTouched && live && telemetry.throttleRatio !== null) setThrottle(Math.round(telemetry.throttleRatio * 100));
  }, [live, telemetry.throttleRatio, throttleTouched]);

  const selectProfile = (next: typeof profile) => {
    if (armed) return;
    setProfile(next);
    const values = next === 'airliner' ? { rollTravelDegrees: 55, pitchTravelDegrees: 28, responseExponent: 1.4 }
      : next === 'regional' ? { rollTravelDegrees: 45, pitchTravelDegrees: 26, responseExponent: 1.3 }
      : { rollTravelDegrees: 36, pitchTravelDegrees: 22, responseExponent: 1.2 };
    flight.setSettings({ ...flight.settings, ...values });
  };

  return <div className="mobile-cockpit">
    <header className="mobile-topbar">
      <div className="mobile-status"><span className={`status-orb ${armed ? 'armed' : socket.connected ? 'linked' : ''}`}/><span>{armed ? 'CONTROL ACTIVE' : socket.connected ? 'SERVER CONNECTED' : 'DISCONNECTED'}</span></div>
      <div className="mobile-top-actions">
        <button className="mobile-outline" onClick={() => { if (armed) flight.disarm(); else flight.recenter(); }} disabled={!armed && !sensorFresh}><RotateCcw size={16}/>{armed ? 'DISARM' : 'RECENTER'}</button>
        <span className="mobile-mode-pill"><Compass size={16}/> YOKE <em>·</em> MOTION</span>
        <button className="mobile-icon" onClick={onDesktop} title="Open desktop monitoring" aria-label="Open desktop monitoring"><Monitor size={19}/></button>
        <button className="mobile-icon" onClick={() => setSettingsOpen(true)} title="Controller settings" aria-label="Controller settings"><Settings2 size={20}/></button>
      </div>
    </header>

    <div className="mobile-profilebar" aria-label="Response profile">
      <span className="profile-label">RESPONSE PROFILE</span>
      {(['airliner', 'regional', 'light'] as const).map((item) => <button key={item} type="button" disabled={armed}
        className={profile === item ? 'profile-selected' : ''} onClick={() => selectProfile(item)}>{item === 'airliner' ? 'AIRLINER' : item === 'regional' ? 'REGIONAL' : 'LIGHT AIRCRAFT'}</button>)}
      <span className="mode-later">SIDESTICK · PLANNED</span>
    </div>

    <main className="mobile-main">
      <section className="mobile-throttle" aria-label="Throttle control">
        <div className="throttle-title">THROTTLE <small>ALL ENGINES</small></div>
        <div className="throttle-range-wrap">
          <div className="throttle-scale"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
          <input className="throttle-vertical" type="range" min="0" max="100" step="1" value={throttle} disabled={!controlsAvailable}
            aria-label="Throttle percentage" onChange={(event) => { const value = Number(event.target.value); setThrottle(value); setThrottleTouched(true); flight.sendThrottle(value / 100); }} onPointerUp={() => setThrottleTouched(false)} onTouchEnd={() => setThrottleTouched(false)}/>
        </div>
        <strong className="throttle-value">{controlsAvailable ? throttle : live && telemetry.throttleRatio !== null ? Math.round(telemetry.throttleRatio * 100) : '---'}<small>%</small></strong>
        <span className="throttle-caption">{controlsAvailable ? 'MANUAL INPUT' : 'MONITOR ONLY'}</span>
      </section>

      <section className="mobile-center" aria-label="Device motion controller">
        <MotionAttitude output={output} calibrated={flight.calibrated}/>
        <div className="mobile-axes">
          <div><span>ROLL COMMAND</span><strong>{percentDeflection(output.roll)}</strong><div className="axis-track"><i style={{ left: `${50 + 47 * output.roll}%` }}/></div></div>
          <div><span>PITCH COMMAND</span><strong>{percentDeflection(output.pitch)}</strong><div className="axis-track"><i style={{ left: `${50 + 47 * output.pitch}%` }}/></div></div>
        </div>
        <div className="mobile-readouts">
          <span>IAS <strong>{live ? displayValue(telemetry.indicatedAirspeedKnots) : '---'}</strong> KT</span>
          <span>HDG <strong>{live ? normalizedHeading(telemetry.headingDegrees) : '---'}</strong>°</span>
          <span>ALT <strong>{live ? displayValue(telemetry.altitudeFeet) : '---'}</strong> FT</span>
        </div>
      </section>

      <section className="mobile-right" aria-label="Secondary controls">
        <div className="secondary-heading"><span>FLIGHT CONTROLS</span><span>SECONDARY INPUTS</span></div>
        <FlightControls active={controlsAvailable} onAction={flight.sendAuxiliary}/>
      </section>
    </main>

    <footer className="mobile-footer">
      <div className="mobile-device-state"><span className={sensorFresh ? 'available' : ''}>{sensorFresh ? <Wifi size={15}/> : <WifiOff size={15}/>} SENSOR {sensorFresh ? `${motion.sampleRateHz} HZ` : 'OFFLINE'}</span><span><Radio size={15}/> SIM {simulator.reachable ? 'ONLINE' : 'OFFLINE'}</span><span>TX {socket.serverStatus.control.inputRateHz} FPS</span></div>
      <div className="mobile-primary-actions">
        {motion.enabled ? <button className="mobile-secondary-button" onClick={flight.stopSensors}><Square size={14}/> STOP MOTION</button> : <button className="mobile-secondary-button" onClick={() => void motion.requestAccess()}><Smartphone size={16}/> ENABLE MOTION</button>}
        {armed ? <button className="mobile-stop-button" onClick={flight.disarm}><Square size={15}/> DISARM</button> : <button className="mobile-arm-button" disabled={!ready} onClick={flight.arm}><ShieldCheck size={17}/> ARM CONTROL</button>}
      </div>
    </footer>

    {(flight.localError || motion.error || socket.notice) && <div className="mobile-alert" role="status">{flight.localError || motion.error || socket.notice?.message}</div>}
    {!flight.calibrated && <div className="mobile-guidance"><LockKeyhole size={15}/> Enable motion, hold the device comfortably, then select Recenter. Open settings to enter the pairing code.</div>}
    {settingsOpen && <MobileSettings onClose={() => setSettingsOpen(false)} settings={flight.settings} onChange={flight.setSettings} pairingCode={flight.pairingCode} onPairingCode={flight.setPairingCode}/>}
    <div className="mobile-orientation-notice"><ArrowLeft size={20}/> Rotate the phone to landscape orientation for motion control.</div>
  </div>;
}
