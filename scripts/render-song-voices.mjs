// Offline renderer for the production voice bank: every lexicon line Strategy
// or Synthia can be cast to sing (src/allhands/voices/lines.js), sung through
// the pixel chain and kept only if Whisper hears it. Never invoked by a page
// view; no paid API: Strategy is the local Kokoro model (the voice bank's exact
// q8 artifact, am_onyx at .95), Synthia is Flite slt through FFmpeg's libflite
// at pitch 1.04, as the meeting season renders her.
//
//   node scripts/render-song-voices.mjs --out DIR --models DIR [--steps tts,align,hear,publish]
//        [--only KEY,KEY] [--voices strategy,synthia] [--rounds N] [--manifest PATH] [--public DIR]
//
//   tts      the dry take: render, trim, level, 44.1 kHz mono 16-bit     -> DIR/takes/<voice>/<stem>~<spelling>.wav
//   align    word boundaries, syllable nuclei, f0, level (measure.py, the lady's aligner, every word re-heard)
//   hear     Whisper small.en on the dry take and on the take sung at its pixel amount, onto a wandering
//            line in two keys (D major and F minor pentatonic): Strategy at medium (.6), Synthia at medium,
//            else light (.3). A take passes when every one of those is heard exactly.
//   publish  the passing takes as FLAC (the pitch track in a Vorbis comment) -> public/allhands/voices/,
//            the manifest -> src/allhands/voices/song-voices.json, the report -> DIR/report.{json,md}
//   verify   the published takes heard again through loadVoices and sing() (the cut ones; --verify all: every one)
//   pitch    every kept take's test renders, each syllable against its note -> DIR/pitch.json
//   tambourine  instruments.js's tambourine alone (shake, hit, groove, a bar of 16ths), measured -> DIR/tambourine.json
//   sketch   the 20 s Offsite direction sketch from the published bank, Whisper on it -> DIR/listen, DIR/sketch.json
//
// A line that fails walks its respellings (items.js SAY), one round each. Results are
// cached per take under DIR/work, so a run after a new respelling renders only that.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, renameSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {VOICES, variantsOf} from '../src/allhands/voices/items.js';
import {LINES, CUTS, fileOf} from '../src/allhands/voices/lines.js';
import {encodeWav, decodeWav} from '../src/allhands/voices/wav.js';
import {decodeFlac, pitchToTag, pitchFromTag} from '../src/allhands/voices/flac.js';
import {analyse, pixelate, pitchTrack} from '../src/allhands/voices/pixel.js';
import {lineFor, hash} from '../src/allhands/voices/melody.js';
import {renderTambourineSolo} from '../src/allhands/voices/sketch.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg('out');
if (!OUT) throw new Error('Pass --out DIR (the takes, the test renders and the report go there).');
const MANIFEST = resolve(root, arg('manifest', 'src/allhands/voices/song-voices.json'));
const PUBLIC = resolve(root, arg('public', 'public/allhands/voices'));
const STEPS = new Set(arg('steps', 'tts,align,hear,publish').split(','));
const ONLY = arg('only', ''), only = id => !ONLY || ONLY.split(',').some(o => id === o || id.includes(o));
const VOICE_SET = new Set(arg('voices', 'strategy,synthia').split(','));
const ROUNDS = +arg('rounds', 6);
const SR = 44100, MEASURE = resolve(root, 'src/allhands/voices/measure.py');
// Where a take is tested: two keys a track sings in, a line that wanders through each voice's register.
export const TEST_KEYS = [['D', 'majorPenta'], ['F', 'minorPenta']];
const sha = b => createHash('sha256').update(b).digest('hex');
const short = s => createHash('sha1').update(s).digest('hex').slice(0, 8);
const mk = p => (mkdirSync(dirname(p), {recursive:true}), p);
const ff = (args, input) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {input, maxBuffer:256 * 1024 * 1024});
const f32 = buf => new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const resample = (x, from, to) => from === to ? x : f32(ff(['-f', 'f32le', '-ar', String(from), '-ac', '1', '-i', 'pipe:0',
  '-af', 'aresample=resampler=soxr:precision=28', '-ar', String(to), '-f', 'f32le', 'pipe:1'], Buffer.from(x.buffer, x.byteOffset, x.byteLength)));
