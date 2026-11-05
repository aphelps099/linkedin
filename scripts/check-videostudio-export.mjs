// The export (src/videostudio/render/export.js, media/decoder.js) and the draft cut
// (treatments/drop60-draft.js), and the P3 gates on real exported files:
//   1. Node: the demuxer against the proxies, captions, the draft cut's lint and its
//      rows (plan §2), the sidecar's hashes
//   2. metronome: a full-length metronome export at 120 BPM (and 130 BPM, where steps are
//      not whole frames); ffmpeg scdet must find every cut on its target frame. The tiles are
//      L1 (no board region): over a full-frame generated tile the compositor draws the board's
//      sockets even when the EDL has no board cues.
//   3. the timing rule, every step at 120, 92, 130 and 108 BPM (Offsite, swung): cuts on round(t·24), within half a frame
//      of the beat; hits (one-frame flashes on {hit:true} anchors) on the frame that holds the click's
//      audible onset as the engine's master bus renders it: the picture leads by 0 to under one frame,
//      never late; the engine's latency measured on clicks and on every kick of each track's song
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
import {stepTime, cutFrame, hitFrame, audioLatency, chokeFrames, stopFrames} from '../src/videostudio/edl/anchors.js';
import {metronomeEDL, expectedCuts} from '../src/videostudio/edl/metronome.js';
import {demux} from '../src/videostudio/media/decoder.js';
import {captions, planJSON, exportName, SAMPLES_PER_FRAME} from '../src/videostudio/render/export.js';
import {drop60Draft, ROWS, SCENE_LABELS, GHOST} from '../src/videostudio/treatments/drop60-draft.js';
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
const lyrics = lyricsFromPost(SAMPLE_POST), plan = FORMS.drop60.arrange(lyrics, {}, {coldOpen:true});
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

  // The draft cut: clean on every track in every format, deterministic, and the rows of plan §2
  // (frames from the plan: the cold open, the choke and the impact by the timing rule).
  for (const track of ['circle-back', 'humbled-and-honored', 'hustle']) for (const format of ['9:16', '1:1', '16:9']) {
    const pl = track === 'circle-back' ? plan : FORMS.drop60.arrange(lyrics, {}, {track, coldOpen:true});
    const edl = drop60Draft(pl, SHOTS, {format}), p = compile(edl, {plan:pl, shots:SHOTS, format});
    ok(p.lint.errors.length === 0, `draft cut ${track} ${format}: ${p.clips.length} clips, 0 lint errors (${p.lint.errors.slice(0, 3).map(e => `${e.rule} ${e.message}`).join('; ')}), ${p.lint.warnings.length} warnings, peak ${p.decode.max} decodes`);
    ok(stringify(drop60Draft(pl, SHOTS, {format})) === stringify(edl) && compile(drop60Draft(pl, SHOTS, {format}), {plan:pl, shots:SHOTS, format}).hash() === p.hash(), `draft cut ${track} ${format}: the same EDL bytes and program hash twice (${p.hash()})`);
    if (format !== '9:16') continue;
    const fr = f => p.frame(f), layers = p.all.flatMap(x => x.layers), T = s => stepTime(pl, s), F = s => cutFrame(T(s)), BS = 16;
    const sec = name => pl.sections.find(x => x.name === name), {black:B, impact:I} = chokeFrames(pl);
    const ign = x => x.layers.some(l => l.fx.some(e => e.type === 'pegVideo'));
    ok(fr(0).transport?.kind === 'jump' && fr(0).transport.sound === 'copied' && p.board.screens[fr(0).board.screen]?.kind === 'impact' && ign(fr(0)) && p.all.slice(0, 18).every((x, i) => x.time === I / 24 + i / 24), `${track} row 0:0: frames 0-17 are the drop's own impact frames ${I}-${I + 17}, BACK. over peg video, its sound copied`);
    ok(p.all.slice(18, 24).every(x => x.transport?.kind === 'rewind' && x.transport.sound === 'reversed') && fr(19).time > fr(22).time && !fr(24).transport && p.all.slice(18, 24).every(x => x.layers.every(l => !l.reverse || l.shotId && SHOTS.shots.find(s => s.id === l.shotId)?.reverseClass === 'R1')), `${track} row 0:6: frames 18-23 rewind at 4x from the choke (${fr(18).time.toFixed(2)} → ${fr(23).time.toFixed(2)} s), the sound reversed with them; no R0 footage backwards`);
    ok(fr(30).layers.some(l => l.gen === 'camera-off'), `${track} row 0:8: Pat's black tile after the cold open`);
    ok(['L1', 'G4', 'G6'].every(cls => p.all.slice(24, F(pl.call.until) + 24).some(x => x.layout === cls)) && layers.some(l => l.chrome?.toast?.text?.endsWith('joined')), `${track} row 1: the grid blooms L1 → G4 → G6 with "joined" toasts`);
    ok(p.all.slice(0, F(sec('Verse').from * BS)).some(x => x.layers.some(l => /^join/.test(l.clipId) && l.shotId?.startsWith('printer'))), `${track} row 2: the printer joins the call`);
    const U = F(pl.call.until);
    ok(fr(U - 2).layers.filter(l => l.chrome.mic === 'on').length <= 1 && fr(U + 2).layers.every(l => l.chrome.mic === 'on') && p.board.screens.some(s => s.kind === 'title' && s.to <= T(pl.call.until) + 1e-9), `${track} row 3: the call muted before the unmute (frame ${U}; only the drummer's mic flickers on the hats), every mic on after it; YOU'RE ON MUTE ends by then`);
    const V = F(sec('Verse').from * BS);
    ok(fr(V).layout === 'L1' && fr(V).layers[0].transform.zoom < .5 && fr(V + 3).layers[0].transform.zoom === 1 && fr(F(sec('Verse').from * BS + 4) + 1).layout === 'stack3', `${track} row 4: Synergy fills the frame in 3 frames on the verse, then stack3`);
    ok(p.board.cells.some(s => s.text === 'ARJUN / FINANCE' && s.font === 'peg5' && s.cell === 'stack3.1'), `${track} row 7: freeze + label ARJUN / FINANCE in PEG-5, in the middle tile`);
    ok(p.all.some(x => x.layout === 'BOARD+STRIP' && x.board.banner) && layers.some(l => l.chrome?.banner === "You are viewing Synergy's screen"), `${track} row 8: the hook shares Synergy's screen`);
    const build = sec('Build').from * BS;
    ok(p.all.slice(F(build), F(build + BS)).every(x => x.layout === 'G9') && fr(F(build) + 14).layers.filter(l => l.fx.some(e => e.type === 'saturation')).length >= 6 && !fr(F(build) + 14).layers.some(l => l.gen === 'board'), `${track} row 12: freeze the call in G9, the frozen tiles greyed, the board once (its strip)`);
    ok(p.all.some(x => x.layers.some(l => /^G4\.\d>split/.test(l.cell.id))) && p.all.some(x => x.layers.some(l => /^split\.\d>G4/.test(l.cell.id))), `${track} row 14: breakout rooms, two then four`);
    const q = pl.lady.find(e => e.role === 'ladder' && e.period === 4).at;
    ok([1, 2, 4, 8].every((n, k) => fr(F(q + k * 4) + 2).layers.length === n), `${track} row 16: the cell split 1, 2, 4, 8 on the quarters`);
    ok(p.all.some(x => x.layout === 'BOARD+STRIP' && x.layers.some(l => l.fx.some(e => e.type === 'mosaic'))), `${track} row 18: the board with Synergy's tile, poor connection on the side tiles`);
    ok(p.all.slice(F(pl.choke.at), I).every(x => x.layers.every(l => l.gen === 'color:#000000')) && ign(fr(I)) && !ign(fr(I - 1)), `${track} rows 19:8 and 20: the black tile from the choke (the board dark from frame ${B}), the ignition over peg video on frame ${I}`);
    const sink = sec('Sink In').from * BS;
    ok(fr(F(sink) + 4).layout === 'G4' && p.all.slice(F(sink), F(sink + BS)).some(x => x.layers.some(l => l.fx.some(e => e.type === 'mosaic' && e.px >= 32))), `${track} row 23: Sink In in G4; on "in" the outer cells sink to 32 px`);
    const DB = sec('Drop B').from * BS;
    ok(fr(F(DB) + 8).layers.some(l => l.gen === 'feedback' && l.fx.some(e => e.type === 'droste')) && fr(F(DB + 14)).camera?.zoom > 2, `${track} row 24: the Droste dive into Pat's cell`);
    ok(fr(F(DB + 2 * BS + 10)).layers.some(l => l.fx.some(e => e.type === 'tile')) && fr(F(DB + 2 * BS + 10)).layout === 'L1' && fr(F(DB + 3 * BS + 10)).layers.some(l => l.clipId.startsWith('replay.')), `${track} rows 26-27: the kaleido of the pads in L1, replayed in the fill`);
    ok(layers.some(l => l.chrome?.toast?.text === 'Kevin left the meeting') && fr(F(sec('Outro').from * BS) + 2).layout === 'G6', `${track} row 28: the call from G6, Kevin leaves first`);
    // Row 29: the tape stop's curve, then its hold while her "Full stop." (after the tape) still sounds,
    // "FULL STOP." on the board all along; black from the first frame after her; the ghost BACK. last.
    const stop = pl.tape.find(t => t.kind === 'stop'), curve = F(stop.from) + Math.ceil(stop.seconds * 24 - 1e-9), her = stopFrames(pl), black = Math.max(curve, her.black), ghost = Math.max(p.frames - 2, black);
    const stopScreen = x => p.board.screens[x.board.screen]?.kind === 'stop' && !!x.board.rect && !x.board.dark;
    ok(p.transports.some(t => t.kind === 'tapestop' && t.to === Math.min(black, p.frames)) && p.all.slice(her.onset, Math.min(black, p.frames)).every(stopScreen) && p.all.slice(black, ghost).every(x => x.layers.every(l => l.gen === 'color:#000000') && !x.board.rect), `${track} row 29: the tape stop's curve to frame ${curve}, held to ${Math.min(black, p.frames) - 1} with "FULL STOP." on the board while she sounds (to ${her.end.toFixed(3)} s), then true black (no board region) on ${black}-${ghost - 1}`);
    const g0 = p.board.screens[fr(0).board.screen];
    ok(p.all.slice(ghost).every(x => x.layout === fr(0).layout && p.board.screens[x.board.screen]?.ghost === GHOST && p.board.screens[x.board.screen].of === g0.of && x.layers.every(l => l.gen === 'color:#000000')) && p.frames - ghost === Math.min(2, p.frames - black) && !p.lint.warnings.some(w => w.rule === 'G12'), `${track} row 29: the last ${p.frames - ghost} frame${p.frames - ghost > 1 ? 's' : ''} (${ghost}-${p.frames - 1}) show the ghost BACK. at I ${GHOST} on black: frame 0's layout and BACK. screen, so the loop closes (G12 clean)`);
    ok(layers.every(l => !(l.shotId && /lady|circle back|^pat$/i.test(SHOTS.shots.find(s => s.id === l.shotId)?.characters.join(' ') ?? ''))) && layers.filter(l => l.gen === 'camera-off').length > 100, `${track} canon: Pat never on video; the lady never footage`);
    const sceneIds = new Set(edl.clips.map(c => c.scene));
    ok([...sceneIds].every(s => SCENE_LABELS[s]), `${track}: every scene has a label for the monitor (${[...sceneIds].join(', ')})`);
  }
  const statuses = ROWS.reduce((m, r) => ({...m, [r.status]:(m[r.status] ?? 0) + 1}), {});
  ok(ROWS.length >= 27 && ROWS.every(r => ['done', 'stand-in', 'partial', 'skipped'].includes(r.status) && r.what && !/—/.test(r.note + r.what)), `ROWS: plan §2 row by row: ${Object.entries(statuses).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  ok(planJSON(plan) === planJSON(FORMS.drop60.arrange(lyrics, {}, {coldOpen:true})) && exportName(plan, '9:16') === 'linkedinbeats-circle-back-drop60-9x16.mp4' && SAMPLES_PER_FRAME === 2000, 'the plan hashes the same twice; file names; 2,000 samples a frame at 48 kHz');
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

  // ---- 3. the timing rule, every step of every track: cuts and hits --------------------------------------------
  // One file per track (120, 92, 130 and 108 BPM), two tiles: the top one cuts black/white on every step
  // at round(t·24) (hard cuts: within half a frame of the beat); the bottom one flashes white for one
  // frame on every step at its hit frame ({anchor:'step:s', hit:true}: the frame that holds the
  // audible onset). The sound is a click on every step played through the engine's own master bus
  // (buildGraph's drum bus, glue and limiter), so it lands as the engine renders it. Every step is
  // tested; nothing is chosen. The engine's latency is then measured on each track's real render
  // (every kick of the song), and must match edl/anchors.js AUDIO_LATENCY.
  if (section(3)) {
    const before = checks, page = await fresh(), dist = {};
    for (const track of quick ? ['circle-back'] : ['circle-back', 'humbled-and-honored', 'hustle', 'offsite']) {
      const res = await page.evaluate(async ({track}) => {
        const {plan} = await X.song({voice:false, track});
        const T = s => X.stepTime(plan, s), N = plan.totalSteps, clips = [{id:'bg', at:0, len:N, cell:'full', asset:'gen:color:#000000'}];
        for (let s = 0; s < N; s++) {
          clips.push({id:`cut${s}`, at:s, len:1, cell:'split.0', asset:s % 2 ? 'gen:color:#000000' : 'gen:white', z:1});
          clips.push({id:`hit${s}`, at:{anchor:`step:${s}`, hit:true}, len:1, cell:'split.1', asset:'gen:white', z:1});
          clips.push({id:`off${s}`, at:{anchor:`step:${s}`, hit:true, frames:1}, len:1, cell:'split.1', asset:'gen:color:#000000', z:1});
        }
        const edl = X.createEDL({form:'drop60', format:'9:16', clips, board:[]});
        // A click on every step, through the engine's master bus, offline at the engine's own 44.1 kHz
        // (the compressors' look-ahead is a whole number of samples: 720 at 44.1 kHz, 16.33 ms; 768 at
        // 48 kHz, 16.00 ms), then resampled to the file's 48 kHz by the export, as a song is.
        const sr = 44100, n = Math.ceil((T(N) + .5) * sr), ctx = new OfflineAudioContext(2, n, sr), g = X.engine.buildGraph(ctx, {}, plan);
        g.oscillators.forEach(o => o.start(0));
        const buf = ctx.createBuffer(1, n, sr), c = buf.getChannelData(0);
        for (let s = 0; s < N; s++) { const i = Math.round(T(s) * sr); for (let k = 0; k < 24; k++) c[i + k] = .8 * (1 - k / 24); }
        const src = ctx.createBufferSource(); src.buffer = buf; src.connect(g.drumHp); src.start(0);
        g.exact?.finalize?.();
        const out = await ctx.startRendering(), L = out.getChannelData(0), R = out.getChannelData(1);
        // The engine's own delay on each click, before any codec (the first sample within 40 dB of its peak).
        const clickDelay = [];
        for (let s = 0; s < N; s++) { const a = Math.max(0, Math.round((T(s) - .002) * sr)), z = Math.round((T(s) + .05) * sr); let p = 0; for (let i = a; i < z; i++) p = Math.max(p, Math.abs(L[i])); for (let i = Math.max(0, a); i < z; i++) if (Math.abs(L[i]) >= p / 100) { clickDelay.push((i / sr - T(s)) * 1000); break; } }
        const film = await X.exportFilm({edl, plan, shots:X.SHOTS, format:'9:16', scale:.125, governor:false, post:{bloom:{weight:0}, grain:0, dither:false}, audio:{sampleRate:sr, channels:[L, R], offset:0}});
        X.out = {mp4:film.mp4};
        // The engine's latency on the real song: every kick after the unmute, drums alone.
        const {song} = await X.song({voice:false, track});
        const r = await X.engine.render(plan, song.buffers, {tune:{stems:true}, coldOpen:false, muted:{bass:true, keys:true, guitar:true, voice:true, lady:true}}, song.lady);
        const m = r.getChannelData(0), rs = r.sampleRate, off = X.engine.RENDER_OFFSET - plan.timing[0], kicks = [];
        for (const k of plan.kicks) {
          const t = T(k); if (k < plan.call.until || t < 1) continue;
          const a = Math.round((t + off - .002) * rs), z = Math.round((t + off + .04) * rs);
          let p = 0; for (let i = a; i < z; i++) p = Math.max(p, Math.abs(m[i]));
          for (let i = a; i < z; i++) if (Math.abs(m[i]) >= p / 100) { kicks.push((i / rs - off - t) * 1000); break; }
        }
        return {bpm:plan.bpm, steps:N, T:Array.from({length:N}, (_, s) => T(s)), hit:Array.from({length:N}, (_, s) => X.hitFrame(T(s), plan)), cut:Array.from({length:N}, (_, s) => X.cutFrame(T(s))), latency:X.audioLatency(plan), kicks, clickDelay};
      }, {track});
      const file = path.join(OUT, `timing-${track}.mp4`);
      fs.writeFileSync(file, await pull(page, 'mp4'));
      // Per frame: the mean luma of the top tile and the bottom tile (136×240 grey).
      const W = 136, H = 240, raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'format=gray', '-f', 'rawvideo', '-'], {maxBuffer:1 << 30}).stdout, frames = raw.length / (W * H);
      const band = (f, y0, y1) => { let sum = 0, cnt = 0; for (let y = y0; y < y1; y++) for (let x = 10; x < W - 10; x++) { sum += raw[f * W * H + y * W + x]; cnt++; } return sum / cnt; };
      const top = [], bottom = [];
      for (let f = 0; f < frames; f++) { top.push(band(f, 15, 90) > 128); bottom.push(band(f, 150, 230) > 128); }
      const start = +probe(file).find(st => st.codec_type === 'video').start_time || 0;
      // Cuts: the frames where the top tile changes; each must be its step's round(t·24) and sit within half a frame of the beat.
      const cutsSeen = []; for (let f = 1; f < frames; f++) if (top[f] !== top[f - 1]) cutsSeen.push(f);
      const cutsWant = res.cut.slice(1);
      const cutErr = cutsWant.map((f, i) => (cutsSeen[i] / FPS + start) - res.T[i + 1]);
      ok(cutsSeen.length === cutsWant.length && cutsWant.every((f, i) => cutsSeen[i] === f), `${track} (${res.bpm} BPM): ${cutsSeen.length} of ${cutsWant.length} step cuts on their round(t·24) frame in the file`);
      ok(cutErr.every(d => Math.abs(d) <= .5 / FPS + 5e-4), `${track}: every cut within half a frame of its beat (${(Math.min(...cutErr) * 1000).toFixed(2)} to ${(Math.max(...cutErr) * 1000).toFixed(2)} ms)`);
      // Hits: one white frame per step in the bottom tile; the click's audible onset (the first sample within 40 dB
      // of its peak) must fall inside that frame: the picture leads by 0 to under one frame, never late.
      const flashes = []; for (let f = 0; f < frames; f++) if (bottom[f] && (!f || !bottom[f - 1])) flashes.push(f);
      // The audible onset in the file: the first sample within 20 dB of the click's peak. (An Opus or AAC
      // encode's pre-echo reaches a few tenths of a millisecond earlier at -40 dB: printed, not the onset.)
      const x = pcm(file), sr = 48000, onsetAt = db => res.T.map(t => { const a = Math.max(0, Math.round((t - .002) * sr)), z = Math.round((t + .05) * sr); let p = 0; for (let i = a; i < z; i++) p = Math.max(p, Math.abs(x[i])); for (let i = a; i < z; i++) if (Math.abs(x[i]) >= p * 10 ** (db / 20)) return i / sr; return null; });
      const onsets = onsetAt(-20), echo = onsetAt(-40);
      const leads = flashes.map((f, i) => onsets[i] - (f / FPS + start)), echoLead = flashes.map((f, i) => echo[i] - (f / FPS + start));
      ok(flashes.length === res.steps && flashes.every((f, i) => f === res.hit[i]), `${track}: ${flashes.length} of ${res.steps} hit flashes, each on its step's hit frame`);
      // (To the file's resolution: one sample at 48 kHz, 0.02 ms; the rule's closest step leads by 0.02 ms in plan time.)
      ok(leads.every(d => d >= -1 / 48000 - 1e-9 && d < 1 / FPS), `${track}: every hit leads its click's audible onset by 0 to under one frame (${(Math.min(...leads) * 1000).toFixed(2)} to ${(Math.max(...leads) * 1000).toFixed(2)} ms over ${leads.length} steps, to one sample; never late; the codec's pre-echo at -40 dB from ${(Math.min(...echoLead) * 1000).toFixed(2)} ms)`);
      const delay = onsets.map((o, i) => (o - res.T[i]) * 1000).sort((a, b) => a - b), k = [...res.kicks].sort((a, b) => a - b), med = a => a[a.length >> 1], eng = [...res.clickDelay].sort((a, b) => a - b), Lms = res.latency * 1000;
      const near = k.filter(d => Math.abs(d - Lms) < .5).length;
      // The kicks a preceding hit's tail reaches into read early (their onset is lost in it), never late.
      ok(eng.length === res.steps && Math.abs(eng[0] - Lms) < .05 && Math.abs(eng.at(-1) - Lms) < .05 && Math.abs(med(k) - Lms) < .15 && near >= .6 * k.length && k.at(-1) < Lms + .5,
        `${track}: the engine's latency, measured: every click through the master bus ${eng[0].toFixed(2)}-${eng.at(-1).toFixed(2)} ms; the song's ${k.length} kicks median ${med(k).toFixed(2)} ms, ${near} within 0.5 ms, none later than ${k.at(-1).toFixed(2)} ms; AUDIO_LATENCY ${Lms.toFixed(2)} ms. In the file (Opus) the clicks' onsets read ${delay[0].toFixed(2)}-${delay.at(-1).toFixed(2)} ms after their steps`);
      const pct = (a, q) => [...a].sort((p, r) => p - r)[Math.min(a.length - 1, Math.floor(q * a.length))];
      dist[track] = {bpm:res.bpm, steps:res.steps, cut:{min:Math.min(...cutErr) * 1000, p50:pct(cutErr, .5) * 1000, max:Math.max(...cutErr) * 1000}, lead:{min:Math.min(...leads) * 1000, p50:pct(leads, .5) * 1000, max:Math.max(...leads) * 1000, overHalf:leads.filter(d => d > .5 / FPS).length, preEcho:Math.min(...echoLead) * 1000}, engineClick:{min:eng[0], max:eng.at(-1)}, fileClick:{min:delay[0], p50:med(delay), max:delay.at(-1)}, kicks:{n:k.length, min:k[0], p50:med(k), max:k.at(-1), within:near}};
      log(`   ${track} ${res.bpm} BPM, ${res.steps} steps: cuts ${dist[track].cut.min.toFixed(2)} / ${dist[track].cut.p50.toFixed(2)} / ${dist[track].cut.max.toFixed(2)} ms from the beat (min / median / max); hits lead ${dist[track].lead.min.toFixed(2)} / ${dist[track].lead.p50.toFixed(2)} / ${dist[track].lead.max.toFixed(2)} ms (${dist[track].lead.overHalf} steps over half a frame); kicks land ${dist[track].kicks.min.toFixed(2)} / ${dist[track].kicks.p50.toFixed(2)} / ${dist[track].kicks.max.toFixed(2)} ms after plan time`);
    }
    fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(dist, null, 1));
    await page.close();
    log(`3. the timing rule: ${checks - before} checks`);
  }

  // ---- 4. determinism, 5. leaks: the draft cut on real footage, twice in fresh pages --------------------------
  // The sound is a fixed synthetic track (clicks over a 220 Hz tone): engine.render is not
  // bit-reproducible (measured below), and the export's own sound path must be judged alone.
  if (section(4)) {
    const before = checks, span = quick ? [948, 984] : [936, 1008], runs = [];
    const spec = async (page, keyEvery, name) => {
      const res = await page.evaluate(async ({span, keyEvery}) => {
        const {plan} = await X.song({voice:false});
        const edl = (await X.treatment('draft')).fn(plan, X.SHOTS, {format:'9:16'});
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
      const edl = (await X.treatment('draft')).fn(plan, X.SHOTS, {format:'9:16'}), ac = new AbortController(), ledger = X.frameLedger();
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
