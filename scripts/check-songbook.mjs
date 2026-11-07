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
//   5. P6, on the same 366 plans: her tag ends 0.37-0.42 s before BACK. (drop.js IMPACT_GAP,
//      Circle Back's 0.392 s the reference), nothing else sounds from the choke to the impact,
//      and her stop line ends at least 60 ms before the film's last two frames (the ghost BACK.).
//   6. The composition constitution (songbook/CONSTITUTION.md as constitution.js): every track
//      and every plan of that corpus keeps it, warnings aside (each printed); the lint bites
//      on charts, plans and measured renders that break it.
//   7-8. The band's parts; the river (Offsite), its plans unchanged since Delve. joined the book.
//   9. Delve. (songbook/delve.js, her vocabulary): the chart keeps the constitution with exactly its
//      two declared breaks, and the lint still bites under them; out of the pickers and the casting;
//      her ten phrases land on their 16ths, four bars apart, each echo chain gone a beat before the
//      next; the choir, the echoes and the stars in key; the plan the film reads; it schedules
//      cleanly, the same twice, every input at most two at once.
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
import {ladyLength, IMPACT_GAP} from '../src/allhands/drop.js';
import {stopFrames} from '../src/videostudio/edl/anchors.js';
import {lintTrack, lintPlan, describe, REFERENCES, BAND} from '../src/allhands/songbook/constitution.js';
import {FORMS} from '../src/allhands/forms.js';
import {TRACKS, TRACK_ORDER} from '../src/allhands/songbook/index.js';
import * as E from '../src/allhands/engine.js';
import {voiceEvents} from '../src/allhands/lady.js';
import {SONG_TABLE, SYNERGY_HOOKS, GUARD, MAX_RATE, TAG_MAX_RATE, hasBand} from '../src/allhands/band.js';
import {AVAILABLE} from '../src/allhands/voices/voice-table.js';
import {VOICES} from '../src/allhands/voices/items.js';
import {RIVER} from '../src/allhands/wander.js';
import {textureHits, levelAt} from '../src/allhands/river.js';
import {HOST} from '../src/allhands/song.js';

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/pixel-posts.json', import.meta.url), 'utf8')).map(x => x.post);
const sha = s => createHash('sha256').update(s).digest('hex');
const json = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
const canon = x => JSON.stringify(x, (k, v) => v instanceof Float64Array || v instanceof Float32Array ? Array.from(v) : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);

// ---- 1a. Circle Back's plans, as they were
// Fields the song book added to every plan; everything else compares as it was.
// P5 (song.js clearWords): a word that would sound into the next sung word (a
// swung odd 16th lands late, so its steps outlast its time) is gated at that
// word's onset and sped up to fit. Those words compare without their gate and
// rate; they are found from at, steps and timing alone, so the same words in
// the old plans and the new.
function legacy(plan) {
  const {track, trackTitle, kicks, marks, energyTrim, stop, band, bandLeft, drop, makeup, ...old} = plan;
  if (old.choke) { const {dark, tagEnd, time, gap, ...choke} = old.choke; old.choke = choke; }
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
  // Her recordings by file; the voice bank's takes sung per event (lady.js voiceEvents: hers, the band's, the river's loops).
  const all = voiceEvents(plan), files = new Map([...new Set(all.filter(x => !x.e.key).flatMap(x => [x.e.file, ...(x.e.files || [])]))].map((f, i) => [f, fakeBuffer(2.4, 40 + i)]));
  const sung = new Map(all.filter(x => x.e.key).map((x, i) => [x.id, fakeBuffer(2, 70 + i)]));
  const deep = new Map(plan.lady.map((e, i) => [e, i]).filter(([e]) => e.deep).map(([e, i]) => [i, fakeBuffer(3, i)]));
  globalThis.__exact = exact;
  try { await E.render(plan, buffers, options, {files, deep, sung}); } finally { delete globalThis.__exact; }
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
  // The choke is where her tag starts: a step on the 128th grid (P6), its seconds in choke.time.
  ok((plan.choke.at * 8) % 1 === 0 && Number.isInteger(plan.choke.until) && plan.choke.time === T[Math.floor(plan.choke.at)] + (plan.choke.at % 1) * plan.step && plan.choke.dark > plan.choke.time && plan.tape.length === 2 && plan.duration > T[plan.totalSteps], `${track}: choke, tape, duration`);
  ok(['unmute', 'build', 'rise', 'impact', 'sink', 'sinkEnd', 'stop'].every(k => Number.isInteger(plan.marks[k])) && plan.marks.choke === plan.choke.at, `${track}: marks`);
}

