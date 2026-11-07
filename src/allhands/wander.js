// The wander form, "the river" (forms.js 'wander'): the haze lane's song. No
// ladder, no choke, no BACK.: sample loops repeat and thicken into a pixelated,
// melodic stream; layers fade and filter in only once the texture is lush; a
// steady loop of hands runs every bar; the tambourine sits in the background; at
// most two clear phrases of the band rise out of the stream and sink back in,
// and Synergy sings his hook once. Any track with a `wander` chart plays it
// (songbook/offsite.js). Pure: every layer, ramp, loop, note and phrase is
// decided here, before any audio exists; river.js plays it.
//
// The plan (seconds are plan time, timing[0] = 0):
//   form 'wander', title 'The river', sections (the phases, bars), bars[] {index, section, chord, layers, cutoff, swing, energy},
//   timing, step, bpm, key, totalSteps, duration, track, trackTitle, kicks, marks {flow, swell, fade}
//   lines, words: Synergy's hook, once (or none); stutters []; lady []
//   band: the clear phrases, shaped as the Drop Edition's band parts (band.js eventOf) plus
//         rise [a, b] and sink [a, b] (seconds: out of the stream, back into it); phrases: the same list
//   loops [{id, voice, file, key?, notes?, cuts [{from, to, base, text}], text, display, what}]: the sources the textures cut
//   layers [{id, kind, what, stem, source?, in [a, b], out [c, d], level, gain [[t, v]], filter [[t, hz]], pan [[t, p]], wash [[t, x]], delay [[t, x]], slow?}]
//   swells [{name, from, to, ref [a, b]}]: where the texture comes up, and the stretch it comes up over
//   slow [{from, to, rate, what, whole}]: the slow spans; drifts [{what, param, points [[t, x]]}]
//   choke null, call null, tape [], stop {at, tapeEnd:null, line:null, end, display:null, fade:[a, b]}
// A chart with a setlist (songbook/delve.js: her vocabulary) arranges her clear phrases itself, and adds
// (vocabulary() below; seconds are plan time):
//   band [P1..Pn]: eventOf's fields plus id, index, stage, clarity, pixel, wash, split, strike, font, k,
//         own (the river plays it, not playLady), voices [{kind, shift, delay, cents, gain, pan, lp, midi}],
//         words [{text, display, start, end, onset, file:[a, b]}]; a tape phrase: tape, warp [[file s, song s]]
//   echoes [{phrase, kind, at, end, word, midi, rate, gain, pan, tap, ...}]: delay | reverb | fifth | octave |
//         fade | step | freeze | canon, each a voice of hers the picture can draw (gain in dB under the phrase)
//   clarity [[t, x]], choir [{t, end, syllable, vowel, midi[4], voices}], stars {at, twinkles [{t, midi, pan, v,
//         hero}], density [[t, n]]}, clearMax, vocab {setlist ids}; marks gains {mouth, kiss, star, slow, swell2,
//         canon, delta, undraw} in seconds (flow, swell and fade stay in 16ths); fade [a, b] (s); bars[].pentatonic
import {BAR_STEPS, placeSlot, timingTable, hash, clearWords} from './song.js';
import {tokens} from './lyrics.js';
import {trackOf, castOf} from './songbook/index.js';
import {partOf, eventOf, keyOf, hasBand, SONG_TABLE} from './band.js';
import {pitchOf} from './drop.js';
import {LADY_TABLE} from './lady-table.js';
import {warpTimes} from './vocab-stages.js';
import {CHANT_SYLLABLES, CHANT_FILE, AH} from './lady-choir.js';

export const WANDER_SECTIONS = ['Source', 'Stream', 'Current', 'Swell', 'Pool', 'Delta'];
// The river's rules, as the constitution checks them (constitution.js lintPlan, form 'wander').
export const RIVER = Object.freeze({minRamp:2, maxRamp:8, phrases:2, synergy:1, phraseGap:4, lushBefore:3});

