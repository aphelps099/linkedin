import {PixelDivider} from '../../brand/PixelDivider.jsx';
import React,{useState} from 'react';
import {ThumbsUp} from 'lucide-react';
import {DotArrow,PegIcon} from './Artwork.jsx';
import {LessonReward} from '../components/Rewards.jsx';
import {cleanHookDraft,makeHook} from './hook.js';
import {LessonHero} from './LessonHero.jsx';
import {LESSON_PRESENTATION} from '../chapters/presentation.js';
const tabs=[['example','Example'],['practice','Your turn'],['takeaway','Takeaway']];
export function HookLesson({draft,onDraft,onFinish,onComplete,userName,chapter}){
 const [state,setState]=useState(()=>cleanHookDraft(draft)||{stage:'example',fact:'I made coffee.',post:'',tried:false});
 const [feedback,setFeedback]=useState('');
 const change=patch=>{const next={...state,...patch};setState(next);onDraft(next);};
 const attempt=()=>{if(!state.fact.trim()){setFeedback('Give us one small, true thing that happened.');return;}change({post:makeHook(state.fact),tried:true});setFeedback('A strong opening. Suspiciously ordinary. Edit the preview to make it yours.');};
 const finish=()=>{if(!state.tried||!state.post.trim()){change({stage:'practice'});setFeedback('Try your own opening before collecting the credential.');return;}onFinish('hook');change({stage:'done'});};
 if(state.stage==='done')return <div className="ac-hook ac-hook-complete" style={{'--lesson-accent':LESSON_PRESENTATION.hook.accent}}><LessonHero chapter={chapter}/><LessonReward chapter={chapter} nextTitle="Small News, Big Deal" onContinue={onComplete}/><button className="ac-text-button" onClick={()=>change({stage:'practice'})}>Revisit your hook</button></div>;
 return <article className="ac-hook" style={{'--lesson-accent':LESSON_PRESENTATION.hook.accent}}><LessonHero chapter={chapter} description={<>Give them a reason to tap <strong>…see more.</strong></>}/>
 <div className="ac-tabs" role="tablist" aria-label="Lesson stages">{tabs.map(([id,label],i)=><button key={id} id={`ac-tab-${id}`} type="button" role="tab" aria-selected={state.stage===id} aria-controls="ac-stage" tabIndex={state.stage===id?0:-1} onClick={()=>change({stage:id})} onKeyDown={e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();change({stage:tabs[n][0]});document.getElementById(`ac-tab-${tabs[n][0]}`)?.focus();}}}>{label}</button>)}</div>
 <div id="ac-stage" role="tabpanel" aria-labelledby={`ac-tab-${state.stage}`} tabIndex={0}>
 {state.stage==='takeaway'?<section className="ac-takeaway"><PegIcon name="hook"/><h2>Open a loop.<br/>Then actually close it.</h2><p>A good hook creates a question the post goes on to answer. Keep the detail specific. Save the explanation for the next line.</p><div className="ac-takeaway-note"><strong>The professional hazard</strong><p>If the reveal is only coffee, don’t promise a revolution. Curiosity works. Empty suspense gets old.</p></div>{state.post&&<blockquote>{state.post}</blockquote>}</section>:<div className="ac-exercise-grid">
 <section className="ac-fact-panel"><label htmlFor="ac-fact">What actually happened</label>{state.stage==='example'?<><div className="ac-example-fact">I made coffee.</div><p className="ac-input-hint">Same coffee. Considerably more suspense.</p><p className="ac-example-explain">The opening leaves one question unanswered: <em>why almost?</em> That gives the next line a job to do.</p><button className="ac-primary" onClick={()=>change({stage:'practice'})}>YOUR TURN<DotArrow/></button></>:<><textarea id="ac-fact" value={state.fact} maxLength={400} onChange={e=>change({fact:e.target.value,tried:false})} placeholder="One small thing you did today."/><p className="ac-input-hint">Keep the facts. Withhold the point.</p><button className="ac-primary" onClick={attempt}>TRY MY HOOK<DotArrow/></button></>}</section>
 <section className="ac-post" aria-label="Private practice post"><div className="ac-post-person"><div className="ac-avatar"><PegIcon/></div><div><strong>{userName||'Your name'}</strong><span>Aspiring thought leader</span></div><span className="ac-post-dots" aria-hidden="true">•••</span></div>{state.stage==='practice'&&state.tried?<textarea aria-label="Edit your practice hook" className="ac-post-edit" value={state.post} maxLength={1000} onChange={e=>change({post:e.target.value})}/>:<p className="ac-post-copy">{state.stage==='practice'&&state.post?state.post:'I almost didn’t make coffee today.\n\nHere’s why that matters.'}</p>}<span className="ac-see-more">…see more</span><div className="ac-post-reactions"><ThumbsUp size={21}/><span>Considerable engagement.</span></div></section>
 </div>}
 </div>
 <div className="ac-feedback" role="status"><PegIcon/><p>{feedback||(state.stage==='example'?'A tiny event. An extremely professional entrance.':state.stage==='takeaway'?'Curiosity earned. Now give them the payoff.':'Your next big announcement can start very small.')}</p></div>
 <div className="ac-lesson-bottom lb-pixel-divided"><PixelDivider edge/><span>Progress stays in this browser</span><button className="ac-text-button" onClick={()=>state.stage==='example'?change({stage:'practice'}):state.stage==='practice'?(state.tried&&state.post.trim()?change({stage:'takeaway'}):setFeedback('Try your hook and keep a little text in the preview first.')):finish()}>{state.stage==='takeaway'?'Complete lesson':'Continue'}<DotArrow/></button></div>
 </article>;
}
