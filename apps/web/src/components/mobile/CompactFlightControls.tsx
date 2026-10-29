import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { AuxiliaryAction, FlightTelemetry } from '@xplane/shared';
import { brakeLevelForDisplacement } from './flightDeckGestures';
import { buildFlapDisplay } from './flapProfiles';

type Pedal = 'rudder' | 'brakes' | 'reverse';
interface Props {
  telemetry: FlightTelemetry;
  live: boolean;
  active: boolean;
  sendPedal: (action: Pedal, value: number) => void;
  sendAction: (action: AuxiliaryAction) => void;
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

function Steering({ active, ground, send }: { active: boolean; ground: boolean; send: Props['sendPedal'] }) {
  const [rudder, setRudder] = useState(0);
  const sendRef = useRef(send); sendRef.current = send;
  const last = useRef(0);
  const release = useCallback(() => { setRudder(0); sendRef.current('rudder', 0); }, []);
  useEffect(() => {
    const cancel = () => { if (document.visibilityState === 'hidden') release(); };
    const blur = () => release();
    document.addEventListener('visibilitychange', cancel);
    window.addEventListener('blur', blur);
    return () => { document.removeEventListener('visibilitychange', cancel); window.removeEventListener('blur', blur); release(); };
  }, [release]);
  const set = (value: number) => {
    const v = clamp(value, -100, 100);
    setRudder(v);
    if (performance.now() - last.current >= 40) { send('rudder', v / 100); last.current = performance.now(); }
  };
  return <section className="fd-rudder fd-tile">
    <div className="fd-tile-title">RUDDER <span>{rudder > 0 ? 'RIGHT' : rudder < 0 ? 'LEFT' : 'CENTER'}</span></div>
    <input aria-label="Rudder, spring centered" className="fd-rudder-range" type="range" min="-100" max="100" value={rudder} disabled={!active} onChange={e => set(Number(e.target.value))}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onTouchEnd={release}/>
    <div className="fd-rudder-caption"><span>L</span><span>{rudder}%</span><span>R</span></div>
    <div className="fd-ground-mini">
      <span>GROUND TURN <small>{ground ? 'AVAILABLE' : 'AIR LOCK'}</small></span>
      <div className="fd-ground-buttons">
        <button disabled={!active || !ground} onPointerDown={() => set(-45)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>◀</button>
        <button disabled={!active || !ground} onClick={release}>●</button>
        <button disabled={!active || !ground} onPointerDown={() => set(45)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>▶</button>
      </div>
    </div>
  </section>;
}

export function TouchBrake({ active, send, ratio }: { active: boolean; send: Props['sendPedal']; ratio: number | null }) {
  const [level, setLevel] = useState(0);
  const originY = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const current = useRef(0);
  const sendRef = useRef(send); sendRef.current = send;
  const release = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null; current.current = 0; setLevel(0); sendRef.current('brakes',0);
  }, []);
  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === 'hidden') release(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onHidden);
    return () => { release(); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', onHidden); };
  }, [release]);
  const start = (e: PointerEvent<HTMLButtonElement>) => {
    if (!active) return;
    originY.current = e.clientY;
    current.current = .5; setLevel(.5);
    e.currentTarget.setPointerCapture(e.pointerId);
    send('brakes', .5);
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = setInterval(() => sendRef.current('brakes', current.current), 120);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (!active || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const next = brakeLevelForDisplacement(originY.current, e.clientY);
    if (current.current !== next) { current.current = next; setLevel(next); send('brakes', next); }
  };
  return <section className="fd-brake fd-tile">
    <div className="fd-tile-title">BRAKES <span>{ratio === null ? '---' : `${Math.round(ratio*100)}% ACTUAL`}</span></div>
    <button className={`fd-brake-pad ${level === 1 ? 'fd-max' : level > 0 ? 'fd-regular' : ''}`}
      disabled={!active} style={{touchAction:'none'}} onPointerDown={start} onPointerMove={move}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <strong>{level === 1 ? 'MAX BRAKE' : level > 0 ? 'REGULAR BRAKE' : 'HOLD TO BRAKE'}</strong>
      <small>{level === 1 ? 'RELEASE TO STOP' : 'SLIDE UP FOR MAX ↑'}</small>
    </button>
  </section>;
}

