// The band, synthesized. Every voice takes any BaseAudioContext, so live
// playback and the offline render are the same code. No Math.random: noise is
// seeded and read from a time-derived offset, so two renders match exactly.

import {decimate as pixelDecimate, crush as pixelCrush, pixelParams} from './voices/pixel.js';

export const mtof = m => 440 * 2 ** ((m - 69) / 12);
const cache = new WeakMap();
function store(ctx) { let s = cache.get(ctx); if (!s) cache.set(ctx, s = {}); return s; }

export function noiseBuffer(ctx) {
  const s = store(ctx);
  if (!s.noise) {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    let seed = 0x2545f491;
    for (let i = 0; i < d.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    s.noise = b;
  }
  return s.noise;
}

const done = (source, nodes) => { source.onended = () => nodes.forEach(n => n.disconnect()); };
export const biquad = (ctx, type, frequency, Q = .707, gain = 0) => {
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = Q; f.gain.value = gain; return f;
};
export const amp = (ctx, value = 0) => { const g = ctx.createGain(); g.gain.value = value; return g; };
const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes; };

function noise(ctx, t, duration) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx); s.loop = true;
  s.start(t, (t * 7.31) % 1.8); s.stop(t + duration); return s;
}

function drive(ctx, amount) {
  const s = store(ctx), key = 'drive' + amount;
  if (!s[key]) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    s[key] = curve;
  }
  const w = ctx.createWaveShaper(); w.curve = s[key]; w.oversample = '4x'; return w;
}

export function kick(ctx, out, t, v = 1) {
  const o = ctx.createOscillator(), g = amp(ctx), sh = drive(ctx, 1.8);
  // Body 220 → 62 Hz, settling on A1 (55 Hz): the kick is in key.
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(62, t + .05);
  o.frequency.exponentialRampToValueAtTime(55, t + .22);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + .0015);
  g.gain.setValueAtTime(v, t + .04);
  g.gain.exponentialRampToValueAtTime(v * .4, t + .13);
  g.gain.exponentialRampToValueAtTime(.0008, t + .34);
  chain(o, sh, g, out); o.start(t); o.stop(t + .36); done(o, [o, sh, g]);
  const n = noise(ctx, t, .014), hp = biquad(ctx, 'highpass', 2800), ng = amp(ctx);
  ng.gain.setValueAtTime(.2 * v, t); ng.gain.exponentialRampToValueAtTime(.001, t + .012);
  chain(n, hp, ng, out); done(n, [n, hp, ng]);
}

export function clap(ctx, out, t, v = 1) {
  const n = noise(ctx, t, .36), hp = biquad(ctx, 'highpass', 700), bp = biquad(ctx, 'bandpass', 1250, .9), g = amp(ctx);
  [0, .0095, .02].forEach((o, i) => { g.gain.setValueAtTime(v * (i === 2 ? 1 : .75), t + o); g.gain.exponentialRampToValueAtTime(v * .1, t + o + .0085); });
  g.gain.setValueAtTime(v * .85, t + .029);
  g.gain.exponentialRampToValueAtTime(.001, t + .3);
  chain(n, hp, bp, g, out); done(n, [n, hp, bp, g]);
}

export function hat(ctx, out, t, v, decay = .032) {
  const n = noise(ctx, t, decay + .02), hp = biquad(ctx, 'highpass', 7800), bp = biquad(ctx, 'peaking', 10500, 1.2, 6), g = amp(ctx), p = spread(ctx, .22);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + decay);
  chain(n, hp, bp, g, p, out); done(n, [n, hp, bp, g, p]);
}

export function openHat(ctx, out, t, v) {
  const n = noise(ctx, t, .3), hp = biquad(ctx, 'highpass', 6800), pk = biquad(ctx, 'peaking', 9000, 1, 5), g = amp(ctx);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004);
  g.gain.exponentialRampToValueAtTime(v * .3, t + .09); g.gain.exponentialRampToValueAtTime(.001, t + .24);
  chain(n, hp, pk, g, out); done(n, [n, hp, pk, g]);
}

// The printer: paper through a feed roller, on every 16th.
export function shaker(ctx, out, t, v) {
  const n = noise(ctx, t, .1), bp = biquad(ctx, 'bandpass', 5400, 1.5), g = amp(ctx), p = spread(ctx, -.35);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + .075);
  chain(n, bp, g, p, out); done(n, [n, bp, g, p]);
}

export function rim(ctx, out, t, v) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = amp(ctx), bp = biquad(ctx, 'bandpass', 1900, 3);
  o.type = 'triangle'; o.frequency.value = 1760; o2.type = 'sine'; o2.frequency.value = 830;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .045);
  o.connect(bp); o2.connect(g); bp.connect(g); g.connect(out);
  [o, o2].forEach(x => { x.start(t); x.stop(t + .05); }); done(o, [o, o2, bp, g]);
}

export function crash(ctx, out, t, v = .5) {
  const n = noise(ctx, t, 2.2), hp = biquad(ctx, 'highpass', 4800), pk = biquad(ctx, 'peaking', 7600, .8, 4), g = amp(ctx);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(v * .25, t + .4); g.gain.exponentialRampToValueAtTime(.001, t + 2.1);
  chain(n, hp, pk, g, out); done(n, [n, hp, pk, g]);
}

// Two bars of rising air into the drop.
export function riser(ctx, out, t, duration, v = .32) {
  const n = noise(ctx, t, duration), bp = biquad(ctx, 'bandpass', 350, 2.5), g = amp(ctx);
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(7500, t + duration);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + duration - .02); g.gain.linearRampToValueAtTime(0, t + duration);
  chain(n, bp, g, out); done(n, [n, bp, g]);
}

export function impact(ctx, out, t, v = .9) {
  const o = ctx.createOscillator(), g = amp(ctx);
  o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.4);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
  chain(o, g, out); o.start(t); o.stop(t + 1.65); done(o, [o, g]);
}

export function bass(ctx, out, t, midi, length, v = 1) {
  const f = mtof(midi), saw = ctx.createOscillator(), sub = ctx.createOscillator();
  const lp = biquad(ctx, 'lowpass', 1500, 7), g = amp(ctx), sg = amp(ctx, .85);
  saw.type = 'sawtooth'; saw.frequency.value = f; sub.frequency.value = f;
  lp.frequency.setValueAtTime(1700, t); lp.frequency.exponentialRampToValueAtTime(240, t + .17);
  const end = t + length;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004);
  g.gain.setValueAtTime(v, end - .03); g.gain.linearRampToValueAtTime(0, end);
  saw.connect(lp); lp.connect(g); sub.connect(sg); sg.connect(g); g.connect(out);
  [saw, sub].forEach(x => { x.start(t); x.stop(end + .01); }); done(saw, [saw, sub, lp, g, sg]);
}

function spread(ctx, side) { const p = ctx.createStereoPanner(); p.pan.value = side; return p; }

export function stab(ctx, out, t, notes, length, v = 1, cutoff = 3000) {
  const lp = biquad(ctx, 'lowpass', cutoff, 2.2), g = amp(ctx), oscs = [], left = spread(ctx, -.55), right = spread(ctx, .55);
  lp.frequency.setValueAtTime(cutoff * 1.7, t); lp.frequency.exponentialRampToValueAtTime(cutoff * .55, t + .28);
  left.connect(lp); right.connect(lp);
  notes.forEach(m => [-9, 9].forEach(cents => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents; o.connect(cents < 0 ? left : right); oscs.push(o);
  }));
  const end = t + length, level = v * .16;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + .004);
  g.gain.exponentialRampToValueAtTime(level * .45, t + .14);
  g.gain.setValueAtTime(level * .45, end - .03); g.gain.linearRampToValueAtTime(0, end);
  lp.connect(g); g.connect(out);
  oscs.forEach(o => { o.start(t); o.stop(end + .01); }); done(oscs[0], [...oscs, left, right, lp, g]);
}

export function pad(ctx, out, t, notes, length, v = 1) {
  const g = amp(ctx), oscs = [], sides = [-.7, 0, .7].map(side => { const p = spread(ctx, side); p.connect(g); return p; });
  notes.forEach(m => [-13, 0, 13].forEach((cents, i) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents; o.connect(sides[i]); oscs.push(o);
  }));
  const level = v * .055, end = t + length;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + .35);
  g.gain.setValueAtTime(level, end - .25); g.gain.linearRampToValueAtTime(0, end + .5);
  g.connect(out);
  oscs.forEach(o => { o.start(t); o.stop(end + .55); }); done(oscs[0], [...oscs, ...sides, g]);
}

