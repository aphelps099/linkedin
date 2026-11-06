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
//  15. the band and the river: every track on its own form, the sample and three casting picks with the voice
//      bank, three formats: 0 lint errors; Strategy and Synthia speak in their own tiles; the couplet drop; the river
//  11. with --render: feature tracks from a real engine.render stems render, in
//      headless Chromium (about 30 s): channel mapping, the choke, the ladder
// node scripts/check-videostudio.mjs [--verbose] [--render] [--dump DIR]   (--dump writes the film's EDL and the fixture shots)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {createRequire} from 'node:module';
import {FORMS, formOf} from '../src/allhands/forms.js';
import {castSong, settleCast} from '../src/allhands/casting.js';
import {AVAILABLE} from '../src/allhands/voices/voice-table.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {timingTable, STEP} from '../src/allhands/song.js';
import {withColdOpen} from '../src/allhands/drop.js';
import {kickSteps} from '../src/pegboard/eq.js';
import {validate, stringify, parse, createEDL, merge, canonical, FX, FX_TYPES, PSYCH} from '../src/videostudio/edl/schema.js';
import {resolveAt, stepTime, stepAtTime, ladyTime, cutFrame, pegFrame, hitFrame, audioLatency, listAnchors} from '../src/videostudio/edl/anchors.js';
import {EASES, evaluate, paramFn, integrateKeys, planFeatures, buildFeatures, envelope, levelOf, checkParam} from '../src/videostudio/edl/params.js';
import {gauss, tapeCurve, speedFit, hitWarp, transportTime, clipTimeMap} from '../src/videostudio/edl/remap.js';
import {compile, shotIndex, layerMatrix, invert, apply, resolveCrop, DECODE_LIMITS, UPSCALE} from '../src/videostudio/edl/compile.js';
import {VOICE_SHOTS} from '../src/videostudio/treatments/shared.js';
import {RIVER, RIVER_CLASSES} from '../src/videostudio/treatments/offsite-psych.js';
import {chokeFrames, PEG_LEAD} from '../src/videostudio/edl/anchors.js';
import {metronomeEDL, expectedCuts} from '../src/videostudio/edl/metronome.js';
import {FORMATS, CLASSES, GUTTER, RADIUS, SAFE, HOME, FULL_BOARD, sameRect, insideSafeBand, layout, cellRect, layoutClassOf, cellIds} from '../src/videostudio/layouts.js';
import {boardGrid, boardTypeBounds, safeSpan} from '../src/videostudio/gl/board-layer.js';
import {buildScreens, boardState, paint, strikeRows, strikeWeight} from '../src/pegboard/choreo.js';
import {PALETTE} from '../src/pegboard/board.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';
import {MOVES, MOVE_NAMES} from '../src/videostudio/moves/index.js';
import {backbeatHits} from '../src/videostudio/edl/params.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {TREATMENTS, BY_TRACK, RECORDED, treatmentFor, treatmentNamed} from '../src/videostudio/treatments/index.js';
import {FRAMES as PRINTER_FRAMES, LINES as PRINTER_LINES, INTRO as PRINTER_INTRO, GLIDES as PRINTER_GLIDES} from '../src/videostudio/treatments/printer-song.js';
import {SHOT as PRINTER_SHOT, dreamAt as printerDream} from '../src/videostudio/treatments/printer-mouth.js';
import {TRAIL_MAX} from '../src/videostudio/edl/compile.js';

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

