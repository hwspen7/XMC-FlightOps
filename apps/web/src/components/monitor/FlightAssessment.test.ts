import { describe, expect, it } from 'vitest';
import type { ServerStatus } from '@xplane/shared';
import { EMPTY_FLIGHT_TELEMETRY } from '../../telemetry/format';
import { assessFlight } from './FlightAssessment';

const state = (fields:Partial<ServerStatus['simulator']['telemetry']> = {}) => ({
  armed:false,
  simulator:{ telemetry:{...EMPTY_FLIGHT_TELEMETRY,...fields} },
} as ServerStatus);

describe('flight condition interpretation', () => {
  it('does not infer aircraft state from a disconnected feed', () => {
    expect(assessFlight(state(),false,[])).toEqual([expect.objectContaining({state:'NO LIVE DATA',status:'unknown'})]);
  });
  it('does not claim gear lock without a complete position readback', () => {
    const items=assessFlight(state({gearHandleDown:1, gearDeploy0Ratio:1}),true,[]);
    expect(items.find(s=>s.name==='Landing gear')).toMatchObject({state:'DOWN / UNVERIFIED',status:'unknown'});
  });
  it('flags a gear position disagreement and observed flap offset', () => {
    const items=assessFlight(state({gearHandleDown:0, gearDeploy0Ratio:0, gearDeploy1Ratio:.5, gearDeploy2Ratio:0,flapHandleRatio:1,flapDeployRatio:.4}),true,[]);
    expect(items.find(s=>s.name==='Landing gear')?.status).toBe('watch');
    expect(items.find(s=>s.name==='Flap tracking')?.status).toBe('watch');
  });
  it('does not label a clean stall reference as an actual stall warning', () => {
    const items=assessFlight(state({speedVsKnots:150,indicatedAirspeedKnots:145,onGround:0}),true,[]);
    expect(items.find(s=>s.name==='Stall-speed reference')).toMatchObject({state:'-5 KT',status:'watch'});
  });
});
