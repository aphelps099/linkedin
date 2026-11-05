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
  ],
  synthia:[
    [/\bgrateful\b/i, ['grateful', 'great-ful']],          // Flite: "Greatville"
    [/^It's ownership/, ["It's ownership", "It's, ownership"]],   // "It's still nourishing"
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
