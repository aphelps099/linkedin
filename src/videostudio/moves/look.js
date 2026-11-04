// Looks: the compositor's effects, placed on the music. Each emits fx entries
// (see FX in edl/schema.js) on a clip, or composite camera cues.
import {win, poolOf, clip, fitTime, beatSteps, barSteps, shotOf, ladderEvents, ladyAnchor, isRobot, warpable} from './util.js';
import {cellRect, FORMATS} from '../layouts.js';

// 32. Poor connection: each retrigger re-cuts to a held source frame while the
// mosaic coarsens hit by hit, 4 px on the first to 32 px on the last, chroma drops,
// and the tile says so. Every fourth hit the call re-buffers onto a new frame, so
// no slice repeats more than four times and no two repeats are identical (G8).
export function poorConnection(ctx) {
  const w = win(ctx), [asset] = warpable(ctx, poolOf(ctx, 1)), cell = ctx.cell ?? 'L1.0', events = ladderEvents(ctx.plan, w.from, w.to);
  if (!asset) return {clips:[], notes:['poorConnection: the mosaic never covers Synergy; give it another shot']};
  const in0 = ctx.in ?? fitTime(ctx, asset, w.from, w.len)?.in ?? 0, banner = ctx.banner ?? 'Your connection is unstable';
  const fx = px => [{type:'mosaic', px}, {type:'chromaDrop', amount:.6}];
  if (!events.length) return {clips:[clip(ctx, 'poorConnection', 0, {at:w.from, len:w.len, cell, asset, time:{in:in0}, fx:[{type:'mosaic', px:[[0, 4], [w.len / 4, 8, 'step'], [w.len / 2, 16, 'step'], [3 * w.len / 4, 32, 'step']]}, {type:'chromaDrop', amount:.6}], chrome:{banner}})]};
  const n = events.length, pxOf = k => Math.round(4 * 2 ** (3 * k / Math.max(1, n - 1)));
  const clips = [];
  if (events[0].at > w.from) clips.push(clip(ctx, 'poorConnection', 'pre', {at:w.from, len:events[0].at - w.from, cell, asset, time:{in:in0}, fx:fx(4), chrome:{banner}}));
  events.forEach((e, k) => clips.push(clip(ctx, 'poorConnection', k, {at:ladyAnchor(ctx.plan, e), len:(events[k + 1]?.at ?? w.to) - e.at, cell, asset,
    time:{in:+(in0 + Math.floor(k / 4) * .5).toFixed(6), freezeAt:0}, fx:fx(pxOf(k)), chrome:{banner}, why:`poor connection: hit ${k + 1} of ${n}, ${pxOf(k)} px`})));
  return {clips};
}

// 33. Peg takeover: the footage becomes peg video (luma^1.4 in 6 blue levels) over
// one beat (at once with instant:true, or on the impact). Ignition, the drop's
// signature, when it lands on the impact. Over the whole frame the board takes the frame
// too: it grows out of its home on the first beat (on the impact it ignites out of the
// choke's black instead) and returns home landing on the takeover's last frame (lint G14).
export function pegTakeover(ctx) {
  const w = win(ctx), [asset] = warpable(ctx, poolOf(ctx, 1)), QS = beatSteps(ctx.plan), cell = ctx.cell ?? 'full';
  if (!asset) return {clips:[], notes:['pegTakeover: Synergy is never turned into pegs; give it another shot']};
  const impact = ctx.plan.choke?.until === w.from, instant = impact || ctx.instant, id = ctx.id ?? 'pegTakeover';
  const boardMoves = cell === 'full' ? [...(impact ? [] : [{id:`${id}.grow`, at:w.from, frames:4, ease:'inOutSine', align:'start', why:'the board takes the frame with the footage'}]),
    {id:`${id}.home`, at:w.from + w.len, frames:4, ease:'inOutSine', align:'end', why:'the board is home when the call comes back'}] : [];
  return {clips:[clip(ctx, 'pegTakeover', 0, {at:w.from, len:w.len, cell, asset, time:fitTime(ctx, asset, w.from, w.len),
    fx:[{type:'pegVideo', mix:instant ? 1 : [[0, 0], [QS, 1, 'outQuad']], pitch:ctx.pitch ?? 12, levels:6, gamma:1.4}], signature:impact ? 'ignition' : undefined, why:'peg takeover'})], boardMoves};
}

