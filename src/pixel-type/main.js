// /pixel-type/: the Peg Board type specimen, the proof sheet Aaron signs.
// Every board here is lit by the production modules (font.js, choreo.js,
// governor.js, eq.js) and drawn by the production renderer, so what is
// approved on this page is exactly what ships in All Hands.
import './pixel-type.css';
import {clearBoard, createBoard, light, PALETTE, SOCKET} from '../pegboard/board.js';
import {createRenderer} from '../pegboard/renderer.js';
import {CHARSET, FORMATS, compileFont, fit, kern, layoutText, normalize} from '../pegboard/font.js';
import {PEG9} from '../pegboard/fonts/peg9.js';
import {PEG5} from '../pegboard/fonts/peg5.js';
import {PEG3} from '../pegboard/fonts/peg3.js';
import {activeScreen, buildScreens, indexWords, paint} from '../pegboard/choreo.js';
import {linesFor, stagePitch} from '../pegboard/stage.js';
import {boardLuma, governorTrack} from '../pegboard/governor.js';
import {createFollower, departments, scoreAccent, LEAD} from '../pegboard/eq.js';
import {LOOKS, PSYCH_LOOKS, paintPsych, driveTrack, driveAt} from '../pegboard/psych.js';
import {SHAPES as LIP_SHAPES, code as lipCode} from '../pegboard/lips.js';
import PHRASES from '../allhands/lady-phrases.json';

const DPR = Math.min(2, window.devicePixelRatio || 1);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FORCE2D = new URLSearchParams(location.search).get('renderer') === '2d';   // ?renderer=2d: the fallback, for comparison
const BEAT = .5, FPS = 24;
const F = {peg9:compileFont(PEG9), peg5:compileFont(PEG5), peg3:compileFont(PEG3)};
const TONE = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.id]));
const GLYPHS = [...CHARSET].filter(c => c !== ' ');
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const pad = n => String(n).padStart(2, '0');
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

// ---- drawing ---------------------------------------------------------------------

// A whole-peg grid centred in a CSS box.
function grid(width, height, pitch) {
  const cols = Math.max(1, Math.floor(width / pitch)), rows = Math.max(1, Math.floor(height / pitch));
  return {cols, rows, pitch, x:Math.floor((width - cols * pitch) / 2), y:Math.floor((height - rows * pitch) / 2)};
}

// Still boards share one off-screen renderer; each draw is copied into the
// board's own canvas, so the page holds one GL context for all of them.
let stampR = null, stampSize = '';
function blit(canvas, board, {pitch, x = 0, y = 0, width, height, time = 0}) {
  stampR ||= createRenderer(document.createElement('canvas'), {pixelRatio:DPR, force2d:FORCE2D});
  const key = `${width}x${height}`;
  if (key !== stampSize) { stampR.resize(width, height); stampSize = key; }
  stampR.draw(board, {pitch, x, y, time});
  const src = stampR.canvas;
  if (canvas.width !== src.width || canvas.height !== src.height) { canvas.width = src.width; canvas.height = src.height; }
  canvas.getContext('2d', {alpha:false}).drawImage(src, 0, 0);
}

// Set glyphs straight from their masks, k x k pegs per bit. Returns the width.
function glyphRun(board, font, text, x0, y0, {k = 1, I = 1, tone = TONE.blue, white = 0, kerning = true, toneAt} = {}) {
  const chars = [...text];
  let x = x0;
  chars.forEach((ch, i) => {
    const next = chars[i + 1];
    if (ch === ' ') { x += font.space * k; return; }
    const g = font.glyph(ch);
    if (!g) return;
    const t = toneAt ? toneAt(i, ch) : tone;
    if (board) for (let gy = 0; gy < g.h; gy++) for (let gx = 0; gx < g.w; gx++) if (g.mask[gy * g.w + gx])
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) light(board, x + gx * k + b, y0 + gy * k + a, I, {tone:t, white});
    x += g.w * k;
    if (next && next !== ' ') x += (font.tracking + (kerning ? kern(font, ch, next) : 0)) * k;
  });
  return x - x0;
}
const runWidth = (font, text, k = 1, kerning = true) => glyphRun(null, font, text, 0, 0, {k, kerning});

function lightPage(board, page, ox, oy, opts = {}) {
  if (!page) return;
  for (const line of page.lines) for (const c of line.chars)
    for (let i = 0; i < c.pegs.length; i += 2) light(board, ox + c.pegs[i], oy + c.pegs[i + 1], opts.I ?? 1, opts);
}

// ---- frames: still boards render when near the viewport, live ones tick while visible

const stillIO = new IntersectionObserver(entries => {
  for (const e of entries) { const s = e.target.__still; s.visible = e.isIntersecting; if (s.visible && s.dirty) s.render(); }
}, {rootMargin:'500px 0px'});

function stillFrame(frame, build) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  frame.prepend(canvas);
  const s = {frame, canvas, visible:false, dirty:true, width:0,
    render() {
      const width = frame.clientWidth;
      if (!width) return;
      s.dirty = false; s.width = width;
      const out = build(width, s);
      if (!out) return;
      if (out.height) frame.style.height = `${out.height}px`;
      blit(canvas, out.board, {...out, width, height:out.height || frame.clientHeight});
    },
    invalidate() { s.dirty = true; if (s.visible) s.render(); },
  };
  // Boards that set their own height take it now, so nothing shifts when they light.
  const w = frame.clientWidth, first = w ? build(w, s) : null;
  if (first?.height) frame.style.height = `${first.height}px`;
  frame.__still = s;
  stillIO.observe(frame);
  new ResizeObserver(() => { if (frame.clientWidth !== s.width) s.invalidate(); }).observe(frame);
  return s;
}

const lives = new Set();
const liveIO = new IntersectionObserver(entries => { for (const e of entries) e.target.__live.visible = e.isIntersecting; }, {rootMargin:'60px 0px'});

function liveFrame(frame, {pitchFor, resize, tick}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  frame.prepend(canvas);
  const L = {frame, visible:false, board:null, geo:null, kick:0, renderer:createRenderer(canvas, {pixelRatio:DPR, force2d:FORCE2D}),
    size() {
      const w = frame.clientWidth, h = frame.clientHeight;
      if (!w || !h) return;
      L.geo = grid(w, h, pitchFor(w, h));
      L.board = createBoard(L.geo.cols, L.geo.rows);
      L.renderer.resize(w, h);
      resize?.(L);
    },
    tick(t) {
      if (!L.board) return;
      tick(L, t);
      L.renderer.draw(L.board, {pitch:L.geo.pitch, x:L.geo.x, y:L.geo.y, time:REDUCED ? 0 : t, kick:L.kick});
    },
  };
  frame.__live = L;
  liveIO.observe(frame);
  lives.add(L);
  new ResizeObserver(() => L.size()).observe(frame);
  return L;
}

