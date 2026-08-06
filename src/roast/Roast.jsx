import React from 'react';
import { Button } from '../components/controls/Button.jsx';
import { Unit } from '../components/chassis/Unit.jsx';
import { Masthead } from '../components/chassis/Masthead.jsx';
import { KINDS, roastIt } from './roastEngine.js';
import { PERSONAS, INTENSITIES } from './personas.js';
import { drawRoastCard, downloadCanvas } from './card.js';
import { newSeed } from '../lessons/generator.js';
import { MarkedDocument } from './MarkedDocument.jsx';
import './roast.css';

const PERSONA_ROBOTS = ['[::] / STRATEGY', '[--] / TALENT', '[^^] / INTERN', '[01] / SYSTEM'];
const PHASE_LABELS = {
  intake: 'Intake',
  persona: 'Inspector assignment',
  intensity: 'Severity authorization',
  inspecting: 'Automated inspection',
  result: 'Official findings',
};

const FINDING_META = {
  journey: ['Journey inflation', 'Routine event promoted to personal mythology'],
  humbled: ['Performative humility', 'Self-congratulation filed as modesty'],
  sink: ['Engagement direction', 'Reader instructed to experience significance'],
  hashtags: ['Hashtag load', 'Distribution apparatus exceeds editorial need'],
  rockets: ['Visual propulsion', 'Unverified momentum iconography'],
  oneliners: ['Broetry formatting', 'Sentence fragmentation for ceremonial weight'],
  notx: ['Binary revelation', 'Contrast template used as manufactured insight'],
  longpost: ['Document expansion', 'Feed allocation exceeds operational guidance'],
  bait: ['Engagement bait', 'Interaction requested before value is established'],
  gratbrag: ['Performative gratitude', 'Achievement concealed inside appreciation'],
  aitells: ['AI language probability', 'Synthetic prose marker located'],
  grindset: ['Grindset language', 'Personal depletion presented as operating model'],
  buzz: ['Corporate vocabulary', 'Management language density exceeds tolerance'],
  pipes: ['Title architecture', 'Role stack separated by load-bearing punctuation'],
  helping: ['Outcome abstraction', 'Claim lacks a measurable object'],
  inflation: ['Title inflation', 'Seniority unsupported by recognized jurisdiction'],
  exflex: ['Institutional residue', 'Former employer retained as present credential'],
  topvoice: ['Platform decoration', 'Algorithmic badge entered as professional title'],
  hemoji: ['Symbol load', 'Decorative glyphs exceed semantic requirements'],
  hlong: ['Headline expansion', 'Identity statement exceeds display allocation'],
  speakerauthor: ['Role accumulation', 'Multiple side quests entered as one occupation'],
  thirdperson: ['Narrative distance', 'Biography appears to have hired a publicist'],
  passionate: ['Unverified enthusiasm', 'Emotional claim lacks supporting evidence'],
  resultsdriven: ['Results claim', 'Performance asserted without a result'],
  along: ['Biography expansion', 'About section exceeds inspection threshold'],
  manyhats: ['Staffing disclosure', 'Under-resourcing presented as versatility'],
};

const EVIDENCE_PATTERNS = {
  journey: /\bjourney\b/i,
  humbled: /\bhumbled\b/i,
  sink: /let that sink in|read that again/i,
  hashtags: /#\w+/,
  rockets: /🚀/u,
  notx: /it'?s not[^.!?\n]{2,70}it'?s (?:about )?/i,
  bait: /\b(?:agree|thoughts)\?/i,
  gratbrag: /\b(?:grateful|gratitude|thankful|proud|excited|thrilled)\b/i,
  aitells: /\b(?:delve|tapestry|testament)\b/i,
  grindset: /\b(?:5 ?a\.?m\.?|rise and grind|hustle|no days off)\b/i,
  buzz: /\b(?:synerg\w*|leverag\w*|pivot\w*|bandwidth|alignment|scalable|ecosystem|empower\w*|disrupt\w*|game-?chang\w*|cross-functional|best-in-class)\b/i,
  pipes: /[|·•]/,
  helping: /\bhelping\b.{3,60}\b(?:grow|scale|win|thrive|succeed|transform|tell)\w*/i,
  inflation: /\b(?:visionary|guru|ninja|rockstar|wizard|evangelist|thought leader|dreamer|disruptor|growth hacker)\b/i,
  exflex: /\bex-[A-Z][\w-]*/,
  topvoice: /top voice/i,
  hemoji: /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u,
  speakerauthor: /\b(?:speaker|author|investor|advisor|coach|podcast host)\b/i,
  passionate: /passionate about/i,
  resultsdriven: /results-driven|proven track record/i,
  manyhats: /wear(?:ing)? many hats/i,
};

