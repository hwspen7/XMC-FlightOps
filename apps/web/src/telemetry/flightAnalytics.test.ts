import { describe,it,expect } from 'vitest';
import type { ServerStatus } from '@xplane/shared';
import { extrema,picture,toTimelinePoint } from './flightAnalytics';
const testStatus=(t:Record<string,number|null>,live=true)=>({simulator:{reachable:live,telemetryFresh:live,telemetry:{onGround:0,aglFeet:550,verticalSpeedFpm:-2000,indicatedAirspeedKnots:150,...t}}} as ServerStatus);
describe('source grounded flight analytics',()=>{
 it('fails closed for stale data',()=>expect(picture(testStatus({},false),true).condition).toBe('UNKNOWN'));
 it('does not infer gear downlock from a handle alone',()=>expect(picture(testStatus({gearHandleDown:1}),true).evidence.find(e=>e.name==='Gear indication mismatch')).toBeUndefined());
 it('flags high sink near terrain',()=>expect(picture(testStatus({}),true).evidence.map(e=>e.name)).toContain('High sink near terrain'));
 it('preserves gaps and extrema in large decimated samples',()=>{const t=testStatus({}).simulator.telemetry;const pts=Array.from({length:1500},(_,i)=>({...toTimelinePoint(t,i*200),ias:i===722?999:i===420?null:120}));const reduced=extrema(pts,'ias',70);expect(reduced.find(x=>x.ias===999)).toBeDefined();expect(reduced.find(x=>x.ias===null)).toBeDefined();});
});
