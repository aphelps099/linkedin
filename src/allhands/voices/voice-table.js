// Word boundaries inside the pixel-voice takes (Strategy and Synthia), shaped
// like lady-table.js so the engine can place these words the way it places her
// phrases. song-voices.json is measured by src/allhands/voices/measure.py with
// the lady's own aligner (HMM forced alignment, two CTC cross-checks, 1 ms
// snapping, Whisper re-hearing each word); song-voices-pitch.json is the JS
// pitch track (pixel.js pitchTrack) of every take, so a page need not run YIN.
//
// A take is the dry voice. The pixel chain (pixel.js) turns it into a sung,
// pixelated line at song prepare time, onto notes in the song's key; it never
// moves a sample in time, so these boundaries hold for the processed take.
import MANIFEST from './song-voices.json' with {type:'json'};
import PITCH from './song-voices-pitch.json' with {type:'json'};
import {slice} from '../lady-table.js';
import {analyse, pixelate} from './pixel.js';
import {lineFor, notesFor} from './melody.js';
import {VOICES} from './items.js';

export {slice};
export const SONG_VOICES_BASE = '/' + MANIFEST.base;          // where the build phase publishes the WAVs
export const SAMPLE_RATE = MANIFEST.sampleRate;

const TARGET_RMS = -14;            // the lady table's speech level, so both banks share a gain scale
const REFERENCE_OFFSET_DB = -2.9;  // the same aligner, the same reference: as LADY_TABLE applies it

// Entries keyed by file ("strategy/delve.wav"), like LADY_TABLE: {file, text,
// voice, kind, item, f0, gainDb, words:[{text, start, end, onset, syllables, f0}]}.
export function tableFrom(entries) {
  const table = {};
  for (const e of entries) {
    const words = e.words.map(w => Array.isArray(w) ? {text:w[0], start:w[1], end:w[2]} : w);
    table[e.file] = {file:e.file, id:e.id, text:e.text, voice:e.voice, kind:e.kind, item:e.item, ask:!!e.ask,
      duration:e.duration, voiced:e.voiced, f0:e.f0, gainDb:(e.gainDb ?? TARGET_RMS - (e.rmsDb ?? TARGET_RMS)) + REFERENCE_OFFSET_DB, words};
  }
  return table;
}
export const VOICE_TABLE = tableFrom(MANIFEST.entries);

// Lookups: a take by voice and item, every take of a voice, a couplet's call and response.
export const takeOf = (voice, item, kind) => Object.values(VOICE_TABLE).find(e => e.voice === voice && e.item === item && (!kind || e.kind === kind)) || null;
export const takesOf = voice => Object.values(VOICE_TABLE).filter(e => e.voice === voice);
export const coupletOf = item => ({call:takeOf('strategy', item, 'call'), response:takeOf('synthia', item, 'response')});
export const voiceFiles = events => [...new Set(events.map(e => e.file))];

// The stored pitch track of a take, as pitchTrack() returns it.
export function trackOf(file) {
  const p = PITCH[file];
  return p ? {hop:p.hop, offset:p.offset, f0:Float32Array.from(p.f0, v => v / 10), rms:null} : null;
}

// Sing a take: samples (Float32Array at SAMPLE_RATE) onto `notes` ([{from, to,
// midi}], one per syllable, see melody.js) or a `melody` (MIDI per syllable),
// or a wander in the voice's register in `key`; `amount` 0..1 (pixel.js AMOUNTS).
// Returns the processed mono take, same length, same word times.
export function sing(samples, entry, {notes, melody, key = 'D', scale = 'majorPenta', amount = .6, seed, end} = {}) {
  const line = notes ?? (melody ? notesFor(entry, melody) : lineFor(entry, {register:VOICES[entry.voice].register, tonic:key, scale, seed, end:end ?? (entry.ask ? 'up' : 'home')}));
  const track = trackOf(entry.file);
  const analysis = analyse(samples, SAMPLE_RATE, track ? {track} : undefined);
  return {samples:pixelate(samples, SAMPLE_RATE, {notes:line, amount, analysis}).samples, notes:line};
}
