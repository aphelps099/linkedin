// Humbled and Honored: a neo-soul slow jam at 92 BPM in E-flat major. Lazy
// 16th swing, a laid-back backbeat of finger snaps and a sidestick, an
// electric piano on 7th and 9th chords, a round finger bass, Kevin's clean
// double-stops. The drop is a half-time bounce on a gliding 808 that lands on
// the relative minor; the outro is the church's amen, IV to I.
//
// Drop Edition: 24 bars, 62.6 s. Intro 0-2 (the call unmutes at bar 1 on
// "Thanks for joining"), verse 2-8, the ladder 8-14 (one rate per bar: 1, 1/2,
// 1/4, 1/8, 1/16, 1/32), choke at 13:8, BACK. at bar 14, Drop A 14-17,
// Sink In 17, Drop B 18-22, outro 22-24 with "Full stop." at 23:8.
import {HOST, shakerVelocity} from '../song.js';

const BPM = 92, STEP = 60 / BPM / 4, SWING = .24;
const SCALE_PCS = [3, 5, 7, 8, 10, 0, 2];            // E-flat major
const PENTA = [3, 5, 7, 10, 0];                       // E-flat major pentatonic: Eb F G Bb C

// Voice-led so the choir's top stays on D-Eb-G. `notes` is the four-voice choir
// (and the pad), `keys` the electric piano's five-note voicing, `root` Pat's.
// Every note of the pentatonic sits on every chord (a 6th, 9th, 11th or 13th).
const CHORDS = {
  Ebmaj9:{name:'E♭maj9', root:39, notes:[55, 58, 62, 65], keys:[51, 55, 58, 62, 65], avail:PENTA},
  Cm9:{name:'Cm9', root:36, notes:[55, 58, 62, 63], keys:[48, 51, 55, 58, 62], avail:PENTA},
  Fm9:{name:'Fm9', root:41, notes:[56, 60, 63, 67], keys:[48, 51, 56, 60, 67], avail:PENTA},
  Bb13sus:{name:'B♭13sus', root:34, notes:[56, 60, 63, 67], keys:[51, 56, 60, 65, 67], avail:PENTA},
  Abmaj9:{name:'A♭maj9', root:32, notes:[55, 58, 60, 63], keys:[48, 51, 55, 58, 60], avail:PENTA},
};
const C = CHORDS;

const SECTIONS = [
  {name:'Intro', from:0, to:2},
  {name:'Verse', from:2, to:8},
  {name:'Build', from:8, to:14},
  {name:'Drop A', from:14, to:17},
  {name:'Sink In', from:17, to:18},
  {name:'Drop B', from:18, to:22},
  {name:'Outro', from:22, to:24},
];
const BARS = 24, UNMUTE = 1, CHOKE = {bar:13, step:8}, IMPACT = 14, SINK = 17;
const sectionOf = bar => SECTIONS.find(s => bar >= s.from && bar < s.to) || SECTIONS.at(-1);

// I-vi-ii-V for the meeting; IV-V lifting through the build, never resolving;
// the drop falls to the relative minor; Drop B finally comes home; amen.
function chordAt(bar) {
  const s = sectionOf(bar).name;
  if (s === 'Build') return bar % 2 ? C.Bb13sus : C.Abmaj9;
  if (s === 'Drop A') return [C.Cm9, C.Abmaj9, C.Fm9][bar - 14];
  if (s === 'Sink In') return C.Bb13sus;
  if (s === 'Outro') return bar === 22 ? C.Abmaj9 : C.Ebmaj9;
  return [C.Ebmaj9, C.Cm9, C.Fm9, C.Bb13sus][bar % 4];
}

// Lazy everywhere but the ladder: the swing straightens over the build's first
// three bars so her 16ths and 32nds sit on an even grid, then loosens again.
function swingOf(bar) {
  if (bar >= 8 && bar < 11) return SWING * (11 - bar) / 4;
  if (bar >= 11 && bar < 14) return 0;
  if (bar >= 14 && bar < 18) return .18;
  return SWING;
}

