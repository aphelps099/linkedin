// The P3 video review's gates, rerunnable. Node only (a second or two), plus an exported
// MP4 when one is given:
//   1. canon on every compiled frame of the draft cut, on every track and in every format, with
//      the film's cold open: Pat never on video, the lady never footage, no warping effect on
//      Synergy (layer or composite), robots never mirrored, no R0 footage running backwards except
//      inside a rewind whose sound the plan reverses too (plan.transports), instrument mirrors only
//      under a G11 waiver; true black from the first frame after her tag stops sounding to the
//      impact's frame, and the ignition on it (the frames come from the plan, per track and cast)
//   2. captions: one line at a time per voice
//   3. the timing rule, every step of every track: cuts land within half a frame of the beat
//      (round(t·24)); hits land on the frame that holds their audible onset (t + the engine's
//      latency), so the picture leads by 0 to under one frame and is never late
//   4. --mp4 FILE: the file itself. Frame count and 24/1; the flash governor (flashes and
//      worstWindow from src/pegboard/governor.js) on the per-frame relative luminance of the whole
//      frame, each quadrant and each ninth; true black and the ignition on their frames; the
//      impact's sound in the ignition's frame (0 to under one frame after it starts), at the drop
//      and at frame 0 of the cold open; her tag silent before the first black frame; the silence
//      before the impact, below -70 dBFS
// node scripts/check-review-video.mjs [--mp4 export.mp4] [--format 9:16] [--track circle-back] [--span 0-1440] [--verbose]
//   (--track and --span default to the file's sidecar, <name>.json, when there is one)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FORMS} from '../src/allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {castSong} from '../src/allhands/casting.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {compile, shotIndex, invert, apply} from '../src/videostudio/edl/compile.js';
import {audioLatency, hitFrame, chokeFrames, TAG_TAIL} from '../src/videostudio/edl/anchors.js';
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
const lyrics = lyricsFromPost(SAMPLE_POST);
// The film as the studio makes it, with the cold open: the sample post on a track chosen by hand
// (today's cast; with Let the post choose the sample picks Circle Back with the same cast).
const planOf = track => FORMS.drop60.arrange(lyrics, {}, {track, coldOpen:true});
ok(castSong(SAMPLE_POST).track === 'circle-back' && !castSong(SAMPLE_POST).recast.length, 'the sample post chooses Circle Back and today\'s cast');
// The choke's frames: true black from the first frame that starts after her tag stops sounding
// (plan.choke.tagEnd plus the engine's latency), the ignition on the frame that holds the impact.
// (edl/anchors.js chokeFrames: plus the codec's 5 ms tail, so nothing of her plays over black in the file.)
const who = l => (l.shotId && idx.get(l.shotId)?.characters) || [];
const is = (l, re) => who(l).some(c => re.test(c));
const programs = {}, plans = {};

