// Psychedelic imagery on the dot grid. Generative patterns painted into a Peg Board, pure functions
// of (board size, time, the music, seed, params): the same inputs light the same pegs, so the
// specimen, the preview and the export agree. They breathe with the song: the voices' envelope sets
// how much light they carry, the clap loop swells the pegs and pushes the motion on the backbeat, and
// the beat phase drives every cycle, so each look loops with the bar.
//
//   const drive = driveTrack({plan, features});        // the music, once per song (features: edl/params.js)
//   paintPsych(board, {look:'mandala', seed:3, params:{fold:8}}, t, {drive:driveAt(drive, t)});
//
// Rules, for every look:
//   - Colour is the Peg Board's palette and nothing else: blue, white, signal and deep tones, with
//     intensity, the white mix and peg size. Never green (board.js PALETTE).
//   - Type always wins: paintPsych runs after choreo.paint and treats every peg already lit as type.
//     It never relights those pegs, keeps a dark moat of one peg around them, dims the pattern within
//     TYPE_HALO pegs of them, and dims the whole pattern to TYPE_DIM while any word is lit.
//   - Slow flows, never flashes: brightness moves only with slow envelopes (the voices: attack .25 s,
//     release .9 s), the claps move geometry and peg size (size is not luminance), and every look keeps
//     its average light steady as it moves (many periods across the board, a soft vignette). Each look
//     passes the flash governor ungoverned on long runs (scripts/check-pegboard.mjs).
//   - True black stays black: nothing is painted on a board whose exposure is 0 (the choke).
import {PALETTE} from './board.js';

