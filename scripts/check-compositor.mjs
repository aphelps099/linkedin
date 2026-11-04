// The compositor (src/videostudio/gl/), the preview's element pool and stutter cache, and
// the studio's draft cut. Node checks first, then headless Chromium on SwiftShader WebGL2.
//   1. the draft cut compiles clean in every format; Pat and the lady are never footage
//   2. pegs are hits: they light on floor((t + L)·24), the frame that holds their sound (L: the engine's
//      measured latency, edl/anchors.js AUDIO_LATENCY): the board's paint time for every frame
//   3. cell geometry and rounded masks, by pixel probes at full size
//   4. every effect of the vocabulary changes pixels the way it says
//   5. chrome: name bar, speaking border, toast, banner, Pat's camera-off tile, the lady's tile
//   6. the board layer appears where scheduled (strip, tile, over a full frame), true black, ignition
//   7. same-origin proxies upload with texImage2D; the reversed proxy's frame N-1-k is frame k
//   8. the element pool and the stutter cache (budget, exact frames)
//   9. determinism: two fresh pages, the same frames, the same SHA-256 (synthetic and real footage)
//  10. performance on SwiftShader (informational: CPU-emulated GL only compares settings)
// node scripts/check-compositor.mjs [--out DIR] [--verbose] [--quick]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {FORMS} from '../src/allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {compile, shotIndex} from '../src/videostudio/edl/compile.js';
import {FX_TYPES} from '../src/videostudio/edl/schema.js';
import {pegFrame, audioLatency} from '../src/videostudio/edl/anchors.js';
import {studioFilm} from '../src/videostudio/studio-film.js';
import {boardGrid} from '../src/videostudio/gl/board-layer.js';
import {PEG_PAINT_LEAD, FX_SUPPORT, boardScreens, boardTimeOf} from '../src/videostudio/gl/compositor.js';
import {paint} from '../src/pegboard/choreo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), verbose = argv.includes('--verbose'), quick = argv.includes('--quick');
const OUT = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(os.tmpdir(), 'check-compositor');
fs.mkdirSync(OUT, {recursive:true});
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; if (verbose) console.log('  ok', m); };
const log = s => console.log(s);
const t00 = Date.now();

// ---- 1. the draft cut, in Node ------------------------------------------------------------------
const SHOTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/videostudio/media/shots.json'), 'utf8'));
const lyrics = lyricsFromPost(SAMPLE_POST), form = FORMS.drop60, plan = form.arrange(lyrics, {});
const index = shotIndex(SHOTS);
{
  const before = checks;
  for (const format of ['9:16', '1:1', '16:9']) {
    const p = compile(studioFilm(plan, SHOTS, {format}), {plan, shots:SHOTS});
    ok(p.lint.errors.length === 0, `draft cut ${format}: ${p.clips.length} clips compile with no lint errors (${p.lint.errors.slice(0, 3).map(e => `${e.rule} ${e.message}`).join('; ')})`);
    ok(p.frames === 1440 && p.decode.max <= 8, `draft cut ${format}: 1,440 frames, peak ${p.decode.max} live decodes (desktop ceiling 8)`);
    const layers = p.all.flatMap(f => f.layers);
    const pat = layers.filter(l => l.gen === 'camera-off' || l.chrome?.name === 'Pat');
    ok(pat.length > 100 && pat.every(l => l.kind === 'generated'), `draft cut ${format}: Pat's ${pat.length} tile-frames are all generated, never footage`);
    ok(layers.every(l => !l.shotId || !(index.get(l.shotId)?.characters || []).some(c => /^pat$|lady|circle back/i.test(c))), `draft cut ${format}: no layer shows Pat or the lady on video`);
    const want = ['gridBloom', 'vocalCut', 'retriggerRoll', 'pegTakeover', 'snarePunch', 'speakerChase', 'tapeCoupling', 'leaveMeeting'];
    const ids = new Set(studioFilm(plan, SHOTS, {format}).clips.map(c => c.origin));
    ok(want.every(m => ids.has(`move:${m}`) || (m === 'snarePunch' && p.all.some(f => f.layers.some(l => /^(chaseC|pads)\./.test(l.clipId) && l.transform.zoom > 1.01)))), `draft cut ${format}: built from the moves (${want.join(', ')})`);
    if (format === '9:16') {
      const black = p.all.slice(Math.round(plan.timing[plan.choke.at] * 24), 960).every(f => f.layers.every(l => l.gen === 'color:#000000'));
      ok(black && p.frame(960).layers.some(l => l.fx.some(x => x.type === 'pegVideo')), 'draft cut: black from the choke to frame 959, peg video at the impact (frame 960)');
      ok(p.board.screens[p.frame(0).board.screen]?.text === 'BACK.' && p.frame(0).board.rect?.h === 1920, 'draft cut: frame 0 opens on BACK. over the whole frame');
    }
  }
  ok(FX_TYPES.every(t => FX_SUPPORT[t]), `every effect type has a compositor implementation (${FX_TYPES.length}: ${FX_TYPES.join(', ')})`);
  log(`1. the draft cut: ${checks - before} checks`);
}

// ---- 2. peg timing ----------------------------------------------------------------------------------
{
  const before = checks, p = compile(studioFilm(plan, SHOTS, {format:'9:16'}), {plan, shots:SHOTS});
  const grid = boardGrid(1056, 408);
  const lit = (screen, f) => { paint(grid.board, [screen], f / 24 + PEG_PAINT_LEAD, {plan, layoutOf:grid.layoutOf, place:grid.place}); let n = 0; for (const v of grid.board.I) if (v > .05) n++; return n; };
  const tested = [], painted = boardScreens(p.board.screens);
  for (const s of painted) {
    if (s.voice !== 'lady' || !['pop', 'typewriter', 'steady'].includes(s.reveal) || !grid.layoutOf(s)) continue;
    const start = Math.min(...s.words.flatMap(w => w.units.map(u => u.start))), f = pegFrame(start);
    if (start - (s.from + 1 / 48) > 1e-6 || f < 1) continue;
    tested.push({text:s.text, start, f, before:lit(s, f - 1), at:lit(s, f)});
  }
  ok(tested.length >= 10 && tested.every(x => x.before === 0 && x.at > 0), `pegs light on the frame that holds their sound, floor((t + L)·24), never a frame late or early: ${tested.length} of the lady's onsets (${tested.slice(0, 3).map(x => `${x.text} ${x.start.toFixed(3)} s → f${x.f}`).join(', ')})`);
  ok(Math.abs(PEG_PAINT_LEAD - (1 / 48 - 720 / 44100)) < 1e-12 && Math.abs(boardTimeOf(p.frame(100)) - (100 / 24 + 1 / 48 - audioLatency(plan))) < 1e-12 && painted.every((s, i) => Math.abs(p.board.screens[i].from - s.from - 1 / 48) < 1e-12), 'frame f paints the board at f/24 + 1/48 − L (L 16.33 ms), its screens half a frame early (choreo paints the middle of a frame)');
  log(`2. peg timing: ${checks - before} checks`);
}

