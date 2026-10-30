import { useMemo } from 'react';
import type { FlightTelemetry } from '@xplane/shared';

type Vec3 = [number, number, number];
type Face = {
  vertices: Vec3[];
  fill: string;
  stroke?: string;
  opacity?: number;
};

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const fmt = (value: number | null | undefined, digits = 0, unit = '') => finite(value) ? `${value.toFixed(digits)}${unit}` : '—';

const FACES: Face[] = [
  { vertices: [[10.8, 0.0, 0.0], [7.6, 0.58, 0.34], [7.6, -0.58, 0.34]], fill: '#eef8ff', stroke: '#f7fcff' },
  { vertices: [[7.6, 0.58, 0.34], [2.8, 0.84, 0.52], [-8.9, 0.64, 0.46], [-11.5, 0.0, 0.32], [-8.9, -0.64, 0.46], [2.8, -0.84, 0.52], [7.6, -0.58, 0.34]], fill: '#d7e7f4', stroke: '#f4fbff' },
  { vertices: [[7.2, 0.52, -0.28], [2.0, 0.68, -0.42], [-8.5, 0.56, -0.34], [-11.1, 0.0, -0.16], [-8.5, -0.56, -0.34], [2.0, -0.68, -0.42], [7.2, -0.52, -0.28]], fill: '#708ca9', stroke: '#9ab5ce', opacity: 0.98 },
  { vertices: [[3.2, 0.44, 0.16], [1.1, 12.2, 0.16], [-2.8, 12.9, 0.18], [-3.5, 0.84, 0.10]], fill: '#b6d0e6', stroke: '#ecf6ff' },
  { vertices: [[3.2, -0.44, 0.16], [1.1, -12.2, 0.16], [-2.8, -12.9, 0.18], [-3.5, -0.84, 0.10]], fill: '#eff6fd', stroke: '#ffffff' },
  { vertices: [[3.0, 0.18, -0.10], [0.6, 11.8, -0.14], [-2.6, 12.4, -0.12], [-3.1, 0.54, -0.18]], fill: '#516c86', stroke: '#7ea2c0', opacity: 0.95 },
  { vertices: [[3.0, -0.18, -0.10], [0.6, -11.8, -0.14], [-2.6, -12.4, -0.12], [-3.1, -0.54, -0.18]], fill: '#4c6985', stroke: '#7ea2c0', opacity: 0.95 },
  { vertices: [[-7.4, 0.34, 0.42], [-10.2, 4.6, 0.48], [-12.4, 4.3, 0.58], [-10.0, 0.70, 0.56]], fill: '#a9c0d8', stroke: '#eaf6ff' },
  { vertices: [[-7.4, -0.34, 0.42], [-10.2, -4.6, 0.48], [-12.4, -4.3, 0.58], [-10.0, -0.70, 0.56]], fill: '#dbe9f5', stroke: '#ffffff' },
  { vertices: [[-9.1, 0.0, 0.20], [-11.6, 0.0, 4.4], [-10.2, 0.0, 4.9], [-8.4, 0.0, 0.82]], fill: '#7eb8d8', stroke: '#dff7ff' },
  { vertices: [[0.4, 2.2, -0.48], [2.1, 3.2, -0.22], [1.6, 1.4, -0.14], [-0.2, 1.0, -0.26]], fill: '#657f99', stroke: '#9db7cd', opacity: 0.95 },
  { vertices: [[0.4, -2.2, -0.48], [2.1, -3.2, -0.22], [1.6, -1.4, -0.14], [-0.2, -1.0, -0.26]], fill: '#657f99', stroke: '#9db7cd', opacity: 0.95 },
];

function rotateBody(vertex: Vec3, rollDeg: number, pitchDeg: number, headingDeg: number): Vec3 {
  const roll = rollDeg * Math.PI / 180;
  const pitch = pitchDeg * Math.PI / 180;
  const heading = headingDeg * Math.PI / 180;
  let [x, y, z] = vertex;

  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  [x, z] = [x * cp + z * sp, -x * sp + z * cp];

  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  [y, z] = [y * cr - z * sr, y * sr + z * cr];

  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  [x, y] = [x * ch - y * sh, x * sh + y * ch];

  return [x, y, z];
}

function worldToCamera(vertex: Vec3): { x: number; y: number; depth: number } {
  const [x, y, z] = vertex;
  const yaw = -35 * Math.PI / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy - y * sy;
  const y1 = x * sy + y * cy;

  const pitch = 20 * Math.PI / 180;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x2 = x1 * cp + z * sp;
  const z2 = -x1 * sp + z * cp;

  const distance = 34;
  const perspective = distance / (distance - y1);
  return {
    x: x2 * perspective,
    y: z2 * perspective,
    depth: y1,
  };
}

function toPoint(vertex: Vec3, rollDeg: number, pitchDeg: number, headingDeg: number) {
  const camera = worldToCamera(rotateBody(vertex, rollDeg, pitchDeg, headingDeg));
  return {
    x: 350 + camera.x * 20.5,
    y: 168 - camera.y * 20.5,
    depth: camera.depth,
  };
}

