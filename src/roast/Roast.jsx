import React from 'react';
import { ArrowUpRight, ArrowRight, Copy, Check, Pencil, ChevronDown, Download, Flame, Share2, Pause, Play } from 'lucide-react';
import { Header } from '../brand/Header.jsx';
import { Footer } from '../brand/Footer.jsx';
import { KINDS, roastIt } from './roastEngine.js';
import { PERSONAS, INTENSITIES } from './personas.js';
import { drawRoastCard, downloadCanvas } from './card.js';
import { newSeed } from '../lessons/generator.js';
import { RoastFlames } from './RoastFlames.jsx';
import { MarkedDocument } from './MarkedDocument.jsx';
import { EDITORIAL_NOTES, verdictFor } from './editorial.js';
import '../lessons/lessons.css';
import '../lessons/rows.css';
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
  const [intensity, setIntensity] = React.useState(2);
  const [review, setReview] = React.useState(null);
  const [editing, setEditing] = React.useState(true);
  const [rewrite, setRewrite] = React.useState('');
  const [activeFinding, setActiveFinding] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  const [flames, setFlames] = React.useState(true);
  const [roastCount, setRoastCount] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);
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

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const runRoast = ({ text = draft, nextKind = kind, voice = personaId, heat = intensity, keepRewrite = false, focus = false } = {}) => {
    if (!text.trim() || text.length > MAX_LENGTH) return;
    const next = roastIt({ kind: nextKind, text, personaId: voice, intensity: heat, seed: newSeed() });
    setDraft(text);
    setReview({ text, kind: nextKind, result: next });
    setRoastCount(count => count + 1);
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

  return <div className="ll-app ll-rows rp-page">
    <a className="ll-skip" href="#main">Skip to the roast</a>
    <Header base="../" active="Roast" theme="dark" />
    <main id="main">
      <div className="el-toolbar rp-toolbar">
        <div className="rp-brand"><Flame aria-hidden="true"/><div><span>THE ROAST ROOM / RM-01</span><h1>Roast my post.</h1></div></div>
        <div className="el-categories" role="group" aria-label="What are we roasting?">
          {KINDS.map(k => <button type="button" key={k.id} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setReview(null); setEditing(true); setRewrite(''); setNotice('Choose an example or paste your text.'); }}>{KIND_LABELS[k.id]}</button>)}
        </div>
      </div>
      <div className="el-workspace">
        <section className="el-facts" aria-labelledby="roast-title">
          <div className="el-row-heading"><h2 id="roast-title">Submit for review.</h2><p>Your words. Our unsolicited professional opinion.</p></div>
          <div className="el-receipt rp-editor">
            <div className="rp-editor-bar"><label htmlFor={editing ? 'roast-draft' : undefined}>Your {KIND_LABELS[kind].toLowerCase()}</label>
              <button type="button" className="rp-text-button" onClick={() => { setDraft(EXAMPLES[kind]); setEditing(true); setNotice('Example loaded. Choose your reviewer and roast it.'); }}>Try an example</button>
              {!editing && <button type="button" className="rp-text-button" onClick={editPost}><Pencil size={16} aria-hidden="true"/>Edit original</button>}
            </div>
            {editing ? <>
              <textarea id="roast-draft" data-testid="input-roast-draft" className="rp-input" value={draft} maxLength={MAX_LENGTH} rows={5}
                placeholder="Humbled and honored to announce that I have successfully completed another Monday…"
                aria-describedby="roast-input-hint" onChange={e => setDraft(e.target.value)} />
              {draft.length > MAX_LENGTH && <p role="alert">Please shorten your draft to {MAX_LENGTH.toLocaleString()} characters.</p>}
            </> : <MarkedDocument text={review.text} findings={result.findings} activeFinding={activeFinding} onSelect={selectFinding} />}
            <div className="el-receipt-tools">
              <div className="el-fact-actions">{editing && review && <button type="button" onClick={() => { setDraft(review.text); setEditing(false); setNotice('Back to your last roast.'); }}>Back to verdict</button>}{draft && <button type="button" onClick={reset}>Start fresh</button>}</div>
              <div className="el-input-bottom"><p className="el-hint" id="roast-input-hint">Paste the text, not a link. It stays in your browser.</p><span className="rp-count">{draft.length.toLocaleString()} / 20,000</span></div>
              <aside className="el-synergy" aria-label="Synergy"><span className="el-synergy-note">{result ? 'Feedback is a gift.' : 'We need to talk.'}</span><img src="../lessons/synergy-assistant.webp" width="512" height="512" alt="Synergy holding his coffee" /></aside>
            </div>
          </div>
          <div className="rp-controls">
            <fieldset className="rp-heat"><legend>Turn up the heat.</legend><div className="el-choice-pills">{HEAT.map((label, index) => <button key={label} type="button" aria-pressed={intensity === index + 1} onClick={() => changeHeat(index + 1)}><Flame size={14} aria-hidden="true"/>{label}</button>)}</div></fieldset>
            <label className="rp-voice" htmlFor="roast-inspector">Your reviewer<select id="roast-inspector" value={personaId} onChange={e => changeVoice(e.target.value)}>{PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <button type="button" className="rp-primary rp-ignite-button" data-testid="button-roast" disabled={!valid} onClick={() => runRoast({ focus: true, keepRewrite: Boolean(result) })}><Flame size={20} aria-hidden="true"/>{result ? 'Roast again' : 'Roast my ' + (kind === 'about' ? 'bio' : kind)}</button>
          </div>
        </section>
        <section className="el-output rp-result" aria-labelledby="roast-result-title">
          <div className="el-row-heading rp-result-heading"><div><h2 id="roast-result-title" ref={resultRef} tabIndex={-1}>{result ? 'Freshly roasted.' : 'Your professional diagnosis.'}</h2><p>{result ? HEAT_NOTES[intensity - 1] : 'Constructive. Mostly.'}</p></div>{result && !reducedMotion && <button type="button" className="rp-flame-toggle" aria-pressed={flames} onClick={()=>setFlames(value=>!value)} aria-label={flames?'Pause flame animation':'Play flame animation'}>{flames?<Pause size={15} aria-hidden="true"/>:<Play size={15} aria-hidden="true"/>}{flames?'Flames on':'Flames paused'}</button>}</div>
          {result ? <>
            <div className="rp-diagnosis">
              <div className="rp-score"><span>Thought Leadership Index</span><div><strong>{result.score.index}</strong><span>/ 100</span></div><b>{result.score.rank}</b><small>A satirical writing score.</small><RoastFlames key={roastCount} heat={intensity} animate={flames&&!reducedMotion}/><span className="rp-heat-stamp">{HEAT[intensity-1]} / SERVED HOT</span></div>
              <div className="rp-verdict"><span className="rp-eyebrow">REVIEW COMPLETE</span><h3>{verdict[0]}</h3><p>{verdict[1]}</p><span className="rp-inspector">{PERSONAS.find(p => p.id === personaId).name}</span></div>
            </div>
            <div className="rp-share-actions"><button type="button" className="rp-primary" disabled={exporting} onClick={download}><Download size={17} aria-hidden="true"/>{exporting ? 'Preparing receipt…' : 'Download receipt'}</button><button type="button" className="rp-secondary" disabled={exporting} onClick={share}><Share2 size={17} aria-hidden="true"/>Share receipt</button><button type="button" className="rp-text-button" onClick={copyVerdict}><Copy size={16} aria-hidden="true"/>Copy verdict</button></div>
            <p className="rp-hint">The receipt includes the score and reviewer’s notes, not your original text. Nothing is published automatically.</p>
            <div className="rp-feedback-grid">
              <div className="rp-notes"><h3>Notes from your reviewer.</h3>
                {result.findings.length ? result.findings.map((finding, index) => {
                  const [title, advice] = EDITORIAL_NOTES[finding.key] || ['A small edit.', 'Make the claim specific.'];
                  return <section className={`rp-note ${activeFinding === index ? 'is-active' : ''}`} key={finding.key} id={`roast-note-${index}`} hidden={!showAll && index >= 3}>
                    <button type="button" className="rp-note-title" onClick={() => selectFinding(index)} aria-expanded={activeFinding === index} aria-controls={`roast-advice-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{title}<ChevronDown size={17} aria-hidden="true"/></button>
                    <div className="rp-note-detail" id={`roast-advice-${index}`} hidden={activeFinding !== index}><p>{result.lines[index]}</p><p className="rp-advice"><strong>Try this</strong>{advice}</p></div>
                  </section>;
                }) : <p>{result.lines[0]}</p>}
                {result.findings.length > 3 && <button type="button" className="rp-text-button" aria-expanded={showAll} onClick={() => { setShowAll(!showAll); if (showAll && activeFinding >= 3) setActiveFinding(0); }}>{showAll ? 'Fewer notes' : `All ${result.findings.length} notes`}<ChevronDown size={16} aria-hidden="true"/></button>}
              </div>
              <div className="rp-cleanup"><label htmlFor="roast-rewrite">A little less LinkedIn.</label><AutoTextarea id="roast-rewrite" data-testid="text-clean-rewrite" className="rp-cleanup-input" value={rewrite} onChange={e => { setRewrite(e.target.value); setCopied(false); setCopyError(false); }} aria-describedby="roast-cleanup-hint"/><p className="rp-hint" id="roast-cleanup-hint">A first pass. Edit it to sound like you.</p><button className="rp-secondary" type="button" disabled={!rewrite.trim()} data-testid="button-copy-rewrite" onClick={copy}>{copied ? <Check size={17} aria-hidden="true"/> : <Copy size={17} aria-hidden="true"/>}{copied ? 'Copied' : 'Copy cleanup'}</button>{copyError && <p className="rp-hint">Your text is selected. Press ⌘C or Ctrl+C to copy it.</p>}<a className="rp-text-button" href="../optimizer">Give it the full LinkedIn treatment <ArrowUpRight size={16} aria-hidden="true"/></a></div>
            </div>
          </> : <div className="rp-empty"><Flame aria-hidden="true"/><div><h3>{editing && review ? 'An amendment to the record.' : 'Awaiting ignition.'}</h3><p>{editing && review ? 'Finish editing, then roast it again for an updated verdict.' : 'Submit your post above. We’ll return a score, annotated feedback, and a receipt worth circulating.'}</p></div><span>INSERT PERSONAL BRAND HERE</span></div>}
        </section>
      </div>
      <p className="rp-notice" role="status" aria-live="polite">{notice}</p>
    </main>
    <Footer base="../" />
  </div>;
}