const pc = m => ((Math.round(m) % 12) + 12) % 12;
// The pentatonic note `k` steps from m (k may be negative).
export function pentaStep(m, k, penta) {
  let x = Math.round(m), n = 0;
  while (!penta.includes(pc(x))) x--;
  while (n < Math.abs(k)) { x += Math.sign(k); if (penta.includes(pc(x))) n++; }
  return x;
}
const nearestPenta = (m, penta) => { for (let d = 0; d < 6; d++) for (const x of [Math.round(m) - d, Math.round(m) + d]) if (penta.includes(pc(x))) return x; return Math.round(m); };

// The cast's voices for the river: which cuts loop, which phrases rise. Falls back
// to the chart's own band (W.defaults) when the cast has none (a song picked by hand).
function riverCast(roles, W) {
  const c = hasBand(roles) ? roles : {...roles, ...W.defaults};
  // His loop: the first of his parts the river does not sing clear.
  const his = [...(c.stabs || []), c.signoff, ...(c.exchanges || []).flatMap(x => [x.response, x.call]), c.refrain].find(p => p && p.voice === 'strategy' && partOf(p));
  return {couplet:c.couplet && partOf(c.couplet.x) && partOf(c.couplet.y) ? c.couplet : null, refrain:c.refrain && partOf(c.refrain) ? c.refrain : null, his, ladder:roles.ladder, sink:roles.sink};
}

// One loop source: a cut of a voice, its words as separate cuts, each with its pitch.
function loopOf(id, part, tr, what, {seed, words} = {}) {
  const src = partOf(part);
  if (!src) return null;
  const ws = src.words.filter((w, i) => !words || words.includes(i));
  if (src.key) {
    // A pixel take is sung onto a line (the bank's pitch chain), and each word keeps its note.
    const {penta} = keyOf(tr), reg = src.voice === 'strategy' ? [45, 52, 50, 47] : [57, 62, 59, 54];
    const notes = src.entry.words.flatMap((w, i) => (w.syllables?.length ? w.syllables : [[w.onset ?? w.start, w.end]]).map(([from, to], j) => ({from, to, midi:nearestPenta(reg[(i + j) % reg.length], penta), word:i})));
    return {id, what, voice:src.voice, file:src.file, key:src.key, amount:src.amount, notes, text:src.text, display:src.display,
      cuts:ws.map(w => ({from:w.start, to:w.end, base:notes.find(n => n.word === src.entry.words.indexOf(w))?.midi ?? 50, text:w.text}))};
  }
  return {id, what, voice:'lady', file:src.file, text:src.text, display:src.display,
    cuts:ws.map(w => ({from:w.start, to:w.end, base:pitchOf(src.file, w.start, w.end) ?? (69 + 12 * Math.log2((src.entry.f0 || 200) / 440)), text:w.text}))};
}

// A layer of the chart (bars) as the plan's (seconds): its ramps, and the curves river.js automates.
function layerOf(L, T, W, extra = {}) {
  const s = bar => T[Math.min(T.length - 1, Math.round(bar * BAR_STEPS))];
  const [a, b] = L.in, [c, d] = L.out, level = L.level ?? 1, inside = list => (list || []).filter(([bar]) => bar > b && bar < c);
  // Points in time order (the breath of a layer only between its ramps), the same time never twice.
  const tidy = pts => pts.filter((p, i) => !i || p[0] > pts[i - 1][0] + 1e-9);
  const swell = inside(L.swell), filt = inside(L.filter);
  const gain = tidy([[s(0), 0], [s(a), 0], [s(b), level], ...swell.map(([bar, x]) => [s(bar), level * x]), [s(c), level * (swell.at(-1)?.[1] ?? 1)], [s(d), 0]]);
  const open = L.open ?? 12000, shut = L.shut ?? 300;
  const filter = tidy([[s(0), shut], [s(a), shut], [s(b), open], ...filt.map(([bar, hz]) => [s(bar), hz]), [s(c), filt.at(-1)?.[1] ?? open], [s(d), shut]]);
  const curve = list => tidy((list || []).map(([bar, x]) => [s(bar), x]));
  return {id:L.id, kind:L.kind, what:L.what, stem:L.stem, source:L.source ?? null, in:[s(a), s(b)], out:[s(c), s(d)], inBars:[a, b], outBars:[c, d], level, open, shut, hp:L.hp ?? (L.kind === "bass" ? 30 : L.kind === "loop" || L.kind === "tambourine" ? 40 : L.kind === "drone" ? 190 : 140),
    gain, filter, pan:curve(L.pans), wash:curve(L.wash), delay:curve(L.delay), slow:!!L.slow, ...extra};
}

