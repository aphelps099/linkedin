// Render the All Hands sound check offline in headless Chromium, exactly as
// the page's Download does. Needs `npm run dev` (or any server with
// /api/allhands/voice) running. Usage:
//   node scripts/render-allhands.mjs [--url http://localhost:5173] [--out dir]
//     [--mode sung|spoken|both] [--mute drums,bass] [--post file.txt] [--name take]
//     [--bars 8-12] [--form drop60|soundcheck]
//     [--track circle-back|humbled-and-honored|hustle] [--cast cast.json]
// --track picks the song book track (default Circle Back); --cast is a JSON
// object of lady roles to recast (src/allhands/README.md, "The cast").
import {createRequire} from 'node:module';
// Playwright is not a project dependency; use whichever copy the machine has.
const require = createRequire(import.meta.url);
const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright to render.'); })();
import {writeFile, readFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const url = arg('url', 'http://localhost:5173'), out = arg('out', '.'), mode = arg('mode', 'sung');
const muted = Object.fromEntries((arg('mute', '') || '').split(',').filter(Boolean).map(s => [s, true]));
const post = arg('post') ? await readFile(arg('post'), 'utf8') : undefined;
const form = arg('form', 'drop60'), track = arg('track');
const cast = arg('cast') ? JSON.parse(await readFile(arg('cast'), 'utf8')) : undefined;
const name = arg('name', `allhands-${track ? `${track}-` : ''}${form}-${mode}`);
const bars = arg('bars') ? arg('bars').split('-').map(Number) : undefined;   // e.g. --bars 8-12

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', m => m.type() === 'error' && console.error('[page]', m.text()));
  await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
  await page.waitForFunction(() => window.__allhands);
  const result = await page.evaluate(options => window.__allhands.render(options), {post, form, track, cast, mode, muted, bars});
  await mkdir(out, {recursive:true});
  await writeFile(join(out, `${name}.wav`), Buffer.from(result.wav, 'base64'));
  await writeFile(join(out, `${name}.json`), JSON.stringify({lyrics:result.lyrics, plan:result.plan}, null, 1));
  console.log(JSON.stringify(result.lyrics));
  for (const line of result.plan.lines) console.log(String(line.bar).padStart(2), line.text, '\n   ', line.words.map(w => `${w[0]}@${w[1] % 32}+${w[2]}${w[3] > 1 ? `x${w[3]}` : ''}`).join(' '));
} finally { await browser.close(); }
