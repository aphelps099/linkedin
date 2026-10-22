import React, {useEffect, useId, useRef, useState} from 'react';
import {LoaderCircle, Pause, Play} from 'lucide-react';
import {createRadio} from '../home/radio.js';
import {claimAudio} from './audio-focus.js';
import './navigation.css';
import './site-header.css';

export const SITE_LINKS = [
  ['Optimize', 'optimizer'], ['Learn', 'learn/'], ['Studio', 'studio/'],
  ['Synth', 'synth/'], ['Shop', 'store/'],
];
const idle = {playing:false, loading:false, error:''};

export function SiteHeader({base='/', active, overlay=false, theme='light', children,
  onRadio, playing=false, loading=false, radioError='', focus}) {
  const [open, setOpen] = useState(false), [radioState, setRadioState] = useState(idle);
  const root = useRef(null), trigger = useRef(null), directory = useRef(null), player = useRef(null), focusFirst = useRef(false);
  const id = useId();
  const current = active === 'LinkedInifier' ? 'Optimize' : active === 'Store' ? 'Shop' : active;
  const dark = overlay || theme === 'dark';
  useEffect(() => {
    setRadioState(idle);
    if(onRadio || focus) return;
    const radio = createRadio({phraseBase:`${base}phrases/`, onState:setRadioState});
    player.current = radio;
    return () => {radio.dispose(); player.current = null;};
  }, [base, !!onRadio, !!focus]);
  useEffect(() => {
    const media = event => {
      const el = event.target;
      if(el?.matches?.('audio,video') && !el.muted && !el.hasAttribute('data-cb-unlock')) claimAudio('media');
    };
    document.addEventListener('play', media, true);
    return () => document.removeEventListener('play', media, true);
  }, []);
  useEffect(() => {
    if(!open) return;
    if(focusFirst.current){focusFirst.current=false;directory.current?.querySelector('a')?.focus();}
    const close = e => {if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}};
    const outside = e => {if(!root.current?.contains(e.target))setOpen(false);};
    const wide = () => {if(window.innerWidth>900)setOpen(false);};
    document.addEventListener('keydown',close);document.addEventListener('pointerdown',outside);window.addEventListener('resize',wide);
    return () => {document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',wide);};
  }, [open]);
  const state = onRadio ? {playing,loading,error:radioError} : radioState;
  const label = state.loading ? 'Cancel radio loading' : state.playing ? 'Pause radio' : state.error ? 'Retry radio' : 'Play radio';
  const links = () => SITE_LINKS.map(([name,path]) => <a key={name} href={`${base}${path}`} aria-current={current===name?'page':undefined} onClick={()=>setOpen(false)}>{name}</a>);
  return <header className={`lb-header${dark?' lb-header--dark':''}${overlay?' lb-header--overlay':''}${focus?' lb-header--focus':''}`} ref={root} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <div className="lb-header-row">
      <a className="lb-header-brand" href={base} aria-label="LinkedIn Beats home"><img src={`${base}brand/afterbeat/wordmark-${dark?'white':'color'}.svg`} width="185" height="23" alt="LinkedIn Beats"/></a>
      {focus ? <><span className="lb-header-academy">Academy</span><span className="lb-header-progress">Lesson {focus.current} of {focus.total}{focus.minutes?` · ${focus.minutes} min`:null}</span><a className="lb-header-back" href="#">← All lessons</a></> : <>
        <nav className="lb-header-links" aria-label="Main navigation">{links()}</nav>
        <div className="lb-header-actions">
          {children}
          <button type="button" className="lb-header-radio" onClick={onRadio || (()=>player.current?.toggle())} aria-label={label} aria-pressed={state.playing} title={label}>
            <span className="lb-header-disc">{state.loading?<LoaderCircle className="lb-header-spinner" aria-hidden="true"/>:state.playing?<Pause fill="currentColor" aria-hidden="true"/>:<Play fill="currentColor" aria-hidden="true"/>}</span>
          </button>
          <button type="button" className="lb-header-menu" ref={trigger} aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();if(open)directory.current?.querySelector('a')?.focus();else{focusFirst.current=true;setOpen(true);}}}}><span className={`lb-header-burger${open?' is-open':''}`} aria-hidden="true"><i/><i/></span></button>
        </div>
        <nav className="lb-header-directory" id={id} ref={directory} aria-label="Mobile navigation" hidden={!open}>{links()}</nav>
      </>}
    </div>
    {!focus&&state.error&&<p className="lb-header-error" role="status">Radio couldn’t load. Tap play to retry.</p>}
  </header>;
}
