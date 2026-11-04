// The P3 video review's gates, rerunnable. Node only (a second or two), plus an exported
// MP4 when one is given:
//   1. canon on every compiled frame of the draft cut, in every format: Pat never on video,
//      the lady never footage, no warping effect on Synergy (layer or composite), robots never
//      mirrored, no R0 shot reversed outside a whole-picture transport, instrument mirrors only
//      under a G11 waiver; true black on frames 948-959 and the ignition on 960
//   2. captions: one line at a time per voice
//   3. known gaps, measured and printed (they do not fail the check): stretches where the song
//      has words on the board but no board is on screen, and steps where round(t·24) puts a cut
//      after its sound at the song book's tempos
//   4. --mp4 FILE: the file itself. Frame count and 24/1; the flash governor (flashes and
//      worstWindow from src/pegboard/governor.js) on the per-frame relative luminance of the whole
//      frame, each quadrant and each ninth; true black 948-959 and the ignition at 960; the
//      impact's sound starts 0-25 ms after frame 960 (the picture leads, never lags); the silence
//      before it, below -70 dBFS
// node scripts/check-review-video.mjs [--mp4 export.mp4] [--format 9:16] [--verbose]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FORMS} from '../src/allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {compile, shotIndex} from '../src/videostudio/edl/compile.js';
import {FX} from '../src/videostudio/edl/schema.js';
import {drop60Draft} from '../src/videostudio/treatments/drop60-draft.js';
import {captions} from '../src/videostudio/render/export.js';
import {flashes, worstWindow} from '../src/pegboard/governor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), arg = k => argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : null, verbose = argv.includes('--verbose');
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; if (verbose) console.log('  ok', m); };
const gap = m => console.log(`  gap ${m}`);
const FPS = 24, t00 = Date.now();
const SHOTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/videostudio/media/shots.json'), 'utf8')), idx = shotIndex(SHOTS);
const lyrics = lyricsFromPost(SAMPLE_POST), plan = FORMS.drop60.arrange(lyrics, {});
const who = l => (l.shotId && idx.get(l.shotId)?.characters) || [];
const is = (l, re) => who(l).some(c => re.test(c));
const spans = a => { const out = []; for (const f of a) { const r = out.at(-1); if (r && f === r[1] + 1) r[1] = f; else out.push([f, f]); } return out; };
const programs = {};

// ---- 1. canon on every frame ----------------------------------------------------------------------
for (const format of ['9:16', '1:1', '16:9']) {
  const edl = drop60Draft(plan, SHOTS, {format}), p = programs[format] = compile(edl, {plan, shots:SHOTS, format});
  ok(p.lint.ok, `${format}: the draft cut compiles with 0 lint errors (${p.lint.warnings.length} warnings)`);
  const waived = new Set(p.lint.warnings.filter(w => w.rule === 'G11' && /waived/.test(w.message)).map(w => w.clipId));
  const bad = {pat:[], lady:[], warp:[], camera:[], robotMirror:[], r0:[], mirror:[]};
  let instrumentMirrors = 0;
  for (let f = 0; f < p.frames; f++) {
    const fr = p.frame(f), syn = fr.layers.filter(l => is(l, /^synergy$/i));
    for (const l of fr.layers) {
      const s = l.shotId && idx.get(l.shotId);
      if (!s) continue;
      if (is(l, /^pat$/i)) bad.pat.push(f);
      if (is(l, /lady|circle back/i)) bad.lady.push(f);
      if (is(l, /^(synergy|synthia)$/i) && (l.transform.mirror || l.fx.some(x => x.type === 'tile' && x.mirror))) bad.robotMirror.push(f);
      if (l.reverse && s.reverseClass === 'R0' && !fr.transport) bad.r0.push(f);
      const mirrored = l.transform.mirror || l.fx.some(x => FX[x.type]?.mirrors === true || (typeof FX[x.type]?.mirrors === 'function' && FX[x.type].mirrors(x)));
      if (mirrored && ((s.action || []).includes('play') || !s.mirrorable)) { if (waived.has(l.clipId)) instrumentMirrors++; else bad.mirror.push(f); }
    }
    for (const l of syn) if (l.fx.some(x => FX[x.type]?.warps)) bad.warp.push(f);
    if (syn.length && fr.camera?.fx?.some(x => FX[x.type]?.warps)) bad.camera.push(f);
  }
  ok(!bad.pat.length && !bad.lady.length, `${format}: Pat is never on video and the lady is never footage, on all ${p.frames} frames`);
  ok(!bad.warp.length && !bad.camera.length, `${format}: no warping effect on Synergy, in his layer or the composite (${bad.warp.length + bad.camera.length} frames)`);
  ok(!bad.robotMirror.length, `${format}: robots are never mirrored`);
  ok(!bad.mirror.length, `${format}: no unflagged shot or instrument is mirrored without a G11 waiver (${instrumentMirrors} waived layer-frames, Aaron's call)`);
  ok(!bad.r0.length, `${format}: no R0 shot plays reversed outside a whole-picture transport`);
  const black = p.all.slice(948, 960).every(x => x.layers.every(l => l.gen === 'color:#000000')), ign = p.frame(960);
  ok(black && ign.layers.length && ign.board.screen >= 0, `${format}: frames 948-959 true black, the ignition on frame 960`);
  // R0 footage reversed inside a transport: allowed by D2 only with the sound reversed too.
  const inTransport = new Map();
  for (let f = 0; f < p.frames; f++) { const fr = p.frame(f); if (fr.transport) for (const l of fr.layers) if (l.reverse && idx.get(l.shotId)?.reverseClass === 'R0') inTransport.set(l.shotId, (inTransport.get(l.shotId) || 0) + 1); }
  if (inTransport.size && format === '9:16') gap(`${format}: R0 footage plays backwards inside a transport rewind (${[...inTransport].map(([k, n]) => `${k} ${n} f`).join(', ')}); D2 allows it only with the sound reversed, and drop.js has no reversed audio`);
}

