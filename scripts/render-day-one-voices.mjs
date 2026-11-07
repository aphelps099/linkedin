// Day One's voice takes: "Congrats on the new role!" in the band's local voices,
// rendered, aligned and heard the way the pixel-voice bank renders its lines
// (scripts/render-song-voices.mjs), into their own folder. The shared bank is
// left untouched. No paid voice service: Strategy is the local Kokoro model (the
// voice bank's exact q8 artifact, am_onyx), Synthia is Flite slt through FFmpeg.
//
//   node scripts/render-day-one-voices.mjs --out DIR --models DIR [--steps tts,align,hear,publish]
//
//   S1      Kokoro am_onyx at speed .95 (the bank's Strategy): the motif
//   S2, S3  the same voice at .90 and 1.00
//   Y1-Y3   Flite slt at pitch 1.04 (the bank's Synthia), 1.00 and 1.10
//
//   tts      the dry take, trimmed and levelled as the bank's (-20 dBFS active speech, peak <= -1 dBFS)
//   align    measure.py align --verify (the lady's aligner: word times, vowel onsets, syllable nuclei)
//   hear     Whisper small.en on the dry take and on the take sung as the film sings it: a choir
//            copy intoned at the bottom and the top of the voice's choir range (Strategy B2 and
//            F#3, Synthia B3 and A4, "role" one step down) at medium (.6), Synthia at light (.3)
//            if medium fails; S1 also spoken, lightly corrected along its own contour (.3).
//            A take passes when every render is heard exactly ("congrats on the new role").
//   publish  FLAC (the pitch track in PIXEL_PITCH) -> public/films/day-one/voices/<id>.flac,
//            the manifest -> src/films/day-one/voices.json, the report -> DIR/report.json
//
// A take that fails walks its respellings (SAY below, the bank's procedure: the lyric never
// changes, only what the engine is given), one round each; results are cached under DIR/work.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, rmSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {VOICES} from '../src/allhands/voices/items.js';
import {encodeWav, decodeWav} from '../src/allhands/voices/wav.js';
import {decodeFlac, pitchToTag, pitchFromTag} from '../src/allhands/voices/flac.js';
import {analyse, pixelate, pitchTrack} from '../src/allhands/voices/pixel.js';
import {TEXT, TAKES, RANGES, SPOKEN_AMOUNT, intoned, spoken, grats} from '../src/films/day-one/voices.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg('out');
if (!OUT) throw new Error('Pass --out DIR (the takes, the test renders and the report go there).');
const MANIFEST = resolve(root, arg('manifest', 'src/films/day-one/voices.json'));
const PUBLIC = resolve(root, arg('public', 'public/films/day-one/voices'));
const STEPS = new Set(arg('steps', 'tts,align,hear,publish').split(','));
const SR = 44100, MEASURE = resolve(root, 'src/allhands/voices/measure.py');

// Respellings, tried in order (what Whisper heard is noted when one is needed).
const SAY = {
  strategy:[TEXT, 'Congrats on the new role.', 'Congrats, on the new role!', 'Congrats on the new rohl!', 'Congratz on the new role!'],
  // Flite's "role" is heard "rule" (and, high, "room"): spellings that lean its letter-to-sound toward a longer "oh".
  synthia:[TEXT, 'Congrats on the new role.', 'Congrats, on the new role!', 'Con-grats on the new role!', 'Congrats on the new rohl!',
    'Congrats on the new roal!', 'Congrats on the new rolle!', 'Congrats on the new rhole!', 'Congrats on the new roll!',
    // (those four are the same phones to Flite: the same audio) and three that are not:
    'Congrats on the new rowl!', 'Congrats on the new ro-ul!', 'Congrats on the new rolel!'],
};
// Words that sound exactly alike, which Whisper may spell either way (the bank's rule, measure.py HOMOPHONES:
// "a quick sink", "a knot right now"): "roll" is "role" (both R OW L in the CMU dictionary). The motif's
// spoken render, which the film hears alone, must be heard literally.
const wordsOf = s => s.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
const HOMOPHONES = {roll:'role'};
const heardAs = (h, homophones = true) => !!h && (h.errors === 0 || (homophones && wordsOf(h.heard).map(w => HOMOPHONES[w] ?? w).join(' ') === wordsOf(TEXT).join(' ')));

const sha = b => createHash('sha256').update(b).digest('hex');
const short = s => createHash('sha1').update(s).digest('hex').slice(0, 8);
const mk = p => (mkdirSync(dirname(p), {recursive:true}), p);
const ff = (args, input) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {input, maxBuffer:256 * 1024 * 1024});
const f32 = buf => new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const resample = (x, from, to) => from === to ? x : f32(ff(['-f', 'f32le', '-ar', String(from), '-ac', '1', '-i', 'pipe:0',
  '-af', 'aresample=resampler=soxr:precision=28', '-ar', String(to), '-f', 'f32le', 'pipe:1'], Buffer.from(x.buffer, x.byteOffset, x.byteLength)));
