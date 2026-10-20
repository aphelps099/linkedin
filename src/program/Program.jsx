import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Award, Check, ChevronDown, Clock3, Download, LockKeyhole, Music2, Printer, Share2, X} from 'lucide-react';
import {CHAPTERS, chapterById} from './chapters/index.js';
import {StepPlayer} from './engine/StepPlayer.jsx';
import {loadProgress, saveProgress} from './engine/progress.js';
import {CertificateArt, downloadArt, REWARDS, Sticker} from './components/Rewards.jsx';
import {PostBeat} from '../post-beat/PostBeat.jsx';
import {SynergyTip} from './components/SynergyTip.jsx';
import {CertificateShare} from './components/CertificateShare.jsx';
import {GraduationConfetti} from './components/GraduationConfetti.jsx';
import {LESSON_PRESENTATION} from './chapters/presentation.js';

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
  useEffect(()=>{document.title=`${chapter?.title || (path==='certified' ? 'Your certificate' : path==='achievements' ? 'Your achievements' : 'Academy')} — LinkedIn Beats`;},[chapter,path]);
  const finish=useCallback(id=>update(p=>({completedChapters:[...new Set([...p.completedChapters,id])]})),[update]);
  const next=()=>{const nextIndex=index+1;go(nextIndex<CHAPTERS.length ? CHAPTERS[nextIndex].id : 'certified');};
  const savePost=useCallback((id,text,s)=>update(p=>({bestScore:Math.max(s.index,p.bestScore||0),posts:{...p.posts,[chapter.id]:text}})),[chapter?.id,update]);
  const current=CHAPTERS[Math.min(progress.currentChapter,CHAPTERS.length-1)] || CHAPTERS[0];
  const resume=progress.completedChapters.includes(current.id) ? (CHAPTERS.find(c=>!progress.completedChapters.includes(c.id)) || current) : current;

  return <div className="pg-app">
    <a className="pg-skip" href="#program-main" onClick={e=>{e.preventDefault();mainRef.current?.focus();}}>Skip to the lesson</a>
    <header className="pg-topbar">
      <div className="pg-topbar-inner">
        <a href="#" className="pg-brand" aria-label="LinkedIn Beats Academy course overview"><span className="pg-wordmark">linkedin<span>beats</span></span><span className="pg-brand-suffix">Academy</span></a>
        <button type="button" className="pg-menu-toggle" aria-expanded={menuOpen} aria-controls="pg-course-nav" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen ? <X size={18}/> : <ChevronDown size={18}/>}<span>Menu</span></button>
        <nav className={`pg-topnav${menuOpen ? ' is-open' : ''}`} id="pg-course-nav" aria-label="Academy" onClick={()=>setMenuOpen(false)}>
          <a href="#" aria-current={!path ? 'page' : undefined}>Course overview</a>
          <a href="#/achievements" aria-current={path==='achievements' || path==='certified' ? 'page' : undefined}>Your achievements</a>
          <a href="../" className="pg-site-link">Main site<ArrowRight size={15}/></a>
        </nav>
      </div>
    </header>
    <main id="program-main" className="pg-main" ref={mainRef} tabIndex={-1}>
      {chapter ? <StepPlayer key={chapter.id} chapter={chapter} userName={progress.userName} title={progress.title} onName={(userName,title)=>update({userName,title})} onPost={savePost} onFinish={finish} onComplete={next}/>
        : path==='achievements' ? <Achievements progress={progress} resume={resume}/>
        : path==='certified' && complete ? <Certificate progress={progress} update={update}/>
        : <Syllabus progress={progress} resume={resume} lockedCertificate={path==='certified'}/>}
    </main>
  </div>;
}

