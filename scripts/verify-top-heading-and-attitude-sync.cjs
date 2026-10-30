'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(process.argv.find(x=>x.startsWith('--repository='))?.slice('--repository='.length)||process.cwd());
function check(p,patterns){const t=fs.readFileSync(path.join(root,p),'utf8');for(const s of patterns){if(!t.includes(s))throw Error(`Verification failed: ${p} does not contain ${s}`);}console.log('VERIFIED '+p);return t;}
const pfd=check('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx',['XMC top heading band v4:', 'Magnetic heading scale above the attitude display','horizonTransform(attitude, 272, 176, PFD_PITCH_PIXELS_PER_DEGREE)','<PitchLadder pixelsPerDegree={PFD_PITCH_PIXELS_PER_DEGREE} maxAbsDegrees={40}/>','x: 272 + (angle - headingNormalized) * 2.25','AGL / FT','GS / KT']);
if(pfd.includes('XMC PFD footband v3:') || pfd.includes('<rect x="275" y="345"'))throw Error('Obsolete bottom heading scale still present');
check('apps/web/src/telemetry/instrumentScale.ts',['export const PFD_PITCH_PIXELS_PER_DEGREE = 3.6;']);
check('apps/web/src/components/monitor/ProfessionalDashboard.tsx',['<B787PrimaryFlightDisplay telemetry={t} live={live} />']);
console.log('TOP HEADING / MOBILE-DESKTOP PFD ALIGNMENT VERIFIED');
