import React, {useEffect, useRef, useState} from 'react';
import {Play,Pause,Square,ArrowUpRight,Shuffle,Download,Volume2} from 'lucide-react';
import {CBAudio,CHARACTERS} from '../audio.js';
import {GROOVES} from './grooves.js';
import {Footer} from '../brand/Footer.jsx';
import './desk.css';

export function Rotary({label,value,onChange,format=v=>Math.round(v*100)+'%',color='blue'}){
  const drag=useRef(null),clamp=v=>Math.max(0,Math.min(1,v));
  return <div className={`desk-rotary rotary-${color}`}><span>{label}</span><div className="desk-dial-ring"><div className="desk-dial" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value*100)} aria-valuetext={format(value)}
    onPointerDown={e=>{drag.current={y:e.clientY,value};e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
    onPointerMove={e=>{if(drag.current)onChange(clamp(drag.current.value+(drag.current.y-e.clientY)/160*(e.shiftKey ? .25 : 1)));}}
    onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}
    onKeyDown={e=>{const step=e.shiftKey ? .01 : .05;if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();onChange(e.key==='Home'?0:e.key==='End'?1:clamp(value+(['ArrowUp','ArrowRight'].includes(e.key)?step:-step)));}}}
    title="Drag up or down; arrow keys adjust; Shift for fine control"><i style={{transform:`rotate(${-135+value*270}deg)`}}/></div></div><output>{format(value)}</output></div>;
}
function Meter({playing}){
  const ref=useRef(null);
  useEffect(()=>{let frame,last=0;const paint=now=>{if(now-last>70){last=now;const spectrum=playing?CBAudio.spectrum():null;ref.current?.querySelectorAll('i').forEach((el,i)=>{let level=0;if(spectrum){const start=i*12;for(let k=start;k<start+12;k++)level+=spectrum[k]||0;level=level/12/255*100;}el.style.height=level+'%';});}frame=requestAnimationFrame(paint);};frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);},[playing]);
  return <div className="desk-meter" ref={ref} role="img" aria-label="Live master audio spectrum">{Array.from({length:8},(_,i)=><span key={i}><i/></span>)}</div>;
}
const MIX_CHANNELS=[['drums','DRUMS','THE AGENDA'],['bass','BASS','BOTTOM LINE'],['music','KEYS','BIG IDEAS'],['vox','VOICE','THOUGHT LEADER']];