function Syllabus({progress,resume,lockedCertificate}){
  const complete=allComplete(progress), started=!!progress.userName || progress.completedChapters.length>0;
  return <div className="pg-home">
    {lockedCertificate && <p className="pg-notice">Your certificate is waiting. Finish all five lessons to make it official.</p>}
    <div className="pg-academy-intro">
      <div className="pg-masthead">
        <span className="pg-eyebrow pg-eyebrow-blue">Professional development, allegedly.</span>
        <h1 className="pg-display">Your career isn’t going <em>to congratulate itself.</em></h1>
        <p className="pg-lead">On the world’s premier professional network, doing the work is only half the job. Announcing it is the other 900%.</p>
        <p className="pg-pitch">Five short lessons. One very public personal brand. A deeply unnecessary credential.</p>
      </div>
      <div className="pg-instructor-note"><SynergyTip content="Doing good work is great. Announcing it is **scalable.**"/><p>Your instructor: Synergy<br/><span>Head of Professional Development Optimization</span></p></div>
    </div>
    <section className="pg-course-resume" aria-label="Your course progress">
      <div className="pg-resume-info"><strong>{complete ? 'Considerable effort. Verified.' : started ? 'Your next professional milestone' : 'Your professional evolution starts here.'}</strong><div><span>{progress.completedChapters.length} of 5 lessons complete</span><span><Clock3 size={13}/>25 min · Self-paced</span></div><div className="pg-progress-track" role="progressbar" aria-label="Course completion" aria-valuenow={progress.completedChapters.length} aria-valuemin={0} aria-valuemax={5}><span style={{width:`${progress.completedChapters.length*20}%`}}/></div></div>
      <button className="pg-btn" type="button" onClick={()=>go(complete ? 'certified' : resume.id)}>{complete ? 'View my certificate' : started ? `Continue lesson ${resume.number}` : 'Start lesson 1'}<ArrowRight size={16}/></button>
    </section>
    <section className="pg-course-overview" aria-labelledby="pg-course-heading">
      <div className="pg-course-heading"><h2 id="pg-course-heading">Your curriculum</h2><span className="pg-muted">A little more LinkedIn, one lesson at a time.</span></div>
      <div className="pg-index">{CHAPTERS.map(c=>{const done=progress.completedChapters.includes(c.id), next=!done && c.id===resume.id, presentation=LESSON_PRESENTATION[c.id];return <a className={`pg-row-item${next ? ' is-next' : ''}`} key={c.id} href={`#/${c.id}`}>
        <img className="pg-course-art" src={presentation.image} alt="" width="84" height="84" loading="lazy"/>
        <span className="pg-row-detail"><span className="pg-row-title"><span className="pg-course-number">{String(c.number).padStart(2,'0')}</span>{c.title}</span><span className="pg-row-sub">{presentation.summary}</span><span className="pg-row-format">{presentation.format}<span>·</span>{c.minutes} min</span></span>
        <span className={`pg-row-meta${done ? ' is-done' : ''}`}><span className={`pg-course-status${done ? ' is-done' : next ? ' is-next' : ''}`}>{done ? <><Check size={13}/>Completed</> : next ? 'Next up' : 'Start lesson'}</span><ArrowRight size={17}/></span>
      </a>;})}</div>
    </section>
    <section className="pg-earned-teaser" aria-label="Your rewards"><div className="pg-teaser-copy"><h2>Real effort. Questionable credentials.</h2><p>Five stickers, your own beat, and a Certificate of Professional Effort.</p><a href="#/achievements">Your achievements<ArrowRight size={14}/></a></div><div className="pg-mini-collection">{CHAPTERS.map(c=><div key={c.id} className={progress.completedChapters.includes(c.id) ? 'is-earned' : 'is-locked'} title={`${REWARDS[c.number-1].name} · ${progress.completedChapters.includes(c.id) ? 'Earned' : 'Complete lesson '+c.number}`}><Sticker number={c.number}/></div>)}</div></section>
    <p className="pg-smallprint">A satirical learning experience by LinkedIn Beats. Practice posts are never published to LinkedIn. Progress is saved in this browser.</p>
  </div>;
}

function Achievements({progress,resume}){
  const complete=allComplete(progress);
  return <div className="pg-achievements-page">
    <a className="pg-back-link" href="#"><ArrowLeft size={16}/>All lessons</a>
    <div className="pg-masthead"><span className="pg-eyebrow pg-eyebrow-blue">Your effort has been noted.</span><h1 className="pg-h1">The credential collection.</h1><p className="pg-lead">Actual learning. Downloadable proof. {progress.completedChapters.length} of 5 stickers earned.</p></div>
    <div className="pg-achievement-grid">{CHAPTERS.map(c=>{const earned=progress.completedChapters.includes(c.id);return <section key={c.id} className={`pg-achievement${earned ? ' is-earned' : ''}`}><span className="pg-eyebrow">Lesson {c.number} · {c.title}</span>{earned ? <StickerDownload number={c.number}/> : <><div className="pg-locked-art"><Sticker number={c.number}/></div><span className="pg-locked-label"><LockKeyhole size={13}/>Complete lesson {c.number} to unlock</span></>}<h2>{REWARDS[c.number-1].name}</h2></section>;})}</div>
    <section className="pg-certificate-unlock"><Award size={34}/><div><h2>Certificate of Professional Effort</h2><p>{complete ? 'Five lessons. One highly shareable qualification.' : 'Complete all five lessons to unlock your certificate and graduation single.'}</p></div><a className="pg-btn" href={complete ? '#/certified' : `#/${resume.id}`}>{complete ? 'View my certificate' : 'Keep learning'}<ArrowRight size={16}/></a></section>
  </div>;
}

