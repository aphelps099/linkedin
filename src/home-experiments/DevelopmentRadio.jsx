import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, LoaderCircle, Pause, Play, SkipBack, SkipForward, ThumbsUp, Heart, Lightbulb} from 'lucide-react';
import {formatTime} from '../home/tracks.js';

const REACTIONS=[{label:'Like',Icon:ThumbsUp},{label:'Love',Icon:Heart},{label:'Insightful',Icon:Lightbulb}];

function ReactionPost({motion}){
  const root=useRef(null);
  const [visible,setVisible]=useState(false);
  const [reaction,setReaction]=useState({step:0,active:-1,counts:[128,84,36]});
  useEffect(()=>{
    let inView=false;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();},{threshold:0});
    observer.observe(root.current);
    document.addEventListener('visibilitychange',sync);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  useEffect(()=>{
    if(!motion||!visible)return;
    const timer=setInterval(()=>setReaction(previous=>{
      const active=previous.step%3;
      const counts=previous.step>=36?[128,84,36]:[...previous.counts];
      counts[active]+=1;
      return {step:previous.step>=36?1:previous.step+1,active,counts};
    }),1550);
    return()=>clearInterval(timer);
  },[motion,visible]);
  return <div className="development-post" ref={root}>
    <div className="development-post-lines"><i/><i/></div>
    <div className="development-reactions">{REACTIONS.map(({label,Icon},index)=><span className={`development-reaction reaction-${index}${motion&&visible&&reaction.active===index?' is-pressed':''}`} key={label}>
      <span className="reaction-medallion"><Icon fill={index===1?'currentColor':'none'}/></span>
      <span className="reaction-caption">{label}<span className="reaction-count">{reaction.counts[index]}</span></span>
    </span>)}</div>
    <div className="development-post-block"><i/><i/><i/></div>
  </div>;
}

const PocketPlayer=memo(function PocketPlayer({motion,base}){
  return <div className="development-art" aria-hidden="true">
    <ReactionPost motion={motion}/>
    <div className="development-device">
      <img src={`${base}home-experiments/ipod-earbuds-3d.webp`} width="1122" height="1402" alt="" loading="lazy" decoding="async"/>
    </div>
  </div>;
});

export function DevelopmentRadio({base,state,track,seconds,motion,onToggle,onSkip,onSeek}){
  const [scrub,setScrub]=useState(null);
  useEffect(()=>setScrub(null),[track.title]);
  const position=scrub??seconds;
  const commitSeek=value=>{setScrub(null);onSeek(Number(value));};
  return <section className={`development-radio${motion?'':' is-still'}`} id="c2-player" aria-labelledby="development-title">
    <div className="development-inner">
      <div className="development-copy">
        <h2 id="development-title"><span>Professional development.</span><strong>Questionable lyrics.</strong></h2>
        <p className="development-intro">Build your executive presence with a steady rotation of synergy, strategic alignment, and surprisingly good beats.</p>
        <div className="development-transport" role="group" aria-label="LinkedIn Beats music player">
          <div className="development-transport-row">
            <div className="development-buttons">
              <button type="button" aria-label="Previous track or restart" onClick={()=>onSkip('previous')}><SkipBack fill="currentColor"/></button>
              <button type="button" className="development-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'} aria-pressed={state.playing} onClick={onToggle}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
              <button type="button" aria-label="Next track" onClick={()=>onSkip('next')}><SkipForward fill="currentColor"/></button>
            </div>
            <div className="development-track" aria-live="polite" aria-atomic="true"><span>{state.loading?'Tuning in…':state.playing?'Now playing':state.elapsed>0?'Paused':'Ready to play'}</span><strong key={track.title}>{track.title}</strong></div>
            <time className="development-duration" aria-label={`Duration ${formatTime(track.seconds)}`}>{formatTime(track.seconds)}</time>
          </div>
          <input className="development-seek" type="range" aria-label="Track position" aria-valuetext={`${formatTime(position)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step="1" value={position} style={{'--progress':`${Math.min(100,position/track.seconds*100)}%`}} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>commitSeek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))commitSeek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)commitSeek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
          {state.error&&<p className="development-error" role="alert">{state.error}</p>}
        </div>
        <a className="development-studio" href={`${base}studio/`}>Create in the studio <ArrowUpRight aria-hidden="true"/></a>
      </div>
      <PocketPlayer motion={motion} base={base}/>
    </div>
  </section>;
}
