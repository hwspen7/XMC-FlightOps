import { useEffect, useState } from 'react';
import { MobileCockpit } from './views/MobileCockpit';
import { DesktopMonitor } from './views/DesktopMonitor';
import { useFlightController } from './hooks/useFlightController';
import { useViewMode } from './hooks/useViewMode';
import { OperationsSuite } from './components/monitor/OperationsSuite';
import { ProfessionalDashboard } from './components/monitor/ProfessionalDashboard';
import './styles/systems-health.css';
import './styles/monitor-layout-refinement.css';
import './styles/professional-dashboard.css';

type Workspace = 'overview' | 'expert' | 'detail';

function DesktopWorkspace({ flight, onMobile }: { flight: ReturnType<typeof useFlightController>; onMobile: () => void }) {
  const [page, setPage] = useState<Workspace>('overview');
  const { serverStatus, connected } = flight.socket;
  return <div className="xpd-workspace">
    <nav className="xpd-workspace-nav" aria-label="Desktop flight monitoring sections">
      <div className="xpd-workspace-brand">✈ XPLANE MOTION CONTROLLER</div>
      {([['overview', '01 · LIVE OVERVIEW'], ['expert', '02 · SYSTEMS / ANALYTICS / REPLAY'], ['detail', '03 · ALL TELEMETRY']] as const).map(([id, label]) =>
        <button type="button" key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>{label}</button>
      )}
      <span className={connected && serverStatus.simulator.telemetryFresh ? 'xpd-live' : 'xpd-not-live'}>{connected && serverStatus.simulator.telemetryFresh ? '● LIVE SIMULATOR FEED' : '○ DATA UNAVAILABLE'}</span>
    </nav>
    {/* Keep the overview recorder and expert workspace mounted across tab changes. */}
    <div hidden={page !== 'overview'} className="xpd-workspace-page"><ProfessionalDashboard status={serverStatus} connected={connected} onMobile={onMobile}/></div>
    <div hidden={page !== 'expert'} className="xpd-workspace-page"><OperationsSuite status={serverStatus} connected={connected}/></div>
    {page === 'detail' && <div className="xpd-workspace-page"><DesktopMonitor status={serverStatus} connected={connected} onMobile={onMobile}/></div>}
  </div>;
}

export function App() {
  const { mode, changeMode } = useViewMode();
  const flight = useFlightController();

  useEffect(() => {
    if (mode === 'desktop') flight.disarm();
  }, [mode, flight.disarm]);

  return mode === 'mobile'
    ? <MobileCockpit flight={flight} onDesktop={() => { flight.disarm(); changeMode('desktop'); }} />
    : <DesktopWorkspace flight={flight} onMobile={() => changeMode('mobile')}/>;
}