// Kevin's muted funk chops: Karplus-Strong plucks, rendered once per note.
function pluckBuffer(ctx, midi) {
  const s = store(ctx), key = 'pluck' + midi;
  if (s[key]) return s[key];
  const sr = ctx.sampleRate, period = Math.max(2, Math.round(sr / mtof(midi))), b = ctx.createBuffer(1, Math.round(sr * .4), sr), d = b.getChannelData(0);
  let seed = midi * 7919 + 13, last = 0;
  for (let i = 0; i < period; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed / 2147483648 - 1; last = last * .55 + x * .45; d[i] = last; }
  for (let i = period; i < d.length; i++) d[i] = .4985 * (d[i - period] + d[i - period - 1 >= 0 ? i - period - 1 : 0]);
  return s[key] = b;
}

export function chop(ctx, out, t, notes, v = 1) {
  const lp = biquad(ctx, 'lowpass', 2600, 1.4), g = amp(ctx);
  g.gain.setValueAtTime(v * .5, t); g.gain.exponentialRampToValueAtTime(v * .12, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + .13);
  lp.connect(g); g.connect(out);
  let first;
  notes.forEach((m, i) => { const s = ctx.createBufferSource(); s.buffer = pluckBuffer(ctx, m); s.connect(lp); s.start(t + i * .005); s.stop(t + .16); first ??= s; });
  done(first, [lp, g]);
}

export function impulse(ctx, seconds = 2.6, decay = 3.1) {
  const s = store(ctx);
  if (s.ir) return s.ir;
  const length = Math.round(ctx.sampleRate * seconds), b = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let seed = 99 + c * 31, smooth = 0;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const p = i / length, x = seed / 2147483648 - 1;
      smooth += (x - smooth) * (.9 - p * .75);        // the tail darkens as it decays
      d[i] = smooth * Math.exp(-p * decay * 2.2) * (i < ctx.sampleRate * .012 ? i / (ctx.sampleRate * .012) : 1);
    }
  }
  return s.ir = b;
}

// ---- Drop Edition voices -------------------------------------------------

// The half-time snare: a tuned body under a noise crack.
export function snare(ctx, out, t, v = 1) {
  const o = ctx.createOscillator(), og = amp(ctx);
  o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(175, t + .06);
  og.gain.setValueAtTime(v * .55, t); og.gain.exponentialRampToValueAtTime(.001, t + .14);
  chain(o, og, out); o.start(t); o.stop(t + .16); done(o, [o, og]);
  const n = noise(ctx, t, .3), hp = biquad(ctx, 'highpass', 900), pk = biquad(ctx, 'peaking', 2400, 1, 5), g = amp(ctx);
  g.gain.setValueAtTime(v * .7, t); g.gain.exponentialRampToValueAtTime(v * .2, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + .26);
  chain(n, hp, pk, g, out); done(n, [n, hp, pk, g]);
}

// A short, bright roll hit that stays separate at 32nds (the clap would smear).
export function snareRoll(ctx, out, t, v, tone = 200) {
  const n = noise(ctx, t, .08), bp = biquad(ctx, 'bandpass', 1800, .8), g = amp(ctx);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
  chain(n, bp, g, out); done(n, [n, bp, g]);
  const o = ctx.createOscillator(), og = amp(ctx);
  o.frequency.setValueAtTime(tone, t); og.gain.setValueAtTime(v * .35, t); og.gain.exponentialRampToValueAtTime(.001, t + .05);
  chain(o, og, out); o.start(t); o.stop(t + .06); done(o, [o, og]);
}

// Dub wobble: a saturated saw/square pair through a resonant low-pass whose
// cutoff swings 120 → 2400 Hz once per wobble, with a clean sine sub under it.
export function wobble(ctx, out, t, midi, length, period, v = 1) {
  const f = mtof(midi), saw = ctx.createOscillator(), sq = ctx.createOscillator(), sub = ctx.createOscillator();
  saw.type = 'sawtooth'; sq.type = 'square'; saw.frequency.value = f; sq.frequency.value = f; sq.detune.value = 9; sub.frequency.value = f;
  const lp = biquad(ctx, 'lowpass', 400, 8), sh = drive(ctx, 3.4), g = amp(ctx), sg = amp(ctx, .8), mix = amp(ctx, .5);
  const points = Math.max(32, Math.round(length / period * 64)), curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const phase = (i / points * length / period) % 1, shape = .5 - .5 * Math.cos(2 * Math.PI * phase);
    curve[i] = 120 * 20 ** shape;
  }
  lp.frequency.setValueCurveAtTime(curve, t, length);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.setValueAtTime(v, t + length - .04); g.gain.linearRampToValueAtTime(0, t + length);
  saw.connect(mix); sq.connect(mix); mix.connect(lp); lp.connect(sh); sh.connect(g); sub.connect(sg); sg.connect(g); g.connect(out);
  [saw, sq, sub].forEach(o => { o.start(t); o.stop(t + length + .01); }); done(saw, [saw, sq, sub, lp, sh, g, sg, mix]);
}

// One long note: the room's floor while it sinks.
export function sustainBass(ctx, out, t, midi, length, v = 1) {
  const f = mtof(midi), saw = ctx.createOscillator(), sub = ctx.createOscillator(), lp = biquad(ctx, 'lowpass', 500, 2), g = amp(ctx), sg = amp(ctx, .9);
  saw.type = 'sawtooth'; saw.frequency.value = f; sub.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.setValueAtTime(v, t + length - .05); g.gain.linearRampToValueAtTime(0, t + length);
  saw.connect(lp); lp.connect(g); sub.connect(sg); sg.connect(g); g.connect(out);
  [saw, sub].forEach(o => { o.start(t); o.stop(t + length + .01); }); done(saw, [saw, sub, lp, g, sg]);
}

// The drop's floor falls away: 110 → 27.5 Hz (A2 → A0; a track passes its own
// two octaves), driven so phones hear its harmonics.
export function subDrop(ctx, out, t, v = .7, {from = 110, to = 27.5} = {}) {
  const o = ctx.createOscillator(), sh = drive(ctx, 2.6), g = amp(ctx);
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + 1.5);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
  chain(o, sh, g, out); o.start(t); o.stop(t + 1.65); done(o, [o, sh, g]);
}

// A drop kick: the same tuned body with a longer, harder tail. It settles on
// A1 (55 Hz); a track tunes it to its own key: {knee, settle} in Hz.
export function dropKick(ctx, out, t, v = 1, {top = 240, knee = 62, settle = 55} = {}) {
  const o = ctx.createOscillator(), g = amp(ctx), sh = drive(ctx, 3);
  o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(knee, t + .06); o.frequency.exponentialRampToValueAtTime(settle, t + .25);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .002); g.gain.setValueAtTime(v, t + .07); g.gain.exponentialRampToValueAtTime(.001, t + .5);
  chain(o, sh, g, out); o.start(t); o.stop(t + .52); done(o, [o, sh, g]);
}

// Air falling after the impact: band-pass 8 kHz → 400 Hz.
export function downlifter(ctx, out, t, duration, v = .22) {
  const n = noise(ctx, t, duration), bp = biquad(ctx, 'bandpass', 8000, 1.2), g = amp(ctx);
  bp.frequency.setValueAtTime(8000, t); bp.frequency.exponentialRampToValueAtTime(400, t + duration);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + duration);
  chain(n, bp, g, out); done(n, [n, bp, g]);
}

// A cymbal played backwards into the next downbeat.
export function reverseCrash(ctx, out, t, duration, v = .4) {
  const n = noise(ctx, t, duration), hp = biquad(ctx, 'highpass', 4200), g = amp(ctx);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + duration - .01); g.gain.linearRampToValueAtTime(0, t + duration);
  chain(n, hp, g, out); done(n, [n, hp, g]);
}

// Four detuned saws gliding two octaves up under the build.
export function sawRiser(ctx, out, t, duration, from = 57, to = 81, v = .05) {
  const hp = biquad(ctx, 'highpass', 300), g = amp(ctx), oscs = [-14, -5, 5, 14].map(cents => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = cents;
    o.frequency.setValueAtTime(mtof(from), t); o.frequency.exponentialRampToValueAtTime(mtof(to), t + duration); o.connect(hp); return o;
  });
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + duration - .02); g.gain.linearRampToValueAtTime(0, t + duration);
  hp.connect(g); g.connect(out);
  oscs.forEach(o => { o.start(t); o.stop(t + duration + .01); }); done(oscs[0], [...oscs, hp, g]);
}

