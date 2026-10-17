import React, {useEffect, useRef, useState} from 'react';
import {drawAsciiField, drawFocusRamp} from '../ascii.js';
import {drawGrain} from '../grain.js';
import {TRACKS} from './remix-engine.js';

function usePhrase(text,playing) {
  const [shown,setShown]=useState(text);
  const playingRef=useRef(playing);playingRef.current=playing;
  useEffect(()=>{
    if(!playingRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(text);return;}
    let frame,start;
    setShown('');
    const reveal=now=>{
      start??=now;
      const progress=Math.min(1,(now-start)/650);
      setShown(text.slice(0,Math.ceil(text.length*progress)));
      if(progress<1)frame=requestAnimationFrame(reveal);
    };
    frame=requestAnimationFrame(reveal);
    return()=>cancelAnimationFrame(frame);
  },[text]);
  return shown;
}

// The same character weather as the original studio, at room scale and inside
// the glass monitor. Both fields are driven by Studio 02's actual master bus.
export function AsciiPerformance({state,engine}) {
  const room=useRef(null),screen=useRef(null),focus=useRef(null),refresh=useRef(()=>{});
  const latest=useRef(state);latest.current=state;
  const track=TRACKS[state.index],instrumental=state.voice==='instrumental';
  const text=instrumental?'Let the beat do the talking.':state.text;
  const shown=usePhrase(text,state.playing);
  useEffect(()=>{
    const back=room.current,front=screen.current;
    const bg=back.getContext('2d'),fg=front.getContext('2d');
    if(!bg||!fg)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,last=0,visible=true,dirty=true,width=0,height=0,size=0,dpr=1,pattern=[],trackId='';
    function paint(now){
      frame=0;
      if(!visible || document.hidden)return;
      const s=latest.current;
      if(dirty || now-last>=40){
        dirty=false;last=now;
        const t=TRACKS[s.index];
        if(trackId!==t.id){
          trackId=t.id;
          pattern=[Array.from({length:64},(_,i)=>t.kicks.includes(i%16)?2:0),Array.from({length:64},(_,i)=>i%16===4||i%16===12?2:0),Array.from({length:64},(_,i)=>i%2===0?1:0),Array(64).fill(0)];
        }
        const spectrum=reduced.matches?null:engine.current?.spectrum()||null;
        const display={pattern,pos:s.playing&&!reduced.matches?Math.floor(s.elapsed*t.bpm/15)%64:-1};
        const time=reduced.matches?0:s.elapsed*1000;
        bg.setTransform(1,0,0,1,0,0);bg.fillStyle='#0757ec';bg.fillRect(0,0,width,height);
        drawAsciiField(bg,display,time,{width,height,cell:76,alpha:.38,spectrum});
        const box=focus.current.getBoundingClientRect();
        const inner=box.width*.4;
        drawFocusRamp(bg,{width,height,cx:box.left+box.width/2,cy:box.top+box.height/2,inner,outer:inner+Math.min(width,height)*.62,blue:'#0757ec'});
        drawGrain(bg,width,height,.065);
        fg.setTransform(dpr,0,0,dpr,0,0);fg.clearRect(0,0,size,size);
        drawAsciiField(fg,display,time,{width:size,height:size,cell:Math.max(7,size/57),alpha:.24,spectrum});
        drawGrain(fg,size,size,.055);
      }
      if(s.playing&&!reduced.matches)frame=requestAnimationFrame(paint);
    }
    const schedule=()=>{dirty=true;if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(paint);};
    const resize=()=>{
      width=window.innerWidth;height=window.innerHeight;back.width=width;back.height=height;
      size=focus.current.clientWidth;dpr=Math.min(window.devicePixelRatio||1,1.5);
      front.width=Math.round(size*dpr);front.height=Math.round(size*dpr);schedule();
    };
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();};
    const observer=new ResizeObserver(resize);observer.observe(focus.current);
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else schedule();});intersection.observe(focus.current);
    refresh.current=schedule;
    window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',schedule);
    resize();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',schedule);refresh.current=()=>{};};
  },[engine]);
  useEffect(()=>{refresh.current();},[state]);
  const step=state.playing?Math.floor(state.elapsed*track.bpm/15)%64:-1;
  return <>
    <canvas ref={room} className="s2-ascii-room" aria-hidden="true"/>
    <section className="s2-stage-room" aria-label="Live ASCII performance">
      <div className="s2-trackside s2-trackside--left" aria-hidden="true">Corporate performance division</div>
      <div className="s2-trackside s2-trackside--right" aria-hidden="true">Built for maximum engagement</div>
      <div className="s2-monitor" ref={focus}>
        <canvas ref={screen} className="s2-ascii-screen" aria-hidden="true"/>
        <div className="s2-monitor-top"><span>Circle Back <sup>®</sup></span><span><i className={state.playing?'is-on':''}/>{state.loading?'Loading':state.playing?'On air':'Press play'}</span></div>
        <div className="s2-performance-copy">
          <p className="s2-terminal">{instrumental?'Instrumental transmission':`Terminal ${state.speaker==='F'?'02':'01'} / ${state.speaker==='F'?'the response':'the announcement'}`}</p>
          <h2 className={`s2-performance-phrase ${text.length>48?'is-long':''}`}><span className="s2-sr">{text}</span><span className="s2-phrase-space" aria-hidden="true">“{text}”</span><span className="s2-phrase-shown" aria-hidden="true">“{shown}{shown.length===text.length?'”':''}<i className={state.playing?'is-live':''}/></span></h2>
        </div>
        <div className="s2-monitor-bottom"><div className="s2-beat-ribbon" aria-hidden="true">{Array.from({length:64},(_,i)=><i key={i} className={`${i%4===0?'is-hit':''} ${i===step?'is-current':''}`}/>)}</div><div className="s2-monitor-meta"><span>{String(state.index+1).padStart(2,'0')} / {track.genre}</span><span>{track.bpm} BPM</span></div></div>
      </div>
    </section>
  </>;
}
