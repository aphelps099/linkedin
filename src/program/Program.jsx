import React, {useCallback, useEffect, useState} from 'react';
import {ArrowRight, Check, Moon, Sun} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import '../home-2/header.css';
import {ConceptFooter} from '../home-2/ConceptFooter.jsx';
import '../home-2/footer.css';
import {CHAPTERS, chapterById} from './chapters/index.js';
import {StepPlayer} from './engine/StepPlayer.jsx';
import {loadProgress, saveProgress, resetProgress} from './engine/progress.js';
import {levelName} from './engine/performer.js';

// Routes live in the hash so the page works as a static multi-page build:
//   /program/            the syllabus (home)
//   /program/#/hook      a lesson
//   /program/#/certified the certificate
const route = () => (window.location.hash.replace(/^#\/?/, '') || '');
const go = id => { window.location.hash = id ? `#/${id}` : ''; };

export default function Program(){
  const [path, setPath] = useState(route);
  const [progress, setProgress] = useState(loadProgress);
  useEffect(() => { const h = () => { setPath(route()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);

  const update = useCallback(patch => setProgress(saveProgress(patch)), []);
  const chapter = chapterById(path);
  const index = CHAPTERS.findIndex(c => c.id === path);

  useEffect(() => { if(index >= 0 && progress.currentChapter !== index) update({currentChapter: index}); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = () => {
    const completed = new Set(progress.completedChapters); completed.add(chapter.id);
    const next = index + 1;
    update({completedChapters: [...completed], currentChapter: Math.min(next, CHAPTERS.length - 1)});
    go(next < CHAPTERS.length ? CHAPTERS[next].id : 'certified');
  };

  const body = path === 'certified' ? <Certificate progress={progress} onReset={() => { resetProgress(); setProgress(loadProgress()); go(''); }}/>
    : chapter ? <Lesson chapter={chapter} index={index} progress={progress} update={update} onComplete={complete}/>
    : <Syllabus progress={progress}/>;

  return <div className="pg-app c2-home">
    <a className="pg-skip" href="#program-main">Skip to the lesson</a>
    <ConceptHeader base="../" homeSectionBase="../" active="Program"/>
    <main id="program-main" className="pg-main">{body}</main>
    <ConceptFooter base="../"/>
  </div>;
}

function Dial({completed, active}){
  // Five notches. Done = filled, active = outlined, the rest = hairline.
  return <div className="pg-dial-meter" role="img" aria-label={`${completed.size} of ${CHAPTERS.length} lessons complete`}>
    {CHAPTERS.map((c, i) => <span key={c.id} className={completed.has(c.id) ? 'is-done' : i === active ? 'is-active' : ''}><i/><b>{c.level}</b></span>)}
  </div>;
}

function Syllabus({progress}){
  const completed = new Set(progress.completedChapters);
  const active = Math.min(progress.currentChapter, CHAPTERS.length - 1);
  const resume = CHAPTERS[active];
  const allDone = completed.size >= CHAPTERS.length;
  return <div className="pg-home">
    <div className="pg-masthead">
      <span className="pg-eyebrow pg-eyebrow-blue">Professional development program · {CHAPTERS.length} lessons</span>
      <h1 className="pg-display">Learn to speak<br/>like LinkedIn.</h1>
      <p className="pg-lead">Five short lessons. Each one turns the dial up a notch — from Almost Human to Corporate Hallucination. Real posts you can run, exercises you can edit, and a single you can release.</p>
    </div>
    <div className="pg-resume">
      <div><div className="pg-resume-top"><span className="pg-eyebrow pg-eyebrow-blue">{completed.size ? 'Continue where you left off' : 'Start here'}</span><span className="pg-eyebrow">{completed.size} of {CHAPTERS.length} complete</span></div><Dial completed={completed} active={active}/></div>
      <button type="button" className="pg-btn" onClick={() => go(allDone ? 'certified' : resume.id)}>{allDone ? 'View certificate' : `${completed.size ? 'Resume' : 'Begin'} · ${resume.title}`}<ArrowRight size={15}/></button>
    </div>
    <div className="pg-index">
      {CHAPTERS.map((c, i) => { const done = completed.has(c.id); const isActive = i === active && !allDone;
        return <button type="button" className="pg-row-item" key={c.id} onClick={() => go(c.id)}>
          <span className="pg-no">{String(c.number).padStart(2, '0')}</span>
          <span><span className="pg-row-title">{c.title}{isActive && <em>Up next</em>}</span><span className="pg-row-sub">{c.subtitle}</span></span>
          <span className="pg-row-meta"><span>Level {c.level} · {c.levelName}</span><span>{c.minutes} min</span><span className={`pg-state${done ? ' is-done' : isActive ? ' is-active' : ''}`}>{done ? <Check size={11}/> : c.number}</span></span>
        </button>; })}
    </div>
    <p className="pg-smallprint">Everything in the Program is generated in your browser. Your name, your answers and your progress stay on this device.</p>
  </div>;
}

function Lesson({chapter, index, progress, update, onComplete}){
  const completed = new Set(progress.completedChapters);
  return <div className="pg-lesson-shell">
    <aside className="pg-rail">
      <button type="button" className="pg-back" onClick={() => go('')}>← The syllabus</button>
      <div className="pg-rail-progress"><div><span className="pg-eyebrow">Progress</span><span className="pg-eyebrow">{completed.size}/{CHAPTERS.length}</span></div><Dial completed={completed} active={index}/></div>
      <div className="pg-rail-list">{CHAPTERS.map((c, i) => <button type="button" key={c.id} className={`pg-rail-item${c.id === chapter.id ? ' is-active' : ''}`} onClick={() => go(c.id)}><span className={`pg-state${completed.has(c.id) && c.id !== chapter.id ? ' is-done' : c.id === chapter.id ? ' is-active' : ''}`}>{completed.has(c.id) && c.id !== chapter.id ? <Check size={10}/> : c.number}</span><span>{c.title}</span></button>)}</div>
      <div className="pg-rail-foot"><span className="pg-eyebrow">Learning tour</span><span className="pg-eyebrow">{CHAPTERS.length} lessons</span></div>
    </aside>
    <StepPlayer chapter={chapter} userName={progress.userName} title={progress.title}
      onName={(userName, title) => update({userName, title})}
      onPost={(id, text, s) => { if(s.index > (progress.bestScore || 0)) update({bestScore: s.index, posts: {...progress.posts, [chapter.id]: text}}); }}
      onComplete={onComplete}/>
  </div>;
}

function Certificate({progress, onReset}){
  const name = progress.userName || 'Aspiring Thought Leader';
  const level = progress.bestScore >= 90 ? 5 : progress.bestScore >= 70 ? 4 : progress.bestScore >= 50 ? 3 : progress.bestScore >= 30 ? 2 : 1;
  return <div className="pg-home">
    <div className="pg-cert">
      <span className="pg-eyebrow">Certificate of professional development</span>
      <h1 className="pg-display">This certifies that<br/><em>{name}</em></h1>
      <p className="pg-lead">{progress.title ? `${progress.title}, ` : ''}has completed all five lessons of the LinkedIn Beats Professional Development Program and is hereby recognized as a</p>
      <strong className="pg-cert-level">Certified {levelName(level)}</strong>
      <p className="pg-muted">Best post score: {String(progress.bestScore || 0).padStart(2, '0')} / 100. Internal standards. Entirely made up.</p>
      <div className="pg-row">
        <a className="pg-btn" href="../lessons/">Release another single<ArrowRight size={15}/></a>
        <a className="pg-pill" href="../store/">Wear your boundaries</a>
        <button type="button" className="pg-pill" onClick={onReset}>Start over</button>
      </div>
    </div>
  </div>;
}

// unused imports kept intentionally small; Sun/Moon reserved for a theme toggle
void Sun; void Moon;
