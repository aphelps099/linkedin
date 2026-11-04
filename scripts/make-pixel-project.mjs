// Make a project for Aaron's Pixel Text editor from an All Hands render: the
// audio is embedded and every heard word (Synergy, his stammer, the lady) is a
// timed word in a cue, so the editor's Open shows the song already in time.
// Usage:
//   node scripts/make-pixel-project.mjs --wav take.wav --plan take.json --out take.pixel.json
//     [--format portrait|landscape|square] [--title "All Hands"] [--align beat|wav]
//     [--hold 0.5] [--max-words 9] [--equalizer] [--no-audio] [--clamp]
//     [--check-editor "<LinkedIn Beats Pixel Text Editor>/editor"] [--screenshot shot.png]
// --plan is the JSON scripts/render-allhands.mjs writes beside the WAV.
// --align beat (default) puts the downbeat at 0 s in the editor and moves the
//   render's 50 ms lead-in into audioOffset, so beat-locked looks (pulse) land
//   on the kick; --align wav keeps cue times equal to seconds in the WAV.
// --check-editor serves that folder, opens the file with the editor's own Open
//   control in headless Chromium, and fails unless the autosaved project equals
//   the exported one exactly.
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync, spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {basename, extname, resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createRequire} from 'node:module';
import {planToCues, toPixelProject, editorProblems, RENDER_OFFSET, PIXEL_LIMITS} from '../src/allhands/pixel-export.js';
import {FORMS} from '../src/allhands/forms.js';
import {ladyEvents} from '../src/allhands/drop.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const flag = name => args.includes(`--${name}`);
const fail = message => { console.error(`make-pixel-project: ${message}`); process.exit(1); };

const audioPath = arg('wav') || arg('audio'), planPath = arg('plan'), out = arg('out');
if (!audioPath || !planPath || !out) fail('usage: --wav take.wav --plan take.json --out take.pixel.json [--format portrait] (see the header)');
const align = arg('align', 'beat'), format = arg('format', 'portrait');
if (!['beat', 'wav'].includes(align)) fail('--align is beat or wav');

