// The peg badge, on its own: a name, the badge alive, a download, a post.
import React, {useRef, useState} from 'react';
import {ArrowUpRight, Download, Sparkles} from 'lucide-react';
import {Header} from '../../brand/Header.jsx';
import {PegBadge} from '../../program/components/PegBadge.jsx';
import {downloadBlob} from '../../program/components/Rewards.jsx';
import {certificateName} from '../../program/components/certificate-art.js';
import {LinkedInPublish} from '../../sharing/LinkedInPublish.jsx';
import './showcase.css';

export default function Showcase({base = '/'}) {
  const badge = useRef(null), [name, setName] = useState(''), [status, setStatus] = useState(''), [key, setKey] = useState(0);
  const shown = certificateName(name);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function download() {
    setStatus('Preparing your badge…');
    try { downloadBlob(await badge.current.toBlob(2), 'linkedin-beats-certified-thought-leader.png'); setStatus('Badge downloaded.'); }
    catch { setStatus('Download unavailable in this browser.'); }
  }
  return <div className="bs">
    <Header base={base} theme="dark"/>
    <main className="bs-main">
      <section className="bs-stage" aria-label="Your badge">
        <PegBadge key={key} ref={badge} name={shown} size={520} reduced={reduced}/>
        <p className="bs-hint">Move over it. Tap it. It has been waiting for you.</p>
      </section>
      <section className="bs-panel">
        <p className="bs-kicker">Homepage concepts · The badge</p>
        <h1>Certified. Lit.</h1>
        <p className="bs-lead">The All Hands seal as a digital credential: the ring of pegs, the mark in PEG-9, the terminal beat on a 120 BPM pulse, your name on the ring. It boots peg by peg in stroke order, blooms under the pointer and celebrates on a tap.</p>
        <label className="bs-field"><span>Name on the badge</span><input value={name} maxLength={60} placeholder="Aspiring Thought Leader" onChange={e => setName(e.target.value)}/></label>
        <div className="bs-actions">
          <button type="button" className="bs-btn" onClick={() => badge.current?.celebrate()}><Sparkles size={16}/>Celebrate</button>
          <button type="button" className="bs-btn" onClick={() => setKey(k => k + 1)}>Boot again</button>
          <button type="button" className="bs-btn bs-btn-primary" onClick={download}><Download size={16}/>Download PNG</button>
        </div>
        <div className="bs-publish">
          <LinkedInPublish mediaKey={`badge:${shown}`} getFile={() => badge.current.toBlob(2)} title="Certified Thought Leader" caption={`Humbled to share that my professional development has been independently acknowledged.\n\nCertified Thought Leader. Effort verified.\n\nhttps://linkedinbeats.com/learn/`}/>
        </div>
        <p className="bs-status" role="status">{status}</p>
        <p className="bs-links"><a href={`${base}learn/`}>The Academy <ArrowUpRight size={14}/></a><a href={`${base}home-concepts/`}>Homepage concepts <ArrowUpRight size={14}/></a></p>
      </section>
    </main>
  </div>;
}