function signalState(value) {
  if (value >= 75) return 'Critical';
  if (value >= 50) return 'Elevated';
  if (value >= 25) return 'Observed';
  return 'Nominal';
}

function buildSignals(score, findings) {
  const markerCounts = Object.fromEntries(score.markers.map(marker => [marker.label, marker.count]));
  const has = key => findings.some(finding => finding.key === key);
  return [
    {
      label: 'Performative gratitude',
      value: Math.min(100, score.gratitude * 24 + (has('gratbrag') ? 28 : 0)),
    },
    {
      label: 'Corporate vocabulary',
      value: Math.min(100, Math.round(score.buzzDensity * 14 + (has('buzz') ? 24 : 0))),
    },
    {
      label: 'Engagement bait',
      value: Math.min(100, (has('bait') ? 72 : 0) + (has('sink') ? 24 : 0)),
    },
    {
      label: 'AI language probability',
      value: Math.min(100, (markerCounts['AI tells'] || 0) * 44),
    },
    {
      label: 'Journey inflation',
      value: Math.min(100, score.journeys * 32 + (has('notx') ? 18 : 0)),
    },
    {
      label: 'Hashtag load',
      value: Math.min(100, (markerCounts.Hashtags || 0) * 13),
    },
  ].map(signal => ({ ...signal, state: signalState(signal.value) }));
}

function evidenceText(text, finding) {
  const pattern = EVIDENCE_PATTERNS[finding.key];
  const match = pattern?.exec(text);
  if (match?.[0]) return match[0].replace(/\s+/g, ' ').trim();
  if (finding.key === 'oneliners') return `${finding.facts.n} ceremonial one-line paragraphs`;
  if (['longpost', 'along'].includes(finding.key)) return `${finding.facts.n} words submitted`;
  if (finding.key === 'hlong') return `${finding.facts.n} headline characters`;
  return 'Document-level pattern';
}

function AnimatedScore({ value }) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return undefined;
    }
    let frame;
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / 900);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display}</span>;
}

