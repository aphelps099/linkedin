// The P3 video review's gates, rerunnable. Node only (a second or two), plus an exported
// MP4 when one is given:
//   1. canon on every compiled frame of each track's own treatment (treatments/index.js: Offsite's
//      offsite-psych, drop60-draft for the rest) and of offsite-psych on every other track, in every format, with
//      the film's cold open: Pat never on video, the lady never footage, no warping effect on
//      Synergy (layer or composite), robots never mirrored, no R0 footage running backwards except
//      inside a rewind whose sound the plan reverses too (plan.transports), instrument mirrors only
//      under a G11 waiver; true black from the first frame after her tag stops sounding to the
//      impact's frame, and the ignition on it (the frames come from the plan, per track and cast)
//      1a. at least 7 black frames before the impact on every track, the sample and every fixture post
//          with its cast (the choke's 30 ms codec tail); the rewind's board looks back (no tag "L")
//      1d. each track on its own form (Offsite: the river) with the sample's cast from the voice bank: canon on every
//          frame (Strategy and Synthia's band tiles included), Synergy's mouth row whenever he sings
//      1e. no partial words: a typewriter phrase is whole on the board (a read-ahead ghost) from its first frame
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
import {FORMS, formOf} from '../src/allhands/forms.js';
import {AVAILABLE} from '../src/allhands/voices/voice-table.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {castSong, settleCast} from '../src/allhands/casting.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {compile, shotIndex, invert, apply, TRACKING} from '../src/videostudio/edl/compile.js';
import {audioLatency, hitFrame, chokeFrames, stopFrames, TAG_TAIL, CHOKE_TAIL} from '../src/videostudio/edl/anchors.js';
import {paint, STOP_DIM, activeScreen} from '../src/pegboard/choreo.js';
import {boardGrid, boardPitch, safeSpan} from '../src/videostudio/gl/board-layer.js';
import {boardScreens, boardTimeOf} from '../src/videostudio/gl/compositor.js';
import {SAFE, HOME, FULL_BOARD, sameRect} from '../src/videostudio/layouts.js';
import {FX} from '../src/videostudio/edl/schema.js';
import {GHOST, CLAP} from '../src/videostudio/treatments/drop60-draft.js';
import {treatmentFor, TREATMENTS, BY_TRACK, DEFAULT as DEFAULT_TREATMENT} from '../src/videostudio/treatments/index.js';
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
// (today's cast; with Let the post choose the sample picks Circle Back and the lexicon's lines, casting.js).
const planOf = track => FORMS.drop60.arrange(lyrics, {}, {track, coldOpen:true});
ok(castSong(SAMPLE_POST).track === 'circle-back', 'the sample post chooses Circle Back');
// The choke's frames: true black from the first frame that starts after her tag stops sounding
// (plan.choke.tagEnd plus the engine's latency), the ignition on the frame that holds the impact.
// (edl/anchors.js chokeFrames: plus the choke's 30 ms codec tail, CHOKE_TAIL, so nothing of her, and no
// encoder floor after her hard cut, plays over black in the file.)
// Every track's film with its own treatment (treatments/index.js: Offsite gets offsite-psych, the rest
// drop60-draft), and the Offsite cut on every other track too, so it holds on any plan.
const PAIRS = [...TRACK_ORDER.map(t => [t, treatmentFor(t).id]), ...TRACK_ORDER.filter(t => treatmentFor(t).id !== 'offsite-psych').map(t => [t, 'offsite-psych'])];
const keyOf = (track, format, tid) => `${track}|${format}|${tid}`;
const nameOf = (track, format, tid) => `${track} ${format}${tid === treatmentFor(track).id ? '' : ` (${tid})`}`;
ok(treatmentFor('offsite').id === 'offsite-psych' && TRACK_ORDER.filter(t => t !== 'offsite').every(t => treatmentFor(t).id === DEFAULT_TREATMENT && DEFAULT_TREATMENT === 'drop60-draft') && Object.keys(BY_TRACK).every(t => TREATMENTS[BY_TRACK[t]]),
  `treatments by track: ${TRACK_ORDER.map(t => `${t} ${treatmentFor(t).id}`).join(', ')}`);
