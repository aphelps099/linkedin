// Delve.: a concept film on LinkedIn vocabulary (Aaron, Nov 6: "we just hear
// the river music, and the corporate lady voice saying phrases like DELVE, on
// normal voice, then on delay, reverb, down pitch, with echo to fade ... the
// woman voice starts with crisp tones, clearly pronounced, but then it gets the
// Panda Bear-style distortion as we continue ... about 2 min ... nice acoustic
// percussive rhythm, smooth synth, and the vocal builds: tambourines, low
// choir-esque repeating phrases that help establish the soundbed").
//
// The river (forms.js 'wander'), 48 bars at 96 BPM, 120.0 s, E Dorian. Ten
// things LinkedIn says, each said once by the voice from the meeting, crisp and
// dry, then handed to the echo (delay, reverb, down a fifth, down an octave,
// the echo to fade) until she is the choir. Halfway down, the chords lift into
// the Pool and the stars come out (glass chimes, one a note); at the bottom she
// surfaces, perfectly clear: "Read that again." The film loops to "Delve."
//
// The bed is her too: "Momentum compounds." cut into five syllables and sung by
// four of her (unison, a fifth below, an octave below, a fourth above; formants
// lowered), a two-bar chant she does not say until bar 38, when it compounds
// into a canon of eight. Around her, one loop of hands and floors, a hand drum,
// a slit drum, plucks, a felt piano, a mallet, the tambourine in the background;
// Synergy's stiff whole-note pad, Pat's warm bass, Synthia's soft arpeggio in
// the second swell. Influences are sound and approach only: no melody, lyric,
// sample or structure of any real song.
//
// The other ten percent, declared (CONSTITUTION.md): ten clear phrases, not two
// (her vocabulary is the subject: still four bars apart at least, never two
// voices back to back), and two minutes, not one (a concept film).
import {riverBand} from '../river.js';

const BPM = 96, STEP = 60 / BPM / 4, SWING = .06;
const SCALE_PCS = [4, 6, 7, 9, 11, 1, 2];            // E Dorian
const HOME = [4, 7, 9, 11, 2];                         // E minor pentatonic: E G A B D
const POOL = [9, 11, 1, 4, 6];                         // the Pool lifts off the tonic: A B C# E F# (C#, the Dorian sixth, is the stars' note)

// Two bars each, every change an 8th early (the push). `notes` the pad and the drone's choir, `keys` the
// pump organ, `choir` the Pool's held "ah" (four of her), `root` Pat's.
const CHORDS = {
  Em9:{name:'Em9', root:40, notes:[55, 59, 62, 66], keys:[52, 55, 59, 62, 66], avail:HOME},
  A9sus4:{name:'A9sus4', root:45, notes:[55, 59, 62, 64], keys:[50, 55, 57, 59, 64], avail:HOME},
  G69s11:{name:'G6/9#11', root:43, notes:[57, 59, 61, 64], keys:[50, 55, 59, 61, 64], choir:[50, 55, 59, 64], avail:POOL},
  A69:{name:'A6/9', root:45, notes:[57, 61, 64, 66], keys:[52, 57, 59, 61, 66], choir:[52, 57, 61, 66], avail:POOL},
};
const C = CHORDS;
const BARS = 48, POOL_BARS = [24, 32], HOLD = 44;
const inPool = bar => bar >= POOL_BARS[0] && bar < POOL_BARS[1];
const chordAt = bar => (bar >= HOLD ? C.Em9 : inPool(bar) ? (bar % 4 < 2 ? C.G69s11 : C.A69) : (bar % 4 < 2 ? C.Em9 : C.A9sus4));
const pentatonicAt = bar => (inPool(bar) ? POOL : HOME);

