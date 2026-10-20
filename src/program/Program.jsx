import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Award, BookOpen, Check, ChevronDown, Clock3, Download, LockKeyhole, Music2, Printer, Quote, X} from 'lucide-react';
import {CHAPTERS, chapterById} from './chapters/index.js';
import {StepPlayer} from './engine/StepPlayer.jsx';
import {loadProgress, saveProgress} from './engine/progress.js';
import {CertificateArt, downloadArt, REWARDS, Sticker} from './components/Rewards.jsx';
import {PostBeat} from '../post-beat/PostBeat.jsx';

// Static entries at /learn/ and /program/ share hash links and saved progress.
const route = () => window.location.hash.replace(/^#\/?/, '') || '';
const go = id => { window.location.hash = id ? `#/${id}` : ''; };
const allComplete = progress => CHAPTERS.every(c => progress.completedChapters.includes(c.id));

export default function Program(){
  const [path,setPath]=useState(route), [progress,setProgress]=useState(loadProgress), [menuOpen,setMenuOpen]=useState(false);
  const mainRef=useRef(null);
  const update=useCallback(patch=>setProgress(previous=>saveProgress(typeof patch==='function' ? patch(previous) : patch, previous)),[]);
  const chapter=chapterById(path), index=CHAPTERS.findIndex(c=>c.id===path), complete=allComplete(progress);
  useEffect(()=>{const change=()=>{setPath(route());setMenuOpen(false);window.scrollTo(0,0);mainRef.current?.focus({preventScroll:true});};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  useEffect(()=>{const sync=e=>{if(e.key==='lb_program_v1' || e.key===null)setProgress(loadProgress());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  useEffect(()=>{if(index>=0)update({currentChapter:index});},[index,update]);
  useEffect(()=>{document.title=`${chapter?.title || (path==='certified' ? 'Your certificate' : 'Academy')} — LinkedIn Beats`;},[chapter,path]);
  const finish=useCallback(id=>update(p=>({completedChapters:[...new Set([...p.completedChapters,id])]})),[update]);
  const next=()=>{const nextIndex=index+1;go(nextIndex<CHAPTERS.length ? CHAPTERS[nextIndex].id : 'certified');};
  const savePost=useCallback((id,text,s)=>update(p=>({bestScore:Math.max(s.index,p.bestScore||0),posts:{...p.posts,[chapter.id]:text}})),[chapter?.id,update]);
  const current=CHAPTERS[Math.min(progress.currentChapter,CHAPTERS.length-1)] || CHAPTERS[0];
  const resume=progress.completedChapters.includes(current.id) ? (CHAPTERS.find(c=>!progress.completedChapters.includes(c.id)) || current) : current;

  return <div className="pg-app">
    <a className="pg-skip" href="#program-main" onClick={e=>{e.preventDefault();mainRef.current?.focus();}}>Skip to the lesson</a>
    <aside className={`pg-rail${menuOpen ? ' is-open' : ''}`}>
      <div className="pg-rail-top"><a href="../" className="pg-wordmark" aria-label="LinkedIn Beats home">linkedin<span>beats</span></a><button type="button" className="pg-menu-toggle" aria-expanded={menuOpen} aria-controls="pg-course-nav" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen ? <X size={19}/> : <ChevronDown size={19}/>}<span>Course</span></button></div>
      <div className="pg-rail-content" id="pg-course-nav">
        <a href="../" className="pg-back"><ArrowLeft size={15}/>Back to site</a>
        <div className="pg-rail-progress"><div><span className="pg-eyebrow">Your progress</span><strong>{progress.completedChapters.length} / 5</strong></div><div className="pg-progress-track" role="progressbar" aria-label="Course completion" aria-valuenow={progress.completedChapters.length} aria-valuemin={0} aria-valuemax={5}><span style={{width:`${progress.completedChapters.length*20}%`}}/></div></div>
        <nav className="pg-rail-list" aria-label="Course lessons" onClick={e=>{if(e.target.closest('a'))setMenuOpen(false);}}>
          <a href="#" className={`pg-overview-link${!chapter && path!=='certified' ? ' is-active' : ''}`} aria-current={!path ? 'page' : undefined}><BookOpen size={16}/>Course overview</a>
          {CHAPTERS.map(c=>{const done=progress.completedChapters.includes(c.id);return <a key={c.id} href={`#/${c.id}`} className={`pg-rail-item${c.id===path ? ' is-active' : ''}`} aria-current={c.id===path ? 'step' : undefined}><span className={`pg-state${done ? ' is-done' : ''}`}>{done ? <Check size={14}/> : c.number}</span><span>{c.title}<small>{done ? 'Completed' : `${c.minutes} min`}</small></span></a>;})}
        </nav>
        {complete ? <a href="#/certified" className="pg-rail-certificate"><Award size={17}/>Your certificate<ArrowRight size={14}/></a> : <div className="pg-rail-certificate is-locked"><LockKeyhole size={15}/><span>Certificate of Professional Effort<small>Complete all five lessons to unlock.</small></span></div>}
        <div className="pg-rail-foot"><span>Progress saved on this device</span></div>
      </div>
    </aside>
    <main id="program-main" className="pg-main" ref={mainRef} tabIndex={-1}>
      {chapter ? <StepPlayer key={chapter.id} chapter={chapter} userName={progress.userName} title={progress.title} onName={(userName,title)=>update({userName,title})} onPost={savePost} onFinish={finish} onComplete={next}/>
        : path==='certified' && complete ? <Certificate progress={progress} update={update}/>
        : <Syllabus progress={progress} resume={resume} lockedCertificate={path==='certified'}/>}
    </main>
  </div>;
}

function Syllabus({progress,resume,lockedCertificate}){
  const complete=allComplete(progress), started=!!progress.userName || progress.completedChapters.length>0;
  const summaries={hook:'Make the first line worth the second.',inflation:'Turn a small update into a major announcement.',vocabulary:'Sound humbled, honored, and strategically aligned.',shape:'Master the line break. Manufacture the revelation.',single:'Write your post. Drop your beat. Get certified.'};
  return <div className="pg-home">
    <div className="pg-strip pg-academy-header"><span><BookOpen size={17}/>LinkedIn Beats Academy</span><span><Clock3 size={14}/>25 min · Self-paced</span></div>
    {lockedCertificate && <p className="pg-notice">Your certificate is waiting. Finish all five lessons to make it official.</p>}
    <div className="pg-academy-intro">
      <div className="pg-masthead">
        <span className="pg-eyebrow pg-eyebrow-blue">Professional development, allegedly.</span>
        <h1 className="pg-display">Your career isn’t going <em>to congratulate itself.</em></h1>
        <p className="pg-lead">Welcome to LinkedIn Beats Academy. On the world’s premier professional network, doing the work is only half the job. Announcing it is the other 900%.</p>
        <p className="pg-pitch">Five short lessons in hooks, humblebrags, and turning a perfectly normal Tuesday into a personal brand milestone.</p>
        <div className="pg-row"><button className="pg-btn" type="button" onClick={()=>go(complete ? 'certified' : resume.id)}>{complete ? 'View my certificate' : started ? 'Continue learning' : 'Start learning'}<ArrowRight size={16}/></button><span className="pg-enrollment-note">One deeply unnecessary credential.</span></div>
      </div>
      <aside className="pg-synergy-quote" aria-label="A word from your instructor">
        <div className="pg-synergy-tag"><span>Synergy says</span><Quote size={25} aria-hidden="true"/></div>
        <blockquote>“If a milestone happens and nobody is humbled to announce it, <em>did it even happen?</em>”</blockquote>
        <div className="pg-synergy-signature"><img src="/studio/season/posters/synergy-camera-v2-listening.jpg" alt="Synergy, your robot instructor"/><p><strong>Synergy</strong><span>Head of Professional <br/>Development Optimization</span></p></div>
      </aside>
    </div>
    <section className="pg-course-overview" aria-labelledby="pg-course-heading">
      <div className="pg-course-heading"><h2 id="pg-course-heading">Course content</h2><span className="pg-muted">{progress.completedChapters.length} of 5 complete</span></div>
      <div className="pg-index">{CHAPTERS.map(c=>{const done=progress.completedChapters.includes(c.id), next=!done && c.id===resume.id;return <a className={`pg-row-item${next ? ' is-next' : ''}`} key={c.id} href={`#/${c.id}`}><span className={`pg-state${done ? ' is-done' : ''}`}>{done ? <Check size={15}/> : String(c.number).padStart(2,'0')}</span><span><span className="pg-row-title">{c.title}</span><span className="pg-row-sub">{summaries[c.id]}</span></span><span className="pg-row-duration">{c.minutes} min</span><span className="pg-row-meta"><span className={`pg-course-status${done ? ' is-done' : next ? ' is-next' : ''}`}>{done ? 'Completed' : next ? 'Next up' : 'Start'}</span><ArrowRight size={16}/></span></a>;})}</div>
    </section>
    <section className="pg-earned-teaser"><div className="pg-teaser-sticker"><Sticker number={2}/></div><div><h2>Real effort. Questionable credentials.</h2><p>Earn five stickers, unlock your own beat, and graduate with a Certificate of Professional Effort.</p></div><Award size={25} aria-hidden="true"/></section>
    <p className="pg-smallprint">A satirical learning experience by LinkedIn Beats. Your practice posts are never published to LinkedIn. Course progress is saved in this browser.</p>
  </div>;
}

function Certificate({progress,update}){
  const art=useRef(null), [status,setStatus]=useState(''), [name,setName]=useState(progress.userName || 'Aspiring Thought Leader');
  const displayName=name.trim() || 'Aspiring Thought Leader';
  const download=async()=>{setStatus('Preparing your certificate…');try{await downloadArt(art.current,'linkedin-beats-certificate-of-professional-effort.png');setStatus('Certificate downloaded.');}catch{setStatus('Download unavailable. Use Print / save PDF instead.');}};
  return <div className="pg-certificate-page">
    <div className="pg-strip"><span>All five lessons complete</span><Check size={17}/></div>
    <div className="pg-masthead"><span className="pg-eyebrow pg-eyebrow-blue">Your effort has been noted.</span><h1 className="pg-h1">Make it official.</h1><p className="pg-lead">You came. You learned. You strategically aligned.</p></div>
    <div className="pg-certificate-controls"><label><span className="pg-eyebrow">Name on your certificate</span><input value={name} maxLength={60} onChange={e=>setName(e.target.value)} onBlur={()=>update({userName:displayName})}/></label><div className="pg-row"><button className="pg-btn" onClick={download}><Download size={16}/>Download certificate</button><button className="pg-pill" onClick={()=>window.print()}><Printer size={16}/>Print / save PDF</button></div></div>
    <p className="pg-download-status" role="status">{status}</p>
    <CertificateArt name={displayName} svgRef={art}/>
    <section className="pg-collection"><div className="pg-course-heading"><h2>The complete collection</h2><span className="pg-eyebrow">5 / 5 earned</span></div><div className="pg-sticker-collection">{REWARDS.map((r,i)=><StickerDownload key={r.name} number={i+1}/>)}</div></section>
    <section className="pg-beat-unlock"><div className="pg-row"><span className="pg-reward-icon"><Music2 size={25}/></span><div><span className="pg-eyebrow pg-eyebrow-blue">Unlocked · Your optimized beat</span><h2>Consider this your graduation single.</h2></div></div><p>Your final post, ready for a bassline. Make it a beat, remix it, or release your single.</p>{progress.posts.single ? <PostBeat post={progress.posts.single} initialArtist={displayName}/> : <a className="pg-btn" href="#/single">Make your single<ArrowRight size={16}/></a>}</section>
  </div>;
}
function StickerDownload({number}){
  const ref=useRef(null),[status,setStatus]=useState('');
  return <div><button className="pg-sticker-download" aria-label={`Download ${REWARDS[number-1].name} sticker`} onClick={async()=>{try{await downloadArt(ref.current,`linkedin-beats-lesson-${number}.png`);setStatus('Downloaded');}catch{setStatus('Try again');}}}><Sticker number={number} svgRef={ref}/><span><Download size={12}/>Download</span></button><small role="status">{status}</small></div>;
}
