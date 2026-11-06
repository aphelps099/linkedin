// The hero's own Peg Board: the boot, the film as pegs, the copy, PRESS START.
// Pure painters: each takes a board and a moment and lights pegs. The stage's
// own choreography (src/pegboard/stage.js) draws the sung words on a second
// board with the same pitch; this one draws everything around them.
import {clearBoard, light, PALETTE} from '../pegboard/board.js';
import {compileFont, layoutText} from '../pegboard/font.js';
import {PEG9} from '../pegboard/fonts/peg9.js';
import {PEG5} from '../pegboard/fonts/peg5.js';
import {PEG3} from '../pegboard/fonts/peg3.js';

const FACES = {peg9:compileFont(PEG9), peg5:compileFont(PEG5), peg3:compileFont(PEG3)};
const BLUE = PALETTE.blue.id, WHITE = PALETTE.white.id, SIGNAL = PALETTE.signal.id;

export const HEADLINE = 'LEARN TO SOUND LIKE LINKEDIN.';
export const SUBLINE = 'PROFESSIONAL DEVELOPMENT FOR ASPIRING THOUGHT LEADERS';
// Attract mode's rotation: the genre, one phrase at a time.
export const PHRASES = ['HUMBLED AND HONORED.', "LET'S CIRCLE BACK.", 'PER MY LAST EMAIL.', 'LET THAT SINK IN.', 'THRILLED TO ANNOUNCE.', 'THOUGHTS?', 'AGREE OR DISAGREE?', 'FULL STOP.'];

export const BOOT = {sockets:.5, sweepFrom:.25, sweepTo:1.05, markFrom:.8, end:1.9};
const CYCLE = [{text:HEADLINE, alt:'LEARN TO SOUND LIKE LINKEDIN', dur:7, faces:['peg9', 'peg5'], k:1, lines:4}, {text:SUBLINE, dur:4.2, faces:['peg5', 'peg3'], k:1, lines:5}, {dur:3.2}, {dur:3.2}];
const CYCLE_LENGTH = CYCLE.reduce((a, s) => a + s.dur, 0);
const TYPE_RATE = .035, TYPE_MAX = 1.4, FADE = .25, POP = .08;

// The biggest layout that fits a box: faces in order, k from the wish down to 1.
export function fitText(text, {cols, rows, faces = ['peg9', 'peg5', 'peg3'], k = 1, maxLines = 3}, cache) {
  const key = `${text}|${cols}|${rows}|${faces.join()}|${k}|${maxLines}`;
  if (cache?.has(key)) return cache.get(key);
  let out = null;
  for (const face of faces) {
    for (let kk = k; kk >= 1 && !out; kk--) {
      try {
        const l = layoutText(text, {font:FACES[face], k:kk, maxCols:cols, maxLines});
        if (l.width <= cols && l.height <= rows && l.pages.length === 1) out = l;
      } catch { /* a glyph this face lacks: try the next */ }
    }
    if (out) break;
  }
  cache?.set(key, out);
  return out;
}

// Light one page of a layout at (x, y). `reveal(n, char)` returns {I, white} per
// character in reading order, or null to skip it.
export function drawLayout(board, layout, x, y, {tone = BLUE, I = 1, white = 0, reveal} = {}) {
  let n = 0;
  for (const line of layout.pages[0].lines) for (const ch of line.chars) {
    const r = reveal ? reveal(n++, ch) : {I, white};
    if (!r || r.I <= 0) continue;
    const p = ch.pegs;
    for (let i = 0; i < p.length; i += 2) light(board, x + p[i], y + p[i + 1], r.I, {tone:r.tone ?? tone, white:r.white ?? white, size:r.size ?? 1});
  }
}
const charCount = layout => layout.pages[0].lines.reduce((a, l) => a + l.chars.length, 0);