// ---- the browser --------------------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const express = require('express');
const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('check-compositor needs Playwright'); })();
const {createVideoStudioRouter} = await import('../server/videostudio.js');
const app = express();
app.get('/', (_q, r) => r.type('html').send('<!doctype html><meta charset="utf-8"><title>check-compositor</title><body style="margin:0;background:#000"></body>'));
app.use('/api/videostudio', createVideoStudioRouter());
app.use(express.static(ROOT, {index:false}));
app.use(express.static(path.join(ROOT, 'public'), {index:false}));
const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
const errors = [];
async function freshPage() {
  const page = await browser.newPage({viewport:{width:600, height:400}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(origin + '/');
  await page.evaluate(HARNESS);
  await page.evaluate(() => window.T.init());
  return page;
}
const savePng = (name, dataUrl) => { const file = path.join(OUT, name); fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); return file; };

// Page-side helpers: modules, test cards, fixture shots, rendering and pixel statistics.
const HARNESS = `(() => {
  const T = window.T = {};
  T.init = async () => {
    const m = s => import(s);
    Object.assign(T, await m('/src/videostudio/edl/compile.js'), await m('/src/videostudio/edl/schema.js'), await m('/src/videostudio/layouts.js'), await m('/src/videostudio/gl/compositor.js'),
      {studioFilm:(await m('/src/videostudio/studio-film.js')).studioFilm, drop60Draft:(await m('/src/videostudio/treatments/drop60-draft.js')).drop60Draft}, await m('/src/videostudio/media/element-pool.js'), await m('/src/videostudio/media/stutter-cache.js'), await m('/src/videostudio/media/decoder.js'));
    const {FORMS} = await m('/src/allhands/forms.js'), L = await m('/src/allhands/lyrics.js');
    T.plan = FORMS.drop60.arrange(L.lyricsFromPost(L.SAMPLE_POST), {});
    T.SHOTS = await (await fetch('/src/videostudio/media/shots.json')).json();
    T.real = T.shotIndex(T.SHOTS);
    T.fixture = ['card', 'card2', 'card3'].map(id => ({id, width:1280, height:720, fps:24, frames:240, duration:10, contentBox:[0, 0, 1280, 720], status:'C', characters:['Tester'], action:['listen'], roles:['listener'], reverseClass:'R1', mirrorable:true, sharpTier:'A', shotType:'plate'}));
  };
  // A test card: saturated gradient, sharp vertical bars, a black rule, a checker. Integer rects only.
  const cards = new Map();
  T.card = id => {
    if (cards.has(id)) return cards.get(id);
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d');
    const hue0 = id === 'card' ? 0 : id === 'card2' ? 120 : 240;
    for (let x = 0; x < 1280; x += 16) { g.fillStyle = 'hsl(' + ((hue0 + x * 300 / 1280) % 360) + ',85%,' + (38 + (x % 256) / 16) + '%)'; g.fillRect(x, 0, 16, 720); }
    g.fillStyle = '#fff'; for (const x of [320, 640, 960]) g.fillRect(x, 0, 16, 720);
    g.fillStyle = '#000'; g.fillRect(0, 352, 1280, 16);
    for (let y = 0; y < 320; y += 40) for (let x = 0; x < 320; x += 40) if ((x + y) / 40 % 2) { g.fillStyle = '#111'; g.fillRect(x, y, 40, 40); }
    cards.set(id, c); return c;
  };
  T.sources = (calls = []) => (layer, i) => { calls.push(layer); return layer.shotId ? {image:T.card(layer.shotId), key:layer.shotId, version:1} : null; };
  T.program = (clips, {format = '9:16', frames = 48, board = [], camera, shots} = {}) => T.compile(T.createEDL({format, clips, board, camera}), {plan:T.plan, shots:shots ?? T.fixture, frames});
  T.comps = new Map();
  T.comp = (scale = 1, post = 'off', format = '9:16') => {
    const key = scale + '|' + post + '|' + format;
    if (!T.comps.has(key)) {
      const canvas = document.createElement('canvas'); document.body.append(canvas);
      const c = T.createCompositor(canvas, {format, scale, preserveDrawingBuffer:true, post:post === 'off' ? {bloom:{...T.POST.bloom, weight:0}, grain:0, dither:false} : {}});
      T.comps.set(key, c);
    }
    return T.comps.get(key);
  };
  T.render = async (program, f, {scale = 1, post = 'off', sources = T.sources(), shots = T.fixture} = {}) => {
    const c = T.comp(scale, post, program.format); await c.ready;
    c.prepare(program, {plan:T.plan, shots, governor:false});
    const stats = c.drawFrame(program.frame(f), sources, {program});
    const img = c.read();
    return {img, stats, gl:c.gl.getError(), canvas:c.canvas, scale:c.scale};
  };
  T.px = (img, x, y) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]; };
  T.luma = p => .2126 * p[0] + .7152 * p[1] + .0722 * p[2];
  T.region = (img, r, fn) => { for (let y = Math.ceil(r.y); y < Math.floor(r.y + r.h); y++) for (let x = Math.ceil(r.x); x < Math.floor(r.x + r.w); x++) fn(T.px(img, x, y), x, y); };
  T.chroma = p => Math.max(Math.abs(p[0] - p[1]), Math.abs(p[1] - p[2]), Math.abs(p[0] - p[2]));
  T.grad = (img, r, axis) => { let s = 0; T.region(img, r, (p, x, y) => { const q = axis === 'x' ? T.px(img, x + 1, y) : T.px(img, x, y + 1); s += Math.abs(T.luma(p) - T.luma(q)); }); return s; };
  // Edge sharpness: the 99.5th percentile of |Δluma| between neighbours along an axis.
  T.edge = (img, r, axis) => { const d = []; T.region(img, r, (p, x, y) => { const q = axis === 'x' ? T.px(img, x + 1, y) : T.px(img, x, y + 1); d.push(Math.abs(T.luma(p) - T.luma(q))); }); d.sort((a, b) => a - b); return d[Math.floor(d.length * .995)]; };
  T.sha = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
  T.png = (img, r) => { const c = document.createElement('canvas'); r ??= {x:0, y:0, w:img.width, h:img.height}; c.width = r.w; c.height = r.h; const d = new ImageData(r.w, r.h); for (let y = 0; y < r.h; y++) d.data.set(img.data.subarray(((r.y + y) * img.width + r.x) * 4, ((r.y + y) * img.width + r.x + r.w) * 4), y * r.w * 4); c.getContext('2d').putImageData(d, 0, 0); return c.toDataURL('image/png'); };
})()`;

let page = await freshPage();

// ---- 3. geometry and rounded masks --------------------------------------------------------------------
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const p = T.program([{id:'white', at:0, len:16, cell:'G6.0', asset:'gen:white', chrome:{name:''}}, {id:'card', at:0, len:16, cell:'G6.1', asset:'shot:card'}, {id:'red', at:0, len:16, cell:'G6.5', asset:'gen:color:#ff0000', chrome:{name:''}}]);
    const {img, gl} = await T.render(p, 6);
    const c0 = T.cellRect('9:16', 'G6.0'), c1 = T.cellRect('9:16', 'G6.1'), c5 = T.cellRect('9:16', 'G6.5'), mid = c0.y + c0.h / 2;
    return {gl, c0, c1, png:T.png(img),
      centre:T.px(img, c0.x + c0.w / 2, mid), leftIn:T.px(img, c0.x, mid), leftOut:T.px(img, c0.x - 1, mid), rightIn:T.px(img, c0.x + c0.w - 1, mid), rightOut:T.px(img, c0.x + c0.w, mid),
      topIn:T.px(img, c0.x + c0.w / 2, c0.y), topOut:T.px(img, c0.x + c0.w / 2, c0.y - 1), corner:T.px(img, c0.x, c0.y), cornerNear:T.px(img, c0.x + 2, c0.y + 2), cornerArc:T.px(img, c0.x + 3, c0.y + 3), cornerCentre:T.px(img, c0.x + 12, c0.y + 12),
      gutter:[c0.x + c0.w, c0.x + c0.w + 6, c1.x - 1].map(x => T.px(img, x, mid)), red:T.px(img, c5.x + c5.w / 2, c5.y + c5.h / 2), bg:T.px(img, 540, 100)};
  });
  savePng('geometry-9x16.png', r.png);
  const near = (p, q, e = 2) => p.slice(0, 3).every((v, i) => Math.abs(v - q[i]) <= e);
  const BG = [16, 17, 20], W = [255, 255, 255];
  ok(r.gl === 0 && near(r.bg, BG), `the call's background is #101114 (${r.bg.slice(0, 3)})`);
  ok(near(r.centre, W) && near(r.leftIn, W) && near(r.rightIn, W) && near(r.topIn, W), `G6.0 fills its cell exactly: x ${r.c0.x}-${r.c0.x + r.c0.w - 1}, from y ${r.c0.y}`);
  ok(near(r.leftOut, BG) && near(r.rightOut, BG) && near(r.topOut, BG), 'one pixel outside the cell is background on every side');
  ok(r.gutter.every(p => near(p, BG)), `the 12 px gutter between G6.0 and G6.1 is background (x ${r.c0.x + r.c0.w}-${r.c1.x - 1})`);
  ok(near(r.corner, BG) && near(r.cornerNear, BG) && near(r.cornerCentre, W) && r.cornerArc[0] > 20 && r.cornerArc[0] < 250, `12 px rounded corners: the corner pixel is background, the radius centre is the tile, the arc is antialiased (${r.cornerArc[0]})`);
  ok(near(r.red, [255, 0, 0]), 'G6.5 holds its generated colour');
  log(`3. geometry: ${checks - before} checks`);
}

