// Hustle: UK garage at 130 BPM in F minor. A shuffled 2-step kit (kick on one
// and the "and" of three, snare and clap on two and four, skipping hats, open
// hats on the off-beats), a speed-garage reese bass that jumps octaves, house
// organ stabs, and in Drop B four-on-the-floor with a sidechain that pumps the
// whole band.
//
// Drop Edition: 32 bars, 59.1 s. Intro 0-4 (the call unmutes at bar 2), verse
// 4-12, the ladder 12-20 (1, 1, 1/2, 1/2, 1/4, 1/8, 1/16, 1/32 bar), choke at
// 19:6 so her tag keeps half a second of silence after it at this tempo,
// BACK. at bar 20, Drop A 20-23 (the 2-step bass drop), Sink In 23, Drop B
// 24-28 (four-on-the-floor), outro 28-32: the hook once more, then
// "Let's circle back" and "Full stop." at 31:8.
import {HOST, shakerVelocity} from '../song.js';

const BPM = 130, STEP = 60 / BPM / 4, SWING = .2;
const SCALE_PCS = [5, 7, 8, 10, 0, 1, 3];             // F natural minor
const PENTA = [5, 8, 10, 0, 3];                        // F minor pentatonic: F Ab Bb C Eb
const NO_FOURTH = [5, 10, 0, 3];                       // over E-flat and C minor, A-flat is the clash

// i - VI - VII - v. `notes` is the choir and the organ's voicing, `root` Pat's.
const CHORDS = {
  Fm9:{name:'Fm9', root:41, notes:[56, 60, 63, 67], avail:PENTA},
  Dbmaj9:{name:'D♭maj9', root:37, notes:[53, 56, 60, 63], avail:PENTA},
  Eb69:{name:'E♭6/9', root:39, notes:[55, 58, 60, 65], avail:NO_FOURTH},
  Cm11:{name:'Cm11', root:36, notes:[55, 58, 63, 65], avail:NO_FOURTH},
  Bbm9:{name:'B♭m9', root:34, notes:[56, 60, 61, 65], avail:PENTA},
};
const C = CHORDS;

const SECTIONS = [
  {name:'Intro', from:0, to:4},
  {name:'Verse', from:4, to:12},
  {name:'Build', from:12, to:20},
  {name:'Drop A', from:20, to:23},
  {name:'Sink In', from:23, to:24},
  {name:'Drop B', from:24, to:28},
  {name:'Outro', from:28, to:32},
];
const BARS = 32, UNMUTE = 2, CHOKE = {bar:19, step:6}, IMPACT = 20, SINK = 23;
const sectionOf = bar => SECTIONS.find(s => bar >= s.from && bar < s.to) || SECTIONS.at(-1);

// The build rocks VI-iv under her ladder (every rung is a chord tone or a 9th,
// 11th or 13th of both), then one bar of VII, and the drop lands on i.
function chordAt(bar) {
  const s = sectionOf(bar).name;
  if (s === 'Build') return bar === 19 ? C.Eb69 : bar % 2 ? C.Bbm9 : C.Dbmaj9;
  if (s === 'Drop A') return [C.Fm9, C.Dbmaj9, C.Eb69][bar - 20];
  if (s === 'Sink In') return C.Cm11;
  if (s === 'Outro' && bar === 31) return C.Fm9;
  return [C.Fm9, C.Dbmaj9, C.Eb69, C.Cm11][bar % 4];
}

function swingOf(bar) {
  if (bar >= 12 && bar < 16) return SWING * (15 - bar) / 4;
  if (bar >= 16 && bar < 20) return 0;                 // the ladder: straight 16ths and 32nds
  if (bar >= 24 && bar < 28) return .14;               // four-on-the-floor shuffles tighter
  return SWING;
}