// Pull the film pegs down where the copy sits, so the type reads over the picture.
export function dimRect(board, x0, y0, x1, y1, f) {
  for (let y = Math.max(0, y0); y <= Math.min(board.rows - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(board.cols - 1, x1); x++) board.I[y * board.cols + x] *= f;
}

// The film on the board: cobalt pegs for the picture, white where it burns.
export function paintFilm(board, luma, {gain = 1, floor = .16, curve = 1.8} = {}) {
  const n = Math.min(luma.length, board.I.length);
  for (let i = 0; i < n; i++) {
    const l = (luma[i] - floor) / (1 - floor);
    if (l < .05) continue;
    const I = Math.min(1.1, Math.pow(l, curve) * gain);
    light(board, i % board.cols, (i / board.cols) | 0, I, {tone:l > .88 ? WHITE : BLUE, white:l > .72 ? Math.min(1, (l - .72) / .22) : 0});
  }
}

// Samples the film into one luminance per peg, through the region of the film
// that sits behind the board, so a peg lights for the picture under it.
export function createSampler(cols, rows) {
  const canvas = document.createElement('canvas');
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  let tainted = false;
  return {
    get tainted() { return tainted; },
    sample(video, out, geo) {
      if (tainted || !video || video.readyState < 2 || video.paused) return false;
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh || !ctx) return false;
      const s = Math.max(geo.W / vw, geo.H / vh), dx = (geo.W - vw * s) / 2, dy = (geo.H - vh * s) / 2;   // object-fit: cover
      try {
        ctx.drawImage(video, (geo.ox - dx) / s, (geo.oy - dy) / s, cols * geo.pitch / s, rows * geo.pitch / s, 0, 0, cols, rows);
        const d = ctx.getImageData(0, 0, cols, rows).data;
        for (let i = 0, j = 0; i < d.length; i += 4, j++) out[j] = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
        return true;
      } catch { tainted = true; return false; }
    },
  };
}

// A typewriter over a layout: letters arrive one by one, each with a short
// white pop, the whole line fading in its last quarter second.
function typed(layout, age, dur, reduced) {
  const n = charCount(layout), span = Math.min(TYPE_RATE, TYPE_MAX / Math.max(1, n));
  const out = age > dur - FADE ? Math.max(0, (dur - age) / FADE) : 1;
  return (i) => {
    const a = reduced ? 1 : age - i * span;
    if (a < 0) return null;
    return a < POP ? {I:1.35 * out, white:.7, size:1.2} : {I:out, white:0};
  };
}

// Rows the HTML above and below the board cover (the header's meta, the bottom bar).
export function margins(geo) { return {top:Math.ceil(104 / geo.pitch), bottom:Math.ceil(120 / geo.pitch)}; }

// The boot: sockets wake, a sweep tests every peg, the wordmark types in.
export function paintBoot(board, t, {reduced, cache}) {
  clearBoard(board);
  board.sockets = reduced ? 1 : Math.min(1, t / BOOT.sockets);
  const {cols, rows} = board;
  if (!reduced && t >= BOOT.sweepFrom && t <= BOOT.sweepTo + .3) {
    const sx = ((t - BOOT.sweepFrom) / (BOOT.sweepTo - BOOT.sweepFrom)) * (cols + 6) - 3;
    for (let x = 0; x < cols; x++) {
      const d = Math.abs(x - sx), I = Math.exp(-((d / 2.2) ** 2)) * 1.1;
      if (I < .03) continue;
      for (let y = 0; y < rows; y++) light(board, x, y, I * (.8 + .2 * ((x * 7 + y * 13) % 5) / 4), {tone:BLUE, white:d < .9 ? .8 : 0});
    }
  }
  if (t >= BOOT.markFrom || reduced) {
    const layout = fitText('LINKEDIN BEATS', {cols:cols - 4, rows:rows - 8, faces:['peg9', 'peg5'], k:2, maxLines:2}, cache);
    if (layout) {
      const x = Math.floor((cols - layout.width) / 2), y = Math.floor((rows - layout.height) / 2);
      drawLayout(board, layout, x, y, {tone:WHITE, reveal:typed(layout, reduced ? 1 : t - BOOT.markFrom, 1e9, reduced)});
      // The terminal beat: a signal block after the last letter, like the wordmark's underscore.
      const lines = layout.pages[0].lines, last = lines[lines.length - 1].chars.at(-1);
      if (last && (reduced || t - BOOT.markFrom > charCount(layout) * TYPE_RATE)) {
        const k = Math.max(1, Math.round(last.h / 9)), bx = x + last.x + last.w + k, by = y + last.y + last.h - 2 * k;
        const pulse = reduced ? 1 : .85 + .35 * Math.max(0, Math.sin((t - BOOT.markFrom) * 6));
        for (let yy = 0; yy < 2 * k; yy++) for (let xx = 0; xx < 2 * k; xx++) light(board, bx + xx, by + yy, pulse, {tone:SIGNAL});
      }
    }
  }
}

