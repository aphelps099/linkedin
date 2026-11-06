// Her vocabulary, said once and then handed to the echo ("Delve.",
// songbook/delve.js): the stages a clear phrase of hers goes through, from
// crisp to dissolved. Pure functions on Float32Array (no Web Audio): every
// stage of a phrase is baked once, at the song's first bar, into at most three
// stereo buffers (exact.js: a voice is one input, so a chain of a dozen echoes
// never asks a bus to sum more than two things at once).
//
//   dry    the phrase as she says it, on top of the stream: crisp (the cut at
//          her tuning rate), doubled (a copy 18 ms late, 7 cents up), harmonised
//          (PSOLA copies on other notes of the pentatonic, her formants kept),
//          on a slowing tape (tapeWarp), or shadowed (doubled, an octave-down
//          PSOLA shadow, a tape wow, light pixels).
//   wet    what follows it (plan.echoes): delay taps of a word, darker each
//          time; PSOLA copies a fifth down or stepping down the pentatonic; the
//          word at half speed (the tape an octave down); the echo to fade (a
//          dotted-8th feedback line whose low-pass falls as it repeats); the
//          frozen grain ("of..." looping on 8ths); the canon (her phrase sung on
//          the choir's tune by more and more voices).
//   throw  the word thrown whole into the river's long diffusion (no dry part).
//
// Times are song seconds; a bake places each part at its own song time, so the
// river schedules three buffers per phrase and nothing else.
import {place, decimate, crush, pixelParams, vowelMask, lowpass} from './voices/pixel.js';
import {analysisOf, pitchAt, CHANT_SYLLABLES} from './lady-choir.js';

const dB = x => 10 ** (x / 20);
const midiHz = m => 440 * 2 ** ((m - 69) / 12);

// 4-point Hermite read (0 outside the signal).
function hermite(x, p) {
  const i = Math.floor(p), f = p - i, n = x.length, at = k => (k >= 0 && k < n ? x[k] : 0);
  const xm1 = at(i - 1), x0 = at(i), x1 = at(i + 1), x2 = at(i + 2);
  const c = (x1 - xm1) * .5, v = x0 - x1, w = c + v, a = w + v + (x2 - x0) * .5, b = w + a;
  return ((a * f - b) * f + c) * f + x0;
}

// The tape slide of a phrase (stage 'tape'): the cut plays at its tuning rate until `slide` seconds of the
// file, then the tape slows linearly (in output time) from rate0 to rate1 of it by the end of the cut, under
// a wow. Returns {rateAt(tOut) (x the tuning rate), length (output seconds)} for that event: the bake and
// the plan (wander.js: the words' song times, the warp the picture reads) share it.
export function tapeWarp({from, to, rate, tape}) {
  const {slide, rate0 = 1, rate1 = .5, wow = {cents:9, hz:.9}} = tape, head = (slide - from) / rate;
  // after the slide starts the file advances by integral of rate*r(t): r falls linearly over D seconds
  const rest = (to - slide) / rate, D = rest / ((rate0 + rate1) / 2);
  const r = t => (t < head ? 1 : rate0 + (rate1 - rate0) * Math.min(1, (t - head) / D));
  const w = t => (t < head ? 1 : 2 ** ((wow.cents * Math.min(1, (t - head) / .4) * Math.sin(2 * Math.PI * wow.hz * (t - head))) / 1200));
  return {rateAt:t => r(t) * w(t), length:head + D, head, D};
}
// File seconds -> output seconds along a warp (for the words' times): integrate at 1 ms.
export function warpTimes(e, fileTimes) {
  const {rateAt, length} = tapeWarp(e), dt = .001, out = [], pts = [];
  let p = e.from, t = 0, k = 0;
  const want = [...fileTimes].map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const res = new Array(fileTimes.length);
  while (t <= length + dt && k < want.length) {
    while (k < want.length && want[k][0] <= p) { res[want[k][1]] = t; k++; }
    if (Math.round(t / dt) % 50 === 0) pts.push([+p.toFixed(4), +t.toFixed(4)]);
    p += e.rate * rateAt(t) * dt; t += dt;
  }
  for (; k < want.length; k++) res[want[k][1]] = length;
  void out;
  return {times:res, warp:pts, length};
}

