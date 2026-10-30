'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const cssPath = path.join(root, 'apps/web/src/styles/operations-density.css');
if (!fs.existsSync(cssPath)) throw new Error(`Missing layout style: ${cssPath}`);
const css = fs.readFileSync(cssPath,'utf8');
const required = [
  'Operations side-by-side alignment correction',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
  'grid-column: 2;',
  'align-items: stretch;',
  '.trend-card:not(.monitor-trend-advanced)',
];
for (const marker of required) if (!css.includes(marker)) throw new Error(`Missing alignment rule: ${marker}`);
const model = path.join(root, 'apps/web/src/components/monitor/AttitudeModel3D.tsx');
if (!fs.existsSync(model)) throw new Error('Existing 3D component missing; install the previous corrected 3D patch first.');
console.log('OPERATIONS ALIGNMENT PATCH VERIFIED');
