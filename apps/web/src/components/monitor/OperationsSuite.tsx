import { useState } from 'react';
import type { ServerStatus } from '@xplane/shared';
import { SystemsHealth } from './SystemsHealth';
import { FlightAnalytics } from './FlightAnalytics';
import { SystemTopology } from './SystemTopology';
import { FlightRecorder } from './FlightRecorder';
import '../../styles/operations-suite.css';
type Page='systems'|'analysis'|'debrief';
/** All pages remain mounted so in-memory samples and active recording survive tab switches. */
export function OperationsSuite({status,connected}:{status:ServerStatus;connected:boolean}) {
 const [page,setPage]=useState<Page>('systems');
 return <div className="xmc-operations-suite"><nav className="xmc-operations-nav" aria-label="Flight analytics workspace">
  {([['systems','01 · AIRCRAFT SYSTEMS'],['analysis','02 · FLIGHT ANALYTICS'],['debrief','03 · RECORDER & DEBRIEF']] as const).map(([id,title])=><button type="button" key={id} className={page===id?'active':''} onClick={()=>setPage(id)} aria-current={page===id?'page':undefined}>{title}</button>)}
  <span>READ-ONLY MONITORING · SIMULATOR DATA</span></nav>
  <div hidden={page!=='systems'} className="xmc-suite-page"><SystemsHealth status={status} connected={connected}/><SystemTopology status={status} connected={connected}/></div>
  <div hidden={page!=='analysis'} className="xmc-suite-page"><FlightAnalytics status={status} connected={connected}/></div>
  <div hidden={page!=='debrief'} className="xmc-suite-page"><FlightRecorder status={status} connected={connected}/></div>
 </div>;
}
