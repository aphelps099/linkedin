import React, {memo, useEffect, useRef, useState} from 'react';
import {Check, Copy, Mic, PhoneOff, Users, Video, X} from 'lucide-react';
import {linkedinify} from '../lessons/generator.js';

function PixelArrow() {
  return <svg className="lp-pixel-arrow" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 0h10v10h-2V4h-2v2H8v2H6v2H4v2H2v2H0v-2h2v-2h2V8h2V6h2V4h2V2H4Z"/></svg>;
}
function FullPost({post, onClose}) {
  const dialog = useRef(null), text = useRef(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    const el = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow;
    el.showModal(); document.body.style.overflow = 'hidden';
    return () => {el.close(); document.body.style.overflow = overflow; previous?.focus({preventScroll:true});};
  }, []);
  async function copy() {
    try {await navigator.clipboard.writeText(post); setCopied('Copied');}
    catch {
      const range = document.createRange(), selection = window.getSelection();
      range.selectNodeContents(text.current); selection.removeAllRanges(); selection.addRange(range);
      setCopied('Text selected. Use your device’s copy command.');
    }
  }
  return <dialog ref={dialog} className="lc-post-dialog" aria-labelledby="lc-full-title" onCancel={e => {e.preventDefault(); onClose();}}
    onClick={e => {if(e.target !== e.currentTarget) return; const r=e.currentTarget.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) onClose();}}>
    <button className="lc-close" type="button" aria-label="Close full post" onClick={onClose} autoFocus><X/></button>
    <h2 id="lc-full-title">A very big deal.</h2>
    <div className="lc-full-post" ref={text}>{post}</div>
    <button className="lc-copy-post" type="button" onClick={copy}>{copied==='Copied'?<Check/>:<Copy/>}{copied==='Copied'?'Copied':'Copy full post'}</button>
    <p className="lc-copy-note" role="status">{copied==='Copied'?'Full post copied to clipboard.':copied}</p>
  </dialog>;
}

export const Campaigns = memo(function Campaigns({base='/'}) {
  const [ordinary, setOrdinary] = useState('I made coffee.');
  const [preview, setPreview] = useState('I made a cup of coffee.');
  const [post, setPost] = useState(''), [open, setOpen] = useState(false);
  function generate(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.ordinary;
    if (!ordinary.trim()) {input.setCustomValidity('Tell us what happened first.'); input.reportValidity(); return;}
    const cleaned = ordinary.trim();
    setPreview(/[.!?]$/.test(cleaned)?cleaned:`${cleaned}.`);
    setPost(linkedinify(cleaned, Math.floor(Math.random()*4294967296)));
    setOpen(true);
  }
  const poster = name => `${base}studio/season/posters/${name}-listening.jpg`;
  return <div id="c2-tools" className="lb-feature-cards"><div className="lc-pair">
    <section className="lc-panel" aria-labelledby="lc-title">
      <span className="lc-pill">LINKEDINIFIER</span>
      <h2 id="lc-title">Small news.<br/>Big deal.</h2>
      <div className="lc-scene">
        <img className="lc-robot" src={`${base}home-2/certificate-robot.webp`} width="1774" height="887" alt="" loading="lazy" decoding="async"/>
        <div className="lc-paper">
          <img className="lc-stamp" src={`${base}home-2/approved-stamp.svg`} width="228" height="80" alt="Approved"/>
          <p className="lc-post" aria-live="polite">Humbled to announce:<strong>{preview}</strong></p>
        </div>
      </div>
      <form className="lc-entry" onSubmit={generate}>
        <label className="lc-sr" htmlFor="lc-update">What happened?</label>
        <input id="lc-update" name="ordinary" type="text" value={ordinary} onChange={e=>{setOrdinary(e.target.value);e.target.setCustomValidity('');}} maxLength={180} required/>
        <button type="submit">LinkedInify</button>
      </form>
      {post && <button className="lc-result-link" type="button" onClick={()=>setOpen(true)}>Read full post <PixelArrow/></button>}
    </section>
    <section className="lp-studio" aria-labelledby="lp-studio-title">
      <span className="lp-pill">THE STUDIO</span>
      <h2 id="lp-studio-title">This meeting<br/>has a beat.</h2>
      <div className="lp-room" aria-label="Studio preview with Synergy and the band">
        <div className="lp-room-title"><span>SYNERGY &amp; CO.</span><span className="lp-status">STUDIO</span></div>
        <div className="lp-host"><img src={poster('synergy-camera-v2')} alt="Synergy at his desk with coffee" loading="lazy"/><span className="lp-person-label"><Mic aria-hidden="true"/>Synergy · Host</span></div>
        <div className="lp-team">{[['people','People'],['keys-full','Keys'],['strategy','Strategy']].map(([image,name])=><div className="lp-person" key={name}><img src={poster(image)} alt={`${name}, a member of the band`} loading="lazy"/><span className="lp-person-label">{name}</span></div>)}</div>
        <div className="lp-room-controls" aria-hidden="true"><span><Mic/></span><span><Video/></span><span><Users/></span><span className="lp-hangup"><PhoneOff/></span></div>
      </div>
      <a className="lp-enter" href={`${base}studio/`}>Enter the studio<PixelArrow/></a>
      <p className="lp-caption">No agenda. Excellent synergy.</p>
    </section>
  </div>{open && <FullPost post={post} onClose={()=>setOpen(false)}/>}</div>;
});
