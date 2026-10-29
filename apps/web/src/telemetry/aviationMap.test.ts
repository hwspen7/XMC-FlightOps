import { describe, expect, it } from 'vitest';
import { chartTileUrl, bearingDegrees, clampZoom, deltaWorldX, project, unproject, validGeo, visibleTiles } from './aviationMap';

describe('aeronautical chart projection', () => {
  it('projects simulator latitude and longitude to Web Mercator without swapping axes', () => {
    const p=project(39.998,-83.013,10);
    const decoded=unproject(p.x,p.y,10);
    expect(decoded.latitude).toBeCloseTo(39.998,5);
    expect(decoded.longitude).toBeCloseTo(-83.013,5);
  });
  it('rejects impossible coordinates and missing location', () => {
    expect(validGeo(null,-83)).toBe(false);
    expect(validGeo(88,2)).toBe(false);
    expect(validGeo(39.9,-83)).toBe(true);
  });
  it('selects genuine FAA tile services for VFR, low IFR and high IFR', () => {
    expect(chartTileUrl('vfr',10,270,390)).toContain('/VFR_Sectional/MapServer/tile/10/390/270');
    expect(chartTileUrl('ifr-low',9,270,390)).toContain('/IFR_AreaLow/MapServer/tile/9/390/270');
    expect(chartTileUrl('ifr-high',8,100,40)).toContain('/IFR_High/MapServer/tile/8/40/100');
    expect(chartTileUrl('street',10,270,390)).toBe('https://tile.openstreetmap.org/10/270/390.png');
  });
  it('clamps zoom to supported FAA raster cache levels', () => {
    expect(clampZoom('vfr',17)).toBe(12);
    expect(clampZoom('ifr-low',4)).toBe(7);
  });
  it('distinguishes ground-track bearing from aircraft flight-path angle', () => {
    expect(bearingDegrees({latitude:40,longitude:-83},{latitude:40.1,longitude:-83})).toBeCloseTo(0,1);
    expect(bearingDegrees({latitude:40,longitude:-83},{latitude:40,longitude:-82.9})).toBeCloseTo(89.97,1);
    expect(bearingDegrees({latitude:40,longitude:-83},{latitude:40,longitude:-83})).toBeNull();
  });
  it('only requests visible tiles and wraps the longitude antimeridian', () => {
    const tiles=visibleTiles('vfr',{latitude:40,longitude:-83},10,500,240);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(12);
    expect(tiles.every(t=>t.x>=0&&t.x<2**10)).toBe(true);
    expect(Math.abs(deltaWorldX(project(0,-179,5).x,project(0,179,5).x,5))).toBeLessThan(100);
  });
});
