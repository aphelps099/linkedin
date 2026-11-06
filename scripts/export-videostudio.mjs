// Export a Video Studio film to an MP4 in headless Chromium, exactly as the
// /videostudio/ page's Download MP4 does: the song rendered offline (Synergy's
// voice from eSpeak through the dev server, the lady's recordings), the frame
// program compiled on the real stems, every frame decoded, composited and encoded
// with WebCodecs. Writes <name>.mp4, <name>.vtt and <name>.json (the sidecar).
//
//   node scripts/export-videostudio.mjs [--format 9:16|1:1|16:9] [--scale 1] [--span 0-1440]
//       [--edl track|draft|offsite-psych|printer-mouth|studio|metronome|file.json] [--track circle-back|hustle|offsite|printer-song|...] [--master]
//       [--post FILE] [--auto] [--no-cold-open] [--no-audio] [--no-governor] [--out DIR] [--name NAME] [--url http://127.0.0.1:5351 | --port 5351]
//       [--audio FILE] [--aac 320k] [--keep-picture] [--gpu] [--headed]
//
// A recorded track (treatments/index.js RECORDED: --track printer-song) is a sound file, not the engine's
// song: its plan comes with it (the clock, the gestures, the words), the page decodes its file (the repo's,
// or --audio) and measures its features from it, draws the picture in sync with it, and ffmpeg then muxes
// that same file under the picture as AAC (--aac, 320k by default, 48 kHz stereo, faststart): one command,
// one finished MP4, the flash governor on. Needs ffmpeg on the PATH. --keep-picture keeps the silent
// picture file the mux started from. No captions: a recording has no lyrics.
//
// --gpu launches Chromium without SwiftShader (the machine's own GPU through ANGLE: Metal on a Mac);
// --headed opens a real window, which a Mac's GPU always serves. The run prints the WebGL renderer.
//
// The film opens cold (the impact at frame 0, then the rewind), as the monitor's does. --post cuts
// another post; --auto lets the post choose its track and the lady's lines (casting.js castSong; with --track, the
// post's cast on that track),
// as /allhands/ and the monitor's Let the post choose do; --track picks one by hand.
//
// Without --url it starts its own Vite dev server (the project's config, so the
// media route and the voice route are there) on --port (default 0: any free port)
// and closes it when done. SwiftShader WebGL when there is no GPU.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; };
const flag = name => argv.includes(`--${name}`);

export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
// The machine's own GPU (--gpu): ANGLE on its default backend (Metal on a Mac, D3D on Windows, GL on Linux).
export const GPU_ARGS = ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];

// A Vite dev server on `port` (0 = any free port), or the one at `url`.
// Its own dependency cache, so it never re-optimises under another dev server's feet.
export async function studioServer({url, port = 0, cacheDir = process.env.VIDEOSTUDIO_VITE_CACHE || path.join(os.tmpdir(), 'videostudio-export-vite')} = {}) {
  if (url) return {origin:url.replace(/\/$/, ''), close:async () => {}};
  const {createServer} = await import('vite');
  const server = await createServer({root:ROOT, configFile:path.join(ROOT, 'vite.config.js'), cacheDir, logLevel:'error', clearScreen:false, server:{port:+port, strictPort:+port !== 0, host:'127.0.0.1', hmr:false}});
  await server.listen();
  const addr = server.httpServer.address();
  return {origin:`http://127.0.0.1:${addr.port}`, close:() => server.close(), server};
}

export function launch({gpu = false, ...opts} = {}) {
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Exporting needs Playwright (require("playwright")).'); })();
  return chromium.launch({args:gpu ? GPU_ARGS : GL_ARGS, ...opts});
}

