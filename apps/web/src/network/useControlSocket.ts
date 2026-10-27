import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerNotice, ServerStatus, SocketMessage } from '@xplane/shared';

import { EMPTY_FLIGHT_TELEMETRY } from '../telemetry/format';

const DEFAULT_SERVER_STATUS: ServerStatus = {
  armed: false,
  ownedByYou: false,
  simulator: { reachable: false, outputEnabled: false, host: 'Not configured', port: 49000, telemetry: EMPTY_FLIGHT_TELEMETRY, telemetryFresh: false, lastHeartbeatAgeMs: null, receivedFields: 0, subscribedFields: 27 },
  control: { framesAccepted: 0, lastFrameAgeMs: null, timeoutMs: 350, inputRoll: null, inputPitch: null, tiltRollDegrees: null, tiltPitchDegrees: null, sensorRateHz: null, inputRateHz: 0, lastAction: null, lastActionAt: null, throttleCommand: null },
};

function socketAddress(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/control`;
}

export function useControlSocket() {
  const socket = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(DEFAULT_SERVER_STATUS);
  const [notice, setNotice] = useState<ServerNotice | null>(null);

  useEffect(() => {
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let retry = 0;
    let active: WebSocket | null = null;

    function connect() {
      if (disposed) return;
      const ws = new WebSocket(socketAddress());
      active = ws;
      socket.current = ws;
      ws.onopen = () => { retry = 0; setConnected(true); setNotice(null); };
      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const message = JSON.parse(event.data) as SocketMessage;
          if (message.event === 'status') setServerStatus(message.data as ServerStatus);
          if (message.event === 'notice') setNotice(message.data as ServerNotice);
        } catch { /* Ignore malformed server messages. */ }
      };
      ws.onclose = () => {
        if (socket.current === ws) socket.current = null;
        setConnected(false);
        setServerStatus(DEFAULT_SERVER_STATUS);
        if (!disposed) {
          retry = Math.min(retry + 1, 5);
          reconnect = setTimeout(connect, Math.min(5000, 400 * 2 ** retry));
        }
      };
      ws.onerror = () => { ws.close(); };
    }
    connect();
    return () => {
      disposed = true;
      if (reconnect) clearTimeout(reconnect);
      if (active) active.close();
      socket.current = null;
    };
  }, []);

  const send = useCallback((event: string, data: unknown = {}) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify({ event, data } satisfies SocketMessage));
    return true;
  }, []);

  return { connected, serverStatus, notice, send };
}
