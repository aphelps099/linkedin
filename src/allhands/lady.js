// The lady's recordings, loaded once, plus her deep voice: a phrase at half
// speed (an octave down), sent through a vocoder whose bands are shifted back
// up so the words stay legible, on a carrier that sits on the chord's root.
// Baked offline per event, so playback never runs a second live vocoder.
import {createVocoder} from './vocoder.js';
import {biquad, amp, mtof, noiseBuffer} from './instruments.js';
import {exactSession} from './exact.js';
import {loadVoices, sing, toBuffer} from './voices/voice-table.js';

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

// `comb`: the resonance in Hz (A2 by default; a song book track tunes it to its chord root).
// Each buffer baked from gets an id: two sung takes of one length are different sounds.
const ids = new WeakMap();
let nextId = 0;
export async function bakeDeep(buffer, from, to, root, {rate = .5, shift = 2, comb:combHz = 110} = {}) {
  if (!ids.has(buffer)) ids.set(buffer, ++nextId);
  const key = [ids.get(buffer), buffer.length, from, to, root, rate, shift, combHz].join(':');
  if (baked.has(key)) return baked.get(key);
  const sr = 44100, seconds = (to - from) / rate + .4, ctx = new OfflineAudioContext(1, Math.ceil(seconds * sr), sr), exact = exactSession(ctx);
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
  comb.delayTime.value = 1 / combHz;
  voc.connect(sum); tapeLp.connect(sum);
  sum.connect(dry); sum.connect(comb); comb.connect(fb); fb.connect(comb); comb.connect(wet);
  const sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
  sat.curve = curve; sat.oversample = '4x';
  const hp = biquad(ctx, 'highpass', 45), lp = biquad(ctx, 'lowpass', 6000);
  dry.connect(sat); wet.connect(sat); sat.connect(hp); hp.connect(lp); lp.connect(ctx.destination);
  src.start(0, from, to - from);
  exact.finalize();
  const out = await ctx.startRendering();
  baked.set(key, out);
  return out;
}

// The notes a pixel event is sung on: its line, moved down by its rate so that,
// played faster, it lands in key (band.js: a part sped up to fit its gap).
export const sungNotes = e => (e.rate && e.rate !== 1 ? e.notes.map(n => ({...n, midi:n.midi - 12 * Math.log2(e.rate)})) : e.notes);
const sungKey = e => `${e.file}|${e.amount ?? ''}|${JSON.stringify(sungNotes(e).map(n => [n.from, n.to, +n.midi.toFixed(4)]))}`;

// Every event the plan's sampled voices play, with the id the engine indexes it
// by: her events (and on a couplet drop its tag and impact) by their index in
// plan.lady, the band's parts (plan.band) as 'b' + their index.
// The river's loop sources (wander.js plan.loops) come along as 'l' + their index: the textures cut them.
export const voiceEvents = plan => [...(plan.lady || []).map((e, i) => ({e, id:i})), ...(plan.band || []).map((e, i) => ({e, id:`b${i}`})), ...(plan.loops || []).map((e, i) => ({e, id:`l${i}`}))];

// Everything a plan's voices need: her decoded files, the voice bank's takes sung
// onto each event's notes through the pixel chain (voices/voice-table.js sing:
// the same samples in every browser and in Node), and the baked deep takes.
// options.voices: loadVoices options (Node passes {read}).
export async function prepareLady(ctx, plan, options = {}) {
  const all = voiceEvents(plan), hers = all.filter(x => !x.e.key), pixel = all.filter(x => x.e.key && x.e.notes);
  // (A loop source may read several of her files: plan.loops[].files.)
  const names = [...new Set(hers.flatMap(x => [x.e.file, ...(x.e.files || [])]))];
  const loaded = names.length ? await loadLady(ctx, names, options) : new Map();
  const sung = new Map(), takes = pixel.length ? await loadVoices([...new Set(pixel.map(x => x.e.file))], options.voices) : new Map(), made = new Map();
  for (const {e, id} of pixel) {
    const take = takes.get(e.file), k = sungKey(e);
    if (!take) continue;
    if (!made.has(k)) made.set(k, toBuffer(ctx, sing(take, {notes:sungNotes(e), amount:e.amount}).samples, take.sampleRate));
    sung.set(id, made.get(k));
  }
  const deep = new Map();
  await Promise.all(all.filter(x => typeof x.id === 'number').map(async ({e, id}) => {
    const buffer = e.key ? sung.get(id) : loaded.get(e.file);
    if (!e.deep || !buffer) return;
    deep.set(id, await bakeDeep(buffer, e.from, e.to, e.root, e.comb ? {comb:e.comb} : undefined));
  }));
  return {files:loaded, deep, sung};
}
