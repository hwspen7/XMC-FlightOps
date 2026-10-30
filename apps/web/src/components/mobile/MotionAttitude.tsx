/* XMC_CONTROL_INSTRUMENT_RELIABILITY_20261029 */
import { useId } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import { horizonTransform, liveAircraftAttitude } from '../../telemetry/attitude';
import { radioAltitudeFeet } from '../../telemetry/instrumentScale';
import { PitchLadder } from '../monitor/PitchLadder';

interface Props { telemetry: FlightTelemetry; live: boolean; }

export function MotionAttitude({ telemetry, live }: Props) {
  const prefix = useId().replace(/:/g, '');
  const attitude = liveAircraftAttitude(telemetry, live);
  const attitudeTransform = attitude ? horizonTransform(attitude, 180, 172, 3.6) : '';
  const attitudeText = attitude
    ? `ROLL ${attitude.roll.toFixed(1)}°  /  PITCH ${attitude.pitch.toFixed(1)}°`
    : 'NO AIRCRAFT DATA';
  return (
    <div className="motion-attitude">
      <svg viewBox="0 0 360 340" role="img" aria-label={attitude ? 'Live X-Plane aircraft attitude' : 'Aircraft attitude telemetry unavailable'}>
        <defs>
          <clipPath id={`${prefix}-circle`}><circle cx="180" cy="172" r="144" /></clipPath>
          <linearGradient id={`${prefix}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#127ac4"/><stop offset="1" stopColor="#4fa7e2"/></linearGradient>
          <linearGradient id={`${prefix}-earth`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a46c40"/><stop offset="1" stopColor="#593b2a"/></linearGradient>
        </defs>
        <circle cx="180" cy="172" r="151" fill="#0e1c29" stroke="#2b475e" strokeWidth="2"/>
        <g clipPath={`url(#${prefix}-circle)`}>
          <g transform={attitudeTransform}>
            <rect x="-500" y="-700" width="1000" height="700" fill={`url(#${prefix}-sky)`}/>
            <rect x="-500" y="0" width="1000" height="700" fill={`url(#${prefix}-earth)`}/>
            <path d="M-500 0 H500" stroke="#f7fbff" strokeWidth="2.6"/>
            <PitchLadder pixelsPerDegree={3.6} maxAbsDegrees={40}/>
          </g>
          <circle cx="180" cy="172" r="144" fill="none" stroke="#94c4e9" strokeWidth="3" opacity=".55" />
          <path d="M106 172 H156 L165 184 H195 L204 172 H254" fill="none" stroke="#ffd345" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="180" cy="172" r="5" fill="#ffd345" />
          <path d="M180 30 V44 M111 50 L119 64 M249 50 L241 64 M47 172 H62 M298 172 H313" stroke="#dce9f3" strokeWidth="3" fill="none"/>
          {!attitude && <g><circle cx="180" cy="172" r="142" fill="#0b1e2e"/><g aria-label="Attitude information unavailable"><rect x="134" y="156" width="92" height="30" rx="3" fill="#141b24" stroke="#edb464" strokeWidth="1.4"/><text x="180" y="176" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffcf83">ATT DATA</text></g></g>}
        </g>
        {radioAltitudeFeet(telemetry.aglFeet, live) !== null && <g aria-label="X-Plane AGL in feet">
          <rect x="244" y="5" width="106" height="24" rx="4" fill="#081c2a" stroke="#7bc9dd"/>
          <text x="297" y="21" fill="#e0f8ff" textAnchor="middle" fontSize="12" fontWeight="800">AGL {radioAltitudeFeet(telemetry.aglFeet, live)} FT</text>
        </g>}
        <g transform="translate(180 10)"><path d="M0 0 L-12 22 H12Z" fill="#ffc943"/></g>
        <g className="horizon-data" fill="#fff">
          <text x="180" y="334" textAnchor="middle" fontSize="12" letterSpacing="3">{attitudeText}</text>
        </g>
      </svg>
      <span className="motion-caption">X-PLANE AIRCRAFT ATTITUDE · YOKE INPUT BELOW</span>
    </div>
  );
}