// ---- the take
const take = JSON.parse(await readFile(planPath, 'utf8'));
const raw = take.plan ?? take, lyrics = take.lyrics;
if (!Array.isArray(raw.lines)) fail(`${planPath} has no plan.lines; pass the JSON render-allhands.mjs wrote.`);
const audio = await readFile(audioPath);
const seconds = audioSeconds(audio, audioPath);
const mime = {'.wav':'audio/wav', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.aac':'audio/aac', '.ogg':'audio/ogg'}[extname(audioPath).toLowerCase()] || 'application/octet-stream';
if (audio.length > PIXEL_LIMITS.audioBytes) fail(`${basename(audioPath)} is ${(audio.length / 2 ** 20).toFixed(1)} MB; the editor takes 30 MB at most. Encode an MP3 and pass --audio take.mp3.`);
if (seconds > PIXEL_LIMITS.audioSeconds) fail(`${basename(audioPath)} lasts ${seconds.toFixed(1)} s; the editor takes five minutes at most.`);

// ---- what the render JSON leaves out, rebuilt from the same (pure) arrangement:
// the song form, its timing table, tape and choke, Synergy's stammer and
// answers, and the cut and rate of each lady event. Used only when the
// rebuilt setlist matches the take's line for line.
const warnings = [], note = m => warnings.push(m);
const formId = raw.form || Object.keys(FORMS).find(id => sameSetlist(rebuild(id)?.lines, raw.lines));
const ref = formId ? rebuild(formId) : null;
const trusted = !!ref && sameSetlist(ref.lines, raw.lines);
if (!trusted) note(`The take's setlist does not match ${formId || 'any form'} in src/allhands; exporting its lines and lady events only.`);
const answers = trusted ? ref.words.filter(w => w.line === -1) : [];
const plan = {
  ...raw,
  bpm:raw.bpm ?? ref?.bpm ?? 120,
  timing:raw.timing ?? (ref ? Array.from(ref.timing) : undefined),
  offset:raw.offset ?? RENDER_OFFSET,
  tape:raw.tape ?? (trusted ? ref.tape : undefined),
  choke:raw.choke ?? (trusted ? ref.choke : undefined),
  stutters:raw.stutters ?? (trusted ? ref.stutters : []),
  words:raw.words ?? answers,
  lady:withCuts(raw.lady ?? [], formId === 'drop60' && trusted),
};

// ---- cues and project
const renderOffset = align === 'beat' ? 0 : plan.offset, audioOffset = align === 'beat' ? Math.max(0, plan.offset) : 0;
let duration = +(seconds - audioOffset).toFixed(4);
if (duration > PIXEL_LIMITS.duration[1] && !flag('clamp')) fail(`the take is ${duration.toFixed(2)} s; Pixel Text scenes are at most 120 s. Pass --clamp to cut it at 120 s.`);
duration = Math.min(duration, PIXEL_LIMITS.duration[1]);
const layout = {hold:+arg('hold', .5), clamp:flag('clamp'), onWarning:note, ...(arg('max-words') ? {maxWords:+arg('max-words')} : {})};
const cues = planToCues(plan, undefined, {lyrics, renderOffset, duration, ...layout});
const audioDataUrl = flag('no-audio') ? null : `data:${mime};base64,${audio.toString('base64')}`;
const file = toPixelProject({title:arg('title', 'All Hands'), duration, bpm:plan.bpm, cues, format, audioDataUrl, audioName:basename(audioPath),
  options:{...layout, audioOffset, equalizer:flag('equalizer')}});
const text = JSON.stringify(file, null, 2);
if (Buffer.byteLength(text) > PIXEL_LIMITS.fileBytes) fail(`the project is ${(Buffer.byteLength(text) / 2 ** 20).toFixed(1)} MB; the editor opens 42 MB at most.`);
await writeFile(out, text);

const words = file.project.cues.reduce((n, c) => n + c.words.length, 0);
console.log(`${out}\n  ${formId || 'unknown form'} · ${file.project.cues.length} cues · ${words} words · ${duration.toFixed(2)} s · ${format} · align ${align} (audioOffset ${audioOffset} s)`);
console.log(`  audio ${basename(audioPath)} ${(audio.length / 2 ** 20).toFixed(1)} MB${audioDataUrl ? '' : ' (not embedded)'} · file ${(Buffer.byteLength(text) / 2 ** 20).toFixed(1)} MB`);
for (const c of file.project.cues) console.log(`  ${c.id}  ${c.start.toFixed(3).padStart(7)}–${c.end.toFixed(3).padEnd(7)} ${c.style.padEnd(9)} ${c.text}`);
for (const w of new Set(warnings)) console.log(`  note: ${w}`);
const problems = editorProblems(file.project);
if (problems.length) fail(`the editor would change this project:\n${problems.join('\n')}`);

if (arg('check-editor')) {
  try { await checkInEditor(resolve(arg('check-editor')), resolve(out), file, audio.length, arg('screenshot')); }
  catch (e) { fail(`editor check: ${e.message}`); }
}

// ---------------------------------------------------------------- helpers

function rebuild(id) {
  try { return lyrics && FORMS[id] ? FORMS[id].arrange(lyrics, {}) : null; } catch { return null; }
}
function sameSetlist(a, b) {
  return !!a && !!b && a.length === b.length && a.every((l, i) => l.bar === b[i].bar && l.text === b[i].text);
}

// Render JSON lady events carry {at, file, display, start, length}. The same
// events rebuilt from drop.js add {from, to, rate, gate}: the exact cut, so
// each of her words is timed from her recording. Matched on onset, file,
// display and audible length (±2 ms); unmatched events keep proportional timing.
function withCuts(lady, rebuildable) {
  if (!lady.length || !rebuildable) return lady;
  const sung = [...raw.lines.flatMap(l => l.words.map(w => Array.isArray(w) ? {at:w[1], steps:w[2]} : w)), ...answers].sort((a, b) => a.at - b.at);
  let events;
  try { events = ladyEvents(sung); } catch (e) { note(`Could not rebuild the lady's cuts (${e.message}).`); return lady; }
  let matched = 0;
  const out = lady.map(e => {
    const m = events.find(x => Math.abs(x.at - e.at) < 1e-9 && x.file === e.file && x.display === e.display
      && (e.length === undefined || Math.abs(Math.min(x.gate, (x.to - x.from) / x.rate) - e.length) < .002));
    if (!m) return e;
    matched++;
    return {...e, from:m.from, to:m.to, rate:m.rate, gate:m.gate};
  });
  if (matched < lady.length) note(`${lady.length - matched} of ${lady.length} lady events kept proportional word timing (no exact cut found).`);
  return out;
}

function audioSeconds(bytes, path) {
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') {
    let at = 12, fmt = null;
    while (at + 8 <= bytes.length) {
      const id = bytes.toString('ascii', at, at + 4), size = bytes.readUInt32LE(at + 4);
      if (id === 'fmt ') fmt = {channels:bytes.readUInt16LE(at + 10), rate:bytes.readUInt32LE(at + 12), bits:bytes.readUInt16LE(at + 22)};
      if (id === 'data' && fmt) return Math.min(size, bytes.length - at - 8) / (fmt.rate * fmt.channels * fmt.bits / 8);
      at += 8 + size + (size & 1);
    }
    fail(`${path} is not a PCM WAV I can measure.`);
  }
  try { return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], {encoding:'utf8'}); }
  catch { fail(`cannot measure ${path}; install ffprobe or pass a WAV.`); }
}

