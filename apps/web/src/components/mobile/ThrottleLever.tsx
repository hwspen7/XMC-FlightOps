import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import {
  clampFraction, fractionForForward, fractionForReverse, IDLE_TRAVEL_FRACTION,
  reverseDetentPermitted, throttleAtTravel, travelFromPointer,
} from './throttleLeverLogic';
import { REVERSE_IDLE_REFERENCE_FRACTION, REVERSE_IDLE_REFERENCE_PERCENT, THROTTLE_SCALE_MARKS } from './throttleScale';
import { formatN1Readout } from './throttleReadout';

interface Props {
  telemetry: FlightTelemetry;
  live: boolean;
  active: boolean;
  sendThrottle: (ratio: number) => void;
  sendPedal: (action: 'rudder' | 'brakes' | 'reverse', value: number) => void;
}

interface DragState {
  pointerId: number;
  startY: number;
  startPosition: number;
  idleSince: number | null;
}

/**
 * The handle is one continuous input, not a separate reverse slider.
 * Reverse requires a brief idle detent and confirmed X-Plane ground/idle state.
 * On finger release only reverse is spring-returned; forward throttle holds.
 */
export function ThrottleLever({ telemetry, live, active, sendThrottle, sendPedal }: Props) {
  const [position, setPosition] = useState(IDLE_TRAVEL_FRACTION);
  const [dragging, setDragging] = useState(false);
  const [detentBlocked, setDetentBlocked] = useState(false);
  const drag = useRef<DragState | null>(null);
  const rail = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(IDLE_TRAVEL_FRACTION);
  const reverseRef = useRef(0);
  const forwardSendRef = useRef({ at: 0, value: -1 });
  const reverseSendRef = useRef({ at: 0, value: -1 });
  const maxReverseLatched = useRef(false);

  const actual = live ? telemetry.throttleRatio : null;
  const onGround = live && telemetry.onGround === 1;
  const autothrottle = live && telemetry.autothrottleOn === 1;
  const reverseActual = live && telemetry.reverseHandleRatio !== null && telemetry.reverseActive === 1
    ? Math.round(Math.abs(telemetry.reverseHandleRatio) * 100) : null;
  const usable = active && !autothrottle;
  const values = throttleAtTravel(position);
  const reverseReady = reverseDetentPermitted(usable, onGround, autothrottle, actual, Infinity);

  const updatePosition = (fraction: number) => {
    const bounded = clampFraction(fraction);
    positionRef.current = bounded;
    setPosition(bounded);
  };

  const forwardCommand = (value: number, force = false) => {
    const now = performance.now();
    const current = forwardSendRef.current;
    if (force || (current.value !== value && (now - current.at >= 65 || value === 0 || value === 100))) {
      sendThrottle(value / 100);
      forwardSendRef.current = { at: now, value };
    }
  };

  const reverseCommand = (value: number, force = false) => {
    const now = performance.now();
    const current = reverseSendRef.current;
    reverseRef.current = value;
    if (force || (current.value !== value && (now - current.at >= 40 || value === 0 || value === 100))) {
      sendPedal('reverse', value / 100);
      reverseSendRef.current = { at: now, value };
    }
  };

  const releaseReverse = useCallback(() => {
    if (reverseRef.current > 0) {
      reverseRef.current = 0;
      sendPedal('reverse', 0);
      positionRef.current = IDLE_TRAVEL_FRACTION;
      setPosition(IDLE_TRAVEL_FRACTION);
    }
  }, [sendPedal]);

  const stopDragging = useCallback(() => {
    const wasDragging = drag.current !== null;
    drag.current = null;
    setDragging(false);
    setDetentBlocked(false);
    maxReverseLatched.current = false;
    if (reverseRef.current > 0) {
      releaseReverse();
      // Reverse returns to idle. Never leave an unintended forward command.
      sendThrottle(0);
    } else if (wasDragging) {
      // An unapproved reverse gesture must end at IDLE, not leave a phantom
      // reverse position on the phone.
      const heldInReverseZone = positionRef.current > IDLE_TRAVEL_FRACTION;
      if (heldInReverseZone) {
        positionRef.current = IDLE_TRAVEL_FRACTION;
        setPosition(IDLE_TRAVEL_FRACTION);
      }
      const forward = heldInReverseZone ? 0 : throttleAtTravel(positionRef.current).forward;
      sendThrottle(forward / 100);
      forwardSendRef.current = { at: performance.now(), value: forward };
    }
  }, [releaseReverse, sendThrottle]);

  useEffect(() => {
    if (dragging || !live) return;
    if (reverseActual !== null) {
      const newPosition = fractionForReverse(reverseActual);
      positionRef.current = newPosition;
      setPosition(newPosition);
    } else if (actual !== null) {
      const newPosition = fractionForForward(actual * 100);
      positionRef.current = newPosition;
      setPosition(newPosition);
    }
  }, [actual, reverseActual, dragging, live]);

  useEffect(() => {
    if (!usable || !onGround) {
      releaseReverse();
      if (drag.current && !usable) stopDragging();
    }
  }, [usable, onGround, releaseReverse, stopDragging]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') stopDragging();
    };
    window.addEventListener('blur', stopDragging);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('blur', stopDragging);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [stopDragging]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!usable || drag.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: positionRef.current,
      idleSince: positionRef.current >= IDLE_TRAVEL_FRACTION ? performance.now() : null,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || event.pointerId !== gesture.pointerId || !rail.current) return;
    event.preventDefault();
    const travelHeight = Math.max(1, rail.current.getBoundingClientRect().height);
    const proposed = travelFromPointer(gesture.startPosition, event.clientY - gesture.startY, travelHeight);
    if (proposed <= IDLE_TRAVEL_FRACTION) {
      maxReverseLatched.current = false;
      gesture.idleSince = proposed === IDLE_TRAVEL_FRACTION ? gesture.idleSince ?? performance.now() : null;
      setDetentBlocked(false);
      if (reverseRef.current > 0) reverseCommand(0, true);
      updatePosition(proposed);
      forwardCommand(throttleAtTravel(proposed).forward);
      return;
    }

    // Keep the handle visually attached to the finger through IDLE. This is
    // NOT a reverse command: X-Plane ground/idle/dwell interlocks still gate it.
    // Never animate beyond idle when the airplane is airborne.
    if (!onGround) {
      updatePosition(IDLE_TRAVEL_FRACTION);
      setDetentBlocked(true);
      forwardCommand(0);
      return;
    }
    if (gesture.idleSince === null) gesture.idleSince = performance.now();
    updatePosition(proposed);
    // Repeat IDLE requests only when necessary; do not reset drag origin.
    if (reverseRef.current === 0 && (forwardSendRef.current.value !== 0 ||
        (actual !== null && actual > 0.06 && performance.now() - forwardSendRef.current.at >= 110))) {
      forwardCommand(0, true);
    }
    if (!reverseDetentPermitted(usable, onGround, autothrottle, actual, performance.now() - gesture.idleSince)) {
      if (reverseRef.current > 0) reverseCommand(0, true);
      setDetentBlocked(true);
      return;
    }
    setDetentBlocked(false);
    // Stable MAX REV endpoint: a narrow snap-and-release hysteresis prevents
    // oscillation between 98/99/100 on iPhone pointer samples at the rail end.
    if (proposed >= 0.978) maxReverseLatched.current = true;
    else if (proposed <= 0.955) maxReverseLatched.current = false;
    const { reverse } = throttleAtTravel(proposed);
    const commandReverse = maxReverseLatched.current ? 100 : reverse;
    if (commandReverse !== reverseRef.current) reverseCommand(commandReverse);
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    stopDragging();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!usable || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (reverseRef.current > 0) reverseCommand(0, true);
    const current = throttleAtTravel(positionRef.current).forward;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 100 :
      Math.max(0, Math.min(100, current + (event.key === 'ArrowUp' ? 5 : -5)));
    updatePosition(fractionForForward(next));
    forwardCommand(next, true);
  };

  const shownReverse = !detentBlocked && position >= .955 && maxReverseLatched.current ? 100 : values.reverse;
  const dynamicLabel = detentBlocked ? 'REV WAIT' : shownReverse >= 100 ? 'MAX REV' : shownReverse > 0 ? `REV ${shownReverse}%`
    : values.forward === 0 ? 'IDLE' : `${values.forward}%`;
  const n1Readout = live ? formatN1Readout(telemetry.n1LeftPercent, telemetry.n1RightPercent) : '---';
  const commandReadout = usable
    ? (detentBlocked ? 'REV WAIT' : shownReverse >= 100 ? 'REV 100%' : values.reverse > 0 ? `REV ${values.reverse}%` : `${values.forward}%`) : '---';

  return <section className="fd-throttle fd-tile" aria-label="Single throttle lever with idle and reverse detent">
    <div className="fd-throttle-value" aria-label="Throttle command and actual X-Plane engine N1 readback"
      title={actual === null ? 'X-Plane throttle readback unavailable' : `X-Plane throttle lever readback ${Math.round(actual * 100)}%`}>
      <span className="fd-throttle-readout-row"><span>THR</span><strong>{commandReadout}</strong></span>
      <span className="fd-throttle-readout-row"><span>N1</span><strong>{n1Readout}</strong></span>
    </div>
    <div className="fd-throttle-flex">
      <div className="fd-lever-scale" aria-hidden="true">
        <div className="fd-lever-scale-inner">
          {THROTTLE_SCALE_MARKS.map(mark => (
            <div key={`${mark.zone}-${mark.value}`}
              className={`fd-scale-mark ${mark.major ? 'fd-scale-major' : ''} ${mark.zone === 'reverse' ? 'fd-scale-reverse' : ''} ${mark.detent ? `fd-scale-detent fd-scale-${mark.detent}` : ''}`}
              style={{ top: `${mark.fraction * 100}%` }}
              title={mark.detent === 'idle' ? 'IDLE: protected forward/reverse boundary'
                : mark.detent === 'reverse-idle' ? 'REV IDLE: approximate reverse-command reference'
                : mark.detent === 'max-reverse' ? 'MAX REV: maximum reverse command' : undefined}>
              {mark.label && <span className="fd-scale-label">{mark.label}</span>}
              <span className="fd-scale-tick" />
            </div>
          ))}
        </div>
      </div>
      <div className={`fd-lever-touch ${usable ? '' : 'fd-lever-disabled'} ${values.reverse > 0 ? 'fd-lever-reversing' : ''}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={onPointerEnd} onKeyDown={onKeyDown}
        role="slider" tabIndex={usable ? 0 : -1} aria-label="Throttle and reverse lever"
        aria-valuemin={-100} aria-valuemax={100}
        aria-valuenow={values.reverse > 0 ? -values.reverse : values.forward}
        aria-valuetext={values.reverse > 0 ? `${values.reverse}% reverse` : `${values.forward}% forward`}
        aria-disabled={!usable}>
        <div className="fd-lever-rail" ref={rail}>
          <div className="fd-lever-channel"/>
          <div className="fd-lever-reverse-region" style={{ top: `${IDLE_TRAVEL_FRACTION * 100}%` }}/>
          <div className="fd-lever-detent" style={{ top: `${IDLE_TRAVEL_FRACTION * 100}%` }}/>
          <div className="fd-lever-stage fd-lever-stage-reverse-idle"
            style={{ top: `${REVERSE_IDLE_REFERENCE_FRACTION * 100}%` }}
            aria-hidden="true" />
          <div className="fd-lever-stage fd-lever-stage-max-reverse" aria-hidden="true" />
          <div className={`fd-lever-handle ${shownReverse >= 100 ? 'fd-lever-max-reverse' : ''}`} style={{ top: `${position * 100}%` } as CSSProperties}>
            <span className="fd-lever-grip"/>
            <strong>{dynamicLabel}</strong>
          </div>
        </div>
      </div>
    </div>
    <div className={`fd-throttle-hint ${detentBlocked ? 'fd-throttle-hint-locked' : ''}`}>
      {autothrottle ? 'AUTOTHROTTLE' : !active ? 'MONITOR ONLY'
        : !onGround ? 'REVERSE LOCKED IN AIR'
        : detentBlocked ? 'ARMING REVERSE · WAIT FOR IDLE' 
        : values.reverse >= 99 ? 'MAX REV COMMAND'
        : values.reverse > 0 && values.reverse <= REVERSE_IDLE_REFERENCE_PERCENT ? 'REV IDLE RANGE'
        : values.reverse > 0 ? `REVERSING ${values.reverse}%`
        : reverseReady ? 'REVERSE BELOW IDLE' : 'REVERSE: GROUND + IDLE'}
    </div>
  </section>;
}
