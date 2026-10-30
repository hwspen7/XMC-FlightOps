'use strict';
/*
 * Installs the shared mobile/desktop PFD fixes without overwriting unrelated code.
 * --check validates all file anchors and reports pending changes without writes.
 */
const fs = require('node:fs');
const path = require('node:path');

const dryRun = process.argv.includes('--check');
const repo = path.resolve(process.argv.find(arg => arg.startsWith('--repository='))?.slice('--repository='.length) ?? process.cwd());
const pack = path.resolve(__dirname, '..');
const jobs = [];
function file(relative) {
  const filename = path.join(repo, relative);
  if (!fs.existsSync(filename)) throw Error('Required source not found: ' + relative);
  const before = fs.readFileSync(filename, 'utf8');
  return { relative, filename, before, normal: before.replace(/\r\n/g, '\n'), crlf: before.includes('\r\n') };
}
function stage(original, text) {
  if (text === original.normal) return;
  jobs.push({ ...original, next: original.crlf ? text.replace(/\n/g, '\r\n') : text });
}
function exactReplaceOnce(text, pattern, replacement, label) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))];
  if (matches.length !== 1) throw Error(label + ': expected one match, found ' + matches.length + '. No files modified.');
  return text.replace(pattern, replacement);
}

const monitor = file('apps/web/src/components/monitor/ProfessionalDashboard.tsx');
if (!monitor.normal.includes('<B787PrimaryFlightDisplay telemetry={t} live={live} />')) {
  throw Error('Desktop overview is not yet using the same B787PrimaryFlightDisplay as mobile; apply the corrected web-PFD patch first. No files modified.');
}

// The root defect was a row of elaborate chevrons added to the negative-pitch ticks.
// Replace the shared ladder entirely, so all existing clients keep the same data.
{
  const target = file('apps/web/src/components/monitor/PitchLadder.tsx');
  if (!target.normal.includes('export function PitchLadder')) throw Error('Shared pitch ladder component missing. No files modified.');
  const content = fs.readFileSync(path.join(pack, 'payload/PitchLadder.tsx'), 'utf8').replace(/\r\n/g, '\n');
  stage(target, content);
}

// Rewrite the *single* mobile/desktop PFD footer, not the aircraft motion model.
{
  const target = file('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx');
  let code = target.normal;
  if (!code.includes('XMC PFD footband v3:')) {
    if (!code.includes('export function B787PrimaryFlightDisplay') || !code.includes('<PitchLadder ')) {
      throw Error('Mobile PFD does not match the installed shared instrument version. No files modified.');
    }
    if (!code.includes('radioAltitudeFeet')) {
      code = exactReplaceOnce(code,
        /^import \{ horizonTransform, liveAircraftAttitude \} from '\.\.\/\.\.\/telemetry\/attitude';$/m,
        "$&\nimport { radioAltitudeFeet } from '../../telemetry/instrumentScale';",
        'AGL helper import');
    }
    code = exactReplaceOnce(code,
      /x:\s*272\s*\+\s*\(angle\s*-\s*headingNormalized\)\s*\*\s*2\.25/,
      'x: 315 + (angle - headingNormalized) * 2.25',
      'heading scale centroid');
    const first = '      <rect x="0" y="320" width="640" height="45" fill="#071723"/>';
    const a = code.indexOf(first);
    const b = code.lastIndexOf('\n    </svg>');
    if (a < 0 || b < a || code.indexOf(first, a+1) !== -1) {
      throw Error('Instrument footer anchors did not match; no files modified.');
    }
    const footer = `      {/* XMC PFD footband v3: separate GS, terrain-relative AGL, heading and aircraft state. */}
      <rect x="0" y="320" width="640" height="45" fill="#071723"/>
      <rect x="0" y="320" width="99" height="45" fill="#092032"/>
      <text x="9" y="334" fill="#70cef7" fontSize="10">GS / KT</text>
      <text x="10" y="357" fill="#e6faff" fontSize="17" fontWeight="750">{fmt(telemetry.groundSpeedKnots,live)}</text>
      <rect x="99" y="320" width="86" height="45" fill="#0c2739"/>
      <path d="M99 321V364M185 321V364" stroke="#385c74"/>
      <text x="109" y="334" fill="#70cef7" fontSize="10">AGL / FT</text>
      <text x="110" y="357" fill="#f4efd0" fontSize="17" fontWeight="750">
        {radioAltitudeFeet(telemetry.aglFeet,live) === null ? '---' : radioAltitudeFeet(telemetry.aglFeet,live)}
      </text>
      <rect x="185" y="320" width="260" height="45" fill="#0a192a"/>
      <g aria-label="Heading scale with separate digital readout">
        {compassTicks.map(({angle,x,major}) => x>189 && x<439 && <g key={angle}>
          <path d={\`M\${x} 322v\${major?8:4}\`} stroke="#8ed2f0" strokeWidth={major?1.5:1}/>
          {major && <text x={x} y="338" textAnchor="middle" fill="#c6e9fa" fontSize="10" fontWeight="700">
            {angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : angle === 270 ? 'W' : String(angle/10).padStart(2,'0')}
          </text>}
        </g>)}
        <path d="M315 322l-6 9h12z" fill="#e8d978"/>
        <rect x="275" y="345" rx="3" width="80" height="18" fill="#06101d" stroke="#597c98"/>
        <text x="315" y="359" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">
          {headingNormalized === null ? '---' : Math.round(headingNormalized).toString().padStart(3,'0')}°
        </text>
      </g>
      <rect x="445" y="320" width="195" height="45" fill="#092032"/>
      <text x="455" y="334" fill="#70cef7" fontSize="9">BANK</text>
      <text x="455" y="354" fill="#e6faff" fontSize="12">{fmt(attitude?.roll ?? null,Boolean(attitude),1)}°</text>
      <text x="518" y="334" fill="#70cef7" fontSize="9">PITCH</text>
      <text x="518" y="354" fill="#e6faff" fontSize="12">{fmt(attitude?.pitch ?? null,Boolean(attitude),1)}°</text>
      <text x="588" y="334" fill="#70cef7" fontSize="9">MACH</text>
      <text x="588" y="354" fill="#e6faff" fontSize="12">{fmt(telemetry.machNumber,live,2)}</text>`;
    code = code.slice(0,a) + footer + code.slice(b);
    stage(target, code);
  }
}

// Resize desktop overview cards without changing mobile layout or stretching the SVG.
{
  const target = file('apps/web/src/styles/professional-dashboard.css');
  let code = target.normal;
  const banner = '/* XMC PFD alignment / wide-card layout, shared mobile PFD in web monitor. */';
  if (!code.includes(banner)) {
    code += '\n' + fs.readFileSync(path.join(pack, 'payload/pfd-panel-overrides.css'), 'utf8').replace(/\r\n/g, '\n');
    stage(target, code);
  }
}

if (dryRun) {
  console.log(`PRECHECK PASSED: ${jobs.length} files will be updated.`);
  for (const job of jobs) console.log('WILL UPDATE ' + job.relative);
  process.exit(0);
}
if (!jobs.length) {
  console.log('ALREADY INSTALLED');
  process.exit(0);
}
// All pattern checks have succeeded. Backup every affected file before first write.
const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
for (const job of jobs) {
  job.backup = `${job.filename}.before-pfd-geometry-${stamp}.bak`;
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
console.log('PFD GEOMETRY AND LAYOUT INSTALLED. C++ plugin unchanged.');
