import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { YokeSettings } from '../../controllers/yoke';

interface Props { settings: YokeSettings; onChange: (settings: YokeSettings) => void }

function Slider({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span><strong>{label}</strong><span>{display}</span></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: Props) {
  const set = <K extends keyof YokeSettings,>(key: K, value: YokeSettings[K]) => onChange({ ...settings, [key]: value });
  return (
    <details className="surface settings-panel">
      <summary className="settings-summary"><span className="eyebrow"><SlidersHorizontal size={15} /> RESPONSE TUNING</span><span className="settings-caption">EXPAND PARAMETERS <ChevronDown size={15} /></span></summary>
      <div className="settings-body">
        <Slider label="Roll travel" value={settings.rollTravelDegrees} display={`${settings.rollTravelDegrees}°`} min={20} max={90} step={1} onChange={(n) => set('rollTravelDegrees', n)} />
        <Slider label="Pitch travel" value={settings.pitchTravelDegrees} display={`${settings.pitchTravelDegrees}°`} min={10} max={60} step={1} onChange={(n) => set('pitchTravelDegrees', n)} />
        <Slider label="Dead zone" value={settings.deadZone} display={`${Math.round(settings.deadZone * 100)}%`} min={0} max={0.2} step={0.005} onChange={(n) => set('deadZone', n)} />
        <Slider label="Response curve" value={settings.responseExponent} display={settings.responseExponent.toFixed(2)} min={1} max={2.5} step={0.05} onChange={(n) => set('responseExponent', n)} />
        <Slider label="Smoothing" value={settings.smoothingMs} display={`${settings.smoothingMs} ms`} min={0} max={200} step={5} onChange={(n) => set('smoothingMs', n)} />
        <div className="toggle-row">
          <label><input type="checkbox" checked={settings.invertRoll} onChange={(e) => set('invertRoll', e.target.checked)} /> Invert roll</label>
          <label><input type="checkbox" checked={settings.invertPitch} onChange={(e) => set('invertPitch', e.target.checked)} /> Invert pitch</label>
        </div>
      </div>
    </details>
  );
}
