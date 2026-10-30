import { PITCH_TICKS, pitchMark } from '../../telemetry/instrumentScale';

export interface PitchLadderProps {
  centerX?: number;
  centerY?: number;
  pixelsPerDegree: number;
  scale?: number;
  maxAbsDegrees?: number;
}

/**
 * Shared, level-by-level pitch ladder for mobile and desktop simulators.
 * The horizontal bars rotate together with the underlying aircraft horizon.
 * No negative-pitch arrow / chevron ornamentation is drawn.
 */
export function PitchLadder({
  centerX = 0,
  centerY = 0,
  pixelsPerDegree,
  scale = 1,
  maxAbsDegrees = 40,
}: PitchLadderProps) {
  const gap = 12 * scale;
  return <g aria-label="Aircraft pitch reference ladder">
    {PITCH_TICKS.filter(degree => Math.abs(degree) <= maxAbsDegrees).map(degree => {
      const mark = pitchMark(degree);
      const half = mark.halfWidth * scale;
      const y = centerY - degree * pixelsPerDegree;
      const labeled = mark.kind === 'major';
      return <g key={degree} stroke="#eef7ff" fill="#eef7ff">
        <path
          d={`M${centerX - half} ${y}H${centerX - gap} M${centerX + gap} ${y}H${centerX + half}`}
          fill="none"
          strokeWidth={mark.strokeWidth * scale}
          strokeLinecap="square"
        />
        {labeled && <>
          <text x={centerX - half - 12 * scale} y={y + 4 * scale}
            stroke="none" fontSize={12 * scale} fontWeight="700" textAnchor="end">
            {Math.abs(degree)}
          </text>
          <text x={centerX + half + 12 * scale} y={y + 4 * scale}
            stroke="none" fontSize={12 * scale} fontWeight="700" textAnchor="start">
            {Math.abs(degree)}
          </text>
        </>}
      </g>;
    })}
  </g>;
}
