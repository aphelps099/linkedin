// Circle Back: the original. A French-house shuffle at 120 BPM in A minor,
// Am9 · Fmaj9 · Cmaj9 · G6/9, 909 kit, offbeat saw bass, detuned saw stabs,
// Kevin's muted funk chops. Its Drop Edition is the 60.000 s film.
//
// Everything here was drop.js and engine.js before the song book; it is moved,
// not rewritten, so a Circle Back render makes exactly the calls it made then.
import {BPM, STEP, SWING, KEY, CHORDS, SCALE, PATTERNS, HOST, hatVelocity, shakerVelocity} from '../song.js';

export const DROP_BARS = 30;
export const DROP_SECTIONS = [
  {name:'Intro', from:0, to:4},
  {name:'Verse', from:4, to:12},
  {name:'Build', from:12, to:20},
  {name:'Drop A', from:20, to:23},
  {name:'Sink In', from:23, to:24},
  {name:'Drop B', from:24, to:28},
  {name:'Outro', from:28, to:30},
];
export const UNMUTE_BAR = 2;      // 4.000 s: the call audio opens on "Thanks for joining"
export const CHOKE = {bar:19, step:8};   // 39.000 s
export const IMPACT_BAR = 20;            // 40.000 s

const sectionOf = bar => DROP_SECTIONS.find(s => bar >= s.from && bar < s.to) || DROP_SECTIONS.at(-1);

// The groove tightens as the tension rises: swing .12 → 0 across the build's
// first four bars, straight through the ladder and the half-time drop, house
// shuffle again for the four-on-the-floor drop.
export function swingOf(bar) {
  if (bar >= 12 && bar < 16) return SWING * (15 - bar) / 4;
  if (bar >= 16 && bar < 24) return 0;
  return SWING;
}

// Players by bar. `drums` names the kit pattern; everything else is a flag the
// engine reads. Numbers are [start, end] of a one-bar automation.
export function dropLayers(bar) {
  const s = sectionOf(bar).name, groove = {drums:'four', kick:true, clap:true, hats:true, open:true, shaker:true, rim:false, bass:'offbeat', stabs:true, pad:false, guitar:false};
  if (s === 'Intro') return {...groove, clap:bar >= 1, open:bar >= 2, bass:bar >= 1 ? 'offbeat' : false, riser:bar === 3 ? 'short' : false};
  // The verse leaves room: open hats arrive at bar 6, the rim at 8.
  if (s === 'Verse') return {...groove, open:bar >= 6, rim:bar >= 8, holdBreath:bar === 11, light:true};
  if (s === 'Build') {
    const r = bar - 12;
    return {drums:'build', rung:r, kick:bar < 18, clap:false, hats:true, hatsStraight:bar >= 17, open:bar < 15, shaker:bar < 18, rim:false, bass:false, stabs:false, pad:true, guitar:false,
      roll:[[4, .22, .22], [4, .26, .26], [2, .30, .30], [2, .36, .36], [1, .40, .50], [1, .50, .60], [.5, .60, .75], [.5, .75, .85]][r],
      drumHp:[[30, 120], [120, 120], [120, 160], [160, 160], [160, 300], [300, 500], [500, 500], [500, 500]][r],
      riser:bar === 16 ? 'long' : false, voiceLp:bar < 16 ? 1800 : false};
  }
  if (s === 'Drop A') return {drums:'half', kick:true, clap:true, hats:true, ride:true, open:false, shaker:true, rim:bar === 22, bass:'wobble', wobble:[2, 2, 1][bar - 20], stabs:false, pad:true, guitar:false, crash:bar === 20, impact:bar === 20};
  if (s === 'Sink In') return {drums:'downbeat', kick:true, clap:false, hats:false, open:false, shaker:false, rim:false, bass:'sustain', stabs:false, pad:true, guitar:false, tape:'sink', reverseCrash:true};
  if (s === 'Drop B') return {...groove, rim:true, ride:true, pad:true, guitar:true, crash:bar === 24, fill:bar === 27};
  return {...groove, clap:bar === 28, open:bar === 28, shaker:bar === 28, bass:bar === 28 ? 'offbeat' : false, rim:false, kickUntil:bar === 29 ? 8 : 16};
}

