import React from 'react';
import { Button } from '../components/controls/Button.jsx';
import { Unit } from '../components/chassis/Unit.jsx';
import { Masthead } from '../components/chassis/Masthead.jsx';
import { Ticker } from '../components/chassis/Ticker.jsx';
import { CATEGORIES, byId } from './categories.js';
import { LEVELS, generate, humanize, linkedinify, roast, newSeed } from './generator.js';
import { scorePost } from './score.js';

// LINKEDIN LESSONS — a guided post generator disguised as satire.
// Category → one-question-at-a-time interview → the LinkedInification dial.
// Level 1 writes the post you should publish; level 5 writes the one you will.

const LABEL = { fontSize: 'var(--label-size)', fontWeight: 700, letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' };
const META = { ...LABEL, color: 'var(--text-meta)' };

async function copyText(t){
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }
}

function useNarrow(){
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < 880);
  React.useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 880);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return narrow;
}

// ---- the LinkedIn-style preview card ------------------------------------

function Post({ text, score, narrow }){
  const paras = text.split(/\n{2,}/);
  const reactions = 3 + Math.round(score.index * 8.4) + score.oneLiners * 11;
  const comments = 1 + Math.round(score.wellDeserved / 6);
  const reposts = Math.round(score.index / 9);
  return <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--ink)' }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 16px 0' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--blue)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flex: 'none' }}>YU</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>You <span style={{ color: 'var(--text-meta)', fontWeight: 400 }}>· 1st</span></div>
        <div style={{ fontSize: 11, color: 'var(--text-meta)' }}>Chief Vision Officer · Thought leader</div>
        <div style={{ fontSize: 11, color: 'var(--text-meta)' }}>2h · 🌐</div>
      </div>
    </div>
    <div style={{ padding: narrow ? '12px 16px' : '14px 16px', fontSize: 14, lineHeight: 1.5 }}>
      {paras.map((p, i) => <p key={i} style={{ margin: i ? '12px 0 0' : 0, whiteSpace: 'pre-wrap',
        color: /^(#\w+\s*)+$/.test(p) ? 'var(--blue)' : 'inherit' }}>{p}</p>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--hair)',
      fontSize: 11.5, color: 'var(--text-meta)' }}>
      <span>👍❤️💡 {reactions.toLocaleString()}</span>
      <span>{comments} comments · {reposts} reposts</span>
    </div>
  </div>;
}

// ---- the metrics panel --------------------------------------------------

function Metric({ label, value, note }){
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
    borderBottom: '1px dotted var(--hair)', padding: '6px 0' }}>
    <span style={{ ...META, fontSize: 9 }}>{label}</span>
    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }}>
      <b style={{ color: 'var(--blue)' }}>{value}</b>{note ? <span style={{ color: 'var(--text-meta)' }}> {note}</span> : null}
    </span>
  </div>;
}

function Metrics({ s }){
  return <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: '12px 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <span style={LABEL}>Post diagnostics</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-meta)' }}>{s.words} words</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: '1px solid var(--hair)', paddingBottom: 8 }}>
      <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-.05em', lineHeight: 1, color: 'var(--blue)' }}>{s.index}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{s.rank}<br/><span style={{ ...META, fontSize: 8.5 }}>Thought Leadership Index</span></span>
    </div>
    <Metric label="Humble-brag score" value={`${s.humbleBrag}%`}/>
    <Metric label="Buzzword density" value={s.buzzDensity} note="per 100 words"/>
    <Metric label="Gratitude inflation" value={s.gratitude} note={`· ${s.gratitudeLabel}`}/>
    <Metric label="Dramatic one-liners" value={s.oneLiners}/>
    <Metric label="Journey references" value={s.journeys}/>
    <Metric label='Chance of "Well deserved!"' value={`${s.wellDeserved}%`}/>
  </div>;
}

// ---- the dial -----------------------------------------------------------

