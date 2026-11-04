// The song book's guarantees, in Node:
//   1. Circle Back is unchanged. Every plan it arranges (the sample post and
//      the 60 fixture posts, both forms, two duration models: 244 plans) hashes
//      to the digest recorded from the code before the song book existed, the
//      song book's additive fields aside. And the engine makes the identical
//      Web Audio calls for it (every node, property, connection, automation
//      event, start and stop), recorded through a fake OfflineAudioContext.
//      Byte-comparing two WAVs cannot prove this: Chromium sums fan-in
//      connections in a non-deterministic order, so two renders of the same
//      code differ by up to ~16 LSB (see README, "The song book").
//   2. Every track's Drop Edition schedules cleanly: no non-finite or invalid
//      automation, for the sample post and five fixture posts.
//   3. Every track's plan carries what the Peg Board, the Pixel Text export
//      and the video studio read, with the same meaning.
// Optional, with a dev server: --url http://localhost:5321 --baseline take.wav
// renders Circle Back's Drop Edition through the page and compares it with a
// render made by the old code: the difference must stay within the renderer's
// own run-to-run noise.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {FORMS} from '../src/allhands/forms.js';
import {TRACKS, TRACK_ORDER} from '../src/allhands/songbook/index.js';
import * as E from '../src/allhands/engine.js';

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/pixel-posts.json', import.meta.url), 'utf8')).map(x => x.post);
const sha = s => createHash('sha256').update(s).digest('hex');
const canon = x => JSON.stringify(x, (k, v) => v instanceof Float64Array || v instanceof Float32Array ? Array.from(v) : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);

// ---- 1a. Circle Back's plans, as they were
// Fields the song book added to every plan; everything else compares as it was.
function legacy(plan) {
  const {track, trackTitle, kicks, marks, ...old} = plan;
  if (old.choke) { const {dark, ...choke} = old.choke; old.choke = choke; }
  old.lady = old.lady.map(({period, ...e}) => e);
  return old;
}
const models = {fake:w => .18 + .11 * syllables(w), long:w => .3 + .19 * syllables(w)};
const posts = [SAMPLE_POST, ...fixtures], plans = {}, hashes = {};
for (const form of ['drop60', 'soundcheck']) for (const [m, f] of Object.entries(models)) posts.forEach((post, i) => {
  let lyrics; try { lyrics = lyricsFromPost(post); } catch { return; }
  const plan = FORMS[form].arrange(lyrics, Object.fromEntries(FORMS[form].voiced(lyrics).map(w => [w, f(w)])));
  plans[`${form}/${m}/${i}`] = plan; hashes[`${form}/${m}/${i}`] = sha(canon(legacy(plan)));
});
const PLANS_BEFORE = 'cbb85936893fa3f3ef13391c93d14d9a25d7cfc5cae8ec3709843dd43c0a28f7';
ok(Object.keys(hashes).length === 244 && sha(Object.keys(hashes).sort().map(k => hashes[k]).join('')) === PLANS_BEFORE, 'Circle Back: 244 plans identical to the code before the song book');

