/** Unified mobile and desktop attitude horizon pitch scale. */
export const PFD_PITCH_PIXELS_PER_DEGREE = 3.6;
/** Unified pitch ladder geometry, shared by mobile, compact and desktop instruments. */
export const PITCH_TICKS = Array.from({ length: 49 }, (_, index) => (index - 24) * 2.5)
  .filter(value => value !== 0);

export interface PitchMark {
  halfWidth: number;
  label: boolean;
  strokeWidth: number;
  kind: 'major' | 'medium' | 'minor';
}

/** Major: every 10 degrees; medium: 5; minor: 2.5. Bars are continuous. */
export function pitchMark(degrees: number): PitchMark {
  const absolute = Math.abs(degrees);
  if (!Number.isFinite(degrees) || absolute < 2.5 || Math.abs(absolute / 2.5 - Math.round(absolute / 2.5)) > 1e-7)
    throw new RangeError('Pitch marks require non-zero 2.5 degree multiples');
  if (Math.round(absolute * 10) % 100 === 0)
    return { halfWidth: 53, label: true, strokeWidth: 2.1, kind: 'major' };
  if (Math.round(absolute * 10) % 50 === 0)
    return { halfWidth: 35, label: false, strokeWidth: 1.65, kind: 'medium' };
  return { halfWidth: 19, label: false, strokeWidth: 1.25, kind: 'minor' };
}

/** X-Plane AGL is not barometric MSL or a terrain model. */
export function radioAltitudeFeet(aglFeet: number | null | undefined, live: boolean): number | null {
  if (!live || typeof aglFeet !== 'number' || !Number.isFinite(aglFeet) ||
      aglFeet < -10 || aglFeet > 2500) return null;
  return Math.round(Math.max(0, aglFeet));
}
