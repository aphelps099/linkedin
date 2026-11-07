// Her mouth, in pegs. The lady never has a face; in "Delve." her voice becomes visible as a pair of
// pop-art lips drawn on the Peg Board (an original drawing: lips only, no tongue, no teeth, no eyes, no
// band's mark). The lips are parametric: a cupid's bow over a fuller lower lip, parted by the opening,
// rounded by the vowel, lifted at the corners for a smile; rasterised to whole pegs, so every edge is a
// peg's edge. Signal body, a brighter outline, white gloss; a mouth that opens keeps its lips' thickness,
// so its light holds (every shape within LIGHT_TOLERANCE of rest: an open mouth is not a flash).
//
//   const s = lipsSprite('ah', 2, HERO);          // {pegs:[{x, y, I, tone, kind, p}], w, h, total}
//   paintLips(put, cols, rows, P);                // psych.js look 'lips' (P: its params)
//   const v = visemes(plan, event, {fps});         // [{f, shape, open}] for every frame she is heard
//
// Shapes are coded as numbers so an EDL can key them: code = SHAPES.indexOf(name) * 4 + open (open 0..3),
// -1 for no mouth. Pure: the same params light the same pegs.
import {PALETTE} from './board.js';

const BLUE = PALETTE.blue.id, WHITE = PALETTE.white.id, SIGNAL = PALETTE.signal.id, DEEP = PALETTE.deep.id;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

// The twelve shapes: w the width (1 = the sprite's full width), up and low the lips' thickness, round the
// opening's width (1 the whole mouth, small a round O), gap the opening at full (rows at open 3), lift the
// corners (a smile), push how far a pucker thickens.
export const SHAPE_DEFS = Object.freeze({
  rest:{w:1, up:1, low:1, round:.86, gap:0, lift:0},
  press:{w:1.02, up:.82, low:.84, round:.86, gap:0, lift:0},           // M, B, P: pressed together
  fv:{w:.98, up:1, low:.78, round:.8, gap:.18, lift:0},                // F, V: the lower lip tucked under
  ee:{w:1.04, up:.86, low:.86, round:.92, gap:.32, lift:.6},
  eh:{w:.98, up:.94, low:.94, round:.86, gap:.62, lift:.2},
  ah:{w:.94, up:.94, low:1, round:.8, gap:.86, lift:0},
  aa:{w:.92, up:.9, low:1, round:.82, gap:1, lift:0},
  oh:{w:.74, up:1.02, low:1.06, round:.6, gap:.8, lift:0},
  oo:{w:.62, up:1.06, low:1.08, round:.42, gap:.5, lift:0},
  uh:{w:.9, up:1, low:1, round:.72, gap:.5, lift:0},
  kiss:{w:.56, up:1.1, low:1.12, round:.28, gap:.5, lift:0, seamless:true},   // a pucker: a small dark O at the middle, no seam beside it
  smile:{w:1.02, up:.86, low:.92, round:.9, gap:0, lift:.5},
});
export const SHAPES = Object.freeze(Object.keys(SHAPE_DEFS));
export const code = (shape, open = 0) => SHAPES.indexOf(shape) * 4 + Math.max(0, Math.min(3, Math.round(open)));
export const decode = c => c < 0 || !Number.isFinite(c) ? null : {shape:SHAPES[Math.min(SHAPES.length - 1, Math.floor(Math.round(c) / 4))], open:Math.round(c) % 4};