// ---- 1. canon on every frame ----------------------------------------------------------------------
for (const track of TRACK_ORDER) {
  const plan = plans[track] = planOf(track), {black:B, impact:I} = chokeFrames(plan);
  for (const format of ['9:16', '1:1', '16:9']) {
    const edl = drop60Draft(plan, SHOTS, {format}), p = programs[`${track}|${format}`] = compile(edl, {plan, shots:SHOTS, format}), label = `${track} ${format}`;
    ok(p.lint.ok, `${label}: the draft cut compiles with 0 lint errors (${p.lint.warnings.length} warnings)${p.lint.ok ? '' : `: ${p.lint.errors.slice(0, 2).map(e => e.message).join('; ')}`}`);
    const waived = new Set(p.lint.warnings.filter(w => w.rule === 'G11' && /waived/.test(w.message)).map(w => w.clipId));
    const bad = {pat:[], lady:[], warp:[], camera:[], robotMirror:[], r0:[], mirror:[]};
    let instrumentMirrors = 0, heardBack = 0;
    for (let f = 0; f < p.frames; f++) {
      const fr = p.frame(f), syn = fr.layers.filter(l => is(l, /^synergy$/i));
      const reversedSound = fr.transport?.kind === 'rewind' && fr.transport.sound === 'reversed';
      for (const l of fr.layers) {
        const s = l.shotId && idx.get(l.shotId);
        if (!s) continue;
        if (is(l, /^pat$/i)) bad.pat.push(f);
        if (is(l, /lady|circle back/i)) bad.lady.push(f);
        if (is(l, /^(synergy|synthia)$/i) && (l.transform.mirror || l.fx.some(x => x.type === 'tile' && x.mirror))) bad.robotMirror.push(f);
        if (l.reverse && s.reverseClass === 'R0') { if (reversedSound) heardBack++; else bad.r0.push(f); }
        const mirrored = l.transform.mirror || l.fx.some(x => FX[x.type]?.mirrors === true || (typeof FX[x.type]?.mirrors === 'function' && FX[x.type].mirrors(x)));
        if (mirrored && ((s.action || []).includes('play') || !s.mirrorable)) { if (waived.has(l.clipId)) instrumentMirrors++; else bad.mirror.push(f); }
      }
      for (const l of syn) if (l.fx.some(x => FX[x.type]?.warps)) bad.warp.push(f);
      if (syn.length && fr.camera?.fx?.some(x => FX[x.type]?.warps)) bad.camera.push(f);
    }
    ok(!bad.pat.length && !bad.lady.length, `${label}: Pat is never on video and the lady is never footage, on all ${p.frames} frames`);
    ok(!bad.warp.length && !bad.camera.length, `${label}: no warping effect on Synergy, in his layer or the composite (${bad.warp.length + bad.camera.length} frames)`);
    ok(!bad.robotMirror.length, `${label}: robots are never mirrored`);
    ok(!bad.mirror.length, `${label}: no unflagged shot or instrument is mirrored without a G11 waiver (${instrumentMirrors} waived layer-frames, Aaron's call)`);
    ok(!bad.r0.length, `${label}: no R0 footage runs backwards except where the plan reverses the sound with it (${heardBack} layer-frames inside the cold open's rewind; ${bad.r0.length} elsewhere)`);
    const black = p.all.slice(B, I).every(x => x.layers.every(l => l.gen === 'color:#000000')), ign = p.frame(I);
    ok(black && p.frame(B - 1).board.rect && ign.layers.some(l => l.fx.some(x => x.type === 'pegVideo')) && ign.board.screen >= 0, `${label}: the black tile from the choke, the board dark from frame ${B} (her tag heard to ${(plan.choke.tagEnd + audioLatency(plan)).toFixed(4)} s, ${(plan.choke.tagEnd + TAG_TAIL + audioLatency(plan)).toFixed(4)} s through a codec), the ignition on frame ${I}`);
    const f0 = p.frame(0);
    ok(f0.transport?.kind === 'jump' && f0.transport.sound === 'copied' && f0.layers.some(l => l.fx.some(x => x.type === 'pegVideo')) && p.board.screens[f0.board.screen]?.kind === 'impact' && p.transports.some(t => t.kind === 'rewind' && t.sound === 'reversed'), `${label}: the cold open: frame 0 is the impact (its sound copied there), then the rewind with its sound reversed`);
  }
}

