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
import {BAR_STEPS, placeSlot, timingTable, hash, clearWords} from './song.js';
import {tokens} from './lyrics.js';
import {trackOf, castOf} from './songbook/index.js';
import {partOf, eventOf, keyOf, hasBand, SONG_TABLE} from './band.js';
import {pitchOf} from './drop.js';

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
  const bars = Array.from({length:W.bars}, (_, index) => ({index, section:sectionOf(index).name, chord:W.chordAt(index), layers:W.layers(index), cutoff:W.cutoff(index), swing:W.swing, energy:W.energy(index)}));
  const music = {step:STEP, scale:tr.music.scale, resolve:tr.music.resolve, home:tr.music.home};
  // Synergy: his hook once, washed into the river (or not at all).
  const lines = [], words = [];
  if (W.hook && lyrics.hook) {
    const placed = placeSlot({bar:W.hook.bar, startStep:W.hook.startStep ?? 0, window:W.hook.window ?? 24, text:lyrics.hook, kind:'hook', shape:'chant', harmony:true, once:true}, lyrics, durations, 0, music);
    lines.push(placed.line); words.push(...placed.words);
    clearWords(words, timing, durations);
  }
  const roles = castOf(cast), rc = riverCast(roles, W), seed0 = hash(`${lyrics.hook}|${tr.id}|river`);
  // The loop sources: her syllables (her ladder's words), his word, the couplet's "It's not X."
  const loops = [];
  const her = roles.ladder ? loopOf('her', {voice:'lady', file:roles.ladder.file, words:roles.ladder.words, text:roles.ladder.display, display:roles.ladder.display}, tr, 'her syllables, looped') : null;
  if (her) loops.push(her);
  const his = rc.his ? loopOf('his', rc.his, tr, 'his word, looped') : null;
  if (his) loops.push(his);
  const x = rc.couplet ? loopOf('x', rc.couplet.x, tr, '"It\'s not X." looped into the texture') : null;
  if (x) loops.push(x);
  // The clear phrases: the couplet's Y once, the refrain once, each rising out of the stream at its bar.
  const band = [], at = W.phrases;
  const phrase = (part, role, partName, bar, {extra = {}, gain = W.phraseGain ?? 2, seed = 0} = {}) => {
    const src = partOf(part);
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
  for (const e of band.filter(b => b.role !== 'pickup')) {
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
  return {form:'wander', title:'The river', bpm:tr.bpm, step:STEP, swing:W.swing, key:tr.key, sections:W.sections, bars, lines, words, stutters:[], lady:[],
    band, bandLeft:[], phrases:band, loops, layers, swells, slow, drifts,
    call:null, choke:null, tape:[], energyTrim:{}, makeup:W.makeup ?? 0, voiceLevel:W.voiceLevel ?? 1,
    stop:{at:fade[0], tapeEnd:null, line:null, end:fade[1], display:null, fade},
    timing, finale:false, totalSteps, duration:timing[totalSteps] + .6,
    track:tr.id, trackTitle:tr.title, kicks,
    marks:{flow:0, swell:W.swells[0].from * BAR_STEPS, fade:W.fade[0] * BAR_STEPS}};
}

function stepAfter(T, t) { let i = 0; while (i < T.length - 1 && T[i] < t) i++; return i; }

export const wanderVoicedWords = (lyrics, {track} = {}) => (trackOf(track).wander?.hook ? [...new Set(tokens(lyrics.hook).map(t => t.word))] : []);
export {SONG_TABLE};
