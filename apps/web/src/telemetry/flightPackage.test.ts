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

import { parseRunwayRow, matchRunway, contactDetails, dataQuality, importFlightFile } from './flightPackage';
describe('archive quality and airport geometry',()=>{
 it('parses reciprocal ends and displaced thresholds',()=>{const rows=parseRunwayRow('100 45 1 0 0.25 1 1 0 36 0 0 200 0 1 0 0 0 18 .02 0 100 0 1 0 0 0','TEST');expect(rows).toHaveLength(2);expect(rows[0].displacedM).toBe(200);expect(matchRunway(rows,{latitudeDegrees:.01,longitudeDegrees:0,headingDegrees:0} as FlightTelemetry)?.ident).toBe('36');});
 it('classifies a short reverted contact as transient',()=>{const s=[sample(0,0),sample(100,1),sample(200,1),sample(300,0)];expect(contactDetails(s,flightEvents(s)[0]).classification).toBe('transient');});
 it('reports gaps without inventing coverage',()=>{expect(dataQuality([sample(100,0),sample(200,0),sample(3000,0)]).gaps).toBe(1);});
 it('streams archive text',async()=>{const rows=[{type:'manifest',schema:'xmc.flight-package.v1'},sample(100,0),{type:'end',samples:1,reason:'test'}];const a=await importFlightFile(new Blob([rows.map(x=>JSON.stringify(x)).join('\n')]));expect(a.samples).toHaveLength(1);expect(a.complete).toBe(true);});
});
import { archiveCrcHex, archiveCrcUpdate } from '@xplane/shared';
import { sourceTimedWindow, runwayRoll, signalQuality } from './flightPackage';
describe('precision and integrity',()=>{
 it('verifies CRC32 standard vector and rejects modified archives',()=>{
  expect(archiveCrcHex(archiveCrcUpdate(0xffffffff,'123456789'))).toBe('cbf43926');
  const h=JSON.stringify({type:'manifest',schema:'xmc.flight-package.v1',integrity:'crc32-jsonl'});
  const p=JSON.stringify(sample(100,1)),crc=archiveCrcHex(archiveCrcUpdate(0xffffffff,h+'\n'+p+'\n'));
  const footer=JSON.stringify({type:'end',samples:1,reason:'test',crc32:crc});
  expect(parseFlightPackage([h,p,footer].join('\n')).integrity).toBe('verified');
  expect(()=>parseFlightPackage([h,p.replace('"onGround":1','"onGround":0'),footer].join('\n'))).toThrow('checksum');
 });
 it('uses native clock and refuses a missing native packet',()=>{
  const s=[1,2,3].map(i=>{const p=sample(i*100,0);return {...p,telemetry:{...p.telemetry,nativeSampleSequence:i,nativeSampleTimeUs:100000+i*25000}};});
  expect(sourceTimedWindow(s).map(p=>p.at)).toEqual([0,25,50]);expect(sourceTimedWindow([s[0],s[2]])).toEqual([]);
 });
 it('computes in-bounds runway travel without taxi outside the runway',()=>{
  const r={thresholdLat:0,thresholdLon:0,endLat:0,endLon:.02,widthM:45};
  const s=[sample(0,1,-.001),sample(100,1,.001),sample(200,1,.002),sample(300,0,.003)];
  expect(runwayRoll(s,flightEvents(s)[0],r)?.stationChangeM).toBeCloseTo(222.39,1);
 });
 it('reports input saturation and activity from measured samples',()=>{
  expect(signalQuality([sample(100,0),sample(200,0)],'Roll').rms).toBeCloseTo(.2);
 });
});
it('streams only a requested time interval while validating total count',async()=>{
 const rows=[{type:'manifest',schema:'xmc.flight-package.v1'},sample(1000,0),sample(61000,0),sample(121000,1),{type:'end',samples:3,reason:'test'}];
 const a=await importFlightFile(new Blob([rows.map(x=>JSON.stringify(x)).join('\n')]),{startMinutes:1,durationMinutes:.5});
 expect(a.samples.map(p=>p.at)).toEqual([61000]);expect(a.totalSamples).toBe(3);expect(a.segment).toBe(true);
});
