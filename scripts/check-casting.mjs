// Casting: the post picks its song and the lady's lines (src/allhands/casting.js).
//   1. The role table (lady-roles.json): all 57 recordings, every cut inside
//      her measured words, displays the Peg Board and Pixel Text can draw,
//      `tracks` exactly where casting.js fits() says the cut plays whole.
//   2. The sample post and the 60 fixture posts: every result valid (files on
//      disk, words inside the measured words, every recast inside its role's
//      limits on its track, no recording twice, the impact the word after the
//      tag), deterministic, fast, and the track distribution reported (not
//      degenerate). The sample keeps today's cast: the flagship film's lines.
//   3. Arranged (two duration models): the plan plays every cast cut whole,
//      the silence before the impact holds, the Peg Board and the Pixel Text
//      export time her words from the measured boundaries.
// With a dev server, --render --url http://localhost:5331 --out <dir> renders
// eight fixture posts end to end through scripts/render-allhands.mjs, runs
// scripts/measure-allhands.py (all gates, plus Whisper on every lady moment),
// saves 320 kbps MP3s and an index, and checks that the page casts exactly
// what Node casts.
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {castSong, fits, settleCast, LIMITS, CONCEPTS, ROLE_ORDER, MIX_MIN} from '../src/allhands/casting.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, DEFAULT_CAST, LADY_ROLES, castOf} from '../src/allhands/songbook/index.js';
import {arrangeDrop, dropVoicedWords} from '../src/allhands/drop.js';
import {LADY_TABLE, slice} from '../src/allhands/lady-table.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {buildScreens} from '../src/pegboard/choreo.js';
import {compileFont, layoutText, CHARSET} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {PIXEL_GLYPHS, ladyCueSources, planTimeOf, pixelText} from '../src/allhands/pixel-export.js';

const ROOT = new URL('..', import.meta.url).pathname;
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const ROLES = JSON.parse(readFileSync(join(ROOT, 'src/allhands/lady-roles.json'), 'utf8'));
const MEASURED = JSON.parse(readFileSync(join(ROOT, 'src/allhands/lady-phrases.json'), 'utf8'));
const FIXTURES = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/pixel-posts.json'), 'utf8')).map(x => x.post);
const POSTS = [SAMPLE_POST, ...FIXTURES];
const label = i => (i === 0 ? 'sample' : `fixture ${i - 1}`);
const json = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
const norm = (entry, i) => (i < 0 ? entry.words.length + i : i);
const faces = [compileFont(PEG9), compileFont(PEG5)];

// ---- 1. The role table
ok(ROLES.phrases.length === 57 && MEASURED.length === 57, 'role table: all 57 recordings');
const drawable = text => [...text].every(c => c === ' ' || (PIXEL_GLYPHS.has(c) && CHARSET.has(c)));
const fitsBoard = text => faces.some(font => { const l = layoutText(text, {font, k:1, maxCols:116, maxLines:3}); return l.width <= 116 && l.height <= 41; });
const roleCount = {}, trackCount = Object.fromEntries(TRACK_ORDER.map(t => [t, {}]));
let cuts = 0;
for (const p of ROLES.phrases) {
  const m = MEASURED.find(e => e.file === p.file), entry = LADY_TABLE[p.file];
  ok(m && entry && m.text === p.text, `role table: ${p.file} is "${m?.text}"`);
  ok(existsSync(join(ROOT, 'public/phrases', p.file)), `role table: public/phrases/${p.file} exists`);
  ok(p.topics.length && p.topics.every(t => CONCEPTS[t]), `role table: ${p.file} topics are concepts (${p.topics})`);
  ok(p.keywords.length >= 1, `role table: ${p.file} has keywords`);
  for (const [role, list] of Object.entries(p.roles)) {
    ok(ROLE_ORDER.includes(role), `role table: ${p.file} role ${role}`);
    for (const c of list) {
      cuts++;
      const [a, b] = c.words, n = entry.words.length, tag = `${p.file} ${role} ${c.display}`;
      ok(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b < n && a <= b, `${tag}: words ${a}-${b} inside ${n} measured words`);
      ok(c.display.split(' ').length === b - a + 1, `${tag}: one display word per measured word`);
      ok(drawable(c.display) && fitsBoard(c.display) && pixelText(c.display) === c.display, `${tag}: the Peg Board and Pixel Text draw it as is`);
      if (role === 'tag') {
        ok(c.impact[0] === b + 1 && c.impact[1] === b + 1 && c.impactDisplay.split(' ').length === 1 && drawable(c.impactDisplay), `${tag}: the impact is the next word`);
        ok(c.display.endsWith('-'), `${tag}: the tag is cut off`);
      }
      if (role === 'sink') ok(c.split > a && c.split <= b, `${tag}: sink split ${c.split}`);
      const want = c.default ? TRACK_ORDER : TRACK_ORDER.filter(t => fits(role, {file:p.file, ...c}, t).ok);
      ok(json(c.tracks) === json(want) && c.tracks.length, `${tag}: tracks ${c.tracks} match fits() ${want}`);
      if (c.default) ok(DEFAULT_CAST[role].file === p.file && json(DEFAULT_CAST[role].words.map(i => norm(entry, i))) === json(c.words), `${tag}: today's line`);
      roleCount[role] = (roleCount[role] || 0) + 1;
      for (const t of c.tracks) trackCount[t][role] = (trackCount[t][role] || 0) + 1;
    }
  }
}
for (const role of ROLE_ORDER) ok(ROLES.phrases.some(p => p.roles[role]?.some(c => c.default)), `role table: today's ${role} is in the table`);
const playable = ROLES.phrases.filter(p => Object.keys(p.roles).length).length;
console.log(`role table: ${cuts} cuts over ${playable}/57 recordings; per role ${JSON.stringify(roleCount)}`);
for (const t of TRACK_ORDER) console.log(`  fits ${t}: ${JSON.stringify(trackCount[t])}`);

