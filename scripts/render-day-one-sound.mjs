// Day One's sound alone (src/films/day-one/score.js), rendered offline in headless
// Chromium exactly as the film's one command renders it (window.__dayOne.renderAudio
// calls the same renderAudio): Vite on port 0, a blank same-origin page, the score's
// OfflineAudioContext at 48 kHz stereo, -10 LUFS and the true-peak limiter in JS.
//
//   node scripts/render-day-one-sound.mjs --out DIR [--name day-one] [--parts keys,bass,...] [--raw] [--mp3] [--url ORIGIN]
//
// Writes DIR/<name>.wav (PCM 24-bit) and DIR/<name>.json (the marks: every statement and copy,
// the ticks, the motif's "grats", the silences, the loudness); --mp3 adds DIR/<name>.mp3
// (LAME 320k CBR). --parts renders only those parts ('motif' alone is the voice stem the
// null test reads); --raw skips the master (no loudness gain, no limiter).
import {createRequire} from 'node:module';
import {writeFile, mkdir} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg('out'), NAME = arg('name', 'day-one'), PARTS = arg('parts'), RAW = process.argv.includes('--raw');
if (!OUT) throw Error('Pass --out DIR.');

async function server(url) {
  if (url) return {origin:url.replace(/\/$/, ''), close:async () => {}};
  const {createServer} = await import('vite');
  const s = await createServer({root:ROOT, configFile:join(ROOT, 'vite.config.js'), logLevel:'error', clearScreen:false, server:{port:0, host:'127.0.0.1', hmr:false}});
  await s.listen();
  return {origin:`http://127.0.0.1:${s.httpServer.address().port}`, close:() => s.close()};
}

const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright to render.'); })();
const srv = await server(arg('url'));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[page]', e.message));
  page.on('console', m => m.type() === 'error' && console.error('[page]', m.text()));
  await page.route(`${srv.origin}/__day-one-sound`, r => r.fulfill({contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><title>Day One sound</title>'}));
  await page.goto(`${srv.origin}/__day-one-sound`);
  const t0 = Date.now();
  const r = await page.evaluate(async ({parts, raw}) => {
    const S = await import('/src/films/day-one/score.js');
    return S.renderAudio({...(parts ? {parts:parts.split(',')} : {}), normalize:!raw});
  }, {parts:PARTS, raw:RAW});
  await mkdir(OUT, {recursive:true});
  const wav = join(OUT, `${NAME}.wav`);
  await writeFile(wav, Buffer.from(r.wav, 'base64'));
  await writeFile(join(OUT, `${NAME}.json`), JSON.stringify({sampleRate:r.sampleRate, seconds:r.seconds, loudness:r.loudness, parts:PARTS ?? 'all', marks:r.marks}, null, 1));
  console.log(`${wav}: ${r.seconds} s at ${r.sampleRate} Hz in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${JSON.stringify(r.loudness)}; ${r.marks.copies.length} copies from ${r.marks.buffers} sung buffers`);
  if (process.argv.includes('--mp3')) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '0', '-write_xing', '1', join(OUT, `${NAME}.mp3`)]);
    console.log(`${join(OUT, `${NAME}.mp3`)}: LAME 320k`);
  }
} finally {
  await browser.close();
  await srv.close();
}
