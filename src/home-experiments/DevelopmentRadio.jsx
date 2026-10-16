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

const PocketPlayer=memo(function PocketPlayer({motion}){
  return <div className="development-art" aria-hidden="true">
    <ReactionPost motion={motion}/>
    <svg className="development-earbuds" viewBox="0 0 200 440" focusable="false">
      <g fill="none" strokeLinecap="round">
        <path d="M80 67v85c0 32 22 48 37 69m44-93v42c0 27-28 36-44 51v35c0 76 74 98 35 143-24 28-94 22-103-11" stroke="#c5d4e6" strokeWidth="6"/>
        <path d="M80 67v85c0 32 22 48 37 69m44-93v42c0 27-28 36-44 51v35c0 76 74 98 35 143-24 28-94 22-103-11" stroke="#fff" strokeWidth="3"/>
      </g>
      <g transform="translate(46 18) rotate(-20 34 30)">
        <rect x="27" y="24" width="15" height="60" rx="7" fill="#dde5ed"/>
        <rect x="27" y="24" width="11" height="60" rx="5" fill="#fff"/>
        <ellipse cx="31" cy="24" rx="26" ry="22" fill="#fff"/>
        <ellipse cx="20" cy="23" rx="10" ry="14" fill="#d9e1e9"/>
        <path d="M17 14v18m5-18v18" stroke="#567084" strokeWidth="2"/>
        <text x="32" y="64" fontSize="8" fill="#60788b">L</text>
      </g>
      <g transform="translate(128 76) rotate(18 28 26)">
        <rect x="25" y="24" width="15" height="60" rx="7" fill="#dde5ed"/>
        <rect x="25" y="24" width="11" height="60" rx="5" fill="#fff"/>
        <ellipse cx="28" cy="24" rx="25" ry="22" fill="#fff"/>
        <ellipse cx="38" cy="23" rx="10" ry="14" fill="#d9e1e9"/>
        <path d="M35 14v18m5-18v18" stroke="#567084" strokeWidth="2"/>
        <text x="29" y="64" fontSize="8" fill="#60788b">R</text>
      </g>
    </svg>
    <div className="development-device">
      <svg viewBox="0 0 440 720" focusable="false">
        <rect x="8" y="8" width="424" height="704" rx="43" fill="#d8e2f5"/>
        <rect x="22" y="8" width="410" height="704" rx="40" fill="#fff"/>
        <rect x="55" y="59" width="344" height="335" rx="13" fill="#dce5f4" stroke="#152956" strokeWidth="1.5"/>
        <rect x="146" y="132" width="162" height="162" rx="13" fill="#0b4bef"/>
        <g fill="#fff">
          <circle cx="178" cy="168" r="11"/>
          <path d="M168 189h21v78h-21Zm35 0h20v11c7-10 15-13 26-13 22 0 33 14 33 39v41h-22v-40c0-14-4-20-15-20-12 0-20 8-20 23v37h-22Z"/>
        </g>
        <text x="227" y="336" textAnchor="middle" fill="#142d67" fontFamily="C2Hoves, Arial, sans-serif" fontSize="21" letterSpacing="1">LinkedIn Beats</text>
        <circle cx="227" cy="557" r="133" fill="#eceef3" stroke="#bec6d4" strokeWidth="1"/>
        <circle cx="227" cy="557" r="94" fill="#fff" stroke="#bec6d4" strokeWidth="1"/>
        <circle cx="227" cy="557" r="31" fill="#dce4f3"/>
        <path d="m133 463 27 27m134 134 27 27m0-188-27 27M133 651l27-27" stroke="#bec6d4" fill="none"/>
        <text x="227" y="458" textAnchor="middle" fill="#173369" fontFamily="C2Hoves, Arial, sans-serif" fontSize="20" fontWeight="600">MENU</text>
      </svg>
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
        <h2 id="development-title">Professional development.<br/>Questionable lyrics.</h2>
        <p className="development-intro">Build your executive presence through repetitive exposure to synergy, strategic alignment, and a surprisingly good beat.</p>
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
        <a className="development-studio" href={`${base}studio/`}>Make your own corporate anthem <ArrowUpRight aria-hidden="true"/></a>
      </div>
      <PocketPlayer motion={motion}/>
    </div>
  </section>;
}