// =================================================================================================
// 12. The psychedelic pixelation (Offsite): the new effects in the vocabulary, the features they bind to,
// the trail's copies, canon on Synergy and mirrors, and the treatments chosen by track.
const NEW_FX = ['breathe', 'paletteWash', 'trail', 'radialFold', 'pegBloom', 'chromaDrift'];
section('12. the psychedelic pixelation', () => {
  // The vocabulary: each new effect validates, with its parameters and values checked.
  const clipWith = fx => createEDL({clips:[{id:'x', at:16, len:32, cell:'G6.1', asset:'shot:people', time:{in:1}, frame:{dx:[[0, 0], [32, 200]]}, fx}]});
  const good = [{type:'breathe', px:{add:[{bind:'voices', scale:14, base:-1, attack:.03, release:.2}, {bind:'clap', scale:8, release:.16}]}, cx:.5, cy:.5}, {type:'paletteWash', mix:.5, hue:[[0, 0], [32, 2]]},
    {type:'trail', taps:3, frames:2, decay:{bind:'clap', scale:.4, base:.2}, blend:'lighten'}, {type:'radialFold', wedges:6, angle:[[0, 0], [32, 45]]}, {type:'pegBloom', amount:.4, cx:.5, cy:.66, space:'frame'}, {type:'chromaDrift', px:3, angle:30, radial:2}];
  ok(NEW_FX.every(t => FX[t] && FX_TYPES.includes(t)) && validate(clipWith(good)).length === 0, `the vocabulary has the new effects (${NEW_FX.join(', ')}) and they validate`);
  const bad = validate(createEDL({clips:[{id:'x', at:0, len:4, cell:'G6.0', asset:'shot:people', fx:[{type:'trail', taps:2, blend:'screen'}, {type:'pegBloom', amount:.5, space:'page'}, {type:'radialFold', folds:6}, {type:'breathe', px:{bind:'choir'}}]}],
    camera:[{at:0, len:4, fx:[{type:'trail', taps:2}]}]}));
  ok(['.fx[0].blend', '.fx[1].space', '.fx[2].folds', '.fx[3].px.bind', 'camera[0].fx[0].type'].every(k => bad.some(e => e.path.endsWith(k))), `bad parameters are caught with readable paths (${bad.map(e => e.path).join(', ')})`);
  // Identity values compile away.
  const idle = run(clipWith([{type:'breathe', px:1}, {type:'paletteWash', mix:0}, {type:'trail', taps:0}, {type:'radialFold', wedges:1}, {type:'pegBloom', amount:0}, {type:'chromaDrift', px:0, radial:0}]));
  ok(idle.frame(100).layers.length === 1 && idle.frame(100).layers[0].fx.length === 0, 'each new effect at its identity value compiles away');
  // The features: claps on the frames that hold the backbeat as it sounds; voices the loudest voice stem.
  const hits = backbeatHits(drop), want = new Set(hits.map(h => hitFrame(stepTime(drop, h.step) + h.late * (stepTime(drop, h.step + 1) - stepTime(drop, h.step)), drop)));
  const on = [...features.clap.keys()].filter(g => features.clap[g]);
  ok(hits.length > 20 && on.length === want.size && on.every(g => want.has(g)), `clap: ${on.length} frames, one on each backbeat hit as it sounds`);
  const vo = envelope(features, {bind:'voices'}), vmax = Array.from(vo).every((v, g) => Math.abs(v - Math.max(features.stems.voice[g], features.stems.lady[g])) < 1e-6);
  ok(vmax && checkParam({bind:'voices'}).length === 0 && checkParam({bind:'clap'}).length === 0, 'voices: the loudest of the voice stems per frame; voices and clap are binds');
  // A breathing mosaic follows its binds frame by frame.
  const br = run(clipWith([good[0]])), pxs = [];
  for (let f = 0; f < br.frames; f++) { const l = br.frame(f).layers[0]; if (l?.clipId === 'x') pxs.push(l.fx.find(x => x.type === 'breathe')?.px ?? 0); }
  ok(Math.max(...pxs) > 8 && pxs.some(v => v <= 1), `breathe follows the voices and the claps (block size 0 to ${Math.max(...pxs).toFixed(1)} px over the clip)`);
  // A peg bloom centred on the frame: into the cell's units, its reach the frame's farthest corner.
  const pb = run(clipWith([good[4]])).frame(100).layers[0].fx[0], cell = cellRect('9:16', 'G6.1'), px = .5 * 1080, py = .66 * 1920;
  ok(near(pb.cx, (px - cell.x) / cell.w, 1e-9) && near(pb.cy, (py - cell.y) / cell.h, 1e-9) && near(pb.reach, Math.hypot(540, py), 1e-9) && pb.space === 'cell', `pegBloom space:frame lands in cell units (${pb.cx.toFixed(3)}, ${pb.cy.toFixed(3)}), reach ${pb.reach.toFixed(0)} px: one circle across the call`);
  // Trails: the clip as it was 2k frames earlier (its own source frame and transform), over it, fading.
  const plain = run(clipWith([])), tr = run(clipWith([{type:'trail', taps:3, frames:2, decay:.5}])), f = 120, layers = tr.frame(f).layers;
  const taps = layers.filter(l => l.trail), main = layers.find(l => l.clipId === 'x');
  const same = taps.every(l => { const was = plain.frame(f - 2 * l.trail.k).layers.find(x => x.clipId === 'x'); return was && l.srcFrame === was.srcFrame && l.transform.matrix.every((v, i) => near(v, was.transform.matrix[i], 1e-9)) && near(l.opacity, .5 ** l.trail.k, 1e-12) && l.chrome === null && !l.robot; });
  ok(taps.length === 3 && layers.indexOf(main) === layers.length - 4 && taps.map(l => l.clipId).join() === 'x~1,x~2,x~3' && same && taps.every(l => l.trail.blend === 'lighten'), `trail 3 taps, 2 frames apart: the clip's own frames ${taps.map(l => l.srcFrame).join(', ')} behind ${main.srcFrame}, at .5, .25, .125, over it, no chrome`);
  const start = tr.clips.find(c => c.id === 'x').from;
  ok(tr.frame(start).layers.filter(l => l.trail).length === 0 && tr.frame(start + 3).layers.filter(l => l.trail).length === 1 && tr.decode.max === plain.decode.max && tr.hash() === run(clipWith([{type:'trail', taps:3, frames:2, decay:.5}])).hash() && tr.compileFrame(f).layers.length === layers.length,
    `trails start with the clip (none on its first frame, one 3 frames in), share its decode (peak ${tr.decode.max}), compile the same twice and seek-safe; at most ${TRAIL_MAX} copies`);
  // Canon: no new warp on Synergy (a wash is colour, not a warp); kaleidoscope folds only on mirrorable shots.
  const syn = fx => run(createEDL({clips:[{id:'s', at:16, len:16, cell:'G6.0', asset:'shot:synergy', fx:[fx]}]}));
  const refused = NEW_FX.filter(t => FX[t].warps).filter(t => syn(good[NEW_FX.indexOf(t)]).lint.errors.some(e => e.rule === 'G11' && /warp Synergy/.test(e.message)));
  ok(refused.length === 5 && !syn(good[1]).lint.errors.some(e => e.rule === 'G11'), `G11 refuses every new warp on Synergy (${refused.join(', ')}); his face takes the palette wash, which keeps luma`);
  const fold = id => run(createEDL({clips:[{id:'k', at:16, len:16, cell:'G6.0', asset:`shot:${id}`, fx:[{type:'radialFold', wedges:6}]}]})).lint.errors.filter(e => e.rule === 'G11' && /mirrored/.test(e.message)).length;
  ok(fold('keys') > 0 && fold('synthia') > 0 && fold('drums') > 0 && fold('people') === 0, 'radialFold is a mirror: refused on an unflagged shot, a robot and an instrument; allowed on a mirrorable one');
  ok(run(createEDL({clips:[{id:'z', at:16, len:16, cell:'L1.0', asset:'shot:people', frame:{zoom:2.4}, fx:[{type:'breathe', px:9}]}]})).lint.errors.every(e => e.rule !== 'G10'), 'G10: a breathing mosaic of 8 px or more carries the upscale, as a mosaic does');
  // The treatments, chosen by track.
  ok(treatmentFor('offsite').id === 'offsite-psych' && ['circle-back', 'humbled-and-honored', 'hustle'].every(t => treatmentFor(t).id === 'drop60-draft') && treatmentFor(undefined).id === 'drop60-draft'
    && treatmentNamed('track', 'offsite').id === 'offsite-psych' && treatmentNamed('draft', 'offsite').id === 'drop60-draft' && Object.values(BY_TRACK).every(id => TREATMENTS[id]),
    `treatments by track: offsite ${treatmentFor('offsite').id}, the others ${treatmentFor('hustle').id}; 'draft' still names drop60-draft`);
});

