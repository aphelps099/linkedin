import React, {useEffect, useRef, useState} from 'react';

export function GameDiscovery() {
  const dialog=useRef(null), opener=useRef(null), section=useRef(null), preview=useRef(null);
  const [visible,setVisible]=useState(false), [loaded,setLoaded]=useState(false), [ready,setReady]=useState(false);
  const [paused,setPaused]=useState(()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>{setVisible(entry.isIntersecting);if(entry.isIntersecting)setLoaded(true);},{threshold:.1});
    observer.observe(section.current);return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const send=()=>preview.current?.contentWindow?.postMessage({type:'synergy-preview-playback',playing:visible&&!paused&&!playing},location.origin);
    const onReady=event=>{if(event.origin===location.origin&&event.source===preview.current?.contentWindow&&event.data?.type==='synergy-preview-ready'){setReady(true);send();}};
    send();addEventListener('message',onReady);return ()=>removeEventListener('message',onReady);
  },[visible,paused,playing,loaded]);
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
        <h2 id="career-game-title"><span>Career advancement.</span><strong>Gamified.</strong></h2>
        <p className="career-game-story"><strong>Optimized for LinkedIn.</strong><br/>Collect the jargon. Chase the reactions.<br/>Climb the corporate ladder.</p>
        <div className="career-game-actions">
          <button type="button" onClick={open}>Play the game</button>
          <a href="/game/">Open full screen</a>
        </div>
      </div>
      <div className="career-game-cabinet">
        <div className="career-game-screen">
          {loaded&&<iframe ref={preview} style={{opacity:ready?1:0}} src="/game/?demo=1" title="Silent gameplay demonstration" tabIndex={-1} aria-hidden="true"/>}
          <button type="button" className="career-game-takeover" onClick={open} aria-label="Take over: play SYNERGY.EXE"><span>Take over</span></button>
        </div>
        <div className="career-game-preview-controls"><span>Live gameplay</span><button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?'Resume preview':'Pause preview'}</button></div>
      </div>
    </section>
    <dialog ref={dialog} className="career-game-dialog" aria-label="Play SYNERGY.EXE" onClose={closed} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
      <header><a href="/game/">Open full screen</a><button type="button" autoFocus onClick={()=>dialog.current.close()} aria-label="Close game preview">Close <span aria-hidden="true">×</span></button></header>
      {playing&&<iframe src="/game/?preview=1" title="SYNERGY.EXE playable game" allow="autoplay; fullscreen"/>}
    </dialog>
  </>;
}
