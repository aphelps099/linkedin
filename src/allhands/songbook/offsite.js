// Offsite: the team retreat, in the Panda Bear lane of the constitution (the
// sound and approach of the Person Pitch era, never its songs). Voices are the
// instrument: the lady's phrases and Synergy's vocoder stacked into rounds and
// a two-beat canon, washed in long reverb; hands and floors for drums (claps,
// stomps, floor toms, desk slaps, the printer); the office as loop material
// (keyboard clatter, a mug, a chair, the room); one drone swaying between two
// chords, D major, bright. 108 BPM, a light swing.
//
// Drop Edition: 27 bars, 60.0 s. Intro 0-3 (the call unmutes at bar 2 on
// "Thanks for joining"), verse 3-9, her ladder 9-15 as a round of overlapping
// voices that tightens toward the choke (1, 1/2, 1/4, 1/8, 1/16, 1/32 bar),
// the choke in bar 14, BACK. at bar 15 as a bloom of voices on a stomp (no bass
// slam), Drop A 15-18 (clap and chant), Sink In 18 (under water: half speed,
// an octave down, a wow), Drop B 19-23 (a wall of voices), outro 23-27 with
// "Full stop." at 26:8 over the tape stop.
import {HOST, shakerVelocity} from '../song.js';
import {pitchOf} from '../drop.js';

const BPM = 108, STEP = 60 / BPM / 4, SWING = .08;
const SCALE_PCS = [2, 4, 6, 7, 9, 11, 1];            // D major
const PENTA = [2, 4, 6, 9, 11];                       // D major pentatonic: D E F# A B

// I and IV, and nothing else. Every note of the pentatonic sits on both (a 6th
// or a 9th at most). `notes` is the four-voice choir and the wordless pad,
// `keys` the pump organ's five-note voicing, `root` Pat's.
const CHORDS = {
  Dadd9:{name:'Dadd9', root:38, notes:[54, 57, 62, 64], keys:[50, 54, 57, 62, 64], avail:PENTA},
  G69:{name:'G6/9', root:43, notes:[55, 59, 62, 64], keys:[50, 55, 59, 64, 69], avail:PENTA},
};
const C = CHORDS;

const SECTIONS = [
  {name:'Intro', from:0, to:3},
  {name:'Verse', from:3, to:9},
  {name:'Build', from:9, to:15},
  {name:'Drop A', from:15, to:18},
  {name:'Sink In', from:18, to:19},
  {name:'Drop B', from:19, to:23},
  {name:'Outro', from:23, to:27},
];
const BARS = 27, UNMUTE = 2, CHOKE = {bar:14, step:8}, IMPACT = 15, SINK = 18, LET_THAT = 17 * 16 + 9;
const sectionOf = bar => SECTIONS.find(s => bar >= s.from && bar < s.to) || SECTIONS.at(-1);

// The drone: two bars of I, two of IV in the verse; the build and the drops
// sway a bar each; the build ends on IV, so BACK. comes home to I.
function chordAt(bar) {
  const s = sectionOf(bar).name;
  if (s === 'Intro') return C.Dadd9;
  if (s === 'Verse') return (bar - 3) % 4 < 2 ? C.Dadd9 : C.G69;
  if (s === 'Build') return (bar - 9) % 2 ? C.G69 : C.Dadd9;
  if (s === 'Sink In') return C.G69;
  if (s === 'Outro') return bar === 24 ? C.G69 : C.Dadd9;
  return (bar - (s === 'Drop A' ? 15 : 19)) % 2 ? C.G69 : C.Dadd9;
}

// A light lilt; the build straightens it so her 8ths, 16ths and 32nds sit even.
function swingOf(bar) {
  if (bar >= 9 && bar < 11) return SWING * (11 - bar) / 3;
  if (bar >= 11 && bar < 15) return 0;
  return SWING;
}

