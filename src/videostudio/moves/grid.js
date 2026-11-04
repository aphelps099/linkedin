// The call itself: tiles joining, splitting, leaving, freezing and answering each
// other. When a tile changes layout its picture carries on: the new clip's in
// point is where the old one had got to, so a re-layout is never a jump in time.
import {win, poolOf, clip, fitTime, beatSteps, barSteps, eighths, shotOf, name, ladderEvents, maxZoomFor, stepTime, cutFrame, FPS} from './util.js';
import {cellIds, cellRect} from '../layouts.js';
import {LADDERS} from './camera.js';
import {planFeatures} from '../edl/params.js';

// Grids a call grows through: 1 → 4 → 6 → 9.
export const bloomClass = n => n <= 1 ? 'L1' : n <= 4 ? 'G4' : n <= 6 ? 'G6' : 'G9';

function membersOf(ctx, max = 9) {
  const w = win(ctx), pool = poolOf(ctx, 1).slice(0, max);
  return pool.map((asset, i) => ({asset, i, time:fitTime(ctx, asset, w.from, w.len, i)}));
}
// Clips for segments [{from, to, why, members:[{m, cell, frame?, fx?, chrome?}]}]. A member
// keeps its own clock across segments: its in point at a segment is where it had got
// to since it joined (m.join), at its rate. Looping plates restart their loop.
function emit(ctx, nameOf, segs) {
  const out = [], T = s => stepTime(ctx.plan, s);
  let k = 0;
  for (const s of segs) for (const {m, cell, frame, fx, chrome} of s.members) {
    let time;
    if (!m.asset.startsWith('gen:')) {
      time = {...(m.time || {})};
      const rate = typeof time.rate === 'number' ? time.rate : 1;
      if (!time.repeat) time.in = +((m.time?.in ?? 0) + rate * (cutFrame(T(s.from)) - cutFrame(T(m.join ?? s.from))) / FPS).toFixed(6);
    }
    out.push(clip(ctx, nameOf, k++, {at:s.from, len:s.to - s.from, cell, asset:m.asset, time, frame, fx, chrome, why:s.why}));
  }
  return out;
}

// 24. Grid bloom: one tile joins per beat with a "joined" toast; the grid grows 1 → 4 → 6 → 9.
export function gridBloom(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), members = membersOf(ctx);
  members.forEach((m, i) => { m.join = w.from + i * QS; });
  const segs = members.map((m, i) => {
    const from = m.join, to = i + 1 < members.length ? members[i + 1].join : w.to, cls = bloomClass(i + 1);
    return {from, to, why:`grid bloom: ${i + 1} on the call`, members:members.slice(0, i + 1).map((x, j) => ({m:x, cell:`${cls}.${j}`,
      chrome:{mic:ctx.mic ?? 'muted', ...(j === i ? {toast:{text:`${name(ctx, x.asset) ?? 'Guest'} joined`, at:0, len:Math.min(2 * QS, to - from)}} : {})}}))};
  }).filter(s => s.to > s.from);
  return {clips:emit(ctx, 'gridBloom', segs)};
}

// 24b. Grid collapse: 9 → 1 in one beat, onto ctx.pool[0].
export function gridCollapse(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), members = membersOf(ctx);
  members.forEach(m => { m.join = w.from; });
  const half = w.from + QS / 2, three = w.from + 3 * QS / 4, end = w.from + QS;
  const segs = [
    {from:w.from, to:half, why:'grid collapse', members:members.map((m, j) => ({m, cell:`${bloomClass(members.length)}.${j}`}))},
    {from:half, to:three, why:'grid collapse', members:members.slice(0, 4).map((m, j) => ({m, cell:`G4.${j}`}))},
    {from:three, to:Math.max(end, w.to), why:'grid collapse: one tile', members:[{m:members[0], cell:'L1.0'}]},
  ].filter(s => s.to > s.from);
  return {clips:emit(ctx, 'gridCollapse', segs)};
}