const readMono = path => { const {sampleRate, channels} = decodeWav(readFileSync(path)); return {sr:sampleRate, x:channels[0]}; };
const writeWav = (path, ch, sr = SR) => writeFileSync(mk(path), encodeWav(ch, sr));
const readJson = (p, d) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d;
// Written whole or not at all (two lanes, one per voice, may share DIR).
const writeAtomic = (p, text) => { const tmp = `${p}.${process.pid}.tmp`; writeFileSync(mk(tmp), text); renameSync(tmp, p); };
// measure.py on a job list, in chunks (each chunk's results are kept as soon as it returns: `done`).
const py = (cmd, jobs, extra = [], done = () => {}, chunk = 40) => {
  const out = [];
  for (let i = 0; i < jobs.length; i += chunk) {
    const part = jobs.slice(i, i + chunk), tmp = join(OUT, 'work'), tag = `${cmd}-${process.pid}`, src = join(tmp, `${tag}-jobs.json`), dst = join(tmp, `${tag}-out.json`);
    writeFileSync(mk(src), JSON.stringify(part));
    execFileSync('python3', ['-I', '-B', MEASURE, cmd, src, dst, ...extra], {stdio:['ignore', 'inherit', 'inherit'], maxBuffer:64 * 1024 * 1024});
    const rows = JSON.parse(readFileSync(dst, 'utf8'));
    done(rows, part);
    out.push(...rows);
    console.log(`${cmd}: ${Math.min(jobs.length, i + chunk)}/${jobs.length}`);
  }
  return out;
};

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
  env.forEach(v => { if (v > top * 10 ** (-30 / 20)) { e += v * v; n++; } });
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
  const tmp = join(OUT, 'work', `flite-${process.pid}.txt`);
  writeFileSync(mk(tmp), text.replace(/’/g, "'"));
  // The meeting season's Synthia: 24 kHz, asetrate x1.04, tempo restored (scripts/render-meeting-season.py).
  const p = VOICES.synthia.pitch, r = 24000;
  return f32(ff(['-f', 'lavfi', '-i', `flite=textfile=${tmp}:voice=${VOICES.synthia.voice}`, '-af',
    `aresample=${r},asetrate=${r * p},aresample=${r},atempo=${1 / p}`, '-ar', String(r), '-ac', '1', '-f', 'f32le', 'pipe:1']));
}
const ffmpegVersion = () => execFileSync('ffmpeg', ['-version']).toString().split('\n')[0];

// ---------------------------------------------------------------- jobs and takes
// A job is one line in one voice; a take is one spelling of it.
const JOBS = LINES.filter(l => only(l.id)).flatMap(line => line.voices.filter(v => VOICE_SET.has(v)).map(voice => ({
  line, voice, stem:`${voice}/${line.id}`, variants:variantsOf(voice, line.text), done:false, chosen:null, tried:[],
})));
const takeOf = (job, spoken) => {
  const name = `${job.stem}~${short(spoken)}`;
  return {job, voice:job.voice, id:job.line.id, text:job.line.text, spoken, name,
    wav:join(OUT, 'takes', `${name}.wav`), result:join(OUT, 'work', 'results', `${name}.json`)};
};
const resultOf = t => readJson(t.result, {name:t.name, voice:t.voice, id:t.id, text:t.text, spoken:t.spoken});
const saveResult = (t, r) => writeAtomic(t.result, JSON.stringify(r, null, 1));

async function tts(takes) {
  let k = null;
  const idPath = join(OUT, 'work', 'identity.json'), identity = readJson(idPath, {}), todo = takes.filter(t => !existsSync(t.wav));
  if (!todo.length) return;
  for (const t of todo) {
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
    writeWav(t.wav, y);
    console.log(`tts ${t.name.padEnd(56)} ${(y.length / SR).toFixed(3)} s  ${JSON.stringify(t.spoken)}`);
  }
  writeAtomic(idPath, JSON.stringify(identity, null, 1));
}

