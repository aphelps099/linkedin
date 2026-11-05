// The prototype test set (the lexicon bank replaces it): twelve expressions and
// six "It's not X. It's Y." couplets, each for Strategy and for Synthia, plus
// every couplet as a call and response (Strategy: "It's not X.", Synthia: "It's Y.").

export const VOICES = {
  // Strategy: the approved voice-bank identity (characters.js, human-casting-2).
  strategy:{name:'Strategy', provider:'local-kokoro', voice:'am_onyx', speed:.95,
    register:{lo:38, hi:50, center:45}},        // D2..D3 around A2 (110 Hz): a little above his speaking median (88 Hz, F2), as singing sits
  // Synthia: the approved robot identity (characters.js, season-1).
  synthia:{name:'Synthia', provider:'flite', voice:'slt', pitch:1.04,
    register:{lo:50, hi:62, center:55}},        // D3..D4, centred between F#3 and A3; her speaking median is 180 Hz (F#3)
};

export const EXPRESSIONS = [
  {id:'delve', text:'Delve.'},
  {id:'humbled-to-announce', text:'Humbled to announce.'},
  {id:'thrilled-to-share', text:'Thrilled to share.'},
  {id:'proud', text:'Proud.'},
  {id:'grateful', text:'Grateful.'},
  {id:'learnings', text:'Learnings.'},
  {id:'unpopular-opinion', text:'Unpopular opinion.'},
  {id:'agree', text:'Agree?', ask:true},
  {id:'thoughts', text:'Thoughts?', ask:true},
  {id:'north-star', text:'North star.'},
  {id:'bandwidth', text:'Bandwidth.'},
  {id:'game-changer', text:'Game-changer.'},
];

// not: what the post would call it; but: what the post calls it instead.
export const COUPLETS = [
  {id:'layoff-launch', not:'a layoff', but:'a launch'},
  {id:'burnout-bandwidth', not:'burnout', but:'bandwidth'},
  {id:'overtime-ownership', not:'overtime', but:'ownership'},
  {id:'meeting-moment', not:'a meeting', but:'a moment'},
  {id:'demotion-pivot', not:'a demotion', but:'a pivot'},
  {id:'bug-feature', not:'a bug', but:'a feature'},
];

// Respellings change only what a voice is given to say, never the lyric (as
// lyrics.js does for Synergy's eSpeak). Each was chosen by Whisper small.en on
// Flite's take: "Humbled" alone is heard "Humble", "Grateful" "Greatville",
// "It's ownership" "It's still nourishing", "It's a pivot" "It's a bevel".
export const SAY = {
  strategy:[],
  synthia:[[/^Humbled to /, 'Humbled tu '], [/^Grateful/, 'Great-ful'], [/It's ownership/, "It's, ownership"], [/pivot/, 'pivvot']],
};
export const spoken = (voice, text) => SAY[voice].reduce((s, [from, to]) => s.replace(from, to), text);

export const coupletText = c => `It's not ${c.not}. It's ${c.but}.`;
export const callText = c => `It's not ${c.not}.`;
export const responseText = c => `It's ${c.but}.`;

// Every take the bank renders: {id, voice, text, spoken, kind, item, ask?}. `id` is unique
// across voices: "<voice>/<item>" (+ "-call" / "-response").
export function takes() {
  const out = [];
  for (const voice of Object.keys(VOICES)) {
    for (const e of EXPRESSIONS) out.push({id:`${voice}/${e.id}`, voice, text:e.text, kind:'expression', item:e.id, ask:!!e.ask});
    for (const c of COUPLETS) out.push({id:`${voice}/${c.id}`, voice, text:coupletText(c), kind:'couplet', item:c.id});
  }
  for (const c of COUPLETS) {
    out.push({id:`strategy/${c.id}-call`, voice:'strategy', text:callText(c), kind:'call', item:c.id});
    out.push({id:`synthia/${c.id}-response`, voice:'synthia', text:responseText(c), kind:'response', item:c.id});
  }
  return out.map(t => ({...t, spoken:spoken(t.voice, t.text)}));
}
