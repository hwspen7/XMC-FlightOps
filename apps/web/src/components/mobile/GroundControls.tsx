import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  active: boolean;
  onGround: boolean;
  throttleIdle: boolean;
  autopilotActive: boolean;
  send: (action: 'rudder' | 'brakes' | 'reverse', value: number) => void;
}
export function GroundControls({ active, onGround, throttleIdle, autopilotActive, send }: Props) {
  const [rudder, setRudder] = useState(0);
  const [reverse, setReverse] = useState(0);
  const brakeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;
  const releaseBrakes = useCallback(() => {
    if (brakeTimer.current) clearInterval(brakeTimer.current);
    brakeTimer.current = null;
    sendRef.current('brakes', 0);
  }, []);
  const releaseRudder = useCallback(() => {
    setRudder(0); sendRef.current('rudder', 0);
  }, []);
  const releaseReverse = useCallback(() => {
    setReverse(0); sendRef.current('reverse', 0);
  }, []);
  useEffect(() => {
    // iOS backgrounding may not emit pointerup. Native C++ also has a watchdog.
    const onHidden = () => { if (document.visibilityState === 'hidden') { releaseBrakes(); releaseRudder(); releaseReverse(); } };
    window.addEventListener('blur', onHidden);
    document.addEventListener('visibilitychange', onHidden);
    return () => { releaseBrakes(); releaseRudder(); releaseReverse(); window.removeEventListener('blur', onHidden); document.removeEventListener('visibilitychange', onHidden); };
  }, [releaseBrakes, releaseRudder, releaseReverse]);
  const usable = active && !autopilotActive;
  return <div className="mobile-ground-controls" aria-label="Ground and rudder controls">
    <div className="ground-header"><span>RUDDER / TAXI</span><strong>{autopilotActive ? 'AP ACTIVE' : onGround ? 'GROUND' : 'AIR'}</strong></div>
    <input aria-label="Rudder steering (spring center)" type="range" min="-100" max="100" step="2" value={rudder}
      disabled={!usable} onChange={event => { const v = Number(event.target.value); setRudder(v); send('rudder', v / 100); }}
      onPointerUp={releaseRudder} onPointerCancel={releaseRudder} onTouchEnd={releaseRudder}/>
    <div className="ground-row">
      <button type="button" className="ground-brake" disabled={!usable}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); send('brakes', 1);
          if (brakeTimer.current) clearInterval(brakeTimer.current);
          brakeTimer.current = setInterval(() => sendRef.current('brakes', 1), 120); }}
        onPointerUp={releaseBrakes} onPointerCancel={releaseBrakes} onLostPointerCapture={releaseBrakes}>HOLD BRAKES</button>
      <div className="ground-reverse"><span>REV {reverse}%</span><input aria-label="Hold reverse thrust" type="range" min="0" max="100" step="5" value={reverse}
        disabled={!usable || !onGround || !throttleIdle}
        onChange={event => { const v = Number(event.target.value); setReverse(v); send('reverse', v / 100); }}
        onPointerUp={releaseReverse} onPointerCancel={releaseReverse} onTouchEnd={releaseReverse}/></div>
    </div>
    <small>Rudder and reverse spring to neutral. Reverse requires ground + idle.</small>
  </div>;
}
