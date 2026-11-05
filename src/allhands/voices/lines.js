// Every lexicon line Strategy or Synthia can be cast to sing, from
// src/allhands/vocabulary/lexicon.json, with the voices that may sing it. Pure
// data, no I/O: the renderer (scripts/render-song-voices.mjs), the loader
// (voice-table.js) and the check (scripts/check-song-voices.mjs) read it.
//
// Ids are casting's (src/allhands/vocabulary/takes.js), and a take is keyed
// `${voice}/${id}`, its file `${voice}/${id}.flac`:
//   <bank id>               an expression: "per-my-last-email", "stay-humble"
//   <couplet id>-call       "It's not X." (Strategy confesses)
//   <couplet id>-response   "It's Y." when Synthia owns Y
//   <couplet id>-tag        the drop's lead-in, "It's a quick-": the response take cut before its impact,
//                           or, before the lady's impact, a short take of its own ("It's just")
//   <couplet id>-impact     the drop's impact, "sync.": the response take's last word(s)
//   its, its-a              "It's", "It's a" before the lady's own Y word
//   ex-<words>              an exchange side that is not a bank expression: "ex-aligned" is "Aligned."
//
// Aaron (Nov 5): Strategy leads the new lines; Synthia answers only with short,
// clear words. So Strategy renders every line, and Synthia is a candidate only
// for a line the lexicon gives her of at most SYNTHIA_MAX_SYLLABLES (casting's
// SYNTHIA.max): the render keeps her take only if Whisper hears it exactly at
// her pixel amount, and marks the line Strategy-only otherwise.
import LEXICON from '../vocabulary/lexicon.json' with {type:'json'};

export const SYNTHIA_MAX_SYLLABLES = 6;
// Strategy's lines Kokoro never says so Whisper hears them, in any spelling
// tried (render-song-voices.mjs report: "needle" is "nidal", "This." is "This
// one.", "Plot" is "Blot", "Agentic" is "authentic", "a miss" is "a myth"):
// Synthia renders them too, after him, and keeps them if she passes.
export const SYNTHIA_FALLBACK = ['this', 'move-the-needle', 'plot-twist', 'agentic', 'hot-desk-call', 'miss-stretch-goal-call', 'silence-parking-lot-call', 'loan-leverage-call'];
export const VOICE_ORDER = ['synthia', 'strategy'];   // who sings a line both can: the owner's voice first

// takes.js's slug (exchanges), and its pickup ids.
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const pickupId = frame => slug(frame.replace("'", ''));
export const fileOf = (voice, id, ext = 'flac') => `${voice}/${id}.${ext}`;
const sentence = s => /[.?!]$/.test(s) ? s : s + '.';
const sylCount = text => text.toLowerCase().replace(/[^a-z\s-]/g, '').split(/[\s-]+/).filter(Boolean)
  .reduce((n, w) => n + Math.max(1, (w.replace(/e$/, '').match(/[aeiouy]+/g) || []).length), 0);

// Lines with a take of their own: [{id, kind, text, owner, voices, why, syllables, ask, ref}]
//   owner   the voice lexicon.json gives the line
//   voices  who renders it, in preference order: Synthia when she is a candidate, Strategy always
//           (and Synthia after him on SYNTHIA_FALLBACK)
//   why     why Synthia is not a candidate: 'strategy' (his line) or 'long'
// Cuts (tag and impact) have no take of their own: CUTS lists them, from their source line.
export function lexiconLines(lex = LEXICON) {
  const lines = [], cuts = [], seen = new Set();
  const add = line => {
    if (seen.has(line.id)) return;
    seen.add(line.id);
    const syllables = line.syllables ?? sylCount(line.text);
    const why = line.owner === 'strategy' ? 'strategy' : syllables > SYNTHIA_MAX_SYLLABLES ? 'long' : null;
    const voices = SYNTHIA_FALLBACK.includes(line.id) ? ['strategy', 'synthia'] : why ? ['strategy'] : ['synthia', 'strategy'];
    lines.push({...line, syllables, ask:/\?$/.test(line.text), voices, why});
  };
  for (const b of lex.bank) {
    if (b.voice !== 'strategy' && b.voice !== 'synthia') continue;
    add({id:b.id, kind:'expression', text:sentence(b.text), owner:b.voice, syllables:b.syllables, ref:{bank:b.id}});
  }
  for (const frame of ["It's", "It's a"]) add({id:pickupId(frame), kind:'pickup', text:frame, owner:'synthia', ref:{frame}});
  for (const c of lex.couplets) {
    add({id:`${c.id}-call`, kind:'call', text:`It's not ${c.x}.`, owner:c.xVoice, syllables:c.syllables.x, ref:{couplet:c.id, part:'x'}});
    if (c.yVoice !== 'lady') add({id:`${c.id}-response`, kind:'response', text:`It's ${c.y}.`, owner:c.yVoice, syllables:c.syllables.y, ref:{couplet:c.id, part:'y'}});
    if (!c.drop?.tracks?.length) continue;
    const tag = c.drop.tag.replace(/-$/, '');
    if (c.drop.impactVoice !== 'lady') {
      // cut from the response take: the tag is every word before the impact
      const n = `It's ${c.y}.`.split(/\s+/).length, k = c.drop.impact.split(/\s+/).length;
      cuts.push({id:`${c.id}-tag`, kind:'tag', from:`${c.id}-response`, words:[0, n - k - 1], text:c.drop.tag, ref:{couplet:c.id, part:'tag'}});
      cuts.push({id:`${c.id}-impact`, kind:'impact', from:`${c.id}-response`, words:[n - k, n - 1], text:c.drop.impact, ref:{couplet:c.id, part:'impact'}});
    } else {
      // before the lady's impact: the pickup when it says the tag, else a take of its own
      const pick = ["It's", "It's a"].find(f => f === tag);
      if (pick) cuts.push({id:`${c.id}-tag`, kind:'tag', from:pickupId(pick), words:[0, -1], text:c.drop.tag, ref:{couplet:c.id, part:'tag'}});
      else add({id:`${c.id}-tag`, kind:'tag', text:tag, owner:'synthia', ref:{couplet:c.id, part:'tag'}});
    }
  }
  lex.exchanges.forEach((x, i) => {
    for (const part of ['call', 'answer']) {
      const s = x[part];
      if (s.voice === 'lady' || s.id) continue;
      add({id:`ex-${slug(s.text)}`, kind:'exchange', text:sentence(s.text), owner:s.voice, ref:{exchange:i, side:part}});
    }
  });
  return {lines, cuts};
}

const BUILT = lexiconLines();
export const LINES = BUILT.lines;
export const CUTS = BUILT.cuts;
export const lineOf = id => LINES.find(l => l.id === id) || null;
