// The export: the film, offline and frame-exact, to an MP4 that phones and the
// platforms accept. Deterministic: the same EDL, plan, shots and song give the same
// samples and the same frames.
//
//   const out = await exportFilm({edl, plan, shots, song:{buffers, lady}, onProgress, signal});
//   out.mp4       Uint8Array: H.264 High 4.0 (avc1.640028), 24 fps CFR, 8 Mbps (24 Mbps with master:true),
//                 plus AAC-LC 48 kHz 256k, or Opus 48 kHz 256k where the browser has no AAC encoder
//   out.vtt       captions.vtt: Synergy's lines and the lady's, on the song's clock
//   out.sidecar   {hashes:{edl, plan, program, mp4}, film, video, audio, lint, stats, edl}
//
// 1. Audio: engine.render() with stems (master on 0-1, the six stems on 2-7), resampled to
//    48 kHz by the browser's sinc resampler; song time 0 is sample 0 of the file.
// 2. Features: buildFeatures() on that render (stem levels, the kick, eqTrack), then
//    compile() again with them, so every bound parameter follows the real mix.
// 3. Picture: for f = from…to−1, the decoder (media/decoder.js) decodes exactly the source
//    frames the frame shows, the compositor draws, the canvas is wrapped in a VideoFrame at
//    timestamp (f − from)/24 s, encoded, and closed. Backpressure on encodeQueueSize.
// 4. mp4-muxer writes the file, moov first.
// Errors in the lint block the export (pass force:true to export a draft anyway).
import {Muxer, ArrayBufferTarget} from 'mp4-muxer';
import {render as renderSong, RENDER_OFFSET, STEMS} from '../../allhands/engine.js';
import {buildFeatures, planFeatures} from '../edl/params.js';
import {compile} from '../edl/compile.js';
import {stringify} from '../edl/schema.js';
import {stepTime, stepAtTime, barSteps, ladyTime, audioLatency, chokeFrames} from '../edl/anchors.js';
import {createCompositor} from '../gl/compositor.js';
import {createFrameDecoder, frameLedger} from '../media/decoder.js';
import {needsProxy} from '../media/shots.js';
import {FORMATS} from '../layouts.js';

export const FPS = 24;
export const VIDEO = {codec:'avc1.640028', bitrate:8_000_000, masterBitrate:24_000_000, keyEvery:48};
export const AUDIO = {sampleRate:48000, channels:2, bitrate:256_000,
  aac:{codec:'mp4a.40.2', mux:'aac'}, opus:{codec:'opus', mux:'opus'}};
export const SAMPLES_PER_FRAME = AUDIO.sampleRate / FPS;     // 2000: a frame is a whole number of samples

const abortError = () => (typeof DOMException === 'function' ? new DOMException('The export was cancelled.', 'AbortError') : Object.assign(Error('The export was cancelled.'), {name:'AbortError'}));
const tick = () => new Promise(r => setTimeout(r, 0));

// ---- what this browser can encode ------------------------------------------------------------------
export async function exportSupport({width = 1080, height = 1920, master = false} = {}) {
  const out = {video:false, audio:null, fallback:false, note:''};
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined' || typeof VideoDecoder === 'undefined') {
    out.note = 'This browser has no WebCodecs. Export in Chrome, Edge or Safari 17 or later.';
    return out;
  }
  try { out.video = !!(await VideoEncoder.isConfigSupported(videoConfig(width, height, master))).supported; } catch { out.video = false; }
  if (!out.video) out.note = `This browser cannot encode H.264 at ${width}×${height}.`;
  if (typeof AudioEncoder !== 'undefined') {
    for (const kind of ['aac', 'opus']) {
      try {
        const cfg = audioConfig(kind);
        if ((await AudioEncoder.isConfigSupported(cfg)).supported) { out.audio = kind; break; }
      } catch {}
    }
  }
  out.fallback = out.audio === 'opus';
  if (out.fallback) out.note = 'This browser has no AAC encoder, so the sound is Opus in the MP4. It plays in browsers, QuickTime on recent macOS and on phones; re-encode to AAC for older players.';
  if (!out.audio) out.note = (out.note ? out.note + ' ' : '') + 'This browser cannot encode the sound.';
  return out;
}
export function videoConfig(width, height, master = false) {
  return {codec:VIDEO.codec, width, height, bitrate:master ? VIDEO.masterBitrate : VIDEO.bitrate, framerate:FPS, bitrateMode:'variable', latencyMode:'quality', avc:{format:'avc'}};
}
export function audioConfig(kind) {
  return {codec:AUDIO[kind].codec, sampleRate:AUDIO.sampleRate, numberOfChannels:AUDIO.channels, bitrate:AUDIO.bitrate};
}