// A ride: a metallic wash on the off-beats, for the drops' top end.
export function ride(ctx, out, t, v = .2) {
  const n = noise(ctx, t, .5), hp = biquad(ctx, 'highpass', 5200), pk = biquad(ctx, 'peaking', 7400, 3, 7), g = amp(ctx);
  const o = ctx.createOscillator(), og = amp(ctx); o.type = 'square'; o.frequency.value = 3150; og.gain.setValueAtTime(v * .05, t); og.gain.exponentialRampToValueAtTime(.0005, t + .3);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(v * .3, t + .06); g.gain.exponentialRampToValueAtTime(.001, t + .45);
  chain(n, hp, pk, g, out); o.connect(og); og.connect(hp); o.start(t); o.stop(t + .32); done(n, [n, hp, pk, g]); done(o, [o, og]);
}

// ---- Song book voices ----------------------------------------------------
// New players for the other tracks. Circle Back never calls them.

// A kick tuned to the track: body top → knee → settle (Hz), a hold, a decay.
export function tunedKick(ctx, out, t, v = 1, {top = 220, knee = 62, settle = 55, kneeAt = .05, settleAt = .22, hold = .04, decay = .34, drive:amount = 1.8, click = .2, clickHz = 2800} = {}) {
  const o = ctx.createOscillator(), g = amp(ctx), sh = drive(ctx, amount);
  o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(knee, t + kneeAt); o.frequency.exponentialRampToValueAtTime(settle, t + settleAt);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .0015); g.gain.setValueAtTime(v, t + hold);
  g.gain.exponentialRampToValueAtTime(v * .4, t + hold + (decay - hold) * .3); g.gain.exponentialRampToValueAtTime(.0008, t + decay);
  chain(o, sh, g, out); o.start(t); o.stop(t + decay + .02); done(o, [o, sh, g]);
  if (click) {
    const n = noise(ctx, t, .014), hp = biquad(ctx, 'highpass', clickHz), ng = amp(ctx);
    ng.gain.setValueAtTime(click * v, t); ng.gain.exponentialRampToValueAtTime(.001, t + .012);
    chain(n, hp, ng, out); done(n, [n, hp, ng]);
  }
}

// A finger snap: two quick cracks of band-passed air and a short tonal snap.
export function snap(ctx, out, t, v = 1, side = .18) {
  const n = noise(ctx, t, .12), hp = biquad(ctx, 'highpass', 1100), bp = biquad(ctx, 'bandpass', 2300, 1.3), g = amp(ctx), p = spread(ctx, side);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .0008); g.gain.exponentialRampToValueAtTime(v * .2, t + .011);
  g.gain.setValueAtTime(v * .75, t + .013); g.gain.exponentialRampToValueAtTime(.001, t + .1);
  chain(n, hp, bp, g, p, out); done(n, [n, hp, bp, g, p]);
  const o = ctx.createOscillator(), og = amp(ctx);
  o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(1350, t + .02);
  og.gain.setValueAtTime(v * .22, t); og.gain.exponentialRampToValueAtTime(.001, t + .028);
  chain(o, og, p); o.start(t); o.stop(t + .03); done(o, [o, og]);
}

// An electric piano: per note, a 1:1 FM pair (the body, its index falling as the
// tine settles) and a 1:14 pair for the bell of the attack; a little bark, and
// a tremolo that pans the chord across the stereo field.
export function rhodes(ctx, out, t, notes, length, v = 1, {bright = 1, trem = 4.4, width = .4, bark = 1.5, level = .05, release = .18} = {}) {
  const mix = amp(ctx, 1), sh = drive(ctx, bark), pan = ctx.createStereoPanner(), lfo = ctx.createOscillator(), depth = amp(ctx, width);
  lfo.frequency.value = trem; lfo.connect(depth); depth.connect(pan.pan);
  mix.connect(sh); sh.connect(pan); pan.connect(out);
  const end = t + length, stop = end + release + .02, oscs = [lfo], nodes = [mix, sh, pan, depth], b = bright * (.6 + .4 * v);
  for (const m of notes) {
    const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), idx = amp(ctx), env = amp(ctx);
    const bell = ctx.createOscillator(), bmod = ctx.createOscillator(), bidx = amp(ctx), benv = amp(ctx);
    car.frequency.value = f; mod.frequency.value = f; bell.frequency.value = f; bmod.frequency.value = f * 14;
    idx.gain.setValueAtTime(f * 1.6 * b, t); idx.gain.exponentialRampToValueAtTime(f * .28 * b, t + .45);
    bidx.gain.setValueAtTime(f * 1.1 * b, t); bidx.gain.exponentialRampToValueAtTime(f * .01, t + .07);
    mod.connect(idx); idx.connect(car.frequency); bmod.connect(bidx); bidx.connect(bell.frequency);
    const peak = v * level, sustain = Math.max(end, t + .02);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(peak, t + .003);
    env.gain.exponentialRampToValueAtTime(peak * .5, t + Math.min(.7, length * .9 + .05));
    env.gain.setValueAtTime(peak * .5, sustain); env.gain.exponentialRampToValueAtTime(.0001, sustain + release);
    benv.gain.setValueAtTime(peak * .5 * b, t); benv.gain.exponentialRampToValueAtTime(.0001, t + .35);
    car.connect(env); env.connect(mix); bell.connect(benv); benv.connect(mix);
    oscs.push(car, mod, bell, bmod); nodes.push(idx, env, bidx, benv);
  }
  oscs.forEach(o => { o.start(t); o.stop(stop); }); done(oscs[1], [...oscs, ...nodes]);
}

// The 808: a sine that glides from the last note, driven for harmonics a phone
// can hear, swelling down to half level by its end.
export function sub808(ctx, out, t, midi, length, v = 1, {from, glide = .07, drive:amount = 1.7} = {}) {
  const f = mtof(midi), o = ctx.createOscillator(), sh = drive(ctx, amount), g = amp(ctx), end = t + length;
  if (from !== undefined && from !== midi) { o.frequency.setValueAtTime(mtof(from), t); o.frequency.exponentialRampToValueAtTime(f, t + glide); } else o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.setValueAtTime(v, t + .03);
  g.gain.exponentialRampToValueAtTime(v * .5, Math.max(t + .04, end - .03)); g.gain.linearRampToValueAtTime(0, end);
  chain(o, sh, g, out); o.start(t); o.stop(end + .01); done(o, [o, sh, g]);
}

// A round finger bass: a plucked, quickly darkening saw over a sine.
export function fingerBass(ctx, out, t, midi, length, v = 1) {
  const f = mtof(midi), saw = ctx.createOscillator(), sub = ctx.createOscillator(), lp = biquad(ctx, 'lowpass', 1400, 1.1), g = amp(ctx), sg = amp(ctx, .9), sw = amp(ctx, .45);
  saw.type = 'sawtooth'; saw.frequency.value = f; sub.frequency.value = f;
  lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(300, t + .2);
  const end = t + length;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(v * .6, Math.max(t + .02, Math.min(end - .04, t + .35)));
  g.gain.setValueAtTime(v * .6, Math.max(t + .03, end - .04)); g.gain.linearRampToValueAtTime(0, end);
  saw.connect(sw); sw.connect(lp); lp.connect(g); sub.connect(sg); sg.connect(g); g.connect(out);
  [saw, sub].forEach(x => { x.start(t); x.stop(end + .01); }); done(saw, [saw, sub, lp, g, sg, sw]);
}

// The house organ: drawbar harmonics (16' 8' 4' 2 2/3' 2' and the 1 1/3')
// in one periodic wave, a percussive decay and a key click.
function organWave(ctx) {
  const s = store(ctx);
  if (!s.organ) s.organ = ctx.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, .78, .52, .6, 0, .34, 0, .3]));
  return s.organ;
}
export function organ(ctx, out, t, notes, length, v = 1, {level = .15, decay = .16, sustain = .32, width = .75} = {}) {
  const g = amp(ctx), lp = biquad(ctx, 'lowpass', 5600, .7), left = spread(ctx, -width), right = spread(ctx, width), oscs = [];
  left.connect(lp); right.connect(lp); lp.connect(g); g.connect(out);
  for (const m of notes) for (const cents of [-6, 6]) {
    const o = ctx.createOscillator(); o.setPeriodicWave(organWave(ctx)); o.frequency.value = mtof(m); o.detune.value = cents; o.connect(cents < 0 ? left : right); oscs.push(o);
  }
  const peak = v * level, end = t + Math.max(.03, length), d = Math.min(decay, (end - t) * .8);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .002); g.gain.exponentialRampToValueAtTime(peak * sustain, t + d);
  g.gain.setValueAtTime(peak * sustain, Math.max(t + d, end - .02)); g.gain.linearRampToValueAtTime(0, end);
  oscs.forEach(o => { o.start(t); o.stop(end + .01); }); done(oscs[0], [...oscs, left, right, lp, g]);
  const n = noise(ctx, t, .008), hp = biquad(ctx, 'highpass', 2600), ng = amp(ctx);
  ng.gain.setValueAtTime(peak * 1.4, t); ng.gain.exponentialRampToValueAtTime(.0005, t + .006);
  chain(n, hp, ng, out); done(n, [n, hp, ng]);
}

