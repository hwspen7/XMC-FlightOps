'use strict';
/**
 * In-place upgrade: both desktop overview and mobile share one PFD component.
 * All source anchors are checked before any modifications are written.
 */
const fs = require('node:fs');
const path = require('node:path');
const repo = process.cwd();
const dryRun = process.argv.includes('--check');
const jobs = [];

function source(relative) {
  const filename = path.join(repo, relative);
  if (!fs.existsSync(filename)) throw new Error(`Required source missing: ${relative}`);
  const before = fs.readFileSync(filename, 'utf8');
  return { relative, filename, before, text: before.replace(/\r\n/g, '\n'), crlf: before.includes('\r\n') };
}
function once(text, pattern, replacement, name) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`${name}: expected one match, found ${matches.length}. No files have been modified.`);
  return text.replace(pattern, replacement);
}
function stage(file, next) {
  if (next !== file.text) jobs.push({
    ...file,
    next: file.crlf ? next.replace(/\n/g, '\r\n') : next,
  });
}

// Verify the component being reused actually exists in the installed workspace.
const mobilePfd = source('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx');
if (!mobilePfd.text.includes('export function B787PrimaryFlightDisplay')) {
  throw new Error('Mobile PFD component missing; cannot safely reuse it in the desktop monitor.');
}

// Desktop: remove separate attitude SVG and render the *same* React component used on the phone.
{
  const file = source('apps/web/src/components/monitor/ProfessionalDashboard.tsx');
  let text = file.text;
  const importLine = "import { B787PrimaryFlightDisplay } from '../mobile/B787PrimaryFlightDisplay';";
  if (!text.includes(importLine)) {
    text = once(text, /^import \{ SpatialMonitor \} from '\.\/SpatialMonitor';$/m, `$&\n${importLine}`, 'PFD import');
  }
  const alreadyReused = text.includes('<B787PrimaryFlightDisplay telemetry={t} live={live} />');
  if (!alreadyReused) {
    text = once(text, /function Horizon\(\{ t, live \}: \{ t: FlightTelemetry; live: boolean \}\) \{[\s\S]*?\n\}\n(?=function Engine\()/,
`function Horizon({ t, live }: { t: FlightTelemetry; live: boolean }) {
  // Both screens use the same flight data and identical PFD rendering code.
  return <div className="xpd-pfd xpd-pfd-mobile-clone">
    <B787PrimaryFlightDisplay telemetry={t} live={live} />
  </div>;
}
`, 'desktop Horizon replacement');
  }
  // These imports belong only to the removed duplicate horizon; preserve all other modules.
  for (const unused of [
    "import { radioAltitudeFeet } from '../../telemetry/instrumentScale';\n",
    "import { PitchLadder } from './PitchLadder';\n",
  ]) {
    if (text.includes(unused)) text = text.replace(unused, '');
  }
  stage(file, text);
}

// Recorder: add a clearly named JSON export suitable for the offline Python report.
{
  const file = source('apps/web/src/components/monitor/FlightRecorder.tsx');
  let text = file.text;
  const exported = text.includes('EXPORT PYTHON JSON');
  const declaration = text.includes('const pythonJson=');
  if (exported !== declaration) {
    throw new Error('The Python-export button and handler are inconsistent. Inspect FlightRecorder.tsx; no files were modified.');
  }
  if (!exported) {
    text = once(text, /^(\s*const csv=\(\)=>\{[^\n]*\};)$/m,
      "$1\n const pythonJson=()=>exportFile('xplane-flight-record.python.json',JSON.stringify(archive,null,2));",
      'CSV export function');
    text = once(text, /<button disabled=\{!archive\.samples\.length\} onClick=\{csv\}>EXPORT CSV<\/button>/,
      '$&<button disabled={!archive.samples.length} onClick={pythonJson}>EXPORT PYTHON JSON</button>',
      'Python export button placement');
  }
  stage(file, text);
}

// Scope desktop sizing to the reused mobile instrument without changing mobile layout.
{
  const file = source('apps/web/src/styles/professional-dashboard.css');
  let text = file.text;
  if (!text.includes('/* XMC shared mobile PFD in desktop overview */')) {
    text += `
/* XMC shared mobile PFD in desktop overview */
.xpd-pfd-mobile-clone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 4px 0;
}
.xpd-pfd-mobile-clone .xmc-pfd {
  width: 100%;
  height: auto;
  min-height: 0;
  aspect-ratio: 640 / 365;
}
.xpd-pfd-mobile-clone .xmc-pfd svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: none;
}
`;
  }
  stage(file, text);
}

if (dryRun) {
  console.log(`PRECHECK PASSED: ${jobs.length} source files need updating.`);
  for (const job of jobs) console.log('WILL UPDATE ' + job.relative);
  process.exit(0);
}
if (jobs.length === 0) {
  console.log('ALREADY INSTALLED: no changes necessary.');
  process.exit(0);
}
// Back up all files before any source file is modified.
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
for (const job of jobs) {
  job.backup = job.filename + `.before-web-pfd-${stamp}.bak`;
  fs.copyFileSync(job.filename, job.backup, fs.constants.COPYFILE_EXCL);
}
try {
  for (const job of jobs) {
    fs.writeFileSync(job.filename, job.next, 'utf8');
    console.log('UPDATED ' + job.relative);
  }
} catch (error) {
  for (const job of jobs) fs.copyFileSync(job.backup, job.filename);
  throw error;
}
console.log(`WEB PFD / PYTHON EXPORT PATCH INSTALLED: ${jobs.length} files.`);
