import {describe,it,expect} from 'vitest';
import {archiveFrom,demonstration,measure,parseArchive} from './flightRecorder';
describe('flight archive format and safety',()=>{
 it('roundtrips a validated real flight archive',()=>{const a=archiveFrom([],[],null);expect(parseArchive(JSON.stringify(a))).toEqual(a);});
 it('keeps synthetic scenarios distinct from real telemetry',()=>expect(demonstration('approach').source).toBe('demonstration'));
 it('rejects nonmonotonic times',()=>{const d=demonstration('normal');d.samples[1].at=d.samples[0].at-5;expect(()=>parseArchive(JSON.stringify(d))).toThrow();});
 it('rejects nonfinite readbacks',()=>{const d=demonstration('normal');d.samples[1].ias='NaN' as unknown as number;expect(()=>parseArchive(JSON.stringify(d))).toThrow();});
 it('computes pairwise engine statistics',()=>expect(measure(demonstration('asymmetry').samples).meanN1Asymmetry).toBeGreaterThan(10));
});
