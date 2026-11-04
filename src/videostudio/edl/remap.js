// Output frame -> source time, exactly. A clip's picture time is a pure
// function of song time, built once per clip and then evaluated anywhere, so
// frame 900 costs the same whether or not frames 0-899 were drawn.
//
// Forward source time S(t) for song time t, from the clip's cut frame t0 = F0/fps:
//   S(t) = in + dir · ∫[t0, t] rate(τ) · tape(τ) · live(τ) dτ          dir = -1 when reversed
// rate is a Param; tape is the song's varispeed (plan.tape, the same curve the
// engine's delay line plays); live is 0 inside a freeze. The integral is split
// at every point where the integrand stops being smooth (keys, tape edges,
// freeze edges, a bound feature's frames). Keyframed rates alone integrate in
// closed form (each ease has an exact antiderivative, params.js). Anything else
// (a rate under the tape, a freeze, a bind) is integrated piece by piece with
// 6-point Gauss-Legendre on pieces of at most 50 ms: exact for polynomials to
// degree 11, ~1e-15 s on the steepest ease. Prefix sums at the breakpoints make
// any t a binary search plus one piece. Nothing is stepped frame by frame, so
// nothing drifts.
//
// On top of S: repeat (restart every unit, optional ping-pong: the slice replayed backwards,
// per-repeat variations), freezeAt, an explicit piecewise-linear map (hit warp),
// and the program-level transports (rewind, tape stop), which remap song time
// itself before any clip is asked.
import {stepTime, FPS} from './anchors.js';
import {paramFn, breakpoints, paramKind, integrateKeys} from './params.js';

// ---- integration ------------------------------------------------------------------
const GX = [-0.9324695142031521, -0.6612093864662645, -0.2386191860831969, 0.2386191860831969, 0.6612093864662645, 0.9324695142031521];
const GW = [0.1713244923791704, 0.3607615730481386, 0.4679139345726910, 0.4679139345726910, 0.3607615730481386, 0.1713244923791704];
export function gauss(f, a, b) {
  if (b === a) return 0;
  const h = (b - a) / 2, m = (a + b) / 2;
  let s = 0;
  for (let i = 0; i < 6; i++) s += GW[i] * f(m + h * GX[i]);
  return s * h;
}
// ∫[t0, t] f for any t >= t0, with f smooth between consecutive `breaks`. Pieces
// longer than `maxPiece` seconds are split, so even an outExpo key (the steepest
// ease) integrates to rounding error (~1e-15 s).
export const MAX_PIECE = .05;
export function createIntegral(f, t0, breaks, maxPiece = MAX_PIECE) {
  const sorted = [...new Set(breaks.filter(x => x > t0))].sort((x, y) => x - y), b = [];
  let prev = t0;
  for (const x of sorted) { const n = Math.ceil((x - prev) / maxPiece - 1e-9); for (let i = 1; i < n; i++) b.push(prev + (x - prev) * i / n); b.push(x); prev = x; }
  const at = Float64Array.from([t0, ...b]), prefix = new Float64Array(at.length);
  for (let i = 1; i < at.length; i++) prefix[i] = prefix[i - 1] + gauss(f, at[i - 1], at[i]);
  return t => {
    if (t <= t0) return 0;
    let lo = 0, hi = at.length - 1;
    if (t >= at[hi]) {
      // Past the last break the integrand is smooth: keep the pieces short there too.
      let sum = prefix[hi], x = at[hi];
      while (t - x > maxPiece) { sum += gauss(f, x, x + maxPiece); x += maxPiece; }
      return sum + gauss(f, x, t);
    }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (at[mid] <= t) lo = mid; else hi = mid; }
    return prefix[lo] + gauss(f, at[lo], t);
  };
}