function DiagnosticRecord({ result }) {
  const signals = buildSignals(result.score, result.findings);
  return (
    <section className="rm-diagnostic" aria-labelledby="diagnostic-title" data-testid="panel-diagnostic">
      <header className="rm-diagnostic__header">
        <div>
          <div className="rm-diagnostic__kicker">Thought Leadership Index</div>
          <h2 id="diagnostic-title">Document analysis · Form TLI-100</h2>
        </div>
        <div className="rm-diagnostic__status">
          <span className="rm-status-light" aria-hidden="true" />
          Classification issued
        </div>
      </header>

      <div className="rm-diagnostic__reading">
        <div className="rm-primary-reading">
          <div className="rm-score" data-testid="text-index-score">
            <AnimatedScore value={result.score.index} />
            <span>/100</span>
          </div>
          <div className="rm-rank">{result.score.rank}</div>
          <div className="rm-confidence">Confidence: high · Indicators: {result.findings.length}</div>
        </div>
        <div className="rm-classification-stamp">
          <span>Classification issued</span>
          <strong>{result.score.rank}</strong>
        </div>
      </div>

      <div className="rm-index-scale" aria-label={`Thought Leadership Index score ${result.score.index} out of 100`}>
        <div className="rm-index-scale__labels" aria-hidden="true">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
        <div className="rm-index-scale__track">
          <span className="rm-index-scale__cursor" style={{ '--rm-score': result.score.index }} />
        </div>
        <div className="rm-index-scale__caption">
          <span>Refreshingly human</span>
          <span>Please log off</span>
        </div>
      </div>

      <div className="rm-signals" data-testid="list-diagnostic-signals">
        {signals.map((signal, index) => (
          <div className="rm-signal" key={signal.label} style={{ '--rm-order': index }}>
            <div className="rm-signal__meta">
              <span>{signal.label}</span>
              <span>{String(signal.value).padStart(2, '0')} / {signal.state}</span>
            </div>
            <div className="rm-signal__track" aria-label={`${signal.label}: ${signal.value}, ${signal.state}`}>
              <span style={{ '--rm-signal': signal.value }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidenceRegister({ draft, findings, activeFinding, onSelect }) {
  return (
    <aside className="rm-evidence" aria-labelledby="evidence-title">
      <header className="rm-evidence__header">
        <div>
          <span className="rm-result-label">Evidence register</span>
          <h2 id="evidence-title">{findings.length || 'No'} indicators filed</h2>
        </div>
        <span>RM-1/A</span>
      </header>
      {findings.length ? (
        <div className="rm-evidence__list">
          {findings.map((finding, index) => {
            const meta = FINDING_META[finding.key] || ['Unclassified indicator', 'Manual review required'];
            return (
              <button
                aria-current={activeFinding === index ? 'true' : undefined}
                className={`rm-evidence-row ${activeFinding === index ? 'is-active' : ''}`}
                data-testid={`button-evidence-${index}`}
                key={`${finding.key}-${index}`}
                onClick={() => onSelect(index)}
                type="button"
              >
                <span className="rm-evidence-row__number">Flag {String(index + 1).padStart(2, '0')}</span>
                <strong>“{evidenceText(draft, finding)}”</strong>
                <span>{meta[0]} · {meta[1]}</span>
                <span className="rm-evidence-row__weight">Weight +{finding.w}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rm-evidence__clean">
          No reportable indicators. Human authorship remains plausible.
        </div>
      )}
    </aside>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(textarea); }
  }
}

function ChoiceStage({ eyebrow, title, options, onChoose, onBack, type }) {
  return (
    <>
      <div className="rm-stage__body">
        <div className="rm-stage__eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <div className="rm-choice-grid">
          {options.map((option, index) => (
            <button
              className="rm-choice"
              data-testid={`button-${type}-${option.id ?? option.n}`}
              key={option.id ?? option.n}
              onClick={() => onChoose(option)}
              type="button"
            >
              <span className="rm-choice__key">{index + 1}</span>
              <span className="rm-choice__robot">
                {type === 'persona' ? PERSONA_ROBOTS[index] : `LEVEL / 0${option.n}`}
              </span>
              <span className="rm-choice__name">{option.name}</span>
              <span className="rm-choice__detail">{option.tagline ?? option.blurb}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="rm-case-strip">
        <button data-testid="button-back" onClick={onBack} type="button">Esc / Back</button>
        <span>Press 1–4 to authorize without further meetings.</span>
      </div>
    </>
  );
}

function SeverityStage({ value, onChange, onAuthorize, onBack }) {
  const selected = INTENSITIES[value - 1];
  return (
    <>
      <div className="rm-stage__body">
        <div className="rm-stage__eyebrow">Step 03 / Severity authorization</div>
        <h2>How much honesty has Legal approved?</h2>
        <div className="rm-severity">
          <div className="rm-severity__readout" aria-live="polite">
            <span className="rm-severity__level">Level / 0{selected.n}</span>
            <strong>{selected.name}</strong>
            <span>{selected.blurb}</span>
          </div>
          <div className="rm-severity__control">
            <input
              aria-label="Roast severity"
              aria-valuetext={`${selected.name}. ${selected.blurb}`}
              className="rm-severity__range"
              data-testid="slider-intensity"
              max="4"
              min="1"
              onChange={event => onChange(Number(event.target.value))}
              step="1"
              style={{ '--rm-level': value }}
              type="range"
              value={value}
            />
            <div className="rm-severity__ticks" aria-hidden="true">
              {INTENSITIES.map(option => (
                <span className={option.n <= value ? 'is-active' : ''} key={option.n}>
                  0{option.n}
                </span>
              ))}
            </div>
          </div>
          <Button
            data-testid="button-authorize-intensity"
            onClick={() => onAuthorize(selected)}
            style={{ minHeight: 48, alignSelf: 'stretch' }}
          >
            Authorize level 0{selected.n} / Begin inspection
          </Button>
        </div>
      </div>
      <div className="rm-case-strip">
        <button data-testid="button-back" onClick={onBack} type="button">Esc / Back</button>
        <span>Drag to adjust · arrow keys fine-tune · 1–4 authorize immediately.</span>
      </div>
    </>
  );
}

function InspectionStage({ draft, result, persona, revealed, onCancel, onSkip }) {
  const total = Math.max(1, result.findings.length);
  return (
    <>
      <div className="rm-stage__body">
        <div className="rm-inspection">
          <MarkedDocument
            findings={result.findings}
            scanning
            text={draft}
            visibleCount={revealed}
          />
          <aside className="rm-notes" aria-live="polite" data-testid="status-inspection">
            <div className="rm-robot-status">
              <span>{PERSONA_ROBOTS[PERSONAS.indexOf(persona)]} online</span>
              <span className="rm-robot-status__light" aria-hidden="true" />
            </div>
            {result.clean && revealed > 0 && (
              <div className="rm-note">
                <strong>00 / ANOMALY</strong><br />
                No violations located. Human authorship remains plausible.
              </div>
            )}
            {result.lines.slice(0, revealed).map((line, index) => (
              <div className="rm-note" key={index}>
                <strong>{String(index + 1).padStart(2, '0')} / FINDING</strong><br />
                {line}
              </div>
            ))}
            <div className="rm-progress">
              Evidence filed: {Math.min(revealed, total)} / {total}<br />
              Verdict withheld pending completion.
            </div>
          </aside>
        </div>
      </div>
      <div className="rm-case-strip">
        <button data-testid="button-cancel-inspection" onClick={onCancel} type="button">Esc / Cancel inspection</button>
        <span>Marks first. Score second. Policy is policy.</span>
        <button data-testid="button-skip-inspection" onClick={onSkip} type="button">Skip analysis / Issue classification</button>
      </div>
    </>
  );
}

export default function Roast() {
  const [kind, setKind] = React.useState('post');
  const [draft, setDraft] = React.useState('');
  const [personaId, setPersonaId] = React.useState('recruiter');
  const [intensity, setIntensity] = React.useState(2);
  const [seed, setSeed] = React.useState(newSeed);
  const [phase, setPhase] = React.useState('intake');
  const [revealed, setRevealed] = React.useState(0);
  const [activeFinding, setActiveFinding] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const cardRef = React.useRef(null);

  const kindDef = KINDS.find(item => item.id === kind);
  const persona = PERSONAS.find(item => item.id === personaId);
  const level = INTENSITIES[intensity - 1];
  const result = React.useMemo(
    () => draft.trim() ? roastIt({ kind, text: draft, personaId, intensity, seed }) : null,
    [draft, kind, personaId, intensity, seed],
  );

  React.useEffect(() => {
    const match = location.hash.match(/^#roast=(.+)$/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const text = decodeURIComponent(match[1]);
      if (text.trim()) {
        setKind('post');
        setDraft(text);
        setPhase('persona');
      }
    } catch {
      // A malformed museum handoff is ignored; the intake remains usable.
    }
  }, []);

  React.useEffect(() => {
    if (phase !== 'inspecting' || !result) return undefined;
    const total = Math.max(1, result.findings.length);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRevealed(0);
    setActiveFinding(null);

    if (reduced) {
      setRevealed(total);
      const done = window.setTimeout(() => setPhase('result'), 40);
      return () => window.clearTimeout(done);
    }

    let count = 0;
    let finish;
    const ticker = window.setInterval(() => {
      count += 1;
      setRevealed(Math.min(count, total));
      if (count >= total) {
        window.clearInterval(ticker);
        finish = window.setTimeout(() => setPhase('result'), 720);
      }
    }, 560);

    return () => {
      window.clearInterval(ticker);
      if (finish) window.clearTimeout(finish);
    };
  }, [phase, result]);

  React.useEffect(() => {
    if (phase === 'result' && result && cardRef.current) {
      drawRoastCard(cardRef.current, {
        personaName: persona.name,
        intensityName: level.name,
        score: result.score,
        lines: result.lines,
      });
    }
  }, [phase, result, persona, level]);

  React.useEffect(() => {
    const onKeyDown = event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'Escape') {
        if (phase === 'persona') setPhase('intake');
        if (phase === 'intensity') setPhase('persona');
        if (phase === 'inspecting' || phase === 'result') setPhase('intensity');
        return;
      }
      const index = Number(event.key) - 1;
      if (index < 0 || index > 3) return;
      if (phase === 'persona') {
        const chosen = PERSONAS[index];
        if (chosen) {
          setPersonaId(chosen.id);
          setPhase('intensity');
        }
      } else if (phase === 'intensity') {
        const chosen = INTENSITIES[index];
        if (chosen) {
          setIntensity(chosen.n);
          setSeed(newSeed());
          setPhase('inspecting');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase]);

  const begin = () => {
    if (draft.trim()) setPhase('persona');
  };

  const chooseIntensity = chosen => {
    setIntensity(chosen.n);
    setSeed(newSeed());
    setPhase('inspecting');
  };

  const copy = async text => {
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const restart = () => {
    setDraft('');
    setPhase('intake');
    setRevealed(0);
    setActiveFinding(null);
  };

  const selectEvidence = index => {
    setActiveFinding(index);
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-finding="${index}"]`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  };

  return (
    <Unit>
      <main className="rm-app" id="main">
        <Masthead
          logo="Roast My LinkedIn"
          mark="™"
          meta={['Form RM-1', 'Rev. 2026-08']}
        />

        <section className="rm-hero" aria-labelledby="roast-title">
          <h1 id="roast-title">Present your personal brand for inspection.</h1>
          <p>
            Submit a post, headline, or About section. An assigned inspector will mark the evidence,
            issue a score, and return the version you should actually use.{' '}
            <span className="rm-privacy">Nothing leaves your browser.</span>
          </p>
        </section>

        {phase !== 'result' && (
          <section className="rm-stage" aria-label={PHASE_LABELS[phase]}>
            <header className="rm-stage__bar">
              <span>RM-1 / {PHASE_LABELS[phase]}</span>
              <span>Case status: {phase === 'inspecting' ? 'under review' : 'action required'}</span>
            </header>

            {phase === 'intake' && (
              <div className="rm-stage__body">
                <div className="rm-stage__eyebrow">Step 01 / Material intake</div>
                <h2>What are we documenting today?</h2>
                <fieldset className="rm-fieldset">
                  <legend>Material type</legend>
                  <div className="rm-kind-grid">
                    {KINDS.map(item => (
                      <button
                        className={`rm-kind ${kind === item.id ? 'is-selected' : ''}`}
                        data-testid={`button-kind-${item.id}`}
                        key={item.id}
                        onClick={() => setKind(item.id)}
                        type="button"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="rm-label" htmlFor="roast-draft">Material for inspection</label>
                {kind === 'headline' ? (
                  <input
                    className="rm-input"
                    data-testid="input-roast-draft"
                    id="roast-draft"
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && draft.trim()) begin();
                    }}
                    placeholder={kindDef.hint}
                    value={draft}
                  />
                ) : (
                  <textarea
                    className="rm-input"
                    data-testid="input-roast-draft"
                    id="roast-draft"
                    onChange={event => setDraft(event.target.value)}
                    placeholder={kindDef.hint}
                    rows={7}
                    value={draft}
                  />
                )}
                <div className="rm-intake__footer">
                  <Button
                    data-testid="button-file-complaint"
                    disabled={!draft.trim()}
                    onClick={begin}
                    style={{ opacity: draft.trim() ? 1 : .45, minHeight: 44 }}
                  >
                    File the complaint
                  </Button>
                  <span className="rm-fineprint">Retention policy: zero seconds. Transmission policy: absolutely not.</span>
                </div>
              </div>
            )}

            {phase === 'persona' && (
              <ChoiceStage
                eyebrow="Step 02 / Inspector assignment"
                onBack={() => setPhase('intake')}
                onChoose={chosen => {
                  setPersonaId(chosen.id);
                  setPhase('intensity');
                }}
                options={PERSONAS}
                title="Who should review the incident?"
                type="persona"
              />
            )}

            {phase === 'intensity' && (
              <SeverityStage
                value={intensity}
                onChange={setIntensity}
                onBack={() => setPhase('persona')}
                onAuthorize={chooseIntensity}
              />
            )}

            {phase === 'inspecting' && result && (
              <InspectionStage
                draft={draft}
                onCancel={() => setPhase('intensity')}
                onSkip={() => {
                  setRevealed(result.findings.length);
                  setPhase('result');
                }}
                persona={persona}
                result={result}
                revealed={revealed}
              />
            )}
          </section>
        )}

        {phase === 'result' && result && (
          <section className="rm-result" aria-label="Official inspection findings">
            <DiagnosticRecord result={result} />

            <div className="rm-evidence-layout">
              <div className="rm-result__main">
                <MarkedDocument
                  activeFinding={activeFinding}
                  findings={result.findings}
                  text={draft}
                  visibleCount={result.findings.length}
                />
              </div>
              <EvidenceRegister
                activeFinding={activeFinding}
                draft={draft}
                findings={result.findings}
                onSelect={selectEvidence}
              />
            </div>

            <div className="rm-outcome-grid">
              <div className="rm-verdict" data-testid="status-verdict">
                <div className="rm-verdict__top">
                  <span className="rm-result-label">Inspector memorandum / {persona.name}</span>
                  <div className="rm-stamp">Inspected<br />with concerns</div>
                </div>
                <div className="rm-verdict__copy">
                  <p className="rm-verdict__opener">{result.opener}</p>
                  <ol className="rm-verdict__findings">
                    {result.lines.map((line, index) => <li key={index}>{line}</li>)}
                  </ol>
                  <p className="rm-verdict__closer">{result.closer}</p>
                </div>
              </div>

              <div className="rm-rewrite">
                <div className="rm-rewrite__header">
                  <span className="rm-result-label">
                    {kind === 'headline' ? 'The headline you should actually use' : 'The version you should actually post'}
                  </span>
                  <Button data-testid="button-copy-rewrite" onClick={() => copy(result.useful)}>
                    {copied ? 'Copied' : 'Copy clean version'}
                  </Button>
                </div>
                <div className="rm-rewrite__text" data-testid="text-clean-rewrite">{result.useful}</div>
              </div>
            </div>

            <div className="rm-result-actions rm-result-actions--primary">
              <Button data-testid="button-new-inspection" onClick={restart}>Inspect another</Button>
              {kind === 'post' && (
                <Button
                  data-testid="button-turn-into-beat"
                  onClick={() => { location.href = `../#beat=${encodeURIComponent(draft)}`; }}
                >
                  Remix the evidence
                </Button>
              )}
            </div>

            <div className="rm-share">
              <div className="rm-share__header">
                <div>
                  <span className="rm-result-label">Roast receipt</span>
                  <h2>1080 × 1080 share object</h2>
                </div>
                <div className="rm-result-actions">
                  <Button
                    data-testid="button-download-card"
                    onClick={() => downloadCanvas(cardRef.current, 'roast-card.png')}
                  >
                    Download receipt
                  </Button>
                  <Button
                    data-testid="button-reroast"
                    onClick={() => {
                      setSeed(newSeed());
                      setPhase('inspecting');
                    }}
                  >
                    Re-inspect
                  </Button>
                </div>
              </div>
              <canvas ref={cardRef} data-testid="canvas-roast-card" />
            </div>
          </section>
        )}

        <footer className="rm-footer">
          <span>© Digital Creative 2026 · Approved — HR / Not affiliated with your network.</span>
          <nav aria-label="More Circle Back tools">
            <a href="../lessons/">Write one</a>
            <a href="../museum/">Visit the Museum</a>
            <a href="../">Make a beat</a>
          </nav>
        </footer>
      </main>
    </Unit>
  );
}
