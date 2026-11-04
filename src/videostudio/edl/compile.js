// compile(edl, {plan, shots, features, format}) -> the frame program: for every
// output frame, the ordered layers to draw (with exact source times, rects,
// crops, transforms, evaluated effects and tile chrome), the Peg Board's state,
// the composite camera and any transport. Also the cut list, the decode
// schedule and the lint (the validator rules that the EDL alone can decide).
// Pure: the same EDL, plan, shots and features give the same program, frame for
// frame, in Node and in the browser. compileFrame(f) recomputes any frame on its
// own, for scrubbing.
import {resolveAt, resolveSpan, stepTime, stepAtTime, cutFrame, ladyTime, FPS, barSteps, beatSteps, anchorPoint} from './anchors.js';
import {paramFn, range, planFeatures} from './params.js';
import {clipTimeMap, tapeCurve, transportTime} from './remap.js';
import {validate, parseAsset, FX} from './schema.js';
import {FORMATS, cellRect, layout, layoutClassOf} from '../layouts.js';
import {buildScreens, activeScreen, indexWords} from '../../pegboard/choreo.js';
import {LADY_TABLE} from '../../allhands/lady-table.js';
import TRACKING from '../../meeting-room/robot-tracking.json' with {type:'json'};

export const DECODE_LIMITS = {mobile:4, desktop:8};
export const UPSCALE = {A:1.8, B:1.5, C:1.2};      // tolerable upscale U by sharpness tier
export const STUTTER_FRAMES = 12;                  // the stutter cache: one beat of 540p frames, <= 25 MB
const EPS = 1e-9;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- the shot index --------------------------------------------------------------------------
// shots.json (media task: src/videostudio/media/shots.json) as {shots:[...]}, an array,
// a Map or an object by id. Rects may be [x, y, w, h] or {x, y, w, h}; hits are source
// frame indices (hitTimes: the same in seconds); aliases resolve to their shot.
// Missing fields take safe defaults: an unknown reverse class is R0 (never reversed),
// an unknown mirror flag is false.
const rectOf = r => Array.isArray(r) ? {x:r[0], y:r[1], w:r[2], h:r[3]} : r && Number.isFinite(r.w) ? {x:r.x, y:r.y, w:r.w, h:r.h} : null;
export function shotIndex(input) {
  if (input?.__shotIndex) return input;
  const list = !input ? [] : input instanceof Map ? [...new Set(input.values())] : Array.isArray(input) ? input : Array.isArray(input.shots) ? input.shots : Object.values(input);
  const map = new Map();
  for (const s of list) {
    if (!s?.id) continue;
    const width = s.width ?? 1280, height = s.height ?? 720, fps = s.fps ?? 24;
    const duration = s.duration ?? (s.frames ? s.frames / fps : 10);
    const safeCrops = Object.fromEntries(Object.entries(s.safeCrops || {}).map(([k, r]) => [k, rectOf(r)]).filter(([, r]) => r));
    const hits = s.hits ?? [], seconds = s.hitsUnit === 'seconds';
    map.set(s.id, {...s, width, height, fps, duration, frames:s.frames ?? Math.round(duration * fps),
      contentBox:rectOf(s.contentBox) ?? {x:0, y:0, w:width, h:height}, faceBox:rectOf(s.faceBox), safeCrops,
      characters:s.characters ?? [], action:s.action ?? [], roles:s.roles ?? [], status:s.status ?? 'C',
      reverseClass:s.reverseClass ?? 'R0', mirrorable:!!s.mirrorable, hits, hitTimes:hits.map(h => seconds ? h : h / fps),
      robot:s.robot ?? s.tracking ?? (s.id === 'synergy-camera-v2-listening' ? 'synergy' : null)});
  }
  for (const s of list) for (const a of s?.aliases || []) if (!map.has(a) && map.has(s.id)) map.set(a, map.get(s.id));
  map.__shotIndex = true;
  return map;
}
const has = (s, re) => (s.characters || []).some(c => re.test(c));
export const isSynergy = s => has(s, /^synergy$/i);
export const isPat = s => has(s, /^pat$/i);
export const isLady = s => has(s, /lady|circle back/i);
export const isRobot = s => has(s, /^(synergy|synthia)$/i);
export const isInstrument = s => (s.action || []).includes('play') || s.shotType === 'instrument';
export const isPrinter = s => s.shotType === 'printer' || has(s, /^printer$/i);
const robotTrack = s => s.robot;

// 'role:drums.hero' -> the best usable shot: one whose roles name it, else the stem's
// shots by action (hero/play, listen, speak). Sharpest tier, then energy, then id.
const TIER = {A:0, B:1, C:2};
export function resolveRole(shots, stem, role = 'any') {
  const want = {hero:'play', play:'play', listen:'listen', speak:'speak'}[role];
  const usable = s => ['C', 'A', 'S'].includes(s.status) && !isPat(s) && !isLady(s);
  const all = [...new Set(shots.values())].filter(usable);
  let list = all.filter(s => s.roles.includes(`${stem}.${role}`));
  if (!list.length) list = all.filter(s => s.stem === stem && (!want || s.action.includes(want)));
  list.sort((a, b) => (TIER[a.sharpTier] ?? 3) - (TIER[b.sharpTier] ?? 3) || (b.energyMean ?? b.energy ?? 0) - (a.energyMean ?? a.energy ?? 0) || (a.id < b.id ? -1 : 1));
  return list[0] || null;
}

// ---- crops and transforms ------------------------------------------------------------------
const ASPECTS = {'9:16':9 / 16, '1:1':1, '16:9':16 / 9};
// The crop a layer samples, in source px, with exactly the cell's aspect.
export function resolveCrop(shot, clip, format, cell) {
  const box = shot.contentBox, aspect = cell.w / cell.h;
  let base = clip.frame?.crop?.[format] ?? clip.frame?.crop?.all;
  if (!base) {
    const keys = Object.keys(shot.safeCrops || {}).filter(k => ASPECTS[k]);
    keys.sort((a, b) => Math.abs(Math.log(ASPECTS[a] / aspect)) - Math.abs(Math.log(ASPECTS[b] / aspect)));
    base = keys.length ? shot.safeCrops[keys[0]] : box;
  }
  let {x, y, w, h} = base;
  const cx = x + w / 2, cy = y + h / 2;
  if (w / h > aspect) w = h * aspect;
  else if (w / h < aspect) { const need = h * aspect; if (need <= box.w) w = need; else { w = box.w; h = w / aspect; } }
  if (h > box.h) { h = box.h; w = h * aspect; }
  x = clamp(cx - w / 2, box.x, box.x + box.w - w); y = clamp(cy - h / 2, box.y, box.y + box.h - h);
  return {x, y, w, h};
}

