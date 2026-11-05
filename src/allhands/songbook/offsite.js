// Offsite: the team retreat, in the Panda Bear lane of the constitution (the
// sound and approach of the Person Pitch era, never its songs). Voices are the
// instrument: the lady's phrases and Synergy's vocoder stacked into rounds and
// a two-beat canon, washed in long reverb; one loop of hands, floors and the
// office (claps, stomps, rolling floor toms, the printer, keyboard clatter, a
// mug) that never stops; one drone swaying between two chords, D major,
// bright. 108 BPM, a light shuffle.
//
// P9 (Aaron: "a steady panda bear upbeat looping rhythm", "less of the
// downbeat", "a little more slow motion"): the same one-bar loop carries every
// section from the first bar to the tape stop, leaning on the offbeats; the
// sections change by layering voices, brightness, reverb and density, never by
// slamming a downbeat; chord changes arrive an 8th early, on the "and" of four;
// a tape-slowed copy of the room (half speed, an octave down) runs under the
// second verse, into Sink In and under the sign-off, and her round comes back
// slowed in the first bars of the build.
//
// Drop Edition: 27 bars, 60.0 s. Intro 0-3 (the call unmutes at bar 2 on
// "Thanks for joining"), verse 3-9, her ladder 9-15 as a round of overlapping
// voices that tightens toward the choke (1, 1/2, 1/4, 1/8, 1/16, 1/32 bar),
// the choke in bar 14, BACK. at bar 15 as a bloom of voices (no slam under it),
// Drop A 15-18 (clap and chant), Sink In 18 (under water: half speed, an
// octave down, a wow), Drop B 19-23 (a wall of voices), outro 23-27 with
// "Full stop." at 26:8 over the tape stop.
import {HOST} from '../song.js';
import {pitchOf} from '../drop.js';
import {riverBand} from '../river.js';

const BPM = 108, STEP = 60 / BPM / 4, SWING = .1;
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

// A light shuffle; the build straightens it so her 8ths, 16ths and 32nds sit even.
function swingOf(bar) {
  if (bar >= 9 && bar < 11) return SWING * (11 - bar) / 3;
  if (bar >= 11 && bar < 15) return 0;
  return SWING;
}

