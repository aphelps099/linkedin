// What every Drop Edition treatment shares, whatever its cut: the plan's landmarks, the film's cold
// open (the impact at frame 0, then the rewind with its sound), the choke's black, and the ending (the
// tape stop's curve and hold on Synergy with his eyes open, true black from the first frame after her
// "Full stop.", the loop seam's ghost BACK.). drop60-draft.js carries the same steps inline (it came
// first, and its films are signed off); offsite-psych.js builds on these.
import {MOVES} from '../moves/index.js';
import {rng} from '../moves/util.js';
import {barSteps, beatSteps, stepTime, stepAtTime, hitFrame, cutFrame, stopFrames} from '../edl/anchors.js';
import {TRACKING, compile, shotIndex, isSynergy, isInstrument, resolveCrop, UPSCALE} from '../edl/compile.js';
import {cellRect} from '../layouts.js';

// A board move's length, in frames: about a 16th at 92-130 BPM.
export const BOARD_MOVE = 4;
// The loop seam's ghost BACK.: its intensity (plan §2: the hook's ghosts and BACK.'s are I .08).
export const GHOST = .08;
export const r6 = x => +(+x).toFixed(6);
const norm = s => String(s).toLowerCase().replace(/[\s_\-]+/g, '');

// The plan's landmarks, in steps (T: step to song seconds, S: back).
export function landmarks(plan) {
  const BS = barSteps(plan), QS = beatSteps(plan), T = s => stepTime(plan, s), S = t => stepAtTime(plan, t);
  const sec = (...names) => { for (const n of names) { const s = (plan.sections || []).find(x => norm(x.name) === norm(n)); if (s) return {from:s.from * BS, to:s.to * BS, name:s.name}; } return null; };
  const need = (...names) => { const s = sec(...names); if (!s) throw Error(`the treatment needs a ${names[0]} section`); return s; };
  const choke = plan.choke, impact = choke.until, chokeBar = Math.floor(choke.at / BS) * BS;
  const stop = (plan.tape || []).find(t => t.kind === 'stop'), stopAt = stop ? stop.from : plan.totalSteps - BS / 2;
  const cold = plan.coldOpen ?? {impact:{at:0, until:.75}, rewind:{from:.75, to:1, rate:4, sourceFrom:T(choke.at)}, resume:1};
  const rw = plan.transports?.find(t => t.kind === 'rewind' && t.audio) ?? {at:cold.rewind.from, len:cold.rewind.to - cold.rewind.from, rate:cold.rewind.rate, sourceFrom:cold.rewind.sourceFrom, sourceTo:cold.rewind.sourceFrom - .25 * cold.rewind.rate};
  return {BS, QS, T, S, sec, need, choke, impact, chokeBar, stop, stopAt, U:plan.call?.until ?? 2 * BS, cold, rw,
    coldEnd:S(cold.impact.until), resume:S(cold.resume), impactFrame:hitFrame(T(impact), plan), N:cutFrame(T(plan.totalSteps))};
}

// The cold open: frames from 0 are a jump to the drop's own impact frame (its sound copied there,
// plan.coldOpen), then the plan's rewind: the last second before the choke at 4x, picture and sound
// reversed together. The rewind's board (the ladder's board alone) lands home on the intro's first frame.
export function coldOpen(plan, L) {
  return {
    transports:[
      {id:'cold', at:0, len:r6(L.coldEnd), kind:'jump', audio:true, from:{anchor:'step:0', frames:L.impactFrame}, why:'cold open: frame 0 is the drop’s impact frame; the sound there is the impact, copied (plan.coldOpen)'},
      {id:'rewind', at:r6(L.S(L.rw.at)), len:r6(L.S(L.rw.at + L.rw.len) - L.S(L.rw.at)), kind:'rewind', audio:true, rate:L.rw.rate ?? 4, from:{anchor:`step:${r6(L.S(L.rw.sourceFrom))}`}, signature:'rewind', why:'the plan’s rewind: the last second before the choke at 4x, picture and sound reversed together'},
    ],
    boardMoves:[{id:'home.cold', at:r6(L.resume), frames:BOARD_MOVE, ease:'inOutSine', align:'end', why:'the cold open hands the board back to its home as the call starts'}],
    // The rewind's scanline wobble (film clock), where the rewound second shows no Synergy (the ladder's board alone).
    camera:L.S(L.rw.sourceFrom - L.rw.len * (L.rw.rate ?? 4)) >= L.chokeBar - 1e-9 ? [{id:'rewind.wobble', at:r6(L.S(L.rw.at)), len:r6(L.S(L.rw.at + L.rw.len) - L.S(L.rw.at)), clock:'film', fx:[{type:'scanline', amount:.3, wobble:8, period:6}], why:'REWIND: the tape’s scanline wobble'}] : [],
  };
}

