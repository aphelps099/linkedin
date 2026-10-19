import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Facebook,Instagram,Link,Linkedin,Mail,MessageCircle,Share2,X} from 'lucide-react';
import {COVERS,getCover,shareUrl,shareDestinations} from './share.js';
import './share-beat.css';

export function ShareBeat({recipe,coverId,onCoverChange,caption,onCaptionChange,onClose}){
  const dialog=useRef(null),pending=useRef(false),alive=useRef(true);
  const [notice,setNotice]=useState(''),[error,setError]=useState('');
  const cover=getCover(coverId),url=shareUrl(window.location.origin,recipe,cover.id);
  const targets=shareDestinations(url,caption);
  const local=['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
  const nativeShare=typeof navigator.share==='function';
  useEffect(()=>{
    const element=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;
    alive.current=true;
    document.body.style.overflow='hidden';element.showModal();
    return()=>{alive.current=false;element.close();document.body.style.overflow=overflow;focused?.focus({preventScroll:true});};
  },[]);
  const copy=async(text,message)=>{
    setError('');
    try{await navigator.clipboard.writeText(text);if(alive.current)setNotice(message);}
    catch{if(alive.current)setError('Copy is unavailable. Select the listening link below to copy it.');}
  };
  const share=async()=>{
    if(pending.current)return;
    pending.current=true;setError('');
    try{await navigator.share({title:cover.title,text:caption,url});if(alive.current)setNotice('Ready in your sharing app.');}
    catch(e){if(e.name!=='AbortError'&&alive.current)setError('Sharing is unavailable here. Copy the link instead.');}
    finally{pending.current=false;}
  };
  return createPortal(<dialog className="pbs-dialog" ref={dialog} aria-labelledby="pbs-title" aria-describedby="pbs-description" onCancel={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className="pbs-content">
      <header className="pbs-header"><div><p>LINKEDIN BEATS · YOUR DEBUT SINGLE</p><h2 id="pbs-title">Share your banger.</h2></div><button type="button" className="pbs-close" onClick={onClose} aria-label="Close share preview"><X size={22}/></button></header>
      <p id="pbs-description" className="pbs-intro">Pick the cover. Let the group chat hear it.</p>
      <div className="pbs-layout"><div className="pbs-artwork"><img className="pbs-preview" src={cover.image} width={cover.width} height={cover.height} alt={cover.alt}/>
      <fieldset className="pbs-covers"><legend>Choose your cover</legend>{COVERS.map(option=><label key={option.id} className={cover.id===option.id?'is-selected':''}>
        <input type="radio" name="beat-cover" value={option.id} checked={cover.id===option.id} onChange={()=>{onCoverChange(option.id);setNotice('');setError('');}}/>
        <img src={option.image} width={option.width} height={option.height} alt=""/>
        <span>{option.name}{cover.id===option.id&&<Check size={14} aria-hidden="true"/>}</span>
      </label>)}</fieldset></div>
      <div className="pbs-options">
      <div className="pbs-caption-heading"><label htmlFor="pbs-caption">The announcement</label><button type="button" onClick={()=>copy(caption,'Caption copied.')}><Copy size={13}/>Copy caption</button></div>
      <textarea id="pbs-caption" rows={3} maxLength={240} value={caption} onChange={event=>onCaptionChange(event.target.value)}/>
      <div className="pbs-main-actions"><button type="button" className="pbs-copy-link" onClick={()=>copy(url,local?'Local preview link copied.':'Listening link copied.')}><Link size={17}/>Copy listening link</button>{nativeShare&&<button type="button" className="pbs-native" onClick={share}><Share2 size={17}/>Share / text</button>}</div>
      <nav className="pbs-destinations" aria-label="Share your beat">
        <a href={targets.linkedin} target="_blank" rel="noopener noreferrer"><Linkedin size={17}/>LinkedIn</a>
        <a href={targets.facebook} target="_blank" rel="noopener noreferrer"><Facebook size={17}/>Facebook</a>
        <a href={targets.x} target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/>X / Twitter</a>
        <a href={targets.email}><Mail size={17}/>Email</a>
      </nav>
      <div className="pbs-instagram"><Instagram size={20} aria-hidden="true"/><div><strong>Taking this to Instagram?</strong><p>Save the cover, then add your listening link with a Story link sticker.</p></div><a href={cover.image} download={`linkedin-beats-${cover.id}.png`}><Download size={16}/>Save cover</a></div>
      <p className="pbs-hint">LinkedIn and Facebook: copy your caption to add it in the post composer.</p>
      {local&&<p className="pbs-local">Local preview: this link works on this computer. Public sharing works on the live site after this update is published.</p>}
      <p className="pbs-notice" role="status">{notice}</p>
      {error&&<div className="pbs-error" role="alert"><p>{error}</p><label>Listening link<input readOnly value={url} onFocus={event=>event.target.select()}/></label></div>}
      </div></div>
    </div>
  </dialog>,document.body);
}
