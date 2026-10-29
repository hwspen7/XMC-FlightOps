import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { ControlGateway } from './control.gateway';
import { settings } from '../configuration/settings';
import type { ControlService } from '../control/control.service';
import type { XPlaneService } from '../xplane/xplane.service';

function mockClient() {
  return { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
}

function lastSession(client: WebSocket): { restored: boolean; ticket?: string } {
  const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls
    .map(([packet]) => JSON.parse(packet as string) as { event: string; data: { restored: boolean; ticket?: string } });
  const message = sent.filter((entry) => entry.event === 'session').at(-1);
  if (!message) throw Error('Session response missing');
  return message.data;
}

describe('Reconnect without renewed six-digit pairing', () => {
  it('restores pairing but never restores flight authority implicitly', () => {
    let owner: object | null = null;
    const control = {
      isArmed: () => owner !== null,
      isOwner: (client: object) => owner === client,
      currentOwner: () => owner,
      arm: vi.fn((client: object) => {
        if (owner && owner !== client) return false;
        owner = client;
        return true;
      }),
      suspend: vi.fn((client?: object) => {
        if (!owner || (client && owner !== client)) return false;
        owner = null;
        return true;
      }),
      disarm: vi.fn(() => false),
      metrics: vi.fn(() => ({})),
    } as unknown as ControlService;
    const sim = { status: vi.fn(() => ({ reachable: true, outputEnabled: true, transport: 'native' })) } as unknown as XPlaneService;
    const gateway = new ControlGateway(control, sim);
    try {
      const first = mockClient();
      gateway.onArm(first, { pairingCode: settings.pairingCode });
      expect(owner).toBe(first);
      const ticket = lastSession(first).ticket;
      expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
      gateway.handleDisconnect(first);
      expect(owner).toBeNull();
      const returned = mockClient();
      gateway.onRejoin(returned, { ticket });
      expect(lastSession(returned).restored).toBe(true);
      expect(owner).toBeNull(); // Returning to Safari cannot auto-fly.
      gateway.onArm(returned, { pairingCode: '' });
      expect(owner).toBe(returned);
      gateway.handleDisconnect(returned);
      const stranger = mockClient();
      gateway.onRejoin(stranger, { ticket: 'x'.repeat(43) });
      expect(lastSession(stranger).restored).toBe(false);
    } finally {
      gateway.onModuleDestroy();
    }
  });
});
