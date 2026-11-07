// Day One: the acceptance checks (docs/day-one-film.md, spec 8), on a render's output folder.
//
//   node scripts/check-day-one.mjs --dir OUT [--compare OUT2] [--refs DIR] [--no-page] [--no-video]
//
//   static   the clock (ticks, landmarks, accents), the rows (uniform waves, the company, the
//            word "LinkedIn" only in the robot's name), the avatars (faceBox null, no Pat, no crop
//            twice within 12 rows, about 35% silhouettes)
//   page     the DOM lint at 12 sample times (weights 400/600, sizes 12/14, token colours, no
//            green type, "…more" with U+2026, counts and degrees and times as LinkedIn writes
//            them, no LinkedIn icon artwork, no initials avatars), random-access frames against the
//            render's hashes (seek alone = in sequence), row pitches, the speed limit, the jokes'
//            legibility (each special row in view for its dwell)
//   video    format (1080x1920, 30/1 CFR, 1,764 frames, H.264 yuv420p, AAC 320k 48 kHz,
//            faststart, audio and video within a frame), sync (340 at frame 864, 1,204 at 1656,
//            a tick within a frame of every counter change, the wall's 16 rows on their 8ths,
//            "grats" at 396 and 1656 from the score's marks), flashes (src/pegboard/governor.js,
//            whole frame and quadrants, at most 3 a second)
//   audio    -10 +/-0.5 LUFS, true peak <= -1 dBTP, digital silence B91-B92 and on the tail
//   compare  two runs: identical frame hashes and identical WAVs
// --refs DIR: LinkedIn's reaction SVGs from the UI study, to prove none of their paths ships.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import * as T from '../src/films/day-one/timeline.js';
import {prepare} from '../src/films/day-one/rows.js';
import {flashes, worstWindow} from '../src/pegboard/governor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = n => argv.includes(`--${n}`);
const DIR = path.resolve(arg('dir', path.join(ROOT, 'out', 'day-one')));
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const results = [];
const check = (group, name, ok, detail = '') => { results.push({group, name, ok:!!ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? `: ${detail}` : ''}`); };
const note = (group, name, detail) => { results.push({group, name, ok:null, detail}); console.log(`NOTE  [${group}] ${name}: ${detail}`); };

const SCRIPT = json(path.join(ROOT, 'src/films/day-one/script.json'));
const AVATARS = json(path.join(ROOT, 'src/films/day-one/avatars.json'));
const SHOTS = json(path.join(ROOT, 'src/videostudio/media/shots.json')).shots;
const TL = fs.existsSync(path.join(DIR, 'timeline.json')) ? json(path.join(DIR, 'timeline.json')) : null;
const company = TL?.company ?? T.COMPANY;

// ---- static -------------------------------------------------------------------------------------
{
  const tk = T.ticks();
  check('clock', 'film is 1,764 frames at 30 fps, 100 BPM', T.FRAMES === 1764 && T.FPS === 30 && Math.abs(T.BEAT - .6) < 1e-12);
  check('clock', 'counter is monotone, never a zero step', tk.every((k, i) => i === 0 || (k.comments >= tk[i - 1].comments && k.reactions >= tk[i - 1].reactions && k.reposts >= tk[i - 1].reposts && k.t > tk[i - 1].t)) && tk.every(k => k.step > 0));
  const at = n => tk.find(k => k.comments === n);
  check('clock', '340 first at frame 864 (B48), accented', at(340)?.frame === 864 && at(340)?.accent);
  check('clock', '1,204 at frame 1656 (B92), accented', at(1204)?.frame === 1656 && at(1204)?.accent);
  check('clock', 'every landmark lands on its beat', T.LANDMARKS.every(L => { const k = tk.find(x => x.B === L.B); return k && k.comments === L.comments && k.reactions === L.reactions && k.reposts === L.reposts; }));
  const wallTicks = tk.filter(k => k.B >= 74 && k.B < 82).length;
  check('clock', 'ticks on 16ths through the wall', wallTicks === 32, `${wallTicks}`);
  check('clock', 'no jumps between B88 and B92', !tk.some(k => k.B > 88 && k.B < 92));
  const data = prepare(SCRIPT, AVATARS, company), all = data.all;
  const text = JSON.stringify(data);
  check('copy', `company is ${company}; "Brightwell" never shows`, !/Brightwell/.test(text) && text.includes(company));
  const li = all.filter(r => /LinkedIn/.test(r.name + r.headline + r.plain));
  check('copy', '"LinkedIn" only in the robot\'s name', li.length === 1 && li[0].n === 70 && li[0].name === 'LinkedIn Member' && !/LinkedIn/.test(JSON.stringify(data.post)));
  check('copy', 'robot: no headline, no degree', all.find(r => r.n === 70).headline === '' && all.find(r => r.n === 70).degree === '');
  check('copy', 'wave rows: no pronouns, no reaction counts, one line of text', all.filter(r => r.uniform).every(r => !r.pronouns && r.reactions === 0));
  check('copy', 'comment times never older than 1d', all.every(r => /^(\d{1,2}[mh]|1d)( \(edited\))?$/.test(r.time)), [...new Set(all.map(r => r.time))].join(' '));
  check('copy', 'names avoid the cast (no Linda, no Arjun)', !all.some(r => /\b(Linda|Arjun)\b/.test(r.name)));
  // Avatars
  const crops = Object.entries(AVATARS.crops);
  const shotOk = crops.every(([, c]) => { const s = SHOTS.find(x => x.id === c.shot); return s && s.faceBox === null && ['Office scenes', 'Instruments'].includes(s.category) && !s.characters.includes('Pat'); });
  check('canon', 'every avatar crop is from a face-free Office/Instrument shot, no Pat', shotOk, `${crops.length} crops`);
  const seq = Object.entries(AVATARS.assign).map(([n, a]) => [+n, a]).sort((a, b) => a[0] - b[0]);
  const repeats = seq.filter(([n, a], i) => !['silhouette', 'jamie'].includes(a) && seq.slice(Math.max(0, i - 11), i).some(([, b]) => b === a));
  check('canon', 'no crop repeats within 12 rows', repeats.length === 0, repeats.map(r => r.join(':')).join(' '));
  const sil = seq.filter(([, a]) => a === 'silhouette').length / seq.length;
  check('canon', 'about 35% silhouettes (robot, Doug among them)', sil > .3 && sil < .42 && AVATARS.assign['70'] === 'silhouette' && AVATARS.assign['94'] === 'silhouette', `${(sil * 100).toFixed(0)}%`);
  for (const f of fs.readdirSync(path.join(ROOT, 'public/films/day-one/avatars'))) if (!crops.some(([, c]) => Object.values(c.files).includes(f))) check('canon', `stray avatar file ${f}`, false);
}

// ---- page ---------------------------------------------------------------------------------------
const REFS = arg('refs', path.resolve(ROOT, '../study-ui/ref-icons'));
async function pageChecks() {
  const {createServer} = await import('vite');
  const srv = await createServer({root:ROOT, configFile:path.join(ROOT, 'vite.config.js'), cacheDir:path.join(os.tmpdir(), 'day-one-vite'), logLevel:'error', server:{port:0, host:'127.0.0.1', hmr:false}});
  await srv.listen();
  const origin = `http://127.0.0.1:${srv.httpServer.address().port}`;
  const {chromium} = require('playwright-core');
  const exe = (() => { const pool = process.env.PLAYWRIGHT_BROWSERS_PATH; if (pool && fs.existsSync(pool)) for (const d of fs.readdirSync(pool).sort().reverse()) { const p = `${pool}/${d}/chrome-linux64/chrome`; if (d.startsWith('chromium-') && fs.existsSync(p)) return p; } return undefined; })();
  const browser = await chromium.launch(arg('channel') ? {channel:arg('channel')} : {executablePath:exe});
  const dpr = TL?.preview ? 1.5 : 3;
  const ctx = await browser.newContext({viewport:{width:360, height:640}, deviceScaleFactor:dpr});
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/films/day-one/index.html${TL?.company && TL.company !== T.COMPANY ? `?company=${encodeURIComponent(TL.company)}` : ''}`);
  await page.waitForFunction(() => window.__dayOne?.ready);
  await page.evaluate(() => window.__dayOne.ready);
  const layout = await page.evaluate(() => window.__dayOne.layout);
  check('page', 'loads without errors', errors.length === 0, errors.join(' | '));

  // The DOM lint at 12 sample times.
  const TOKENS = ['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.75)', 'rgb(10, 102, 194)', 'rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.15)', 'rgb(243, 242, 240)', 'rgb(255, 255, 255)',
    'rgb(235, 235, 235)', 'rgb(102, 102, 102)', 'rgb(58, 134, 220)', 'rgb(95, 160, 70)', 'rgb(224, 108, 76)', 'rgb(242, 182, 82)', 'rgb(233, 229, 223)', 'rgb(157, 179, 200)', 'rgb(120, 143, 165)',
    'rgb(124, 77, 204)', 'rgb(94, 158, 69)', 'rgba(0, 0, 0, 0)', 'none', 'currentcolor'];
  const SAMPLES = [0, 1.5, 6, 12.6, 13.5, 20.4, 24.6, 28.8, 33, 42, 46.2, 55.5];
  let lintFail = [];
  for (const t of SAMPLES) {
    await page.evaluate(x => window.__dayOne.seekPainted(x), t);
    const r = await page.evaluate(TOKENS => {
      const bad = [], vis = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length; };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const texts = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.trim() && vis(n.parentElement)) texts.add(n.parentElement);
      for (const el of texts) {
        const cs = getComputedStyle(el);
        if (!['400', '600'].includes(cs.fontWeight)) bad.push(`weight ${cs.fontWeight}: ${el.textContent.slice(0, 30)}`);
        if (!['12px', '14px'].includes(cs.fontSize)) bad.push(`size ${cs.fontSize}: ${el.textContent.slice(0, 30)}`);
        if (!TOKENS.includes(cs.color)) bad.push(`colour ${cs.color}: ${el.textContent.slice(0, 30)}`);
        const m = cs.color.match(/\d+(\.\d+)?/g).map(Number);
        if (m[1] > m[0] + 20 && m[1] > m[2] + 20) bad.push(`green type: ${el.textContent.slice(0, 30)}`);
      }
      for (const el of document.querySelectorAll('body *')) {
        if (!vis(el)) continue;
        const cs = getComputedStyle(el);
        for (const p of ['backgroundColor', 'borderTopColor', 'fill', 'stroke']) {
          const v = cs[p];
          if (p === 'borderTopColor' && cs.borderTopWidth === '0px') continue;
          if ((p === 'fill' || p === 'stroke') && !(el instanceof SVGGeometryElement && !el.closest('clipPath'))) continue;
          if (v && !TOKENS.includes(v) && !v.startsWith('url(')) bad.push(`${p} ${v} on ${el.tagName}.${el.getAttribute('class') ?? ''}`);
        }
      }
      // Microcopy
      const body = document.body.innerText;
      const more = [...document.querySelectorAll('.more')].filter(vis).map(e => e.textContent);
      const counts = [...document.querySelectorAll('[data-n="right"]')].map(e => e.textContent);
      const degrees = [...document.querySelectorAll('.deg, .c-who .sm')].filter(vis).map(e => e.textContent).filter(s => s.includes('•'));
      const times = [...document.querySelectorAll('.c-time')].filter(vis).map(e => e.textContent);
      const imgs = [...document.querySelectorAll('img')].map(i => new URL(i.src).pathname);
      const avatars = [...document.querySelectorAll('.av')].filter(vis).map(a => a.querySelector('img') ? 'img' : a.querySelector('svg.silhouette') ? 'silhouette' : a.textContent.trim() ? 'initials' : 'empty');
      const paths = [...document.querySelectorAll('svg path')].map(p => p.getAttribute('d'));
      return {bad, more, counts, degrees, times, imgs, avatars, paths, linkedin:(body.match(/LinkedIn/g) || []).length, linkedinMember:(body.match(/LinkedIn Member/g) || []).length};
    }, TOKENS);
    if (r.bad.length) lintFail.push(`t=${t}: ${[...new Set(r.bad)].slice(0, 6).join('; ')}`);
    if (r.more.some(m => m !== '\u2026more')) lintFail.push(`t=${t}: more reads ${r.more}`);
    if (!r.counts.every(c => /^(\d{1,3}(,\d{3})* comments?)( • \d{1,3}(,\d{3})* reposts?)?$/.test(c) && !/^1 comments|• 1 reposts|^0 /.test(c))) lintFail.push(`t=${t}: counts ${r.counts}`);
    if (!r.degrees.every(d => /^ • (1st|2nd|3rd\+)$/.test(d))) lintFail.push(`t=${t}: degrees ${r.degrees}`);
    if (!r.times.every(x => /^(\d{1,2}[mh]|1d)( \(edited\))?$/.test(x))) lintFail.push(`t=${t}: times ${r.times}`);
    if (!r.imgs.every(p => p.startsWith('/films/day-one/avatars/'))) lintFail.push(`t=${t}: images ${r.imgs}`);
    if (r.avatars.some(a => a === 'initials' || a === 'empty')) lintFail.push(`t=${t}: avatars ${r.avatars}`);
    if (r.linkedin !== r.linkedinMember) lintFail.push(`t=${t}: "LinkedIn" outside the robot's name`);
    if (t === SAMPLES[0] && fs.existsSync(REFS)) {
      const ref = fs.readdirSync(REFS).flatMap(f => [...fs.readFileSync(path.join(REFS, f), 'utf8').matchAll(/\sd="([^"]+)"/g)].map(m => m[1].replace(/\s+/g, '')));
      const shipped = new Set(r.paths.map(d => (d || '').replace(/\s+/g, '')));
      const hit = ref.filter(d => shipped.has(d));
      check('canon', 'no LinkedIn icon artwork (no path from the study\'s reaction SVGs ships)', hit.length === 0 && ref.length > 0, `${ref.length} reference paths, ${hit.length} shipped`);
    }
  }
  check('page', 'DOM lint at 12 sample times (weights, sizes, token colours, no green type, "…more", counts, degrees, times, avatars, "LinkedIn")', lintFail.length === 0, lintFail.slice(0, 4).join(' || '));

  // Row pitches: uniform rows 114 (with a headline).
  const rows = Object.entries(layout.rows).map(([n, r]) => [+n, r]).sort((a, b) => a[0] - b[0]);
  const pitch = rows.slice(1).map(([n, r], i) => [rows[i][0], r.top - rows[i][1].top]);
  const uni = pitch.filter(([n]) => T.waveOf(n) && T.waveOf(n) > 0 && T.waveOf(n + 1) === T.waveOf(n));
  check('pattern', 'uniform rows pitch exactly 114 px', uni.every(([, p]) => Math.abs(p - 114) < .01), `${uni.length} pitches; ${[...new Set(uni.map(([, p]) => p.toFixed(2)))].join(', ')}`);
  check('page', 'row 12 replaces "Load more comments" at the same y', Math.abs(layout.rows[12].top - layout.loadMore.top) < .5, `${layout.rows[12].top} vs ${layout.loadMore.top}`);

  // Camera: the speed limit for every content point in view, the arrivals, the jokes' dwell.
  const cam = T.buildCamera(layout);
  let worst = 0, worstAt = 0;
  for (let f = 1; f < T.FRAMES; f++) {
    const t0 = (f - 1) / T.FPS, t1 = f / T.FPS, a0 = cam.a(t0), a1 = cam.a(t1), k0 = T.kAt(t0), k1 = T.kAt(t1);
    for (let sy = T.BAR_H * k1; sy <= 640; sy += 4) {           // a content point at sy in frame f: where was it in f-1?
      const y = a1 + (sy - T.READ_Y) / k1, sy0 = T.READ_Y + (y - a0) * k0;
      const d = Math.abs(sy - sy0);
      if (d > worst) { worst = d; worstAt = f; }
    }
  }
  check('camera', 'speed limit: no content point in view moves more than 13 px a frame', worst <= 13, `${worst.toFixed(2)} px at frame ${worstAt}`);
  const arr = cam.arrivals, off = [];
  for (let r = 71; r <= 86; r++) { const f = arr[r].t * 30, want = (74 + (r - 71) / 2) * 18; if (Math.abs(f - want) > 1) off.push(`${r}@${f.toFixed(2)}`); }
  check('sync', 'the wall: rows 71-86 arrive within a frame of their 8ths', off.length === 0, off.join(' '));
  const offAll = [];
  for (const w of T.WAVES) w.rows.forEach((r, i) => { const want = (w.B + i * w.every) * 18, f = arr[r].t * 30; if (r !== 12 && Math.abs(f - want) > 1) offAll.push(`${r}:${(f / 18).toFixed(2)}/${w.B + i * w.every}`); });
  for (const s of T.SPECIALS) { const f = arr[s.row].t * 30; if (Math.abs(f - s.B * 18) > 1) offAll.push(`special ${s.row}:${(f / 18).toFixed(2)}/${s.B}`); }
  if (offAll.length) note('sync', 'rows off their designed beat by more than a frame', offAll.join(' '));
  else check('sync', 'every wave and special row arrives within a frame of its beat', true);
  const dwellFail = [];
  for (const s of T.SPECIALS) {
    const D = s.launch - s.B + 1;
    for (let B = s.B; B <= s.B + D; B += 1 / 18) {
      const t = B * T.BEAT, k = T.kAt(t), a = cam.a(t), row = layout.rows[s.row];
      const top = T.READ_Y + (row.top - a) * k, bottom = T.READ_Y + (row.top + row.height - a) * k;
      if (top < T.BAR_H * k - .5 || top > T.READ_Y + .5 || bottom > 640) { dwellFail.push(`${s.row} at B${B.toFixed(2)} top ${top.toFixed(1)}`); break; }
    }
  }
  check('legibility', 'each special row is on screen, at or above the reading line, for its dwell', dwellFail.length === 0, dwellFail.join(' '));

  // Random-access frames against the render's hashes.
  if (TL?.frameHashes?.length && !flag('no-determinism')) {
    const client = await ctx.newCDPSession(page);
    const SHOT = {format:'png', optimizeForSpeed:true, captureBeyondViewport:false, clip:{x:0, y:0, width:360, height:640, scale:dpr}};
    const [from] = TL.span, picks = [];
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 12; i++) picks.push(from + Math.floor(rnd() * TL.frameHashes.length));
    picks.push(from + TL.frameHashes.length - 1, from, 864 - from >= 0 ? 864 : from);
    const mism = [];
    for (const f of picks) {
      if (f - from < 0 || f - from >= TL.frameHashes.length) continue;
      await page.evaluate(t => window.__dayOne.seekPainted(t), f / 30);
      const {data} = await client.send('Page.captureScreenshot', SHOT);
      const h = createHash('sha1').update(Buffer.from(data, 'base64')).digest('hex').slice(0, 16);
      if (h !== TL.frameHashes[f - from]) mism.push(f);
    }
    check('determinism', `seeking to a frame alone gives the in-sequence frame byte for byte (${picks.length} frames, out of order, in a fresh page)`, mism.length === 0, mism.join(' '));
  }
  await browser.close(); await srv.close();
}

