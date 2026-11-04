// Ready-to-open Pixel Text projects for the lady's phrases: one .pixel.json per
// recording, with her WAV embedded and one cue whose words light on the exact
// word boundaries measured in src/allhands/lady-phrases.json (seconds from the
// start of the file, so the editor's scene time equals time in her recording).
// Usage:
//   node scripts/make-lady-pixel-projects.mjs --out <dir> [--zip <file.zip>]
//     [--phrases 01,02,...]   (default: the 17 the editor bundles, plus 50 "Let's build.")
//     [--check-editor "<LinkedIn Beats Pixel Text Editor>/editor"] [--check all|06,15,...]
//     [--screenshot shot.png] [--shot 15]
// Writes <out>/<NN>-<slug>.pixel.json. Every project is square, 120 BPM, lasts
// its audio + 0.4 s (never under the editor's 1 s minimum: 13 "Thoughts?" is
// 0.524 s, so its scene is 1 s), and is titled with the phrase. Style: one word -> drop,
// a question -> pulse, otherwise spotlight. The exporter keeps a drop dark for
// half a beat (0.25 s) before its word; her recordings start speaking within
// 20 ms, so a drop has no room and toPixelProject() shows it as echo instead
// (reported per file). Word text goes through the exporter's glyph rules, and
// editorProblems() must be empty for every file.
// --check-editor serves that folder on a free port, opens each checked file
// with the editor's own Open control in headless Chromium (a fresh browser
// profile per file), and fails unless the autosaved project equals the file
// exactly and every word time equals the measured one. --screenshot saves the
// --shot phrase (default 15, else the first checked) mid-way through its middle word.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {deflateRawSync, crc32} from 'node:zlib';
import {basename, join, resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createRequire} from 'node:module';
import {toPixelProject, editorProblems, pixelText, Br, missingGlyphs, PIXEL_LIMITS} from '../src/allhands/pixel-export.js';

const ROOT = new URL('../', import.meta.url);
// The editor's phrase picker (bundle `df`): 01 02 05 06 07 08 13 14 15 18 27 28 29 34 41 47 54. 50 is the drop's "Let's build."
const DEFAULT_PHRASES = ['01', '02', '05', '06', '07', '08', '13', '14', '15', '18', '27', '28', '29', '34', '41', '47', '54', '50'];
const BPM = 120, FORMAT = 'square', TAIL = .4;

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const fail = message => { console.error(`make-lady-pixel-projects: ${message}`); process.exit(1); };
const list = s => s.split(',').map(x => x.trim()).filter(Boolean).map(x => x.padStart(2, '0'));

const outDir = arg('out');
if (!outDir) fail('usage: --out <dir> [--zip file.zip] [--check-editor <editor dir>] (see the header)');
const phrases = list(arg('phrases', DEFAULT_PHRASES.join(',')));
const table = JSON.parse(await readFile(new URL('src/allhands/lady-phrases.json', ROOT), 'utf8'));

// ---------------------------------------------------------------- build

const styleFor = entry => entry.words.length === 1 ? 'drop' : /\?$/.test(pixelText(entry.text)) ? 'pulse' : 'spotlight';
// The title is the phrase as written, minus emoji she does not say (29: "Onwards and upwards! 🚀"),
// which is also how the editor's own phrase picker names that recording.
const titleOf = text => text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, PIXEL_LIMITS.title);
const slugOf = text => text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

await mkdir(outDir, {recursive:true});
const built = [];
for (const nn of phrases) {
  const name = `${nn}.wav`, entry = table.find(e => e.file === name);
  if (!entry) fail(`${name} is not in src/allhands/lady-phrases.json`);
  const audio = await readFile(new URL(`public/phrases/${name}`, ROOT));
  const seconds = wavSeconds(audio, name);
  if (Math.abs(seconds - entry.duration) > .0006) fail(`${name} lasts ${seconds} s but lady-phrases.json says ${entry.duration} s; re-run scripts/align-lady-phrases.py.`);
  const unchecked = entry.words.filter(w => !['isolated', 'context'].includes(w.check));
  const title = titleOf(entry.text), duration = Math.max(seconds + TAIL, PIXEL_LIMITS.duration[0]), requested = styleFor(entry), warnings = [];
  const source = {kind:'lady', text:entry.text, style:requested, start:0, end:duration, words:entry.words.map(w => ({text:w.text, start:w.start, end:w.end}))};
  let file;
  try {
    file = toPixelProject({title, duration, bpm:BPM, format:FORMAT, cues:[source], audioDataUrl:`data:audio/wav;base64,${audio.toString('base64')}`,
      audioName:name, options:{onWarning:m => warnings.push(m)}});
  } catch (e) { fail(`${name}: ${e.message}`); }
  const {project} = file, cue = project.cues[0];
  // Exactly one cue, its words the measured words, untouched.
  const want = entry.words.map(w => ({text:pixelText(w.text), start:w.start, end:w.end}));
  if (project.cues.length !== 1 || !isDeepStrictEqual(cue.words, want)) fail(`${name}: the exporter changed the words:\n${JSON.stringify(cue.words)}\nwanted\n${JSON.stringify(want)}`);
  if (cue.text !== pixelText(entry.text) || Br(cue.text) !== cue.text || missingGlyphs(cue.text).length) fail(`${name}: cue text "${cue.text}" is not editor-safe`);
  const problems = editorProblems(project);
  if (problems.length) fail(`${name}: the editor would change this project:\n${problems.join('\n')}`);
  const path = join(outDir, `${nn}-${slugOf(title)}.pixel.json`), text = JSON.stringify(file, null, 2);
  if (Buffer.byteLength(text) > PIXEL_LIMITS.fileBytes) fail(`${path} is over the editor's 42 MB`);
  await writeFile(path, text);
  built.push({nn, name, entry, file, path, text, audioBytes:audio.length, requested, warnings, unchecked});
}

