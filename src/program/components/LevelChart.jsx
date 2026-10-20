import React, {useId, useState} from 'react';
import {LEVELS} from '../engine/performer.js';

// The bars show the five ordinal settings, not invented score predictions.
// Native radios keep click, touch and arrow-key selection in sync.
export function LevelChart({value, onChange, disabled=false, min=1, max=5, title='The five levels'}){
  const group = useId();
  const [explored, setExplored] = useState(1);
  const selected = value ?? explored;
  const current = LEVELS.find(l => l.n === selected) || LEVELS[0];
  return <fieldset className="pg-level-chart" disabled={disabled}>
    <legend>{title}</legend>
    <p className="pg-level-hint">{disabled ? 'Your selected setting.' : onChange ? 'Select a bar. Same facts, bigger announcement.' : 'Select a bar to explore what changes.'}</p>
    <div className="pg-level-bars">
      {LEVELS.filter(l => l.n >= min && l.n <= max).map(l => <label className={`pg-level-option${l.n === selected ? ' is-selected' : ''}`} key={l.n}>
        <input type="radio" name={group} value={l.n} checked={l.n === selected} onChange={()=>{setExplored(l.n);onChange?.(l.n);}} aria-label={`Level ${l.n}: ${l.name}`}/>
        <span className="pg-level-column" aria-hidden="true"><span className="pg-level-bar" style={{height:`${l.n * 20}%`}}><span>{l.n}</span></span></span>
        <span className="pg-level-name" aria-hidden="true">{l.n === 2 ? <><span className="pg-level-long">Professionally </span>Optimized</> : l.name}</span>
        <span className="pg-level-choice" aria-hidden="true">{l.n === selected ? 'Selected' : `Level ${l.n}`}</span>
      </label>)}
    </div>
    <div className="pg-level-description" aria-live="polite" aria-atomic="true"><strong>{current.name}</strong><p>{current.blurb}</p></div>
  </fieldset>;
}
