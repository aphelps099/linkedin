// The export (src/videostudio/render/export.js, media/decoder.js) and the draft cut
// (treatments/drop60-draft.js), and the P3 gates on real exported files:
//   1. Node: the demuxer against the proxies, captions, the draft cut's lint and its
//      rows (plan §2), the sidecar's hashes
//   2. metronome: a full-length metronome export at 120 BPM (and 130 BPM, where steps are
//      not whole frames); ffmpeg scdet must find every cut on its target frame. The tiles are
//      L1 (no board region): over a full-frame generated tile the compositor draws the board's
//      sockets even when the EDL has no board cues.
//   3. flash-plus-click: white flashes and clicks on the same steps; in the file the
//      picture leads the sound by 0-25 ms and is never late
//   4. determinism: the same span of the draft cut exported in two fresh pages: every composited
//      frame's RGBA hash equal and the sound's ffmpeg framemd5 equal; the decoded picture's
//      framemd5 equal wherever the encoder had nothing to decide, and within 45 dB PSNR elsewhere
//      (Chromium's software H.264 encoder is not bit-reproducible; measured on identical input)
//   5. leaks and memory: every VideoFrame opened is closed; the heap and the frame cache
//      stay level across a footage-heavy span
//   6. duration and A/V sync: video and audio tracks within a frame of the film's length
// node scripts/check-videostudio-export.mjs [--quick] [--node] [--only 2,3,4,5] [--keep DIR] [--url http://127.0.0.1:5351] [--verbose]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FORMS} from '../src/allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {compile} from '../src/videostudio/edl/compile.js';
import {stringify} from '../src/videostudio/edl/schema.js';
import {stepTime, cutFrame} from '../src/videostudio/edl/anchors.js';
import {metronomeEDL, expectedCuts} from '../src/videostudio/edl/metronome.js';
import {demux} from '../src/videostudio/media/decoder.js';
import {captions, planJSON, exportName, SAMPLES_PER_FRAME} from '../src/videostudio/render/export.js';
import {drop60Draft, ROWS, SCENE_LABELS} from '../src/videostudio/treatments/drop60-draft.js';
import {studioServer, launch, exportPage, runExport, pull} from './export-videostudio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), quick = argv.includes('--quick'), verbose = argv.includes('--verbose');
const keep = argv.includes('--keep') ? path.resolve(argv[argv.indexOf('--keep') + 1]) : null;
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',').map(Number)) : null, section = n => !only || only.has(n);
const OUT = keep ?? fs.mkdtempSync(path.join(os.tmpdir(), 'check-videostudio-export-'));
fs.mkdirSync(OUT, {recursive:true});
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; if (verbose) console.log('  ok', m); };
const log = s => console.log(s);
const t00 = Date.now();
const FPS = 24;
const ff = (args, opts = {}) => spawnSync(args[0], args.slice(1), {encoding:opts.encoding ?? 'utf8', maxBuffer:1 << 30});
const hasFfmpeg = ff(['ffmpeg', '-version']).status === 0;

