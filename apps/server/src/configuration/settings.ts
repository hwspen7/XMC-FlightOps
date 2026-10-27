import { randomInt } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';

const projectRoot = resolve(process.cwd(), '../..');
loadEnvironment({ path: resolve(projectRoot, '.env'), quiet: true });

function boundedPort(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

export const settings = {
  projectRoot,
  host: process.env.HOST || '127.0.0.1',
  port: boundedPort(process.env.PORT, 3000),
  tlsCertFile: process.env.TLS_CERT_FILE || '',
  tlsKeyFile: process.env.TLS_KEY_FILE || '',
  pairingCode: process.env.PAIRING_CODE?.trim() || String(randomInt(100000, 1000000)),
  outputEnabled: process.env.XPLANE_OUTPUT_ENABLED === 'true',
  xplaneHost: process.env.XPLANE_HOST || '127.0.0.1',
  xplanePort: boundedPort(process.env.XPLANE_PORT, 49000),
  probeEnabled: process.env.XPLANE_PROBE_ENABLED !== 'false',
};