// A blank same-origin page with the export's modules loaded as window.X.
// audio: a recorded track's sound file (bytes), served to the page at /__videostudio-audio.
export async function exportPage(browser, origin, {log = () => {}, audio = null} = {}) {
  const page = await browser.newPage({viewport:{width:480, height:320}});
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); log(`[page] ${e.message}`); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log(`[page ${m.type()}] ${m.text()}`); });
  await page.route(`${origin}/__videostudio-export`, r => r.fulfill({contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><title>Video Studio export</title><body style="margin:0;background:#000"></body>'}));
  if (audio) await page.route(`${origin}/__videostudio-audio`, r => r.fulfill({contentType:'application/octet-stream', body:audio}));
  await page.goto(`${origin}/__videostudio-export`);
  await page.evaluate(async () => {
    const m = s => import(s);
    const X = window.X = {};
    Object.assign(X, await m('/src/videostudio/render/export.js'), await m('/src/videostudio/edl/compile.js'), await m('/src/videostudio/edl/schema.js'),
      await m('/src/videostudio/edl/metronome.js'), await m('/src/videostudio/edl/anchors.js'), await m('/src/videostudio/media/decoder.js'));
    ({FORMS:X.FORMS, formOf:X.formOf} = await m('/src/allhands/forms.js'));
    X.AVAILABLE = (await m('/src/allhands/voices/voice-table.js')).AVAILABLE;
    X.L = await m('/src/allhands/lyrics.js');
    X.voice = await m('/src/allhands/voice.js');
    X.lady = await m('/src/allhands/lady.js');
    X.engine = await m('/src/allhands/engine.js');
    X.casting = await m('/src/allhands/casting.js');
    X.SHOTS = await (await fetch('/src/videostudio/media/shots.json')).json();
    // Treatments: 'track' (the default) is the track's own (treatments/index.js: Offsite gets
    // offsite-psych, every other track drop60-draft); 'draft' is drop60-draft; or a treatment id.
    X.T = await m('/src/videostudio/treatments/index.js');
    X.treatment = async (name, track) => name === 'studio' ? {id:'studio', fn:(await m('/src/videostudio/studio-film.js')).studioFilm} : X.T.treatmentNamed(name, track);
    // The song as the monitor plays it: the post's track and cast (auto; with a track, the post's cast on that
    // track, as /allhands/ renders it) or a track by hand, each on its own form (Offsite: the river), with the
    // voice bank's takes; Synergy's measured words, then the lady; the cold open (the Drop Edition only) unless
    // coldOpen is false.
    X.song = async ({track, voice = true, post, auto = false, coldOpen = true} = {}) => {
      const text = post ?? X.L.SAMPLE_POST, lyrics = X.L.lyricsFromPost(text), ctx = new OfflineAudioContext(1, 1, 44100);
      const casting = auto ? X.casting.castSong(text, {track, available:X.AVAILABLE}) : null, playTrack = casting ? casting.track : track;
      const form = X.FORMS[X.formOf(playTrack)] ?? X.FORMS.drop60;
      let buffers = new Map(), durations = {};
      if (voice) ({buffers, durations} = await X.voice.loadWords(ctx, form.voiced(lyrics, {track:playTrack})));
      const {plan} = X.casting.settleCast(form.arrange, lyrics, durations, {track:playTrack, cast:casting?.cast, coldOpen:coldOpen && form.id === 'drop60'});
      const lady = await X.lady.prepareLady(ctx, plan);
      return {plan, song:{buffers, lady}, voiced:buffers.size, casting:casting && {track:casting.track, line:casting.line, recast:casting.recast}};
    };
    // A recorded track (treatments/index.js RECORDED): its own plan, its sound decoded at its own rate
    // (no resampling), and the features measured from that sound.
    X.recorded = async track => {
      const R = X.T.RECORDED[track], plan = R.plan(), bytes = await (await fetch('/__videostudio-audio')).arrayBuffer();
      const buf = await new OfflineAudioContext(2, 1, R.sampleRate ?? 44100).decodeAudioData(bytes);
      const audio = {sampleRate:buf.sampleRate, channels:[buf.getChannelData(0), buf.getChannelData(Math.min(1, buf.numberOfChannels - 1))], offset:0};
      return {plan, audio, features:await X.recordingFeatures(plan, audio)};
    };
    // The WebGL renderer this page draws with (SwiftShader, or the machine's GPU).
    X.renderer = () => { const gl = document.createElement('canvas').getContext('webgl2'), d = gl?.getExtension('WEBGL_debug_renderer_info'); return gl ? String(gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'no WebGL2'; };
    // Bytes of the last export, in base64 slices, for the Node side.
    X.slice = (name, at, len) => { const b = X.out[name]; const u = b.subarray(at, at + len); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
  });
  return {page, errors};
}

// Pull a Uint8Array held in window.X.out[name] across to Node.
export async function pull(page, name) {
  const size = await page.evaluate(n => X.out[n].length, name), parts = [], step = 6 << 20;
  for (let at = 0; at < size; at += step) parts.push(Buffer.from(await page.evaluate(([n, a, l]) => X.slice(n, a, l), [name, at, step]), 'base64'));
  return Buffer.concat(parts);
}

// Run one export in the page. spec: {edl:'track'|'draft'|'offsite-psych'|'studio'|'metronome'|object, format, scale, span, master, audio:false, governor, track, post, auto, coldOpen, voice, every}
// A recorded track (spec.recorded): its own plan and features (X.recorded); the picture is exported
// without sound (the Node side muxes the recording's own file as AAC, muxRecording).
export async function runExport(page, spec, {onProgress} = {}) {
  if (onProgress) await page.exposeFunction('__exportProgress', onProgress).catch(() => {});
  return page.evaluate(async spec => {
    const rec = spec.recorded ? await X.recorded(spec.track) : null;
    const {plan, song, voiced, casting} = rec ? {plan:rec.plan, song:{}, voiced:0, casting:null} : await X.song({track:spec.track, voice:spec.voice !== false, post:spec.post, auto:!!spec.auto, coldOpen:spec.coldOpen !== false});
    const format = spec.format ?? '9:16';
    let edl, treatment = null;
    if (spec.edl === 'metronome') edl = X.metronomeEDL(plan, {format, every:spec.every ?? 4});
    else if (typeof spec.edl === 'object') edl = spec.edl;
    else { const t = await X.treatment(spec.edl ?? 'track', plan.track); treatment = t.id; edl = t.fn(plan, X.SHOTS, {format}); }
    let last = 0;
    const out = await X.exportFilm({edl, plan, shots:X.SHOTS, song, format, scale:spec.scale ?? 1, span:spec.span, master:!!spec.master,
      audio:spec.audio === false || rec ? null : 'render', ...(rec ? {features:rec.features} : {}), governor:spec.governor !== false, post:spec.post, force:!!spec.force,
      onProgress:p => { if (window.__exportProgress && (p.phase !== 'picture' || p.frame - last >= (spec.every_progress ?? 24) || p.frame === p.frames)) { last = p.frame; window.__exportProgress(p); } }});
    // The sidecar names the treatment that cut the film (null for a metronome or a given EDL).
    X.out = {mp4:out.mp4, ...(rec ? {} : {vtt:new TextEncoder().encode(out.vtt)}), json:new TextEncoder().encode(JSON.stringify({...out.sidecar, treatment}, null, 1))};
    return {sidecar:{...out.sidecar, treatment, edl:undefined}, voiced, casting, name:X.exportName(plan, format), expected:spec.edl === 'metronome' ? X.expectedCuts(plan, edl) : null, cuts:out.program.cuts,
      renderer:X.renderer(), recorded:!!rec, plan:{totalSteps:plan.totalSteps, duration:plan.duration}};
  }, spec);
}

export async function saveExport(page, dir, name) {
  fs.mkdirSync(dir, {recursive:true});
  const files = {};
  for (const [k, ext] of [['mp4', 'mp4'], ['vtt', 'vtt'], ['json', 'json']]) {
    if (!(await page.evaluate(k => !!X.out[k], k))) continue;
    const file = path.join(dir, `${name}.${ext}`);
    fs.writeFileSync(file, await pull(page, k));
    files[ext] = file;
  }
  return files;
}

// A recorded track's sound under its exported picture: ffmpeg cuts the file to the film's span (in samples,
// film time 0 at sample 0), encodes AAC-LC at 48 kHz stereo and muxes it with the picture, which it copies
// untouched; moov first (faststart). The picture keeps its timestamps, so A/V lines up to the sample
// (ffmpeg writes the AAC encoder delay into the edit list). Returns what it did, for the sidecar.
export function muxRecording({picture, audio, out, span, fps = 24, bitrate = '320k'}) {
  const {execFileSync} = require('node:child_process');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'json', audio], {encoding:'utf8'})).streams[0];
  const sr = +probe.sample_rate, a = Math.round(span[0] / fps * sr), b = Math.round(span[1] / fps * sr);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', picture, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
    '-af', `atrim=start_sample=${a}:end_sample=${b},asetpts=PTS-STARTPTS`, '-c:a', 'aac', '-b:a', bitrate, '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-map_metadata', '-1', out], {stdio:'inherit'});
  return {codec:'aac', container:'mp4a.40.2', sampleRate:48000, channels:2, bitrate, source:path.relative(ROOT, audio) || audio, sourceRate:sr, samples:[a, b], muxer:'ffmpeg'};
}