// ---- screens: hand-timed lines for choreo.paint --------------------------------------

function screenOf(text, {from, to, starts, ends, reveal = 'pop', tone = 'blue', k = 1, voice = 'board', accent = -1, fx = {}, release = 'afterglow'}) {
  const norm = normalize(text).text, parts = norm.split(' ');
  const words = parts.map((w, i) => {
    const start = starts?.[i] ?? from + .2 + i * BEAT;
    const end = ends?.[i] ?? starts?.[i + 1] ?? start + BEAT;
    return {text:w, start, end:Math.min(end, to), units:[{chars:[0, w.length], start}]};
  });
  return indexWords({kind:'title', voice, from, to, text:norm, words, accent, reveal, tone, k, release, fx});
}

// The largest k that fits the board on one page, PEG-9 first, then PEG-5.
function chooser(L, {maxLines = 2, margin = 6} = {}) {
  const cache = new Map();
  return {
    layoutOf(screen) {
      if (cache.has(screen)) return cache.get(screen);
      const {cols, rows} = L.board, room = cols - 2 * margin;
      let out = null;
      for (const face of ['peg9', 'peg5']) {
        for (let k = screen.k; k >= 1 && !out; k--) {
          const l = layoutText(screen.text, {font:F[face], k, maxCols:room, maxLines});
          if (l.width <= room && l.height <= rows - 4 && l.pages.length === 1) out = l;
        }
        if (out) break;
      }
      out ||= layoutText(screen.text, {font:F.peg5, k:1, maxCols:room, maxLines});
      cache.set(screen, out);
      return out;
    },
    place:(screen, layout) => ({x:Math.floor((L.board.cols - layout.width) / 2), y:Math.floor((L.board.rows - layout.height) / 2)}),
  };
}

// ---- 00 the reel -------------------------------------------------------------------

const REEL = [
  {text:'PEG BOARD', reveal:'centre', tone:'white', k:3, beats:7, label:'Centre', use:'the drop'},
  {text:"LET'S CIRCLE BACK", reveal:'pop', k:2, beats:6, label:'Pop', use:'the answers'},
  {text:'PER MY LAST EMAIL', reveal:'typewriter', tone:'white', k:2, beats:6, label:'Typewriter', use:'the host'},
  {text:'LET THAT SINK IN', reveal:'sparkle', tone:'deep', k:2, beats:9, step:.75, label:'Sparkle', use:'slow motion'},
  {text:"LET'S TAKE THIS OFFLINE", reveal:'wipe', k:2, beats:8, accent:3, label:'Wipe', use:'the hook'},
  {text:'THOUGHTS?', reveal:'stroke', k:3, beats:5, label:'Stroke', use:'pen order'},
  {text:'FULL STOP.', reveal:'scanline', tone:'white', k:3, beats:6, label:'Scanline', use:'the verse'},
];

function reel() {
  let at = .7;
  const screens = [];
  REEL.forEach((r, i) => {
    const n = normalize(r.text).text.split(' ').length, step = r.step ?? BEAT;
    const starts = Array.from({length:n}, (_, j) => at + .3 + j * step), to = at + r.beats * BEAT - .35;
    screens.push(Object.assign(screenOf(r.text, {from:at, to, starts, reveal:r.reveal, tone:r.tone, k:r.k, accent:r.accent}), {reel:i}));
    at += r.beats * BEAT;
  });
  return {screens, period:at};
}

function hero() {
  const frame = $('[data-live=hero]'), label = $('[data-reel]'), kind = $('[data-kind]');
  const {screens, period} = reel();
  let pick = null, gains = null, job = 0, shown = -2, t0 = null;
  // The reel obeys the house rule too: no more than three flashes a second.
  const govern = (L, id) => {
    const board = createBoard(L.board.cols, L.board.rows), frames = [], n = Math.ceil(period * FPS);
    const step = () => {
      if (id !== job) return;
      for (let c = 0; c < 36 && frames.length < n; c++) {
        paint(board, screens, frames.length / FPS, {layoutOf:pick.layoutOf, place:pick.place, reduced:REDUCED});
        frames.push(boardLuma(board));
      }
      if (frames.length < n) setTimeout(step, 0); else gains = governorTrack(frames, FPS);
    };
    setTimeout(step, 300);
  };
  liveFrame(frame, {
    pitchFor:(w, h) => clamp(Math.floor(Math.min(w / 172, h / 84)), 4, 12),
    resize(L) {
      pick = chooser(L, {maxLines:2, margin:8}); gains = null; govern(L, ++job);
      kind.textContent = `${L.geo.cols} × ${L.geo.rows} pegs · ${L.renderer.kind === 'webgl2' ? 'WebGL2' : 'Canvas2D'}`;
    },
    tick(L, t) {
      t0 ??= t;
      const lt = (t - t0) % period;
      paint(L.board, screens, lt + LEAD, {layoutOf:pick.layoutOf, place:pick.place, reduced:REDUCED});
      if (t - t0 < 1) L.board.sockets = clamp((t - t0) / .6);            // power on, once
      const s = activeScreen(screens, lt + LEAD);
      if (s?.tone === 'deep') L.board.bloom = 1.6;
      const g = gains?.[Math.floor((lt + LEAD) * FPS)];
      if (g) L.board.exposure *= g;
      const i = s ? s.reel : shown;
      if (i !== shown && i >= 0) { shown = i; label.textContent = `Reel ${pad(i + 1)} / ${pad(REEL.length)} · ${REEL[i].label}, ${REEL[i].use}`; }
    },
  });
}

// ---- 01 faces ----------------------------------------------------------------------

const FACE_INFO = [
  {id:'peg9', name:'PEG-9 Heavy', cell:'7 × 9 pegs, 2 below', weight:'2-peg stems, 2-row bars, 1-row crossbars', role:'The read-out. Every word Synergy and the lady say.'},
  {id:'peg5', name:'PEG-5', cell:'5 × 7 pegs, 1 below', weight:'1-peg stems', role:'The fallback. When PEG-9 cannot hold a line at the board\'s pitch, PEG-5 takes it.'},
  {id:'peg3', name:'PEG-3', cell:'3 × 5 pegs, 1 below', weight:'1-peg stems, pitch 12 and up', role:'Small print: labels, credits, time code.'},
];

