// Pixel Text export: an All Hands take becomes a project for Aaron's LinkedIn
// Beats Pixel Text editor (dot-matrix words, MP4 export), with every word lit
// on its sung onset. Pure ES module: no DOM, no Web Audio.
//
// The editor re-validates every project it opens (its bundle's `vs()`). A cue
// whose words fail any check is not rejected: its timings are silently
// replaced by evenly spread fakes (`wi()`), and a cue that is too short or
// overlaps its neighbour is moved. So this module only emits projects the
// editor keeps verbatim: text normalised exactly like its `Br()` and limited
// to the glyphs its bitmap font (`ju`) can draw; cues sorted, never
// overlapping, at least 50 ms long, at most 100 characters and 80 per scene;
// every word inside its cue and after the previous one. `assertEditorSafe()`
// re-checks all of that against the editor's own expressions.
import {stepTime, STEP, BPM, HOST} from './song.js';
import {LADY_TABLE} from './lady-table.js';

export const PIXEL_KIND = 'linkedin-beats-pixel-text';
export const PIXEL_LIMITS = Object.freeze({
  cues:80, chars:100, title:80, audioName:160, duration:[1, 120], bpm:[40, 240], audioOffset:[0, 300],
  cueSeconds:.05, fileBytes:42 * 1024 * 1024, audioBytes:30 * 1024 * 1024, audioSeconds:300, fps:30,
});
export const PIXEL_STYLES = ['spotlight', 'assembly', 'pulse', 'echo', 'stutter', 'drop'];
export const PIXEL_FORMATS = {landscape:[1920, 1080], portrait:[1080, 1920], square:[1080, 1080]};
// The bitmap font's characters (bundle `const ju = {...}` plus ju["("], ju[")"]).
// Anything else renders as "?"; space is a gap, not a glyph.
export const PIXEL_GLYPHS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'!?.,-:/&+\"()");
// engine.js RENDER_OFFSET: an offline render starts 50 ms before the downbeat.
export const RENDER_OFFSET = .05;
// How a cue looks, by what is being sung. A hook alternates its first two.
export const STYLE_BY_KIND = {
  verse:'spotlight', host:'spotlight', hook:['assembly', 'pulse'], repeat:'echo', answer:'pulse', stammer:'stutter',
  ladder:'stutter', tag:'stutter', impact:'drop', sink:'drop', stop:'drop', punct:'echo', lady:'echo', extra:'spotlight',
};
// When two voices start together, the higher one owns the screen.
const PRIORITY = {stammer:3, ladder:2, tag:2, impact:2, sink:2, stop:2, punct:2, lady:2, extra:2};

const DEFAULTS = {dotSize:.64, glow:.6, scale:.9, blue:'#2674ff', white:'#f2f8ff', unlit:true, equalizer:false, reducedMotion:false, subdivision:4, includeAudio:true};
const TICK = 1e4;                                   // times are kept on a 0.1 ms grid
const q = x => Math.round(x * TICK) / TICK;
const MIN_CUE = PIXEL_LIMITS.cueSeconds + 1 / TICK; // strictly above the editor's 50 ms floor after rounding
const clampTo = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------- text

// The editor's Br() (bundle: `Br=t=>String(t??"").normalize("NFKD")...`)
// without its final `.slice(0, 100)`: where a long line breaks is decided here.
export function editorText(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').toUpperCase().replace(/\s+/g, ' ').trim();
}
export const Br = value => editorText(value).slice(0, PIXEL_LIMITS.chars);

