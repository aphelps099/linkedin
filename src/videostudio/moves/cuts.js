// Cuts: where the picture changes. Each returns back-to-back clips in one cell,
// cycling ctx.pool, every in point chosen by the seed so the source covers its slot.
import {win, poolOf, clip, fitTime, barLines, beatSteps, barSteps, stepTime, shotOf, rng, eighths, seconds, maxZoomFor, FPS} from './util.js';
import {resolveCrop} from '../edl/compile.js';
import {cellRect} from '../layouts.js';

// Clips between consecutive cut points (steps, or {step, at} for anchored ones).
function segments(ctx, name, points, {from, to}, pool) {
  const pts = [{step:from, at:from}, ...points.filter(p => p.step > from && p.step < to)], out = [];
  pts.forEach((p, k) => {
    const end = k + 1 < pts.length ? pts[k + 1].step : to, asset = pool[k % pool.length];
    let len = end - p.step;
    if (len <= 0) return;
    // A clip shifted early by whole frames still has to reach the window's end.
    if (k === pts.length - 1 && p.at?.frames < 0) len += (-p.at.frames / FPS) / (stepTime(ctx.plan, to + 1) - stepTime(ctx.plan, to));
    out.push(clip(ctx, name, k, {at:p.at, len, cell:ctx.cell ?? 'L1.0', asset, time:fitTime(ctx, asset, p.step, len, k), why:p.why}));
  });
  return out;
}

// 1. Downbeat cut: beat 1, every `bars` bars. Punctuation: at most half of all cuts.
export function downbeatCut(ctx) {
  const w = win(ctx), BS = barSteps(ctx.plan), every = (ctx.bars ?? 1) * BS;
  const pts = barLines(ctx.plan, w.from, w.to).filter(s => (s - w.from) % every === 0).map(s => ({step:s, at:s, why:`downbeat of bar ${s / BS}`}));
  return {clips:segments(ctx, 'downbeatCut', pts, w, poolOf(ctx, 2))};
}

// 2. Off-beat cut: the "and" of a beat (step +2 within it); by default beats 2 and 4.
export function offbeatCut(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), BS = barSteps(ctx.plan), beats = ctx.beats ?? [1, 3];
  const pts = [];
  for (const bar of barLines(ctx.plan, w.from - BS + 1, w.to)) for (const b of beats) { const s = bar + b * QS + QS / 2; if (s > w.from && s < w.to) pts.push({step:s, at:s, why:`the "and" of beat ${b + 1}`}); }
  return {clips:segments(ctx, 'offbeatCut', pts.sort((a, b) => a.step - b.step), w, poolOf(ctx, 2))};
}

// 3. Vocal cut: one frame before a sung word, anchored to the word, so a template
// follows any post. Words closer than `minShot` steps (default one beat) are skipped.
export function vocalCut(ctx) {
  const w = win(ctx), {plan} = ctx, minShot = ctx.minShot ?? beatSteps(plan), kinds = ctx.kinds;
  const counters = {}, pts = [];
  for (const word of [...plan.words].sort((a, b) => a.at - b.at)) {
    const n = counters[word.kind] = (counters[word.kind] ?? -1) + 1;
    if (word.at <= w.from || word.at >= w.to || (kinds && !kinds.includes(word.kind)) || (ctx.lineStarts && plan.words.find(x => x.line === word.line) !== word)) continue;
    const last = pts.at(-1)?.step ?? w.from;
    if (word.at - last < minShot) continue;
    pts.push({step:word.at, at:{anchor:`word:${word.kind}#${n}`, frames:-1}, why:`${word.display}: one frame before the word`});
  }
  // The first clip begins on the window; every later one a frame early, so they abut.
  const clips = segments(ctx, 'vocalCut', pts, w, poolOf(ctx, 2));
  return {clips};
}

const joinOf = (ctx, w) => ctx.join !== undefined ? ctx.join : Math.round((w.from + w.len / 2) / barSteps(ctx.plan)) * barSteps(ctx.plan);

// 4. J-cut: the next section's sound leads; its picture arrives one beat after the join.
export function jCut(ctx) {
  const w = win(ctx), [a, b] = poolOf(ctx, 2), J = joinOf(ctx, w) + beatSteps(ctx.plan);
  return {clips:segments(ctx, 'jCut', [{step:J, at:J, why:'J-cut: the new stem led by a beat'}], w, [a, b])};
}