// drums: 'four' tells the video studio the claps land on two and four (edl/params.js
// backbeatHits); 'build' and 'downbeat' as in every track. The groove itself is `groove`.
function layers(bar) {
  const s = sectionOf(bar).name;
  const base = {drums:'four', groove:'verse', kick:true, clap:true, toms:true, shaker:true, bass:'pedal', keys:'drone', pad:true, vowel:'oo', guitar:false, typing:0, mug:false};
  // The muted call: someone typing with the mic on, the printer, the room; the drone faintly.
  if (s === 'Intro') return {...base, groove:bar < 2 ? 'call' : 'arrive', kick:bar >= 2, clap:bar >= 2, toms:false, shaker:bar >= 1, bass:bar >= 2 ? 'pedal' : false, pad:bar >= 1, typing:bar < 2 ? .9 : .35, mug:bar === 1, room:true};
  // The verse stays close and dry: Synergy over the drone, soft hands, the keyboard as the hats.
  if (s === 'Verse') return {...base, guitar:bar >= 5, typing:.4, mug:bar % 2 === 0, light:true, lean:bar === 8};
  if (s === 'Build') {
    const r = bar - 9;
    return {drums:'build', groove:'build', rung:r, kick:bar < 13, clap:false, toms:bar >= 12, shaker:bar < 13, bass:bar < 11 ? 'pedal' : false, keys:'drone', pad:true, vowel:'oo', guitar:bar < 11, typing:0,
      roll:[[4, .2, .26], [2, .26, .34], [2, .32, .42], [1, .42, .56], [.5, .56, .72], [.5, .72, .86]][r],
      drumHp:[[30, 90], [90, 140], [140, 220], [220, 340], [340, 500], [500, 500]][r], rise:bar >= 12, voiceLp:bar < 11 ? 1800 : false};
  }
  if (s === 'Drop A') return {...base, groove:'chant', bass:'walk', pad:true, vowel:'ah', guitar:true, loud:true, impact:bar === IMPACT, chant:bar > IMPACT};
  if (s === 'Sink In') return {drums:'downbeat', groove:'sink', kick:true, clap:false, toms:true, shaker:false, bass:'hold', keys:'drone', pad:true, vowel:'oo', guitar:false, tape:'sink', swell:true};
  if (s === 'Drop B') return {...base, groove:'wall', bass:'walk', pad:true, vowel:'ah', guitar:true, loud:true, chant:true, fill:bar === 22};
  // The outro: the round winds down and the office comes back.
  return {...base, groove:bar < 25 ? 'chant' : 'leave', bass:bar < 26 ? 'pedal' : 'last', vowel:bar < 25 ? 'ah' : 'oo', guitar:bar < 25, toms:bar < 25, typing:bar >= 25 ? .55 : 0, mug:bar === 26, kickUntil:bar === 26 ? 8 : 16, room:bar >= 25};
}

function cutoff(bar) {
  const s = sectionOf(bar).name, ramp = (a, b, i, n) => [a * (b / a) ** (i / n), a * (b / a) ** ((i + 1) / n)];
  if (s === 'Intro') return {keys:ramp(500, 3200, bar, 3), pad:[900, 900]};
  if (s === 'Build') return {keys:[2400, 2400], pad:[[700, 1100], [1100, 1700], [1700, 2500], [2500, 3500], [3500, 5000], [5000, 6000]][bar - 9]};
  if (s === 'Drop A') return {keys:[4200, 4200], pad:[3800, 3800]};
  if (s === 'Drop B') return {keys:[4800, 4800], pad:[4600, 4600]};
  if (s === 'Sink In') return {keys:[2000, 2000], pad:[1800, 600]};
  if (s === 'Outro') return {keys:ramp(3600, 500, bar - 23, 4), pad:[1600, 1600]};
  return {keys:[2200, 2200], pad:[1300, 1300]};
}

// Chant-like lines: the hook repeats on repeated notes, the drops carry the choir.
function slots(lyrics) {
  const {hook, verses} = lyrics;
  return [
    {bar:2, window:14, text:HOST.open, kind:'host', shape:'chant'},
    {bar:3, text:verses[0], kind:'verse', shape:'rise'},
    {bar:5, text:verses[1], kind:'verse', shape:'arch'},
    {bar:7, text:hook, kind:'hook', shape:'chant', harmony:true},
    {bar:15, startStep:4, window:28, text:hook, kind:'hook', shape:'chant', harmony:true},
    {bar:19, window:24, text:verses[2], kind:'verse', shape:'arch', harmony:true},
    // At 108 BPM "Read that again." needs eight 16ths with its guard: the hook
    // gives up four, she says it from 21:13, and Synergy reads it again at 22:8.
    {bar:21, window:12, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:22, startStep:8, window:8, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:23, text:hook, kind:'hook', shape:'chant', harmony:true},
    {bar:25, text:HOST.close, kind:'host', shape:'chant', give:2},
  ];
}

// Six rungs, one rate a bar, in degrees of the pentatonic above her base (F#3
// for "Let's build.": F# A B D E F#). Each rung climbs; the last reaches the octave.
const r16 = Array.from({length:16}, (_, i) => i);
const LADDER = [
  {bar:9, hits:[0], cut:'phrase', deg:[0]},
  {bar:10, hits:[0, 8], cut:'phrase', deg:[0, 1]},
  {bar:11, hits:[0, 4, 8, 12], cut:'letsbu', deg:[1, 1, 2, 2], blend:.15},
  {bar:12, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'lets', deg:[2, 2, 2, 2, 3, 3, 3, 3], blend:.30},
  {bar:13, hits:r16, cut:'le', deg:r16.map(i => i < 8 ? 3 : 4), blend:.45},
  {bar:14, hits:r16.map(i => i / 2), cut:'l', deg:r16.map(i => i < 4 ? 4 : 5), blend:.60},
];