// Sizes in pegs. HERO: 61 wide, 23 tall closed, up to 35 open (the 90 x 160 board of the 9:16 film); SMALL:
// the canon's ring, 21 x 9: a deep cupid's bow and a 2-peg dark seam, so at phone size it still reads as lips.
export const HERO = Object.freeze({half:31, up:8, low:10, gap:16, seam:1, bow:2.6, name:'hero', dots:true});
export const SMALL = Object.freeze({half:10, up:2.6, low:3.3, gap:4.2, seam:2, bow:1.4, name:'small'});
// MID: the hero in the middle of its own canon (29 wide), its eight voices ringing it.
export const MID = Object.freeze({half:14, up:3.8, low:4.7, gap:7.5, seam:1, bow:1.6, name:'mid'});
// Light: the outline burns half again over the fill (a pop-art contour), the gloss is white; the hero's lower lip
// carries a Ben-Day shade in its lower third (every other peg at DOT of the fill: the board's own halftone).
export const LIGHT = Object.freeze({outline:.74, fill:.5, gloss:.88});
export const DOT = .45;
export const LIGHT_TOLERANCE = .08;
// The compensation: paintMouth scales a shape's pegs by 1 / lightRatio inside these bounds (outline .74 x 1.3 stays
// under the psych ceiling, .95), so every shape lands on rest's light.
export const LIGHT_K = Object.freeze([.8, 1.3]);

const OPENING = [0, .3, .62, 1];
// The lips as whole pegs, relative to the mouth line's centre (x 0, y 0). kind: outline, fill or gloss;
// p: the outline's stroke order 0..1 (the top contour left to right, the lower lip's bottom right to left,
// then the line between the lips), the fill's scan order (top to bottom) for the others.
const cache = new Map();
export function lipsSprite(shape = 'rest', open = 0, size = HERO) {
  const key = `${shape}|${open}|${size.name ?? size.half}`;
  if (cache.has(key)) return cache.get(key);
  const S = SHAPE_DEFS[shape] ?? SHAPE_DEFS.rest, o = OPENING[Math.max(0, Math.min(3, open | 0))];
  // A rounder mouth is narrower and fuller: its thickness grows as its width shrinks (so its light holds).
  const a = size.half * S.w, fuller = 1 / Math.sqrt(S.w);
  const U = size.up * S.up * fuller, L = size.low * S.low * fuller, G = size.gap * S.gap * o;
  const bow = u => size.bow * (Math.exp(-(((Math.abs(u) - .3) / .17) ** 2)) - .75 * Math.exp(-((u / .09) ** 2)));
  const line = u => -S.lift * 2.4 * (size.half / 30) * Math.abs(u) ** 2.4;                 // the mouth line, corners up for a smile
  const gap = u => { const r = Math.abs(u) / Math.max(.2, S.round); return r < 1 ? G * (1 - r * r) ** .62 : 0; };
  const upT = u => U * (1 - Math.abs(u) ** 2.2) ** .55 + bow(u);
  const lowT = u => L * (1 - Math.abs(u) ** 2.6) ** .5;
  const inside = (x, y) => {
    const u = x / a;
    if (Math.abs(u) >= 1) return 0;
    const y0 = line(u), g = gap(u), seam = g < size.seam ? size.seam / 2 : g / 2;
    // (A seamless shape, the pucker: where it is not open its lips meet, the mouth line's row in the lower lip.)
    if (S.seamless && g < size.seam) { if (y < y0 && y >= y0 - upT(u)) return 1; if (y >= y0 && y <= y0 + lowT(u)) return 2; return 0; }
    if (y < y0 - seam && y >= y0 - seam - upT(u)) return 1;                     // the upper lip
    if (y > y0 + seam && y <= y0 + seam + lowT(u)) return 2;                    // the lower lip
    return 0;
  };
  const X = Math.ceil(a) + 1, Y0 = -Math.ceil(U + size.bow + G / 2 + 3), Y1 = Math.ceil(L + G / 2 + 2);
  const cells = new Map();
  for (let y = Y0; y <= Y1; y++) for (let x = -X; x <= X; x++) { const w = inside(x, y); if (w) cells.set(`${x},${y}`, w); }
  const pegs = [];
  let top = Infinity, bottom = -Infinity;
  for (const k of cells.keys()) { const y = +k.split(',')[1]; top = Math.min(top, y); bottom = Math.max(bottom, y); }
  for (const [k, w] of cells) {
    const [x, y] = k.split(',').map(Number), u = x / a;
    const edge = ['-1,0', '1,0', '0,-1', '0,1'].some(d => { const [dx, dy] = d.split(',').map(Number); return !cells.has(`${x + dx},${y + dy}`); });
    let kind = edge ? 'outline' : 'fill', p;
    if (edge) {
      // Stroke order: which contour the peg sits on (the upper lip's top, the lower lip's bottom, the inner edges).
      const outer = w === 1 ? !cells.has(`${x},${y - 1}`) : !cells.has(`${x},${y + 1}`);
      p = outer ? (w === 1 ? (u + 1) / 6 : 1 / 3 + (1 - u) / 6) : 2 / 3 + (u + 1) / 6;
    } else p = (y - top) / Math.max(1, bottom - top);
    // The gloss: a short highlight on the lower lip, left of centre (the light from the top left), and a
    // glint on the upper lip's left peak.
    const lowTop = line(u) + Math.max(size.seam / 2, gap(u) / 2), lt = lowT(u);
    const gl = (w === 2 && u > -.5 && u < -.12 && Math.abs(y - (lowTop + .38 * lt)) < .55 * (size.half / 30) + .3)
      || (w === 1 && Math.abs(u + .3) < .07 && Math.abs(y - (line(u) - Math.max(size.seam / 2, gap(u) / 2) - .62 * upT(u))) < .7);
    if (!edge && gl) kind = 'gloss';
    // (The Ben-Day shade: the lower lip's lower third, every other peg, in the fill's scan order like the rest.)
    const dot = size.dots && kind === 'fill' && w === 2 && y > lowTop + .62 * lt && (x + y) % 2 === 0;
    pegs.push({x, y, w, kind, p:+p.toFixed(4), I:LIGHT[kind] * (dot ? DOT : 1), tone:kind === 'gloss' ? WHITE : SIGNAL});
  }
  // Stroke order inside each kind is by p, then by position (stable).
  pegs.sort((q, r) => q.p - r.p || q.y - r.y || q.x - r.x);
  const total = pegs.reduce((s, q) => s + q.I, 0);
  const out = {shape, open, pegs, total, w:2 * X + 1, top, bottom};
  cache.set(key, out);
  return out;
}
// The light of each shape against rest (1 = the same): checked within LIGHT_TOLERANCE, and paintLips scales
// the pegs by this so the mouth never pumps light as it talks.
export function lightRatio(shape, open, size = HERO) {
  return lipsSprite(shape, open, size).total / lipsSprite('rest', 0, size).total;
}