function faces() {
  const root = $('[data-faces]');
  for (const info of FACE_INFO) {
    const font = F[info.id];
    const card = el('article', 'pt-face', `<div><h3>${info.name}</h3><dl>
      <div><dt>Cell</dt><dd>${info.cell}</dd></div><div><dt>Weight</dt><dd>${info.weight}</dd></div>
      <div><dt>Glyphs</dt><dd>${GLYPHS.length}, capitals only</dd></div><div><dt>Role</dt><dd>${info.role}</dd></div></dl></div>`);
    const frame = el('div', 'pt-frame');
    card.append(frame); root.append(card);
    stillFrame(frame, width => {
      // One pitch for all three faces, so their sizes compare honestly.
      const pitch = clamp(Math.floor(width / 150), 3, 9), cols = Math.floor(width / pitch);
      const cw = Math.max(...GLYPHS.map(c => font.glyph(c).w)) + 3, ch = font.height + 3;
      const perRow = Math.max(1, Math.floor((cols - 2) / cw)), lines = Math.ceil(GLYPHS.length / perRow), rows = lines * ch + 3;
      const board = createBoard(cols, rows), left = Math.floor((cols - perRow * cw) / 2);
      GLYPHS.forEach((c, i) => {
        const g = font.glyph(c), x = left + (i % perRow) * cw + Math.floor((cw - g.w) / 2), y = 2 + Math.floor(i / perRow) * ch;
        glyphRun(board, font, c, x, y, {tone:/[A-Z]/.test(c) ? TONE.blue : TONE.white});
      });
      return {board, pitch, height:rows * pitch, x:Math.floor((width - cols * pitch) / 2)};
    });
  }
}

// ---- 02 scale ----------------------------------------------------------------------

function scale() {
  const frame = $('[data-still=scale]'), labels = $('[data-scale-labels]'), word = 'BA';
  stillFrame(frame, width => {
    const pitch = clamp(Math.floor(width / 176), 3, 8), cols = Math.floor(width / pitch);
    let ks = [1, 2, 3, 4], gap = 10;
    const total = list => list.reduce((s, k) => s + runWidth(F.peg9, word, k), 0) + gap * (list.length - 1);
    while (ks.length > 2 && total(ks) > cols - 6) ks = ks.slice(0, -1);
    const top = Math.max(...ks) * F.peg9.rows, rows = top + 6, board = createBoard(cols, rows);
    const ox = Math.floor((width - cols * pitch) / 2);
    let x = Math.floor((cols - total(ks)) / 2);
    labels.innerHTML = '';
    for (const k of ks) {
      const w = glyphRun(board, F.peg9, word, x, 3 + top - k * F.peg9.rows, {k, tone:k === 4 ? TONE.white : TONE.blue});
      labels.append(el('span', '', `<b>k ${k}</b><span> · ${k * F.peg9.rows} pegs tall</span>`));
      labels.lastChild.style.left = `${ox + x * pitch}px`;
      x += w + gap;
    }
    return {board, pitch, height:rows * pitch, x:ox};
  });
}

// ---- 03 palette --------------------------------------------------------------------

const TONE_INFO = [
  {id:'blue', name:'Blue', role:'The voice. Synergy and the band.'},
  {id:'white', name:'White', role:'The host, the lady, every peak peg.'},
  {id:'signal', name:'Signal', role:'One word per hook. Never two.'},
  {id:'deep', name:'Deep', role:'Slow motion only, at k 2 and up.'},
];
const RAMP = [.15, .35, .6, 1, 1.3, 1.6, 2];

function palette() {
  const root = $('[data-tones]');
  for (const t of TONE_INFO) {
    const p = PALETTE[t.id];
    const card = el('div', 'pt-tone'), frame = el('div', 'pt-frame');
    card.append(frame);
    card.insertAdjacentHTML('beforeend', `<h3>${t.name}</h3><p>${t.role}</p><ul class="pt-hex">
      ${[['Ring', p.ring], ['Core', p.core], ['Glow', p.glow]].map(([n, hex]) => `<li><i style="background:${hex}"></i>${n}<b>${hex}</b></li>`).join('')}</ul>`);
    root.append(card);
    stillFrame(frame, width => {
      const board = createBoard(7, 3);
      RAMP.forEach((I, x) => light(board, x, 1, I, {tone:p.id}));
      return {board, pitch:width / 7};
    });
  }
  $('[data-sockets]').innerHTML = [['Hole', SOCKET.hole, 'An unlit peg'], ['Lip', SOCKET.lip, 'Its lower-right edge'], ['Board', SOCKET.board, 'Between sockets']]
    .map(([n, hex, note]) => `<div><i style="background:${hex}"></i><span><b>${n} ${hex}</b>${note}</span></div>`).join('')
    + `<div><span><b>Ramp</b>Intensity ${RAMP.join(' · ')}. Past 1, a peg burns toward white.</span></div>`;
}

// ---- 04 kerning --------------------------------------------------------------------

const KERN_LINES = ["LET'S TALK VALUE.", 'YEARLY TARGET.'];
const KERN_PAIRS = ['LT', 'TA', 'AV', 'VA', 'AT', 'T.', "L'", 'FA', 'YA', 'LY', 'HH', 'TO', '-C', 'PA'];

function kerning() {
  const frame = $('[data-still=kerning]');
  let on = true;
  const s = stillFrame(frame, width => {
    // k 2 where it fits at pitch 3 or more; phones drop to k 1.
    const need = k => Math.max(...KERN_LINES.map(l => runWidth(F.peg9, l, k, false))) + 6 * k;
    const k = width / need(2) >= 3 ? 2 : 1;
    const pitch = clamp(Math.floor(width / need(k)), 2, 8), cols = Math.floor(width / pitch);
    const lineH = F.peg9.advance * k, rows = KERN_LINES.length * lineH + 4, board = createBoard(cols, rows);
    KERN_LINES.forEach((line, j) => {
      const chars = [...line], w = runWidth(F.peg9, line, k, on);
      // Kerned pairs light white, so the closings are visible.
      const closed = new Set();
      if (on) chars.forEach((c, i) => { if (chars[i + 1] && kern(F.peg9, c, chars[i + 1])) { closed.add(i); closed.add(i + 1); } });
      glyphRun(board, F.peg9, line, Math.floor((cols - w) / 2), 3 + j * lineH, {k, kerning:on, toneAt:i => closed.has(i) ? TONE.white : TONE.blue});
    });
    return {board, pitch, height:rows * pitch, x:Math.floor((width - cols * pitch) / 2)};
  });
  const seg = $('[data-kern="on"]').parentElement;
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    on = b.dataset.kern === 'on';
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    s.invalidate();
  });
  const counts = ['peg9', 'peg5', 'peg3'].map(id => { let n = 0; for (const a of GLYPHS) for (const b of GLYPHS) if (kern(F[id], a, b)) n++; return n; });
  const all = (GLYPHS.length ** 2).toLocaleString('en-US');
  $('[data-kern-stat]').textContent = `Pairs that close: PEG-9 ${counts[0]} · PEG-5 ${counts[1]} · PEG-3 ${counts[2]}, of ${all}`;
  $('[data-pairs]').innerHTML = KERN_PAIRS.map(p => { const v = kern(F.peg9, p[0], p[1]); return `<li class="${v ? 'k' : ''}"><span>${esc(p)}</span><b>${v ? '−1' : '0'}</b></li>`; }).join('');
}

// ---- 05 reveals --------------------------------------------------------------------