// ---- 4. Real eSpeak durations, every track, today's cast and the post's own
{
  const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8'));
  let n = 0, joins = 0, gated = 0, given = 0;
  const gaps = Object.fromEntries(TRACK_ORDER.map(t => [t, []])), seams = {}, LATENCY = 720 / 44100;   // edl/anchors.js AUDIO_LATENCY
  posts.forEach((post, i) => {
    const lyrics = lyricsFromPost(post), label = i ? `fixture ${i - 1}` : 'sample';
    for (const track of TRACK_ORDER) for (const own of [false, true]) {
      const cast = own ? castSong(post, {track}).cast : undefined, plan = settleCast(FORMS.drop60.arrange, lyrics, REAL, {track, cast}).plan, T = plan.timing, at = e => T[Math.floor(e.at)] + (e.at % 1) * plan.step;
      // With the band cast, Synergy sings the slots the plan kept (plan.setlist: band.js bandSetlist).
      const tag = `${label} ${track}${own ? ' (its cast)' : ''}`, setlist = plan.setlist ?? TRACKS[track].drop.slots(lyrics);
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
        const give = (next?.give && nextAt === end ? next.give : 0) || (slot.spillInto ?? 0), twice = l.words.some(w => w.repeat), last = Math.max(...l.words.map(w => w.at + w.steps));
        ok(l.words.filter(w => !w.repeat).length === tokens(slot.text).length && l.words[0].at >= from + late && last <= (twice ? Math.max(end, nextAt) : end) + give,
          `${tag}: line ${id} "${slot.text}" sung whole, ${from + late}-${last} (window ${from}-${end}${give ? `, the next slot gives ${give}` : ''})`);
        late = Math.max(0, last - nextAt); given += late > 0;
      });
      // Her lines play whole: every gate holds its cut at its rate (the ladder's hits are gated to their period by design).
      for (const e of plan.lady.filter(x => x.role !== 'ladder')) ok(e.gate >= (e.to - e.from) / e.rate - 1e-9 && at(e) + ladyLength(e) <= plan.duration, `${tag}: her ${e.role} "${e.display}" plays whole (${((e.to - e.from) / e.rate).toFixed(3)} s, gate ${e.gate.toFixed(3)} s)`);
      const stop = plan.lady.find(e => e.role === 'stop');
      ok(plan.stop && plan.stop.at === T[plan.marks.stop] && plan.stop.tapeEnd === plan.stop.at + TRACKS[track].drop.stop.seconds && (stop ? Math.abs(plan.stop.end - (at(stop) + ladyLength(stop))) < 1e-12 && plan.stop.end > plan.stop.tapeEnd && plan.stop.display === stop.display : plan.stop.end === null),
        `${tag}: plan.stop ${plan.stop?.at.toFixed(3)}-${plan.stop?.end?.toFixed(3)} s, when "${stop?.display}" stops sounding`);
      // ---- 5. P6, Aaron's note on the drop: her tag ends Circle Back's 0.39 s before BACK. on every
      // track and cast (drop.js IMPACT_GAP). The impact stays on its downbeat; the choke, and her tag
      // with it, sits where the gap comes out right; nothing else sounds after it; her tag plays whole.
      const tagEv = plan.lady.find(e => e.role === 'tag'), impact = T[plan.choke.until], gap = impact - plan.choke.tagEnd;
      ok(tagEv && tagEv.at === plan.choke.at && plan.choke.until === TRACKS[track].drop.impact * 16 && Math.abs(plan.choke.tagEnd - (at(tagEv) + ladyLength(tagEv))) < 1e-12
        && tagEv.gate >= (tagEv.to - tagEv.from) / tagEv.rate - 1e-9 && gap >= IMPACT_GAP.min && gap <= IMPACT_GAP.max && Math.abs(gap - plan.choke.gap) < 1e-12,
        `${tag}: "${tagEv?.display}" ends ${(gap * 1000).toFixed(1)} ms before BACK. (${IMPACT_GAP.min}-${IMPACT_GAP.max} s)`);
      const after = [...plan.words.map(w => [T[w.at], T[w.at] + w.gate]), ...plan.lady.filter(e => e.role !== 'tag').map(e => [at(e), at(e) + ladyLength(e)])].filter(([a, b]) => b > plan.choke.time + 1e-9 && a < impact - 1e-9);
      ok(!after.length, `${tag}: nothing but her tag sounds from the choke to BACK.${after.length ? ` (${after.length} events)` : ''}`);
      gaps[track].push(gap);
      // The ending: her stop line ends at least 60 ms (in the delivered sound, the engine's 16 ms
      // look-ahead included) before the film's last two frames, the loop seam's ghost BACK.
      const N = Math.round(T[plan.totalSteps] * 24), seam = (N - 2) / 24;
      if (plan.stop.end !== null) {
        ok(plan.stop.end + LATENCY + .06 <= seam + 1e-9, `${tag}: her stop line is heard to ${(plan.stop.end + LATENCY).toFixed(3)} s, ${((seam - plan.stop.end - LATENCY) * 1000).toFixed(1)} ms before the ghost BACK. (frame ${N - 2})`);
        seams[track] = Math.min(seams[track] ?? Infinity, seam - plan.stop.end - LATENCY);
      }
      if (i === 0 && !own) ok(stopFrames(plan).black <= N - 3 && (track !== 'hustle' || stopFrames(plan).black === N - 3), `${tag}: the ending reads her line, black from frame ${stopFrames(plan).black}, the ghost BACK. on frames ${N - 2}-${N - 1}`);
    }
  });
  console.log(`P6 gap from her tag to BACK. (${n} plans): ${TRACK_ORDER.map(t => `${TRACKS[t].title} ${Math.min(...gaps[t]).toFixed(4)}-${Math.max(...gaps[t]).toFixed(4)} s`).join(', ')}`);
  console.log(`P6 her stop line, least room before the ghost BACK.: ${TRACK_ORDER.map(t => `${TRACKS[t].title} ${(seams[t] * 1000).toFixed(1)} ms`).join(', ')}`);
  console.log(`real durations: ${n} plans, one word at a time (${joins} back-to-back joins, ${gated} words gated at the next word's onset), ${given} lines run into a slot that gives way`);
}

