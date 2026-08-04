import React, { useEffect, useRef, forwardRef } from 'react';
import { CBAudio } from '../../audio.js';
import { loadLibrary, libraryReady, currentPlate, advancePlate } from '../../library.js';

// The broadcast monitor — the clip the feed sees, rendered live.
// Corporate blue field, white text, white-outlined squares with white fills
// marking the beats in sequence, and the triggered LinkedIn phrase displayed big
// with a teletype reveal. While a clip is being taped it becomes a director,
// cutting between closeups: the phrase, the pads, the beat grid, the comments.
const W = 1080, H = 1080, M = 72;
const BLUE = '#0a66c2', TINT = '#9fc8ea', WHITE = '#ffffff', INK = '#111111';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"IBM Plex Mono", Menlo, Consolas, monospace';
// What a take is made of: photographs, blue fields of white type, the ASCII
// equalizer, and the comments. No sequencer grid, no pads — a clip should look
// like a piece of media, not like a screenshot of a music tool.
const SCENES = ['phrase', 'plate', 'feed', 'eq', 'plate', 'phrase', 'feed'];

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

// maxH keeps the block inside its zone — without it, long phrases overflow
// downward and collide with whatever is beneath them
function fitText(ctx, text, maxW, maxLines, startSize, minSize, maxH){
  let size = startSize, lines;
  for(;;){
    ctx.font = `700 ${size}px ${SANS}`; ctx.letterSpacing = `${(-0.035*size).toFixed(1)}px`;
    lines = wrapText(ctx, text, maxW);
    const tooWide = lines.some(l => ctx.measureText(l).width > maxW); // unbreakable long words
    const tooTall = maxH ? lines.length * size * 1.04 > maxH : false;
    if((lines.length <= maxLines && !tooWide && !tooTall) || size <= minSize) break;
    size -= 6;
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

function drawChrome(ctx, st, noFill){
  if(!noFill){ ctx.fillStyle = BLUE; ctx.fillRect(0,0,W,H); }
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

// The ASCII horizon — the beat machine rendered as translucent character
// weather behind the type. Columns are sequencer steps, rows are a drifting
// horizon, density comes off the spectrum. Rows are painted as whole strings
// so the whole field costs a few dozen draws, not a few thousand.
const RAMP = ' ·░▒▓█';
function drawAsciiField(ctx, st, now, opts){
  const o = opts || {};
  const alpha = o.alpha === undefined ? .16 : o.alpha;
  const cols = o.cols || 56, rows = o.rows || 30;
  const cw = W/cols, ch = H/rows;
  const spec = CBAudio.spectrum();
  const pattern = st.pattern || [];
  const steps = (pattern[0] && pattern[0].length) || 16;
  const drums = Math.max(0, pattern.length - 1);
  const t = now/1000;

  // per-column energy: what the sequencer is doing at that step + what the mix is doing
  const colE = new Array(cols);
  for(let c=0;c<cols;c++){
    const step = Math.floor(c/cols*steps);
    let hit = 0;
    for(let r=0;r<drums;r++) hit = Math.max(hit, pattern[r] ? pattern[r][step] : 0);
    let e = 0;
    if(spec){ const bin = Math.floor(c/cols * spec.length*.72); e = (spec[bin]||0)/255; }
    colE[c] = e*.62 + (hit === 2 ? .34 : hit ? .2 : 0) + (step === st.pos ? .42 : 0);
  }

  ctx.save();
  ctx.font = `${Math.round(ch*.96)}px ${MONO}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for(let r=0;r<rows;r++){
    // the horizon: dense at the vanishing line, thinning toward the edges
    const d = Math.abs(r/(rows-1) - .5) * 2;
    const horizon = Math.pow(1 - d, 1.7);
    const drift = .5 + .5*Math.sin(t*.55 + r*.42);
    let line = '';
    let rowSum = 0;
    for(let c=0;c<cols;c++){
      const v = Math.max(0, Math.min(1, colE[c]*(.45 + horizon*.85) + horizon*.34*drift));
      rowSum += v;
      line += RAMP[Math.min(RAMP.length-1, Math.floor(v*(RAMP.length-1) + .12))];
    }
    const rowA = alpha * (.42 + (rowSum/cols)*1.15);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(.9, rowA).toFixed(3)})`;
    ctx.fillText(line, 0, r*ch + ch/2);
  }
  // the playhead column reads through the weather
  if(st.pos != null && steps){
    const c = Math.floor(st.pos/steps*cols);
    ctx.fillStyle = `rgba(159,200,234,${Math.min(.5, alpha*2.4).toFixed(3)})`;
    ctx.fillRect(c*cw, 0, Math.max(cw, 3), H);
  }
  ctx.restore();
}

// the beat ribbon — one monumental row of the whole bar, legible from the back row
function drawRibbon(ctx, st, {y, h}){
  const pattern = st.pattern || [];
  const n = (pattern[0] && pattern[0].length) || 16;
  const gap = Math.max(3, (W - 2*M)/n * .18);
  const bw = ((W - 2*M) - gap*(n-1)) / n;
  const drumRows = Math.max(0, pattern.length - 1);
  for(let s=0;s<n;s++){
    const x = M + s*(bw+gap);
    let hit = 0;
    for(let r=0;r<drumRows;r++) hit = Math.max(hit, pattern[r] ? pattern[r][s] : 0);
    const vox = pattern.length ? pattern[pattern.length-1][s] : 0;
    if(vox){ ctx.fillStyle = WHITE; ctx.fillRect(x, y - 10, bw, h + 20); }
    else if(hit){ ctx.fillStyle = hit===2 ? WHITE : 'rgba(255,255,255,.72)'; ctx.fillRect(x, y, bw, h); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(x, y + h*.3, bw, h*.4); }
    if(s === st.pos){
      ctx.strokeStyle = TINT; ctx.lineWidth = 4;
      ctx.strokeRect(x - 5, y - 15, bw + 10, h + 30);
    }
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

function drawPhraseBlock(ctx, st, now, {top, bottom, maxW, startSize, maxLines}){
  const spoken = !!st.spoken;
  const full = spoken ? `“${st.tickerText}”` : 'It’s not an instrument. It’s a journey.';
  const { size, lines } = fitText(ctx, full, maxW, maxLines || 4, startSize, 40, bottom - top);
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

// ---- the comment section, rendered like the real thing ----
const FEED_TEXT = 'rgba(0,0,0,.9)';
const FEED_MUTED = 'rgba(0,0,0,.6)';
const FEED_FAINT = 'rgba(0,0,0,.08)';
const BUBBLE = '#f2f2f2';
const REACTION = {
  like:    {fill:'#378fe9', glyph:'thumb'},
  insight: {fill:'#f5bb5c', glyph:'bulb'},
  love:    {fill:'#df704d', glyph:'heart'},
};

function roundRect(ctx, x, y, w, h, r){
  if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
}

// avatar: initials on a soft disc, the way LinkedIn renders a photoless member
function drawAvatar(ctx, x, y, d, initials, opts){
  const o = opts || {};
  ctx.save();
  ctx.beginPath(); ctx.arc(x + d/2, y + d/2, d/2, 0, Math.PI*2);
  ctx.fillStyle = o.fill || '#c3d9ee'; ctx.fill();
  ctx.clip();
  ctx.fillStyle = o.color || '#0a66c2';
  ctx.font = `600 ${d*.38}px ${SANS}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(initials || '··', x + d/2, y + d/2 + d*.02);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawGlyph(ctx, kind, cx, cy, r){
  ctx.fillStyle = '#fff';
  if(kind === 'heart'){
    const s = r*.62;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s*.62);
    ctx.bezierCurveTo(cx - s*1.3, cy - s*.28, cx - s*.45, cy - s*1.05, cx, cy - s*.34);
    ctx.bezierCurveTo(cx + s*.45, cy - s*1.05, cx + s*1.3, cy - s*.28, cx, cy + s*.62);
    ctx.fill();
  } else if(kind === 'bulb'){
    ctx.beginPath(); ctx.arc(cx, cy - r*.14, r*.42, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(cx - r*.2, cy + r*.24, r*.4, r*.32);
  } else { // thumb
    ctx.fillRect(cx - r*.52, cy - r*.06, r*.28, r*.56);      // fist
    ctx.beginPath();
    roundRect(ctx, cx - r*.16, cy - r*.44, r*.66, r*.94, r*.16);
    ctx.fill();
    ctx.fillRect(cx - r*.06, cy - r*.62, r*.16, r*.3);        // thumb
  }
}

// the overlapping reaction pill: 👍💡❤️ 47
function drawReactions(ctx, kinds, count, x, y, s, opts){
  const o = opts || {};
  const d = 22*s, step = d*.72;
  kinds.forEach((k, i)=>{
    const cx = x + d/2 + i*step, cy = y;
    ctx.beginPath(); ctx.arc(cx, cy, d/2 + 1.5*s, 0, Math.PI*2);
    ctx.fillStyle = o.ring || '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, d/2, 0, Math.PI*2);
    ctx.fillStyle = (REACTION[k]||REACTION.like).fill; ctx.fill();
    drawGlyph(ctx, (REACTION[k]||REACTION.like).glyph, cx, cy, d/2);
  });
  const tx = x + d + (kinds.length-1)*step + 7*s;
  ctx.fillStyle = o.color || FEED_MUTED;
  ctx.font = `400 ${15*s}px ${SANS}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(String(count), tx, y + 1);
  ctx.textBaseline = 'alphabetic';
  return tx + ctx.measureText(String(count)).width;
}

// one comment: avatar + rounded bubble (name · degree, headline, body) + action row
function drawCommentRow(ctx, c, x, y, w, s, alpha){
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  const av = 44*s, gap = 10*s, pad = 14*s;
  const bx = x + av + gap, bw = w - av - gap;
  ctx.font = `400 ${17*s}px ${SANS}`;
  const body = wrapText(ctx, c.text, bw - 2*pad).slice(0,3);
  const bubbleH = pad + 20*s + 17*s + body.length*(23*s) + pad*.8;

  drawAvatar(ctx, x, y, av, c.initials);
  ctx.fillStyle = BUBBLE;
  roundRect(ctx, bx, y, bw, bubbleH, 10*s); ctx.fill();

  let ty = y + pad + 15*s;
  ctx.textAlign = 'left';
  ctx.font = `600 ${17*s}px ${SANS}`; ctx.fillStyle = FEED_TEXT;
  ctx.fillText(c.name, bx + pad, ty);
  const nameW = ctx.measureText(c.name).width;
  ctx.font = `400 ${14*s}px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText(`· ${c.degree}`, bx + pad + nameW + 7*s, ty);
  ctx.textAlign = 'right';
  ctx.fillText(c.age, bx + bw - pad, ty);
  ctx.textAlign = 'left';
  ty += 19*s;
  ctx.font = `400 ${13.5*s}px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText(c.title, bx + pad, ty, bw - 2*pad - 40*s);
  ty += 22*s;
  ctx.font = `400 ${17*s}px ${SANS}`; ctx.fillStyle = FEED_TEXT;
  for(const line of body){ ctx.fillText(line, bx + pad, ty); ty += 23*s; }

  // reaction pill straddles the bubble's bottom edge, as it does in the feed
  if(c.likes > 0) drawReactions(ctx, c.reactions || ['like'], c.likes, bx + bw - 92*s, y + bubbleH, s);

  const actionY = y + bubbleH + 22*s;
  ctx.font = `600 ${14*s}px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  let ax = bx + pad;
  ['Like','Reply'].forEach((label, i)=>{
    ctx.fillText(label, ax, actionY);
    ax += ctx.measureText(label).width;
    ctx.fillText(' · ', ax, actionY); ax += ctx.measureText(' · ').width;
  });
  if(c.replies) ctx.fillText(`${c.replies} ${c.replies===1?'reply':'replies'}`, ax, actionY);
  else ctx.fillText('Share', ax, actionY);
  ctx.restore();
  return bubbleH + 34*s;
}

function drawComments(ctx, st, now, {x, w, bottom, max, scale}){
  const list = (st.comments || []).slice(-max);
  let y = bottom;
  for(let i=list.length-1; i>=0; i--){
    const c = list[i];
    const a = Math.min(1, (now - c.at)/280);
    const h = drawCommentRow(ctx, c, x, 0, w, scale, a); // measure
    y -= h;
    drawCommentRow(ctx, c, x, y + (1-a)*20, w, scale, a);
    y -= 12*scale;
    if(y < 240) break;
  }
}

// a plate from the image library: the photograph fills the frame under a blue
// veil, with the phrase set across the bottom like a caption in an annual report
// the photograph goes down first, so the masthead can sit on top of it
function drawPlateBackdrop(ctx){
  const plate = currentPlate();
  if(!plate) return false;
  const { img } = plate;
  const scale = Math.max(W/img.width, H/img.height);
  const dw = img.width*scale, dh = img.height*scale;
  ctx.drawImage(img, (W-dw)/2, (H-dh)/2, dw, dh);
  // the house veil — keeps a photograph inside the brand
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(10,102,194,.46)'; ctx.fillRect(0,0,W,H);
  ctx.restore();
  ctx.fillStyle = 'rgba(10,102,194,.16)'; ctx.fillRect(0,0,W,H);
  return true;
}

function drawPlateScene(ctx, st, now){
  const plate = currentPlate();
  if(!plate){ drawPhraseBlock(ctx, st, now, {top: 280, bottom: 900, maxW: W - 2*M, startSize: 120}); return; }
  const { caption } = plate;
  drawChip(ctx, st.exporting ? 'ON THE RECORD' : 'NOW PLAYING', M, 186);
  drawStamp(ctx, W - M - 110, 205);

  // caption plate, bottom third
  const text = st.spoken && st.tickerText ? `“${st.tickerText}”` : 'It’s not an instrument. It’s a journey.';
  const { size, lines } = fitText(ctx, text, W - 2*M, 3, 96, 44);
  const lh = size*1.04;
  const blockH = lines.length*lh + 54;
  const top = H - 96 - blockH;
  ctx.fillStyle = 'rgba(10,102,194,.9)';
  ctx.fillRect(0, top - 26, W, blockH + 52);
  ctx.fillStyle = WHITE; ctx.textAlign = 'left';
  ctx.font = `700 ${size}px ${SANS}`; ctx.letterSpacing = `${(-0.035*size).toFixed(1)}px`;
  const { partial, cursorOn } = st.spoken ? reveal(st, text, now) : {partial:text, cursorOn:false};
  let y = top + size*.84, remaining = partial.length;
  for(const line of lines){
    const shown = line.slice(0, Math.max(0, remaining));
    ctx.fillText(shown, M, y);
    if(cursorOn && remaining >= 0 && remaining <= line.length){
      ctx.fillRect(M + ctx.measureText(shown).width + 8, y - size*.72, size*.5, size*.82);
    }
    remaining -= line.length + 1;
    y += lh;
    if(remaining < 0 && cursorOn) break;
  }
  ctx.letterSpacing = '0px';
  // plate number, like a figure caption
  ctx.fillStyle = TINT; ctx.font = `500 17px ${MONO}`; ctx.letterSpacing = '1.6px';
  ctx.fillText(String(caption).toUpperCase(), M, top + blockH + 6);
  ctx.textAlign = 'right';
  ctx.fillText(engagementLine(st), W - M, top + blockH + 6);
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}

// Zoomed into the thread, the way it looks on a phone held too close: one or
// two comments at reading size, sliding up as they arrive, their reaction
// counts ticking, the whole column drifting like someone is scrolling.
const easeOut = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

function drawFeedZoom(ctx, st, now){
  const x = 44, y = 196, w = W - 88, h = H - y - 74;
  ctx.save();
  ctx.fillStyle = '#fff';
  roundRect(ctx, x, y, w, h, 18); ctx.fill();
  ctx.clip();                                   // the card is the viewport

  const pad = 34;
  const list = (st.comments || []).slice(-2);
  const newest = list.length ? list[list.length-1] : null;
  const age = newest ? (now - newest.at)/1000 : 1;

  // the post being commented on, compact along the top
  drawAvatar(ctx, x + pad, y + pad, 60, 'CB', {fill:'#0a66c2', color:'#fff'});
  ctx.textAlign = 'left';
  ctx.font = `600 26px ${SANS}`; ctx.fillStyle = FEED_TEXT;
  ctx.fillText('Circle Back®', x + pad + 76, y + pad + 26);
  ctx.font = `400 18px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText('The Professional Phrase Organ · now', x + pad + 76, y + pad + 52);
  ctx.textAlign = 'right';
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = '#0a66c2';
  ctx.fillText('+ Follow', x + w - pad, y + pad + 30);
  ctx.textAlign = 'left';

  const e = st.eng || {reactions:0, reposts:0, comments:0};
  let cy = y + pad + 92;
  drawReactions(ctx, ['like','insight','love'], e.reactions.toLocaleString(), x + pad, cy, 1.3);
  ctx.textAlign = 'right';
  ctx.font = `400 20px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText(`${e.comments} comments`, x + w - pad, cy + 7);
  ctx.textAlign = 'left';
  cy += 30;
  ctx.strokeStyle = FEED_FAINT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + pad, cy); ctx.lineTo(x + w - pad, cy); ctx.stroke();
  cy += 34;

  // the thread — big enough to read across a room
  const scale = 1.9;
  const drift = Math.min(1, age/1.2) * 10; // the column settles after each arrival
  list.forEach((c, i)=>{
    const isNew = i === list.length-1;
    const t = easeOut(((now - c.at)/1000) / .45);
    const likes = Math.round(c.likes * easeOut(((now - c.at)/1000 - .25) / .7));
    ctx.save();
    ctx.globalAlpha = isNew ? t : .55 + .45*t;
    ctx.translate(0, (isNew ? (1-t)*70 : 0) - (isNew ? 0 : drift));
    const shown = {...c, likes: Math.max(0, likes)};
    const used = drawCommentRow(ctx, shown, x + pad, cy, w - 2*pad, scale, 1);
    ctx.restore();
    cy += used + 26;
  });

  if(!list.length){
    ctx.font = `400 26px ${SANS}`; ctx.fillStyle = FEED_MUTED;
    ctx.fillText('Be the first to comment on this.', x + pad, cy + 30);
  } else {
    // somebody is always typing
    const dots = Math.floor(now/380) % 4;
    ctx.font = `400 22px ${SANS}`; ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillText(`Someone is typing${'.'.repeat(dots)}`, x + pad + 96, Math.min(cy + 34, y + h - 26));
  }
  ctx.restore();
}

// the whole post, as it appears in the feed — header, body, engagement bar, thread
function drawFeedScene(ctx, st, now){
  const x = 54, y = 200, w = W - 108, h = H - y - 74;
  ctx.fillStyle = '#fff';
  roundRect(ctx, x, y, w, h, 14); ctx.fill();

  const pad = 30;
  let cy = y + pad;
  drawAvatar(ctx, x + pad, cy, 64, 'CB', {fill:'#0a66c2', color:'#fff'});
  ctx.textAlign = 'left';
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = FEED_TEXT;
  ctx.fillText('Circle Back®', x + pad + 78, cy + 24);
  ctx.font = `400 16px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText('The Professional Phrase Organ · Form CB-16', x + pad + 78, cy + 46);
  ctx.font = `400 15px ${SANS}`;
  ctx.fillText('now · Edited · 🌐', x + pad + 78, cy + 66);
  ctx.textAlign = 'right';
  ctx.font = `600 20px ${SANS}`; ctx.fillStyle = '#0a66c2';
  ctx.fillText('+ Follow', x + w - pad, cy + 26);
  ctx.textAlign = 'left';
  cy += 92;

  // the post itself — whatever the organ last said
  const post = st.spoken && st.tickerText ? st.tickerText : 'It’s not an instrument. It’s a journey.';
  ctx.fillStyle = FEED_TEXT;
  let size = 30, lines;
  for(;;){
    ctx.font = `400 ${size}px ${SANS}`;
    lines = wrapText(ctx, post, w - 2*pad);
    if(lines.length <= 3 || size <= 19) break;
    size -= 2;
  }
  lines.slice(0,3).forEach(l=>{ cy += size*1.34; ctx.fillText(l, x + pad, cy); });
  cy += 16;
  ctx.fillStyle = '#0a66c2'; ctx.font = `400 ${size*.9}px ${SANS}`;
  cy += size*1.2;
  ctx.fillText('#thoughtleadership #synergy #hiring', x + pad, cy);
  cy += 26;

  // engagement bar
  const e = st.eng || {reactions:0, reposts:0, comments:0};
  drawReactions(ctx, ['like','insight','love'], e.reactions.toLocaleString(), x + pad, cy + 12, 1.15);
  ctx.textAlign = 'right';
  ctx.font = `400 17px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText(`${e.comments} comments · ${e.reposts} reposts`, x + w - pad, cy + 18);
  ctx.textAlign = 'left';
  cy += 34;
  ctx.strokeStyle = FEED_FAINT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + pad, cy); ctx.lineTo(x + w - pad, cy); ctx.stroke();
  cy += 22;

  // the thread
  const list = (st.comments || []).slice(-3);
  ctx.font = `600 16px ${SANS}`; ctx.fillStyle = FEED_MUTED;
  ctx.fillText('Most relevant', x + pad, cy + 6);
  cy += 24;
  for(const c of list){
    if(cy > y + h - 80) break;
    const a = Math.min(1, (now - c.at)/280);
    cy += drawCommentRow(ctx, c, x + pad, cy + (1-a)*16, w - 2*pad, 1.02, a) + 6;
  }
  if(!list.length){
    ctx.font = `400 18px ${SANS}`; ctx.fillStyle = FEED_MUTED;
    ctx.fillText('Be the first to comment on this.', x + pad, cy + 24);
  }
}

function draw(ctx, st){
  const now = performance.now();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.letterSpacing = '0px';

  let scene = 'composite';
  if(st.exporting && st.exportStartedAt){
    const el = (now - st.exportStartedAt)/1000;
    const dur = st.sceneDur || 5;
    const ix = Math.floor(el/dur) % SCENES.length;
    scene = SCENES[ix];
    // cut to a fresh plate every time the director returns to the library
    if(scene === 'plate' && draw._lastPlateIx !== ix){ advancePlate(); draw._lastPlateIx = ix; }
    else if(scene !== 'plate') draw._lastPlateIx = -1;
  }
  if(scene === 'plate' && libraryReady()){
    drawPlateBackdrop(ctx);      // photograph first…
    drawChrome(ctx, st, true);   // …masthead over it
  } else {
    if(scene === 'plate') scene = 'phrase'; // library still loading
    drawChrome(ctx, st);
    // the beat machine, translucent, underneath the type
    if(scene === 'composite') drawAsciiField(ctx, st, now, {alpha:.15});
    else if(scene === 'phrase') drawAsciiField(ctx, st, now, {alpha:.1});
  }

  if(scene === 'phrase'){
    drawChip(ctx, st.exporting ? 'ON THE RECORD' : 'NOW PLAYING', M, 186);
    drawStamp(ctx, W - M - 110, 205);
    drawPhraseBlock(ctx, st, now, {top: 280, bottom: 900, maxW: W - 2*M, startSize: 120});
    drawEngagement(ctx, st, M, 972, 20, 'left');
  } else if(scene === 'pads'){
    drawChip(ctx, 'PRESS TO OPINE', M, 186);
    drawPadsBlock(ctx, st, now, {top: 250, bottom: 990});
  } else if(scene === 'plate'){
    drawPlateScene(ctx, st, now);
  } else if(scene === 'eq'){
    drawAsciiField(ctx, st, now, {alpha:.5, cols:64, rows:34});
    drawChip(ctx, 'THE MIX', M, 186);
    drawPhraseBlock(ctx, st, now, {top: 420, bottom: 700, maxW: W - 2*M, startSize: 92, maxLines: 3});
    drawEngagement(ctx, st, M, 995, 18, 'left');
  } else if(scene === 'grid'){
    drawChip(ctx, 'THE CADENCE', M, 186);
    drawGridBlock(ctx, st, {top: 260, bottom: 990, labelW: 200, labelSize: 19});
  } else if(scene === 'feed'){
    drawChip(ctx, 'THE COMMENTS ARE IN', M, 152);
    drawFeedZoom(ctx, st, now);
  } else {
    // the stage — what the room sees
    const chipW = drawChip(ctx, st.exporting ? 'ON THE RECORD' : 'NOW PLAYING', M, 186);
    if(st.section){ // GROOVE · BUILD · DROP
      ctx.font = `700 19px ${SANS}`; ctx.letterSpacing = '3.5px';
      const label = String(st.section).toUpperCase();
      const w = ctx.measureText(label).width + 24;
      ctx.strokeStyle = WHITE; ctx.lineWidth = 3;
      ctx.strokeRect(M + chipW + 14, 186, w, 38);
      ctx.fillStyle = WHITE; ctx.textAlign = 'left';
      ctx.fillText(label, M + chipW + 26, 212);
      ctx.letterSpacing = '0px';
    }
    drawStamp(ctx, W - M - 110, 205);
    // the phrase is the only loud thing; everything else is weather behind it
    drawPhraseBlock(ctx, st, now, {top: 268, bottom: 726, maxW: W - 2*M, startSize: 132});
    const c = st.comments && st.comments.length ? st.comments[st.comments.length-1] : null;
    if(c) drawCommentRow(ctx, c, M, 800, W - 2*M, 1.02, Math.min(1, (now - c.at)/280));
    drawEngagement(ctx, st, W/2, 1002, 19, 'center');
    // the room breathes on the kick
    if(st.kickAt){
      const age = (now - st.kickAt)/1000;
      if(age < .22){
        ctx.strokeStyle = `rgba(255,255,255,${(1 - age/.22)*.5})`;
        ctx.lineWidth = 14; ctx.strokeRect(7, 7, W-14, H-14);
      }
    }
  }
}

export const Monitor = forwardRef(function Monitor({ stateRef, style }, ref){
  const inner = useRef(null);
  const setRefs = el => { inner.current = el; if(typeof ref === 'function') ref(el); else if(ref) ref.current = el; };
  useEffect(()=>{ loadLibrary(import.meta.env.BASE_URL).catch(()=>{}); },[]);
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