const SECTIONS = [
  {name:'Source', from:0, to:4},       // room tone, "Delve.", its echo chain; the river grows out of the echo
  {name:'Stream', from:4, to:14},      // the delve grains repeat and thicken; the choir, the pad, the hands; "In today's...", "It's not about the tools."
  {name:'Current', from:14, to:24},    // the slit drum, the smear, the felt piano, the mallet; Swell 1; "It's not about X.", "Not just a job"; the breath
  {name:'Pool', from:24, to:32},       // the stars: the chords lift; "A rich tapestry", "Let that sink in"; the river slows under itself
  {name:'Swell', from:32, to:42},      // home; everything returns, Synthia's arp; Swell 2; "Passionate about..."; the canon compounds
  {name:'Delta', from:42, to:48},      // the fullest texture dissolving; "Read that again."
];
const ease = (keys, x) => {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [a, u] = keys[i - 1], [b, v] = keys[i], k = (1 - Math.cos(Math.PI * (x - a) / (b - a))) / 2; return u + (v - u) * k; }
  return keys.at(-1)[1];
};
const ENERGY_KEYS = [[0, .62], [4, .62], [12, .6], [14, .62], [16, .7], [18, .78], [21, .78], [22, .7], [23, .6], [24, .56], [27, .54], [30, .56], [32, .63], [34, .7], [37, .79], [39, .84], [41, .84], [42, .78], [44, .68], [46, .56], [48, 0]];
const WINDOW_KEYS = [[0, 64], [16, 66], [24, 69], [32, 66], [40, 67], [48, 64]];   // the colours' pitch window: E4, up to A4 in the Pool, home

// The layers (bars). Every ramp two to eight bars, at most two entrances a bar (the loop's own hands join
// inside it, RIVER_LOOP.from, on bars no other layer enters), nothing arriving on a bar line.
const LAYERS = [
  {id:'delve', kind:'texture', source:'delve', stem:'lady', hp:200, what:'"Delve" in grains on a two-bar pattern: the river grows out of her first word\'s echo', in:[1, 4], out:[42, 46], level:.8, open:6000, wash:[[1, .35], [16, .45], [32, .55], [46, .7]], delay:[[1, .2], [12, .26]], pans:[[1, -.1], [16, .15], [32, -.1]], slow:true},
  {id:'loop', kind:'loop', stem:'drums', what:'the loop: soft stomps from the first bar (the pulse), then the printer, a room clapping on two and four, floor toms after the beats, typing', in:[1, 4], out:[45, 47], level:1.3, open:16000, shut:1800, hp:60,
    swell:[[16, 1], [19, 1.12], [21, 1.1], [22, .9], [23, .78], [25, .8], [31, .9], [34, 1], [38, 1.15], [41, 1.2], [42, 1.05]], slow:true},
  {id:'drone', kind:'drone', stem:'keys', what:'the pump organ and a wordless "oo", one chord at a time', in:[3, 7], out:[44, 48], level:.3, open:3800, shut:300, filter:[[16, 4600], [24, 3000], [32, 4200]], slow:true},
  {id:'delve-copies', kind:'texture', source:'delve', stem:'lady', hp:200, what:'"Delve" again: copies a dotted 8th on, pitch steps, panned', in:[5, 8], out:[42, 46], level:.6, open:7000, wash:[[5, .4], [20, .55]], delay:[[5, .3]], pans:[[5, .25], [20, -.25]],
    swell:[[16, 1], [19, 1.3], [21, 1.25], [22, 1], [23, .8], [24, .9], [34, 1.1], [38, 1.4]], slow:true},
  {id:'choir', kind:'choir', stem:'lady', hp:170, what:'her choir: "Momentum compounds." in five syllables, sung by one, two, three, then four of her, a two-bar chant; the Pool\'s held "ah"', in:[6, 12], out:[44, 48], level:.85, open:5200, shut:400, wash:[[6, .5]], delay:[[6, .1]]},
  {id:'pad', kind:'pad', stem:'keys', hp:220, what:"Synergy's smooth synth: whole-note chords, detuned saws and a triangle, a breathing low-pass", in:[8, 14], out:[44, 47], level:.38, open:5000, shut:300, wash:[[8, .3]], slow:true},
  {id:'hands', kind:'hands', stem:'drums', hp:70, what:'a hand drum: bass, slap, open and muted strokes on E and B, a one-bar figure', in:[8, 12], out:[42, 46], level:.85, open:12000, shut:900, wash:[[8, .12]], pans:[[8, -.2]],
    swell:[[16, 1], [19, 1.3], [21, 1.25], [22, .9], [23, .6], [24, .55], [31, .8], [34, 1.05], [38, 1.35]], slow:true},
  {id:'vocab', kind:'texture', source:'vocab', stem:'lady', hp:220, what:'"Synergy", "Leverage", "Pivot", "Game-changer" in grains, never whole', in:[10, 14], out:[38, 42], level:.6, open:5000, wash:[[10, .45]], delay:[[10, .3]], pans:[[10, -.3], [20, .3], [30, -.2]]},
  {id:'plucks', kind:'colour', stem:'guitar', what:'a plucked string (Karplus-Strong), an arpeggio on the drifting pitch window', in:[10, 14], out:[40, 44], level:.15, open:7000, wash:[[10, .25], [20, .35]], delay:[[10, .25]], pans:[[10, .2], [20, -.2]]},
  {id:'bass', kind:'bass', stem:'bass', what:'Pat, warm: a sine and a soft saw under 500 Hz, legato', in:[12, 16], out:[42, 46], level:.36, open:2000, shut:120},
  {id:'tambourine', kind:'tambourine', stem:'drums', what:'the tambourine, in the background, up a little where the texture swells', in:[12, 16], out:[42, 46], level:3, open:16000, shut:3000,
    swell:[[16, 1], [19, 1.45], [21, 1.4], [22, 1.05], [23, .7], [24, .8], [31, 1], [34, 1.2], [38, 1.45], [41, 1.45]]},
  {id:'logdrum', kind:'logdrum', stem:'drums', hp:90, what:'a slit drum on the pentatonic, a 16th ostinato: the grid in wood', in:[14, 18], out:[38, 42], level:.62, open:9000, shut:700, delay:[[14, .18]], pans:[[14, .3], [24, -.2], [32, .25]]},
  {id:'smear', kind:'texture', source:'delve', stem:'lady', hp:200, what:'the granular smear: "Delve" in grains, heavily pixelated, wide', in:[16, 22], out:[41, 45], level:.6, open:9000, wash:[[16, .55], [40, .7]], delay:[[16, .3]], swell:[[24, 1.1], [34, 1.2], [38, 1.35]]},
  {id:'felt', kind:'colour', stem:'keys', hp:200, what:'a felt piano on the chord, twice a bar', in:[18, 22], out:[44, 48], level:.12, open:5000, wash:[[18, .3], [24, .45]]},
  {id:'mallet', kind:'colour', stem:'keys', what:'a kalimba-like mallet, a counter-line over the window', in:[20, 24], out:[40, 44], level:.14, open:9000, wash:[[20, .3]], delay:[[20, .35]]},
  {id:'chime', kind:'chime', stem:'keys', hp:400, what:'the stars: glass chimes, one a star, into the long delay', in:[23, 25], out:[44, 48], level:.24, open:14000, shut:2000, wash:[[23, .6]], delay:[[23, .45]]},
  {id:'arp', kind:'arp', stem:'keys', hp:180, what:"Synthia's soft 16ths over the chord, through a gentle crush", in:[32, 36], out:[40, 44], level:.14, open:5500, shut:500, delay:[[32, .3]], wash:[[32, .25]], pans:[[32, .2], [38, -.2]]},
];

