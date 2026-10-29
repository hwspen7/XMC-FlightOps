import { useMemo } from 'react';
import type { FlightTelemetry, ServerStatus } from '@xplane/shared';
import { phaseLabel, value } from '../../telemetry/flightAnalytics';
import '../../styles/system-topology.css';
const number=(n:number|null|undefined,unit='',d=1)=>`${value(n,d)}${typeof n==='number'?unit:''}`;
const yes=(n:number|null|undefined)=>n==null?'UNKNOWN':n>.5?'ON':'OFF';
const color=(n:number|null|undefined)=>n==null?'#68889a':n>.5?'#5fd4a5':'#b9c6d1';
const channels=(items:[string,number|null|undefined,string][])=>items.map(([k,v,unit])=><div key={k} className="xmc-system-row"><span>{k}</span><b>{number(v,unit)}</b></div>);
function Electrical({t}:{t:FlightTelemetry}){
 const left=t.generatorLeftOn,right=t.generatorRightOn;
 return <div className="xmc-system-card"><h3>ELECTRICAL SOURCE INDICATION</h3><small>Indicator relationships, not verified electrical wiring</small>
  <svg viewBox="0 0 450 210" aria-label="Two generators and battery indications above reported bus voltage" role="img"><g stroke="#52758e" strokeWidth="1.8" fill="none"><path d="M75 67V112H225M225 112V143M372 67V112H225" strokeDasharray="5 6"/><path d="M225 67V112" strokeDasharray="5 6"/></g>
  {[[75,'GEN 1',left],[225,'BATTERY',t.batteryVolts],[372,'GEN 2',right]].map(([x,label,n])=><g key={label as string}><rect x={Number(x)-60} y="19" width="120" height="47" rx="5" fill="#142e42" stroke={color(n as number|null)}/><text x={Number(x)} y="37" textAnchor="middle" fontSize="11" fill="#94b8c9">{label as string}</text><text x={Number(x)} y="54" textAnchor="middle" fontSize="14" fill="#d9e9f2">{label==='BATTERY'?number(n as number|null,' V'):yes(n as number|null)}</text></g>)}
  <rect x="121" y="144" width="208" height="43" rx="5" stroke="#4f829b" fill="#1b4156"/><text x="225" y="162" textAnchor="middle" fill="#b4cbd8" fontSize="10">OBSERVED BUS VOLTAGE</text><text x="225" y="180" textAnchor="middle" fill="#e5f4fa" fontSize="15">{number(t.electricalBusVolts,' V')}</text></svg>
  <p className="xmc-tech-note">Dashed lines represent monitoring associations only. No bus-tie, essential-bus or supply-path state is inferred.</p></div>;
}
function Hydraulic({t}:{t:FlightTelemetry}){
 return <div className="xmc-system-card"><h3>HYDRAULIC INDICATION</h3><small>Independent reported channels · pressure units not assumed</small>
  <svg viewBox="0 0 450 210" role="img" aria-label="Two hydraulic pressure indicators and reservoir fraction"><g stroke="#375c71" strokeWidth="8" strokeLinecap="round"><path d="M55 110H395"/></g>
  {[[126,'CH 1',t.hydraulicPressure1Raw],[324,'CH 2',t.hydraulicPressure2Raw]].map(([x,label,v])=><g key={label as string}><circle cx={Number(x)} cy="110" r="51" stroke="#567f9a" fill="#152c40" strokeWidth="2"/><path d={`M${Number(x)-26} 126A34 34 0 1 1 ${Number(x)+28} 126`} fill="none" stroke="#67bcdd" strokeWidth="5"/><text x={Number(x)} y="103" textAnchor="middle" fill="#93b5c9" fontSize="10">{label as string}</text><text x={Number(x)} y="123" textAnchor="middle" fill="#e2f5fa" fontSize="15">{value(v as number|null,0)}</text></g>)}
  <text x="225" y="200" textAnchor="middle" fill="#a4c5d8" fontSize="11">RESERVOIR 1: {number(t.hydraulicFluid1Ratio==null?null:t.hydraulicFluid1Ratio*100,'%',0)}</text></svg>
  <p className="xmc-tech-note">Raw pressure values are unscaled simulator indicators. Pumps, actuators and hydraulic routing are not exposed by these readings.</p></div>;
}
function StatusGroup({title,caption,items}:{title:string;caption:string;items:[string,number|null|undefined,string][]}){
 return <div className="xmc-system-card"><h3>{title}</h3><small>{caption}</small><div className="xmc-system-rows">{channels(items)}</div></div>;
}
function EventWaterfall({events}:{events:{at:number;flag:number;event:string}[]}){
 const recent=events.slice(0,80).slice().reverse();const start=recent[0]?.at??0,last=recent.at(-1)?.at??start;const duration=Math.max(1000,last-start);
 const title=['OVERSPEED','LOW SPEED','BANK','TERRAIN DESCENT','N1 ASYMMETRY','GEAR DISAGREE','BUS VOLTAGE','HYDRAULICS','CABIN ALTITUDE','ICING','APPROACH'];
 return <div className="xmc-system-card xmc-event-panel"><h3>EVENT SEQUENCE / ALERT LIFECYCLE</h3><small>Native debounced raise/clear events · timestamped in the backend · newest on right</small><svg viewBox="0 0 960 276" role="img" aria-label="Alert timeline with subsystem swimlanes">
   {title.map((name,i)=><g key={name}><rect x="145" y={18+i*21} width="795" height="19" fill={i%2?'#0f293b':'#163044'}/><text x="6" y={32+i*21} fill="#9cb9ca" fontSize="10">{name}</text></g>)}
   {[0,.25,.5,.75,1].map(f=><g key={f}><path d={`M${150+780*f} 18V250`} stroke="#36556b" strokeDasharray="2 5"/><text x={150+780*f} y="267" textAnchor="middle" fill="#799db4" fontSize="10">{recent.length?new Date(start+duration*f).toLocaleTimeString():'—'}</text></g>)}
   {recent.map((e,i)=><g key={`${e.at}-${i}`}><circle cx={150+780*(e.at-start)/duration} cy={27+Math.min(10,e.flag)*21} r="5" fill={e.event==='raised'?'#f38d92':'#5dd6ae'} stroke="#152d3c" strokeWidth="1"/><title>{`${title[e.flag]??'UNKNOWN'} · ${e.event} · ${new Date(e.at).toLocaleTimeString()}`}</title></g>)}
  </svg><div className="xmc-event-legend"><span>● Red = asserted</span><span>● Green = cleared</span><span>{events.length} events in server history</span></div></div>;
}
export function SystemTopology({status,connected}:{status:ServerStatus;connected:boolean}){
 const t=status.simulator.telemetry,live=connected&&status.simulator.reachable&&status.simulator.telemetryFresh,events=status.simulator.advisoryEvents??[];
 const mode=useMemo(()=>!live?'UNAVAILABLE':phaseLabel(t.nativeFlightPhase),[live,t.nativeFlightPhase]);
 return <section className="xmc-systems-suite"><header><span>AIRCRAFT SYSTEMS / READ-ONLY INDICATORS</span><h2>Subsystem health and event correlation</h2><p>Flight-phase aware review. An unavailable sensor is never interpreted as healthy.</p></header>
 <div className="xmc-systems-status">{[['NATIVE FLIGHT PHASE',mode],['HANDLING RISK',number(live?t.nativeHandlingRisk:null,' / 100',0)],['PROPULSION RISK',number(live?t.nativePropulsionRisk:null,' / 100',0)],['SYSTEMS RISK',number(live?t.nativeSystemsRisk:null,' / 100',0)],['APPROACH RISK',number(live?t.nativeApproachRisk:null,' / 100',0)]].map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
 <div className="xmc-systems-grid"><Electrical t={t}/><Hydraulic t={t}/>
 <StatusGroup title="AUTOPILOT / NAVIGATION" caption="Pilot-selected guidance and simulator mode indicators, not a decoded mode annunciator" items={[["Selected heading",t.selectedHeadingDegrees,"°"],["Selected altitude",t.selectedAltitudeFeet," ft"],["Vertical-speed select",t.selectedVerticalSpeedFpm," fpm"],["FD mode code",t.flightDirectorMode,""],["Heading mode code",t.autopilotHeadingMode,""],["Nav deviation",t.navDeviationDots," dots"],["Glideslope deviation",t.glideslopeDeviationDots," dots"]]}/>
 <StatusGroup title="CABIN / PRESSURIZATION" caption="Reported values, no aircraft-specific differential pressure limit" items={[["Cabin altitude",t.cabinAltitudeFeet," ft"],["Cabin vertical speed",t.cabinVerticalSpeedFpm," fpm"],["Differential pressure",t.cabinDifferentialPsi," psi"]]}/>
 <StatusGroup title="ANTI-ICE / ENVIRONMENT" caption="Protection switches do not establish full system effectiveness" items={[["Outside air temperature",t.outsideAirTempC," °C"],["Wing ice ratio",t.wingIceRatio,""],["Wing anti-ice switch",t.wingAntiIceOn,""],["Pitot heat",t.pitotHeatOn,""]]}/>
 <StatusGroup title="LANDING CONFIGURATION" caption="Selected controls are compared with actuator-position readbacks" items={[["Gear lever",t.gearHandleDown,""],["Gear leg 0",t.gearDeploy0Ratio,""],["Gear leg 1",t.gearDeploy1Ratio,""],["Gear leg 2",t.gearDeploy2Ratio,""],["Flap lever",t.flapHandleRatio,""],["Actual flaps",t.flapDeployRatio,""],["Speedbrake",t.speedbrakeRatio,""]]}/></div>
 <EventWaterfall events={events}/></section>;
}
