import React from 'react';

export function sentenceParts(catId,a){
  if(catId==='announce'){
    if(a.kind==='A promotion')return ['We promoted',['name'],'to',['role'],{prefix:'At',key:'company'}];
    if(a.kind==='A product launch')return ['We made',['name'],'to',['goal'],{prefix:'At',key:'company'}];
    if(a.kind==='A partnership')return ['We teamed up with',['name'],'to',['goal'],{prefix:'We are',key:'company'}];
    if(a.kind==='A company milestone')return ['We reached',['name'],'at',['company']];
    return ['We hired',['name'],'as',['role'],{prefix:'At',key:'company'}];
  }
  if(catId==='lesson')return ['When',['moment'],'I learned',['lesson']];
  if(catId==='sell')return [['customer'],'used',['offer'],'and got',['result']];
  if(catId==='urgency')return ["Don't miss",['thing'],'only',['scarcity']];
  return ['I used',['tool'],'to',['task']];
}

export function Word({step,value,onChange,small=false}){
  const id=`fact-${step.key}`;
  // Mirror text gives native textarea a fluid height, including long/multiline answers.
  return <span className={`el-word ${small?'is-small':''} ${(value||step.placeholder||'').length>32?'is-long':''}`}>
    <span className="el-word-mirror" aria-hidden="true">{value||step.placeholder||'Your answer'}{'\u200b'}</span>
    <textarea id={id} name={step.key} rows={1} value={value||''} placeholder={step.placeholder||'Your answer'} aria-label={step.ask} maxLength={step.type==='long'?1200:300} onChange={e=>onChange(step.key,e.target.value)} spellCheck="false"/>
  </span>;
}

export function Sentence({catId,answers,steps,onChange}){
  return <div className="el-sentence" aria-label="The actual event">{sentenceParts(catId,answers).map((part,i)=>{
    if(typeof part==='string')return <span className="el-connector" key={i}>{part}</span>;
    if(Array.isArray(part)){const step=steps.find(s=>s.key===part[0]);return <Word key={step.key} step={step} value={answers[step.key]} onChange={onChange}/>;}
    const step=steps.find(s=>s.key===part.key);return <div className="el-sentence-tail" key={step.key}><span>{part.prefix}</span><Word step={step} value={answers[step.key]} onChange={onChange} small/></div>;
  })}</div>;
}
