// The draft cut: "Circle Back, Drop Edition 60", plan §2 (the flagship film table)
// as an EDL treatment, built from the move library on the real shot index. Every
// row of the table is here, done as written, done with a stand-in where it waits on
// a Runway pickup or a canon rule, or skipped where the compositor has no means yet;
// ROWS says which, and each clip's `why` says so where it matters.
//
//   const edl = drop60Draft(plan, SHOTS, {format:'9:16'});
//   compile(edl, {plan, shots:SHOTS}).lint.errors   // []
//
// Pure: the same plan, shots and format give the same EDL (every move draws on the seed).
// Bars are the Drop Edition's (30 bars, 60.000 s at 120 BPM); the moments that matter
// (the choke, the impact, Sink In, the tape stop, the lady's ladder) come from the plan,
// so the cut follows the song's clock at any tempo.
import {MOVES} from '../moves/index.js';
import {createEDL, merge} from '../edl/schema.js';
import {barSteps, beatSteps, stepTime, stepAtTime, ladyTime} from '../edl/anchors.js';
import {shotIndex, isSynergy, resolveCrop, UPSCALE} from '../edl/compile.js';
import {cellRect, FORMATS} from '../layouts.js';
import {LADY_TABLE} from '../../allhands/lady-table.js';

// Who plays whom. Ids are shot-index aliases.
export const CAST = {
  synergy:'synergy-camera-v2-listening', synergyClose:'synergy-enthusiastic-training-close-up', synergyTake:'synergy-synergy-v2-original-take',
  opsArrive:'drummer-arrival-performance', ops:'drums-playing', pads:'drum-pad-detail',
  keys:'keys-listening-wide-keys', keysPlay:'keys-playing-wide-keys', keysOffice:'keys-office-performance',
  kevin:'guitar-listening', kevinPlay:'guitar-playing', kevinOffice:'guitar-office-performance', kevinTalk:'kevin-standup-v1',
  people:'people-listening', peopleDesk:'people-linkedin-computer', arjun:'arjun-listening', linda:'linda-listening', strategy:'strategy-listening',
  synthia:'synthia-clean-face-plate', synthiaClose:'synthia-conference-closeup',
  ensemble:'office-ensemble', applause:'corporate-applause-closer-reaction', arrive:'the-professionals-arrive', banner:'banner-installation-blank-plates',
  printer:'printer-outward-feed',
};
const PAT = 'gen:camera-off', BOARD = 'gen:board', BLACK = 'gen:color:#000000';
const sh = id => `shot:${id}`;

// What the monitor's cut list calls each scene.
export const SCENE_LABELS = {cold:'Cold open', join:'Grid bloom', verse:'Unmute', hook:'Screen share', verse2:'Dub delay', freeze:'Freeze the call',
  rooms:'Breakout rooms', split:'Cell split', roll:'Retrigger roll', ladder:'Poor connection', dropA:'BACK.', sink:'Sink In',
  dropB:'Droste dive', fill:'Read that again', leave:'Leave meeting'};