function Certificate({progress,update}){
  const art=useRef(null), shareButton=useRef(null), [shareOpen,setShareOpen]=useState(false), [status,setStatus]=useState(''), [name,setName]=useState(progress.userName || 'Aspiring Thought Leader');
  const displayName=name.trim() || 'Aspiring Thought Leader';
  const download=async()=>{setStatus('Preparing your certificate…');try{await downloadArt(art.current,'linkedin-beats-certificate-of-professional-effort.png');setStatus('Certificate downloaded.');}catch{setStatus('Download unavailable. Use Print / save PDF instead.');}};
  const closeShare=()=>{setShareOpen(false);shareButton.current?.focus();};
  return <div className="pg-certificate-page">
    <GraduationConfetti/>
    <div className="pg-graduation-topline"><span><Check size={16}/>All five lessons complete</span><a href="../">Back to LinkedIn Beats<ArrowRight size={16}/></a></div>
    <div className="pg-masthead"><span className="pg-eyebrow pg-eyebrow-blue">Your effort has been noted.</span><h1 className="pg-h1">Make it official.</h1><p className="pg-lead">You came. You learned. You strategically aligned.</p></div>
    <div className="pg-certificate-controls"><label><span className="pg-eyebrow">Name on your certificate</span><input value={name} maxLength={60} onChange={e=>setName(e.target.value)} onBlur={()=>update({userName:displayName})}/></label><div className="pg-row"><button className="pg-btn" ref={shareButton} aria-expanded={shareOpen} aria-controls="pg-certificate-sharing" onClick={()=>setShareOpen(v=>!v)}><Share2 size={16}/>Share certificate</button><button className="pg-pill" onClick={download}><Download size={16}/>Download</button><button className="pg-pill" onClick={()=>window.print()}><Printer size={16}/>Print / save PDF</button></div></div>
    <p className="pg-download-status" role="status">{status}</p>
    <div id="pg-certificate-sharing">{shareOpen && <CertificateShare art={art} name={displayName} onClose={closeShare}/>}</div>
    <CertificateArt name={displayName} svgRef={art}/>
    <section className="pg-collection"><div className="pg-course-heading"><h2>The complete collection</h2><span className="pg-eyebrow">5 / 5 earned</span></div><div className="pg-sticker-collection">{REWARDS.map((r,i)=><StickerDownload key={r.name} number={i+1}/>)}</div></section>
    <section className="pg-beat-unlock"><div className="pg-row"><span className="pg-reward-icon"><Music2 size={25}/></span><div><span className="pg-eyebrow pg-eyebrow-blue">Unlocked · Your optimized beat</span><h2>Consider this your graduation single.</h2></div></div><p>Your final post, ready for a bassline. Make it a beat, remix it, or release your single.</p>{progress.posts.single ? <PostBeat post={progress.posts.single} initialArtist={displayName}/> : <a className="pg-btn" href="#/single">Make your single<ArrowRight size={16}/></a>}</section>
    <div className="pg-graduation-exit"><div><strong>Your work here is done.</strong><p>Your audience awaits. The band is warming up.</p></div><a className="pg-btn" href="../">Explore LinkedIn Beats<ArrowRight size={16}/></a></div>
  </div>;
}
function StickerDownload({number}){
  const ref=useRef(null),[status,setStatus]=useState('');
  return <div><button className="pg-sticker-download" aria-label={`Download ${REWARDS[number-1].name} sticker`} onClick={async()=>{try{await downloadArt(ref.current,`linkedin-beats-lesson-${number}.png`);setStatus('Downloaded');}catch{setStatus('Try again');}}}><Sticker number={number} svgRef={ref}/><span><Download size={12}/>Download</span></button><small role="status">{status}</small></div>;
}