// ---- the song's varispeed -------------------------------------------------------------
// plan.tape, as engine.js tapeEvent() plays it through its delay line:
//   sink {from, to, rate:[r0, r1]}: pitch r0 → r1 linearly across the span, then the dry
//        signal returns at 1 (the audio's content jumps forward by the lag; the picture
//        does not jump, its rate simply returns to 1);
//   stop {from, seconds}: pitch 1 → 0 over `seconds`, then silence: the picture holds.
// The engine draws its delay curve with 256 points; the analytic ramp here differs
// from it by under 2 µs of content time. A future plan.transport lane of
// [[step, rate], ...] (piecewise linear) is read the same way.
export function tapeCurve(plan) {
  const segs = [];
  for (const x of plan.tape || []) {
    const t0 = stepTime(plan, x.from);
    if (x.kind === 'stop') { const [r0, r1] = x.rate || [1, 0]; segs.push({kind:'stop', t0, t1:t0 + (x.seconds ?? .4), r0, r1, after:0}); }
    else { const [r0, r1] = x.rate || [1, .5]; segs.push({kind:x.kind, t0, t1:stepTime(plan, x.to), r0, r1, after:1}); }
  }
  if (Array.isArray(plan.transport)) {
    const pts = plan.transport.map(([s, r]) => [stepTime(plan, s), r]);
    for (let i = 0; i + 1 < pts.length; i++) segs.push({kind:'lane', t0:pts[i][0], t1:pts[i + 1][0], r0:pts[i][1], r1:pts[i + 1][1], after:i + 2 === pts.length ? pts[i + 1][1] : null});
  }
  segs.sort((a, b) => a.t0 - b.t0);
  const rateAt = t => {
    let r = 1;
    for (const s of segs) {
      if (t < s.t0) break;
      if (t < s.t1) return s.r0 + (s.r1 - s.r0) * (t - s.t0) / (s.t1 - s.t0);
      if (s.after !== null) r = s.after;
      if (s.kind === 'sink') r = 1;
    }
    return r;
  };
  const breaks = segs.flatMap(s => [s.t0, s.t1]);
  // Content time: what the listener hears at song time t (∫ rate), closed form.
  const contentAt = t => {
    let c = 0, last = 0, r = 1;
    for (const s of segs) {
      if (t <= s.t0) break;
      c += r * (s.t0 - last);
      const e = Math.min(t, s.t1), u = (e - s.t0) / (s.t1 - s.t0);
      c += (s.t1 - s.t0) * (s.r0 * u + (s.r1 - s.r0) * u * u / 2);
      last = e;
      r = s.kind === 'sink' ? 1 : s.after ?? r;
      if (t <= s.t1) return c;
    }
    return c + r * (t - last);
  };
  return {segments:segs, rateAt, contentAt, breaks};
}

// ---- helpers moves share ----------------------------------------------------------------
// Fit a source span into a slot. rate = src/slot, clamped to [min, max]: faster than
// max, the source is trimmed (only max·slot seconds play); slower than min, the
// slot is trimmed (the clip ends when the source does, at min).
export function speedFit(srcSeconds, slotSeconds, {min = .5, max = 2} = {}) {
  const r = srcSeconds / slotSeconds;
  if (r >= min && r <= max) return {rate:r, srcUsed:srcSeconds, slotUsed:slotSeconds, trimmed:'none'};
  if (r > max) return {rate:max, srcUsed:max * slotSeconds, slotUsed:slotSeconds, trimmed:'source'};
  return {rate:min, srcUsed:srcSeconds, slotUsed:srcSeconds / min, trimmed:'slot'};
}

