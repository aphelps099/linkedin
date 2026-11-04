// Video Studio EDL core (src/videostudio/edl, layouts.js, moves/). Pure Node.
// Sections count with ok(); the last line is the summary.
//   1. schema: validation with readable paths, byte-stable round trips
//   2. anchors against the real drop60 and soundcheck plans, and a 128 BPM plan
//   3. params: eases and their integrals, keyframes, binds, feature tracks
//   4. remap: rate integration, reverse, stutter, ping-pong, freeze, tape coupling,
//      transports, speed fit, hit warp
//   5. cuts land on round(t·24) (the metronome EDL, every plan)
//   6. layouts: inside the frame, gutters, radius, ids, nesting
//   7. every move yields a valid EDL that compiles clean
//   8. reverse, mirror, repeat, zoom, decode and canon violations are caught
//   9. a 60 s film: deterministic (hash of two runs) and fast (best of 7 warm compiles <= 100 ms)
//  10. the real shot index (src/videostudio/media/shots.json), when present
//  11. with --render: feature tracks from a real engine.render stems render, in
//      headless Chromium (about 30 s): channel mapping, the choke, the ladder
// node scripts/check-videostudio.mjs [--verbose] [--render] [--dump DIR]   (--dump writes the film's EDL and the fixture shots)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {createRequire} from 'node:module';
import {FORMS} from '../src/allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {timingTable, STEP} from '../src/allhands/song.js';
import {withColdOpen} from '../src/allhands/drop.js';
import {kickSteps} from '../src/pegboard/eq.js';
import {validate, stringify, parse, createEDL, merge, canonical, FX, FX_TYPES} from '../src/videostudio/edl/schema.js';
import {resolveAt, stepTime, stepAtTime, ladyTime, cutFrame, pegFrame, hitFrame, audioLatency, listAnchors} from '../src/videostudio/edl/anchors.js';
import {EASES, evaluate, paramFn, integrateKeys, planFeatures, buildFeatures, envelope, levelOf, checkParam} from '../src/videostudio/edl/params.js';
import {gauss, tapeCurve, speedFit, hitWarp, transportTime, clipTimeMap} from '../src/videostudio/edl/remap.js';
import {compile, shotIndex, layerMatrix, invert, apply, resolveCrop, DECODE_LIMITS} from '../src/videostudio/edl/compile.js';
import {metronomeEDL, expectedCuts} from '../src/videostudio/edl/metronome.js';
import {FORMATS, CLASSES, GUTTER, RADIUS, SAFE, HOME, FULL_BOARD, sameRect, insideSafeBand, layout, cellRect, layoutClassOf, cellIds} from '../src/videostudio/layouts.js';
import {boardGrid, boardTypeBounds, safeSpan} from '../src/videostudio/gl/board-layer.js';
import {buildScreens} from '../src/pegboard/choreo.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';
import {MOVES, MOVE_NAMES} from '../src/videostudio/moves/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; if (verbose) console.log('  ok', m); };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const log = s => console.log(s);
// Composite Gauss-Legendre, 256 panels: a reference integral independent of the code under test's piece sizes.
const quad = (f, a, b, n = 256) => { let s = 0; for (let i = 0; i < n; i++) s += gauss(f, a + (b - a) * i / n, a + (b - a) * (i + 1) / n); return s; };
const section = (name, fn) => { const before = checks; fn(); log(`${name}: ${checks - before} checks`); };

// ---- fixtures ---------------------------------------------------------------------------------
const POSTS = [SAMPLE_POST, `Humbled and honored to share that I've been promoted to Senior Director of Synergy. This journey taught me that leadership is a mindset, not a title. Agree?`];
const durations = (form, lyrics) => Object.fromEntries(form.voiced(lyrics).map(w => [w, .18 + .11 * syllables(w)]));
const planOf = (id, post = SAMPLE_POST) => { const l = lyricsFromPost(post), f = FORMS[id]; return f.arrange(l, durations(f, l)); };
const drop = planOf('drop60'), sound = planOf('soundcheck');
// A plan at 128 BPM with swing: a step is 2.8125 frames, never a whole number.
function tempoPlan(bpm, bars = 8, swing = .1) {
  const step = 60 / bpm / 4, steps = bars * 16, timing = new Float64Array(steps + 17);
  for (let i = 0; i < timing.length; i++) timing[i] = i * step + (i % 2 ? swing * step : 0);
  const sections = [{name:'Intro', from:0, to:2}, {name:'Verse', from:2, to:bars}];
  return {form:`test${bpm}`, bpm, step, timing, totalSteps:steps, duration:timing[steps] + .5, sections, words:[], lines:[], lady:[], stutters:[],
    bars:Array.from({length:bars}, (_, index) => ({index, layers:{drums:'four', kick:true, clap:true, hats:true, bass:'offbeat'}}))};
}
const t128 = tempoPlan(128);

const box = {x:0, y:0, w:1280, h:672};
const crops = {'9:16':[456, 0, 378, 672], '1:1':[304, 0, 672, 672], '16:9':[0, 0, 1194, 672]};
const S = (id, o) => ({id, width:1280, height:720, fps:24, contentBox:[0, 0, 1280, 672], safeCrops:crops, sharpTier:'A', status:'C', ...o});
const SHOTS = [
  S('synergy', {characters:['Synergy'], tracking:'synergy', stem:'voice', action:['idle', 'listen'], roles:['voice.hero'], reverseClass:'R1', duration:17, faceBox:{x:548, y:137, w:160, h:132}}),
  S('drums', {characters:['Operations'], stem:'drums', roles:['drums.hero'], action:['play'], reverseClass:'R0', duration:9.5, hits:Array.from({length:19}, (_, i) => 6 + 12 * i + [0, 1, 0, -1][i % 4])}),
  S('keys', {characters:['Keys'], stem:'keys', action:['listen'], reverseClass:'R1', duration:9.5, faceBox:{x:500, y:90, w:280, h:280}}),
  S('guitar', {characters:['Kevin'], stem:'guitar', action:['play'], reverseClass:'R0', duration:4.417, sharpTier:'B'}),
  S('people', {characters:['People & Culture'], action:['listen'], reverseClass:'R1', mirrorable:true, duration:9.5, faceBox:{x:520, y:100, w:260, h:270}}),
  S('arjun', {characters:['Arjun'], role:'Finance', action:['listen'], reverseClass:'R1', mirrorable:true, duration:9.5, faceBox:{x:540, y:120, w:240, h:260}}),
  S('printer', {characters:['Printer'], shotType:'printer', action:['print'], reverseClass:'R0', duration:4}),
  S('synthia', {characters:['Synthia'], action:['listen'], reverseClass:'R1', duration:9.5, sharpTier:'B'}),
  S('strategy', {characters:['Strategy'], action:['listen'], reverseClass:'R1', duration:9.5, sharpTier:'B', mirrorable:true}),
  S('linda', {characters:['Linda'], action:['listen'], reverseClass:'R1', duration:7.5}),
  S('kevin-take', {characters:['Kevin'], action:['speak'], reverseClass:'R0', duration:9.5}),
  // Canon traps: these must never reach the screen.
  S('pat-webcam', {characters:['Pat'], action:['listen'], reverseClass:'R1', duration:9.5}),
  S('lady-face', {characters:['the lady'], action:['speak'], reverseClass:'R1', duration:9.5}),
  S('old-take', {characters:['Keys'], action:['listen'], reverseClass:'R1', duration:9.5, status:'E'}),
];
const shots = shotIndex(SHOTS), features = planFeatures(drop);
const run = (edl, opts = {}) => compile(edl, {plan:drop, shots, features, ...opts});
const errorsOf = (p, rule) => p.lint.errors.filter(e => !rule || e.rule === rule);

// =================================================================================================
section('1. schema', () => {
  const good = createEDL({clips:[{id:'a', at:0, len:16, cell:'G6.0', asset:'shot:keys', time:{in:1, rate:[[0, 1], [8, .5, 'outExpo']]}, frame:{zoom:{bind:'kick', base:1, scale:.1, release:.1}}, fx:[{type:'rgbSplit', px:4}]}]});
  ok(validate(good).length === 0, 'a valid EDL has no errors');
  const bad = createEDL({format:'4:5', clips:[
    {id:'a', at:-1, len:0, cell:'G6.9', asset:'shot', time:{rate:[[0, 1, 'bounce']], repeat:{unit:0, count:1.5}}, fx:[{type:'blurry'}, {type:'mosaic', size:4}]},
    {id:'a', at:{anchor:'bar:4', offset:2}, len:4, cell:'full', asset:'gen:board', chrome:{mic:'loud'}},
  ], transports:[{at:0, len:4, kind:'rewind'}], overrides:[{target:'a', rule:'G14'}]});
  bad.fps = 30;
  const errs = validate(bad), paths = errs.map(e => e.path);
  if (verbose) for (const e of errs) log(`    ${e.path}: ${e.message}`);
  for (const p of ['format', 'fps', 'clips[0].at', 'clips[0].len', 'clips[0].asset', 'clips[0].time.rate[0][2]', 'clips[0].time.repeat.unit', 'clips[0].time.repeat.count', 'clips[0].fx[0].type', 'clips[0].fx[1].size', 'clips[1].id', 'clips[1].at.offset', 'clips[1].chrome.mic', 'transports[0].audio', 'overrides[0].rule', 'overrides[0].note'])
    ok(paths.includes(p), `validation names the path ${p}`);
  ok(errs.every(e => typeof e.message === 'string' && e.message.length > 8), 'every error reads as a sentence');
  // Byte-stable: canonical order whatever order the keys arrived in.
  const s1 = stringify(good);
  const reorder = x => Array.isArray(x) ? x.map(reorder) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, reorder(v)])) : x;
  ok(stringify(reorder(good)) === s1 && JSON.stringify(reorder(good)) !== JSON.stringify(good), 'stringify is canonical: key order never changes the bytes');
  ok(stringify(parse(s1)) === s1, 'stringify(parse(s)) === s');
  ok(JSON.stringify(canonical(parse(s1))) === JSON.stringify(canonical(good)), 'parse returns the same document');
  ok(stringify({...good, clips:[{...good.clips[0], x:undefined}]}) === s1 && stringify({...good, song:{...good.song, steps:-0 + 480}}) !== s1, 'undefined fields vanish; real changes change the bytes');
  ok(FX_TYPES.length >= 12 && FX_TYPES.every(t => Object.values(FX[t].params).every(p => p.doc)), `the fx vocabulary documents every parameter (${FX_TYPES.length} types)`);
  ok(checkParam({mul:[1.1, [[0, 1], [4, 2, 'inQuad']]]}, 'p').length === 0 && checkParam({bind:'stem:bass'}, 'p').length === 0 && checkParam({bind:'loudness'}, 'p').length === 1, 'Params: mul, keys and binds check');
});

