// Offline renderer for the pixel voices (src/allhands/voices/README.md). Never
// invoked by a page view; no paid API: Strategy is the local Kokoro model
// (the voice bank's exact q8 artifact, am_onyx at .95), Synthia is Flite slt
// through FFmpeg's libflite at pitch 1.04, as the meeting season renders her.
//
//   node scripts/render-song-voices.mjs --out DIR [--steps bank,align,listen,measure,sketch]
//        [--manifest src/allhands/voices/song-voices.json] [--models DIR] [--only TEXT,TEXT] [--key D]
//
//   bank     dry takes: render, trim, level, 44.1 kHz mono 16-bit  -> DIR/bank/<voice>/<item>.wav
//   align    word boundaries, syllables, f0, level (measure.py)    -> the manifest, and its pitch tracks
//   pitch    only the pitch tracks (song-voices-pitch.json)
//   listen   test renders (dry, sung, light, medium, heavy) and Aaron's listening set -> DIR/test, DIR/listen
//   measure  Whisper small.en WER and pitch-in-key on every test render -> DIR/report.json, DIR/report.md
//   sketch   the 20 s Offsite sketch and the tambourine solos        -> DIR/listen
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {takes, VOICES, COUPLETS, EXPRESSIONS} from '../src/allhands/voices/items.js';
import {encodeWav, decodeWav} from '../src/allhands/voices/wav.js';
import {analyse, pixelate, pitchTrack, AMOUNTS} from '../src/allhands/voices/pixel.js';
import {lineFor, syllablesOf, scaleNotes, wander, hash, notesFor, noteName} from '../src/allhands/voices/melody.js';
import {renderSketch, renderTambourineSolo} from '../src/allhands/voices/sketch.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg('out');
if (!OUT) throw new Error('Pass --out DIR (the bank, the test renders and the listening set go there).');
const MANIFEST = resolve(root, arg('manifest', 'src/allhands/voices/song-voices.json'));
const STEPS = new Set(arg('steps', 'bank,align,listen,measure,sketch').split(','));
const ONLY = arg('only', ''), only = id => !ONLY || ONLY.split(',').some(o => id.includes(o));
const KEY = arg('key', 'D'), SCALE = arg('scale', 'majorPenta');
const SR = 44100, MEASURE = resolve(root, 'src/allhands/voices/measure.py');
const sha = b => createHash('sha256').update(b).digest('hex');
const mk = p => (mkdirSync(dirname(p), {recursive:true}), p);
const ff = (args, input) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {input, maxBuffer:256 * 1024 * 1024});
const f32 = buf => new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const resample = (x, from, to) => from === to ? x : f32(ff(['-f', 'f32le', '-ar', String(from), '-ac', '1', '-i', 'pipe:0',
  '-af', 'aresample=resampler=soxr:precision=28', '-ar', String(to), '-f', 'f32le', 'pipe:1'], Buffer.from(x.buffer, x.byteOffset, x.byteLength)));
const readMono = path => { const {sampleRate, channels} = decodeWav(readFileSync(path)); return {sr:sampleRate, x:channels[0]}; };
const writeWav = (path, ch, sr = SR) => writeFileSync(mk(path), encodeWav(ch, sr));
const db = v => 20 * Math.log10(Math.max(v, 1e-9));
const py = (cmd, jobs, extra = []) => {
  const tmp = join(OUT, 'work'), src = join(tmp, `${cmd}-jobs.json`), dst = join(tmp, `${cmd}-out.json`);
  writeFileSync(mk(src), JSON.stringify(jobs));
  execFileSync('python3', ['-I', MEASURE, cmd, src, dst, ...extra], {stdio:['ignore', 'inherit', 'inherit'], maxBuffer:64 * 1024 * 1024});
  return JSON.parse(readFileSync(dst, 'utf8'));
};