// Hit warp: map a plate's hits (source seconds) onto a grid of song steps (8th
// notes by default) with every local rate inside [min, max]. A dynamic program
// over (hit, grid point) pairs keeps the most hits on the grid, then the
// smallest total |log rate|. Returns an explicit time map for time.map:
// [[localStep, srcSeconds], ...], local steps from `at`.
export function hitWarp({plan, at, len, hits, grid, min = .85, max = 1.15, maxSkipHits = 4, maxSkipGrid = 8}) {
  const steps = grid || Array.from({length:Math.floor(len / 2) + 1}, (_, i) => at + 2 * i).filter(s => s < at + len);
  const G = steps.map(s => stepTime(plan, s)), H = [...hits].sort((a, b) => a - b);
  const n = H.length, m = G.length, best = [], from = [];
  const cost = s => Math.abs(Math.log(s));
  for (let i = 0; i < n; i++) {
    best.push(new Array(m)); from.push(new Array(m));
    for (let j = 0; j < m; j++) {
      let b = [1, 0], f = null;
      for (let i2 = Math.max(0, i - maxSkipHits); i2 < i; i2++) for (let j2 = Math.max(0, j - maxSkipGrid); j2 < j; j2++) {
        const prev = best[i2][j2]; if (!prev) continue;
        const slope = (H[i] - H[i2]) / (G[j] - G[j2]);
        if (slope < min || slope > max) continue;
        const c = [prev[0] + 1, prev[1] + cost(slope)];
        if (c[0] > b[0] || (c[0] === b[0] && c[1] < b[1])) { b = c; f = [i2, j2]; }
      }
      best[i][j] = b; from[i][j] = f;
    }
  }
  let end = null;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const b = best[i][j]; if (!end || b[0] > end.b[0] || (b[0] === end.b[0] && b[1] < end.b[1])) end = {i, j, b}; }
  const pairs = [];
  for (let p = end && [end.i, end.j]; p; p = from[p[0]][p[1]]) pairs.unshift(p);
  if (!pairs.length) return {map:null, matched:[], rates:[]};
  // Rate 1 before the first anchor and after the last.
  const map = [], first = pairs[0], startSrc = H[first[0]] - (G[first[1]] - stepTime(plan, at));
  if (steps[first[1]] !== at) map.push([0, startSrc]);
  for (const [i, j] of pairs) map.push([steps[j] - at, H[i]]);
  const rates = map.slice(1).map((p, k) => (p[1] - map[k][1]) / (stepTime(plan, at + p[0]) - stepTime(plan, at + map[k][0])));
  return {map, matched:pairs.map(([i, j]) => ({hit:H[i], step:steps[j]})), rates, startSrc};
}

