'use strict';
/* Checked, backed-up incremental patch. --check performs no writes. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv.find(a => a.startsWith('--repository='))?.slice('--repository='.length) || process.cwd());
const dryRun = process.argv.includes('--check');
const jobs = [];
const source = rel => path.join(root, rel);
function input(rel) {
  const absolute = source(rel);
  if (!fs.existsSync(absolute)) throw new Error(`Required source file missing: ${rel}`);
  const original = fs.readFileSync(absolute, 'utf8');
  return {rel, absolute, original, normal: original.replace(/\r\n/g, '\n'), crlf: original.includes('\r\n')};
}
function stage(f, text) {
  if (text !== f.normal) jobs.push({rel:f.rel, absolute:f.absolute, kind:'edit', prior:f.original, next:f.crlf?text.replace(/\n/g,'\r\n'):text});
}
function replaceOne(text, from, to, label) {
  const count = typeof from === 'string' ? text.split(from).length - 1 : [...text.matchAll(new RegExp(from.source,from.flags.includes('g')?from.flags:from.flags+'g'))].length;
  if (count !== 1) throw new Error(`Source mismatch in ${label}: expected 1 match, found ${count}. No files were changed.`);
  return text.replace(from, to);
}
function newFile(rel, payload) {
  const absolute = source(rel);
  const text = fs.readFileSync(path.join(__dirname, '..', 'payload', payload), 'utf8');
  if (fs.existsSync(absolute)) {
    if (fs.readFileSync(absolute, 'utf8') !== text) throw new Error(`Existing ${rel} differs from the patch. No files were changed.`);
    return;
  }
  jobs.push({rel, absolute, kind:'create', next:text});
}

// Confirm the installed shared mobile/desktop PFD architecture before touching anything.
const desktop = input('apps/web/src/components/monitor/ProfessionalDashboard.tsx');
if (!desktop.normal.includes('<B787PrimaryFlightDisplay telemetry={t} live={live} />')) {
  throw new Error('The desktop monitor has not been connected to the mobile PFD component. Apply the corrected web-PFD patch first.');
}
const mobile = input('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx');
const importNew = "import { displayAttitude } from '../../telemetry/attitudePresentation';";
const originalTransform = /const transform\s*=\s*attitude\s*\?\s*horizonTransform\(attitude,\s*272,\s*176,\s*PFD_PITCH_PIXELS_PER_DEGREE\)\s*:\s*(['\"])\1;/;
const newTransform = "const attitudeForDisplay = displayAttitude(attitude, telemetry.onGround, telemetry.groundSpeedKnots);\n  const transform = attitudeForDisplay ? horizonTransform(attitudeForDisplay, 272, 176, PFD_PITCH_PIXELS_PER_DEGREE) : '';";
let mobileText = mobile.normal;
if (!mobileText.includes('attitudeForDisplay = displayAttitude(')) {
  mobileText = replaceOne(mobileText, originalTransform, newTransform, 'shared mobile PFD transform');
  if (mobileText.includes(importNew)) throw new Error('Display attitude import exists without its transform; refusing partial install.');
  mobileText = replaceOne(mobileText,
    "import { PFD_PITCH_PIXELS_PER_DEGREE, radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    "import { PFD_PITCH_PIXELS_PER_DEGREE, radioAltitudeFeet } from '../../telemetry/instrumentScale';\n" + importNew,
    'instrument scale import');
  stage(mobile, mobileText);
} else if (!mobileText.includes(importNew)) throw new Error('Incomplete earlier install detected in mobile PFD.');

const cssFile = input('apps/web/src/styles/professional-dashboard.css');
const css = fs.readFileSync(path.join(__dirname, '..', 'payload', 'map-fill.css'), 'utf8').replace(/\r\n/g, '\n');
const cssMarker = '/* XMC map-height fix:';
if (!cssFile.normal.includes(cssMarker)) stage(cssFile, cssFile.normal.replace(/\s*$/, '') + '\n\n' + css);

// Strictly verify existing module consistency; only then stage new files.
newFile('apps/web/src/telemetry/attitudePresentation.ts', 'attitudePresentation.ts');
newFile('apps/web/src/telemetry/attitudePresentation.test.ts', 'attitudePresentation.test.ts');

if (dryRun) {
  console.log(`PRECHECK PASSED: ${jobs.length} files to update.`);
  for (const j of jobs) console.log(`${j.kind === 'edit' ? 'WILL UPDATE' : 'WILL ADD'} ${j.rel}`);
  process.exit(0);
}
if (!jobs.length) { console.log('ALREADY INSTALLED'); process.exit(0); }
const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
const backups = [];
try {
  // All source checks completed above. Back up every modified file before writes.
  for (const j of jobs.filter(j => j.kind === 'edit')) {
    const bak = `${j.absolute}.before-map-level-${stamp}.bak`;
    fs.copyFileSync(j.absolute, bak, fs.constants.COPYFILE_EXCL);
    backups.push({original:j.absolute, backup:bak});
  }
  for (const j of jobs) {
    fs.mkdirSync(path.dirname(j.absolute), {recursive:true});
    fs.writeFileSync(j.absolute, j.next, {encoding:'utf8',flag:j.kind === 'create' ? 'wx' : 'w'});
    console.log(`${j.kind === 'edit' ? 'UPDATED' : 'ADDED'} ${j.rel}`);
  }
} catch (err) {
  for (const b of backups) fs.copyFileSync(b.backup,b.original);
  for (const j of jobs.filter(j => j.kind === 'create')) {
    if (fs.existsSync(j.absolute)) fs.rmSync(j.absolute);
  }
  throw err;
}
console.log('GROUND LEVEL AND FULL-HEIGHT AVIATION MAP PATCH INSTALLED');
