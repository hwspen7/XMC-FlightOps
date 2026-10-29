/** Web-Mercator XYZ math and chart selection. No assumed aircraft position. */
export type AviationChartMode = 'street' | 'vfr' | 'ifr-low' | 'ifr-high';
export interface GeoPoint { latitude: number; longitude: number }
export interface PixelPoint { x: number; y: number }
export interface ChartTile { id: string; x: number; y: number; left: number; top: number; src: string }

export const CHART_MODES: { id: AviationChartMode; label: string; attribution: string; minZoom: number; maxZoom: number }[] = [
  {id:'street', label:'STREET', attribution:'© OpenStreetMap contributors', minZoom:5,maxZoom:15},
  {id:'vfr', label:'VFR SECTIONAL', attribution:'© FAA Aeronautical Information Services', minZoom:8,maxZoom:12},
  {id:'ifr-low', label:'IFR LOW', attribution:'© FAA Aeronautical Information Services', minZoom:7,maxZoom:12},
  {id:'ifr-high', label:'IFR HIGH', attribution:'© FAA Aeronautical Information Services', minZoom:7,maxZoom:12},
];
const FAA = 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services';
const SERVICES: Record<Exclude<AviationChartMode,'street'>, string> = {
  vfr:'VFR_Sectional', 'ifr-low':'IFR_AreaLow', 'ifr-high':'IFR_High',
};
export function validGeo(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return typeof lat==='number' && Number.isFinite(lat) && Math.abs(lat)<=85.05112878 &&
    typeof lon==='number' && Number.isFinite(lon) && Math.abs(lon)<=180;
}
export const clampZoom = (mode:AviationChartMode, z:number) => {
  const choice=CHART_MODES.find(c=>c.id===mode)!;
  return Math.max(choice.minZoom,Math.min(choice.maxZoom,Math.round(z)));
};
export function project(lat:number, lon:number, zoom:number):PixelPoint {
  const n=256*2**zoom;
  const safeLat=Math.min(85.05112878,Math.max(-85.05112878,lat));
  const s=Math.sin(safeLat*Math.PI/180);
  return {x:(lon+180)/360*n, y:(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n};
}
export function unproject(x:number,y:number,zoom:number):GeoPoint {
  const n=256*2**zoom;
  const radians=Math.atan(Math.sinh(Math.PI*(1-2*y/n)));
  const longitude=((x/n*360)%360+360)%360-180;
  return {latitude:radians*180/Math.PI,longitude};
}
/** Great-circle initial bearing between two observed positions; this is not flight-path angle. */
export function bearingDegrees(from:GeoPoint,to:GeoPoint):number|null {
  if(!validGeo(from.latitude,from.longitude)||!validGeo(to.latitude,to.longitude)) return null;
  const r=Math.PI/180;
  const dl=(to.longitude-from.longitude)*r;
  const y=Math.sin(dl)*Math.cos(to.latitude*r);
  const x=Math.cos(from.latitude*r)*Math.sin(to.latitude*r)-Math.sin(from.latitude*r)*Math.cos(to.latitude*r)*Math.cos(dl);
  if(Math.abs(x)+Math.abs(y)<1e-12) return null;
  return ((Math.atan2(y,x)/r)%360+360)%360;
}
export function deltaWorldX(x:number, centerX:number, zoom:number):number {
  const size=256*2**zoom;
  return ((x-centerX+size/2)%size+size)%size-size/2;
}
export function chartTileUrl(mode:AviationChartMode,z:number,x:number,y:number):string {
  if(mode==='street') return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  return `${FAA}/${SERVICES[mode]}/MapServer/tile/${z}/${y}/${x}`;
}
export function visibleTiles(mode:AviationChartMode, center:GeoPoint, zoom:number, width:number,height:number):ChartTile[] {
  if(!validGeo(center.latitude,center.longitude)||width<=0||height<=0) return [];
  const z=clampZoom(mode,zoom),world=2**z, c=project(center.latitude,center.longitude,z);
  const minX=Math.floor((c.x-width/2)/256),maxX=Math.floor((c.x+width/2)/256);
  const minY=Math.max(0,Math.floor((c.y-height/2)/256));
  const maxY=Math.min(world-1,Math.floor((c.y+height/2)/256));
  const out:ChartTile[]=[];
  for(let ty=minY;ty<=maxY;ty++) for(let tx=minX;tx<=maxX;tx++) {
    const wrappedX=((tx%world)+world)%world;
    out.push({id:`${mode}-${z}-${tx}-${ty}`,x:wrappedX,y:ty,
      left:Math.round(tx*256-c.x+width/2),top:Math.round(ty*256-c.y+height/2),src:chartTileUrl(mode,z,wrappedX,ty)});
  }
  return out;
}
/** FAA chart services have limited regional coverage. No worldwide chart is implied. */
export function isLikelyFaaCoverage(lat:number,lon:number):boolean {
  return (lat>=23 && lat<=51 && lon>=-135 && lon<=-60) ||
    (lat>=50 && lat<=73 && lon>=-170 && lon<=-128) ||
    (lat>=18 && lat<=24 && lon>=-161 && lon<=-153) ||
    (lat>=17 && lat<=26 && lon>=-68 && lon<=-59);
}
