import React from 'react';

// One comment at a time, in a box of fixed height. Everything inside is
// clamped so a long headline or a two-line remark can never change the size
// of the row — the card was jumping around before, which made the whole
// stage twitch every time the network had an opinion.
const CARD_H = 104, ENTER = 380;
const clamp1 = {whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'};
const clamp2 = {display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'};

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
  const c = all.length ? all[all.length-1] : null;

  const frame = {height:CARD_H, boxSizing:'border-box', overflow:'hidden'};
  if(!c) return <div style={{...frame, border:'2px dashed rgba(255,255,255,.22)',
    display:'flex',alignItems:'center',justifyContent:'center'}}>
    <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>Awaiting engagement</span>
  </div>;

  const age = now - c.at;
  const enter = 1 - Math.pow(1 - Math.min(1, age/ENTER), 3);
  const likes = Math.round(c.likes * Math.min(1, Math.max(0, (age - 200)/800)));

  return <div style={{...frame, background:'#fff', border:'2px solid #fff', color:'var(--ink)',
    padding: narrow ? '10px 12px' : '11px 14px',
    display:'flex', flexDirection:'column', gap:5,
    opacity: .25 + enter*.75, transform:`translateY(${(1-enter)*10}px)`}}>
    <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
      <span style={{width:32,height:32,borderRadius:'50%',background:'#c3d9ee',color:'var(--blue)',flex:'none',
        display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:12.5,fontWeight:600}}>{c.initials}</span>
      <span style={{minWidth:0,flex:1}}>
        <span style={{display:'block',fontSize:13.5,fontWeight:600,...clamp1}}>
          {c.name} <span style={{color:'rgba(0,0,0,.55)',fontWeight:400}}>· {c.degree}</span>
        </span>
        <span style={{display:'block',fontSize:11,color:'rgba(0,0,0,.55)',...clamp1}}>{c.title}</span>
      </span>
      <span style={{fontSize:11,color:'rgba(0,0,0,.45)',fontFamily:'var(--mono)',flex:'none'}}>{c.age}</span>
    </div>
    <div style={{fontSize:14.5,lineHeight:1.3,...clamp2}}>{c.text}</div>
    <div style={{marginTop:'auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <span style={{fontSize:11.5,fontWeight:600,color:'rgba(0,0,0,.55)',...clamp1}}>
        Like · Reply{c.replies?` · ${c.replies} replies`:''}
      </span>
      <span style={{fontSize:11.5,color:'rgba(0,0,0,.55)',fontFamily:'var(--mono)',flex:'none'}}>👍 {likes}</span>
    </div>
  </div>;
}