function layers(bar) {
  const s = sectionOf(bar).name;
  const step2 = {drums:'twostep', kick:true, snare:true, hats:true, open:true, shaker:true, rim:false, bass:'twostep', keys:'organ', pad:false, guitar:false};
  // The call carries 300-3400 Hz: the organ and the snare are what a muted room hears.
  if (s === 'Intro') return {...step2, open:bar >= 2, shaker:bar >= 2, bass:bar >= 2 ? 'twostep' : false, keys:'organ', riser:bar === 3 ? 'short' : false};
  if (s === 'Verse') return {...step2, rim:bar >= 8, keys:bar >= 8 ? 'organ2' : 'organ', guitar:bar >= 8, holdBreath:bar === 11, light:true};
  if (s === 'Build') {
    const r = bar - 12;
    return {drums:'build', rung:r, kick:bar < 18, snare:false, hats:true, hatsStraight:bar >= 17, open:bar < 15, shaker:bar < 18, rim:false, bass:false, keys:false, pad:true, guitar:false,
      roll:[[4, .22, .22], [4, .26, .26], [2, .30, .30], [2, .36, .36], [1, .40, .50], [1, .50, .60], [.5, .60, .75], [.5, .75, .85]][r],
      drumHp:[[30, 120], [120, 120], [120, 160], [160, 160], [160, 300], [300, 500], [500, 500], [500, 500]][r],
      riser:bar === 16 ? 'long' : false, voiceLp:bar < 16 ? 1800 : false};
  }
  if (s === 'Drop A') return {...step2, rim:true, bass:'drop', keys:'riff', pad:true, guitar:true, loud:true, crash:bar === 20, impact:bar === 20};
  if (s === 'Sink In') return {drums:'downbeat', kick:true, snare:false, hats:false, open:false, shaker:false, rim:false, bass:'sustain', keys:false, pad:true, guitar:false, tape:'sink', reverseCrash:true};
  if (s === 'Drop B') return {drums:'four', kick:true, snare:true, hats:true, open:true, shaker:true, rim:true, bass:'offbeat', keys:'offbeat', pad:true, guitar:true, pump:true, crash:bar === 24, fill:bar === 27};
  if (bar < 30) return {drums:'four', kick:true, snare:bar === 28, hats:true, open:true, shaker:true, rim:false, bass:'offbeat', keys:bar === 28 ? 'offbeat' : 'organ', pad:false, guitar:bar === 28, pump:true};
  return {...step2, snare:bar === 30, open:bar === 30, shaker:false, keys:false, bass:bar === 30 ? 'twostep' : 'last', kickUntil:bar === 31 ? 8 : 16};
}

function cutoff(bar) {
  const s = sectionOf(bar).name, ramp = (a, b, i, n) => [a * (b / a) ** (i / n), a * (b / a) ** ((i + 1) / n)];
  if (s === 'Intro') return {keys:ramp(500, 3800, bar, 4), pad:[900, 900]};
  if (s === 'Build') return {keys:[2600, 2600], pad:[[600, 1200], [1200, 2000], [2000, 3000], [3000, 4200], [4200, 6000], [6000, 6000], [6000, 6000], [6000, 6000]][bar - 12]};
  if (s === 'Drop A') return {keys:[5200, 5200], pad:[2600, 2600]};
  if (s === 'Verse') return {keys:[2800, 2800], pad:[1100, 1100]};
  if (s === 'Sink In') return {keys:[2200, 2200], pad:[1400, 500]};
  if (s === 'Outro') return {keys:ramp(4200, 600, bar - 28, 4), pad:[900, 900]};
  return {keys:[4200, 4200], pad:[1100, 1100]};
}

function slots(lyrics) {
  const {hook, verses} = lyrics;
  return [
    {bar:2, text:HOST.open, kind:'host', shape:'chant'},
    {bar:4, text:verses[0], kind:'verse', shape:'rise'},
    {bar:6, text:verses[1], kind:'verse', shape:'arch'},
    {bar:8, text:hook, kind:'hook', shape:'call'},
    {bar:10, text:verses[2], kind:'verse', shape:'rise', harmony:true},
    {bar:12, startStep:8, window:8, text:hook, kind:'answer', shape:'chant'},
    {bar:13, startStep:8, window:8, text:hook, kind:'answer', shape:'chant'},
    {bar:20, startStep:4, window:28, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:24, window:24, text:verses[3], kind:'verse', shape:'arch', harmony:true},
    {bar:26, window:14, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:27, startStep:8, window:8, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:28, text:hook, kind:'hook', shape:'call'},
    {bar:30, text:HOST.close, kind:'host', shape:'chant'},
  ];
}