// ---- 6. The composition constitution (songbook/CONSTITUTION.md, constitution.js)
{
  for (const id of TRACK_ORDER) {
    const v = lintTrack(id), errors = v.filter(x => x.level === 'error');
    console.log(`constitution, ${TRACKS[id].title}: ${errors.length} errors, ${v.length - errors.length} warnings`);
    for (const line of describe(v)) console.log(`  ${line}`);
    ok(!errors.length, `${id}: keeps the constitution (warnings aside)${errors.length ? `: ${describe(errors).join('; ')}` : ''}`);
    ok(Object.keys(TRACKS[id].references).every(k => REFERENCES[k]) && TRACKS[id].references['daft-punk'] && BAND.every(r => TRACKS[id].palette[r]) && TRACKS[id].story.synergy, `${id}: declares its references, its palette and the story`);
    // Synergy learning the synth is backstory, not a feature: a track that gives Synthia no part is not warned.
    ok(TRACKS[id].story.synthia === null && !v.some(x => x.rule === 'story.synthia'), `${id}: no Synthia part, and no warning for it (backstory, not a feature)`);
    // Every break a track declares is a rule it really breaks.
    ok(Object.keys(TRACKS[id].breaks || {}).every(rule => v.some(x => x.rule === rule && x.declared)), `${id}: every declared break is one it takes`);
  }
  // The lint bites: a chart that breaks rules without saying so fails.
  const cb = TRACKS['circle-back'], rules = t => lintTrack(t).filter(x => x.level === 'error').map(x => x.rule);
  ok(rules({...cb, bpm:140}).includes('tempo.range'), 'lint: 140 BPM is an error');
  ok(rules({...TRACKS.hustle, breaks:{}}).includes('swing.light'), 'lint: Hustle\'s swing without its declared break is an error');
  ok(rules({...cb, palette:{...cb.palette, guitar:undefined}}).includes('band.roles'), 'lint: a band without Kevin is an error');
  ok(rules({...cb, references:{kraftwerk:'the grid'}}).includes('references'), 'lint: no Daft Punk is an error');
  ok(rules({...cb, drop:{...cb.drop, swing:b => (b === 19 ? .1 : cb.drop.swing(b))}}).includes('swing.ladder'), 'lint: a swung ladder is an error');
  // Major is for the haze songs: Humbled and Honored takes Washed Out; without it, E-flat major is an error.
  const hh = TRACKS['humbled-and-honored'];
  ok(!rules(hh).includes('harmony.home') && rules({...hh, references:{'daft-punk':hh.references['daft-punk'], air:hh.references.air}}).includes('harmony.home'), 'lint: E-flat major is a haze song\'s (Washed Out), not a lounge song\'s');
  // Offsite is the Panda Bear lane: D major is allowed because it takes Panda Bear and Washed Out; without them it is an error.
  const os = TRACKS.offsite, drop = t => lintTrack(t, {form:'drop60'}).filter(x => x.level === 'error').map(x => x.rule);
  ok(!drop(os).includes('harmony.home') && drop({...os, references:{'daft-punk':os.references['daft-punk'], kraftwerk:os.references.kraftwerk}}).includes('harmony.home'), 'lint: Offsite\'s D major is a haze song\'s (Panda Bear, Washed Out), not a machine song\'s');
  ok(lintTrack(os, {form:'drop60'}).length === 0, 'lint: Offsite\'s Drop Edition chart (kept for the video studio) keeps the constitution with no warnings at all');
  // The river (CONSTITUTION.md): Offsite's own form lints clean, and its rules bite.
  ok(os.form === 'wander' && lintTrack(os).length === 0, 'lint: Offsite\'s river keeps the constitution with no warnings at all');
  const W = os.wander, river = w => rules({...os, wander:{...W, ...w}});
  ok(river({layerSpec:W.layerSpec.map(l => l.id === 'plucks' ? {...l, in:[4, 5]} : l)}).includes('river.ramps'), 'lint: a layer ramping in over one bar is an error');
  ok(river({layerSpec:W.layerSpec.map(l => l.id === 'his' ? {...l, in:[3, 6]} : l)}).includes('river.lush'), 'lint: his word joining before her texture is lush is an error');
  ok(river({phrases:{y:17, refrain:22, extra:24}}).includes('river.phrases') && river({phrases:{y:9, refrain:22}}).includes('river.phrases'), 'lint: three clear phrases, or one two bars after his hook, is an error');
  ok(river({layerSpec:W.layerSpec.filter(l => l.kind !== 'tambourine')}).includes('river.tambourine') && river({layerSpec:W.layerSpec.filter(l => l.kind !== 'loop')}).includes('river.loop'), 'lint: a river without its tambourine or its loop is an error');
  ok(river({layerSpec:W.layerSpec.filter(l => l.kind !== 'colour')}).includes('river.acoustic'), 'lint: a river without its acoustic colours is an error');
  ok(lintTrack({...os, wander:{...W, energy:b => (b === 12 ? 1 : W.energy(b))}}).some(x => x.rule === 'river.flow'), 'lint: an energy step between bars is reported (the flow changes gently)');
  ok(lintTrack({...cb, story:{...cb.story, synthia:'an arpeggio'}}).some(x => x.rule === 'story.synthia' && /no bar plays her part/.test(x.reason)), 'lint: a Synthia part declared but never played is reported');
  // Every plan of section 4's corpus keeps the plan's rules.
  const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8')), warned = {};
  let n = 0;
  posts.forEach((post, i) => {
    const lyrics = lyricsFromPost(post);
    for (const track of TRACK_ORDER) for (const own of [false, true]) {
      const cast = own ? castSong(post, {track}).cast : undefined, plan = settleCast(FORMS.drop60.arrange, lyrics, REAL, {track, cast}).plan, v = lintPlan(plan);
      const errors = v.filter(x => x.level === 'error');
      ok(!errors.length, `${i ? `fixture ${i - 1}` : 'sample'} ${track}${own ? ' (its cast)' : ''}: the plan keeps the constitution${errors.length ? `: ${describe(errors).join('; ')}` : ''}`);
      for (const x of v) warned[`${track} ${x.rule}`] = (warned[`${track} ${x.rule}`] ?? 0) + 1;
      n++;
    }
  });
  console.log(`constitution, ${n} plans: 0 errors; warnings ${Object.entries(warned).map(([k, c]) => `${k} x${c}`).join(', ') || 'none'}`);
  // The plan's rules bite too, and a measured render's.
  const lyrics = lyricsFromPost(SAMPLE_POST), plan = FORMS.drop60.arrange(lyrics, {}, {track:'humbled-and-honored'}), prules = (p, r) => lintPlan(p, r).filter(x => x.level === 'error').map(x => x.rule);
  ok(prules({...plan, choke:{...plan.choke, tagEnd:plan.choke.tagEnd - .26}}).includes('impact.gap'), 'lint: the old 0.66 s wait on Humbled and Honored is an error');
  const good = {loudness:{integrated_lufs:-10.2, true_peak_dbtp:-1.1}, drop_vs_verse:[{drop:'Drop A', lift_lu:4.6, phone_lift_lu:2.8}, {drop:'Drop B', lift_lu:4.7, phone_lift_lu:3.5}], silence:[{span:'36.15-36.29', peak_dbfs:null}], whisper:[]};
  ok(!prules(plan, good).length, 'lint: a render on its targets passes');
  ok(prules(plan, {...good, loudness:{integrated_lufs:-13, true_peak_dbtp:-.4}}).includes('mix.loudness') && prules(plan, {...good, drop_vs_verse:[good.drop_vs_verse[0], {drop:'Drop B', lift_lu:3, phone_lift_lu:1.9}]}).includes('mix.drops')
    && prules(plan, {...good, silence:[{span:'36.15-36.29', peak_dbfs:-48}]}).includes('mix.silence'), 'lint: loudness, a drop that does not lift on a phone, noise before the impact: errors');
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
// ---- 7. The band in the Drop Edition (band.js): Synergy sings the post and his hook at most
// three times; Strategy, Synthia and her recordings sing the lexicon in his other repeats. On the
// sample and the 60 fixtures, every Drop Edition track, cast by the post with the voice bank's
// takes (castSong available), real eSpeak durations.
{
  const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8'));
  const DROP = TRACK_ORDER.filter(t => (TRACKS[t].form ?? 'drop60') === 'drop60'), tally = {}, left = {};
  let n = 0;
  const hookCount = plan => plan.lines.filter(l => l.kind === 'hook' || l.kind === 'answer').reduce((k, l) => k + 1 + l.words.some(w => w.repeat), 0);
  posts.forEach((post, i) => {
    const lyrics = lyricsFromPost(post);
    for (const track of DROP) {
      const r = castSong(post, {track, available:AVAILABLE}), plan = settleCast(FORMS.drop60.arrange, lyrics, REAL, {track, cast:r.cast}).plan, T = plan.timing, tr = TRACKS[track];
      const tag = `${i ? `fixture ${i - 1}` : 'sample'} ${track}`, at = e => T[Math.floor(e.at)] + (e.at % 1) * plan.step, len = e => Math.min(e.gate, (e.to - e.from) / e.rate + .01);
      n++;
      ok(hasBand(r.cast) && hookCount(plan) <= SYNERGY_HOOKS, `${tag}: Synergy sings his hook ${hookCount(plan)} times (at most ${SYNERGY_HOOKS})`);
      ok(json(plan) === json(settleCast(FORMS.drop60.arrange, lyrics, REAL, {track, cast:r.cast}).plan), `${tag}: the band's plan is deterministic`);
      const voices = [...plan.words.map(w => [T[w.at], T[w.at] + w.gate, 'synergy']), ...plan.stutters.map(x => [T[x.at], T[x.at] + plan.step * .8, 'synergy']), ...plan.lady.map(e => [at(e), at(e) + len(e), e.role === 'ladder' ? 'ladder' : 'lady'])];
      for (const e of plan.band) {
        const entry = SONG_TABLE[e.file], words = (e.display ?? '').split(' ');
        ok(entry && e.to > e.from && e.gate >= (e.to - e.from) / e.rate - 1e-9 && Math.abs(e.start - at(e)) < 1e-9 && Math.abs(e.end - (e.start + len(e))) < 1e-9 && e.end <= plan.duration,
          `${tag}: ${e.role} "${e.display}" (${e.voice}) plays whole, ${e.start.toFixed(2)}-${e.end.toFixed(2)} s`);
        ok(e.words.length === words.length && e.words.every(w => w.start >= e.start - 1e-9 && w.end <= e.end + .011 && w.end > w.start), `${tag}: ${e.role} "${e.display}": one word per display word, on its measured times`);
        if (e.key) {
          const reg = VOICES[e.voice].register;
          ok(e.notes.length && e.notes.every(x => tr.pitchClasses.includes(((x.midi % 12) + 12) % 12) && tr.drop.ladder.pentatonic.includes(((x.midi % 12) + 12) % 12) && x.midi >= reg.lo - 2 && x.midi <= reg.hi + 2) && e.rate <= MAX_RATE + 1e-9,
            `${tag}: ${e.role} "${e.display}" sung on the ${tr.key} pentatonic in ${e.voice}'s register (${e.notes.map(x => x.midi).join(' ')}), x${e.rate.toFixed(2)}`);
        }
        // No two voices at once: the band keeps GUARD from Synergy, her lines and each other (the couplet drop's X sings over her ladder, by design).
        const clash = [...voices.filter(v => !(e.role === 'x' && v[2] === 'ladder')), ...plan.band.filter(b => b !== e).map(b => [b.start, b.end, 'band'])].find(([a, b]) => e.end + GUARD - 1e-6 > a && e.start < b + GUARD - 1e-6);
        ok(!clash, `${tag}: ${e.role} "${e.display}" keeps its air${clash ? ` (meets ${clash[2]} at ${clash[0].toFixed(2)} s)` : ''}`);
        ok(e.end <= plan.choke.time + 1e-9 || e.start >= T[plan.choke.until] - 1e-9, `${tag}: ${e.role} "${e.display}" stays out of the choke's silence`);
        tally[`${track} ${e.part.replace(/\.\d$/, '')}`] = (tally[`${track} ${e.part.replace(/\.\d$/, '')}`] ?? 0) + 1;
      }
      for (const l of plan.bandLeft) left[`${track} ${l.part.replace(/ \(bar \d+\)/, '')}`] = (left[`${track} ${l.part.replace(/ \(bar \d+\)/, '')}`] ?? 0) + 1;
      // The couplet's drop: her tag and impact roles, sung by the band, the same moment.
      const tg = plan.lady.find(e => e.role === 'tag'), imp = plan.lady.find(e => e.role === 'impact');
      if (plan.drop.kind === 'couplet') {
        ok(tg.couplet === r.cast.dropTag.id && imp.display === r.cast.dropTag.impact.display && tg.rate <= TAG_MAX_RATE + 1e-9 && tg.gate >= (tg.to - tg.from) / tg.rate - 1e-9 && imp.at === plan.marks.impact,
          `${tag}: the couplet drops, "${tg.display}" then "${imp.display}" on the downbeat`);
        const xs = plan.band.filter(e => e.role === 'x');
        ok(xs.length >= 1 && xs.every(x => tr.drop.answers.bars.includes(Math.floor((x.at + 1) / 16))) && !plan.words.some(w => w.kind === 'answer'), `${tag}: "${xs[0]?.display}" over the build's answer bars, ${xs.length}x, his answers gone`);
      } else ok(!tg.couplet && !plan.band.some(e => e.role === 'x'), `${tag}: her drop`);
      // The sign-off: the band's line where his "Let's circle back" was (Circle Back's title gives it back to him), and nothing of the band after it.
      const so = plan.band.find(e => e.role === 'signoff'), close = plan.lines.some(l => l.text === HOST.close);
      if (r.cast.signoff?.voice === 'synergy') ok(close && !so, `${tag}: Synergy signs off, "Let's circle back"`);
      else ok(!close && (!so || plan.band.every(e => e === so || e.end <= so.start + 1e-9)), `${tag}: the sign-off "${so?.display ?? '(no gap)'}" is the band's last line`);
      const circle = plan.lines.filter(l => l.text === HOST.close).length + plan.lady.filter(e => e.role === 'tag' && e.file === '06.wav').length;
      ok(circle <= 1, `${tag}: "Let's circle back" at most once`);
    }
  });
  console.log(`the band, ${n} Drop Edition songs: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}; left out (no gap): ${Object.entries(left).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  // Every track schedules the band cleanly, the same twice; the default cast's plan has no band.
  for (const track of DROP) {
    const lyrics = lyricsFromPost(SAMPLE_POST), r = castSong(SAMPLE_POST, {track, available:AVAILABLE}), d = Object.fromEntries(FORMS.drop60.voiced(lyrics, {track}).map(w => [w, models.fake(w)]));
    const plan = FORMS.drop60.arrange(lyrics, d, {track, cast:r.cast}), a = await record(plan, {mode:'sung'}), b = await record(FORMS.drop60.arrange(lyrics, d, {track, cast:r.cast}), {mode:'sung'});
    ok(a.calls > 10000 && a.sha === b.sha && E.exactReport(a.ctx).every(x => x.overlap <= 2), `${track}: the band's Drop Edition makes ${a.calls} valid Web Audio calls, the same twice, every input at most two at once`);
    ok(FORMS.drop60.arrange(lyrics, d, {track}).band.length === 0, `${track}: today's cast has no band (the A/B against the stock lines)`);
  }
}

// ---- 8. The river (wander.js, river.js): Offsite's form. The sample and the 60 fixtures, cast by the post
// and with today's cast: the constitution's river rules on every plan, the fields the Peg Board and the video
// read, the textures in key, the loop in every bar, the few clear phrases; scheduling, deterministic.
{
  const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8'));
  const RT = TRACK_ORDER.filter(t => TRACKS[t].form === 'wander'), stats = {phrases:[], layers:[]};
  ok(RT.length === 1 && RT[0] === 'offsite' && FORMS.wander.tracks.join() === 'offsite', 'the river: Offsite plays it');
  posts.forEach((post, i) => {
    const lyrics = lyricsFromPost(post);
    for (const track of RT) for (const own of [false, true]) {
      const cast = own ? castSong(post, {track, available:AVAILABLE}).cast : undefined, plan = FORMS.wander.arrange(lyrics, REAL, {track, cast}), T = plan.timing, W = TRACKS[track].wander;
      const tag = `${i ? `fixture ${i - 1}` : 'sample'} ${track} river${own ? ' (its cast)' : ''}`, bar = 16 * plan.step, errors = lintPlan(plan).filter(x => x.level === 'error');
      ok(!errors.length, `${tag}: keeps the constitution${errors.length ? `: ${describe(errors).join('; ')}` : ''}`);
      ok(json(plan) === json(FORMS.wander.arrange(lyrics, REAL, {track, cast})), `${tag}: deterministic`);
      ok(plan.form === 'wander' && plan.choke === null && plan.call === null && plan.lady.length === 0 && plan.stutters.length === 0 && Math.abs(T[plan.totalSteps] - 60) < 1 && plan.stop.fade[1] <= T[plan.totalSteps] + 1e-9,
        `${tag}: no ladder, choke or BACK., ${T[plan.totalSteps].toFixed(1)} s, a long fade ${plan.stop.fade.map(x => x.toFixed(1)).join('-')} s`);
      // The layers: each ramps in and out over 2 to 8 bars on curves in time order.
      for (const l of plan.layers) {
        const mono = pts => pts.every((p, k) => !k || p[0] > pts[k - 1][0]);
        ok(l.in[1] - l.in[0] >= RIVER.minRamp * bar - 1e-6 && l.out[1] - l.out[0] >= RIVER.minRamp * bar - 1e-6 && l.in[1] - l.in[0] <= RIVER.maxRamp * bar + 1e-6 && l.out[1] - l.out[0] <= RIVER.maxRamp * bar + 1e-6
          && mono(l.gain) && mono(l.filter) && l.gain[0][1] === 0 && l.gain.at(-1)[1] === 0 && levelAt(l, (l.in[1] + l.out[0]) / 2) > 0, `${tag}: layer ${l.id} ramps in ${((l.in[1] - l.in[0]) / bar).toFixed(1)} and out ${((l.out[1] - l.out[0]) / bar).toFixed(1)} bars`);
        if (l.kind === 'texture') {
          const loop = plan.loops.find(x => x.id === l.source), hits = textureHits(W, l, loop, plan);
          ok(loop && loop.cuts.every(c => c.to > c.from && Number.isFinite(c.base)) && hits.length && hits.every(h => W.pentatonic.includes(((h.midi % 12) + 12) % 12) && h.at >= 0 && h.at < 32 * plan.step),
            `${tag}: texture ${l.id} cuts "${loop?.text}" on ${hits.length} hits in key`);
        }
      }
      // The clear phrases: the band's (her or Synthia's word after a pickup is one), Synergy's hook once.
      for (const e of plan.band) ok(e.clear && e.rise[1] === e.start && e.sink[0] === e.end && e.words.length && SONG_TABLE[e.file], `${tag}: "${e.display}" rises out of the stream at ${e.start.toFixed(2)} s and sinks back in`);
      ok(plan.lines.length <= 1 && plan.words.every(w => !w.repeat), `${tag}: Synergy sings his hook ${plan.lines.length ? 'once' : 'not at all'}`);
      ok(plan.swells.every(w => w.from > w.ref[1] - 1e-9 && w.to <= T[plan.totalSteps] + 1e-9) && plan.slow.every(w => w.to > w.from && !w.whole), `${tag}: swells and slow spans`);
      if (own) { stats.phrases.push(plan.band.filter(e => e.role !== 'pickup').length + plan.lines.length); stats.layers.push(plan.layers.length); }
    }
  });
  console.log(`the river, ${posts.length * 2} plans: 0 constitution errors; clear phrases per song ${Math.min(...stats.phrases)}-${Math.max(...stats.phrases)} (Synergy's hook included), layers ${Math.min(...stats.layers)}-${Math.max(...stats.layers)}`);
  // Schedules cleanly through the validating fake context, the same twice, every input at most two at once.
  for (const own of [false, true]) {
    const lyrics = lyricsFromPost(SAMPLE_POST), cast = own ? castSong(SAMPLE_POST, {track:'offsite', available:AVAILABLE}).cast : undefined, d = Object.fromEntries(FORMS.wander.voiced(lyrics, {track:'offsite'}).map(w => [w, models.fake(w)]));
    const plan = FORMS.wander.arrange(lyrics, d, {track:'offsite', cast}), a = await record(plan, {mode:'sung'}), b = await record(FORMS.wander.arrange(lyrics, d, {track:'offsite', cast}), {mode:'sung'});
    ok(a.calls > 10000 && a.sha === b.sha && E.exactReport(a.ctx).every(x => x.overlap <= 2), `the river${own ? ' (the sample\'s cast)' : ''}: ${a.calls} valid Web Audio calls, the same twice, every input at most two at once`);
    const ex = await record(plan, {mode:'sung', bars:[12, 16]});
    ok(ex.calls > 1000, `the river: an excerpt (bars 12-16) schedules from mid-song (${ex.calls} calls)`);
  }
}

// ---- 9. Delve. (songbook/delve.js): her vocabulary on the river
{
  const D = TRACKS.delve, W = D.wander, errorsOf = v => v.filter(x => x.level === 'error'), rulesOf = t => errorsOf(lintTrack(t)).map(x => x.rule);
  // The Offsite river is the plan it was before Delve. joined the book (sample + 60 fixtures, both casts, real durations).
  const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8')), h = createHash('sha256');
  for (const post of posts) for (const own of [false, true]) h.update(canon(FORMS.wander.arrange(lyricsFromPost(post), REAL, {track:'offsite', cast:own ? castSong(post, {track:'offsite', available:AVAILABLE}).cast : undefined})));
  ok(h.digest('hex') === '49badff24a0f42c631f70cdc4932d8021e1811c92b28a8f45ccbe6efdd105289', 'Delve.: the Offsite river plans (122) are byte for byte what they were');
  // Playable by id, never picked: out of TRACK_ORDER, the pickers and the casting.
  ok(!TRACK_ORDER.includes('delve') && D.form === 'wander' && !FORMS.wander.tracks.includes('delve') && posts.every(post => castSong(post, {available:AVAILABLE}).track !== 'delve'), 'Delve.: playable by id, never in the pickers or cast by a post');
  // The chart: no errors, exactly its two declared breaks (her phrases are the content; two minutes).
  const v = lintTrack('delve');
  ok(!errorsOf(v).length && v.length === 2 && v.every(x => x.declared) && v.map(x => x.rule).sort().join() === 'river.form,river.phrases', `Delve.: the chart keeps the constitution, breaking two rules on purpose (${v.map(x => x.rule).join(', ')})`);
  // The lint still bites under the breaks: phrases three bars apart, a length outside the chart's window, a loud tambourine.
  const bite = w => rulesOf({...D, wander:{...W, ...w}});
  ok(bite({setlist:W.setlist.map(p => p.id === 'P3' ? {...p, bar:8} : p)}).includes('river.phrases'), 'Delve.: under the declared break, phrases three bars apart are still an error');
  ok(bite({seconds:[55, 65]}).includes('river.form') && bite({breaks:{'river.phrases':W.breaks['river.phrases']}}).includes('river.form'), 'Delve.: two minutes outside its own window, or undeclared, is an error');
  ok(bite({layerSpec:W.layerSpec.map(l => l.kind === 'tambourine' ? {...l, swell:[[19, 1.8]]} : l)}).includes('river.tambourine') && bite({pentatonicAt:b => (b === 26 ? [9, 11, 1, 4, 5] : W.pentatonicAt(b))}).includes('melody.pentatonic'), 'Delve.: a loud tambourine, or a Pool pentatonic out of key, is an error');
  // The chart's own limits: ramps 2-8 bars, at most two entrances a bar (the loop's own hands included), steps of .12 at most, the tambourine up 1.45x at most.
  const entering = {};
  for (const l of W.layerSpec) entering[Math.floor(l.in[0])] = (entering[Math.floor(l.in[0])] || 0) + 1;
  const loopIn = W.layerSpec.find(l => l.kind === 'loop').in[0];
  for (const b of Object.values(W.loop.from)) if (b > loopIn) entering[b] = (entering[b] || 0) + 1;   // (its first hands are the loop layer's own entrance)
  const e = Array.from({length:W.fade[0] + 1}, (_, b) => W.energy(b)), tamb = W.layerSpec.find(l => l.kind === 'tambourine');
  ok(W.layerSpec.every(l => l.in[1] - l.in[0] >= 2 && l.in[1] - l.in[0] <= 8 && l.out[1] - l.out[0] >= 2 && l.out[1] - l.out[0] <= 8) && Object.values(entering).every(n => n <= 2)
    && e.every((x, i) => !i || Math.abs(x - e[i - 1]) <= .12 + 1e-9) && Math.max(...tamb.swell.map(x => x[1])) <= 1.45, `Delve.: every ramp 2-8 bars, at most ${Math.max(...Object.values(entering))} entrances a bar, energy steps of ${Math.max(...e.map((x, i) => (i ? Math.abs(x - e[i - 1]) : 0))).toFixed(3)} at most`);
  // The plan, twice: the same; 48 bars, 120.0 s and a 0.6 s tail; no errors, the two declared breaks.
  const lyrics = lyricsFromPost(SAMPLE_POST), plan = FORMS.wander.arrange(lyrics, {}, {track:'delve'}), T = plan.timing, step = plan.step, bar = 16 * step;
  ok(json(plan) === json(FORMS.wander.arrange(lyrics, {}, {track:'delve'})) && json(plan) === json(FORMS.wander.arrange(lyricsFromPost(posts[7]), REAL, {track:'delve'})), 'Delve.: the plan is the same on every run, whatever the post');
  const pv = lintPlan(plan);
  ok(!errorsOf(pv).length && pv.every(x => x.declared) && Math.abs(T[plan.totalSteps] - 120) < 1e-9 && Math.abs(plan.duration - 120.6) < 1e-9 && Math.round(plan.duration * 24) === 2894, `Delve.: the plan keeps the constitution (${pv.map(x => x.rule).join(', ')} declared), 120.0 s + 0.6 s`);
  // Her phrases: each first vowel on its 16th; starts four bars apart, three bars of stream between, never two voices.
  const band = plan.band;
  ok(band.length === 10 && band.every((x, i) => x.own && x.voice === 'lady' && Math.abs(x.words[0].onset - T[W.setlist[i].bar * 16 + (W.setlist[i].step ?? 0)]) < 1e-3), 'Delve.: her ten phrases, each first vowel on its 16th (within a millisecond: the slowing tape\'s warp is integrated at 1 ms)');
  ok(band.every((x, i) => !i || (x.start - band[i - 1].start >= 4 * bar - 2 * step && x.start - band[i - 1].end >= 3 * bar)), `Delve.: phrases four bars apart, three bars of stream between (gaps ${band.slice(1).map((x, i) => (x.start - band[i].end).toFixed(1)).join(', ')} s)`);
  // Her echoes: after their phrase, and gone a beat before the next rises (the echo to fade at its line's end).
  const ends = band.map(x => Math.max(x.end, ...plan.echoes.filter(h => h.phrase === x.id).map(h => (h.lineSpec ? h.lineSpec.to : h.end))));
  // (the frozen grain takes over "of..." as it ends: it may start up to 30 ms before the word's last sample)
  ok(plan.echoes.every(h => h.at >= band.find(x => x.id === h.phrase).end - .03) && band.every((x, i) => !i || ends[i - 1] <= x.start - 4 * step + 1e-6), `Delve.: every echo after its phrase, every chain gone a beat before the next phrase (${band.slice(1).map((x, i) => (x.start - ends[i]).toFixed(2)).join(', ')} s)`);
  const kinds = new Set(plan.echoes.map(h => h.kind));
  ok(['delay', 'reverb', 'fifth', 'octave', 'fade', 'step', 'freeze', 'canon'].every(k => kinds.has(k)) && plan.echoes.filter(h => h.phrase === 'P1').map(h => h.kind).join() === 'delay,delay,delay,reverb,fifth,octave,fade,fade,fade', 'Delve.: "Delve." on delay, in reverb, down a fifth, down an octave, then the echo to fade; every stage of hers present');
  const canonVoices = [...new Set(plan.echoes.filter(h => h.kind === 'canon').map(h => h.voice))], at = t => plan.echoes.filter(h => h.kind === 'canon' && h.at <= t + 1e-6).length;
  ok(canonVoices.length === 8 && new Set(plan.echoes.filter(h => h.kind === 'canon' && h.at < T[41 * 16 + 15]).map(h => h.voice)).size === 8 && plan.echoes.filter(h => h.kind === 'canon').every(h => h.end <= T[44 * 16] + 1e-6), 'Delve.: the canon compounds to eight voices by bar 41 and closes by bar 44');
  ok(plan.clarity.every((p, i) => !i || p[0] >= plan.clarity[i - 1][0]) && plan.clarity.at(-1)[1] === 1 && plan.clarity.some(p => p[1] === 0), 'Delve.: her clarity goes from crisp to the choir and comes back clear');
  // In key: the setlist's tuned phrases, the composed notes of her echoes, the choir, the stars (each on its bar's pentatonic).
  const inKey = m => D.pitchClasses.includes(((Math.round(m) % 12) + 12) % 12);
  ok(band.every(x => Number.isInteger(x.midi) && inKey(x.midi)) && plan.choir.every(c => c.midi.length === 4 && c.midi.every(inKey)) && plan.echoes.filter(h => h.notes).every(h => h.notes.every(n => inKey(n[2]))), 'Delve.: her phrases, her choir and her canon in E Dorian');
  ok(plan.stars.twinkles.every(s => W.pentatonicAt(Math.floor(s.t / bar + 1e-9)).includes(((s.midi % 12) + 12) % 12)) && plan.stars.twinkles.slice(0, 3).every((s, i) => Math.abs(s.t - band[5].words[i].onset) < 1e-3) && Math.abs(plan.stars.at - 60) < 1e-9,
    `Delve.: ${plan.stars.twinkles.length} stars on their bars' pentatonic, the first three born on "A rich tapestry"`);
  // The fields the film reads.
  const m = plan.marks;
  ok(m.mouth === 55 && m.kiss === 59.375 && m.star === 60 && m.slow === 71.25 && m.swell2 === 85 && m.canon === 95 && m.delta === 105 && m.undraw === 117.5 && plan.clearMax === 10 && plan.swells.length === 2 && plan.swells.every(w => w.refBars.join() === '5,12')
    && band.every(x => x.words.every(w => w.file && w.start <= w.end) && ['stage', 'clarity', 'index', 'split', 'font', 'k'].every(k => k in x)) && plan.bars.every(b => b.pentatonic?.length === 5), 'Delve.: the marks, swells, phrases, words and bars the film reads');
  // It schedules cleanly through the validating fake context, the same twice, every input at most two at once; an excerpt from mid-song too.
  const a = await record(plan, {mode:'sung'}), b = await record(FORMS.wander.arrange(lyrics, {}, {track:'delve'}), {mode:'sung'});
  ok(a.calls > 20000 && a.sha === b.sha && E.exactReport(a.ctx).every(x => x.overlap <= 2), `Delve.: ${a.calls} valid Web Audio calls, the same twice, every input at most two at once`);
  const ex = await record(plan, {mode:'sung', bars:[30, 36]});
  ok(ex.calls > 2000, `Delve.: an excerpt (bars 30-36) schedules from mid-song (${ex.calls} calls)`);
}
// ---- 10. Day One (src/films/day-one/score.js): a film's song, the roll
{
  const S = await import('../src/films/day-one/score.js'), TL = await import('../src/films/day-one/timeline.js'), C = S.CHART, R = C.roll;
  const {readFile} = await import('node:fs/promises'), read = async file => new Uint8Array(await readFile(new URL(`../public/films/day-one/voices/${file}`, import.meta.url)));
  const errorsOf = v => v.filter(x => x.level === 'error'), rulesOf = t => errorsOf(lintTrack(t)).map(x => x.rule);
  // Not a song book track: never in the pickers, the forms or the casting.
  ok(!TRACKS['day-one'] && !TRACK_ORDER.includes('day-one') && !Object.values(FORMS).some(f => (f.tracks || []).includes('day-one')), 'Day One: a film\'s chart, out of the song book\'s pickers, forms and casting');
  // The chart: no errors, exactly its three declared breaks.
  const v = lintTrack(C);
  ok(!errorsOf(v).length && v.length === 3 && v.every(x => x.declared) && v.map(x => x.rule).sort().join() === 'form.ending,form.order,form.vocal', `Day One: the chart keeps the constitution, breaking three rules on purpose (${describe(v).join('; ')})`);
  // The lint still bites under the breaks.
  const plan = R.plan, motifAt = plan.findIndex(s => s.part === 'final');
  const near = plan.map(s => (s.part === 'wave2' && s.B === 30 ? {...s, B:23} : s));                                  // a copy beside Voice 1
  ok(rulesOf({...C, roll:{...R, plan:near}}).includes('form.vocal'), 'Day One: under the declared break, a copy beside the motif is still an error');
  const high = plan.map(s => (s.part === 'wave5' ? {...s, copies:s.copies.map((c, i) => (i ? c : {...c, midi:57, role:54}))} : s));   // Strategy on A3, outside B2-F#3
  ok(rulesOf({...C, roll:{...R, plan:high}}).includes('form.vocal'), 'Day One: a copy outside its singer\'s range is an error');
  ok(rulesOf({...C, roll:{...R, plan:[...plan.slice(0, motifAt), {...plan[motifAt], copies:[{...plan[motifAt].copies[0], space:{wash:.3}}]}]}}).includes('form.ending'), 'Day One: a wet last line is an error');
  ok(rulesOf({...C, roll:{...R, seconds:70}}).includes('form.order') && rulesOf({...C, roll:{...R, kicks:[...R.kicks, 30.5, 31.5]}}).includes('tempo.doubleTime'), 'Day One: 70 s, or five kicks a bar, is an error');
  ok(rulesOf({...C, chords:{...C.chords, Bm9:{...C.chords.Bm9, arp:[...C.chords.Bm9.arp, 60]}}, chordAt:b => (b % 4 < 2 ? {...C.chords.Bm9, arp:[60]} : C.chords.Gmaj9)}).includes('melody.pentatonic'), 'Day One: an arpeggio note off the pentatonic is an error');
  ok(rulesOf({...C, mix:{...C.mix, tape:{...C.mix.tape, wow:.2}}}).includes('production.tape') && rulesOf({...C, roll:{...R, printer:[]}}).includes('band.printer'), 'Day One: wow on the master, or no printer, is an error');
  // The one clock: every statement is a cue of timeline.js, every tick a number that changes on screen.
  const cues = TL.cues();
  ok(plan.length === cues.length && plan.every((s, i) => s.B === cues[i].B && s.part === cues[i].part) && plan.filter(s => s.part === 'voice1' || s.part === 'final').map(s => s.B).join() === '22,92', `Day One: ${plan.length} statements on timeline.js's cues, the motif on B22 and B92`);
  const copies = plan.flatMap(s => s.copies.map(c => ({s, c}))), byPart = p => plan.filter(s => s.part === p);
  ok(byPart('wave3').every(s => s.copies.length === 3) && byPart('wave5').every(s => s.copies.length === 6) && byPart('wave6').length === 8 && byPart('wall').length === 16 && byPart('robot')[0].copies.length === 0
    && copies.every(({s, c}) => c.motif || Math.abs(c.gainDb - (-10 * Math.log10(cues.find(q => q.B === s.B).copies) + R.copyDb[c.voice])) < 1e-3), 'Day One: the copies per wave (1, 2, 3, 4, 6, 8, 8-10, 0, 16), each at -10 log10(N) dB');
  ok(byPart('wall').every((s, i) => s.copies[0].midi === R.wall[i] && Math.abs(s.copies[0].pan) === .8) && byPart('wave2').every(s => !s.copies[0].pan) && copies.every(({c}) => c.human >= 0 && c.human <= .025),
    'Day One: the wall climbs the pentatonic an entry at +-0.8, waves 1 and 2 centred, every copy humanised 0-25 ms');
  // It schedules cleanly through the validating fake context, the same twice, every input at most two at once.
  const run = async () => { const r = await S.renderScore({read, normalize:false}); return {r, log:last.log, ctx:last}; };
  const a = await run(), b = await run();
  ok(a.log.length > 20000 && sha(canon(a.log)) === sha(canon(b.log)) && E.exactReport(a.ctx).every(x => x.overlap <= 2), `Day One: ${a.log.length} valid Web Audio calls, the same twice, every input at most two at once`);
  const m = a.r.marks, motif = m.grats;
  const lag = motif[1] && motif[1].start - TL.tOf(TL.EVENTS.doug);
  ok(motif.length === 2 && Math.abs(motif[0].t - TL.tOf(22)) <= 1 / 30 && lag >= 0 && lag <= .1 && Math.abs((motif[1].end - motif[1].start) - (motif[0].end - motif[0].start)) < 1e-9 && m.silence[0].from === TL.tOf(91) && m.silence[0].to === Math.min(motif[1].start, TL.tOf(TL.EVENTS.doug)),
    `Day One: Voice 1's "grats" ${((motif[0].t - TL.tOf(22)) * 1000).toFixed(1)} ms from B22; the last line starts ${(lag * 1000).toFixed(1)} ms after Doug's reply and its tick; the silence from B91 to the tick (${(m.silence[0].to - m.silence[0].from).toFixed(3)} s)`);
  ok(m.ticks.length === TL.ticks().length && m.ticks.every((k, i) => k.t === TL.ticks()[i].t), `Day One: ${m.ticks.length} ticks, one for every number that changes on screen`);
}
console.log(`song book: ${checks} checks passed`);
