// The river: the wander form's sound (forms.js 'wander', wander.js arranges it).
// Aaron, Nov 5: "repetitious rhythmatic ... samples in a repeating pattern so you
// get like a pixelated diffusion of sound that builds in a beautiful melodic
// stream with overlays and sound textures ... a natural river of electronic
// sound: it has a nice flow, however sometimes the flow gently changes."
//
// Sample loops are the instrument. A loop is a two-bar pattern of short cuts of
// the voices (her syllables, Strategy's words, the couplet's "It's not X."),
// each hit pitched onto the pentatonic, rendered once in JS (renderTexture) into
// a stereo buffer, pixelated (pixel.js: sample-and-hold, the shared-exponent
// crush) and looped on the grid: a texture. A texture repeats; the next one
// adds copies, offsets, pitch steps and a granular smear; each is a layer that
// fades and filters in over bars, and leaves the same way, into a diffusion
// reverb and a filtered delay. Around them the steady loop of hands and the
// office runs every bar, the tambourine shakes in the background, and three
// acoustic-sounding colours, synthesized here and nowhere sampled, carry the
// melodic stream: a Karplus-Strong pluck, a kalimba-like mallet and a felt
// piano. Pure where it can be (the sample synthesis and the textures are plain
// JS on Float32Arrays, the same in Node and every browser) and exact where it
// plays (exact.js: the buses are made with the graph, every voice joins one).
import {mtof} from './instruments.js';
import {decimate, crush, pixelParams} from './voices/pixel.js';
import {bakePhrase} from './vocab-stages.js';
import {analysisOf, chantSinger, heldVowel, choirTone, CHANT_FILE, AH} from './lady-choir.js';

const lcg = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const mix32 = h => { h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };

// ---- the acoustic colours -------------------------------------------------------
// One note as samples (mono, at sampleRate): kind 'pluck' | 'mallet' | 'felt',
// a MIDI note, velocity v (0..1), variant k (a different pick, strike or hammer).
//   pluck   Karplus-Strong: a seeded noise burst, darker as v falls, around a
//           delay line tuned by a first-order all-pass (a few cents at most off),
//           averaged and damped each pass; a body resonance near 220 Hz.
//   mallet  a kalimba-like tine and a marimba-like bar in one: three modes at
//           1, 3.93 and 9.2 times the pitch (the bar's tuned ratios), the upper
//           two dying fast, a 2 ms felt click.
//   felt    a felt piano: two strings 1.6 cents apart, ten partials stretched by
//           a little inharmonicity, their tops rolled off by the felt (a soft
//           hammer), each decaying faster the higher it is; a dull thump.
export function colourSamples(sampleRate, kind, midi, v = .6, k = 0) {
  const sr = sampleRate, f = mtof(midi), R = lcg(mix32(midi * 131 + Math.round(v * 100) * 7 + k * 977 + (kind === 'pluck' ? 1 : kind === 'mallet' ? 2 : 3) * 7919));
  if (kind === 'pluck') {
    const n = Math.round(1.8 * sr), y = new Float32Array(n), d = sr / f, N = Math.floor(d - .5), frac = d - .5 - N, a = (1 - frac) / (1 + frac);
    const line = new Float32Array(N + 1);
    // the pick: noise through a one-pole low-pass (brighter as v rises), a little of its first half
    let lp = 0;
    const bright = .25 + .6 * v;
    for (let i = 0; i <= N; i++) { lp += bright * ((R() * 2 - 1) - lp); line[i] = lp * (i < N / 2 ? 1 : .6); }
    let idx = 0, prev = 0, ap = 0, apIn = 0;
    const damp = .4985 + .0012 * Math.min(1, 220 / f);
    for (let i = 0; i < n; i++) {
      const cur = line[idx], next = line[(idx + 1) % (N + 1)];
      const avg = damp * (cur + next);
      // fractional tuning: first-order all-pass on the loop
      const out = a * avg + apIn - a * ap; apIn = avg; ap = out;
      line[idx] = out; idx = (idx + 1) % (N + 1);
      y[i] = cur; prev = cur;
    }
    void prev;
    // the body: a soft resonance, then a short fade-in (no click) and out
    let b1 = 0, b2 = 0;
    const w = 2 * Math.PI * 220 / sr, r = .995, c = 2 * r * Math.cos(w);
    for (let i = 0; i < n; i++) { const x = y[i], o = x + .18 * (c * b1 - r * r * b2); b2 = b1; b1 = o; y[i] = o * .55; }
    for (let i = 0; i < 64; i++) y[i] *= i / 64;
    for (let i = 0; i < 2000; i++) y[n - 1 - i] *= i / 2000;
    return y;
  }
  if (kind === 'mallet') {
    const n = Math.round(1.6 * sr), y = new Float32Array(n);
    const modes = [[1, 1, .9], [3.93, .28 * v, .16], [9.2, .12 * v, .05]];
    for (const [ratio, amp, tau] of modes) {
      const fr = f * ratio * (1 + .002 * (R() - .5));
      if (fr > sr * .45) continue;
      const ph = R() * .3, w = 2 * Math.PI * fr / sr, dec = Math.exp(-1 / (tau * sr));
      let e = amp;
      for (let i = 0; i < n; i++) { y[i] += e * Math.sin(w * i + ph); e *= dec; }
    }
    // the felt click: 2 ms of low-passed noise
    let lp = 0;
    for (let i = 0; i < Math.round(.002 * sr); i++) { lp += .3 * ((R() * 2 - 1) - lp); y[i] += lp * .25 * v; }
    for (let i = 0; i < 32; i++) y[i] *= i / 32;
    for (let i = 0; i < 2000; i++) y[n - 1 - i] *= i / 2000;
    for (let i = 0; i < n; i++) y[i] *= .32;
    return y;
  }
  // felt
  const n = Math.round(2.6 * sr), y = new Float32Array(n), B = .00035, roll = 3 + 5 * v;
  for (const det of [-.8, .8]) {
    for (let p = 1; p <= 10; p++) {
      const fr = f * p * Math.sqrt(1 + B * p * p) * 2 ** (det / 1200);
      if (fr > sr * .45) break;
      const amp = (1 / p ** 1.5) / (1 + (p / roll) ** 2), tau = 2.4 / (1 + .45 * (p - 1)), w = 2 * Math.PI * fr / sr, dec = Math.exp(-1 / (tau * sr)), ph = R() * 6.28;
      let e = amp * .5;
      for (let i = 0; i < n; i++) { y[i] += e * Math.sin(w * i + ph); e *= dec; }
    }
  }
  // the hammer: a slow 8 ms attack (felt) and a dull thump
  const A = Math.round(.008 * sr);
  for (let i = 0; i < A; i++) y[i] *= i / A;
  let lp = 0;
  for (let i = 0; i < Math.round(.03 * sr); i++) { lp += .05 * ((R() * 2 - 1) - lp); y[i] += lp * .4 * v * (1 - i / (.03 * sr)); }
  for (let i = 0; i < 3000; i++) y[n - 1 - i] *= i / 3000;
  for (let i = 0; i < n; i++) y[i] *= .3;
  return y;
}