// What Whisper heard in each cut alone (lady-roles.json `heard`), as a summary.
{
  const words = s => s.toLowerCase().replace(/[-\u2010-\u2014]/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.replace(/^'|'$/g, ''));
  let heard = 0, exact = 0, contains = 0;
  for (const p of ROLES.phrases) for (const list of Object.values(p.roles)) for (const c of list) for (const [h, text] of [[c.heard, c.display], [c.impactHeard, c.impactDisplay]]) {
    if (h === undefined || text === undefined) continue;
    heard++;
    const want = words(text), got = words(h);
    if (json(want) === json(got)) exact++;
    else if (want.every(w => got.includes(w))) contains++;
  }
  console.log(`Whisper on the cuts alone: ${heard} heard, ${exact} exact, ${contains} more with every word present`);
  const mix = {};
  for (const p of ROLES.phrases) for (const role of ['tag', 'sink']) for (const c of p.roles[role] || []) {
    for (const t of c.tracks) { const k = `${role} ${t}`; mix[k] ||= {measured:0, castable:0, whole:0}; const m = c.mix?.[t]; if (!m) continue; mix[k].measured++; if (m.recall >= MIX_MIN) mix[k].castable++; if (m.recall === 1) mix[k].whole++; }
    ok(c.tracks.every(t => c.mix?.[t]), `${p.file} ${role} ${c.display}: heard in the mix on every track it fits`);
  }
  console.log(`Whisper in the mix (two bars, every track a cut fits): ${Object.entries(mix).map(([k, v]) => `${k} ${v.whole}/${v.castable}/${v.measured}`).join(', ')} (every word / at least ${MIX_MIN * 100}% / measured)`);
}

