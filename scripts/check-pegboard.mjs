// Peg Board choreography: screens from real song plans, onsets on time, the
// silence and the ignition, determinism, and the flash governor. Pure Node.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBoard} from '../src/pegboard/board.js';
import {compileFont, layoutText} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {PEG3} from '../src/pegboard/fonts/peg3.js';
import {buildScreens, paint, indexWords, activeScreen, syllableSpans, darkAt, TAG_TAIL, CHOKE_TAIL, CODEC_FLOOR, stopEndAt, stopDarkAt, STOP_DIM, FRAGMENT_FULL, FRAGMENT_ACCENT, READ_AHEAD, boardState, bandOf, strikeRows, strikeWeight, STRIKE, ROCK, RIVER_PHRASES, TAG_MIN_PITCH, TAG_LIGHT, BAND_VOICES} from '../src/pegboard/choreo.js';
import {LINE_BREAK, normalize} from '../src/pegboard/font.js';
import {linesFor, stagePitch, STAGE_COLS} from '../src/pegboard/stage.js';
import {castSong} from '../src/allhands/casting.js';
import {PALETTE} from '../src/pegboard/board.js';
import {ladyLength} from '../src/allhands/drop.js';
import {boardLuma, flashes, worstWindow, governorTrack} from '../src/pegboard/governor.js';
import {FORMS, formPlays} from '../src/allhands/forms.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {kickSteps} from '../src/pegboard/eq.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';
import {clearBoard, TONES} from '../src/pegboard/board.js';
import {paintPsych, PSYCH_LOOKS, PSYCH_TONES, PSYCH_MAX, TYPE_HALO, driveTrack, driveAt, riverTrack, riverAt, layerGain} from '../src/pegboard/psych.js';
import {planFeatures} from '../src/videostudio/edl/params.js';

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const FPS = 24, FRAME = 1 / FPS;
const faces = {peg9:compileFont(PEG9), peg5:compileFont(PEG5)};
const POSTS = [SAMPLE_POST, `Humbled and honored to share that I've been promoted to Senior Director of Synergy. This journey taught me that leadership is a mindset, not a title. Grateful for every step. Agree?`];

// A board with the stage's fitting rules (stage.js layoutOf, linesFor): chart rows under the type, the
// type inside `span` columns, `pitch` for the role tags.
function rig(plan, cols = 120, rows = 53, {chart = 11, span = cols - 4, pitch = 0} = {}) {
  const board = createBoard(cols, rows), textRows = rows - chart - 1, cache = new Map(), c0 = Math.floor((cols - span) / 2);
  const screens = buildScreens(plan, {table:LADY_TABLE}).map(indexWords);
  const layoutOf = s => {
    if (cache.has(s)) return cache.get(s);
    let out = null;
    for (const f of ['peg9', 'peg5']) { for (let k = s.k; k >= 1 && !out; k--) { const l = layoutText(s.text, {font:faces[f], k, maxCols:span, maxLines:linesFor(s, faces[f], k, textRows)}); if (l.width <= span && l.height <= textRows) out = l; } if (out) break; }
    cache.set(s, out); return out;
  };
  const place = (s, l, page) => ({x:c0 + Math.floor((span - Math.max(...page.lines.map(x => x.width))) / 2), y:Math.max(1, Math.floor((textRows - l.height) / 2))});
  const at = t => paint(board, screens, t, {plan, layoutOf, place, pitch});
  return {board, screens, layoutOf, place, at, textRows};
}

ok(JSON.stringify(syllableSpans('BUILDING', 2)) === '[[0,3],[3,8]]' || syllableSpans('BUILDING', 2).length === 2, 'syllables split a word into its notes');
ok(syllableSpans('A', 3).length === 1 && syllableSpans('OPTIMIZE', 3).length === 3, 'syllable spans never exceed the letters');

// Every form in every song book track that plays it (Sound check 00 is Circle Back's).
for (const id of ['drop60', 'soundcheck']) for (const track of TRACK_ORDER.filter(t => formPlays(id, t))) for (const post of POSTS) {
  const lyrics = lyricsFromPost(post), form = FORMS[id];
  const plan = form.arrange(lyrics, Object.fromEntries(form.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)])), {track});
  const {board, screens, layoutOf, at} = rig(plan), label = `${id}/${track}/${post.slice(0, 12)}`, place = rig(plan).place;
  ok(screens.every((s, i) => s.to > s.from && (!i || s.from >= screens[i - 1].from)), `${label}: screens ordered`);
  ok(screens.filter(s => !s.under).every((s, i, a) => i === a.length - 1 || s.to <= a[i + 1].from + 1e-9), `${label}: one screen at a time`);
  ok(screens.every(s => layoutOf(s)?.pages?.length), `${label}: every screen lays out on the board`);
  // Every sung unit lights on time: hot within a frame of its onset, not before.
  let units = 0, late = 0, early = 0;
  for (const s of screens) for (const w of s.words) for (const u of w.units) {
    if (activeScreen(screens, u.start + FRAME) !== s || s.reveal !== 'pop' || u.start < s.from) continue;
    units++;
    at(u.start + FRAME);
    const hot = board.I.some(v => v >= 1);
    if (!hot) late++;
    at(u.start - 2 * FRAME);
    if (activeScreen(screens, u.start - 2 * FRAME) === s && board.I.filter(v => v >= 1.3).length > board.I.filter(v => v >= 1).length) early++;
  }
  ok(units > 10 && late === 0, `${label}: ${units} popped units all light within a frame (${late} late)`);
  ok(early === 0, `${label}: nothing pops before its onset`);
  // Determinism.
  at(17.3); const a = board.I.slice(); at(17.3);
  ok(a.every((v, i) => v === board.I[i]), `${label}: same moment, same pegs`);
  // The kick accent reads the track's own kicks: on the plan's kick steps, nowhere else.
  const kicks = kickSteps(plan);
  ok(kicks.length === plan.totalSteps + 1 && plan.bars.some((b, i) => kicks[i * 16]) && kicks.reduce((n, k) => n + k, 0) > plan.bars.length, `${label}: kick steps from the band`);
  if (id === 'drop60') {
    // The choke: a painted time is the middle of a frame. The board stays lit, her whole tag typed,
    // through the last frame she is heard in (her envelope ends at plan.choke.tagEnd), goes true black
    // on the first frame that starts after it, holds it, and ignites on the frame that holds the impact.
    // (P6: the choke is where her tag starts, a 128th of the bar: plan.choke.time.)
    const T = plan.timing, choke = plan.choke.time, impact = T[plan.choke.until], end = plan.choke.tagEnd, tag = screens.find(s => s.kind === 'tag');
    ok(end > choke && end < impact - .3 && Math.abs(darkAt(plan) - (end + CHOKE_TAIL + FRAME / 2)) < 1e-12 && CHOKE_TAIL >= Math.max(...Object.values(CODEC_FLOOR)) + .005 - 1e-12, `${label}: the board goes dark on the first frame after her tag stops sounding (${end.toFixed(3)} s, plus the choke's ${(CHOKE_TAIL * 1000).toFixed(0)} ms codec tail: Opus ${CODEC_FLOOR.opus * 1000} ms of floor after a hard cut, 5 ms to spare), well before the impact`);
    const typed = (() => { const b = createBoard(board.cols, board.rows); paint(b, [{...tag, to:impact}], end - 1e-3, {layoutOf, place:rig(plan).place}); return b.I.filter(v => v > .05).length; })();
    at(end + CHOKE_TAIL + FRAME * .49); const last = board.I.filter(v => v > .05).length;
    ok(board.exposure > 0 && activeScreen(screens, end + CHOKE_TAIL + FRAME * .49) === tag && last >= typed && typed > 20, `${label}: "${tag.text}" fully typed on her last frame (${last} of ${typed} pegs)`);
    at(end + CHOKE_TAIL + FRAME * .51); ok(board.exposure === 0 && board.sockets === 0, `${label}: true black from the first frame after her tag`);
    let black = true; for (let t = end + CHOKE_TAIL + FRAME * .51; t < impact - FRAME * .51; t += .01) { at(t); black &&= board.exposure === 0 && board.sockets === 0; }
    ok(black, `${label}: true black (0) all the way to the impact's frame`);
    const burning = () => board.I.filter(v => v >= 1.15).length / (board.cols * board.rows);
    at(impact - FRAME * .49); ok(board.I.filter(v => v > .5).length > board.cols * board.rows * .8 && burning() > .8, `${label}: the board ignites, fully lit, on the frame that holds the impact`);
    at(impact + FRAME * .51); ok(board.I.filter(v => v > .5).length > board.cols * board.rows * .5 && burning() < .2, `${label}: one frame fully lit, then the settle (${(100 * burning()).toFixed(0)} % still burning)`);
    at(impact + .3); ok(screens.find(s => s.kind === 'impact') === activeScreen(screens, impact + .3), `${label}: BACK. holds the board after the impact`);
    // The ending: her "Full stop." is routed after the tape, so the tape stop does not stop her. The
    // board keeps it lit (never under STOP_DIM of full exposure) through every frame she is heard in,
    // fully typed and readable on the last one, slid down 2 pegs; true black from the first frame
    // that starts after she stops sounding (plan.stop.end, else her envelope's end), as at the choke.
    const stopEv = plan.lady.find(e => e.role === 'stop'), sEnd = stopEndAt(plan), s0 = T[Math.floor(stopEv.at)] + (stopEv.at % 1) * plan.step, sScreen = screens.find(s => s.kind === 'stop');
    ok(Math.abs(sEnd - (s0 + ladyLength(stopEv))) < 1e-9 && (plan.stop?.end == null || Math.abs(plan.stop.end - sEnd) < 1e-9) && Math.abs(stopDarkAt(plan) - (sEnd + TAG_TAIL + FRAME / 2)) < 1e-12 && sEnd > T[plan.tape.find(x => x.kind === 'stop').from] + .4, `${label}: "${stopEv.display}" sounds ${s0.toFixed(3)}-${sEnd.toFixed(3)} s, past the tape stop; the board goes dark on the first frame after it`);
    const page = layoutOf(sScreen).pages[0], total = page.lines.flatMap(l => l.chars).reduce((n, c) => n + c.pegs.length / 2, 0);
    let dim = 1, gone = 0;
    for (let t = s0 + FRAME * .5; t < sEnd + TAG_TAIL + FRAME * .5; t += FRAME) { at(t); dim = Math.min(dim, board.exposure); if (activeScreen(screens, t) !== sScreen) gone++; }
    at(sEnd + TAG_TAIL + FRAME * .49);
    const lit = [...board.I].filter(v => v > .05), mean = lit.reduce((a, v) => a + v, 0) / Math.max(1, lit.length), slid = Math.max(...board.dy);
    ok(!gone && dim >= STOP_DIM - 1e-9 && lit.length === total && total > 20 && mean * board.exposure >= .5 && slid > 1.9 && slid <= 2 + 1e-9, `${label}: "${sScreen.text}" lit on every frame she is heard in (exposure at least ${dim.toFixed(2)}), fully typed on her last frame (${lit.length} of ${total} pegs, mean light ${(mean * board.exposure).toFixed(2)}), slid down ${slid.toFixed(2)} pegs`);
    at(sEnd + TAG_TAIL + FRAME * .51); ok(board.exposure === 0 && board.sockets === 0, `${label}: true black from the first frame after "${sScreen.text}"`);
    // The flash governor: no second ever holds more than three flashes, whole or by quarter.
    const frames = [];
    for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) { at(f / FPS); frames.push(boardLuma(board)); }
    const gains = governorTrack(frames, FPS);
    for (const k of [-1, 0, 1, 2, 3]) {
      const series = frames.map((f, i) => (k < 0 ? f.whole : f.quads[k]) * gains[i]);
      ok(worstWindow(flashes(series, FPS), FPS) <= 3, `${label}: governed ${k < 0 ? 'frame' : `quarter ${k}`} has at most 3 flashes a second`);
    }
    ok(gains.filter(g => g < 1).length < gains.length * .05, `${label}: the governor touches under 5% of frames`);
    // Every rung of a stutter, fully lit: ungoverned, its span (a second either side) has at most 3 flashes
    // a second, whole and by quarter, so the governor never has to dim a stutter's word.
    const fragF = frames.map((_, f) => activeScreen(screens, f / FPS)?.fragment ? f : -1).filter(f => f >= 0);
    if (fragF.length) {
      const span = s => s.slice(Math.max(0, fragF[0] - FPS), fragF.at(-1) + FPS), worst = [-1, 0, 1, 2, 3].map(k => worstWindow(flashes(span(frames.map(f => k < 0 ? f.whole : f.quads[k])), FPS), FPS));
      ok(Math.max(...worst) <= 3 && fragF.every(f => gains[f] === 1), `${label}: the fully lit stutters (${fragF.length} frames) need no governing: at most ${Math.max(...worst)} flashes a second ungoverned, whole and by quarter, gain 1 on every frame`);
    }
  }
}

