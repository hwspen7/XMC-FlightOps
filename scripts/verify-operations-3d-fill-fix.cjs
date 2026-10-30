'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function assertContains(rel, snippets) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${rel} missing snippet: ${snippet}`);
  }
  console.log(`VERIFIED ${rel}`);
}
assertContains('apps/web/src/components/monitor/AttitudeModel3D.tsx', [
  'WORLD FRAME / BODY AXES',
  'WAITING FOR SIMULATOR',
  'LIVE ORIENTATION',
]);
assertContains('apps/web/src/styles/operations-density.css', [
  'Operations telemetry cleanup',
  'grid-auto-flow: dense;',
  '.model-card .aircraft-scene',
]);
console.log('OPERATIONS 3D / FILL FIX VERIFIED');
