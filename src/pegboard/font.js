// Peg Board type: compiles a hand-drawn face (fonts/peg9.js, peg5.js, peg3.js)
// into masks and stroke order, kerns it automatically, normalizes post text to
// the character set, and wraps and fits it to a video format. Pure: the same
// text and options always give the same pegs, so preview and export match.

// Every face draws all of these. Anything else is mapped onto them or dropped.
export const CHARSET = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?'\"-–&%#@/+…$() ");

// Composition safe areas per format (px), from the rendering spec §5. Type and
// faces stay inside `safe`; decorative pegs may run edge to edge.
export const FORMATS = {
  '9:16':{width:1080, height:1920, safe:{x:64, y:300, w:880, h:1140}, maxLines:3},       // right rail 136, caption 480
  '1:1': {width:1080, height:1080, safe:{x:60, y:60, w:960, h:840}, maxLines:3},         // 60 inset + 120 bottom
  '16:9':{width:1920, height:1080, safe:{x:96, y:54, w:1728, h:972}, maxLines:2,         // central 90%
    broadcast:{x:96, y:54, w:1728, h:810}},                                              // type above y 864
};

// ---------------------------------------------------------------------------
// normalize: post text to the character set. NFKD (canonical decomposition plus
// compatibility forms, so LinkedIn's 𝗺𝗮𝘁𝗵-𝗯𝗼𝗹𝗱 letters and full-width digits read),
// accents stripped, curly quotes straightened, uppercase. Emoji and unknown
// characters are dropped and listed, one entry per distinct grapheme.
const MAP = {
  '‘':"'", '’':"'", '‚':"'", '‛':"'", '′':"'", '`':"'", '´':"'", 'ʼ':"'",
  '“':'"', '”':'"', '„':'"', '‟':'"', '″':'"', '«':'"', '»':'"',
  '—':'–', '―':'–', '‐':'-', '‑':'-', '‒':'-', '−':'-', '⁃':'-', '~':'-',
  'ß':'SS', 'ẞ':'SS', 'Ø':'O', 'ø':'O', 'Ł':'L', 'ł':'L', 'Đ':'D', 'đ':'D', 'Ð':'D', 'ð':'D',
  'Æ':'AE', 'æ':'AE', 'Œ':'OE', 'œ':'OE', 'ı':'I', 'Þ':'TH', 'þ':'TH', '×':'X', '⁄':'/', '∕':'/',
  '→':'–', '⇒':'–', '➔':'–', '➜':'–', '|':'/', '·':'-', '•':'', '*':'', '[':'(', ']':')', '{':'(', '}':')',
};
const segmenter = new Intl.Segmenter('en', {granularity:'grapheme'});

export function normalize(text) {
  const chars = [], source = [], dropped = [];
  const push = (c, at) => {
    if (c === ' ' && (!chars.length || chars[chars.length - 1] === ' ')) return;   // collapse, no leading space
    chars.push(c); source.push(at);
  };
  for (const {segment, index} of segmenter.segment(String(text ?? ''))) {
    if (/^\s+$/u.test(segment)) { push(' ', index); continue; }
    const t = [...segment.normalize('NFKD').replace(/\p{M}/gu, '')]
      .map(c => MAP[c] ?? c).join('').toUpperCase().replace(/[\p{Cf}\p{Cc}]/gu, '');
    if (!t) continue;                                   // a lone mark, zero-width space or asterisk
    if ([...t].every(c => CHARSET.has(c))) for (const c of t) push(c, index);
    else if (!dropped.includes(segment)) dropped.push(segment);
  }
  // An emoji between two spaces leaves a double space; three dots become one glyph.
  let out = '', src = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '.' && chars[i + 1] === '.' && chars[i + 2] === '.') {
      out += '…'; src.push(source[i]);
      while (chars[i + 1] === '.') i++;
      continue;
    }
    if (chars[i] === ' ' && out.endsWith(' ')) continue;
    out += chars[i]; src.push(source[i]);
  }
  while (out.endsWith(' ')) { out = out.slice(0, -1); src.pop(); }
  return {text:out, dropped, source:src};
}

