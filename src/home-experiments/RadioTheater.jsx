import React, {memo, useEffect, useRef, useState} from 'react';
import {Heart, Lightbulb, Pause, Play, ThumbsUp} from 'lucide-react';
import {THEATER_COMMENTS, theaterFrame} from './radio-theater-timeline.js';

const REACTIONS=[{label:'Like',Icon:ThumbsUp},{label:'Love',Icon:Heart},{label:'Insightful',Icon:Lightbulb}];
const MARQUEES=['Humbled. Honored. Thrilled.','Let’s take it offline. Circle back.'];
const countLabel=n=>n>=1000?`${(n/1000).toFixed(2)}k`:String(n);

export const RadioTheater=memo(function RadioTheater({motion,base}){
  const root=useRef(null),elapsed=useRef(2100);
  const [visible,setVisible]=useState(false),[paused,setPaused]=useState(false);
  const [frame,setFrame]=useState(()=>theaterFrame(elapsed.current));
  const running=motion&&visible&&!paused;
  useEffect(()=>{
    let inView=false;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();},{threshold:0});
    observer.observe(root.current);
    document.addEventListener('visibilitychange',sync);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  useEffect(()=>{
    if(!running)return;
    let request,previous=performance.now(),published=previous;
    const tick=now=>{
      elapsed.current+=now-previous;previous=now;
      if(now-published>=70){setFrame(theaterFrame(elapsed.current));published=now;}
      request=requestAnimationFrame(tick);
    };
    request=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(request);
  },[running]);
  // Reduced motion shows one complete vignette, even when toggled during a fade.
  const scene=motion?frame:theaterFrame(2100);
  const comment=THEATER_COMMENTS[scene.act];
  return <div className="development-theater" ref={root} data-running={running}>
    <div className="development-marquee" aria-hidden="true">
      {MARQUEES.map((line,index)=><div className={`development-marquee-row${index?' is-outline':''}`} key={line}>
        <div className="development-marquee-track">{[0,1].map(copy=><span key={copy}>{line}&nbsp;</span>)}</div>
      </div>)}
    </div>
    <div className="development-social" aria-hidden="true" style={{opacity:scene.socialOpacity,'--theater-sheet':`url("${base}home-experiments/profile-sheet.jpg")`}}>
      <div className="development-reaction-strip">
        {REACTIONS.map(({label,Icon},index)=><div key={label} className={`development-applause${scene.active===index?' is-lit':''}`}>
          <span key={scene.active===index?scene.hit:'rest'} className={`development-reaction-icon${scene.active===index?' is-hit':''}`}><Icon fill={index===1?'currentColor':'none'}/></span>
          <span className="development-reaction-label">{label}<span>{countLabel(scene.counts[index])}</span></span>
        </div>)}
      </div>
      <div className={`development-comment${scene.commentVisible?' is-visible':''}`}>
        <span className={`development-comment-face face-${comment.face}`}/>
        <div><span className="development-comment-name">{comment.name}</span><p>{comment.text}</p></div>
      </div>
    </div>
    {motion&&<button type="button" className="development-scene-toggle" aria-label={paused?'Resume background animation':'Pause background animation'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>
      {paused?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}<span>{paused?'Resume scene':'Pause scene'}</span>
    </button>}
  </div>;
});
