// Every number an EDL animates is a Param:
//
//   Param = number
//         | [[k, v, ease?], ...]                       keyframes, k in clip-local steps
//         | {keys:[[k, v, ease?], ...], unit?, hit?}   unit: 'steps' (default) | 'frames' | 'seconds';
//                                                       hit:true puts each key on the frame that holds
//                                                       its transient's audible onset (anchors.js hitFrame)
//         | {bind, scale?, base?, attack?, release?}   value = base + scale · envelope(feature)
//         | {mul:[Param, ...]} | {add:[Param, ...]}    products and sums, so moves compose
//
// A key's ease shapes the segment that arrives at it: [[0, 1], [3, 1.6, 'outExpo']]
// rises from 1 to 1.6 over three steps. 'step' holds the previous value until
// the key, then jumps. Before the first key and after the last, the end values hold.
//
// bind: 'kick' | 'voice' | 'roll' | 'stem:<name>' | 'eq:<band>' | 'kickLevel'.
// attack and release are one-pole time constants in seconds (0 = instant).
// Feature tracks come from the audio (buildFeatures) or, without a render,
// from the plan itself (planFeatures). Pure: the same inputs, the same numbers.
import {stepTime, hitFrame, ladyTime, FPS} from './anchors.js';
import {kickSteps, eqTrack, LEAD} from '../../pegboard/eq.js';
import {STEMS, RENDER_OFFSET} from '../../allhands/engine.js';

// ---- eases: f(u) on [0, 1] and its antiderivative F(u) = ∫0^u f -------------
const LN2 = Math.LN2, EXPO_NORM = 1 / (1 - 2 ** -10), BACK = 1.70158;
export const EASES = {
  linear:{f:u => u, F:u => u * u / 2},
  inQuad:{f:u => u * u, F:u => u * u * u / 3},
  outQuad:{f:u => u * (2 - u), F:u => u * u - u * u * u / 3},
  // Normalised so it reaches exactly 1 at u = 1 (no jump at the key).
  outExpo:{f:u => (1 - 2 ** (-10 * u)) * EXPO_NORM, F:u => (u - (1 - 2 ** (-10 * u)) / (10 * LN2)) * EXPO_NORM},
  inOutSine:{f:u => (1 - Math.cos(Math.PI * u)) / 2, F:u => u / 2 - Math.sin(Math.PI * u) / (2 * Math.PI)},
  step:{f:u => u >= 1 ? 1 : 0, F:() => 0},
  // Overshoot (about 10 %) and settle: crash zooms.
  outBack:{f:u => 1 + (BACK + 1) * (u - 1) ** 3 + BACK * (u - 1) ** 2, F:u => u + (BACK + 1) * ((u - 1) ** 4 - 1) / 4 + BACK * ((u - 1) ** 3 + 1) / 3},
};
export const EASE_NAMES = Object.keys(EASES);

// ---- shape -----------------------------------------------------------------------
export const BIND_RE = /^(kick|kickLevel|voice|roll|stem:[a-z]+|eq:\d+)$/;
export function paramKind(p) {
  if (typeof p === 'number') return 'number';
  if (Array.isArray(p)) return 'keys';
  if (p && typeof p === 'object') {
    if (Array.isArray(p.keys)) return 'keys';
    if (typeof p.bind === 'string') return 'bind';
    if (Array.isArray(p.mul)) return 'mul';
    if (Array.isArray(p.add)) return 'add';
  }
  return null;
}
const keysOf = p => Array.isArray(p) ? p : p.keys;
const unitOf = p => Array.isArray(p) ? 'steps' : p.unit || 'steps';