// A cut of a signal (a version of her file): `from`-`to` seconds, at `rate` (a tape: pitch and time
// together) or along rateAt(tOut) x rate, a wow {cents, hz} on top; 3 ms in, `fadeOut` out.
export function cut(x, sr, {from, to, rate = 1, rateAt = null, wow = null, fadeIn = .003, fadeOut = .01, maxLength = 30}) {
  const a = from * sr, b = Math.min(x.length - 2, to * sr), out = [];
  if (!rateAt && !wow) {
    const n = Math.max(1, Math.floor((b - a) / rate)), y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = hermite(x, a + i * rate);
    return edges(y, sr, fadeIn, fadeOut);
  }
  let p = a, i = 0;
  const cap = maxLength * sr;
  while (p < b && i < cap) {
    out.push(hermite(x, p));
    const t = i / sr, w = wow ? 2 ** (wow.cents * Math.sin(2 * Math.PI * wow.hz * t) / 1200) : 1;
    p += rate * (rateAt ? rateAt(t) : 1) * w; i++;
  }
  return edges(Float32Array.from(out), sr, fadeIn, fadeOut);
}
function edges(y, sr, fadeIn, fadeOut) {
  const A = Math.min(y.length >> 1, Math.round(fadeIn * sr)), R = Math.min(y.length >> 1, Math.round(fadeOut * sr));
  for (let i = 0; i < A; i++) y[i] *= i / A;
  for (let i = 0; i < R; i++) y[y.length - 1 - i] *= i / R;
  return y;
}

// One-pole low-pass, its cutoff gliding exponentially from f0 to f1 across the signal.
export function darken(x, sr, f0, f1 = f0) {
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const f = f0 * (f1 / f0) ** (i / Math.max(1, x.length - 1)), a = Math.exp(-2 * Math.PI * f / sr);
    s = (1 - a) * x[i] + a * s; y[i] = s;
  }
  return y;
}

// Versions of her file, made once per decoded buffer: transposed by PSOLA (formants kept), pixelated
// (pixel.js: the hold and the crush on her vowels, her consonants mixed back clean), or both.
const VERSIONS = new WeakMap();
export function versionOf(x, sr, file, {shift = 0, amount = 0, notes = null} = {}) {
  let m = VERSIONS.get(x);
  if (!m) VERSIONS.set(x, m = new Map());
  const key = `${file}|${shift}|${amount}|${notes ? JSON.stringify(notes) : ''}`;
  if (m.has(key)) return m.get(key);
  const an = analysisOf(x, sr, file);
  let y = x;
  if ((shift || notes) && an.marks.length) {
    // notes: [[from, to, midi]] in file seconds (a syllable each); else her own pitch, `shift` semitones away.
    const k = 2 ** (shift / 12), note = t => { const n = notes?.find(([a, b]) => t >= a && t < b) ?? notes?.reduce((p, q) => (Math.abs(q[0] - t) < Math.abs(p[0] - t) ? q : p)); return n ? midiHz(n[2]) : 0; };
    y = place(x, sr, an, t => (notes ? note(t) : (pitchAt(an, t) || 200) * k));
  }
  if (amount > 0) {
    const P = pixelParams(amount), clean = y;
    let z = decimate(y, sr, P.rate, {antialias:P.antialias});
    let peak = 0; for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
    z = crush(z, P.bits, {peak, block:P.block, sr});
    if (an.marks.length) {
      const mask = vowelMask(x, an.marks, sr);
      for (let i = 0; i < z.length; i++) { const c = (1 - mask[i]) * P.consonants; z[i] = c * clean[i] + (1 - c) * z[i]; }
    }
    y = z;
  }
  m.set(key, y);
  return y;
}

