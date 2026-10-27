import { useEffect, useState } from 'react';
import type { ServerStatus } from '@xplane/shared';

export interface HistoryPoint {
  at: number;
  ias: number | null;
  gs: number | null;
  altitude: number | null;
  agl: number | null;
  roll: number | null;
  pitch: number | null;
  verticalSpeed: number | null;
  inputRoll: number | null;
  inputPitch: number | null;
  latitude: number | null;
  longitude: number | null;
}

const MAX_POINTS = 300;
const MAX_AGE_MS = 90_000;

export function useTelemetryHistory(status: ServerStatus, connected: boolean): HistoryPoint[] {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const t = status.simulator.telemetry;
  const sampleAt = t.receivedAt;
  const rollInput = status.control.inputRoll;
  const pitchInput = status.control.inputPitch;
  useEffect(() => {
    if (!connected || !status.simulator.telemetryFresh || sampleAt === null) return;
    const point: HistoryPoint = {
      at: Date.now(),
      ias: t.indicatedAirspeedKnots, gs: t.groundSpeedKnots,
      altitude: t.altitudeFeet, agl: t.aglFeet,
      roll: t.rollDegrees, pitch: t.pitchDegrees,
      verticalSpeed: t.verticalSpeedFpm,
      inputRoll: rollInput, inputPitch: pitchInput,
      latitude: t.latitudeDegrees, longitude: t.longitudeDegrees,
    };
    setHistory((previous) => {
      if (previous.length && point.at - previous[previous.length - 1].at < 170) return previous;
      return [...previous, point].filter((item) => point.at - item.at <= MAX_AGE_MS).slice(-MAX_POINTS);
    });
    // The simulator snapshot timestamp changes whenever an RREF response arrives.
  }, [connected, sampleAt, status.simulator.telemetryFresh, rollInput, pitchInput]);
  return history;
}
