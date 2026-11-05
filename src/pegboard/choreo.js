// What the Peg Board shows, for any moment of a song. A plan becomes a list of
// screens (a line of type with timed words, a reveal, a release, a tone); then
// paint(board, t) lights the pegs for time t. Pure: the same plan and time
// always light the same pegs, so preview, scrubbing and export agree.
//
// Times are song seconds (plan.timing[step]); renders add their own offset.
// Song book tracks have their own tempo: a plan's 16th is plan.step and its
// landmarks are plan.marks (Circle Back's values when a plan has none). The
// reveal animations below keep their own clock in seconds.
import {clearBoard, light, PALETTE} from './board.js';

const STEP = .125, BEAT = .5;
const FRAME = 1 / 24;
const stepOf = plan => plan.step ?? STEP;
const T = (plan, step) => plan.timing[Math.max(0, Math.min(plan.timing.length - 1, Math.floor(step)))] + (step % 1) * stepOf(plan);
const CIRCLE_BACK_MARKS = {build:12 * 16, rise:16 * 16, sink:23 * 16, sinkEnd:24 * 16};
const marksOf = plan => plan.marks ?? CIRCLE_BACK_MARKS;
// A ladder hit's look follows its retrigger rate (16ths until the next hit):
// one per bar, per half, quarter, eighth, sixteenth, thirty-second. Circle
// Back's eight rungs map onto the same looks they always had.
const ladderLook = e => e.period === undefined ? e.rung : e.period >= 16 ? 0 : e.period >= 8 ? 2 : e.period >= 4 ? 4 : e.period >= 2 ? 5 : e.period >= 1 ? 6 : 7;

// Seeded per-peg randomness: the same peg always gets the same number.
function hash2(x, y, salt = 0) {
  let h = Math.imul(x + 1013, 2654435761) ^ Math.imul(y + 7919, 1597334677) ^ Math.imul(salt + 31, 362437);
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = u => 1 - (1 - clamp(u)) ** 3;

// Split a word's letters into as many groups as it has notes: vowel groups
// first, merged or split evenly until the counts match.
export function syllableSpans(display, count) {
  const letters = [...display];
  if (count <= 1 || letters.length <= 1) return [[0, letters.length]];
  const cuts = [];
  for (let i = 1; i < letters.length; i++) if (/[aeiouy]/i.test(letters[i - 1]) && !/[aeiouy]/i.test(letters[i]) && i < letters.length - 1) cuts.push(i + 1 < letters.length ? i + 1 : i);
  let bounds = [0, ...cuts.filter((c, i, a) => c > 0 && c < letters.length && c !== a[i - 1]), letters.length];
  while (bounds.length - 1 > count) bounds.splice(bounds.length - 2, 1);
  if (bounds.length - 1 < count) bounds = Array.from({length:count + 1}, (_, i) => Math.round(i * letters.length / count));
  return bounds.slice(0, -1).map((b, i) => [b, bounds[i + 1]]).filter(([a, b]) => b > a);
}

// ---- screens -----------------------------------------------------------------

function wordsOfLine(plan, line, half) {
  return line.words.filter(w => !!w.repeat === half).map(w => {
    const start = T(plan, w.at), end = start + Math.min(w.gate, w.steps * stepOf(plan));
    const spans = syllableSpans(w.display, w.notes.length);
    return {text:w.display, start, end, units:spans.map(([a, b], i) => ({chars:[a, b], start:T(plan, w.notes[i]?.at ?? w.at)}))};
  });
}

// The lady's words inside one event, from her recording's measured boundaries.
function ladyWords(plan, e, table) {
  const t0 = T(plan, e.at), entry = table?.[e.file];
  const inside = entry ? entry.words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6) : [];
  const shown = e.display.split(' ');
  if (inside.length === shown.length) {
    return shown.map((text, i) => {
      const w = inside[i], start = t0 + Math.max(0, w.start - e.from) / e.rate;
      return {text, start, end:Math.min(t0 + e.gate, t0 + (w.end - e.from) / e.rate), units:[{chars:[0, text.length], start}]};
    });
  }
  const per = e.gate / shown.length;
  return shown.map((text, i) => ({text, start:t0 + i * per, end:t0 + (i + 1) * per, units:[{chars:[0, text.length], start:t0 + i * per}]}));
}