// ---- 4. effects -------------------------------------------------------------------------------------------
{
  const before = checks;
  const res = await page.evaluate(async () => {
    // One 522 px wide tile (G4.0, 522×766) carries every single-layer effect.
    const cell = T.cellRect('9:16', 'G4.0'), R = {x:cell.x + 16, y:cell.y + 16, w:cell.w - 32, h:cell.h - 80};
    const one = async (fx, extra = {}, f = 6) => {
      const p = T.program([{id:'x', at:0, len:16, cell:'G4.0', asset:'shot:card', time:{in:1}, ...(fx ? {fx} : {}), ...extra}], extra.programOpts || {});
      return (await T.render(p, f)).img;
    };
    const ref = await one(null), out = {pngs:{}};
    const keep = (name, img) => { out.pngs[name] = T.png(img, {x:0, y:cell.y - 12, w:1080, h:cell.h + 24}); };
    keep('reference', ref);
    const stat = (img, fn) => { let s = 0, n = 0; T.region(img, R, p => { s += fn(p); n++; }); return s / n; };
    // saturation and chroma drop
    let img = await one([{type:'saturation', amount:0}]); keep('saturation-0', img);
    out.sat0 = (() => { let m = 0; T.region(img, R, p => { m = Math.max(m, T.chroma(p)); }); return m; })();
    img = await one([{type:'saturation', amount:.4}]); keep('saturation-0.4', img);
    out.sat4 = stat(img, T.chroma) / stat(ref, T.chroma);
    img = await one([{type:'chromaDrop', amount:1}]); keep('chromaDrop-1', img);
    out.chroma1 = (() => { let m = 0; T.region(img, R, p => { m = Math.max(m, T.chroma(p)); }); return m; })();
    // mosaic: constant blocks on the cell grid
    img = await one([{type:'mosaic', px:24}]); keep('mosaic-24', img);
    out.mosaic = (() => { let blocks = 0, bad = 0; for (let by = 1; by < 14; by++) for (let bx = 1; bx < 20; bx++) { const x0 = cell.x + bx * 24, y0 = cell.y + by * 24; if (x0 + 24 > cell.x + cell.w - 8 || y0 + 24 > cell.y + cell.h - 60) continue; blocks++; const p0 = T.px(img, x0 + 1, y0 + 1); for (let y = 1; y < 23; y += 3) for (let x = 1; x < 23; x += 3) if (T.chroma([...T.px(img, x0 + x, y0 + y).map((v, i) => Math.abs(v - p0[i]))]) > 0 || Math.abs(T.luma(T.px(img, x0 + x, y0 + y)) - T.luma(p0)) > 1) bad++; } return {blocks, bad}; })();
    // RGB split: red moves +8 px, blue -8 px, green stays
    img = await one([{type:'rgbSplit', px:8, angle:0}]); keep('rgbSplit-8', img);
    out.rgb = (() => { let dr = 0, db = 0, dg = 0, naive = 0, n = 0; T.region(img, {x:R.x + 10, y:R.y, w:R.w - 20, h:R.h}, (p, x, y) => { dr += Math.abs(p[0] - T.px(ref, x - 8, y)[0]); db += Math.abs(p[2] - T.px(ref, x + 8, y)[2]); dg += Math.abs(p[1] - T.px(ref, x, y)[1]); naive += Math.abs(p[0] - T.px(ref, x, y)[0]); n++; }); return {dr:dr / n, db:db / n, dg:dg / n, naive:naive / n}; })();
    // directional blur along x: horizontal detail goes, vertical stays
    img = await one([{type:'dirBlur', px:48, angle:0}]); keep('dirBlur-48', img);
    out.dir = {x:T.edge(img, R, 'x') / T.edge(ref, R, 'x'), y:T.edge(img, R, 'y') / T.edge(ref, R, 'y')};
    // zoom blur toward the centre: detail goes, the centre stays
    img = await one([{type:'zoomBlur', amount:.4, cx:.5, cy:.5}]); keep('zoomBlur-0.4', img);
    out.zoom = {g:(T.edge(img, R, 'x') + T.edge(img, R, 'y')) / (T.edge(ref, R, 'x') + T.edge(ref, R, 'y')), centre:T.luma(T.px(img, cell.x + cell.w / 2, cell.y + cell.h / 2)) - T.luma(T.px(ref, cell.x + cell.w / 2, cell.y + cell.h / 2))};
    // fold x: the right half mirrors the left
    img = await one([{type:'fold', axis:'x'}]); keep('fold-x', img);
    out.fold = (() => { let d = 0, left = 0, n = 0; const cx = cell.x + cell.w / 2; for (let y = R.y; y < R.y + R.h; y += 4) for (let k = 0; k < cell.w / 2 - 20; k += 3) { const a = T.px(img, cx + k, y), b = T.px(img, cx - 1 - k, y); d += Math.abs(T.luma(a) - T.luma(b)); left += Math.abs(T.luma(b) - T.luma(T.px(ref, cx - 1 - k, y))); n++; } return {mirror:d / n, left:left / n}; })();
    // tile 2×2 mirrored: four copies, alternate ones mirrored
    img = await one([{type:'tile', cols:2, rows:2, mirror:1}]); keep('tile-2x2', img);
    out.tile = (() => { let dx = 0, dy = 0, n = 0; const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2; for (let y = cell.y + 8; y < cy - 8; y += 3) for (let k = 0; k < cell.w / 2 - 12; k += 3) { dx += Math.abs(T.luma(T.px(img, cx + k, y)) - T.luma(T.px(img, cx - 1 - k, y))); n++; } let m = 0; for (let k = 0; k < cell.h / 2 - 70; k += 3) for (let x = cell.x + 8; x < cx - 8; x += 3) { dy += Math.abs(T.luma(T.px(img, x, cy + k)) - T.luma(T.px(img, x, cy - 1 - k))); m++; } return {x:dx / n, y:dy / m}; })();
    // iris: a circle of r · half-diagonal around the centre
    img = await one([{type:'iris', r:.5, cx:.5, cy:.5, feather:2}]); keep('iris-0.5', img);
    out.iris = (() => { const Rr = .5 * .5 * Math.hypot(cell.w, cell.h), c = [cell.x + cell.w / 2, cell.y + cell.h / 2]; return {centre:T.luma(T.px(img, ...c)) - T.luma(T.px(ref, ...c)), inside:T.px(img, c[0] - .9 * Rr, c[1]), outside:T.px(img, c[0] - 1.1 * Rr, c[1]), corner:T.px(img, cell.x + 20, cell.y + 20)}; })();
    // peg video: pegs on a 12 px grid from the cell origin, blue
    img = await one([{type:'pegVideo', mix:1, pitch:12, levels:6, gamma:1.4}]); keep('pegVideo-12', img);
    out.peg = (() => { let on = 0, gap = 0, n = 0, blue = 0, red = 0; for (let j = 2; j < 26; j++) for (let i = 2; i < 40; i++) { const x = cell.x + i * 12, y = cell.y + j * 12; const c = T.px(img, x + 6, y + 6), g = T.px(img, x, y); on += T.luma(c); gap += T.luma(g); blue += c[2]; red += c[0]; n++; } return {on:on / n, gap:gap / n, blue:blue / n, red:red / n}; })();
    // scanlines: line pairs of 8 px, the second half dark
    img = await one([{type:'scanline', amount:.6, period:8}]); keep('scanline-0.6', img);
    out.scan = (() => { let a = 0, b = 0; for (let k = 4; k < 40; k++) { const y0 = cell.y + k * 8; T.region(img, {x:R.x, y:y0 + 1, w:R.w, h:2}, p => { a += T.luma(p); }); T.region(img, {x:R.x, y:y0 + 5, w:R.w, h:2}, p => { b += T.luma(p); }); } return b / a; })();
    // opacity: half a white tile over the background
    { const p = T.program([{id:'w', at:0, len:16, cell:'G4.0', asset:'gen:white', frame:{opacity:.5}, chrome:{name:''}}]); img = (await T.render(p, 6)).img; out.opacity = T.px(img, cell.x + cell.w / 2, cell.y + cell.h / 2); keep('opacity-0.5', img); }
    // echo: a tile sliding right leaves trail copies of its earlier positions
    // (in stack3.0, a wide tile whose crop spans the card's whole width, so a slide uncovers background)
    { const ec = T.cellRect('9:16', 'stack3.0'), move = {frame:{dx:[[0, 0], [16, 260]]}};
      const slid = async fx => (await T.render(T.program([{id:'x', at:0, len:16, cell:'stack3.0', asset:'shot:card', time:{in:1}, ...(fx ? {fx} : {}), ...move}]), 24)).img;
      const a = await slid(null), b = await slid([{type:'echo', taps:3, frames:2, decay:.6}]); out.pngs['echo-3'] = T.png(b, {x:0, y:ec.y, w:1080, h:ec.h + 12});
      const bg = img => { let n = 0; T.region(img, {x:ec.x + 2, y:ec.y + 2, w:ec.w - 4, h:ec.h - 60}, p => { if (Math.abs(p[0] - 16) < 3 && Math.abs(p[2] - 20) < 3) n++; }); return n; };
      out.echo = {plain:bg(a), echo:bg(b)}; }
    // Droste: the feedback tile holds the whole frame at .3, one level deep
    { const p = T.program([{id:'fb', at:0, len:16, cell:'G6.0', asset:'gen:feedback', fx:[{type:'droste', depth:1, scale:.3, cx:.5, cy:.5}], chrome:{name:'Pat', cameraOff:true}}, {id:'w', at:0, len:16, cell:'G6.3', asset:'gen:white', chrome:{name:''}}, {id:'red', at:0, len:16, cell:'G6.5', asset:'gen:color:#ff0000', chrome:{name:''}}]);
      const r = await T.render(p, 6); img = r.img; keep('droste-1', img);
      const fb = T.cellRect('9:16', 'G6.0'), at = (P) => [fb.x + fb.w / 2 + (P[0] - 540) * .3, fb.y + fb.h / 2 + (P[1] - 960) * .3];
      const c1 = T.cellRect('9:16', 'G6.3'), c5 = T.cellRect('9:16', 'G6.5');
      out.droste = {red:T.px(img, ...at([c5.x + c5.w / 2, c5.y + c5.h / 2])), white:T.px(img, ...at([c1.x + c1.w / 2, c1.y + c1.h / 2])), levels:r.stats.droste}; }
    // the composite camera: zoom 2 about the centre
    { const p = T.program([{id:'red', at:0, len:16, cell:'G6.3', asset:'gen:color:#ff0000', chrome:{name:''}}], {camera:[{id:'cam', at:0, len:16, zoom:2, cx:.5, cy:.5}]});
      img = (await T.render(p, 6)).img; const c3 = T.cellRect('9:16', 'G6.3'); out.camera = {moved:T.px(img, 540 + (c3.x + 40 - 540) * 2, 960 + (c3.y + 40 - 960) * 2), old:T.px(img, c3.x + 14, c3.y + c3.h - 16)}; }
    return out;
  });
  for (const [k, v] of Object.entries(res.pngs)) savePng(`fx-${k}.png`, v);
  ok(res.sat0 <= 2, `saturation 0: the tile is grey (max chroma ${res.sat0})`);
  ok(res.sat4 > .3 && res.sat4 < .5, `saturation .4: chroma falls to ${res.sat4.toFixed(2)} of the reference`);
  ok(res.chroma1 <= 2, `chromaDrop 1: luma only (max chroma ${res.chroma1})`);
  ok(res.mosaic.blocks > 100 && res.mosaic.bad === 0, `mosaic 24 px: ${res.mosaic.blocks} blocks on the cell grid, each one colour`);
  ok(res.rgb.dr < 3 && res.rgb.db < 3 && res.rgb.dg < 2 && res.rgb.naive > 4 * res.rgb.dr, `rgbSplit 8 px: red is the picture moved +8 px (error ${res.rgb.dr.toFixed(2)}), blue −8 px (${res.rgb.db.toFixed(2)}), green in place (${res.rgb.dg.toFixed(2)}); unshifted red is off by ${res.rgb.naive.toFixed(1)}`);
  ok(res.dir.x < .35 && res.dir.y > .6, `dirBlur 48 px along x: vertical edges keep ${res.dir.x.toFixed(2)} of their sharpness, horizontal edges ${res.dir.y.toFixed(2)}`);
  ok(res.zoom.g < .6 && Math.abs(res.zoom.centre) < 12, `zoomBlur .4: edges keep ${res.zoom.g.toFixed(2)} of their sharpness, the centre holds (Δ ${res.zoom.centre.toFixed(1)})`);
  ok(res.fold.mirror < 2 && res.fold.left < 2, `fold x: the right half mirrors the left (Δ ${res.fold.mirror.toFixed(2)}), the left half is untouched (Δ ${res.fold.left.toFixed(2)})`);
  ok(res.tile.x < 3 && res.tile.y < 3, `tile 2×2 mirrored: the copies mirror across both centre lines (Δ ${res.tile.x.toFixed(2)}, ${res.tile.y.toFixed(2)})`);
  ok(Math.abs(res.iris.centre) < 2 && Math.abs(res.iris.outside[0] - 16) < 3 && Math.abs(res.iris.corner[0] - 16) < 3 && Math.abs(res.iris.inside[0] - 16) > 10, 'iris .5: the picture inside the circle, background outside it and in the corners');
  ok(res.peg.on > 2.5 * res.peg.gap && res.peg.blue > res.peg.red + 40, `pegVideo 12 px: peg centres ${res.peg.on.toFixed(0)} vs gaps ${res.peg.gap.toFixed(0)} luma, blue ${res.peg.blue.toFixed(0)} over red ${res.peg.red.toFixed(0)}`);
  ok(res.scan > .3 && res.scan < .5, `scanline .6, 8 px pairs: dark lines at ${res.scan.toFixed(2)} of the light ones`);
  ok(Math.abs(res.opacity[0] - (255 + 16) / 2) <= 3, `opacity .5: white over the background reads ${res.opacity[0]} (want ${(271 / 2).toFixed(1)})`);
  // The tile has slid 130 px by frame 24; its three taps sit at the last 6 frames' 33 px, at opacity .6, .36, .22.
  ok(res.echo.echo < res.echo.plain * .85, `echo 3 taps: the trail covers what a sliding tile uncovers (${res.echo.plain} background pixels without, ${res.echo.echo} with)`);
  ok(res.droste.levels === 1 && res.droste.red[0] > 200 && res.droste.red[1] < 60 && res.droste.white[1] > 200, 'droste 1 level at .3: the feedback tile holds the whole frame (the red tile and the white tile in place)');
  ok(res.camera.moved[0] > 200 && res.camera.moved[1] < 60 && Math.abs(res.camera.old[0] - 16) < 4, 'camera zoom 2: the composite scales about the centre');
  log(`4. effects: ${checks - before} checks (${FX_TYPES.length} types plus opacity and the camera)`);
}

