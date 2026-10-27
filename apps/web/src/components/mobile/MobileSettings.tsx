import { X } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';
import type { YokeSettings } from '../../controllers/yoke';

interface Props {
  onClose: () => void;
  settings: YokeSettings;
  onChange: (settings: YokeSettings) => void;
  pairingCode: string;
  onPairingCode: (value: string) => void;
}

export function MobileSettings({ onClose, settings, onChange, pairingCode, onPairingCode }: Props) {
  return <div className="mobile-settings-backdrop" role="presentation" onClick={onClose}>
    <section className="mobile-settings-panel" role="dialog" aria-modal="true" aria-label="Yoke setup" onClick={(event: { stopPropagation(): void }) => event.stopPropagation()}>
      <div className="mobile-settings-header"><div><small>CONTROLLER CONFIGURATION</small><h2>Yoke settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={22}/></button></div>
      <label className="settings-code">PAIRING CODE<input inputMode="numeric" type="password" maxLength={6} placeholder="Six-digit code" value={pairingCode} onChange={(event) => onPairingCode(event.target.value)}/></label>
      <SettingsPanel settings={settings} onChange={onChange}/>
      <div className="settings-note">Motion sensors require HTTPS on iPhone. Recenter after changing your grip. Secondary commands are available only while armed and simulator output is enabled.</div>
    </section>
  </div>;
}
