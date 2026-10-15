import React, {useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';

const POSTER='../store/linkedin-beats-campaign-motion.webp';

export function StoreHero(){
  const videoRef=useRef(null);
  const [paused,setPaused]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change=()=>{if(preference.matches)setPaused(true);};
    preference?.addEventListener('change',change);
    return()=>preference?.removeEventListener('change',change);
  },[]);

  useEffect(()=>{
    const video=videoRef.current;
    if(!video||failed)return;
    let cancelled=false;
    const sync=()=>{
      if(paused||document.hidden){video.pause();return;}
      video.play()?.catch(()=>{if(!cancelled)setPaused(true);});
    };
    sync();
    document.addEventListener('visibilitychange',sync);
    return()=>{cancelled=true;document.removeEventListener('visibilitychange',sync);video.pause();};
  },[paused,failed]);

  return <section className="shop-hero" aria-labelledby="shop-title">
    <div className="shop-hero-art">
      {failed?<img className="shop-hero-photo" src={POSTER} width="832" height="480" alt="Models wearing LinkedIn Beats clothing in a sunlit parking structure."/>:
        <video ref={videoRef} className="shop-hero-photo" src="../store/linkedin-beats-campaign-motion.mp4" poster={POSTER} width="832" height="480" autoPlay={!paused} muted loop playsInline preload="metadata" aria-hidden="true" onError={()=>setFailed(true)}/>}
      <h1 id="shop-title" className="shop-hero-lockup"><img src="../store/wordmark-white-pulse.svg" width="1087" height="104" alt="LinkedIn Beats"/><span>Store</span></h1>
      {!failed&&<button type="button" className="shop-hero-motion" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Play hero video':'Pause hero video'}>{paused?<Play size={16} fill="currentColor" aria-hidden="true"/>:<Pause size={16} fill="currentColor" aria-hidden="true"/>}</button>}
    </div>
  </section>;
}