// ---- 5. chrome -----------------------------------------------------------------------------------------------
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const p = T.program([
      {id:'talk', at:0, len:16, cell:'G6.0', asset:'shot:card', time:{in:1}, chrome:{name:'Kevin', role:'Partnerships', speaking:1, mic:'on'}},
      {id:'join', at:0, len:16, cell:'G6.1', asset:'shot:card2', time:{in:1}, chrome:{name:'Keys', mic:'muted', toast:{at:0, len:8, text:'Keys joined'}}},
      {id:'pat', at:0, len:16, cell:'G6.2', asset:'gen:camera-off'},
      {id:'lady', at:0, len:16, cell:'G6.3', asset:'gen:camera-off', chrome:{name:'The lady', speaking:.8}},
      {id:'poor', at:0, len:16, cell:'G6.4', asset:'shot:card3', time:{in:1}, chrome:{name:'Arjun', banner:'Your connection is unstable'}},
      {id:'white', at:0, len:16, cell:'G6.5', asset:'gen:white', chrome:{name:''}},
    ]);
    const calls = [], {img, gl} = await T.render(p, 6, {sources:T.sources(calls)});
    const cell = id => T.cellRect('9:16', id), c0 = cell('G6.0'), c1 = cell('G6.1'), c2 = cell('G6.2'), c3 = cell('G6.3'), c4 = cell('G6.4');
    const count = (r, fn) => { let n = 0; T.region(img, r, p => { if (fn(p)) n++; }); return n; };
    const bh = 48;
    return {gl, png:T.png(img),
      border:T.px(img, c0.x + 2, c0.y + c0.h / 2), noBorder:T.px(img, c1.x + 2, c1.y + c1.h / 2),
      bar:{dark:count({x:c0.x + 140, y:c0.y + c0.h - bh + 4, w:c0.w - 200, h:bh - 8}, p => T.luma(p) < 40), text:count({x:c0.x + 30, y:c0.y + c0.h - bh + 4, w:200, h:bh - 8}, p => T.luma(p) > 170)},
      toast:{pill:count({x:c1.x + c1.w / 2 - 40, y:c1.y + 22, w:80, h:30}, p => T.luma(p) < 45), text:count({x:c1.x + 60, y:c1.y + 18, w:c1.w - 120, h:42}, p => T.luma(p) > 170)},
      pat:{maxChroma:(() => { let m = 0; T.region(img, {x:c2.x + 4, y:c2.y + 4, w:c2.w - 8, h:c2.h - 52}, p => { m = Math.max(m, T.chroma(p)); }); return m; })(), avatar:count(c2, p => Math.abs(p[0] - 68) < 4 && Math.abs(p[1] - 71) < 4 && Math.abs(p[2] - 81) < 4)},
      lady:{avatar:count(c3, p => Math.abs(p[0] - 68) < 4 && Math.abs(p[1] - 71) < 4 && Math.abs(p[2] - 81) < 4), voice:count(c3, p => p[2] > p[0] + 40 && p[2] > 120)},
      banner:count({x:c4.x, y:c4.y, w:c4.w, h:80}, p => p[0] > 200 && p[1] > 170 && p[2] < 120),
      calls:calls.map(l => l.clipId)};
  });
  savePng('chrome-9x16.png', r.png);
  ok(r.gl === 0 && r.border[1] > r.border[0] + 60 && r.border[1] > r.border[2] + 40, `speaking 1: the meeting room's green border (${r.border.slice(0, 3)}); a silent tile has none (${r.noBorder.slice(0, 3)})`);
  ok(r.bar.dark > 2000 && r.bar.text > 40, `name bar: a dark strip along the tile's foot with its name in type (${r.bar.dark} dark px, ${r.bar.text} type px)`);
  ok(r.toast.pill > 600 && r.toast.text > 40, `"Keys joined": a pill at the tile's top with its text (${r.toast.pill} dark px, ${r.toast.text} type px)`);
  ok(r.pat.maxChroma < 20 && r.pat.avatar > 1500, `Pat's tile: camera off, initials on the meeting room's grey avatar (${r.pat.avatar} px), no picture (max chroma ${r.pat.maxChroma})`);
  ok(r.lady.avatar < 60 && r.lady.voice > 300, `the lady's tile: no face and no avatar (${r.lady.avatar} avatar-grey px, edge blends only), her voice as a waveform (${r.lady.voice} px)`);
  ok(r.banner > 30, `"Your connection is unstable": the banner carries its signal-yellow icon (${r.banner} px)`);
  ok(r.calls.length && r.calls.every(id => ['talk', 'join', 'poor'].includes(id)), `sources are asked for footage only, never for Pat, the lady or a generated tile (${[...new Set(r.calls)].join(', ')})`);
  log(`5. chrome: ${checks - before} checks`);
}

