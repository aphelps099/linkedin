import React from 'react';
import { Button } from '../controls/Button.jsx';
import { MAX_WORDS, wordCount } from '../../remix.js';

const SAMPLE = `I'm humbled and honored to share that after careful reflection, I've decided to pursue new opportunities.

It's been a wild ride. When I joined, we were a scrappy team of three in a fast-paced environment. Today we're a category-defining ecosystem.

Here's what I learned: it's not about the tools. It's about the mindset.

Most people won't understand this. But you will.

Grateful for this incredible journey and the amazing team who made it possible. Onwards and upwards! 🚀

Let's connect and explore synergies. Thoughts? 👇

#thoughtleadership #synergy #opentowork`;

// The front door: paste a post, get a remix. Everything happens in the browser.
// `initial` arrives when LinkedIn Lessons hands a finished post over.
export function RemixPanel({ onRemix, onClose, result, narrow, initial }){
  const [text, setText] = React.useState(initial || '');
  const words = wordCount(text);
  const over = words > MAX_WORDS;
  return <div style={{background:'#fff',color:'var(--ink)',border:'var(--rule-frame) solid var(--ink)',padding:narrow?16:22,display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,flexWrap:'wrap'}}>
      <span style={{fontSize:narrow?20:24,fontWeight:700,letterSpacing:'-.03em'}}>Build your remix</span>
      <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--text-meta)'}}>
        Paste a post · {MAX_WORDS} words · never leaves your browser
      </span>
    </div>
    <textarea
      value={text}
      onChange={e=>setText(e.target.value)}
      placeholder="Paste your LinkedIn post here. Yours works best."
      rows={narrow?7:9}
      style={{width:'100%',boxSizing:'border-box',resize:'vertical',padding:12,fontFamily:'var(--sans)',fontSize:14,lineHeight:1.5,
        border:'var(--rule-frame) solid var(--ink)',borderRadius:0,background:'var(--paper)',color:'var(--ink)',outline:'none'}}/>
    <div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
      <Button onClick={()=> onRemix(text)} style={{padding:'12px 18px'}}>Remix it</Button>
      <Button onClick={()=> setText(SAMPLE)}>Use an example</Button>
      {text && <Button onClick={()=> setText('')}>Clear</Button>}
      <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:10.5,color:over?'var(--blue)':'var(--text-meta)'}}>
        {words}/{MAX_WORDS} words{over?' · trimmed to 400':''}
      </span>
      <Button onClick={onClose}>Close</Button>
    </div>
    {result && <div style={{borderTop:'var(--rule-section) solid var(--ink)',paddingTop:14,display:'grid',gridTemplateColumns:narrow?'1fr':'190px 1fr',gap:18,alignItems:'start'}}>
      <div style={{border:'var(--rule-frame) solid var(--blue)',padding:'14px 16px'}}>
        <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--text-meta)'}}>Thought Leadership Index</div>
        <div style={{fontSize:56,fontWeight:700,letterSpacing:'-.05em',lineHeight:1,color:'var(--blue)',margin:'6px 0 4px'}}>{result.score}</div>
        <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>{result.rank}</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {result.markers.slice(0,6).map(m=>
            <span key={m.label} style={{border:'1px solid var(--hair)',padding:'4px 7px',fontSize:9.5,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase'}}>
              {m.label} <span style={{color:'var(--blue)',fontFamily:'var(--mono)'}}>{m.count}</span>
            </span>)}
          {!result.markers.length && <span style={{fontSize:12,color:'var(--text-meta)'}}>No detectable thought leadership. Suspicious.</span>}
        </div>
        {result.optimized && result.optimized.lines.length > 0 && <div>
          <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--text-meta)',marginBottom:5}}>Your post, optimized</div>
          <div style={{border:'var(--rule-frame) solid var(--ink)',padding:'10px 12px',background:'var(--paper)'}}>
            {result.optimized.lines.map((l,i)=>
              <div key={i} style={{fontSize:13.5,lineHeight:1.65,fontWeight:i===0?700:400}}>{l.text}</div>)}
          </div>
          <div style={{fontSize:10.5,color:'var(--text-meta)',marginTop:4}}>
            Spoken by the organ, in this order · detected: {result.optimized.intents.join(', ')}
            {result.optimized.nouns.length ? ` · subject: ${result.optimized.nouns.join(', ')}` : ''}
          </div>
        </div>}
        {result.translations.length > 0 && <div>
          <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--text-meta)',marginBottom:5}}>What it says · What it means</div>
          {result.translations.map((t,i)=>
            <div key={i} style={{fontSize:12.5,lineHeight:1.7,borderBottom:'1px dotted var(--hair)'}}>
              <span style={{color:'var(--blue)',fontWeight:700}}>→ </span>{t}
            </div>)}
        </div>}
        <div style={{fontSize:11,color:'var(--text-meta)'}}>
          {result.lines.length} lines staged · {result.phrases.length} phrases the organ can say back to you
        </div>
      </div>
    </div>}
  </div>;
}