// Plan §2, row by row: what this cut does with each. status: done | stand-in | partial | skipped.
export const ROWS = [
  {row:'0:0-5', what:'Cold: BACK. as peg video, board white-hot', status:'stand-in', note:'the-professionals-arrive takes the peg video: Synergy is in office-ensemble and peg video warps (canon G11). BACK. is the song impact screen moved to frame 0. EQ columns are not drawn yet.'},
  {row:'0:6-7', what:'REWIND from bars 17-19, scanline wobble, letters un-pop', status:'partial', note:'Transport rewind at 4x from bar 18 (the retrigger roll backwards, letters un-popping). No scanline wobble: camera cues follow the song time the rewind shows, so it would also land on bar 17. drop.js has no reversed tape scrub yet, so the sound does not rewind.'},
  {row:'0:8-15', what:"Pat's black tile, CONNECTING TO AUDIO", status:'done', note:'Board cue in TYPEWRITER over the camera-off tile. The hook ghosts at I .08 are not drawn (no ghost intensity in board cues).'},
  {row:'1', what:'Grid bloom, one tile a beat with a joined toast', status:'done', note:'Pat joins first, then Operations: no drums plate holds a full 9:16 frame inside its zoom ceiling. Mic borders dark until the unmute.'},
  {row:'2', what:'G6 complete; reaction canon nod at 2:8; printer at 8 fps', status:'stand-in', note:'The synchronized-nod pickup (Runway 1) is not in: the call ripples in canon instead (each tile holds at 2:8, released a step later than the last). Printer at 8 fps stop-motion is done.'},
  {row:'3', what:"Gallery Unmute push into Synergy's cell; mute icons on the hats", status:'done', note:'Composite camera 1.0 to 1.3 outExpo; the drummer’s mic toggles on every 8th.'},
  {row:'4-5', what:'UNMUTE: Synergy fills the frame in 3 f, stack3, slow push, vocal cuts', status:'done', note:'Synergy grows from his tile to the frame in 3 frames at 4:0, stack3 from 4:4 with Pat’s board, reactors cut one frame before the sung words.'},
  {row:'6-7', what:'Ops reactor, snare punch-in, off-beat cut at 6:10, freeze + label at 7:8', status:'done', note:'Operations is hit-warped (the measured conform rate is now 1.000, so the warp does the work the 1.019 did). ARJUN / FINANCE in PEG-5.'},
  {row:'8-9', what:"Hook: BOARD+STRIP, screen-share banner, slam-word crash zoom, snap ladder", status:'done', note:'Crash zoom on the slam word in Synergy’s tile, the steep snap ladder on the repeat in the keys tile. The department chart is not drawn yet.'},
  {row:'10-11', what:'Dub delay at 10:12, active-speaker chase in bar 11', status:'done', note:'Four taps a dotted 8th apart at .7 / .49 / .34; drop.js has no matching audio throw yet (the move says so).'},
  {row:'12-13', what:'Freeze the call except Ops; canon unfreeze wave', status:'done', note:''},
  {row:'14-15', what:'Breakout rooms 2 then 4, snap ladder, outer-ring mosaic 4 to 8 px', status:'done', note:''},
  {row:'16', what:'Cell split 1/2/4/8 on drum-pad-detail, mirrored, mosaic 16 px', status:'done', note:'Mirrored on alternate axes with a G11 waiver: the shot index verifies drum-pad-detail mirror-safe, the lint forbids mirroring any instrument. Lead and Aaron to settle.'},
  {row:'17', what:'Retrigger roll, hat roll, RGB split on the roll', status:'done', note:''},
  {row:'18', what:"Board with Synergy's cell, alternating every 16th, poor connection", status:'done', note:'BOARD+STRIP: the lady’s LE on the board, Synergy’s small tile lights on his stammers. Mosaic 32 px on the side tiles only: never on Synergy (canon).'},
  {row:'19:0-7', what:'BOARD, L at k4', status:'done', note:'The song’s own screens; SPARKLE dissolve is the board’s.'},
  {row:'19:8-11', what:'Choke: black, LET’S CIRCLE on bare sockets', status:'done', note:''},
  {row:'19 silence', what:'True black, frames 948-959', status:'done', note:'The board’s true black.'},
  {row:'20', what:'IGNITION: peg video, then stack3 ensemble / Synergy / pads; push on the ensemble', status:'stand-in', note:'Peg video on the-professionals-arrive (as at 0:0); stack3 has the ensemble. Pat’s CONNECTED flip and the kick lift are not drawn.'},
  {row:'21', what:'Pads on the snare alternating with applause; whip slide and composite roll on PIVOT', status:'partial', note:'The arrangement puts PIVOT at 22:2 and keeps Drop A to bar 23, so stack3 runs 20:8-23:0 and the whip slide (Synergy to Synthia) and the composite roll land on her PIVOT where the song has it. The printer’s page eject at 21:12 is skipped: no printer tile in stack3.'},
  {row:'22-23', what:'Sink In: G4 tape-coupled, freeze on "in", outer cells sink to 32 px', status:'done', note:'Sink In is bar 23 in the arrangement (the tape falls across it), so the G4 starts there. The freeze lands on the measured onset of "in" in her deep take (23:12); Synergy keeps his face, the others sink to 32 px. The page drifting into the droid’s tile is skipped.'},
  {row:'24', what:"Drop B: G9, rates snap back, Droste dive into Pat's cell", status:'done', note:''},
  {row:'25', what:'Chase light on 8ths, punch-ins, 2 to 4 cuts a bar', status:'done', note:''},
  {row:'26', what:'Kaleido 2x2 of the drum pads; dub delay on Synergy at 26:12', status:'done', note:'Roll Call stays gated (D3). The dub delay taps on 16ths: a dotted 8th needs 9 steps and the window has 4.'},
  {row:'27', what:'Tile cascade 27:0-7; 27:8-28:0 replays 26:8-27:0; READ THAT AGAIN.', status:'done', note:''},
  {row:'28', what:'Leave Meeting: a tile a beat, toasts', status:'done', note:'Seven tiles, Kevin leaves first; G9 to G6 to G4, the last two share a split, Synergy alone from 29:8.'},
  {row:'29', what:'G1 Synergy, tape stop, black from f1426, ghost BACK. on f1438-1439', status:'done', note:'True black from frame 1426. The last two frames are a two-frame rewind to the top (song time 4.5 frames, then half a frame), so the loop closes on frame 0’s peg mask; the sound is silent there.'},
  {row:'Runway pickups', what:'nod wide, overhead table, drum strike, pick hand, pages, robot duet, Strategy 10 s, privacy shutter', status:'stand-in', note:'None supplied yet. Stand-ins: the canon ripple (nod), drum-pad-detail (strike), printer-outward-feed (pages), strategy-listening at 3.5 s (Strategy). The rest have no row of their own in §2.'},
];

const speaking = stem => ({bind:`stem:${stem}`, scale:1.5, base:-.3, attack:.02, release:.3});
const clone = x => JSON.parse(JSON.stringify(x));