// How far each kind of layer steps back under a clear phrase (gain): the voices' textures most, the colours a little.
// Delve's kinds (songbook/delve.js): her choir steps furthest back (-14 dB: it shares her band), the
// pad half way, the hands and the slit drum a little, the stars and the arpeggio as the colours do.
export const RIVER_DUCK = Object.freeze({texture:.25, colour:.5, guitar:.6, drone:.7, tambourine:.7, loop:.85, choir:.2, pad:.5, hands:.8, logdrum:.75, chime:.7, arp:.5});

const stores = new WeakMap();
const storeOf = ctx => { let s = stores.get(ctx); if (!s) stores.set(ctx, s = new Map()); return s; };
// A note of a colour, rendered once per context (three variants, velocity in three layers).
function colourBuffer(ctx, kind, midi, v, k) {
  const layer = v < .45 ? .35 : v < .75 ? .6 : .9, key = `${kind}:${midi}:${layer}:${k}`, s = storeOf(ctx);
  if (!s.has(key)) {
    const y = colourSamples(ctx.sampleRate, kind, midi, layer, k), b = ctx.createBuffer(1, y.length, ctx.sampleRate);
    b.getChannelData(0).set(y); s.set(key, {buffer:b, gain:v / layer});
  }
  return s.get(key);
}
// Play one note into `out` (a layer's bus): which variant is chosen by the time, so no two notes ring alike.
export function colour(ctx, out, t, kind, midi, v = .6, {pan = 0} = {}) {
  const k = mix32(Math.round(t * 1000) * 2654435761 + midi) % 3, {buffer, gain} = colourBuffer(ctx, kind, midi, v, k);
  const src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
  src.buffer = buffer; g.gain.value = gain; p.pan.value = pan;
  src.connect(g); g.connect(p); p.connect(out);
  src.start(t); src.stop(t + buffer.duration + .005);
  src.onended = () => { src.disconnect(); g.disconnect(); p.disconnect(); };
}

// ---- textures -------------------------------------------------------------------
// A loop of cuts of one voice, as a two-channel buffer `length` samples long that
// repeats seamlessly (a hit past the end wraps to the start). Each hit plays one
// cut (seconds of `src`), from `pos` of the way into it, for `len` seconds, at the
// rate that takes the cut's own pitch (`base`, MIDI) to `midi`, under a 3 ms
// attack and a 25 ms release, at `gain`, panned. `smear` adds that many grains
// round each hit (30 to 90 ms, from anywhere in its cut, a pentatonic step or two
// off, spread wide, quieter): the granular diffusion. Then the pixels: the
// sample-and-hold and the crush of pixel.js at `amount`.
export function renderTexture({src, sr = 44100, cuts, hits, length, amount = .6, smear = 0, smearSteps = [0], seed = 1}) {
  const L = new Float32Array(length), R = new Float32Array(length), rnd = lcg(seed * 2654435761 + 7);
  const place = (cut, from, dur, ratio, at, gain, pan) => {
    const a = Math.round(at * sr), n = Math.round(dur * sr), atk = Math.round(.003 * sr), rel = Math.round(Math.min(.025, dur / 3) * sr);
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const start = cut.from * sr + from * sr, end = cut.to * sr;
    for (let i = 0; i < n; i++) {
      const p = start + i * ratio, i0 = Math.floor(p);
      if (i0 + 1 >= end || i0 + 1 >= src.length) break;
      const env = Math.min(1, i / atk, (n - i) / rel), v = (src[i0] + (src[i0 + 1] - src[i0]) * (p - i0)) * env, j = (a + i) % length;
      L[j] += gl * v; R[j] += gr * v;
    }
  };
  for (const h of hits) {
    const cut = cuts[h.cut ?? 0], span = cut.to - cut.from, ratio = 2 ** ((h.midi - cut.base) / 12);
    place(cut, (h.pos ?? 0) * span, Math.min(h.len, (span - (h.pos ?? 0) * span) / ratio), ratio, h.at, h.gain ?? 1, h.pan ?? 0);
    for (let g = 0; g < smear; g++) {
      const c = cuts[Math.floor(rnd() * cuts.length)], sp = c.to - c.from, dur = .03 + .06 * rnd(), off = (rnd() - .3) * .12, step = smearSteps[Math.floor(rnd() * smearSteps.length)];
      const r2 = 2 ** ((h.midi + step - c.base) / 12), pos = rnd() * Math.max(0, sp - dur * r2);
      place(c, pos, dur, r2, (h.at + off + length / sr) % (length / sr), (h.gain ?? 1) * (.22 + .2 * rnd()), (rnd() * 2 - 1) * .9);
    }
  }
  if (amount > 0) {
    const P = pixelParams(amount);
    return [L, R].map(x => crush(decimate(x, sr, P.rate, {antialias:P.antialias}), P.bits, {block:P.block, sr}));
  }
  return [L, R];
}

