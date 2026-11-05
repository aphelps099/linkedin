// The draft cut: "Drop Edition 60", plan §2 (the flagship film table) as an EDL treatment,
// built from the move library on the real shot index, for any track of the song book and any
// post. Every row of the table is here, done as written, done with a stand-in where it waits on
// a Runway pickup or a canon rule, or skipped where the compositor has no means yet; ROWS says
// which, and each clip's `why` says so where it matters.
//
//   const plan = FORMS.drop60.arrange(lyrics, durations, {track, cast, coldOpen:true});
//   const edl = drop60Draft(plan, SHOTS, {format:'9:16'});
//   compile(edl, {plan, shots:SHOTS}).lint.errors   // []
//
// Pure: the same plan, shots and format give the same EDL (every move draws on the seed).
// Nothing is placed in bars of Circle Back: every passage hangs off the plan's own landmarks
// (its sections, the unmute, Synergy's lines, the lady's ladder rung by rung, the choke, the
// impact, the bend, Sink In, the tape stop) and the film's cold open (plan.coldOpen), so the
// cut follows Circle Back at 120 BPM, Humbled and Honored at 92 (24 bars, a six-rung ladder)
// and Hustle at 130 (32 bars) alike.
import {MOVES} from '../moves/index.js';
import {snareHits} from '../moves/util.js';
import {createEDL, merge} from '../edl/schema.js';
import {barSteps, beatSteps, stepTime, stepAtTime, ladyTime, hitFrame, hitAt, cutFrame, stopFrames} from '../edl/anchors.js';
import {shotIndex, isSynergy, resolveCrop, UPSCALE, TRACKING, layerMatrix, invert, apply} from '../edl/compile.js';
import {cellRect, layout, FORMATS} from '../layouts.js';
import {LADY_TABLE} from '../../allhands/lady-table.js';

// Who plays whom. Ids are shot-index aliases.
export const CAST = {
  synergy:'synergy-camera-v2-listening', synergyClose:'synergy-enthusiastic-training-close-up', synergyTake:'synergy-synergy-v2-original-take',
  opsArrive:'drummer-arrival-performance', ops:'drums-playing', pads:'drum-pad-detail',
  keys:'keys-listening-wide-keys', keysPlay:'keys-playing-wide-keys', keysOffice:'keys-office-performance',
  kevin:'guitar-listening', kevinPlay:'guitar-playing', kevinOffice:'guitar-office-performance', kevinTalk:'kevin-standup-v1',
  people:'people-listening', peopleTalk:'people-speaking', peopleDesk:'people-linkedin-computer', arjun:'arjun-listening', linda:'linda-listening', lindaTalk:'linda-speaking', strategy:'strategy-listening',
  synthia:'synthia-clean-face-plate', synthiaClose:'synthia-conference-closeup',
  applause:'corporate-applause-closer-reaction', arrive:'the-professionals-arrive', banner:'banner-installation-blank-plates',
  printer:'printer-outward-feed',
};
const PAT = 'gen:camera-off', BOARD = 'gen:board', BLACK = 'gen:color:#000000';
// A board move's length, in frames: about a 16th at 92-130 BPM.
export const BOARD_MOVE = 4;
// The loop seam's ghost BACK.: its intensity (plan §2: the hook's ghosts and BACK.'s are I .08).
export const GHOST = .08;
const sh = id => `shot:${id}`;
// The applause close-up has Synergy on its left third, untracked (a mouth baked into his glass):
// the tile is framed off him (its visible source starts right of x 660 of 1916, clear of his
// head and headset) and on the people clapping, in the tile's own shape: both faces and their
// hands where it allows, else both faces whole and the top of the clap, else People & Culture's
// face and hands, else her face. The shot index has no faceBox for it (several people in frame),
// so the boxes are measured on the footage, as unions over the frames the draft plays (source px,
// frames 30-175): her face x 960-1180, y 260-530; his y 120-380; their hands down to y 850.
export const CLAP = {left:660, face:{x:960, y:260, w:220, h:270},
  framings:[{x:860, y:120, w:1020, h:730}, {x:860, y:120, w:1020, h:520}, {x:860, y:250, w:450, h:600}, {x:960, y:260, w:220, h:270}]};
function clapCrop(shot, cell) {
  const box = shot.contentBox, a = cell.w / cell.h, x0 = Math.max(box.x, CLAP.left), x1 = box.x + box.w;
  for (const [b, pad] of CLAP.framings.flatMap(b => [[b, .04], [b, 0]])) {
    let w = b.w * (1 + 2 * pad), h = b.h * (1 + 2 * pad);
    if (w / h > a) h = w / a; else w = h * a;
    if (w > x1 - x0 + 1e-6 || h > box.h + 1e-6) continue;
    const x = Math.min(Math.max(b.x + b.w / 2 - w / 2, x0), x1 - w), y = Math.min(Math.max(b.y + b.h / 2 - h / 2, box.y), box.y + box.h - h);
    return {x:r6(x), y:r6(y), w:r6(w), h:r6(h)};
  }
  return null;
}

// What the monitor's cut list calls each scene.
export const SCENE_LABELS = {cold:'Cold open', join:'Grid bloom', verse:'Unmute', hook:'Screen share', verse2:'Dub delay', freeze:'Freeze the call',
  rooms:'Breakout rooms', split:'Cell split', roll:'Retrigger roll', ladder:'Poor connection', dropA:'BACK.', sink:'Sink In',
  dropB:'Droste dive', fill:'Read that again', leave:'Leave meeting'};

