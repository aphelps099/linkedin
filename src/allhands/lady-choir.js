// The lady's choir: her own voice, cut into syllables, stretched and stacked
// into a low bed of singers (songbook/delve.js, "Delve."). Panda Bear's
// approach (one voice layered into a choir), never his songs.
//
// Pure functions on Float32Array (no Web Audio), deterministic: the same input
// and options give the same samples in Node and in every browser.
//
//   psola(x, sr, analysis, {length, map, pitch, formant, gain})
//       TD-PSOLA with a time map and a formant shift. map(tOut) gives the input
//       time (seconds) each output pitch mark reads from, so a vowel can be held
//       (stretched by grain repetition) while its consonants keep their speed;
//       pitch(tOut) gives the note in Hz (null: her own pitch); `formant`
//       (semitones) resamples every grain, so the voice's resonances move down
//       (a darker, larger singer) while the note stays put. Unvoiced grains are
//       never retuned.
//   analysisOf(x, sr, file)
//       her pitch marks from the measured pitch track (lady-pitch.json, the same
//       frames pitchOf reads), so the choir and her tuning agree.
//   CHANT_SYLLABLES
//       the five syllables of "Momentum compounds." (57.wav), cut at the energy
//       dips measured on the recording (scripts: the 10 ms frames of
//       lady-pitch.json, cross-checked against the WAV's RMS): consonant onset,
//       vowel nucleus, coda.
//   chantSinger(x, sr, analysis, {notes, step, length, ...})
//       one singer of the chant: each syllable on its note, its consonants at
//       speed, its vowel stretched to fill the note, a vibrato that blooms in,
//       the shared tape wow, light pixels.
//   heldVowel(x, sr, analysis, {from, to, midi, length, ...})
//       a held "ah" from one of her vowels (the Pool: "calling"'s first vowel).
import PITCH from './lady-pitch.json' with {type:'json'};
import {pitchMarks, decimate, crush, pixelParams, lowpass, highpass} from './voices/pixel.js';

const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const lcg = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };

// Her measured pitch track as pixel.js reads one: frame k centred on t0 + k * hop, f0 in Hz (0 unvoiced).
export function trackOf(file) {
  const p = PITCH[file];
  if (!p) return null;
  return {hop:p.hop, offset:p.t0, f0:Float32Array.from(p.m, m => (m ? midiHz(m / 10) : 0))};
}
const ANALYSES = new WeakMap();
export function analysisOf(x, sr, file) {
  let byFile = ANALYSES.get(x);
  if (!byFile) ANALYSES.set(x, byFile = new Map());
  if (!byFile.has(file)) {
    const track = trackOf(file);
    byFile.set(file, track ? {track, marks:pitchMarks(x, sr, track)} : {track:null, marks:[]});
  }
  return byFile.get(file);
}

// Her own pitch (Hz) at input time t, from the analysis's track (0 unvoiced).
export const pitchAt = (an, t) => {
  const {hop, f0} = an.track, off = an.track.offset ?? 0;
  return f0[Math.min(f0.length - 1, Math.max(0, Math.round((t - off) / hop)))] || 0;
};

// Linear read with bounds (0 outside).
const read = (x, p) => { const i = Math.floor(p), f = p - i; if (i < 0 || i + 1 >= x.length) return 0; return x[i] + (x[i + 1] - x[i]) * f; };

export function psola(x, sr, an, {length, map = t => t, pitch = null, formant = 0, gain = 1} = {}) {
  const N = Math.max(1, Math.round(length * sr)), y = new Float32Array(N), marks = an.marks;
  if (!marks.length) return y;
  const pos = marks.map(m => m.pos), beta = 2 ** (formant / 12);
  const nearest = p => {
    let lo = 0, hi = pos.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pos[mid] <= p) lo = mid; else hi = mid; }
    return Math.abs(pos[lo] - p) <= Math.abs(pos[hi] - p) ? lo : hi;
  };
  let ts = 0;
  while (ts < N) {
    const tIn = map(ts / sr), k = nearest(tIn * sr), m = marks[k], Pa = m.period;
    let Po = Pa, g = gain;
    if (m.voiced) {
      const f = pitch ? pitch(ts / sr) : pitchAt(an, tIn) || sr / Pa;
      Po = Math.max(sr / 900, Math.min(sr / 40, sr / f));
    }
    // A grain is two of its periods, resampled by beta (formants move by 1/beta... down when beta < 1).
    const L = Math.max(2, Math.round(Pa)), Lo = Math.max(2, Math.round(L / beta)), c = m.pos, at = Math.round(ts);
    if (m.voiced) g *= Math.sqrt(Po / Lo);
    for (let j = -Lo; j <= Lo; j++) {
      const dst = at + j;
      if (dst < 0 || dst >= N) continue;
      const w = .5 + .5 * Math.cos(Math.PI * j / Lo);
      y[dst] += g * w * read(x, c + j * beta);
    }
    ts += Po;
  }
  return y;
}

// The five syllables of "Momentum compounds." (57.wav, seconds of the file):
// [onset, vowel from, vowel to, end]. Measured on her 10 ms frames: the dips at
// 0.206 (the m of "men"), 0.34-0.40 (the t closure), 0.546 (the word break),
// 0.80-0.84 (the p closure); "pounds" keeps its unvoiced "nds" to 1.29.
export const CHANT_FILE = '57.wav';
export const CHANT_SYLLABLES = Object.freeze([
  {text:'mo', vowel:'o', cut:[.015, .040, .195, .205]},
  {text:'men', vowel:'e', cut:[.205, .248, .325, .342]},
  {text:'tum', vowel:'u', cut:[.345, .406, .515, .546]},
  {text:'com', vowel:'o', cut:[.552, .606, .780, .806]},
  {text:'pounds', vowel:'ou', cut:[.806, .846, 1.016, 1.29]},
]);
// "calling"'s first vowel (33.wav): the Pool's held "ah", where her pitch sits still (1.79-1.91 s).
export const AH = Object.freeze({file:'33.wav', from:1.795, to:1.905, vowel:'ah'});