// ---- the band's structure: layer buses, the diffusion and the filtered delay -------

// One bus per layer (wander.js plan.layers): level, a low-pass that opens as it
// ramps in and closes as it leaves, a pan that drifts; sends to the diffusion (a
// long, smooth space) and the filtered delay (dotted 8ths, darker each pass,
// one way out of its loop). Built with the graph, so exact.js sums every voice.
export function buildRiver({ctx, I, graph:g, step, sends, master, plan, tune = {}}) {
  const wash = ctx.createConvolver(), washIn = I.biquad(ctx, 'highpass', 180, .6), washOut = I.amp(ctx, .8);
  wash.buffer = I.washImpulse(ctx, 6.5, .35, 11);
  washIn.connect(wash); wash.connect(washOut); washOut.connect(master);
  const delay = ctx.createDelay(2), delayIn = I.biquad(ctx, 'highpass', 260, .6), dark = I.biquad(ctx, 'lowpass', 2200, .5), fb = I.amp(ctx, .38), delayOut = I.amp(ctx, .55);
  delay.delayTime.value = step * 6;
  delayIn.connect(delay); delay.connect(dark); dark.connect(fb); fb.connect(delay); dark.connect(delayOut); delayOut.connect(master);
  const stemOf = name => g.stems[name].input;
  const layers = {};
  for (const L of plan.layers || []) {
    const input = I.amp(ctx, 1), level = I.amp(ctx, 0), duck = I.amp(ctx, 1), hp = I.biquad(ctx, 'highpass', L.hp ?? 120, .6), lp = I.biquad(ctx, 'lowpass', 20000, .5), pan = ctx.createStereoPanner(), toWash = I.amp(ctx, 0), toDelay = I.amp(ctx, 0);
    pan.pan.value = L.pan?.[0]?.[1] ?? 0;
    // Everything under its floor (hp) belongs to Pat, as the keys and pad stay out of his way in every song.
    // `duck`: the stream steps aside while a clear phrase rises out of it (scheduleRiver).
    input.connect(level); level.connect(duck); duck.connect(hp); hp.connect(lp); lp.connect(pan); pan.connect(stemOf(L.stem)); pan.connect(toWash); toWash.connect(washIn); pan.connect(toDelay); toDelay.connect(delayIn);
    layers[L.id] = {spec:L, input, level, duck, lp, pan, toWash, toDelay};
  }
  // The slow tape (plan.slow): the room's texture played back at half speed, an octave down, under the river.
  const slowIn = I.amp(ctx, 1), slowLine = ctx.createDelay(4), slowLp = I.biquad(ctx, 'lowpass', 2600, .6), slowOut = I.amp(ctx, 0);
  slowLine.delayTime.value = 0;
  slowIn.connect(slowLine); slowLine.connect(slowLp); slowLp.connect(slowOut); slowOut.connect(washIn); slowOut.connect(master);
  const slowSend = I.amp(ctx, 0); slowSend.connect(slowIn);
  for (const L of Object.values(layers)) if (L.spec.slow) L.pan.connect(slowSend);
  // His hook sits in the stream, not on it (the chart's voiceLevel on his stem).
  if (plan.voiceLevel) g.stems.voice.out.gain.value *= plan.voiceLevel;
  // His hook and the band's clear phrases sink back into the stream: a send of each to the diffusion.
  const voiceWash = I.amp(ctx, .32), ladyWash = I.amp(ctx, .22);
  g.riverWash = {voice:voiceWash, lady:ladyWash};
  g.stems.voice.out.connect(voiceWash); voiceWash.connect(washIn); g.stems.lady.out.connect(ladyWash); ladyWash.connect(washIn);
  // tune.solo (checks and measurements): only these layers sound.
  return {layers, washIn, delayIn, slowLine, slowOut, slowSend, voiceWash, ladyWash, scheduled:false, textures:new Map(), solo:tune.solo ?? null, buses:[washIn, delayIn, slowIn, ...Object.values(layers).map(l => l.input)]};
}

