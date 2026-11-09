import {PixelDivider} from '../brand/PixelDivider.jsx';
import {AcademyOverview,LessonNavigation} from './arcade/Overview.jsx';
import {HookLesson} from './arcade/HookLesson.jsx';
import {SiteFooter} from '../brand/SiteFooter.jsx';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Award, Check, Download, LockKeyhole, Printer} from 'lucide-react';
import {CHAPTERS, chapterById} from './chapters/index.js';
import {StepPlayer} from './engine/StepPlayer.jsx';
import {loadProgress, saveProgress} from './engine/progress.js';
import {BadgeDownloads, CertificateArt, downloadArt, REWARDS, Sticker} from './components/Rewards.jsx';
import {GraduationSingle} from './components/GraduationSingle.jsx';
import {CertificateShare} from './components/CertificateShare.jsx';
import {certificateName} from './components/certificate-art.js';
import {GraduationConfetti} from './components/GraduationConfetti.jsx';

// Static entries at /learn/ and /program/ share hash links and saved progress.
const route = () => window.location.hash.replace(/^#\/?/, '') || '';
const go = id => { window.location.hash = id ? `#/${id}` : ''; };
const allComplete = progress => CHAPTERS.every(c => progress.completedChapters.includes(c.id));

export default function Program(){
  const [path,setPath]=useState(route), [progress,setProgress]=useState(loadProgress);
  const mainRef=useRef(null);
  const update=useCallback(patch=>setProgress(previous=>saveProgress(typeof patch==='function' ? patch(previous) : patch, previous)),[]);
  const chapter=chapterById(path), index=CHAPTERS.findIndex(c=>c.id===path), complete=allComplete(progress);
  useEffect(()=>{const change=()=>{setPath(route());window.scrollTo(0,0);mainRef.current?.focus({preventScroll:true});};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
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
    <main id="program-main" className="pg-main" ref={mainRef} tabIndex={-1}>
      {chapter&&<LessonNavigation chapter={chapter} completed={progress.completedChapters}/>}
      {chapter?.id==='hook' ? <HookLesson chapter={chapter} draft={progress.lessonDrafts?.hook} userName={progress.userName} onDraft={draft=>update(p=>({lessonDrafts:{...p.lessonDrafts,hook:draft},posts:{...p.posts,...(draft.tried?{hook:draft.post}:{})}}))} onFinish={finish} onComplete={next}/> : chapter ? <StepPlayer key={chapter.id} chapter={chapter} userName={progress.userName} title={progress.title} onName={(userName,title)=>update({userName,title})} onPost={savePost} onFinish={finish} onComplete={next}/>
        : path==='achievements' ? <Achievements progress={progress} resume={resume}/>
        : path==='certified' && complete ? <Certificate progress={progress} update={update}/>
        : <AcademyOverview progress={progress} resume={resume} lockedCertificate={path==='certified'}/>}
    </main>
    <SiteFooter base="../"/>
  </div>;
}

function Achievements({progress,resume}){
  const complete=allComplete(progress);
  return <div className="pg-achievements-page">
    <a className="pg-back-link" href="#"><ArrowLeft size={16}/>All lessons</a>
    <div className="pg-masthead"><span className="pg-eyebrow pg-eyebrow-blue pg-effort-note"><span aria-hidden="true">👀</span>Your effort has been noted.</span><h1 className="pg-h1">The credential collection.</h1><p className="pg-lead">Actual learning. Downloadable proof. {progress.completedChapters.length} of 5 stickers earned.</p></div>
    <div className="pg-achievement-grid">{CHAPTERS.map(c=>{const earned=progress.completedChapters.includes(c.id);return <section key={c.id} className={`pg-achievement${earned ? ' is-earned' : ''}`}><span className="pg-eyebrow">Lesson {c.number} · {c.title}</span>{earned ? <StickerDownload number={c.number}/> : <><div className="pg-locked-art"><Sticker number={c.number}/></div><span className="pg-locked-label"><LockKeyhole size={16} aria-hidden="true"/><span>Complete lesson {c.number} to unlock</span></span></>}<h2>{REWARDS[c.number-1].name}</h2></section>;})}</div>
    <section className="pg-certificate-unlock"><Award size={34}/><div><h2>Certificate of Professional Effort</h2><p>{complete ? 'Five lessons. One highly shareable qualification.' : 'Complete all five lessons to unlock your certificate and graduation single.'}</p></div><a className="pg-btn" href={complete ? '#/certified' : `#/${resume.id}`}>{complete ? 'View my certificate' : 'Keep learning'}<ArrowRight size={16}/></a></section>
  </div>;
}

export function Certificate({progress,update}){
  const art=useRef(null), [status,setStatus]=useState(''), [name,setName]=useState(progress.userName || 'Aspiring Thought Leader');
  const displayName=certificateName(name);
  const download=async()=>{setStatus('Preparing your certificate…');try{await downloadArt(art.current,'linkedin-beats-certificate-of-professional-effort.png');setStatus('Certificate downloaded.');}catch{setStatus('Download unavailable. Use Print / save PDF instead.');}};
  return <div className="pg-certificate-page">
    <GraduationConfetti/>
    <div className="pg-graduation-topline"><span><Check size={16}/>All five lessons complete</span><a href="../">Back to LinkedIn Beats<ArrowRight size={16}/></a></div>
    <div className="pg-masthead"><span className="pg-eyebrow pg-eyebrow-blue pg-effort-note"><span aria-hidden="true">👀</span>Your effort has been noted.</span><h1 className="pg-h1">Make it official.</h1><p className="pg-lead">You came. You learned. You strategically aligned.</p></div>
    <div className="pg-certificate-controls"><label><span className="pg-eyebrow">Name on your certificate</span><input value={name} maxLength={60} onChange={e=>setName(e.target.value)} onBlur={()=>update({userName:displayName})}/></label><div className="pg-row"><CertificateShare name={displayName}/><button className="pg-pill" onClick={download}><Download size={16}/>Download</button><button className="pg-pill" onClick={()=>window.print()}><Printer size={16}/>Print / save PDF</button></div></div>
    <p className="pg-download-status" role="status">{status}</p>
    <p className="pg-certificate-share-note" id="pg-certificate-share-note">Preview your certificate, add a caption, and publish to your LinkedIn feed.</p>
    <CertificateArt name={displayName} svgRef={art}/>
    <section className="pg-collection"><div className="pg-course-heading"><h2>The complete collection</h2><span className="pg-eyebrow">5 / 5 earned</span></div><div className="pg-sticker-collection">{REWARDS.map((r,i)=><StickerDownload key={r.name} number={i+1}/>)}</div></section>
    <GraduationSingle post={progress.posts.single} artist={displayName}/>
    <div className="pg-graduation-exit lb-pixel-divided"><PixelDivider edge/><div><strong>Your work here is done.</strong><p>Your audience awaits. The band is warming up.</p></div><a className="pg-btn" href="../">Explore LinkedIn Beats<ArrowRight size={16}/></a></div>
  </div>;
}
function StickerDownload({number}){
  const ref=useRef(null);
  return <div className="pg-badge-collection-item"><Sticker number={number} svgRef={ref}/><BadgeDownloads number={number} svgRef={ref} compact/></div>;
}