// ---- 2. captions -----------------------------------------------------------------------------------
{
  const vtt = captions(plan);
  const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})\n<v ([^>]+)>/g)].map(m => ({a:+m[1] * 3600 + +m[2] * 60 + +m[3] + m[4] / 1000, b:+m[5] * 3600 + +m[6] * 60 + +m[7] + m[8] / 1000, v:m[9]}));
  const overlaps = cues.filter((c, i) => cues.some((d, j) => j > i && d.v === c.v && d.a < c.b - 1e-9));
  ok(cues.length >= 15 && !overlaps.length, `captions: ${cues.length} cues, no voice has two lines on screen at once`);
}

// ---- 3. known gaps, measured -----------------------------------------------------------------------------
{
  for (const format of ['9:16']) {
    const p = programs[format], hidden = [];
    for (let f = 0; f < p.frames; f++) {
      const fr = p.frame(f), s = fr.board.screen >= 0 ? p.board.screens[fr.board.screen] : null;
      const words = s && (s.words || []).some(w => w.start <= fr.time && w.end > fr.time);
      const visible = fr.board.rect || fr.board.cells.length || fr.layers.some(l => l.gen === 'board');
      if (words && !visible) hidden.push(f);
    }
    const long = spans(hidden).filter(([a, b]) => b - a + 1 >= 12);
    if (long.length) gap(`${format}: the song has words on the board but no board is on screen for ${long.map(([a, b]) => `f${a}-${b}`).join(', ')} (${(long.reduce((n, [a, b]) => n + b - a + 1, 0) / FPS).toFixed(1)} s)`);
  }
  for (const track of TRACK_ORDER) {
    const pl = track === 'circle-back' ? plan : FORMS.drop60.arrange(lyrics, {}, {track});
    let late = 0, worst = 0, n = 0;
    for (let s = 1; s < pl.totalSteps; s++) { const T = pl.timing[s], d = Math.round(T * FPS) / FPS - T; n++; if (d > 1e-9) { late++; worst = Math.max(worst, d); } }
    if (late) gap(`${track} (${pl.bpm} BPM): a cut or flash on round(t·24) lands after its sound on ${late} of ${n} steps, by up to ${(worst * 1000).toFixed(1)} ms (the flash-plus-click gate tests only the steps that pass)`);
    else ok(true, `${track} (${pl.bpm} BPM): every step's round(t·24) frame starts at or before its sound`);
  }
}

