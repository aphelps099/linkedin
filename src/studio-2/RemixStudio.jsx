import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ArrowDown, Plus, Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, LoaderCircle, Check, SlidersHorizontal, X} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import {AsciiPerformance} from './AsciiPerformance.jsx';
import {createRemixEngine, TRACKS, VOCABULARY, durationOf, formatTime} from './remix-engine.js';

function Choices({label,help,options,value,onChange}) {
  return <div className="s2-control"><div className="s2-control-heading"><h3>{label}</h3><span>{help}</span></div><div className="s2-choices" role="group" aria-label={label}>{options.map(([id,title])=><button type="button" key={id} aria-pressed={value===id} onClick={()=>onChange(id)}>{title}</button>)}</div></div>;
}

export function RemixStudio() {
  const initialIndex=Math.max(0,TRACKS.findIndex(track=>track.id===new URLSearchParams(window.location.search).get('track')));
  const engine=useRef(null),pointer=useRef(false),lastVolume=useRef(.8),phraseIndex=useRef(0),drawer=useRef(null),lastToggle=useRef(null);
  const [state,setState]=useState(()=>({index:initialIndex,playing:false,loading:false,elapsed:0,energy:1,confidence:0,
    voice:'duet',volume:.8,text:TRACKS[initialIndex].pairs[0][0],response:TRACKS[initialIndex].pairs[0][1],speaker:'M',speaking:false,
    queued:'',status:'Choose a track. Make a small scene.',error:''}));
  const [scrub,setScrub]=useState(null),[panel,setPanel]=useState(null);
  useEffect(()=>{
    const instance=createRemixEngine({onChange:setState,initialIndex});engine.current=instance;
    const keyboard=e=>{
      if(e.code!=='Space'||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;
      e.preventDefault();instance.toggle();
    };
    window.addEventListener('keydown',keyboard);
    return()=>{window.removeEventListener('keydown',keyboard);instance.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{if(panel)drawer.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});},[panel]);
  const track=TRACKS[state.index],duration=durationOf(track),position=scrub??state.elapsed;
  const changed=state.energy!==1||state.confidence!==0||state.voice!=='duet';
  const instrumental=state.voice==='instrumental';
  const mute=()=>{if(state.volume){lastVolume.current=state.volume;engine.current.volume(0);}else engine.current.volume(lastVolume.current||.8);};
  const togglePanel=(name,event)=>{lastToggle.current=event.currentTarget;setPanel(current=>current===name?null:name);};
  const closePanel=()=>{setPanel(null);lastToggle.current?.focus({preventScroll:true});};
  const firePhrase=()=>engine.current.vocabulary(VOCABULARY[phraseIndex.current++%VOCABULARY.length].id);
  return <div className="c2-home studio-next">
    <a className="s2-skip" href="#remix-player">Skip to player</a>
    <ConceptHeader base="../" homeSectionBase="../" active="Studio"><button type="button" className="s2-header-mix" aria-expanded={panel==='mix'} aria-controls="s2-drawer" onClick={e=>togglePanel('mix',e)}>Mix <SlidersHorizontal aria-hidden="true"/></button></ConceptHeader>
    <div className="s2-racing-band"><h1><span className="s2-sr">Studio 02 — Get LinkedInified</span><img src="../lessons/get-linkedinified.svg" width="500" height="112" alt=""/></h1><span>Studio <b>/</b> 02</span></div>
    <main>
      <AsciiPerformance state={state} engine={engine}/>
      <section className="s2-deck" id="remix-player" aria-label="Studio performance controls">
        <div className="s2-deck-inner">
          <div className="s2-transport">
            <button type="button" className="s2-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause track':'Play track'} onClick={()=>engine.current.toggle()}>{state.loading?<LoaderCircle className="s2-spin" aria-hidden="true"/>:state.playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>}</button>
            <div className="s2-now"><h2>{track.title}</h2><span>{track.bpm} BPM <b>·</b> {['Groove','Build','Drop'][state.energy]} <b>·</b> {instrumental?'Beat only':state.voice==='duet'?'Robot duet':'Robot 01'}</span></div>
            <div className="s2-time"><strong>{formatTime(position)}</strong><span>/ {formatTime(duration)}</span></div>
            <div className="s2-track-arrows"><button type="button" aria-label="Previous track or restart" onClick={()=>engine.current.previous()}><SkipBack aria-hidden="true"/></button><button type="button" aria-label="Next track" onClick={()=>engine.current.next()}><SkipForward aria-hidden="true"/></button></div>
          </div>
          <label className="s2-seek"><span className="s2-sr">Seek within {track.title}</span><input type="range" min="0" max={duration} step=".1" value={position} aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`} style={{'--progress':`${position/duration*100}%`}} onPointerDown={()=>{pointer.current=true;}} onPointerUp={e=>{pointer.current=false;engine.current.seek(e.currentTarget.value);setScrub(null);}} onPointerCancel={()=>{pointer.current=false;setScrub(null);}} onChange={e=>{if(pointer.current)setScrub(Number(e.target.value));else engine.current.seek(e.target.value);}}/></label>
          <div className="s2-performance-keys"><button type="button" disabled={!state.playing||instrumental} onClick={firePhrase}>Phrase <ArrowUpRight aria-hidden="true"/></button><button type="button" aria-pressed={state.energy===1} onClick={()=>engine.current.setting('energy',state.energy===1?0:1)}>Build <Plus aria-hidden="true"/></button><button type="button" aria-pressed={state.energy===2} onClick={()=>engine.current.setting('energy',state.energy===2?1:2)}>Drop <ArrowDown aria-hidden="true"/></button></div>
          <div className="s2-deck-tools"><button type="button" className="s2-circle" disabled={state.loading} onClick={()=>engine.current.circleBack()}><RotateCcw aria-hidden="true"/>{state.queued==='chorus'?'Chorus queued':'Circle back'}</button><div className="s2-panel-toggles">{[['tracks','Tracks','06'],['words','Vocabulary','06'],['mix','Mix','']].map(([id,label,count])=><button type="button" key={id} aria-expanded={panel===id} aria-controls="s2-drawer" onClick={e=>togglePanel(id,e)}>{label}{count&&<span>{count}</span>}{id==='mix'&&<SlidersHorizontal aria-hidden="true"/>}</button>)}</div></div>
          <div className="s2-status" role="status"><span className={state.error?'is-error':''}>{state.error||state.status}</span><span>Sound like you mean business.</span></div>
        </div>
        <div className="s2-drawer" id="s2-drawer" hidden={!panel} ref={drawer} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closePanel();}}}>
          <div className="s2-drawer-inner"><div className="s2-drawer-heading"><div><span>Performance department</span><h2>{panel==='tracks'?'Choose your next career move.':panel==='words'?'Deploy some vocabulary.':'Adjust your executive presence.'}</h2></div><button type="button" aria-label="Close studio panel" onClick={closePanel}><X aria-hidden="true"/></button></div>
            {panel==='tracks'&&<ol className="s2-track-list">{TRACKS.map((item,i)=><li key={item.id}><button type="button" className={state.index===i?'is-selected':''} aria-current={state.index===i?'true':undefined} aria-label={`Play ${item.title}, ${item.genre}, ${item.bpm} BPM`} onClick={()=>engine.current.select(i)}><span className="s2-track-number">{String(i+1).padStart(2,'0')}</span><span className="s2-track-copy"><strong>{item.title}</strong><span>{item.genre} <b>·</b> {item.bpm} BPM</span></span><Play aria-hidden="true"/></button></li>)}</ol>}
            {panel==='words'&&<><p className="s2-panel-note">A statement. A response. Back to business. Press play to bring a phrase into the next four-bar passage.</p><div className="s2-vocabulary-pads" role="group" aria-label="Corporate phrase pairs">{VOCABULARY.map(item=><button type="button" key={item.id} disabled={!state.playing||instrumental} aria-pressed={state.queued===item.id} onClick={()=>engine.current.vocabulary(item.id)}>{item.label}{state.queued===item.id?<Check aria-hidden="true"/>:<ArrowUpRight aria-hidden="true"/>}</button>)}</div></>}
            {panel==='mix'&&<><div className="s2-controls"><Choices label="Beat energy" help="How big is this meeting?" value={state.energy} onChange={v=>engine.current.setting('energy',v)} options={[[0,'Groove'],[1,'Build'],[2,'Drop']]}/><Choices label="Corporate confidence" help="Every word. Entirely sincere." value={state.confidence} onChange={v=>engine.current.setting('confidence',v)} options={[[0,'Humbled'],[1,'Visionary']]}/><Choices label="Office voices" help="Emotionally unavailable." value={state.voice} onChange={v=>engine.current.setting('voice',v)} options={['robot','duet','instrumental'].map((id,i)=>[id,['Robot 01','Duet','Beat only'][i]])}/></div><div className="s2-mix-bottom"><div className="s2-volume"><button type="button" aria-label={state.volume?'Mute audio':'Unmute audio'} onClick={mute}>{state.volume?<Volume2 aria-hidden="true"/>:<VolumeX aria-hidden="true"/>}</button><input aria-label="Volume" type="range" min="0" max="1" step=".01" value={state.volume} onChange={e=>engine.current.volume(e.target.value)}/></div><button type="button" className="s2-reset" onClick={()=>engine.current.reset()} disabled={!changed&&!state.queued}><RotateCcw aria-hidden="true"/>Reset mix</button></div></>}
          </div>
        </div>
      </section>
    </main>
    <footer className="s2-footer"><span>LinkedIn Beats / Corporate racing division</span><a href="../studio/">Meeting studio <ArrowUpRight aria-hidden="true"/></a><a href="../store/">Shop wears <ArrowUpRight aria-hidden="true"/></a></footer>
  </div>;
}
