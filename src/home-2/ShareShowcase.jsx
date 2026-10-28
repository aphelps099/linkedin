import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Facebook,Mail,MessageCircle,Share2,X} from 'lucide-react';
import {showcaseShareTargets} from './showcase-sharing.js';
import './showcase-sharing.css';

export function ShareShowcase({item,onClose}){
  const dialog=useRef(null),alive=useRef(false);
  const [notice,setNotice]=useState(''),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false);
  const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const links=showcaseShareTargets(item,{appleMobile});
  useEffect(()=>{
    alive.current=true;
    const element=dialog.current,focus=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';element.showModal();
    return ()=>{alive.current=false;element.close();document.body.style.overflow=overflow;focus?.focus({preventScroll:true});};
  },[]);
  async function copy(){
    try{await navigator.clipboard.writeText(links.url);if(alive.current){setCopied(true);setNotice('Link copied.');}}
    catch{if(alive.current)setNotice('Select and copy the link below.');}
  }
  async function nativeShare(){
    setBusy(true);
    try{await navigator.share({title:item.title,text:links.text,url:links.url});}
    catch(error){if(alive.current&&error.name!=='AbortError')setNotice('Choose an option below, or copy the link.');}
    finally{if(alive.current)setBusy(false);}
  }
  return createPortal(<dialog className="showcase-share" ref={dialog} aria-labelledby="showcase-share-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialog.current){const box=dialog.current.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}}>
    <header><h2 id="showcase-share-title">Share this {item.film?'film':'meeting'}</h2><button type="button" className="showcase-share-close" onClick={onClose} aria-label="Close share options"><X aria-hidden="true"/></button></header>
    <p className="showcase-share-name">{item.title}</p>
    <div className="showcase-share-options">
      {typeof navigator.share==='function'&&<button type="button" onClick={nativeShare} disabled={busy}><Share2 aria-hidden="true"/>More apps…</button>}
      <a href={links.sms}><MessageCircle aria-hidden="true"/>Text message</a>
      <a href={links.email}><Mail aria-hidden="true"/>Email</a>
      <a href={links.facebook} target="_blank" rel="noopener noreferrer"><Facebook aria-hidden="true"/>Facebook</a>
      <a href={links.x} target="_blank" rel="noopener noreferrer"><span className="showcase-x" aria-hidden="true">𝕏</span>X / Twitter</a>
      <button type="button" onClick={copy}>{copied?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}{copied?'Copied':'Copy link'}</button>
    </div>
    <label className="showcase-share-url">Link<input aria-label="Share link" readOnly value={links.url} onFocus={event=>event.target.select()}/></label>
    <p className="showcase-share-notice" role="status">{notice}</p>
  </dialog>,document.body);
}