// Letters NFKD leaves alone, spelled with glyphs the font has.
const LETTERS = {'Ø':'O', 'Æ':'AE', 'Œ':'OE', 'Ł':'L', 'Đ':'D', 'Ð':'D', 'Þ':'TH', 'Ŋ':'NG', 'Ħ':'H', 'Ŧ':'T', 'Ɨ':'I', 'ẞ':'SS', 'ı':'I', 'ĸ':'K', 'ſ':'S'};
// Symbols with a readable stand-in. Everything else without a glyph is removed.
const SYMBOLS = [
  [/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, ' '],
  [/[\u2018\u2019\u201A\u201B\u2032\u2035\u02B9\u02BC`\u00B4]/g, "'"],
  [/[\u201C-\u201F\u2033\u2036\u00AB\u00BB\u301D\u301E]/g, '"'],
  [/[\p{Pd}\u2212~]/gu, '-'],
  [/%/g, ' PERCENT '], [/\$/g, ' USD '], [/€/g, ' EUR '], [/£/g, ' GBP '],
  [/(^|\s)[@#]+/g, '$1'], [/#/g, ''], [/@/g, ' AT '], [/=/g, ' EQUALS '], [/±/g, '+/-'], [/×/g, 'X'], [/÷/g, '/'],
  [/[[{]/g, '('], [/[\]}]/g, ')'], [/;/g, ','], [/[|\\]/g, '/'], [/[_·•]/g, ' '],
];

// Text the editor stores unchanged (Br(x) === x) and draws without a "?".
export function pixelText(value) {
  let s = editorText(value);
  for (const [pattern, to] of SYMBOLS) s = s.replace(pattern, to);
  s = [...s].map(c => LETTERS[c] ?? c).join('').toUpperCase();
  return [...s].filter(c => c === ' ' || PIXEL_GLYPHS.has(c)).join('').replace(/\s+/g, ' ').trim();
}
export const missingGlyphs = text => [...new Set([...String(text)].filter(c => c !== ' ' && !PIXEL_GLYPHS.has(c)))];

// The editor's wi(): words spread over a span by length. Used only for cues
// that arrive without timings; the editor would do the same.
export function spreadWords(text, start, end) {
  const words = editorText(text).split(' ').filter(Boolean), total = words.reduce((n, w) => n + Math.max(2, w.length), 0);
  let at = start;
  return words.map((w, i) => { const s = at; at += Math.max(2, w.length) / total * (end - start); return {text:w, start:s, end:i === words.length - 1 ? end : at}; });
}

// One sung word may become several shown words ("50%" → "50 PERCENT") or none
// (an emoji). Its span is shared equally, so the onset never moves.
function pixelWords(word, warn) {
  const parts = pixelText(word.text).split(' ').filter(Boolean).map(p => p.slice(0, PIXEL_LIMITS.chars));
  if (!parts.length) { warn(`"${word.text}" has no drawable characters; dropped.`); return []; }
  const span = (word.end - word.start) / parts.length;
  return parts.map((text, i) => ({text, start:q(word.start + i * span), end:i === parts.length - 1 ? word.end : q(word.start + (i + 1) * span)}));
}

// ---------------------------------------------------------------- timing

// Seconds in the render for a (possibly fractional) 16th: the plan's own
// swing-aware table when it has one, else song.js stepTime(). Same rule as
// engine.js: T(floor(at)) + fraction · STEP.
// A plan's 16th: its own (song book tracks have their own tempo), else from its BPM.
export const stepOfPlan = (plan = {}) => plan.step ?? (plan.bpm ? 15 / plan.bpm : STEP);
export function planTimeOf(plan = {}, renderOffset = plan.offset ?? RENDER_OFFSET) {
  const table = plan.timing && plan.timing.length ? plan.timing : null, step = stepOfPlan(plan);
  return at => {
    const whole = Math.floor(at), base = table ? table[Math.min(whole, table.length - 1)] : stepTime(whole);
    return base + (at - whole) * step + renderOffset;
  };
}

// The lady's words, timed from the recording itself: the table's word
// boundaries (seconds in her file) through the event's cut and playback rate.
// Render JSON events carry only `start`/`length`; their words are placed by
// the same boundaries, scaled to the length that was heard.
export function ladyCueSources(events = [], {timeOf, table = LADY_TABLE, styles = STYLE_BY_KIND} = {}) {
  const sources = [];
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const kind = e.role || 'lady', t0 = timeOf ? timeOf(e.at) : e.start;
    if (!Number.isFinite(t0) || !e.display) continue;
    const shown = editorWords(e.display), entry = table?.[e.file];
    let length, spans;
    if (Number.isFinite(e.from) && Number.isFinite(e.to) && e.rate > 0) {
      length = Math.min(e.gate ?? Infinity, (e.to - e.from) / e.rate + .01);
      const inside = entry ? entry.words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6) : [];
      if (inside.length === shown.length) spans = inside.map(w => [(Math.max(w.start, e.from) - e.from) / e.rate, (Math.min(w.end, e.to) - e.from) / e.rate]);
    } else length = e.length ?? e.gate;
    if (!(length > 0)) continue;
    if (!spans && entry) {
      const run = matchRun(entry.words, shown);
      if (run) { const base = run[0].start, total = run.at(-1).end - base; spans = run.map(w => [(w.start - base) / total * length, (w.end - base) / total * length]); }
    }
    const words = spans
      ? shown.map((text, i) => ({text, start:t0 + clampTo(spans[i][0], 0, length), end:t0 + clampTo(spans[i][1], 0, length)}))
      : spreadWords(shown.join(' '), t0, t0 + length);
    const group = kind === 'ladder' ? `ladder-${e.rung ?? Math.floor(e.at / 16)}` : null;
    const last = sources.at(-1);
    if (group && last?.group === group) last.words.push(...words);
    else sources.push({kind, group, style:styleOf(styles, kind, 0), priority:PRIORITY[kind] ?? 2, words});
  }
  return sources;
}
const editorWords = text => editorText(text).split(' ').filter(Boolean);
const letters = s => editorText(s).replace(/[^A-Z0-9]/g, '');
function matchRun(words, shown) {
  const want = shown.map(letters);
  if (!want.length || want.some(w => !w)) return null;
  for (let i = 0; i + want.length <= words.length; i++) if (want.every((w, k) => letters(words[i + k].text).startsWith(w))) return words.slice(i, i + want.length);
  return null;
}
const styleOf = (styles, kind, n) => { const s = styles[kind] ?? STYLE_BY_KIND[kind] ?? 'spotlight'; return Array.isArray(s) ? s[n % s.length] : s; };

// ---------------------------------------------------------------- plan → cues

// Words of a plan line, from arrange() objects or the render JSON's arrays
// ([display, at, steps, rate, notes, gate?]).
const wordOf = w => Array.isArray(w) ? {display:w[0], at:w[1], steps:w[2], rate:w[3], gate:w[5]} : w;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && editorText(a).replace(/[.!?]+$/, '') === editorText(b).replace(/[.!?]+$/, '');

// What the listener hears when: the drop's tape effects re-time the whole mix
// (engine.js tapeEvent). "sink" slows 1 → 0.5 over its span (delay .25·t²/D),
// so input at p is heard at 2D(1 − √(1 − p/D)) and input past .75·D is never
// heard; "stop" slows to 0 over S (delay t²/2S): input past S/2 is silence.
// Returns seconds → heard seconds, or NaN for a moment nobody hears.
export function tapeWarp(tapes = [], timeOf) {
  const spans = tapes.map(t => { const s = timeOf(t.from); return {kind:t.kind, s, D:t.kind === 'sink' ? timeOf(t.to) - s : t.seconds}; })
    .filter(x => x.D > 0);
  return (x, edge = 'start') => {
    for (const {kind, s, D} of spans) {
      const p = x - s;
      if (p <= 0 || (kind === 'sink' && p >= D)) continue;
      const reach = kind === 'sink' ? .75 * D : .5 * D;
      if (p > reach) return edge === 'end' ? s + D : NaN;
      return s + (kind === 'sink' ? 2 * D * (1 - Math.sqrt(1 - p / D)) : D * (1 - Math.sqrt(1 - 2 * p / D)));
    }
    return x;
  };
}

// Every voice in a plan as timed cue sources, before layout: what is heard,
// when it is heard (tape-warped), and nothing from inside the choke but the
// tag, which is routed after it.
export function planCueSources(plan, timeOf = planTimeOf(plan), {lyrics, styles = STYLE_BY_KIND, durations, stutters = true, lady = true, ladyTable = LADY_TABLE, onWarning} = {}) {
  const lines = plan.lines || [], sources = [], STEP = stepOfPlan(plan);
  const counts = new Map(lines.map(l => [l.text, 0]));
  lines.forEach(l => counts.set(l.text, counts.get(l.text) + 1));
  const repeated = [...counts].sort((a, b) => b[1] - a[1])[0];
  const hookText = lyrics?.hook ?? (repeated && repeated[1] > 1 ? repeated[0] : null);
  const kindOf = l => l.kind || (same(l.text, hookText) ? 'hook' : same(l.text, HOST.open) || same(l.text, HOST.close) ? 'host' : 'verse');
  const timed = w => {
    const start = timeOf(w.at), slot = w.steps * STEP, spoken = durations && w.word && durations[w.word] ? durations[w.word] / (w.rate || 1) : Infinity;
    return {text:w.display, start, end:start + Math.min(w.gate ?? slot, slot, spoken)};
  };
  let hooks = 0;
  const lineIds = new Set();
  for (const line of lines) {
    lineIds.add(line.id);
    const kind = kindOf(line), words = line.words.map(wordOf);
    // A short hook is sung twice in its slot; the answer is the echo.
    const half = words.length / 2, twice = kind === 'hook' && words.length > 1 && (words.some(w => w.repeat)
      || (Number.isInteger(half) && words.slice(0, half).every((w, i) => w.display === words[half + i].display)));
    const split = twice ? (words.some(w => w.repeat) ? words.findIndex(w => w.repeat) : half) : words.length;
    const style = styleOf(styles, kind, kind === 'hook' ? hooks++ : 0);
    sources.push({kind, style, priority:PRIORITY[kind] ?? 1, words:words.slice(0, split).map(timed)});
    if (split < words.length) sources.push({kind:'repeat', style:styleOf(styles, 'repeat', 0), priority:1, words:words.slice(split).map(timed)});
  }
  // Words sung outside any line (Synergy's answers in the drop's build).
  for (const w of plan.words || []) if (w.line === -1 || (w.line !== undefined && !lineIds.has(w.line))) {
    sources.push({kind:w.kind || 'answer', style:styleOf(styles, w.kind || 'answer', 0), priority:1, words:[timed(w)]});
  }
  // Synergy's stammer: the page shows the word's first three letters and a dash.
  if (stutters && plan.stutters?.length) {
    let run = null;
    for (const s of [...plan.stutters].sort((a, b) => a.at - b.at)) {
      const start = timeOf(s.at), word = {text:s.word.split(' ')[0].slice(0, 3).toUpperCase() + '–', start, end:start + (s.steps || 1) * STEP};
      if (run && Math.floor(s.at / 16) === run.bar) run.words.push(word);
      else sources.push(run = {kind:'stammer', style:styleOf(styles, 'stammer', 0), priority:PRIORITY.stammer, bar:Math.floor(s.at / 16), words:[word]});
    }
  }
  if (lady && plan.lady?.length) sources.push(...ladyCueSources(plan.lady, {timeOf, table:ladyTable, styles}));

  const heard = tapeWarp(plan.tape, timeOf);
  const shift = timeOf(0) - (plan.timing?.[0] ?? 0);
  const choke = plan.choke ? (Number.isFinite(plan.choke.at) ? [timeOf(plan.choke.at), timeOf(plan.choke.until)] : [plan.choke.start + shift, plan.choke.end + shift]) : null;
  // "Full stop." is routed after the tape (engine.js playLady): she stops it; it does not stop her.
  const untaped = new Set(['stop']);
  for (const src of sources) src.words = src.words.flatMap(w => {
    let start = untaped.has(src.kind) ? w.start : heard(w.start, 'start'), end = untaped.has(src.kind) ? w.end : heard(w.end, 'end');
    if (choke && src.kind !== 'tag' && end > choke[0] && start < choke[1]) {
      if (start >= choke[0]) { onWarning?.(`"${w.text}" falls in the choke at ${start.toFixed(2)} s; nobody hears it.`); return []; }
      end = choke[0];
    }
    if (!Number.isFinite(start)) { onWarning?.(`"${w.text}" at ${w.start.toFixed(2)} s is swallowed by the tape stop; nobody hears it.`); return []; }
    return [{text:w.text, start, end}];
  });
  return sources.filter(s => s.words.length);
}

// An All Hands plan (arrange()/arrangeDrop(), or a render JSON's `plan`) as
// editor-ready cues. timeOf(step) → seconds; by default the plan's timing
// plus renderOffset (0.05 s: renders start 50 ms in). options.extra adds cue
// sources such as the lady's drop events: [{text, start, end, style, words}].
export function planToCues(plan, timeOf, options = {}) {
  const {renderOffset = plan.offset ?? RENDER_OFFSET, extra = [], lyrics, styles, durations, stutters, lady, ladyTable, ...layout} = options;
  const time = timeOf || planTimeOf(plan, renderOffset);
  const sources = [...planCueSources(plan, time, {lyrics, styles, durations, stutters, lady, ladyTable, onWarning:layout.onWarning}), ...extra];
  const duration = layout.duration ?? (Number.isFinite(plan.duration) ? q(plan.duration + renderOffset) : Infinity);
  return layoutCues(sources, {bpm:plan.bpm ?? BPM, ...layout, duration}).cues;
}

// ---------------------------------------------------------------- layout

// Sources (possibly overlapping, unnormalised, too long, too many) → cues the
// editor keeps verbatim. Overlaps follow the page's rule: the most recent
// onset owns the screen; a word still sounding when an interruption ends
// comes back. Returns {cues, warnings}. Idempotent on its own output.
export function layoutCues(sources, options = {}) {
  const {duration = Infinity, clamp = false, hold = .5, bpm = BPM, maxCues = PIXEL_LIMITS.cues, maxChars = PIXEL_LIMITS.chars,
    maxWords = Infinity, minWord = .02, minResume = .1, bridge = .25, compact = true, dropFallback = 'echo', idPrefix = 'cue', onWarning} = options;
  const warnings = [], warn = m => { warnings.push(m); onWarning?.(m); };
  if (!(maxChars >= 1 && maxChars <= PIXEL_LIMITS.chars)) throw RangeError(`maxChars must be 1–${PIXEL_LIMITS.chars}.`);
  if (!(maxCues >= 1 && maxCues <= PIXEL_LIMITS.cues)) throw RangeError(`maxCues must be 1–${PIXEL_LIMITS.cues}.`);
  const dropLead = Math.min(.3, 60 / bpm * .5);      // the editor keeps a "drop" cue dark this long first
  const end = Number.isFinite(duration) ? duration : Infinity;
  const textOf = words => words.map(w => w.text).join(' ');
  const fits = words => textOf(words).length <= maxChars && words.length <= maxWords;
  const longEnough = d => d.end >= d.start + PIXEL_LIMITS.cueSeconds;   // the editor's own test

  // 1. Normalise every source's words; keep each source's words in order.
  const prepared = [];
  (sources || []).forEach((src, order) => {
    if (!src) return;
    let style = src.style;
    if (!PIXEL_STYLES.includes(style)) { if (style !== undefined) warn(`Unknown style "${style}"; using spotlight.`); style = 'spotlight'; }
    const timed = Array.isArray(src.words) && src.words.length > 0;
    if (!timed && !(Number.isFinite(src.start) && src.end > src.start)) { if (src.text) warn(`"${src.text}" has neither words nor a span; skipped.`); return; }
    if (!timed) warn(`"${src.text}" has no word timings; spread like the editor would.`);
    let words = (timed ? src.words : spreadWords(pixelText(src.text), src.start, src.end))
      .filter(w => w && Number.isFinite(w.start) && Number.isFinite(w.end))
      .map(w => ({text:w.text, start:q(w.start), end:q(w.end)})).sort((a, b) => a.start - b.start)
      .flatMap(w => pixelWords(w, warn));
    if (timed && src.text !== undefined && pixelText(src.text) !== textOf(words)) warn(`"${src.text}": its words say "${textOf(words)}"; the words win.`);
    words = words.flatMap((w, i) => {
      let start = w.start, stop = w.end;
      if (i + 1 < words.length) stop = Math.min(stop, words[i + 1].start);
      if (start < 0) { warn(`"${w.text}" starts before 0 s; clipped.`); start = 0; }
      if (stop > end + 1e-9) {
        if (!clamp) throw RangeError(`"${w.text}" ends at ${stop.toFixed(3)} s, after the ${end} s scene. Lengthen the scene or pass clamp:true.`);
        stop = end;
      }
      if (stop - start < minWord) { warn(`"${w.text}" at ${w.start.toFixed(2)} s is shorter than ${minWord * 1000} ms; dropped.`); return []; }
      return [{text:w.text, start, end:stop}];
    });
    // Short gaps inside one voice stay that voice's (no flicker of another).
    words.forEach((w, i) => { const next = words[i + 1]; w.hold = next && next.start - w.end <= bridge ? next.start : w.end; });
    if (words.length) prepared.push({kind:src.kind || 'extra', style, priority:src.priority ?? PRIORITY[src.kind] ?? (src.kind ? 1 : 2), order,
      start:Number.isFinite(src.start) ? q(src.start) : undefined, end:Number.isFinite(src.end) ? q(src.end) : undefined, words});
  });

  // 2. Paint the timeline: between two boundaries, the sounding word with the
  //    latest onset shows (ties: higher priority, then the earlier source).
  const all = prepared.flatMap(src => src.words.map(w => ({...w, src})));
  const cuts = [...new Set(all.flatMap(w => [w.start, w.end, w.hold]))].sort((a, b) => a - b), frags = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1];
    let owner = null;
    for (const w of all) if (w.start <= a && w.hold >= b && (!owner || w.start > owner.start
      || (w.start === owner.start && (w.src.priority > owner.src.priority || (w.src.priority === owner.src.priority && w.src.order < owner.src.order))))) owner = w;
    if (!owner || a >= owner.end) continue;           // nobody, or a held gap: dark
    const last = frags.at(-1);
    if (last && last.word === owner && last.end === a) last.end = b; else frags.push({word:owner, start:a, end:b});
  }
  const kept = frags.filter(f => f.end - f.start >= (f.start > f.word.start ? minResume : minWord)), seen = new Set(kept.map(f => f.word));
  for (const w of all) if (!seen.has(w)) warn(`"${w.text}" at ${w.start.toFixed(2)} s is covered by another voice; dropped.`);

  // 3. Consecutive fragments of one source form a cue; 4. lines over 100
  //    characters (or maxWords) split at word boundaries.
  let drafts = [];
  for (const f of kept) {
    const d = drafts.at(-1), word = {text:f.word.text, start:f.start, end:f.end};
    if (d && d.src === f.word.src) d.words.push(word); else drafts.push({src:f.word.src, style:f.word.src.style, kind:f.word.src.kind, words:[word]});
  }
  drafts.forEach((d, i) => { d.first = !drafts.slice(0, i).some(x => x.src === d.src); d.last = !drafts.slice(i + 1).some(x => x.src === d.src); });
  drafts = drafts.flatMap(d => fits(d.words) ? [d]
    : chunk(d.words, textOf, fits).map((words, i, parts) => ({...d, words, first:d.first && i === 0, last:d.last && i === parts.length - 1})));

  // 5. Extents. A drop cue starts dark early so its reveal lands on the word;
  //    a cue holds its last word a beat, never into the next cue.
  drafts.forEach((d, i) => {
    const given = d.first && d.src.start !== undefined && d.src.start <= d.words[0].start ? d.src.start : Infinity;
    d.start = q(Math.max(Math.min(given, d.words[0].start - (d.style === 'drop' ? dropLead : 0)), i ? drafts[i - 1].words.at(-1).end : 0, 0));
  });
  drafts.forEach((d, i) => {
    const lastWord = d.words.at(-1).end, want = d.last && d.src.end !== undefined ? Math.max(lastWord, d.src.end) : lastWord + hold;
    d.end = q(Math.min(want, i + 1 < drafts.length ? drafts[i + 1].start : Infinity, end));
    // No room for the dark lead: the reveal would land late, so show it plainly.
    if (d.style === 'drop' && d.words[0].start - d.start < dropLead - 1e-6) {
      warn(`"${textOf(d.words)}" at ${d.words[0].start.toFixed(2)} s has no room for a drop's dark lead; shown as ${dropFallback}.`);
      d.style = dropFallback;
    }
  });

  // 6. Every cue lasts at least 50 ms: extend, lead in, or join a neighbour.
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i], prev = drafts[i - 1], next = drafts[i + 1];
    if (longEnough(d)) continue;
    d.end = q(Math.min(d.start + MIN_CUE, next ? next.start : Infinity, end));
    if (!longEnough(d)) d.start = q(Math.max(d.end - MIN_CUE, prev ? prev.end : 0, 0));
    if (longEnough(d)) continue;
    const into = next && fits([...d.words, ...next.words]) ? i + 1 : prev && fits([...prev.words, ...d.words]) ? i - 1 : -1;
    if (into < 0) { warn(`"${textOf(d.words)}" at ${d.start.toFixed(2)} s is too short to show; dropped.`); drafts.splice(i--, 1); continue; }
    const at = Math.min(i, into);
    drafts.splice(at, 2, merge(drafts[at], drafts[at + 1]));
    i = at - 1;
  }

  // 7. Stutters that touch read as one retriggering cue (only the current word
  //    shows), so a bar of 16th-note call and response is one cue, not sixteen.
  const beat = 60 / bpm, compactStutters = () => {
    for (let i = 0; compact && i + 1 < drafts.length; i++) {
      const a = drafts[i], b = drafts[i + 1];
      if (a.style === 'stutter' && b.style === 'stutter' && b.start - a.end < 1e-9 && a.end - a.start < 4 * beat - 1e-9 && b.end - b.start < beat - 1e-9
        && fits([...a.words, ...b.words])) { drafts.splice(i, 2, merge(a, b)); i--; }
    }
  };
  compactStutters();

  // 8. At most 80 cues: join the closest neighbours, alike before unlike.
  while (drafts.length > maxCues) {
    let best = -1, cost = Infinity;
    for (let i = 0; i + 1 < drafts.length; i++) {
      const a = drafts[i], b = drafts[i + 1];
      if (!fits([...a.words, ...b.words])) continue;
      const c = (b.start - a.end) + (a.style === b.style ? 0 : 4) + (a.kind === b.kind ? 0 : 2) + .01 * (b.end - a.start);
      if (c < cost) { cost = c; best = i; }
    }
    if (best < 0) throw RangeError(`The editor allows ${maxCues} phrases; these ${drafts.length} cannot be joined without passing ${maxChars} characters.`);
    drafts.splice(best, 2, merge(drafts[best], drafts[best + 1]));
  }
  compactStutters();                                  // joins can make new neighbours

  // 9. Nothing may start in the scene's last 50 ms (the editor drops it).
  const late = drafts.findIndex((d, i) => d.start > end - PIXEL_LIMITS.cueSeconds || (i > 0 && drafts[i - 1].end >= end - PIXEL_LIMITS.cueSeconds));
  if (late >= 0) {
    if (!clamp) throw RangeError(`"${textOf(drafts[late].words)}" starts too close to the end of the ${end} s scene. Lengthen the scene or pass clamp:true.`);
    warn(`${drafts.length - late} cue(s) at the very end cut.`); drafts = drafts.slice(0, late);
  }
  const cues = drafts.map((d, i) => ({id:`${idPrefix}-${String(i + 1).padStart(2, '0')}`, text:textOf(d.words), start:d.start, end:d.end, style:d.style,
    words:d.words.map(w => ({text:w.text, start:w.start, end:w.end}))}));
  return {cues, warnings};
}