// Speed-garage bass: two detuned saws through a resonant low-pass that snaps
// shut on every note, driven, over a clean sine sub.
export function reese(ctx, out, t, midi, length, v = 1, {cutoff = 480, open = 3.2, q = 3, sub = .9, detune = 15, drive:amount = 2.4} = {}) {
  const f = mtof(midi), a = ctx.createOscillator(), b = ctx.createOscillator(), s = ctx.createOscillator();
  a.type = b.type = 'sawtooth'; a.frequency.value = b.frequency.value = s.frequency.value = f; a.detune.value = -detune; b.detune.value = detune;
  const mix = amp(ctx, .42), lp = biquad(ctx, 'lowpass', cutoff, q), sh = drive(ctx, amount), g = amp(ctx), sg = amp(ctx, sub), end = t + length;
  lp.frequency.setValueAtTime(cutoff * open, t); lp.frequency.exponentialRampToValueAtTime(cutoff, t + Math.min(.14, length));
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.setValueAtTime(v, Math.max(t + .005, end - .02)); g.gain.linearRampToValueAtTime(0, end);
  a.connect(mix); b.connect(mix); mix.connect(lp); lp.connect(sh); sh.connect(g); s.connect(sg); sg.connect(g); g.connect(out);
  [a, b, s].forEach(o => { o.start(t); o.stop(end + .01); }); done(a, [a, b, s, mix, lp, sh, g, sg]);
}

// A clean guitar: Karplus-Strong with a bright pick and a long ring, strummed.
function cleanBuffer(ctx, midi) {
  const s = store(ctx), key = 'clean' + midi;
  if (s[key]) return s[key];
  const sr = ctx.sampleRate, period = Math.max(2, Math.round(sr / mtof(midi))), b = ctx.createBuffer(1, Math.round(sr * 1.4), sr), d = b.getChannelData(0);
  let seed = midi * 104729 + 7, last = 0;
  for (let i = 0; i < period; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed / 2147483648 - 1; last = last * .2 + x * .8; d[i] = last; }
  for (let i = period; i < d.length; i++) d[i] = .4993 * (d[i - period] + d[i - period - 1 >= 0 ? i - period - 1 : 0]);
  return s[key] = b;
}
export function cleanGuitar(ctx, out, t, notes, v = 1, {strum = .014, ring = .9} = {}) {
  const lp = biquad(ctx, 'lowpass', 4200, .7), hp = biquad(ctx, 'highpass', 160), g = amp(ctx);
  g.gain.setValueAtTime(v * .5, t); g.gain.setValueAtTime(v * .5, t + ring * .6); g.gain.linearRampToValueAtTime(0, t + ring);
  hp.connect(lp); lp.connect(g); g.connect(out);
  let first;
  notes.forEach((m, i) => { const s = ctx.createBufferSource(); s.buffer = cleanBuffer(ctx, m); s.connect(hp); s.start(t + i * strum); s.stop(t + ring + .02); first ??= s; });
  done(first, [hp, lp, g]);
}

// ---- Offsite voices ------------------------------------------------------
// Hands, floors, the office as loop material, and voices. All synthesized:
// no samples. (The office sounds follow the meeting room's own recipes,
// src/audio.js office-key and office-printer, made deterministic.)

// A stomp: a foot on a wooden floor. A low body falling to the key's root, the
// floorboard's dull knock, no click: a floor, not a kick drum. `heel`: how fast the
// knock speaks (seconds; a quicker heel lands its onset on the sample, softly).
export function stomp(ctx, out, t, v = 1, {top = 150, settle = 73.42, decay = .34, thud = .55, heel = .002} = {}) {
  const o = ctx.createOscillator(), g = amp(ctx), sh = drive(ctx, 1.4);
  o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(settle * 1.18, t + .035); o.frequency.exponentialRampToValueAtTime(settle, t + .14);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004);
  g.gain.exponentialRampToValueAtTime(v * .32, t + .09); g.gain.exponentialRampToValueAtTime(.0008, t + decay);
  chain(o, sh, g, out); o.start(t); o.stop(t + decay + .02); done(o, [o, sh, g]);
  const n = noise(ctx, t, .1), lp = biquad(ctx, 'lowpass', 1100, .7), pk = biquad(ctx, 'peaking', 240, 1.3, 7), ng = amp(ctx);
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(thud * v, t + heel); ng.gain.exponentialRampToValueAtTime(.001, t + .085);
  chain(n, lp, pk, ng, out); done(n, [n, lp, pk, ng]);
}

// A floor tom, tuned: a sine body that settles on its note, a triangle overtone and the skin.
export function floorTom(ctx, out, t, midi, v = 1, {decay = .5, side = 0} = {}) {
  const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = amp(ctx), g2 = amp(ctx, .28), p = spread(ctx, side);
  o.frequency.setValueAtTime(f * 1.45, t); o.frequency.exponentialRampToValueAtTime(f, t + .07);
  o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2.3, t); o2.frequency.exponentialRampToValueAtTime(f * 1.58, t + .06);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .003);
  g.gain.exponentialRampToValueAtTime(v * .38, t + .13); g.gain.exponentialRampToValueAtTime(.0008, t + decay);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(p); p.connect(out);
  [o, o2].forEach(x => { x.start(t); x.stop(t + decay + .02); }); done(o, [o, o2, g, g2, p]);
  const n = noise(ctx, t, .06), bp = biquad(ctx, 'bandpass', 1300, .9), ng = amp(ctx);
  ng.gain.setValueAtTime(v * .22, t); ng.gain.exponentialRampToValueAtTime(.001, t + .05);
  chain(n, bp, ng, out); done(n, [n, bp, ng]);
}

// Claps by a room of people: each a little early or late, each hand its own pitch, spread wide.
const CLAPPERS = [[0, -.62, 1120], [.006, .5, 1460], [.013, -.18, 980], [.021, .72, 1720], [.009, .08, 1270], [.017, -.42, 1560]];
export function gangClap(ctx, out, t, v = 1, {people = 4, width = 1} = {}) {
  const level = v / Math.sqrt(people) * .95;
  for (const [off, side, centre] of CLAPPERS.slice(0, people)) {
    const a = t + off, n = noise(ctx, a, .14), hp = biquad(ctx, 'highpass', 520), bp = biquad(ctx, 'bandpass', centre, 1.15), g = amp(ctx), p = spread(ctx, side * width);
    g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(level, a + .0008); g.gain.exponentialRampToValueAtTime(level * .14, a + .007);
    g.gain.setValueAtTime(level * .8, a + .0095); g.gain.exponentialRampToValueAtTime(.001, a + .12);
    chain(n, hp, bp, g, p, out); done(n, [n, hp, bp, g, p]);
  }
}

// The keyboard: a keycap's click and the low thock of it bottoming out. k varies the key.
export function keyClick(ctx, out, t, v = .3, k = 0) {
  const i = ((k % 5) + 5) % 5, n = noise(ctx, t, .03), bp = biquad(ctx, 'bandpass', [2600, 3400, 2900, 4100, 3150][i], 2.2), g = amp(ctx), p = spread(ctx, [-.3, .22, -.08, .36, .05][i]);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .018);
  chain(n, bp, g, p, out); done(n, [n, bp, g, p]);
  const o = ctx.createOscillator(), og = amp(ctx);
  o.frequency.setValueAtTime(180 + 25 * (i % 3), t); og.gain.setValueAtTime(v * .45, t); og.gain.exponentialRampToValueAtTime(.001, t + .024);
  chain(o, og, p); o.start(t); o.stop(t + .03); done(o, [o, og]);
}

