'use strict';
/* Safely changes one shared mobile/desktop PFD and its shared pitch constant. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv.find(x => x.startsWith('--repository='))?.slice('--repository='.length) || process.cwd());
const dry = process.argv.includes('--check');
const jobs=[];
function open(rel){
  const target=path.join(root,rel);
  if(!fs.existsSync(target))throw Error(`Required file missing: ${rel}`);
  const raw=fs.readFileSync(target,'utf8');
  return {rel,target,raw,text:raw.replace(/\r\n/g,'\n'),crlf:raw.includes('\r\n')};
}
function stage(f,next){if(next!==f.text)jobs.push({...f,next:f.crlf?next.replace(/\n/g,'\r\n'):next});}
function once(s,a,b,desc){
  const hits=typeof a==='string'?s.split(a).length-1:[...s.matchAll(new RegExp(a.source,a.flags.includes('g')?a.flags:a.flags+'g'))].length;
  if(hits!==1)throw Error(`Source mismatch: ${desc} (expected 1, found ${hits}). No files modified.`);
  return s.replace(a,b);
}

const mobile=open('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx');
if(!mobile.text.includes('export function B787PrimaryFlightDisplay') || !mobile.text.includes('<PitchLadder ')){
  throw Error('The mobile PFD shared component is missing. Apply the prior precision-attitude patch first.');
}
const desktop=open('apps/web/src/components/monitor/ProfessionalDashboard.tsx');
if(!desktop.text.includes('<B787PrimaryFlightDisplay telemetry={t} live={live} />')){
  throw Error('The desktop monitor is not using the mobile PFD yet. Apply the corrected web-PFD patch first.');
}
const scale=open('apps/web/src/telemetry/instrumentScale.ts');
let scaleText=scale.text;
if(!scaleText.includes('PFD_PITCH_PIXELS_PER_DEGREE')){
  scaleText='/** Unified mobile and desktop attitude horizon pitch scale. */\nexport const PFD_PITCH_PIXELS_PER_DEGREE = 3.6;\n'+scaleText;
  stage(scale,scaleText);
}

let updated=mobile.text;
if(!updated.includes('XMC top heading band v4:')){
  updated=once(updated,
    "import { radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    "import { PFD_PITCH_PIXELS_PER_DEGREE, radioAltitudeFeet } from '../../telemetry/instrumentScale';",
    'instrument scale import');
  updated=once(updated,
    /horizonTransform\(attitude,\s*272,\s*176,\s*(?:4\.0|3\.6)\)/,
    'horizonTransform(attitude, 272, 176, PFD_PITCH_PIXELS_PER_DEGREE)',
    'shared horizon pitch scale');
  updated=once(updated,
    /<PitchLadder\s+pixelsPerDegree=\{3\.6\}\s+maxAbsDegrees=\{40\}\s*\/>/,
    '<PitchLadder pixelsPerDegree={PFD_PITCH_PIXELS_PER_DEGREE} maxAbsDegrees={40}/>',
    'matching pitch ladder scale');
  updated=once(updated,
    /x:\s*315\s*\+\s*\(angle\s*-\s*headingNormalized\)\s*\*\s*2\.25/,
    'x: 272 + (angle - headingNormalized) * 2.25',
    'top compass geometry');
  const start=updated.indexOf('      {/* XMC PFD footband v3:');
  const end=updated.lastIndexOf('\n    </svg>');
  if(start===-1 || end===-1 || end<=start){throw Error('Footband v3 boundaries not found. No files modified.');}
  const footer=fs.readFileSync(path.join(__dirname,'../payload/top-heading-footer.tsx.inc'),'utf8').replace(/\r\n/g,'\n').trimEnd();
  updated=updated.slice(0,start)+footer+updated.slice(end);
  stage(mobile,updated);
} else {
  if(!updated.includes('PFD_PITCH_PIXELS_PER_DEGREE'))throw Error('Top heading marker exists but pitch scale is missing');
}

if(dry){console.log(`PRECHECK PASSED; files to update: ${jobs.length}`);for(const j of jobs)console.log('WILL UPDATE '+j.rel);process.exit(0);}
if(!jobs.length){console.log('ALREADY INSTALLED');process.exit(0);}
const stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
for(const j of jobs){j.backup=j.target+`.before-top-heading-${stamp}.bak`;fs.copyFileSync(j.target,j.backup,fs.constants.COPYFILE_EXCL);}
try{
  for(const j of jobs){fs.writeFileSync(j.target,j.next,'utf8');console.log('UPDATED '+j.rel);}
}catch(e){for(const j of jobs)fs.copyFileSync(j.backup,j.target);throw e;}
console.log('TOP HEADING AND SHARED PITCH SCALE INSTALLED');