// The layers' automation for the whole song, once (at the first bar the engine schedules):
// each layer's curves from the plan (wander.js: gain and pans linear, the filter exponential,
// the sends to the diffusion and the delay), so every layer fades and filters in over its
// ramp, breathes, and leaves the same way. `at` maps plan seconds to context time.
const curveOn = (param, points, exp = false) => {
  if (!points?.length) return;
  // An excerpt starts mid-song: the curve's value at context time 0, then the points after it.
  const later = points.filter(p => p[0] > 0), before = points.filter(p => p[0] <= 0).at(-1), next = later[0];
  const v0 = !before ? points[0][1] : !next ? before[1] : before[1] + (next[1] - before[1]) * (0 - before[0]) / (next[0] - before[0]);
  param.setValueAtTime(exp ? Math.max(1e-4, v0) : v0, 0);
  for (const [t, v] of later) exp ? param.exponentialRampToValueAtTime(Math.max(1e-4, v), t) : param.linearRampToValueAtTime(v, t);
};
export function scheduleRiver(own, plan, at) {
  const map = pts => (pts || []).map(([t, v]) => [at(t), v]);
  for (const L of Object.values(own.layers)) {
    const s = L.spec;
    if (own.solo && !own.solo.includes(s.id)) continue;
    curveOn(L.level.gain, map(s.gain));
    curveOn(L.lp.frequency, map(s.filter), true);
    curveOn(L.pan.pan, map(s.pan));
    curveOn(L.toWash.gain, map(s.wash));
    curveOn(L.toDelay.gain, map(s.delay));
  }
  // A clear phrase rises out of the stream: the textures of voices step back (RIVER_DUCK) from just
  // before its first word to just after its last, the colours a little, and come back over half a second.
  const phrases = [...(plan.band || []).filter(e => e.clear).map(e => [e.start, e.end]),
    ...(plan.lines || []).map(l => [plan.timing[l.words[0].at], Math.max(...l.words.map(w => plan.timing[w.at] + w.gate))])];
  // The phrase itself sings nearly dry, and its tail sinks into the diffusion as it ends.
  for (const [send, base] of [[own.voiceWash, .32], [own.ladyWash, .22]]) for (const [a, b] of phrases) {
    if (!send || at(b) + .08 < 0) continue;
    send.gain.setTargetAtTime(.04, Math.max(0, at(a) - .1), .05); send.gain.setTargetAtTime(base * 2, at(b) - .25, .15); send.gain.setTargetAtTime(base, at(b) + 1.5, .5);
  }
  for (const L of Object.values(own.layers)) {
    const depth = RIVER_DUCK[L.spec.kind];
    if (!depth || (own.solo && !own.solo.includes(L.spec.id))) continue;
    for (const [a, b] of phrases) { if (at(b) + .08 < 0) continue; L.duck.gain.setTargetAtTime(depth, Math.max(0, at(a) - .3), .07); L.duck.gain.setTargetAtTime(1, at(b) + .08, .18); }
  }
  // The slow spans: the delay line grows at half the clock inside the window (half speed,
  // an octave down), faded in and out, then snaps back while silent.
  for (const w of plan.slow || []) {
    // (An excerpt that starts after a window's start leaves it out.)
    if (w.whole || at(w.from) - .01 < 0) continue;
    const d = own.slowLine.delayTime, g = own.slowOut.gain, snd = own.slowSend.gain, a = at(w.from), b = at(w.to), fade = Math.min(w.fade ?? 1.2, (b - a) / 3);
    d.setValueAtTime(0, a); d.linearRampToValueAtTime(Math.min(3.9, (b - a) / 2), b); d.setValueAtTime(0, b + .02);
    snd.setValueAtTime(0, a - .01); snd.setValueAtTime(1, a); snd.setValueAtTime(0, b + .01);
    g.setValueAtTime(0, a); g.linearRampToValueAtTime(w.level ?? .6, a + fade); g.setValueAtTime(w.level ?? .6, b - fade); g.linearRampToValueAtTime(0, b);
  }
  own.scheduled = true;
}

// ---- the band that plays the river -------------------------------------------------
// riverBand(chart) gives a track's wander chart its band hooks (engine.js: graph, bar,
// step, pad). The chart names its patterns (loop, tambourine, colours, textures) and
// the river decides nothing else: every layer's level comes from plan.layers.
const pcOf = m => ((Math.round(m) % 12) + 12) % 12;
function pstep(m, k, penta) {
  let x = Math.round(m), n = 0;
  while (!penta.includes(pcOf(x))) x--;
  while (n < Math.abs(k)) { x += Math.sign(k); if (penta.includes(pcOf(x))) n++; }
  return x;
}
// A layer's level at plan time t, from its gain curve (for voices whose velocity follows it).
export function levelAt(layer, t) {
  const g = layer.gain;
  if (!g?.length || t <= g[0][0]) return g?.[0]?.[1] ?? 0;
  for (let i = 1; i < g.length; i++) if (t <= g[i][0]) { const [a, x] = g[i - 1], [b, y] = g[i]; return b > a ? x + (y - x) * (t - a) / (b - a) : y; }
  return g.at(-1)[1];
}

// The texture of one layer: its loop source's cuts on the chart's pattern, two bars long.
export function textureHits(chart, layer, loop, plan, penta = chart.pentatonic) {
  const P = chart.textures[layer.id], step = plan.step, swing = plan.swing, hits = [];
  if (!P) return hits;
  const time = s => s * step + (s % 2 ? swing * step : 0);
  for (const h of P.hits) {
    const cut = Math.min(loop.cuts.length - 1, h.cut ?? 0), base = loop.cuts[cut].base;
    const midi = pstep(P.center ?? base, h.deg ?? 0, penta);
    hits.push({at:time(h.at), len:(h.len ?? 2) * step, cut, pos:h.pos ?? 0, midi, gain:h.gain ?? 1, pan:h.pan ?? 0});
  }
  return hits;
}

