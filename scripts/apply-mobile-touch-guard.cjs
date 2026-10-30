'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const jobs = [];
function prepare(relative, getAfter) {
  const absolute = path.join(repo, relative);
  if (!fs.existsSync(absolute)) throw new Error(`Missing required file: ${relative}`);
  const before = fs.readFileSync(absolute, 'utf8');
  const normalized = before.replace(/\r\n/g, '\n');
  const after = getAfter(normalized);
  if (normalized === after) { console.log(`ALREADY INSTALLED ${relative}`); return; }
  jobs.push({ relative, absolute, before, after: before.includes('\r\n') ? after.replace(/\n/g, '\r\n') : after });
}

prepare('apps/web/src/main.tsx', text => {
  const importLine = "import './styles/mobile-touch-guard.css';";
  if (text.includes(importLine)) return text;
  const marker = "import './styles/mobile-ground-turn-refinement.css';";
  if (text.split(marker).length !== 2) throw new Error('main.tsx styles import anchor missing or ambiguous');
  return text.replace(marker, marker + '\n' + importLine);
});

prepare('apps/web/src/views/MobileCockpit.tsx', text => {
  if (text.includes('onContextMenu={(event) => {') && text.includes('target.closest(\'input, textarea, select, [contenteditable], [role="textbox"]\')')) return text;
  const marker = 'return <div className="mobile-cockpit fd-layout">';
  if (text.split(marker).length !== 2) throw new Error('MobileCockpit root container anchor missing or ambiguous');
  // Context menu cancellation only within the flight-deck surface; editable controls remain available.
  const modified = `return <div className="mobile-cockpit fd-layout" onContextMenu={(event) => {
    const target = event.target;
    if (target instanceof Element && !target.closest('input, textarea, select, [contenteditable], [role="textbox"]')) {
      event.preventDefault();
    }
  }}>`;
  return text.replace(marker, modified);
});

// All anchors are checked before any modifications are written.
if (!jobs.length) { console.log('MOBILE TOUCH GUARD ALREADY INSTALLED'); process.exit(0); }
const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0, 14);
for (const job of jobs) {
  const backup = `${job.absolute}.before-touch-guard-${stamp}.bak`;
  fs.copyFileSync(job.absolute, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(job.absolute, job.after, 'utf8');
  console.log(`UPDATED ${job.relative} (backup: ${path.basename(backup)})`);
}
console.log('MOBILE TOUCH GUARD INSTALLED');
