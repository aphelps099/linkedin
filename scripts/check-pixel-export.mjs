// Pixel Text export: every project src/allhands/pixel-export.js writes must
// survive the editor's own validation untouched, word timings above all.
// Pure Node. The editor's loader and validator are re-implemented below from
// its built bundle; pass --bundle <editor/assets/index-*.js> (or set
// PIXEL_TEXT_BUNDLE) to also run the bundle's real functions and prove the
// re-implementation identical on every input.
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {
  toPixelProject, planToCues, planCueSources, layoutCues, ladyCueSources, tapeWarp, planTimeOf, editorProblems, pixelText, editorText, Br as exportBr,
  dataUrlBytes, PIXEL_GLYPHS, PIXEL_KIND, PIXEL_STYLES, RENDER_OFFSET,
} from '../src/allhands/pixel-export.js';
import {lyricsFromPost, syllables, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {stepTime, STEP, HOST} from '../src/allhands/song.js';
import {FORMS, formPlays} from '../src/allhands/forms.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const eq = (a, b, message) => { assert.deepStrictEqual(a, b, message); checks++; };

// ---------------------------------------------------------------- the editor, re-implemented
// Source: LinkedIn Beats Pixel Text Editor (portable build, Nov 3 2026),
// editor/assets/index-CHtSfxxC.js. Minified names kept so each line can be
// matched against the bundle:
//   ~byte 151.9k  wr=30, x1=120, Ni={landscape,portrait,square}, zs=[[style,…]×6],
//                 tt, un, Ol, Br, function wi, function li, function kp, function vs
//   ~byte 154.2k  const ju={A:[…],…,'"':[…]}; ju["("]=…; ju[")"]=…   (the bitmap font)
//   ~byte 160.2k  async function ga (audio: ≤ 30 MB, decodable, ≤ 300 s)
//   ~byte 410.4k  async function wx (save), async function vx (open: ≤ 42 MB,
//                 kind, data:…;base64, decoded audio ≤ 30 MB)
//   ~byte 421.3k  Pm(): Open = vx → vs(project) → ga(audio) → state → autosave.
const EDITOR = (() => {
  const x1 = 120, Ni = {landscape:[1920, 1080], portrait:[1080, 1920], square:[1080, 1080]};
  const zs = ['spotlight', 'assembly', 'pulse', 'echo', 'stutter', 'drop'].map(id => [id]);
  const tt = (t, e, r) => Math.max(e, Math.min(r, t));
  const un = (t, e, r, n) => tt(Number.isFinite(Number(t)) ? Number(t) : e, r, n);
  let fresh = 0;
  const Ol = () => `uuid-${++fresh}`;                                   // crypto.randomUUID()
  const Br = t => String(t ?? '').normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 100);
  function wi(t, e, r) {
    const n = Br(t).split(' ').filter(Boolean), i = n.reduce((o, a) => o + Math.max(2, a.length), 0);
    let s = e;
    return n.map((o, a) => { const l = s; s += Math.max(2, o.length) / i * (r - e); return {text:o, start:l, end:a === n.length - 1 ? r : s}; });
  }
  const li = (t, e, r, n = 'spotlight') => ({id:Ol(), text:Br(t), start:e, end:r, style:n, words:wi(t, e, r)});
  const kp = () => ({version:1, title:'Keep building', duration:12, bpm:120, format:'landscape', dotSize:.64, glow:.6, scale:.9, blue:'#2674ff', white:'#f2f8ff',
    unlit:true, equalizer:false, reducedMotion:false, subdivision:4, audioOffset:0, audioName:'', includeAudio:true,
    cues:[li("LET'S KEEP BUILDING", 0, 3.2), li('KEEP BUILDING', 3.2, 6.4, 'assembly'), li('KEEP KEEP KEEP', 6.4, 9, 'echo'), li('BUILDING', 9, 12, 'drop')]});
  // vs(), line for line. `regenerated` is the only addition: the ids of cues
  // whose words failed the check and were replaced by wi()'s even spread.
  const regenerated = [];
  function vs(t) {
    if (!t || t.version !== 1 || !Array.isArray(t.cues) || !t.cues.length || t.cues.length > 80) throw Error('This is not a valid Pixel Text project.');
    const e = kp(), r = {...e}, n = un(t.duration, 12, 1, x1), i = new Set();
    r.duration = n; r.title = String(t.title || 'Untitled scene').slice(0, 80); r.bpm = un(t.bpm, 120, 40, 240); r.format = Ni[t.format] ? t.format : 'landscape';
    for (const o of ['dotSize', 'glow', 'scale']) r[o] = un(t[o], e[o], o === 'glow' ? 0 : .3, 1);
    for (const o of ['blue', 'white']) r[o] = /^#[\da-f]{6}$/i.test(t[o]) ? t[o] : e[o];
    for (const o of ['unlit', 'equalizer', 'includeAudio', 'reducedMotion']) r[o] = t[o] === void 0 ? e[o] : !!t[o];
    r.audioOffset = un(t.audioOffset, 0, 0, 300); r.audioName = String(t.audioName || '').slice(0, 160); r.subdivision = [1, 2, 4, 8].includes(t.subdivision) ? t.subdivision : 4;
    let s = 0;
    r.cues = t.cues.slice().sort((o, a) => Number(o.start) - Number(a.start)).flatMap(o => {
      if (s >= n - .05) return [];
      const a = Br(o.text) || 'WORD', l = un(o.start, s, s, n - .05), u = un(o.end, l + .5, l + .05, n);
      let c = String(o.id || Ol());
      i.has(c) && (c = Ol()); i.add(c);
      const d = zs.some(g => g[0] === o.style) ? o.style : 'spotlight', f = wi(a, l, u);
      const h = Array.isArray(o.words) && o.words.length === f.length && o.words.every((g, w) => Br(g.text) === f[w].text && Number.isFinite(g.start) && Number.isFinite(g.end)
        && g.start >= l - 1e-6 && g.end <= u + 1e-6 && g.end > g.start && (!w || g.start >= o.words[w - 1].end - 1e-6));
      if (!h) regenerated.push(c);
      s = u;
      return [{id:c, text:a, start:l, end:u, style:d, words:h ? o.words.map(g => ({text:Br(g.text), start:g.start, end:g.end})) : f}];
    });
    if (!r.cues.length) throw Error('The project needs at least one phrase.');
    return r;
  }
  async function vx(t) {
    if (t.size > 42 * 1024 * 1024) throw Error('This project is too large. Maximum size is 42 MB.');
    const e = JSON.parse(await t.text());
    if (e.kind !== 'linkedin-beats-pixel-text') throw Error('Choose a saved Pixel Text project.');
    let r = null;
    if (e.audio) {
      if (typeof e.audio !== 'string' || !/^data:[a-z0-9/+.-]*;base64,/i.test(e.audio)) throw Error('Invalid embedded audio.');
      const n = atob(e.audio.split(',')[1]);
      if (n.length > 30 * 1024 * 1024) throw Error('Embedded audio is too large.');
      r = new Blob([Uint8Array.from(n, i => i.charCodeAt(0))]);
    }
    return {project:e.project, audio:r};
  }
  // ju's keys: A–Z, 0–9, ' ! ? . , - : / & + " and the two added after it, ( ).
  const glyphs = new Set([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'!?.,-:/&+\"()"]);
  return {vs, vx, Br, wi, glyphs, regenerated, fps:30, maxSeconds:x1};
})();

// The Open path, as the editor runs it: vx(file) → vs(project); audio must be ≤ 30 MB (ga).
async function openInEditor(file) {
  const text = JSON.stringify(file);
  const {project, audio} = await EDITOR.vx(new Blob([text]));
  if (audio && audio.size > 30 * 1024 * 1024) throw Error('Choose an audio file smaller than 30 MB.');
  const before = EDITOR.regenerated.length, kept = EDITOR.vs(project);
  return {kept, regenerated:EDITOR.regenerated.slice(before), audio, bytes:Buffer.byteLength(text)};
}
// Exported and kept must be identical: every cue, every word, every number.
async function survives(file, label) {
  const {kept, regenerated} = await openInEditor(file);
  eq(regenerated, [], `${label}: the editor regenerated word timings for ${regenerated.join(', ')}`);
  ok(isDeepStrictEqual(kept, file.project), `${label}: the editor changed the project`);
  eq(editorProblems(file.project), [], `${label}: editorProblems`);
  for (const c of file.project.cues) ok([...c.text].every(ch => ch === ' ' || EDITOR.glyphs.has(ch)), `${label}: "${c.text}" has a character the font lacks`);
  return kept;
}

// ---------------------------------------------------------------- the real bundle (optional)
const bundleArg = process.argv.includes('--bundle') ? process.argv[process.argv.indexOf('--bundle') + 1] : process.env.PIXEL_TEXT_BUNDLE;
let REAL = null;
if (bundleArg && existsSync(bundleArg)) {
  // The slices are pure functions (validation, normalisation, the font table, the file loader).
  const s = readFileSync(bundleArg, 'utf8'), cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to, a); assert.ok(a >= 0 && b > a, `bundle: ${from}…${to}`); return s.slice(a, b); };
  const core = new Function(`const ${cut('wr=30,x1=120', 'function gd(')}; return {vs, Br, wi};`)();
  const font = new Function(`${cut('const ju=', ';const Gr=')}; return ju;`)();
  const loader = new Function(`${cut('async function vx(', 'const Hl=')}; return vx;`)();
  REAL = {...core, vx:loader, glyphs:new Set(Object.keys(font))};
  eq([...REAL.glyphs].sort(), [...EDITOR.glyphs].sort(), 'bundle font = re-implemented glyph set');
  eq([...REAL.glyphs].sort(), [...PIXEL_GLYPHS].sort(), 'bundle font = PIXEL_GLYPHS');
}
// Run the real vs() beside the re-implementation (ids aside: both keep given ones).
const strip = p => ({...p, cues:p.cues.map(c => ({...c, id:'x'}))});
function sameAsBundle(project, label) {
  if (!REAL) return;
  let mine, real, mineErr = null, realErr = null;
  try { mine = EDITOR.vs(structuredClone(project)); } catch (e) { mineErr = e.message; }
  try { real = REAL.vs(structuredClone(project)); } catch (e) { realErr = e.message; }
  eq(mineErr, realErr, `${label}: same verdict as the bundle`);
  if (!mineErr) ok(isDeepStrictEqual(strip(mine), strip(real)), `${label}: re-implemented vs() = bundle vs()`);
}

