import React, {memo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {ArrowRight, ArrowUpRight, Check, Copy} from 'lucide-react';
import {linkedinify} from '../lessons/generator.js';

const ROAST_EXAMPLE = 'Humbled to announce my next professional journey.\n\nI got promoted.';
const MOMENTS = [
  'I made a cup of coffee. It was pretty good.',
  'I sent an email. Someone replied.',
  'Our meeting ended five minutes early.',
  'I brought my lunch to work. It was a sandwich.',
];

// These tools keep their own state, independent of the radio's animation frames.
export const Campaigns = memo(function Campaigns({base='/'}) {
  const roastInput = useRef(null), result = useRef(null), exampleIndex = useRef(0);
  const [roastPost, setRoastPost] = useState('');
  const [ordinary, setOrdinary] = useState(MOMENTS[0]);
  const [output, setOutput] = useState(() => linkedinify(MOMENTS[0], 927));
  const [copyStatus, setCopyStatus] = useState('');
  const [expanded, setExpanded] = useState(false);
  const paragraphs = output.split(/\n\n/);
  const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, 3).map(p => p.length > 160 ? `${p.slice(0, 160).trimEnd()}…` : p);

  const roast = e => {
    e.preventDefault();
    if (!roastPost.trim()) {
      roastInput.current.setCustomValidity('Paste a post, or try the example.');
      roastInput.current.reportValidity();
      return;
    }
    window.location.assign(`${base}roast/#roast=${encodeURIComponent(roastPost.trim())}`);
  };
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
    <section className="c2-roast-campaign" aria-labelledby="c2-roast-title">
      <div className="c2-container c2-roast-layout">
        <div className="c2-roast-copy">
          <p className="c2-eyebrow">Roast my post</p>
          <h2 id="c2-roast-title">Less hype.<br/><span>More human.</span></h2>
          <p className="c2-campaign-intro">Let the red pen see it before your network does.</p>
          <form className="c2-roast-form" onSubmit={roast}>
            <label htmlFor="c2-roast-input">Your LinkedIn post</label>
            <textarea id="c2-roast-input" ref={roastInput} required maxLength={10000} rows={2} value={roastPost} onChange={e=>{e.target.setCustomValidity('');setRoastPost(e.target.value);}} placeholder="Paste your next big announcement…"/>
            <div className="c2-roast-actions">
              <button className="c2-roast-submit" type="submit">Meet the red pen <ArrowUpRight/></button>
              <button className="c2-example" type="button" onClick={()=>{setRoastPost(ROAST_EXAMPLE);roastInput.current.setCustomValidity('');roastInput.current.focus();}}>Try the example</button>
            </div>
          </form>
        </div>
        <figure className="c2-marked-draft" aria-label="Example review: Humbled to announce my next professional journey. I got promoted. Red pen notes question humbled, call the journey a job, and suggest leading with the actual news.">
          <div className="c2-draft-sheet" aria-hidden="true">
            <span className="c2-draft-caption">A second opinion.</span>
            <p className="c2-draft-text"><span className="c2-circled">Humbled</span> to announce<br/>my next professional<br/><span className="c2-crossed">journey.</span></p>
            <span className="c2-pen-note c2-note-humbled">Are you, though?</span>
            <span className="c2-pen-note c2-note-journey">It's a job.</span>
            <p className="c2-draft-punchline">I got promoted.</p>
            <span className="c2-pen-note c2-note-punchline">↑ There it is. Lead with that.</span>
            <span className="c2-draft-signoff">With love. And a red pen.</span>
          </div>
        </figure>
      </div>
    </section>

    <section className="c2-linkedinifier-campaign" aria-labelledby="c2-linkedinifier-title">
      <div className="c2-container c2-linkedinifier-layout">
        <div className="c2-linkedinifier-copy">
          <p className="c2-eyebrow">The LinkedInifier</p>
          <h2 id="c2-linkedinifier-title">Small news.<br/><span>Big deal.</span></h2>
          <p className="c2-campaign-intro">An ordinary Tuesday. A career-defining announcement.</p>
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