const ALL = takes().filter(t => only(t.id));
const bankPath = t => join(OUT, 'bank', `${t.id}.wav`);

// ---------------------------------------------------------------- the dry take
// Trim to the speech (5 ms frames above the loudest less 45 dB, 15 ms before,
// 40 ms after), 3 ms / 10 ms raised-cosine edges, active-speech RMS to -20 dBFS,
// peak at most -1 dBFS.
function finish(x) {
  const F = Math.round(.005 * SR), env = [];
  for (let i = 0; i < x.length; i += F) { let s = 0; const n = Math.min(F, x.length - i); for (let j = 0; j < n; j++) s += x[i + j] ** 2; env.push(Math.sqrt(s / n)); }
  const top = Math.max(...env), on = env.map(e => e > top * 10 ** (-45 / 20));
  const first = on.indexOf(true), last = on.lastIndexOf(true);
  const a = Math.max(0, first * F - Math.round(.015 * SR)), b = Math.min(x.length, (last + 1) * F + Math.round(.04 * SR));
  const y = x.slice(a, b);
  const fi = Math.round(.003 * SR), fo = Math.round(.010 * SR);
  for (let i = 0; i < fi; i++) y[i] *= .5 - .5 * Math.cos(Math.PI * i / fi);
  for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= .5 - .5 * Math.cos(Math.PI * i / fo);
  let e = 0, n = 0;
  env.forEach((v, k) => { if (v > top * 10 ** (-30 / 20)) { e += v * v; n++; } });
  let g = 10 ** (-20 / 20) / Math.sqrt(e / n), peak = 0;
  for (const v of y) peak = Math.max(peak, Math.abs(v));
  g = Math.min(g, 10 ** (-1 / 20) / peak);
  for (let i = 0; i < y.length; i++) y[i] *= g;
  return y;
}

async function kokoro() {
  const {KokoroTTS} = await import('kokoro-js');
  const {StyleTextToSpeech2Model, AutoTokenizer, env} = await import('@huggingface/transformers');
  const models = arg('models');
  if (models) env.cacheDir = resolve(models);
  const id = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  const [model, tokenizer] = await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(id, {dtype:'q8', device:'cpu', session_options:{intraOpNumThreads:2, interOpNumThreads:1,
      extra:{session:{intra_op:{allow_spinning:'0'}, inter_op:{allow_spinning:'0'}}}}}),
    AutoTokenizer.from_pretrained(id),
  ]);
  const cache = resolve(env.cacheDir, id), kdir = resolve(dirname(fileURLToPath(import.meta.resolve('kokoro-js'))), '..');
  const identity = {provider:'local-kokoro', modelId:id, dtype:'q8', voice:VOICES.strategy.voice, speed:VOICES.strategy.speed,
    modelSha256:sha(readFileSync(resolve(cache, 'onnx/model_quantized.onnx'))), tokenizerSha256:sha(readFileSync(resolve(cache, 'tokenizer.json'))),
    configSha256:sha(readFileSync(resolve(cache, 'config.json'))), voiceDataSha256:sha(readFileSync(resolve(kdir, `voices/${VOICES.strategy.voice}.bin`)))};
  const bank = JSON.parse(readFileSync(resolve(root, 'public/studio/voices/recordings.json'), 'utf8')).rendererByCharacter.strategy;
  identity.matchesVoiceBank = ['modelSha256', 'tokenizerSha256', 'configSha256', 'voiceDataSha256'].every(k => bank[k] === identity[k]);
  if (!identity.matchesVoiceBank) throw new Error('This Kokoro model is not the voice bank\'s approved artifact; Strategy would not be Strategy.');
  return {tts:new KokoroTTS(model, tokenizer), identity};
}