const TAU = Math.PI * 2;
const BLUE = PALETTE.blue.id, WHITE = PALETTE.white.id, SIGNAL = PALETTE.signal.id, DEEP = PALETTE.deep.id;
export const PSYCH_TONES = Object.freeze([BLUE, WHITE, SIGNAL, DEEP]);
// Type priority: the pattern within TYPE_HALO pegs of a lit word dims toward it (dark at 1 peg), and
// while any word is lit the whole pattern runs at TYPE_DIM of its light.
export const TYPE_HALO = 5, TYPE_DIM = .55;
// The brightest a pattern peg may burn (type sits at 1 and above, so it always reads brighter).
export const PSYCH_MAX = .95;

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const frac = x => x - Math.floor(x);
function hash(n, salt = 0) {
  let h = Math.imul((n | 0) + 0x9e3779b1, 0x85ebca77) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// ---- the looks ------------------------------------------------------------------------------------
// Every look shares these params; each adds its own. All are numbers (an EDL may key or bind them).
const COMMON = {
  level:{d:.85, doc:'0..1: how much light the pattern carries'},
  speed:{d:1, doc:'motion per beat: 1 is the look\'s own loop, .5 half time'},
  scale:{d:1, doc:'feature size: 2 doubles every ring, arm and blob'},
  cx:{d:.5, doc:'the centre, 0..1 of the board\'s width'},
  cy:{d:.5, doc:'the centre, 0..1 of the board\'s height'},
  breath:{d:1, doc:'0..1: how much the voices and the claps move it'},
};
export const LOOKS = Object.freeze({
  ripples:{title:'Ripples', caption:'Rings born on every beat, travelling out from the centre or from one peg. A signal ring leaves on each bar.',
    params:{spacing:{d:6, doc:'pegs between rings'}, px:{d:-1, doc:'a peg column to ripple from (-1: cx)'}, py:{d:-1, doc:'a peg row to ripple from (-1: cy)'}}},
  spiral:{title:'Spiral', caption:'Arms that wind in and turn a full arm every bar; the claps push them on.',
    params:{arms:{d:3, doc:'arms'}, twist:{d:1.2, doc:'turns from the centre to the edge'}}},
  pinwheel:{title:'Pinwheel', caption:'Blades in two rings turning against each other, a signal blade among the blue.',
    params:{blades:{d:8, doc:'blades in each ring'}}},
  moire:{title:'Moiré', caption:'Two sets of rings from centres that orbit each other; the fringes are their interference.',
    params:{spacing:{d:5, doc:'pegs between rings of each set'}, spread:{d:.55, doc:'how far apart the two centres orbit, 0..1 of the short side'}}},
  plasma:{title:'Plasma', caption:'A slow colour field of summed waves, cycling deep, blue, white and signal.',
    params:{}},
  mandala:{title:'Mandala', caption:'A kaleidoscope with 6, 8 or 12-fold mirror symmetry: petals and bands that breathe with the voices.',
    params:{fold:{d:8, doc:'mirror symmetry: 6, 8 or 12 (any whole number from 3)'}, petals:{d:2, doc:'petals per wedge'}}},
  lissajous:{title:'Lissajous', caption:'Flowing figures traced by a white-hot head, their trails cooling through blue to deep.',
    params:{a:{d:3, doc:'x frequency'}, b:{d:2, doc:'y frequency'}, curves:{d:2, doc:'figures, 1 to 3'}, trail:{d:10, doc:'beats of trail'}}},
  footage:{title:'Footage through the grid', caption:'A video frame taken over by pegs, sharper and in colour: warm light to signal, cool to blue, shadows to deep.',
    params:{gamma:{d:1.15, doc:'luma exponent'}, sharpen:{d:.9, doc:'local contrast, 0..2'}, colour:{d:1, doc:'0..1: 0 blue levels only, 1 the full palette'}}},
});
export const PSYCH_LOOKS = Object.freeze(Object.keys(LOOKS));
export const lookParams = look => ({...COMMON, ...(LOOKS[look]?.params || {})});
// The params of a look with defaults filled in (unknown keys dropped).
export function resolveParams(look, params = {}) {
  const spec = lookParams(look), out = {};
  for (const [k, p] of Object.entries(spec)) out[k] = Number.isFinite(params[k]) ? params[k] : p.d;
  return out;
}

// ---- the music ------------------------------------------------------------------------------------
// {beat, voice, clap}: beat is the count of quarter notes since the song began (continuous, swing-free:
// read on quarter-note boundaries of plan.timing), voice the voices' slow envelope 0..1, clap the clap
// loop's swell 0..1 (it rises on the frame that holds each backbeat hit and eases off over ~.35 s).
const env = (x, fps, attack, release) => {
  const a = attack > 0 ? 1 - Math.exp(-1 / (fps * attack)) : 1, r = release > 0 ? 1 - Math.exp(-1 / (fps * release)) : 1, y = new Float32Array(x.length);
  let v = 0;
  for (let g = 0; g < x.length; g++) { v += (x[g] > v ? a : r) * (x[g] - v); y[g] = v; }
  return y;
};
export const VOICE_ENV = {attack:.25, release:.9}, CLAP_ENV = {attack:0, release:.35};
// The beat clock of a plan (quarter notes from plan.timing), or of a tempo.
export function beatClock(plan, bpm = 108) {
  const T = plan?.timing;
  if (!T || T.length < 5) return t => t * bpm / 60;
  const n = Math.floor((T.length - 1) / 4);
  return t => {
    if (t <= T[0]) return (t - T[0]) / (T[4] - T[0]);
    if (t >= T[4 * n]) return n + (t - T[4 * n]) / (T[4 * n] - T[4 * n - 4]);
    let lo = 0, hi = n;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[4 * mid] <= t) lo = mid; else hi = mid; }
    return lo + (t - T[4 * lo]) / (T[4 * lo + 4] - T[4 * lo]);
  };
}
// The drive of a song, once: from its feature tracks (edl/params.js buildFeatures or planFeatures:
// stems.voice, stems.lady, stems.choir, clap), or, with none, from the plan alone (his words and her
// events for the voices, plan.claps or the backbeat, 2 and 4, for the claps), or from a bare tempo
// (the specimen: claps on 2 and 4, a voice that sings two bars and rests two).
const driveCache = new WeakMap();
export function driveTrack({plan = null, features = null, bpm = 108, fps = 24, duration} = {}) {
  const key = features || plan;
  if (key && driveCache.has(key)) return driveCache.get(key);
  const beat = beatClock(plan, bpm), frames = features?.frames ?? Math.ceil((duration ?? plan?.duration ?? 64) * fps);
  const voiceRaw = new Float32Array(frames), clapRaw = new Float32Array(frames), f = features?.fps ?? fps;
  if (features) {
    for (const n of ['voice', 'lady', 'choir']) { const x = features.stems?.[n]; if (x) for (let g = 0; g < frames; g++) if (x[g] > voiceRaw[g]) voiceRaw[g] = x[g]; }
    if (features.clap) clapRaw.set(features.clap.subarray(0, frames));
  } else if (plan) {
    const T = plan.timing, at = s => T[Math.max(0, Math.min(T.length - 1, Math.floor(s)))] + (s % 1) * (plan.step ?? (T[1] - T[0]));
    const span = (t0, t1, v) => { for (let g = Math.max(0, Math.floor(t0 * f)); g < frames && g / f < t1; g++) voiceRaw[g] = Math.max(voiceRaw[g], v); };
    for (const w of plan.words || []) { const t = at(w.at); span(t, t + (w.gate ?? .2), .8); }
    for (const e of plan.lady || []) { const t = at(e.at); span(t, t + (e.gate ?? .2), .8); }
    const BS = plan.barSteps ?? 16, steps = Array.isArray(plan.claps) ? plan.claps : (plan.bars || []).flatMap((b, i) => b.layers && (b.layers.clap || b.layers.snare || b.layers.snap) ? [i * BS + 4, i * BS + 12] : []);
    for (const s of steps) { const g = Math.floor(at(s) * f + 1e-9); if (g >= 0 && g < frames) clapRaw[g] = 1; }
  } else {
    for (let g = 0; g < frames; g++) {
      const b = g / f * bpm / 60, inBeat = b - Math.floor(b);
      if (inBeat < bpm / 60 / f && Math.floor(b) % 2 === 1) clapRaw[g] = 1;
      voiceRaw[g] = Math.floor(b / 8) % 2 === 0 && inBeat < .8 ? .75 : 0;
    }
  }
  const out = {fps:f, frames, beat, voice:env(voiceRaw, f, VOICE_ENV.attack, VOICE_ENV.release), clap:env(clapRaw, f, CLAP_ENV.attack, CLAP_ENV.release), source:features ? features.source || 'features' : plan ? 'plan' : 'clock'};
  if (key) driveCache.set(key, out);
  return out;
}
// The drive at song time t (frames between are interpolated, so a pattern never steps).
export function driveAt(track, t) {
  const x = Math.max(0, t * track.fps), g = Math.min(track.frames - 1, Math.floor(x)), h = Math.min(track.frames - 1, g + 1), u = x - Math.floor(x);
  const lerp = a => a.length ? a[g] + (a[h] - a[g]) * u : 0;
  return {t, beat:track.beat(t), voice:lerp(track.voice), clap:lerp(track.clap)};
}