const STYLE = {host:'typewriter', verse:'scanline', hook:'wipe', answer:'pop', repeat:'pop'};

// ---- whole words in stutters -----------------------------------------------------
// A fragment of a word (her ladder's "LE" and "LET'S BU-", Synergy's stammer, the intro's tease
// of BACK.) is shown as the whole word or words it comes from, every letter fully lit from the
// screen's first frame: nothing in a stutter is dim. The letters that sound wear a white-hot
// accent (FRAGMENT_ACCENT, a white mix) and re-pop on every retrigger: on the slow rungs a short
// white-hot pop (white toward 1, the light overdriven for ~60 ms, the peg springing); on the fast
// rungs ('steady', a quarter note and faster) the light holds and the letters move instead (the
// size kick, the rung's row shift), so the climax never strobes. A screen word carries `lit`: how
// many of its leading letters sound (all of them when it has none).
export const FRAGMENT_FULL = 1;
export const FRAGMENT_ACCENT = .55;
// A letter that has not typed in yet: Synergy's read-ahead lines, and every typewriter screen, show it at
// this intensity, so a phrase is whole on the board from its first frame and never reads "L", "LE".
export const READ_AHEAD = .1;
// The whole words a fragment ("LE", "LET'S BU-") comes from in `phrase` ("LET'S BUILD."), as
// [{text, lit}]; null when the fragment is not the start of the phrase.
export function wholeWords(fragment, phrase) {
  const frag = String(fragment ?? '').replace(/[-\u2013]$/, '').trim(), fw = frag.split(/\s+/), pw = String(phrase ?? '').trim().split(/\s+/);
  if (!frag || !pw[0] || fw.length > pw.length) return null;
  const up = x => x.toUpperCase();
  for (let i = 0; i < fw.length; i++) if (i < fw.length - 1 ? up(pw[i]) !== up(fw[i]) : !up(pw[i]).startsWith(up(fw[i]))) return null;
  return fw.map((w, i) => ({text:pw[i], lit:i < fw.length - 1 ? pw[i].length : w.length}));
}
// Her ladder's whole phrase: the longest display among the plan's ladder hits of that recording
// (the rungs that play all of it), whatever the cast.
export function ladderPhrase(plan, e) {
  const list = (plan?.lady || []).filter(x => x.role === 'ladder' && x.file === e.file).map(x => x.display);
  return list.reduce((a, b) => b.replace(/-$/, '').length > a.replace(/-$/, '').length ? b : a, e.display);
}
// A ladder hit's whole words, or null when it plays whole words already (nothing to fill in;
// a cut-off mark goes too: "DROP A-" shows DROP A).
export function ladderWhole(plan, e) {
  const whole = wholeWords(e.display, ladderPhrase(plan, e));
  return whole && (whole.some(w => w.lit < w.text.length) || /-$/.test(e.display)) ? whole : null;
}