// Plan §2, row by row: what this cut does with each. status: done | stand-in | partial | skipped.
// Bar numbers are Circle Back's; every passage is placed from the plan's own landmarks.
export const ROWS = [
  {row:'0:0-5', what:'Cold: BACK. as peg video, board white-hot, locked to the impact', status:'stand-in', note:'A jump transport shows the drop itself from frame 0: the board ignites for one frame and BACK. settles, over the ignition’s peg video, while the sound is the impact copied from the drop (plan.coldOpen). The peg video runs on the-professionals-arrive: office-ensemble has Synergy in it, and peg video warps (canon G11). EQ columns are not drawn yet.'},
  {row:'0:6-7', what:'REWIND with the reversed sound, scanline wobble, letters un-pop', status:'done', note:'The rewind transport is the plan’s (plan.transports): the last second before the choke at 4x, picture and sound reversed together. The ladder letters un-pop; printer and instrument tiles hold their frame (compile freezes them in any rewind). The scanline wobble runs on the film’s clock, and only where Synergy is not in the rewound picture (canon).'},
  {row:'0:8-15', what:"Pat's black tile, CONNECTING TO AUDIO", status:'partial', note:'Board cue in TYPEWRITER over the camera-off tile, where the intro leaves three quarters of a second for it; Humbled and Honored’s two-bar intro goes straight to YOU’RE ON MUTE. The hook ghosts at I .08 are not drawn (board cues have no ghost intensity).'},
  {row:'1', what:'Grid bloom, one tile a beat with a joined toast', status:'done', note:'Pat, Operations, Keys and Kevin join muted, one a beat; Synergy joins on the song’s unmute with his first line, the printer a beat later. The drummer’s mic toggles on the 8ths while the call is muted.'},
  {row:'2', what:'G6 complete; reaction canon nod; printer at 8 fps', status:'stand-in', note:'The synchronized-nod pickup (Runway 1) is not in: the call ripples in canon instead (each tile holds half a bar after the host line, released a step after the last). Printer at 8 fps stop-motion is done.'},
  {row:'3', what:"Gallery Unmute push into Synergy's cell; YOU'RE ON MUTE", status:'done', note:'The song unmutes at cue:unmute (bar 2 in Circle Back, not the plan’s bar 4): YOU’RE ON MUTE and its tease (BACK. with BA lit) run on the board’s home before it, every mic flips on at it, and the push into Synergy’s cell (1.0 to 1.3, outExpo) takes the bar before the verse.'},
  {row:'4-5', what:'Synergy fills the frame in 3 f, stack3, slow push, vocal cuts', status:'done', note:'The push lands: Synergy grows from his tile to the frame in 3 frames on the verse downbeat, then stack3 a beat later: Synergy, the reactor, the board band, Pat’s camera-off tile. Vocal cuts on the reactor one frame before the sung words.'},
  {row:'6-7', what:'Ops reactor, snare punch-in, off-beat cut, freeze + label', status:'done', note:'Operations hit-warped with punch-ins on the backbeat as it sounds (hits), the off-beat cut ten steps into the second verse line, ARJUN / FINANCE in PEG-5 inside the middle tile, two beats before the hook (in the safe area).'},
  {row:'8-9', what:'Hook: BOARD+STRIP, screen-share banner, slam-word crash zoom, snap ladder', status:'partial', note:'Crash zoom on the slam word in Synergy’s tile (kept under the zoom that keeps his mouth row in the tile), the steep snap ladder on the repeat in the keys tile. The department chart is not drawn yet.'},
  {row:'10-11', what:'Dub delay, active-speaker chase', status:'done', note:'Four taps a dotted 8th apart at .7 / .49 / .34 after the chase; drop.js has no matching audio throw yet (the move says so). Humbled and Honored’s verse ends on its hook, so it has no second verse here.'},
  {row:'12-13', what:'Freeze the call except Ops; canon unfreeze wave', status:'done', note:'The one-a-bar rungs: the first freezes the call at −60 % colour, the second thaws it in canon. Pat keeps the ninth tile: the board shows once, in its strip.'},
  {row:'14-15', what:'Breakout rooms 2 then 4, snap ladder, outer-ring mosaic', status:'done', note:'The half-bar rungs: two rooms, then four (on its second hit when the track has one such bar).'},
  {row:'16', what:'Cell split 1/2/4/8 on drum-pad-detail, mirrored, mosaic 16 px', status:'done', note:'The quarter-note rung. Mirrored on alternate axes with a G11 waiver: the shot index verifies drum-pad-detail mirror-safe, the lint forbids mirroring any instrument. Lead and Aaron to settle.'},
  {row:'17', what:'Retrigger roll, hat roll, RGB split on the roll', status:'done', note:'The first 8th-note rung. The applause tile is gone: Synergy stammers here in Hustle and Humbled and Honored, and the applause shot would show him without a mouth row.'},
  {row:'18', what:"Board with Synergy's cell, poor connection", status:'done', note:'BOARD+STRIP, the board grown out of its home: the lady’s LET’S with LE lit (the rest a ghost), Synergy’s tile lights on his stammers. Mosaic 32 px on the side tiles only: never on Synergy (canon).'},
  {row:'19:0-7', what:'BOARD, L at k4', status:'done', note:'The 32nd-note rung: the board grows to the frame over black; the song’s own screens (LET’S, LE lit); the SPARKLE dissolve is the board’s.'},
  {row:'19:8-11', what:'Choke: black, LET’S CIRCLE- on bare sockets', status:'done', note:'Her typewriter finishes its last letter before black.'},
  {row:'19 silence', what:'True black from the first frame after her tag stops sounding', status:'done', note:'choreo darkens the board on the first frame that starts after plan.choke.tagEnd, plus the choke’s 30 ms codec tail (the Opus floor after a hard cut, CHOKE_TAIL) and the engine’s latency (Circle Back frame 952: nothing over -70 dBFS plays over black in the file), and holds true black to the impact’s frame.'},
  {row:'20', what:'IGNITION: peg video, then stack3; push on the room', status:'stand-in', note:'The ignition lands on the frame that holds the impact’s sound. Peg video on the-professionals-arrive (as in the cold open); half a bar later the same shot unpegged leads stack3 with the push. office-ensemble is out: Synergy is in it without his mouth row while he sings the hook. Pat’s CONNECTED flip and the kick lift on the board are not drawn.'},
  {row:'21', what:'Pads on the snare alternating with applause; whip slide and composite roll on PIVOT', status:'partial', note:'The pads and the applause (framed off Synergy on People & Culture’s whole face, with Kevin and their hands where the tile’s shape allows) alternate a beat each, every cut and punch-in on the frame that holds its drum hit. The whip slide (Synergy to Synthia) and the composite roll land on her bend where the song has it. The printer’s page eject is skipped: no printer tile in stack3.'},
  {row:'22-23', what:'Sink In: G4 tape-coupled, freeze on "in", outer cells sink to 32 px', status:'partial', note:'The G4 starts on Sink In (the tape falls across it). The freeze lands on the measured onset of "in" in her deep take; Synergy keeps his face, the others sink to 32 px. The page drifting into the droid’s tile is skipped.'},
  {row:'24', what:"Drop B: G9, rates snap back, Droste dive into Pat's cell", status:'done', note:'The board holds still in its strip while the camera dives (the camera does not own it). Synergy sits in the tile whose mouth row stays in frame longest and never goes under the board, so his mouth shows while he sings verse 3.'},
  {row:'25', what:'Chase light on 8ths, punch-ins, 2 to 4 cuts a bar', status:'done', note:'Punch-ins land on the frame that holds each backbeat.'},
  {row:'26', what:'Kaleido 2x2 of the drum pads; dub delay on Synergy', status:'done', note:'The kaleido runs in L1 so the board panel carries the hook over it with its sockets (legible). Roll Call stays gated (D3). The dub delay taps on 16ths: a dotted 8th needs 9 steps and the window has 4.'},
  {row:'27', what:'Tile cascade; the replay of the bar before; READ THAT AGAIN.', status:'done', note:''},
  {row:'28', what:'Leave Meeting: tiles leave on the beat, toasts', status:'done', note:'Six on the call, Kevin first, one a beat: the grid steps down G6, G4, split, L1 as they go, so the full layouts land on the bar and the half bar. In Hustle’s four-bar outro one leaves every two beats.'},
  {row:'29', what:'G1 Synergy, tape stop, black, ghost BACK. on the last two frames', status:'done', note:'The picture follows the tape-stop curve to a held frame with his eyes open and holds it while her “Full stop.” (after the tape) still sounds; FULL STOP. stays lit and fully typed, dimming and sliding down 2 pegs. True black from the first frame after her (Circle Back frame 1437). The last two frames show frame 0’s BACK. as a ghost at I .08 on its own pegs, so the loop closes on frame 0’s peg mask; where her line runs into them (Hustle), the ghost takes what is left.'},
  {row:'Runway pickups', what:'nod wide, overhead table, drum strike, pick hand, pages, robot duet, Strategy 10 s, privacy shutter', status:'stand-in', note:'None supplied yet. Stand-ins: the canon ripple (nod), drum-pad-detail (strike), printer-outward-feed (pages), strategy-listening at 3.5 s (Strategy). The rest have no row of their own in §2.'},
];

const speaking = stem => ({bind:`stem:${stem}`, scale:1.5, base:-.3, attack:.02, release:.3});
const clone = x => JSON.parse(JSON.stringify(x));
const norm = s => String(s).toLowerCase().replace(/[\s_\-]+/g, '');
const r6 = x => +(+x).toFixed(6);