// A mug set down on a desk: a ceramic tink, inharmonic partials on a note of the key.
export function mug(ctx, out, t, midi, v = .3, side = .3) {
  const f = mtof(midi), g = amp(ctx, v), hp = biquad(ctx, 'highpass', 500), p = spread(ctx, side), oscs = [], nodes = [g, hp, p];
  hp.connect(g); g.connect(p); p.connect(out);
  for (const [ratio, level, decay] of [[1, 1, .42], [2.71, .45, .2], [5.33, .24, .1], [8.93, .1, .05]]) {
    const o = ctx.createOscillator(), e = amp(ctx);
    o.frequency.value = f * ratio; e.gain.setValueAtTime(level, t); e.gain.exponentialRampToValueAtTime(.0001, t + decay);
    o.connect(e); e.connect(hp); o.start(t); o.stop(t + decay + .02); oscs.push(o); nodes.push(e);
  }
  done(oscs[0], [...oscs, ...nodes]);
  const n = noise(ctx, t, .01), nh = biquad(ctx, 'highpass', 5200), ng = amp(ctx);
  ng.gain.setValueAtTime(v * .35, t); ng.gain.exponentialRampToValueAtTime(.001, t + .006);
  chain(n, nh, ng, p); done(n, [n, nh, ng]);
}

// An office chair leaned back in: stick-slip friction, a pulse train whose rate
// rises and falls, through the resonance of the seat.
export function creak(ctx, out, t, length, v = .12, {from = 16, to = 38, tone = 1250, side = -.4} = {}) {
  const o = ctx.createOscillator(), hp = biquad(ctx, 'highpass', 380), bp = biquad(ctx, 'bandpass', tone, 7), bp2 = biquad(ctx, 'bandpass', tone * 1.93, 9), g2 = amp(ctx, .5), g = amp(ctx), p = spread(ctx, side);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + length * .65); o.frequency.exponentialRampToValueAtTime(from * 1.25, t + length);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(.08, length * .3));
  g.gain.setValueAtTime(v, t + length * .8); g.gain.linearRampToValueAtTime(0, t + length);
  o.connect(hp); hp.connect(bp); bp.connect(g); hp.connect(bp2); bp2.connect(g2); g2.connect(g); g.connect(p); p.connect(out);
  o.start(t); o.stop(t + length + .01); done(o, [o, hp, bp, bp2, g2, g, p]);
}

// The room itself: low air and the building's hum, under the muted call.
export function roomTone(ctx, out, t, length, v = .02) {
  const n = noise(ctx, t, length), lp = biquad(ctx, 'lowpass', 520, .5), pk = biquad(ctx, 'peaking', 118, 1.2, 8), g = amp(ctx), fade = Math.min(.4, length / 3);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + fade); g.gain.setValueAtTime(v, t + length - fade); g.gain.linearRampToValueAtTime(0, t + length);
  chain(n, lp, pk, g, out); done(n, [n, lp, pk, g]);
}

// The printer feeding a sheet: its motor whirring up, three ticks of paper.
export function printerFeed(ctx, out, t, v = .2) {
  const o = ctx.createOscillator(), bp = biquad(ctx, 'bandpass', 650, 1.5), g = amp(ctx), p = spread(ctx, .45);
  o.type = 'sawtooth'; o.frequency.setValueAtTime(105, t); o.frequency.linearRampToValueAtTime(175, t + .4);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .67);
  o.connect(bp); bp.connect(g); g.connect(p); p.connect(out); o.start(t); o.stop(t + .7); done(o, [o, bp, g, p]);
  for (const off of [0, .16, .32]) {
    const n = noise(ctx, t + off, .08), hp = biquad(ctx, 'highpass', 1600), ng = amp(ctx);
    ng.gain.setValueAtTime(.0001, t + off); ng.gain.exponentialRampToValueAtTime(v * .55, t + off + .001); ng.gain.exponentialRampToValueAtTime(.0001, t + off + .06);
    chain(n, hp, ng, p); done(n, [n, hp, ng]);
  }
}

// Voices without words: per note two detuned saws through a bank of vowel
// formants, a vibrato that blooms in, and a slow tape wow on the whole chord
// (the loop's own wobble; the master's wow stays an event). `glide` (semitones)
// slides every voice up across the note: the build's rising choir.
const VOWELS = {ah:[[730, 6, 1], [1090, 8, .55], [2440, 12, .22]], oo:[[320, 6, 1], [870, 8, .3], [2240, 12, .08]], eh:[[530, 6, 1], [1840, 10, .42], [2480, 12, .2]]};
// (Vibrato and wow are mixed before they reach a detune: a param sums its own
// value and its inputs in an order that changes from run to run, so one input
// each keeps the render exact, as exact.js keeps every node input to two.)
export function voicePad(ctx, out, t, notes, length, v = 1, {vowel = 'ah', attack = .35, release = .7, wow = 6, vibrato = 9, glide = 0, level = .085} = {}) {
  const end = t + length, g = amp(ctx), vib = ctx.createOscillator(), vibAmt = amp(ctx), wo = ctx.createOscillator(), wowAmt = amp(ctx, wow), mod = amp(ctx, 1), nodes = [g, vibAmt, wowAmt, mod], oscs = [vib, wo];
  vib.frequency.value = 5.1; vib.connect(vibAmt); wo.frequency.value = .55; wo.connect(wowAmt); vibAmt.connect(mod); wowAmt.connect(mod);
  vibAmt.gain.setValueAtTime(0, t); vibAmt.gain.linearRampToValueAtTime(vibrato, t + Math.min(.9, length * .6));
  const sides = [-.6, .6].map(side => {
    const bus = amp(ctx, 1), p = spread(ctx, side); nodes.push(bus, p); p.connect(g);
    for (const [f, q, l] of VOWELS[vowel]) { const b = biquad(ctx, 'bandpass', f, q), a = amp(ctx, l); bus.connect(b); b.connect(a); a.connect(p); nodes.push(b, a); }
    return bus;
  });
  notes.forEach((m, i) => [-8, 8].forEach((cents, k) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = cents + (i % 2 ? 3 : -3);
    o.frequency.setValueAtTime(mtof(m), t); if (glide) o.frequency.exponentialRampToValueAtTime(mtof(m + glide), end);
    mod.connect(o.detune); o.connect(sides[k]); oscs.push(o);
  }));
  const peak = v * level;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(attack, length * .8));
  g.gain.setValueAtTime(peak, Math.max(t + Math.min(attack, length * .8), end - .05)); g.gain.linearRampToValueAtTime(0, end + release);
  g.connect(out);
  oscs.forEach(o => { o.start(t); o.stop(end + release + .02); }); done(oscs[2], [...oscs, ...nodes]);
}

// A pump organ: reedy, slow to speak, breathing on its bellows (a tremolo stage).
function reedWave(ctx) {
  const s = store(ctx);
  if (!s.reed) s.reed = ctx.createPeriodicWave(new Float32Array(12), new Float32Array([0, 1, .72, .86, .44, .58, .3, .36, .2, .22, .12, .1]));
  return s.reed;
}
export function harmonium(ctx, out, t, notes, length, v = 1, {level = .045, attack = .14, release = .3, trem = 5.3, depth = .16} = {}) {
  const end = t + length, g = amp(ctx), trm = amp(ctx, 1), lfo = ctx.createOscillator(), lfoAmt = amp(ctx, depth), lp = biquad(ctx, 'lowpass', 3400, .7), oscs = [lfo];
  lfo.frequency.value = trem; lfo.connect(lfoAmt); lfoAmt.connect(trm.gain);
  for (const m of notes) for (const cents of [-4, 4]) { const o = ctx.createOscillator(); o.setPeriodicWave(reedWave(ctx)); o.frequency.value = mtof(m); o.detune.value = cents; o.connect(g); oscs.push(o); }
  const peak = v * level;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(attack, length * .7));
  g.gain.setValueAtTime(peak, Math.max(t + Math.min(attack, length * .7), end - .02)); g.gain.linearRampToValueAtTime(0, end + release);
  g.connect(trm); trm.connect(lp); lp.connect(out);
  oscs.forEach(o => { o.start(t); o.stop(end + release + .02); }); done(oscs[1], [...oscs, g, trm, lfoAmt, lp]);
}

// Pat, humming: a sine and a soft octave, warm and round, no attack to speak of.
export function humBass(ctx, out, t, midi, length, v = 1) {
  const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = amp(ctx, .22), lp = biquad(ctx, 'lowpass', 700, .7), sh = drive(ctx, 1.3), g = amp(ctx), end = t + length;
  o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .03); g.gain.exponentialRampToValueAtTime(v * .7, Math.max(t + .04, Math.min(end - .05, t + .45)));
  g.gain.setValueAtTime(v * .7, Math.max(t + .05, end - .05)); g.gain.linearRampToValueAtTime(0, end);
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(sh); sh.connect(g); g.connect(out);
  [o, o2].forEach(x => { x.start(t); x.stop(end + .01); }); done(o, [o, o2, g2, lp, sh, g]);
}

