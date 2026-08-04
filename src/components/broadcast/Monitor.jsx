import React, { useEffect, useRef, forwardRef } from 'react';
import { CBAudio } from '../../audio.js';

// The broadcast monitor — the clip the feed sees, rendered live.
// Corporate blue field, white text, white-outlined squares with white fills
// marking the beats in sequence, and the triggered LinkedIn phrase displayed big
// with a teletype reveal. While a clip is being taped it becomes a director,
// cutting between closeups: the phrase, the pads, the beat grid, the comments.
const W = 1080, H = 1080, M = 72;
const BLUE = '#0a66c2', TINT = '#9fc8ea', WHITE = '#ffffff', INK = '#111111';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"IBM Plex Mono", Menlo, Consolas, monospace';
const SCENES = ['phrase', 'pads', 'eq', 'grid', 'feed'];

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

function fitText(ctx, text, maxW, maxLines, startSize, minSize){
  let size = startSize, lines;
  for(;;){
    ctx.font = `700 ${size}px ${SANS}`; ctx.letterSpacing = `${(-0.035*size).toFixed(1)}px`;
    lines = wrapText(ctx, text, maxW);
    const tooWide = lines.some(l => ctx.measureText(l).width > maxW); // unbreakable long words
    if((lines.length <= maxLines && !tooWide) || size <= minSize) break;
    size -= 8;
  }
  return { size, lines };
}

// teletype reveal: characters appear over ~.7s; block cursor rides along, then blinks
function reveal(st, text, now){
  const t0 = st.phraseAt || 0;
  const el = (now - t0) / 1000;
  const frac = Math.min(1, el / .7);
  const n = Math.ceil(text.length * frac);
  const partial = text.slice(0, n);
  const cursorOn = frac < 1 || (Math.floor(el / .53) % 2 === 0);
  return { partial, cursorOn };
}

function drawChrome(ctx, st){
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,W,H);
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
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.font = `500 16px ${MONO}`; ctx.letterSpacing = '1.5px';
  ctx.textAlign = 'left';
  ctx.fillText('AN EQUAL OPPORTUNITY INSTRUMENT', M, 1042);
  ctx.textAlign = 'right';
  ctx.fillText('NOT AFFILIATED WITH YOUR NETWORK', W - M, 1042);
  ctx.letterSpacing = '0px';
}

function drawChip(ctx, label, x, y){
  ctx.font = `700 19px ${SANS}`; ctx.letterSpacing = '3.5px';
  const cw = ctx.measureText(label).width + 24;
  ctx.fillStyle = WHITE; ctx.fillRect(x, y, cw, 38);
  ctx.fillStyle = BLUE; ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 26);
  ctx.letterSpacing = '0px';
  return cw;
}

function drawStamp(ctx, x, y){
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-4 * Math.PI/180);
  ctx.font = `700 21px ${SANS}`; ctx.letterSpacing = '4px';
  const sw = ctx.measureText('APPROVED — HR').width + 28;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3;
  ctx.strokeRect(-sw/2, -24, sw, 44);
  ctx.fillStyle = WHITE; ctx.textAlign = 'center';
  ctx.fillText('APPROVED — HR', 0, 6);
  ctx.restore();
  ctx.letterSpacing = '0px';
}

// the equalizer — monumental white bars off the master bus analyser
function drawEq(ctx, x, y, w, h, bars){
  const spec = CBAudio.spectrum();
  const gap = Math.max(4, (w/bars)*.22);
  const bw = (w - gap*(bars-1)) / bars;
  for(let i=0;i<bars;i++){
    let v = 0;
    if(spec){
      // skip the DC end, spread bars across the musical range of the bins
      const from = 2 + Math.floor(i/bars * (spec.length*.75));
      const to = 2 + Math.floor((i+1)/bars * (spec.length*.75));
      for(let b=from;b<Math.max(to,from+1);b++) v = Math.max(v, spec[b]||0);
      v /= 255;
    }
    const bh = Math.max(h*.03, v*h);
    const bx = x + i*(bw+gap);
    ctx.fillStyle = v > .04 ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.35)';
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if(v > .04){ ctx.fillStyle = TINT; ctx.fillRect(bx, y + h - bh - 8, bw, 4); } // cap mark, live bars only
  }
}

function engagementLine(st){
  const e = st.eng || {reactions:0, reposts:0, comments:0};
  return `${e.reactions.toLocaleString()} REACTIONS · ${e.reposts.toLocaleString()} REPOSTS · ${e.comments.toLocaleString()} COMMENTS`;
}

function drawEngagement(ctx, st, x, y, size, align){
  ctx.fillStyle = TINT; ctx.font = `500 ${size}px ${MONO}`; ctx.letterSpacing = '1.5px';
  ctx.textAlign = align || 'left';
  ctx.fillText(engagementLine(st), x, y);
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}