if (fs.existsSync(SHOTS_JSON)) section('13. the Offsite cut on the real shot index', () => {
  const real = JSON.parse(fs.readFileSync(SHOTS_JSON, 'utf8')), idx = shotIndex(real), T = TREATMENTS['offsite-psych'], l = lyricsFromPost(SAMPLE_POST);
  for (const track of TRACK_ORDER) {
    const plan = FORMS.drop60.arrange(l, {}, {track, coldOpen:true}), used = new Set();
    for (const format of ['9:16', '1:1', '16:9']) {
      const edl = T.fn(plan, real, {format}), p = compile(edl, {plan, shots:real, format});
      ok(p.lint.errors.length === 0 && stringify(T.fn(plan, real, {format})) === stringify(edl) && compile(T.fn(plan, real, {format}), {plan, shots:real, format}).hash() === p.hash(),
        `offsite-psych on ${track} ${format}: ${edl.clips.length} clips, 0 lint errors (${p.lint.errors.slice(0, 2).map(e => `${e.rule} ${e.message}`).join('; ')}), ${p.lint.warnings.length} warnings, peak ${p.decode.max} decodes; the same bytes and hash twice`);
      let warped = 0, unmirrorable = 0;
      for (const fr of p.all) for (const x of fr.layers) {
        for (const e of x.fx) used.add(e.type);
        const s = x.shotId && idx.get(x.shotId);
        if (s && /^synergy$/i.test(s.characters?.[0] ?? '') && x.fx.some(e => FX[e.type]?.warps)) warped++;
        if (s && x.fx.some(e => e.type === 'radialFold') && (!s.mirrorable || (s.action || []).includes('play'))) unmirrorable++;
      }
      ok(!warped && !unmirrorable && edl.clips.every(c => !c.scene || T.labels[c.scene]), `offsite-psych on ${track} ${format}: no warp on Synergy, kaleidoscopes only on mirrorable shots, every scene labelled`);
      if (format === '9:16') offsiteFlow(track, plan, edl, p, idx);
    }
    ok(NEW_FX.every(t => used.has(t)), `offsite-psych on ${track} uses every new effect (${NEW_FX.join(', ')})`);
  }
});
// Aaron's Offsite notes (a little more slow motion, less of the downbeat, the dot grid for psychedelic images):
// inside a scene a tile changes only on the loop's "and"s and dissolves in; the call's footage runs mostly in slow
// motion, and only R1 footage is ever slowed (R0 plates hold, instruments keep their tempo); the board's region
// carries a psych look on most frames, a full-frame look plays between lines with no Synergy on screen, and
// the BACK. bloom is a mandala on the impact's board.
function offsiteFlow(track, plan, edl, p, idx) {
  const start = new Map(), byCell = new Map();
  for (const c of edl.clips) if (c.scene && typeof c.at === 'number') { start.set(c.scene, Math.min(start.get(c.scene) ?? Infinity, c.at)); if (!byCell.has(c.cell)) byCell.set(c.cell, []); byCell.get(c.cell).push(c); }
  const changes = edl.clips.filter(c => typeof c.at === 'number' && c.asset.startsWith('shot:') && c.at > start.get(c.scene) && (byCell.get(c.cell) || []).some(o => o !== c && o.scene === c.scene && o.at < c.at && o.at + o.len >= c.at));
  const offAnd = changes.filter(c => Math.abs(((c.at % 4) + 4) % 4 - 2) > 1e-9), hard = changes.filter(c => !(Array.isArray(c.frame?.opacity) && c.frame.opacity[0][1] === 0));
  ok(changes.length >= 4 && !offAnd.length && !hard.length, `offsite-psych on ${track}: all ${changes.length} tile changes inside a scene land on an "and" and dissolve in (${changes.map(c => c.at).join(', ')})${offAnd.length ? `; off the "and": ${offAnd.map(c => c.id).join(', ')}` : ''}${hard.length ? `; hard: ${hard.map(c => c.id).join(', ')}` : ''}`);
  let area = 0, slowA = 0; const fastR0 = new Set();
  for (let f = 0; f + 1 < p.frames; f++) {
    const a = p.frame(f), b = p.frame(f + 1);
    for (const l of a.layers) {
      if (l.trail || l.kind !== 'video' || a.transport || b.transport) continue;
      const n = b.layers.find(x => x.clipId === l.clipId && !x.trail); if (!n) continue;
      const v = Math.abs(n.srcTime - l.srcTime) * 24, w = l.cell.w * l.cell.h * l.opacity, s = idx.get(l.shotId);
      area += w;
      if (v > .05 && v < .95) slowA += w;
    }
  }
  // (Slowed on purpose: a rate under 1 anywhere, or the tape. A canon tile's held start is not slow motion.)
  for (const c of edl.clips) {
    const r = c.time?.rate, slowed = c.time?.tape || (typeof r === 'number' ? r < 1 : Array.isArray(r) && r.some(k => k[1] < 1)), s = c.asset.startsWith('shot:') && idx.get(c.asset.slice(5));
    if (slowed && s && (s.reverseClass !== 'R1' || (s.action || []).includes('play'))) fastR0.add(`${c.id} ${s.id}`);
  }
  ok(slowA / area >= .4 && !fastR0.size, `offsite-psych on ${track}: ${(100 * slowA / area).toFixed(0)} % of the footage on screen (by area) runs in slow motion, all of it R1 and none an instrument${fastR0.size ? `; slowed: ${[...fastR0].slice(0, 3).join(', ')}` : ''}`);
  if (track !== 'offsite') return;
  const region = p.all.filter(fr => fr.board.psych?.some(x => !x.rect)).length, full = p.all.filter(fr => fr.board.psych?.some(x => x.cell === 'full'));
  const withHim = full.filter(fr => fr.layers.some(l => l.shotId && /^synergy$/i.test(idx.get(l.shotId)?.characters?.[0] ?? '')));
  const I = hitFrame(stepTime(plan, plan.choke.until), plan), bloomAt = p.frame(I + 6).board.psych || [];
  ok(region >= .8 * p.frames && full.length >= 48 && !withHim.length && bloomAt.some(x => x.look === 'mandala' && !x.rect) && p.frame(I + 6).layout === 'full',
    `offsite-psych on offsite: a psych look in the board's region on ${region} of ${p.frames} frames; a full-frame look on ${full.length} frames, none with Synergy on screen; the BACK. bloom a mandala on the full board (frame ${I + 6})`);
}

// 14. Psych imagery on the dot grid (pegboard/psych.js): the board cue {type:'psych', look, params} validates,
// compiles into frame.board.psych on the board's clock (fade, params, the drive), keeps Synergy's mouth row
// clear and true black black, and round-trips.
section('14. psych imagery on the dot grid', () => {
  const T = drop.timing, F24 = s => Math.floor(T[s] * 24);
  const cue = (o = {}) => ({type:'psych', id:'p', at:64, len:64, look:'mandala', params:{fold:8, level:[[0, .4], [64, .9]], breath:{bind:'voices', scale:.5, base:.5}}, seed:3, ...o});
  const edl = (cues, clips = []) => createEDL({clips, board:[{id:'song', at:0, text:{ref:'song'}}, ...cues]});
  ok(PSYCH.looks.length === 10 && PSYCH.looks.every(l => PSYCH.describe(l)?.caption && Object.keys(PSYCH.params(l)).includes('level')) && validate(edl([cue(), cue({id:'q', look:'footage', cell:'G6.1', params:{sharpen:1.2}})])).length === 0,
    `the board takes psych cues: ${PSYCH.looks.join(', ')}, each with its params and a caption`);
  const bad = validate(edl([cue({look:'lava'}), cue({params:{folds:8}}), cue({fade:1}), cue({type:'pattern'}), cue({params:{level:{bind:'choir'}}}), cue({cell:'G7.0'}), cue({text:'HI'})]));
  ok(['board[1].look', 'board[2].params.folds', 'board[3].fade', 'board[4].type', 'board[5].params.level.bind', 'board[6].cell', 'board[7].text'].every(k => bad.some(e => e.path === k)), `bad psych cues are caught with readable paths (${bad.map(e => e.path).join(', ')})`);
  const round = edl([cue(), cue({id:'q', look:'ripples', cell:'G6.1', params:{spacing:5}})]);
  ok(stringify(parse(stringify(round))) === stringify(round), 'psych cues round-trip byte for byte');
  // On the board's clock: a fade in and out over a beat, its params evaluated per frame, the drive from the features.
  const p = run(round), a = F24(64), z = F24(128), list = f => p.frame(f).board.psych, main = f => list(f).find(x => x.cue === 'p');
  const inside = [...Array(z - a).keys()].map(i => a + i).filter(f => main(f));
  const fades = inside.map(f => main(f).fade), levels = inside.map(f => main(f).params.level);
  ok(p.lint.errors.length === 0 && !main(a - 2) && !main(z + 2) && inside.length >= z - a - 2 && fades[0] < .2 && Math.max(...fades) === 1 && fades.at(-1) < .25 && fades.every((v, i) => !i || Math.abs(v - fades[i - 1]) < .25),
    `psych "p" lives frames ${inside[0]}-${inside.at(-1)} (16ths 64-128), fading in and out over a beat (no step over .25)`);
  ok(levels[0] < .45 && levels.at(-1) > .85 && levels.every((v, i) => !i || v >= levels[i - 1] - 1e-9) && inside.every(f => main(f).params.fold === 8 && main(f).time === p.frame(f).board.time && main(f).seed === 3),
    `params are Params: level keyed .4 to .9 across the cue (${levels[0].toFixed(2)} to ${levels.at(-1).toFixed(2)}), fold held at 8, on the board's own clock`);
  const drives = inside.map(f => main(f).drive), claps = drives.filter(d => d.clap > .9).length;
  ok(drives.every((d, i) => !i || d.beat > drives[i - 1].beat) && Math.abs(drives[0].beat - (64 + (main(inside[0]).time - T[64]) / (T[68] - T[64]) * 4) / 4) < 1e-6 && claps > 4 && drives.some(d => d.voice > .3),
    `the drive: the beat from plan.timing (beat ${drives[0].beat.toFixed(2)} at frame ${inside[0]}), ${claps} clap swells and the voices from the feature tracks`);
  const cellCue = list(a + 40).find(x => x.cue === 'q');
  ok(cellCue && cellCue.rect && cellCue.rect.x === cellRect('9:16', 'G6.1').x && cellCue.rect.w === cellRect('9:16', 'G6.1').w && !main(a + 40).rect && p.board.screens.length > 20,
    'a psych cell carries its tile\'s rect; one without a cell paints the board\'s own region, under the song\'s words');
  // The plan-only fallback (no render) and the same program twice.
  ok(run(round, {features:undefined}).hash() === run(round, {features:undefined}).hash() && p.hash() === run(round).hash(), 'psych frames compile the same twice, with the render\'s features or the plan\'s');
  // Synergy's mouth row: a psych cell over his tile is refused; the choke's black stays black (choreo paints nothing at exposure 0).
  const syn = run(edl([cue({cell:'G6.0'})], [{id:'s', at:64, len:64, cell:'G6.0', asset:'shot:synergy', time:{in:1}}]));
  ok(syn.lint.errors.some(e => e.rule === 'G11' && /psych imagery in G6.0 covers Synergy/.test(e.message)), 'G11: psych imagery over Synergy\'s mouth row is refused');
  const ck = run(edl([cue({at:drop.choke.at - 16, len:48})])), dark = [...Array(ck.frames).keys()].filter(f => ck.frame(f).board.psych.length && boardStateAt(ck.frame(f)) === 0);
  ok(dark.length > 3, `across the choke the psych cue is live on ${dark.length} true-black frames, where the board's exposure is 0 and nothing is painted (pegboard check: nothing on true black)`);
  ok(cueCount(round) === 2 && run(edl([cue()])).board.screens.length === p.board.screens.length, 'psych cues are not screens: the song\'s screens are the same with or without them');
});
function boardStateAt(fr) { return boardState(drop, fr.board.time + .5 / 24 - fr.board.lead).exposure; }