export function riverBand(chart) {
  const W = chart;
  return {
    graph:args => buildRiver({...args, plan:args.plan}),
    pad(api, t, chord, length, b) {
      // The drone: a pump organ and the wordless choir, one chord at a time, into the drone layer.
      const own = api.graph.own, L = own?.layers?.drone;
      if (!L || b.index % 2) return;
      const end = api.plan.timing[Math.min(api.plan.totalSteps, (b.index + 2) * 16)] - api.plan.timing[b.index * 16];
      api.I.harmonium(api.ctx, L.input, t, chord.keys, end, .8);
      api.I.voicePad(api.ctx, L.input, t, chord.notes, end, .7, {vowel:b.section === 'Swell' || b.section === 'Delta' ? 'ah' : 'oo', attack:.9, release:1.2, wow:3});
    },
    bar(api, b, bar, t, barEnd, T, step) {
      const {ctx, I, plan, graph} = api, own = graph.own;
      if (!own) return;
      const T0 = t - plan.timing[bar * 16], at = sec => T0 + sec;
      if (!own.scheduled) {
        scheduleRiver(own, plan, at);
        // The textures: each layer's loop rendered once, looping on the two-bar grid from its ramp-in to its ramp-out.
        for (const layer of plan.layers.filter(l => l.kind === 'texture')) {
          const bus = own.layers[layer.id], loop = plan.loops.find(l => l.id === layer.source), i = plan.loops.indexOf(loop);
          if (!bus || !loop) continue;
          // A chart whose pentatonic moves by bar (Delve's Pool): the texture in each key, spliced on the loop's grid.
          if (W.pentatonicAt) { textureSpans(api, W, layer, loop, at, bus, own); continue; }
          const audio = loop.key ? api.song.lady?.sung?.get(`l${i}`) : api.song.lady?.files?.get(loop.file);
          if (!audio) continue;
          const key = `${layer.id}|${loop.file}`;
          if (!own.textures.has(key)) {
            const sr = audio.sampleRate, length = Math.round(32 * plan.step * sr), P = W.textures[layer.id] || {};
            const [L, R] = renderTexture({src:audio.getChannelData(0), sr, cuts:loop.cuts, hits:textureHits(W, layer, loop, plan), length, amount:P.amount ?? .55, smear:P.smear ?? 0, smearSteps:P.smearSteps ?? [0], seed:P.seed ?? 1});
            const buf = ctx.createBuffer(2, length, sr); buf.getChannelData(0).set(L); buf.getChannelData(1).set(R);
            own.textures.set(key, buf);
          }
          const buf = own.textures.get(key), first = Math.floor(layer.inBars[0] / 2) * 2, last = Math.min(plan.bars.length, Math.ceil(layer.outBars[1]));
          if (bar > last) continue;
          // Start on the loop's own grid (a whole number of loops from bar 0), from where the render begins.
          const from = Math.max(first, bar - (bar - first) % 2), src = ctx.createBufferSource();
          src.buffer = buf; src.loop = true; src.connect(bus.input);
          // (An excerpt that starts mid-loop starts the loop at time 0, that far into it.)
          const startT = at(plan.timing[from * 16]), into = startT < 0 ? (-startT) % buf.duration : 0;
          src.start(Math.max(0, startT), into); src.stop(at(plan.timing[Math.min(plan.totalSteps, last * 16)]) + .01);
          src.onended = () => src.disconnect();
        }
        // Her vocabulary (a setlist chart): every phrase and its echoes, baked; her choir; the stars.
        if (plan.vocab) { scheduleVocabulary(api, own, plan, at); scheduleChoir(api, W, own, plan, at); scheduleStars(api, own, plan, at); }
      }
    },
    step(api, b, bar, s, t, T, step) {
      const {ctx, I, plan, graph} = api, own = graph.own, pl = plan.timing[bar * 16 + s];
      if (!own) return;
      const lay = id => plan.layers.find(l => l.id === id), lv = id => { const l = lay(id); return l ? levelAt(l, pl) / (l.level || 1) : 0; }, bus = id => own.layers[id]?.input;
      // The loop: soft even stomps, a room clapping on two and four, toms after the beats, the printer, typing.
      const Lp = W.loop, live = lv('loop');
      // Each part of the loop joins at its bar (Lp.from), ramping in over two bars, as every layer does.
      const mix = Lp.mix ? Lp.mix(bar + s / 16) : null;
      const part = k => { const f = Lp.from?.[k], ramp = f === undefined ? 1 : Math.max(0, Math.min(1, (bar + s / 16 - f) / 2)); return mix ? ramp * (mix[k] ?? 1) : ramp; };
      if (bus('loop') && live > .001) {
        const stomp = Lp.stomps.find(x => x[0] === s), ps = part('stomps'), pc = part('claps'), pt = part('toms'), ph = part('shaker'), pk = part('type');
        if (stomp && ps > 0) { I.stomp(ctx, bus('loop'), t, stomp[1] * ps, Lp.stomp); if (s % 8 === 0) api.duck(t, {bass:.8, keys:.88, guitar:.85}); }
        if (pc > 0) for (const [at, v, fewer] of Lp.claps) if (at === s) I.gangClap(ctx, bus('loop'), t, v * pc, {people:Math.max(2, 4 - fewer), width:.8});
        if (pt > 0) for (const [at, v, midi, decay] of Lp.toms) if (at === s) I.floorTom(ctx, bus('loop'), t, midi, v * pt, {decay, side:midi === 50 ? .3 : -.3});
        if (ph > 0) I.shaker(ctx, bus('loop'), t, Lp.shake[s % 4] * ph);
        if (pk > 0 && Lp.type[s]) I.keyClick(ctx, bus('loop'), t, .1 * Lp.type[s] * pk, bar * 16 + s * 3);
        if (pk > 0 && s === 12 && bar % 2) I.mug(ctx, bus('loop'), t, 81, .1 * pk, .35);
      }
      // The tambourine, in the background: 16ths leaning on the "and", a strike on four every other bar.
      if (bus('tambourine') && lv('tambourine') > .001) {
        const v = W.tambourine.shakes[s % 4];
        if (W.tambourine.hits.includes(s) && bar % 2) I.tambourine(ctx, bus('tambourine'), t, .7, {kind:'hit', side:.35});
        else if (v) I.tambourine(ctx, bus('tambourine'), t, v, {kind:'shake', side:.35});
      }
      const chord = b.chord, penta = W.pentatonicAt ? W.pentatonicAt(bar) : W.pentatonic, center = W.window(bar + s / 16);
      // Pat hums the root on the offbeats (Delve's Pat plays its bassline, delveStep).
      if (!W.bassline && bus('bass') && lv('bass') > .001 && (s === 2 || s === 10)) I.humBass(ctx, bus('bass'), t, chord.root, 6 * step - .02, .6);
      // (the engine's last argument here is the 16th's index; delveStep takes the 16th in seconds)
      if (W.push !== undefined) delveStep(api, W, own, b, bar, s, t, plan.step, lv, bus, penta, center);
      // Kevin's figure, clean, on the offbeats.
      if (bus('guitar') && lv('guitar') > .001) for (const [at, i] of W.figure) if (at === s) I.cleanGuitar(ctx, bus('guitar'), t, [chord.notes[i] + 12], .34, {ring:.8});
      // The colours: the pluck's arpeggio, the felt piano's chords, the mallet's counter-line, on a pitch window that drifts.
      if (bus('plucks') && lv('plucks') > .001) { const k = W.plucks[(bar % 2) * 16 + s]; if (k !== null && k !== undefined) colour(ctx, bus('plucks'), t, 'pluck', pstep(center, k, penta), .55 + .1 * (s % 4 === 2), {pan:(s % 8 < 4 ? -.25 : .25)}); }
      if (bus('felt') && lv('felt') > .001 && (s === 0 || s === 8)) for (const m of chord.keys.slice(1, 4)) colour(ctx, bus('felt'), t + (m % 3) * .012, 'felt', m + 12, s ? .4 : .5, {pan:(m % 2 ? -.15 : .15)});
      if (bus('mallet') && lv('mallet') > .001) { const k = W.mallet[(bar % 4) * 16 + s]; if (k !== null && k !== undefined) colour(ctx, bus('mallet'), t, 'mallet', pstep(center + 12, k, penta), .6, {pan:.3}); }
    },
  };
}

