import React from 'react';
import { Button } from '../components/controls/Button.jsx';
import { Unit } from '../components/chassis/Unit.jsx';
import { Masthead } from '../components/chassis/Masthead.jsx';
import { KINDS, roastIt } from './roastEngine.js';
import { PERSONAS, INTENSITIES } from './personas.js';
import { drawRoastCard, downloadCanvas } from './card.js';
import { newSeed } from '../lessons/generator.js';

// ROAST MY LINKEDIN — paste your post, headline, or About section.
// Four personas × four intensities. Every roast ends in redemption.

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

function Segmented({ label, options, value, onChange, render }){
  return <div>
    <div style={{ ...LABEL, marginBottom: 8 }}>{label}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const on = o.id === value || o.n === value;
        return <button key={o.id || o.n} onClick={() => onChange(o.id ?? o.n)}
          style={{ border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, cursor: 'pointer', padding: '9px 12px',
            background: on ? 'var(--blue)' : '#fff', color: on ? '#fff' : 'var(--ink)',
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, transition: 'background var(--ease-ui)' }}>
          {render ? render(o) : o.name}
        </button>;
      })}
    </div>
  </div>;
}

export default function Roast(){
  const narrow = useNarrow();
  const [kind, setKind] = React.useState('post');
  const [draft, setDraft] = React.useState('');
  const [personaId, setPersonaId] = React.useState('recruiter');
  const [intensity, setIntensity] = React.useState(2);
  const [seed, setSeed] = React.useState(newSeed);
  const [filed, setFiled] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const cardRef = React.useRef(null);

  const kindDef = KINDS.find(k => k.id === kind);
  const persona = PERSONAS.find(p => p.id === personaId);
  const level = INTENSITIES[intensity - 1];

  // recomputes live once filed — switching persona or intensity re-roasts
  const result = React.useMemo(
    () => (filed && draft.trim()) ? roastIt({ kind, text: draft, personaId, intensity, seed }) : null,
    [filed, draft, kind, personaId, intensity, seed]);

  React.useEffect(() => {
    if(result && cardRef.current)
      drawRoastCard(cardRef.current, { personaName: persona.name, intensityName: level.name, score: result.score, lines: result.lines });
  }, [result, persona, level]);

  const copy = async t => { await copyText(t); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return <Unit style={narrow ? { padding: '20px 14px' } : undefined}>
    <Masthead logo="Roast My LinkedIn" mark="™"
      meta={narrow ? ['Form RM-1', 'Rev. 2026-08'] : ['Form RM-1', 'Rev. 2026-08', 'Complaints processed locally']}/>
    <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', justifyContent: 'space-between',
      alignItems: narrow ? 'flex-start' : 'flex-end', gap: narrow ? 10 : 30, marginTop: 18 }}>
      <h1 style={{ margin: 0, fontSize: narrow ? 28 : 40, lineHeight: 1.02, letterSpacing: '-.045em', fontWeight: 700,
        color: 'var(--blue)', maxWidth: 520 }}>Present your personal brand for inspection.</h1>
      <p style={{ margin: 0, fontSize: narrow ? 12.5 : 13, lineHeight: 1.45, maxWidth: 380 }}>
        Four inspectors. Four intensity settings. Every roast ends with the version you should actually use.
        {' '}<b style={{ color: 'var(--blue)' }}>Nothing leaves your browser.</b>
      </p>
    </div>

    <div style={{ marginTop: 20, background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: narrow ? 16 : 22,
      display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmented label="What are we inspecting?" options={KINDS} value={kind}
        onChange={id => { setKind(id); setFiled(false); }}/>
      {kind === 'headline'
        ? <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={kindDef.hint}
            onKeyDown={e => { if(e.key === 'Enter' && draft.trim()) setFiled(true); }}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, fontFamily: 'var(--sans)', fontSize: 15,
              border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, background: 'var(--paper)', outline: 'none' }}/>
        : <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={narrow ? 6 : 8} placeholder={kindDef.hint}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 12, fontFamily: 'var(--sans)', fontSize: 14,
              lineHeight: 1.5, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, background: 'var(--paper)', outline: 'none' }}/>}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 14 }}>
        <Segmented label="Who's inspecting?" options={PERSONAS} value={personaId} onChange={setPersonaId}/>
        <Segmented label="Roast intensity" options={INTENSITIES} value={intensity} onChange={setIntensity}
          render={o => `${o.n} · ${o.name}`}/>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Button onClick={() => { if(draft.trim()){ setSeed(newSeed()); setFiled(true); } }} style={{ padding: '12px 18px' }}>
          File the complaint</Button>
        <span style={{ ...META, fontSize: 8.5 }}>{persona.tagline} · {level.blurb}</span>
      </div>
    </div>

    {result && <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 400px',
      gap: narrow ? 14 : 'var(--space-col)', marginTop: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--blue)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ ...LABEL, color: 'var(--blue)' }}>The verdict of {persona.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-meta)' }}>
              index {result.score.index} · {result.score.rank}</span>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, fontStyle: 'italic', color: 'var(--text-meta)' }}>{result.opener}</div>
          <div style={{ margin: '10px 0' }}>
            {result.lines.map((l, i) =>
              <div key={i} style={{ fontSize: 14, lineHeight: 1.6, borderBottom: '1px dotted var(--hair)', padding: '6px 0', whiteSpace: 'pre-wrap' }}>
                <span style={{ color: 'var(--blue)', fontWeight: 700 }}>→ </span>{l}</div>)}
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, fontStyle: 'italic', color: 'var(--text-meta)' }}>{result.closer}</div>
        </div>
        <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={LABEL}>{kind === 'headline' ? 'The headline you should actually use' : 'The version you should actually post'}</span>
            <Button onClick={() => copy(result.useful)} style={{ padding: '6px 10px' }}>{copied ? 'Copied ✓' : 'Copy'}</Button>
          </div>
          {result.useful.split(/\n{2,}/).map((p, i) =>
            <p key={i} style={{ margin: i ? '10px 0 0' : 0, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p}</p>)}
        </div>
        {kind === 'post' && <div>
          <Button onClick={() => { location.href = '../#beat=' + encodeURIComponent(draft); }}>Turn the original into a beat ♫</Button>
        </div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...LABEL }}>The roast card — save it, post it</div>
        <canvas ref={cardRef} style={{ width: '100%', height: 'auto', border: 'var(--rule-frame) solid var(--ink)', display: 'block' }}/>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => downloadCanvas(cardRef.current, 'roast-card.png')} style={{ padding: '11px 16px' }}>Download card</Button>
          <Button onClick={() => setSeed(newSeed())}>Re-roast</Button>
        </div>
        <span style={{ ...META, fontSize: 8.5 }}>1080×1080 — sized for the feed that caused this.</span>
      </div>
    </div>}

    <div style={{ marginTop: 30, borderTop: 'var(--rule-heavy) solid var(--ink)', paddingTop: 10,
      display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', ...META }}>
      <span>Roast My LinkedIn™ is not affiliated with your network.</span>
      <span style={{ display: 'inline-flex', gap: 16, flexWrap: 'wrap' }}>
        <a href="../lessons/" style={{ color: 'var(--blue)' }}>Write a post — LinkedIn Lessons™</a>
        <a href="../" style={{ color: 'var(--blue)' }}>Turn one into a beat — Circle Back®</a>
      </span>
    </div>
  </Unit>;
}
