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
import {compileFont, layoutText, normalize, LINE_BREAK} from './font.js';
import {PEG3} from './fonts/peg3.js';

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
// How far a fast rung rocks its letters, in pitch units: inside the socket (a renderer draws a peg off
// its socket past .5), so the light stays on the same pegs and the governor sees no change.
export const ROCK = .4;
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

// ---- the band's lines: couplets, refrains, exchanges -----------------------------------------
// Synergy sings the post; the band (Strategy, Synthia, the lady's recordings) sings the lexicon, and the
// board shows it. A band part on the plan is {text, display?, voice, at, end, words:[{text, start, end}]}
// in song seconds (plan.couplets [{x, y}], plan.refrains [part], plan.exchanges [{call, response}]).
//
// The couplet moment, "IT'S NOT X." then "IT'S Y.": X lights word by word as Strategy sings it (the whole
// line up from the screen's first frame as the read-ahead ghost, so it never reads "IT'S NO"), then on the
// beat after it a bar of pegs (STRIKE.weight) strikes through X (signal, drawn left to right over one 16th, every letter
// still at full under it), then Y lands under it as it is sung. X and Y share the board when both fit one
// page (each on lines of its own: font.js LINE_BREAK); on a board too small for both the page turns to Y
// when Y is sung, after the strike has shown for STRUCK_MIN at least. Y is dark until it is sung: the joke
// never lands early. An exchange is the same two-part screen without the strike: the call, then the
// answer under it. A refrain is one part, and its repeats hold the board between them.
//
// Every word is fully lit when sung (1, the pop's overdrive above it), held at full through the build's
// dim (screen.hold), and voices wear their tone: Strategy blue, Synthia and the lady white. A part may
// carry a role tag in PEG-3 (STRATEGY, SYNTHIA; the lady never has one) where the board's pitch reads it.
export const BAND_VOICES = Object.freeze({
  strategy:{tone:'blue', tag:'STRATEGY'},
  synthia:{tone:'white', tag:'SYNTHIA'},
  lady:{tone:'white', tag:null},
  synergy:{tone:'blue', tag:null},
});
// weight: the strike's rows a k, by face. PEG-9's stem (2 pegs), so it reads as a stroke of the face at every size
// (one row was PEG-9's crossbar weight, on the crossbars' row: a hairline at the phone's 3 px pegs and in the 9:16
// film at 270 px wide); PEG-5 takes the same 2, heavier than its 1-peg strokes, so it reads on a phone. PEG-3 (the
// 16:9 film's narrow home, for a long X) keeps 1: two rows of a 5-row cap would make its B read as D and its K as H.
export const STRIKE = Object.freeze({tone:'signal', draw:1, min:.25, weight:Object.freeze({peg9:2, peg5:2, peg3:1})});   // draw: 16ths to cross X; min: seconds struck before Y
export const strikeWeight = (font, k = 1) => Math.min((CAP_ROWS[font] ?? 9) * k, (STRIKE.weight[font] ?? 2) * k);
export const TAG_MIN_PITCH = 12;                                          // PEG-3 reads from 12 px a peg
const PAIR_GAP = 16;                                                      // 16ths: a Y further than a bar from X gets a screen of its own
const STRUCK_SKIP = new Set(['NOT', 'JUST', 'ABOUT', 'ONLY', 'EVEN']);

// A part's words as the board shows them: the display's words (capitals), each on the time the plan
// gives it; spread evenly over the part's span when the plan has no word times.
export function partWords(plan, part) {
  if (!part) return [];
  const shown = normalize(part.display ?? part.text ?? '').text.split(/[ \u2028]+/).filter(Boolean);
  const timed = (part.words || []).filter(w => Number.isFinite(w?.start));
  const at = Number.isFinite(part.at) ? part.at : timed[0]?.start, end = Number.isFinite(part.end) ? part.end : timed.at(-1)?.end ?? at + .5;
  let words;
  if (timed.length && timed.length === shown.length) words = timed.map((w, i) => ({text:shown[i], start:w.start, end:Number.isFinite(w.end) ? w.end : w.start + .2}));
  else if (timed.length) words = timed.flatMap(w => { const ws = normalize(w.text).text.split(' ').filter(Boolean), per = ((w.end ?? w.start + .2) - w.start) / Math.max(1, ws.length); return ws.map((x, i) => ({text:x, start:w.start + i * per, end:w.start + (i + 1) * per})); });
  else if (Number.isFinite(at)) { const per = Math.max(FRAME, (end - at) / Math.max(1, shown.length)); words = shown.map((x, i) => ({text:x, start:at + i * per, end:at + (i + 1) * per})); }
  else return [];
  return words.filter(w => w.text).map(w => ({...w, end:Math.max(w.end, w.start + FRAME), units:[{chars:[0, w.text.length], start:w.start}]}));
}