// Two-bar texture patterns (16ths 0-31), as Offsite's: grains, never a whole word.
const TEXTURES = {
  delve:{amount:.55, smear:2, smearSteps:[0, 2, -2], seed:11, hits:[[2, 0, .3], [6, 2, .42], [10, 1, .34], [14, 3, .5], [18, 0, .38], [22, 2, .46], [26, 4, .3], [30, 1, .55]].map(([at, deg, pos]) => ({at, deg, pos, len:.5}))},
  'delve-copies':{amount:.65, smear:2, smearSteps:[0, 2, 4], seed:12, hits:[[0, 2, -.5, .34], [5, 4, .5, .48], [8, 1, -.3, .3], [13, 3, .4, .44], [16, 2, .5, .52], [21, 5, -.5, .3], [24, 1, .3, .46], [29, 3, -.4, .38]].map(([at, deg, pan, pos]) => ({at, deg, pan, pos, len:.5}))},
  smear:{amount:.85, smear:5, smearSteps:[-2, 0, 2, 4], seed:14, hits:Array.from({length:16}, (_, i) => ({at:i * 2 + 1, deg:[0, 2, 4, 1, 3, 5, 2, 0][i % 8], len:.5, pos:[.3, .5, .4, .55][i % 4], gain:.55, pan:i % 2 ? .6 : -.6}))},
  vocab:{amount:.6, smear:2, smearSteps:[0, 2], seed:16, hits:[{at:1, cut:0, pos:.35}, {at:4, cut:1, pos:.3}, {at:9, cut:2, pos:.4, deg:2}, {at:12, cut:3, pos:.3}, {at:17, cut:0, pos:.55, deg:1}, {at:20, cut:1, pos:.5, deg:-1}, {at:25, cut:2, pos:.3}, {at:28, cut:3, pos:.55, deg:2}].map(h => ({...h, len:.5}))},
};
const PLUCKS = [0, null, 2, 4, null, 3, 1, null, 2, null, 4, 5, null, 3, 2, null, 1, null, 3, 5, null, 4, 2, null, 3, null, 5, 6, null, 4, 2, null];
const MALLET = Array.from({length:64}, (_, i) => ({2:4, 7:2, 11:3, 15:1, 18:5, 27:2, 34:4, 39:3, 43:2, 50:1, 59:0, 62:2})[i] ?? null);
// The slit drum: two bars of 16ths, pentatonic degrees from the window an octave down, accented on the grid.
const LOGDRUM = [0, null, 2, null, 1, null, 3, 0, null, 2, null, 4, null, 1, 3, null, 0, null, 2, null, 1, null, -1, 0, null, 2, null, 4, 3, null, 1, null];
// The hand drum, one bar: [16th, stroke, note, v, pan]. Bass on one, slaps on the backbeat's edges, the open
// tones answering (B3 and E4, the key's fifth and root: a conga's register, above the choir).
const HANDS = [[0, 'bass', 59, .45, -.15], [3, 'mute', 59, .3, -.15], [4, 'slap', 64, .5, .25], [6, 'open', 59, .44, -.15], [7, 'open', 59, .32, -.15], [10, 'mute', 64, .28, .25], [11, 'open', 64, .36, .25], [12, 'slap', 64, .5, .25], [14, 'open', 64, .42, .25], [15, 'open', 59, .38, -.15]];
// Synthia's arpeggio over the chord (indexes into the chord's notes, up an octave; 4 is the top note an octave up).
const ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 1, 3, 2, 4, 3, 1];
// Pat: [16th, interval above the root (null: the next chord's root, on a push), 16ths, v].
const BASSLINE = [[0, 0, 6, .62], [6, 0, 3, .38], [10, 7, 4, .46], [14, null, 2, .5]];

