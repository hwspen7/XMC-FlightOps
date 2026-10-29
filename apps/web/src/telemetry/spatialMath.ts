/** Orthographic three-dimensional monitor geometry. Source values remain simulator readbacks. */
export interface Vec3 { x:number; y:number; z:number }
export interface PlanePose { heading:number; pitch:number; roll:number }
export interface HistoryPosition { latitude:number; longitude:number; altitudeFeet:number; at:number }
const RAD=Math.PI/180;
/** Body axes: x forward, y starboard, z up. World axes: x east, y north, z up. */
export function aircraftToWorld(p:Vec3,pose:PlanePose):Vec3 {
  const phi=pose.roll*RAD, theta=pose.pitch*RAD, psi=pose.heading*RAD;
  const right=p.y*Math.cos(phi)+p.z*Math.sin(phi);
  const up1=-p.y*Math.sin(phi)+p.z*Math.cos(phi);
  const forward=p.x*Math.cos(theta)-up1*Math.sin(theta);
  const up=p.x*Math.sin(theta)+up1*Math.cos(theta);
  return {x:forward*Math.sin(psi)+right*Math.cos(psi), y:forward*Math.cos(psi)-right*Math.sin(psi), z:up};
}
/** Camera azimuth is measured clockwise from north (degrees). */
export function project3d(p:Vec3,azimuth=44,elevation=30):{x:number;y:number} {
  const a=azimuth*RAD,e=elevation*RAD;
  const across=p.x*Math.cos(a)-p.y*Math.sin(a);
  const depth=p.x*Math.sin(a)+p.y*Math.cos(a);
  return {x:across,y:depth*Math.sin(e)-p.z*Math.cos(e)};
}
/** Local tangent-plane approximation adequate only for short observation traces. */
export function toLocalTrack(points:HistoryPosition[]):Vec3[] {
  if(!points.length) return [];
  const lat=points[0].latitude,lon=points[0].longitude;
  const cos=Math.cos(lat*RAD);
  return points.map(p=>({x:((((p.longitude-lon)+540)%360)-180)*111.195*cos,y:(p.latitude-lat)*111.195,z:(p.altitudeFeet-points[0].altitudeFeet)*0.0003048}));
}
export function validPosition(x:{latitude?:number|null;longitude?:number|null;altitudeFeet?:number|null}):boolean {
  return typeof x.latitude==='number'&&Number.isFinite(x.latitude)&&Math.abs(x.latitude)<=90&&
    typeof x.longitude==='number'&&Number.isFinite(x.longitude)&&Math.abs(x.longitude)<=180&&
    typeof x.altitudeFeet==='number'&&Number.isFinite(x.altitudeFeet);
}
