'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
for (const [rel, keys] of [
  ['apps/web/src/main.tsx', ["import './styles/mobile-touch-guard.css';"]],
  ['apps/web/src/views/MobileCockpit.tsx', ['onContextMenu={(event) => {', "target.closest('input, textarea, select, [contenteditable], [role=\"textbox\"]')"]],
  ['apps/web/src/styles/mobile-touch-guard.css', ['-webkit-touch-callout: none;', '-webkit-user-select: none;', '-webkit-user-select: text;']],
]) {
  const filename = path.join(repo, rel);
  if (!fs.existsSync(filename)) throw new Error(`Missing ${rel}`);
  const text = fs.readFileSync(filename,'utf8');
  for (const key of keys) if (!text.includes(key)) throw new Error(`${rel}: missing ${key}`);
  console.log(`VERIFIED ${rel}`);
}
console.log('MOBILE TOUCH GUARD VERIFICATION PASSED');
