import { describe, expect, it } from 'vitest';
import { aircraftToWorld, project3d, toLocalTrack, validPosition } from './spatialMath';

describe('simulator spatial monitor geometry', () => {
  it('points aircraft forward to north at zero heading, east at heading 90', () => {
    expect(aircraftToWorld({x:1,y:0,z:0},{heading:0,pitch:0,roll:0}).y).toBeCloseTo(1,5);
    expect(aircraftToWorld({x:1,y:0,z:0},{heading:90,pitch:0,roll:0}).x).toBeCloseTo(1,5);
  });
  it('positive pitch raises nose and positive right bank lowers starboard wing', () => {
    expect(aircraftToWorld({x:1,y:0,z:0},{heading:0,pitch:15,roll:0}).z).toBeGreaterThan(0);
    expect(aircraftToWorld({x:0,y:1,z:0},{heading:0,pitch:0,roll:15}).z).toBeLessThan(0);
  });
  it('uses actual coordinate and altitude differences, not synthetic trajectories', () => {
    const pts=toLocalTrack([
      {latitude:40,longitude:-83,altitudeFeet:1000,at:1},
      {latitude:40.01,longitude:-83,altitudeFeet:4280.84,at:2},
    ]);
    expect(pts[0].x).toBe(0);
    expect(pts[1].y).toBeCloseTo(1.11195,4);
    expect(pts[1].z).toBeCloseTo(1,3);
  });
  it('keeps paths continuous across the international date line', () => {
    const pts=toLocalTrack([{latitude:0,longitude:179.99,altitudeFeet:1000,at:1},{latitude:0,longitude:-179.99,altitudeFeet:1000,at:2}]);
    expect(pts[1].x).toBeCloseTo(2.2239,3);
  });
  it('does not project missing heights and keeps finite camera output', () => {
    expect(validPosition({latitude:40,longitude:-83,altitudeFeet:null})).toBe(false);
    const p=project3d({x:5,y:2,z:1},45,30);
    expect(Number.isFinite(p.x)&&Number.isFinite(p.y)).toBe(true);
  });
});
