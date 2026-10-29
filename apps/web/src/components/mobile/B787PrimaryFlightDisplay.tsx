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
  const vsi = live ? telemetry.verticalSpeedFpm : null;
  const heading = live ? telemetry.magneticHeadingDegrees ?? telemetry.headingDegrees : null;
  const transform = attitude ? horizonTransform(attitude, 272, 181, 3.8) : '';
  return <section className="xmc-pfd" aria-label="X-Plane primary flight display">
    <svg viewBox="0 0 640 365" preserveAspectRatio="xMidYMid meet" role="img" aria-label={attitude ? 'Live X-Plane attitude, airspeed, altitude and heading' : 'Waiting for real X-Plane aircraft telemetry'}>
      <defs>
        <clipPath id={`${id}-attitude`}><rect x="101" y="33" width="342" height="276" /></clipPath>
        <clipPath id={`${id}-speed`}><rect x="4" y="43" width="92" height="264"/></clipPath>
        <clipPath id={`${id}-alt`}><rect x="448" y="43" width="96" height="264"/></clipPath>
      </defs>
      <rect x=".5" y=".5" width="639" height="364" fill="#050f1b" stroke="#36536d"/>
      <rect x="0" y="0" width="640" height="32" fill="#0a1d31"/>
      <path d="M0 32H640 M99 32V309 M445 32V309 M546 32V309 M0 310H640" stroke="#3c617e" strokeWidth="1.5"/>
      <g fill="#78c9fa" fontSize="13" fontWeight="750" letterSpacing="1"><text x="13" y="21">IAS / KT</text><text x="458" y="21">ALT / FT</text><text x="557" y="21">V/S</text></g>
      <g clipPath={`url(#${id}-attitude)`}>
        {attitude && <g transform={transform}>
          <rect x="-900" y="-900" width="1800" height="900" fill="#137ebf"/>
          <rect x="-900" y="0" width="1800" height="900" fill="#91643e"/>
          <path d="M-900 0H900" stroke="#f9f5e8" strokeWidth="2.4"/>
          {[-40,-30,-20,-10,10,20,30,40].map(deg => <g key={deg} transform={`translate(0 ${-deg * 3.8})`} stroke="#edf7ff" fill="#edf7ff" strokeWidth="1.6">
            <path d={`M${deg % 20 === 0 ? -49 : -28} 0H-12 M12 0H${deg % 20 === 0 ? 49 : 28}`}/>
            <text stroke="none" fontSize="12" x="-67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
            <text stroke="none" fontSize="12" x="67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
          </g>)}
        </g>}
      </g>
      {attitude && <g stroke="#f7faff" fill="none" strokeWidth="2">
        <path d="M174 181h57l12 12h58l12-12h57" stroke="#ffe273" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="272" cy="181" r="4" fill="#ffe273" stroke="none"/>
        <path d="M196 79Q272 29 348 79" strokeWidth="1.7"/>
        {[-60,-45,-30,-20,-10,0,10,20,30,45,60].map(deg => {
          const radians = deg*Math.PI/180;
          return <path key={deg} d={`M${272+96*Math.sin(radians)} ${100-96*Math.cos(radians)}l${6*Math.sin(radians)} ${-6*Math.cos(radians)}`}/>;
        })}
        <path d="M272 47l-8 18h16z" fill="#ffdf69" stroke="none"/>
      </g>}
      {!attitude && <g><rect x="136" y="128" width="272" height="92" rx="3" fill="#061321" fillOpacity=".94" stroke="#537693"/>
        <text x="272" y="161" fill="#ffd592" fontWeight="800" fontSize="16" textAnchor="middle">NO FLIGHT DATA</text>
        <text x="272" y="186" fill="#93adc5" fontSize="12" textAnchor="middle">Waiting for X-Plane telemetry</text>
        <text x="272" y="205" fill="#627f98" fontSize="10" textAnchor="middle">Aircraft values are not simulated</text></g>}
      <rect x="4" y="43" width="92" height="264" fill="#172a3c" stroke="#446077"/>
      <g clipPath={`url(#${id}-speed)`}>
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
      <rect x="0" y="310" width="640" height="55" fill="#081827"/>
      <text x="15" y="326" fontSize="11" fill="#64c5f6">GS</text><text x="39" y="326" fontSize="13" fill="#e4f5ff">{fmt(telemetry.groundSpeedKnots,live)}</text>
      <text x="125" y="326" fontSize="11" fill="#64c5f6">ROLL</text><text x="166" y="326" fontSize="13" fill="#e4f5ff">{fmt(attitude?.roll ?? null,Boolean(attitude),1)}°</text>
      <text x="243" y="326" fontSize="11" fill="#64c5f6">PITCH</text><text x="291" y="326" fontSize="13" fill="#e4f5ff">{fmt(attitude?.pitch ?? null,Boolean(attitude),1)}°</text>
      <text x="406" y="326" fontSize="11" fill="#64c5f6">HDG</text><text x="440" y="326" fontSize="15" fill="#fff">{heading === null ? '---' : `${Math.round(((heading % 360)+360)%360).toString().padStart(3,'0')}°`}</text>
      <text x="560" y="326" fontSize="11" fill="#64c5f6">MACH</text><text x="560" y="349" fontSize="15" fill="#fff">{fmt(telemetry.machNumber,live,2)}</text>
      <path d="M0 335H548" stroke="#254760"/><text x="14" y="352" fill="#779db9" fontSize="11">X-PLANE AIRCRAFT DATA · NOT PHONE TILT</text>
    </svg>
  </section>;
}
