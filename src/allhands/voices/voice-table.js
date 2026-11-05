// The pixel-voice bank, for the engine and for casting: every lexicon line
// Strategy and Synthia sing (lines.js), as dry takes in public/allhands/voices/
// (FLAC, 44.1 kHz mono, trimmed), measured by the lady's aligner and kept only
// if Whisper small.en heard them exactly at their pixel amount (README.md,
// "The bank"). Shaped like lady-table.js so the engine places these words the
// way it places her phrases. Runs in the page and in Node.
//
//   VOICE_TABLE[file]          a take: {file, id, voice, kind, text, duration, voiced, f0, gainDb, amount, words}
//   TAKE_TABLE[`${voice}/${id}`] a take or a cut (a drop's tag or impact): {key, id, voice, kind, file, text,
//                              start, end, onset, words, gainDb, f0, amount, cut}; the key is takes.js takeKey()
//   AVAILABLE                  the keys of TAKE_TABLE: what castSong's `available` option takes
//   voicesFor(id)              who can sing a line, in preference order (['synthia', 'strategy'], ['strategy'], [])
//   strategyOnly(id)           a line the lexicon gives Synthia that she does not sing ('long' or 'failed')
//   takeFor(id, voice?)        TAKE_TABLE's entry for the line in that voice (default: its first voice)
//   loadVoices(files, opts)    the takes' samples and pitch tracks: Map file -> {file, entry, samples, sampleRate, track}
//   sing(take, opts)           the pixel chain at play time: the take sung onto notes, pixelated
//   toBuffer(ctx, samples)     an AudioBuffer of a sung take
//
// The pixel chain never moves a sample in time, so every boundary here holds
// for a sung take: slice it with the entry's word times, as her phrases are cut.
import MANIFEST from './song-voices.json' with {type:'json'};
import {slice} from '../lady-table.js';
import {decodeFlac, pitchFromTag} from './flac.js';
import {analyse, pixelate, pitchTrack} from './pixel.js';
import {lineFor, notesFor} from './melody.js';
import {VOICES} from './items.js';

export {slice};
export const VOICE_BASE = '/' + MANIFEST.base;          // '/allhands/voices/' (public/allhands/voices/)
export const SAMPLE_RATE = MANIFEST.sampleRate;

const TARGET_RMS = -14;            // the lady table's speech level, so both banks share a gain scale
const REFERENCE_OFFSET_DB = -2.9;  // the same aligner, the same reference: as LADY_TABLE applies it

const gainOf = e => (e.gainDb ?? TARGET_RMS - (e.rmsDb ?? TARGET_RMS)) + REFERENCE_OFFSET_DB;
export function tableFrom(entries) {
  const table = {};
  for (const e of entries) {
    const words = e.words.map(w => Array.isArray(w) ? {text:w[0], start:w[1], end:w[2]} : w);
    table[e.file] = {file:e.file, id:e.id, text:e.text, voice:e.voice, kind:e.kind, ask:!!e.ask, ref:e.ref,
      duration:e.duration, samples:e.samples, voiced:e.voiced, f0:e.f0, gainDb:gainOf(e), amount:e.amount, words};
  }
  return table;
}
export const VOICE_TABLE = tableFrom(MANIFEST.entries || []);

function takeTable() {
  const out = {};
  for (const e of Object.values(VOICE_TABLE)) {
    out[`${e.voice}/${e.id}`] = {key:`${e.voice}/${e.id}`, id:e.id, voice:e.voice, kind:e.kind, file:e.file, text:e.text,
      start:e.words[0].start, end:e.words.at(-1).end, onset:e.words[0].onset, words:e.words, gainDb:e.gainDb, f0:e.f0, amount:e.amount, cut:null};
  }
  for (const c of MANIFEST.cuts || []) {
    const src = VOICE_TABLE[c.from];
    if (!src || !c.ready) continue;
    const words = src.words.slice(c.words[0], c.words[1] + 1);
    out[`${c.voice}/${c.id}`] = {key:`${c.voice}/${c.id}`, id:c.id, voice:c.voice, kind:c.kind, file:c.from, text:c.text,
      start:c.start, end:c.end, onset:c.onset, words, gainDb:src.gainDb, f0:src.f0, amount:src.amount, cut:{from:src.id, words:c.words}};
  }
  return out;
}
export const TAKE_TABLE = takeTable();
export const AVAILABLE = new Set(Object.keys(TAKE_TABLE));
export const LINE_VOICES = MANIFEST.lines || {};
export const voicesFor = id => LINE_VOICES[id]?.voices ?? [];
export const strategyOnly = id => LINE_VOICES[id]?.strategyOnly ?? false;
export const takeFor = (id, voice) => TAKE_TABLE[`${voice ?? voicesFor(id)[0]}/${id}`] ?? null;
// Files a set of cast parts needs: parts are TAKE_TABLE keys or {voice, id}.
export const voiceFiles = parts => [...new Set(parts.map(p => TAKE_TABLE[typeof p === 'string' ? p : `${p.voice}/${p.id}`]?.file).filter(Boolean))];