export function arrangeWander(lyrics, durations, options = {}) {
  const {track, cast} = options, tr = trackOf(track), W = tr.wander;
  if (!W) throw Error(`${tr.title} has no river (wander chart).`);
  const STEP = tr.step, totalSteps = W.bars * BAR_STEPS, timing = timingTable(totalSteps + BAR_STEPS, () => W.swing, STEP), T = timing;
  const sectionOf = bar => W.sections.find(s => bar >= s.from && bar < s.to) || W.sections.at(-1);
  const bars = Array.from({length:W.bars}, (_, index) => ({index, section:sectionOf(index).name, chord:W.chordAt(index), layers:W.layers(index), cutoff:W.cutoff(index), swing:W.swing, energy:W.energy(index),
    // (a chart whose pentatonic moves by bar names it per bar: Delve.'s Pool)
    ...(W.pentatonicAt ? {pentatonic:W.pentatonicAt(index)} : {})}));
  const music = {step:STEP, scale:tr.music.scale, resolve:tr.music.resolve, home:tr.music.home};
  // Synergy: his hook once, washed into the river (or not at all).
  const lines = [], words = [];
  if (W.hook && lyrics.hook) {
    const placed = placeSlot({bar:W.hook.bar, startStep:W.hook.startStep ?? 0, window:W.hook.window ?? 24, text:lyrics.hook, kind:'hook', shape:'chant', harmony:true, once:true}, lyrics, durations, 0, music);
    lines.push(placed.line); words.push(...placed.words);
    clearWords(words, timing, durations);
  }
  const roles = castOf(cast), rc = W.setlist ? {couplet:null, refrain:null, his:null} : riverCast(roles, W), seed0 = hash(`${lyrics.hook}|${tr.id}|river`);
  // The loop sources: her syllables (her ladder's words), his word, the couplet's "It's not X."
  // (A setlist chart names its own: W.loops.)
  const loops = W.setlist ? W.loops.map(chartLoop) : [];
  const her = W.setlist ? null : roles.ladder ? loopOf('her', {voice:'lady', file:roles.ladder.file, words:roles.ladder.words, text:roles.ladder.display, display:roles.ladder.display}, tr, 'her syllables, looped') : null;
  if (her) loops.push(her);
  const his = rc.his ? loopOf('his', rc.his, tr, 'his word, looped') : null;
  if (his) loops.push(his);
  const x = rc.couplet ? loopOf('x', rc.couplet.x, tr, '"It\'s not X." looped into the texture') : null;
  if (x) loops.push(x);
  // The clear phrases: the couplet's Y once, the refrain once, each rising out of the stream at its bar.
  const band = [], at = W.phrases, vocab = W.setlist ? vocabulary(W, tr, T, STEP) : null;
  if (vocab) band.push(...vocab.band);
  const phrase = (part, role, partName, bar, {extra = {}, gain = W.phraseGain ?? 2, seed = 0} = {}) => {
    const src = partOf(part, {release:role !== 'pickup'});
    if (!src) return null;
    const e = eventOf(src, {role, part:partName, anchor:bar * BAR_STEPS, gain, pan:0, tr:{...tr, drop:{ladder:{pentatonic:W.pentatonic}}, chordAt:W.chordAt}, T, step:STEP, seed:seed0 + seed, end:'home', extra:{clear:true, ...extra}});
    const beat = 4 * STEP;
    e.rise = [e.start - beat, e.start]; e.sink = [e.end, e.end + 4 * beat];
    // Synthia rises clear: light pixels over the stream (Aaron: light to medium as clarity allows).
    if (e.voice === 'synthia' && e.amount > W.synthiaAmount) e.amount = W.synthiaAmount;
    band.push(e);
    return e;
  };
  if (rc.couplet && at.y !== undefined) {
    const y = rc.couplet.y;
    if (y.pickup) {
      const p = phrase(y.pickup, 'pickup', 'couplet', at.y, {extra:{couplet:rc.couplet.id}, seed:5});
      if (p) phrase(y, 'couplet-y', 'couplet', Math.ceil(stepAfter(T, p.end + .05) / 2) * 2 / BAR_STEPS, {extra:{couplet:rc.couplet.id}, seed:6, gain:(W.phraseGain ?? 2) + (W.yLift ?? 0)});
    } else phrase(y, 'couplet-y', 'couplet', at.y, {extra:{couplet:rc.couplet.id}, seed:5, gain:(W.phraseGain ?? 2) + (W.yLift ?? 0)});
  }
  if (rc.refrain && at.refrain !== undefined) phrase(rc.refrain, 'refrain', 'refrain', at.refrain, {seed:7});
  // A phrase sinks back in: its last word loops, low, in the texture after it (an echo layer).
  const echoes = [];
  for (const e of band.filter(b => b.role !== 'pickup' && !b.own)) {
    const last = e.words.length - 1, src = partOf(e.role === 'refrain' ? rc.refrain : rc.couplet.y);
    const lp = loopOf(`${e.role}-echo`, e.role === 'refrain' ? rc.refrain : rc.couplet.y, tr, `the last word of "${e.display}", sinking back in`, {words:[src.words.length - 1]});
    if (lp) echoes.push({loop:lp.id, lp, after:e, last});
  }
  // The layers (the chart's, in bars) and their curves; the echo layers ramp in after their phrase.
  const layers = [];
  for (const L of W.layerSpec) {
    if (L.source && !loops.some(l => l.id === L.source)) continue;
    layers.push(layerOf(L, T, W));
  }
  for (const {loop, after} of echoes) {
    const barOf = t => { let b = 0; while (b + 1 < W.bars && T[(b + 1) * BAR_STEPS] <= t) b++; return b; };
    // It ramps in over two bars after its phrase, holds, and leaves by the end (two to three bars).
    const b0 = barOf(after.end) + 1, o0 = Math.max(b0 + 2, Math.min(W.bars - 3, b0 + 4));
    if (b0 + 4 > W.bars) continue;                        // no room to ramp in and out: the phrase sinks into the wash alone
    const spec = {id:loop, kind:'texture', what:`"${after.display}" sinking back into the stream`, stem:'lady', source:loop,
      in:[b0, b0 + 2], out:[o0, Math.min(W.bars, Math.max(o0 + 2, b0 + 7))], level:.5, open:5000, wash:[[b0, .5], [b0 + 4, .7]], delay:[[b0, .3]], pans:[[b0, -.3], [b0 + 6, .3]]};
    layers.push(layerOf(spec, T, W));
    loops.push(echoes.find(x => x.loop === loop).lp);
  }
  // The swells and the slow spans, in seconds.
  const s = bar => T[Math.min(totalSteps, Math.round(bar * BAR_STEPS))];
  const swells = W.swells.map(w => ({name:w.name, from:s(w.from), to:s(w.to), ref:[s(w.ref[0]), s(w.ref[1])], bars:[w.from, w.to], refBars:w.ref}));
  const slow = W.slow.map(w => ({from:s(w.from), to:s(w.to), rate:.5, what:w.what, whole:false, level:w.level, fade:w.fade}));
  const fade = [s(W.fade[0]), s(W.fade[1])];
  const kicks = [];
  bars.forEach(b => tr.wander.kicksOf(b.index, b.layers).forEach(st => kicks.push(b.index * BAR_STEPS + st)));
  const drifts = W.drifts.map(d => ({what:d.what, param:d.param, points:d.points.map(([bar, x]) => [s(bar), x])}));
  const plan = {form:'wander', title:'The river', bpm:tr.bpm, step:STEP, swing:W.swing, key:tr.key, sections:W.sections, bars, lines, words, stutters:[], lady:[],
    band, bandLeft:[], phrases:band, loops, layers, swells, slow, drifts,
    call:null, choke:null, tape:[], energyTrim:{}, makeup:W.makeup ?? 0, voiceLevel:W.voiceLevel ?? 1,
    stop:{at:fade[0], tapeEnd:null, line:null, end:fade[1], display:null, fade},
    timing, finale:false, totalSteps, duration:timing[totalSteps] + .6,
    track:tr.id, trackTitle:tr.title, kicks,
    marks:{flow:0, swell:W.swells[0].from * BAR_STEPS, fade:W.fade[0] * BAR_STEPS}};
  if (!vocab) return plan;
  // Her vocabulary: the stop is her last phrase (the song fades under it), and the fields the picture reads.
  const last = vocab.band.at(-1);
  plan.stop = {...plan.stop, line:last.start, end:last.end, display:last.display};
  Object.assign(plan.marks, vocab.marks);
  return Object.assign(plan, {echoes:vocab.echoes, clarity:vocab.clarity, choir:vocab.choir, stars:vocab.stars, clearMax:W.clearMax ?? vocab.band.length, fade, vocab:{setlist:vocab.band.map(e => e.id)}});
}

