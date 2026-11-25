import { describe, it, expect } from 'vitest';
import type { FlightTelemetry } from '@xplane/shared';
import { parseFlightPackage, flightEvents, displacement, controlMetrics, runwayPosition, observedLag, stepTracking, responseSpectrum, rotationCandidate, type FlightSample } from './flightPackage';
const sample=(at:number,onGround:number,lon=0)=>({type:'sample',at,telemetry:{onGround,latitudeDegrees:0,longitudeDegrees:lon,nativeCommandRollRatio:0.2,simJoystickRollRatio:0.1},control:{}} as FlightSample);
describe('flight package',()=>{
 it('retains complete and incomplete source data',()=>{const h={type:'manifest',schema:'xmc.flight-package.v1',source:'native'};const s=sample(100,1);expect(parseFlightPackage([h,s,{type:'end',samples:1,reason:'ground-stop'}].map(x=>JSON.stringify(x)).join('\n')).complete).toBe(true);expect(parseFlightPackage([h,s].map(x=>JSON.stringify(x)).join('\n')).complete).toBe(false);});
 it('rejects out of order data',()=>{expect(()=>parseFlightPackage([{type:'manifest',schema:'xmc.flight-package.v1'},sample(200,1),sample(100,0)].map(x=>JSON.stringify(x)).join('\n'))).toThrow();});
 it('brackets contacts without bridging missing telemetry',()=>{expect(flightEvents([sample(100,1),sample(200,0),sample(3000,1),sample(3100,0)])).toEqual([{index:1,kind:'Liftoff',bracketMs:100},{index:3,kind:'Liftoff',bracketMs:100}]);});
 it('handles antimeridian',()=>{const a={latitudeDegrees:0,longitudeDegrees:179.999} as FlightTelemetry,b={latitudeDegrees:0,longitudeDegrees:-179.999} as FlightTelemetry;expect(displacement(a,b)?.[0]).toBeCloseTo(222.39,1);});
 it('projects a northbound runway with east-positive lateral offset',()=>{const r={thresholdLat:0,thresholdLon:0,endLat:.02,endLon:0,widthM:45};const p=runwayPosition(r,{latitudeDegrees:.01,longitudeDegrees:.0001} as FlightTelemetry);expect(p?.along).toBeCloseTo(1111.95,0);expect(p?.right).toBeCloseTo(11.12,1);expect(p?.inside).toBe(true);});
 it('rejects absent excitation for lag',()=>{expect(observedLag(Array.from({length:50},(_,i)=>sample(i*100,0)),'Roll')).toBeNull();});
 it('uses native same-snapshot tracking',()=>{expect(controlMetrics([sample(100,0)],'Roll').rms).toBeCloseTo(.1);});
});
describe('control engineering guards',()=>{
 it('rejects unavailable or unexcited response channels',()=>{const s=Array.from({length:200},(_,i)=>sample(i*100,0));expect(stepTracking(s,'Roll')).toBeNull();expect(responseSpectrum(s,'Roll')).toEqual([]);});
 it('estimates an excited synthetic manual rate response',()=>{
  const s=Array.from({length:192},(_,i)=>{const x=.3*Math.sin(i*2*Math.PI/16);return {...sample(i*100,0),telemetry:{...sample(i*100,0).telemetry,nativeCommandRollRatio:x,rollRateDegreesPerSecond:2*x,autopilotServosOn:0}};});
  const bins=responseSpectrum(s,'Roll');expect(bins.length).toBeGreaterThan(0);expect(bins.find(b=>Math.abs(b.hz-.625)<.001)?.gain).toBeCloseTo(2,4);
 });
 it('does not report rotation on missing pitch rate',()=>{expect(rotationCandidate([sample(0,1),sample(100,1),sample(200,0)],2)).toBeNull();});
});