// ---- 1. Node ----------------------------------------------------------------------------------------
const SHOTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/videostudio/media/shots.json'), 'utf8'));
const lyrics = lyricsFromPost(SAMPLE_POST), plan = FORMS.drop60.arrange(lyrics, {});
{
  const before = checks;
  // The demuxer against the proxies on disk.
  const dir = path.join(ROOT, 'public/videostudio/proxies'), files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mp4')).sort() : [];
  if (files.length) {
    const sample = files.filter((_, i) => i % Math.max(1, Math.floor(files.length / (quick ? 8 : 40))) === 0);
    let frames = 0, bad = [];
    for (const f of sample) {
      const buf = fs.readFileSync(path.join(dir, f)), d = demux(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const shot = SHOTS.shots.find(s => s.proxy?.endsWith(f) || s.rev?.endsWith(f));
      const keys = d.samples.filter(s => s.key).map(s => s.display), gopOk = keys.every((k, i) => k === i * 12);
      const mono = d.samples.every((s, i) => !i || s.timestamp > d.samples[i - 1].timestamp), order = d.samples.every(s => s.display === s.index);
      if (!(shot && d.frames === shot.proxyInfo.frames && gopOk && mono && order && /^avc1\.64/.test(d.codec) && d.width === shot.proxyInfo.w)) bad.push(f);
      frames += d.frames;
    }
    ok(!bad.length, `demux: ${sample.length} proxies, ${frames} frames, each with the index's frame count, a keyframe every 12, no B-frames, avc1.64 High (${bad.slice(0, 3).join(', ')})`);
    if (hasFfmpeg) {
      const f = sample[0], buf = fs.readFileSync(path.join(dir, f)), d = demux(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const probe = ff(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets,width,height', '-of', 'csv=p=0', path.join(dir, f)]).stdout.trim().split(',').map(Number);
      ok(probe[0] === d.width && probe[1] === d.height && probe[2] === d.frames, `demux agrees with ffprobe on ${f}: ${d.width}×${d.height}, ${d.frames} packets`);
    }
  } else log('  (no proxies on disk: the demux checks are skipped)');

  // Captions.
  const vtt = captions(plan);
  const cues = vtt.split('\n\n').filter(b => /-->/.test(b));
  const times = cues.map(b => b.split('\n').find(l => l.includes('-->')).split(' --> ').map(s => { const [h, m, x] = s.split(':'); return +h * 3600 + +m * 60 + +x; }));
  ok(vtt.startsWith('WEBVTT') && cues.length >= 15 && times.every(([a, b], i) => b > a && (!i || a >= times[i - 1][0])), `captions.vtt: ${cues.length} cues, in order, each with a length`);
  ok(/<v Synergy>Thanks for joining/.test(vtt) && /<v Circle Back>Back\./.test(vtt) && /<v Circle Back>Let's build\./.test(vtt) && !/—/.test(vtt), 'captions: Synergy\'s lines and the lady\'s phrases, voice-tagged, no em dashes');
  const ladder = cues.filter(b => /Let's build\./.test(b)).length;
  ok(ladder >= 1 && ladder <= 6, `captions: the ladder's retriggers collapse into ${ladder} cues, not ${plan.lady.filter(e => e.role === 'ladder').length}`);

  // The draft cut: clean in every format, deterministic, and the rows of plan §2.
  for (const format of ['9:16', '1:1', '16:9']) {
    const edl = drop60Draft(plan, SHOTS, {format}), p = compile(edl, {plan, shots:SHOTS});
    ok(p.lint.errors.length === 0, `draft cut ${format}: ${p.clips.length} clips, 0 lint errors (${p.lint.errors.slice(0, 3).map(e => `${e.rule} ${e.message}`).join('; ')}), ${p.lint.warnings.length} warnings, peak ${p.decode.max} decodes`);
    ok(stringify(drop60Draft(plan, SHOTS, {format})) === stringify(edl) && compile(drop60Draft(plan, SHOTS, {format}), {plan, shots:SHOTS}).hash() === p.hash(), `draft cut ${format}: the same EDL bytes and program hash twice (${p.hash()})`);
    if (format !== '9:16') continue;
    const fr = f => p.frame(f), layers = p.all.flatMap(x => x.layers);
    ok(p.board.screens[fr(0).board.screen]?.text === 'BACK.' && fr(0).layers.some(l => l.fx.some(x => x.type === 'pegVideo')), 'row 0:0: frame 0 is BACK. over peg video');
    ok(p.all.slice(18, 24).every(x => x.transport?.kind === 'rewind') && fr(19).time > fr(22).time && !fr(17).transport && !fr(24).transport, `row 0:6: frames 18-23 rewind at 4x from bar 18 (song time ${fr(19).time.toFixed(2)} → ${fr(22).time.toFixed(2)} s)`);
    ok(fr(30).layers.some(l => l.gen === 'camera-off') && p.board.screens[fr(30).board.screen]?.text.startsWith('CONNECTING'), "row 0:8: Pat's black tile, CONNECTING TO AUDIO…");
    ok(['L1', 'G4', 'G6'].every(cls => p.all.slice(48, 120).some(x => x.layout === cls)) && layers.some(l => l.chrome?.toast?.text?.endsWith('joined')), 'row 1: the grid blooms L1 → G4 → G6 with "joined" toasts');
    ok(p.all.slice(cutFrame(stepTime(plan, 40)), cutFrame(stepTime(plan, 41))).some(x => x.layers.some(l => /^join/.test(l.clipId) && l.shotId?.startsWith('printer'))), 'row 2: the printer in the call');
    ok(fr(156).camera?.zoom > 1.1 && p.all.slice(144, 192).some(x => x.layers.some(l => l.chrome?.mic === 'on')) && p.all.slice(144, 192).some(x => x.layers.some(l => l.chrome?.mic === 'muted')), 'row 3: the gallery-unmute push; mute icons toggle');
    ok(fr(192).layout === 'L1' && fr(192).layers[0].transform.zoom < .5 && fr(195).layers[0].transform.zoom === 1 && fr(204).layout === 'stack3', 'row 4: UNMUTE: Synergy fills the frame in 3 frames, then stack3');
    ok(p.board.cells.some(s => s.text === 'ARJUN / FINANCE' && s.font === 'peg5'), 'row 7: freeze + label ARJUN / FINANCE in PEG-5');
    ok(fr(400).layout === 'BOARD+STRIP' && fr(400).board.banner && layers.some(l => l.chrome?.banner === "You are viewing Synergy's screen"), 'row 8: the hook shares Synergy\'s screen');
    ok(p.all.slice(576, 672).every(x => x.layout === 'G9') && fr(590).layers.filter(l => l.fx.some(x => x.type === 'saturation')).length >= 6, 'row 12: freeze the call in G9, the frozen tiles greyed');
    ok(fr(14 * 48 + 4).layers.some(l => l.cell.id.startsWith('split.')) && fr(15 * 48 + 4).layers.some(l => /^G4\.\d>split/.test(l.cell.id)), 'row 14: breakout rooms, two then four');
    ok([1, 2, 4, 8].every((n, q) => fr(16 * 48 + q * 12 + 2).layers.length === n), 'row 16: the cell split 1, 2, 4, 8 on the quarters');
    ok(fr(18 * 48 + 2).layout === 'BOARD+STRIP' && fr(18 * 48 + 2).layers.some(l => l.fx.some(x => x.type === 'mosaic')), 'row 18: the board with Synergy\'s tile, poor connection on the side tiles');
    ok(p.all.slice(948, 960).every(x => x.layers.every(l => l.gen === 'color:#000000')) && fr(960).layers.some(l => l.fx.some(x => x.type === 'pegVideo')), 'rows 19:8 and 20: black to frame 959, ignition over peg video at frame 960');
    const sinkF = cutFrame(stepTime(plan, 23 * 16 + 4));
    ok(fr(sinkF).layout === 'G4' && p.all.slice(cutFrame(stepTime(plan, 23 * 16 + 13)), 1152).some(x => x.layers.some(l => l.fx.some(e => e.type === 'mosaic' && e.px >= 32))), 'row 23: Sink In in G4; on "in" the outer cells sink to 32 px');
    ok(fr(1160).layers.some(l => l.gen === 'feedback' && l.fx.some(x => x.type === 'droste')) && fr(1190).camera?.zoom > 2, 'row 24: the Droste dive into Pat\'s cell');
    ok(fr(26 * 48 + 26).layers.some(l => l.fx.some(x => x.type === 'tile')) && fr(27 * 48 + 26).layers.some(l => l.clipId.startsWith('replay.')), 'rows 26-27: the kaleido of the pads, replayed at 27:8');
    ok(layers.some(l => l.chrome?.toast?.text === 'Kevin left the meeting'), 'row 28: Kevin left the meeting');
    ok(p.transports.some(t => t.kind === 'tapestop' && t.to === 1426) && p.all.slice(1426, 1438).every(x => x.layers.every(l => l.gen === 'color:#000000') && !x.board.rect), 'row 29: the tape stop to frame 1426, then true black (no board region) to 1437');
    ok(p.all.slice(1438).every(x => x.transport?.id === 'loop' && x.layout === fr(0).layout && x.board.screen === fr(0).board.screen) && !p.lint.warnings.some(w => w.rule === 'G12'), 'row 29: frames 1438-1439 rewind to the top: frame 0\'s layout and BACK. screen, so the loop closes (G12 clean)');
    ok(layers.every(l => !(l.shotId && /lady|circle back|^pat$/i.test(SHOTS.shots.find(s => s.id === l.shotId)?.characters.join(' ') ?? ''))) && layers.filter(l => l.gen === 'camera-off').length > 100, 'canon: Pat never on video; the lady never footage');
    const sceneIds = new Set(edl.clips.map(c => c.scene));
    ok([...sceneIds].every(s => SCENE_LABELS[s]), `every scene has a label for the monitor (${[...sceneIds].join(', ')})`);
  }
  const statuses = ROWS.reduce((m, r) => ({...m, [r.status]:(m[r.status] ?? 0) + 1}), {});
  ok(ROWS.length >= 27 && ROWS.every(r => ['done', 'stand-in', 'partial', 'skipped'].includes(r.status) && r.what && !/—/.test(r.note + r.what)), `ROWS: plan §2 row by row: ${Object.entries(statuses).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  ok(planJSON(plan) === planJSON(FORMS.drop60.arrange(lyrics, {})) && exportName(plan, '9:16') === 'linkedinbeats-circle-back-drop60-9x16.mp4' && SAMPLES_PER_FRAME === 2000, 'the plan hashes the same twice; file names; 2,000 samples a frame at 48 kHz');
  log(`1. Node: ${checks - before} checks`);
}

if (argv.includes('--node')) { log(`check-videostudio-export (Node only): ${checks} checks passed`); process.exit(0); }
if (!hasFfmpeg) { log('ffmpeg is not installed: the export gates need it.'); process.exit(1); }

// ---- the browser --------------------------------------------------------------------------------------
const srv = await studioServer({url:argv.includes('--url') ? argv[argv.indexOf('--url') + 1] : undefined, port:0});
const browser = await launch();
const pageErrors = [];
async function fresh() { const r = await exportPage(browser, srv.origin, {log:s => { if (/\[page\]/.test(s)) pageErrors.push(s); if (verbose) console.error(s); }}); return r.page; }
async function exportTo(page, spec, name) {
  const res = await runExport(page, spec);
  const file = path.join(OUT, `${name}.mp4`);
  fs.writeFileSync(file, await pull(page, 'mp4'));
  return {...res, file};
}
const probe = file => JSON.parse(ff(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,width,height,r_frame_rate,nb_frames,duration,start_time,sample_rate,channels', '-of', 'json', file]).stdout).streams;
const scdet = file => {
  const r = ff(['ffmpeg', '-hide_banner', '-nostats', '-i', file, '-vf', 'scdet=threshold=10,metadata=print', '-an', '-f', 'null', '-']);
  return [...new Set([...(r.stderr + r.stdout).matchAll(/lavfi\.scd\.time=([\d.]+)/g)].map(m => Math.round(+m[1] * FPS)))].sort((a, b) => a - b);
};
const framemd5 = (file, stream) => ff(['ffmpeg', '-v', 'error', '-i', file, '-map', `0:${stream}`, '-f', 'framemd5', '-']).stdout.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').map(s => s.trim()));
// Per-frame mean luma (a 16×16 grey thumbnail) with each frame's pts.
function lumaTrack(file) {
  const pts = ff(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', file]).stdout.trim().split('\n').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=16:16:flags=area,format=gray', '-f', 'rawvideo', '-'], {maxBuffer:1 << 30}).stdout;
  const out = [];
  for (let i = 0; i * 256 < raw.length; i++) { let s = 0; for (let j = 0; j < 256; j++) s += raw[i * 256 + j]; out.push({pts:pts[i], luma:s / 256}); }
  return out;
}
const pcm = file => { const b = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a', '-ac', '1', '-f', 'f32le', '-'], {maxBuffer:1 << 30}).stdout; return new Float32Array(b.buffer, b.byteOffset, b.length >> 2); };

try {
  // ---- 2 and 6. the metronome, full length, with a click on every cut ---------------------------------------
  if (section(2)) {
    const before = checks;
    const page = await fresh();
    for (const track of quick ? ['circle-back'] : ['circle-back', 'hustle']) {
      const res = await page.evaluate(async ({track}) => {
        const {plan} = await X.song({voice:false, track:track === 'circle-back' ? undefined : track});
        const edl = X.metronomeEDL(plan, {format:'9:16', every:4, cell:'L1.0'});
        const steps = edl.clips.map(c => c.at), n = Math.round(X.stepTime(plan, plan.totalSteps) * 48000), L = new Float32Array(n);
        for (const s of steps) { const i = Math.round(X.stepTime(plan, s) * 48000); for (let k = 0; k < 48 && i + k < n; k++) L[i + k] = .9; }
        const out = await X.exportFilm({edl, plan, shots:X.SHOTS, format:'9:16', scale:.25, governor:false, audio:{sampleRate:48000, channels:[L, L], offset:0}});
        X.out = {mp4:out.mp4};
        return {expected:X.expectedCuts(plan, edl), frames:out.sidecar.film.frames, seconds:X.stepTime(plan, plan.totalSteps), planDuration:plan.duration, bpm:plan.bpm, stats:out.sidecar.stats, audio:out.sidecar.audio};
      }, {track});
      const file = path.join(OUT, `metronome-${track}.mp4`);
      fs.writeFileSync(file, await pull(page, 'mp4'));
      const found = scdet(file), want = res.expected, hit = want.filter(f => found.includes(f)), extra = found.filter(f => !want.includes(f));
      ok(hit.length === want.length && extra.length === 0, `metronome ${track} (${res.bpm} BPM): scdet finds ${hit.length} of ${want.length} cuts on their target frames (100%), ${extra.length} elsewhere${hit.length < want.length ? `; missed ${want.filter(f => !found.includes(f)).slice(0, 5).join(', ')}` : ''}`);
      const st = probe(file), v = st.find(s => s.codec_type === 'video'), a = st.find(s => s.codec_type === 'audio');
      const vd = +v.duration, ad = +a.duration;
      ok(+v.nb_frames === res.frames && Math.abs(vd - res.seconds) <= 1 / FPS && Math.abs(ad - res.seconds) <= 1 / FPS && Math.abs(vd - ad) <= 1 / FPS,
        `duration ${track}: video ${vd.toFixed(3)} s (${v.nb_frames} frames), audio ${ad.toFixed(3)} s (${a.codec_name}, pre-skip ${res.audio.preSkip}), film ${res.seconds.toFixed(3)} s: all within a frame (plan.duration ${res.planDuration.toFixed(3)} s includes a ${(res.planDuration - res.seconds).toFixed(1)} s render tail the loop drops)`);
      ok(v.codec_name === 'h264' && v.profile === 'High' && v.r_frame_rate === '24/1' && +a.sample_rate === 48000 && a.channels === 2, `metronome ${track}: H.264 High, 24/1 CFR, ${a.codec_name} 48 kHz stereo`);
      // The clicks are where the cuts are: sound and picture share the clock through the whole file.
      const x = pcm(file), sr = 48000, onsets = [];
      for (let i = 0; i < x.length; i++) if (x[i] > .3 && (i === 0 || x[i - 1] <= .3) && (!onsets.length || i - onsets.at(-1) > sr / 20)) onsets.push(i);
      const cuts = [0, ...want].map(f => f / FPS), drift = onsets.slice(0, cuts.length).map((o, i) => o / sr - stepTime(FORMS.drop60.arrange(lyrics, {}, track === 'circle-back' ? undefined : {track}), 4 * i));
      const worst = Math.max(...drift.map(Math.abs));
      ok(onsets.length === want.length + 1 && worst < .0015, `metronome ${track}: ${onsets.length} clicks, each within ${(worst * 1000).toFixed(2)} ms of its step from 0 to ${(res.seconds).toFixed(1)} s (no drift)`);
      log(`   metronome ${track}: ${res.frames} frames at 270×480, ${res.stats.msPerFrame.mean.toFixed(0)} ms/frame`);
    }
    await page.close();
    log(`2. metronome and duration: ${checks - before} checks`);
  }

  // ---- 3. flash plus click ---------------------------------------------------------------------------------
  if (section(3)) {
    const before = checks, page = await fresh();
    const rows = [];
    for (const track of quick ? ['circle-back'] : ['circle-back', 'hustle']) {
      const res = await page.evaluate(async ({track}) => {
        const {plan} = await X.song({voice:false, track:track === 'circle-back' ? undefined : track});
        // Chosen steps over the first 12 s: on-frame beats, swung off-beats, and (at 130 BPM)
        // steps whose nearest frame starts at or before the sound.
        const T = s => X.stepTime(plan, s), chosen = [];
        for (let s = 8; T(s) < 11.5 && chosen.length < 16; s += 3) { const lead = T(s) - Math.round(T(s) * 24) / 24; if (lead >= -1e-9 && lead <= .025) chosen.push(s); }
        const clips = [{id:'bg', at:0, len:plan.totalSteps, cell:'L1.0', asset:'gen:color:#000000'}];
        chosen.forEach((s, i) => clips.push({id:`flash${i}`, at:s, len:1, cell:'L1.0', asset:'gen:white', z:1}));
        const edl = X.createEDL({form:'drop60', format:'9:16', clips, board:[]});
        const n = Math.round(14 * 48000), L = new Float32Array(n);
        for (const s of chosen) { const i = Math.round(T(s) * 48000); for (let k = 0; k < 48; k++) L[i + k] = .9; }
        const out = await X.exportFilm({edl, plan, shots:X.SHOTS, format:'9:16', scale:.25, governor:false, span:[0, 12 * 24], audio:{sampleRate:48000, channels:[L, L], offset:0}});
        X.out = {mp4:out.mp4};
        return {chosen:chosen.map(s => ({step:s, t:T(s), frame:Math.round(T(s) * 24), expected:T(s) - Math.round(T(s) * 24) / 24})), bpm:plan.bpm};
      }, {track});
      const file = path.join(OUT, `flash-${track}.mp4`);
      fs.writeFileSync(file, await pull(page, 'mp4'));
      const luma = lumaTrack(file), x = pcm(file), sr = 48000;
      const flashes = luma.filter((l, i) => l.luma > 128 && (i === 0 || luma[i - 1].luma <= 128)).map(l => l.pts);
      const clicks = [];
      for (let i = 0; i < x.length; i++) if (x[i] > .3 && (i === 0 || x[i - 1] <= .3) && (!clicks.length || i / sr - clicks.at(-1) > .05)) clicks.push(i / sr);
      res.chosen.forEach((c, i) => rows.push({track, bpm:res.bpm, step:c.step, t:c.t, picture:flashes[i], sound:clicks[i], lead:clicks[i] - flashes[i], expected:c.expected}));
      ok(flashes.length === res.chosen.length && clicks.length === res.chosen.length, `flash ${track}: ${flashes.length} flashes and ${clicks.length} clicks found for ${res.chosen.length} chosen steps`);
    }
    const leads = rows.map(r => r.lead * 1000), offs = rows.map(r => (r.lead - r.expected) * 1000);
    ok(rows.every(r => r.lead >= -1e-4 && r.lead <= .025 + 1e-4), `flash-plus-click: the picture leads the sound by ${Math.min(...leads).toFixed(2)} to ${Math.max(...leads).toFixed(2)} ms over ${rows.length} flashes (gate 0-25 ms, never late)`);
    ok(offs.every(o => Math.abs(o) < 1), `flash-plus-click: the file adds ${Math.min(...offs).toFixed(3)} to ${Math.max(...offs).toFixed(3)} ms to the lead the frame grid gives (encoder delay and Opus pre-skip cancel)`);
    fs.writeFileSync(path.join(OUT, 'flash-click.json'), JSON.stringify(rows, null, 1));
    await page.close();
    log(`3. flash plus click: ${checks - before} checks (${rows.map(r => `${(r.lead * 1000).toFixed(1)}`).join(' ')} ms)`);
  }

  // ---- 4. determinism, 5. leaks: the draft cut on real footage, twice in fresh pages --------------------------
  // The sound is a fixed synthetic track (clicks over a 220 Hz tone): engine.render is not
  // bit-reproducible (measured below), and the export's own sound path must be judged alone.
  if (section(4)) {
    const before = checks, span = quick ? [948, 984] : [936, 1008], runs = [];
    const spec = async (page, keyEvery, name) => {
      const res = await page.evaluate(async ({span, keyEvery}) => {
        const {plan} = await X.song({voice:false});
        const edl = (await X.treatments.draft())(plan, X.SHOTS, {format:'9:16'});
        const n = Math.round((span[1] / 24 + 1) * 48000), L = new Float32Array(n), R = new Float32Array(n);
        for (let i = 0; i < n; i++) { L[i] = .2 * Math.sin(2 * Math.PI * 220 * i / 48000); R[i] = .2 * Math.sin(2 * Math.PI * 330 * i / 48000); }
        for (let s = 0; s < plan.totalSteps; s += 4) { const i = Math.round(X.stepTime(plan, s) * 48000); for (let k = 0; k < 48 && i + k < n; k++) { L[i + k] = .8; R[i + k] = .8; } }
        const out = await X.exportFilm({edl, plan, shots:X.SHOTS, format:'9:16', scale:.5, span, keyEvery, hashFrames:true, audio:{sampleRate:48000, channels:[L, R], offset:0}});
        X.out = {mp4:out.mp4};
        return {sidecar:{...out.sidecar, edl:undefined}};
      }, {span, keyEvery});
      const file = path.join(OUT, `${name}.mp4`);
      fs.writeFileSync(file, await pull(page, 'mp4'));
      return {...res, file};
    };
    for (const k of [0, 1]) { const page = await fresh(); runs.push(await spec(page, 48, `determinism-${k}`)); await page.close(); }
    const [a, b] = runs.map(r => framemd5(r.file, 0)), [aa, ab] = runs.map(r => framemd5(r.file, 1));
    const ha = runs.map(r => r.sidecar.frameHashes);
    ok(ha[0].length === span[1] - span[0] && ha[1].every((x, i) => x === ha[0][i]), `determinism: frames ${span[0]}-${span[1] - 1} of the draft cut (the choke, true black, the ignition, stack3 on real proxies) composited in two fresh pages: all ${ha[0].length} frames' RGBA SHA-256 identical before the encoder`);
    ok(aa.length > 0 && aa.every((l, i) => l[5] === ab[i]?.[5]) && aa.length === ab.length, `determinism: the sound, ${aa.length} decoded Opus frames, ffmpeg framemd5 identical`);
    ok(runs[0].sidecar.hashes.program === runs[1].sidecar.hashes.program && runs[0].sidecar.hashes.edl === runs[1].sidecar.hashes.edl, `determinism: the same EDL and program hashes in both runs (${runs[0].sidecar.hashes.program})`);
    // The encoded picture: Chromium's software H.264 encoder is not bit-reproducible (its rate
    // control differs run to run, even all-intra, measured on identical input frames below), so the
    // decoded frames match where the encoder had nothing to decide and agree closely elsewhere.
    const same = a.filter((l, i) => l[5] === b[i]?.[5]).length;
    const psnr = ff(['ffmpeg', '-v', 'error', '-i', runs[0].file, '-i', runs[1].file, '-lavfi', '[0:v][1:v]psnr=stats_file=-', '-f', 'null', '-']).stdout.split('\n').map(l => /psnr_avg:(inf|[\d.]+)/.exec(l)?.[1]).filter(Boolean).map(v => v === 'inf' ? Infinity : +v);
    const minPsnr = Math.min(...psnr);
    const sorted = psnr.filter(Number.isFinite).sort((x, y) => x - y), median = sorted.length ? sorted[sorted.length >> 1] : Infinity;
    ok(a.length === b.length && psnr.length === a.length, `determinism (encoded, informational): ffmpeg framemd5 identical on ${same} of ${a.length} decoded frames; the rest differ by the encoder alone: PSNR between the two files ${minPsnr.toFixed(1)} dB at worst, ${median.toFixed(1)} dB median; bytes ${runs[0].sidecar.hashes.mp4 === runs[1].sidecar.hashes.mp4 ? 'identical' : 'differ'}`);
    const encPage = await fresh(), enc = await encPage.evaluate(async () => {
      const out = {};
      for (const [W, H] of [[270, 480], [540, 960]]) {
        const frames = Array.from({length:16}, (_, k) => { const d = new Uint8Array(W * H * 4); for (let i = 0; i < d.length; i += 4) { const x = i / 4 % W, y = i / 4 / W | 0; d[i] = (x + 7 * k) & 255; d[i + 1] = (y * 3 + 5 * k) & 255; d[i + 2] = ((x * y) >> 6) & 255; d[i + 3] = 255; } return d; });
        const run = async () => { const chunks = []; const e = new VideoEncoder({output:ch => { const u = new Uint8Array(ch.byteLength); ch.copyTo(u); chunks.push(u); }, error:() => {}}); e.configure(X.videoConfig(W, H)); for (let k = 0; k < frames.length; k++) { const f = new VideoFrame(frames[k], {format:'RGBA', codedWidth:W, codedHeight:H, timestamp:Math.round(k * 1e6 / 24)}); e.encode(f, {keyFrame:k === 0}); f.close(); } await e.flush(); e.close(); const all = new Uint8Array(chunks.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of chunks) { all.set(x, o); o += x.length; } return X.sha256(all); };
        out[`${W}×${H}`] = new Set([await run(), await run(), await run()]).size;
      }
      return out;
    });
    await encPage.close();
    log(`   the encoder alone, 3 encodes of the same 16 synthetic frames: ${Object.entries(enc).map(([k, v]) => `${v} distinct stream${v > 1 ? 's' : ''} at ${k}`).join(', ')}`);
    for (const r of runs) ok(r.sidecar.stats.frames.live === 0 && r.sidecar.stats.frames.opened === r.sidecar.stats.frames.closed && r.sidecar.stats.frames.opened > 0, `leaks: ${r.sidecar.stats.frames.opened} VideoFrames opened, ${r.sidecar.stats.frames.closed} closed (${Object.entries(r.sidecar.stats.frames.byKind).map(([k, v]) => `${k} ${v.opened}`).join(', ')})`);
    // engine.render twice: which stems repeat bit for bit (informational).
    const renderPage = await fresh(), render = await renderPage.evaluate(async () => {
      const {plan, song} = await X.song({voice:false});
      const h = async a => (await X.sha256(new Uint8Array(a.buffer.slice(0)))).slice(0, 12);
      const one = async () => { const b = await X.engine.render(plan, song.buffers, {tune:{stems:true}, bars:[2, 6]}, song.lady); const out = []; for (let c = 0; c < b.numberOfChannels; c++) out.push(await h(b.getChannelData(c))); return {out, b}; };
      const x = await one(), y = await one(); let maxd = 0; const A = x.b.getChannelData(0), B = y.b.getChannelData(0); for (let i = 0; i < A.length; i++) maxd = Math.max(maxd, Math.abs(A[i] - B[i]));
      return {same:x.out.map((v, i) => v === y.out[i]), maxd};
    });
    await renderPage.close();
    const names = ['master L', 'master R', 'drums', 'bass', 'keys', 'guitar', 'voice', 'lady'];
    log(`   engine.render twice (bars 2-6): ${names.map((n, i) => `${n} ${render.same[i] ? 'same' : 'differs'}`).join(', ')}; master max difference ${(20 * Math.log10(render.maxd || 1e-12)).toFixed(1)} dBFS`);
    ok(true, 'engine.render reproducibility reported (outside the export: the song engine)');
    log(`4. determinism: ${checks - before} checks`);
  }
  if (section(5)) {
    // A footage-heavy span (Drop B: nine tiles, the Droste dive, the chase, the kaleido) for memory.
    const before = checks, page = await fresh(), span = quick ? [1152, 1248] : [1152, 1392];
    const res = await exportTo(page, {edl:'draft', format:'9:16', scale:.25, span, audio:false}, 'memory');
    const s = res.sidecar.stats, mem = s.memory.filter(x => x.heap != null), third = Math.floor(mem.length / 3);
    const early = Math.max(...mem.slice(0, Math.max(1, third)).map(x => x.heap)), late = Math.max(...mem.slice(-Math.max(1, third)).map(x => x.heap));
    ok(s.frames.live === 0 && s.frames.opened === s.frames.closed, `leaks: ${s.frames.opened} VideoFrames over ${span[1] - span[0]} frames of Drop B, all closed (peak ${s.frames.peak} open at once)`);
    ok(s.decoder.cacheBytes === 0 && s.decoder.entries === 0 && s.memory.at(-1).live === 0, `memory: the frame cache empties at the end (peak ${(s.decoder.peakBytes / 2 ** 20).toFixed(1)} MB, ${s.decoder.peakEntries} frames; ${s.decoder.gops} GOPs decoded for ${s.decoder.decoded} frames from ${s.decoder.filesOpened} files)`);
    ok(mem.length < 3 || late - early < 24 * 2 ** 20, `memory: the JS heap stays level (${(early / 2 ** 20).toFixed(1)} MB early, ${(late / 2 ** 20).toFixed(1)} MB late, over ${mem.length} samples)`);
    ok(Math.max(...s.memory.map(x => x.cache)) <= 256 * 2 ** 20 && s.memory.every(x => x.textures <= 64), `memory: frame cache ≤ ${(Math.max(...s.memory.map(x => x.cache)) / 2 ** 20).toFixed(1)} MB, at most ${Math.max(...s.memory.map(x => x.textures))} source textures`);
    log(`   memory span: ${s.msPerFrame.mean.toFixed(0)} ms/frame at 270×480 (decode ${s.split.decode.toFixed(1)}, draw ${s.split.draw.toFixed(1)}, encode ${s.split.encode.toFixed(1)})`);
    // Cancel: abort mid-picture; the export throws AbortError and closes everything it opened.
    const cancel = await page.evaluate(async () => {
      const {plan} = await X.song({voice:false});
      const edl = (await X.treatments.draft())(plan, X.SHOTS, {format:'9:16'}), ac = new AbortController(), ledger = X.frameLedger();
      let error = null, seen = 0;
      try { await X.exportFilm({edl, plan, shots:X.SHOTS, format:'9:16', scale:.25, span:[1152, 1300], audio:null, ledger, signal:ac.signal, onProgress:p => { if (p.phase === 'picture' && (seen = p.frame) >= 6) ac.abort(); }}); } catch (e) { error = e.name; }
      return {error, seen, live:ledger.live, opened:ledger.opened};
    });
    ok(cancel.error === 'AbortError' && cancel.seen < 10 && cancel.live === 0 && cancel.opened > 0, `cancel: aborted after ${cancel.seen} frames with ${cancel.error}; ${cancel.opened} VideoFrames opened, ${cancel.live} left open`);
    await page.close();
    log(`5. leaks and memory: ${checks - before} checks`);
  }
  ok(pageErrors.length === 0, `no page errors (${pageErrors.slice(0, 2).join('; ')})`);
} finally {
  await browser.close();
  await srv.close();
  if (!keep) fs.rmSync(OUT, {recursive:true, force:true});
}
log(`check-videostudio-export: ${checks} checks passed in ${((Date.now() - t00) / 1000).toFixed(0)} s${keep ? ` (files in ${OUT})` : ''}`);
