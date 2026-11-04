// Time: what part of the source plays, how fast and in which direction. The
// reverse policy is the shot index's: R0 shots never run backwards (they freeze
// or hit-warp instead), R1 shots may; the composite rewind is a transport.
import {win, poolOf, clip, fitTime, beatSteps, barSteps, shotOf, seconds, ladderEvents, ladyAnchor, name, isInstrument, maxZoomFor} from './util.js';
import {speedFit as fit, hitWarp as warp} from '../edl/remap.js';
import {LADDERS} from './camera.js';
import {kickSteps} from '../../pegboard/eq.js';

// 15. Speed fit: rate = source / slot, clamped 0.5-2; outside that the source is
// trimmed (too long) or the clip ends with the source (too short).
export function speedFit(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), shot = shotOf(ctx, asset), inn = ctx.in ?? 0;
  const src = (ctx.out ?? shot?.duration ?? 10) - inn - 1 / 24, slot = seconds(ctx.plan, w.from, w.len), f = fit(src, slot);
  let len = w.len;
  if (f.trimmed === 'slot') { while (len > 1 && seconds(ctx.plan, w.from, len) > f.slotUsed + 1e-9) len--; }
  return {clips:[clip(ctx, 'speedFit', 0, {at:w.from, len, cell:ctx.cell ?? 'L1.0', asset, time:{in:inn, rate:+f.rate.toFixed(6)}, why:`speed fit ${f.rate.toFixed(3)}x (${f.trimmed === 'none' ? 'whole take' : `trimmed ${f.trimmed}`})`})]};
}

// 16. Hit warp: the plate's hits (shot.hits, source frames) land on 8ths, or on
// the plan's kicks with grid:'kicks'; every local rate stays inside 0.85-1.15.
export function hitWarp(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), shot = shotOf(ctx, asset);
  if (!shot?.hitTimes?.length) return {clips:[], notes:[`hitWarp: ${asset} has no hits`]};
  let grid;
  if (ctx.grid === 'kicks') { const k = kickSteps(ctx.plan); grid = []; for (let s = w.from; s < w.to; s++) if (k[s]) grid.push(s); }
  const r = warp({plan:ctx.plan, at:w.from, len:w.len, hits:shot.hitTimes, grid, min:ctx.min ?? .85, max:ctx.max ?? 1.15});
  if (!r.map) return {clips:[], notes:['hitWarp: no hits could be placed on the grid']};
  const map = r.map.map(([k, s]) => [k, +s.toFixed(6)]);
  if (map[0][1] < 0) { const d = -map[0][1]; for (const p of map) p[1] = +(p[1] + d).toFixed(6); }
  return {clips:[clip(ctx, 'hitWarp', 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset, time:{in:map[0][1], map}, why:`hit warp: ${r.matched.length} hits on the grid`})], matched:r.matched};
}

// 17. Tape coupling: under the song's varispeed (Sink In, the tape stop) R1 clips
// follow the tape exactly (rate = 2^(st/12): −12 st is 0.5×); instruments and
// other R0 plates freeze instead. Takes ctx.clips, or fills the window from the pool.
export function tapeCoupling(ctx) {
  const w = win(ctx.section || ctx.at !== undefined ? ctx : {...ctx, section:'Sink In'});
  const list = ctx.clips ? JSON.parse(JSON.stringify(ctx.clips)) : poolOf(ctx, 1).map((asset, k) => clip(ctx, 'tapeCoupling', k, {at:w.from, len:w.len, cell:(ctx.cells || [ctx.cell ?? 'L1.0'])[k % (ctx.cells || [1]).length], asset, time:fitTime(ctx, asset, w.from, w.len, k)}));
  for (const c of list) {
    const shot = shotOf(ctx, c.asset);
    c.time ??= {};
    if (shot && (shot.reverseClass === 'R0' || isInstrument(shot))) { c.time.freezeAt = 0; delete c.time.tape; c.why = 'tape coupling: R0 plates freeze under varispeed'; }
    else { c.time.tape = true; c.why = 'tape coupling: the picture runs at the tape speed'; }
  }
  return {clips:list};
}

// 18. Speed ramp: 1.0 → 0.25 → 1.0 over 2 beats. Never on an instrument plate.
export function speedRamp(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), pool = poolOf(ctx, 1).filter(a => !isInstrument(shotOf(ctx, a) || {}));
  if (!pool.length) return {clips:[], notes:['speedRamp: instrument plates keep their tempo; give it a non-instrument shot']};
  const at = ctx.ramp ?? w.from, d = at - w.from;
  return {clips:[clip(ctx, 'speedRamp', 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset:pool[0], time:{in:ctx.in ?? 0, rate:[[d, 1], [d + QS, .25, 'inOutSine'], [d + 2 * QS, 1, 'inOutSine']]}})]};
}

