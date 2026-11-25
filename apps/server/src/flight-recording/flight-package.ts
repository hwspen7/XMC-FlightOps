import { createWriteStream, mkdirSync, renameSync, type WriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ControlMonitor, SimulatorStatus } from '@xplane/shared';

// A flight package is a streaming NDJSON archive. It contains every distinct
// telemetry snapshot seen by the gateway, not every internal simulator frame.
export class FlightPackageRecorder {
  private stream: WriteStream | null = null;
  private path = '';
  private lastAt = -1;
  private count = 0;
  private airborne = false;
  private stoppedAt: number | null = null;
  private lastFresh = 0;
  private blocked = false;
  private failed = false;
  private retryAt = 0;
  constructor(private readonly directory = resolve(process.env.XMC_FLIGHT_ARCHIVE_DIR || 'flight-archives'),
              private readonly log: (message: string) => void = console.warn) {}

  capture(sim: SimulatorStatus, control: ControlMonitor, now = Date.now()): void {
    const t = sim.telemetry;
    if (!sim.reachable || !sim.telemetryFresh || sim.simPaused === true || t.receivedAt === null) {
      if (this.stream && sim.simPaused !== true && now - this.lastFresh > 120_000) this.finish('telemetry-lost');
      return;
    }
    this.lastFresh = now;
    if (t.receivedAt === this.lastAt) return;
    if (t.receivedAt < this.lastAt) this.finish('clock-reset');
    this.lastAt = t.receivedAt;
    if (!this.stream) {
      if (now < this.retryAt || !(t.onGround === 0 || (t.groundSpeedKnots ?? 0) >= 2)) return;
      try {
        mkdirSync(this.directory, { recursive: true });
        this.path = resolve(this.directory, new Date(now).toISOString().replace(/[:.]/g, '-') + '-' + randomUUID() + '.xmc.jsonl.partial');
        const stream = createWriteStream(this.path, { flags: 'wx' });
        this.stream = stream;
        this.failed = false; this.blocked = false; this.count = 0; this.airborne = false; this.stoppedAt = null;
        stream.on('error', err => {
          this.log('Flight archive write error: ' + err.message);
          if (this.stream === stream) { this.failed = true; this.stream = null; this.retryAt = Date.now() + 30_000; }
        });
        stream.on('drain', () => { if (this.stream === stream) this.blocked = false; });
        this.write({ type: 'manifest', schema: 'xmc.flight-package.v1', startedAt: now,
          source: sim.transport ?? 'udp', aircraftIcao: t.aircraftIcao, clock: 'gateway receivedAt epoch ms',
          startReason: t.onGround === 0 ? 'airborne-observed' : 'ground-movement' });
      } catch (err) { this.log('Cannot create flight archive: ' + String(err)); this.retryAt = now + 30_000; return; }
    }
    if (this.blocked) { this.finish('write-backpressure'); this.retryAt = now + 30_000; return; }
    if (t.onGround === 0) this.airborne = true;
    // Preserve missing channels and input provenance; do not fabricate physical data.
    this.write({ type: 'sample', at: t.receivedAt, telemetry: t, control,
      diagnostics: sim.nativeDiagnostics ?? null, advisories: sim.advisoryEvents ?? [],
      transport: sim.transport ?? 'udp', receivedFields: sim.receivedFields, subscribedFields: sim.subscribedFields });
    this.count++;
    if (t.onGround === 1 && t.groundSpeedKnots !== null && t.groundSpeedKnots < 1) {
      this.stoppedAt ??= now;
      const threshold = this.airborne ? 120_000 : 300_000;
      if (now - this.stoppedAt >= threshold) this.finish(this.airborne ? 'ground-stop' : 'ground-session-stop');
    } else this.stoppedAt = null;
  }

  private write(row: unknown): void {
    if (this.stream && !this.stream.write(JSON.stringify(row) + '\n')) this.blocked = true;
  }

  finish(reason = 'server-shutdown'): void {
    const stream = this.stream;
    if (!stream) return;
    const path = this.path, failed = this.failed;
    this.stream = null;
    stream.once('close', () => {
      if (failed || stream.errored) return;
      try { renameSync(path, path.slice(0, -'.partial'.length)); this.log('Flight package saved: ' + path.slice(0, -'.partial'.length)); }
      catch (err) { this.log('Flight archive finalization failed: ' + String(err)); }
    });
    stream.end(JSON.stringify({ type: 'end', endedAt: Date.now(), samples: this.count, reason }) + '\n');
  }
}
