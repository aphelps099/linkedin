// What every Drop Edition treatment shares, whatever its cut: the plan's landmarks, the film's cold
// open (the impact at frame 0, then the rewind with its sound), the choke's black, and the ending (the
// tape stop's curve and hold on Synergy with his eyes open, true black from the first frame after her
// "Full stop.", the loop seam's ghost BACK.). drop60-draft.js carries the same steps inline (it came
// first, and its films are signed off); offsite-psych.js builds on these.
import {MOVES} from '../moves/index.js';
import {barSteps, beatSteps, stepTime, stepAtTime, hitFrame, cutFrame, stopFrames} from '../edl/anchors.js';
import {TRACKING} from '../edl/compile.js';

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
//   clips: the outro's clips (the closing Synergy clip among them; its time is moved in place)
//   pitch: the ignition's peg video pitch    index: the shot index (compile.js shotIndex)
export function ending(plan, L, {clips, pitch = 12, index, shots, format}) {
  const {T, S, stop, stopAt, N} = L, at = f => ({anchor:'step:0', frames:f}), span = (a, b) => r6(S(b / 24) - S(a / 24));
  const curveEnd = cutFrame(T(stopAt)) + Math.ceil((stop?.seconds ?? .4) * 24 - 1e-9), her = stopFrames(plan);
  const blackFrame = Math.min(N, Math.max(curveEnd, her?.black ?? curveEnd));
  const ghostFrom = Math.min(N, Math.max(N - 2, blackFrame));
  const v0 = Math.min(T(stopAt), cutFrame(T(stopAt)) / 24), vHold = T(stopAt) + (stop?.seconds ?? .4) / 2;
  for (const x of clips) {
    const s = x.asset.startsWith('shot:') ? index.get(x.asset.slice(5)) : null, blinks = s && TRACKING[s.robot]?.blinks;
    if (!blinks?.length || typeof x.at !== 'number' || T(x.at) > v0 || T(x.at + x.len) < vHold || x.time?.rate !== undefined || x.time?.map || x.time?.freezeAt !== undefined) continue;
    const inS = x.time?.in ?? 0, frameAt = (v, d) => Math.floor((inS + d / 24 + v - T(x.at)) * 24 + 1e-6);
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
