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

function InspectionStage({ draft, result, persona, revealed, onCancel }) {
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
              <ChoiceStage
                eyebrow="Step 03 / Severity authorization"
                onBack={() => setPhase('persona')}
                onChoose={chooseIntensity}
                options={INTENSITIES}
                title="How much honesty has Legal approved?"
                type="intensity"
              />
            )}

            {phase === 'inspecting' && result && (
              <InspectionStage
                draft={draft}
                onCancel={() => setPhase('intensity')}
                persona={persona}
                result={result}
                revealed={revealed}
              />
            )}
          </section>
        )}

        {phase === 'result' && result && (
          <>
            <section className="rm-result" aria-label="Official inspection findings">
              <div className="rm-result__main">
                <MarkedDocument
                  findings={result.findings}
                  text={draft}
                  visibleCount={result.findings.length}
                />
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
                <div className="rm-result-actions">
                  <Button data-testid="button-new-inspection" onClick={restart}>Inspect another</Button>
                  {kind === 'post' && (
                    <Button
                      data-testid="button-turn-into-beat"
                      onClick={() => { location.href = `../#beat=${encodeURIComponent(draft)}`; }}
                    >
                      Turn the original into a beat
                    </Button>
                  )}
                </div>
              </div>

              <aside className="rm-result__rail">
                <div className="rm-verdict" data-testid="status-verdict">
                  <div className="rm-verdict__top">
                    <div>
                      <div className="rm-score" data-testid="text-index-score">{result.score.index}</div>
                      <div className="rm-rank">{result.score.rank}</div>
                    </div>
                    <div className="rm-stamp">Inspected<br />with concerns</div>
                  </div>
                  <div className="rm-verdict__copy">
                    <span className="rm-result-label">Verdict of {persona.name}</span>
                    <p>{result.opener}</p>
                    {result.lines.map((line, index) => <p key={index}><strong>{index + 1}.</strong> {line}</p>)}
                    <p>{result.closer}</p>
                  </div>
                </div>

                <div className="rm-share">
                  <span className="rm-result-label">Roast receipt / 1080 × 1080</span>
                  <canvas ref={cardRef} data-testid="canvas-roast-card" />
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
              </aside>
            </section>
          </>
        )}

        <footer className="rm-footer">
          <span>Approved — HR / Not affiliated with your network.</span>
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
