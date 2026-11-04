// The song is fixed; the post is the variable. Every bar, chord, drum hit and
// sung syllable is decided here, before any audio exists, so playback and
// export perform the identical arrangement. Pure: no Web Audio.
import {tokens, syllables} from './lyrics.js';

export const BPM = 120;
export const STEP = 60 / BPM / 4;          // one 16th: 0.125 s
export const BAR_STEPS = 16;
export const SWING = .12;                  // ~56% house shuffle on the odd 16ths
export const BARS = 28;
export const KEY = 'A minor';

export const stepTime = step => step * STEP + (Math.round(step) % 2 ? SWING * STEP : 0);

// Am9 · Fmaj9 · Cmaj9 · G6/9. Voice-led so the top note never moves.
export const CHORDS = [
  {name:'Am9',   root:33, notes:[55, 59, 60, 64]},
  {name:'Fmaj9', root:29, notes:[55, 57, 60, 64]},
  {name:'Cmaj9', root:36, notes:[55, 59, 62, 64]},
  {name:'G6/9',  root:31, notes:[57, 59, 62, 64]},
];

// A minor pentatonic, A2 to E4: every note sits on every chord.
export const SCALE = [45, 48, 50, 52, 55, 57, 60, 62, 64];

export const SECTIONS = [
  {name:'Intro', from:0, to:4},
  {name:'Verse', from:4, to:12},
  {name:'Breakdown', from:12, to:16},
  {name:'Drop', from:16, to:24},
  {name:'Outro', from:24, to:28},
];

// Synergy hosts. These two lines frame the meeting; every other word is the post.
export const HOST = {open:'Thanks for joining', close:"Let's circle back"};

export const PATTERNS = {
  kick:[0, 4, 8, 12],
  clap:[4, 12],
  open:[2, 6, 10, 14],
  rim:[3, 10, 13],
  bass:[[2, 0, 2], [6, 0, 2], [9, 0, 1], [10, 12, 2], [14, 0, 2]],   // step, interval, length
  stabs:[[0, 3, 1], [6, 2, .8], [11, 2, .65]],                      // step, length, velocity
  guitar:[[1, .55], [3, .8], [6, .5], [9, .75], [11, .55], [14, .85]],
};
export const hatVelocity = step => step % 4 === 2 ? 0 : step % 4 === 0 ? .34 : step % 4 === 1 ? .2 : .27;
export const shakerVelocity = step => [.16, .26, .14, .34][step % 4];

export function sectionAt(bar) {
  return SECTIONS.find(s => bar >= s.from && bar < s.to) || SECTIONS[SECTIONS.length - 1];
}

// Which players are in the room, bar by bar.
export function layersAt(bar) {
  const s = sectionAt(bar).name;
  const all = {kick:true, clap:true, hats:true, open:true, shaker:true, rim:false, bass:true, stabs:true, pad:false, guitar:false};
  if (s === 'Intro') return {...all, clap:bar >= 2, open:bar >= 2, bass:bar >= 2};
  if (s === 'Verse') return {...all, rim:bar >= 8};
  if (s === 'Breakdown') return {kick:false, clap:bar === 15, hats:bar >= 14, open:false, shaker:bar >= 13, rim:false, bass:false, stabs:false, pad:true, guitar:false, roll:bar === 15, riser:bar >= 14};
  if (s === 'Drop') return {...all, rim:true, pad:true, guitar:true, crash:bar === 16 || bar === 20};
  return {...all, clap:bar < 27, open:bar < 26, shaker:bar < 26, bass:bar < 26, stabs:true, rim:false};
}

// Filter positions (Hz) at the start and end of each bar: the intro opens,
// the breakdown lifts, the outro closes.
export function cutoffAt(bar) {
  const s = sectionAt(bar).name, ramp = (a, b, i, n) => [a * (b / a) ** (i / n), a * (b / a) ** ((i + 1) / n)];
  if (s === 'Intro') return {keys:ramp(450, 3600, bar, 4), pad:[900, 900]};
  if (s === 'Breakdown') return {keys:[2600, 2600], pad:ramp(420, 4200, bar - 12, 4)};
  if (s === 'Outro') return {keys:ramp(3000, 420, bar - 24, 4), pad:[900, 900]};
  return {keys:[3000, 3000], pad:[1100, 1100]};
}

