import React, {useEffect, useRef, useState} from 'react';
import {frame, SP, ICONS} from '../game/art.js';

function Sprite({rows, palette, ...props}) {
  return <g {...props}>{rows.flatMap((row,y)=>[...row].map((pixel,x)=>pixel==='.'?null:
    <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={typeof palette==='string'?palette:palette[pixel]}/>))}</g>;
}

// The game's own sprites, drawn as crisp vectors rather than a separate illustration.
function CareerArtwork() {
  return <svg className="career-game-art" viewBox="0 0 480 400" aria-hidden="true" shapeRendering="crispEdges">
    <defs><pattern id="career-game-pegs" width="8" height="8" patternUnits="userSpaceOnUse"><rect x="3" y="3" width="1" height="1" fill="#203760"/></pattern></defs>
    <rect width="480" height="400" fill="#020714"/>
    <rect width="480" height="400" fill="url(#career-game-pegs)"/>
    <path d="M0 364H104V312H220V260H336V208H480V400H0Z" fill="#0a1834"/>
    <path d="M0 364H104V312H220V260H336V208H480" fill="none" stroke="#1f6bff" strokeWidth="4"/>
    <g className="career-game-synergy"><Sprite rows={frame('jump')} palette={SP} transform="translate(174 78) scale(8)"/></g>
    <Sprite rows={ICONS.like} palette="#1f6bff" transform="translate(64 192) scale(3)"/>
    <Sprite rows={ICONS.insightful} palette="#ffe14a" transform="translate(352 66) scale(4)"/>
    <Sprite rows={ICONS.love} palette="#1f6bff" transform="translate(380 286) scale(3)"/>
  </svg>;
}

export function GameDiscovery() {
  const dialog=useRef(null), opener=useRef(null), section=useRef(null);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{if(location.hash==='#career-game')section.current.scrollIntoView();},[]);
  useEffect(()=>{
    if(!playing)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current.showModal();
    return ()=>{document.body.style.overflow=previous;};
  },[playing]);
  function open(event){opener.current=event.currentTarget;setPlaying(true);}
  function closed(){setPlaying(false);opener.current?.focus({preventScroll:true});}
  // Escape inside the game keeps its existing pause behavior; the close control stays above it.
  return <>
    <section ref={section} className="career-game-promo" id="career-game" aria-labelledby="career-game-title">
      <div className="career-game-copy">
        <p className="career-game-name">SYNERGY.EXE</p>
        <h2 id="career-game-title">Career<br/>mode.</h2>
        <p className="career-game-story">Climb the office. Catch the language.<br className="career-game-break"/> Post your way up.</p>
        <div className="career-game-actions">
          <button type="button" onClick={open}>Play the game</button>
          <a href="/game/">Open full screen</a>
        </div>
        <p className="career-game-aside">Counts as professional development.</p>
      </div>
      <button className="career-game-poster" type="button" onClick={open} aria-label="Preview SYNERGY.EXE: play the career game">
        <CareerArtwork/>
        <span className="career-game-insert">Your next move.</span>
      </button>
    </section>
    <dialog ref={dialog} className="career-game-dialog" aria-label="Play SYNERGY.EXE" onClose={closed} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
      <header><a href="/game/">Open full screen</a><button type="button" autoFocus onClick={()=>dialog.current.close()} aria-label="Close game preview">Close <span aria-hidden="true">×</span></button></header>
      {playing&&<iframe src="/game/?preview=1" title="SYNERGY.EXE playable game" allow="autoplay; fullscreen"/>}
    </dialog>
  </>;
}