// ---- 2. Every post: valid, deterministic, fast
const words = (file, a, b) => LADY_TABLE[file].words.slice(a, b + 1);
function validCast(r, where, {exemptDefaults = true} = {}) {
  ok(TRACK_ORDER.includes(r.track), `${where}: track ${r.track}`);
  const cast = castOf(r.cast);
  ok(LADY_ROLES.every(role => cast[role]), `${where}: every role is cast`);
  const files = new Map();
  for (const role of LADY_ROLES) {
    const c = cast[role], entry = LADY_TABLE[c.file];
    ok(entry && existsSync(join(ROOT, 'public/phrases', c.file)), `${where} ${role}: ${c.file} exists`);
    const [a, b] = c.words.map(i => norm(entry, i));
    ok(a >= 0 && b < entry.words.length && a <= b, `${where} ${role}: words ${a}-${b} inside the measured words`);
    ok(typeof c.display === 'string' && c.display.split(' ').length === b - a + 1 && drawable(c.display), `${where} ${role}: display "${c.display}"`);
    const isDefault = DEFAULT_CAST[role].file === c.file && json(DEFAULT_CAST[role].words.map(i => norm(entry, i))) === json([a, b]);
    if (role !== 'impact' && !(isDefault && exemptDefaults)) {
      const cand = {file:c.file, words:[a, b], display:c.display};
      if (role === 'tag') Object.assign(cand, {impact:[norm(LADY_TABLE[cast.impact.file], cast.impact.words[0]), norm(LADY_TABLE[cast.impact.file], cast.impact.words[1])], impactSyllables:roleEntry('tag', c.file, [a, b])?.impactSyllables});
      if (role === 'bend' || role === 'lift') cand.syllables = roleEntry(role, c.file, [a, b])?.syllables;
      if (role === 'sink') cand.split = a + c.split;
      const f = fits(role, cand, r.track);
      ok(f.ok, `${where} ${role} "${c.display}" on ${r.track}: ${f.why || 'fits'}`);
      ok(roleEntry(role, c.file, [a, b]), `${where} ${role}: a role-table cut`);
      // Heard in the mix: a recast tag or sink Whisper follows in two bars of this song.
      const heard = roleEntry(role, c.file, [a, b])?.mix?.[r.track]?.recall;
      if (role === 'tag' || role === 'sink') ok(heard === undefined || heard >= MIX_MIN, `${where} ${role} "${c.display}": heard in the ${r.track} mix (${heard})`);
    }
    if (role !== 'impact') { ok(!files.has(c.file), `${where}: ${c.file} cast twice (${files.get(c.file)}, ${role})`); files.set(c.file, role); }
  }
  ok(cast.impact.file === cast.tag.file && norm(LADY_TABLE[cast.tag.file], cast.impact.words[0]) === norm(LADY_TABLE[cast.tag.file], cast.tag.words[1]) + 1 && cast.impact.words[0] === cast.impact.words[1], `${where}: the impact is the tag's next word`);
  ok(typeof r.line === 'string' && r.line.length > 10 && r.line.length < 180 && !/[\u2014\n]/.test(r.line), `${where}: one line of copy, no em dash: ${r.line}`);
  ok(Array.isArray(r.why.track) && r.why.track.length && LADY_ROLES.every(role => r.why.lady[role]?.length), `${where}: reasons for the track and every role`);
  return cast;
}
const roleEntry = (role, file, w) => ROLES.phrases.find(p => p.file === file)?.roles[role]?.find(c => c.words[0] === w[0] && c.words[1] === w[1]);

const results = [], dist = Object.fromEntries(TRACK_ORDER.map(t => [t, 0])), recasts = {}, times = [], raw = [];
castSong(POSTS[1]);                                             // warm the JIT once
POSTS.forEach((post, i) => {
  // Best of three: a shared machine's scheduler and GC pauses are not castSong's.
  let r, ms = Infinity;
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); r = castSong(post); const d = performance.now() - t0; ms = Math.min(ms, d); raw.push(d); }
  times.push(ms);
  validCast(r, label(i));
  ok(json(castSong(post)) === json(r) && json(castSong(post, {seed:0})) === json(r), `${label(i)}: deterministic`);
  dist[r.track]++;
  for (const role of r.recast) recasts[role] = (recasts[role] || 0) + 1;
  results.push(r);
  // The manual picker: every track casts validly for every post.
  for (const t of TRACK_ORDER) { const f = castSong(post, {track:t}); ok(f.track === t, `${label(i)} forced ${t}`); validCast(f, `${label(i)} forced ${t}`); }
});
times.sort((a, b) => a - b);
const seeds = POSTS.filter(p => json(castSong(p, {seed:1})) !== json(castSong(p))).length;
console.log(`casts: ${POSTS.length} posts valid, plus ${POSTS.length * 3} with the track forced; ${seeds} change with seed 1 (tie-breaks)`);
raw.sort((a, b) => a - b);
console.log(`speed (best of three per post, warm): median ${times[times.length >> 1].toFixed(2)} ms, max ${times.at(-1).toFixed(2)} ms; every run: p95 ${raw[Math.floor(raw.length * .95)].toFixed(2)} ms, worst ${raw.at(-1).toFixed(2)} ms`);
ok(times.at(-1) < 20, `castSong under 20 ms (max ${times.at(-1).toFixed(2)})`);
const fixtureDist = Object.fromEntries(TRACK_ORDER.map(t => [t, results.slice(1).filter(r => r.track === t).length]));
console.log(`tracks over the 60 fixtures: ${JSON.stringify(fixtureDist)}; with the sample ${JSON.stringify(dist)}`);
ok(TRACK_ORDER.every(t => fixtureDist[t] >= 6 && fixtureDist[t] <= 42), 'track distribution is not degenerate (each 10-70%)');
const recastTotal = Object.values(recasts).reduce((a, b) => a + b, 0), untouched = results.filter(r => !r.recast.length).length;
console.log(`recasts: ${recastTotal} over ${POSTS.length} posts (${(recastTotal / POSTS.length).toFixed(2)} a post; ${untouched} keep today's cast): ${JSON.stringify(recasts)}`);
ok(ROLE_ORDER.every(role => recasts[role] >= 1), 'every role is recast for some post');
const fallback = results.filter(r => r.why.track[0].startsWith('nothing decisive')).length;
console.log(`fallback to Circle Back (nothing decisive): ${fallback}`);

