import React,{useEffect,useRef,useState} from 'react';
import {PEG9} from '../pegboard/fonts/peg9.js';
const glyphs=[];let columns=0;
for(const ch of 'SYNTH'){const g=PEG9.glyphs[ch];g.bits.forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='#')glyphs.push([columns+x,y]);}));columns+=g.w+2;}
columns-=2;
export default function SynthBanner({engine,playing}){
 const canvas=useRef(null),pointer=useRef(null),[mode,setMode]=useState('orbit'),[paused,setPaused]=useState(false);
 useEffect(()=>{
  const el=canvas.current,ctx=el.getContext('2d'),quiet=matchMedia('(prefers-reduced-motion: reduce)');
  let w=0,h=0,ox=4,oy=4,frame=0,last=0,phase=0,energy=0;const bins=new Uint8Array(128);
  const resize=()=>{const r=el.getBoundingClientRect();w=r.width;h=r.height;const page=el.closest('.syn-page').getBoundingClientRect();ox=((4-r.left+page.left)%8+8)%8;oy=((4-r.top+page.top)%8+8)%8;const d=Math.min(devicePixelRatio,2);el.width=w*d;el.height=h*d;ctx.setTransform(d,0,0,d,0,0);};
  const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const dot=(x,y,r,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const paint=now=>{
   frame=requestAnimationFrame(paint);if(now-last<33||document.hidden||w<48||h<40)return;const dt=Math.min((now-last)/1000,.08);last=now;
   const moving=!paused&&!quiet.matches;bins.fill(0);if(playing&&engine.current.analyser)engine.current.analyser.getByteFrequencyData(bins);
   const level=bins.slice(0,30).reduce((a,b)=>a+b,0)/7650;energy+=(level-energy)*.2;if(moving&&playing)phase+=dt*(.3+energy*1.8);
   ctx.clearRect(0,0,w,h);const cx=w/2,cy=h*.48,scale=Math.min((w-48)/columns,15),tw=columns*scale;
   // A continuous peg field curves into a shallow orbital aperture.
   for(let y=oy;y<h;y+=8)for(let x=ox;x<w;x+=8){
    const nx=(x-cx)/(w*.49),ny=(y-cy)/(h*.56),radius=Math.hypot(nx,ny);
    const wave=moving&&playing?Math.pow(Math.max(0,Math.cos(radius*17-phase*3)),12)*energy:0;
    const rim=Math.pow(Math.max(0,1-Math.abs(radius-.9)*16),2)*.32;
    const p=pointer.current,hover=p&&moving?Math.max(0,1-Math.hypot(x-p.x,y-p.y)/105)*.5:0;
    const fade=Math.min(1,x/56,(w-x)/56,y/40,(h-y)/40);
    const light=(rim+wave*.65+hover)*fade;if(light>.01)dot(x,y,1.05+wave*.8,'#86bafa',light);
   }
   // Two dotted elliptical paths, with audio lifting their depth rather than shaking the UI.
   if(mode==='orbit')for(let ring=0;ring<2;ring++)for(let i=0;i<144;i++){
    const a=i/144*Math.PI*2,rx=w*(.39+ring*.055),ry=h*(.29+ring*.06);
    const z=Math.sin(a),rotation=moving?Math.sin(phase*.22)*.1:0;
    const x=Math.cos(a)*rx,y=z*ry;
    const crest=moving&&playing?Math.pow(Math.max(0,Math.cos(a-phase*2-ring)),16)*energy:0;
    dot(cx+x,cy+y+x*rotation,1.3+crest*2,ring?'#a4e8c6':'#87adff',.2+crest*.75);
   }
   if(mode==='signal')for(let i=0;i<80;i++){
    const amp=moving?bins[Math.floor(i*1.3)]/255:0, x=w*.08+i*w*.84/80;
    for(let j=0;j<Math.max(1,Math.round(amp*8));j++)dot(x,cy+(j-4)*8,1.8,'#9ae4c5',.4);
   }
   // The real PEG-9 face stays readable; sound lights individual columns.
   for(const [x,y] of glyphs){const value=moving?bins[Math.floor(x/columns*55)]/255:0;const lit=playing&&value>(8-y)/11;
    dot(cx-tw/2+x*scale+scale/2,cy-4*scale+y*scale,scale*.31,lit?(y>5?'#b0efd0':'#a8c9ff'):'#f0f1dd',lit?1:.9);
   }
   ctx.globalAlpha=1;
  };frame=requestAnimationFrame(paint);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[engine,playing,mode,paused]);
 return <section className={'syn-banner '+(playing?'is-live':'')} aria-label="Synth arcade banner">
  <div className="syn-banner-top"><span>Sound business decisions.</span><span className="syn-banner-state"><i/>{playing?'ON AIR':'OFF THE CLOCK'}</span></div>
  <h1 className="syn-banner-title">SYNTH</h1>
  <canvas ref={canvas} aria-hidden="true" onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();pointer.current={x:e.clientX-r.left,y:e.clientY-r.top};}} onPointerLeave={()=>pointer.current=null}/>
  <div className="syn-banner-bottom"><span>{playing?'Your beat. A new atmosphere.':'Goodbye, productivity.'}</span><div role="group" aria-label="Banner visuals"><button aria-pressed={mode==='orbit'} onClick={()=>setMode('orbit')}>Orbit</button><button aria-pressed={mode==='signal'} onClick={()=>setMode('signal')}>Signal</button><button aria-label={paused?'Resume banner motion':'Pause banner motion'} aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?'▶':'Ⅱ'}</button></div></div>
 </section>;
}