export function buildScreens(plan, {table} = {}) {
  const screens = [], drop = plan.form === 'drop60', section = t => plan.sections.find(s => t >= T(plan, s.from * 16) && t < T(plan, s.to * 16))?.name, step = stepOf(plan);
  const add = s => { screens.push({k:1, tone:'blue', release:'cut', fx:{}, ...s}); };
  for (const line of plan.lines) {
    for (const half of [false, true]) {
      const words = wordsOfLine(plan, line, half);
      if (!words.length) continue;
      const from = words[0].start - BEAT * .5, sec = section(words[0].start) || '';
      const kind = half ? 'repeat' : line.kind;
      const accent = (line.kind === 'hook') ? words.length - 1 : -1;
      const reveal = /^Drop/.test(sec) ? 'pop' : STYLE[kind] || 'pop';
      add({kind, voice:'synergy', from, to:words.at(-1).end + BEAT, text:words.map(w => w.text).join(' '), words, accent, reveal,
        tone:line.kind === 'host' ? 'white' : 'blue', release:line.kind === 'host' ? 'afterglow' : 'cut'});
    }
  }
  // Words Synergy sings outside a line (his answers in the build).
  for (const w of plan.words.filter(x => x.line === -1)) {
    const start = T(plan, w.at);
    add({kind:'answer', voice:'synergy', from:start, to:start + w.steps * step, text:w.display, words:[{text:w.display, start, end:start + w.gate, units:[{chars:[0, w.display.length], start}]}], reveal:'pop', tone:'white', k:1});
  }
  // His stammer: the whole word with the first three letters lit (what he sings) and the rest a
  // ghost, on its own 16th. Where the lady's ladder owns the board (the drop's bar 18) it is heard,
  // not shown.
  const ladderSteps = new Set((plan.lady || []).filter(e => e.role === 'ladder').map(e => Math.floor(e.at / 16)));
  for (const s of plan.stutters) {
    if (ladderSteps.has(Math.floor(s.at / 16))) continue;
    const start = T(plan, s.at), word = ((plan.words || []).find(w => w.word === s.word)?.display ?? s.word).split(' ')[0].toUpperCase(), lit = Math.min(3, word.length);
    add({kind:'stammer', voice:'synergy', from:start, to:start + step, text:word, fragment:`${word.slice(0, lit)}-`, words:[{text:word, lit, start, end:start + step * .9, units:[{chars:[0, lit], start}]}], reveal:'pop', tone:'white', k:drop ? 2 : 1});
  }
  // The lady.
  for (const e of plan.lady || []) {
    const words = ladyWords(plan, e, table), t0 = T(plan, e.at);
    const base = {kind:e.role, voice:'lady', from:t0, to:t0 + Math.max(e.gate, step), text:e.display, words, accent:-1, tone:'white', reveal:'pop', k:1};
    if (e.role === 'ladder') {
      // The visual ladder is the audio ladder: each retrigger re-cuts the board.
      // Up to two pops a second are fine; from the quarter-note rung on, a
      // retrigger moves the letters (a row shift, a size kick) instead of
      // flashing them, so the climax never strobes. A fragment of her phrase
      // ("LE", "LET'S BU-") shows the whole words it comes from, its own letters lit.
      const r = ladderLook(e), k = [1, 1, 1, 1, 2, 3, 3, 4][r] ?? 1, whole = ladderWhole(plan, e);
      // (Two words may stack on two lines, so both are always on the board at once.)
      if (whole) Object.assign(base, {text:whole.map(w => w.text).join(' '), fragment:e.display, ...(whole.length > 1 ? {lines:2} : {}),
        words:words.map((w, i) => ({...w, text:whole[i].text, lit:whole[i].lit, units:[{chars:[0, whole[i].lit], start:w.start}]}))});
      add({...base, reveal:r < 2 ? 'typewriter' : r < 4 ? 'pop' : 'steady', k, tone:r >= 2 && r < 4 && Math.round(e.at * 2) % 4 >= 2 ? 'white' : 'blue',
        fx:{rowShift:r >= 4 ? [0, -1, 0, 1][Math.round(e.at * 2) % 4] : 0, sparkle:r === 7 ? clamp((e.at % 16) / 8) : 0}});
    // Her tag holds the board until it goes black (a frame past her envelope's end), so the
    // typewriter's last letter is up on the last frame she is heard in.
    } else if (e.role === 'tag') add({...base, to:Math.max(base.to, plan.choke?.tagEnd ?? base.to) + CHOKE_TAIL + FRAME, reveal:'typewriter', tone:'white', sockets:0});
    else if (e.role === 'impact') add({...base, to:t0 + 2.6 * BEAT, reveal:'centre', k:3, tone:'white', fx:{outline:true}, ignite:true});
    else if (e.role === 'sink') add({...base, to:T(plan, marksOf(plan).sinkEnd), reveal:'sparkle', k:2, tone:'deep', fx:{slow:true, tape:true}});
    // Her "Full stop." is routed after the tape: the tape stops, she does not. Her line holds the
    // board, fully typed, dimming and sliding down 2 pegs, until the frame after she stops sounding.
    else if (e.role === 'stop') { const end = stopEndAt(plan) ?? t0 + e.gate; add({...base, to:end + TAG_TAIL + FRAME, reveal:'typewriter', tone:'white', fx:{stop:{from:t0, end}}}); }
    else add({...base, fx:e.bend ? {detune:e.bend.cents} : e.lift ? {lift:true} : {}});
  }
  // The muted intro: YOU'RE ON MUTE, then the tease of the drop that comes later.
  // It ends on the unmute (Circle Back's 16th 32; a track's own plan.call.until).
  if (drop) {
    const u = plan.call?.until ?? 32, a = Math.max(2, u - 24), z = u - 4;
    add({kind:'title', voice:'board', from:T(plan, a), to:T(plan, z), text:"YOU'RE ON MUTE", words:[{text:"YOU'RE", start:T(plan, a), end:T(plan, z), units:[{chars:[0, 6], start:T(plan, a)}]}, {text:'ON', start:T(plan, a + 2), end:T(plan, z), units:[{chars:[0, 2], start:T(plan, a + 2)}]}, {text:'MUTE', start:T(plan, a + 4), end:T(plan, z), units:[{chars:[0, 4], start:T(plan, a + 4)}]}], reveal:'typewriter', tone:'white', release:'cut'});
    // The tease is BACK. (her impact word, whatever the cast) with its first two letters lit, one a 16th.
    const back = ((plan.lady || []).find(e => e.role === 'impact')?.display ?? 'BACK.').split(' ')[0], lit = Math.min(2, back.length);
    add({kind:'tease', voice:'board', from:T(plan, z), to:T(plan, u), text:back, fragment:back.slice(0, lit), words:[{text:back, lit, start:T(plan, z), end:T(plan, u), units:[{chars:[0, 1], start:T(plan, z)}, {chars:[1, lit], start:T(plan, z + 2)}].filter(x => x.chars[1] > x.chars[0])}], reveal:'pop', k:3, tone:'blue'});
  }
  screens.sort((a, b) => a.from - b.from);
  // One screen at a time: a screen ends when the next begins. Synergy's lines
  // arrive half a beat early as read-ahead ghosts, but they never take the
  // board from the lady before his first word is actually sung.
  for (let i = 0; i < screens.length - 1; i++) {
    const cur = screens[i], next = screens[i + 1];
    // A ladder hit holds the board until the next one: the letters stay lit
    // between retriggers instead of blinking at the retrigger rate.
    if (cur.kind === 'ladder' && next.kind === 'ladder') cur.to = next.from;
    if (next.voice === 'synergy' && cur.voice !== 'synergy') next.from = Math.max(next.from, Math.min(cur.to, next.words[0].start));
    cur.to = Math.min(cur.to, next.from);
  }
  screens.sort((a, b) => a.from - b.from);
  return screens.filter(s => s.to > s.from);
}