console.log(`${built.length} projects in ${outDir} (${FORMAT}, ${BPM} BPM, duration = audio + ${TAIL} s, at least ${PIXEL_LIMITS.duration[0]} s)`);
for (const b of built) {
  const c = b.file.project.cues[0];
  console.log(`  ${basename(b.path).padEnd(58)} ${b.file.project.duration.toFixed(4)} s  ${c.start}–${c.end}  ${b.requested === c.style ? c.style : `${b.requested}->${c.style}`}`);
  console.log(`      ${c.words.map(w => `${w.text} ${w.start.toFixed(3)}–${w.end.toFixed(3)}`).join(' | ')}`);
  for (const w of b.warnings) console.log(`      note: ${w}`);
  for (const w of b.unchecked) console.log(`      note: "${w.text}" alignment check is "${w.check}" in lady-phrases.json`);
}
console.log(`  editorProblems(): none in ${built.length}/${built.length}; ${built.reduce((n, b) => n + b.file.project.cues[0].words.length, 0)} words equal lady-phrases.json exactly`);

const zipPath = arg('zip');
if (zipPath) {
  const zip = makeZip(built.map(b => ({name:basename(b.path), data:Buffer.from(b.text)})));
  await writeFile(zipPath, zip);
  console.log(`  zip ${zipPath} (${built.length} files, ${(zip.length / 2 ** 20).toFixed(2)} MB)`);
}

if (arg('check-editor')) {
  const want = arg('check', 'all'), checked = want === 'all' ? built : list(want).map(nn => built.find(b => b.nn === nn) || fail(`--check ${nn} was not built`));
  const shotNn = arg('shot', checked.some(b => b.nn === '15') ? '15' : checked[0]?.nn);
  try { await checkInEditor(resolve(arg('check-editor')), checked, arg('screenshot'), shotNn); }
  catch (e) { fail(`editor check: ${e.message}`); }
}

// ---------------------------------------------------------------- helpers

function wavSeconds(bytes, name) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') fail(`${name} is not a WAV`);
  let at = 12, fmt = null;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4), size = bytes.readUInt32LE(at + 4);
    if (id === 'fmt ') fmt = {channels:bytes.readUInt16LE(at + 10), rate:bytes.readUInt32LE(at + 12), bits:bytes.readUInt16LE(at + 22)};
    if (id === 'data' && fmt) return Math.min(size, bytes.length - at - 8) / (fmt.rate * fmt.channels * fmt.bits / 8);
    at += 8 + size + (size & 1);
  }
  fail(`${name} has no PCM data chunk`);
}

