import React, { useRef, useState } from 'react';

// Horizontal scrubber — a ruled track that fills as you drag. Reads as a
// bureaucratic gauge, works with a mouse, a finger, or the arrow keys.
// tone="light" renders it white-on-blue for the stage.
export function Scrubber({ label, value = 0, onChange, format, tone = 'ink', style }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const light = tone === 'light';
  const ink = light ? '#fff' : 'var(--ink)';
  const fill = light ? '#fff' : 'var(--blue)';
  const fmt = format || (v => Math.round(v*100) + '%');
  const set = clientX => {
    const el = ref.current; if(!el) return;
    const r = el.getBoundingClientRect();
    onChange && onChange(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  return <div style={{userSelect:'none', ...style}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:5}}>
      <span style={{fontSize:'var(--label-size)',letterSpacing:'var(--label-tracking)',textTransform:'uppercase',fontWeight:700,color:ink}}>{label}</span>
      <span style={{fontFamily:'var(--mono)',fontSize:'var(--readout-size)',fontVariantNumeric:'tabular-nums',color:light?'var(--blue-light)':'var(--blue)'}}>{fmt(value)}</span>
    </div>
    <div ref={ref} role="slider" tabIndex={0}
      aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value*100)}
      onPointerDown={e=>{ e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); set(e.clientX); }}
      onPointerMove={e=>{ if(drag) set(e.clientX); }}
      onPointerUp={()=>setDrag(false)} onPointerCancel={()=>setDrag(false)}
      onKeyDown={e=>{
        const d = e.shiftKey ? .01 : .05;
        if(e.key==='ArrowRight'||e.key==='ArrowUp'){ e.preventDefault(); onChange && onChange(Math.min(1, value+d)); }
        else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){ e.preventDefault(); onChange && onChange(Math.max(0, value-d)); }
      }}
      style={{position:'relative',height:26,border:`var(--rule-frame) solid ${ink}`,background:light?'transparent':'var(--white)',cursor:'ew-resize',touchAction:'none',boxSizing:'border-box'}}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${value*100}%`,background:fill}}/>
      <div style={{position:'absolute',left:`${value*100}%`,top:-4,bottom:-4,width:3,marginLeft:-1.5,background:light?'var(--blue-light)':'var(--ink)'}}/>
    </div>
  </div>;
}
