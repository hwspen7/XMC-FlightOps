import { MonitorUp } from 'lucide-react';
import type { FlightTelemetry } from '@xplane/shared';
import { B787PrimaryFlightDisplay } from '../mobile/B787PrimaryFlightDisplay';

interface Props {
  telemetry: FlightTelemetry;
  live: boolean;
}

/** Reuse the same flight instrument as mobile and the live overview. */
export function FlightDisplay({ telemetry, live }: Props) {
  return <section className="surface flight-display xmc-unified-flight-display" aria-label="X-Plane primary flight display">
    <div className="section-topline">
      <span className="eyebrow"><MonitorUp size={15}/> PRIMARY FLIGHT DISPLAY</span>
      <span className={`display-tag ${live ? 'display-tag-live' : ''}`}>{live ? 'LIVE SIM DATA' : 'SIM DATA OFFLINE'}</span>
    </div>
    <div className="pfd-housing xmc-unified-pfd-housing">
      <B787PrimaryFlightDisplay telemetry={telemetry} live={live}/>
    </div>
    <div className="pfd-bottomline"><span>FLIGHT DATA FROM X-PLANE ONLY</span><span>787-INSPIRED DISPLAY · NOT CERTIFIED</span></div>
  </section>;
}