// 25. Cell split: one tile becomes 2, 4, then 8 on the quarters. One decode: every
// sub-tile shows the same source time; mirrorable shots alternate their axes.
export function cellSplit(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), [asset] = poolOf(ctx, 1), cell = ctx.cell ?? 'L1.0', r = cellRect(ctx.format ?? '9:16', cell), tall = r.h > r.w;
  const grids = ['', tall ? 'g1x2' : 'g2x1', 'g2x2', tall ? 'g2x4' : 'g4x2'], counts = [1, 2, 4, 8];
  const m = {asset, join:w.from, time:fitTime(ctx, asset, w.from, w.len)}, mirror = shotOf(ctx, asset)?.mirrorable;
  const segs = counts.map((n, q) => ({from:w.from + q * QS, to:q === 3 ? w.to : w.from + (q + 1) * QS, why:`cell split: ${n}`,
    members:Array.from({length:n}, (_, i) => ({m, cell:n === 1 ? cell : `${cell}>${grids[q]}.${i}`, frame:mirror && i % 4 ? {mirror:['x', 'y', 'xy'][i % 4 - 1]} : undefined}))})).filter(s => s.to > s.from);
  return {clips:emit(ctx, 'cellSplit', segs)};
}

// 26. Breakout rooms: G9, then 2 rooms, then 4, on bar lines; each lady repeat
// pushes the rooms in one rung (×1.15), never past a shot's maxZoom.
export function breakoutRooms(ctx) {
  const w = win({...ctx, len:ctx.len ?? 3 * barSteps(ctx.plan)}), BS = barSteps(ctx.plan), members = membersOf(ctx);
  members.forEach(m => { m.join = w.from; });
  const rooms = [members.map((m, j) => ({m, cell:`G9.${j}`})),
    members.slice(0, 8).map((m, j) => ({m, cell:`split.${j >> 2}>G4.${j & 3}`})),
    members.slice(0, 8).map((m, j) => ({m, cell:`G4.${j >> 1}>split.${j & 1}`}))];
  const segs = [];
  const skip = ctx.skip ?? 0;   // skip:1 starts at two rooms (after a G9 scene)
  for (let b = 0; b * BS < w.len; b++) {
    const from = w.from + b * BS, to = Math.min(w.to, from + BS), hits = ladderEvents(ctx.plan, from, to).map(e => e.at), stage = Math.min(b + skip, 2);
    const list = rooms[stage].map(x => {
      const cap = maxZoomFor(ctx, x.m.asset, x.cell), rungs = LADDERS.gentle.filter(z => z <= cap + 1e-9);
      const keys = [[0, 1]];
      hits.forEach((h, i) => { if (h > from && i < rungs.length) keys.push([h - from, rungs[i], 'step']); });
      return {...x, frame:keys.length > 1 ? {zoom:keys} : undefined};
    });
    segs.push({from, to, why:['the whole call', 'two breakout rooms', 'four breakout rooms'][stage], members:list});
  }
  return {clips:emit(ctx, 'breakoutRooms', segs)};
}

// 27. Freeze the call: every tile freezes and loses 60 % of its colour except the
// soloist (ctx.solo: index, or the member playing ctx.soloStem, default drums).
export function freezeTheCall(ctx) {
  const w = win(ctx), members = membersOf(ctx), cls = bloomClass(members.length);
  const solo = ctx.solo ?? Math.max(0, members.findIndex(m => shotOf(ctx, m.asset)?.stem === (ctx.soloStem ?? 'drums')));
  const clips = members.map((m, j) => clip(ctx, 'freezeTheCall', j, {at:w.from, len:w.len, cell:`${cls}.${j}`, asset:m.asset,
    time:m.asset.startsWith('gen:') ? undefined : j === solo ? m.time : {...m.time, freezeAt:ctx.freeze ?? 0},
    fx:j === solo || m.asset.startsWith('gen:') ? undefined : [{type:'saturation', amount:.4}], why:j === solo ? 'the soloist stays live' : 'frozen out of the call'}));
  return {clips};
}