// ---- 1b. Synergy's mouth whenever he sings on screen ------------------------------------------------------
// Every frame his voice is on (his words and stammers) and a layer shows him: a tracked shot with its
// mouth row inside its tile and inside the frame through the camera, or his original take (its own
// mouth). An untracked shot with him in it must be framed off him (the applause close-up: the visible
// source starts right of x 465 of 1280). Echo taps of a dub delay count only beside his full tile;
// a tile the camera carries more than half out of frame (the Droste dive) is off screen.
{
  const UNTRACKED = {'corporate-applause-closer-reaction-531fa4a4':[0, 465], 'corporate-applause-vhs-cameraman-a018b1c9':[0, 1280], 'office-ensemble-e03c9edb':[380, 800]};
  for (const track of TRACK_ORDER) for (const format of ['9:16', '1:1', '16:9']) {
    const plan = plans[track], p = programs[`${track}|${format}`], spans = [];
    for (const w of plan.words) { const t = plan.timing[w.at]; spans.push([t, Math.min(t + w.gate, plan.timing[w.at + w.steps] ?? Infinity)]); }
    for (const st of plan.stutters) { const t = plan.timing[st.at]; spans.push([t, t + .9 * plan.step]); }
    const sings = v => spans.some(([a, b]) => v >= a && v < b);
    let frames = 0, bad = [];
    for (let f = 0; f < p.frames; f++) {
      const fr = p.frame(f);
      if (!sings(fr.time)) continue;
      const cam = fr.camera ? invert(fr.camera.matrix) : null, inFrame = (x, y) => { const [u, w] = cam ? apply(cam, x, y) : [x, y]; return u >= 0 && w >= 0 && u <= p.width && w <= p.height; };
      const his = fr.layers.filter(l => is(l, /^synergy$/i));
      if (!his.length) continue;
      // On screen: at least half of his tile in frame (through the camera).
      const half = c => { if (!cam) return true; const [x0, y0] = apply(cam, c.x, c.y), [x1, y1] = apply(cam, c.x + c.w, c.y + c.h), w = Math.max(0, Math.min(p.width, Math.max(x0, x1)) - Math.max(0, Math.min(x0, x1))), h = Math.max(0, Math.min(p.height, Math.max(y0, y1)) - Math.max(0, Math.min(y0, y1))); return w * h >= .5 * Math.abs(x1 - x0) * Math.abs(y1 - y0); };
      const shown = his.filter(l => half(l.cell));
      let any = false, ok1 = false;
      for (const l of shown) {
        const s = idx.get(l.shotId), U = UNTRACKED[s.id];
        if (U) { const M = l.transform.matrix, xs = [[l.cell.x, l.cell.y], [l.cell.x + l.cell.w, l.cell.y + l.cell.h], [l.cell.x, l.cell.y + l.cell.h], [l.cell.x + l.cell.w, l.cell.y]].map(([x, y]) => apply(M, x, y)[0]); if (Math.max(...xs) > U[0] && Math.min(...xs) < U[1]) bad.push(`f${f} ${l.clipId}: untracked, in view`); continue; }
        any = true;
        if (/original-take/.test(s.id)) { ok1 = true; continue; }
        const m = l.robot?.mouth;
        const visible = m && m.x - m.w / 2 >= l.cell.x && m.x + m.w / 2 <= l.cell.x + l.cell.w && m.y - m.h / 2 >= l.cell.y && m.y + m.h / 2 <= l.cell.y + l.cell.h && inFrame(m.x, m.y);   // (at least half the row in frame)
        if (visible && l.opacity > .99) ok1 = true;
        else if (!visible) bad.push(`f${f} ${l.clipId}: ${m ? 'mouth row out of its tile or frame' : 'no mouth track'}`);
      }
      if (any) { frames++; if (!ok1) bad.push(`f${f}: only echoes of him`); }
    }
    ok(frames > 300 && !bad.length, `${track} ${format}: Synergy's mouth row shows on all ${frames} frames he sings on screen (${bad.slice(0, 3).join('; ')})`);
  }
}

// ---- 2. captions -----------------------------------------------------------------------------------
for (const track of TRACK_ORDER) {
  const vtt = captions(plans[track]);
  const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})\n<v ([^>]+)>/g)].map(m => ({a:+m[1] * 3600 + +m[2] * 60 + +m[3] + m[4] / 1000, b:+m[5] * 3600 + +m[6] * 60 + +m[7] + m[8] / 1000, v:m[9]}));
  const overlaps = cues.filter((c, i) => cues.some((d, j) => j > i && d.v === c.v && d.a < c.b - 1e-9));
  ok(cues.length >= 15 && !overlaps.length, `captions ${track}: ${cues.length} cues, no voice has two lines on screen at once`);
}