const who = l => (l.shotId && idx.get(l.shotId)?.characters) || [];
const is = (l, re) => who(l).some(c => re.test(c));
const programs = {}, plans = {};

// ---- 1. canon on every frame ----------------------------------------------------------------------
for (const track of TRACK_ORDER) plans[track] = planOf(track);
for (const [track, tid] of PAIRS) {
  const plan = plans[track], {black:B, impact:I} = chokeFrames(plan), TR = TREATMENTS[tid];
  for (const format of ['9:16', '1:1', '16:9']) {
    const edl = TR.fn(plan, SHOTS, {format}), p = programs[keyOf(track, format, tid)] = compile(edl, {plan, shots:SHOTS, format}), label = nameOf(track, format, tid);
    ok(p.lint.ok, `${label}: ${tid} compiles with 0 lint errors (${p.lint.warnings.length} warnings)${p.lint.ok ? '' : `: ${p.lint.errors.slice(0, 2).map(e => e.message).join('; ')}`}`);
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
    ok(black && p.frame(B - 1).board.rect && ign.layers.some(l => l.fx.some(x => x.type === 'pegVideo')) && ign.board.screen >= 0, `${label}: the black tile from the choke, the board dark from frame ${B} (her tag heard to ${(plan.choke.tagEnd + audioLatency(plan)).toFixed(4)} s, ${(plan.choke.tagEnd + CHOKE_TAIL + audioLatency(plan)).toFixed(4)} s through a codec), the ignition on frame ${I}`);
    const f0 = p.frame(0);
    ok(f0.transport?.kind === 'jump' && f0.transport.sound === 'copied' && f0.layers.some(l => l.fx.some(x => x.type === 'pegVideo')) && p.board.screens[f0.board.screen]?.kind === 'impact' && p.transports.some(t => t.kind === 'rewind' && t.sound === 'reversed'), `${label}: the cold open: frame 0 is the impact (its sound copied there), then the rewind with its sound reversed`);
    // The cold open's sound is the impact without Synergy (engine.js coldSourcePlan): the board shows
    // only what is heard. No frame of the copied jump has one of his screens up (his Drop A "LET'S"
    // read ahead or lit); the board holds on BACK. instead, as the compositor paints it (boardTimeOf).
    const jump = p.all.filter(x => x.transport?.kind === 'jump' && x.transport.sound === 'copied');
    const his = jump.filter(x => [x.board.screen, p.board.screens.indexOf(activeScreen(boardScreens(p.board.screens), boardTimeOf(x)))].some(i => p.board.screens[i]?.voice === 'synergy'));
    const held = jump.filter((x, i) => i && x.board.time === jump[i - 1].board.time).length;
    ok(jump.length >= 17 && !his.length && jump.every(x => p.board.screens[x.board.screen]?.kind === 'impact'), `${label}: the cold open's board shows only what is heard: BACK. on all ${jump.length} copied frames, none of Synergy's words (held for the last ${held})${his.length ? `; his on f${his.map(x => x.f).join(', f')}` : ''}`);
    // The rewind plays the second before the choke backwards: its board looks back over the span each
    // frame plays (v down to v − rate/24), so no frame shows a screen that starts at or after the moment
    // it rewinds from (her tag starts on the choke, where the rewind begins: its "L" never shows).
    const rw = p.all.filter(x => x.transport?.kind === 'rewind'), ahead = rw.filter(x => [x.board.screen, p.board.screens.indexOf(activeScreen(boardScreens(p.board.screens), boardTimeOf(x)))].some(i => i >= 0 && p.board.screens[i].from >= x.time - 1e-9));
    ok(rw.length >= 5 && !ahead.length && rw.every(x => p.board.screens[x.board.screen]?.kind !== 'tag'), `${label}: the rewind's board looks back: none of its ${rw.length} frames (f${rw[0]?.f}-f${rw.at(-1)?.f}) shows a screen from its own moment or later (${rw.map(x => p.board.screens[x.board.screen]?.text ?? 'none').filter((v, i, a) => a.indexOf(v) === i).join(', ')})${ahead.length ? `; ahead on f${ahead.map(x => x.f).join(', f')}` : ''}`);
    // A steady board: every call layout keeps it at the format's home; it changes only inside the
    // draft's board moves (each at least 3 frames, no frame taking half of the change), never on a cut.
    const offHome = p.all.filter(x => x.layout && x.layout !== 'full' && !FULL_BOARD.includes(x.layout) && x.board.rect && !x.board.move && !sameRect(x.board.rect, HOME[format]));
    const moving = p.all.filter(x => x.board.move), jumps = [];
    for (let f = 1; f < p.frames; f++) { const a = p.frame(f - 1).board, b = p.frame(f).board; if (a.rect && b.rect && !sameRect(a.rect, b.rect) && !p.boardMoves.some(m => f >= m.from && f < m.to)) jumps.push(f); }
    const steps = p.boardMoves.map(m => { const r = f => p.frame(f).board.rect, ar = x => x ? x.w * x.h : 0, all = Math.abs(ar(r(m.to - 1)) - ar(r(m.from - 1))); let worst = 0; for (let f = m.from; f < m.to; f++) worst = Math.max(worst, Math.abs(ar(r(f)) - ar(r(f - 1)))); return all ? worst / all : 0; });
    ok(!offHome.length && p.boardMoves.length >= (tid === 'drop60-draft' ? 5 : 3) && p.boardMoves.every(m => m.to - m.from >= 3) && moving.length > 0 && Math.max(...steps) < .5 && !jumps.length && p.lint.errors.every(e => e.rule !== 'G14'),
      `${label}: the board holds its home in every call layout and moves only in ${p.boardMoves.length} eased board moves of ${[...new Set(p.boardMoves.map(m => m.to - m.from))].join('/')} frames (largest step ${(100 * Math.max(...steps)).toFixed(0)} % of a move; ${jumps.length} jumps, ${offHome.length} frames off home)`);
  }
}

