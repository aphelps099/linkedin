import React from 'react';
import { Button } from '../controls/Button.jsx';
import { MAX_WORDS, truncateWords, wordCount } from '../../remix.js';

const SAMPLE = `I'm humbled and honored to share that after careful reflection, I've decided to pursue new opportunities.

It's been a wild ride. When I joined, we were a scrappy team of three in a fast-paced environment. Today we're a category-defining ecosystem.

Here's what I learned: it's not about the tools. It's about the mindset.

Most people won't understand this. But you will.

Grateful for this incredible journey and the amazing team who made it possible. Onwards and upwards! 🚀

Let's connect and explore synergies. Thoughts? 👇

#thoughtleadership #synergy #opentowork`;

// The front door: paste a post, get a remix. Analysis happens in the browser;
// only the short performance copy is sent to the configured voice service.
// `initial` arrives when LinkedIn Lessons hands a finished post over.
export function RemixPanel({ onRemix, onClose, result, narrow, initial }){
  const [text, setText] = React.useState(initial || result?.text || '');
  const [busy, setBusy] = React.useState(false);
  const words = wordCount(text);
  const over = words > MAX_WORDS;
  const samePost = result && truncateWords(text) === result.text;
  const previewLines = samePost ? result.optimized?.lines || [] : [];
  return <div style={{width:'100%',maxWidth:860,margin:'0 auto',boxSizing:'border-box',background:'#fff',color:'var(--ink)',border:'var(--rule-frame) solid var(--ink)',padding:narrow?16:22,display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:18}}>
      <div>
        <span style={{display:'block',fontSize:narrow?22:28,fontWeight:700,letterSpacing:'-.035em'}}>Turn your post into a beat.</span>
        <span style={{display:'block',marginTop:5,fontSize:13,lineHeight:1.5,maxWidth:680}}>
          Paste your LinkedIn post below. Your words become the performance.
        </span>
      </div>
      <Button onClick={onClose} style={{flex:'0 0 auto'}}>Close</Button>
    </div>
    <div style={{borderTop:'1px solid var(--hair)',borderBottom:'1px solid var(--hair)',padding:'9px 0',fontSize:10.5,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>
      What happens next: we distill your post → add corporate seasoning → start the beat
    </div>
    <textarea
      value={text}
      onChange={e=>setText(e.target.value)}
      placeholder="Paste your LinkedIn post here…"
      rows={narrow?7:6}
      style={{width:'100%',boxSizing:'border-box',resize:'vertical',padding:12,fontFamily:'var(--sans)',fontSize:14,lineHeight:1.5,
        border:'var(--rule-frame) solid var(--ink)',borderRadius:0,background:'var(--paper)',color:'var(--ink)',outline:'none'}}/>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <Button disabled={busy || !text.trim()} onClick={async ()=>{
        if(busy) return;
        setBusy(true);
        try{ await onRemix(text); }finally{ setBusy(false); }
      }} style={{padding:'13px 20px',background:'var(--blue)',borderColor:'var(--blue)',color:'#fff'}}>
        {busy ? 'Generating voices…' : 'Create remix + play'}
      </Button>
      <button type="button" onClick={()=> setText(SAMPLE)}
        style={{border:0,borderBottom:'1px solid var(--blue)',padding:'2px 0',background:'transparent',color:'var(--blue)',fontFamily:'var(--sans)',fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer'}}>
        Try an example
      </button>
      {text && <button type="button" onClick={()=> setText('')}
        style={{border:0,padding:'2px 0',background:'transparent',color:'var(--text-meta)',fontFamily:'var(--sans)',fontSize:11,cursor:'pointer'}}>Clear</button>}
      <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:10.5,color:over?'var(--blue)':'var(--text-meta)'}}>
        {words}/{MAX_WORDS} words{over?' · trimmed to 400':''}
      </span>
    </div>
    <div style={{fontSize:11,color:'var(--text-meta)',lineHeight:1.5}}>
      Nothing you paste is stored. Only the six short performance beats are sent for speech generation.
    </div>
    {previewLines.length > 0 && <div style={{borderTop:'var(--rule-section) solid var(--ink)',paddingTop:14}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap',marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'var(--blue)'}}>Current remix · your post + corporate seasoning</span>
        <span style={{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--text-meta)'}}>Index {result.score} · {result.rank}</span>
      </div>
      <div style={{border:'var(--rule-frame) solid var(--ink)',background:'var(--paper)'}}>
        {previewLines.map((line,index)=>
          <div key={index} style={{display:'grid',gridTemplateColumns:'28px 1fr',gap:8,padding:'8px 10px',
            borderBottom:index < previewLines.length-1?'1px dotted var(--hair)':'none',fontSize:12.5,lineHeight:1.45}}>
            <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--blue)',fontWeight:700}}>{String(index+1).padStart(2,'0')}</span>
            <span style={line.kind === 'corporate' ? {fontFamily:'var(--mono)',fontWeight:700,letterSpacing:'.12em',color:'var(--blue)'} : undefined}>
              {line.sourceText || line.text}
            </span>
          </div>)}
      </div>
      <div style={{fontSize:10.5,color:'var(--text-meta)',marginTop:6}}>
        {result.voice?.generatedLines || 0}/{previewLines.length} dynamic voice clips ready · corporate commands use the compliance mainframe
      </div>
    </div>}
  </div>;
}