// The first time on the plan's grid of `div` 16ths at or after t (swing included), or Infinity.
function gridAfter(plan, t, div) {
  const tm = plan.timing; let lo = 0, hi = tm.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (tm[mid] >= t - 1e-9) { at = mid; hi = mid - 1; } else lo = mid + 1; }
  if (at < 0) return Infinity;
  for (let s = Math.ceil(at / div) * div; s < tm.length; s += div) if (tm[s] >= t - 1e-9) return tm[s];
  return Infinity;
}
// When the strike crosses X: on the first beat after X has been sung that leaves the struck X up for
// STRIKE.min before Y; else the first 8th, else the first 16th; else as late as leaves STRIKE.min (never
// before X's last word has started). yAt is Infinity when Y is far (the drop's couplet: Y is the impact).
export function strikeAt(plan, xWords, yAt = Infinity) {
  const xEnd = xWords.at(-1).end, last = xWords.at(-1).start;
  for (const div of [4, 2, 1]) { const g = gridAfter(plan, xEnd, div); if (g + STRIKE.min <= yAt + 1e-9) return g; }
  return Math.max(last + 2 * FRAME, Math.min(xEnd, yAt - STRIKE.min));
}
// The words a strike crosses: X itself, after "IT'S NOT" (and her template's "ABOUT"), never the denial.
export function struckWords(words) {
  const not = words.findIndex(w => /^NOT\b/.test(w.text));
  let i = not < 0 ? Math.min(1, words.length - 1) : not + 1;
  while (i < words.length - 1 && STRUCK_SKIP.has(words[i].text.replace(/[^A-Z]/g, ''))) i++;
  return words.map((_, j) => j).filter(j => j >= i);
}

// One band screen from one or two parts. strike: strike X (part 0) before part 1.
function bandScreen(plan, kind, parts, {strike = false, k = 1, lines = 3, yAt} = {}) {
  const words = [], info = [];
  for (const p of parts) {
    const ws = partWords(plan, p);
    if (!ws.length) continue;
    const v = BAND_VOICES[p.voice] ?? BAND_VOICES.strategy;
    info.push({voice:p.voice, tone:v.tone, tag:v.tag, first:words.length, count:ws.length, start:ws[0].start, end:ws.at(-1).end});
    words.push(...ws.map(w => ({...w, part:info.length - 1})));
  }
  if (!words.length) return null;
  const step = stepOf(plan), text = info.map(p => words.slice(p.first, p.first + p.count).map(w => w.text).join(' ')).join(LINE_BREAK);
  // fill: a layout may give a two-part screen as many lines as its board's text rows hold (at least
  // `lines`), so X and Y share one page wherever they fit (stage.js, the video's board-layer.js).
  const screen = {kind, voice:info[0].voice, band:true, hold:true, parts:info, from:words[0].start - BEAT * .5, to:words.at(-1).end + 4 * step,
    text, words, accent:-1, reveal:'pop', tone:info[0].tone, k, lines, fill:info.length > 1, release:'cut', fx:{}};
  if (strike) {
    const x = words.slice(0, info[0].count), at = strikeAt(plan, x, info[1]?.start ?? yAt ?? Infinity);
    screen.fx.strike = {at, words:struckWords(x), draw:STRIKE.draw * step, tone:STRIKE.tone};
    if (info.length === 1) screen.to = Math.max(screen.to, at + STRIKE.draw * step + BEAT);
  }
  return screen;
}