// ---- her vocabulary: a chart's setlist (songbook/delve.js) --------------------------------------
// A loop source a chart names: every word of each file, a cut each, with its pitch; files after the first
// are read from their own recordings (river.js joins them into one source for the textures).
function chartLoop(L) {
  const cuts = L.files.flatMap(file => LADY_TABLE[file].words.map(w => ({file, from:w.start, to:w.end, base:pitchOf(file, w.start, w.end) ?? 57, text:w.text})));
  return {id:L.id, what:L.what, voice:'lady', file:L.files[0], files:L.files, cuts, text:cuts.map(c => c.text).join(' '), display:null};
}
const dB20 = x => 20 * Math.log10(x);
const ringPan = (k, n) => +(.7 * Math.sin(2 * Math.PI * (k + .5) / n)).toFixed(3);

// The setlist's phrases (eventOf, tuned to the pentatonic of the bar each rises in), the echoes that
// follow them, her clarity, the choir's syllables, the stars and the moments, all from the chart.
function vocabulary(W, tr, T, STEP) {
  const S = st => T[Math.max(0, Math.min(T.length - 1, Math.round(st)))], band = [], echoes = [];
  W.setlist.forEach((p, index) => {
    const src = partOf({voice:'lady', file:p.file, words:[0, -1], display:p.display}), penta = W.pentatonicAt(p.bar);
    const e = eventOf(src, {role:'phrase', part:p.id, anchor:p.bar * BAR_STEPS + (p.step ?? 0), gain:p.gain ?? 0, pan:0, tr:{...tr, drop:{ladder:{pentatonic:penta}}, chordAt:W.chordAt}, T, step:STEP, seed:index, end:'home',
      extra:{clear:true, own:true, id:p.id, index, stage:p.stage, clarity:p.clarity, pixel:p.pixel ?? 0, wash:p.wash ?? .1, split:p.split ?? null, strike:p.strike ?? [], font:p.font ?? 'peg9', k:p.k ?? 1, pentatonic:penta}});
    e.words = e.words.map((w, i) => ({...w, file:[src.words[i].start, src.words[i].end]}));
    // Her first vowel exactly on its 16th (eventOf leads in at the untuned rate; her tuning moves it a few ms).
    const d = S(p.bar * BAR_STEPS + (p.step ?? 0)) - e.words[0].onset;
    e.start += d; e.end += d; e.words = e.words.map(w => ({...w, start:w.start + d, end:w.end + d, onset:w.onset + d}));
    { let i = 0; while (i + 1 < T.length && T[i + 1] <= e.start) i++; e.at = i + (e.start - T[i]) / STEP; }
    e.midi = e.midi ?? pitchOf(p.file, e.from, e.to);
    // A phrase on a slowing tape: its words where the tape puts them, and the warp the picture reads.
    if (p.tape) {
      e.tape = p.tape;
      const fileTimes = e.words.flatMap(w => [w.file[0], w.file[1], src.words[e.words.indexOf(w)].onset ?? w.file[0]]), {times, warp, length} = warpTimes(e, fileTimes);
      e.words = e.words.map((w, i) => ({...w, start:e.start + times[3 * i], end:e.start + times[3 * i + 1], onset:e.start + times[3 * i + 2]}));
      e.warp = warp.map(([f, t]) => [f, +(e.start + t).toFixed(4)]);
      e.end = e.start + length + .01; e.gate = length + .02;
    }
    if (p.wow) e.wow = p.wow;
    e.voices = (p.voices || []).map(v => {
      const shift = v.kind === 'harmony' ? pentaStep(e.midi, v.steps, penta) - Math.round(e.midi) : v.shift ?? 0;
      return {kind:v.kind, shift, delay:v.delay ?? 0, cents:v.cents ?? 0, gain:v.gain ?? 0, pan:v.pan ?? 0, lp:v.lp ?? null, midi:+(e.midi + shift).toFixed(2)};
    });
    e.rise = [e.start - 4 * STEP, e.start]; e.sink = [e.end, e.end + 16 * STEP];
    band.push(e);
    echoes.push(...echoesOf(p, e, W, S, STEP));
  });
  // Her clarity: 1 is crisp and dry; 0 is the choir.
  const clarity = [[0, 1]];
  for (const e of band) {
    const c = Array.isArray(e.clarity) ? e.clarity : [e.clarity];
    clarity.push([+e.start.toFixed(4), c[0]]);
    if (e.tape) clarity.push([+(e.start + (e.tape.slide - e.from) / e.rate).toFixed(4), c[1]]);
    if (e.stage === 'canon') { const canon = echoes.filter(h => h.phrase === e.id && h.kind === 'canon'); clarity.push([canon.find(h => h.voice === 3)?.at ?? e.end, c[0] / 2], [Math.max(...canon.map(h => h.at)), 0]); }
  }
  return {band, echoes, clarity, choir:choirOf(W, S), stars:starsOf(W, band, S, STEP), marks:Object.fromEntries(Object.entries(W.marks).map(([k, bar]) => [k, +S(bar * BAR_STEPS).toFixed(4)]))};
}