export function dropCutoff(bar) {
  const s = sectionOf(bar).name, ramp = (a, b, i, n) => [a * (b / a) ** (i / n), a * (b / a) ** ((i + 1) / n)];
  if (s === 'Intro') return {keys:ramp(450, 3600, bar, 4), pad:[900, 900]};
  if (s === 'Build') return {keys:[2600, 2600], pad:[[600, 1200], [1200, 2000], [2000, 3000], [3000, 4200], [4200, 6000], [6000, 6000], [6000, 6000], [6000, 6000]][bar - 12]};
  if (s === 'Drop A') return {keys:[2400, 2400], pad:[700, 700]};
  if (s === 'Sink In') return {keys:[2400, 2400], pad:[1400, 500]};
  if (s === 'Outro') return {keys:ramp(3000, 420, bar - 28, 2), pad:[900, 900]};
  return {keys:[3000, 3000], pad:[1100, 1100]};
}

// Synergy's setlist for this form. Bars 12–15 are his answers to the lady.
export function dropSlots(lyrics) {
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
    // Verse 3 leaves the end of bar 25 for "Leverage"; the hook is sung once,
    // she says "Read that again.", and Synergy does exactly that.
    {bar:24, window:24, text:verses[3], kind:'verse', shape:'arch', harmony:true},
    {bar:26, window:14, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:27, startStep:8, window:8, text:hook, kind:'hook', shape:'call', harmony:true},
    // The sign-off gives way: a hook too long for its half bar (five words) runs
    // two 16ths on and lands on the downbeat, and Synergy signs off an 8th later.
    {bar:28, text:HOST.close, kind:'host', shape:'chant', give:2},
  ];
}

// The ladder climbs the pentatonic, so every rung is in key. Rungs are in
// degrees of the pentatonic above her tuned base (G3 for "Let's build.": G A
// C D E G = 0 2 5 7 9 12 semitones); a glide moves between two degrees.
// `cut` names the slice of her phrase (see drop.js ladderCuts).
export const LADDER = [
  {bar:12, hits:[0], cut:'phrase', deg:[0]},
  {bar:13, hits:[0], cut:'phrase', deg:[0]},
  {bar:14, hits:[0, 8], cut:'phrase', deg:[0, 0]},
  {bar:15, hits:[0, 8], cut:'phrase', deg:[1, 1]},
  {bar:16, hits:[0, 4, 8, 12], cut:'letsbu', deg:[1, 1, 2, 2], blend:.15},
  {bar:17, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'lets', deg:[2, 2, 3, 3, 3, 3, 4, 4], blend:.30},
  {bar:18, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'le', glide:[4, 5], blend:.45},
  {bar:19, hits:Array.from({length:16}, (_, i) => i / 2), cut:'l', glide:[5, 5], blend:.60},
];

// Section energy before the bus compressor: the drops have somewhere to go.
const ENERGY = {Intro:.46, Verse:.45, Build:.56, 'Drop A':1, 'Sink In':.85, 'Drop B':1, Outro:.55};

// The engine's stems, exactly as buildGraph() had them.
const STEM_MIX = {
  drums:{reverb:.12, level:1},
  bass:{duck:.12, level:.55},
  keys:{duck:.28, under:.6, reverb:.38, delay:.16, level:2.3, haas:16},
  guitar:{duck:.45, under:.6, reverb:.2, delay:.1, level:7, haas:18},
  voice:{duck:.88, reverb:.2, delay:.24, level:1.35},
  lady:{reverb:.16, delay:.12},
};

// ---- the band, step by step (was engine.js drums(), bassline(), stabs, chops)

