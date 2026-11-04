// Word boundaries inside the lady's recordings (public/phrases/NN.wav), in
// seconds from the start of each file. lady-phrases.json is measured by
// scripts/align-lady-phrases.py: HMM forced alignment, cross-checked by two CTC
// models, snapped to the audio, every word re-heard by Whisper. The hand
// measurements below remain only as a fallback for a file it lacks.
import MEASURED from './lady-phrases.json' with {type:'json'};

const FALLBACK = [
  {file:'50.wav', text:"Let's build.", f0:189, rmsDb:-13.1, words:[["Let's", .015, .2], ['build.', .225, .745]]},
  {file:'06.wav', text:"Let's circle back", f0:244.9, rmsDb:-12.8, words:[["Let's", .015, .2], ['circle', .245, .7], ['back', .715, .95]]},
  {file:'08.wav', text:'Pivot', f0:218.2, rmsDb:-14.4, words:[['Pivot', .015, .445]]},
  {file:'07.wav', text:'Leverage', f0:196.7, rmsDb:-13.3, words:[['Leverage', .015, .64]]},
  {file:'15.wav', text:'Let that sink in', f0:195.1, rmsDb:-13.7, words:[['Let', .015, .27], ['that', .385, .865], ['sink', .87, 1.615], ['in', 1.67, 2.175]]},
  {file:'18.wav', text:'Read that again.', f0:216.2, rmsDb:-11.1, words:[['Read', .015, .3], ['that', .3, .55], ['again.', .55, .99]]},
  {file:'16.wav', text:'Full stop.', f0:315.8, rmsDb:-13.3, words:[['Full', .015, .32], ['stop.', .32, .79]]},
  {file:'05.wav', text:'Synergy', f0:200, rmsDb:-13.3, words:[['Synergy', .02, .695]]},
];

const TARGET_RMS = -14;   // speech RMS every phrase is normalised to, dBFS

export function tableFrom(entries) {
  const table = {};
  for (const e of entries) {
    const words = e.words.map(w => Array.isArray(w) ? {text:w[0], start:w[1], end:w[2]} : w);
    table[e.file] = {file:e.file, text:e.text, f0:e.f0, gainDb:e.gainDb ?? TARGET_RMS - (e.rmsDb ?? TARGET_RMS), words};
  }
  return table;
}

// The aligner references RMS to a full-scale square wave; the mix was
// calibrated against the hand table's sine-referenced levels, 2.9 dB lower on
// average. Keep its per-phrase normalisation, remove the constant offset.
const REFERENCE_OFFSET_DB = -2.9;
export const LADY_TABLE = {...tableFrom(FALLBACK), ...tableFrom(MEASURED.map(e => ({...e, gainDb:e.gainDb + REFERENCE_OFFSET_DB})))};

// [start, end] in the file from word `from` through word `to` (negative counts
// from the end), optionally cut to `max` seconds from the start.
export function slice(entry, from, to, max) {
  if (!entry) return [0, 0];
  const words = entry.words, a = words[from < 0 ? words.length + from : from], b = words[to < 0 ? words.length + to : to];
  const start = a.start, end = max ? Math.min(b.end, start + max) : b.end;
  return [start, end];
}

export const ladyFiles = events => [...new Set(events.map(e => e.file))];
