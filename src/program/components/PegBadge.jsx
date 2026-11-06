// The peg badge: the All Hands seal, alive. A ring of lit pegs round a black
// disc, the mark in PEG-9 pegs with the terminal beat in signal, the learner's
// name on the ring. It boots peg by peg in stroke order, idles with a slow
// chase and a pulse on the beat, blooms under the pointer, and celebrates on
// a tap. One canvas, drawn from a clock; a still frame exports as a PNG.
import React, {useCallback, useEffect, useImperativeHandle, useRef, forwardRef} from 'react';
import {compileFont, layoutText} from '../../pegboard/font.js';
import {PEG9} from '../../pegboard/fonts/peg9.js';
import './peg-badge.css';

const FONT = compileFont(PEG9);
const V = 600, C = 300, RING_R = 262, RING_N = 72, DISC_R = 188, PITCH = 14, PEG_R = 5.6;
const BLUE = '#2b78ff', WHITE = '#ffffff', SIGNAL = '#ffe14d';
const BOOT = {sockets:[0, .6], ring:[.4, 1.6], type:[1.5, 2.7], beat:2.75, text:[2.4, 3.4], done:3.6};
const BEAT = .5;   // 120 BPM

function sprite(size, core, tone) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, core); g.addColorStop(.2, tone); g.addColorStop(.36, tone + 'aa'); g.addColorStop(.6, tone + '22'); g.addColorStop(1, tone + '00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}
const hash = (i, k) => { let h = (i * 374761393 + k * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = p => 1 - (1 - clamp(p)) ** 3;

// The mark's pegs, in stroke order, centred; and the signal beat after it.
function markPegs(text = 'LB') {
  const layout = layoutText(text, {font:FONT, k:1, maxCols:40, maxLines:1});
  const w = layout.width * PITCH, h = layout.height * PITCH, ox = C - w / 2 - PITCH, oy = C - h / 2 + 6;
  const pegs = [];
  for (const line of layout.pages[0].lines) for (const ch of line.chars) for (let i = 0; i < ch.pegs.length; i += 2) pegs.push([ox + ch.pegs[i] * PITCH + PITCH / 2, oy + ch.pegs[i + 1] * PITCH + PITCH / 2]);
  const lines = layout.pages[0].lines, last = lines[lines.length - 1].chars.at(-1);
  const bx = ox + (last.x + last.w + 1) * PITCH + PITCH / 2, by = oy + (last.y + last.h - 2) * PITCH + PITCH / 2;
  const beat = [];
  for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) beat.push([bx + xx * PITCH, by + yy * PITCH]);
  return {pegs, beat};
}
const MARK = markPegs();
const RING = Array.from({length:RING_N}, (_, i) => { const a = i / RING_N * Math.PI * 2 - Math.PI / 2; return [C + Math.cos(a) * RING_R, C + Math.sin(a) * RING_R, i]; });
const SOCKETS = [];
for (let gy = -13; gy <= 13; gy++) for (let gx = -13; gx <= 13; gx++) { const x = C + gx * PITCH, y = C + gy * PITCH; if (Math.hypot(x - C, y - C) < DISC_R - 4) SOCKETS.push([x, y]); }

// Text on an arc, one character at a time: the top reads over the mark, the
// bottom reads under it, both left to right.
function arcText(ctx, text, r, {top = true, size = 19, spacing = 6, color = '#f2eee6', font = "'LB Azeret Mono', 'Azeret Mono', Menlo, monospace", reveal = 1, weight = 500}) {
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  const chars = [...text], widths = chars.map(c => ctx.measureText(c).width + spacing), total = widths.reduce((a, b) => a + b, 0) - spacing;
  const n = Math.ceil(chars.length * clamp(reveal));
  // Angles run left to right for the reader: on the bottom arc the leftmost
  // character sits at the largest angle from twelve o'clock.
  let a = -total / 2 / r;
  chars.forEach((ch, i) => {
    const mid = a + (widths[i] - spacing) / 2 / r;
    if (i < n) {
      ctx.save();
      if (top) { ctx.translate(C + Math.sin(mid) * r, C - Math.cos(mid) * r); ctx.rotate(mid); }
      else { const b = Math.PI - mid; ctx.translate(C + Math.sin(b) * r, C - Math.cos(b) * r); ctx.rotate(b - Math.PI); }
      ctx.fillText(ch, 0, 0); ctx.restore();
    }
    a += widths[i] / r;
  });
  ctx.restore();
}

export const PegBadge = forwardRef(function PegBadge({name = 'Aspiring Thought Leader', title = 'Certified Thought Leader', footer = 'LinkedIn Beats Academy · MMXXVI', size = 420, interactive = true, reduced = false, className = ''}, ref) {
  const canvas = useRef(null), wrap = useRef(null), state = useRef({t0:0, pointer:null, celebrate:-1, tilt:[0, 0]});
  const sprites = useRef(null);

  const draw = useCallback((ctx, t, {dpr = 1, pointer = null, celebrate = -1, still = false} = {}) => {
    const S = sprites.current ||= {blue:sprite(64, '#ddebff', BLUE), white:sprite(64, '#ffffff', '#cfe0ff'), signal:sprite(64, '#fff8d6', SIGNAL)};
    const px = size * dpr / V;
    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.clearRect(0, 0, V, V);
    const T = still ? BOOT.done + 10 : t, booted = T >= BOOT.done;
    const phase = (lo, hi) => clamp((T - lo) / (hi - lo));
    // the disc
    ctx.beginPath(); ctx.arc(C, C, 296, 0, Math.PI * 2); ctx.fillStyle = '#0a0a0b'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#2a2b31';
    ctx.beginPath(); ctx.arc(C, C, 282, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(C, C, 242, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(C, C, DISC_R, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
    // sockets
    const sock = phase(...BOOT.sockets);
    ctx.fillStyle = '#1e1f24'; ctx.globalAlpha = sock;
    for (const [x, y] of SOCKETS) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#1b1b1f';
    for (const [x, y] of RING) { ctx.beginPath(); ctx.arc(x, y, PEG_R + 1.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;

    const peg = (x, y, img, I, scale = 1) => { const s = PEG_R * 2 * 3.6 * scale; ctx.globalAlpha = clamp(I, 0, 1); ctx.drawImage(img, x - s / 2, y - s / 2, s, s); if (I > 1) { ctx.globalAlpha = clamp(I - 1, 0, .8); ctx.drawImage(S.white, x - s / 2, y - s / 2, s, s); } };
    const near = (x, y) => pointer ? clamp(1 - Math.hypot(x - pointer[0], y - pointer[1]) / 70) : 0;
    const celebrating = celebrate >= 0 && T - celebrate < 1.4, cAge = celebrating ? T - celebrate : 99;

    ctx.globalCompositeOperation = 'lighter';
    // the ring: a sweep at boot, then a slow chase; a double sweep when celebrating
    const sweep = phase(...BOOT.ring) * (RING_N + 8);
    for (const [x, y, i] of RING) {
      let I = 0;
      if (!booted) { const d = sweep - i; I = d < 0 ? 0 : d < 3 ? 1.4 : d < 10 ? 1 - (d - 3) / 7 * .55 : .45; }
      else if (celebrating) { const d = (cAge * 160) % RING_N; const dist = ((i - d) % RING_N + RING_N) % RING_N; I = dist < 10 ? 1.4 - dist * .08 : .55; }
      else { const chase = ((i - Math.floor(T * (6 + (pointer ? 6 : 0)))) % 3 + 3) % 3 === 0; I = chase ? 1 : .42 + .1 * Math.sin(T * 1.3 + i * .4); }
      const img = i % 3 === 0 ? S.white : S.blue;
      if (I > 0) peg(x, y, img, I + near(x, y) * .6, 1 + near(x, y) * .25);
    }
    // the mark, in stroke order, each peg popping in; then breathing
    const typed = ease(phase(...BOOT.type)) * MARK.pegs.length;
    MARK.pegs.forEach(([x, y], i) => {
      let I, scale = 1;
      if (!booted) { const age = typed - i; if (age < 0) return; I = age < 2 ? 1.6 : 1; scale = age < 2 ? 1.3 - age * .15 : 1; }
      else { I = .92 + .08 * Math.sin(T * 2 + i * .05); if (celebrating) { I = cAge < .25 ? 1.8 : 1 + .4 * Math.max(0, 1 - cAge); } }
      const n = near(x, y); peg(x, y, S.blue, I + n * .8, scale + n * .3);
    });
    // the beat: lands after the mark, then pulses at 120
    if (T >= BOOT.beat || still) {
      const age = T - BOOT.beat, pulse = still ? 1 : booted ? 1 + .25 * Math.max(0, 1 - ((T % BEAT) / BEAT) * 3) : age < .25 ? 1.8 - age * 2 : 1;
      for (const [x, y] of MARK.beat) peg(x, y, S.signal, pulse + (celebrating && cAge < .3 ? .6 : 0), age < .25 && !still ? 1.4 : 1 + (pulse - 1) * .5);
    }
    // a sparkle now and then: one ring peg, white-hot, never two in the same second
    if (booted && !still && !celebrating) { const slot = Math.floor(T * 1.5); if (hash(slot, 7) < .5) { const i = Math.floor(hash(slot, 11) * RING_N), [x, y] = RING[i], a = (T * 1.5) % 1; if (a < .3) peg(x, y, S.white, 1.6 * (1 - a / .3), 1.3); } }
    ctx.globalCompositeOperation = 'source-over';
    // the text ring
    const reveal = still ? 1 : phase(...BOOT.text);
    arcText(ctx, title.toUpperCase(), 214, {top:true, size:19, spacing:6, reveal});
    arcText(ctx, (name || 'Aspiring Thought Leader').toUpperCase(), 214, {top:false, size:16, spacing:5, color:'#f2eee6', reveal});
    ctx.save(); ctx.font = "500 10px 'LB Azeret Mono', 'Azeret Mono', Menlo, monospace"; ctx.fillStyle = '#6b7079'; ctx.textAlign = 'center'; ctx.globalAlpha = reveal; ctx.fillText(footer.toUpperCase().split('').join(' '), C, 572); ctx.restore();
  }, [size, title, name, footer]);

  useImperativeHandle(ref, () => ({
    // A still of the finished badge at 2x, as a PNG blob, for a download or a post.
    async toBlob(scale = 2) {
      const c = document.createElement('canvas'); c.width = c.height = size * scale;
      draw(c.getContext('2d'), 0, {dpr:scale, still:true});
      return new Promise(resolve => c.toBlob(resolve, 'image/png'));
    },
    celebrate() { state.current.celebrate = (performance.now() - state.current.t0) / 1000; },
  }), [draw, size]);

  const drawRef = useRef(draw); drawRef.current = draw;
  useEffect(() => { if (reduced) { const el = canvas.current; drawRef.current(el.getContext('2d'), 0, {dpr:el.width / size, still:true}); } }, [draw, reduced, size]);
  useEffect(() => {
    const el = canvas.current, ctx = el.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = el.height = size * dpr; el.style.width = el.style.height = `${size}px`;
    const s = state.current; s.t0 = performance.now(); s.celebrate = -1;
    if (reduced) { drawRef.current(ctx, 0, {dpr, still:true}); return; }
    let frame;
    const tick = () => { frame = requestAnimationFrame(tick); drawRef.current(ctx, (performance.now() - s.t0) / 1000, {dpr, pointer:s.pointer, celebrate:s.celebrate}); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [size, reduced]);

  const move = e => {
    if (!interactive || reduced) return;
    const r = canvas.current.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * V, y = (e.clientY - r.top) / r.height * V;
    state.current.pointer = [x, y];
    wrap.current.style.transform = `perspective(900px) rotateX(${((y - C) / C * -7).toFixed(2)}deg) rotateY(${((x - C) / C * 7).toFixed(2)}deg)`;
  };
  const leave = () => { state.current.pointer = null; if (wrap.current) wrap.current.style.transform = ''; };
  const tap = () => { if (!reduced) state.current.celebrate = (performance.now() - state.current.t0) / 1000; };

  return <div className={`peg-badge ${className}`} ref={wrap} style={{width:size, height:size}}>
    <canvas ref={canvas} className="peg-badge-canvas" role="img" aria-label={`${title} badge for ${name}, ${footer}`} onPointerMove={move} onPointerLeave={leave} onPointerDown={tap}/>
  </div>;
});

export default PegBadge;
