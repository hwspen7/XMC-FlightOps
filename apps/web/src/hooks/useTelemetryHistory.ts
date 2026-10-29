import { useEffect, useState } from 'react';
import type { ServerStatus } from '@xplane/shared';

// Bounded in-memory history. Samples are readbacks, never synthetic data.
export interface HistoryPoint {
  at: number;
  ias: number | null;
  gs: number | null;
  tas: number | null;
  altitude: number | null;
  agl: number | null;
  selectedAltitude: number | null;
  roll: number | null;
  pitch: number | null;
  verticalSpeed: number | null;
  inputRoll: number | null;
  inputPitch: number | null;
  actualRoll: number | null;
  actualPitch: number | null;
  rollRate: number | null;
  pitchRate: number | null;
  yawRate: number | null;
  alpha: number | null;
  beta: number | null;
  gload: number | null;
  n1L: number | null;
  n1R: number | null;
  n2L: number | null;
  n2R: number | null;
  egtL: number | null;
  egtR: number | null;
  fuelFlowL: number | null;
  fuelFlowR: number | null;
  throttle: number | null;
  flapSelected: number | null;
  flapActual: number | null;
  spoiler: number | null;
  gear0: number | null;
  gear1: number | null;
  gear2: number | null;
  latitude: number | null;
  longitude: number | null;
}

const MAX_POINTS = 1200;
const MAX_AGE_MS = 300_000;

export function useTelemetryHistory(status: ServerStatus, connected: boolean): HistoryPoint[] {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const t = status.simulator.telemetry;
  const sampleAt = t.receivedAt;
  const rollInput = status.control.inputRoll;
  const pitchInput = status.control.inputPitch;
  const icao = t.aircraftIcao;
  useEffect(() => {
    if (!connected || !status.simulator.telemetryFresh || sampleAt === null) return;
    const point: HistoryPoint = {
      at: Date.now(),
      ias: t.indicatedAirspeedKnots, gs: t.groundSpeedKnots, tas: t.trueAirspeedKnots,
      altitude: t.altitudeFeet, agl: t.aglFeet, selectedAltitude: t.selectedAltitudeFeet,
      roll: t.rollDegrees, pitch: t.pitchDegrees, verticalSpeed: t.verticalSpeedFpm,
      inputRoll: rollInput, inputPitch: pitchInput,
      actualRoll: t.effectiveRollRatio, actualPitch: t.effectivePitchRatio,
      rollRate: t.rollRateDegreesPerSecond, pitchRate: t.pitchRateDegreesPerSecond, yawRate: t.yawRateDegreesPerSecond,
      alpha: t.angleOfAttackDegrees, beta: t.sideslipDegrees, gload: t.normalLoadG,
      n1L: t.n1LeftPercent, n1R: t.n1RightPercent, n2L: t.n2LeftPercent, n2R: t.n2RightPercent,
      egtL: t.egtLeftC, egtR: t.egtRightC, fuelFlowL: t.fuelFlowLeftKgS, fuelFlowR: t.fuelFlowRightKgS,
      throttle: t.throttleRatio, flapSelected: t.flapHandleRatio, flapActual: t.flapDeployRatio,
      spoiler: t.speedbrakeRatio, gear0: t.gearDeploy0Ratio, gear1: t.gearDeploy1Ratio, gear2: t.gearDeploy2Ratio,
      latitude: t.latitudeDegrees, longitude: t.longitudeDegrees,
    };
    setHistory(previous => {
      const last = previous[previous.length-1];
      if (last && point.at-last.at < 240) return previous;
      // A long telemetry gap means the previous trace must not be joined to the new flight.
      const base = last && point.at-last.at > 25_000 ? [] : previous;
      return [...base, point].filter(p => point.at-p.at <= MAX_AGE_MS).slice(-MAX_POINTS);
    });
  }, [connected, sampleAt, status.simulator.telemetryFresh, rollInput, pitchInput]);
  useEffect(() => { setHistory([]); }, [icao]);
  return history;
}