function align(takes) {
  const todo = takes.filter(t => !resultOf(t).align);
  py('align', todo.map(t => ({id:t.name, voice:t.voice, kind:t.job.line.kind, text:t.text, file:fileOf(t.voice, t.id), path:t.wav})), ['--verify'], rows => {
    for (const row of rows) {
      const t = todo.find(x => x.name === row.id), r = resultOf(t);
      r.align = row;
      saveResult(t, r);
    }
  });
}

// The stored pitch track exactly as the page reads it back (0.1 Hz), so a test
// render is the play-time chain, sample for sample.
const storedTrack = x => pitchFromTag(pitchToTag(pitchTrack(x, SR)));
const amountsOf = voice => voice === 'synthia' ? [VOICES.synthia.amount, VOICES.synthia.fallbackAmount] : [VOICES.strategy.amount];
const endOf = line => line.ask ? 'up' : line.kind === 'pickup' || line.kind === 'tag' ? 'free' : line.kind === 'call' || line.ref?.side === 'call' ? 'open' : 'home';
export function testNotes(entry, line, voice, [tonic, scale]) {
  return lineFor(entry, {register:VOICES[voice].register, tonic, scale, seed:hash(`${entry.file}|${tonic}${scale}`), end:endOf(line)});
}
const entryOf = (t, row) => ({...row, file:fileOf(t.voice, t.id), voice:t.voice});

// Two passes: the dry take and the voice's amount; then, for Synthia, light (.3)
// where medium was not heard exactly (as clarity allows).
function hear(takes) {
  const exact = h => h && h.errors === 0;
  for (const pass of [0, 1]) {
    const jobs = [];
    for (const t of takes) {
      const r = resultOf(t);
      if (!r.align) continue;
      r.hear ??= {};
      if (pass === 0 && !r.hear.dry) jobs.push({id:t.name, variant:'dry', text:t.text, path:t.wav});
      const [primary, fallback] = amountsOf(t.voice);
      if (pass === 1 && (fallback === undefined || TEST_KEYS.every(k => exact(r.hear[`${primary}|${k.join(' ')}`])))) continue;
      const amount = pass === 0 ? primary : fallback;
      const todo = TEST_KEYS.filter(k => !r.hear[`${amount}|${k.join(' ')}`]);
      if (!todo.length) continue;
      const {x} = readMono(t.wav), track = storedTrack(x), analysis = analyse(x, SR, {track}), entry = entryOf(t, r.align);
      for (const k of todo) {
        const variant = `${amount}|${k.join(' ')}`;
        const notes = testNotes(entry, t.job.line, t.voice, k), y = pixelate(x, SR, {notes, amount, analysis}).samples;
        const path = join(OUT, 'test', `${amount}`, k.join('-'), `${t.name}.wav`);
        writeWav(path, [y]);
        jobs.push({id:t.name, variant, text:t.text, path, notes:notes.map(n => n.midi)});
      }
      saveResult(t, r);
    }
    py('hear', jobs, [], rows => {
      for (const h of rows) {
        const t = takes.find(x => x.name === h.id), r = resultOf(t);
        r.hear[h.variant] = {heard:h.heard, errors:h.errors, words:h.words, notes:h.notes};
        saveResult(t, r);
      }
    }, 120);
  }
}

// Pass: the aligner found every word, Whisper hears the dry take exactly and the
// sung take exactly in both keys at the amount. Synthia tries medium, then light.
function verdict(t) {
  const r = resultOf(t), a = r.align;
  if (!a || !r.hear?.dry) return null;
  const words = a.words || [], sane = words.length && words.every((w, i) => w.start < w.end && w.start >= 0 && w.end <= a.duration + 1e-6 && (i === 0 || w.start >= words[i - 1].end - 1e-6));
  const exact = h => h && h.errors === 0;
  const passAt = amount => TEST_KEYS.every(k => exact(r.hear[`${amount}|${k.join(' ')}`]));
  const amount = amountsOf(t.voice).find(passAt);
  return {pass:!!(sane && exact(r.hear.dry) && amount), amount:amount ?? null, sane:!!sane, dry:exact(r.hear.dry),
    at:Object.fromEntries(amountsOf(t.voice).map(m => [m, passAt(m)]))};
}