// The echoes of one phrase (gains in dB under the phrase; times in song seconds).
function echoesOf(p, e, W, S, STEP) {
  const out = [], wi = k => (k < 0 ? e.words.length + k : k), length = w => (w.file[1] - w.file[0]) / e.rate;
  const midiOfWord = w => +((pitchOf(e.file, w.file[0], w.file[1]) ?? e.midi) + 12 * Math.log2(e.rate)).toFixed(2);
  const add = h => { out.push({phrase:e.id, ...h, end:+(h.end).toFixed(4), at:+(h.at).toFixed(4)}); return out.at(-1); };
  const fadeOf = (feed, [from, to], spec = {}) => {
    const delay = 6 * STEP, lineSpec = {delay, feedback:.62, from:S(from), to:S(to), f0:3200, f1:350, gain:spec.gain ?? 0, pan:spec.pan ?? 0};
    feed.feeds = 'fade';
    for (let k = 1; feed.at + k * delay < lineSpec.to - .05; k++)
      add({kind:'fade', tap:k, at:feed.at + k * delay, end:Math.min(lineSpec.to, feed.at + k * delay + (feed.end - feed.at)), word:feed.word, midi:feed.midi, rate:feed.rate, gain:+((feed.gain ?? 0) + (spec.gain ?? 0) + dB20(.62 ** k)).toFixed(2), pan:k % 2 ? -.5 : .5, line:'fade', lineSpec});
  };
  if (p.chain) {
    const c = p.chain, k = wi(c.word), w = e.words[k], m = midiOfWord(w), len = length(w);
    let feed = null;
    (c.delay || []).forEach((st, j) => { feed = add({kind:'delay', tap:j + 1, at:S(st), end:S(st) + len, word:k, midi:m, rate:e.rate, gain:[-4, -8, -12][j] ?? -14, pan:[-.6, .6, -.4][j] ?? 0, lp:[5200, 3600, 2500][j] ?? 2000}); });
    if (c.reverb !== undefined) add({kind:'reverb', tap:1, at:S(c.reverb), end:S(c.reverb) + len, word:k, midi:m, rate:e.rate, gain:-1, pan:0});
    if (c.down) feed = add({kind:'fifth', tap:1, shift:-7, at:S(c.down.at), end:S(c.down.at) + len, word:k, midi:+(m - 7).toFixed(2), rate:e.rate, gain:-6, pan:.3, lp:4200});
    if (c.octave !== undefined) feed = add({kind:'octave', tap:1, at:S(c.octave), end:S(c.octave) + 2 * len, word:k, midi:+(m - 12).toFixed(2), rate:e.rate / 2, gain:-4, pan:-.3, lp:3200});
    if (c.fade && feed) fadeOf(feed, c.fade, {gain:-2});
  }
  if (p.steps) {
    const k = wi(p.steps.word), w = e.words[k], m = midiOfWord(w), len = length(w);
    let feed = null;
    p.steps.notes.forEach(([st, midi], j) => { feed = add({kind:'step', tap:j + 1, at:S(st), end:S(st) + len, word:k, midi, shift:+(midi - m).toFixed(3), rate:e.rate, gain:-3 - 2 * j, pan:j % 2 ? .5 : -.5, lp:5200 - 700 * j}); });
    if (p.steps.fade && feed) fadeOf(feed, p.steps.fade, {gain:-3});
  }
  if (p.freeze) {
    const f = p.freeze, k = wi(f.word), n = Math.round((f.until - f.from) / f.every);
    for (let j = 0; j < n; j++) {
      const st = f.from + j * f.every, u = n > 1 ? j / (n - 1) : 0;
      add({kind:'freeze', tap:j + 1, at:S(st), end:S(st + f.every) - .012, word:k, src:f.grain, midi:e.midi, rate:e.rate, gain:+(-1.5 - 12 * u).toFixed(2), pan:j % 2 ? .45 : -.45, amount:+(.3 + .3 * u).toFixed(3), lp:Math.round(6500 - 3500 * u)});
    }
  }
  if (p.canon) {
    const c = p.canon, chant = W.choir.chant, home = W.pentatonic, syl = CHANT_SYLLABLES;
    c.entries.forEach((entry, v) => {
      const tune = chant.map(([, , , midi]) => pentaStep(midi, c.offsets[v], home)), notes = syl.map((x, i) => [x.cut[0], x.cut[3], tune[i]]);
      for (let st = entry + (v === 0 ? c.every : 0); st < c.out[v]; st += c.every)
        add({kind:'canon', voice:v, tap:Math.round((st - entry) / c.every) + 1, at:S(st), end:S(st) + (e.to - e.from), word:null, src:[e.from, e.to], notes, midi:tune[0], rate:1, gain:+(-4 - 1.1 * v).toFixed(2), pan:ringPan(v, c.entries.length), amount:+Math.min(.8, .45 + .05 * v).toFixed(2)});
    });
  }
  return out;
}

