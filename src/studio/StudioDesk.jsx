import {Header} from '../brand/Header.jsx';
import React, {useEffect, useRef, useState} from 'react';
import {Play,Pause,Square,Shuffle} from 'lucide-react';
import {CBAudio,CHARACTERS} from '../audio.js';
import {GROOVES} from './grooves.js';
import {Footer} from '../brand/Footer.jsx';
import './desk.css';

function Meter({playing}){
  const ref=useRef(null);
  useEffect(()=>{let frame,last=0;const paint=now=>{if(now-last>70){last=now;const spectrum=playing?CBAudio.spectrum():null;ref.current?.querySelectorAll('i').forEach((el,i)=>{let level=0;if(spectrum){const start=i*12;for(let k=start;k<start+12;k++)level+=spectrum[k]||0;level=level/12/255*100;}el.style.height=level+'%';});}frame=requestAnimationFrame(paint);};frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);},[playing]);
  return <div className="desk-meter" ref={ref} role="img" aria-label="Live master audio spectrum">{Array.from({length:8},(_,i)=><span key={i}><i/></span>)}</div>;
}
const MIX_CHANNELS=[['drums','DRUMS','THE AGENDA'],['bass','BASS','BOTTOM LINE'],['music','KEYS','BIG IDEAS'],['vox','VOICE','THOUGHT LEADER']];

