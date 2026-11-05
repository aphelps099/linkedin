// "Offsite, psychedelic": the team retreat's film, cut for voices and claps rather than bass drops
// (Aaron: "more of a panda bear style song... the video may be a bit more psychedelic pixelation").
// The call is still the call, and every rule of the Drop Edition holds (the cold open, the board
// home, the choke's true black, the ignition, the tape stop and the ghost BACK.), but the picture
// breathes: mosaics swell with the voices and the claps, the footage washes into Peg Board duotones
// that drift blue to violet to warm, trails smear motion on the backbeat, mirrorable close-ups fold
// into kaleidoscopes, and the footage turns into pegs that bloom out of the board's home.
//
//   const plan = FORMS.drop60.arrange(lyrics, durations, {track:'offsite', cast, coldOpen:true});
//   const edl = offsitePsych(plan, SHOTS, {format:'9:16'});
//   compile(edl, {plan, shots:SHOTS}).lint.errors   // []
//
// Pure: the same plan, shots and format give the same EDL. Every passage hangs off the plan's own
// landmarks (sections, the unmute, Synergy's lines, the ladder rung by rung, the claps as the band
// plays them, the choke, the impact, Sink In's "in", the tape stop, plan.coldOpen), so it cuts any
// track of the song book; it is chosen for Offsite (treatments/index.js).
//
// Its own cut, scene by scene (layout class in brackets):
//   arrive [split]  the crew walks in, pixelated, resolving as the call connects; Pat's black tile
//   join [G4]       Synergy joins on the unmute with his welcome; the printer smears on the claps
//   circle [G6]     the verse: Synergy, a listener cut on every other clap, a kaleidoscope pair
//   choir [G9]      the hook: a round of kaleidoscopes in canon around Synergy, like her voices
//   drift [G4]      a second verse, when the track has one
//   rise [G4]       her slow rungs: pegs bloom out of the board home, a step on every retrigger
//   fold [L1]       her quarter notes: one kaleidoscope gains wedges on every retrigger
//   spiral [G6]     her 8ths and 16ths: the kaleidoscopes turn a notch on every hit
//   ladder [full]   her 32nds alone on the board; the choke; true black
//   dropA [full, G6] the ignition: a mandala of pegs; then the clap circle
//   sink [G4]       Sink In: the tape slows the picture, then it melts into big blocks on "in"
//   mandala [L1]    Drop B's first bar: a full-frame kaleidoscope, a new glass on every clap
//   bloom [G9]      pegs bloom out of the board home across the call, Synergy singing in the middle
//   round [G6]      the fill: one picture in canon around the circle ("Read that again.")
//   leave [G4, split, L1]  everyone leaves the offsite as pegs; Synergy alone; the tape stop
import {MOVES} from '../moves/index.js';
import {fitTime} from '../moves/util.js';
import {createEDL, merge} from '../edl/schema.js';
import {backbeatHits} from '../edl/params.js';
import {hitAt, ladyTime} from '../edl/anchors.js';
import {shotIndex, isSynergy, resolveCrop, UPSCALE, TRACKING, layerMatrix, invert, apply} from '../edl/compile.js';
import {cellRect, FORMATS, HOME} from '../layouts.js';
import {LADY_TABLE} from '../../allhands/lady-table.js';
import {landmarks, coldOpen, ending, r6, BOARD_MOVE} from './shared.js';

// Who plays whom. Ids are shot-index aliases. The glass: mirrorable close-ups (never a robot or an
// instrument), the only shots the kaleidoscope folds.
export const CAST = {
  synergy:'synergy-camera-v2-listening', synergyClose:'synergy-enthusiastic-training-close-up',
  crew:'the-professionals-arrive', banner:'banner-installation-blank-plates', printer:'printer-outward-feed',
  people:'people-listening', peopleTalk:'people-speaking', linda:'linda-listening', lindaTalk:'linda-speaking', arjun:'arjun-listening', arjunTalk:'arjun-speaking',
  strategy:'strategy-listening', synthia:'synthia-clean-face-plate', synthiaClose:'synthia-conference-closeup',
  glass:['people-culture-onboarding-v1', 'linda-quarterly-v1', 'arjun-quarterly-v1', 'kevin-standup-v1', 'keys-onboarding-v1', 'people-culture-quarterly-v1', 'operations-quarterly-v1', 'linda-unlock-v2'],
};
const PAT = 'gen:camera-off', BLACK = 'gen:color:#000000';
// A full-frame kaleidoscope is always pixelated, never under PIXEL px blocks: the close-ups are 720p and
// tier C, and the blocks carry the upscale (lint G10 exempts a mosaic of 8 px or more).
const PIXEL = 9;
const sh = id => `shot:${id}`;

