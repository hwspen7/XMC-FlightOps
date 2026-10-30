'use strict';
const fs = require('node:fs');
const path = require('node:path');

const repo = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const jobs = [];

function read(relative) {
  const absolute = path.join(repo, relative);
  if (!fs.existsSync(absolute)) throw new Error(`Missing source file: ${relative}`);
  const before = fs.readFileSync(absolute, 'utf8');
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  return { absolute, before, normalized: before.replace(/\r\n/g, '\n'), newline };
}
function writeJob(relative, afterNormalized, original) {
  jobs.push({
    relative,
    absolute: original.absolute,
    before: original.before,
    after: original.newline === '\r\n' ? afterNormalized.replace(/\n/g, '\r\n') : afterNormalized,
  });
}
function replaceOne(text, needle, replacement, label) {
  const count = needle instanceof RegExp
    ? [...text.matchAll(new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g'))].length
    : text.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label} expected once, found ${count}`);
  return text.replace(needle, replacement);
}
function maybeReplace(text, needle, replacement) {
  const count = needle instanceof RegExp
    ? [...text.matchAll(new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g'))].length
    : text.split(needle).length - 1;
  if (count === 0) return text;
  if (count !== 1) throw new Error(`Optional pattern expected at most once, found ${count}`);
  return text.replace(needle, replacement);
}

// 1) Shared pitch ladder for both mobile and monitor displays.
{
  const rel = 'apps/web/src/components/monitor/PitchLadder.tsx';
  const src = read(rel);
  const marker = '/* XMC unified attitude ladder v2 */';
  if (!src.normalized.includes(marker)) {
    const content = `import { PITCH_TICKS, pitchMark } from '../../telemetry/instrumentScale';\n\nexport interface PitchLadderProps {\n  centerX?: number;\n  centerY?: number;\n  pixelsPerDegree: number;\n  scale?: number;\n  maxAbsDegrees?: number;\n}\n\nconst GAP = 14;\n\nfunction chevrons(centerX: number, y: number, half: number, scale: number) {\n  const dx = 11 * scale;\n  const dy = 6 * scale;\n  const outer = half + 1 * scale;\n  return <>\n    <path d={\`M\${centerX-outer} \${y}l\${-dx} \${dy}l\${dx*.8} 0m\${-dx*.8} 0l\${dx} \${dy}\`} fill=\"none\" strokeLinecap=\"round\"/>\n    <path d={\`M\${centerX+outer} \${y}l\${dx} \${dy}l\${-dx*.8} 0m\${dx*.8} 0l\${-dx} \${dy}\`} fill=\"none\" strokeLinecap=\"round\"/>\n  </>;\n}\n\n/* XMC unified attitude ladder v2 */\nexport function PitchLadder({\n  centerX = 0, centerY = 0, pixelsPerDegree, scale = 1, maxAbsDegrees = 40,\n}: PitchLadderProps) {\n  const gap = GAP * scale;\n  return <g aria-label=\"Aircraft pitch reference ladder\">\n    {PITCH_TICKS.filter(deg => Math.abs(deg) <= maxAbsDegrees).map(deg => {\n      const mark = pitchMark(deg);\n      const half = mark.halfWidth * scale;\n      const y = centerY - deg * pixelsPerDegree;\n      const labelX = half + 12 * scale;\n      const fontSize = mark.kind === 'major' ? 12 * scale : 10 * scale;\n      const major = mark.kind === 'major';\n      const negative = deg < 0;\n      return <g key={deg} stroke=\"#eff7ff\" fill=\"#eff7ff\" opacity={0.98}>\n        <path\n          d={\`M\${centerX-half} \${y}H\${centerX-gap} M\${centerX+gap} \${y}H\${centerX+half}\`}\n          strokeWidth={mark.strokeWidth * scale}\n          strokeLinecap=\"square\"\n          fill=\"none\"\n        />\n        {major && <>\n          <text x={centerX - labelX} y={y + 4 * scale} stroke=\"none\" fontSize={fontSize}\n            fontWeight=\"700\" textAnchor=\"end\">{Math.abs(deg)}</text>\n          <text x={centerX + labelX} y={y + 4 * scale} stroke=\"none\" fontSize={fontSize}\n            fontWeight=\"700\" textAnchor=\"start\">{Math.abs(deg)}</text>\n        </>}\n        {negative && Math.abs(deg) >= 20 ? chevrons(centerX, y, half, scale) : null}\n      </g>;\n    })}\n  </g>;\n}\n`;
    writeJob(rel, content, src);
  }
}

// 2) Reposition radio-altitude box on the compact professional monitor PFD.
{
  const rel = 'apps/web/src/components/monitor/ProfessionalDashboard.tsx';
  const src = read(rel);
  let out = src.normalized;
  out = maybeReplace(
    out,
    /\{radioAltitudeFeet\(t\.aglFeet,live\)!==null&&<g><rect x="248" y="197" width="83" height="24" rx="4" fill="#061521" fillOpacity="\.95" stroke="#82d7ed"\/><text x="289" y="213" textAnchor="middle" fill="#dcf8ff" fontSize="11" fontWeight="750">RA \{radioAltitudeFeet\(t\.aglFeet,live\)\} FT<\/text><\/g>\}/,
    '{radioAltitudeFeet(t.aglFeet,live)!==null&&<g><rect x="282" y="227" width="100" height="22" rx="4" fill="#061521" fillOpacity=".96" stroke="#82d7ed"/><text x="332" y="242" textAnchor="middle" fill="#dcf8ff" fontSize="11" fontWeight="750">AGL {radioAltitudeFeet(t.aglFeet,live)} FT</text></g>}'
  );
  if (out !== src.normalized) writeJob(rel, out, src);
}

// 3) Add an explicit Python-export button to the recorder/debrief workspace.
{
  const rel = 'apps/web/src/components/monitor/FlightRecorder.tsx';
  const src = read(rel);
  let out = src.normalized;
  if (!out.includes('EXPORT PYTHON JSON')) {
    out = replaceOne(
      out,
      " const csv=()=>{const lines=['timestamp,ias_kt,alt_ft,vs_fpm,bank_deg,pitch_deg,n1_left_pct,n1_right_pct,egt_left_c,egt_right_c,throttle_ratio,flap_ratio,risk,gear,autopilot'];for(const p of archive.samples)lines.push([new Date(p.at).toISOString(),p.ias,p.alt,p.vs,p.bank,p.pitch,p.n1l,p.n1r,p.egtl,p.egtr,p.throttle,p.flap,p.risk,p.gear,p.ap].map(x=>x??'').join(','));exportFile('xplane-flight-record.csv',lines.join('\\r\\n'),'text/csv');};",
      " const csv=()=>{const lines=['timestamp,ias_kt,alt_ft,vs_fpm,bank_deg,pitch_deg,n1_left_pct,n1_right_pct,egt_left_c,egt_right_c,throttle_ratio,flap_ratio,risk,gear,autopilot'];for(const p of archive.samples)lines.push([new Date(p.at).toISOString(),p.ias,p.alt,p.vs,p.bank,p.pitch,p.n1l,p.n1r,p.egtl,p.egtr,p.throttle,p.flap,p.risk,p.gear,p.ap].map(x=>x??'').join(','));exportFile('xplane-flight-record.csv',lines.join('\\r\\n'),'text/csv');};\n const pythonJson=()=>exportFile('xplane-flight-record.python.json',JSON.stringify(archive,null,2));",
      `${rel} python export function`
    );
    out = replaceOne(
      out,
      '<button disabled={!archive.samples.length} onClick={csv}>EXPORT CSV</button>',
      '<button disabled={!archive.samples.length} onClick={csv}>EXPORT CSV</button><button disabled={!archive.samples.length} onClick={pythonJson}>EXPORT PYTHON JSON</button>',
      `${rel} python export button`
    );
    out = out.replace(/<\/div>\s*\{importError&&<div role=\"alert\" className=\"xmc-import-error\">\{importError\}<\/div>\}/, '</div>\n <p className=\"xmc-import-error\" style={{marginTop:6,opacity:.82}}>Use EXPORT PYTHON JSON with analysis/flight_report.py to generate the offline PDF and HTML report.</p>\n {importError&&<div role=\"alert\" className=\"xmc-import-error\">{importError}</div>}');
    writeJob(rel, out, src);
  }
}

if (!jobs.length) {
  console.log('No changes were necessary.');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
for (const job of jobs) {
  const backup = `${job.absolute}.before-unified-attitude-${stamp}.bak`;
  fs.copyFileSync(job.absolute, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(job.absolute, job.after, 'utf8');
  console.log(`UPDATED ${job.relative} (backup: ${path.basename(backup)})`);
}
console.log(`UNIFIED ATTITUDE / PYTHON EXPORT PATCH APPLIED: ${jobs.length} files`);