// ---- the river: the haze lane's board (plan.form 'wander') -------------------------------------------
// Offsite runs as a river: repeating samples layered into a texture, one or two clear phrases rising out of
// it. Its board is mostly texture: one look for the song, its light the loop's layers as they ramp in and
// out (plan.layers), so the dot grid thickens as the stream does and thins as it lets go; the words, when a
// clear phrase sings, win as always (paintPsych after choreo.paint).
//   const river = riverTrack(plan);                     // once per song
//   const {spec, drive} = riverAt(river, t);            // then paintPsych(board, spec, t, {drive})
// A layer is {from, to} (seconds; or steps, at, len), ramping in over rampIn or in (or [from, full]) and out
// over rampOut or out (or [fade, to]), each two bars when the plan gives none, at gain (linear, or dB below 0)
// times level; or it carries its own gain curve, [[t, v], ...] (wander.js), read as it is.
// plan.swells [{at|from, to|len, amount}] lift the light a little more; plan.slow [{from, to}] spans run the
// pattern at half speed (the beat is integrated, so the motion slows, never jumps).
export const RIVER_LOOKS = Object.freeze(['plasma', 'moire', 'ripples', 'lissajous']);
export const RIVER_LEVEL = Object.freeze({floor:.15, span:.7});        // params.level = floor + span * layers
const secOf = (plan, v) => {
  if (!Number.isFinite(v)) return null;
  const T = plan?.timing;
  // A value past the song's end is a step on plan.timing (16ths), else seconds.
  if (T && v > (plan.duration ?? T[T.length - 1]) + 1) return T[Math.min(T.length - 1, Math.floor(v))] + (v % 1) * (plan.step ?? (T[1] - T[0]));
  return v;
};
export function layerGain(plan, L, t) {
  // A gain curve [[t, v], ...] (wander.js: its ramps and swells already in it) is read as it is.
  if (Array.isArray(L.gain) && L.gain.length) {
    const g = L.gain, at = p => [secOf(plan, p[0]), p[1]];
    if (t <= at(g[0])[0]) return g[0][1];
    for (let i = 1; i < g.length; i++) { const [t1, v1] = at(g[i]), [t0, v0] = at(g[i - 1]); if (t <= t1) return t1 > t0 ? v0 + (v1 - v0) * (t - t0) / (t1 - t0) : v1; }
    return g.at(-1)[1];
  }
  const bar = 16 * (plan.step ?? .125);
  const from = secOf(plan, L.from ?? L.rampIn?.[0] ?? L.in?.[0] ?? L.at), to = secOf(plan, L.to ?? L.rampOut?.[1] ?? L.out?.[1] ?? (Number.isFinite(L.len) ? (L.from ?? L.at) + L.len : null)) ?? plan.duration ?? Infinity;
  if (from === null || t < from || t >= to) return 0;
  const full = secOf(plan, L.rampIn?.[1] ?? L.in?.[1]) ?? from + 2 * bar, fade = secOf(plan, L.rampOut?.[0] ?? L.out?.[0]) ?? to - 2 * bar;
  const g = (Number.isFinite(L.gain) ? (L.gain < 0 ? 10 ** (L.gain / 20) : L.gain) : 1) * (Number.isFinite(L.level) ? L.level : 1);
  return g * Math.min(full > from ? smooth(from, full, t) : 1, fade < to ? 1 - smooth(fade, to, t) : 1);
}
const riverCache = new WeakMap();
export function riverTrack(plan, {features = null, fps = 24} = {}) {
  if (riverCache.has(plan) && !features) return riverCache.get(plan);
  const base = driveTrack({plan, features, fps}), f = base.fps, frames = base.frames, layers = plan.layers || [];
  const raw = new Float32Array(frames), swell = new Float32Array(frames), speed = new Float32Array(frames).fill(1);
  for (let g = 0; g < frames; g++) { const t = g / f; for (const L of layers) raw[g] += layerGain(plan, L, t); }
  const top = Math.max(1e-6, ...raw);
  for (let g = 0; g < frames; g++) raw[g] /= top;
  for (const w of plan.swells || []) {
    const a = secOf(plan, w.from ?? w.at), b = secOf(plan, w.to) ?? (a + (w.len ?? 2 * 16 * (plan.step ?? .125)));
    if (a === null) continue;
    for (let g = Math.max(0, Math.floor(a * f)); g < frames && g / f < b; g++) swell[g] = Math.max(swell[g], (w.amount ?? .25) * Math.sin(Math.PI * (g / f - a) / Math.max(1e-3, b - a)));
  }
  for (const s of plan.slow || []) { const a = secOf(plan, s.from ?? s.at), b = secOf(plan, s.to) ?? a; if (a !== null) for (let g = Math.max(0, Math.floor(a * f)); g < frames && g / f < b; g++) speed[g] = s.rate ?? .5; }
  // The layers' light, slowed (nothing moves faster than the ramps: attack and release of a bar).
  const level = env(raw, f, 2, 2), sp = env(speed, f, 1, 1), beat = new Float64Array(frames + 1);
  for (let g = 0; g < frames; g++) beat[g + 1] = beat[g] + (base.beat((g + 1) / f) - base.beat(g / f)) * sp[g];
  // The look: by the song (its track and the words it carries), so one track's songs do not all share one.
  const words = [...(plan.band || []), ...(plan.loops || [])].map(x => x.display ?? x.text ?? '').join('|');
  let h = 2166136261; for (const c of `${plan.track ?? ''}|${plan.trackTitle ?? ''}|${words}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = {...base, layers:level, swell:env(swell, f, 1, 1), beatAt:beat, look:RIVER_LOOKS[(h >>> 0) % RIVER_LOOKS.length], seed:(h >>> 8) % 97};
  if (!features) riverCache.set(plan, out);
  return out;
}
export function riverAt(river, t) {
  const x = Math.max(0, t * river.fps), g = Math.min(river.frames - 1, Math.floor(x)), u = x - Math.floor(x), h = Math.min(river.frames - 1, g + 1);
  const lerp = a => a[g] + (a[h] - a[g]) * u, layers = clamp(lerp(river.layers)), d = driveAt(river, t);
  const beat = river.beatAt[g] + (river.beatAt[g + 1] - river.beatAt[g]) * u;
  return {spec:{look:river.look, seed:river.seed, params:{level:clamp(RIVER_LEVEL.floor + RIVER_LEVEL.span * layers + .1 * lerp(river.swell))}},
    drive:{t, beat, voice:Math.max(d.voice * .5, layers), clap:d.clap * layers}, layers};
}

// ---- the field --------------------------------------------------------------------------------------
// A look's light for every peg of a cols × rows board at time t: {I, tone, white, size}, typed arrays.
// Pure. frame: for 'footage', the picture sampled one value per peg ({cols, rows, data} RGBA, top row
// first, at the board's own size). The arrays are reused by the next call of the same size: copy to keep.
const scratch = new Map();
function buffers(n) {
  let s = scratch.get(n);
  if (!s) scratch.set(n, s = {I:new Float32Array(n), tone:new Uint8Array(n), white:new Float32Array(n), size:new Float32Array(n), mask:new Uint8Array(n), dist:new Float32Array(n), Y:new Float32Array(n), B:new Float32Array(n)});
  return s;
}

export function psychField(look, cols, rows, t, {drive = {beat:t * 1.8, voice:.5, clap:0}, seed = 0, params = {}, frame = null} = {}) {
  if (!LOOKS[look]) throw Error(`unknown psych look "${look}" (${PSYCH_LOOKS.join(', ')})`);
  const n = cols * rows, F = buffers(n), P = resolveParams(look, params);
  F.I.fill(0); F.tone.fill(BLUE); F.white.fill(0); F.size.fill(1);
  const br = clamp(P.breath), voice = clamp(drive.voice ?? 0), clap = clamp(drive.clap ?? 0);
  const beat = (drive.beat ?? 0) * P.speed + hash(seed, 1) * 16;
  // The light the voices carry: .62 to 1 (slow), and the clap's swell in size (no light).
  const lift = (1 - br) * .8 + br * (.62 + .38 * voice), swell = 1 + .14 * br * clap, push = .18 * br * clap;
  const R = Math.max(1, Math.min(cols, rows) / 2), scale = Math.max(.2, P.scale);
  const cx = P.cx * cols - .5, cy = P.cy * rows - .5, level = clamp(P.level) * PSYCH_MAX * lift;
  const rot = hash(seed, 2) * TAU;
  const put = (i, v, tone, white = 0, size = 1) => { F.I[i] = clamp(v) * level; F.tone[i] = tone; F.white[i] = white; F.size[i] = size * swell; };
  const vignette = r => 1 - .35 * smooth(.6, 1.6, r);

  if (look === 'ripples') {
    const sx = P.px >= 0 ? P.px : cx, sy = P.py >= 0 ? P.py : cy, lam = Math.max(2, P.spacing * scale);
    // One ring born per beat; the claps surge them forward. Rings are counted from the source, so a
    // ring keeps its colour as it travels: every fourth (one a bar) is signal, the rest blue and deep.
    const phase = beat + push;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const r = Math.hypot(x - sx, y - sy), w = r / lam - phase, k = Math.floor(w), u = w - k;
      const crest = Math.pow(.5 + .5 * Math.cos(TAU * (u - .5)), 2.2);
      const ring = ((k % 4) + 4) % 4, tone = ring === 0 ? SIGNAL : ring === 2 ? BLUE : DEEP;
      put(i, (.08 + .92 * crest) * vignette(r / R) * (ring === 0 ? .85 : 1), tone, crest > .8 && ring === 2 ? .35 * (crest - .8) / .2 : 0, .9 + .2 * crest);
    }
  } else if (look === 'spiral' || look === 'pinwheel') {
    const arms = Math.max(1, Math.round(look === 'spiral' ? P.arms : P.blades)), twist = look === 'spiral' ? P.twist / scale : 0;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const dx = (x - cx) / R, dy = (y - cy) / R, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + rot;
      let turn, inner = 1;
      // A full arm turns every bar; the pinwheel's inner ring turns the other way at 1.5×.
      if (look === 'spiral') turn = (beat + push) / 4;
      else { inner = r < .55 ? -1.5 : 1; turn = inner * (beat + push) / 8; }
      const w = (a / TAU) * arms + twist * arms * r - turn * (look === 'spiral' ? 1 : arms), k = Math.floor(w), u = w - k;
      const blade = Math.pow(.5 + .5 * Math.cos(TAU * (u - .5)), look === 'spiral' ? 1.6 : 2.4);
      const id = ((k % arms) + arms) % arms, tone = look === 'pinwheel' ? (id === 0 ? SIGNAL : (id % 2 ? DEEP : BLUE)) : (id === 0 ? WHITE : id % 2 ? DEEP : BLUE);
      // (The pinwheel's two rings part along a dark seam, so the blades never meet head on.)
      const hub = smooth(.04, .16, r), edge = look === 'pinwheel' ? smooth(.015, .06, Math.abs(r - .55)) : 1;
      put(i, (.06 + .94 * blade) * hub * edge * vignette(r), tone, look === 'spiral' && id === 0 ? .25 * blade : 0, .88 + .22 * blade);
    }
  } else if (look === 'moire') {
    const lam = Math.max(1.6, P.spacing * scale), d = clamp(P.spread, 0, 1) * R, o = TAU * (beat / 16) + rot;
    const ax = cx + d * Math.cos(o), ay = cy + d * Math.sin(o) * .6, bx = cx - d * Math.cos(o), by = cy - d * Math.sin(o) * .6;
    const ph = (beat + push) * .5;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const r1 = Math.hypot(x - ax, y - ay), r2 = Math.hypot(x - bx, y - by);
      const c1 = (.5 + .5 * Math.cos(TAU * (r1 / lam - ph))) ** 1.5, c2 = (.5 + .5 * Math.cos(TAU * (r2 / lam - ph))) ** 1.5;
      // The slow beat fringes (where the two sets agree) burn toward white; tone never flips under light.
      const v = c1 * c2, fringe = .5 + .5 * Math.cos(TAU * (r1 - r2) / (lam * 2.2));
      put(i, (.05 + .95 * v) * vignette(Math.hypot(x - cx, y - cy) / R), BLUE, .55 * smooth(.7, 1, fringe) * v, .85 + .3 * v);
    }
  } else if (look === 'plasma') {
    const s = 1 / (R * .55 * scale), p = beat / 8 + push * .5;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const u = (x - cx) * s, v = (y - cy) * s;
      const f = Math.sin(u * 1.7 + TAU * p * .5) + Math.sin(v * 2.1 - TAU * p * .37 + rot) + Math.sin((u + v) * 1.3 + TAU * p * .23)
        + Math.sin(Math.hypot(u + 1.8 * Math.sin(TAU * p * .11), v + 1.4 * Math.cos(TAU * p * .13)) * 2.4);
      // Hue cycles deep, blue, white, signal, blue, deep around the field; light peaks between them.
      const h = frac(f * .18 + p * .25 + hash(seed, 3)), band = h * 5, k = Math.floor(band), m = band - k;
      const tone = [DEEP, BLUE, WHITE, SIGNAL, BLUE][k], crest = .5 + .5 * Math.cos(TAU * (m - .5));
      put(i, (.18 + .82 * crest) * (.75 + .25 * Math.sin(f * 1.1)), tone, tone === WHITE ? .2 * crest : 0, .9 + .18 * crest);
    }
  } else if (look === 'mandala') {
    // Rings that travel out with the beat, each cut into petals by the folded angle; alternate rings
    // set their petals half a petal over, so the rings weave. A ring keeps its tone as it travels and
    // changes it only at the dark between rings: white at the heart, then blue, deep, blue, signal.
    const fold = Math.max(3, Math.round(P.fold)), wedge = TAU / fold, petals = Math.max(1, P.petals);
    const spin = TAU * (beat / (fold * 4)) + rot, travel = (beat + push) / 4, rings = 3.2 / scale;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const dx = (x - cx) / R, dy = (y - cy) / R, r = Math.hypot(dx, dy);
      let a = (Math.atan2(dy, dx) + spin) % wedge; if (a < 0) a += wedge;
      a = Math.min(a, wedge - a) / (wedge / 2);                  // 0 on a mirror line, 1 mid-wedge
      const w = r * rings - travel, k = Math.round(w), u = w - k, ring = Math.cos(Math.PI * u) ** 2;
      const lobe = Math.cos(Math.PI * (petals * a + (k % 2 ? .5 : 0))) ** 2;
      const v = ring ** 1.3 * (.22 + .78 * lobe) * smooth(.0, .06, r);
      const id = ((k % 4) + 4) % 4, tone = r * rings < .5 + .02 ? WHITE : [BLUE, DEEP, BLUE, SIGNAL][id];
      put(i, (.04 + .96 * v) * vignette(r), tone, .3 * lobe * ring * (tone === BLUE ? 1 : 0), .85 + .3 * v);
    }
  } else if (look === 'lissajous') {
    // Figures traced through time: a head at the newest point and a trail of older points, each a soft
    // disc. Pure: every point is a function of the beat it was traced on. A figure loops every 4 bars.
    const curves = clamp(Math.round(P.curves), 1, 3), L = Math.max(.25, P.trail), N = Math.ceil(24 * L), ax = cols * .42, ay = rows * .42, rad = Math.max(1.1, R * .045 * scale);
    for (let c = 0; c < curves; c++) {
      const da = c * .37 + hash(seed, 10 + c), tone = c === 1 ? SIGNAL : BLUE;
      for (let j = N - 1; j >= 0; j--) {
        const age = j / (N - 1), tau = (beat + push - age * L) / 16 * TAU;
        const px = cx + ax * Math.sin(P.a * tau + da * TAU), py = cy + ay * Math.sin(P.b * tau + c * .9);
        const heat = 1 - age, rr = rad * (1 + .6 * heat * heat), x0 = Math.max(0, Math.floor(px - rr)), x1 = Math.min(cols - 1, Math.ceil(px + rr)), y0 = Math.max(0, Math.floor(py - rr)), y1 = Math.min(rows - 1, Math.ceil(py + rr));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const q = Math.hypot(x - px, y - py) / rr; if (q >= 1) continue;
          const i = y * cols + x, v = (1 - q * q) * (.18 + .82 * heat * heat);
          if (clamp(v) * level <= F.I[i]) continue;
          // The head burns white-hot (a white mix, the tone held), the tail cools to deep.
          put(i, v, age > .6 ? DEEP : tone, .8 * smooth(.75, 1, heat), .9 + .3 * heat);
        }
      }
    }
  } else if (look === 'footage') {
    // One sample per peg; local contrast against a 5×5 box blur sharpens it; hue picks the tone.
    if (!frame?.data) return F;
    const W = frame.cols ?? cols, H = frame.rows ?? rows, d = frame.data, Y = F.Y, B = F.B;
    const at = (x, y) => (Math.min(H - 1, Math.floor(y * H / rows)) * W + Math.min(W - 1, Math.floor(x * W / cols))) * 4;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) { const k = at(x, y); Y[i] = (.2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2]) / 255; }
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      let s = 0, m = 0;
      for (let v = Math.max(0, y - 2); v <= Math.min(rows - 1, y + 2); v++) for (let u = Math.max(0, x - 2); u <= Math.min(cols - 1, x + 2); u++) { s += Y[v * cols + u]; m++; }
      B[i] = s / m;
    }
    const sharp = clamp(P.sharpen, 0, 2), colour = clamp(P.colour);
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const k = at(x, y), r = d[k] / 255, g = d[k + 1] / 255, b = d[k + 2] / 255;
      const l = clamp(Y[i] + sharp * (Y[i] - B[i])), mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
      let hue = 0;
      if (mx > mn) hue = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      hue *= 60;
      // Warm light (red, orange, yellow, magenta, skin) to signal; cool and green to blue; shadows to
      // deep; bright and grey to white. Green never survives: it becomes blue.
      let tone = BLUE;
      if (colour > 0 && sat > .22 * (2 - colour) && (hue < 65 || hue > 290) && l > .2) tone = SIGNAL;
      else if (l < .28) tone = DEEP;
      else if (sat < .18 && l > .62) tone = WHITE;
      const v = Math.pow(l, Math.max(.3, P.gamma));
      put(i, .06 + .94 * v, tone, l > .86 ? .5 * (l - .86) / .14 : 0, .82 + .32 * v);
    }
  }
  return F;
}

// ---- onto a board ---------------------------------------------------------------------------------
// Paint a look into a board that choreo has already painted for this moment. spec: {look, seed?,
// params?, fade?} (fade 0..1: the cue's own in and out). Every peg already lit is type (or the board's
// own light: the equalizer, the ignition) and wins. Returns the board.
export function paintPsych(board, spec, t, {drive, frame} = {}) {
  if (!spec || !(board.exposure > 0)) return board;
  const fade = clamp(spec.fade ?? 1);
  if (fade <= 0) return board;
  const {cols, rows} = board, n = cols * rows, F = psychField(spec.look, cols, rows, t, {drive, seed:spec.seed ?? 0, params:spec.params, frame});
  // The type mask and its distance field (chamfer 3-4, in pegs), capped at the halo.
  const mask = F.mask, dist = F.dist, cap = TYPE_HALO + 1;
  let words = 0;
  for (let i = 0; i < n; i++) { const on = board.I[i] > 0; mask[i] = on ? 1 : 0; dist[i] = on ? 0 : cap; words += mask[i]; }
  if (words) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x; let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) { d = Math.min(d, dist[i - cols] + 1); if (x > 0) d = Math.min(d, dist[i - cols - 1] + 1.4); if (x < cols - 1) d = Math.min(d, dist[i - cols + 1] + 1.4); }
      dist[i] = d;
    }
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x; let d = dist[i];
      if (x < cols - 1) d = Math.min(d, dist[i + 1] + 1);
      if (y < rows - 1) { d = Math.min(d, dist[i + cols] + 1); if (x < cols - 1) d = Math.min(d, dist[i + cols + 1] + 1.4); if (x > 0) d = Math.min(d, dist[i + cols - 1] + 1.4); }
      dist[i] = d;
    }
  }
  // (board.ambient: the share of the board's exposure that light which is not type takes; under a screen
  // that holds full through the build's dim, choreo.paint sets it to that dim.)
  const global = (words ? TYPE_DIM : 1) * fade * (board.ambient ?? 1);
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue;
    const near = words ? smooth(1.2, TYPE_HALO, dist[i]) : 1, I = F.I[i] * near * global;
    if (I <= .02) continue;
    board.I[i] = I; board.tone[i] = F.tone[i]; board.white[i] = F.white[i]; board.size[i] = F.size[i]; board.dx[i] = 0; board.dy[i] = 0;
  }
  return board;
}

// The fade of a psych span at song time t: in over `fadeIn`, out over `fadeOut` seconds (both at least
// half a beat, so a pattern never switches on or off in one frame).
export function psychFade(t, from, to, {fadeIn = .5, fadeOut = .5} = {}) {
  if (t < from || t >= to) return 0;
  return Math.min(smooth(0, Math.max(1e-3, fadeIn), t - from), smooth(0, Math.max(1e-3, fadeOut), to - t));
}