function drums(api, b, bar, s, t) {
  const {ctx, I} = api, D = api.graph.drumHp, L = b.layers, style = L.drums || 'four', STEP = api.step;
  if (style === 'four') {
    const holdBreath = (L.holdBreath ?? bar === 11) && s >= 12;           // the room holds its breath
    if (L.kick && !holdBreath && PATTERNS.kick.includes(s) && s < (L.kickUntil ?? 16)) { I.kick(ctx, D, t, 1); api.duck(t); }
    if (L.clap && PATTERNS.clap.includes(s)) I.clap(ctx, D, t, .62);
    if ((L.holdBreath ?? bar === 11) && (s === 14 || s === 15)) I.clap(ctx, D, t, s === 14 ? .35 : .5);
    if (L.fill && s >= 8 && s % 2 === 0) I.clap(ctx, D, t, .3 + .04 * (s - 8));
    if (L.fill && s >= 12) I.snareRoll(ctx, D, t, .35 + .05 * (s - 12));
    if (L.roll === true) { if (s % 2 === 0 || s >= 8) I.clap(ctx, D, t, .18 + .5 * s / 15); }
    if (L.hats) {
      const breakdown = b.section === 'Breakdown';
      const v = breakdown ? (s % 2 === 0 ? .2 + .05 * (bar - 14) * 4 : 0) : hatVelocity(s);
      if (v) I.hat(ctx, D, t, v * .55);
    }
    if (L.open && PATTERNS.open.includes(s)) I.openHat(ctx, D, t, .2);
    if (L.ride && PATTERNS.open.includes(s)) I.ride(ctx, D, t, .16);
  } else if (style === 'build') {
    if (L.kick && s % 4 === 0) { I.kick(ctx, D, t, 1); api.duck(t); }
    if (L.hats) { const v = L.hatsStraight ? (s % 4 === 0 ? .3 : .2) : hatVelocity(s); if (v) I.hat(ctx, D, t, v * .55); }
    if (L.open && PATTERNS.open.includes(s)) I.openHat(ctx, D, t, .18);
    const choke = api.plan.choke?.at ?? 19 * 16 + 8, last = bar === Math.floor(choke / 16) ? choke % 16 : 16;   // the last bar stops at the choke
    const [rate, v0, v1] = L.roll;
    if (s < last) {
      const v = v0 + (v1 - v0) * s / 15, tone = 200 + 200 * L.rung / 7;
      if (rate >= 2) { if (s % rate === 0) I.clap(ctx, D, t, v); }
      else if (rate === 1) I.snareRoll(ctx, D, t, v, tone);
      else { I.snareRoll(ctx, D, t, v, tone); I.snareRoll(ctx, D, t + STEP / 2, v, tone); }
    }
  } else if (style === 'half') {
    if (s === 0 || (s === 10 && bar !== 20)) { I.kick(ctx, D, t, s ? .8 : 1); api.duck(t); }
    if (s === 8) { I.snare(ctx, D, t, .9); I.clap(ctx, D, t, .45); }
    if (L.hats) I.hat(ctx, D, t, (s % 4 === 2 ? .32 : s % 2 ? .14 : .2) * .55);
    if (L.ride && s % 4 === 2) I.ride(ctx, D, t, .2);
  } else if (style === 'downbeat') {
    if (s === 0) { I.kick(ctx, D, t, 1); api.duck(t); }
  }
  if (L.shaker) I.shaker(ctx, D, t, shakerVelocity(s) * .5);
  if (L.rim && PATTERNS.rim.includes(s)) I.rim(ctx, D, t, .16);
}

function bassline(api, b, s, t, barEnd) {
  const {ctx, I} = api, L = b.layers, chord = b.chord, out = api.graph.stems.bass.input, STEP = api.step;
  const style = L.bass === true ? 'offbeat' : L.bass;
  if (style === 'offbeat') { for (const [at, interval, length] of PATTERNS.bass) if (at === s) I.bass(ctx, out, t, chord.root + interval, length * STEP * .7, .85); }
  else if (style === 'wobble' && s === 0) I.wobble(ctx, out, t, chord.root + 12, barEnd - t, L.wobble * STEP, .78);
  else if (style === 'sustain' && s === 0) I.sustainBass(ctx, out, t, chord.root, barEnd - t, .8);
}

