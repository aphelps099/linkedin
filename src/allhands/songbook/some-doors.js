// Some Doors: a river about finishing onboarding while one folder stays locked (Nov 7).
// A one-off: the river (forms.js 'wander') on Offsite's band, key and tempo, with its own
// chart, its own sources and its own cast. Unlisted: it renders by id
// (`--track some-doors`) but is not in TRACK_ORDER, so the picker and casting never offer it.
//
// The hook is the post's: "Some doors take time." (lyrics.js picks it; nothing here writes
// it). The rest is recorded: her "Delighted to have joined" (30.wav) and "Grateful for this
// incredible journey" (27.wav) cut into grains; Strategy's "Alignment" and "It's not a
// lanyard." as grains only; Synthia's "It's belonging." rising at the swell; her "The journey
// continues." (41.wav) in the pool.
import offsite from './offsite.js';
import {riverBand} from '../river.js';

const O = offsite.wander;
const ease = (keys, x) => {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [a, u] = keys[i - 1], [b, v] = keys[i], k = (1 - Math.cos(Math.PI * (x - a) / (b - a))) / 2; return u + (v - u) * k; }
  return keys.at(-1)[1];
};

const SECTIONS = [
  {name:'Source', from:0, to:2},       // one quiet syllable pattern and a soft stomp: the room through a wall
  {name:'Stream', from:2, to:10},      // the pattern alone through bar 3, then copies, the smear, the drone; Synergy once
  {name:'Current', from:10, to:15},    // lush by bar 12; then her second line, Pat, Strategy's word, the hands, Kevin, the pluck
  {name:'Swell', from:15, to:21},      // "It's not a lanyard." in grains, the felt piano, the mallet; "It's belonging." rises
  {name:'Pool', from:21, to:24},       // a half-speed shadow under the grid; "The journey continues." rises
  {name:'Delta', from:24, to:27},      // everything dissolves; the diffusion outlasts the direct sound
];
const ENERGY_KEYS = [[0, .66], [3, .65], [8, .64], [12, .7], [15, .76], [18, .84], [21, .78], [22, .7], [24, .74], [25, .74], [27, 0]];
const WINDOW_KEYS = [[0, 62], [3, 63], [8, 64], [12, 65], [15, 66], [18, 68], [21, 66], [24, 64], [27, 62]];   // D4, toward A4 at the swell, home

