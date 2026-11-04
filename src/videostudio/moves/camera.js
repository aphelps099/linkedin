// The camera inside a tile: zoom, centre, rotation and slides. Each move either
// animates ctx.clip (an existing clip, composed with what it already has: zooms
// multiply, rotations add) or makes one clip of ctx.pool[0] in ctx.cell over the window.
import {win, poolOf, clip, fitTime, beatSteps, barSteps, snareSteps, eighths, ladderEvents, maxZoomFor, shotOf, isSynergy} from './util.js';
import {cellRect} from '../layouts.js';
import {resolveAt} from '../edl/anchors.js';

function base(ctx, name, w) {
  if (ctx.clip) return JSON.parse(JSON.stringify(ctx.clip));
  const [asset] = poolOf(ctx, 1);
  return clip(ctx, name, 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset, time:fitTime(ctx, asset, w.from, w.len)});
}
const localOf = (c, w) => w.from - (typeof c.at === 'number' ? c.at : w.from);
function compose(c, key, p, how = 'mul') {
  c.frame ??= {};
  const prev = c.frame[key];
  c.frame[key] = prev === undefined || prev === (how === 'mul' ? 1 : 0) ? p : {[how]:[prev, p]};
  return c;
}
const ceiling = (ctx, c) => maxZoomFor(ctx, c.asset, c.cell, c);
// Shift keyframes from window-local to clip-local steps.
const shift = (keys, d) => keys.map(([k, v, e]) => e ? [k + d, v, e] : [k + d, v]);

// 9. Slow push: 1.0 → 1.15 over 4 bars, linear (never past the shot's maxZoom).
export function slowPush(ctx) {
  const w = win({...ctx, len:ctx.len ?? 4 * barSteps(ctx.plan)}), c = base(ctx, 'slowPush', w), to = Math.min(ctx.to ?? 1.15, ceiling(ctx, c));
  return {clips:[compose(c, 'zoom', shift([[0, 1], [w.len, +to.toFixed(4)]], localOf(c, w)))]};
}

// 10. Crash zoom: 1.0 → 1.6 in 3 frames, 4 % overshoot, an 8-tap radial blur on the move.
// Keys in frames from the slam: a frame is a frame at any tempo.
export function crashZoom(ctx) {
  const w = win(ctx), c = base(ctx, 'crashZoom', w), to = Math.min(ctx.to ?? 1.6, ceiling(ctx, c)), peak = to + .04 * to;
  const f0 = resolveAt(ctx.plan, w.from).frame - resolveAt(ctx.plan, c.at).frame;
  c.frame ??= {};
  const zoom = {keys:[[f0, 1], [f0 + 3, +Math.min(peak, ceiling(ctx, c)).toFixed(4), 'outQuad'], [f0 + 5, +to.toFixed(4), 'inOutSine']], unit:'frames'};
  compose(c, 'zoom', zoom);
  // The radial blur sells the move; Synergy takes the zoom without it.
  if (!isSynergy(shotOf(ctx, c.asset) || {})) (c.fx ??= []).push({type:'zoomBlur', amount:{keys:[[f0, 0], [f0 + 1, .6], [f0 + 3, .35], [f0 + 6, 0]], unit:'frames'}});
  return {clips:[c]};
}

// 11. Snap ladder: one rung per hit, held (step ease). Rungs 1/1.15/1.32/1.52 or
// 1/1.33/1.78/2.37; the ladder stops at the shot's maxZoom.
export const LADDERS = {gentle:[1, 1.15, 1.32, 1.52], steep:[1, 1.33, 1.78, 2.37]};
export function snapLadder(ctx) {
  const w = win(ctx), c = base(ctx, 'snapLadder', w), rungs = LADDERS[ctx.ladder ?? 'gentle'].filter(z => z <= ceiling(ctx, c) + 1e-9);
  const hits = ctx.hits ?? (ladderEvents(ctx.plan, w.from, w.to).map(e => e.at).filter((s, i, a) => a.indexOf(s) === i));
  const steps = hits.length ? hits : Array.from({length:Math.floor(w.len / beatSteps(ctx.plan))}, (_, i) => w.from + i * beatSteps(ctx.plan));
  const d = localOf(c, w), keys = [[d, rungs[0]]];
  steps.forEach((s, i) => { if (i) keys.push([s - w.from + d, rungs[i % rungs.length], 'step']); });
  return {clips:[compose(c, 'zoom', keys)]};
}

// 12. Snare punch-in: 1.0 → 1.12 on each snare, decaying over one beat.
export function snarePunch(ctx) {
  const w = win(ctx), c = base(ctx, 'snarePunch', w), QS = beatSteps(ctx.plan), d = localOf(c, w), to = Math.min(ctx.to ?? 1.12, ceiling(ctx, c));
  const keys = [[d, 1]];
  for (const s of snareSteps(ctx.plan, w.from, w.to)) {
    const k = s - w.from + d;
    if (keys.at(-1)[0] >= k) keys.pop();
    keys.push([k, +to.toFixed(4), 'step'], [k + QS, 1, 'outQuad']);
  }
  return {clips:[compose(c, 'zoom', keys)]};
}

// 13. Whip slide: the outgoing tile slides out by one cell over 2 steps and the
// incoming one slides in behind it, under a 24 px directional blur. Hides a cut.
export function whipSlide(ctx) {
  const w = win(ctx), [a, b] = poolOf(ctx, 2), cell = ctx.cell ?? 'L1.0', r = cellRect(ctx.format ?? '9:16', cell), J = ctx.cut ?? w.from + w.len / 2;
  const W = r.w + 12, blur = {keys:[[J - 1 - w.from, 0], [J - w.from, 24], [J + 1 - w.from, 0]]};
  // Both tiles move together (linear), so the incoming one never laps the outgoing one;
  // Synergy slides without the blur.
  const blurFor = (asset, px) => isSynergy(shotOf(ctx, asset) || {}) ? undefined : [{type:'dirBlur', px, angle:0}];
  const out = clip(ctx, 'whipSlide', 0, {at:w.from, len:J + 1 - w.from, cell, asset:a, time:fitTime(ctx, a, w.from, J + 1 - w.from, 0),
    frame:{dx:[[J - 1 - w.from, 0], [J + 1 - w.from, -W]]}, fx:blurFor(a, blur)});
  const inn = clip(ctx, 'whipSlide', 1, {at:J - 1, len:w.to - (J - 1), cell, asset:b, time:fitTime(ctx, b, J - 1, w.to - J + 1, 1),
    frame:{dx:[[0, W], [2, 0]]}, fx:blurFor(b, {keys:[[0, 24], [1, 12], [2, 0]]}), why:'whip slide hides the cut'});
  return {clips:[out, inn]};
}

// 14. Hat roll: ±2° per 8th, alternating, with just enough zoom that the corners never show.
export function hatRoll(ctx) {
  const w = win(ctx), c = base(ctx, 'hatRoll', w), deg = ctx.deg ?? 2, d = localOf(c, w), r = cellRect(ctx.format ?? '9:16', c.cell);
  const keys = [[d, 0]];
  eighths(w.from, w.to).forEach((s, i) => { if (s > w.from) keys.push([s - w.from + d, i % 2 ? -deg : deg, 'inOutSine']); });
  keys.push([w.len + d, 0, 'inOutSine']);
  const th = deg * Math.PI / 180, a = r.w / r.h, cover = Math.cos(th) + Math.sin(th) * Math.max(a, 1 / a);
  compose(c, 'rot', keys, 'add');
  compose(c, 'zoom', +cover.toFixed(4));
  return {clips:[c]};
}