// Paint one mouth into a field. put(i, v, tone, white, size). opts: draw, fill, gloss (0..1: the drawing in
// stroke order, the scanline fill, the gloss popping in; fill 0 is the outline alone), trace (0..1: a white-hot
// head runs round a drawn outline in stroke order, as it does while drawing), level, shadow (0..1: a blue copy one
// row down, behind), stack (0..3: copies 2, 4 and 6 rows down, behind, blue then deep: her choir's voices),
// scale (HERO or SMALL), cx, cy in pegs (the mouth line's centre).
export function paintMouth(put, lit, cols, rows, {shape = 'rest', open = 0, size = HERO, cx, cy, draw = 1, fill = 1, gloss = 1, trace = 0, level = 1, shadow = 0, stack = 0, head = true} = {}) {
  const s = lipsSprite(shape, open, size), k = clamp(1 / lightRatio(shape, open, size), LIGHT_K[0], LIGHT_K[1]) * level;
  const X = Math.round(cx), Y = Math.round(cy), pass = [];
  for (const q of s.pegs) {
    let on;
    if (q.kind === 'outline') on = q.p <= draw + 1e-9;
    else if (q.kind === 'gloss') on = draw >= 1 && fill >= 1 && gloss > 0 && (q.x / size.half + 1) / 2 <= gloss * 1.6;
    else on = draw >= 1 && fill > 0 && q.p <= fill + 1e-9;
    if (!on) continue;
    pass.push(q);
  }
  // The stack (her choir under her voice): copies of the drawn pegs 2, 4, 6 rows down, behind everything else.
  const deep = Math.min(3, Math.max(0, stack));
  for (let j = Math.ceil(deep); j >= 1; j--) {
    const a = Math.min(1, deep - j + 1) * [.5, .38, .28][j - 1] * level, tn = j === 1 ? BLUE : DEEP;
    if (a <= .02) continue;
    for (const q of pass) {
      const x = X + q.x, y = Y + q.y + 2 * j;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const i = y * cols + x;
      if (lit[i]) continue;
      put(i, a, tn, 0, 1);
    }
  }
  // The shadow mouth (her octave-down voice): blue, one row down, behind the lips.
  if (shadow > 0) for (const q of pass) {
    const x = X + q.x, y = Y + q.y + 1;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = y * cols + x;
    if (lit[i]) continue;
    put(i, .55 * shadow * level, BLUE, 0, 1);
  }
  for (const q of pass) {
    const x = X + q.x, y = Y + q.y;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = y * cols + x;
    // The drawing head: the last few outline pegs burn white-hot while it draws (or while it traces).
    const hot = head && q.kind === 'outline' && ((draw < 1 && q.p > draw - .025) || (trace > 0 && trace < 1 && Math.abs(q.p - trace) < .025)) ? .7 : 0;
    put(i, Math.min(.95, q.I * k), q.tone, hot, q.kind === 'gloss' ? 1.06 : 1);
    lit[i] = 1;
  }
}