// A long, slowly blooming space for voices: stereo noise that swells over
// `bloom` seconds and falls 60 dB over `seconds`, darkening as it goes.
export function washImpulse(ctx, seconds = 5, bloom = .12, seed = 7) {
  const s = store(ctx), key = `wash${seconds}:${bloom}:${seed}`;
  if (s[key]) return s[key];
  const sr = ctx.sampleRate, length = Math.round(sr * seconds), b = ctx.createBuffer(2, length, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let x = seed * 7919 + c * 104729, smooth = 0;
    for (let i = 0; i < length; i++) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      const u = i / sr, p = i / length;
      smooth += ((x / 2147483648 - 1) - smooth) * (.75 - p * .6);
      d[i] = smooth * (1 - Math.exp(-u / (bloom / 3))) * Math.exp(-6.9 * u / seconds) * .5;
    }
  }
  return s[key] = b;
}

// ---- The tambourine ------------------------------------------------------
// A wooden frame with six pairs of metal jingles and a calfskin head, modal
// synthesis, no samples (src/allhands/voices/README.md, "The tambourine").
//
// Each jingle is a thin dished disc: seven damped resonators at inharmonic
// ratios (1, 1.43, 1.79, 2.28, 2.71, 3.2, 3.83) from a base between 2.6 and
// 4.4 kHz, so its partials run from about 2.6 to 17 kHz and ring 80 ms (the
// lowest) to 40 ms. The two discs of a pair sit 0.4 to 1.1% apart, so every
// pair beats. A collision is three things: both discs struck, each partial by
// its own amount (where the discs met, and how flat: no two collisions ring the
// same way); the metal-on-metal "chk", a 2 to 6 ms burst of noise through a
// resonance between 1.1 and 2.9 kHz, a new one each collision; and a knock into
// the frame, whose five wooden modes (420 Hz to 2.4 kHz) fill the 1 to 3 kHz body
// a real tambourine has and a bank of jingles alone does not.
//   shake  the wrist: every pair collides 2 to 8 times over 40 to 90 ms, bunched a
//          third of the way in, under a swish of 5-11 kHz noise (jingles on pins).
//   hit    the palm on the head: the membrane (95, 190, 310 Hz), a hard knock into
//          the frame, every pair at once within 3 ms, then a rattle over 80 ms.
// Every strike is rendered once per context (12 per kind and velocity layer, each
// with its own collisions and the whole set drifting by up to 7 cents: jingles
// turn on their pins), and played a few cents off again, chosen by its time:
// two strikes never ring the same tones. Deterministic: the same time, kind and
// velocity give the same samples in every render.
const TAMB_RATIOS = [1, 1.43, 1.79, 2.28, 2.71, 3.2, 3.83];
const TAMB_WOOD = [[420, .03, .12], [690, .024, .25], [1130, .02, .8], [1710, .015, .9], [2380, .011, .7]];   // Hz, decay (s), level
const TAMB_LAYERS = {shake:[.35, .65, 1], hit:[.6, 1]};
const TAMB_VARIANTS = 12;
const TAMB_LEVEL = .68;
const lcg = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const mix32 = h => { h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };

// The instrument itself: the same tambourine every time (its jingles' tuning).
function tambourineModel(sampleRate, seed = 11) {
  const R = lcg(seed * 2654435761), pairs = 6;
  return Array.from({length:pairs}, (_, p) => {
    const base = 2600 + 1800 * (p + R() * .8) / pairs, detune = .004 + .007 * R();
    return [1 - detune / 2, 1 + detune / 2].map(k => TAMB_RATIOS.map((ratio, m) => {
      const f = base * k * ratio * (1 + .012 * (R() - .5));
      return f > sampleRate * .45 ? null : {f, tau:.08 * ratio ** -.45 * (.8 + .4 * R()), gain:(.6 + .4 * R()) * ratio ** -.6, ratio, m};
    }).filter(Boolean));
  });
}

// One damped resonator (a sine that decays by tau), excited by `e`, added into `y`.
function ring(y, e, sr, f, tau, gain) {
  const r = Math.exp(-1 / (tau * sr)), c = 2 * r * Math.cos(2 * Math.PI * f / sr), r2 = r * r, g = gain * Math.sin(2 * Math.PI * f / sr);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < y.length; i++) { const v = c * y1 - r2 * y2 + e[i]; y2 = y1; y1 = v; y[i] += g * v; }
}
// A band-pass of a short noise burst (RBJ, constant skirt), added into y at i0.
function chk(y, R, i0, sr, f, q, length, a) {
  const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0, L = Math.round(length * sr), tail = Math.round(.012 * sr);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let j = 0; j < L + tail && i0 + j < y.length; j++) {
    const x = j < L ? (R() * 2 - 1) * (1 - j / L) ** 2 : 0, v = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = v;
    if (i0 + j >= 0) y[i0 + j] += a * v;
  }
}

// One strike as samples (mono, at sampleRate): kind 'shake' | 'hit', at velocity v
// (0..1, brighter and busier as it rises), variant k. Pure: Node renders it too.
export function tambourineSamples(sampleRate, {kind = 'shake', v = .65, k = 0, seed = 11} = {}) {
  const sr = sampleRate, set = tambourineModel(sr, seed), R = lcg(mix32(seed * 7919 + (kind === 'hit' ? 104729 : 0) + Math.round(v * 100) * 31 + k * 977));
  const n = Math.round((kind === 'hit' ? .3 : .22) * sr), drift = 1 + .004 * (R() - .5);
  const collisions = [];                                 // [pair, time (s), amplitude]
  if (kind === 'hit') {
    set.forEach((_, p) => collisions.push([p, .003 * R(), v * (.8 + .2 * R())]));
    set.forEach((_, p) => {
      const c = 3 + Math.floor(4 * R());
      for (let j = 0; j < c; j++) { const dt = .008 + .075 * R() ** 1.6; collisions.push([p, dt, v * .45 * (1 - dt / .09) * (.5 + .5 * R())]); }
    });
  } else {
    const D = .04 + .05 * R() * (.5 + v / 2);
    set.forEach((_, p) => {
      const c = 2 + Math.floor((3 + 6 * v) * R());
      for (let j = 0; j < c; j++) { const u = (R() + R() + R()) / 3 * .9; collisions.push([p, .002 + D * u * u * 1.6, v * (.25 + .75 * R()) * .6]); }
    });
  }
  const y = new Float32Array(n), e = new Float32Array(n), wood = new Float32Array(n);
  // the jingles: each partial excited by every collision of its pair, each by its own amount
  set.forEach((discs, p) => {
    const mine = collisions.filter(c => c[0] === p), pairDrift = drift * (1 + .002 * (R() - .5));
    for (const modes of discs) for (const mode of modes) {
      e.fill(0);
      for (const [, t, a] of mine) {
        const i = Math.round(t * sr);
        if (i < 0 || i + 2 >= n) continue;
        const w = a * (.25 + .75 * R()) ** 1.5 * (R() < .5 ? -1 : 1);              // where they met, how flat
        e[i] += w; e[i + 1] -= .6 * w; e[i + 2] += .25 * w;
      }
      ring(y, e, sr, mode.f * pairDrift, mode.tau, .16 * mode.gain * mode.ratio ** (-.45 * (1 - v)));
    }
  });
  // the chk of metal on metal, and the knock each collision gives the frame
  for (const [, t, a] of collisions) {
    const i = Math.round(t * sr);
    chk(y, R, i, sr, 1100 + 1800 * R(), 1.6 + R(), .002 + .004 * R(), .04 * a);
    if (i >= 0 && i < n) wood[i] += .035 * a * (R() < .5 ? -1 : 1);
  }
  if (kind === 'hit') {
    wood[0] += .3 * v;
    for (const [f, tau, g] of [[190, .045, .22], [310, .03, .14], [95, .06, .1]])      // the head
      for (let j = 0; j < Math.min(n, Math.round(tau * 6 * sr)); j++) y[j] += v * g * Math.exp(-j / (tau * sr)) * Math.sin(2 * Math.PI * f * j / sr) * Math.min(1, j / 20);
  } else {
    wood[0] += .05 * v;                                  // the hand's grip as the wrist turns
    const L = Math.round((.05 + .04 * v) * 1.3 * sr), aLo = Math.exp(-2 * Math.PI * 11000 / sr), aHi = Math.exp(-2 * Math.PI * 5000 / sr);
    let lo = 0, hi = 0;
    for (let j = 0; j < L && j < n; j++) {                 // the swish: noise between two one-poles, under a sine envelope
      const w = R() * 2 - 1;
      lo = (1 - aLo) * w + aLo * lo; hi = (1 - aHi) * w + aHi * hi;
      y[j] += .05 * v * (lo - hi) * Math.sin(Math.PI * j / L) ** 2;
    }
  }
  for (const [f, tau, g] of TAMB_WOOD) ring(y, wood, sr, f * (1 + .01 * (R() - .5)), tau, .5 * g);
  // a 2 ms fade at the end, then the instrument's level
  const F = Math.round(.002 * sr);
  for (let j = 0; j < F; j++) y[n - 1 - j] *= j / F;
  for (let i = 0; i < n; i++) y[i] *= TAMB_LEVEL;
  return y;
}

