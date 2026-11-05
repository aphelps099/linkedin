// The voice bank's guarantees, in Node (src/allhands/voices/README.md):
//   1. The manifest matches the files: every take in public/allhands/voices/ is
//      the manifest's (bytes, sha256), FLAC 44.1 kHz mono 16-bit, and decodes in
//      flac.js to the samples its encoder was given (STREAMINFO's MD5 of the PCM);
//      its stored pitch track is the one pixel.js computes from those samples;
//      no file is left over.
//   2. Boundaries are sane: words in order inside the take, the vowel onset and
//      the syllable nuclei inside their word, the take trimmed to the speech, the
//      words the lyric's words, f0 in the voice's range.
//   3. Every lexicon line a song may cast has a take Whisper passed: every line
//      Strategy has (he leads), every line the lexicon gives Synthia either hers
//      or marked Strategy-only (long, or she failed it), every take casting names
//      (vocabulary/takes.js TAKES) available in some voice, every drop impact cut
//      ready; each take at its voice's verified amount.
//   4. The loader and the chain: loadVoices gives the same samples by fetch (the
//      page) and by reading the disk (Node); sing() is deterministic, keeps the
//      take's length, and lands its notes.
//   5. The tambourine (instruments.js): deterministic, no two strikes of a bar of
//      16ths alike, a 1-3 kHz body, its Web Audio voice playing the same strike.
//   node scripts/check-song-voices.mjs [--manifest PATH] [--public DIR]
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const MANIFEST_PATH = resolve(root, arg('manifest', 'src/allhands/voices/song-voices.json'));
const PUBLIC = resolve(root, arg('public', 'public/allhands/voices'));
const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const {decodeFlac, pitchFromTag, pitchToTag} = await import('../src/allhands/voices/flac.js');
const {pitchTrack, hzMidi} = await import('../src/allhands/voices/pixel.js');
const {LINES, CUTS, fileOf} = await import('../src/allhands/voices/lines.js');
const {VOICES} = await import('../src/allhands/voices/items.js');
const VT = await import('../src/allhands/voices/voice-table.js');
const {readVoice} = await import('../src/allhands/voices/node.js');
const I = await import('../src/allhands/instruments.js');

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const custom = arg('manifest') || arg('public');
if (!custom) ok(VT.VOICE_TABLE && Object.keys(VT.VOICE_TABLE).length === M.entries.length, 'voice-table.js reads the manifest');

// ---- 1. the manifest and the files
ok(M.version === 2 && M.sampleRate === 44100 && M.format === 'flac' && M.base === 'allhands/voices/', 'manifest: version 2, 44.1 kHz FLAC under allhands/voices/');
const files = new Set(M.entries.map(e => e.file));
ok(files.size === M.entries.length, 'one take per file');
let bytes = 0, seconds = 0;
const decoded = new Map();
for (const e of M.entries) {
  const path = join(PUBLIC, e.file);
  ok(existsSync(path), `${e.file}: published`);
  const b = readFileSync(path);
  bytes += b.length; seconds += e.duration;
  ok(b.length === e.bytes && createHash('sha256').update(b).digest('hex') === e.sha256, `${e.file}: bytes and sha256 match the manifest`);
  const f = decodeFlac(new Uint8Array(b));
  ok(f.sampleRate === 44100 && f.channels.length === 1 && f.bitsPerSample === 16 && f.samples === e.samples, `${e.file}: 44.1 kHz mono 16-bit, ${e.samples} samples`);
  const pcm = Buffer.alloc(f.samples * 2);
  f.ints[0].forEach((v, i) => pcm.writeInt16LE(v, 2 * i));
  ok(createHash('md5').update(pcm).digest('hex') === f.md5, `${e.file}: flac.js decodes exactly what the encoder was given (STREAMINFO MD5)`);
  ok(Math.abs(e.duration - f.samples / 44100) < 1e-3, `${e.file}: duration`);
  const track = pitchFromTag(f.tags.PIXEL_PITCH);
  ok(track && track.hop === .005 && track.f0.every(v => v === 0 || (v > 50 && v < 500)), `${e.file}: a stored pitch track (5 ms, 50-500 Hz)`);
  eq(pitchToTag(track), pitchToTag(pitchTrack(f.channels[0], 44100)), `${e.file}: the stored pitch track is pixel.js's, from these samples`);
  decoded.set(e.file, f);
}
const published = existsSync(PUBLIC) ? readdirSync(PUBLIC).flatMap(v => statSync(join(PUBLIC, v)).isDirectory() ? readdirSync(join(PUBLIC, v)).map(f => `${v}/${f}`) : [v]) : [];
eq(published.filter(f => !files.has(f)), [], 'no published file the manifest does not name');

