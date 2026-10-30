'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv.find(a => a.startsWith('--repository='))?.slice('--repository='.length) || process.cwd());
function contains(rel, markers) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) throw new Error(`Missing ${rel}`);
  const s = fs.readFileSync(absolute,'utf8').replace(/\r\n/g,'\n');
  for (const marker of markers) {
    if (!s.includes(marker)) throw new Error(`${rel} missing ${marker}`);
  }
  console.log(`VERIFIED ${rel}`);
}
contains('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx', [
  "import { displayAttitude } from '../../telemetry/attitudePresentation';",
  'const attitudeForDisplay = displayAttitude(attitude, telemetry.onGround, telemetry.groundSpeedKnots);',
  'horizonTransform(attitudeForDisplay, 272, 176, PFD_PITCH_PIXELS_PER_DEGREE)',
]);
contains('apps/web/src/components/monitor/ProfessionalDashboard.tsx', [
  '<B787PrimaryFlightDisplay telemetry={t} live={live} />',
]);
contains('apps/web/src/styles/professional-dashboard.css', [
  '/* XMC map-height fix:',
  '.xpd-primary > .xpd-track-panel .xav-map',
  'flex: 1 1 auto;',
]);
contains('apps/web/src/telemetry/attitudePresentation.ts', [
  'export function displayAttitude(',
  'const tolerance = 1.25;',
]);
contains('apps/web/src/telemetry/attitudePresentation.test.ts', [
  "describe('stationary ground attitude presentation'",
]);
console.log('MAP AND ATTITUDE FIX VERIFIED');
