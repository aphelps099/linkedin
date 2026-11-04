// The scene equalizer (src/pegboard/eq.js). Four sections, each standing on its
// own and counting with ok(); the last line is the summary.
//   1. Units, pure Node: band edges, calibration, sines, tilt on pink noise,
//      the follower's rise / fall / hold / gravity / hysteresis, accents.
//   2. Live vs export, headless Chromium: a synthetic band (kick, bass, noise
//      bursts, tone sweeps) in an OfflineAudioContext, AnalyserNodes read with
//      ctx.suspend() at every frame, against eqTrack() on the rendered channels.
//   3. Determinism: two renders and two tracks hash the same, Node and Chromium.
//   4. The real All Hands graph (engine.js buildGraph, band + lady, Synergy when
//      espeak-ng is installed): per-stem live vs export, and kickSteps() against
//      the kicks the engine actually schedules. --skip-song skips it.
// node scripts/check-eq.mjs [--skip-song] [--verbose]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as EQ from '../src/pegboard/eq.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2)), verbose = args.has('--verbose');
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const log = (...a) => console.log(...a);
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const pearson = (a, b) => {
  const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
};
const slope = (x, y) => { const mx = mean(x), my = mean(y); let n = 0, d = 0; for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); d += (x[i] - mx) ** 2; } return n / d; };
const lcg = (seed = 1) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2147483648 - 1;

