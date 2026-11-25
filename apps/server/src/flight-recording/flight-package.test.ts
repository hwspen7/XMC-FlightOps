import { describe,expect,it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { FlightPackageRecorder } from './flight-package';
import { emptyTelemetry } from '../xplane/telemetry';
import type { SimulatorStatus, ControlMonitor } from '@xplane/shared';
const control:ControlMonitor={framesAccepted:0,lastFrameAgeMs:null,timeoutMs:350,inputRoll:null,inputPitch:null,tiltRollDegrees:null,tiltPitchDegrees:null,sensorRateHz:null,inputRateHz:0,lastAction:null,lastActionAt:null,throttleCommand:null};
const sim=(at:number,onGround:number,gs:number):SimulatorStatus=>({reachable:true,telemetryFresh:true,outputEnabled:false,host:'127.0.0.1',port:49000,receivedFields:3,subscribedFields:3,lastHeartbeatAgeMs:0,simPaused:false,telemetry:{...emptyTelemetry(),receivedAt:at,onGround,groundSpeedKnots:gs,aircraftIcao:'TEST'}});
describe('streaming flight package recorder',()=>{
 it('includes bounded preflight, distinct samples and finalized footer without armed controller',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'xmc-flight-'));
  try{
   const recorder=new FlightPackageRecorder(dir,()=>{},false);
   recorder.capture(sim(1000,1,0),control,1000);recorder.capture(sim(1100,1,3),control,1100);
   recorder.capture(sim(1100,1,3),control,1150);recorder.capture(sim(1200,0,100),control,1200);recorder.finish('test');
   let name:string|undefined;
   for(let i=0;i<100&&!name;i++){await new Promise(r=>setTimeout(r,10));name=readdirSync(dir).find(n=>n.endsWith('.jsonl'));}
   expect(name).toBeDefined();const rows=readFileSync(join(dir,name!),'utf8').trim().split('\n').map(l=>JSON.parse(l));
   expect(rows[0].preflightSamples).toBe(1);expect(rows.filter(r=>r.type==='sample').map(r=>r.at)).toEqual([1000,1100,1200]);expect(rows.at(-1).samples).toBe(3);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
describe('compressed archives and source sequence accounting',()=>{
 it('keeps a single compressed finalized archive and does not count pause snapshots as loss',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'xmc-gzip-'));
  try{
   const recorder=new FlightPackageRecorder(dir,()=>{},true);
   const native=(seq:number,paused=false)=>({...sim(1000+seq*25,0,100),transport:'native' as const,simPaused:paused,telemetry:{...sim(1000+seq*25,0,100).telemetry,nativeSampleSequence:seq,nativeSampleTimeUs:100000+seq*25000}});
   recorder.capture(native(1),control,1025);
   recorder.capture(native(2,true),control,1050);
   recorder.capture(native(3,true),control,1075);
   recorder.capture(native(4),control,1100);
   recorder.capture(native(6),control,1150);
   recorder.finish('test');
   let name:string|undefined;
   for(let i=0;i<200&&!name;i++){await new Promise(r=>setTimeout(r,10));name=readdirSync(dir).find(n=>n.endsWith('.jsonl.gz'));}
   expect(name).toBeDefined();
   const rows=gunzipSync(readFileSync(join(dir,name!))).toString('utf8').trim().split('\n').map(l=>JSON.parse(l));
   expect(rows.filter(r=>r.type==='sample').length).toBe(3);
   expect(rows.at(-1)).toMatchObject({nativeMissingPackets:1,intentionallySkippedPausedPackets:2,samples:3});
   expect(readdirSync(dir).filter(n=>n.endsWith('.jsonl'))).toHaveLength(0);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
