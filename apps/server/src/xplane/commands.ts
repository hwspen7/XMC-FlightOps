import type { AuxiliaryAction } from '@xplane/shared';

export const COMMAND_PATHS: Record<AuxiliaryAction, string> = {
  'trim-up': 'sim/flight_controls/pitch_trim_up',
  'trim-down': 'sim/flight_controls/pitch_trim_down',
  'flaps-up': 'sim/flight_controls/flaps_up',
  'flaps-down': 'sim/flight_controls/flaps_down',
  'gear-toggle': 'sim/flight_controls/landing_gear_toggle',
  'spoilers-toggle': 'sim/flight_controls/speed_brakes_toggle',
};

export function isAuxiliaryAction(value: unknown): value is AuxiliaryAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COMMAND_PATHS, value);
}

export function encodeCommand(path: string): Buffer {
  if (!/^sim\/[a-zA-Z0-9_/-]+$/.test(path)) throw new Error('Invalid simulator command');
  return Buffer.concat([Buffer.from('CMND\0', 'ascii'), Buffer.from(path + '\0', 'ascii')]);
}