// Degrees of F minor pentatonic above her base (F3 for "Let's build.": F Ab Bb C Eb F).
const r16 = Array.from({length:16}, (_, i) => i);
const LADDER = [
  {bar:12, hits:[0], cut:'phrase', deg:[0]},
  {bar:13, hits:[0], cut:'phrase', deg:[0]},
  {bar:14, hits:[0, 8], cut:'phrase', deg:[0, 0]},
  {bar:15, hits:[0, 8], cut:'phrase', deg:[1, 1]},
  {bar:16, hits:[0, 4, 8, 12], cut:'letsbu', deg:[1, 1, 2, 2], blend:.15},
  {bar:17, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'lets', deg:[2, 2, 3, 3, 3, 3, 4, 4], blend:.30},
  {bar:18, hits:r16, cut:'le', deg:r16.map(i => i < 8 ? 4 : 5), blend:.45},
  {bar:19, hits:Array.from({length:12}, (_, i) => i / 2), cut:'l', deg:Array(12).fill(5), blend:.60},
];

const ENERGY = {Intro:.43, Verse:.4, Build:.54, 'Drop A':1, 'Sink In':.85, 'Drop B':.88, Outro:.56};
const STEM_MIX = {
  drums:{reverb:.1, level:1},
  bass:{duck:.3, level:.5},
  keys:{duck:.45, under:.6, reverb:.36, delay:.14, level:2.4, haas:20},
  guitar:{duck:.45, under:.6, reverb:.18, delay:.1, level:7, haas:18},
  voice:{duck:.88, reverb:.18, delay:.22, level:1.35},
  lady:{reverb:.14, delay:.1},
};
// Drop B pumps: the kick pulls bass and keys right down and lets them breathe back.
const PUMP = {bass:.08, keys:.2, guitar:.35};
// Drop A: the bass gives way to the kick, the riff and the chops do not.
const DROP_A = {bass:.3, keys:.85, guitar:.85};

// ---- the band -------------------------------------------------------------------

// Seconds from step to step + length (a length may end on a 32nd).
const span = (api, T, step, length) => T(step + Math.floor(length)) - T(step) + (length % 1) * api.step;

function kickPattern(bar, L) {
  if (!L.kick) return [];
  const until = L.kickUntil ?? 16;
  if (L.drums === 'twostep') return (L.holdBreath ? [0, 10].filter(s => s < 12) : bar % 2 ? [0, 3, 10] : [0, 10]).filter(s => s < until);
  if (L.drums === 'four' || L.drums === 'build') return [0, 4, 8, 12].filter(s => s < until);
  if (L.drums === 'downbeat') return [0];
  return [];
}
const KICK = {top:230, knee:76, settle:65.41, kneeAt:.04, settleAt:.18, hold:.035, decay:.3, drive:2, click:.22, clickHz:3000};   // tight, on C2