// The sample keeps today's cast: it is the flagship film (plan.md section 2).
{
  const r = results[0], cast = castOf(r.cast);
  ok(r.track === DEFAULT_TRACK && r.recast.length === 0, `sample: Circle Back with today's cast (recast: ${r.recast})`);
  ok(LADY_ROLES.every(role => cast[role].file === DEFAULT_CAST[role].file && cast[role].display === DEFAULT_CAST[role].display), 'sample: every line is today\'s line');
}
// A post with nothing in it is Circle Back with today's cast.
{
  const r = castSong('Hello there. Nice weather today.');
  ok(r.track === DEFAULT_TRACK && r.recast.length === 0 && r.why.track[0].startsWith('nothing decisive'), 'an empty post: Circle Back, today\'s cast');
}
// Pure: no network, no clock, no randomness in the engine.
{
  const src = readFileSync(join(ROOT, 'src/allhands/casting.js'), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/\b(fetch|XMLHttpRequest|WebSocket|Math\.random|Date\b|performance\.now)/.test(src), 'casting.js: no network, clock or randomness');
}

// ---- 3. Arranged: the cast plays whole, and the board and the export read her measured words
const models = {fake:w => .18 + .11 * syllables(w), long:w => .3 + .19 * syllables(w)};
let placed = 0, dropped = [], boardWords = 0, cueWords = 0;
POSTS.forEach((post, i) => {
  const r = results[i], lyrics = lyricsFromPost(post), tr = TRACKS[r.track];
  for (const [m, f] of Object.entries(models)) {
    const durations = Object.fromEntries(dropVoicedWords(lyrics, {track:r.track}).map(w => [w, f(w)]));
    const plan = arrangeDrop(lyrics, durations, {track:r.track, cast:r.cast}), base = arrangeDrop(lyrics, durations, {track:r.track});
    const where = `${label(i)} ${m}`, cast = castOf(r.cast);
    ok(json(plan) === json(arrangeDrop(lyrics, durations, {track:r.track, cast:r.cast})), `${where}: plan deterministic`);
    // Every role that today's cast places, the post's cast places too.
    const roleOf = sinkFile => e => e.role === 'punct' ? (e.bend ? 'bend' : e.lift ? 'lift' : e.file === sinkFile && e.at === tr.drop.places.letThat ? 'sink-dry' : 'punct') : e.role;
    const have = new Set(plan.lady.map(roleOf(cast.sink.file))), had = new Set(base.lady.map(roleOf(DEFAULT_CAST.sink.file)));
    for (const role of had) if (!have.has(role)) dropped.push(`${where} ${role}`);
    placed += have.size;
    for (const e of plan.lady) {
      const entry = LADY_TABLE[e.file], inside = entry.words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6);
      ok(inside.length === e.display.split(' ').length, `${where} ${e.role} "${e.display}": one display word per measured word heard`);
      ok(inside.length === pixelText(e.display).split(' ').length, `${where} ${e.role} "${e.display}": Pixel Text keeps the word count`);
      // The sink starts where its dry words end: her pause before the deep words is kept.
      const k = entry.words.indexOf(inside[0]), from = e.role === 'sink' && k > 0 ? [inside[0].start, entry.words[k - 1].end] : [inside[0].start];
      if (e.role !== 'ladder') ok(from.some(x => Math.abs(e.from - x) < 1e-9) && Math.abs(e.to - inside.at(-1).end) < 1e-9, `${where} ${e.role}: cut on the measured boundaries`);
    }
    const tag = plan.lady.find(e => e.role === 'tag'), impact = plan.lady.find(e => e.role === 'impact');
    ok(tag && impact, `${where}: tag and impact`);
    const window = (tr.drop.impact * 16 - (tr.drop.choke.bar * 16 + tr.drop.choke.step)) * tr.step, heard = (tag.to - tag.from) / tag.rate;
    const isDefaultTag = cast.tag.file === DEFAULT_CAST.tag.file && json(cast.tag.words) === json(DEFAULT_CAST.tag.words);
    if (!isDefaultTag) {
      ok(tag.gate >= heard - 1e-9, `${where} tag "${tag.display}": heard whole (${heard.toFixed(3)} s, gate ${tag.gate.toFixed(3)})`);
      ok(window - tag.gate >= LIMITS.tag.silence - 1e-9, `${where} tag: ${(window - tag.gate).toFixed(3)} s of silence before the impact`);
    }
    ok(impact.display === cast.impact.display && impact.file === tag.file, `${where}: the impact pays off the tag`);
    // The Peg Board: each lady screen's words start where the measured words start.
    const screens = buildScreens(plan, {table:LADY_TABLE}).filter(s => s.voice === 'lady');
    for (const e of plan.lady) {
      const t0 = plan.timing[Math.floor(e.at)] + (e.at - Math.floor(e.at)) * plan.step;
      const s = screens.find(x => Math.abs(x.from - t0) < 1e-6 && x.text === e.display);
      if (!s) continue;                               // a screen the next one covers
      const inside = LADY_TABLE[e.file].words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6);
      s.words.forEach((w, k) => { ok(Math.abs(w.start - (t0 + Math.max(0, inside[k].start - e.from) / e.rate)) < 1e-6, `${where} board ${e.role} word ${k}`); boardWords++; });
    }
    // Pixel Text: the lady's cues are timed from her words, not spread.
    const timeOf = planTimeOf(plan, 0), sources = ladyCueSources(plan.lady.filter(e => e.role !== 'ladder'), {timeOf, table:LADY_TABLE});
    plan.lady.filter(e => e.role !== 'ladder').forEach((e, k) => {
      const src = sources[k], inside = LADY_TABLE[e.file].words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6), t0 = timeOf(e.at);
      ok(src && src.words.length === inside.length, `${where} Pixel Text ${e.role}: one cue word per measured word`);
      src.words.forEach((w, j) => { ok(Math.abs(w.start - (t0 + (Math.max(inside[j].start, e.from) - e.from) / e.rate)) < 1e-6, `${where} Pixel Text ${e.role} word ${j}`); cueWords++; });
    });
  }
});
console.log(`arranged: ${POSTS.length * 2} plans, ${placed} lady roles placed, ${boardWords} Peg Board words and ${cueWords} Pixel Text words on her measured boundaries`);
console.log(`roles today's cast places but the post's cast does not: ${dropped.length}${dropped.length ? ` (${dropped.slice(0, 6).join('; ')})` : ''}`);
// settleCast (the page's arrangement): no change when every role is placed,
// and today's line back when a longer recast finds no gap.
{
  let same = 0, found = null;
  POSTS.forEach((post, i) => {
    const r = results[i], lyrics = lyricsFromPost(post), durations = Object.fromEntries(dropVoicedWords(lyrics, {track:r.track}).map(w => [w, models.fake(w)]));
    const s = settleCast(arrangeDrop, lyrics, durations, {track:r.track, cast:r.cast});
    ok(!s.restored.length && json(s.plan) === json(arrangeDrop(lyrics, durations, {track:r.track, cast:r.cast})), `${label(i)}: settleCast keeps a cast that is placed`);
    same++;
  });
  const wide = w => .45 + .3 * syllables(w);
  outer: for (const post of POSTS.slice(0, 30)) for (const t of TRACK_ORDER) {
    const lyrics = lyricsFromPost(post), durations = Object.fromEntries(dropVoicedWords(lyrics, {track:t}).map(w => [w, wide(w)]));
    const base = arrangeDrop(lyrics, durations, {track:t});
    if (!base.lady.some(e => e.lift)) continue;
    for (const p of ROLES.phrases) for (const c of p.roles.lift || []) {
      if (c.default || !c.tracks.includes(t)) continue;
      const cast = {...DEFAULT_CAST, lift:{file:p.file, words:c.words, display:c.display}};
      if (arrangeDrop(lyrics, durations, {track:t, cast}).lady.some(e => e.lift)) continue;
      found = {t, display:c.display, s:settleCast(arrangeDrop, lyrics, durations, {track:t, cast})};
      break outer;
    }
  }
  ok(found && json(found.s.restored) === json(['lift']) && found.s.plan.lady.some(e => e.lift && e.display === DEFAULT_CAST.lift.display), `settleCast restores today's lift when "${found?.display}" finds no gap`);
  console.log(`settleCast: ${same} casts placed as cast; a lift with no gap ("${found.display}" on ${found.t}, wide words) goes back to "${DEFAULT_CAST.lift.display}"`);
}
ok(dropped.length === 0, "a recast never loses a role that today's cast places");