// ---------------------------------------------------------------- loading
// Decoded once per page (or process). `read(file)` returns the file's bytes:
// the default fetches `${base}${file}`; Node passes one that reads the disk
// (voices/node.js readVoice). FLAC is decoded here, in JS (flac.js), so the
// samples are the same in every browser and in Node, at 44.1 kHz whatever the
// AudioContext's rate.
const loaded = new Map();
export async function loadVoices(files, {base = VOICE_BASE, fetcher = globalThis.fetch, read} = {}) {
  const get = read || (async file => {
    const response = await fetcher(base + file);
    if (!response.ok) throw Error(`The voice take ${file} could not be loaded.`);
    return new Uint8Array(await response.arrayBuffer());
  });
  await Promise.all(files.filter(f => !loaded.has(f)).map(async file => {
    const entry = VOICE_TABLE[file];
    if (!entry) throw Error(`${file} is not in the voice bank.`);
    const flac = decodeFlac(await get(file));
    if (flac.sampleRate !== SAMPLE_RATE || flac.samples !== entry.samples) throw Error(`${file} does not match the manifest.`);
    const samples = flac.channels[0];
    loaded.set(file, {file, entry, samples, sampleRate:flac.sampleRate, track:pitchFromTag(flac.tags.PIXEL_PITCH) || pitchTrack(samples, SAMPLE_RATE)});
  }));
  return new Map(files.map(f => [f, loaded.get(f)]));
}

// ---------------------------------------------------------------- singing
// The take sung: onto `notes` ([{from, to, midi}], one per syllable nucleus,
// melody.js notesFor), or a `melody` (MIDI per syllable, reused cyclically), or
// a seeded wander through the voice's register in `key` and `scale` ending
// `end` ('home', 'open', 'up', 'free'; `from` starts next to a previous MIDI
// note). `amount` 0..1 is the pixel knob (pixel.js AMOUNTS); the default is the
// amount Whisper verified the take at (entry.amount), and higher is unverified.
// `vibrato` {cents, hz, after} blooms on held notes. Returns {samples (same
// length and word times as the take), notes, sampleRate, gainDb}. Pure and
// deterministic: the same take and options give the same samples.
export function sing(take, {notes, melody, key = 'D', scale = 'majorPenta', amount, seed, end, from, register, vibrato} = {}) {
  const entry = take.entry;
  const line = notes ?? (melody ? notesFor(entry, melody)
    : lineFor(entry, {register:register ?? VOICES[entry.voice].register, tonic:key, scale, seed, from, end:end ?? (entry.ask ? 'up' : 'home')}));
  const analysis = take.analysis ??= analyse(take.samples, take.sampleRate, {track:take.track});
  const out = pixelate(take.samples, take.sampleRate, {notes:line, amount:amount ?? entry.amount ?? VOICES[entry.voice].amount, analysis, vibrato});
  return {samples:out.samples, notes:line, sampleRate:take.sampleRate, gainDb:entry.gainDb};
}

// A sung take (or a slice of it, [start, end] seconds, with 3 ms edges) as an AudioBuffer.
export function toBuffer(ctx, samples, sampleRate = SAMPLE_RATE, [start, end] = []) {
  let x = samples;
  if (start !== undefined) {
    const a = Math.max(0, Math.round(start * sampleRate)), b = Math.min(samples.length, Math.round(end * sampleRate)), f = Math.round(.003 * sampleRate);
    x = samples.slice(a, b);
    for (let i = 0; i < f && i < x.length; i++) { const g = i / f; x[i] *= g; x[x.length - 1 - i] *= g; }
  }
  const b = ctx.createBuffer(1, x.length, sampleRate);
  b.getChannelData(0).set(x);
  return b;
}
