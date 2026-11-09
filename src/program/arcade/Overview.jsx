import React from 'react';
import {CHAPTERS} from '../chapters/index.js';
import {LESSON_PRESENTATION} from '../chapters/presentation.js';
import {PegText,PegIcon,DotArrow,CourseDots,PreviewCertificate} from './Artwork.jsx';
const descriptions=['Make the first line worth the second.','Turn an update into an announcement.','Become fluent in synergy.','Master the strategic line break.','Write your post. Drop your beat.'];
export function AcademyOverview({progress,resume,lockedCertificate}){
 const complete=CHAPTERS.every(c=>progress.completedChapters.includes(c.id));
 const started=progress.completedChapters.length>0||!!progress.lessonDrafts?.hook;
 const target=complete?'certified':resume.id;
 return <div className="ac-overview">
 {lockedCertificate&&<p className="ac-notice">Your certificate is waiting. Finish all five lessons to make it official.</p>}
 <section className="ac-intro" aria-labelledby="ac-title"><div className="ac-intro-copy"><h1 id="ac-title" aria-label="Make it official."><PegText text="MAKE IT" face="peg3" className="ac-title-kicker"/><PegText text="OFFICIAL." face="peg9" className="ac-title-official"/></h1><p>Five short lessons. One deeply<br className="ac-desktop-break"/> unnecessary credential.</p><a className="ac-primary" href={`#/${target}`}>{complete?'VIEW MY CERTIFICATE':started?'CONTINUE LEARNING':'START LEARNING'}<DotArrow/></a><span className="ac-duration">25 minutes · Self-paced</span></div><div className="ac-certificate-stage"><PreviewCertificate/></div></section>
 <div className="ac-course-status"><CourseDots completed={progress.completedChapters} current={complete?undefined:resume.number-1}/><aside className="ac-instructor" aria-label="Your instructor, Synergy"><img src="/learn/art/synergy-tip-v2.webp" width="68" height="68" alt="Synergy, your robot instructor"/><div><span>Synergy, your instructor</span><p>Doing good work is great.<br/>Announcing it is <em>scalable.</em></p></div></aside></div>
 <nav className="ac-curriculum" aria-label="Your curriculum">{CHAPTERS.map((chapter,i)=>{const done=progress.completedChapters.includes(chapter.id),next=!done&&chapter.id===resume.id;return <a key={chapter.id} href={`#/${chapter.id}`} style={{'--lesson-color':LESSON_PRESENTATION[chapter.id].accent}} className={`ac-module${next?' is-next':''}${done?' is-done':''}`}><PegIcon name={chapter.id}/><PegText className="ac-module-number" text={`0${chapter.number}`}/><span className="ac-module-copy"><strong>{chapter.title}</strong><span>{descriptions[i]}</span></span><span className="ac-module-time">{done?'✓':`${chapter.minutes} min`}<span className="pg-sr-only">{done?' Complete. Review lesson.':''}</span></span><DotArrow/></a>;})}</nav>
 <a className="ac-credentials-link" href="#/achievements"><PegIcon/>Your credentials<DotArrow/></a>
 <p className="ac-fineprint">Independent parody. Practice posts stay private. Progress is saved in this browser.</p>
 </div>;
}
export function LessonNavigation({chapter,completed}){return <div className="ac-lesson-nav"><a href="#"><DotArrow back/>All lessons</a><span>{String(chapter.number).padStart(2,'0')} / {chapter.title.toUpperCase()}</span><CourseDots compact completed={completed} current={chapter.number-1}/></div>;}
