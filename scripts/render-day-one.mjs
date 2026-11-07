// Day One: the one command. Renders the film (a LinkedIn post whose comments roll like a
// credit roll) from its page, frame by frame, and muxes it with the score.
//
//   node scripts/render-day-one.mjs --out DIR [--company X] [--from s --to s] [--preview]
//       [--channel chrome] [--audio FILE | --silent] [--stills] [--url http://127.0.0.1:5173]
//       [--frames 0,792,3312]   (those frames as PNG stills only, for review)
//       [--remux]               (keep DIR/day-one.mp4's picture; render the score again, or take --audio FILE, and mux it)
//
// Starts Vite on a free port (the project's config) unless --url, opens Chromium at 360x640
// CSS px and deviceScaleFactor 3 (1080x1920; --preview: 1.5, 540x960), waits for the page's
// ready (fonts measured, avatars decoded), and logs the font each kind of text resolves to
// (CDP CSS.getPlatformFontsForNode: SF Pro on a Mac, Inter in the cloud container). Then:
//   1. the audio: the page renders score.js offline (48 kHz stereo) into DIR/day-one.wav;
//      --audio FILE uses a finished file instead; --silent (or no score yet) renders silence
//   2. each frame: seek(f/60), a PNG screenshot, piped into ffmpeg (image2pipe)
//   3. H.264 High (level 4.2), CRF 14 (preview 20), yuv420p, BT.709, 60 fps CFR; AAC 320k 48 kHz; +faststart
// Writes DIR/day-one.mp4, DIR/day-one.wav, DIR/timeline.json (the clock, the layout, the
// arrivals, the ticks, every frame's hash), DIR/contact-sheet.png (a frame every 1.5 s) and,
// with --stills, the key beats at full size in DIR/stills/.
//
// --channel chrome renders with the installed Google Chrome instead of Playwright's Chromium.
// --from/--to render a span (seconds); the audio is cut to the same span.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {FPS, FRAMES, BEAT, frameOf} from '../src/films/day-one/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; };
const flag = name => argv.includes(`--${name}`);

const OUT = path.resolve(arg('out', path.join(ROOT, 'out', 'day-one')));
const PREVIEW = flag('preview');
const DPR = PREVIEW ? 1.5 : 3;
const from = Math.max(0, Math.round(+arg('from', 0) * FPS)), to = Math.min(FRAMES, Math.round(+arg('to', FRAMES / FPS) * FPS));
const company = arg('company', null);
// CDP's screenshot is in CSS px unless the clip carries the device scale.
const SHOT = {format:'png', optimizeForSpeed:true, captureBeyondViewport:false, clip:{x:0, y:0, width:360, height:640, scale:DPR}};
const log = (...a) => console.log(`[day-one ${new Date().toISOString().slice(11, 19)}]`, ...a);
// The key beats, at full size (frame = the first frame showing beat B).
const STILL_BEATS = [[0, 'thumbnail'], [2, 'more opens'], [7, 'burst'], [10, 'sticks'], [11.5, 'warm Dana'], [16, 'warm Mom and Tess'], [20, 'load more'], [21.1, 'pressed'], [21.7, 'spinner'],
  [22, 'wave 1'], [27, 'Jordan'], [30, 'wave 2'], [35.5, 'recruiter'], [38.5, 'wave 3'], [41.5, 'well deserved'], [48, 'lets connect 340'], [57, 'vendor'], [62, 'pattern 1x'], [65, 'claps'], [67, 'insightful'],
  [70.5, 'anniversary'], [73, 'pull-back'], [76, 'wall'], [80, 'wall'], [82, 'push-in'], [85, 'slowing'], [88, 'jamie'], [91.9, 'B92 minus'], [92, 'doug 1204'], [(FRAMES - 1) / (FPS * BEAT), 'last frame']];
export const STILLS = Object.fromEntries(STILL_BEATS.map(([B, what]) => { const f = Math.min(FRAMES - 1, frameOf(B)); return [f, `B${+B.toFixed(2)} ${what}`]; }));

function chromiumPath() {
  const pool = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pool && fs.existsSync(pool)) for (const d of fs.readdirSync(pool).sort().reverse()) {
    for (const p of [`${pool}/${d}/chrome-linux/chrome`, `${pool}/${d}/chrome-linux64/chrome`]) if (d.startsWith('chromium-') && fs.existsSync(p)) return p;
  }
  return undefined;   // Playwright's own (npx playwright install chromium), as on the Mac
}

async function server() {
  const url = arg('url', null);
  if (url) return {origin:url.replace(/\/$/, ''), close:async () => {}};
  const {createServer} = await import('vite');
  const s = await createServer({root:ROOT, configFile:path.join(ROOT, 'vite.config.js'), cacheDir:path.join(os.tmpdir(), 'day-one-vite'),
    logLevel:'error', clearScreen:false, server:{port:0, host:'127.0.0.1', hmr:false}});
  await s.listen();
  return {origin:`http://127.0.0.1:${s.httpServer.address().port}`, close:() => s.close()};
}