// Two neighbours as one cue. A "drop" look is kept only from the first, whose
// start already has the drop's dark lead.
function merge(a, b) {
  const span = d => d.words.reduce((n, w) => n + w.end - w.start, 0);
  const style = a.style === b.style || span(a) >= span(b) || b.style === 'drop' ? a.style : b.style;
  return {...a, style, words:[...a.words, ...b.words], start:a.start, end:b.end, last:b.last};
}

// Fewest balanced pieces that each fit.
function chunk(words, textOf, fits) {
  for (let k = 2; k <= words.length; k++) {
    const target = textOf(words).length / k, out = [[]];
    for (const w of words) {
      const cur = out.at(-1);
      if (cur.length && (!fits([...cur, w]) || (out.length < k && textOf(cur).length + (w.text.length + 1) / 2 > target))) out.push([w]); else cur.push(w);
    }
    if (out.length <= k && out.every(fits)) return out;
  }
  return words.map(w => [w]);
}

// ---------------------------------------------------------------- project

// A whole project file, ready for the editor's Open. Throws, with a reason,
// on anything the editor would silently change.
export function toPixelProject({title = 'All Hands', duration, bpm = BPM, cues = [], format = 'portrait', audioDataUrl = null, audioName = '', options = {}} = {}) {
  const {clamp = false, audioOffset = 0, onWarning, ...rest} = options;
  const look = {...DEFAULTS}, layout = {};
  for (const [k, v] of Object.entries(rest)) (k in DEFAULTS ? look : layout)[k] = v;
  const [minD, maxD] = PIXEL_LIMITS.duration;
  if (!Number.isFinite(duration) || duration < minD) throw RangeError(`Scene duration must be at least ${minD} s (got ${duration}).`);
  if (duration > maxD) {
    if (!clamp) throw RangeError(`Pixel Text scenes are at most ${maxD} s; this one is ${(+duration).toFixed(2)} s. Pass clamp:true to cut it at ${maxD} s.`);
    onWarning?.(`Scene cut from ${(+duration).toFixed(2)} s to ${maxD} s.`); duration = maxD;
  }
  duration = q(duration);
  if (!(bpm >= PIXEL_LIMITS.bpm[0] && bpm <= PIXEL_LIMITS.bpm[1])) throw RangeError(`BPM must be ${PIXEL_LIMITS.bpm.join('–')} (got ${bpm}).`);
  if (!PIXEL_FORMATS[format]) throw RangeError(`Format must be ${Object.keys(PIXEL_FORMATS).join(', ')} (got ${format}).`);
  if (!(audioOffset >= 0 && audioOffset <= PIXEL_LIMITS.audioOffset[1])) throw RangeError(`audioOffset must be 0–${PIXEL_LIMITS.audioOffset[1]} s.`);
  if (audioDataUrl !== null && !(typeof audioDataUrl === 'string' && /^data:[a-z0-9/+.-]*;base64,/i.test(audioDataUrl))) throw TypeError('audioDataUrl must be a "data:<mime>;base64," URL.');
  if (audioDataUrl && dataUrlBytes(audioDataUrl) > PIXEL_LIMITS.audioBytes) throw RangeError(`Embedded audio is ${(dataUrlBytes(audioDataUrl) / 2 ** 20).toFixed(1)} MB; the editor takes at most 30 MB. Use an MP3.`);
  const t = String(title || 'Untitled scene'), name = String(audioName || '');
  if (t.length > PIXEL_LIMITS.title) onWarning?.(`Title cut to ${PIXEL_LIMITS.title} characters.`);
  const laid = layoutCues(cues, {...layout, bpm, duration, clamp, onWarning}).cues;
  if (!laid.length) throw RangeError('Nothing to show: no cue has a drawable, audible word.');
  const project = {version:1, title:t.slice(0, PIXEL_LIMITS.title), duration, bpm, format, ...look, audioOffset, audioName:name.slice(0, PIXEL_LIMITS.audioName), cues:laid};
  const file = {kind:PIXEL_KIND, project, audio:audioDataUrl || null};
  assertEditorSafe(project);
  return file;
}