// ---- 1b. Circle Back's Web Audio calls, as they were
function fnv(arr) {
  const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let h = 2166136261;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619);
  return `arr${arr.length}:${(h >>> 0).toString(16)}`;
}
const show = v => v instanceof Float32Array || v instanceof Float64Array ? fnv(v) : v && v.__id ? `#${v.__id}` : v && v.__param ? `#${v.__param}` : v;
class Recorder {
  constructor(channels, length, sampleRate) {
    this.log = []; this.n = 0; this.sampleRate = sampleRate; this.length = length; this.channels = channels; this.currentTime = 0;
    this.destination = this.node('destination', {channelCount:channels, maxChannelCount:channels});
  }
  param(owner, name, value) {
    const log = this.log, id = `${owner}.${name}`, p = {__param:id, _v:value, defaultValue:value};
    Object.defineProperty(p, 'value', {get() { return this._v; }, set(v) { log.push([id, '=', v]); this._v = v; }});
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime'])
      p[m] = (...a) => {
        if (m !== 'setValueCurveAtTime' && a.some(x => !Number.isFinite(x))) throw Error(`${id}.${m}(${a}): not finite`);
        if (m === 'exponentialRampToValueAtTime' && !(a[0] > 0)) throw Error(`${id}: exponential ramp to ${a[0]}`);
        log.push([id, m, ...a.map(show)]); return p;
      };
    return p;
  }
  node(type, extra = {}, params = {}) {
    const id = ++this.n, log = this.log;
    log.push(['new', id, type]);
    const target = {__id:id, __type:type, ...extra};
    for (const [k, v] of Object.entries(params)) target[k] = this.param(id, k, v);
    target.connect = (dest, o = 0, i = 0) => { log.push([id, 'connect', show(dest), o, i]); return dest; };
    target.disconnect = () => {};
    target.start = (...a) => { if (a.some(x => !Number.isFinite(x))) throw Error(`#${id} start(${a})`); log.push([id, 'start', ...a]); };
    target.stop = (...a) => { if (a.some(x => !Number.isFinite(x))) throw Error(`#${id} stop(${a})`); log.push([id, 'stop', ...a]); };
    target.setPeriodicWave = w => log.push([id, 'wave', w.__wave]);
    target.getFloatTimeDomainData = () => {}; target.getByteFrequencyData = () => {};
    return new Proxy(target, {set(t, k, v) { if (k !== 'onended') log.push([id, 'set', k, show(v)]); t[k] = v; return true; }});
  }
  createGain() { return this.node('gain', {}, {gain:1}); }
  createBiquadFilter() { return this.node('biquad', {}, {frequency:350, Q:1, gain:0, detune:0}); }
  createOscillator() { return this.node('osc', {}, {frequency:440, detune:0}); }
  createBufferSource() { return this.node('source', {}, {playbackRate:1, detune:0}); }
  createConstantSource() { return this.node('constant', {}, {offset:1}); }
  createWaveShaper() { return this.node('shaper'); }
  createDelay(max) { this.log.push(['delaymax', max]); return this.node('delay', {}, {delayTime:0}); }
  createStereoPanner() { return this.node('panner', {}, {pan:0}); }
  createChannelSplitter(n) { return this.node(`splitter${n}`); }
  createChannelMerger(n) { return this.node(`merger${n}`); }
  createDynamicsCompressor() { return this.node('compressor', {}, {threshold:-24, ratio:12, knee:30, attack:.003, release:.25}); }
  createConvolver() { return this.node('convolver'); }
  createAnalyser() { return this.node('analyser', {frequencyBinCount:512}); }
  createPeriodicWave(real, imag) { this.log.push(['wave', fnv(real), fnv(imag)]); return {__wave:fnv(imag)}; }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({length:channels}, () => new Float32Array(length));
    this.log.push(['buffer', channels, length, sampleRate]);
    return {numberOfChannels:channels, length, sampleRate, duration:length / sampleRate, getChannelData:c => data[c]};
  }
  async startRendering() {
    const data = Array.from({length:this.channels}, () => new Float32Array(this.length));
    return {numberOfChannels:this.channels, length:this.length, sampleRate:this.sampleRate, duration:this.length / this.sampleRate, getChannelData:c => data[c]};
  }
}
let last;
globalThis.OfflineAudioContext = class extends Recorder { constructor(c, l, s) { super(c, l, s); last = this; } };
const fakeBuffer = (seconds, seed) => {
  const length = Math.round(seconds * 44100), d = new Float32Array(length);
  for (let i = 0; i < length; i++) d[i] = Math.sin(i * (seed % 7 + 1) * .01);
  return {duration:seconds, length, sampleRate:44100, numberOfChannels:1, getChannelData:() => d};
};
async function record(plan, options) {
  const words = [...new Set([...plan.words, ...plan.stutters].map(w => w.word))];
  const buffers = new Map(words.map((w, i) => [w, {audio:fakeBuffer(.25 + .1 * (i % 5), i), lead:.01 * (i % 3), duration:.25}]));
  const files = new Map([...new Set(plan.lady.map(e => e.file))].map((f, i) => [f, fakeBuffer(2.4, 40 + i)]));
  const deep = new Map(plan.lady.map((e, i) => [e, i]).filter(([e]) => e.deep).map(([e, i]) => [i, fakeBuffer(3, i)]));
  await E.render(plan, buffers, options, {files, deep});
  return {calls:last.log.length, sha:sha(canon(last.log))};
}
// Digests recorded from the engine before the song book (scratchpad regress harness, same fake inputs).
const ENGINE_BEFORE = [
  ['drop60/fake/0', {mode:'sung'}, 44828, 'c8b6c7069c663cf112ff822f6152b6e716017f58485485a341a189848e3a619d'],
  ['soundcheck/fake/0', {mode:'sung'}, 40631, '894f51fbe24238ccd4312deaaf001b42a2e9b34e5f85301acc30f55c23c73912'],
  ['drop60/fake/1', {mode:'sung', tune:{stems:true}}, 44682, 'ba9bcfde8412318861c2f8506b646f624704b76cc87c78548cd8953abd632099'],
  ['drop60/long/3', {mode:'both', muted:{drums:true}}, 44594, 'e825fa50e642bb7188094275ec54b146f22582ee5fbe9d13c2245c126c873f52'],
];
for (const [key, options, calls, digest] of ENGINE_BEFORE) {
  const got = await record(plans[key], options);
  ok(got.calls === calls && got.sha === digest, `Circle Back ${key} ${JSON.stringify(options)}: the same ${calls} Web Audio calls as before (got ${got.calls})`);
}