// ---- hashes ----------------------------------------------------------------------------------------
export async function sha256(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// The plan as canonical JSON: typed arrays as arrays, numbers as written, functions dropped.
export function planJSON(plan) {
  return JSON.stringify(plan, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : typeof v === 'function' ? undefined : v);
}

// ---- captions ----------------------------------------------------------------------------------------
const vttTime = s => { const ms = Math.max(0, Math.round(s * 1000)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
const sentence = s => { const t = String(s).toLowerCase().replace(/\s+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
// Every line Synergy sings and every phrase the lady says, timed by the plan. A retriggered
// phrase (the ladder) is one cue from its first hit to its last. from/to: the span in song s;
// cue times are relative to `from` (the file's time zero).
export function captions(plan, {from = 0, to = stepTime(plan, plan.totalSteps), host = 'Synergy', lady = 'Circle Back'} = {}) {
  const cues = [];
  for (const line of plan.lines || []) {
    const words = (plan.words || []).filter(w => w.line === plan.lines.indexOf(line));
    const list = words.length ? words : line.words || [];
    if (!list.length) continue;
    const a = stepTime(plan, Math.min(...list.map(w => w.at)));
    const b = Math.max(...list.map(w => Math.min(stepTime(plan, w.at) + (w.gate ?? Infinity) / (w.rate || 1), stepTime(plan, w.at + (w.steps ?? 1)))));
    cues.push({a, b:Math.max(b, a + .5), voice:host, text:line.text});
  }
  let run = null;
  for (const e of plan.lady || []) {
    const a = ladyTime(plan, e), b = a + Math.max(.25, e.gate ?? Math.max(0, (e.to - e.from) / (e.rate || 1)));
    if (run && run.display === e.display && e.role === 'ladder' && run.role === 'ladder' && a - run.b < 1.05) { run.b = Math.max(run.b, b); continue; }
    if (run) cues.push(run);
    run = {a, b, voice:lady, text:sentence(e.display), display:e.display, role:e.role};
  }
  if (run) cues.push(run);
  cues.sort((x, y) => x.a - y.a || (x.voice === host ? -1 : 1));
  // One voice, one line at a time: a cue ends where the same voice's next cue begins
  // (the ladder's last 32nds ran into "Let's circle-", "Let that" into "Sink in").
  for (const v of [host, lady]) { const own = cues.filter(c => c.voice === v); for (let i = 0; i + 1 < own.length; i++) own[i].b = Math.min(own[i].b, own[i + 1].a); }
  const out =['WEBVTT', '', 'NOTE LinkedIn Beats, Video Studio export. Times are the song\'s clock.', ''];
  let n = 0;
  for (const c of cues) {
    const a = Math.max(c.a, from), b = Math.min(c.b, to);
    if (b - a < .04) continue;
    out.push(String(++n), `${vttTime(a - from)} --> ${vttTime(b - from)}`, `<v ${c.voice}>${c.text.replace(/[<>&]/g, ch => ({'<':'&lt;', '>':'&gt;', '&':'&amp;'}[ch]))}`, '');
  }
  return out.join('\n');
}

// ---- audio -------------------------------------------------------------------------------------------
// A float WAV of the first `channels` channels, for the browser's resampler.
function floatWav(channels, sampleRate) {
  const n = channels[0].length, C = channels.length, bytes = new ArrayBuffer(44 + n * C * 4), v = new DataView(bytes);
  const str = (at, s) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * C * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); v.setUint16(22, C, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * C * 4, true); v.setUint16(32, C * 4, true); v.setUint16(34, 32, true);
  str(36, 'data'); v.setUint32(40, n * C * 4, true);
  const f = new Float32Array(bytes, 44);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) f[i * C + c] = channels[c][i];
  return bytes;
}
// The master at 48 kHz: [L, R] Float32Arrays of exactly `samples` samples from song time `t0`.
export async function master48k(channels, sampleRate, {offset, t0, samples}) {
  let out = channels;
  if (sampleRate !== AUDIO.sampleRate) {
    const ctx = new OfflineAudioContext({numberOfChannels:channels.length, length:1, sampleRate:AUDIO.sampleRate});
    const buf = await ctx.decodeAudioData(floatWav(channels, sampleRate));
    out = Array.from({length:buf.numberOfChannels}, (_, c) => buf.getChannelData(c));
  }
  const start = Math.round((offset + t0) * AUDIO.sampleRate);
  return out.slice(0, AUDIO.channels).map(x => {
    const y = new Float32Array(samples);
    for (let i = 0; i < samples; i++) { const j = start + i; y[i] = j >= 0 && j < x.length ? x[j] : 0; }
    return y;
  });
}

// OpusHead: the pre-skip (samples the decoder drops) is the little-endian u16 at byte 10.
const opusPreSkip = d => (ArrayBuffer.isView(d) ? new DataView(d.buffer, d.byteOffset, d.byteLength) : new DataView(d)).getUint16(10, true);
async function encodeAudio(pcm, kind, muxer, {signal} = {}) {
  const chunks = [];
  let error = null;
  const enc = new AudioEncoder({output:(chunk, meta) => chunks.push({chunk, meta}), error:e => { error = e; }});
  enc.configure(audioConfig(kind));
  const block = 4800, n = pcm[0].length;
  for (let i = 0; i < n; i += block) {
    if (signal?.aborted) { enc.close(); throw abortError(); }
    const m = Math.min(block, n - i), data = new Float32Array(m * pcm.length);
    pcm.forEach((x, c) => data.set(x.subarray(i, i + m), c * m));
    const ad = new AudioData({format:'f32-planar', sampleRate:AUDIO.sampleRate, numberOfFrames:m, numberOfChannels:pcm.length, timestamp:Math.round(i * 1e6 / AUDIO.sampleRate), data});
    enc.encode(ad); ad.close();
    while (enc.encodeQueueSize > 8) await tick();
  }
  await enc.flush();
  enc.close();
  if (error) throw error;
  for (const {chunk, meta} of chunks) muxer.addAudioChunk(chunk, meta);
  return {chunks:chunks.length, first:chunks[0]?.chunk.timestamp ?? null, last:chunks.at(-1) ? chunks.at(-1).chunk.timestamp + (chunks.at(-1).chunk.duration ?? 0) : null,
    description:chunks.find(c => c.meta?.decoderConfig)?.meta.decoderConfig ?? null};
}

// ---- the export ----------------------------------------------------------------------------------------
// opts:
//   edl, plan, shots (shots.json or its list), song {buffers, lady} (for engine.render)
//   format (the EDL's), scale (1: the format's size), master (24 Mbps), span [from, to) in frames
//   audio: 'render' (default) | null (no sound) | {sampleRate, channels:[L, R, ...stems?], offset} song-time-zero at `offset` s
//   features: feature tracks to compile with (default: from the render, else from the plan)
//   governor (true), post (compositor post options), media ('proxy'), reversed (true; false decodes the forward proxy backwards), force (export despite lint errors)
//   onProgress({phase, frame, frames, fraction, msPerFrame, eta}), signal (AbortSignal)
//   canvas (optional), fontBase, ledger (a frameLedger to count VideoFrames across exports)
//   keyEvery (48: a keyframe every 2 s), hashFrames (SHA-256 of every composited frame's RGBA,
//     before the encoder, into sidecar.frameHashes: the reproducible part. Chromium's software
//     H.264 encoder is not bit-reproducible run to run, so the MP4 bytes are not either.)
// The features a whole-song export compiles with: engine.render with the stems, then
// buildFeatures, exactly as exportFilm does it. The monitor measures the band with this once
// the voice is in, and hands the same features to exportFilm, so the preview and the file draw
// one program (speaking borders, binds, Synergy's mouth level).
export async function songFeatures(plan, song = {}) {
  const buf = await renderSong(plan, song.buffers ?? new Map(), {tune:{stems:true}}, song.lady);
  if (buf.numberOfChannels < 2 + STEMS.length) return planFeatures(plan);
  return buildFeatures(plan, buf, {offset:RENDER_OFFSET - plan.timing[0]});
}

export async function exportFilm(opts) {
  const {edl, plan, shots, song = {}, master = false, onProgress, signal, governor = true, post, media = 'proxy', force = false, fontBase = '', keyEvery = VIDEO.keyEvery, hashFrames = false} = opts;
  const format = opts.format ?? edl.format ?? '9:16', scale = opts.scale ?? 1, F = FORMATS[format];
  if (!F) throw Error(`unknown format ${format}`);
  const W = Math.round(F.w * scale / 2) * 2, H = Math.round(F.h * scale / 2) * 2;
  const T0 = performance.now(), timings = {};
  const progress = p => onProgress?.({...p, elapsed:(performance.now() - T0) / 1000});
  const check = () => { if (signal?.aborted) throw abortError(); };

  // ---- support ----
  const support = await exportSupport({width:W, height:H, master});
  if (!support.video) throw Error(support.note || 'This browser cannot encode the film.');
  const wantAudio = opts.audio !== null;
  if (wantAudio && !support.audio) throw Error(support.note);

  // ---- the span ----
  const steps = edl.song?.steps ?? plan.totalSteps, total = Math.round(stepTime(plan, steps) * FPS);
  const [from, to] = opts.span ? [Math.max(0, opts.span[0]), Math.min(total, opts.span[1])] : [0, total];
  if (!(to > from)) throw Error('export: the span is empty');
  const t0 = from / FPS, t1 = to / FPS, n = to - from, samples = n * SAMPLES_PER_FRAME;

  // ---- 1. audio ----
  progress({phase:'audio', frame:0, frames:n, fraction:0});
  let audio = null, offset = 0, features = opts.features ?? null;
  const ta = performance.now();
  if (wantAudio) {
    if (opts.audio && opts.audio !== 'render') { audio = opts.audio; offset = opts.audio.offset ?? 0; }
    else {
      // Render only the bars the span needs (with a bar of run-up for reverb and delay tails).
      const BS = barSteps(plan), bars = plan.bars.length;
      const b0 = Math.max(0, Math.floor(stepAtTime(plan, t0) / BS) - (from > 0 ? 1 : 0)), b1 = Math.min(bars + 1, Math.ceil(stepAtTime(plan, t1) / BS) + 1);
      const whole = b0 === 0 && b1 >= bars;
      const buf = await renderSong(plan, song.buffers ?? new Map(), {tune:{stems:true}, ...(whole ? {} : {bars:[b0, b1]})}, song.lady);
      check();
      offset = RENDER_OFFSET - plan.timing[whole ? 0 : b0 * BS];
      audio = {sampleRate:buf.sampleRate, channels:Array.from({length:buf.numberOfChannels}, (_, c) => buf.getChannelData(c)), offset};
      if (!features && buf.numberOfChannels >= 2 + STEMS.length) features = buildFeatures(plan, buf, {offset});
    }
  }
  features ??= planFeatures(plan);
  timings.audioRender = (performance.now() - ta) / 1000;
  check();

  // ---- 2. the program, compiled with the real features ----
  const tc = performance.now();
  const program = opts.program ?? compile(edl, {plan, shots, features, format});
  timings.compile = (performance.now() - tc) / 1000;
  if (!program.lint.ok && !force) throw Error(`The lint blocks this export: ${program.lint.errors.slice(0, 3).map(e => `${e.rule} ${e.message}`).join('; ')}`);

  // ---- 3. the muxer and the sound ----
  const kind = support.audio;
  const muxer = new Muxer({target:new ArrayBufferTarget(), fastStart:'in-memory', firstTimestampBehavior:'cross-track-offset',
    video:{codec:'avc', width:W, height:H, frameRate:FPS},
    ...(wantAudio ? {audio:{codec:AUDIO[kind].mux, numberOfChannels:AUDIO.channels, sampleRate:AUDIO.sampleRate}} : {})});
  let audioInfo = null, pcm = null;
  if (wantAudio) {
    progress({phase:'sound', frame:0, frames:n, fraction:.01});
    const te = performance.now();
    pcm = await master48k(audio.channels.slice(0, 2), audio.sampleRate, {offset, t0, samples});
    const enc = await encodeAudio(pcm, kind, muxer, {signal});
    let peak = 0; for (const x of pcm) for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    audioInfo = {codec:AUDIO[kind].codec, container:AUDIO[kind].mux, sampleRate:AUDIO.sampleRate, channels:AUDIO.channels, bitrate:AUDIO.bitrate, samples, seconds:samples / AUDIO.sampleRate,
      fallback:support.fallback, note:support.fallback ? support.note : '', peak, chunks:enc.chunks, firstTimestamp:enc.first, endTimestamp:enc.last,
      preSkip:kind === 'opus' && enc.description?.description ? opusPreSkip(enc.description.description) : null};
    timings.audioEncode = (performance.now() - te) / 1000;
  }
  check();

  // ---- 4. the picture ----
  const canvas = opts.canvas ?? (typeof OffscreenCanvas !== 'undefined' && opts.offscreen ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), {width:W, height:H}));
  const comp = createCompositor(canvas, {format, scale:W / F.w, post, fontBase});
  const ledger = opts.ledger ?? frameLedger();
  const decoder = createFrameDecoder({program, shots, from, to, ledger, media, reversed:opts.reversed ?? true});
  let encError = null, chunks = 0, keyframes = 0, bytes = 0;
  const encoder = new VideoEncoder({output:(chunk, meta) => { chunks++; bytes += chunk.byteLength; if (chunk.type === 'key') keyframes++; muxer.addVideoChunk(chunk, meta); }, error:e => { encError = e; }});
  encoder.configure(videoConfig(W, H, master));
  const memory = [], perFrame = new Float32Array(n), split = {decode:0, draw:0, encode:0}, frameHashes = [], pendingHashes = [];
  // Keyframes where the film goes to true black (the choke, the tape stop's lights out) and on the
  // impact: a P-frame into black can leave the encoder's residue (a few code values) on screen, an
  // intra frame of flat black decodes to 0.
  const marks = chokeFrames(plan), cleanCuts = new Set(marks ? [marks.black, marks.impact] : []);
  for (let f = Math.max(1, from); f < to; f++) if (program.frame(f).board.dark && !program.frame(f - 1).board.dark) cleanCuts.add(f);
  const sample = f => memory.push({f, heap:performance.memory?.usedJSHeapSize ?? null, cache:decoder.stats().cacheBytes, entries:decoder.stats().entries, live:ledger.live, textures:comp.textures, queue:encoder.encodeQueueSize});
  try {
    await comp.ready;
    comp.prepare(program, {plan, shots, governor});
    const sources = layer => decoder.source(layer);
    for (let f = from; f < to; f++) {
      check();
      if (encError) throw encError;
      const a = performance.now();
      await decoder.prepare(f);
      const b = performance.now();
      comp.drawFrame(program.frame(f), sources, {program});
      // (Read the pixels in the same task as the draw: the drawing buffer is gone after a yield.)
      if (hashFrames) pendingHashes.push(sha256(comp.read().data));
      const vf = ledger.open(new VideoFrame(canvas, {timestamp:Math.round((f - from) * 1e6 / FPS), duration:Math.round(1e6 / FPS)}), 'canvas');
      const c = performance.now();
      decoder.release(f);
      encoder.encode(vf, {keyFrame:(f - from) % keyEvery === 0 || cleanCuts.has(f)});
      ledger.close(vf);
      while (encoder.encodeQueueSize > 2) await new Promise(r => encoder.addEventListener('dequeue', r, {once:true}));
      const d = performance.now();
      split.decode += b - a; split.draw += c - b; split.encode += d - c;
      perFrame[f - from] = d - a;
      if ((f - from) % 24 === 0) { sample(f); await tick(); }
      const done = f - from + 1, ms = (performance.now() - T0 - (timings.audioRender + (timings.audioEncode ?? 0) + timings.compile) * 1000) / done;
      progress({phase:'picture', frame:done, frames:n, fraction:.02 + .96 * done / n, msPerFrame:ms, eta:(n - done) * ms / 1000});
    }
    progress({phase:'finishing', frame:n, frames:n, fraction:.99});
    await encoder.flush();
    if (encError) throw encError;
    sample(to);
    if (hashFrames) frameHashes.push(...await Promise.all(pendingHashes));
  } finally {
    try { if (encoder.state !== 'closed') encoder.close(); } catch {}
    decoder.dispose();
    comp.dispose?.();
    if (!opts.canvas) comp.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  muxer.finalize();
  const mp4 = new Uint8Array(muxer.target.buffer);
  timings.total = (performance.now() - T0) / 1000;

  // ---- 5. captions and the sidecar ----
  const vtt = captions(plan, {from:t0, to:t1});
  const sorted = Float32Array.from(perFrame).sort();
  const edlText = stringify(edl);
  const sidecar = {
    kind:'linkedinbeats.videostudio.export', version:1,
    film:{title:plan.trackTitle ?? plan.title ?? 'Circle Back', form:plan.form, track:plan.track ?? null, edition:edl.song?.form ?? plan.form, format, width:W, height:H, fps:FPS, scale:W / F.w,
      span:[from, to], frames:n, seconds:n / FPS, songSeconds:[t0, t1], planDuration:plan.duration, coldOpen:!!plan.coldOpen,
      // The choke and the impact, on the film's frames (the timing rule: edl/anchors.js).
      ...(plan.choke?.tagEnd !== undefined ? {marks:{latency:audioLatency(plan), tagEnd:plan.choke.tagEnd, ...chokeFrames(plan)}} : {})},
    video:{codec:VIDEO.codec, bitrate:master ? VIDEO.masterBitrate : VIDEO.bitrate, cfr:FPS, keyEvery, chunks, keyframes, bytes},
    audio:audioInfo,
    hashes:{edl:await sha256(edlText), plan:await sha256(planJSON(plan)), program:program.hash(), mp4:await sha256(mp4), features:features.source},
    lint:{ok:program.lint.ok, errors:program.lint.errors.length, warnings:program.lint.warnings.length},
    media:mediaReport(program, shots, media, decoder.stats().masters),
    stats:{seconds:timings, msPerFrame:{mean:sorted.reduce((s, x) => s + x, 0) / n, p50:sorted[Math.floor(n / 2)], p95:sorted[Math.floor(n * .95)], max:sorted[n - 1]},
      split:{decode:split.decode / n, draw:split.draw / n, encode:split.encode / n},
      decoder:decoder.stats(), frames:{opened:ledger.opened, closed:ledger.closed, live:ledger.live, peak:ledger.peak, byKind:ledger.byKind}, memory},
    ...(hashFrames ? {frameHashes} : {}),
    edl,
  };
  progress({phase:'done', frame:n, frames:n, fraction:1});
  return {mp4, vtt, sidecar, program, pcm};
}

// Which footage the film read, and where the media route had to stand a master in for a proxy
// (not uploaded yet). needsProxy: the shots whose master is H.264 4:4:4, which iOS cannot decode;
// standIns: those of them (and any other shot) served as the master in this export.
export function mediaReport(program, shots, media = 'proxy', masterUrls = []) {
  const list = shots?.shots ?? shots ?? [], byId = new Map((list instanceof Map ? [...list.values()] : list).map(s => [s.id, s]));
  const used = [...new Set(program.clips.map(c => c.shotId).filter(Boolean))].map(id => byId.get(id)).filter(Boolean);
  const urls = new Set(masterUrls);
  return {mode:media, needsProxy:used.filter(needsProxy).map(s => s.id), standIns:used.filter(s => s.proxy && urls.has(s.proxy)).map(s => s.id)};
}

// File names: linkedinbeats-circle-back-drop60-9x16.mp4 and friends.
export function exportName(plan, format, ext = 'mp4') {
  const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `linkedinbeats-${slug(plan.track ?? 'circle-back')}-${slug(plan.form ?? 'drop60')}-${format.replace(':', 'x')}.${ext}`;
}