// ---- visemes: her mouth from her sound ---------------------------------------------------------------
// From one of her events (a phrase, an echo, a canon voice: file, its song-time map) and her recording's
// measured pitch track (lady-pitch.json: m, MIDI x 10 per 10 ms, 0 unvoiced; e, level in dB), one shape per
// frame: openness in 3 steps from the level, voiced stretches open and unvoiced ones barely, the shape from
// the word's vowel at that point, M, B and P pressed for 2 frames, F and V tucked. Every shape holds at
// least 2 frames; where a change would last one frame it starts a frame early (the mouth leads her by at
// most one frame, never lags). Frames are the film's: frame f shows the sound heard in its middle,
// plan time (f + .5) / fps - latency. settled:false returns the raw frames (a caller that merges several
// events settles once, over all of them).
const VOWEL = {a:'ah', e:'eh', i:'ee', o:'oh', u:'oo', y:'ee'};
export const LEVEL_STEPS = Object.freeze([-20, -12, -6]);        // dB: open 1, 2, 3 at or above these
export function openFromLevel(db, voiced) {
  const o = db >= LEVEL_STEPS[2] ? 3 : db >= LEVEL_STEPS[1] ? 2 : db >= LEVEL_STEPS[0] ? 1 : 0;
  return voiced ? o : Math.min(o, 1);
}
// The shape for a letter position inside a word: the nearest vowel group's shape, a press or a tuck on
// M, B, P, F, V.
export function shapeAt(text, frac) {
  const letters = [...String(text).toLowerCase()].filter(c => /[a-z]/.test(c));
  if (!letters.length) return 'uh';
  const i = Math.max(0, Math.min(letters.length - 1, Math.floor(frac * letters.length)));
  if (/[mbp]/.test(letters[i])) return 'press';
  if (/[fv]/.test(letters[i])) return 'fv';
  for (let d = 0; d < letters.length; d++) for (const j of [i + d, i - d]) if (j >= 0 && j < letters.length && VOWEL[letters[j]]) {
    // "ou" (compounds) and "oo" read round; "a" followed by "l" or "w" (calling) reads open.
    if (letters[j] === 'o' && letters[j + 1] === 'u') return 'oo';
    return VOWEL[letters[j]];
  }
  return 'uh';
}
// An event's sound as frames: [{f, shape, open}] for frames f0..f1 (inclusive). ev: {file, from, to, start,
// end, rate, words:[{text, file:[a, b], ...}], warp?:[[fileTime, songTime], ...]}. pitch: lady-pitch.json.
export function eventVisemes(ev, pitch, {fps = 24, latency = 0, f0, f1, settled = true} = {}) {
  const track = pitch[ev.file];
  if (!track) return [];
  const words = ev.words?.length ? ev.words : [{text:ev.text ?? 'ah', file:[ev.from, ev.to]}];
  const fileAt = t => {
    if (ev.warp?.length) {
      const w = ev.warp;
      if (t <= w[0][1]) return w[0][0];
      for (let i = 1; i < w.length; i++) if (t <= w[i][1]) { const [a, ta] = w[i - 1], [b, tb] = w[i]; return a + (b - a) * (t - ta) / Math.max(1e-9, tb - ta); }
      return w.at(-1)[0] + (t - w.at(-1)[1]) * (ev.rate ?? 1);
    }
    return ev.from + (t - ev.start) * (ev.rate ?? 1);
  };
  const a = f0 ?? Math.floor((ev.start + latency) * fps), b = f1 ?? Math.ceil((ev.end + latency) * fps);
  const out = [];
  for (let f = a; f <= b; f++) {
    const t = (f + .5) / fps - latency, ft = fileAt(t);
    if (ft < ev.from - 1e-6 || ft > ev.to + 1e-6) { out.push({f, shape:'rest', open:0}); continue; }
    const i = Math.round((ft - track.t0) / track.hop), m = track.m[i] ?? 0, e = track.e?.[i] ?? -60;
    const open = openFromLevel(e, m > 0);
    const w = words.find(x => ft >= x.file[0] - 1e-6 && ft < x.file[1] + 1e-6);
    let shape = w ? shapeAt(w.display ?? w.text, (ft - w.file[0]) / Math.max(1e-6, w.file[1] - w.file[0])) : 'rest';
    if (open === 0 && shape !== 'press' && shape !== 'fv') shape = 'rest';
    out.push({f, shape, open:shape === 'press' ? 0 : shape === 'fv' ? Math.min(open, 1) : open});
  }
  return settled ? settle(out) : out;
}
// Every shape holds at least `min` frames (2), and the mouth leads her by at most min - 1 frames (1), never
// lags. One pass over the runs, left to right: a run shorter than `min` starts that much earlier, taking the
// frames from the run before it when that run can spare them and still hold `min`; otherwise it is too short
// to show and its frames go to the run after it, which then starts that much early. (Borrowing again and again
// would let a string of short runs push the mouth several frames ahead of her.)
export function settle(frames, min = 2) {
  const same = (p, q) => p.shape === q.shape && p.open === q.open, runs = [];
  for (const x of frames) { const r = runs.at(-1); if (r && same(r, x)) r.n++; else runs.push({shape:x.shape, open:x.open, n:1}); }
  for (let i = 0, last = -1; i < runs.length; i++) {
    const r = runs[i], prev = runs[last], next = runs[i + 1], need = min - r.n;
    if (r.n >= min) { last = i; continue; }
    if (prev && prev.n - need >= min) { prev.n -= need; r.n = min; last = i; }
    else if (next) { next.n += r.n; r.n = 0; }
    else if (prev) { prev.n += r.n; r.n = 0; }
    else last = i;
  }
  const out = [];
  let k = 0;
  for (const r of runs) for (let j = 0; j < r.n; j++, k++) out.push({...frames[k], shape:r.shape, open:r.open});
  return out;
}
// The runs of a viseme list, as [frame, code] at each change (what an EDL keys).
export function visemeKeys(frames) {
  const keys = [];
  for (const x of frames) { const c = code(x.shape, x.open); if (!keys.length || keys.at(-1)[1] !== c) keys.push([x.f, c]); }
  return keys;
}