// ---- board-level light: power, blackout, ignition, breakdown ------------------

// The time a frame is painted at is the middle of that frame (a unit lights once
// its onset is within half a frame: pegLight). So the board goes black on the first
// frame that starts after her tag has stopped sounding (plan.choke.tagEnd, her
// envelope's end, plus CHOKE_TAIL), stays true black, and ignites on the frame that holds
// the impact. TAG_TAIL: an AAC or Opus encode smears a release on by up to 5 ms just
// above -70 dBFS (measured on the export: -59 dBFS at her envelope's end, -69 dBFS 4 ms on),
// so no trace of her voice ever plays over black in the delivered file.
export const TAG_TAIL = .005;
// The choke cuts her tag hard, and there a codec's own noise outlasts her: the Opus encoder (headless
// Chromium's only AudioEncoder) leaves a hiss floor at -66 to -70 dBFS for about 25 ms after the cut,
// whatever its frame size (20, 10 or 5 ms), and an AAC copy encoded from that sound carries it too
// (AAC from the clean master smears 5 ms). So the choke's black waits for the longest floor plus 5 ms:
// CHOKE_TAIL, 30 ms. The endings keep TAG_TAIL (her "Full stop." is not cut against a black frame).
export const CODEC_FLOOR = Object.freeze({opus:.025, aac:.005});
export const CHOKE_TAIL = Math.max(...Object.values(CODEC_FLOOR)) + .005;
export const darkAt = plan => (plan.choke.tagEnd ?? plan.choke.dark ?? T(plan, plan.choke.at) + .49) + CHOKE_TAIL + FRAME * .5;
export const igniteAt = plan => T(plan, plan.choke.until) - FRAME * .5;
// When her stop phrase ("Full stop.") stops sounding, in song seconds: plan.stop.end when the
// plan carries it, else her stop event's envelope end (its at, gate and release), the way
// choke.tagEnd is computed (drop.js ladyLength). null when the plan has no stop phrase.
export function stopEndAt(plan) {
  if (Number.isFinite(plan?.stop?.end)) return plan.stop.end;
  const e = (plan?.lady || []).find(x => x.role === 'stop');
  return e ? T(plan, e.at) + Math.min(e.gate, (e.to - e.from) / e.rate + .01) : null;
}
// The film ends black from the first frame after her stop phrase (plus a codec's tail), as at the
// choke: until then "FULL STOP." stays lit, dimmed to STOP_DIM of full exposure at most.
export const stopDarkAt = plan => { const end = stopEndAt(plan); return end === null ? null : end + TAG_TAIL + FRAME * .5; };
export const STOP_DIM = .7;
export function boardState(plan, t) {
  const state = {sockets:1, exposure:1, bloom:1, ignite:-1};
  if (plan.form !== 'drop60') {
    state.sockets = clamp(t / BEAT);
    return state;
  }
  const m = marksOf(plan), choke = T(plan, plan.choke.at), sinkFrom = T(plan, m.sink), sinkTo = T(plan, m.sinkEnd);
  const build = T(plan, m.build), rise = T(plan, m.rise), dark = darkAt(plan), lit = igniteAt(plan);
  state.sockets = clamp(t / BEAT);                                        // power on over 1 beat
  if (t >= build && t < rise) state.exposure = .55;                       // the build starts dim
  else if (t >= rise && t < choke) state.exposure = .55 + .45 * clamp((t - rise) / (choke - rise));
  if (t >= dark && t < lit) { state.sockets = 0; state.exposure = 0; }     // true black, once her tag has stopped sounding
  if (t >= lit && t < lit + 2.6 * BEAT) state.ignite = t - lit;           // one frame fully lit, then the settle
  if (t >= sinkFrom && t < sinkTo) state.bloom = 1.6;
  // The tape stop: the board dims with the tape (never under STOP_DIM while her stop phrase plays),
  // then true black from the first frame after she stops sounding.
  const stop = plan.tape?.find(x => x.kind === 'stop');
  if (stop) {
    const s = T(plan, stop.from), off = stopDarkAt(plan) ?? s + stop.seconds + .2;
    if (t >= off) { state.sockets = 0; state.exposure = 0; }
    else if (t >= s) state.exposure *= 1 - (1 - STOP_DIM) * clamp((t - s) / Math.max(FRAME, off - s));
  }
  return state;
}