const STOMP = {top:150, settle:82.41, decay:.3, thud:.45, heel:.0004};   // a foot on the floor, settling on E2
const RIVER_LOOP = {
  // The bar each part of the loop starts to ramp in from (over two bars), on bars no layer enters.
  from:{stomps:1, shaker:5, claps:9, toms:11, type:13},
  stomps:[[0, .22], [4, .26], [8, .22], [12, .26]], stomp:STOMP,
  claps:[[4, .62, 0], [12, .62, 0], [2, .18, 2], [10, .16, 2]],
  toms:[[1, .08, 47, .18], [2, .12, 52, .22], [5, .08, 47, .18], [6, .13, 52, .22], [9, .08, 47, .18], [10, .12, 52, .22], [13, .09, 47, .18], [14, .14, 52, .22]],
  shake:[.08, .14, .26, .17], type:[.28, .48, .8, 0, .32, 0, .8, .44, .28, .56, .8, 0, .36, 0, .8, .48],
  // In the Pool the floor goes quiet: the toms and claps thin, the stomps at .6 (two bars each way).
  mix:bar => { const k = ease([[22, 0], [24, 1], [30, 1], [32, 0]], bar); return {stomps:1 - .45 * k, claps:1 - .7 * k, toms:1 - .75 * k, shaker:1 - .3 * k, type:1 - .5 * k}; },
};
const riverLayers = bar => ({drums:'river', groove:'river', loop:bar >= 1, kick:bar >= 1, clap:bar >= 1, toms:bar >= 1, shaker:bar >= 1, tambourine:bar >= 12, bass:bar >= 12 ? 'warm' : false,
  keys:'drone', pad:false, guitar:false, colours:bar >= 10, textures:true});

