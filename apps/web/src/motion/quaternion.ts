export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function conjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

function axisAngle(axis: 'x' | 'y' | 'z', radians: number): Quaternion {
  const half = radians / 2;
  const sine = Math.sin(half);
  return {
    w: Math.cos(half),
    x: axis === 'x' ? sine : 0,
    y: axis === 'y' ? sine : 0,
    z: axis === 'z' ? sine : 0,
  };
}

function normalize(q: Quaternion): Quaternion {
  const magnitude = Math.hypot(q.w, q.x, q.y, q.z);
  return {
    w: q.w / magnitude,
    x: q.x / magnitude,
    y: q.y / magnitude,
    z: q.z / magnitude,
  };
}

/**
 * W3C device orientation uses intrinsic Z-X'-Y'' rotations.
 * The device's physical axes are used, independent of screen layout.
 */
export function fromDeviceOrientation(alpha: number, beta: number, gamma: number): Quaternion {
  return normalize(multiply(
    multiply(axisAngle('z', alpha * DEG), axisAngle('x', beta * DEG)),
    axisAngle('y', gamma * DEG),
  ));
}

/**
 * Convert relative rotation into a local rotation vector in degrees.
 * The shortest-arc representation avoids 0/360-degree discontinuities.
 */
export function relativeRotationDegrees(neutral: Quaternion, current: Quaternion): { x: number; y: number; z: number } {
  let delta = normalize(multiply(conjugate(neutral), current));
  if (delta.w < 0) delta = { w: -delta.w, x: -delta.x, y: -delta.y, z: -delta.z };
  const vectorMagnitude = Math.hypot(delta.x, delta.y, delta.z);
  if (vectorMagnitude < 1e-9) return { x: 0, y: 0, z: 0 };
  const angle = 2 * Math.atan2(vectorMagnitude, Math.max(-1, Math.min(1, delta.w))) / DEG;
  const scale = angle / vectorMagnitude;
  return { x: delta.x * scale, y: delta.y * scale, z: delta.z * scale };
}