const readMono = path => decodeWav(readFileSync(path)).channels[0];
const writeWav = (path, ch, sr = SR) => writeFileSync(mk(path), encodeWav(ch, sr));
const readJson = (p, d) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d;
const writeAtomic = (p, text) => { const tmp = `${p}.${process.pid}.tmp`; writeFileSync(mk(tmp), text); renameSync(tmp, p); };
const py = (cmd, jobs, extra = []) => {
  if (!jobs.length) return [];
  const src = join(OUT, 'work', `${cmd}-${process.pid}-jobs.json`), dst = join(OUT, 'work', `${cmd}-${process.pid}-out.json`);
  writeFileSync(mk(src), JSON.stringify(jobs));
  execFileSync('python3', ['-I', '-B', MEASURE, cmd, src, dst, ...extra], {stdio:['ignore', 'inherit', 'inherit'], maxBuffer:64 * 1024 * 1024});
  return JSON.parse(readFileSync(dst, 'utf8'));
};

// ---------------------------------------------------------------- the dry take (as render-song-voices.mjs finish())
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

let K = null;
async function kokoro() {
  if (K) return K;
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
  const identity = {provider:'local-kokoro', modelId:id, dtype:'q8', voice:VOICES.strategy.voice,
    modelSha256:sha(readFileSync(resolve(cache, 'onnx/model_quantized.onnx'))), tokenizerSha256:sha(readFileSync(resolve(cache, 'tokenizer.json'))),
    configSha256:sha(readFileSync(resolve(cache, 'config.json'))), voiceDataSha256:sha(readFileSync(resolve(kdir, `voices/${VOICES.strategy.voice}.bin`)))};
  const bank = JSON.parse(readFileSync(resolve(root, 'public/studio/voices/recordings.json'), 'utf8')).rendererByCharacter.strategy;
  identity.matchesVoiceBank = ['modelSha256', 'tokenizerSha256', 'configSha256', 'voiceDataSha256'].every(k => bank[k] === identity[k]);
  if (!identity.matchesVoiceBank) throw new Error('This Kokoro model is not the voice bank\'s approved artifact; Strategy would not be Strategy.');
  return (K = {tts:new KokoroTTS(model, tokenizer), identity});
}

// The meeting season's Synthia chain (render-meeting-season.py), at the take's pitch.
function flite(text, p) {
  const tmp = join(OUT, 'work', `flite-${process.pid}.txt`), r = 24000;
  writeFileSync(mk(tmp), text.replace(/’/g, "'"));
  return f32(ff(['-f', 'lavfi', '-i', `flite=textfile=${tmp}:voice=${VOICES.synthia.voice}`, '-af',
    `aresample=${r},asetrate=${Math.round(r * p)},aresample=${r},atempo=${(1 / p).toFixed(6)}`, '-ar', String(r), '-ac', '1', '-f', 'f32le', 'pipe:1']));
}

// ---------------------------------------------------------------- jobs
const JOBS = TAKES.map(t => ({...t, variants:SAY[t.voice], tried:[], chosen:null}));
const takeOf = (job, said) => {
  const name = `${job.id}~${short(said)}`;
  return {job, said, name, wav:join(OUT, 'takes', `${name}.wav`), result:join(OUT, 'work', 'results', `${name}.json`)};
};
const resultOf = t => readJson(t.result, {name:t.name, id:t.job.id, voice:t.job.voice, said:t.said});
const save = (t, r) => writeAtomic(t.result, JSON.stringify(r, null, 1));
const amountsOf = voice => voice === 'synthia' ? [VOICES.synthia.amount, VOICES.synthia.fallbackAmount] : [VOICES.strategy.amount];
// The test renders: [variant, notes(entry, track), amount].
export function testsOf(job, amount) {
  const [lo, hi] = RANGES[job.voice];
  return [[`${amount}|low`, e => intoned(e, lo), amount], [`${amount}|high`, e => intoned(e, hi), amount]];
}
const spokenTest = job => job.motif ? [['spoken', (e, track) => spoken(e, track), SPOKEN_AMOUNT]] : [];

