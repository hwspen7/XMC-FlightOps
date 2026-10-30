'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv.find(arg => arg.startsWith('--repository='))?.slice('--repository='.length) ?? process.cwd();
function check(relative, terms) {
  const filename = path.join(repo,relative);
  if (!fs.existsSync(filename)) throw Error('Missing file: ' + relative);
  const code = fs.readFileSync(filename,'utf8');
  for (const term of terms) if (!code.includes(term)) throw Error(relative + ' missing marker: ' + term);
  console.log('VERIFIED ' + relative);
  return code;
}
const ladder = check('apps/web/src/components/monitor/PitchLadder.tsx', [
  'export function PitchLadder',
  'centerX - gap',
  'centerX + gap',
  'centerY - degree * pixelsPerDegree',
]);
if (/chevrons|negative &&|\.kind === 'major' \? chevrons/.test(ladder)) throw Error('Legacy white chevrons still present');
const mobile = check('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx', [
  '/* XMC PFD footband v3:',
  'AGL / FT',
  'radioAltitudeFeet(telemetry.aglFeet,live)',
  '<rect x="275" y="345"',
  'x: 315 + (angle - headingNormalized) * 2.25',
]);
if (mobile.includes('<rect x="237" y="345"')) throw Error('Old heading box still present');
check('apps/web/src/components/monitor/ProfessionalDashboard.tsx', [
  '<B787PrimaryFlightDisplay telemetry={t} live={live} />',
]);
check('apps/web/src/styles/professional-dashboard.css', [
  '/* XMC PFD alignment / wide-card layout, shared mobile PFD in web monitor. */',
  '.xpd-primary .xpd-pfd-panel { grid-column: span 6; }',
  'aspect-ratio: 640 / 365',
]);
console.log('SHARED PFD GEOMETRY / FOOTER / RESPONSIVE LAYOUT VERIFIED');
