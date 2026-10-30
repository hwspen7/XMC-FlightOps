/*
 * Precision attitude-ladder update for the existing XPlane Motion Controller.
 * Uses checked, one-time source replacements rather than overwriting unrelated
 * mobile and desktop instrument customizations. No network calls.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const jobs = [];
const file = p => path.join(root, p);

function prepare(relative, transform) {
  const absolute = file(relative);
  if (!fs.existsSync(absolute)) throw new Error(`Required source missing: ${relative}`);
  const before = fs.readFileSync(absolute, 'utf8');
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  let after = before.replace(/\r\n/g, '\n');
  if (after.includes('import { PitchLadder }') && after.includes('<PitchLadder ')) {
    console.log(`ALREADY PATCHED ${relative}`);
    return;
  }
  const initial = after;
  const replace = (needle, replacement, description) => {
    const hits = needle instanceof RegExp ? [...after.matchAll(new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g'))].length
      : after.split(needle).length - 1;
    if (hits !== 1) throw new Error(`${relative}: ${description} expected once, found ${hits}`);
    after = after.replace(needle, replacement);
  };
  transform(replace, () => after);
  if (after === initial) throw new Error(`${relative}: no changes found`);
  jobs.push({ absolute, relative, before, after: newline === '\r\n' ? after.replace(/\n/g, '\r\n') : after });
}

const ladderImport = "import { PitchLadder } from '../monitor/PitchLadder';";
const compactFlag = (x, y, width = 96) => `<g aria-label="Attitude information unavailable"><rect x="${x}" y="${y}" width="${width}" height="30" rx="3" fill="#141b24" stroke="#edb464" strokeWidth="1.4"/><text x="${x + width/2}" y="${y + 20}" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffcf83">ATT DATA</text></g>`;

prepare('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx', (replace) => {
  replace("import { PITCH_TICKS, pitchMark, radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    "import { radioAltitudeFeet } from '../../telemetry/instrumentScale';\n" + ladderImport,
    'mobile PFD geometry import');
  replace(/\{PITCH_TICKS\.filter\(deg => Math\.abs\(deg\) <= 40\)\.map\(deg => \{[\s\S]*?\n\s*\}\)\}/,
    '<PitchLadder pixelsPerDegree={3.6} maxAbsDegrees={40}/>', 'mobile PFD pitch scale');
  replace(/\{!attitude && <g><rect x="136"[\s\S]*?<\/g>\}/,
    `{!attitude && ${compactFlag(231, 154, 82)}}`, 'mobile PFD no-data label');
});

prepare('apps/web/src/components/mobile/MotionAttitude.tsx', (replace) => {
  replace("import { PITCH_TICKS, pitchMark, radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    "import { radioAltitudeFeet } from '../../telemetry/instrumentScale';\n" + ladderImport,
    'mobile round attitude geometry import');
  replace(/\{PITCH_TICKS\.filter\(degree => Math\.abs\(degree\) <= 40\)\.map\(degree => \{[^\n]*\}\)\}/,
    '<PitchLadder pixelsPerDegree={3.6} maxAbsDegrees={40}/>', 'round attitude pitch scale');
  replace(/\{!attitude && \(\s*<g>[\s\S]*?<\/g>\s*\)\}/,
    `{!attitude && <g><circle cx="180" cy="172" r="142" fill="#0b1e2e"/>${compactFlag(134, 156, 92)}</g>}`, 'round attitude no-data label');
});

prepare('apps/web/src/components/monitor/FlightDisplay.tsx', (replace) => {
  replace("import { PITCH_TICKS, pitchMark, radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    "import { radioAltitudeFeet } from '../../telemetry/instrumentScale';\nimport { PitchLadder } from './PitchLadder';",
    'desktop detailed PFD geometry import');
  replace(/^const PITCH_MARKS = .*;\n/m, '', 'desktop PFD redundant pitch definitions');
  replace(/\{PITCH_MARKS\.map\(\(degree\) => \{[\s\S]*?\n\s*\}\)\}/,
    '<PitchLadder pixelsPerDegree={3.6} maxAbsDegrees={40}/>', 'desktop PFD pitch scale');
  replace('          <rect x="24" y="48" width="116" height="265" fill="#283443"',
    `          {!attitude && <g><rect x="148" y="48" width="464" height="265" fill="#091b29"/>${compactFlag(333, 170, 94)}</g>}\n          <rect x="24" y="48" width="116" height="265" fill="#283443"`,
    'desktop PFD stale attitude blanking');
});

prepare('apps/web/src/components/monitor/ProfessionalDashboard.tsx', (replace) => {
  replace("import { PITCH_TICKS, pitchMark, radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    "import { radioAltitudeFeet } from '../../telemetry/instrumentScale';\nimport { PitchLadder } from './PitchLadder';",
    'compact monitor PFD geometry import');
  replace('  const bank = okay(roll) ? Math.max(-180, Math.min(180, roll)) : 0;',
    '  const attitudeValid = okay(roll) && okay(pitch);\n  const bank = okay(roll) ? Math.max(-180, Math.min(180, roll)) : 0;',
    'compact monitor attitude validity check');
  replace('{PITCH_TICKS.filter(n=>Math.abs(n)<=40).map(n=>{const mark=pitchMark(n),w=mark.halfWidth*.66,y=117-n*3.6;return <g key={n} stroke="#eef7ff" fill="#eef7ff"><path d={`M${200-w} ${y}H${200-11} M${200+11} ${y}H${200+w}`} strokeWidth={mark.strokeWidth}/>{mark.label&&<><text x={200-w-8} y={y+3} fontSize="9" textAnchor="end" stroke="none">{Math.abs(n)}</text><text x={200+w+8} y={y+3} fontSize="9" stroke="none">{Math.abs(n)}</text></>}</g>})}',
    '<PitchLadder centerX={200} centerY={117} pixelsPerDegree={3.6} scale={.66} maxAbsDegrees={40}/>',
    'compact monitor PFD pitch scale');
  replace('    <path d="M143 123H188L200 132L212 123H257 M200 118V148"',
    `    {!attitudeValid && <g><rect x="62" y="10" width="276" height="215" rx="8" fill="#091d2c"/>${compactFlag(156, 67, 88)}</g>}\n    <path d="M143 123H188L200 132L212 123H257 M200 118V148"`,
    'compact monitor stale attitude blanking');
  replace(/\{!live && <g><rect x="95"[\s\S]*?<\/g>\}/, '', 'old oversized compact PFD warning');
});

// All anchors were validated before modifying any existing file.
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
for (const job of jobs) {
  const backup = `${job.absolute}.before-attitude-${stamp}.bak`;
  fs.copyFileSync(job.absolute, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(job.absolute, job.after, 'utf8');
  console.log(`UPDATED ${job.relative} (backup: ${path.basename(backup)})`);
}
console.log(`PRECISION ATTITUDE FIX APPLIED: ${jobs.length} files, mobile and desktop synchronized`);
