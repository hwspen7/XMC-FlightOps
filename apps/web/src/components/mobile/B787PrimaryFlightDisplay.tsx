/* XMC_CONTROL_INSTRUMENT_RELIABILITY_20261029 */
import { useId } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import { horizonTransform, liveAircraftAttitude } from '../../telemetry/attitude';
import { PFD_PITCH_PIXELS_PER_DEGREE, radioAltitudeFeet } from '../../telemetry/instrumentScale';
import { displayAttitude } from '../../telemetry/attitudePresentation';
import { PitchLadder } from '../monitor/PitchLadder';

interface Props { telemetry: FlightTelemetry; live: boolean; }

function fmt(value: number | null, live: boolean, digits = 0): string {
  return live && value !== null && Number.isFinite(value) ? value.toFixed(digits) : '---';
}

function tapeMarks(value: number | null, live: boolean, interval: number, centerY: number, pxPerUnit: number, minTick = Number.NEGATIVE_INFINITY) {
  if (!live || value === null || !Number.isFinite(value)) return [];
  const base = Math.round(value / interval) * interval;
  return Array.from({ length: 27 }, (_, i) => {
    const tick = base + (i - 13) * interval;
    return { tick, y: centerY - (tick - value) * pxPerUnit };
  }).filter(item => item.y >= 55 && item.y <= 309 && item.tick >= minTick);
}