// ---- 2. boundaries
const tokens = text => text.split(/\s+/).filter(t => /[A-Za-z0-9]/.test(t));
const F0 = {strategy:[60, 170], synthia:[120, 300]};
for (const e of M.entries) {
  const w = e.words, eps = .002;
  eq(w.map(x => x.text), tokens(e.text), `${e.file}: the words are the lyric's`);
  ok(e.voiced[0] === w[0].start && e.voiced[1] === w.at(-1).end && e.voiced[1] <= e.duration + eps, `${e.file}: voiced span is the words'`);
  ok(w[0].start <= .25 && e.duration - w.at(-1).end <= .35, `${e.file}: trimmed to the speech (${w[0].start.toFixed(3)} s before, ${(e.duration - w.at(-1).end).toFixed(3)} s after)`);
  w.forEach((x, i) => {
    ok(x.start < x.end && x.end - x.start >= (/^(a|an|the|to|of|in)$/i.test(x.text) ? .02 : .04), `${e.file} "${x.text}": a word of 40 ms or more (20 for an article or a preposition)`);
    ok(i === 0 || x.start >= w[i - 1].end - eps, `${e.file} "${x.text}": after the word before it`);
    ok(x.onset >= x.start - eps && x.onset <= x.end + eps, `${e.file} "${x.text}": its vowel onset is inside it`);
    ok(x.syllables.length >= 1 && x.syllables.every(([a, b], k) => a <= b && a >= x.start - eps && b <= x.end + eps && (k === 0 || a >= x.syllables[k - 1][1] - eps)),
      `${e.file} "${x.text}": syllable nuclei in order inside the word`);
  });
  ok(e.f0 >= F0[e.voice][0] && e.f0 <= F0[e.voice][1], `${e.file}: f0 ${e.f0} Hz in ${e.voice}'s range`);
  ok(Number.isFinite(e.gainDb) && Math.abs(e.gainDb) < 20, `${e.file}: a level`);
}

// ---- 3. coverage: every line a song may cast has a passing take
const has = (voice, id) => files.has(fileOf(voice, id));
const amounts = {strategy:[VOICES.strategy.amount], synthia:[VOICES.synthia.amount, VOICES.synthia.fallbackAmount]};
for (const e of M.entries) ok(amounts[e.voice].includes(e.amount), `${e.file}: sung at ${e.voice}'s verified amount (${e.amount})`);
let synthiaKept = 0, synthiaCandidates = 0;
for (const line of LINES) {
  const L = M.lines[line.id];
  ok(L, `${line.id}: in the line index`);
  ok(has('strategy', line.id) && L.voices.includes('strategy'), `${line.id}: Strategy sings it (he leads every new line)`);
  if (line.voices.includes('synthia')) {
    synthiaCandidates++;
    if (has('synthia', line.id)) { synthiaKept++; ok(L.voices[0] === 'synthia' && !L.strategyOnly, `${line.id}: Synthia first, her take passed`); }
    else ok(L.strategyOnly === 'failed', `${line.id}: Synthia failed it, so it is Strategy-only`);
  } else if (line.owner === 'synthia') ok(L.strategyOnly === 'long' && !has('synthia', line.id), `${line.id}: too long for Synthia, Strategy-only`);
  eq(L.voices, ['synthia', 'strategy'].filter(v => has(v, line.id)), `${line.id}: the index names exactly the voices with a take`);
}
for (const c of CUTS) {
  const cuts = M.cuts.filter(x => x.id === c.id);
  ok(cuts.length >= 1, `${c.id}: cut from a published take`);
  for (const x of cuts) {
    const src = M.entries.find(e => e.file === x.from), ws = src.words.slice(x.words[0], x.words[1] + 1);
    ok(ws.length && x.start === ws[0].start && x.end === ws.at(-1).end, `${c.id} (${x.voice}): its times are its words'`);
    if (c.kind === 'impact') eq(x.ready, ws.every(w => w.check === 'isolated'), `${c.id} (${x.voice}): ready exactly when Whisper hears the word alone`);
  }
  if (c.kind === 'impact') ok(cuts.some(x => x.ready), `${c.id}: the drop's impact is heard alone in some voice`);
  ok(VT.AVAILABLE.has(`strategy/${c.id}`) || VT.AVAILABLE.has(`synthia/${c.id}`) || custom, `${c.id}: available`);
}
// casting's ids (vocabulary/takes.js): each one available in some voice
let casting = null;
try { casting = await import('../src/allhands/vocabulary/takes.js'); } catch (err) { if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err; }
if (casting && !custom) {
  const missing = [...casting.TAKES.keys()].filter(id => !VT.AVAILABLE.has(`synthia/${id}`) && !VT.AVAILABLE.has(`strategy/${id}`));
  eq(missing, [], 'every take casting can name has a passing take in some voice');
  for (const [id, t] of casting.TAKES) if (!VT.AVAILABLE.has(`${t.voice}/${id}`)) ok(VT.voicesFor(id).length && (t.voice !== 'synthia' || VT.strategyOnly(id)), `${id}: not in ${t.voice}'s voice, so the index says who sings it`);
}