// The band's screens for a plan: the couplets (as pairs, or X and Y apart when Y is the drop's impact),
// the refrains, the exchanges. The lady's own events stay hers (her screens above), so a part that is one
// of her events already on the board is not drawn twice.
// The band's parts on a plan, grouped as the board shows them. The engine's events (plan.band, drop.js
// and band.js: {role, part, voice, display, words:[{text, display, start, end}], start, end, couplet?})
// or the contract's lists (plan.couplets [{x, y}], plan.refrains, plan.exchanges [{call, response}]):
//   couplets [{x, y}]   "IT'S NOT X." then "IT'S Y." (Synthia's pickup "IT'S" and her word joined as one Y)
//   dropX [part]        the couplet drop's X over the build's answer bars (Y is the impact: her impact screen)
//   refrains, exchanges [{call, response}], singles (the sign-off, the stabs: one part each)
// plan.phrases (the river's clear phrases) join them by shape: {x, y}, {call, response} or one part.
export function bandOf(plan) {
  const out = {couplets:[...(plan.couplets || [])], dropX:[], refrains:[...(plan.refrains || [])], exchanges:[...(plan.exchanges || [])], singles:[]};
  const groups = new Map();
  for (const e of plan.band || []) { if (!groups.has(e.part)) groups.set(e.part, []); groups.get(e.part).push(e); }
  const join = parts => parts.length < 2 ? parts[0] : {...parts.at(-1), display:parts.map(p => p.display ?? p.text).join(' '), text:parts.map(p => p.text).join(' '),
    words:parts.flatMap(p => p.words || []), start:parts[0].start, at:parts[0].at, voice:parts.at(-1).voice};
  // The river's clear phrases (plan.phrases): a couplet, an exchange or one phrase each.
  for (const ph of (plan.phrases || []).filter(p => !(plan.band || []).includes(p))) {
    if (ph?.x || ph?.y) out.couplets.push(ph);
    else if (ph?.call) out.exchanges.push(ph);
    else if (ph) out.refrains.push(ph);
  }
  for (const [part, es] of groups) {
    const by = r => es.filter(e => e.role === r);
    if (part === 'couplet') { const x = by('couplet-x')[0], y = join([...by('pickup'), ...by('couplet-y')]); if (x || y) out.couplets.push({x, y, id:es[0].couplet}); }
    else if (part === 'dropTag') out.dropX.push(...by('x'));
    else if (part === 'refrain') out.refrains.push(...by('refrain'));
    else if (/^exchanges/.test(part)) out.exchanges.push({call:by('call')[0], response:by('response')[0]});
    else out.singles.push(...es.map(e => ({...e, kind:e.role})));
  }
  return out;
}

export function bandScreens(plan) {
  const out = [], step = stepOf(plan), near = (p, q) => q && Number.isFinite(p?.start) && Math.abs(p.start - q.start) < FRAME;
  const B = bandOf(plan);
  // The drop's impact: a Y that lands on it is the impact word, drawn as her impact is (centre, k 3, the
  // outline through the ignition), unless her own impact screen (the couplet drop's impact event) shows it.
  const impactAt = plan.form === 'drop60' && plan.choke ? T(plan, plan.choke.until) : null;
  const onImpact = ws => impactAt !== null && ws.length && Math.abs(ws[0].start - impactAt) < BEAT;
  const theirImpact = (plan.lady || []).some(e => e.role === 'impact');
  const two = (kind, a, b, strike) => {
    const wa = partWords(plan, a), wb = partWords(plan, b);
    if (!wa.length) { if (wb.length) out.push(bandScreen(plan, kind, [b])); return; }
    if (wb.length && !onImpact(wb) && wb[0].start - wa.at(-1).end <= PAIR_GAP * step + 1e-9) out.push(bandScreen(plan, kind, [a, b], {strike}));
    else {
      out.push(bandScreen(plan, kind, [a], {strike, yAt:wb[0]?.start}));
      if (!wb.length) return;
      if (onImpact(wb)) { if (!theirImpact) { const y = bandScreen(plan, 'impact', [b], {k:3, lines:1}); Object.assign(y, {from:impactAt, to:impactAt + 2.6 * BEAT, reveal:'centre', ignite:true, hold:false, fx:{outline:true}}); out.push(y); } }
      else out.push(bandScreen(plan, `${kind}-y`, [b]));
    }
  };
  for (const c of B.couplets) two('couplet', c.x, c.y, true);
  // The drop's X, over the build: struck on the beat after it; its Y is the impact, after the silence.
  // (Sung twice, one bar apart, it lights twice and is struck after the second.)
  const dropX = [...B.dropX].sort((a, b) => (a.start ?? a.at) - (b.start ?? b.at));
  dropX.forEach((x, i) => { const sc = bandScreen(plan, 'couplet', [x], {strike:i === dropX.length - 1, yAt:impactAt ?? Infinity}); if (sc) out.push(Object.assign(sc, {over:true})); });
  for (const e of B.exchanges) two('exchange', e.call, e.response ?? e.answer, false);
  // A refrain or a sign-off is one phrase on one page (k 1, as Synergy's lines); a stab, a verdict, takes
  // k 2 where its word fits (two lines at most, so it never pages).
  for (const r of B.refrains) out.push(bandScreen(plan, 'refrain', [r]));
  for (const s of B.singles) out.push(bandScreen(plan, s.kind === 'stab' ? 'stab' : s.kind ?? 'band', [s], s.kind === 'stab' ? {k:2, lines:2} : {}));
  return out.filter(Boolean).filter((s, i, a) => !a.slice(0, i).some(o => near(o.words[0], s.words[0]) && o.text === s.text));
}