// ---- 5b. Synergy's mouth row --------------------------------------------------------------------------------------
// The compositor's mouth pass against the meeting room's drawRobotMouth (the same code, on a
// 1280×720 canvas over the clean plate), at one output px per source px: lit on a sung word,
// resting between lines; then the draft cut on real footage.
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const TR = await (await fetch('/src/meeting-room/robot-tracking.json')).json();
    // src/meeting-room/Participant.jsx drawRobotMouth and robotFrame, verbatim but for the canvas.
    const robotFrame = (id, time) => { const track = TR[id], index = Math.max(0, Math.min(track.frames.length - 1, time * track.fps)); const a = track.frames[Math.floor(index)], b = track.frames[Math.min(track.frames.length - 1, Math.ceil(index))]; return a.map((v, i) => v + (b[i] - v) * (index - Math.floor(index))); };
    const drawRobotMouth = (ctx, id, videoTime, audioTime, level) => {
      const [x, y, angle, scale] = robotFrame(id, videoTime);
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
      const height = 6; ctx.shadowColor = '#4aff70'; ctx.shadowBlur = 2;
      const phase = (audioTime * 15) % 22;
      for (let i = 0; i < 22; i++) { const distance = (phase - i + 22) % 22; const strength = level > .08 ? Math.max(.16, (1 - distance / 7) * level) : .11; ctx.fillStyle = `rgba(74,255,112,${strength})`; ctx.fillRect(-46 + i * 4.3, -height / 2, 3.2, height); }
      ctx.restore();
    };
    const syn = {id:'syn', width:1280, height:720, fps:24, frames:408, duration:17, contentBox:[0, 0, 1280, 720], status:'C', characters:['Synergy'], tracking:'synergy', action:['idle', 'listen'], roles:['listener'], reverseClass:'R1', mirrorable:false, sharpTier:'A', shotType:'plate'};
    const shots = [...T.fixture, syn];
    const plate = document.createElement('canvas'); plate.width = 1280; plate.height = 720; const pg = plate.getContext('2d'); pg.fillStyle = '#1b1d22'; pg.fillRect(0, 0, 1280, 720);
    // One output px per source px: the 16:9 L1 tile at zoom crop.w / cell.w.
    const p = T.program([{id:'s', at:0, len:32, cell:'L1.0', asset:'shot:syn', time:{in:2}, frame:{zoom:1280 / 1896}, chrome:{name:''}}], {format:'16:9', shots, frames:96});
    const out = {};
    for (const [name, f, level] of [['sung', 40, .9], ['rest', 40, 0], ['half', 52, .45]]) {
      const base = p.frame(f), layer = base.layers[0];
      const fr = {...base, layers:[{...layer, robot:{...layer.robot, level}}]};
      // The meeting room's drawing, on the plate, at the layer's source time and the song time.
      const ref = document.createElement('canvas'); ref.width = 1280; ref.height = 720; const g = ref.getContext('2d');
      g.drawImage(plate, 0, 0); drawRobotMouth(g, 'synergy', layer.srcTime, fr.time, level);
      const c = T.comp(1, 'off', '16:9'); await c.ready; c.prepare(p, {plan:T.plan, shots, governor:false});
      c.drawFrame(fr, l => ({image:plate, key:'plate', version:1, width:1280, height:720}), {program:p}); const A = c.read();
      c.drawFrame({...fr, layers:[{...layer, robot:undefined}]}, l => ({image:ref, key:'ref' + name, version:1, width:1280, height:720}), {program:p}); const B = c.read();
      const m = layer.robot.mouth, box = {x:Math.floor(m.x - m.w / 2 - 6), y:Math.floor(m.y - 14), w:Math.ceil(m.w + 12), h:28};
      let se = 0, n = 0, gA = 0, gB = 0, maxD = 0;
      T.region(A, box, (q, x, y) => { const w = T.px(B, x, y); for (let i = 0; i < 3; i++) { se += (q[i] - w[i]) ** 2; n++; maxD = Math.max(maxD, Math.abs(q[i] - w[i])); } gA += q[1] - (q[0] + q[2]) / 2; gB += w[1] - (w[0] + w[2]) / 2; });
      out[name] = {psnr:10 * Math.log10(255 * 255 / Math.max(1e-9, se / n)), maxD, gA, gB, box, png:T.png(A, {x:box.x - 40, y:box.y - 40, w:box.w + 80, h:box.h + 80}), ref:T.png(B, {x:box.x - 40, y:box.y - 40, w:box.w + 80, h:box.h + 80}), mouths:c.stats.mouths};
    }
    return out;
  });
  for (const k of ['sung', 'rest', 'half']) { savePng(`mouth-${k}.png`, r[k].png); savePng(`mouth-${k}-meeting-room.png`, r[k].ref); }
  ok(['sung', 'rest', 'half'].every(k => r[k].psnr >= 32), `the mouth row matches the meeting room's drawRobotMouth drawn on the same plate: ${['sung', 'rest', 'half'].map(k => `${k} ${r[k].psnr.toFixed(1)} dB (max Δ ${r[k].maxD})`).join(', ')}`);
  ok(r.sung.gA > 2.5 * r.rest.gA && r.rest.gA > 0 && Math.abs(r.sung.gA / r.sung.gB - 1) < .15 && Math.abs(r.rest.gA / r.rest.gB - 1) < .15, `lit while he sings, an idle glow at rest: green excess ${r.sung.gA.toFixed(0)} sung, ${r.rest.gA.toFixed(0)} at rest (the meeting room's ${r.sung.gB.toFixed(0)} and ${r.rest.gB.toFixed(0)})`);
  log(`5b. the mouth row: ${checks - before} checks`);
}

// ---- 6. the board ---------------------------------------------------------------------------------------------
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const plan = T.plan, choke = Math.round(plan.timing[plan.choke.at] * 24), impact = Math.round(plan.timing[plan.choke.until] * 24);
    const clips = [
      ...[0, 1, 2, 3, 4, 5].map(i => ({id:`g${i}`, at:64, len:64, cell:`G6.${i}`, asset:i === 3 ? 'gen:board' : 'shot:card', time:{in:1}})),
      ...[0, 1, 2].map(i => ({id:`s${i}`, at:128, len:64, cell:`stack3.${i}`, asset:'shot:card2', time:{in:1}})),
      {id:'black', at:plan.choke.at, len:plan.choke.until - plan.choke.at, cell:'full', asset:'gen:color:#000000'},
      {id:'ign', at:plan.choke.until, len:8, cell:'full', asset:'gen:color:#000000'},
    ];
    const p = T.compile(T.createEDL({format:'9:16', clips, board:'song'}), {plan, shots:T.fixture});
    // A G6 frame with a screen up, a G6 frame between screens, a stack3 frame.
    const G6 = [...Array(p.frames).keys()].filter(f => f >= Math.round(plan.timing[64] * 24) && f < Math.round(plan.timing[128] * 24) && p.frame(f).layout === 'G6');
    const on = G6.find(f => p.frame(f).board.screen >= 0 && p.board.screens[p.frame(f).board.screen].voice === 'synergy' && f / 24 > p.board.screens[p.frame(f).board.screen].words[Math.min(4, p.board.screens[p.frame(f).board.screen].words.length - 1)].start + .05);
    const st = [...Array(p.frames).keys()].find(f => p.frame(f).layout === 'stack3');
    const strip = T.layout('G6', '9:16').board, out = {on, st, choke, impact, strip};
    const lit = (img, r, s) => { let n = 0; T.region(img, {x:r.x * s, y:r.y * s, w:r.w * s, h:r.h * s}, q => { if (q[2] > 150 && T.luma(q) > 90) n++; }); return n; };
    const lum = (img, r, s) => { let a = 0, n = 0; T.region(img, {x:r.x * s, y:r.y * s, w:r.w * s, h:r.h * s}, q => { a += T.luma(q); n++; }); return a / n; };
    let x = await T.render(p, on, {scale:.5}); out.png1 = T.png(x.img); out.stripOn = lit(x.img, strip, .5); out.tile = lit(x.img, T.cellRect('9:16', 'G6.3'), .5); out.above = lit(x.img, {x:0, y:0, w:1080, h:280}, .5); out.stats = x.stats; out.screen = p.board.screens[p.frame(on).board.screen].text;
    // stack3 at its first frame with a word lit: the board between its second and third tile.
    const st3 = [...Array(p.frames).keys()].find(f => p.frame(f).layout === 'stack3' && p.frame(f).board.screen >= 0 && p.board.screens[p.frame(f).board.screen].words.some(w => w.start + .1 <= f / 24 && w.end > f / 24)) ?? st;
    x = await T.render(p, st3, {scale:.5}); out.png2 = T.png(x.img); out.st = st3; out.stripStack = lit(x.img, T.layout('stack3', '9:16').board, .5); out.boardRect = p.frame(st3).board.rect; out.stackScreen = p.board.screens[p.frame(st3).board.screen]?.text;
    x = await T.render(p, impact - 1, {scale:.5}); out.png3 = T.png(x.img); out.black = (() => { let m = 0; T.region(x.img, {x:0, y:0, w:540, h:960}, q => { m = Math.max(m, T.luma(q)); }); return m; })();
    x = await T.render(p, impact, {scale:.5}); out.png4 = T.png(x.img); out.ignite = lum(x.img, {x:0, y:0, w:1080, h:1920}, .5);
    x = await T.render(p, choke + 8, {scale:.5}); out.png5 = T.png(x.img); out.tag = lit(x.img, {x:0, y:0, w:1080, h:1920}, .5); out.tagScreen = p.board.screens[p.frame(choke + 8).board.screen]?.text;
    return out;
  });
  ['board-strip', 'board-stack3', 'board-true-black', 'board-ignition', 'board-tag'].forEach((n, i) => savePng(`${n}.png`, r[`png${i + 1}`]));
  ok(r.stripOn > 400 && r.above === 0, `G6 at frame ${r.on}: "${r.screen}" lit in the board strip y ${r.strip.y}-${r.strip.y + r.strip.h} (${r.stripOn} lit px at half size), nothing above the tiles`);
  ok(r.tile > 100, `gen:board: the same screen inside its tile G6.3 (${r.tile} lit px)`);
  ok(r.boardRect && r.boardRect.y === 1048 && r.boardRect.y + r.boardRect.h <= 1440 && r.stripStack > 200, `stack3 at frame ${r.st}: "${r.stackScreen}" lit in its board region y ${r.boardRect?.y}-${r.boardRect ? r.boardRect.y + r.boardRect.h : ''}, inside the platform-safe band (${r.stripStack} lit px)`);
  ok(r.black <= 6, `frame ${r.impact - 1}: true black, sockets off (max luma ${r.black.toFixed(1)})`);
  ok(r.ignite > 60, `frame ${r.impact}: the board ignites over the whole frame (mean luma ${r.ignite.toFixed(0)})`);
  ok(r.tag > 300 && /CIRCLE/i.test(r.tagScreen || ''), `after the choke: "${r.tagScreen}" on bare sockets over black (${r.tag} lit px)`);
  log(`6. the board: ${checks - before} checks`);
}