// ---- her phrases ---------------------------------------------------------------------------
// The setlist: her recordings, where each rises (bar, step: its first vowel lands there), its stage, how
// clear she still is, and how the Peg Board sets it (split: the couplet's page break, the word that opens
// page two; font and size). Echo times are absolute 16ths of the song.
//   chain   the word (index) the echo follows; delay taps; reverb (the throw); down (a fifth by PSOLA, still
//           her) or octave (half-speed tape); fade [from, to]: the echo to fade, fed by the last of them
//   steps   the word stepping down the pentatonic, one copy a note: [16th, MIDI]
//   voices  copies sung with her: shift (semitones, PSOLA: formants kept), delay (s), cents, gain (dB), pan
//   tape    the tape slows from `slide` (file seconds) to the end, rate 1 to .5, under a wow, sinking to `fade` of her level
//   freeze  a grain of the word ([from, to] file seconds) frozen and re-struck on 8ths until `until`
//   canon   her phrase sung on the choir's tune by voice after voice: entries (16ths; the first is the
//           phrase itself), each voice repeating every `every` 16ths while it starts before its `out`, on
//           its pentatonic offset from the tune. 1, 2, 4, 8 voices: the entries 2 beats apart, then 1, then an 8th
const SETLIST = [
  {id:'P1', file:'10.wav', bar:0, step:4, stage:'chain', display:'DELVE.', clarity:1, pixel:0, wash:.06, font:'peg9', k:2,
    chain:{word:0, delay:[16, 19, 22], reverb:24, down:{kind:'fifth', at:32}, octave:40, fade:[40, 64]}},
  {id:'P2', file:'31.wav', bar:5, stage:'dry', display:"IN TODAY'S FAST-PACED WORLD…", clarity:1, pixel:0, wash:.1, gain:-1.5, font:'peg9', k:1},
  {id:'P3', file:'09.wav', bar:9, stage:'chain', display:"IT'S NOT ABOUT THE TOOLS. IT'S ABOUT THE MINDSET.", split:5, strike:[3, 4], clarity:.9, pixel:0, wash:.12, gain:-1.5, font:'peg9', k:1,
    chain:{word:-1, delay:[168, 171, 174], reverb:176, down:{kind:'fifth', at:184}, fade:[184, 216]}},
  {id:'P4', file:'22.wav', bar:14, stage:'chain', display:"IT'S NOT ABOUT X. IT'S ABOUT Y.", split:4, strike:[3], clarity:.9, pixel:0, wash:.14, font:'peg9', k:1,
    chain:{word:-1, delay:[244, 247, 250], reverb:252, octave:256, fade:[256, 288]}},
  {id:'P5', file:'33.wav', bar:19, stage:'double', display:'NOT JUST A JOB. A CALLING.', split:4, strike:[2, 3], clarity:.8, pixel:.1, wash:.2, font:'peg9', k:1,
    voices:[{kind:'double', delay:.018, cents:7, gain:-4, pan:.32}], steps:{word:-1, notes:[[324, 59], [330, 57], [336, 55], [342, 52]], fade:[342, 360]}},
  {id:'P6', file:'11.wav', bar:24, stage:'harmony', display:'A RICH TAPESTRY', split:2, clarity:.6, pixel:.2, wash:.5, gain:-3, font:'peg9', k:1,
    voices:[{kind:'harmony', steps:1, gain:-5, pan:-.45}, {kind:'harmony', steps:-2, gain:-6, pan:.45}], chain:{word:-1, reverb:400}},
  {id:'P7', file:'15.wav', bar:28, stage:'tape', display:'LET THAT SINK IN.', split:2, clarity:[1, .3], pixel:.3, wash:.5, font:'peg9', k:1,
    tape:{slide:.95, rate0:1, rate1:.5, wow:{cents:9, hz:.9}, fade:.45}},
  {id:'P8', file:'32.wav', bar:33, stage:'shadow', display:'PASSIONATE ABOUT DRIVING IMPACT AT THE INTERSECTION OF…', split:4, clarity:.4, pixel:.3, wash:.9, gain:-4.5, font:'peg5', k:1,
    wow:{cents:8, hz:.6}, voices:[{kind:'double', delay:.018, cents:7, gain:-4, pan:.3}, {kind:'shadow', shift:-12, gain:-9, pan:-.2, lp:2200}],
    freeze:{word:-1, grain:[2.596, 2.646], every:2, from:544, until:576}},
  {id:'P9', file:'57.wav', bar:38, stage:'canon', display:'MOMENTUM COMPOUNDS.', split:1, clarity:.5, pixel:.5, wash:1, gain:-4, font:'peg9', k:1,
    canon:{entries:[608, 632, 644, 652, 658, 662, 666, 670], every:16, out:[704, 696, 700, 696, 692, 688, 684, 680], offsets:[0, -3, 2, -5, -1, 1, -2, 3]}},
  {id:'P10', file:'18.wav', bar:46, stage:'dry', display:'READ THAT AGAIN.', split:2, clarity:1, pixel:0, wash:.06, font:'peg9', k:1},
];