// What the monitor's cut list calls each scene.
export const SCENE_LABELS = {cold:'Cold open', arrive:'Arrivals', join:'The call', circle:'The circle', choir:'Choir of glass', drift:'Drift', rise:'Pegs rise',
  fold:'Fold', spiral:'Spiral', ladder:'The board alone', dropA:'Clap circle', sink:'Melt', mandala:'Mandala', bloom:'Bloom', round:'The round', leave:'Leave the offsite'};

// The palette's slow drift over the film (fractions of the plan's length, duotone hue: 0 blue,
// 1 violet, 2 warm). Never green; it never cuts, it drifts.
const HUE = [[0, 0], [.18, .15], [.32, .7], [.45, 1], [.55, 1.2], [.66, 1.7], [.72, 2], [.82, 1.5], [.92, 1.9], [1, 2]];
const speaking = stem => ({bind:`stem:${stem}`, scale:1.5, base:-.3, attack:.02, release:.3});

export function offsitePsych(plan, shots, {format = '9:16', features, seed = 11} = {}) {
  const L = landmarks(plan), {BS, QS, T, impact, chokeBar, choke} = L, F = FORMATS[format], index = shotIndex(shots);
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

  // ---- the plan's landmarks ------------------------------------------------------------------------
  const verse = L.need('Verse'), build = L.need('Build'), dropA = L.need('Drop A'), sinkS = L.need('Sink In'), dropB = L.need('Drop B'), outro = L.need('Outro');
  const linesOf = kind => (plan.lines || []).filter(l => l.kind === kind && l.words.length), startOf = l => l.words[0].at, barOf = s => Math.floor(s / BS) * BS;
  const U = Math.min(L.U, verse.from);
  // The claps as the band plays them (edl/params.js backbeatHits, the late backbeat included); a bar
  // the kit leaves without one keeps its beats 2 and 4, so the picture always has a backbeat.
  const claps = (from, to) => {
    const hits = backbeatHits(plan, from, to).filter(h => h.step >= from && h.step < to);
    if (hits.length) return hits;
    const out = []; for (let s = Math.ceil(from / QS) * QS; s < to; s += QS) if (Math.round((s % BS) / QS) % 2 === 1) out.push({step:s, late:0});
    return out;
  };
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
  const synergyShot = asset => { const s = index.get(String(asset).replace(/^shot:/, '')); return !!s && isSynergy(s); };

  // ---- the cold open: the impact at frame 0, then the rewind with its sound -----------------------------
  {
    const co = coldOpen(plan, L);
    transports.push(...co.transports); boardMoves.push(...co.boardMoves); camera.push(...co.camera);
  }

  // ---- the intro: the crew arrives, pixelated, resolving as the call connects; Pat's black tile ---------------
  const crewIn = time(CAST.crew, 0, verse.from, 1).in ?? 0;
  if (U > 0) add('arrive', [
    c('arrive.crew', 0, U, 'split.0', sh(CAST.crew), {time:{in:crewIn}, chrome:{name:'Lobby', mic:'muted'},
      fx:[{type:'breathe', px:{add:[[[0, 28], [U, 2, 'inOutSine']], {bind:'voices', scale:10, base:-2, attack:.03, release:.25}]}}, wash(0, U, .6)], why:'the crew arrives: pixels that resolve as the call connects, breathing with the room'}),
    c('arrive.pat', 0, U, 'split.1', PAT, {chrome:{mic:'muted'}, why:"Pat's camera is off; the call is connecting"}),
  ]);
  // The unmute: Synergy joins with his welcome; the printer is the shaker, smearing on the claps.
  const host = fit('G4.0', 1.1, CAST.synergy, CAST.synergyClose);
  if (verse.from > U) add('join', [
    c('join.synergy', U, verse.from - U, 'G4.0', sh(host), {time:time(host, U, verse.from - U, 2), frame:{zoom:[[0, 1], [verse.from - U, 1.06, 'linear']]}, fx:[wash(U, verse.from - U, .2)], chrome:{mic:'on', speaking:speaking('voice'), toast:{text:'Synergy joined', at:0, len:QS}}, why:'Synergy joins on the unmute with his welcome'}),
    c('join.crew', U, verse.from - U, 'G4.1', sh(CAST.crew), {time:{in:r6(crewIn + (T(U) - T(0)))}, chrome:{name:'Lobby'}, fx:[breathe(12, 6), wash(U, verse.from - U, .5), trail(2)], why:'the crew carries on, breathing with the voices'}),
    c('join.printer', U, verse.from - U, 'G4.2', sh(CAST.printer), {time:time(CAST.printer, U, verse.from - U, 3), fx:[trail(3, .5, .2), wash(U, verse.from - U, .4)], why:'the printer is the shaker; its pages smear on the claps'}),
    c('join.pat', U, verse.from - U, 'G4.3', PAT, {chrome:{name:'Pat', mic:'on'}, why:"Pat's camera is off"}),
  ]);

  // ---- the verse: the circle ------------------------------------------------------------------------------
  const hook0 = linesOf('hook').find(l => startOf(l) >= verse.from && startOf(l) < build.from);
  const hookAt = hook0 ? Math.max(verse.from + BS, barOf(startOf(hook0))) : Math.min(build.from, verse.from + 4 * BS);
  const hookEnd = Math.min(build.from, hookAt + 2 * BS);
  {
    const V = verse.from, len = hookAt - V, syn = fit('G6.0', 1.08, CAST.synergy, CAST.synergyClose);
    const g0 = glass(seed), gIn = time(g0, V, len, 4);
    add('circle', [
      c('circle.synergy', V, len, 'G6.0', sh(syn), {time:time(syn, V, len, 5), frame:{zoom:[[0, 1], [len, 1.08, 'linear']]}, fx:[wash(V, len, .25)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy sings to the circle (no warp on his face: a light wash only)'}),
      // The kaleidoscope pair: one glass, folded two ways (one decode), turning slowly.
      c('circle.glassA', V, len, 'G6.2', sh(g0), {time:gIn, fx:[fold(len, 6, 0, 45), wash(V, len, .55), breathe(10, 6)], why:'kaleidoscope: a mirrorable close-up in six wedges, turning'}),
      c('circle.glassB', V, len, 'G6.3', sh(g0), {time:gIn, fx:[fold(len, 6, 30, -45), wash(V, len, .55), breathe(10, 6)], why:'its twin, folded the other way'}),
      c('circle.printer', V, len, 'G6.4', sh(CAST.printer), {time:time(CAST.printer, V, len, 6), fx:[trail(3, .5, .2), wash(V, len, .45)], why:'the printer smears on the claps'}),
      c('circle.pat', V, len, 'G6.5', PAT, {chrome:{name:'Pat', mic:'on'}}),
    ]);
    // A listener in G6.1, cut on every other clap (a new face on the backbeat), breathing with his voice.
    const pool = [CAST.people, CAST.linda, CAST.arjun, CAST.strategy, CAST.peopleTalk, CAST.lindaTalk].map(id => fit('G6.1', 1, id, CAST.people));
    const cuts = [V, ...claps(V, hookAt).filter((h, i) => i % 2 === 1).map(h => h.step + h.late)].filter((s, i, a) => !i || s - a[i - 1] >= QS);
    add('circle', cuts.map((s, j) => { const end = cuts[j + 1] ?? hookAt, id = pool[j % pool.length], hit = j ? hitAt(r6(s)) : V;
      return c(`circle.listen${j}`, hit, r6(end - s), 'G6.1', sh(id), {time:time(id, Math.floor(s), Math.max(1, end - s), 10 + j), fx:[breathe(16, 8), wash(Math.floor(s), end - s, .5), trail(3)], why:j ? 'a new listener on the clap, breathing with his voice' : 'the first listener'}); }));
  }

  // ---- the hook: a choir of glass in canon around Synergy ---------------------------------------------------
  {
    const at = hookAt, len = hookEnd - hookAt, syn = fit('G9.4', 1, CAST.synergy, CAST.synergyClose), g = glass(seed + 1), gIn = time(g, at, len + 4, 7);
    const ring = ['G9.0', 'G9.1', 'G9.2', 'G9.5', 'G9.8', 'G9.6', 'G9.3'];
    add('choir', [
      c('choir.synergy', at, len, 'G9.4', sh(syn), {time:time(syn, at, len, 8), fx:[wash(at, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy leads the hook in the middle of the round'}),
      c('choir.pat', at, len, 'G9.7', PAT, {chrome:{name:'Pat', mic:'on'}}),
      // The round: one glass, each tile a 16th later than the last (one decode within the stutter cache),
      // folded with its own wedges and turn, so the hook's voices stack up as pictures.
      ...ring.map((cell, k) => c(`choir.${k}`, at, len, cell, sh(g), {time:{...gIn, freezeAt:{at:0, len:Math.min(k, 3)}}, signature:k ? undefined : 'canon',
        fx:[fold(len, [6, 8, 6, 10, 6, 8, 12][k], k * 17, k % 2 ? -40 : 40), wash(at, len, .6), breathe(12, 8)], why:`the round: voice ${k + 1} enters ${Math.min(k, 3)} step${Math.min(k, 3) === 1 ? '' : 's'} late`})),
    ]);
  }
  // A second verse after the hook, when the track has one: the drift (chromatic drift and trails).
  if (build.from - hookEnd >= BS) {
    const at = hookEnd, len = build.from - hookEnd, syn = fit('G6.0', 1.08, CAST.synergy, CAST.synergyClose), g = glass(seed + 2), gIn = time(g, at, len, 13);
    add('drift', [
      c('drift.synergy', at, len, 'G6.0', sh(syn), {time:time(syn, at, len, 11), fx:[wash(at, len, .25)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy sings the second verse'}),
      c('drift.listen', at, len, 'G6.1', sh(fit('G6.1', 1, CAST.linda, CAST.people)), {time:time(CAST.linda, at, len, 12), fx:[drift(len, 0, 4), trail(3), wash(at, len, .45), breathe(12, 6)], why:'a listener in chromatic drift, smearing on the claps'}),
      c('drift.glassA', at, len, 'G6.2', sh(g), {time:gIn, fx:[fold(len, 8, 0, 60), wash(at, len, .6), breathe(10, 6)]}),
      c('drift.glassB', at, len, 'G6.3', sh(g), {time:gIn, fx:[fold(len, 8, 22, -60), wash(at, len, .6), breathe(10, 6)]}),
      c('drift.printer', at, len, 'G6.4', sh(CAST.printer), {time:time(CAST.printer, at, len, 14), fx:[trail(3, .5, .2), wash(at, len, .45)]}),
      c('drift.pat', at, len, 'G6.5', PAT, {chrome:{name:'Pat', mic:'on'}}),
    ]);
  }

  // ---- the build follows her ladder, rung by rung ------------------------------------------------------------
  const ladder = (plan.lady || []).filter(e => e.role === 'ladder');
  const bars = [];
  for (let b = build.from; b <= chokeBar; b += BS) { const ev = ladder.filter(e => e.at >= b && e.at < b + BS); bars.push({at:b, period:ev[0]?.period ?? 16, events:ev}); }
  const slow = bars.filter(b => b.period >= 8 && b.at < chokeBar), quarters = bars.filter(b => b.period >= 4 && b.period < 8 && b.at < chokeBar), fast = bars.filter(b => b.period < 4 && b.at < chokeBar);
  // Her slow rungs: the call's footage turns into pegs blooming out of the board home, a step on
  // every retrigger (her phrase lands, the pegs advance), growing across the rungs.
  if (slow.length) {
    const at = slow[0].at, len = slow.at(-1).at + BS - at, hits = slow.flatMap(b => b.events.map(e => e.at)), n = Math.max(1, hits.length);
    const amount = {keys:[[0, 0], ...hits.map((s, k) => [r6(s - at), r6(.12 + .5 * (k + 1) / n), 'outQuad'])], hit:true};
    const tiles = [[CAST.people, 'G4.0'], [CAST.crew, 'G4.1'], [CAST.linda, 'G4.2'], [CAST.arjun, 'G4.3']];
    add('rise', tiles.map(([id, cell], k) => { const s = fit(cell, 1, id, CAST.people);
      return c(`rise.${k}`, at, len, cell, sh(s), {time:time(s, at, len, 20 + k), fx:[bloom(amount), wash(at, len, .45), breathe(8, 0)], why:`pegs bloom out of the board home, a step on each of her ${n} slow retriggers`}); }));
  }
  // Her quarter notes: one kaleidoscope fills the frame and gains wedges on every retrigger; the board
  // panel carries her words over it (L1).
  for (const [i, q] of quarters.entries()) {
    const g = glass(seed + 3 + i), wedges = {keys:[[0, 4], ...q.events.map((e, k) => [r6(e.at - q.at), [4, 6, 8, 12, 16][Math.min(4, k + 1)], 'step'])], hit:true};
    add('fold', [c(`fold${i ? i : ''}`, q.at, BS, 'L1.0', sh(fit('L1.0', 1, g, CAST.glass[0])), {time:time(g, q.at, BS, 30 + i),
      fx:[{type:'radialFold', wedges, angle:[[0, 0], [BS, 45]]}, wash(q.at, BS, .55), {type:'breathe', px:{bind:'stem:lady', scale:16, base:PIXEL, attack:.01, release:.12}}],
      why:`kaleidoscope: wedges 4 to ${[4, 6, 8, 12, 16][Math.min(4, q.events.length)]}, one more fold on each of her ${q.events.length} retriggers`})]);
  }
  // Her 8ths and 16ths: the kaleidoscopes turn a notch on every hit; Synergy's tile lights on his stammers.
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
  }
  // The 32nds: the board alone (it grows to the frame over black); the choke: black, her tag on bare
  // sockets, then true black from the first frame after her tag (plus the choke's codec tail).
  add('ladder', [c('ladderBoard', chokeBar, choke.at - chokeBar, 'full', BLACK, {why:'the board alone: her 32nds at k4, grown to the frame'}),
    c('black', choke.at, impact - choke.at, 'full', BLACK, {why:'the choke: true black once her tag stops sounding (the board goes dark)'})]);
  grow(chokeBar, 'the board alone: it grows to the frame');

  // ---- Drop A: the ignition, a mandala of pegs; then the clap circle --------------------------------------------
  const ignShot = fit('full', 1, glass(seed + 6), CAST.glass[0]), A = impact + 8, Aend = sinkS.from;
  const ignite = c('ignite', {anchor:'cue:impact', hit:true}, 8, 'full', sh(ignShot), {time:time(ignShot, impact, 8, 50), signature:'ignition',
    fx:[{type:'radialFold', wedges:6, angle:[[0, 0], [8, 20]]}, {type:'pegVideo', mix:1, pitch:12, levels:6, gamma:1.4}],
    why:'IGNITION on the frame that holds the impact: a mandala of pegs (a mirrorable close-up in six wedges, as peg video)'});
  add('dropA', [ignite]);
  settle(A, 'the call comes back: the board is home on the cut');
  if (Aend > A) {
    const len = Aend - A, syn = fit('G6.0', 1.08, CAST.synergy, CAST.synergyClose);
    add('dropA', [
      c('dance.synergy', A, len, 'G6.0', sh(syn), {time:time(syn, A, len, 51), frame:{zoom:[[0, 1.08], [len, 1, 'outQuad']]}, fx:[wash(A, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy sings the hook into the clap circle'}),
      c('dance.pat', A, len, 'G6.5', PAT, {chrome:{name:'Pat', mic:'on'}}),
    ]);
    // The clap circle: on each clap the next tile round the circle cuts to a new face, every one
    // smearing on the claps and breathing with the chant.
    const ring = ['G6.1', 'G6.3', 'G6.4', 'G6.2'], pool = [CAST.peopleTalk, glass(seed + 7), CAST.lindaTalk, CAST.arjunTalk, glass(seed + 8), CAST.strategy, CAST.synthiaClose, CAST.people];
    const hits = claps(A, Aend).map(h => h.step + h.late), last = new Map(ring.map(cell => [cell, A]));
    const seq = ring.map((cell, k) => [{at:A, id:pool[k]}]);
    hits.forEach((s, j) => { const k = j % ring.length; if (s - last.get(ring[k]) >= QS) { seq[k].push({at:s, id:pool[(j + ring.length) % pool.length]}); last.set(ring[k], s); } });
    let n = 0;
    ring.forEach((cell, k) => seq[k].forEach((x, j) => {
      const end = seq[k][j + 1]?.at ?? Aend, id = fit(cell, 1, x.id, CAST.people), isGlass = CAST.glass.includes(x.id), at = j ? hitAt(r6(x.at)) : A, from = Math.floor(x.at);
      add('dropA', [c(`dance.${n++}`, at, r6(end - x.at), cell, sh(id), {time:time(id, from, Math.max(1, end - x.at), 60 + n),
        fx:[...(isGlass ? [fold(end - x.at, 6, 15 * k, 30)] : []), breathe(14, 10), trail(3, .5), wash(from, end - x.at, .55), drift(end - x.at, 90 * k, 2)],
        chrome:{speaking:j ? [[0, 1], [QS, 0, 'step']] : 0}, why:j ? 'the clap circle: this tile cuts on its clap' : 'the circle opens'})]);
    }));
  }

  // ---- Sink In: the tape slows the picture; on "in" it holds and melts into big blocks ---------------------------
  {
    const pool = [fit('G4.0', 1, CAST.synthia, CAST.synthiaClose), fit('G4.1', 1, CAST.people, CAST.peopleTalk), fit('G4.2', 1, CAST.crew, CAST.banner), fit('G4.3', 1, CAST.synergy, CAST.synergyClose)];
    const sink = m('tapeCoupling', {id:'sink', at:sinkS.from, len:sinkS.to - sinkS.from, pool:pool.map(sh), cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'sink'});
    const e = (plan.lady || []).find(x => x.role === 'sink');
    let freeze = sinkS.from + 12;
    if (e) {
      const words = (LADY_TABLE[e.file]?.words || []).filter(w => w.start >= e.from - 1e-6 && w.start < e.to), lastW = words.at(-1);
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
  }

  // ---- Drop B: the mandala, the bloom, the round ------------------------------------------------------------------
  const DB = dropB.from, DBend = outro.from, nB = Math.round((DBend - DB) / BS);
  // The first bar: a full-frame kaleidoscope (L1, the board panel over it), a new glass on every clap.
  {
    const to = Math.min(DBend, DB + BS), cuts = [DB, ...claps(DB, to).map(h => h.step + h.late)].filter((s, i, a) => !i || s - a[i - 1] >= QS);
    add('mandala', cuts.map((s, j) => { const end = cuts[j + 1] ?? to, g = fit('L1.0', 1, glass(seed + 9 + j), CAST.glass[0]);
      return c(`mandala.${j}`, j ? hitAt(r6(s)) : DB, r6(end - s), 'L1.0', sh(g), {time:time(g, Math.floor(s), Math.max(1, end - s), 70 + j),
        fx:[fold(end - s, [6, 8, 10, 8][j % 4], 23 * j, j % 2 ? -25 : 25), wash(Math.floor(s), end - s, .6), drift(end - s, 40 * j, 3), breathe(10, 10, PIXEL + 1)], why:j ? 'the mandala: a new glass on the clap' : 'the mandala'}); }));
  }
  // The middle bars: pegs bloom out of the board home across the call, growing on every clap, while
  // Synergy sings in the middle (his tile never blooms).
  if (nB >= 3) {
    const at = DB + BS, len = BS * (nB - 2), hits = claps(at, at + len).map(h => h.step + h.late), n = Math.max(1, hits.length);
    const amount = {keys:[[0, .04], ...hits.map((s, k) => [r6(s - at), r6(.06 + .5 * (k + 1) / n), 'outQuad'])], hit:true};
    const syn = fit('G9.4', 1, CAST.synergy, CAST.synergyClose);
    // Three listeners, each in two or three tiles (the twins mirrored, a few frames apart: one decode each).
    const tiles = [['G9.0', CAST.people, 0, null], ['G9.2', CAST.people, 4, 'x'], ['G9.1', CAST.arjun, 0, null], ['G9.3', CAST.linda, 0, null], ['G9.5', CAST.linda, 4, 'x'], ['G9.6', CAST.arjun, 4, 'x'], ['G9.8', CAST.people, 8, null]];
    const ins = new Map();
    add('bloom', [
      c('bloom.synergy', at, len, 'G9.4', sh(syn), {time:time(syn, at, len, 80), fx:[wash(at, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy in the middle of the bloom; his face never turns to pegs'}),
      c('bloom.pat', at, len, 'G9.7', PAT, {chrome:{name:'Pat', mic:'on'}}),
      ...tiles.map(([cell, id, lag, mirror], k) => { if (!ins.has(id)) ins.set(id, time(id, at, len + 2, 81 + k)); const t0 = ins.get(id);
        return c(`bloom.${k}`, at, len, cell, sh(id), {time:{...t0, in:r6((t0.in ?? 0) + lag / 24)}, ...(mirror ? {frame:{mirror}} : {}), fx:[bloom(amount), wash(at, len, .5), trail(2, .35)], why:`pegs bloom out of the board home, growing on every clap${mirror ? ' (a mirrored twin)' : ''}`}); }),
    ]);
  }
  // The last bar (the fill, "Read that again."): one picture in canon around the circle, each tile a
  // step later, so it reads again and again; Synergy keeps his tile.
  if (nB >= 2) {
    const at = DB + BS * (nB - 1), len = DBend - at, g = glass(seed + 12), gIn = time(g, at, len + 4, 90), syn = fit('G6.0', 1, CAST.synergy, CAST.synergyClose);
    add('round', [
      c('round.synergy', at, len, 'G6.0', sh(syn), {time:time(syn, at, len, 91), fx:[wash(at, len, .3)], chrome:{mic:'on', speaking:speaking('voice')}}),
      ...['G6.1', 'G6.2', 'G6.3', 'G6.4', 'G6.5'].map((cell, k) => c(`round.${k}`, at, len, cell, sh(g), {time:{...gIn, freezeAt:{at:0, len:k + 1}},
        fx:[fold(len, 6, 0, k % 2 ? -30 : 30), trail(4, .4, .3), wash(at, len, .6)], why:`the round: the same picture ${k + 1} step${k ? 's' : ''} later`})),
    ]);
  }

  // ---- the outro: everyone leaves the offsite as pegs; Synergy alone; the tape stop ------------------------------
  // Synergy's last tile: the whole frame (L1) when his tracked mouth row sits clear of the board's home
  // panel there, else the top of a split (1:1 frames his close-up with the row in the home's band).
  const O = outro.from, stopAt = L.stopAt, close = fit('L1.0', 1, CAST.synergyClose, CAST.synergy), leave = [];
  const clearOfHome = (id, cell) => {
    const sct = index.get(id), track = TRACKING[sct?.robot], r = cellRect(format, cell);
    if (!track || !r) return true;
    const M = layerMatrix(r, resolveCrop(sct, {}, format, r), {zoom:1, cx:.5, cy:.5, rot:0}), Mi = invert(M), pad = 24;
    return track.frames.every(fr => { const [x, y] = apply(Mi, fr[0], fr[1]); return y < H.y - pad || y > H.y + H.h + pad || x < H.x - pad || x > H.x + H.w + pad; });
  };
  const lastCell = clearOfHome(close, 'L1.0') ? 'L1.0' : 'split.0', lastShot = lastCell === 'L1.0' ? close : fit('split.0', 1, CAST.synergyClose, CAST.synergy);
  {
    const s1 = Math.min(O + BS, stopAt - QS), s2 = Math.min(O + 2 * BS, stopAt - QS / 2);
    const dissolve = (len, from = .5) => bloom([[0, 0], [r6(len * from), 0], [r6(len), .85, 'inQuad']]);
    const who = id => index.get(id)?.characters?.[0] ?? 'Guest';
    const toast = (name, len) => ({toast:{text:`${name} left the offsite`, at:0, len:Math.min(len, 2 * QS)}});
    const syn = fit('G4.0', 1, CAST.synergy, CAST.synergyClose), syn2 = fit('split.0', 1, CAST.synergy, CAST.synergyClose), stay = fit('split.1', 1, CAST.people, CAST.peopleTalk, CAST.synthiaClose, CAST.crew), g = glass(seed + 13);
    if (s1 > O) leave.push(
      c('leave.synergy', O, s1 - O, 'G4.0', sh(syn), {time:time(syn, O, s1 - O, 100), fx:[wash(O, s1 - O, .3)], chrome:{mic:'on', speaking:speaking('voice')}}),
      c('leave.people', O, s1 - O, 'G4.1', sh(fit('G4.1', 1, stay, CAST.people)), {time:time(stay, O, s1 - O, 101), fx:[wash(O, s1 - O, .5), breathe(10, 6)]}),
      c('leave.glass', O, s1 - O, 'G4.2', sh(g), {time:time(g, O, s1 - O, 102), fx:[fold(s1 - O, 6, 0, 30), dissolve(s1 - O), wash(O, s1 - O, .6)], why:'the glass turns to pegs and leaves'}),
      c('leave.pat', O, s1 - O, 'G4.3', PAT, {chrome:{name:'Pat', mic:'on'}}));
    if (s2 > s1) leave.push(
      c('leave2.synergy', s1, s2 - s1, 'split.0', sh(syn2), {time:time(syn2, s1, s2 - s1, 103), fx:[wash(s1, s2 - s1, .3)], chrome:{mic:'on', speaking:speaking('voice'), ...toast('Pat', s2 - s1)}}),
      c('leave2.stay', s1, s2 - s1, 'split.1', sh(stay), {time:time(stay, s1, s2 - s1, 104), fx:[dissolve(s2 - s1, .25), wash(s1, s2 - s1, .5)], why:`${who(stay)} turns to pegs and leaves`}));
    leave.push(c('leave.close', s2, plan.totalSteps - s2, lastCell, sh(lastShot), {time:time(lastShot, s2, plan.totalSteps - s2, 105), fx:[wash(s2, plan.totalSteps - s2, .3)],
      chrome:{mic:'on', speaking:speaking('voice'), ...toast(who(stay), 2 * QS)}, why:'Synergy alone at the offsite'}));
    if (lastCell !== 'L1.0') leave.push(c('leave.patLast', s2, plan.totalSteps - s2, 'split.1', PAT, {chrome:{name:'Pat', mic:'on'}, why:"Pat stays on, camera off, to the end"}));
    add('leave', leave);
  }
  const end = ending(plan, L, {clips:leave, pitch:12, index, shots, format});
  transports.push(...end.transports); board.push(...end.board);
  if (end.clips.length) add('leave', end.clips);

  const edl = merge(createEDL({format, loop:true, seed, track:plan.track, board, transports, camera, boardMoves, overrides}), ...patches);
  for (const x of edl.clips) {
    for (const key of Object.keys(x)) if (x[key] === undefined) delete x[key];
    if (x.chrome) for (const key of Object.keys(x.chrome)) if (x.chrome[key] === undefined) delete x.chrome[key];
  }
  return edl;
}