// =================================================================================================
section('2. anchors', () => {
  for (const [label, plan] of [['drop60', drop], ['soundcheck', sound], ...POSTS.slice(1).map(p => ['drop60/post2', planOf('drop60', p)])]) {
    for (let s = 0; s <= plan.totalSteps; s += 8) ok(stepTime(plan, s) === plan.timing[s] && resolveAt(plan, s).time === plan.timing[s], `${label}: step ${s} is plan.timing[${s}]`);
    const kinds = {};
    for (const w of [...plan.words].sort((a, b) => a.at - b.at)) {
      const n = kinds[w.kind] = (kinds[w.kind] ?? -1) + 1, r = resolveAt(plan, {anchor:`word:${w.kind}#${n}`, frames:-1});
      ok(near(r.time, plan.timing[w.at] - 1 / 24) && r.frame === Math.round((plan.timing[w.at] - 1 / 24) * 24), `${label}: word:${w.kind}#${n} is one frame before ${w.display}`);
    }
    const roles = {};
    for (const e of plan.lady) {
      const n = roles[e.role] = (roles[e.role] ?? -1) + 1, r = resolveAt(plan, {anchor:`lady:${e.role}#${n}`});
      ok(near(r.time, plan.timing[Math.floor(e.at)] + (e.at % 1) * plan.step) && r.frame === cutFrame(r.time), `${label}: lady:${e.role}#${n} at the engine's time`);
    }
    for (const s of plan.sections) ok(resolveAt(plan, {anchor:`section:${s.name}`}).step === s.from * 16, `${label}: section:${s.name}`);
    const all = listAnchors(plan);
    ok(all.length > 40 && all.every(a => a.frame === Math.round(a.time * 24)), `${label}: ${all.length} anchors, every one on round(t·24)`);
    for (let i = 0; i < 50; i++) { const s = i * 9.37; ok(near(stepAtTime(plan, stepTime(plan, s)), s, 1e-9), `${label}: stepAtTime inverts stepTime at ${s.toFixed(2)}`); }
  }
  // The drop's landmarks.
  const at = a => resolveAt(drop, {anchor:a});
  ok(at('cue:impact').time === 40 && at('cue:impact').frame === 960, 'cue:impact is 40.000 s, frame 960');
  ok(at('cue:choke').time === 39 && at('cue:choke').frame === 936, 'cue:choke is 39.000 s, frame 936');
  ok(at('cue:unmute').time === 4 && at('cue:sink').time === 46 && at('cue:stop').time === 59, 'cue:unmute 4 s, cue:sink 46 s, cue:stop 59 s');
  ok(at('section:Drop B').frame === 1152 && at('section:drop-b').step === 384 && at('section:Build').time === 24, 'sections by name, any case or spacing');
  ok(at('lady:r7#3').time === 38 + 1.5 * drop.step && at('lady:r0').frame === 576, 'lady:r7#3 is a 32nd past 38 s; lady:r0 is 24 s');
  ok(at('lady:impact').time === 40 && at('lady:tag').time === 39 && at('lady:stop').time === 59, 'lady roles: impact, tag, stop');
  ok(at('lady:r6#-1').step === 18 * 16 + 14 && at('bar:20').step === 320 && resolveAt(drop, {anchor:'bar:20', off:-2, frames:1}).frame === Math.round((drop.timing[318] + 1 / 24) * 24), 'negative indexes, off and frames');
  ok(resolveAt(sound, 3).time === 3 * STEP + .12 * STEP && resolveAt(sound, 3).frame === 9, 'soundcheck swing: step 3 is 15 ms late, still frame 9');
  for (const a of ['cue:nope', 'lady:r9', 'word:hook#999', 'section:Bridge', 'banana:1']) ok((() => { try { resolveAt(drop, {anchor:a}); return false; } catch (e) { return /./.test(e.message); } })(), `"${a}" fails with a reason`);
  // Another tempo: a step is 2.8125 frames.
  const f = s => resolveAt(t128, s).frame;
  ok(f(1) === Math.round(t128.timing[1] * 24) && f(16) === 45 && f(17) === Math.round(t128.timing[17] * 24), '128 BPM: frames from the table, not from a tempo (bar 1 at frame 45)');
  // The timing rule: cuts on round(t·24); hits (pegs, flashes, the impact, punch-ins) on the frame that
  // holds the audible onset, floor((t + L)·24), L the engine's latency (720 samples at 44.1 kHz).
  const L = 720 / 44100;
  ok(near(audioLatency(drop), L) && pegFrame(1) === 24 && pegFrame(.98) === 23 && pegFrame(.985) === 24 && hitFrame(.985, drop) === 24, 'pegs are hits: floor((t + 16.33 ms)·24)');
  let cutOk = 0, hitOk = 0, n128 = 0;
  for (let s = 0; s < t128.totalSteps; s++) {
    const t = t128.timing[s], c = resolveAt(t128, s).frame, h = resolveAt(t128, {anchor:`step:${s}`, hit:true}).frame;
    n128++; if (Math.abs(c / 24 - t) <= 1 / 48 + 1e-9) cutOk++;
    if (h / 24 <= t + L + 1e-9 && t + L < (h + 1) / 24) hitOk++;
  }
  ok(cutOk === n128 && hitOk === n128, `128 BPM, every step: ${cutOk}/${n128} cuts within half a frame of the beat, ${hitOk}/${n128} hits on the frame that holds the sound`);
});

// =================================================================================================
section('3. params', () => {
  for (const [name, E] of Object.entries(EASES)) {
    if (name === 'step') { ok(E.f(.5) === 0 && E.f(1) === 1 && E.F(.7) === 0, 'step holds, then jumps'); continue; }
    ok(near(E.f(0), 0, 1e-12) && near(E.f(1), 1, 1e-12), `${name}: 0 → 1 with no jump`);
    for (const u of [.13, .5, .77, 1]) ok(near(E.F(u), quad(E.f, 0, u), 1e-13), `${name}: F(${u}) is the integral of f`);
  }
  const ctx = {plan:drop, origin:{step:64, shift:0, frame:192}, fps:24, features};
  const p = [[0, 1], [16, 2], [32, 2, 'step'], [48, 0, 'inQuad']];
  ok(evaluate(p, 7, ctx) === 1 && evaluate(p, 8, ctx) === 1 && near(evaluate(p, 9, ctx), 1.5) && evaluate(p, 11, ctx) === 2 && near(evaluate(p, 13, ctx), 1.5) && evaluate(p, 15, ctx) === 0, 'keys: hold, linear, step hold, inQuad to 0, hold');
  ok(near(paramFn(p, ctx)(9.3), evaluate(p, 9.3, ctx)), 'paramFn equals evaluate');
  const pe = t => evaluate(p, t, ctx);
  ok(near(integrateKeys(p, 7, 13, ctx), quad(pe, 7, 8) + quad(pe, 8, 10) + quad(pe, 10, 11) + quad(pe, 11, 12) + quad(pe, 12, 13), 1e-12), 'integrateKeys: closed form, piece by piece');
  const fr = {keys:[[0, 1], [3, 1.6, 'outQuad']], unit:'frames'};
  ok(evaluate(fr, 192 / 24, ctx) === 1 && evaluate(fr, 195 / 24, ctx) === 1.6, 'frame-unit keys count frames from the clip\'s cut');
  ok(evaluate({mul:[2, {add:[1, 3]}]}, 0, ctx) === 8, 'mul and add compose');
  // Binds: the kick envelope, attack 0, release 0.1 s.
  const env = envelope(features, {bind:'kick', release:.1}), kicks = kickSteps(drop), k0 = [...kicks.keys()].find(s => kicks[s] && s > 64);
  const g = pegFrame(drop.timing[k0]);
  ok(env[g] === 1 && near(env[g + 1], Math.exp(-1 / 24 / .1), 1e-6) && env[g - 1] < .5, `kick bind: 1 on the kick frame ${g}, then e^(-t/release)`);
  ok(evaluate({bind:'kick', base:1, scale:.2, release:.1}, g / 24, ctx) === 1.2, 'base + scale · envelope');
  ok(features.frames === Math.ceil(drop.duration * 24) && features.source === 'plan', `plan features: ${features.frames} frames`);
  const fv = features.stems.voice, w0 = drop.words[0];
  ok(fv[Math.floor(drop.timing[w0.at] * 24) + 1] > .5 && features.stems.voice[10] === 0, 'plan features: the voice is on while Synergy sings');
  const choke = Math.ceil(drop.timing[drop.choke.at] * 24) + 13;
  ok(['drums', 'bass', 'keys', 'guitar', 'voice', 'lady'].every(n => features.stems[n][choke] === 0), 'plan features: the choke silences every stem');
  // Offline features from rendered stems: a synthetic render with a -20 dBFS drums sine.
  const sr = 8000, n = Math.ceil((drop.duration + .2) * sr), channels = {drums:new Float32Array(n), bass:new Float32Array(n), keys:new Float32Array(n), guitar:new Float32Array(n), voice:new Float32Array(n), lady:new Float32Array(n)};
  for (let i = 0; i < n; i++) channels.drums[i] = .1 * Math.SQRT2 * Math.sin(2 * Math.PI * 60 * i / sr);
  const F = buildFeatures(drop, {sampleRate:sr, channels, master:[channels.drums, channels.drums]}, {offset:.05, eqBands:4});
  ok(near(F.stems.drums[200], levelOf(.1), .01) && near(levelOf(.1), 40 / 54, 1e-9) && F.stems.bass[200] === 0, 'render features: RMS level 0..1 (-20 dBFS reads .74)');
  ok(F.kick.every((v, i) => v === features.kick[i]) && F.kickLevel[200] > .5 && F.eq.N === 4 && F.eq.data.length === 4 * F.frames, 'render features: exact plan kicks, the drums low band, master EQ');
});