// ---- the clip time map ----------------------------------------------------------------------
// ctx: {plan, shot, features, fps, origin:{step, shift, frame}, endFrame, tape (tapeCurve), stutterFrames}
// Returns {at(t) -> {src, dir, source, repeat, local}, restarts:[frames], freezes:[[a, b]], sliceSeconds}
//   src     forward source seconds (clamped to the shot by compile)
//   dir     +1 forward, -1 backward, 0 held
//   source  'stream' (decode it), 'stutter' (replay from the stutter cache), 'still' (a held frame)
//   repeat  index of the current repeat (0 without one)
export function clipTimeMap(clip, ctx) {
  const {plan, origin} = ctx, fps = ctx.fps || FPS, time = clip.time || {};
  const t0 = origin.frame / fps, shift = origin.shift || 0;
  const localTime = k => stepTime(plan, origin.step + k) + shift;
  const tEnd = (ctx.endFrame ?? origin.frame + fps * 60) / fps + 1;
  const dir = time.reverse ? -1 : 1;
  const pctx = {plan, features:ctx.features, origin, fps};
  const rateP = time.rate ?? 1, rate = paramFn(rateP, pctx);
  const tape = time.tape ? ctx.tape : null;

  // Freezes: song-time windows where the picture holds.
  const freezes = [];
  let stillSrc = null;
  const fz = time.freezeAt;
  if (typeof fz === 'number') freezes.push([localTime(fz), Infinity]);
  else if (fz && typeof fz === 'object') {
    if (Number.isFinite(fz.src)) stillSrc = fz.src;
    else { const a = localTime(fz.at ?? 0); freezes.push([a, fz.len === undefined ? Infinity : localTime((fz.at ?? 0) + fz.len)]); }
  }
  const live = t => { for (const [a, b] of freezes) if (t >= a && t < b) return 0; return 1; };

  // The base map S(t).
  let S, velocity;
  if (Array.isArray(time.map) && time.map.length) {
    const pts = time.map.map(([k, s]) => [localTime(k), s]);
    const slope = i => pts.length < 2 ? 1 : (pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]);
    const seg = t => { let i = 0; while (i + 2 < pts.length && t >= pts[i + 1][0]) i++; return i; };
    S = t => {
      if (pts.length === 1) return pts[0][1] + dir * (t - pts[0][0]);
      if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1] + (t - pts[pts.length - 1][0]);
      const i = seg(t); return pts[i][1] + slope(i) * (t - pts[i][0]);
    };
    velocity = t => t >= pts[pts.length - 1][0] || pts.length < 2 ? 1 : slope(seg(t));
  } else {
    const integrand = tape ? t => rate(t) * tape.rateAt(t) * live(t) : freezes.length ? t => rate(t) * live(t) : rate;
    let integral;
    if (paramKind(rateP) === 'number' && !tape && !freezes.length) integral = t => t <= t0 ? 0 : rateP * (t - t0);
    else if (paramKind(rateP) === 'keys' && !tape && !freezes.length) integral = t => t <= t0 ? 0 : integrateKeys(rateP, t0, t, pctx);   // closed form
    else {
      const breaks = breakpoints(rateP, t0, tEnd, pctx);
      if (tape) breaks.push(...tape.breaks);
      for (const [a, b] of freezes) breaks.push(a, b);
      integral = createIntegral(integrand, t0, breaks.filter(x => Number.isFinite(x) && x > t0 && x < tEnd));
    }
    const inn = time.in ?? 0;
    S = t => inn + dir * integral(t);
    velocity = t => dir * integrand(t);
  }
  if (stillSrc !== null) { S = () => stillSrc; velocity = () => 0; }

  // Repeats: restart frames R_k, the first slice's length L0 (song seconds).
  const rep = time.repeat;
  const restarts = [origin.frame];
  let count = 1, L0 = Infinity;
  if (rep) {
    const unit = rep.unit, end = ctx.endFrame ?? Infinity;
    const restartFrame = k => typeof unit === 'number' ? Math.round((localTime(k * unit)) * fps)
      : unit.frames !== undefined ? origin.frame + k * unit.frames : Math.round(localTime(k * unit.steps) * fps);
    count = rep.count ?? Infinity;
    for (let k = 1; k < count; k++) { const r = restartFrame(k); if (r >= end || k > 4096) break; restarts.push(r); }
    count = restarts.length;
    L0 = (restartFrame(1) - origin.frame) / fps;
  }
  const sliceSrc = Number.isFinite(L0) ? Math.abs(S(t0 + L0) - S(t0)) : Infinity;
  const cacheable = sliceSrc * (ctx.shot?.fps || fps) <= (ctx.stutterFrames ?? 12) + 1e-9;

  function at(t) {
    let k = 0;
    if (count > 1) {
      const f = t * fps + 1e-9;
      let lo = 0, hi = count - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (restarts[mid] <= f) lo = mid; else hi = mid - 1; }
      k = lo;
    }
    const delta = t - restarts[k] / fps;
    // Ping-pong: odd repeats play the first slice's frames in reverse order, frame
    // for frame (the stutter cache holds exactly those frames): L0 − 1/fps − delta.
    const back = !!rep?.pingpong && k % 2 === 1;
    let local = back ? L0 - 1 / fps - delta : delta;
    if (local < 0) local = 0;
    const tt = t0 + local;
    const src = S(tt), v = velocity(tt) * (back ? -1 : 1);
    let source = 'stream';
    if (v === 0 || live(tt) === 0 || stillSrc !== null) source = 'still';
    else if (k > 0 && cacheable && local <= L0 + 1e-9) source = 'stutter';
    return {src, dir:source === 'still' ? 0 : Math.sign(v), source, repeat:k, local};
  }
  return {at, restarts, freezes, sliceSeconds:L0, count, t0};
}

// ---- program transports ------------------------------------------------------------------------
// A transport remaps song time for the whole composite inside its window:
//   rewind   v(t) = Tfrom − rate·(t − Ta): every layer runs backwards at `rate` (4×),
//            the audio reversed over the same span (transport.audio must be true).
//   tapestop v(t) = Ta + τ − τ²/(2S) for τ = t − Ta < S, then held at Ta + S/2: the
//            picture slows to a stop on the engine's tape-stop curve.
//   jump     v(t) = Tfrom + (t − Ta): the picture of another moment, forwards (the cold open
//            shows the impact at frame 0, where its sound is copied).
// resolved: {kind, from, to (frames), Ta (song seconds), Tfrom, rate, seconds}
export function transportTime(tr, t) {
  if (tr.kind === 'rewind') return tr.Tfrom - tr.rate * (t - tr.Ta);
  if (tr.kind === 'jump') return tr.Tfrom + (t - tr.Ta);
  const tau = t - tr.Ta, S = tr.seconds;
  if (tau <= 0) return t;
  return tau < S ? tr.Ta + tau - tau * tau / (2 * S) : tr.Ta + S / 2;
}