export function AttitudeModel3D({ telemetry, live }: { telemetry: FlightTelemetry; live: boolean }) {
  const valid = live && finite(telemetry.rollDegrees) && finite(telemetry.pitchDegrees) && finite(telemetry.headingDegrees);
  const roll = valid ? telemetry.rollDegrees! : 0;
  const pitch = valid ? telemetry.pitchDegrees! : 0;
  const heading = valid ? telemetry.headingDegrees! : 0;

  const renderedFaces = useMemo(() => FACES.map((face) => {
    const points = face.vertices.map((vertex) => toPoint(vertex, roll, pitch, heading));
    const avgDepth = points.reduce((sum, point) => sum + point.depth, 0) / points.length;
    return { ...face, points, avgDepth };
  }).sort((a, b) => a.avgDepth - b.avgDepth), [roll, pitch, heading]);

  const nose = valid ? toPoint([10.8, 0.0, 0.0], roll, pitch, heading) : null;
  const shadow = valid ? [
    toPoint([10.2, 0.0, -0.05], 0, 0, heading),
    toPoint([2.0, 6.8, -0.05], 0, 0, heading),
    toPoint([-8.8, 3.8, -0.05], 0, 0, heading),
    toPoint([-10.5, 0.0, -0.05], 0, 0, heading),
    toPoint([-8.8, -3.8, -0.05], 0, 0, heading),
    toPoint([2.0, -6.8, -0.05], 0, 0, heading),
  ] : [];

  return <section className="monitor-card model-card">
    <div className="card-heading">
      <div>
        <span className="micro-label">SPATIAL ANALYSIS</span>
        <h2>Aircraft attitude <em>/ 3D</em></h2>
      </div>
      <span className={`live-indicator ${valid ? 'live' : ''}`}>{valid ? 'LIVE ORIENTATION' : 'NO 3D DATA'}</span>
    </div>

    <svg className="aircraft-scene" viewBox="0 0 700 360" role="img" aria-label={valid ? 'Three-dimensional aircraft model driven by simulator roll pitch and heading telemetry' : 'Aircraft attitude waiting for telemetry'}>
      <defs>
        <linearGradient id="xmc-3d-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14385a"/>
          <stop offset="1" stopColor="#0a2138"/>
        </linearGradient>
        <radialGradient id="xmc-3d-glow" cx="50%" cy="44%" r="70%">
          <stop offset="0" stopColor="#3b7fb4" stopOpacity="0.28"/>
          <stop offset="1" stopColor="#3b7fb4" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="xmc-3d-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.28"/>
          <stop offset="1" stopColor="#000" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="700" height="360" rx="10" fill="url(#xmc-3d-bg)"/>
      <rect x="0" y="0" width="700" height="360" rx="10" fill="url(#xmc-3d-glow)"/>

      {Array.from({ length: 8 }, (_, i) => 90 + i * 65).map((x) => <line key={`vx-${x}`} x1={x} y1="62" x2={x} y2="288" stroke="#25506f" strokeDasharray="2 7"/>) }
      {Array.from({ length: 5 }, (_, i) => 84 + i * 48).map((y) => <line key={`hy-${y}`} x1="82" y1={y} x2="618" y2={y} stroke="#25506f" strokeDasharray="2 7"/>) }
      <ellipse cx="350" cy="169" rx="174" ry="72" fill="none" stroke="#2e6b8f" strokeDasharray="4 7" opacity="0.8"/>
      <line x1="350" y1="56" x2="350" y2="294" stroke="#3e7ea2" strokeDasharray="4 6" opacity="0.7"/>
      <line x1="172" y1="169" x2="528" y2="169" stroke="#2e6b8f" strokeDasharray="4 6" opacity="0.6"/>
      <circle cx="350" cy="169" r="4" fill="#6ba7c8"/>

      {valid && shadow.length > 2 && <polygon points={shadow.map((point) => `${point.x.toFixed(1)},${(point.y + 34).toFixed(1)}`).join(' ')} fill="url(#xmc-3d-shadow)" opacity="0.9"/>}

      {renderedFaces.map((face, index) => <polygon
        key={index}
        points={face.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
        fill={face.fill}
        stroke={face.stroke ?? '#dcefff'}
        strokeWidth="1.15"
        strokeLinejoin="round"
        opacity={face.opacity ?? 1}
      />)}

      {nose && <>
        <line x1="350" y1="169" x2={nose.x} y2={nose.y} stroke="#ffd58c" strokeWidth="1.1" strokeDasharray="3 5" opacity="0.85"/>
        <circle cx={nose.x} cy={nose.y} r="4.4" fill="#ffd176" stroke="#fff2cf" strokeWidth="1.1"/>
      </>}

      {!valid && <g>
        <rect x="252" y="144" width="196" height="52" rx="7" fill="#091827" stroke="#355874"/>
        <text x="350" y="165" textAnchor="middle" fill="#d7eef8" fontSize="14" fontWeight="700">WAITING FOR SIMULATOR</text>
        <text x="350" y="183" textAnchor="middle" fill="#88acc1" fontSize="11">No discrete pose received</text>
      </g>}

      <text x="18" y="24" fill="#76a5c4" fontSize="11" fontWeight="700">WORLD FRAME / BODY AXES</text>
      <text x="18" y="340" fill="#6e97b2" fontSize="10">ACTUAL X-PLANE VALUES · NOT PHONE TILT</text>
    </svg>

    <div className="model-angles">
      <div><span>ROLL</span><strong>{fmt(telemetry.rollDegrees, 1, '°')}</strong></div>
      <div><span>PITCH</span><strong>{fmt(telemetry.pitchDegrees, 1, '°')}</strong></div>
      <div><span>HEADING</span><strong>{fmt(telemetry.headingDegrees, 0, '°')}</strong></div>
    </div>
  </section>;
}
