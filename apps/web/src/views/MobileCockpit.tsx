import { useEffect, useState } from 'react';
import { Monitor, MoreHorizontal, Play, Radio, RotateCcw, Settings2, ShieldCheck, Smartphone, Square, Wifi, WifiOff } from 'lucide-react';
import type { ReturnTypeFlightController } from '../viewTypes';
import { B787PrimaryFlightDisplay } from '../components/mobile/B787PrimaryFlightDisplay';
import { ThrottleLever } from '../components/mobile/ThrottleLever';
import { CompactFlightControls } from '../components/mobile/CompactFlightControls';
import { MobileSettings } from '../components/mobile/MobileSettings';
import { percentDeflection } from '../telemetry/format';

interface Props { flight: ReturnTypeFlightController; onDesktop: () => void; }

function mayResume(armed: boolean, phase: string, nativeArmed: boolean | null | undefined, calibrated: boolean, sensorFresh: boolean) {
  return armed && phase === 'active' && nativeArmed === true && calibrated && sensorFresh;
}

export function MobileCockpit({ flight, onDesktop }: Props) {
  const { motion, socket, output } = flight;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const sensorFresh = motion.enabled && motion.available && Date.now() - motion.lastReadingAt < 800;
  const sim = socket.serverStatus.simulator;
  const data = sim.telemetry;
  const live = socket.connected && sim.telemetryFresh && sim.reachable;
  const armed = socket.serverStatus.ownedByYou;
  const phase = armed ? socket.serverStatus.controlPhase ?? 'pending' : 'idle';
  const autopilot = live && data.autopilotServosOn === 1;
  const controlsAvailable = armed && sim.outputEnabled && sim.reachable &&
    (phase === 'active' || phase === 'unverified') && !autopilot;
  const interruption = sim.simPaused === true && sim.nativeInterrupted === true;
  const resumeReady = interruption && sim.pauseOwned === true && mayResume(armed,phase,sim.nativeArmed,flight.calibrated,sensorFresh);
  const ready = flight.calibrated && sensorFresh && socket.connected &&
    (!sim.outputEnabled || sim.reachable) && (socket.sessionRestored || /^\d{6}$/.test(flight.pairingCode.trim()));
  const headline = interruption ? 'FLIGHT PAUSED · RECONNECT / RECENTER / ARM'
    : sim.simPaused ? 'SIMULATOR PAUSED'
    : autopilot ? 'AUTOPILOT CONTROLS FLIGHT'
    : phase === 'active' ? 'NATIVE CONTROL ACTIVE'
    : armed ? 'ARM PENDING' : socket.connected ? 'X-PLANE LINKED' : 'RECONNECTING';

  useEffect(() => {
    document.documentElement.classList.add('mobile-flight-locked');
    return () => document.documentElement.classList.remove('mobile-flight-locked');
  }, []);

  return <div className="mobile-cockpit fd-layout" onContextMenu={(event) => {
    const target = event.target;
    if (target instanceof Element && !target.closest('input, textarea, select, [contenteditable], [role="textbox"]')) {
      event.preventDefault();
    }
  }}>
    <header className="mobile-topbar fd-topbar" aria-label="Flight controller status and primary controls">
      <div className="fd-link-status" title={headline}>
        <span className={`status-orb ${armed ? 'armed' : socket.connected ? 'linked' : ''}`}/>
        <span className="fd-link-label" role="status" aria-live="polite">
          {flight.localError || motion.error || (socket.notice?.severity === 'error' ? socket.notice.message : null)
            || (interruption ? 'FLIGHT PAUSED' : socket.connected ? sim.reachable ? 'X-PLANE LINKED' : 'SERVER LINKED' : 'RECONNECTING')}
        </span>
      </div>
      <div className="fd-link-metrics" aria-label="Live control link telemetry">
        <span className={sensorFresh ? 'fd-metric-good' : 'fd-metric-off'} title="Phone motion sensor status">
          {sensorFresh ? <Wifi size={12}/> : <WifiOff size={12}/>}
          SENSOR {sensorFresh ? `${motion.sampleRateHz} HZ` : 'OFF'}
        </span>
        <span className={sim.reachable ? 'fd-metric-good' : 'fd-metric-off'} title="X-Plane telemetry connection">
          <Radio size={12}/> SIM {sim.reachable ? 'ONLINE' : 'OFFLINE'}
        </span>
        <span className="fd-metric-tx" title="Accepted control frames per second">TX {socket.serverStatus.control.inputRateHz} FPS</span>
        {sim.simPaused === true && <span className="fd-metric-paused">PAUSED</span>}
      </div>
      <div className="fd-bar-actions">
        <button type="button" className="fd-bar-button fd-bar-recenter" onClick={flight.recenter}
          disabled={!sensorFresh || armed} title={armed ? 'Disarm before recentering' : 'Calibrate the current phone orientation'}>
          <RotateCcw size={13}/><span className="fd-recenter-label">RECENTER</span>
        </button>
        {interruption && armed && sim.pauseOwned === true
          ? <button type="button" className="fd-bar-button fd-bar-resume" disabled={!resumeReady} onClick={flight.resumeFlight}>
              <Play size={13}/> RESUME FLIGHT
            </button>
          : motion.enabled
            ? <button type="button" className="fd-bar-button fd-bar-motion" onClick={flight.stopSensors}>
                <Square size={12}/> STOP MOTION
              </button>
            : <button type="button" className="fd-bar-button fd-bar-motion" onClick={() => void motion.requestAccess()}>
                <Smartphone size={13}/> ENABLE MOTION
              </button>}
        {armed
          ? <button type="button" className="fd-bar-button fd-bar-disarm" onClick={flight.disarm}>
              <Square size={12}/> DISARM
            </button>
          : <button type="button" className="fd-bar-button fd-bar-arm" disabled={!ready} onClick={flight.arm}>
              <ShieldCheck size={13}/> ARM CONTROL
            </button>}
        <div className="fd-bar-tools">
          <button type="button" className="fd-bar-icon" aria-label="Flight recording and CSV tools" title="Recording tools"
            aria-expanded={toolsOpen} aria-controls="fd-recording-menu" onClick={() => setToolsOpen(open => !open)}>
            <MoreHorizontal size={17}/>
          </button>
          {toolsOpen && <div id="fd-recording-menu" className="fd-tools-menu" role="group" aria-label="Flight recording tools">
            <span>{socket.serverStatus.recording?.samples ?? 0} RECORDED SAMPLES</span>
            {socket.serverStatus.recording?.active
              ? <button type="button" onClick={() => { flight.stopRecording(); setToolsOpen(false); }}>STOP RECORDING</button>
              : <button type="button" disabled={!armed} onClick={() => { flight.startRecording(); setToolsOpen(false); }}>START RECORDING</button>}
            <button type="button" disabled={armed || !socket.sessionRestored || !socket.serverStatus.recording?.samples}
              onClick={() => { flight.exportRecording(); setToolsOpen(false); }}>EXPORT CSV</button>
          </div>}
        </div>
        <button type="button" className="fd-bar-icon" onClick={onDesktop} aria-label="Open desktop monitor" title="Desktop monitor"><Monitor size={16}/></button>
        <button type="button" className="fd-bar-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings and pairing" title="Settings and pairing"><Settings2 size={16}/></button>
      </div>
    </header>

    <main className="fd-main">
      <ThrottleLever telemetry={data} live={live} active={controlsAvailable} sendThrottle={flight.sendThrottle} sendPedal={flight.sendPedal}/>
      <div className="fd-center">
        <B787PrimaryFlightDisplay telemetry={data} live={live}/>
        <div className="fd-command-feedback">
          <span>ROLL <strong>{percentDeflection(output.roll)}</strong></span>
          <div className="fd-command-track"><i style={{left:`${50+45*output.roll}%`}}/></div>
          <span>PITCH <strong>{percentDeflection(output.pitch)}</strong></span>
          <div className="fd-command-track"><i style={{left:`${50+45*output.pitch}%`}}/></div>
        </div>
      </div>
      <div className="fd-right">
        <CompactFlightControls telemetry={data} live={live} active={controlsAvailable} speedbrakeAuthorized={armed && live && sim.outputEnabled} sendPedal={flight.sendPedal} sendAction={flight.sendAuxiliary}/>
      </div>
    </main>

    {settingsOpen && <MobileSettings onClose={()=>setSettingsOpen(false)} pairingCode={flight.pairingCode} onPairingCode={flight.setPairingCode}/>}
    <div className="mobile-orientation-notice">Rotate your phone to landscape orientation for motion control.</div>
  </div>;
}
