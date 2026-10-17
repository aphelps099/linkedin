import React, {memo, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
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

const EQUALIZER_HEIGHTS=[.32,.56,.82,.48,.95,.67,.41,.76,.58,1,.72,.45,.88,.61,.38,.54];

const PocketPlayer=memo(function PocketPlayer({motion,base,playing,loading,levels,onToggle}){
  const screenId=useId();
  const art=useRef(null),device=useRef(null);
  useLayoutEffect(()=>{
    if(!motion)return;
    const container=art.current,player=device.current;
    let frame=0,inView=false;
    const update=()=>{
      frame=0;
      const viewport=window.innerHeight;
      // Measure the stationary artwork container, never the moving device.
      // The entrance ends at 45% of the viewport and stays at the existing layout position.
      const progress=Math.max(0,Math.min(1,(viewport-container.getBoundingClientRect().top)/(viewport*.55)));
      const distance=window.matchMedia('(max-width:760px)').matches?72:120;
      const offset=distance*Math.pow(1-progress,3);
      player.style.setProperty('--device-enter-y',`${offset.toFixed(2)}px`);
      player.style.willChange=progress>0&&progress<1?'translate':'';
    };
    const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(update);};
    const onScroll=()=>{if(inView)schedule();};
    const observer=new IntersectionObserver(([entry])=>{
      inView=entry.isIntersecting;
      if(inView)schedule();
    },{rootMargin:'160px 0px'});
    update();
    observer.observe(container);
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',schedule);
    document.addEventListener('visibilitychange',schedule);
    return()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll',onScroll);
      window.removeEventListener('resize',schedule);
      document.removeEventListener('visibilitychange',schedule);
      player.style.removeProperty('--device-enter-y');
      player.style.removeProperty('will-change');
    };
  },[motion]);
  const action=loading?'Cancel loading':playing?'Pause beats':'Listen — click to play beats';
  return <div className="development-art" ref={art}>
    <div aria-hidden="true"><ReactionPost motion={motion}/></div>
    <button ref={device} type="button" className={`development-device${playing?' is-playing':''}${loading?' is-loading':''}`} onClick={onToggle} aria-label={action} aria-pressed={playing}>
      <img src={`${base}home-experiments/ipod-earbuds-3d.webp`} width="1122" height="1402" alt="" loading="lazy" decoding="async" draggable="false"/>
      <svg className="development-display" viewBox="0 0 1122 1402" aria-hidden="true" focusable="false">
        <defs>
          {/* Coordinates follow the inside edge of the screen in the product render. */}
          <clipPath id={screenId}><path d="M219 220 L618 248 Q630 249 632 262 L669 605 Q670 617 657 616 L248 600 Q237 599 236 587 L204 234 Q203 219 219 220Z"/></clipPath>
        </defs>
        <g className="development-screen" clipPath={`url(#${screenId})`}>
          <path fill="#b9d9e5" d="M196 210H680V627H196Z"/>
          <g transform="matrix(1 .059 .093 1 208 221)" fill="#103b52">
            <text className="development-screen-brand" x="212" y="43" textAnchor="middle">LINKEDIN BEATS</text>
            <path d="M30 56H393" stroke="currentColor" opacity=".22"/>
            <g className={`development-equalizer${playing?'':' is-preview'}`}>
              {EQUALIZER_HEIGHTS.map((height,index)=>{
                const signal=playing&&motion?Math.max(0,...(levels?.slice(index*3,index*3+3)||[])):height;
                const size=Math.max(5,Math.min(1,signal)*99);
                return <rect key={index} x={35+index*22} y={180-size} width="13" height={size} rx="2" style={{'--bar-delay':`${index*-.17}s`,'--bar-speed':`${.7+(index%5)*.13}s`}}/>;
              })}
            </g>
            <text className="development-screen-title" x="212" y="246" textAnchor="middle">{loading?'Tuning in…':playing?'Playing':'Listen'}</text>
            <text className="development-screen-action" x="212" y="293" textAnchor="middle">{loading?'Click to cancel':playing?'Click to pause':'Click to play beats'}</text>
            <g transform="translate(201 316)">{playing?<path d="M0 0H7V19H0ZM13 0H20V19H13Z"/>:<path d="M2 0 20 10 2 20Z"/>}</g>
          </g>
        </g>
        <g className="development-listen-cue" transform="matrix(1 .059 .093 1 331 174)" fill="#103b52">
          <path d="M0 0 18 10 0 20Z"/>
          <text x="31" y="20">Listen</text>
        </g>
      </svg>
    </button>
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
        <h2 id="development-title"><span>All business.</span><strong>All beats.</strong></h2>
        <p className="development-intro">Corporate jargon. Unreasonably good music.</p>
        <div className={`development-transport${state.playing?' is-playing':''}`} role="group" aria-label="LinkedIn Beats music player">
          <div className="development-player-heading">
            <div className="development-track" aria-live="polite" aria-atomic="true">
              <strong key={track.title}>{track.title}</strong>
              <span>{state.loading?'Tuning in…':state.playing?'Now playing · LinkedIn Beats':state.elapsed>0?'Paused · LinkedIn Beats':'LinkedIn Beats'}</span>
            </div>
            <div className="development-time" aria-label={`${formatTime(position)} elapsed of ${formatTime(track.seconds)}`}>
              <time>{formatTime(position)}</time><span aria-hidden="true">/</span><time>{formatTime(track.seconds)}</time>
            </div>
          </div>
          <input className="development-seek" type="range" aria-label="Track position" aria-valuetext={`${formatTime(position)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step="1" value={position} style={{'--progress':`${Math.min(100,position/track.seconds*100)}%`}} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>commitSeek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))commitSeek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)commitSeek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
          <div className="development-player-controls">
            <div className="development-buttons">
              <button type="button" aria-label="Previous track or restart" onClick={()=>onSkip('previous')}><SkipBack fill="currentColor"/></button>
              <button type="button" className="development-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'} aria-pressed={state.playing} onClick={onToggle}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
              <button type="button" aria-label="Next track" onClick={()=>onSkip('next')}><SkipForward fill="currentColor"/></button>
            </div>
          </div>
          {state.error&&<p className="development-error" role="alert">{state.error}</p>}
        </div>
        <a className="development-studio" href={`${base}studio/`}>Make your own in the studio <ArrowUpRight aria-hidden="true"/></a>
      </div>
      <PocketPlayer motion={motion} base={base} playing={state.playing} loading={state.loading} levels={state.levels} onToggle={onToggle}/>
    </div>
  </section>;
}
