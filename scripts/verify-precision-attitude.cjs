'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const paths = [
  'apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx',
  'apps/web/src/components/mobile/MotionAttitude.tsx',
  'apps/web/src/components/monitor/FlightDisplay.tsx',
  'apps/web/src/components/monitor/ProfessionalDashboard.tsx',
];
let valid = true;
for (const name of paths) {
  const src = fs.readFileSync(path.join(root,name), 'utf8');
  const imports = /import\s+\{\s*PitchLadder\s*\}\s+from/.test(src);
  const uses = (src.match(/<PitchLadder\s/g)||[]).length;
  const stale = src.includes('ATTITUDE DATA UNAVAILABLE') || src.includes('const PITCH_MARKS =');
  const okay = imports && uses === 1 && !stale;
  console.log(`${okay ? 'PASS':'FAIL'} ${name}`);
  valid = valid && okay;
}
if (!valid) process.exitCode = 1;
