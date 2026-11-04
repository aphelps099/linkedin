// The scene equalizer: log-spaced bands, one level mapping, a deterministic
// follower (instant rise, timed fall, peak hold under gravity, whole rows) and
// the offline eqTrack. Live reads the engine's AnalyserNodes; the export runs
// its own FFT over the rendered stems, 10 ms ahead of every frame. Both paths
// land in one calibration, so the chart seen live is the chart the export
// draws. Pure, except fromAnalyser(), which reads a node.
//
// Power spectra here are one-sided and Parseval-normalised: bin powers sum to
// the window-weighted mean square of the signal, whatever the window. That is
// what lets the analyser's Blackman window and the export's Hann agree.
import {PATTERNS} from '../allhands/song.js';

export const LEAD = .010;          // seconds the FFT looks ahead of the frame: the chart never lags
export const FPS = 24;
const REF_HZ = 1000, OCTAVE_AT_REF = REF_HZ * Math.LN2;   // an octave-wide band at 1 kHz, in Hz

// N log-spaced bands, N + 1 edges: f_i = lo·(hi/lo)^(i/N).
export function bandEdges(N, lo = 40, hi = 16000) {
  const e = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) e[i] = lo * (hi / lo) ** (i / N);
  e[N] = hi;
  return e;
}

// ---- FFT ------------------------------------------------------------------------