// ---- reveals -------------------------------------------------------------------

// Intensity and peg life for one lit peg of a word, given its reveal.
function pegLight(screen, word, unit, peg, t, ctx) {
  const {x, y, i, n, row, rows} = peg;
  const since = t - unit.start;
  let delay = 0;
  switch (screen.reveal) {
    case 'typewriter': delay = ctx.letterDelay; break;
    case 'scanline': delay = rows > 1 ? (row / (rows - 1)) * STEP : 0; break;
    case 'wipe': delay = ctx.wipeDelay; break;
    case 'sparkle': delay = hash2(x, y, 7) ** .6 * BEAT; break;
    case 'centre': delay = Math.hypot(x - ctx.cx, y - ctx.cy) * .008; break;
    case 'stroke': delay = n > 1 ? i / (n - 1) * STEP : 0; break;
    default: delay = 0;
  }
  const age = since - delay;
  if (age < -FRAME * .5) return null;
  // Pop: 1.6 white-hot, settling to 1.0 in ~60 ms; the peg springs to 1.25 and settles.
  if (screen.reveal === 'steady') return {I:1.15, white:0, size:1 + .12 * Math.exp(-Math.max(0, age) * 14)};
  // The white-hot overshoot needs room: syllables closer than ~0.37 s apart
  // glow instead of strobing (full pop at 0.37 s, none at 0.12 s).
  const room = clamp((ctx.gap - .12) / .25);
  const hot = Math.exp(-Math.max(0, age) / .06) * room;
  const spring = 1 + .25 * Math.exp(-Math.max(0, age) * 9) * Math.cos(Math.max(0, age) * 2 * Math.PI * 6);
  const sparkle = screen.reveal === 'sparkle' ? Math.exp(-Math.max(0, age) / .12) : 0;
  return {I:1 + .6 * hot, white:Math.max(hot * .9, sparkle), size:screen.reveal === 'pop' || screen.reveal === 'centre' ? spring : 1};
}