function layers(bar) {
  const s = sectionOf(bar).name;
  const groove = {drums:'pocket', kick:true, snap:true, snare:false, hats:true, shaker:false, rim:false, bass:'finger', keys:'comp', pad:false, guitar:false};
  if (s === 'Intro') return {...groove, kick:bar >= 1, hats:bar >= 1, bass:bar >= 1 ? 'finger' : false, keys:bar >= 1 ? 'comp' : 'hold'};
  // The verse leaves room: the printer and the sidestick from bar 4, Kevin with the hook.
  if (s === 'Verse') return {...groove, shaker:bar >= 4, rim:bar >= 4, guitar:bar >= 6, holdBreath:bar === 7};
  if (s === 'Build') {
    const r = bar - 8;
    return {drums:'build', rung:r, kick:bar < 12, snap:bar < 10, hats:true, hatsStraight:bar >= 11, shaker:bar < 12, rim:false, bass:bar < 10 ? 'pedal' : false, keys:'hold', pad:true, guitar:false,
      roll:[[4, .2, .24], [2, .26, .32], [2, .32, .42], [1, .42, .56], [.5, .56, .72], [.5, .72, .86]][r],
      drumHp:[[30, 90], [90, 140], [140, 220], [220, 340], [340, 500], [500, 500]][r],
      riser:bar === 11 ? 'long' : false, voiceLp:bar < 10 ? 1800 : false};
  }
  if (s === 'Drop A') return {drums:'bounce', kick:true, snare:true, snap:true, hats:true, shaker:true, rim:bar === 16, bass:'808', keys:'stab', pad:true, guitar:false, crash:bar === 14, impact:bar === 14};
  if (s === 'Sink In') return {drums:'downbeat', kick:true, snap:false, hats:false, shaker:false, rim:false, bass:'808hold', keys:'hold', pad:true, guitar:false, tape:'sink', reverseCrash:true};
  if (s === 'Drop B') return {...groove, snare:true, shaker:true, rim:true, pad:true, guitar:true, crash:bar === 18, fill:bar === 21};
  return {...groove, kickUntil:bar === 23 ? 8 : 16, hats:bar === 22, bass:bar === 22 ? 'finger' : false, keys:'hold', guitar:bar === 22};
}

function cutoff(bar) {
  const s = sectionOf(bar).name, ramp = (a, b, i, n) => [a * (b / a) ** (i / n), a * (b / a) ** ((i + 1) / n)];
  if (s === 'Intro') return {keys:ramp(700, 3200, bar, 2), pad:[900, 900]};
  if (s === 'Build') return {keys:[2400, 2400], pad:[[500, 900], [900, 1600], [1600, 2600], [2600, 4000], [4000, 6000], [6000, 6000]][bar - 8]};
  if (s === 'Drop A') return {keys:[3600, 3600], pad:[1400, 1400]};
  if (s === 'Drop B') return {keys:[4000, 4000], pad:[1500, 1500]};
  if (s === 'Sink In') return {keys:[2000, 2000], pad:[1400, 500]};
  if (s === 'Outro') return {keys:ramp(3200, 700, bar - 22, 2), pad:[900, 900]};
  return {keys:[2500, 2500], pad:[1000, 1000]};
}

// The slower song sings fewer lines: verses 0-2 and the hook.
function slots(lyrics) {
  const {hook, verses} = lyrics;
  return [
    {bar:1, window:14, text:HOST.open, kind:'host', shape:'chant'},
    {bar:2, text:verses[0], kind:'verse', shape:'rise'},
    {bar:4, text:verses[1], kind:'verse', shape:'arch'},
    {bar:6, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:8, startStep:8, window:8, text:hook, kind:'answer', shape:'chant'},
    {bar:14, startStep:4, window:28, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:18, window:24, text:verses[2], kind:'verse', shape:'arch', harmony:true},
    {bar:20, window:14, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:21, startStep:8, window:8, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:22, text:HOST.close, kind:'host', shape:'chant'},
  ];
}

// Six rungs, one rate each, in degrees of the pentatonic above her base (G3 for
// "Let's build.": G Bb C Eb F G). Each rung climbs; the last reaches the octave.
const r16 = Array.from({length:16}, (_, i) => i);
const LADDER = [
  {bar:8, hits:[0], cut:'phrase', deg:[0]},
  {bar:9, hits:[0, 8], cut:'phrase', deg:[0, 1]},
  {bar:10, hits:[0, 4, 8, 12], cut:'letsbu', deg:[1, 1, 2, 2], blend:.15},
  {bar:11, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'lets', deg:[2, 2, 2, 2, 3, 3, 3, 3], blend:.30},
  {bar:12, hits:r16, cut:'le', deg:r16.map(i => i < 8 ? 3 : 4), blend:.45},
  {bar:13, hits:r16.map(i => i / 2), cut:'l', deg:r16.map(i => i < 4 ? 4 : 5), blend:.60},
];

const ENERGY = {Intro:.48, Verse:.43, Build:.56, 'Drop A':1, 'Sink In':.85, 'Drop B':1, Outro:.55};
const STEM_MIX = {
  drums:{reverb:.16, level:1},
  bass:{duck:.55, level:.62},
  keys:{duck:.8, under:.7, reverb:.42, delay:.12, level:2.6, haas:14},
  guitar:{duck:.85, under:.65, reverb:.3, delay:.16, level:5.5, haas:18},
  voice:{duck:.92, reverb:.22, delay:.2, level:1.35},
  lady:{reverb:.2, delay:.1},
};

// ---- the band -------------------------------------------------------------------

