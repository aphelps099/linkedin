// Day One's one line: "Congrats on the new role!", in the band's two local
// voices (Strategy: Kokoro am_onyx; Synthia: Flite slt), rendered and heard by
// scripts/render-day-one-voices.mjs into public/films/day-one/voices/ with its
// manifest, voices.json. The shared bank (src/allhands/voices/) is untouched:
// this file reads the same kind of take (FLAC 44.1 kHz mono, the pitch track
// in PIXEL_PITCH) and sings it with the bank's own chain (pixel.js), so a take
// is a voice-table take in every way but its manifest.
//
//   notes for a take            spoken(entry, track)   S1: its own contour, each nucleus snapped to the key (light, .3)
//                               intoned(entry, midi)   a choir copy: every nucleus on one note, "role" one step down
//   the grid point              grats(entry)           the vowel onset of "grats" (the aligner's second nucleus)
//   loading                     loadTakes(manifest, {read})   Map id -> {file, entry, samples, sampleRate, track}
//
// Pure: no Web Audio, the same samples in Node and in the page.
import {decodeFlac, pitchFromTag} from '../../allhands/voices/flac.js';
import {pitchTrack, naturalPitch, hzMidi, analyse, pixelate} from '../../allhands/voices/pixel.js';
import {syllablesOf, scaleNotes} from '../../allhands/voices/melody.js';

export const TEXT = 'Congrats on the new role!';
export const MINOR_PENTA = [0, 3, 5, 7, 10];
export const TONIC = 11;                                  // B minor pentatonic: B D E F# A
export const keyNotes = (lo, hi) => scaleNotes(TONIC, MINOR_PENTA, lo, hi);
// Where the choir copies sit (spec 5): Strategy B2 to F#3, Synthia B3 to A4.
export const RANGES = Object.freeze({strategy:[47, 54], synthia:[59, 69]});
// The takes (spec 5): S1 is the motif.
export const TAKES = Object.freeze([
  {id:'s1', voice:'strategy', speed:.95, motif:true},
  {id:'s2', voice:'strategy', speed:.90},
  {id:'s3', voice:'strategy', speed:1.00},
  {id:'y1', voice:'synthia', pitch:1.04},
  {id:'y2', voice:'synthia', pitch:1.00},
  {id:'y3', voice:'synthia', pitch:1.10},
]);
// The pixel amounts: S1 spoken with a light correction; the choir at the amount Whisper passed it at.
export const SPOKEN_AMOUNT = .3;

// The vowel onset of "grats": the aligner's second nucleus of "Congrats" (K AH N G R AE T S).
export function grats(entry) {
  const w = entry.words[0], syl = w.syllables || [];
  return syl.length > 1 ? syl[1][0] : (w.onset ?? w.start);
}

// One pentatonic step down from `midi` (in the key).
export function stepDown(midi, steps = 1) {
  const notes = keyNotes(midi - 12 * Math.ceil(steps / 5) - 12, midi);
  const i = notes.indexOf(midi);
  return i < 0 ? midi : notes[Math.max(0, i - steps)];
}

// A choir copy: every syllable nucleus on `midi`, the last ("role") falling one step.
export function intoned(entry, midi) {
  const syl = syllablesOf(entry), down = stepDown(midi);
  return syl.map((s, i) => ({from:s.from, to:s.to, midi:i === syl.length - 1 ? down : midi, word:s.word}));
}

// S1: spoken, corrected lightly along its own contour: each nucleus on the key note nearest
// the speaker's own median there (an unvoiced nucleus borrows its neighbour's).
export function spoken(entry, track) {
  const syl = syllablesOf(entry), nat = naturalPitch(track), notes = keyNotes(24, 96);
  const own = syl.map(s => { const f = nat.median(s.from, s.to); return f > 0 ? hzMidi(f) : null; });
  for (let i = 0; i < own.length; i++) if (own[i] === null) own[i] = own.slice(i).find(v => v !== null) ?? own.slice(0, i).reverse().find(v => v !== null) ?? 45;
  const snap = m => notes.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), notes[0]);
  return syl.map((s, i) => ({from:s.from, to:s.to, midi:snap(own[i]), word:s.word}));
}

// A take sung: the bank's chain (pixel.js pixelate) with its stored pitch track.
export function singTake(take, notes, amount) {
  const analysis = take.analysis ??= analyse(take.samples, take.sampleRate, {track:take.track});
  return pixelate(take.samples, take.sampleRate, {notes, amount, analysis}).samples;
}

// A take from 44.1 to 48 kHz (the film's rate) in JS, so the AudioContext never resamples it and a
// buffer started on a whole sample plays the same samples wherever it starts (the final S1 nulls
// against Voice 1). Polyphase windowed sinc (Kaiser, beta 8, 32 zero crossings a side, cut at 0.92
// of the lower Nyquist): exact phases from the reduced ratio, pure and deterministic.
const BESSEL0 = x => { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t; } return s; };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function resample(x, from, to) {
  if (from === to) return Float32Array.from(x);
  const g = gcd(from, to), up = to / g, down = from / g, Z = 32, beta = 8, cut = .92 * Math.min(1, to / from), norm = BESSEL0(beta);
  const taps = 2 * Z, table = new Array(up);
  for (let p = 0; p < up; p++) {
    const frac = (p * down % up) / up, row = new Float64Array(taps);
    for (let j = 0; j < taps; j++) {
      const u = j - (Z - 1) - frac, w = Math.abs(u) >= Z ? 0 : BESSEL0(beta * Math.sqrt(1 - (u / Z) ** 2)) / norm;
      row[j] = cut * (u === 0 ? 1 : Math.sin(Math.PI * cut * u) / (Math.PI * cut * u)) * w;
    }
    table[p] = row;
  }
  const n = Math.round(x.length * up / down), y = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const i0 = Math.floor(k * down / up), row = table[k % up];
    let s = 0;
    for (let j = 0; j < taps; j++) { const i = i0 + j - (Z - 1); if (i >= 0 && i < x.length) s += x[i] * row[j]; }
    y[k] = s;
  }
  return y;
}

// The takes' samples, decoded in JS (flac.js) as the bank's are. read(file) returns the bytes;
// the default fetches `/${manifest.base}${file}`.
export async function loadTakes(manifest, {read, fetcher = globalThis.fetch} = {}) {
  const get = read || (async file => {
    const r = await fetcher(`/${manifest.base}${file}`);
    if (!r.ok) throw Error(`The Day One take ${file} could not be loaded.`);
    return new Uint8Array(await r.arrayBuffer());
  });
  const out = new Map();
  await Promise.all(manifest.takes.map(async entry => {
    const flac = decodeFlac(await get(entry.file));
    if (flac.sampleRate !== manifest.sampleRate || flac.samples !== entry.samples) throw Error(`${entry.file} does not match voices.json.`);
    const samples = flac.channels[0];
    out.set(entry.id, {file:entry.file, entry, samples, sampleRate:flac.sampleRate, track:pitchFromTag(flac.tags.PIXEL_PITCH) || pitchTrack(samples, flac.sampleRate)});
  }));
  return new Map(manifest.takes.map(e => [e.id, out.get(e.id)]));
}
