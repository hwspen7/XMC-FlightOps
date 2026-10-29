import { describe, expect, it } from 'vitest';
import { parseNativeTelemetry } from './native-protocol';
import { emptyTelemetry, TELEMETRY_DEFINITIONS } from '../xplane/telemetry';
const token = 'ValidNativeSharedToken_123';
const decode = (fields: string) => parseNativeTelemetry(Buffer.from(`XMT1|${token}|armed=0|${fields}`), token);
describe('extended native observability contract', () => {
  it('preserves established main-branch data names and parses new subsystems', () => {
    const values = decode('normalLoadG=1.2|egtLeftC=650|fuelFlowLeftKgS=0.5|electricalBusVolts=28|hydraulicFluid1Ratio=0.6|generatorLeftOn=1|nativeRiskScore=18|nativeAlertFlags=4')?.values;
    expect(values).toMatchObject({ normalLoadG: 1.2, egtLeftC: 650, fuelFlowLeftKgS: 0.5, electricalBusVolts: 28, hydraulicFluid1Ratio: 0.6, generatorLeftOn: 1, nativeRiskScore: 18, nativeAlertFlags: 4 });
  });
  it('rejects duplicate readings and invalid ranges', () => {
    expect(decode('nativeRiskScore=101')).toBeNull();
    expect(decode('nativeAlertFlags=4096')).toBeNull();
    expect(decode('hydraulicFluid1Ratio=2')).toBeNull();
    expect(decode('generatorLeftOn=3')).toBeNull();
    expect(decode('egtLeftC=300|egtLeftC=350')).toBeNull();
    expect(decode('nativeEventCount=-1')).toBeNull();
  });
  it('exposes null for unsupported aircraft and keeps legacy datarefs unique', () => {
    const initial=emptyTelemetry();
    expect(initial.normalLoadG).toBeNull();
    expect(initial.hydraulicPressure1Raw).toBeNull();
    expect(initial.nativeRiskScore).toBeNull();
    const ids=TELEMETRY_DEFINITIONS.map(d=>d.index);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