// Which rendered strike a strike at time t plays, and how: its velocity layer,
// variant, playback rate (a few cents off) and gain. Shared by the Web Audio
// voice and the offline renderer, so both choose the same strikes.
export function tambourineStrike(t, v = .5, kind = 'shake') {
  const layers = TAMB_LAYERS[kind] || TAMB_LAYERS.shake, found = layers.findIndex(x => v <= x + 1e-9), L = found < 0 ? layers.length - 1 : found;
  const h = mix32(Math.round(t * 2000) * 2654435761 + (kind === 'hit' ? 1 : 0));
  return {kind, layer:L, v:layers[L], k:h % TAMB_VARIANTS, rate:2 ** ((((h >>> 8) % 1001) / 1000 - .5) * 12 / 1200), gain:v / layers[L]};
}

function tambourineBuffer(ctx, s) {
  const st = store(ctx), key = `tamb:${s.kind}:${s.layer}:${s.k}`;
  if (st[key]) return st[key];
  const y = tambourineSamples(ctx.sampleRate, {kind:s.kind, v:s.v, k:s.k}), b = ctx.createBuffer(1, y.length, ctx.sampleRate);
  b.getChannelData(0).set(y);
  return st[key] = b;
}

// The tambourine, for a track: a shake (the 16ths) or a hit (the accent), at
// velocity v, panned `side` (it sits in the background, a little right). At v 1
// a shake peaks near -9 dBFS and a hit near -4 dBFS before the bus.
export function tambourine(ctx, out, t, v = .5, {kind = 'shake', side = .35} = {}) {
  const s = tambourineStrike(t, v, kind), src = ctx.createBufferSource(), g = amp(ctx, s.gain), p = spread(ctx, side);
  src.buffer = tambourineBuffer(ctx, s); src.playbackRate.value = s.rate;
  chain(src, g, p, out); src.start(t); src.stop(t + src.buffer.duration / s.rate + .005); done(src, [src, g, p]);
}

// The same strikes rendered offline into a mono Float32Array (measurements,
// sketches): events [{t, v, kind}]. Linear interpolation plays the off-rate.
export function renderTambourine(events, duration, {sampleRate = 44100} = {}) {
  const sr = sampleRate, y = new Float32Array(Math.ceil(duration * sr)), cache = new Map();
  for (const ev of events) {
    const s = tambourineStrike(ev.t, ev.v ?? .5, ev.kind ?? ev.type ?? 'shake'), key = `${s.kind}:${s.layer}:${s.k}`;
    if (!cache.has(key)) cache.set(key, tambourineSamples(sr, {kind:s.kind, v:s.v, k:s.k}));
    const x = cache.get(key), o = ev.t * sr;
    for (let i = Math.max(0, Math.ceil(o)); i < y.length; i++) {
      const p = (i - o) * s.rate, i0 = Math.floor(p);
      if (i0 + 1 >= x.length) break;
      y[i] += s.gain * (x[i0] + (x[i0 + 1] - x[i0]) * (p - i0));
    }
  }
  return y;
}

// A groove for a track to place: per 16th, a shake at shakes[s % 4] (0 = none),
// leaning on the "and"; `hits` are 16ths of the bar struck instead (on bars where
// bar % every === every - 1). Timing breathes by up to `humanize` seconds, seeded.
export function tambourinePattern({bars, step, swing = 0, shakes = [.32, .16, .78, .26], hits = [], humanize = .004, seed = 3, every = 1, from = 0}) {
  const R = lcg(seed * 40503 + 1), events = [];
  for (let s = 0; s < bars * 16; s++) {
    const t = from + s * step + (s % 2 ? swing * step : 0) + (R() - .5) * 2 * humanize;
    if (hits.includes(s % 16) && Math.floor(s / 16) % every === every - 1) events.push({t:Math.max(0, t), kind:'hit', v:.8});
    else {
      const v = shakes[s % shakes.length], j = R();
      if (v > 0) events.push({t:Math.max(0, t), kind:'shake', v:v * (.88 + .24 * j)});
    }
  }
  return events;
}

// ---- Delve's instruments (songbook/delve.js) ----------------------------------
// The struck ones (a hand drum, a slit drum, glass chimes) are modal synthesis
// rendered once per context as samples, seeded: the same note, stroke and
// variant ring the same in every render. Which variant plays is chosen by the
// time, so no two strikes in a row ring alike. Three synths make the smooth
// side: Synergy's whole-note pad, Pat's warm bass, Synthia's soft arpeggio.
const STRUCK = new WeakMap();
function struckBuffer(ctx, key, make) {
  let s = STRUCK.get(ctx);
  if (!s) STRUCK.set(ctx, s = new Map());
  if (!s.has(key)) { const y = make(ctx.sampleRate), b = ctx.createBuffer(1, y.length, ctx.sampleRate); b.getChannelData(0).set(y); s.set(key, b); }
  return s.get(key);
}
function playStruck(ctx, out, t, buffer, gain, side) {
  const src = ctx.createBufferSource(), g = amp(ctx, gain), p = spread(ctx, side);
  src.buffer = buffer;
  chain(src, g, p, out); src.start(t); src.stop(t + buffer.duration + .005); done(src, [src, g, p]);
}
const variantAt = (t, midi, n = 3) => mix32(Math.round(t * 1000) * 2654435761 + midi * 7) % n;
// Damped modes as samples: [ratio, level, decay (s)] from f0, each with its own bend (the skin
// relaxing: `bend` of the pitch, settling over `settle` seconds).
function modes(sr, f0, list, seconds, R, {bend = 0, settle = .03} = {}) {
  const n = Math.round(seconds * sr), y = new Float32Array(n);
  for (const [ratio, level, tau] of list) {
    const f = f0 * ratio * (1 + .003 * (R() - .5));
    if (f > sr * .45) continue;
    let ph = R() * 6.283;
    const dec = Math.exp(-1 / (tau * sr));
    let e = level;
    for (let i = 0; i < n; i++) {
      ph += 2 * Math.PI * f * (1 + bend * Math.exp(-i / (settle * sr))) / sr;
      y[i] += e * Math.sin(ph); e *= dec;
    }
  }
  return y;
}
const fadeEdges = (y, sr, attack = .0008, release = .006) => {
  const A = Math.max(1, Math.round(attack * sr)), Rl = Math.round(release * sr);
  for (let i = 0; i < A; i++) y[i] *= i / A;
  for (let i = 0; i < Rl && i < y.length; i++) y[y.length - 1 - i] *= i / Rl;
  return y;
};

// The hand drum: a conga-like skin on a note, the modes of a circular membrane
// (1, 1.59, 2.14, 2.30, 2.65, 2.92) settling a few percent as the skin relaxes,
// and the hand: open (the skin rings), slap (brighter, shorter, a crack of the
// fingers), bass (the palm in the centre, low and round), mute (held down: a knock).
const SKIN = [1, 1.594, 2.136, 2.296, 2.653, 2.918];
const STROKES = Object.freeze({
  open:{tau:.24, bright:.8, crack:.14, bend:.05, f:1, level:1},
  slap:{tau:.07, bright:1.15, crack:.95, bend:.08, f:1, level:.6},
  bass:{tau:.18, bright:.2, crack:.03, bend:.14, f:.6, level:.85},
  mute:{tau:.04, bright:.6, crack:.3, bend:.03, f:1, level:.7},
});
export function handDrumSamples(sr, midi, stroke = 'open', k = 0) {
  const S = STROKES[stroke] || STROKES.open, R = lcg(mix32(midi * 977 + k * 131 + Object.keys(STROKES).indexOf(stroke) * 7919 + 5));
  const list = SKIN.map((ratio, m) => [ratio, (m ? .55 * S.bright ** (.6 + .4 * m) : 1) * S.level, S.tau / (1 + .6 * m)]);
  const y = modes(sr, mtof(midi) * S.f, list, S.tau * 4 + .04, R, {bend:S.bend, settle:.022});
  // the fingers on the skin: a crack of high-passed noise, 3 to 12 ms, ringing a little in the shell (2-4 kHz)
  const L = Math.round((.003 + .009 * S.crack) * sr), w = 2 * Math.PI * 2900 / sr, rr = .985, c1 = 2 * rr * Math.cos(w);
  let lp = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < L + Math.round(.02 * sr) && i < y.length; i++) {
    const x = i < L ? (R() * 2 - 1) * (1 - i / L) ** 2 : 0; lp += .3 * (x - lp);
    const hp = x - lp, o = hp + c1 * b1 - rr * rr * b2; b2 = b1; b1 = o;
    y[i] += S.crack * (1.4 * hp + .08 * o);
  }
  for (let i = 0; i < y.length; i++) y[i] *= .3;
  return fadeEdges(y, sr);
}
export function handDrum(ctx, out, t, midi, v = .5, {stroke = 'open', side = 0} = {}) {
  const k = variantAt(t, midi);
  playStruck(ctx, out, t, struckBuffer(ctx, `hand:${midi}:${stroke}:${k}`, sr => handDrumSamples(sr, midi, stroke, k)), v, side);
}

