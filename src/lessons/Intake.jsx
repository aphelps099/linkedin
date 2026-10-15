import React, {useRef,useState} from 'react';
import {ArrowUpRight, Check} from 'lucide-react';
import {CATEGORIES, byId} from './categories.js';

export const DEFAULT_ANSWERS = {
  announce:{kind:'A new hire'}, lesson:{source:'A tiny everyday moment',topic:'Leadership'},
  sell:{}, urgency:{kind:"We're hiring"}, ai:{}
};
export const EXAMPLES = {
  announce:{kind:'A new hire',name:'Jordan',role:'Director of Vibes',before:'a very long meeting',quality:'an inbox at zero',goal:'make Fridays feel like Fridays',company:'Circle Back Inc.'},
  lesson:{source:'A tiny everyday moment',moment:'The office plant survived a three-day weekend without a strategy deck',lesson:'Sometimes growth just needs a little space',topic:'Leadership'},
  sell:{offer:'meeting reduction consulting',customer:'Alex',problem:'a calendar with no visible white space',result:'42% fewer meetings and one actual lunch break',cta:'Send me the word OFFLINE'},
  urgency:{kind:'Limited spots',thing:'a workshop about having fewer workshops',scarcity:'3 seats and absolutely no breakout rooms',audience:'people who have been on mute since Monday'},
  ai:{tool:'ChatGPT',task:'rewrite a three-word email',multiplier:'10x',doomed:'the phrase per my last email'}
};
export const ANNOUNCEMENT_EXAMPLES={
  'A new hire':EXAMPLES.announce,
  'A promotion':{...EXAMPLES.announce,kind:'A promotion',role:'Senior Director of Vibes'},
  'A product launch':{kind:'A product launch',name:'ReplyAll',goal:'turn every meeting into a three-line email',before:'we wanted our afternoons back',quality:'a very useful mute button',company:'Circle Back Inc.'},
  'A partnership':{kind:'A partnership',name:'Offline & Co.',before:'share one extremely good coffee machine',quality:'perfectly aligned calendars',goal:'make a meeting end on time',company:'Circle Back Inc.'},
  'A company milestone':{kind:'A company milestone',name:'10,000 unread emails',before:'years of ignoring notification badges',quality:'world-class procrastination',goal:'read one of them',company:'Circle Back Inc.'}
};
const LABELS={name:'SUBJECT',role:'NEW TITLE',before:'ORIGIN STORY',quality:'SPECIAL QUALITY',goal:'THE BIG PLAN',company:'COMPANY',moment:'ACTUAL EVENT',lesson:'PROFOUND LESSON',offer:'WHAT YOU SELL',customer:'THE HERO',problem:'THE STRUGGLE',result:'THE MIRACLE',cta:'THE ASK',thing:'THE BIG THING',scarcity:'MANUFACTURED SCARCITY',audience:'TARGET AUDIENCE',tool:'AI TOOL',task:'ACTUAL TASK',multiplier:'PRODUCTIVITY CLAIM',doomed:'DOOMED INDUSTRY'};

function Blank({value,label}){
  return value?.trim()?<mark>{value.trim()}</mark>:<span className="ll-redaction" aria-label={`${label}: not supplied`}>REDACTED</span>;
}
function Statement({catId,a}){
  const b=key=><Blank value={a[key]} label={LABELS[key]||key}/>;
  if(catId==='announce'){
    if(a.kind==='A product launch') return <>We made {b('name')} to {b('goal')}. It has {b('quality')}. This changes everything. Allegedly.</>;
    if(a.kind==='A partnership') return <>{b('company')} and {b('name')} are joining forces to {b('goal')}. The synergy has been documented.</>;
    if(a.kind==='A company milestone') return <>{b('company')} reached {b('name')}. Next up: {b('goal')}. Please clap accordingly.</>;
    return <>{b('name')} is {a.kind==='A promotion'?'being promoted':<>joining {b('company')}</>} as {b('role')}. They bring {b('quality')}. Their mission: {b('goal')}.</>;
  }
  if(catId==='lesson')return <>When {b('moment')}, I learned that {b('lesson')}. Naturally, this is about {a.topic?.toLowerCase()||'leadership'}.</>;
  if(catId==='sell')return <>{b('customer')} had {b('problem')}. Then came {b('offer')}. The result? {b('result')}. This is definitely not an ad.</>;
  if(catId==='urgency')return <>{b('thing')}. Only {b('scarcity')}. Calling all {b('audience')}. Please panic in an orderly fashion.</>;
  return <>I used {b('tool')} to {b('task')}. I am now {b('multiplier')} faster. {b('doomed')} is officially on notice.</>;
}