// ---- Delve: her vocabulary, her choir, the stars, and the band's new hands ----------------------
// (songbook/delve.js; wander.js vocabulary() decides every time and note, the river only plays them.)

// Her decoded file as one channel (the recordings are dual mono), once per buffer.
const MONO = new WeakMap();
function monoOf(buffer) {
  if (!buffer) return null;
  if (!MONO.has(buffer)) {
    const n = buffer.numberOfChannels, a = buffer.getChannelData(0);
    let y = a;
    if (n > 1) { const b = buffer.getChannelData(1); y = new Float32Array(a.length); for (let i = 0; i < a.length; i++) y[i] = .5 * (a[i] + b[i]); }
    MONO.set(buffer, y);
  }
  return MONO.get(buffer);
}
// A loop source of one or more of her files, joined end to end (each cut shifted into the join).
function loopSource(api, loop) {
  const files = loop.files ?? [loop.file], parts = files.map(f => api.song.lady?.files?.get(f));
  if (parts.some(p => !p)) { if (!parts[0]) return null; }
  const sr = parts[0].sampleRate, offsets = new Map();
  let n = 0;
  files.forEach((f, i) => { if (parts[i]) { offsets.set(f, n); n += parts[i].length; } });
  const src = new Float32Array(n);
  files.forEach((f, i) => { if (parts[i]) src.set(monoOf(parts[i]), offsets.get(f)); });
  const cuts = loop.cuts.filter(c => offsets.has(c.file ?? files[0])).map(c => ({...c, from:c.from + offsets.get(c.file ?? files[0]) / sr, to:c.to + offsets.get(c.file ?? files[0]) / sr}));
  return cuts.length ? {src, sr, cuts} : null;
}
// A buffer of [L, R] (or one channel) played into `out` from song time `when` (plan seconds) for its whole
// length (or until `until`), through a gain: an excerpt that starts later starts it part way in.
function playBaked(api, at, channels, sr, when, out, gain = 1, {until = null, cache = null} = {}) {
  const {ctx} = api, len = channels[0].length, dur = len / sr, end = until ?? when + dur;
  if (at(end) <= 0 || !out) return;
  let buf = cache?.get(channels);
  if (!buf) { buf = ctx.createBuffer(channels.length, len, sr); channels.forEach((c, i) => buf.getChannelData(i).set(c)); cache?.set(channels, buf); }
  const src = ctx.createBufferSource(), g = api.I.amp(ctx, gain), t0 = at(when), into = t0 < 0 ? -t0 : 0;
  src.buffer = buf; src.connect(g); g.connect(out);
  src.start(Math.max(0, t0), into, Math.max(.001, Math.min(dur, end - when) - into)); src.stop(at(end) + .01);
  src.onended = () => { src.disconnect(); g.disconnect(); };
}

