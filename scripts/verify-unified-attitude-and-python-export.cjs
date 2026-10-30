'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function mustContain(relative, snippets) {
  const absolute = path.join(repo, relative);
  if (!fs.existsSync(absolute)) throw new Error(`Missing file: ${relative}`);
  const text = fs.readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n');
  for (const s of snippets) {
    if (!text.includes(s)) throw new Error(`${relative} missing required marker: ${s}`);
  }
  console.log(`VERIFIED ${relative}`);
}

mustContain('apps/web/src/components/monitor/PitchLadder.tsx', [
  '/* XMC unified attitude ladder v2 */',
  'const GAP = 14;',
  'chevrons(',
]);
mustContain('apps/web/src/components/monitor/FlightRecorder.tsx', [
  'EXPORT PYTHON JSON',
  'pythonJson',
  'analysis/flight_report.py',
]);
const prof = path.join(repo, 'apps/web/src/components/monitor/ProfessionalDashboard.tsx');
if (fs.existsSync(prof)) {
  const text = fs.readFileSync(prof, 'utf8').replace(/\r\n/g, '\n');
  if (!text.includes('AGL {radioAltitudeFeet(t.aglFeet,live)} FT')) {
    throw new Error('ProfessionalDashboard.tsx missing relocated AGL readout');
  }
  console.log('VERIFIED apps/web/src/components/monitor/ProfessionalDashboard.tsx');
}
console.log('UNIFIED ATTITUDE / PYTHON EXPORT VERIFICATION PASSED');
