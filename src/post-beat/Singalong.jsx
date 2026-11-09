import React,{useEffect,useMemo,useRef} from 'react';
import {drawSingalong,prepareSingalong,singalongFrame} from './singalong.js';

export function Singalong({cues,fallback,time,playing,idle,bpm,getTime}){
  const canvas=useRef(null),current=useRef(null);
  const score=useMemo(()=>prepareSingalong(cues,fallback),[cues,fallback]);
  current.current={time,playing,idle,bpm,getTime,score};
  useEffect(()=>{
    const el=canvas.current,ctx=el.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');let raf,width=0,height=0;
    const draw=()=>{
      const state=current.current,t=state.playing?state.getTime():state.time;
      ctx.clearRect(0,0,width,height);
      drawSingalong(ctx,state.score,t,{x:0,y:0,w:width,h:height},{bpm:state.bpm,idle:state.idle,reduced:motion.matches});
      if(state.playing)raf=requestAnimationFrame(draw);
    };
    const resize=()=>{const rect=el.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=rect.width;height=rect.height;el.width=Math.round(width*dpr);el.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);cancelAnimationFrame(raf);draw();};
    const observer=new ResizeObserver(resize);observer.observe(el);motion.addEventListener('change',resize);resize();
    return()=>{cancelAnimationFrame(raf);observer.disconnect();motion.removeEventListener('change',resize);};
  },[playing,idle,score,bpm]);
  const frame=singalongFrame(score,time,{bpm,idle});
  return <div className="pb-peg-stage" role="region" aria-label="Singalong lyrics"><canvas ref={canvas} aria-hidden="true"/><p className="sr-only">{frame.page.rows.flatMap(row=>row.tokens.map(token=>token.text)).join(' ')}</p></div>;
}