export const WINDOWS = {
  hann:(n, N) => .5 - .5 * Math.cos(2 * Math.PI * n / N),
  // The AnalyserNode's window (Web Audio: Blackman, alpha .16), for bit-matching the live path.
  blackman:(n, N) => .42 - .5 * Math.cos(2 * Math.PI * n / N) + .08 * Math.cos(4 * Math.PI * n / N),
};
const plans = new Map();
function fftPlan(N, window = 'hann') {
  const key = N + window;
  if (plans.has(key)) return plans.get(key);
  if (!(N >= 2 && (N & (N - 1)) === 0)) throw Error(`fftSize must be a power of two, got ${N}`);
  const shape = WINDOWS[window];
  if (!shape) throw Error(`Unknown window ${window}`);
  const w = new Float64Array(N), rev = new Uint32Array(N), cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
  let energy = 0;
  for (let n = 0; n < N; n++) { w[n] = shape(n, N); energy += w[n] * w[n]; }
  for (let i = 0, bits = Math.log2(N); i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  for (let k = 0; k < N / 2; k++) { cos[k] = Math.cos(2 * Math.PI * k / N); sin[k] = Math.sin(2 * Math.PI * k / N); }
  const p = {N, w, energy, rev, cos, sin, re:new Float64Array(N), im:new Float64Array(N)};
  plans.set(key, p);
  return p;
}
export const windowEnergy = (N, window = 'hann') => fftPlan(N, window).energy;

// In-place iterative radix-2 FFT of (re, im); inverse is unscaled (divide by N yourself).
export function fft(re, im, inverse = false) {
  const N = re.length, {rev, cos, sin} = fftPlan(N), sign = inverse ? 1 : -1;
  for (let i = 0; i < N; i++) {
    const j = rev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, stride = N / size;
    for (let i = 0; i < N; i += size) for (let k = 0; k < half; k++) {
      const wr = cos[k * stride], wi = sign * sin[k * stride], a = i + k, b = a + half;
      const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
    }
  }
}

// One windowed power spectrum (fftSize/2 bins, like an AnalyserNode) centred on
// `at` seconds. `channel` is a Float32Array, or [left, right], down-mixed to
// .5·(L + R) as an AnalyserNode and a mono ChannelMerger input do. Samples
// outside the buffer are silence. Reuses `out` when given.
export function stft(channel, sampleRate, {fftSize = 2048, window = 'hann', at = 0, out} = {}) {
  const p = fftPlan(fftSize, window), {N, w, re, im} = p, stereo = Array.isArray(channel);
  const L = stereo ? channel[0] : channel, R = stereo ? channel[1] ?? channel[0] : null, length = L.length;
  const start = Math.round(at * sampleRate) - N / 2;
  for (let n = 0; n < N; n++) {
    const j = start + n, x = j < 0 || j >= length ? 0 : R ? .5 * (L[j] + R[j]) : L[j];
    re[n] = x * w[n]; im[n] = 0;
  }
  fft(re, im);
  const power = out || new Float32Array(N / 2), scale = 2 / (N * p.energy);
  for (let k = 0; k < N / 2; k++) power[k] = (re[k] * re[k] + im[k] * im[k]) * (k ? scale : scale / 2);
  return power;
}

// The live path: an AnalyserNode's dB spectrum, as power in the same units as stft().
// The node reports |X|/N in dB through its Blackman window; undo both. `scratch`
// keeps the buffers, so a frame allocates nothing.
export function fromAnalyser(analyser, scratch = {}) {
  const n = analyser.frequencyBinCount, N = analyser.fftSize;
  if (scratch.power?.length !== n || scratch.N !== N) {
    scratch.db = new Float32Array(n); scratch.power = new Float32Array(n); scratch.N = N;
    scratch.scale = 2 * N / windowEnergy(N, 'blackman');
  }
  const {db, power, scale} = scratch;
  analyser.getFloatFrequencyData(db);
  for (let k = 0; k < n; k++) { const d = db[k]; power[k] = d > -400 ? 10 ** (d / 10) * (k ? scale : scale / 2) : 0; }
  return power;
}

// ---- the level mapping ----------------------------------------------------------

// ∫ of the bin powers, linearly interpolated between bin centres, over bins [x0, x1].
// A band narrower than a bin gets the interpolated value, not a whole bin or none.
function integrate(P, x0, x1) {
  const last = P.length - 1;
  if (x0 < 0) x0 = 0;
  if (x1 > last) x1 = last;
  let sum = 0;
  for (let k = Math.floor(x0); k < x1; k++) {
    const u = Math.max(x0, k), v = Math.min(x1, k + 1);
    sum += (v - u) * (P[k] + (P[k + 1] - P[k]) * ((u + v) / 2 - k));
  }
  return sum;
}

// Per band, 0..1. Band power is summed from the bins, taken as a density (per Hz,
// so the reading does not depend on how many bands a chart has), expressed as
// the power of an octave at 1 kHz, tilted `tilt` dB/oct around 1 kHz, then
// floorDb..topDb maps to 0..1 and is raised to `gamma`.
// The tilt is quoted the way spectrum analysers quote it (on the density): at
// 4.5 dB/oct a typical mix (density falling ~4.5 dB/oct) reads flat, pink noise
// rises a gentle 1.5 dB/oct, and tilt 3 makes pink noise exactly flat.
export function bandLevels(power, sampleRate, fftSize, edges, {tilt = 4.5, floorDb = -60, topDb = -6, gamma = .8, out} = {}) {
  const N = edges.length - 1, df = sampleRate / fftSize, levels = out || new Float32Array(N), range = topDb - floorDb;
  for (let i = 0; i < N; i++) {
    const a = edges[i], b = edges[i + 1], p = integrate(power, a / df, b / df);
    const db = 10 * Math.log10(p / (b - a) * OCTAVE_AT_REF + 1e-30) + tilt * Math.log2(Math.sqrt(a * b) / REF_HZ);
    const x = (db - floorDb) / range;
    levels[i] = x <= 0 ? 0 : x >= 1 ? 1 : x ** gamma;
  }
  return levels;
}

// ---- the follower -----------------------------------------------------------------

// Bars rise at once and fall their full height in fallLow s (bands centred under
// splitHz) or fallHigh s. Peaks hold `hold` s, then drop under `gravity` rows/s².
// Heights snap to whole rows: up as soon as the bar rounds up, down only once it
// is `hysteresis` of a row under the rounding point, so it never flickers.
// step(levels 0..1, dt, slow = 1) -> {heights, peaks}, both in rows, reused each step.
// A peak is the row its peg sits in (the row on top of the bar); 0 means none.
// `slow` stretches the falls (2 for slow-mo scenes). Same inputs, same outputs.
export function createFollower(N, {fallLow = .12, fallHigh = .18, splitHz = 250, hold = .25, gravity = 30, rows = 8, hysteresis = .35, edges = bandEdges(N)} = {}) {
  const fall = Float64Array.from({length:N}, (_, i) => Math.sqrt(edges[i] * edges[i + 1]) < splitHz ? fallLow : fallHigh);
  const bar = new Float64Array(N), peak = new Float64Array(N), age = new Float64Array(N), speed = new Float64Array(N);
  const heights = new Float32Array(N), peaks = new Float32Array(N);
  function step(levels, dt, slow = 1) {
    for (let i = 0; i < N; i++) {
      const v = levels[i], target = (v > 0 ? v < 1 ? v : 1 : 0) * rows;
      bar[i] = target >= bar[i] ? target : Math.max(target, bar[i] - rows * dt / (fall[i] * slow));
      if (bar[i] >= peak[i]) { peak[i] = bar[i]; age[i] = 0; speed[i] = 0; }
      else {
        // Free fall after the hold, integrated exactly, so any frame rate gives the same path.
        const t = Math.min(dt, Math.max(0, age[i] + dt - hold));
        age[i] += dt;
        if (t > 0) { peak[i] = Math.max(bar[i], peak[i] - speed[i] * t - gravity * t * t / 2); speed[i] += gravity * t; }
      }
      const h = heights[i];
      if (bar[i] >= h + .5 || bar[i] < h - .5 - hysteresis) heights[i] = Math.min(rows, Math.max(0, Math.round(bar[i])));
      // The peak keeps its distance above the bar as drawn, rounded to whole rows.
      peaks[i] = Math.min(rows, heights[i] + Math.max(0, Math.round(peak[i] - bar[i])));
    }
    return {heights, peaks};
  }
  function reset() { bar.fill(0); peak.fill(0); age.fill(0); speed.fill(0); heights.fill(0); peaks.fill(0); }
  return {step, reset};
}

// ---- export ---------------------------------------------------------------------

// Levels per frame for each channel, from the rendered audio. Frame f shows song
// time f/fps; its FFT is centred on f/fps + lead. `offset` is where song time 0
// sits in the buffer (engine.js RENDER_OFFSET). `edges` is one array for every
// channel, or {name: edges}; every channel needs N bands.
// -> {fps, N, frames, lead, fftSize, window, sampleRate, offset, edges:{name}, data:{name: Float32Array(frames·N)}}
export function eqTrack(channels, sampleRate, {fps = FPS, N = 4, lo = 40, hi = 16000, edges, lead = LEAD, duration, offset = 0, fftSize = 2048, window = 'hann', ...mapping} = {}) {
  const names = Object.keys(channels).sort(), first = channels[names[0]];
  duration ??= (Array.isArray(first) ? first[0] : first).length / sampleRate - offset;
  const frames = Math.max(0, Math.ceil(duration * fps - 1e-9)), shared = edges && !Array.isArray(edges) && !ArrayBuffer.isView(edges) ? null : edges || bandEdges(N, lo, hi);
  const track = {fps, N, frames, lead, fftSize, window, sampleRate, offset, edges:{}, data:{}};
  const power = new Float32Array(fftSize / 2), levels = new Float32Array(N), map = {...mapping, out:levels};
  for (const name of names) {
    const e = shared || edges[name] || bandEdges(N, lo, hi);
    if (e.length !== N + 1) throw Error(`${name}: ${e.length - 1} bands, the track has ${N}`);
    const data = new Float32Array(frames * N);
    for (let f = 0; f < frames; f++) {
      stft(channels[name], sampleRate, {fftSize, window, at:offset + f / fps + lead, out:power});
      data.set(bandLevels(power, sampleRate, fftSize, e, map), f * N);
    }
    track.edges[name] = Array.from(e); track.data[name] = data;
  }
  return track;
}

// A track's levels, followed frame by frame (dt = 1/fps), so an exported frame
// is a lookup: heights and peaks in rows, Float32Array(frames·N) per channel.
export function followTrack(track, options = {}) {
  const out = {heights:{}, peaks:{}};
  for (const [name, data] of Object.entries(track.data)) {
    const f = createFollower(track.N, {edges:track.edges[name], ...options}), H = new Float32Array(data.length), P = new Float32Array(data.length);
    for (let i = 0; i < track.frames; i++) {
      const {heights, peaks} = f.step(data.subarray(i * track.N, (i + 1) * track.N), 1 / track.fps);
      H.set(heights, i * track.N); P.set(peaks, i * track.N);
    }
    out.heights[name] = H; out.peaks[name] = P;
  }
  return out;
}

// 64-bit FNV-style hash, as hex. By default over the track's exact bits (header +
// every Float32): the same audio always gives the same hash, in Node and in the
// browser. Two offline renders of one graph are not bit-identical in Chromium
// (fan-in sums run in no fixed order: ±1 ulp, ~1e-8 in levels), so to compare
// renders hash what the export draws instead: {rows} hashes followTrack()'s whole
// rows for an R-row chart.
export function hashTrack(track, {rows, ...follow} = {}) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  const mix = x => { a = Math.imul(a ^ x, 16777619); b = Math.imul(b ^ x, 0x5bd1e995); b ^= b >>> 15; };
  const names = Object.keys(track.data).sort(), drawn = rows ? followTrack(track, {rows, ...follow}) : null;
  for (const c of `${track.fps}|${track.N}|${track.frames}|${rows || 0}|${names.join(',')}`) mix(c.charCodeAt(0));
  const words = x => new Uint32Array(x.buffer, x.byteOffset, x.length);
  for (const name of names) for (const x of drawn ? [drawn.heights[name], drawn.peaks[name]] : [track.data[name]]) { const w = words(x); for (let i = 0; i < w.length; i++) mix(w[i]); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

// ---- OUTPUT BY DEPARTMENT ------------------------------------------------------------

// The shared screen's grouped bar chart: one group per player, four log bands of
// that player's own stem, blue with a white peak peg. The lady's group exists
// only during the drops. Each range covers where that stem actually speaks, so
// all four bars move; {uniform:true} gives every group the spec's 40 Hz–16 kHz.
const GROUPS = [
  {id:'OPS', label:'OPS', stem:'drums', lo:40, hi:16000, accent:true},           // kick · body · clap · hats
  {id:'PAT', label:'PAT', stem:'bass', lo:35, hi:1120, accent:true},             // sub · fundamental · growl · bite
  {id:'KEYS', label:'KEYS', stem:'keys', lo:160, hi:6400},
  {id:'KEVIN', label:'KEVIN', stem:'guitar', lo:300, hi:9600},
  {id:'SYNERGY', label:'SYNERGY', stem:'voice', lo:110, hi:11000},
  {id:'CIRCLE BACK', label:'CIRCLE BACK', stem:'lady', lo:140, hi:11200, drop:true},
];
export function departments({bands = 4, uniform = false} = {}) {
  return {title:'OUTPUT BY DEPARTMENT', bands, groups:GROUPS.map(g => ({...g, edges:uniform ? bandEdges(bands) : bandEdges(bands, g.lo, g.hi)}))};
}
// {stem: edges} for eqTrack, from a departments() model.
export const departmentEdges = model => Object.fromEntries(model.groups.map(g => [g.stem, g.edges]));

// Score accents: on a kick step the three lowest bands of OPS and PAT slam to
// full and turn white for that step. The audio gives the shape; the score gives
// the snap. levelsByGroup is keyed by group id (OPS) or by its stem (drums).
// -> {levels:{key: Float32Array}, white:{key: Uint8Array}}; reuses `out`.
export function scoreAccent(levelsByGroup, {kick = false, bands = 3} = {}, out = {levels:{}, white:{}}) {
  for (const [key, levels] of Object.entries(levelsByGroup)) {
    const g = GROUPS.find(g => g.id === key || g.stem === key), L = out.levels[key] ||= new Float32Array(levels.length), W = out.white[key] ||= new Uint8Array(levels.length);
    L.set(levels); W.fill(0);
    if (kick && g?.accent) for (let i = 0; i < Math.min(bands, L.length); i++) { L[i] = 1; W[i] = 1; }
  }
  return out;
}

// The steps that carry a kick, read from the plan exactly as engine.js drums()
// and scheduleStep() decide them (kit kicks, the drop kick on an impact bar, the
// finale). Uint8Array(totalSteps + 1), 1 on a kick step.
export function kickSteps(plan) {
  const kicks = new Uint8Array(plan.totalSteps + 1);
  // Song book plans list their kicks (each track's band has its own kit).
  if (Array.isArray(plan.kicks)) { for (const s of plan.kicks) if (s >= 0 && s <= plan.totalSteps) kicks[s] = 1; return kicks; }
  plan.bars.forEach((b, bar) => {
    const L = b.layers, style = L.drums || 'four';
    for (let s = 0; s < 16; s++) {
      let k = false;
      if (style === 'four') k = L.kick && !((L.holdBreath ?? bar === 11) && s >= 12) && PATTERNS.kick.includes(s) && s < (L.kickUntil ?? 16);
      else if (style === 'build') k = L.kick && s % 4 === 0;
      else if (style === 'half') k = s === 0 || (s === 10 && bar !== 20);
      else if (style === 'downbeat') k = s === 0;
      if (L.impact && s === 0) k = true;
      if (k) kicks[bar * 16 + s] = 1;
    }
  });
  if (plan.finale && plan.bars.length * 16 <= plan.totalSteps) kicks[plan.totalSteps] = 1;
  return kicks;
}
const kickCache = new WeakMap();
// Is song time t (seconds) inside a kick step? Looks `lead` ahead, like the FFT.
export function kickAt(plan, t, lead = LEAD) {
  let kicks = kickCache.get(plan);
  if (!kicks) kickCache.set(plan, kicks = kickSteps(plan));
  const T = plan.timing, x = t + lead;
  if (x < T[0]) return false;
  let lo = 0, hi = Math.min(T.length - 1, plan.totalSteps);
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (T[mid] <= x) lo = mid; else hi = mid - 1; }
  return kicks[lo] === 1;
}
