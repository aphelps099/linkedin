import React from 'react';
import { ArrowUpRight, Copy, Check, Pencil, Download, Share2 } from 'lucide-react';
import PegFlames from './PegFlames.jsx';
import PegLabel from '../synth/PegLabel.jsx';
import { DotIcon } from '../archives/ArchiveGraphics.jsx';
import { Footer } from '../brand/Footer.jsx';
import { KINDS, roastIt } from './roastEngine.js';
import { PERSONAS, INTENSITIES } from './personas.js';
import { drawRoastCard, downloadCanvas } from './card.js';
import { newSeed } from '../lessons/generator.js';
import { MarkedDocument } from './MarkedDocument.jsx';
import { EDITORIAL_NOTES, verdictFor, evidenceFor } from './editorial.js';
import '../home-2/footer.css';
import './roast.css';

const MAX_LENGTH = 20000;
const HEAT = ['Gentle', 'Honest', 'Brutal', 'HR violation'];
const HEAT_NOTES = ['Lightly toasted.', 'A little hard to swallow.', 'Well done. Emotionally rare.', 'HR has left the chat.'];
const EXAMPLES = {
  post: 'Humbled and honored to announce that I have successfully completed another Monday.\n\nThis journey has taught me that leadership isn’t a title. It’s a mindset.\n\nAgree?',
  headline: 'Visionary | Top Voice | ex-Google | Product designer | Speaker | Helping teams build better tools',
  about: 'I’m passionate about designing useful tools. A results-driven leader with a proven track record, I’ve spent 12 years wearing many hats.\n\nLast year, our team rebuilt the client portal and reduced registration time from 15 minutes to 3.',
};
const KIND_LABELS = { post: 'Post', headline: 'Headline', about: 'About' };

