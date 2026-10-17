import React, {memo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {ArrowRight, Check, Copy} from 'lucide-react';
import {linkedinify} from '../lessons/generator.js';

const MOMENTS = [
  'I made a cup of coffee.\nIt was pretty good.',
  'I sent an email. Someone replied.',
  'Our meeting ended five minutes early.',
  'I brought my lunch to work. It was a sandwich.',
];

// Match the approved opening example. All submitted inputs still use the real
// composition engine; copying always receives the full post.
const OPENING_POST = [
  'Humbled and honored to share a small\nbut meaningful milestone.',
  'Today, I made a cup of coffee.',
  'A reminder that growth starts with\nshowing up.',
  ...linkedinify(MOMENTS[0], 927).split(/\n\n/).slice(3),
].join('\n\n');

// The tool keeps its own state, independent of the radio's animation frames.
export const Campaigns = memo(function Campaigns({base='/'}) {
  const result = useRef(null), exampleIndex = useRef(0);
  const [ordinary, setOrdinary] = useState(MOMENTS[0]);
  const [output, setOutput] = useState(OPENING_POST);
  const [copyStatus, setCopyStatus] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [approval, setApproval] = useState(0);
  const paragraphs = output.split(/\n\n/);
  const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, 3).map(p => p.length > 160 ? `${p.slice(0, 160).trimEnd()}…` : p);

  const tryMoment = () => {
    exampleIndex.current = (exampleIndex.current + 1) % MOMENTS.length;
    const next = MOMENTS[exampleIndex.current];
    setOrdinary(next);
    document.getElementById('c2-ordinary')?.setCustomValidity('');
    setOutput(linkedinify(next, Math.floor(Math.random() * 4294967296)));
    setApproval(count=>count+1);
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
          <h2 id="c2-linkedinifier-title">Small news.<br/><span className="c2-big-deal">Big deal.</span></h2>
          <div className="c2-linkedinifier-form">
            <label htmlFor="c2-ordinary">What actually happened?</label>
            <textarea name="ordinary" id="c2-ordinary" readOnly rows={2} value={ordinary} placeholder="I made a cup of coffee. It was pretty good."/>
            <a className="c2-generate" href={`${base}lessons/`}>Make it LinkedIn <ArrowRight/></a>
            <button className="c2-another-example" type="button" onClick={tryMoment}>Try another ordinary moment</button>
          </div>
        </div>
        <div className="c2-announcement-stage">
          <div className="c2-office-robot" aria-hidden="true"><img src={`${base}home-2/certificate-robot.webp`} width="1774" height="887" alt="" loading="lazy" decoding="async"/></div>
          <article className="c2-certificate" aria-label="LinkedInified post">
          {['top','right','bottom','left'].map(edge=><span key={edge} className={`c2-certificate-edge c2-certificate-edge--${edge}`} aria-hidden="true"/>)}
          <div className="c2-announcement">
          <div className="c2-announcement-heading"><span>For immediate release</span>{output&&<span key={approval} className={`c2-approval-stamp ${approval?'is-stamping':''}`} aria-hidden="true"><img src={`${base}home-2/approved-stamp.svg`} alt="" width="228" height="80"/></span>}</div>
          <div aria-live="polite" aria-atomic="true">
            {output ? <div className="c2-generated">
              <div className="c2-output-text" id="c2-output-text" ref={result}>{visibleParagraphs.map((paragraph,i)=><p className={paragraph.startsWith('#')?'c2-hashtags':undefined} key={i}>{paragraph}</p>)}</div>
              <div className="c2-output-actions">
                <button type="button" className="c2-read-post" aria-expanded={expanded} aria-controls="c2-output-text" onClick={()=>setExpanded(value=>!value)}>{expanded?'Show less':'Read full post'} <span aria-hidden="true">{expanded?'−':'+'}</span></button>
                <button type="button" className="c2-copy" onClick={copy}>{copyStatus==='Copied'?'Copied':'Copy post'}{copyStatus==='Copied'?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}</button>
              </div>
            </div> : <div className="c2-announcement-empty"><p>Make a<br/>big deal.</p><span>Your next announcement is one click away.</span></div>}
          </div>
          <p className={`c2-copy-status${copyStatus==='Copied'?' c2-sr':''}`} role="status">{copyStatus==='Copied'?'Full post copied to clipboard.':copyStatus}</p>
          </div>
          <span className="c2-certificate-plaque">Outstanding thought leadership.</span>
          </article>
        </div>
      </div>
    </section>
  </div>;
});