// The round: other voices of hers join each hit of the ladder, [16ths later,
// pentatonic degrees away, dB, pan], by the rung's period. While the rung is
// slow they enter a beat or an 8th apart and sing the phrase whole, so the
// phrases overlap; from the 8ths on they sing with her, a chord under her
// line, gated as she is. The round closes into one voice as it reaches the choke.
const ROUND = {
  16:[[4, 1, -4, -.55], [8, 2, -6, .55], [12, 3, -8, -.2]],
  8:[[4, 2, -7, .5]],
  4:[[2, 2, -8, -.5]],
  2:[[0, -2, -9, .45]],
  1:[[0, -2, -10, -.45]],
  .5:[[0, -2, -11, .4]],
};
// Her impact word as a chant in the drops: [16th, note], two voices a
// pentatonic third apart. It is the groove with the claps in Drop A and part of
// the wall in Drop B; under one of Synergy's words it steps back 3 dB, and it
// never sings over her own lines.
const CHANT = [[2, 57], [6, 59], [7, 57], [10, 62], [14, 59]];
// How much of each voice the canon and the bloom hear, by section. The verse
// stays dry; the build washes her; the drops wash everyone.
const SENDS = {
  Intro:{voice:0, lady:0, bloom:0, keys:0}, Verse:{voice:0, lady:0, bloom:0, keys:0}, Build:{voice:.06, lady:.5, bloom:0, keys:0},
  'Drop A':{voice:.3, lady:.42, bloom:.24, keys:.18}, 'Sink In':{voice:.4, lady:0, bloom:.3, keys:.25}, 'Drop B':{voice:.4, lady:.5, bloom:.28, keys:.22}, Outro:{voice:.16, lady:.2, bloom:.12, keys:.1},
};

const ENERGY = {Intro:.46, Verse:.44, Build:.56, 'Drop A':1, 'Sink In':.85, 'Drop B':1, Outro:.56};
const STEM_MIX = {
  drums:{reverb:.24, level:1},
  bass:{duck:.6, level:.6},
  keys:{duck:.72, under:.7, reverb:.42, delay:.1, level:2.4, haas:16},
  guitar:{duck:.8, under:.65, reverb:.34, delay:.22, level:5, haas:20},
  voice:{duck:.95, reverb:.2, delay:.12, level:1.35},
  lady:{reverb:.24, delay:.1},
};
const FEED = .42;                       // the canon's feedback: echoes two and three beats later, fading over two bars
const STOMP = {top:150, settle:73.42};  // a foot on the floor, settling on D2

// ---- the voices' structure: the canon and the bloom ------------------------------

// Built with the graph (engine.js band.graph). The canon is two delay lines,
// each feeding back on itself: two beats on the left, three on the right
// (echoes on 8, 16, 24... and 12, 24, 36... 16ths), darker each pass, into the
// room's reverb. Each loop has one way out (Chromium breaks a feedback loop
// where the graph first pulls it; a loop with two exits breaks in a different
// place from run to run and the render stops being exact). The bloom is a
// long space of its own that swells in over 180 ms; it hears nothing before
// BACK. (its sends are zero until the impact), so it opens empty. The choke
// closes the canon; the impact reopens its input at once and its echoes once
// the lines hold nothing from before the choke.
function buildOwn({ctx, I, graph:g, step, sends, master}) {
  const beat = 4 * step, input = I.amp(ctx, 1), hp = I.biquad(ctx, 'highpass', 240, .6), out = I.amp(ctx, 1), toRoom = I.amp(ctx, .5);
  const loop = (beats, side, cutoff, feed) => {
    const d = ctx.createDelay(2), lp = I.biquad(ctx, 'lowpass', cutoff, .6), fb = I.amp(ctx, feed), pan = ctx.createStereoPanner();
    d.delayTime.value = beats * beat; pan.pan.value = side;
    hp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(pan); pan.connect(out);
    return {fb, feed};
  };
  input.connect(hp);
  const lines = [loop(2, -.65, 3000, FEED), loop(3, .65, 2600, FEED * .85)];
  out.connect(master); out.connect(toRoom); toRoom.connect(sends.reverb);
  const bloomIn = I.amp(ctx, 1), bhp = I.biquad(ctx, 'highpass', 200, .6), conv = ctx.createConvolver(), bloomOut = I.amp(ctx, 1);
  conv.buffer = I.washImpulse(ctx, 7, .18);
  bloomIn.connect(bhp); bhp.connect(conv); conv.connect(bloomOut); bloomOut.connect(master);
  const send = (from, to) => { const a = I.amp(ctx, 0); from.connect(a); a.connect(to); return a; };
  const own = {
    input, out, bloomIn, buses:[input, bloomIn],
    voiceRound:send(g.stems.voice.out, input), ladyRound:send(g.stems.lady.out, input),
    voiceBloom:send(g.stems.voice.out, bloomIn), ladyBloom:send(g.stems.lady.out, bloomIn), keysBloom:send(g.stems.keys.out, bloomIn), canonBloom:send(out, bloomIn),
    chokedAt:null,
    choke(c) {
      own.chokedAt = c;
      for (const p of [input.gain, out.gain]) { p.setValueAtTime(1, c); p.linearRampToValueAtTime(0, c + .006); }
      for (const l of lines) l.fb.gain.setValueAtTime(0, c);
    },
    release(t) {
      input.gain.setValueAtTime(1, t);
      // The longer line holds what it heard up to three beats before: reopen once that is past the choke.
      const clear = Math.max(t + .02, (own.chokedAt ?? t - 1) + 3 * beat + .02);
      out.gain.setValueAtTime(0, clear); out.gain.linearRampToValueAtTime(1, clear + .05);
      for (const l of lines) l.fb.gain.setValueAtTime(l.feed, clear);
    },
  };
  return own;
}

