import React, {useEffect, useRef, useState} from 'react';
import {ArrowDownRight, Pause, Play} from 'lucide-react';

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
      <div className="shop-hero-copy"><p className="shop-hero-eyebrow">Store</p><h1 id="shop-title"><span>Wear your</span><span>boundaries.</span></h1></div>
      <a className="shop-hero-go" href="#collection" aria-label="Shop the collection"><ArrowDownRight size={28} aria-hidden="true"/></a>
      <button className="shop-hero-motion" type="button" aria-label={paused?'Play hero motion':'Pause hero motion'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<Play size={16} fill="currentColor" aria-hidden="true"/>:<Pause size={16} fill="currentColor" aria-hidden="true"/>}</button>
    </div>
  </section>;
}
