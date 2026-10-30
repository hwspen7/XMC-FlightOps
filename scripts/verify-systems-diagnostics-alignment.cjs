'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rel='apps/web/src/styles/operations-density.css';
const abs=path.join(root, rel);
if(!fs.existsSync(abs)) throw new Error(`Missing ${rel}`);
const text=fs.readFileSync(abs,'utf8');
for (const s of [
  'Systems + diagnostics alignment refinement.',
  '.xmc-ops-compact .xmc-systems-grid {',
  'column-count: 3;',
  '.xmc-ops-compact .signal-panel {',
  'grid-template-columns: repeat(12, minmax(0, 1fr));'
]) {
  if(!text.includes(s)) throw new Error(`Missing snippet: ${s}`);
}
console.log('SYSTEMS / DIAGNOSTICS ALIGNMENT VERIFIED');