// 15. The band and the river (Nov 5). Every track on its own form (forms.js formOf: Offsite plays the river), cast
// by the post with the voice bank's takes (castSong available), the sample and three picks per track, in all three
// formats: 0 lint errors and the same bytes twice. The Drop Edition: Strategy and Synthia speak in a tile of their
// own on the words of their band parts wherever a tile of the call can hold them (never Synergy's, Pat's, the
// board's, a full-frame picture or L1), and a couplet drop keeps the choke's black and the ignition on the plan's
// frames with its Y word on the board at the impact. The river: no transport, cold open, camera or board move; the
// layout grows and shrinks with the layers on bar lines, each re-layout a dissolve; tiles enter from black and
// change only on an "and", dissolving in, save one sharp cut per clear phrase, on its first word, where the
// speaker's tile is at full, without effects and speaking on the words while the board shows them; Synergy at full
// whenever he sings; most of the footage slowed, all of it R1; the river look in the board's region on nearly
// every frame and the frame as dots at both ends; frame 0 and the last frame in one layout (the loop seam).
const PICKS = {'circle-back':[4, 44, 59], 'humbled-and-honored':[0, 5, 13], hustle:[1, 25, 38], offsite:[24, 47, 14]};
if (fs.existsSync(SHOTS_JSON)) section('15. the band and the river', () => {
  const real = JSON.parse(fs.readFileSync(SHOTS_JSON, 'utf8')), idx = shotIndex(real);
  const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/pixel-posts.json'), 'utf8')).map(x => x.post);
  const RE = {strategy:/^strategy$/i, synthia:/^synthia$/i}, chars = l => (l.shotId && idx.get(l.shotId)?.characters) || [];
  const ceiling = (s, r) => (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, '9:16', r).h / r.h;
  const tally = {words:0, spoken:0, held:0, couplets:0, rivers:0};
  for (const track of TRACK_ORDER) for (const [name, post] of [['the sample', SAMPLE_POST], ...(PICKS[track] || []).map(i => [`fixture ${i}`, fixtures[i]])]) {
    const form = formOf(track), cast = castSong(post, {track, available:AVAILABLE}).cast, T = treatmentFor(track);
    const plan = settleCast(FORMS[form].arrange, lyricsFromPost(post), {}, {track, cast, coldOpen:form === 'drop60'}).plan;
    for (const format of ['9:16', '1:1', '16:9']) {
      const edl = T.fn(plan, real, {format}), p = compile(edl, {plan, shots:real, format}), label = `${track} ${name} ${format} (${form})`;
      ok(p.lint.errors.length === 0 && stringify(T.fn(plan, real, {format})) === stringify(edl), `${label}: ${T.id}, ${edl.clips.length} clips, 0 lint errors${p.lint.errors.length ? ` (${p.lint.errors.slice(0, 2).map(e => `${e.rule} ${e.message}`).join('; ')})` : ''}, peak ${p.decode.max} decodes; the same bytes twice`);
      if (form === 'drop60') bandFlow(label, plan, edl, p, format);
      else { riverFlow(label, plan, edl, p, format); tally.rivers++; }
    }
  }
  // A whip slides Synergy under a band tile (Circle Back 16:9, frame 1044, fixtures 7 and 38): G11 names the
  // whip, the tile only in its message; bandSpeakers drops that tile and the board carries the part.
  for (const i of [7, 38]) {
    const track = 'circle-back', format = '16:9', cast = castSong(fixtures[i], {track, available:AVAILABLE}).cast;
    const plan = settleCast(FORMS.drop60.arrange, lyricsFromPost(fixtures[i]), {}, {track, cast, coldOpen:true}).plan, notes = [];
    const edl = treatmentFor(track).fn(plan, real, {format, notes}), p = compile(edl, {plan, shots:real, format});
    ok(p.lint.errors.length === 0, `${track} fixture ${i} ${format}: no band tile covers Synergy's mouth row as a whip slides him under it (${p.lint.errors.length} lint errors${p.lint.errors.length ? `: ${p.lint.errors[0].message}` : ''})`);
  }
  // The couplet drop's X over the build: the film's board shows it while it is sung and when it is struck; her
  // rungs under it (choreo screen.under) wait until it lets go, as on /allhands/'s stage (compile's screen pass).
  // The fixture: the one named if the post still casts a couplet drop on the track, else the first that does
  // (Nov 5: a couplet is the drop only where Whisper heard its impact, vocabulary/impact-heard.json, and
  // fixture 42's is not heard on Circle Back).
  const dropFixture = (track, prefer) => [prefer, ...fixtures.keys()].find(i => castSong(fixtures[i], {track, available:AVAILABLE}).cast.dropTag?.kind === 'couplet');
  const CB = dropFixture('circle-back', 42), HU = dropFixture('hustle', 31);
  for (const [i, track] of [[CB, 'circle-back'], [HU, 'hustle']]) {
    const cast = castSong(fixtures[i], {track, available:AVAILABLE}).cast, format = '9:16';
    const plan = settleCast(FORMS.drop60.arrange, lyricsFromPost(fixtures[i]), {}, {track, cast, coldOpen:true}).plan;
    const p = compile(treatmentFor(track).fn(plan, real, {format}), {plan, shots:real, format}), at = f => p.board.screens[p.frame(f).board.screen];
    const xs = p.board.screens.filter(s => s.over), off = [];
    for (const s of xs) {
      for (const w of s.words) { const f = hitFrame((w.start + w.end) / 2, plan); if (at(f) !== s) off.push(`"${w.text}" f${f}: ${at(f)?.text ?? 'none'}`); }
      if (s.fx?.strike) { const f = hitFrame(s.fx.strike.at + s.fx.strike.draw + .02, plan); if (at(f) !== s) off.push(`strike f${f}: ${at(f)?.text ?? 'none'}`); }
    }
    ok(xs.length >= 2 && !off.length, `${track} fixture ${i} ${format}: the couplet drop's X (${xs.length} screens) holds the film's board while sung and struck, her rungs under it${off.length ? ` (${off.slice(0, 3).join('; ')})` : ''}`);
  }
  // The strike reads in the film: on the frame after it is drawn, the board's own grid (the frame's rect, the
  // format's safe span, painted at the frame's board time as the compositor paints it) carries it in signal,
  // strikeWeight rows tall (2 in PEG-9 and PEG-5; 1 in PEG-3, the 16:9 home's fallback for a long X), across X:
  // the drop's X (a Circle Back couplet drop, above), the anthem's (Hustle fixture 31) and a pair (Circle Back fixture 12).
  {
    const seen = [], bad = [];
    for (const [i, track] of [[CB, 'circle-back'], [HU, 'hustle'], [12, 'circle-back']]) {
      const cast = castSong(fixtures[i], {track, available:AVAILABLE}).cast, plan = settleCast(FORMS.drop60.arrange, lyricsFromPost(fixtures[i]), {}, {track, cast, coldOpen:true}).plan;
      for (const format of ['9:16', '1:1', '16:9']) {
        const p = compile(treatmentFor(track).fn(plan, real, {format}), {plan, shots:real, format}), shifted = p.board.screens.map(s => ({...s, from:s.from - 1 / 48, to:s.to - 1 / 48}));
        p.board.screens.forEach((s, j) => {
          if (!s.fx?.strike) return;
          const f = hitFrame(s.fx.strike.at + s.fx.strike.draw + .02, plan), fr = p.frame(f), r = fr.board?.rect;
          if (fr.board?.screen !== j || !r) { if (s.over) bad.push(`${track} f${i} ${format} "${s.text}" not up at f${f}`); return; }
          const g = boardGrid(Math.round(r.w), Math.round(r.h), undefined, safeSpan(r, SAFE[format])), sc = shifted[j], t = fr.board.time + 1 / 48 - (fr.board.lead ?? PEG_LEAD);
          paint(g.board, shifted, t, {plan, layoutOf:g.layoutOf, place:g.place, pitch:g.pitch});
          const l = g.layoutOf(sc); let page = l.pages[0]; for (const pg of l.pages) { const c0 = pg.lines[0]?.chars[0]; if (c0 && sc.words[c0.word]?.start <= t + .001) page = pg; }
          const rows = strikeRows(sc, l, page, g.place(sc, l, page)), want = strikeWeight(l.font, l.k || 1);
          const lit = rows.every(q => { for (let y = q.y0; y < q.y0 + q.h; y++) for (let x = Math.max(0, q.x0); x <= Math.min(g.cols - 1, q.x1); x++) { const n = y * g.cols + x; if (g.board.tone[n] !== PALETTE.signal.id || g.board.I[n] < 1 - 1e-6) return false; } return true; });
          if (!rows.length || !lit || rows.some(q => q.h !== want)) bad.push(`${track} f${i} ${format} "${s.text}" f${f}: ${rows.map(q => q.h).join(',')} rows (want ${want})${lit ? '' : ', not lit'}`);
          else seen.push({format, font:l.font, h:want, px:want * g.pitch});
        });
      }
    }
    const tall = seen.filter(q => q.format === '9:16');
    ok(seen.length >= 9 && !bad.length && tall.length && tall.every(q => q.h >= 2), `the strike reads in the film: ${seen.length} struck frames across the three formats, each strikeWeight rows tall in signal across X (9:16 home: ${[...new Set(tall.map(q => `${q.h} rows of ${q.px / q.h} px, ${q.px / 4} px at 270 wide`))].join('; ')}; faces ${[...new Set(seen.map(q => `${q.format} ${q.font} ${q.h}`))].join(', ')})${bad.length ? `: ${bad.slice(0, 3).join('; ')}` : ''}`);
  }
  function bandFlow(label, plan, edl, p, format) {
    // Strategy's and Synthia's words: spoken in a tile of theirs, or no tile of the call could hold them there.
    const misses = [];
    for (const b of (plan.band || []).filter(x => RE[x.voice])) for (const w of b.words) {
      const f = hitFrame((w.start + w.end) / 2, plan), fr = p.frame(f);
      tally.words++;
      if (fr.layers.some(l => chars(l).some(c => RE[b.voice].test(c)) && l.chrome?.speaking >= .5 && l.opacity >= .99)) { tally.spoken++; continue; }
      const takes = VOICE_SHOTS[b.voice].map(id => idx.get(id)).filter(Boolean);
      const host = !fr.transport && fr.layout && !/^(full|L1|BOARD)/.test(fr.layout) && fr.layers.some(l => l.kind === 'video' && !l.trail && l.opacity >= .9 && l.cell.id !== 'full' && !/^L1\./.test(l.cell.id)
        && !chars(l).some(c => /^synergy$/i.test(c)) && takes.some(s => (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, format, l.cell).h / l.cell.h >= 1 - 1e-9));
      if (host) misses.push(`${b.role} "${w.display}" f${f}`); else tally.held++;
    }
    // The band's tiles: over a tile of the call, never over Synergy, Pat or the board.
    const bandClips = new Set(edl.clips.filter(c => c.id.startsWith('band.')).map(c => c.id)), under = [];
    for (const fr of p.all) for (const l of fr.layers) if (bandClips.has(l.clipId)) for (const o of fr.layers) if (o !== l && o.cell.id === l.cell.id && (chars(o).some(c => /^synergy$/i.test(c)) || o.kind !== 'video')) under.push(fr.f);
    ok(!misses.length && !under.length, `${label}: Strategy and Synthia speak in their own tiles on every word a tile of the call can hold (${misses.length ? `missed ${misses.slice(0, 3).join(', ')}` : `${bandClips.size} band tiles`}), never over Synergy, Pat or the board`);
    if (plan.drop?.kind === 'couplet') {
      const {black:B, impact:I} = chokeFrames(plan), imp = plan.lady.find(e => e.role === 'impact'), sc = p.board.screens[p.frame(I).board.screen];
      ok(p.all.slice(B, I).every(x => x.layers.every(l => l.gen === 'color:#000000')) && p.frame(B - 1).board.rect && p.frame(I).layers.some(l => l.fx.some(x => x.type === 'pegVideo')) && sc?.kind === 'impact' && !!imp,
        `${label}: the couplet drop: true black f${B}-f${I - 1}, the ignition on f${I}, "${sc?.text}" (${imp?.voice ?? 'her'}) on the board at the impact`);
      tally.couplets++;
    }
  }
  function riverFlow(label, plan, edl, p, format) {
    const BS = 16, QS = 4, N = p.frames, H = HOME[format];
    ok(!edl.transports.length && !(edl.camera || []).length && !(edl.boardMoves || []).length && p.all.every(fr => sameRect(fr.board.rect, H)) && p.frame(0).layout === p.frame(N - 1).layout,
      `${label}: no transport, camera or board move: the board stays home on all ${N} frames; frame 0 and the last frame are both ${p.frame(0).layout}`);
    // The scenes: on bar lines, a new layout each, every one a call layout the river grows through.
    const scenes = [...new Set(edl.clips.map(c => c.scene))].map(id => ({id, from:Math.min(...edl.clips.filter(c => c.scene === id).map(c => c.at))})).sort((a, b) => a.from - b.from);
    const cls = scenes.map(s => layoutClassOf(edl.clips.find(c => c.scene === s.id && c.at === s.from).cell));
    ok(scenes.every(s => s.from % BS === 0) && cls.every((k, i) => RIVER_CLASSES.includes(k) && (!i || k !== cls[i - 1])),
      `${label}: ${scenes.length} scenes on bar lines, the layout growing and shrinking with the layers (${scenes.map((s, i) => `${cls[i]} at bar ${s.from / BS}`).join(', ')})`);
    // Tiles: every one that starts after the film's first step starts at zero light (a dissolve, a ramp in), on an
    // "and" or a bar line, save the clear phrases' sharp cuts.
    const sharp = edl.clips.filter(c => /the sharp moment/.test(c.why ?? '')), soft = edl.clips.filter(c => c.at > 0 && !sharp.includes(c));
    const zero = c => Array.isArray(c.frame?.opacity) && c.frame.opacity[0][1] === 0;
    const bad = soft.filter(c => !zero(c) && !(c.at === scenes.find(s => s.id === c.scene)?.from && (c.frame?.opacity === undefined || zero(c))));
    const off = soft.filter(c => c.at % BS !== 0 && Math.abs(((c.at % QS) + QS) % QS - QS / 2) > 1e-6);
    const phrases = (plan.band || []).filter(b => b.clear !== false);
    ok(!bad.length && !off.length && sharp.length <= phrases.length + 1 && sharp.length >= 1,
      `${label}: every tile eases in from no light on an "and" or a bar line (${soft.length} clips); the only hard cuts are the ${sharp.length} sharp moment${sharp.length === 1 ? '' : 's'} of ${phrases.length} clear phrase${phrases.length === 1 ? '' : 's'}${bad.length ? `; hard: ${bad.slice(0, 3).map(c => c.id).join(', ')}` : ''}${off.length ? `; off the "and": ${off.slice(0, 3).map(c => `${c.id}@${c.at}`).join(', ')}` : ''}`);
    // The clear phrases: the speaker's tile at full, without effects, speaking on each word, while the board shows it.
    const unclear = [];
    for (const b of phrases) for (const w of b.words) {
      const f = hitFrame((w.start + w.end) / 2, plan), fr = p.frame(f), sc = p.board.screens[fr.board.screen];
      const tile = fr.layers.find(l => l.opacity >= .999 && (l.chrome?.speaking ?? 0) >= .5 && (b.voice === 'lady' ? /circle back/i.test(l.chrome?.name ?? '') : chars(l).some(c => RE[b.voice]?.test(c))) && !l.fx.length);
      if (!tile || !sc || !String(sc.text).toUpperCase().includes(String(w.display ?? w.text).toUpperCase().replace(/[.?!,]+$/, ''))) unclear.push(`"${w.display}" f${f}`);
    }
    ok(!unclear.length, `${label}: ${phrases.map(b => `"${b.display}" (${b.voice})`).join(' and ')}: the speaker's tile sharp and speaking on every word, the words on the board${unclear.length ? `; not on ${unclear.join(', ')}` : ''}`);
    // Synergy at full whenever he sings, no warp, nothing over his mouth row.
    const his = (plan.words || []).map(w => hitFrame(stepTime(plan, w.at), plan)), down = his.filter(f => !p.frame(f).layers.some(l => chars(l).some(c => /^synergy$/i.test(c)) && l.opacity >= .999 && !l.fx.some(x => FX[x.type]?.warps)));
    ok(!down.length && p.lint.errors.every(e => e.rule !== 'G11'), `${label}: Synergy at full on all ${his.length} of his words (his hook, once), no warp, his mouth row clear`);
    // Slow motion, R1 only; the dot grid.
    let area = 0, slowA = 0;
    for (let f = 0; f + 1 < N; f++) { const a = p.frame(f), b = p.frame(f + 1); for (const l of a.layers) { if (l.trail || l.kind !== 'video') continue; const n = b.layers.find(x => x.clipId === l.clipId && !x.trail); if (!n) continue; const v = Math.abs(n.srcTime - l.srcTime) * 24, w = l.cell.w * l.cell.h * l.opacity; area += w; if (v > .05 && v < .95) slowA += w; } }
    const fast = edl.clips.filter(c => { const r = c.time?.rate, s = c.asset.startsWith('shot:') && idx.get(c.asset.slice(5)); return s && (typeof r === 'number' ? r < 1 : Array.isArray(r) && r.some(k => k[1] < 1)) && (s.reverseClass !== 'R1' || (s.action || []).includes('play')); });
    const region = p.all.filter(fr => fr.board.psych?.some(x => !x.rect)).length, full = p.all.filter(fr => fr.board.psych?.some(x => x.cell === 'full')).map(fr => fr.f);
    ok(slowA / area >= .5 && !fast.length && region >= .95 * N && full.some(f => f < N / 6) && full.some(f => f > N * 5 / 6),
      `${label}: ${(100 * slowA / area).toFixed(0)} % of the footage on screen slowed, all R1; the river look in the board's region on ${region} of ${N} frames; the frame as dots at the start and the end (${full.length} frames)`);
  }
  ok(tally.spoken >= .8 * tally.words && tally.couplets >= 6 && tally.rivers === 12, `the band on screen: ${tally.spoken} of ${tally.words} sung words of Strategy's and Synthia's in their own speaking tiles, ${tally.held} where no tile of the call can hold one (L1, the full board, the dub delay's four Synergys); ${tally.couplets} couplet drops; ${tally.rivers} river cuts`);
});
function cueCount(e) { return e.board.filter(c => c.type === 'psych').length; }

