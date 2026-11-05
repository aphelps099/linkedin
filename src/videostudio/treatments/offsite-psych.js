// "Offsite, psychedelic": the team retreat's film, cut for voices and claps rather than bass drops
// (Aaron: "more of a panda bear style song... the video may be a bit more psychedelic pixelation"; then
// "a little more slow motion - and less of the downbeat... if we can use the DOT grid for psychedelic
// images, even better"). The call is still the call, and every rule of the Drop Edition holds (the cold
// open, the board home, the choke's true black, the ignition, the tape stop and the ghost BACK.), but the
// picture flows like the loop under it:
//   - Slow motion. The call's R1 footage (listeners, idles, walk-ins, banners) runs at half speed and
//     slower, easing into it over a beat as each shot arrives, and follows the song wherever it slows
//     (offsite.js slowOf: the slow tape under the second verse, the hook and the sign-off, her slowed
//     round, the room starting to sink; Sink In's tape exactly). R0 plates freeze where the song slows;
//     instruments are never slowed (none plays here at all; the printer keeps its tempo).
//   - Fewer hard cuts. Shots run long; inside a scene a tile changes on the loop's offbeats (the "and"s)
//     with a dissolve (the new shot fades in over an 8th on top of the old, which plays on under it), and
//     between two call layouts every tile but Synergy's and Pat's dissolves across the bar line. Trails
//     smear the motion on the backbeat.
//   - The dot grid as the image (pegboard/psych.js, {type:'psych'} board cues): a look in the board's
//     home under the words all through the film; full-frame looks between lines where Synergy is off
//     screen (the build's slow rungs, Drop B between his verse and the hook), cross-faded with the
//     footage's own peg bloom; looks in single tiles of the rounds; the crew arriving through the grid;
//     the BACK. bloom as a mandala that grows on the full board with the ignition and settles home with it.
//
//   const plan = FORMS.drop60.arrange(lyrics, durations, {track:'offsite', cast, coldOpen:true});
//   const edl = offsitePsych(plan, SHOTS, {format:'9:16'});
//   compile(edl, {plan, shots:SHOTS}).lint.errors   // []
//
// Pure: the same plan, shots and format give the same EDL. Every passage hangs off the plan's own
// landmarks (sections, the unmute, Synergy's lines and words, the ladder rung by rung, the claps as the band
// plays them, the song's slow spans, the choke, the impact, Sink In's "in", the tape stop, plan.coldOpen),
// so it cuts any track of the song book; it is chosen for Offsite (treatments/index.js).
//
// Its own cut, scene by scene (layout class in brackets):
//   arrive [split]  the crew walks in at half speed, first through the dot grid, resolving as the call connects
//   join [G4]       Synergy joins on the unmute with his welcome; the crew and the printer dissolve across
//   circle [G6]     the verse: Synergy, slow listeners changing on the "and"s, a slow kaleidoscope pair;
//                   the printer turns into the dot grid for the second verse
//   choir [G9]      the hook: a slow round of kaleidoscopes in canon around Synergy, two of them mandalas of pegs
//   drift [G6]      a second verse after the hook, when the track has one
//   rise [G4]       her slow rungs: slower still, pegs bloom out of the board home, and the frame turns into
//                   rings of pegs born on every beat
//   fold [L1]       her quarter notes: one slow kaleidoscope gains wedges on every retrigger
//   spiral [G6]     her 8ths and 16ths: the kaleidoscopes turn a notch on every hit, at speed; a spiral of pegs
//   ladder [full]   her 32nds alone on the board over a spiral of pegs; the choke; true black
//   dropA [full, G6] the ignition with the BACK. bloom as a mandala; then the circle, a tile changing on the
//                   "and"s, sinking into slow motion as the room does
//   sink [G4]       Sink In: the tape slows the picture, then it melts into big blocks on "in"
//   mandala [L1]    Drop B's verse: a slow full-frame kaleidoscope, its wedges stepping on the claps; then,
//                   between his lines, a pinwheel of pegs takes the frame
//   bloom [G9]      pegs bloom out of the board home across a slow call, Synergy singing in the middle; the
//                   fill: one picture in canon round the circle, two tiles through the dot grid
//   leave [G4, split, L1]  everyone leaves the offsite as pegs; Synergy alone, at half speed; the tape stop
import {MOVES} from '../moves/index.js';
import {fitTime, rng} from '../moves/util.js';
import {createEDL, merge} from '../edl/schema.js';
import {backbeatHits} from '../edl/params.js';
import {hitAt, ladyTime, cutFrame} from '../edl/anchors.js';
import {shotIndex, isSynergy, isInstrument, resolveCrop, UPSCALE, TRACKING, layerMatrix, invert, apply} from '../edl/compile.js';
import {cellRect, FORMATS, HOME} from '../layouts.js';
import {LADY_TABLE} from '../../allhands/lady-table.js';
import {TRACKS} from '../../allhands/songbook/index.js';
import {landmarks, coldOpen, ending, r6, BOARD_MOVE} from './shared.js';

// Who plays whom. Ids are shot-index aliases. The glass: mirrorable close-ups (never a robot or an
// instrument), the only shots the kaleidoscope folds. glass are R0 takes, folded at speed (the build's
// spiral); still are R1 ones that read well slowed, folded in slow motion everywhere else.
export const CAST = {
  synergy:'synergy-camera-v2-listening', synergyClose:'synergy-enthusiastic-training-close-up',
  crew:'the-professionals-arrive', banner:'banner-installation-blank-plates', printer:'printer-outward-feed',
  people:'people-listening', peopleTalk:'people-speaking', linda:'linda-listening', lindaTalk:'linda-speaking', arjun:'arjun-listening', arjunTalk:'arjun-speaking',
  strategy:'strategy-listening', synthia:'synthia-clean-face-plate', synthiaClose:'synthia-conference-closeup',
  glass:['people-culture-onboarding-v1', 'linda-quarterly-v1', 'arjun-quarterly-v1', 'kevin-standup-v1', 'keys-onboarding-v1', 'people-culture-quarterly-v1', 'operations-quarterly-v1', 'linda-unlock-v2'],
  still:['people-speaking', 'arjun-listening', 'linda-speaking', 'people-listening', 'arjun-speaking', 'linda-listening'],
};
const PAT = 'gen:camera-off', BLACK = 'gen:color:#000000';
// A full-frame kaleidoscope is always pixelated, never under PIXEL px blocks: the close-ups are 720p and
// tier C, and the blocks carry the upscale (lint G10 exempts a mosaic of 8 px or more).
const PIXEL = 9;
// A dissolve: an 8th, the new shot fading in on top of the one it replaces.
const DIS = 2;
// Slow motion: half speed, and slower under her slowed round.
const HALF = .5, SLOWER = .35;
const sh = id => `shot:${id}`;

// What the monitor's cut list calls each scene.
export const SCENE_LABELS = {cold:'Cold open', arrive:'Arrivals', join:'The call', circle:'The circle', choir:'Choir of glass', drift:'Drift', rise:'Pegs rise',
  fold:'Fold', spiral:'Spiral', ladder:'The board alone', dropA:'Clap circle', sink:'Melt', mandala:'Mandala', bloom:'Bloom', leave:'Leave the offsite'};

