import React, {memo, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {ArrowUpRight, LoaderCircle, Pause, Play, SkipBack, SkipForward} from 'lucide-react';
import {TRACKS, formatTime} from '../home/tracks.js';
import './player-digits.css';

const EQUALIZER_HEIGHTS=[.32,.56,.82,.48,.95,.67,.41,.76,.58,1,.72,.45,.88,.61,.38,.54];

const PocketPlayer=memo(function PocketPlayer({motion,base,state,track,seconds,onToggle,onSkip,onSeek,onSelect}){
  const screenId=useId(), playlistId=useId();
  const art=useRef(null),device=useRef(null),menu=useRef(null),playlist=useRef(null);
  const [menuOpen,setMenuOpen]=useState(false),[scrub,setScrub]=useState(null);
  const {playing,loading,levels}=state;
  const position=scrub??seconds;
  useEffect(()=>setScrub(null),[track.title]);
  useEffect(()=>{
    if(menuOpen)(playlist.current?.querySelector('[aria-current="true"]')||playlist.current?.querySelector('button'))?.focus({preventScroll:true});
  },[menuOpen]);
  const commitSeek=value=>{setScrub(null);onSeek(Number(value));};
  const skip=direction=>{setScrub(null);setMenuOpen(false);onSkip(direction);};
  const select=index=>{
    setMenuOpen(false);
    setScrub(null);
    if(index!==state.index||(!playing&&!loading))onSelect(index);
    menu.current?.focus({preventScroll:true});
  };
  useLayoutEffect(()=>{
    if(!motion)return;
    const container=art.current,player=device.current;
    let frame=0,inView=false;
    const update=()=>{
      frame=0;
      const viewport=window.innerHeight;
      // Use the device's layout anchor so the taller section doesn't finish the entrance offscreen.
      // offsetTop excludes the scroll translation and hover transform.
      const anchorTop=container.getBoundingClientRect().top+player.offsetTop;
      const progress=Math.max(0,Math.min(1,(viewport-anchorTop)/(viewport*.55)));
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
  const action=loading?'Cancel loading':playing?'Pause beats':'Play beats';
  const status=loading?'Tuning in…':playing?'Now playing':seconds>0?'Paused':'Press play';
  return <div className="development-art" ref={art}>
    <div ref={device} className={`development-device${playing?' is-playing':''}${loading?' is-loading':''}`} role="group" aria-label="LinkedIn Beats iPod player"
      onKeyDown={event=>{if(event.key==='Escape'&&menuOpen){event.preventDefault();setMenuOpen(false);menu.current?.focus({preventScroll:true});}}}
      onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setMenuOpen(false);}}>
      <img className="development-device-image" src={`${base}home-experiments/ipod-earbuds-3d.webp`} width="1122" height="1402" alt="" loading="lazy" decoding="async" draggable="false"/>
      <svg className="development-display" viewBox="0 0 1122 1402" aria-hidden="true" focusable="false">
        <defs>
          {/* This clip follows the inside edge of the screen in the product render. */}
          <clipPath id={screenId}><path d="M219 220 L618 248 Q630 249 632 262 L669 605 Q670 617 657 616 L248 600 Q237 599 236 587 L204 234 Q203 219 219 220Z"/></clipPath>
          <linearGradient id={`${screenId}-light`} x2=".8" y2="1"><stop stopColor="#cee9ef"/><stop offset="1" stopColor="#adcfdc"/></linearGradient>
        </defs>
        <path clipPath={`url(#${screenId})`} fill={`url(#${screenId}-light)`} d="M196 210H680V627H196Z"/>
      </svg>
      <div className="development-lcd">
        <div className="development-lcd-brand"><span>LINKEDIN BEATS</span><span aria-hidden="true">{menuOpen?'≡':loading?'···':playing?'▶':'Ⅱ'}</span></div>
        <div className="development-lcd-now" hidden={menuOpen}>
          <div className="development-lcd-heading"><span>{status}</span><strong>{track.title}</strong></div>
          {state.error?<p className="development-lcd-error" role="alert">{state.error}</p>:<div className={`development-equalizer${playing?'':' is-preview'}`} aria-hidden="true">
            {EQUALIZER_HEIGHTS.map((height,index)=>{
              const signal=playing&&motion?Math.max(0,...(levels?.slice(index*3,index*3+3)||[])):height;
              return <i key={index} style={{'--bar-level':Math.max(.05,Math.min(1,signal)),'--bar-delay':`${index*-.17}s`,'--bar-speed':`${.7+(index%5)*.13}s`}}/>;
            })}
          </div>}
          <div className="development-lcd-time" aria-hidden="true"><time>{formatTime(position)}</time><time>{formatTime(track.seconds)}</time></div>
          <input className="development-lcd-seek" type="range" aria-label="Track position" aria-valuetext={`${formatTime(position)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step="1" value={position} style={{'--progress':`${Math.min(100,position/track.seconds*100)}%`}}
            onChange={event=>setScrub(Number(event.target.value))} onPointerUp={event=>commitSeek(event.currentTarget.value)}
            onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))commitSeek(event.currentTarget.value);}}
            onBlur={event=>{if(scrub!==null)commitSeek(event.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
        </div>
        <div className="development-lcd-playlist" id={playlistId} ref={playlist} hidden={!menuOpen} role="group" aria-label="Choose a beat">
          {TRACKS.map((item,index)=><button type="button" key={item.title} aria-current={index===state.index?'true':undefined} onClick={()=>select(index)}><span>{item.title}</span><span aria-hidden="true">›</span></button>)}
        </div>
      </div>
      <button ref={menu} type="button" className="development-wheel-button development-wheel-menu" aria-label={menuOpen?'Back to now playing':'Open playlist'} aria-expanded={menuOpen} aria-controls={playlistId} onClick={()=>setMenuOpen(value=>!value)}><span className="development-wheel-menu-label" aria-hidden="true">MENU</span></button>
      <button type="button" className="development-wheel-button development-wheel-previous" aria-label="Previous track or restart" onClick={()=>skip('previous')}><SkipBack aria-hidden="true" fill="currentColor"/><span className="c2-sr">Previous</span></button>
      <button type="button" className="development-wheel-button development-wheel-play" aria-label={action} aria-pressed={playing} onClick={()=>{setMenuOpen(false);onToggle();}}>{loading?<LoaderCircle className="c2-spin" aria-hidden="true"/>:playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>}<span className="c2-sr">{action}</span></button>
      <button type="button" className="development-wheel-button development-wheel-next" aria-label="Next track" onClick={()=>skip('next')}><SkipForward aria-hidden="true" fill="currentColor"/><span className="c2-sr">Next</span></button>
      <p className="c2-sr" role="status">{track.title}. {status}.</p>
    </div>
  </div>;
});

export function DevelopmentRadio({base,state,track,seconds,motion,onToggle,onSkip,onSeek,onSelect}){
  return <section className={`development-radio${motion?'':' is-still'}`} id="c2-player" aria-labelledby="development-title">
    <img className="development-stage" src={`${base}home-experiments/music-stage.webp`} alt="" width="1774" height="887" loading="lazy" decoding="async"/>
    <div className="development-inner">
      <div className="development-copy">
        <h2 id="development-title"><span className="c2-sr">Sound like you mean business</span><img src={`${base}home-experiments/sound-like-business.svg`} width="700" height="170" alt="" loading="lazy" decoding="async"/></h2>
        <p className="development-intro">Corporate jargon. Robot vocals.<br/>Unreasonably good beats.</p>
        <a className="development-studio" href={`${base}studio/`}>Make your own in the studio <ArrowUpRight aria-hidden="true"/></a>
      </div>
      <PocketPlayer motion={motion} base={base} state={state} track={track} seconds={seconds} onToggle={onToggle} onSkip={onSkip} onSeek={onSeek} onSelect={onSelect}/>
    </div>
  </section>;
}
