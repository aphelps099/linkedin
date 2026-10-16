import React, {useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';

export function StoreHero(){
  const hero=useRef(null);
  const [paused,setPaused]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
  const [visible,setVisible]=useState(true);
  useEffect(()=>{
    let inView=true;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});
    observer.observe(hero.current);
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>{if(preference.matches)setPaused(true);};
    preference.addEventListener('change',change);
    document.addEventListener('visibilitychange',sync);
    return()=>{observer.disconnect();preference.removeEventListener('change',change);document.removeEventListener('visibilitychange',sync);};
  },[]);
  return <section className="shop-hero" aria-labelledby="shop-title">
    <div className="shop-hero-art" ref={hero}>
      <picture>
        <source media="(max-width: 760px)" srcSet="../store/look-serious-circle-back-mobile.webp" width="1254" height="1254"/>
        <img className="shop-hero-photo" style={{animationPlayState:paused||!visible?'paused':'running'}} src="../store/look-serious-circle-back-hero.webp" width="1650" height="953" fetchPriority="high" alt="Five models in a sunlit parking garage wearing the LinkedIn Beats Look Serious collection: SERIOUS. tees, stacked CIRCLE BACK on the kneeling model’s navy shirt, and stacked OUT OF OFFICE on blue and pink tops."/>
      </picture>
      <h1 id="shop-title" className="shop-hero-lockup"><img src="../store/wordmark-white-pulse.svg" width="1087" height="104" alt="LinkedIn Beats"/><span>Store</span></h1>
      <button className="shop-hero-motion" type="button" aria-label={paused?'Play hero motion':'Pause hero motion'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<Play size={16} fill="currentColor" aria-hidden="true"/>:<Pause size={16} fill="currentColor" aria-hidden="true"/>}</button>
    </div>
  </section>;
}