/** Rectangular Boeing-style PFD. Every displayed flight measurement originates in X-Plane. */
export function B787PrimaryFlightDisplay({ telemetry, live }: Props) {
  const id = useId().replace(/:/g, '');
  const attitude = liveAircraftAttitude(telemetry, live);
  const ias = live ? telemetry.indicatedAirspeedKnots : null;
  const alt = live ? telemetry.altitudeFeet : null;
  const selectedAltitude = live ? telemetry.selectedAltitudeFeet : null;
  const speedBands = live ? {
    vso: telemetry.speedVsoKnots, vs: telemetry.speedVsKnots,
    vfe: telemetry.speedVfeKnots, vno: telemetry.speedVnoKnots,
    vne: telemetry.speedVneKnots,
  } : null;
  // These are Plane Maker reference speeds, not a dynamic Boeing FMC envelope.
  const speedToY = (speed: number) => 181 - (speed - (ias ?? 0)) * 2;
  const speedBand = (low: number | null, high: number | null, color: string, x: number, width: number) => {
    if (ias === null || low === null || high === null || !Number.isFinite(low) || !Number.isFinite(high) ||
        high <= low || low < 0 || high > 1500) return null;
    const yTop = Math.max(43, Math.min(307, speedToY(high)));
    const yBottom = Math.max(43, Math.min(307, speedToY(low)));
    return yBottom > yTop ? <rect x={x} y={yTop} width={width} height={yBottom-yTop} fill={color}/> : null;
  };
  const selectedY = alt !== null && selectedAltitude !== null && Number.isFinite(selectedAltitude) &&
    selectedAltitude >= -1500 && selectedAltitude <= 65000
    ? 181 - (selectedAltitude - alt) * .19 : null;
  const vsi = live ? telemetry.verticalSpeedFpm : null;
  const heading = live ? telemetry.magneticHeadingDegrees ?? telemetry.headingDegrees : null;
  const attitudeForDisplay = displayAttitude(attitude, telemetry.onGround, telemetry.groundSpeedKnots);
  const transform = attitudeForDisplay ? horizonTransform(attitudeForDisplay, 272, 176, PFD_PITCH_PIXELS_PER_DEGREE) : '';
  const headingNormalized = heading !== null && live && Number.isFinite(heading)
    ? ((heading % 360) + 360) % 360 : null;
  const compassTicks = headingNormalized === null ? [] : Array.from({ length: 13 }, (_, i) => {
    const angle = Math.round(headingNormalized / 10) * 10 + (i - 6) * 10;
    return { angle: ((angle % 360) + 360) % 360, x: 272 + (angle - headingNormalized) * 2.25, major: angle % 30 === 0 };
  });
  return <section className="xmc-pfd" aria-label="X-Plane primary flight display">
    <svg viewBox="0 0 640 365" preserveAspectRatio="xMidYMid meet" role="img" aria-label={attitude ? 'Live X-Plane attitude, airspeed, altitude and heading' : 'Waiting for real X-Plane aircraft telemetry'}>
      <defs>
        <clipPath id={`${id}-attitude`}><rect x="101" y="29" width="342" height="290" /></clipPath>
        <clipPath id={`${id}-speed`}><rect x="4" y="43" width="92" height="264"/></clipPath>
        <clipPath id={`${id}-alt`}><rect x="448" y="43" width="96" height="264"/></clipPath>
      </defs>
      <rect x=".5" y=".5" width="639" height="364" fill="#050f1b" stroke="#36536d"/>
      <rect x="0" y="0" width="640" height="28" fill="#0a1d31"/>
      <path d="M0 28H640 M99 28V319 M445 28V319 M546 28V319 M0 320H640" stroke="#3c617e" strokeWidth="1.5"/>
      <g fill="#78c9fa" fontSize="13" fontWeight="750" letterSpacing="1"><text x="13" y="19">IAS / KT</text><text x="458" y="19">ALT / FT</text><text x="557" y="19">V/S</text></g>
      {selectedY !== null && <text x="541" y="38" textAnchor="end" fill="#71e4ff" fontSize="8" fontWeight="800">SEL {Math.round(selectedAltitude!)}</text>}
      <g clipPath={`url(#${id}-attitude)`}>
        {attitude && <g transform={transform}>
          <rect x="-900" y="-900" width="1800" height="900" fill="#137ebf"/>
          <rect x="-900" y="0" width="1800" height="900" fill="#91643e"/>
          <path d="M-900 0H900" stroke="#f9f5e8" strokeWidth="2.4"/>
          <PitchLadder pixelsPerDegree={PFD_PITCH_PIXELS_PER_DEGREE} maxAbsDegrees={40}/>
        </g>}
      </g>
      {attitude && <g aria-label="Bank reference ticks" stroke="#f0f7ff" strokeWidth="1.4">
        {[-30,-20,-10,0,10,20,30].map(value => <path key={value}
          d={`M${272+value*2.5} 32v${value % 30 === 0 ? 9 : 5}`} />)}
      </g>}
      {attitude && <g stroke="#ffe273" fill="none" strokeWidth="3.6">
        <path d="M169 176h59l12 11h64l12-11h59" strokeLinecap="round"/>
        <circle cx="272" cy="176" r="3.5" fill="#ffe273" stroke="none"/>
      </g>}
      {!attitude && <g aria-label="Attitude information unavailable"><rect x="231" y="154" width="82" height="30" rx="3" fill="#141b24" stroke="#edb464" strokeWidth="1.4"/><text x="272" y="174" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffcf83">ATT DATA</text></g>}
      <rect x="4" y="43" width="92" height="264" fill="#172a3c" stroke="#446077"/>
      <g clipPath={`url(#${id}-speed)`}>
        {speedBands && speedBand(speedBands.vs, speedBands.vno, '#39c48a', 8, 5)}
        {speedBands && speedBand(speedBands.vno, speedBands.vne, '#f1bb5c', 8, 5)}
        {speedBands && speedBands.vso !== null && speedBand(0, speedBands.vso, '#ef6675', 8, 5)}
        {speedBands && speedBands.vs !== null && speedBand(0, speedBands.vs, '#ef6675', 8, 5)}
        {speedBands && speedBands.vne !== null && speedBands.vne > 0 && speedBand(speedBands.vne, 1000, '#ec475f', 8, 5)}
        {speedBands && speedBand(speedBands.vso, speedBands.vfe, '#e9f5fa', 16, 3)}
        {tapeMarks(ias, live, 10, 181, 2, 0).map(({tick,y}) => <g key={tick} fill="#e5f4ff" fontSize="15">
          <path d={`M${tick%20===0?79:87} ${y}H95`} stroke="#9cbad0" strokeWidth="1.1"/>
          {tick%20===0 && <text x="67" y={y+5} textAnchor="end">{tick}</text>}
        </g>)}
      </g>
      <path d="M4 162H83L96 181L83 200H4Z" fill="#02080e" stroke="#fff" strokeWidth="2"/>
      <text x="48" y="190" textAnchor="middle" fontSize="25" fill="white" fontWeight="800">{fmt(ias, live)}</text>
      <rect x="448" y="43" width="96" height="264" fill="#172a3c" stroke="#446077"/>
      <g clipPath={`url(#${id}-alt)`}>{tapeMarks(alt,live,100,181,.19).map(({tick,y}) => <g key={tick} fill="#e5f4ff" fontSize="14">
        <path d={`M448 ${y}h${tick%200===0?20:11}`} stroke="#9cbad0" strokeWidth="1.1"/>
        {tick%200===0 && <text x="477" y={y+5}>{tick}</text>}
      </g>)}</g>
      <path d="M543 162H463L448 181L463 200H543Z" fill="#02080e" stroke="#fff" strokeWidth="2"/>
      <text x="502" y="190" textAnchor="middle" fontSize="24" fill="#fff" fontWeight="800">{fmt(alt,live)}</text>
      <rect x="548" y="43" width="88" height="264" fill="#0a1928" stroke="#446077"/>
      {[-2000,-1000,0,1000,2000].map(n=><g key={n}><path d={`M548 ${181-n/18}h14`} stroke="#86a9bf"/>
        <text x="571" y={185-n/18} fill="#d6e8f9" fontSize="11">{n===0?'0':n>0?`+${n}`:n}</text></g>)}
      {vsi !== null && Number.isFinite(vsi) && <path d={`M548 ${181-Math.max(-2200,Math.min(2200,vsi))/18}h21`} stroke="#4ceaad" strokeWidth="3"/>}
      <rect x="547" y="163" width="89" height="36" fill="#02080e" stroke="#edf8ff"/>
      <text x="591" y="187" textAnchor="middle" fontSize="19" fill="#fff" fontWeight="750">{fmt(vsi,live)}</text>
      {/* XMC top heading band v4: compass and digital heading in the upper instrument strip. */}
      <rect x="0" y="320" width="640" height="45" fill="#071723"/>
      <rect x="0" y="320" width="99" height="45" fill="#092032"/>
      <text x="9" y="334" fill="#70cef7" fontSize="10">GS / KT</text>
      <text x="10" y="357" fill="#e6faff" fontSize="17" fontWeight="750">{fmt(telemetry.groundSpeedKnots,live)}</text>
      <rect x="99" y="320" width="86" height="45" fill="#0c2739"/>
      <path d="M99 321V364M185 321V364" stroke="#385c74"/>
      <text x="109" y="334" fill="#70cef7" fontSize="10">AGL / FT</text>
      <text x="110" y="357" fill="#f4efd0" fontSize="17" fontWeight="750">
        {radioAltitudeFeet(telemetry.aglFeet,live) === null ? '---' : radioAltitudeFeet(telemetry.aglFeet,live)}
      </text>
      <rect x="185" y="320" width="455" height="45" fill="#092032"/>
      <path d="M310 321V364M449 321V364" stroke="#294b62"/>
      <text x="204" y="334" fill="#70cef7" fontSize="10">BANK / DEG</text>
      <text x="205" y="356" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(attitude?.roll ?? null,Boolean(attitude),1)}°</text>
      <text x="327" y="334" fill="#70cef7" fontSize="10">PITCH / DEG</text>
      <text x="328" y="356" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(attitude?.pitch ?? null,Boolean(attitude),1)}°</text>
      <text x="471" y="334" fill="#70cef7" fontSize="10">MACH</text>
      <text x="472" y="356" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(telemetry.machNumber,live,2)}</text>
      {/* Heading tape drawn last so the pitch horizon cannot overlay its top-row labels. */}
      <g aria-label="Magnetic heading scale above the attitude display">
        <rect x="101" y="0" width="344" height="52" fill="#081b2c" stroke="#355772" strokeWidth="1"/>
        <line x1="105" y1="33" x2="441" y2="33" stroke="#345972" strokeWidth="1"/>
        {compassTicks.map(({angle,x,major}) => x > 109 && x < 438 && <g key={angle}>
          <path d={`M${x} 5v${major ? 12 : 6}`} stroke="#97d6f2" strokeWidth={major ? 1.5 : 1}/>
          {major && <text x={x} y="29" textAnchor="middle" fill="#c6e9fa" fontSize="11" fontWeight="700">
            {angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : angle === 270 ? 'W' : String(angle/10).padStart(2,'0')}
          </text>}
        </g>)}
        <path d="M272 30v5" stroke="#f4dc76" strokeWidth="2"/>
        <rect x="231" y="35" rx="3" width="82" height="16" fill="#041220" stroke="#6b93ab"/>
        <text x="272" y="48" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
          {headingNormalized === null ? '---' : Math.round(headingNormalized).toString().padStart(3,'0')}°
        </text>
      </g>
    </svg>
  </section>;
}