// The choir's syllables, as the picture mouths them: the chant on home ground, the held "ah" in the Pool
// (on the chord, from the push before it), with how many of her are singing.
function choirOf(W, S) {
  const C = W.choir, layer = W.layerSpec.find(l => l.kind === 'choir'), from = layer.in[0], to = layer.out[1], out = [];
  const singing = bar => C.singers.filter(s => bar >= s.from + 1).length || (bar >= from ? 1 : 0);
  for (let block = Math.floor(from / 2) * 2; block < to; block += 2) {
    const pool = block >= C.pool[0] && block < C.pool[1];
    if (pool) {
      const chord = W.chordAt(block), a = block * BAR_STEPS - (W.push ?? 0), b = (block + 2) * BAR_STEPS - (block + 2 < C.pool[1] ? W.push ?? 0 : 0);
      out.push({t:+S(a).toFixed(4), end:+S(b).toFixed(4), syllable:'ah', vowel:'ah', midi:[...chord.choir], voices:singing(block), file:AH.file});
      continue;
    }
    for (const [at, len, k, midi] of C.chant) {
      const st = block * BAR_STEPS + at, bar = Math.floor(st / BAR_STEPS);
      if (bar < from || bar >= to) continue;
      out.push({t:+S(st).toFixed(4), end:+S(st + len).toFixed(4), syllable:CHANT_SYLLABLES[k].text, vowel:CHANT_SYLLABLES[k].vowel, midi:C.singers.map(s => pentaStep(midi, s.steps, W.pentatonic)), voices:singing(bar), file:CHANT_FILE});
    }
  }
  return out;
}

