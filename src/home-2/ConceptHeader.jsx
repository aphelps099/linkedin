import React, {memo, useEffect, useId, useRef, useState} from 'react';
import {LoaderCircle, Pause, Play} from 'lucide-react';
import '../brand/navigation.css';
import '../brand/wordmark-shimmer.css';

export const ConceptHeader = memo(function ConceptHeader({base='/', onRadio, playing=false, loading=false, homeSectionBase='', active, children, overlay=false, theme='light', storefront=false}) {
  const [open,setOpen]=useState(false);
  const root=useRef(null), trigger=useRef(null), directory=useRef(null), focusFirst=useRef(false), id=useId();
  const links=[['Listen',`${homeSectionBase}#c2-player`],['LinkedInifier',`${base}lessons/`],['Learn',`${base}learn/`],['Studio',`${base}synth/`],['Shop',`${base}store/`]];
  useEffect(()=>{
    if(!open)return;
    if(focusFirst.current){focusFirst.current=false;directory.current?.querySelector('a')?.focus();}
    const escape=e=>{
      if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}
    };
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    document.addEventListener('keydown',escape);
    document.addEventListener('pointerdown',outside);
    return()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);};
  },[open]);
  const label=loading?'Cancel radio loading':playing?'Pause radio':'Play radio';
  return <header className={`c2-header${overlay?' c2-header--overlay':''}${theme==='dark'?' c2-header--dark':''}`} ref={root} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <div className="c2-container c2-header-row">
      <a className="c2-header-brand" href={base} aria-label="LinkedIn Beats home">
        <picture className={overlay?`lb-metal-wordmark${!storefront?' lb-metal-wordmark--responsive':''}`:undefined} style={overlay?{'--lb-wordmark-mask':`url("${base}home-2/brand/wordmark-horizontal-header.svg")`,'--lb-wordmark-mobile-mask':`url("${base}home-2/brand/wordmark-stacked-header.svg")`}:undefined}>
          {!storefront&&<source media="(max-width: 700px)" srcSet={`${base}home-2/brand/wordmark-stacked-header.svg`} width="3857.0" height="1742"/>}
          <img src={`${base}home-2/brand/wordmark-horizontal-header.svg`} alt="LinkedIn Beats" width="7015.0" height="862" fetchpriority="high"/>
        </picture>
      </a>
      <nav className="c2-header-links" aria-label="Featured navigation">
        {links.filter(([name])=>storefront?['Listen','Learn','Shop'].includes(name):!['Studio','Learn'].includes(name)).map(([name,href])=><a key={name} href={href} aria-current={active===name?'page':undefined}>{storefront&&name==='Shop'?'Store':name}</a>)}
      </nav>
      <div className="c2-header-actions">
        {children}
        {onRadio?<button type="button" className="c2-header-radio" onClick={onRadio} aria-label={label} aria-pressed={playing}>
          {loading?<LoaderCircle className="c2-spin" aria-hidden="true"/>:playing?<Pause fill="currentColor" aria-hidden="true"/>:<Play fill="currentColor" aria-hidden="true"/>}
          <span>{loading?'Loading':playing?'Pause radio':'Play radio'}</span>
        </button>:!children&&<a className="c2-header-radio" href={`${homeSectionBase}#c2-player`}><Play fill="currentColor" aria-hidden="true"/><span>Play radio</span></a>}
        <button type="button" className="c2-header-menu" ref={trigger} aria-expanded={open} aria-controls={id}
          onClick={()=>setOpen(value=>!value)}
          onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();if(open)directory.current?.querySelector('a')?.focus();else{focusFirst.current=true;setOpen(true);}}}}>
          <span>{open?'Close':'Menu'}</span><span className={`c2-header-burger${open?' is-open':''}`} aria-hidden="true"><i/><i/></span>
        </button>
      </div>
      <nav className="c2-header-directory" id={id} ref={directory} aria-label="Main navigation" hidden={!open}>
        {links.map(([name,href])=><a key={name} href={href} aria-current={active===name?'page':undefined} onClick={()=>setOpen(false)}>{name}</a>)}
      </nav>
    </div>
  </header>;
});
