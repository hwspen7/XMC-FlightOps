import { useEffect, useState } from 'react';
import { ArrowLeft, Monitor, Play, Radio, RotateCcw, Settings2, ShieldCheck, Smartphone, Square, Wifi, WifiOff } from 'lucide-react';
import type { ReturnTypeFlightController } from '../viewTypes';
import { MotionAttitude } from '../components/mobile/MotionAttitude';
import { FlightControls } from '../components/mobile/FlightControls';
import { GroundControls } from '../components/mobile/GroundControls';
import { MobileSettings } from '../components/mobile/MobileSettings';
import { displayValue, normalizedHeading, percentDeflection } from '../telemetry/format';
import { controlTracking, signedPercent } from '../telemetry/controlTracking';

interface Props { flight: ReturnTypeFlightController; onDesktop: () => void; }

function controlsMayResume(armed: boolean, phase: string, nativeArmed: boolean | null | undefined, calibrated: boolean, sensorFresh: boolean) {
  return armed && phase === 'active' && nativeArmed === true && calibrated && sensorFresh;
}

export function MobileCockpit({ flight, onDesktop }: Props) {
  const { motion, socket, output } = flight;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [throttleTouched, setThrottleTouched] = useState(false);
  const sensorFresh = motion.enabled && motion.available && Date.now() - motion.lastReadingAt < 800;
  const simulator = socket.serverStatus.simulator;
  const telemetry = simulator.telemetry;
  const live = socket.connected && simulator.telemetryFresh && simulator.reachable;
  const tracking = controlTracking(telemetry, live, simulator.nativeArmed);
  const armed = socket.serverStatus.ownedByYou;
  const phase = armed ? (socket.serverStatus.controlPhase ?? 'pending') : 'idle';
  const interruptedPause = simulator.simPaused === true && simulator.nativeInterrupted === true;
  const nativeResumeReady = interruptedPause && simulator.pauseOwned === true && controlsMayResume(armed, phase, simulator.nativeArmed, flight.calibrated, sensorFresh);
  const autopilotActive = telemetry.autopilotServosOn === 1;
  const controlsAvailable = armed && simulator.outputEnabled && simulator.reachable &&
    (phase === 'active' || phase === 'unverified') && !autopilotActive;
  const controlLabel = interruptedPause && simulator.pauseOwned !== true ? 'SIM PAUSED - MANUAL RESUME'
    : interruptedPause
    ? !armed ? 'FLIGHT PAUSED - RECENTER & ARM' : nativeResumeReady ? 'FLIGHT PAUSED - READY TO RESUME' : 'FLIGHT PAUSED - CONTROL CHECK'
    : simulator.simPaused === true ? 'SIMULATOR PAUSED'
    : autopilotActive ? 'AUTOPILOT ACTIVE - DISCONNECT IN X-PLANE'
    : !flight.calibrated ? 'RECENTER REQUIRED'
    : phase === 'active' ? 'SIM CONTROL CONFIRMED'
    : phase === 'preview' ? 'MOTION PREVIEW ONLY'
    : phase === 'pending' ? 'WAITING FOR SIM ARM'
    : phase === 'unverified' ? 'CONTROL NOT VERIFIED'
    : socket.connected && socket.serverStatus.armed ? 'ANOTHER CONTROLLER ACTIVE'
    : socket.connected && socket.sessionRestored ? 'SESSION RESTORED - RECENTER & ARM'
    : socket.connected ? 'SERVER CONNECTED' : 'RECONNECTING';
  const ready = flight.calibrated && sensorFresh && socket.connected &&
    (!simulator.outputEnabled || simulator.reachable) &&
    (socket.sessionRestored || /^\d{6}$/.test(flight.pairingCode.trim()));

  useEffect(() => {
    if (!throttleTouched && live && telemetry.throttleRatio !== null) setThrottle(Math.round(telemetry.throttleRatio * 100));
  }, [live, telemetry.throttleRatio, throttleTouched]);

  useEffect(() => {
    document.documentElement.classList.add('mobile-flight-locked');
    return () => document.documentElement.classList.remove('mobile-flight-locked');
  }, []);

  return <div className="mobile-cockpit">
    <header className="mobile-topbar">
      <div className="mobile-status"><span className={`status-orb ${armed ? 'armed' : socket.connected ? 'linked' : ''}`}/><span>{controlLabel}</span>
        {(flight.localError || motion.error || (socket.notice?.severity === 'error' ? socket.notice.message : null)) &&
          <span className="mobile-inline-feedback" role="status" title={flight.localError || motion.error || socket.notice?.message || ''}>
            {flight.localError || motion.error || socket.notice?.message}
          </span>}
      </div>
      <div className="mobile-top-actions">
        <button className="mobile-outline" onClick={() => { if (armed) flight.disarm(); else flight.recenter(); }} disabled={!armed && !sensorFresh}><RotateCcw size={16}/>{armed ? 'DISARM' : 'RECENTER'}</button>
        <button className="mobile-icon" onClick={onDesktop} title="Open desktop monitoring" aria-label="Open desktop monitoring"><Monitor size={19}/></button>
        <button className="mobile-icon" onClick={() => setSettingsOpen(true)} title="Controller settings" aria-label="Controller settings"><Settings2 size={20}/></button>
      </div>
    </header>

    <main className="mobile-main">
      <section className="mobile-throttle" aria-label="Throttle control">
        <div className="throttle-title">THROTTLE <small>ALL ENGINES</small></div>
        <div className="throttle-range-wrap">
          <div className="throttle-scale"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
          <input className="throttle-vertical" type="range" min="0" max="100" step="1" value={throttle} disabled={!controlsAvailable || telemetry.autothrottleOn === 1}
            aria-label="Throttle percentage" onChange={(event) => { const value = Number(event.target.value); setThrottle(value); setThrottleTouched(true); flight.sendThrottle(value / 100); }} onPointerUp={() => setThrottleTouched(false)} onTouchEnd={() => setThrottleTouched(false)}/>
        </div>
        <strong className="throttle-value">{controlsAvailable ? throttle : live && telemetry.throttleRatio !== null ? Math.round(telemetry.throttleRatio * 100) : '---'}<small>%</small></strong>
        <span className="throttle-caption">{controlsAvailable ? 'MANUAL INPUT' : 'MONITOR ONLY'}</span>
      </section>

      <section className="mobile-center" aria-label="Aircraft attitude and motion control">
        <MotionAttitude telemetry={telemetry} live={live}/>
        <div className="mobile-axes">
          <div><span>ROLL COMMAND</span><strong>{percentDeflection(output.roll)}</strong><div className="axis-track"><i style={{ left: `${50 + 47 * output.roll}%` }}/></div></div>
          <div><span>PITCH COMMAND</span><strong>{percentDeflection(output.pitch)}</strong><div className="axis-track"><i style={{ left: `${50 + 47 * output.pitch}%` }}/></div></div>
        </div>
        <div className="mobile-yoke-feedback" aria-label="X-Plane cockpit yoke readback">
          <span>PILOT INPUT <strong>R {live ? signedPercent(telemetry.cockpitYokeRollRatio) : '---'} · P {live ? signedPercent(telemetry.cockpitYokePitchRatio) : '---'}</strong></span>
          <span>LINKED / TOTAL <strong>R {live ? signedPercent(telemetry.effectiveRollRatio) : '---'} · P {live ? signedPercent(telemetry.effectivePitchRatio) : '---'}</strong></span>
          <span className={`mobile-tracking-state ${tracking.state === 'mismatch' || tracking.state === 'override-lost' ? 'mobile-tracking-warning' : ''}`}>
            {tracking.state === 'matched' ? 'INPUT VERIFIED' : tracking.state === 'mismatch' ? 'INPUT DIFFERS' : tracking.state === 'override-lost' ? 'OVERRIDE LOST' : 'NO INPUT CHECK'}
          </span>
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
        <GroundControls active={controlsAvailable} onGround={telemetry.onGround === 1}
          throttleIdle={telemetry.throttleRatio !== null && telemetry.throttleRatio <= 0.06}
          autopilotActive={autopilotActive} send={flight.sendPedal}/>
      </section>
    </main>

    <footer className="mobile-footer">
      <div className="mobile-recording-controls">
        <span>{autopilotActive ? 'AP CONTROLS FLIGHT' : 'MANUAL YOKE'} · {socket.serverStatus.recording?.samples ?? 0} SAMPLES</span>
        {socket.serverStatus.recording?.active
          ? <button type="button" onClick={flight.stopRecording}>STOP REC</button>
          : <button type="button" disabled={!armed} onClick={flight.startRecording}>RECORD</button>}
        <button type="button" disabled={armed || !socket.sessionRestored || !socket.serverStatus.recording?.samples} onClick={flight.exportRecording}>CSV</button>
      </div>
      <div className="mobile-device-state"><span className={sensorFresh ? 'available' : ''}>{sensorFresh ? <Wifi size={15}/> : <WifiOff size={15}/>} SENSOR {sensorFresh ? `${motion.sampleRateHz} HZ` : 'OFFLINE'}</span><span><Radio size={15}/> SIM {simulator.reachable ? 'ONLINE' : 'OFFLINE'}</span><span>TX {socket.serverStatus.control.inputRateHz} FPS</span></div>
      <div className="mobile-primary-actions">
        {interruptedPause && armed && simulator.pauseOwned === true
          ? <button className="mobile-resume-button" disabled={!nativeResumeReady} onClick={flight.resumeFlight}><Play size={15}/> RESUME FLIGHT</button>
          : motion.enabled ? <button className="mobile-secondary-button" onClick={flight.stopSensors}><Square size={14}/> STOP MOTION</button>
          : <button className="mobile-secondary-button" onClick={() => void motion.requestAccess()}><Smartphone size={16}/> ENABLE MOTION</button>}
        {armed ? <button className="mobile-stop-button" onClick={flight.disarm}><Square size={15}/> DISARM</button> : <button className="mobile-arm-button" disabled={!ready} onClick={flight.arm}><ShieldCheck size={17}/> ARM CONTROL</button>}
      </div>
    </footer>

    {settingsOpen && <MobileSettings onClose={() => setSettingsOpen(false)} pairingCode={flight.pairingCode} onPairingCode={flight.setPairingCode}/>}
    <div className="mobile-orientation-notice"><ArrowLeft size={20}/> Rotate the phone to landscape orientation for motion control.</div>
  </div>;
}
