import { MonitorUp } from 'lucide-react';
import { useId } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import { displayValue, normalizedHeading } from '../../telemetry/format';

interface Props {
  telemetry: FlightTelemetry;
  live: boolean;
}

const PITCH_MARKS = [-60, -50, -40, -30, -20, -10, 10, 20, 30, 40, 50, 60];

export function FlightDisplay({ telemetry, live }: Props) {
  const id = useId().replace(/:/g, '');
  const attitudeLive = live && telemetry.rollDegrees !== null && telemetry.pitchDegrees !== null;
  const roll = attitudeLive ? telemetry.rollDegrees! : 0;
  const pitch = attitudeLive ? telemetry.pitchDegrees! : 0;
  const attitudeTransform = `translate(380 182) rotate(${-roll}) translate(0 ${pitch * 3.6})`;

  return (
    <section className="surface flight-display" aria-label="X-Plane primary flight display">
      <div className="section-topline">
        <span className="eyebrow"><MonitorUp size={15} /> PRIMARY FLIGHT DISPLAY</span>
        <span className={`display-tag ${live ? 'display-tag-live' : ''}`}>{live ? 'LIVE SIM DATA' : 'SIM DATA OFFLINE'}</span>
      </div>
      <div className="pfd-housing">
        <svg className="pfd-svg" viewBox="0 0 760 410" role="img" aria-label={live ? 'X-Plane aircraft attitude, airspeed, altitude and heading' : 'Flight display awaiting X-Plane telemetry'}>
          <defs>
            <clipPath id={`${id}-attitude`}><rect x="148" y="48" width="464" height="265" rx="2" /></clipPath>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a407b" /><stop offset="1" stopColor="#1b92d9" /></linearGradient>
            <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ad743d" /><stop offset="1" stopColor="#6c3e22" /></linearGradient>
          </defs>
          <rect width="760" height="410" fill="#080c13" />
          <rect x="148" y="48" width="464" height="265" fill="#145483" />
          <g clipPath={`url(#${id}-attitude)`}>
            <g transform={attitudeTransform}>
              <rect x="-1050" y="-1400" width="2100" height="1400" fill={`url(#${id}-sky)`} />
              <rect x="-1050" y="0" width="2100" height="1400" fill={`url(#${id}-ground)`} />
              <path d="M-1050 0 H1050" stroke="#f5ead9" strokeWidth="2.2" />
              {PITCH_MARKS.map((degree) => {
                const y = degree * -3.6;
                const length = Math.abs(degree) % 20 === 0 ? 68 : 41;
                return (
                  <g key={degree} transform={`translate(0 ${y})`} stroke="#fff" fill="#fff">
                    <path d={`M${-length} 0 H${-18} M18 0 H${length}`} strokeWidth="1.5" />
                    <text x={-length - 11} y="4" textAnchor="end" fontSize="12" stroke="none">{Math.abs(degree)}</text>
                    <text x={length + 11} y="4" textAnchor="start" fontSize="12" stroke="none">{Math.abs(degree)}</text>
                  </g>
                );
              })}
            </g>
          </g>
          <g fill="none" stroke="#f0f4fa" strokeWidth="2.1" strokeLinejoin="round">
            <path d="M274 180 H332 L346 192 H414 L428 180 H486" />
            <path d="M363 191 H397" stroke="#1c1e22" strokeWidth="4" />
            <circle cx="380" cy="182" r="3" fill="#f0f4fa" />
            <path d="M380 49 V64 M370 62 L380 47 L390 62" />
          </g>
          <g fill="none" stroke="#e8f2fa" strokeWidth="1.6" opacity="0.85">
            <path d="M274 92 Q380 23 486 92" />
            <path d="M293 79 L299 89 M333 57 L336 71 M427 57 L424 71 M467 79 L461 89" />
          </g>
          <rect x="24" y="48" width="116" height="265" fill="#283443" stroke="#728191" strokeWidth="1" />
          <rect x="620" y="48" width="116" height="265" fill="#283443" stroke="#728191" strokeWidth="1" />
          {[-2, -1, 0, 1, 2].map((tick) => (
            <g key={`speed-${tick}`} fill="#bac9d9" fontSize="15" textAnchor="end">
              <path d={`M126 ${180 + tick * 45} H140`} stroke="#cad4df" strokeWidth="1.3" />
              {live && telemetry.indicatedAirspeedKnots !== null && <text x="119" y={186 + tick * 45}>{Math.max(0, Math.round(telemetry.indicatedAirspeedKnots - tick * 20))}</text>}
            </g>
          ))}
          {[-2, -1, 0, 1, 2].map((tick) => (
            <g key={`alt-${tick}`} fill="#bac9d9" fontSize="15" textAnchor="start">
              <path d={`M620 ${180 + tick * 45} H634`} stroke="#cad4df" strokeWidth="1.3" />
              {live && telemetry.altitudeFeet !== null && <text x="643" y={186 + tick * 45}>{Math.round((telemetry.altitudeFeet - tick * 200) / 100) * 100}</text>}
            </g>
          ))}
          <path d="M24 160 H126 L140 182 L126 204 H24 Z" fill="#060b10" stroke="#fff" strokeWidth="2" />
          <path d="M736 160 H634 L620 182 L634 204 H736 Z" fill="#060b10" stroke="#fff" strokeWidth="2" />
          <text x="78" y="190" textAnchor="middle" fill="#fff" fontSize="27" fontWeight="600">{live ? displayValue(telemetry.indicatedAirspeedKnots) : '---'}</text>
          <text x="685" y="190" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="600">{live ? displayValue(telemetry.altitudeFeet) : '---'}</text>
          <text x="27" y="37" fill="#86b5ef" fontSize="13" fontWeight="700" letterSpacing="2">IAS / KT</text>
          <text x="622" y="37" fill="#86b5ef" fontSize="13" fontWeight="700" letterSpacing="2">ALT / FT</text>
          <g fill="#e7eff7" fontFamily="monospace">
            <text x="380" y="30" textAnchor="middle" fill="#89b9e9" fontSize="13" letterSpacing="2">AIRCRAFT ATTITUDE</text>
            <text x="740" y="336" textAnchor="end" fill="#90a9c3" fontSize="12">V/S FPM</text>
            <text x="735" y="357" textAnchor="end" fontSize="19">{live ? displayValue(telemetry.verticalSpeedFpm) : '---'}</text>
          </g>
          <rect x="265" y="330" width="230" height="64" rx="2" fill="#101824" stroke="#3b5066" />
          <path d="M380 333 V350 M374 347 L380 355 L386 347" stroke="#e6f0fa" fill="none" strokeWidth="2" />
          <text x="380" y="382" textAnchor="middle" fill="#f0f5fc" fontFamily="monospace" fontSize="26" fontWeight="600">{live ? normalizedHeading(telemetry.headingDegrees) : '---'}°</text>
          <text x="280" y="375" fill="#8ca5be" fontFamily="monospace" fontSize="12">HDG</text>
          <text x="496" y="375" fill="#8ca5be" fontFamily="monospace" fontSize="11">TRUE</text>
          {!attitudeLive && (
            <g>
              <rect x="185" y="113" width="390" height="106" rx="4" fill="#0a121f" fillOpacity="0.84" stroke="#48617a" />
              <text x="380" y="154" fill="#f1c080" fontSize="18" fontWeight="700" textAnchor="middle" letterSpacing="2">{live ? 'NO ATTITUDE DATA' : 'NO FLIGHT DATA'}</text>
              <text x="380" y="180" fill="#bfd0df" fontSize="13" textAnchor="middle">{live ? 'Aircraft attitude dataref is unavailable' : 'Waiting for X-Plane UDP telemetry'}</text>
              <text x="380" y="202" fill="#879db3" fontSize="12" textAnchor="middle">Attitude and flight values are not simulated</text>
            </g>
          )}
        </svg>
      </div>
      <div className="pfd-bottomline"><span>FLIGHT DATA FROM X-PLANE ONLY</span><span>787-INSPIRED DISPLAY · NOT CERTIFIED</span></div>
    </section>
  );
}
