import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Linkedin,LoaderCircle,Pause,Play,X} from 'lucide-react';
import {COVERS,getCover,shareUrl,shareDestinations} from './share.js';
import {drawShareArtwork,startShareClip} from './clip.js';
import {beginClipHandoff,downloadClip,LINKEDIN_HOME} from './handoff.js';
import './share-beat.css';
const clock=t=>`0:${String(Math.floor(t||0)).padStart(2,'0')}`;
function Sleeve({recipe,cover}){
  const canvas=useRef(null);
  useEffect(()=>{let active=true;document.fonts.ready.then(()=>{if(active&&canvas.current)drawShareArtwork(canvas.current,null,recipe,0,null,cover);});return()=>{active=false;};},[recipe,cover.id,cover.artist]);
  return <canvas ref={canvas} className="pbs-sleeve" width={1080} height={1080} role="img" aria-label={`${recipe.chorus}. ${cover.artist||'LinkedIn Beats'}. ${cover.name} sleeve.`}/>;
}
export function ShareBeat({initialJob,recipe,coverId,onCoverChange,artist,onArtistChange,caption,onCaptionChange,onClose}){
  const dialog=useRef(null),video=useRef(null),job=useRef(null),alive=useRef(true),unsubscribe=useRef(null),posting=useRef(false);
  const [clip,setClip]=useState(null),[clipUrl,setClipUrl]=useState(''),[making,setMaking]=useState(true),[progress,setProgress]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [playing,setPlaying]=useState(false),[elapsed,setElapsed]=useState(0),[duration,setDuration]=useState(10),[handoff,setHandoff]=useState(null),[editing,setEditing]=useState(false),[draftCover,setDraftCover]=useState(coverId),[draftArtist,setDraftArtist]=useState(artist||'');
  const cover={...getCover(coverId),artist},url=shareUrl(window.location.origin,recipe,cover.id),targets=shareDestinations(url,caption);
  const releaseCode=String([...recipe.chorus].reduce((n,c)=>(n*31+c.charCodeAt(0))%10000,417)).padStart(4,'0');
  const attach=next=>{
    unsubscribe.current?.();if(job.current&&job.current!==next)job.current.controller.abort();job.current=next;
    video.current?.pause();setClip(null);setPlaying(false);setElapsed(0);setMaking(true);setProgress(next.progress);setError('');setNotice('');setHandoff(null);
    const update=p=>{if(alive.current&&job.current===next)setProgress(p);};next.listeners.add(update);unsubscribe.current=()=>next.listeners.delete(update);
    next.promise.then(file=>{if(alive.current&&job.current===next){setClip(file);setMaking(false);}},e=>{if(alive.current&&job.current===next){setMaking(false);if(e.name!=='AbortError')setError(e.message||'The clip could not be prepared. Try again, or post the listening link.');}});
  };
  useEffect(()=>{
    const element=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;alive.current=true;document.body.style.overflow='hidden';element.showModal();element.querySelector('h2')?.focus({preventScroll:true});attach(initialJob);
    return()=>{alive.current=false;job.current?.controller.abort();unsubscribe.current?.();video.current?.pause();element.close();document.body.style.overflow=overflow;focused?.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{if(!clip){setClipUrl('');return;}const href=URL.createObjectURL(clip);setClipUrl(href);return()=>URL.revokeObjectURL(href);},[clip]);
  const copy=async(text,message)=>{try{await navigator.clipboard.writeText(text);if(alive.current){setNotice(message);if(text===caption)setHandoff(prev=>prev?{...prev,caption:'copied'}:prev);}}catch{if(alive.current){setError('Copy is unavailable here. Select the caption or link below.');setEditing(true);}}};
  const play=()=>{if(!clipUrl)return;if(!video.current.paused){video.current.pause();return;}video.current.play().catch(()=>setError('Playback could not start. Try the play button again.'));};
  const save=()=>{if(!clip)return;try{downloadClip(clip);setNotice('Download started.');}catch{setError('The download could not start. Try again, or post the link instead.');}};
  const post=()=>{
    if(!clip||posting.current)return;video.current?.pause();posting.current=true;setNotice('');setError('');
    beginClipHandoff({file:clip,caption,onUpdate:state=>{if(!alive.current)return;if(state.cancelled){setHandoff(null);setNotice('Sharing cancelled. Your clip is ready.');}else setHandoff(state);}}).finally(()=>{posting.current=false;});
  };
  const apply=()=>{const nextArtist=draftArtist.trim();onCoverChange(draftCover);onArtistChange(nextArtist);setEditing(false);attach(startShareClip({recipe,cover:{...getCover(draftCover),artist:nextArtist}}));};
  const retry=()=>attach(startShareClip({recipe,cover}));
  const desktop=handoff?.kind==='desktop',native=handoff?.kind==='native';
  return createPortal(<dialog className="pbs-dialog" ref={dialog} aria-labelledby="pbs-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <div className="pbs-content">
      <header className="pbs-topline"><p>Circle Back Records <span>· CBR-{releaseCode}</span></p><span className="pbs-out-today">Out today</span><button className="pbs-close" type="button" onClick={onClose} aria-label="Close release preview"><X size={23}/></button></header>
      <div className="pbs-layout">
        <div className="pbs-artwork"><Sleeve recipe={recipe} cover={cover}/></div>
        <div className="pbs-options">
          <div className="pbs-titlegroup"><h2 id="pbs-title" tabIndex={-1}>{desktop?<><span>One last</span><span>step.</span></>:<><span>Your single</span><span>is out.</span></>}</h2><p className="pbs-intro">{desktop?'Add the clip to your LinkedIn post. Paste your caption.':native?'Choose LinkedIn in your share sheet, then paste your caption.':'Your words. Your sound. Ready for the feed.'}</p></div>
          {handoff?<div className="pbs-handoff" role="status">
            {desktop&&<p><span className={handoff.download?'is-done':''}>{handoff.download?<Check size={17}/>:<Download size={17}/>}</span>{handoff.download?'Download started':'Download your clip'}</p>}
            <p><span className={handoff.caption==='copied'?'is-done':''}>{handoff.caption==='copied'?<Check size={17}/>:<Copy size={16}/>}</span>{handoff.caption==='copied'?'Caption copied':handoff.caption==='pending'?'Copying caption…':<button type="button" onClick={()=>copy(caption,'Caption copied.')}>Copy caption</button>}</p>
            {desktop&&<p className="pbs-handoff-detail">{handoff.opened?'On LinkedIn, drag the clip from Downloads into the share box.':'Open LinkedIn, then drag the clip from Downloads into the share box.'}</p>}
            {native&&<p className="pbs-handoff-detail">If LinkedIn isn’t listed, save the clip and upload it from the app.</p>}
            {handoff.error&&<p className="pbs-error" role="alert">{handoff.error}</p>}
          </div>:<div className="pbs-player" role="group" aria-label="Single preview">
            <button type="button" className="pbs-play" disabled={!clipUrl} onClick={play} aria-label={making?'Preparing preview':playing?'Pause single':'Play single'}>{making?<LoaderCircle className="pbs-spinner" size={24}/>:playing?<Pause size={24} fill="currentColor"/>:<Play size={24} fill="currentColor"/>}</button>
            <div className="pbs-track"><div><strong>{recipe.chorus}</strong><span>{clock(elapsed)} / {clock(duration)}</span></div><input type="range" min="0" max={duration} step="0.05" value={Math.min(elapsed,duration)} disabled={!clipUrl} aria-label="Single preview position" onChange={e=>{if(video.current)video.current.currentTime=Number(e.target.value);setElapsed(Number(e.target.value));}} style={{'--progress':`${making?progress*100:elapsed/duration*100}%`}}/></div>
          </div>}
          <div className="pbs-action-area">
            {desktop?<a className="pbs-post" href={LINKEDIN_HOME} target="_blank" rel="noopener noreferrer">Open LinkedIn<Linkedin size={24}/></a>:<button className="pbs-post" type="button" disabled={making} onClick={clip?post:retry}>{making?`Preparing clip${progress?` · ${Math.round(progress*100)}%`:'…'}`:clip?'Post it to LinkedIn':'Try preparing again'}{making?<LoaderCircle className="pbs-spinner" size={24}/>:<Linkedin size={24}/>}</button>}
            <a className="pbs-link-fallback" href={targets.linkedin} target="_blank" rel="noopener noreferrer">Post the link instead</a>
          </div>
          <nav className="pbs-utilities" aria-label="Release options"><button type="button" onClick={()=>copy(url,'Listening link copied.')}>Copy link</button><button type="button" disabled={!clip} onClick={save}>Save the clip</button><button type="button" className="pbs-edit-toggle" aria-expanded={editing} onClick={()=>setEditing(!editing)}>{editing?'Done editing':'Change cover or caption'}</button></nav>
          {editing&&<div className="pbs-editor">
            <fieldset><legend>Cover</legend>{COVERS.map(item=><label key={item.id}><input type="radio" name="release-cover" checked={draftCover===item.id} onChange={()=>setDraftCover(item.id)}/><span className={`pbs-swatch pbs-swatch-${item.id}`}/>{item.name}</label>)}</fieldset>
            <label>Artist name<input value={draftArtist} maxLength={48} placeholder="LinkedIn Beats" onChange={e=>setDraftArtist(e.target.value)}/></label>
            <label>Caption<textarea rows={3} maxLength={240} value={caption} onChange={e=>onCaptionChange(e.target.value)}/></label>
            <div><button type="button" onClick={apply}>Apply cover</button><button type="button" onClick={()=>copy(caption,'Caption copied.')}>Copy caption</button></div>
            {error&&<label>Listening link<input readOnly value={url} onFocus={e=>e.target.select()}/></label>}
          </div>}
          <p className="pbs-notice" role="status">{notice}</p>{error&&<p className="pbs-error" role="alert">{error}</p>}
        </div>
      </div>
      {clipUrl&&<video className="pbs-audio-source" ref={video} src={clipUrl} playsInline preload="auto" aria-hidden="true" tabIndex={-1} onLoadedMetadata={e=>setDuration(e.currentTarget.duration||10)} onTimeUpdate={e=>setElapsed(e.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>}
    </div>
  </dialog>,document.body);
}