// ---- the band -------------------------------------------------------------------

const dB = x => 10 ** (x / 20);
const pc = m => ((Math.round(m) % 12) + 12) % 12;
// k pentatonic steps up (or down) from a note.
function pentaShift(m, k) {
  let x = Math.round(m), n = 0;
  while (n < Math.abs(k)) { x += Math.sign(k); if (PENTA.includes(pc(x))) n++; }
  return x;
}
const lateOf = (T, plan, at) => T(Math.floor(at)) + (at - Math.floor(at)) * plan.step;

// One cut of one of her recordings, played by the band (the round, the chant,
// the bloom): an envelope, a pan, a bus.
function playCut(api, e, t, {rate, gate = Infinity, gain = 0, pan = 0, out}) {
  const {ctx, I} = api, buffer = api.song.lady?.files?.get(e.file);
  if (!buffer || !out) return;
  const length = Math.min(gate, (e.to - e.from) / rate + .01), level = dB(gain);
  const s = ctx.createBufferSource(), env = I.amp(ctx), p = ctx.createStereoPanner();
  s.buffer = buffer; s.playbackRate.value = rate; p.pan.value = pan;
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(level, t + .004);
  env.gain.setValueAtTime(level, t + Math.max(.005, length - .02)); env.gain.linearRampToValueAtTime(0, t + length);
  s.connect(env); env.connect(p); p.connect(out);
  s.start(t, e.from, (e.to - e.from) + .01); s.stop(t + length + .02);
  s.onended = () => { s.disconnect(); env.disconnect(); p.disconnect(); };
}

// The plan's extra voices, by step: the round's voices around her ladder, the
// chant of her impact word. Decided once per plan, from the plan alone.
const VOICES = new WeakMap();
function voicesOf(plan) {
  if (VOICES.has(plan)) return VOICES.get(plan);
  const out = new Map(), T = plan.timing, at = x => T[Math.floor(x)] + (x - Math.floor(x)) * plan.step, choke = plan.choke.time;
  const push = v => { const k = Math.floor(v.at); if (!out.has(k)) out.set(k, []); out.get(k).push(v); };
  for (const e of plan.lady.filter(x => x.role === 'ladder')) {
    const rung = LADDER[e.rung], p0 = rung.hits.length > 1 ? rung.hits[1] - rung.hits[0] : 16;
    (ROUND[p0] || []).forEach(([off, deg, db, side], k) => {
      const when = e.at + off, midi = pentaShift(e.midi, deg), rate = e.rate * 2 ** ((midi - e.midi) / 12);
      const whole = (e.to - e.from) / rate, gate = Math.min(p0 >= 4 ? whole : e.gate * e.rate / rate, choke - at(when) - .005);
      // The second hit of a rung pans the other way: the round goes round the room.
      if (gate > .02) push({at:when, role:'round', cut:e, midi, rate, gate, gain:e.gain + db, pan:side * (e.at % 16 >= 8 && p0 === 8 ? -1 : 1)});
    });
  }
  const imp = plan.lady.find(x => x.role === 'impact');
  if (imp) {
    const m = pitchOf(imp.file, imp.from, imp.to) ?? 59, own = plan.lady.filter(x => x.role !== 'ladder' && x.role !== 'impact' && x.role !== 'tag');
    const hers = (a, b) => own.some(x => { const s = Math.floor(x.at); return s - 1 < b && a < s + Math.ceil(x.gate / plan.step) + 1; });
    const his = (a, b) => plan.words.some(w => w.at - 1 < b && a < w.at + w.steps);
    plan.bars.forEach(b => {
      if (!b.layers.chant) return;
      const wall = b.section === 'Drop B';
      CHANT.forEach(([s, note], i) => {
        const step = b.index * 16 + s, next = CHANT[i + 1]?.[0] ?? 18, room = (next - s) * plan.step - .01;
        if (hers(step, step + 3)) return;
        const under = his(step, step + 2) ? -3 : 0;
        for (const [target, db, side] of [[note, wall ? -10 : -8, -.5], [pentaShift(note, -2), wall ? -13 : -11, .5]])
          push({at:step, role:'chant', cut:imp, midi:target, rate:2 ** ((target - m) / 12), gate:Math.min(room, .5), gain:imp.gain - 5 + db + under, pan:side});
      });
    });
  }
  VOICES.set(plan, out);
  return out;
}