export function CompactFlightControls({ telemetry, live, active, sendPedal, sendAction }: Props) {
  const ground = live && telemetry.onGround === 1;
  const flapInfo = live ? buildFlapDisplay(
    telemetry.aircraftIcao,
    telemetry.flapDetentCount,
    telemetry.flapHandleRatio ?? telemetry.flapRatio,
    telemetry.flapDeployRatio,
  ) : null;
  const flap = flapInfo?.label ?? '---';
  const spoiler = live && telemetry.speedbrakeRatio !== null ? Math.round(telemetry.speedbrakeRatio * 100) : null;
  const gear = live && telemetry.gearHandleDown !== null ? telemetry.gearHandleDown > .5 ? 'DOWN' : 'UP' : '---';
  const brake = live ? telemetry.wheelBrakeRatio : null;
  const gearAria = `Toggle landing gear (current handle: ${gear})`;

  return <div className="fd-extra-controls">
    <Steering active={active} ground={ground} send={sendPedal}/>
    <div className="fd-compact-row fd-system-row">
      <section className="fd-flaps fd-tile">
        <div className="fd-tile-title">FLAPS <span>{flapInfo ? `${flapInfo.model} · ${flapInfo.authoritativeLabels ? 'DETENT' : 'CONFIG'}` : 'NO DATA'}</span></div>
        <div className="fd-step fd-step-flaps">
          <button aria-label="Retract flaps one step" disabled={!active || (flapInfo !== null && flapInfo.labels.length > 0 && flapInfo.previous === null)} onClick={() => sendAction('flaps-up')}>−</button>
          <div className="fd-flap-readout">
            <strong>{flap}</strong>
            <small>{flapInfo ? `HANDLE ${flapInfo.handlePercent}% · ACT ${flapInfo.actualPercent ?? '---'}%${flapInfo.moving ? ' · MOVING' : ''}` : 'WAITING FOR DATA'}</small>
          </div>
          <button aria-label="Extend flaps one step" disabled={!active || (flapInfo !== null && flapInfo.labels.length > 0 && flapInfo.next === null)} onClick={() => sendAction('flaps-down')}>+</button>
        </div>
        {flapInfo && flapInfo.labels.length > 0 && <div className="fd-flap-ticks" aria-label="Configured flap detents">{flapInfo.labels.map((label,index) =>
          <span key={index} title={label} className={index === flapInfo.selectedIndex ? 'selected' : ''} aria-current={index === flapInfo.selectedIndex ? 'true' : undefined}/>)}</div>}
      </section>
      <section className="fd-spoilers fd-tile"><div className="fd-tile-title">SPEEDBRAKE</div>
        <button disabled={!active} onClick={() => sendAction('spoilers-toggle')}><strong>{spoiler===null?'---':spoiler<5?'STOWED':`${spoiler}%`}</strong><small>TOGGLE</small></button>
      </section>
    </div>
    <div className="fd-compact-row fd-bottom-control">
      <TouchBrake active={active} send={sendPedal} ratio={brake}/>
      <div className="fd-utility-stack">
        <button className="fd-util-gear" data-gear={gear} aria-label={gearAria} disabled={!active} onClick={()=>sendAction('gear-toggle')}>
          <span className="fd-gear-label-row"><span>GEAR</span><em>{gear}</em></span>
          <div className={`fd-gear-visual ${gear === 'UP' ? 'retracted' : ''}`} aria-hidden="true"><i/><i/><i/></div>
          <strong>{gear === 'DOWN' ? 'RAISE' : gear === 'UP' ? 'LOWER' : 'NO DATA'}</strong>
        </button>
        <div className="fd-trim"><span>TRIM</span><button aria-label="Pitch trim nose down" disabled={!active} onClick={()=>sendAction('trim-down')}>−</button><button aria-label="Pitch trim nose up" disabled={!active} onClick={()=>sendAction('trim-up')}>+</button></div>
      </div>
    </div>
  </div>;
}