// =================================================================================================
section('4. remap', () => {
  const T = s => drop.timing[s];
  const edl = createEDL({format:'16:9', clips:[
    {id:'const', at:64, len:32, cell:'G4.0', asset:'shot:keys', time:{in:1.5, rate:.75}},
    {id:'ramp', at:64, len:32, cell:'G4.1', asset:'shot:people', time:{in:1, rate:[[0, 1], [32, .5]]}},
    {id:'expo', at:64, len:32, cell:'G4.2', asset:'shot:arjun', time:{in:0, rate:[[0, 2], [16, .5, 'outExpo'], [32, 1, 'inOutSine']]}},
    {id:'rev', at:64, len:16, cell:'G4.3', asset:'shot:synergy', time:{in:10, reverse:true}},
    {id:'stut', at:128, len:16, cell:'G4.0', asset:'shot:keys', time:{in:3, repeat:{unit:1, count:4, vary:[{}, {}, {zoom:1.15}, {zoom:1.32}]}}},
    {id:'pp', at:128, len:16, cell:'G4.1', asset:'shot:people', time:{in:2, repeat:{unit:4, count:4, pingpong:true, vary:[{}, {}, {mirror:'x'}, {zoom:1.1}]}}},
    {id:'frz', at:128, len:16, cell:'G4.2', asset:'shot:arjun', time:{in:2, freezeAt:{at:4, len:8}}},
    {id:'still', at:128, len:16, cell:'G4.3', asset:'shot:printer', time:{freezeAt:{src:3.75}}},
    {id:'tape', at:352, len:32, cell:'G4.0', asset:'shot:people', time:{in:2, tape:true}},
    {id:'tapeRamp', at:352, len:32, cell:'G4.1', asset:'shot:arjun', time:{in:1, tape:true, rate:[[0, 1], [32, 2]]}},
  ], transports:[{at:{anchor:'bar:12'}, len:4, kind:'rewind', audio:true}, {at:{anchor:'cue:stop'}, len:8, kind:'tapestop', audio:true}]});
  const p = run(edl), L = (f, id) => p.all[f].layers.find(l => l.clipId === id);
  ok(p.lint.ok, `the remap fixture compiles clean (${p.lint.errors.map(e => e.message).join('; ')})`);
  // Constant rate: in + r·(t − t0), exactly.
  let worst = 0;
  for (let f = 192; f < 288; f++) worst = Math.max(worst, Math.abs(L(f, 'const').srcTime - (1.5 + .75 * (f - 192) / 24)));
  ok(worst < 1e-12, `constant rate: exact (max error ${worst.toExponential(1)} s)`);
  // A linear ramp 1 → .5 over 4 s: S = in + t − t²/(4D), D = 4 s. Closed form at every frame, last frame included.
  worst = 0;
  for (let f = 192; f < 288; f++) { const t = (f - 192) / 24, D = T(96) - T(64); worst = Math.max(worst, Math.abs(L(f, 'ramp').srcTime - (1 + t - .25 * t * t / D))); }
  ok(worst < 1e-12, `linear rate ramp: closed form at every frame (max error ${worst.toExponential(1)} s, no drift)`);
  // Eased rates: against the closed-form integral of the keys.
  worst = 0;
  const ectx = {plan:drop, origin:{step:64, shift:0, frame:192}, fps:24};
  const rate = [[0, 2], [16, .5, 'outExpo'], [32, 1, 'inOutSine']];
  const re = t => evaluate(rate, t, ectx), k1 = T(80);
  for (let f = 192; f < 288; f++) { const t = f / 24; worst = Math.max(worst, Math.abs(L(f, 'expo').srcTime - (t <= k1 ? quad(re, 8, t) : quad(re, 8, k1) + quad(re, k1, t)))); }
  ok(worst < 1e-12, `outExpo and inOutSine rates: the closed form equals an independent 256-panel quadrature (max error ${worst.toExponential(1)} s)`);
  // Reverse: forward time falls; the reversed proxy is sampled at duration − t, frame for frame.
  const r0 = L(192, 'rev'), r1 = L(200, 'rev');
  ok(r0.reverse && r0.srcTime === 10 && near(r1.srcTime, 10 - 8 / 24, 1e-12), 'reverse: the source runs backwards from in');
  let pairs = 0;
  for (let f = 192; f < 240; f++) { const l = L(f, 'rev'); if (l.proxyFrame === 408 - 1 - l.srcFrame && near(l.proxyTime, (l.proxyFrame + .5) / 24) && Math.floor(l.proxyTime * 24) === 407 - Math.floor(l.srcTime * 24 + 1e-6) && near(17 - l.srcTime, l.proxyTime, .5 / 24 + 1e-9)) pairs++; }
  ok(pairs === 48, 'reverse: proxyFrame = frames − 1 − srcFrame, proxyTime its centre, within half a frame of duration − t');
  // Stutter: every repeat shows the first slice's frames.
  const slice = [0, 1, 2].map(i => L(384 + i, 'stut').srcFrame);
  ok(slice.join() === '72,73,74' && [1, 2, 3].every(k => [0, 1, 2].every(i => L(384 + 3 * k + i, 'stut').srcFrame === slice[i])), 'stutter: 4 × one 16th, the same three frames each time');
  ok(L(384, 'stut').source === 'stream' && L(387, 'stut').source === 'stutter' && L(390, 'stut').transform.zoom === 1.15 && L(393, 'stut').transform.zoom === 1.32, 'stutter: repeats come from the cache; the third and fourth vary');
  ok(p.cuts.includes(387) && p.cuts.includes(390) && p.cuts.includes(393), 'stutter restarts are cuts');
  // Ping-pong: the odd repeat replays the slice backwards, frame for frame.
  const fwd = Array.from({length:12}, (_, i) => L(384 + i, 'pp').srcFrame), back = Array.from({length:12}, (_, i) => L(396 + i, 'pp').srcFrame);
  ok(fwd.join() === Array.from({length:12}, (_, i) => 48 + i).join() && back.join() === [...fwd].reverse().join() && L(396, 'pp').reverse && L(396, 'pp').source === 'stutter', 'ping-pong: 48..59 then 59..48, from the cache');
  ok(L(408, 'pp').srcFrame === 48 && L(408, 'pp').transform.mirror === 'x', 'ping-pong: the third repeat runs forward again, mirrored');
  // Freeze.
  const frz = Array.from({length:16}, (_, i) => L(396 + i, 'frz'));
  ok(frz.every(l => l.srcTime === 2.5 && l.source === 'still') && L(420, 'frz').srcTime === 2.5 && L(420, 'frz').source === 'stream' && near(L(421, 'frz').srcTime, 2.5 + 1 / 24, 1e-12), 'freezeAt {at, len}: holds two beats, then plays on from the held frame');
  ok([0, 5, 47].every(i => L(384 + i, 'still').srcTime === 3.75 && L(384 + i, 'still').source === 'still'), 'freezeAt {src}: the printer\'s still frame');
  // Tape coupling: the picture follows the engine's delay line (pitch 1 → .5 across Sink In).
  const tape = tapeCurve(drop), s0 = T(368), s1 = T(384), D = s1 - s0, content = t => t <= s0 ? t : t < s1 ? t - .25 * D * ((t - s0) / D) ** 2 : t - .25 * D;
  ok(tape.segments.length === 2 && near(tape.contentAt(47), content(47)) && near(tape.contentAt(50), 49.5) && near(tape.contentAt(59.4), 49.5 + 9 + .2) && near(tape.contentAt(60), 49.5 + 9 + .2), 'tape curve from plan.tape: Sink In lags the room by 0.5 s; the stop adds 0.2 s of content, then nothing');
  worst = 0;
  for (let f = 1056; f < 1152; f++) worst = Math.max(worst, Math.abs(L(f, 'tape').srcTime - (2 + content(f / 24) - content(1056 / 24))));
  ok(worst < 1e-12, `tape coupling: srcTime = in + ∫ pitch, the engine's curve d(t) = .25·D·u² (max error ${worst.toExponential(1)} s)`);
  ok(near(L(1127, 'tape').srcTime - L(1126, 'tape').srcTime, (1 - .5 * ((1126.5 / 24 - s0) / D)) / 24, 1e-12) && near(L(1151, 'tape').srcTime - L(1150, 'tape').srcTime, (1 - .5 * ((1150.5 / 24 - s0) / D)) / 24, 1e-12), 'tape coupling: 0.5× by the end of the bar, frame for frame');
  // Tape and a keyed rate together: a product of two ramps, still exact.
  worst = 0;
  for (let f = 1056; f < 1152; f++) { const t = f / 24, a = 1056 / 24; worst = Math.max(worst, Math.abs(L(f, 'tapeRamp').srcTime - (1 + quad(x => (1 + (x - a) / 4) * tape.rateAt(x), a, Math.min(t, s0)) + (t > s0 ? quad(x => (1 + (x - a) / 4) * tape.rateAt(x), s0, t) : 0)))); }
  ok(worst < 1e-12, `tape × keyed rate: exact (max error ${worst.toExponential(1)} s)`);
  // The rewind: 4× backwards for one beat; the tape stop: v = Ta + τ − τ²/2S, then held.
  ok([576, 577, 583, 587].every(f => near(p.all[f].time, 24 - 4 * (f - 576) / 24)) && p.all[588].time === 24.5 && p.all[577].transport.kind === 'rewind', 'rewind: the composite runs 4× backwards for one beat');
  ok([1416, 1420, 1425].every(f => near(p.all[f].time, 59 + (f / 24 - 59) - (f / 24 - 59) ** 2 / .8)) && [1426, 1439].every(f => near(p.all[f].time, 59.2)), 'tape stop: the engine\'s curve, then a hold at 59.2 s');
  ok(transportTime({kind:'rewind', Ta:10, Tfrom:20, rate:4}, 10.5) === 18, 'transportTime: rewind from another moment');
  // Speed fit and hit warp.
  const a = speedFit(10, 8), b = speedFit(30, 8), c = speedFit(3, 8);
  ok(a.rate === 1.25 && a.trimmed === 'none' && b.rate === 2 && b.srcUsed === 16 && b.trimmed === 'source' && c.rate === .5 && c.slotUsed === 6 && c.trimmed === 'slot', 'speed fit: 1.25×; 2× and trim the source; .5× and trim the slot');
  const drums = shots.get('drums'), hw = hitWarp({plan:drop, at:384, len:32, hits:drums.hitTimes});
  const hc = clipTimeMap({id:'hw', at:384, len:32, time:{in:hw.map[0][1], map:hw.map}}, {plan:drop, origin:{step:384, shift:0, frame:1152}, fps:24, endFrame:1248});
  const landed = hw.matched.map(m => { let lo = T(384), hi = T(416); for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (hc.at(mid).src < m.hit) lo = mid; else hi = mid; } return Math.abs(lo - T(m.step)) * 24; });
  ok(hw.matched.length >= 8 && landed.every(d => d < 1e-6), `hit warp: ${hw.matched.length} hits (one a beat, ±1 frame of jitter) land exactly on 8ths`);
  const tight = hitWarp({plan:drop, at:384, len:32, hits:[.5, 1.08, 1.5], min:.85, max:1.15});
  ok(tight.matched.length === 2, 'hit warp: a hit that would need a rate outside 0.85-1.15 stays off the grid');
  ok(hw.rates.every(r => r >= .85 - 1e-9 && r <= 1.15 + 1e-9), `hit warp: local rates ${Math.min(...hw.rates).toFixed(3)}-${Math.max(...hw.rates).toFixed(3)}`);
});

// =================================================================================================
section('5. cuts', () => {
  const plans = [['drop60', drop], ['soundcheck', sound], ['128 BPM', t128], ['97 BPM', tempoPlan(97, 6, .2)]];
  for (const id of Object.keys(FORMS)) if (!['drop60', 'soundcheck'].includes(id)) { try { plans.push([id, planOf(id)]); } catch (e) { log(`   (form ${id} not arranged: ${e.message})`); } }
  for (const [label, plan] of plans) for (const every of [4, 1]) {
    const edl = metronomeEDL(plan, {every}), p = compile(edl, {plan, shots}), want = expectedCuts(plan, edl);
    ok(p.lint.ok && edl.clips.length === Math.ceil(plan.totalSteps / every), `${label} metronome every ${every}: ${edl.clips.length} clips, valid`);
    ok(JSON.stringify(p.cuts) === JSON.stringify([0, ...want]), `${label} every ${every}: ${want.length} cuts, each on round(T(step)·24)`);
    ok(want.every((f, i) => p.all[f].layers[0].gen !== p.all[f - 1].layers[0].gen && f === Math.round(plan.timing[edl.clips[i + 1].at] * 24)), `${label} every ${every}: the picture changes exactly on each cut frame`);
    ok(p.all.every(fr => fr.layers.length === 1 && fr.layers[0].cell.id === 'full'), `${label} every ${every}: one full-frame layer per frame`);
  }
  const steps = metronomeEDL(t128).clips.map(c => c.at), frames = steps.map(s => Math.round(t128.timing[s] * 24)), gaps = frames.slice(1).map((f, i) => f - frames[i]);
  ok(new Set(gaps).size > 1, `128 BPM beats are not a whole number of frames: gaps ${[...new Set(gaps)].join('/')} frames`);
});

