import { ArrowDown, ArrowUp, Gauge, PlaneLanding, PlaneTakeoff, RadioTower, ShieldAlert } from 'lucide-react';
import type { AuxiliaryAction } from '@xplane/shared';

interface Props {
  active: boolean;
  onAction: (action: AuxiliaryAction) => void;
}

const tiles: { label: string; hint: string; action: AuxiliaryAction; icon: typeof ArrowUp; tone: string }[] = [
  { label: 'TRIM UP', hint: 'PITCH', action: 'trim-up', icon: ArrowUp, tone: 'blue' },
  { label: 'FLAPS +', hint: 'EXTEND', action: 'flaps-down', icon: PlaneLanding, tone: 'blue' },
  { label: 'TRIM DOWN', hint: 'PITCH', action: 'trim-down', icon: ArrowDown, tone: 'blue' },
  { label: 'FLAPS −', hint: 'RETRACT', action: 'flaps-up', icon: PlaneTakeoff, tone: 'blue' },
  { label: 'SPOILERS', hint: 'TOGGLE', action: 'spoilers-toggle', icon: Gauge, tone: 'amber' },
  { label: 'LANDING GEAR', hint: 'TOGGLE', action: 'gear-toggle', icon: RadioTower, tone: 'amber' },
];

export function FlightControls({ active, onAction }: Props) {
  return (
    <div className="flight-control-grid">
      {tiles.map(({ label, hint, action, icon: Icon, tone }) => <button
        key={action} type="button" className={`flight-action ${tone}`} disabled={!active}
        onClick={() => onAction(action)} aria-label={label}>
        <Icon size={21} strokeWidth={1.8}/><strong>{label}</strong><small>{hint}</small>
      </button>)}
      {!active && <div className="action-disabled-note"><ShieldAlert size={14}/> ARM WITH SIMULATOR OUTPUT TO ENABLE</div>}
    </div>
  );
}
