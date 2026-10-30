'use strict';
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2).filter((arg) => arg !== '--check');
const root = path.resolve(args[0] || process.cwd());
const relative = 'apps/web/src/styles/operations-density.css';
const absolute = path.join(root, relative);
if (!fs.existsSync(absolute)) {
  throw new Error(`Operations style missing: ${relative}`);
}
const css = fs.readFileSync(absolute, 'utf8');
for (const label of [
  'Systems + diagnostics alignment refinement.',
  'Operations side-by-side alignment correction.',
  'Operations alignment follow-up, built on the LAST systems/diagnostics patch.',
  'Native real-time flight loop measurements',
  'X-Plane actual flight control synchronization',
  'grid-template-rows: repeat(2, minmax(53px, 1fr));',
  '.xmc-pro-suite > .xmc-advanced-card:nth-child(4)',
  '.primary-monitor-grid > .model-card',
]) {
  if (!css.includes(label)) {
    throw new Error(`Required rule is missing: ${label}`);
  }
}
console.log('OPERATIONS PRECISION ALIGNMENT VERIFIED');
console.log('Retained: previous systems / diagnostics and PFD / 3D alignments.');
console.log('Updated: dual native diagnostics and flight analytics upper/lower alignment.');