// ---- 3. the timing rule, every step, every track ------------------------------------------------------
for (const track of TRACK_ORDER) {
  const pl = plans[track], L = audioLatency(pl), cut = [], lead = [];
  for (let s = 0; s <= pl.totalSteps; s++) {
    const t = pl.timing[s];
    cut.push(Math.round(t * FPS) / FPS - t);
    lead.push(t + L - hitFrame(t, pl) / FPS);
  }
  const ms = a => `${(Math.min(...a) * 1000).toFixed(2)} to ${(Math.max(...a) * 1000).toFixed(2)} ms`;
  ok(cut.every(d => Math.abs(d) <= .5 / FPS + 1e-9) && lead.every(d => d >= -1e-9 && d < 1 / FPS), `${track} (${pl.bpm} BPM), all ${cut.length} steps: cuts ${ms(cut)} from the beat (within half a frame); hits lead their audible onset by ${ms(lead)} (0 to under a frame, never late)`);
}

// ---- 4. an exported MP4 -----------------------------------------------------------------------------------
const mp4 = arg('mp4');
if (mp4) {
  const sidecar = (() => { try { return JSON.parse(fs.readFileSync(mp4.replace(/\.mp4$/, '.json'), 'utf8')); } catch { return null; } })();
  const format = arg('format') ?? sidecar?.film?.format ?? '9:16', track = arg('track') ?? sidecar?.film?.track ?? 'circle-back';
  const plan = plans[track], p = programs[`${track}|${format}`];
  // The sidecar's own marks when it has them (another post or cast), else the sample's.
  const {black:B, impact:I} = sidecar?.film?.marks ?? chokeFrames(plan);
  const span = arg('span') ? arg('span').split('-').map(Number) : sidecar?.film?.span ?? [0, p.frames], [from, to] = span, n = to - from;
  const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', mp4], {encoding:'utf8'}).stdout).streams;
  const v = probe.find(s => s.codec_type === 'video'), W = v.width, H = v.height;
  ok(+v.nb_frames === n && v.r_frame_rate === '24/1', `${path.basename(mp4)} (${track}, ${format}, frames ${from}-${to - 1}): ${v.nb_frames} frames at ${v.r_frame_rate}`);
  // Relative luminance per frame (sRGB decoded to linear), whole, quadrants and ninths.
  const lut = new Float64Array(256).map((_, i) => { const c = i / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  const regions = [{name:'whole', x:0, y:0, w:W, h:H}];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) regions.push({name:`quad ${i}${j}`, x:j * W / 2, y:i * H / 2, w:W / 2, h:H / 2});
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) regions.push({name:`ninth ${i}${j}`, x:Math.floor(j * W / 3), y:Math.floor(i * H / 3), w:Math.floor(W / 3), h:Math.floor(H / 3)});
  const series = regions.map(() => []), size = W * H * 3, maxPx = [];
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
        let mx = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0, o = y * W * 3; x < W; x++, o += 3) { rowY[x] = .2126 * lut[buf[o]] + .7152 * lut[buf[o + 1]] + .0722 * lut[buf[o + 2]]; const q = buf[o] > buf[o + 1] ? (buf[o] > buf[o + 2] ? buf[o] : buf[o + 2]) : (buf[o + 1] > buf[o + 2] ? buf[o + 1] : buf[o + 2]); if (q > mx) mx = q; }
          regions.forEach((r, k) => { if (y < r.y || y >= r.y + r.h) return; let s = 0; for (let x = r.x; x < r.x + r.w; x++) s += rowY[x]; sums[k] += s; });
        }
        regions.forEach((r, k) => series[k].push(sums[k] / (r.w * r.h)));
        maxPx.push(mx);
        buf = buf.subarray(size);
      }
    });
    ffm.on('close', c => c ? reject(Error(`ffmpeg exited ${c}`)) : resolve());
  });
  const worst = regions.map((r, k) => ({r:r.name, w:worstWindow(flashes(series[k], FPS), FPS)})).sort((a, b) => b.w - a.w);
  ok(worst[0].w <= 3, `flash governor on the file: at most ${worst[0].w} flashes in any second (${worst[0].r}; whole frame ${worst.find(x => x.r === 'whole').w}, ${regions.length} regions; limit 3)`);
  const Y = series[0], at = f => f - from;
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-map', '0:a', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], {maxBuffer:1 << 30}).stdout;
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length >> 2), sr = 48000, peak = i => Math.max(Math.abs(x[2 * i]), Math.abs(x[2 * i + 1]));
  const t0 = from / FPS, ix = t => Math.round((t - t0) * sr);
  // The audible onset in a window: the first sample within 20 dB of the window's peak (a codec's
  // pre-echo can reach a few tenths of a millisecond earlier at -40 dB; that is not the onset).
  const onsetIn = (a, b) => { let p = 0; for (let i = Math.max(0, ix(a)); i < Math.min(x.length / 2, ix(b)); i++) p = Math.max(p, peak(i)); for (let i = Math.max(0, ix(a)); i < Math.min(x.length / 2, ix(b)); i++) if (peak(i) >= p / 10) return t0 + i / sr; return null; };
  if (from <= B - 1 && to >= I + 2) {
    // True black: relative luminance under 1e-4 on every frame (the composite is exactly 0; Chromium's
    // software H.264 encoder can leave a code value or two at the left edge of a 1080-wide frame).
    const blackY = Math.max(...Y.slice(at(B), at(I))), blackPx = Math.max(...maxPx.slice(at(B), at(I)));
    ok(blackY < 1e-4 && blackPx <= 2 && Y[at(I)] > .3 && Y[at(I) + 1] < Y[at(I)] && Y[at(B) - 1] > blackY, `true black on ${B}-${I - 1} (luminance ${blackY.toExponential(1)}, max pixel ${blackPx}), the ignition on ${I} (${Y[at(I)].toFixed(3)}, then ${Y[at(I) + 1].toFixed(3)}); frame ${B - 1} still lit`);
    const impactT = plan.timing[plan.choke.until], onset = onsetIn(impactT - .03, impactT + .12), lead = (onset - I / FPS) * 1000;
    ok(lead >= 0 && lead < 1000 / FPS, `the impact: frame ${I} starts at ${(I / FPS).toFixed(4)} s, its sound from ${onset.toFixed(4)} s: the picture leads by ${lead.toFixed(1)} ms (0 to under one frame, never late)`);
    let last = null; for (let i = ix(plan.timing[plan.choke.at]); i < ix(impactT - .01); i++) if (peak(i) > 10 ** (-70 / 20)) last = t0 + i / sr;
    ok(last !== null && last < B / FPS, `her tag sounds until ${last?.toFixed(4)} s, before the picture goes black at frame ${B} (${(B / FPS).toFixed(4)} s): no voice over black`);
    let run = 0, best = [0, 0];
    for (let i = ix(plan.timing[plan.choke.at] + .2), s = i; i < ix(impactT + .1); i++) { if (peak(i) < 10 ** (-70 / 20)) { if (++run > best[1] - best[0]) best = [s, i + 1]; } else { run = 0; s = i + 1; } }
    const silent = (best[1] - best[0]) / sr * 1000;
    ok(silent >= 300, `the silence before the impact: ${silent.toFixed(0)} ms below -70 dBFS (${(t0 + best[0] / sr).toFixed(3)}-${(t0 + best[1] / sr).toFixed(3)} s)`);
  }
  if (from === 0) {
    const onset = onsetIn(0, .12), lead = onset * 1000;
    ok(lead >= 0 && lead < 1000 / FPS && Y[0] > .3 && Y[1] < Y[0], `the cold open: frame 0 ignites (${Y[0].toFixed(3)}, then ${Y[1].toFixed(3)}) and its sound starts ${lead.toFixed(1)} ms in (0 to under one frame)`);
  }
}
console.log(`check-review-video: ${checks} checks passed in ${((Date.now() - t00) / 1000).toFixed(1)} s`);