// ---- paint ---------------------------------------------------------------------

// layout(screen) -> {pages:[{lines:[{chars:[{index, word, pegs:Int16Array}]}]}], width, height}
// (font.js layoutText), cached per screen. place(screen, layout) -> {x, y} board origin.
export function paint(board, screens, t, {plan, layoutOf, place, eq, reduced = false} = {}) {
  clearBoard(board);
  // A ghost screen (the loop seam's BACK., screen.ghost its intensity): only its letters, flat, on
  // true black, on the same pegs as the screen it copies.
  const ghost = activeScreen(screens, t);
  if (ghost?.ghost) { board.sockets = 0; drawScreen(board, ghost, t, {layoutOf, place, reduced, igniting:false}); return board; }
  const state = plan ? boardState(plan, t) : {sockets:1, exposure:1, bloom:1, ignite:-1};
  board.sockets = state.sockets; board.exposure = state.exposure; board.bloom = state.bloom;
  if (state.exposure <= 0) return board;
  const screen = activeScreen(screens, t);
  if (eq) eq(board, t, screen);
  if (state.ignite >= 0) ignite(board, state.ignite);
  if (screen) drawScreen(board, screen, t, {layoutOf, place, reduced, igniting:state.ignite >= 0});
  return board;
}

export function activeScreen(screens, t) {
  let lo = 0, hi = screens.length - 1, found = null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (screens[mid].from <= t) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  const s = found === null ? null : screens[found];
  return s && t < s.to + releaseTime(s) ? s : null;
}
const releaseTime = s => s.release === 'afterglow' ? .3 : s.release === 'dissolve' ? BEAT : 0;

// The drop: the whole board burns for one frame, then settles from the centre out.
function ignite(board, age) {
  const {cols, rows} = board, cx = (cols - 1) / 2, cy = (rows - 1) / 2, reach = Math.hypot(cx, cy);
  const settle = 2.6 * BEAT * .5;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const d = Math.hypot(x - cx, y - cy) / reach, local = age - d * settle;
    const I = age < FRAME ? 1.4 : local < 0 ? .9 : .9 * Math.exp(-local / .18);
    if (I > .03) light(board, x, y, I * (.85 + .15 * hash2(x, y, 3)), {tone:PALETTE.blue.id, white:age < FRAME ? 1 : 0});
  }
}

