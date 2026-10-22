import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Linkedin,LoaderCircle,Pause,Play,X} from 'lucide-react';
import {COVERS,getCover,shareUrl,shareDestinations,coverPreviewUrl} from './share.js';
import {drawShareArtwork,startShareClip} from './clip.js';
import {beginClipHandoff,downloadClip,copyText,useNativeClipShare,LINKEDIN_HOME} from './handoff.js';
import './share-beat.css';
const clock=t=>`0:${String(Math.floor(t||0)).padStart(2,'0')}`;
function Sleeve({recipe,cover}){
  const canvas=useRef(null);
  useEffect(()=>{let active=true;document.fonts.ready.then(()=>{if(active&&canvas.current)drawShareArtwork(canvas.current,null,recipe,0,null,cover);});return()=>{active=false;};},[recipe,cover.id,cover.artist]);
  return <canvas ref={canvas} className="pbs-sleeve" width={1080} height={1080} role="img" aria-label={`${recipe.chorus}. ${cover.artist||'LinkedIn Beats'}. ${cover.name} sleeve.`}/>;
}
export function ShareBeat({initialJob,recipe,coverId,onCoverChange,artist,onArtistChange,caption,onCaptionChange,onClose}){
  const dialog=useRef(null),video=useRef(null),job=useRef(null),alive=useRef(true),unsubscribe=useRef(null),posting=useRef(false);
  const [mode,setMode]=useState('video'),[renderError,setRenderError]=useState(''),[imageError,setImageError]=useState(false);
  useEffect(()=>setImageError(false),[coverId,artist]);
  const [clip,setClip]=useState(null),[clipUrl,setClipUrl]=useState(''),[making,setMaking]=useState(true),[progress,setProgress]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [playing,setPlaying]=useState(false),[elapsed,setElapsed]=useState(0),[duration,setDuration]=useState(10),[handoff,setHandoff]=useState(null),[editing,setEditing]=useState(false),[draftCover,setDraftCover]=useState(coverId),[draftArtist,setDraftArtist]=useState(artist||'');
  const cover={...getCover(coverId),artist},url=shareUrl(window.location.origin,recipe,cover.id,artist),targets=shareDestinations(url,caption);
  const releaseCode=String([...recipe.chorus].reduce((n,c)=>(n*31+c.charCodeAt(0))%10000,417)).padStart(4,'0');
  const attach=next=>{
    unsubscribe.current?.();if(job.current&&job.current!==next)job.current.controller.abort();job.current=next;
    video.current?.pause();setClip(null);setPlaying(false);setElapsed(0);setMaking(true);setProgress(next.progress);setError('');setRenderError('');setNotice('');setHandoff(null);
    const update=p=>{if(alive.current&&job.current===next)setProgress(p);};next.listeners.add(update);unsubscribe.current=()=>next.listeners.delete(update);
    next.promise.then(file=>{if(alive.current&&job.current===next){setClip(file);setMaking(false);}},e=>{if(alive.current&&job.current===next){setMaking(false);if(e.name!=='AbortError')setRenderError(e.message||'The clip could not be prepared. Try again, or post the listening link.');}});
  };
  useEffect(()=>{
    const element=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;alive.current=true;document.body.style.overflow='hidden';element.showModal();element.querySelector('h2')?.focus({preventScroll:true});attach(initialJob);
    return()=>{alive.current=false;job.current?.controller.abort();unsubscribe.current?.();video.current?.pause();element.close();document.body.style.overflow=overflow;focused?.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{if(!clip){setClipUrl('');return;}const href=URL.createObjectURL(clip);setClipUrl(href);return()=>URL.revokeObjectURL(href);},[clip]);
  const copy=async(text,message)=>{try{await copyText(text);if(alive.current){setNotice(message);if(text===caption)setHandoff(prev=>prev?{...prev,caption:'copied'}:prev);}}catch{if(alive.current){setError('Copy is unavailable here. Select the caption or link below.');setEditing(true);}}};
  const play=()=>{if(!clipUrl)return;if(!video.current.paused){video.current.pause();return;}video.current.play().catch(()=>setError('Playback could not start. Try the play button again.'));};
  const save=()=>{if(!clip)return;try{downloadClip(clip);setNotice('Download started.');}catch{setError('The download could not start. Try again, or post the link instead.');}};
  const post=()=>{
    if(!clip||posting.current)return;video.current?.pause();posting.current=true;setNotice('');setError('');
    beginClipHandoff({file:clip,caption,onUpdate:state=>{if(!alive.current)return;if(state.cancelled){setHandoff(null);setNotice('Sharing cancelled. Your clip is ready.');}else setHandoff(state);}}).finally(()=>{posting.current=false;});
  };
  const apply=()=>{const nextArtist=draftArtist.trim();onCoverChange(draftCover);onArtistChange(nextArtist);setEditing(false);attach(startShareClip({recipe,cover:{...getCover(draftCover),artist:nextArtist}}));};
  const retry=()=>attach(startShareClip({recipe,cover}));
  const desktop=handoff?.kind==='desktop';
  const compatible=clip?.type==='video/mp4',nativeAvailable=useNativeClipShare(clip);
  const chooseMode=value=>{video.current?.pause();setMode(value);setHandoff(null);setNotice('');};
  return createPortal(<dialog className="pbs-dialog" ref={dialog} aria-labelledby="pbs-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <div className="pbs-content">
      <header className="pbs-topline"><p>LinkedIn Beats <span> / CBR-{releaseCode}</span></p><button className="pbs-close" type="button" onClick={onClose} aria-label="Close share preview"><X size={21}/></button></header>
      <div className="pbs-layout">
        <div className="pbs-artwork">
          <div className={`pbs-media ${mode==='link'?'pbs-media--link':''}`}>
            {mode==='link'&&!imageError?<img className="pbs-link-image" src={coverPreviewUrl(window.location.origin,recipe,cover.id,artist)} alt={`Link preview: ${recipe.chorus}`} onError={()=>setImageError(true)}/>:(mode==='link'||!clipUrl)&&<Sleeve recipe={recipe} cover={cover}/>}
            {clipUrl&&<video className="pbs-video" hidden={mode!=='video'} ref={video} src={clipUrl} playsInline preload="metadata" aria-label="Your exported beat video" onLoadedMetadata={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:10)} onTimeUpdate={e=>setElapsed(e.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>}
            {mode==='video'&&making&&<div className="pbs-rendering" role="status"><LoaderCircle className="pbs-spinner" size={17}/>Preparing video · {Math.round(progress*100)}%</div>}
          </div>
          <p className="pbs-media-note">{mode==='video'?`Video preview · ${clock(duration)} · Sound on when played`:imageError?'Artwork unavailable · Your listening link still works':'Link preview · Opens your listening page'}</p>
          {mode==='video'&&<div className="pbs-player" role="group" aria-label="Video preview controls">
            <button type="button" className="pbs-play" disabled={!clipUrl} onClick={play} aria-label={making?'Preparing preview':playing?'Pause preview':'Play preview'}>{making?<LoaderCircle className="pbs-spinner" size={21}/>:playing?<Pause size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}</button>
            <div className="pbs-track"><div><strong>{playing?'Playing your clip':'Preview your clip'}</strong><span>{clock(elapsed)} / {clock(duration)}</span></div><input type="range" min="0" max={duration} step="0.05" value={Math.min(elapsed,duration)} disabled={!clipUrl} aria-label="Video preview position" onChange={e=>{if(video.current)video.current.currentTime=Number(e.target.value);setElapsed(Number(e.target.value));}} style={{'--progress':`${making?progress*100:elapsed/duration*100}%`}}/></div>
          </div>}
        </div>
        <div className="pbs-options">
          <div className="pbs-titlegroup"><h2 id="pbs-title" tabIndex={-1}>{handoff?'Make it official.':'Ready for the feed.'}</h2><p className="pbs-intro">Your words. Set to music.</p></div>
          <div className="pbs-modes" role="group" aria-label="Share format"><button type="button" aria-pressed={mode==='video'} onClick={()=>chooseMode('video')}>Share video</button><button type="button" aria-pressed={mode==='link'} onClick={()=>chooseMode('link')}>Listening link</button></div>
          <p className="pbs-format-note">{mode==='link'?'Share an artwork preview that opens the full beat on LinkedIn Beats.':nativeAvailable?'Share the video file to LinkedIn from your device’s share sheet.':'Download the video, then attach it to your LinkedIn post. It will play in the feed.'}</p>
          <div className="pbs-caption-label"><label htmlFor="pbs-caption">Your caption</label><button type="button" onClick={()=>copy(caption,'Caption copied.')}>Copy <Copy size={13}/></button></div>
          <textarea className="pbs-caption" id="pbs-caption" rows={3} maxLength={240} value={caption} onChange={e=>onCaptionChange(e.target.value)}/>
          {handoff&&<div className="pbs-handoff" role="status">
            {desktop&&<p>{handoff.download?<Check size={17}/>:<Download size={17}/>} {handoff.download?'Download started':'Save the clip below to try again'}</p>}
            <p>{handoff.caption==='copied'?<Check size={17}/>:<Copy size={16}/>} {handoff.caption==='copied'?'Caption copied':handoff.caption==='pending'?'Copying caption…':'Select and copy your caption above'}</p>
            <p className="pbs-handoff-detail">{desktop?'In LinkedIn, choose Video, attach the clip from Downloads, and paste your caption. You choose when to post.':'Choose LinkedIn in the share sheet. If it isn’t listed, save the clip and attach it in the LinkedIn app.'}</p>
            {handoff.error&&<p className="pbs-error" role="alert">{handoff.error}</p>}
          </div>}
          <div className="pbs-action-area">
            {mode==='link'?<a className="pbs-post" href={targets.linkedin} target="_blank" rel="noopener noreferrer" onClick={()=>{video.current?.pause();copy(caption,'Caption copied. Paste it in LinkedIn.');}}>Continue to LinkedIn<Linkedin size={21}/></a>:desktop?<a className="pbs-post" href={LINKEDIN_HOME} target="_blank" rel="noopener noreferrer">Open LinkedIn<Linkedin size={21}/></a>:<button className="pbs-post" type="button" disabled={making||!!clip&&!compatible||handoff?.sharing} onClick={clip?post:retry}>{making?`Preparing video · ${Math.round(progress*100)}%`:clip?compatible?'Continue to LinkedIn':'MP4 unavailable here':'Prepare video again'}{making?<LoaderCircle className="pbs-spinner" size={21}/>:<Linkedin size={21}/>}</button>}
            {mode==='video'&&clip&&!compatible&&<p className="pbs-error">This browser exported WebM. Use the listening link, or try Chrome or Safari for an MP4.</p>}
            {mode==='video'&&!handoff&&<p className="pbs-action-note">{nativeAvailable?'Opens your share sheet and copies your caption.':'Opens LinkedIn, starts the download, and copies your caption.'}</p>}
          </div>
          <nav className="pbs-utilities" aria-label="Share options"><button type="button" onClick={()=>copy(url,'Listening link copied.')}>Copy link</button>{mode==='video'&&<button type="button" disabled={!clip} onClick={save}>Save video</button>}<button type="button" aria-expanded={editing} onClick={()=>setEditing(!editing)}>{editing?'Close cover options':'Change cover'}</button></nav>
          {editing&&<div className="pbs-editor">
            <fieldset><legend>Cover</legend>{COVERS.map(item=><label key={item.id}><input type="radio" name="release-cover" checked={draftCover===item.id} onChange={()=>setDraftCover(item.id)}/><span className={`pbs-swatch pbs-swatch-${item.id}`}/>{item.name}</label>)}</fieldset>
            <label>Artist name<input value={draftArtist} maxLength={48} placeholder="LinkedIn Beats" onChange={e=>setDraftArtist(e.target.value)}/></label>
            <button type="button" onClick={apply}>Apply cover</button>
            {error&&<label>Listening link<input readOnly value={url} onFocus={e=>e.target.select()}/></label>}
          </div>}
          <p className="pbs-notice" role="status">{notice}</p>{mode==='video'&&renderError&&<p className="pbs-error" role="alert">{renderError} Your listening link is ready to share.</p>}{error&&<p className="pbs-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  </dialog>,document.body);
}
