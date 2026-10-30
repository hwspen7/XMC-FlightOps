'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repositoryArgument = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const root = repositoryArgument ? path.resolve(repositoryArgument) : process.cwd();
const relativePath = 'apps/web/src/styles/system-topology.css';
const absolutePath = path.join(root, relativePath);

if (!fs.existsSync(absolutePath)) {
  console.error(`Verification failed: missing ${absolutePath}`);
  process.exit(1);
}

const css = fs.readFileSync(absolutePath, 'utf8');
const checks = [
  ['systems page layout marker', /Precision wide layout for the systems page\./],
  ['grid template areas', /grid-template-areas\s*:/],
  ['electrical, autopilot, anti-ice first row', /['"]electrical\s+autopilot\s+antiice['"]\s*;?/],
  ['hydraulic, cabin, landing second row', /['"]hydraulic\s+cabin\s+landing['"]\s*;?/],
  ['cabin and landing alignment selectors', /\.xmc-systems-grid\s*>\s*\.xmc-system-card:nth-child\(4\)[\s\S]*?\.xmc-systems-grid\s*>\s*\.xmc-system-card:nth-child\(6\)/],
  ['208px card minimum height', /min-height\s*:\s*208px\s*;?/],
  ['small-screen single-column layout', /@media\s*\(max-width\s*:\s*750px\)/],
];

let failed = false;
for (const [label, pattern] of checks) {
  if (!pattern.test(css)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}
if (failed) {
  console.error(`SYSTEM TOPOLOGY ALIGNMENT VERIFICATION FAILED: ${relativePath}`);
  process.exit(1);
}
console.log('SYSTEM TOPOLOGY ALIGNMENT VERIFIED');
