/** Aircraft flap indication based on the simulator's aircraft code and configuration. */
export interface FlapDisplay {
  model: string;
  label: string;
  selectedIndex: number;
  labels: readonly string[];
  actualPercent: number | null;
  handlePercent: number;
  moving: boolean;
  previous: string | null;
  next: string | null;
  authoritativeLabels: boolean;
}

const AIRCRAFT_DETENTS: Readonly<Record<string, readonly string[]>> = {
  B737: ['UP', '1', '2', '5', '10', '15', '25', '30', '40'],
  B738: ['UP', '1', '2', '5', '10', '15', '25', '30', '40'],
  B739: ['UP', '1', '2', '5', '10', '15', '25', '30', '40'],
  B788: ['UP', '1', '5', '15', '17', '18', '20', '25', '30'],
  B789: ['UP', '1', '5', '15', '17', '18', '20', '25', '30'],
  B78X: ['UP', '1', '5', '15', '17', '18', '20', '25', '30'],
  C172: ['UP', '10', '20', '30'],
};

const boundedRatio = (ratio: number) => Math.min(1, Math.max(0, ratio));

export function buildFlapDisplay(
  aircraftIcao: string | null,
  configuredDetents: number | null,
  requestedRatio: number | null,
  actualRatio: number | null,
): FlapDisplay | null {
  if (requestedRatio === null || !Number.isFinite(requestedRatio)) return null;
  const icao = (aircraftIcao ?? '').toUpperCase();
  const known = AIRCRAFT_DETENTS[icao];
  const validCount = configuredDetents !== null && Number.isInteger(configuredDetents) && configuredDetents >= 1 && configuredDetents <= 10;
  // Some aircraft report the count including UP, others report the number of steps
  // beyond UP. Only give Boeing/Cessna-specific labels when counts agree.
  const trustedLabels = known && validCount && (configuredDetents === known.length || configuredDetents === known.length - 1) ? known : null;
  const positions = trustedLabels ? trustedLabels.length : validCount ? Math.min(11, configuredDetents! + 1) : 0;
  if (!positions) {
    return {
      model: icao || 'AIRCRAFT', label: `${Math.round(boundedRatio(requestedRatio) * 100)}%`, selectedIndex: 0,
      labels: [], actualPercent: actualRatio === null || !Number.isFinite(actualRatio) ? null : Math.round(boundedRatio(actualRatio) * 100),
      handlePercent: Math.round(boundedRatio(requestedRatio) * 100), moving: actualRatio !== null && Math.abs(actualRatio - requestedRatio) > 0.04,
      previous: null, next: null, authoritativeLabels: false,
    };
  }
  const labels: readonly string[] = trustedLabels ?? Array.from({ length: positions }, (_, i) => i === 0 ? 'UP' : `POS ${i}`);
  // The handle position is the requested detent; the flap surfaces move separately.
  const index = Math.max(0, Math.min(positions - 1, Math.round(boundedRatio(requestedRatio) * (positions - 1))));
  return {
    model: icao || 'AIRCRAFT', label: labels[index], selectedIndex: index, labels,
    actualPercent: actualRatio === null || !Number.isFinite(actualRatio) ? null : Math.round(boundedRatio(actualRatio) * 100),
    handlePercent: Math.round(boundedRatio(requestedRatio) * 100),
    moving: actualRatio !== null && Number.isFinite(actualRatio) && Math.abs(actualRatio - requestedRatio) > 0.04,
    previous: index > 0 ? labels[index - 1] : null,
    next: index + 1 < labels.length ? labels[index + 1] : null,
    authoritativeLabels: trustedLabels !== null,
  };
}
