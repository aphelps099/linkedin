import React, {memo,useEffect,useRef} from 'react';
import {drawAsciiField} from '../ascii.js';

export const MeetingBackdrop = memo(function MeetingBackdrop({engine,playing,track,reducedMotion}) {
  const canvas=useRef(null);
  useEffect(()=>{
    const node=canvas.current,ctx=node.getContext('2d');
    if(!ctx)return;
    let frame=0,last=0,width=0,height=0;
    const pattern=[Array.from({length:64},(_,i)=>(track.kicks||[0,6,8,11]).includes(i%16)?2:0),Array.from({length:64},(_,i)=>i%4===0?1:0),[]];
    const paint=now=>{
      frame=0;
      if(document.hidden)return;
      if(now-last>65 || !playing || reducedMotion){
        last=now;
        const state=engine.current?.getState(),time=state?.elapsed||0;
        ctx.clearRect(0,0,width,height);
        drawAsciiField(ctx,{pattern,pos:playing&&!reducedMotion?Math.floor(time*track.bpm/15)%64:-1},reducedMotion?0:time*1000,
          {width,height,cell:64,alpha:.31,spectrum:reducedMotion?null:engine.current?.spectrum()||null});
      }
      if(playing&&!reducedMotion)frame=requestAnimationFrame(paint);
    };
    const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);};
    const resize=()=>{width=window.innerWidth;height=window.innerHeight;node.width=width;node.height=height;last=0;refresh();};
    resize();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',refresh);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',refresh);};
  },[engine,playing,track,reducedMotion]);
  return <canvas ref={canvas} className="meeting-ascii" aria-hidden="true"/>;
});