// ---- the command line ------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(arg('out', '.')), format = arg('format', '9:16'), scale = +arg('scale', '1');
  const span = arg('span') ? arg('span').split('-').map(Number) : undefined;
  const edlArg = arg('edl', 'track'), track = arg('track');
  const edl = /\.json$/.test(edlArg) ? JSON.parse(fs.readFileSync(edlArg, 'utf8')) : edlArg;
  // A recorded track brings its own sound file (the repo's, or --audio).
  const {RECORDED} = await import('../src/videostudio/treatments/index.js');
  const rec = track && RECORDED[track] ? RECORDED[track] : null;
  const audioFile = rec ? path.resolve(arg('audio', path.join(ROOT, rec.audio))) : null;
  if (rec && !fs.existsSync(audioFile)) throw Error(`${track}: its sound is missing (${audioFile}).`);
  if (rec) try { require('node:child_process').execFileSync('ffmpeg', ['-version'], {stdio:'ignore'}); } catch { throw Error('A recorded track is muxed with ffmpeg: install it (macOS: brew install ffmpeg) and run again.'); }
  const srv = await studioServer({url:arg('url'), port:arg('port', '0')});
  const browser = await launch({gpu:flag('gpu') || flag('headed'), headless:!flag('headed')});
  const t0 = Date.now();
  try {
    const {page, errors} = await exportPage(browser, srv.origin, {log:s => console.error(s), audio:rec ? fs.readFileSync(audioFile) : null});
    console.log(`renderer  ${await page.evaluate(() => X.renderer())}`);
    const post = arg('post') ? fs.readFileSync(arg('post'), 'utf8') : undefined;
    const res = await runExport(page, {edl, format, scale, span, master:flag('master'), audio:flag('no-audio') ? false : undefined, governor:!flag('no-governor'), track, recorded:!!rec, post, auto:flag('auto'), coldOpen:!flag('no-cold-open'), every_progress:+arg('progress', '48')}, {
      onProgress:p => console.log(`${p.phase.padEnd(9)} ${String(p.frame).padStart(5)}/${p.frames} ${(100 * p.fraction).toFixed(1).padStart(5)}%  ${p.msPerFrame ? `${p.msPerFrame.toFixed(0)} ms/frame, ${Math.round(p.eta)} s left` : ''}  ${p.elapsed.toFixed(1)} s`),
    });
    const name = arg('name', res.name.replace(/\.mp4$/, ''));
    const s = res.sidecar;
    let files;
    if (rec && !flag('no-audio')) {
      // The picture, then the recording under it: one finished MP4.
      const picture = path.join(out, `${name}.picture.mp4`);
      files = await saveExport(page, out, `${name}.picture`);
      const final = path.join(out, `${name}.mp4`);
      s.audio = muxRecording({picture, audio:audioFile, out:final, span:s.film.span, bitrate:arg('aac', '320k')});
      const json = JSON.parse(fs.readFileSync(files.json, 'utf8')), sha = f => require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      // (hashes.mp4: the finished file; hashes.picture: the silent picture it was muxed from.)
      s.hashes = {...json.hashes, picture:json.hashes.mp4, mp4:sha(final)};
      fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({...json, audio:s.audio, hashes:s.hashes}, null, 1));
      fs.rmSync(files.json);
      if (!flag('keep-picture')) fs.rmSync(picture);
      files = {mp4:final, json:path.join(out, `${name}.json`), ...(flag('keep-picture') ? {picture} : {})};
    } else files = await saveExport(page, out, name);
    console.log(JSON.stringify({files, casting:res.casting, renderer:res.renderer, film:s.film, video:s.video, audio:s.audio && {...s.audio}, hashes:s.hashes, lint:s.lint, msPerFrame:s.stats.msPerFrame, split:s.stats.split, seconds:s.stats.seconds, frames:s.stats.frames, decoder:s.stats.decoder, voiced:res.voiced, errors:errors.length, wall:(Date.now() - t0) / 1000}, null, 1));
  } finally {
    await browser.close();
    await srv.close();
  }
}