// ---------------------------------------------------------------- text
const STRINGS = [
  'Let’s “pivot” — café, naïve, Zoë & Renée', '50% growth', '$5M ARR, €3 and £2', 'Øresund Straße Łódź Æsir Œuvre', '🚀 Launch day 🎉🎉', 'great🚀team',
  '#Leadership @Aaron', 'B2B KPIs: 4,200 impressions!', 'ﬁnal ½ ²', 'snake_case|pipe\\slash', 'semi;colon [brackets] {braces}', '1+1=2 ±3 ×4 ÷5', 'tab\tand\nnewline',
  'Ελληνικά and русский', '中文 words', '…', '¿Qué? ¡Sí!', '‘single’ ‚low‛', '«guillemets» „low“', 'x‑y‒z―w−v', 'zero\u200Dwidth\uFE0F', '',
];
for (const s of STRINGS) {
  const t = pixelText(s);
  ok(EDITOR.Br(t) === t || t.length > 100, `pixelText is a Br() fixed point: ${s}`);
  ok([...t].every(c => c === ' ' || EDITOR.glyphs.has(c)), `pixelText draws every character: ${s} → ${t}`);
  eq(exportBr(s), EDITOR.Br(s), `Br() port: ${s}`);
  if (REAL) eq(REAL.Br(s), EDITOR.Br(s), `bundle Br(): ${s}`);
}
eq(pixelText('Let’s “pivot” — café, naïve'), 'LET\'S "PIVOT" - CAFE, NAIVE', 'quotes, dashes, accents');
eq(pixelText('50% growth'), '50 PERCENT GROWTH', '% is spelled');
eq(pixelText('Øresund Straße Łódź'), 'ORESUND STRASSE LODZ', 'letters NFKD keeps');
eq(pixelText('🚀 Launch day 🎉'), 'LAUNCH DAY', 'emoji removed');
eq(pixelText('#Leadership @Aaron'), 'LEADERSHIP AARON', 'tags lose their sigils');
eq(pixelText('$5M'), 'USD 5M', 'currency');
eq(pixelText('中文'), '', 'no glyphs, nothing shown');
// Seeded fuzz: any Unicode in, glyph-only editor-normal text out.
let seed = 7;
const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const POOL = [...'abcXYZ019 \'"’‘“”–—-.,!?:;/&+()[]{}%$€#@=_|\\~^*<>«»…·•éüßøæœłđ'].concat(['🚀', '👍🏽', '\u0301', '\u00A0', '\u2009', '中', 'Ж']);
for (let i = 0; i < 2000; i++) {
  const s = Array.from({length:1 + Math.floor(rand() * 30)}, () => POOL[Math.floor(rand() * POOL.length)]).join('');
  const t = pixelText(s);
  ok(EDITOR.Br(t) === t && [...t].every(c => c === ' ' || EDITOR.glyphs.has(c)), `fuzz text ${JSON.stringify(s)} → ${JSON.stringify(t)}`);
}
if (REAL) for (let i = 0; i < 4; i++) eq(REAL.wi('LET\'S KEEP BUILDING NOW', i, i + 2.5), EDITOR.wi('LET\'S KEEP BUILDING NOW', i, i + 2.5), 'bundle wi()');

