import { useId } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import { horizonTransform, liveAircraftAttitude } from '../../telemetry/attitude';

interface Props { telemetry: FlightTelemetry; live: boolean; }

function fmt(value: number | null, live: boolean, digits = 0): string {
  return live && value !== null && Number.isFinite(value) ? value.toFixed(digits) : '---';
}

function tapeMarks(value: number | null, live: boolean, interval: number, centerY: number, pxPerUnit: number) {
  if (!live || value === null || !Number.isFinite(value)) return [];
  const base = Math.round(value / interval) * interval;
  return Array.from({ length: 11 }, (_, i) => {
    const tick = base + (i - 5) * interval;
    return { tick, y: centerY - (tick - value) * pxPerUnit };
  }).filter(item => item.y >= 55 && item.y <= 309 && item.tick >= 0);
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
  const transform = attitude ? horizonTransform(attitude, 272, 176, 4.0) : '';
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
          {[-40,-30,-20,-10,-5,-2.5,2.5,5,10,20,30,40].map(deg => {
            const major = Math.abs(deg) >= 10;
            const length = major ? 51 : Math.abs(deg) === 5 ? 31 : 18;
            return <g key={deg} transform={`translate(0 ${-deg * 4.0})`} stroke="#edf7ff" fill="#edf7ff" strokeWidth={major ? 1.9 : 1.3}>
              <path d={`M${-length} 0H-12 M12 0H${length}`}/>
              {major && <>
                <text stroke="none" fontSize="12" x="-67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
                <text stroke="none" fontSize="12" x="67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
              </>}
            </g>;
          })}
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
      {!attitude && <g><rect x="136" y="128" width="272" height="92" rx="3" fill="#061321" fillOpacity=".94" stroke="#537693"/>
        <text x="272" y="161" fill="#ffd592" fontWeight="800" fontSize="16" textAnchor="middle">NO FLIGHT DATA</text>
        <text x="272" y="186" fill="#93adc5" fontSize="12" textAnchor="middle">Waiting for X-Plane telemetry</text>
        <text x="272" y="205" fill="#627f98" fontSize="10" textAnchor="middle">Aircraft values are not simulated</text></g>}
      <rect x="4" y="43" width="92" height="264" fill="#172a3c" stroke="#446077"/>
      <g clipPath={`url(#${id}-speed)`}>
        {speedBands && speedBand(speedBands.vs, speedBands.vno, '#39c48a', 8, 5)}
        {speedBands && speedBand(speedBands.vno, speedBands.vne, '#f1bb5c', 8, 5)}
        {speedBands && speedBands.vso !== null && speedBand(0, speedBands.vso, '#ef6675', 8, 5)}
        {speedBands && speedBands.vs !== null && speedBand(0, speedBands.vs, '#ef6675', 8, 5)}
        {speedBands && speedBands.vne !== null && speedBands.vne > 0 && speedBand(speedBands.vne, 1000, '#ec475f', 8, 5)}
        {speedBands && speedBand(speedBands.vso, speedBands.vfe, '#e9f5fa', 16, 3)}
        {tapeMarks(ias, live, 20, 181, 2).map(({tick,y}) => <g key={tick} fill="#e5f4ff" fontSize="15">
          <path d={`M${tick%40===0?79:87} ${y}H95`} stroke="#9cbad0" strokeWidth="1.1"/>
          {tick%40===0 && <text x="67" y={y+5} textAnchor="end">{tick}</text>}
        </g>)}
      </g>
      <path d="M4 162H83L96 181L83 200H4Z" fill="#02080e" stroke="#fff" strokeWidth="2"/>
      <text x="48" y="190" textAnchor="middle" fontSize="25" fill="white" fontWeight="800">{fmt(ias, live)}</text>
      <rect x="448" y="43" width="96" height="264" fill="#172a3c" stroke="#446077"/>
      <g clipPath={`url(#${id}-alt)`}>{tapeMarks(alt,live,200,181,.19).map(({tick,y}) => <g key={tick} fill="#e5f4ff" fontSize="14">
        <path d={`M448 ${y}h${tick%400===0?20:11}`} stroke="#9cbad0" strokeWidth="1.1"/>
        {tick%400===0 && <text x="477" y={y+5}>{tick}</text>}
      </g>)}</g>
      <path d="M543 162H463L448 181L463 200H543Z" fill="#02080e" stroke="#fff" strokeWidth="2"/>
      <text x="502" y="190" textAnchor="middle" fontSize="24" fill="#fff" fontWeight="800">{fmt(alt,live)}</text>
      <rect x="548" y="43" width="88" height="264" fill="#0a1928" stroke="#446077"/>
      {[-2000,-1000,0,1000,2000].map(n=><g key={n}><path d={`M548 ${181-n/18}h14`} stroke="#86a9bf"/>
        <text x="571" y={185-n/18} fill="#d6e8f9" fontSize="11">{n===0?'0':n>0?`+${n}`:n}</text></g>)}
      {vsi !== null && Number.isFinite(vsi) && <path d={`M548 ${181-Math.max(-2200,Math.min(2200,vsi))/18}h21`} stroke="#4ceaad" strokeWidth="3"/>}
      <rect x="547" y="163" width="89" height="36" fill="#02080e" stroke="#edf8ff"/>
      <text x="591" y="187" textAnchor="middle" fontSize="19" fill="#fff" fontWeight="750">{fmt(vsi,live)}</text>
      <rect x="0" y="320" width="640" height="45" fill="#071723"/>
      <rect x="0" y="320" width="101" height="45" fill="#092032"/>
      <text x="9" y="333" fill="#70cef7" fontSize="9">GS / KT</text>
      <text x="10" y="355" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(telemetry.groundSpeedKnots,live)}</text>
      <rect x="445" y="320" width="195" height="45" fill="#092032"/>
      <text x="455" y="334" fill="#70cef7" fontSize="9">BANK</text>
      <text x="455" y="353" fill="#e6faff" fontSize="13">{fmt(attitude?.roll ?? null,Boolean(attitude),1)}°</text>
      <text x="521" y="334" fill="#70cef7" fontSize="9">PITCH</text>
      <text x="521" y="353" fill="#e6faff" fontSize="13">{fmt(attitude?.pitch ?? null,Boolean(attitude),1)}°</text>
      <text x="579" y="334" fill="#70cef7" fontSize="9">M</text>
      <text x="579" y="353" fill="#e6faff" fontSize="13">{fmt(telemetry.machNumber,live,2)}</text>
      <g>
        <rect x="101" y="320" width="344" height="45" fill="#0a192a"/>
        {compassTicks.map(({angle,x,major}) => x>107 && x<439 && <g key={angle}>
          <path d={`M${x} 321v${major?9:5}`} stroke="#8ed2f0" strokeWidth={major?1.5:1}/>
          {major && <text x={x} y="347" textAnchor="middle" fill="#c6e9fa" fontSize="11" fontWeight="700">{angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : angle === 270 ? 'W' : String(angle/10).padStart(2,'0')}</text>}
        </g>)}
        <path d="M272 322l-6 10h12z" fill="#e8d978"/>
        <rect x="237" y="345" rx="3" width="70" height="18" fill="#06101d" stroke="#597c98"/>
        <text x="272" y="359" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">{headingNormalized === null ? '---' : Math.round(headingNormalized).toString().padStart(3,'0')}°</text>
      </g>
    </svg>
  </section>;
}