// Output px -> source px, row-major 3×3: [sx, sy, 1]ᵀ = M·[x, y, 1]ᵀ.
// M = T(crop.x + cx·crop.w, crop.y + cy·crop.h) · S(k) · R(−rot) · Mirror · T(−(cellCentre + d)),
// k = crop.w / (cell.w · zoom). rot is degrees, clockwise on screen (y down).
export function layerMatrix(cell, crop, {zoom, cx, cy, rot, dx = 0, dy = 0, mirror = null}) {
  const k = crop.w / (cell.w * zoom), th = -rot * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  const mx = mirror === 'x' || mirror === 'xy' ? -1 : 1, my = mirror === 'y' || mirror === 'xy' ? -1 : 1;
  const ox = cell.x + cell.w / 2 + dx, oy = cell.y + cell.h / 2 + dy, tx = crop.x + cx * crop.w, ty = crop.y + cy * crop.h;
  const a = k * c * mx, b = -k * s * my, d = k * s * mx, e = k * c * my;
  return [a, b, tx - a * ox - b * oy, d, e, ty - d * ox - e * oy, 0, 0, 1];
}
export function invert(M) {
  const [a, b, c, d, e, f] = M, det = a * e - b * d;
  const ia = e / det, ib = -b / det, id = -d / det, ie = a / det;
  return [ia, ib, -(ia * c + ib * f), id, ie, -(id * c + ie * f), 0, 0, 1];
}
export const apply = (M, x, y) => [M[0] * x + M[1] * y + M[2], M[3] * x + M[4] * y + M[5]];

function robotFrame(track, time) {
  const n = track.frames.length, i = clamp(time * track.fps, 0, n - 1), a = track.frames[Math.floor(i)], b = track.frames[Math.min(n - 1, Math.ceil(i))], u = i - Math.floor(i);
  return a.map((v, j) => v + (b[j] - v) * u);
}
// The robot's mouth row (meeting-room drawRobotMouth: 22 cells over ~100 × 6 source px
// around the tracked point) in output px.
const MOUTH = {halfW:50, halfH:3, margin:4};

// ---- overrides ----------------------------------------------------------------------------------
export function applyOverrides(edl) {
  const out = JSON.parse(JSON.stringify(edl)), waivers = new Map(), notes = [];
  for (const o of edl.overrides || []) {
    const m = /^(clip|cue|transport):(.+)$/.exec(o.target), kind = m ? m[1] : 'clip', id = m ? m[2] : o.target;
    const list = kind === 'clip' ? out.clips : kind === 'cue' ? (Array.isArray(out.board) ? out.board : []) : out.transports;
    const item = list.find(x => x.id === id);
    if (!item) { notes.push({rule:'S1', path:`overrides`, message:`override target "${o.target}" not found`}); continue; }
    for (const [path, value] of Object.entries(o.set || {})) {
      const keys = path.split('.');
      let obj = item;
      for (const k of keys.slice(0, -1)) obj = obj[k] ??= {};
      obj[keys.at(-1)] = value;
    }
    if (o.rule) {
      if (edl.template) notes.push({rule:o.rule, path:'overrides', message:`template EDLs ignore waivers: ${o.target} ${o.rule} still applies`, level:'warn'});
      else { if (!waivers.has(id)) waivers.set(id, new Set()); waivers.get(id).add(o.rule); }
    }
  }
  return {edl:out, waivers, notes};
}