// The choir: the chant (two bars: [16th, 16ths, syllable of CHANT_SYLLABLES, MIDI of the unison singer],
// home pentatonic), its singers ([pentatonic steps from the tune, formant semitones, cents, onset s]),
// the bar each joins (ramping in over two bars), and the Pool where it holds "ah" on the chord.
const CHOIR = {
  chant:[[0, 6, 0, 59], [6, 4, 1, 57], [10, 6, 2, 55], [16, 6, 3, 57], [22, 10, 4, 52]],
  singers:[{steps:0, formant:0, cents:0, onset:0, from:6}, {steps:-3, formant:-2, cents:5, onset:.012, from:12}, {steps:-5, formant:-4, cents:-4, onset:.024, from:18}, {steps:2, formant:-6, cents:9, onset:.035, from:32}],
  pool:POOL_BARS,
  // the singers' gain (dB) and pixels; the chant's pixels rise across the song (.2 to .5)
  gains:[0, -3, -8, -5], ah:-7, pixels:[[6, .2], [32, .38], [44, .5]],
};

// The stars (the chime layer, plan.stars): how many are born a bar, from the Pool on. The first three are
// born on "A rich tapestry"'s words (the first, the kiss, a signal star); three hero stars in 40-42.
const STARS = {at:24, perBar:[[24, 3], [25, 1], [26, 1], [27, 1], [28, 2], [29, 3], [30, 4], [31, 5], [32, 6], [42, 5], [43, 4], [44, 3], [45, 2], [46, 1], [48, 0]], heroes:[40, 41, 41.5],
  // the stars alive (the picture's count: near stars born on chimes, far ones silent), [bar, n]
  alive:[[24, 1], [24.5, 3], [28, 4], [31, 12], [34, 18], [38, 24], [42, 24], [44, 12], [46, 6], [47.5, 1], [48, 0]], octave:[73, 93]};

// The moments the picture keys on (bars): the mouth draws itself, the kiss, the first star, the slow,
// the second swell, the canon, the delta, the undraw.
const MARKS = {mouth:22, kiss:23 + 12 / 16, star:24, slow:28.5, swell2:34, canon:38, delta:42, undraw:47};

// The room the meeting is in, under the first four bars (before the loop's floor arrives): low air, the building's hum.
const ROOM = {bars:4, level:.016};

