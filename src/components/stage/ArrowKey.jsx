import React, { useState } from 'react';

// The arcade arrows. Big enough to slap, labelled so nobody has to guess:
// these change the phrase.
export function ArrowKey({ dir = 'right', hint = 'Change phrase', onFire, tone = 'light', style }) {
  const [hit, setHit] = useState(false);
  const fire = () => { setHit(true); setTimeout(()=>setHit(false), 130); onFire && onFire(); };
  const light = tone === 'light';
  const edge = light ? '#fff' : 'var(--ink)';
  const fillOn = light ? '#fff' : 'var(--blue)';
  const restFg = light ? '#fff' : 'var(--ink)';
  const glyph = dir === 'left' ? '◀' : '▶';
  return <div role="button" tabIndex={0} aria-label={`${hint} ${dir}`}
    onPointerDown={e=>{ e.preventDefault(); fire(); }}
    onKeyDown={e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); fire(); } }}
    style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
      padding:'14px 10px', minHeight:104, boxSizing:'border-box',
      border:`2px solid ${hit && !light ? fillOn : edge}`,
      background: hit ? fillOn : (light ? 'rgba(255,255,255,.06)' : 'var(--white)'),
      color: hit ? (light ? 'var(--blue)' : '#fff') : restFg,
      cursor:'pointer', userSelect:'none', touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
      transition:'background .07s, color .07s, border-color .07s', ...style,
    }}>
    <span style={{fontSize:34,lineHeight:1}}>{glyph}</span>
    <span style={{fontSize:8.5,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',opacity:.85,textAlign:'center'}}>{hint}</span>
  </div>;
}
