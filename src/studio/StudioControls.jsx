import React, {useEffect, useRef} from 'react';
import {X, Volume2, Check, Minus, Plus} from 'lucide-react';
import {CHARACTERS} from '../audio.js';
import './controls.css';

export const SOUND_PRESETS = [
  {name:'Polished', values:{sinc:.12,deliv:.5,decay:.5,weird:.15,dist:.12,pitch:.8}},
  {name:'Glitchy', values:{sinc:.4,deliv:.6,decay:.5,weird:.45,dist:.25,pitch:.8}},
  {name:'Unhinged', values:{sinc:.8,deliv:.7,decay:.6,weird:.85,dist:.5,pitch:.8}},
];
const ENV_HINTS={boardroom:'Clear & present',conference:'On speakerphone',allhands:'Address the room',replyall:'Extra presence',bandwidth:'Low-fi connection'};

export function StudioControls({character,onCharacter,tempo,onTempo,effects,onPreset,onPreview,onClose}){
  const ref=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement, overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';ref.current.showModal();
    return()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[]);
  const active=SOUND_PRESETS.find(p=>Object.entries(p.values).every(([key,value])=>Math.abs(effects[key]-value)<.001));
  return <dialog ref={ref} className="studio-controls" aria-labelledby="studio-controls-title"
    onCancel={e=>{e.preventDefault();onClose();}}
    onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header><h2 id="studio-controls-title">Change the mood.</h2><button className="studio-controls-close" onClick={onClose} aria-label="Close audio tools" autoFocus><X size={24}/></button></header>
    <fieldset className="studio-environments"><legend>Voice environment</legend><div>{CHARACTERS.map(c=><button key={c.id} aria-pressed={character===c.id} onClick={()=>onCharacter(c.id)}><span><strong>{c.name}</strong><small>{ENV_HINTS[c.id]}</small></span><Check size={20} aria-hidden="true"/></button>)}</div></fieldset>
    <fieldset className="studio-flavors"><legend>Sound character</legend><div>{SOUND_PRESETS.map(p=><button key={p.name} aria-pressed={active?.name===p.name} onClick={()=>onPreset(p.values)}>{p.name}</button>)}</div></fieldset>
    <div className="studio-tempo-control"><label htmlFor="studio-controls-tempo">Tempo <output>{tempo}<span> BPM</span></output></label><div><button onClick={()=>onTempo(Math.max(60,tempo-5))} disabled={tempo<=60} aria-label="Slow down by 5 BPM"><Minus size={22}/></button><input id="studio-controls-tempo" type="range" min="60" max="200" step="1" value={tempo} onChange={e=>onTempo(Number(e.target.value))} aria-valuetext={`${tempo} beats per minute`} style={{'--tempo-fill':`${(tempo-60)/140*100}%`}}/><button onClick={()=>onTempo(Math.min(200,tempo+5))} disabled={tempo>=200} aria-label="Speed up by 5 BPM"><Plus size={22}/></button></div></div>
    <button className="studio-preview-voice" onClick={onPreview}><Volume2 size={22}/>Try this voice</button>
  </dialog>;
}