// Readable problems with a Param, as [path, message] pairs.
export function checkParam(p, path, out = []) {
  const kind = paramKind(p);
  if (!kind) { out.push([path, 'is not a Param (number, keyframes, {bind}, {mul} or {add})']); return out; }
  if (kind === 'number' && !Number.isFinite(p)) out.push([path, `must be finite, got ${p}`]);
  if (kind === 'keys') {
    const keys = keysOf(p);
    if (!keys.length) out.push([path, 'keyframes need at least one key']);
    if (!Array.isArray(p) && p.unit && !['steps', 'frames', 'seconds'].includes(p.unit)) out.push([`${path}.unit`, `unknown unit "${p.unit}" (steps, frames or seconds)`]);
    if (!Array.isArray(p) && p.hit !== undefined && typeof p.hit !== 'boolean') out.push([`${path}.hit`, 'hit is true when the keys mark transients']);
    keys.forEach((k, i) => {
      if (!Array.isArray(k) || k.length < 2 || k.length > 3) { out.push([`${path}[${i}]`, 'a key is [k, value, ease?]']); return; }
      if (!Number.isFinite(k[0]) || !Number.isFinite(k[1])) out.push([`${path}[${i}]`, 'key position and value must be finite numbers']);
      if (k[2] !== undefined && !EASES[k[2]]) out.push([`${path}[${i}][2]`, `unknown ease "${k[2]}" (${EASE_NAMES.join(', ')})`]);
      if (i && k[0] < keys[i - 1][0]) out.push([`${path}[${i}]`, 'keys must be in time order']);
    });
  }
  if (kind === 'bind') {
    if (!BIND_RE.test(p.bind)) out.push([`${path}.bind`, `unknown feature "${p.bind}" (kick, kickLevel, voice, roll, stem:<name>, eq:<n>)`]);
    for (const f of ['scale', 'base', 'attack', 'release']) if (p[f] !== undefined && !Number.isFinite(p[f])) out.push([`${path}.${f}`, 'must be a finite number']);
    for (const f of ['attack', 'release']) if (p[f] < 0) out.push([`${path}.${f}`, 'must be 0 or more seconds']);
  }
  if (kind === 'mul' || kind === 'add') p[kind].forEach((q, i) => checkParam(q, `${path}.${kind}[${i}]`, out));
  return out;
}

// ---- evaluation ------------------------------------------------------------------
// ctx: {plan, features, origin:{step, shift, frame}, fps}. A key at local k sits at
//   steps:   stepTime(plan, origin.step + k) + origin.shift
//   frames:  (origin.frame + k) / fps
//   seconds: stepTime(plan, origin.step) + origin.shift + k
//   hit:true (steps or seconds): the start of the frame that holds that time's audible onset,
//   so a punch-in shows on the frame its snare is heard in, never a frame after.
export function keyTime(p, k, ctx) {
  const unit = unitOf(p), o = ctx.origin, fps = ctx.fps || FPS;
  if (unit === 'frames') return (o.frame + k) / fps;
  const t = unit === 'seconds' ? stepTime(ctx.plan, o.step) + (o.shift || 0) + k : stepTime(ctx.plan, o.step + k) + (o.shift || 0);
  return !Array.isArray(p) && p.hit ? hitFrame(t, ctx.plan, fps) / fps : t;
}

// Key times are cached per (param, origin): a clip evaluates the same keys every frame.
const keyCache = new WeakMap();
function keyTimes(p, ctx) {
  let byOrigin = keyCache.get(p);
  if (!byOrigin) keyCache.set(p, byOrigin = new Map());
  const o = ctx.origin, id = `${o.step}|${o.shift || 0}|${o.frame}|${ctx.fps || FPS}`;
  let times = byOrigin.get(id);
  if (!times || times.plan !== ctx.plan) {
    times = Float64Array.from(keysOf(p), k => keyTime(p, k[0], ctx)); times.plan = ctx.plan;
    byOrigin.set(id, times);
  }
  return times;
}

// The segment of a keyframe list that contains t: index i with times[i-1] <= t < times[i].
function segment(times, t) {
  let lo = 0, hi = times.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid; }
  return lo;
}

export function evaluate(p, t, ctx) {
  if (typeof p === 'number') return p;
  const kind = paramKind(p);
  if (kind === 'keys') {
    const keys = keysOf(p), times = keyTimes(p, ctx), i = segment(times, t);
    if (i === 0) return keys[0][1];
    if (i >= keys.length) return keys[keys.length - 1][1];
    const a = keys[i - 1], b = keys[i], d = times[i] - times[i - 1];
    const u = d > 0 ? (t - times[i - 1]) / d : 1;
    return a[1] + (b[1] - a[1]) * EASES[b[2] || 'linear'].f(u);
  }
  if (kind === 'bind') return (p.base ?? 0) + (p.scale ?? 1) * envelopeAt(ctx.features, p, t);
  if (kind === 'mul') return p.mul.reduce((x, q) => x * evaluate(q, t, ctx), 1);
  if (kind === 'add') return p.add.reduce((x, q) => x + evaluate(q, t, ctx), 0);
  return 0;
}

