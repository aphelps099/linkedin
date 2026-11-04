// The song book's guarantees, in Node:
//   1. Circle Back's form is unchanged where P4 did not change it on purpose.
//      Every plan it arranges (the sample post and the 60 fixture posts, both
//      forms, two duration models: 244 plans) hashes to the digest recorded
//      from the code before the song book, the additive fields aside and the
//      ladder's rates and gates (P4 tunes each cut by its own pitch). Through a
//      fake OfflineAudioContext, the exact graph (exact.js) makes the plain
//      graph's connections and no input hears more than two at once; the
//      byte-identity of real renders is check-review-audio.mjs --url.
//   2. Every track's Drop Edition schedules cleanly: no non-finite or invalid
//      automation, for the sample post and five fixture posts.
//   3. Every track's plan carries what the Peg Board, the Pixel Text export
//      and the video studio read, with the same meaning.
//   4. P5, with the real eSpeak durations of the 61 posts (fixtures/allhands-durations.json),
//      on every track with today's cast and the post's own (366 plans): Synergy
//      sings one word at a time (no word sounds past the next word's onset, in
//      seconds), every word of every line is sung, inside its window (or the
//      16ths the next slot gives); no line of hers is cut off by its gate (the
//      ladder's hits are gated to their period by design); and plan.stop.end is
//      when her "Full stop." stops sounding.
// Optional, with a dev server: --url http://localhost:5321 --baseline take.wav
// renders Circle Back's Drop Edition through the page and compares it with a
// render made by the old code: the difference must stay within the renderer's
// own run-to-run noise.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {lyricsFromPost, SAMPLE_POST, syllables, tokens} from '../src/allhands/lyrics.js';
import {castSong, settleCast} from '../src/allhands/casting.js';
import {ladyLength} from '../src/allhands/drop.js';
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
// P5 (song.js clearWords): a word that would sound into the next sung word (a
// swung odd 16th lands late, so its steps outlast its time) is gated at that
// word's onset and sped up to fit. Those words compare without their gate and
// rate; they are found from at, steps and timing alone, so the same words in
// the old plans and the new.
function legacy(plan) {
  const {track, trackTitle, kicks, marks, energyTrim, stop, ...old} = plan;
  if (old.choke) { const {dark, tagEnd, ...choke} = old.choke; old.choke = choke; }
  old.lady = old.lady.map(({period, ...e}) => { if (e.role === 'ladder') { delete e.rate; delete e.gate; } return e; });
  const T = plan.timing, sung = [...plan.words, ...plan.stutters].sort((a, b) => a.at - b.at), next = new Map(sung.map((w, i) => [w, sung[i + 1]]));
  const strip = w => { const n = next.get(w); if (w.line < 0 || !n || T[w.at] + w.steps * plan.step <= T[n.at] + 1e-12) return w; const {gate, rate, ...rest} = w; return rest; };
  old.words = plan.words.map(strip); old.lines = plan.lines.map(l => ({...l, words:l.words.map(strip)}));
  return old;
}
const models = {fake:w => .18 + .11 * syllables(w), long:w => .3 + .19 * syllables(w)};
const posts = [SAMPLE_POST, ...fixtures], plans = {}, hashes = {}, fiveWordHooks = [];
for (const form of ['drop60', 'soundcheck']) for (const [m, f] of Object.entries(models)) posts.forEach((post, i) => {
  let lyrics; try { lyrics = lyricsFromPost(post); } catch { return; }
  const plan = FORMS[form].arrange(lyrics, Object.fromEntries(FORMS[form].voiced(lyrics).map(w => [w, f(w)])));
  plans[`${form}/${m}/${i}`] = plan; hashes[`${form}/${m}/${i}`] = sha(canon(legacy(plan)));
  if (form === 'drop60' && tokens(lyrics.hook).length === 5) fiveWordHooks.push(`${form}/${m}/${i}`);
});
// Recomputed at P5 from the committed P4 code (bb53d93; P4's own digest was 'efdb37378de7...') with the
// legacy() above, over the 240 plans P5 leaves alone. The other four are the Drop Edition of the two posts
// whose hook has five words (fixtures 9 and 42, both duration models): at two 16ths a word the hook is ten
// 16ths, and in its half-bar slots it ran two past the window: into the sign-off (two words at once) and
// into her ladder hits. Now the sign-off gives way and the half-bar answers sing their shortest words as 16ths.
const PLANS_BEFORE = '048a5596f94a29167e168e00ee0b0f70b54297285373fa3ef0ddf2abb0923b9c';
const kept = Object.keys(hashes).filter(k => !fiveWordHooks.includes(k)).sort();
ok(Object.keys(hashes).length === 244 && fiveWordHooks.join() === 'drop60/fake/10,drop60/fake/43,drop60/long/10,drop60/long/43' && sha(kept.map(k => hashes[k]).join('')) === PLANS_BEFORE,
  `Circle Back: 240 of 244 plans identical to the code before the song book; the 4 with a five-word hook changed on purpose`);

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
    return new Proxy(target, {set(t, k, v) { if (k !== 'onended' && typeof v !== 'function') log.push([id, 'set', k, show(v)]); t[k] = v; return true; }});
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
async function record(plan, options, exact = 'on') {
  const words = [...new Set([...plan.words, ...plan.stutters].map(w => w.word))];
  const buffers = new Map(words.map((w, i) => [w, {audio:fakeBuffer(.25 + .1 * (i % 5), i), lead:.01 * (i % 3), duration:.25}]));
  const files = new Map([...new Set(plan.lady.map(e => e.file))].map((f, i) => [f, fakeBuffer(2.4, 40 + i)]));
  const deep = new Map(plan.lady.map((e, i) => [e, i]).filter(([e]) => e.deep).map(([e, i]) => [i, fakeBuffer(3, i)]));
  globalThis.__exact = exact;
  try { await E.render(plan, buffers, options, {files, deep}); } finally { delete globalThis.__exact; }
  return {calls:last.log.length, sha:sha(canon(last.log)), log:last.log, ctx:last};
}
// The graph as connections, with exact.js's lane links collapsed: [from, to, output, input].
function logical(log) {
  const links = new Set(log.filter(e => e[1] === 'set' && e[2] === 'exactLink').map(e => e[0]));
  const ids = new Map(); let n = 0;
  for (const e of log) if (e[0] === 'new' && !links.has(e[1])) ids.set(e[1], ++n);
  const out = new Map();
  for (const e of log) if (e[1] === 'connect' && links.has(e[0])) out.set(e[0], [e[2], e[4]]);
  const name = d => { if (typeof d !== 'string') return d; const m = /^#(\d+)(\..+)?$/.exec(d); return m ? `#${ids.get(+m[1])}${m[2] ?? ''}` : d; };
  const resolve = (d, i) => { for (let k = 0; typeof d === 'string' && /^#\d+$/.test(d) && links.has(+d.slice(1)); k++) { if (k > 1e5) throw Error('lane loop'); [d, i] = out.get(+d.slice(1)); } return [d, i]; };
  return log.filter(e => e[1] === 'connect' && !links.has(e[0])).map(e => { const [d, i] = resolve(e[2], e[4]); return [ids.get(e[0]), name(d), e[3], i].join(' '); }).sort();
}
// exact.js changes how the graph sums, never what it connects: the same
// connections as the plain graph, every input hearing at most two at once.
// (The calls themselves changed by design at P4: lanes, heads, and the ladder
// retuned by the pitch of each cut. The old digests were the pre-song-book code.)
for (const [key, options] of [['drop60/fake/0', {mode:'sung'}], ['soundcheck/fake/0', {mode:'sung'}], ['drop60/fake/1', {mode:'sung', tune:{stems:true}}], ['drop60/long/3', {mode:'both', muted:{drums:true}}]]) {
  const plain = await record(plans[key], options, 'off'), exact = await record(plans[key], options, 'on');
  const a = logical(plain.log), b = logical(exact.log), report = E.exactReport(exact.ctx);
  ok(a.length > 5000 && JSON.stringify(a) === JSON.stringify(b), `Circle Back ${key} ${JSON.stringify(options)}: the exact graph makes the plain graph's ${a.length} connections`);
  ok(report.length > 100 && report.every(r => r.overlap <= 2), `Circle Back ${key}: every one of ${report.length} inputs hears at most two connections at once (busiest: ${Math.max(...report.map(r => r.lanes))} lanes)`);
}

// ---- 2. Every track schedules cleanly, deterministically
for (const track of TRACK_ORDER) for (const post of [SAMPLE_POST, ...fixtures.slice(0, 5)]) {
  const lyrics = lyricsFromPost(post), F = FORMS.drop60, durations = Object.fromEntries(F.voiced(lyrics, {track}).map(w => [w, models.fake(w)]));
  const plan = F.arrange(lyrics, durations, {track}), a = await record(plan, {mode:'sung'}), b = await record(F.arrange(lyrics, durations, {track}), {mode:'sung'});
  ok(a.calls > 10000 && a.sha === b.sha, `${track}/${lyrics.hook}: ${a.calls} valid Web Audio calls, the same twice`);
  ok(E.exactReport(a.ctx).every(r => r.overlap <= 2), `${track}/${lyrics.hook}: no input hears more than two connections at once`);
  // ---- 3. The plan downstream reads
  const T = plan.timing;
  ok(plan.track === track && plan.trackTitle === TRACKS[track].title && Number.isFinite(plan.bpm) && typeof plan.key === 'string' && Math.abs(plan.step - 15 / plan.bpm) < 1e-12, `${track}: track, bpm, key, step`);
  ok(T instanceof Float64Array && plan.sections.every(s => Number.isInteger(s.from) && s.to > s.from) && plan.bars.every(b => typeof b.layers === 'object' && b.layers.drums), `${track}: timing, sections, bars[].layers`);
  ok(plan.lines.every(l => l.words.every(w => Number.isInteger(w.at) && w.steps > 0 && w.notes.length)) && plan.words.every(w => w.gate > 0), `${track}: lines and words`);
  ok(plan.lady.every(e => typeof e.role === 'string' && e.file && e.to > e.from && e.gate > 0 && e.rate > 0 && typeof e.display === 'string'), `${track}: lady events`);
  ok(Number.isInteger(plan.choke.at) && Number.isInteger(plan.choke.until) && plan.choke.dark > T[plan.choke.at] && plan.tape.length === 2 && plan.duration > T[plan.totalSteps], `${track}: choke, tape, duration`);
  ok(['unmute', 'build', 'rise', 'choke', 'impact', 'sink', 'sinkEnd', 'stop'].every(k => Number.isInteger(plan.marks[k])), `${track}: marks`);
}

// ---- 4. Real eSpeak durations, every track, today's cast and the post's own
{
  const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8'));
  let n = 0, joins = 0, gated = 0, given = 0;
  posts.forEach((post, i) => {
    const lyrics = lyricsFromPost(post), label = i ? `fixture ${i - 1}` : 'sample';
    for (const track of TRACK_ORDER) for (const own of [false, true]) {
      const cast = own ? castSong(post, {track}).cast : undefined, plan = settleCast(FORMS.drop60.arrange, lyrics, REAL, {track, cast}).plan, T = plan.timing, at = e => T[Math.floor(e.at)] + (e.at % 1) * plan.step;
      const tag = `${label} ${track}${own ? ' (its cast)' : ''}`, setlist = TRACKS[track].drop.slots(lyrics);
      n++;
      // One word at a time: every word (and the stammer, gated at 0.8 of a 16th by the engine) has stopped when the next one starts.
      const sung = [...plan.words, ...plan.stutters.map(s => ({...s, gate:plan.step * .8}))].sort((a, b) => a.at - b.at);
      const clash = sung.find((w, k) => k + 1 < sung.length && T[w.at] + w.gate > T[sung[k + 1].at] + 1e-9);
      ok(!clash, `${tag}: Synergy sings one word at a time${clash ? ` ("${clash.display ?? clash.word}" at ${clash.at} runs into the next word)` : ''}`);
      joins += sung.filter((w, k) => k + 1 < sung.length && w.at + w.steps === sung[k + 1].at).length;
      gated += plan.words.filter(w => w.line >= 0 && w.gate < w.steps * plan.step - 1e-9).length;
      // Every word of every line, inside its window or the 16ths the next slot gives.
      // (A hook sung twice may end on the next slot's downbeat, as it always has.)
      let late = 0;
      plan.lines.forEach((l, id) => {
        const slot = setlist[id], next = setlist[id + 1], from = slot.bar * 16 + (slot.startStep ?? 0), end = from + (slot.window ?? 30), nextAt = next ? next.bar * 16 + (next.startStep ?? 0) : end;
        const give = next?.give && nextAt === end ? next.give : 0, twice = l.words.some(w => w.repeat), last = Math.max(...l.words.map(w => w.at + w.steps));
        ok(l.words.filter(w => !w.repeat).length === tokens(slot.text).length && l.words[0].at >= from + late && last <= (twice ? Math.max(end, nextAt) : end) + give,
          `${tag}: line ${id} "${slot.text}" sung whole, ${from + late}-${last} (window ${from}-${end}${give ? `, the next slot gives ${give}` : ''})`);
        late = Math.max(0, last - nextAt); given += late > 0;
      });
      // Her lines play whole: every gate holds its cut at its rate (the ladder's hits are gated to their period by design).
      for (const e of plan.lady.filter(x => x.role !== 'ladder')) ok(e.gate >= (e.to - e.from) / e.rate - 1e-9 && at(e) + ladyLength(e) <= plan.duration, `${tag}: her ${e.role} "${e.display}" plays whole (${((e.to - e.from) / e.rate).toFixed(3)} s, gate ${e.gate.toFixed(3)} s)`);
      const stop = plan.lady.find(e => e.role === 'stop');
      ok(plan.stop && plan.stop.at === T[plan.marks.stop] && plan.stop.tapeEnd === plan.stop.at + TRACKS[track].drop.stop.seconds && (stop ? Math.abs(plan.stop.end - (at(stop) + ladyLength(stop))) < 1e-12 && plan.stop.end > plan.stop.tapeEnd && plan.stop.display === stop.display : plan.stop.end === null),
        `${tag}: plan.stop ${plan.stop?.at.toFixed(3)}-${plan.stop?.end?.toFixed(3)} s, when "${stop?.display}" stops sounding`);
    }
  });
  console.log(`real durations: ${n} plans, one word at a time (${joins} back-to-back joins, ${gated} words gated at the next word's onset), ${given} lines run into a slot that gives way`);
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
