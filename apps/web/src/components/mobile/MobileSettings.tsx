import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  pairingCode: string;
  onPairingCode: (value: string) => void;
}

export function MobileSettings({ onClose, pairingCode, onPairingCode }: Props) {
  return <div className="mobile-settings-backdrop" role="presentation" onClick={onClose}>
    <section className="mobile-settings-panel" role="dialog" aria-modal="true" aria-label="Pair controller" onClick={(event) => event.stopPropagation()}>
      <div className="mobile-settings-header">
        <div><small>SECURE PAIRING</small><h2>Connect controller</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Close pairing"><X size={22}/></button>
      </div>
      <label className="settings-code">PAIRING CODE
        <input inputMode="numeric" type="password" pattern="[0-9]*" maxLength={6}
          placeholder="Six-digit code" autoComplete="off" value={pairingCode}
          onChange={(event) => onPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))}/>
      </label>
      <div className="settings-note">Control response is fixed and linear. Hold the phone in landscape, enable motion and select Recenter. The aircraft's flight model determines how it responds.</div>
      <button type="button" className="mobile-arm-button pairing-close" onClick={onClose}>DONE</button>
    </section>
  </div>;
}