function flite(text) {
  const tmp = join(OUT, 'work', 'flite.txt');
  writeFileSync(mk(tmp), text.replace(/’/g, "'"));
  // The meeting season's Synthia: 24 kHz, asetrate x1.04, tempo restored (scripts/render-meeting-season.py).
  const p = VOICES.synthia.pitch, r = 24000;
  return f32(ff(['-f', 'lavfi', '-i', `flite=textfile=${tmp}:voice=${VOICES.synthia.voice}`, '-af',
    `aresample=${r},asetrate=${r * p},aresample=${r},atempo=${1 / p}`, '-ar', String(r), '-ac', '1', '-f', 'f32le', 'pipe:1']));
}
const ffmpegVersion = () => execFileSync('ffmpeg', ['-version']).toString().split('\n')[0];

async function bank() {
  let k = null;
  const identity = {};
  for (const t of ALL) {
    let raw, rate;
    if (t.voice === 'strategy') {
      k ??= await kokoro();
      identity.strategy = k.identity;
      const a = await k.tts.generate(t.spoken, {voice:VOICES.strategy.voice, speed:VOICES.strategy.speed});
      raw = a.audio; rate = a.sampling_rate;
    } else {
      raw = flite(t.spoken); rate = 24000;
      identity.synthia = {provider:'flite', voice:'slt', pitch:VOICES.synthia.pitch, engine:ffmpegVersion(),
        chain:'lavfi flite -> aresample 24000, asetrate 24960, aresample 24000, atempo 0.961538 (render-meeting-season.py)'};
    }
    const y = finish(resample(raw, rate, SR));
    writeWav(bankPath(t), y);
    console.log(`bank ${t.id.padEnd(36)} ${(y.length / SR).toFixed(3)} s`);
  }
  writeFileSync(mk(join(OUT, 'work', 'identity.json')), JSON.stringify(identity, null, 1));
}