function drawPhraseBlock(ctx, st, now, {top, bottom, maxW, startSize}){
  const spoken = !!st.spoken;
  const full = spoken ? `“${st.tickerText}”` : 'It’s not an instrument. It’s a journey.';
  const { size, lines } = fitText(ctx, full, maxW, 4, startSize, 44);
  const { partial, cursorOn } = spoken ? reveal(st, full, now) : { partial: full, cursorOn: false };
  ctx.font = `700 ${size}px ${SANS}`; ctx.letterSpacing = `${(-0.035*size).toFixed(1)}px`;
  ctx.fillStyle = spoken ? WHITE : TINT; ctx.textAlign = 'left';
  const lh = size * 1.02;
  let y = top + size * .8 + Math.max(0, ((bottom - top) - lines.length*lh) / 2);
  let remaining = partial.length;
  for(const line of lines){
    const shown = line.slice(0, Math.max(0, remaining));
    ctx.fillText(shown, M, y);
    if(cursorOn && remaining >= 0 && remaining <= line.length){
      const cx = M + ctx.measureText(shown).width + 8;
      ctx.fillRect(cx, y - size*.72, size*.5, size*.82);
    }
    remaining -= line.length + 1; // account for the collapsed space
    y += lh;
    if(remaining < 0 && cursorOn) break;
  }
  ctx.letterSpacing = '0px';
}

