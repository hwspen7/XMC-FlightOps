import { MobileCockpit } from './views/MobileCockpit';
import { DesktopMonitor } from './views/DesktopMonitor';
import { useFlightController } from './hooks/useFlightController';
import { useViewMode } from './hooks/useViewMode';

export function App() {
  const { mode, changeMode } = useViewMode();
  const flight = useFlightController();

  return mode === 'mobile'
    ? <MobileCockpit flight={flight} onDesktop={() => changeMode('desktop')} />
    : <DesktopMonitor status={flight.socket.serverStatus} connected={flight.socket.connected} onMobile={() => changeMode('mobile')} />;
}