// ---- video --------------------------------------------------------------------------------------
function videoChecks() {
  const mp4 = path.join(DIR, 'day-one.mp4');
  if (!fs.existsSync(mp4)) { check('format', 'day-one.mp4 exists', false); return; }
  const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', mp4]).toString());
  const v = pr.streams.find(s => s.codec_type === 'video'), a = pr.streams.find(s => s.codec_type === 'audio');
  const full = TL && TL.span[0] === 0 && TL.span[1] === T.FRAMES;
  const want = TL?.preview ? [540, 960] : [1080, 1920];
  check('format', `${want.join('x')}, H.264 High yuv420p, BT.709`, v.width === want[0] && v.height === want[1] && v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p' && v.color_space === 'bt709', `${v.width}x${v.height} ${v.codec_name} ${v.profile} ${v.pix_fmt} ${v.color_space}`);
  check('format', '30/1 CFR', v.r_frame_rate === '30/1' && v.avg_frame_rate === '30/1', `${v.r_frame_rate} ${v.avg_frame_rate}`);
  if (full) check('format', '1,764 frames', +v.nb_read_frames === T.FRAMES, v.nb_read_frames);
  const silent = TL?.audio?.source === 'silent';
  check('format', `AAC${silent ? '' : ' 320k'} 48 kHz stereo`, a && a.codec_name === 'aac' && +a.sample_rate === 48000 && a.channels === 2 && (silent || Math.abs(+a.bit_rate - 320000) < 40000), a && `${a.codec_name} ${a.sample_rate} ${a.bit_rate}`);
  const head = fs.readFileSync(mp4).subarray(0, 64 * 1024).toString('latin1');
  check('format', 'faststart (moov before mdat)', head.indexOf('moov') >= 0 && (head.indexOf('mdat') < 0 || head.indexOf('moov') < head.indexOf('mdat')));
  check('format', 'audio and video lengths within one frame', a && Math.abs(+a.duration - +v.duration) <= 1 / 30 + 1e-3, a && `${(+v.duration).toFixed(4)} vs ${(+a.duration).toFixed(4)}`);
  if (TL?.audio?.source === 'silent') note('format', 'audio', 'this render is silent (no score yet): mux with --audio FILE');

  // Sync from the render's frame states.
  if (TL) {
    const fs0 = TL.frameStates, first = n => fs0.find(s => s.comments === n)?.f;
    if (full) {
      check('sync', '340 first shows at frame 864', first(340) === 864, `${first(340)}`);
      check('sync', '1,204 first shows at frame 1656', first(1204) === 1656, `${first(1204)}`);
    }
    const tk = (TL.audio?.marks?.ticks?.length ? TL.audio.marks.ticks : TL.ticks);
    const changes = fs0.filter((s, i) => i > 0 && (s.comments !== fs0[i - 1].comments || s.reactions !== fs0[i - 1].reactions || s.reposts !== fs0[i - 1].reposts)).map(s => s.f);
    const orphan = changes.filter(f => !tk.some(k => Math.abs(k.t * 30 - f) <= 1));
    check('sync', `every counter change on screen has a tick within a frame (${changes.length} changes${TL.audio?.marks?.ticks?.length ? ', the score\'s ticks' : ', the clock\'s ticks'})`, orphan.length === 0, orphan.join(' '));
    const g = TL.audio?.marks?.grats;
    if (g?.length) {
      for (const [want, part] of [[396, 'voice1'], [1656, 'final']]) {
        const m = g.find(x => x.part === part);
        check('sync', `"grats" of ${part} within a frame of ${want}`, m && Math.abs(m.t * 30 - want) <= 1, m && `${(m.t * 30).toFixed(2)}`);
      }
    } else note('sync', '"grats"', 'no score marks in this render');
  }

  // Flashes: relative luminance of every frame, whole and quadrants.
  const w = 36, h = 64;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', `scale=${w}:${h}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], {maxBuffer:1 << 30});
  const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const LUT = Float64Array.from({length:256}, (_, i) => lin(i));
  const n = raw.length / (w * h * 3), whole = [], quads = [[], [], [], []];
  for (let f = 0; f < n; f++) {
    const q = [0, 0, 0, 0]; let tot = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (f * w * h + y * w + x) * 3, L = .2126 * LUT[raw[i]] + .7152 * LUT[raw[i + 1]] + .0722 * LUT[raw[i + 2]];
      tot += L; q[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)] += L;
    }
    whole.push(tot / (w * h)); q.forEach((v, k) => quads[k].push(v / (w * h / 4)));
  }
  const worstW = worstWindow(flashes(whole, 30), 30), worstQ = Math.max(...quads.map(s => worstWindow(flashes(s, 30), 30)));
  const minL = Math.min(...whole), maxStep = Math.max(...whole.slice(1).map((v, i) => Math.abs(v - whole[i])));
  check('canon', 'flashes: at most 3 a second, whole frame and each quadrant (governor.js)', worstW <= 3 && worstQ <= 3, `whole ${worstW}, quadrants ${worstQ}; luminance ${minL.toFixed(3)}-${Math.max(...whole).toFixed(3)}, largest frame-to-frame step ${maxStep.toFixed(4)}`);
}

