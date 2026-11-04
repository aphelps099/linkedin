// The lady's recordings, loaded once, plus her deep voice: a phrase at half
// speed (an octave down), sent through a vocoder whose bands are shifted back
// up so the words stay legible, on a carrier that sits on the chord's root.
// Baked offline per event, so playback never runs a second live vocoder.
import {createVocoder} from './vocoder.js';
import {biquad, amp, mtof, noiseBuffer} from './instruments.js';

const files = new Map();

export async function loadLady(ctx, names, {base = '/phrases/', fetcher = fetch} = {}) {
  await Promise.all(names.filter(n => !files.has(n)).map(async name => {
    const response = await fetcher(base + name);
    if (!response.ok) throw Error(`The phrase ${name} could not be loaded.`);
    files.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
  }));
  return new Map(names.filter(n => files.has(n)).map(n => [n, files.get(n)]));
}

const baked = new Map();

export async function bakeDeep(buffer, from, to, root, {rate = .5, shift = 2} = {}) {
  const key = [buffer.length, from, to, root, rate, shift].join(':');
  if (baked.has(key)) return baked.get(key);
  const sr = 44100, seconds = (to - from) / rate + .4, ctx = new OfflineAudioContext(1, Math.ceil(seconds * sr), sr);
  const src = ctx.createBufferSource(); src.buffer = buffer; src.playbackRate.value = rate;
  const vocoder = createVocoder(ctx, {follow:35, shift, airLevel:.35});
  const voc = amp(ctx, .75), tape = amp(ctx, .25), tapeLp = biquad(ctx, 'lowpass', 3000);
  src.connect(vocoder.input); vocoder.output.connect(voc);
  src.connect(tape); tape.connect(tapeLp);
  // Carrier: the root, an octave above it, and a slightly detuned octave.
  [[root, .5, 0], [root + 12, .5, 0], [root + 12, .3, 7]].forEach(([m, level, cents]) => {
    const o = ctx.createOscillator(), g = amp(ctx, level); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents;
    o.connect(g); g.connect(vocoder.carrier); o.start(0);
  });
  const hiss = ctx.createBufferSource(), hissHp = biquad(ctx, 'highpass', 3800), hissGain = amp(ctx, .12);
  hiss.buffer = noiseBuffer(ctx); hiss.loop = true; hiss.connect(hissHp); hissHp.connect(hissGain); hissGain.connect(vocoder.carrier); hiss.start(0);
  // A short comb (one period of A2) gives the metal; tanh gives the weight.
  const sum = amp(ctx, 1), comb = ctx.createDelay(.05), fb = amp(ctx, .55), wet = amp(ctx, .25), dry = amp(ctx, 1);
  comb.delayTime.value = 1 / 110;
  voc.connect(sum); tapeLp.connect(sum);
  sum.connect(dry); sum.connect(comb); comb.connect(fb); fb.connect(comb); comb.connect(wet);
  const sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
  sat.curve = curve; sat.oversample = '4x';
  const hp = biquad(ctx, 'highpass', 45), lp = biquad(ctx, 'lowpass', 6000);
  dry.connect(sat); wet.connect(sat); sat.connect(hp); hp.connect(lp); lp.connect(ctx.destination);
  src.start(0, from, to - from);
  const out = await ctx.startRendering();
  baked.set(key, out);
  return out;
}

// Everything a plan's lady events need: decoded files and baked deep takes.
export async function prepareLady(ctx, plan, options) {
  const names = [...new Set(plan.lady.map(e => e.file))];
  if (!names.length) return {files:new Map(), deep:new Map()};
  const loaded = await loadLady(ctx, names, options);
  const deep = new Map();
  await Promise.all(plan.lady.map(async (e, i) => {
    if (!e.deep || !loaded.get(e.file)) return;
    deep.set(i, await bakeDeep(loaded.get(e.file), e.from, e.to, e.root));
  }));
  return {files:loaded, deep};
}