const REVEALS = [
  {id:'pop', text:'CIRCLE BACK', k:3, use:'Answers, repeats, the drop', note:'Every peg fires white-hot at 1.6, settles to full in 60 ms and springs from 1.25× into its socket. Syllables closer than 0.37 s glow instead, so fast words never strobe.'},
  {id:'typewriter', text:"I'M THRILLED TO ANNOUNCE", k:2, tone:'white', use:'The host, the tag', note:'Letters follow the voice across each word, one every 50 to 80 ms, never faster than a frame.'},
  {id:'scanline', text:'HUMBLED AND HONORED', k:2, use:'Verses', note:'Each word fills top to bottom in one 16th note, a line at a time.'},
  {id:'wipe', text:"LET'S TAKE THIS OFFLINE", k:2, accent:3, use:'The hook', note:'One sweep, left to right, across a full bar. The last word carries the only signal yellow in the song.'},
  {id:'centre', text:'BACK.', k:4, tone:'white', use:'The impact', note:'Light spreads from the middle of the word outward, 8 ms per peg of distance.'},
  {id:'sparkle', text:'LET THAT SINK IN', k:2, tone:'deep', step:.75, use:'Slow motion', note:'Pegs arrive at random across a beat, each with a white glint. Deep blue and wide bloom appear nowhere else.'},
  {id:'stroke', text:'THOUGHTS?', k:3, use:'Hand-set moments', note:'Pegs light in pen order, the way each letter was drawn: every letter at once, start to finish in one 16th.'},
  {id:'steady', text:'SYNERGY', k:4, use:'The ladder climax', note:'No overshoot, no flash. From the fourth rung, a retrigger moves the letters instead of re-lighting them, so the climax never strobes.'},
];

function theatre() {
  const frame = $('[data-live=theatre]'), chips = $('[data-reveal-chips]'), use = $('[data-reveal-use]'), note = $('[data-reveal-note]');
  let cur = 0, t0 = null, screen = null, period = 4, pick = null;
  const make = () => {
    const r = REVEALS[cur], n = normalize(r.text).text.split(' ').length, step = r.step ?? BEAT;
    const starts = Array.from({length:n}, (_, j) => .45 + j * step), to = starts.at(-1) + 1.9;
    screen = screenOf(r.text, {from:.3, to, starts, reveal:r.id, tone:r.tone, k:r.k, accent:r.accent, voice:'lady'});
    period = to + .8; t0 = null;
    use.textContent = `${pad(cur + 1)} · ${r.id === 'centre' ? 'Centre' : r.id[0].toUpperCase() + r.id.slice(1)} · ${r.use}`;
    note.textContent = r.note;
    $$('button', chips).forEach((b, i) => { b.setAttribute('aria-selected', String(i === cur)); b.tabIndex = i === cur ? 0 : -1; });
  };
  REVEALS.forEach((r, i) => {
    const b = el('button', '', r.id);
    b.type = 'button'; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { cur = i; make(); });
    chips.append(b);
  });
  chips.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    cur = (cur + d + REVEALS.length) % REVEALS.length; make(); chips.children[cur].focus(); e.preventDefault();
  });
  make();
  liveFrame(frame, {
    pitchFor:(w, h) => clamp(Math.floor(Math.min(w / 128, h / 56)), 3, 12),
    resize(L) { pick = chooser(L, {maxLines:2, margin:6}); },
    tick(L, t) {
      t0 ??= t;
      const lt = (t - t0) % period + LEAD;
      paint(L.board, [screen], lt, {layoutOf:pick.layoutOf, place:pick.place, reduced:REDUCED});
      if (screen.tone === 'deep') L.board.bloom = 1.6;
    },
  });
}

// ---- 06 formats --------------------------------------------------------------------

const FORMAT_IDS = ['9:16', '1:1', '16:9'];
const FACE_NAME = {peg9:'PEG-9', peg5:'PEG-5', peg3:'PEG-3'};
const fitMeta = r => {
  if (!r.layout?.pages?.length) return 'Empty';
  const lines = r.layout.pages[0].lines.length;
  return `P ${r.pitch} · ${FACE_NAME[r.font]} · ${lines} ${lines === 1 ? 'line' : 'lines'}${r.pages > 1 ? ` · ${r.pages} pages` : ''}${r.belowMin ? ' · under P 9' : ''}`;
};
// A fitted format, drawn at the frame's width: the same pegs the export lights.
function fittedBoard(r, format, width, opts) {
  const f = FORMATS[format], s = width / f.width;
  if (!r.cols) { const g = grid(f.width, f.height, 14); return {board:createBoard(g.cols, g.rows), pitch:14 * s, x:g.x * s, y:g.y * s}; }
  const board = createBoard(r.cols, r.rows);
  lightPage(board, r.layout?.pages?.[0], r.originX, r.originY, opts);
  return {board, pitch:r.pitch * s, x:r.boardX * s, y:r.boardY * s};
}
const fitText = (text, format) => fit(text, {font:[F.peg9, F.peg5], format, minPitch:9});

function formats() {
  const root = $('[data-formats]'), input = $('[data-post]'), dropped = $('[data-dropped]');
  const stills = [], results = {};
  let text = '';
  const update = () => {
    const n = normalize(input.value);
    text = n.text;
    dropped.textContent = n.dropped.length ? `Not on the board: ${n.dropped.join(' ')}` : '';
    for (const f of FORMAT_IDS) {
      results[f] = text.trim() ? fitText(text, f) : {cols:0};
      root.querySelector(`[data-fmeta="${f}"]`).textContent = results[f].cols ? fitMeta(results[f]) : 'Empty';
    }
    stills.forEach(s => s.invalidate());
  };
  for (const f of FORMAT_IDS) {
    const F0 = FORMATS[f], fig = el('figure', 'pt-format'), frame = el('div', 'pt-frame');
    frame.style.aspectRatio = `${F0.width} / ${F0.height}`;
    const safe = el('div', 'pt-safe'), box = el('i');
    Object.assign(box.style, {left:`${F0.safe.x / F0.width * 100}%`, top:`${F0.safe.y / F0.height * 100}%`, width:`${F0.safe.w / F0.width * 100}%`, height:`${F0.safe.h / F0.height * 100}%`});
    safe.append(box); frame.append(safe);
    fig.append(frame, el('figcaption', '', `<b>${f}</b><span class="pt-meta" data-fmeta="${f}"></span>`));
    root.append(fig);
    stills.push(stillFrame(frame, width => fittedBoard(results[f] || {cols:0}, f, width, {tone:TONE.blue})));
  }
  let pending = 0;
  input.addEventListener('input', () => { clearTimeout(pending); pending = setTimeout(update, 90); });
  update();
}

// ---- 07 the 57 ---------------------------------------------------------------------

const LADY = PHRASES.map(e => ({...e, norm:normalize(e.text).text}));