async function tts(takes) {
  const idPath = join(OUT, 'work', 'identity.json'), identity = readJson(idPath, {});
  for (const t of takes.filter(x => !existsSync(x.wav))) {
    let raw, rate;
    if (t.job.voice === 'strategy') {
      const k = await kokoro();
      identity.strategy = k.identity;
      const a = await k.tts.generate(t.said, {voice:VOICES.strategy.voice, speed:t.job.speed});
      raw = a.audio; rate = a.sampling_rate;
    } else {
      raw = flite(t.said, t.job.pitch); rate = 24000;
      identity.synthia = {provider:'flite', voice:'slt', engine:execFileSync('ffmpeg', ['-version']).toString().split('\n')[0],
        chain:'lavfi flite -> aresample 24000, asetrate 24000 x pitch, aresample 24000, atempo 1/pitch (render-meeting-season.py)'};
    }
    const y = finish(resample(raw, rate, SR));
    writeWav(t.wav, [y]);
    console.log(`tts ${t.name.padEnd(16)} ${(y.length / SR).toFixed(3)} s  ${JSON.stringify(t.said)}`);
  }
  writeAtomic(idPath, JSON.stringify(identity, null, 1));
}

function align(takes) {
  const todo = takes.filter(t => !resultOf(t).align);
  const rows = py('align', todo.map(t => ({id:t.name, voice:t.job.voice, kind:'expression', text:TEXT, file:`${t.job.id}.flac`, path:t.wav})), ['--verify']);
  for (const row of rows) { const t = todo.find(x => x.name === row.id), r = resultOf(t); r.align = row; save(t, r); }
}

const storedTrack = x => pitchFromTag(pitchToTag(pitchTrack(x, SR)));
function hear(takes) {
  for (const pass of [0, 1]) {
    const jobs = [];
    for (const t of takes) {
      const r = resultOf(t);
      if (!r.align) continue;
      r.hear ??= {};
      const [primary, fallback] = amountsOf(t.job.voice);
      let tests;
      if (pass === 0) {
        if (!r.hear.dry) jobs.push({id:t.name, variant:'dry', text:TEXT, path:t.wav});
        tests = [...testsOf(t.job, primary), ...spokenTest(t.job)];
      } else {
        if (fallback === undefined || testsOf(t.job, primary).every(([v]) => heardAs(r.hear[v]))) continue;
        tests = testsOf(t.job, fallback);
      }
      tests = tests.filter(([v]) => !r.hear[v]);
      if (!tests.length) { save(t, r); continue; }
      const x = readMono(t.wav), track = storedTrack(x), analysis = analyse(x, SR, {track}), entry = {...r.align, voice:t.job.voice};
      for (const [variant, notesOf, amount] of tests) {
        const notes = notesOf(entry, track), y = pixelate(x, SR, {notes, amount, analysis}).samples;
        const path = join(OUT, 'test', variant.replace('|', '-'), `${t.name}.wav`);
        writeWav(path, [y]);
        jobs.push({id:t.name, variant, text:TEXT, path, notes:notes.map(n => n.midi)});
      }
      save(t, r);
    }
    for (const h of py('hear', jobs)) {
      const t = takes.find(x => x.name === h.id), r = resultOf(t);
      r.hear[h.variant] = {heard:h.heard, errors:h.errors, notes:h.notes};
      save(t, r);
    }
  }
}

function verdict(t) {
  const r = resultOf(t), a = r.align;
  if (!a || !r.hear?.dry) return null;
  const words = a.words || [], exact = h => heardAs(h);
  const sane = words.length === 5 && words.every((w, i) => w.start < w.end && (i === 0 || w.start >= words[i - 1].end - 1e-6)) && (words[0].syllables || []).length === 2;
  const amount = amountsOf(t.job.voice).find(m => testsOf(t.job, m).every(([v]) => exact(r.hear[v])));
  const spokenOk = spokenTest(t.job).every(([v]) => heardAs(r.hear[v], false));
  return {pass:!!(sane && exact(r.hear.dry) && amount && spokenOk), amount:amount ?? null, sane, dry:exact(r.hear.dry), spoken:t.job.motif ? spokenOk : undefined};
}

async function run() {
  for (let round = 0; round < 12; round++) {
    const pending = JOBS.filter(j => !j.chosen && j.variants[round] !== undefined);
    if (!pending.length) break;
    const takes = pending.map(j => takeOf(j, j.variants[round]));
    console.log(`round ${round + 1}: ${takes.map(t => t.name).join(', ')}`);
    if (STEPS.has('tts')) await tts(takes);
    if (STEPS.has('align')) align(takes.filter(t => existsSync(t.wav)));
    if (STEPS.has('hear')) hear(takes);
    for (const t of takes) {
      const v = verdict(t);
      t.job.tried.push({said:t.said, name:t.name, ...v, heard:Object.fromEntries(Object.entries(resultOf(t).hear || {}).map(([k, h]) => [k, h.heard]))});
      if (v?.pass) { t.job.chosen = t; t.job.amount = v.amount; }
    }
  }
}

// ---------------------------------------------------------------- publish
// The tail cut as the bank's (40 ms after the last frame within 30 dB of the loudest, 80 to 250 ms after the last word).
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

