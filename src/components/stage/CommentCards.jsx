import React from 'react';

// The social cards under the player: the network reacting in real time.
// Each arrives, holds, and leaves — the same rhythm as the popups inside the
// broadcast, at the size of a real feed card.
const LIFE = 9000, ENTER = 380;

export function CommentCards({ stateRef, narrow }){
  const [, tick] = React.useReducer(x=>x+1, 0);
  React.useEffect(()=>{
    let raf;
    const loop = ()=>{ tick(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return ()=> cancelAnimationFrame(raf);
  },[]);

  const now = performance.now();
  const all = (stateRef.current && stateRef.current.comments) || [];
  const live = all.filter(c => now - c.at < LIFE).slice(-3);
  const slots = narrow ? 2 : 3;

  return <div style={{display:'grid',gridTemplateColumns:`repeat(${slots},1fr)`,gap:narrow?10:14,minHeight:104}}>
    {Array.from({length:slots}).map((_, i)=>{
      const c = live[live.length - slots + i] || null;
      if(!c) return <div key={i} style={{border:'2px dashed rgba(255,255,255,.22)',minHeight:104,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>Awaiting engagement</span>
      </div>;
      const age = now - c.at;
      const t = Math.min(1, age/ENTER);
      const enter = 1 - Math.pow(1 - t, 3);
      const leaving = Math.max(0, (age - (LIFE - 700))/700);
      const alpha = Math.min(enter, 1 - leaving);
      const likes = Math.round(c.likes * Math.min(1, Math.max(0, (age - 200)/800)));
      return <div key={c.at + '-' + i} style={{
        background:'#fff',border:'2px solid #fff',padding:narrow?'10px 12px':'12px 14px',minHeight:104,boxSizing:'border-box',
        display:'flex',flexDirection:'column',gap:6,
        opacity:alpha, transform:`translateY(${(1-enter)*16 - leaving*10}px)`,
        transition:'none', color:'var(--ink)'}}>
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <span style={{width:34,height:34,borderRadius:'50%',background:'#c3d9ee',color:'var(--blue)',flex:'none',
            display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600}}>{c.initials}</span>
          <span style={{minWidth:0}}>
            <span style={{display:'block',fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {c.name} <span style={{color:'rgba(0,0,0,.55)',fontWeight:400}}>· {c.degree}</span>
            </span>
            <span style={{display:'block',fontSize:11,color:'rgba(0,0,0,.55)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.title}</span>
          </span>
        </div>
        <div style={{fontSize:14.5,lineHeight:1.35}}>{c.text}</div>
        <div style={{marginTop:'auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <span style={{fontSize:11.5,fontWeight:600,color:'rgba(0,0,0,.55)'}}>Like · Reply{c.replies?` · ${c.replies} replies`:''}</span>
          <span style={{fontSize:11.5,color:'rgba(0,0,0,.55)',fontFamily:'var(--mono)'}}>👍 {likes}</span>
        </div>
      </div>;
    })}
  </div>;
}