export function Intake({catId,answers,onPick,onChange,onSubmit}){
  const cat=byId(catId), steps=cat.steps(answers);
  const variantDrafts=useRef({});
  const [reaction,setReaction]=useState('Please complete in plain English. We will take it from there.');
  const complete=steps.filter(s=>answers[s.key]?.trim()).length;
  const update=(step,value)=>{
    if(catId==='announce'&&step.key==='kind'&&value!==answers.kind){variantDrafts.current[answers.kind]={...answers};onChange(variantDrafts.current[value]||{kind:value,company:answers.company||''});}
    else onChange({...answers,[step.key]:value});
    if(step.type==='choice')setReaction(step.react?.(value,{...answers,[step.key]:value})||'Selection noted. The department is aligned.');
  };
  const submit=e=>{e.preventDefault();onSubmit(Object.fromEntries(steps.map(s=>[s.key,(answers[s.key]||'').trim()])));};
  return <>
    <section className="ll-intro"><div><span className="ll-kicker">LINKEDIN LESSONS™ / DEPARTMENT OF PERSONAL BRANDING</span><h1>PLEASE STATE YOUR<br/><span>SIGNIFICANCE.</span></h1></div><p>Something happened.<br/>Let’s make it everyone’s business.</p></section>
    <section className="ll-purpose" aria-labelledby="purpose-title"><div className="ll-section-label"><h2 id="purpose-title">01 / REASON FOR FILING</h2><span>SELECT ONE. FEEL MANY THINGS.</span></div><div className="ll-categories" role="group" aria-label="Post category">{CATEGORIES.map(c=>c.href?<a className="ll-category ll-category-roast" href={c.href} key={c.id}><span aria-hidden="true">↗</span><div>{c.name}<small>Already posted? Report to Roast.</small></div></a>:<button className={`ll-category ${catId===c.id?'is-selected':''}`} type="button" key={c.id} onClick={()=>onPick(c.id)} aria-pressed={catId===c.id}><span className="ll-check-box" aria-hidden="true">{catId===c.id&&<Check size={16}/>}</span><div>{c.name}<small>{c.subtitle}</small></div><span className="ll-form-code">{c.form}</span></button>)}</div></section>
    <div className="ll-workspace">
      <form className="ll-document" onSubmit={submit}>
        <div className="ll-paper-holes" aria-hidden="true"><i/><i/><i/></div>
        <div className="ll-document-header"><div><span className="ll-kicker">REQUEST FOR PUBLIC SIGNIFICANCE</span><h2>{cat.name}</h2></div><div className="ll-file-no"><span>FORM</span><strong>{cat.form}</strong><small>REV. 01 / ORIGINAL COPY</small></div></div>
        <div className="ll-document-instructions"><span>02 / DISCLOSE THE BASIC FACTS</span><button type="button" onClick={()=>{onChange({...((catId==='announce'?ANNOUNCEMENT_EXAMPLES[answers.kind]:null)||EXAMPLES[catId])});setReaction('Example loaded. Names and accomplishments are entirely made up.');}}>Fill with an example ↗</button></div>
        <p className="ll-form-hint">Fill the blanks in any order. Leave a few empty and the department will improvise.</p>
        <div className="ll-fields">{steps.map((s,i)=>s.type==='choice'?<fieldset className="ll-choice-field" key={s.key}><legend><span>{String(i+1).padStart(2,'0')}</span>{s.ask}</legend><div className="ll-choices">{s.options.map(o=><label key={o}><input type="radio" name={`ll-${s.key}`} value={o} checked={answers[s.key]===o} onChange={()=>update(s,o)}/><span className="ll-check-box" aria-hidden="true">{answers[s.key]===o&&<Check size={14}/>}</span><span>{o}</span></label>)}</div></fieldset>:<div className={`ll-field ${s.type==='long'?'ll-field-wide':''} ${answers[s.key]?.trim()?'is-filled':''}`} key={`${catId}-${s.key}`}><label htmlFor={`ll-${s.key}`}><span>{String(i+1).padStart(2,'0')}</span>{LABELS[s.key]||s.key}</label><p id={`ll-help-${s.key}`}>{s.ask}</p>{React.createElement(s.type==='long'?'textarea':'input',{id:`ll-${s.key}`,name:s.key,type:s.type==='long'?undefined:'text',rows:s.type==='long'?3:undefined,value:answers[s.key]||'',maxLength:s.type==='long'?1200:300,placeholder:s.placeholder||'Fill in the blank',autoComplete:'off','aria-describedby':`ll-help-${s.key}`,onChange:e=>update(s,e.target.value),onBlur:()=>{const value=answers[s.key]?.trim();if(value&&s.react)setReaction(s.react(value,answers));}})}</div>)}</div>
        <div className="ll-department-note" role="status"><span>DEPARTMENT NOTE</span><p>{reaction}</p></div>
        <div className="ll-form-bottom"><span>NO ACTUAL APPROVAL REQUIRED.</span><button type="button" onClick={()=>{onChange({...DEFAULT_ANSWERS[catId]});setReaction('A fresh form. Your previous significance has been redacted.');}}>Clear this form</button></div>
        <button type="submit" className="ll-supercharge">SUPERCHARGE THIS POST <ArrowUpRight size={24}/></button>
        <p className="ll-private-note">Generated in your browser. Your answers stay here.</p>
      </form>
      <aside className="ll-office-use" aria-labelledby="office-use-title"><div className="ll-office-head"><h2 id="office-use-title">FOR OFFICE USE ONLY</h2><span>● LIVE DRAFT</span></div><div className="ll-clearance"><strong>{String(complete).padStart(2,'0')}<span> / {String(steps.length).padStart(2,'0')}</span></strong><span>FIELDS DECLASSIFIED</span></div><div className="ll-statement"><span className="ll-kicker">THE UNREMARKABLE TRUTH</span><p><Statement catId={catId} a={answers}/></p></div><div className="ll-office-stamp" aria-hidden="true">POTENTIALLY<br/>SIGNIFICANT</div><p className="ll-office-footnote">Once filed, your ordinary event will be escalated to a transformational moment.</p><div className="ll-check-note"><Check size={16}/><span>Sincerity optional.<br/>LinkedInification adjustable.</span></div></aside>
    </div>
  </>;
}