// ---------------------------------------------------------------- All Hands plans
const POSTS = [
  SAMPLE_POST,
  `Humbled and honored to share that I've been promoted to Senior Director of Synergy. This journey taught me that leadership is a mindset, not a title. Agree? #Leadership`,
  `Our latest campaign post reached 4,200 impressions this week! Encouraged by the visibility. Thank you to our intern, Priya, for the captions. 🚀🚀`,
  `Excited to announce we leveraged AI to unlock potential across our B2B KPIs in Q3. https://example.com/post`,
  `Our NPS rose 32% after the café offsite — naïve? Maybe. Grateful for this team’s “growth mindset”. Let’s keep building.`,
];
const fakeDurations = (form, lyrics, track) => Object.fromEntries(form.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)]));
// The render hook's JSON (src/allhands/main.jsx window.__allhands.render).
const asRenderJson = plan => ({form:plan.form, bpm:plan.bpm, offset:RENDER_OFFSET, duration:plan.duration, timing:Array.from(plan.timing),
  choke:plan.choke ? {start:plan.timing[plan.choke.at], end:plan.timing[plan.choke.until]} : null,
  lines:plan.lines.map(l => ({text:l.text, bar:l.bar, kind:l.kind, words:l.words.map(w => [w.display, w.at, w.steps, +w.rate.toFixed(2), w.notes.map(n => n.midi).join('.'), +w.gate.toFixed(3)])})),
  lady:plan.lady.map(e => ({role:e.role, display:e.display, file:e.file, at:e.at, start:plan.timing[Math.floor(e.at)] + (e.at - Math.floor(e.at)) * (plan.step ?? STEP), length:+Math.min(e.gate, (e.to - e.from) / e.rate).toFixed(3)}))});