// Her words on the board, on her measured boundaries (seconds in the file).
function ladyScreen(e, duration) {
  const shown = e.norm.split(' '), measured = e.words || [];
  let starts, ends;
  if (measured.length === shown.length) { starts = measured.map(w => w.start); ends = measured.map(w => w.end); }
  else {
    const [a, b] = e.voiced || [0, duration], per = (b - a) / shown.length;
    starts = shown.map((_, i) => a + i * per); ends = shown.map((_, i) => a + (i + 1) * per);
  }
  return screenOf(e.norm, {from:Math.max(0, starts[0] - .05), to:Math.max(ends.at(-1), duration) + .45, starts, ends, reveal:'pop', tone:'white', voice:'lady'});
}

function phrases() {
  const root = $('[data-cards]'), seg = $('[data-phrase-format]'), stat = $('[data-phrase-stat]');
  let format = '9:16';
  const fits = {}, cards = [];
  const fitOf = (i, f) => ((fits[f] ||= [])[i] ||= fitText(LADY[i].norm, f));
  const summary = () => {
    const all = LADY.map((_, i) => fitOf(i, format)), ok = all.filter(r => !r.belowMin), pitches = ok.map(r => r.pitch);
    const paged = all.filter(r => r.pages > 1).length;
    stat.textContent = `${ok.length} of ${LADY.length} fit at P 9 or more · P ${Math.min(...pitches)} to ${Math.max(...pitches)}${paged ? ` · ${paged} on two pages` : ' · all on one page'}`;
  };
  LADY.forEach((e, i) => {
    const card = el('button', 'pt-card');
    card.type = 'button';
    card.setAttribute('aria-label', `Play: ${e.text}`);
    const frame = el('span', 'pt-frame');
    frame.style.display = 'block';
    frame.append(el('span', 'pt-play'));
    const words = e.norm.split(' ').map(w => `<span>${esc(w)}</span>`).join(' ');
    card.append(frame, el('span', 'pt-card-cap', `<span class="n">${esc(e.file.replace('.wav', ''))}</span><span class="t">${words}</span><span class="m"></span>`));
    const meta = $('.m', card), spans = $$('.t span', card);
    const s = stillFrame(frame, width => { const r = fitOf(i, format); meta.textContent = fitMeta(r); return fittedBoard(r, format, width, {tone:TONE.white}); });
    cards.push({card, frame, s, spans, i});
    card.addEventListener('click', () => play(cards[i]));
    root.append(card);
  });
  seg.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    format = b.dataset.format;
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const F0 = FORMATS[format];
    root.dataset.format = format;
    root.style.setProperty('--ar', `${F0.width} / ${F0.height}`);
    stop();
    cards.forEach(c => c.s.invalidate());
    summary();
  });
  root.dataset.format = format;
  root.style.setProperty('--ar', '1080 / 1920');
  summary();

  // Playback: WebAudio, so the light is timed against what the speaker plays.
  let ctx = null, now = null;
  const buffers = new Map();
  async function play(c) {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    stop();
    const e = LADY[c.i], token = now = {c};
    let buf = buffers.get(e.file);
    try {
      if (!buf) { const res = await fetch(`/phrases/${e.file}`); buf = await ctx.decodeAudioData(await res.arrayBuffer()); buffers.set(e.file, buf); }
    } catch (err) { console.warn('Peg Board: could not load', e.file, err); now = null; return; }
    if (now !== token) return;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    const at = ctx.currentTime + .06;
    src.start(at);
    const r = fitOf(c.i, format), screen = ladyScreen(e, buf.duration);
    Object.assign(token, {src, at, screen, r, board:createBoard(r.cols, r.rows), format});
    c.card.dataset.playing = '';
  }
  function stop() {
    if (!now) return;
    const {c, src} = now;
    try { src?.stop(); } catch {}
    delete c.card.dataset.playing;
    c.spans.forEach(s => s.classList.remove('sung'));
    now = null;
    c.s.invalidate();
  }
  // Drawn from the main loop while a phrase plays.
  phrases.tick = () => {
    if (!now?.screen) return;
    const {c, at, screen, r, board, format:f} = now;
    const t = ctx.currentTime - at - (ctx.outputLatency || ctx.baseLatency || 0) + LEAD;
    if (t > screen.to + .35) { stop(); return; }
    const layout = r.layout;
    paint(board, [screen], t, {layoutOf:() => layout, place:() => ({x:r.originX, y:r.originY}), reduced:REDUCED});
    const width = c.frame.clientWidth, s = width / FORMATS[f].width;
    blit(c.s.canvas, board, {pitch:r.pitch * s, x:r.boardX * s, y:r.boardY * s, width, height:c.frame.clientHeight, time:t});
    screen.words.forEach((w, j) => c.spans[j]?.classList.toggle('sung', w.start <= t));
  };
}

// ---- 08 output by department --------------------------------------------------------

const hashf = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x27d4, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
const env = (age, tau) => age < 0 ? 0 : Math.exp(-age / tau);

// A stand-in band at 120 BPM: kick on every beat, clap on two and four, offbeat
// hats, pumping bass, chords per bar, plucked 16ths, a sung line, her three hits.
function demoLevels(stem, t, drop, out) {
  const s16 = Math.floor(t / .125), a16 = t - s16 * .125, q = s16 % 16, beat = Math.floor(t / BEAT), aB = t - beat * BEAT;
  let v;
  switch (stem) {
    case 'drums': { const k = env(aB, .11), sn = beat % 2 ? env(aB, .14) : 0, hat = q % 2 ? env(a16, .05) : .4 * env(a16, .03); v = [.95 * k, .55 * k + .5 * sn, .8 * sn + .25 * k + .2 * hat, .75 * hat + .35 * sn]; break; }
    case 'bass': { const e = env(t % .25, .16) * (q % 4 === 0 ? 1 : .78); v = [.92 * e, .85 * e, .6 * e, .4 * e]; break; }
    case 'keys': { const bar = Math.floor(t / 2), e = .5 + .25 * env(t % 2, .7) + .06 * Math.sin(t * 5.1); v = [.45, .72, .58, .34].map((x, i) => x * e * (1 + .25 * Math.sin(bar * 1.7 + i * 2.1))); break; }
    case 'guitar': { const on = hashf(q, 3) > .4 || q % 4 === 2, e = on ? env(a16, .09) : .35 * env(a16 + .125, .09); v = [.25 * e, .65 * e, .8 * e, .5 * e]; break; }
    case 'voice': { const sings = Math.floor(t / 2) % 2 === 0 || q < 8, e = sings && hashf(Math.floor(t / .25), 9) > .28 ? .35 + .5 * env(t % .25, .2) : 0; v = [.3 * e, .85 * e, .65 * e, .4 * e]; break; }
    default: { const p = t % 2; let e = 0; for (const h of [0, .25, .5]) e = Math.max(e, env(p - h, .16)); v = [.35 * e, .9 * e, .72 * e, .45 * e]; }
  }
  for (let i = 0; i < 4; i++) out[i] = clamp(v[i] * (.85 + .3 * hashf(s16, i * 7 + stem.length)) * (drop ? 1 : .82));
  return out;
}

