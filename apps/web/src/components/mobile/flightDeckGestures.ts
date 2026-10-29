import type { AuxiliaryAction } from '@xplane/shared';

/** Touch displacement, in CSS pixels. Used only after a deliberate brake press. */
export function brakeLevelForDisplacement(startY: number, pointerY: number): 0.5 | 1 {
  return startY - pointerY > 34 ? 1 : 0.5;
}

/** Return a bounded, allowlisted cockpit view step. Camera movement is independent of aircraft control. */
export function viewStepForDisplacement(dx: number, dy: number): AuxiliaryAction | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.max(Math.abs(dx), Math.abs(dy)) < 14) return null;
  return Math.abs(dx) >= Math.abs(dy) ? dx > 0 ? 'view-right' : 'view-left' : dy > 0 ? 'view-down' : 'view-up';
}