function kickPattern(bar, L) {
  if (!L.kick) return [];
  const until = L.kickUntil ?? 16, g = L.groove;
  const steps = g === 'arrive' ? [0, 8] : g === 'verse' || g === 'leave' ? (bar % 2 ? [0, 8, 10] : [0, 8])
    : g === 'build' ? [0, 4, 8, 12] : g === 'chant' ? (bar % 2 ? [0, 3, 6, 10] : [0, 6, 10]) : g === 'wall' ? (bar % 2 ? [0, 3, 8, 11] : [0, 3, 8, 14]) : g === 'sink' ? [0] : [];
  return steps.filter(s => s < until);
}

function drums(api, b, bar, s, t, T, step) {
  const {ctx, I, plan} = api, D = api.graph.drumHp, L = b.layers, g = L.groove, STEP = api.step, soft = L.light ? .7 : 1;
  if (kickPattern(bar, L).includes(s) && !(L.impact && s === 0)) { I.stomp(ctx, D, t, (s === 0 ? .95 : .78) * (L.loud ? 1 : .85), STOMP); api.duck(t); }
  if (L.clap && (s === 4 || s === 12)) I.gangClap(ctx, D, t, (L.loud ? .62 : .42) * soft, {people:L.loud ? 6 : 3});
  if (g === 'chant' && bar % 2 && s === 15) I.gangClap(ctx, D, t, .34, {people:4});
  if (g === 'wall' && (s === 7 || s === 15)) I.gangClap(ctx, D, t, .3, {people:4, width:.8});
  if (L.fill && s >= 8 && s % 2 === 0) I.gangClap(ctx, D, t, .3 + .04 * (s - 8), {people:6});
  if (L.toms) {
    // Floor toms on D3 and A2: the verse's pickup into every other bar, the drops' rolling figure.
    if ((g === 'verse' || g === 'arrive') && bar % 2 && s === 14) I.floorTom(ctx, D, t, 45, .42 * soft, {side:-.2});
    if (g === 'verse' && L.lean && s >= 12) I.floorTom(ctx, D, t, s % 2 ? 45 : 50, .3 + .06 * (s - 12), {side:s % 2 ? -.3 : .3});
    if (g === 'chant' && (s === 7 || s === 14)) I.floorTom(ctx, D, t, s === 7 ? 45 : 50, .55, {side:s === 7 ? -.3 : .3});
    if (g === 'chant' && s === 11) I.floorTom(ctx, D, t, 50, .38, {side:.35, decay:.35});
    if (g === 'wall' && [6, 7, 14, 15].includes(s)) I.floorTom(ctx, D, t, s < 10 ? 45 : 50, s % 2 ? .5 : .4, {side:s < 10 ? -.35 : .35});
    if (g === 'sink' && s === 8) I.floorTom(ctx, D, t, 43, .5, {decay:.9});
  }
  if (g === 'build') {
    // Hands on the desk, faster each bar, to the choke; floor toms under the last three bars.
    const chokeBar = Math.floor(plan.choke.at / 16), last = bar === chokeBar ? plan.choke.at % 16 : 16, [rate, v0, v1] = L.roll;
    if (s < last) {
      const v = v0 + (v1 - v0) * s / 15, tone = 220 + 200 * L.rung / 5;
      if (rate >= 2) { if (s % rate === 0) I.gangClap(ctx, D, t, v * 1.3, {people:rate >= 4 ? 3 : 4}); }
      else if (rate === 1) I.snareRoll(ctx, D, t, v, tone);
      else { I.snareRoll(ctx, D, t, v, tone); if (t + STEP / 2 < plan.choke.time + T(0) - .002) I.snareRoll(ctx, D, t + STEP / 2, v, tone); }
      if (L.toms && s % 4 === 0) I.floorTom(ctx, D, t, s % 8 ? 50 : 45, .3 + .1 * (L.rung - 3), {side:s % 8 ? .3 : -.3, decay:.3});
    }
  }
  if (L.shaker) I.shaker(ctx, D, t, shakerVelocity(s) * (L.loud ? .42 : .3) * soft);
}

