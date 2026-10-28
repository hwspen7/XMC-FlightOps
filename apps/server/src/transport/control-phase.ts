import type { ControlPhase, SimulatorStatus } from '@xplane/shared';

/** A paired controller is not necessarily authorized by the simulator. */
export function controlPhase(armed: boolean, simulator: SimulatorStatus): ControlPhase {
  if (!armed) return 'idle';
  if (!simulator.outputEnabled) return 'preview';
  if (simulator.transport !== 'native') return 'unverified';
  return simulator.reachable && simulator.nativeArmed === true ? 'active' : 'pending';
}