// =================================================================================================
section('6. layouts', () => {
  for (const format of Object.keys(FORMATS)) {
    const F = FORMATS[format];
    for (const cls of CLASSES) {
      const L = layout(cls, format), full = cls === 'BOARD';
      ok(L.cells.length >= 1 && L.cells.every((c, i) => c.id === `${cls}.${i}` && cellRect(format, c.id).w === c.w), `${format} ${cls}: ${L.cells.length} cells with ids`);
      ok(L.cells.every(c => c.x >= (full ? 0 : GUTTER) && c.y >= (full ? 0 : GUTTER) && c.x + c.w <= F.w - (full ? 0 : GUTTER) && c.y + c.h <= F.h - (full ? 0 : GUTTER) && Number.isInteger(c.x + c.y + c.w + c.h)), `${format} ${cls}: inside the frame, ${full ? 'full bleed' : '12 px from every edge'}, whole pixels`);
      ok(L.cells.every(c => c.r === (full ? 0 : RADIUS)), `${format} ${cls}: corner radius ${full ? 0 : 12}`);
      const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
      ok(L.cells.every((a, i) => L.cells.every((b, j) => i === j || gap(a, b) >= GUTTER)), `${format} ${cls}: tiles at least 12 px apart`);
      for (const r of [L.board, L.banner].filter(Boolean)) ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= F.w && r.y + r.h <= F.h && (full || (r === L.board && L.boardOver) || L.cells.every(c => gap(c, r) >= GUTTER - 1e-9)), `${format} ${cls}: board and banner inside, clear of the tiles${L.boardOver ? ' (the board lies over the picture)' : ''}`);
      // Every call layout shares the format's one board home, inside the platform-safe band of its
      // format (pegboard/font.js FORMATS), so the board never moves on a cut; the full-board moments
      // (BOARD, BOARD+STRIP) grow out of it, and their type is checked below.
      const moment = FULL_BOARD.includes(cls);
      ok(L.board && (moment || (sameRect(L.board, HOME[format]) && insideSafeBand(format, L.board))), moment ? `${format} ${cls}: a full-board moment (its type is checked below)` : `${format} ${cls}: the board at its home, y ${L.board?.y}-${L.board ? L.board.y + L.board.h : '?'}, inside the safe band y ${SAFE[format].y}-${SAFE[format].y + SAFE[format].h}`);
      // The tiles and the board fill the frame: nothing but gutters is left black.
      const used = L.cells.reduce((a, c) => a + c.w * c.h, 0) + (L.boardOver || full ? 0 : L.board.w * L.board.h) + (L.banner ? L.banner.w * L.banner.h : 0);
      ok(used / (F.w * F.h) >= .88, `${format} ${cls}: tiles and board cover ${(100 * used / (F.w * F.h)).toFixed(1)} % of the frame (the rest is gutters)`);
      // The screen share keeps the home's edges that lie on the frame's safe side: it grows, it does not move.
      if (cls === 'BOARD+STRIP') {
        const H = HOME[format], b = L.board, kept = [b.x === H.x, b.y + b.h === H.y + H.h, b.x + b.w === H.x + H.w].filter(Boolean).length;
        ok(kept >= 2 && b.w >= H.w && b.h >= H.h * (format === '16:9' ? .9 : 1), `${format} BOARD+STRIP: the share grows out of the home (${kept} of its edges stay put)`);
      }
    }
    // The full-bleed board centres its type: every screen of the Drop Edition, the lady's 57
    // phrases at k 1-3 included, lights inside the safe band.
    const safe = SAFE[format];
    const screens = [...buildScreens(drop, {}), ...Object.keys(LADY_TABLE).flatMap(file => [1, 2, 3].map(k => ({text:LADY_TABLE[file].display ?? LADY_TABLE[file].text ?? file, k, font:'peg9'})))].filter(s => s.text);
    for (const cls of FULL_BOARD) {
      const r = layout(cls, format).board, grid = boardGrid(r.w, r.h, undefined, safeSpan(r, safe));
      const out = screens.map(s => ({s, b:boardTypeBounds(r.w, r.h, s, grid)})).filter(x => x.b && (r.y + x.b.y < safe.y || r.y + x.b.y + x.b.h > safe.y + safe.h));
      ok(out.length === 0, `${format} ${cls}: the type of ${screens.length} screens lights inside the safe band y ${safe.y}-${safe.y + safe.h} (${out.slice(0, 3).map(x => `${x.s.text} k${x.s.k} y ${r.y + x.b.y}-${r.y + x.b.y + x.b.h}`).join('; ')})`);
    }
    // And across: every region lays its words out in the columns the safe area leaves it (in 9:16
    // left of the right rail at x 944), the full-bleed board and every class's region alike.
    const wide = [];
    let laid = 0;
    for (const cls of CLASSES) {
      const r = layout(cls, format).board; if (!r) continue;
      const g = boardGrid(r.w, r.h, undefined, safeSpan(r, safe));
      for (const sc of screens) { const b = boardTypeBounds(r.w, r.h, sc, g); if (!b) continue; laid++; if (r.x + b.x < safe.x - 1e-9 || r.x + b.x + b.w > safe.x + safe.w + 1e-9) wide.push(`${cls} ${sc.text} k${sc.k} x ${r.x + b.x}-${r.x + b.x + b.w}`); }
    }
    ok(laid > 1000 && wide.length === 0, `${format}: ${laid} screens laid out in every class's board region keep their type inside the safe area x ${safe.x}-${safe.x + safe.w} (${wide.slice(0, 3).join('; ')})`);
    // A stutter's whole words (choreo: "LET'S" with LE lit, "LET'S BUILD." with LET'S BU lit) are on
    // the board at once, in the home, the share and the full board alike, at a size a phone reads.
    const frags = screens.filter(sc => sc.fragment);
    for (const r of [HOME[format], layout('BOARD+STRIP', format).board, layout('BOARD', format).board]) {
      const g = boardGrid(r.w, r.h, undefined, safeSpan(r, safe)), outs = frags.map(sc => ({sc, l:g.layoutOf(sc)}));
      ok(frags.length >= 20 && outs.every(x => x.l && x.l.pages.length === 1 && x.l.height * g.pitch >= (format === '16:9' ? 50 : 60)), `${format} ${r.w}×${r.h}: ${frags.length} fragment screens lay out whole on one page, at least ${format === '16:9' ? 50 : 60} px tall`);
    }
  }
  // The homes: 9:16 the strip y 1098-1440 with tiles above it and a row under it; 1:1 y 588-828;
  // 16:9 the column x 1422-1908. The 9:16 grids fill the frame (the last review found 30-45 % black).
  ok(sameRect(HOME['9:16'], {x:12, y:1098, w:1056, h:342}) && sameRect(HOME['1:1'], {x:12, y:588, w:1056, h:240}) && sameRect(HOME['16:9'], {x:1422, y:54, w:486, h:972}), 'the homes: 9:16 y 1098-1440, 1:1 y 588-828, 16:9 x 1422-1908');
  const rows = cls => [...new Set(layout(cls, '9:16').cells.map(c => `${c.y}+${c.h}`))].join(' ');
  ok(rows('G9') === '12+531 555+531 1452+456' && rows('G6') === rows('G9') && layout('G9', '9:16').cells.every(c => c.w === 344) && layout('G6', '9:16').cells.every(c => c.w === 522), '9:16 G6 and G9: two rows of 531 above the home, one of 456 under it (2 and 3 across)');
  ok(rows('stack3') === rows('G9') && rows('G4') === rows('G9') && rows('split') === '12+1074 1452+456' && layout('L1', '9:16').boardOver, '9:16 stack3 and G4 share those rows; split is the frame above the home and the row under it; L1 lays the home over its picture');
  ok(sameRect(layout('BOARD+STRIP', '9:16').board, {x:12, y:78, w:1056, h:1362}) && layout('BOARD+STRIP', '9:16').cells.every(c => c.y === 1452 && c.h === 456), '9:16 BOARD+STRIP: the home grown up to y 78 (its bottom and sides stay), the strip under it');
  ok(['9:16', '1:1', '16:9'].every(f => JSON.stringify(layout('G4', f).cells) !== JSON.stringify(layout('G4', '9:16').cells) || f === '9:16'), 'each format laid out on its own');
  for (const id of ['split.1>G4.2', 'G4.0>g2x4.7', 'G9.4>split.1', 'stack3.1>g4x2.0']) {
    const r = cellRect('9:16', id), parent = cellRect('9:16', id.split('>')[0]);
    ok(r && r.x >= parent.x && r.y >= parent.y && r.x + r.w <= parent.x + parent.w && r.y + r.h <= parent.y + parent.h && layoutClassOf(id) === id.split('.')[0], `nested ${id}: inside its parent`);
  }
  const kids = Array.from({length:8}, (_, i) => cellRect('9:16', `G4.0>g2x4.${i}`));
  ok(kids.every((a, i) => kids.every((b, j) => i === j || Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h)) >= GUTTER)), 'nested grids keep the 12 px gutter');
  ok(cellRect('9:16', 'G6.6') === null && cellRect('9:16', 'G7.0') === null && cellRect('5:4', 'G4.0') === null && cellRect('9:16', 'full').w === 1080, 'unknown cells resolve to null; full is the frame');
  ok(cellIds('G9').length === 9, 'cellIds');
});