// ===========================================================================
// 1. Units.
const sr = 44100;
{
  // Band edges: the spec's f_i = 40·400^(i/N), N + 1 of them, a constant ratio.
  for (const N of [1, 4, 12, 48]) {
    const e = EQ.bandEdges(N);
    ok(e.length === N + 1 && e[0] === 40 && e[N] === 16000, `bandEdges(${N}): 40 Hz to 16 kHz, ${N + 1} edges`);
    for (let i = 0; i <= N; i++) ok(Math.abs(e[i] / (40 * 400 ** (i / N)) - 1) < 1e-12, `bandEdges(${N})[${i}] is 40·400^(i/N)`);
    for (let i = 1; i < N; i++) ok(Math.abs(e[i + 1] / e[i] - e[1] / e[0]) < 1e-9, `bandEdges(${N}): log-spaced at ${i}`);
  }
  ok(Math.abs(EQ.bandEdges(4, 35, 1120)[2] - Math.sqrt(35 * 1120)) < 1e-9, 'bandEdges: custom range');

  // Calibration: bin powers sum to the mean square, under either window.
  const sine = (f, a = 1, n = sr) => Float32Array.from({length:n}, (_, i) => a * Math.sin(2 * Math.PI * f * i / sr));
  for (const window of ['hann', 'blackman']) for (const fftSize of [2048, 4096]) {
    const sum = EQ.stft(sine(1000), sr, {fftSize, window, at:.5}).reduce((s, p) => s + p, 0);
    ok(Math.abs(sum - .5) < 1e-3, `stft ${window} ${fftSize}: a full-scale sine sums to .5 (${sum.toFixed(5)})`);
  }
  const r = lcg(7), white = Float32Array.from({length:sr}, () => .5 * r()), ms = white.reduce((s, x) => s + x * x, 0) / white.length;
  for (const window of ['hann', 'blackman']) {
    const sums = Array.from({length:40}, (_, f) => EQ.stft(white, sr, {window, at:.05 + f * .022}).reduce((s, p) => s + p, 0));
    ok(Math.abs(mean(sums) / ms - 1) < .03, `stft ${window}: white noise reads its mean square (${(mean(sums) / ms).toFixed(4)})`);
  }
  const out = new Float32Array(1024);
  ok(EQ.stft(white, sr, {at:.3, out}) === out, 'stft: reuses out');
  ok(EQ.stft([white, white], sr, {at:.3}).every((p, k) => Math.abs(p - out[k]) <= 1e-7 * (1 + out[k])), 'stft: [L, R] down-mixes to .5·(L + R)');

  // A pure sine lands in its band: every band of 12 and of every department chart,
  // at both analyser sizes. It stands clear of its neighbours wherever the Hann
  // main lobe (±2 bins) fits inside the band; in narrower bands (12 bands under
  // ~250 Hz at 2048, PAT's sub band) it still peaks in the right place.
  const charts = [{name:'12 bands', edges:EQ.bandEdges(12)}, ...EQ.departments().groups.map(g => ({name:g.id, edges:g.edges}))];
  for (const fftSize of [2048, 4096]) for (const {name, edges} of charts) for (let i = 0; i < edges.length - 1; i++) {
    const f = Math.sqrt(edges[i] * edges[i + 1]), L = EQ.bandLevels(EQ.stft(sine(f, .5), sr, {at:.5, fftSize}), sr, fftSize, edges);
    const best = L.indexOf(Math.max(...L)), others = Math.max(...L.filter((_, j) => j !== i)), wide = Math.min(f - edges[i], edges[i + 1] - f) / (sr / fftSize) >= 2.5;
    ok(best === i && L[i] > .8 && (!wide || others < .1), `${fftSize} ${name}: a ${f.toFixed(0)} Hz sine lands in band ${i} (${Array.from(L, v => v.toFixed(2)).join(' ')})`);
  }
  // Bands narrower than a bin (48 bands: the lowest is 5 Hz wide, a bin is 21.5 Hz)
  // read the interpolated spectrum: never empty, and smooth from band to band.
  {
    const e = EQ.bandEdges(48), P = new Float32Array(1024);
    for (let f = 0; f < 60; f++) { const p = EQ.stft(white, sr, {at:.05 + f * .015}); for (let k = 0; k < 1024; k++) P[k] += p[k] / 60; }
    const L = EQ.bandLevels(P, sr, 2048, e, {tilt:3, gamma:1, floorDb:-120, topDb:0}), narrow = [...Array(48).keys()].filter(i => e[i + 1] - e[i] < sr / 2048);
    ok(narrow.length >= 8, `48 bands: ${narrow.length} bands are narrower than a bin`);
    ok(narrow.every(i => L[i] > .3), '48 bands: narrow bands still read white noise');
    const steps = narrow.slice(1).map(i => Math.abs(L[i] - L[i - 1]) * 120);
    ok(Math.max(...steps) < 1, `48 bands: narrow bands change smoothly (largest step ${Math.max(...steps).toFixed(2)} dB)`);
  }

  // Tilt: pink noise (exactly 1/f power, shaped in the frequency domain).
  const shaped = (exponent, n = 1 << 18, seed = 3) => {
    const re = new Float64Array(n), im = new Float64Array(n), r = lcg(seed);
    for (let k = 1; k < n / 2; k++) { const a = (k * sr / n) ** (-exponent / 2), ph = Math.PI * r(); re[k] = a * Math.cos(ph); im[k] = a * Math.sin(ph); re[n - k] = re[k]; im[n - k] = -im[k]; }
    EQ.fft(re, im, true);
    const x = Float32Array.from(re), peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    return x.map(v => .25 * v / peak);
  };
  const reading = (x, edges, tilt) => {
    const sum = new Float64Array(edges.length - 1), frames = 160;
    for (let f = 0; f < frames; f++) { const L = EQ.bandLevels(EQ.stft(x, sr, {at:.1 + f * .035}), sr, 2048, edges, {tilt, gamma:1, floorDb:-140, topDb:0}); L.forEach((v, i) => { sum[i] += v * 140 - 140; }); }
    return Array.from(sum, s => s / frames);
  };
  const e12 = EQ.bandEdges(12), oct = Array.from({length:12}, (_, i) => Math.log2(Math.sqrt(e12[i] * e12[i + 1]) / 1000));
  const pink = shaped(1), mix = shaped(1.5);
  const pinkFlat = reading(pink, e12, 3), pinkDefault = reading(pink, e12, 4.5), pinkRaw = reading(pink, e12, 0), mixDefault = reading(mix, e12, 4.5);
  const s3 = slope(oct, pinkFlat), s45 = slope(oct, pinkDefault), s0 = slope(oct, pinkRaw), sMix = slope(oct, mixDefault);
  ok(Math.abs(s3) < .2 && Math.max(...pinkFlat) - Math.min(...pinkFlat) < 2, `tilt 3: pink noise reads flat (${s3.toFixed(2)} dB/oct, spread ${(Math.max(...pinkFlat) - Math.min(...pinkFlat)).toFixed(2)} dB)`);
  ok(Math.abs(s0 + 3) < .25, `tilt 0: pink noise falls 3 dB/oct (${s0.toFixed(2)})`);
  ok(Math.abs(s45 - 1.5) < .25, `tilt 4.5 (default): pink noise rises a gentle 1.5 dB/oct (${s45.toFixed(2)})`);
  ok(Math.abs(sMix) < .25, `tilt 4.5: a mix falling 4.5 dB/oct reads flat (${sMix.toFixed(2)} dB/oct)`);
  {
    // Roughly flat where it shows: the four department bands, in rows of an 8-row chart.
    const e4 = EQ.bandEdges(4), rows = tilt => { const L = reading(pink, e4, tilt).map(db => Math.max(0, (db + 60) / 54) ** .8 * 8); return Math.max(...L) - Math.min(...L); };
    ok(rows(4.5) < 1.6 && rows(0) > 2.5, `pink noise on an 8-row 4-band chart: ${rows(4.5).toFixed(2)} rows of spread tilted, ${rows(0).toFixed(2)} untilted`);
  }
  if (verbose) log('pink dB per band, tilt 4.5:', pinkDefault.map(v => v.toFixed(1)).join(' '));

  // The mapping: floor and top, gamma.
  {
    const P = new Float32Array(1024); P[46] = 1;   // one bin at 990.5 Hz
    const edge = [800, 1250], L = (db, o) => EQ.bandLevels(P.map(p => p * 10 ** (db / 10)), sr, 2048, edge, o)[0];
    const at = db => 10 * Math.log10(1 / 450 * 1000 * Math.LN2) + db + 4.5 * Math.log2(Math.sqrt(800 * 1250) / 1000);   // what the band reads, in dB
    ok(L(-70 - at(0) + 0) === 0 && L(0 - at(0)) === 1, 'mapping: floor reads 0, top reads 1');
    ok(Math.abs(L(-33 - at(0)) - .5 ** .8) < 1e-4, `mapping: halfway (-33 dB) reads .5^.8 (${L(-33 - at(0)).toFixed(4)})`);
    const o = new Float32Array(1);
    ok(EQ.bandLevels(P, sr, 2048, edge, {out:o}) === o, 'bandLevels: reuses out');
  }

  // fromAnalyser: an analyser's dB (|X|/N through its Blackman window) back to stft() power.
  {
    const N = 2048, x = sine(700, .3), re = new Float64Array(N), im = new Float64Array(N), start = Math.round(.4 * sr) - N / 2;
    for (let n = 0; n < N; n++) { re[n] = x[start + n] * EQ.WINDOWS.blackman(n, N); im[n] = 0; }
    EQ.fft(re, im);
    const fake = {fftSize:N, frequencyBinCount:N / 2, calls:0, getFloatFrequencyData(d) { this.calls++; for (let k = 0; k < N / 2; k++) d[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / N); }};
    const scratch = {}, a = EQ.fromAnalyser(fake, scratch), want = EQ.stft(x, sr, {window:'blackman', at:.4});
    ok(a.every((p, k) => Math.abs(p - want[k]) <= 2e-4 * want[k] + 1e-12), 'fromAnalyser: equals stft(blackman) power');
    const db = scratch.db;
    ok(EQ.fromAnalyser(fake, scratch) === a && scratch.db === db, 'fromAnalyser: reuses its buffers');
    const silent = {fftSize:N, frequencyBinCount:N / 2, getFloatFrequencyData(d) { d.fill(-Infinity); }};
    ok(EQ.fromAnalyser(silent).every(p => p === 0), 'fromAnalyser: -Infinity dB is silence');
  }

  // The follower.
  {
    const rows = 8, edges = EQ.bandEdges(4);       // bands 0 (85 Hz) under 250 Hz, 1-3 over
    const f = EQ.createFollower(4, {rows, edges});
    let o = f.step([.75, .5, 1, 0], 1 / 24);
    ok(o.heights.join() === '6,4,8,0' && o.peaks.join() === '6,4,8,0', `follower: bars rise at once (${o.heights.join()})`);
    // Fall: the full bar is gone in fallLow / fallHigh (to the hysteresis point, .15 row).
    const fallTime = (band, fall) => {
      const g = EQ.createFollower(4, {rows, edges}), dt = .0005, full = [0, 0, 0, 0]; full[band] = 1;
      g.step(full, dt);
      for (let t = dt; t < 1; t += dt) if (g.step([0, 0, 0, 0], dt).heights[band] === 0) return t;
      return Infinity;
    };
    const want = fall => (rows - .15) / rows * fall;
    ok(Math.abs(fallTime(0, .12) - want(.12)) < .002, `follower: under 250 Hz a full bar falls in ~120 ms (${(fallTime(0) * 1000).toFixed(1)} ms)`);
    ok(Math.abs(fallTime(2, .18) - want(.18)) < .002, `follower: over 250 Hz in ~180 ms (${(fallTime(2) * 1000).toFixed(1)} ms)`);
    // Hold, then gravity: the peak leaves row 8 (shows 7) when it has fallen half a row.
    const g = EQ.createFollower(4, {rows, edges}), dt = .0005;
    g.step([1, 1, 1, 1], dt);
    let left = -1, fourth = -1;
    for (let t = dt; t < 2 && fourth < 0; t += dt) { const p = g.step([0, 0, 0, 0], dt).peaks[1]; if (left < 0 && p < 8) left = t; if (p <= 4) fourth = t; }
    ok(Math.abs(left - (.25 + Math.sqrt(2 * .5 / 30))) < .002, `follower: peaks hold 250 ms, then fall under 30 rows/s² (leaves the top at ${(left * 1000).toFixed(0)} ms)`);
    ok(Math.abs(fourth - (.25 + Math.sqrt(2 * 3.5 / 30))) < .002, `follower: gravity accelerates (row 4 at ${(fourth * 1000).toFixed(0)} ms)`);
    // The peak's path is integrated exactly: 24 fps and 240 fps agree at shared frames.
    // (Compared once the bar is down, so only the peak's own path counts.)
    const path = fps => { const h = EQ.createFollower(1, {rows, edges:[40, 80]}), out = []; for (let i = 0; i < fps; i++) out.push(h.step([i < 2 * fps / 24 ? 1 : 0], 1 / fps).peaks[0]); return out.filter((_, i) => i % (fps / 24) === fps / 24 - 1).slice(6); };
    ok(path(24).join() === path(240).join() && new Set(path(24)).size > 4, `follower: the peak's fall is frame-rate independent (${path(24).join(' ')})`);
    // Hysteresis (.35 row between the up and down switch points): ±.15 row of wobble
    // across a rounding point never flickers; ±.9 does move the bar.
    const wobble = amp => { const h = EQ.createFollower(1, {rows, edges:[400, 800], fallHigh:.001}), seen = new Set(); for (let i = 0; i < 200; i++) seen.add(h.step([(3.5 + amp * Math.sin(i)) / rows], 1 / 24).heights[0]); return seen; };
    ok(wobble(.15).size === 1, `follower: ±.15 row of wobble across 3.5 rows shows one height (${[...wobble(.15)]})`);
    ok(EQ.createFollower(1, {rows, edges:[400, 800]}).step([3.5 / rows], 1 / 24).heights[0] === 4, 'follower: a bar shows a row as soon as it rounds up');
    ok(wobble(.9).size > 1, 'follower: ±.9 row moves the bar');
    // Slow-mo: twice the fall.
    const slowFall = () => { const h = EQ.createFollower(1, {rows, edges:[400, 800]}); h.step([1], .001); for (let t = .001; t < 1; t += .0005) if (h.step([0], .0005, 2).heights[0] === 0) return t; };
    ok(Math.abs(slowFall() - 2 * want(.18)) < .003, `follower: slow = 2 doubles the fall (${(slowFall() * 1000).toFixed(0)} ms)`);
    // Deterministic, and reset() is a fresh follower.
    const r = lcg(11), series = Array.from({length:500}, () => Array.from({length:4}, () => Math.max(0, r())));
    const run = h => series.map(l => { const o = h.step(l, 1 / 24); return o.heights.join() + '|' + o.peaks.join(); }).join(';');
    const A = EQ.createFollower(4, {rows:12}), B = EQ.createFollower(4, {rows:12}), first = run(A);
    ok(first === run(B), 'follower: deterministic for a given input series');
    A.reset(); ok(run(A) === first, 'follower: reset() starts over');
    const C = EQ.createFollower(4, {rows:12});
    ok(series.every(l => { const {heights, peaks} = C.step(l, 1 / 24); return heights.every((h, i) => Number.isInteger(h) && h >= 0 && h <= 12 && peaks[i] >= h && peaks[i] <= 12); }), 'follower: whole rows, and a peak never sits under its bar');
  }

  // OUTPUT BY DEPARTMENT, and the score's accents.
  {
    const d = EQ.departments(), ids = d.groups.map(g => g.id);
    ok(d.title === 'OUTPUT BY DEPARTMENT' && ids.join() === 'OPS,PAT,KEYS,KEVIN,SYNERGY,CIRCLE BACK', `departments: ${ids.join(', ')}`);
    ok(d.groups.map(g => g.stem).join() === 'drums,bass,keys,guitar,voice,lady', 'departments: each group reads its own stem');
    ok(d.groups.every(g => g.edges.length === 5) && d.groups.filter(g => g.drop).map(g => g.id).join() === 'CIRCLE BACK', 'departments: four bands each; CIRCLE BACK only in the drops');
    ok(EQ.departments({uniform:true}).groups.every(g => g.edges[0] === 40 && g.edges[4] === 16000), 'departments: uniform option is 40 Hz-16 kHz');
    const levels = Object.fromEntries(ids.map(id => [id, Float32Array.from([.1, .2, .3, .4])]));
    const hit = EQ.scoreAccent(levels, {kick:true}), quiet = EQ.scoreAccent(levels, {kick:false});
    ok(['OPS', 'PAT'].every(id => hit.levels[id].join() === [1, 1, 1, Math.fround(.4)].join() && hit.white[id].join() === '1,1,1,0'), 'scoreAccent: a kick slams the three lowest OPS and PAT bands to full, white');
    ok(['KEYS', 'KEVIN', 'SYNERGY', 'CIRCLE BACK'].every(id => hit.levels[id].join() === levels[id].join() && hit.white[id].every(w => !w)), 'scoreAccent: other departments are untouched');
    ok(ids.every(id => quiet.levels[id].join() === levels[id].join() && quiet.white[id].every(w => !w)), 'scoreAccent: no kick, no accent');
    ok(EQ.scoreAccent({drums:levels.OPS}, {kick:true}).white.drums.join() === '1,1,1,0', 'scoreAccent: keyed by stem too');
    ok(levels.OPS[0] === Math.fround(.1), 'scoreAccent: leaves its input alone');
  }
  log(`1. units: ${checks} checks`);
}