export function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

// Keyframed contours over the pentatonic index. Hooks get the chant and the
// call: repeated notes are what make a phrase come back to you.
const SHAPES = {
  chant:[[0, 6], [.62, 6], [.82, 5], [1, 3]],
  call:[[0, 8], [.3, 7], [.7, 5], [1, 5]],
  rise:[[0, 3], [.5, 5], [.85, 7], [1, 6]],
  arch:[[0, 5], [.45, 8], [1, 5]],
};
const RESOLVE = [3, 5, 6];

export function melody(count, shape, seed) {
  const keys = SHAPES[shape];
  let state = seed >>> 0;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = count === 1 ? 1 : i / (count - 1);
    const k = keys.findIndex(([at]) => at >= p);
    const [a, ai] = keys[Math.max(0, k - 1)], [b, bi] = keys[Math.max(0, k)];
    let index = Math.round(b === a ? bi : ai + (bi - ai) * (p - a) / (b - a));
    if (i > 0 && i < count - 1 && random() < .28) index += random() < .5 ? -1 : 1;
    if (out.length) index = Math.max(out[out.length - 1] - 3, Math.min(out[out.length - 1] + 3, index));
    out.push(Math.max(0, Math.min(SCALE.length - 1, index)));
  }
  if (out.length) out[out.length - 1] = RESOLVE.reduce((best, r) => Math.abs(r - out[out.length - 1]) < Math.abs(best - out[out.length - 1]) ? r : best, RESOLVE[0]);
  return out.map(i => SCALE[i]);
}

const MIN_STEPS = 2, MAX_RATE = 1.35;

// Fit a phrase into a window of 16ths. Words keep their natural length when
// they can; otherwise they speed up (the vocoder keeps the pitch) and, last,
// they are gated to their slot. Onsets prefer 8th notes.
export function fitPhrase(line, durations, window = 30) {
  const t = tokens(line);
  const natural = t.map(x => Math.max(.12, durations[x.word] ?? .45) / STEP);
  let rate = 1, alloc;
  for (; rate <= MAX_RATE + 1e-9; rate += .05) {
    alloc = natural.map(n => Math.max(MIN_STEPS, Math.round(n / rate)));
    if (alloc.reduce((a, b) => a + b, 0) <= window) break;
  }
  while (alloc.reduce((a, b) => a + b, 0) > window && alloc.some(a => a > MIN_STEPS)) {
    const i = alloc.indexOf(Math.max(...alloc)); alloc[i]--;
  }
  let slack = window - alloc.reduce((a, b) => a + b, 0), cursor = 0;
  // Spare steps go first to the words that were squeezed hardest.
  const squeezed = natural.map((n, i) => i).sort((a, b) => natural[b] / alloc[b] - natural[a] / alloc[a]);
  for (let pass = 0; pass < 3 && slack > 0; pass++) for (const i of squeezed) if (slack > 0 && alloc[i] < Math.ceil(natural[i])) { alloc[i]++; slack--; }
  return t.map((x, i) => {
    if (cursor % 2 && slack > 0) { cursor++; slack--; }
    const at = cursor, steps = alloc[i];
    cursor += steps;
    const seconds = steps * STEP;
    return {...x, at, steps, syllables:syllables(x.word),
      rate:Math.max(1, Math.min(MAX_RATE, (durations[x.word] ?? .45) / (seconds * .94))), gate:seconds};
  }).filter(w => w.at + w.steps <= window + MIN_STEPS);
}

// The setlist: which phrase sings in which two-bar slot.
export function slots(lyrics) {
  const {hook, verses} = lyrics;
  return [
    {bar:2, text:HOST.open, kind:'host', shape:'chant'},
    {bar:4, text:verses[0], kind:'verse', shape:'rise'},
    {bar:6, text:verses[1], kind:'verse', shape:'arch'},
    {bar:8, text:hook, kind:'hook', shape:'call'},
    {bar:10, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:12, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:16, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:18, text:verses[2], kind:'verse', shape:'rise', harmony:true},
    {bar:20, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:22, text:verses[3], kind:'verse', shape:'arch', harmony:true},
    {bar:24, text:hook, kind:'hook', shape:'call'},
    {bar:26, text:HOST.close, kind:'host', shape:'chant'},
  ];
}