export function drop60Draft(plan, shots, {format = '9:16', features, seed = 7} = {}) {
  const BS = barSteps(plan), QS = beatSteps(plan), F = FORMATS[format], T = s => stepTime(plan, s), S = t => stepAtTime(plan, t);
  const index = shotIndex(shots);
  const m = (name, ctx) => MOVES[name].fn({plan, shots, features, format, seed, ...ctx});
  const c = (id, at, len, cell, asset, more = {}) => ({id, at, len, cell, asset, ...more});
  const patches = [], board = [], camera = [], overrides = [], transports = [], boardMoves = [];
  // The board keeps its home (layouts.js HOME) in every call layout. A full-board moment (the
  // screen share, the ladder's board alone, the ignition) grows out of the home on its first beat
  // and returns to it landing on the cut that ends it: a short eased move, never a jump (lint G14).
  // Both happen over the full-board moment's own picture, never over the call's tiles.
  const grow = (at, why) => boardMoves.push({id:`grow.${boardMoves.length}`, at, frames:BOARD_MOVE, ease:'inOutSine', align:'start', why});
  const settle = (at, why) => boardMoves.push({id:`home.${boardMoves.length}`, at, frames:BOARD_MOVE, ease:'inOutSine', align:'end', why});
  const add = (scene, p) => { for (const x of p.clips || []) { x.scene ??= scene; } patches.push(p); return p; };
  // The zoom ceiling of a shot in a cell (U · crop.h / cell.h); `fit` picks the first that holds `zoom`.
  const ceiling = (id, cell) => { const s = index.get(id), r = cellRect(format, cell); if (!s || !r) return 0; return (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, format, r).h / r.h; };
  const fit = (cell, zoom, ...ids) => ids.find(id => ceiling(id, cell) >= zoom - 1e-9) ?? ids.at(-1);
  const synergyShot = asset => { const s = index.get(String(asset).replace(/^shot:/, '')); return !!s && isSynergy(s); };

  // ---- the plan's landmarks ------------------------------------------------------------------------
  const sec = name => { const s = (plan.sections || []).find(x => norm(x.name) === norm(name)); if (!s) throw Error(`the draft cut needs a ${name} section`); return {from:s.from * BS, to:s.to * BS}; };
  const verse = sec('Verse'), build = sec('Build'), dropA = sec('Drop A'), sinkS = sec('Sink In'), dropB = sec('Drop B'), outro = sec('Outro');
  const choke = plan.choke, impact = choke.until, chokeBar = Math.floor(choke.at / BS) * BS;
  const stop = (plan.tape || []).find(t => t.kind === 'stop'), stopAt = stop ? stop.from : plan.totalSteps - BS / 2;
  const linesOf = kind => (plan.lines || []).filter(l => l.kind === kind && l.words.length);
  const startOf = l => l.words[0].at, barOf = s => Math.floor(s / BS) * BS;
  const U = plan.call?.until ?? 2 * BS;
  const cold = plan.coldOpen ?? {impact:{at:0, until:.75}, rewind:{from:.75, to:1, rate:4, sourceFrom:T(choke.at)}, resume:1};
  const rw = plan.transports?.find(t => t.kind === 'rewind' && t.audio) ?? {at:cold.rewind.from, len:cold.rewind.to - cold.rewind.from, rate:cold.rewind.rate, sourceFrom:cold.rewind.sourceFrom, sourceTo:cold.rewind.sourceFrom - .25 * cold.rewind.rate};
  const coldEnd = S(cold.impact.until), resume = S(cold.resume);
  // The impact's frame: the one that holds its sound (a hit). The cold open shows the drop from it.
  const impactFrame = hitFrame(T(impact), plan);

  // ---- the cold open: the impact at frame 0, then the tape rewinds with its sound -----------------------
  transports.push({id:'cold', at:0, len:r6(coldEnd), kind:'jump', audio:true, from:{anchor:'step:0', frames:impactFrame},
    why:'cold open: frame 0 is the drop’s impact frame; the sound there is the impact, copied (plan.coldOpen)'});
  transports.push({id:'rewind', at:r6(S(rw.at)), len:r6(S(rw.at + rw.len) - S(rw.at)), kind:'rewind', audio:true, rate:rw.rate ?? 4, from:{anchor:`step:${r6(S(rw.sourceFrom))}`}, signature:'rewind',
    why:'the plan’s rewind: the last second before the choke at 4x, picture and sound reversed together'});

  // The rewind's board (the ladder's board alone) shrinks back to its home, landing on the intro's first frame.
  settle(r6(resume), 'the cold open hands the board back to its home as the call starts');

  // ---- the intro: Pat's black tile, the bloom, the unmute, the call ------------------------------------
  // The bloom: four join before the unmute, Synergy on it with his first line, the printer a beat later.
  // From the first bar line after the cold open when a bar is left, else as late as an even spacing allows.
  let bloomAt = Math.ceil(resume / BS) * BS, every = QS;
  if (U - bloomAt < BS) for (const e of [QS, QS / 2, 1]) { const at = U - 4 * e; if (at >= resume - 1e-9) { bloomAt = at; every = e; break; } }
  const opsTile = fit('G4.1', 1, CAST.opsArrive, CAST.ops), keysTile = fit('G4.2', 1, CAST.keysPlay, CAST.keysOffice), kevinTile = fit('G4.3', 1, CAST.kevin, CAST.kevinOffice);
  const synTile = fit('G6.4', 1, CAST.synergy, CAST.synergyClose), printTile = CAST.printer;
  add('join', {clips:[c('pat', 0, bloomAt, 'L1.0', PAT, {chrome:{mic:'muted'}, why:"Pat's camera is off; the call is connecting"})]});
  // (The full line where it has the 1.33 s it needs to read, G9; else the short one.)
  if (T(bloomAt) - cold.resume >= .75 - 1e-9) board.push({id:'connecting', at:r6(resume), len:r6(bloomAt - resume), text:T(bloomAt) - cold.resume >= 1.33 ? 'CONNECTING TO AUDIO…' : 'CONNECTING…', reveal:'typewriter', palette:'white', k:1});
  board.push({id:'song', at:T(bloomAt) - cold.resume >= .75 - 1e-9 ? bloomAt : 0, text:{ref:'song'}});
  const bloom = add('join', m('gridBloom', {id:'join', at:bloomAt, len:verse.from - bloomAt, every, pool:[PAT, opsTile, keysTile, kevinTile, synTile, printTile], scene:'join'}));
  const hostLine = linesOf('host')[0], canonAt = hostLine ? startOf(hostLine) + 8 : U + 8;
  for (const x of bloom.clips) {
    const asset = x.asset.replace(/^shot:/, '');
    x.chrome = {...(x.chrome || {}), mic:x.at >= U ? 'on' : 'muted'};
    if (asset === printTile) {
      // The printer at 8 fps: each source frame held for 3 output frames.
      const frames = Math.round((T(x.at + x.len) - T(x.at)) * 24) + 3, keys = [[0, 0]];
      for (let k = 2; k < frames; k += 3) keys.push([k, 3, 'step'], [k + 1, 0, 'step']);
      x.time = {...(x.time || {}), rate:{keys, unit:'frames'}};
      x.why = 'the printer at 8 fps stop-motion';
    }
    // The drummer's mic toggles on the 8ths while the call is muted (the hats).
    if (asset === opsTile && x.at < U) {
      const keys = [[0, 0]];
      for (let s = 2, j = 1; s < x.len; s += 2, j++) keys.push([s, j % 2, 'step']);
      x.chrome.mic = keys; x.why = 'mute icon on the hats';
    }
  }
  // The canon ripple (stand-in for the synchronized nod): half a bar after the host line every tile
  // but the drummer and Pat holds and lets go one step after the tile before it.
  const g6 = bloom.clips.filter(x => x.cell.startsWith('G6.') && x.at <= canonAt && x.at + x.len > canonAt);
  let k = 0;
  for (const x of g6) {
    if (x.asset === PAT || x.asset === sh(opsTile) || x.asset === sh(printTile)) continue;
    k++;
    x.time = {...(x.time || {}), freezeAt:{at:canonAt - x.at, len:k}};
    x.why = `canon ripple (stand-in for the synchronized-nod pickup): holds ${k} step${k > 1 ? 's' : ''} after the host line`;
  }
  // The bar before the verse: the camera pushes into Synergy's cell (the Gallery Unmute).
  const synCell = cellRect(format, 'G6.4');
  camera.push({id:'unmute.push', at:verse.from - BS, len:BS, zoom:[[0, 1], [BS, 1.3, 'outExpo']], cx:r6((synCell.x + synCell.w / 2) / F.w), cy:r6((synCell.y + synCell.h / 2) / F.h), why:"Gallery Unmute: the push into Synergy's cell"});

  // ---- the verse: Synergy fills the frame in 3 frames, then stack3 ----------------------------------------
  const V = verse.from, vLines = linesOf('verse').filter(l => startOf(l) >= V && startOf(l) < build.from);
  const hook0 = linesOf('hook').find(l => startOf(l) >= V && startOf(l) < build.from);
  const hookAt = hook0 ? barOf(startOf(hook0)) : Math.min(build.from, V + 4 * BS), v1At = vLines[1] ? barOf(startOf(vLines[1])) : V + 2 * BS;
  const host = fit('stack3.0', 1.15, CAST.synergy, CAST.synergyClose), close = fit('L1.0', 1, CAST.synergyClose, CAST.synergy);
  add('verse', {clips:[c('fill', V, 4, 'L1.0', sh(close), {time:{in:1}, frame:{zoom:{keys:[[0, r6(synCell.h / cellRect(format, 'L1.0').h * 1.3)], [3, 1, 'outQuad']], unit:'frames'}}, chrome:{mic:'on', speaking:speaking('voice')}, why:'Synergy fills the frame in 3 frames: the push lands'})]});
  const push = add('verse', m('slowPush', {id:'host', at:V + 4, len:hookAt - V - 4, pool:[host], cell:'stack3.0', scene:'verse'}));
  for (const x of push.clips) x.chrome = {mic:'on', speaking:speaking('voice')};
  add('verse', {clips:[c('patboard', V + 4, hookAt - V - 4, 'stack3.2', PAT, {chrome:{name:'Pat', mic:'on'}, why:"Pat's camera is off, under the board band"})]});
  // The reactor in the middle tile: vocal cuts on the first line, then Operations on the second.
  const R = 'stack3.1';
  const r0 = fit(R, 1, CAST.kevin, CAST.kevinOffice), r1 = fit(R, 1, CAST.keys, CAST.keysOffice), r2 = fit(R, 1, CAST.people, CAST.peopleDesk), r3 = fit(R, 1, CAST.linda, CAST.synthiaClose);
  add('verse', m('vocalCut', {id:'react', at:V + 4, len:v1At - V - 4, pool:[r0, r1, r2, r3], cell:R, scene:'verse'}));
  const opsReact = fit(R, 1.12, CAST.ops, CAST.opsArrive, CAST.pads), offAt = v1At + 10, labelAt = hookAt - 3 * QS;
  const warp = m('hitWarp', {id:'opsReact', at:v1At, len:offAt - v1At, pool:[opsReact], cell:R, scene:'verse'});
  const opsClip = warp.clips[0] ?? c('opsReact.0', v1At, offAt - v1At, R, sh(opsReact), {time:{in:0}});
  Object.assign(opsClip, m('snarePunch', {clip:opsClip, at:opsClip.at, len:opsClip.len, to:1.12}).clips[0], {scene:'verse', chrome:{speaking:speaking('drums')}});
  add('verse', {clips:[opsClip]});
  add('verse', {clips:[c('offbeat', offAt, labelAt - offAt, R, sh(fit(R, 1, CAST.keysPlay, CAST.keysOffice)), {time:{in:2}, chrome:{speaking:speaking('keys')}, why:'the off-beat cut'})]});
  // The label names whoever the tile shows: Arjun, or (where no Arjun take holds the tile, 16:9)
  // People & Culture at her desk.
  const labelShot = fit(R, 1, CAST.arjun, CAST.peopleDesk), who = labelShot === CAST.arjun ? {name:'Arjun', role:'Finance'} : {name:'People & Culture'};
  const label = m('freezeLabel', {id:'label', at:labelAt, len:hookAt - labelAt, hold:hookAt - labelAt, pool:[labelShot], cell:R, ...who, scene:'verse'});
  // (The label leaves the board a step before the hook's cut, so it never lights over the next tile.)
  board.push(...label.board.map(b => ({...b, len:Math.max(1, b.len - 1), text:who.role ? `${who.name} / ${who.role}`.toUpperCase() : who.name.toUpperCase()}))); label.board = [];
  add('verse', label);

  // ---- the hook: Synergy shares his screen ---------------------------------------------------------------
  const hookEnd = Math.min(build.from, hookAt + 2 * BS);
  const hookWords = (plan.words || []).filter(w => w.kind === 'hook' && w.at >= hookAt && w.at < hookEnd);
  const slam = hookWords.filter(w => w.at < hookAt + BS).at(-1), again = hookWords.filter(w => w.at >= hookAt + BS);
  const shareSyn = fit('BOARD+STRIP.1', 1.6, CAST.synergy, CAST.synergyClose);
  const share = c('share', hookAt, hookEnd - hookAt, 'BOARD+STRIP.1', sh(shareSyn), {time:{in:2}, chrome:{banner:"You are viewing Synergy's screen", speaking:speaking('voice')}});
  // The crash zoom centres on his mouth row so the zoom never pushes it out of the tile.
  const crash = slam ? m('crashZoom', {clip:share, at:slam.at, len:hookEnd - slam.at, to:1.6}).clips[0] : share;
  crash.frame = {...(crash.frame || {}), cy:.6};
  crash.why = `slam-word crash zoom on "${slam?.display ?? 'the hook'}"`;
  const keysHook = c('shareKeys', hookAt, hookEnd - hookAt, 'BOARD+STRIP.0', sh(fit('BOARD+STRIP.0', 1.78, CAST.keysPlay, CAST.keysOffice)), {time:{in:1}, chrome:{speaking:speaking('keys')}});
  const ladderHook = again.length ? m('snapLadder', {clip:keysHook, at:hookAt + BS, len:hookEnd - hookAt - BS, ladder:'steep', hits:again.map(w => w.at)}).clips[0] : keysHook;
  ladderHook.why = 'snap ladder 1 / 1.33 / 1.78 on the repeated hook';
  add('hook', {clips:[crash, ladderHook, c('shareOps', hookAt, hookEnd - hookAt, 'BOARD+STRIP.2', sh(fit('BOARD+STRIP.2', 1, CAST.opsArrive, CAST.ops)), {time:{in:3}, chrome:{speaking:speaking('drums')}})]});
  grow(hookAt, 'the screen share: the board grows out of its home');
  settle(hookEnd, 'the share ends: the board is home on the cut');

  // ---- verse 2 (when the verse has one): the chase, vocal cuts in one tile, the dub delay -----------------
  if (build.from - hookEnd >= BS) {
    const W2 = hookEnd, chase = [CAST.synergy, fit('G6.1', 1, CAST.ops, CAST.opsArrive), CAST.keys, CAST.kevin, CAST.people, PAT];
    const v2 = add('verse2', m('speakerChase', {id:'v2', at:W2, len:12, pool:chase, scene:'verse2'}));
    v2.clips = v2.clips.filter(x => x.cell !== 'G6.4');
    add('verse2', m('vocalCut', {id:'v2cut', at:W2, len:12, pool:[CAST.linda, CAST.strategy, CAST.arjun], cell:'G6.4', scene:'verse2'}));
    const dubAt = W2 + 12, dubLen = 12, delay = 3;
    const dub = add('verse2', m('dubDelay', {id:'dub', at:dubAt, len:dubLen, delay, pool:[CAST.synergy], cells:['G6.0', 'G6.1', 'G6.2', 'G6.3'], scene:'verse2'}));
    for (const x of dub.clips) { x.chrome = {name:'Synergy', speaking:speaking('voice')}; x.why = `${x.why}, opacity ${x.frame?.opacity ?? 1}`; }
    const carry = (x, at, len, id) => ({...clone(x), id, at, len, time:x.time ? {...x.time, in:r6((x.time.in ?? 0) + (cutFrame(T(at)) - cutFrame(T(x.at))) / 24)} : undefined, why:'keeps its player until the tap lands'});
    for (const x of v2.clips) {
      const tap = ['G6.1', 'G6.2', 'G6.3'].indexOf(x.cell);
      if (tap >= 0) add('verse2', {clips:[carry(x, dubAt, (tap + 1) * delay, `v2.wait${tap + 1}`)]});
      if (x.cell === 'G6.5') add('verse2', {clips:[carry(x, dubAt, dubLen, 'v2.pat')]});
    }
    add('verse2', {clips:[c('v2.strategy', dubAt, dubLen, 'G6.4', sh(CAST.arjun), {time:{in:1}, why:'a listener through the throw'})]});
    if (build.from > dubAt + dubLen) add('verse2', m('speakerChase', {id:'chase', at:dubAt + dubLen, len:build.from - dubAt - dubLen, pool:chase, scene:'verse2'}));
  }

  // ---- the build follows the ladder, rung by rung: one look per retrigger rate -----------------------------
  const ladder = (plan.lady || []).filter(e => e.role === 'ladder');
  const bars = [];
  for (let b = build.from; b <= chokeBar; b += BS) { const ev = ladder.filter(e => e.at >= b && e.at < b + BS); bars.push({at:b, period:ev[0]?.period ?? 16, events:ev}); }
  const once = bars.filter(b => b.period >= 16), halves = bars.filter(b => b.period >= 8 && b.period < 16), quarters = bars.filter(b => b.period >= 4 && b.period < 8);
  const fast = bars.filter(b => b.period < 4 && b.at < chokeBar), roll = fast[0], poor = fast.slice(1);
  // Bars with one retrigger: freeze the call (all but the drummer), then the canon unfreeze wave.
  if (once.length) {
    const call9 = [CAST.synergy, fit('G9.1', 1, CAST.ops, CAST.opsArrive), CAST.keys, CAST.kevin, PAT, CAST.people, CAST.arjun, CAST.synthia, CAST.strategy];
    const frozen = add('freeze', m('freezeTheCall', {id:'freeze', at:once[0].at, len:BS, pool:call9, scene:'freeze'}));
    if (once[1]) {
      const wave = frozen.clips.map((x, j) => {
        const y = {...clone(x), id:`thaw.${j}`, at:once[1].at, len:BS, scene:'freeze'};
        if (y.asset.startsWith('gen:') || y.why === 'the soloist stays live') { if (y.time) y.time.in = r6((x.time?.in ?? 0) + (T(once[1].at) - T(once[0].at))); y.why = 'live through the wave'; return y; }
        y.time = {...(y.time || {}), freezeAt:{at:0, len:j + 1}};
        y.fx = [{type:'saturation', amount:[[0, .4], [j + 1, 1, 'step']]}];
        y.why = `canon unfreeze wave: tile ${j} thaws ${j + 1} steps in`;
        return y;
      });
      add('freeze', {clips:wave});
    }
  }
  // Half-bar retriggers: breakout rooms, two then four; the outer ring coarsens.
  const roomsPool = [CAST.synergy, CAST.keys, CAST.people, CAST.arjun, CAST.synthia, CAST.strategy, CAST.linda, CAST.kevin];
  const roomPatches = halves.length >= 2 ? [m('breakoutRooms', {id:'rooms', at:halves[0].at, len:halves.length * BS, skip:1, pool:roomsPool, scene:'rooms'})]
    : halves.length ? [m('breakoutRooms', {id:'rooms', at:halves[0].at, len:BS / 2, skip:1, pool:roomsPool, scene:'rooms'}), m('breakoutRooms', {id:'rooms4', at:halves[0].at + BS / 2, len:BS / 2, skip:2, pool:roomsPool, scene:'rooms'})] : [];
  for (const p of roomPatches) {
    add('rooms', p);
    for (const x of p.clips) {
      const r = cellRect(format, x.cell), dx = (r.x + r.w / 2) / F.w - .5, dy = (r.y + r.h / 2) / F.h - .5, outer = Math.hypot(dx, dy) > .3;
      if (outer && !synergyShot(x.asset)) { (x.fx ??= []).push({type:'mosaic', px:[[0, 4], [x.len, 8]]}); x.why = `${x.why ?? ''}; the outer ring coarsens 4 to 8 px`.replace(/^; /, ''); }
    }
  }
  // Quarter-note retriggers: the cell split, one decode of the pads, mirrored.
  for (const [i, q] of quarters.entries()) {
    const split = add('split', m('cellSplit', {id:i ? `split${i}` : 'split', at:q.at, len:BS, pool:[CAST.pads], cell:'L1.0', scene:'split'}));
    split.clips.forEach(x => {
      x.fx = [{type:'mosaic', px:[[0, 8], [QS, 10, 'step'], [2 * QS, 13, 'step'], [3 * QS, 16, 'step']]}];
      if (x.frame?.mirror) overrides.push({target:x.id, rule:'G11', note:'drum-pad-detail is on the shot index’s hand-verified mirror-safe list (no hands, no text); plan §2 bar 16 mirrors it on alternate axes'});
    });
  }
  // The first 8th-note rung: the retrigger roll; hat roll and RGB split bound to the roll.
  if (roll) {
    const rollCells = ['G4.0', 'G4.1', 'G4.2', 'G4.3'];
    const rollPatch = add('roll', m('retriggerRoll', {id:'roll', at:roll.at, len:BS, pool:[fit('G4.0', 1.15, CAST.keysPlay, CAST.keysOffice), CAST.synergy, fit('G4.2', 1.15, CAST.opsArrive, CAST.pads), CAST.lindaTalk], cells:rollCells, scene:'roll'}));
    const stepOf = x => typeof x.at === 'number' ? x.at : (plan.lady.filter(e => e.role === 'ladder' && e.rung === +/lady:r(\d+)/.exec(x.at.anchor)?.[1])[+x.at.anchor.split('#')[1]]?.at ?? roll.at);
    for (const cell of rollCells) {
      const first = rollPatch.clips.filter(x => x.cell === cell).sort((a, b) => stepOf(a) - stepOf(b))[0];
      const at = first && stepOf(first);
      if (first && at > roll.at) rollPatch.clips.push({id:`roll.hold.${cell}`, at:roll.at, len:at - roll.at, cell, asset:first.asset, time:{in:r6((first.time?.in ?? 0) + .5), freezeAt:0}, fx:[{type:'saturation', amount:.5}], scene:'roll', why:'holds a greyed frame until its retrigger'});
    }
    rollPatch.clips = rollPatch.clips.map(x => {
      const y = m('hatRoll', {clip:x, at:x.at, len:x.len}).clips[0];
      if (!synergyShot(y.asset)) (y.fx ??= []).push({type:'rgbSplit', px:{bind:'roll', scale:10, attack:0, release:.05}, angle:0});
      return y;
    });
  }
  // The rungs after it, up to the 32nds: the board with Synergy's tile; poor connection on the sides.
  for (const [i, p] of poor.entries()) {
    const id = i ? `${i}` : '';
    const sat = [[0, .35]], talk = [[0, 0]];
    for (const st of (plan.stutters || []).filter(s => s.at >= p.at && s.at < p.at + BS)) { sat.push([st.at - p.at, 1, 'step'], [st.at - p.at + 1, .35, 'step']); talk.push([st.at - p.at, 1, 'step'], [st.at - p.at + 1, 0, 'step']); }
    add('ladder', {clips:[c(`poorHost${id}`, p.at, BS, 'BOARD+STRIP.1', sh(CAST.synergy), {time:{in:4}, fx:[{type:'saturation', amount:sat}], chrome:{banner:'Your connection is unstable', speaking:talk},
      why:`Synergy's tile lights on his ${sat.length >> 1} stammers between her ${p.events.length} retriggers`})]});
    add('ladder', m('poorConnection', {id:`poorA${id}`, at:p.at, len:BS, pool:[CAST.keys], cell:'BOARD+STRIP.0', scene:'ladder'}));
    add('ladder', m('poorConnection', {id:`poorB${id}`, at:p.at, len:BS, pool:[CAST.arjun], cell:'BOARD+STRIP.2', scene:'ladder', in:1}));
    for (const q of patches.slice(-2)) for (const x of q.clips) delete x.chrome;
  }
  if (poor.length) grow(poor[0].at, 'the board takes the screen with Synergy’s tile beside it');
  // The 32nds: the board alone (it grows to the frame over black); the choke: black, her tag on bare
  // sockets, then true black.
  add('ladder', {clips:[c('ladderBoard', chokeBar, choke.at - chokeBar, 'full', BLACK, {why:'the board alone: L at k4, grown to the frame'}), c('black', choke.at, impact - choke.at, 'full', BLACK, {why:'the choke: true black once her tag stops sounding (the board goes dark)'})]});
  grow(chokeBar, 'the board alone: it grows to the frame');
  // The scanline wobble on the rewind (film clock), where the rewound second shows no Synergy.
  if (S(rw.sourceFrom - rw.len * (rw.rate ?? 4)) >= chokeBar - 1e-9) camera.push({id:'rewind.wobble', at:r6(S(rw.at)), len:r6(S(rw.at + rw.len) - S(rw.at)), clock:'film', fx:[{type:'scanline', amount:.3, wobble:8, period:6}], why:'REWIND: the tape’s scanline wobble'});

  // ---- Drop A: the ignition, then stack3 ---------------------------------------------------------------------
  const ign = add('dropA', m('pegTakeover', {id:'ignite', at:impact, len:8, pool:[CAST.arrive], scene:'dropA'}));
  ign.clips[0].at = {anchor:'cue:impact', hit:true};
  ign.clips[0].why = 'IGNITION on the frame that holds the impact, over peg video (the-professionals-arrive: office-ensemble has Synergy in it)';
  const A = impact + 8, Aend = sinkS.from;   // (pegTakeover brings the board home, landing on A)
  const room = c('room', A, Aend - A, 'stack3.0', sh(CAST.arrive), {time:{in:r6((ign.clips[0].time?.in ?? 0) + (cutFrame(T(A)) - impactFrame) / 24)}, chrome:{name:'Lobby'}, why:'the ignition’s shot, unpegged: the room comes back'});
  add('dropA', {clips:[m('slowPush', {clip:room, at:A, len:Aend - A, to:1.25}).clips[0]]});
  // Synergy's tile: a whip slide hides the cut to Synthia on her bend (PIVOT).
  const bend = (plan.lady || []).find(e => e.bend && e.at >= dropA.from && e.at < Aend) ?? (plan.lady || []).find(e => e.role === 'punct' && e.at >= dropA.from && e.at < Aend);
  const pv = bend ? Math.round(bend.at) : A + BS + 14;
  const whip = m('whipSlide', {id:'whip', at:A, len:Aend - A, pool:[fit('stack3.1', 1, CAST.synergyClose, CAST.synergy), fit('stack3.1', 1, CAST.synthiaClose, CAST.synthia)], cell:'stack3.1', cut:pv, scene:'dropA'});
  whip.clips[0].chrome = {speaking:speaking('voice')}; whip.clips[0].why = 'Synergy until the bend';
  add('dropA', whip);
  camera.push({id:'pivot.roll', at:pv, len:4, rot:[[0, 0], [1, -6, 'outQuad'], [4, 0, 'inOutSine']], zoom:1.06, why:'the composite rolls on the bend'});
  // The pads on each beat that has the snare and every other, the applause between: every cut on the
  // frame that holds its drum hit (the kick, or the snare as it sounds), punched in on the snare.
  const padsCell = 'stack3.2', backbeat = new Map(snareHits(plan, A, Aend).map(h => [h.step, h.late]));
  const clapShot = index.get(CAST.applause), clapRect = clapShot && clapCrop(clapShot, cellRect(format, padsCell));
  const clapFrame = clapRect ? {crop:{[format]:clapRect}} : {zoom:1.6, cx:.68};
  const beats = []; for (let s = A; s < Aend; s += QS) beats.push(s);
  beats.forEach((s, i) => {
    const late = backbeat.get(s) ?? 0, onSnare = backbeat.has(s), at = hitAt(s + late), len = i + 1 < beats.length ? QS + 1 - late : Aend - s - late;
    if (onSnare || i % 2 === 0) {
      const padsShot = fit(padsCell, 1.12, CAST.pads, CAST.opsArrive);
      const w = m('hitWarp', {id:`pads${i}`, at:s, len:QS, pool:[padsShot], cell:padsCell, scene:'dropA'});
      const clip = w.clips[0] ?? c(`pads${i}.0`, s, QS, padsCell, sh(CAST.pads), {time:{in:r6(i * .5)}});
      // Each beat a fresh slice of the plate (the warp's shape, moved on), so no slice plays a fifth time.
      if (clip.time?.map) {
        const vs = clip.time.map.map(x => x[1]), lo = Math.min(...vs), room = (index.get(padsShot)?.duration ?? 10) - .2 - (Math.max(...vs) - lo), d = (lo + i * .7) % room - lo;
        clip.time = {...clip.time, in:r6(clip.time.in + d), map:clip.time.map.map(([k, v]) => [k, r6(v + d)])};
      }
      // The cut moves to the hit (the warp keeps its shape); on the snare it punches in, from that frame.
      const to = Math.min(1.12, ceiling(padsShot, padsCell));
      add('dropA', {clips:[{...clip, at, len:r6(len), scene:'dropA', ...(onSnare ? {frame:{zoom:{keys:[[0, r6(to)], [QS, 1, 'outQuad']], hit:true}}} : {}), why:onSnare ? 'the pads on the snare, punched in' : 'the pads on the kick'}]});
    } else add('dropA', {clips:[c(`clap${i}`, at, r6(len), padsCell, sh(CAST.applause), {time:{in:r6(1 + i * .5)}, frame:clapFrame, chrome:{name:'Town hall'}, why:'the applause clap between the snares, framed on Kevin and People & Culture'})]});
  });

  // ---- Sink In: tape-coupled G4; on "in" it all freezes and sinks to 32 px --------------------------------------
  const sinkPool = [fit('G4.0', 1, CAST.synthia, CAST.synthiaClose), fit('G4.1', 1, CAST.people, CAST.peopleTalk), fit('G4.2', 1, CAST.arrive, CAST.banner), fit('G4.3', 1, CAST.synergy, CAST.synergyClose)];
  const sinkWin = {at:sinkS.from, len:sinkS.to - sinkS.from};
  const sink = add('sink', m('tapeCoupling', {id:'sink', ...sinkWin, pool:sinkPool, cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'sink'}));
  const e = (plan.lady || []).find(x => x.role === 'sink');
  let freezeStep = sinkS.from + 12;
  if (e) {
    const words = (LADY_TABLE[e.file]?.words || []).filter(w => w.start >= e.from - 1e-6 && w.start < e.to);
    const last = words.at(-1), t = last ? ladyTime(plan, e) + (last.start - e.from) / ((e.rate || 1) * (e.deep || 1)) : null;
    if (t) { let s = sinkS.from; while (s < sinkS.to - 1 && T(s + 1) <= t) s++; freezeStep = s; }
  }
  for (const x of sink.clips) {
    x.time = {...(x.time || {}), freezeAt:{at:freezeStep - x.at, len:sinkS.to - freezeStep}};
    // 4, 8, 16, then 32 px a step apart (closer when "in" lands late in the bar, so the sink always lands).
    const d = Math.min(1, (sinkS.to - freezeStep) / 4), f0 = freezeStep - x.at;
    if (!synergyShot(x.asset)) x.fx = [{type:'mosaic', px:[[0, 0], [f0, 4, 'step'], [r6(f0 + d), 8, 'step'], [r6(f0 + 2 * d), 16, 'step'], [r6(f0 + 3 * d), 32, 'step']]}];
    else x.chrome = {speaking:0};
    x.why = `${x.why}; frozen on "in" (step ${freezeStep % BS} of its bar)${!synergyShot(x.asset) ? ', sinking to 32 px blocks' : ''}`;
  }

  // ---- Drop B: the Droste dive into Pat's tile; the chase with punch-ins -------------------------------------------
  const DB = dropB.from;
  // Synergy takes the tile nearest Pat's (the Droste dive's target): the dive carries the tiles out
  // from the middle, so his mouth row stays in frame while he sings verse 3.
  const callB = [fit('G9.0', 1.12, CAST.ops, CAST.opsArrive), CAST.keysPlay, CAST.people, fit('G9.3', 1.12, CAST.kevinPlay, CAST.kevin), PAT, CAST.arjun, CAST.linda, CAST.synthia, CAST.strategy];
  {
    // His tracked mouth point in each tile (the plate's own framing): the tile that keeps it in frame
    // for as long as the tile shows, then the nearest the dive's centre, wins.
    const syn = index.get(CAST.synergy), track = TRACKING[syn?.robot], P = cellRect(format, 'G9.4'), px = P.x + P.w / 2, py = P.y + P.h / 2;
    const mouthIn = r => { if (!track) return [r.x + r.w / 2, r.y + r.h / 2]; const M = layerMatrix(r, resolveCrop(syn, {}, format, r), {zoom:1, cx:.5, cy:.5, rot:0}); return apply(invert(M), track.frames[0][0], track.frames[0][1]); };
    // (Never a tile on the board's side of Pat's: the push would carry his mouth under the held board.)
    const Bd = layout('G9', format).board, bx = Bd.x + Bd.w / 2 - px, by = Bd.y + Bd.h / 2 - py;
    // The dive (moves/look.js drosteDive) zooms about Pat's tile, cx and cy clamped to keep the frame
    // covered: a tile stays on screen while half of it is in frame, so his mouth row must leave no
    // sooner than that (lost: the zooms at which it is out while his tile still shows).
    const into = Math.min(F.w / P.w, F.h / P.h), toScreen = (z, x, y) => { const c = (q, n, s) => Math.min(Math.max(q / s, .5 / z), 1 - .5 / z) * s; return [F.w / 2 + (x - c(px, 0, F.w)) * z, F.h / 2 + (y - c(py, 0, F.h)) * z]; };
    const lost = (r, [x, y]) => { let n = 0; for (let z = 1; z <= into + 1e-9; z += .02) { const [u, v] = toScreen(z, x, y), [a, b] = toScreen(z, r.x, r.y), [c, d] = toScreen(z, r.x + r.w, r.y + r.h); const shown = Math.max(0, Math.min(F.w, c) - Math.max(0, a)) * Math.max(0, Math.min(F.h, d) - Math.max(0, b)) >= .5 * (c - a) * (d - b); if (shown && (u < 0 || v < 0 || u > F.w || v > F.h)) n++; } return n; };
    const near = [0, 1, 2, 3, 5, 6, 7, 8].map(i => { const r = cellRect(format, `G9.${i}`), [x, y] = mouthIn(r); return {i, d:Math.hypot(x - px, y - py), lost:lost(r, [x, y]), away:(x - px) * bx + (y - py) * by <= 0}; }).filter(c => c.away).sort((a, b) => a.lost - b.lost || a.d - b.d)[0].i;
    callB.splice(near, 1, CAST.synergy);
  }
  const chaseB = add('dropB', m('speakerChase', {id:'chaseB', at:DB, len:BS, pool:callB, scene:'dropB'}));
  add('dropB', m('drosteDive', {id:'droste', at:DB, len:BS, cell:'G9.4', scene:'dropB'}));
  for (const x of chaseB.clips) if (!x.asset.startsWith('gen:')) overrides.push({target:x.id, rule:'G10', note:'the Droste dive carries this tile out of frame; it is never seen at the full push'});
  const chaseC = add('dropB', m('speakerChase', {id:'chaseC', at:DB + BS, len:BS + 8, pool:callB, scene:'dropB'}));
  chaseC.clips = chaseC.clips.flatMap(x => {
    if (x.asset.startsWith('gen:')) return [x];
    const y = Object.assign(x, m('snarePunch', {clip:x, at:x.at, len:x.len, to:1.12}).clips[0], {scene:'dropB'});
    if (y.cell !== 'G9.2' && y.cell !== 'G9.6') return [y];
    // Cuts in two cells on beats 2 and 4 (the off-beat cut's partner), each on the frame that holds its backbeat.
    const alt = y.cell === 'G9.2' ? sh(fit('G9.2', 1.12, CAST.keysOffice, CAST.keys)) : sh(CAST.linda);
    const out = [];
    for (let s = y.at, j = 0; s < y.at + y.len; s += 2 * QS, j++) {
      const piece = {...clone(y), id:`${y.id}.c${j}`, at:s, len:Math.min(2 * QS, y.at + y.len - s), asset:j % 2 ? alt : y.asset, time:{in:r6((y.time?.in ?? 0) + j * .5)}, why:j ? 'a cut on the beat' : y.why};
      delete piece.frame;
      out.push(m('snarePunch', {clip:piece, at:piece.at, len:piece.len, to:1.12}).clips[0]);
    }
    return out;
  });
  // The kaleido of the pads, in L1 so the board panel carries the hook over it; then the dub delay on Synergy.
  const K = DB + 2 * BS + 8;
  const kal = m('kaleido', {id:'kal', at:K, len:4, pool:[CAST.pads], cell:'L1.0', scene:'dropB'});
  for (const x of kal.clips) overrides.push({target:x.id, rule:'G11', note:'drum-pad-detail is on the shot index’s hand-verified mirror-safe list; plan §2 bar 26 asks for the 2x2 kaleido of the pads (Roll Call stays gated, D3)'},
    {target:x.id, rule:'G10', note:'2x2 tiles: each copy is drawn at half the cell, so the real upscale is half of what G10 reads'});
  add('dropB', kal);
  const dub2 = add('dropB', m('dubDelay', {id:'dub2', at:K + 4, len:4, delay:1, pool:[CAST.synergy], cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'dropB'}));
  for (const x of dub2.clips) { x.chrome = {name:'Synergy', speaking:speaking('voice')}; x.why = `${x.why}: 16th taps, the dotted 8th needs 9 steps`; }
  dub2.clips.push(...dub2.clips.filter(x => x.at > K + 4).map(x => ({...clone(x), id:`${x.id}.wait`, at:K + 4, len:x.at - K - 4, time:{...x.time, freezeAt:0}, why:'waits for its tap'})));

  // ---- the fill: the tile cascade, then the replay of the half bar before -----------------------------------------
  const FB = DB + 3 * BS;
  const cascadePool = [CAST.synergy, fit('G9.1', 1, CAST.ops, CAST.opsArrive), CAST.keysPlay, fit('G9.3', 1, CAST.kevinPlay, CAST.kevin), CAST.synthia, CAST.people, CAST.arjun, CAST.strategy, PAT];
  const fill = [];
  for (let j = 0; j < 9; j++) {
    const lands = Math.min(j, 7), at = FB + lands, cell = `G9.${j}`;
    const pre = cascadePool[(j + 4) % 8];
    if (j < 8 && lands > 0) fill.push(c(`cascade.pre${j}`, FB, lands, cell, sh(pre), {time:{in:3, freezeAt:0}, frame:{opacity:.55}, why:'held, waiting for its note'}));
    const who = cascadePool[j], asset = who.startsWith('gen:') ? who : sh(who);
    fill.push(c(`cascade.${j}`, j < 8 ? at : FB, j < 8 ? 8 - lands : 8, cell, asset, {time:asset.startsWith('gen:') ? undefined : {in:2}, chrome:{speaking:j < 8 ? [[0, 1], [1, 0, 'step']] : 0}, why:j < 8 ? `tile cascade: cut ${j + 1} of 8` : 'Pat holds the ninth tile'}));
  }
  add('fill', {clips:fill});
  const replay = [...kal.clips, ...dub2.clips].map(x => ({...clone(x), id:`replay.${x.id}`, at:x.at + BS, scene:'fill', why:'the second half of the fill replays the half bar before it'}));
  add('fill', {clips:replay});
  for (const x of kal.clips) overrides.push({target:`replay.${x.id}`, rule:'G11', note:'the replay of the kaleido'}, {target:`replay.${x.id}`, rule:'G10', note:'2x2 tiles, as before'});

  // ---- the outro: everyone leaves the meeting; the tape stops; black; the ghost BACK. -------------------------------
  const leaveEvery = Math.max(QS, Math.min(2 * QS, Math.floor((stopAt - outro.from) / 5 / QS) * QS));
  const leavers = [fit('L1.0', 1, CAST.synergyClose, CAST.synergy), fit('split.1', 1, CAST.ops, CAST.opsArrive), fit('G4.2', 1, CAST.keys, CAST.keysOffice), CAST.synthia, PAT, fit('G6.5', 1, CAST.kevinTalk, CAST.kevin)];
  const leave = add('leave', m('leaveMeeting', {id:'leave', at:outro.from, len:plan.totalSteps - outro.from, every:leaveEvery, pool:leavers, scene:'leave'}));
  // Two left on the call share the frame (split), not the top half of a 2×2.
  const byAt = new Map();
  for (const x of leave.clips) { if (!byAt.has(x.at)) byAt.set(x.at, []); byAt.get(x.at).push(x); }
  for (const list of byAt.values()) if (list.length === 2 && list.every(x => /^G4\.[01]$/.test(x.cell))) list.forEach(x => { x.cell = `split.${x.cell.slice(3)}`; });
  for (const x of leave.clips) if (x.cell === 'L1.0' && !x.asset.startsWith('gen:')) {
    const s = index.get(x.asset.replace(/^shot:/, ''));
    if (s && ceiling(s.id, 'L1.0') < 1) overrides.push({target:x.id, rule:'G10', note:'the closing shot of Synergy alone; the tape stop holds it'});
  }
  // The tape stop: the picture follows the curve to its hold and holds there while her "Full stop."
  // (after the tape) still sounds: the board keeps it lit and fully typed. Black from the first
  // frame after she stops (anchors.js stopFrames), and never before the curve has run.
  const N = cutFrame(T(plan.totalSteps)), at = f => ({anchor:'step:0', frames:f}), span = (a, b) => r6(S(b / 24) - S(a / 24));
  const curveEnd = cutFrame(T(stopAt)) + Math.ceil((stop?.seconds ?? .4) * 24 - 1e-9), her = stopFrames(plan);
  const blackFrame = Math.min(N, Math.max(curveEnd, her?.black ?? curveEnd));
  // The ghost BACK. takes the last two frames, or what is left of them once she has stopped.
  const ghostFrom = Math.min(N, Math.max(N - 2, blackFrame));
  // Synergy's last close-up slows to a held frame: hold one with his eyes open. Every frame the
  // slow-down shows, the hold included, stays two frames clear of his blinks (robot-tracks.json),
  // moving the clip's source by the fewest frames that do it.
  const v0 = Math.min(T(stopAt), cutFrame(T(stopAt)) / 24), vHold = T(stopAt) + (stop?.seconds ?? .4) / 2;
  for (const x of leave.clips) {
    const s = x.asset.startsWith('shot:') ? index.get(x.asset.slice(5)) : null, blinks = s && TRACKING[s.robot]?.blinks;
    if (!blinks?.length || typeof x.at !== 'number' || T(x.at) > v0 || T(x.at + x.len) < vHold || x.time?.rate !== undefined || x.time?.map || x.time?.freezeAt !== undefined) continue;
    const inS = x.time?.in ?? 0, frameAt = (v, d) => Math.floor((inS + d / 24 + v - T(x.at)) * 24 + 1e-6);
    const clear = d => { const a = frameAt(v0, d), b = frameAt(vHold, d); return frameAt(T(x.at), d) >= 0 && b < s.frames - 1 && blinks.every(([p, q]) => b < p - 2 || a > q + 2); };
    const d = [0, ...Array.from({length:48}, (_, i) => [-(i + 1), i + 1]).flat()].find(clear);
    if (d) { x.time = {...(x.time || {}), in:r6(inS + d / 24)}; x.why = `${x.why ?? ''}; the tape stop holds source frame ${frameAt(vHold, d)}, eyes open (${d > 0 ? '+' : ''}${d} frames off a blink)`.replace(/^; /, ''); }
  }
  const ts = m('tapeStop', {at:stopAt, len:r6(S(blackFrame / 24) - stopAt)}).transports[0];
  transports.push({...ts, why:'the picture follows the tape-stop curve, then holds until her "Full stop." has stopped sounding'});
  // True black after it: a full black tile under an L1 one, so the layout has no board region.
  if (ghostFrom > blackFrame) add('leave', {clips:[c('tail', at(blackFrame), span(blackFrame, ghostFrom), 'full', BLACK, {why:'true black from the first frame after her "Full stop."'}), c('tail.l1', at(blackFrame), span(blackFrame, ghostFrom), 'L1.0', BLACK, {why:'keeps the board out of the black'})]});
  // The ghost BACK.: frame 0's BACK. screen at I .08, flat, on true black, on frame 0's peg grid (a
  // black tile through the ignition's peg video pitch), so the loop closes on the same peg mask.
  if (ghostFrom < N) {
    const pitch = ign.clips[0].fx?.find(x => x.type === 'pegVideo')?.pitch ?? 12;
    add('leave', {clips:[c('ghost', at(ghostFrom), span(ghostFrom, N), 'full', BLACK, {fx:[{type:'pegVideo', mix:1, pitch, levels:6, gamma:1.4}], why:'the loop seam: black on the ignition’s peg grid, under the ghost BACK.'})]});
    board.push({id:'ghost', at:at(ghostFrom), len:span(ghostFrom, N), text:{ref:'song:impact'}, ghost:GHOST, why:'ghost BACK.: frame 0’s BACK. on the same pegs, at I .08 (plan §2 row 29)'});
  }

  const edl = merge(createEDL({format, loop:true, seed, track:plan.track, board, transports, camera, boardMoves, overrides}), ...patches);
  // Clean: no undefined fields.
  for (const x of edl.clips) {
    for (const key of Object.keys(x)) if (x[key] === undefined) delete x[key];
    if (x.chrome) for (const key of Object.keys(x.chrome)) if (x.chrome[key] === undefined) delete x.chrome[key];
  }
  return edl;
}