// 28. Reaction canon: one nod travels the grid, one step per tile; each tile waits
// on its first frame until its turn (with unfreeze:true it also regains its colour).
// One decode plus the stutter cache. A signature move.
export function reactionCanon(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), cells = ctx.cells || cellIds(ctx.cls ?? 'G9', ctx.format ?? '9:16'), step = ctx.step ?? 1;
  const time = fitTime(ctx, asset, w.from, w.len + step * cells.length);
  const clips = cells.map((cell, k) => clip(ctx, 'reactionCanon', k, {at:w.from, len:w.len, cell, asset, signature:'canon',
    time:{...time, ...(k ? {freezeAt:{at:0, len:k * step}} : {})},
    fx:ctx.unfreeze ? [{type:'saturation', amount:[[0, .4], [k * step, 1, 'step']]}] : undefined, why:`canon: tile ${k} answers ${k * step} steps late`}));
  return {clips};
}

// 29. Visual dub delay: the same picture in 4 tiles, each a dotted 8th (3 steps)
// later, at opacity 1 / .7 / .49 / .34. It belongs on an audio throw.
export function dubDelay(ctx) {
  const w = win(ctx), [asset] = poolOf(ctx, 1), cells = ctx.cells || cellIds('G4', ctx.format ?? '9:16'), d = ctx.delay ?? 3, op = [1, .7, .49, .34];
  const time = fitTime(ctx, asset, w.from, w.len);
  const clips = cells.slice(0, 4).map((cell, k) => clip(ctx, 'dubDelay', k, {at:w.from + k * d, len:w.len - k * d, cell, asset, time,
    frame:k ? {opacity:op[k]} : undefined, why:`dub delay tap ${k}`}));
  const throws = (ctx.plan.throws || []).some(t => t.at >= w.from && t.at < w.to);
  return {clips, notes:throws ? [] : ['dubDelay: the plan has no audio throw in this window yet; the picture echo should land on one']};
}

// 30. Active-speaker chase: the speaking border follows the loudest stem, per 8th.
export function speakerChase(ctx) {
  const w = win(ctx), members = membersOf(ctx), cls = bloomClass(members.length), F = ctx.features ?? planFeatures(ctx.plan);
  const speaking = members.map(() => [[0, 0]]);
  for (const s of eighths(w.from, w.to)) {
    const g = Math.max(0, Math.min(F.frames - 1, Math.floor(stepTime(ctx.plan, s) * F.fps + 1e-9)));
    let best = -1, level = .15;
    members.forEach((m, j) => { const stem = shotOf(ctx, m.asset)?.stem, E = stem && F.stems[stem]?.[g]; if (E > level) { level = E; best = j; } });
    members.forEach((m, j) => { const v = j === best ? 1 : 0, keys = speaking[j]; if (keys.at(-1)[1] !== v) keys.push([s - w.from, v, 'step']); });
  }
  const clips = members.map((m, j) => clip(ctx, 'speakerChase', j, {at:w.from, len:w.len, cell:`${cls}.${j}`, asset:m.asset, time:m.asset.startsWith('gen:') ? undefined : m.time,
    chrome:{speaking:speaking[j].length > 1 ? speaking[j] : 0}}));
  return {clips};
}

// 38. Leave the meeting: one tile leaves per beat, last in first out, each with a
// "left the meeting" toast; ctx.pool[0] stays to the end.
export function leaveMeeting(ctx) {
  const w = win(ctx), QS = beatSteps(ctx.plan), members = membersOf(ctx);
  members.forEach(m => { m.join = w.from; });
  const n = members.length, segs = [];
  for (let k = 0; k < n; k++) {
    const from = w.from + k * QS, to = k === n - 1 ? w.to : Math.min(w.to, from + QS);
    if (to <= from) break;
    const left = k ? members[n - k] : null, stay = members.slice(0, n - k), cls = bloomClass(stay.length);
    segs.push({from, to, why:left ? `${name(ctx, left.asset) ?? 'Guest'} left` : 'everyone still here', members:stay.map((m, j) => ({m, cell:`${cls}.${j}`,
      chrome:left && j === 0 ? {toast:{text:`${name(ctx, left.asset) ?? 'Guest'} left the meeting`, at:0, len:Math.min(QS, to - from)}} : undefined}))});
  }
  return {clips:emit(ctx, 'leaveMeeting', segs)};
}