console.log(`check-casting: ${checks} checks passed`);

// ---- 4. Renders (optional): --render --url http://localhost:5331 --out <dir>
// Eight fixture posts, chosen to cover all three songs and every recast role.
const RENDER_FIXTURES = [1, 25, 0, 5, 13, 44, 38, 56];
if (process.argv.includes('--render')) await renders();

async function renders() {
  const url = arg('url', 'http://localhost:5331'), out = arg('out', join(process.env.TMPDIR || '/tmp', 'casting-takes')), model = arg('whisper-model', 'small.en');
  mkdirSync(out, {recursive:true});
  const picks = RENDER_FIXTURES.map(i => ({i, post:FIXTURES[i], r:castSong(FIXTURES[i])}));
  ok(TRACK_ORDER.every(t => picks.some(p => p.r.track === t)), 'renders: every song');
  ok(ROLE_ORDER.every(role => picks.some(p => p.r.recast.includes(role))), 'renders: every role recast at least once');
  // The page casts exactly what Node casts, and its render hook plays it.
  {
    const require = createRequire(import.meta.url), {chromium} = require('playwright');
    const browser = await chromium.launch(), page = await browser.newPage();
    await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.__allhands);
    const inPage = await page.evaluate(async posts => { const m = await import('/src/allhands/casting.js'); return posts.map(p => JSON.stringify(m.castSong(p))); }, POSTS);
    ok(inPage.every((s, k) => s === json(results[k])), 'the page casts all 61 posts exactly as Node does');
    const excerpt = await page.evaluate(post => window.__allhands.render({post, auto:true, bars:[19, 21]}).then(x => ({track:x.plan.track, casting:x.casting.track, files:x.plan.lady.map(e => `${e.role}:${e.file}:${e.display}`)})), FIXTURES[1]);
    const want = arrangeDrop(lyricsFromPost(FIXTURES[1]), {}, {track:results[2].track, cast:results[2].cast}).lady.map(e => `${e.role}:${e.file}:${e.display}`);
    ok(excerpt.track === results[2].track && excerpt.casting === results[2].track && want.every(x => excerpt.files.includes(x) || /^(bend|lift|punct):/.test(x)), `the page's render hook (auto) plays the post's cast: ${excerpt.files.filter(f => !f.startsWith('ladder')).join(', ')}`);
    await browser.close();
  }
  const index = [], summary = [];
  for (const {i, post, r} of picks) {
    const name = `fixture${String(i).padStart(2, '0')}-${r.track}`, base = join(out, name);
    writeFileSync(`${base}.post.txt`, post); writeFileSync(`${base}.cast.json`, JSON.stringify(r.cast, null, 1)); writeFileSync(`${base}.casting.json`, JSON.stringify(r, null, 1));
    if (!existsSync(`${base}.wav`) || process.argv.includes('--fresh')) {
      const t0 = Date.now();
      const run = spawnSync('node', [join(ROOT, 'scripts/render-allhands.mjs'), '--url', url, '--out', out, '--post', `${base}.post.txt`, '--track', r.track, '--cast', `${base}.cast.json`, '--name', name], {encoding:'utf8', maxBuffer:1 << 26});
      ok(run.status === 0, `render ${name}: ${run.stderr.slice(-400)}`);
      console.log(`rendered ${name} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    const take = JSON.parse(readFileSync(`${base}.json`, 'utf8')), p = take.plan, off = p.offset;
    // The plan the page played is the post's cast.
    const cast = castOf(r.cast);
    for (const role of ['tag', 'impact', 'ladder', 'sink', 'stop']) ok(p.lady.some(e => e.role === role && e.file === cast[role].file), `render ${name}: ${role} is ${cast[role].file}`);
    // Whisper windows on every lady moment, in file seconds.
    const ev = role => p.lady.filter(e => e.role === role), at = e => e.start + off;
    const spans = [];
    const add = (what, a, b, text) => spans.push({what, a, b, text:text.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()});
    const ladder = ev('ladder').find(e => e.rung === 0); if (ladder) add('ladder', at(ladder) - .04, at(ladder) + ladder.length + .22, ladder.display);
    const tag = ev('tag')[0], impact = ev('impact')[0];
    add('tag', at(tag) - .04, at(tag) + tag.length + .2, tag.display);
    add('impact', at(impact) - .04, at(impact) + .55, impact.display);
    add('tag + impact', at(tag) - .04, at(impact) + .55, `${tag.display} ${impact.display}`);
    const sink = ev('sink')[0], lead = sink && p.lady.find(e => e.role === 'punct' && e.file === sink.file && e.start < sink.start);
    if (sink) {
      const end = p.sections.find(s => s.name === 'Sink In').end + off + .05;
      add('sink', (lead ? at(lead) : at(sink)) - .04, Math.min(at(sink) + 2 * sink.length + .3, end), `${lead ? lead.display + ' ' : ''}${sink.display}`);
    }
    for (const e of p.lady.filter(e => e.role === 'punct' && e !== lead)) add(e.display === cast.bend.display ? 'bend' : e.display === cast.lift.display ? 'lift' : 'punct', at(e) - .04, at(e) + e.length + .22, e.display);
    const stop = ev('stop')[0]; if (stop) add('stop', at(stop) - .04, at(stop) + stop.length + .25, stop.display);
    // The silence: from her tag's end to the impact (the bus look-ahead delays the mix ~15 ms).
    const quiet = at(tag) + tag.length + .022, hit = p.choke.end + off + .012;
    const args = [join(ROOT, 'scripts/measure-allhands.py'), `${base}.wav`, '--plan', `${base}.json`, '--silence', `${quiet.toFixed(3)}-${hit.toFixed(3)}`, '--whisper-model', model, '--json', `${base}.gates.json`,
      ...spans.flatMap(s => ['--whisper', `${s.a.toFixed(3)}-${s.b.toFixed(3)}:${s.text}`])];
    if (!existsSync(`${base}.gates.json`) || process.argv.includes('--fresh')) {
      const gates = spawnSync('python3', args, {encoding:'utf8', maxBuffer:1 << 26});
      writeFileSync(`${base}.gates.txt`, gates.stdout + gates.stderr);
      ok(existsSync(`${base}.gates.json`), `gates ${name}: ${gates.stderr.slice(-300)}`);
    }
    const g = JSON.parse(readFileSync(`${base}.gates.json`, 'utf8'));
    const failed = g.gates.filter(x => x.status === 'FAIL'), warned = g.gates.filter(x => x.status === 'WARN');
    // A failed gate is the cast's only if today's cast passes it: render the
    // same post on the same song with today's cast and compare.
    let control = null;
    if (failed.length) {
      const cname = `${name}-todays-cast`, cbase = join(out, cname);
      if (!existsSync(`${cbase}.wav`)) {
        const run = spawnSync('node', [join(ROOT, 'scripts/render-allhands.mjs'), '--url', url, '--out', out, '--post', `${base}.post.txt`, '--track', r.track, '--name', cname], {encoding:'utf8', maxBuffer:1 << 26});
        ok(run.status === 0, `render ${cname}: ${run.stderr.slice(-400)}`);
      }
      if (!existsSync(`${cbase}.gates.json`)) {
        const cp = JSON.parse(readFileSync(`${cbase}.json`, 'utf8')).plan, ct = cp.lady.find(e => e.role === 'tag');
        const cq = ct.start + ct.length + .022 + cp.offset, ch = cp.choke.end + cp.offset + .012;
        const run = spawnSync('python3', [join(ROOT, 'scripts/measure-allhands.py'), `${cbase}.wav`, '--plan', `${cbase}.json`, '--silence', `${cq.toFixed(3)}-${ch.toFixed(3)}`, '--json', `${cbase}.gates.json`], {encoding:'utf8', maxBuffer:1 << 26});
        writeFileSync(`${cbase}.gates.txt`, run.stdout + run.stderr);
      }
      const cg = JSON.parse(readFileSync(`${cbase}.gates.json`, 'utf8'));
      control = failed.map(f => { const c = cg.gates.find(x => x.gate === f.gate); return {gate:f.gate, cast:f.value, today:c?.value, todayStatus:c?.status}; });
      const mine = control.filter(c => c.todayStatus !== 'FAIL' && !(Math.abs(parseFloat(c.cast) - parseFloat(c.today)) <= .3));
      ok(!mine.length, `gates ${name}: the cast fails ${mine.map(c => `${c.gate} ${c.cast} (today's cast ${c.today})`).join(', ')}`);
      console.log(`gates ${name}: ${control.map(c => `${c.gate} ${c.cast}, today's cast ${c.today} ${c.todayStatus}`).join('; ')}: the song book's, not the cast's`);
    }
    const mp3 = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', `${base}.wav`, '-codec:a', 'libmp3lame', '-b:a', '320k', `${base}.mp3`]);
    ok(mp3.status === 0, `mp3 ${name}`);
    const val = k => g.gates.find(x => x.gate.startsWith(k))?.value;
    summary.push({name, track:r.track, gates:{I:val('Integrated'), TP:val('True peak'), LRA:val('Loudness range'), dropA:`${val('Drop A vs Verse (mix)')} / ${val('Drop A vs Verse (phone)')}`, dropB:`${val('Drop B vs Verse (mix)')} / ${val('Drop B vs Verse (phone)')}`,
      silence:`${(hit - quiet).toFixed(3)} s ${val('Silence')}`, clipped:val('Clipped'), warn:warned.map(x => `${x.gate} ${x.value}`), fail:failed.map(x => `${x.gate} ${x.value}`), control}, whisper:g.whisper.map((w, k) => ({what:spans[k].what, said:w.expected, heard:w.heard, wer:w.wer}))});
    const excerpt = post.replace(/\s+/g, ' ').slice(0, 110) + (post.length > 110 ? '…' : '');
    const verdict = failed.length ? `${failed.map(x => `${x.gate} ${x.value} FAIL`).join(', ')}; today's cast on this post fails it too (${control.map(c => c.today).join(', ')})` : `pass${warned.length ? `, ${warned.length} warning${warned.length > 1 ? 's' : ''}` : ''}`;
    index.push(`${name}.mp3 (${TRACKS[r.track].title}, ${p.duration.toFixed(1)} s; gates: ${verdict})\n  Post: ${excerpt}\n  Why: ${r.line}\n  The lady: ${['ladder', 'tag', 'bend', 'sink', 'lift', 'punct', 'stop'].map(role => role === 'tag' ? `${cast.tag.display} ${cast.impact.display}` : cast[role].display).join(' · ')}\n  Recast from today's cast: ${r.recast.join(', ') || 'none'}\n`);
  }
  writeFileSync(join(out, 'index.txt'), `All Hands, cast by the post. Eight fixture posts, rendered through /allhands/ (Drop Edition).\nEach MP3 is 320 kbps from the 44.1 kHz render; gates in <name>.gates.txt.\n\n${index.join('\n')}`);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  for (const s of summary) {
    console.log(`\n${s.name}: I ${s.gates.I}, TP ${s.gates.TP}, LRA ${s.gates.LRA}, Drop A ${s.gates.dropA}, Drop B ${s.gates.dropB}, silence ${s.gates.silence}, clipped ${s.gates.clipped}${s.gates.warn.length ? `; warn: ${s.gates.warn.join(', ')}` : ''}${s.gates.fail.length ? `; FAIL: ${s.gates.fail.join(', ')} (today's cast: ${s.gates.control.map(c => `${c.today} ${c.todayStatus}`).join(', ')})` : ''}`);
    for (const w of s.whisper) console.log(`  ${w.what.padEnd(13)} ${w.said.slice(0, 34).padEnd(34)} | ${String(w.heard).slice(0, 44).padEnd(44)} WER ${w.wer}`);
  }
  console.log(`\ncheck-casting --render: ${checks} checks passed; takes in ${out}`);
}
