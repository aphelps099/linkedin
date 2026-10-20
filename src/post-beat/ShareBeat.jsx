import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Link,Linkedin,LoaderCircle,Send,Share2,Volume2,X} from 'lucide-react';
import {COVERS,getCover,shareUrl,shareDestinations} from './share.js';
import {cachedClip,createShareClip} from './clip.js';
import './share-beat.css';

const FRIEND_MESSAGE='For the colleague who says “let’s take this offline.”';
export function ShareBeat({recipe,coverId,onCoverChange,caption,onClose}){
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
    setNotice('Clip downloaded.');
  };
  const send=async(linkOnly=false)=>{
    if(pending.current)return;
    if(!linkOnly&&!clip){
      pending.current=true;setMaking(true);setProgress(0);setError('');setNotice('');controller.current=new AbortController();
      try{
        const file=await createShareClip({recipe,cover,signal:controller.current.signal,onProgress:p=>{if(alive.current)setProgress(p);}});
        if(alive.current){setClip(file);setNotice(nativeShare?'Clip ready. Choose Send to a friend to share it.':'Clip ready to save and send.');}
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
        <div className="pbs-topline"><p><span className="pbs-label-mark" aria-hidden="true"/>LINKEDIN BEATS</p><button type="button" className="pbs-close" onClick={onClose} aria-label="Close share preview"><X size={23}/></button></div>
        <h2 id="pbs-title" tabIndex={-1}><span>Share your</span>{' '}<span>banger.</span></h2>
        <div className="pbs-header-bottom"><p id="pbs-description">Pick a cover. Share the sound.</p><span><Volume2 size={16} aria-hidden="true"/>10-second clip</span></div>
      </header>
      <div className="pbs-layout">
        <div className="pbs-artwork">
          <div className="pbs-preview-stage">{clipUrl?<video className="pbs-clip-preview" src={clipUrl} controls playsInline preload="metadata" aria-label="Your 10-second beat clip"/>:<img className="pbs-preview" src={cover.image} alt={cover.alt}/>}</div>
          <fieldset className="pbs-covers" disabled={making}><legend>Choose your cover</legend>{COVERS.map(option=><label key={option.id} className={cover.id===option.id?'is-selected':''}>
            <input type="radio" name="beat-cover" value={option.id} checked={cover.id===option.id} onChange={()=>choose(option.id)}/>
            <img src={option.image} width={option.width} height={option.height} alt=""/>
            <span>{option.name}<i aria-hidden="true">{cover.id===option.id&&<Check size={12}/>}</i></span>
          </label>)}</fieldset>
        </div>
        <div className="pbs-options">
          <h3 className="pbs-beat-title">{recipe.chorus}</h3>
          <button type="button" className="pbs-send-friend" disabled={making} aria-busy={making} onClick={()=>send()}>{making?<LoaderCircle size={23} className="pbs-spinner"/>:<Send size={23}/>}<span>{making?`Making clip${progress>0?` · ${Math.round(progress*100)}%`:'…'}`:clip&&!nativeShare?'Save clip to send':'Send to a friend'}</span></button>
          <div className="pbs-secondary-actions"><button type="button" onClick={()=>copy(url,local?'Local preview link copied.':'Listening link copied.')}><Link size={20}/>Copy link</button><a href={targets.linkedin} target="_blank" rel="noopener noreferrer"><Linkedin size={20}/>LinkedIn</a></div>
          {making&&<><div className="pbs-render-progress" aria-hidden="true"><span style={{width:`${Math.round(progress*100)}%`}}/></div><div className="pbs-making"><p>Keep this window open while your clip is made.</p><button type="button" onClick={()=>controller.current?.abort()}>Cancel</button></div></>}
          <nav className="pbs-utilities" aria-label="More sharing options">
            <button type="button" onClick={()=>copy(caption,'Caption copied.')}><Copy size={16}/>Copy caption</button>
            {clip?<button type="button" onClick={()=>save(clip)}><Download size={16}/>Save clip</button>:<a href={cover.image} download={`linkedin-beats-${cover.id}.png`}><Download size={16}/>Save cover</a>}
            {nativeShare&&<button type="button" onClick={()=>send(true)}><Share2 size={16}/>More</button>}
          </nav>
          <p className="pbs-notice" role="status">{notice}</p>
          {error&&<div className="pbs-error" role="alert"><p>{error}</p><label>Listening link<input readOnly value={url} onFocus={event=>event.target.select()}/></label></div>}
          {local&&<p className="pbs-local">Local preview link.</p>}
        </div>
      </div>
    </div>
  </dialog>,document.body);
}
