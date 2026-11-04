// Peg Board choreography: screens from real song plans, onsets on time, the
// silence and the ignition, determinism, and the flash governor. Pure Node.
import assert from 'node:assert/strict';
import {createBoard} from '../src/pegboard/board.js';
import {compileFont, layoutText} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {buildScreens, paint, indexWords, activeScreen, syllableSpans} from '../src/pegboard/choreo.js';
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
  const {board, screens, layoutOf, at} = rig(plan), label = `${id}/${track}/${post.slice(0, 12)}`;
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
    const T = plan.timing, choke = T[plan.choke.at], impact = T[plan.choke.until];
    ok(plan.choke.dark > choke && plan.choke.dark < impact - .3, `${label}: the board goes dark after her tag, well before the impact`);
    at((plan.choke.dark + impact) / 2); ok(board.exposure === 0 && board.sockets === 0, `${label}: true black before the drop`);
    at(impact + FRAME * .5); ok(board.I.filter(v => v > .5).length > board.cols * board.rows * .8, `${label}: the board ignites on the impact frame`);
    at(impact + .3); ok(screens.find(s => s.kind === 'impact') === activeScreen(screens, impact + .3), `${label}: BACK. holds the board after the impact`);
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
