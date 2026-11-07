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
//   - it starts with her mouth: an outline of pop-art lips draws itself in the first half second and says
//     DELVE. on f12; the outline speaks every crisp phrase (P1-P5) and silently mouths the choir between them;
//   - each word lights on the frame that holds her voice saying it (plan.band words; anchors phrase:P<n>), and
//     once her echo is gone the words weave out to a dim ghost of themselves until the next phrase rises;
//   - each echo shows as a ghost of the word it repeats, on its tap (plan.echoes; anchors echo:P<n>#k): the
//     delay ping-pongs left and right, the reverb swells the pegs, the pitch drops deeper and as big (a fifth
//     down a blue copy, an octave down a deep one sinking a row a beat), the fade dissolves it to sockets;
//   - in the middle the voice gets its body: in bar 22 a white-hot head runs round the outline, the fill
//     scans in and the gloss pops; it mouths the choir, puckers on 23:12 and blows the first star, which lands
//     square on the exact middle (60.0 s, f1440); then it speaks every phrase on her own recordings' pitch and
//     level (lady-pitch.json, lips.js visemes), and for the canon its voice splits into a ring of small mouths
//     round its own outline; it closes back into one, smiles on "Read that again." and undraws itself;
//   - her choir is the stack under her mouth: one copy 2 rows down per voice past the first (1 to 4 voices);
//   - the stars are born on the chimes (plan.stars.twinkles), the silent blue ones fill the sky to the density.
// The picture follows the river's arc (the plan's bars[].energy, its slow span and its fade): the textures are
// brightest at the tops of the two swells, dimmest in the Pool and on the slowed "sink in", and every look moves
// on the song's eighths (stepped, square-edged: Aaron's Printer Song note), at half time inside the slow span.
// Zones (rows of the 90 x 160 board): the header 0-25 holds stars only; her words sit in 26-72 (their ghosts may
// fall to 83, clear of the lips' outline); the mouth in 76-119 with its stack; under row 120 nothing brighter
// than a faint star. Every radial texture is centred on her lips (they cover its centre: no eye ever forms).
// Pure: the same plan gives the same EDL, in Node and in the browser.
import {createEDL} from '../edl/schema.js';
import {stepAtTime, stepTime, hitFrame, audioLatency} from '../edl/anchors.js';
import {eventVisemes, settle, visemeKeys, code} from '../../pegboard/lips.js';
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
// The engine's render (render-allhands.mjs, the Delve. chart), mastered for delivery (scripts/master-delve.py: a
// spot gain on 17 transients, 0.27 s in all, so AAC and MP3 stay under -1 dBTP): song time 0 sits RENDER_OFFSET
// into the file, and every sound leaves the master bus 720 samples (16.33 ms) after its plan time (anchors.js).
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

// Zones in board rows: the words (P1's DELVE. in the top of them, room for its chain to fall), the mouth (its
// line on MOUTH_ROW, its centre on LIPS_COL, the middle of the 9:16 safe columns 6-77, so her words and her lips
// share one axis).
export const ZONES = Object.freeze({header:[0, 25], words:[26, 72], p1:[28, 48], mouth:[76, 119], floor:120});
export const MOUTH_ROW = 95, LIPS_COL = 42;
export const LIPS_CX = (LIPS_COL + .5) / COLS, LIPS_CY = (MOUTH_ROW + .5) / ROWS;
// The ring of small mouths for the canon, round the hero at its middle size: inside the safe columns (a small
// mouth is 19 pegs wide, the middle hero 31), clear of the hero and of row 120.
export const RING = Object.freeze({rx:25, ry:18});

