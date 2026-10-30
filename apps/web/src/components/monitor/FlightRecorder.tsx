import { useEffect,useMemo,useRef,useState,type ChangeEvent } from 'react';
import type { ServerStatus } from '@xplane/shared';
import { archiveFrom, demonstration, measure, parseArchive,sampleFromServer,type FlightArchive,type RecorderEvent } from '../../telemetry/flightRecorder';
import { phaseLabel,value,type TimelinePoint } from '../../telemetry/flightAnalytics';
import '../../styles/flight-recorder.css';
const exportFile=(filename:string,text:string,mime='application/json')=>{const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const formatTime=(at:number)=>new Date(at).toLocaleTimeString();
function ReplayCharts({archive,index}:{archive:FlightArchive;index:number}){
 const samples=archive.samples,at=samples[index]?.at??0,from=samples[0]?.at??0,span=Math.max(1000,(samples.at(-1)?.at??0)-from);
 const lanes:[string,keyof TimelinePoint,string,string][]=[['AIR DATA','ias','kt','#6ec8f1'],['ALTITUDE','alt','ft','#abb8ff'],['VERTICAL SPEED','vs','fpm','#e9b974'],['ENGINE N1','n1l','%','#71d9a8'],['ADVISORY RISK','risk','/100','#f48f90']];
 return <svg viewBox="0 0 980 420" role="img" aria-label="Synchronized flight replay trends with active playback cursor">{lanes.map(([title,key,unit,color],i)=>{
  const y=20+i*75,vals=samples.map(s=>s[key]).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));const lo=vals.length?Math.min(...vals):0,hi=vals.length?Math.max(...vals):1,pad=Math.max(1,(hi-lo)*.15);
  let path='',connect=false;
  samples.forEach((p,j)=>{if(j%Math.max(1,Math.ceil(samples.length/600))!==0&&j!==index)return;const v=p[key];if(typeof v!=='number'||!Number.isFinite(v)){connect=false;return;}const x=160+(p.at-from)/span*790,yy=y+52-(v-(lo-pad))/(hi-lo+2*pad)*50;path+=`${connect?'L':'M'}${x.toFixed(1)} ${yy.toFixed(1)} `;connect=true;});
  return <g key={key}><rect x="2" y={y} width="975" height="70" rx="5" fill="#11293a" stroke="#34546a"/><text x="12" y={y+24} fontSize="12" fill="#c7dcea">{title}</text><text x="12" y={y+43} fontSize="11" fill="#8eb4c9">{unit}</text><text x="145" y={y+30} fill="#d3e8f2" textAnchor="end" fontSize="12">{value(samples[index]?.[key] as number|null,1)}</text><path d={path} fill="none" stroke={color} strokeWidth="2.2"/><line x1={160+(at-from)/span*790} x2={160+(at-from)/span*790} y1={y} y2={y+70} stroke="#fff" strokeDasharray="4 4"/></g>;
 })}{[0,.25,.5,.75,1].map(f=><text key={f} x={160+790*f} y="415" fontSize="10" textAnchor="middle" fill="#8eaec0">{samples.length?formatTime(from+span*f):'—'}</text>)}</svg>;
}
export function FlightRecorder({status,connected}:{status:ServerStatus;connected:boolean}){
 const [recording,setRecording]=useState(false),[archive,setArchive]=useState<FlightArchive>(()=>archiveFrom([],[],null)),[index,setIndex]=useState(0),[importError,setImportError]=useState('');
 const [playing,setPlaying]=useState(false),[playSpeed,setPlaySpeed]=useState(1);
 const lastSample=useRef<number|null>(null),lastEventId=useRef(0);
 const lastConfiguration=useRef<{phase:number|null;gear:number|null;flap:number|null;ap:number|null}|null>(null);
 const t=status.simulator.telemetry,at=t.receivedAt,advisories=status.simulator.advisoryEvents??[];
 useEffect(()=>{if(!recording||!connected)return;const p=sampleFromServer(status);if(!p||lastSample.current===p.at)return;if(lastSample.current!==null&&p.at-lastSample.current<300)return;
  lastSample.current=p.at;
  const now={phase:t.nativeFlightPhase??null,gear:t.gearHandleDown,flap:t.flapHandleRatio,ap:t.autopilotServosOn};
  const before=lastConfiguration.current;
  const changes:RecorderEvent[]=[];
  if(before){
    if(now.phase!==null&&now.phase!==before.phase)changes.push({at:p.at,kind:'phase',label:`Flight phase: ${phaseLabel(now.phase)}`,detail:'Debounced native phase observation'});
    if(now.gear!==null&&before.gear!==null&&Math.abs(now.gear-before.gear)>.5)changes.push({at:p.at,kind:'configuration',label:`Gear lever ${now.gear>.5?'DOWN':'UP'}`,detail:'Observed lever selection, not lock confirmation'});
    if(now.ap!==null&&before.ap!==null&&Math.abs(now.ap-before.ap)>.5)changes.push({at:p.at,kind:'configuration',label:`Autopilot servos ${now.ap>.5?'ON':'OFF'}`,detail:'Observed servo status, not a decoded guidance mode'});
    if(now.flap!==null&&before.flap!==null&&Math.abs(now.flap-before.flap)>.10)changes.push({at:p.at,kind:'configuration',label:'Flap lever moved',detail:`From ${Math.round(before.flap*100)}% to ${Math.round(now.flap*100)}%`});
  }
  lastConfiguration.current=now;
  setArchive(prev=>({...prev,aircraftIcao:t.aircraftIcao??null,samples:[...prev.samples,p].slice(-36000),events:changes.length?[...prev.events,...changes].slice(-5000):prev.events}));
 },[recording,connected,at]);
 useEffect(()=>{if(!recording)return;const fresh=advisories.filter(e=>e.id>lastEventId.current);if(!fresh.length)return;lastEventId.current=Math.max(...fresh.map(e=>e.id));setArchive(prev=>({...prev,events:[...prev.events,...fresh.map(e=>({at:e.at,kind:'advisory' as const,label:`Advisory ${e.flag+1}: ${e.event}`,detail:'Event forwarded by the native analyzer'}))].slice(-5000)}));},[recording,advisories]);
 useEffect(()=>{if(!playing||recording||archive.samples.length<2)return;
   const start=Date.now(),startAt=archive.samples[Math.min(index,archive.samples.length-1)].at;
   const timer=setInterval(()=>{
     const target=startAt+(Date.now()-start)*playSpeed;
     if(target>=archive.samples[archive.samples.length-1].at){setIndex(archive.samples.length-1);setPlaying(false);return;}
     let lo=0,hi=archive.samples.length-1;
     while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(archive.samples[mid].at<=target)lo=mid;else hi=mid-1;}
     setIndex(lo);
   },100);
   return ()=>clearInterval(timer);
 },[playing,recording,archive.samples,playSpeed]);
 const stats=useMemo(()=>measure(archive.samples),[archive.samples]);const current=archive.samples[index]??null;
 const load=(a:FlightArchive)=>{setPlaying(false);setRecording(false);lastSample.current=null;setArchive(a);setIndex(0);setImportError('');};
 const onImport=async(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>16_000_000)throw Error('File too large');load(parseArchive(await f.text()));}catch(err){setImportError(err instanceof Error?err.message:'Invalid recording');}};
 const currentIndex=Math.min(index,Math.max(0,archive.samples.length-1));
 const start=()=>{setPlaying(false);lastSample.current=null;lastConfiguration.current=null;lastEventId.current=Math.max(0,...advisories.map(e=>e.id));setArchive(archiveFrom([],[{at:Date.now(),kind:'recording',label:'Recording started',detail:'Observational telemetry, not a certified flight recorder'}],t.aircraftIcao));setIndex(0);setRecording(true);};
 const stop=()=>{setRecording(false);setArchive(prev=>({...prev,events:[...prev.events,{at:Date.now(),kind:'recording',label:'Recording stopped',detail:'User stopped recording'}]}));};
 const csv=()=>{const lines=['timestamp,ias_kt,alt_ft,vs_fpm,bank_deg,pitch_deg,n1_left_pct,n1_right_pct,egt_left_c,egt_right_c,throttle_ratio,flap_ratio,risk,gear,autopilot'];for(const p of archive.samples)lines.push([new Date(p.at).toISOString(),p.ias,p.alt,p.vs,p.bank,p.pitch,p.n1l,p.n1r,p.egtl,p.egtr,p.throttle,p.flap,p.risk,p.gear,p.ap].map(x=>x??'').join(','));exportFile('xplane-flight-record.csv',lines.join('\r\n'),'text/csv');};
 const pythonJson=()=>exportFile('xplane-flight-record.python.json',JSON.stringify(archive,null,2));
 return <section className="xmc-recorder"><header><span>FLIGHT DATA / REPLAY / DEBRIEF</span><h2>Flight recorder and post-flight review</h2><p>Explicit recording and local export. Imported demonstration scenarios are clearly marked and never combined with live telemetry.</p></header>
 <div className="xmc-record-toolbar"><button disabled={recording} onClick={start}>START LIVE RECORDING</button><button disabled={!recording} onClick={stop}>STOP</button><button disabled={!archive.samples.length} onClick={()=>exportFile('xplane-flight-record.json',JSON.stringify(archive))}>EXPORT JSON</button><button disabled={!archive.samples.length} onClick={csv}>EXPORT CSV</button><button disabled={!archive.samples.length} onClick={pythonJson}>EXPORT PYTHON JSON</button><label className="xmc-import">IMPORT JSON<input type="file" accept=".json,application/json" onChange={onImport}/></label><span className={recording?'xmc-recording':''}>{recording?'● RECORDING':`${archive.source.toUpperCase()} · ${archive.samples.length} SAMPLES`}</span></div>
 <p className="xmc-import-error" style={{marginTop:6,opacity:.82}}>Use EXPORT PYTHON JSON with analysis/flight_report.py to generate the offline PDF and HTML report.</p>
 {importError&&<div role="alert" className="xmc-import-error">{importError}</div>}
 <div className="xmc-stats">{[['DURATION',`${stats.durationSeconds.toFixed(0)}s`],['IAS MAX',`${value(stats.maxIas,1)} kt`],['ALTITUDE MAX',`${value(stats.maxAltitude)} ft`],['BANK |MAX|',`${value(stats.maxAbsoluteBank,1)}°`],['VERTICAL |MAX|',`${value(stats.maxAbsoluteVerticalSpeed)} fpm`],['N1 ASYMMETRY',`${value(stats.meanN1Asymmetry,1)}%`]].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
 <div className="xmc-playback"><div><strong>TIME-ALIGNED PLAYBACK</strong><small>{current?formatTime(current.at):'No recording loaded'} · {archive.aircraftIcao??'UNKNOWN'} · {archive.source==='demonstration'?'SYNTHETIC DATA':'LIVE RECORD'}</small></div><div className="xmc-play-controls"><button disabled={recording||archive.samples.length<2} onClick={()=>{if(index>=archive.samples.length-1)setIndex(0);setPlaying(p=>!p);}}>{playing?'PAUSE':'PLAY'}</button><button onClick={()=>setIndex(0)} disabled={!archive.samples.length}>REWIND</button><label>PLAYBACK RATE <select value={playSpeed} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setPlaySpeed(Number(e.target.value))}><option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option></select></label></div><input aria-label="Replay position" type="range" min="0" max={Math.max(0,archive.samples.length-1)} value={currentIndex} disabled={!archive.samples.length} onChange={(e:ChangeEvent<HTMLInputElement>)=>{setPlaying(false);setIndex(Number(e.target.value));}}/><ReplayCharts archive={archive} index={currentIndex}/></div>
 <div className="xmc-record-events"><h3>EVENT INSPECTION</h3>{archive.events.length?<div>{archive.events.map((e,i)=><button key={`${e.at}-${i}`} onClick={()=>{let idx=archive.samples.findIndex(s=>s.at>=e.at);setIndex(idx<0?Math.max(0,archive.samples.length-1):idx);}}><time>{formatTime(e.at)}</time><strong>{e.label}</strong><small>{e.detail}</small></button>)}</div>:<p>No recorded events.</p>}</div>
 <div className="xmc-scenarios"><h3>SCENARIO LIBRARY / SYNTHETIC EXAMPLES</h3><p>These examples are deliberately generated to exercise visualizations and do not claim to simulate validated aircraft failures.</p>{([['normal','Normal profile'],['approach','Unstable descent'],['asymmetry','Asymmetric engine'],['systems','System advisory']] as const).map(([id,label])=><button key={id} onClick={()=>load(demonstration(id))} disabled={recording}>{label}</button>)}</div>
 </section>;
}
