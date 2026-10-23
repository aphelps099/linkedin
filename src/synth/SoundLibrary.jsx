import {claimAudio,onAudioFocus} from '../brand/audio-focus.js';
import React, {useEffect, useRef, useState} from 'react';
import {Check, Headphones, Play, Search, Square, X} from 'lucide-react';
import {SOUNDS, initialProject} from './model.js';
import {Sampler} from './engine.js';

const groupFor = sound => sound.group || (sound.kind === 'VOICE' ? 'Original phrases' : 'Drums & synth');
const groups = ['All sounds', ...new Set(SOUNDS.map(groupFor))];
const asSlot = sound => ({...initialProject().slots[0], sound:sound.id, name:sound.name, gain:.7});

export default function SoundLibrary({pad, currentSound, onLoad, onClose}) {
 const dialog = useRef(), audition = useRef(new Sampler()), alive = useRef(true);
 const [query,setQuery] = useState(''), [group,setGroup] = useState('All sounds');
 const [preview,setPreview] = useState(null), [loading,setLoading] = useState(null), [error,setError] = useState('');
 useEffect(() => {
  const node = dialog.current, previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  node.showModal();
  return () => {alive.current=false;audition.current.close();node.close();document.body.style.overflow=previousOverflow;};
 }, []);
 useEffect(()=>onAudioFocus('synth',()=>{audition.current.stop();setPreview(null);}),[]);
 const results = SOUNDS.filter(sound => (group === 'All sounds' || groupFor(sound) === group) &&
  `${sound.name} ${sound.text || ''} ${groupFor(sound)}`.toLowerCase().includes(query.toLowerCase().trim()));
 async function hear(sound) {
  if(loading) return;
  audition.current.stop();setError('');
  if(preview === sound.id){setPreview(null);return;}
  setPreview(null);setLoading(sound.id);
  try {
   const slot=asSlot(sound);
   claimAudio('synth');
   await audition.current.prepare({...initialProject(),slots:[slot],delay:0,filter:20000});
   if(!alive.current){audition.current.stop();return;}
   setPreview(sound.id);
   const source=audition.current.hit(slot);
   source.addEventListener('ended',()=>{if(alive.current)setPreview(id=>id===sound.id?null:id);});
  } catch(e) {if(alive.current)setError(e.message || 'Could not preview this sound. Try again.');}
  finally {if(alive.current)setLoading(null);}
 }
 async function choose(sound) {
  if(loading) return;
  audition.current.stop();setPreview(null);setLoading(sound.id);setError('');
  try {await onLoad(sound);onClose();}
  catch(e){if(alive.current){setError(e.message || 'Could not load this sound. Try again.');setLoading(null);}}
 }
 return <dialog ref={dialog} className="syn-library" aria-labelledby="syn-library-title" onClose={onClose}>
  <div className="syn-library-heading"><div><span className="syn-eyebrow">THE COMPANY SOUND LIBRARY</span><h2 id="syn-library-title">Bring the whole team.</h2><p>Every character. Guitar fills. A little more synergy.</p></div><button className="syn-library-close" aria-label="Close sound library" onClick={onClose}><X size={19}/></button></div>
  <div className="syn-library-tools"><label className="syn-library-search"><Search size={17}/><input autoFocus type="search" aria-label="Search sounds" placeholder="Search a phrase or character…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter sounds by character or instrument" value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(name=><option key={name}>{name}</option>)}</select></div>
  <div className="syn-library-info"><span>{results.length} {results.length===1?'SOUND':'SOUNDS'}</span><span>LOAD INTO PAD {String(pad+1).padStart(2,'0')}</span></div>
  <div className="syn-library-results">
   {results.map(sound=><div className={'syn-library-row '+(preview===sound.id?'is-previewing':'')} key={sound.id}>
    <button className="syn-library-preview" aria-label={`${preview===sound.id?'Stop preview of':'Preview'} ${sound.name}`} aria-pressed={preview===sound.id} disabled={!!loading} onClick={()=>hear(sound)}>{preview===sound.id?<Square size={14} fill="currentColor"/>:<Play size={14} fill="currentColor"/>}</button>
    <div className="syn-library-copy"><span>{groupFor(sound)}{sound.duration && <> · {sound.duration.toFixed(1)}s</>}{sound.bpm && <> · {sound.bpm} BPM · {sound.key}</>}</span><p>{sound.text || sound.name}</p></div>
    <button className="syn-library-load" aria-label={`Load ${sound.name} into pad ${pad+1}`} disabled={!!loading} onClick={()=>choose(sound)}>{loading===sound.id?'Loading…':currentSound===sound.id?<><Check size={13}/> Loaded</>:'Load'}{loading!==sound.id&&currentSound!==sound.id&&<span aria-hidden="true">↗</span>}</button>
   </div>)}
   {!results.length&&<p className="syn-library-empty">No matching sounds. Try another phrase or choose All sounds.</p>}
  </div>
  <div className="syn-library-footer" role="status"><Headphones size={15}/><span>{error || (loading?'Loading audio…':'Preview first. Load any sound into any pad.')}</span></div>
 </dialog>;
}
