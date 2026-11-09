import {PixelDivider} from '../../brand/PixelDivider.jsx';
import React, {useRef, useState} from 'react';
import {DotArrow,DotPlay} from '../arcade/Artwork.jsx';

export function VideoRecap({step, active, onContinue}){
  const [playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
  const video=useRef(null);
  return <section className="pg-recap lb-pixel-divided" aria-label={`Synergy recap: ${step.title}`}>
    <PixelDivider edge/>
    <div className="pg-recap-heading"><img src="/learn/art/synergy-tip-v2.webp" alt=""/><div><span className="pg-eyebrow">A quick recap with Synergy</span><h2>{step.title}</h2></div><span className="pg-recap-duration">{step.duration}</span></div>
    <div className="pg-recap-screen">
      {playing ? <video ref={video} controls autoPlay playsInline preload="metadata" poster={step.poster} onError={()=>setFailed(true)} aria-label={step.title}><source src={step.src} type="video/mp4" onError={()=>setFailed(true)}/></video> : <button type="button" className="pg-recap-play" onClick={()=>setPlaying(true)} aria-label={`Play Synergy recap: ${step.title}`}><img src={step.poster} alt="Synergy demonstrates the lesson" loading="lazy"/><span><DotPlay/>Watch the recap</span></button>}
    </div>
    <p className="pg-recap-description">{step.description}</p>
    {failed && <p className="pg-notice" role="status">The video couldn’t load. The written recap below covers the key points.</p>}
    <details className="pg-recap-notes" open={failed || undefined}><summary>Read the recap</summary><ul>{step.recap.map(line=><li key={line}>{line}</li>)}</ul></details>
    {active && <div className="pg-recap-footer"><span>Watch, read, or keep going.</span><button type="button" className="pg-btn" onClick={()=>{video.current?.pause();onContinue();}}>Got it. Make it official.<DotArrow/></button></div>}
  </section>;
}
