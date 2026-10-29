import { describe, expect, it } from 'vitest';
import { parseNativeTelemetry } from './native-protocol';
const token='abcdefghijklmnop';
const frame=(s:string)=>Buffer.from(`XMT1|${token}|armed=0|${s}`);
describe('native phase and risk diagnostics',()=>{
 it('accepts a bounded phase and independent risk channels',()=>{
  const parsed=parseNativeTelemetry(frame('nativeFlightPhase=6|nativeHandlingRisk=14|nativePropulsionRisk=5|nativeSystemsRisk=0|nativeApproachRisk=20'),token);
  expect(parsed?.values).toMatchObject({nativeFlightPhase:6,nativeHandlingRisk:14,nativePropulsionRisk:5,nativeSystemsRisk:0,nativeApproachRisk:20});
 });
 it('rejects arbitrary phase values',()=>expect(parseNativeTelemetry(frame('nativeFlightPhase=17'),token)).toBeNull());
 it('rejects out-of-bounds risk',()=>expect(parseNativeTelemetry(frame('nativeSystemsRisk=110'),token)).toBeNull());
});