// The palette's slow drift over the film (fractions of the plan's length, duotone hue: 0 blue,
// 1 violet, 2 warm). Never green; it never cuts, it drifts.
const HUE = [[0, 0], [.18, .15], [.32, .7], [.45, 1], [.55, 1.2], [.66, 1.7], [.72, 2], [.82, 1.5], [.92, 1.9], [1, 2]];
const speaking = stem => ({bind:`stem:${stem}`, scale:1.5, base:-.3, attack:.02, release:.3});

export function offsitePsych(plan, shots, {format = '9:16', features, seed = 11} = {}) {
  const L = landmarks(plan), {BS, QS, T, S, impact, chokeBar, choke} = L, F = FORMATS[format], index = shotIndex(shots);
  const ctx0 = {plan, shots, features, format, seed};
  const m = (name, ctx) => MOVES[name].fn({...ctx0, ...ctx});
  const patches = [], board = [{id:'song', at:0, text:{ref:'song'}}], camera = [], overrides = [], transports = [], boardMoves = [];
  const add = (scene, clips) => { for (const x of clips) { x.scene ??= scene; for (const k of Object.keys(x)) if (x[k] === undefined) delete x[k]; } patches.push({clips}); return clips; };
  const c = (id, at, len, cell, asset, more = {}) => ({id, at, len:r6(len), cell, asset, ...more});
  const grow = (at, why) => boardMoves.push({id:`grow.${boardMoves.length}`, at, frames:BOARD_MOVE, ease:'inOutSine', align:'start', why});
  const settle = (at, why) => boardMoves.push({id:`home.${boardMoves.length}`, at, frames:BOARD_MOVE, ease:'inOutSine', align:'end', why});
  // The zoom ceiling of a shot in a cell (U · crop.h / cell.h); `fit` picks the first that holds `zoom`.
  const ceiling = (id, cell) => { const s = index.get(id), r = cellRect(format, cell); if (!s || !r) return 0; return (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, format, r).h / r.h; };
  const fit = (cell, zoom, ...ids) => ids.find(id => ceiling(id, cell) >= zoom - 1e-9) ?? ids.at(-1);
  const time = (id, at, len, k = 0) => fitTime(ctx0, sh(id), at, len, k) ?? {in:0};
  const secs = (a, n) => T(a + n) - T(a);

  // ---- slow motion ------------------------------------------------------------------------------------
  // Where the song itself slows (offsite.js slowOf: the slow tape, her slowed round; Sink In and the tape
  // stop are whole-room tape, which tape coupling and the ending follow exactly), in steps, merged.
  const slowSpans = (() => {
    const list = (TRACKS[plan.track]?.slowOf?.(plan) ?? []).filter(w => !w.whole).map(w => [Math.round(S(w.from)), Math.round(S(w.to))]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]), out = [];
    for (const [a, b] of list) { const last = out.at(-1); if (last && a <= last[1] + QS) last[1] = Math.max(last[1], b); else out.push([a, b]); }
    return out;
  })();
  const slowAt = s => slowSpans.find(([a, b]) => s >= a && s < b);
  // Enter at speed, ease into slow motion over a beat (a speed ramp; keys in steps from the clip's start).
  const easeTo = (r, d = QS) => [[0, 1], [d, r, 'inOutSine']];
  // Normal speed, easing into `r` wherever the song slows and back out after (over `e` steps each way).
  const follow = (at, len, r = HALF, e = DIS) => {
    const keys = [[0, slowAt(at) ? r : 1]];
    for (const [a, b] of slowSpans) {
      if (b <= at || a >= at + len) continue;
      if (a > at) keys.push([r6(a - at), 1], [r6(Math.min(len, a - at + e)), r, 'inOutSine']);
      if (b < at + len) keys.push([r6(b - at), r], [r6(Math.min(len, b - at + e)), 1, 'inOutSine']);
    }
    const clean = keys.filter((k, i) => !i || k[0] > keys[i - 1][0]);
    return clean.length === 1 ? clean[0][1] : clean;
  };
  // The source seconds a rate uses over a slot (an upper bound: each key segment at its faster end).
  const need = (rate, at, len) => {
    if (typeof rate === 'number') return rate * secs(at, len);
    let n = 0;
    for (let i = 0; i < rate.length; i++) {
      const a = Math.max(0, rate[i][0]), b = Math.min(len, rate[i + 1]?.[0] ?? len);
      if (b > a) n += Math.max(rate[i][1], rate[i + 1]?.[1] ?? rate[i][1]) * secs(at + a, b - a);
    }
    if (rate[0][0] > 0) n += rate[0][1] * secs(at, Math.min(len, rate[0][0]));
    return n;
  };
  // A slowed source for a slot: an in point picked by the seed where the rate's source fits (with room for
  // a dissolve after the slot). Instruments keep their tempo (fitTime); a shot too short even slowed takes
  // the slowest rate that fits.
  const slow = (id, at, len, rate = HALF, k = 0) => {
    const s = index.get(id);
    if (!s || isInstrument(s)) return time(id, at, len, k);
    const fps = s.fps || 24, margin = 2 / fps, n = need(rate, at, len + DIS), spare = s.duration - margin - n;
    if (spare < 0) return {in:0, rate:r6(Math.max(.25, Math.min(1, (s.duration - margin) / secs(at, len + DIS))))};
    const r = rng(seed * 7919 + k * 104729 + Math.floor(at));
    return {in:Math.round(r() * spare * fps) / fps, rate};
  };
  // Where the song slows, an R0 plate holds its frame instead (from the step it starts slowing, local).
  const holdR0 = (id, at, len) => { const s = index.get(id); if (!s || s.reverseClass !== 'R0') return null; const w = slowSpans.find(([a, b]) => b > at && a < at + len); return w ? r6(Math.max(0, w[0] - at)) : null; };

  // ---- the plan's landmarks ------------------------------------------------------------------------
  const verse = L.need('Verse'), build = L.need('Build'), dropA = L.need('Drop A'), sinkS = L.need('Sink In'), dropB = L.need('Drop B'), outro = L.need('Outro');
  const linesOf = kind => (plan.lines || []).filter(l => l.kind === kind && l.words.length), startOf = l => l.words[0].at, barOf = s => Math.floor(s / BS) * BS;
  const U = Math.min(L.U, verse.from);
  // Synergy's words as steps [from, to): "between lines" is where none is sounding.
  const words = (plan.lines || []).flatMap(l => l.words.map(w => [w.at, w.at + (w.steps ?? 1)]));
  const lastWordEnd = (from, to) => words.filter(([a]) => a >= from && a < to).reduce((e, [, b]) => Math.max(e, b), from);
  // The claps as the band plays them (edl/params.js backbeatHits, the late backbeat included); a bar
  // the kit leaves without one keeps its beats 2 and 4, so the picture always has a backbeat.
  const claps = (from, to) => {
    const hits = backbeatHits(plan, from, to).filter(h => h.step >= from && h.step < to);
    if (hits.length) return hits;
    const out = []; for (let s = Math.ceil(from / QS) * QS; s < to; s += QS) if (Math.round((s % BS) / QS) % 2 === 1) out.push({step:s, late:0});
    return out;
  };
  // The loop's offbeats: the "and" at or after a step, and change points every `every` steps on them
  // (from a bar line, every 16 lands on the "and" of 3, the hands before the clap on 4).
  const and = s => s + (((QS / 2 - s) % QS) + QS) % QS;
  const offbeats = (from, to, every, first = every) => { const out = []; for (let s = and(from + first - 6); s <= to - 2 * QS; s = and(s + every)) out.push(s); return out; };
  // The palette at a step, and a wash over a clip that drifts with it.
  const hueAt = s => { const u = Math.max(0, Math.min(1, s / plan.totalSteps)); let i = 1; while (i < HUE.length - 1 && HUE[i][0] < u) i++; const [a, x] = HUE[i - 1], [b, y] = HUE[i]; return r6(x + (y - x) * (u - a) / Math.max(1e-9, b - a)); };
  const wash = (at, len, mix) => ({type:'paletteWash', mix, hue:[[0, hueAt(at)], [r6(len), hueAt(at + len)]]});
  // The breathing mosaic: block size from the voices (Synergy, the lady, the choir) and a swell on every clap.
  const breathe = (voice = 14, clap = 8, base = 0, more = {}) => ({type:'breathe', px:{add:[{bind:'voices', scale:voice, base:base - 1, attack:.03, release:.22}, {bind:'clap', scale:clap, attack:0, release:.16}]}, ...more});
  // Trails on the backbeat: the copies flare on each clap and fade by the next.
  const trail = (taps = 3, lift = .45, floor = .18) => ({type:'trail', taps, frames:2, decay:{bind:'clap', scale:lift, base:floor, attack:0, release:.3}});
  const drift = (len, a0 = 0, px = 3) => ({type:'chromaDrift', px, angle:[[0, a0], [r6(len), a0 + 40]], radial:2});
  const fold = (len, wedges = 6, a0 = 0, turn = 30) => ({type:'radialFold', wedges, angle:[[0, a0], [r6(len), a0 + turn]]});
  // Pegs blooming out of the board home: the bloom's centre is the home's, in frame units.
  const H = HOME[format], homeC = {cx:r6((H.x + H.w / 2) / F.w), cy:r6((H.y + H.h / 2) / F.h)};
  // (gamma .8: brighter pegs than the ignition's, so the bloom glows rather than holes the picture.)
  const bloom = amount => ({type:'pegBloom', amount, ...homeC, space:'frame', band:.12, pitch:12, levels:6, gamma:.8});
  const glass = k => CAST.glass[((k % CAST.glass.length) + CAST.glass.length) % CAST.glass.length];
  const still = k => CAST.still[((k % CAST.still.length) + CAST.still.length) % CAST.still.length];
  const synergyShot = asset => { const s = index.get(String(asset).replace(/^shot:/, '')); return !!s && isSynergy(s); };
  const fadeIn = (d = DIS) => [[0, 0], [d, 1, 'inOutSine']];
  // A cell's shots in turn: each new one fades in over DIS steps on top of the last, which plays on under it.
  const chain = (seq, end, make) => seq.map((x, j) => {
    const next = seq[j + 1]?.at ?? end, y = make(x, j, r6(next - x.at + (seq[j + 1] ? DIS : 0)));
    if (j) y.frame = {...(y.frame || {}), opacity:fadeIn()};
    return y;
  });

  // ---- the dot grid -----------------------------------------------------------------------------------
  // A psych cue (pegboard/psych.js): no cell, the board's own region under its words (the home, or the
  // whole frame when the board is); a cell, its own peg board over that tile ('full': the frame), faded in
  // and out with its cue so the picture dissolves into it. Never with Synergy's mouth row under a cell.
  // A cell's cue ends on or before the frame that cuts at its last step, so it never outlives its tile
  // by a frame (at 92 or 130 BPM a step is not a whole number of frames).
  const psych = (id, at, len, look, params = {}, {fade = 4, cell, seed:sd} = {}) => {
    if (cell) len = Math.min(len, S((cutFrame(T(at + len)) - .5) / 24) - at);
    if (!(len >= 4)) return;
    board.push({type:'psych', id:`psych.${id}`, at:r6(at), len:r6(len), look, params, seed:sd ?? board.length, fade:Math.max(2, Math.min(fade, Math.floor(len / 2))), ...(cell ? {cell} : {})});
  };

  // ---- the cold open: the impact at frame 0, then the rewind with its sound -----------------------------
  {
    const co = coldOpen(plan, L);
    transports.push(...co.transports); boardMoves.push(...co.boardMoves); camera.push(...co.camera);
  }

  // ---- the intro: the crew arrives at half speed, through the dot grid, resolving as the call connects ---------
  const crewT = slow(CAST.crew, 0, verse.from, HALF, 1), crewIn = crewT.in ?? 0, crewRate = typeof crewT.rate === 'number' ? crewT.rate : 1;
  if (U > 0) {
    add('arrive', [
      c('arrive.crew', 0, U, 'split.0', sh(CAST.crew), {time:crewT, chrome:{name:'Lobby', mic:'muted'},
        fx:[{type:'breathe', px:{add:[[[0, 28], [U, 2, 'inOutSine']], {bind:'voices', scale:10, base:-2, attack:.03, release:.25}]}}, wash(0, U, .6), trail(2, .35)], why:'the crew walks in at half speed: pixels that resolve as the call connects, breathing with the room'}),
      c('arrive.pat', 0, U, 'split.1', PAT, {chrome:{mic:'muted'}, why:"Pat's camera is off; the call is connecting"}),
    ]);
    // The walk-in through the dot grid first (the footage look: the picture at one peg each), dissolving
    // into the pixels as the call connects.
    psych('arrive', 0, U - DIS, 'footage', {sharpen:1.1, level:.9}, {cell:'split.0', fade:Math.min(10, Math.floor((U - DIS) / 3))});
  }
  // In the home, from the intro through the welcome: rings born on every beat (the loop), under the words.
  psych('ripples', QS, verse.from - QS, 'ripples', {level:.7, spacing:7, speed:.5});
  // The verse's landmarks: the hook, and the half of the verse where the printer turns into the dot grid.
  const hook0 = linesOf('hook').find(l => startOf(l) >= verse.from && startOf(l) < build.from);
  const hookAt = hook0 ? Math.max(verse.from + BS, barOf(startOf(hook0))) : Math.min(build.from, verse.from + 4 * BS);
  const hookEnd = Math.min(build.from, hookAt + 2 * BS), half = and(verse.from + Math.floor((hookAt - verse.from) / 2 / QS) * QS - QS / 2);
  // The unmute: Synergy joins with his welcome; the printer is the shaker, smearing on the claps, one take
  // in tempo from the call to the middle of the verse (the same tile in both layouts).
  const host = fit('G4.0', 1.1, CAST.synergy, CAST.synergyClose), printT = time(CAST.printer, U, half + DIS - U, 3);
  const printerIn = s => r6((printT.in ?? 0) + (T(s) - T(U)));
  if (verse.from > U) add('join', [
    c('join.synergy', U, verse.from - U, 'G4.0', sh(host), {time:time(host, U, verse.from - U, 2), frame:{zoom:[[0, 1], [verse.from - U, 1.06, 'linear']]}, fx:[wash(U, verse.from - U, .2)], chrome:{mic:'on', speaking:speaking('voice'), toast:{text:'Synergy joined', at:0, len:QS}}, why:'Synergy joins on the unmute with his welcome'}),
    c('join.crew', U, verse.from - U, 'G4.1', sh(CAST.crew), {time:{in:r6(crewIn + crewRate * (T(U) - T(0))), rate:crewRate}, chrome:{name:'Lobby'}, fx:[breathe(12, 6), wash(U, verse.from - U, .5), trail(2)], why:'the crew carries on at half speed, breathing with the voices'}),
    c('join.printer', U, verse.from - U, 'G4.2', sh(CAST.printer), {time:{in:printerIn(U)}, fx:[trail(3, .5, .2), wash(U, verse.from - U, .4)], why:'the printer is the shaker (it keeps its tempo); its pages smear on the claps'}),
    c('join.pat', U, verse.from - U, 'G4.3', PAT, {chrome:{name:'Pat', mic:'on'}, why:"Pat's camera is off"}),
  ]);

  // ---- the verse: the circle ------------------------------------------------------------------------------
  {
    const V = verse.from, len = hookAt - V, syn = fit('G6.0', 1.08, CAST.synergy, CAST.synergyClose);
    const g0 = still(seed), gIn = slow(g0, V, len, HALF, 4);
    add('circle', [
      c('circle.synergy', V, len, 'G6.0', sh(syn), {time:slow(syn, V, len, follow(V, len), 5), frame:{zoom:[[0, 1], [len, 1.08, 'linear']]}, fx:[wash(V, len, .25)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy sings to the circle, slowing with the tape (no warp on his face: a light wash only)'}),
      // The kaleidoscope pair: one slow glass, folded two ways (one decode), turning slowly.
      c('circle.glassA', V, len, 'G6.2', sh(g0), {time:gIn, fx:[fold(len, 6, 0, 45), wash(V, len, .55), breathe(10, 6)], why:'kaleidoscope: a mirrorable close-up at half speed in six wedges, turning'}),
      c('circle.glassB', V, len, 'G6.3', sh(g0), {time:gIn, fx:[fold(len, 6, 30, -45), wash(V, len, .55), breathe(10, 6)], why:'its twin, folded the other way'}),
      ...chain([{at:V}, {at:half}], hookAt, (x, j, n) => c(`circle.printer${j ? j : ''}`, x.at, n, 'G6.4', sh(CAST.printer), {time:j ? time(CAST.printer, x.at, n, 6) : {in:printerIn(V)}, fx:[trail(3, .5, .2), wash(x.at, n, .45)],
        why:j ? 'the printer again, under the dot grid' : 'the printer smears on the claps, in tempo (it carries on from the call)'})),
      c('circle.pat', V, len, 'G6.5', PAT, {chrome:{name:'Pat', mic:'on'}}),
    ]);
    // A listener in G6.1, a new one on the "and" every six beats, each easing into slow motion as it arrives.
    const pool = [CAST.people, CAST.linda, CAST.arjun, CAST.peopleTalk, CAST.lindaTalk, CAST.arjunTalk].map(id => fit('G6.1', 1, id, CAST.people));
    const seq = [V, ...offbeats(V, hookAt, 6 * QS)].map((at, j) => ({at, id:pool[j % pool.length]}));
    add('circle', chain(seq, hookAt, (x, j, n) => c(`circle.listen${j}`, x.at, n, 'G6.1', sh(x.id), {time:slow(x.id, x.at, n, j ? easeTo(HALF) : HALF, 10 + j), fx:[breathe(16, 8), wash(x.at, n, .5), trail(3)],
      why:j ? 'a new listener on the "and", dissolving in and easing into slow motion' : 'the first listener, at half speed'})));
    // The second half of the verse: the printer through the dot grid (the footage look), and back.
    psych('printer', half, hookAt - half, 'footage', {sharpen:1.2, colour:1, level:.9}, {cell:'G6.4', fade:6});
    // (Low under the verse's three lines, so the words still to come read through it.)
    psych('moire', V, len, 'moire', {level:.32, spacing:7, speed:.5});
  }

  // ---- the hook: a slow choir of glass in canon around Synergy ---------------------------------------------------
  {
    const at = hookAt, len = hookEnd - hookAt, syn = fit('G9.4', 1, CAST.synergy, CAST.synergyClose), g = still(seed + 1), gIn = slow(g, at, len + 4, HALF, 7);
    const ring = ['G9.0', 'G9.1', 'G9.2', 'G9.5', 'G9.8', 'G9.6', 'G9.3'];
    add('choir', [
      c('choir.synergy', at, len, 'G9.4', sh(syn), {time:slow(syn, at, len, follow(at, len), 8), fx:[wash(at, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy leads the hook in the middle of the round'}),
      c('choir.pat', at, len, 'G9.7', PAT, {chrome:{name:'Pat', mic:'on'}}),
      // The round: one glass at half speed, each tile a 16th later than the last (one decode within the
      // stutter cache), folded with its own wedges and turn, so the hook's voices stack up as pictures.
      ...ring.map((cell, k) => c(`choir.${k}`, at, len, cell, sh(g), {time:{...gIn, freezeAt:{at:0, len:Math.min(k, 3)}}, signature:k ? undefined : 'canon',
        fx:[fold(len, [6, 8, 6, 10, 6, 8, 12][k], k * 17, k % 2 ? -40 : 40), wash(at, len, .6), breathe(12, 8)], why:`the round: voice ${k + 1} enters ${Math.min(k, 3)} step${Math.min(k, 3) === 1 ? '' : 's'} late, at half speed`})),
    ]);
    // The round's corners turn to mandalas of pegs for its second half, and back.
    if (len >= BS) for (const [cell, fd] of [['G9.0', 6], ['G9.8', 12]]) psych(`choir.${cell}`, and(at + len / 2 - QS), len / 2 + QS / 2, 'mandala', {fold:fd, level:.85, speed:.5}, {cell, fade:6});
    psych('choir', at, len, 'mandala', {fold:8, level:.6, speed:.5});
  }
  // A second verse after the hook, when the track has one: the drift (chromatic drift and trails).
  if (build.from - hookEnd >= BS) {
    const at = hookEnd, len = build.from - hookEnd, syn = fit('G6.0', 1.08, CAST.synergy, CAST.synergyClose), g = still(seed + 2), gIn = slow(g, at, len, HALF, 13), lis = fit('G6.1', 1, CAST.linda, CAST.people);
    add('drift', [
      c('drift.synergy', at, len, 'G6.0', sh(syn), {time:slow(syn, at, len, follow(at, len), 11), fx:[wash(at, len, .25)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy sings the second verse'}),
      c('drift.listen', at, len, 'G6.1', sh(lis), {time:slow(lis, at, len, easeTo(HALF), 12), fx:[drift(len, 0, 4), trail(3), wash(at, len, .45), breathe(12, 6)], why:'a slow listener in chromatic drift, smearing on the claps'}),
      c('drift.glassA', at, len, 'G6.2', sh(g), {time:gIn, fx:[fold(len, 8, 0, 60), wash(at, len, .6), breathe(10, 6)]}),
      c('drift.glassB', at, len, 'G6.3', sh(g), {time:gIn, fx:[fold(len, 8, 22, -60), wash(at, len, .6), breathe(10, 6)]}),
      c('drift.printer', at, len, 'G6.4', sh(CAST.printer), {time:time(CAST.printer, at, len, 14), fx:[trail(3, .5, .2), wash(at, len, .45)]}),
      c('drift.pat', at, len, 'G6.5', PAT, {chrome:{name:'Pat', mic:'on'}}),
    ]);
    psych('drift', at, len, 'plasma', {level:.35, speed:.5});
  }

  // ---- the build follows her ladder, rung by rung ------------------------------------------------------------
  const ladder = (plan.lady || []).filter(e => e.role === 'ladder');
  const bars = [];
  for (let b = build.from; b <= chokeBar; b += BS) { const ev = ladder.filter(e => e.at >= b && e.at < b + BS); bars.push({at:b, period:ev[0]?.period ?? 16, events:ev}); }
  const slowBars = bars.filter(b => b.period >= 8 && b.at < chokeBar), quarters = bars.filter(b => b.period >= 4 && b.period < 8 && b.at < chokeBar), fast = bars.filter(b => b.period < 4 && b.at < chokeBar);
  // Her slow rungs: the call slower still (her round comes back at half speed here), the footage turning
  // into pegs blooming out of the board home, a step on every retrigger; then the whole frame turns into
  // rings of pegs born on every beat from the home's centre, and gives way to the fold.
  if (slowBars.length) {
    const at = slowBars[0].at, len = slowBars.at(-1).at + BS - at, hits = slowBars.flatMap(b => b.events.map(e => e.at)), n = Math.max(1, hits.length);
    const amount = {keys:[[0, 0], ...hits.map((s, k) => [r6(s - at), r6(.12 + .5 * (k + 1) / n), 'outQuad'])], hit:true};
    const tiles = [[CAST.people, 'G4.0'], [CAST.banner, 'G4.1'], [CAST.linda, 'G4.2'], [CAST.arjun, 'G4.3']];
    add('rise', tiles.map(([id, cell], k) => { const s = fit(cell, 1, id, CAST.crew, CAST.people);
      return c(`rise.${k}`, at, len, cell, sh(s), {time:slow(s, at, len, [[0, HALF], [QS, SLOWER, 'inOutSine']], 20 + k), fx:[bloom(amount), wash(at, len, .45), breathe(8, 0)], why:`slower than half speed; pegs bloom out of the board home, a step on each of her ${n} slow retriggers`}); }));
    const end = at + len, psEnd = quarters.length ? Math.min(end + 2 * QS, quarters.at(-1).at + BS) : end, psFrom = Math.max(at + 2 * QS, psEnd - 7 * QS);
    psych('rise', psFrom, psEnd - psFrom, 'ripples', {level:.9, spacing:6, ...homeC, speed:.5}, {cell:'full', fade:Math.min(8, Math.floor((psEnd - psFrom) / 3))});
    psych('rise.home', at, Math.max(4, psFrom + 4 - at), 'ripples', {level:.6, spacing:6, speed:.5});
  }
  // Her quarter notes: one slow kaleidoscope fills the frame and gains wedges on every retrigger; the
  // board panel carries her words over it (L1).
  for (const [i, q] of quarters.entries()) {
    const g = fit('L1.0', 1, still(seed + 3 + i), CAST.still[0]), wedges = {keys:[[0, 4], ...q.events.map((e, k) => [r6(e.at - q.at), [4, 6, 8, 12, 16][Math.min(4, k + 1)], 'step'])], hit:true};
    add('fold', [c(`fold${i ? i : ''}`, q.at, BS, 'L1.0', sh(g), {time:slow(g, q.at, BS, HALF, 30 + i),
      fx:[{type:'radialFold', wedges, angle:[[0, 0], [BS, 45]]}, wash(q.at, BS, .55), {type:'breathe', px:{bind:'stem:lady', scale:16, base:PIXEL, attack:.01, release:.12}}],
      why:`kaleidoscope at half speed: wedges 4 to ${[4, 6, 8, 12, 16][Math.min(4, q.events.length)]}, one more fold on each of her ${q.events.length} retriggers`})]);
  }
  // Her 8ths and 16ths: the kaleidoscopes turn a notch on every hit, at speed (the build); Synergy's tile
  // lights on his stammers; one tile turns into a spiral of pegs.
  if (fast.length) {
    const at = fast[0].at, len = fast.at(-1).at + BS - at, hits = fast.flatMap(b => b.events.map(e => e.at)), g = glass(seed + 5), gIn = time(g, at, len + 4, 40);
    const turn = (dir, step) => ({keys:[[0, 0], ...hits.map((s, k) => [r6(s - at), dir * step * (k + 1), 'outQuad'])], hit:true});
    const syn = fit('G6.0', 1, CAST.synergy, CAST.synergyClose), sat = [[0, .4]], talk = [[0, 0]];
    for (const st of (plan.stutters || []).filter(s => s.at >= at && s.at < at + len)) { sat.push([st.at - at, 1, 'step'], [st.at - at + 1, .4, 'step']); talk.push([st.at - at, 1, 'step'], [st.at - at + 1, 0, 'step']); }
    add('spiral', [
      c('spiral.synergy', at, len, 'G6.0', sh(syn), {time:time(syn, at, len, 41), fx:[{type:'saturation', amount:sat}], chrome:{speaking:talk}, why:`Synergy's tile lights on his ${sat.length >> 1} stammers`}),
      ...['G6.1', 'G6.2', 'G6.3', 'G6.4', 'G6.5'].map((cell, k) => c(`spiral.${k}`, at, len, cell, sh(g), {time:{...gIn, freezeAt:{at:0, len:Math.min(k, 3)}},
        fx:[{type:'radialFold', wedges:[6, 8, 10, 8, 6][k], angle:turn(k % 2 ? -1 : 1, [6, 9, 12, 9, 6][k])}, wash(at, len, .6), {type:'breathe', px:{bind:'stem:lady', scale:14, base:-2, attack:.01, release:.1}},
          {type:'chromaDrift', px:{bind:'roll', scale:6, attack:.02, release:.1}, angle:[[0, k * 72], [r6(len), k * 72 + 90]], radial:2}],
        why:'the spiral: one glass in canon, every fold turning a notch on each of her hits'})),
    ]);
    if (len >= BS) psych('spiral.cell', and(at + len / 2 - QS), at + len - and(at + len / 2 - QS), 'spiral', {arms:4, level:.85}, {cell:'G6.4', fade:6});
  }
  // The 32nds: the board alone (it grows to the frame over black); the choke: black, her tag on bare
  // sockets, then true black from the first frame after her tag (plus the choke's codec tail).
  add('ladder', [c('ladderBoard', chokeBar, choke.at - chokeBar, 'full', BLACK, {why:'the board alone: her 32nds at k4, grown to the frame'}),
    c('black', choke.at, impact - choke.at, 'full', BLACK, {why:'the choke: true black once her tag stops sounding (the board goes dark)'})]);
  grow(chokeBar, 'the board alone: it grows to the frame');
  // Under the build, from the fold to the choke: a spiral of pegs in the home that grows to the frame with
  // the board, brighter rung by rung (dark with the choke, which nothing lights).
  {
    const from = quarters[0]?.at ?? fast[0]?.at ?? chokeBar;
    psych('build', from, choke.at - from, 'spiral', {arms:3, twist:1.2, level:[[0, .4], [r6(Math.max(1, chokeBar - from)), .75], [r6(choke.at - from), .9]]});
  }

  // ---- Drop A: the ignition, the BACK. bloom as a mandala; then the circle ----------------------------------------
  const ignShot = fit('full', 1, glass(seed + 6), CAST.glass[0]), A = impact + 8, Aend = sinkS.from;
  const ignite = c('ignite', {anchor:'cue:impact', hit:true}, 8, 'full', sh(ignShot), {time:time(ignShot, impact, 8, 50), signature:'ignition',
    fx:[{type:'radialFold', wedges:6, angle:[[0, 0], [8, 20]]}, {type:'pegVideo', mix:1, pitch:12, levels:6, gamma:1.4}],
    why:'IGNITION on the frame that holds the impact: a mandala of pegs (a mirrorable close-up in six wedges, as peg video)'});
  add('dropA', [ignite]);
  settle(A, 'the call comes back: the board is home on the cut');
  // The BACK. bloom of voices as a mandala on the full board, settling into the home with it.
  psych('bloom', impact, Math.max(8, Aend - 2 * QS - impact), 'mandala', {fold:12, petals:2, level:[[0, .95], [8, .7, 'inOutSine']]});
  if (Aend > A) {
    const len = Aend - A, syn = fit('G6.0', 1.08, CAST.synergy, CAST.synergyClose);
    add('dropA', [
      c('dance.synergy', A, len, 'G6.0', sh(syn), {time:slow(syn, A, len, follow(A, len), 51), frame:{zoom:[[0, 1.08], [len, 1, 'outQuad']]}, fx:[wash(A, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy sings the hook into the clap circle'}),
      c('dance.pat', A, len, 'G6.5', PAT, {chrome:{name:'Pat', mic:'on'}}),
    ]);
    // The circle: every two beats from the second bar, on the "and", the next tile round the circle dissolves
    // to a new face, every one smearing on the claps and breathing with the chant. The drop runs at speed
    // until the room starts to sink: then the R1 faces ease into half speed and the R0 glass holds its frame.
    const ring = ['G6.1', 'G6.3', 'G6.4', 'G6.2'], pool = [[CAST.peopleTalk], [glass(seed + 7), 1], [CAST.lindaTalk], [CAST.arjunTalk], [still(seed + 8), 1], [CAST.strategy], [CAST.synthiaClose], [CAST.people]];
    const seq = ring.map((cell, k) => [{at:A, id:pool[k][0], glass:!!pool[k][1]}]);
    offbeats(A, Aend, 2 * QS, BS).forEach((s, j) => { const [id, g] = pool[(j + ring.length) % pool.length]; seq[j % ring.length].push({at:s, id, glass:!!g}); });
    let n = 0;
    ring.forEach((cell, k) => add('dropA', chain(seq[k], Aend, (x, j, ln) => {
      const id = fit(cell, 1, x.id, CAST.people), isGlass = x.glass && id === x.id, r0 = holdR0(id, x.at, ln);
      const t = index.get(id)?.reverseClass === 'R0' ? {...time(id, x.at, Math.max(1, ln), 60 + n), ...(r0 !== null ? {freezeAt:r0} : {})} : slow(id, x.at, ln, follow(x.at, ln), 60 + n);
      return c(`dance.${n++}`, x.at, ln, cell, sh(id), {time:t,
        fx:[...(isGlass ? [fold(ln, 6, 15 * k, 30)] : []), breathe(14, 10), trail(3, .5), wash(x.at, ln, .55), drift(ln, 90 * k, 2)],
        chrome:{speaking:j ? [[0, 1], [QS, 0, 'step']] : 0}, why:`${j ? 'the circle: this tile dissolves to a new face on the "and"' : 'the circle opens'}${r0 !== null ? '; it holds its frame as the room starts to sink' : '; at speed, easing into half speed as the room starts to sink'}`});
    })));
  }

  // ---- Sink In: the tape slows the picture; on "in" it holds and melts into big blocks ---------------------------
  {
    const pool = [fit('G4.0', 1, CAST.synthia, CAST.synthiaClose), fit('G4.1', 1, CAST.people, CAST.peopleTalk), fit('G4.2', 1, CAST.crew, CAST.banner), fit('G4.3', 1, CAST.synergy, CAST.synergyClose)];
    const sink = m('tapeCoupling', {id:'sink', at:sinkS.from, len:sinkS.to - sinkS.from, pool:pool.map(sh), cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'sink'});
    const e = (plan.lady || []).find(x => x.role === 'sink');
    let freeze = sinkS.from + 12;
    if (e) {
      const ws = (LADY_TABLE[e.file]?.words || []).filter(w => w.start >= e.from - 1e-6 && w.start < e.to), lastW = ws.at(-1);
      const t = lastW ? ladyTime(plan, e) + (lastW.start - e.from) / ((e.rate || 1) * (e.deep || 1)) : null;
      if (t) { let s = sinkS.from; while (s < sinkS.to - 1 && T(s + 1) <= t) s++; freeze = s; }
    }
    const len = sinkS.to - sinkS.from;
    for (const x of sink.clips) {
      const f0 = freeze - sinkS.from, d = Math.min(1, (sinkS.to - freeze) / 4);
      x.time = {...(x.time || {}), freezeAt:{at:f0, len:sinkS.to - freeze}};
      if (synergyShot(x.asset)) { x.fx = [wash(sinkS.from, len, .35)]; x.chrome = {speaking:0}; x.why = `${x.why}; Synergy keeps his face`; continue; }
      x.fx = [{type:'breathe', px:[[0, 2], [f0, 4, 'step'], [r6(f0 + d), 10, 'step'], [r6(f0 + 2 * d), 22, 'step'], [r6(f0 + 3 * d), 44, 'step']]}, trail(5, .25, .55), wash(sinkS.from, len, .7)];
      x.why = `${x.why}; frozen on "in" (step ${freeze % BS} of its bar), melting into 44 px blocks`;
    }
    add('sink', sink.clips);
    // Under water: a slow plasma in the home from where the room starts to sink.
    const from = Math.min(Aend - 2 * QS, slowAt(Aend - 1)?.[0] ?? Aend - 2 * QS);
    psych('sink', from, sinkS.to - from, 'plasma', {level:.7, speed:.5, scale:1.3});
  }

  // ---- Drop B: the mandala (and a pinwheel of pegs between his lines), the bloom, the round ---------------------------
  const DB = dropB.from, DBend = outro.from, nB = Math.round((DBend - DB) / BS), nM = Math.max(1, Math.min(2, Math.floor(nB / 2))), M = Math.min(DBend, DB + nM * BS);
  // The first bars: a slow full-frame kaleidoscope (L1, the board panel over it), its wedges stepping on the
  // claps, a second glass dissolving in on the "and"; between his lines the frame turns into a pinwheel of pegs.
  {
    const cl = claps(DB, M).map(h => h.step + h.late), wedges = {keys:[[0, 6], ...cl.map((s, k) => [r6(s - DB), [8, 6, 10, 8, 12, 8][k % 6], 'step'])], hit:true};
    const seq = [{at:DB, k:0}, ...(M - DB >= 2 * BS ? [{at:and(DB + BS + QS / 2 - QS), k:1}] : [])];
    add('mandala', chain(seq, M, (x, j, ln) => { const g = fit('L1.0', 1, still(seed + 9 + x.k), CAST.still[0]);
      return c(`mandala.${j}`, x.at, ln, 'L1.0', sh(g), {time:slow(g, x.at, ln, HALF, 70 + j),
        fx:[{type:'radialFold', wedges, angle:[[0, 23 * j], [r6(ln), 23 * j + (j % 2 ? -35 : 35)]]}, wash(x.at, ln, .6), drift(ln, 40 * j, 3),
          j ? breathe(10, 10, PIXEL + 1) : {type:'breathe', px:{add:[[[0, 44], [r6(Math.min(ln, 2 * QS)), PIXEL + 1, 'inOutSine']], {bind:'voices', scale:10, base:-1, attack:.03, release:.22}, {bind:'clap', scale:10, attack:0, release:.16}]}}],
        why:j ? 'the mandala: a second glass dissolves in on the "and", at half speed' : 'the mandala: one glass at half speed, its wedges stepping on the claps; it comes in as the melt\'s 44 px blocks and resolves over two beats'}); }));
    // Between his lines (from his last word here to just before the bloom): the frame through the dot grid.
    const quiet = Math.min(M - 4 * QS, Math.max(DB + 2 * QS, lastWordEnd(DB, M - 2 * QS))), psEnd = M - 1;
    psych('pinwheel', quiet, psEnd - quiet, 'pinwheel', {blades:8, level:.9, ...homeC}, {cell:'full', fade:Math.min(6, Math.floor((psEnd - quiet) / 3))});
    psych('mandala', DB, Math.max(4, quiet + 4 - DB), 'mandala', {fold:6, level:.5, speed:.5});
  }
  // The last bars: pegs bloom out of the board home across a slow call, growing on every clap, while
  // Synergy sings in the middle (his tile never blooms); the fill ("Read that again."): one picture in canon
  // around the circle, dissolving in on the "and" of four, two of its tiles through the dot grid.
  if (DBend > M) {
    const at = M, len = DBend - M, round = len >= 2 * BS ? and(DBend - BS - QS) : DBend, bl = round - at;
    const hits = claps(at, round).map(h => h.step + h.late), n = Math.max(1, hits.length);
    // (The call comes out of the pinwheel's pegs: the tiles start as pegs and clear over an 8th.)
    const amount = {keys:[[0, .6], [DIS, .04, 'inOutSine'], ...hits.filter(s => s - at > DIS).map((s, k) => [r6(s - at), r6(.06 + .5 * (k + 1) / n), 'outQuad'])], hit:true};
    const syn = fit('G9.4', 1, CAST.synergy, CAST.synergyClose);
    // Three listeners at half speed, each in two or three tiles (the twins mirrored, a few frames apart: one decode each).
    const tiles = [['G9.0', CAST.people, 0, null], ['G9.2', CAST.people, 4, 'x'], ['G9.1', CAST.arjun, 0, null], ['G9.3', CAST.linda, 0, null], ['G9.5', CAST.linda, 4, 'x'], ['G9.6', CAST.arjun, 4, 'x'], ['G9.8', CAST.people, 8, null]];
    const ins = new Map(), g = still(seed + 12), gIn = slow(g, round, DBend - round + 4, HALF, 90);
    add('bloom', [
      c('bloom.synergy', at, len, 'G9.4', sh(syn), {time:time(syn, at, len, 80), fx:[wash(at, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy in the middle of the bloom; his face never turns to pegs'}),
      c('bloom.pat', at, len, 'G9.7', PAT, {chrome:{name:'Pat', mic:'on'}}),
      ...tiles.flatMap(([cell, id, lag, mirror], k) => {
        if (!ins.has(id)) ins.set(id, slow(id, at, bl + 2, HALF, 81 + k)); const t0 = ins.get(id), out = [];
        out.push(c(`bloom.${k}`, at, r6(bl + (round < DBend ? DIS : 0)), cell, sh(id), {time:{...t0, in:r6((t0.in ?? 0) + lag / 24)}, ...(mirror ? {frame:{mirror}} : {}), fx:[bloom(amount), wash(at, bl, .5), trail(2, .35)],
          why:`a listener at half speed; pegs bloom out of the board home, growing on every clap${mirror ? ' (a mirrored twin)' : ''}`}));
        if (round < DBend) out.push(c(`round.${k}`, round, DBend - round, cell, sh(g), {time:{...gIn, freezeAt:{at:0, len:Math.min(k + 1, 4)}}, frame:{opacity:fadeIn()},
          fx:[fold(DBend - round, 6, 0, k % 2 ? -30 : 30), trail(4, .4, .3), wash(round, DBend - round, .6)], why:`the round: the same slow picture ${Math.min(k + 1, 4)} step${k ? 's' : ''} later, dissolving in on the "and"`}));
        return out;
      }),
    ]);
    if (round < DBend) for (const cell of ['G9.2', 'G9.6']) psych(`round.${cell}`, round, DBend - round, 'footage', {sharpen:1, level:.9}, {cell, fade:4});
    psych('bloomHome', at, len, 'ripples', {level:.6, spacing:5, speed:.5});
  }

  // ---- the outro: everyone leaves the offsite as pegs; Synergy alone; the tape stop ------------------------------
  // Synergy's last tile: the whole frame (L1) when his tracked mouth row sits clear of the board's home
  // panel there, else the top of a split (1:1 frames his close-up with the row in the home's band).
  const O = outro.from, stopAt = L.stopAt, close = fit('L1.0', 1, CAST.synergyClose, CAST.synergy), leave = [];
  const clearOfHome = (id, cell) => {
    const sct = index.get(id), track = TRACKING[sct?.robot], r = cellRect(format, cell);
    if (!track || !r) return true;
    const Mx = layerMatrix(r, resolveCrop(sct, {}, format, r), {zoom:1, cx:.5, cy:.5, rot:0}), Mi = invert(Mx), pad = 24;
    return track.frames.every(fr => { const [x, y] = apply(Mi, fr[0], fr[1]); return y < H.y - pad || y > H.y + H.h + pad || x < H.x - pad || x > H.x + H.w + pad; });
  };
  const lastCell = clearOfHome(close, 'L1.0') ? 'L1.0' : 'split.0', lastShot = lastCell === 'L1.0' ? close : fit('split.0', 1, CAST.synergyClose, CAST.synergy);
  {
    const s1 = Math.min(O + BS, stopAt - QS), s2 = Math.min(O + 2 * BS, stopAt - QS / 2);
    const dissolve = (len, from = .5) => bloom([[0, 0], [r6(len * from), 0], [r6(len), .85, 'inQuad']]);
    const who = id => index.get(id)?.characters?.[0] ?? 'Guest';
    const toast = (name, len) => ({toast:{text:`${name} left the offsite`, at:0, len:Math.min(len, 2 * QS)}});
    const syn = fit('G4.0', 1, CAST.synergy, CAST.synergyClose), syn2 = fit('split.0', 1, CAST.synergy, CAST.synergyClose), stay = fit('split.1', 1, CAST.people, CAST.peopleTalk, CAST.synthiaClose, CAST.crew), g = still(seed + 13);
    const stayT = slow(stay, O, s2 - O + DIS, HALF, 101), stayRate = typeof stayT.rate === 'number' ? stayT.rate : HALF;
    if (s1 > O) leave.push(
      c('leave.synergy', O, s1 - O, 'G4.0', sh(syn), {time:time(syn, O, s1 - O, 100), fx:[wash(O, s1 - O, .3)], chrome:{mic:'on', speaking:speaking('voice')}}),
      c('leave.people', O, s1 - O, 'G4.1', sh(fit('G4.1', 1, stay, CAST.people)), {time:fit('G4.1', 1, stay, CAST.people) === stay ? stayT : slow(fit('G4.1', 1, stay, CAST.people), O, s1 - O, HALF, 106), fx:[wash(O, s1 - O, .5), breathe(10, 6)], why:'at half speed'}),
      c('leave.glass', O, s1 - O, 'G4.2', sh(g), {time:slow(g, O, s1 - O, HALF, 102), fx:[fold(s1 - O, 6, 0, 30), dissolve(s1 - O), wash(O, s1 - O, .6)], why:'the slow glass turns to pegs and leaves'}),
      c('leave.pat', O, s1 - O, 'G4.3', PAT, {chrome:{name:'Pat', mic:'on'}}));
    if (s2 > s1) leave.push(
      c('leave2.synergy', s1, s2 - s1, 'split.0', sh(syn2), {time:time(syn2, s1, s2 - s1, 103), fx:[wash(s1, s2 - s1, .3)], chrome:{mic:'on', speaking:speaking('voice'), ...toast('Pat', s2 - s1)}}),
      c('leave2.stay', s1, s2 - s1, 'split.1', sh(stay), {time:{in:r6((stayT.in ?? 0) + stayRate * (T(s1) - T(O))), rate:stayRate}, frame:{opacity:fadeIn()}, fx:[dissolve(s2 - s1, .25), wash(s1, s2 - s1, .5)], why:`${who(stay)} carries on at half speed, dissolving across, turns to pegs and leaves`}));
    // The call's tiles play on under the split for its first 8th, fading out (Synergy and Pat cut).
    if (s2 > s1) for (const x of leave) if (x.at === O && x.asset.startsWith('shot:') && !synergyShot(x.asset)) { x.frame = {...(x.frame || {}), opacity:[[0, 1], [r6(s1 - O), 1], [r6(s1 - O + DIS), 0, 'inOutSine']]}; x.len = r6(s1 - O + DIS); }
    // Synergy alone, at half speed where the sign-off rides the slow tape (a constant rate: the ending keeps
    // his eyes open through the tape stop's hold).
    const closeRate = slowAt(s2) || slowAt(s2 + QS) ? HALF : 1, closeT = closeRate === 1 ? time(lastShot, s2, plan.totalSteps - s2, 105) : slow(lastShot, s2, plan.totalSteps - s2, closeRate, 105);
    leave.push(c('leave.close', s2, plan.totalSteps - s2, lastCell, sh(lastShot), {time:closeT, fx:[wash(s2, plan.totalSteps - s2, .3)],
      chrome:{mic:'on', speaking:speaking('voice'), ...toast(who(stay), 2 * QS)}, why:closeRate === 1 ? 'Synergy alone at the offsite' : 'Synergy alone at the offsite, at half speed with the sign-off’s slow tape'}));
    if (lastCell !== 'L1.0') leave.push(c('leave.patLast', s2, plan.totalSteps - s2, 'split.1', PAT, {chrome:{name:'Pat', mic:'on'}, why:"Pat stays on, camera off, to the end"}));
    add('leave', leave);
    // Lissajous figures in the home under the last lines, brightest between his sign-off and "Full stop.";
    // gone before she stops the tape.
    const quiet = lastWordEnd(s2, stopAt);
    psych('leave', O, stopAt - O, 'lissajous', {curves:2, trail:10, level:quiet < stopAt - 2 * QS ? [[0, .55], [r6(quiet - O), .55], [r6(quiet - O + QS), .85, 'inOutSine']] : .55});
  }
  const end = ending(plan, L, {clips:leave, pitch:12, index, shots, format});
  transports.push(...end.transports); board.push(...end.board);
  if (end.clips.length) add('leave', end.clips);

  // ---- dissolves across the bar line between scenes ------------------------------------------------------------
  // Between two call layouts, every tile but Synergy's and Pat's: the outgoing shot plays on DIS steps past
  // the line and fades out under the incoming one, which fades in on top. Synergy cuts (nothing may lie over
  // his mouth row; he is fully up whenever he sings); Pat's tile is a card, not a picture. Not into Sink In:
  // the drop's circle and the melt would hold eight decodes at once (the cut there is her "Sink in", the
  // tape's first frame). Not into or out of L1: its panel lies over the picture, and the board's panel may
  // change only inside a board move (lint G14); the mandala takes the melt's blocks instead.
  const CALL = /^(split|stack3|G4|G6|G9)\./;
  const clips = patches.flatMap(p => p.clips), sceneStart = new Map();
  for (const x of clips) if (x.scene && typeof x.at === 'number') sceneStart.set(x.scene, Math.min(sceneStart.get(x.scene) ?? Infinity, x.at));
  const handoff = (from, to) => {
    const at = sceneStart.get(to);
    if (at === undefined) return;
    const soft = x => typeof x.at === 'number' && CALL.test(x.cell) && x.asset.startsWith('shot:') && !synergyShot(x.asset);
    const outgoing = clips.filter(x => x.scene === from && soft(x) && Math.abs(x.at + x.len - at) < 1e-9), incoming = clips.filter(x => x.scene === to && soft(x) && x.at === at);
    if (!outgoing.length || !incoming.length) return;
    for (const x of incoming) { const keys = Array.isArray(x.frame?.opacity) ? x.frame.opacity : typeof x.frame?.opacity === 'number' ? [[0, x.frame.opacity]] : [[0, 1]]; x.frame = {...(x.frame || {}), opacity:[...fadeIn(), ...keys.filter(k => k[0] > DIS)]}; }
    for (const x of outgoing) {
      const n = x.len, keys = Array.isArray(x.frame?.opacity) ? x.frame.opacity : [[0, 1]];
      x.frame = {...(x.frame || {}), opacity:[...keys, [n, 1], [r6(n + DIS), 0, 'inOutSine']].filter((k, i, a) => !i || k[0] > a[i - 1][0])};
      x.len = r6(n + DIS);
    }
  };
  for (const [a, b] of [['arrive', 'join'], ['join', 'circle'], ['circle', 'choir'], ['choir', 'drift'], ['choir', 'rise'], ['drift', 'rise'], ['bloom', 'leave']]) handoff(a, b);

  const edl = merge(createEDL({format, loop:true, seed, track:plan.track, board, transports, camera, boardMoves, overrides}), ...patches);
  for (const x of edl.clips) {
    for (const key of Object.keys(x)) if (x[key] === undefined) delete x[key];
    if (x.chrome) for (const key of Object.keys(x.chrome)) if (x.chrome[key] === undefined) delete x.chrome[key];
  }
  return edl;
}
