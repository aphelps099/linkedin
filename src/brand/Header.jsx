import React, {useEffect, useId, useRef, useState} from 'react';
import {Play, Pause, LoaderCircle, ArrowUpRight} from 'lucide-react';
import './fonts.css';
import './header.css';

const LINKS=[['Listen','The corporate hits.','#listen'],['Lessons','Professional nonsense, perfected.','lessons/'],['Studio','Make some professional noise.','studio/'],['Roast','Submit your personal brand for review.','roast/'],['Store','Wear your boundaries.','store/']];
export function Header({base='/',active,onRadio,playing=false,loading=false,children}){
  const [open,setOpen]=useState(false), root=useRef(null), trigger=useRef(null), id=useId();
  useEffect(()=>{
    if(!open)return;
    const close=e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}};
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    document.addEventListener('keydown',close);
    document.addEventListener('pointerdown',outside);
    return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);};
  },[open]);
  const radioContents=<>{loading?<LoaderCircle className="cb-header-spinner"/>:playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}<span>{loading?'Loading':playing?'Pause radio':'Play radio'}</span></>;
  return <header className="cb-header" ref={root}>
    <div className="cb-header-row">
      <a className="cb-header-brand" href={base} aria-label="LinkedIn Beats home">LINKEDIN BEATS</a>
      <span className="cb-header-tagline">DEPARTMENT OF<br/>PROFESSIONAL<br/>NONSENSE</span>
      <div className="cb-header-actions">
        {children}
        {onRadio?<button className="cb-header-radio" onClick={onRadio} aria-label={loading?'Cancel radio loading':playing?'Pause radio':'Play radio'}>{radioContents}</button>:<a className="cb-header-radio" href={`${base}#listen`} aria-label="Open Circle Back Radio">{radioContents}</a>}
        <button className="cb-header-menu" ref={trigger} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><span>{open?'Close':'Menu'}</span><span className={`cb-header-burger ${open?'is-open':''}`} aria-hidden="true"><i/><i/></span></button>
      </div>
    </div>
    <nav className="cb-header-directory" id={id} aria-label="Main navigation" hidden={!open}>
      <div className="cb-header-directory-label">COMPANY DIRECTORY <span>PLEASE SELECT YOUR DEPARTMENT.</span></div>
      {LINKS.map(([label,description,path],i)=><a href={`${base}${path}`} key={label} aria-current={active===label?'page':undefined} onClick={()=>{setOpen(false);trigger.current?.focus();}}><span className="cb-header-number">0{i+1}</span><strong>{label}</strong><span className="cb-header-description">{description}</span><ArrowUpRight aria-hidden="true"/></a>)}
      <div className="cb-header-signoff">ALL BUSINESS. NO SKIPS.</div>
    </nav>
  </header>;
}
