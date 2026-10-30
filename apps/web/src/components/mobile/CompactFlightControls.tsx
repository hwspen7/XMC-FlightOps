import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { AuxiliaryAction, FlightTelemetry } from '@xplane/shared';
import { brakeLevelForDisplacement } from './flightDeckGestures';
import { buildFlapDisplay } from './flapProfiles';
import { gearReadback } from './gearIndication';

type Pedal = 'rudder' | 'brakes' | 'reverse';
interface Props {
  telemetry: FlightTelemetry;
  live: boolean;
  active: boolean;
  speedbrakeAuthorized?: boolean;
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
  useEffect(() => { if (!active || !ground) release(); }, [active, ground, release]);
  const set = (value: number) => {
    const v = clamp(value, -100, 100);
    setRudder(v);
    if (performance.now() - last.current >= 40) {
      send('rudder', v / 100);
      last.current = performance.now();
    }
  };
  const beginGround = (e: PointerEvent<HTMLButtonElement>, value: number) => {
    if (!active || !ground) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setRudder(value);
    send('rudder', value / 100);
  };
  const endGround = () => release();
  return <>
    <section className="fd-rudder fd-tile">
      <div className="fd-tile-title">RUDDER <span>{rudder > 0 ? `R ${rudder}%` : rudder < 0 ? `L ${Math.abs(rudder)}%` : 'CENTERED'}</span></div>
      <div className="fd-rudder-strip">
        <span>L</span>
        <input aria-label="Rudder spring-centered slider" className="fd-rudder-range" type="range" min="-100" max="100" step="1" value={rudder} disabled={!active}
          onChange={e => set(Number(e.target.value))}
          onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onTouchEnd={release}/>
        <span>R</span>
      </div>
    </section>
    <section className="fd-ground fd-tile">
      <div className="fd-tile-title">GROUND TURN <span>{ground ? 'GROUND ONLY' : 'AIR LOCK'}</span></div>
      <div className="fd-ground-turn-buttons">
        <button type="button" className="fd-ground-turn-button fd-ground-turn-button--left" aria-label="Hold for ground left turn" disabled={!active || !ground} onPointerDown={e => beginGround(e, -45)} onPointerUp={endGround} onPointerCancel={endGround} onLostPointerCapture={endGround}>
          <span className="fd-ground-turn-icon" aria-hidden="true"><ArrowLeft size={15} strokeWidth={2.5}/></span>
          <span className="fd-ground-turn-label">LEFT</span>
        </button>
        <button type="button" className="fd-ground-turn-button fd-ground-turn-button--right" aria-label="Hold for ground right turn" disabled={!active || !ground} onPointerDown={e => beginGround(e, 45)} onPointerUp={endGround} onPointerCancel={endGround} onLostPointerCapture={endGround}>
          <span className="fd-ground-turn-label">RIGHT</span>
          <span className="fd-ground-turn-icon" aria-hidden="true"><ArrowRight size={15} strokeWidth={2.5}/></span>
        </button>
      </div>
    </section>
  </>;
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

export function CompactFlightControls({ telemetry, live, active, speedbrakeAuthorized = false, sendPedal, sendAction }: Props) {
  const ground = live && telemetry.onGround === 1;
  const flapInfo = live ? buildFlapDisplay(
    telemetry.aircraftIcao,
    telemetry.flapDetentCount,
    telemetry.flapHandleRatio ?? telemetry.flapRatio,
    telemetry.flapDeployRatio,
  ) : null;
  const spoiler = live && telemetry.speedbrakeRatio !== null ? Math.round(telemetry.speedbrakeRatio * 100) : null;
  const gear = gearReadback(telemetry.gearHandleDown, [telemetry.gearDeploy0Ratio, telemetry.gearDeploy1Ratio, telemetry.gearDeploy2Ratio], live);
  const brake = live ? telemetry.wheelBrakeRatio : null;
  const trim = live && telemetry.elevatorTrimRatio !== null && Number.isFinite(telemetry.elevatorTrimRatio) ? clamp(telemetry.elevatorTrimRatio, -1, 1) : null;
  const trimDirection = trim === null ? 'NO DATA' : trim > .005 ? 'NOSE UP' : trim < -.005 ? 'NOSE DOWN' : 'NEUTRAL';
  const trimValue = trim === null ? '---' : `${Math.abs(trim * 100).toFixed(0)}%`;
  const flapItems = [...(flapInfo?.labels ?? [])].reverse();
  const selected = flapInfo?.selectedIndex ?? 0;
  const position = flapInfo && flapInfo.labels.length > 1 ? 100 * selected / (flapInfo.labels.length - 1) : 0;
  return <div className="fd-extra-controls">
    <Steering active={active} ground={ground} send={sendPedal}/>
    <section className="fd-flaps fd-flaps-spacious fd-tile" aria-label="Aircraft flap controls">
      <div className="fd-tile-title fd-flaps-spacious-header">
        <strong>FLAPS</strong>
        <span title={flapInfo?.model ?? 'Aircraft telemetry unavailable'}>{flapInfo?.model ?? 'NO DATA'}</span>
      </div>
      <div className="fd-flap-current" aria-live="off">{flapInfo?.label ?? '---'}</div>
      <div className="fd-flap-vertical fd-flaps-spacious-body">
        <div className="fd-flap-rail" aria-label={flapInfo ? `Flap detents for ${flapInfo.model}, selected ${flapInfo.label}` : 'Flap configuration unavailable'}>
          {flapItems.length ? flapItems.map((label, rev) => {
            const index = flapItems.length - 1 - rev;
            return <div className={`fd-flap-detent ${selected === index ? 'is-selected' : ''}`} key={`${index}-${label}`}>
              <span className="fd-flap-mark"/><span>{label === 'UP' ? '0' : label}</span>
            </div>;
          }) : <span className="fd-no-detents">NO DATA</span>}
          {flapItems.length > 0 && <i className="fd-flap-handle" aria-hidden="true" style={{bottom: `${position}%`}}/>}
        </div>
        <div className="fd-flap-arrows">
          <button type="button" aria-label={`Retract flaps one detent${flapInfo?.previous ? ` toward ${flapInfo.previous}` : ''}`}
            disabled={!active || (flapInfo !== null && flapInfo.labels.length > 0 && flapInfo.previous === null)}
            onClick={() => sendAction('flaps-up')}>
            <span className="fd-flap-arrow-symbol" aria-hidden="true">▲</span><small>UP</small>
          </button>
          <button type="button" aria-label={`Extend flaps one detent${flapInfo?.next ? ` toward ${flapInfo.next}` : ''}`}
            disabled={!active || (flapInfo !== null && flapInfo.labels.length > 0 && flapInfo.next === null)}
            onClick={() => sendAction('flaps-down')}>
            <span className="fd-flap-arrow-symbol" aria-hidden="true">▼</span><small>DN</small>
          </button>
        </div>
      </div>
      <div className="fd-flap-foot fd-flaps-spacious-foot" role="status" aria-live="polite">
        <strong>SEL {flapInfo?.label ?? '---'}</strong>
        <small>{flapInfo ? `SURFACE ${flapInfo.actualPercent === null ? '---' : `${flapInfo.actualPercent}%`}${flapInfo.moving ? ' · MOVING' : ''}` : 'WAITING FOR DATA'}</small>
      </div>
    </section>
    <div className="fd-secondary-stack">
      <button type="button" className="fd-spoilers fd-speedbrake-button fd-tile" disabled={!(active || (speedbrakeAuthorized && ground))} title="Manual ground toggle. Aircraft automatic touchdown deployment is configured separately in X-Plane."
        onClick={() => sendAction('spoilers-toggle')}
        aria-label={`Toggle speedbrake. ${spoiler === null ? 'Feedback unavailable' : spoiler < 5 ? 'Stowed' : `Deployed ${spoiler}%`}`}>
        <span className="fd-speedbrake-heading">SPEEDBRAKE</span>
        <strong className={spoiler !== null && spoiler >= 5 ? 'fd-speedbrake-active' : ''}>{spoiler===null ? '---' : spoiler<5 ? 'STOWED' : `${spoiler}% EXT`}</strong>
      </button>
      <TouchBrake active={active} send={sendPedal} ratio={brake}/>
      <button className="fd-gear-panel fd-tile" data-state={gear.state} disabled={!active} aria-label={`Toggle landing gear. ${gear.headline}. ${gear.detail}`} onClick={() => sendAction('gear-toggle')}>
        <span className="fd-gear-top"><b>GEAR</b><strong>{gear.headline}</strong></span>
        <span className="fd-gear-assembly" aria-label="Three individual landing gear deployment indications">
          {gear.lamps.map((lamp, i) => <span key={i} className="fd-gear-leg" data-lamp={lamp} aria-label={`${['LEFT','NOSE','RIGHT'][i]} gear: ${lamp}`}>
            <span className="fd-gear-leg-name">{['L','N','R'][i]}</span>
            <svg viewBox="0 0 30 35" role="presentation" aria-hidden="true">
              <path d="M15 2V20M11 6H19M11 20L7 25M19 20L23 25" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
              <circle cx="8" cy="28" r="4.6" stroke="currentColor" strokeWidth="1.8" fill="#071420"/>
              <circle cx="22" cy="28" r="4.6" stroke="currentColor" strokeWidth="1.8" fill="#071420"/>
            </svg>
          </span>)}
        </span>
        <span className="fd-gear-bottom">{gear.detail}</span>
      </button>
      <section className="fd-trim-panel fd-tile">
        <div className="fd-tile-title">PITCH TRIM <span>{trimDirection} {trimValue}</span></div>
        <div className="fd-trim-controls">
          <button aria-label="Pitch trim nose up one step" disabled={!active} onClick={() => sendAction('trim-up')}>▲<small>UP</small></button>
          <div className="fd-trim-indicator"><i className="fd-trim-center"/><i className="fd-trim-pointer" style={{left: `${50 + 47 * (trim ?? 0)}%`}}/><span>{trim === null ? '---' : trimValue}</span></div>
          <button aria-label="Pitch trim nose down one step" disabled={!active} onClick={() => sendAction('trim-down')}>▼<small>DN</small></button>
        </div>
      </section>
    </div>
  </div>;
}
