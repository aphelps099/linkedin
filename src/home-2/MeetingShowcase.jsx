import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft, ArrowRight, ArrowUpRight, Share2, X} from 'lucide-react';
import {ShowcaseArtwork} from './ShowcaseArtwork.jsx';
import {showcaseSelection, filmSource} from './showcase-selection.js';
import {ShareShowcase} from './ShareShowcase.jsx';
import {sharedFilm} from './showcase-sharing.js';
import './meeting-showcase.css';

function FilmPlayer({item,onClose}){
  const dialog=useRef(null);
  const video=useRef(null);
  const [failed,setFailed]=useState(false);
  const [sharing,setSharing]=useState(false);
  useEffect(()=>{
    const element=dialog.current;
    const media=video.current;
    const previousFocus=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    element.showModal();
    document.body.style.overflow='hidden';
    return ()=>{media?.pause();element.close();document.body.style.overflow=previousOverflow;previousFocus?.focus();};
  },[]);
  return createPortal(<dialog className="meeting-film-player" ref={dialog} aria-labelledby="meeting-film-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialog.current){const bounds=dialog.current.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose();}}}>
    <header><h2 id="meeting-film-title">{item.title}</h2><div className="meeting-film-actions"><button className="meeting-film-share" type="button" onClick={()=>{video.current?.pause();setSharing(true);}} aria-haspopup="dialog"><Share2 aria-hidden="true"/><span>Share</span></button><button type="button" onClick={onClose} aria-label="Close film"><X aria-hidden="true"/></button></div></header>
    <video ref={video} data-audio-owner="showcase-film" controls playsInline preload="metadata" src={filmSource(item.film)} aria-label={item.title} onError={()=>setFailed(true)}/>
    {failed&&<p role="status">This film couldn’t load. <a href={filmSource(item.film)}>Open the video directly</a> or try again shortly.</p>}
    {sharing&&<ShareShowcase item={item} onClose={()=>setSharing(false)}/>}
  </dialog>,document.body);
}
export function MeetingShowcase({base='/',motion=true}){
  const rail=useRef(null);
  const [film,setFilm]=useState(()=>typeof window==='undefined'?null:sharedFilm(window.location.search));
  const closeFilm=()=>{
    setFilm(null);
    if(sharedFilm(window.location.search)){const url=new URL(window.location.href);url.searchParams.delete('film');window.history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);}
  };
  const watch=(event,item)=>{if(item.film&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();setFilm(item);}};
  const move=direction=>rail.current?.scrollBy({left:direction*rail.current.clientWidth*.8,behavior:motion?'smooth':'instant'});
  return <section className="meeting-showcase" id="c2-dispatch" aria-labelledby="meetings-heading">
    <header className="meeting-showcase-heading">
      <div><p className="meeting-kicker">From the office</p><h2 id="meetings-heading"><a href={`${base}studio/#meetings`}>Humbled to share.</a></h2><p>Meetings, films and other company updates.</p></div>
      <a className="meeting-all" href={`${base}studio/#meetings`}>View all meetings <ArrowUpRight aria-hidden="true"/></a>
    </header>
    <div className="meeting-rail" ref={rail} tabIndex={0} role="region" aria-label="Browse meetings and films">
      {showcaseSelection.map(item=><article className="meeting-preview" key={item.id}>
        <a className="meeting-art-link" href={item.film?filmSource(item.film):`${base}studio/?meeting=${item.meeting}`} aria-label={`Watch ${item.title}${item.duration?`, ${item.duration}`:''}`} onClick={event=>watch(event,item)}>
          <ShowcaseArtwork item={item} base={base}/>
        </a>
        <div className="meeting-preview-copy">
          <a className="meeting-title-link" href={item.film?filmSource(item.film):`${base}studio/?meeting=${item.meeting}`} onClick={event=>watch(event,item)}><h3>{item.title}</h3>{item.film&&<span className="meeting-watch">Watch film</span>}</a>
          {item.duration?<span className="meeting-duration">{item.duration}</span>:<ArrowUpRight aria-hidden="true"/>}
        </div>
      </article>)}
    </div>
    <div className="meeting-showcase-bottom"><a href={`${base}archives/`}>Press, posts & other humble announcements <span>Visit the archives <ArrowUpRight aria-hidden="true"/></span></a><div aria-label="Carousel controls"><button type="button" onClick={()=>move(-1)} aria-label="Previous cards"><ArrowLeft aria-hidden="true"/></button><button type="button" onClick={()=>move(1)} aria-label="Next cards"><ArrowRight aria-hidden="true"/></button></div></div>
    {film&&<FilmPlayer key={film.id} item={film} onClose={closeFilm}/>}
  </section>;
}