function drums(api, b, bar, s, t, T, step) {
  const {ctx, I, plan} = api, D = api.graph.drumHp, L = b.layers, STEP = api.step, style = L.drums;
  if (kickPattern(bar, L).includes(s)) { I.tunedKick(ctx, D, t, 1, KICK); L.pump ? api.duck(t, PUMP, .11) : L.loud ? api.duck(t, DROP_A) : api.duck(t); }
  if (style === 'twostep') {
    const held = L.holdBreath && s >= 12;
    if (L.snare && (s === 4 || s === 12) && !held) { I.snare(ctx, D, t, .5); I.clap(ctx, D, t, L.loud ? .58 : .42); }
    if (L.snare && bar % 2 && (s === 7 || s === 15)) I.snare(ctx, D, t, s === 15 ? .16 : .1);   // ghosts
    if (L.holdBreath && (s === 14 || s === 15)) I.clap(ctx, D, t, s === 14 ? .35 : .5);
    if (L.hats && !held && s % 4 !== 2) I.hat(ctx, D, t, [.28, .16, 0, .22][s % 4] * (L.loud ? .75 : .5));
    if (L.open && s % 4 === 2 && !held) I.openHat(ctx, D, t, L.loud ? .26 : .16);
    if (L.rim && (s === 3 || s === 11)) I.rim(ctx, D, t, .12);
  } else if (style === 'four') {
    if (L.snare && (s === 4 || s === 12)) { I.clap(ctx, D, t, .6); I.snare(ctx, D, t, .3); }
    if (L.hats) I.hat(ctx, D, t, [.3, .16, .24, .2][s % 4] * .55);
    if (L.open && s % 4 === 2) I.openHat(ctx, D, t, .2);
    if (L.rim && (s === 3 || s === 11)) I.rim(ctx, D, t, .12);
    if (L.fill && s >= 8 && s % 2 === 0) I.clap(ctx, D, t, .3 + .04 * (s - 8));
    if (L.fill && s >= 12) I.snareRoll(ctx, D, t, .35 + .05 * (s - 12));
  } else if (style === 'build') {
    if (L.hats) { const v = L.hatsStraight ? (s % 4 === 0 ? .3 : .2) : [.28, .16, 0, .22][s % 4]; if (v) I.hat(ctx, D, t, v * .55); }
    if (L.open && s % 4 === 2) I.openHat(ctx, D, t, .16);
    const chokeBar = Math.floor(plan.choke.at / 16), last = bar === chokeBar ? plan.choke.at % 16 : 16;
    const [rate, v0, v1] = L.roll;
    if (s < last) {
      const v = v0 + (v1 - v0) * s / 15, tone = 200 + 200 * L.rung / 7;
      if (rate >= 2) { if (s % rate === 0) I.clap(ctx, D, t, v); }
      else if (rate === 1) I.snareRoll(ctx, D, t, v, tone);
      else { I.snareRoll(ctx, D, t, v, tone); I.snareRoll(ctx, D, t + STEP / 2, v, tone); }
    }
  }
  if (L.shaker) I.shaker(ctx, D, t, shakerVelocity(s) * .45);
}

// Pat: the root low on the one when it is the tonic, then octaves and fifths.
function bass(api, b, bar, s, t, T, step) {
  const {ctx, I} = api, L = b.layers, root = b.chord.root, out = api.graph.stems.bass.input, low = root >= 40 ? root - 12 : root;
  const note = (interval, length, v, tone) => I.reese(ctx, out, t, interval === 'low' ? low : root + interval, span(api, T, step, length) - .015, v, tone);
  if (L.bass === 'twostep' || L.bass === 'drop') {
    const tone = {cutoff:360, open:3, q:2.5};
    const line = bar % 2 ? [[0, 'low', 2], [2, 0, 1], [6, 12, 1], [7, 0, 2], [10, 7, 2], [13, 12, 1], [14, 0, 2]]
      : [[0, 'low', 3], [3, 0, 1], [6, 12, 1], [7, 0, 2], [10, 0, 3], [14, 12, 2]];
    // Drop A: every note sweeps its filter open and shut, the speed-garage growl
    // that carries the bass line to a phone speaker.
    for (const [at, interval, length] of line) if (at === s) {
      if (L.bass === 'drop') I.wobble(ctx, out, t, interval === 'low' ? low + 12 : root + interval, span(api, T, step, length) - .015, Math.min(2, length) * api.step, .5);
      else note(interval, length, .75, tone);
    }
  } else if (L.bass === 'offbeat') {
    for (const [at, interval] of [[2, 0], [6, 0], [10, 0], [14, 12]]) if (at === s) note(interval, 1.5, .8, {cutoff:520, open:3.5, q:3});
  } else if (L.bass === 'sustain' && s === 0) I.reese(ctx, out, t, low, T(step + 16) - t, .75, {cutoff:300, open:2, q:2});
  else if (L.bass === 'last' && s === 0) I.reese(ctx, out, t, low, T(step + 8) - t, .75, {cutoff:420, open:3, q:2.5});
}

