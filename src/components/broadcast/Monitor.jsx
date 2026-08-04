import React, { useEffect, useRef, forwardRef } from 'react';

// The broadcast monitor — the clip the feed sees, rendered live.
// Corporate blue field, white text, white-outlined squares with white fills
// marking the beats in sequence, and the triggered LinkedIn phrase displayed big.
// Recorded as-is by the Distribution bay's clip export.
const W = 1080, H = 1080, M = 72;
const BLUE = '#0a66c2', TINT = '#9fc8ea', WHITE = '#ffffff';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"IBM Plex Mono", Menlo, Consolas, monospace';

function wrapText(ctx, text, maxW){
  const words = text.split(' ');
  const lines = []; let cur = '';
  for(const w of words){
    const test = cur ? cur + ' ' + w : w;
    if(ctx.measureText(test).width > maxW && cur){ lines.push(cur); cur = w; }
    else cur = test;
  }
  if(cur) lines.push(cur);
  return lines;
}

function draw(ctx, st){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,W,H);

  // masthead: wordmark left, form meta right, heavy white rule below
  ctx.fillStyle = WHITE; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 46px ${SANS}`; ctx.letterSpacing = '-0.9px';
  ctx.fillText('Circle Back', M, 116);
  const lw = ctx.measureText('Circle Back').width;
  ctx.font = `700 20px ${SANS}`; ctx.letterSpacing = '0px';
  ctx.fillText('®', M + lw + 4, 96);
  ctx.textAlign = 'right'; ctx.fillStyle = TINT;
  ctx.font = `500 19px ${MONO}`; ctx.letterSpacing = '1px';
  ctx.fillText('FORM CB-16 · REV. 2026-08', W - M, 112);
  ctx.fillStyle = WHITE; ctx.fillRect(M, 140, W - 2*M, 4);

  // chip: NOW PLAYING (ON THE RECORD while taping)
  const chip = st.exporting ? 'ON THE RECORD' : 'NOW PLAYING';
  ctx.font = `700 19px ${SANS}`; ctx.letterSpacing = '3.5px';
  const cw = ctx.measureText(chip).width + 24;
  ctx.fillStyle = WHITE; ctx.fillRect(M, 186, cw, 38);
  ctx.fillStyle = BLUE; ctx.textAlign = 'left';
  ctx.fillText(chip, M + 12, 212);

  // approval stamp, top right, rotated −4°
  ctx.save();
  ctx.translate(W - M - 110, 205); ctx.rotate(-4 * Math.PI/180);
  ctx.font = `700 21px ${SANS}`; ctx.letterSpacing = '4px';
  const sw = ctx.measureText('APPROVED — HR').width + 28;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3;
  ctx.strokeRect(-sw/2, -24, sw, 44);
  ctx.fillStyle = WHITE; ctx.textAlign = 'center';
  ctx.fillText('APPROVED — HR', 0, 6);
  ctx.restore();

  // the phrase — big white display type, quoted; tint tagline until first opinion
  const text = st.spoken ? `“${st.tickerText}”` : 'It’s not an instrument. It’s a journey.';
  ctx.fillStyle = st.spoken ? WHITE : TINT;
  ctx.textAlign = 'left';
  const maxW = W - 2*M;
  let size = 96, lines;
  for(;;){
    ctx.font = `700 ${size}px ${SANS}`; ctx.letterSpacing = `${(-0.035*size).toFixed(1)}px`;
    lines = wrapText(ctx, text, maxW);
    if(lines.length <= 4 || size <= 44) break;
    size -= 8;
  }
  const lh = size * 1.02;
  let y = 320 + size * .8;
  const blockH = lines.length * lh;
  y += Math.max(0, (330 - blockH) / 2);
  lines.forEach(l => { ctx.fillText(l, M, y); y += lh; });
  ctx.letterSpacing = '0px';

  // the sequence — white-outlined squares, white fills = the beats, tint frame = playhead
  const voices = st.voices || [], pattern = st.pattern || [];
  const rows = voices.length;
  const gridTop = 700, gridBot = 984, labelW = 168;
  const pitchY = (gridBot - gridTop) / Math.max(rows, 1);
  const pitchX = (W - 2*M - labelW) / 16;
  const side = Math.min(pitchX, pitchY) * .8;
  ctx.font = `500 16px ${MONO}`; ctx.letterSpacing = '1.5px';
  for(let i=0;i<rows;i++){
    const cy = gridTop + i*pitchY + pitchY/2;
    ctx.fillStyle = TINT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `500 15px ${MONO}`;
    ctx.fillText(String(voices[i].name || '').toUpperCase().slice(0,13), M, cy);
    for(let s=0;s<16;s++){
      const cx = M + labelW + s*pitchX + pitchX/2;
      const x = cx - side/2, yy = cy - side/2;
      const val = pattern[i] ? pattern[i][s] : 0;
      if(val){
        ctx.fillStyle = WHITE; ctx.fillRect(x, yy, side, side);
        if(voices[i].vox){
          ctx.fillStyle = BLUE; ctx.textAlign = 'center';
          ctx.font = `700 ${Math.round(side*.42)}px ${MONO}`;
          ctx.fillText((st.voxCodes && st.voxCodes[s]) || '••', cx, cy + 1);
          ctx.textAlign = 'left'; ctx.font = `500 15px ${MONO}`;
        } else if(val === 2){
          ctx.fillStyle = BLUE;
          const d = Math.max(6, side*.24);
          ctx.fillRect(cx - d/2, cy - d/2, d, d);
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
        ctx.strokeRect(x, yy, side, side);
      }
      if(s === st.pos){
        ctx.strokeStyle = TINT; ctx.lineWidth = 5;
        ctx.strokeRect(x - 4, yy - 4, side + 8, side + 8);
      }
    }
  }
  ctx.textBaseline = 'alphabetic';

  // fine print
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.font = `500 16px ${MONO}`; ctx.letterSpacing = '1.5px';
  ctx.textAlign = 'left';
  ctx.fillText('AN EQUAL OPPORTUNITY INSTRUMENT', M, 1042);
  ctx.textAlign = 'right';
  ctx.fillText('NOT AFFILIATED WITH YOUR NETWORK', W - M, 1042);
  ctx.letterSpacing = '0px';
}

export const Monitor = forwardRef(function Monitor({ stateRef, style }, ref){
  const inner = useRef(null);
  const setRefs = el => { inner.current = el; if(typeof ref === 'function') ref(el); else if(ref) ref.current = el; };
  useEffect(()=>{
    let raf;
    const loop = ()=>{
      const cv = inner.current;
      if(cv){
        const ctx = cv.getContext('2d');
        try{ draw(ctx, stateRef.current || {}); }catch(e){ /* keep the loop alive */ }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return ()=> cancelAnimationFrame(raf);
  },[stateRef]);
  return <canvas ref={setRefs} width={W} height={H}
    style={{width:'100%',height:'auto',display:'block',border:'var(--rule-frame) solid var(--ink)',background:'var(--blue)',...style}}/>;
});
