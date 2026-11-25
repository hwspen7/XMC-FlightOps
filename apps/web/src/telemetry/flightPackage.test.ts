import { describe, it, expect } from 'vitest';
import type { FlightTelemetry } from '@xplane/shared';
import { parseFlightPackage, flightEvents, displacement, controlMetrics, type FlightSample } from './flightPackage';
const sample=(at:number,onGround:number,lon=0)=>({type:'sample',at,telemetry:{onGround,latitudeDegrees:0,longitudeDegrees:lon,nativeCommandRollRatio:0.2,simJoystickRollRatio:0.1},control:{}} as FlightSample);
describe('flight package',()=>{
 it('retains complete and incomplete source data',()=>{const h={type:'manifest',schema:'xmc.flight-package.v1',source:'native'};const s=sample(100,1);expect(parseFlightPackage([h,s,{type:'end',samples:1,reason:'ground-stop'}].map(x=>JSON.stringify(x)).join('\n')).complete).toBe(true);expect(parseFlightPackage([h,s].map(x=>JSON.stringify(x)).join('\n')).complete).toBe(false);});
 it('rejects out of order data',()=>{expect(()=>parseFlightPackage([{type:'manifest',schema:'xmc.flight-package.v1'},sample(200,1),sample(100,0)].map(x=>JSON.stringify(x)).join('\n'))).toThrow();});
 it('brackets contacts without bridging missing telemetry',()=>{expect(flightEvents([sample(100,1),sample(200,0),sample(3000,1),sample(3100,0)])).toEqual([{index:1,kind:'Liftoff',bracketMs:100},{index:3,kind:'Liftoff',bracketMs:100}]);});
 it('handles antimeridian',()=>{const a={latitudeDegrees:0,longitudeDegrees:179.999} as FlightTelemetry,b={latitudeDegrees:0,longitudeDegrees:-179.999} as FlightTelemetry;expect(displacement(a,b)?.[0]).toBeCloseTo(222.39,1);});
 it('uses native same-snapshot tracking',()=>{expect(controlMetrics([sample(100,0)],'Roll').rms).toBeCloseTo(.1);});
});