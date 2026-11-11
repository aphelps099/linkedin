// The planner: which tiles can Synergy actually stand on, and which buttons get
// him there. It runs the real physics step, so it cannot be more optimistic
// than the game. scripts/check-game.mjs uses it to prove every floor can be
// finished; the browser test uses the same routes to play the level.
//
// A node is "standing still, centred on a tile". An edge is a short recipe of
// inputs (run, jump, steer) that ends standing still on another tile. An edge
// only counts if it lands on the same tile from one unit either side of
// centre, so no route depends on a pixel-perfect start.

import { T } from './level.js';
import { step, newBody, standable, blocked, HW, HH, EV } from './physics.js';

// recipe: { d, hold, delay, run }. Jump is held for the first `hold` frames; `d` is held from frame
// `delay` for `run` frames; then hands off the controls until at rest. hold 0 is a plain walk.
export const inputAt = (r, frame) => ({ dir:frame >= r.delay && frame < r.delay + r.run ? r.d : 0, jump:frame < r.hold });
export const lengthOf = r => Math.max(r.hold, r.delay + r.run);
const RECIPES = (() => {
  const out = [];
  for (const run of [5, 10, 16, 22, 34, 46, 70, 94]) for (const d of [-1, 1]) out.push({ d, hold:0, delay:0, run });
  for (const hold of [40, 12, 4]) {
    out.push({ d:0, hold, delay:0, run:0 });
    for (const d of [-1, 1]) for (const delay of [0, 14, 28]) for (const run of [8, 16, 26, 38, 52, 70, 95]) out.push({ d, hold, delay, run });
  }
  return out;
})();

const overlaps = (p, g) => p.x + HW > g.x0 && p.x - HW < g.x1 && p.y > g.y0 && p.y - HH < g.y1;

// Run one recipe. Returns where it comes to rest and which goals the box touched on the way.
function run(f, x, y, recipe, goals) {
  const p = newBody(x, y), touched = new Set(), n = lengthOf(recipe);
  let bounced = false;
  for (let frame = 0; frame < 600; frame++) {
    if (step(p, inputAt(recipe, frame), f) & EV.BOUNCE) bounced = true;
    for (const g of goals) if (!g.rest && (!g.grounded || p.ground) && overlaps(p, g)) touched.add(g.id);
    if (frame >= n && p.ground && Math.abs(p.vx) < .5) {
      for (const g of goals) if (g.rest && overlaps(p, g)) touched.add(g.id);          // a rest goal counts only where he stops
      return { cx:Math.floor(p.x / T), cy:Math.round(p.y / T), touched, frames:frame + 1, bounced };
    }
  }
  return { cx:-1, cy:-1, touched, frames:600, bounced };
}

// Goals for a parsed floor: every phrase, mug, the desk and the lift, as boxes.
export function goalsOf(f) {
  const g = [];
  f.words.forEach(w => g.push({ id:'word:' + w.word, x0:w.x - 5, x1:w.x + 5, y0:w.y - 5, y1:w.y + 6 }));
  f.mugs.forEach((m, i) => g.push({ id:'mug:' + i, x0:m.x - 3, x1:m.x + 3, y0:m.y - 7, y1:m.y }));
  if (f.desk) g.push({ id:'desk', x0:f.desk.x + 6, x1:f.desk.x + f.desk.w - 6, y0:f.desk.y - 12, y1:f.desk.y + 1, rest:true });   // he has to stop at the desk to post
  if (f.lift) g.push({ id:'lift', x0:f.lift.x + 3, x1:f.lift.x + f.lift.w - 3, y0:f.lift.y - 12, y1:f.lift.y + 1, grounded:true });
  if (f.printer) g.push({ id:'printer', x0:f.printer.x - 2, x1:f.printer.x + 12, y0:f.printer.y - 12, y1:f.printer.y });
  return g;
}

const key = (cx, cy) => cy * 4096 + cx;

// Every edge out of a node. Cached per floor, because routes are asked for many times.
function edgesFrom(f, cx, cy, goals, cache) {
  const k = key(cx, cy);
  let list = cache.get(k);
  if (list) return list;
  list = [];
  const x = cx * T + T / 2, y = cy * T, seen = new Set();
  for (const recipe of RECIPES) {
    const a = run(f, x, y, recipe, goals);
    if (a.cx < 0 || (a.cx === cx && a.cy === cy && !a.touched.size)) continue;
    const b = run(f, blocked(f, x - 1, y) ? x : x - 1, y, recipe, goals), c = run(f, blocked(f, x + 1, y) ? x : x + 1, y, recipe, goals);
    if (b.cx !== a.cx || b.cy !== a.cy || c.cx !== a.cx || c.cy !== a.cy) continue;
    if (!standable(f, a.cx, a.cy)) continue;
    const touched = [...a.touched].filter(id => b.touched.has(id) && c.touched.has(id));
    const sig = key(a.cx, a.cy) + ':' + touched.join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    list.push({ to:{ cx:a.cx, cy:a.cy }, recipe, touched, frames:a.frames });
  }
  cache.set(k, list);
  return list;
}

// Breadth-first over standing tiles from `from`. Returns the reachable set, each goal's first route,
// and the graph, for soft-lock checks.
export function explore(f, from, goals = goalsOf(f), cache = new Map()) {
  const start = { cx:Math.floor(from.x / T), cy:Math.round(from.y / T) };
  const prev = new Map([[key(start.cx, start.cy), null]]), queue = [start], reached = new Map(), graph = new Map();
  for (let q = 0; q < queue.length; q++) {
    const n = queue[q], nk = key(n.cx, n.cy), edges = edgesFrom(f, n.cx, n.cy, goals, cache);
    graph.set(nk, edges);
    for (const e of edges) {
      for (const id of e.touched) if (!reached.has(id)) reached.set(id, { node:n, edge:e });
      const ek = key(e.to.cx, e.to.cy);
      if (!prev.has(ek)) { prev.set(ek, { node:n, edge:e }); queue.push(e.to); }
    }
  }
  const pathTo = n => { const steps = []; let k = key(n.cx, n.cy); while (prev.get(k)) { const s = prev.get(k); steps.unshift(s.edge); k = key(s.node.cx, s.node.cy); } return steps; };
  return { start, nodes:queue, prev, reached, graph, cache,
    route(id) { const r = reached.get(id); return r ? [...pathTo(r.node), r.edge] : null; } };
}

// Nodes from which `id` can never be touched again: places a player could get stuck.
export function traps(f, result, id, goals = goalsOf(f)) {
  const good = new Set(), rev = new Map();
  for (const n of result.nodes) {
    const nk = key(n.cx, n.cy);
    for (const e of result.graph.get(nk)) {
      if (e.touched.includes(id)) good.add(nk);
      const ek = key(e.to.cx, e.to.cy); if (!rev.has(ek)) rev.set(ek, []); rev.get(ek).push(nk);
    }
  }
  const stack = [...good];
  while (stack.length) for (const from of rev.get(stack.pop()) || []) if (!good.has(from)) { good.add(from); stack.push(from); }
  return result.nodes.filter(n => !good.has(key(n.cx, n.cy)));
}