export function StudioDesk({playing,pos,tempo,grooveId,song,phrases,armed,onPhrase,onPlay,onStop,onGroove,onRandom,energy,onEnergy,mix,onMix,muted,onMute,master,onMaster,effects,onEffect,character,onCharacter,band,onBand,monitor,remixPanel,onRemix,remixOpen,onStage,onAdvanced,onExport,onMidi,exporting,take,ticker,loops,onLoops,voxLocked,onVoxLock,pattern,drums,onDrum,rec,onRecord}){
  const remixRef=useRef(null), flashTimer=useRef(null);
  const [bank,setBank]=useState('phrases'), [page,setPage]=useState(0), [flash,setFlash]=useState(null);
  const [panel,setPanel]=useState(null), [tempoDraft,setTempoDraft]=useState(String(tempo));
  useEffect(()=>setTempoDraft(String(tempo)),[tempo]);
  useEffect(()=>()=>clearTimeout(flashTimer.current),[]);
  useEffect(()=>{if(remixOpen)remixRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});},[remixOpen]);
  const phraseOrder=[5,4,6,7,0,1,14,13,...phrases.map((_,i)=>i).filter(i=>![5,4,6,7,0,1,14,13].includes(i))];
  const pads=bank==='drums'?drums.map((d,i)=>({id:i,name:d.name,say:d.name})):phraseOrder.slice(page*8,page*8+8).map(i=>({id:i,...phrases[i]}));
  const hit=i=>{const pad=pads[i];if(!pad)return;if(bank==='drums')onDrum(pad.id);else onPhrase(pad.id);setFlash(i);clearTimeout(flashTimer.current);flashTimer.current=setTimeout(()=>setFlash(null),180);};
  // Capture only visible pad shortcuts; the parent keeps space/play and advanced shortcuts.
  useEffect(()=>{const down=e=>{if(e.metaKey||e.ctrlKey||e.altKey||e.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="slider"]'))return;const i='1234qwet'.indexOf(e.key.toLowerCase());if(i<0)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)hit(i);};window.addEventListener('keydown',down,true);return()=>window.removeEventListener('keydown',down,true);});
  const currentBar=pos===null?0:Math.floor(pos/16), bars=Math.max(1,(pattern?.[0]?.length||64)/16);
  const togglePanel=id=>setPanel(p=>p===id?null:id);
  return <div className="desk-page">
    <a className="desk-skip" href="#mixing-desk">Skip to mixing desk</a>
    <Header base="../" active="Studio"/>
    <main id="mixing-desk" className="studio-main">
      <div className="studio-title"><span className="studio-meta">STUDIO / CIRCLE BACK®</span><h1>MAKE SOME NOISE.</h1></div>
      <div className="studio-instrument">
        <section className="studio-performance" aria-label="Playable pads">
          <div className="studio-bank"><div aria-label="Pad bank"><button aria-pressed={bank==='phrases'} onClick={()=>{setBank('phrases');setFlash(null);}}>Phrases</button><button aria-pressed={bank==='drums'} onClick={()=>{setBank('drums');setFlash(null);}}>Drums</button></div><span>Push some buttons.</span></div>
          <div className="studio-pads">{pads.map((p,i)=><button key={bank+p.id} className={`studio-pad tone-${i%4} ${flash===i?'is-hit':''}`} aria-label={`Trigger ${p.say}`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();hit(i);}} onClick={e=>{if(e.detail===0)hit(i);}}><kbd>{'1234qwet'[i].toUpperCase()}</kbd><span className="studio-pad-echo" aria-hidden="true">{p.name}<br/>{p.name}<br/>{p.name}</span><strong>{p.name}</strong><span className="studio-pad-dot" aria-hidden="true"/></button>)}</div>
          <div className="studio-pad-foot">{bank==='phrases'?<><span className="studio-meta">PHRASE BANK {page+1} / {Math.ceil(phrases.length/8)}</span><div><button aria-label="Previous phrase bank" disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><button aria-label="Next phrase bank" disabled={(page+1)*8>=phrases.length} onClick={()=>setPage(p=>p+1)}>→</button></div></>:<span className="studio-meta">EIGHT SOUNDS. NO ACTION ITEMS.</span>}</div>
        </section>
        <section className="studio-now" aria-label="Playback">
          <label className="studio-meta" htmlFor="studio-groove">{playing?'NOW PLAYING':'ON THE AGENDA'}</label>
          <h2>{song.name}</h2>
          <select id="studio-groove" aria-label="Choose groove" value={grooveId} onChange={e=>onGroove(e.target.value)}>{GROOVES.map(g=><option key={g.id} value={g.id}>{g.name} · {g.genre}</option>)}</select>
          <div className="studio-signal"><label className="studio-tempo"><input aria-label="Tempo in BPM" type="number" min="60" max="200" value={tempoDraft} onChange={e=>{setTempoDraft(e.target.value);const n=Number(e.target.value);if(n>=60&&n<=200)onEffect('tempo',Math.round(n));}} onBlur={()=>{const n=tempoDraft.trim()?Math.max(60,Math.min(200,Math.round(Number(tempoDraft)||tempo))):tempo;setTempoDraft(String(n));onEffect('tempo',n);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/> BPM</label><Meter playing={playing}/></div>
          <div className="studio-transport"><button className="studio-play" aria-label={playing?'Pause playback':'Play groove'} onClick={onPlay}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button><button className="studio-stop" onClick={onStop} aria-label="Stop playback"><Square fill="currentColor"/></button><button className="studio-surprise" onClick={onRandom} aria-label="Surprise me with a new groove"><Shuffle/></button></div>
          <p className="studio-tagline">The meeting could have been a beat.</p>
          <div className="studio-energy">{['Groove','Build','Drop'].map((name,i)=><button key={name} aria-pressed={energy===i} onClick={()=>onEnergy(i)}>{name}</button>)}<button aria-expanded={panel==='mixer'} aria-controls="studio-panel" onClick={()=>togglePanel('mixer')}>Mixer {panel==='mixer'?'−':'+'}</button></div>
          <p className="studio-status" role="status">{ticker}</p>
        </section>
      </div>
      <section className="studio-loop" aria-label="Loop position"><div className="studio-loop-meta"><span className="studio-meta">YOUR LOOP / BAR {String(currentBar+1).padStart(2,'0')} OF {String(bars).padStart(2,'0')}</span><span className="studio-meta">{rec?'RECORDING PAD HITS':'SPACE TO PLAY / PAUSE'}</span></div><div className="studio-loop-row"><div className="studio-steps" role="img" aria-label={`Loop position: bar ${currentBar+1}, step ${pos===null?'stopped':pos%16+1}`} >{Array.from({length:16},(_,i)=>{const at=currentBar*16+i;const active=bank==='drums'?pattern?.slice(0,8).some(r=>r[at]):pattern?.at(-1)?.[at];return <span key={i}><i className={`${active?'has-note':''} ${playing&&pos%16===i?'is-current':''}`}/><small>{i+1}</small></span>;})}</div><button className={`studio-record ${rec?'is-recording':''}`} aria-pressed={rec} onClick={onRecord}><i/>{rec?'Finish':'Record'}</button></div></section>
      <nav className="studio-utilities" aria-label="Studio tools"><button aria-expanded={panel==='effects'} aria-controls="studio-panel" onClick={()=>togglePanel('effects')}>Voice & effects {panel==='effects'?'−':'+'}</button><button onClick={onAdvanced}>Edit the sequence ↗</button><button aria-expanded={panel==='export'} aria-controls="studio-panel" onClick={()=>togglePanel('export')}>Export ↗</button></nav>
      <div id="studio-panel" hidden={!panel} className="studio-panel">
        {panel==='mixer'&&<><h2>INTERNAL LEVELS.</h2><div className="studio-mix">{MIX_CHANNELS.map(([id,label])=><div key={id}><label htmlFor={'mix-'+id}>{label}<output>{Math.round(mix[id]*100)}%</output></label><input id={'mix-'+id} type="range" min="0" max="1" step=".01" value={mix[id]} onChange={e=>onMix(id,Number(e.target.value))}/><button aria-pressed={!!muted[id]} onClick={()=>onMute(id)}>{muted[id]?'Unmute':'Mute'} {label.toLowerCase()}</button></div>)}</div><div className="studio-settings"><label>Master volume<input type="range" min="0" max="1" step=".01" value={master} onChange={e=>onMaster(Number(e.target.value))}/></label><button aria-pressed={band} onClick={onBand}>House band {band?'on':'off'}</button><button onClick={onStage}>Open the stage ↗</button></div></>}
        {panel==='effects'&&<><h2>HUMAN RESOURCES.</h2><div className="studio-mix">{[['sinc','Sincerity'],['deliv','Delivery'],['pitch','Pitch'],['weird','Weirdness']].map(([id,label])=><label key={id}>{label}<input type="range" min="0" max="1" step=".01" value={effects[id]} onChange={e=>onEffect(id,Number(e.target.value))}/><output>{id==='pitch'?`${Math.round(-8+effects[id]*10)} ST`:`${Math.round(effects[id]*100)}%`}</output></label>)}</div><div className="studio-settings"><label>Voice environment<select value={character} onChange={e=>onCharacter(e.target.value)}>{CHARACTERS.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><button aria-pressed={voxLocked} onClick={onVoxLock}>{voxLocked?'Voice: manual':'Voice: sequenced'}</button></div></>}
        {panel==='export'&&<><h2>CIRCULATE THE RECORD.</h2><div className="studio-settings"><label>Take length<select value={loops} onChange={e=>onLoops(Number(e.target.value))}>{[2,4,8].map(n=><option key={n} value={n}>{n} loops</option>)}</select></label><button disabled={!!exporting} onClick={()=>onExport('video')}>Video + audio ↓</button><button disabled={!!exporting} onClick={()=>onExport('audio')}>Audio ↓</button><button onClick={onMidi}>Groove MIDI ↓</button></div><p role="status">{exporting?`Recording: ${Math.min(exporting.done,exporting.total)} / ${exporting.total} steps`:'MIDI includes instrumental notes. Recorded voice and effects are included in audio exports when available.'}</p>{take&&<a href={take.url} download={take.name}>Download {take.name} ↗</a>}</>}
      </div>
      <div className={`studio-monitor ${panel==='export'?'':'is-offscreen'}`} aria-hidden={panel!=='export'}>{monitor}</div>
      <div className="studio-remix"><span>GOT A POST? MAKE IT A PROBLEM.</span><button onClick={onRemix} aria-expanded={remixOpen}>{remixOpen?'Close remix':'Build your remix'} ↗</button></div>
      {remixOpen&&<div className="desk-remix-panel" ref={remixRef}>{remixPanel}</div>}
    </main><Footer/>
  </div>;
}