// The log drum: a slit drum's tongue, tuned to a note of the pentatonic. Mostly
// its fundamental, a hollow partial near 2.3x and a faint 4x, a woody knock at
// the strike, a short ring (low notes ring longer): the grid in wood.
export function logDrumSamples(sr, midi, k = 0) {
  const f0 = mtof(midi), R = lcg(mix32(midi * 3301 + k * 17 + 9)), tau = .2 * Math.min(1.6, Math.max(.6, 160 / f0));
  const y = modes(sr, f0, [[1, 1, tau], [2.31, .34, tau * .35], [3.98, .12, tau * .18], [6.2, .05, .02]], tau * 5 + .02, R, {bend:.012, settle:.012});
  let lp = 0;
  const L = Math.round(.005 * sr);
  for (let i = 0; i < L; i++) { const x = R() * 2 - 1; lp += .18 * (x - lp); y[i] += .35 * lp * (1 - i / L); }
  for (let i = 0; i < y.length; i++) y[i] *= .32;
  return fadeEdges(y, sr);
}
export function logDrum(ctx, out, t, midi, v = .5, {side = 0} = {}) {
  const k = variantAt(t, midi);
  playStruck(ctx, out, t, struckBuffer(ctx, `log:${midi}:${k}`, sr => logDrumSamples(sr, midi, k)), v, side);
}

// A chime, the stars: a small glass bell, inharmonic (1, 2.76, 5.40, 8.93,
// 13.3), each partial a slightly detuned pair that beats as it rings, about 3 s,
// a glassy tick at the strike, then lightly pixelated (the hold and the crush of
// the pixel voice, so the stars glint like the board's pegs).
const GLASS = [[1, 1, 3.1], [2.756, .38, 1.5], [5.404, .2, .7], [8.933, .09, .35], [13.34, .04, .16]];
export function chimeSamples(sr, midi, k = 0, {amount = .28} = {}) {
  const f0 = mtof(midi), R = lcg(mix32(midi * 7919 + k * 101 + 3)), list = [];
  for (const [ratio, level, tau] of GLASS) for (const d of [-1, 1]) list.push([ratio * (1 + d * .0011 * (1 + R())), level * .5, tau * (.85 + .3 * R())]);
  let y = modes(sr, f0, list, 3.4, R);
  const L = Math.round(.0015 * sr);
  for (let i = 0; i < L; i++) y[i] += .25 * (R() * 2 - 1) * (1 - i / L);
  for (let i = 0; i < y.length; i++) y[i] *= .26;
  y = fadeEdges(y, sr, .0006, .2);
  if (amount > 0) { const P = pixelParams(amount); y = pixelCrush(pixelDecimate(y, sr, P.rate, {antialias:P.antialias}), P.bits, {block:P.block, sr}); }
  return y;
}
export function chime(ctx, out, t, midi, v = .5, {side = 0, amount = .28} = {}) {
  const k = variantAt(t, midi, 4);
  playStruck(ctx, out, t, struckBuffer(ctx, `chime:${midi}:${k}:${amount}`, sr => chimeSamples(sr, midi, k, {amount})), v, side);
}

// Synergy's smooth synth: per note two saws 7 cents apart, spread left and right,
// and a triangle in the middle, through one low-pass that breathes (a slow LFO
// on its cutoff). Whole notes, a little stiff: no glide, no vibrato.
export function warmPad(ctx, out, t, notes, length, v = 1, {cutoff = 1400, breathe = .13, depth = .45, attack = .9, release = 1.4, level = .042} = {}) {
  const end = t + length, g = amp(ctx), lp = biquad(ctx, 'lowpass', cutoff, .9), lfo = ctx.createOscillator(), lfoAmt = amp(ctx, cutoff * depth), oscs = [lfo], nodes = [g, lp, lfoAmt];
  lfo.frequency.value = breathe; lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
  notes.forEach((m, i) => {
    for (const [type, cents, side, l] of [['sawtooth', -7, -.6, .5], ['sawtooth', 7, .6, .5], ['triangle', 0, 0, .7]]) {
      const o = ctx.createOscillator(), a = amp(ctx, l), p = spread(ctx, side);
      o.type = type; o.frequency.value = mtof(m); o.detune.value = cents + (i % 2 ? 2 : -2);
      o.connect(a); a.connect(p); p.connect(g); oscs.push(o); nodes.push(a, p);
    }
  });
  const peak = v * level;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(attack, length * .7));
  g.gain.setValueAtTime(peak, Math.max(t + Math.min(attack, length * .7), end - .05)); g.gain.linearRampToValueAtTime(0, end + release);
  g.connect(lp); lp.connect(out);
  oscs.forEach(o => { o.start(t); o.stop(end + release + .02); }); done(oscs[1], [...oscs, ...nodes]);
}

// Pat, warm: a sine and a soft saw an octave up at -16 dB through a 500 Hz
// low-pass and a little drive; legato: a note may glide in from `from` (MIDI).
export function warmBass(ctx, out, t, midi, length, v = 1, {from = null, glide = .05, cutoff = 500} = {}) {
  const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = amp(ctx, .16), lp = biquad(ctx, 'lowpass', cutoff, .7), sh = drive(ctx, 1.25), g = amp(ctx), end = t + length;
  o2.type = 'sawtooth';
  for (const [osc, k] of [[o, 1], [o2, 2]]) {
    if (from !== null) { osc.frequency.setValueAtTime(mtof(from) * k, t); osc.frequency.setTargetAtTime(f * k, t, glide / 3); }
    else osc.frequency.value = f * k;
  }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + (from !== null ? .012 : .025));
  g.gain.setValueAtTime(v, Math.max(t + .03, end - .04)); g.gain.linearRampToValueAtTime(0, end);
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(sh); sh.connect(g); g.connect(out);
  [o, o2].forEach(x => { x.start(t); x.stop(end + .01); }); done(o, [o, o2, g2, lp, sh, g]);
}

// Synthia's arpeggio: soft 16ths, a sine and a quiet saw through a low-pass that
// closes after each note, then a gentle crush (a 5-bit staircase, mixed under
// the clean note), fluent where Synergy is stiff.
function stairs(ctx) {
  const s = store(ctx);
  if (!s.stairs) { const c = new Float32Array(1024); for (let i = 0; i < c.length; i++) c[i] = Math.round((i / 511.5 - 1) * 16) / 16; s.stairs = c; }
  const w = ctx.createWaveShaper(); w.curve = s.stairs; return w;
}
export function seqArp(ctx, out, t, midi, length, v = .5, {cutoff = 2600, side = 0, crushMix = .3} = {}) {
  const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = amp(ctx, .22), lp = biquad(ctx, 'lowpass', cutoff * 1.8, .9), g = amp(ctx), sh = stairs(ctx), cr = amp(ctx, crushMix), clean = amp(ctx, 1 - crushMix), p = spread(ctx, side), end = t + length;
  o.frequency.value = f; o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 4;
  lp.frequency.setValueAtTime(cutoff * 1.8, t); lp.frequency.exponentialRampToValueAtTime(cutoff * .6, t + Math.min(.12, length));
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(v * .35, t + Math.max(.01, length * .8)); g.gain.linearRampToValueAtTime(0, end + .06);
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(clean); g.connect(sh); sh.connect(cr); clean.connect(p); cr.connect(p); p.connect(out);
  [o, o2].forEach(x => { x.start(t); x.stop(end + .08); }); done(o, [o, o2, g2, lp, g, sh, cr, clean, p]);
}
