import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Check, Globe2, Heart, Lightbulb, MessageSquare, MoreHorizontal, Pause, Play, Repeat2, Send, ThumbsUp} from 'lucide-react';
import {postDemoFrame, POST_DEMO_DURATION, OPTIMIZED_POST} from './post-demo-timeline.js';

const COURSES=['The Hook','Small News, Big Deal','The Vocabulary','The Shape','Release Your Single'];
export function CertificateFan(){
  return <span className="test-cert-fan" aria-hidden="true">{COURSES.map((title,i)=><span className="test-cert-card" key={title} style={{'--fan-x':`${(i-2)*52}px`,'--fan-turn':`${(i-2)*10}deg`,'--fan-delay':`${Math.abs(i-2)*35}ms`}}>
    <span className="test-cert-brand">linkedinbeats_ <small>ACADEMY</small></span>
    <span className="test-cert-label">COURSE 0{i+1}</span><strong>{title}</strong>
    <span className="test-cert-rule"/><span className="test-cert-seal">✦</span>
  </span>)}</span>;
}

export function PostDemo({base, motion}){
  const root=useRef(null), elapsed=useRef(0);
  const [visible,setVisible]=useState(false),[paused,setPaused]=useState(false);
  const [frame,setFrame]=useState(()=>postDemoFrame(0));
  useEffect(()=>{
    let inView=false;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();},{threshold:0.15});
    observer.observe(root.current);document.addEventListener('visibilitychange',sync);
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  useEffect(()=>{
    if(!motion){setFrame(postDemoFrame(12000));return;}
    if(!visible||paused)return;
    let previous=performance.now();
    const timer=setInterval(()=>{
      const now=performance.now();elapsed.current=(elapsed.current+now-previous)%POST_DEMO_DURATION;previous=now;
      const next=postDemoFrame(elapsed.current);
      setFrame(old=>old.phase===next.phase&&old.text===next.text&&old.typing===next.typing?old:next);
    },40);
    return ()=>clearInterval(timer);
  },[motion,visible,paused]);
  return <section ref={root} className="test-post-panel" aria-labelledby="test-post-title" data-phase={frame.phase} data-paused={paused||!visible}>
    <div className="test-post-top"><span className="lp-pill">LinkedInifier</span>{motion&&<button className="test-demo-toggle" type="button" aria-label={paused?'Play post demo':'Pause post demo'} onClick={()=>setPaused(p=>!p)}>{paused?<Play/>:<Pause/>}</button>}</div>
    <h2 id="test-post-title">Small news. Big deal.</h2>
    <div className="test-post-scene">
      <img className="test-post-robot" src={`${base}home-2/certificate-robot.webp`} width="1774" height="887" alt="" loading="lazy"/>
      <article className="test-feed-post" aria-label="Example of an optimized LinkedIn post">
        <div className="test-feed-profile"><span className="test-feed-avatar" aria-hidden="true">Y</span><div><strong>Your name <span>· 1st</span></strong><small>Turning everyday moments into milestones</small><small>Just now · <Globe2/></small></div><MoreHorizontal aria-hidden="true"/></div>
        <p className="c2-sr">{OPTIMIZED_POST}</p>
        <div className="test-feed-body" aria-hidden="true">{frame.text}{frame.typing&&<span className="test-typing-cursor"/>}</div>
        <img className="test-post-approval" src={`${base}home-2/approved-stamp.svg`} width="228" height="80" alt="" aria-hidden="true"/>
        <div className="test-feed-reactions" aria-hidden="true"><span><i><ThumbsUp/></i><i><Heart/></i><i><Lightbulb/></i> {frame.phase==='approved'?'48':'0'}</span><span>{frame.phase==='approved'?'12 comments · 2 reposts':'Be the first to celebrate'}</span></div>
        <div className="test-feed-actions" aria-hidden="true"><span><ThumbsUp/>Like</span><span><MessageSquare/>Comment</span><span><Repeat2/>Repost</span><span><Send/>Send</span></div>
      </article>
    </div>
    <div className="test-post-footer"><span className="test-post-status">{frame.phase==='approved'?<Check/>:<span className="test-status-dot"/>}{frame.status}</span><a href={`${base}optimizer`}>Try LinkedInifier <ArrowUpRight/></a></div>
  </section>;
}