// drums: 'four' tells the video studio the claps land on two and four (edl/params.js
// backbeatHits); 'build' and 'downbeat' as in every track. `loop` is how much of the one
// loop plays and how hard (0.3 under the call to 1.15 in Drop B); the groove names the
// section's extra layers on top of it.
function layers(bar) {
  const s = sectionOf(bar).name;
  const base = {drums:'four', groove:'loop', loop:.6, kick:true, clap:true, toms:true, shaker:true, typing:.4, mug:bar % 2 === 0, bass:'pedal', keys:'drone', pad:true, vowel:'oo', guitar:false};
  // The muted call: the loop is already there (a few hands, the printer, someone typing with the mic on), the room, the drone faintly.
  if (s === 'Intro') return {...base, loop:[.3, .4, .5][bar], kick:bar >= 2, bass:bar >= 2 ? 'pedal' : false, pad:bar >= 1, typing:bar < 2 ? .9 : .45, mug:bar === 1, room:true};
  // The verse stays close and dry: Synergy over the drone and the loop (the second verse rides the slowed room, SLOW).
  if (s === 'Verse') return {...base, guitar:bar >= 5, light:true, lean:bar === 8};
  if (s === 'Build') {
    const r = bar - 9;
    // The loop runs on under her ladder to the choke, steady (Nov 5, the last verification: it used to drop
    // out in the last two build bars, the stomps gone and the bus high-passed to 500 Hz); the drum bus
    // high-passes a little, and the desk slaps roll on top, a step under the loop.
    return {...base, drums:'build', groove:'build', rung:r, loop:[.6, .6, .58, .57, .56, .55][r], kick:true, typing:bar < 12 ? .3 : .2, mug:false, bass:bar < 11 ? 'pedal' : false, guitar:bar < 11,
      roll:[[4, .2, .26], [2, .26, .34], [2, .32, .42], [1, .36, .48], [.5, .42, .54], [.5, .5, .6]][r],
      drumHp:[[30, 90], [90, 120], [120, 150], [150, 170], [170, 180], [180, 180]][r], rise:bar >= 12, voiceLp:bar < 11 ? 1800 : false};
  }
  // The drops lift through the voices, brightness and the loop's fullness: every hand in the room, a second room on the "and"s.
  if (s === 'Drop A') return {...base, groove:'chant', loop:1, typing:.3, bass:'walk', vowel:'ah', guitar:true, loud:true, impact:bar === IMPACT, chant:bar > IMPACT};
  // Sink In: the loop goes on under the tape, which slows it to half speed with everything else.
  if (s === 'Sink In') return {...base, drums:'downbeat', groove:'sink', loop:.85, typing:.3, mug:false, bass:'hold', tape:'sink', swell:true};
  if (s === 'Drop B') return {...base, groove:'wall', loop:1.15, typing:.35, bass:'walk', vowel:'ah', guitar:true, loud:true, chant:true, fill:bar === 22};
  // The outro: the round winds down, the loop thins, the office comes back; the tape stops on her line.
  return {...base, groove:bar < 25 ? 'chant' : 'leave', loop:[.85, .75, .6, .5][bar - 23], typing:bar >= 25 ? .55 : .3, bass:bar < 26 ? 'pedal' : 'last', vowel:bar < 25 ? 'ah' : 'oo', guitar:bar < 25,
    kickUntil:bar === 26 ? 8 : 16, loopUntil:bar === 26 ? 12 : 16, mug:bar === 24, room:bar >= 25};
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
// Her round, slowed: each hit of the first two rungs comes back a dotted quarter
// later at half speed, an octave down (her phrase on a tape running slow), panned
// wide, and is gone by 11:12, before the round tightens.
const ECHO = {rungs:2, late:6, db:-7, until:11 * 16 + 12};
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
// The room on a slow tape: windows (16ths) where a copy of the loop's hands, the
// organ, the pad and Kevin (in the outro Synergy instead of the hands) plays at
// half speed, an octave down, under the band at its own speed: the claps fall on
// beat three, the printer in 8ths, a half-time ghost. Each window reads only its
// first half, so it hears one chord: the second verse is two windows spliced on
// bar 7 (the first ends before the chord moves on 6:14), the last half of Drop A
// starts the sink half a bar early, and the sign-off slows under the tape stop.
// No wow: that stays Sink In's and the stop's. Fades in seconds.
const SLOW = [
  {from:5 * 16, to:6 * 16 + 14, sends:{keys:1.05, guitar:1.25, drums:.6}, level:.85, fadeIn:.55, fadeOut:.03, what:'the second verse on a slow tape'},
  {from:7 * 16, to:9 * 16, sends:{keys:.8, guitar:1, drums:.6}, level:.85, fadeIn:.03, fadeOut:.2, what:'the hook on a slow tape'},
  {from:17 * 16 + 8, to:18 * 16, sends:{keys:.8, guitar:.8, drums:.5}, level:.9, fadeIn:.28, fadeOut:.04, what:'the room starts to sink'},
  {from:25 * 16, to:27 * 16, sends:{keys:.6, guitar:.6, voice:.45}, level:.85, fadeIn:.28, fadeOut:.1, what:'the sign-off on a slow tape'},
];

const ENERGY = {Intro:.46, Verse:.44, Build:.56, 'Drop A':1, 'Sink In':.85, 'Drop B':1, Outro:.56};
const STEM_MIX = {
  drums:{reverb:.14, level:1},           // a dry, steady loop: the wash is the voices' (and every stomp lands clean over the room)
  bass:{duck:.6, level:.6},
  keys:{duck:.72, under:.7, reverb:.42, delay:.1, level:2.4, haas:16},
  guitar:{duck:.8, under:.65, reverb:.34, delay:.22, level:5, haas:20},
  voice:{duck:.95, reverb:.2, delay:.12, level:1.35},
  lady:{reverb:.24, delay:.1},
};
const FEED = .42;                       // the canon's feedback: echoes two and three beats later, fading over two bars
const STOMP = {top:150, settle:73.42, decay:.3, thud:.45, heel:.0004};  // a foot on the floor, settling on D2; the heel speaks at once, softly

// ---- the voices' structure: the canon, the bloom, the slow tape -------------------

// Built with the graph (engine.js band.graph). The canon is two delay lines,
// each feeding back on itself: two beats on the left, three on the right
// (echoes on 8, 16, 24... and 12, 24, 36... 16ths), darker each pass, into the
// room's reverb. Each loop has one way out (Chromium breaks a feedback loop
// where the graph first pulls it; a loop with two exits breaks in a different
// place from run to run and the render stops being exact). The bloom is a
// long space of its own that swells in over 180 ms; it hears nothing before
// BACK. (its sends are zero until the impact), so it opens empty. The choke
// closes the canon; the impact reopens its input at once and its echoes once
// the lines hold nothing from before the choke. The slow tape is one delay line
// whose delay grows at half the clock inside a window (pitch = 1 - d'(t): half
// speed, an octave down), dark like a worn tape, silent outside its windows; it
// hears the loop, the organ, the pad and Kevin (Synergy only in the outro), never
// her, and has no feedback.
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
  const slowIn = I.amp(ctx, 1), slowLine = ctx.createDelay(3), slowHp = I.biquad(ctx, 'highpass', 150, .6), slowLp = I.biquad(ctx, 'lowpass', 2400, .6), slowOut = I.amp(ctx, 0), slowRoom = I.amp(ctx, .3);
  slowLine.delayTime.value = 0;
  slowIn.connect(slowLine); slowLine.connect(slowHp); slowHp.connect(slowLp); slowLp.connect(slowOut); slowOut.connect(master); slowOut.connect(slowRoom); slowRoom.connect(sends.reverb);
  const send = (from, to) => { const a = I.amp(ctx, 0); from.connect(a); a.connect(to); return a; };
  const own = {
    input, out, bloomIn, buses:[input, bloomIn],
    voiceRound:send(g.stems.voice.out, input), ladyRound:send(g.stems.lady.out, input),
    voiceBloom:send(g.stems.voice.out, bloomIn), ladyBloom:send(g.stems.lady.out, bloomIn), keysBloom:send(g.stems.keys.out, bloomIn), canonBloom:send(out, bloomIn),
    slowLine, slowOut, slowSends:{drums:send(g.stems.drums.out, slowIn), keys:send(g.stems.keys.out, slowIn), guitar:send(g.stems.guitar.out, slowIn), voice:send(g.stems.voice.out, slowIn)},
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

// One window of the slow tape (SLOW), scheduled when its first bar is: the delay
// grows from 0 at half the clock, so the window plays what the room played from
// its start at half speed; the level fades in and out, and the delay snaps back
// to 0 once the window is silent (a splice).
function slowWindow(api, w, T) {
  const own = api.graph.own;
  if (!own?.slowLine) return;
  const a = T(w.from), b = T(w.to), end = b - .01, d = own.slowLine.delayTime, g = own.slowOut.gain;
  const fadeIn = Math.min((end - a) / 3, w.fadeIn), fadeOut = Math.min(w.fadeOut, (end - a) / 3);
  d.setValueAtTime(0, a); d.linearRampToValueAtTime((end - a) / 2, end); d.setValueAtTime(0, b);
  g.setValueAtTime(0, a); g.linearRampToValueAtTime(w.level, a + fadeIn); g.setValueAtTime(w.level, end - fadeOut); g.linearRampToValueAtTime(0, end);
  for (const [name, node] of Object.entries(own.slowSends)) { node.gain.setValueAtTime(w.sends[name] ?? 0, a); node.gain.setValueAtTime(0, b); }
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

// One cut of one of her recordings, played by the band (the round, its slowed
// echoes, the chant, the bloom): an envelope, a pan, a bus.
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

// The plan's extra voices, by step: the round's voices around her ladder, their
// slowed echoes, the chant of her impact word. Decided once per plan, from the plan alone.
const VOICES = new WeakMap();
function voicesOf(plan) {
  if (VOICES.has(plan)) return VOICES.get(plan);
  const out = new Map(), T = plan.timing, at = x => T[Math.floor(x)] + (x - Math.floor(x)) * plan.step, choke = plan.choke.time;
  const push = v => { const k = Math.floor(v.at); if (!out.has(k)) out.set(k, []); out.get(k).push(v); };
  let wide = 0;
  for (const e of plan.lady.filter(x => x.role === 'ladder')) {
    const rung = LADDER[e.rung], p0 = rung.hits.length > 1 ? rung.hits[1] - rung.hits[0] : 16;
    (ROUND[p0] || []).forEach(([off, deg, db, side], k) => {
      const when = e.at + off, midi = pentaShift(e.midi, deg), rate = e.rate * 2 ** ((midi - e.midi) / 12);
      const whole = (e.to - e.from) / rate, gate = Math.min(p0 >= 4 ? whole : e.gate * e.rate / rate, choke - at(when) - .005);
      // The second hit of a rung pans the other way: the round goes round the room.
      if (gate > .02) push({at:when, role:'round', cut:e, midi, rate, gate, gain:e.gain + db, pan:side * (e.at % 16 >= 8 && p0 === 8 ? -1 : 1)});
    });
    if (e.rung < ECHO.rungs) {
      const when = e.at + ECHO.late, rate = e.rate / 2, gate = Math.min((e.to - e.from) / rate, at(ECHO.until) - at(when), choke - at(when) - .005);
      if (gate > .05) push({at:when, role:'echo', cut:e, midi:e.midi - 12, rate, gate, gain:e.gain + ECHO.db, pan:wide++ % 2 ? .7 : -.7});
    }
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

// The drone in runs: a chord holds across the bars it lasts, and a change inside a
// section arrives an 8th early, on the "and" of four (the push), so no downbeat
// needs a new chord; the pad, the organ, Pat and Kevin move there together. Never
// across the choke, into or out of Sink In. {bar, chord, from, to (16ths), pushed}.
const RUNS = new WeakMap();
const canPush = (a, b) => !b.layers.impact && a.section !== 'Sink In' && b.section !== 'Sink In' && a.layers.pad && b.layers.pad && (a.section === b.section || (a.section === 'Drop B' && b.section === 'Outro'));
function runsOf(plan) {
  if (RUNS.has(plan)) return RUNS.get(plan);
  const runs = [], level = L => L.impact ? 'impact' : L.loud ? 'loud' : L.light ? 'light' : 'mid';
  let cur = null;
  for (const b of plan.bars) {
    const L = b.layers, key = `${b.chord.name}|${L.vowel ?? 'ah'}|${level(L)}|${!!L.pad}`, prev = plan.bars[b.index - 1];
    if (cur && cur.key === key && !L.impact && b.section === cur.bar.section) { cur.to = (b.index + 1) * 16; continue; }
    const push = prev && cur && b.chord !== prev.chord && canPush(prev, b) ? 2 : 0;
    if (cur) cur.to = b.index * 16 - push;
    cur = {key, bar:b, chord:b.chord, from:b.index * 16 - push, to:(b.index + 1) * 16, pushed:!!push};
    runs.push(cur);
  }
  RUNS.set(plan, runs);
  return runs;
}
// The run a bar pushes into (it starts on this bar's 14th 16th), if any.
const pushedFrom = (plan, bar) => runsOf(plan).find(r => r.pushed && r.from === bar * 16 + 14);

// ---- the loop ----------------------------------------------------------------------
// One bar, the same in every section, so the song rides one rhythm from the first
// bar to the tape stop. Its weight is on the offbeats: the stomps are a soft, even
// heartbeat (one and three a touch under two and four), the claps land on two and
// four with two hands on the "and" before each, the floor toms roll after each
// beat and never on it, the printer leans on the "and" and the "a" (with the swing, the shuffle),
// the keyboard clatters on the "and"s. Every stomp lands clean: nothing rings into
// it from the 16th before (the toms stop two 16ths short, and are short), except
// under the slow tape's half-time ghost of the loop.
const STOMPS = [[0, .38], [4, .42], [8, .38], [12, .42]];
const CLAPS = [[2, .3, 2], [4, 1, 0], [10, .28, 2], [12, 1, 0]];          // [16th, v, fewer people]
const OFF_CLAPS = [6, 14];                                               // the drops: a second room on the "and"s of two and four
const TOMS = [[1, .2, 45, .22], [2, .3, 50, .28], [5, .2, 45, .22], [6, .32, 50, .28], [9, .2, 45, .22], [10, .3, 50, .28], [13, .22, 45, .22], [14, .34, 50, .28]];   // [16th, v, A2 or D3, decay]
const SHAKE = [.1, .17, .32, .21];
const TYPE = [.35, .6, 1, 0, .4, 0, 1, .55, .35, .7, 1, 0, .45, 0, 1, .6];

function kickPattern(bar, L) {
  if (!L.kick) return [];
  const until = L.kickUntil ?? 16;
  // Under Sink In's tape only its first stomp lands on the grid (the tape delays the rest); the floor
  // joins on beat two of the bar the call unmutes in, so the unmute's downbeat is his welcome alone.
  return (L.groove === 'sink' ? [0] : STOMPS.map(([s]) => s)).filter(s => s < until && !(bar === UNMUTE && s === 0));
}

// Nothing of the loop after the choke (her tag is alone) or past loopUntil (the tape stop), and on
// BACK.'s first beat only the heartbeat under her word: the loop comes back on beat two.
const quiet = (plan, bar, s, L) => (bar === Math.floor(plan.choke.at / 16) && s >= plan.choke.at % 16) || s >= (L.loopUntil ?? 16) || (L.impact && s > 0 && s < 4);

function drums(api, b, bar, s, t, T, step) {
  const {ctx, I, plan} = api, D = api.graph.drumHp, L = b.layers, g = L.groove, d = L.loop ?? .6, k = .55 + .45 * Math.min(1, d), soft = L.light ? .85 : 1;
  if (quiet(plan, bar, s, L)) return;
  const back = L.impact && s === 0;                    // BACK.'s downbeat: the heartbeat alone, at its lightest
  if (kickPattern(bar, L).includes(s)) {
    // BACK.'s downbeat keeps the heartbeat at its lightest and pumps nothing: no slam.
    I.stomp(ctx, D, t, STOMPS.find(x => x[0] === s)[1] * k * (back ? .7 : 1), STOMP);
    if (!back) api.duck(t, s % 8 ? undefined : {bass:.75, keys:.84});
  }
  if (back) return;
  if (L.clap) for (const [at, v, fewer] of CLAPS) if (at === s) I.gangClap(ctx, D, t, v * (L.loud ? .62 : .44) * k * soft, {people:Math.max(2, Math.round(2 + 4 * Math.min(1, d)) - fewer), width:.6 + .4 * Math.min(1, d)});
  if (L.loud && OFF_CLAPS.includes(s)) I.gangClap(ctx, D, t, (g === 'wall' ? .34 : .26) * k, {people:4, width:.9});
  if (L.fill && s >= 8 && s % 2 === 0) I.gangClap(ctx, D, t, .22 + .02 * (s - 8), {people:6});
  if (L.toms) for (const [at, v, midi, decay] of TOMS) if (at === s && (d >= .5 || at % 4 === 2)) I.floorTom(ctx, D, t, midi, v * k * soft * (L.loud ? 1.2 : 1), {decay, side:midi === 50 ? .3 : -.3});
  if (g === 'build') {
    // Hands on the desk, faster each bar, to the choke, over the loop.
    const chokeBar = Math.floor(plan.choke.at / 16), last = bar === chokeBar ? plan.choke.at % 16 : 16, [rate, v0, v1] = L.roll;
    if (s < last) {
      const v = v0 + (v1 - v0) * s / 15, tone = 220 + 200 * L.rung / 5;
      if (rate >= 2) { if (s % rate === 0) I.gangClap(ctx, D, t, v * 1.3, {people:rate >= 4 ? 3 : 4}); }
      else if (rate === 1) I.snareRoll(ctx, D, t, v, tone);
      else { I.snareRoll(ctx, D, t, v, tone); if (t + api.step / 2 < plan.choke.time + T(0) - .002) I.snareRoll(ctx, D, t + api.step / 2, v, tone); }
    }
  }
  if (L.shaker) I.shaker(ctx, D, t, SHAKE[s % 4] * (L.loud ? .5 : .38) * k * soft);
}

// The office as loop material: typing as the hats, a mug on beat four every other bar.
function office(api, b, bar, s, t) {
  const {ctx, I, plan} = api, D = api.graph.drumHp, L = b.layers;
  if (quiet(plan, bar, s, L) || (L.impact && s === 0)) return;
  if (L.typing && TYPE[s]) I.keyClick(ctx, D, t, L.typing * .26 * TYPE[s], bar * 16 + s * 3);
  if (L.mug && s === 12) I.mug(ctx, D, t, 81, .16, .35);
}

// Pat hums the root on the offbeats: a pedal D under the verse, a gentle walk in
// the drops. His note on the "and" of four holds the next bar's root when the
// chord is pushed, so no downbeat needs a new note.
function bass(api, b, bar, s, t, T, step) {
  const {ctx, I, plan} = api, L = b.layers, out = api.graph.stems.bass.input, root = b.chord.root, next = pushedFrom(plan, bar);
  const hum = (m, n, v) => I.humBass(ctx, out, t, m, T(step + n) - t - .02, v);
  if (L.bass === 'pedal') { if (s === 2) hum(C.Dadd9.root, 12, L.light ? .55 : .62); else if (s === 14) hum(C.Dadd9.root, 4, L.light ? .5 : .56); }
  else if (L.bass === 'walk') { for (const [at, iv, n, v] of [[2, 0, 4, .68], [6, 12, 3, .5], [10, 7, 4, .55], [14, null, 4, .6]]) if (at === s) hum(iv === null ? (next ? next.chord.root : root) : root + iv, iv === null && !next ? 2 : n, v); }
  else if (L.bass === 'hold' && s === 0) hum(root, 16, .55);
  else if (L.bass === 'last' && s === 2) hum(root, 6, .55);
}

// Keys on a pump organ: the drone, a run at a time (runsOf), breathing.
function keys(api, b, bar, s, t, T, step) {
  if (b.layers.keys !== 'drone') return;
  const {ctx, I, graph, plan} = api;
  for (const run of runsOf(plan)) if (run.from === step) {
    const L = run.bar.layers;
    I.harmonium(ctx, graph.keysFilter, t, run.chord.keys, T(run.to) - t, L.loud ? 1.15 : L.light ? .7 : .85);
  }
}

// Kevin: one looping figure on the offbeats and a skip, ringing into the delay; his
// "and" of four already plays the pushed chord. Drop B strums on the "and" of one.
const FIGURE = [[2, 0], [5, 2], [6, 1], [10, 3], [13, 2], [14, 1]];
function guitar(api, b, bar, s, t) {
  const {ctx, I, graph, plan} = api, L = b.layers, run = s >= 14 ? pushedFrom(plan, bar) : null, n = (run ? run.chord : b.chord).notes.map(m => m + 12);
  if (L.impact && s < 4) return;                       // her BACK. first
  for (const [at, i] of FIGURE) if (at === s) I.cleanGuitar(ctx, graph.stems.guitar.input, t, [n[i]], (L.loud ? .5 : .36) * (at === 2 ? 1 : .85), {ring:.75});
  if (b.section === 'Drop B' && s === 2) I.cleanGuitar(ctx, graph.stems.guitar.input, t, n, .3, {strum:.012, ring:1.1});
}

function voices(api, b, bar, s, t, T, step) {
  const list = voicesOf(api.plan).get(step);
  if (!list) return;
  for (const v of list) playCut(api, v.cut, lateOf(T, api.plan, v.at), {rate:v.rate, gate:v.gate, gain:v.gain, pan:v.pan, out:api.graph.stems.lady.input});
}

// Once a bar: the sends, the slow tape's windows, the office's bigger sounds (on
// the keys stem: room, not kit), the build's rising choir, Sink In under water,
// the reversed swell into Drop B.
function barEvents(api, b, bar, t, barEnd, T, step) {
  const {ctx, I, graph, plan} = api, own = graph.own, L = b.layers, ROOM = graph.stems.keys.input, len = barEnd - t;
  if (own) {
    const S = SENDS[b.section] ?? SENDS.Verse, sign = bar >= 25 ? .5 : 1;
    for (const [node, level] of [[own.voiceRound, S.voice * sign], [own.ladyRound, S.lady], [own.voiceBloom, S.bloom], [own.ladyBloom, S.bloom], [own.keysBloom, S.keys], [own.canonBloom, S.bloom]])
      node.gain.setTargetAtTime(level, t, .04);
    // Her "sink in" is heard clean: in the bar before it she sends nothing to the canon (its
    // echoes two and three beats on would land on her), from her "Let that" nothing to the
    // bloom, and in Sink In the canon goes under water with the room.
    if (bar === SINK - 1) { own.ladyRound.gain.setTargetAtTime(0, t, .02); own.ladyBloom.gain.setTargetAtTime(0, T(LET_THAT - 1), .02); }
    if (bar === SINK) { own.ladyBloom.gain.setTargetAtTime(0, t, .02); own.out.gain.setTargetAtTime(.15, t, .04); own.out.gain.setTargetAtTime(1, barEnd, .04); }
    for (const w of SLOW) if (Math.floor(w.from / 16) === bar) slowWindow(api, w, T);
  }
  if (L.room) I.roomTone(ctx, ROOM, t, len + .3, .03);
  if (bar === 0) I.creak(ctx, ROOM, t + .9, .55, .1);
  if (bar === 1 || bar === 25) I.printerFeed(ctx, ROOM, t + 4 * api.step, .16);
  if (L.lean) I.creak(ctx, ROOM, t + 10 * api.step, .45, .08, {side:.4, tone:1500});
  if (bar === 26) I.creak(ctx, ROOM, t, .6, .1, {from:20, to:44});
  // The build's choir rises an octave, oo to the choke, with the air.
  if (bar === 12) {
    const end = lateOf(T, plan, plan.choke.at);
    if (end > t + .5) { I.voicePad(ctx, graph.padFilter, t, [50, 57, 62], end - t, .9, {vowel:'oo', attack:end - t - .05, release:.01, glide:12, wow:0}); I.riser(ctx, graph.drumHp, t, end - t, .26); }
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
  // The choir swells backwards into Drop B: it rises over two beats and lets go across the bar line, not on it.
  if (L.swell) { const from = T(step + 8); I.voicePad(ctx, graph.padFilter, from, plan.bars[bar + 1]?.chord.notes ?? b.chord.notes, barEnd - from, 1.1, {vowel:'ah', attack:barEnd - from - .01, release:.3, wow:0}); }
}

// BACK.: a bloom of voices, and no slam under it. Her word as a chord of her
// voices (the chord's tones, a breath apart) in the bloom, then again a beat later
// under her deep echo; the choir swells into it; under her word only the loop's
// heartbeat at its lightest (no pump), Pat on the "and", and the rest of the loop
// from beat two (quiet()).
function impact(api, b, bar, t, barEnd, T, step) {
  const {plan, graph} = api, own = graph.own, e = plan.lady.find(x => x.role === 'impact');
  // Her chord goes straight to the bloom, not through her stem: it mutes when she does (engine.js setMuted).
  if (!e || !own || graph.muted?.lady) return;
  // Two waves: the chord a breath apart on the downbeat, then again under her deep echo a beat later, higher.
  const m = pitchOf(e.file, e.from, e.to) ?? 59, beat = 4 * api.step;
  for (const [target, db, side, late] of [[57, -1, -.45, 0], [62, -2, .45, .025], [66, -5, 0, .05], [50, -6, -.2, .075], [69, -8, .25, .1],
    [62, -6, -.5, beat], [66, -7, .5, beat + .03], [69, -9, 0, beat + .06], [74, -12, .3, beat + .09]])
    playCut(api, e, t + late, {rate:2 ** ((target - m) / 12), gain:e.gain + db, pan:side, out:own.bloomIn});
}

// Where the song runs below normal speed, in plan seconds: the master tape (Sink In
// and the stop: the whole room) and the slowed layers (the slow tape's windows, her
// slowed echoes), each {from, to, rate (or [from, to] for a slide), what, whole}.
function slowOf(plan) {
  const T = plan.timing, at = x => T[Math.floor(x)] + (x - Math.floor(x)) * plan.step, end = plan.stop?.tapeEnd ?? T.at(-1), out = [];
  for (const w of SLOW) out.push({from:T[w.from], to:Math.min(T[w.to], end), rate:.5, what:w.what, whole:false});
  for (const list of voicesOf(plan).values()) for (const v of list) if (v.role === 'echo') out.push({from:at(v.at), to:at(v.at) + v.gate, rate:.5, what:'her round, slowed', whole:false});
  for (const x of plan.tape || []) out.push(x.kind === 'sink' ? {from:T[x.from], to:T[x.to], rate:[1, .5], what:'Sink In: the whole room', whole:true} : {from:T[x.from], to:T[x.from] + x.seconds, rate:[1, 0], what:'the tape stop', whole:true});
  return out.sort((a, b) => a.from - b.from);
}

const band = {
  // The wordless choir, a run at a time (runsOf): this bar plays the runs that start in it,
  // on its downbeat or pushed onto its "and" of four for the next bar.
  pad(api, t, chord, length, b) {
    const {plan, I, ctx, graph} = api, t0 = t - plan.timing[b.index * 16], T = n => t0 + plan.timing[Math.min(n, plan.timing.length - 1)];
    for (const run of runsOf(plan)) {
      if (Math.floor(run.from / 16) !== b.index || !run.bar.layers.pad) continue;
      const L = run.bar.layers, from = T(run.from), span = T(run.to) - from;
      I.voicePad(ctx, graph.padFilter, from, run.chord.notes, span, L.impact ? 1.25 : /^Drop/.test(run.bar.section) ? .95 : L.light ? .7 : .85, {vowel:L.vowel ?? 'ah', attack:L.impact ? .9 : .35});
      // Drop B's wall: the choir doubled an octave up, a falsetto 'oo' over the 'ah'.
      if (run.bar.section === 'Drop B') I.voicePad(ctx, graph.padFilter, from, run.chord.notes.slice(1).map(m => m + 12), span, .5, {vowel:'oo', attack:.5, vibrato:12});
    }
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

// ---- the river (forms.js 'wander'): Offsite's form since Nov 5 ------------------------
// Aaron, on the Panda Bear sketch: "it's probably too much vocals packed in the panda bear
// sounds. We want our repetitious rhythmatic and use samples in a repeating pattern so you
// get like a pixelated diffusion of sound that builds in a beautiful melodic stream with
// overlays and sound textures. That pair with beautiful tambourine and some acoustic
// sounding instruments although it's 90% electronic. Think of it as a natural river of
// electronic sound: it has a nice flow, however sometimes the flow gently changes."
// 27 bars, 60.0 s, the same 108 BPM and D major. No ladder, no choke, no BACK.: her
// syllables loop first and alone, repeat and thicken (copies, offsets, pitch steps, a
// granular smear) into a pixelated stream; only then do his word and the couplet's
// "It's not X." join, each fading and filtering in over bars; the loop of hands runs
// every bar; the tambourine stays in the background and comes up where the texture
// swells; a pluck, a felt piano and a kalimba-like mallet carry the melody on a pitch
// window that drifts. Two clear phrases rise out of the stream and sink back in (the
// couplet's "It's Y." at the swell, the refrain in the pool), and Synergy sings his
// hook once, early, washed. It ends on the fullest texture dissolving, a long fade.
const RIVER_SECTIONS = [
  {name:'Source', from:0, to:2},       // her syllables alone over a soft pulse, the room waking up
  {name:'Stream', from:2, to:10},      // the pattern repeats and thickens (copies, the smear); the drone; his hook, once
  {name:'Current', from:10, to:15},    // lush by bar 12: then Pat, the tambourine, the pluck, his word, "It's not X." 
  {name:'Swell', from:15, to:21},      // the fullest: the mallet, the tambourine up, "It's Y." rises
  {name:'Pool', from:21, to:24},       // the flow slows under itself; the refrain rises
  {name:'Delta', from:24, to:27},      // the fullest texture dissolving, a long fade
];
const RIVER_BARS = 27;
const riverChord = bar => (bar % 4 < 2 ? C.Dadd9 : C.G69);
const riverSection = bar => (RIVER_SECTIONS.find(s => bar >= s.from && bar < s.to) || RIVER_SECTIONS.at(-1)).name;
// Keyframes over bars, cosine-eased: the river's slow drifts.
const ease = (keys, x) => {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [a, u] = keys[i - 1], [b, v] = keys[i], k = (1 - Math.cos(Math.PI * (x - a) / (b - a))) / 2; return u + (v - u) * k; }
  return keys.at(-1)[1];
};
const ENERGY_KEYS = [[0, .7], [2, .69], [4, .67], [10, .64], [14, .68], [16, .74], [18, .78], [21, .76], [22, .66], [23.5, .7], [25, .74], [27, 0]];
const WINDOW_KEYS = [[0, 62], [8, 64], [16, 69], [22, 66], [27, 62]];   // the pitch window of the colours: D4, up to A4 at the swell, home
// The chart's layers (bars). Every ramp is two to eight bars; nothing arrives or leaves on a bar line.
// The bloom (Aaron, Nov 5: it opened as a groove, every layer in within six bars): her pattern first,
// over the soft pulse of the stomps (the loop's other hands join it bar by bar, RIVER_LOOP.from); it
// repeats and thickens (her copies from bar 3, the smear from bar 6) under the drone from bar 7, and is
// lush around bar 12; only then do Pat, the tambourine (in the background, a little later), the pluck,
// his word, "It's not X.", Kevin, the felt piano and the mallet ramp in, one or two a bar.
const LAYERS = [
  {id:'her', kind:'texture', source:'her', stem:'lady', what:'her syllables on a two-bar pattern, the first sound and the last', in:[0, 2], out:[23, 27], level:.8, open:6500, wash:[[0, .3], [12, .45], [24, .6], [27, .8]], delay:[[0, .18], [10, .24]], pans:[[0, -.15], [12, .15], [24, -.1]]},
  {id:'loop', kind:'loop', stem:'drums', what:'the loop: soft stomps from the first bar (the pulse), then the printer, a room clapping on two and four, floor toms after the beats, typing', in:[1, 4], out:[25, 27], level:1.4, open:16000, shut:1800, hp:70, swell:[[8, .9], [12, 1.05], [16, 1.15], [21, 1.15], [22, 1], [24, 1.1]]},
  {id:'her-copies', kind:'texture', source:'her', stem:'lady', what:'her syllables again: copies a dotted 8th on, pitch steps, both words', in:[3, 7], out:[22, 26], level:.6, open:7000, wash:[[3, .4], [18, .55]], delay:[[3, .3]], pans:[[3, .2], [16, -.2]]},
  {id:'smear', kind:'texture', source:'her', stem:'lady', what:'the granular smear: her syllables in grains, heavily pixelated, wide', in:[6, 10], out:[24, 27], level:.7, open:9000, wash:[[6, .5], [22, .65], [27, .9]], delay:[[6, .3]], swell:[[18, 1.1], [24, 1.3]]},
  {id:'drone', kind:'drone', stem:'keys', what:'the pump organ and the wordless choir, one chord at a time', in:[7, 11], out:[24, 27], level:.75, open:4200, shut:300, filter:[[16, 5200], [21, 3200], [24, 4500]]},
  {id:'bass', kind:'bass', stem:'bass', what:'Pat humming the root on the offbeats', in:[10, 13], out:[24, 27], level:.36, open:2200, shut:120},
  {id:'tambourine', kind:'tambourine', stem:'drums', what:'the tambourine, in the background, a little later, up a little where the texture swells', in:[11, 14], out:[24, 27], level:2.2, open:16000, shut:3000, swell:[[15, 1], [17, 1.45], [21, 1.45], [22, 1], [24, 1.3]]},
  {id:'plucks', kind:'colour', stem:'guitar', what:'a plucked string (Karplus-Strong), an arpeggio on the drifting pitch window', in:[12, 15], out:[22, 26], level:.28, open:7000, wash:[[12, .25], [16, .35]], delay:[[12, .25]], pans:[[12, -.2], [16, .2], [22, 0]]},
  {id:'his', kind:'texture', source:'his', stem:'lady', hp:170, what:"Strategy's word in grains, low, looped", in:[13, 16], out:[21, 25], level:.75, open:4500, wash:[[13, .45]], delay:[[13, .25]], pans:[[13, -.3], [20, .1]]},
  {id:'x', kind:'texture', source:'x', stem:'lady', hp:170, what:'"It\'s not X." in pieces, looped into the texture before Y rises', in:[13, 16], out:[17, 20], level:.68, open:3500, wash:[[13, .45]], delay:[[13, .3]], pans:[[13, .25], [17, -.25]]},
  {id:'guitar', kind:'guitar', stem:'guitar', what:"Kevin's clean figure on the offbeats", in:[14, 16], out:[20, 23], level:.65, open:5000, delay:[[14, .3]]},
  {id:'felt', kind:'colour', stem:'keys', hp:200, what:'a felt piano on the chord, twice a bar', in:[14, 17], out:[23, 26], level:.27, open:5000, wash:[[14, .3]]},
  {id:'mallet', kind:'colour', stem:'keys', what:'a kalimba-like mallet, a counter-line over the window', in:[15, 18], out:[24, 27], level:.19, open:9000, wash:[[15, .3], [24, .6]], delay:[[15, .35]]},
];
// Two-bar texture patterns (16ths 0-31): `deg` pentatonic steps from the cut's own pitch; `len` 16ths
// of the cut from `pos` of the way into it. Grains, not words: no hit plays a whole word (the old len-2
// hits did, and Whisper heard fixture 31's "drop, drop, drop" through the stream), each half a 16th
// (about 70 ms) from inside the word, past its onset, a pitch step from the last, a few smeared grains
// round it, into the diffusion.
// The words are heard only in the clear phrases.
const RIVER_ECHO = {amount:.65, smear:3, smearSteps:[0, 2, -2], seed:5, hits:[{at:4, deg:0, len:.5, pos:.35}, {at:12, deg:2, pan:.3, len:.5, pos:.55}, {at:20, deg:1, pan:-.3, len:.5, pos:.3}, {at:28, deg:-1, len:.5, pos:.45}]};
const TEXTURES = {
  her:{amount:.65, smear:2, smearSteps:[0, 2, -2], seed:1, hits:[[2, 0, .3], [6, 2, .45], [10, 1, .35], [14, 3, .55], [18, 0, .4], [22, 2, .5], [26, 4, .3], [30, 1, .6]].map(([at, deg, pos]) => ({at, deg, pos, len:.5}))},
  'her-copies':{amount:.7, smear:2, smearSteps:[0, 2, 4], seed:2, hits:[[0, 2, 1, -.5, .35], [3, 4, 0, .5, .5], [8, 1, 1, -.3, .3], [11, 3, 0, .4, .45], [16, 2, 1, .5, .6], [19, 5, 0, -.5, .3], [24, 1, 1, .3, .5], [27, 3, 0, -.4, .4]].map(([at, deg, cut, pan, pos]) => ({at, deg, cut, pan, pos, len:.5}))},
  his:{amount:.65, smear:2, smearSteps:[0, -2, 2], seed:3, hits:[{at:7, deg:0, len:.5, pos:.35}, {at:14, deg:-1, len:.5, pos:.55}, {at:23, deg:1, len:.5, pos:.3}, {at:30, deg:0, len:.5, pos:.6}]},
  smear:{amount:.85, smear:5, smearSteps:[-2, 0, 2, 4], seed:4, hits:Array.from({length:16}, (_, i) => ({at:i * 2 + 1, deg:[0, 2, 4, 1, 3, 5, 2, 0][i % 8], cut:i % 2, len:.5, pos:[.35, .55, .45, .6][i % 4], gain:.55, pan:i % 2 ? .6 : -.6}))},
  x:{amount:.6, smear:2, smearSteps:[0, 2], seed:6, hits:[{at:0, cut:0, len:.5, pos:.3}, {at:2, cut:1, len:.5, pos:.4}, {at:6, cut:9, len:.5, pos:.35}, {at:9, cut:9, len:.5, pos:.6, deg:2}, {at:16, cut:0, len:.5, pos:.3, deg:1}, {at:18, cut:1, len:.5, pos:.5, deg:1}, {at:22, cut:9, len:.5, pos:.3, deg:-1}, {at:25, cut:9, len:.5, pos:.55, deg:1}]},
  'couplet-y-echo':RIVER_ECHO,
  'refrain-echo':RIVER_ECHO,
};
const PLUCKS = [0, null, 2, 4, null, 3, 1, null, 2, null, 4, 5, null, 3, 2, null, 1, null, 3, 5, null, 4, 2, null, 3, null, 5, 6, null, 4, 2, null];
const MALLET = Array.from({length:64}, (_, i) => ({3:4, 7:2, 11:3, 14:1, 19:5, 27:2, 35:4, 39:3, 46:2, 55:1, 59:0})[i] ?? null);
const RIVER_LOOP = {
  // The bar each part of the loop starts to ramp in from (over two bars): the stomps are the pulse from
  // the start, the printer, the room's claps, the toms and the typing join as the texture thickens.
  from:{stomps:1, shaker:5, claps:8, toms:10, type:12},
  stomps:[[0, .22], [4, .26], [8, .22], [12, .26]], stomp:STOMP,
  claps:[[4, .72, 0], [12, .72, 0], [2, .22, 2], [10, .2, 2]],
  toms:TOMS.map(([at, v, midi, decay]) => [at, v * .4, midi, decay * .8]),
  shake:[.08, .14, .26, .17], type:TYPE.map(v => v * .8),
};
const riverLayers = bar => ({drums:'river', groove:'river', loop:bar >= 1, kick:bar >= 1, clap:bar >= 1, toms:bar >= 1, shaker:bar >= 1, tambourine:bar >= 2, bass:bar >= 3 ? 'hum' : false,
  keys:'drone', pad:bar >= 1, guitar:bar >= 9 && bar < 22, colours:bar >= 4, textures:true});
const WANDER = {
  bars:RIVER_BARS, sections:RIVER_SECTIONS, swing:.08, pentatonic:PENTA, chordAt:riverChord,
  layers:riverLayers, cutoff:() => ({keys:[16000, 16000], pad:[16000, 16000]}), energy:bar => ease(ENERGY_KEYS, bar), window:x => ease(WINDOW_KEYS, x),
  // Synergy, once: his hook in the stream, washed (or null: not at all).
  hook:{bar:7, startStep:0, window:24},
  // Where the clear phrases rise (bars): the couplet's "It's Y." at the swell, the refrain in the pool.
  phrases:{y:17, refrain:22},
  layerSpec:LAYERS, textures:TEXTURES, plucks:PLUCKS, mallet:MALLET, figure:[[2, 0], [6, 1], [10, 3], [14, 1]],
  loop:RIVER_LOOP, tambourine:{shakes:[.2, .11, .46, .16], hits:[12]},
  // Where the texture comes up (the swell, then the pool where the refrain rises), over the stream it grew from.
  swells:[{name:'Swell', from:16, to:21, ref:[3, 10]}, {name:'Pool', from:21.5, to:24, ref:[3, 10]}],
  slow:[{from:21, to:23.5, what:'the pool: the river slows to half speed under itself', level:.55, fade:1.5}],
  fade:[25, 27],
  // dB on the river's output (plan.makeup, engine.js): the bloom's sparse first bars sit low, so the song
  // comes back to -10 LUFS here (the swells keep their lift over the stream).
  makeup:2,
  // His hook, washed into the stream (his stem's level), and the clear phrases' rise over the texture (dB).
  voiceLevel:.6, phraseGain:2, yLift:3,     // the couplet's Y, a short word or two at the swell, a little more
  synthiaAmount:.3,                          // her pixels over the stream: light
  drifts:[{what:'the pitch window of the colours (MIDI)', param:'window', points:WINDOW_KEYS}, {what:'the river\'s energy', param:'energy', points:ENERGY_KEYS}],
  // A song picked by hand (today's cast, no band): the river's own couplet and refrain.
  defaults:{
    couplet:{id:'hour-quick-sync', topic:'meetings', line:"It's not an hour. It's a quick sync.", recorded:false,
      x:{voice:'strategy', id:'hour-quick-sync-call', text:"It's not an hour.", display:"IT'S NOT AN HOUR."}, y:{voice:'synthia', id:'hour-quick-sync-response', text:"It's a quick sync.", display:"IT'S A QUICK SYNC."}},
    refrain:{voice:'lady', file:'41.wav', words:[0, 2], text:'The journey continues.', display:'THE JOURNEY CONTINUES.'},
    stabs:[{voice:'strategy', id:'north-star', text:'North star', display:'NORTH STAR'}],
  },
  kicksOf:(bar, L) => (L.kick ? [0, 4, 8, 12] : []),
  // The constitution (CONSTITUTION.md, the river): what each band role plays here.
  palette:{
    synth:"Synergy's vocoder, once (his hook, washed into the diffusion); the textures: her syllables and Strategy's words cut, pitched onto the pentatonic and pixelated.",
    keys:'A pump organ and the wordless choir as the drone; a felt piano on the chord, twice a bar; a kalimba-like mallet, a counter-line.',
    drums:'One loop of hands and floors in every bar: soft stomps, a room clapping on two and four, floor toms after the beats, the printer as the shaker, keyboard clatter; the tambourine in the background.',
    bass:'Pat: a warm hum on the root, on the offbeats.',
    guitar:"Kevin: a clean figure on the offbeats, and a plucked string's arpeggio. Never a solo.",
  },
  acoustic:['plucks', 'felt', 'mallet', 'tambourine'],
  references:{
    'panda-bear':'The lane: short samples of voices repeating in a steady pattern until they diffuse into a melodic stream, layered only once the texture is lush; delay and diffusion as rhythm and space.',
    'washed-out':'The warmth: soft focus, the drone, the slow tape under the pool, a long fade.',
    'daft-punk':'The spine, worn lightly: his vocoder once, a soft four on the floor pumping the drone and Pat.',
    kraftwerk:'The grid under the haze: every sample cut to the 16th, pixelated (the sample-and-hold, the crush).',
  },
  story:{synergy:'Simple and a little stiff: his hook once, early, washed into the stream.', synthia:null},
};
WANDER.band = riverBand(WANDER);

export default {
  id:'offsite',
  // The form this track plays (forms.js): the river. Its Drop Edition below stays arrangeable (the
  // video studio's Offsite treatment and the older checks read it), but the page plays the river.
  form:'wander',
  wander:WANDER,
  title:'Offsite',
  genre:'Voice-loop psych pop',
  note:'108 BPM · D major · one loop, a round of voices, hands and floors',
  blurb:'The team retreat. One loop of claps, stomps and the office that never stops, rounds of her voice and his in long reverb, one chord droning, a slow tape underneath.',
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
  // BACK. on D: Synergy's impact note and her deep voice's comb (the stomp at BACK. is the loop's own, at its lightest).
  sound:{dropKick:{top:150, knee:86, settle:73.42}},
  band,
  kicksOf:kickPattern,
  // The band's extra voices of hers, by step (the round, its slowed echoes, the chant), for checks: {at, role, cut, midi, rate, gate, gain, pan}.
  voicesOf,
  // Where the song runs below normal speed (seconds, plan time), for checks and the picture.
  slowOf,
  // The drone's runs (pushed chord changes), for checks.
  runsOf,
  // The composition constitution (CONSTITUTION.md; constitution.js lintTrack).
  references:{
    'panda-bear':'The lane: one steady loop of hands, floors and the office that never stops, leaning on the offbeats; voices are the instrument (her phrases and his vocoder stacked into rounds and a two-beat canon, a delay that becomes the rhythm, long reverb); one drone swaying I to IV.',
    'washed-out':'The warmth: the voices wobble like a worn tape loop, a slow tape under the second verse and the sign-off, soft focus at a walking tempo, Sink In under water.',
    'daft-punk':'The spine, worn lightly: the vocoder lead and his choir, a soft four on the floor pumping the pad and Pat, Pat and Kevin on the offbeats.',
    kraftwerk:'The grid under the haze: her ladder straight down to the 32nd, the office (keys, the printer, a mug) sequenced as loop material.',
  },
  palette:{
    synth:"Synergy's vocoder on a saw choir, sent round a two-beat canon in the drops; a wordless formant choir (oo, ah) as the drone, rising an octave through the build.",
    keys:'Keys on a pump organ: a reedy drone on its bellows, holding while the chord holds and moving on the "and" of four, opening across the intro and closing across the outro.',
    drums:'One loop of hands and floors: soft stomps on a wooden floor, a room of people clapping on two and four with a few hands on the "and"s, floor toms rolling after each beat, desk slaps into the choke, the printer as the shaker; keyboard clatter, a mug and a chair as loop material.',
    bass:'Pat: a warm hum on the root on the offbeats, a pedal D under the verse, a gentle walk in the drops, pumped by the stomp. No bass slam.',
    guitar:'Kevin: one clean figure on the offbeats, looping and ringing into the delay. Never a solo.',
  },
  story:{
    synergy:'Simple and a little stiff: short lines on repeated notes, two answers in bar 10, a stammer in bar 12; the canon and the choir turn one stiff voice into a room.',
    synthia:null,
  },
};
