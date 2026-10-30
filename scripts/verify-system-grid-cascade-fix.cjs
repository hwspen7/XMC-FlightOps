'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const css = path.join(root, 'apps/web/src/styles/operations-density.css');
if (!fs.existsSync(css)) throw new Error('operations-density.css not found');
const text = fs.readFileSync(css, 'utf8');
for (const marker of [
  '/* XMC SYSTEM GRID CASCADE FIX BEGIN',
  '/* XMC SYSTEM GRID CASCADE FIX END */',
  '"electrical autopilot antiice"',
  '"hydraulic cabin landing"',
  '.xmc-operations-merged.xmc-ops-compact .xmc-suite-page .xmc-systems-suite .xmc-systems-grid',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
]) {
  if (!text.includes(marker)) throw new Error(`Missing required CSS rule: ${marker}`);
}
const begin = text.indexOf('/* XMC SYSTEM GRID CASCADE FIX BEGIN');
const end = text.indexOf('/* XMC SYSTEM GRID CASCADE FIX END */');
if (begin < 0 || end < begin) throw new Error('CSS fix has an invalid boundary');
if (text.indexOf('/* XMC SYSTEM GRID CASCADE FIX BEGIN', begin + 1) >= 0) throw new Error('Duplicate grid fix');
console.log('SYSTEM GRID CASCADE FIX VERIFIED');
