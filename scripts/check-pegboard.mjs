// Peg Board choreography: screens from real song plans, onsets on time, the
// silence and the ignition, determinism, and the flash governor. Pure Node.
import assert from 'node:assert/strict';
import {createBoard} from '../src/pegboard/board.js';
import {compileFont, layoutText} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {buildScreens, paint, indexWords, activeScreen, syllableSpans, darkAt, TAG_TAIL, stopEndAt, stopDarkAt, STOP_DIM} from '../src/pegboard/choreo.js';
import {ladyLength} from '../src/allhands/drop.js';
import {boardLuma, flashes, worstWindow, governorTrack} from '../src/pegboard/governor.js';
import {FORMS, formPlays} from '../src/allhands/forms.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {kickSteps} from '../src/pegboard/eq.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const FPS = 24, FRAME = 1 / FPS;
const faces = {peg9:compileFont(PEG9), peg5:compileFont(PEG5)};
const POSTS = [SAMPLE_POST, `Humbled and honored to share that I've been promoted to Senior Director of Synergy. This journey taught me that leadership is a mindset, not a title. Grateful for every step. Agree?`];

function rig(plan, cols = 120, rows = 53) {
  const board = createBoard(cols, rows), textRows = rows - 12, cache = new Map();
  const screens = buildScreens(plan, {table:LADY_TABLE}).map(indexWords);
  const layoutOf = s => {
    if (cache.has(s)) return cache.get(s);
    let out = null;
    for (const f of ['peg9', 'peg5']) { for (let k = s.k; k >= 1 && !out; k--) { const l = layoutText(s.text, {font:faces[f], k, maxCols:cols - 4, maxLines:s.k > 1 ? 1 : 3}); if (l.width <= cols - 4 && l.height <= textRows) out = l; } if (out) break; }
    cache.set(s, out); return out;
  };
  const place = (s, l, page) => ({x:Math.floor((cols - Math.max(...page.lines.map(x => x.width))) / 2), y:Math.max(1, Math.floor((textRows - l.height) / 2))});
  const at = t => paint(board, screens, t, {plan, layoutOf, place});
  return {board, screens, layoutOf, place, at};
}

ok(JSON.stringify(syllableSpans('BUILDING', 2)) === '[[0,3],[3,8]]' || syllableSpans('BUILDING', 2).length === 2, 'syllables split a word into its notes');
ok(syllableSpans('A', 3).length === 1 && syllableSpans('OPTIMIZE', 3).length === 3, 'syllable spans never exceed the letters');

// Every form in every song book track that plays it (Sound check 00 is Circle Back's).
for (const id of ['drop60', 'soundcheck']) for (const track of TRACK_ORDER.filter(t => formPlays(id, t))) for (const post of POSTS) {
  const lyrics = lyricsFromPost(post), form = FORMS[id];
  const plan = form.arrange(lyrics, Object.fromEntries(form.voiced(lyrics, {track}).map(w => [w, .18 + .11 * syllables(w)])), {track});
  const {board, screens, layoutOf, at} = rig(plan), label = `${id}/${track}/${post.slice(0, 12)}`, place = rig(plan).place;
  ok(screens.every((s, i) => s.to > s.from && (!i || s.from >= screens[i - 1].from)), `${label}: screens ordered`);
  ok(screens.every((s, i) => i === screens.length - 1 || s.to <= screens[i + 1].from + 1e-9), `${label}: one screen at a time`);
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
    const T = plan.timing, choke = T[plan.choke.at], impact = T[plan.choke.until], end = plan.choke.tagEnd, tag = screens.find(s => s.kind === 'tag');
    ok(end > choke && end < impact - .3 && Math.abs(darkAt(plan) - (end + TAG_TAIL + FRAME / 2)) < 1e-12, `${label}: the board goes dark on the first frame after her tag stops sounding (${end.toFixed(3)} s, plus a codec's ${TAG_TAIL * 1000} ms tail), well before the impact`);
    const typed = (() => { const b = createBoard(board.cols, board.rows); paint(b, [{...tag, to:impact}], end - 1e-3, {layoutOf, place:rig(plan).place}); return b.I.filter(v => v > .05).length; })();
    at(end + TAG_TAIL + FRAME * .49); const last = board.I.filter(v => v > .05).length;
    ok(board.exposure > 0 && activeScreen(screens, end + TAG_TAIL + FRAME * .49) === tag && last >= typed && typed > 20, `${label}: "${tag.text}" fully typed on her last frame (${last} of ${typed} pegs)`);
    at(end + TAG_TAIL + FRAME * .51); ok(board.exposure === 0 && board.sockets === 0, `${label}: true black from the first frame after her tag`);
    let black = true; for (let t = end + TAG_TAIL + FRAME * .51; t < impact - FRAME * .51; t += .01) { at(t); black &&= board.exposure === 0 && board.sockets === 0; }
    ok(black, `${label}: true black (0) all the way to the impact's frame`);
    const burning = () => board.I.filter(v => v >= 1.15).length / (board.cols * board.rows);
    at(impact - FRAME * .49); ok(board.I.filter(v => v > .5).length > board.cols * board.rows * .8 && burning() > .8, `${label}: the board ignites, fully lit, on the frame that holds the impact`);
    at(impact + FRAME * .51); ok(board.I.filter(v => v > .5).length > board.cols * board.rows * .5 && burning() < .2, `${label}: one frame fully lit, then the settle (${(100 * burning()).toFixed(0)} % still burning)`);
    at(impact + .3); ok(screens.find(s => s.kind === 'impact') === activeScreen(screens, impact + .3), `${label}: BACK. holds the board after the impact`);
    // The ending: her "Full stop." is routed after the tape, so the tape stop does not stop her. The
    // board keeps it lit (never under STOP_DIM of full exposure) through every frame she is heard in,
    // fully typed and readable on the last one, slid down 2 pegs; true black from the first frame
    // that starts after she stops sounding (plan.stop.end, else her envelope's end), as at the choke.
    const stopEv = plan.lady.find(e => e.role === 'stop'), sEnd = stopEndAt(plan), s0 = T[stopEv.at], sScreen = screens.find(s => s.kind === 'stop');
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
  }
}
console.log(`pegboard: ${checks} checks passed`);