// The font each kind of text resolves to, from Chrome itself.
async function fontLog(client) {
  await client.send('DOM.enable'); await client.send('CSS.enable');
  const {root} = await client.send('DOM.getDocument', {depth:-1});
  const out = {};
  for (const [label, sel] of [['name 14/600', '.lockup .name-line .n'], ['commentary 14/400', '.commentary-clamp'], ['comment 14/400', '.c[data-row="1"] .c-text'], ['comment name 14/600', '.c[data-row="1"] .c-n'],
    ['headline 12/400', '.lockup .headline'], ['actions 12/600', '.act span'], ['emoji', '.c[data-row="4"] .c-text']]) {
    const {nodeId} = await client.send('DOM.querySelector', {nodeId:root.nodeId, selector:sel});
    if (!nodeId) { out[label] = 'missing'; continue; }
    const {fonts} = await client.send('CSS.getPlatformFontsForNode', {nodeId});
    out[label] = fonts.map(f => `${f.familyName}${f.postScriptName ? ` (${f.postScriptName})` : ''} x${f.glyphCount}`).join(', ');
  }
  return out;
}

async function pull(page, name, size) {
  const parts = [], step = 4 << 20;
  for (let at = 0; at < size; at += step) parts.push(Buffer.from(await page.evaluate(([n, a, l]) => window.__dayOne.slice(n, a, l), [name, at, step]), 'base64'));
  return Buffer.concat(parts);
}

function ffmpeg(args, opts = {}) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio:['pipe', 'inherit', 'inherit'], ...opts});
  const done = new Promise((res, rej) => p.on('close', c => c === 0 ? res() : rej(Error(`ffmpeg exited ${c}`))));
  return {p, done};
}