// The textures of a chart whose pentatonic moves (W.pentatonicAt): each texture rendered once per key it
// meets, then spliced on its two-bar grid where the key changes, so a grain never sings out of the bar's key.
function textureSpans(api, W, layer, loop, at, bus, own) {
  const {ctx, plan} = api, source = loopSource(api, loop);
  if (!source) return;
  const P = W.textures[layer.id] || {}, sr = source.sr, length = Math.round(32 * plan.step * sr), T = plan.timing;
  const first = Math.floor(layer.inBars[0] / 2) * 2, last = Math.min(plan.bars.length, Math.ceil(layer.outBars[1]));
  let a = first;
  while (a < last) {
    const penta = W.pentatonicAt(a), key = `${layer.id}|${penta.join()}`;
    let b = a + 2;
    while (b < last && W.pentatonicAt(b).join() === penta.join()) b += 2;
    if (!own.textures.has(key)) {
      const [L, R] = renderTexture({src:source.src, sr, cuts:source.cuts, hits:textureHits(W, layer, {cuts:source.cuts}, plan, penta), length, amount:P.amount ?? .55, smear:P.smear ?? 0, smearSteps:P.smearSteps ?? [0], seed:P.seed ?? 1});
      const buf = ctx.createBuffer(2, length, sr); buf.getChannelData(0).set(L); buf.getChannelData(1).set(R);
      own.textures.set(key, buf);
    }
    const buf = own.textures.get(key), from = T[a * 16], to = T[Math.min(plan.totalSteps, Math.min(b, last) * 16)];
    if (at(to) > 0) {
      const src = ctx.createBufferSource(), startT = at(from), into = startT < 0 ? (-startT) % buf.duration : 0;
      src.buffer = buf; src.loop = true; src.connect(bus.input);
      src.start(Math.max(0, startT), into); src.stop(at(to) + .002);
      src.onended = () => src.disconnect();
    }
    a = b;
  }
}

// Every phrase of her setlist and its echoes, baked (vocab-stages.js bakePhrase): the phrase itself dry and
// centred over the stream (past the band's stems, as a clear phrase of the river plays) with a little of it in
// the diffusion; its echoes on her stem with a share in the diffusion; the throw in the diffusion alone.
function scheduleVocabulary(api, own, plan, at) {
  const {graph} = api, wash = own.washIn, cache = new WeakMap();
  for (const e of plan.band.filter(x => x.own)) {
    const buffer = api.song.lady?.files?.get(e.file), x = monoOf(buffer);
    if (!x || graph.muted?.lady) continue;
    const sr = buffer.sampleRate, parts = bakePhrase(e, plan.echoes.filter(h => h.phrase === e.id), x, sr);
    if (parts.dry) { playBaked(api, at, parts.dry.channels, sr, parts.dry.at, graph.tag, 1, {cache}); playBaked(api, at, parts.dry.channels, sr, parts.dry.at, wash, e.wash ?? .1, {cache}); }
    if (parts.wet) { playBaked(api, at, parts.wet.channels, sr, parts.wet.at, graph.stems.lady.input, 1, {cache}); playBaked(api, at, parts.wet.channels, sr, parts.wet.at, wash, .32, {cache}); }
    if (parts.throw) playBaked(api, at, parts.throw.channels, sr, parts.throw.at, wash, 1.1, {cache});
  }
}

// Her choir (lady-choir.js): each singer's two-bar chant baked once per pixel stage and played block by
// block (so the Pool can take the bed), ramping in at its bar; in the Pool, four of her hold "ah" on the
// chord from the push before it. Into the choir layer (its level, filter, duck and wash are the layer's).
function scheduleChoir(api, W, own, plan, at) {
  const {ctx, I} = api, bus = own.layers.choir?.input, C = W.choir, T = plan.timing, layer = plan.layers.find(l => l.kind === 'choir');
  const chantBuf = api.song.lady?.files?.get(CHANT_FILE), ahBuf = api.song.lady?.files?.get(AH.file);
  if (!bus || !layer || !chantBuf) return;
  const sr = chantBuf.sampleRate, x = monoOf(chantBuf), an = analysisOf(x, sr, CHANT_FILE), step = plan.step, len = 32 * step, dB = v => 10 ** (v / 20);
  const pixelAt = bar => { let a = C.pixels[0][1]; for (const [b, v] of C.pixels) if (bar >= b) a = v; return a; };
  const notes = (singer) => C.chant.map(([s, n, k, midi]) => ({at:s * step, len:n * step, syllable:k, midi:pstep(midi, singer.steps, W.pentatonic)}));
  const bakes = new Map();
  const chant = (k, amount) => {
    const key = `${k}|${amount}`;
    if (!bakes.has(key)) {
      const s = C.singers[k], y = choirTone(chantSinger(x, sr, an, {notes:notes(s), length:len, detune:s.cents, onset:s.onset, formant:s.formant, amount, seed:k + 1}), sr);
      bakes.set(key, [y]);
    }
    return bakes.get(key);
  };
  // Each singer through its own gain: silent until its bar, then in over two bars.
  const gains = C.singers.map((s, k) => {
    const g = I.amp(ctx, 0), a = Math.max(layer.inBars[0], s.from), t0 = at(T[a * 16]), t1 = at(T[Math.min(plan.totalSteps, (a + 2) * 16)]), p = ctx.createStereoPanner();
    p.pan.value = [0, -.35, .2, .4][k] ?? 0;
    g.gain.setValueAtTime(0, Math.max(0, t0)); g.gain.linearRampToValueAtTime(dB(C.gains[k] ?? 0), Math.max(.001, t1));
    g.connect(p); p.connect(bus);
    return g;
  });
  const first = Math.floor(layer.inBars[0] / 2) * 2, last = Math.min(plan.bars.length, Math.ceil(layer.outBars[1]));
  for (let block = first; block < last; block += 2) {
    const pool = block >= C.pool[0] && block < C.pool[1];
    if (pool) {
      if (!ahBuf) continue;
      const chord = W.chordAt(block), key = `ah|${chord.name}`, ax = monoOf(ahBuf), aan = analysisOf(ax, ahBuf.sampleRate, AH.file), push = W.push ?? 0;
      const from = T[block * 16 - push], to = T[Math.min(plan.totalSteps, (block + 2) * 16 - (block + 2 < C.pool[1] ? push : 0))] + .35;
      if (!bakes.has(key)) {
        const n = Math.round((to - from + .4) * ahBuf.sampleRate), L = new Float32Array(n), R = new Float32Array(n);
        chord.choir.forEach((midi, k) => {
          const s = C.singers[k], y = choirTone(heldVowel(ax, ahBuf.sampleRate, aan, {from:AH.from, to:AH.to, midi, length:(n / ahBuf.sampleRate) - .02, detune:s.cents, formant:s.formant, amount:pixelAt(block), seed:11 + k, attack:.45, release:.6}), ahBuf.sampleRate);
          const pan = [0, -.45, .2, .5][k], g = dB((C.gains[k] ?? 0) + (C.ah ?? 0)), gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2 * g, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2 * g;
          for (let i = 0; i < y.length && i < n; i++) { L[i] += gl * y[i]; R[i] += gr * y[i]; }
        });
        bakes.set(key, [L, R]);
      }
      playBaked(api, at, bakes.get(key), ahBuf.sampleRate, from, bus, 1);
      continue;
    }
    const amount = pixelAt(block), from = T[block * 16], until = T[Math.min(plan.totalSteps, Math.min(block + 2, last) * 16)];
    // The block after the Pool comes in under the last held "ah" (its release), from its downbeat.
    C.singers.forEach((s, k) => { if (block + 2 > s.from) playBaked(api, at, chant(k, amount), sr, from, gains[k], 1, {until}); });
  }
}

