'use strict';
/* Static post-install invariants; no simulator data or network required. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const marker = 'XMC_CONTROL_INSTRUMENT_RELIABILITY_20261029';
const required = [
  'apps/server/src/control/control.service.ts',
  'apps/web/src/components/mobile/ThrottleLever.tsx',
  'apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx',
  'apps/web/src/components/mobile/MotionAttitude.tsx',
  'apps/web/src/components/monitor/FlightDisplay.tsx',
  'apps/web/src/components/monitor/ProfessionalDashboard.tsx',
  'native/xplane-plugin/src/plugin.cpp',
];
for (const p of required) {
  if (!read(p).includes(marker)) throw new Error(`${p} is not updated`);
}
if (!read(required[0]).includes('throttleQueue.offer') || !read(required[0]).includes('throttleQueue.reset'))
  throw new Error('Latest-throttle queue integration missing');
if (!read(required[1]).includes('lastForwardGestureAt')) throw new Error('Phone lever echo guard missing');
for (const p of required.slice(2,6)) {
  const code = read(p);
  if (!code.includes('radioAltitudeFeet')) throw new Error(`Missing AGL: ${p}`);
  if (!code.includes('AGL ')) throw new Error(`Missing footer readout: ${p}`);
}
if (!read(required[6]).includes('throttle_command_rejected')) throw new Error('Native diagnostics missing');
console.log('PATCH STATIC VERIFICATION PASSED: throttle ownership + four AGL readouts + C++ diagnostics');
