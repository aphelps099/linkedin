import React from 'react';
import { Button } from '../components/controls/Button.jsx';
import { Masthead } from '../components/chassis/Masthead.jsx';
import { EXHIBITS } from './exhibits.js';
import { TIMELINE } from './timeline.js';
import { redact } from './redactor.js';
import { GalleryRoom } from './GalleryRoom.jsx';
import { RedactedText } from './RedactedText.jsx';
import { ROOMS, exhibitsForRoom } from './rooms.js';

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

function SectionRule({ no, title }){
  return <div style={{ marginTop: 34, borderTop: 'var(--rule-section) solid var(--ink)', paddingTop: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--blue)' }}>{title}</span>
    <span style={META}>Wing {no}</span>
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
        ? <div style={{ background: 'var(--paper)', padding: 12 }}><RedactedText text={result.text}/></div>
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
  const room = ROOMS[0];
  const roomExhibits = React.useMemo(() => exhibitsForRoom(room, EXHIBITS), [room]);
  return <div className="museum-shell">
    <Masthead logo="The Museum of Professional Communication" mark=""
      meta={narrow ? ['Form MM-1'] : ['Form MM-1', 'Est. 2026', 'Admission free']}/>
    <div className="museum-intro">
      <h1>The permanent collection.</h1>
      <p>
        Landmark posts of the professional internet, preserved exactly as the genre demands — minus everything identifying.
        {' '}<b style={{ color: 'var(--blue)' }}>Authors anonymized. Clichés immortal.</b> Every exhibit is a work of fiction in the style it commemorates.
      </p>
    </div>

    <GalleryRoom room={room} exhibits={roomExhibits} narrow={narrow}/>

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
  </div>;
}
