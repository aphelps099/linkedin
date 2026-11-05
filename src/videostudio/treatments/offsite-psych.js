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
import {hitAt, ladyTime, cutFrame, barSteps, beatSteps, stepTime, stepAtTime, hitFrame} from '../edl/anchors.js';
import {shotIndex, isSynergy, isInstrument, resolveCrop, UPSCALE, TRACKING, layerMatrix, invert, apply} from '../edl/compile.js';
import {cellRect, cellIds, FORMATS, HOME} from '../layouts.js';
import {layerGain, riverTrack, riverAt} from '../../pegboard/psych.js';
import {LADY_TABLE} from '../../allhands/lady-table.js';
import {TRACKS} from '../../allhands/songbook/index.js';
import {landmarks, coldOpen, ending, r6, BOARD_MOVE, speakingKeys} from './shared.js';

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

export function offsitePsych(plan, shots, {format = '9:16', features, seed = 11, notes} = {}) {
  // The river (wander.js) has no ladder, choke, impact or tape stop: it is cut from its layers (below).
  if (plan.form === 'wander') return riverCut(plan, shots, {format, features, seed, notes});
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

// ==== The river (plan.form 'wander', allhands/wander.js): Offsite's film since Nov 5 ========================================
// Aaron: "a natural river of electronic sound": repeating samples building into a texture, layers ramping in,
// a flow that gently changes, very few clear vocal phrases. The picture flows the same way. There is no ladder,
// choke, impact or tape stop: the cut is built from the plan's own layers (plan.layers: each layer's ramp-in is
// a picture easing in), its swells, its slow spans and its one or two clear phrases (plan.band), the only sharp
// moments.
//   - The call fills as the river does: a tile for each voice of the texture (the loop of hands and the office,
//     the drone's slow glass, Pat humming the root, Strategy's word, her syllables as her waveform, a listener
//     for each acoustic colour), each easing in from black through the dot grid over its layer's own ramp and
//     out over its ramp out. The layout grows with the layers sounding (split, G4, G6, G9) and shrinks as they
//     leave, on a bar line by a long dissolve, never under Synergy or a clear phrase.
//   - Repeating samples: a tile's next shot dissolves in over a beat on an "and", two bars on; an empty tile
//     carries a canon copy of another tile's picture, a few steps behind (one decode for both).
//   - Slow motion: R1 footage at half speed, slower in the slow spans (the pool); R0 plates hold where the
//     river slows; Synergy at speed; no instrument plays.
//   - Echo trails as her copies come in, mosaics that breathe as the smear does, a shimmer with the tambourine,
//     pegs blooming out of the board's home in the swells, the palette drifting with the colours' pitch window.
//   - The dot grid: one river look in the board's region all film long (psych.js riverTrack: its light is the
//     layers'), the whole frame as dots while her syllables play alone at the start and the end, and each tile
//     born through the grid as its layer arrives.
//   - The clear phrases: the speaker's tile (Strategy, Synthia, or her waveform: never a face) cuts sharp on
//     the first word, at speed and without effects, its border lit on the words, as the board's type lands;
//     then it sinks back into the stream as its last word loops (the echo layer). Synergy sings his hook once,
//     washed, at speed, fully up while he sings.
export const RIVER = Object.freeze({relayout:12, change:4, every:2, half:.5, pool:.3, enter:8, copy:.72});
export const RIVER_CLASSES = Object.freeze(['split', 'G4', 'G6', 'G9']);
export const RIVER_LANES = Object.freeze({
  room:['the-professionals-arrive', 'people-linkedin-computer', 'banner-installation-blank-plates', 'printer-outward-feed'],
  listen:['people-listening', 'linda-listening', 'arjun-listening', 'people-speaking', 'linda-speaking', 'arjun-speaking'],
  strategy:['strategy-listening', 'strategy-speaking'], synthia:['synthia-clean-face-plate', 'synthia-conference-closeup'],
});
const LADY_NAME = 'Circle Back';
const RIVER_SECTIONS = ['source', 'stream', 'current', 'swell', 'pool', 'delta'];
for (const s of RIVER_SECTIONS) for (const k of ['', '2', '3']) SCENE_LABELS[`${s}${k}`] = `${s[0].toUpperCase()}${s.slice(1)}${k ? ` ${k}` : ''}`;
SCENE_LABELS.river = 'The river';

function riverCut(plan, shots, {format = '9:16', features, seed = 11, notes} = {}) {
  const BS = barSteps(plan), QS = beatSteps(plan), T = s => stepTime(plan, s), S = t => stepAtTime(plan, t), NS = plan.totalSteps;
  const F = FORMATS[format], H = HOME[format], index = shotIndex(shots), note = m => { if (Array.isArray(notes)) notes.push(m); };
  const layers = plan.layers || [], loops = new Map((plan.loops || []).map(l => [l.id, l])), clamp01 = x => Math.max(0, Math.min(1, x));
  const smooth = u => { const x = clamp01(u); return x * x * (3 - 2 * x); };
  const gainOf = (L, s) => clamp01(layerGain(plan, L, T(Math.max(0, Math.min(NS, s)))) / (L.level || 1));
  const levelOf = (Ls, s) => Ls.reduce((m, L) => Math.max(m, gainOf(L, s)), 0);
  const ceiling = (id, cell) => { const s = index.get(id), r = cellRect(format, cell); if (!s || !r) return 0; return (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, format, r).h / r.h; };
  const usable = id => { const s = index.get(id); return !!s && s.status !== 'E' && s.status !== 'R'; };
  const and = s => s + (((QS / 2 - s) % QS) + QS) % QS;
  const sh = id => `shot:${id}`;
  const clips = [], board = [{id:'song', at:0, text:{ref:'song'}}];

  // ---- time: the slow spans, rates, in points ------------------------------------------------------------------
  const slows = (plan.slow || []).map(w => [S(w.from), S(w.to)]).filter(([a, b]) => b > a);
  const slowAt = s => slows.some(([a, b]) => s >= a && s < b);
  const rateOf = (at, len, base, low) => {
    const keys = [[0, slowAt(at) ? low : base]];
    for (const [a, b] of slows) {
      if (b <= at || a >= at + len) continue;
      if (a > at) keys.push([r6(a - at), base], [r6(Math.min(len, a - at + QS)), low, 'inOutSine']);
      if (b < at + len) keys.push([r6(b - at), low], [r6(Math.min(len, b - at + QS)), base, 'inOutSine']);
    }
    const k = keys.filter((x, i) => !i || x[0] > keys[i - 1][0]);
    return k.length === 1 ? k[0][1] : k;
  };
  const secs = (at, len) => T(at + len) - T(at);
  const peak = rate => typeof rate === 'number' ? rate : Math.max(...rate.map(k => k[1]));
  // A shot's time over a slot: R1 slowed (base, `low` in the slow spans); R0 at speed, holding its frame where
  // the river slows; the in point from the seed, with room for the dissolve after the slot.
  const timeOf = (id, at, len, k, {base = RIVER.half, low = RIVER.pool, speed = false} = {}) => {
    const s = index.get(id), fps = s.fps || 24, room = s.duration - 2 / fps, r = rng(seed * 7919 + k * 104729 + Math.floor(at * 4));
    if (s.reverseClass !== 'R1' || isInstrument(s) || speed) {
      const w = slows.find(([a, b]) => b > at && a < at + len), hold = !speed && s.reverseClass !== 'R1' && w ? r6(Math.max(0, w[0] - at)) : null;
      const used = Math.min(secs(at, len + RIVER.change), hold !== null ? secs(at, hold) + 2 / fps : Infinity), spare = room - used;
      return {in:spare > 0 ? Math.round(r() * spare * fps) / fps : 0, ...(hold !== null ? {freezeAt:hold} : {})};
    }
    const rate = rateOf(at, len + RIVER.change, base, low), spare = room - peak(rate) * secs(at, len + RIVER.change);
    if (spare < 0) return {in:0, rate:r6(Math.max(.25, Math.min(base, room / secs(at, len + RIVER.change))))};
    return {in:Math.round(r() * spare * fps) / fps, rate};
  };

  // ---- the drifts: the palette with the colours' pitch window, the shimmer, the copies, the smear, the swells ---
  const win = (plan.drifts || []).find(d => d.param === 'window')?.points ?? [];
  const lo = win.length ? Math.min(...win.map(p => p[1])) : 0, hi = win.length ? Math.max(...win.map(p => p[1])) : 1;
  const hueAt = s => {
    if (!win.length) return r6(2 * clamp01(s / NS));
    const t = T(s); let i = 1; while (i < win.length - 1 && win[i][0] < t) i++;
    const [a, x] = win[i - 1], [b, y] = win[i], v = x + (y - x) * clamp01((t - a) / Math.max(1e-9, b - a));
    return r6(2 * (v - lo) / Math.max(1e-9, hi - lo));
  };
  const byKind = k => layers.filter(L => L.kind === k);
  const voiceOf = L => loops.get(L.source)?.voice;
  const echoes = layers.filter(L => /-echo$/.test(L.source ?? L.id));
  const texture = layers.filter(L => L.kind === 'texture' && !echoes.includes(L));
  const copiesL = texture.filter(L => L.source === 'her' && L.id !== 'her'), smearL = texture.filter(L => /smear/.test(L.id)), tambL = byKind('tambourine');
  const swellAt = s => (plan.swells || []).reduce((m, w) => { const t = T(s); return t > w.from && t < w.to ? Math.max(m, Math.sin(Math.PI * (t - w.from) / (w.to - w.from))) : m; }, 0);
  // Keys every `step` steps over [at, at + len]; a run of equal values keeps only its ends (one value: a number).
  const keyed = (at, len, fn, step = 2, ease = 'linear') => {
    const keys = [];
    for (let k = 0; k <= len + 1e-9; k = Math.min(len, k + step)) { keys.push([r6(k), r6(fn(at + k, k)), ...(keys.length ? [ease] : [])]); if (k >= len - 1e-9) break; }
    const out = keys.filter((x, i) => i === 0 || i === keys.length - 1 || x[1] !== keys[i - 1][1] || x[1] !== keys[i + 1]?.[1]);
    return out.every(x => x[1] === out[0][1]) ? out[0][1] : out;
  };
  const homeC = {cx:r6((H.x + H.w / 2) / F.w), cy:r6((H.y + H.h / 2) / F.h)};
  const wash = (at, len, mix) => ({type:'paletteWash', mix, hue:keyed(at, len, hueAt, 4 * QS)});
  // The stream's look on a tile: mosaics breathing with the voices and the smear, echo trails with her copies,
  // the tambourine's shimmer, pegs blooming in the swells (and out of which a tile resolves as it enters).
  const stream = (at, len, {mix = .5, fold:fd, enter = null, k = 0} = {}) => [
    ...(fd ? [{type:'radialFold', wedges:fd, angle:[[0, 17 * k], [r6(len), 17 * k + (k % 2 ? -30 : 30)]]}] : []),
    {type:'breathe', px:{add:[{bind:'voices', scale:7, base:-1, attack:.03, release:.25}, {bind:'clap', scale:4, attack:0, release:.2}, keyed(at, len, s => 7 * levelOf(smearL, s), QS)]}},
    wash(at, len, mix),
    {type:'trail', taps:3, frames:2, decay:{add:[{bind:'clap', scale:.22, attack:0, release:.3}, keyed(at, len, s => .42 * levelOf(copiesL, s), QS)]}},
    {type:'chromaDrift', px:keyed(at, len, s => r6(2.5 * levelOf(tambL, s)), QS), angle:[[0, 40 * k], [r6(len), 40 * k + 35]], radial:1.5},
    {type:'pegBloom', amount:keyed(at, len, s => Math.max(enter === null ? 0 : .85 * (1 - smooth((s - enter) / RIVER.enter)), .4 * swellAt(s)), 1), ...homeC, space:'frame', band:.12, pitch:12, levels:6, gamma:.8},
  ];

  // ---- the lanes: the voices of the texture, each a tile -------------------------------------------------------
  // {id, Ls (the layers it follows), from, to (steps), prio, pref ('top' | 'bottom' | 'any'), pool | asset, ...}
  const lanes = [];
  const spanOf = Ls => [Math.max(0, Math.min(...Ls.map(L => S(L.in[0])))), Math.min(NS, Math.max(...Ls.map(L => S(L.out[1]))))];
  const addLane = (id, Ls, o) => { if (!Ls.length) return null; const [from, to] = spanOf(Ls); if (to - from < BS) return null; const x = {id, Ls, from, to, level:s => levelOf(Ls, s), ...o}; lanes.push(x); return x; };
  addLane('room', byKind('loop'), {prio:2, pref:'top', pool:RIVER_LANES.room.filter(usable), what:'the loop of hands and the office'});
  addLane('glass', byKind('drone'), {prio:3, pref:'any', pool:CAST.still.filter(id => usable(id) && index.get(id).mirrorable), fold:true, what:'the drone: a slow kaleidoscope'});
  addLane('pat', byKind('bass'), {prio:4, pref:'bottom', asset:PAT, chrome:{name:'Pat', mic:'on', speaking:{bind:'stem:bass', scale:1.4, base:-.35, attack:.05, release:.6}}, what:'Pat humming the root'});
  const strat = addLane('strategy', texture.filter(L => voiceOf(L) === 'strategy'), {prio:5, pref:'any', pool:RIVER_LANES.strategy.filter(usable), what:'Strategy’s word, looped'});
  // The acoustic colours: two listeners, the colours split by when they come in (one decode each).
  const colours = [...byKind('colour'), ...byKind('guitar')].sort((a, b) => a.in[0] - b.in[0]), half = Math.ceil(colours.length / 2);
  [colours.slice(0, half), colours.slice(half)].forEach((Ls, k) => addLane(`listen${k}`, Ls, {prio:6 + k, pref:'any', pool:[...RIVER_LANES.listen.slice(3 * k), ...RIVER_LANES.listen.slice(0, 3 * k)].filter(usable), what:`a listener for the ${Ls.map(L => L.id).join(' and the ')}`}));
  const her = addLane('her', texture.filter(L => voiceOf(L) === 'lady'), {prio:20, pref:'bottom', lastRow:true, asset:PAT, chrome:{name:LADY_NAME, mic:'on', speaking:{bind:'stem:lady', scale:1.3, base:-.2, attack:.02, release:.25}}, what:'her syllables: her waveform, never a face'});
  // Synergy: his hook once, washed; in over the bar before he sings, out over the bar after.
  const hisWords = (plan.words || []).filter(w => w.at >= 0).sort((a, b) => a.at - b.at);
  let synergy = null;
  if (hisWords.length) {
    const w0 = hisWords[0].at, w1 = Math.max(...hisWords.map(w => w.at + (w.steps ?? 1))), from = Math.max(0, Math.floor((w0 - 2 * BS) / BS) * BS), full = w0 - QS, out = w1 + QS, to = Math.min(NS, out + BS);
    const id = ['synergy-camera-v2-listening', CAST.synergy, CAST.synergyClose].find(usable);
    synergy = {id:'synergy', Ls:[], from, to, prio:0, pref:'top', pool:[id], whole:true, over:true, level:s => s < full ? smooth((s - from) / Math.max(1, full - from)) : s <= out ? 1 : 1 - smooth((s - out) / Math.max(1, to - out)), sings:[w0, w1], what:'Synergy sings his hook, once, washed'};
    lanes.push(synergy);
  }
  // The clear phrases: the speaker's tile, sharp on the words, then sinking back in with its echo.
  const speakers = (plan.band || []).filter(b => b.clear !== false && b.words?.length).map((b, k) => {
    const echo = echoes.find(L => (L.source ?? L.id) === `${b.role}-echo`), cut = Math.max(0, hitFrame(b.words[0].start, plan) - 1);
    // Sharp from a frame before the frame that holds the first word to the first "and" a half beat after the last.
    const sharp = [r6(S(cut / 24)), r6(Math.min(NS, and(S(b.words.at(-1).end) + QS / 2)))];
    const from = Math.max(0, Math.floor((S(b.rise?.[0] ?? b.start) - BS) / BS) * BS + QS / 2), to = Math.min(NS, Math.max(echo ? S(echo.out[1]) : 0, S(b.sink?.[1] ?? b.end) + BS));
    const pool = b.voice === 'lady' ? null : (RIVER_LANES[b.voice] || []).filter(usable);
    // (Held: no re-layout from its first bar to two beats after its last word; it may sink across one after.)
    const x = {id:`speaker${k}`, Ls:echo ? [echo] : [], part:b, from, to, sharp, hold:[from, Math.min(NS, sharp[1] + 2 * QS)], prio:1, pref:'top', over:true, voice:b.voice,
      ...(b.voice === 'lady' ? {asset:PAT, chrome:{name:LADY_NAME, mic:'on'}} : {pool, chrome:{name:{strategy:'Strategy', synthia:'Synthia'}[b.voice] ?? b.voice, mic:'on'}}),
      level:s => s < sharp[0] ? .35 + .65 * smooth((s - from) / Math.max(1, sharp[0] - from)) : s <= sharp[1] + 2 * QS ? 1 : echo ? Math.max(.4 * (1 - smooth((s - sharp[1] - 2 * QS) / BS)), gainOf(echo, s)) : 1 - smooth((s - sharp[1] - 2 * QS) / (2 * BS)),
      what:`${b.voice === 'lady' ? 'her waveform' : b.voice} sings "${b.display}" clear`};
    lanes.push(x);
    return x;
  }).filter(x => x.voice === 'lady' || x.pool?.length);
  // Strategy's stream tile and her waveform hand over to their clear phrase: one tile each.
  for (const sp of speakers) for (const l of [sp.voice === 'strategy' ? strat : null, sp.voice === 'lady' ? her : null]) if (l && l.to > sp.from && l.from < sp.to) {
    if (sp.from - l.from >= BS) l.to = Math.min(l.to, sp.from + RIVER.change); else if (l.to - sp.to >= BS) l.from = Math.max(l.from, sp.to); else lanes.splice(lanes.indexOf(l), 1);
  }

  // ---- the scenes: the layout grows and shrinks with the layers sounding --------------------------------------------
  const nb = Math.ceil(NS / BS);
  const density = Array.from({length:nb}, (_, b) => layers.filter(L => gainOf(L, Math.min(NS, b * BS + BS / 2)) > .3).length);
  const cls = density.map((n, b) => Math.max(0, (n <= 3 ? 0 : n <= 7 ? 1 : n <= 11 ? 2 : 3) - (slowAt(b * BS + BS / 2) ? 1 : 0)));
  // Held still under Synergy and each clear phrase: the class of the bar he (or it) sings in.
  for (const l of [synergy, ...speakers].filter(Boolean)) {
    const [h0, h1] = l.hold ?? [l.from, l.to], a = Math.floor(h0 / BS), b = Math.min(nb - 1, Math.floor((h1 - 1e-9) / BS)), k = cls[Math.min(nb - 1, Math.floor((l.sings?.[0] ?? l.sharp[0]) / BS))];
    for (let i = a; i <= b; i++) cls[i] = k;
  }
  const runs = [];
  for (let b = 0; b < nb; b++) { const r = runs.at(-1); if (r && r.k === cls[b]) r.to = b + 1; else runs.push({k:cls[b], from:b, to:b + 1}); }
  // A run under two bars joins the one before it (never the first or the last).
  for (let i = 1; i < runs.length - 1; i++) if (runs[i].to - runs[i].from < 2) { runs[i - 1].to = runs[i].to; runs.splice(i, 1); i--; if (runs[i + 1] && runs[i + 1].k === runs[i].k) { runs[i].to = runs[i + 1].to; runs.splice(i + 1, 1); } }
  const used = new Map();
  const scenes = runs.map(r => {
    const from = r.from * BS, to = Math.min(NS, r.to * BS), sec = (plan.sections || []).map(s => ({s, o:Math.min(to, s.to * BS) - Math.max(from, s.from * BS)})).sort((a, b) => b.o - a.o)[0]?.s;
    const base = RIVER_SECTIONS.includes(String(sec?.name).toLowerCase()) ? String(sec.name).toLowerCase() : 'river', n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return {id:n > 1 && base !== 'river' ? `${base}${Math.min(n, 3)}` : base, cls:RIVER_CLASSES[r.k], from, to};
  });

  // ---- the tiles: each scene's lanes in its cells, the most important first ---------------------------------------
  const cellsOf = k => cellIds(k, format).map(id => ({id, r:cellRect(format, id)})).sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);
  const freeIn = (list, a, b) => { const out = []; let x = a; for (const [p, q] of [...list].sort((u, v) => u[0] - v[0])) { if (q <= x) continue; if (p > x) out.push([x, Math.min(p, b)]); x = Math.max(x, q); if (x >= b) break; } if (x < b) out.push([x, b]); return out.filter(([p, q]) => q - p > 1e-9); };
  const holds = (l, cell) => l.asset || l.pool.some(id => ceiling(id, cell) >= 1.04 - 1e-9);
  const placed = [];
  for (const sc of scenes) {
    const cells = cellsOf(sc.cls), busy = new Map(cells.map(c => [c.id, []])), overs = new Map(cells.map(c => [c.id, []])), lastRow = Math.max(...cells.map(c => c.r.y));
    for (const l of lanes.filter(l => l.from < sc.to && l.to > sc.from).sort((a, b) => a.prio - b.prio)) {
      // A lane enters and leaves on an "and" (its first scene's first bar line aside).
      const a = l.from <= sc.from ? sc.from : Math.min(sc.to, and(l.from)), b = l.to >= sc.to ? sc.to : Math.min(sc.to, and(l.to));
      if (b - a < (l.whole || l.hold ? 1 : BS)) continue;
      const need = l.hold ? [Math.max(a, l.hold[0]), Math.min(b, l.hold[1])] : null;
      const order = l.pref === 'top' ? cells : l.pref === 'bottom' ? [...cells].reverse().filter(c => !l.lastRow || c.r.y === lastRow) : [...cells.slice(1), cells[0]];
      // Synergy and the clear phrases are laid over a top tile (whatever plays there plays on under them).
      if (l.over) {
        const c = order.find(c => holds(l, c.id) && !overs.get(c.id).some(([p, q]) => p < b && q > a));
        if (!c) { note(`${sc.id} (${sc.cls}): no tile for ${l.id} (${l.what})`); continue; }
        overs.get(c.id).push([a, b]);
        placed.push({l, sc, cell:c.id, from:a, to:b, over:true});
        continue;
      }
      let best = null;
      for (const c of order) {
        if (!holds(l, c.id)) continue;
        const iv = freeIn(busy.get(c.id), a, b).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]) || x[0] - y[0])[0];
        if (!iv) continue;
        if (iv[0] === a && iv[1] === b) { best = {c, iv}; break; }
        if (need && !(iv[0] <= need[0] + 1e-9 && iv[1] >= need[1] - 1e-9)) continue;
        if (!l.whole && iv[1] - iv[0] >= BS && (!best || iv[1] - iv[0] > best.iv[1] - best.iv[0] + 1e-9)) best = {c, iv};
      }
      if (!best) { note(`${sc.id} (${sc.cls}): no tile for ${l.id} (${l.what})`); continue; }
      busy.get(best.c.id).push(best.iv);
      placed.push({l, sc, cell:best.c.id, from:best.iv[0], to:best.iv[1]});
    }
    // A tile left empty the whole scene carries a canon copy of another tile's picture, a few steps behind
    // (the same clips, one decode for both), the glass first.
    const sources = placed.filter(p => p.sc === sc && !p.over && (p.l.id === 'glass' || p.l.id === 'room') && p.from === sc.from && p.to === sc.to).sort((x, y) => (x.l.fold ? 0 : 1) - (y.l.fold ? 0 : 1) || x.l.prio - y.l.prio);
    let j = 0;
    for (const c of cells) {
      if (busy.get(c.id).length || !sources.length) continue;
      const src = sources.filter(q => holds(q.l, c.id))[j % sources.length] ?? sources.find(q => holds(q.l, c.id));
      if (!src) continue;
      busy.get(c.id).push([sc.from, sc.to]);
      placed.push({l:src.l, sc, cell:c.id, from:sc.from, to:sc.to, copy:2 + (j % 2), of:src});
      j++;
    }
  }

  // ---- the clips ---------------------------------------------------------------------------------------------------
  // A placement plays its lane's shots in turn (the next dissolving in over a beat on an "and", RIVER.every bars
  // on, staggered tile by tile so the call changes one tile at a time), its opacity the lane's level (the layers'
  // ramps) times the dissolves. Across a re-layout a lane carries on: the incoming tile continues the outgoing
  // one's shot and source time and fades in over RIVER.relayout steps while the outgoing one plays on under it
  // and fades (one decode for both).
  const easeOf = (e, u) => e === 'inOutSine' ? (1 - Math.cos(Math.PI * u)) / 2 : e === 'step' ? (u >= 1 ? 1 : 0) : u;
  const rateAt = (keys, u) => { if (u <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * easeOf(keys[i][2], (u - keys[i - 1][0]) / Math.max(1e-9, keys[i][0] - keys[i - 1][0])); return keys.at(-1)[1]; };
  // Source seconds a clip shows u steps after its start (its rate integrated; a hold stops it).
  const srcAt = (x, u) => {
    const t = x.time || {}, r = t.rate ?? 1, end = Math.min(u, typeof t.freezeAt === 'number' ? t.freezeAt : Infinity);
    if (typeof r === 'number') return (t.in ?? 0) + r * secs(x.at, end);
    let v = t.in ?? 0; const n = Math.max(1, Math.ceil(end * 32));
    for (let i = 0; i < n; i++) { const p = end * i / n, q = end * (i + 1) / n; v += rateAt(r, (p + q) / 2) * secs(x.at + p, q - p); }
    return v;
  };
  const continues = p => placed.find(q => q !== p && q.l === p.l && !q.copy && !p.copy && q.sc !== p.sc && Math.abs(q.to - p.from) < 1e-9) ?? null;
  const goesOn = p => placed.some(q => q !== p && q.l === p.l && !q.copy && !p.copy && q.sc !== p.sc && Math.abs(p.to - q.from) < 1e-9);
  // A lane's next shot: its pool in turn, the first that holds the cell and that no other tile shows meanwhile.
  const showing = [];
  const pick = (l, cell, k, a, b, zoom = 1.04) => {
    const ok = l.pool.filter(id => ceiling(id, cell) >= zoom - 1e-9), n = ok.length;
    for (let j = 0; j < n; j++) { const id = ok[(((k + j) % n) + n) % n]; if (!showing.some(x => x.id === id && x.l !== l && x.a < b && x.b > a)) return id; }
    return n ? ok[((k % n) + n) % n] : null;
  };
  const clipsOf = new Map();
  let nClip = 0;
  for (const p of placed.filter(q => !q.copy)) {
    const {l, sc, cell} = p, pred = continues(p), tail = goesOn(p) ? RIVER.relayout : 0, out = [];
    const cells = cellIds(sc.cls, format), stagger = Math.round(cells.indexOf(cell) * RIVER.every * BS / Math.max(1, cells.length) / QS) * QS;
    // The pieces: [at, to, mode] ('soft': the stream; 'sharp': a clear phrase's words; 'after': sinking back in).
    const pieces = [];
    if (l.sharp) {
      const [s0, s1] = l.sharp;
      if (s0 > p.from) pieces.push([p.from, Math.min(p.to, s0), 'soft']);
      if (s1 > p.from && s0 < p.to) pieces.push([Math.max(p.from, s0), Math.min(p.to, s1), 'sharp']);
      if (p.to > s1) pieces.push([Math.max(p.from, s1), p.to, 'after']);
    } else if (l.asset || l.whole) pieces.push([p.from, p.to, 'soft']);
    else {
      let a = p.from;
      for (let i = 1; i < 64; i++) { const c = and(p.from + stagger + i * RIVER.every * BS - QS); if (c >= p.to - BS) break; if (c - a >= BS) { pieces.push([a, c, 'soft']); a = c; } }
      pieces.push([a, p.to, 'soft']);
    }
    // Carried across a re-layout: the first piece lasts only as long as the outgoing shot's source does (then
    // the next shot dissolves in on an "and"), so the incoming tile can carry on from it.
    const before = pred ? clipsOf.get(pred)?.at(-1) : null;
    if (before?.asset.startsWith('shot:') && pieces[0]?.[2] !== 'sharp' && !l.asset && l !== synergy) {
      const sct = index.get(before.asset.slice(5)), left = sct.duration - 2 / (sct.fps || 24) - srcAt(before, pieces[0][0] - before.at), [a0, b0, m0] = pieces[0];
      let n = 0; while (a0 + n + QS <= b0 && RIVER.half * secs(a0, n + QS + RIVER.change) <= left) n += QS;
      const c = and(a0 + n - QS);
      if (c < b0 - QS && c - a0 >= RIVER.relayout + QS) pieces.splice(0, 1, [a0, c, m0], [c, b0, m0]);
    }
    pieces.forEach(([a, b, mode], i) => {
      const next = pieces[i + 1], ext = !next ? tail : mode === 'sharp' ? 2 * QS : next[2] === 'sharp' ? 0 : RIVER.change;
      const len = r6(b - a + ext), id = `${sc.id}.${l.id}.${i}`;
      const din = i === 0 ? (pred ? RIVER.relayout : 0) : mode === 'sharp' ? 0 : mode === 'after' ? 2 * QS : RIVER.change;
      // (A tile that enters from black after the film's first frame starts at no light, over a beat at least.)
      const enters = i === 0 && !pred && a > 0 ? QS : 0;
      const opacity = mode === 'sharp' ? 1 : keyed(a, len, (s, u) => clamp01(l.level(s)) * (din ? smooth(u / din) : 1) * (enters ? smooth(u / enters) : 1) * (ext && u > b - a + 1e-9 ? 1 - smooth((u - (b - a)) / ext) : 1), 2);
      const x = {id, at:r6(a), len, cell, ...(p.over ? {z:1} : {}), scene:sc.id};
      if (l.asset) {
        x.asset = l.asset;
        x.chrome = {...l.chrome, ...(l.part ? {speaking:speakingKeys(l.part.words, T(a))} : {})};
        x.why = l.part ? (mode === 'sharp' ? `${l.what}: the sharp moment, her waveform at full on her words, cut on the first` : mode === 'after' ? `${l.what}: sinking back into the stream` : l.what) : l.what;
      } else {
        const prev = i === 0 && pred ? clipsOf.get(pred)?.at(-1) : mode === 'after' ? out.at(-1) : null;
        const carry = prev && prev.asset.startsWith('shot:') && ceiling(prev.asset.slice(5), cell) >= 1 - 1e-9 ? prev.asset.slice(5) : null;
        const shot = l === synergy ? l.pool[0] : carry ?? pick(l, cell, l.prio * 3 + i + (l.part ? 0 : Math.floor(a / BS)), a, a + len);
        if (!shot) return;
        x.asset = sh(shot);
        showing.push({id:shot, l, a, b:a + len});
        const k = nClip++, key = l.prio * 1000 + Math.round(a * 4), opts = l === synergy ? {base:1, low:.5} : mode === 'sharp' ? {speed:true} : {};
        const t = timeOf(shot, a, len, key, opts);
        if (carry) {
          // Carry on from the outgoing tile's source time (the sinking tile from the sharp one, slowing over two beats).
          const from = srcAt(prev, a - prev.at), s = index.get(shot), rate = mode === 'after' && i > 0 ? [[0, 1], [2 * QS, RIVER.half, 'inOutSine']] : t.rate;
          if (from + peak(rate ?? 1) * secs(a, len) <= s.duration - 2 / (s.fps || 24)) { t.in = r6(from); if (rate !== undefined) t.rate = rate; }
        }
        x.time = t;
        if (l === synergy) {
          x.fx = [wash(a, len, .2)];
          x.chrome = {mic:'on', speaking:{bind:'stem:voice', scale:1.5, base:-.3, attack:.02, release:.3}};
          x.why = l.what;
        } else if (mode === 'sharp') {
          x.chrome = {...l.chrome, speaking:speakingKeys(l.part.words, T(a))};
          x.why = `${l.what}: the sharp moment, at speed and without effects, cut on the first word`;
        } else {
          x.fx = stream(a, len, {mix:l.part ? .45 : .55, fold:l.fold && index.get(shot)?.mirrorable ? [6, 8, 6, 10, 12][(k + i) % 5] : 0, enter:i === 0 && !pred ? Math.max(a, l.from) : null, k});
          if (l.chrome) x.chrome = {...l.chrome, ...(l.part ? {speaking:0} : {})};
          x.why = `${l.what}${mode === 'after' ? ': sinking back into the stream' : pred && i === 0 ? ': carried across the re-layout' : ''}`;
        }
      }
      if (opacity !== 1) x.frame = {...(x.frame || {}), opacity};
      out.push(x);
    });
    clipsOf.set(p, out);
    clips.push(...out);
  }
  // The canon copies: the source tile's clips in another tile, a few steps behind and a little dimmer, their own
  // fold and drift (within 12 source frames of the source, so they share its decode).
  for (const p of placed.filter(q => q.copy)) {
    (clipsOf.get(p.of) || []).forEach((y, i) => {
      const s = index.get(y.asset.slice(5)), lag = peak(y.time?.rate ?? 1) * secs(y.at, p.copy), k = nClip++;
      const x = {...y, id:`${y.id}~${p.cell.replace(/\W/g, '')}`, cell:p.cell, time:{...y.time, in:r6(Math.max(0, (y.time?.in ?? 0) - lag))},
        fx:stream(y.at, y.len, {mix:.6, fold:p.l.fold && s?.mirrorable ? [8, 6, 12, 10, 6][(k + i) % 5] : 0, enter:null, k}), why:`${y.why} (a canon copy, ${p.copy} steps behind)`};
      const o = y.frame?.opacity ?? 1;
      x.frame = {...(y.frame || {}), opacity:typeof o === 'number' ? r6(o * RIVER.copy) : o.map(([u, v, e]) => [u, r6(v * RIVER.copy), ...(e ? [e] : [])])};
      clips.push(x);
    });
  }

  // ---- the dot grid ------------------------------------------------------------------------------------------------
  const psych = (id, at, len, look, params = {}, {fade = 4, cell, seed:sd} = {}) => {
    if (!(len >= 4)) return;
    board.push({type:'psych', id:`psych.${id}`, at:r6(at), len:r6(len), look, params, seed:sd ?? board.length, fade:Math.max(2, Math.min(fade, Math.floor(len / 2))), ...(cell ? {cell} : {})});
  };
  // The board's region, all film long: the river's look, its light the layers' (as the stage paints it), half
  // speed in the slow spans.
  const river = riverTrack(plan, {features});
  psych('river', 0, NS, river.look, {level:keyed(0, NS, s => r6(riverAt(river, T(s)).spec.params.level), QS), speed:keyed(0, NS, s => slowAt(s) ? .5 : 1, QS, 'inOutSine'), breath:.7}, {fade:8, seed:river.seed});
  // The whole frame as dots while her syllables play alone, at the start and the end (never with Synergy up).
  const alive = s => lanes.filter(l => !l.part && l !== synergy && l.level(s) >= .5).length;
  let open = 0; while (open < Math.min(4 * BS, NS / 3) && alive(open) < 2) open += QS;
  open = Math.min(Math.ceil((open + BS) / BS) * BS, synergy ? synergy.from : Infinity);
  let close = NS; while (close > NS - 4 * BS && alive(close - 1) < 2) close -= QS;
  close = Math.max(Math.floor((close - BS) / BS) * BS, synergy ? synergy.to : 0, ...speakers.map(x => x.hold[1] + BS));
  const herLv = s => Math.max(.35, levelOf(texture.filter(L => voiceOf(L) === 'lady'), s));
  if (open >= 2 * BS) psych('source', 0, open, river.look, {level:keyed(0, open, s => r6(.85 * herLv(s)), QS), speed:.5, breath:1}, {cell:'full', fade:Math.min(BS, open / 3), seed:river.seed});
  if (NS - close >= 2 * BS) psych('delta', close, NS - close, river.look, {level:keyed(close, NS - close, s => r6(.85 * herLv(s)), QS), speed:.5, breath:1}, {cell:'full', fade:Math.min(BS, (NS - close) / 3), seed:river.seed});
  // Each tile born through the grid: the footage as dots over its layer's ramp in, until it has resolved.
  const born = new Set();
  for (const p of placed) {
    if (p.copy || p.over || p.l.asset || born.has(p.l) || continues(p)) continue;
    born.add(p.l);
    const a = Math.max(p.from, and(p.l.from)), b = Math.min(p.to, a + 2 * BS, p.sc.to);
    let full = a; while (full < b && p.l.level(full) < .9) full += 1;
    // (It ends half a frame before the frame that cuts at its tile's end, so it never outlives the tile.)
    const end = Math.min(b, Math.max(a + 2 * QS, full + QS)), len = Math.min(end, S((cutFrame(T(Math.min(p.to, p.sc.to))) - .5) / 24)) - a;
    const under = placed.some(q => q.over && q.cell === p.cell && q.sc === p.sc && q.from < a + len && q.to > a);
    if (a >= open - QS && a < close && !under) psych(`born.${p.l.id}`, a, len, 'footage', {sharpen:1.1, colour:1, level:.9}, {cell:p.cell, fade:Math.min(6, Math.floor(len / 3))});
  }

  const edl = merge(createEDL({form:'wander', format, loop:true, seed, track:plan.track, board, transports:[], camera:[], boardMoves:[], overrides:[]}), {clips});
  for (const x of edl.clips) {
    for (const key of Object.keys(x)) if (x[key] === undefined) delete x[key];
    if (x.chrome) for (const key of Object.keys(x.chrome)) if (x.chrome[key] === undefined) delete x.chrome[key];
  }
  note(`scenes ${scenes.map(s => `${s.id} ${s.cls} ${s.from / BS}-${s.to / BS}`).join(', ')}`);
  return edl;
}