// 19. Freeze + label: the picture holds for 2 beats and the Peg Board spells the
// name and role in PEG-5 inside the tile.
export function freezeLabel(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), QS = beatSteps(ctx.plan), at = ctx.freeze ?? 0, hold = ctx.hold ?? 2 * QS, cell = ctx.cell ?? 'L1.0';
  const who = (ctx.name ?? name(ctx, asset) ?? '').toUpperCase(), role = (ctx.role ?? shotOf(ctx, asset)?.role ?? '').toUpperCase();
  const c = clip(ctx, 'freezeLabel', 0, {at:w.from, len:w.len, cell, asset, time:{...fitTime(ctx, asset, w.from, w.len), freezeAt:{at, len:hold}}, chrome:{name:ctx.name, role:ctx.role}});
  if (!c.chrome.name && !c.chrome.role) delete c.chrome;
  else for (const k of Object.keys(c.chrome)) if (c.chrome[k] === undefined) delete c.chrome[k];
  const text = role ? `${who} / ${role}` : who;
  return {clips:[c], board:text ? [{id:`${c.id}.label`, at:w.from + at, len:hold, text, font:'peg5', k:1, reveal:'pop', palette:'white', cell, z:'over'}] : []};
}

// 20. Stutter: one slice (1/16 by default) played `count` times, the third varied.
export function stutter(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), unit = ctx.unit ?? 1, count = Math.min(4, ctx.count ?? 4);
  const rungs = LADDERS.gentle, vary = Array.from({length:count}, (_, i) => i < 2 ? {} : {zoom:rungs[i - 1]});
  return {clips:[clip(ctx, 'stutter', 0, {at:w.from, len:w.len, cell:ctx.cell ?? 'L1.0', asset, time:{...fitTime(ctx, asset, w.from, w.len), repeat:{unit, count, vary}}, why:`stutter ${count} × ${unit} step`})]};
}

// 21. Retrigger roll: the lady's ladder is the cut list. Each retrigger restarts a
// tile; tiles and sources rotate, and each restart in a tile climbs a zoom rung,
// so no slice plays the same way three times running. After four restarts of one
// slice in one tile (or fewer, when the shot's maxZoom cuts the ladder short),
// the in point moves on a quarter second.
export function retriggerRoll(ctx) {
  const w = win(ctx), pool = poolOf(ctx, 1), cells = ctx.cells || [ctx.cell ?? 'L1.0'];
  const events = ladderEvents(ctx.plan, w.from, w.to, ctx.rung);
  if (!events.length) return {clips:[], notes:['retriggerRoll: no ladder events in the window']};
  const plays = new Map();
  const slots = events.map((e, k) => ({e, k, cell:cells[k % cells.length], asset:pool[k % pool.length]}));
  const clips = slots.map(a => {
    const next = slots.find(b => b.k > a.k && b.cell === a.cell), len = (next ? next.e.at : w.to) - a.e.at;
    const rungs = LADDERS.gentle.filter(z => z <= maxZoomFor(ctx, a.asset, a.cell) + 1e-9);
    const key = `${a.cell}|${a.asset}`, n = plays.get(key) ?? 0; plays.set(key, n + 1);
    return clip(ctx, 'retriggerRoll', a.k, {at:ladyAnchor(ctx.plan, a.e), len, cell:a.cell, asset:a.asset,
      time:{in:+((ctx.in ?? 0) + Math.floor(n / Math.max(1, rungs.length)) * .25).toFixed(6)}, frame:{zoom:rungs.length ? rungs[n % rungs.length] : 1}, why:`retrigger: ${a.e.display} (rung ${a.e.rung})`});
  });
  return {clips};
}

// 22. Boomerang: 2 beats forward, 2 beats back. R1 shots only.
export function boomerang(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), pool = poolOf(ctx, 1).filter(a => shotOf(ctx, a)?.reverseClass === 'R1' || a.startsWith('gen:'));
  if (!pool.length) return {clips:[], notes:['boomerang: R0 shots never reverse; give it an R1 shot']};
  return {clips:[clip(ctx, 'boomerang', 0, {at:w.from, len:Math.min(w.len, 4 * QS), cell:ctx.cell ?? 'L1.0', asset:pool[0], time:{in:ctx.in ?? 0, repeat:{unit:2 * QS, count:2, pingpong:true}}, why:'boomerang'})]};
}

// 23. REWIND: the whole composite backwards at 4× for at most one beat, the audio
// reversed over the same span. ctx.from: the song moment it rewinds from.
export function rewind(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan);
  const t = {id:ctx.id ?? 'rewind', at:w.from, len:Math.min(ctx.len ?? QS, QS), kind:'rewind', audio:true, rate:4, signature:'rewind'};
  if (ctx.from !== undefined) t.from = ctx.from;
  return {clips:[], transports:[t]};
}

// The tape stop as a transport: every layer slows to a hold on the engine's curve.
export function tapeStop(ctx) {
  const stop = (ctx.plan.tape || []).find(x => x.kind === 'stop');
  const at = ctx.at ?? stop?.from ?? ctx.plan.totalSteps - barSteps(ctx.plan) / 2;
  return {clips:[], transports:[{id:ctx.id ?? 'tapestop', at, len:ctx.len ?? Math.max(1, ctx.plan.totalSteps - (typeof at === 'number' ? at : 0)), kind:'tapestop', audio:true, ...(stop ? {seconds:stop.seconds} : {})}]};
}
