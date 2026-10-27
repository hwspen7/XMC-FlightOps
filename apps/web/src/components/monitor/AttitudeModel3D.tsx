import { useMemo } from 'react';
import type { FlightTelemetry } from '@xplane/shared';
import { displayValue } from '../../telemetry/format';

type V = [number, number, number];
type PlaneFace = { vertices: V[]; fill: string; stroke?: string };

const FACES: PlaneFace[] = [
  { vertices: [[-.18,.08,2.8],[-.28,.12,1.2],[.28,.12,1.2],[.18,.08,2.8]], fill: '#cdd9e7' },
  { vertices: [[-.28,.12,1.2],[-.24,.12,-2.4],[.24,.12,-2.4],[.28,.12,1.2]], fill: '#8199b4' },
  { vertices: [[-.24,.12,.8],[-3.1,.12,-.65],[-3.3,.12,-1.05],[-.32,.12,-.65]], fill: '#a6bcd3' },
  { vertices: [[.24,.12,.8],[3.1,.12,-.65],[3.3,.12,-1.05],[.32,.12,-.65]], fill: '#dae3ed' },
  { vertices: [[-.24,.15,-1.9],[-1.18,.15,-2.5],[-1.05,.15,-2.7],[0,.15,-2.28]], fill: '#a4b8ce' },
  { vertices: [[.24,.15,-1.9],[1.18,.15,-2.5],[1.05,.15,-2.7],[0,.15,-2.28]], fill: '#dae3ed' },
  { vertices: [[0,.12,-1.8],[0,1.2,-2.55],[0,1.15,-2.75],[0,.12,-2.6]], fill: '#5d81a9' },
];

function project(v: V, roll: number, pitch: number, heading: number): { x: number; y: number; depth: number } {
  const r = -roll * Math.PI / 180;
  const p = pitch * Math.PI / 180;
  const h = heading * Math.PI / 180;
  let [x,y,z] = v;
  [x,y] = [x*Math.cos(r)-y*Math.sin(r), x*Math.sin(r)+y*Math.cos(r)];
  [y,z] = [y*Math.cos(p)-z*Math.sin(p), y*Math.sin(p)+z*Math.cos(p)];
  [x,z] = [x*Math.cos(h)+z*Math.sin(h), -x*Math.sin(h)+z*Math.cos(h)];
  // Fixed elevated camera with perspective projection.
  const cameraX = x*.88 + z*.48;
  const cameraY = y*.91 - z*.28 + x*.22;
  const depth = z*.82 - x*.42 - y*.32;
  const scale = 55 * 9 / Math.max(5, 9 - depth*.12);
  return { x: 300 + cameraX*scale, y: 178 - cameraY*scale, depth };
}

export function AttitudeModel3D({ telemetry, live }: { telemetry: FlightTelemetry; live: boolean }) {
  const valid = live && telemetry.rollDegrees !== null && telemetry.pitchDegrees !== null && telemetry.headingDegrees !== null;
  const roll = valid ? telemetry.rollDegrees! : 0;
  const pitch = valid ? telemetry.pitchDegrees! : 0;
  const heading = valid ? telemetry.headingDegrees! : 0;
  const faces = useMemo(() => FACES.map(face => ({
    fill: face.fill,
    points: face.vertices.map((vertex) => project(vertex, roll, pitch, heading)),
  })).sort((a,b) => a.points.reduce((v,p) => v+p.depth,0)/a.points.length - b.points.reduce((v,p)=>v+p.depth,0)/b.points.length), [roll,pitch,heading]);

  return <section className="monitor-card model-card">
    <div className="card-heading"><div><span className="micro-label">SPATIAL ANALYSIS</span><h2>Aircraft attitude <em>/ 3D</em></h2></div><span className={`live-indicator ${valid ? 'live' : ''}`}>{valid ? 'TELEMETRY LIVE' : 'NO 3D DATA'}</span></div>
    <svg className="aircraft-scene" viewBox="0 0 600 350" role="img" aria-label={valid ? 'Three-dimensional aircraft attitude based on X-Plane telemetry' : 'Aircraft model waiting for telemetry'}>
      <defs><linearGradient id="modelBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#102a45"/><stop offset="1" stopColor="#091727"/></linearGradient></defs>
      <rect width="600" height="350" rx="10" fill="url(#modelBack)"/>
      {[0,1,2,3,4,5].map((i) => <g key={i} opacity=".5"><path d={`M0 ${78+i*37} H600`} stroke="#244360" strokeWidth=".8" strokeDasharray="4 8"/><path d={`M${60+i*96} 0 V350`} stroke="#244360" strokeWidth=".8" strokeDasharray="4 8"/></g>)}
      <g stroke="#47799b" strokeWidth="1.3" strokeDasharray="6 8" fill="none" opacity=".75"><ellipse cx="300" cy="190" rx="207" ry="76"/><path d="M300 56 V309 M98 190 H502"/></g>
      {valid && faces.map((face, i) => <polygon key={i} points={face.points.map(point=>`${point.x},${point.y}`).join(' ')} fill={face.fill} stroke="#537492" strokeWidth="1.4" strokeLinejoin="round"/>)}
      {!valid && <g><rect x="165" y="142" width="270" height="63" rx="6" fill="#071524" fillOpacity=".9" stroke="#40617c"/><text x="300" y="171" fill="#d8e6f1" textAnchor="middle" fontSize="17">WAITING FOR SIMULATOR</text><text x="300" y="192" fill="#829fb7" textAnchor="middle" fontSize="12">No aircraft pose received</text></g>}
      <g fontSize="11" fill="#7fa1ba" letterSpacing="1.5"><text x="18" y="27">WORLD FRAME / BODY AXES</text><text x="18" y="332">ATTITUDE-DRIVEN SCHEMATIC · NOT AIRCRAFT GEOMETRY</text></g>
      <g strokeWidth="2"><path d="M541 282 l0 -37" stroke="#56c7e2"/><path d="M541 282 l31 0" stroke="#d9a968"/><path d="M541 282 l-17 17" stroke="#97a9d1"/></g>
    </svg>
    <div className="model-angles"><div><span>ROLL</span><strong>{valid ? displayValue(telemetry.rollDegrees,1) : '---'}°</strong></div><div><span>PITCH</span><strong>{valid ? displayValue(telemetry.pitchDegrees,1) : '---'}°</strong></div><div><span>HEADING</span><strong>{valid ? displayValue(telemetry.headingDegrees,1) : '---'}°</strong></div></div>
  </section>;
}