const WANDER = {
  bars:BARS, sections:SECTIONS, swing:SWING, pentatonic:HOME, pentatonicAt, chordAt, push:2,
  layers:riverLayers, cutoff:() => ({keys:[16000, 16000], pad:[16000, 16000]}), energy:bar => ease(ENERGY_KEYS, bar), window:x => ease(WINDOW_KEYS, x),
  // No Synergy voice: this is her film.
  hook:null, phrases:{},
  setlist:SETLIST, choir:CHOIR, stars:STARS, marks:MARKS, clearMax:SETLIST.length, seconds:[110, 130],
  // The loop sources the textures cut: her first word, and her one-word vocabulary.
  loops:[{id:'delve', files:['10.wav'], what:'"Delve", in grains'}, {id:'vocab', files:['05.wav', '07.wav', '08.wav', '12.wav'], what:'"Synergy", "Leverage", "Pivot", "Game-changer", in grains'}],
  layerSpec:LAYERS, textures:TEXTURES, plucks:PLUCKS, mallet:MALLET, logdrum:LOGDRUM, hands:HANDS, arp:ARP, bassline:BASSLINE, figure:[],
  loop:RIVER_LOOP, tambourine:{shakes:[.2, .11, .46, .16], hits:[12]}, room:ROOM,
  // Where the texture comes up, over the stream it grew from (bars 5-12).
  swells:[{name:'Swell 1', from:16, to:23, ref:[5, 12]}, {name:'Swell 2', from:34, to:42, ref:[5, 12]}],
  slow:[{from:28.5, to:31, what:'"sink in": the river slows to half speed, an octave down, under itself', level:.5, fade:1.2}],
  fade:[44, 48],
  makeup:3,
  drifts:[{what:'the pitch window of the colours (MIDI)', param:'window', points:WINDOW_KEYS}, {what:'the river\'s energy', param:'energy', points:ENERGY_KEYS}],
  defaults:{},
  kicksOf:(bar, L) => (L.kick ? [0, 4, 8, 12] : []),
  palette:{
    synth:"Synergy's smooth synth (detuned saws and a triangle, whole notes, a breathing low-pass) and Synthia's soft arpeggio; the textures: her words cut into grains, pitched onto the pentatonic and pixelated; her choir.",
    keys:'A pump organ and a wordless "oo" as the drone; a felt piano on the chord, twice a bar; a kalimba-like mallet; glass chimes, the stars.',
    drums:'One loop of hands and floors in every bar: soft stomps, a room clapping on two and four, floor toms after the beats, the printer as the shaker, keyboard clatter; a hand drum; a slit drum on the grid; the tambourine in the background.',
    bass:'Pat: warm, a sine and a soft saw under 500 Hz, legato, pumped by the stomps.',
    guitar:"Kevin: a plucked string's arpeggio on the drifting window. Never a solo.",
  },
  acoustic:['plucks', 'felt', 'mallet', 'tambourine'],
  references:{
    'daft-punk':"The spine, worn lightly: Synergy's stiff whole-note pad, the soft four on the floor pumping the pad and Pat.",
    'panda-bear':'The lane: one voice layered into a choir, short samples repeating until they diffuse, delay that becomes rhythm, hand percussion and tambourine in a wash.',
    'washed-out':'The warmth: the drone, the slow tape under "sink in", soft focus, a long fade.',
    kraftwerk:'The grid under the haze: the slit drum\'s 16ths, every grain cut to the 16th and pixelated.',
  },
  story:{synergy:'Simple and a little stiff: whole-note chords on his new synth, the spine under her.', synthia:'Fluent: the soft 16th arpeggio in the second swell.'},
  breaks:{
    'river.phrases':'ten clear phrases, not two: her vocabulary is the subject (each still four bars from the next, three clear of the last, never two voices back to back)',
    'river.form':'two minutes, not one: a concept film on LinkedIn vocabulary (the chart\'s seconds, 110 to 130, are its window)',
  },
};
WANDER.band = riverBand(WANDER);

export default {
  id:'delve',
  form:'wander',
  wander:WANDER,
  title:'Delve.',
  genre:'Vocabulary psych pop',
  note:'96 BPM · E Dorian · ten phrases of hers, handed to the echo',
  blurb:'Her LinkedIn vocabulary, said once in her crisp voice, then handed to the echo until she becomes the choir. Halfway down, the stars come out.',
  bpm:BPM, step:STEP, swing:SWING, key:'E dorian',
  music:{scale:[40, 42, 43, 45, 47, 49, 50, 52, 54, 55, 57, 59, 61, 62, 64], resolve:[0, 4, 7], home:[52, 59]},
  pitchClasses:SCALE_PCS,
  chords:CHORDS,
  chordAt,
  // The river's mix: a close, dry loop; Pat under the pump; her stem carries the textures and the choir.
  mix:{stems:{drums:{reverb:.12, level:1}, bass:{duck:.6, level:.62}, keys:{duck:.75, under:.8, reverb:.3, delay:.08, level:2.1, haas:14}, guitar:{duck:.85, under:.7, reverb:.3, delay:.2, level:4.2, haas:18}, voice:{duck:.95, reverb:.2, delay:.1, level:1}, lady:{reverb:.18, delay:.06, level:1.05}},
    keysHp:120, duckRelease:.16, output:1.3},
  sound:{},
  kicksOf:WANDER.kicksOf,
  references:WANDER.references,
  palette:WANDER.palette,
  story:WANDER.story,
};