// Whole words in stutters, fully lit. Every fragment the board shows (her ladder's "LE" and "LET'S
// BU-", the intro's tease of BACK., Synergy's stammer) is the whole word or words it comes from, every
// letter at full from the screen's first frame to its last (nothing dim); the sounding letters wear
// the white-hot accent (FRAGMENT_ACCENT) and re-pop on every retrigger. Every track, both posts, and
// every phrase the casting can give her ladder.
{
  const ROLES = JSON.parse(fs.readFileSync(new URL('../src/allhands/lady-roles.json', import.meta.url), 'utf8'));
  const ladders = ROLES.phrases.flatMap(p => (p.roles?.ladder || []).map(l => ({file:p.file, words:l.words, display:l.display}))).filter(l => LADY_TABLE[l.file]);
  const lit = w => w.text.slice(0, w.lit ?? w.text.length);
  let screensSeen = 0, pegsSeen = 0, pops = 0, popsSeen = 0;
  const cases = [];
  for (const track of TRACK_ORDER.filter(t => formPlays('drop60', t))) for (const post of POSTS) cases.push({track, post});
  // Every ladder cut, on Circle Back and on Offsite (where the ladder is a round of her voices).
  for (const l of ladders) for (const track of ['circle-back', 'offsite']) cases.push({track, post:SAMPLE_POST, cast:{ladder:l}});
  for (const id of ['soundcheck']) cases.push({form:id, track:'circle-back', post:SAMPLE_POST});
  for (const {form = 'drop60', track, post, cast} of cases) {
    const lyrics = lyricsFromPost(post), F = FORMS[form];
    const plan = F.arrange(lyrics, Object.fromEntries(F.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)])), {track, cast});
    const {board, screens, layoutOf, place, at} = rig(plan), label = `${form}/${track}${cast ? ` cast "${cast.ladder.display}"` : `/${post.slice(0, 12)}`}`;
    const phrase = cast ? cast.ladder.display : plan.lady.filter(e => e.role === 'ladder').reduce((a, e) => e.display.length > a.length ? e.display : a, '');
    // Every ladder hit that plays part of her phrase shows the whole words; the rest show the phrase.
    const hits = plan.lady.filter(e => e.role === 'ladder'), shown = hits.map(e => screens.find(s => s.kind === 'ladder' && Math.abs(s.from - (plan.timing[Math.floor(e.at)] + (e.at % 1) * plan.step)) < 1e-9)).filter(Boolean);
    const frag = screens.filter(s => s.fragment);
    const bad = frag.filter(s => {
      const sounding = s.words.map(lit).join(' '), whole = s.words.map(w => w.text).join(' ');
      return sounding !== s.fragment.replace(/-$/, '') || whole !== s.text || !(s.kind === 'ladder' ? phrase.toUpperCase().startsWith(whole.toUpperCase()) : whole.toUpperCase().startsWith(sounding.toUpperCase())) || /-$/.test(whole);
    });
    const partial = shown.filter(s => !s.fragment && !phrase.toUpperCase().startsWith(s.text.toUpperCase()));
    ok(frag.length > 0 && !bad.length && !partial.length && (form !== 'drop60' || frag.some(s => s.kind === 'tease' && s.text.startsWith('BACK') ? s.fragment === 'BA' : s.kind === 'tease')),
      `${label}: ${frag.length} fragment screens (${[...new Set(frag.map(s => `${s.fragment} in ${s.text}`))].join(', ')}) show their whole words with the sounding letters lit (${bad.slice(0, 2).map(s => s.text).join(', ')}${partial.slice(0, 2).map(s => s.text).join(', ')})`);
    // On the board: every peg of the whole word at full (nothing dim), the sounding letters with the
    // white-hot accent and the rest of the word without it, nothing else lit; on every frame the screen
    // holds, from its first.
    let wrong = 0, dim = 0, framesSeen = 0, held = 0;
    for (const s of frag) {
      const layout = layoutOf(s), page = layout.pages[0], o = place(s, layout, page), units = s.words.flatMap(w => w.units.map(u => u.start));
      if (layout.pages.length !== 1) { wrong++; continue; }   // the whole words are on the board at once
      const u0 = Math.max(s.from, ...units), t = u0 + Math.min(FRAME, (s.to - u0) / 2);
      if (activeScreen(screens, t) !== s) continue;
      at(t);
      const want = new Map();
      for (const line of page.lines) for (const ch of line.chars) {
        const w = s.words[ch.word], inWord = ch.index - s.wordStarts[ch.word], on = inWord < (w.lit ?? w.text.length);
        for (let i = 0; i < ch.pegs.length; i += 2) want.set((o.y + ch.pegs[i + 1] + (s.fx.rowShift || 0)) * board.cols + o.x + ch.pegs[i], on);
      }
      // (The climax's sparkle burns random pegs white: those are not read for the accent.)
      for (const [j, on] of want) if (board.I[j] < FRAGMENT_FULL - 1e-6 || (on ? board.white[j] < FRAGMENT_ACCENT - 1e-6 : board.white[j] > 0 && !(s.fx.sparkle > 0))) wrong++;
      for (let j = 0; j < board.I.length; j++) if (board.I[j] > 0 && !want.has(j)) wrong++;
      // Every frame it holds, from its first, before every letter has sounded: the whole word at full.
      for (let tf = s.from + Math.min(FRAME * .25, (s.to - s.from) / 2); tf < s.to; tf += FRAME / 2) {
        if (activeScreen(screens, tf) !== s) continue;
        at(tf); framesSeen++;
        for (const j of want.keys()) if (board.I[j] < FRAGMENT_FULL - 1e-6) dim++;
      }
      screensSeen++; held++; pegsSeen += want.size;
    }
    ok(wrong === 0 && dim === 0 && framesSeen >= held, `${label}: on the board every fragment's whole word lights at full (${FRAGMENT_FULL}) on all ${framesSeen} painted moments, nothing dim; its sounding letters wear the white-hot accent (white ${FRAGMENT_ACCENT}), the rest do not (${wrong} pegs wrong, ${dim} dim)`);
    // The stutter still shows: on every retrigger of a fragment the lit letters pop (size or heat) and settle before the next.
    const ladderFrag = frag.filter(s => s.kind === 'ladder');
    for (let i = 0; i + 1 < ladderFrag.length; i++) {
      const a = ladderFrag[i], b = ladderFrag[i + 1];
      if (b.from - a.from > 1) continue;
      const kick = () => Math.max(...[...board.size].map((v, j) => board.I[j] > .5 ? v : 1)) + Math.max(...board.white);
      at(a.from + FRAME * .25); const hot = kick();
      at(b.from - FRAME * .25); const cool = kick();
      popsSeen++; if (hot > cool + .03) pops++;
    }
    ok(popsSeen === 0 || pops === popsSeen, `${label}: the lit letters re-pop on each of ${popsSeen} retriggers (${pops})`);
  }
  ok(screensSeen > 400 && pegsSeen > 20000, `fragments painted: ${screensSeen} screens, ${pegsSeen} pegs`);
}