// ---- 1a. the choke keeps its silence on screen: at least 7 black frames before the impact --------------------
// The choke's black waits CHOKE_TAIL (30 ms) past her tag for the encoder's floor after a hard cut; every
// track, the sample post and every fixture post with the cast it would choose, still has 7 or more frames
// of true black before the impact frame.
{
  const posts = [SAMPLE_POST, ...JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/pixel-posts.json'), 'utf8')).map(x => x.post)];
  for (const track of TRACK_ORDER) {
    let fewest = Infinity, worst = null;
    for (const post of posts) {
      const c = castSong(post, {track}), {plan} = settleCast(FORMS.drop60.arrange, lyricsFromPost(post), {}, {track, cast:c.cast, coldOpen:true}), {black:B, impact:I} = chokeFrames(plan);
      if (I - B < fewest) { fewest = I - B; worst = `${B}-${I - 1}`; }
    }
    ok(fewest >= 7, `${track}: at least 7 black frames before the impact on all ${posts.length} posts with their casts (fewest ${fewest}, frames ${worst}; her tag plus the choke's ${(CHOKE_TAIL * 1000).toFixed(0)} ms codec tail)`);
  }
}

// ---- 1b. Synergy's mouth whenever he sings on screen ------------------------------------------------------
// Every frame his voice is on (his words and stammers) and a layer shows him: a tracked shot with its
// mouth row inside its tile and inside the frame through the camera, or his original take (its own
// mouth). An untracked shot with him in it must be framed off him (the applause close-up: his head and
// headset reach x 640 of 1916 over the frames the draft plays). Echo taps of a dub delay count only beside his full tile;
// a tile the camera carries more than half out of frame (the Droste dive) is off screen.
{
  const UNTRACKED = {'corporate-applause-closer-reaction-531fa4a4':[0, 650], 'corporate-applause-vhs-cameraman-a018b1c9':[0, 1280], 'office-ensemble-e03c9edb':[380, 800]};
  for (const [track, tid] of PAIRS) for (const format of ['9:16', '1:1', '16:9']) {
    const plan = plans[track], p = programs[keyOf(track, format, tid)], spans = [];
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
    ok(frames > 300 && !bad.length, `${nameOf(track, format, tid)}: Synergy's mouth row shows on all ${frames} frames he sings on screen (${bad.slice(0, 3).join('; ')})`);
  }
}

// ---- 1d. the band and the river: each track on its own form with the post's cast --------------------------
// The studio films each track on its own form (forms.js formOf: Offsite plays the river) with the post's cast
// from the voice bank (castSong available), the sample's here: the band's tiles (Strategy and Synthia speaking)
// on the Drop Edition, the river's cut on Offsite. Canon on every frame in every format (Pat never on video, the
// lady never footage, no warp on Synergy, robots never mirrored, no unflagged mirror, no R0 footage backwards
// outside a rewind the sound reverses with), Synergy's mouth row on every frame he sings on screen, and the
// lady's tile never a picture: her waveform on a camera-off card.
{
  for (const track of TRACK_ORDER) {
    const form = formOf(track), cast = castSong(SAMPLE_POST, {track, available:AVAILABLE}).cast;
    const plan = settleCast(FORMS[form].arrange, lyrics, {}, {track, cast, coldOpen:form === 'drop60'}).plan, TR = treatmentFor(track);
    for (const format of ['9:16', '1:1', '16:9']) {
      const p = compile(TR.fn(plan, SHOTS, {format}), {plan, shots:SHOTS, format}), label = `${track} ${format} (${form}, the sample's cast)`;
      const waived = new Set(p.lint.warnings.filter(w => w.rule === 'G11' && /waived/.test(w.message)).map(w => w.clipId));
      const bad = {pat:0, lady:0, warp:0, robotMirror:0, r0:0, mirror:0, ladyFace:0, mouth:[]};
      let band = 0, sung = 0;
      const spans = (plan.words || []).map(w => { const t = plan.timing[w.at]; return [t, Math.min(t + (w.gate ?? plan.step * (w.steps ?? 1)), plan.timing[w.at + (w.steps ?? 1)] ?? Infinity)]; });
      for (let f = 0; f < p.frames; f++) {
        const fr = p.frame(f), reversedSound = fr.transport?.kind === 'rewind' && fr.transport.sound === 'reversed';
        for (const l of fr.layers) {
          if (/circle back|\blady\b/i.test(l.chrome?.name ?? '') && l.kind === 'video') bad.ladyFace++;
          const s = l.shotId && idx.get(l.shotId);
          if (!s) continue;
          if (l.clipId.startsWith('band.') && (l.chrome?.speaking ?? 0) >= .5) band++;
          if (is(l, /^pat$/i)) bad.pat++;
          if (is(l, /lady|circle back/i)) bad.lady++;
          if (is(l, /^(synergy|synthia)$/i) && (l.transform.mirror || l.fx.some(x => x.type === 'tile' && x.mirror))) bad.robotMirror++;
          if (l.reverse && s.reverseClass === 'R0' && !reversedSound) bad.r0++;
          const mirrored = l.transform.mirror || l.fx.some(x => FX[x.type]?.mirrors === true || (typeof FX[x.type]?.mirrors === 'function' && FX[x.type].mirrors(x)));
          if (mirrored && ((s.action || []).includes('play') || !s.mirrorable) && !waived.has(l.clipId)) bad.mirror++;
          if (is(l, /^synergy$/i) && l.fx.some(x => FX[x.type]?.warps)) bad.warp++;
        }
        // His mouth row whenever he sings with his tile on screen and nothing in a transport.
        if (fr.transport || !spans.some(([a, b]) => fr.time >= a && fr.time < b)) continue;
        const his = fr.layers.filter(l => is(l, /^synergy$/i) && !/original-take|applause|ensemble/.test(l.shotId) && l.opacity > .99 && !l.trail && !fr.camera);
        for (const l of his) { const m = l.robot?.mouth; sung++; if (!(m && m.x - m.w / 2 >= l.cell.x && m.x + m.w / 2 <= l.cell.x + l.cell.w && m.y - m.h / 2 >= l.cell.y && m.y + m.h / 2 <= l.cell.y + l.cell.h)) bad.mouth.push(f); }
      }
      ok(p.lint.ok && !bad.pat && !bad.lady && !bad.ladyFace && !bad.warp && !bad.robotMirror && !bad.r0 && !bad.mirror,
        `${label}: ${TR.id} compiles with 0 lint errors; on all ${p.frames} frames Pat is never on video, the lady never footage (her tile a waveform), no warp on Synergy, no robot or unflagged shot mirrored, no R0 footage backwards outside the rewind${form === 'drop60' ? `; Strategy and Synthia speaking in band tiles on ${band} frames` : ''}`);
      ok(sung > 0 && !bad.mouth.length, `${label}: Synergy's mouth row in his tile on all ${sung} layer-frames he sings at full${bad.mouth.length ? `; out on f${bad.mouth.slice(0, 4).join(', f')}` : ''}`);
    }
  }
}

// ---- 1c. the ending: "FULL STOP." heard and shown, black after it, the ghost BACK. -----------------------
// Her stop phrase is routed after the tape, so it outlasts the tape stop. In the delivered file it is
// heard from its onset (plus the engine's latency) to its end (plan.stop.end, else her envelope's end,
// plus the codec's tail and the latency): every frame that holds any of that shows "FULL STOP." lit on
// the board, fully typed on the last one; black starts on the first frame after it; the last two
// frames (or what is left of them) show frame 0's BACK. as a ghost at I .08, on frame 0's pegs.
{
  const gridOf = (fr, format, pitch) => boardGrid(Math.round(fr.board.rect.w), Math.round(fr.board.rect.h), pitch ?? boardPitch(Math.round(fr.board.rect.w), Math.round(fr.board.rect.h)), safeSpan(fr.board.rect, SAFE[format]));
  const pitchOf = fr => fr.layers.find(l => l.fx.some(x => x.type === 'pegVideo' && x.mix >= .5))?.fx.find(x => x.type === 'pegVideo').pitch;
  const painted = (p, plan, fr, format) => { const g = gridOf(fr, format, pitchOf(fr)); paint(g.board, boardScreens(p.board.screens), boardTimeOf(fr), {plan, layoutOf:g.layoutOf, place:g.place}); return g; };
  const pegsOf = (g, screen) => { const layout = g.layoutOf(screen), page = layout.pages[0], o = g.place(screen, layout, page), out = new Set(); for (const ch of page.lines.flatMap(l => l.chars)) for (let i = 0; i < ch.pegs.length; i += 2) out.add((o.y + ch.pegs[i + 1]) * g.cols + o.x + ch.pegs[i]); return out; };
  for (const [track, tid] of PAIRS) for (const format of ['9:16', '1:1', '16:9']) {
    const plan = plans[track], p = programs[keyOf(track, format, tid)], label = nameOf(track, format, tid), L = audioLatency(plan), N = p.frames;
    const her = stopFrames(plan), ev = plan.lady.find(e => e.role === 'stop'), heardFrom = plan.timing[Math.floor(ev.at)] + (ev.at % 1) * plan.step + L, heardTo = her.end + TAG_TAIL + L;
    const stop = plan.tape.find(x => x.kind === 'stop'), curve = Math.round(plan.timing[stop.from] * FPS) + Math.ceil(stop.seconds * FPS - 1e-9), B = Math.max(curve, her.black), G = Math.max(N - 2, B);
    const black = fr => fr.layers.every(l => l.gen === 'color:#000000') && !fr.board.rect;
    // Frames against the sound: no frame that holds any of her phrase is black, and each shows it lit.
    const overBlack = [], unlit = [];
    for (let f = Math.floor(heardFrom * FPS); f < N && f / FPS < heardTo; f++) {
      const fr = p.frame(f);
      if (black(fr) || fr.board.dark) { overBlack.push(f); continue; }
      const s = p.board.screens[fr.board.screen];
      if (s?.kind !== 'stop') { unlit.push(`f${f} screen ${s?.kind ?? 'none'}`); continue; }
      const g = painted(p, plan, fr, format), lit = [...g.board.I].filter(v => v > .05).length;
      if (!lit || g.board.exposure < STOP_DIM - 1e-9) unlit.push(`f${f} ${lit} pegs at ${g.board.exposure.toFixed(2)}`);
    }
    ok(!overBlack.length && !unlit.length && B === her.black && B > Math.floor(heardFrom * FPS), `${label}: "${ev.display}" heard ${heardFrom.toFixed(3)}-${heardTo.toFixed(3)} s in the file, never over black (frames ${Math.floor(heardFrom * FPS)}-${B - 1} all show it lit${overBlack.length ? `; over black on ${overBlack.slice(0, 3).join(', ')}` : ''}${unlit.length ? `; ${unlit.slice(0, 3).join(', ')}` : ''})`);
    // Fully typed on the last frame she is heard in.
    const last = p.frame(B - 1), sScreen = p.board.screens[last.board.screen], g = painted(p, plan, last, format), want = pegsOf(g, sScreen);
    const litSet = [...g.board.I].map((v, i) => v > .05 ? i : -1).filter(i => i >= 0), mean = litSet.reduce((a, i) => a + g.board.I[i], 0) / Math.max(1, litSet.length) * g.board.exposure;
    ok(sScreen.text === ev.display && litSet.length === want.size && litSet.every(i => want.has(i)) && mean >= .5, `${label}: "${sScreen.text}" fully typed on frame ${B - 1}, her last (${litSet.length} of ${want.size} pegs, mean light ${mean.toFixed(2)})`);
    ok(p.all.slice(B, G).every(black) && (B === G || !p.frame(B - 1).layers.every(l => l.gen === 'color:#000000')), B < G ? `${label}: true black on ${B}-${G - 1} (${G - B} frame${G - B === 1 ? '' : 's'}), from the first frame after her` : `${label}: no true black before the loop seam: she is heard to frame ${B - 1}, the ghost takes what is left`);
    // His last close-up holds a frame with his eyes open (robot-tracks.json blinks, a frame of lid either side).
    const shut = [];
    for (const fr of p.all) for (const l of fr.layers) {
      const blinks = (l.robot && l.source === 'still' && is(l, /^synergy$/i) && TRACKING[idx.get(l.shotId)?.robot]?.blinks) || null;
      if (blinks?.some(([a, b]) => l.srcFrame >= a - 1 && l.srcFrame <= b + 1)) shut.push(`f${fr.f} src ${l.srcFrame}`);
    }
    const held = p.all.filter(fr => fr.transport?.kind === 'tapestop').flatMap(fr => fr.layers.filter(l => l.source === 'still' && is(l, /^synergy$/i)).map(l => l.srcFrame));
    ok(!shut.length && held.length > 0, `${label}: every held frame of Synergy has his eyes open (the tape stop holds source frame ${[...new Set(held)].join(', ')}${shut.length ? `; shut on ${shut.slice(0, 3).join(', ')}` : ''})`);
    // The ghost BACK.: frame 0's screen and grid, its letters only, at I .08, on black.
    const f0 = p.frame(0), s0 = p.board.screens[f0.board.screen], g0 = gridOf(f0, format, pitchOf(f0)), mask = pegsOf(g0, s0), bad = [];
    for (let f = G; f < N; f++) {
      const fr = p.frame(f), s = p.board.screens[fr.board.screen], gg = painted(p, plan, fr, format), on = [...gg.board.I].map((v, i) => v > 0 ? i : -1).filter(i => i >= 0);
      if (!s?.ghost || s.of !== s0.of || fr.layout !== f0.layout || gg.cols !== g0.cols || gg.rows !== g0.rows || gg.pitch !== g0.pitch || on.length !== mask.size || !on.every(i => mask.has(i) && Math.abs(gg.board.I[i] - GHOST) < 1e-6) || gg.board.sockets !== 0 || !fr.layers.every(l => l.gen === 'color:#000000')) bad.push(f);
    }
    ok(N - G === Math.min(2, N - B) && !bad.length && !p.lint.warnings.some(w => w.rule === 'G12'), `${label}: frames ${G}-${N - 1} show frame 0's ${s0.text} as a ghost: its ${mask.size} pegs on frame 0's grid (pitch ${g0.pitch}), at I ${GHOST}, on black (G12 clean${bad.length ? `; wrong on ${bad.join(', ')}` : ''})`);
  }
}

// ---- 1d. the applause tile keeps People & Culture's face, off Synergy, in every format ----------------------
for (const [track, tid] of PAIRS) for (const format of ['9:16', '1:1', '16:9']) {
  const p = programs[keyOf(track, format, tid)], cut = [], windows = new Set();
  let n = 0;
  for (const fr of p.all) for (const l of fr.layers) {
    if (!l.shotId?.startsWith('corporate-applause-closer')) continue;
    n++;
    const c = l.cell, pts = [[c.x, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h], [c.x + c.w, c.y]].map(([x, y]) => apply(l.transform.matrix, x, y));
    const x0 = Math.min(...pts.map(q => q[0])), x1 = Math.max(...pts.map(q => q[0])), y0 = Math.min(...pts.map(q => q[1])), y1 = Math.max(...pts.map(q => q[1])), F = CLAP.face;
    windows.add(`${Math.round(x0)}-${Math.round(x1)} x ${Math.round(y0)}-${Math.round(y1)}`);
    if (x0 > F.x + 1e-6 || x1 < F.x + F.w - 1e-6 || y0 > F.y + 1e-6 || y1 < F.y + F.h - 1e-6 || x0 < CLAP.left - 1e-6) cut.push(`f${fr.f}`);
  }
  ok(!cut.length && (n > 0 || track === 'hustle' || tid !== 'drop60-draft'), `${nameOf(track, format, tid)}: the applause tile holds People & Culture's whole face (x ${CLAP.face.x}-${CLAP.face.x + CLAP.face.w}, y ${CLAP.face.y}-${CLAP.face.y + CLAP.face.h}) and stays right of x ${CLAP.left}, off Synergy, on all ${n} layer-frames (source ${[...windows].join('; ') || 'none'})${cut.length ? `; cut on ${cut.slice(0, 3).join(', ')}` : ''}`);
}

// ---- 1e. no partial words: a typewriter phrase is whole on the board from its first frame ------------------
// Her tag ("LET'S CIRCLE-"), her whole-phrase rungs ("LET'S BUILD."), "FULL STOP." and the board's own
// titles type in letter by letter over a dim read-ahead ghost of the whole phrase (choreo READ_AHEAD, as
// Synergy's lines): on every frame that shows one, every peg of its page is lit, ghost or typed.
{
  const gridOf = (fr, format) => { const pv = fr.layers.find(l => l.fx.some(x => x.type === 'pegVideo' && x.mix >= .5))?.fx.find(x => x.type === 'pegVideo').pitch, w = Math.round(fr.board.rect.w), h = Math.round(fr.board.rect.h); return boardGrid(w, h, pv ?? boardPitch(w, h), safeSpan(fr.board.rect, SAFE[format])); };
  for (const [track, tid] of PAIRS) for (const format of ['9:16', '1:1', '16:9']) {
    const plan = plans[track], p = programs[keyOf(track, format, tid)], shifted = boardScreens(p.board.screens), holes = [], kinds = new Map();
    let frames = 0, partial = 0;
    for (const fr of p.all) {
      if (!fr.board.rect || fr.board.dark) continue;
      const t = boardTimeOf(fr), s = activeScreen(shifted, t);
      if (!s || s.reveal !== 'typewriter' || s.voice === 'synergy' || s.ghost || t >= s.to) continue;
      const g = gridOf(fr, format); paint(g.board, shifted, t, {plan, layoutOf:g.layoutOf, place:g.place});
      if (g.board.exposure <= 0) continue;
      const layout = g.layoutOf(s); if (!layout?.pages?.length) continue;
      let page = layout.pages[0]; for (const pg of layout.pages) { const c0 = pg.lines[0]?.chars[0]; if (c0 && s.words[c0.word]?.start <= t + .001) page = pg; }
      const o = g.place(s, layout, page), want = [];
      for (const ch of page.lines.flatMap(l => l.chars)) for (let i = 0; i < ch.pegs.length; i += 2) want.push((o.y + ch.pegs[i + 1] + (s.fx.rowShift || 0)) * g.cols + o.x + ch.pegs[i]);
      frames++; kinds.set(s.kind, (kinds.get(s.kind) || 0) + 1);
      const dark = want.filter(i => !(g.board.I[i] > 0)).length;
      if (dark) holes.push(`f${fr.f} ${s.text} ${dark} of ${want.length}`);
      if (want.some(i => g.board.I[i] > 0 && g.board.I[i] <= .1 + 1e-9)) partial++;
    }
    ok(frames > 20 && !holes.length, `${nameOf(track, format, tid)}: no partial words: all ${frames} typewriter frames (${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}) show the whole phrase, ${partial} of them with letters still to type as the read-ahead ghost${holes.length ? `; holes on ${holes.slice(0, 3).join('; ')}` : ''}`);
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
  const plan = plans[track], p = programs[keyOf(track, format, sidecar?.treatment ?? treatmentFor(track).id)];
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
    let last = null; for (let i = ix(plan.choke.time); i < ix(impactT - .01); i++) if (peak(i) > 10 ** (-70 / 20)) last = t0 + i / sr;
    ok(last !== null && last < B / FPS, `her tag sounds until ${last?.toFixed(4)} s, before the picture goes black at frame ${B} (${(B / FPS).toFixed(4)} s): no voice over black`);
    let run = 0, best = [0, 0];
    for (let i = ix(plan.choke.time + .2), s = i; i < ix(impactT + .1); i++) { if (peak(i) < 10 ** (-70 / 20)) { if (++run > best[1] - best[0]) best = [s, i + 1]; } else { run = 0; s = i + 1; } }
    const silent = (best[1] - best[0]) / sr * 1000;
    ok(silent >= 300, `the silence before the impact: ${silent.toFixed(0)} ms below -70 dBFS (${(t0 + best[0] / sr).toFixed(3)}-${(t0 + best[1] / sr).toFixed(3)} s)`);
  }
  // The ending, against the file's own sound: her "Full stop." stops before the first black frame and
  // the ghost; every frame she is heard in is lit (the board), every black frame is true black.
  const her = stopFrames(plan), ev = plan.lady.find(e => e.role === 'stop'), N = p.frames;
  if (her && from <= her.onset && to >= N) {
    const stop = plan.tape.find(q => q.kind === 'stop'), B2 = Math.max(Math.round(plan.timing[stop.from] * FPS) + Math.ceil(stop.seconds * FPS - 1e-9), her.black), G2 = Math.max(N - 2, B2);
    let last = null; for (let i = ix(plan.timing[Math.floor(ev.at)] + (ev.at % 1) * plan.step); i < Math.min(x.length / 2, ix(N / FPS)); i++) if (peak(i) > 10 ** (-70 / 20)) last = t0 + i / sr;
    const litY = Math.min(...Y.slice(at(her.onset), at(B2))), darkY = B2 < G2 ? Math.max(...Y.slice(at(B2), at(G2))) : 0, darkPx = B2 < G2 ? Math.max(...maxPx.slice(at(B2), at(G2))) : 0;
    ok(last !== null && last < B2 / FPS && last < G2 / FPS && litY > darkY + 1e-3 && darkY < 1e-4 && darkPx <= 2, `the ending: "${ev.display}" sounds until ${last?.toFixed(4)} s, before frame ${B2} (${(B2 / FPS).toFixed(4)} s): never over black; frames ${her.onset}-${B2 - 1} lit (luminance at least ${litY.toFixed(4)})${B2 < G2 ? `, true black on ${B2}-${G2 - 1} (max pixel ${darkPx})` : ''}, the ghost from ${G2} (${Y[at(G2)].toExponential(1)})`);
  }
  if (from === 0) {
    const onset = onsetIn(0, .12), lead = onset * 1000;
    ok(lead >= 0 && lead < 1000 / FPS && Y[0] > .3 && Y[1] < Y[0], `the cold open: frame 0 ignites (${Y[0].toFixed(3)}, then ${Y[1].toFixed(3)}) and its sound starts ${lead.toFixed(1)} ms in (0 to under one frame)`);
  }
}
console.log(`check-review-video: ${checks} checks passed in ${((Date.now() - t00) / 1000).toFixed(1)} s`);