// A stereo canvas starting at song time `at`, growing as parts are added.
function canvas(sr) {
  const parts = [];
  return {
    add(mono, t, {gain = 1, pan = 0} = {}) { if (mono.length) parts.push({mono, t, gl:gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr:gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2}); },
    get empty() { return !parts.length; },
    done(tail = 0) {
      if (!parts.length) return null;
      const at = Math.min(...parts.map(p => p.t)), end = Math.max(...parts.map(p => p.t + p.mono.length / sr)) + tail;
      // Placed on the sample grid relative to `at` (rounded once per part), so a bake is the same everywhere.
      const n = Math.ceil((end - at) * sr) + 1, L = new Float32Array(n), R = new Float32Array(n);
      for (const p of parts) {
        const o = Math.round((p.t - at) * sr);
        for (let i = 0; i < p.mono.length; i++) { L[o + i] += p.gl * p.mono[i]; R[o + i] += p.gr * p.mono[i]; }
      }
      return {at, channels:[L, R]};
    },
  };
}

// A crossfaded grain loop: the grain between two of her pitch marks near [from, to] (file seconds),
// looped for `length` seconds with a one-period equal-power crossfade at the seam, so the frozen
// vowel neither clicks nor buzzes at its loop point.
export function freezeLoop(x, sr, file, {from, to, length}) {
  const an = analysisOf(x, sr, file), marks = an.marks.filter(m => m.voiced && m.pos >= from * sr && m.pos <= to * sr);
  let a = Math.round(from * sr), b = Math.round(to * sr), T = Math.round(sr / 220);
  if (marks.length >= 3) { a = marks[0].pos; b = marks.at(-1).pos; T = Math.round(marks[1].pos - marks[0].pos); }
  const xf = Math.max(16, Math.min(T, (b - a) >> 2)), P = Math.max(xf + 1, b - a - xf), N = Math.round(length * sr), y = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = i % P;
    let v = x[a + j] ?? 0;
    if (i >= P && j < xf) { const u = j / xf; v = v * Math.sin(u * Math.PI / 2) + (x[a + P + j] ?? 0) * Math.cos(u * Math.PI / 2); }
    y[i] = v;
  }
  return edges(y, sr, .004, .03);
}

// The echo to fade: a dotted-8th line fed by `feed` (mono, starting at song time t0), each pass
// `feedback` of the last through a low-pass falling from f0 to f1 between song times [from, to]; the
// first repeat one delay after the feed; silent (faded over 80 ms) at `to`.
export function fadeLine(feed, sr, {t0, delay, feedback = .62, from, to, f0 = 3200, f1 = 350}) {
  const D = Math.round(delay * sr), n = Math.max(1, Math.round((to - t0) * sr)), y = new Float32Array(n), line = new Float32Array(D);
  let s = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sr, u = Math.min(1, Math.max(0, (t - from) / (to - from))), f = f0 * (f1 / f0) ** u, a = Math.exp(-2 * Math.PI * f / sr);
    const out = line[w];                                    // what went in one delay ago
    s = (1 - a) * out + a * s;                              // darker each pass
    line[w] = (i < feed.length ? feed[i] : 0) + feedback * s;
    w = (w + 1) % D;
    y[i] = s;
  }
  return edges(y, sr, 0, .08);
}

