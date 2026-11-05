// The band's takes: every line casting.js can give Strategy or Synthia, by id,
// read from lexicon.json and nothing else. A cast part names a take by its id;
// the voice bank keys the render `${voice}/${id}` (voice-table.js), the way the
// prototype keyed "strategy/delve" and "synthia/layoff-launch-response".
//
//   <bank id>               an expression of the bank: "per-my-last-email", "stay-humble"
//   <couplet id>-call       Strategy's X line: "It's not a layoff."
//   <couplet id>-response   Synthia's Y line: "It's a launch." (none when the lady owns Y)
//   <couplet id>-tag        Synthia's drop lead-in, cut off: "It's a quick-"
//   <couplet id>-impact     Synthia's drop impact: "sync."
//   its, its-a              Synthia's pickup before the lady's own Y word: "It's", "It's a"
//   ex-<words>              an exchange side the bank does not hold: "ex-aligned" is Strategy's "Aligned."
//
//   TAKES                   Map id -> {id, voice, kind, text, display, syllables, length, from}
//   takeOf(id)              that entry, or undefined
//   takeKey(part)           `${voice}/${id}`, what the voice bank keys a render by
//   clearFor(take)          Synthia only sings short, clear words (Aaron, Nov 5): her pixel takes lose
//                           long lines and a few words (the prototype's Whisper runs); Strategy's hold
//
// Pure: no network, no clock, no randomness.
import LEXICON from './lexicon.json' with {type:'json'};
import {syllables} from '../lyrics.js';

const count = text => String(text).replace(/[^A-Za-z0-9' -]/g, ' ').split(/[\s-]+/).filter(Boolean).reduce((n, w) => n + syllables(w), 0);
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const upper = text => String(text).toUpperCase();

export const TAKES = new Map();
const add = take => {
  if (TAKES.has(take.id)) throw Error(`takes: ${take.id} twice`);
  TAKES.set(take.id, Object.freeze(take));
};

// The bank: Strategy's and Synthia's expressions (the lady's are her recordings, cast by file).
for (const b of LEXICON.bank) if (b.voice === 'strategy' || b.voice === 'synthia')
  add({id:b.id, voice:b.voice, kind:'expression', text:b.text, display:b.display, syllables:b.syllables, length:b.length, from:{bank:b.id}, ...(b.take ? {master:b.take} : {})});
// The couplets: X for Strategy, Y for Synthia, and the drop's lead-in and impact.
for (const c of LEXICON.couplets) {
  add({id:`${c.id}-call`, voice:c.xVoice, kind:'call', text:`It's not ${c.x}.`, display:c.display[0], syllables:c.syllables.x, length:c.length.x, from:{couplet:c.id, part:'x'}});
  if (c.yVoice !== 'lady') add({id:`${c.id}-response`, voice:c.yVoice, kind:'response', text:`It's ${c.y}.`, display:c.display[1], syllables:c.syllables.y, length:c.length.y, from:{couplet:c.id, part:'y'}});
  if (c.drop?.tracks?.length) {
    add({id:`${c.id}-tag`, voice:'synthia', kind:'tag', text:c.drop.tag, display:c.drop.tagDisplay, syllables:count(c.drop.tag), length:c.drop.tagLength, from:{couplet:c.id, part:'tag'}});
    if (c.drop.impactVoice !== 'lady') add({id:`${c.id}-impact`, voice:c.drop.impactVoice, kind:'impact', text:c.drop.impact, display:c.drop.impactDisplay, syllables:c.drop.impactSyllables, length:c.drop.impactLength, from:{couplet:c.id, part:'impact'}});
  }
}
// Her pickups: Synthia sings "It's" or "It's a" in front of the lady's own Y word.
for (const text of ["It's", "It's a"]) add({id:slug(text.replace("'", '')), voice:'synthia', kind:'pickup', text, display:upper(text), syllables:count(text), length:null, from:{frame:text}});
// The exchanges: a side with a bank id is that expression; the others are their own takes.
LEXICON.exchanges.forEach((e, i) => {
  for (const side of ['call', 'answer']) {
    const s = e[side];
    if (s.voice === 'lady' || s.id) continue;
    const id = `ex-${slug(s.text)}`;
    if (!TAKES.has(id)) add({id, voice:s.voice, kind:'exchange', text:s.text, display:upper(s.text), syllables:count(s.text), length:s.length, from:{exchange:i, side}});
  }
});

export const takeOf = id => TAKES.get(id);
export const takeKey = part => `${part.voice}/${part.id}`;
export const exchangeTakeId = side => side.id ?? (side.voice === 'lady' ? undefined : `ex-${slug(side.text)}`);

// Synthia stays Flite (slt), and Flite's 16 kHz diphones lose more to the pixels
// than Kokoro does: in the prototype she lost "Delve", "Humbled to", "Thoughts?",
// "bandwidth", "ownership", "pivot" and "a demotion" at light or medium, and the
// longest lines first. So she answers in a few clear words: at most SYNTHIA.max
// syllables (SYNTHIA.stab for a single word said as a verdict), never one of those
// words. The voice bank's own Whisper results narrow it further: castSong's
// `available` option (README, Casting) takes only the takes that passed.
export const SYNTHIA = Object.freeze({max:6, stab:3, unclear:Object.freeze(['delve', 'humbled', 'thoughts', 'bandwidth', 'ownership', 'pivot', 'demotion', 'game-changer'])});
const UNCLEAR = new RegExp(`\\b(?:${SYNTHIA.unclear.map(w => w.replace(/-/g, '\\W?')).join('|')})\\b`, 'i');
export function clearFor(take, {stab = false} = {}) {
  if (!take) return false;
  if (take.voice !== 'synthia') return true;
  if (UNCLEAR.test(take.text)) return false;
  return take.syllables <= (stab ? SYNTHIA.stab : SYNTHIA.max);
}