// 5. L-cut: the outgoing vocoder tail plays over the new tile for one beat: the
// picture leaves a beat before the join.
export function lCut(ctx) {
  const w = win(ctx), [a, b] = poolOf(ctx, 2), J = joinOf(ctx, w) - beatSteps(ctx.plan);
  const clips = segments(ctx, 'lCut', [{step:J, at:J, why:'L-cut: the tail over the new tile'}], w, [a, b]);
  if (clips[1]) clips[1].chrome = {speaking:[[0, .8], [beatSteps(ctx.plan), 0, 'outQuad']]};
  return {clips};
}

// Where a source rect appears on screen for a clip at zoom z, centre (cx, cy).
function onScreen(cell, crop, z, cx, cy, r) {
  const k = crop.w / (cell.w * z), ox = cell.x + cell.w / 2, oy = cell.y + cell.h / 2, tx = crop.x + cx * crop.w, ty = crop.y + cy * crop.h;
  return {x:ox + (r.x + r.w / 2 - tx) / k, y:oy + (r.y + r.h / 2 - ty) / k, h:r.h / k};
}

// 6. Match cut on a bar line: the eye-line carries over. The incoming shot is
// scaled (within ±10 %) and centred so its face lands where the outgoing face was.
export function matchCut(ctx) {
  const w = win(ctx), [a, b] = poolOf(ctx, 2), A = shotOf(ctx, a), B = shotOf(ctx, b), format = ctx.format ?? '9:16', cellId = ctx.cell ?? 'L1.0';
  if (!A?.faceBox || !B?.faceBox) return {clips:[], notes:[`matchCut needs a faceBox on both shots (${a}, ${b})`]};
  const cell = cellRect(format, cellId), J = barLines(ctx.plan, w.from + 1, w.to)[0] ?? w.from + w.len / 2;
  const cropA = resolveCrop(A, {}, format, cell), cropB = resolveCrop(B, {}, format, cell);
  const fa = onScreen(cell, cropA, 1, .5, .5, A.faceBox);
  let z = fa.h * cropB.w / (B.faceBox.h * cell.w);
  z = Math.min(Math.max(z, .9), 1.1, maxZoomFor(ctx, b, cellId));
  const k = cropB.w / (cell.w * z), ox = cell.x + cell.w / 2, oy = cell.y + cell.h / 2, h = z >= 1 ? .5 / z : .5;
  const clampC = x => Math.min(1 - h, Math.max(h, x));
  const cx = clampC((B.faceBox.x + B.faceBox.w / 2 - cropB.x - (fa.x - ox) * k) / cropB.w), cy = clampC((B.faceBox.y + B.faceBox.h / 2 - cropB.y - (fa.y - oy) * k) / cropB.h);
  const clips = segments(ctx, 'matchCut', [{step:J, at:J, why:'match cut: eye-line held across the cut'}], w, [a, b]);
  if (clips[1]) clips[1].frame = {zoom:+z.toFixed(4), cx:+cx.toFixed(4), cy:+cy.toFixed(4)};
  return {clips};
}

// 8. Jump cut: 2-4 s removed from the middle of one shot, on an 8th.
export function jumpCut(ctx) {
  const w = win(ctx), [a] = poolOf(ctx, 1), shot = shotOf(ctx, a), r = rng(ctx.seed ?? 1);
  const mid = eighths(w.from + 2, w.to - 2)[Math.floor(eighths(w.from + 2, w.to - 2).length / 2)] ?? w.from + w.len / 2;
  const gap = ctx.gap ?? 2 + Math.round(r() * 8) / 4, first = seconds(ctx.plan, w.from, mid - w.from);
  const inn = ctx.in ?? 0, need = first + gap + seconds(ctx.plan, mid, w.to - mid);
  if (shot && shot.duration < need) return {clips:[], notes:[`jumpCut: ${shot.id} is ${shot.duration} s, needs ${need.toFixed(2)} s`]};
  return {clips:[
    clip(ctx, 'jumpCut', 0, {at:w.from, len:mid - w.from, cell:ctx.cell ?? 'L1.0', asset:a, time:{in:inn}}),
    clip(ctx, 'jumpCut', 1, {at:mid, len:w.to - mid, cell:ctx.cell ?? 'L1.0', asset:a, time:{in:+(inn + first + gap).toFixed(6)}, why:`jump cut: ${gap} s removed`}),
  ]};
}