// The office as loop material: typing as the hats, a mug on beat four.
const TYPE = [1, 0, .6, 1, 0, .7, 0, .5, 1, 0, .6, .8, 0, 1, .5, 0];
function office(api, b, bar, s, t) {
  const {ctx, I} = api, D = api.graph.drumHp, L = b.layers;
  if (L.typing && TYPE[s]) I.keyClick(ctx, D, t, L.typing * .26 * TYPE[s], bar * 16 + s * 3);
  if (L.mug && s === 12) I.mug(ctx, D, t, 81, .16, .35);
}

// Pat hums the root: a pedal in the verse, a gentle walk in the drops.
function bass(api, b, bar, s, t, T, step) {
  const {ctx, I} = api, L = b.layers, out = api.graph.stems.bass.input, root = b.chord.root;
  const hum = (m, n, v) => I.humBass(ctx, out, t, m, T(step + n) - t - .02, v);
  if (L.bass === 'pedal' && (s === 0 || s === 8)) hum(C.Dadd9.root, 8, L.light ? .55 : .62);
  else if (L.bass === 'walk') { for (const [at, iv, n] of [[0, 0, 6], [6, 12, 2], [10, 7, 4], [14, 0, 2]]) if (at === s) hum(root + iv, n, at ? .55 : .7); }
  else if (L.bass === 'hold' && s === 0) hum(root, 16, .6);
  else if (L.bass === 'last' && s === 0) hum(root, 8, .6);
}

// Keys on a pump organ: the drone, a bar at a time, breathing.
function keys(api, b, bar, s, t, T, step) {
  if (s !== 0 || b.layers.keys !== 'drone') return;
  const {ctx, I, graph} = api, L = b.layers;
  I.harmonium(ctx, graph.keysFilter, t, b.chord.keys, T(step + 16) - t, L.loud ? 1.15 : L.light ? .7 : .85);
}

// Kevin: one looping figure in 8ths and a skip, ringing into the delay.
const FIGURE = [[0, 0], [3, 2], [6, 1], [8, 3], [11, 2], [14, 1]];
function guitar(api, b, bar, s, t) {
  const {ctx, I, graph} = api, n = b.chord.notes.map(m => m + 12), L = b.layers;
  for (const [at, i] of FIGURE) if (at === s) I.cleanGuitar(ctx, graph.stems.guitar.input, t, [n[i]], (L.loud ? .5 : .36) * (at ? .85 : 1), {ring:.75});
  if (b.section === 'Drop B' && s === 0) I.cleanGuitar(ctx, graph.stems.guitar.input, t, n, .3, {strum:.012, ring:1.1});
}

function voices(api, b, bar, s, t, T, step) {
  const list = voicesOf(api.plan).get(step);
  if (!list) return;
  for (const v of list) playCut(api, v.cut, lateOf(T, api.plan, v.at), {rate:v.rate, gate:v.gate, gain:v.gain, pan:v.pan, out:api.graph.stems.lady.input});
}

