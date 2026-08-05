import React from 'react';
import { Button } from '../components/controls/Button.jsx';
import { Unit } from '../components/chassis/Unit.jsx';
import { Masthead } from '../components/chassis/Masthead.jsx';
import { EXHIBITS } from './exhibits.js';
import { TIMELINE } from './timeline.js';
import { redact } from './redactor.js';
import { scorePost } from '../lessons/score.js';

// THE MUSEUM OF PROFESSIONAL COMMUNICATION
// The permanent collection (curated, synthetic, redacted), the Redaction
// Office (anonymize your own submission), and the Historical Archive.

const LABEL = { fontSize: 'var(--label-size)', fontWeight: 700, letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase' };
const META = { ...LABEL, color: 'var(--text-meta)' };

const SUBMIT_URL = 'https://github.com/aphelps099/linkedin/issues/new';

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

// render text with [REDACTED …] placeholders set in the house blue
function Redacted({ text, size = 13.5 }){
  const paras = text.split(/\n{2,}/);
  return <>{paras.map((p, i) =>
    <p key={i} style={{ margin: i ? '10px 0 0' : 0, fontSize: size, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
      {p.split(/(\[[A-Z@][A-Z0-9 @''&.-]*\])/g).map((seg, j) =>
        /^\[[A-Z@]/.test(seg)
          ? <span key={j} style={{ background: 'var(--blue)', color: '#fff', padding: '0 4px', fontSize: size - 2.5,
              fontWeight: 700, letterSpacing: '.04em' }}>{seg}</span>
          : seg)}
    </p>)}</>;
}

function SectionRule({ no, title }){
  return <div style={{ marginTop: 34, borderTop: 'var(--rule-section) solid var(--ink)', paddingTop: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--blue)' }}>{title}</span>
    <span style={META}>Wing {no}</span>
  </div>;
}

function Exhibit({ e, narrow }){
  const s = React.useMemo(() => scorePost(e.body), [e.body]);
  const toRoast = () => { location.href = '../roast/#roast=' + encodeURIComponent(e.body); };
  const toBeat = () => { location.href = '../#beat=' + encodeURIComponent(e.body); };
  return <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--ink)', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hair)', display: 'flex',
      justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>{e.title}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-meta)', letterSpacing: '.08em' }}>
        EXHIBIT {e.no} · {e.date.toUpperCase()}</span>
    </div>
    <div style={{ padding: '14px 16px', background: 'var(--paper)', flex: 1 }}>
      <Redacted text={e.body}/>
    </div>
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, lineHeight: 1.55, fontStyle: 'italic', color: 'var(--text-meta)' }}>{e.plaque}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ color: 'var(--blue)', fontWeight: 700 }}>“{e.quote.text}”</span>
        <span style={{ color: 'var(--text-meta)' }}> — {e.quote.by}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-meta)' }}>
          {e.medium} · index <b style={{ color: 'var(--blue)' }}>{s.index}</b></span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
          <Button onClick={toRoast} style={{ padding: '6px 10px' }}>Roast it</Button>
          <Button onClick={toBeat} style={{ padding: '6px 10px' }}>Play it ♫</Button>
        </span>
      </div>
    </div>
  </div>;
}