const LATE = .018;   // the backbeat sits behind the beat
function kickPattern(bar, L) {
  if (!L.kick) return [];
  if (L.drums === 'pocket') {
    const hold = L.holdBreath ? 12 : 16, until = L.kickUntil ?? 16;
    return (bar % 2 ? [0, 7, 10] : [0, 10]).filter(s => s < hold && s < until);
  }
  if (L.drums === 'build') return [0, 4, 8, 12];
  if (L.drums === 'bounce') return (bar - 14) % 2 ? [0, 3, 10] : [0, 10, 11];
  if (L.drums === 'downbeat') return [0];
  return [];
}
const KICK = {top:150, knee:70, settle:58.27, kneeAt:.045, settleAt:.2, hold:.03, decay:.42, drive:1.4, click:.09, clickHz:1800};   // round, on B-flat 1

function drums(api, b, bar, s, t, T, step) {
  const {ctx, I, plan} = api, D = api.graph.drumHp, L = b.layers, STEP = api.step, style = L.drums;
  if (kickPattern(bar, L).includes(s)) { I.tunedKick(ctx, D, t, s === 0 ? 1 : .82, KICK); api.duck(t); }
  if (style === 'pocket') {
    const back = s === 4 || s === 12, held = L.holdBreath && s >= 12;
    if (L.snap && back && !held) I.snap(ctx, D, t + LATE, .55);
    if (L.rim && back && !held) I.rim(ctx, D, t + LATE, .12);
    if (L.snare && back && !held) I.snare(ctx, D, t + LATE, .62);
    if (L.rim && s === 15) I.rim(ctx, D, t, .06);                        // a ghost into the bar
    if (L.holdBreath && s >= 12) I.snap(ctx, D, t, .2 + .1 * (s - 12));  // the band leans in
    if (L.hats && !held) { const v = s % 4 === 0 ? .3 : s % 2 === 0 ? .22 : s % 8 === 3 ? .11 : 0; if (v) I.hat(ctx, D, t, v * (L.snare ? .7 : .5), .04); }
    if (L.snare && s === 14) I.openHat(ctx, D, t, .12);
    if (L.fill && s >= 12) I.snareRoll(ctx, D, t, .28 + .05 * (s - 12), 260);
  } else if (style === 'build') {
    if (L.snap && (s === 4 || s === 12)) I.snap(ctx, D, t + LATE, .45);
    if (L.hats) { const v = L.hatsStraight ? (s % 4 === 0 ? .3 : .2) : s % 2 === 0 ? .24 : 0; if (v) I.hat(ctx, D, t, v * .5); }
    const chokeBar = Math.floor(plan.choke.at / 16), last = bar === chokeBar ? plan.choke.at % 16 : 16;
    const [rate, v0, v1] = L.roll;
    if (s < last) {
      const v = v0 + (v1 - v0) * s / 15, tone = 220 + 200 * L.rung / 5;
      if (rate >= 2) { if (s % rate === 0) I.snap(ctx, D, t, v * 1.3); }
      else if (rate === 1) I.snareRoll(ctx, D, t, v, tone);
      else { I.snareRoll(ctx, D, t, v, tone); I.snareRoll(ctx, D, t + STEP / 2, v, tone); }
    }
  } else if (style === 'bounce') {
    if (s === 8) { I.snare(ctx, D, t + LATE, .85); I.snap(ctx, D, t + LATE, .5); I.clap(ctx, D, t + LATE, .3); }
    if (L.hats) {
      I.hat(ctx, D, t, [.3, .12, .2, .12][s % 4] * .7, .035);
      if (s === 6) I.openHat(ctx, D, t, .13);
      if (s === 14 || s === 15) I.hat(ctx, D, t + STEP / 2, .14, .03);  // the roll into the next bar
    }
    if (L.rim && (s === 6 || s === 14)) I.rim(ctx, D, t, .1);
  }
  if (L.shaker) I.shaker(ctx, D, t, shakerVelocity(s) * .32);
}

function bass(api, b, bar, s, t, T, step) {
  const {ctx, I} = api, L = b.layers, root = b.chord.root, out = api.graph.stems.bass.input, STEP = api.step;
  if (L.bass === 'finger') {
    const line = bar % 2 ? [[0, 0, 4], [6, 7, 2], [10, 0, 3], [14, 12, 1], [15, 7, 1]] : [[0, 0, 5], [7, 7, 2], [10, 0, 4], [14, 12, 2]];
    for (const [at, interval, length] of line) if (at === s) I.fingerBass(ctx, out, t, root + interval, T(step + length) - t - .02, .8);
  } else if (L.bass === 'pedal' && s === 0) I.fingerBass(ctx, out, t, root, T(step + 16) - t - .02, .7);
  else if (L.bass === '808') {
    const prev = api.plan.bars[bar - 1]?.chord.root ?? root;
    if (s === 0) I.sub808(ctx, out, t, root, T(step + 8) - t, .85, {from:bar > 14 ? prev : undefined});
    if (s === 10) I.sub808(ctx, out, t, root, T(step + 3) - t, .7);
    if (s === 13) I.sub808(ctx, out, t, root + 12, T(step + 3) - t, .55, {from:root});
  } else if (L.bass === '808hold' && s === 0) I.sub808(ctx, out, t, root, T(step + 16) - t, .85, {from:api.plan.bars[bar - 1]?.chord.root});
}

