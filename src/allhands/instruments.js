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
// floorboard's dull knock, no click: a floor, not a kick drum.
export function stomp(ctx, out, t, v = 1, {top = 150, settle = 73.42, decay = .34, thud = .55} = {}) {
  const o = ctx.createOscillator(), g = amp(ctx), sh = drive(ctx, 1.4);
  o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(settle * 1.18, t + .035); o.frequency.exponentialRampToValueAtTime(settle, t + .14);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004);
  g.gain.exponentialRampToValueAtTime(v * .32, t + .09); g.gain.exponentialRampToValueAtTime(.0008, t + decay);
  chain(o, sh, g, out); o.start(t); o.stop(t + decay + .02); done(o, [o, sh, g]);
  const n = noise(ctx, t, .1), lp = biquad(ctx, 'lowpass', 1100, .7), pk = biquad(ctx, 'peaking', 240, 1.3, 7), ng = amp(ctx);
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(thud * v, t + .002); ng.gain.exponentialRampToValueAtTime(.001, t + .085);
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
