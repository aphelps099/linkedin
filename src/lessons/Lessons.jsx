import React, {useMemo,useRef,useState,useEffect} from 'react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import '../home-2/header.css';
import {Check,Copy,Globe,MessageSquarePlus,Minus,UserRound,ArrowDown} from 'lucide-react';
import {ConceptFooter} from '../home-2/ConceptFooter.jsx';
import '../home-2/footer.css';
import {byId} from './categories.js';
import {DEFAULT_ANSWERS,EXAMPLES,ANNOUNCEMENT_EXAMPLES} from './Intake.jsx';
import {Sentence,sentenceParts} from './Sentence.jsx';
import {newSeed} from './generator.js';
import {generateStage} from './stages.js';
import {ScoreReadout} from './ScoreReadout.jsx';
import './ignition.css';
import {PostBeat} from '../post-beat/PostBeat.jsx';
import {readSharedBeat,coverPreviewUrl} from '../post-beat/share.js';
import './ticket.css';
import './rows.css';

const TABS=[['announce','Announce'],['lesson','Find a lesson'],['sell','Sell'],['urgency','Create urgency'],['ai','Talk AI']];
const MAX_SUPERCHARGES=3;
async function copyText(text){
  try{await navigator.clipboard.writeText(text);}
  catch{const field=document.createElement('textarea');field.value=text;document.body.appendChild(field);field.select();try{if(!document.execCommand('copy'))throw new Error('Copy unavailable');}finally{field.remove();}}
}
function PostPreview({text,supercharged}){
  const [expanded,setExpanded]=useState(false);
  const canExpand=text.length>460;
  const visible=canExpand&&!expanded?text.slice(0,460).replace(/\s+\S*$/, '')+'…':text;
  return <div className="el-post" aria-label={supercharged?'Your supercharged post':'Your LinkedIn post'}>
    {visible.split(/\n{2,}/).map((p,i)=><p key={i} className={i===0?'el-post-lead':p.startsWith('#')?'el-post-tags':undefined}>{p}</p>)}
    {canExpand&&<button className="el-post-expand" type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'…see more'}</button>}
  </div>;
}
export default function Lessons(){
  const [catId,setCatId]=useState('announce');
  const [sharedRecipe,setSharedRecipe]=useState(()=>readSharedBeat(window.location.href)?.recipe||null);
  const sharedCover=sharedRecipe?readSharedBeat(window.location.href)?.cover:null;
  useEffect(()=>{const load=()=>setSharedRecipe(readSharedBeat(window.location.href)?.recipe||null);window.addEventListener('hashchange',load);return ()=>window.removeEventListener('hashchange',load);},[]);
  const [drafts,setDrafts]=useState(()=>Object.fromEntries(Object.entries(DEFAULT_ANSWERS).map(([k,v])=>[k,{...v}])));
  const [seed,setSeed]=useState(newSeed);
  const [isSupercharged,setIsSupercharged]=useState(false),[turboSeed,setTurboSeed]=useState(null);
  const [contextOpen,setContextOpen]=useState(false);
  const [copyStatus,setCopyStatus]=useState(''),[status,setStatus]=useState('');
  const [isCharging,setIsCharging]=useState(false),[boostCount,setBoostCount]=useState(0);
  const copied=copyStatus==='Copied ✓';
  const fullyCharged=isSupercharged&&boostCount>=MAX_SUPERCHARGES&&!isCharging;
  const variants=useRef({}),copyTimer=useRef(null),outputRef=useRef(null),chargeTimer=useRef(null);
  const boostButton=useRef(null),restoreBoostFocus=useRef(false);
  useEffect(()=>{if(!isCharging&&restoreBoostFocus.current){if(document.activeElement===document.body||document.activeElement===outputRef.current)boostButton.current?.focus({preventScroll:true});restoreBoostFocus.current=false;}},[isCharging]);
  useEffect(()=>()=>{clearTimeout(copyTimer.current);clearTimeout(chargeTimer.current);},[]);
  const answers=drafts[catId],cat=byId(catId),steps=cat.steps(answers);
  const primaryKeys=sentenceParts(catId,answers).filter(p=>typeof p!=='string').map(p=>Array.isArray(p)?p[0]:p.key);
  const extra=steps.filter(s=>s.type!=='choice'&&!primaryKeys.includes(s.key));
  const choices=steps.filter(s=>s.type==='choice');
  const firstVersion=useMemo(()=>generateStage({category:catId,answers,seed}),[catId,answers,seed]);
  const turboVersion=useMemo(()=>isSupercharged?generateStage({category:catId,answers,seed:turboSeed??seed,stage:'supercharged',minimumScore:firstVersion.score.index}):null,[catId,answers,seed,turboSeed,isSupercharged,firstVersion]);
  const {text,score}=turboVersion||firstVersion;
  useEffect(()=>{setCopyStatus('');clearTimeout(copyTimer.current);},[text]);
  const resetStage=()=>{setSharedRecipe(null);if(window.location.hash.startsWith('#mix='))history.replaceState(null,'',window.location.pathname+window.location.search);clearTimeout(chargeTimer.current);setIsCharging(false);setIsSupercharged(false);setTurboSeed(null);setBoostCount(0);};
  const update=(key,value)=>{
    resetStage();
    if(catId==='announce'&&key==='kind'&&value!==answers.kind){
      variants.current[answers.kind]={...answers};
      setDrafts(d=>({...d,announce:variants.current[value]||{kind:value,company:answers.company||''}}));
    }else setDrafts(d=>({...d,[catId]:{...d[catId],[key]:value}}));
    setStatus('');
  };
  const pick=id=>{resetStage();setCatId(id);setContextOpen(false);setStatus('');};
  const example=()=>{resetStage();setDrafts(d=>({...d,[catId]:{...(catId==='announce'?ANNOUNCEMENT_EXAMPLES[answers.kind]:EXAMPLES[catId])}}));setStatus('Example loaded. Edit the blue words to make it yours.');};
  const regenerate=()=>{setSharedRecipe(null);clearTimeout(chargeTimer.current);setIsCharging(false);setBoostCount(0);if(isSupercharged)setTurboSeed(newSeed());else setSeed(newSeed());setStatus(isSupercharged?'A fresh supercharged version is ready.':'A fresh LinkedIn version is ready.');};
  const supercharge=()=>{
    restoreBoostFocus.current=document.activeElement===boostButton.current;
    setSharedRecipe(null);
    const completesCharge=boostCount+1>=MAX_SUPERCHARGES;
    clearTimeout(chargeTimer.current);setBoostCount(n=>n+1);setIsCharging(true);
    if(isSupercharged)setTurboSeed(newSeed());
    setIsSupercharged(true);setStatus('Supercharged. The full LinkedIn treatment is ready.');
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    chargeTimer.current=setTimeout(()=>{
      setIsCharging(false);
      if(completesCharge)setStatus('');
      if(!completesCharge&&window.innerWidth<800){outputRef.current?.focus({preventScroll:true});outputRef.current?.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});}
    },reducedMotion?0:1100);
  };
  const copy=async()=>{try{await copyText(text);setCopyStatus('Copied ✓');clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopyStatus(''),1800);}catch{setCopyStatus('Copy unavailable. Select the post text to copy it.');}};
  const boostControl=<div className="el-boost-control">
    <button ref={boostButton} type="button" className="el-supercharge" onClick={fullyCharged?copy:supercharge} disabled={isCharging} aria-busy={isCharging} aria-describedby={fullyCharged?'charge-handoff':undefined} title={fullyCharged?'Copy your post to the clipboard':isSupercharged?'Generate another supercharged version':'Give this post the full LinkedIn treatment'}>
      <span key={boostCount} className={`el-boost-face${isCharging?' is-fired':''}`}>
        {fullyCharged?(copied?<Check className="el-boost-action-icon" aria-hidden="true"/>:<Copy className="el-boost-action-icon" aria-hidden="true"/>):<svg className="el-boost-bolt" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0H24L15 12H23L3 32L8 18H0Z" fill="currentColor"/></svg>}
        <span className="el-boost-label">{fullyCharged?(copied?'Copied':'Copy post'):'Supercharge'}</span>
        <span className="el-boost-stripes" aria-hidden="true"><i/><i/><i/></span>
      </span>
    </button>
  </div>;
  if(sharedRecipe)return <div className="ll-app ll-rows c2-home">
    <ConceptHeader base="../" homeSectionBase="../" active="LinkedInifier"/>
    <main className="pb-shared"><div className="pb-shared-inner"><p className="pb-shared-eyebrow">A LITTLE PROFESSIONAL DEVELOPMENT.</p>{sharedCover&&<img className="pb-shared-cover" src={coverPreviewUrl(window.location.origin,sharedRecipe,sharedCover.id,readSharedBeat(window.location.href)?.artist)} width={1200} height={630} alt={sharedRecipe.chorus}/>}<h1 className="pb-shared-title">{sharedRecipe.chorus}</h1><p className="pb-shared-chorus">“{sharedRecipe.chorus}”</p><PostBeat key={JSON.stringify(sharedRecipe)} post="" initialRecipe={sharedRecipe} initialCover={sharedCover?.id} initialArtist={readSharedBeat(window.location.href)?.artist}/><a className="pb-make-own" href="/lessons/">Make your own beat ↗</a></div></main>
    <ConceptFooter base="../"/>
  </div>;
  return <div className="ll-app ll-rows c2-home">
    <a className="ll-skip" href="#lessons-main">Skip to the editor</a>
    <ConceptHeader base="../" homeSectionBase="../" active="LinkedInifier"/>
    <main id="lessons-main">
      <div className="el-toolbar">
        <h1 className="el-emblem"><span className="el-sr">Get LinkedInified</span><img src="../lessons/get-linkedinified.svg" width="500" height="112" alt="" aria-hidden="true"/></h1>
        <div className="el-categories" role="group" aria-label="Post type">{TABS.map(([id,label])=><button type="button" key={id} aria-pressed={id===catId} onClick={()=>pick(id)}>{label}</button>)}</div>
      </div>
      <div className="el-workspace">
        <section className={`el-facts${isCharging?' is-feeding':''}`} aria-labelledby="facts-title">
          <div className="el-row-heading"><div><span className="el-step-label">01 / THE FACTS</span><h2 id="facts-title">What actually happened?</h2></div><p>Start small. We’ll make it sound significant.</p></div>
          {choices.length>0&&<div className="el-choices">{choices.map(s=><fieldset key={`${catId}-${s.key}`}>
            <legend className={choices.length===1?'el-sr':''}>{s.key==='source'?'Inspired by':s.key==='topic'?'Related to':s.ask}</legend>
            <div className="el-choice-pills">{s.options.map(o=><button type="button" key={o} aria-pressed={(answers[s.key]||s.options[0])===o} onClick={()=>update(s.key,o)}>{o}</button>)}</div>
          </fieldset>)}</div>}
          <div className="el-receipt">
          <Sentence catId={catId} answers={answers} steps={steps} onChange={update}/>
          <div className="el-fact-actions">{extra.length>0?<button aria-expanded={contextOpen} aria-controls="extra-context" onClick={()=>setContextOpen(!contextOpen)}>{contextOpen?<Minus aria-hidden="true"/>:<MessageSquarePlus aria-hidden="true"/>}<span>{contextOpen?'Less context':'Add context'}</span></button>:<span/>}<button onClick={example}><span>Try an example</span></button></div>
          {extra.length>0&&contextOpen&&<div className="el-context" id="extra-context">{extra.map(s=><label key={s.key} htmlFor={`context-${s.key}`}>{s.ask}<input id={`context-${s.key}`} name={s.key} value={answers[s.key]||''} placeholder={s.placeholder} maxLength={300} onChange={e=>update(s.key,e.target.value)}/></label>)}</div>}
          <div className="el-input-bottom"><p className="el-hint">Edit the blue fields. Your post updates as you type.</p><a className="el-preview-link" href="#post-preview">See your post<ArrowDown size={16} aria-hidden="true"/></a></div>
          </div>
          <p className="el-sr" role="status">{status}</p>
        </section>
        <section id="post-preview" className="el-output" aria-labelledby="output-title" ref={outputRef} tabIndex={-1}>
          <PostBeat key={text} post={text} presentation="post"
            ticketControls={boostControl}
            ticketScore={<ScoreReadout key={`score-${boostCount}`} score={score} label="LinkedInifier score" scaleLabel="/ 100" charging={isCharging} supercharged={isSupercharged} baseline={firstVersion.score.index}/>}
            ticketNotice={<p id="charge-handoff" className={fullyCharged?'el-charge-complete':'el-sr'} role="status">{fullyCharged&&<><strong>You’re all charged up.</strong><span>{copied?'Copied. Paste it into LinkedIn.':copyStatus.startsWith('Copy unavailable')?copyStatus:'Copy your post, then paste it into LinkedIn.'}</span></>}</p>}
            heading={<div className="el-row-heading"><div><span className="el-step-label">02 / THE POST</span><h2 id="output-title">{isSupercharged?'Now that’s thought leadership.':'Ready for the feed.'}</h2></div><p>Your facts. A little more main-character energy.</p></div>}
            postHeader={<header className="el-post-profile"><span className="el-post-avatar" aria-hidden="true"><UserRound/></span><div><strong>You <span>· 1st</span></strong><p>Aspiring thought leader. Open to synergy.</p><small>Just now · <Globe size={12} aria-label="Public post preview"/></small></div><span className="el-preview-tag">POST PREVIEW</span></header>}
            postActions={<div className="el-output-actions"><button className={`el-copy${copied?' is-copied':''}`} onClick={copy}>{copied?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}<span>{copied?'Copied':'Copy post'}</span></button><button onClick={regenerate}>Try another</button>{isSupercharged&&<button onClick={()=>{resetStage();setStatus('Showing the first LinkedIn version.');}}>First version</button>}</div>}>
          <PostPreview text={text} supercharged={isSupercharged}/>
          </PostBeat>
          <p className={copyStatus.startsWith('Copy unavailable')?'el-copy-status':'el-sr'} role={fullyCharged?undefined:'status'}>{copyStatus}</p>
        </section>
      </div>

    </main><ConceptFooter base="../"/>
  </div>;
}