function drawScreen(board, screen, t, {layoutOf, place, reduced, igniting}) {
  const layout = layoutOf(screen);
  if (!layout?.pages?.length) return;
  // Paging: each page appears when its first word is heard.
  let page = layout.pages[0];
  for (const p of layout.pages) { const first = p.lines[0]?.chars[0]; if (first && screen.words[first.word]?.start <= t + .001) page = p; }
  const origin = place(screen, layout, page);
  const releaseAge = t - screen.to, fade = releaseAge > 0 ? (screen.release === 'afterglow' ? clamp(1 - releaseAge / .3) : screen.release === 'dissolve' ? clamp(1 - releaseAge / BEAT) : 0) : 1;
  if (fade <= 0) return;
  const tone = PALETTE[screen.tone]?.id ?? 0, accentTone = PALETTE.signal.id;
  const rows = Math.max(1, ...page.lines.flatMap(l => l.chars.map(c => c.h || 9))) || 9;
  const cx = origin.x + layout.width / 2, cy = origin.y + layout.height / 2;
  let letterIndex = 0;
  const allChars = page.lines.flatMap(l => l.chars);
  const minX = Math.min(...allChars.map(c => c.x)), maxX = Math.max(...allChars.map(c => c.x + c.w));
  for (const line of page.lines) for (const ch of line.chars) {
    const word = screen.words[ch.word];
    if (!word) continue;
    const charInWord = ch.index - (screen.wordStarts?.[ch.word] ?? 0);
    const unit = word.units.find(u => charInWord >= u.chars[0] && charInWord < u.chars[1]) || word.units[0];
    // Typewriter: letters follow the voice, but never slower than 80 ms each
    // (50 ms for the board's own titles), and never faster than one frame.
    const letters = word.text.length, cap = screen.voice === 'board' ? .05 : .08;
    const span = Math.max(FRAME, Math.min(cap, (word.end - word.start) / Math.max(1, letters)));
    const ctx = {letterDelay:Math.max(0, charInWord - unit.chars[0]) * span, wipeDelay:((ch.x - minX) / Math.max(1, maxX - minX)) * 16 * STEP - (unit.start - screen.words[0].start),
      cx, cy, gap:gapAfter(screen, unit)};
    letterIndex++;
    const sung = t >= unit.start, ended = t > word.end;
    const pegs = ch.pegs, n = pegs.length / 2;
    // A fragment's word (a stutter): fully lit, its sounding letters accented (fragmentLight).
    const frag = word.lit !== undefined, sounding = frag && charInWord < word.lit;
    for (let i = 0; i < n; i++) {
      const px = pegs[2 * i], py = pegs[2 * i + 1], x = origin.x + px, y = origin.y + py + (screen.fx.rowShift || 0);
      if (screen.ghost) { light(board, x, y, screen.ghost * fade, {tone}); continue; }
      let I, white = 0, size = 1, dx = 0, dy = 0, peg = tone;
      if (frag) ({I, white, size} = fragmentLight(screen, word, unit, {x, y, i, n, row:py - (ch.y || 0), rows:ch.h || rows}, t, ctx, sounding, reduced));
      else if (screen.voice === 'synergy' && !sung && screen.reveal !== 'wipe') { I = READ_AHEAD; }  // ghost: read ahead on mute
      else {
        const l = reduced ? {I:clamp((t - unit.start) / .2), white:0, size:1} : pegLight(screen, word, unit, {x, y, i, n, row:py - (ch.y || 0), rows:ch.h || rows}, t, ctx);
        // No partial words: a typewriter screen (her tag, her whole-phrase rungs, "FULL STOP.", the board's
        // own titles) shows its whole phrase from its first frame as a dim read-ahead ghost, as Synergy's
        // lines do, and lights each letter as it types.
        if (!l) { if (screen.voice === 'synergy' || screen.reveal === 'typewriter') I = READ_AHEAD; else continue; }
        else { I = l.I; white = l.white; size = l.size; }
        if (ended && screen.voice === 'synergy') I = Math.min(I, .72);                          // sung: still readable
      }
      if (screen.accent === ch.word) peg = accentTone;
      if (screen.fx.detune && sung) { const c = clamp(screen.fx.detune / 100, -1, 1); dy = -c * .5; dx = (hash2(px, py, 11) < .5 ? -1 : 1) * Math.abs(c) * .4; }
      if (screen.fx.lift && sung) dy = -clamp((t - word.start) / Math.max(.05, word.end - word.start)) * .8;
      // FULL STOP. slides down 2 pegs over her line, slowing like the tape, and dims to .8.
      if (screen.fx.stop) { const st = screen.fx.stop, p = clamp((t - (st.from ?? screen.from)) / Math.max(FRAME, (st.end ?? screen.to) - (st.from ?? screen.from))); dy = 2 * (1 - (1 - p) ** 2); I *= 1 - .2 * p; }
      if (screen.fx.tape && sung) dy = clamp((t - screen.from) / 2) * .6;
      if (screen.fx.sparkle) { if (hash2(x, y, Math.floor(t * 32)) > 1 - screen.fx.sparkle * .8) { white = 1; I = 1.5; } }
      light(board, x, y, I * fade, {tone:peg, white, size, dx, dy});
    }
    // Drop words wear a 1-peg outline of dark pegs, so the ignition never swallows them.
    if (screen.fx.outline || igniting) outline(board, ch, origin);
  }
}