const r6 = x => +(+x).toFixed(6);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
function hash(n, salt = 0) {
  let h = Math.imul((n | 0) + 0x9e3779b1, 0x85ebca77) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// ---- the arc --------------------------------------------------------------------------------------------
// The river's intensity at song time t, 0..1, from the plan alone: its bars' energy (0.6 in the Stream, rising to
// .78 for Swell 1, .54 in the Pool, .84 for the canon, .28 at the end), topping out at .8 until the canon, where it
// climbs with the canon's voices (one eighth of the last fifth per voice: the climax is the canon, all eight voices
// at 1), held near the top until its last voice (109.4 s: a tenth lower by then, as the delta begins at 105 s) and
// then let go with the fade; halved on the slow line's own
// envelope (level .5, its 1.2 s fades). The textures' light follows it, so the picture swells and breathes with
// the song.
export function arcAt(plan, t) {
  const bar = 16 * plan.step, E = plan.bars.map(b => b.energy), b = t / bar - .5, i = clamp(Math.floor(b), 0, E.length - 1), u = clamp(b - i);
  const e = E[i] + (E[Math.min(E.length - 1, i + 1)] - E[i]) * u;
  let a = .8 * clamp((e - .52) / (.84 - .52));
  const canon = plan.marks.canon, voices = plan.echoes.filter(x => x.kind === 'canon'), lastVoice = Math.max(...voices.map(x => x.end));
  const entered = new Set(voices.filter(x => x.at <= t).map(x => x.voice)).size;
  if (t >= canon && t < lastVoice) a = Math.max(a, .8 + .2 * smooth(0, 1, Math.min(8, entered + (t >= canon ? 1 : 0)) / 8)) * (1 - .1 * smooth(plan.marks.delta, lastVoice, t));
  if (t >= lastVoice) a = Math.max(a * (1 - smooth(lastVoice, lastVoice + 7, t)), 1 - smooth(lastVoice, lastVoice + 7, t));
  for (const s of plan.slow || []) {
    const f = s.fade ?? 1.2, lv = s.level ?? .5, inS = Math.min(smooth(s.from, s.from + f, t), 1 - smooth(s.to - f, s.to, t));
    a *= 1 - (1 - lv) * inS;
  }
  return a;
}
// ---- the film -----------------------------------------------------------------------------------------
export function delveBoard(plan, shots, {format = '9:16'} = {}) {
  if (format !== '9:16') throw Error('delve-board is a vertical film: its board is 90 x 160 pegs of the 9:16 frame (format 9:16).');
  if (plan.track !== 'delve') throw Error('delve-board cuts the Delve. song (its plan names its phrases, echoes, choir and stars).');
  const L = audioLatency(plan), hit = t => hitFrame(t, plan);
  const P = Object.fromEntries(plan.band.map(e => [e.id, e])), M = plan.marks, bar = b => stepTime(plan, b * 16), BAR = 16 * plan.step, BEAT = 4 * plan.step;
  const echoes = id => plan.echoes.filter(e => e.phrase === id);
  // A span in frames as an EDL item's at and len (frame-exact: the anchor's frames offset).
  const atF = F => ({anchor:'step:0', frames:F});
  const lenF = (F0, F1) => r6(stepAtTime(plan, (F1 - F0) / FPS));
  // Keys in frames from a cue's first frame, with 'step' keys a quarter frame early (rounding never pushes one late).
  const keysF = (F0, list) => ({keys:list.map(([f, v, e]) => e === 'step' ? [r6(f - F0 - .25), v, 'step'] : e ? [r6(f - F0), v, e] : [r6(f - F0), v]), unit:'frames'});
  const fr = t => Math.round(t * FPS);

  // ---- the words: her ten phrases ----
  // Each screen comes up two frames before her first word and holds until the next phrase rises; its words light
  // as she sings them. Couplets page at their turn (the page shows when its first word is heard), X struck on the
  // beat after it, Y dark until it is sung. Once her echo of it is gone the phrase weaves out: over two bars it
  // eases to .3, a dim ghost of itself, while the river comes up round it (the next phrase replaces it).
  const board = [];
  const next = [...plan.band.map(e => e.words[0].start), 1e9];
  const weave = (id, extra = 0) => { const e = P[id], t0 = Math.max(e.end, ...echoes(id).map(x => x.end)) + extra; return [[r6(t0), 1], [r6(t0 + 2 * BAR), .3]]; };
  const screen = (id, opts) => {
    // (A screen runs into the next one, which starts two frames before its own first word: compile ends it there.)
    const e = P[id], i = plan.band.indexOf(e), to = opts.to ?? next[i + 1];
    const words = opts.words ?? [0, e.words.length];
    const cue = {id, at:{anchor:`phrase:${id}`, frames:-2}, len:r6(stepAtTime(plan, to + 2 / FPS) - stepAtTime(plan, e.words[0].start)), text:{ref:`phrase:${id}`, ...(opts.breaks ? {breaks:opts.breaks} : {}), ...(opts.words ? {words} : {})},
      font:opts.font ?? 'peg9', k:opts.k ?? 1, lines:opts.lines ?? 3, reveal:opts.reveal ?? 'pop', release:opts.release ?? 'cut', palette:opts.palette ?? 'white', zone:opts.zone ?? ZONES.words, ...(opts.fx ? {fx:opts.fx} : {}), why:opts.why};
    board.push(cue);
    return cue;
  };
  // The strike: on the first beat after X that leaves it struck a quarter second before Y (choreo strikeAt).
  const strike = (id, xEnd, yFrom, words) => {
    const e = P[id], x = e.words.slice(0, xEnd).map(w => ({start:w.start, end:w.end})), at = strikeAt(plan, x, e.words[yFrom].start);
    return {at:r6(at), words, draw:r6(STRIKE.draw * plan.step), tone:STRIKE.tone};
  };
  // Sinking a row a beat from t0 to t1 (a ghost's fall keys), and the grain that dissolves it to sockets, a share
  // more on each fade tap (the same pegs go each frame, so it thins, never blinks).
  const sinkKeys = (t0, t1) => { const out = []; for (let t = t0 + BEAT; t < t1 - 1e-6; t += BEAT) out.push([r6(t), 1]); return out; };
  const grainKeys = (taps, end) => { const out = [[r6(taps[0].at - .02), 0]]; taps.forEach((f, k) => out.push([r6(f.at - .001), r6(k / (taps.length + 1))], [r6(f.at), r6((k + 1) / (taps.length + 1))])); out.push([r6(end), 1]); return out; };
  // A word's ghosts from its echoes: the delay taps ping-pong (left and right under the word, or above and below:
  // never over it, so the word she said stays legible), the fifth and the octave as big as the word and deeper
  // (blue, then deep, sinking a row a beat), the fade taps dissolving them; the reverb swells the word's pegs.
  const ghosts = (id, word, {k = 1, delayK = k, fifth = 7, octave = 12, steps = null, tap = (n, e) => ({below:2, dx:e.pan < 0 ? -10 : 10})} = {}) => {
    const out = [];
    const list = echoes(id), fades = list.filter(e => e.kind === 'fade');
    let swell = null, bloom = null;
    for (const e of list) {
      // (Ghosts light by choreo's own rule: on the frame that holds the tap's onset, as every peg does.)
      const at = r6(e.at), end = r6(e.end);
      if (e.kind === 'delay') out.push({word, at, end, I:[.6, .4, .25][e.tap - 1] ?? .2, ...tap(e.tap, e), k:delayK});
      else if (e.kind === 'reverb') {
        // The throw: the word's pegs swell to 1.25 and settle in .4 s (size, not light), the bloom opens.
        swell = [[r6(e.at - .02), 1], [r6(e.at + .1), 1.25], [r6(e.at + .4), 1]];
        bloom = [[r6(e.at - .02), 1], [r6(e.at + .16), 1.6], [r6(e.at + 1.25), 1]];
      } else if (e.kind === 'fifth' || e.kind === 'octave') {
        const feeds = e.feeds === 'fade' ? fades : [], last = feeds.length ? Math.max(...feeds.map(f => f.end)) : e.end;
        out.push({word, at, end:r6(Math.max(e.end, last)), I:e.kind === 'fifth' ? .5 : .62, below:e.kind === 'fifth' ? fifth : octave, k, tone:e.kind === 'fifth' ? 'blue' : 'deep',
          ...(feeds.length ? {fall:sinkKeys(e.at, last), grain:grainKeys(feeds, last)} : {})});
      } else if (e.kind === 'step' && steps) {
        const n = e.tap - 1, nxt = list.find(x => x.kind === 'step' && x.tap === e.tap + 1);
        out.push({word, at, end:r6(nxt ? nxt.at + .2 : e.end + .9), I:[.55, .45, .36, .3][n] ?? .25, below:steps[n] ?? steps.at(-1), k, tone:'blue',
          ...(e.feeds === 'fade' ? {fall:fades.map(f => [r6(f.at), 1]), grain:grainKeys(fades, e.end + .9)} : {})});
      }
    }
    return {echo:out, ...(swell ? {swell, bloom} : {})};
  };
  // P1: DELVE. at twice the size in the top of the words, typed; its chain under it: the three delay taps
  // ping-pong left, right, left at half its size, the reverb swells it, the fifth is DELVE. again in blue just
  // under it, the octave a deep one under that, sinking a row a beat and dissolving on the fade taps by 4:0.
  // (DELVE. itself softens as its echo takes it: .8 by the first tap, .6 on the fifth, .45 when the echo is gone.)
  screen('P1', {k:2, reveal:'typewriter', zone:ZONES.p1, fx:{...ghosts('P1', 0, {k:2, delayK:1, fifth:4, octave:9, tap:n => ({below:[2, 6, 10][n - 1] ?? 2, dx:n % 2 ? -18 : 18})}), dim:[[r6(P.P1.end + .1), 1], [r6(bar(1)), .8], [r6(bar(2)), .6], [r6(bar(4)), .45], [r6(bar(5)), .35]]},
    why:'DELVE., crisp and dry, then handed to its echo: three taps left and right, the reverb\'s swell, a fifth down in blue, an octave down deep and sinking, dissolving by f240'});
  screen('P2', {reveal:'typewriter', breaks:[2, 3], fx:{dim:weave('P2')}, why:'IN TODAY\'S / FAST-PACED / WORLD…, typed on her syllables, dry; it weaves out as her choir comes in'});
  // (IT'S NOT ABOUT is 85 pegs in PEG-9: it breaks after NOT to stay inside the 72 columns of the safe area.)
  // (MINDSET. ends its line at column 76: its right-hand taps fall straight under it, the left ones 12 pegs left,
  // so every ghost stays inside the 72 safe columns.)
  screen('P3', {reveal:'pop', lines:3, breaks:[2, 3, 5, 7], fx:{strike:strike('P3', 5, 5, [3, 4]), ...ghosts('P3', 8, {fifth:4, tap:(n, e) => ({below:2, dx:e.pan < 0 ? -12 : 0})}), dim:weave('P3')}, why:'IT\'S NOT / ABOUT / THE TOOLS. (struck), the page turns, IT\'S ABOUT / THE MINDSET.; MINDSET. echoes, then weaves out'});
  screen('P4', {reveal:'pop', lines:2, breaks:[2, 4, 6], fx:{strike:strike('P4', 4, 4, [3]), ...ghosts('P4', 6, {k:2, delayK:2, octave:0, tap:(n, e) => ({below:2, dx:e.pan < 0 ? -12 : 12})}), dim:weave('P4')}, why:'her own X and Y: IT\'S NOT / ABOUT X. (X. struck), IT\'S ABOUT / Y.; only Y. echoes, at twice its size'});
  screen('P5', {reveal:'pop', lines:3, breaks:[2, 4], to:M.mouth - 1 / FPS, fx:{strike:strike('P5', 4, 4, [2, 3]), harmony:[{dx:1, dy:1, I:.42, tone:'blue', from:r6(P.P5.words[4].start), word:4}], ...ghosts('P5', 5, {steps:[2, 4, 6, 8]})},
    why:'NOT JUST / A JOB. (struck) / A CALLING., A CALLING. doubled (a blue copy a row under: her two voices); CALLING. walks down B A G E in ghosts; cleared on bar 22'});
  // (Her three voices as a misregistered print: the step up a blue copy a peg up and left, the fourth down a deep
  // one a peg down and right; the words stay whole and legible between them.)
  // (A RICH / TAPESTRY sits a little lower than the others, under star 1, whose arms reach row 25.)
  screen('P6', {reveal:'scanline', lines:2, breaks:[2], zone:[34, 74], fx:{harmony:[{dx:-1, dy:-1, I:.36, tone:'blue', from:r6(P.P6.words[0].start)}, {dx:1, dy:1, I:.5, tone:'deep', from:r6(P.P6.words[0].start)}], wobble:{amount:.3, rate:.8, from:r6(P.P6.words[1].start)}, ...ghosts('P6', 2), dim:weave('P6')},
    why:'A RICH / TAPESTRY, harmonised in three: a blue copy a peg up and left, a deep one a peg down and right, the letters wobbling on the tape'});
  screen('P7', {reveal:'typewriter', lines:2, breaks:[2], fx:{sink:{word:2, rate:.8, max:9, tone:'deep'}, grain:{word:2, amount:.3, rate:4, from:r6(P.P7.words[2].start)}, dim:weave('P7', 2.5)},
    why:'LET THAT crisp; SINK IN. deep and grained, sinking a row a beat as the tape slows to half speed'});
  // P8: the bio in small print (PEG-5), doubled with an octave-down shadow, the tape's wow; then the cut-off
  // "of…" frozen big (PEG-9 at twice the size) while its grain loops on the eighths, a ghost dripping down on
  // each side of it per eighth, until the freeze ends (36:0, 90.0 s).
  const freeze = echoes('P8').filter(e => e.kind === 'freeze'), ofAt = freeze[0].at;
  screen('P8', {font:'peg5', reveal:'scanline', lines:3, breaks:[1, 3, 6, 7], to:ofAt - 1 / FPS, fx:{harmony:[{dx:1, dy:1, I:.35, tone:'blue', from:r6(P.P8.words[0].start)}], wobble:{amount:.35, rate:.6, from:r6(P.P8.words[0].start)}},
    why:'the bio in small print: PASSIONATE / ABOUT DRIVING, then IMPACT AT THE / INTERSECTION / OF…, doubled, wobbling; cut off where her recording is'});
  const ofEnd = bar(36);
  board.push({id:'P8.of', at:{anchor:`echo:P8`, frames:0}, len:r6(stepAtTime(plan, ofEnd) - stepAtTime(plan, ofAt)), text:{ref:'phrase:P8', words:[7, 8]}, font:'peg9', k:2, lines:1, reveal:'steady', palette:'white', zone:ZONES.words,
    // (Its ghosts drip under it, left and right by turns: beside a word this big they would leave the 72 safe
    // columns of the 9:16 frame; four rows at most, so they stop short of the mouth; each lives 0.6 s, under the
    // quarter note, so a side shows one ghost at a time and they never smear into each other.)
    fx:{echo:freeze.map((e, i) => ({word:0, at:r6(e.at), end:r6(e.at + .6), I:.42 - .012 * i, dx:i % 2 ? 12 : -12, below:1, k:1, tone:i % 4 === 3 ? 'blue' : 'white',
      fall:[1, 2, 3, 4].map(j => [r6(e.at + j * .125), 1])})), dim:[[r6(ofAt), 1], [r6(ofEnd - .6), .85], [r6(ofEnd), .7]]},
    why:'OF… frozen on the eighths until 36:0: her cut-off bio becomes the joke; a ghost drips down under it, left and right by turns, per eighth'});
  // P9: MOMENTUM / COMPOUNDS. pops in at her clarity (.5 in the plan: the first entry already half the choir's),
  // and dims as the canon takes it (the mouths carry it), gone as its last voice enters (41:14, 103.75 s).
  screen('P9', {reveal:'pop', lines:2, breaks:[1], to:r6(bar(41.5)), release:'dissolve', fx:{dim:[[r6(P.P9.words[0].start), .78], [98, .58], [100.6, .3], [102.5, .1], [103.4, 0]]},
    why:'MOMENTUM / COMPOUNDS. pops in at her clarity, then dims as the canon takes the phrase, gone as its eighth voice enters'});
  screen('P10', {reveal:'typewriter', lines:2, breaks:[2], to:r6(bar(47.75)), release:'dissolve', why:'READ THAT / AGAIN., crisp, dry and alone: the film loops back to DELVE.'});

  // ---- the textures ----
  // Their light follows the river's arc (arcAt: the bars' energy, held through the canon, halved on the slow
  // line), each look its own floor and span; every look is square-edged (stepped rings, or a field read in blocks
  // of 2 pegs at flat levels) and moves only on the song's eighths; every radial one is centred on her lips. The
  // type and the figures always win.
  const arc = t => arcAt(plan, t);
  const levelKeys = (F0, F1, floor, span) => { const ks = []; for (let f = F0; f <= F1; f += 6) ks.push([f, r6(Math.min(1, floor + span * arc(f / FPS)))]); return keysF(F0, ks); };
  // The arc's light: the level (floor + span x arc), how much light it keeps under the words (more as the river
  // rises: her words have woven out by then), and the white mix at the tops of the swells (white: up to `white`).
  const arcLight = (F0, F1, floor, span, white = 0, from = .45) => {
    const ks = f => arc(f / FPS), at = fn => { const out = []; for (let f = F0; f <= F1; f += 6) out.push([f, r6(fn(ks(f)))]); return keysF(F0, out); };
    return {level:levelKeys(F0, F1, floor, span), under:at(a => .55 + .4 * a), ...(white ? {whiten:at(a => white * smooth(from, 1, a))} : {})};
  };
  // (Every texture keeps the platform's bands calm: faint above row 26, the header, and under row 120, the captions.)
  const psych = (id, t0, t1, look, params, {fade = 8, seed} = {}) => {
    const F0 = fr(t0), F1 = fr(t1);
    const P0 = typeof params === 'function' ? params(F0, F1) : params, {ceilingOff, ...P1} = P0;
    const cue = {type:'psych', id, at:atF(F0), len:lenF(F0, F1), look, fade, ...(seed !== undefined ? {seed} : {}), params:{...P1, ...(ceilingOff ? {} : {ceiling:r6((ZONES.header[1] + 1) / ROWS)}), floor:r6(ZONES.floor / ROWS)}};
    board.push(cue);
    return cue;
  };
  // A value stepped on the song's grid (16ths `every` apart), as frame keys: it jumps on the frame that holds each step.
  const onGrid = (F0, t0, t1, every, fn) => {
    const ks = [];
    for (let s = Math.ceil(stepAtTime(plan, t0) / every) * every; stepTime(plan, s) < t1; s += every) { const t = stepTime(plan, s); ks.push([hit(t), r6(fn(t, s)), 'step']); }
    const first = r6(fn(t0, stepAtTime(plan, t0)));
    return keysF(F0, [[F0, first], ...ks.filter(k => k[0] > F0).filter((k, i, a) => !i || k[1] !== a[i - 1][1])]);
  };
  // The rings' travel, an eighth at a time: a band leaves DELVE. on each delay tap; from P2 they travel in (delve:
  // going in), a sixth of a band an eighth; from P3's turn they reverse and flow out; from bar 16 (Swell 1 rising)
  // out at a third of a band an eighth.
  const delays = echoes('P1').filter(e => e.kind === 'delay').map(e => e.at);
  const turn3 = P.P3.words[5].start;
  const speed = t => t < bar(5) ? 0 : t < turn3 ? 1 / 6 : t < bar(16) ? -1 / 6 : -1 / 3;
  const travelAt = (() => { const memo = new Map(); return (t, s) => { let v = 0; for (let k = 0; k <= s; k += 2) v += speed(stepTime(plan, k)); return -delays.filter(d => d <= t + 1e-6).length + v; }; })();
  const tick8 = (F0, t0, t1) => onGrid(F0, t0, t1, 2, (t, s) => Math.floor(s / 2));
  const C = {cx:r6(LIPS_CX), cy:r6(LIPS_CY)};
  // Bars 0-19: one deep ring opens out of her mouth with DELVE. (f0-60), a band leaves it on every tap; then the
  // stream's stepped rings, blue with every fourth white (every second from P3's turn), travelling in from P2,
  // out from P3's turn, squaring up over bars 14-16; from bar 16 the Printer's motion tiles deal on the eighths.
  psych('rings', 0, bar(19.5), 'contour', (F0, F1) => ({...arcLight(F0, F1, .34, .62, .45), tone:keysF(F0, [[F0, 2], [hit(bar(4)), 1, 'step']]), block:2, band:3, duty:1 / 3,
    every:keysF(F0, [[F0, 4], [hit(turn3), 2, 'step'], [hit(bar(14)), 4, 'step']]), flow:0, breath:.3, ...C, pupil:keysF(F0, [[F0, 12], [hit(bar(4)), 10, 'inOutSine']]),
    aspect:keysF(F0, [[F0, 1.8], [hit(bar(14)), 1.8], [hit(bar(16)), 1, 'inOutSine']]), corner:keysF(F0, [[F0, .7], [hit(bar(14)), .7], [hit(bar(16)), .5, 'inOutSine']]),
    open:keysF(F0, [[F0, 0], [hit(.6), .08, 'outQuad'], [hit(bar(1)), .1], [hit(bar(4)), 1, 'inOutSine']]),
    travel:onGrid(F0, 0, bar(19.5), 2, travelAt),
    tiles:keysF(F0, [[F0, 0], [hit(bar(16)), 0], [hit(bar(16)) + 1, .12, 'step'], [hit(bar(19)), .32]]), tile:12, tpx:4, tlevels:4, tick:tick8(F0, 0, bar(19.5))}), {fade:2, seed:3});
  // Bars 19-22, the top of Swell 1 (P5, her two voices): two stepped fields, one up and left of her lips and one down
  // and right, lit where exactly one is (a moiré in square edges: bands, a lattice where they cross), squared,
  // flowing out a third of a band an eighth, white every second band.
  // (It parts for her: it fades out over the first half of bar 22, as the white-hot head runs round her outline.)
  psych('twin', bar(19), bar(22.5), 'contour', (F0, F1) => ({...arcLight(F0, F1, .06, .5), tone:1, block:2, band:3, duty:1 / 3, every:2, flow:0, breath:.3, ...C, twin:.1, twinY:.06, pupil:9, aspect:1, corner:.5, open:1,
    travel:onGrid(F0, bar(19), bar(22.5), 2, (t, s) => -(s - 19 * 16) / 6), tiles:keysF(F0, [[F0, .3], [hit(bar(21.5)), .3], [hit(bar(22)), 0, 'step']]), tile:12, tpx:4, tlevels:4, tick:tick8(F0, bar(19), bar(22.5))}), {fade:8, seed:5});
  // Bar 24 (f1440): star 1 lands, and one stepped ring pulses out from it once (two bands, a second).
  const STAR1 = {x:LIPS_CX, y:32.5 / ROWS};
  // (It starts clear of the star's own arms and grows 10 blocks in its second and a quarter, three blocks wide: lit
  // rings a block wide, square, stepping out on the sixteenths; centred between pegs, on the blocks' own grid, so
  // its four sides are alike.)
  // (Its top edge crosses the header for that second, and it passes behind A RICH keeping only the dark moat a peg
  // wide round the letters: the star's own light, not a texture's, so no ceiling and no halo.)
  psych('landing', 60, 61.25, 'contour', (F0, F1) => ({level:keysF(F0, [[F0, .8], [F0 + 14, .7], [F1, 0, 'inQuad']]), under:.9, halo:0, ceilingOff:1, tone:1, block:2, band:2, duty:.5, every:2, flow:0, breath:0, cx:r6((LIPS_COL + 1) / COLS), cy:r6((Math.floor(STAR1.y * ROWS) + 1) / ROWS), aspect:1, corner:.5,
    pupil:onGrid(F0, 60, 61.25, 1, t => r6(4 + (t - 60) / 1.25 * 10)), open:onGrid(F0, 60, 61.25, 1, t => r6(3 / (65 - 4 - (t - 60) / 1.25 * 10))), travel:0}), {fade:2, seed:19});
  // Bars 24-29, the Pool: deep stepped rings out of her lips, a third of a band a beat, on the eighths (her words
  // rippling out of her mouth), low: the river has let go.
  psych('pool', bar(24), bar(29.5), 'contour', (F0, F1) => ({...arcLight(F0, F1, .42, .55), tone:2, block:2, band:3, duty:1 / 3, every:4, flow:0, breath:.3, ...C, pupil:10, aspect:1.4, corner:.7, open:1,
    travel:onGrid(F0, bar(24), bar(29.5), 2, (t, s) => -(s - 24 * 16) / 12)}), {fade:12, seed:7});
  // Bars 28-33: plasma in big pixels (blocks of 2, four flat levels), at half time and on the eighths; inside the
  // slow span it dims with the arc and drifts down, so "sink in" sinks.
  const slow = plan.slow[0];
  psych('plasma', bar(28), bar(34), 'plasma', (F0, F1) => ({...arcLight(F0, F1, .3, .7), speed:.5, quant:2, breath:.3, scale:1.2, block:2, levels:4, cx:C.cx,
    cy:keysF(F0, [[F0, .55], [fr(slow.from), .55], [fr(slow.to), .7, 'inOutSine'], [F1, .6, 'inOutSine']])}), {fade:32, seed:11});
  // Bars 32-46: the 8-fold mandala, centred on her lips (they cover its middle), in blocks of 2 pegs at three flat
  // levels, turning and travelling on the eighths, brightening to the canon; from bar 36 the motion tiles deal on
  // the eighths, growing to bar 42; under the ring of mouths a dark lane, so they sing on dark ground. Held through
  // the canon's last voice (109.4 s), then let go with the river.
  const ringT = mouthTrack(plan, {latency:L, P, M, bar}), ringFrom = ringT.ringOn, ringTo = ringT.closed;
  psych('mandala', bar(32), bar(46), 'mandala', (F0, F1) => ({...arcLight(F0, F1, .12, .88, .72, .6), fold:8, petals:2, speed:.5, quant:2, breath:.3, ...C, block:2, levels:3,
    tiles:keysF(F0, [[F0, 0], [hit(bar(36)), 0], [hit(bar(36)) + 1, .1, 'step'], [hit(bar(42)), .4], [hit(bar(43)), 0, 'step']]), tile:12, tpx:4, tlevels:3, tick:tick8(F0, bar(32), bar(46)),
    dip:keysF(F0, [[F0, 0], [ringFrom, 0], [ringFrom + 12, .6, 'inOutSine'], [ringTo - 12, .6], [ringTo, 0, 'inOutSine']]), dipRx:RING.rx, dipRy:RING.ry, dipW:8}), {fade:32, seed:13});
  // Bars 44-46: the opening's deep ring closes back into her mouth (a callback before her last line).
  psych('rings.back', bar(44), bar(46.25), 'contour', (F0, F1) => ({level:keysF(F0, [[F0, .3], [F1, .15]]), tone:2, block:2, band:3, duty:1 / 3, every:4, flow:0, breath:.3, ...C, pupil:10, aspect:1.8, corner:.7,
    open:keysF(F0, [[F0, .6], [hit(bar(46)) - 2, 0, 'inOutSine']]), travel:onGrid(F0, bar(44), bar(46.25), 2, (t, s) => (s - 44 * 16) / 8)}), {fade:24, seed:17});

  // ---- her mouth ----
  const lips = ringT;
  const F0 = lips.from, F1 = lips.to;
  const body = M.mouth;                                    // bar 22: the voice gets its body
  board.push({type:'psych', id:'lips', at:atF(F0), len:lenF(F0, F1), look:'lips', fade:2, params:{
    level:1, cx:C.cx, cy:C.cy, mouth:keysF(F0, lips.hero.map(([f, c]) => [f, c, 'step'])),
    // Drawn in stroke order in its first half second (f1-f11), a white-hot head leading; undrawn at the end.
    draw:keysF(F0, [[F0, 0], [1, 0], [11, 1, 'inOutSine'], [fr(M.undraw + 1.1), 1], [fr(120) - 2, 0, 'inOutSine']]),
    // The outline alone until bar 22; then a head runs round it, the fill scans in and the gloss pops. Outline
    // only again while its voice is the ring of mouths.
    trace:keysF(F0, [[F0, 0], [fr(body), 0], [fr(body) + 1, .001, 'step'], [fr(body + 1.25), 1], [fr(body + 1.25) + 1, 0, 'step']]),
    fill:keysF(F0, [[F0, 0], [fr(body + 1.25), 0], [fr(body + 2.2), 1, 'inOutSine'], [fr(M.undraw + .2), 1], [fr(M.undraw + 1.1), 0, 'inOutSine']]),
    gloss:keysF(F0, [[F0, 0], [fr(body + 2.2), 0], [fr(body + 2.45), 1], [fr(M.undraw), 1], [fr(M.undraw + .2), 0]]),
    // While its voice is the ring, the hero sits in its middle at its middle size, humming the choir.
    mid:keysF(F0, [[F0, 0], [lips.ringOn, 1, 'step'], [lips.closed, 0, 'step']]),
    // Her voice dropping: a blue shadow a row under on P1's fifth and through P8 (its octave-down double).
    shadow:keysF(F0, [[F0, 0], ...lips.p1fifth.flatMap(([a, b]) => [[hit(a), .7, 'step'], [hit(b), 0, 'inOutSine']]), [hit(P.P8.words[0].start), 1, 'step'], [hit(bar(36)), 0, 'step']]),
    stack:keysF(F0, lips.stack),
    hero:keysF(F0, [[F0, 1], [lips.ringOn, 1], [lips.ringOn + 8, .8, 'inOutSine'], [lips.closeFrom, .8], [lips.closed, 1, 'inOutSine']]),
    ring:keysF(F0, lips.ring), turn:keysF(F0, lips.turn), rx:RING.rx, ry:RING.ry,
    ...Object.fromEntries(lips.small.map((ks, k) => [`m${k}`, keysF(F0, ks.map(([f, c]) => [f, c, 'step']))]))},
    why:'her mouth: an outline drawn in the first half second that speaks P1-P5 and mouths the choir; its body in bar 22; the kiss on 23:12; every phrase on her own pitch and level; for the canon a ring of small mouths round it at its middle size; a smile; undrawn'});

  // ---- the stars ----
  const stars = starEvents(plan, {latency:L, kissAt:M.kiss, lips:{x:LIPS_CX, y:LIPS_CY}, land:STAR1});
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
//   f0-f11 drawn (its outline), at rest; P1-P5 spoken by the outline, the choir mouthed between them from its
//   entrance (15.0 s, open 1); bar 23 the choir; 23:12 the pucker (a small O), 23:15 the blow, then P6, P7 (its
//   tape slide in the warp), P8, the frozen "of…" held round (85-90 s), the choir mouthed (90-95), P9; from the
//   canon's second voice (39:8) its voice becomes a ring of small mouths, one per voice as it enters, each on its
//   own repeats (open at least 2 on a vowel, so they read as mouths), round the hero at its middle size, humming
//   the choir; the ring closes back by 44:0 (110 s); the
//   choir mouthed, P10, a smile, undrawn from 47:0 (117.5).
// stack: one copy under the mouth per choir voice past the first, ramped over a bar where the count changes;
// none while its voice is the ring, nor once it is undrawn.
const CHOIR_SHAPE = {o:'oh', e:'eh', u:'uh', ou:'oo', ah:'ah', a:'ah', i:'ee'};
export function mouthTrack(plan, {latency, P, M, bar}) {
  const from = 0, to = BLACK_FROM;
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
  const speak = ev => { for (const v of eventVisemes(ev, LADY_PITCH, {fps:FPS, latency, settled:false})) set(v.f, v.shape, v.open); };
  // The first half: the choir from its entrance to bar 22, her five crisp phrases over it.
  mouthChoir(plan.choir[0].t, bar(22));
  for (const id of ['P1', 'P2', 'P3', 'P4', 'P5']) speak(P[id]);
  mouthChoir(bar(23), M.kiss);
  span(M.kiss, M.kiss + 3 * plan.step, f => set(f, 'kiss', 2));
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
    // (A small mouth opens at least 2 on a vowel: at 21 pegs a slit would not read as a mouth.)
    for (const e of all) for (const x of eventVisemes(voiceEv(e), LADY_PITCH, {fps:FPS, latency, settled:false})) if (small[v].has(x.f)) small[v].set(x.f, {shape:x.shape, open:x.open > 0 && !['press', 'fv', 'rest'].includes(x.shape) ? Math.max(2, x.open) : x.open});
  }
  // While its voice is the ring, the hero (at its middle size) hums the choir.
  for (let f = ringOn; f < closed; f++) set(f, 'rest', 0);
  mouthChoir((ringOn + .5) / FPS - latency, (closed - .5) / FPS - latency);
  // P10, then a smile (it closes into one), held until the mouth is undrawn.
  mouthChoir(bar(44), P.P10.words[0].start - .3);
  speak(P.P10);
  span(P.P10.end + .12, 120, f => set(f, 'smile', 0));
  const frames = [...hero.keys()].sort((a, b) => a - b).map(f => ({f, ...hero.get(f)}));
  const toKeys = map => { const fs = [...map.keys()].sort((a, b) => a - b); if (!fs.length) return [[from, -1]]; const ks = visemeKeys(settle(fs.map(f => ({f, ...map.get(f)})))); return [[from, -1], ...ks.filter(([f]) => f > from), [fs.at(-1) + 1, -1]].filter((k, i, a) => !i || k[0] > a[i - 1][0]); };
  // The ring: out over 12 frames from voice 1's entry, turning a full turn every four bars, closing back into the
  // hero by 44:0.
  const ring = [[from, 0], [ringOn, 0], [ringFull, 1, 'inOutSine'], [closeFrom, 1], [closed, 0, 'inOutSine']];
  const turn = [[from, 0], [ringOn, 0], [closed, r6(360 * (closed - ringOn) / FPS / (4 * 16 * plan.step))]];
  // Her voice dropping in P1's chain: the fifth (a shadow) and the octave (one copy, deep), then the choir's stack.
  const p1 = plan.echoes.filter(e => e.phrase === 'P1'), fifth = p1.filter(e => e.kind === 'fifth').map(e => [e.at, e.end]);
  const oct = p1.find(e => e.kind === 'octave'), fadeEnd = Math.max(...p1.filter(e => e.kind === 'fade').map(e => e.end));
  const H = t => Math.floor((t + latency) * FPS + 1e-9), BARF = 16 * plan.step * FPS;
  const stack = [[from, 0], [H(oct.at), 1, 'step'], [H(fadeEnd), 0, 'inOutSine']];
  let prev = 0;
  for (const c of plan.choir) if (c.voices - 1 !== prev) { stack.push([H(c.t), prev], [H(c.t) + BARF, c.voices - 1, 'inOutSine']); prev = c.voices - 1; }
  const st = stack.filter(k => k[0] < ringOn - 12);
  st.push([ringOn - 12, prev], [ringOn + 8, 0, 'inOutSine'], [closed, 0], [closed + BARF, prev, 'inOutSine'], [Math.round(M.undraw * FPS), prev], [Math.round(M.undraw * FPS) + 12, 0, 'inOutSine']);
  return {from, to, hero:visemeKeys(settle(frames)), small:small.map(toKeys), ring, turn, ringOn, closeFrom, closed, stack:st.filter((k, i, a) => !i || k[0] > a[i - 1][0]), p1fifth:fifth};
}

// ---- the stars -----------------------------------------------------------------------------------------
// [[t0, t1, x, y, len, tone, hero, x0?, y0?, travel?], ...] in the board's paint time (each born on the frame
// that holds its chime) and 0..1 of the board. Near stars on the chimes (plan.stars.twinkles): white, one in
// five signal, hero ones signal and big; far stars (silent, blue, small) fill the sky to plan.stars.density.
// Places: the kiss's star lands in the safe area over her words (row 32, on the lips' axis, its arms clear of the header); near and hero stars
// beside the words (the margins, rows 26-76), in the band over the words (rows 26-34) and the gap over the mouth
// (72-78); the header (rows 3-23) holds far stars only; faint ones only below row 120. Never closer than twice
// the bigger one's arms and 2 pegs to another alive.
export function starEvents(plan, {latency, kissAt, lips, land}) {
  const S = plan.stars, out = [], alive = [], end = BLACK_FROM / FPS - .02;
  const born = t => Math.floor((t + latency) * FPS + 1e-9) / FPS + 1e-4;
  const density = t => { const d = S.density; if (t <= d[0][0]) return d[0][1]; for (let i = 1; i < d.length; i++) if (t <= d[i][0]) return d[i - 1][1] + (d[i][1] - d[i - 1][1]) * (t - d[i - 1][0]) / (d[i][0] - d[i - 1][0]); return d.at(-1)[1]; };
  const free = (x, y, t, len) => alive.every(s => s.t1 <= t || Math.hypot((s.x - x) * COLS, (s.y - y) * ROWS) >= 2 * Math.max(len, s.len) + 2);
  const region = (h, side, faint) => {
    if (faint) return {x:(3 + h[0] * 84) / COLS, y:(122 + h[1] * 30) / ROWS};
    if (side === 0) return {x:(3 + h[0] * 84) / COLS, y:(3 + h[1] * 20) / ROWS};          // the header: far stars only
    if (side === 3) return {x:(8 + h[0] * 70) / COLS, y:(73 + h[1] * 4) / ROWS};           // the gap over the mouth
    if (side === 4) return {x:(8 + h[0] * 70) / COLS, y:(27 + h[1] * 6) / ROWS};           // over the words
    return {x:(side === 1 ? 2.5 + h[0] * 5 : 82 + h[0] * 5) / COLS, y:(28 + h[1] * 88) / ROWS};   // the margins, beside the words and the mouth
  };
  // (The sky thins with the delta: far stars are gone by 47:4 (118.75 s, the density's last one), near ones by
  // 47:7; only the last hero star, the chime on 47:5, lives on to shrink out by f2880.)
  const lastHero = Math.max(...S.twinkles.filter(w => w.hero).map(w => w.t));
  const add = (t0, life, place, len, tone, hero, extra = []) => {
    const cap = hero > 0 && t0 >= lastHero - .1 ? end : tone === 0 ? 118.75 : 119.25;
    const t1 = Math.min(end, t0 + life, Math.max(t0 + 1.6, cap)), s = {t0, t1, len, ...place};
    alive.push(s);
    out.push([+t0.toFixed(4), +t1.toFixed(4), +place.x.toFixed(4), +place.y.toFixed(4), len, tone, hero, ...extra]);
  };
  // The kiss: star 1 leaves her lips on the pucker and lands on the exact middle, the first chime, square.
  const first = S.twinkles[0];
  add(born(kissAt), 9.5, {x:land.x, y:land.y}, 7, 2, 1, [lips.x, lips.y, +(first.t - kissAt).toFixed(4)]);
  // (A star's arms stay inside its band: a near one never reaches the header or under row 120.)
  const fits = (p, len, top = 26) => p.y * ROWS - len >= top - .5 && p.y * ROWS + len <= ZONES.floor - .5 && p.x * COLS - len >= .5 && p.x * COLS + len <= COLS - 1.5;
  S.twinkles.slice(1).forEach((w, i) => {
    const n = i + 1, t0 = born(w.t), len = w.hero ? 5 : 2 + Math.round(hash(n, 9));
    let place = null, last = null;
    for (let k = 0; k < 40 && !place; k++) {
      const hh = [hash(n, 3 + 10 * k), hash(n, 5 + 10 * k)], side = Math.abs(w.pan) > .4 && k < 6 ? (w.pan < 0 ? 1 : 2) : [4, 1, 2, 3][k % 4];
      const p = region(hh, side);
      if (fits(p, len)) { last = p; if (free(p.x, p.y, t0, len)) place = p; }
    }
    // (Every chime births its star: when the sky is full round it, it takes its last place that fits.)
    place ??= last;
    if (!place) return;
    add(t0, w.hero ? 6 : 3 + 3 * hash(n, 7), place, len, w.hero || n % 5 === 0 ? 2 : 1, w.hero ? 1 : 0);
  });
  // The far stars: whenever fewer than the density are alive, one more, silent and blue (a step at a time).
  let m = 0;
  for (let t = 60.5; t < end - 3; t += .25) {
    const live = alive.filter(s => s.t0 <= t && s.t1 > t).length;
    if (live >= Math.round(density(t))) continue;
    m++;
    const faint = hash(m, 13) < .18, side = faint ? 0 : [0, 0, 0, 1, 2, 1, 2][Math.floor(hash(m, 15) * 7)];
    let place = null;
    const len = faint ? 1 : 1 + Math.round(hash(m, 23));
    for (let k = 0; k < 16 && !place; k++) { const sd = k < 8 ? side : [0, 1, 2][k % 3]; const p = region([hash(m, 17 + 10 * k), hash(m, 19 + 10 * k)], sd, faint); if (free(p.x, p.y, t, len) && (faint || fits(p, len, sd === 0 ? 0 : 26))) place = p; }
    if (!place) continue;
    add(born(t), 3 + 3 * hash(m, 21), place, len, 0, faint ? -1 : 0);
  }
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