// ---------------------------------------------------------------------------
// sheet: the faces are drawn as specimen sheets, glyphs side by side so they
// can be compared while drawing. A band is a header line of characters, then
// one line per row ('#' lit, '.' unlit), glyph columns separated by spaces;
// bands are separated by blank lines. Returns {ch:{w, bits, order:null}}.
export function sheet(text) {
  const glyphs = {};
  for (const band of text.split(/\n\s*\n/)) {
    const [head, ...rows] = band.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(/\s+/));
    if (!head) continue;
    head.forEach((ch, i) => {
      const bits = rows.map(r => r[i]);
      if (bits.some(b => b === undefined)) throw new Error(`sheet: glyph ${ch} is missing rows`);
      glyphs[ch] = {w:bits[0].length, bits, order:null};
    });
  }
  return glyphs;
}

// ---------------------------------------------------------------------------
// compileFont: bit strings to masks, edge profiles and stroke order.
//   def = {name, rows, descent, tracking, space, lead, glyphs:{ch:{w, bits:[...], order?}}}
// Every glyph cell is rows + descent tall; a glyph drawn with `rows` lines has
// an empty descender. Stroke order: depth-first from the top-left lit peg,
// preferring down, then right; a glyph may override it with def.order
// ([x0, y0, x1, y1, ...] or [[x, y], ...]) covering each lit peg once.
const STEPS = [[0, 1], [1, 0], [1, 1], [-1, 1], [-1, 0], [1, -1], [0, -1], [-1, -1]];

function preorder(w, h, mask) {
  const seen = new Uint8Array(w * h), out = [];
  const visit = s => {
    const stack = [s]; seen[s] = 1; out.push(s % w, (s / w) | 0);
    while (stack.length) {
      const i = stack[stack.length - 1], x = i % w, y = (i / w) | 0;
      let next = -1;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[j] && !seen[j]) { next = j; break; }
      }
      if (next < 0) { stack.pop(); continue; }
      seen[next] = 1; out.push(next % w, (next / w) | 0); stack.push(next);
    }
  };
  for (let s = 0; s < w * h; s++) if (mask[s] && !seen[s]) visit(s);
  return new Int16Array(out);
}

