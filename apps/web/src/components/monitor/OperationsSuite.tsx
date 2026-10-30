import { useState } from 'react';
import type { ServerStatus } from '@xplane/shared';
import { DesktopMonitor } from '../../views/DesktopMonitor';
import { SystemsHealth } from './SystemsHealth';
import { FlightAnalytics } from './FlightAnalytics';
import { SystemTopology } from './SystemTopology';
import { FlightRecorder } from './FlightRecorder';
import '../../styles/operations-suite.css';
import '../../styles/operations-merged.css';
import '../../styles/operations-density.css';

type Page = 'systems' | 'analysis' | 'debrief' | 'telemetry';

interface Props {
  status: ServerStatus;
  connected: boolean;
  onMobile: () => void;
}

/** Retain recording and analysis history while switching between operations tabs. */
export function OperationsSuite({ status, connected, onMobile }: Props) {
  const [page, setPage] = useState<Page>('systems');
  const [compact, setCompact] = useState(true);
  return <div className={`xmc-operations-suite xmc-operations-merged ${compact ? 'xmc-ops-compact' : 'xmc-ops-comfortable'}`}>
    <nav className="xmc-operations-nav" aria-label="Flight operations workspace">
      {([
        ['systems', '01 · AIRCRAFT SYSTEMS'],
        ['analysis', '02 · FLIGHT ANALYTICS'],
        ['debrief', '03 · RECORDER & DEBRIEF'],
        ['telemetry', '04 · RAW TELEMETRY'],
      ] as const).map(([id, title]) =>
        <button type="button" key={id} className={page === id ? 'active' : ''}
          onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}>{title}</button>
      )}
      <button type="button" className="xmc-ops-density-control" aria-label={compact ? 'Switch to comfortable layout' : 'Switch to compact layout'}
        aria-pressed={compact} onClick={() => setCompact(value => !value)}>
        {compact ? '▦ COMPACT' : '▤ COMFORTABLE'}
      </button>
      <span>READ-ONLY MONITORING · SIMULATOR DATA</span>
    </nav>

    <div hidden={page !== 'systems'} className="xmc-suite-page">
      <SystemsHealth status={status} connected={connected}/>
      <SystemTopology status={status} connected={connected}/>
    </div>
    <div hidden={page !== 'analysis'} className="xmc-suite-page">
      <FlightAnalytics status={status} connected={connected}/>
    </div>
    <div hidden={page !== 'debrief'} className="xmc-suite-page">
      <FlightRecorder status={status} connected={connected}/>
    </div>
    {page === 'telemetry' && <div className="xmc-suite-page xmc-suite-telemetry" aria-label="All telemetry and engineering diagnostics">
      <div className="xmc-suite-telemetry-heading">
        <div><strong>RAW TELEMETRY / ENGINEERING DIAGNOSTICS</strong><span>Full former telemetry workspace · observed X-Plane channels only</span></div>
        <span>{connected && status.simulator.telemetryFresh ? 'LIVE TELEMETRY' : 'TELEMETRY UNAVAILABLE'}</span>
      </div>
      <DesktopMonitor status={status} connected={connected} onMobile={onMobile}/>
    </div>}
  </div>;
}