function Dial({ level, onChange }){
  const cur = LEVELS[level - 1];
  return <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: '12px 14px' }}>
    <div style={{ ...LABEL, marginBottom: 8 }}>LinkedInification level</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {LEVELS.map(l =>
        <button key={l.n} onClick={() => onChange(l.n)}
          style={{ height: 40, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, cursor: 'pointer',
            background: l.n === level ? 'var(--blue)' : l.n < level ? 'var(--blue-light)' : '#fff',
            color: l.n === level ? '#fff' : 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15 }}>{l.n}</button>)}
    </div>
    <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>{cur.n} — {cur.name}</div>
    <div style={{ fontSize: 11.5, color: 'var(--text-meta)', lineHeight: 1.45 }}>{cur.blurb}</div>
  </div>;
}

// ---- screens ------------------------------------------------------------

function Home({ narrow, onPick }){
  return <>
    <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', justifyContent: 'space-between',
      alignItems: narrow ? 'flex-start' : 'flex-end', gap: narrow ? 10 : 30, marginTop: 18 }}>
      <h1 style={{ margin: 0, fontSize: narrow ? 28 : 40, lineHeight: 1.02, letterSpacing: '-.045em', fontWeight: 700,
        color: 'var(--blue)', maxWidth: 560 }}>What are we pretending to be humbled about today?</h1>
      <p style={{ margin: 0, fontSize: narrow ? 12.5 : 13, lineHeight: 1.45, maxWidth: 380 }}>
        A guided post generator. Answer a few questions, choose your LinkedInification level, publish.
        {' '}<b style={{ color: 'var(--blue)' }}>Create a better LinkedIn post — or make it dramatically worse.</b>
      </p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 12, marginTop: 22 }}>
      {CATEGORIES.map(c => <CategoryCard key={c.id} c={c} onPick={onPick}/>)}
    </div>
    <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', ...META }}>
      <span>Everything is generated in your browser. Nothing is sent anywhere.</span>
      <a href="../" style={{ color: 'var(--blue)' }}>Circle Back® — the LinkedIn remixer →</a>
    </div>
  </>;
}

function CategoryCard({ c, onPick }){
  const [hover, setHover] = React.useState(false);
  return <button onClick={() => onPick(c.id)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    style={{ textAlign: 'left', cursor: 'pointer', border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0,
      background: hover ? 'var(--ink)' : '#fff', color: hover ? '#fff' : 'var(--ink)', padding: '16px 18px',
      fontFamily: 'var(--sans)', transition: 'background var(--ease-ui), color var(--ease-ui)' }}>
    <div style={{ ...META, color: hover ? '#ffffff99' : 'var(--text-meta)', marginBottom: 6 }}>Form {c.form}</div>
    <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}>{c.name}</div>
    <div style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4, color: hover ? '#ffffffcc' : 'var(--ink)' }}>{c.subtitle}</div>
  </button>;
}

function Interview({ cat, narrow, initial, onDone, onHome }){
  const [answers, setAnswers] = React.useState(initial || {});
  const [ix, setIx] = React.useState(0);
  const [reaction, setReaction] = React.useState(null);
  const [draft, setDraft] = React.useState(() => {
    const first = cat.steps(initial || {})[0];
    return (initial && first && initial[first.key]) || '';
  });
  const inputRef = React.useRef(null);

  const steps = cat.steps(answers);
  const step = steps[ix];
  React.useEffect(() => { inputRef.current && inputRef.current.focus(); }, [ix]);

  const submit = value => {
    const v = (value !== undefined ? value : draft).trim();
    const next = { ...answers, [step.key]: v };
    setAnswers(next);
    setReaction(step.react ? step.react(v, next) : null);
    setDraft(next[steps[ix + 1] ? steps[ix + 1].key : ''] || '');
    if(ix + 1 >= cat.steps(next).length) onDone(next);
    else setIx(ix + 1);
  };
  const back = () => {
    if(ix === 0) return onHome();
    setIx(ix - 1); setReaction(null); setDraft(answers[steps[ix - 1].key] || '');
  };

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--blue)' }}>{cat.name}</span>
      <span style={META}>Question {ix + 1} of {steps.length} · Form {cat.form}</span>
    </div>
    {reaction && <Ticker label="The form reacts" style={{ marginTop: 14 }}>{reaction}</Ticker>}
    <div style={{ marginTop: reaction ? 14 : 18, background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: narrow ? 18 : 26 }}>
      <div style={{ fontSize: narrow ? 21 : 27, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.15 }}>{step.ask}</div>
      {step.type === 'choice'
        ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            {step.options.map(o => <Button key={o} onClick={() => submit(o)} style={{ padding: '12px 16px' }}>{o}</Button>)}
          </div>
        : <>
            {step.type === 'long'
              ? <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={3}
                  placeholder={step.placeholder || ''}
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 16, padding: 12, fontFamily: 'var(--sans)',
                    fontSize: 15, lineHeight: 1.5, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0,
                    background: 'var(--paper)', outline: 'none', resize: 'vertical' }}/>
              : <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter') submit(); }}
                  placeholder={step.placeholder || ''}
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 16, padding: 12, fontFamily: 'var(--sans)',
                    fontSize: 17, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0,
                    background: 'var(--paper)', outline: 'none' }}/>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <Button onClick={() => submit()} style={{ padding: '12px 18px' }}>Next</Button>
              <span style={{ ...META, fontSize: 8.5 }}>{step.type === 'long' ? '' : 'or press Enter'}</span>
            </div>
          </>}
    </div>
    <div style={{ marginTop: 12 }}><Button onClick={back}>← Back</Button></div>
  </>;
}