// Once a bar: the sends, the office's bigger sounds, the build's rising choir,
// Sink In under water, the reversed swell into Drop B.
function barEvents(api, b, bar, t, barEnd, T, step) {
  const {ctx, I, graph, plan} = api, own = graph.own, L = b.layers, D = graph.drumHp, len = barEnd - t;
  if (own) {
    const S = SENDS[b.section] ?? SENDS.Verse, sign = bar >= 25 ? .5 : 1;
    for (const [node, level] of [[own.voiceRound, S.voice * sign], [own.ladyRound, S.lady], [own.voiceBloom, S.bloom], [own.ladyBloom, S.bloom], [own.keysBloom, S.keys], [own.canonBloom, S.bloom]])
      node.gain.setTargetAtTime(level, t, .04);
    // Her "sink in" is heard clean: in the bar before it she sends nothing to the canon (its
    // echoes two and three beats on would land on her), from her "Let that" nothing to the
    // bloom, and in Sink In the canon goes under water with the room.
    if (bar === SINK - 1) { own.ladyRound.gain.setTargetAtTime(0, t, .02); own.ladyBloom.gain.setTargetAtTime(0, T(LET_THAT - 1), .02); }
    if (bar === SINK) { own.ladyBloom.gain.setTargetAtTime(0, t, .02); own.out.gain.setTargetAtTime(.15, t, .04); own.out.gain.setTargetAtTime(1, barEnd, .04); }
  }
  if (L.room) I.roomTone(ctx, D, t, len + .3, .03);
  if (bar === 0) I.creak(ctx, D, t + .9, .55, .1);
  if (bar === 1 || bar === 25) I.printerFeed(ctx, D, t + 4 * api.step, .16);
  if (L.lean) I.creak(ctx, D, t + 10 * api.step, .45, .08, {side:.4, tone:1500});
  if (bar === 26) I.creak(ctx, D, t, .6, .1, {from:20, to:44});
  // The build's choir rises an octave, oo to the choke, with the air.
  if (bar === 12) {
    const end = lateOf(T, plan, plan.choke.at);
    if (end > t + .5) { I.voicePad(ctx, graph.padFilter, t, [50, 57, 62], end - t, .9, {vowel:'oo', attack:end - t - .05, release:.01, glide:12, wow:0}); I.riser(ctx, D, t, end - t, .26); }
  }
  // Sink In: the room goes under water (the tape's low-pass closes, resonant) and wows.
  if (L.tape === 'sink') {
    const lp = graph.tapeLp, mid = t + len * .45;
    lp.frequency.setValueAtTime(20000, t); lp.frequency.exponentialRampToValueAtTime(650, mid); lp.frequency.setValueAtTime(650, barEnd - .06); lp.frequency.exponentialRampToValueAtTime(20000, barEnd);
    lp.Q.setValueAtTime(.7, t); lp.Q.linearRampToValueAtTime(4.5, mid); lp.Q.setValueAtTime(4.5, barEnd - .06); lp.Q.linearRampToValueAtTime(.7, barEnd);
    const o = ctx.createOscillator(), depth = I.amp(ctx, 0);
    o.frequency.value = .95; o.connect(depth); depth.connect(graph.tapeDelay.delayTime);
    depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(.0018, t + .5); depth.gain.setValueAtTime(.0018, barEnd - .3); depth.gain.linearRampToValueAtTime(0, barEnd - .03);
    o.start(t); o.stop(barEnd); o.onended = () => { o.disconnect(); depth.disconnect(); };
  }
  // The choir swells backwards into Drop B: it rises over two beats and stops on the bar line.
  if (L.swell) { const from = T(step + 8); I.voicePad(ctx, graph.padFilter, from, plan.bars[bar + 1]?.chord.notes ?? b.chord.notes, barEnd - from, 1.1, {vowel:'ah', attack:barEnd - from - .01, release:.01, wow:0}); }
}

// BACK.: a stomp on the floor and every hand in the room, the floor's hum
// rising under it, and her word as a chord of her voices (the chord's tones, a
// breath apart) in the bloom; the choir swells into it. No bass slam.
function impact(api, b, bar, t, barEnd, T, step) {
  const {ctx, I, graph, plan, track} = api, D = graph.drumHp, own = graph.own, k = track.sound.dropKick;
  I.stomp(ctx, D, t, 1.15, {top:k.top, settle:k.settle, decay:.7, thud:.9});
  I.floorTom(ctx, D, t + .004, 45, .7, {side:-.3, decay:1}); I.floorTom(ctx, D, t + .009, 50, .6, {side:.3, decay:.9});
  I.gangClap(ctx, D, t, .85, {people:6});
  api.duck(t);
  I.humBass(ctx, graph.stems.bass.input, t, b.chord.root, Math.min(barEnd - t, 1.8), .72);
  const e = plan.lady.find(x => x.role === 'impact');
  if (e && own) {
    // Two waves: the chord a breath apart on the downbeat, then again under her deep echo a beat later, higher.
    const m = pitchOf(e.file, e.from, e.to) ?? 59, beat = 4 * api.step;
    for (const [target, db, side, late] of [[57, -1, -.45, 0], [62, -2, .45, .025], [66, -5, 0, .05], [50, -6, -.2, .075], [69, -8, .25, .1],
      [62, -6, -.5, beat], [66, -7, .5, beat + .03], [69, -9, 0, beat + .06], [74, -12, .3, beat + .09]])
      playCut(api, e, t + late, {rate:2 ** ((target - m) / 12), gain:e.gain + db, pan:side, out:own.bloomIn});
  }
}

const band = {
  pad(api, t, chord, length, b) {
    const L = b.layers;
    api.I.voicePad(api.ctx, api.graph.padFilter, t, chord.notes, length, L.impact ? 1.25 : /^Drop/.test(b.section) ? .95 : L.light ? .7 : .85, {vowel:L.vowel ?? 'ah', attack:L.impact ? .9 : .35});
    // Drop B's wall: the choir doubled an octave up, a falsetto 'oo' over the 'ah'.
    if (b.section === 'Drop B') api.I.voicePad(api.ctx, api.graph.padFilter, t, chord.notes.slice(1).map(m => m + 12), length, .5, {vowel:'oo', attack:.5, vibrato:12});
  },
  step(api, b, bar, s, t, T, step) {
    const L = b.layers;
    drums(api, b, bar, s, t, T, step);
    office(api, b, bar, s, t);
    if (L.bass) bass(api, b, bar, s, t, T, step);
    if (L.keys) keys(api, b, bar, s, t, T, step);
    if (L.guitar) guitar(api, b, bar, s, t);
    voices(api, b, bar, s, t, T, step);
  },
  bar:barEvents,
  impact,
  graph:buildOwn,
};