// The ending: the picture follows the tape-stop curve to its hold and holds while her "Full stop."
// (after the tape) still sounds; true black from the first frame after her (anchors.js stopFrames),
// never before the curve has run; the last two frames (or what is left once she stops) show frame 0's
// BACK. as a ghost at I .08 on the ignition's peg grid. Synergy's closing clip moves its source by the
// fewest frames that keep the slow-down and the hold two frames clear of his blinks.
//   clips: the outro's clips (the closing Synergy clip among them, at a constant rate or none; its time is moved in place)
//   pitch: the ignition's peg video pitch    index: the shot index (compile.js shotIndex)
export function ending(plan, L, {clips, pitch = 12, index, shots, format}) {
  const {T, S, stop, stopAt, N} = L, at = f => ({anchor:'step:0', frames:f}), span = (a, b) => r6(S(b / 24) - S(a / 24));
  const curveEnd = cutFrame(T(stopAt)) + Math.ceil((stop?.seconds ?? .4) * 24 - 1e-9), her = stopFrames(plan);
  const blackFrame = Math.min(N, Math.max(curveEnd, her?.black ?? curveEnd));
  const ghostFrom = Math.min(N, Math.max(N - 2, blackFrame));
  const v0 = Math.min(T(stopAt), cutFrame(T(stopAt)) / 24), vHold = T(stopAt) + (stop?.seconds ?? .4) / 2;
  for (const x of clips) {
    const s = x.asset.startsWith('shot:') ? index.get(x.asset.slice(5)) : null, blinks = s && TRACKING[s.robot]?.blinks;
    if (!blinks?.length || typeof x.at !== 'number' || T(x.at) > v0 || T(x.at + x.len) < vHold || (x.time?.rate !== undefined && typeof x.time.rate !== 'number') || x.time?.map || x.time?.freezeAt !== undefined) continue;
    // (A constant rate, the slow motion of a sign-off on a slow tape, scales the source it covers.)
    const inS = x.time?.in ?? 0, rate = x.time?.rate ?? 1, frameAt = (v, d) => Math.floor((inS + d / 24 + rate * (v - T(x.at))) * 24 + 1e-6);
    const clear = d => { const a = frameAt(v0, d), b = frameAt(vHold, d); return frameAt(T(x.at), d) >= 0 && b < s.frames - 1 && blinks.every(([p, q]) => b < p - 2 || a > q + 2); };
    const d = [0, ...Array.from({length:48}, (_, i) => [-(i + 1), i + 1]).flat()].find(clear);
    if (d) { x.time = {...(x.time || {}), in:r6(inS + d / 24)}; x.why = `${x.why ?? ''}; the tape stop holds source frame ${frameAt(vHold, d)}, eyes open (${d > 0 ? '+' : ''}${d} frames off a blink)`.replace(/^; /, ''); }
  }
  const ts = MOVES.tapeStop.fn({plan, shots, format, at:stopAt, len:r6(S(blackFrame / 24) - stopAt)}).transports[0];
  const out = {transports:[{...ts, why:'the picture follows the tape-stop curve, then holds until her "Full stop." has stopped sounding'}], clips:[], board:[], blackFrame, ghostFrom};
  // True black after it: a full black tile under an L1 one, so the layout has no board region.
  if (ghostFrom > blackFrame) out.clips.push({id:'tail', at:at(blackFrame), len:span(blackFrame, ghostFrom), cell:'full', asset:'gen:color:#000000', why:'true black from the first frame after her "Full stop."'},
    {id:'tail.l1', at:at(blackFrame), len:span(blackFrame, ghostFrom), cell:'L1.0', asset:'gen:color:#000000', why:'keeps the board out of the black'});
  if (ghostFrom < N) {
    out.clips.push({id:'ghost', at:at(ghostFrom), len:span(ghostFrom, N), cell:'full', asset:'gen:color:#000000', fx:[{type:'pegVideo', mix:1, pitch, levels:6, gamma:1.4}], why:'the loop seam: black on the ignition’s peg grid, under the ghost BACK.'});
    out.board.push({id:'ghost', at:at(ghostFrom), len:span(ghostFrom, N), text:{ref:'song:impact'}, ghost:GHOST, why:'ghost BACK.: frame 0’s BACK. on the same pegs, at I .08 (plan §2 row 29)'});
  }
  return out;
}