// The chart's layers, corrected for the river's rules (Nov 7 review): never more than two new layers
// in a bar (the tambourine is a layer: 13.6, not 15.6), and the organ and the choir are one drone.
const LAYERS = [
  {id:'her', kind:'texture', source:'her', stem:'lady', hp:220, what:'her syllables, from "Delighted to have joined": the first sound and the last', in:[0, 2], out:[24.1, 27], level:.8, open:5500, wash:[[0, .3], [12, .45], [24, .6], [27, .8]], delay:[[0, .18], [10, .24]], pans:[[0, -.15], [12, .15], [24, -.1]]},
  {id:'loop', kind:'loop', stem:'drums', what:'the loop: a soft stomp from the first bar, then the printer, the room clapping on two and four, floor toms, typing', in:[0, 2], out:[24.5, 27], level:1.4, open:16000, shut:1800, hp:70, swell:[[8, .9], [12, 1.05], [16, 1.15], [21, 1.15], [22, 1], [24, 1.1]]},
  {id:'her-copies', kind:'texture', source:'her', stem:'lady', what:'her syllables again: three 16ths on, a step higher, the other side', in:[3.1, 7.1], out:[23.1, 27], level:.6, open:4200, wash:[[3, .4], [18, .55]], delay:[[3, .3]], pans:[[3, .2], [16, -.2]]},
  {id:'smear', kind:'texture', source:'her', stem:'lady', hp:500, what:'the granular smear: her grains scattered round the same hits, wide', in:[5.1, 11.1], out:[24.1, 27], level:.7, open:3200, wash:[[6, .5], [22, .65], [27, .9]], delay:[[6, .3]], swell:[[18, 1.1], [24, 1.3]]},
  {id:'drone', kind:'drone', stem:'keys', what:'the pump organ and the wordless choir, "oo" opening to "ah" at the swell', in:[7.1, 11.1], out:[23.1, 27], level:.75, open:2400, shut:900, filter:[[16, 3600], [21, 2600], [24, 3000]]},
  {id:'grateful', kind:'texture', source:'grateful', stem:'lady', hp:300, what:'her second line, from "Grateful for this incredible journey", a darker delayed return', in:[12.1, 16.1], out:[24.1, 27], level:.6, open:5000, wash:[[12, .45]], delay:[[12, .35]], pans:[[12, .3], [20, -.2]]},
  {id:'bass', kind:'bass', stem:'bass', what:'Pat humming the root on the offbeats', in:[12.6, 16.6], out:[24.1, 27], level:.36, open:2200, shut:120},
  {id:'his', kind:'texture', source:'his', stem:'lady', hp:170, what:'Strategy\'s "Alignment" in grains', in:[13.1, 17.1], out:[24.1, 27], level:.75, open:3000, wash:[[13, .45]], delay:[[13, .25]], pans:[[13, -.3], [20, .1]]},
  {id:'tambourine', kind:'tambourine', stem:'drums', what:'the tambourine in the background, up a little at the swell', in:[13.6, 17.6], out:[24.1, 27], level:2.2, open:16000, shut:3000, swell:[[16, 1], [17, 1.4], [21, 1.4], [22, 1], [24, 1.2]]},
  {id:'guitar', kind:'guitar', stem:'guitar', hp:250, what:"Kevin's clean figure on the offbeats", in:[14.1, 18.1], out:[24.1, 27], level:.65, open:5000, delay:[[14, .3]]},
  {id:'plucks', kind:'colour', stem:'guitar', what:'a plucked string (Karplus-Strong), an arpeggio on the drifting window', in:[14.6, 18.6], out:[24.1, 27], level:.28, open:4000, wash:[[14, .25], [18, .35]], delay:[[14, .25]], pans:[[14, -.2], [18, .2], [22, 0]]},
  {id:'x', kind:'texture', source:'x', stem:'lady', hp:170, what:'"It\'s not a lanyard." in fragments, never readable', in:[15.1, 19.1], out:[24.1, 27], level:.68, open:3500, wash:[[15, .45]], delay:[[15, .3]], pans:[[15, .25], [19, -.25]]},
  {id:'felt', kind:'colour', stem:'keys', hp:200, what:'a felt piano on the chord, twice a bar', in:[15.6, 19.6], out:[24.1, 27], level:.27, open:3500, wash:[[15.6, .3]]},
  {id:'mallet', kind:'colour', stem:'keys', what:'a kalimba-like mallet, a sparse counter-line, a dark delay', in:[17.1, 21.1], out:[24.1, 27], level:.19, open:6000, wash:[[17, .3], [24, .6]], delay:[[17, .35]]},
];

// Two-bar patterns (16ths 0-31). Steps are pentatonic degrees from D3 (0 D · 1 E · 2 F# · 3 A · 4 B);
// every grain is retuned from its own measured pitch. Positions are the chart's millisecond offsets
// over the measured word lengths, kept 30-70% into the word, past its onset. Each grain is half a 16th.
// Recut after the loops-alone check (Nov 7): Whisper heard "not" (x, 16ths 15 and 31: now inside "lanyard")
// and "great" (grateful, 16th 3: now later in the word).
const hits = rows => rows.map(([at, cut, pos, deg, pan]) => ({at, cut, pos, deg, pan, len:.5}));
const V1 = [[2, 0, .3, 0, -.2], [6, 3, .3, 1, .15], [11, 0, .37, 2, -.1], [14, 2, .41, 1, .25], [18, 3, .3, 0, .1], [22, 0, .3, 2, -.25], [27, 3, .33, 3, .2], [30, 2, .54, 2, -.1]];
const TEXTURES = {
  her:{amount:.55, smear:2, smearSteps:[0, 2, -2], seed:11, center:50, hits:hits(V1)},
  'her-copies':{amount:.7, smear:2, smearSteps:[0, 2, 4], seed:12, center:50, hits:hits(V1.map(([at, cut, pos, deg, pan]) => [(at + 3) % 32, cut, pos, deg + 1, -pan]))},
  smear:{amount:.85, smear:4, smearSteps:[-2, 0, 2, 4], seed:13, center:50, hits:hits(V1.map(([at, cut, pos, deg, pan]) => [at, cut, pos, deg, Math.sign(pan || 1) * .6])).map(h => ({...h, gain:.55}))},
  grateful:{amount:.65, smear:2, smearSteps:[0, -2, 2], seed:14, center:50, hits:hits([[3, 0, .45, 1, .3], [10, 3, .41, 2, -.3], [19, 4, .3, 3, .2], [26, 3, .57, 2, -.2]])},
  his:{amount:.65, smear:2, smearSteps:[0, -2, 2], seed:15, center:50, hits:hits([[5, 0, .3, 0, -.15], [13, 0, .31, 1, .15], [21, 0, .3, 2, -.15], [29, 0, .35, 1, .15]])},
  x:{amount:.6, smear:2, smearSteps:[0, 2], seed:16, center:50, hits:hits([[7, 3, .3, 2, .25], [15, 3, .6, 1, -.25], [23, 3, .45, 3, .15], [31, 3, .7, 2, -.15]])},
  'couplet-y-echo':O.textures['couplet-y-echo'],
  'refrain-echo':O.textures['refrain-echo'],
};

