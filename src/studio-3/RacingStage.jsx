import React, {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowLeft,Pause,Play,Plus,Shuffle,SlidersHorizontal} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';

export function RacingHeader({onAudioTools}) {
  return <div className="s3-top">
    <a className="s3-skip" href="#s3-controls">Skip to studio controls</a>
    <ConceptHeader base="../" homeSectionBase="../" active="Studio">
      <button type="button" className="s3-header-mix" onClick={onAudioTools} aria-label="Open voice environment"><SlidersHorizontal aria-hidden="true"/><span>Mix</span></button>
    </ConceptHeader>
    <div className="s3-racing-band"><h1><span className="stage2-accessible">LinkedIn Beats Studio</span><img src="../lessons/get-linkedinified.svg" width="500" height="112" alt="Get LinkedInified"/></h1><span>Studio</span></div>
  </div>;
}

export function RacingConsole({playing,songName,tempo,energy,onPlay,onShuffle,onPhrase,onEnergy,voxLocked,onVoxLock,onAudioTools,phrases,drums,onPadPhrase,onDrum,ticker}) {
  const [padsOpen,setPadsOpen]=useState(false),[bank,setBank]=useState('phrases'),[page,setPage]=useState(0),[flash,setFlash]=useState('');
  const flashTimer=useRef(null);
  const preferred=[5,4,6,7,0,1,14,13];
  const phraseOrder=[...preferred,...phrases.map((_,i)=>i).filter(i=>!preferred.includes(i))].filter(i=>phrases[i]);
  const pageCount=Math.ceil(phraseOrder.length/8);
  const pads=bank==='drums'?drums.map((d,id)=>({...d,id})):phraseOrder.slice(page*8,page*8+8).map(id=>({...phrases[id],id}));
  const pulse=id=>{setFlash(id);clearTimeout(flashTimer.current);flashTimer.current=setTimeout(()=>setFlash(''),220);};
  const hit=i=>{const p=pads[i];if(!p)return;bank==='drums'?onDrum(p.id):onPadPhrase(p.id);pulse(`pad-${i}`);};
  useEffect(()=>()=>clearTimeout(flashTimer.current),[]);
  // Visible pad shortcuts take priority over the three stage shortcuts.
  useEffect(()=>{
    if(!padsOpen)return;
    const down=e=>{
      if(e.metaKey||e.ctrlKey||e.altKey||e.target?.closest?.('dialog,input,textarea,select,[contenteditable="true"],[role="slider"]'))return;
      const i='12345678'.indexOf(e.key);if(i<0)return;
      e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)hit(i);
    };
    window.addEventListener('keydown',down,true);return()=>window.removeEventListener('keydown',down,true);
  });
  return <section id="s3-controls" className="s3-console" aria-label="Performance controls">
    <div className="s3-console-inner">
    <div className="s3-transport">
      <button type="button" className={`c2-key s3-play ${playing?'is-active':''}`} aria-pressed={playing} aria-label={playing?'Pause performance':'Play performance'} onClick={onPlay}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
      <div className="s3-track"><strong>{songName}</strong><span>{tempo} BPM</span></div>
      <button type="button" className="s3-shuffle" onClick={onShuffle} aria-label="New track"><Shuffle aria-hidden="true"/></button>
    </div>
    <div className="s3-keys">
      <button type="button" className={`c2-key ${flash==='phrase'?'is-active':''}`} onClick={()=>{onPhrase();pulse('phrase');}}>Phrase <ArrowRight aria-hidden="true"/></button>
      <button type="button" className={`c2-key ${energy===1?'is-active':''}`} aria-pressed={energy===1} onClick={()=>onEnergy(energy===1?0:1)}>Build <Plus aria-hidden="true"/></button>
      <button type="button" className={`c2-key ${energy===2?'is-active':''}`} aria-pressed={energy===2} onClick={()=>onEnergy(energy===2?0:2)}>Drop <ArrowDown aria-hidden="true"/></button>
    </div>
    <div className="s3-settings">
      <button type="button" className="s3-toggle" aria-expanded={padsOpen} aria-controls="s3-pads" onClick={()=>setPadsOpen(v=>!v)}>Pads <i aria-hidden="true"/></button>
      <button type="button" className="s3-toggle" role="switch" aria-checked={!voxLocked} onClick={onVoxLock}>Auto phrases <i aria-hidden="true"/></button>
      <button type="button" className="s3-voice" onClick={onAudioTools}>Voice environment <SlidersHorizontal aria-hidden="true"/></button>
    </div>
    <div id="s3-pads" className="s3-pad-drawer" hidden={!padsOpen}>
      <div className="s3-pad-toolbar">
        <div className="s3-bank" role="group" aria-label="Pad bank">{['phrases','drums'].map(id=><button type="button" key={id} aria-pressed={bank===id} onClick={()=>{setBank(id);setFlash('');}}>{id==='phrases'?'Phrases':'Drums'}</button>)}</div>
        {bank==='phrases'&&<div className="s3-page-controls"><button type="button" aria-label="Previous phrase bank" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ArrowLeft aria-hidden="true"/></button><span aria-live="polite">{page+1} / {pageCount}</span><button type="button" aria-label="Next phrase bank" disabled={page+1>=pageCount} onClick={()=>setPage(p=>p+1)}><ArrowRight aria-hidden="true"/></button></div>}
      </div>
      <div className="s3-pads">{pads.map((p,i)=><button type="button" className={`c2-key s3-pad ${flash===`pad-${i}`?'is-active':''}`} key={`${bank}-${p.id}`} aria-label={`Trigger ${p.say||p.name}`} aria-keyshortcuts={padsOpen?String(i+1):undefined} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();hit(i);}} onClick={e=>{if(e.detail===0)hit(i);}}>{p.name}</button>)}</div>
    </div>
    <span className="stage2-accessible" role="status">{ticker}</span>
    </div>
  </section>;
}