function RedactionOffice({ narrow }){
  const [draft, setDraft] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const result = React.useMemo(() => draft.trim() ? redact(draft) : null, [draft]);

  const submitHref = result
    ? `${SUBMIT_URL}?title=${encodeURIComponent('Museum submission')}&body=${encodeURIComponent(
        'A redacted document for the curator’s consideration:\n\n' + result.text +
        '\n\n---\nSubmitted via the Redaction Office. I confirm the redacted version above is the only version I am submitting.')}`
    : SUBMIT_URL;

  return <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'start' }}>
    <div style={{ background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={META}>Step 1 — Paste the evidence</span>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={narrow ? 7 : 10}
        placeholder="Paste the post here. A colleague's. A stranger's. Yours — the museum does not judge. (It judges.)"
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 12, fontFamily: 'var(--sans)', fontSize: 13.5,
          lineHeight: 1.5, border: 'var(--rule-frame) solid var(--ink)', borderRadius: 0, background: 'var(--paper)', outline: 'none' }}/>
      <span style={{ ...META, fontSize: 8.5 }}>
        Names, companies, handles, links and impressive numbers are removed automatically, in your browser.
      </span>
    </div>
    <div style={{ background: '#fff', border: `var(--rule-frame) solid ${result ? 'var(--blue)' : 'var(--ink)'}`, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ ...META, color: result ? 'var(--blue)' : 'var(--text-meta)' }}>Step 2 — The redacted document</span>
        {result && <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-meta)' }}>
          {result.redactions} redaction{result.redactions === 1 ? '' : 's'} performed</span>}
      </div>
      {result
        ? <div style={{ background: 'var(--paper)', padding: 12 }}><Redacted text={result.text}/></div>
        : <div style={{ fontSize: 12.5, color: 'var(--text-meta)', lineHeight: 1.5 }}>
            The anonymized version appears here before anything is submitted. What you see is exactly what the curator receives.</div>}
      {result && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={async () => { await copyText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
          {copied ? 'Copied ✓' : 'Copy document'}</Button>
        <Button onClick={() => window.open(submitHref, '_blank', 'noopener')}>Submit to the collection →</Button>
      </div>}
      <span style={{ ...META, fontSize: 8.5 }}>
        Submissions open a review with the curator — nothing publishes automatically, and only the redacted document is sent.
      </span>
    </div>
  </div>;
}

export default function Museum(){
  const narrow = useNarrow();
  return <Unit style={narrow ? { padding: '20px 14px' } : undefined}>
    <Masthead logo="The Museum of Professional Communication" mark=""
      meta={narrow ? ['Form MM-1'] : ['Form MM-1', 'Est. 2026', 'Admission free']}/>
    <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', justifyContent: 'space-between',
      alignItems: narrow ? 'flex-start' : 'flex-end', gap: narrow ? 10 : 30, marginTop: 18 }}>
      <h1 style={{ margin: 0, fontSize: narrow ? 28 : 40, lineHeight: 1.02, letterSpacing: '-.045em', fontWeight: 700,
        color: 'var(--blue)', maxWidth: 560 }}>The permanent collection.</h1>
      <p style={{ margin: 0, fontSize: narrow ? 12.5 : 13, lineHeight: 1.45, maxWidth: 400 }}>
        Landmark posts of the professional internet, preserved exactly as the genre demands — minus everything identifying.
        {' '}<b style={{ color: 'var(--blue)' }}>Authors anonymized. Clichés immortal.</b> Every exhibit is a work of fiction in the style it commemorates.
      </p>
    </div>

    <SectionRule no="I" title="The Collection"/>
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 14, marginTop: 14 }}>
      {EXHIBITS.map(e => <Exhibit key={e.no} e={e} narrow={narrow}/>)}
    </div>

    <SectionRule no="II" title="The Redaction Office"/>
    <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, maxWidth: 640 }}>
      Found a masterpiece in the wild? The museum accepts submissions — after redaction. Identity is removed here,
      in your browser, before anything is sent anywhere. The genre goes on the wall. The person does not.
    </p>
    <RedactionOffice narrow={narrow}/>

    <SectionRule no="III" title="The Historical Archive"/>
    <div style={{ marginTop: 14, background: '#fff', border: 'var(--rule-frame) solid var(--ink)', padding: narrow ? '4px 16px' : '6px 22px' }}>
      {TIMELINE.map((t, i) =>
        <div key={i} style={{ display: 'grid', gridTemplateColumns: narrow ? '52px 1fr' : '72px 220px 1fr', gap: 12,
          padding: '12px 0', borderBottom: i < TIMELINE.length - 1 ? '1px dotted var(--hair)' : 'none', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{t.year}</span>
          {narrow
            ? <span style={{ fontSize: 13, lineHeight: 1.5 }}><b>{t.title}.</b> <span style={{ whiteSpace: 'pre-wrap' }}>{t.note}</span></span>
            : <>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{t.title}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.note}</span>
              </>}
        </div>)}
    </div>

    <div style={{ marginTop: 30, borderTop: 'var(--rule-heavy) solid var(--ink)', paddingTop: 10,
      display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', ...META }}>
      <span>The museum is not affiliated with your network. The gift shop is the tools.</span>
      <span style={{ display: 'inline-flex', gap: 16, flexWrap: 'wrap' }}>
        <a href="../lessons/" style={{ color: 'var(--blue)' }}>Write one — Lessons™</a>
        <a href="../roast/" style={{ color: 'var(--blue)' }}>Judge one — Roast™</a>
        <a href="../" style={{ color: 'var(--blue)' }}>Perform one — Circle Back®</a>
      </span>
    </div>
  </Unit>;
}