function chart() {
  const frame = $('[data-live=chart]'), labels = $('[data-chart-labels]'), seg = $('[data-chart-section]');
  const model = departments({bands:4}), followers = new Map(), scratch = {}, accented = {levels:{}, white:{}};
  let drop = false, last = -1, geo = null, plan = null;
  const TITLE = 'OUTPUT BY DEPARTMENT';
  const layout = (cols, rows) => {
    const groups = model.groups.filter(g => !g.drop || drop), bandW = cols >= 90 ? 2 : 1, gap = 1, groupGap = bandW + 2;
    const groupW = 4 * bandW + 3 * gap, total = groups.length * groupW + (groups.length - 1) * groupGap;
    const titleW = runWidth(F.peg3, TITLE), title = titleW <= cols - 6 ? {x:Math.floor((cols - titleW) / 2), y:3} : null;
    const top = title ? 12 : 3, base = rows - 4;
    let x0 = Math.floor((cols - total) / 2);
    return {title, base, chartRows:Math.max(4, base - top + 1), bandW, gap, groups:groups.map(g => { const out = {g, col:x0, cols:groupW}; x0 += groupW + groupGap; return out; })};
  };
  const placeLabels = () => {
    if (!geo) return;
    labels.innerHTML = '';
    for (const p of plan.groups) {
      const s = el('span', '', p.g.label);
      Object.assign(s.style, {left:`${geo.x + p.col * geo.pitch}px`, width:`${p.cols * geo.pitch}px`, top:`${geo.y + (plan.base + 2.5) * geo.pitch}px`});
      labels.append(s);
    }
  };
  const L = liveFrame(frame, {
    pitchFor:(w, h) => clamp(Math.floor(Math.min(w / 116, h / 42)), 3, 12),
    resize(L) { geo = L.geo; followers.clear(); plan = layout(L.board.cols, L.board.rows); placeLabels(); },
    tick(L, t) {
      const b = L.board;
      clearBoard(b);
      const dt = last < 0 ? 1 / 60 : clamp(t - last, 0, .1);
      last = t;
      if (plan.title) glyphRun(b, F.peg3, TITLE, plan.title.x, plan.title.y, {I:.8, tone:TONE.blue});
      const raw = {};
      for (const {g} of plan.groups) raw[g.stem] = demoLevels(g.stem, t, drop, scratch[g.stem] ||= new Float32Array(4));
      const kick = !REDUCED && Math.floor(t / .125) % 4 === 0;
      scoreAccent(raw, {kick}, accented);
      for (const {g, col} of plan.groups) {
        if (!followers.has(g.stem)) followers.set(g.stem, createFollower(4, {rows:plan.chartRows - 1, edges:g.edges}));   // room for the peak peg
        const {heights, peaks} = followers.get(g.stem).step(accented.levels[g.stem], dt), white = accented.white[g.stem];
        for (let band = 0; band < 4; band++) {
          const h = Math.round(heights[band]), p = Math.round(peaks[band]);
          for (let bx = 0; bx < plan.bandW; bx++) {
            const x = col + band * (plan.bandW + plan.gap) + bx;
            for (let r = 0; r < h; r++) light(b, x, plan.base - r, .5 + .5 * (r / plan.chartRows), {tone:TONE.blue, white:white?.[band] ? .9 : 0});
            if (p > 0) light(b, x, plan.base - Math.min(plan.chartRows - 1, p), 1.25, {tone:TONE.white, white:.85});
          }
        }
      }
      L.kick = drop && kick ? 1 : 0;
    },
  });
  seg.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    drop = btn.dataset.section === 'drop';
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
    if (L.board) { followers.clear(); plan = layout(L.board.cols, L.board.rows); placeLabels(); }
  });
}

// ---- 09 psych ----------------------------------------------------------------------

