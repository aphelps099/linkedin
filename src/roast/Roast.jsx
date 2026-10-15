import React from 'react';
import { ArrowUpRight, ArrowRight, Copy, Check, Pencil, ChevronDown, Download } from 'lucide-react';
import { Header } from '../brand/Header.jsx';
import { Footer } from '../brand/Footer.jsx';
import { KINDS, roastIt } from './roastEngine.js';
import { PERSONAS, INTENSITIES } from './personas.js';
import { drawRoastCard, downloadCanvas } from './card.js';
import { newSeed } from '../lessons/generator.js';
import { MarkedDocument } from './MarkedDocument.jsx';
import { EDITORIAL_NOTES, evidenceFor, verdictFor } from './editorial.js';
import './roast.css';

const MAX_LENGTH = 20000;
const HEAT = ['Gentle', 'Honest', 'Brutal', 'HR violation'];
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
  const [intensity, setIntensity] = React.useState(2);
  const [review, setReview] = React.useState(null);
  const [editing, setEditing] = React.useState(true);
  const [rewrite, setRewrite] = React.useState('');
  const [activeFinding, setActiveFinding] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const [notice, setNotice] = React.useState('');
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
  React.useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const runRoast = ({ text = draft, nextKind = kind, voice = personaId, heat = intensity, keepRewrite = false, focus = false } = {}) => {
    if (!text.trim() || text.length > MAX_LENGTH) return;
    const next = roastIt({ kind: nextKind, text, personaId: voice, intensity: heat, seed: newSeed() });
    setDraft(text);
    setReview({ text, kind: nextKind, result: next });
    setEditing(false);
    if (!keepRewrite) setRewrite(next.useful);
    setActiveFinding(0);
    setShowAll(false);
    setCopied(false);
    setCopyError(false);
    setNotice(next.clean ? 'Roast ready. No familiar clichés found.' : `Roast ready. ${next.findings.length} editing notes.`);
    if (focus) window.requestAnimationFrame(() => {
      resultRef.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 760px)').matches) {
        resultRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
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
    if (index >= 3) setShowAll(true);
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
  const download = async () => {
    try {
      await document.fonts?.ready;
      const canvas = document.createElement('canvas');
      drawRoastCard(canvas, {
        personaName: PERSONAS.find(p => p.id === personaId).name,
        intensityName: INTENSITIES[intensity - 1].name,
        score: result.score,
        lines: result.lines,
      });
      downloadCanvas(canvas, 'linkedin-beats-roast.png');
      setNotice('Your roast card is ready to download.');
    } catch {
      setNotice('The card could not be created. You can still copy your cleanup.');
    }
  };

  return <div className="rp-page">
    <Header base="../" active="Roast" />
    <main className="rp-main" id="main">
      <div className="rp-workspace">
        <section className="rp-document-pane" aria-labelledby="roast-title">
          <p className="rp-eyebrow">ROAST MY POST</p>
          <h1 id="roast-title">YOUR POST.<br />WITH NOTES.</h1>
          <div className="rp-editor-bar">
            <div className="rp-kinds" role="group" aria-label="What are we roasting?">
              {KINDS.map(item => <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => {
                if (kind === item.id) return;
                setKind(item.id); setReview(null); setEditing(true); setRewrite(''); setCopied(false); setNotice('');
              }}>{KIND_LABELS[item.id]}</button>)}
            </div>
            {result && <button className="rp-text-button" type="button" onClick={editPost}>Edit original <Pencil size={18} aria-hidden="true" /></button>}
          </div>

          {editing ? <div className="rp-intake">
            <label className="rp-sr-only" htmlFor="roast-draft">Your {KIND_LABELS[kind].toLowerCase()} to roast</label>
            <textarea id="roast-draft" data-testid="input-roast-draft" className="rp-input" value={draft} maxLength={MAX_LENGTH} rows={7}
              placeholder={kind === 'post' ? 'Paste your post here.\n\nYes, the one about your journey.' : KINDS.find(item => item.id === kind).hint}
              onChange={event => { setDraft(event.target.value); setNotice(''); }}
              onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runRoast({ focus: true }); } }} />
            <div className="rp-intake-actions">
              <button type="button" className="rp-text-button" onClick={() => runRoast({ text: EXAMPLES[kind], focus: true })}>Try an example <ArrowUpRight size={20} aria-hidden="true" /></button>
              {review ? <button type="button" className="rp-text-button" onClick={() => { setDraft(review.text); setEditing(false); setNotice('Back to your last roast.'); }}>Back to notes</button>
                : <span>Your words stay in this browser.</span>}
            </div>
            {draft.length > MAX_LENGTH && <p role="alert">Please shorten your draft to {MAX_LENGTH.toLocaleString()} characters.</p>}
          </div> : <div className={`rp-markup ${result.findings.length ? '' : 'is-clean'}`}>
            <MarkedDocument text={review.text} findings={result.findings} activeFinding={activeFinding} onSelect={selectFinding} />
            {result.findings.length > 0 && <aside className="rp-notes" aria-label="Red pen editing notes">
              {result.findings.map((finding, index) => {
                const [title, advice] = EDITORIAL_NOTES[finding.key] || ['A small edit.', 'Make the claim specific.'];
                const evidence = evidenceFor(review.text, finding);
                return <section className={`rp-note ${activeFinding === index ? 'is-active' : ''}`} key={finding.key} id={`roast-note-${index}`} hidden={!showAll && index >= 3}>
                  <button type="button" className="rp-note-title" onClick={() => selectFinding(index)} aria-expanded={activeFinding === index} aria-controls={`roast-advice-${index}`}>
                    <span aria-hidden="true">↙</span> {title}
                  </button>
                  <div className="rp-note-detail" id={`roast-advice-${index}`} hidden={activeFinding !== index}>
                    <p className="rp-note-roast">{result.lines[index]}</p>
                    <p className="rp-advice"><strong>Try this</strong>{advice}</p>
                    {!evidence && <span className="rp-whole-post">A note on the whole {KIND_LABELS[kind].toLowerCase()}.</span>}
                  </div>
                </section>;
              })}
              {result.findings.length > 3 && <button className="rp-more-notes" type="button" aria-expanded={showAll} onClick={() => { setShowAll(!showAll); if (showAll && activeFinding >= 3) setActiveFinding(0); }}>
                {showAll ? 'Fewer notes' : `All ${result.findings.length} notes`} <ChevronDown size={18} aria-hidden="true" />
              </button>}
            </aside>}
            {!result.findings.length && <p className="rp-clean-note">No red ink needed.<br />We’re as surprised as you are.</p>}
          </div>}
        </section>

        <aside className={`rp-result ${result ? 'has-result' : ''}`} aria-label="Your roast and cleanup">
          {result ? <>
            <p className="rp-eyebrow">THE VERDICT</p>
            <h2 ref={resultRef} tabIndex={-1}>{verdict[0]}</h2>
            <p className="rp-verdict-line">{verdict[1]}</p>
            <div className="rp-rewrite">
              <label className="rp-eyebrow" htmlFor="roast-rewrite">THE CLEANUP</label>
              <AutoTextarea id="roast-rewrite" data-testid="text-clean-rewrite" className="rp-cleanup-input" value={rewrite} onChange={event => { setRewrite(event.target.value); setCopied(false); setCopyError(false); }} aria-describedby="roast-cleanup-hint" />
              <p className="rp-hint" id="roast-cleanup-hint">{result.useful === review.text.trim() ? 'Already fairly plain. Use the notes to make your next edit.' : 'A first pass. Edit it to sound like you.'}</p>
              <button className="rp-copy" type="button" disabled={!rewrite.trim()} data-testid="button-copy-rewrite" onClick={copy}>
                {copied ? <Check size={22} aria-hidden="true" /> : <Copy size={22} aria-hidden="true" />}{copied ? 'Copied' : 'Copy cleanup'}<ArrowRight size={23} aria-hidden="true" />
              </button>
              {copyError && <p className="rp-hint">Your text is selected. Press ⌘C or Ctrl+C to copy it.</p>}
            </div>
            <details className="rp-extras"><summary>Keep the evidence <ChevronDown size={18} aria-hidden="true" /></summary><div>
              <button type="button" className="rp-text-button" onClick={download}><Download size={18} aria-hidden="true" /> Download roast card</button>
              {kind === 'post' && <a className="rp-text-button" href={`../studio/#beat=${encodeURIComponent(review.text)}`}>Turn it into a beat <ArrowUpRight size={18} aria-hidden="true" /></a>}
              <button type="button" className="rp-text-button" onClick={() => { setDraft(''); setReview(null); setEditing(true); setRewrite(''); setNotice('Ready for another post.'); window.requestAnimationFrame(() => document.getElementById('roast-draft')?.focus()); }}>Start fresh <ArrowRight size={18} aria-hidden="true" /></button>
            </div></details>
          </> : <div className="rp-awaiting">
            <p className="rp-eyebrow">CONSTRUCTIVE. MOSTLY.</p>
            <div className="rp-pen-message" aria-hidden="true">Let’s take the<br /><span>“thought leader”</span><br />out of this.</div>
            <svg className="rp-pen-arrow" viewBox="0 0 220 150" aria-hidden="true"><path d="M185 10c45 78-13 108-150 91m21-22-26 21 28 19" /></svg>
            <p className="rp-awaiting-copy">Your words. A little red ink.<br />Something better to post.</p>
          </div>}
        </aside>

        <div className="rp-controls">
          <fieldset className="rp-heat"><legend>How honest?</legend><div>
            {HEAT.map((label, index) => <button key={label} type="button" aria-pressed={intensity === index + 1} onClick={() => changeHeat(index + 1)}>{label}</button>)}
          </div></fieldset>
          <button type="button" className="rp-roast-button" data-testid="button-roast" disabled={!valid} onClick={() => result ? editPost() : runRoast({ focus: true })}>
            {result ? 'Edit my original' : `Roast my ${kind === 'about' ? 'bio' : kind}`} <ArrowUpRight size={25} aria-hidden="true" />
          </button>
          <details className="rp-voice"><summary>Choose an inspector <ChevronDown size={18} aria-hidden="true" /></summary><label>
            <span className="rp-sr-only">Inspector</span><select value={personaId} onChange={event => changeVoice(event.target.value)}>{PERSONAS.map(persona => <option value={persona.id} key={persona.id}>{persona.name}</option>)}</select>
          </label></details>
        </div>
      </div>
      <p className="rp-sr-only" role="status" aria-live="polite">{notice}</p>
    </main>
    <Footer />
  </div>;
}
