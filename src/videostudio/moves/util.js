// What every move shares: the window it works in, the seeded random, shot
// lookup, fitting a source into a slot, and the plan's snares. A move is a pure
// function move(ctx) -> {clips, board?, transports?, camera?, notes?} (a patch
// for schema.merge). ctx:
//   {plan, shots, format = '9:16', at? (At), len? (steps), section? (name),
//    cell?, cells?, pool? (shot ids or assets), shot?, seed = 1, id? (clip id prefix),
//    scene?, features?, ...move options}
import {resolveAt, stepTime, cutFrame, barSteps, beatSteps, FPS} from '../edl/anchors.js';
import {shotIndex, resolveCrop, UPSCALE, isInstrument, isRobot, isSynergy} from '../edl/compile.js';
import {parseAsset} from '../edl/schema.js';
import {backbeatHits} from '../edl/params.js';
import {cellRect} from '../layouts.js';

export {stepTime, barSteps, beatSteps, cutFrame, FPS};

// mulberry32: the only randomness a move may use.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The steps a move covers: ctx.section, or ctx.at for ctx.len steps (default one bar).
export function win(ctx) {
  const {plan} = ctx, BS = barSteps(plan);
  if (ctx.section) {
    const s = plan.sections.find(x => x.name.toLowerCase().replace(/[\s-]/g, '') === ctx.section.toLowerCase().replace(/[\s-]/g, ''));
    if (!s) throw Error(`no section "${ctx.section}" in ${plan.form}`);
    const from = s.from * BS, to = ctx.len ? from + ctx.len : s.to * BS;
    return {from, to, len:to - from};
  }
  const from = ctx.at === undefined ? 0 : resolveAt(plan, ctx.at).step, len = ctx.len ?? BS;
  return {from, to:from + len, len};
}

export const assetOf = x => typeof x === 'string' && parseAsset(x) ? x : `shot:${x}`;
export function shotsOf(ctx) { return ctx._shots ??= shotIndex(ctx.shots); }
export function shotOf(ctx, asset) { const a = parseAsset(assetOf(asset)); return a?.kind === 'shot' ? shotsOf(ctx).get(a.id) ?? null : null; }
export function poolOf(ctx, n = 1) {
  const pool = (ctx.pool || (ctx.shot ? [ctx.shot] : [...shotsOf(ctx).keys()])).map(assetOf);
  if (pool.length < n) throw Error(`this move needs ${n} sources, got ${pool.length}`);
  return pool;
}
export const idOf = (ctx, name, k) => `${ctx.id ?? name}.${k}`;

// A clip with the move's provenance.
export function clip(ctx, name, k, c) {
  const out = {id:idOf(ctx, name, k), ...c, origin:ctx.origin ?? `move:${name}`};
  if (ctx.scene) out.scene = ctx.scene;
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];
  return out;
}

// Song seconds a span of steps lasts.
export const seconds = (plan, from, len) => stepTime(plan, from + len) - stepTime(plan, from);

// Time for a source in a slot. Long enough: an in point picked by the seed, rate 1.
// Too short: a non-instrument speeds-fits down to 0.5×; an instrument (which must
// keep its tempo) loops on whole beats instead.
export function fitTime(ctx, asset, from, len, k = 0) {
  const shot = shotOf(ctx, asset);
  if (!shot) return undefined;
  const plan = ctx.plan, slot = seconds(plan, from, len), dur = shot.duration ?? 10, margin = 1 / (shot.fps || FPS);
  const r = rng((ctx.seed ?? 1) * 7919 + k * 104729 + from);
  if (dur - margin >= slot) {
    const spare = dur - margin - slot, inn = Math.round(r() * spare * (shot.fps || FPS)) / (shot.fps || FPS);
    return {in:ctx.in ?? inn};
  }
  if (isInstrument(shot)) {
    const QS = beatSteps(plan);
    let unit = QS;
    while (seconds(plan, from, unit + QS) <= dur - margin) unit += QS;
    return {in:0, repeat:{unit, loop:true}};
  }
  return {in:0, rate:Math.max(.5, (dur - margin) / slot)};
}

// The zoom ceiling of a shot in a cell: U·crop.h / cell.h.
export function maxZoomFor(ctx, asset, cellId, clipSpec = {}) {
  const shot = shotOf(ctx, asset), cell = cellRect(ctx.format ?? '9:16', cellId);
  if (!shot || !cell) return Infinity;
  const crop = resolveCrop(shot, clipSpec, ctx.format ?? '9:16', cell), U = UPSCALE[shot.sharpTier] ?? shot.maxUpscale ?? 1.5;
  return U * crop.h / cell.h;
}

// Backbeat hits (snare, clap, snap), as each track's drums() plays them: Circle Back's
// four-on-the-floor clap on beats 2 and 4 and its half-time snare on step 8; Hustle's two-step
// and four-on-the-floor snare and clap on 2 and 4; Humbled and Honored's pocket backbeat on 2 and 4
// and its bounce snare on step 8, both laid back by track.backbeatLate (18 ms).
// [{step, late}]: late in steps, so stepTime(plan, step + late) is when the hit sounds.
// The backbeat as it sounds: edl/params.js backbeatHits (the clap feature reads it too).
export const snareHits = backbeatHits;
export const snareSteps = (plan, from, to) => snareHits(plan, from, to).map(h => h.step);
export const eighths = (from, to) => { const out = []; for (let s = Math.ceil(from / 2) * 2; s < to; s += 2) out.push(s); return out; };
export const barLines = (plan, from, to) => { const BS = barSteps(plan), out = []; for (let s = Math.ceil(from / BS) * BS; s < to; s += BS) out.push(s); return out; };
export const ladderEvents = (plan, from, to, rung) => (plan.lady || []).filter(e => e.role === 'ladder' && e.at >= from && e.at < to && (rung === undefined || e.rung === rung));
// The anchor of the i-th event of rung r: keeps templates portable across posts.
export function ladyAnchor(plan, e) {
  const list = (plan.lady || []).filter(x => x.role === 'ladder' && x.rung === e.rung);
  return {anchor:`lady:r${e.rung}#${list.indexOf(e)}`};
}
export const name = (ctx, asset) => shotOf(ctx, asset)?.characters?.[0] ?? (String(asset) === 'gen:camera-off' ? 'Pat' : null);
export {isInstrument, isRobot, isSynergy};
// Effects that warp pixels never touch Synergy (his mouth row is canon): moves that
// add one take their sources from the rest of the pool.
export const warpable = (ctx, pool) => pool.filter(a => !isSynergy(shotOf(ctx, a) || {}));