// Whisper's words are kept, so a change to the matching (measure.py wer: spellings,
// numbers, homophones) re-scores every cached take without hearing it again.
function rescore() {
  const jobs = [];
  for (const j of JOBS) for (const spoken of j.variants) {
    const t = takeOf(j, spoken), r = resultOf(t);
    for (const [variant, h] of Object.entries(r.hear || {})) jobs.push({name:t.name, variant, text:t.text, heard:h.heard, errors:h.errors});
  }
  const rows = py('rescore', jobs, [], () => {}, 100000);
  let changed = 0;
  for (const row of rows) {
    if (row.errors === jobs.find(x => x.name === row.name && x.variant === row.variant).errors) continue;
    const path = join(OUT, 'work', 'results', `${row.name}.json`), r = readJson(path);
    r.hear[row.variant].errors = row.errors;
    writeAtomic(path, JSON.stringify(r, null, 1));
    changed++;
  }
  if (changed) console.log(`rescore: ${changed} results changed`);
}

async function run() {
  if (STEPS.has('hear')) rescore();
  for (let round = 0; round < ROUNDS; round++) {
    const pending = JOBS.filter(j => !j.done && j.variants[round] !== undefined);
    if (!pending.length) break;
    const takes = pending.map(j => takeOf(j, j.variants[round]));
    console.log(`round ${round + 1}: ${takes.length} takes`);
    if (STEPS.has('tts')) await tts(takes);
    if (STEPS.has('align')) align(takes.filter(t => existsSync(t.wav)));
    if (STEPS.has('hear')) hear(takes);
    for (const t of takes) {
      const v = verdict(t);
      t.job.tried.push({spoken:t.spoken, name:t.name, ...v});
      if (v?.pass) { t.job.done = true; t.job.chosen = t; t.job.amount = v.amount; }
    }
  }
}

// ---------------------------------------------------------------- publish
// Kokoro leaves up to 0.6 s of model noise about 50 dB down after the last word,
// which the TTS trim (45 dB) keeps. The published take ends 40 ms after the
// last 5 ms frame within 30 dB of the loudest, never sooner than 80 ms and never
// later than 250 ms after the aligner's last word, with a 10 ms raised-cosine fade. The pixel chain is
// causal, so the sung samples before the cut are the ones Whisper heard;
// `verify` hears every cut take again through the play-time path, and a take it
// does not hear exactly is published whole (work/no-trim.json).
function trimTail(x, lastEnd) {
  const F = Math.round(.005 * SR), env = [];
  for (let i = 0; i < x.length; i += F) { let s = 0; const n = Math.min(F, x.length - i); for (let j = 0; j < n; j++) s += x[i + j] ** 2; env.push(Math.sqrt(s / n)); }
  const top = Math.max(...env), last = env.findLastIndex(e => e > top * 10 ** (-30 / 20));
  const end = Math.min(x.length, Math.round(Math.min(Math.max((last + 1) * F / SR + .04, lastEnd + .08), lastEnd + .25) * SR));
  if (end >= x.length - Math.round(.01 * SR)) return x;
  const y = x.slice(0, end), fo = Math.round(.01 * SR);
  for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= .5 - .5 * Math.cos(Math.PI * i / fo);
  return y;
}

function flacOf(wav, tag, out) {
  ff(['-i', wav, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-c:a', 'flac', '-compression_level', '12',
    '-metadata', `PIXEL_PITCH=${tag}`, '-f', 'flac', mk(out)]);
  return readFileSync(out);
}

