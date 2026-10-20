import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowRight, Check, Copy, Play, RotateCcw, Sparkles} from 'lucide-react';
import {byId} from '../../lessons/categories.js';
import {EXAMPLES, ANNOUNCEMENT_EXAMPLES, DEFAULT_ANSWERS} from '../../lessons/Intake.jsx';
import {PostBeat} from '../../post-beat/PostBeat.jsx';
import {Markdown} from './markdown.jsx';
import {isInteractive, PASSIVE_DELAY} from './types.js';
import {perform, score, typewrite, levelName, seedFrom, LEVELS} from './performer.js';

// The step player. One chapter in, revealed one step at a time. Passive steps
// advance on a timer; interactive steps wait. Live outputs are performed by
// the local performer (the Lessons generator + the Thought Leadership Index)
// and typed into their card so each one still reads as a performance.

const CATEGORY_NAMES = {announce: 'Announce', lesson: 'Teach a lesson', sell: 'Sell', urgency: 'Create urgency', ai: 'Talk AI'};

function exampleFor(category, answers){
  return category === 'announce' ? (ANNOUNCEMENT_EXAMPLES[answers?.kind] || EXAMPLES.announce) : EXAMPLES[category];
}

export function StepPlayer({chapter, userName, title, onName, onComplete, onPost}){
  const steps = chapter.steps;
  const [visibleCount, setVisibleCount] = useState(0);
  const [outputs, setOutputs] = useState({});       // step id → performed text
  const [performing, setPerforming] = useState(null); // step id being typed, or null
  const [done, setDone] = useState({});             // exercise/intake/dial/spot ids that finished
  const [vals, setVals] = useState({});             // exercise blank values, keyed `${stepId}.${blankId}`
  const [answers, setAnswers] = useState({});       // intake-card id → answers
  const [categories, setCategories] = useState({}); // intake-card id → chosen category (when choose)
  const [levels, setLevels] = useState({});         // dial id → level
  const [spotted, setSpotted] = useState({});       // spot-the-trope id → Set of line indexes
  const [nameValue, setNameValue] = useState(userName || '');
  const [titleValue, setTitleValue] = useState(title || '');
  const [copiedId, setCopiedId] = useState(null);

  const scrollRef = useRef(null);
  const cancelRef = useRef(() => {});
  const advanceTimer = useRef(null);
  const seed = useMemo(() => seedFrom(chapter.id + (userName || '')), [chapter.id, userName]);

  const personalize = useCallback(t => String(t || '')
    .replace(/\{\{name\}\}/g, userName || 'there')
    .replace(/\{\{title\}\}/g, title || 'aspiring thought leader'), [userName, title]);

  // Reset on chapter change, then reveal the first step.
  useEffect(() => {
    cancelRef.current();
    clearTimeout(advanceTimer.current);
    setVisibleCount(0); setOutputs({}); setPerforming(null); setDone({}); setVals({});
    setAnswers({}); setCategories({}); setLevels({}); setSpotted({});
    const t = setTimeout(() => setVisibleCount(1), 400);
    return () => { clearTimeout(t); cancelRef.current(); clearTimeout(advanceTimer.current); };
  }, [chapter.id]);

  // Keep the newest step in view.
  useEffect(() => {
    const el = scrollRef.current; if(!el) return;
    const t = setTimeout(() => el.scrollTo({top: el.scrollHeight, behavior: 'smooth'}), 120);
    return () => clearTimeout(t);
  }, [visibleCount, outputs]);

  const advance = useCallback((n = 1) => setVisibleCount(c => Math.min(c + n, steps.length)), [steps.length]);

  // Auto-advance passive steps.
  useEffect(() => {
    if(visibleCount === 0 || visibleCount > steps.length || performing) return;
    const cur = steps[visibleCount - 1];
    if(!cur || isInteractive(cur) || visibleCount >= steps.length) return;
    const delay = cur.type === 'bot-message' ? (cur.delayMs || PASSIVE_DELAY['bot-message']) : (PASSIVE_DELAY[cur.type] ?? 500);
    advanceTimer.current = setTimeout(() => setVisibleCount(c => c + 1), delay);
    return () => clearTimeout(advanceTimer.current);
  }, [visibleCount, steps, performing]);

  // ── inputs & performances ────────────────────────────────────────────
  const stepById = useCallback(id => steps.find(s => s.id === id), [steps]);

  const answersFor = useCallback(step => {
    const category = categories[step.id] || step.category;
    const base = {...(DEFAULT_ANSWERS[category] || {}), ...exampleFor(category, answers[step.id]), ...(answers[step.id] || {})};
    return {category, answers: base};
  }, [answers, categories]);

  const filledTemplate = useCallback(step => step.template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vals[`${step.id}.${k}`];
    const blank = step.blanks.find(b => b.id === k);
    return (v ?? blank?.defaultValue ?? blank?.placeholder ?? '').trim() || blank?.placeholder || '';
  }), [vals]);

  const inputFor = useCallback(sourceId => {
    const s = stepById(sourceId);
    if(!s) return '';
    if(outputs[sourceId] !== undefined && s.type !== 'prompt-card' && s.type !== 'exercise-card') return outputs[sourceId];
    switch(s.type){
      case 'prompt-card': return personalize(s.prompt);
      case 'output-card': return s.content;
      case 'exercise-card': return outputs[sourceId] ?? filledTemplate(s);
      case 'intake-card': return answersFor(s);
      case 'dial': return inputFor(s.source);
      default: return outputs[sourceId] ?? '';
    }
  }, [stepById, outputs, personalize, filledTemplate, answersFor]);

  const run = useCallback((targetId, kind, input, {level = 3, after} = {}) => {
    cancelRef.current();
    let text;
    try{ text = perform(kind, input, {seed, level}); }
    catch(e){ text = `*${e.message}*`; }
    setPerforming(targetId);
    setOutputs(o => ({...o, [targetId]: ''}));
    cancelRef.current = typewrite(text, chunk => setOutputs(o => ({...o, [targetId]: chunk})), () => {
      setPerforming(null);
      onPost?.(targetId, text, score(text));
      after?.(text);
    });
  }, [seed, onPost]);

  // A live-output performs itself the moment it becomes the newest visible step.
  const lastLive = useRef(null);
  useEffect(() => {
    const cur = steps[visibleCount - 1];
    if(!cur || cur.type !== 'live-output' || lastLive.current === cur.id) return;
    lastLive.current = cur.id;
    run(cur.id, cur.performs || 'linkedinify', inputFor(cur.source), {level: cur.level || 3, after: () => { advanceTimer.current = setTimeout(() => advance(), 900); }});
  }, [visibleCount, steps, run, inputFor, advance]);

  const copy = useCallback((id, text) => {
    try{ navigator.clipboard?.writeText(text); }catch{ /* ignore */ }
    setCopiedId(id); setTimeout(() => setCopiedId(c => (c === id ? null : c)), 2000);
  }, []);

  const submitName = () => {
    const n = nameValue.trim(); if(!n) return;
    onName?.(n, titleValue.trim());
    advance();
  };

  // ── renderers ────────────────────────────────────────────────────────
  const Output = ({id, label, streaming}) => {
    const text = outputs[id] ?? '';
    const paras = text.split(/\n{2,}/).filter(Boolean);
    return <div className={`pg-output${streaming ? ' is-live' : ''}`}>
      <div className="pg-card-head"><i/><span>{streaming ? 'Printing…' : (label || 'The LinkedIn version')}</span>
        {!streaming && text && <button type="button" className="pg-mini" onClick={() => copy(id, text)}>{copiedId === id ? <Check size={12}/> : <Copy size={12}/>}{copiedId === id ? 'Copied' : 'Copy'}</button>}
      </div>
      <div className="pg-post">
        {!paras.length ? <p className="pg-muted">…</p>
          : text.includes('**') ? <Markdown text={text}/>
          : paras.map((p, i) => <p key={i} className={i === 0 && p.length < 110 ? 'pg-post-lead' : ''}>{p}</p>)}
        {streaming && <span className="pg-cursor"/>}
      </div>
    </div>;
  };

  const ScoreBlock = ({text, title: t}) => {
    const s = score(text);
    const rows = [['Buzzwords per 100 words', s.buzzDensity], ['Gratitude', s.gratitudeLabel], ['Humble-brag', `${s.humbleBrag}%`], ['Dramatic one-liners', s.oneLiners], ['Journeys referenced', s.journeys], ['Chance of “Well deserved!”', `${s.wellDeserved}%`]];
    return <div className="pg-score">
      <div className="pg-score-window"><span className="pg-score-label">{t || 'Post score'}</span><strong>{String(s.index).padStart(2, '0')}</strong><span className="pg-score-scale">out of 100</span><span className="pg-score-rank">{s.rank}</span></div>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>;
  };

  const Continue = ({label = 'Keep going', onClick}) => <button type="button" className="pg-btn" onClick={onClick || (() => advance())}>{label}<ArrowRight size={15}/></button>;

  const renderStep = (step, isLast) => {
    switch(step.type){
      case 'bot-message':
        return <div className="pg-step"><span className="pg-step-mark"><Sparkles size={12}/></span><Markdown className="pg-step-body" text={personalize(step.content)}/></div>;

      case 'name-input':
        return <div className="pg-indent pg-name">
          <input value={nameValue} onChange={e => setNameValue(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !step.askTitle) submitName(); }} placeholder={step.placeholder || 'Your first name'} autoFocus aria-label="Your name"/>
          {step.askTitle && <input value={titleValue} onChange={e => setTitleValue(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') submitName(); }} placeholder={step.titlePlaceholder || 'Your job title'} aria-label="Your job title"/>}
          <button type="button" className="pg-btn" onClick={submitName} disabled={!nameValue.trim()}>{step.buttonLabel || "Let's go"}<ArrowRight size={15}/></button>
        </div>;

      case 'prompt-card':
        return <div className="pg-indent"><div className="pg-prompt">
          <div className="pg-prompt-head"><span>{step.label || 'What actually happened'}</span>
            <div>{step.tryMe && <button type="button" className="pg-mini pg-mini-play" onClick={() => advance()}><Play size={10} fill="currentColor"/>Make it LinkedIn</button>}
              <button type="button" className={`pg-mini${copiedId === step.id ? ' is-copied' : ''}`} onClick={() => copy(step.id, personalize(step.prompt))}>{copiedId === step.id ? <Check size={11}/> : <Copy size={11}/>}{copiedId === step.id ? 'Copied' : 'Copy'}</button></div>
          </div>
          <pre>{personalize(step.prompt)}</pre>
        </div></div>;

      case 'output-card':
        return <div className="pg-indent"><div className="pg-output"><div className="pg-card-head"><i/><span>{step.label || 'The LinkedIn version'}</span></div><div className="pg-post">{step.content.split(/\n{2,}/).map((p, i) => <p key={i} className={i === 0 && p.length < 110 ? 'pg-post-lead' : ''}>{p}</p>)}</div></div></div>;

      case 'live-output':
        return <div className="pg-indent"><Output id={step.id} label={step.label} streaming={performing === step.id}/></div>;

      case 'insight-card':
        return <div className="pg-indent"><div className="pg-card pg-insight"><div className="pg-card-head"><i/><span>{step.title}</span></div><Markdown className="pg-card-body" text={personalize(step.content)}/></div></div>;

      case 'before-after':
        return <div className="pg-indent pg-compare">
          <div className="pg-card"><div className="pg-card-head pg-head-muted"><i/><span>{step.beforeLabel || 'What actually happened'}</span></div><Markdown className="pg-card-body" text={personalize(step.before)}/></div>
          <div className="pg-card pg-card-blue"><div className="pg-card-head"><i/><span>{step.afterLabel || 'The LinkedIn version'}</span></div><Markdown className="pg-card-body" text={personalize(step.after)}/></div>
        </div>;

      case 'takeaway-card':
        return <div className="pg-indent pg-takeaways"><div className="pg-eyebrow">Key takeaways</div>{step.takeaways.map((t, i) => <div className="pg-take" key={i}><span className="pg-tick"><Check size={10}/></span><span>{t}</span></div>)}</div>;

      case 'exercise-card': {
        const running = performing === step.id, out = outputs[step.id];
        const parts = step.template.split(/(\{\{\w+\}\})/g);
        return <div className="pg-indent">
          <div className="pg-card pg-exercise">
            <div className="pg-card-head"><i/><span>{step.title}</span></div>
            <div className="pg-card-body">{step.description && <p className="pg-muted">{step.description}</p>}
              <pre className="pg-template">{parts.map((p, i) => { const m = p.match(/^\{\{(\w+)\}\}$/); if(!m) return <span key={i}>{p}</span>; const b = step.blanks.find(x => x.id === m[1]); return <mark key={i}>{(vals[`${step.id}.${m[1]}`] ?? b?.defaultValue ?? '') || b?.placeholder}</mark>; })}</pre>
            </div>
            <div className="pg-fields">{step.blanks.map(b => <label key={b.id}><span>{b.label}</span><input value={vals[`${step.id}.${b.id}`] ?? b.defaultValue ?? ''} placeholder={b.placeholder} onChange={e => setVals(v => ({...v, [`${step.id}.${b.id}`]: e.target.value}))}/></label>)}</div>
            <div className="pg-card-foot"><span className="pg-muted">Generated in your browser. Nothing is saved.</span>
              <button type="button" className="pg-btn pg-btn-sm" disabled={running} onClick={() => run(step.id, step.performs || 'linkedinify', filledTemplate(step), {level: step.level || 3, after: () => setDone(d => ({...d, [step.id]: true}))})}><Play size={11} fill="currentColor"/>{step.runLabel || 'Make it LinkedIn'}</button></div>
          </div>
          {(running || out !== undefined) && <div className="pg-after"><Output id={step.id} label={step.outputLabel} streaming={running}/></div>}
          {done[step.id] && isLast && <div className="pg-row"><button type="button" className="pg-pill" onClick={() => { setOutputs(o => { const n = {...o}; delete n[step.id]; return n; }); setDone(d => ({...d, [step.id]: false})); }}><RotateCcw size={13}/>Try again</button><Continue/></div>}
        </div>;
      }

      case 'intake-card': {
        const {category, answers: a} = answersFor(step);
        const cat = byId(category);
        const fields = cat.steps(a).filter(f => !step.fields || step.fields.includes(f.key));
        const running = performing === step.id, out = outputs[step.id];
        const set = (key, value) => setAnswers(x => ({...x, [step.id]: {...(x[step.id] || {}), [key]: value}}));
        return <div className="pg-indent">
          <div className="pg-card pg-exercise">
            <div className="pg-card-head"><i/><span>{step.title}</span><span className="pg-form-no">Form {cat.form}</span></div>
            {step.choose && <div className="pg-choices">{Object.entries(CATEGORY_NAMES).map(([id, name]) => <button type="button" key={id} aria-pressed={id === category} onClick={() => { setCategories(c => ({...c, [step.id]: id})); setAnswers(x => ({...x, [step.id]: {}})); }}>{name}</button>)}</div>}
            <div className="pg-card-body">{step.description && <p className="pg-muted">{step.description}</p>}</div>
            <div className="pg-fields">{fields.map(f => f.type === 'choice'
              ? <div className="pg-choice" key={f.key}><span>{f.ask}</span><div>{f.options.map(o => <button type="button" key={o} aria-pressed={a[f.key] === o} onClick={() => set(f.key, o)}>{o}</button>)}</div></div>
              : <label key={f.key}><span>{f.ask}</span><input value={answers[step.id]?.[f.key] ?? ''} placeholder={a[f.key] || f.placeholder} onChange={e => set(f.key, e.target.value)}/></label>)}</div>
            <div className="pg-card-foot"><span className="pg-muted">Blank fields use the example. Your answers stay here.</span>
              <button type="button" className="pg-btn pg-btn-sm" disabled={running} onClick={() => run(step.id, 'generate', answersFor(step), {level: step.level || 3, after: () => setDone(d => ({...d, [step.id]: true}))})}><Play size={11} fill="currentColor"/>{step.runLabel || 'File this post'}</button></div>
          </div>
          {(running || out !== undefined) && <div className="pg-after"><Output id={step.id} label={step.outputLabel || `Level ${step.level || 3} · ${levelName(step.level || 3)}`} streaming={running}/></div>}
          {done[step.id] && isLast && <div className="pg-row"><button type="button" className="pg-pill" onClick={() => run(step.id, 'generate', answersFor(step), {level: step.level || 3})}><RotateCcw size={13}/>Another take</button><Continue/></div>}
        </div>;
      }

      case 'dial': {
        const level = levels[step.id] ?? step.initial ?? 1;
        const src = stepById(step.source);
        const input = src ? answersFor(src) : null;
        const text = input ? perform('generate', input, {seed, level}) : '';
        const name = levelName(level);
        return <div className="pg-indent">
          <div className="pg-card pg-dial">
            <div className="pg-card-head"><i/><span>{step.title || 'The dial'}</span></div>
            <div className="pg-dial-row"><output>{level}</output><div><strong>{name}</strong><span>{LEVELS[level - 1].blurb}</span></div></div>
            <input type="range" min={step.min || 1} max={step.max || 5} value={level} style={{'--level': `${((level - 1) / 4) * 100}%`}} onChange={e => { const n = Number(e.target.value); setLevels(l => ({...l, [step.id]: n})); setOutputs(o => ({...o, [step.id]: perform('generate', input, {seed, level: n})})); setDone(d => ({...d, [step.id]: true})); }} aria-label="LinkedInification level"/>
            <div className="pg-dial-scale"><span>Almost human</span><span>Corporate hallucination</span></div>
          </div>
          <div className="pg-after"><div className="pg-output"><div className="pg-card-head"><i/><span>Level {level} · {name}</span></div><div className="pg-post">{text.split(/\n{2,}/).map((p, i) => <p key={i} className={i === 0 && p.length < 110 ? 'pg-post-lead' : ''}>{p}</p>)}</div></div></div>
          <div className="pg-after"><ScoreBlock text={text}/></div>
          {isLast && <div className="pg-row"><Continue label={done[step.id] ? 'Keep going' : 'Scrub the dial, then keep going'} onClick={() => { setOutputs(o => ({...o, [step.id]: text})); advance(); }}/></div>}
        </div>;
      }

      case 'score-card':
        return <div className="pg-indent"><ScoreBlock text={inputFor(step.source)} title={step.title}/></div>;

      case 'spot-the-trope': {
        const lines = step.text.split('\n').filter(l => l.trim());
        const picked = spotted[step.id] || new Set();
        const checked = !!done[step.id];
        const correct = new Set(step.answers.map(a => lines.findIndex(l => l.trim() === a.trim())));
        const toggle = i => { if(checked) return; setSpotted(s => { const n = new Set(s[step.id] || []); n.has(i) ? n.delete(i) : n.add(i); return {...s, [step.id]: n}; }); };
        const hits = [...picked].filter(i => correct.has(i)).length;
        return <div className="pg-indent">
          <div className="pg-card pg-spot">
            <div className="pg-card-head"><i/><span>{step.title}</span></div>
            <div className="pg-card-body"><p className="pg-muted">{step.description || 'Click every line that is doing LinkedIn things.'}</p>
              <div className="pg-spot-lines">{lines.map((l, i) => <button type="button" key={i} aria-pressed={picked.has(i)} className={checked ? (correct.has(i) ? 'is-trope' : picked.has(i) ? 'is-miss' : '') : ''} onClick={() => toggle(i)}>{l}</button>)}</div>
            </div>
            <div className="pg-card-foot"><span className="pg-muted">{checked ? `${hits} of ${correct.size} found.` : `${picked.size} selected`}</span>
              {!checked && <button type="button" className="pg-btn pg-btn-sm" onClick={() => setDone(d => ({...d, [step.id]: true}))}>Check</button>}</div>
          </div>
          {checked && <div className="pg-after"><div className="pg-card pg-insight"><div className="pg-card-head"><i/><span>{hits === correct.size ? 'Full marks' : 'What you missed'}</span></div><Markdown className="pg-card-body" text={step.explanation}/></div></div>}
          {checked && isLast && <div className="pg-row"><Continue/></div>}
        </div>;
      }

      case 'beat-card': {
        const text = inputFor(step.source);
        return <div className="pg-indent pg-beat">
          <div className="pg-eyebrow">{step.title || 'Your words. On repeat.'}</div>
          {text ? <PostBeat key={text} post={text}/> : <p className="pg-muted">Write a post first.</p>}
          {isLast && <div className="pg-row"><Continue label={step.buttonLabel || 'Keep going'}/></div>}
        </div>;
      }

      case 'pause':
        return <div className="pg-indent"><button type="button" className="pg-pill" onClick={() => advance()}>{step.buttonLabel || 'Continue'}<ArrowRight size={13}/></button></div>;

      case 'buttons':
        return <div className="pg-indent pg-row">{step.buttons.map((b, i) => <button type="button" key={i} className={b.variant === 'secondary' ? 'pg-pill' : 'pg-btn'} onClick={() => (b.action === 'nextChapter' ? onComplete() : advance())}>{b.label}</button>)}</div>;

      case 'chapter-end':
        return <div className="pg-indent"><div className="pg-end">
          <span className="pg-eyebrow">{step.isFinal ? 'Program complete' : 'You have reached'}</span>
          <strong>{step.isFinal ? 'Certification pending your signature.' : `Level ${chapter.level} · ${chapter.levelName}`}</strong>
          {!step.isFinal && step.nextChapterTitle && <span className="pg-muted">Next: {step.nextChapterTitle}</span>}
          <button type="button" className="pg-btn" onClick={onComplete}>{step.isFinal ? 'Get certified' : `Begin: ${step.nextChapterTitle || 'Next lesson'}`}<ArrowRight size={15}/></button>
        </div></div>;

      case 'divider':
        return <div className="pg-indent"><hr className="pg-hair"/></div>;

      default:
        return null;
    }
  };

  return <div className="pg-scroll" ref={scrollRef}>
    <div className="pg-lesson">
      <div className="pg-strip"><span>Lesson {String(chapter.number).padStart(2, '0')} / 05</span><i/><span>{chapter.minutes} min</span></div>
      <div className="pg-eyebrow pg-eyebrow-blue">Level {chapter.level} · {chapter.levelName}</div>
      <h1 className="pg-h1">{chapter.title}</h1>
      <p className="pg-sub">{chapter.subtitle}</p>
      <div className="pg-steps">{steps.slice(0, visibleCount).map((step, i) => <div key={step.id} className="pg-in">{renderStep(step, i === visibleCount - 1)}</div>)}</div>
    </div>
  </div>;
}
