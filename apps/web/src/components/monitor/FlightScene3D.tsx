import { useEffect, useMemo, useRef, useState } from 'react';
import { displacement, finite, type FlightSample } from '../../telemetry/flightPackage';

type V=[number,number,number];
type Model={route:Float32Array; ground:Float32Array; position:(p:FlightSample)=>V|null; span:number};
function scene(samples:FlightSample[]):Model|null{
  const origin=samples.find(p=>finite(p.telemetry.latitudeDegrees)&&finite(p.telemetry.longitudeDegrees)&&finite(p.telemetry.altitudeFeet));
  if(!origin)return null;
  const raw=(p:FlightSample):V|null=>{const d=displacement(origin.telemetry,p.telemetry);return d&&finite(p.telemetry.altitudeFeet)?[d[0],(p.telemetry.altitudeFeet-origin.telemetry.altitudeFeet!)*.3048,d[1]]:null;};
  let min:V=[Infinity,Infinity,Infinity],max:V=[-Infinity,-Infinity,-Infinity];
  for(const s of samples){const p=raw(s);if(p)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}}
  const span=Math.max(1,...max.map((v,j)=>v-min[j])),mid=min.map((v,j)=>(v+max[j])/2);
  const position=(p:FlightSample):V|null=>{const v=raw(p);return v?v.map((x,j)=>(x-mid[j])/span*1.65) as V:null;};
  const route:number[]=[],ground:number[]=[];
  const step=Math.max(1,Math.ceil(samples.length/24000));let last:V|null=null;
  for(let i=0;i<samples.length;i++){
    const p=position(samples[i]);if(!p||(i>0&&samples[i].at-samples[i-1].at>1000))last=null;
    if(!p||i%step!==0&&i!==samples.length-1)continue;
    if(last)route.push(...last,...p);last=p;
  }
  const floor=(min[1]-mid[1])/span*1.65-.02;
  const x0=(min[0]-mid[0])/span*1.65-.05,x1=(max[0]-mid[0])/span*1.65+.05,z0=(min[2]-mid[2])/span*1.65-.05,z1=(max[2]-mid[2])/span*1.65+.05;
  for(let i=0;i<=10;i++){const f=i/10,x=x0+(x1-x0)*f,z=z0+(z1-z0)*f;ground.push(x,floor,z0,x,floor,z1,x0,floor,z,x1,floor,z);}
  return {route:new Float32Array(route),ground:new Float32Array(ground),position,span};
}
const vertex='attribute vec3 p; uniform vec3 camera; uniform vec2 display; uniform float exaggeration; void main(){float x=p.x*cos(camera.x)-p.z*sin(camera.x);float z=p.x*sin(camera.x)+p.z*cos(camera.x);float y=p.y*exaggeration;float sy=y*cos(camera.y)-z*sin(camera.y);float dz=y*sin(camera.y)+z*cos(camera.y);float w=3.2-dz;gl_Position=vec4(x*camera.z*display.x,sy*camera.z*display.y,dz*.1,w);gl_PointSize=9.0;}';
const fragment='precision mediump float;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,1.0);}';
function shader(gl:WebGLRenderingContext,type:number,source:string){const s=gl.createShader(type);if(!s)throw Error('No shader');gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('3D shader compilation failed');}return s;}
export function FlightScene3D({samples,index}:{samples:FlightSample[];index:number}){
  const model=useMemo(()=>scene(samples),[samples]);
  const canvas=useRef<HTMLCanvasElement>(null),draw=useRef<((sample:FlightSample,az:number,el:number,zoom:number,ex:number)=>void)|null>(null);
  const drag=useRef<{x:number;y:number}|null>(null);
  const [az,setAz]=useState(35),[el,setEl]=useState(30),[zoom,setZoom]=useState(3),[ex,setEx]=useState(1),[error,setError]=useState('');
  useEffect(()=>{
    const c=canvas.current;if(!c||!model)return;
    const gl=c.getContext('webgl',{antialias:true,depth:true});if(!gl){setError('WebGL unavailable. Switch to 2D or projection.');return;}
    const buffers:WebGLBuffer[]=[];let program:WebGLProgram|null=null;
    const cleanup=()=>{draw.current=null;for(const b of buffers)gl.deleteBuffer(b);if(program)gl.deleteProgram(program);};
    try{
      const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
      program=gl.createProgram();if(!program)throw Error('No WebGL program');
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('3D program link failed');
      gl.useProgram(program);
      const pos=gl.getAttribLocation(program,'p'),camera=gl.getUniformLocation(program,'camera'),display=gl.getUniformLocation(program,'display'),exaggeration=gl.getUniformLocation(program,'exaggeration'),tint=gl.getUniformLocation(program,'tint');
      const make=(data:Float32Array)=>{const b=gl.createBuffer();if(!b)throw Error('No GPU buffer');buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;};
      const route=make(model.route),ground=make(model.ground),plane=make(new Float32Array(0));
      const render=(buffer:WebGLBuffer,count:number,color:V,mode:number)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);gl.uniform3fv(tint,color);gl.drawArrays(mode,0,count);};
      draw.current=(sample,azimuth,elevation,scale,vertical)=>{
        const width=Math.max(1,Math.round(c.clientWidth*(window.devicePixelRatio||1))),height=Math.max(1,Math.round(c.clientHeight*(window.devicePixelRatio||1)));
        if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
        gl.viewport(0,0,width,height);gl.clearColor(.035,.075,.12,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);gl.uniform3f(camera,azimuth*Math.PI/180,elevation*Math.PI/180,scale);gl.uniform2f(display,Math.min(1,height/width),Math.min(1,width/height));gl.uniform1f(exaggeration,vertical);
        render(ground,model.ground.length/3,[.2,.31,.39],gl.LINES);render(route,model.route.length/3,[.25,.83,.95],gl.LINES);
        const p=model.position(sample);if(!p)return;
        const t=sample.telemetry;
        const points:number[]=[];
        // Visible aircraft glyph is deliberately not dimensionally scaled.
        if(finite(t.headingDegrees)&&finite(t.pitchDegrees)&&finite(t.rollDegrees)){
          const h=t.headingDegrees*Math.PI/180,b=t.rollDegrees*Math.PI/180,q=t.pitchDegrees*Math.PI/180;
          const f:V=[Math.sin(h)*Math.cos(q),Math.sin(q),Math.cos(h)*Math.cos(q)];
          const side:V=[Math.cos(h)*Math.cos(b)-Math.sin(h)*Math.sin(q)*Math.sin(b),-Math.cos(q)*Math.sin(b),-Math.sin(h)*Math.cos(b)-Math.cos(h)*Math.sin(q)*Math.sin(b)];
          const transform=(x:number,y:number)=>p.map((v,j)=>v+(f[j]*x+side[j]*y)*.045/(j===1?vertical:1)) as V;
          const lines=[[[-1,0],[1.3,0]],[[-.25,-1],[-.25,1]],[[-.8,-.4],[-.8,.4]]];
          for(const l of lines)points.push(...transform(...l[0] as [number,number]),...transform(...l[1] as [number,number]));
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,plane);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.length?points:p),gl.DYNAMIC_DRAW);
        render(plane,points.length?points.length/3:1,[1,.77,.32],points.length?gl.LINES:gl.POINTS);
      };
      setError('');
    }catch(err){setError(String(err));cleanup();}
    return cleanup;
  },[model]);
  useEffect(()=>{if(samples[index])draw.current?.(samples[index],az,el,zoom,ex);},[model,samples,index,az,el,zoom,ex]);
  if(!model)return <article><h3>3D scene unavailable</h3><p>Position and altitude are required.</p></article>;
  return <article><h3>3D flight reconstruction</h3><canvas ref={canvas} style={{width:'100%',height:350,touchAction:'none'}} aria-label="Interactive WebGL flight path" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current={x:e.clientX,y:e.clientY};setAz(a=>(a+dx*.4+360)%360);setEl(a=>Math.max(-80,Math.min(80,a+dy*.4)));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onWheel={e=>setZoom(z=>Math.max(.5,Math.min(12,z*Math.exp(-e.deltaY*.002))))}/>
    {error&&<p role="alert">{error}</p>}<div className="xfr-toolbar"><label>Azimuth <input type="range" min="0" max="360" value={az} onChange={e=>setAz(+e.target.value)}/></label><label>Elevation <input type="range" min="-80" max="80" value={el} onChange={e=>setEl(+e.target.value)}/></label><label>Zoom <input type="range" min=".5" max="12" step=".1" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label><label>Vertical scale <select value={ex} onChange={e=>setEx(+e.target.value)}>{[1,2,5,10,25].map(x=><option key={x} value={x}>{x}×</option>)}</select></label><button onClick={()=>{setAz(35);setEl(30);setZoom(3);setEx(1);}}>Reset camera</button></div>
    <p>Perspective GPU scene · azimuthal geographic projection · relative MSL height · aircraft glyph enlarged for visibility · ground grid is a reference plane, not terrain.</p></article>;
}