export const dataUrlBytes = url => { const b64 = url.slice(url.indexOf(',') + 1); return Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0); };

// Problems the editor would "fix" on Open, checked with its own expressions
// (bundle vs(), tt(), un(), wi()). Empty when the project survives verbatim.
export function editorProblems(p) {
  const out = [], tt = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  if (!p || p.version !== 1 || !Array.isArray(p.cues) || !p.cues.length || p.cues.length > PIXEL_LIMITS.cues) return ['not a valid project: version 1 and 1–80 cues required'];
  const n = p.duration;
  if (!(Number.isFinite(n) && tt(n, ...PIXEL_LIMITS.duration) === n)) out.push(`duration ${n}`);
  if (typeof p.title !== 'string' || !p.title || p.title.length > PIXEL_LIMITS.title) out.push('title');
  if (!(Number.isFinite(p.bpm) && tt(p.bpm, ...PIXEL_LIMITS.bpm) === p.bpm)) out.push('bpm');
  if (!PIXEL_FORMATS[p.format]) out.push('format');
  for (const k of ['dotSize', 'glow', 'scale']) if (!(Number.isFinite(p[k]) && tt(p[k], k === 'glow' ? 0 : .3, 1) === p[k])) out.push(k);
  for (const k of ['blue', 'white']) if (!/^#[\da-f]{6}$/i.test(p[k])) out.push(k);
  for (const k of ['unlit', 'equalizer', 'includeAudio', 'reducedMotion']) if (typeof p[k] !== 'boolean') out.push(k);
  if (!(Number.isFinite(p.audioOffset) && tt(p.audioOffset, ...PIXEL_LIMITS.audioOffset) === p.audioOffset)) out.push('audioOffset');
  if (typeof p.audioName !== 'string' || p.audioName.length > PIXEL_LIMITS.audioName) out.push('audioName');
  if (![1, 2, 4, 8].includes(p.subdivision)) out.push('subdivision');
  const ids = new Set();
  let s = 0;
  p.cues.forEach((c, i) => {
    const at = `cue ${i + 1} "${c.text}"`;
    if (i && !(c.start > p.cues[i - 1].start)) out.push(`${at}: not after the previous cue`);
    if (s >= n - .05) out.push(`${at}: after the scene end`);
    if (!(typeof c.start === 'number' && tt(c.start, s, n - .05) === c.start)) out.push(`${at}: start ${c.start} overlaps or is late`);
    if (!(typeof c.end === 'number' && tt(c.end, c.start + .05, n) === c.end)) out.push(`${at}: end ${c.end} (cues last ≥ 50 ms, end ≤ duration)`);
    if (typeof c.id !== 'string' || !c.id || ids.has(c.id)) out.push(`${at}: id`); ids.add(c.id);
    if (!PIXEL_STYLES.includes(c.style)) out.push(`${at}: style ${c.style}`);
    if (typeof c.text !== 'string' || !c.text || Br(c.text) !== c.text) out.push(`${at}: text is not editor-normal`);
    const missing = missingGlyphs(c.text || '');
    if (missing.length) out.push(`${at}: no glyph for ${missing.join(' ')}`);
    const names = String(c.text).split(' ');
    if (!Array.isArray(c.words) || c.words.length !== names.length) out.push(`${at}: ${c.words?.length} words for ${names.length}`);
    else c.words.forEach((w, k) => {
      if (w.text !== names[k] || Br(w.text) !== w.text) out.push(`${at}: word ${k + 1} "${w.text}"`);
      if (!(typeof w.start === 'number' && typeof w.end === 'number' && Number.isFinite(w.start) && Number.isFinite(w.end)
        && w.start >= c.start && w.end <= c.end && w.end > w.start && (!k || w.start >= c.words[k - 1].end))) out.push(`${at}: word ${k + 1} "${w.text}" timing ${w.start}–${w.end}`);
    });
    s = c.end;
  });
  return out;
}

export function assertEditorSafe(project) {
  const problems = editorProblems(project);
  if (problems.length) throw Error(`The Pixel Text editor would change this project:\n- ${problems.slice(0, 12).join('\n- ')}`);
  return project;
}