// Each look as the specimen shows it: its params and a one-line reading of them.
const PSYCH_DEMO = {
  ripples:{params:{}, meta:'Spacing 6 pegs · from the centre'},
  spiral:{params:{arms:3}, meta:'3 arms · a turn a bar'},
  pinwheel:{params:{blades:8}, meta:'8 blades · two rings'},
  moire:{params:{}, meta:'Two ring sets · orbit 4 bars'},
  plasma:{params:{}, meta:'Four waves · deep to signal'},
  mandala:{params:{fold:8}, meta:'8-fold · also 6 and 12'},
  lissajous:{params:{curves:2}, meta:'3 : 2 · two figures'},
  loading:{params:{}, meta:'60 % loaded · a sheen a bar'},
  contour:{params:{block:2, aspect:1.6, pupil:2}, meta:'Stepped rings · square edges, flat light'},
  // Delve.'s figures. Her lips talk through their twelve shapes, a third of a second each, opening 0 to 3 on the
  // eighths; the stars are born on their own moments, a loop of 24 (the film's sky: blue far ones, white near
  // ones, one in five signal, a big signal hero now and then).
  lips:{at:t => ({level:1, cx:.5, cy:.55, mouth:lipCode(LIP_SHAPES[Math.floor(t * 3) % LIP_SHAPES.length], [1, 3, 2, 0][Math.floor(t * 6) % 4])}), meta:'12 shapes · a third of a second each'},
  stars:{params:{spin:1, twinkle:.14}, events:t => starLoop(t), meta:'24 a loop · born, turning, gone'},
  footage:{params:{}, meta:'Kevin, guitar · one sample a peg'},
};
// The stars' demo sky: 24 births over a 12 s loop, each 3 to 6 s long, at hashed places; the loop before is
// kept so a star born near its end lives on.
const STAR_LOOP = 12, STAR_SKY = Array.from({length:24}, (_, k) => {
  const h = n => { const x = Math.sin(k * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
  const hero = k % 8 === 3 ? 1 : 0, tone = hero || k % 5 === 4 ? 2 : k % 3 === 0 ? 0 : 1;
  return [k * STAR_LOOP / 24, k * STAR_LOOP / 24 + 3 + 3 * h(1), .08 + .84 * h(2), .1 + .8 * h(3), hero ? 5 : tone === 0 ? 1 : 2 + Math.round(h(4)), tone, hero];
});
const starLoop = t => { const n = Math.floor(t / STAR_LOOP); return [n - 1, n].flatMap(m => STAR_SKY.map(e => [e[0] + m * STAR_LOOP, e[1] + m * STAR_LOOP, ...e.slice(2)])); };
const PSYCH_BPM = 108, PSYCH_LOOP = 64 * 60 / PSYCH_BPM;             // 16 bars: the demo voice and claps repeat
const PSYCH_FOOTAGE = '/cutting-room/posters/guitar-office-performance-ba9226e7.jpg';

// The footage look reads a picture at one value per peg: Kevin's poster, drifting slowly (a push and a
// pan), drawn into a canvas the size of the board and read back.
function footageSource() {
  const img = new Image(), cvs = document.createElement('canvas'), ctx = cvs.getContext('2d', {willReadFrequently:true});
  let ready = false;
  img.onload = () => { ready = true; };
  img.src = PSYCH_FOOTAGE;
  return (cols, rows, t) => {
    if (!ready) return null;
    if (cvs.width !== cols || cvs.height !== rows) { cvs.width = cols; cvs.height = rows; }
    const s = Math.max(cols / img.width, rows / img.height) * (1.14 + .06 * Math.sin(t * .21)), w = img.width * s, h = img.height * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (cols - w) / 2 + .04 * cols * Math.sin(t * .13), (rows - h) / 2 + .03 * rows * Math.cos(t * .17), w, h);
    return {cols, rows, data:ctx.getImageData(0, 0, cols, rows).data};
  };
}

function psych() {
  const frame = $('[data-live=psych]'), list = $('[data-psych-grid]'), seg = $('[data-psych-words]'), use = $('[data-psych-use]'), note = $('[data-psych-note]');
  const drive = driveTrack({bpm:PSYCH_BPM, duration:PSYCH_LOOP}), footage = footageSource();
  let cur = PSYCH_LOOKS.indexOf('mandala'), words = true, pick = null, screen = null;
  // The drive at a moment: the demo's voice and claps loop every 16 bars, the beat runs on.
  const driveOf = t => ({...driveAt(drive, t % PSYCH_LOOP), beat:t * PSYCH_BPM / 60});
  const timeOf = t => REDUCED ? 7.3 : t;
  // (A figure's specimen draws from its own data: the lips' shape at the moment, the stars' events.)
  const spec = (look, t = 0) => { const d = PSYCH_DEMO[look] ?? {params:{}}; return {look, seed:PSYCH_LOOKS.indexOf(look) + 1, params:d.at ? d.at(t) : d.params, ...(d.events ? {events:d.events(t)} : {})}; };
  const select = i => {
    cur = i;
    const look = PSYCH_LOOKS[i];
    use.textContent = `${pad(i + 1)} · ${LOOKS[look].title} · ${PSYCH_DEMO[look].meta}`;
    note.textContent = LOOKS[look].caption;
    $$('button', list).forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  };
  // The stage: the chosen look, with a line of type over it (it keeps every one of its pegs).
  liveFrame(frame, {
    pitchFor:(w, h) => clamp(Math.floor(Math.min(w / 128, h / 56)), 4, 12),
    resize(L) { pick = chooser(L, {maxLines:2, margin:8}); screen = screenOf("LET'S BUILD.", {from:0, to:1e9, starts:[.2, .45], reveal:'pop', tone:'white', k:4, release:'cut'}); },
    tick(L, t) {
      const lt = timeOf(t), look = PSYCH_LOOKS[cur];
      if (words) paint(L.board, [screen], 4, {layoutOf:pick.layoutOf, place:pick.place, reduced:true}); else clearBoard(L.board);
      paintPsych(L.board, spec(look, lt), lt, {drive:driveOf(lt), frame:look === 'footage' ? footage(L.board.cols, L.board.rows, lt) : null});
    },
  });
  // The grid: every look live, small, through one shared renderer.
  const tileR = createRenderer(document.createElement('canvas'), {pixelRatio:DPR, force2d:FORCE2D}), tiles = [];
  const tileGrid = (w, h) => grid(w, h, clamp(Math.floor(Math.min(w / 64, h / 48)), 3, 8));
  let tileSize = '';
  const tileIO = new IntersectionObserver(entries => { for (const e of entries) e.target.__tile.visible = e.isIntersecting; }, {rootMargin:'60px 0px'});
  PSYCH_LOOKS.forEach((look, i) => {
    const li = el('li'), b = el('button'), f = el('div', 'pt-frame'), canvas = document.createElement('canvas');
    b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `${LOOKS[look].title}: show on the stage`);
    canvas.setAttribute('aria-hidden', 'true'); f.append(canvas);
    b.append(f, el('div', 'pt-psych-cap', `<span class="n">${pad(i + 1)}</span><span class="t">${esc(LOOKS[look].title)}</span><p class="d">${esc(LOOKS[look].caption)}</p><span class="m">${esc(PSYCH_DEMO[look].meta)}</span>`));
    b.addEventListener('click', () => select(i));
    li.append(b); list.append(li);
    const tile = {look, frame:f, canvas, visible:false, board:null, geo:null};
    f.__tile = tile; tileIO.observe(f); tiles.push(tile);
  });
  psych.tick = t => {
    const lt = timeOf(t);
    for (const tile of tiles) {
      if (!tile.visible) continue;
      const w = tile.frame.clientWidth, h = tile.frame.clientHeight;
      if (!w || !h) continue;
      if (!tile.geo || tile.geo.w !== w || tile.geo.h !== h) { tile.geo = {...tileGrid(w, h), w, h}; tile.board = createBoard(tile.geo.cols, tile.geo.rows); }
      const key = `${w}x${h}`;
      if (key !== tileSize) { tileR.resize(w, h); tileSize = key; }
      clearBoard(tile.board);
      paintPsych(tile.board, spec(tile.look, lt), lt, {drive:driveOf(lt), frame:tile.look === 'footage' ? footage(tile.board.cols, tile.board.rows, lt) : null});
      tileR.draw(tile.board, {pitch:tile.geo.pitch, x:tile.geo.x, y:tile.geo.y, time:lt});
      const src = tileR.canvas;
      if (tile.canvas.width !== src.width || tile.canvas.height !== src.height) { tile.canvas.width = src.width; tile.canvas.height = src.height; }
      tile.canvas.getContext('2d', {alpha:false}).drawImage(src, 0, 0);
    }
  };
  seg.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    words = btn.dataset.words === 'on';
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
  });
  select(cur);
}

// ---- 10 the couplet ------------------------------------------------------------------