// ---- the Peg Board ------------------------------------------------------------------------------
function textScreen(cue, from, to, text) {
  const words = [], parts = text.split(/\s+/).filter(Boolean);
  let at = from;
  for (const p of parts) {
    words.push({text:p, start:at, end:to, units:[{chars:[0, p.length], start:at}]});
    if (cue.reveal === 'typewriter') at += Math.min(.05 * (p.length + 1), (to - from) / Math.max(1, parts.length));
  }
  return words;
}
function cueScreens(edl, plan, songScreens, table) {
  const main = [], cells = [];
  (Array.isArray(edl.board) ? edl.board : []).forEach((cue, i) => {
    const span = resolveSpan(plan, cue.at, cue.len ?? (plan.totalSteps * 4), FPS);
    const from = span.time, to = span.end, ref = typeof cue.text === 'object' ? cue.text.ref : null;
    const base = {id:cue.id ?? `cue${i}`, kind:'cue', voice:'board', from, to, reveal:cue.reveal ?? 'pop', tone:cue.palette ?? 'white', release:cue.release ?? 'cut', k:cue.k ?? 1, font:cue.font ?? 'peg9', accent:-1, fx:{}, cell:cue.cell ?? null, z:cue.z ?? (cue.cell ? 'over' : 'under')};
    let screens = [];
    if (ref === 'song') screens = songScreens.filter(s => s.to > from && s.from < to).map(s => ({...s, from:Math.max(from, s.from), to:Math.min(to, s.to), cue:base.id, cell:base.cell, z:base.z}));
    else if (ref && ref.startsWith('song:')) {
      const m = /^song:([a-z]+)(?:#(-?\d+))?$/.exec(ref), list = songScreens.filter(s => s.kind === m?.[1]), n = +(m?.[2] ?? 0), s = list[n < 0 ? list.length + n : n];
      if (!s) throw Error(`board ${base.id}: no song screen "${ref}"`);
      // Re-timed to the cue: the same words, the same rhythm, starting at `at` (a flash-forward, a reprise).
      const d = from - s.from, shift = w => ({...w, start:w.start + d, end:w.end + d, units:w.units.map(u => ({...u, start:u.start + d}))});
      screens = [{...s, from, to:Math.min(to, s.to + d), words:s.words.map(shift), cue:base.id, cell:base.cell, z:base.z, k:cue.k ?? s.k, tone:cue.palette ?? s.tone, reveal:cue.reveal ?? s.reveal, retimed:d}];
    } else if (ref && ref.startsWith('lady')) {
      const e = anchorPoint(plan, ref).event, t0 = ladyTime(plan, e);
      screens = [{...base, text:e.display, words:[{text:e.display, start:t0, end:t0 + e.gate, units:[{chars:[0, e.display.length], start:t0}]}]}];
    } else if (ref && ref.startsWith('line')) {
      const l = anchorPoint(plan, ref).line;
      screens = [{...base, text:l.words.map(w => w.display).join(' '), words:l.words.map(w => { const s = stepTime(plan, w.at); return {text:w.display, start:s, end:Math.min(s + (w.gate ?? Infinity), stepTime(plan, w.at + w.steps)), units:[{chars:[0, w.display.length], start:s}]}; })}];
    } else if (ref) throw Error(`board ${base.id}: cannot read ref "${ref}"`);
    else screens = [{...base, text:cue.text, words:textScreen(cue, from, to, cue.text)}];
    // fx: 'audio' follows the plan (the lady's bend, the sink's tape).
    for (const s of screens) {
      const fx = {...(s.fx || {})};
      for (const [k, v] of Object.entries(cue.fx || {})) {
        if (k === 'detune' && v === 'audio') { const e = (plan.lady || []).find(e => e.bend && ladyTime(plan, e) < s.to && ladyTime(plan, e) + e.gate > s.from); if (e) fx.detune = e.bend.cents; }
        else if (k === 'slow' && v === 'audio') { const sink = tapeCurve(plan).segments.find(g => g.kind === 'sink' && g.t0 < s.to && g.t1 > s.from); if (sink) { fx.slow = true; fx.tape = true; } }
        else fx[k] = v;
      }
      s.fx = fx;
      indexWords(s);
      (s.cell ? cells : main).push(s);
    }
  });
  const order = (a, b) => a.from - b.from || (a.id < b.id ? -1 : 1);
  main.sort(order); cells.sort(order);
  for (let i = 0; i < main.length - 1; i++) main[i].to = Math.min(main[i].to, main[i + 1].from);
  return {main:main.filter(s => s.to > s.from), cells};
}

// ---- compile ----------------------------------------------------------------------------------
export function compile(edlIn, opts = {}) {
  const started = typeof performance !== 'undefined' ? performance.now() : 0;
  const {plan} = opts;
  if (!plan?.timing) throw Error('compile needs {plan} with plan.timing');
  const schema = validate(edlIn);
  const lint = {errors:[], warnings:[]}, seen = new Set();
  const report = (level, rule, message, extra = {}) => {
    const key = `${level}|${rule}|${extra.clipId ?? ''}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    (level === 'error' ? lint.errors : lint.warnings).push({rule, message, ...extra});
  };
  for (const e of schema) report('error', 'schema', e.message, {path:e.path});
  const {edl, waivers, notes} = applyOverrides({clips:[], board:'song', transports:[], overrides:[], ...edlIn});
  for (const n of notes) report(n.level || 'error', n.rule, n.message, {path:n.path});
  const format = opts.format ?? edl.format, fps = FPS, F = FORMATS[format];
  if (!F) throw Error(`unknown format ${format}`);
  const shots = shotIndex(opts.shots), features = opts.features ?? planFeatures(plan, {fps});
  const target = opts.target ?? 'desktop', table = opts.table ?? LADY_TABLE, tracking = opts.tracking ?? TRACKING;
  const N = opts.frames ?? cutFrame(stepTime(plan, edl.song?.steps ?? plan.totalSteps), fps);
  const tape = tapeCurve(plan), BS = barSteps(plan), QS = beatSteps(plan);
  const waived = (rule, clipId) => clipId && waivers.get(clipId)?.has(rule);
  const flag = (level, rule, clipId, message, extra = {}) => {
    if (waived(rule, clipId)) { report('warn', rule, `waived by override: ${message}`, {clipId, ...extra}); return; }
    report(level, rule, message, {clipId, ...extra});
  };

  // ---- clips -------------------------------------------------------------------------------
  const clips = [];
  (Array.isArray(edl.clips) ? edl.clips : []).forEach((clip, index) => {
    const path = `clips[${index}]`, id = clip.id ?? path;
    try {
      const span = resolveSpan(plan, clip.at, clip.len, fps), F0 = span.frame, F1 = span.endFrame;
      if (F1 <= F0) { report('warn', 'S2', `${id} is shorter than one frame and never shows`, {clipId:id}); return; }
      const cell = cellRect(format, clip.cell);
      if (!cell) throw Error(`no cell "${clip.cell}" in ${format}`);
      const asset = parseAsset(clip.asset);
      if (!asset) throw Error(`cannot read asset "${clip.asset}"`);
      let shot = null;
      if (asset.kind === 'shot') { shot = shots.get(asset.id); if (!shot) throw Error(`no shot "${asset.id}" in the shot index`); }
      if (asset.kind === 'role') { shot = resolveRole(shots, asset.stem, asset.role); if (!shot) throw Error(`no shot for ${clip.asset}`); }
      const origin = {step:span.step, shift:span.shift, frame:F0};
      const pctx = {plan, features, origin, fps};
      const fr = clip.frame || {};
      const P = k => paramFn(fr[k] ?? (k === 'zoom' || k === 'opacity' ? 1 : k === 'cx' || k === 'cy' ? .5 : 0), pctx);
      const fx = (clip.fx || []).filter(x => FX[x?.type]).map(x => ({type:x.type, spec:FX[x.type], params:Object.entries(FX[x.type].params).map(([k, ps]) => [k, ps.values ? (x[k] ?? ps.d) : paramFn(x[k] ?? ps.d, pctx)])}));
      const ch = clip.chrome || {};
      const crop = Object.freeze(shot ? resolveCrop(shot, clip, format, cell) : {x:0, y:0, w:cell.w, h:cell.h});
      // Frozen and shared by every frame of the clip: the program is read-only.
      const cellOut = Object.freeze({id:clip.cell, x:cell.x, y:cell.y, w:cell.w, h:cell.h});
      clips.push({clip, index, id, F0, F1, span, cell, cellOut, cls:layoutClassOf(clip.cell), asset, shot, origin, pctx, crop,
        time:clipTimeMap(clip, {plan, shot, features, fps, origin, endFrame:F1, tape, stutterFrames:STUTTER_FRAMES}),
        zoom:P('zoom'), cx:P('cx'), cy:P('cy'), rot:P('rot'), dx:P('dx'), dy:P('dy'), opacity:P('opacity'), mirror:fr.mirror ?? null, fx,
        speaking:paramFn(ch.speaking ?? 0, pctx), mic:typeof ch.mic === 'string' || ch.mic === undefined ? null : paramFn(ch.mic, pctx),
        name:ch.name ?? (shot ? shot.characters[0] ?? shot.id : asset.gen === 'camera-off' ? 'Pat' : null), role:ch.role ?? shot?.role ?? null,
        robot:shot && robotTrack(shot) && tracking[robotTrack(shot)] ? robotTrack(shot) : null,
        synergy:!!shot && isSynergy(shot), printer:!!shot && isPrinter(shot), instrument:!!shot && isInstrument(shot),
        toasts:(Array.isArray(ch.toast) ? ch.toast : ch.toast ? [ch.toast] : []).map(n => note(plan, origin, n, 2 * QS)),
        banners:(Array.isArray(ch.banner) ? ch.banner : ch.banner ? [ch.banner] : []).map(n => note(plan, origin, n, clip.len)),
        z:clip.z ?? 0});
    } catch (e) { report('error', 'schema', `${id}: ${e.message}`, {path, clipId:id}); }
  });
  const byId = new Map(clips.map(c => [c.id, c]));

  // Clips on screen per frame, in draw order: z, then later start on top, then EDL order.
  const order = [...clips].sort((a, b) => a.z - b.z || a.F0 - b.F0 || a.index - b.index);
  const activeAt = Array.from({length:N}, () => []);
  for (const c of order) for (let f = Math.max(0, c.F0); f < Math.min(N, c.F1); f++) activeAt[f].push(c);

  // ---- transports and the composite camera ------------------------------------------------------
  const transports = [];
  (edl.transports || []).forEach((t, i) => {
    try {
      // The window is whole frames; the curve is pinned to the audio's own start time.
      const span = resolveSpan(plan, t.at, t.len, fps), Ta = span.time;
      const tr = {id:t.id ?? `transport${i}`, kind:t.kind, from:span.frame, to:span.endFrame, Ta, len:t.len, audio:t.audio === true, signature:t.signature ?? (t.kind === 'rewind' ? 'rewind' : null), step:span.step};
      if (t.kind === 'rewind') { tr.rate = t.rate ?? 4; tr.Tfrom = t.from !== undefined ? resolveAt(plan, t.from, fps).time : Ta; }
      else {
        const stop = tape.segments.find(s => s.kind === 'stop' && Math.abs(s.t0 - stepTime(plan, span.step)) < .02);
        tr.seconds = t.seconds ?? (stop ? stop.t1 - stop.t0 : (span.endFrame - span.frame) / fps);
      }
      transports.push(tr);
    } catch (e) { report('error', 'schema', `transports[${i}]: ${e.message}`, {path:`transports[${i}]`}); }
  });
  transports.sort((a, b) => a.from - b.from);
  const transportAt = f => { for (const t of transports) if (f >= t.from && f < t.to) return t; return null; };

  const cameras = [];
  (edl.camera || []).forEach((c, i) => {
    try {
      const span = resolveSpan(plan, c.at, c.len, fps), origin = {step:span.step, shift:span.shift, frame:span.frame}, pctx = {plan, features, origin, fps};
      const P = (k, d) => paramFn(c[k] ?? d, pctx);
      cameras.push({id:c.id ?? `camera${i}`, from:span.frame, to:span.endFrame, zoom:P('zoom', 1), cx:P('cx', .5), cy:P('cy', .5), rot:P('rot', 0), dx:P('dx', 0), dy:P('dy', 0),
        fx:(c.fx || []).filter(x => FX[x?.type]).map(x => ({type:x.type, spec:FX[x.type], params:Object.entries(FX[x.type].params).map(([k, ps]) => [k, ps.values ? (x[k] ?? ps.d) : paramFn(x[k] ?? ps.d, pctx)])}))});
    } catch (e) { report('error', 'schema', `camera[${i}]: ${e.message}`, {path:`camera[${i}]`}); }
  });
  const frameRect = {x:0, y:0, w:F.w, h:F.h};

  // ---- the board ---------------------------------------------------------------------------------
  let songScreens = null;
  const song = () => songScreens ??= buildScreens(plan, {table}).map(indexWords);
  let board;
  try {
    board = edl.board === 'song' ? {mode:'song', screens:song(), cells:[]} : (() => { const s = cueScreens(edl, plan, Array.isArray(edl.board) && edl.board.some(c => typeof c.text === 'object' && /^song/.test(c.text.ref)) ? song() : [], table); return {mode:'cues', screens:s.main, cells:s.cells}; })();
  } catch (e) { report('error', 'schema', `board: ${e.message}`, {path:'board'}); board = {mode:'cues', screens:[], cells:[]}; }

  // ---- one frame ---------------------------------------------------------------------------------
  const NONE = Object.freeze([]);
  function evalFx(list, t, toCell) {
    if (!list.length) return NONE;
    const out = [];
    for (const x of list) {
      const v = {type:x.type};
      for (const [k, p] of x.params) v[k] = typeof p === 'function' ? p(t) : p;
      if (x.type === 'iris' && v.space === 'source' && toCell) { const [u, w] = toCell(v.cx, v.cy); v.cx = u; v.cy = w; v.space = 'cell'; }
      if (!x.spec.identity(v)) out.push(v);
    }
    return out.length ? out : NONE;
  }

  function layerOf(c, v, tr) {
    const tm = c.time.at(v), vary = c.clip.time?.repeat?.vary?.[tm.repeat] || {};
    let zoom = c.zoom(v) * (vary.zoom ?? 1);
    const rot = c.rot(v) + (vary.rot ?? 0), dx = c.dx(v), dy = c.dy(v), mirror = vary.mirror !== undefined ? vary.mirror : c.mirror;
    let cx = vary.cx ?? c.cx(v), cy = vary.cy ?? c.cy(v);
    if (zoom >= 1) { const h = .5 / zoom; cx = clamp(cx, h, 1 - h); cy = clamp(cy, h, 1 - h); }
    let src = tm.src, dir = tm.dir, source = tm.source, frozenByTransport = false;
    if (tr?.kind === 'rewind') {
      if (c.printer) { const tt = clamp(tr.Tfrom, c.F0 / fps, (c.F1 - 1) / fps); src = c.time.at(tt).src; dir = 0; source = 'still'; frozenByTransport = true; }
      else dir = -dir;
    }
    if (tr?.kind === 'tapestop' && v >= tr.Ta + tr.seconds / 2 - EPS && source !== 'still') { source = 'still'; dir = 0; }
    const shot = c.shot;
    let srcFrame = null, proxyTime = null, proxyFrame = null, reverse = false;
    if (shot) {
      const last = shot.duration - .5 / shot.fps;
      if (src < -EPS || src > shot.duration + EPS) c.overrun = Math.max(c.overrun ?? 0, src < 0 ? -src : src - shot.duration);
      src = clamp(src, 0, last);
      srcFrame = clamp(Math.floor(src * shot.fps + 1e-6), 0, shot.frames - 1);
      reverse = dir < 0;
      // The frame to sample in the proxy that plays this direction, and the time at its
      // centre: revTime = duration − srcTime, snapped so a boundary never picks a neighbour.
      proxyFrame = reverse ? shot.frames - 1 - srcFrame : srcFrame;
      proxyTime = (proxyFrame + .5) / shot.fps;
    } else src = Math.max(0, v - c.F0 / fps);
    const M = layerMatrix(c.cell, c.crop, {zoom, cx, cy, rot, dx, dy, mirror});
    let inv = null;
    const toCell = (sx, sy) => { inv ??= invert(M); const [x, y] = apply(inv, sx, sy); return [(x - c.cell.x) / c.cell.w, (y - c.cell.y) / c.cell.h]; };
    const layer = {
      clipId:c.id, shotId:shot?.id ?? null, asset:c.clip.asset, kind:shot ? 'video' : 'generated', gen:c.asset.kind === 'gen' ? (c.asset.gen === 'color' ? `color:${c.asset.color}` : c.asset.gen) : null,
      srcTime:src, srcFrame, reverse, proxyTime, proxyFrame, source, repeat:tm.repeat,
      cell:c.cellOut, radius:c.cell.r,
      crop:c.crop, transform:{zoom, cx, cy, rot, dx, dy, mirror, matrix:M},
      opacity:clamp(c.opacity(v), 0, 1), fx:evalFx(c.fx, v, toCell),
      chrome:chromeOf(c, v),
    };
    if (c.robot) {
      const [x, y, angle, scale] = robotFrame(tracking[c.robot], src);
      inv ??= invert(M);
      const [ox, oy] = apply(inv, x, y), k = Math.hypot(inv[0], inv[3]);
      layer.robot = {id:c.robot, mouth:{x:ox, y:oy, angle:angle + rot * Math.PI / 180, scale:scale * k, w:2 * MOUTH.halfW * scale * k, h:2 * MOUTH.halfH * scale * k}};
    }
    if (c.synergy) layer.canon = {synergy:true};
    if (frozenByTransport) layer.held = 'printer';
    return layer;
  }

  function chromeOf(c, v) {
    const speaking = clamp(c.speaking(v), 0, 1);
    const mic = c.mic ? (c.mic(v) >= .5 ? 'on' : 'muted') : (c.clip.chrome?.mic ?? 'on');
    const active = list => { let out = null; for (const n of list) if (v >= n.from && v < n.to) out = {text:n.text, age:v - n.from, remaining:n.to - v}; return out; };
    return {name:c.name, role:c.role, mic, speaking, toast:active(c.toasts), banner:active(c.banners)?.text ?? null, cameraOff:c.clip.chrome?.cameraOff ?? c.asset.gen === 'camera-off'};
  }

  const seeThrough = new Set(['iris', 'droste', 'echo']);
  const covers = l => l.opacity >= .999 && !l.fx.some(x => seeThrough.has(x.type)) && l.transform.rot === 0 && l.transform.dx === 0 && l.transform.dy === 0 && l.transform.zoom >= 1 - EPS;

  function frameAt(f) {
    const t = f / fps, tr = transportAt(f), v = tr ? transportTime(tr, t) : t;
    const vf = Math.floor(v * fps + EPS);
    const list = vf >= 0 && vf < N ? activeAt[vf] : [];
    let layers = list.map(c => layerOf(c, v, tr));
    // Occlusion: an opaque layer hides what is below it in its cell; a full-frame one hides everything.
    for (let i = layers.length - 1; i > 0; i--) {
      const top = layers[i];
      if (!covers(top)) continue;
      const full = top.cell.id === 'full' || (top.cell.w >= F.w && top.cell.h >= F.h);
      const below = layers.slice(0, i).filter(l => !(full || l.cell.id === top.cell.id));
      layers = [...below, ...layers.slice(i)];
      i = below.length;
    }
    const classes = {};
    for (const l of layers) { const k = layoutClassOf(l.cell.id); classes[k] = (classes[k] || 0) + 1; }
    const named = Object.keys(classes).filter(k => k !== 'full');
    const cls = named.length ? named.sort((a, b) => classes[b] - classes[a] || (a < b ? -1 : 1))[0] : layers.length ? 'full' : null;
    const L = cls && cls !== 'full' ? layout(cls, format) : null;
    let cam = null;
    for (const c of cameras) if (vf >= c.from && vf < c.to) cam = c;
    let camera = null;
    if (cam) {
      const zoom = cam.zoom(v), rot = cam.rot(v), dx = cam.dx(v), dy = cam.dy(v);
      let cx = cam.cx(v), cy = cam.cy(v);
      if (zoom >= 1) { const h = .5 / zoom; cx = clamp(cx, h, 1 - h); cy = clamp(cy, h, 1 - h); }
      camera = {id:cam.id, zoom, cx, cy, rot, dx, dy, matrix:layerMatrix(frameRect, frameRect, {zoom, cx, cy, rot, dx, dy}), fx:evalFx(cam.fx, v)};
    }
    const screen = board.screens.length ? board.screens.indexOf(activeScreen(board.screens, v)) : -1;
    const cellScreens = [];
    for (let i = 0; i < board.cells.length; i++) { const s = board.cells[i]; if (v >= s.from && v < s.to) { const r = cellRect(format, s.cell); if (r) cellScreens.push({screen:i, cell:s.cell, rect:{x:r.x, y:r.y, w:r.w, h:r.h}, z:s.z}); } }
    return {f, t, time:v, layout:cls, transport:tr ? {id:tr.id, kind:tr.kind, phase:(f - tr.from) / (tr.to - tr.from), rate:tr.kind === 'rewind' ? -tr.rate : null} : null,
      // The board's region: the layout's, or the whole frame over a full-frame picture (or none).
      camera, board:{time:v, screen, rect:L ? (L.board ? {...L.board} : null) : {...frameRect}, banner:L?.banner ? {...L.banner} : null, cells:cellScreens}, layers};
  }

  const frames = new Array(N);
  for (let f = 0; f < N; f++) frames[f] = frameAt(f);

  // ---- cuts -----------------------------------------------------------------------------------
  const cutSet = new Set();
  for (const c of clips) {
    if (c.F0 >= 0 && c.F0 < N) cutSet.add(c.F0);
    for (const r of c.time.restarts.slice(1)) if (r >= 0 && r < N && r < c.F1) cutSet.add(r);
  }
  for (const t of transports) { if (t.from < N) cutSet.add(t.from); if (t.to < N) cutSet.add(t.to); }
  const cuts = [...cutSet].sort((a, b) => a - b);

  // ---- decode schedule -------------------------------------------------------------------------
  const decode = decodeSchedule(frames, {N, plan, fps, shots, BS, QS});
  for (const b of decode.perBar) {
    if (b.max > DECODE_LIMITS.desktop) report('error', 'G5', `bar ${b.bar}: ${b.max} live decodes at once (desktop ceiling ${DECODE_LIMITS.desktop})`, {frame:b.worstFrame});
    else if (b.max > DECODE_LIMITS.mobile) report(target === 'mobile' ? 'error' : 'warn', 'G5', `bar ${b.bar}: ${b.max} live decodes at once (mobile ceiling ${DECODE_LIMITS.mobile})`, {frame:b.worstFrame});
  }

  // ---- lint ------------------------------------------------------------------------------------
  lintProgram({edl, plan, clips, byId, frames, transports, board, flag, report, fps, N, BS, QS, features});

  const ms = typeof performance !== 'undefined' ? performance.now() - started : 0;
  const program = {
    version:1, format, width:F.w, height:F.h, fps, frames:N, duration:N / fps,
    plan:{form:plan.form, totalSteps:plan.totalSteps, duration:plan.duration},
    clips:clips.map(c => ({id:c.id, shotId:c.shot?.id ?? null, asset:c.clip.asset, cell:c.clip.cell, from:c.F0, to:c.F1, step:c.span.step, restarts:c.time.restarts, scene:c.clip.scene ?? null, signature:c.clip.signature ?? null})),
    transports:transports.map(t => ({id:t.id, kind:t.kind, from:t.from, to:t.to, rate:t.rate ?? null, seconds:t.seconds ?? null, sourceTime:t.Tfrom ?? null})),
    board, cuts, decode, lint:{...lint, ok:lint.errors.length === 0},
    frame:f => frames[f],
    compileFrame:f => frameAt(f),
    hash:() => hashFrames(frames),
    stats:{compileMs:ms, layers:frames.reduce((n, x) => n + x.layers.length, 0)},
  };
  Object.defineProperty(program, 'all', {value:frames, enumerable:false});
  return program;
}

function note(plan, origin, n, defaultLen) {
  const x = typeof n === 'string' ? {text:n} : n, at = x.at ?? 0, len = x.len ?? defaultLen;
  return {text:x.text, from:stepTime(plan, origin.step + at) + origin.shift, to:stepTime(plan, origin.step + at + len) + origin.shift};
}

// Which shots must decode when. A decode is one moving stream of one shot in one
// direction (forward or reversed proxy); layers of the same stream whose source
// times sit within the stutter cache share it (cell split, kaleido, canon).
// Held frames ('still') need one decode, once; stutter repeats need none.
export function decodeSchedule(frames, {N, plan, fps, shots, BS, QS}) {
  const perFrame = new Uint8Array(N), streams = new Map(), prefetch = [], stills = new Map();
  const groups = new Map();
  // One beat ahead of the frame, by the plan's timing.
  const prerollOf = f => Math.max(0, cutFrame(stepTime(plan, Math.max(0, stepAtTime(plan, f / fps) - QS)), fps));
  for (let f = 0; f < N; f++) {
    groups.clear();
    for (const l of frames[f].layers) {
      if (l.kind !== 'video') continue;
      if (l.source === 'still') { const k = `${l.shotId}|${l.srcFrame}`; if (!stills.has(k)) stills.set(k, {frame:f, shotId:l.shotId, srcFrame:l.srcFrame, srcTime:l.srcTime}); continue; }
      if (l.source === 'stutter') continue;
      const key = `${l.shotId}|${l.reverse ? 'rev' : 'fwd'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l.srcTime);
    }
    let count = 0;
    for (const [key, times] of groups) {
      const shot = shots.get(key.split('|')[0]), window = STUTTER_FRAMES / (shot?.fps || fps);
      times.sort((a, b) => a - b);
      let start = -Infinity, n = 0;
      for (const x of times) if (x - start > window + EPS) { start = x; n++; }
      count += n;
      let s = streams.get(key);
      if (!s) streams.set(key, s = {key, shotId:key.split('|')[0], proxy:key.split('|')[1], spans:[]});
      const last = s.spans.at(-1);
      if (last && last.to === f) { last.to = f + 1; last.peak = Math.max(last.peak, n); }
      else {
        s.spans.push({from:f, to:f + 1, srcTime:times[0], peak:n});
        prefetch.push({frame:f, preroll:prerollOf(f), shotId:s.shotId, proxy:s.proxy, srcTime:times[0]});
      }
    }
    perFrame[f] = Math.min(255, count);
  }
  for (const st of stills.values()) prefetch.push({frame:st.frame, preroll:prerollOf(st.frame), shotId:st.shotId, proxy:'still', srcTime:st.srcTime, srcFrame:st.srcFrame});
  prefetch.sort((a, b) => a.preroll - b.preroll || a.frame - b.frame || (a.shotId < b.shotId ? -1 : 1));
  const perBar = [];
  for (let b = 0; ; b++) {
    const from = cutFrame(stepTime(plan, b * BS), fps), to = Math.min(N, cutFrame(stepTime(plan, (b + 1) * BS), fps));
    if (from >= N) break;
    let max = 0, worstFrame = from;
    const distinct = new Set();
    for (let f = from; f < to; f++) {
      if (perFrame[f] > max) { max = perFrame[f]; worstFrame = f; }
      for (const l of frames[f].layers) if (l.kind === 'video' && l.source === 'stream') distinct.add(`${l.shotId}|${l.reverse ? 'rev' : 'fwd'}`);
    }
    perBar.push({bar:b, from, to, max, worstFrame, distinct:distinct.size});
  }
  let max = 0; for (const x of perFrame) max = Math.max(max, x);
  return {perFrame, max, perBar, streams:[...streams.values()], prefetch, limits:DECODE_LIMITS};
}