// ===========================================================================
// Headless Chromium, serving the repository (and public/ as Vite does).
const require = createRequire(import.meta.url);
const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright to run sections 2-4.'); })();
const TYPES = {'.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.wav':'audio/wav', '.html':'text/html'};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') { res.writeHead(200, {'Content-Type':'text/html'}); res.end('<!doctype html><meta charset="utf-8"><title>eq</title>'); return; }
  for (const base of [ROOT, path.join(ROOT, 'public')]) {
    const file = path.join(base, url);
    if (file.startsWith(base) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, {'Content-Type':TYPES[path.extname(file)] || 'application/octet-stream'}); fs.createReadStream(file).pipe(res); return; }
  }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(origin + '/');

// ===========================================================================
// 2. Live vs export on a synthetic band, and 3. determinism.
const FPS = 24, SECONDS = 8;
{
  const before = checks;
  const result = await page.evaluate(async ({SECONDS, FPS}) => {
    const EQ = await import('/src/pegboard/eq.js'), sr = 44100, frames = SECONDS * FPS, lead = EQ.LEAD;
    const model = EQ.departments(), EDGES = {drums:model.groups[0].edges, bass:model.groups[1].edges, sweep:EQ.bandEdges(4), bursts:EQ.bandEdges(4)}, STEMS = Object.keys(EDGES);
    const MASTER_EDGES = EQ.bandEdges(12);
    // A bar of house at 120 BPM, synthesized, seeded: kick, clap, panned hats, bass, sweeps, noise bursts.
    function band(ctx) {
      const noise = ctx.createBuffer(1, sr * 2, sr), d = noise.getChannelData(0);
      let s = 0x2545f491; for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
      const bus = Object.fromEntries(STEMS.map(n => [n, ctx.createGain()]));
      const env = (node, t, peak, decay, attack = .002) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.setTargetAtTime(0, t + attack, decay / 4); node.connect(g); return g; };
      const filtered = (type, f, q, t, length) => { const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; n.start(t, (t * 7.31) % 1.8); n.stop(t + length); const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; n.connect(b); return b; };
      for (let beat = 0; beat < SECONDS * 2; beat++) {
        const t = .05 + beat * .5, o = ctx.createOscillator();
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(48, t + .08); o.start(t); o.stop(t + .4);
        env(o, t, .9, .3).connect(bus.drums);
        if (beat % 2) env(filtered('bandpass', 1200, .8, t, .3), t, 1.4, .15).connect(bus.drums);
        const p = ctx.createStereoPanner(); p.pan.value = .6;
        env(filtered('highpass', 7000, .7, t + .25, .08), t + .25, .5, .04).connect(p); p.connect(bus.drums);
        // Bass on the offbeat 16ths.
        [.125, .375].forEach((dt, i) => {
          const b = ctx.createOscillator(), lp = ctx.createBiquadFilter(); b.type = 'sawtooth'; b.frequency.value = [55, 65.4, 49, 110][(beat * 2 + i) % 4];
          lp.frequency.value = 420; b.connect(lp); b.start(t + dt); b.stop(t + dt + .2); env(lp, t + dt, .5, .2, .004).connect(bus.bass);
        });
        // Noise bursts: low, mid, high in turn.
        const [type, f] = [['lowpass', 300], ['bandpass', 2000], ['highpass', 6000]][beat % 3];
        env(filtered(type, f, 1, t + .1, .3), t + .1, beat % 4 ? .8 : .3, .12).connect(bus.bursts);
      }
      // Tone sweeps: 60 Hz to 12 kHz and back, every two bars, with a level step.
      for (let k = 0; k < SECONDS / 4; k++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = k * 4;
        o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(12000, t + 2); o.frequency.exponentialRampToValueAtTime(60, t + 4);
        g.gain.setValueAtTime(.4, t); g.gain.setValueAtTime(.08, t + 1); g.gain.setValueAtTime(.4, t + 3);
        o.connect(g); g.connect(bus.sweep); o.start(t); o.stop(t + 4);
      }
      return bus;
    }
    async function render() {
      const ctx = new OfflineAudioContext(2 + STEMS.length, (SECONDS + .25) * sr, sr), bus = band(ctx);
      ctx.destination.channelCount = 2 + STEMS.length; ctx.destination.channelInterpretation = 'discrete';
      const master = ctx.createGain(), merger = ctx.createChannelMerger(2 + STEMS.length), split = ctx.createChannelSplitter(2);
      const an = {}, scratch = {}, live = {}, centres = {};
      STEMS.forEach((n, i) => {
        bus[n].connect(master); bus[n].connect(merger, 0, 2 + i);
        const a = an[n] = ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0; bus[n].connect(a);
        live[n] = new Float32Array(frames * 4); scratch[n] = {};
      });
      // The master goes to the merger through a node pinned to stereo ('speakers' up-mix):
      // a splitter's discrete up-mix would put a mono master on the left channel only.
      const stereo = ctx.createGain(); stereo.channelCount = 2; stereo.channelCountMode = 'explicit'; stereo.channelInterpretation = 'speakers';
      master.connect(stereo); stereo.connect(split); split.connect(merger, 0, 0); split.connect(merger, 1, 1); merger.connect(ctx.destination);
      const ma = ctx.createAnalyser(); ma.fftSize = 4096; ma.smoothingTimeConstant = 0; master.connect(ma);
      live.master = new Float32Array(frames * 12); scratch.master = {};
      centres.stems = new Float64Array(frames); centres.master = new Float64Array(frames);
      // The analyser holds the fftSize samples before ctx.currentTime, and suspend() rounds up to
      // a 128-frame quantum: ask for the moment the window is centred on f/fps + lead.
      for (let f = 0; f < frames; f++) {
        const c = f / FPS + lead;
        ctx.suspend(c + 1024 / sr).then(() => {
          centres.stems[f] = ctx.currentTime - 1024 / sr;
          for (const n of STEMS) live[n].set(EQ.bandLevels(EQ.fromAnalyser(an[n], scratch[n]), sr, 2048, EDGES[n]), f * 4);
          ctx.resume();
        });
        ctx.suspend(c + 2048 / sr).then(() => {
          centres.master[f] = ctx.currentTime - 2048 / sr;
          live.master.set(EQ.bandLevels(EQ.fromAnalyser(ma, scratch.master), sr, 4096, MASTER_EDGES), f * 12);
          ctx.resume();
        });
      }
      const started = performance.now(), audio = await ctx.startRendering();
      return {audio, live, centres, ms:performance.now() - started};
    }
    const one = await render(), two = await render();
    const channels = Object.fromEntries(STEMS.map((n, i) => [n, one.audio.getChannelData(2 + i)]));
    const exported = EQ.eqTrack(channels, sr, {fps:FPS, N:4, edges:EDGES, duration:SECONDS});
    const masterTrack = EQ.eqTrack({master:[one.audio.getChannelData(0), one.audio.getChannelData(1)]}, sr, {fps:FPS, N:12, fftSize:4096, duration:SECONDS});
    // The analyser, modelled exactly: its Blackman window at the quantized centre.
    let exact = 0;
    const P = new Float32Array(1024), P4 = new Float32Array(2048);
    for (let f = 0; f < frames; f++) {
      for (const n of STEMS) {
        const L = EQ.bandLevels(EQ.stft(channels[n], sr, {window:'blackman', at:one.centres.stems[f], out:P}), sr, 2048, EDGES[n]);
        for (let i = 0; i < 4; i++) exact = Math.max(exact, Math.abs(L[i] - one.live[n][f * 4 + i]));
      }
      const L = EQ.bandLevels(EQ.stft([one.audio.getChannelData(0), one.audio.getChannelData(1)], sr, {fftSize:4096, window:'blackman', at:one.centres.master[f], out:P4}), sr, 4096, MASTER_EDGES);
      for (let i = 0; i < 12; i++) exact = Math.max(exact, Math.abs(L[i] - one.live.master[f * 12 + i]));
    }
    const lateMs = [...one.centres.stems].map((c, f) => (c - f / FPS - lead) * 1000);
    // Chromium sums an input's connections in no fixed order, so two renders differ by ±1 ulp.
    let audioDiff = 0, levelDiff = 0;
    for (let c = 0; c < 2 + STEMS.length; c++) { const a = one.audio.getChannelData(c), b = two.audio.getChannelData(c); for (let i = 0; i < a.length; i++) audioDiff = Math.max(audioDiff, Math.abs(a[i] - b[i])); }
    const second = EQ.eqTrack(Object.fromEntries(STEMS.map((n, i) => [n, two.audio.getChannelData(2 + i)])), sr, {fps:FPS, N:4, edges:EDGES, duration:SECONDS});
    for (const n of STEMS) for (let i = 0; i < second.data[n].length; i++) levelDiff = Math.max(levelDiff, Math.abs(second.data[n][i] - exported.data[n][i]));
    const b64 = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    const arr = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v)]));
    return {frames, live:arr(one.live), export:arr(exported.data), masterExport:Array.from(masterTrack.data.master), exact, lateMs:[Math.min(...lateMs), Math.max(...lateMs), lateMs.reduce((s, x) => s + x, 0) / lateMs.length],
      renderMs:one.ms, audioDiff, levelDiff, hashes:[EQ.hashTrack(exported), EQ.hashTrack(EQ.eqTrack(channels, sr, {fps:FPS, N:4, edges:EDGES, duration:SECONDS})), EQ.hashTrack(second)],
      drawn:[8, 16, 60].map(rows => [EQ.hashTrack(exported, {rows}), EQ.hashTrack(second, {rows})]),
      edges:Object.fromEntries(Object.entries(EDGES).map(([k, v]) => [k, Array.from(v)])), audio:STEMS.map((n, i) => [n, b64(one.audio.getChannelData(2 + i))])};
  }, {SECONDS, FPS});

  const report = [];
  const compare = (name, live, exp, N) => {
    for (let i = 0; i < N; i++) {
      const a = live.filter((_, j) => j % N === i), b = exp.filter((_, j) => j % N === i);
      const flat = sd(a) < .02 && sd(b) < .02, r = flat ? 1 : pearson(a, b), offset = mean(a) - mean(b);
      report.push({name, band:i, r, offset, flat});
      ok(flat ? Math.abs(offset) < .03 : r >= .95, `live vs export ${name} band ${i}: r = ${r.toFixed(4)}${flat ? ' (flat)' : ''}, offset ${offset.toFixed(4)}`);
      ok(Math.abs(offset) < .03, `live vs export ${name} band ${i}: no systematic offset (${offset.toFixed(4)})`);
    }
  };
  for (const name of Object.keys(result.export)) compare(name, result.live[name], result.export[name], 4);
  compare('master 4096 · 12 bands', result.live.master, result.masterExport, 12);
  const rs = report.filter(x => !x.flat).map(x => x.r);
  ok(result.exact < 2e-3, `the analyser, modelled exactly (Blackman, quantized centre), matches to ${result.exact.toExponential(2)}`);
  ok(result.lateMs[0] > -1000 / 44100 && result.lateMs[1] < 129 / 44100 * 1000, `suspend() rounds up: live windows sit ${result.lateMs[0].toFixed(2)}-${result.lateMs[1].toFixed(2)} ms after the export's`);
  log(`2. live vs export (synthetic, ${result.frames} frames, ${report.length} bands): r min ${Math.min(...rs).toFixed(4)}, median ${rs.sort((a, b) => a - b)[rs.length >> 1].toFixed(4)}; |offset| max ${Math.max(...report.map(x => Math.abs(x.offset))).toFixed(4)}; exact-model max |Δ| ${result.exact.toExponential(2)}; live late by ${result.lateMs[2].toFixed(2)} ms on average; render ${result.renderMs.toFixed(0)} ms; ${checks - before} checks`);
  if (verbose) for (const x of report) log(`   ${x.name} ${x.band}: r ${x.r.toFixed(4)} offset ${x.offset.toFixed(4)}${x.flat ? ' flat' : ''}`);

  // 3. Determinism.
  const before3 = checks;
  ok(result.audioDiff < 1e-6, `two offline renders agree to ${result.audioDiff.toExponential(1)} (Chromium's fan-in sums: ±1 ulp)`);
  ok(result.levelDiff < 1e-5, `two renders: levels agree to ${result.levelDiff.toExponential(1)}`);
  ok(result.hashes[0] === result.hashes[1], `two eqTrack runs on one render hash the same (${result.hashes[0]})`);
  ok(result.drawn.every(([a, b]) => a === b), `two renders draw the same chart: hashTrack {rows} ${result.drawn.map(([a]) => a).join(' ')}`);
  ok(new Set(result.drawn.map(([a]) => a)).size === 3 && !result.drawn.some(([a]) => a === result.hashes[0]), 'hashTrack {rows}: one hash per chart height');
  const channels = Object.fromEntries(result.audio.map(([n, b]) => { const u = Buffer.from(b, 'base64'); return [n, new Float32Array(u.buffer, u.byteOffset, u.byteLength / 4)]; }));
  const node = EQ.eqTrack(channels, sr, {fps:FPS, N:4, edges:result.edges, duration:SECONDS});
  ok(EQ.hashTrack(node) === EQ.hashTrack(EQ.eqTrack(channels, sr, {fps:FPS, N:4, edges:result.edges, duration:SECONDS})), 'Node: two eqTrack runs hash the same');
  ok(EQ.hashTrack(node) === result.hashes[0], `Node and Chromium compute the same track (${EQ.hashTrack(node)})`);
  // Nudge 2 ms of one stem by 0.01 dB where its chart is mid-height: the hash must notice.
  const frame = node.data.drums.findIndex(v => v > .3 && v < .7) >> 2, centre = Math.round((frame / FPS + EQ.LEAD) * sr);
  const changed = {...channels, drums:channels.drums.map((x, i) => Math.abs(i - centre) < 44 ? x * 1.001 : x)};
  ok(EQ.hashTrack(EQ.eqTrack(changed, sr, {fps:FPS, N:4, edges:result.edges, duration:SECONDS})) !== result.hashes[0], `a 0.01 dB nudge to 2 ms of one stem changes the hash (frame ${frame})`);
  const followed = EQ.followTrack(node, {rows:10}), again = EQ.followTrack(node, {rows:10});
  ok(Object.keys(followed.heights).every(n => followed.heights[n].join() === again.heights[n].join() && followed.peaks[n].join() === again.peaks[n].join()), 'followTrack: deterministic');
  ok(node.frames === FPS * SECONDS && node.data.drums.length === node.frames * 4, `eqTrack: ${node.frames} frames × 4 bands`);
  log(`3. determinism: ${checks - before3} checks`);
}

