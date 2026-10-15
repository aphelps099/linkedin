import React, {memo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {ArrowRight, ArrowUpRight, Check, Copy} from 'lucide-react';
import {linkedinify} from '../lessons/generator.js';

const MOMENTS = [
  'I made a cup of coffee. It was pretty good.',
  'I sent an email. Someone replied.',
  'Our meeting ended five minutes early.',
  'I brought my lunch to work. It was a sandwich.',
];

// The tool keeps its own state, independent of the radio's animation frames.
export const Campaigns = memo(function Campaigns({base='/'}) {
  const result = useRef(null), exampleIndex = useRef(0);
  const [ordinary, setOrdinary] = useState(MOMENTS[0]);
  const [output, setOutput] = useState(() => linkedinify(MOMENTS[0], 927));
  const [copyStatus, setCopyStatus] = useState('');
  const [expanded, setExpanded] = useState(false);
  const paragraphs = output.split(/\n\n/);
  const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, 3).map(p => p.length > 160 ? `${p.slice(0, 160).trimEnd()}…` : p);

  const generate = e => {
    e.preventDefault();
    const input = e.currentTarget.elements.ordinary;
    if (!ordinary.trim()) {
      input.setCustomValidity('Tell us one ordinary thing that happened.');
      input.reportValidity();
      return;
    }
    setOutput(linkedinify(ordinary.trim(), Math.floor(Math.random() * 4294967296)));
    setExpanded(false);
    setCopyStatus('');
  };
  const tryMoment = () => {
    exampleIndex.current = (exampleIndex.current + 1) % MOMENTS.length;
    const next = MOMENTS[exampleIndex.current];
    setOrdinary(next);
    document.getElementById('c2-ordinary')?.setCustomValidity('');
    setOutput(linkedinify(next, Math.floor(Math.random() * 4294967296)));
    setExpanded(false);
    setCopyStatus('');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus('Copied');
    } catch {
      // Reveal the complete announcement before selecting it for manual copy.
      flushSync(() => setExpanded(true));
      const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents(result.current);
      selection.removeAllRanges();
      selection.addRange(range);
      setCopyStatus('Text selected. Copy it with your device’s copy command.');
    }
  };

  return <div id="c2-tools" className="c2-campaigns">
    <section className="c2-linkedinifier-campaign" aria-labelledby="c2-linkedinifier-title">
      <div className="c2-container c2-linkedinifier-layout">
        <div className="c2-linkedinifier-copy">
          <p className="c2-eyebrow">The LinkedInifier</p>
          <h2 id="c2-linkedinifier-title">Small news.<br/><span>Big deal.</span></h2>
          <form className="c2-linkedinifier-form" onSubmit={generate}>
            <label htmlFor="c2-ordinary">What actually happened?</label>
            <textarea name="ordinary" id="c2-ordinary" required maxLength={2000} rows={2} value={ordinary} onChange={e=>{e.target.setCustomValidity('');setOrdinary(e.target.value);setOutput('');setExpanded(false);setCopyStatus('');}} placeholder="I made a cup of coffee. It was pretty good."/>
            <button className="c2-generate" type="submit">Make it LinkedIn <ArrowRight/></button>
            <button className="c2-another-example" type="button" onClick={tryMoment}>Try another ordinary moment</button>
          </form>
        </div>
        <div className="c2-announcement">
          <div className="c2-announcement-heading"><span>For immediate release</span><ArrowUpRight aria-hidden="true"/></div>
          <div aria-live="polite" aria-atomic="true">
            {output ? <div className="c2-generated">
              <div className="c2-output-text" id="c2-output-text" ref={result}>{visibleParagraphs.map((paragraph,i)=><p className={paragraph.startsWith('#')?'c2-hashtags':undefined} key={i}>{paragraph}</p>)}</div>
              <button className="c2-read-post" aria-expanded={expanded} aria-controls="c2-output-text" onClick={()=>setExpanded(!expanded)}>{expanded?'Show less':'Read full post'} <span aria-hidden="true">{expanded?'−':'+'}</span></button>
              <div className="c2-output-actions">
                <button className="c2-copy" onClick={copy}>{copyStatus==='Copied'?<Check/>:<Copy/>}{copyStatus==='Copied'?'Copied':'Copy post'}</button>
                <a className="c2-text-link" href={`${base}studio/#beat=${encodeURIComponent(output)}`}>Make it a beat <ArrowUpRight/></a>
              </div>
            </div> : <div className="c2-announcement-empty"><p>Make a<br/>big deal.</p><span>Your next announcement is one click away.</span></div>}
          </div>
          <p className="c2-copy-status" role="status">{copyStatus&&copyStatus!=='Copied'?copyStatus:''}</p>
        </div>
      </div>
    </section>
  </div>;
});
