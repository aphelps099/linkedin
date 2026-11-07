// Some Doors (Extended): the same river, four minutes long (Nov 7). Unlisted, like Some Doors:
// it renders by id (`--track some-doors-extended`) and nothing on the page offers it.
//
// 108 bars at 108 BPM: exactly 4:00. Two waves instead of one. The first is Some Doors
// stretched (the pattern alone, the copies, the smear, the drone, the hook, the band joining,
// the swell and "It's belonging."); then a breakdown, the pool, where Pat, Kevin and the
// tambourine fall away over a quiet pulse and her refrain rises alone over a half-speed shadow;
// then everything returns one or two a bar into a second, fuller swell; then a long dissolve
// that ends on her refrain once more.
//
// Two rules broken on purpose, and declared (constitution.js reads `breaks`): the length
// (a river is about 60 seconds) and the refrain's return (two clear band phrases at most).
import someDoors from './some-doors.js';
import {riverBand} from '../river.js';

const S = someDoors.wander;
const ease = (keys, x) => {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [a, u] = keys[i - 1], [b, v] = keys[i], k = (1 - Math.cos(Math.PI * (x - a) / (b - a))) / 2; return u + (v - u) * k; }
  return keys.at(-1)[1];
};

const BARS = 108;
const SECTIONS = [
  {name:'Source', from:0, to:4},       // 0:00 her pattern alone over a soft pulse
  {name:'Stream', from:4, to:24},      // 0:09 copies, the smear, the drone; Synergy's hook at 0:23
  {name:'Current', from:24, to:38},    // 0:53 her second line, Pat, Strategy's word, the hands, the tambourine, Kevin, the pluck
  {name:'Swell', from:38, to:52},      // 1:24 the lanyard grains, the felt piano, the mallet; "It's belonging." at 1:38
  {name:'Pool', from:52, to:66},       // 1:56 the breakdown: a quiet pulse, the felt piano, the half-speed shadow; her refrain at 2:09
  {name:'Current', from:66, to:80},    // 2:27 everything returns, one or two a bar
  {name:'Swell', from:80, to:96},      // 2:58 the fullest
  {name:'Delta', from:96, to:108},     // 3:33 the long dissolve; her refrain once more at 3:41
];
const ENERGY_KEYS = [[0, .66], [6, .65], [20, .64], [30, .7], [38, .76], [44, .84], [50, .8], [54, .68], [62, .66], [66, .7], [76, .76], [86, .86], [94, .84], [98, .76], [102, .74], [108, 0]];
const WINDOW_KEYS = [[0, 62], [8, 63], [20, 64], [30, 65], [38, 66], [46, 68], [54, 66], [64, 64], [74, 66], [86, 69], [96, 66], [108, 62]];