// Every part of one phrase (a plan.band event of the setlist, wander.js) and its echoes (plan.echoes of
// that phrase), baked from her decoded file `x` at `sr`: {dry, wet, throw}, each {at, channels} or null.
export function bakePhrase(e, echoes, x, sr) {
  const file = e.file, dry = canvas(sr), wet = canvas(sr), thrown = canvas(sr), g = dB(e.gain), amount = e.pixel ?? 0;
  const base = versionOf(x, sr, file, {amount});
  const say = (version, rate, extra = {}) => cut(version, sr, {from:e.from, to:e.to, rate, ...(e.wow ? {wow:e.wow} : {}), ...extra});
  // The phrase itself.
  // On a slowing tape her level sinks with it, from the slide to its end (to tape.fade), into the choir.
  const sink = y => { if (!e.tape) return y; const {head} = tapeWarp(e), h = Math.round(head * sr), f = e.tape.fade ?? 1; for (let i = h; i < y.length; i++) y[i] *= 1 + (f - 1) * (i - h) / Math.max(1, y.length - h); return y; };
  const main = e.tape ? sink(say(base, e.rate, {rateAt:tapeWarp(e).rateAt, maxLength:12})) : say(base, e.rate);
  dry.add(main, e.start, {gain:g, pan:e.pan ?? 0});
  for (const v of e.voices || []) {
    const version = versionOf(x, sr, file, {shift:v.shift ?? 0, amount:v.amount ?? amount}), rate = e.rate * 2 ** ((v.cents ?? 0) / 1200);
    let y = e.tape ? sink(say(version, rate, {rateAt:tapeWarp(e).rateAt, maxLength:12})) : say(version, rate);
    if (v.lp) y = darken(y, sr, v.lp);
    dry.add(y, e.start + (v.delay ?? 0), {gain:g * dB(v.gain ?? 0), pan:v.pan ?? 0});
  }
  // What follows it.
  const word = k => e.words[k < 0 ? e.words.length + k : k], src = w => w ? [Math.max(e.from, w.file[0]), Math.min(e.to, w.file[1])] : [e.from, e.to];
  const feeds = new Map();
  for (const h of echoes) {
    if (h.kind === 'fade') continue;
    const w = h.word === undefined || h.word === null ? null : word(h.word), [a, b] = h.src ?? src(w), gain = g * dB(h.gain ?? 0);
    let y = null;
    if (h.kind === 'delay' || h.kind === 'reverb') y = cut(versionOf(x, sr, file, {amount:h.amount ?? amount}), sr, {from:a, to:b, rate:h.rate ?? e.rate});
    else if (h.kind === 'fifth' || h.kind === 'step') y = cut(versionOf(x, sr, file, {shift:h.shift, amount:h.amount ?? amount}), sr, {from:a, to:b, rate:h.rate ?? e.rate});
    else if (h.kind === 'octave') y = cut(versionOf(x, sr, file, {amount:h.amount ?? amount}), sr, {from:a, to:b, rate:h.rate});
    else if (h.kind === 'freeze') y = darken(pixelsOf(freezeLoop(x, sr, file, {from:a, to:b, length:h.end - h.at}), sr, h.amount ?? amount), sr, h.lp ?? 6000);
    else if (h.kind === 'canon') y = cut(versionOf(x, sr, file, {notes:h.notes, amount:h.amount ?? amount}), sr, {from:a, to:b, rate:1, fadeOut:.03});
    if (!y) continue;
    if (h.lp && h.kind !== 'freeze') y = darken(y, sr, h.lp);
    if (h.kind === 'reverb') thrown.add(y, h.at, {gain, pan:h.pan ?? 0});
    else wet.add(y, h.at, {gain, pan:h.pan ?? 0});
    if (h.feeds) feeds.set(h.feeds, {y, h});
  }
  // The echo to fade: its line, fed by the echo that names it.
  for (const h of echoes.filter(x => x.kind === 'fade' && x.tap === 1)) {
    const f = feeds.get(h.line);
    if (!f) continue;
    const L = h.lineSpec, y = fadeLine(f.y, sr, {t0:f.h.at, delay:L.delay, feedback:L.feedback, from:L.from, to:L.to, f0:L.f0, f1:L.f1});
    // The line's own output (its first repeat is one delay after the feed), panned across, at the feed's level.
    wet.add(y, f.h.at, {gain:g * dB(f.h.gain ?? 0) * dB(L.gain ?? 0), pan:L.pan ?? 0});
  }
  return {dry:dry.done(), wet:wet.done(.05), throw:thrown.done()};
}
const pixelsOf = (y, sr, amount) => {
  if (!(amount > 0)) return y;
  const P = pixelParams(amount);
  return crush(decimate(y, sr, P.rate, {antialias:P.antialias}), P.bits, {block:P.block, sr});
};

// The largest sample-to-sample jump of a signal, in dB of its peak (the click check: a seam that
// clicks jumps by far more than the voice ever moves in one sample).
export function largestJump(y) {
  let peak = 0, jump = 0;
  for (let i = 0; i < y.length; i++) { peak = Math.max(peak, Math.abs(y[i])); if (i) jump = Math.max(jump, Math.abs(y[i] - y[i - 1])); }
  return peak ? 20 * Math.log10(jump / peak) : -Infinity;
}
export {lowpass, CHANT_SYLLABLES};