// A plain deflate .zip (local headers, central directory, end record).
function makeZip(entries) {
  const d = new Date(), time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1, date = (d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const {name, data} of entries) {
    const packed = deflateRawSync(data, {level:9}), fileName = Buffer.from(name), crc = crc32(data);
    const head = (sig, central) => {
      const h = Buffer.alloc(central ? 46 : 30);
      h.writeUInt32LE(sig, 0);
      let i = 4;
      if (central) { h.writeUInt16LE(20, i); i += 2; }
      for (const v of [20, 0x0800, 8, time, date]) { h.writeUInt16LE(v, i); i += 2; }
      for (const v of [crc, packed.length, data.length]) { h.writeUInt32LE(v >>> 0, i); i += 4; }
      h.writeUInt16LE(fileName.length, i); i += 2;
      h.writeUInt16LE(0, i); i += 2;
      if (central) { i += 10; h.writeUInt32LE(offset, i); }   // after comment length, disk, internal and external attributes
      return h;
    };
    const local = Buffer.concat([head(0x04034b50, false), fileName, packed]);
    centrals.push(Buffer.concat([head(0x02014b50, true), fileName]));
    locals.push(local);
    offset += local.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

async function freePort() {
  for (;;) {
    const port = await new Promise((ok, no) => { const s = createServer().once('error', no).listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
    if (port !== 5199) return port;
  }
}

// Open each file the way Aaron would, then read back what the editor autosaved
// (same procedure as scripts/make-pixel-project.mjs --check-editor).
async function checkInEditor(dir, items, screenshot, shotNn) {
  const require = createRequire(import.meta.url);
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('install Playwright for --check-editor'); })();
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const server = spawn('python3', ['-I', '-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], {stdio:'ignore'});
  const browser = await chromium.launch();
  const bad = [];
  try {
    for (let i = 0; ; i++) { try { if ((await fetch(`${base}/pixel-text/`)).ok) break; } catch {} if (i > 50) throw Error(`no editor at ${base}/pixel-text/`); await new Promise(r => setTimeout(r, 100)); }
    console.log(`\neditor check (${base}/pixel-text/, Chromium ${browser.version()}):`);
    for (const item of items) {
      const context = await browser.newContext({viewport:{width:1440, height:1100}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}/pixel-text/`, {waitUntil:'networkidle'});
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Open' && !b.disabled), null, {timeout:30000});
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name:'Open', exact:true}).click()]);
      await chooser.setFiles(resolve(item.path));
      await page.waitForFunction(() => /Project opened\.|Could not open project/.test(document.body.innerText), null, {timeout:120000});
      const status = await page.evaluate(() => (document.body.innerText.match(/Could not open project[^\n]*|Project opened\./) || [''])[0]);
      // Autosave runs 450 ms after the change; wait until it holds this project.
      const read = () => page.evaluate(() => new Promise((ok, no) => {
        const r = indexedDB.open('linkedin-beats-pixel-text', 1);
        r.onerror = () => no(r.error);
        r.onsuccess = () => {
          const db = r.result, get = db.transaction('projects').objectStore('projects').get('current');
          get.onsuccess = () => { db.close(); ok(get.result ? {project:get.result.project, audioSize:get.result.audio?.size ?? null} : null); };
          get.onerror = () => no(get.error);
        };
      }));
      let saved = null;
      for (let i = 0; i < 100; i++) {
        saved = await read();
        if (saved?.project?.title === item.file.project.title && saved.audioSize !== null) break;
        await new Promise(r => setTimeout(r, 200));
      }
      const same = isDeepStrictEqual(saved?.project, item.file.project);
      const kept = saved?.project?.cues?.[0]?.words || [], measured = item.entry.words;
      const exact = saved?.project?.cues?.length === 1 && kept.length === measured.length
        && kept.every((w, k) => w.text === pixelText(measured[k].text) && w.start === measured[k].start && w.end === measured[k].end);
      const drift = kept.length === measured.length ? Math.max(...kept.flatMap((w, k) => [Math.abs(w.start - measured[k].start), Math.abs(w.end - measured[k].end)])) : Infinity;
      const strip = await page.locator('.pt-phrase-strip button strong').allTextContents();
      await page.locator('.pt-phrase-strip button').first().click();
      const warned = await page.locator('.pt-warning').count();
      const ok = status === 'Project opened.' && same && exact && saved.audioSize === item.audioBytes
        && isDeepStrictEqual(strip, [item.file.project.cues[0].text]) && !warned && !errors.length;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${basename(item.path).padEnd(58)} ${status || 'no status'}  identical: ${same}  words exact: ${exact} (${kept.length}/${measured.length}, max |dt| ${drift} s)`
        + `  audio ${saved?.audioSize}/${item.audioBytes} B  strip "${strip.join(' | ')}"  style ${saved?.project?.cues?.[0]?.style}${warned ? '  GLYPH WARNING' : ''}${errors.length ? `  errors: ${errors.join(' | ')}` : ''}`);
      if (!ok) bad.push(item.nn);
      if (screenshot && item.nn === shotNn) {
        const cue = saved.project.cues[0], w = cue.words[Math.floor(cue.words.length / 2)], t = (w.start + w.end) / 2;
        await page.evaluate(at => {
          const el = document.querySelector('input[aria-label="Playhead"]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(at));
          el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));
        }, t);
        await page.waitForTimeout(400);
        await page.screenshot({path:screenshot, fullPage:true});
        console.log(`       screenshot ${screenshot} ("${cue.text}" at ${t.toFixed(3)} s, mid "${w.text}")`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (bad.length) throw Error(`the editor did not keep ${bad.join(', ')} exactly.`);
  console.log(`  ${items.length}/${items.length} opened and kept verbatim; every word time equals lady-phrases.json.`);
}