// A time map for one note: the onset consonant at speed, the vowel stretched to
// fill the note (the read position wanders inside the nucleus, so no grain
// repeats in a loop and the held vowel never buzzes), the coda at speed.
function syllableMap(cut, noteLength, R, {codaRoom = .04} = {}) {
  const [a, v0, v1, b] = cut, onset = v0 - a, coda = b - v1, hold = Math.max(.02, noteLength - onset - coda - codaRoom), span = v1 - v0;
  // A slow, seeded wander across the middle of the nucleus (its edges glide in and out).
  const lo = v0 + span * .15, hi = v1 - span * .15, pts = [], P = 24;
  for (let i = 0; i <= P; i++) pts.push(lo + (hi - lo) * (.5 + .5 * Math.sin(i * 1.7 + R() * 6.28) * (.6 + .4 * R())));
  return t => {
    if (t < onset) return a + t;
    if (t < onset + hold) {
      const u = (t - onset) / hold;
      // into the wander over the first 12% (from v0), out of it over the last 12% (to v1)
      const k = u * P, i = Math.min(P - 1, Math.floor(k)), w = pts[i] + (pts[i + 1] - pts[i]) * (k - i);
      if (u < .12) return v0 + (w - v0) * (u / .12);
      if (u > .88) return w + (v1 - w) * ((u - .88) / .12);
      return w;
    }
    return v1 + Math.min(coda, t - onset - hold);
  };
}

// Light pixels on a choir voice: the sample-and-hold and the shared-exponent crush.
export function pixels(y, sr, amount) {
  if (!(amount > 0)) return y;
  const P = pixelParams(amount);
  return crush(decimate(y, sr, P.rate, {antialias:P.antialias}), P.bits, {block:P.block, sr});
}

// A slow tape wow as a pitch factor at time t (shared by every singer of a bake).
export const wowAt = (t, {cents = 6, hz = .47} = {}) => 2 ** (cents * Math.sin(2 * Math.PI * hz * t) / 1200);

// One singer of the chant: notes [{at, len, syllable, midi}] (seconds, the syllable an index of
// CHANT_SYLLABLES), into a buffer `length` seconds long that loops seamlessly (a note past the end wraps).
// detune cents, onset seconds late, formant semitones, vibrato {from, to} cents at 5.2 Hz blooming over a note.
export function chantSinger(x, sr, an, {notes, length, detune = 0, onset = 0, formant = 0, vibrato = {from:10, to:20}, wow = {cents:6, hz:.47}, amount = .25, seed = 1, gain = 1} = {}) {
  const N = Math.round(length * sr), y = new Float32Array(N), R = lcg(seed * 2654435761 + 17);
  for (const n of notes) {
    const S = CHANT_SYLLABLES[n.syllable], map = syllableMap(S.cut, n.len, R);
    const t0 = n.at + onset, f = midiHz(n.midi) * 2 ** (detune / 1200), vib = t => ((vibrato.from + (vibrato.to - vibrato.from) * Math.min(1, t / Math.max(.2, n.len))) / 100) * Math.min(1, t / .25);
    const g = psola(x, sr, an, {length:n.len + .05, map, formant, gain,
      pitch:t => f * wowAt(t0 + t, wow) * 2 ** (vib(t) * Math.sin(2 * Math.PI * 5.2 * t + seed) / 12)});
    // a soft edge on each note, then into the loop
    const A = Math.round(.006 * sr), Rl = Math.round(.03 * sr), a = Math.round(t0 * sr);
    for (let i = 0; i < g.length; i++) {
      const env = Math.min(1, i / A, (g.length - i) / Rl);
      y[((a + i) % N + N) % N] += g[i] * env;
    }
  }
  return pixels(y, sr, amount);
}

// A held vowel on a note for `length` seconds (the read position wanders inside it), with a slow
// swell in and out, the vibrato and the shared wow: one singer of the Pool's "ah".
export function heldVowel(x, sr, an, {from, to, midi, length, detune = 0, formant = 0, wow = {cents:6, hz:.47}, amount = .25, seed = 1, gain = 1, attack = .35, release = .5} = {}) {
  const R = lcg(seed * 2246822519 + 3), span = to - from, P = Math.max(8, Math.round(length * 3)), pts = [];
  for (let i = 0; i <= P; i++) pts.push(from + span * (.2 + .6 * R()));
  const map = t => { const k = Math.min(P - 1e-9, t / length * P), i = Math.floor(k); return pts[i] + (pts[i + 1] - pts[i]) * (k - i); };
  const f = midiHz(midi) * 2 ** (detune / 1200);
  const y = psola(x, sr, an, {length, map, formant, gain, pitch:t => f * wowAt(t, wow) * 2 ** (.16 * Math.min(1, t / 1.2) * Math.sin(2 * Math.PI * 4.9 * t + seed) / 12)});
  const A = Math.round(attack * sr), Rl = Math.round(release * sr);
  for (let i = 0; i < y.length; i++) y[i] *= Math.min(1, i / A, (y.length - i) / Rl);
  return pixels(y, sr, amount);
}

// The choir's colour: a gentle high-pass under 110 Hz (the octave-down singer's buzz lives in its
// lowest partials) and a low-pass, so the stack sits as a bed under her clear voice.
export const choirTone = (y, sr, {hp = 110, lp = 5200} = {}) => lowpass(highpass(y, sr, hp), sr, lp);
