import React from 'react';
import { Button } from '../components/controls/Button.jsx';
import { byId } from './categories.js';
import { Intake, DEFAULT_ANSWERS } from './Intake.jsx';
import { Footer } from '../brand/Footer.jsx';
import { LEVELS, generate, roast, newSeed } from './generator.js';
import { scorePost } from './score.js';

// LINKEDIN LESSONS — a guided post generator disguised as satire.
// A complete corporate intake form → the LinkedInification dial.
// Level 1 writes the post you should publish; level 5 writes the one you will.

const LABEL = { fontSize: 'var(--label-size)', fontWeight: 700, letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' };
const META = { ...LABEL, color: 'var(--text-meta)' };

async function copyText(t){
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { if(!document.execCommand('copy')) throw new Error('Copy unavailable'); } finally { document.body.removeChild(ta); }
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
      <span style={{ fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 700, letterSpacing: '-.05em', lineHeight: 1, color: 'var(--blue)' }}>{s.index}</span>
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
        <button key={l.n} aria-pressed={l.n===level} aria-label={`Level ${l.n}: ${l.name}`} onClick={() => onChange(l.n)}
          style={{ height: 40, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, cursor: 'pointer',
            background: l.n === level ? 'var(--blue)' : l.n < level ? 'var(--blue-light)' : '#fff',
            color: l.n === level ? '#fff' : 'var(--ink)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15 }}>{l.n}</button>)}
    </div>
    <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>{cur.n} — {cur.name}</div>
    <div style={{ fontSize: 11.5, color: 'var(--text-meta)', lineHeight: 1.45 }}>{cur.blurb}</div>
  </div>;
}

// ---- screens ------------------------------------------------------------

function Result({ catId, answers, narrow, onHome, onReinterview, settings, setSettings }){
  const {level,seed,flags}=settings;
  const setLevel=value=>setSettings(s=>({...s,level:typeof value==='function'?value(s.level):value}));
  const setSeed=value=>setSettings(s=>({...s,seed:value}));
  const setFlags=value=>setSettings(s=>({...s,flags:typeof value==='function'?value(s.flags):value}));
  const [roastOpen, setRoastOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError,setCopyError] = React.useState(false);

  const text = React.useMemo(
    () => generate({ category: catId, answers, level, seed, flags }),
    [catId, answers, level, seed, flags]);
  const s = React.useMemo(() => scorePost(text), [text]);
  const roastLines = React.useMemo(
    () => roastOpen ? roast(text, { score: s.index }) : null, [roastOpen, text, s]);

  const copy = async () => { try{await copyText(text);setCopied(true);setCopyError(false);setTimeout(()=>setCopied(false),1600);}catch{setCopyError(true);} };
  const toBeat = () => { location.href = '../studio/#beat=' + encodeURIComponent(text); };

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
          {copyError&&<p role="status" style={{gridColumn:'1/-1',fontSize:12,margin:0}}>Copy was unavailable. Select the post text to copy it.</p>}
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

// ---- app ----------------------------------------------------------------

export default function Lessons(){
  const narrow=useNarrow();
  const [catId,setCatId]=React.useState('announce');
  const [drafts,setDrafts]=React.useState(()=>Object.fromEntries(Object.entries(DEFAULT_ANSWERS).map(([key,value])=>[key,{...value}])));
  const [submission,setSubmission]=React.useState(null);
  const [view,setView]=React.useState('form');
  const [settings,setSettings]=React.useState(()=>({level:4,seed:newSeed(),flags:{}}));
  const headingRef=React.useRef(null);
  const previousView=React.useRef(view);
  React.useEffect(()=>{if(previousView.current!==view){headingRef.current?.focus();headingRef.current?.scrollIntoView({block:'start'});previousView.current=view;}},[view]);
  const onDone=answers=>{
    if(submission?.catId!==catId)setSettings({level:4,seed:newSeed(),flags:{}});
    setSubmission({catId,answers});setView('result');
  };
  const fresh=()=>{setDrafts(d=>({...d,[catId]:{...DEFAULT_ANSWERS[catId]}}));setSubmission(null);setView('form');setSettings({level:4,seed:newSeed(),flags:{}});};
  return <div className="ll-app">
    <a className="ll-skip" href="#lessons-main">Skip to the form</a>
    <header className="ll-header"><a className="ll-brand" href="../">LINKEDIN BEATS<span>LINKEDIN LESSONS™</span></a><nav aria-label="Main navigation"><a href="../#listen">Listen</a><a href="../studio/">The studio ↗</a><a href="../roast/">Roast my post</a></nav></header>
    <main id="lessons-main" ref={headingRef} tabIndex={-1}>
      {view==='form'?<Intake key={catId} catId={catId} answers={drafts[catId]} onPick={setCatId} onChange={answers=>setDrafts(d=>({...d,[catId]:answers}))} onSubmit={onDone}/>:<div className="ll-result"><span className="ll-kicker">FILED / DEPARTMENT OF PERSONAL BRANDING</span><Result catId={submission.catId} answers={submission.answers} narrow={narrow} settings={settings} setSettings={setSettings} onHome={fresh} onReinterview={()=>setView('form')}/></div>}
    </main>
    <Footer/>
  </div>;
}