export function StudioDesk({playing,pos,tempo,grooveId,song,phrases,armed,onPhrase,onPlay,onStop,onGroove,onRandom,energy,onEnergy,mix,onMix,muted,onMute,master,onMaster,effects,onEffect,character,onCharacter,band,onBand,monitor,remixPanel,onRemix,remixOpen,onStage,onAdvanced,onExport,onMidi,exporting,take,ticker,loops,onLoops,voxLocked,onVoxLock}){
  const remixRef=useRef(null);
  const [tempoDraft,setTempoDraft]=useState(String(tempo));
  useEffect(()=>setTempoDraft(String(tempo)),[tempo]);
  useEffect(()=>{if(remixOpen)remixRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});},[remixOpen]);
  return <div className="desk-page">
    <a className="desk-skip" href="#mixing-desk">Skip to mixing desk</a>
    <header className="desk-site-header"><a className="desk-brand" href="../">LINKEDIN BEATS<span>THE STUDIO</span></a><nav aria-label="Main navigation"><a href="../lessons/">LinkedIn Lessons</a><a href="../store/">The company store</a></nav></header>
    <main>
      <div className="desk-intro"><div><span className="desk-micro">CIRCLE BACK® / PROFESSIONAL AUDIO EQUIPMENT</span><h1>MAKE SOME PROFESSIONAL NOISE.</h1></div><p>Select a groove. Hit a phrase.<br/>Take it entirely too far.</p></div>
      <section className="desk-grooves" aria-labelledby="grooves-title"><div className="desk-section-line"><h2 id="grooves-title">01 / PICK YOUR MEETING CADENCE</h2><span>SIX ORIGINAL GROOVES. ZERO ACTION ITEMS.</span></div><div className="desk-groove-grid">{GROOVES.map((g,i)=><button key={g.id} className={grooveId===g.id?'is-selected':''} aria-pressed={grooveId===g.id} onClick={()=>onGroove(g.id)}><span className="desk-groove-no">0{i+1}</span><span><strong>{g.name}</strong><small>{g.genre}</small></span><span className="desk-groove-bpm">{g.bpm}<small>BPM</small></span></button>)}</div></section>
      <section className="desk-console" id="mixing-desk" aria-label="Circle Back mixing desk">
        <i className="desk-screw screw-tl" aria-hidden="true"/><i className="desk-screw screw-tr" aria-hidden="true"/><i className="desk-screw screw-bl" aria-hidden="true"/><i className="desk-screw screw-br" aria-hidden="true"/>
        <div className="desk-console-head"><div><strong>CIRCLE BACK<span>®</span></strong><span>CB—808 / CORPORATE CULTURE SYNTHESIZER</span></div><span className={`desk-power ${playing?'is-on':''}`}><i/>{playing?'MEETING IN SESSION':'READY FOR ALIGNMENT'}</span></div>
        <div className="desk-main-grid">
          <div className="desk-performance">
            <div className="desk-display"><div className="desk-lcd"><span>{playing?'● LIVE':'○ STANDBY'} / {song.name.toUpperCase()}</span><strong>{tempo}<small>BPM</small><b>{pos===null?'—':String(Math.floor(pos/16)+1).padStart(2,'0')}.{pos===null?'—':String(pos%16+1).padStart(2,'0')}</b></strong><div className="desk-step-lights" aria-hidden="true">{Array.from({length:16},(_,i)=><i className={pos!==null&&pos%16===i?'is-lit':''} key={i}/>)}</div><p>{ticker}</p></div><div className="desk-spectrum"><span>MASTER SIGNAL</span><Meter playing={playing}/><div><span>−∞</span><span>0 dB</span></div></div></div>
            <div className="desk-transport"><button className={`desk-play ${playing?'is-playing':''}`} onClick={onPlay} aria-label={playing?'Pause playback':'Play groove'}>{playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}{playing?'PAUSE':'PLAY'}</button><button onClick={onStop} aria-label="Stop playback"><Square size={16} fill="currentColor"/></button><button onClick={onRandom} title="Surprise me with a new groove"><Shuffle size={18}/><span>SURPRISE ME</span></button><label className="desk-tempo">TEMPO <input type="number" min="60" max="200" value={tempoDraft} onChange={e=>{setTempoDraft(e.target.value);const n=Number(e.target.value);if(n>=60&&n<=200)onEffect('tempo',Math.round(n));}} onBlur={()=>{const n=tempoDraft.trim()?Math.max(60,Math.min(200,Math.round(Number(tempoDraft)||tempo))):tempo;setTempoDraft(String(n));onEffect('tempo',n);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} aria-label="Tempo in BPM"/></label></div>
            <div className="desk-subhead"><h2>02 / PRESS TO OPINE</h2><button aria-pressed={voxLocked} onClick={onVoxLock}>{voxLocked?'VOICE: MANUAL':'VOICE: SEQUENCED'}</button></div>
            <div className="desk-pads">{phrases.slice(0,16).map((p,i)=><button key={p.code} className={`desk-pad pad-tone-${Math.floor(i/4)} ${armed===i?'is-armed':''}`} aria-label={`Trigger ${p.say}`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();onPhrase(i);}} onClick={e=>{if(e.detail===0)onPhrase(i);}}><span><b>{String(i+1).padStart(2,'0')}</b><kbd>{'1234qwetasdfzxcv'[i].toUpperCase()}</kbd></span><strong>{p.name}</strong><i aria-hidden="true"/></button>)}</div>
            <div className="desk-energy"><span>RAISE THE ROOM</span>{['GROOVE','BUILD','DROP'].map((name,i)=><button key={name} className={`energy-${i} ${energy===i?'is-on':''}`} aria-pressed={energy===i} onClick={()=>onEnergy(i)}>{name}{i===2&&' ↓'}</button>)}</div>
          </div>
          <div className="desk-mixer"><div className="desk-subhead"><h2>03 / INTERNAL LEVELS</h2><Volume2 size={15}/></div><div className="desk-channels">{MIX_CHANNELS.map(([id,label,note],i)=><div className={`desk-channel ${muted[id]?'is-muted':''}`} key={id}><span className="desk-channel-no">0{i+1}</span><h3>{label}</h3><span className="desk-channel-note">{note}</span><div className="desk-fader-well"><div className="desk-fader-marks" aria-hidden="true"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><input className="desk-fader" type="range" min="0" max="1" step=".01" value={mix[id]} onChange={e=>onMix(id,Number(e.target.value))} aria-label={`${label.toLowerCase()} channel volume`} aria-valuetext={`${Math.round(mix[id]*100)} percent${muted[id]?', muted':''}`}/></div><output>{Math.round(mix[id]*100)}</output><button className="desk-mute" aria-pressed={!!muted[id]} aria-label={`${muted[id]?'Unmute':'Mute'} ${label.toLowerCase()}`} onClick={()=>onMute(id)}>MUTE</button><span className="desk-channel-light" aria-hidden="true"/></div>)}</div>
            <div className="desk-master-row"><Rotary label="MASTER" value={master} onChange={onMaster} color="yellow"/><div><button className={band?'is-on':''} aria-pressed={band} onClick={onBand}>HOUSE BAND {band?'ON':'OFF'}</button><span>Faders control the actual audio mix.<br/>100 = unity gain.</span></div></div>
            <div className="desk-monitor"><span>THE BROADCAST / LIVE PREVIEW</span>{monitor}<button onClick={onStage}>OPEN THE STAGE <ArrowUpRight size={14}/></button></div>
          </div>
        </div>
        <div className="desk-lower"><div className="desk-effects"><div className="desk-subhead"><h2>04 / HUMAN RESOURCES</h2><span>DRAG DIALS UP / DOWN</span></div><div className="desk-knobs"><Rotary label="SINCERITY" value={effects.sinc} onChange={v=>onEffect('sinc',v)}/><Rotary label="DELIVERY" value={effects.deliv} onChange={v=>onEffect('deliv',v)}/><Rotary label="PITCH" value={effects.pitch} onChange={v=>onEffect('pitch',v)} format={v=>{const n=Math.round(-8+v*10);return `${n>0?'+':''}${n} ST`;}}/><Rotary label="WEIRDNESS" value={effects.weird} onChange={v=>onEffect('weird',v)} color="pink"/></div><div className="desk-voice"><label>VOICE ENVIRONMENT<select value={character} onChange={e=>onCharacter(e.target.value)}>{CHARACTERS.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><button onClick={onAdvanced}>OPEN THE SEQUENCER ↗</button></div></div>
          <div className="desk-export"><div className="desk-subhead"><h2>05 / CIRCULATE THE RECORD</h2></div><label>TAKE LENGTH<select value={loops} onChange={e=>onLoops(Number(e.target.value))}>{[2,4,8].map(n=><option key={n} value={n}>{n} loops</option>)}</select></label><button className="desk-export-primary" disabled={!!exporting} onClick={()=>onExport('video')}><Download size={17}/>{exporting?'RECORDING…':'EXPORT VIDEO + AUDIO'}</button><div><button disabled={!!exporting} onClick={()=>onExport('audio')}>AUDIO ONLY</button><button onClick={onMidi}>GROOVE MIDI ↓</button></div><p role="status">{exporting?`${Math.min(exporting.done,exporting.total)} / ${exporting.total} steps recorded`:'MIDI contains instrumental notes. Voice and effects are included in audio exports when recorded audio is available.'}</p>{take&&<a href={take.url} download={take.name}>Download {take.name} ↗</a>}</div>
        </div>
        <div className="desk-console-foot"><span>DESIGNED FOR EXCESSIVE INTERNAL COMMUNICATION.</span><span>SPACE = PLAY / PAUSE · LETTER KEYS = PHRASES</span></div>
      </section>
      <section className="desk-remix-section"><div><span className="desk-micro">BRING YOUR OWN BUZZWORDS</span><h2>GOT A POST?<br/>MAKE IT A PROBLEM.</h2></div><div><p>Turn your latest announcement into a full corporate performance.</p><button onClick={onRemix} aria-expanded={remixOpen}>{remixOpen?'CLOSE THE REMIX FORM':'BUILD YOUR REMIX'}<ArrowUpRight size={21}/></button></div></section>
      {remixOpen&&<div className="desk-remix-panel" ref={remixRef}>{remixPanel}</div>}
    </main><Footer/>
  </div>;
}
