'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
function check(filename, required, forbidden = []) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) throw new Error(`Missing: ${filename}`);
  const body = fs.readFileSync(full, 'utf8');
  for (const fragment of required) if (!body.includes(fragment)) throw new Error(`${filename}: missing ${fragment}`);
  for (const fragment of forbidden) if (body.includes(fragment)) throw new Error(`${filename}: unexpected old code ${fragment}`);
  console.log('VERIFIED ' + filename);
}
check('apps/web/src/components/monitor/ProfessionalDashboard.tsx', [
  "import { B787PrimaryFlightDisplay } from '../mobile/B787PrimaryFlightDisplay';",
  '<B787PrimaryFlightDisplay telemetry={t} live={live} />',
], ["<PitchLadder centerX={200} centerY={117}", 'ATTITUDE DATA UNAVAILABLE']);
check('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx', ['export function B787PrimaryFlightDisplay']);
check('apps/web/src/components/monitor/FlightRecorder.tsx', ['const pythonJson=', 'EXPORT PYTHON JSON', 'xplane-flight-record.python.json']);
check('apps/web/src/styles/professional-dashboard.css', ['/* XMC shared mobile PFD in desktop overview */']);
console.log('WEB PFD / PYTHON EXPORT VERIFICATION PASSED');
