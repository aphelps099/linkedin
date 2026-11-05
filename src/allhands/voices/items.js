// The two pixel voices: who they are (the voice bank's approved identities),
// where they sing, and how a line is respelled for an engine that misreads it.
// The lines themselves are lexicon.json's (lines.js); the prototype's 48-take
// test set is gone, the lexicon bank replaced it.

export const VOICES = {
  // Strategy: the approved voice-bank identity (characters.js, human-casting-2).
  strategy:{name:'Strategy', provider:'local-kokoro', voice:'am_onyx', speed:.95, amount:.6,
    register:{lo:38, hi:50, center:45}},        // D2..D3 around A2 (110 Hz): a little above his speaking median (88 Hz, F2), as singing sits
  // Synthia: the approved robot identity (characters.js, season-1).
  synthia:{name:'Synthia', provider:'flite', voice:'slt', pitch:1.04, amount:.6, fallbackAmount:.3,
    register:{lo:50, hi:62, center:55}},        // D3..D4, centred between F#3 and A3; her speaking median is 180 Hz (F#3)
};

// Respellings change only what an engine is given to say, never the lyric (as
// lyrics.js does for Synergy's eSpeak). Each rule lists what to try, in order:
// the first spelling is the plain one unless an earlier render proved it wrong.
// A take is kept only if Whisper small.en hears the lyric exactly, so the
// renderer walks these alternatives until one passes (render-song-voices.mjs).
export const SAY = {
  strategy:[
    [/^It's a$/, ["It's a", "It's uh", "It's a-"]],          // Kokoro: "a" alone is the letter ("Let's eye")
    [/\blayoff\b/, ['layoff', 'lay-off']],                   // "a leg off"
    [/^Agentic\.$/, ['Agentic.', 'Uh-jen-tic.']],             // "Oijantic"
    [/\balumni\b/, ['alumni', 'alum-nye']],                  // "alumnae"
    [/^Blessed\.$/, ['Blessed.', 'Bless-ed.']],               // "Bless"
    [/\bcopy-paste\b/, ['copy-paste', 'copy paste']],        // "copper paste"
    [/^Per my\b/, ['Per my', 'Purr my']],                     // "for my last email"
    [/^It's a remix\.$/, ["It's a remix.", "It's a ree-mix."]],   // "It's over, Max"
    [/^Trust the process\.$/, ['Trust the process.', 'Trust the prah-cess.', 'Trust, the process.']],   // "Trust the bra's ass"
  ],
  synthia:[
    [/\bgrateful\b/i, ['grateful', 'great-ful']],          // Flite: "Greatville"
    [/^It's ownership/, ["It's ownership", "It's, ownership"]],   // "It's still nourishing"
    // Flite's weak "a" is heard "the" ("It's the next step"); a full "ay" is heard "a".
    ...[['next step', 'ay'], ['focus season', 'ay'], ['not right now', 'ay'], ['retreat', 'ay'], ['remix', 'ay'], ['vibe', 'ay'],
      ['dependency', 'ay'], ['forecast', 'ay'], ['ritual', 'ay'], ['hackathon', 'ay'], ['starter kit', 'uh'], ['family', 'uh']]
      .map(([y, a]) => [new RegExp(`^It's a ${y}\\.$`), [`It's a ${y}.`, `It's ${a} ${y}.`]]),
    [/^It's a workation\.$/, ["It's a workation.", "It's ay werkation."]],          // "a word-cation"
    [/^It's a listening tour\.$/, ["It's a listening tour.", "It's a listening tooer."]],   // "a listening tear"
    [/^It's a reset year\.$/, ["It's a reset year.", "It's ay reset yeer.", "It's a reset, year."]],   // "the reset here"
    [/^It's a learning\.$/, ["It's a learning.", "It's a lerning.", "It's ay lurning."]],   // "the learning"
    [/^It's a tiger team\.$/, ["It's a tiger team.", "It's a tie-gur team.", "It's a tiger teem."]],   // "a tighter team"
    [/^It's async\.$/, ["It's async.", "It's ay-sync."]],                // sung: "It's a thing"
    [/^It's visibility\.$/, ["It's visibility.", "It's, visibility."]],  // "feasibility"
    [/^Pending\.$/, ['Pending.', 'Pen-ding.']],                          // "Bending", "Ending"
    [/^Huge shout-out\.$/, ['Huge shout-out.', 'Huge, shout-out.']],      // "You just shout out"
    [/^DM me\.$/, ['DM me.', 'Dee em me.', 'Dee-em me.', 'D. M. me.']],     // "Yeah me"
    [/^A testament to\.$/, ['A testament to.', 'A testament, to.']],      // "A testamenta"
    [/^Seamless\.$/, ['Seamless.', 'Seemless.']],                         // "Seamus"
    [/^Blessed\.$/, ['Blessed.', 'Blest.']],                              // sung: "Laughing"
    [/^Deep dive\.$/, ['Deep dive.', 'Deep, dive.', 'Deep dyve.']],       // sung: "Keep knifed"
    [/^Follow for more\.$/, ['Follow for more.', 'Follow, for more.']],   // sung: "Follow it for more"
    [/^Per my\b/, ['Per my', 'Pur, my']],                                // "for my last email"
  ],
};

// The spellings to try for a line, in order: alternative k of every rule that matches.
export function variantsOf(voice, text) {
  const rules = (SAY[voice] || []).filter(([re]) => re.test(text));
  const depth = Math.max(1, ...rules.map(([, alts]) => alts.length));
  const out = [];
  for (let k = 0; k < depth; k++) {
    const s = rules.reduce((t, [re, alts]) => t.replace(re, alts[Math.min(k, alts.length - 1)]), text);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}