// A Param compiled once for one origin: t -> value, with its key times fixed.
// What compile uses per frame; evaluate() is the same function, uncompiled.
export function paramFn(p, ctx) {
  if (typeof p === 'number') return () => p;
  const kind = paramKind(p);
  if (kind === 'keys') {
    const keys = keysOf(p), times = Float64Array.from(keys, k => keyTime(p, k[0], ctx)), n = keys.length;
    const f = keys.map(k => EASES[k[2] || 'linear'].f);
    return t => {
      let lo = 0, hi = n;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid; }
      if (lo === 0) return keys[0][1];
      if (lo >= n) return keys[n - 1][1];
      const a = keys[lo - 1][1], b = keys[lo][1], d = times[lo] - times[lo - 1];
      return a + (b - a) * f[lo](d > 0 ? (t - times[lo - 1]) / d : 1);
    };
  }
  if (kind === 'bind') {
    const y = envelope(ctx.features, p), base = p.base ?? 0, scale = p.scale ?? 1, fps = ctx.features?.fps || FPS;
    if (!y || !y.length) return () => base;
    return t => base + scale * y[Math.max(0, Math.min(y.length - 1, Math.floor(t * fps + 1e-9)))];
  }
  if (kind === 'mul' || kind === 'add') {
    const fs = p[kind].map(q => paramFn(q, ctx));
    return kind === 'mul' ? t => { let x = 1; for (const g of fs) x *= g(t); return x; } : t => { let x = 0; for (const g of fs) x += g(t); return x; };
  }
  return () => 0;
}

// Song times inside (a, b) where a Param stops being smooth: keyframes, and the
// frame edges of a bound feature. Integrators split there.
export function breakpoints(p, a, b, ctx, out = []) {
  const kind = paramKind(p);
  if (kind === 'keys') for (const t of keyTimes(p, ctx)) { if (t > a && t < b) out.push(t); }
  else if (kind === 'bind') {
    const fps = ctx.features?.fps || FPS;
    for (let g = Math.floor(a * fps) + 1; g / fps < b; g++) out.push(g / fps);
  } else if (kind === 'mul' || kind === 'add') for (const q of p[kind]) breakpoints(q, a, b, ctx, out);
  return out;
}

// The closed-form integral of a keyframed Param over [a, b] (seconds), when it is
// one: no binds inside. Returns null when it is not.
export function integrateKeys(p, a, b, ctx) {
  if (typeof p === 'number') return p * (b - a);
  if (paramKind(p) !== 'keys') return null;
  const keys = keysOf(p), times = keyTimes(p, ctx);
  // ∫ from -∞ convention: integrate piecewise from a to b.
  let sum = 0, t = a;
  while (t < b) {
    const i = segment(times, t);
    const end = i < times.length ? Math.min(b, times[i]) : b;
    if (i === 0) sum += keys[0][1] * (end - t);
    else if (i >= keys.length) sum += keys[keys.length - 1][1] * (end - t);
    else {
      const k0 = keys[i - 1], k1 = keys[i], t0 = times[i - 1], d = times[i] - t0, E = EASES[k1[2] || 'linear'];
      if (d <= 0) sum += k1[1] * (end - t);
      else { const u0 = (t - t0) / d, u1 = (end - t0) / d; sum += d * (k0[1] * (u1 - u0) + (k1[1] - k0[1]) * (E.F(u1) - E.F(u0))); }
    }
    if (end <= t) break;
    t = end;
  }
  return sum;
}