async function main() {
  fs.mkdirSync(OUT, {recursive:true});
  const t0 = Date.now();
  const srv = await server();
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Rendering needs Playwright (playwright-core).'); })();
  const channel = arg('channel', null);
  const browser = await chromium.launch(channel ? {channel} : {executablePath:chromiumPath()});
  const ctx = await browser.newContext({viewport:{width:360, height:640}, deviceScaleFactor:DPR});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); log('[page error]', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) log('[page]', m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) log(`[page] ${r.status()} ${r.url()}`); });
  const q = company ? `?company=${encodeURIComponent(company)}` : '';
  await page.goto(`${srv.origin}/films/day-one/index.html${q}`, {waitUntil:'load'});
  await page.waitForFunction(() => window.__dayOne && window.__dayOne.ready, null, {timeout:60000});
  await page.evaluate(() => window.__dayOne.ready);
  const client = await ctx.newCDPSession(page);
  const fonts = await fontLog(client);
  log('browser', browser.version(), channel ? `(channel ${channel})` : '');
  for (const [k, v] of Object.entries(fonts)) log(`font ${k}: ${v}`);
  const info = await page.evaluate(() => window.__dayOne.info());
  log(`company ${info.company}; camera notes`, JSON.stringify(info.notes));

  // --frames a,b,c: those frames as PNG stills only (no audio, no video).
  if (arg('frames', null)) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, {recursive:true});
    for (const f of arg('frames').split(',').map(Number)) {
      await page.evaluate(t => window.__dayOne.seekPainted(t), f / FPS);
      const {data} = await client.send('Page.captureScreenshot', SHOT);
      fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}${STILLS[f] ? '-' + STILLS[f].replace(/[^a-z0-9.]+/gi, '-') : ''}.png`), Buffer.from(data, 'base64'));
    }
    log(`stills: ${dir}`);
    await browser.close(); await srv.close();
    return;
  }

  // 1. The audio.
  const wavPath = path.join(OUT, 'day-one.wav');
  let audio = {source:'silent'};
  if (arg('audio', null)) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.resolve(arg('audio')), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', wavPath]);
    audio = {source:path.resolve(arg('audio'))};
  } else if (!flag('silent') && info.hasScore) {
    const ta = Date.now();
    try {
      const r = await page.evaluate(() => window.__dayOne.renderAudio());
      if (r) {
        fs.writeFileSync(wavPath, await pull(page, 'wav', r.bytes));
        audio = {source:'score.js', ...r, marks:await page.evaluate(() => window.__dayOne.audioMarks), renderSeconds:(Date.now() - ta) / 1000};
        log(`audio: score.js rendered in ${audio.renderSeconds.toFixed(1)} s`, r.loudness ? JSON.stringify(r.loudness) : '');
      }
    } catch (e) { log('audio: score.js failed, rendering silent:', e.message); audio = {source:'silent', error:e.message}; }
  } else log(flag('silent') ? 'audio: --silent' : 'audio: no score yet, rendering silent (mux later with --audio FILE)');

  // --remux: the picture already rendered (DIR/day-one.mp4), only the sound is new.
  if (flag('remux')) {
    const mp4 = path.join(OUT, 'day-one.mp4'), tmp = path.join(OUT, 'day-one.remux.mp4'), tlPath = path.join(OUT, 'timeline.json');
    if (!fs.existsSync(mp4) || !fs.existsSync(tlPath)) throw Error(`--remux needs ${mp4} and ${tlPath} from an earlier render.`);
    if (audio.source === 'silent') throw Error('--remux has no sound to mux (no score.js render and no --audio FILE).');
    const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8')), span = (tl.span[1] - tl.span[0]) / FPS;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-ss', String(tl.span[0] / FPS), '-t', String(span), '-i', wavPath,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-t', String(span), '-movflags', '+faststart', tmp]);
    fs.renameSync(tmp, mp4);
    tl.audio = audio; fs.writeFileSync(tlPath, JSON.stringify(tl));
    await browser.close(); await srv.close();
    log(`remuxed ${mp4} with ${audio.source}`);
    return;
  }

  // 2. The frames.
  const W = Math.round(360 * DPR), H = Math.round(640 * DPR);
  const pic = path.join(OUT, 'picture.mp4');
  const enc = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.2', '-preset', PREVIEW ? 'medium' : 'slow', '-crf', PREVIEW ? '20' : '14', '-tune', 'stillimage',
    '-vf', `scale=${W}:${H}:flags=bicubic:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-fps_mode', 'cfr', '-movflags', '+faststart', pic]);
  const stillsDir = path.join(OUT, 'stills'), sheetDir = path.join(OUT, '.sheet');
  if (flag('stills')) fs.mkdirSync(stillsDir, {recursive:true});
  fs.rmSync(sheetDir, {recursive:true, force:true}); fs.mkdirSync(sheetDir, {recursive:true});
  const hashes = [], frames = [];
  const tf = Date.now();
  for (let f = from; f < to; f++) {
    const st = await page.evaluate(t => window.__dayOne.seekPainted(t), f / FPS);
    const {data} = await client.send('Page.captureScreenshot', SHOT);
    const png = Buffer.from(data, 'base64');
    hashes.push(createHash('sha1').update(png).digest('hex').slice(0, 16));
    frames.push({f, a:+st.a.toFixed(3), k:+st.k.toFixed(4), sticky:st.sticky, comments:st.counts.comments, reactions:st.counts.reactions, reposts:st.counts.reposts});
    if (f % Math.round(1.5 * FPS) === 0) fs.writeFileSync(path.join(sheetDir, `${String(f).padStart(4, '0')}.png`), png);
    if (flag('stills') && STILLS[f] !== undefined) fs.writeFileSync(path.join(stillsDir, `f${String(f).padStart(4, '0')}-${STILLS[f].replace(/[^a-z0-9.]+/gi, '-')}.png`), png);
    if (!enc.p.stdin.write(png)) await new Promise(r => enc.p.stdin.once('drain', r));
    if ((f - from) % 300 === 299) log(`frame ${f + 1}/${to} (${((Date.now() - tf) / (f - from + 1)).toFixed(0)} ms a frame)`);
  }
  enc.p.stdin.end();
  await enc.done;
  const frameSeconds = (Date.now() - tf) / 1000;
  log(`frames: ${to - from} in ${frameSeconds.toFixed(1)} s`);

  // 3. The mux.
  const mp4 = path.join(OUT, 'day-one.mp4'), span = (to - from) / FPS;
  const haveWav = audio.source !== 'silent' && fs.existsSync(wavPath);
  if (!haveWav) audio.source = 'silent';
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', pic,
    ...(haveWav ? ['-ss', String(from / FPS), '-t', String(span), '-i', wavPath] : ['-f', 'lavfi', '-t', String(span), '-i', 'anullsrc=r=48000:cl=stereo']),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-t', String(span), '-movflags', '+faststart', mp4]);
  fs.rmSync(pic);

  // The contact sheet: a frame every 1.5 s, 8 across.
  const sheet = fs.readdirSync(sheetDir).sort();
  if (sheet.length) {
    const cols = 8, rows = Math.ceil(sheet.length / cols);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-pattern_type', 'glob', '-i', path.join(sheetDir, '*.png'),
      '-vf', `scale=270:480,pad=278:488:4:4:color=0x333333,tile=${cols}x${rows}`, '-frames:v', '1', path.join(OUT, 'contact-sheet.png')]);
  }
  fs.rmSync(sheetDir, {recursive:true, force:true});

  const timeline = {film:'Day One', company:info.company, fps:FPS, frames:FRAMES, span:[from, to], size:[W, H], preview:PREVIEW,
    browser:browser.version(), fonts, audio, camera:{notes:info.notes, segments:info.segments, arrivals:info.arrivals, rowBeats:info.rowBeats},
    layout:info.layout, ticks:info.ticks, cues:info.cues, errors, render:{seconds:(Date.now() - t0) / 1000, frameSeconds, msPerFrame:frameSeconds * 1000 / Math.max(1, to - from)},
    frameStates:frames, frameHashes:hashes};
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline));
  await browser.close(); await srv.close();
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${mp4} (${audio.source})`);
  if (errors.length) { log(`${errors.length} page errors`); process.exitCode = 1; }
}

main().catch(e => { console.error(e); process.exit(1); });