// ---- 7. proxies through texImage2D -----------------------------------------------------------------------------
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const shot = T.real.get('drums-playing'), k = 30;
    const load = url => new Promise((res, rej) => { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url; v.onloadeddata = () => res(v); v.onerror = () => rej(Error('video ' + url)); document.body.append(v); });
    const seek = (v, t) => new Promise(res => { v.requestVideoFrameCallback(() => res()); v.currentTime = t; });
    const fwd = await load(shot.proxy), rev = await load(shot.rev);
    await seek(fwd, (k + .5) / 24); await seek(rev, (shot.frames - 1 - k + .5) / 24);
    // Straight texImage2D in a fresh context: the same-origin route needs no CORS.
    const c = document.createElement('canvas'), gl = c.getContext('webgl2'), t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fwd); const e1 = gl.getError();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rev); const e2 = gl.getError();
    // Through the compositor: one tile each, the forward proxy's frame k and the reversed proxy's frame N-1-k.
    const p = T.program([{id:'f', at:0, len:16, cell:'G4.0', asset:'shot:drums-playing', time:{in:k / 24}, chrome:{name:''}}, {id:'r', at:0, len:16, cell:'G4.1', asset:'shot:drums-playing', time:{in:k / 24}, chrome:{name:''}}], {shots:T.SHOTS});
    const {img, gl:ge, stats} = await T.render(p, 0, {scale:.5, shots:T.real, sources:l => ({image:l.clipId === 'f' ? fwd : rev, key:l.clipId, version:1, width:shot.width, height:shot.height})});
    const a = T.cellRect('9:16', 'G4.0'), b = T.cellRect('9:16', 'G4.1');
    let se = 0, n = 0, sum = 0, sq = 0;
    T.region(img, {x:a.x * .5 + 4, y:a.y * .5 + 4, w:a.w * .5 - 8, h:a.h * .5 - 8}, (q, x, y) => { const w = T.px(img, x + (b.x - a.x) * .5, y); const l = T.luma(q); sum += l; sq += l * l; for (let i = 0; i < 3; i++) se += (q[i] - w[i]) ** 2; n += 3; });
    const mean = sum / (n / 3), sd = Math.sqrt(sq / (n / 3) - mean * mean);
    return {e1, e2, ge, uploads:stats.uploads, w:fwd.videoWidth, h:fwd.videoHeight, psnr:10 * Math.log10(255 * 255 / Math.max(1e-9, se / n)), mean, sd, url:shot.proxy, rev:shot.rev, png:T.png(img)};
  });
  savePng('proxy-fwd-rev.png', r.png);
  ok(r.e1 === 0 && r.e2 === 0 && r.w === 960 && r.h === 540, `texImage2D of the same-origin 540p proxy and its reversed proxy: GL error 0 (${r.w}×${r.h}, ${r.url})`);
  ok(r.ge === 0 && r.uploads === 2 && r.mean > 30 && r.sd > 10, `the compositor draws both (mean luma ${r.mean.toFixed(0)}, spread ${r.sd.toFixed(0)})`);
  ok(r.psnr >= 30, `the reversed proxy's frame N−1−k is the forward frame k: ${r.psnr.toFixed(1)} dB PSNR between the two tiles`);
  log(`7. proxies: ${checks - before} checks`);
}

