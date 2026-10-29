import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerNotice, ServerStatus, SocketMessage } from '@xplane/shared';
import { readSessionTicket, saveSessionTicket, validSessionTicket } from './controllerSession';
import { EMPTY_FLIGHT_TELEMETRY } from '../telemetry/format';

const DEFAULT_SERVER_STATUS: ServerStatus = {
  armed: false, ownedByYou: false, controlPhase: 'idle',
  simulator: { reachable: false, outputEnabled: false, host: 'Not configured', port: 49000, telemetry: EMPTY_FLIGHT_TELEMETRY, telemetryFresh: false, lastHeartbeatAgeMs: null, receivedFields: 0, subscribedFields: 27 },
  control: { framesAccepted: 0, lastFrameAgeMs: null, timeoutMs: 350, inputRoll: null, inputPitch: null, tiltRollDegrees: null, tiltPitchDegrees: null, sensorRateHz: null, inputRateHz: 0, lastAction: null, lastActionAt: null, throttleCommand: null },
};

function safeLocalStorage(): Storage | null {
  try { return window.localStorage; }
  catch { return null; }
}

function socketAddress(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/control`;
}

export function useControlSocket() {
  const socket = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(DEFAULT_SERVER_STATUS);
  const [notice, setNotice] = useState<ServerNotice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.severity === 'error' ? 4500 : 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let connectTimeout: ReturnType<typeof setTimeout> | undefined;
    let active: WebSocket | null = null;
    let retry = 0;
    let lastMessageAt = 0;
    let backgrounded = false;
    let recoveryFromBackground = false;
    let failedHandshakes = 0;

    async function reloadIfWebSocketStackIsStuck() {
      // Safari can leave new WebSocket handshakes hanging after backgrounding.
      // A guarded reload is a last resort only when HTTPS itself still works.
      if (!recoveryFromBackground || failedHandshakes < 2 || disposed) return;
      const storage = safeLocalStorage();
      if (!storage) return;
      const key = 'xmc.controller.last-socket-reload';
      let lastReload = 0;
      try { lastReload = Number(storage?.getItem(key) ?? 0); } catch { /* ignored */ }
      if (Date.now() - lastReload < 60_000) return;
      try {
        const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
        if (!response.ok || disposed || document.visibilityState === 'hidden' ||
            active?.readyState === WebSocket.OPEN) return;
        try { storage.setItem(key, String(Date.now())); }
        catch { return; } // Without the guard, repeated reloads could loop.
        window.location.reload(); // Paused flight remains paused. Pairing ticket is preserved.
      } catch { /* Server is offline, keep retrying instead of loading an error page. */ }
    }

    function clearTimers() {
      if (reconnect) clearTimeout(reconnect);
      if (connectTimeout) clearTimeout(connectTimeout);
      reconnect = undefined;
      connectTimeout = undefined;
    }

    function connect() {
      if (disposed || document.visibilityState === 'hidden') return;
      clearTimers();
      if (active) {
        const previous = active;
        active = null;
        if (socket.current === previous) socket.current = null;
        previous.close();
      }
      setConnected(false);
      setSessionRestored(false);
      setServerStatus(DEFAULT_SERVER_STATUS);
      const ws = new WebSocket(socketAddress());
      active = ws;
      socket.current = ws;
      // iOS Safari can leave the previous socket apparently OPEN after a
      // background suspension. A fresh connection, not the stale OPEN flag,
      // determines whether controls are available.
      connectTimeout = setTimeout(() => {
        if (active !== ws || ws.readyState === WebSocket.OPEN) return;
        // Do not depend on 'close' firing: some iOS Safari versions leave
        // a CONNECTING socket frozen with no further callbacks.
        active = null;
        if (socket.current === ws) socket.current = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
        setConnected(false);
        setSessionRestored(false);
        retry = Math.min(retry + 1, 5);
        failedHandshakes++;
        void reloadIfWebSocketStackIsStuck();
        reconnect = setTimeout(connect, Math.min(5000, 400 * 2 ** retry));
      }, 6000);
      ws.onopen = () => {
        if (active !== ws) return;
        if (connectTimeout) clearTimeout(connectTimeout);
        connectTimeout = undefined;
        retry = 0;
        failedHandshakes = 0;
        recoveryFromBackground = false;
        lastMessageAt = Date.now();
        setConnected(true);
        setNotice(null);
        const storage = safeLocalStorage();
        const ticket = storage ? readSessionTicket(storage) : null;
        if (ticket) ws.send(JSON.stringify({ event: 'rejoin', data: { ticket } } satisfies SocketMessage));
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        if (active !== ws) return;
        lastMessageAt = Date.now();
        try {
          const message = JSON.parse(event.data) as SocketMessage;
          if (message.event === 'status') setServerStatus(message.data as ServerStatus);
          if (message.event === 'notice') setNotice(message.data as ServerNotice);
          if (message.event === 'recording-csv') {
            const data = message.data as { filename?: unknown; csv?: unknown };
            if (typeof data.csv === 'string' && data.csv.length <= 6_000_000) {
              const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'xplane-flight-recording.csv';
              document.body.appendChild(link);
              link.click(); link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
          }
          if (message.event === 'session') {
            const data = message.data as { restored?: boolean; ticket?: unknown } | null;
            if (data?.restored === true && validSessionTicket(data.ticket)) {
              const storage = safeLocalStorage();
              if (storage) saveSessionTicket(storage, data.ticket);
              setSessionRestored(true);
            } else {
              const storage = safeLocalStorage();
              if (storage) saveSessionTicket(storage, null);
              setSessionRestored(false);
            }
          }
        } catch { /* Ignore malformed server messages. */ }
      };
      ws.onclose = () => {
        if (active !== ws) return;
        active = null;
        if (socket.current === ws) socket.current = null;
        if (connectTimeout) clearTimeout(connectTimeout);
        connectTimeout = undefined;
        setConnected(false);
        setSessionRestored(false);
        setServerStatus(DEFAULT_SERVER_STATUS);
        if (disposed || document.visibilityState === 'hidden') return;
        retry = Math.min(retry + 1, 5);
        reconnect = setTimeout(connect, Math.min(5000, 400 * 2 ** retry));
      };
      ws.onerror = () => { ws.close(); };
    }

    function onForeground() {
      if (document.visibilityState === 'hidden') { backgrounded = true; return; }
      if (!backgrounded && active?.readyState === WebSocket.OPEN &&
          Date.now() - lastMessageAt < 2000) return;
      backgrounded = false;
      recoveryFromBackground = true;
      failedHandshakes = 0;
      retry = 0;
      connect(); // Always discard a potentially stale socket after suspension.
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) { backgrounded = true; onForeground(); }
    }
    function onOnline() {
      if (document.visibilityState !== 'hidden' && active?.readyState !== WebSocket.OPEN) connect();
    }

    connect();
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    const watchdog = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (active?.readyState === WebSocket.OPEN && Date.now() - lastMessageAt > 3500) {
        connect();
      }
    }, 1000);
    return () => {
      disposed = true;
      clearTimers();
      window.clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      if (active) active.close();
      socket.current = null;
    };
  }, []);

  const send = useCallback((event: string, data: unknown = {}) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    if (event === 'control' && socket.current.bufferedAmount > 4096) return false;
    socket.current.send(JSON.stringify({ event, data } satisfies SocketMessage));
    return true;
  }, []);

  return { connected, sessionRestored, serverStatus, notice, send };
}