function Result({ catId, answers, narrow, onHome, onReinterview }){
  const [level, setLevel] = React.useState(4);
  const [seed, setSeed] = React.useState(newSeed);
  const [flags, setFlags] = React.useState({});
  const [roastOpen, setRoastOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const text = React.useMemo(
    () => generate({ category: catId, answers, level, seed, flags }),
    [catId, answers, level, seed, flags]);
  const s = React.useMemo(() => scorePost(text), [text]);
  const roastLines = React.useMemo(
    () => roastOpen ? roast(text, { score: s.index }) : null, [roastOpen, text, s]);

  const copy = async () => { await copyText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const toBeat = () => { location.href = '../#beat=' + encodeURIComponent(text); };

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
      <span style={{ fontSize: narrow ? 22 : 27, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--blue)' }}>Your supercharged post</span>
      <span style={META}>{byId(catId).name} · Form {byId(catId).form}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 340px', gap: narrow ? 14 : 'var(--space-col)', marginTop: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Post text={text} score={s} narrow={narrow}/>
        {roastOpen && <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--blue)', padding: '12px 14px' }}>
          <div style={{ ...LABEL, color: 'var(--blue)', marginBottom: 6 }}>The roast</div>
          {roastLines.map((l, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, borderBottom: '1px dotted var(--hair)', padding: '4px 0' }}>
            <span style={{ color: 'var(--blue)', fontWeight: 700 }}>→ </span>{l}</div>)}
        </div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Dial level={level} onChange={setLevel}/>
        <Metrics s={s}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button onClick={copy} style={{ gridColumn: '1 / -1', padding: '13px 16px', background: copied ? 'var(--blue)' : undefined, color: copied ? '#fff' : undefined, borderColor: copied ? 'var(--blue)' : undefined }}>
            {copied ? 'Copied ✓' : 'Copy post'}</Button>
          <Button onClick={() => setLevel(l => Math.min(5, l + 1))}>Make it worse</Button>
          <Button onClick={() => setLevel(1)}>Make it human</Button>
          <Button onClick={() => setFlags(f => ({ ...f, synergy: (f.synergy || 0) + 1 }))}>Add more synergy{flags.synergy ? ` ×${flags.synergy}` : ''}</Button>
          <Button on={!!flags.struggle} onClick={() => setFlags(f => ({ ...f, struggle: !f.struggle }))}>Add a struggle</Button>
          <Button on={!!flags.founder} onClick={() => setFlags(f => ({ ...f, founder: !f.founder }))}>Founder voice</Button>
          <Button on={roastOpen} onClick={() => setRoastOpen(o => !o)}>Roast this post</Button>
          <Button onClick={() => { setSeed(newSeed()); setFlags({}); }}>Regenerate</Button>
          <Button onClick={toBeat}>Turn it into a beat ♫</Button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onReinterview}>Edit answers</Button>
          <Button onClick={onHome}>New post</Button>
        </div>
      </div>
    </div>
  </>;
}

function Roast({ narrow, onHome }){
  const [draft, setDraft] = React.useState('');
  const [result, setResult] = React.useState(null); // {original, s, lines, better, worse}
  const [copied, setCopied] = React.useState(null);

  const file = () => {
    const t = draft.trim();
    if(!t) return;
    const s = scorePost(t);
    setResult({ original: t, s, lines: roast(t, { score: s.index }), better: humanize(t), worse: linkedinify(t, newSeed()) });
  };
  const copy = async (t, which) => { await copyText(t); setCopied(which); setTimeout(() => setCopied(null), 1600); };

  const panel = (title, text, which, tone) => <div style={{ background: '#fff', border: `var(--rule-frame) solid ${tone || 'var(--ink)'}`, padding: '12px 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
      <span style={{ ...LABEL, color: tone || 'var(--ink)' }}>{title}</span>
      <Button onClick={() => copy(text, which)} style={{ padding: '6px 10px' }}>{copied === which ? 'Copied ✓' : 'Copy'}</Button>
    </div>
    {text.split(/\n{2,}/).map((p, i) => <p key={i} style={{ margin: i ? '10px 0 0' : 0, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p}</p>)}
  </div>;

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
      <span style={{ fontSize: narrow ? 22 : 27, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--blue)' }}>Roast my post</span>
      <span style={META}>Form LL-06 · Complaints are processed locally</span>
    </div>
    <div style={{ marginTop: 14, background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: narrow ? 16 : 22,
      display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={META}>Paste your draft. It never leaves your browser.</span>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={narrow ? 7 : 9}
        placeholder="Paste your LinkedIn post here. Yes, that one."
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 12, fontFamily: 'var(--sans)', fontSize: 14,
          lineHeight: 1.5, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, background: 'var(--paper)', outline: 'none' }}/>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={file} style={{ padding: '12px 18px' }}>File the complaint</Button>
        <Button onClick={onHome}>← Back</Button>
      </div>
    </div>
    {result && <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '340px minmax(0,1fr)', gap: narrow ? 14 : 'var(--space-col)', marginTop: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Metrics s={result.s}/>
        <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--blue)', padding: '12px 14px' }}>
          <div style={{ ...LABEL, color: 'var(--blue)', marginBottom: 6 }}>The roast</div>
          {result.lines.map((l, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, borderBottom: '1px dotted var(--hair)', padding: '4px 0' }}>
            <span style={{ color: 'var(--blue)', fontWeight: 700 }}>→ </span>{l}</div>)}
        </div>
        <Button onClick={() => { location.href = '../#beat=' + encodeURIComponent(result.original); }}>Turn it into a beat ♫</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {panel('The useful version', result.better, 'better', 'var(--ink)')}
        {panel('The painfully LinkedIn version', result.worse, 'worse', 'var(--blue)')}
      </div>
    </div>}
  </>;
}

// ---- app ----------------------------------------------------------------

export default function Lessons(){
  const narrow = useNarrow();
  const [screen, setScreen] = React.useState({ view: 'home' });

  const onPick = id => setScreen(byId(id).paste ? { view: 'roast' } : { view: 'interview', catId: id });
  const home = () => setScreen({ view: 'home' });

  return <Unit style={narrow ? { padding: '20px 14px' } : undefined}>
    <Masthead logo="LinkedIn Lessons" mark="™"
      meta={narrow ? ['Form LL-7', 'Rev. 2026-08'] : ['Form LL-7', 'Rev. 2026-08', 'Guided thought leadership']}/>
    {screen.view === 'home' && <Home narrow={narrow} onPick={onPick}/>}
    {screen.view === 'interview' && <Interview cat={byId(screen.catId)} narrow={narrow} onHome={home} initial={screen.answers}
      onDone={answers => setScreen({ view: 'result', catId: screen.catId, answers })}/>}
    {screen.view === 'result' && <Result catId={screen.catId} answers={screen.answers} narrow={narrow} onHome={home}
      onReinterview={() => setScreen({ view: 'interview', catId: screen.catId, answers: screen.answers })}/>}
    {screen.view === 'roast' && <Roast narrow={narrow} onHome={home}/>}
    <div style={{ marginTop: 30, borderTop: 'var(--rule-heavy) solid var(--ink)', paddingTop: 10,
      display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', ...META }}>
      <span>LinkedIn Lessons™ is not affiliated with your network.</span>
      <a href="../" style={{ color: 'var(--blue)' }}>Turn any post into a beat at Circle Back® →</a>
    </div>
  </Unit>;
}
