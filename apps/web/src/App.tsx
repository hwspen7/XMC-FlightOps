import { useEffect } from 'react';
import { MobileCockpit } from './views/MobileCockpit';
import { DesktopMonitor } from './views/DesktopMonitor';
import { useFlightController } from './hooks/useFlightController';
import { useViewMode } from './hooks/useViewMode';
import { SystemsHealth } from './components/monitor/SystemsHealth';
import './styles/systems-health.css';

export function App() {
  const { mode, changeMode } = useViewMode();
  const flight = useFlightController();

  useEffect(() => {
    if (mode === 'desktop') flight.disarm();
  }, [mode, flight.disarm]);

  return mode === 'mobile'
    ? <MobileCockpit flight={flight} onDesktop={() => { flight.disarm(); changeMode('desktop'); }} />
    : <div className="desktop-monitor-composite"><DesktopMonitor status={flight.socket.serverStatus} connected={flight.socket.connected} onMobile={() => changeMode('mobile')} /><section className="systems-health-extension"><SystemsHealth status={flight.socket.serverStatus} connected={flight.socket.connected} /></section></div>;
}
