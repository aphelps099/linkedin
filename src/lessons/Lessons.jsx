import React, {useMemo,useRef,useState,useEffect} from 'react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import '../home-2/header.css';
import {Check,Copy,MessageSquarePlus,Minus} from 'lucide-react';
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
import {decodeRecipe} from '../post-beat/composition.js';

const TABS=[['announce','Announce'],['lesson','Find a lesson'],['sell','Sell'],['urgency','Create urgency'],['ai','Talk AI']];
const MAX_SUPERCHARGES=3;
async function copyText(text){
  try{await navigator.clipboard.writeText(text);}
  catch{const field=document.createElement('textarea');field.value=text;document.body.appendChild(field);field.select();try{if(!document.execCommand('copy'))throw new Error('Copy unavailable');}finally{field.remove();}}
}
export default function Lessons(){
  const [catId,setCatId]=useState('announce');
  const [sharedRecipe,setSharedRecipe]=useState(()=>decodeRecipe(window.location.hash));
  const [beatMode,setBeatMode]=useState(!!sharedRecipe);
  useEffect(()=>{const load=()=>setSharedRecipe(decodeRecipe(window.location.hash));window.addEventListener('hashchange',load);return ()=>window.removeEventListener('hashchange',load);},[]);
  const [drafts,setDrafts]=useState(()=>Object.fromEntries(Object.entries(DEFAULT_ANSWERS).map(([k,v])=>[k,{...v}])));
  const [seed,setSeed]=useState(newSeed);
  const [isSupercharged,setIsSupercharged]=useState(false),[turboSeed,setTurboSeed]=useState(null);
  const [contextOpen,setContextOpen]=useState(false);
  const [copyStatus,setCopyStatus]=useState(''),[status,setStatus]=useState('');
  const [isCharging,setIsCharging]=useState(false),[boostCount,setBoostCount]=useState(0);
  const copied=copyStatus==='Copied ✓';
  const fullyCharged=isSupercharged&&boostCount>=MAX_SUPERCHARGES&&!isCharging;
  const variants=useRef({}),copyTimer=useRef(null),outputRef=useRef(null),chargeTimer=useRef(null);
  useEffect(()=>()=>{clearTimeout(copyTimer.current);clearTimeout(chargeTimer.current);},[]);
  const answers=drafts[catId],cat=byId(catId),steps=cat.steps(answers);
  const primaryKeys=sentenceParts(catId,answers).filter(p=>typeof p!=='string').map(p=>Array.isArray(p)?p[0]:p.key);
  const extra=steps.filter(s=>s.type!=='choice'&&!primaryKeys.includes(s.key));
  const choices=steps.filter(s=>s.type==='choice');
  const firstVersion=useMemo(()=>generateStage({category:catId,answers,seed}),[catId,answers,seed]);
  const turboVersion=useMemo(()=>isSupercharged?generateStage({category:catId,answers,seed:turboSeed??seed,stage:'supercharged',minimumScore:firstVersion.score.index}):null,[catId,answers,seed,turboSeed,isSupercharged,firstVersion]);
  const {text,score}=turboVersion||firstVersion;
  const paras=text.split(/\n{2,}/);
  useEffect(()=>{setCopyStatus('');clearTimeout(copyTimer.current);},[text]);
  const resetStage=()=>{setSharedRecipe(null);setBeatMode(false);if(window.location.hash.startsWith('#mix='))history.replaceState(null,'',window.location.pathname+window.location.search);clearTimeout(chargeTimer.current);setIsCharging(false);setIsSupercharged(false);setTurboSeed(null);setBoostCount(0);};
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
  if(sharedRecipe)return <div className="ll-app c2-home">
    <ConceptHeader base="../" homeSectionBase="../" active="LinkedInifier"/>
    <main className="pb-shared"><div className="pb-shared-inner"><p className="pb-shared-eyebrow">A LITTLE PROFESSIONAL DEVELOPMENT.</p><h1>Your words.<br/>On repeat.</h1><PostBeat key={JSON.stringify(sharedRecipe)} post="" initialRecipe={sharedRecipe}/><a className="pb-make-own" href="./">Make your own beat ↗</a></div></main>
    <ConceptFooter base="../"/>
  </div>;
  return <div className="ll-app c2-home">
    <a className="ll-skip" href="#lessons-main">Skip to the editor</a>
    <ConceptHeader base="../" homeSectionBase="../" active="LinkedInifier"/>
    <main id="lessons-main">
      <div className="el-toolbar">
        <h1 className="el-emblem"><span className="el-sr">Get LinkedInified</span><img src="../lessons/get-linkedinified.svg" width="500" height="112" alt="" aria-hidden="true"/></h1>
        <div className="el-categories" role="group" aria-label="Post type">{TABS.map(([id,label])=><button type="button" key={id} aria-pressed={id===catId} onClick={()=>pick(id)}>{label}</button>)}</div>
      </div>
      <div className="el-workspace">
      <section className="el-controls" aria-label="Supercharge your post">
        <div className="el-boost-control">
        <button type="button" className="el-supercharge" onClick={fullyCharged?copy:supercharge} disabled={isCharging} aria-busy={isCharging} aria-describedby={fullyCharged?'charge-handoff':undefined} title={fullyCharged?'Copy your post to the clipboard':isSupercharged?'Generate another supercharged version':'Give this post the full LinkedIn treatment'}>
          <span key={boostCount} className={`el-boost-face${isCharging?' is-fired':''}`}>
            {fullyCharged?(copied?<Check className="el-boost-action-icon" aria-hidden="true"/>:<Copy className="el-boost-action-icon" aria-hidden="true"/>):<svg className="el-boost-bolt" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0H24L15 12H23L3 32L8 18H0Z" fill="currentColor"/></svg>}
            <span className="el-boost-label">{fullyCharged?(copied?'Copied':'Copy post'):'Supercharge'}</span>
            <span className="el-boost-stripes" aria-hidden="true"><i/><i/><i/></span>
          </span>
        </button>
        </div>
        <ScoreReadout key={`score-${boostCount}`} score={score} charging={isCharging} supercharged={isSupercharged} baseline={firstVersion.score.index}/>
        <p id="charge-handoff" className={fullyCharged?'el-charge-complete':'el-sr'} role="status">{fullyCharged&&<><strong>You’re all charged up.</strong><span>{copied?'Copied. Paste it into LinkedIn.':copyStatus.startsWith('Copy unavailable')?copyStatus:'Copy your post, then paste it into LinkedIn.'}</span></>}</p>
      </section>
        <section className={`el-facts${isCharging?' is-feeding':''}`} aria-labelledby="facts-title">
          <h2 className="el-eyebrow" id="facts-title">WHAT ACTUALLY HAPPENED?</h2>
          {choices.length>0&&<div className="el-choices">{choices.map(s=><fieldset key={`${catId}-${s.key}`}>
            <legend className={choices.length===1?'el-sr':''}>{s.key==='source'?'Inspired by':s.key==='topic'?'Related to':s.ask}</legend>
            <div className="el-choice-pills">{s.options.map(o=><button type="button" key={o} aria-pressed={(answers[s.key]||s.options[0])===o} onClick={()=>update(s.key,o)}>{o}</button>)}</div>
          </fieldset>)}</div>}
          <div className="el-printer-slot" aria-hidden="true"/>
          <div className="el-receipt">
          <Sentence catId={catId} answers={answers} steps={steps} onChange={update}/>
          <div className="el-fact-actions">{extra.length>0?<button aria-expanded={contextOpen} aria-controls="extra-context" onClick={()=>setContextOpen(!contextOpen)}>{contextOpen?<Minus aria-hidden="true"/>:<MessageSquarePlus aria-hidden="true"/>}<span>{contextOpen?'Less context':'Add context'}</span></button>:<span/>}<button onClick={example}><span>Try an example</span></button></div>
          {extra.length>0&&contextOpen&&<div className="el-context" id="extra-context">{extra.map(s=><label key={s.key} htmlFor={`context-${s.key}`}>{s.ask}<input id={`context-${s.key}`} name={s.key} value={answers[s.key]||''} placeholder={s.placeholder} maxLength={300} onChange={e=>update(s.key,e.target.value)}/></label>)}</div>}
          <p className="el-hint">Your facts. Fresh off the printer.</p>
          </div>
          <p className="el-sr" role="status">{status}</p>
        </section>
        <section className="el-output" aria-labelledby="output-title" ref={outputRef} tabIndex={-1}>
          <h2 className="el-eyebrow" id="output-title"><i/>{beatMode?'YOUR WORDS. ON REPEAT.':isSupercharged?'THE SUPERCHARGED VERSION':'THE LINKEDIN VERSION'}</h2>
          <PostBeat key={sharedRecipe?JSON.stringify(sharedRecipe):text} post={text} initialRecipe={sharedRecipe} onModeChange={setBeatMode}>
          <div className="el-post" aria-label={isSupercharged?'Your supercharged post':'Your LinkedIn post'}><p className={`el-post-lead ${paras[0].length>100?'is-long':''}`}>{paras[0]}</p>{paras.slice(1).map((p,i)=><p key={i}>{p}</p>)}</div>
          </PostBeat>
          <div className="el-output-actions"><button className={`el-copy${copied?' is-copied':''}`} onClick={copy} aria-label={copied?'Copied to clipboard':'Copy to clipboard'} title={copied?'Copied!':'Copy to clipboard'}>{copied?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}</button><button onClick={regenerate}>Try another</button>{isSupercharged&&<button onClick={()=>{resetStage();setStatus('Showing the first LinkedIn version.');}}>View first version</button>}</div>
          <p className={copyStatus.startsWith('Copy unavailable')?'el-copy-status':'el-sr'} role={fullyCharged?undefined:'status'}>{copyStatus}</p>
        </section>
      </div>

    </main><ConceptFooter base="../"/>
  </div>;
}