// ---- 2. Every track schedules cleanly, deterministically
for (const track of TRACK_ORDER) for (const post of [SAMPLE_POST, ...fixtures.slice(0, 5)]) {
  const lyrics = lyricsFromPost(post), F = FORMS.drop60, durations = Object.fromEntries(F.voiced(lyrics, {track}).map(w => [w, models.fake(w)]));
  const plan = F.arrange(lyrics, durations, {track}), a = await record(plan, {mode:'sung'}), b = await record(F.arrange(lyrics, durations, {track}), {mode:'sung'});
  ok(a.calls > 10000 && a.sha === b.sha, `${track}/${lyrics.hook}: ${a.calls} valid Web Audio calls, the same twice`);
  // ---- 3. The plan downstream reads
  const T = plan.timing;
  ok(plan.track === track && plan.trackTitle === TRACKS[track].title && Number.isFinite(plan.bpm) && typeof plan.key === 'string' && Math.abs(plan.step - 15 / plan.bpm) < 1e-12, `${track}: track, bpm, key, step`);
  ok(T instanceof Float64Array && plan.sections.every(s => Number.isInteger(s.from) && s.to > s.from) && plan.bars.every(b => typeof b.layers === 'object' && b.layers.drums), `${track}: timing, sections, bars[].layers`);
  ok(plan.lines.every(l => l.words.every(w => Number.isInteger(w.at) && w.steps > 0 && w.notes.length)) && plan.words.every(w => w.gate > 0), `${track}: lines and words`);
  ok(plan.lady.every(e => typeof e.role === 'string' && e.file && e.to > e.from && e.gate > 0 && e.rate > 0 && typeof e.display === 'string'), `${track}: lady events`);
  ok(Number.isInteger(plan.choke.at) && Number.isInteger(plan.choke.until) && plan.choke.dark > T[plan.choke.at] && plan.tape.length === 2 && plan.duration > T[plan.totalSteps], `${track}: choke, tape, duration`);
  ok(['unmute', 'build', 'rise', 'choke', 'impact', 'sink', 'sinkEnd', 'stop'].every(k => Number.isInteger(plan.marks[k])), `${track}: marks`);
}

// ---- Optional: a real render through the page, compared with the old code's
const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;
const baseline = process.argv.includes('--baseline') ? process.argv[process.argv.indexOf('--baseline') + 1] : null;
if (url && baseline) {
  const require = createRequire(import.meta.url);
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright for --url.'); })();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.__allhands);
    const result = await page.evaluate(() => window.__allhands.render({track:'circle-back'}));
    const a = Buffer.from(result.wav, 'base64'), b = readFileSync(baseline);
    ok(a.length === b.length && a.subarray(0, 44).equals(b.subarray(0, 44)), 'render: same length and header as the baseline');
    let max = 0, n = 0;
    for (let i = 44; i < a.length; i += 2) { const d = Math.abs(a.readInt16LE(i) - b.readInt16LE(i)); if (d) { n++; if (d > max) max = d; } }
    console.log(`render vs baseline: ${n} of ${(a.length - 44) / 2} samples differ, max ${max} LSB (${(20 * Math.log10(Math.max(1, max) / 32768)).toFixed(1)} dBFS)`);
    ok(max <= 32, `render: within the renderer's own run-to-run noise (max ${max} LSB)`);
  } finally { await browser.close(); }
}
console.log(`song book: ${checks} checks passed`);
