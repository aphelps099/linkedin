// The compositor (src/videostudio/gl/), the preview's element pool and stutter cache, and
// the studio's draft cut. Node checks first, then headless Chromium on SwiftShader WebGL2.
//   1. the draft cut compiles clean in every format; Pat and the lady are never footage
//   2. pegs light on floor((t + .010)·24): the board's paint time for every frame
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
import {FORMS} from '../src/allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {compile, shotIndex} from '../src/videostudio/edl/compile.js';
import {FX_TYPES} from '../src/videostudio/edl/schema.js';
import {pegFrame} from '../src/videostudio/edl/anchors.js';
import {studioFilm} from '../src/videostudio/studio-film.js';
import {boardGrid} from '../src/videostudio/gl/board-layer.js';
import {PEG_PAINT_LEAD, FX_SUPPORT, boardScreens} from '../src/videostudio/gl/compositor.js';
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
  ok(tested.length >= 10 && tested.every(x => x.before === 0 && x.at > 0), `pegs light on frame floor((t + .010)·24), never a frame late or early: ${tested.length} of the lady's onsets (${tested.slice(0, 3).map(x => `${x.text} ${x.start.toFixed(3)} s → f${x.f}`).join(', ')})`);
  ok(Math.abs(PEG_PAINT_LEAD - (1 / 48 - .010)) < 1e-12 && painted.every((s, i) => Math.abs(p.board.screens[i].from - s.from - 1 / 48) < 1e-12), 'frame f paints the board at f/24 + 1/48 − .010, its screens half a frame early (choreo lights an onset half a frame before it)');
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
      {studioFilm:(await m('/src/videostudio/studio-film.js')).studioFilm}, await m('/src/videostudio/media/element-pool.js'), await m('/src/videostudio/media/stutter-cache.js'));
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
    const cell = T.cellRect('9:16', 'G6.0'), R = {x:cell.x + 16, y:cell.y + 16, w:cell.w - 32, h:cell.h - 80};
    const one = async (fx, extra = {}, f = 6) => {
      const p = T.program([{id:'x', at:0, len:16, cell:'G6.0', asset:'shot:card', time:{in:1}, ...(fx ? {fx} : {}), ...extra}], extra.programOpts || {});
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
    { const p = T.program([{id:'w', at:0, len:16, cell:'G6.0', asset:'gen:white', frame:{opacity:.5}, chrome:{name:''}}]); img = (await T.render(p, 6)).img; out.opacity = T.px(img, cell.x + cell.w / 2, cell.y + cell.h / 2); keep('opacity-0.5', img); }
    // echo: a tile sliding right leaves trail copies of its earlier positions
    { const move = {frame:{dx:[[0, 0], [16, 260]]}}; const a = await one(null, move, 24), b = await one([{type:'echo', taps:3, frames:2, decay:.6}], move, 24); keep('echo-3', b);
      const bg = img => { let n = 0; T.region(img, {x:cell.x + 2, y:cell.y + 2, w:cell.w - 4, h:cell.h - 60}, p => { if (Math.abs(p[0] - 16) < 3 && Math.abs(p[2] - 20) < 3) n++; }); return n; };
      out.echo = {plain:bg(a), echo:bg(b)}; }
    // Droste: the feedback tile holds the whole frame at .3, one level deep
    { const p = T.program([{id:'fb', at:0, len:16, cell:'G6.0', asset:'gen:feedback', fx:[{type:'droste', depth:1, scale:.3, cx:.5, cy:.5}], chrome:{name:'Pat', cameraOff:true}}, {id:'w', at:0, len:16, cell:'G6.1', asset:'gen:white', chrome:{name:''}}, {id:'red', at:0, len:16, cell:'G6.5', asset:'gen:color:#ff0000', chrome:{name:''}}]);
      const r = await T.render(p, 6); img = r.img; keep('droste-1', img);
      const at = (P) => [cell.x + cell.w / 2 + (P[0] - 540) * .3, cell.y + cell.h / 2 + (P[1] - 960) * .3];
      const c1 = T.cellRect('9:16', 'G6.1'), c5 = T.cellRect('9:16', 'G6.5');
      out.droste = {red:T.px(img, ...at([c5.x + c5.w / 2, c5.y + c5.h / 2])), white:T.px(img, ...at([c1.x + c1.w / 2, c1.y + c1.h / 2])), levels:r.stats.droste}; }
    // the composite camera: zoom 2 about the centre
    { const p = T.program([{id:'red', at:0, len:16, cell:'G6.5', asset:'gen:color:#ff0000', chrome:{name:''}}], {camera:[{id:'cam', at:0, len:16, zoom:2, cx:.5, cy:.5}]});
      img = (await T.render(p, 6)).img; const c5 = T.cellRect('9:16', 'G6.5'); out.camera = {moved:T.px(img, 540 + (c5.x + 40 - 540) * 2, 960 + (c5.y + 40 - 960) * 2), old:T.px(img, c5.x + 10, c5.y + 10)}; }
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
  ok(res.echo.echo < res.echo.plain * .7, `echo 3 taps: the trail covers what a sliding tile uncovers (${res.echo.plain} background pixels without, ${res.echo.echo} with)`);
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
    x = await T.render(p, st, {scale:.5}); out.png2 = T.png(x.img); out.stripStack = lit(x.img, {x:12, y:1868, w:1056, h:48}, .5); out.boardRect = p.frame(st).board.rect;
    x = await T.render(p, impact - 1, {scale:.5}); out.png3 = T.png(x.img); out.black = (() => { let m = 0; T.region(x.img, {x:0, y:0, w:540, h:960}, q => { m = Math.max(m, T.luma(q)); }); return m; })();
    x = await T.render(p, impact, {scale:.5}); out.png4 = T.png(x.img); out.ignite = lum(x.img, {x:0, y:0, w:1080, h:1920}, .5);
    x = await T.render(p, choke + 8, {scale:.5}); out.png5 = T.png(x.img); out.tag = lit(x.img, {x:0, y:0, w:1080, h:1920}, .5); out.tagScreen = p.board.screens[p.frame(choke + 8).board.screen]?.text;
    return out;
  });
  ['board-strip', 'board-stack3', 'board-true-black', 'board-ignition', 'board-tag'].forEach((n, i) => savePng(`${n}.png`, r[`png${i + 1}`]));
  ok(r.stripOn > 400 && r.above === 0, `G6 at frame ${r.on}: "${r.screen}" lit in the board strip y ${r.strip.y}-${r.strip.y + r.strip.h} (${r.stripOn} lit px at half size), nothing above the tiles`);
  ok(r.tile > 100, `gen:board: the same screen inside its tile G6.3 (${r.tile} lit px)`);
  ok(r.boardRect === null && r.stripStack === 0, `stack3 at frame ${r.st} has no board region and draws none`);
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