function align() {
  const jobs = ALL.map(t => ({id:t.id, voice:t.voice, kind:t.kind, text:t.text, file:`${t.id}.wav`, path:bankPath(t)}));
  const rows = py('align', jobs, ['--verify']);
  const identity = JSON.parse(readFileSync(join(OUT, 'work', 'identity.json'), 'utf8'));
  let old = {entries:[]};
  if (ONLY && existsSync(MANIFEST)) old = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const byId = new Map(old.entries.map(e => [e.id, e]));
  for (const r of rows) {
    const t = ALL.find(a => a.id === r.id), bytes = readFileSync(bankPath(t));
    byId.set(r.id, {...r, spoken:t.spoken !== t.text ? t.spoken : undefined, item:t.item, ask:t.ask || undefined, bytes:bytes.length, sha256:sha(bytes)});
  }
  const order = takes().map(t => t.id);
  const manifest = {
    version:1,
    note:'Pixel-voice bank: dry takes, 44.1 kHz mono PCM16, trimmed, active speech at -20 dBFS. Times are seconds in the file. Written by scripts/render-song-voices.mjs; boundaries by src/allhands/voices/measure.py (the lady aligner).',
    sampleRate:SR, base:'song-voices/', identity:{...old.identity, ...identity},
    entries:[...byId.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`manifest ${MANIFEST}: ${manifest.entries.length} takes`);
  writePitch(manifest);
}

// The JS pitch track of every take (pixel.js pitchTrack), 0.1 Hz integers, as lady-pitch.json is to her.
function writePitch(manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))) {
  const pitchPath = MANIFEST.replace(/\.json$/, '-pitch.json');
  const pitch = {};
  for (const e of manifest.entries) {
    const {x} = readMono(join(OUT, 'bank', e.file)), tr = pitchTrack(x, SR);
    pitch[e.file] = {hop:tr.hop, offset:tr.offset, f0:Array.from(tr.f0, v => Math.round(v * 10))};
  }
  writeFileSync(pitchPath, '{\n' + Object.entries(pitch).map(([k, v]) => ` ${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n') + '\n}\n');
  console.log(`pitch tracks ${pitchPath}`);
}

// ---------------------------------------------------------------- melodies
// Expressions wander and land home (questions rise); a couplet's first sentence
// ends open, its second comes home; a call ends open in Strategy's register and
// its response starts from the call's last note, an octave up, in Synthia's.
const sentenceSplit = e => { const i = e.words.findIndex(w => /\.$/.test(w.text)); return i < 0 ? e.words.length : i + 1; };
function melodyFor(e, {from = null} = {}) {
  const reg = VOICES[e.voice].register, seed = hash(e.id);
  if (e.kind === 'couplet') {
    const cut = sentenceSplit(e), syl = syllablesOf(e), n1 = syl.filter(s => s.word < cut).length;
    const notes = scaleNotes(KEY, SCALE, reg.lo, reg.hi);
    const a = wander(n1, {notes, center:reg.center, tonic:KEY, seed, end:'open'});
    const b = wander(syl.length - n1, {notes, center:reg.center, tonic:KEY, seed:seed + 1, end:'home', from:a.at(-1)});
    return notesFor(e, [...a, ...b]);
  }
  return lineFor(e, {register:reg, tonic:KEY, scale:SCALE, seed, end:e.ask ? 'up' : e.kind === 'call' ? 'open' : 'home', from});
}

// ---------------------------------------------------------------- listen
// A dotted-8th tape echo at 108 BPM, dark (2.2 kHz in the loop) so its
// consonants do not answer the voice's; an 8th at .2 made Whisper hear the
// repeats as words ("Agree" as "A great rain").
const SPACE = {echo:{time:3 * 60 / 108 / 4, feedback:.3, mix:.16, tone:2200, tail:1.2}, chorus:{mix:.2}};
const VARIANTS = {dry:null, sung:0, light:AMOUNTS.light, medium:AMOUNTS.medium, heavy:AMOUNTS.heavy};
const mono = (l, r) => Float32Array.from(l, (v, i) => (v + r[i]) / 2);

function render(e, x, variant, notes, {space = false} = {}) {
  const amount = VARIANTS[variant];
  if (amount === null) return space ? (() => { const r = pixelate(x, SR, {amount:0, space:SPACE}); return [r.left, r.right]; })() : [x];
  const r = pixelate(x, SR, {notes, amount, space:space ? SPACE : null});
  return space ? [r.left, r.right] : [r.samples];
}

function listen() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const entries = manifest.entries.filter(e => only(e.id));
  const tests = [];
  const t0 = performance.now();
  let dspSeconds = 0, audioSeconds = 0;
  for (const e of entries) {
    const {x} = readMono(join(OUT, 'bank', e.file));
    const notes = melodyFor(e);
    for (const v of Object.keys(VARIANTS)) {
      const a = performance.now();
      const dry = render(e, x, v, notes);
      const wet = render(e, x, v, notes, {space:true});
      dspSeconds += (performance.now() - a) / 1000; audioSeconds += 2 * x.length / SR;
      const base = join(OUT, 'test', v, e.file);
      writeWav(base, dry);
      writeWav(base.replace(/\.wav$/, '.space.wav'), [mono(...wet)]);
      tests.push({id:e.id, voice:e.voice, kind:e.kind, variant:v, text:e.text, path:base, notes:v === 'dry' ? [] : notes.map(n => ({from:n.from, to:n.to, midi:n.midi}))});
      tests.push({id:e.id, voice:e.voice, kind:e.kind, variant:v, text:e.text, path:base.replace(/\.wav$/, '.space.wav'), space:true, notes:[]});
    }
  }
  writeFileSync(mk(join(OUT, 'work', ONLY ? 'tests-only.json' : 'tests.json')), JSON.stringify(tests));
  console.log(`test renders: ${tests.length} files; chain ${(dspSeconds * 1000 / audioSeconds).toFixed(1)} ms per second of audio (${((performance.now() - t0) / 1000).toFixed(1)} s total)`);
  if (!ONLY) reels(manifest);
}

// Aaron's listening set: per voice, the twelve expressions one bar apart (108
// BPM, the first vowel on the downbeat), dry and at three amounts; the six
// couplets as call and response; a sweep of one phrase from 0 to heavy.
const BAR = 60 / 108 * 4, BEAT = 60 / 108;
function place(bus, ch, at) {
  ch.forEach((c, k) => { const o = Math.round(at * SR), d = bus[k % bus.length]; for (let i = 0; i < c.length && o + i < d.length; i++) if (o + i >= 0) d[o + i] += c[i]; });
}
function stereo(ch) { return ch.length === 2 ? ch : [ch[0], ch[0]]; }
function normalise(L, R, peakDb = -1) {
  let p = 0;
  for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  const g = 10 ** (peakDb / 20) / (p || 1);
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
}
function reels(manifest) {
  const by = id => manifest.entries.find(e => e.id === id);
  const take = id => readMono(join(OUT, 'bank', by(id).file)).x;
  const dir = join(OUT, 'listen');
  for (const voice of Object.keys(VOICES)) {
    VOICES[voice].reel = {};
    for (const [i, v] of ['dry', 'light', 'medium', 'heavy'].entries()) {
      const n = Math.round((EXPRESSIONS.length * BAR + 1.5) * SR), L = new Float32Array(n), R = new Float32Array(n);
      let prev = null;
      EXPRESSIONS.forEach((x, k) => {
        const e = by(`${voice}/${x.id}`), notes = melodyFor(e, {from:prev});
        prev = notes.at(-1).midi;
        const ch = stereo(render(e, take(e.id), v, notes, {space:true}));
        place([L, R], ch, .4 + k * BAR - e.words[0].onset);
      });
      normalise(L, R);
      writeWav(join(dir, `${voice}-${i + 1}-${v}.wav`), [L, R]);
    }
  }
  // call and response: Strategy on beat one, Synthia on beat three, one bar each, medium
  for (const v of ['light', 'medium']) {
    const n = Math.round((COUPLETS.length * BAR + 1.5) * SR), L = new Float32Array(n), R = new Float32Array(n);
    COUPLETS.forEach((c, k) => {
      const call = by(`strategy/${c.id}-call`), resp = by(`synthia/${c.id}-response`);
      const cn = melodyFor(call), rn = melodyFor(resp, {from:cn.at(-1).midi + 12});
      const callAt = .4 + k * BAR, callEnd = callAt - call.words[0].onset + call.voiced[1];
      const beat3 = callAt + 2 * BEAT, respAt = Math.max(beat3, Math.ceil((callEnd + .05 - .4) / (BEAT / 2)) * (BEAT / 2) + .4);
      place([L, R], stereo(render(call, take(call.id), v, cn, {space:true})), callAt - call.words[0].onset);
      place([L, R], stereo(render(resp, take(resp.id), v, rn, {space:true})), respAt - resp.words[0].onset);
    });
    normalise(L, R);
    writeWav(join(dir, `couplets-call-and-response-${v}.wav`), [L, R]);
  }
  // the sweep: one phrase per voice at amount 0, .15, ... .9 (seven passes)
  for (const id of ['strategy/humbled-to-announce', 'synthia/thrilled-to-share']) {
    const e = by(id), x = take(id), notes = melodyFor(e), amounts = [0, .15, .3, .45, .6, .75, .9];
    const n = Math.round((amounts.length * BAR / 2 + 1.5) * SR), L = new Float32Array(n), R = new Float32Array(n);
    amounts.forEach((a, k) => {
      const r = pixelate(x, SR, {notes, amount:a, space:SPACE});
      place([L, R], [r.left, r.right], .4 + k * BAR / 2 - e.words[0].onset);
    });
    normalise(L, R);
    writeWav(join(dir, `sweep-${id.replace('/', '-')}.wav`), [L, R]);
  }
}

// ---------------------------------------------------------------- measure
function measure() {
  const tests = JSON.parse(readFileSync(join(OUT, 'work', ONLY ? 'tests-only.json' : 'tests.json'), 'utf8'));
  // the space (echo and chorus) is heard only on the pixel amounts: that is the chain as a song plays it
  const heard = py('hear', tests.filter(t => !t.space || !['dry', 'sung'].includes(t.variant)).map(({id, variant, text, path, space}) => ({id, variant, text, path, space:!!space})));
  const pitched = py('pitch', tests.filter(t => t.notes.length));
  let report = {heard, pitched};
  if (ONLY && existsSync(join(OUT, 'report.json'))) {             // a partial run replaces only its own takes
    const old = JSON.parse(readFileSync(join(OUT, 'report.json'), 'utf8')), mine = new Set(tests.map(t => t.id));
    report = {heard:[...old.heard.filter(h => !mine.has(h.id)), ...heard], pitched:[...old.pitched.filter(h => !mine.has(h.id)), ...pitched]};
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  writeFileSync(join(OUT, 'report.md'), summarise(report));
  console.log(readFileSync(join(OUT, 'report.md'), 'utf8').split('\n').slice(0, 40).join('\n'));
}

function summarise({heard, pitched}) {
  const lines = ['# Pixel voices: measurements', ''];
  const variants = Object.keys(VARIANTS);
  lines.push('## Whisper small.en, word error rate (whole take, 0.3 s of silence each side)', '');
  lines.push('| Voice | Chain | ' + variants.join(' | ') + ' |', '|---|---|' + variants.map(() => '---|').join(''));
  for (const voice of Object.keys(VOICES)) for (const space of [false, true]) {
    const row = variants.map(v => {
      const r = heard.filter(h => h.id.startsWith(voice) && h.variant === v && h.space === space);
      if (!r.length) return '';
      const words = r.reduce((s, h) => s + h.words, 0), errs = r.reduce((s, h) => s + h.errors, 0);
      return `${(100 * errs / words).toFixed(1)}% (${r.filter(h => h.errors === 0).length}/${r.length} exact)`;
    });
    lines.push(`| ${VOICES[voice].name} | ${space ? 'with echo and chorus' : 'no space'} | ${row.join(' | ')} |`);
  }
  lines.push('', '## Pitch against the target notes (syllable nuclei, vowel frames within 6 dB of the loudest)', '');
  lines.push('| Voice | Chain | notes | median abs cents | 90th pct | within 25 c | within 50 c | SHS median abs cents |', '|---|---|---|---|---|---|---|---|');
  for (const voice of Object.keys(VOICES)) for (const v of variants.filter(v => v !== 'dry')) {
    const ns = pitched.filter(p => p.id.startsWith(voice) && p.variant === v).flatMap(p => p.notes).filter(n => n.cents !== null);
    const c = ns.map(n => Math.abs(n.cents)).sort((a, b) => a - b), s = ns.filter(n => n.shsCents !== null).map(n => Math.abs(n.shsCents)).sort((a, b) => a - b);
    const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(1) : '-';
    lines.push(`| ${VOICES[voice].name} | ${v} | ${ns.length} | ${q(c, .5)} | ${q(c, .9)} | ${(100 * c.filter(x => x <= 25).length / c.length).toFixed(0)}% | ${(100 * c.filter(x => x <= 50).length / c.length).toFixed(0)}% | ${q(s, .5)} |`);
  }
  lines.push('', '## Every take, word error per chain (no space / with space)', '');
  lines.push('| Take | ' + variants.join(' | ') + ' |', '|---|' + variants.map(() => '---|').join(''));
  const ids = [...new Set(heard.map(h => h.id))];
  for (const id of ids) {
    lines.push(`| ${id} | ` + variants.map(v => {
      const a = heard.find(h => h.id === id && h.variant === v && !h.space), b = heard.find(h => h.id === id && h.variant === v && h.space);
      const f = h => h ? (h.errors ? `${h.errors}: "${h.heard}"` : '0') : '';
      return `${f(a)} / ${f(b)}`;
    }).join(' | ') + ' |');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- sketch
function sketch() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const by = id => manifest.entries.find(e => e.id === id);
  const take = id => readMono(join(OUT, 'bank', by(id).file)).x;
  const dir = join(OUT, 'listen');
  const out = renderSketch({sr:SR, entry:by, take, melodyFor, key:KEY, scale:SCALE});
  writeWav(join(dir, 'sketch-offsite-20s.wav'), [out.left, out.right]);
  const solo = renderTambourineSolo({sr:SR});
  writeWav(join(dir, 'tambourine-groove.wav'), [solo.groove]);
  writeWav(join(OUT, 'test', 'tambourine-shake.wav'), [solo.shake]);
  writeWav(join(OUT, 'test', 'tambourine-hit.wav'), [solo.hit]);
  writeWav(join(OUT, 'test', 'tambourine-stem.wav'), [out.stems.tambourine]);
  writeWav(join(OUT, 'test', 'sketch-voices.wav'), out.stems.voices);
  writeWav(join(OUT, 'test', 'sketch-band.wav'), [0, 1].map(c => Float32Array.from(out.stems.drums[c], (v, i) =>
    .9 * v + .55 * out.stems.tambourine[i] + out.stems.pad[c][i] + .9 * out.stems.bass[i])));
  console.log(`sketch voices at ${out.voiceGainDb} dB to sit 1 dB over the band`);
  const lyric = out.cues.map(c => by(c.id).text).join(' ');
  const t = py('tamb', [{path:join(OUT, 'test', 'tambourine-shake.wav'), what:'one shake'}, {path:join(OUT, 'test', 'tambourine-hit.wav'), what:'one hit'},
    {path:join(dir, 'tambourine-groove.wav'), what:'the groove, 4 bars'}]);
  writeFileSync(join(OUT, 'tambourine.json'), JSON.stringify(t, null, 1));
  // the sketch heard whole (its voices alone, and the mix), then each cue cut
  // from the mix, from 0.25 s before its first vowel to 0.3 s after its last word
  const jobs = [{id:'sketch', variant:'voices', text:lyric, path:join(OUT, 'test', 'sketch-voices.wav')},
    {id:'sketch', variant:'mix', text:lyric, path:join(dir, 'sketch-offsite-20s.wav')}];
  out.cues.forEach((c, k) => {
    const e = by(c.id), a = Math.max(0, Math.round((c.at - .25) * SR)), b = Math.round((c.end + .3) * SR);
    const path = join(OUT, 'test', 'sketch-cuts', `${String(k).padStart(2, '0')}-mix.wav`);
    writeWav(path, [mono(out.left.subarray(a, b), out.right.subarray(a, b))]);
    jobs.push({id:c.id, variant:'cue in the mix', text:e.text, path, at:c.at});
  });
  out.cueCuts().forEach((c, k) => {
    const path = join(OUT, 'test', 'sketch-cuts', `${String(k).padStart(2, '0')}-alone.wav`);
    writeWav(path, [c.samples]);
    jobs.push({id:c.id, variant:'cue alone in the band', text:by(c.id).text, path, at:c.at});
  });
  const heard = py('hear', jobs);
  writeFileSync(join(OUT, 'sketch.json'), JSON.stringify({cues:out.cues, voiceGainDb:out.voiceGainDb, heard}, null, 1));
  console.log('sketch', out.cues.length, 'voice cues');
}

if (STEPS.has('bank')) await bank();
if (STEPS.has('align')) align();
else if (STEPS.has('pitch')) writePitch();
if (STEPS.has('listen')) listen();
if (STEPS.has('measure')) measure();
if (STEPS.has('sketch')) sketch();