const SOME_DOORS = {
  ...O,
  sections:SECTIONS, energy:bar => ease(ENERGY_KEYS, bar), window:x => ease(WINDOW_KEYS, x),
  // The stomp from the first bar (kick), the drone from bar 6 (it is silent until its ramp).
  layers:bar => ({...O.layers(bar), loop:true, kick:true, clap:true, toms:true, shaker:true, pad:bar >= 6}),
  hook:{bar:6, startStep:4, window:24},
  phrases:{y:17.25, refrain:22.25},
  // Clearer than Offsite's washed hook (the chart: a dry centre with a washed tail), and Synthia's
  // short answer lifted and lightly pixelated: Whisper heard "10 plus take time" and "It's your longing" at .6 / 3 dB / .3.
  voiceLevel:1, yLift:5, synthiaAmount:.2,
  layerSpec:LAYERS, textures:TEXTURES,
  loop:{...O.loop, from:{stomps:0, shaker:11.1, claps:12.1, toms:13.1, type:14.1}},
  sources:[
    {id:'her', what:'her syllables, from "Delighted to have joined"', part:{voice:'lady', file:'30.wav', words:[0, 3], text:'Delighted to have joined', display:'DELIGHTED TO HAVE JOINED'}},
    {id:'grateful', what:'her second line, from "Grateful for this incredible journey"', part:{voice:'lady', file:'27.wav', words:[0, 4], text:'Grateful for this incredible journey.', display:'GRATEFUL FOR THIS INCREDIBLE JOURNEY.'}},
  ],
  swells:[{name:'Swell', from:16, to:21, ref:[3, 10]}, {name:'Pool', from:21.5, to:24, ref:[3, 10]}],
  slow:[{from:21.1, to:24.1, what:'the pool: a half-speed shadow under the grid', level:.5, fade:1.5}],
  fade:[24.5, 27],
  drifts:[{what:'the pitch window of the colours (MIDI)', param:'window', points:WINDOW_KEYS}, {what:"the river's energy", param:'energy', points:ENERGY_KEYS}],
  defaults:{
    couplet:{id:'lanyard-belonging', topic:'culture', line:"It's not a lanyard. It's belonging.", recorded:false,
      x:{voice:'strategy', id:'lanyard-belonging-call', text:"It's not a lanyard.", display:"IT'S NOT A LANYARD."}, y:{voice:'synthia', id:'lanyard-belonging-response', text:"It's belonging.", display:"IT'S BELONGING."}},
    refrain:{voice:'lady', file:'41.wav', words:[0, 2], text:'The journey continues.', display:'THE JOURNEY CONTINUES.'},
    stabs:[{voice:'strategy', id:'alignment', text:'Alignment', display:'ALIGNMENT'}],
  },
  story:{synergy:'Sincere and a little stiff: his hook once, early, washed into the stream.', synthia:null},
};
SOME_DOORS.band = riverBand(SOME_DOORS);

export default {
  ...offsite,
  id:'some-doors',
  form:'wander',
  wander:SOME_DOORS,
  title:'Some Doors',
  genre:'Voice-loop psych pop',
  note:'108 BPM · D major · the river, about onboarding',
  blurb:'Five days in. The checklist is done, the shared drive found. One folder is still locked.',
};
