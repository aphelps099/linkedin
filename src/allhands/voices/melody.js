// Where the pixel voices sing: a key, a register, and a melodic line that
// wanders one syllable at a time. Seeded, so a line is the same every render.
import {midiHz} from './pixel.js';

export const SCALES = {
  majorPenta:[0, 2, 4, 7, 9],          // Offsite, the haze songs (D: D E F# A B)
  minorPenta:[0, 3, 5, 7, 10],         // Circle Back, Hustle (A: A C D E G)
};
const PC = {C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11};

// Scale notes (MIDI) of `tonic` + `scale` from lo to hi inclusive.
export function scaleNotes(tonic, scale, lo, hi) {
  const t = typeof tonic === 'number' ? tonic % 12 : PC[tonic], steps = SCALES[scale] || scale, out = [];
  for (let m = lo; m <= hi; m++) if (steps.includes((m - t + 120) % 12)) out.push(m);
  return out;
}

// Small seeded PRNG (mulberry32) and a string hash for seeds.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// A wandering line of `n` notes in `notes` (sorted MIDI). Mostly steps, a few
// leaps of a third, the odd repeat; pulled back toward `center` when it strays.
// end: 'home' lands on the tonic or fifth, 'open' on the 2nd or 6th, 'up' rises
// (a question asks), 'free' anything. `from` starts next to a previous note.
export function wander(n, {notes, center, tonic, seed = 1, end = 'home', from = null} = {}) {
  if (!n) return [];
  const R = rng(seed), near = m => notes.reduce((b, x, i) => Math.abs(x - m) < Math.abs(notes[b] - m) ? i : b, 0);
  const c = near(center), t = (typeof tonic === 'number' ? tonic : PC[tonic]) % 12;
  let i = from == null ? c + [0, 0, 1, -1][Math.floor(R() * 4)] : near(from) + (R() < .5 ? 1 : -1);
  i = Math.max(0, Math.min(notes.length - 1, i));
  const out = [notes[i]];
  for (let k = 1; k < n; k++) {
    const r = R();
    let d = r < .12 ? 0 : r < .74 ? 1 : r < .95 ? 2 : 3;
    let dir = R() < .5 ? -1 : 1;
    if (i - c > 2) dir = -1; else if (c - i > 2) dir = 1;
    if (d === 0 && out.length > 1 && out.at(-1) === out.at(-2)) d = 1;
    if (i + dir * d < 0 || i + dir * d > notes.length - 1) dir = -dir;     // reflect off the register's edges
    i = Math.max(0, Math.min(notes.length - 1, i + dir * d));
    out.push(notes[i]);
  }
  const last = out.at(-1), prev = out.at(-2) ?? last;
  const pick = ok => {
    const cands = notes.filter(m => ok((m - t + 120) % 12)).sort((a, b) => Math.abs(a - last) - Math.abs(b - last) || a - b);
    return cands[0] ?? last;
  };
  if (end === 'home') out[n - 1] = pick(pc => pc === 0 || pc === 7);
  else if (end === 'open') out[n - 1] = pick(pc => pc === 2 || pc === 9);
  else if (end === 'up') {
    const higher = notes.filter(m => m > prev).slice(0, 2);
    out[n - 1] = higher.length ? higher[Math.floor(R() * higher.length)] : last;
  }
  return out;
}

// Syllable nuclei of a manifest entry, in order: [{from, to, word}].
export function syllablesOf(entry) {
  const out = [];
  entry.words.forEach((w, wi) => {
    const syl = w.syllables?.length ? w.syllables : [[w.onset ?? w.start, w.end]];
    for (const [from, to] of syl) out.push({from, to, word:wi});
  });
  return out;
}

// Notes for a take: one per syllable nucleus, from a melody (MIDI array, reused
// cyclically if short) or a wander. Returns [{from, to, midi, word}].
export function notesFor(entry, melody) {
  const syl = syllablesOf(entry);
  return syl.map((s, i) => ({...s, midi:melody[i % melody.length]}));
}

export function lineFor(entry, {register, tonic = 'D', scale = 'majorPenta', seed, end, from} = {}) {
  const syl = syllablesOf(entry);
  const notes = scaleNotes(tonic, scale, register.lo, register.hi);
  const melody = wander(syl.length, {notes, center:register.center, tonic, seed:seed ?? hash(entry.file), end:end ?? 'home', from});
  const line = notesFor(entry, melody);
  // A one-syllable take ("Delve.", "Proud.", "Thoughts?") slurs two notes on its
  // vowel, as speech does: a statement falls a scale step onto the note, a
  // question rises a step onto it. Held flat on one note, Whisper heard
  // Strategy's "Delve." as "Dove." and "No.".
  if (line.length === 1) {
    const [n] = line, i = notes.indexOf(n.midi), mid = n.from + (n.to - n.from) * .45;
    const other = notes[Math.max(0, Math.min(notes.length - 1, i + ((end ?? 'home') === 'up' ? -1 : 1)))];
    if (other !== undefined && other !== n.midi) return [{...n, to:mid, midi:other}, {...n, from:mid, midi:n.midi}];
  }
  return line;
}

export const noteName = m => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export {midiHz};
