'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function check(relative, phrases) {
  const absolute = path.join(repo, relative);
  if (!fs.existsSync(absolute)) throw new Error(`Missing patch file: ${relative}`);
  const data = fs.readFileSync(absolute, 'utf8');
  for (const phrase of phrases) {
    if (!data.includes(phrase)) throw new Error(`Missing code in ${relative}: ${phrase}`);
  }
  console.log(`PASS ${relative}`);
}
check('apps/web/src/App.tsx', ["type Workspace = 'overview' | 'operations';", '<OperationsSuite status={serverStatus} connected={connected} onMobile={onMobile}/>']);
check('apps/web/src/components/monitor/OperationsSuite.tsx', ["'telemetry', '04 · RAW TELEMETRY'", '<DesktopMonitor status={status} connected={connected} onMobile={onMobile}/>']);
check('apps/web/src/components/monitor/FlightDisplay.tsx', ['B787PrimaryFlightDisplay', '<B787PrimaryFlightDisplay telemetry={telemetry} live={live}/>']);
check('apps/web/src/styles/operations-merged.css', ['.xmc-suite-telemetry', '.xmc-unified-pfd-housing']);
console.log('OPERATIONS MERGE VERIFIED');
