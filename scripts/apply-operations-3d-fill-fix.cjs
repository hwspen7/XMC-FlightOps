'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Accept either `--check`, `.` or `. --check` without misreading flags as paths.
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const otherOptions = args.filter(arg => arg.startsWith('--') && arg !== '--check');
const positional = args.filter(arg => !arg.startsWith('--'));
if (otherOptions.length || positional.length > 1) {
  throw new Error('Usage: node scripts/apply-operations-3d-fill-fix.cjs [repository] [--check]');
}
const root = positional.length ? path.resolve(positional[0]) : process.cwd();

const required = [
  {
    path: 'apps/web/src/components/monitor/AttitudeModel3D.tsx',
    markers: ['Aircraft attitude <em>/ 3D</em>', 'LIVE ORIENTATION', 'WAITING FOR SIMULATOR'],
  },
  {
    path: 'apps/web/src/styles/operations-density.css',
    markers: ['Operations telemetry cleanup', 'grid-auto-flow: dense;', '.model-card .aircraft-scene'],
  },
];

for (const item of required) {
  const abs = path.join(root, item.path);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing overlay file: ${abs}. Extract the corrected ZIP into the project root first.`);
  }
  const content = fs.readFileSync(abs, 'utf8');
  for (const marker of item.markers) {
    if (!content.includes(marker)) {
      throw new Error(`Expected patch content is missing in ${item.path}: ${marker}`);
    }
  }
  console.log(`PASS ${item.path}`);
}

console.log(checkOnly ? 'Precheck PASSED' : 'Overlay verified; no additional installation step required.');