// =================================================================================================
// Contexts that exercise every move on the drop, in cells whose zoom ceilings fit.
const POOL = ['synergy', 'keys', 'people', 'arjun'], GRID9 = ['synergy', 'drums', 'keys', 'guitar', 'gen:camera-off', 'people', 'arjun', 'synthia', 'gen:board'];
const G4 = ['G4.0', 'G4.1', 'G4.2', 'G4.3'];
const CTX = {
  downbeatCut:{section:'Verse', pool:POOL, cell:'stack3.2'}, offbeatCut:{section:'Drop B', pool:POOL, cell:'G6.1'}, vocalCut:{section:'Verse', pool:['keys', 'people', 'arjun'], cell:'stack3.2'},
  jCut:{at:{anchor:'bar:10'}, len:32, pool:POOL, cell:'G6.0'}, lCut:{at:{anchor:'bar:10'}, len:32, pool:POOL, cell:'G6.0'}, matchCut:{at:{anchor:'bar:6'}, len:32, pool:['keys', 'people'], cell:'stack3.2'},
  jumpCut:{at:{anchor:'bar:6'}, len:16, pool:['people'], cell:'stack3.2'}, slowPush:{section:'Verse', pool:['synergy'], cell:'stack3.0'}, crashZoom:{at:{anchor:'bar:8'}, len:16, pool:['keys'], cell:'stack3.1'},
  snapLadder:{at:{anchor:'bar:14'}, len:16, pool:['people'], cell:'G6.2'}, snarePunch:{section:'Drop B', pool:['drums'], cell:'G9.1'}, whipSlide:{at:{anchor:'bar:21'}, len:16, pool:['keys', 'synergy'], cell:'stack3.1'},
  hatRoll:{at:{anchor:'bar:17'}, len:16, pool:['people'], cell:'G6.1'}, speedFit:{at:{anchor:'bar:4'}, len:64, pool:['people'], cell:'stack3.2'}, hitWarp:{at:{anchor:'bar:24'}, len:32, pool:['drums'], cell:'G9.1'},
  tapeCoupling:{pool:['synergy', 'drums', 'people', 'arjun'], cells:['G6.0', 'G6.1', 'G6.2', 'G6.3']}, speedRamp:{at:{anchor:'bar:21'}, len:16, pool:['drums', 'people'], cell:'stack3.0'},
  freezeLabel:{at:{anchor:'bar:7'}, len:16, pool:['arjun'], cell:'stack3.2', freeze:8}, stutter:{at:{anchor:'bar:15'}, len:8, pool:['keys'], cell:'G6.4'},
  retriggerRoll:{at:{anchor:'bar:17'}, len:16, pool:POOL, cells:G4}, boomerang:{at:{anchor:'bar:10'}, len:16, pool:['drums', 'people'], cell:'G6.3'}, rewind:{at:6, len:2, from:{anchor:'bar:17'}},
  tapeStop:{}, gridBloom:{at:{anchor:'bar:1'}, len:32, pool:GRID9.slice(0, 6)}, gridCollapse:{at:{anchor:'bar:24'}, len:16, pool:['people', 'keys', 'arjun', 'synthia', 'gen:camera-off', 'gen:board', 'synergy', 'strategy', 'linda']},
  cellSplit:{at:{anchor:'bar:16'}, len:16, pool:['people'], cell:'stack3.1'}, breakoutRooms:{at:{anchor:'bar:14'}, len:32, pool:GRID9}, freezeTheCall:{at:{anchor:'bar:12'}, len:32, pool:GRID9},
  reactionCanon:{at:{anchor:'bar:13'}, len:16, pool:['people'], unfreeze:true}, dubDelay:{at:{anchor:'bar:10'}, len:16, pool:['synergy']}, speakerChase:{at:{anchor:'bar:24'}, len:32, pool:GRID9},
  poorConnection:{at:{anchor:'bar:16'}, len:32, pool:['synergy', 'keys'], cell:'G6.2'}, pegTakeover:{at:{anchor:'cue:impact'}, len:8, pool:['synergy', 'people']}, drosteDive:{at:{anchor:'bar:24'}, len:16},
  kaleido:{at:{anchor:'bar:26'}, len:16, pool:['synergy', 'drums', 'people'], cell:'G6.0'}, rgbSplit:{at:{anchor:'bar:24'}, len:16, pool:['synergy', 'keys'], cell:'G6.5'}, irisToEye:{at:{anchor:'bar:28'}, len:16, pool:['synergy'], cell:'stack3.0'},
  leaveMeeting:{at:{anchor:'bar:28'}, len:32, pool:['synergy', 'keys', 'people', 'gen:camera-off', 'arjun', 'gen:board']},
};
// 9:16 L1 cannot hold a 720p plate under the ceiling; these moves end in L1, so they run in 16:9.
const LANDSCAPE = new Set(['gridCollapse', 'leaveMeeting', 'gridBloom']);

