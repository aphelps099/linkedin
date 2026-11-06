// "Delve.", her LinkedIn vocabulary as a film (Aaron: "we just hear the riverbed music, and the corporate lady
// voice saying phrases like DELVE ... into a very psychedelic LinkedIn beat"). The film is drawn: the whole
// 9:16 frame is the Peg Board, 90 x 160 pegs (12 px at 1080 x 1920, edl.boardPitch), and everything on it is
// the board's own light: her words in PEG-9 and PEG-5, their echoes as ghosts, the textures of psych.js, her
// mouth in pegs (pegboard/lips.js) and the stars. No footage, no faces, no Pat.
//
//   const plan = delvePlan();                              // the song's own plan (wander.js, the Delve. chart)
//   const edl = delveBoard(plan, SHOTS, {format:'9:16'});  // this cut
//   compile(edl, {plan, shots:SHOTS}).lint.errors          // []
//
// The song is a river (songbook/delve.js): her ten phrases rise out of it, each said dry first, then handed
// to its echo (delay, reverb, a fifth down, an octave down, the echo to fade) until she is the choir. The
// picture follows the same plan, so sound and picture share one clock:
//   - each word lights on the frame that holds her voice saying it (plan.band words; anchors phrase:P<n>);
//   - each echo shows as a ghost of the word it repeats, on its tap (plan.echoes; anchors echo:P<n>#k):
//     same size and a few pegs over for the delay, the bloom swelling for the reverb, smaller and blue a
//     fifth down, deep an octave down, falling a row a tap as it fades;
//   - her mouth draws itself in bar 22, mouths the choir, puckers and blows the first star onto the exact
//     middle (60.0 s, f1440), then speaks every phrase on her own recordings' pitch and level (lady-pitch.json,
//     lips.js visemes), splits into a ring of small mouths for the canon and closes back into one, smiles on
//     "Read that again." and undraws itself;
//   - the stars are born on the chimes (plan.stars.twinkles), the silent blue ones fill to the density.
// Zones (rows of the 90 x 160 board): the header 0-25 holds stars only; the words sit in 26-72 once the mouth
// exists (44-88 before); the mouth in 78-112; under row 120 nothing brighter than a faint star.
// Pure: the same plan gives the same EDL, in Node and in the browser.
import {createEDL} from '../edl/schema.js';
import {stepAtTime, stepTime, hitFrame, audioLatency} from '../edl/anchors.js';
import {eventVisemes, settle, visemeKeys, code} from '../../pegboard/lips.js';
import {riverTrack, riverAt} from '../../pegboard/psych.js';
import {strikeAt, STRIKE} from '../../pegboard/choreo.js';
import {arrangeWander} from '../../allhands/wander.js';
import {lyricsFromPost, SAMPLE_POST} from '../../allhands/lyrics.js';
import {RENDER_OFFSET} from '../../allhands/engine.js';
import LADY_PITCH from '../../allhands/lady-pitch.json' with {type:'json'};

export const SCENE_LABELS = Object.freeze({delve:'Delve.'});
export const FPS = 24, PITCH = 12, COLS = 90, ROWS = 160;
// The film is the song's 48 bars plus its 0.6 s tail: 772 steps (120.625 s), 2,895 frames, f0 to f2894.
// The last 15 frames are true black: the loop seam back to frame 0's sockets.
export const STEPS = 772, FRAMES = 2895, BLACK_FROM = 2880;
// The engine's render (render-allhands.mjs, the Delve. chart): song time 0 sits RENDER_OFFSET into the file,
// and every sound leaves the master bus 720 samples (16.33 ms) after its plan time (anchors.js).
export const DELVE_SONG = Object.freeze({
  track:'delve', title:'Delve.', treatment:'delve-board',
  audio:'assets/delve/delve-song.flac', sampleRate:44100, offset:RENDER_OFFSET, seconds:FRAMES / FPS,
});
// The song's plan, as the song was rendered: the Delve. chart arranged by the river (no Synergy: his post's
// words are not in this song, so any post gives the same plan).
export function delvePlan() {
  const plan = arrangeWander(lyricsFromPost(SAMPLE_POST), {}, {track:'delve'});
  return Object.assign(plan, {latency:720 / 44100, audio:DELVE_SONG.audio});
}

// Zones in board rows. WORDS_A before the mouth exists (her phrases at the optical centre, room for their
// ghosts to fall), WORDS_B above the mouth; MOUTH_ROW is the mouth line's row; the ring of small mouths turns
// round it.
export const ZONES = Object.freeze({header:[0, 25], wordsA:[44, 88], wordsB:[26, 72], mouth:[78, 112], floor:120});
export const MOUTH_ROW = 95;
const LIPS_CY = (MOUTH_ROW + .5) / ROWS;