// ---- 4. the loader and the chain
if (!custom) {
  const sample = M.entries.filter((e, i) => i % Math.ceil(M.entries.length / 6) === 0).map(e => e.file);
  const fetcher = async url => ({ok:true, arrayBuffer:async () => { const b = readFileSync(join(PUBLIC, url.replace(VT.VOICE_BASE, ''))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }});
  const viaFetch = await VT.loadVoices(sample, {fetcher});
  for (const f of sample) {
    const a = viaFetch.get(f), d = decoded.get(f);
    ok(a.samples.length === d.samples && a.samples.every((v, i) => v === d.channels[0][i]) && a.sampleRate === 44100, `${f}: loadVoices (fetch) gives the take's samples`);
    const one = VT.sing(a, {key:'F', scale:'minorPenta', seed:7}), two = VT.sing({...a, analysis:undefined}, {key:'F', scale:'minorPenta', seed:7});
    ok(one.samples.length === a.samples.length && one.samples.every((v, i) => v === two.samples[i]), `${f}: sing() is deterministic and keeps the take's length (and word times)`);
    ok(one.notes.length >= 1 && one.notes.every(n => Number.isInteger(n.midi) && n.midi >= VOICES[a.entry.voice].register.lo - 2 && n.midi <= VOICES[a.entry.voice].register.hi + 2), `${f}: its notes in ${a.entry.voice}'s register`);
    ok(one.notes.length >= a.entry.words.length, `${f}: a note on every word`);
  }
  // the Node reader is the same loader
  const viaDisk = await VT.loadVoices(sample, {read:readVoice()});
  ok(sample.every(f => viaDisk.get(f) === viaFetch.get(f)), 'loadVoices caches a take once, whichever reader loaded it');
  const t = VT.takeFor(LINES.find(l => l.voices.includes('synthia') && VT.voicesFor(l.id)[0] === 'synthia')?.id);
  ok(t && t.voice === 'synthia' && VT.TAKE_TABLE[t.key] === t, 'takeFor() names the first voice of a line');
}

// ---- 5. the tambourine
{
  const step = 60 / 108 / 4, bar = Array.from({length:16}, (_, s) => ({t:2 + s * step, kind:'shake', v:.5}));
  const a = I.renderTambourine(bar, 2 + 16 * step + .3), b = I.renderTambourine(bar, 2 + 16 * step + .3);
  ok(a.every((v, i) => v === b[i]), 'tambourine: two renders are the same samples');
  const strikes = bar.map(e => I.tambourineStrike(e.t, e.v, e.kind)), ids = strikes.map(s => `${s.layer}:${s.k}:${s.rate}`);
  ok(new Set(ids).size === 16, 'tambourine: sixteen 16ths, sixteen different strikes (variant and a few cents of drift)');
  ok(strikes.every(s => Math.abs(1200 * Math.log2(s.rate)) <= 6.01), 'tambourine: drift within 6 cents');
  const variants = Array.from({length:12}, (_, k) => I.tambourineSamples(44100, {kind:'shake', v:.65, k}));
  ok(variants.every((x, k) => variants.every((y, j) => j === k || x.some((v, i) => v !== y[i]))), 'tambourine: the twelve rendered shakes all differ');
  // a 1-3 kHz body, and the jingles on top: band energy of a groove (radix-2 FFT, Hann)
  const groove = I.renderTambourine(I.tambourinePattern({bars:4, step, swing:.1, hits:[12], every:2, seed:9}), 4 * 16 * step + .5);
  const N = 1 << 18, re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < Math.min(N, groove.length); i++) re[i] = groove[i] * (.5 - .5 * Math.cos(2 * Math.PI * i / Math.min(N, groove.length)));
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      const c = Math.cos(ang * k), s = Math.sin(ang * k), xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
      re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi;
    }
  }
  const band = (lo, hi) => { let s = 0; for (let k = Math.ceil(lo * N / 44100); k < hi * N / 44100; k++) s += re[k] ** 2 + im[k] ** 2; return s; };
  const total = band(0, 22050), db = (lo, hi) => 10 * Math.log10(band(lo, hi) / total);
  let num = 0; for (let k = 0; k < N / 2; k++) num += k * 44100 / N * (re[k] ** 2 + im[k] ** 2);
  const centroid = num / total;
  ok(db(1000, 3000) > -16 && db(1000, 3000) < -6, `tambourine: a 1-3 kHz body in the groove (${db(1000, 3000).toFixed(1)} dB of the total; the prototype's was -25)`);
  ok(db(3000, 16000) > -2.5, `tambourine: most of it in the jingles, 3-16 kHz (${db(3000, 16000).toFixed(1)} dB)`);
  ok(centroid > 4500 && centroid < 8000, `tambourine: centroid ${Math.round(centroid)} Hz`);
  // the Web Audio voice plays the same strike, through a gain and a panner, and stops when it ends
  const made = [], node = kind => { const n = {kind, connect:to => { n.to = to; return to; }, disconnect() {}, gain:{value:1}, pan:{value:0}, playbackRate:{value:1}}; made.push(n); return n; };
  const ctx = {sampleRate:44100, createBufferSource:() => Object.assign(node('src'), {start(t) { this.at = t; }, stop(t) { this.end = t; }}),
    createGain:() => node('gain'), createStereoPanner:() => node('pan'),
    createBuffer:(c, n, sr) => { const d = new Float32Array(n); return {numberOfChannels:c, length:n, sampleRate:sr, duration:n / sr, getChannelData:() => d}; }};
  const out = node('out');
  I.tambourine(ctx, out, 3.25, .7, {kind:'hit'});
  const src = made.find(n => n.kind === 'src'), s = I.tambourineStrike(3.25, .7, 'hit'), want = I.tambourineSamples(44100, {kind:'hit', v:s.v, k:s.k});
  ok(src.at === 3.25 && src.playbackRate.value === s.rate && src.buffer.getChannelData(0).every((v, i) => v === want[i]), 'tambourine(): the strike the offline renderer plays, at its rate');
  ok(src.to.kind === 'gain' && src.to.gain.value === s.gain && src.to.to.kind === 'pan' && src.to.to.to === out && Math.abs(src.end - (3.25 + want.length / 44100 / s.rate)) < .01, 'tambourine(): gain, pan, out; stops when the strike ends');
}

const total = M.entries.reduce((s, e) => s + e.bytes, 0);
console.log(`check-song-voices: ${checks} checks passed. ${M.entries.length} takes (${M.entries.filter(e => e.voice === 'strategy').length} Strategy, ${M.entries.filter(e => e.voice === 'synthia').length} Synthia), ${seconds.toFixed(1)} s, ${(total / 1e6).toFixed(2)} MB FLAC; ${M.cuts.length} cuts; Synthia kept on ${synthiaKept} of ${synthiaCandidates} candidate lines; ${LINES.length} lines, every one sung by Strategy.`);
