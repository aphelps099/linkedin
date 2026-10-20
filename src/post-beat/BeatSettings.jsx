import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X,Play,Pause,Check,RotateCcw} from 'lucide-react';
import {ROOMS,GROOVES,SOUNDS,normalizeMix} from './mix.js';
export function BeatSettings({mix,onChange,onClose,playing,busy,onPlay}){
  const dialog=useRef(null);
  useEffect(()=>{const el=dialog.current,focus=document.activeElement,overflow=document.body.style.overflow;el.showModal();document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;focus?.focus();};},[]);
  const update=patch=>onChange(normalizeMix({...mix,...patch}));
  return createPortal(<dialog ref={dialog} className="pb-settings" aria-labelledby="beat-settings-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <div className="pb-settings-sheet">
      <header><span>YOUR WORDS. YOUR MIX.</span><button onClick={onClose} aria-label="Close beat settings" autoFocus><X size={23}/></button><h2 id="beat-settings-title">Make some<br/>office noise.</h2><p>Set the room. Find your groove.</p></header>
      <div className="pb-settings-body">
        <fieldset><legend>The room</legend><div className="pb-room-options">{ROOMS.map(([id,label,detail])=><button key={id} aria-pressed={mix.room===id} onClick={()=>update({room:id})}><span><strong>{label}</strong><small>{detail}</small></span>{mix.room===id&&<Check size={19}/>}</button>)}</div></fieldset>
        <fieldset><legend>The groove</legend><div className="pb-groove-options">{GROOVES.map(([id,label])=><button key={id} aria-pressed={mix.groove===id} onClick={()=>update({groove:id})}>{label}</button>)}</div></fieldset>
        <fieldset><legend>Office percussion</legend><p className="pb-settings-hint">Synthesized sounds, always on the beat.</p>{SOUNDS.map(([id,label])=><label className="pb-sound-option" key={id}><span>{label}</span><input type="checkbox" checked={mix.sounds.includes(id)} onChange={e=>update({sounds:e.target.checked?[...mix.sounds,id]:mix.sounds.filter(x=>x!==id)})}/><i aria-hidden="true"/></label>)}</fieldset>
      </div>
      <div className="pb-settings-actions"><button className="pb-settings-audition" onClick={onPlay}>{playing?<Pause size={20}/>:<Play size={20}/>} {busy?'Cancel preparation':playing?'Pause preview':'Hear your mix'}</button><button className="pb-settings-reset" onClick={()=>onChange(normalizeMix())}><RotateCcw size={14}/>Reset</button><p>Your mix is included when you share.</p></div>
    </div>
  </dialog>,document.body);
}