const q = x => Math.round(x * 1e4) / 1e4;

// Every form, in every song book track that plays it.
for (const post of POSTS) for (const id of Object.keys(FORMS)) for (const track of TRACK_ORDER.filter(t => formPlays(id, t))) {
  const form = FORMS[id], lyrics = lyricsFromPost(post), plan = form.arrange(lyrics, fakeDurations(form, lyrics, track), {track});
  const label = `${id} · ${track} · ${lyrics.hook}`, warnings = [];
  const cues = planToCues(plan, undefined, {lyrics, onWarning:w => warnings.push(w)});
  const file = toPixelProject({title:'All Hands', duration:plan.duration + RENDER_OFFSET, bpm:plan.bpm, cues, format:'portrait'});
  eq(file.kind, PIXEL_KIND, `${label}: kind`);
  eq(file.project.cues, cues, `${label}: toPixelProject keeps planToCues output`);
  ok(file.project.cues.length <= 80, `${label}: ≤ 80 cues`);
  await survives(file, label);
  sameAsBundle(file.project, label);
  eq(layoutCues(cues, {duration:file.project.duration, bpm:plan.bpm}).cues, cues, `${label}: layout is idempotent`);
  // Exact onsets: every sung line word that is not interrupted starts at its
  // 16th (swing included) + the 50 ms render offset.
  const timeOf = planTimeOf(plan), starts = new Set(cues.flatMap(c => c.words.map(w => w.start)));
  const sung = plan.lines.flatMap(l => l.words), heard = tapeWarp(plan.tape, timeOf);
  const exact = sung.filter(w => starts.has(q(heard(timeOf(w.at)))));
  ok(exact.length >= sung.length - 2, `${label}: ${sung.length - exact.length} sung words lost their onset`);
  if (id === 'soundcheck') for (const w of sung) ok(starts.has(q(stepTime(w.at) + RENDER_OFFSET)), `${label}: "${w.display}" at stepTime(${w.at}) + 50 ms`);
  // Every display word is accounted for: shown, or warned about.
  const shown = cues.reduce((n, c) => n + c.words.length, 0);
  ok(shown >= sung.length - warnings.length, `${label}: words shown ${shown} vs sung ${sung.length}`);
  // Styles by kind.
  const hooks = cues.filter(c => c.style === 'assembly' || c.style === 'pulse');
  ok(hooks.length >= 2 && cues.some(c => c.style === 'assembly') && cues.some(c => c.style === 'pulse'), `${label}: hooks alternate assembly and pulse`);
  ok(cues.filter(c => c.text === pixelText(lyrics.verses[0])).every(c => c.style === 'spotlight'), `${label}: verses spotlight`);
  ok(cues.some(c => c.text === pixelText(HOST.open) && c.style === 'spotlight'), `${label}: host line spotlight`);
  // The render JSON (no stammer, answers or tape) still exports verbatim and
  // times its line words identically.
  const json = asRenderJson(plan), jsonCues = planToCues(json, undefined, {lyrics});
  await survives(toPixelProject({duration:plan.duration + RENDER_OFFSET, cues:jsonCues}), `${label} (render JSON)`);
  const jsonStarts = new Set(jsonCues.flatMap(c => c.words.map(w => w.start)));
  ok(exact.every(w => jsonStarts.has(q(heard(timeOf(w.at)))) || q(heard(timeOf(w.at))) !== q(timeOf(w.at))), `${label}: JSON line words keep their onsets`);
  if (id === 'drop60' && post === SAMPLE_POST && track === 'circle-back') {
    // The lady: words placed by her recording's measured boundaries.
    const back = plan.lady.find(e => e.display === 'BACK.'), t0 = timeOf(back.at);
    const backCue = cues.find(c => c.text === 'BACK.');
    eq(backCue.words[0].start, q(t0), 'BACK. lands on the impact');
    eq(backCue.start, q(t0 - .25), 'a drop cue starts dark 250 ms early, so the reveal lands on the beat');
    const sink = LADY_TABLE['15.wav'], letThat = cues.find(c => c.text === 'LET THAT'), e = plan.lady.find(x => x.display === 'LET THAT');
    eq(letThat.words[1].start, q(timeOf(e.at) + (sink.words[1].start - e.from) / e.rate), '"that" from the recording');
    ok(cues.some(c => c.style === 'stutter' && c.words.some(w => w.text === 'LE') && c.words.some(w => w.text === 'LET-')), 'the lady and the stammer share one stutter cue in bar 18');
    // "Full stop." plays after the tape (engine.js): both words are heard, and shown.
    ok(!warnings.some(w => /STOP\..*tape stop/.test(w)) && cues.some(c => c.words.map(w => w.text).join(' ') === 'FULL STOP.'), '"FULL STOP." is heard over the tape stop, whole');
    // Proportional placement (JSON) stays within one frame of the exact cut for unclipped phrases.
    const viaJson = ladyCueSources(json.lady, {timeOf}), exactLady = ladyCueSources(plan.lady, {timeOf});
    // ("SINK IN" now starts on her pause after "that", which only the exact cut knows;
    // render JSON carries from/to, so real exports use the exact path.)
    const letJ = viaJson.find(s => s.words.some(w => w.text === 'LET') && s.words.some(w => w.text === 'THAT')), letE = exactLady.find(s => s.words.some(w => w.text === 'LET') && s.words.some(w => w.text === 'THAT'));
    ok(letJ.words.every((w, i) => Math.abs(w.start - letE.words[i].start) < 1 / 30), 'JSON lady timing ≈ exact cut');
  }
}

