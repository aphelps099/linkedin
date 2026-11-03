// The band, synthesized. Every voice takes any BaseAudioContext, so live
// playback and the offline render are the same code. No Math.random: noise is
// seeded and read from a time-derived offset, so two renders match exactly.

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
  const w = ctx.createWaveShaper(); w.curve = s[key]; return w;
}

export function kick(ctx, out, t, v = 1) {
  const o = ctx.createOscillator(), g = amp(ctx), sh = drive(ctx, 1.8);
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(60, t + .05);
  o.frequency.exponentialRampToValueAtTime(47, t + .3);
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