export default {
  id:'offsite',
  title:'Offsite',
  genre:'Voice-loop psych pop',
  note:'108 BPM · D major · a round of voices, hands and floors',
  blurb:'The team retreat. Rounds of her voice and his in long reverb, claps and stomps on a wooden floor, one chord droning.',
  bpm:BPM, step:STEP, swing:SWING, key:'D major',
  music:{scale:[45, 47, 50, 52, 54, 57, 59, 62, 64], resolve:[4, 5, 7], home:[57, 50]},
  pitchClasses:SCALE_PCS,
  chords:CHORDS,
  chordAt,
  drop:{
    bars:BARS, sections:SECTIONS, unmute:UNMUTE, choke:CHOKE, impact:IMPACT, rise:11, sink:SINK, stop:{bar:26, step:8, seconds:.45},
    swing:swingOf, layers, cutoff, slots,
    answers:{bars:[10], steps:[5, 13], notes:[57, 62]},
    stutter:{bar:12, notes:[54, 54, 57, 57, 59, 59, 62, 62]},
    ladder:{targets:[50, 52, 54, 57, 59], pentatonic:PENTA, rungs:LADDER},
    tag:{tune:true, rate:1.1, range:[.96, 1.16], silence:.47},
    tuneComb:true,
    impactNote:57,
    places:{
      bend:[16 * 16 + 12, 16 * 16 + 14, 17 * 16, 17 * 16 + 2, 17 * 16 + 4],
      letThat:LET_THAT,
      lift:[20 * 16 + 10, 20 * 16 + 9, 20 * 16 + 11, 20 * 16 + 8],
      punct:[21 * 16 + 13, 21 * 16 + 12, 21 * 16 + 14, 22 * 16],
    },
    energy:ENERGY,
    // The verse's room for the drops (drop.js roomTrim). Here the chant, the clappers and the
    // choir carry a drop on a phone as much as Synergy does, so his share steers it gently.
    room:{verse:{section:'Verse', ref:.70, k:0}, drops:{'Drop A':{ref:.40, k:6}, 'Drop B':{ref:.50, k:3}}, max:2},
  },
  mix:{stems:STEM_MIX, keysHp:120, duckRelease:.14, output:1.36},
  // BACK. on D: the stomp's body settles on D2.
  sound:{dropKick:{top:150, knee:86, settle:73.42}},
  band,
  kicksOf:kickPattern,
  // The band's extra voices of hers, by step (the round, the chant), for checks: {at, role, cut, midi, rate, gate, gain, pan}.
  voicesOf,
  // The composition constitution (CONSTITUTION.md; constitution.js lintTrack).
  references:{
    'panda-bear':'The lane: voices are the instrument. Her phrases and his vocoder stacked into rounds and a two-beat canon, a delay that becomes the rhythm, long reverb, claps, stomps and floor toms for a kit, one drone swaying I to IV.',
    'washed-out':'The warmth: the voices wobble like a worn tape loop, soft focus at a walking tempo, Sink In under water.',
    'daft-punk':'The spine, worn lightly: the vocoder lead and his choir, the stomp pumping the pad and Pat.',
    kraftwerk:'The grid under the haze: her ladder straight down to the 32nd, the office (keys, the printer, a mug) sequenced as loop material.',
  },
  palette:{
    synth:"Synergy's vocoder on a saw choir, sent round a two-beat canon in the drops; a wordless formant choir (oo, ah) as the drone, rising an octave through the build.",
    keys:'Keys on a pump organ: a reedy drone on its bellows, opening across the intro and closing across the outro.',
    drums:'Hands and floors: stomps on a wooden floor, a room of people clapping on two and four, tuned floor toms, desk slaps into the choke, the printer as the shaker; keyboard clatter, a mug and a chair as loop material.',
    bass:'Pat: a warm hum on the root, a pedal D under the verse, a gentle walk in the drops, pumped by the stomp. No bass slam.',
    guitar:'Kevin: one clean figure in eighths, looping and ringing into the delay. Never a solo.',
  },
  story:{
    synergy:'Simple and a little stiff: short lines on repeated notes, two answers in bar 10, a stammer in bar 12; the canon and the choir turn one stiff voice into a room.',
    synthia:null,
  },
};
