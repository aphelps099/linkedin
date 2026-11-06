import React, {useEffect, useRef, useState} from 'react';
import {X, ArrowUpRight} from 'lucide-react';
import {videoUrl} from '../youtube/feed.js';

export default function VideoModal({item,onClose}){
  const dialog=useRef(null), close=useRef(null), video=useRef(null);
  const [error,setError]=useState(false);
  const youtube=item.type==='youtube';
  useEffect(()=>{
    const element=dialog.current, opener=document.activeElement;
    const overflow=document.body.style.overflow;
    element.showModal();document.body.style.overflow='hidden';close.current.focus();
    return()=>{
      video.current?.pause();element.close();document.body.style.overflow=overflow;
      if(opener?.isConnected)opener.focus({preventScroll:true});
    };
  },[]);
  function outside(event){
    if(event.target!==event.currentTarget)return;
    const r=event.currentTarget.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();
  }
  return <dialog ref={dialog} className={`archive-video-modal ${item.kind==='short'?'archive-video-modal--short':''}`} aria-labelledby="archive-video-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={outside}>
    <header className="archive-video-top"><h2 id="archive-video-title">{item.featureTitle||item.title.replace(/\s+#\w+/g,'')}</h2><button ref={close} type="button" onClick={onClose} aria-label="Close video">CLOSE <X aria-hidden="true"/></button></header>
    <div className="archive-video-screen">
      {youtube?<iframe title={item.title} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.id)}?autoplay=1&playsinline=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<video ref={video} controls autoPlay playsInline preload="metadata" poster={`/${item.image}`} src={`/${item.video}`} aria-label={item.title} onError={()=>setError(true)}/>}
    </div>
    {error&&<p className="archive-video-error" role="alert">This film couldn’t load. <a href={`/${item.video}`}>Open the video directly.</a></p>}
    {youtube&&<a className="archive-video-external" href={videoUrl(item)} target="_blank" rel="noopener noreferrer">Open on YouTube <ArrowUpRight size={16}/></a>}
  </dialog>;
}
