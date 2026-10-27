import { Activity, Network, Shield, Smartphone, Wifi } from 'lucide-react';
import type { ServerStatus } from '@xplane/shared';
import { displayValue, percentDeflection } from '../../telemetry/format';

interface Props { connected: boolean; status: ServerStatus; }

function Signal({ title, connected, detail, icon: Icon }: { title:string; connected:boolean; detail:string; icon: typeof Wifi }) {
  return <div className="signal-row"><div className={`signal-icon ${connected?'online':''}`}><Icon size={17}/></div><div><strong>{title}</strong><small>{detail}</small></div><span className={`signal-state ${connected?'online':''}`}>{connected?'ONLINE':'OFFLINE'}</span></div>;
}

export function SignalPanel({ connected, status }: Props) {
  const sim = status.simulator;
  const ctl = status.control;
  return <section className="monitor-card signal-panel">
    <div className="card-heading"><div><span className="micro-label">DEVICE DIAGNOSTICS</span><h2>Connectivity & input health</h2></div><span className="tag-outline">READ ONLY</span></div>
    <div className="signal-stack">
      <Signal title="Monitoring gateway" connected={connected} detail="Secure browser connection" icon={Network}/>
      <Signal title="X-Plane telemetry" connected={connected&&sim.reachable} detail={`${sim.host}:${sim.port}`} icon={Wifi}/>
      <Signal title="Mobile controller" connected={connected&&status.armed} detail={status.armed?'Controller owns flight axes':'No controller armed'} icon={Smartphone}/>
      <Signal title="Simulator control output" connected={sim.outputEnabled} detail={sim.outputEnabled?'Writing enabled by server configuration':'Disabled by server configuration'} icon={Shield}/>
    </div>
    <div className="diagnostic-grid">
      <div><span>RECEIVED PARAMETERS</span><strong>{connected?`${sim.receivedFields} / ${sim.subscribedFields}`:'---'}</strong></div>
      <div><span>SIM HEARTBEAT AGE</span><strong>{connected?displayValue(sim.lastHeartbeatAgeMs):'---'} <small>MS</small></strong></div>
      <div><span>MOTION SENSOR</span><strong>{status.armed ? displayValue(ctl.sensorRateHz) : '---'} <small>HZ</small></strong></div>
      <div><span>INPUT STREAM</span><strong>{status.armed?ctl.inputRateHz:'---'} <small>FPS</small></strong></div>
      <div><span>LAST FRAME AGE</span><strong>{status.armed?displayValue(ctl.lastFrameAgeMs):'---'} <small>MS</small></strong></div>
      <div><span>ACCEPTED FRAMES</span><strong>{connected?displayValue(ctl.framesAccepted):'---'}</strong></div>
      <div><span>DEAD-MAN TIMEOUT</span><strong>{ctl.timeoutMs} <small>MS</small></strong></div>
      <div><span>LAST AUXILIARY INPUT</span><strong className="last-action">{ctl.lastAction??'NONE'}</strong></div>
    </div>
    <div className="pilot-input"><div><span>PHONE ROLL</span><strong>{ctl.inputRoll===null?'---':percentDeflection(ctl.inputRoll)}</strong><div className="input-gauge"><i style={{left:`${50+47*(ctl.inputRoll??0)}%`}}/></div></div><div><span>PHONE PITCH</span><strong>{ctl.inputPitch===null?'---':percentDeflection(ctl.inputPitch)}</strong><div className="input-gauge"><i style={{left:`${50+47*(ctl.inputPitch??0)}%`}}/></div></div></div>
    <div className="signal-note"><Activity size={15}/> Aircraft measurements and mobile inputs are shown separately. They are not expected to match instantaneously.</div>
  </section>;
}
