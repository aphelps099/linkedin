// The P3 audio review's regressions, in Node (no server, no audio):
//   1. arrangeDrop reads any non-table third argument as its options. Before
//      the fix, {} and {track:undefined, cast:undefined} (what the page's render
//      hook passes when no song is named, so `node scripts/render-allhands.mjs`
//      by default) were taken for the lady table, and the Drop Edition played
//      with no lady at all: no ladder, no tag, no BACK.
//   2. Every way of asking for Circle Back's Drop Edition, the render hook's
//      settleCast path included, arranges the same plan as the two-argument call.
//   3. Every track: the wait from the end of her tag to BACK. Aaron (P6): one
//      song waited too long. Now 0.37-0.42 s on every track, Circle Back's 0.392 s
//      the reference (drop.js IMPACT_GAP), for today's cast and the cast each
//      fixture post picks, and (section 6) with real durations, both casts.
//   4. Casting copy: the one line quotes the post verbatim, never a fragment that
//      reads out of context (the 4-year-old post quoted "hit me").
//   5. The Peg Board gives every one of her events a screen that starts on it.
// P4 (song-fix), with the real eSpeak durations of every word the 61 posts sing
// (fixtures/allhands-durations.json, measured as voice.js measures a take):
//   6. "Read that again." (or the post's own punctuation line) is placed on every
//      post on every track, today's cast and the post's own; Synergy never sings
//      over himself in Hustle's bars 26-28.
//   7. choke.tagEnd is where her tag stops sounding, for every track and cast.
//   8. The verse's room for the drops (plan.energyTrim) is zero on Circle Back's
//      sample post and inside 0-2.5 dB everywhere.
//   9. The casting line: no quote ends on a function word or repeats someone's
//      family or health back at them; a goodbye on Humbled and Honored is a journey.
// With --url http://localhost:PORT: every track's Drop Edition (and Circle Back
// with the cold open) is rendered twice, each in a fresh browser, and the two
// WAVs must be the same bytes (exact.js); and on every track a live tick that
// reaches the Sink In downbeat late must schedule it without throwing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arrangeDrop, dropVoicedWords, ladyLength, IMPACT_GAP} from '../src/allhands/drop.js';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {FORMS} from '../src/allhands/forms.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';
import {castSong, settleCast} from '../src/allhands/casting.js';
import {TRACKS, TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {buildScreens} from '../src/pegboard/choreo.js';

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const json = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures/pixel-posts.json', import.meta.url), 'utf8')).map(x => x.post);
const POSTS = [SAMPLE_POST, ...FIXTURES], label = i => (i === 0 ? 'sample' : `fixture ${i - 1}`);
const models = {fake:w => .18 + .11 * syllables(w), long:w => .3 + .19 * syllables(w)};

// ---- 1, 2. The options object is never the lady table
POSTS.forEach((post, i) => {
  const lyrics = lyricsFromPost(post);
  for (const [m, f] of Object.entries(models)) {
    const d = Object.fromEntries(dropVoicedWords(lyrics).map(w => [w, f(w)])), base = arrangeDrop(lyrics, d), want = json(base);
    ok(base.lady.length >= 40 && base.lady.some(e => e.role === 'impact'), `${label(i)} ${m}: today's Drop Edition has the lady`);
    for (const [name, call] of [
      ['{}', () => arrangeDrop(lyrics, d, {})],
      ['{track:undefined, cast:undefined}', () => arrangeDrop(lyrics, d, {track:undefined, cast:undefined})],
      ['the table', () => arrangeDrop(lyrics, d, LADY_TABLE)],
      ['the table, {track}', () => arrangeDrop(lyrics, d, LADY_TABLE, {track:'circle-back'})],
      ["{track:'circle-back'}", () => FORMS.drop60.arrange(lyrics, d, {track:'circle-back'})],
      ['the render hook: settleCast, no song named', () => settleCast(FORMS.drop60.arrange, lyrics, d, {track:undefined, cast:undefined}).plan],
    ]) ok(json(call()) === want, `${label(i)} ${m}: arrangeDrop(${name}) is today's plan`);
    for (const track of TRACK_ORDER) {
      const dt = Object.fromEntries(dropVoicedWords(lyrics, {track}).map(w => [w, f(w)])), a = arrangeDrop(lyrics, dt, {track});
      ok(a.lady.length > 30 && json(a) === json(arrangeDrop(lyrics, dt, LADY_TABLE, {track})) && json(a) === json(arrangeDrop(lyrics, dt, {track, cast:undefined, table:undefined})), `${label(i)} ${m} ${track}: options read the same however they are passed`);
    }
  }
});

// ---- 3. The wait from the end of her tag to BACK., per track and cast (exact silence between: check-songbook)
const silenceOf = plan => plan.timing[plan.choke.until] - plan.choke.tagEnd;
const inGap = s => s >= IMPACT_GAP.min - 1e-9 && s <= IMPACT_GAP.max + 1e-9;
const silences = Object.fromEntries(TRACK_ORDER.map(t => [t, []]));
POSTS.forEach((post, i) => {
  const lyrics = lyricsFromPost(post), c = castSong(post);
  for (const track of TRACK_ORDER) {
    const d = Object.fromEntries(dropVoicedWords(lyrics, {track}).map(w => [w, models.fake(w)]));
    const today = silenceOf(arrangeDrop(lyrics, d, {track}));
    silences[track].push(today);
    if (track === 'circle-back') ok(Math.abs(today - .392) < .001, `${label(i)}: Circle Back's wait is the documented 0.392 s (${today.toFixed(3)})`);
    else ok(inGap(today), `${label(i)} ${track}: today's tag ends ${today.toFixed(3)} s before BACK.`);
    if (c.track === track) {
      const plan = settleCast(FORMS.drop60.arrange, lyrics, d, {track, cast:c.cast}).plan, s = silenceOf(plan);
      const isToday = c.cast.tag.file === '06.wav' && json(c.cast.tag.words) === '[0,1]';
      ok(isToday ? Math.abs(s - today) < 1e-9 : inGap(s), `${label(i)} ${track}: the post's tag "${c.cast.tag.display}" ends ${s.toFixed(3)} s before BACK.`);
      // ---- 5. Every lady event has its own Peg Board screen, on time, with her words (a fragment of
      // her ladder shows the whole words it comes from, its own letters lit: screen.fragment)
      const screens = buildScreens(plan, {table:LADY_TABLE});
      for (const e of plan.lady) {
        const t0 = plan.timing[Math.floor(e.at)] + (e.at - Math.floor(e.at)) * plan.step;
        ok(screens.some(x => x.voice === 'lady' && Math.abs(x.from - t0) < 1e-6 && (x.fragment ?? x.text) === e.display), `${label(i)} ${track}: a Peg Board screen for ${e.role} "${e.display}" at ${t0.toFixed(3)} s`);
      }
    }
  }
});

// ---- 4. The one line of copy quotes the post as written
const flat = s => s.normalize('NFKC').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
POSTS.forEach((post, i) => {
  const {line} = castSong(post), quotes = [...line.matchAll(/“([^”]+)”/g)].map(m => m[1]);
  for (const q of quotes) ok(flat(post).toLowerCase().includes(flat(q).toLowerCase()), `${label(i)}: “${q}” is in the post`);
  ok(!quotes.some(q => /^(hit|told|call|tell|ask|show|give)\s+(me|you|her|him|us|them)$/i.test(q)), `${label(i)}: no out-of-context verb-object fragment in "${line}"`);
});
ok(/“when it hit me”/.test(castSong(FIXTURES[2]).line), 'fixture 2: the epiphany is quoted whole: “when it hit me”');

// ---- 6-8. Real eSpeak durations
const REAL = JSON.parse(readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8'));
const gapRole = e => e.role !== 'punct' ? e.role : e.bend ? 'bend' : e.lift ? 'lift' : 'punct';
const placed = {}, trims = Object.fromEntries(TRACK_ORDER.map(t => [t, []]));
POSTS.forEach((post, i) => {
  const lyrics = lyricsFromPost(post);
  for (const track of TRACK_ORDER) for (const own of [false, true]) {
    const cast = own ? castSong(post, {track}).cast : undefined, plan = settleCast(FORMS.drop60.arrange, lyrics, REAL, {track, cast}).plan, T = plan.timing;
    const punct = plan.lady.filter(e => gapRole(e) === 'punct' && e.at >= plan.marks.impact + 64);
    ok(punct.length === 1, `${label(i)} ${track}${own ? ' (its cast)' : ''}: her punctuation line is placed (real eSpeak durations)`);
    placed[track] = (placed[track] || 0) + punct.length;
    if (track === 'hustle') {
      const ws = plan.words.filter(w => w.line >= 0 && w.at >= 26 * 16 && w.at < 29 * 16).sort((a, b) => a.at - b.at);
      ok(ws.every((w, k) => !k || w.at >= ws[k - 1].at + ws[k - 1].steps), `${label(i)} hustle: Synergy never sings over himself in bars 26-28`);
    }
    const tag = plan.lady.find(e => e.role === 'tag'), tagAt = T[Math.floor(tag.at)] + (tag.at % 1) * plan.step;
    ok(Math.abs(plan.choke.tagEnd - (tagAt + ladyLength(tag))) < 1e-9 && tagAt === plan.choke.time && inGap(T[plan.choke.until] - plan.choke.tagEnd), `${label(i)} ${track}${own ? ' (its cast)' : ''}: choke.tagEnd ${plan.choke.tagEnd.toFixed(3)} s is when "${tag.display}" stops, ${((T[plan.choke.until] - plan.choke.tagEnd) * 1000).toFixed(0)} ms before BACK.`);
    const trim = plan.energyTrim?.Verse ?? 0;
    ok(trim >= 0 && trim <= 2.5, `${label(i)} ${track}: the verse's room ${trim} dB`);
    if (!own) trims[track].push(trim);
    if (i === 0 && track === 'circle-back') ok(trim === 0, 'sample: Circle Back leaves its verse as it was (no room trim)');
  }
});

// ---- 9. The casting line reads well
const FUNCTION_END = /\s(?:at|to|of|for|the|a|an|and|in|on|with|my|our|from|by)$/i, SENSITIVE = /\b(?:family|health|cried|son|daughter|wife|husband|mom|dad)\b/i;
POSTS.forEach((post, i) => {
  const {line, track} = castSong(post), quotes = [...line.matchAll(/“([^”]+)”/g)].map(m => m[1]);
  ok(quotes.every(q => !FUNCTION_END.test(q) && !SENSITIVE.test(q)), `${label(i)}: "${line}" ends no quote on a function word and quotes no family or health`);
  if (track === 'humbled-and-honored' && /stepping back|last day|after careful reflection/i.test(post)) ok(/Grateful for this journey\.$/.test(line), `${label(i)}: a goodbye is a journey, not "very honored"`);
});
ok(/“Some personal news”, “stepping back”/.test(castSong(FIXTURES[22]).line) && !/health/.test(castSong(FIXTURES[22]).line), 'fixture 22: the line no longer quotes “family, my health”');

const range = list => `${Math.min(...list).toFixed(3)}-${Math.max(...list).toFixed(3)} s`;
console.log(`punctuation placed with real durations: ${TRACK_ORDER.map(t => `${TRACKS[t].title} ${placed[t]}/${POSTS.length * 2}`).join(', ')}`);
console.log(`verse room (dB, today's cast): ${TRACK_ORDER.map(t => `${TRACKS[t].title} ${Math.min(...trims[t])}-${Math.max(...trims[t])}, ${trims[t].filter(x => x > 0).length} posts`).join('; ')}`);

// ---- Optional: byte-identical renders
const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;
if (url) {
  const require = createRequire(import.meta.url);
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright for --url.'); })();
  const take = async job => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
      await page.waitForFunction(() => window.__allhands);
      const r = await page.evaluate(o => window.__allhands.render(o), job);
      return createHash('sha256').update(Buffer.from(r.wav, 'base64')).digest('hex');
    } finally { await browser.close(); }
  };
  for (const job of [...TRACK_ORDER.map(track => ({track})), {track:'circle-back', coldOpen:true}, {track:'offsite', coldOpen:true}]) {
    const a = await take(job), b = await take(job);
    ok(a === b, `${JSON.stringify(job)}: two renders in fresh browsers are the same bytes (${a.slice(0, 16)})`);
    console.log(`  ${JSON.stringify(job)} ${a.slice(0, 16)} = ${b.slice(0, 16)}`);
  }
  // P4 review: a live tick that reaches the Sink In downbeat late (the main thread
  // stalled past the 0.3 s look-ahead) must not throw. Web Audio starts a late
  // curve at currentTime, and the reset at the bar's end then landed inside it:
  // NotSupportedError, and the rest of that step (her "sink in", the kick, the
  // bass) was never scheduled. Reproduced in headless playback on two tracks.
  const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  try {
    const page = await browser.newPage();
    await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
    for (const track of TRACK_ORDER) {
      const err = await page.evaluate(async track => {
        const F = await import('/src/allhands/forms.js'), L = await import('/src/allhands/lyrics.js'), E = await import('/src/allhands/engine.js');
        const plan = F.FORMS.drop60.arrange(L.lyricsFromPost(L.SAMPLE_POST), {}, {track}), ctx = new AudioContext();
        await ctx.resume(); await new Promise(r => setTimeout(r, 400));
        const graph = E.buildGraph(ctx, {}, plan), song = E.prepare(plan, new Map()), sink = plan.marks.sink;
        const t0 = ctx.currentTime - .25 - plan.timing[sink];     // the downbeat is 250 ms in the past
        try { E.scheduleStep(graph, song, sink, t0); return null; } catch (e) { return e.message; } finally { ctx.close(); }
      }, track);
      ok(err === null, `${track}: a late tick at the Sink In downbeat schedules without throwing (${err})`);
    }
  } finally { await browser.close(); }
}
console.log(`from the end of today's tag to BACK.: ${TRACK_ORDER.map(t => `${TRACKS[t].title} ${range(silences[t])}`).join(', ')}`);
console.log(`review-audio: ${checks} checks passed`);
