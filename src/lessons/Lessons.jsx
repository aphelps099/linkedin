import React, {useMemo,useRef,useState,useEffect} from 'react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import '../home-2/header.css';
import {Footer} from '../brand/Footer.jsx';
import {byId} from './categories.js';
import {DEFAULT_ANSWERS,EXAMPLES,ANNOUNCEMENT_EXAMPLES} from './Intake.jsx';
import {Sentence,sentenceParts} from './Sentence.jsx';
import {LEVELS,generate,roast,newSeed} from './generator.js';
import {scorePost} from './score.js';

const TABS=[['announce','Announce'],['lesson','Find a lesson'],['sell','Sell'],['urgency','Create urgency'],['ai','Talk AI']];
async function copyText(text){
  try{await navigator.clipboard.writeText(text);}
  catch{const field=document.createElement('textarea');field.value=text;document.body.appendChild(field);field.select();try{if(!document.execCommand('copy'))throw new Error('Copy unavailable');}finally{field.remove();}}
}
export default function Lessons(){
  const [catId,setCatId]=useState('announce');
  const [drafts,setDrafts]=useState(()=>Object.fromEntries(Object.entries(DEFAULT_ANSWERS).map(([k,v])=>[k,{...v}])));
  const [level,setLevel]=useState(3),[seed,setSeed]=useState(newSeed),[flags,setFlags]=useState({});
  const [contextOpen,setContextOpen]=useState(false),[toolsOpen,setToolsOpen]=useState(false),[roastOpen,setRoastOpen]=useState(false);
  const [copyStatus,setCopyStatus]=useState(''),[status,setStatus]=useState('');
  const variants=useRef({}),copyTimer=useRef(null),outputRef=useRef(null);
  useEffect(()=>()=>clearTimeout(copyTimer.current),[]);
  const answers=drafts[catId],cat=byId(catId),steps=cat.steps(answers);
  const primaryKeys=sentenceParts(catId,answers).filter(p=>typeof p!=='string').map(p=>Array.isArray(p)?p[0]:p.key);
  const extra=steps.filter(s=>s.type!=='choice'&&!primaryKeys.includes(s.key));
  const choices=steps.filter(s=>s.type==='choice');
  const text=useMemo(()=>generate({category:catId,answers,level,seed,flags}),[catId,answers,level,seed,flags]);
  const paras=text.split(/\n{2,}/),score=useMemo(()=>scorePost(text),[text]);
  const roastLines=useMemo(()=>roastOpen?roast(text,{score:score.index}):[],[roastOpen,text,score.index]);
  useEffect(()=>{setCopyStatus('');clearTimeout(copyTimer.current);},[text]);
  const update=(key,value)=>{
    if(catId==='announce'&&key==='kind'&&value!==answers.kind){
      variants.current[answers.kind]={...answers};
      setDrafts(d=>({...d,announce:variants.current[value]||{kind:value,company:answers.company||''}}));
    }else setDrafts(d=>({...d,[catId]:{...d[catId],[key]:value}}));
    setStatus('');
  };
  const pick=id=>{setCatId(id);setContextOpen(false);setToolsOpen(false);setRoastOpen(false);setFlags({});setStatus('');};
  const example=()=>{setDrafts(d=>({...d,[catId]:{...(catId==='announce'?ANNOUNCEMENT_EXAMPLES[answers.kind]:EXAMPLES[catId])}}));setStatus('Example loaded. Edit the blue words to make it yours.');};
  const regenerate=(focus=false)=>{setSeed(newSeed());setStatus('A fresh version, at the same LinkedInification level.');if(focus&&window.innerWidth<800){outputRef.current?.focus({preventScroll:true});outputRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}};
  const copy=async()=>{try{await copyText(text);setCopyStatus('Copied ✓');clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopyStatus(''),1800);}catch{setCopyStatus('Copy unavailable. Select the post text to copy it.');}};
  return <div className="ll-app c2-home">
    <a className="ll-skip" href="#lessons-main">Skip to the editor</a>
    <ConceptHeader base="../" homeSectionBase="../" active="LinkedInifier"/>
    <main id="lessons-main">
      <div className="el-toolbar">
        <h1>The LinkedInifier<span aria-hidden="true">.</span></h1>
        <div className="el-categories" role="group" aria-label="Post type">{TABS.map(([id,label])=><button type="button" key={id} aria-pressed={id===catId} onClick={()=>pick(id)}>{label}</button>)}</div>
      </div>
      <div className="el-workspace">
      <section className="el-controls" aria-label="LinkedInification controls">
        <div className="el-level-label"><label htmlFor="linkedinification">LinkedInification</label><output htmlFor="linkedinification">{String(level).padStart(2,'0')}</output><span>{LEVELS[level-1].name}</span></div>
        <div className="el-slider"><input id="linkedinification" type="range" min="1" max="5" step="1" value={level} aria-valuetext={`${level}: ${LEVELS[level-1].name}`} style={{'--level':`${(level-1)*25}%`}} onChange={e=>setLevel(Number(e.target.value))}/><div><span>Actually human</span><span>Absolutely insufferable</span></div></div>
        <button className="el-supercharge" onClick={()=>regenerate(true)}><span aria-hidden="true">↗</span>Supercharge</button>
      </section>
        <section className="el-facts" aria-labelledby="facts-title">
          <h2 className="el-eyebrow" id="facts-title"><i/>THE ACTUAL EVENT</h2>
          {choices.length>0&&<div className="el-choices">{choices.map(s=><fieldset key={`${catId}-${s.key}`}>
            <legend className={choices.length===1?'el-sr':''}>{s.key==='source'?'Inspired by':s.key==='topic'?'Related to':s.ask}</legend>
            <div className="el-choice-pills">{s.options.map(o=><button type="button" key={o} aria-pressed={(answers[s.key]||s.options[0])===o} onClick={()=>update(s.key,o)}>{o}</button>)}</div>
          </fieldset>)}</div>}
          <Sentence catId={catId} answers={answers} steps={steps} onChange={update}/>
          <div className="el-fact-actions">{extra.length>0?<button aria-expanded={contextOpen} aria-controls="extra-context" onClick={()=>setContextOpen(!contextOpen)}>{contextOpen?'− Less context':'+ Add context'}</button>:<span/>}<button onClick={example}>Try an example ↗</button></div>
          {extra.length>0&&contextOpen&&<div className="el-context" id="extra-context">{extra.map(s=><label key={s.key} htmlFor={`context-${s.key}`}>{s.ask}<input id={`context-${s.key}`} name={s.key} value={answers[s.key]||''} placeholder={s.placeholder} maxLength={300} onChange={e=>update(s.key,e.target.value)}/></label>)}</div>}
          <p className="el-hint">Click the blue words. Tell the boring truth.</p>
          <p className="el-sr" role="status">{status}</p>
        </section>
        <section className="el-output" aria-labelledby="output-title" ref={outputRef} tabIndex={-1}>
          <h2 className="el-eyebrow" id="output-title"><i/>THE LINKEDIN VERSION</h2>
          <div className="el-post" aria-label="Your supercharged post"><p className={`el-post-lead ${paras[0].length>100?'is-long':''}`}>{paras[0]}</p>{paras.slice(1).map((p,i)=><p key={i}>{p}</p>)}</div>
          <div className="el-output-actions"><button className="el-copy" onClick={copy}>{copyStatus==='Copied ✓'?copyStatus:'Copy post ↗'}</button><button onClick={()=>regenerate()}>Try another</button><button aria-expanded={toolsOpen} aria-controls="post-tools" onClick={()=>setToolsOpen(!toolsOpen)}>{toolsOpen?'Fewer tools':'More tools +'}</button></div>
          <p className="el-copy-status" role="status">{copyStatus}</p>
          {toolsOpen&&<div className="el-tools" id="post-tools">
            <div className="el-modifiers"><button onClick={()=>setLevel(l=>Math.min(5,l+1))} disabled={level===5}>Make it worse</button><button onClick={()=>setLevel(1)}>Make it human</button><button onClick={()=>setFlags(f=>({...f,synergy:(f.synergy||0)+1}))}>Add more synergy{flags.synergy?` ×${flags.synergy}`:''}</button><button aria-pressed={!!flags.struggle} onClick={()=>setFlags(f=>({...f,struggle:!f.struggle}))}>Add a struggle</button><button aria-pressed={!!flags.founder} onClick={()=>setFlags(f=>({...f,founder:!f.founder}))}>Founder voice</button><button aria-expanded={roastOpen} onClick={()=>setRoastOpen(!roastOpen)}>Roast this post</button><a href={`../studio/#beat=${encodeURIComponent(text)}`}>Turn it into a beat ♫</a><button onClick={()=>setFlags({})}>Reset extras</button></div>
            {roastOpen&&<div className="el-roast"><h3>The roast</h3>{roastLines.map((line,i)=><p key={i}>{line}</p>)}</div>}
            <details className="el-diagnostics"><summary>Post diagnostics · {score.words} words</summary><dl>{[['Thought Leadership Index',`${score.index} / ${score.rank}`],['Humble-brag score',`${score.humbleBrag}%`],['Buzzword density',`${score.buzzDensity} per 100 words`],['Gratitude inflation',`${score.gratitude} · ${score.gratitudeLabel}`],['Dramatic one-liners',score.oneLiners],['Journey references',score.journeys],['Chance of “Well deserved!”',`${score.wellDeserved}%`]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
          </div>}
        </section>
      </div>

    </main><Footer/>
  </div>;
}