function publish() {
  const identity = readJson(join(OUT, 'work', 'identity.json'), {});
  // A take no spelling passes is not published (the bank's rule: not available); the manifest says what Whisper heard.
  const failed = JOBS.filter(j => !j.chosen).map(j => ({id:j.id, voice:j.voice, ...(j.speed !== undefined ? {speed:j.speed} : {pitch:j.pitch}),
    tried:j.tried.map(t => ({said:t.said, heard:t.heard}))}));
  if (!JOBS.find(j => j.motif)?.chosen) throw new Error('the motif (S1) did not pass: nothing to publish');
  const takes = [];
  for (const job of JOBS.filter(j => j.chosen)) {
    const t = job.chosen, r = resultOf(t), a = r.align, x = readMono(t.wav), y = trimTail(x, a.words.at(-1).end);
    const wav = y.length < x.length ? join(OUT, 'work', 'publish', `${t.name}.wav`) : t.wav;
    if (y.length < x.length) writeWav(wav, [y]);
    const file = `${job.id}.flac`, out = mk(join(PUBLIC, file));
    ff(['-i', wav, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-c:a', 'flac', '-compression_level', '12',
      '-metadata', `PIXEL_PITCH=${pitchToTag(pitchTrack(y, SR))}`, '-f', 'flac', out]);
    const bytes = readFileSync(out), back = decodeFlac(bytes), pcm = decodeWav(readFileSync(wav)).channels[0];
    if (back.samples !== pcm.length || back.channels[0].some((v, i) => v !== pcm[i])) throw new Error(`${file}: the FLAC does not decode to the take`);
    const entry = {id:job.id, voice:job.voice, ...(job.speed !== undefined ? {speed:job.speed} : {pitch:job.pitch}), motif:job.motif || undefined,
      text:TEXT, said:t.said !== TEXT ? t.said : undefined, file, samples:back.samples, duration:+(back.samples / SR).toFixed(4),
      trimmedFrom:y.length < x.length ? x.length : undefined, voiced:a.voiced, f0:a.f0, rmsDb:a.rmsDb, gainDb:a.gainDb, amount:job.amount,
      words:a.words.map(w => ({text:w.text, start:w.start, end:w.end, onset:w.onset, syllables:w.syllables, f0:w.f0, check:w.check})),
      confidence:a.confidence, method:a.method,
      heard:Object.fromEntries(Object.entries(r.hear).map(([k, h]) => [k, h.heard])), bytes:bytes.length, sha256:sha(bytes)};
    entry.grats = grats(entry);
    takes.push(entry);
  }
  const manifest = {
    version:1,
    note:'Day One\'s one line, "Congrats on the new role!", in Strategy\'s and Synthia\'s local voices: FLAC 44.1 kHz mono 16-bit, trimmed as the pixel-voice bank\'s takes, active speech at -20 dBFS, the pitch track in PIXEL_PITCH. Times are seconds in the file; grats is the vowel onset of "grats", the grid point. Each take was heard exactly by Whisper small.en dry and sung as the film sings it. Written by scripts/render-day-one-voices.mjs.',
    sampleRate:SR, base:'films/day-one/voices/', format:'flac', text:TEXT,
    test:{ranges:RANGES, amounts:{strategy:amountsOf('strategy'), synthia:amountsOf('synthia')}, spoken:SPOKEN_AMOUNT, whisper:'faster-whisper small.en int8, beam 5, temperature 0'},
    homophones:{roll:'role'},
    identity, takes, failed,
  };
  writeFileSync(mk(MANIFEST), JSON.stringify(manifest, null, 1) + '\n');
  for (const f of readdirSync(PUBLIC)) if (!takes.some(e => e.file === f)) rmSync(join(PUBLIC, f));
  if (failed.length) console.log(`not published (no spelling passed): ${failed.map(f => f.id).join(', ')}`);
  console.log(`manifest ${MANIFEST}: ${takes.length} takes, ${(takes.reduce((s, e) => s + e.bytes, 0) / 1e3).toFixed(1)} KB of FLAC in ${PUBLIC}`);
}

await run();
writeFileSync(mk(join(OUT, 'report.json')), JSON.stringify(JOBS.map(j => ({id:j.id, voice:j.voice, pass:!!j.chosen, amount:j.amount ?? null, tried:j.tried})), null, 1));
for (const j of JOBS) console.log(`${j.id} ${j.voice.padEnd(8)} ${j.chosen ? `PASS at ${j.amount} as ${JSON.stringify(j.chosen.said)}` : 'FAIL'}  ${j.tried.map(t => JSON.stringify(t.heard)).join(' | ')}`);
if (STEPS.has('publish')) publish();