// ---- the band on screen -------------------------------------------------------------------------------
// The band sings the lexicon in Synergy's other repeats (allhands/band.js, plan.band): Strategy and Synthia
// are on the call, so whoever sings has a tile that speaks. Pat's camera stays off, and the lady never has a
// face (her parts are the board's).
export const VOICE_SHOTS = Object.freeze({strategy:['strategy-speaking', 'strategy-unlock-v2', 'strategy-onboarding-v1', 'strategy-listening'],
  synthia:['synthia-clean-face-plate', 'synthia-conference-closeup']});
export const VOICE_NAMES = Object.freeze({strategy:'Strategy', synthia:'Synthia', lady:'Circle Back'});
const CHARACTER = {strategy:/^strategy$/i, synthia:/^synthia$/i};
// A speaking border that follows a part's words: on from each word's start to its end, runs joined across
// gaps shorter than `gap`, in seconds from `t0` (a Param with unit 'seconds').
export function speakingKeys(words, t0, {gap = .2, tail = .08} = {}) {
  const runs = [];
  for (const w of words || []) {
    const a = w.start - t0, b = w.end + tail - t0, last = runs.at(-1);
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], b); else runs.push([a, b]);
  }
  // (A run already sounding when the clip starts lights it from its first frame; one over by then is dropped.)
  const live = runs.filter(([, b]) => b > 1e-3), keys = [[0, live.length && live[0][0] <= 0 ? 1 : 0]];
  for (const [a, b] of live) { if (a > 0) keys.push([r6(a), 1, 'step']); keys.push([r6(Math.max(a + 1 / 24, b, 1e-3)), 0, 'step']); }
  return {keys:keys.filter((k, i) => !i || k[0] > keys[i - 1][0]), unit:'seconds'};
}
// The parts that sing together: an exchange's call and its answer, a couplet's X and its Y (and its pickup).
const lexLess = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
const partnerOf = (b, band) => band.find(o => o !== b && o.start > b.start && ((b.role === 'call' && o.role === 'response' && o.part === b.part)
  || (b.role === 'couplet-x' && (o.role === 'couplet-y' || o.role === 'pickup') && o.couplet === b.couplet)));