// ---- 4. an exported MP4 -----------------------------------------------------------------------------------
const mp4 = arg('mp4');
if (mp4) {
  const format = arg('format') ?? '9:16', p = programs[format];
  const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', mp4], {encoding:'utf8'}).stdout).streams;
  const v = probe.find(s => s.codec_type === 'video'), W = v.width, H = v.height;
  ok(+v.nb_frames === p.frames && v.r_frame_rate === '24/1', `${path.basename(mp4)}: ${v.nb_frames} frames at ${v.r_frame_rate} (the program has ${p.frames})`);
  // Relative luminance per frame (sRGB decoded to linear), whole, quadrants and ninths.
  const lut = new Float64Array(256).map((_, i) => { const c = i / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  const regions = [{name:'whole', x:0, y:0, w:W, h:H}];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) regions.push({name:`quad ${i}${j}`, x:j * W / 2, y:i * H / 2, w:W / 2, h:H / 2});
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) regions.push({name:`ninth ${i}${j}`, x:Math.floor(j * W / 3), y:Math.floor(i * H / 3), w:Math.floor(W / 3), h:Math.floor(H / 3)});
  const series = regions.map(() => []), size = W * H * 3;
  await new Promise((resolve, reject) => {
    const ffm = spawn('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    let buf = Buffer.alloc(0), parts = [], pending = 0;
    const rowY = new Float64Array(W);
    ffm.stdout.on('data', d => {
      parts.push(d); pending += d.length;
      if (buf.length + pending < size) return;       // join once a whole frame is in (no copy per chunk)
      buf = Buffer.concat([buf, ...parts]); parts = []; pending = 0;
      while (buf.length >= size) {
        const sums = new Float64Array(regions.length);
        for (let y = 0; y < H; y++) {
          for (let x = 0, o = y * W * 3; x < W; x++, o += 3) rowY[x] = .2126 * lut[buf[o]] + .7152 * lut[buf[o + 1]] + .0722 * lut[buf[o + 2]];
          regions.forEach((r, k) => { if (y < r.y || y >= r.y + r.h) return; let s = 0; for (let x = r.x; x < r.x + r.w; x++) s += rowY[x]; sums[k] += s; });
        }
        regions.forEach((r, k) => series[k].push(sums[k] / (r.w * r.h)));
        buf = buf.subarray(size);
      }
    });
    ffm.on('close', c => c ? reject(Error(`ffmpeg exited ${c}`)) : resolve());
  });
  const worst = regions.map((r, k) => ({r:r.name, w:worstWindow(flashes(series[k], FPS), FPS), n:flashes(series[k], FPS).length / 2})).sort((a, b) => b.w - a.w);
  ok(worst[0].w <= 3, `flash governor on the file: at most ${worst[0].w} flashes in any second (${worst[0].r}; whole frame ${worst.find(x => x.r === 'whole').w}, ${regions.length} regions; limit 3)`);
  const Y = series[0];
  if (format === '9:16' || p.frames >= 961) {
    ok(Math.max(...Y.slice(948, 960)) < 1e-4 && Y[960] > .3 && Y[961] < Y[960], `true black on 948-959 (max ${Math.max(...Y.slice(948, 960)).toExponential(1)}), the ignition on 960 (${Y[960].toFixed(3)}, then ${Y[961].toFixed(3)})`);
    const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-map', '0:a', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], {maxBuffer:1 << 30}).stdout;
    const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length >> 2), sr = 48000, peak = i => Math.max(Math.abs(x[2 * i]), Math.abs(x[2 * i + 1]));
    let onset = -1; for (let i = Math.round(39.9 * sr); i < 40.2 * sr; i++) if (peak(i) > 10 ** (-60 / 20)) { onset = i / sr; break; }
    const lead = (onset - 960 / FPS) * 1000;
    ok(lead >= 0 && lead <= 25, `the impact: frame 960 at 40.000 s, its sound from ${onset.toFixed(4)} s: the picture leads by ${lead.toFixed(1)} ms (0-25, never late)`);
    let run = 0, best = [0, 0];
    for (let i = Math.round(39.3 * sr), s = i; i < 40.1 * sr; i++) { if (peak(i) < 10 ** (-70 / 20)) { if (++run > best[1] - best[0]) best = [s, i + 1]; } else { run = 0; s = i + 1; } }
    const silent = (best[1] - best[0]) / sr * 1000, voice = best[0] / sr;
    ok(silent >= 350, `the silence before the impact: ${silent.toFixed(0)} ms below -70 dBFS (${voice.toFixed(3)}-${(best[1] / sr).toFixed(3)} s)`);
    if (voice > 948 / FPS + .02) gap(`the tag sounds until ${voice.toFixed(3)} s, but the picture is true black from frame 948 (${(948 / FPS).toFixed(3)} s): ${((voice - 948 / FPS) * 1000).toFixed(0)} ms of her voice over black, and the board never finishes "LET'S CIRCLE-"`);
  }
}
console.log(`check-review-video: ${checks} checks passed in ${((Date.now() - t00) / 1000).toFixed(1)} s`);