// Place one setlist slot: fit its words into the window, give every syllable a
// note, and repeat a one-bar hook so it answers itself. Shared by every form.
export function placeSlot(slot, lyrics, durations, id) {
  const window = slot.window ?? 30, startStep = slot.startStep ?? 0;
  // A phrase that fits in one bar is sung twice: once is a line, twice is a hook.
  const once = fitPhrase(slot.text, durations, Math.min(14, window));
  const short = slot.kind === 'hook' && window >= 30 - startStep && once.length === tokens(slot.text).length && once.every(w => w.rate < 1.25)
    && once.at(-1).at + once.at(-1).steps <= BAR_STEPS - startStep;
  const fitted = short ? [...once, ...once.map(w => ({...w, at:w.at + BAR_STEPS, echo:true}))] : fitPhrase(slot.text, durations, window);
  // A repeated hook answers itself: same tune, but the second time it comes home.
  const half = short ? once : fitted;
  const count = w => Math.min(w.syllables, w.steps);
  const tune = melody(half.reduce((n, w) => n + count(w), 0), slot.shape, slot.kind === 'hook' ? hash(lyrics.hook) : hash(slot.text));
  const answer = short ? [...tune.slice(0, -1), tune.length > 1 && tune[tune.length - 1] !== 57 ? 57 : 52] : tune;
  const start = slot.bar * BAR_STEPS + startStep;
  let n = 0;
  const words = fitted.map((w, i) => {
    if (short && i === once.length) n = 0;
    const melodyNotes = w.echo ? answer : tune, total = count(w), base = Math.floor(w.steps / total);
    let extra = w.steps - base * total, offset = 0;
    const notes = Array.from({length:total}, () => {
      const steps = base + (extra-- > 0 ? 1 : 0), note = {at:start + w.at + offset, steps, midi:melodyNotes[n++]};
      offset += steps; return note;
    });
    return {display:w.display, word:w.word, line:id, at:start + w.at, steps:w.steps, rate:w.rate, gate:w.gate, notes, kind:slot.kind, harmony:!!slot.harmony, repeat:!!w.echo};
  });
  return {line:{id, text:slot.text, kind:slot.kind, bar:slot.bar, from:start, to:slot.bar * BAR_STEPS + 32, words}, words};
}

// Seconds from the song's first downbeat to every 16th, swing included.
export function timingTable(steps, swingOfBar = () => SWING) {
  const times = new Float64Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const bar = Math.floor(i / BAR_STEPS);
    times[i] = i * STEP + (i % 2 ? swingOfBar(bar) * STEP : 0);
  }
  return times;
}

export function arrange(lyrics, durations) {
  const lines = [], words = [];
  slots(lyrics).forEach((slot, id) => {
    const placed = placeSlot(slot, lyrics, durations, id);
    lines.push(placed.line); words.push(...placed.words);
  });
  // The drop is announced by Synergy stammering the hook's first word.
  const first = words.find(w => w.kind === 'hook');
  const stutters = first ? [0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15].map((s, i) => ({word:first.word, at:15 * BAR_STEPS + s, steps:1, midi:SCALE[Math.min(8, 3 + Math.floor(i / 2))]})) : [];
  const bars = Array.from({length:BARS}, (_, index) => ({index, section:sectionAt(index).name, chord:CHORDS[index % 4], layers:layersAt(index), cutoff:cutoffAt(index)}));
  const totalSteps = BARS * BAR_STEPS;
  return {form:'soundcheck', title:'Sound check 00', bpm:BPM, step:STEP, swing:SWING, key:KEY, sections:SECTIONS, bars, lines, words, stutters, lady:[],
    timing:timingTable(totalSteps + BAR_STEPS), finale:true, totalSteps, duration:stepTime(totalSteps) + 3.5};
}

export function voicedWords(lyrics) {
  return [...new Set(slots(lyrics).flatMap(s => tokens(s.text).map(t => t.word)))];
}