// 34. Droste dive: the camera crash-zooms into one tile (ctx.cell, Pat's by
// default) that holds the previous output frame, three levels deep over one bar.
// At most one per song.
export function drosteDive(ctx) {
  const w = win(ctx), F = FORMATS[ctx.format ?? '9:16'], cell = ctx.cell ?? 'G9.4', r = cellRect(ctx.format ?? '9:16', cell), BS = barSteps(ctx.plan);
  const len = Math.min(w.len, BS), into = Math.min(F.w / r.w, F.h / r.h);
  const cx = (r.x + r.w / 2) / F.w, cy = (r.y + r.h / 2) / F.h;
  return {
    clips:[clip(ctx, 'drosteDive', 0, {at:w.from, len, cell, asset:'gen:feedback', z:1, signature:'droste',
      fx:[{type:'droste', depth:[[0, 0], [len, 3, 'inQuad']], scale:+(r.w / F.w).toFixed(4), cx:.5, cy:.5}], chrome:{name:ctx.name ?? 'Pat', cameraOff:true}, why:'Droste: the tile holds the whole meeting'})],
    camera:[{id:`${ctx.id ?? 'drosteDive'}.camera`, at:w.from, len, zoom:[[0, 1], [len, +into.toFixed(4), 'inQuad']], cx:+cx.toFixed(4), cy:+cy.toFixed(4)}],
  };
}

// 35. Kaleido 2×2: one decode, four mirrored copies. Mirrorable shots only.
export function kaleido(ctx) {
  const w = win(ctx), pool = poolOf(ctx, 1).filter(a => { const s = shotOf(ctx, a); return s?.mirrorable && !isRobot(s); });
  if (!pool.length) return {clips:[], notes:['kaleido: needs a shot flagged mirrorable (never a robot or an instrument)']};
  return {clips:[clip(ctx, 'kaleido', 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset:pool[0], time:fitTime(ctx, pool[0], w.from, w.len), fx:[{type:'tile', cols:2, rows:2, mirror:1}], why:'kaleido 2×2'})]};
}

// 36. RGB split: up to 12 px, bound to the kick (or the build's roll).
export function rgbSplit(ctx) {
  const w = win(ctx), bind = ctx.bind ?? 'kick', px = Math.min(12, ctx.px ?? 12);
  const fx = {type:'rgbSplit', px:{bind, scale:px, attack:0, release:bind === 'kick' ? .12 : .05}, angle:ctx.angle ?? 0};
  if (ctx.clip) { const c = JSON.parse(JSON.stringify(ctx.clip)); (c.fx ??= []).push(fx); return {clips:[c]}; }
  if (ctx.composite) return {clips:[], camera:[{id:`${ctx.id ?? 'rgbSplit'}.camera`, at:w.from, len:w.len, fx:[fx]}]};
  const [asset] = warpable(ctx, poolOf(ctx, 1));
  if (!asset) return {clips:[], notes:['rgbSplit: never on Synergy; give it another shot']};
  return {clips:[clip(ctx, 'rgbSplit', 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset, time:fitTime(ctx, asset, w.from, w.len), fx:[fx]})]};
}

// 37. Iris to the eye: a circle closes on Synergy's eye over the last beat of the
// window. The centre is given in source px (compile maps it through the layer's
// transform, so it follows any zoom): the face box, or the tracked face.
export function irisToEye(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), shot = shotOf(ctx, asset), QS = beatSteps(ctx.plan);
  const f = shot?.faceBox, eye = ctx.eye ?? (f ? [f.x + f.w * .5, f.y + f.h * .38] : [(shot?.width ?? 1280) / 2, (shot?.height ?? 720) * .38]);
  const close = Math.max(0, w.len - QS);
  return {clips:[clip(ctx, 'irisToEye', 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset, time:fitTime(ctx, asset, w.from, w.len),
    fx:[{type:'iris', r:[[close, 1], [w.len, 0, 'inOutSine']], cx:+eye[0].toFixed(2), cy:+eye[1].toFixed(2), feather:3, space:'source'}], why:'iris to the eye'})]};
}