// Two 32-bit FNV-style lanes over every frame's JSON, as 16 hex digits.
export function hashFrames(frames) {
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (const fr of frames) {
    const s = JSON.stringify(fr);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 0x01000193) ^ (h1 >>> 7); }
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

// ---- the validator rules the EDL can decide ----------------------------------------------------
const GREEN = c => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c); if (!m) return /green|lime|emerald|#0f0\b/i.test(c); const [r, g, b] = m.slice(1).map(x => parseInt(x, 16)); return g > 90 && g > r + 40 && g > b + 40; };
function lintProgram({edl, plan, clips, byId, frames, transports, board, flag, report, fps, N, BS, QS, features}) {
  const T = s => stepTime(plan, s);
  // G11 canon, per clip: no Pat on video, no face for the lady, robots and instruments never mirrored.
  for (const c of clips) {
    const s = c.shot;
    if (!s) continue;
    if (s.status === 'E') report('error', 'S4', `${c.id}: ${s.id} is an earlier version and never loads`, {clipId:c.id});
    if (s.status === 'R') flag('error', 'S4', c.id, `${c.id}: ${s.id} needs review; use it only with an override (rule S4) and a note`);
    if (isPat(s)) flag('error', 'G11', c.id, `${c.id}: Pat is never on video (camera always off); use gen:camera-off`);
    if (isLady(s)) flag('error', 'G11', c.id, `${c.id}: the lady never gets a face; she is the voice and the board`);
    const mirrors = [c.clip.frame?.mirror, ...(c.clip.time?.repeat?.vary || []).map(v => v.mirror)].some(Boolean) || (c.clip.fx || []).some(x => x.type === 'fold' || (x.type === 'tile' && (x.mirror ?? 1)));
    if (mirrors && (!s.mirrorable || isRobot(s) || isInstrument(s))) flag('error', 'G11', c.id, `${c.id}: ${s.id} may not be mirrored (${isRobot(s) ? 'robots are never mirrored' : isInstrument(s) ? 'instruments are never mirrored' : 'not flagged mirrorable'})`);
    if (c.synergy) for (const x of c.clip.fx || []) if (FX[x.type]?.warps) flag('error', 'G11', c.id, `${c.id}: "${x.type}" would warp Synergy's mouth row; Synergy takes only zoom, crop, rotation, saturation and iris`);
    // Instruments keep their tempo: hit-warped (0.85-1.15) or frozen, never slowed or ramped.
    if (c.instrument) {
      const t0 = c.F0 / fps, t1 = c.F1 / fps, [lo, hi] = range(c.clip.time?.rate ?? 1, t0, t1, c.pctx);
      if (c.clip.time?.tape) flag('error', 'G7', c.id, `${c.id}: ${s.id} is an instrument plate; under varispeed it freezes instead of following the tape`);
      else if ((lo < .85 && lo !== 0) || hi > 1.15 || (lo === 0 && hi > 0 && hi < .85)) flag('error', 'G7', c.id, `${c.id}: instrument plate ${s.id} runs at ${lo.toFixed(2)}-${hi.toFixed(2)}x; instruments are hit-warped (0.85-1.15) or frozen`);
      const map = c.clip.time?.map;
      if (map) for (let i = 1; i < map.length; i++) { const r = (map[i][1] - map[i - 1][1]) / (T(c.span.step + map[i][0]) - T(c.span.step + map[i - 1][0])); if (r < .85 - 1e-9 || r > 1.15 + 1e-9) { flag('error', 'G7', c.id, `${c.id}: hit warp segment ${i} runs at ${r.toFixed(3)}x, outside 0.85-1.15`); break; } }
    }
    // G8: repeats inside a clip.
    const rep = c.clip.time?.repeat;
    if (rep && !rep.loop) {
      if (c.time.count > 4) flag('error', 'G8', c.id, `${c.id}: ${c.time.count} plays of one slice; at most 4`);
      if (c.time.count >= 3) {
        const v = rep.vary || [], key = x => JSON.stringify(x || {});
        if (!v[2] || !Object.keys(v[2]).length || key(v[2]) === key(v[0]) || key(v[2]) === key(v[1])) flag('error', 'G8', c.id, `${c.id}: the third repeat must vary one parameter (repeat.vary[2]: zoom, mirror, rate or cell)`);
      }
    }
    if (c.overrun > .5 / (s.fps || 24)) report('warn', 'S3', `${c.id}: runs ${c.overrun.toFixed(2)} s past the end of ${s.id}; the last frame holds`, {clipId:c.id});
  }

  // Per-frame rules: reverse policy (G7), zoom ceiling (G10), Synergy's mouth (G11).
  const worstZoom = new Map(), agg = new Map();
  // One finding per clip and cause, with the first frame and how many frames it lasts.
  const per = (level, rule, clipId, key, message, f) => { const k = `${level}|${rule}|${clipId}|${key}`, a = agg.get(k); if (a) a.count++; else agg.set(k, {level, rule, clipId, message, first:f, count:1}); };
  for (let f = 0; f < N; f++) {
    const fr = frames[f], inRewind = fr.transport?.kind === 'rewind', camZoom = fr.camera?.zoom ?? 1;
    fr.layers.forEach((l, i) => {
      if (l.kind !== 'video') return;
      const c = byId.get(l.clipId), s = c.shot;
      if (l.reverse && !inRewind && s.reverseClass === 'R0') per('error', 'G7', c.id, 'reverse', `${c.id}: ${s.id} is R0 and plays backwards; R0 shots reverse only inside a rewind transport`, f);
      const soft = l.fx.some(x => (x.type === 'mosaic' && x.px >= 8) || (x.type === 'pegVideo' && x.mix >= .5));
      const U = UPSCALE[s.sharpTier] ?? s.maxUpscale ?? 1.5, up = l.transform.zoom * camZoom * l.cell.h / l.crop.h;
      if (!soft && up > U + 1e-6) { const w = worstZoom.get(c.id); if (!w || up > w.up) worstZoom.set(c.id, {up, f, U, maxZoom:U * l.crop.h / l.cell.h, zoom:l.transform.zoom * camZoom}); }
      if (l.robot && l.canon?.synergy) {
        const m = l.robot.mouth, box = {x:m.x - m.w / 2 - MOUTH.margin, y:m.y - m.h / 2 - MOUTH.margin, w:m.w + 2 * MOUTH.margin, h:m.h + 2 * MOUTH.margin};
        const inside = box.x >= l.cell.x && box.y >= l.cell.y && box.x + box.w <= l.cell.x + l.cell.w && box.y + box.h <= l.cell.y + l.cell.h;
        for (const above of fr.layers.slice(i + 1)) if (above.opacity > .01 && overlap(box, visible(above))) per('error', 'G11', c.id, above.clipId, `${c.id}: ${above.clipId} covers Synergy's mouth row`, f);
        for (const cs of fr.board.cells) if (cs.z === 'over' && overlap(box, cs.rect)) per('error', 'G11', c.id, cs.cell, `${c.id}: a board cue in ${cs.cell} covers Synergy's mouth row`, f);
        if (inside && fr.camera && fr.camera.fx.some(x => FX[x.type]?.warps)) per('warn', 'G11', c.id, 'camera', `${c.id}: composite effects (${fr.camera.fx.map(x => x.type).join(', ')}) pass over Synergy's mouth row`, f);
      }
    });
  }
  for (const a of agg.values()) flag(a.level, a.rule, a.clipId, `${a.message} (${a.count} frame${a.count > 1 ? 's' : ''} from frame ${a.first})`, {frame:a.first, frames:a.count});
  for (const [id, w] of worstZoom) flag('error', 'G10', id, `${id}: ${w.up.toFixed(2)}x upscale at frame ${w.f} (zoom ${w.zoom.toFixed(2)}, maxZoom ${w.maxZoom.toFixed(2)} at U ${w.U}); zoom less or switch to mosaic`, {frame:w.f});

  // G7: rewinds. At most 1 beat, at most 2 per song, the audio reversed over the same span.
  const rewinds = transports.filter(t => t.kind === 'rewind');
  for (const t of rewinds) {
    if (t.len > QS + 1e-9) report('error', 'G7', `${t.id}: a rewind lasts at most 1 beat (${QS} steps), this one ${t.len}`, {path:t.id});
    if (!t.audio) report('error', 'G7', `${t.id}: the audio must reverse over the same span (audio:true)`, {path:t.id});
  }
  if (rewinds.length > 2) report('error', 'G7', `${rewinds.length} rewinds; at most 2 per song`);

  // G8: identical repeats across clips in one cell.
  const byCell = new Map();
  for (const c of clips) { if (!byCell.has(c.clip.cell)) byCell.set(c.clip.cell, []); byCell.get(c.clip.cell).push(c); }
  for (const list of byCell.values()) {
    list.sort((a, b) => a.F0 - b.F0);
    let run = 0, slice = 0, prev = null, prevSlice = null, last = null;
    for (const c of list) {
      // Generated tiles are not footage; a clip that picks up where the last one
      // stopped (a re-layout, a bloom) is a continuation, not a repeat.
      if (!c.shot) continue;
      const cont = last && last.shot === c.shot && last.F1 === c.F0 && !last.clip.time?.repeat && Math.abs(last.time.at(c.F0 / fps).src - (c.clip.time?.in ?? 0)) < .5 / (c.shot.fps || fps);
      last = c;
      if (cont) continue;
      const t = c.clip.time || {}, z = c.zoom(c.F0 / fps), sig = `${c.clip.asset}|${Math.round((t.in ?? 0) * fps)}|${!!t.reverse}|${z.toFixed(3)}|${c.mirror}|${JSON.stringify(t.rate ?? 1)}|${(c.clip.fx || []).map(x => JSON.stringify(x)).join()}`;
      const sl = `${c.clip.asset}|${Math.round((t.in ?? 0) * fps)}|${!!t.reverse}`;
      run = sig === prev ? run + 1 : 1; slice = sl === prevSlice ? slice + 1 : 1;
      if (run === 3) flag('error', 'G8', c.id, `${c.id}: third identical repeat of ${c.clip.asset} in ${c.clip.cell}; the third must vary one parameter`);
      if (slice === 5) flag('error', 'G8', c.id, `${c.id}: fifth repeat of one slice of ${c.clip.asset} in ${c.clip.cell}; at most 4`);
      prev = sig; prevSlice = sl;
    }
  }

  // G1 and G4: scenes (clips tagged with scene).
  const scenes = new Map();
  for (const c of clips) {
    const s = c.clip.scene; if (!s) continue;
    let x = scenes.get(s);
    if (!x) scenes.set(s, x = {id:s, from:Infinity, to:-Infinity, step:Infinity, first:null, last:null});
    if (c.F0 < x.from) { x.from = c.F0; x.first = c; x.step = c.span.step; }
    if (c.F1 > x.to || (c.F1 === x.to && c.F0 > (x.last?.F0 ?? -1))) { x.to = c.F1; x.last = c; }
  }
  const sceneList = [...scenes.values()].sort((a, b) => a.from - b.from);
  const ladderSteps = new Set((plan.lady || []).filter(e => e.role === 'ladder').map(e => e.at));
  const allowed = s => Math.abs(s - Math.round(s / BS) * BS) < 1e-9 || ladderSteps.has(s) || s === plan.choke?.at || s === plan.choke?.until;
  for (let i = 0; i < sceneList.length; i++) {
    const s = sceneList[i];
    if (!allowed(s.step)) report('error', 'G4', `scene ${s.id} starts at step ${s.step}, off the bar line (bar ${(s.step / BS).toFixed(2)})`, {clipId:s.first.id});
    if (i) {
      const p = sceneList[i - 1], exit = classAt(frames, Math.max(0, Math.min(N - 1, p.to - 1)), p.id, clips), enter = classAt(frames, Math.max(0, Math.min(N - 1, s.from)), s.id, clips);
      if (exit && enter && exit === enter) report('error', 'G1', `scenes ${p.id} and ${s.id} meet in the same layout class (${enter}); adjacent scenes change layout`, {clipId:s.first.id});
    }
  }

  // G2 (warn): signature budget. Director-placed signatures at most one per 8 bars;
  // the same signature never within 16 bars; at most 4 per song; one Droste.
  const sig = [];
  for (const c of clips) if (c.clip.signature) sig.push({name:c.clip.signature, step:c.span.step, director:/^(suggest|director)/.test(c.clip.origin || ''), id:c.id});
  for (const t of transports) if (t.signature) sig.push({name:t.signature, step:t.step, director:false, id:t.id});
  const occ = [];
  for (const s of sig.sort((a, b) => a.step - b.step)) { const o = occ.find(o => o.name === s.name && s.step - o.last <= 2 * BS); if (o) o.last = s.step; else occ.push({...s, last:s.step}); }
  for (let i = 0; i < occ.length; i++) for (let j = 0; j < i; j++) {
    const a = occ[j], b = occ[i];
    if (a.name === b.name && b.step - a.step < 16 * BS) report('warn', 'G2', `${b.name} repeats within 16 bars (bars ${(a.step / BS).toFixed(0)} and ${(b.step / BS).toFixed(0)})`, {clipId:b.id});
    if (a.director && b.director && b.step - a.step < 8 * BS) report('warn', 'G2', `two director signatures within 8 bars (${a.name}, ${b.name})`, {clipId:b.id});
  }
  if (occ.length > 4) report('warn', 'G2', `${occ.length} signatures; at most 4 per song`);
  if (occ.filter(o => o.name === 'droste').length > 1) report('warn', 'G2', 'more than one Droste dive');

  // G3 (warn, with features): a playing plate on screen while its stem is quiet.
  if (features?.stems) for (const c of clips) {
    if (!c.instrument || !c.shot.stem || !features.stems[c.shot.stem]) continue;
    const E = features.stems[c.shot.stem]; let sum = 0, n = 0;
    for (let f = Math.max(0, c.F0); f < Math.min(N, c.F1, E.length); f++) { sum += E[f]; n++; }
    if (n && sum / n <= .15) report('warn', 'G3', `${c.id}: ${c.shot.id} plays on screen while ${c.shot.stem} is quiet (E ${(sum / n).toFixed(2)}); use a listening plate`, {clipId:c.id});
  }

  // G9 (warn): custom board screens hold at least max(0.75 s, chars / 15).
  if (board.mode === 'cues') for (const s of [...board.screens, ...board.cells]) if (s.kind === 'cue') {
    const need = Math.max(.75, (s.text || '').length / 15);
    if (s.to - s.from < need - 1e-6) report('warn', 'G9', `board ${s.id} "${s.text}" holds ${(s.to - s.from).toFixed(2)} s; needs ${need.toFixed(2)} s to read`);
  }
  // G11: type is never green.
  if (Array.isArray(edl.board)) edl.board.forEach((c, i) => { if (c.palette && GREEN(c.palette)) report('error', 'G11', `board[${i}]: type is never green (palette "${c.palette}")`, {path:`board[${i}]`}); });
  for (const c of clips) for (const x of c.clip.fx || []) for (const v of Object.values(x)) if (typeof v === 'string' && /^#|green/i.test(v) && GREEN(v)) flag('error', 'G11', c.id, `${c.id}: no green in effects (${x.type})`);

  // G12 (warn, loop films): the last frame matches frame 0.
  if (edl.song?.loop && N > 1) {
    const a = frames[0], b = frames[N - 1];
    if (a.layout !== b.layout || a.board.screen !== b.board.screen) report('warn', 'G12', `loop seam: frame 0 (${a.layout}, screen ${a.board.screen}) and frame ${N - 1} (${b.layout}, screen ${b.board.screen}) differ`);
  }
}
// What a layer can cover: its cell, or with rot 0 and zoom >= 1 the part of the cell its
// content still fills after a dx/dy slide.
function visible(l) {
  const {cell} = l, {rot, zoom, dx, dy} = l.transform;
  if (rot !== 0 || zoom < 1 - EPS || l.fx.some(x => x.type === 'droste' || x.type === 'tile')) return cell;
  const x0 = Math.max(cell.x, cell.x + dx), y0 = Math.max(cell.y, cell.y + dy), x1 = Math.min(cell.x + cell.w, cell.x + cell.w + dx), y1 = Math.min(cell.y + cell.h, cell.y + cell.h + dy);
  return {x:x0, y:y0, w:Math.max(0, x1 - x0), h:Math.max(0, y1 - y0)};
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function classAt(frames, f, scene, clips) {
  const ids = new Set(clips.filter(c => c.clip.scene === scene).map(c => c.id));
  const cls = frames[f].layers.filter(l => ids.has(l.clipId)).map(l => layoutClassOf(l.cell.id)).filter(k => k !== 'full');
  return cls[0] ?? null;
}