// A stutter's light for one peg of its word. Every letter at full (FRAGMENT_FULL; a fast rung's
// steady 1.15), from the screen's first frame. The sounding letters: the white-hot accent from their
// onset (FRAGMENT_ACCENT, held), and the reveal's own life on each retrigger: the slow rungs' pop
// (white toward 1, the light overdriven, the spring), the fast rungs' size kick with the light held.
// Before a sounding letter's onset (the tease's A, a typewriter's later letter) it is lit, unaccented.
function fragmentLight(screen, word, unit, peg, t, ctx, sounding, reduced) {
  const I = screen.reveal === 'steady' ? 1.15 : FRAGMENT_FULL;
  if (!sounding) return {I, white:0, size:1};
  if (reduced) return {I, white:t >= unit.start ? FRAGMENT_ACCENT : 0, size:1};
  const l = pegLight(screen, word, unit, peg, t, ctx);
  if (!l) return {I, white:0, size:1};
  return {I:Math.max(I, l.I), white:Math.max(FRAGMENT_ACCENT, l.white), size:l.size};
}

// Seconds from a unit's onset to the next onset on this screen (or a full beat).
function gapAfter(screen, unit) {
  let next = Infinity;
  for (const w of screen.words) for (const u of w.units) if (u.start > unit.start + 1e-6 && u.start < next) next = u.start;
  return Number.isFinite(next) ? next - unit.start : BEAT;
}

function outline(board, ch, origin) {
  const pegs = ch.pegs, lit = new Set();
  for (let i = 0; i < pegs.length; i += 2) lit.add(`${origin.x + pegs[i]},${origin.y + pegs[i + 1]}`);
  for (const key of lit) {
    const [x, y] = key.split(',').map(Number);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = x + ox, ny = y + oy;
      if (lit.has(`${nx},${ny}`) || nx < 0 || ny < 0 || nx >= board.cols || ny >= board.rows) continue;
      const j = ny * board.cols + nx; board.I[j] = 0;
    }
  }
}

// Each word's first character index within the screen text, so a layout's
// per-character `index` maps to the right word unit.
export function indexWords(screen) {
  let at = 0; screen.wordStarts = screen.words.map(w => { const s = at; at += w.text.length + 1; return s; });
  return screen;
}
