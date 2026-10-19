import React,{useEffect,useRef,useState} from 'react';
import {drawPrinterPaper} from './printer-paper.js';

export function PrinterFeed({time,playing,reduced}){
  const image=useRef(null),canvas=useRef(null),clock=useRef({time:0,stamp:0});
  const [ready,setReady]=useState(false);
  clock.current={time:reduced?0:time,stamp:typeof performance==='undefined'?0:performance.now()};
  useEffect(()=>{
    if(!ready)return;
    const ctx=canvas.current.getContext('2d');let raf,last=-Infinity;
    const draw=now=>{
      if(now-last>=1000/24){
        const current=clock.current;
        drawPrinterPaper(ctx,image.current,current.time+(playing&&!reduced?Math.min(.12,(now-current.stamp)/1000):0));last=now;
      }
      if(playing&&!reduced)raf=requestAnimationFrame(draw);
    };
    draw(performance.now());return()=>cancelAnimationFrame(raf);
  },[ready,playing,reduced,time]);
  return <><img ref={image} className="mr-poster" src="/studio/season/posters/printer-neutral.jpg" alt="" onLoad={()=>setReady(true)}/><canvas ref={canvas} className="mr-printer-display" width="1280" height="720" aria-hidden="true"/></>;
}