const dump = process.argv.indexOf('--dump');
// =================================================================================================
// 16. Printer Song (a recorded track): its plan, the printer's film on the real shot index, the waived
// rules and nothing else, the intro, the words on their frames, the mouth, the dream, and the sound file
// the export muxes. Frames here are film frames (the intro is 72 frames; song frame + 72).
if (fs.existsSync(SHOTS_JSON)) section('16. the printer\'s film', () => {
  const real = JSON.parse(fs.readFileSync(SHOTS_JSON, 'utf8')), R = RECORDED['printer-song'], plan = R.plan(), I = PRINTER_INTRO, sf = f => f + I;
  ok(plan.latency === 0 && audioLatency(plan) === 0 && audioLatency({track:'hustle'}) === 720 / 44100 && plan.totalSteps * 3 === PRINTER_FRAMES && stepTime(plan, plan.totalSteps) === 33.5 && I === 72,
    `printer-song: a recording's plan, latency 0 (its own; the engine's tracks keep 16.33 ms), ${plan.totalSteps} steps of 3 frames, ${PRINTER_FRAMES} frames, 33.5 s (a 3 s intro, then the 30.5 s song)`);
  const T = treatmentFor('printer-song'), edl = T.fn(plan, real, {format:'9:16'}), p = compile(edl, {plan, shots:real, format:'9:16'});
  const waived = p.lint.warnings.filter(w => /^waived by override/.test(w.message)), other = p.lint.warnings.filter(w => !waived.includes(w));
  ok(T.id === 'printer-mouth' && p.frames === PRINTER_FRAMES && p.lint.errors.length === 0 && other.every(w => w.rule === 'G9') && waived.every(w => ['G7', 'G4'].includes(w.rule))
    && stringify(T.fn(plan, real, {format:'9:16'})) === stringify(edl) && compile(T.fn(plan, real, {format:'9:16'}), {plan, shots:real, format:'9:16'}).hash() === p.hash(),
    `printer-mouth: ${edl.clips.length} clips, 0 lint errors, ${waived.length} waived warnings (${[...new Set(waived.map(w => w.rule))].join(', ')}: pages reversing as the mouth, scenes on glides), the same bytes and hash twice`);
  ok(edl.overrides.every(o => o.note && !/—/.test(o.note)) && p.decode.max <= DECODE_LIMITS.mobile && edl.clips.every(c => c.asset === `shot:${PRINTER_SHOT}` || (c.id === 'boot' && c.asset === 'gen:color:#000000')),
    `printer-mouth: one take only (${PRINTER_SHOT}: no people, no Pat, no lady; black under the loading screen), every waiver says why, peak ${p.decode.max} decodes`);
  ok(edl.clips.every(c => !c.frame?.mirror && !(c.fx || []).some(x => x.type === 'tile' && x.mirror !== 0) && !(c.fx || []).some(x => FX[x.type]?.mirrors === true)), 'printer-mouth: no reflections (the tiles are copies, mirror 0)');
  // The intro: the whole frame is the board (the loading bar loads, LOADING. on the frame Synergy speaks); it folds
  // into its home over the last 8 frames and the face appears on film frame 72, the song's first, clean.
  const full = f => sameRect(p.frame(f).board.rect, {x:0, y:0, w:1080, h:1920}), load = f => p.frame(f).board.psych.find(x => x.look === 'loading');
  const first = p.frame(I), clean = first.layers.every(l => l.fx.every(x => ['scanline', 'breathe', 'pegVideo'].includes(x.type))) && !first.camera;
  ok([0, 30, 64].every(full) && p.frame(68).board.move === 'intro.home' && sameRect(first.board.rect, HOME['9:16']) && first.layout === 'stack3' && clean && load(11)?.params.progress === 0 && load(63)?.params.progress === 1 && !load(I),
    'the intro: the board takes the frame (f0-64), its bar loads from Synergy\'s word to full on f63, it folds into its home (f65-72) and the face appears on f72, clean (no dream, no camera)');
  // The words: each lights on its frame (the board's screen up on the frame, the word reached by the frame's paint time).
  const L = audioLatency(plan), lit = (s, w, f) => s.words[w].start <= f / 24 + 1 / 48 - L + 1 / 48 + 1e-9;
  const bad = [];
  PRINTER_LINES.forEach(l => l.words.forEach(([word, f], w) => {
    const s = p.board.screens.find(x => x.id === l.name), at = p.frame(f), before = p.frame(f - 1);
    if (p.board.screens[at.board.screen] !== s || !lit(s, w, f) || (lit(s, w, f - 1) && p.board.screens[before.board.screen] === s)) bad.push(`${word}@f${f}`);
  }));
  ok(!bad.length && PRINTER_LINES.every(l => p.board.screens.some(s => s.id === l.name)), `the printer's words land on their frames (${PRINTER_LINES.map(l => l.words.map(([w, f]) => `${w} ${f}`).join(' ')).join(' / ')})${bad.length ? `; late or early: ${bad.join(', ')}` : ''}`);
  const office = p.board.screens.find(s => s.id === 'office'), still = p.board.screens.find(s => s.id === 'still'), burn = p.board.screens.find(s => s.id === 'burn');
  ok(office.text.includes(' ') && office.k === 2 && office.fx.strike?.tone === 'signal' && Math.floor(office.fx.strike.at * 24) === sf(477) && still.k === 2 && Math.floor(still.from * 24 + 1e-9) === sf(494) && p.board.screens.every(s => s.tone !== 'signal' || s.id === 'jam')
    && burn?.ghost === .3 && burn.text === p.board.screens.find(s => s.id === 'thrilled').text,
    'OUT OF / OFFICE. at full size, struck in signal on f549; STILL / PRINTING. in its place on f566; THRILLED TO PRINT. burnt in as a ghost through the night; PAPER JAM. is the one signal word');
  // The mouth: closed at rest, open on g4's peak, swallowed on the breath, its page's edge stuck on the stop; never
  // held on the page's whole logo (source frames 86-118) for more than 12 frames.
  const src = f => p.frame(f).layers.find(l => l.cell.id === (f >= sf(323) && f < sf(348) ? 'L1.0' : 'stack3.1') && !l.trail)?.srcFrame;
  let run = 0, worst = 0;
  for (let f = I; f < PRINTER_FRAMES; f++) { const s = src(f); run = s >= 86 && s <= 118 ? run + 1 : 0; worst = Math.max(worst, run); }
  ok(src(I) === 80 && src(sf(152)) >= 124 && src(sf(93)) <= 92 && src(sf(427)) <= 81 && src(sf(714)) === 85 && src(PRINTER_FRAMES - 1) === 85 && p.frame(sf(158)).layers.some(l => l.reverse) && worst <= 12,
    `the mouth: closed ${src(I)}, g3's nibble ${src(sf(93))}, g4's peak ${src(sf(152))}, swallowed ${src(sf(427))}, jammed ${src(sf(714))}; it reverses to swallow; the logo whole at most ${worst} frames running`);
  // Keyed jumps land on their frames: BLEED. breaks out to the edges and tiles on g7's peaks, the night's wash, zoom and
  // muted mic on B; on the jam the board lets go (no wash, no bloom) and everything freezes.
  const mouth = f => p.frame(f).layers.find(l => (l.cell.id === 'stack3.1' || l.cell.id === 'L1.0') && !l.trail), fxOf = (f, t) => mouth(f).fx.find(x => x.type === t);
  const tray = f => p.frame(f).layers.find(l => l.cell.id === 'stack3.2' && !l.trail);
  ok(!fxOf(sf(330), 'tile') && mouth(sf(330)).transform.zoom === .55 && mouth(sf(331)).transform.zoom === 1 && fxOf(sf(331), 'tile')?.cols === 2 && fxOf(sf(336), 'tile')?.cols === 2 && fxOf(sf(337), 'tile')?.cols === 3 && !mouth(sf(331)).chrome.name
    && !fxOf(sf(427), 'paletteWash') && fxOf(sf(428), 'paletteWash')?.mix === .7 && mouth(sf(427)).chrome.mic === 'on' && mouth(sf(428)).chrome.mic === 'muted' && mouth(sf(494)).chrome.mic === 'on' && mouth(sf(714)).chrome.mic === 'muted' && mouth(sf(428)).transform.zoom === 1
    && fxOf(sf(713), 'contour') && !fxOf(sf(714), 'contour') && !fxOf(sf(714), 'paletteWash') && [sf(714), sf(722), PRINTER_FRAMES - 1].every(f => tray(f).srcFrame === 174 && tray(f).source === 'still'),
    'keyed jumps on their frames: BLEED. edge to edge and 2×2 on f403, 3×3 on f409, no chrome; the wash, the zoom back and the muted mic on f500; the mic back on f566; on the jam f786 the wash and the rings let go, the mic mutes and the tray freezes');
  // The colour arc: the whole face drains with the toner (the eyes too), slips out of register, goes blue on B; the eyes' long bar is warm again.
  const eyes = f => p.frame(f).layers.find(l => l.cell.id === 'stack3.0' && l.clipId.startsWith('eyes')), sat = (l, d = 1) => l.fx.find(x => x.type === 'saturation')?.amount ?? d;
  ok(sat(eyes(sf(403))) === 1 && sat(eyes(sf(414))) <= .101 && eyes(sf(414)).fx.some(x => x.type === 'rgbSplit' && x.px === 8) && eyes(sf(500)).fx.find(x => x.type === 'paletteWash')?.mix >= .7 && eyes(sf(720)).fx.every(x => x.type === 'mosaic'),
    'the colour arc: the eyes drain with TONER LOW. (saturation .1 by f486), the plates slip 8 px, B washes the whole face blue, and the long bar on the jam keeps its amber');
  // The dream: it never covers a gesture (every glide vertex, the bleed and the jam awake); stars only on the tiles, never on
  // the board (in the bleed the board's panel lies over them), never green.
  const verts = PRINTER_GLIDES.flatMap(g => g.vertices.map(([t]) => Math.floor(t * 24 + 1e-9)));
  const asleepOnGesture = [...verts, ...Array.from({length:25}, (_, i) => 323 + i), 706, 710, 712, 714].filter(f => printerDream(f) > 0);
  let stars = 0, starsOnBoard = 0;
  for (let f = 0; f < PRINTER_FRAMES; f++) { const fr = p.frame(f), r = fr.board.rect; for (const l of fr.layers) if (l.fx.some(x => x.type === 'sparkle')) { stars++; const c = l.cell, over = r && c.x < r.x + r.w && r.x < c.x + c.w && c.y < r.y + r.h && r.y < c.y + c.h; if (over && !fr.board.over) starsOnBoard++; } }
  const sparkTones = edl.clips.flatMap(c => (c.fx || []).filter(x => x.type === 'sparkle')).every(x => x.tone >= 0 && x.tone <= 1);
  ok(!asleepOnGesture.length && stars > 1000 && !starsOnBoard && sparkTones && edl.camera.every(c => c.board === false),
    `the dream: awake on every glide vertex, the bleed and the jam; ${stars} star layer-frames, none on the board (blue, white or signal: never green); the camera floats and lunges with the board held still`);
  // Square edges (Aaron's note after his studio's loader): stepped rings in big blocks and pixel motion tiles. The
  // loading screen's eye opens, flows in on the sixteenths and shuts onto the full bar before the fold; the eyes, the
  // mouth and the body dream in rings and tiles (never on a glide vertex); FULL's letterbox is a tunnel round the
  // boxed printer, gone on BLEED.; the copies come apart in tiles before the pegs; at night the board's rings run on
  // into the face and let go on the jam. Every tile deal and every ring step lands on the song's grid.
  const fxAt = (f, cell, t) => p.frame(f).layers.filter(l => l.cell.id === cell && !l.trail).flatMap(l => l.fx.filter(x => x.type === t));
  const ringsAt = f => load(f)?.params;
  const gridOK = edl.clips.every(c => (c.fx || []).every(x => !['contour', 'pixelTiles'].includes(x.type) || ['travel', 'tick'].every(k => !Array.isArray(x[k]?.keys ?? x[k]) || (x[k].keys ?? x[k]).every(([t, , e], i) => i === 0 || e === 'step'))));
  const onGesture = verts.filter(f => [...fxAt(sf(f), 'stack3.0', 'contour'), ...fxAt(sf(f), 'stack3.1', 'pixelTiles'), ...fxAt(sf(f), 'stack3.2', 'contour')].length);
  const DREAM_PEAK = 233, peakDream = sf(DREAM_PEAK);
  ok(ringsAt(30)?.rings === 1 && ringsAt(30).open > .5 && ringsAt(64)?.open === 0 && ringsAt(2)?.rings === 0 && ringsAt(40).travel > ringsAt(30).travel
    && fxAt(peakDream, 'stack3.0', 'contour')[0]?.twin > 0 && fxAt(peakDream, 'stack3.1', 'pixelTiles').length && fxAt(peakDream, 'stack3.2', 'contour').length && !onGesture.length
    && fxAt(sf(325), 'L1.0', 'contour')[0]?.under === 1 && !fxAt(sf(331), 'L1.0', 'contour').length && fxAt(sf(340), 'L1.0', 'pixelTiles').length
    && fxAt(sf(706), 'stack3.1', 'contour').length && fxAt(sf(706), 'stack3.2', 'contour').length && !fxAt(sf(714), 'stack3.2', 'contour').length && p.frame(sf(500)).board.psych.some(x => x.look === 'contour')
    && edl.clips.flatMap(c => (c.fx || []).filter(x => x.type === 'contour')).every(x => [0, 1, 2].includes(x.tone)) && gridOK,
    `square edges: the loading eye opens (f30), flows in and shuts by f64; rings and tiles while it dreams (song f${DREAM_PEAK}), none on a glide vertex; FULL's tunnel (f397) gone on BLEED. (f403); tiles in the copies (f412); the night's rings to the jam; every step on the grid`);
  const asset = path.join(ROOT, R.audio);
  if (fs.existsSync(asset)) { const b = fs.readFileSync(asset); ok(b.subarray(0, 4).toString() === 'fLaC' && !R.audio.startsWith('public/') && R.seconds === 33.5, `the sound: ${R.audio} (FLAC, ${(b.length / 1e6).toFixed(1)} MB, 33.5 s), outside public/`); }
});

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