export const band = {
  pad(api, t, chord, length, b) { api.I.pad(api.ctx, api.graph.padFilter, t, chord.notes, length, /^Drop/.test(b.section) ? .55 : 1); },
  step(api, b, bar, s, t, T, step) {
    const {ctx, I, graph} = api, L = b.layers, chord = b.chord, STEP = api.step;
    drums(api, b, bar, s, t);
    if (L.bass) bassline(api, b, s, t, T(step + 16 - s));
    if (L.stabs) for (const [at, length, v] of PATTERNS.stabs) if (at === s) I.stab(ctx, graph.keysFilter, t, chord.notes, length * STEP * .95, v * (L.light ? .7 : b.section === 'Verse' ? .85 : 1), 2800);
    if (L.guitar) for (const [at, v] of PATTERNS.guitar) if (at === s) I.chop(ctx, graph.stems.guitar.input, t, chord.notes.slice(1).map(m => m + 12), v);
  },
};

// The steps that carry a kick in one bar, as the band above plays them (for
// the Peg Board's kick accent, eq.js kickSteps). The drop kick on an impact
// bar is added by drop.js.
export function kicksOf(bar, L) {
  const style = L.drums || 'four', out = [];
  for (let s = 0; s < 16; s++) {
    let k = false;
    if (style === 'four') k = L.kick && !((L.holdBreath ?? bar === 11) && s >= 12) && PATTERNS.kick.includes(s) && s < (L.kickUntil ?? 16);
    else if (style === 'build') k = L.kick && s % 4 === 0;
    else if (style === 'half') k = s === 0 || (s === 10 && bar !== 20);
    else if (style === 'downbeat') k = s === 0;
    if (k) out.push(s);
  }
  return out;
}

export default {
  id:'circle-back',
  title:'Circle Back',
  genre:'French house',
  note:'120 BPM · A minor · the original band',
  blurb:"French house, the original band. A 909 shuffle, an offbeat bass, Kevin's muted chops.",
  bpm:BPM, step:STEP, swing:SWING, key:KEY,
  // Synergy's melody table, the tonic-chord indexes a line resolves to, and a
  // repeated hook's home notes (A3, else E3).
  music:{scale:SCALE, resolve:[3, 5, 6], home:[57, 52]},
  // Every pitch the band may play: A natural minor.
  pitchClasses:[9, 11, 0, 2, 4, 5, 7],
  chords:CHORDS,
  chordAt:bar => CHORDS[bar % 4],
  drop:{
    bars:DROP_BARS, sections:DROP_SECTIONS, unmute:UNMUTE_BAR, choke:CHOKE, impact:IMPACT_BAR,
    rise:16,                                    // the ladder reaches quarter notes: the Peg Board brightens
    sink:23, stop:{bar:29, step:8, seconds:.4},
    swing:swingOf, layers:dropLayers, cutoff:dropCutoff, slots:dropSlots,
    answers:{bars:[14, 15], steps:[4, 12], notes:[57, 60]},
    stutter:{bar:18, notes:[57, 57, 60, 60, 62, 62, 64, 64]},
    ladder:{targets:[52, 55, 57], pentatonic:[9, 0, 2, 4, 7], rungs:LADDER},   // E3 G3 A3; A minor pentatonic
    tag:{rate:1.1},
    dark:.49,                                   // true black on the Peg Board, seconds after the choke
    impactNote:57,
    places:{
      bend:[21 * 16 + 12, 21 * 16 + 14, 22 * 16, 22 * 16 + 2, 22 * 16 + 4],
      letThat:22 * 16 + 9,
      lift:[25 * 16 + 10, 25 * 16 + 9, 25 * 16 + 11, 25 * 16 + 8],
      punct:[27 * 16, 26 * 16 + 14, 26 * 16 + 15, 27 * 16 + 1],
    },
    energy:ENERGY,
    // The verse's room for the drops (drop.js roomTrim): set on the sample post, whose shares are the references.
    room:{verse:{section:'Verse', ref:.727, k:3}, drops:{'Drop A':{ref:.458, k:8}, 'Drop B':{ref:.670, k:4}}, max:2.5},
  },
  mix:{stems:STEM_MIX},
  sound:{},
  band,
  kicksOf,
};