export function drop60Draft(plan, shots, {format = '9:16', features, seed = 7} = {}) {
  const BS = barSteps(plan), QS = beatSteps(plan), bar = n => n * BS, F = FORMATS[format];
  const index = shotIndex(shots);
  const m = (name, ctx) => MOVES[name].fn({plan, shots, features, format, seed, ...ctx});
  const c = (id, at, len, cell, asset, more = {}) => ({id, at, len, cell, asset, ...more});
  const patches = [], board = [], camera = [], overrides = [], transports = [];
  const add = (scene, p) => { for (const x of p.clips || []) { x.scene ??= scene; } patches.push(p); return p; };
  // The zoom ceiling of a shot in a cell (U · crop.h / cell.h); `fit` picks the first that holds `zoom`.
  const ceiling = (id, cell) => { const s = index.get(id), r = cellRect(format, cell); if (!s || !r) return 0; return (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, format, r).h / r.h; };
  const fit = (cell, zoom, ...ids) => ids.find(id => ceiling(id, cell) >= zoom - 1e-9) ?? ids.at(-1);
  const choke = plan.choke ?? {at:bar(19) + 8, until:bar(20)};
  const stop = (plan.tape || []).find(t => t.kind === 'stop');

  // ---- 0:0-0:8 cold open: BACK. as peg video, flash-forward; then the tape rewinds ----------------
  add('cold', m('pegTakeover', {id:'open', at:0, len:6, pool:[CAST.arrive], instant:true, scene:'cold'}));
  patches.at(-1).clips[0].why = 'stand-in: office-ensemble has Synergy in it, and peg video warps (G11); the-professionals-arrive takes the peg video';
  transports.push(...m('rewind', {id:'rewind', at:6, len:2, from:{anchor:`bar:${18}`}}).transports);
  // (No scanline wobble: camera cues run on the song time the rewind shows, so a wobble here would also land on bar 17.)
  // BACK. lit from frame 0 (a moved song screen would replay its centre-out reveal and miss the ignition).
  board.push({id:'cold', at:0, len:6, text:'BACK.', k:3, reveal:'pop', palette:'white', why:'flash-forward: BACK. white-hot from frame 0'});
  // 0:8-1:0 Pat's black tile; the call connects.
  add('cold', {clips:[c('pat', 8, 8, 'full', PAT, {chrome:{mic:'muted'}, why:"Pat's camera is off; the call is connecting"})]});
  board.push({id:'connecting', at:8, len:8, text:'CONNECTING TO AUDIO…', reveal:'typewriter', palette:'white', k:1});
  board.push({id:'song', at:bar(1) + 12, text:{ref:'song'}});
  board.push({id:'mute', at:bar(3), len:14, text:{ref:'song:title#0'}, why:"YOU'RE ON MUTE in the strip in bar 3"});

  // ---- bars 1-3: the grid bloom; the canon ripple; the gallery unmute ----------------------------------
  const opsTile = fit('G4.1', 1, CAST.opsArrive, CAST.ops), keysTile = fit('G4.2', 1, CAST.keysPlay, CAST.keysOffice), kevinTile = fit('G4.3', 1, CAST.kevin, CAST.kevinOffice);
  const synTile = fit('G6.4', 1, CAST.synergy, CAST.synergyClose), printTile = CAST.printer;
  const bloom = add('join', m('gridBloom', {id:'join', at:bar(1), len:bar(3), pool:[PAT, opsTile, keysTile, kevinTile, synTile, printTile], scene:'join'}));
  const unmuteStep = plan.call?.until ?? bar(4);
  for (const x of bloom.clips) {
    x.chrome = {...(x.chrome || {}), mic:'muted'};
    const asset = x.asset.replace(/^shot:/, '');
    if (asset === printTile) {
      // The printer at 8 fps: each source frame held for 3 output frames.
      const frames = Math.round((stepTime(plan, x.at + x.len) - stepTime(plan, x.at)) * 24) + 3, keys = [[0, 0]];
      for (let k = 2; k < frames; k += 3) keys.push([k, 3, 'step'], [k + 1, 0, 'step']);
      x.time = {...(x.time || {}), rate:{keys, unit:'frames'}};
      x.why = 'the printer at 8 fps stop-motion';
    }
  }
  // 2:8 the canon ripple (stand-in for the synchronized nod): every tile but the drummer and
  // Pat holds at 2:8 and lets go one step after the tile before it.
  const g6 = bloom.clips.filter(x => x.cell.startsWith('G6.') && x.at <= bar(2) + 8 && x.at + x.len > bar(2) + 8);
  let k = 0;
  for (const x of g6) {
    if (x.asset === PAT || x.asset === sh(opsTile)) continue;
    k++;
    x.time = {...(x.time || {}), freezeAt:{at:bar(2) + 8 - x.at, len:k}};
    x.why = `canon ripple (stand-in for the synchronized-nod pickup): holds ${k} step${k > 1 ? 's' : ''} at 2:8`;
  }
  // Bar 3: the drummer's mic toggles on every 8th (the hats); the camera pushes into Synergy's cell.
  const ops = g6.find(x => x.asset === sh(opsTile));
  if (ops) {
    const end = ops.at + ops.len, from = bar(3), list = [];
    const inAt = s => +((ops.time?.in ?? 0) + (Math.round(stepTime(plan, s) * 24) - Math.round(stepTime(plan, ops.at) * 24)) / 24).toFixed(6);
    ops.len = from - ops.at;
    for (let s = from, j = 0; s < end; s += 2, j++) list.push({...clone(ops), id:`join.hats.${j}`, at:s, len:Math.min(2, end - s), time:{...(ops.time || {}), in:inAt(s)}, chrome:{...ops.chrome, mic:j % 2 ? 'muted' : 'on', toast:undefined}, why:'mute icon on the hats'});
    for (const x of list) delete x.chrome.toast;
    bloom.clips.push(...list);
  }
  const synCell = cellRect(format, g6.find(x => x.asset === sh(synTile))?.cell ?? 'G6.4');
  camera.push({id:'unmute.push', at:bar(3), len:bar(1), zoom:[[0, 1], [bar(1), 1.3, 'outExpo']], cx:+((synCell.x + synCell.w / 2) / F.w).toFixed(4), cy:+((synCell.y + synCell.h / 2) / F.h).toFixed(4), why:"Gallery Unmute: the push into Synergy's cell"});

  // ---- bars 4-7: UNMUTE. Synergy fills the frame in 3 frames, then stack3 ------------------------------
  const host = fit('stack3.0', 1.15, CAST.synergy, CAST.synergyClose), close = fit('L1.0', 1, CAST.synergyClose, CAST.synergy);
  add('verse', {clips:[c('fill', bar(4), 4, 'L1.0', sh(close), {time:{in:1}, frame:{zoom:{keys:[[0, +(synCell.h / cellRect(format, 'L1.0').h * 1.3).toFixed(4)], [3, 1, 'outQuad']], unit:'frames'}}, chrome:{mic:'on', speaking:speaking('voice')}, why:'UNMUTE: Synergy fills the frame in 3 frames'})]});
  const push = add('verse', m('slowPush', {id:'host', at:bar(4) + 4, len:bar(4) - 4, pool:[host], cell:'stack3.0', scene:'verse'}));
  for (const x of push.clips) x.chrome = {mic:'on', speaking:speaking('voice')};
  add('verse', {clips:[c('patboard', bar(4) + 4, bar(4) - 4, 'stack3.1', BOARD, {chrome:{name:'Pat', mic:'on'}, why:"Pat's camera is off: his tile is the board"})]});
  // Bars 4-5: vocal cuts on the reactor, Kevin then Keys (hands) at 5:0.
  const r0 = fit('stack3.2', 1, CAST.kevin, CAST.kevinOffice), r1 = fit('stack3.2', 1, CAST.keys, CAST.keysOffice), r2 = fit('stack3.2', 1, CAST.people, CAST.peopleDesk), r3 = fit('stack3.2', 1, CAST.linda, CAST.synthiaClose);
  add('verse', m('vocalCut', {id:'react', at:bar(4) + 4, len:bar(2) - 4, pool:[r0, r1, r2, r3], cell:'stack3.2', scene:'verse'}));
  // Bar 6: Operations hit-warped with the snare punch-in; the off-beat cut at 6:10; bar 7 freeze + label.
  const opsReact = fit('stack3.2', 1.12, CAST.ops, CAST.opsArrive, CAST.pads);
  const warp = m('hitWarp', {id:'opsReact', at:bar(6), len:10, pool:[opsReact], cell:'stack3.2', scene:'verse'});
  const opsClip = warp.clips[0] ?? c('opsReact.0', bar(6), 10, 'stack3.2', sh(opsReact), {time:{in:0}});
  Object.assign(opsClip, m('snarePunch', {clip:opsClip, at:opsClip.at, len:opsClip.len, to:1.12}).clips[0], {scene:'verse', chrome:{speaking:speaking('drums')}});
  add('verse', {clips:[opsClip]});
  const arjun = fit('stack3.2', 1, CAST.arjun, CAST.peopleDesk);
  add('verse', {clips:[c('offbeat', bar(6) + 10, bar(7) + 8 - (bar(6) + 10), 'stack3.2', sh(fit('stack3.2', 1, CAST.keysPlay, CAST.keysOffice)), {time:{in:2}, chrome:{speaking:speaking('keys')}, why:'off-beat cut at 6:10'})]});
  const label = m('freezeLabel', {id:'label', at:bar(7) + 8, len:8, pool:[arjun], cell:'stack3.2', name:'Arjun', role:'Finance', scene:'verse'});
  add('verse', label); board.push(...label.board.map(b => ({...b, text:'ARJUN / FINANCE'})));

  // ---- bars 8-9: the hook. Synergy shares his screen ------------------------------------------------------
  const hookWords = (plan.words || []).filter(w => w.kind === 'hook' && w.at >= bar(8) && w.at < bar(10));
  const slam = hookWords.filter(w => w.at < bar(9)).at(-1), again = hookWords.filter(w => w.at >= bar(9));
  const share = c('share', bar(8), bar(2), 'BOARD+STRIP.1', sh(fit('BOARD+STRIP.1', 1.6, CAST.synergy, CAST.synergyClose)), {time:{in:2}, chrome:{banner:"You are viewing Synergy's screen", speaking:speaking('voice')}});
  const crash = slam ? m('crashZoom', {clip:share, at:slam.at, len:bar(10) - slam.at, to:1.6}).clips[0] : share;
  crash.why = `slam-word crash zoom on "${slam?.display ?? 'the hook'}"`;
  const keysHook = c('shareKeys', bar(8), bar(2), 'BOARD+STRIP.0', sh(fit('BOARD+STRIP.0', 1.78, CAST.keysPlay, CAST.keysOffice)), {time:{in:1}, chrome:{speaking:speaking('keys')}});
  const ladder = again.length ? m('snapLadder', {clip:keysHook, at:bar(9), len:bar(1), ladder:'steep', hits:again.map(w => w.at)}).clips[0] : keysHook;
  ladder.why = 'snap ladder 1 / 1.33 / 1.78 on the repeated hook';
  add('hook', {clips:[crash, ladder, c('shareOps', bar(8), bar(2), 'BOARD+STRIP.2', sh(fit('BOARD+STRIP.2', 1, CAST.opsArrive, CAST.ops)), {time:{in:3}, chrome:{speaking:speaking('drums')}})]});

  // ---- bars 10-11: verse 2. The chase, vocal cuts in one tile, the dub delay from 10:12 ---------------------
  // 10:0-10:12 the border chases the loudest player; 10:12-11:8 Synergy's throw echoes through
  // four tiles a dotted 8th apart (each tile keeps its player until its tap lands); 11:8 the chase again.
  const chase = [CAST.synergy, fit('G6.1', 1, CAST.ops, CAST.opsArrive), CAST.keys, CAST.kevin, CAST.people, PAT];
  const v2 = add('verse2', m('speakerChase', {id:'v2', at:bar(10), len:12, pool:chase, scene:'verse2'}));
  v2.clips = v2.clips.filter(x => x.cell !== 'G6.4');
  add('verse2', m('vocalCut', {id:'v2cut', at:bar(10), len:12, pool:[CAST.linda, CAST.strategy, CAST.arjun], cell:'G6.4', scene:'verse2'}));
  const dubAt = bar(10) + 12, dubLen = 12, delay = 3;
  const dub = add('verse2', m('dubDelay', {id:'dub', at:dubAt, len:dubLen, delay, pool:[CAST.synergy], cells:['G6.0', 'G6.1', 'G6.2', 'G6.3'], scene:'verse2'}));
  for (const x of dub.clips) { x.chrome = {name:'Synergy', speaking:speaking('voice')}; x.why = `${x.why}, opacity ${x.frame?.opacity ?? 1}`; }
  const carry = (x, at, len, id) => ({...clone(x), id, at, len, time:x.time ? {...x.time, in:+((x.time.in ?? 0) + (Math.round(stepTime(plan, at) * 24) - Math.round(stepTime(plan, x.at) * 24)) / 24).toFixed(6)} : undefined, why:'keeps its player until the tap lands'});
  for (const x of v2.clips) {
    const tap = ['G6.1', 'G6.2', 'G6.3'].indexOf(x.cell);
    if (tap >= 0) add('verse2', {clips:[carry(x, dubAt, (tap + 1) * delay, `v2.wait${tap + 1}`)]});
    if (x.cell === 'G6.5') add('verse2', {clips:[carry(x, dubAt, dubLen, 'v2.pat')]});
  }
  add('verse2', {clips:[c('v2.strategy', dubAt, dubLen, 'G6.4', sh(CAST.arjun), {time:{in:1}, why:'a listener through the throw'})]});
  add('verse2', m('speakerChase', {id:'chase', at:dubAt + dubLen, len:bar(12) - dubAt - dubLen, pool:chase, scene:'verse2'}));

  // ---- bars 12-13: freeze the call (all but the drummer), then the canon unfreeze wave ---------------------
  const call9 = [CAST.synergy, fit('G9.1', 1, CAST.ops, CAST.opsArrive), CAST.keys, CAST.kevin, PAT, CAST.people, CAST.arjun, CAST.synthia, BOARD];
  const frozen = add('freeze', m('freezeTheCall', {id:'freeze', at:bar(12), len:bar(1), pool:call9, scene:'freeze'}));
  for (const x of frozen.clips) if (x.asset === BOARD) x.chrome = {name:'Pat'};
  const wave = frozen.clips.map((x, j) => {
    const y = {...clone(x), id:`thaw.${j}`, at:bar(13), len:bar(1), scene:'freeze'};
    if (y.asset.startsWith('gen:') || y.why === 'the soloist stays live') { if (y.time) y.time.in = +((x.time?.in ?? 0) + (stepTime(plan, bar(13)) - stepTime(plan, bar(12)))).toFixed(6); y.why = 'live through the wave'; return y; }
    y.time = {...(y.time || {}), freezeAt:{at:0, len:j + 1}};
    y.fx = [{type:'saturation', amount:[[0, .4], [j + 1, 1, 'step']]}];
    y.why = `canon unfreeze wave: tile ${j} thaws ${j + 1} steps in`;
    return y;
  });
  add('freeze', {clips:wave});

  // ---- bars 14-15: breakout rooms, two then four; the outer ring coarsens ---------------------------------
  const rooms = add('rooms', m('breakoutRooms', {id:'rooms', at:bar(14), len:bar(2), skip:1, pool:[CAST.synergy, CAST.keys, CAST.people, CAST.arjun, CAST.synthia, CAST.strategy, CAST.linda, CAST.applause], scene:'rooms'}));
  for (const x of rooms.clips) {
    const r = cellRect(format, x.cell), dx = (r.x + r.w / 2) / F.w - .5, dy = (r.y + r.h / 2) / F.h - .5, outer = Math.hypot(dx, dy) > .3;
    const s = index.get(x.asset.replace(/^shot:/, ''));
    if (outer && s && !isSynergy(s)) { (x.fx ??= []).push({type:'mosaic', px:[[0, 4], [x.len, 8]]}); x.why = `${x.why ?? ''}; the outer ring coarsens 4 to 8 px`.replace(/^; /, ''); }
  }

  // ---- bar 16: the cell split, one decode of the pads, mirrored ---------------------------------------------
  const split = add('split', m('cellSplit', {id:'split', at:bar(16), len:bar(1), pool:[CAST.pads], cell:'L1.0', scene:'split'}));
  split.clips.forEach((x, i) => {
    x.fx = [{type:'mosaic', px:[[0, 8], [QS, 10, 'step'], [2 * QS, 13, 'step'], [3 * QS, 16, 'step']]}];
    if (x.frame?.mirror) overrides.push({target:x.id, rule:'G11', note:'drum-pad-detail is on the shot index’s hand-verified mirror-safe list (no hands, no text); plan §2 bar 16 mirrors it on alternate axes'});
  });

  // ---- bar 17: the retrigger roll; hat roll and RGB split bound to the roll ---------------------------------
  const roll = add('roll', m('retriggerRoll', {id:'roll', at:bar(17), len:bar(1), pool:[fit('G4.0', 1.15, CAST.keysPlay, CAST.keysOffice), CAST.synergy, fit('G4.2', 1.15, CAST.opsArrive, CAST.pads), CAST.applause], cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'roll'}));
  for (const cell of ['G4.0', 'G4.1', 'G4.2', 'G4.3']) {
    const first = roll.clips.filter(x => x.cell === cell).sort((a, b) => stepTime(plan, typeof a.at === 'number' ? a.at : 0) - stepTime(plan, typeof b.at === 'number' ? b.at : 0))[0];
    const at = first && (typeof first.at === 'number' ? first.at : plan.lady.find(e => e.role === 'ladder' && `lady:r${e.rung}#${plan.lady.filter(x => x.role === 'ladder' && x.rung === e.rung).indexOf(e)}` === first.at.anchor)?.at);
    if (first && at > bar(17)) roll.clips.push({id:`roll.hold.${cell}`, at:bar(17), len:at - bar(17), cell, asset:first.asset, time:{in:+((first.time?.in ?? 0) + .5).toFixed(6), freezeAt:0}, fx:[{type:'saturation', amount:.5}], scene:'roll', why:'holds a greyed frame until its retrigger'});
  }
  roll.clips = roll.clips.map(x => {
    const y = m('hatRoll', {clip:x, at:x.at, len:x.len}).clips[0];
    const s = index.get(y.asset.replace(/^shot:/, ''));
    if (s && !isSynergy(s)) (y.fx ??= []).push({type:'rgbSplit', px:{bind:'roll', scale:10, attack:0, release:.05}, angle:0});
    return y;
  });

  // ---- bar 18: the board with Synergy's tile; poor connection on the side tiles ----------------------------
  const r6 = (plan.lady || []).filter(e => e.role === 'ladder' && e.at >= bar(18) && e.at < bar(19));
  const sat = [[0, .35]], talk = [[0, 0]];
  for (const st of (plan.stutters || []).filter(s => s.at >= bar(18) && s.at < bar(19))) { sat.push([st.at - bar(18), 1, 'step'], [st.at - bar(18) + 1, .35, 'step']); talk.push([st.at - bar(18), 1, 'step'], [st.at - bar(18) + 1, 0, 'step']); }
  add('ladder', {clips:[c('poorHost', bar(18), bar(1), 'BOARD+STRIP.1', sh(CAST.synergy), {time:{in:4}, fx:[{type:'saturation', amount:sat}], chrome:{banner:'Your connection is unstable', speaking:talk},
    why:`Synergy's tile lights on his ${sat.length >> 1} stammers between her ${r6.length} retriggers`})]});
  add('ladder', m('poorConnection', {id:'poorA', at:bar(18), len:bar(1), pool:[CAST.keys], cell:'BOARD+STRIP.0', scene:'ladder'}));
  add('ladder', m('poorConnection', {id:'poorB', at:bar(18), len:bar(1), pool:[CAST.arjun], cell:'BOARD+STRIP.2', scene:'ladder', in:1}));
  for (const p of patches.slice(-2)) for (const x of p.clips) delete x.chrome;
  // 19:0 the board alone; 19:8 the choke: black, the tag on bare sockets, then true black.
  add('ladder', {clips:[c('ladderBoard', bar(19), choke.at - bar(19), 'full', BOARD, {why:'the board alone: L at k4'}), c('black', choke.at, choke.until - choke.at, 'full', BLACK, {why:'the choke'})]});

  // ---- bars 20-21: BACK. Ignition, then stack3 ---------------------------------------------------------------
  add('dropA', m('pegTakeover', {id:'ignite', at:{anchor:'cue:impact'}, len:8, pool:[CAST.arrive], scene:'dropA'}));
  patches.at(-1).clips[0].why = 'IGNITION over peg video (stand-in for office-ensemble, which has Synergy in it)';
  const sinkSec = plan.sections.find(x => /sink/i.test(x.name)), sinkBar = sinkSec ? sinkSec.from : 23;
  const A = choke.until + 8, Aend = bar(sinkBar);
  const ens = add('dropA', m('slowPush', {id:'ens', at:A, len:Aend - A, pool:[fit('stack3.0', 1.25, CAST.ensemble, CAST.applause)], cell:'stack3.0', to:1.25, scene:'dropA'}));
  ens.clips[0].chrome = {name:'Boardroom 3B'};
  // Synergy's cell: a whip slide hides the cut on PIVOT.
  const pivot = (plan.lady || []).find(e => e.role === 'punct' && e.display === 'PIVOT') ?? {at:bar(21) + 14};
  const pv = Math.round(pivot.at);
  const whip = m('whipSlide', {id:'whip', at:A, len:Aend - A, pool:[fit('stack3.1', 1, CAST.synergyClose, CAST.synergy), fit('stack3.1', 1, CAST.synthiaClose, CAST.synthia)], cell:'stack3.1', cut:pv, scene:'dropA'});
  whip.clips[0].chrome = {speaking:speaking('voice')}; whip.clips[0].why = 'Synergy until PIVOT';
  add('dropA', whip);
  camera.push({id:'pivot.roll', at:pv, len:4, rot:[[0, 0], [1, -6, 'outQuad'], [4, 0, 'inOutSine']], zoom:1.06, why:'the composite rolls on the PIVOT bend'});
  // The pads on each snare beat, the applause between: hit-warped, punched in.
  const padsCell = 'stack3.2', snares = [];
  for (let s = A; s < Aend; s += QS) snares.push(s);
  snares.forEach((s, i) => {
    const onSnare = (s % BS) === 8;
    if (onSnare || i % 2 === 0) {
      const w = m('hitWarp', {id:`pads${i}`, at:s, len:QS, pool:[fit(padsCell, 1.12, CAST.pads, CAST.opsArrive)], cell:padsCell, scene:'dropA'});
      const clip = w.clips[0] ?? c(`pads${i}.0`, s, QS, padsCell, sh(CAST.pads), {time:{in:+(i * .5).toFixed(3)}});
      Object.assign(clip, m('snarePunch', {clip, at:clip.at, len:clip.len, to:1.12}).clips[0], {scene:'dropA', why:onSnare ? 'the pads on the snare' : 'the pads'});
      add('dropA', {clips:[clip]});
    } else add('dropA', {clips:[c(`clap${i}`, s, QS, padsCell, sh(fit(padsCell, 1, CAST.applause, CAST.arrive)), {time:{in:+(1 + i * .5).toFixed(3)}, why:'the applause clap between the snares'})]});
  });

  // ---- bars 22-23: Sink In. Tape-coupled G4; on "in" it all freezes and sinks to 32 px -------------------
  const sinkPool = [fit('G4.0', 1, CAST.synthia, CAST.synthiaClose), fit('G4.1', 1, CAST.applause, CAST.arrive), fit('G4.2', 1, CAST.arrive, CAST.banner), fit('G4.3', 1, CAST.synergy, CAST.synergyClose)];
  const sinkWin = {at:bar(sinkBar), len:bar(1)};
  const sink = add('sink', m('tapeCoupling', {id:'sink', ...sinkWin, pool:sinkPool, cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'sink'}));
  const e = (plan.lady || []).find(x => x.role === 'sink');
  let freezeStep = bar(sinkBar) + 12;
  if (e) {
    const words = (LADY_TABLE[e.file]?.words || []).filter(w => w.start >= e.from - 1e-6 && w.start < e.to);
    const last = words.at(-1), t = last ? ladyTime(plan, e) + (last.start - e.from) / ((e.rate || 1) * (e.deep || 1)) : null;
    if (t) { let s = bar(sinkBar); while (s < bar(sinkBar + 1) - 1 && stepTime(plan, s + 1) <= t) s++; freezeStep = s; }
  }
  for (const x of sink.clips) {
    x.time = {...(x.time || {}), freezeAt:{at:freezeStep - x.at, len:bar(sinkBar + 1) - freezeStep}};
    const s = index.get(x.asset.replace(/^shot:/, ''));
    if (s && !isSynergy(s)) x.fx = [{type:'mosaic', px:[[0, 0], [freezeStep - x.at, 4, 'step'], [freezeStep - x.at + 1, 8, 'step'], [freezeStep - x.at + 2, 16, 'step'], [freezeStep - x.at + 3, 32, 'step']]}];
    else x.chrome = {speaking:0};
    x.why = `${x.why}; frozen on "in" (step ${freezeStep % BS} of bar ${sinkBar})${s && !isSynergy(s) ? ', sinking to 32 px blocks' : ''}`;
  }

  // ---- bars 24-26:8: Drop B. The Droste dive into Pat's tile; the chase with punch-ins ------------------------
  const callB = [CAST.synergy, fit('G9.1', 1.12, CAST.ops, CAST.opsArrive), CAST.keysPlay, fit('G9.3', 1.12, CAST.kevinPlay, CAST.kevin), PAT, CAST.people, CAST.arjun, CAST.synthia, CAST.strategy];
  const dropB = add('dropB', m('speakerChase', {id:'chaseB', at:bar(24), len:bar(1), pool:callB, scene:'dropB'}));
  add('dropB', m('drosteDive', {id:'droste', at:bar(24), len:bar(1), cell:'G9.4', scene:'dropB'}));
  for (const x of dropB.clips) if (!x.asset.startsWith('gen:')) overrides.push({target:x.id, rule:'G10', note:'the Droste dive carries this tile out of frame; it is never seen at the full push'});
  // Bar 25-26:8: the chase light on 8ths, punch-ins on the snares, 2-4 cuts a bar in two cells.
  const chaseC = add('dropB', m('speakerChase', {id:'chaseC', at:bar(25), len:bar(1) + 8, pool:callB, scene:'dropB'}));
  chaseC.clips = chaseC.clips.flatMap(x => {
    if (x.asset.startsWith('gen:')) return [x];
    const y = Object.assign(x, m('snarePunch', {clip:x, at:x.at, len:x.len, to:1.12}).clips[0], {scene:'dropB'});
    if (y.cell !== 'G9.2' && y.cell !== 'G9.6') return [y];
    // Cuts in two cells on beats 2 and 4 (the off-beat cut's partner).
    const alt = y.cell === 'G9.2' ? sh(fit('G9.2', 1.12, CAST.keysOffice, CAST.keys)) : sh(CAST.linda);
    const out = [];
    for (let s = y.at, j = 0; s < y.at + y.len; s += 2 * QS, j++) out.push({...clone(y), id:`${y.id}.c${j}`, at:s, len:Math.min(2 * QS, y.at + y.len - s), asset:j % 2 ? alt : y.asset, time:{in:+((y.time?.in ?? 0) + j * .5).toFixed(3)}, frame:j % 2 ? undefined : y.frame, why:j ? 'a cut on the beat' : y.why});
    return out.map(o => { if (!o.frame) delete o.frame; return o; });
  });

  // ---- 26:8-27:0 kaleido of the pads, then the dub delay on Synergy at 26:12 --------------------------------
  const kal = m('kaleido', {id:'kal', at:bar(26) + 8, len:4, pool:[CAST.pads], cell:'full', scene:'dropB'});
  for (const x of kal.clips) overrides.push({target:x.id, rule:'G11', note:'drum-pad-detail is on the shot index’s hand-verified mirror-safe list; plan §2 bar 26 asks for the 2x2 kaleido of the pads (Roll Call stays gated, D3)'},
    {target:x.id, rule:'G10', note:'2x2 tiles: each copy is drawn at half the cell, so the real upscale is half of what G10 reads'});
  add('dropB', kal);
  const dub2 = add('dropB', m('dubDelay', {id:'dub2', at:bar(26) + 12, len:4, delay:1, pool:[CAST.synergy], cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'dropB'}));
  for (const x of dub2.clips) { x.chrome = {name:'Synergy', speaking:speaking('voice')}; x.why = `${x.why}: 16th taps, the dotted 8th needs 9 steps`; }
  // Each echo tile waits on the throw's first frame until its tap lands.
  dub2.clips.push(...dub2.clips.filter(x => x.at > bar(26) + 12).map(x => ({...clone(x), id:`${x.id}.wait`, at:bar(26) + 12, len:x.at - bar(26) - 12, time:{...x.time, freezeAt:0}, why:'waits for its tap'})));

  // ---- bar 27: the tile cascade, then the replay of 26:8-27:0 under READ THAT AGAIN. -----------------------
  const cascadePool = [CAST.synergy, fit('G9.1', 1, CAST.ops, CAST.opsArrive), CAST.keysPlay, fit('G9.3', 1, CAST.kevinPlay, CAST.kevin), CAST.synthia, CAST.people, CAST.arjun, CAST.strategy, PAT];
  const fill = [];
  for (let j = 0; j < 9; j++) {
    const lands = Math.min(j, 7), at = bar(27) + lands, cell = `G9.${j}`;
    const pre = cascadePool[(j + 4) % 8];
    if (j < 8 && lands > 0) fill.push(c(`cascade.pre${j}`, bar(27), lands, cell, sh(pre), {time:{in:3, freezeAt:0}, frame:{opacity:.55}, why:'held, waiting for its note'}));
    const who = cascadePool[j], asset = who.startsWith('gen:') ? who : sh(who);
    fill.push(c(`cascade.${j}`, j < 8 ? at : bar(27), j < 8 ? 8 - lands : 8, cell, asset, {time:asset.startsWith('gen:') ? undefined : {in:2}, chrome:{speaking:j < 8 ? [[0, 1], [1, 0, 'step']] : 0}, why:j < 8 ? `tile cascade: cut ${j + 1} of 8` : 'Pat holds the ninth tile'}));
  }
  add('fill', {clips:fill});
  const replay = [...kal.clips, ...dub2.clips].map(x => ({...clone(x), id:`replay.${x.id}`, at:x.at + BS, scene:'fill', why:'27:8-28:0 replays 26:8-27:0'}));
  add('fill', {clips:replay});
  for (const x of kal.clips) overrides.push({target:`replay.${x.id}`, rule:'G11', note:'the replay of the kaleido at 26:8'}, {target:`replay.${x.id}`, rule:'G10', note:'2x2 tiles, as at 26:8'});

  // ---- bars 28-29: everyone leaves the meeting; the tape stops; black; the ghost BACK. ------------------------
  const leavers = [fit('L1.0', 1, CAST.synergyClose, CAST.synergy), fit('split.1', 1, CAST.ops, CAST.opsArrive), fit('G4.2', 1, CAST.keys, CAST.keysOffice), CAST.synthia, PAT, CAST.people, fit('G9.6', 1, CAST.kevinTalk, CAST.kevin)];
  const leave = add('leave', m('leaveMeeting', {id:'leave', at:bar(28), len:bar(2), pool:leavers, scene:'leave'}));
  // Two left on the call share the frame (split), not the top half of a 2×2.
  const byAt = new Map();
  for (const x of leave.clips) { if (!byAt.has(x.at)) byAt.set(x.at, []); byAt.get(x.at).push(x); }
  for (const list of byAt.values()) if (list.length === 2 && list.every(x => /^G4\.[01]$/.test(x.cell))) list.forEach(x => { x.cell = `split.${x.cell.slice(3)}`; });
  for (const x of leave.clips) if (x.cell === 'L1.0' && !x.asset.startsWith('gen:')) {
    const s = index.get(x.asset.replace(/^shot:/, ''));
    if (s && ceiling(s.id, 'L1.0') < 1) overrides.push({target:x.id, rule:'G10', note:'the closing shot of Synergy alone; the tape stop holds it'});
  }
  // The tape stop: the picture follows the curve until frame 1426 (59.0 s + 10 frames), then black.
  const stopAt = stop ? stop.from : plan.totalSteps - BS / 2, blackFrame = Math.round(stepTime(plan, stopAt) * 24) + 10;
  const ts = m('tapeStop', {at:stopAt, len:+(stepAtTime(plan, blackFrame / 24) - stopAt).toFixed(6)}).transports[0];
  transports.push({...ts, why:'the picture follows the tape-stop curve'});
  // True black from frame 1426: a full black tile under an L1 one, so the layout has no board region.
  add('leave', {clips:[c('tail', {anchor:'cue:stop', frames:10}, BS, 'full', BLACK, {why:'true black from frame 1426'}), c('tail.l1', {anchor:'cue:stop', frames:10}, BS, 'L1.0', BLACK, {why:'keeps the board out of the black'})]});
  // The ghost BACK.: the last two frames rewind to the top (song time 4 frames, then 0), so the
  // film loops into frame 0 on the same peg mask. Silent there, so the sound has nothing to reverse.
  transports.push({id:'loop', at:{anchor:'cue:end', frames:-2}, len:+(2 / 24 / (stepTime(plan, plan.totalSteps) - stepTime(plan, plan.totalSteps - 1))).toFixed(6), kind:'rewind', audio:true, rate:4, from:{anchor:'step:0', frames:4.5}, why:'ghost BACK.: the last two frames are the top of the film, rewound'});

  const edl = merge(createEDL({format, loop:true, seed, board, transports, camera, overrides}), ...patches);
  // Clean: no undefined fields; tail clipped to the film.
  for (const x of edl.clips) {
    for (const k of Object.keys(x)) if (x[k] === undefined) delete x[k];
    if (x.chrome) for (const k of Object.keys(x.chrome)) if (x.chrome[k] === undefined) delete x.chrome[k];
  }
  return edl;
}
