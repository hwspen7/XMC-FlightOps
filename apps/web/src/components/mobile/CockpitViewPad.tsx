import { useRef, type PointerEvent } from 'react';
import type { AuxiliaryAction } from '@xplane/shared';
import { viewStepForDisplacement } from './flightDeckGestures';

interface Props { active: boolean; send: (action: AuxiliaryAction) => void; }
export function CockpitViewPad({ active, send }: Props) {
  const pointer = useRef<{ id: number; x: number; y: number; last: number } | null>(null);
  const start = (e: PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, last: 0 };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!active || !p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.max(Math.abs(dx),Math.abs(dy)) < 14 || performance.now() - p.last < 210) return;
    const direction = viewStepForDisplacement(dx, dy);
    if (!direction) return;
    send(direction);
    pointer.current = { id: p.id, x: e.clientX, y: e.clientY, last: performance.now() };
  };
  const release = () => { pointer.current = null; };
  return <section className="fd-view fd-tile">
    <div className="fd-tile-title">COCKPIT VIEW <span>DRAG TO LOOK</span></div>
    <div className="fd-view-area" role="group" aria-label="Cockpit head look pad" onPointerDown={start} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <span className="fd-view-cross">✛</span><span className="fd-view-top">↑</span><span className="fd-view-left">‹</span><span className="fd-view-right">›</span><span className="fd-view-bottom">↓</span>
    </div>
    <div className="fd-view-quick">
      <button disabled={!active} onClick={() => send('view-zoom-out')}>−</button>
      <button disabled={!active} onClick={() => send('view-center')}>CENTER</button>
      <button disabled={!active} onClick={() => send('view-zoom-in')}>+</button>
    </div>
  </section>;
}