// The river (plan.form 'wander', Offsite): the board is mostly texture (psych.js riverTrack), and type only
// for its clear phrases, the one or two that rise out of the stream: a line, an event or a band part the
// plan marks `clear`, and the band's parts that are not the stream's own (`clear:false`, role loop or
// layer), two distinct phrases at most (their repeats included). Nothing else is type.
export const RIVER_PHRASES = 2;
const streamPart = p => p?.clear === false || /^(loop|layer|stream)$/.test(p?.role ?? '');

export function buildScreens(plan, {table} = {}) {
  const screens = [], drop = plan.form === 'drop60', river = plan.form === 'wander', step = stepOf(plan);
  const section = t => (plan.sections || []).find(s => t >= T(plan, s.from * 16) && t < T(plan, s.to * 16))?.name;
  const add = s => { screens.push({k:1, tone:'blue', release:'cut', fx:{}, ...s}); };
  for (const line of (plan.lines || []).filter(l => !river || l.clear)) {
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
  for (const w of (plan.words || []).filter(x => x.line === -1 && (!river || x.clear))) {
    const start = T(plan, w.at);
    add({kind:'answer', voice:'synergy', from:start, to:start + w.steps * step, text:w.display, words:[{text:w.display, start, end:start + w.gate, units:[{chars:[0, w.display.length], start}]}], reveal:'pop', tone:'white', k:1});
  }
  // His stammer: the whole word with the first three letters lit (what he sings) and the rest a
  // ghost, on its own 16th. Where the lady's ladder owns the board (the drop's bar 18) it is heard,
  // not shown.
  const ladderSteps = new Set((plan.lady || []).filter(e => e.role === 'ladder').map(e => Math.floor(e.at / 16)));
  for (const s of river ? [] : plan.stutters || []) {
    if (ladderSteps.has(Math.floor(s.at / 16))) continue;
    const start = T(plan, s.at), word = ((plan.words || []).find(w => w.word === s.word)?.display ?? s.word).split(' ')[0].toUpperCase(), lit = Math.min(3, word.length);
    add({kind:'stammer', voice:'synergy', hold:true, from:start, to:start + step, text:word, fragment:`${word.slice(0, lit)}-`, words:[{text:word, lit, start, end:start + step * .9, units:[{chars:[0, lit], start}]}], reveal:'pop', tone:'white', k:drop ? 2 : 1});
  }
  // The lady.
  for (const e of (plan.lady || []).filter(x => !river || x.clear)) {
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
      add({...base, hold:true, reveal:r < 2 ? 'typewriter' : r < 4 ? 'pop' : 'steady', k, tone:r >= 2 && r < 4 && Math.round(e.at * 2) % 4 >= 2 ? 'white' : 'blue',
        // The fast rungs rock the letters in their sockets (ROCK pitch, up, home, down) instead of moving them
        // a whole row: a row shift carried a word's light across the board's middle and flashed its quarters
        // on a stage-sized board (102 x 45: 16 to 27 of the climax's frames governed down to a fifth).
        fx:{rock:r >= 4 ? ROCK * [0, -1, 0, 1][Math.round(e.at * 2) % 4] : 0, sparkle:r === 7 ? clamp((e.at % 16) / 8) : 0}});
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
  // The band: couplets, exchanges, refrains (bandScreens).
  const band = bandScreens(river ? {...plan, band:(plan.band || []).filter(p => !streamPart(p)), refrains:(plan.refrains || []).filter(p => !streamPart(p)), phrases:(plan.phrases || []).filter(p => !streamPart(p))} : plan);
  // (A river that names its own count, plan.clearMax, breaks the two-phrase rule on purpose: Delve.'s ten.)
  const phrases = [...new Set(band.map(b => b.text))].slice(0, river ? plan.clearMax ?? RIVER_PHRASES : Infinity);
  for (const b of band) if (phrases.includes(b.text)) add(b);
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
  // and the band's arrive half a beat early as read-ahead ghosts, but they never
  // take the board from the lady before their first word is actually sung.
  // Her ladder steps back under the band's line (the couplet drop's "IT'S NOT X." over the build, screen.over):
  // a rung that starts while that screen holds the board stays in the list (screen.under) but does not take
  // the board until that screen is done (activeScreen); then the rung that is sounding shows.
  const ahead = s => s.voice === 'synergy' || s.band, under = [];
  let cur = null;
  for (const next of screens) {
    if (cur?.over && next.kind === 'ladder' && next.from < cur.to - 1e-9) { next.under = true; under.push(next); continue; }
    if (cur) {
      // A ladder hit holds the board until the next one: the letters stay lit between retriggers instead
      // of blinking at the retrigger rate. So does a band line until its next repeat (a refrain, the drop's X).
      if (cur.kind === 'ladder' && next.kind === 'ladder') cur.to = next.from;
      // (A band line's repeat keeps its words lit, sung or not: it re-pops them as they come round again.)
      else if (cur.band && next.band && cur.text === next.text && next.from - cur.to < 16 * step) { cur.to = next.from; next.relit = true; }
      if (ahead(next) && !ahead(cur)) next.from = Math.max(next.from, Math.min(cur.to, next.words[0].start));
      cur.to = Math.min(cur.to, next.from);
    }
    cur = next;
  }
  for (const u of under) {
    const next = screens.find(x => x.from > u.from + 1e-9 && x !== u);
    if (next) u.to = next.kind === 'ladder' ? next.from : Math.min(u.to, next.from);
  }
  // A couplet another screen interrupts (Synergy's next line, her punct, a rung or a stab between X and Y):
  // its strike moves up so the struck X holds STRIKE.min before the board turns (strikeAt, the turn as its
  // Y), and a Y sung after the turn gets a screen of its own, as a Y a bar away does (bandScreens two()).
  for (const s of [...screens]) {
    const st = s.fx?.strike;
    if (!st || s.over || s.under) continue;
    const x = s.words.filter(w => !w.part), y = s.words.filter(w => w.part === 1);
    if (st.at + STRIKE.min > s.to + 1e-9) {
      // (On the grid still: else the latest 16th from X's last word on that leaves STRIKE.min.)
      const a = strikeAt(plan, x, s.to), tm = plan.timing || [], last = x.at(-1).start + 2 * FRAME;
      const g = a + STRIKE.min <= s.to + 1e-9 && tm.some(v => Math.abs(v - a) < 1e-9) ? a : tm.filter(v => v >= last - 1e-9 && v + STRIKE.min <= s.to + 1e-9).at(-1);
      st.at = g ?? a;
    }
    if (!y.length || y[0].start < s.to - 1e-9) continue;
    Object.assign(s, {words:x, parts:[s.parts[0]], text:x.map(w => w.text).join(' '), fill:false});
    const p = {...s.parts[1], first:0}, ys = {...s, kind:`${s.kind}-y`, voice:p.voice, tone:p.tone, parts:[p], words:y.map(w => ({...w, part:0})),
      text:y.map(w => w.text).join(' '), from:Math.max(s.to, y[0].start - BEAT * .5), to:y.at(-1).end + 4 * step, fx:{}, relit:false};
    const prev = screens.filter(o => !o.under && o !== s && o.from <= ys.from + 1e-9 && ys.from < o.to).at(-1);
    if (prev && !ahead(prev)) ys.from = Math.max(ys.from, Math.min(prev.to, y[0].start));
    if (prev) prev.to = Math.min(prev.to, ys.from);
    const next = screens.filter(o => !o.under && o.from > ys.from + 1e-9).sort((a, b) => a.from - b.from)[0];
    if (next) ys.to = Math.min(ys.to, next.from);
    screens.push(ys);
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
  const state = {sockets:1, exposure:1, bloom:1, ignite:-1, build:1};
  if (plan.form !== 'drop60') {
    state.sockets = clamp(t / BEAT);
    return state;
  }
  const m = marksOf(plan), choke = T(plan, plan.choke.at), sinkFrom = T(plan, m.sink), sinkTo = T(plan, m.sinkEnd);
  const build = T(plan, m.build), rise = T(plan, m.rise), dark = darkAt(plan), lit = igniteAt(plan);
  state.sockets = clamp(t / BEAT);                                        // power on over 1 beat
  if (t >= build && t < rise) state.exposure = .55;                       // the build starts dim
  else if (t >= rise && t < choke) state.exposure = .55 + .45 * clamp((t - rise) / (choke - rise));
  state.build = state.exposure;                                           // (a screen that holds leaves it out: paint)
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
// pitch (optional): the board's px a peg, so a role tag shows only where PEG-3 reads (TAG_MIN_PITCH).
export function paint(board, screens, t, {plan, layoutOf, place, eq, reduced = false, pitch = 0} = {}) {
  clearBoard(board);
  // A ghost screen (the loop seam's BACK., screen.ghost its intensity): only its letters, flat, on
  // true black, on the same pegs as the screen it copies.
  const ghost = activeScreen(screens, t);
  if (ghost?.ghost) { board.sockets = 0; drawScreen(board, ghost, t, {layoutOf, place, reduced, igniting:false, pitch}); return board; }
  const state = plan ? boardState(plan, t) : {sockets:1, exposure:1, bloom:1, ignite:-1, build:1};
  board.sockets = state.sockets; board.exposure = state.exposure; board.bloom = state.bloom;
  if (state.exposure <= 0) return board;
  const screen = activeScreen(screens, t);
  // The build dims the board, not the words being sung: under a screen that holds (her ladder, a stutter,
  // the band), the board's exposure leaves out the build's dim and the sockets and everything that is not
  // type (the chart, psych imagery: board.ambient) take it instead, so they look exactly as dim as before.
  if (screen?.hold && state.build < 1) { board.exposure = state.exposure / state.build; board.sockets *= state.build; board.ambient = state.build; }
  if (eq) eq(board, t, screen);
  if (board.ambient < 1) for (let i = 0; i < board.I.length; i++) board.I[i] *= board.ambient;
  if (state.ignite >= 0) ignite(board, state.ignite);
  if (screen) drawScreen(board, screen, t, {layoutOf, place, reduced, igniting:state.ignite >= 0, pitch});
  return board;
}

export function activeScreen(screens, t) {
  let lo = 0, hi = screens.length - 1, found = null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (screens[mid].from <= t) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  if (found === null) return null;
  // A rung under a band line (screen.under) shows only once the line has let go of the board.
  let low = null;
  for (let i = found; i >= 0; i--) {
    const s = screens[i];
    if (s.under) { low ??= s; continue; }
    if (t < s.to + releaseTime(s)) return s;
    break;
  }
  return low && t < low.to + releaseTime(low) ? low : null;
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

function drawScreen(board, screen, t, {layoutOf, place, reduced, igniting, pitch = 0}) {
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
  // Her vocabulary's treatments (Delve.): the screen's light follows a curve (dim), the bloom swells (bloom),
  // copies of the sung words in harmony (harmony), the letters wobble on the tape (wobble), grain eats them
  // (grain), the last words sink (sink). Each is data on the screen; none moves a peg's light in one frame
  // except as the words themselves light.
  const fxv = screen.fx, dim = fxv.dim ? curveAt(fxv.dim, t) : 1;
  if (fxv.bloom) board.bloom = Math.max(board.bloom, curveAt(fxv.bloom, t));
  const harmony = (fxv.harmony || []).filter(h => t >= (h.from ?? -Infinity) && t < (h.to ?? Infinity));
  const wob = fxv.wobble && t >= (fxv.wobble.from ?? -Infinity) && t < (fxv.wobble.to ?? Infinity) ? fxv.wobble : null;
  const grain = fxv.grain && t >= (fxv.grain.from ?? -Infinity) ? fxv.grain : null, grainTick = grain ? Math.floor(t * (grain.rate ?? 8)) : 0;
  const sink = fxv.sink ?? null;
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
    // The band: a part after the first is dark until it is sung (Y never lands early); then its words
    // read ahead and light as they are sung, in the voice's tone (bandLight).
    const part = screen.band ? screen.parts[word.part] : null;
    if (part && word.part > 0 && t < part.start - FRAME * .5) continue;
    // A fragment's word (a stutter): fully lit, its sounding letters accented (fragmentLight).
    const frag = word.lit !== undefined, sounding = frag && charInWord < word.lit;
    for (let i = 0; i < n; i++) {
      const px = pegs[2 * i], py = pegs[2 * i + 1], x = origin.x + px, y = origin.y + py + (screen.fx.rowShift || 0);
      if (screen.ghost) { light(board, x, y, screen.ghost * fade, {tone}); continue; }
      let I, white = 0, size = 1, dx = 0, dy = 0, peg = tone;
      if (frag) ({I, white, size} = fragmentLight(screen, word, unit, {x, y, i, n, row:py - (ch.y || 0), rows:ch.h || rows}, t, ctx, sounding, reduced));
      else if (part) { ({I, white, size} = bandLight(screen, word, unit, {x, y, i, n, row:py - (ch.y || 0), rows:ch.h || rows}, t, ctx, reduced)); peg = PALETTE[part.tone]?.id ?? tone; }
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
      if (screen.fx.rock && !reduced) dy += screen.fx.rock;
      let yy = y;
      if (sink && ch.word >= sink.word && t >= word.start) { yy += Math.min(sink.max ?? 12, Math.floor((t - word.start) * (sink.rate ?? 1))); peg = PALETTE[sink.tone ?? 'deep']?.id ?? peg; }
      if (wob && !reduced) dx += (wob.amount ?? .35) * Math.sin(2 * Math.PI * (t * (wob.rate ?? .9) + (y - origin.y) * .045));
      if (grain && word.start <= t && ch.word >= (grain.word ?? 0) && hash2(x, y, grainTick + 101) < (grain.amount ?? .25)) I *= .3;
      I *= dim;
      light(board, x, yy, I * fade, {tone:peg, white, size, dx, dy});
      // (Harmony copies: the sung words again, offset, in their own tone, under the words: light keeps the brighter.)
      for (const h of harmony) if (I > READ_AHEAD + 1e-6 || frag) light(board, x + (h.dx ?? 0), yy + (h.dy ?? 0), Math.min(I, 1) * (h.I ?? .45) * fade, {tone:PALETTE[h.tone ?? 'blue']?.id ?? tone, dx:0, dy:0});
    }
    // Drop words wear a 1-peg outline of dark pegs, so the ignition never swallows them.
    if (screen.fx.outline || igniting) outline(board, ch, origin);
  }
  if (screen.fx.strike) drawStrike(board, screen, layout, page, origin, t, fade, reduced);
  if (fxv.echo?.length) drawEchoes(board, screen, page, origin, t, fade * dim, {layoutOf, reduced});
  if (screen.parts && pitch >= TAG_MIN_PITCH) drawTags(board, screen, layout, page, origin, t, fade);
}

// A piecewise-linear curve [[t, v], ...] at t (the ends hold).
export function curveAt(c, t) {
  if (!c?.length) return 1;
  if (t <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (t <= c[i][0]) { const [a, x] = c[i - 1], [b, y] = c[i]; return b > a ? x + (y - x) * (t - a) / (b - a) : y; }
  return c.at(-1)[1];
}

// Her echoes as ghosts of the words they repeat (Delve.: delay, reverb, pitch down, echo to fade). A ghost is
// {word, at, end, I, dx?, dy? (rows from the word's top) | below? (rows under the word's bottom), k?, font?, tone?,
// fall?:[[t, rows], ...]}: from its tap's onset it shows the word again (at its own size, centred on the word,
// offset), at I, and only loses light until `end`; a fall moves it down whole rows at its taps (each later tap
// one more row). The words themselves always win (light keeps the brighter peg). Only words on the page shown.
const ghostLayouts = new WeakMap();
function drawEchoes(board, screen, page, origin, t, fade, {layoutOf}) {
  for (const e of screen.fx.echo) {
    if (t < e.at - FRAME * .5 || t >= e.end) continue;
    const chars = page.lines.flatMap(l => l.chars).filter(c => c.word === e.word);
    if (!chars.length) continue;
    const x0 = Math.min(...chars.map(c => c.x)), x1 = Math.max(...chars.map(c => c.x + c.w)), y0 = Math.min(...chars.map(c => c.y)), y1 = Math.max(...chars.map(c => c.y + (c.h || 9)));
    let g = ghostLayouts.get(e);
    if (!g) { g = {text:e.text ?? screen.words[e.word]?.text ?? '', font:e.font ?? screen.font ?? 'peg9', k:e.k ?? screen.k ?? 1, lines:1, ghostOf:screen}; ghostLayouts.set(e, g); }
    const layout = layoutOf(g), gp = layout?.pages?.[0];
    if (!gp) continue;
    const gw = layout.width, rows = e.fall ? e.fall.filter(([ft]) => t >= ft - FRAME * .5).reduce((s, [, r]) => s + r, 0) : 0;
    const gx = origin.x + Math.round((x0 + x1) / 2 - gw / 2) + (e.dx ?? 0);
    const gy = origin.y + (e.below !== undefined ? y1 + e.below : y0 + (e.dy ?? 0)) + rows;
    const life = clamp((t - e.at) / Math.max(FRAME, e.end - e.at)), I = (e.I ?? .4) * (1 - life) ** .7 * fade;
    if (I <= .02) continue;
    const tn = PALETTE[e.tone ?? screen.tone]?.id ?? 0;
    for (const line of gp.lines) for (const ch of line.chars) { const p = ch.pegs; for (let i = 0; i < p.length; i += 2) light(board, gx + p[i], gy + p[i + 1], I, {tone:tn}); }
  }
}

// A band word's light: the read-ahead ghost until it is sung, then full (1) from its onset to the screen's
// end. It pops in size only (the peg springs to 1.25 and settles), never in light: a band screen's light
// only rises until it ends, so its words make no flash of their own at any size of board (a k 2 refrain's
// white-hot pops flashed the 9:16 home 3.5 times a second).
function bandLight(screen, word, unit, peg, t, ctx, reduced) {
  if (t < unit.start - FRAME * .5) return {I:screen.relit ? FRAGMENT_FULL : READ_AHEAD, white:0, size:1};
  if (reduced) return {I:Math.max(READ_AHEAD, clamp((t - unit.start) / .2)), white:0, size:1};
  const age = Math.max(0, t - unit.start);
  return {I:FRAGMENT_FULL, white:0, size:1 + .25 * Math.exp(-age * 9) * Math.cos(age * 2 * Math.PI * 6)};
}

// The strike: a bar of pegs (h, strikeWeight: STRIKE.weight's rows a k, centred on the caps, half a peg high
// where the rows cannot split evenly) through X's struck words on each line they sit on, k pegs past each end, drawn
// left to right over STRIKE.draw from its beat, in signal, at full over the letters (they stay lit under
// it). A peg springs as the stroke reaches it; its light never pops.
const CAP_ROWS = {peg9:9, peg5:7, peg3:5};
const TRAILING = /[.,!?;:…'"\u2013-]/;
export function strikeRows(screen, layout, page, origin) {
  const st = screen.fx.strike, k = layout.k || 1, cap = (CAP_ROWS[layout.font] ?? 9) * k, h = strikeWeight(layout.font, k), struck = new Set(st.words), out = [];
  for (const line of page.lines) {
    const chars = line.chars.filter(c => struck.has(c.word));
    while (chars.length && TRAILING.test(chars.at(-1).ch)) chars.pop();
    if (!chars.length) continue;
    out.push({x0:origin.x + chars[0].x - k, x1:origin.x + chars.at(-1).x + chars.at(-1).w - 1 + k, y0:origin.y + line.y + Math.floor((cap - h) / 2), h, k});
  }
  return out;
}
function drawStrike(board, screen, layout, page, origin, t, fade, reduced) {
  const st = screen.fx.strike, since = t - st.at, tone = PALETTE[st.tone]?.id ?? PALETTE.signal.id;
  if (since < -FRAME * .5) return;
  for (const {x0, x1, y0, h} of strikeRows(screen, layout, page, origin)) for (let x = x0; x <= x1; x++) {
    const age = since - (x - x0) / Math.max(1, x1 - x0) * st.draw;
    if (age < -FRAME * .5) continue;
    const size = reduced ? 1 : 1 + .2 * Math.exp(-Math.max(0, age) * 14);
    for (let r = 0; r < h; r++) {
      const y = y0 + r;
      if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) continue;
      const j = y * board.cols + x;
      board.I[j] = Math.max(board.I[j], 1) * fade; board.tone[j] = tone; board.white[j] = 0; board.size[j] = size; board.dx[j] = 0; board.dy[j] = 0;
    }
  }
}

// A part's role tag in PEG-3 (STRATEGY, SYNTHIA), from when it is sung: over the first part's first line,
// under the second part's last line, at the line's left edge, only inside the room the screen was centred
// in and only on pegs nothing else lit. At pitch TAG_MIN_PITCH and up (paint's pitch); never the lady.
let TAG_FONT = null;
const TAG_CACHE = new Map();
function tagGlyphs(text) {
  TAG_FONT ||= compileFont(PEG3);
  if (!TAG_CACHE.has(text)) { const l = layoutText(text, {font:TAG_FONT, k:1, maxLines:1}); TAG_CACHE.set(text, {w:l.width, h:TAG_FONT.rows, pegs:l.pages[0]?.lines[0]?.chars.flatMap(c => [...c.pegs]) ?? []}); }
  return TAG_CACHE.get(text);
}
export const TAG_LIGHT = .7;
function drawTags(board, screen, layout, page, origin, t, fade) {
  const k = layout.k || 1, cap = (CAP_ROWS[layout.font] ?? 9) * k, bottom = page.lines.length ? Math.max(...page.lines.map(l => l.y)) + layout.k * ((CAP_ROWS[layout.font] ?? 9) + (layout.font === 'peg5' ? 1 : 2)) : layout.height;
  const room = 2 * origin.y + bottom;
  screen.parts.forEach((part, n) => {
    if (!part.tag || t < part.start - FRAME * .5) return;
    const lines = page.lines.filter(l => l.chars.some(c => screen.words[c.word]?.part === n));
    if (!lines.length) return;
    const g = tagGlyphs(part.tag), line = n === 0 ? lines[0] : lines.at(-1), x = origin.x + line.x;
    const y = n === 0 ? origin.y + line.y - 2 - g.h : origin.y + line.y + cap + 2 * k + 1;
    if (y < 0 || y + g.h > Math.min(board.rows, room) || x + g.w > board.cols) return;
    for (let i = 0; i < g.pegs.length; i += 2) if (board.I[(y + g.pegs[i + 1]) * board.cols + x + g.pegs[i]] > 0) return;
    for (let i = 0; i < g.pegs.length; i += 2) light(board, x + g.pegs[i], y + g.pegs[i + 1], TAG_LIGHT * fade, {tone:PALETTE.blue.id});
  });
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
