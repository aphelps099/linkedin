import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ExternalLink, Check, Copy, FileText, Headphones, Linkedin, LoaderCircle, Pause, Play, X} from 'lucide-react';
import {DISPATCHES} from './dispatches.js';
import {TRACKS, formatTime} from '../home/tracks.js';
import {CarouselArtwork} from './CarouselArtwork.jsx';
import './dispatch-carousel.css';

const ICONS = {video:Play, song:Headphones, post:Linkedin, press:FileText, blog:FileText};
const ACTIONS = {video:'Watch film', song:'Listen now', post:'Read post', press:'Read release', blog:'Read story'};

const Artwork = memo(function Artwork({item, base}) {
  return <div className="dispatch-art dispatch-art--editorial" aria-hidden="true"><CarouselArtwork artwork={item.artwork} base={base}/></div>;
});

function DispatchDialog({item, base, state, onToggle, onSeek, onClose}) {
  const dialog = useRef(null), closeButton = useRef(null), video = useRef(null);
  const [copyStatus, setCopyStatus] = useState(''), [videoError, setVideoError] = useState(false);
  const current = item.type==='song' && state.index===item.track;
  useEffect(()=>{
    const element=dialog.current, focused=document.activeElement, overflow=document.body.style.overflow;
    element.showModal(); document.body.style.overflow='hidden'; closeButton.current.focus();
    return ()=>{element.close(); document.body.style.overflow=overflow; focused?.focus({preventScroll:true});};
  },[]);
  const copyPost=async()=>{
    try {await navigator.clipboard.writeText(item.body.join('\n\n'));setCopyStatus('Copied');}
    catch {setCopyStatus('Copy unavailable. Select the text below to copy it.');}
  };
  return <dialog ref={dialog} className={`dispatch-dialog dispatch-dialog--${item.type}`} aria-labelledby="dispatch-dialog-title"
    onCancel={e=>{e.preventDefault();onClose();}}
    onClick={e=>{if(e.target===e.currentTarget){const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)onClose();}}}>
    <button ref={closeButton} type="button" className="dispatch-close" onClick={onClose} aria-label="Close story"><X/></button>
    {item.type==='video'?<div className="dispatch-film">
      <video ref={video} src={`${import.meta.env.DEV?'https://linkedinbeats.com/':base}${item.video}`} poster={`${base}${item.image}`} controls playsInline preload="metadata" onError={()=>setVideoError(true)} aria-label={item.title}/>
      {videoError&&<p role="alert">This film couldn’t load. Please close it and try again.</p>}
    </div>:<Artwork item={item} base={base}/>}
    <div className="dispatch-dialog-copy">
      <p className="dispatch-meta">{item.label}{['press','blog','post'].includes(item.type)&&' / A little corporate fiction'}</p>
      <h2 id="dispatch-dialog-title">{item.title}</h2>
      {item.description&&<p>{item.description}</p>}
      {item.type==='song'&&<div className="dispatch-audio">
        <button type="button" className="dispatch-audio-toggle" onClick={onToggle} aria-label={state.loading?'Cancel loading':state.playing?'Pause song':'Play song'}>{current&&state.loading?<LoaderCircle className="c2-spin"/>:current&&state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
        <div><strong>{TRACKS[item.track].title}</strong><input type="range" min="0" max={TRACKS[item.track].seconds} step="1" value={current?Math.floor(state.elapsed):0} onChange={e=>onSeek(Number(e.target.value))} aria-label="Song position" aria-valuetext={`${formatTime(current?state.elapsed:0)} of ${formatTime(TRACKS[item.track].seconds)}`}/><span>{formatTime(current?state.elapsed:0)} / {formatTime(TRACKS[item.track].seconds)}</span></div>
        {state.error&&<p role="alert">The song couldn’t load. Try the play button again.</p>}
      </div>}
      {item.body&&<div className="dispatch-article">{item.body.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>}
      {item.type==='post'&&<><button type="button" className="dispatch-text-action" onClick={copyPost}>{copyStatus==='Copied'?<Check/>:<Copy/>}{copyStatus==='Copied'?'Copied':'Copy post'}</button><span className="c2-sr" role="status">{copyStatus}</span></>}
      {item.link&&<a className="dispatch-text-action" href={`${base}${item.link.href}`}>{item.link.label}<ArrowUpRight/></a>}
    </div>
  </dialog>;
}

export function DispatchCarousel({base='/', motion=true, state, onPlayTrack, onToggle, onSeek, onPause}) {
  const rail=useRef(null), section=useRef(null), frame=useRef(null);
  const [active,setActive]=useState(0), [paused,setPaused]=useState(false), [hovered,setHovered]=useState(false), [focused,setFocused]=useState(false);
  const [inView,setInView]=useState(false), [visible,setVisible]=useState(!document.hidden), [opened,setOpened]=useState(null);
  const scrollTo=useCallback((index,manual=true)=>{
    if(manual)setPaused(true);
    const el=rail.current, card=el?.children[index];
    if(!card)return;
    const left=card.getBoundingClientRect().left-el.getBoundingClientRect().left+el.scrollLeft-parseFloat(getComputedStyle(el).paddingLeft);
    el.scrollTo({left,behavior:motion?'smooth':'instant'});
  },[motion]);
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:.25});
    observer.observe(section.current);
    const visibility=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(frame.current);};
  },[]);
  useEffect(()=>{
    if(!motion||paused||hovered||focused||!inView||!visible||opened)return;
    const timer=setTimeout(()=>scrollTo((active+1)%DISPATCHES.length,false),6500);
    return ()=>clearTimeout(timer);
  },[active,motion,paused,hovered,focused,inView,visible,opened,scrollTo]);
  const updateActive=()=>{
    cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{
      const el=rail.current, edge=el.getBoundingClientRect().left+parseFloat(getComputedStyle(el).paddingLeft);
      let closest=0, distance=Infinity;
      Array.from(el.children).forEach((card,i)=>{const d=Math.abs(card.getBoundingClientRect().left-edge);if(d<distance){closest=i;distance=d;}});
      setActive(closest);
    });
  };
  const open=item=>{setPaused(true);onPause();setOpened(item);if(item.type==='song')onPlayTrack(item.track);};
  const close=()=>{if(opened?.type==='song')onPause();setOpened(null);};
  return <section ref={section} className="dispatch-section" id="c2-dispatch" aria-labelledby="dispatch-heading" aria-roledescription="carousel"
    onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
    onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
    <header className="dispatch-heading"><h2 id="dispatch-heading">Humbled to share.</h2></header>
    <div ref={rail} className="dispatch-rail" onScroll={updateActive} onPointerDown={()=>setPaused(true)} onWheel={()=>setPaused(true)}>
      {DISPATCHES.map((item,index)=>{const Icon=ICONS[item.type];return <article key={item.id} className={`dispatch-card dispatch-card--${item.shape}`} aria-label={`${index+1} of ${DISPATCHES.length}: ${item.label}`}>
        <button type="button" className="dispatch-art-button" onClick={()=>open(item)} aria-label={`${ACTIONS[item.type]}: ${item.title}`}><Artwork item={item} base={base}/></button>
        <div className="dispatch-card-copy"><h3><button type="button" onClick={()=>open(item)}>{item.title}</button></h3><div className="dispatch-card-actions"><button type="button" onClick={()=>open(item)} aria-label={`${ACTIONS[item.type]}: ${item.title}`}><Icon fill={item.type==='video'?'currentColor':'none'}/></button><button type="button" className="dispatch-open" onClick={()=>open(item)} aria-label={`Open ${item.label.toLowerCase()}: ${item.title}`}><ExternalLink/></button></div></div>
      </article>;})}
    </div>
    <div className="dispatch-controls" aria-label="Feed carousel controls">
      <div className="dispatch-pagination" aria-label="Choose a story">{DISPATCHES.map((item,i)=><button type="button" key={item.id} onClick={()=>scrollTo(i)} aria-label={`Show story ${i+1}: ${item.title}`} aria-current={active===i?'true':undefined}><span/></button>)}</div>
      {motion&&<button type="button" className="dispatch-control dispatch-autoplay" onClick={()=>{setPaused(value=>!value);setFocused(false);}} aria-label={paused?'Resume automatic carousel':'Pause automatic carousel'} aria-pressed={paused}>{paused?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button>}
    </div>
    {opened&&<DispatchDialog key={opened.id} item={opened} base={base} state={state} onToggle={onToggle} onSeek={onSeek} onClose={close}/>}
  </section>;
}