// ---- audio --------------------------------------------------------------------------------------
function audioChecks() {
  const wav = path.join(DIR, 'day-one.wav');
  if (!fs.existsSync(wav) || TL?.audio?.source === 'silent') { note('audio', 'loudness', 'no WAV in this render'); return; }
  const err = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding:'utf8'}).stderr.split('Summary:').pop();
  const I = +(err.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1], P = +(err.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1];
  check('audio', '-10 +/-0.5 LUFS integrated', Math.abs(I + 10) <= .5, `${I} LUFS`);
  check('audio', 'true peak <= -1 dBTP', P <= -1, `${P} dBTP`);
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], {maxBuffer:1 << 30});
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4), sr = 48000;
  const maxAbs = (t0, t1) => { let m = 0; for (let i = Math.round(t0 * sr) * 2; i < Math.min(x.length, Math.round(t1 * sr) * 2); i++) m = Math.max(m, Math.abs(x[i])); return m; };
  // From B91 to the final voice's first sample (its "grats" lands on B92, so it starts a little before).
  const gap = TL?.audio?.marks?.silence?.[0] ?? {from:T.tOf(91), to:T.tOf(92)};
  check('audio', `digital silence from B91 to the final voice (${gap.from.toFixed(3)}-${gap.to.toFixed(3)} s)`, maxAbs(gap.from, gap.to - 1 / sr) === 0, `${maxAbs(gap.from, gap.to - 1 / sr)}`);
  const tail = TL?.audio?.marks?.silence?.[1];
  if (tail) check('audio', 'digital silence on the tail', maxAbs(tail.from, T.DURATION) === 0, `from ${tail.from.toFixed(3)} s`);
}