function publish() {
  const identity = readJson(join(OUT, 'work', 'identity.json'), {}), noTrim = readJson(join(OUT, 'work', 'no-trim.json'), []);
  const old = readJson(MANIFEST, {entries:[]});
  const partial = !!ONLY || VOICE_SET.size < 2;
  const entries = new Map(partial ? (old.entries || []).filter(e => old.version === 2).map(e => [e.file, e]) : []);
  for (const job of JOBS) {
    const file = fileOf(job.voice, job.line.id);
    entries.delete(file);
    if (!job.chosen) continue;
    const t = job.chosen, r = resultOf(t), a = r.align, line = job.line;
    const {x} = readMono(t.wav), y = noTrim.includes(file) ? x : trimTail(x, a.words.at(-1).end), trimmed = y.length < x.length, wav = trimmed ? join(OUT, 'work', 'publish', `${t.name}.wav`) : t.wav;
    if (trimmed) writeWav(wav, [y]);
    const track = pitchTrack(y, SR), bytes = flacOf(wav, pitchToTag(track), join(PUBLIC, file));
    const back = decodeFlac(bytes), pcm = decodeWav(readFileSync(wav)).channels[0];
    if (back.samples !== pcm.length || back.channels[0].some((v, i) => v !== pcm[i])) throw new Error(`${file}: the FLAC does not decode to the take`);
    entries.set(file, {
      id:line.id, voice:job.voice, kind:line.kind, text:line.text, spoken:t.spoken !== line.text ? t.spoken : undefined, ask:line.ask || undefined,
      file, ref:line.ref, samples:back.samples, duration:+(back.samples / SR).toFixed(4), trimmedFrom:trimmed ? x.length : undefined, voiced:a.voiced, f0:a.f0, rmsDb:a.rmsDb, gainDb:a.gainDb, amount:job.amount,
      words:a.words.map(w => ({text:w.text, start:w.start, end:w.end, onset:w.onset, syllables:w.syllables, f0:w.f0, check:w.check})),
      confidence:a.confidence, method:a.method, heard:r.hear.dry.heard, bytes:bytes.length, sha256:sha(bytes),
    });
  }
  // Cuts (a drop's tag and impact) from a published take: word indexes, times, and whether the
  // impact is a drop: every word of it heard alone (the aligner's isolated check).
  const cuts = [];
  for (const c of CUTS) for (const voice of ['synthia', 'strategy']) {
    const src = entries.get(fileOf(voice, c.from));
    if (!src) continue;
    const n = src.words.length, a = c.words[0] < 0 ? n + c.words[0] : c.words[0], b = c.words[1] < 0 ? n + c.words[1] : c.words[1];
    const ws = src.words.slice(a, b + 1);
    cuts.push({id:c.id, voice, kind:c.kind, text:c.text, from:src.file, words:[a, b], start:ws[0].start, end:ws.at(-1).end, onset:ws[0].onset,
      ready:c.kind !== 'impact' || ws.every(w => w.check === 'isolated')});
  }
  // the line index: who can sing each line, in preference order; a Synthia line she fails is Strategy-only
  const lines = {};
  const has = (voice, id) => entries.has(fileOf(voice, id)) || cuts.some(c => c.voice === voice && c.id === id && c.ready);
  for (const line of [...LINES, ...CUTS.map(c => ({...c, owner:'synthia', voices:['synthia', 'strategy'], why:null}))]) {
    const source = line.from ? LINES.find(l => l.id === line.from) : line;
    const voices = (source?.voices ?? line.voices).filter(v => has(v, line.id));
    const owner = source?.owner ?? line.owner, why = owner === 'synthia' ? (source?.why ?? line.why ?? 'failed') : null;
    lines[line.id] = {voices, owner, ...owner === 'synthia' && !voices.includes('synthia') ? {strategyOnly:why} : {}};
  }
  const order = new Map(LINES.flatMap((l, i) => ['synthia', 'strategy'].map((v, k) => [fileOf(v, l.id), 2 * i + k])));
  const list = [...entries.values()].sort((a, b) => (order.get(a.file) ?? 1e9) - (order.get(b.file) ?? 1e9));
  const manifest = {
    version:2,
    note:'The pixel-voice bank: every lexicon line Strategy and Synthia sing (src/allhands/voices/lines.js), dry, FLAC 44.1 kHz mono 16-bit, trimmed, active speech at -20 dBFS, the pitch track in the Vorbis comment PIXEL_PITCH. Times are seconds in the file. Each take was heard exactly by Whisper small.en dry and sung at `amount` in two keys. Written by scripts/render-song-voices.mjs; boundaries by src/allhands/voices/measure.py (the lady aligner).',
    sampleRate:SR, base:'allhands/voices/', format:'flac',
    test:{keys:TEST_KEYS.map(k => k.join(' ')), amounts:{strategy:amountsOf('strategy'), synthia:amountsOf('synthia')}, whisper:'faster-whisper small.en int8, beam 5, temperature 0'},
    identity:{...old.identity, ...identity},
    lines,
    cuts,
    entries:list,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  // the published folder holds exactly the manifest's files
  if (!partial) for (const voice of readdirSync(PUBLIC)) for (const f of readdirSync(join(PUBLIC, voice))) if (!entries.has(`${voice}/${f}`)) rmSync(join(PUBLIC, voice, f));
  const total = list.reduce((s, e) => s + e.bytes, 0);
  console.log(`manifest ${MANIFEST}: ${list.length} takes, ${cuts.length} cuts, ${(total / 1e6).toFixed(2)} MB of FLAC in ${PUBLIC}`);
  report(manifest);
}

function report(manifest) {
  const rows = JOBS.map(j => ({id:j.line.id, voice:j.voice, kind:j.line.kind, text:j.line.text,
    pass:!!j.chosen, amount:j.amount ?? null, tries:j.tried.length, tried:j.tried.map(t => ({spoken:t.spoken, ...(t.pass === undefined ? {} : t),
      heard:Object.fromEntries(Object.entries(resultOf(takeOf(j, t.spoken)).hear || {}).map(([k, h]) => [k, h.errors ? h.heard : 0]))}))}));
  const rate = rs => `${rs.filter(r => r.pass).length}/${rs.length} (${(100 * rs.filter(r => r.pass).length / Math.max(1, rs.length)).toFixed(1)}%)`;
  const first = rs => `${rs.filter(r => r.tried[0]?.pass).length}/${rs.length}`;
  const md = ['# The voice bank: pass rates', '', `Whisper small.en, exact, dry and sung in ${TEST_KEYS.map(k => k.join(' ')).join(' and ')}.`, '',
    '| Voice | Kind | lines | pass | first spelling | at medium | at light only |', '|---|---|---|---|---|---|---|'];
  for (const voice of ['strategy', 'synthia']) {
    const vr = rows.filter(r => r.voice === voice);
    for (const kind of [...new Set(vr.map(r => r.kind)), 'all']) {
      const rs = kind === 'all' ? vr : vr.filter(r => r.kind === kind);
      if (!rs.length) continue;
      md.push(`| ${VOICES[voice].name} | ${kind} | ${rs.length} | ${rate(rs)} | ${first(rs)} | ${rs.filter(r => r.amount === .6).length} | ${rs.filter(r => r.amount === .3).length} |`);
    }
  }
  md.push('', '## Not kept', '', '| Voice | Line | Spellings tried | Heard |', '|---|---|---|---|');
  for (const r of rows.filter(r => !r.pass)) {
    const last = r.tried.at(-1);
    md.push(`| ${r.voice} | ${r.text} | ${r.tried.map(t => JSON.stringify(t.spoken)).join(', ')} | ${last ? Object.entries(last.heard).filter(([, h]) => h).map(([k, h]) => `${k}: "${h}"`).join('; ') : 'not rendered'} |`);
  }
  md.push('', '## Respelled', '', '| Voice | Line | Spoken as |', '|---|---|---|');
  for (const r of rows.filter(r => r.pass && r.tries > 1)) md.push(`| ${r.voice} | ${r.text} | ${JSON.stringify(r.tried.at(-1).spoken)} |`);
  const total = manifest.entries.reduce((s, e) => s + e.bytes, 0), dur = manifest.entries.reduce((s, e) => s + e.duration, 0);
  md.push('', `Published: ${manifest.entries.length} takes, ${dur.toFixed(1)} s, ${(total / 1e6).toFixed(2)} MB FLAC (${(total / manifest.entries.length / 1e3).toFixed(1)} KB a take; ${(dur * SR * 2 / 1e6).toFixed(2)} MB as PCM16 WAV).`);
  const strategyOnly = Object.entries(manifest.lines).filter(([, l]) => l.strategyOnly);
  md.push('', `Strategy-only lines the lexicon gives Synthia: ${strategyOnly.length} (${['long', 'failed'].map(w => `${w} ${strategyOnly.filter(([, l]) => l.strategyOnly === w).length}`).join(', ')}).`);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
  writeFileSync(join(OUT, 'report.md'), md.join('\n') + '\n');
  console.log(md.slice(0, 24).join('\n'));
}

// ---------------------------------------------------------------- verify
// The published bank heard again through the page's own path: loadVoices
// (flac.js), then sing() at the take's amount onto the same test lines. Every
// take whose tail was cut, or all of them with --verify all.
async function verify() {
  const {VOICE_TABLE, loadVoices, sing} = await import('../src/allhands/voices/voice-table.js');
  const {readVoice} = await import('../src/allhands/voices/node.js');
  const cut = new Set(readJson(MANIFEST, {entries:[]}).entries.filter(e => e.trimmedFrom).map(e => e.file));
  const files = Object.values(VOICE_TABLE).filter(e => (arg('verify') === 'all' || cut.has(e.file)) && only(e.id)).map(e => e.file);
  const takes = await loadVoices(files, {read:readVoice(PUBLIC + '/')}), jobs = [];
  for (const f of files) {
    const take = takes.get(f), e = take.entry, line = LINES.find(l => l.id === e.id), base = join(OUT, 'verify', f.replace(/\.flac$/, ''));
    writeWav(`${base}.dry.wav`, [take.samples]);
    jobs.push({id:f, variant:'dry', text:e.text, path:`${base}.dry.wav`});
    for (const k of TEST_KEYS) {
      const y = sing(take, {notes:testNotes(e, line, e.voice, k), amount:e.amount}).samples;
      writeWav(`${base}.${k.join('-')}.wav`, [y]);
      jobs.push({id:f, variant:`${e.amount}|${k.join(' ')}`, text:e.text, path:`${base}.${k.join('-')}.wav`});
    }
  }
  const rows = py('hear', jobs, [], () => {}, 150), bad = rows.filter(r => r.errors);
  writeFileSync(join(OUT, 'verify.json'), JSON.stringify({files:files.length, renders:rows.length, failed:bad}, null, 1));
  // a cut take Whisper no longer hears exactly (the cut took a final z, th or t) is published whole next time
  const noTrim = readJson(join(OUT, 'work', 'no-trim.json'), []);
  writeAtomic(join(OUT, 'work', 'no-trim.json'), JSON.stringify([...new Set([...noTrim, ...bad.map(b => b.id)])].sort(), null, 1));
  console.log(`verify: ${files.length} published takes, ${rows.length} renders through loadVoices and sing(), ${rows.length - bad.length} heard exactly`);
  for (const b of bad) console.log(`  ${b.id} ${b.variant}: "${b.heard}"`);
}

// ---------------------------------------------------------------- pitch
// Every kept take's two test renders, each syllable nucleus against its note
// (measure.py pitch: normalised autocorrelation and subharmonic summation, no
// code shared with pixel.js) -> DIR/pitch.json
function pitch() {
  const jobs = [];
  for (const j of JOBS.filter(j => j.chosen)) {
    const t = j.chosen, r = resultOf(t), entry = entryOf(t, r.align);
    for (const k of TEST_KEYS) jobs.push({id:t.name, voice:t.voice, variant:`${j.amount}|${k.join(' ')}`, path:join(OUT, 'test', `${j.amount}`, k.join('-'), `${t.name}.wav`),
      notes:testNotes(entry, j.line, t.voice, k).map(n => ({from:n.from, to:n.to, midi:n.midi}))});
  }
  const rows = py('pitch', jobs.filter(x => existsSync(x.path)), [], () => {}, 1000);
  const summary = {};
  for (const voice of ['strategy', 'synthia']) {
    const ns = rows.filter(r => r.voice === voice).flatMap(r => r.notes), c = ns.filter(n => n.cents !== null).map(n => Math.abs(n.cents)).sort((a, b) => a - b);
    const longer = ns.filter(n => n.to - n.from >= .06 && n.cents !== null), hit = n => Math.abs(n.cents) <= 25 || (n.shsCents !== null && Math.abs(n.shsCents) <= 25);
    summary[voice] = {renders:rows.filter(r => r.voice === voice).length, notes:ns.length, measured:c.length, medianCents:c[c.length >> 1], p90Cents:c[Math.floor(.9 * c.length)],
      within25:c.filter(x => x <= 25).length, nuclei60ms:longer.length, nuclei60msWithin25:longer.filter(hit).length};
  }
  writeFileSync(join(OUT, 'pitch.json'), JSON.stringify({summary, rows}, null, 1));
  console.log('pitch', JSON.stringify(summary));
}

// ---------------------------------------------------------------- listen
// The tambourine (instruments.js) alone, measured: one shake, one hit, four bars
// of the groove, and a bar of even 16ths (do its strikes ring the same lines?).
function tambourine() {
  const dir = join(OUT, 'listen'), solo = renderTambourineSolo({sr:SR}), files = {};
  for (const [k, y] of Object.entries(solo)) writeWav(files[k] = join(dir, `tambourine-${k}.wav`), [y]);
  const t = py('tamb', [{path:files.shake, what:'one shake'}, {path:files.hit, what:'one hit'}, {path:files.groove, what:'the groove, 4 bars'},
    {path:files.sixteenths, what:'a bar of even 16ths', lines:true}]);
  writeFileSync(join(OUT, 'tambourine.json'), JSON.stringify(t, null, 1));
}

// The 20 s Offsite direction sketch (sketch.js) from the published bank, read
// through the loader as a page reads it; Whisper on the voices' stem.
async function sketch() {
  const {TAKE_TABLE, loadVoices} = await import('../src/allhands/voices/voice-table.js');
  const {readVoice} = await import('../src/allhands/voices/node.js');
  const {renderSketch, CUES} = await import('../src/allhands/voices/sketch.js');
  const missing = CUES.map(c => c[2]).filter(k => !TAKE_TABLE[k]);
  if (missing.length) throw new Error(`the sketch needs takes the bank does not hold: ${missing.join(', ')}`);
  const takes = await loadVoices([...new Set(CUES.map(c => TAKE_TABLE[c[2]].file))], {read:readVoice(PUBLIC + '/')});
  const entry = key => ({...TAKE_TABLE[key], voiced:[TAKE_TABLE[key].start, TAKE_TABLE[key].end], kind:TAKE_TABLE[key].kind}), take = key => takes.get(TAKE_TABLE[key].file).samples;
  const melodyFor = (e, {from = null} = {}) => lineFor(e, {register:VOICES[e.voice].register, tonic:'D', scale:'majorPenta', seed:hash(e.file), from,
    end:e.kind === 'call' ? 'open' : /\?$/.test(e.text) ? 'up' : 'home'});
  const out = renderSketch({sr:SR, entry, take, melodyFor});
  const dir = join(OUT, 'listen');
  writeWav(join(dir, 'sketch-offsite-20s.wav'), [out.left, out.right]);
  writeWav(join(dir, 'sketch-voices.wav'), [Float32Array.from(out.stems.voices[0], (v, i) => (v + out.stems.voices[1][i]) / 2)]);
  const lyric = out.cues.map(c => TAKE_TABLE[c.id].text).join(' ');
  const jobs = [{id:'sketch', variant:'voices', text:lyric, path:join(dir, 'sketch-voices.wav')}];
  out.cueCuts().forEach((c, k) => {
    const path = join(OUT, 'test', 'sketch-cuts', `${String(k).padStart(2, '0')}-alone.wav`);
    writeWav(path, [c.samples]);
    jobs.push({id:c.id, variant:'cue alone in the band', text:TAKE_TABLE[c.id].text, path, at:c.at});
  });
  const heard = py('hear', jobs);
  writeFileSync(join(OUT, 'sketch.json'), JSON.stringify({cues:out.cues, voiceGainDb:out.voiceGainDb, heard}, null, 1));
  console.log(`sketch: ${out.cues.length} cues; voices' stem ${heard[0].errors} of ${heard[0].words} words wrong; cues alone in the band exact ${heard.slice(1).filter(h => !h.errors).length}/${heard.length - 1}`);
}

await run();
if (STEPS.has('publish')) publish();
else if (JOBS.some(j => j.tried.length)) report({entries:[], lines:{}});
if (STEPS.has('verify')) await verify();
if (STEPS.has('pitch')) pitch();
if (STEPS.has('tambourine')) tambourine();
if (STEPS.has('sketch')) await sketch();