// Every layer of Some Doors, re-timed. `swell` is the breakdown and the return: a layer falls
// back in the pool and comes home over four bars, staggered so the flow changes a step at a time.
const by = id => S.layerSpec.find(l => l.id === id);
const L = (id, spec) => ({...by(id), ...spec});
const LAYERS = [
  L('her', {in:[0, 2], out:[102, 108], wash:[[0, .3], [24, .45], [52, .6], [66, .5], [96, .6], [108, .85]], delay:[[0, .18], [20, .24], [54, .32], [66, .24]], pans:[[0, -.15], [24, .15], [52, -.1], [80, .15], [100, -.1]], swell:[[52, 1], [56, 1.1], [64, 1.1], [68, 1]]}),
  L('loop', {in:[0, 2], out:[103, 108], swell:[[20, .9], [30, 1.05], [40, 1.15], [50, 1.15], [53, .35], [63, .35], [67, 1.05], [80, 1.15], [86, 1.25], [95, 1.2]]}),
  L('her-copies', {in:[4.1, 8.1], out:[99, 104], wash:[[4, .4], [40, .55], [54, .6]], delay:[[4, .3]], pans:[[4, .2], [30, -.2], [60, .2], [86, -.2]], swell:[[52, 1], [56, .5], [64, .5], [68, 1]]}),
  L('smear', {in:[8.1, 14.1], out:[102, 108], wash:[[8, .5], [50, .65], [90, .7], [108, .9]], delay:[[8, .3]], swell:[[38, 1.1], [50, 1.1], [54, .8], [64, .8], [82, 1.3], [95, 1.3]]}),
  L('drone', {in:[12.1, 18.1], out:[101, 107], filter:[[40, 3600], [52, 2400], [60, 2000], [70, 3000], [86, 3800], [96, 3000]]}),
  L('grateful', {in:[24.1, 28.1], out:[100, 105], wash:[[24, .45], [54, .6], [66, .45]], delay:[[24, .35]], pans:[[24, .3], [44, -.2], [70, .25], [90, -.2]], swell:[[52, 1], [56, .7], [64, .7], [68, 1]]}),
  L('bass', {in:[25.1, 29.1], out:[100, 104], swell:[[52, 1], [55, .2], [64, .2], [68, 1], [82, 1.1]]}),
  L('his', {in:[27.1, 31.1], out:[97, 101], wash:[[27, .45]], delay:[[27, .25]], pans:[[27, -.3], [44, .1], [72, -.3], [90, .1]], swell:[[52, 1], [55, .35], [67, .35], [71, 1]]}),
  L('tambourine', {in:[28.1, 32.1], out:[98, 102], swell:[[38, 1], [41, 1.4], [50, 1.4], [53, .3], [70, .3], [74, 1], [82, 1.45], [94, 1.45], [96, 1.2]]}),
  L('guitar', {in:[30.1, 34.1], out:[98, 102], delay:[[30, .3]], swell:[[52, 1], [55, .15], [66, .15], [70, 1]]}),
  L('plucks', {in:[31.1, 35.1], out:[99, 103], wash:[[31, .25], [40, .35], [70, .3], [86, .35]], delay:[[31, .25]], pans:[[31, -.2], [40, .2], [52, 0], [74, -.2], [86, .2], [98, 0]], swell:[[52, 1], [55, .35], [67, .35], [71, 1]]}),
  L('x', {in:[38.1, 42.1], out:[96, 100], wash:[[38, .45]], delay:[[38, .3]], pans:[[38, .25], [46, -.25], [74, .25], [86, -.25]], swell:[[52, 1], [55, .25], [69, .25], [73, 1]]}),
  L('felt', {in:[39.1, 43.1], out:[101, 105], wash:[[39, .3], [54, .45], [66, .3]], swell:[[52, 1], [56, 1.25], [64, 1.25], [68, 1]]}),
  L('mallet', {in:[42.1, 46.1], out:[100, 104], wash:[[42, .3], [54, .5], [86, .45], [100, .6]], delay:[[42, .35]], swell:[[52, 1], [56, .5], [70, .5], [74, 1], [84, 1.2]]}),
];

const SOME_DOORS_EXTENDED = {
  ...S,
  bars:BARS, sections:SECTIONS, energy:bar => ease(ENERGY_KEYS, bar), window:x => ease(WINDOW_KEYS, x),
  layers:bar => ({...S.layers(bar), pad:bar >= 10}),
  // Bar 10, before the drone: at bar 14 the smear and the drone were full and Whisper heard "10 floors take time".
  hook:{bar:10, startStep:4, window:24},
  phrases:{y:44.25, refrain:[58.25, 99.25]},
  layerSpec:LAYERS,
  textures:{...S.textures, 'refrain-echo-2':S.textures['refrain-echo']},
  loop:{...S.loop, from:{stomps:0, shaker:22, claps:25, toms:27, type:29}},
  swells:[{name:'Swell', from:40, to:52, ref:[8, 24]}, {name:'Second swell', from:82, to:96, ref:[8, 24]}],
  slow:[{from:55, to:63, what:'the pool: a half-speed shadow under the breakdown', level:.5, fade:2}, {from:100, to:106, what:'the dissolve: the shadow once more, under the last refrain', level:.4, fade:2}],
  fade:[102, 108],
  // Four minutes spend longer full than one: -8.90 LUFS at 5.1 dB, so the extended mix sits 1.3 dB lower.
  makeup:3.8,
  drifts:[{what:'the pitch window of the colours (MIDI)', param:'window', points:WINDOW_KEYS}, {what:"the river's energy", param:'energy', points:ENERGY_KEYS}],
  breaks:{
    'river.form':'The extended version: four minutes, so the flow can change twice.',
    'river.phrases':'Her refrain returns once, in the dissolve, to close the extended version.',
  },
};
SOME_DOORS_EXTENDED.band = riverBand(SOME_DOORS_EXTENDED);

export default {
  ...someDoors,
  id:'some-doors-extended',
  wander:SOME_DOORS_EXTENDED,
  title:'Some Doors (Extended)',
  note:'108 BPM · D major · the river, extended to four minutes',
  // The arranged plan's rules broken on purpose (constitution.js lintPlan reads track.breaks).
  breaks:{
    'form.length':'The extended version runs four minutes.',
    'river.phrases':'Her refrain returns once, in the dissolve, to close the extended version.',
  },
};
