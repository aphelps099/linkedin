// Which treatment cuts which track. A treatment is a pure function (plan, shots, {format, features?,
// seed?}) -> EDL, built on the plan's own landmarks so it cuts any track of the song book; this table
// picks the one a track's film is cut with, on /videostudio/ and in the export alike.
//
//   const t = treatmentFor('offsite');       // {id:'offsite-psych', fn, labels, title}
//   const edl = t.fn(plan, SHOTS, {format:'9:16'});
//
// To add one: write treatments/<id>.js exporting the function and its SCENE_LABELS, register it in
// TREATMENTS, and name the tracks it cuts in BY_TRACK (every other track keeps DEFAULT).
import {drop60Draft, SCENE_LABELS as DROP60_LABELS} from './drop60-draft.js';
import {offsitePsych, SCENE_LABELS as OFFSITE_LABELS} from './offsite-psych.js';

export const TREATMENTS = {
  'drop60-draft':{id:'drop60-draft', title:'Drop Edition 60', fn:drop60Draft, labels:DROP60_LABELS},
  'offsite-psych':{id:'offsite-psych', title:'Offsite, psychedelic', fn:offsitePsych, labels:OFFSITE_LABELS},
};
export const DEFAULT = 'drop60-draft';
export const BY_TRACK = Object.freeze({offsite:'offsite-psych'});

export const treatmentFor = track => TREATMENTS[BY_TRACK[track] ?? DEFAULT];
// A treatment by id, by track ('track:<id>'), or the track's own when the name is 'track'.
export function treatmentNamed(name, track) {
  if (!name || name === 'track') return treatmentFor(track);
  if (name === 'draft' || name === 'drop60') return TREATMENTS['drop60-draft'];
  const t = TREATMENTS[name];
  if (!t) throw Error(`There is no treatment called "${name}". Choose one of: track, ${Object.keys(TREATMENTS).join(', ')}.`);
  return t;
}
