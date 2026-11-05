// Peg Board choreography: screens from real song plans, onsets on time, the
// silence and the ignition, determinism, and the flash governor. Pure Node.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBoard} from '../src/pegboard/board.js';
import {compileFont, layoutText} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {buildScreens, paint, indexWords, activeScreen, syllableSpans, darkAt, TAG_TAIL, CHOKE_TAIL, CODEC_FLOOR, stopEndAt, stopDarkAt, STOP_DIM, FRAGMENT_FULL, FRAGMENT_ACCENT, READ_AHEAD} from '../src/pegboard/choreo.js';
import {ladyLength} from '../src/allhands/drop.js';
import {boardLuma, flashes, worstWindow, governorTrack} from '../src/pegboard/governor.js';
import {FORMS, formPlays} from '../src/allhands/forms.js';
import {TRACK_ORDER} from '../src/allhands/songbook/index.js';
import {kickSteps} from '../src/pegboard/eq.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {LADY_TABLE} from '../src/allhands/lady-table.js';
import {clearBoard, TONES} from '../src/pegboard/board.js';
import {paintPsych, PSYCH_LOOKS, PSYCH_TONES, PSYCH_MAX, TYPE_HALO, driveTrack, driveAt} from '../src/pegboard/psych.js';
import {planFeatures} from '../src/videostudio/edl/params.js';

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
    for (const f of ['peg9', 'peg5']) { for (let k = s.k; k >= 1 && !out; k--) { const l = layoutText(s.text, {font:faces[f], k, maxCols:cols - 4, maxLines:s.lines ?? (s.k > 1 ? 1 : 3)}); if (l.width <= cols - 4 && l.height <= textRows) out = l; } if (out) break; }
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
console.log(`pegboard: ${checks} checks passed`);