// The stars: one born on each chime (plan.stars.twinkles), on the bar's pentatonic high up, never over a
// clear phrase of hers except "A rich tapestry", whose three words are the first three; heroes where the
// chart says, and the last one. density: the stars alive, as the picture counts them.
function starsOf(W, band, S, STEP) {
  const St = W.stars, out = [], slots = [2, 10, 6, 14, 4, 12, 0, 8, 3, 11, 7, 15], first = band.find(e => S(St.at * BAR_STEPS) >= e.start - .01 && S(St.at * BAR_STEPS) <= e.end);
  const busy = t => band.some(e => e !== first && t > e.start - .25 && t < e.end + .25);
  const count = bar => { let n = 0; for (const [b, k] of St.perBar) if (bar >= b) n = k; return n; };
  let seed = 7;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const noteOf = (bar, j) => { const pen = W.pentatonicAt(bar), notes = []; for (let m = St.octave[0]; m <= St.octave[1]; m++) if (pen.includes(((m % 12) + 12) % 12)) notes.push(m); return notes[Math.floor(next() * notes.length)]; };
  for (let bar = St.at; bar < W.bars; bar++) {
    let n = count(bar);
    if (bar === St.at && first) {
      first.words.forEach((w, j) => out.push({t:+w.onset.toFixed(4), midi:noteOf(bar, j), pan:[0, -.4, .4][j] ?? 0, v:.6, hero:j === 0, word:j, phrase:first.id}));
      n -= first.words.length;
    }
    for (const s of slots) {
      if (n <= 0) break;
      const t = S(bar * BAR_STEPS + s);
      if (busy(t) || out.some(x => Math.abs(x.t - t) < STEP * 1.5)) continue;
      out.push({t:+t.toFixed(4), midi:noteOf(bar, s), pan:+((next() * 2 - 1) * .7).toFixed(2), v:+(.3 + .25 * next()).toFixed(2), hero:false});
      n--;
    }
  }
  for (const h of St.heroes) { const t = S(h * BAR_STEPS), x = out.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)); x.hero = true; x.v = Math.max(x.v, .6); }
  out.sort((a, b) => a.t - b.t);
  out.at(-1).hero = true;
  return {at:+S(St.at * BAR_STEPS).toFixed(4), twinkles:out, density:St.alive.map(([bar, k]) => [+S(bar * BAR_STEPS).toFixed(4), k])};
}

function stepAfter(T, t) { let i = 0; while (i < T.length - 1 && T[i] < t) i++; return i; }

export const wanderVoicedWords = (lyrics, {track} = {}) => (trackOf(track).wander?.hook ? [...new Set(tokens(lyrics.hook).map(t => t.word))] : []);
export {SONG_TABLE};
