// The song book: every post can become any of these songs. A track is a band
// chart and its sound: tempo, key, chords per section, swing, the kit and its
// patterns, the bass, keys and guitar, section energy and mix, and its own
// Drop Edition form, which keeps the signature moments in order (muted intro,
// verses, the lady's ladder, the choke and its silence, BACK. on a tuned drop
// kick, Drop A, Sink In, Drop B, the tape-stop on "Full stop."; Offsite lands
// it on a stomp and a bloom of voices instead).
//
// The cast is who the lady is in that song: which of her 57 recordings plays
// each role. README.md documents what each role needs musically.
import circleBack from './circle-back.js';
import humbledAndHonored from './humbled-and-honored.js';
import hustle from './hustle.js';
import offsite from './offsite.js';
import delve from './delve.js';

export const TRACKS = {
  'circle-back':circleBack,
  'humbled-and-honored':humbledAndHonored,
  hustle,
  offsite,
  // A concept film's song (Delve., her vocabulary): playable by id (--track delve), never picked by a post
  // or listed in the pickers, so it stays out of TRACK_ORDER (casting scores TRACK_ORDER only).
  delve,
};
export const TRACK_ORDER = ['circle-back', 'humbled-and-honored', 'hustle', 'offsite'];
export const DEFAULT_TRACK = 'circle-back';

export function trackOf(id) {
  if (id === undefined || id === null || id === '') return TRACKS[DEFAULT_TRACK];
  if (typeof id === 'object' && id.id && TRACKS[id.id] === id) return id;
  const track = TRACKS[id];
  if (!track) throw Error(`There is no track called "${id}". Choose one of: ${Object.keys(TRACKS).join(', ')}.`);
  return track;
}

// The lady's roles in a Drop Edition, in the order she plays them.
//   file:  her recording, public/phrases/NN.wav
//   words: [first, last] word indexes into lady-phrases.json (negative counts from the end)
//   display: what the Peg Board and the page show
//   split (sink only): the first word that goes deep; the words before it are said dry
export const LADY_ROLES = ['ladder', 'tag', 'impact', 'bend', 'sink', 'lift', 'punct', 'stop'];
export const DEFAULT_CAST = Object.freeze({
  ladder:{file:'50.wav', words:[0, -1], display:"LET'S BUILD."},
  tag:{file:'06.wav', words:[0, 1], display:"LET'S CIRCLE-"},
  impact:{file:'06.wav', words:[2, 2], display:'BACK.'},
  bend:{file:'08.wav', words:[0, -1], display:'PIVOT'},
  sink:{file:'15.wav', words:[0, -1], split:2, display:'LET THAT SINK IN'},
  lift:{file:'07.wav', words:[0, -1], display:'LEVERAGE'},
  punct:{file:'18.wav', words:[0, -1], display:'READ THAT AGAIN.'},
  stop:{file:'16.wav', words:[0, -1], display:'FULL STOP.'},
});

// The band's parts of a cast (casting.js castSong, README.md "Casting"): the
// couplet, the refrain, the exchanges, the sign-off, the stabs and the drop's
// tag. castOf passes them through as they are; the engine places them.
export const BAND_ROLES = ['couplet', 'refrain', 'exchanges', 'signoff', 'stabs', 'dropTag'];

// A cast names only the roles it changes; the rest stay the default. A role
// set to null is left out (the arrangement plays without it). Throws on an
// unknown role or a malformed entry, so a casting bug fails loudly.
export function castOf(cast) {
  if (!cast) return DEFAULT_CAST;
  const out = {...DEFAULT_CAST};
  for (const [role, entry] of Object.entries(cast)) {
    if (BAND_ROLES.includes(role)) { out[role] = entry; continue; }
    if (!LADY_ROLES.includes(role)) throw Error(`Unknown lady role "${role}". Roles: ${LADY_ROLES.join(', ')}.`);
    if (entry === null) { out[role] = null; continue; }
    if (!entry || typeof entry.file !== 'string' || !/^\d\d\.wav$/.test(entry.file)) throw Error(`Cast ${role}: file must look like "NN.wav".`);
    const words = entry.words ?? [0, -1];
    if (!Array.isArray(words) || words.length !== 2 || !words.every(Number.isInteger)) throw Error(`Cast ${role}: words must be [first, last].`);
    out[role] = {...entry, words};
  }
  return out;
}

// What a song book entry looks like to a picker (the page, the casting engine).
export const trackList = () => TRACK_ORDER.map(id => {
  const t = TRACKS[id], bars = t.drop.bars, seconds = bars * 16 * t.step;
  return {id, title:t.title, genre:t.genre, note:t.note, bpm:t.bpm, key:t.key, bars, seconds};
});