// bandSpeakers(edl, plan, shots, {format, seed}) -> {clips, notes}: a tile of the singer over a tile of the
// call for each of Strategy's and Synthia's parts (plan.band), from a frame before the frame that holds the
// first word (a vocal cut) to a quarter second after the last. The tile is the one that stays on screen
// longest: theirs when the call already shows them (Strategy thaws to speak in a frozen call), else a
// listener's, else an instrument's; never Synergy's, Pat's, the board's, a full-frame picture or L1 (the
// board's panel is over it). Where the call re-lays out under the part, the singer moves with it, one
// segment per layout (each at least a quarter second). The caller stays up through the answer, in another
// tile, when one holds both. Each segment is laid over its host (an opaque layer hides the one under it, so
// the host costs no decode) and joins the host's scene; a part no tile holds (a transport, the choke's
// black, the ignition, the full board, L1) keeps the board alone, and a segment the lint refuses is dropped:
// notes say which and why.
export function bandSpeakers(edl, plan, shots, {format, seed = 7} = {}) {
  const parts = (plan.band || []).filter(b => VOICE_SHOTS[b.voice] && b.words?.length && !b.clear);
  const out = {clips:[], notes:[]};
  if (!parts.length) return out;
  const index = shotIndex(shots), S = t => stepAtTime(plan, t), N = cutFrame(stepTime(plan, plan.totalSteps)), MIN = 6;
  const base = compile(edl, {plan, shots, format});
  const byId = new Map(edl.clips.map(x => [x.id, x]));
  const who = l => (l.shotId && index.get(l.shotId)?.characters) || [];
  const ceiling = (s, cell) => { const r = cellRect(format, cell); return r ? (UPSCALE[s.sharpTier] ?? 1.5) * resolveCrop(s, {}, format, r).h / r.h : 0; };
  // The tiles that can carry a singer on a frame: cell id -> {l, s}.
  const memo = new Map();
  const hosts = f => {
    if (memo.has(f)) return memo.get(f);
    const fr = base.frame(f), here = new Map();
    if (!fr.transport && fr.layout && !/^(full|L1|BOARD)$/.test(fr.layout)) for (const l of fr.layers) {
      if (l.trail || l.cell.id === 'full' || /^L1\./.test(l.cell.id) || l.opacity < .9) continue;
      const s = l.shotId && index.get(l.shotId);
      if (l.kind === 'video' && s && !isSynergy(s)) here.set(l.cell.id, {l, s});
    }
    memo.set(f, here);
    return here;
  };
  // The singer's take for a cell: the first that holds it under the upscale ceiling.
  const takeFor = (voice, cell) => VOICE_SHOTS[voice].map(id => index.get(id)).find(s => s && s.status !== 'E' && s.status !== 'R' && ceiling(s, cell) >= 1 - 1e-9) ?? null;
  const taken = [];
  const busy = (cell, fa, fb) => taken.some(x => x.cell === cell && x.fa < fb && x.fb > fa);
  // Segments over [fa, fb): from each frame, the cell (not busy) that runs longest, theirs first.
  const segments = (b, fa, fb) => {
    const segs = [];
    let f = fa;
    while (f < fb) {
      const here = hosts(f);
      let best = null;
      for (const [cell, x] of here) {
        if (!takeFor(b.voice, cell)) continue;
        let g = f; while (g < fb && hosts(g).has(cell)) g++;
        if (busy(cell, f, g)) continue;
        const rank = who(x.l).some(c => CHARACTER[b.voice].test(c)) ? 0 : !isInstrument(x.s) ? 1 : 2, same = segs.at(-1)?.cell === cell ? 0 : 1;
        const score = [g - f >= MIN ? 0 : 1, same, rank, -(g - f), -(x.l.cell.w * x.l.cell.h)];
        if (!best || lexLess(score, best.score)) best = {cell, x, to:g, score};
      }
      if (!best) { f++; continue; }
      if (best.to - f >= MIN) segs.push({cell:best.cell, l:best.x.l, from:f, to:best.to});
      f = best.to;
    }
    return segs;
  };
  for (const [i, b] of parts.entries()) {
    const pair = partnerOf(b, parts), w0 = b.words[0], w1 = b.words.at(-1), fa = Math.max(0, hitFrame(w0.start, plan) - 1);
    const end = t => Math.min(N, Math.ceil((t + .25) * 24));
    // Up through the answer where one run of tiles holds both; else its own words.
    let segs = pair ? segments(b, fa, end(pair.words.at(-1).end)) : [];
    if (!segs.length || segs.length > 1) segs = segments(b, fa, end(w1.end));
    const words = b.words.filter(w => segs.some(g => hitFrame((w.start + w.end) / 2, plan) >= g.from && hitFrame((w.start + w.end) / 2, plan) < g.to));
    if (!segs.length || !words.length) { out.notes.push(`${b.role} ${b.voice} "${b.display}" at ${w0.start.toFixed(2)} s: no tile holds it (the board carries it alone)`); continue; }
    segs.forEach((g, j) => {
      const shot = takeFor(b.voice, g.cell);
      const mine = who(g.l).some(c => CHARACTER[b.voice].test(c)), at = r6(S(g.from / 24)), len = r6(S(g.to / 24) - at);
      const slot = (g.to - g.from) / 24, spare = Math.max(0, shot.duration - 2 / (shot.fps || 24) - slot), hostClip = byId.get(g.l.clipId);
      out.clips.push({id:`band.${i}${j ? `.${j}` : ''}`, at, len, cell:g.cell, z:2, asset:`shot:${shot.id}`, time:{in:r6(Math.round(rng(seed * 7919 + i * 104729 + g.from)() * spare * 24) / 24)},
        chrome:{name:VOICE_NAMES[b.voice], mic:'on', speaking:speakingKeys(b.words, g.from / 24)}, ...(hostClip?.scene ? {scene:hostClip.scene} : {}),
        why:`${VOICE_NAMES[b.voice]} sings the ${b.role === 'x' ? 'drop’s X' : b.role} "${b.display}"${mine ? ', live in their own tile' : ` over ${g.l.shotId} (${g.cell})`}${segs.length > 1 ? `, segment ${j + 1} of ${segs.length}` : ''}`});
      taken.push({fa:g.from, fb:g.to, cell:g.cell});
    });
  }
  // A tile the lint refuses (an upscale under the camera, a decode too many, or one that covers Synergy's
  // mouth row as a whip slides him under it: G11 names the covered clip, the tile only in its message) goes;
  // the board carries its part.
  const named = e => [e.clipId, ...(String(e.message).match(/\bband\.\d+(?:\.\d+)?(?![\d.])/g) || [])];
  for (let pass = 0; pass < 4 && out.clips.length; pass++) {
    const p = compile({...edl, clips:[...edl.clips, ...out.clips]}, {plan, shots, format}), ids = new Set(out.clips.map(x => x.id));
    const bad = new Set(p.lint.errors.flatMap(named).filter(id => ids.has(id)));
    if (!bad.size) break;
    for (const id of bad) { const x = out.clips.find(c => c.id === id); out.notes.push(`${x.why}: dropped (${p.lint.errors.find(e => named(e).includes(id)).rule})`); }
    out.clips = out.clips.filter(x => !bad.has(x.id));
  }
  return out;
}
