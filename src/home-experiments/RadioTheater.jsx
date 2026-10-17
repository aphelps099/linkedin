import React, {memo, useEffect, useRef, useState} from 'react';
import {Heart, Lightbulb, ThumbsUp} from 'lucide-react';
import {THEATER_COMMENTS, theaterFrame} from './radio-theater-timeline.js';

const REACTIONS=[{label:'Like',Icon:ThumbsUp},{label:'Love',Icon:Heart},{label:'Insightful',Icon:Lightbulb}];
const countLabel=n=>n>=1000?`${(n/1000).toFixed(2)}k`:String(n);

export const RadioTheater=memo(function RadioTheater({motion,running,base}){
  const elapsed=useRef(2100);
  const [frame,setFrame]=useState(()=>theaterFrame(elapsed.current));
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
  return <div className="development-theater" data-running={running}>
    <div className="development-social" aria-hidden="true" style={{opacity:scene.socialOpacity,'--theater-sheet':`url("${base}home-experiments/profile-sheet.jpg")`}}>
      <div className="development-post">
        <div className="development-post-author">
          <span className="development-comment-face face-a"/>
          <div><span>Alex Morgan</span><small>Thought leader · 2h</small></div>
          <span className="development-post-more">···</span>
        </div>
        <p className="development-post-copy">I made coffee.<br/>7 things it taught me about leadership.</p>
        <div className="development-reaction-strip">
        {REACTIONS.map(({label,Icon},index)=><div key={label} className={`development-applause${scene.active===index?' is-lit':''}`}>
          <span key={scene.active===index?scene.hit:'rest'} className={`development-reaction-icon${scene.active===index?' is-hit':''}`}><Icon fill={index===1?'currentColor':'none'}/></span>
          <span className="development-reaction-label">{label}<span>{countLabel(scene.counts[index])}</span></span>
        </div>)}
        </div>
      </div>
      <div className={`development-comment${scene.commentVisible?' is-visible':''}`}>
        <span className={`development-comment-face face-${comment.face}`}/>
        <div><span className="development-comment-name">{comment.name}</span><p>{comment.text}</p></div>
      </div>
    </div>
  </div>;
});
