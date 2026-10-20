import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Instagram,Link,Linkedin,LoaderCircle,Send,Share2,Volume2,X} from 'lucide-react';
import {COVERS,getCover,shareUrl,shareDestinations} from './share.js';
import {cachedClip,createShareClip,drawShareArtwork} from './clip.js';
import './share-beat.css';

const FRIEND_MESSAGE='For the colleague who says “let’s take this offline.”';
function ShareArtwork({recipe,cover}){
  const canvas=useRef(null);const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;setFailed(false);const image=new Image();image.src=cover.image;
    Promise.all([image.decode(),document.fonts.load('86px Anton'),document.fonts.load('22px C2Hoves')]).then(()=>{if(active&&canvas.current)drawShareArtwork(canvas.current,image,recipe);}).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[recipe,cover]);
  return failed?<img className="pbs-preview-fallback" src={cover.image} alt={cover.alt}/>:<canvas ref={canvas} className="pbs-preview" width={1080} height={1080} role="img" aria-label={`${recipe.chorus} — your debut single. ${cover.name} cover.`}/>;
}
export function ShareBeat({recipe,coverId,onCoverChange,caption,onCaptionChange,onClose}){
  const dialog=useRef(null),pending=useRef(false),alive=useRef(true),controller=useRef(null);
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[clip,setClip]=useState(()=>cachedClip(recipe,getCover(coverId))||null),[making,setMaking]=useState(false),[progress,setProgress]=useState(0);
  const cover=getCover(coverId),url=shareUrl(window.location.origin,recipe,cover.id);
  const targets=shareDestinations(url,caption);
  const local=['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
  const nativeShare=typeof navigator.share==='function';
  const [clipUrl,setClipUrl]=useState('');
  useEffect(()=>{if(!clip){setClipUrl('');return;}const href=URL.createObjectURL(clip);setClipUrl(href);return()=>URL.revokeObjectURL(href);},[clip]);
  useEffect(()=>{
    const element=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;
    alive.current=true;document.body.style.overflow='hidden';element.showModal();
    element.querySelector('h2')?.focus({preventScroll:true});
    return()=>{alive.current=false;controller.current?.abort();element.close();document.body.style.overflow=overflow;focused?.focus({preventScroll:true});};
  },[]);
  const copy=async(text,message)=>{
    setError('');
    try{await navigator.clipboard.writeText(text);if(alive.current)setNotice(message);}
    catch{if(alive.current)setError('Copy is unavailable. Select the listening link below to copy it.');}
  };
  const save=file=>{
    const href=URL.createObjectURL(file),a=document.createElement('a');a.href=href;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
    setNotice('Download started. Drop the clip into your group chat.');
  };
  const send=async(linkOnly=false)=>{
    if(pending.current)return;
    if(!linkOnly&&!clip){
      pending.current=true;setMaking(true);setProgress(0);setError('');setNotice('');controller.current=new AbortController();
      try{
        const file=await createShareClip({recipe,cover,signal:controller.current.signal,onProgress:p=>{if(alive.current)setProgress(p);}});
        if(alive.current){setClip(file);setNotice(nativeShare?'Your clip is ready. Tap Send to a friend to choose where it goes.':'Your clip is ready. Save it for your group chat, or copy the listening link.');}
      }catch(e){if(e.name!=='AbortError'&&alive.current)setError(e.message||'The clip could not be made. You can still send the listening link.');}
      finally{pending.current=false;if(alive.current)setMaking(false);}
      return;
    }
    if(!nativeShare){if(!linkOnly&&clip)save(clip);else await copy(url,'Listening link copied. Paste it into your group chat.');return;}
    pending.current=true;setError('');
    try{
      const files=!linkOnly&&clip&&navigator.canShare?.({files:[clip]});
      await navigator.share(files?{files:[clip],title:recipe.chorus,text:FRIEND_MESSAGE}:{title:recipe.chorus,text:FRIEND_MESSAGE,url});
      if(alive.current)setNotice('Shared with your chosen app.');
    }catch(e){if(e.name!=='AbortError'&&alive.current)setError('Sharing is unavailable here. Save your clip or copy the listening link.');}
    finally{pending.current=false;}
  };
  const choose=id=>{controller.current?.abort();onCoverChange(id);setClip(cachedClip(recipe,getCover(id))||null);setNotice('');setError('');};
  return createPortal(<dialog className="pbs-dialog" ref={dialog} aria-labelledby="pbs-title" aria-describedby="pbs-description" onCancel={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className="pbs-content">
      <header className="pbs-header">
        <div className="pbs-topline"><p><span className="pbs-label-mark" aria-hidden="true"/>LINKEDIN BEATS<span className="pbs-topline-divider"> / </span><span>YOUR DEBUT SINGLE</span></p><button type="button" className="pbs-close" onClick={onClose} aria-label="Close share preview"><X size={23}/></button></div>
        <h2 id="pbs-title" tabIndex={-1}><span>Share your</span>{' '}<span>banger.</span></h2>
        <div className="pbs-header-bottom"><p id="pbs-description" className="pbs-intro">Pick the cover. Let the group chat hear it.</p><span className="pbs-format"><Volume2 size={15} aria-hidden="true"/>10 seconds. With sound.</span></div>
      </header>
      <div className="pbs-layout"><div className="pbs-artwork">
      <div className="pbs-section-label"><span>Your release</span><span>{clip?'Ready to play':'Cover preview'}</span></div>
      <div className="pbs-preview-stage">{clipUrl?<video className="pbs-clip-preview" src={clipUrl} controls playsInline preload="metadata" aria-label="Your 10-second beat clip"/>:<ShareArtwork recipe={recipe} cover={cover}/>}</div>
      <fieldset className="pbs-covers" disabled={making}><legend>Choose your cover</legend>{COVERS.map((option,index)=><label key={option.id} className={cover.id===option.id?'is-selected':''}>
        <input type="radio" name="beat-cover" value={option.id} checked={cover.id===option.id} onChange={()=>choose(option.id)}/>
        <img src={option.image} width={option.width} height={option.height} alt=""/>
        <span><small aria-hidden="true">0{index+1}</small>{option.name}<i aria-hidden="true">{cover.id===option.id&&<Check size={11}/>}</i></span>
      </label>)}</fieldset></div>
      <div className="pbs-options">
      <p className="pbs-section-label">Good music travels.</p>
      <p className="pbs-friend-line">For the colleague who says <em>“let’s take this offline.”</em></p>
      <div className="pbs-main-actions"><button type="button" className="pbs-send-friend" disabled={making} aria-busy={making} onClick={()=>send()}>{making?<LoaderCircle size={21} className="pbs-spinner"/>:<Send size={21}/>}<span>{making?`Making your clip${progress>0?` · ${Math.round(progress*100)}%`:'…'}`:clip&&!nativeShare?'Save clip to send':'Send to a friend'}</span></button><button type="button" className="pbs-copy-link" onClick={()=>copy(url,local?'Local preview link copied.':'Listening link copied.')}><Link size={18}/>Copy link</button></div>
      {making&&<div className="pbs-render-progress" aria-hidden="true"><span style={{width:`${Math.round(progress*100)}%`}}/></div>}
      {making?<div className="pbs-making"><p>Keep this window open. Your chorus is playing into the clip.</p><button type="button" onClick={()=>controller.current?.abort()}>Cancel</button></div>:<div className="pbs-quick-links">{clip&&<button type="button" onClick={()=>save(clip)}><Download size={15}/>Save clip</button>}<button type="button" onClick={()=>send(true)}>Send the listening link</button></div>}
      <p className="pbs-notice" role="status">{notice}</p>
      {error&&<div className="pbs-error" role="alert"><p>{error}</p><label>Listening link<input readOnly value={url} onFocus={event=>event.target.select()}/></label></div>}
      <a className="pbs-linkedin" href={targets.linkedin} target="_blank" rel="noopener noreferrer"><Linkedin size={19}/><span>Post to LinkedIn</span><small>Make it official.</small></a>
      <div className="pbs-caption">
      <div className="pbs-caption-heading"><label htmlFor="pbs-caption">The announcement</label><button type="button" onClick={()=>copy(caption,'Caption copied.')}><Copy size={13}/>Copy caption</button></div>
      <textarea id="pbs-caption" rows={3} maxLength={240} value={caption} onChange={event=>onCaptionChange(event.target.value)}/>
      </div>
      <nav className="pbs-destinations" aria-label="More ways to share your beat"><a href={targets.x} target="_blank" rel="noopener noreferrer"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h4l10 18h-4L5 3Zm14 0L5 21" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>Post to X</a><a href={cover.image} download={`linkedin-beats-${cover.id}.png`}><Download size={16}/>Save cover</a>{nativeShare&&<button type="button" onClick={()=>send(true)}><Share2 size={16}/>More</button>}</nav>
      <p className="pbs-hint"><Instagram size={17} aria-hidden="true"/><span>Taking it to Instagram?<br/>Save the clip. Drop it into a Story or Reel.</span></p>
      {local&&<p className="pbs-local">Local preview: listening links work on this computer. Public links work on the live site.</p>}
      </div></div>
      <footer className="pbs-footer"><span>Your words. Your beat.</span><span>HR would like a word.</span></footer>
    </div>
  </dialog>,document.body);
}