// The smallest and largest value a Param takes over [a, b] (for lints: negative
// rates, zoom ceilings). Exact for keyframes, sampled per frame for binds.
export function range(p, a, b, ctx) {
  const kind = paramKind(p);
  if (kind === 'number') return [p, p];
  if (kind === 'keys') {
    const keys = keysOf(p), times = keyTimes(p, ctx);
    let lo = evaluate(p, a, ctx), hi = lo;
    const v = evaluate(p, b, ctx); lo = Math.min(lo, v); hi = Math.max(hi, v);
    keys.forEach((k, i) => { if (times[i] >= a && times[i] <= b) { lo = Math.min(lo, k[1]); hi = Math.max(hi, k[1]); } });
    // outBack overshoots its keys: sample those segments.
    keys.forEach((k, i) => { if (i && k[2] === 'outBack') for (let j = 1; j < 16; j++) { const t = times[i - 1] + (times[i] - times[i - 1]) * j / 16; if (t >= a && t <= b) { const x = evaluate(p, t, ctx); lo = Math.min(lo, x); hi = Math.max(hi, x); } } });
    return [lo, hi];
  }
  const fps = ctx.fps || FPS;
  let lo = Infinity, hi = -Infinity;
  for (let f = Math.floor(a * fps); f <= Math.ceil(b * fps); f++) { const x = evaluate(p, Math.min(b, Math.max(a, f / fps)), ctx); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return [lo, hi];
}

// ---- feature tracks -------------------------------------------------------------
//   Features {fps, frames, source:'render'|'plan',
//             kick: Float32Array(frames)       1 on the frame a kick lands (the plan's exact kicks), else 0
//             kickLevel: Float32Array(frames)  low band (35–150 Hz) of the drums stem, 0..1 (render) or the kick (plan)
//             roll: Float32Array(frames)       the build's snare-roll velocity, 0..1 (from the plan)
//             stems:{drums, bass, keys, guitar, voice, lady: Float32Array(frames)}   RMS level 0..1
//             eq: null | {N, edges, data: Float32Array(frames·N)}}                   master bands, eq.js levels
// Frame g describes song time g/fps; the audio is read LEAD (10 ms) ahead, as
// the Peg Board's equalizer does, so a bound value never lags the sound.
// Levels: RMS in dBFS mapped linearly from LEVEL_FLOOR_DB (0) to LEVEL_TOP_DB (1).
export const LEVEL_FLOOR_DB = -60, LEVEL_TOP_DB = -6;
export const levelOf = rms => { const db = 20 * Math.log10(rms + 1e-12); return Math.max(0, Math.min(1, (db - LEVEL_FLOOR_DB) / (LEVEL_TOP_DB - LEVEL_FLOOR_DB))); };

function framesOf(plan, fps) { return Math.ceil(plan.duration * fps - 1e-9); }

// Kick onsets from the plan, exactly as the engine schedules them (eq.js kickSteps), each on
// the frame that holds its audible onset (a hit).
function kickTrack(plan, fps, frames) {
  const kick = new Float32Array(frames), steps = kickSteps(plan);
  for (let s = 0; s < steps.length; s++) if (steps[s]) { const g = hitFrame(stepTime(plan, s), plan, fps); if (g >= 0 && g < frames) kick[g] = 1; }
  return kick;
}
function rollTrack(plan, fps, frames) {
  const roll = new Float32Array(frames), bs = plan.barSteps ?? 16;
  (plan.bars || []).forEach((b, bar) => {
    const r = b.layers?.roll; if (!Array.isArray(r)) return;
    const a = stepTime(plan, bar * bs), z = stepTime(plan, (bar + 1) * bs);
    for (let g = Math.ceil(a * fps); g / fps < z && g < frames; g++) if (g >= 0) roll[g] = Math.min(1, r[1] + (r[2] - r[1]) * (g / fps - a) / (z - a));
  });
  return roll;
}
const silentSpan = (plan) => plan.choke ? [stepTime(plan, plan.choke.at), stepTime(plan, plan.choke.until)] : null;

// The fallback when no render exists yet: levels from the plan's players and events.
export function planFeatures(plan, {fps = FPS} = {}) {
  const frames = framesOf(plan, fps), bs = plan.barSteps ?? 16;
  const stems = Object.fromEntries(STEMS.map(n => [n, new Float32Array(frames)]));
  const kick = kickTrack(plan, fps, frames), choke = silentSpan(plan);
  const level = {drums:.6, bass:.55, keys:.45, guitar:.5, voice:.8, lady:.8};
  (plan.bars || []).forEach((b, bar) => {
    const L = b.layers || {}, a = stepTime(plan, bar * bs), z = stepTime(plan, (bar + 1) * bs);
    const on = {drums:!!(L.kick || L.clap || L.hats || L.drums === 'build' || L.ride), bass:!!L.bass, keys:!!(L.stabs || L.pad), guitar:!!L.guitar};
    for (let g = Math.max(0, Math.ceil(a * fps - 1e-9)); g < frames && g / fps < z - 1e-9; g++) for (const n of Object.keys(on)) if (on[n]) stems[n][g] = level[n];
  });
  const span = (name, t0, t1) => { for (let g = Math.max(0, Math.floor(t0 * fps)); g < frames && g / fps < t1; g++) stems[name][g] = level[name]; };
  for (const w of plan.words || []) { const t = stepTime(plan, w.at); span('voice', t, Math.min(t + (w.gate ?? Infinity), stepTime(plan, w.at + (w.steps ?? 1)))); }
  for (const e of plan.lady || []) { const t = ladyTime(plan, e); span('lady', t, t + (e.gate ?? .2)); }
  for (let g = 0; g < frames; g++) if (kick[g]) stems.drums[g] = 1;
  if (choke) for (let g = Math.ceil(choke[0] * fps); g < Math.min(frames, Math.ceil(choke[1] * fps)); g++) for (const n of STEMS) { if (n === 'lady' && g / fps < choke[0] + .5) continue; stems[n][g] = 0; }
  return {fps, frames, source:'plan', kick, kickLevel:kick.slice(), roll:rollTrack(plan, fps, frames), stems, eq:null};
}

// Offline, from an engine.render(plan, buffers, {tune:{stems:true}}) result: an
// AudioBuffer-like object with getChannelData() (master on 0-1, STEMS on 2-7), or
// {sampleRate, channels:{name:Float32Array}, master?:[L, R]}. `offset` is where
// song time 0 sits in the buffer (engine.js RENDER_OFFSET - plan.timing[first]).
export function buildFeatures(plan, audio, {fps = FPS, offset = RENDER_OFFSET - plan.timing[0], eqBands = 8, lead = LEAD} = {}) {
  const sr = audio.sampleRate, frames = framesOf(plan, fps);
  const channels = audio.channels || Object.fromEntries(STEMS.map((n, i) => [n, audio.getChannelData(2 + i)]));
  const master = audio.master || (audio.getChannelData ? [audio.getChannelData(0), audio.getChannelData(1)] : null);
  const stems = {}, half = Math.round(sr / fps / 2);
  for (const name of STEMS) {
    const x = channels[name], out = stems[name] = new Float32Array(frames);
    if (!x) continue;
    for (let g = 0; g < frames; g++) {
      const c = Math.round((offset + g / fps + lead) * sr);
      let s = 0, n = 0;
      for (let i = Math.max(0, c - half); i < Math.min(x.length, c + half); i++) { s += x[i] * x[i]; n++; }
      out[g] = n ? levelOf(Math.sqrt(s / n)) : 0;
    }
  }
  let kickLevel = new Float32Array(frames), eq = null;
  if (channels.drums) {
    const low = eqTrack({drums:channels.drums}, sr, {fps, N:1, lo:35, hi:150, offset, duration:frames / fps, lead});
    kickLevel = low.data.drums.slice(0, frames);
  }
  if (master && eqBands > 0) {
    const t = eqTrack({master}, sr, {fps, N:eqBands, offset, duration:frames / fps, lead});
    eq = {N:eqBands, edges:t.edges.master, data:t.data.master};
  }
  return {fps, frames, source:'render', kick:kickTrack(plan, fps, frames), kickLevel, roll:rollTrack(plan, fps, frames), stems, eq};
}

// The raw series a bind reads.
function series(features, bind) {
  if (!features) return null;
  if (bind === 'kick') return features.kick;
  if (bind === 'kickLevel') return features.kickLevel || features.kick;
  if (bind === 'roll') return features.roll;
  if (bind === 'voice') return features.stems?.voice;
  if (bind.startsWith('stem:')) return features.stems?.[bind.slice(5)];
  if (bind.startsWith('eq:')) {
    const band = +bind.slice(3), eq = features.eq;
    if (!eq || band >= eq.N) return null;
    const out = new Float32Array(features.frames);
    for (let g = 0; g < out.length; g++) out[g] = eq.data[g * eq.N + band];
    return out;
  }
  return null;
}

// One-pole follower, precomputed once per (features, bind, attack, release):
// y += (x > y ? a : r)·(x − y), a = 1 − e^(−dt/attack). Random access is a lookup.
const envCache = new WeakMap();
export function envelope(features, p) {
  if (!features) return null;
  let cache = envCache.get(features);
  if (!cache) envCache.set(features, cache = new Map());
  const key = `${p.bind}|${p.attack ?? 0}|${p.release ?? 0}`;
  if (cache.has(key)) return cache.get(key);
  const x = series(features, p.bind);
  let y = null;
  if (x) {
    const dt = 1 / features.fps, coef = tau => tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
    const a = coef(p.attack ?? 0), r = coef(p.release ?? 0);
    y = new Float32Array(x.length);
    let v = 0;
    for (let g = 0; g < x.length; g++) { v += (x[g] > v ? a : r) * (x[g] - v); y[g] = v; }
  }
  cache.set(key, y);
  return y;
}
export function envelopeAt(features, p, t) {
  const y = envelope(features, p);
  if (!y || !y.length) return 0;
  const g = Math.floor(t * features.fps + 1e-9);
  return y[Math.max(0, Math.min(y.length - 1, g))];
}
