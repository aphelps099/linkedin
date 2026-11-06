// Which treatment cuts which track. A treatment is a pure function (plan, shots, {format, features?,
// seed?}) -> EDL, built on the plan's own landmarks so it cuts any track of the song book; this table
// picks the one a track's film is cut with, on /videostudio/ and in the export alike.
//
//   const t = treatmentFor('offsite');       // {id:'offsite-psych', fn, labels, title}
//   const edl = t.fn(plan, SHOTS, {format:'9:16'});
//
// To add one: write treatments/<id>.js exporting the function and its SCENE_LABELS, register it in
// TREATMENTS, and name the tracks it cuts in BY_TRACK (every other track keeps DEFAULT). A recorded track
// (RECORDED) is cut by its own treatment only: printer-mouth is built for Printer Song's plan.
import {drop60Draft, SCENE_LABELS as DROP60_LABELS} from './drop60-draft.js';
import {offsitePsych, SCENE_LABELS as OFFSITE_LABELS} from './offsite-psych.js';
import {printerMouth, SCENE_LABELS as PRINTER_LABELS} from './printer-mouth.js';
import {PRINTER_SONG, printerPlan} from './printer-song.js';

export const TREATMENTS = {
  'drop60-draft':{id:'drop60-draft', title:'Drop Edition 60', fn:drop60Draft, labels:DROP60_LABELS},
  'offsite-psych':{id:'offsite-psych', title:'Offsite, psychedelic', fn:offsitePsych, labels:OFFSITE_LABELS},
  'printer-mouth':{id:'printer-mouth', title:'Printer Song, the mouth', fn:printerMouth, labels:PRINTER_LABELS},
};
export const DEFAULT = 'drop60-draft';
export const BY_TRACK = Object.freeze({offsite:'offsite-psych', 'printer-song':'printer-mouth'});
// Recorded tracks: songs that are a recording rather than the engine's (no voice, no stems). Each brings
// its own plan (the clock, the gestures, the words on the board) and its sound, a file in the repo that
// the export reads and muxes as AAC (scripts/export-videostudio.mjs --track printer-song).
export const RECORDED = Object.freeze({'printer-song':Object.freeze({...PRINTER_SONG, plan:printerPlan})});

export const treatmentFor = track => TREATMENTS[BY_TRACK[track] ?? DEFAULT];
// A treatment by id, by track ('track:<id>'), or the track's own when the name is 'track'.
export function treatmentNamed(name, track) {
  if (!name || name === 'track') return treatmentFor(track);
  if (name === 'draft' || name === 'drop60') return TREATMENTS['drop60-draft'];
  const t = TREATMENTS[name];
  if (!t) throw Error(`There is no treatment called "${name}". Choose one of: track, ${Object.keys(TREATMENTS).join(', ')}.`);
  return t;
}