const r6 = x => +(+x).toFixed(6);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
function hash(n, salt = 0) {
  let h = Math.imul((n | 0) + 0x9e3779b1, 0x85ebca77) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// ---- the film -----------------------------------------------------------------------------------------
export function delveBoard(plan, shots, {format = '9:16'} = {}) {
  if (format !== '9:16') throw Error('delve-board is a vertical film: its board is 90 x 160 pegs of the 9:16 frame (format 9:16).');
  if (plan.track !== 'delve') throw Error('delve-board cuts the Delve. song (its plan names its phrases, echoes, choir and stars).');
  const L = audioLatency(plan), S = t => r6(stepAtTime(plan, t)), hit = t => hitFrame(t, plan);
  const P = Object.fromEntries(plan.band.map(e => [e.id, e])), M = plan.marks, bar = b => stepTime(plan, b * 16);
  const echoes = id => plan.echoes.filter(e => e.phrase === id);
  // A span in frames as an EDL item's at and len (frame-exact: the anchor's frames offset).
  const atF = F => ({anchor:'step:0', frames:F});
  const lenF = (F0, F1) => r6(stepAtTime(plan, (F1 - F0) / FPS));
  // Keys in frames from a cue's first frame, with 'step' keys a quarter frame early (rounding never pushes one late).
  const keysF = (F0, list) => ({keys:list.map(([f, v, e]) => e === 'step' ? [r6(f - F0 - .25), v, 'step'] : e ? [r6(f - F0), v, e] : [r6(f - F0), v]), unit:'frames'});
  const fr = t => Math.round(t * FPS);

  // ---- the words: her ten phrases ----
  // Each screen comes up two frames before her first word and holds until the next phrase rises (the board
  // is never left without words while a texture runs, so the texture's dim never pumps); its words light as
  // she sings them. Couplets page at their turn (the page shows when its first word is heard), X struck on
  // the beat after it, Y dark until it is sung.
  const board = [];
  const next = [...plan.band.map(e => e.words[0].start), 1e9];
  const screen = (id, opts) => {
    // (A screen runs into the next one, which starts two frames before its own first word: compile ends it there.)
    const e = P[id], i = plan.band.indexOf(e), to = opts.to ?? next[i + 1];
    const words = opts.words ?? [0, e.words.length];
    const cue = {id, at:{anchor:`phrase:${id}`, frames:-2}, len:r6(stepAtTime(plan, to + 2 / FPS) - stepAtTime(plan, e.words[0].start)), text:{ref:`phrase:${id}`, ...(opts.breaks ? {breaks:opts.breaks} : {}), ...(opts.words ? {words} : {})},
      font:opts.font ?? 'peg9', k:opts.k ?? 1, lines:opts.lines ?? 3, reveal:opts.reveal ?? 'pop', release:opts.release ?? 'cut', palette:opts.palette ?? 'white', zone:opts.zone, ...(opts.fx ? {fx:opts.fx} : {}), why:opts.why};
    board.push(cue);
    return cue;
  };
  // The strike: on the first beat after X that leaves it struck a quarter second before Y (choreo strikeAt).
  const strike = (id, xEnd, yFrom, words) => {
    const e = P[id], x = e.words.slice(0, xEnd).map(w => ({start:w.start, end:w.end})), at = strikeAt(plan, x, e.words[yFrom].start);
    return {at:r6(at), words, draw:r6(STRIKE.draw * plan.step), tone:STRIKE.tone};
  };
  // A word's ghosts from its echoes: the delay taps ping-pong (above and below the word, or left and right under
  // it: never over it, so the word she said stays legible), the fifth smaller and blue under it, the octave deep
  // under that, the fade taps one row further each; the reverb swells the bloom instead.
  const ghosts = (id, word, {k = 1, delayK = k, fifth = 7, octave = 12, steps = null, tap = (n, e) => ({below:2, dx:e.pan < 0 ? -10 : 10})} = {}) => {
    const out = [], bloom = [];
    const list = echoes(id), fades = list.filter(e => e.kind === 'fade');
    for (const e of list) {
      // (Ghosts light by choreo's own rule: on the frame that holds the tap's onset, as every peg does.)
      const at = r6(e.at), end = r6(e.end);
      if (e.kind === 'delay') out.push({word, at, end, I:[.6, .4, .25][e.tap - 1] ?? .2, ...tap(e.tap, e), k:delayK});
      else if (e.kind === 'reverb') bloom.push([e.at - .02, 1], [e.at + .16, 1.6], [e.at + 1.25, 1]);
      else if (e.kind === 'fifth' || e.kind === 'octave') {
        const feeds = e.feeds === 'fade' ? fades : [], last = feeds.length ? Math.max(...feeds.map(f => f.end)) : e.end;
        out.push({word, at, end:r6(Math.max(e.end, last)), I:e.kind === 'fifth' ? .45 : .6, below:e.kind === 'fifth' ? fifth : octave, k, tone:e.kind === 'fifth' ? 'blue' : 'deep',
          ...(feeds.length ? {fall:feeds.map(f => [r6(f.at), 1])} : {})});
      } else if (e.kind === 'step' && steps) {
        const n = e.tap - 1, nxt = list.find(x => x.kind === 'step' && x.tap === e.tap + 1);
        out.push({word, at, end:r6(nxt ? nxt.at + .2 : e.end + .9), I:[.55, .45, .36, .3][n] ?? .25, below:steps[n] ?? steps.at(-1), k, tone:'blue',
          ...(e.feeds === 'fade' ? {fall:fades.map(f => [r6(f.at), 1])} : {})});
      }
    }
    return {echo:out, ...(bloom.length ? {bloom:bloom.map(([t, v]) => [r6(t), v])} : {})};
  };
  const A = ZONES.wordsA, B = ZONES.wordsB;
  screen('P1', {k:2, reveal:'typewriter', zone:A, fx:ghosts('P1', 0, {k:1, delayK:2, tap:n => ({dy:n % 2 ? -25 : 25, dx:0})}), why:'DELVE., crisp and dry, then handed to its echo: three taps, the reverb, a fifth down, an octave down, falling to nothing by f240'});
  screen('P2', {reveal:'typewriter', zone:A, breaks:[2, 3], why:'IN TODAY\'S / FAST-PACED / WORLD…, typed on her syllables, dry'});
  // (IT'S NOT ABOUT is 85 pegs in PEG-9: it breaks after NOT to stay inside the 72 columns of the safe area.)
  screen('P3', {reveal:'pop', lines:3, zone:A, breaks:[2, 3, 5, 7], fx:{strike:strike('P3', 5, 5, [3, 4]), ...ghosts('P3', 8, {fifth:4})}, why:'IT\'S NOT / ABOUT / THE TOOLS. (struck), the page turns, IT\'S ABOUT / THE MINDSET.; MINDSET. echoes'});
  screen('P4', {reveal:'pop', lines:2, zone:A, breaks:[2, 4, 6], fx:{strike:strike('P4', 4, 4, [3]), ...ghosts('P4', 6, {k:2, delayK:2, octave:2, tap:(n, e) => ({below:2, dx:e.pan < 0 ? -12 : 12})})}, why:'her own X and Y: IT\'S NOT / ABOUT X. (X. struck), IT\'S ABOUT / Y.; only Y. echoes, at twice its size'});
  screen('P5', {reveal:'pop', lines:3, zone:A, breaks:[2, 4], to:M.mouth - 1 / FPS, fx:{strike:strike('P5', 4, 4, [2, 3]), harmony:[{dx:1, dy:1, I:.42, tone:'blue', from:r6(P.P5.words[0].start)}], ...ghosts('P5', 5, {steps:[2, 4, 7, 10]})},
    why:'NOT JUST / A JOB. (struck) / A CALLING., doubled (a blue copy a row under); CALLING. walks down B A G E in ghosts; cleared on bar 22 for the mouth'});
  // (Her three voices as a misregistered print: the step up a blue copy a peg up and left, the fourth down a deep
  // one a peg down and right; the words stay whole and legible between them.)
  screen('P6', {reveal:'scanline', lines:2, zone:B, breaks:[2], fx:{harmony:[{dx:-1, dy:-1, I:.36, tone:'blue', from:r6(P.P6.words[0].start)}, {dx:1, dy:1, I:.5, tone:'deep', from:r6(P.P6.words[0].start)}], wobble:{amount:.3, rate:.8, from:r6(P.P6.words[1].start)}, ...ghosts('P6', 2)},
    why:'A RICH / TAPESTRY, harmonised in three: a blue copy a peg up and left, a deep one a peg down and right, the letters wobbling on the tape'});
  screen('P7', {reveal:'typewriter', lines:2, zone:B, breaks:[2], fx:{sink:{word:2, rate:.8, max:9, tone:'deep'}, grain:{word:2, amount:.3, rate:4, from:r6(P.P7.words[2].start)}},
    why:'LET THAT crisp; SINK IN. deep and grained, sinking a row a beat as the tape slows to half speed'});
  // P8: the bio in small print (PEG-5), doubled with an octave-down shadow, the tape's wow; then the cut-off
  // "of…" frozen big (PEG-9 at twice the size) while its grain loops on the eighths, a ghost dripping down on
  // each side of it per eighth, until the freeze ends (36:0, 90.0 s).
  const freeze = echoes('P8').filter(e => e.kind === 'freeze'), ofAt = freeze[0].at;
  screen('P8', {font:'peg5', reveal:'scanline', lines:3, zone:B, breaks:[1, 3, 6, 7], to:ofAt - 1 / FPS, fx:{harmony:[{dx:1, dy:1, I:.35, tone:'blue', from:r6(P.P8.words[0].start)}], wobble:{amount:.35, rate:.6, from:r6(P.P8.words[0].start)}},
    why:'the bio in small print: PASSIONATE / ABOUT DRIVING, then IMPACT AT THE / INTERSECTION / OF…, doubled, wobbling; cut off where her recording is'});
  const ofEnd = bar(36);
  board.push({id:'P8.of', at:{anchor:`echo:P8`, frames:0}, len:r6(stepAtTime(plan, ofEnd) - stepAtTime(plan, ofAt)), text:{ref:'phrase:P8', words:[7, 8]}, font:'peg9', k:2, lines:1, reveal:'steady', palette:'white', zone:B,
    fx:{echo:freeze.map((e, i) => ({word:0, at:r6(e.at), end:r6(e.at + .9), I:.42 - .012 * i, dx:i % 2 ? 31 : -31, dy:-6, k:1, tone:i % 4 === 3 ? 'blue' : 'white',
      fall:[1, 2, 3, 4, 5, 6].map(j => [r6(e.at + j * .125), 2])})), dim:[[r6(ofAt), 1], [r6(ofEnd - .6), .85], [r6(ofEnd), .7]]},
    why:'OF… frozen on the eighths until 36:0: her cut-off bio becomes the joke; a ghost drips down on each side per eighth'});
  // P9: MOMENTUM / COMPOUNDS. pops in and dims with her clarity as the canon takes it (the mouths carry it).
  screen('P9', {reveal:'pop', lines:2, zone:B, breaks:[1], to:r6(bar(43.25)), release:'dissolve', fx:{dim:[[r6(P.P9.words[0].start), 1], [98, .85], [101.875, .5], [105, .25], [108.125, .06]]},
    why:'MOMENTUM / COMPOUNDS. pops in, then dims with her clarity as the canon takes the phrase'});
  screen('P10', {reveal:'typewriter', lines:2, zone:B, breaks:[2], to:r6(bar(47.75)), release:'dissolve', why:'READ THAT / AGAIN., crisp, dry and alone: the film loops back to DELVE.'});

  // ---- the textures ----
  // Their light follows the river's layers (psych.js riverTrack: the stream thickens and thins), a texture's
  // own level on top; every crossfade is at least a bar; the type and the figures always win.
  const river = riverTrack(plan);
  const levelKeys = (F0, F1, k = 1, floor = .18) => {
    const ks = [];
    for (let f = F0; f <= F1; f += 6) ks.push([f, r6(Math.min(.92, floor + k * .7 * riverAt(river, f / FPS).spec.params.level))]);
    return keysF(F0, ks);
  };
  // (Every texture keeps the platform's bands calm: faint above row 26, the header, and under row 120, the captions.)
  const psych = (id, t0, t1, look, params, {fade = 8, seed} = {}) => {
    const F0 = fr(t0), F1 = fr(t1);
    const cue = {type:'psych', id, at:atF(F0), len:lenF(F0, F1), look, fade, ...(seed !== undefined ? {seed} : {}), params:{...(typeof params === 'function' ? params(F0, F1) : params), ceiling:r6((ZONES.header[1] + 1) / ROWS), floor:r6(ZONES.floor / ROWS)}};
    board.push(cue);
    return cue;
  };
  // A value stepped on the song's grid (16ths `every` apart), as frame keys: the rings move on the steps.
  const onGrid = (F0, t0, t1, every, fn) => {
    const ks = [];
    for (let s = Math.ceil(stepAtTime(plan, t0) / every) * every; stepTime(plan, s) < t1; s += every) { const t = stepTime(plan, s); ks.push([hit(t), r6(fn(t, s)), 'step']); }
    const first = r6(fn(t0, stepAtTime(plan, t0)));
    return keysF(F0, [[F0, first], ...ks.filter(k => k[0] > F0)]);
  };
  const delays = echoes('P1').filter(e => e.kind === 'delay').map(e => e.at);
  // Bars 0-19: one deep ring opens round DELVE. (f0-60), a band leaves the word on every tap; then the
  // stream's stepped rings, blue with every fourth white, squaring up (corners and aspect) over bars 14-16.
  psych('rings', 0, bar(19.5), 'contour', (F0, F1) => ({level:levelKeys(F0, F1, .8, .26), tone:keysF(F0, [[F0, 2], [hit(bar(4)), 1, 'step']]), block:2, band:3, duty:1 / 3, every:4, flow:0, breath:.3,
    cx:.5, cy:(66.5 / ROWS), pupil:keysF(F0, [[F0, 11], [hit(bar(4)), 7, 'inOutSine']]),
    aspect:keysF(F0, [[F0, 1.8], [hit(bar(14)), 1.8], [hit(bar(16)), 1, 'inOutSine']]), corner:keysF(F0, [[F0, .7], [hit(bar(14)), .7], [hit(bar(16)), .5, 'inOutSine']]),
    open:keysF(F0, [[F0, 0], [hit(.6), .08, 'outQuad'], [hit(bar(1)), .1], [hit(bar(4)), 1, 'inOutSine']]),
    travel:onGrid(F0, 0, bar(19.5), 2, (t, s) => -(delays.filter(d => d <= t + 1e-6).length) - (t >= bar(4) ? (s - 64) / 16 : 0))}), {fade:2, seed:3});
  // Bars 19-22: moiré, two centres for her two voices (P5 is doubled).
  psych('moire', bar(19), bar(22), 'moire', (F0, F1) => ({level:levelKeys(F0, F1, .75, .22), spacing:5, spread:.42, cy:66.5 / ROWS, speed:.5, breath:.3}), {fade:8, seed:5});
  // Bars 22-24: bare sockets while the mouth draws itself. Bars 24-29: ripples from her lips on the beat.
  psych('ripples', bar(24), bar(29.5), 'ripples', (F0, F1) => ({level:levelKeys(F0, F1, .7, .18), spacing:6, px:45, py:MOUTH_ROW, speed:1, breath:.35}), {fade:12, seed:7});
  // Bars 28-33: plasma at half speed (the river slows under "sink in"), crossfading in over bars 28-30.
  psych('plasma', bar(28), bar(34), 'plasma', (F0, F1) => ({level:levelKeys(F0, F1, .62, .16), speed:.5, breath:.3, scale:1.2, cy:.45}), {fade:32, seed:11});
  // Bars 32-42: the 8-fold mandala; from bar 38 its tiles move (once a beat at most: tick on the quarter notes)
  // until the delta, bar 42.
  psych('mandala', bar(32), bar(43.5), 'mandala', (F0, F1) => ({level:levelKeys(F0, F1, .66, .16), fold:8, petals:2, speed:.5, breath:.3, cy:.45,
    tiles:keysF(F0, [[F0, 0], [hit(bar(38)), 0], [hit(bar(38)) + 1, .22, 'step'], [hit(bar(40)), .3], [hit(bar(42)), 0, 'step']]), tile:10,
    tick:onGrid(F0, bar(32), bar(43.5), 4, (t, s) => s / 4)}), {fade:32, seed:13});
  // Bars 42-46: the mandala gives way to the opening's rings (a callback), closing back to sockets.
  psych('rings.back', bar(42), bar(46), 'contour', (F0, F1) => ({level:levelKeys(F0, F1, .7, .2), tone:2, block:2, band:3, duty:1 / 3, every:4, flow:0, breath:.3, cx:.5, cy:.45, pupil:6, aspect:1.8, corner:.7,
    open:keysF(F0, [[F0, 1], [hit(bar(44)), 1], [hit(bar(46)) - 2, 0, 'inOutSine']]), travel:onGrid(F0, bar(42), bar(46), 2, (t, s) => s / 16)}), {fade:24, seed:17});

  // ---- her mouth ----
  const lips = mouthTrack(plan, {latency:L, P, M, bar});
  const F0 = lips.from, F1 = lips.to;
  board.push({type:'psych', id:'lips', at:atF(F0), len:lenF(F0, F1), look:'lips', fade:2, params:{
    level:1, cx:.5, cy:r6(LIPS_CY), mouth:keysF(F0, lips.hero.map(([f, c]) => [f, c, 'step'])),
    draw:keysF(F0, [[F0, 0], [fr(M.mouth + 1.25), 1, 'inOutSine'], [fr(M.undraw + 1.1), 1], [fr(120) - 2, 0, 'inOutSine']]),
    fill:keysF(F0, [[F0, 0], [fr(M.mouth + 1.25), 0], [fr(M.mouth + 2.2), 1, 'inOutSine'], [fr(M.undraw + .2), 1], [fr(M.undraw + 1.1), 0, 'inOutSine']]),
    gloss:keysF(F0, [[F0, 0], [fr(M.mouth + 2.2), 0], [fr(M.mouth + 2.45), 1], [fr(M.undraw), 1], [fr(M.undraw + .2), 0]]),
    shadow:keysF(F0, [[F0, 0], [hit(P.P8.words[0].start), 1, 'step'], [hit(bar(36)), 0, 'step']]),
    hero:keysF(F0, lips.heroLevel), ring:keysF(F0, lips.ring), turn:keysF(F0, lips.turn), rx:33, ry:14,
    ...Object.fromEntries(lips.small.map((ks, k) => [`m${k}`, keysF(F0, ks.map(([f, c]) => [f, c, 'step']))]))},
    why:'her mouth: drawn in bar 22, the kiss on 23:12, every phrase on her own pitch and level, a ring of small mouths for the canon, a smile, undrawn'});

  // ---- the stars ----
  const stars = starEvents(plan, {latency:L, kissAt:M.kiss, lips:{x:.5, y:LIPS_CY}});
  board.push({type:'psych', id:'stars', at:atF(fr(M.kiss) - 1), len:lenF(fr(M.kiss) - 1, BLACK_FROM), look:'stars', fade:2, params:{level:1, spin:1, twinkle:.14}, events:stars,
    why:'the stars: the kiss blows the first onto the middle, each chime births one, the silent blue ones fill the sky to the plan\'s density'});

  // ---- the frame ----
  // Black under the full-frame board (the board takes the frame: no tiles, no chrome); the last 15 frames true
  // black (a black tile under a black L1 tile, so the board goes dark with the call), the loop seam.
  const clips = [
    {id:'night', at:0, len:r6(stepAtTime(plan, BLACK_FROM / FPS)), cell:'full', asset:'gen:color:#000000', scene:'delve', chrome:{name:''}, why:'the Peg Board takes the whole frame'},
    {id:'tail', at:{anchor:'step:0', frames:BLACK_FROM}, len:lenF(BLACK_FROM, FRAMES), cell:'full', asset:'gen:color:#000000', scene:'delve', chrome:{name:''}, why:'true black: the loop seam back to DELVE.'},
    {id:'tail.l1', at:{anchor:'step:0', frames:BLACK_FROM}, len:lenF(BLACK_FROM, FRAMES), cell:'L1.0', asset:'gen:color:#000000', scene:'delve', chrome:{name:''}, why:'keeps the board out of the black'},
  ];
  return createEDL({form:plan.form, track:plan.track, format, clips, board, steps:STEPS, boardPitch:PITCH});
}

// ---- the mouth over the film ----------------------------------------------------------------------------
// Frame by frame, the hero mouth's shape (lips.js codes) and the ring's small mouths, from her events:
//   bar 22 (55.0 s) drawn, at rest; bar 23 silently mouthing the choir's chant (open 1 at most); 23:12 the
//   pucker (the kiss), 23:15 the blow (a small O), then P6, P7 (its tape slide in the warp), P8, the frozen
//   "of…" held round (85-90 s), the choir mouthed (90-95), P9; from the canon's second voice (39:8) the hero
//   gives way to a ring of small mouths, one per voice as it enters, each on its own repeats; the ring closes
//   back by 44:0 (110 s); the choir mouthed, P10, a smile, undrawn from 47:0 (117.5).
const CHOIR_SHAPE = {o:'oh', e:'eh', u:'uh', ou:'oo', ah:'ah', a:'ah', i:'ee'};
export function mouthTrack(plan, {latency, P, M, bar}) {
  const from = Math.round(M.mouth * FPS), to = BLACK_FROM;
  const hero = new Map();                                    // frame -> {shape, open}
  const set = (f, shape, open) => { if (f >= from && f < to) hero.set(f, {shape, open}); };
  for (let f = from; f < to; f++) set(f, 'rest', 0);
  const span = (t0, t1, fn) => { for (let f = Math.max(from, Math.floor((t0 + latency) * FPS)); f < Math.min(to, Math.ceil((t1 + latency) * FPS)); f++) fn(f); };
  // The choir, mouthed: each syllable's vowel, open 1 (2 on a long held vowel), closing between syllables.
  const mouthChoir = (t0, t1, max = 1) => {
    for (const c of plan.choir.filter(x => x.end > t0 && x.t < t1)) {
      const a = Math.max(c.t, t0), b = Math.min(c.end, t1), shape = CHOIR_SHAPE[c.vowel] ?? 'uh', open = max > 1 && b - a > 1 ? 2 : 1;
      span(a + .05, b - .08, f => set(f, shape, open));
    }
  };
  const speak = ev => { for (const v of eventVisemes(ev, LADY_PITCH, {fps:FPS, latency})) set(v.f, v.shape, v.open); };
  mouthChoir(bar(23), M.kiss);
  span(M.kiss, M.kiss + 3 * plan.step, f => set(f, 'kiss', 0));
  span(M.kiss + 3 * plan.step, P.P6.words[0].start - .02, f => set(f, 'oo', 1));
  for (const id of ['P6', 'P7', 'P8']) speak(P[id]);
  const freeze = plan.echoes.filter(e => e.phrase === 'P8' && e.kind === 'freeze');
  span(freeze[0].at, bar(36), f => set(f, 'oh', 1));
  mouthChoir(bar(36), P.P9.words[0].start - .1, 2);
  speak(P.P9);
  // The canon: voice 0 is her phrase itself and its repeats; the ring opens on voice 1's entry.
  const canon = plan.echoes.filter(e => e.phrase === 'P9' && e.kind === 'canon');
  const words = P.P9.words;
  const voiceEv = e => ({file:P.P9.file, from:e.src[0], to:e.src[1], start:e.at, end:e.end, rate:e.rate ?? 1, words});
  const open1 = Math.min(...canon.filter(e => e.voice === 1).map(e => e.at)), lastEnd = Math.max(...canon.map(e => e.end));
  const ringOn = Math.floor((open1 + latency) * FPS), ringFull = ringOn + 12, closeFrom = Math.ceil((lastEnd + latency) * FPS), closed = Math.round(bar(44) * FPS);
  const small = Array.from({length:8}, () => new Map());
  for (let v = 0; v < 8; v++) {
    const list = canon.filter(e => e.voice === v).sort((a, b) => a.at - b.at);
    // Voice 0's first entry is the phrase itself (P9, on the hero); its repeats go to its small mouth.
    const all = v === 0 ? [{at:P.P9.start, end:P.P9.end, src:[P.P9.from, P.P9.to], rate:P.P9.rate}, ...list] : list;
    if (!all.length) continue;
    const first = Math.floor((all[0].at + latency) * FPS), last = Math.ceil((all.at(-1).end + latency) * FPS) + 6;
    for (let f = Math.max(first, ringOn); f < Math.min(last, closed); f++) small[v].set(f, {shape:'rest', open:0});
    for (const e of all) for (const x of eventVisemes(voiceEv(e), LADY_PITCH, {fps:FPS, latency})) if (small[v].has(x.f)) small[v].set(x.f, {shape:x.shape, open:x.open});
  }
  // P10, then a smile (it closes into one), held until the mouth is undrawn.
  mouthChoir(bar(44), P.P10.words[0].start - .3);
  speak(P.P10);
  span(P.P10.end + .12, 120, f => set(f, 'smile', 0));
  const frames = [...hero.keys()].sort((a, b) => a - b).map(f => ({f, ...hero.get(f)}));
  const toKeys = map => { const fs = [...map.keys()].sort((a, b) => a - b); if (!fs.length) return [[from, -1]]; const ks = visemeKeys(settle(fs.map(f => ({f, ...map.get(f)})))); return [[from, -1], ...ks.filter(([f]) => f > from), [fs.at(-1) + 1, -1]].filter((k, i, a) => !i || k[0] > a[i - 1][0]); };
  // The ring: out over 12 frames from voice 1's entry, turning a full turn every four bars, closing back
  // into the hero by 44:0; the hero fades out as it opens and back in as it closes.
  const ring = [[from, 0], [ringOn, 0], [ringFull, 1, 'inOutSine'], [closeFrom, 1], [closed, 0, 'inOutSine']];
  const heroLevel = [[from, 1], [ringOn, 1], [ringOn + 8, 0, 'inOutSine'], [closeFrom, 0], [closed, 1, 'inOutSine']];
  const turn = [[from, 0], [ringOn, 0], [closed, r6(360 * (closed - ringOn) / FPS / (4 * 16 * plan.step))]];
  return {from, to, hero:visemeKeys(settle(frames)), small:small.map(toKeys), ring, heroLevel, turn, ringOn, closed};
}

// ---- the stars -----------------------------------------------------------------------------------------
// [[t0, t1, x, y, len, tone, hero, x0?, y0?, travel?], ...] in the board's paint time (each born on the frame
// that holds its chime) and 0..1 of the board. Near stars on the chimes (plan.stars.twinkles): white, one in
// five signal, hero ones signal and big; far stars (silent, blue, small) fill the sky to plan.stars.density.
// Places: the header (rows 3-23), the margins beside the words (rows 26-76), the strip under the mouth
// (113-119); faint ones only below row 120. Never two within 5 pegs of each other at once.
export function starEvents(plan, {latency, kissAt, lips}) {
  const S = plan.stars, out = [], alive = [], end = BLACK_FROM / FPS - .02;
  const born = t => Math.floor((t + latency) * FPS + 1e-9) / FPS + 1e-4;
  const density = t => { const d = S.density; if (t <= d[0][0]) return d[0][1]; for (let i = 1; i < d.length; i++) if (t <= d[i][0]) return d[i - 1][1] + (d[i][1] - d[i - 1][1]) * (t - d[i - 1][0]) / (d[i][0] - d[i - 1][0]); return d.at(-1)[1]; };
  const free = (x, y, t) => alive.every(s => s.t1 <= t || Math.hypot((s.x - x) * COLS, (s.y - y) * ROWS) >= 5.5);
  const region = (h, side, faint) => {
    if (faint) return {x:(3 + h[0] * 84) / COLS, y:(122 + h[1] * 30) / ROWS};
    if (side === 0) return {x:(3 + h[0] * 84) / COLS, y:(3 + h[1] * 20) / ROWS};
    if (side === 3) return {x:(4 + h[0] * 82) / COLS, y:(113.5 + h[1] * 5) / ROWS};
    return {x:(side === 1 ? 2.5 + h[0] * 6 : 81.5 + h[0] * 6) / COLS, y:(27 + h[1] * 49) / ROWS};
  };
  // (The sky thins with the delta: far stars are gone by 47:4 (118.75 s, the density's last one), near ones by
  // 47:7; only the last hero star, the chime on 47:5, lives on to shrink out by f2880.)
  const lastHero = Math.max(...S.twinkles.filter(w => w.hero).map(w => w.t));
  const add = (t0, life, place, len, tone, hero, extra = []) => {
    const cap = hero > 0 && t0 >= lastHero - .1 ? end : tone === 0 ? 118.75 : 119.25;
    const t1 = Math.min(end, t0 + life, Math.max(t0 + 1.6, cap)), s = {t0, t1, ...place};
    alive.push(s);
    out.push([+t0.toFixed(4), +t1.toFixed(4), +place.x.toFixed(4), +place.y.toFixed(4), len, tone, hero, ...extra]);
  };
  // The kiss: star 1 leaves her lips on the pucker and lands on the exact middle, the first chime.
  const first = S.twinkles[0];
  add(born(kissAt), 9.5, {x:.5, y:12.5 / ROWS}, 5, 2, 1, [lips.x, lips.y, +(first.t - kissAt).toFixed(4)]);
  // (A star's arms stay inside its band: a big one never reaches under row 120 or over the board's top.)
  const fits = (p, len) => p.y * ROWS - len >= .5 && p.y * ROWS + len <= ZONES.floor - .5;
  S.twinkles.slice(1).forEach((w, i) => {
    const n = i + 1, t0 = born(w.t), h = [hash(n, 3), hash(n, 5)], len = w.hero ? 5 : 2 + Math.round(hash(n, 9));
    let place = null;
    for (let k = 0; k < 8 && !place; k++) {
      const hh = [hash(n, 3 + 10 * k), hash(n, 5 + 10 * k)], side = Math.abs(w.pan) > .5 && k < 4 ? (w.pan < 0 ? 1 : 2) : k > 5 && !w.hero ? 3 : 0;
      const p = side === 0 ? {x:clamp(.5 + w.pan * .44 + (hh[0] - .5) * .18, .04, .96), y:(3 + clamp((93 - w.midi) / 16 + (hh[1] - .5) * .25) * 20) / ROWS} : region(hh, side);
      if (free(p.x, p.y, t0) && fits(p, len)) place = p;
    }
    place ??= {...region(h, 0), y:(len + 2 + h[1] * 10) / ROWS};
    add(t0, w.hero ? 6 : 3 + 3 * hash(n, 7), place, len, w.hero || n % 5 === 0 ? 2 : 1, w.hero ? 1 : 0);
  });
  // The far stars: whenever fewer than the density are alive, one more, silent and blue (a step at a time).
  let m = 0;
  for (let t = 60.5; t < end - 3; t += .25) {
    const live = alive.filter(s => s.t0 <= t && s.t1 > t).length;
    if (live >= Math.round(density(t))) continue;
    m++;
    const faint = hash(m, 13) < .18, side = faint ? 0 : [0, 0, 1, 2, 3][Math.floor(hash(m, 15) * 5)];
    let place = null;
    const len = faint ? 1 : 1 + Math.round(hash(m, 23));
    for (let k = 0; k < 8 && !place; k++) { const p = region([hash(m, 17 + 10 * k), hash(m, 19 + 10 * k)], side, faint); if (free(p.x, p.y, t) && (faint || fits(p, len))) place = p; }
    if (!place) continue;
    add(born(t), 3 + 3 * hash(m, 21), place, len, 0, faint ? -1 : 0);
  }
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