// The stars: one chime a star (plan.stars.twinkles), high on the bar's pentatonic, into the chime layer.
function scheduleStars(api, own, plan, at) {
  const bus = own.layers.chime?.input;
  if (!bus || !plan.stars) return;
  for (const s of plan.stars.twinkles) { const t = at(s.t); if (t >= 0) api.I.chime(api.ctx, bus, t, s.midi, s.v * (s.hero ? 1.15 : 1), {side:s.pan}); }
}

// The chord runs of a chart with a push (W.push 16ths early): {chord, from, to} in 16ths, once per plan.
const RUNS = new WeakMap();
export function runsOf(W, plan) {
  if (RUNS.has(plan)) return RUNS.get(plan);
  const out = [];
  for (let bar = 0; bar < plan.bars.length; bar++) {
    const chord = W.chordAt(bar), prev = out.at(-1);
    if (prev && prev.chord === chord) { prev.to = (bar + 1) * 16; continue; }
    const from = bar ? bar * 16 - W.push : 0;
    if (prev) prev.to = from;
    out.push({chord, from, to:(bar + 1) * 16, bar});
  }
  RUNS.set(plan, out);
  return out;
}

// Delve's own hands, per 16th (`step`: the 16th in seconds): the drone and the pad on the pushed runs, Pat's
// bassline, the hand drum, the slit drum, Synthia's arpeggio.
function delveStep(api, W, own, b, bar, s, t, step, lv, bus, penta, center) {
  const {ctx, I, plan} = api, T = plan.timing, at = bar * 16 + s, live = id => bus(id) && lv(id) > .001;
  const run = runsOf(W, plan).find(r => r.from === at), sounding = runsOf(W, plan).find(r => at >= r.from && at < r.to) ?? {chord:b.chord};
  // The room, under the Source: low air and the building's hum, before the floor arrives.
  if (W.room && at === 0) I.roomTone(ctx, api.graph.stems.drums.input, t, T[W.room.bars * 16] - T[0], W.room.level);
  if (run) {
    const length = T[Math.min(plan.totalSteps, run.to)] - T[run.from];
    if (bus('drone')) { I.harmonium(ctx, bus('drone'), t, run.chord.keys, length, .8); I.voicePad(ctx, bus('drone'), t, run.chord.notes, length, .7, {vowel:'oo', attack:1, release:1.4, wow:3}); }
    if (bus('pad')) I.warmPad(ctx, bus('pad'), t, run.chord.notes, length, .85);
  }
  // Pat: the root, its fifth, and on the "and" of four the root again (the next chord's, where it is pushed),
  // gliding from the note before, legato.
  if (live('bass')) for (const [k, iv, n, v] of W.bassline) if (k === s) {
    const midi = sounding.chord.root + (iv ?? 0), from = own.bassPrev ?? null;
    I.warmBass(ctx, bus('bass'), t, midi, n * step - .012, v, {from:from !== null && from !== midi ? from : null});
    own.bassPrev = midi;
  }
  if (live('hands')) for (const [k, stroke, midi, v, side] of W.hands) if (k === s) I.handDrum(ctx, bus('hands'), t, midi, v, {stroke, side});
  if (live('logdrum')) {
    const k = W.logdrum[(bar % 2) * 16 + s];
    if (k !== null && k !== undefined) I.logDrum(ctx, bus('logdrum'), t, pstep(center - 5, k, penta), .42 + (s % 4 === 0 ? .14 : 0) + (s % 8 === 6 ? .06 : 0), {side:s % 4 < 2 ? -.2 : .2});
  }
  if (live('arp')) {
    const notes = sounding.chord.notes, i = W.arp[s], m = i < notes.length ? notes[i] + 12 : notes[0] + 24;
    I.seqArp(ctx, bus('arp'), t, m, step * .85, .36 + (s % 4 === 0 ? .08 : 0), {side:s % 2 ? .25 : -.25});
  }
}