// ---------------------------------------------------------------- edge cases
const word = (text, start, end) => ({text, start, end});
const project = (cues, extra = {}) => toPixelProject({title:'Edge', duration:extra.duration ?? 30, cues, options:extra.options});

// Curly quotes, accents, %, emoji: normalised, words kept, onsets kept.
{
  const file = project([{text:'Let’s grow 50% — café 🚀', style:'spotlight', words:[word('Let’s', 1, 1.4), word('grow', 1.4, 1.8), word('50%', 1.8, 2.6), word('—', 2.6, 2.8), word('café', 2.8, 3.2), word('🚀', 3.2, 3.6)]}]);
  const [c] = file.project.cues;
  eq(c.text, "LET'S GROW 50 PERCENT - CAFE", 'mixed text');
  eq(c.words.map(w => [w.text, w.start, w.end]), [["LET'S", 1, 1.4], ['GROW', 1.4, 1.8], ['50', 1.8, 2.2], ['PERCENT', 2.2, 2.6], ['-', 2.6, 2.8], ['CAFE', 2.8, 3.2]], '% splits its span; emoji word dropped');
  await survives(file, 'mixed text');
  sameAsBundle(file.project, 'mixed text');
}
// A line over 100 characters splits at word boundaries, nothing lost.
{
  const words = Array.from({length:30}, (_, i) => word(`WORD${i}X`, 1 + i * .3, 1.25 + i * .3));
  const file = project([{style:'spotlight', words}]);
  ok(file.project.cues.length === 3 && file.project.cues.every(c => c.text.length <= 100), 'long line split');
  eq(file.project.cues.flatMap(c => c.words), words.map(w => ({text:w.text.toUpperCase(), start:q(w.start), end:q(w.end)})), 'every word kept, in time (0.1 ms grid)');
  await survives(file, 'long line');
  // The editor itself would cut the text at 100 characters and respread every word.
  const naive = {...file.project, cues:[{id:'a', text:words.map(w => w.text).join(' '), start:1, end:10.5, style:'spotlight', words}]};
  const before = EDITOR.regenerated.length; EDITOR.vs(naive);
  ok(EDITOR.regenerated.length === before + 1, 'unsplit, the editor would have replaced the timings');
  sameAsBundle(naive, 'naive long line');
}
// Overlapping cues: the most recent onset owns the screen; an interrupted word comes back.
{
  const file = project([
    {style:'spotlight', words:[word('Thanks', 1, 1.5), word('for', 1.5, 2), word('joining', 2, 3)]},
    {style:'echo', priority:2, words:[word('Pivot', 2.2, 2.6)]},
    {style:'pulse', words:[word('Late', 2.9, 3.4)]},
  ]);
  eq(file.project.cues.map(c => [c.text, c.start, c.end]), [['THANKS FOR JOINING', 1, 2.2], ['PIVOT', 2.2, 2.6], ['JOINING', 2.6, 2.9], ['LATE', 2.9, 3.9]], 'overlaps resolved');
  await survives(file, 'overlaps');
}
// More than 80 cues: neighbours join until 80, every word kept.
{
  const cues = Array.from({length:200}, (_, i) => ({style:i % 2 ? 'stutter' : 'echo', words:[word(`W${i}`, .1 + i * .55, .3 + i * .55)]}));
  const file = project(cues, {duration:115});
  ok(file.project.cues.length === 80, `200 cues → 80 (got ${file.project.cues.length})`);
  eq(file.project.cues.flatMap(c => c.words).length, 200, 'no word lost to merging');
  await survives(file, '200 cues');
  sameAsBundle(file.project, '200 cues');
  const fat = Array.from({length:81}, (_, i) => ({words:[word('X'.repeat(60), i, i + .5)]}));
  assert.throws(() => project(fat, {duration:100}), /allows 80 phrases/); checks++;
}
// Scenes over 120 s: a clear error, or a clean cut on request.
{
  const cues = [{words:[word('Early', 1, 2)]}, {words:[word('Late', 125, 126)]}];
  assert.throws(() => project(cues, {duration:130}), /at most 120 s.*clamp/); checks++;
  const file = project(cues, {duration:130, options:{clamp:true}});
  eq(file.project.duration, 120, 'clamped to 120 s');
  eq(file.project.cues.map(c => c.text), ['EARLY'], 'cues past 120 s dropped');
  await survives(file, 'clamped');
  assert.throws(() => project([{words:[word('Over', 29, 31)]}], {duration:30}), /after the 30 s scene/); checks++;
  const edge = project([{words:[word('Edge', 29.96, 29.99)]}], {duration:30});
  ok(edge.project.cues[0].start <= 29.95 && edge.project.cues[0].words[0].start === 29.96, 'a word in the last 50 ms leads in so the editor keeps it');
  await survives(edge, 'last 50 ms');
  assert.throws(() => project([{words:[word('🚀', 1, 2)]}]), /Nothing to show/); checks++;
}
// Drop cues lead in dark so the reveal lands on the word; without room, they fall back.
{
  const file = project([{style:'spotlight', words:[word('Before', 1, 1.6)]}, {style:'drop', words:[word('Back', 3, 3.5)]}, {style:'drop', words:[word('Again', 3.55, 4)]}]);
  const [, back, again] = file.project.cues;
  eq([back.start, back.style], [2.75, 'drop'], 'drop starts 250 ms early at 120 BPM');
  eq(again.style, 'echo', 'no room for the dark lead: echo');
  await survives(file, 'drop lead');
}
// Tiny cues reach the editor's 50 ms floor; untimed cues are spread like the editor would.
{
  const file = project([{words:[word('A', 1, 1.03)]}, {style:'echo', priority:2, words:[word('B', 1.03, 1.4)]}, {text:'No timings here', start:5, end:6}]);
  ok(file.project.cues.every(c => c.end >= c.start + .05), 'every cue ≥ 50 ms');
  await survives(file, 'tiny and untimed');
  eq(file.project.cues.at(-1).words, EDITOR.wi('NO TIMINGS HERE', 5, 6).map(w => ({...w, start:q(w.start), end:q(w.end)})), 'untimed words match the editor spread (0.1 ms grid)');
}
// The tape: "sink" heard later, "stop" swallows the end.
{
  const warp = tapeWarp([{kind:'sink', from:0, to:16}, {kind:'stop', from:32, seconds:.4}], s => s * STEP);
  eq(warp(0), 0, 'sink starts on time');
  ok(Math.abs(warp(.8) - .9017) < 1e-4, 'sink: 0.8 s of input is heard at 0.902 s');
  ok(Number.isNaN(warp(1.6)) && warp(1.6, 'end') === 2, 'sink: input past .75·D is never heard');
  eq(warp(2.5), 2.5, 'after the sink, time is time again');
  ok(Math.abs(warp(4.1) - 4.4 * 0 - (4 + .4 * (1 - Math.sqrt(1 - 2 * .1 / .4)))) < 1e-9 && Number.isNaN(warp(4.3)), 'stop: half of S heard, the rest is silence');
}
// The loader: kind, embedded audio, sizes; and the problems list catches a broken project.
{
  const audio = `data:audio/wav;base64,${Buffer.from('RIFF0000WAVEfmt ').toString('base64')}`;
  const file = toPixelProject({duration:5, cues:[{words:[word('Hi', 1, 2)]}], audioDataUrl:audio, audioName:'x.wav'});
  const {audio:blob} = await openInEditor(file);
  eq(blob.size, 16, 'audio decoded'); eq(dataUrlBytes(audio), 16, 'dataUrlBytes');
  if (REAL) { const r = await REAL.vx(new Blob([JSON.stringify(file)])); eq(r.audio.size, 16, 'bundle vx()'); }
  assert.throws(() => toPixelProject({duration:5, cues:[{words:[word('Hi', 1, 2)]}], audioDataUrl:'blob:nope'}), /data:/); checks++;
  await assert.rejects(EDITOR.vx(new Blob([JSON.stringify({...file, kind:'other'})])), /saved Pixel Text project/); checks++;
  const broken = structuredClone(file.project); broken.cues[0].words[0].start = 0.5;
  ok(editorProblems(broken).length === 1, 'editorProblems flags a word before its cue');
  const before = EDITOR.regenerated.length; EDITOR.vs(broken); ok(EDITOR.regenerated.length === before + 1, '…and the editor would respread it');
  eq(PIXEL_STYLES, ['spotlight', 'assembly', 'pulse', 'echo', 'stutter', 'drop'], 'styles');
}
// Seeded fuzz: overlapping, unsorted, unnormalised sources always open verbatim.
for (let i = 0; i < 300; i++) {
  const n = 1 + Math.floor(rand() * 40), sources = Array.from({length:n}, () => {
    let t = rand() * 100;
    const style = PIXEL_STYLES[Math.floor(rand() * 6)];
    return {style, priority:Math.floor(rand() * 3), words:Array.from({length:1 + Math.floor(rand() * 8)}, () => {
      const s = t + rand() * .3, e = s + .01 + rand() * .8; t = e;
      return word(Array.from({length:1 + Math.floor(rand() * 9)}, () => POOL[Math.floor(rand() * POOL.length)]).join(''), s, e);
    })};
  });
  let file;
  try { file = toPixelProject({duration:120, cues:sources, options:{clamp:true}}); }
  catch (e) { ok(/allows 80 phrases/.test(e.message), `fuzz ${i}: ${e.message}`); continue; }
  await survives(file, `fuzz ${i}`);
  if (i % 10 === 0) sameAsBundle(file.project, `fuzz ${i}`);
  eq(layoutCues(file.project.cues, {duration:120, clamp:true}).cues, file.project.cues, `fuzz ${i}: idempotent`);
}

console.log(`pixel export: ${checks} checks passed${REAL ? ' (bundle cross-checked)' : ' (pass --bundle <editor/assets/index-*.js> to cross-check the real editor code)'}`);