function keys(api, b, bar, s, t, T, step) {
  const {ctx, I, graph} = api, L = b.layers;
  const parts = {organ:[[3, 1, .65], [10, 1.5, .75]], organ2:[[2, 1, .8], [5, 1, .65], [10, 1.5, .85], [13, 1, .65]],
    riff:[[0, 2, .9], [3, 1, .7], [6, 1.5, .85], [10, 2, .9], [13, 1.5, .75]], offbeat:[[2, 1.5, .9], [6, 1.5, .8], [10, 1.5, .9], [14, 1.5, .8]]}[L.keys];
  // In Drop A the riff jumps an octave, above the growl: on a phone it is the drop.
  const voicing = L.keys === 'riff' ? b.chord.notes.map(m => m + 12) : b.chord.notes;
  if (parts) for (const [at, length, v] of parts) if (at === s) I.organ(ctx, graph.keysFilter, t, voicing, span(api, T, step, length) - .01, v * (L.light ? .72 : L.loud ? 1.35 : 1));
}

// Kevin: muted chops answering the snare, a pickup every other bar.
function guitar(api, b, bar, s, t) {
  const {ctx, I, graph} = api, notes = b.chord.notes.slice(1).map(m => m + 12);
  if (s === 5 || s === 13 || (bar % 2 && s === 15)) I.chop(ctx, graph.stems.guitar.input, t, notes, s === 15 ? .5 : .7);
}

const band = {
  pad(api, t, chord, length, b) { api.I.pad(api.ctx, api.graph.padFilter, t, chord.notes, length, /^Drop/.test(b.section) ? .5 : 1); },
  step(api, b, bar, s, t, T, step) {
    const L = b.layers;
    drums(api, b, bar, s, t, T, step);
    if (L.bass) bass(api, b, bar, s, t, T, step);
    if (L.keys) keys(api, b, bar, s, t, T, step);
    if (L.guitar) guitar(api, b, bar, s, t);
  },
};

export default {
  id:'hustle',
  title:'Hustle',
  genre:'UK garage',
  note:'130 BPM · F minor · 2-step into four-on-the-floor',
  blurb:"UK garage. A 2-step shuffle and house organ, then four to the floor with a sidechain that breathes.",
  bpm:BPM, step:STEP, swing:SWING, key:'F minor',
  music:{scale:[44, 46, 48, 51, 53, 56, 58, 60, 63], resolve:[4, 5, 7], home:[53, 48]},
  pitchClasses:SCALE_PCS,
  chords:CHORDS,
  chordAt,
  drop:{
    bars:BARS, sections:SECTIONS, unmute:UNMUTE, choke:CHOKE, impact:IMPACT, rise:16, sink:SINK, stop:{bar:31, step:8, seconds:.4},
    swing:swingOf, layers, cutoff, slots,
    answers:{bars:[14, 15], steps:[4, 12], notes:[53, 58]},
    stutter:{bar:17, notes:[53, 53, 58, 58, 60, 60, 63, 63]},
    ladder:{targets:[51, 53, 56, 58], pentatonic:PENTA, rungs:LADDER},
    tag:{tune:true, rate:1.1, range:[.96, 1.16], silence:.47},
    tuneComb:true,
    impactNote:53,
    places:{
      bend:[21 * 16 + 12, 21 * 16 + 14, 22 * 16, 22 * 16 + 2, 22 * 16 + 4],
      letThat:22 * 16 + 9,
      lift:[25 * 16 + 10, 25 * 16 + 9, 25 * 16 + 11, 25 * 16 + 8],
      punct:[27 * 16, 26 * 16 + 14, 26 * 16 + 15, 27 * 16 + 1],
    },
    energy:ENERGY,
  },
  mix:{stems:STEM_MIX, duckRelease:.09, output:1.3},
  // BACK. lands on F minor: the drop kick settles on F1, the sub falls F2 to F0.
  sound:{dropKick:{top:240, knee:56, settle:43.65}, subDrop:{from:87.31, to:21.83}, sawRiser:[53, 77]},
  band,
  kicksOf:kickPattern,
};