// ---- 7b. reversed footage without reversed proxies; a long-GOP 1080p master ---------------------------------------
// Production has no reversed proxies until Aaron uploads them, and a deploy has no ffmpeg. The
// export decoder then decodes the forward proxy and numbers its frames backwards (frame k of
// the reversed proxy is forward frame N − 1 − k); the preview captures forward frames into the
// stutter cache. Both against the reversed-proxy path: the same frame within a stated PSNR (the
// two files are separate CRF 20 encodes), and a clear margin over the neighbouring frames, so
// the order is exact. Then the forward path from a master only: 1080p, GOP 120, B-frames.
const MASTER = path.join(OUT, 'master-1080-gop120.mp4');
{
  const shot = index.get('the-professionals-arrive'), proxy = path.join(ROOT, 'public/videostudio/proxies', shot.proxy.split('/').pop());
  const made = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', proxy, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '120', '-bf', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', MASTER]);
  if (made.status !== 0) throw Error(`ffmpeg could not make the test master: ${made.stderr}`);
  // And one keyframe for the whole clip, as the bucket's 1080p masters are (GOP 241): a seek near
  // its end decodes every frame before it.
  const one = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', proxy, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '1000', '-keyint_min', '1000', '-sc_threshold', '0', '-bf', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', MASTER.replace('gop120', 'onegop')]);
  if (one.status !== 0) throw Error(`ffmpeg could not make the one-GOP test master: ${one.stderr}`);
}
app.get('/test-master.mp4', (_q, r) => r.sendFile(MASTER));
app.get('/test-master-onegop.mp4', (_q, r) => r.sendFile(MASTER.replace('gop120', 'onegop')));
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const psnr = (a, b) => { let se = 0; for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) se += (a[i + c] - b[i + c]) ** 2; return 10 * Math.log10(255 * 255 / Math.max(1e-9, se / (a.length * .75))); };
    const pixels = (img, w = 480, h = 270) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    // A reversed walk-in (R1) at rate 1: consecutive output frames show consecutive reversed frames.
    const id = 'the-professionals-arrive', shot = T.real.get(id);
    const p = T.compile(T.createEDL({format:'9:16', clips:[{id:'r', at:0, len:16, cell:'L1.0', asset:`shot:${id}`, time:{in:7, reverse:true}, chrome:{name:''}}]}), {plan:T.plan, shots:T.SHOTS, frames:40});
    const no404 = (u, o) => /-rev540-/.test(u) ? Promise.resolve(new Response('gone', {status:404})) : fetch(u, o);
    const decoders = {proxy:T.createFrameDecoder({program:p, shots:T.real, from:0, to:40}), off:T.createFrameDecoder({program:p, shots:T.real, from:0, to:40, reversed:false}), missing:T.createFrameDecoder({program:p, shots:T.real, from:0, to:40, fetcher:no404})};
    const grabs = {proxy:[], off:[], missing:[]};
    const frames = [0, 1, 6, 7, 18, 19, 30, 31];
    for (const f of frames) for (const [k, d] of Object.entries(decoders)) { await d.prepare(f); const s = d.source(p.frame(f).layers[0]); grabs[k].push(pixels(s.image)); d.release(f); }
    const stats = Object.fromEntries(Object.entries(decoders).map(([k, d]) => [k, d.stats()])), live = Object.values(decoders).map(d => d.ledger.live);
    Object.values(decoders).forEach(d => d.dispose());
    const out = {same:[], next:[], identical:true, flipped:{off:stats.off.flipped.length, missing:stats.missing.flipped.length, proxy:stats.proxy.flipped.length}, live, proxyFrames:frames.map(f => p.frame(f).layers[0].proxyFrame)};
    for (let i = 0; i < frames.length; i++) {
      out.same.push(psnr(grabs.off[i], grabs.proxy[i]));
      const j = i % 2 ? i - 1 : i + 1; out.next.push(psnr(grabs.off[i], grabs.proxy[j]));
      if (grabs.off[i].some((v, n) => v !== grabs.missing[i][n])) out.identical = false;
    }
    // The preview: the pool with reversed proxies, and with reversed:false (captured forward frames).
    const pv = {};
    for (const [k, rev] of [['proxy', true], ['off', false]]) {
      const cache = T.createStutterCache(), pool = T.createElementPool({shots:T.real, cache, slots:4, reversed:rev});
      pool.setProgram(p); pv[k] = [];
      for (const f of frames) {
        const t0 = performance.now();
        while (performance.now() - t0 < 15000 && !pool.settled(f)) { pool.update(f, f / 24, false); await new Promise(res => setTimeout(res, 20)); }
        const src = pool.source(p.frame(f).layers[0]);
        pv[k].push(src ? pixels(src.image) : null);
      }
      pv[k + 'Stats'] = pool.stats; pool.dispose(); cache.clear();
    }
    out.preview = frames.map((f, i) => pv.off[i] && pv.proxy[i] ? psnr(pv.off[i], pv.proxy[i]) : 0);
    out.previewExport = frames.map((f, i) => pv.off[i] ? psnr(pv.off[i], grabs.off[i]) : 0);
    out.previewFlip = pv.offStats.reversedFromForward;
    // Masters only: a 1080p, GOP 120, two-B-frame master of the same shot, forward and reversed,
    // through a small cache (the 1080p frames are 3 MB each).
    const masterShots = new Map([[shot.id, {...shot, src:'/test-master.mp4', proxy:null, rev:null}]]);
    const pr = T.compile(T.createEDL({format:'9:16', clips:[{id:'f', at:0, len:8, cell:'G4.0', asset:`shot:${id}`, time:{in:2}, chrome:{name:''}}, {id:'r', at:0, len:8, cell:'G4.1', asset:`shot:${id}`, time:{in:7, reverse:true}, chrome:{name:''}}]}), {plan:T.plan, shots:T.SHOTS, frames:24});
    const dm = T.createFrameDecoder({program:pr, shots:masterShots, from:0, to:24, media:'master', budget:40 << 20}), dp = T.createFrameDecoder({program:pr, shots:T.real, from:0, to:24});
    out.master = [];
    let size = null;
    for (const f of [0, 11, 23]) {
      await dm.prepare(f); await dp.prepare(f);
      for (const l of pr.frame(f).layers) { const a = dm.source(l), b = dp.source(l); size ??= [a.image.displayWidth, a.image.displayHeight]; out.master.push(psnr(pixels(a.image), pixels(b.image))); }
      dm.release(f); dp.release(f);
    }
    out.masterStats = dm.stats(); out.masterSize = size; out.masterLive = dm.ledger.live;
    dm.dispose(); dp.dispose();
    // The preview from a one-GOP master alone (no reversed proxy, production today): every seek near
    // the clip's end decodes ~170 frames first, longer than the pool's 400 ms retry, and must still capture.
    const oneGop = new Map([[shot.id, {...shot, src:'/test-master-onegop.mp4', proxy:null, rev:null}]]);
    const pm = T.createFrameDecoder({program:pr, shots:oneGop, from:0, to:24, media:'master', budget:40 << 20});
    const mcache = T.createStutterCache(), mpool = T.createElementPool({shots:oneGop, cache:mcache, slots:4, preferProxy:false});
    mpool.setProgram(pr); out.poolMaster = [];
    for (const f of [0, 6, 12, 18, 23]) {
      const t0 = performance.now();
      while (performance.now() - t0 < 20000 && !mpool.settled(f)) { mpool.update(f, f / 24, false); await new Promise(res => setTimeout(res, 20)); }
      await pm.prepare(f);
      const l = pr.frame(f).layers.find(x => x.reverse), a = mpool.source(l), b = pm.source(l);
      out.poolMaster.push({f, settled:mpool.settled(f), ms:Math.round(performance.now() - t0), db:a && b ? psnr(pixels(a.image), pixels(b.image)) : 0});
      pm.release(f);
    }
    out.poolMasterStats = mpool.stats; mpool.dispose(); mcache.clear(); pm.dispose();
    return out;
  });
  const min = a => Math.min(...a), fmt = a => a.map(x => x.toFixed(1)).join('/');
  ok(r.flipped.off === 1 && r.flipped.missing === 1 && r.flipped.proxy === 0 && r.identical, `export decoder: with reversed proxies switched off, or answering 404, it decodes the forward proxy backwards (the two give identical pixels)`);
  ok(min(r.same) >= 38 && r.same.every((x, i) => x > r.next[i] + 3), `export decoder, reversed from the forward proxy: frame k matches the reversed proxy's frame k at ${fmt(r.same)} dB (min ${min(r.same).toFixed(1)}), its neighbours only ${fmt(r.next)} dB: the order is exact (reversed frames ${r.proxyFrames.join(', ')})`);
  ok(r.live.every(n => n === 0), 'every VideoFrame of the three decoders is closed');
  ok(r.previewFlip >= 1 && min(r.preview) >= 38 && min(r.previewExport) >= 40, `preview, reversed:false: the pool plays the reversed span from captured forward frames, ${fmt(r.preview)} dB against the reversed proxy and ${fmt(r.previewExport)} dB against the export's decode`);
  ok(min(r.master) >= 30 && r.masterSize?.[1] === 1080 && r.masterLive === 0 && r.masterStats.cacheBytes <= 40 << 20, `masters only (1080p, GOP 120, B-frames, a 40 MB cache): forward and reversed frames decode and match the proxies at ${fmt(r.master)} dB; ${r.masterStats.gops} GOP runs, ${r.masterStats.decoded} frames decoded, ${r.masterStats.evicted} evicted, peak ${(r.masterStats.peakBytes / 2 ** 20).toFixed(0)} MB`);
  ok(r.poolMasterStats.reversedFromForward >= 1 && r.poolMaster.every(x => x.settled && x.db >= 35), `preview from a one-GOP 1080p master alone: the pool captures every reversed frame although each seek outlasts its retry, ${r.poolMaster.map(x => `f${x.f} ${x.db.toFixed(1)} dB in ${x.ms} ms`).join(', ')}; ${r.poolMasterStats.seeks} seeks`);
  log(`7b. reversed without reversed proxies, masters: ${checks - before} checks`);
}

// ---- 8. element pool and stutter cache --------------------------------------------------------------------------
const FILM_FRAMES = quick ? [100, 600] : [100, 230, 400, 600, 760, 1000, 1160, 1380];
{
  const before = checks;
  const r = await page.evaluate(async frames => {
    const cache = T.createStutterCache();
    const bm = await Promise.all(Array.from({length:20}, () => createImageBitmap(T.card('card'))));
    bm.forEach((b, i) => cache.put(T.stutterKey('card', false, i), b));
    const over = {bytes:cache.bytes, frames:cache.size, budget:cache.budget, last:!!cache.get(T.stutterKey('card', false, 19)), first:!!cache.get(T.stutterKey('card', false, 0))};
    cache.clear();
    const program = T.compile(T.studioFilm(T.plan, T.SHOTS, {format:'9:16'}), {plan:T.plan, shots:T.SHOTS});
    const pool = T.createElementPool({shots:T.real, cache, slots:8});
    pool.setProgram(program);
    const out = [];
    for (const f of frames) {
      const t0 = performance.now();
      while (performance.now() - t0 < 20000 && !pool.settled(f)) { pool.update(f, f / 24, false); await new Promise(r => setTimeout(r, 25)); }
      out.push({f, settled:pool.settled(f), ms:performance.now() - t0, layers:program.frame(f).layers.filter(l => l.kind === 'video').length});
    }
    const s = pool.stats;
    pool.dispose();
    return {over, out, elements:s.elements, overflow:s.overflow};
  }, FILM_FRAMES);
  ok(r.over.bytes <= r.over.budget && r.over.frames === Math.floor(r.over.budget / (1280 * 720 * 4)) && r.over.last && !r.over.first, `stutter cache: 20 frames of 1280×720 keep the newest ${r.over.frames} (${(r.over.bytes / 2 ** 20).toFixed(1)} MB of ${r.over.budget / 2 ** 20} MB), oldest evicted`);
  ok(r.out.every(x => x.settled), `element pool: every stream of ${r.out.length} draft-cut frames shows its exact proxy frame (${r.out.map(x => `f${x.f} ${x.layers} in ${x.ms.toFixed(0)} ms`).join(', ')})`);
  ok(r.elements <= 16 && r.overflow === 0, `element pool: ${r.elements} <video> elements for 8 A/B slots, no overflow`);
  log(`8. element pool: ${checks - before} checks`);
}