async function freePort() {
  for (;;) {
    const port = await new Promise((ok, no) => { const s = createServer().once('error', no).listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
    if (port !== 5199) return port;
  }
}

// Open the file the way Aaron would, then read back what the editor autosaved.
async function checkInEditor(dir, path, file, audioBytes, screenshot) {
  const require = createRequire(import.meta.url);
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('install Playwright for --check-editor'); })();
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const server = spawn('python3', ['-I', '-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], {stdio:'ignore'});
  const browser = await chromium.launch();
  try {
    for (let i = 0; ; i++) { try { if ((await fetch(`${base}/pixel-text/`)).ok) break; } catch {} if (i > 50) throw Error(`no editor at ${base}/pixel-text/`); await new Promise(r => setTimeout(r, 100)); }
    const page = await browser.newPage({viewport:{width:1440, height:1100}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${base}/pixel-text/`, {waitUntil:'networkidle'});
    const open = page.getByRole('button', {name:'Open', exact:true});
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Open' && !b.disabled), null, {timeout:30000});
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), open.click()]);
    await chooser.setFiles(path);
    await page.waitForFunction(() => /Project opened\.|Could not open project/.test(document.body.innerText), null, {timeout:120000});
    const status = await page.evaluate(() => (document.body.innerText.match(/Could not open project[^\n]*|Project opened\./) || [''])[0]);
    if (status !== 'Project opened.') throw Error(`the editor refused the file: ${status}`);
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
      if (saved?.project?.title === file.project.title && saved.project.cues.length === file.project.cues.length && (saved.audioSize !== null || !file.audio)) break;
      await new Promise(r => setTimeout(r, 200));
    }
    const exported = file.project.cues.flatMap(c => [c.start, c.end, ...c.words.flatMap(w => [w.start, w.end])]);
    const kept = (saved?.project?.cues || []).flatMap(c => [c.start, c.end, ...c.words.flatMap(w => [w.start, w.end])]);
    const drift = kept.length === exported.length ? Math.max(...kept.map((t, i) => Math.abs(t - exported[i]))) : Infinity;
    const same = isDeepStrictEqual(saved?.project, file.project);
    // The phrase strip shows every cue, and no cue warns about missing glyphs.
    const strip = await page.locator('.pt-phrase-strip button strong').allTextContents();
    let warned = [];
    for (let i = 0; i < strip.length; i++) {
      await page.locator('.pt-phrase-strip button').nth(i).click();
      if (await page.locator('.pt-warning').count()) warned.push(strip[i]);
    }
    const stripOk = isDeepStrictEqual(strip, file.project.cues.map(c => c.text));
    console.log(`\neditor check (${base}/pixel-text/, Chromium ${browser.version()}):`);
    console.log(`  opened: ${status}  autosaved project identical to export: ${same}  cues ${saved?.project?.cues.length}/${file.project.cues.length}  timestamps ${kept.length}/${exported.length}  max |Δt| ${drift} s`);
    console.log(`  audio blob ${saved?.audioSize} bytes (file ${audioBytes})  phrase strip matches: ${stripOk}  glyph warnings: ${warned.length ? warned.join(' | ') : 'none'}  page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    if (screenshot) {
      // A hook, mid-word, once its letters have assembled.
      const i = Math.max(0, file.project.cues.findIndex(c => c.style === 'assembly'));
      const cue = file.project.cues[i], w = cue.words[Math.min(1, cue.words.length - 1)];
      await page.locator('.pt-phrase-strip button').nth(i).click();
      await page.evaluate(t => {
        const el = document.querySelector('input[aria-label="Playhead"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(t));
        el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));
      }, (w.start + w.end) / 2);
      await page.waitForTimeout(400);
      await page.screenshot({path:screenshot, fullPage:true});
      console.log(`  screenshot ${screenshot} (cue ${cue.id} "${cue.text}" at ${((w.start + w.end) / 2).toFixed(2)} s)`);
    }
    if (!same || !stripOk || warned.length || saved?.audioSize !== (file.audio ? audioBytes : null)) throw Error('the editor did not keep the project exactly.');
  } finally {
    await browser.close();
    server.kill();
  }
}