// Three couplets from the lexicon, a cycle of two bars each at 120 BPM: Strategy's X from the first beat,
// the strike on the beat after it (choreo's own rule), the answer from the next bar's downbeat. The third
// is the lady's: she owns the word after Synthia's pickup.
const COUPLETS = [
  {x:"IT'S NOT A COMPLAINT.", y:"IT'S A GIFT.", xv:'strategy', yv:'synthia', who:'Strategy, Synthia'},
  {x:"IT'S NOT AN HOUR.", y:"IT'S A QUICK SYNC.", xv:'strategy', yv:'synthia', who:'Strategy, Synthia'},
  {x:"IT'S NOT A LOAN.", y:"IT'S LEVERAGE.", xv:'strategy', yv:'lady', who:'Strategy, the lady'},
];
const CP_STEP = .125, CP_BARS = 2, CP_PERIOD = CP_BARS * 16 * CP_STEP;
// A part on the plan contract: its words spread by letters over [at, at + dur].
function cpPart(text, voice, at, dur) {
  const ws = text.split(' '), total = ws.reduce((a, w) => a + w.length + 1, 0), words = [];
  let t = at;
  for (const w of ws) { const d = dur * (w.length + 1) / total; words.push({text:w, start:t, end:t + d * .9}); t += d; }
  return {text, voice, at, end:at + dur, words};
}
function coupletPlan() {
  const n = COUPLETS.length * CP_BARS * 16 + 16, timing = Float64Array.from({length:n + 1}, (_, i) => i * CP_STEP);
  const couplets = COUPLETS.map((c, i) => { const t0 = i * CP_PERIOD; return {x:cpPart(c.x, c.xv, t0 + .25, 1.1), y:cpPart(c.y, c.yv, t0 + 2, .9)}; });
  return {form:'specimen', step:CP_STEP, timing, duration:COUPLETS.length * CP_PERIOD, sections:[], lines:[], words:[], stutters:[], lady:[], couplets};
}

function couplet() {
  const frame = $('[data-live=couplet]'), seg = $('[data-couplet-board]'), meta = $('[data-couplet-meta]'), list = $('[data-couplet-list]');
  const plan = coupletPlan(), screens = buildScreens(plan).map(indexWords), loop = plan.duration;
  let mode = 'stage', geo = null, layouts = new Map(), span = 0, c0 = 0, gains = null, job = 0, t0 = null, shown = -1, jump = null, held = null;
  // A moment held still, for review and screenshots: window.__pixelType.couplet(i, seconds), null to run on.
  (window.__pixelType ||= {}).couplet = (i, s) => { held = i === null ? null : i * CP_PERIOD + s; };
  // The film's 9:16 home: 150 x 48 pegs over 1056 x 342 px; type keeps to the platform-safe columns 8 to
  // 133 (x 64 to 944 of the 1080 frame: left of the right rail), as the film lays it out.
  const FILM = {cols:150, rows:48, c0:8, span:125};
  const layoutOf = s => {
    if (layouts.has(s)) return layouts.get(s);
    let out = null;
    for (const face of ['peg9', 'peg5']) {
      for (let k = s.k; k >= 1 && !out; k--) { const l = layoutText(s.text, {font:F[face], k, maxCols:span, maxLines:linesFor(s, F[face], k, geo.rows - 2)}); if (l.width <= span && l.height <= geo.rows - 2) out = l; }
      if (out) break;
    }
    layouts.set(s, out);
    return out;
  };
  const place = (s, l, page) => ({x:c0 + Math.floor((span - Math.max(...page.lines.map(x => x.width))) / 2), y:Math.max(1, Math.floor((geo.rows - l.height) / 2))});
  // The loop obeys the house rule too (it never needs to: the couplet's light only rises).
  const govern = (L, id) => {
    const board = createBoard(L.board.cols, L.board.rows), frames = [], n = Math.ceil(loop * FPS);
    const step = () => {
      if (id !== job) return;
      for (let c = 0; c < 48 && frames.length < n; c++) { paint(board, screens, frames.length / FPS, {layoutOf, place, pitch:geo.pitch}); frames.push(boardLuma(board)); }
      if (frames.length < n) setTimeout(step, 0); else gains = governorTrack(frames, FPS);
    };
    setTimeout(step, 200);
  };
  const L = liveFrame(frame, {
    pitchFor:(w, h) => mode === 'film' ? Math.max(1, w / (FILM.cols + 1e-6)) : stagePitch(w, h),
    resize(L) {
      geo = L.geo; layouts = new Map(); gains = null;
      if (mode === 'film') { span = Math.min(FILM.span, geo.cols - FILM.c0 - 2); c0 = FILM.c0; } else { span = geo.cols - 8; c0 = 4; }
      govern(L, ++job);
    },
    tick(L, t) {
      t0 ??= t;
      if (jump !== null) { t0 = t - jump * CP_PERIOD; jump = null; }
      // Reduced motion: each couplet held landed (X struck, Y lit), one after another.
      const raw = (t - t0) % loop, lt = held ?? (REDUCED ? Math.floor(raw / CP_PERIOD) * CP_PERIOD + 3.2 : raw + LEAD);
      paint(L.board, screens, lt, {layoutOf, place, reduced:REDUCED, pitch:geo.pitch});
      const g = gains?.[Math.floor(lt * FPS)];
      if (g) L.board.exposure *= g;
      const i = Math.min(COUPLETS.length - 1, Math.floor(lt / CP_PERIOD));
      if (i !== shown) {
        shown = i;
        const st = screens.find(x => x.fx.strike && x.words[0].start >= i * CP_PERIOD)?.fx.strike;
        meta.textContent = `${pad(i + 1)} / ${pad(COUPLETS.length)} · ${COUPLETS[i].who}${st ? ` · struck on beat ${Math.round((st.at - i * CP_PERIOD) / .5) + 1}` : ''}`;
        $$('button', list).forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      }
    },
  });
  COUPLETS.forEach((c, i) => {
    const li = el('li'), b = el('button'), struck = c.x.replace(/^IT'S NOT /, '');
    b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="n">${pad(i + 1)}</span><span class="x">It's not <s>${esc(struck.toLowerCase())}</s></span><span class="y">${esc(c.y[0] + c.y.slice(1).toLowerCase())}</span><span class="m">${esc(c.who)}</span>`;
    b.addEventListener('click', () => { jump = i; });
    li.append(b); list.append(li);
  });
  seg.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    mode = btn.dataset.board;
    frame.dataset.board = mode;
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
    requestAnimationFrame(() => L.size());
  });
}

// ---- nav, sign-off, loop -------------------------------------------------------------

function nav() {
  const bar = $('.pt-nav'), links = new Map($$('a', bar).map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach(a => a.removeAttribute('aria-current'));
      const a = links.get(e.target.id);
      if (!a) continue;
      a.setAttribute('aria-current', 'true');
      if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({left:a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior:REDUCED ? 'auto' : 'smooth'});
    }
  }, {rootMargin:'-40% 0px -55% 0px'});
  $$('section[id]').forEach(s => io.observe(s));
}

function signoff() {
  const KEY = 'pegboard-specimen-01';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  for (const box of $$('[data-checks] input')) {
    box.checked = !!saved[box.value];
    box.addEventListener('change', () => { saved[box.value] = box.checked; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} });
  }
}

function loop(ms) {
  const t = ms / 1000;
  for (const L of lives) if (L.visible) L.tick(t);
  phrases.tick?.();
  psych.tick?.(t);
  requestAnimationFrame(loop);
}

hero(); faces(); scale(); palette(); kerning(); theatre(); formats(); phrases(); chart(); psych(); couplet(); nav(); signoff();
requestAnimationFrame(loop);