section('7. moves', () => {
  ok(MOVE_NAMES.length >= 38 && MOVE_NAMES.every(n => CTX[n]), `${MOVE_NAMES.length} moves, every one exercised`);
  for (const name of MOVE_NAMES) {
    const format = LANDSCAPE.has(name) ? '16:9' : '9:16';
    const patch = MOVES[name].fn({plan:drop, shots, format, seed:7, features, ...CTX[name]});
    const edl = merge(createEDL({format}), patch), errs = validate(edl);
    ok((patch.clips.length || patch.transports?.length || patch.camera?.length) > 0, `${name}: emits ${patch.clips.length} clips${patch.transports?.length ? ` and ${patch.transports.length} transport` : ''}${patch.camera?.length ? ' and a camera cue' : ''}`);
    ok(errs.length === 0, `${name}: a valid EDL${errs.length ? ` (${errs.map(e => `${e.path}: ${e.message}`).join('; ')})` : ''}`);
    const p = compile(edl, {plan:drop, shots, features});
    ok(p.lint.errors.length === 0, `${name}: compiles with no lint errors${p.lint.errors.length ? ` (${p.lint.errors.slice(0, 3).map(e => `${e.rule} ${e.message}`).join('; ')})` : ''}`);
    ok(stringify(parse(stringify(edl))) === stringify(edl), `${name}: round-trips byte for byte`);
    const again = MOVES[name].fn({plan:drop, shots, format, seed:7, features, ...CTX[name]});
    ok(JSON.stringify(again) === JSON.stringify(patch), `${name}: deterministic`);
  }
  // A move's output is portable: anchors, not seconds, so it follows another post.
  const vc = MOVES.vocalCut.fn({plan:drop, shots, ...CTX.vocalCut});
  ok(vc.clips.slice(1).every(c => /^word:/.test(c.at.anchor) && c.at.frames === -1), 'vocal cuts anchor to words, one frame early');
  const rr = MOVES.retriggerRoll.fn({plan:drop, shots, ...CTX.retriggerRoll}), p2 = planOf('drop60', POSTS[1]);
  ok(rr.clips.every(c => /^lady:r5#\d+$/.test(c.at.anchor)) && compile(merge(createEDL({}), rr), {plan:p2, shots}).lint.ok, 'retrigger roll: the ladder is the cut list, and the EDL compiles against another post');
  const pre = compile(merge(createEDL({}), rr), {plan:drop, shots}), events = drop.lady.filter(e => e.role === 'ladder' && e.rung === 5);
  ok(events.every(e => pre.cuts.includes(cutFrame(ladyTime(drop, e)))), `retrigger roll: a cut on each of the ${events.length} rung-5 hits`);
  const notes = [MOVES.boomerang.fn({plan:drop, shots, pool:['drums']}), MOVES.kaleido.fn({plan:drop, shots, pool:['synergy']}), MOVES.speedRamp.fn({plan:drop, shots, pool:['guitar']}), MOVES.rgbSplit.fn({plan:drop, shots, pool:['synergy']})];
  ok(notes.every(n => n.clips.length === 0 && n.notes?.length), 'moves refuse what policy forbids (boomerang on R0, kaleido on a robot, ramps on instruments, RGB split on Synergy) and say why');
});

// =================================================================================================
section('8. policy', () => {
  const one = (clip, extra = {}) => run(createEDL({clips:[clip], ...extra}));
  const has = (p, rule, re) => p.lint.errors.some(e => e.rule === rule && (!re || re.test(e.message)));
  // G7: reverse.
  ok(has(one({id:'r', at:64, len:16, cell:'G6.0', asset:'shot:drums', time:{reverse:true}}), 'G7', /R0/), 'G7: an R0 instrument reversed');
  ok(has(one({id:'r', at:64, len:16, cell:'G6.0', asset:'shot:printer', time:{in:2, repeat:{unit:4, count:2, pingpong:true}}}), 'G7', /R0/), 'G7: an R0 printer ping-ponged');
  ok(has(one({id:'r', at:64, len:16, cell:'G6.0', asset:'shot:drums', time:{in:9, rate:[[0, 1], [8, -1]]}}), 'G7'), 'G7: an R0 plate under a negative rate');
  ok(!has(one({id:'r', at:64, len:16, cell:'G6.0', asset:'shot:keys', time:{in:9, reverse:true}}), 'G7'), 'G7: an R1 plate reverses freely');
  // R2: in a rewind the printer and the instrument plates hold their frame (plan §2); other R0
  // footage runs backwards only where the plan rewinds the sound too (plan.transports, audio:true).
  const inside = run(createEDL({clips:[{id:'d', at:256, len:64, cell:'G6.0', asset:'shot:drums'}, {id:'pr', at:256, len:64, cell:'G6.1', asset:'shot:printer'}, {id:'k', at:256, len:64, cell:'G6.2', asset:'shot:kevin-take', time:{in:2}}], transports:[{at:6, len:2, kind:'rewind', audio:true, from:{anchor:'bar:17'}}]}));
  const L18 = id => inside.all[18].layers.find(l => l.clipId === id);
  ok(L18('d').held === 'instrument' && !L18('d').reverse && L18('pr').held === 'printer' && L18('k').reverse, 'R2: in a rewind the instrument plate and the printer hold their frame; the rest runs backwards');
  ok(has(inside, 'G7', /does not reverse the sound/) && inside.lint.warnings.some(w => w.rule === 'G7' && /does not reverse the sound/.test(w.message)), 'G7: R0 footage backwards in a rewind whose sound the plan does not reverse is an error; the rewind itself a warning');
  {
    const cold = withColdOpen(drop), Sx = t => stepAtTime(cold, t), rw = cold.transports[0];
    const edl = createEDL({clips:[{id:'k', at:0, len:400, cell:'G6.2', asset:'shot:kevin-take', time:{in:2}}],
      transports:[{id:'j', at:0, len:Sx(.75), kind:'jump', audio:true, from:{anchor:'step:0', frames:960}}, {id:'rw', at:Sx(rw.at), len:Sx(rw.at + rw.len) - Sx(rw.at), kind:'rewind', audio:true, rate:4, from:{anchor:`step:${Sx(rw.sourceFrom)}`}}]});
    const pc = compile(edl, {plan:cold, shots, features});
    ok(!has(pc, 'G7') && pc.transports.find(t => t.id === 'rw').sound === 'reversed' && pc.all[20].layers.find(l => l.clipId === 'k').reverse, "R2: inside the plan's own rewind (the cold open) the sound reverses, so R0 footage may");
    ok(pc.transports.find(t => t.id === 'j').sound === 'copied' && pc.all[0].time === 40 && pc.all[17].time === 40 + 17 / 24 && !pc.lint.warnings.some(w => w.rule === 'G7'), 'the cold open: frames 0-17 show the impact frame by frame, its sound copied there (plan.coldOpen)');
    const j2 = run(createEDL({transports:[{id:'j', at:64, len:4, kind:'jump', audio:true, from:{anchor:'cue:impact'}}]}));
    ok(j2.lint.warnings.some(w => w.rule === 'G7' && /sound plays on/.test(w.message)), 'G7: a jump whose sound plays on is flagged');
  }
  ok(has(run(createEDL({transports:[{at:6, len:8, kind:'rewind', audio:true}]})), 'G7', /1 beat/), 'G7: a rewind longer than a beat');
  ok(has(run(createEDL({transports:[0, 64, 128].map(at => ({at, len:4, kind:'rewind', audio:true}))})), 'G7', /at most 2/), 'G7: three rewinds');
  ok(has(run(createEDL({transports:[{at:6, len:2, kind:'rewind', audio:false}]})), 'schema', /audio/) && has(run(createEDL({transports:[{at:6, len:2, kind:'rewind', audio:false}]})), 'G7', /audio/), 'G7: a rewind without its audio (parity)');
  ok(has(one({id:'i', at:368, len:16, cell:'G6.0', asset:'shot:drums', time:{tape:true}}), 'G7', /freezes/) && has(one({id:'i', at:64, len:16, cell:'G6.0', asset:'shot:drums', time:{rate:.5}}), 'G7', /0\.85/), 'G7: instruments never slow (tape, half speed)');
  // G11: mirror flags and canon.
  ok(has(one({id:'m', at:64, len:16, cell:'G6.0', asset:'shot:keys', frame:{mirror:'x'}}), 'G11', /mirrorable/), 'mirror: a shot not flagged mirrorable');
  ok(has(one({id:'m', at:64, len:16, cell:'G6.0', asset:'shot:synergy', fx:[{type:'tile', cols:2, rows:2, mirror:1}]}), 'G11', /robots/), 'mirror: a robot in a kaleido');
  ok(!has(one({id:'m', at:64, len:16, cell:'G6.0', asset:'shot:people', frame:{mirror:'x'}}), 'G11'), 'mirror: a mirrorable shot may');
  ok(has(one({id:'p', at:64, len:16, cell:'G6.0', asset:'shot:pat-webcam'}), 'G11', /Pat/) && !has(one({id:'p', at:64, len:16, cell:'G6.0', asset:'gen:camera-off'}), 'G11'), 'canon: Pat never on video; his camera-off tile is fine');
  ok(has(one({id:'l', at:64, len:16, cell:'G6.0', asset:'shot:lady-face'}), 'G11', /lady/), 'canon: the lady never gets a face');
  ok(has(run(createEDL({board:[{at:64, len:16, text:'LEVERAGE', palette:'#22DD44'}]})), 'G11', /green/) && has(run(createEDL({board:[{at:64, len:16, text:'X', palette:'green'}]})), 'G11'), 'canon: type is never green');
  ok(has(one({id:'s', at:64, len:16, cell:'G6.0', asset:'shot:synergy', fx:[{type:'mosaic', px:16}]}), 'G11', /mouth/), "canon: no warping effect on Synergy's mouth row");
  const cover = run(createEDL({clips:[{id:'s', at:64, len:16, cell:'stack3.0', asset:'shot:synergy'}, {id:'over', at:64, len:16, cell:'stack3.0>g2x2.3', asset:'shot:keys', z:1}]}));
  const mouth = cover.all[200].layers.find(l => l.clipId === 's').robot.mouth, sub = cellRect('9:16', 'stack3.0>g2x2.3');
  ok(has(cover, 'G11', /covers/) === (mouth.x + mouth.w / 2 > sub.x && mouth.y + mouth.h / 2 > sub.y), `canon: a tile over Synergy's tracked mouth (${mouth.x.toFixed(0)}, ${mouth.y.toFixed(0)}) is caught`);
  const corner = run(createEDL({clips:[{id:'s', at:64, len:16, cell:'stack3.0', asset:'shot:synergy'}, {id:'over', at:64, len:16, cell:'stack3.0>g4x4.0', asset:'shot:keys', z:1}]}));
  ok(!has(corner, 'G11'), "canon: a tile in the far corner leaves Synergy's mouth alone");
  // Synergy's mouth level: his voice while he sings his own words, at rest between them.
  {
    const bar = n => n * 16;
    const p = one({id:'s', at:0, len:bar(8), cell:'L1.0', asset:'shot:synergy'}), words = drop.words.map(w => stepTime(drop, w.at));
    const lv = f => p.frame(f).layers[0].robot.level, sung = Math.round(words[0] * 24) + 2, rest = Math.round(stepTime(drop, bar(4)) * 24) - 30;
    ok(lv(sung) > .5 && lv(rest) === 0 && p.all.slice(0, bar(8) * 3).every(fr => !fr.layers[0] || (fr.layers[0].robot.level >= 0 && fr.layers[0].robot.level <= 1)), `Synergy's layer carries his voice level: ${lv(sung).toFixed(2)} on his first word (f${sung}), ${lv(rest)} at rest (f${rest})`);
    const sink = drop.sections.find(x => /sink/i.test(x.name)), sinkF = Math.round(stepTime(drop, sink.from * 16 + 8) * 24);
    ok(one({id:'s', at:sink.from * 16, len:16, cell:'L1.0', asset:'shot:synergy'}).frame(sinkF).layers[0].robot.level === 0, 'his mouth rests through Sink In, though the vocoder carries her (plan §2)');
  }
  // G13: whenever the song's board has lit words, the board is on screen.
  {
    const syn = {id:'s', at:64, len:32, cell:'G4.0', asset:'shot:synergy'}, keys = {id:'k', at:64, len:32, cell:'G4.3', asset:'shot:keys'};
    const owned = run(createEDL({clips:[syn, keys], camera:[{id:'cam', at:64, len:32, zoom:3, cx:.25, cy:.2, board:true}]}));
    const held = run(createEDL({clips:[syn, keys], camera:[{id:'cam', at:64, len:32, zoom:3, cx:.25, cy:.2}]}));
    ok(has(owned, 'G13', /no board is on screen/) && !has(held, 'G13') && held.frame(200).camera.board === false && held.frame(200).board.rect, `G13: a camera move that carries the board out of frame fails (${owned.lint.errors.find(e => e.rule === 'G13')?.frames} frames); one that does not own it holds the board still`);
    const dark = run(createEDL({clips:[{id:'b', at:64, len:32, cell:'full', asset:'gen:color:#000000'}, {id:'l', at:64, len:32, cell:'L1.0', asset:'gen:color:#000000'}]}));
    const tag = run(createEDL({clips:[{id:'b', at:64, len:32, cell:'full', asset:'gen:color:#000000'}]}));
    ok(!has(dark, 'G13') && dark.frame(200).board.rect === null && dark.frame(200).board.dark && tag.frame(200).board.rect?.h === 1920, 'lights out: every tile black takes the board too (true black); a full-frame black keeps it (the tag on bare sockets)');
    const under = run(createEDL({clips:[{id:'s', at:64, len:16, cell:'L1.0', asset:'shot:synergy'}], camera:[{id:'cam', at:64, len:16, zoom:1.5, cy:.3}]}));
    ok(has(under, 'G11', /lights over Synergy's mouth/), "G11: a camera push that carries his mouth under the still board is caught");
  }
  // G14: the board holds still. Every call layout shares the home; a full-board moment grows out of
  // it only through an authored board move of at least 3 frames, eased, and never jumps.
  {
    const call = [{id:'a', at:64, len:16, cell:'G4.0', asset:'shot:keys'}, {id:'b', at:80, len:16, cell:'G9.2', asset:'shot:people'}, {id:'c', at:96, len:16, cell:'L1.0', asset:'shot:arjun'}, {id:'d', at:112, len:16, cell:'stack3.1', asset:'shot:keys'}];
    const steady = run(createEDL({clips:call}));
    const rects = new Set(); for (let f = 192; f < 384; f++) rects.add(JSON.stringify(steady.frame(f).board.rect));
    ok(!has(steady, 'G14') && rects.size === 1, `G14: G4, G9, L1 and stack3 share one board rect (${[...rects][0]})`);
    const board = {id:'x', at:128, len:16, cell:'full', asset:'gen:color:#000000'}, back = {id:'y', at:144, len:16, cell:'G6.0', asset:'shot:keys'};
    const jump = run(createEDL({clips:[...call, board, back]}));
    ok(has(jump, 'G14', /the board jumps on 2 cuts/), 'G14: a full-board moment cut in and out without a move is a jump, twice');
    const moves = [{id:'grow', at:128, frames:4, align:'start'}, {id:'home', at:144, frames:5, ease:'outQuad', align:'end'}];
    const eased = run(createEDL({clips:[...call, board, back], boardMoves:moves}));
    const F0 = cutFrame(drop.timing[128]), F1 = cutFrame(drop.timing[144]), H = eased.frame(F0 - 1).board.rect, area = r => r.w * r.h;
    const grow = [0, 1, 2, 3].map(k => eased.frame(F0 + k).board.rect), shrink = [4, 3, 2, 1, 0].map(k => eased.frame(F1 - k).board.rect);
    ok(!has(eased, 'G14') && grow.every((r, k) => area(r) > (k ? area(grow[k - 1]) : area(H))) && grow[3].h === 1920 && shrink.every((r, k) => !k || area(r) < area(shrink[k - 1])) && JSON.stringify(shrink[4]) === JSON.stringify(H) && eased.frame(F0).board.move === 'grow' && eased.frame(F0).board.over,
      `G14: with board moves it grows over 4 frames from the beat (heights ${grow.map(r => r.h).join(' ')}) and lands home on the cut over 5 (${shrink.map(r => r.h).join(' ')}), laid over the picture while it moves`);
    const steps = grow.map((r, k) => area(r) - (k ? area(grow[k - 1]) : area(H)));
    ok(Math.max(...steps) < .5 * (area(grow[3]) - area(H)), `G14: eased, no frame of the move takes half of it (largest step ${(100 * Math.max(...steps) / (area(grow[3]) - area(H))).toFixed(0)} %)`);
    ok(validate(createEDL({clips:call, boardMoves:[{at:128, frames:2}]})).some(e => /never a jump/.test(e.message)) && validate(createEDL({clips:call, boardMoves:[{at:128, align:'middle'}]})).length === 1, 'G14: a board move of 2 frames is a jump (schema); align is start or end');
    ok(JSON.stringify(eased.compileFrame(F0 + 1)) === JSON.stringify(eased.frame(F0 + 1)) && JSON.stringify(eased.compileFrame(F1 - 2)) === JSON.stringify(eased.frame(F1 - 2)), 'G14: a moving board is seek-safe (compileFrame equals the frame)');
    // The panel never comes and goes on its own: a full-frame video under the board shows only its light.
    const video = run(createEDL({clips:[{id:'v', at:64, len:16, cell:'full', asset:'shot:keys'}, {id:'w', at:80, len:16, cell:'full', asset:'gen:color:#000000'}]}));
    ok(has(video, 'G14', /panel comes or goes/) && video.frame(200).board.panel === 0 && video.frame(330).board.panel === 1, "G14: the board's panel appearing on its own (light over footage, then sockets) is caught");
  }
  // G8 repeats.
  ok(has(one({id:'r', at:64, len:16, cell:'G6.0', asset:'shot:keys', time:{repeat:{unit:1, count:5}}}), 'G8', /at most 4/), 'G8: five plays of a slice');
  ok(has(one({id:'r', at:64, len:16, cell:'G6.0', asset:'shot:keys', time:{repeat:{unit:1, count:3}}}), 'G8', /third/), 'G8: a third repeat that does not vary');
  const same = run(createEDL({clips:[0, 4, 8].map((at, i) => ({id:`c${i}`, at:64 + at, len:4, cell:'G6.0', asset:'shot:keys', time:{in:1}}))}));
  ok(has(same, 'G8', /third identical/), 'G8: three identical clips in a row across clips');
  // G10 zoom ceiling, and the mosaic escape hatch.
  ok(has(one({id:'z', at:64, len:16, cell:'split.0', asset:'shot:keys', frame:{zoom:2.2}}), 'G10', /3\.52x/), 'G10: zoom 2.2 in a 1056×1074 tile is a 3.52× upscale of a 672-line picture (ceiling 1.8)');
  ok(!has(one({id:'z', at:64, len:16, cell:'G4.0', asset:'shot:keys', frame:{zoom:2.2}, fx:[{type:'mosaic', px:16}]}), 'G10'), 'G10: above the ceiling, mosaic is allowed');
  ok(has(one({id:'z', at:64, len:16, cell:'L1.0', asset:'shot:keys'}), 'G10', /2\.82x/), 'G10: a 720p plate in a full 9:16 tile is 2.82× (ceiling 1.8)');
  // G5 decode ceilings.
  const many = ['synergy', 'drums', 'keys', 'guitar', 'people', 'arjun', 'synthia', 'strategy', 'linda'];
  const dec = run(createEDL({clips:many.map((s, i) => ({id:`d${i}`, at:64, len:16, cell:`G9.${i}`, asset:`shot:${s}`}))}));
  ok(has(dec, 'G5', /desktop/) && dec.decode.max === 9, 'G5: nine live decodes break the desktop ceiling of 8');
  const six = run(createEDL({clips:many.slice(0, 6).map((s, i) => ({id:`d${i}`, at:64, len:16, cell:`G9.${i}`, asset:`shot:${s}`}))}));
  const sixEdl = createEDL({clips:many.slice(0, 6).map((s, i) => ({id:`d${i}`, at:64, len:16, cell:`G9.${i}`, asset:`shot:${s}`}))});
  ok(!has(six, 'G5') && six.lint.warnings.some(w => w.rule === 'G5' && /mobile/.test(w.message)) && has(run(sixEdl, {target:'mobile'}), 'G5'), 'G5: six decodes warn on mobile (an error with target:mobile), pass on desktop');
  const split = run(merge(createEDL({}), MOVES.cellSplit.fn({plan:drop, shots, ...CTX.cellSplit})));
  ok(Math.max(...split.decode.perFrame) === 1, 'G5: cell split into 8 tiles is one decode');
  // G1 and G4 scenes.
  const scenes = run(createEDL({clips:[{id:'a', at:64, len:32, cell:'G6.0', asset:'shot:keys', scene:'one'}, {id:'b', at:96, len:32, cell:'G6.1', asset:'shot:people', scene:'two'}, {id:'c', at:130, len:30, cell:'G4.0', asset:'shot:arjun', scene:'three'}]}));
  ok(has(scenes, 'G1', /one and two/) && has(scenes, 'G4', /three/) && !has(scenes, 'G4', /scene one/), 'G1: adjacent scenes in one layout class; G4: a scene off the bar line');
  ok(!has(run(createEDL({clips:[{id:'a', at:{anchor:'lady:r4#2'}, len:4, cell:'G6.0', asset:'shot:keys', scene:'ladder'}]})), 'G4'), 'G4: a scene may start on a ladder retrigger');
  // Status and overrides.
  ok(has(one({id:'o', at:64, len:16, cell:'G6.0', asset:'shot:old-take'}), 'S4', /never loads/), 'S4: an earlier version never loads');
  const waived = run(createEDL({clips:[{id:'z', at:64, len:16, cell:'L1.0', asset:'shot:keys'}], overrides:[{target:'z', rule:'G10', note:'Aaron: soft is the point here'}]}));
  ok(waived.lint.ok && waived.lint.warnings.some(w => w.rule === 'G10' && /waived/.test(w.message)), 'an override with a rule and a note waives that rule for its clip');
  const template = run({...createEDL({clips:[{id:'z', at:64, len:16, cell:'L1.0', asset:'shot:keys'}], overrides:[{target:'z', rule:'G10', note:'x'}]}), template:true});
  ok(has(template, 'G10'), 'template EDLs ignore waivers');
  const set = run(createEDL({clips:[{id:'z', at:64, len:16, cell:'G6.0', asset:'shot:keys'}], overrides:[{target:'z', set:{'frame.zoom':1.2, 'time.in':2}, note:'tighter'}]}));
  ok(set.all[200].layers[0].transform.zoom === 1.2 && set.all[192].layers[0].srcTime === 2, 'overrides patch clip fields by path');
});

// =================================================================================================
// A whole film: one move per passage of the Drop Edition, 9:16.
function film(plan) {
  const m = (name, ctx) => MOVES[name].fn({plan, shots, features, format:'9:16', seed:11, ...ctx});
  const c = (id, at, len, cell, asset, more = {}) => ({clips:[{id, at, len, cell, asset, ...more}]});
  const patches = [
    // 0: the cold open, one scene: BACK. as peg video, the rewind, Pat's black tile.
    m('pegTakeover', {id:'open', at:0, len:6, pool:['people'], instant:true, scene:'cold'}), m('rewind', {at:6, len:2, from:{anchor:'bar:17'}}),
    c('pat', 8, 8, 'full', 'gen:camera-off', {scene:'cold'}), {boardMoves:[{id:'pat', at:8, frames:4, align:'start'}, {id:'bloom', at:16, frames:4, align:'end'}]},
    // 1-3: the call assembles, then the canon nod.
    m('gridBloom', {id:'bloom', at:16, len:16, pool:['gen:camera-off', 'synergy', 'keys', 'people'], scene:'join'}),
    m('reactionCanon', {id:'canon', at:32, len:32, pool:['people'], cls:'G6', scene:'canon'}),
    // 4-7: the verse in stack3: Synergy pushing in, Pat's board, reactors cut on the words.
    m('slowPush', {id:'host', section:'Verse', len:64, pool:['synergy'], cell:'stack3.0', scene:'verse'}), c('board', 64, 64, 'stack3.1', 'gen:board', {scene:'verse'}),
    m('vocalCut', {id:'react', at:64, len:64, pool:['keys', 'people', 'arjun'], cell:'stack3.2', scene:'verse'}),
    // 8-11: the gallery, the border chasing the loudest stem.
    m('speakerChase', {id:'chase', at:{anchor:'bar:8'}, len:64, pool:['synergy', 'drums', 'keys', 'people', 'gen:camera-off', 'arjun'], scene:'g6'}),
    // 12-19: the build.
    m('freezeTheCall', {id:'freeze', at:{anchor:'bar:12'}, len:32, pool:['synergy', 'drums', 'keys', 'guitar', 'gen:camera-off', 'people', 'arjun', 'synthia', 'gen:board'], scene:'freeze'}),
    m('breakoutRooms', {id:'rooms', at:{anchor:'bar:14'}, len:32, skip:1, pool:['synergy', 'keys', 'people', 'arjun', 'synthia', 'strategy', 'linda', 'gen:board'], scene:'rooms'}),
    m('cellSplit', {id:'split', at:{anchor:'bar:16'}, len:16, pool:['people'], cell:'stack3.1', scene:'split'}),
    m('retriggerRoll', {id:'roll', at:{anchor:'bar:17'}, len:16, pool:['keys', 'people', 'arjun', 'synergy'], cells:G4, scene:'roll'}),
    m('poorConnection', {id:'poor', at:{anchor:'bar:18'}, len:16, pool:['keys'], cell:'G6.2', scene:'poor'}),
    c('board19', 304, 8, 'full', 'gen:color:#000000', {scene:'tag'}), c('black', 312, 8, 'full', 'gen:color:#000000', {scene:'tag'}),
    {boardMoves:[{id:'board19', at:304, frames:4, align:'start'}]},   // the board alone grows out of its home (G14)
    // 20-23: BACK., drop A, Sink In.
    m('pegTakeover', {id:'ignite', at:{anchor:'cue:impact'}, len:8, pool:['people'], scene:'dropA'}),
    c('ens', 328, 40, 'stack3.0', 'shot:people', {scene:'dropA', time:{in:1}}), c('host2', 328, 40, 'stack3.1', 'shot:synergy', {scene:'dropA', time:{in:2}}),
    m('hitWarp', {id:'pads', at:328, len:40, pool:['drums'], cell:'stack3.2', scene:'dropA'}),
    m('tapeCoupling', {id:'sink', pool:['synthia', 'drums', 'people', 'arjun'], cells:G4, scene:'sink'}),
    // 24-27: drop B, the Droste, the kaleido and the dub delay, the fill.
    c('chaseB', 384, 32, 'G9.0', 'shot:keys', {scene:'dropB', time:{in:1}}), m('drosteDive', {id:'droste', at:{anchor:'bar:24'}, len:16, cell:'G9.4', scene:'dropB'}),
    m('kaleido', {id:'kal', at:{anchor:'bar:26'}, len:16, pool:['people'], cell:'G6.0', scene:'kal'}), m('dubDelay', {id:'dub', at:{anchor:'bar:26'}, len:16, pool:['synergy'], cells:['G6.1', 'G6.3', 'G6.5', 'G6.4'], scene:'kal'}),
    m('offbeatCut', {id:'fill', at:{anchor:'bar:27'}, len:16, pool:['keys', 'people', 'arjun'], cell:'stack3.1', scene:'fill'}),
    // 28-29: everyone leaves; the tape stops.
    m('leaveMeeting', {id:'leave', at:{anchor:'bar:28'}, len:32, pool:['synergy', 'keys', 'people', 'gen:camera-off', 'arjun', 'gen:board'], scene:'leave'}),
    m('tapeStop', {}),
  ];
  // The cold open flashes forward to BACK.: the impact screen, re-timed to frame 0.
  patches.push({board:[{id:'back', at:0, len:6, text:{ref:'song:impact#0'}}]});
  const edl = merge(createEDL({loop:true}), ...patches);
  edl.overrides.push(...edl.clips.filter(x => /^leave\./.test(x.id) && x.cell === 'L1.0').map(x => ({target:x.id, rule:'G10', note:'Synergy closes the film full frame; the tape stop and the dim carry the softness'})),
    {target:'chaseB', rule:'G10', note:'the Droste dive carries this tile out of frame; it is never seen at the full push'});
  return edl;
}

section('9. a 60 s film', () => {
  const edl = film(drop), errs = validate(edl);
  ok(errs.length === 0, `the film EDL is valid (${edl.clips.length} clips, ${edl.transports.length} transports)`);
  const times = [];
  let p;
  for (let i = 0; i < 7; i++) { const t0 = performance.now(); p = compile(edl, {plan:drop, shots, features}); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  // The plan's knob-recompile budget, on the best of 7 warm runs: a loaded machine (two
  // engineers, four CPUs) only ever adds time, so the fastest run is the compile's own cost and
  // a real regression still moves it. The median is reported alongside.
  const best = times[0], median = times[3];
  ok(best <= 100, `compile: best of 7 ${best.toFixed(1)} ms for ${p.frames} frames, ${p.stats.layers} layers (budget 100 ms; median ${median.toFixed(1)} ms; runs ${times.map(t => t.toFixed(0)).join('/')})`);
  if (verbose) for (const e of [...p.lint.errors, ...p.lint.warnings]) log(`    ${e.rule} ${e.message}`);
  ok(p.lint.errors.length === 0, `the film compiles clean (${p.lint.errors.slice(0, 4).map(e => `${e.rule} ${e.message}`).join('; ')}); ${p.lint.warnings.length} warnings`);
  const h1 = compile(edl, {plan:drop, shots, features}).hash(), h2 = compile(JSON.parse(stringify(edl)), {plan:drop, shots:SHOTS, features:planFeatures(drop)}).hash();
  ok(h1 === h2 && /^[0-9a-f]{16}$/.test(h1), `deterministic: two compiles, one hash (${h1})`);
  const nudged = JSON.parse(JSON.stringify(edl)); nudged.clips.find(c => c.id === 'ens').time.in = 1 + 1 / 24;
  ok(compile(nudged, {plan:drop, shots, features}).hash() !== h1, 'one frame of one clip changes the hash');
  ok([0, 17, 333, 576, 959, 960, 1103, 1200, 1439].every(f => JSON.stringify(p.compileFrame(f)) === JSON.stringify(p.frame(f))), 'compileFrame(f) is the frame, computed on its own');
  ok(p.frames === 1440 && p.all.every((fr, f) => fr.f === f && near(fr.t, f / 24)), '1,440 frames at 24 fps');
  const fr = p.frame(960);
  ok(fr.layers.some(l => l.fx.some(x => x.type === 'pegVideo' && x.mix === 1)) && fr.board.screen >= 0 && p.board.screens[fr.board.screen].kind === 'impact', 'frame 960: ignition peg video, and the board on BACK.');
  ok(p.all.slice(948, 960).every(x => x.layers.every(l => l.gen === 'color:#000000')), 'frames 948-959: black');
  const s0 = p.board.screens[p.frame(0).board.screen];
  ok(s0?.text === 'BACK.' && s0.words[0].start === 0 && p.frame(0).board.rect.h === 1920 && p.board.screens[p.frame(960).board.screen].text === 'BACK.', "frame 0: BACK. re-timed from 40 s for the cold open, on the whole frame; the song's own BACK. at 960");
  ok(p.decode.max <= DECODE_LIMITS.desktop && p.decode.prefetch.length > 10 && p.decode.prefetch.every(x => x.preroll <= x.frame), `decode schedule: peak ${p.decode.max} live decodes, ${p.decode.prefetch.length} prefetches, each prerolled`);
  ok(p.cuts.length > 40 && p.cuts.every((f, i) => !i || f > p.cuts[i - 1]), `${p.cuts.length} cuts, ascending`);
  const layer = p.frame(400).layers.find(l => l.kind === 'video'), inv = invert(layer.transform.matrix), [cx, cy] = apply(layer.transform.matrix, layer.cell.x + layer.cell.w / 2, layer.cell.y + layer.cell.h / 2), [bx, by] = apply(inv, cx, cy);
  ok(near(bx, layer.cell.x + layer.cell.w / 2, 1e-9) && near(by, layer.cell.y + layer.cell.h / 2, 1e-9) && near(cx, layer.crop.x + layer.transform.cx * layer.crop.w, 1e-9), 'matrix: the cell centre maps to the zoom centre in the crop, and back');
  const syn = p.all.map(x => x.layers.find(l => l.robot)).find(Boolean);
  ok(syn && syn.robot.mouth.x > syn.cell.x && syn.robot.mouth.x < syn.cell.x + syn.cell.w, 'robot layers carry the tracked mouth row in output px');
  // The same film in another post's plan: anchors move with the words.
  const p2 = compile(film(planOf('drop60', POSTS[1])), {plan:planOf('drop60', POSTS[1]), shots});
  ok(p2.lint.errors.length === 0 && p2.hash() !== h1, 'the film recompiles against another post');
  for (const format of ['1:1', '16:9']) {
    const q = compile({...edl, format}, {plan:drop, shots, features});
    ok(q.frames === 1440 && q.width === FORMATS[format].w && q.all[400].layers.every(l => l.cell.w <= FORMATS[format].w), `${format}: the same EDL re-lays out (${q.lint.errors.length} lint errors, layout-specific)`);
  }
});

// =================================================================================================
const SHOTS_JSON = path.join(ROOT, 'src/videostudio/media/shots.json');
if (fs.existsSync(SHOTS_JSON)) section('10. the real shot index', () => {
  const data = JSON.parse(fs.readFileSync(SHOTS_JSON, 'utf8')), real = shotIndex(data);
  const ids = [...new Set(real.values())];
  ok(ids.length === data.shots.length && ids.every(s => s.contentBox.w > 0 && Object.values(s.safeCrops).every(r => r.w > 0)), `shots.json: ${ids.length} shots, rects normalised`);
  const by = alias => real.get(alias);
  ok(by('drums-playing')?.reverseClass === 'R0' && by('synergy-camera-v2-listening')?.robot === 'synergy' && by('drums-playing').hitTimes.every(t => t >= 0 && t <= by('drums-playing').duration), 'aliases resolve; Synergy is tracked; hits become seconds');
  const ctx = {plan:drop, shots:real, features, format:'9:16', seed:5};
  const metro = compile(metronomeEDL(drop), {plan:drop, shots:real});
  ok(metro.lint.ok, 'the metronome compiles with the real index');
  const real9 = ['synergy-camera-v2-listening', 'keys-listening', 'people-listening', 'arjun-listening'].filter(a => by(a));
  const p = compile(merge(createEDL({}), MOVES.retriggerRoll.fn({...ctx, at:{anchor:'bar:17'}, len:16, pool:real9, cells:['G6.0', 'G6.1', 'G6.2', 'G6.3']}), MOVES.hitWarp.fn({...ctx, at:{anchor:'bar:24'}, len:32, pool:['drums-playing'], cell:'G9.1'})), {plan:drop, shots:real, features});
  ok(p.lint.errors.every(e => ['G10', 'G8'].includes(e.rule)) && p.clips.length > 8, `moves on real shots compile (${p.lint.errors.length} lint errors: ${[...new Set(p.lint.errors.map(e => e.rule))].join(', ') || 'none'})`);
  const rev = compile(createEDL({clips:[{id:'x', at:64, len:16, cell:'G6.0', asset:'shot:drums-playing', time:{reverse:true}}, {id:'y', at:64, len:16, cell:'G6.1', asset:'shot:printer-printing'}]}), {plan:drop, shots:real});
  ok(rev.lint.errors.some(e => e.rule === 'G7') && rev.lint.errors.some(e => e.rule === 'S4'), 'real index: reversing the drums is refused; the printer take needs review');
  const dp = by('drums-playing'), hw = hitWarp({plan:drop, at:384, len:32, hits:dp.hitTimes});
  ok(hw.matched.length >= 4 && hw.rates.every(r => r >= .85 - 1e-9 && r <= 1.15 + 1e-9), `real drums-playing: ${hw.matched.length} of its ${dp.hits.length} hits warp onto 8ths in bars 24-25 (rates ${Math.min(...hw.rates).toFixed(3)}-${Math.max(...hw.rates).toFixed(3)})`);
}); else log('10. the real shot index: src/videostudio/media/shots.json not found, skipped');

const dump = process.argv.indexOf('--dump');
if (dump > 0) {
  const dir = process.argv[dump + 1];
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir, 'film.edl.json'), stringify(film(drop)));
  fs.writeFileSync(path.join(dir, 'fixture-shots.json'), JSON.stringify({shots:SHOTS}, null, 1));
  log(`wrote ${path.join(dir, 'film.edl.json')} and fixture-shots.json`);
}

// =================================================================================================
if (process.argv.includes('--render')) {
  const before = checks, require = createRequire(import.meta.url);
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('--render needs Playwright'); })();
  const TYPES = {'.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.wav':'audio/wav'};
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/') { res.writeHead(200, {'Content-Type':'text/html'}); res.end('<!doctype html><meta charset="utf-8"><title>videostudio</title>'); return; }
    for (const base of [ROOT, path.join(ROOT, 'public')]) {
      const file = path.join(base, url);
      if (file.startsWith(base) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, {'Content-Type':TYPES[path.extname(file)] || 'application/octet-stream'}); fs.createReadStream(file).pipe(res); return; }
    }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => log(`   page error: ${e.message}`));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const r = await page.evaluate(async () => {
      const P = await import('/src/videostudio/edl/params.js'), E = await import('/src/allhands/engine.js'), {FORMS} = await import('/src/allhands/forms.js');
      const {lyricsFromPost, SAMPLE_POST, syllables} = await import('/src/allhands/lyrics.js'), {prepareLady} = await import('/src/allhands/lady.js'), {kickSteps} = await import('/src/pegboard/eq.js');
      const form = FORMS.drop60, lyrics = lyricsFromPost(SAMPLE_POST);
      const plan = form.arrange(lyrics, Object.fromEntries(form.voiced(lyrics).map(w => [w, .18 + .11 * syllables(w)])));
      const lady = await prepareLady(new OfflineAudioContext(1, 1, 44100), plan);
      const t0 = performance.now(), audio = await E.render(plan, new Map(), {tune:{stems:true}}, lady), ms = performance.now() - t0;
      const F = P.buildFeatures(plan, audio), fr = s => Math.round(s * 24), T = plan.timing;
      const mean = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i]; return s / (b - a); };
      const kicks = kickSteps(plan), on = [], off = [];
      for (let s = 12 * 16; s < 16 * 16; s++) if (kicks[s]) { const g = Math.floor((T[s] + .01) * 24); on.push(F.kickLevel[g]); off.push(F.kickLevel[g + 6]); }
      return {channels:audio.numberOfChannels, frames:F.frames, want:Math.ceil(plan.duration * 24), ms, source:F.source,
        // The silence: from the end of her post-choke tag to the impact, read from the plan.
        window:(() => { const tag = plan.lady.find(e => e.role === 'tag'); return [T[tag.at] + tag.gate + .03, T[plan.choke.until] - .03]; })(),
        silence:(() => { const tag = plan.lady.find(e => e.role === 'tag'), a = T[tag.at] + tag.gate + .03, b = T[plan.choke.until] - .03; return Object.fromEntries(Object.entries(F.stems).map(([n, x]) => [n, Math.max(...x.slice(Math.ceil(a * 24), Math.floor(b * 24)))])); })(),
        drumsDrop:mean(F.stems.drums, fr(48), fr(56)), bassBuild:mean(F.stems.bass, fr(26), fr(36)), bassDrop:mean(F.stems.bass, fr(48), fr(56)),
        ladyBuild:mean(F.stems.lady, fr(24), fr(38)), ladyVerse:mean(F.stems.lady, fr(8), fr(20)), kickOn:on.reduce((a, b) => a + b, 0) / on.length, kickOff:off.reduce((a, b) => a + b, 0) / off.length,
        eq:F.eq && {N:F.eq.N, max:Math.max(...F.eq.data)}, kicksMatch:F.kick.every((v, i) => v === P.planFeatures(plan).kick[i])};
    });
    ok(r.channels === 8 && r.frames === r.want && r.source === 'render', `render: ${r.channels} channels (master + 6 stems), ${r.frames} frames, rendered in ${(r.ms / 1000).toFixed(1)} s`);
    ok(Object.values(r.silence).every(v => v <= .02), `render: every stem silent from the tag's end to the impact, ${r.window.map(t => t.toFixed(2)).join('-')} s (${Object.entries(r.silence).map(([n, v]) => `${n} ${v.toFixed(2)}`).join(', ')})`);
    ok(r.drumsDrop > .4 && r.bassDrop > r.bassBuild + .2, `render: drums ${r.drumsDrop.toFixed(2)} in drop B; bass ${r.bassBuild.toFixed(2)} in the build (out), ${r.bassDrop.toFixed(2)} in the drop`);
    ok(r.ladyBuild > r.ladyVerse + .2, `render: the lady's stem carries the ladder (${r.ladyBuild.toFixed(2)} in the build, ${r.ladyVerse.toFixed(2)} in the verse)`);
    ok(r.kickOn > r.kickOff + .1, `render: kickLevel peaks on the plan's kicks (${r.kickOn.toFixed(2)} on, ${r.kickOff.toFixed(2)} half a beat later)`);
    ok(r.eq?.N === 8 && r.eq.max > .3 && r.kicksMatch, 'render: master EQ bands; kick onsets identical to the plan fallback');
  } finally { await browser.close(); server.close(); }
  log(`11. render features: ${checks - before} checks`);
}

log(`check-videostudio: ${checks} checks passed`);