// ===========================================================================
// 4. The real All Hands graph: band, lady, and Synergy when espeak-ng is here.
if (!args.has('--skip-song')) {
  const before = checks;
  let espeak = false;
  try { execFileSync('espeak-ng', ['--version'], {stdio:'ignore'}); espeak = true; } catch {}
  if (espeak) {
    const {espeakWord} = await import('../server/allhands-voice.js');
    await page.route('**/api/allhands/voice', async route => {
      const {words} = JSON.parse(route.request().postData());
      const audio = await Promise.all(words.map(espeakWord));
      await route.fulfill({contentType:'application/json', body:JSON.stringify({words:Object.fromEntries(words.map((w, i) => [w, audio[i].toString('base64')]))})});
    });
  }
  const song = await page.evaluate(async ({FPS, espeak}) => {
    const EQ = await import('/src/pegboard/eq.js');
    const {FORMS, DEFAULT_FORM} = await import('/src/allhands/forms.js');
    const {lyricsFromPost, SAMPLE_POST} = await import('/src/allhands/lyrics.js');
    const E = await import('/src/allhands/engine.js');
    const {loadWords} = await import('/src/allhands/voice.js');
    const {prepareLady} = await import('/src/allhands/lady.js');
    const form = FORMS[DEFAULT_FORM], lyrics = lyricsFromPost(SAMPLE_POST), sr = 44100;
    const decoder = new OfflineAudioContext(1, 1, sr);
    const {buffers, durations} = espeak ? await loadWords(decoder, form.voiced(lyrics)) : {buffers:new Map(), durations:{}};
    const plan = form.arrange(lyrics, durations), lady = await prepareLady(decoder, plan);
    const model = EQ.departments(), edges = EQ.departmentEdges(model), STEMS = E.STEMS, frames = Math.ceil(plan.duration * FPS);
    // The proposed wiring, built beside buildGraph() without touching engine.js:
    // each stem through a tap that the choke also closes, the lady's tap joined
    // by her post-choke tag and her deep voice; master on 0-1, a tap per stem on
    // 2-7, and (for comparison) the raw keys and lady outs on 8-9.
    const channels = 4 + STEMS.length, ctx = new OfflineAudioContext(channels, Math.ceil((plan.duration + E.RENDER_OFFSET + .25) * sr), sr);
    ctx.destination.channelCount = channels; ctx.destination.channelInterpretation = 'discrete';
    const graph = E.buildGraph(ctx, {}), merger = ctx.createChannelMerger(channels), an = {}, scratch = {}, live = {}, tap = {};
    for (const n of STEMS) { tap[n] = ctx.createGain(); graph.stems[n].out.connect(tap[n]); }
    const ladyBus = ctx.createGain(); tap.lady.connect(ladyBus); graph.tag.connect(ladyBus); graph.deep.connect(ladyBus);
    const source = {...tap, lady:ladyBus};
    // songEvents() automates graph.choke.gain; the proposal applies the same two calls to every tap.
    const choke = graph.choke.gain;
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime']) { const own = choke[m].bind(choke); choke[m] = (v, t) => { for (const n of STEMS) tap[n].gain[m](v, t); return own(v, t); }; }
    STEMS.forEach((n, i) => {
      source[n].connect(merger, 0, 2 + i);
      const a = an[n] = ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0; source[n].connect(a);
      scratch[n] = {}; live[n] = new Float32Array(frames * 4);
    });
    graph.stems.keys.out.connect(merger, 0, 2 + STEMS.length); graph.stems.lady.out.connect(merger, 0, 3 + STEMS.length);
    merger.connect(ctx.destination);
    // Every kick the engine plays ducks the bass: record those moments.
    const ducks = [], param = graph.stems.bass.ducker.gain, set = param.setValueAtTime.bind(param);
    param.setValueAtTime = (v, t) => { if (v === 1) ducks.push(t); return set(v, t); };
    const t0 = E.RENDER_OFFSET - plan.timing[0], song = E.prepare(plan, buffers, lady);
    graph.oscillators.forEach(o => o.start(0));
    for (let step = 0; step <= plan.totalSteps; step++) E.scheduleStep(graph, song, step, t0);
    for (let f = 0; f < frames; f++) ctx.suspend(t0 + f / FPS + EQ.LEAD + 1024 / sr).then(() => {
      for (const n of STEMS) live[n].set(EQ.bandLevels(EQ.fromAnalyser(an[n], scratch[n]), sr, 2048, edges[n]), f * 4);
      ctx.resume();
    });
    const started = performance.now(), audio = await ctx.startRendering(), ms = performance.now() - started;
    const stems = Object.fromEntries(STEMS.map((n, i) => [n, audio.getChannelData(2 + i)]));
    const track = EQ.eqTrack(stems, sr, {fps:FPS, N:4, edges, offset:t0, duration:plan.duration});
    // Loudness in a window, per channel: the stems against the master during the choke's silence.
    const rms = (x, a, b) => { let s = 0; const i0 = Math.round((t0 + a) * sr), i1 = Math.round((t0 + b) * sr); for (let i = i0; i < i1; i++) s += x[i] * x[i]; return 20 * Math.log10(Math.sqrt(s / (i1 - i0)) + 1e-12); };
    // The README's silence (39.65-39.99 s); her post-choke "Let's circle-"; her deep "BACK." a beat after the impact.
    const silence = [plan.timing[plan.choke.at] + .65, plan.timing[plan.choke.until] - .01], back = plan.lady.find(e => e.role === 'impact'), tag = plan.lady.find(e => e.role === 'tag');
    const tagged = [plan.timing[tag.at] + .02, plan.timing[tag.at] + tag.gate - .05], deepBack = [plan.timing[back.at + back.deepAt] + .05, plan.timing[back.at + back.deepAt] + .45];
    const raw = {keys:audio.getChannelData(2 + STEMS.length), lady:audio.getChannelData(3 + STEMS.length)};
    const leak = Object.fromEntries([['master', audio.getChannelData(0)], ...STEMS.map(n => [n, stems[n]]), ['raw keys', raw.keys]].map(([n, x]) => [n, rms(x, ...silence)]));
    const deep = {tapped:rms(stems.lady, ...deepBack), raw:rms(raw.lady, ...deepBack), tag:rms(stems.lady, ...tagged), tagRaw:rms(raw.lady, ...tagged)};
    const kicks = EQ.kickSteps(plan), kickTimes = [...kicks.keys()].filter(s => kicks[s]).map(s => t0 + plan.timing[s]);
    const arr = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v)]));
    return {frames, ms, live:arr(live), export:arr(track.data), voiced:buffers.size, lady:lady.files.size, leak, silence, deep, deepBack,
      kickTimes, ducks:[...new Set(ducks.map(t => +t.toFixed(6)))].sort((a, b) => a - b), kickAtOk:kickTimes.every(t => EQ.kickAt(plan, t - t0)) && !EQ.kickAt(plan, plan.timing[2])};
  }, {FPS, espeak});

  const rows = [];
  for (const [stem, live] of Object.entries(song.live)) for (let i = 0; i < 4; i++) {
    const a = live.filter((_, j) => j % 4 === i), b = song.export[stem].filter((_, j) => j % 4 === i);
    const flat = sd(a) < .02 && sd(b) < .02, r = flat ? 1 : pearson(a, b), offset = mean(a) - mean(b);
    rows.push({stem, band:i, r, offset, flat, active:mean(b)});
    ok(flat ? Math.abs(offset) < .03 : r >= .95, `All Hands ${stem} band ${i}: r = ${r.toFixed(4)}${flat ? ' (flat)' : ''}`);
    ok(Math.abs(offset) < .03, `All Hands ${stem} band ${i}: offset ${offset.toFixed(4)}`);
  }
  const near = (a, b) => Math.abs(a - b) < 1e-4, STEMS_OK = leak => Object.entries(leak).every(([n, v]) => n === 'raw keys' || v < -100);
  ok(song.kickTimes.length > 50 && song.kickTimes.length === song.ducks.length && song.kickTimes.every((t, i) => near(t, song.ducks[i])), `kickSteps: the plan's ${song.kickTimes.length} kicks are the engine's ${song.ducks.length}`);
  ok(song.kickAtOk, 'kickAt: true on every kick step, false off them');
  ok(STEMS_OK(song.leak), `proposed taps: every stem is silent in the choke's silence (${Object.entries(song.leak).map(([n, v]) => `${n} ${v.toFixed(0)}`).join(', ')} dBFS)`);
  ok(song.leak['raw keys'] > -60, `without the choke tap the KEYS chart would move in the silence (raw keys out ${song.leak['raw keys'].toFixed(1)} dBFS)`);
  ok(song.deep.tag > -40 && song.deep.tagRaw < -100, `the lady's bus carries her post-choke "Let's circle-" (${song.deep.tag.toFixed(1)} dBFS; her stem alone ${song.deep.tagRaw.toFixed(1)})`);
  // Not asserted: engine.js playLady() disconnects the deep layer when the dry word
  // ends, so whenever the main thread handles 'ended' before the deep layer starts
  // (always live; here, as the render runs slower than real time) it never sounds.
  if (song.deep.tapped < -100) log(`   engine.js: her deep "BACK." (${song.deepBack.map(t => t.toFixed(2)).join('-')} s) is silent: playLady() disconnects the deep layer when the dry word ends`);
  const rs = rows.filter(x => !x.flat).map(x => x.r).sort((a, b) => a - b);
  log(`4. All Hands (${song.frames} frames, ${song.voiced} Synergy takes, ${song.lady} lady files, render ${(song.ms / 1000).toFixed(1)} s): r min ${rs[0].toFixed(4)}, median ${rs[rs.length >> 1].toFixed(4)} over ${rs.length} moving bands; ${checks - before} checks`);
  log(`   choke silence ${song.silence.map(t => t.toFixed(2)).join('-')} s, dBFS: ${Object.entries(song.leak).map(([n, v]) => `${n} ${v.toFixed(1)}`).join(', ')}`);
  if (verbose) for (const x of rows) log(`   ${x.stem} ${x.band}: r ${x.r.toFixed(4)} offset ${x.offset.toFixed(4)} mean ${x.active.toFixed(3)}${x.flat ? ' flat' : ''}`);
}

await browser.close();
server.close();
log(`check-eq: ${checks} checks passed`);