// ---- 8b. the mouth row in the draft cut, on real footage ---------------------------------------------------------
// Synergy's host tile in the verse: a frame on a sung word and one of the same clip between his
// lines, each drawn with the row and without it (the plate alone). Green excess in the row's box.
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const program = T.compile(T.drop60Draft(T.plan, T.SHOTS, {format:'9:16'}), {plan:T.plan, shots:T.SHOTS});
    const syn = f => program.frame(f).layers.find(l => l.robot && l.canon?.synergy);
    let sung = null, rest = null;
    for (let f = 192; f < 480 && !(sung && rest); f++) { const l = syn(f); if (!l || l.cell.id !== 'stack3.0') continue; if (!sung && l.robot.level > .7) sung = f; else if (sung && !rest && l.clipId === syn(sung).clipId && l.robot.level === 0) rest = f; }
    if (!sung || !rest) return {missing:true, sung, rest};
    const cache = T.createStutterCache(), pool = T.createElementPool({shots:T.real, cache, slots:8});
    pool.setProgram(program);
    const out = {sungF:sung, restF:rest};
    for (const [name, f] of [['sung', sung], ['rest', rest]]) {
      const t0 = performance.now();
      while (performance.now() - t0 < 20000 && !pool.settled(f)) { pool.update(f, f / 24, false); await new Promise(res => setTimeout(res, 25)); }
      const layer = syn(f), m = layer.robot.mouth, box = {x:m.x - m.w / 2, y:m.y - m.h / 2 - 2, w:m.w, h:m.h + 4};
      const green = img => { let g = 0, n = 0; T.region(img, box, q => { g += q[1] - (q[0] + q[2]) / 2; n++; }); return g / n; };
      const a = await T.render(program, f, {shots:T.real, sources:pool.source});
      out[name] = {level:layer.robot.level, with:green(a.img), mouths:a.stats.mouths, box, png:T.png(a.img, {x:Math.max(0, Math.round(box.x - 80)), y:Math.max(0, Math.round(box.y - 120)), w:Math.round(box.w + 160), h:200})};
      const bare = {...program.frame(f), layers:program.frame(f).layers.map(l => l === layer ? {...l, robot:undefined} : l)};
      const c = T.comp(1, 'off', '9:16'); c.drawFrame(bare, pool.source, {program}); out[name].without = green(c.read());
    }
    pool.dispose();
    return out;
  });
  ok(!r.missing, `the draft's verse has Synergy's host tile on a sung word and at rest (f${r.sungF}, f${r.restF})`);
  savePng('mouth-draft-sung.png', r.sung.png); savePng('mouth-draft-rest.png', r.rest.png);
  // Sung, a bright wave runs along the row (7 of 22 bars above the .16 floor at any moment); at rest every bar glows at .11.
  ok(r.sung.mouths >= 1 && r.sung.with - r.sung.without > 1.6 * Math.max(1, r.rest.with - r.rest.without) && r.rest.with - r.rest.without > .5, `draft cut, Synergy's host tile on real footage: the row lights on a sung word (f${r.sungF} level ${r.sung.level.toFixed(2)}: green excess ${r.sung.without.toFixed(1)} → ${r.sung.with.toFixed(1)}) and rests between lines (f${r.restF}: ${r.rest.without.toFixed(1)} → ${r.rest.with.toFixed(1)})`);
  log(`8b. the mouth row on footage: ${checks - before} checks`);
}

// ---- 9. determinism -------------------------------------------------------------------------------------------------
// The same frames in two fresh pages: synthetic cards with every pass on (post, board, chrome,
// Droste, camera), and the draft cut on real proxies through the element pool.
async function hashes(pg) {
  return pg.evaluate(async frames => {
    const clips = [
      {id:'a', at:0, len:32, cell:'G9.0', asset:'shot:card', time:{in:1}, fx:[{type:'rgbSplit', px:6, angle:30}], chrome:{speaking:1}},
      {id:'b', at:0, len:32, cell:'G9.1', asset:'shot:card2', time:{in:1}, fx:[{type:'pegVideo', mix:.7, pitch:10}]},
      {id:'c', at:0, len:32, cell:'G9.2', asset:'shot:card3', time:{in:1}, fx:[{type:'scanline', amount:.4, wobble:3}], chrome:{toast:{at:0, len:16, text:'Tester joined'}}},
      {id:'d', at:0, len:32, cell:'G9.4', asset:'gen:feedback', fx:[{type:'droste', depth:[[0, 0], [32, 3]], scale:.3185}], chrome:{name:'Pat', cameraOff:true}},
      {id:'e', at:0, len:32, cell:'G9.5', asset:'gen:board'}, {id:'f', at:0, len:32, cell:'G9.6', asset:'gen:camera-off'},
    ];
    const p = T.compile(T.createEDL({format:'9:16', clips, board:'song', camera:[{id:'cam', at:0, len:32, zoom:[[0, 1], [32, 2, 'inQuad']], cx:.5, cy:.45}]}), {plan:T.plan, shots:T.fixture, frames:96});
    const out = {synthetic:[], film:[]};
    for (const f of [5, 40, 80]) { const {img} = await T.render(p, f, {scale:.5, post:'on'}); out.synthetic.push(await T.sha(img.data)); }
    const program = T.compile(T.studioFilm(T.plan, T.SHOTS, {format:'9:16'}), {plan:T.plan, shots:T.SHOTS});
    const cache = T.createStutterCache(), pool = T.createElementPool({shots:T.real, cache, slots:8});
    pool.setProgram(program);
    for (const f of frames) {
      const t0 = performance.now();
      while (performance.now() - t0 < 20000 && !pool.settled(f)) { pool.update(f, f / 24, false); await new Promise(r => setTimeout(r, 25)); }
      const {img} = await T.render(program, f, {scale:.5, post:'on', shots:T.real, sources:pool.source});
      out.film.push(await T.sha(img.data));
      if (frames.indexOf(f) < 8) out['png' + f] = T.png(img);
    }
    pool.dispose();
    return out;
  }, FILM_FRAMES);
}
{
  const before = checks;
  const h1 = await hashes(page);
  await page.close();
  const page2 = await freshPage();
  const h2 = await hashes(page2);
  for (const f of FILM_FRAMES) savePng(`film-${String(f).padStart(4, '0')}.png`, h1['png' + f]);
  ok(h1.synthetic.every((h, i) => h === h2.synthetic[i]) && new Set(h1.synthetic).size === 3, `synthetic frames (post, board, chrome, Droste, camera): the same SHA-256 in two fresh pages (${h1.synthetic.map(h => h.slice(0, 12)).join(' ')})`);
  ok(h1.film.every((h, i) => h === h2.film[i]), `draft cut on real proxies, ${FILM_FRAMES.length} frames: the same SHA-256 in two fresh pages (${h1.film.slice(0, 3).map(h => h.slice(0, 12)).join(' ')} …)`);
  page = page2;
  log(`9. determinism: ${checks - before} checks`);
}

// ---- 10. performance (SwiftShader: CPU-emulated GL; compare settings, not devices) -------------------------------------
{
  const before = checks;
  const r = await page.evaluate(async () => {
    const program = T.compile(T.studioFilm(T.plan, T.SHOTS, {format:'9:16'}), {plan:T.plan, shots:T.SHOTS});
    const src = T.sources();
    const fake = l => l.shotId ? {image:T.card('card'), key:'perf', version:1, width:1280, height:720} : null;
    const px = new Uint8Array(4), sync = gl => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };   // finish() does not wait in Chrome
    const time = async (f, scale, post) => {
      const c = T.comp(scale, post, '9:16'); await c.ready; c.prepare(program, {plan:T.plan, shots:T.real, governor:false});
      c.drawFrame(program.frame(f), fake, {program}); sync(c.gl);
      const ms = [];
      for (let i = 0; i < 3; i++) { const t0 = performance.now(); c.drawFrame(program.frame(f), fake, {program}); sync(c.gl); ms.push(performance.now() - t0); }
      return ms.sort((a, b) => a - b)[1];
    };
    const tg = performance.now(); const c = T.comp(.5, 'on', '9:16'); c.prepare(program, {plan:T.plan, shots:T.real, governor:true}); const governorMs = performance.now() - tg, gains = [...c.gains], dimmed = gains.filter(g => g < .999).length, minGain = Math.min(...gains);
    return {g9half:await time(600, .5, 'on'), g9full:await time(600, 1, 'on'), g9noPost:await time(600, .5, 'off'), board:await time(4, .5, 'on'), droste:await time(1170, .5, 'on'), governorMs, gains:dimmed, minGain, compileMs:program.stats.compileMs};
  });
  log(`   SwiftShader, median of 3, drawFrame + a 1-pixel readback: G9 + board strip ${r.g9half.toFixed(0)} ms at 540×960 (${r.g9noPost.toFixed(0)} ms without post), ${r.g9full.toFixed(0)} ms at 1080×1920; full-frame board ${r.board.toFixed(0)} ms; Droste ${r.droste.toFixed(0)} ms`);
  log(`   governor track for 1,440 frames: ${r.governorMs.toFixed(0)} ms, ${r.gains} frames dimmed (lowest gain ${r.minGain.toFixed(2)}); compile ${r.compileMs.toFixed(0)} ms`);
  ok(r.g9half > 0 && r.g9full < 20000, 'performance measured (informational on SwiftShader)');
  log(`10. performance: ${checks - before} checks`);
}

await browser.close(); server.close();
ok(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
log(`frames written to ${OUT}`);
log(`check-compositor: ${checks} checks passed in ${((Date.now() - t00) / 1000).toFixed(0)} s`);