function AutoTextarea({ value, className = '', ...props }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.max(180, ref.current.scrollHeight)}px`;
  }, [value]);
  return <textarea {...props} ref={ref} className={className} value={value} />;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(field);
    field.select();
    const ok = document.execCommand?.('copy') || false;
    field.remove();
    return ok;
  }
}

export default function Roast() {
  const [kind, setKind] = React.useState('post');
  const [draft, setDraft] = React.useState('');
  const [personaId, setPersonaId] = React.useState('recruiter');
  const [intensity, setIntensity] = React.useState(3);
  const [review, setReview] = React.useState(null);
  const [editing, setEditing] = React.useState(true);
  const [rewrite, setRewrite] = React.useState('');
  const [activeFinding, setActiveFinding] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  const [roastCount, setRoastCount] = React.useState(0);
  const [flameBurst, setFlameBurst] = React.useState({ id: 0, heat: 3 });
  const igniteRef = React.useRef(null);
  const revealTimer = React.useRef(null);
  const resultRef = React.useRef(null);
  const copyTimer = React.useRef(null);
  const result = !editing ? review?.result : null;
  const verdict = result ? verdictFor(result) : null;
  const valid = Boolean(draft.trim()) && draft.length <= MAX_LENGTH;

  React.useEffect(() => {
    const match = location.hash.match(/^#roast=(.+)$/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const text = decodeURIComponent(match[1]);
      if (text.trim()) {
        setDraft(text);
        setNotice('Your post is ready. Choose your heat and roast it.');
      }
    } catch { /* Leave malformed handoffs at the empty editor. */ }
  }, []);
  React.useEffect(() => () => { window.clearTimeout(copyTimer.current); window.clearTimeout(revealTimer.current); }, []);

  const runRoast = ({ text = draft, nextKind = kind, voice = personaId, heat = intensity, keepRewrite = false, focus = false } = {}) => {
    if (!text.trim() || text.length > MAX_LENGTH) return;
    const next = roastIt({ kind: nextKind, text, personaId: voice, intensity: heat, seed: newSeed() });
    setDraft(text);
    setReview({ text, kind: nextKind, result: next });
    setRoastCount(count => count + 1);
    setEditing(false);
    if (!keepRewrite) setRewrite(next.useful);
    setActiveFinding(0);
    setCopied(false);
    setCopyError(false);
    setNotice(next.clean ? 'Roast ready. No familiar clichés found.' : `Roast ready. ${next.findings.length} editing notes.`);
    window.clearTimeout(revealTimer.current);
    if (focus) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) setFlameBurst(previous => ({ id: previous.id + 1, heat }));
      revealTimer.current = window.setTimeout(() => {
        resultRef.current?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      }, reduced ? 0 : 950);
    }
  };
  const changeHeat = heat => {
    setIntensity(heat);
    if (result) runRoast({ heat, keepRewrite: true });
  };
  const changeVoice = voice => {
    setPersonaId(voice);
    if (result) runRoast({ voice, keepRewrite: true });
  };
  const selectFinding = index => {
    setActiveFinding(index);
    const finding = result.findings[index];
    setNotice(EDITORIAL_NOTES[finding.key]?.[1] || 'Editing note selected.');
    window.requestAnimationFrame(() => {
      const note = document.getElementById(`roast-note-${index}`);
      const box = note?.getBoundingClientRect();
      if (box && (box.top > window.innerHeight - 100 || box.bottom < 0)) {
        note.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  };
  const editPost = () => {
    setEditing(true);
    setNotice('Editing your original. Roast it again when you are ready.');
    window.requestAnimationFrame(() => document.getElementById('roast-draft')?.focus({ preventScroll: true }));
  };
  const copy = async () => {
    window.clearTimeout(copyTimer.current);
    const ok = await copyText(rewrite);
    setCopied(ok);
    setCopyError(!ok);
    setNotice(ok ? 'Your edited cleanup was copied.' : 'Copy is unavailable. Select the cleanup text and copy it manually.');
    document.getElementById('roast-rewrite')?.focus({ preventScroll: true });
    if (!ok) document.getElementById('roast-rewrite')?.select();
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  const makeCard = async () => {
    await document.fonts?.ready;
    const canvas = document.createElement('canvas');
    drawRoastCard(canvas, {
      personaName: PERSONAS.find(p => p.id === personaId).name,
      intensityName: INTENSITIES[intensity - 1].name,
      score: result.score,
      lines: result.lines,
    });
    return canvas;
  };
  const download = async () => {
    setExporting(true);
    try {
      await downloadCanvas(await makeCard(), 'linkedin-beats-roast.png');
      setNotice('Your roast receipt has been downloaded.');
    } catch { setNotice('The receipt could not be created. Try copying the verdict instead.'); }
    finally { setExporting(false); }
  };
  const share = async () => {
    setExporting(true);
    try {
      const canvas = await makeCard();
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image unavailable')), 'image/png'));
      const file = new File([blob], 'linkedin-beats-roast.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My professional presence is under review.' });
        setNotice('Receipt handed to your share sheet.');
      } else {
        await downloadCanvas(canvas, 'linkedin-beats-roast.png');
        setNotice('Receipt downloaded. Attach it to your next post or message.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setNotice('Sharing is unavailable here. Use Download receipt instead.');
    } finally { setExporting(false); }
  };
  const copyVerdict = async () => {
    const text = `Professional presence: under review.\n${result.score.index}/100 on the satirical Thought Leadership Index.\n\n${result.lines.slice(0, 2).join('\n\n')}\n\nReviewed by ${PERSONAS.find(p => p.id === personaId).name}.\nGet your verdict: https://linkedinbeats.com/roast/`;
    const ok = await copyText(text);
    setNotice(ok ? 'Verdict copied. Paste it into your own post or message.' : 'Copy unavailable. Download the receipt instead.');
  };
  const reset = () => {
    setDraft(''); setReview(null); setEditing(true); setRewrite('');
    setNotice('Ready for another post.');
    window.requestAnimationFrame(() => document.getElementById('roast-draft')?.focus());
  };

  const reviewer = PERSONAS.find(p => p.id === personaId);
  return <div className="rp-page" data-heat={intensity}>
    <PegFlames burst={flameBurst} anchorRef={igniteRef}/>
    <a className="rp-skip" href="#main">Skip to the roast</a>
    <main id="main">
      <header className="rp-hero">
        <div><p className="rp-kicker">Your personal brand. Open flame.</p><h1><PegLabel text="ROAST" face={9} pitch={10}/></h1></div>
        <div className="rp-hero-aside"><HeatSignal heat={intensity} key={intensity}/><p>A performance review.<br/><em>Without the promotion.</em></p></div>
      </header>
      <div className="rp-console">
        <section className="rp-submission" aria-labelledby="roast-title">
          <div className="rp-submission-top"><h2 id="roast-title">Put your post on the line.</h2><div className="rp-kinds" role="group" aria-label="What are we roasting?">
            {KINDS.map(k => <button type="button" key={k.id} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setReview(null); setEditing(true); setRewrite(''); setNotice('Choose an example or paste your text.'); }}>{KIND_LABELS[k.id]}</button>)}
          </div></div>
          <div className="rp-editor">
            <div className="rp-editor-bar"><label htmlFor={editing ? 'roast-draft' : undefined}>Your {KIND_LABELS[kind].toLowerCase()}</label>
              <button type="button" className="rp-text-button" onClick={() => { setDraft(EXAMPLES[kind]); setEditing(true); setNotice('Example loaded. Choose your reviewer and roast it.'); }}>Try an example <DotIcon/></button>
              {!editing && <button type="button" className="rp-text-button" onClick={editPost}><Pencil size={16} aria-hidden="true"/>Edit original</button>}
            </div>
            {editing ? <>
              <textarea id="roast-draft" data-testid="input-roast-draft" className="rp-input" value={draft} maxLength={MAX_LENGTH} rows={5}
                placeholder="Humbled and honored to announce…"
                aria-describedby="roast-input-hint" onChange={e => setDraft(e.target.value)} />
              {draft.length > MAX_LENGTH && <p role="alert">Please shorten your draft to {MAX_LENGTH.toLocaleString()} characters.</p>}
            </> : <MarkedDocument text={review.text} findings={result.findings} activeFinding={activeFinding} onSelect={selectFinding} />}
            <div className="rp-editor-bottom"><p id="roast-input-hint">Your words stay in this browser.</p><span className="rp-count">{draft.length.toLocaleString()} / 20,000</span></div>
            <div className="rp-edit-actions">{editing && review && <button type="button" className="rp-text-button" onClick={() => { setDraft(review.text); setEditing(false); setNotice('Back to your last roast.'); }}>Back to verdict</button>}{draft && <button type="button" className="rp-text-button" onClick={reset}>Start fresh</button>}</div>
          </div>
        </section>
        <aside className="rp-controls" aria-label="Roast settings">
          <fieldset className="rp-heat"><legend><PegLabel text="HEAT" face={5} pitch={3}/></legend><div className="rp-heat-options">{HEAT.map((label, index) => <button key={label} type="button" aria-pressed={intensity === index + 1} onClick={() => changeHeat(index + 1)}><span className="rp-heat-pegs" aria-hidden="true">{[0,1,2,3].map(i=><i key={i} className={i<=index?'is-lit':''}/>)}</span>{label}</button>)}</div><p className="rp-heat-note">{HEAT_NOTES[intensity-1]}</p></fieldset>
          <div className="rp-reviewer"><label className="rp-voice" htmlFor="roast-inspector">Choose your reviewer<select id="roast-inspector" value={personaId} onChange={e => changeVoice(e.target.value)}>{PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p>{reviewer.tagline}</p></div>
          <button type="button" className="rp-primary rp-ignite-button" ref={igniteRef} data-testid="button-roast" disabled={!valid} onClick={() => runRoast({ focus: true, keepRewrite: Boolean(result) })}><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#ico-roast"/></svg><span>{result ? 'Roast again' : 'Roast me'}</span><DotIcon/></button>
        </aside>
      </div>
      {result ? <section className="rp-result" aria-labelledby="roast-result-title" key={roastCount}>
        <div className="rp-result-heading"><h2 id="roast-result-title" ref={resultRef} tabIndex={-1}><PegLabel text={result.clean ? 'NOTHING TO BURN' : 'WELL DONE.'} face={5} pitch={4}/></h2><span>{reviewer.name}</span></div>
        <div className="rp-diagnosis">
          <div className="rp-verdict"><span className="rp-eyebrow">{result.clean ? 'A rare outcome.' : result.opener}</span><blockquote>{result.lines[0]}</blockquote><p className="rp-verdict-label">{verdict[0]}</p></div>
          <div className="rp-score"><span>Thought Leadership<br/>Index</span><strong><PegLabel text={String(result.score.index)} face={5} pitch={8}/><small>/100</small></strong><div className="rp-score-pegs" aria-hidden="true">{Array.from({length:50},(_,i)=><i key={i} className={i<Math.round(result.score.index/2)?'is-lit':''}/>)}</div><b>{result.score.rank}</b><small>A satirical writing score.</small></div>
        </div>
        <div className="rp-feedback-grid">
          <div className="rp-notes"><h3>The receipts.</h3>
            {result.findings.length ? result.findings.map((finding, index) => {
              const [title, advice] = EDITORIAL_NOTES[finding.key] || ['A small edit.', 'Make the claim specific.'];
              const evidence = evidenceFor(review.text, finding);
              return <section className={`rp-note ${activeFinding === index ? 'is-active' : ''}`} key={finding.key} id={`roast-note-${index}`}>
                <div className="rp-note-caption"><span>{String(index + 1).padStart(2, '0')}</span><h4>{evidence ? '“' + evidence + '”' : title}</h4></div>
                {index > 0 && <p className="rp-punchline">{result.lines[index]}</p>}
                <details open={activeFinding === index} onToggle={event=>{if(event.currentTarget.open && activeFinding!==index)setActiveFinding(index);else if(!event.currentTarget.open && activeFinding===index)setActiveFinding(-1);}}><summary>Make it better</summary><p className="rp-advice">{advice}</p></details>
              </section>;
            }) : <p>We found no familiar clichés. Keep the specific details. They’re doing the work.</p>}
          </div>
          <div className="rp-cleanup"><label htmlFor="roast-rewrite"><PegLabel text="DAMAGE CONTROL" face={5} pitch={2.5}/></label><p>A little less LinkedIn. A little more you.</p><AutoTextarea id="roast-rewrite" data-testid="text-clean-rewrite" className="rp-cleanup-input" value={rewrite} onChange={e => { setRewrite(e.target.value); setCopied(false); setCopyError(false); }} aria-describedby="roast-cleanup-hint"/><p className="rp-hint" id="roast-cleanup-hint">A light cleanup. Your facts stay intact. Edit freely.</p><button className="rp-secondary" type="button" disabled={!rewrite.trim()} data-testid="button-copy-rewrite" onClick={copy}>{copied ? <Check size={17} aria-hidden="true"/> : <Copy size={17} aria-hidden="true"/>}{copied ? 'Copied' : 'Copy cleanup'}</button>{copyError && <p className="rp-hint">Your text is selected. Press ⌘C or Ctrl+C to copy it.</p>}<a className="rp-text-button" href="../optimizer">Or make it worse <ArrowUpRight size={16} aria-hidden="true"/></a></div>
        </div>
        <div className="rp-share-strip"><div><PegLabel text="TAKE THE HEAT" face={5} pitch={2.5}/><p>Keep the roast. Spare the original.</p></div><div className="rp-share-actions"><button type="button" className="rp-secondary" disabled={exporting} onClick={download}><Download size={17} aria-hidden="true"/>{exporting ? 'Preparing…' : 'Save receipt'}</button><button type="button" className="rp-secondary" disabled={exporting} onClick={share}><Share2 size={17} aria-hidden="true"/>Share</button><button type="button" className="rp-text-button" onClick={copyVerdict}><Copy size={16} aria-hidden="true"/>Copy roast</button></div></div>
      </section> : <p className="rp-idle">Four reviewers. Zero endorsements. <span>At least the feedback is free.</span></p>}
      <p className="rp-notice" role="status" aria-live="polite">{notice}</p>
    </main>
    <Footer base="../" />
  </div>;
}

function HeatSignal({heat}) {
  return <svg className="rp-heat-signal" viewBox="0 0 132 24" aria-hidden="true">{Array.from({length:88},(_,i)=>{
    const x=i%22,y=Math.floor(i/22),on=x<heat*5+2;
    return <circle key={i} cx={x*6+3} cy={y*6+3} r="1.9" className={on?'is-lit':''} style={{'--delay':`${x*22+y*30}ms`}}/>;
  })}</svg>;
}