function compileGlyph(ch, g, font) {
  const h = font.rows + font.descent, w = g.w;
  if (g.bits.length !== font.rows && g.bits.length !== h) throw new Error(`${font.name} ${ch}: ${g.bits.length} rows`);
  const mask = new Uint8Array(w * h);
  g.bits.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${font.name} ${ch}: row ${y} is ${row.length} wide, not ${w}`);
    for (let x = 0; x < w; x++) mask[y * w + x] = row[x] === '#' ? 1 : 0;
  });
  let order;
  if (g.order) {
    order = new Int16Array(g.order.flat());
    const hit = new Uint8Array(w * h);
    for (let i = 0; i < order.length; i += 2) {
      const j = order[i + 1] * w + order[i];
      if (!mask[j] || hit[j]++) throw new Error(`${font.name} ${ch}: order visits ${order[i]},${order[i + 1]} badly`);
    }
    if (hit.reduce((a, b) => a + b, 0) !== mask.reduce((a, b) => a + b, 0)) throw new Error(`${font.name} ${ch}: order misses pegs`);
  } else order = preorder(w, h, mask);
  // Edge profiles for kerning: first and last lit column per row, -1 when empty.
  const left = new Int8Array(h).fill(-1), right = new Int8Array(h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (left[y] < 0) left[y] = x; right[y] = x; }
  return {ch, w, h, mask, order, left, right, count:order.length / 2};
}

export function compileFont(def) {
  const font = {
    name:def.name, id:def.id, rows:def.rows, descent:def.descent, tracking:def.tracking ?? 1,
    space:def.space, lead:def.lead ?? 1, minPitch:def.minPitch ?? 1, glyphs:{}, kerns:new Map(),
  };
  font.height = font.rows + font.descent;                 // a glyph cell
  font.advance = font.height + font.lead;                  // line to line, in pegs at k = 1
  for (const [ch, g] of Object.entries(def.glyphs)) font.glyphs[ch] = compileGlyph(ch, g, font);
  const blank = {ch:' ', w:font.space, h:font.height, mask:new Uint8Array(font.space * font.height),
    order:new Int16Array(0), left:new Int8Array(font.height).fill(-1), right:new Int8Array(font.height).fill(-1), count:0};
  font.glyph = ch => font.glyphs[ch] || (ch === ' ' ? blank : null);
  font.has = ch => ch === ' ' || ch in font.glyphs;
  return font;
}

// ---------------------------------------------------------------------------
// kern: extra advance (pegs at k = 1) between two glyphs, beyond w + tracking.
// Automatic and collision-proof. The tightest offset is the one where no lit
// peg of one glyph touches a peg of the other, diagonals included. A pair
// tightens by one peg, never more, when that stays within the tightest offset
// and the average gap over the rows where both glyphs have ink is at least 2.5
// pegs. LT, TA, AV, T. and L' kern themselves; HH never moves, and a hyphen
// never slides into the mouth of a C.
const touches = (A, B, off) => {
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
    if (!B.mask[y * B.w + x]) continue;
    const ax = x + off;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = ax + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < A.w && Y < A.h && A.mask[Y * A.w + X]) return true;
    }
  }
  return false;
};

export function kern(font, a, b) {
  const key = a + '\u0000' + b;
  const hit = font.kerns.get(key);
  if (hit !== undefined) return hit;
  const A = font.glyph(a), B = font.glyph(b);
  let t = 0;
  if (A && B && A.count && B.count) {
    const base = A.w + font.tracking, gaps = [];
    for (let y = 0; y < Math.min(A.h, B.h); y++) if (A.right[y] >= 0 && B.left[y] >= 0) gaps.push(base + B.left[y] - A.right[y] - 1);
    if (gaps.length) {
      const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      if (avg >= 2.5 && !touches(A, B, base - 1)) t = -1;
    }
  }
  font.kerns.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// layoutText: words set in a face at k, wrapped into balanced lines and pages.
//   Words never break. A 1-2 letter word never ends a line unless punctuation
//   follows it. Overflow beyond maxLines becomes extra pages of whole words,
//   balanced in length and broken at punctuation where it costs little.
// Coordinates are pegs, relative to the layout's top-left. Each page is centred
// vertically in the layout's height; each line horizontally (align).
//   layoutText(text, {font, k = 1, maxCols, maxLines = 3, align = 'center'}) ->
//     {width, height, text (normalized), dropped, strict, quality, k, font (id),
//      pages:[{lines:[{y, x, width, chars:[{ch, index, word, x, y, w, h, pegs}]}]}]}
//   index: the character's position in `text`; word: its word number in `text`;
//   x, y, w, h: the glyph cell; pegs: Int16Array [x0, y0, x1, y1, ...] absolute,
//   in stroke order, each glyph bit a k x k block. Spaces have no chars. Empty
//   text gives no pages. strict is false only if the short-word rule had to give.
// Short: one or two letters or digits, no punctuation after (I'M, TO, A, 10).
// Glue: punctuation alone (a spaced dash, an ellipsis) belongs to the word before.
// A spaced & + / or # is a word like any other, as "and" would be.
const SENTENCE = /[.!?…]["']?$/, CLAUSE = /[,:;–-]["']?$/, GLUE = /^[-–…"'.,:;!?]+$/;
const isShort = word => /^[^A-Z0-9]*[A-Z0-9][^A-Z0-9]*([A-Z0-9][^A-Z0-9]*)?$/.test(word) && !SENTENCE.test(word) && !CLAUSE.test(word);
const breakBonus = word => SENTENCE.test(word) ? .15 : CLAUSE.test(word) ? .08 : 0;

function measureWord(font, word, k) {
  const xs = [];
  let x = 0, prev = null;
  for (const ch of word) {
    const g = font.glyph(ch);
    if (prev) x += prev.w + font.tracking + kern(font, prev.ch, ch);
    xs.push(x); prev = g;
  }
  return {xs:xs.map(v => v * k), w:(prev ? x + prev.w : 0) * k};
}

// Fewest lines for words [i, j) within maxCols. A single word always gets its
// own line (it may overflow; fit() then lowers the pitch). `short[w]`: word w
// may not end a line; `glue[w]`: word w (a lone dash or ellipsis) may not start one.
function linesNeeded(W, gap, maxCols, short, glue, i, j, strict) {
  const best = new Array(j - i + 1).fill(Infinity);   // best[m]: lines for words i..i+m-1
  best[0] = 0;
  for (let m = 1; m <= j - i; m++) {
    let width = -gap;
    for (let s = m - 1; s >= 0; s--) {                // the last line holds words i+s .. i+m-1
      width += W[i + s] + gap;
      if (width > maxCols && s < m - 1) break;
      if (s > 0 && strict && (short[i + s - 1] || glue[i + s])) continue;
      if (best[s] + 1 < best[m]) best[m] = best[s] + 1;
    }
  }
  return best[j - i];
}

// Balanced break of words [i, j) into exactly L lines: minimise the sum of
// squared line widths (relative to the mean), favouring breaks at punctuation.
function balance(W, words, gap, maxCols, short, glue, i, j, L, strict) {
  const n = j - i, mean = (W.slice(i, j).reduce((a, b) => a + b, 0) + gap * (n - L)) / L || 1;
  const lineW = (a, b) => W.slice(a, b).reduce((s, v) => s + v, 0) + gap * (b - a - 1);
  // cost[l][m]: best cost for l lines covering words i .. i+m-1
  const cost = Array.from({length:L + 1}, () => new Array(n + 1).fill(Infinity));
  const from = Array.from({length:L + 1}, () => new Array(n + 1).fill(-1));
  cost[0][0] = 0;
  for (let l = 1; l <= L; l++) for (let m = l; m <= n; m++) for (let s = l - 1; s < m; s++) {
    if (cost[l - 1][s] === Infinity) continue;
    const w = lineW(i + s, i + m);
    if (w > maxCols && m - s > 1) continue;
    if (s > 0 && strict && (short[i + s - 1] || glue[i + s])) continue;
    const c = cost[l - 1][s] + (w / mean) ** 2 - (s > 0 ? breakBonus(words[i + s - 1]) : 0);
    if (c < cost[l][m]) { cost[l][m] = c; from[l][m] = s; }
  }
  if (cost[L][n] === Infinity) return null;
  const cuts = [];
  for (let l = L, m = n; l > 0; m = from[l][m], l--) cuts.unshift([i + from[l][m], i + m]);
  return cuts;
}

export function layoutText(text, {font, k = 1, maxCols = Infinity, maxLines = 3, align = 'center'} = {}) {
  const prep = prepare(text, font, k);
  return build(prep, plan(prep, maxCols, maxLines), align);
}

// Normalize and measure once per text, face and k; fit() then plans many pitches.
function prepare(text, font, k) {
  if (!font) throw new Error('layoutText needs a compiled font');
  const {text:norm, dropped} = normalize(text);
  const missing = [...new Set(norm)].filter(c => !font.has(c));
  if (missing.length) throw new Error(`${font.name} has no glyph for ${missing.join(' ')}`);
  // Words, with each character's index in the normalized text.
  const words = [], starts = [];
  for (const m of norm.matchAll(/[^ ]+/g)) { words.push(m[0]); starts.push(m.index); }
  const measured = words.map(w => measureWord(font, w, k));
  const W = measured.map(m => m.w);
  return {font, k, norm, dropped, words, starts, measured, W, gap:font.space * k,
    short:words.map(isShort), glue:words.map(w => GLUE.test(w))};
}

// Lines and pages for one column budget; geometry only, no pegs.
function plan({font, k, words, W, gap, short, glue}, maxCols, maxLines) {
  const n = words.length;
  maxLines = Math.max(1, Math.floor(maxLines));
  // Fewest lines per span of words; strict: no line ends on a short word or
  // starts with a lone dash.
  const memo = new Map();
  const lines = (i, j, strict) => {
    const key = (i * 65536 + j) * 2 + (strict ? 1 : 0);
    if (!memo.has(key)) memo.set(key, j - i === 1 ? 1 : linesNeeded(W, gap, maxCols, short, glue, i, j, strict));
    return memo.get(key);
  };
  // Pages: fewest first, then balanced by width, broken at punctuation where it
  // costs little (twice the pull of a line break: a page is a sung phrase). A
  // page end is a line end too, so it never follows a short word and the next
  // page never opens on a lone dash, unless no pagination can avoid it.
  const total = W.reduce((a, b) => a + b, 0) || 1;
  const paginate = hard => {
    const best = new Array(n + 1).fill(null);   // best[j] = [pages, cost, from]
    best[0] = [0, 0, -1];
    for (let j = 1; j <= n; j++) {
      if (j < n && short[j - 1] && hard) continue;
      for (let i = j - 1; i >= 0; i--) {
        if (!best[i] || (hard && i > 0 && glue[i])) continue;
        if (lines(i, j, hard) > maxLines) break;    // longer spans only need more lines
        const cost = (W.slice(i, j).reduce((a, b) => a + b, 0) / total) ** 2
          - (j < n ? 2 * breakBonus(words[j - 1]) - (short[j - 1] ? 1 : 0) : 0);
        const cand = [best[i][0] + 1, best[i][1] + cost, i];
        if (!best[j] || cand[0] < best[j][0] || (cand[0] === best[j][0] && cand[1] < best[j][1] - 1e-9)) best[j] = cand;
      }
    }
    return best[n] && best;
  };
  const hard = !!paginate(true), best = paginate(hard);
  const spans = [];
  for (let j = n; j > 0; j = best[j][2]) spans.unshift([best[j][2], j]);
  const pages = spans.map(([i, j]) => {
    const cuts = balance(W, words, gap, maxCols, short, glue, i, j, lines(i, j, hard), hard) || [[i, j]];
    return cuts.map(([a, b]) => ({a, b, width:W.slice(a, b).reduce((s, v) => s + v, 0) + gap * (b - a - 1)}));
  });
  const cell = font.height * k, adv = font.advance * k;
  // How well the breaks follow the sense: punctuation at line and page ends.
  const quality = pages.flat().reduce((q, ln) => q + (ln.b < n ? breakBonus(words[ln.b - 1]) : 0), 0);
  return {pages, strict:hard, quality,
    width:Math.max(0, ...pages.flat().map(l => l.width)),
    height:Math.max(0, ...pages.map(p => (p.length - 1) * adv + cell))};
}

// Pegs for a plan: each glyph bit a k x k block, in stroke order.
function build({font, k, norm, dropped, words, starts, measured, W, gap}, {pages, width, height, strict, quality}, align) {
  const cell = font.height * k, adv = font.advance * k;
  const out = pages.map(page => {
    const top = Math.floor((height - ((page.length - 1) * adv + cell)) / 2);
    return {lines:page.map((ln, li) => {
      const y = top + li * adv;
      const x0 = align === 'left' ? 0 : align === 'right' ? width - ln.width : Math.floor((width - ln.width) / 2);
      const chars = [];
      let x = x0;
      for (let wi = ln.a; wi < ln.b; wi++) {
        [...words[wi]].forEach((ch, ci) => {
          const g = font.glyph(ch), gx = x + measured[wi].xs[ci];
          const pegs = new Int16Array(g.order.length * k * k);
          let p = 0;
          for (let o = 0; o < g.order.length; o += 2) for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
            pegs[p++] = gx + g.order[o] * k + dx; pegs[p++] = y + g.order[o + 1] * k + dy;
          }
          chars.push({ch, index:starts[wi] + ci, word:wi, x:gx, y, w:g.w * k, h:g.h * k, pegs});
        });
        x += W[wi] + gap;
      }
      return {y, x:x0, width:ln.width, chars};
    })};
  });
  return {width, height, pages:out, dropped, text:norm, k, font:font.id, strict, quality};
}

// ---------------------------------------------------------------------------
// fit: the largest whole-pixel pitch at which the text sits inside the safe
// area. One page if any pitch from maxPitch down to minPitch allows it;
// otherwise the fewest pages minPitch allows, at the largest pitch that keeps
// that count. Below minPitch only as a last resort, flagged belowMin.
// `font` may be a list of faces in order of preference (e.g. [PEG9, PEG5]):
// the first that fits at minPitch or above wins. A face may raise the floor
// itself (PEG-3 is drawn for P >= 12 only).
//   fit(text, {font, width, height, safe:{x, y, w, h}, maxLines = 3, minPitch = 9,
//     maxPitch = 60, k = 1, format}) -> {pitch, cols, rows, originX, originY,
//     layout, boardX, boardY, pages, font (id), face, k, belowMin}
// `format` ('9:16', '1:1', '16:9') fills in whichever of width, height, safe and
// maxLines are not given, from FORMATS. The board is cols x rows pegs covering
// width x height, its top-left at boardX, boardY px; originX, originY is the
// board peg where the layout's (0, 0) goes. Every lit cell lies wholly inside the safe area.
export function fit(text, {font, width, height, safe, maxLines, minPitch = 9, maxPitch = 60, k = 1, format} = {}) {
  // Options given explicitly win over the format's (e.g. maxLines:1 for a drop slam in 9:16).
  if (format) { const F = FORMATS[format]; width ??= F.width; height ??= F.height; safe ??= F.safe; maxLines ??= F.maxLines; }
  maxLines ??= 3;
  safe ||= {x:0, y:0, w:width, h:height};
  const faces = (Array.isArray(font) ? font : [font]).map(face => fitter(text, face, {width, height, safe, maxLines, minPitch, maxPitch, k}));
  // The short-word rule outranks the face: every face is tried with it before
  // any face is tried without it, and pitch drops below minPitch last of all.
  for (const strict of [true, false]) for (const f of faces) { const r = f.fit(strict); if (r) return r; }
  return faces.map(f => f.below()).reduce((a, b) => (b.pitch > a.pitch ? b : a));
}

function fitter(text, font, {width, height, safe, maxLines, minPitch, maxPitch, k}) {
  const cell = font.height * k, adv = font.advance * k, prep = prepare(text, font, k);
  const attempt = pitch => {
    const cols = Math.floor(width / pitch), rows = Math.floor(height / pitch);
    const boardX = Math.floor((width - cols * pitch) / 2), boardY = Math.floor((height - rows * pitch) / 2);
    const c0 = Math.ceil((safe.x - boardX) / pitch), c1 = Math.floor((safe.x + safe.w - boardX) / pitch);
    const r0 = Math.ceil((safe.y - boardY) / pitch), r1 = Math.floor((safe.y + safe.h - boardY) / pitch);
    const room = Math.min(maxLines, Math.floor((r1 - r0 - cell) / adv) + 1);
    if (room < 1 || c1 <= c0) return null;
    const layout = plan(prep, c1 - c0, room);
    if (layout.width > c1 - c0 || layout.height > r1 - r0) return null;
    // Centre in the safe area: horizontally on the block, vertically on its caps
    // (the last line's descender hangs below), snapped to whole pegs.
    const capH = layout.height - font.descent * k;
    const ix = (safe.x + (safe.w - layout.width * pitch) / 2 - boardX) / pitch;
    const iy = (safe.y + (safe.h - capH * pitch) / 2 - boardY) / pitch;
    const originX = Math.max(c0, Math.min(c1 - layout.width, Math.round(ix)));
    const originY = Math.max(r0, Math.min(r1 - layout.height, Math.round(iy)));
    return {pitch, cols, rows, originX, originY, boardX, boardY, layout, pages:layout.pages.length, font:font.id, face:font, k, belowMin:false};
  };
  const lo = Math.max(1, Math.min(Math.max(minPitch, font.minPitch), maxPitch)), memo = new Map();
  const at = p => memo.has(p) ? memo.get(p) : memo.set(p, attempt(p)).get(p);
  // The largest pitch wins, except that some of it may be traded, at the same
  // page count, for breaks that fall at punctuation: a sentence end is worth
  // 21% of the pitch, a comma or dash 11% ("IT'S NOT ABOUT X. / IT'S ABOUT Y."
  // rather than "IT'S NOT ABOUT / X. IT'S ABOUT Y.").
  const done = r => ({...r, layout:build(prep, r.layout, 'center')});
  const refine = (best, ok) => {
    let pick = best, score = 1 + 1.4 * best.layout.quality;
    for (let p = best.pitch - 1; p >= Math.max(lo, Math.floor(best.pitch * .8)); p--) {
      const r = at(p);
      if (!ok(r) || r.pages !== best.pages) continue;
      const sc = p / best.pitch + 1.4 * r.layout.quality;
      if (sc > score + 1e-9) { pick = r; score = sc; }
    }
    return done(pick);
  };
  return {
    // One page at the largest pitch from maxPitch down to the floor; else the
    // fewest pages the floor allows, at the largest pitch that keeps them.
    fit(strict) {
      const ok = r => r && (r.layout.strict || !strict);
      for (let p = maxPitch; p >= lo; p--) if (ok(at(p)) && at(p).pages === 1) return refine(at(p), ok);
      const most = at(lo);
      if (ok(most)) for (let p = maxPitch; p >= lo; p--) if (ok(at(p)) && at(p).pages <= most.pages) return refine(at(p), ok);
      return null;
    },
    below() {
      for (let p = lo - 1; p >= 1; p--) if (at(p)) return {...done(at(p)), belowMin:true};
      return {pitch:0, cols:0, rows:0, originX:0, originY:0, boardX:0, boardY:0, layout:null, pages:0, font:font.id, face:font, k, belowMin:true};
    },
  };
}