// Attract mode: the film in pegs, the copy rotating over it, PRESS START blinking
// under it. `phrases` is the day's rotation, `press` whether to show the prompt.
export function paintAttract(board, t, {pitch = 12, luma, film, reduced, cache, press = true, hover = false, copy = null, filmGain = .6, sockets = 1, since = 0}) {
  clearBoard(board);
  board.sockets = sockets;
  const {cols, rows} = board, m = margins({pitch});
  const fade = reduced ? 1 : Math.min(1, since / 1.2);
  if (film && luma) paintFilm(board, luma, {gain:filmGain * fade});

  // What the board says now: a fixed line (loading, adjourned) or the cycle.
  let text, alt = null, faces, k = 1, lines = 3, age = 0, dur = 1e9, tone = WHITE;
  if (copy === false) text = null;
  else if (copy) { text = copy.text; faces = copy.faces ?? ['peg9', 'peg5']; k = copy.k ?? 2; lines = copy.lines ?? 2; tone = copy.tone ?? WHITE; age = copy.age ?? 1; dur = copy.dur ?? 1e9; }
  else {
    const cycleIndex = Math.floor(t / CYCLE_LENGTH);
    let u = t - cycleIndex * CYCLE_LENGTH, seg = 0;
    while (u > CYCLE[seg].dur && seg < CYCLE.length - 1) { u -= CYCLE[seg].dur; seg++; }
    const s = CYCLE[seg];
    text = s.text ?? PHRASES[(cycleIndex * 2 + (seg - 2)) % PHRASES.length]; alt = s.alt ?? null;
    faces = s.faces ?? ['peg9', 'peg5']; k = s.text ? s.k : 2; lines = s.lines ?? 3; age = u; dur = s.dur;
    tone = s.text ? WHITE : BLUE;
  }
  const top = m.top, bottom = rows - m.bottom - (press ? 9 : 2);
  const box = {cols:cols - 4, rows:Math.max(5, bottom - top), faces, k, maxLines:lines};
  // A narrow board (a phone) may drop the full stop to keep the promise in PEG-5.
  const layout = text ? (fitText(text, box, cache) || (alt && fitText(alt, box, cache))) : null;
  if (layout) {
    const x = Math.floor((cols - layout.width) / 2), y = top + Math.floor((bottom - top - layout.height) / 2);
    dimRect(board, x - 3, y - 2, x + layout.width + 2, y + layout.height + 1, .12);
    drawLayout(board, layout, x, y, {tone, reveal:typed(layout, age, dur, reduced)});
  }
  if (press) {
    const prompt = fitText('PRESS START', {cols:cols - 4, rows:8, faces:['peg5'], k:1, maxLines:1}, cache) || fitText('START', {cols:cols - 4, rows:8, faces:['peg5'], k:1, maxLines:1}, cache);
    const on = reduced || hover || (t % 1) < .72;
    if (prompt && on) {
      const x = Math.floor((cols - prompt.width) / 2), y = rows - m.bottom - prompt.height;
      dimRect(board, x - 2, y - 1, x + prompt.width + 1, y + prompt.height, .12);
      drawLayout(board, prompt, x, y, {tone:SIGNAL, I:hover ? 1.2 : 1, white:hover ? .3 : 0});
    }
  }
}
