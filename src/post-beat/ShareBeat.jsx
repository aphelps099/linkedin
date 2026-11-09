import {BeatType} from './BeatType.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Linkedin,LoaderCircle,Pause,X} from 'lucide-react';
import {COVERS,getCover,shareUrl,shareDestinations,coverPreviewUrl} from './share.js';
import {drawShareArtwork,startShareClip} from './clip.js';
import {loadCoverImage} from './artwork.js';
import {downloadClip,copyText,useNativeClipShare} from './handoff.js';
import './share-beat.css';
import {PegText,DotPlay} from '../program/arcade/Artwork.jsx';
import {LinkedInPublish} from '../sharing/LinkedInPublish.jsx';
const clock=t=>`0:${String(Math.floor(t||0)).padStart(2,'0')}`;
function ArcadeGlyph({kind}){
  const rows=kind==='link'?['  ####       ',' ##  ##      ','##    ##     ','##   ###     ',' ## ### ##   ','   ###   ##  ','    ##    ## ','     ##  ##  ','      ####   ']:kind==='download'?['    ##    ','    ##    ','    ##    ','##  ##  ##',' ######## ','  ######  ','   ####   ','    ##    ','          ','##########']:['############','##        ##','##  ##    ##','##  ####  ##','##  ##### ##','##  ####  ##','##  ##    ##','##        ##','############'];
  return <svg className="pbs-arcade-glyph" viewBox="0 0 14 12" fill="currentColor" aria-hidden="true">{rows.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='#'?[<circle key={`${x}-${y}`} cx={x+1} cy={y+1} r=".36"/>]:[]))}</svg>;
}
function ArcadeChoice({kind,selected,disabled,onClick,copied=false,copying=false}){
  const isLink=kind==='link';
  return <button type="button" className={`pbs-arcade-choice pbs-choice-${kind}${copied?' is-copied':''}`} disabled={disabled} aria-pressed={isLink?undefined:selected} aria-label={isLink?(copying?'Copying link':copied?'Link copied. Copy again':'Copy link'):'Download video'} onClick={onClick}><span className="pbs-choice-lamps" aria-hidden="true"><i/><i/><i/></span><span className="pbs-choice-token">{copied?<Check size={36} aria-hidden="true"/>:<ArcadeGlyph kind={kind}/>}</span><PegText text={isLink?(copying?'COPYING':copied?'COPIED!':'COPY LINK'):'VIDEO'} face="peg9"/><small aria-live={isLink?'polite':undefined}>{isLink?(copied?'Link copied to clipboard':copying?'Copying your listening link…':'Copy your listening link'):'Download your singalong'}</small></button>;
}
function Sleeve({recipe,cover}){
  const canvas=useRef(null);
  useEffect(()=>{const controller=new AbortController();Promise.all([document.fonts.ready,loadCoverImage(cover,controller.signal)]).then(([,image])=>{if(!controller.signal.aborted&&canvas.current)drawShareArtwork(canvas.current,image,recipe,0,null,cover);}).catch(()=>{if(!controller.signal.aborted&&canvas.current)drawShareArtwork(canvas.current,null,recipe,0,null,cover);});return()=>controller.abort();},[recipe,cover.id,cover.artist]);
  return <canvas ref={canvas} className="pbs-sleeve" width={1080} height={1080} role="img" aria-label={`${recipe.chorus}. ${cover.artist||'LinkedIn Beats'}. ${cover.name} sleeve.`}/>;
}
export function ShareBeat({initialJob,recipe,coverId,onCoverChange,artist,onArtistChange,caption,onCaptionChange,onClose}){
  const editButton=useRef(null),dialog=useRef(null),video=useRef(null),job=useRef(null),alive=useRef(true),unsubscribe=useRef(null);
  const [mode,setMode]=useState(initialJob?'video':'link'),[renderError,setRenderError]=useState(''),[imageError,setImageError]=useState(false);
  const [linkCopied,setLinkCopied]=useState(false),[copyingLink,setCopyingLink]=useState(false);
  const [publishing,setPublishing]=useState(false),[directOpen,setDirectOpen]=useState(false);
  const [clip,setClip]=useState(null),[clipUrl,setClipUrl]=useState(''),[making,setMaking]=useState(!!initialJob),[progress,setProgress]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [playing,setPlaying]=useState(false),[elapsed,setElapsed]=useState(0),[duration,setDuration]=useState(10),[editing,setEditing]=useState(false),[draftCover,setDraftCover]=useState(coverId),[draftArtist,setDraftArtist]=useState(artist||'');
  const cover={...getCover(coverId),artist},url=shareUrl(window.location.origin,recipe,cover.id,artist),targets=shareDestinations(url,caption);
  const latestUrl=useRef(url);latestUrl.current=url;
  useEffect(()=>{setImageError(false);setLinkCopied(false);},[coverId,artist,url]);
  const copyLink=async()=>{const copyingUrl=url;setCopyingLink(true);setLinkCopied(false);setError('');try{await copyText(copyingUrl);if(alive.current&&latestUrl.current===copyingUrl)setLinkCopied(true);}catch{if(alive.current)setError('The link could not be copied. Select and copy the listening link below.');}finally{if(alive.current)setCopyingLink(false);}};
  const attach=next=>{
    unsubscribe.current?.();if(job.current&&job.current!==next)job.current.controller.abort();job.current=next;
    video.current?.pause();setClip(null);setPlaying(false);setElapsed(0);setMaking(true);setProgress(next.progress);setError('');setRenderError('');setNotice('');
    const update=p=>{if(alive.current&&job.current===next)setProgress(p);};next.listeners.add(update);unsubscribe.current=()=>next.listeners.delete(update);
    next.promise.then(file=>{if(alive.current&&job.current===next){setClip(file);setMaking(false);}},e=>{if(alive.current&&job.current===next){job.current=null;setMaking(false);if(e.name!=='AbortError')setRenderError(e.message||'The clip could not be prepared. Try again, or share the link.');}});
  };
  useEffect(()=>{
    const element=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;alive.current=true;document.body.style.overflow='hidden';element.showModal();element.querySelector('h2')?.focus({preventScroll:true});if(initialJob)attach(initialJob);
    return()=>{alive.current=false;job.current?.controller.abort();unsubscribe.current?.();video.current?.pause();element.close();document.body.style.overflow=overflow;focused?.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{if(!clip){setClipUrl('');return;}const href=URL.createObjectURL(clip);setClipUrl(href);return()=>URL.revokeObjectURL(href);},[clip]);
  const copy=async(text,message)=>{setError('');try{await copyText(text);if(alive.current)setNotice(message);}catch{if(alive.current)setError('Clipboard unavailable. Select and copy your caption or listening link below.');}};
  const play=()=>{if(!clipUrl)return;if(!video.current.paused){video.current.pause();return;}video.current.play().catch(()=>setError('Playback could not start. Try the play button again.'));};
  const save=()=>{if(!clip)return;setError('');try{downloadClip(clip);setNotice('Download started. Your latest deliverable has a bassline.');}catch{setError('The download could not start. Try again, or share the link instead.');}};
  const nativeShare=async()=>{if(!clip)return;video.current?.pause();try{await navigator.share({files:[clip]});if(alive.current)setNotice('Share sheet completed. Considerable effort, delivered.');}catch(e){if(alive.current&&e.name!=='AbortError')setError('Sharing could not open. Download your video instead.');}};
  const apply=()=>{const nextArtist=draftArtist.trim();onCoverChange(draftCover);onArtistChange(nextArtist);setEditing(false);editButton.current?.focus({preventScroll:true});job.current?.controller.abort();unsubscribe.current?.();job.current=null;setClip(null);setMaking(false);setNotice('Artwork updated. Credit where credit is due.');if(mode==='video')attach(startShareClip({recipe,cover:{...getCover(draftCover),artist:nextArtist}}));};
  const retry=()=>attach(startShareClip({recipe,cover}));
  const compatible=clip?.type==='video/mp4',nativeAvailable=useNativeClipShare(clip);
  const chooseMode=value=>{video.current?.pause();setMode(value);setNotice('');setError('');setDirectOpen(false);if(value==='video'&&!job.current)attach(startShareClip({recipe,cover}));if(value==='link'&&making){job.current?.controller.abort();unsubscribe.current?.();job.current=null;setMaking(false);}};
  return createPortal(<dialog className="pbs-dialog pb-studio-dialog pbs-release" ref={dialog} aria-labelledby="pbs-title" onCancel={e=>{if(publishing)e.preventDefault();else onClose();}} onClick={e=>{if(!publishing&&e.target===dialog.current)onClose();}}>
    <div className="pbs-content">
      <header className="pbs-topline"><p>Independent artist. Dependent on engagement.</p><button className="pbs-close" type="button" disabled={publishing} onClick={onClose} aria-label="Close share preview"><X size={21}/></button></header>
      <div className="pbs-layout">
        <div className="pbs-artwork"><div className="pbs-artwork-label"><span>Your debut, {artist||'thought leader'}.</span><button ref={editButton} type="button" disabled={publishing} aria-expanded={editing} onClick={()=>{setDraftCover(coverId);setDraftArtist(artist||'');setEditing(!editing);}}>{editing?'Close artwork':'Edit artwork'}</button></div>
          <div className={`pbs-media ${mode==='link'?'pbs-media--link':''}`}>
            {mode==='link'&&!imageError?<img className="pbs-link-image" src={coverPreviewUrl(window.location.origin,recipe,cover.id,artist)} alt={`${cover.name}. A debut by ${artist||'LinkedIn Beats'}. ${recipe.chorus}`} onError={()=>setImageError(true)}/>:(mode==='link'||!clipUrl)&&<Sleeve recipe={recipe} cover={cover}/>}
            {clipUrl&&<video className="pbs-video" hidden={mode!=='video'} ref={video} src={clipUrl} playsInline preload="metadata" aria-label="Your exported beat video" onLoadedMetadata={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:10)} onTimeUpdate={e=>setElapsed(e.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>}
            {mode==='video'&&making&&<div className="pbs-rendering" role="status"><span>Pressing your single… <strong>{Math.round(progress*100)}%</strong></span><progress value={progress} max={1} aria-label="Preparing video"/></div>}
          </div>
          <p className="pbs-media-note">{mode==='video'?`10-second singalong · Your artwork, words and mix`:imageError?'Artwork preview unavailable. Your listening link still works.':'Your artwork opens the full 30-second single.'}</p>
          {mode==='video'&&<div className="pbs-player" role="group" aria-label="Video preview controls">
            <button type="button" className="pbs-play" disabled={!clipUrl} onClick={play} aria-label={making?'Preparing preview':playing?'Pause preview':'Play preview'}>{making?<LoaderCircle className="pbs-spinner" size={21}/>:playing?<Pause size={21} fill="currentColor"/>:<DotPlay/>}</button>
            <div className="pbs-track"><div><strong>{playing?'Playing your clip':'Preview your clip'}</strong><span>{clock(elapsed)} / {clock(duration)}</span></div><input type="range" min="0" max={duration} step="0.05" value={Math.min(elapsed,duration)} disabled={!clipUrl} aria-label="Video preview position" onChange={e=>{if(video.current)video.current.currentTime=Number(e.target.value);setElapsed(Number(e.target.value));}}/></div>
          </div>}
          {editing&&!publishing&&<div className="pbs-editor">
            <label>Artist name<input value={draftArtist} maxLength={48} placeholder="LinkedIn Beats" onChange={e=>setDraftArtist(e.target.value)}/></label>
            <fieldset><legend>Choose a sleeve</legend>{COVERS.map(item=><label className="pbs-cover-choice" key={item.id}><input type="radio" name="release-cover" checked={draftCover===item.id} onChange={()=>setDraftCover(item.id)}/><img src={item.image} width={item.width} height={item.height} alt=""/><span>{item.name}</span></label>)}</fieldset>
            <button type="button" onClick={apply}><BeatType text="Use this artwork"/></button>
          </div>}
        </div>
        <div className="pbs-options">
          <div className="pbs-titlegroup"><h2 id="pbs-title" tabIndex={-1}><span className="sr-only">Release your single.</span><PegText text="RELEASE." face="peg9"/></h2><p className="pbs-intro">Your audience awaits. Allegedly.</p></div>
          <div className="pbs-caption-label"><label htmlFor="pbs-caption">Your announcement</label><button type="button" onClick={()=>copy(caption,'Caption copied. A modest announcement, naturally.')}>Copy <Copy size={13}/></button></div>
          <textarea className="pbs-caption" id="pbs-caption" rows={4} maxLength={3000} disabled={publishing} value={caption} onChange={e=>onCaptionChange(e.target.value)}/>
          <a className="pbs-post pbs-release-primary pbs-linkedin-primary" aria-label="Post to LinkedIn" aria-disabled={publishing||undefined} href={targets.linkedin} target="_blank" rel="noopener noreferrer" onClick={e=>{if(publishing){e.preventDefault();return;}video.current?.pause();copy(caption,'Caption copied. Paste it into your LinkedIn post.');}}><span className="pbs-primary-key"><Linkedin size={30} aria-hidden="true"/></span><span className="pbs-primary-title"><PegText text="POST TO" face="peg5"/><PegText text="LINKEDIN" face="peg9"/></span><span className="pbs-primary-lamps" aria-hidden="true"><i/><i/><i/></span></a>
          <p className="pbs-action-note">Copies your caption and opens LinkedIn with your listening link. You review and post.</p>
          <div className="pbs-modes pbs-arcade-choices pbs-other-actions" role="group" aria-label="Other ways to share"><ArcadeChoice kind="link" copied={linkCopied} copying={copyingLink} disabled={publishing||copyingLink} onClick={copyLink}/><ArcadeChoice kind="video" selected={mode==='video'} disabled={publishing} onClick={()=>chooseMode(mode==='video'?'link':'video')}/></div>
          {mode==='video'&&<button className="pbs-save-secondary" type="button" disabled={making||publishing} onClick={clip?save:retry}>{making?<LoaderCircle className="pbs-spinner" size={18}/>:<Download size={18}/>}<BeatType text={making?'Preparing video':clip?compatible?'Download MP4':'Download WebM':'Try video again'}/></button>}
          {notice&&<div className="pbs-release-receipt" role="status"><Check size={19}/><p>{notice}</p><button type="button" disabled={publishing} onClick={onClose}>Back to your single</button></div>}
          {mode==='video'&&nativeAvailable&&<button className="pbs-linkedin-secondary" type="button" onClick={nativeShare}>Open share sheet</button>}
          {mode==='video'&&<details className="pbs-direct" open={directOpen} onToggle={e=>setDirectOpen(publishing||e.currentTarget.open)}><summary>Publish directly to LinkedIn</summary>{directOpen&&<LinkedInPublish file={clip} title={recipe.chorus.slice(0,200)} caption={caption} disabled={making||!compatible} onBusyChange={setPublishing}/>}</details>}
          {mode==='video'&&renderError&&<p className="pbs-error" role="alert">{renderError} <button type="button" onClick={()=>chooseMode('link')}>Share a link instead</button></p>}
          {error&&<div className="pbs-error" role="alert"><p>{error}</p><label>Listening link<input readOnly value={url} onFocus={e=>e.target.select()}/></label></div>}
        </div>
      </div>
    </div>
  </dialog>,document.body);
}