function keys(api, b, bar, s, t, T, step) {
  const {ctx, I, graph} = api, L = b.layers, voicing = b.chord.keys;
  const parts = {comp:[[0, 5, .8], [6, 2, .55], [10, 3, .7], [14, 2, .5]], hold:[[0, 16, .7]], stab:[[0, 3, .9], [6, 2, .65], [11, 4, .8]]}[L.keys];
  if (parts) for (const [at, length, v] of parts) if (at === s) I.rhodes(ctx, graph.keysFilter, t, voicing, T(step + length) - t - .03, v);
}

// Kevin: a double-stop on the "and" of two, and every other bar a falling fill.
function guitar(api, b, bar, s, t) {
  const {ctx, I, graph} = api, n = b.chord.notes.map(m => m + 12);
  const busy = b.section === 'Drop B';
  if (s === 6 || (busy && s === 14 && !(bar % 2))) I.cleanGuitar(ctx, graph.stems.guitar.input, t, [n[1], n[3]], .5, {strum:.01, ring:.5});
  if (bar % 2 && s >= 12 && s <= 14) I.cleanGuitar(ctx, graph.stems.guitar.input, t, [n[3 - (s - 12)]], .45, {ring:.32});
  if (busy && (s === 3 || s === 11)) I.cleanGuitar(ctx, graph.stems.guitar.input, t, [n[2]], .32, {ring:.22});
}

const band = {
  pad(api, t, chord, length, b) { api.I.pad(api.ctx, api.graph.padFilter, t, chord.notes, length, /^Drop/.test(b.section) ? .45 : .8); },
  step(api, b, bar, s, t, T, step) {
    const L = b.layers;
    drums(api, b, bar, s, t, T, step);
    if (L.bass) bass(api, b, bar, s, t, T, step);
    if (L.keys) keys(api, b, bar, s, t, T, step);
    if (L.guitar) guitar(api, b, bar, s, t);
  },
};

export default {
  id:'humbled-and-honored',
  title:'Humbled and Honored',
  genre:'Neo-soul slow jam',
  note:'92 BPM · E-flat major · a slow jam with a half-time bounce',
  blurb:"Neo-soul. Finger snaps a hair behind the beat, an electric piano on ninths, a half-time bounce for the drop.",
  bpm:BPM, step:STEP, swing:SWING, key:'E-flat major',
  music:{scale:[46, 48, 51, 53, 55, 58, 60, 63, 65], resolve:[4, 5, 7], home:[58, 51]},
  pitchClasses:SCALE_PCS,
  chords:CHORDS,
  chordAt,
  drop:{
    bars:BARS, sections:SECTIONS, unmute:UNMUTE, choke:CHOKE, impact:IMPACT, rise:10, sink:SINK, stop:{bar:23, step:8, seconds:.45},
    swing:swingOf, layers, cutoff, slots,
    answers:{bars:[9], steps:[4, 12], notes:[55, 58]},
    stutter:{bar:11, notes:[55, 55, 58, 58, 60, 60, 63, 63]},
    ladder:{targets:[51, 53, 55, 58], pentatonic:PENTA, rungs:LADDER},
    tag:{tune:true, rate:1.1, range:[.96, 1.16], silence:.47},
    tuneComb:true,
    impactNote:60,
    places:{
      bend:[15 * 16 + 12, 15 * 16 + 14, 16 * 16, 16 * 16 + 2, 16 * 16 + 4],
      letThat:16 * 16 + 9,
      lift:[19 * 16 + 10, 19 * 16 + 9, 19 * 16 + 11, 19 * 16 + 8],
      punct:[21 * 16, 20 * 16 + 14, 20 * 16 + 15, 21 * 16 + 1],
    },
    energy:ENERGY,
  },
  mix:{stems:STEM_MIX, room:[3.2, 2.6], keysHp:110, duckRelease:.12},
  // BACK. lands on C minor: the drop kick settles on C2, the sub falls C3 to C1,
  // the build's saw riser climbs to the dominant.
  sound:{dropKick:{top:220, knee:72, settle:65.41}, subDrop:{from:130.81, to:32.7}, sawRiser:[58, 82]},
  band,
  kicksOf:kickPattern,
};
