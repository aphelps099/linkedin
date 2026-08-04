import React, { useState } from 'react';

// One of the three performance keys. Big enough to hit in the dark, on a phone,
// or with an elbow. White outline on the blue stage; fills white when struck.
export function StageKey({ label, hint, caption, on, onFire, style }) {
  const [hit, setHit] = useState(false);
  const fire = () => { setHit(true); setTimeout(()=>setHit(false), 140); onFire && onFire(); };
  const active = on || hit;
  return <div role="button" tabIndex={0} aria-label={label}
    onPointerDown={e=>{ e.preventDefault(); fire(); }}
    onKeyDown={e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); fire(); } }}
    style={{
      display:'flex', flexDirection:'column', justifyContent:'space-between', gap:10,
      padding:'18px 20px', minHeight:104, boxSizing:'border-box',
      border:'2px solid #fff', background: active ? '#fff' : 'transparent',
      color: active ? 'var(--blue)' : '#fff',
      cursor:'pointer', userSelect:'none', touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
      transition:'background .07s, color .07s', ...style,
    }}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10}}>
      <span style={{fontSize:30,fontWeight:700,letterSpacing:'-.03em',lineHeight:1}}>{label}</span>
      <span style={{fontFamily:'var(--mono)',fontSize:12,opacity:.75}}>{hint}</span>
    </div>
    <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',opacity:.8}}>{caption}</span>
  </div>;
}