function compareChecks() {
  const other = arg('compare', null);
  if (!other || !TL) return;
  const B2 = json(path.join(path.resolve(other), 'timeline.json'));
  const diff = TL.frameHashes.map((h, i) => h === B2.frameHashes[i] ? null : i + TL.span[0]).filter(x => x !== null);
  check('determinism', 'two runs give identical PNGs', diff.length === 0 && TL.frameHashes.length === B2.frameHashes.length, `${diff.length} differ ${diff.slice(0, 8).join(' ')}`);
  const wa = path.join(DIR, 'day-one.wav'), wb = path.join(path.resolve(other), 'day-one.wav');
  if (fs.existsSync(wa) && fs.existsSync(wb)) {
    const h = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    check('determinism', 'two runs give identical WAVs', h(wa) === h(wb));
  }
}

if (TL?.fonts) {
  const f = Object.values(TL.fonts).join(' ');
  if (process.platform === 'darwin' || /SF|System Font/.test(f)) check('mac', 'the font log reads SF Pro', /SF|System Font/.test(f), f.slice(0, 120));
  else note('mac', 'fonts', `this render used ${[...new Set(Object.values(TL.fonts).flatMap(s => s.split(', ').map(x => x.split(' (')[0])).filter(Boolean))].join(', ')} (SF Pro on the Mac)`);
}
if (!flag('no-page')) await pageChecks();
if (!flag('no-video') && TL) { videoChecks(); audioChecks(); }
compareChecks();
const fails = results.filter(r => r.ok === false);
console.log(`\n${results.filter(r => r.ok).length} passed, ${fails.length} failed, ${results.filter(r => r.ok === null).length} notes`);
fs.writeFileSync(path.join(DIR, 'check.json'), JSON.stringify(results, null, 1));
process.exit(fails.length ? 1 : 0);