// No partial words while typing (the board /allhands/'s stage and the films paint): every typewriter
// screen that is not Synergy's (her tag, her whole-phrase rungs, "FULL STOP.", the board's titles) has
// every peg of its page lit on its first painted frame, the letters still to type at READ_AHEAD, and its
// last letter typed in full by the time it ends.
for (const track of TRACK_ORDER.filter(t => formPlays('drop60', t))) {
  const lyrics = lyricsFromPost(SAMPLE_POST), form = FORMS.drop60;
  const plan = form.arrange(lyrics, Object.fromEntries(form.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)])), {track});
  const {board, screens, layoutOf, place, at} = rig(plan), kinds = new Map();
  let holes = [], ghosts = 0;
  for (const s of screens.filter(x => x.reveal === 'typewriter' && x.voice !== 'synergy' && !x.ghost)) {
    const l = layoutOf(s); if (!l?.pages?.length) continue;
    const page = l.pages[0], o = place(s, l, page), want = page.lines.flatMap(x => x.chars).flatMap(ch => { const out = []; for (let i = 0; i < ch.pegs.length; i += 2) out.push((o.y + ch.pegs[i + 1] + (s.fx?.rowShift || 0)) * board.cols + o.x + ch.pegs[i]); return out; });
    at(s.from + FRAME * .5);
    if (board.exposure <= 0 || activeScreen(screens, s.from + FRAME * .5) !== s) continue;
    kinds.set(s.kind, (kinds.get(s.kind) || 0) + 1);
    const dark = want.filter(i => !(board.I[i] > 0));
    if (dark.length) holes.push(`${s.kind} "${s.text}" ${dark.length} of ${want.length}`);
    ghosts += want.filter(i => Math.abs(board.I[i] - READ_AHEAD) < 1e-6).length;
  }
  ok(kinds.size >= 3 && !holes.length && ghosts > 50, `${track}: no partial words: every typewriter phrase (${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}) is whole on its first frame, ${ghosts} pegs waiting at the read-ahead ghost${holes.length ? `; holes: ${holes.slice(0, 3).join('; ')}` : ''}`);
}
// Psychedelic imagery on the dot grid (psych.js): every look deterministic, palette-only (never green),
// governor-safe on long runs with no governing at all, breathing with the music, and always under the type.
{
  const before = checks;
  const lyrics = lyricsFromPost(SAMPLE_POST), form = FORMS.drop60, track = 'offsite';
  const plan = form.arrange(lyrics, Object.fromEntries(form.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)])), {track});
  const features = planFeatures(plan), fromFeatures = driveTrack({plan, features}), fromPlan = driveTrack({plan}), clock = driveTrack({bpm:108, duration:30});
  const beats = t => fromFeatures.beat(t);
  ok(Math.abs(beats(plan.timing[64]) - 16) < 1e-9 && Math.abs(beats(plan.timing[66]) - 16.5) < 1e-9 && fromFeatures.clap.some(v => v > .9) && fromFeatures.voice.some(v => v > .3) && fromPlan.voice.some(v => v > .3) && fromPlan.clap.some(v => v > .9) && clock.clap.some(v => v > .9),
    'psych drive: the beat from plan.timing (16th 64 is beat 16), the voices and the clap loop from the feature tracks (edl/params.js), the plan alone, or a bare tempo');
  // Synthetic footage for 'footage': a slow pan across warm, green and blue bands (green must turn blue).
  const footageAt = (cols, rows, t) => { const d = new Uint8Array(cols * rows * 4); for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const k = (y * cols + x) * 4, u = (x / cols + t * .05) % 1, v = y / rows; d[k] = u < .33 ? 230 : 40; d[k + 1] = u >= .33 && u < .66 ? 210 : 60 + 120 * v; d[k + 2] = u >= .66 ? 240 : 50; d[k + 3] = 255; } return {cols, rows, data:d}; };
  const LIN = TONES.map(t => [1, 3, 5].map(i => parseInt(t.ring.slice(i, i + 2), 16)));
  const green = (b, i) => { const c = LIN[b.tone[i]].map(v => v * (1 - b.white[i]) + 255 * b.white[i]); return c[1] > c[0] + 8 && c[1] > c[2] + 8; };
  for (const look of PSYCH_LOOKS) {
    const sizes = [[150, 48], [83, 147]];
    for (const [cols, rows] of sizes) {
      const b = createBoard(cols, rows), b2 = createBoard(cols, rows), frames = [];
      let badTone = 0, greenPegs = 0, over = 0, lit = 0, same = true;
      for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) {
        const t = f / FPS, frame = look === 'footage' ? footageAt(cols, rows, t) : null;
        clearBoard(b); paintPsych(b, {look, seed:5}, t, {drive:driveAt(fromFeatures, t), frame});
        frames.push(boardLuma(b));
        if (f % 97 === 0) {
          clearBoard(b2); paintPsych(createBoard(cols, rows), {look, seed:9}, t + 3, {drive:driveAt(fromPlan, t)}); paintPsych(b2, {look, seed:5}, t, {drive:driveAt(fromFeatures, t), frame});
          for (const k of ['I', 'tone', 'white', 'size']) same &&= b[k].every((v, i) => v === b2[k][i]);
        }
        for (let i = 0; i < b.I.length; i++) if (b.I[i] > 0) { lit++; if (!PSYCH_TONES.includes(b.tone[i]) || b.white[i] < 0 || b.white[i] > 1) badTone++; if (green(b, i)) greenPegs++; if (b.I[i] > PSYCH_MAX + 1e-6) over++; }
      }
      const worst = Math.max(...[-1, 0, 1, 2, 3].map(k => worstWindow(flashes(frames.map(x => k < 0 ? x.whole : x.quads[k]), FPS), FPS)));
      const gains = governorTrack(frames, FPS), mean = frames.reduce((a, x) => a + x.whole, 0) / frames.length;
      ok(same && lit > frames.length * 50 && !badTone && !greenPegs && !over, `psych ${look} ${cols}×${rows}: deterministic (same moment, same pegs, whatever was painted before), palette only (blue, white, signal, deep), never green, at most ${PSYCH_MAX} (${lit} lit peg-frames)`);
      ok(worst <= 2 && gains.every(g => g === 1) && mean > .04, `psych ${look} ${cols}×${rows}: ${frames.length} frames (all of Offsite) need no governing: at most ${worst} flashes a second ungoverned, whole and by quarter (mean light ${mean.toFixed(2)})`);
    }
    // It breathes: more light with the voices, a swell in size on the clap, motion with the beat; and nothing on true black.
    const b = createBoard(150, 48), sum = a => a.reduce((x, v) => x + v, 0), frame = look === 'footage' ? footageAt(150, 48, 0) : null;
    paintPsych(b, {look}, 10, {drive:{beat:8, voice:0, clap:0}, frame}); const quiet = sum(b.I), size0 = Math.max(...b.size), still = b.I.slice();
    clearBoard(b); paintPsych(b, {look}, 10, {drive:{beat:8, voice:1, clap:0}, frame}); const sung = sum(b.I);
    clearBoard(b); paintPsych(b, {look}, 10, {drive:{beat:8, voice:0, clap:1}, frame}); const size1 = Math.max(...b.size);
    clearBoard(b); paintPsych(b, {look}, 10, {drive:{beat:8.5, voice:0, clap:0}, frame}); const moved = b.I.some((v, i) => Math.abs(v - still[i]) > .05);
    clearBoard(b); b.exposure = 0; paintPsych(b, {look}, 10, {drive:{beat:8, voice:1, clap:1}, frame});
    ok(sung > quiet * 1.4 && size1 > size0 * 1.1 && (moved || look === 'footage') && b.I.every(v => v === 0), `psych ${look}: breathes (voices ${(sung / quiet).toFixed(2)}× the light, the clap swells the pegs ${(size1 / size0).toFixed(2)}×, half a beat moves it), nothing on true black`);
  }
  // Type always wins: on Offsite's own board with its song, every look leaves every type peg exactly as choreo
  // painted it, keeps a dark moat a peg wide around the words, dims within the halo, and adds no flash.
  const cols = 150, rows = 48, {board, screens, layoutOf, place} = rig(plan, cols, rows), ref = createBoard(cols, rows);
  const typeFrames = [];
  for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) { paint(board, screens, f / FPS, {plan, layoutOf, place}); typeFrames.push(boardLuma(board)); }
  const typeWorst = Math.max(...[-1, 0, 1, 2, 3].map(k => worstWindow(flashes(typeFrames.map(x => k < 0 ? x.whole : x.quads[k]), FPS), FPS))), typeGoverned = governorTrack(typeFrames, FPS).filter(g => g < 1).length;
  for (const look of PSYCH_LOOKS.filter(l => l !== 'footage')) {
    let changed = 0, moat = 0, near = 0, nearN = 0, far = 0, farN = 0, samples = 0;
    const frames = [];
    for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) {
      const t = f / FPS;
      paint(board, screens, t, {plan, layoutOf, place});
      const check = f % 11 === 0 && board.I.some(v => v >= 1);
      if (check) for (const k of ['I', 'tone', 'white', 'size', 'dx', 'dy']) ref[k].set(board[k]);
      paintPsych(board, {look, seed:2}, t, {drive:driveAt(fromFeatures, t)});
      frames.push(boardLuma(board));
      if (!check) continue;
      samples++;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (ref.I[i] > 0) { if (board.I[i] !== ref.I[i] || board.tone[i] !== ref.tone[i] || board.white[i] !== ref.white[i] || board.size[i] !== ref.size[i]) changed++; continue; }
        let d = Infinity;
        for (let v = Math.max(0, y - TYPE_HALO); v <= Math.min(rows - 1, y + TYPE_HALO); v++) for (let u = Math.max(0, x - TYPE_HALO); u <= Math.min(cols - 1, x + TYPE_HALO); u++) if (ref.I[v * cols + u] > 0) d = Math.min(d, Math.hypot(u - x, v - y));
        if (d <= 1.01 && board.I[i] > 0) moat++;
        if (d <= 3) { near += board.I[i]; nearN++; } else if (d > TYPE_HALO) { far += board.I[i]; farN++; }
      }
    }
    const worst = Math.max(...[-1, 0, 1, 2, 3].map(k => worstWindow(flashes(frames.map(x => k < 0 ? x.whole : x.quads[k]), FPS), FPS))), governed = governorTrack(frames, FPS).filter(g => g < 1).length;
    ok(samples > 50 && !changed && !moat && near / nearN < .35 * far / farN, `psych ${look} under Offsite's words (${samples} moments): every type peg exactly as choreo lit it, a dark moat a peg wide, the pattern near the words at ${(100 * (near / nearN) / (far / farN)).toFixed(0)}% of its light away from them`);
    ok(worst <= typeWorst && governed <= typeGoverned, `psych ${look} under Offsite's words: adds no flash (worst ${worst} a second with it, ${typeWorst} with the words alone; ${governed} frames governed, ${typeGoverned} without)`);
  }
  console.log(`  psych: ${checks - before} checks`);
}
// ---- The band on the board (choreo.js bandScreens): the couplet moment, refrains, exchanges -------------
// "IT'S NOT X." lights word by word, then a bar of pegs (STRIKE.weight rows a k) strikes through X on the beat after it (signal,
// every letter still at full under it), then "IT'S Y." lands, dark until it is sung. Every band word fully
// lit when sung; a band screen's light only rises until it ends (so its own words make no flash at any size
// of board), and the band needs no governing. On the engine's plans (castSong + the Drop Edition: plan.band)
// and on the contract's lists (plan.couplets, refrains, exchanges), both forms (the river: plan.form
// 'wander' shows its one or two clear phrases as type and the rest as texture breathing with its layers).
{
  const before = checks, say = (v, m) => { ok(v, m); console.log(`  ${m}`); };
  const LS = LINE_BREAK, FIXTURES = JSON.parse(fs.readFileSync(new URL('./fixtures/pixel-posts.json', import.meta.url), 'utf8')).map(x => x.post);
  const LEX = JSON.parse(fs.readFileSync(new URL('../src/allhands/vocabulary/lexicon.json', import.meta.url), 'utf8')), COUPLET = Object.fromEntries(LEX.couplets.map(c => [c.id, c]));
  const SIGNAL = PALETTE.signal.id;
  // The layout: a hard break keeps each part on lines of its own, and both share a page where they fit.
  {
    const pair = `IT'S NOT A SEVERANCE PACKAGE.${LS}IT'S A CARE PACKAGE.`, n = normalize(`  It's not a severance package. ${LS} ${LS}It's a care package. ${LS}`).text;
    ok(n === pair && [...n].filter(c => c === LS).length === 1 && normalize("IT'S NOT A LAYOFF. IT'S A LAUNCH.").text.indexOf(LS) < 0, 'LINE_BREAK: normalize keeps one between the parts (no space either side, never at the ends) and makes none of its own');
    let crossing = 0, pages = 0, laid = 0;
    for (const c of LEX.couplets) for (const cols of [300, 131, 116, 97, 69]) {
      const l = layoutText(`${c.display[0]}${LS}${c.display[1]}`, {font:faces.peg9, k:1, maxCols:cols, maxLines:cols >= 116 ? 3 : 6}), xWords = normalize(c.display[0]).text.split(' ').length;
      for (const page of l.pages) for (const line of page.lines) { const parts = new Set(line.chars.map(ch => ch.word < xWords ? 0 : 1)); if (parts.size > 1) crossing++; }
      if (cols === 300 && l.pages.length === 1 && l.pages[0].lines.length === 2) pages++;
      laid++;
    }
    say(crossing === 0 && pages === LEX.couplets.length, `LINE_BREAK: ${laid} layouts of the ${LEX.couplets.length} couplets, X and Y never share a line; on a wide board each is one line and both one page`);
    ok(linesFor({fill:true, lines:3}, faces.peg9, 1, 137) === 11 && linesFor({fill:true, lines:3}, faces.peg9, 1, 35) === 3 && linesFor({lines:2, k:2}, faces.peg9, 2, 137) === 2 && linesFor({k:1}, faces.peg9, 1, 137) === 3, 'linesFor: a two-part screen takes as many lines as the room holds, every other screen its own');
    ok(stagePitch(390, 540) === 4 && Math.floor(390 / stagePitch(390, 540)) >= STAGE_COLS && stagePitch(1440, 630) === 14 && stagePitch(1920, 756) === 16, `the stage keeps ${STAGE_COLS} columns on a phone (390 px: pitch ${stagePitch(390, 540)}), desktop pitches as before`);
  }
  // A part on the contract's shape: words spread by letters over [at, at + dur].
  const part = (text, voice, at, dur) => { const ws = text.split(' '), total = ws.reduce((a, w) => a + w.length + 1, 0), words = []; let t = at; for (const w of ws) { const d = dur * (w.length + 1) / total; words.push({text:w, start:t, end:t + d * .9}); t += d; } return {text, voice, at, end:at + dur, words}; };
  const durationsOf = (lyrics, track) => Object.fromEntries(FORMS.drop60.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)]));
  // The contract's lists on a Drop Edition plan: the anthem in Drop B (a couplet a bar, X on one, Y on three),
  // the drop's X over the build's first bars (Y is the impact), a refrain twice in Drop A, an exchange in the outro.
  function contractPlan(track, ids) {
    const lyrics = lyricsFromPost(SAMPLE_POST), plan = FORMS.drop60.arrange(lyrics, durationsOf(lyrics, track), {track}), T = s => plan.timing[Math.min(plan.timing.length - 1, s)], bar = n => T(n * 16), st = plan.step, sec = n => plan.sections.find(s => s.name === n);
    plan.couplets = ids.map((id, i) => ({id, x:part(COUPLET[id].display[0], 'strategy', bar(sec('Drop B').from + 1 + i), 7 * st), y:part(COUPLET[id].display[1], COUPLET[id].yVoice === 'lady' ? 'lady' : 'synthia', bar(sec('Drop B').from + 1 + i) + 8 * st, 6 * st)}));
    plan.couplets.unshift({id:'hour-quick-sync', x:part("IT'S NOT AN HOUR.", 'strategy', bar(plan.marks.build / 16) + 4 * st, 8 * st), y:part('SYNC.', 'synthia', T(plan.choke.until), 4 * st)});
    plan.refrains = [0, 1].map(r => part('MOMENTUM COMPOUNDS.', 'strategy', bar(sec('Drop A').from + 1) + r * 16 * st, 10 * st));
    plan.exchanges = [{call:part('BANDWIDTH?', 'lady', bar(sec('Outro').from), 4 * st), response:part('NONE.', 'synthia', bar(sec('Outro').from) + 6 * st, 3 * st)}];
    const busy = [...plan.couplets.flatMap(c => [c.x, c.y]), ...plan.refrains, ...plan.exchanges.flatMap(e => [e.call, e.response])].map(p => [p.at - .3, p.end + .6]);
    plan.lines = plan.lines.filter(l => !busy.some(([a, b]) => T(l.to) > a && T(l.from) < b));
    plan.lady = plan.lady.filter(e => e.role !== 'punct' || !busy.some(([a, b]) => T(Math.floor(e.at)) + .5 > a && T(Math.floor(e.at)) < b));
    return plan;
  }
  // The engine's plans: the sample and fixtures cast by the post (every track among them), and the sample on every track.
  const realPlans = [];
  for (const post of [SAMPLE_POST, ...FIXTURES.slice(0, 15)]) { const c = castSong(post), lyrics = lyricsFromPost(post); realPlans.push({label:`${c.track}/${post.slice(0, 14)}`, plan:FORMS.drop60.arrange(lyrics, durationsOf(lyrics, c.track), {track:c.track, cast:c.cast})}); }
  for (const track of TRACK_ORDER.filter(t => formPlays('drop60', t))) { const c = castSong(SAMPLE_POST, {track}), lyrics = lyricsFromPost(SAMPLE_POST); realPlans.push({label:`${track}/sample forced`, plan:FORMS.drop60.arrange(lyrics, durationsOf(lyrics, track), {track, cast:c.cast})}); }
  const contract = TRACK_ORDER.filter(t => formPlays('drop60', t)).map((track, i) => ({label:`${track}/contract`, plan:contractPlan(track, [['complaint-gift', 'severance-care', 'agenda-vibe'], ['new-title-growth', 'no-not-now', 'loss-investment'], ['freeze-focus', 'burnout-bandwidth', 'one-customer'], ['mandatory-retreat', 'cult-culture', 'lanyard-belonging']][i])}));
  // Which page of a layout shows at t (choreo drawScreen: each page from when its first word is heard).
  const pageAt = (s, l, t) => { let page = l.pages[0]; for (const p of l.pages) { const first = p.lines[0]?.chars[0]; if (first && s.words[first.word]?.start <= t + .001) page = p; } return page; };
  const pegsOf = (s, l, page, o, pred) => { const out = []; for (const line of page.lines) for (const ch of line.chars) if (pred(s.words[ch.word], ch)) for (let i = 0; i < ch.pegs.length; i += 2) out.push((o.y + ch.pegs[i + 1]) * 1e4 + o.x + ch.pegs[i]); return out; };
  let couplets = 0, struck = 0, bandWords = 0, bandScreensSeen = 0, events = 0, shown = 0, under = 0, pairsOnePage = 0, plansSeen = 0, strikeH = Infinity;
  const sizes = [[120, 53, {}], [116, 45, {chart:9}], [97, 135, {chart:27}], [150, 48, {chart:0, span:131}]];
  for (const {label, plan} of [...realPlans, ...contract]) for (const [cols, rows, opt] of sizes) {
    const {board, screens, layoutOf, place, at} = rig(plan, cols, rows, opt), band = screens.filter(s => s.band), lab = `${label} ${cols}x${rows}`;
    const idx = j => [j % 1e4, Math.floor(j / 1e4)], I = j => { const [x, y] = idx(j); return board.I[y * cols + x]; }, tone = j => { const [x, y] = idx(j); return board.tone[y * cols + x]; };
    plansSeen++;
    // Every band part of the engine's plan is on the board: a band screen holds its words, on time.
    if (cols === 120) for (const e of plan.band || []) {
      events++;
      const w0 = e.words?.[0]?.start ?? e.start;
      if (screens.some(s => s.band && s.words.some(w => Math.abs(w.start - w0) < 1e-6)) || screens.some(s => s.kind === 'impact' && Math.abs(s.from - w0) < .5)) shown++;
    }
    under += screens.filter(s => s.under).length;
    for (const s of band) {
      const l = layoutOf(s);
      if (!l?.pages?.length) { ok(false, `${lab}: band screen "${s.text}" lays out`); continue; }
      bandScreensSeen++;
      // Every word fully lit when sung: from its onset (half a frame of lead) to the screen's end, on its page.
      for (const w of s.words) for (const t of [w.start + FRAME * .51, Math.max(w.start + FRAME * .51, s.to - FRAME * .5)]) {
        if (t >= s.to || activeScreen(screens, t) !== s) continue;
        at(t); const page = pageAt(s, l, t), o = place(s, l, page), mine = pegsOf(s, l, page, o, x => x === w);
        if (mine.length) { bandWords++; if (!mine.every(j => I(j) >= FRAGMENT_FULL - 1e-6)) ok(false, `${lab} "${s.text}": "${w.text}" fully lit from when it is sung (${t.toFixed(3)} s)`); }
      }
      // The light only rises: paint every frame the screen holds the board; luma, whole and by quarter, never
      // falls (a page turn aside), so a band screen makes no flash of its own.
      let prev = null, falls = 0, prevPage = null;
      for (let f = Math.ceil(s.from * FPS); f / FPS < s.to; f++) {
        // (The drop's ignition settles under the words for 2.6 beats: that light is the board's, not the band's.)
        const t = f / FPS; if (activeScreen(screens, t) !== s || boardState(plan, t).ignite >= 0) { prev = null; continue; }
        at(t); const L = boardLuma(board), page = pageAt(s, l, t);
        if (prev && page === prevPage && board.exposure === prev.exposure && [L.whole, ...L.quads].some((v, k) => v < [prev.whole, ...prev.quads][k] - 1e-6)) falls++;
        prev = {...L, exposure:board.exposure}; prevPage = page;
      }
      if (falls) ok(false, `${lab} "${s.text}": its light only rises (${falls} frames fall)`);
      if (s.parts.length === 2 && l.pages.length === 1) pairsOnePage++;
      // The couplet moment: X, then the strike on the beat, then Y.
      if (!s.fx.strike) continue;
      const st = s.fx.strike, xw = s.words.filter(w => w.part === 0), yw = s.words.filter(w => w.part === 1), xLast = xw.at(-1);
      const grid = [4, 2, 1].some(d => { for (let k = 0; k < plan.timing.length; k += d) if (Math.abs(plan.timing[k] - st.at) < 1e-9) return true; return false; });
      ok(st.at >= xLast.start + 2 * FRAME - 1e-9 && (!yw.length || st.at + STRIKE.min <= yw[0].start + 1e-9 || st.at < yw[0].start) && st.words.length && st.words.every(i => s.words[i].part === 0) && !/^NOT/.test(s.words[st.words[0]].text) && (grid || yw.length),
        `${lab} "${s.text.split(LS).join(' / ')}": the strike at ${st.at.toFixed(3)} s, after X is sung (${xLast.start.toFixed(3)}), on the plan's grid, ${yw.length ? `${(yw[0].start - st.at).toFixed(3)} s before Y` : 'Y is the impact'}; it crosses ${st.words.map(i => s.words[i].text).join(' ')}`);
      couplets++;
      // Struck: X whole and at full, the strike's row in signal across it, Y dark.
      const t1 = st.at + st.draw + FRAME * .51;
      if (t1 < s.to && activeScreen(screens, t1) === s && (!yw.length || t1 < yw[0].start - FRAME * .5)) {
        // (Y's page, when it has its own, is not up yet: Y is dark either way.)
        at(t1); const page = pageAt(s, l, t1), o = place(s, l, page), xPegs = pegsOf(s, l, page, o, w => w.part === 0), yPegs = pegsOf(s, l, page, o, w => w.part === 1);
        if (!page.lines.some(line => line.chars.some(ch => s.words[ch.word]?.part === 0))) ok(false, `${lab} "${s.text.split(LS)[0]}": X is up when it is struck`);
        const rows = strikeRows(s, l, page, o), sPegs = rows.flatMap(r => Array.from({length:(r.x1 - r.x0 + 1) * r.h}, (_, i) => (r.y0 + Math.floor(i / (r.x1 - r.x0 + 1))) * 1e4 + r.x0 + i % (r.x1 - r.x0 + 1))).filter(j => idx(j)[0] >= 0 && idx(j)[0] < cols);
        // (The strike's weight: STRIKE.weight's rows a k for the face, 2 in PEG-9 and PEG-5, on every line it crosses.)
        ok(rows.length && rows.every(r => r.h === strikeWeight(l.font, l.k || 1) && r.h >= 2) && xPegs.every(j => I(j) >= FRAGMENT_FULL - 1e-6) && sPegs.every(j => tone(j) === SIGNAL && I(j) >= 1 - 1e-6) && yPegs.every(j => I(j) === 0),
          `${lab} "${s.text.split(LS)[0]}": struck: X's ${xPegs.length} pegs at full, the strike's ${sPegs.length} in signal, ${rows.map(r => r.h).join(', ')} rows tall across ${rows.length} line(s), Y's ${yPegs.length} pegs dark`);
        struck++; strikeH = Math.min(strikeH, ...rows.map(r => r.h));
      }
      // Landed: Y at full on its page, with X struck above it when they share one.
      if (yw.length) {
        const t2 = yw.at(-1).start + FRAME * .51;
        if (t2 < s.to && activeScreen(screens, t2) === s) {
          at(t2); const page = pageAt(s, l, t2), o = place(s, l, page), yPegs = pegsOf(s, l, page, o, w => w.part === 1), xPegs = pegsOf(s, l, page, o, w => w.part === 0);
          ok(yPegs.length && yPegs.every(j => I(j) >= FRAGMENT_FULL - 1e-6) && xPegs.every(j => I(j) >= FRAGMENT_FULL - 1e-6) && (!xPegs.length || strikeRows(s, l, page, o).length),
            `${lab} "${s.text.split(LS).join(' / ')}": Y lands at full (${yPegs.length} pegs)${xPegs.length ? ` under X, struck` : ' on its own page'}`);
        }
      }
    }
    // Governor-safe: over the whole song, no band frame is governed, and the band's spans hold at most 3 flashes a second ungoverned.
    if (cols !== 97) {
      const frames = [];
      for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) { at(f / FPS); frames.push(boardLuma(board)); }
      const gains = governorTrack(frames, FPS), bandF = new Set(frames.map((_, f) => activeScreen(screens, f / FPS)?.band ? f : -1).filter(f => f >= 0));
      const worst = Math.max(...[-1, 0, 1, 2, 3].map(k => worstWindow(flashes(frames.map(x => k < 0 ? x.whole : x.quads[k]), FPS).filter(e => bandF.has(e.frame)), FPS)));
      ok(worst <= 3 && [...bandF].filter(f => gains[f] < 1).length <= (label.includes('contract') ? 0 : 4), `${lab}: the band's ${bandF.size} frames need no governing (${[...bandF].filter(f => gains[f] < 1).length} touched next to a drop's ignition), at most ${worst} flashes a second ungoverned`);
    }
  }
  say(events > 50 && shown === events, `every band part of the engine's plans is on the board: ${shown} of ${events}`);
  say(couplets > 40 && struck > 30 && bandWords > 1000 && pairsOnePage > 20 && under > 0 && strikeH >= 2, `the couplet moment on ${plansSeen} boards: ${couplets} couplet screens struck on the beat after X, ${struck} seen struck with Y still dark (the strike ${strikeH} rows tall or more), ${bandScreensSeen} band screens, ${bandWords} band words fully lit when sung, ${pairsOnePage} pairs on one page, ${under} ladder hits stepping back under the drop's X`);
  // The strike reads at every size: STRIKE.weight's rows a k (PEG-9's 2-peg stems, and 2 in PEG-5; one row was the
  // crossbars' weight, on their row, a hairline at the phone's 3 px pegs and the 9:16 film's; PEG-3, the 16:9 film's
  // fallback for a long X, keeps 1 of its 5), centred on the caps (half a peg high where the rows cannot split
  // evenly), clear of the caps' top and bottom bars, in each face at k 1 to 3; and on the phone stages (270 px: 90 x 126 of 3 px pegs; 390 px: 97 x 135 of 4 px) no frame of a struck
  // screen is governed and the strike adds no flash (the light around every strike, a second and a half either side).
  {
    let laid = 0;
    for (const face of ['peg9', 'peg5', 'peg3']) for (const k of [1, 2, 3]) {
      const plan = {timing:Array.from({length:64}, (_, i) => i * .125), step:.125, duration:8}, x = part("IT'S NOT A MEETING.", 'strategy', .5, 1), y = part("IT'S A VIBE.", 'synthia', 2.5, .8);
      const sc = buildScreens({...plan, couplets:[{x, y}]}).map(indexWords).find(q => q.fx?.strike), font = faces[face] ?? (faces[face] = compileFont(PEG3)), cap = {peg9:9, peg5:7, peg3:5}[face] * k;
      const l = layoutText(sc.text, {font, k, maxCols:400, maxLines:3}), page = l.pages[0], o = {x:2, y:2}, rows = strikeRows(sc, l, page, o);
      const above = rows.map(r => r.y0 - (o.y + page.lines.find(ln => ln.chars.some(c => sc.fx.strike.words.includes(c.word))).y)), want = STRIKE.weight[face] * k;
      ok(rows.length === 1 && rows[0].h === want && above.every(a => a === Math.floor((cap - want) / 2) && a >= 2 * k && cap - a - want >= 2 * k),
        `the strike in ${face} at k ${k}: ${rows[0]?.h} rows of a ${cap}-row cap, ${above[0]} rows under its top (the bars stay clear)`);
      laid++;
    }
    let seen = 0, governed = 0, worst = 0;
    for (const {plan} of [...realPlans, ...contract]) for (const [cols, rows, chart] of [[90, 126, 25], [97, 135, 27]]) {
      const {board, screens, at} = rig(plan, cols, rows, {chart});
      for (const s of screens.filter(q => q.fx?.strike)) {
        const f0 = Math.max(0, Math.floor((s.from - 1.5) * FPS)), f1 = Math.ceil((s.to + 1.5) * FPS), frames = [], own = new Set();
        for (let f = f0; f < f1; f++) { at(f / FPS); frames.push(boardLuma(board)); if (activeScreen(screens, f / FPS) === s) own.add(f - f0); }
        const gains = governorTrack(frames, FPS);
        governed += [...own].filter(i => gains[i] < 1).length; seen++;
        for (const q of [-1, 0, 1, 2, 3]) worst = Math.max(worst, worstWindow(flashes(frames.map(v => q < 0 ? v.whole : v.quads[q]), FPS).filter(e => own.has(e.frame)), FPS));
      }
    }
    say(laid === 9 && seen > 40 && governed === 0 && worst <= 2, `the strike reads at every size: ${Object.entries(STRIKE.weight).map(([f, w]) => `${f} ${w}`).join(', ')} rows a k at k 1 to 3; on the phone stages ${seen} struck screens, ${governed} frames governed, at most ${worst} flashes a second`);
  }
  // Role tags: STRATEGY and SYNTHIA in PEG-3 where the pitch reads them (12 px and up), never the lady.
  {
    const plan = contract[0].plan, lit = (pitch, t) => { const r = rig(plan, 120, 53, {pitch}); r.at(t); return [...r.board.I].filter(v => Math.abs(v - TAG_LIGHT) < 1e-6).length; };
    const ex = plan.exchanges[0], ladyOnly = lit(13, ex.call.words[0].start + .05), both = lit(13, ex.response.words[0].start + .05), small = lit(7, ex.response.words[0].start + .05);
    say(ladyOnly === 0 && both > 20 && small === 0 && BAND_VOICES.lady.tag === null, `role tags: none for the lady's call, SYNTHIA under the answer at pitch 13 (${both} pegs), none at pitch 7 (PEG-3 reads from ${TAG_MIN_PITCH})`);
  }
  // The build's dim: every stutter (her ladder, the stammer) and the band hold full brightness while the
  // board dims; the sockets (and anything not type) keep the dim; no stutter needs governing on the stage's
  // boards (where the fast rungs used to move a whole row and flash a quarter: they rock in their sockets now).
  let holdRuns = 0, holdFrames = 0;
  for (const track of TRACK_ORDER.filter(t => formPlays('drop60', t))) for (const post of POSTS) for (const [cols, rows, opt] of [[120, 53, {}], [102, 45, {chart:9}], [116, 45, {chart:9}]]) {
    const lyrics = lyricsFromPost(post), plan = FORMS.drop60.arrange(lyrics, durationsOf(lyrics, track), {track});
    const {board, screens, layoutOf, place, at} = rig(plan, cols, rows, opt), b0 = plan.timing[plan.marks.build], b1 = plan.choke.time, lab = `${track}/${post.slice(0, 8)} ${cols}x${rows}`;
    let held = 0, dimHeld = 0, wrong = 0, sockets = 0, rock = 0;
    const frames = [], f0 = Math.floor((b0 - 1) * FPS), f1 = Math.ceil((b1 + .5) * FPS);
    for (let f = f0; f < f1; f++) {
      const t = f / FPS; at(t); frames.push(boardLuma(board));
      const s = activeScreen(screens, t), st = boardState(plan, t);
      if (!s || !s.hold || t < b0 || t >= b1 || board.sockets === 0) continue;
      held++; if (st.build < 1 - 1e-9) dimHeld++;
      const l = layoutOf(s), page = pageAt(s, l, t), o = place(s, l, page);
      for (const line of page.lines) for (const ch of line.chars) { const w = s.words[ch.word]; if (!w || (w.lit === undefined && t < w.units[0].start - FRAME * .5 && s.reveal !== 'steady')) continue; for (let i = 0; i < ch.pegs.length; i += 2) { const j = (o.y + ch.pegs[i + 1]) * cols + o.x + ch.pegs[i]; if (board.I[j] > 0 && board.I[j] * board.exposure < (s.reveal === 'typewriter' ? READ_AHEAD : 1) - 1e-6) wrong++; } }
      if (Math.abs(board.sockets - st.sockets * st.build) > 1e-9) sockets++;
      if (s.fx.rowShift) rock++; if (s.fx.rock && (Math.abs(Math.abs(s.fx.rock) - ROCK) > 1e-9 || ROCK > .5)) rock++;
    }
    const gains = governorTrack(frames, FPS), fragGoverned = frames.filter((_, i) => { const s = activeScreen(screens, (f0 + i) / FPS); return s?.hold && gains[i] < 1; }).length;
    ok(dimHeld > 24 && !wrong && !sockets && !rock && !fragGoverned, `${lab}: the build's stutters hold full brightness on ${dimHeld} of ${held} dimmed frames (${wrong} pegs under full), the sockets keep the dim, the fast rungs rock in their sockets (ROCK ${ROCK}), none governed`);
    holdRuns++; holdFrames += dimHeld;
  }
  say(holdRuns === 24, `the build's dim: on ${holdRuns} runs (4 tracks, 2 posts, 120 x 53 and the stage's 102 x 45 and 116 x 45) every stutter and band word holds full on ${holdFrames} dimmed frames, the sockets keep the dim, no stutter governed`);
  // The river: Offsite's wander form shows its one or two clear phrases as type, never the stream's loops;
  // the texture breathes with its layers (dim before they ramp in, full with all of them), takes no flash of
  // its own and needs no governing; the words win over it.
  {
    const lyrics = lyricsFromPost(SAMPLE_POST), base = FORMS.drop60.arrange(lyrics, durationsOf(lyrics, 'offsite'), {track:'offsite'}), T = s => base.timing[Math.min(base.timing.length - 1, s)], bar = n => T(n * 16), st = base.step, B = base.totalSteps / 16;
    const plan = {...base, form:'wander', lines:[], words:[], stutters:[], lady:[], choke:undefined,
      layers:Array.from({length:6}, (_, i) => ({id:`loop${i}`, from:bar(1 + 2 * i), rampIn:[bar(1 + 2 * i), bar(3 + 2 * i)], rampOut:[bar(B - 6 + i % 3), bar(B - 3 + i % 3)], to:bar(B - 3 + i % 3), gain:i % 2 ? -3 : 1})),
      swells:[{from:bar(12), to:bar(14), amount:.3}], slow:[{from:bar(18), to:bar(20)}],
      band:[...Array.from({length:24}, (_, i) => ({...part('PROUD', 'lady', bar(2) + i * 8 * st, .4), role:'loop', part:'stream'})),
        {...part('MOMENTUM COMPOUNDS.', 'strategy', bar(10), 1.4), role:'refrain', part:'refrain'}, {...part('MOMENTUM COMPOUNDS.', 'strategy', bar(11), 1.4), role:'refrain', part:'refrain'},
        {...part("IT'S NOT A RETREAT.", 'strategy', bar(20), 1.2), role:'couplet-x', part:'couplet'}, {...part("IT'S MANDATORY.", 'synthia', bar(20) + 10 * st, 1), role:'couplet-y', part:'couplet'},
        {...part('MORE TO COME.', 'lady', bar(23), 1), role:'refrain', part:'refrain2'}].map(e => ({...e, start:e.at, display:e.text}))};
    // The engine's own shape (wander.js): layers with in/out ramps and a gain curve, the clear phrases as band
    // events marked clear (plan.phrases the same list), Synergy's hook once, washed into the stream (not type).
    const hook = base.lines.find(l => l.kind === 'hook'), sh = {...plan, lines:[hook], words:hook.words,
      layers:plan.layers.map(L => ({id:L.id, in:L.rampIn, out:L.rampOut, level:1, gain:[[0, 0], [L.rampIn[0], 0], [L.rampIn[1], 1], [L.rampOut[0], 1], [L.rampOut[1], 0]]})),
      band:plan.band.filter(e => e.role !== 'loop').map(e => ({...e, clear:true}))};
    sh.phrases = sh.band;
    const shTexts = [...new Set(rig(sh, 116, 45, {chart:9}).screens.map(s => s.text))], shRiver = riverTrack(sh);
    say(shTexts.length === 2 && !shTexts.some(x => x.includes(hook.words[0].display.toUpperCase()) && !/MOMENTUM|RETREAT|MANDATORY/.test(x)) && Math.abs(riverAt(shRiver, bar(16)).layers - 1) < .05 && riverAt(shRiver, bar(1) - .1).layers < .05,
      `the river on wander.js's shape (in/out ramps, gain curves, band = phrases marked clear): type for ${shTexts.length} phrases, not Synergy's washed hook; layers ${riverAt(shRiver, bar(1) - .1).layers.toFixed(2)} before, ${riverAt(shRiver, bar(16)).layers.toFixed(2)} with all`);
    const {board, screens} = rig(plan, 116, 45, {chart:9}), river = riverTrack(plan), texts = [...new Set(screens.map(s => s.text))];
    say(texts.length <= RIVER_PHRASES && texts.length === 2 && !screens.some(s => /PROUD/.test(s.text)) && screens.every(s => s.band), `the river: type for its ${texts.length} clear phrases only (${texts.map(x => x.split(LS).join(' / ')).join('; ')}), never the stream's 24 loops`);
    const r = rig(plan, 116, 45, {chart:9}), frames = [], light = [];
    for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) {
      const t = f / FPS; r.at(t); const typeLit = r.board.I.map(v => v > 0 ? 1 : 0), ref = r.board.I.slice();
      const x = riverAt(river, t); paintPsych(r.board, x.spec, t, {drive:x.drive}); frames.push(boardLuma(r.board));
      let tex = 0, n = 0, changed = 0; for (let i = 0; i < ref.length; i++) { if (typeLit[i]) { if (r.board.I[i] !== ref[i]) changed++; } else { tex += r.board.I[i]; n++; } }
      light.push(tex / n); if (changed) ok(false, `the river at ${t.toFixed(2)} s: the words win (${changed} type pegs relit)`);
    }
    const at = t => light[Math.floor(t * FPS)], worst = Math.max(...[-1, 0, 1, 2, 3].map(k => worstWindow(flashes(frames.map(x => k < 0 ? x.whole : x.quads[k]), FPS), FPS))), gains = governorTrack(frames, FPS);
    say(at(bar(1) - .1) * 2 < at(bar(16)) && at(plan.duration - .2) * 2 < at(bar(16)) && Math.abs(layerGain(plan, plan.layers[0], bar(2)) - .5) < .05, `the river breathes with its layers: texture light ${at(bar(1) - .1).toFixed(3)} before they ramp in, ${at(bar(16)).toFixed(3)} with all six, ${at(plan.duration - .2).toFixed(3)} as they let go (a layer halfway up its two-bar ramp: ${layerGain(plan, plan.layers[0], bar(2)).toFixed(2)})`);
    say(worst <= 2 && gains.every(g => g === 1), `the river needs no governing: at most ${worst} flashes a second ungoverned over ${frames.length} frames`);
    const a = riverAt(river, bar(19)).drive, b = riverAt(river, bar(19) + .5).drive, c = riverAt(river, bar(8)).drive, d = riverAt(river, bar(8) + .5).drive;
    say(b.beat - a.beat < .7 * (d.beat - c.beat) && b.beat > a.beat, `the river slows in plan.slow (${(b.beat - a.beat).toFixed(2)} beats a half second against ${(d.beat - c.beat).toFixed(2)}), never jumping`);
  }
  // The engine's river (forms.js 'wander', wander.js) on Offsite, for the sample and five fixtures cast by the
  // post: its type is its clear phrases (the couplet's Y, the refrain), nothing of the stream or Synergy's
  // washed hook; its texture follows its layers and needs no governing; the words win over it.
  if (FORMS.wander) {
    let runs = 0, phraseScreens = 0, worstAll = 0, governed = 0, relit = 0, lows = [], highs = [];
    for (const post of [SAMPLE_POST, ...FIXTURES.slice(0, 5)]) {
      const c = castSong(post, {track:'offsite'}), lyrics = lyricsFromPost(post), F = FORMS.wander;
      const plan = F.arrange(lyrics, Object.fromEntries(F.voiced(lyrics, {track:'offsite'}).map(w => [w, .18 + .11 * syllables(w)])), {track:'offsite', cast:c.cast});
      const r = rig(plan, 116, 45, {chart:9}), river = riverTrack(plan), clear = (plan.band || []).filter(e => e.clear !== false);
      ok(r.screens.every(s => s.band) && new Set(r.screens.map(s => s.text)).size <= RIVER_PHRASES && clear.every(e => r.screens.some(s => s.words.some(w => Math.abs(w.start - (e.words?.[0]?.start ?? e.start)) < 1e-6))),
        `the river (${post.slice(0, 14)}): type for its ${new Set(r.screens.map(s => s.text)).size} clear phrases (${[...new Set(r.screens.map(s => s.text))].join('; ')}) and nothing else`);
      phraseScreens += r.screens.length;
      const frames = [];
      for (let f = 0; f < Math.ceil(plan.duration * FPS); f++) {
        const t = f / FPS; r.at(t); const ref = r.board.I.slice(), x = riverAt(river, t); paintPsych(r.board, x.spec, t, {drive:x.drive}); frames.push(boardLuma(r.board));
        for (let i = 0; i < ref.length; i++) if (ref[i] > 0 && r.board.I[i] !== ref[i]) relit++;
      }
      const worst = Math.max(...[-1, 0, 1, 2, 3].map(k => worstWindow(flashes(frames.map(x => k < 0 ? x.whole : x.quads[k]), FPS), FPS)));
      worstAll = Math.max(worstAll, worst); governed += governorTrack(frames, FPS).filter(g => g < 1).length; runs++;
      lows.push(frames[Math.floor(.5 * FPS)].whole); highs.push(Math.max(...frames.map(x => x.whole)));
    }
    say(runs === 6 && worstAll <= 2 && !governed && !relit && lows.every((v, i) => v * 3 < highs[i]), `the engine's river on Offsite, ${runs} posts: ${phraseScreens} phrase screens, the texture ${Math.max(...lows).toFixed(3)} at most before the layers ramp in and up to ${Math.min(...highs).toFixed(3)}-${Math.max(...highs).toFixed(3)} with them, at most ${worstAll} flashes a second ungoverned, ${governed} frames governed, ${relit} type pegs relit`);
  }
  console.log(`  band: ${checks - before} checks`);
}
// ---- The plan fields the Peg Board and the video read, on both forms (the engine's contract:
// src/allhands/README.md "Where the band sings" and "The river"). Every band part has its voice, words
// and seconds; the river has its phases, layers with ramps and curves, loop sources, swells, slow spans,
// the clear phrases, no choke; the board builds and lights both.
{
  const before = checks, num = x => Number.isFinite(x);
  const {AVAILABLE} = await import('../src/allhands/voices/voice-table.js');
  const {WANDER_SECTIONS} = await import('../src/allhands/wander.js');
  const {TRACKS} = await import('../src/allhands/songbook/index.js');
  const FIXTURES = JSON.parse(fs.readFileSync(new URL('./fixtures/pixel-posts.json', import.meta.url), 'utf8')).map(x => x.post);
  const durationsOf = (lyrics, track) => Object.fromEntries([...FORMS.drop60.voiced(lyrics, {track}), ...FORMS.wander.voiced(lyrics, {track})].map(w => [w, .18 + .11 * syllables(w)]));
  const part = (e, label) => ok(typeof e.role === 'string' && typeof e.part === 'string' && ['strategy', 'synthia', 'lady'].includes(e.voice) && typeof e.display === 'string' && num(e.at) && num(e.start) && e.end > e.start
    && e.words.length === e.display.split(' ').length && e.words.every(w => typeof w.text === 'string' && w.end > w.start && w.start >= e.start - 1e-6), `${label}: ${e.role} "${e.display}" (${e.voice}) has its words and seconds`);
  for (const track of TRACK_ORDER.filter(t => (TRACKS[t].form ?? 'drop60') === 'drop60')) for (const post of [SAMPLE_POST, ...FIXTURES.slice(0, 3)]) {
    const c = castSong(post, {track, available:AVAILABLE}), lyrics = lyricsFromPost(post), plan = FORMS.drop60.arrange(lyrics, durationsOf(lyrics, track), {track, cast:c.cast}), label = `plan fields ${track}/${post.slice(0, 12)}`;
    ok(Array.isArray(plan.band) && Array.isArray(plan.bandLeft) && ['couplet', 'lady'].includes(plan.drop.kind) && num(plan.choke.tagEnd), `${label}: band, bandLeft, drop (${plan.drop.kind})`);
    for (const e of plan.band) part(e, label);
    for (const e of plan.lady.filter(x => x.voice)) ok(['tag', 'impact'].includes(e.role) && e.couplet === plan.drop.couplet && e.key && e.notes.length, `${label}: the couplet's ${e.role} "${e.display}" is ${e.voice}'s`);
    ok(buildScreens(plan, {table:LADY_TABLE}).length > 10, `${label}: the board builds its screens`);
  }
  for (const post of [SAMPLE_POST, ...FIXTURES.slice(0, 3)]) for (const own of [false, true]) {
    const c = own ? castSong(post, {track:'offsite', available:AVAILABLE}) : null, lyrics = lyricsFromPost(post), F = FORMS.wander;
    const plan = F.arrange(lyrics, durationsOf(lyrics, 'offsite'), {track:'offsite', cast:c?.cast}), label = `plan fields river/${post.slice(0, 12)}${own ? ' (its cast)' : ''}`;
    ok(plan.form === 'wander' && plan.choke === null && plan.sections.every(x => WANDER_SECTIONS.includes(x.name)) && plan.phrases === plan.band && plan.band.length >= 1 && plan.band.length <= 3,
      `${label}: the river's phases, no choke, ${plan.band.length} phrase parts`);
    ok(plan.layers.length >= 10 && plan.layers.every(l => typeof l.id === 'string' && typeof l.kind === 'string' && l.in[0] < l.in[1] && l.in[1] <= l.out[0] && l.out[0] < l.out[1] && l.gain.length >= 3 && l.filter.length >= 3),
      `${label}: ${plan.layers.length} layers, each with its ramps and curves`);
    ok(plan.loops.length >= 2 && plan.loops.every(l => l.cuts.length && l.cuts.every(x => x.to > x.from)) && plan.swells.length && plan.slow.length && plan.stop.fade[1] > plan.stop.fade[0] && plan.kicks.length > 90,
      `${label}: loops, swells, slow spans, the fade, the loop's stomps`);
    for (const e of plan.band) { part(e, label); ok(e.clear && e.rise[1] === e.start && e.sink[0] === e.end, `${label}: "${e.display}" rises and sinks`); }
    const screens = buildScreens(plan, {table:LADY_TABLE}), st = boardState(plan, 20);
    ok(screens.length >= 1 && st.exposure > 0, `${label}: the board builds ${screens.length} screens and is lit`);
  }
  console.log(`  plan fields (engine-forms): ${checks - before} checks`);
}
// Couplets another screen interrupts (build-verify, Nov 5): with the real eSpeak durations, Synergy's next line,
// her punct or a rung can take the board between X and Y. The strike still holds STRIKE.min on the board before
// it turns, and a Y sung after the turn gets a screen of its own: every word of the band is up when it is sung.
{
  const before = checks, {AVAILABLE} = await import('../src/allhands/voices/voice-table.js'), {SONG_TABLE} = await import('../src/allhands/band.js'), {settleCast} = await import('../src/allhands/casting.js');
  const REAL = JSON.parse(fs.readFileSync(new URL('./fixtures/allhands-durations.json', import.meta.url), 'utf8'));
  const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/pixel-posts.json', import.meta.url), 'utf8')).map(x => x.post);
  for (const [i, track] of [[40, 'circle-back'], [2, 'circle-back'], [7, 'humbled-and-honored'], [38, 'humbled-and-honored'], [31, 'hustle'], [1, 'hustle']]) {
    const plan = settleCast(FORMS.drop60.arrange, lyricsFromPost(FX[i]), REAL, {track, cast:castSong(FX[i], {track, available:AVAILABLE}).cast}).plan, sc = buildScreens(plan, {table:SONG_TABLE});
    for (const s of sc.filter(x => x.fx?.strike)) {
      let shown = 0; for (let t = s.fx.strike.at + 1 / 48; activeScreen(sc, t) === s && t < s.fx.strike.at + 1; t += 1 / 24) shown += 1 / 24;
      ok(shown >= STRIKE.min - 1e-9 && s.fx.strike.at > s.words.filter(w => !w.part).at(-1).start, `interrupted couplets: fixture ${i} ${track} "${s.text.split(LINE_BREAK)[0]}" struck at ${s.fx.strike.at.toFixed(2)} s, on the board ${shown.toFixed(2)} s`);
    }
    const missed = plan.band.flatMap(b => b.words.filter(w => !(activeScreen(sc, w.start + 1 / 24)?.words || []).some(x => Math.abs(x.start - w.start) < .03)).map(w => `${b.role} ${w.text}`));
    ok(!missed.length, `interrupted couplets: fixture ${i} ${track}: every band word on the board when sung${missed.length ? ` (missed ${missed.join(', ')})` : ''}`);
  }
  console.log(`  interrupted couplets: ${checks - before} checks`);
}
console.log(`pegboard: ${checks} checks passed`);
