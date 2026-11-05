// The songs a post can become. A form is a structure (the Drop Edition, the
// sound check); a track is the song that performs it (songbook/). Each form
// arranges the same lyrics and voice.
import {arrange, voicedWords, SECTIONS, BAR_STEPS} from './song.js';
import {arrangeDrop, dropVoicedWords, DROP_SECTIONS} from './drop.js';
import {arrangeWander, wanderVoicedWords, WANDER_SECTIONS} from './wander.js';
import {trackOf, DEFAULT_TRACK, TRACK_ORDER} from './songbook/index.js';

// Sound check 00 is Circle Back's rehearsal: the original 28 bars, only in that song.
function soundcheck(lyrics, durations, options = {}) {
  const track = trackOf(options.track);
  if (track.id !== DEFAULT_TRACK) throw Error(`Sound check 00 is ${trackOf(DEFAULT_TRACK).title}'s form. ${track.title} plays the Drop Edition.`);
  const plan = arrange(lyrics, durations), kicks = [];
  plan.bars.forEach(b => track.kicksOf(b.index, b.layers).forEach(s => kicks.push(b.index * BAR_STEPS + s)));
  if (plan.finale) kicks.push(plan.totalSteps);
  return Object.assign(plan, {track:track.id, trackTitle:track.title, kicks});
}

export const FORMS = {
  drop60:{id:'drop60', title:'Drop edition', note:'60 s · the lady builds, the room drops', arrange:arrangeDrop, voiced:dropVoicedWords, sections:DROP_SECTIONS,
    tracks:null, sectionsOf:track => trackOf(track).drop.sections},
  soundcheck:{id:'soundcheck', title:'Sound check 00', note:'56 s · the original band', arrange:soundcheck, voiced:(lyrics, options) => voicedWords(lyrics), sections:SECTIONS,
    tracks:[DEFAULT_TRACK], sectionsOf:() => SECTIONS},
  // The river (wander.js): the haze lane's form. Any track with a wander chart plays it (Offsite).
  wander:{id:'wander', title:'The river', note:'60 s · loops thicken into a stream', arrange:arrangeWander, voiced:wanderVoicedWords, sections:WANDER_SECTIONS,
    tracks:TRACK_ORDER.filter(t => trackOf(t).wander), sectionsOf:track => trackOf(track).wander.sections},
};
export const DEFAULT_FORM = 'drop60';
// The form a track plays unless one is picked: its own (Offsite: the river), else the Drop Edition.
export const formOf = track => trackOf(track).form ?? DEFAULT_FORM;
export const formPlays = (form, track) => !FORMS[form].tracks || FORMS[form].tracks.includes(trackOf(track).id);

// The 16th that contains a moment, from the plan's swing-aware timing table.
export function stepAt(plan, seconds) {
  const t = plan.timing;
  let lo = 0, hi = Math.min(t.length - 1, plan.totalSteps);
  if (seconds < t[0]) return -1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t[mid] <= seconds) lo = mid; else hi = mid - 1; }
  return lo;
}
