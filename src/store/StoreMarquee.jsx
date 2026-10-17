import React, {useEffect, useId, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';
import './store-marquee.css';

const PHRASES=['Dress for the job you post about.','Shop the Circle Back collection.','Take it offline.'];

// A small-scale version of public/home-experiments/office-droid.svg. Keep its
// original silhouette and offset visor; omit details that disappear at 24px.
function StoreDroid(){
  const id=useId();
  return <svg className="store-tow-droid" viewBox="95 50 610 440" width="34" height="24" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-body`} x1="110" y1="320" x2="690" y2="445" gradientUnits="userSpaceOnUse"><stop stopColor="#faf7e9"/><stop offset=".6" stopColor="#e5e1d1"/><stop offset="1" stopColor="#bcbcac"/></linearGradient>
      <linearGradient id={`${id}-dome`} x1="320" y1="65" x2="590" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".44" stopColor="#d8dfe1"/><stop offset=".8" stopColor="#8e999f"/><stop offset="1" stopColor="#e0e3df"/></linearGradient>
      <linearGradient id={`${id}-blue`} x1="400" y1="275" x2="400" y2="341" gradientUnits="userSpaceOnUse"><stop stopColor="#75bdff"/><stop offset="1" stopColor="#0758bc"/></linearGradient>
    </defs>
    <path d="M158 435C156 457 166 477 191 481L225 479C242 476 252 460 252 441ZM537 443C535 464 546 480 567 482L599 480C617 478 627 461 626 441Z" fill="#22333e" stroke="#82939f" strokeWidth="8"/>
    <path d="M123 299C111 329 102 386 104 427C104 451 229 466 398 466C566 466 696 449 696 425C697 382 688 328 676 299Z" fill={`url(#${id}-body)`}/>
    <path d="M125 292C128 276 246 264 399 264C550 264 674 276 678 292L684 314C632 334 521 341 400 341C283 341 171 335 116 315Z" fill={`url(#${id}-blue)`}/>
    <path d="M142 279C194 294 285 305 401 305C519 305 612 291 661 278L660 288C606 308 514 316 400 316C286 316 193 306 143 290Z" fill="#182a32"/>
    <path d="M138 276C145 225 174 167 223 124C271 82 332 60 398 59C468 58 532 78 585 116C640 155 673 216 682 275C683 289 560 305 407 306C252 308 135 292 138 276Z" fill="#eeeada"/>
    <path d="M221 126C270 83 332 60 398 59C468 58 532 78 585 116C627 145 658 190 672 232C673 250 660 263 636 268C591 277 553 275 525 267C499 259 482 245 457 222C393 162 309 126 221 126Z" fill={`url(#${id}-dome)`}/>
    <path d="M540 197C565 190 605 188 622 188C631 189 634 195 639 208L648 232C651 241 648 246 640 249C615 256 571 260 552 256C543 254 539 249 536 237L531 214C529 205 532 200 540 197Z" fill="#101d28" stroke="#f1f5f4" strokeWidth="9"/>
    <path d="M608 370L636 366L642 420L607 426Z" fill="#136ed0"/>
    <path d="M153 350L176 353V370L152 367Z" fill="#566362"/>
    <circle className="store-tow-light" cx="621" cy="350" r="15" fill="#8ce8ff"/>
  </svg>;
}

export function StoreMarquee(){
  const root=useRef(null),lap=useRef(null);
  const [motion,setMotion]=useState(false),[visible,setVisible]=useState(false),[paused,setPaused]=useState(false);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>setMotion(!preference.matches);
    change();
    preference.addEventListener('change',change);
    let inView=false;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});
    observer.observe(root.current);
    document.addEventListener('visibilitychange',sync);
    const measure=()=>{
      const width=lap.current?.getBoundingClientRect().width;
      if(width)root.current?.style.setProperty('--store-tow-duration',`${(width/36).toFixed(2)}s`);
    };
    const resize=new ResizeObserver(measure);
    resize.observe(lap.current);
    measure();
    return()=>{preference.removeEventListener('change',change);observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);

  return <aside id="store-marquee" ref={root} className={`store-tow${motion?'':' is-still'}`} data-running={motion&&visible&&!paused} aria-label="The Circle Back collection">
    <a className="store-tow-link" href="#collection" aria-label="Shop the Circle Back collection" onClick={()=>document.getElementById('collection-title')?.focus({preventScroll:true})}>
      <span className="store-tow-track" aria-hidden="true">
        {[0,1,2].map(copy=><span className="store-tow-lap" ref={copy===0?lap:undefined} key={copy}>
          <span className="store-tow-words">{PHRASES.map((phrase,index)=><React.Fragment key={phrase}>{index>0&&<span className="store-tow-dot">·</span>}<span className="store-tow-phrase" data-shop={index===1}>{phrase}</span></React.Fragment>)}</span>
          <span className="store-tow-line"/><StoreDroid/><span className="store-tow-gap"/>
        </span>)}
      </span>
    </a>
    {motion&&<button type="button" className="store-tow-pause" aria-label={paused?'Resume store marquee':'Pause store marquee'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<Play size={14} aria-hidden="true"/>:<Pause size={14} aria-hidden="true"/>}</button>}
  </aside>;
}