function drawGridBlock(ctx, st, {top, bottom, labelW, labelSize}){
  const voices = st.voices || [], pattern = st.pattern || [];
  const rows = voices.length;
  const stepsN = (pattern[0] && pattern[0].length) || 16;
  const pitchY = (bottom - top) / Math.max(rows, 1);
  const pitchX = (W - 2*M - labelW) / stepsN;
  const side = Math.min(pitchX, pitchY) * .8;
  for(let i=0;i<rows;i++){
    const cy = top + i*pitchY + pitchY/2;
    ctx.fillStyle = TINT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${labelSize}px ${MONO}`; ctx.letterSpacing = '1px';
    ctx.fillText(String(voices[i].name || '').toUpperCase().slice(0,13), M, cy);
    for(let s=0;s<stepsN;s++){
      const cx = M + labelW + s*pitchX + pitchX/2;
      const x = cx - side/2, yy = cy - side/2;
      const val = pattern[i] ? pattern[i][s] : 0;
      if(val){
        ctx.fillStyle = WHITE; ctx.fillRect(x, yy, side, side);
        if(voices[i].vox && side >= 16){
          ctx.fillStyle = BLUE; ctx.textAlign = 'center';
          ctx.font = `700 ${Math.round(side*.42)}px ${MONO}`;
          ctx.fillText((st.voxCodes && st.voxCodes[s]) || '••', cx, cy + 1);
          ctx.textAlign = 'left'; ctx.font = `500 ${labelSize}px ${MONO}`;
        } else if(!voices[i].vox && val === 2){
          ctx.fillStyle = BLUE;
          const d = Math.max(6, side*.24);
          ctx.fillRect(cx - d/2, cy - d/2, d, d);
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(2, side*.06);
        ctx.strokeRect(x, yy, side, side);
      }
      if(s === st.pos){
        ctx.strokeStyle = TINT; ctx.lineWidth = Math.max(5, side*.12);
        ctx.strokeRect(x - 4, yy - 4, side + 8, side + 8);
      }
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
}

function drawPadsBlock(ctx, st, now, {top, bottom}){
  const phrases = st.phrases || [];
  const cols = 4, rows = 4;
  const gap = 14;
  const cw = (W - 2*M - (cols-1)*gap) / cols;
  const ch = (bottom - top - (rows-1)*gap) / rows;
  const flash = st.lastKeyAt && (now - st.lastKeyAt) < 160;
  for(let i=0;i<16;i++){
    const c = i % cols, r = Math.floor(i / cols);
    const x = M + c*(cw+gap), y = top + r*(ch+gap);
    const active = st.armed === i && (flash || true); // armed key holds the fill
    if(active){ ctx.fillStyle = WHITE; ctx.fillRect(x, y, cw, ch); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, cw, ch); }
    const fg = active ? BLUE : WHITE;
    ctx.fillStyle = active ? BLUE : TINT;
    ctx.font = `500 20px ${MONO}`; ctx.textAlign = 'left'; ctx.letterSpacing = '1px';
    ctx.fillText(String(i+1).padStart(2,'0'), x + 16, y + 34);
    ctx.fillStyle = fg;
    ctx.font = `700 26px ${SANS}`; ctx.letterSpacing = '-0.3px';
    const name = (phrases[i] && phrases[i].name) || '';
    ctx.fillText(name, x + 16, y + ch - 18, cw - 32);
  }
  ctx.letterSpacing = '0px';
}

function drawComment(ctx, c, x, y, w, s, alpha){
  ctx.save();
  ctx.globalAlpha = alpha;
  const pad = 16*s;
  ctx.font = `400 ${19*s}px ${SANS}`;
  const body = wrapText(ctx, c.text, w - 2*pad).slice(0,2);
  const h = pad + 22*s + 19*s + body.length*(24*s) + 26*s + pad*.7;
  ctx.fillStyle = WHITE; ctx.fillRect(x, y - h, w, h);
  ctx.textAlign = 'left';
  let ty = y - h + pad + 15*s;
  ctx.fillStyle = BLUE;
  ctx.font = `700 ${18*s}px ${SANS}`;
  ctx.fillText(`${c.name} · ${c.degree}`, x + pad, ty, w - 2*pad);
  ty += 19*s;
  ctx.fillStyle = 'rgba(10,102,194,.6)';
  ctx.font = `400 ${13*s}px ${SANS}`;
  ctx.fillText(c.title, x + pad, ty, w - 2*pad);
  ty += 24*s;
  ctx.fillStyle = INK; ctx.font = `400 ${19*s}px ${SANS}`;
  for(const line of body){ ctx.fillText(line, x + pad, ty); ty += 24*s; }
  ctx.fillStyle = 'rgba(17,17,17,.45)';
  ctx.font = `500 ${13*s}px ${MONO}`;
  ctx.fillText(`${c.age} · LIKE · REPLY · ${c.likes}`, x + pad, y - pad*.85);
  ctx.restore();
  return h;
}

function drawComments(ctx, st, now, {x, w, bottom, max, scale}){
  const list = (st.comments || []).slice(-max);
  let y = bottom;
  for(let i=list.length-1; i>=0; i--){
    const c = list[i];
    const age = (now - c.at)/1000;
    const a = Math.min(1, age/.28);
    const h = drawComment(ctx, c, x, y - (1-a)*24, w, scale, a);
    y -= h + 14*scale;
    if(y < 240) break;
  }
}

function draw(ctx, st){
  const now = performance.now();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.letterSpacing = '0px';
  drawChrome(ctx, st);

  let scene = 'composite';
  if(st.exporting && st.exportStartedAt){
    const el = (now - st.exportStartedAt)/1000;
    const dur = st.sceneDur || 5;
    scene = SCENES[Math.floor(el/dur) % SCENES.length];
  }

  if(scene === 'phrase'){
    drawChip(ctx, st.exporting ? 'ON THE RECORD' : 'NOW PLAYING', M, 186);
    drawStamp(ctx, W - M - 110, 205);
    drawPhraseBlock(ctx, st, now, {top: 280, bottom: 900, maxW: W - 2*M, startSize: 120});
    drawEngagement(ctx, st, M, 972, 20, 'left');
  } else if(scene === 'pads'){
    drawChip(ctx, 'PRESS TO OPINE', M, 186);
    drawPadsBlock(ctx, st, now, {top: 250, bottom: 990});
  } else if(scene === 'eq'){
    drawChip(ctx, 'THE MIX', M, 186);
    drawPhraseBlock(ctx, st, now, {top: 240, bottom: 420, maxW: W - 2*M, startSize: 64});
    drawEq(ctx, M, 460, W - 2*M, 490, 22);
    drawEngagement(ctx, st, M, 995, 18, 'left');
  } else if(scene === 'grid'){
    drawChip(ctx, 'THE CADENCE', M, 186);
    drawGridBlock(ctx, st, {top: 260, bottom: 990, labelW: 200, labelSize: 19});
  } else if(scene === 'feed'){
    drawChip(ctx, 'THE COMMENTS ARE IN', M, 186);
    drawEngagement(ctx, st, M, 268, 22, 'left');
    drawComments(ctx, st, now, {x: (W-760)/2, w: 760, bottom: 985, max: 4, scale: 1.15});
  } else {
    // composite — the live console view
    drawChip(ctx, st.exporting ? 'ON THE RECORD' : 'NOW PLAYING', M, 186);
    drawStamp(ctx, W - M - 110, 205);
    const hasComments = st.comments && st.comments.length;
    drawPhraseBlock(ctx, st, now, {top: 250, bottom: 545, maxW: hasComments ? 520 : W - 2*M, startSize: 92});
    if(hasComments) drawComments(ctx, st, now, {x: 640, w: 368, bottom: 550, max: 3, scale: .82});
    drawEq(ctx, M, 566, W - 2*M, 100, 28);
    drawEngagement(ctx, st, W - M, 692, 16, 'right');
    drawGridBlock(ctx, st, {top: 706, bottom: 984, labelW: 168, labelSize: 15});
  }
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
