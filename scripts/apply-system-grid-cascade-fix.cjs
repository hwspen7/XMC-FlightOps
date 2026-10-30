'use strict';
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const check = args.includes('--check');
const rootArg = args.filter(x => x !== '--check');
if (rootArg.length > 1) throw new Error('Usage: node scripts/apply-system-grid-cascade-fix.cjs [--check] [repository]');
const root = rootArg.length ? path.resolve(rootArg[0]) : process.cwd();
const cssFile = 'apps/web/src/styles/operations-density.css';
const suiteFile = 'apps/web/src/components/monitor/OperationsSuite.tsx';
const topologyFile = 'apps/web/src/components/monitor/SystemTopology.tsx';
const abs = rel => path.join(root, rel);
for (const file of [cssFile, suiteFile, topologyFile]) {
  if (!fs.existsSync(abs(file))) throw new Error(`Cannot find ${file}. Run from project root.`);
}
const suite = fs.readFileSync(abs(suiteFile), 'utf8');
if (!suite.includes("'../../styles/operations-density.css'")) {
  throw new Error(`OperationsSuite.tsx does not import operations-density.css. Unexpected baseline.`);
}
const topology = fs.readFileSync(abs(topologyFile), 'utf8');
if (!topology.includes('className="xmc-systems-grid"')) {
  throw new Error(`SystemTopology.tsx is missing .xmc-systems-grid. Unexpected baseline.`);
}
const payload = fs.readFileSync(path.join(__dirname, '..', 'patches', 'system-grid-priority.css'), 'utf8');
const begin = '/* XMC SYSTEM GRID CASCADE FIX BEGIN';
const end = '/* XMC SYSTEM GRID CASCADE FIX END */';
if (!payload.includes(begin) || !payload.includes(end)) throw new Error('Patch payload incomplete.');
const cssPath = abs(cssFile);
const original = fs.readFileSync(cssPath, 'utf8');
let revised = original;
const start = original.indexOf(begin);
const finish = original.indexOf(end);
if ((start >= 0) !== (finish >= 0)) throw new Error('Previous patch marker incomplete. Not modifying CSS.');
if (start >= 0) {
  if (finish < start) throw new Error('Patch marker ordering is invalid.');
  const tail = finish + end.length;
  revised = original.slice(0, start) + payload.trimEnd() + original.slice(tail);
} else {
  revised = original.trimEnd() + '\n\n' + payload.trimEnd() + '\n';
}
if (check) {
  console.log(`PRECHECK PASSED: ${cssFile}`);
  console.log(`Mode: ${start >= 0 ? 'replace existing override' : 'append new override'}`);
  process.exit(0);
}
if (revised === original) {
  console.log('ALREADY INSTALLED: no changes made');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backup = cssPath + `.before-system-grid-${stamp}.bak`;
fs.copyFileSync(cssPath, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(cssPath, revised, 'utf8');
console.log(`UPDATED: ${cssFile}`);
console.log(`BACKUP: ${backup}`);
