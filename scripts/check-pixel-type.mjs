// Peg Board type: the hand-drawn faces, stroke order, normalization, kerning,
// wrapping and fitting to the three video formats. Pure Node, no browser.
// Other Peg Board modules add their own sections below; each section stands on
// its own and counts with ok(). The last line is the summary.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CHARSET, FORMATS, normalize, sheet, compileFont, kern, layoutText, fit} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {PEG3} from '../src/pegboard/fonts/peg3.js';
import {lyricsFromPost, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {HOST} from '../src/allhands/song.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const json = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));

const DEFS = {peg9:PEG9, peg5:PEG5, peg3:PEG3};
const FACES = Object.fromEntries(Object.entries(DEFS).map(([id, def]) => [id, compileFont(def)]));
const GRID = {peg9:7, peg5:5, peg3:5};                    // widest glyph each face may draw
const at = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.mask[y * g.w + x] === 1;
const lit = g => { const out = []; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (at(g, x, y)) out.push([x, y]); return out; };
// Enclosed counters: background components (4-connected) that cannot reach the cell edge.
const holes = g => {
  const seen = new Uint8Array(g.w * g.h);
  let n = 0;
  for (let s = 0; s < g.w * g.h; s++) {
    if (g.mask[s] || seen[s]) continue;
    let edge = false;
    const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % g.w, y = (i / g.w) | 0;
      if (x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, j = Y * g.w + X;
        if (X >= 0 && Y >= 0 && X < g.w && Y < g.h && !g.mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (!edge) n++;
  }
  return n;
};

// ===========================================================================
// 1. The faces: drawn bit strings, the declared grid, the spec's letterforms.
for (const [id, def] of Object.entries(DEFS)) {
  const face = FACES[id];
  ok(def.rows > 0 && def.descent >= 1 && def.tracking === 1 && def.space > 0, `${id}: metrics`);
  for (const [ch, g] of Object.entries(def.glyphs)) {
    ok(g.bits.every(r => r.length === g.w && /^[#.]+$/.test(r)), `${id} ${ch}: every row is ${g.w} wide, # and . only`);
    ok(g.bits.length === def.rows || g.bits.length === def.rows + def.descent, `${id} ${ch}: ${g.bits.length} rows, declared ${def.rows} (+${def.descent})`);
    ok(g.w >= 1 && g.w <= GRID[id] + (ch === '…' ? 3 : 0), `${id} ${ch}: ${g.w} wide inside the ${GRID[id]}-peg grid`);
    const G = face.glyph(ch);
    ok(G.count > 0, `${id} ${ch}: has pegs`);
    // Only the comma, semicolon and Q's tail may reach into the descender.
    const deep = lit(G).some(([, y]) => y >= def.rows);
    ok(deep ? [',', ';', 'Q'].includes(ch) : ch !== ',' && ch !== ';', `${id} ${ch}: descender use`);
  }
  for (const ch of CHARSET) ok(face.has(ch), `${id}: draws ${JSON.stringify(ch)}`);
  // No two glyphs share a drawing.
  const seen = new Map();
  for (const [ch, G] of Object.entries(face.glyphs)) {
    const key = `${G.w}:${G.mask.join('')}`;
    ok(!seen.has(key), `${id}: ${ch} is drawn the same as ${seen.get(key)}`);
    seen.set(key, ch);
  }
  // Counters stay open where outline fonts fill them in.
  for (const [ch, n] of Object.entries({B:2, 8:2, O:1, 0:1, D:1, P:1, R:1, Q:1, A:1, 4:1, 6:1, 9:1}))
    ok(holes(face.glyph(ch)) === n, `${id} ${ch}: ${n} open counter(s), found ${holes(face.glyph(ch))}`);
  // Confusable pairs differ clearly: by several pegs (half as many if the
  // widths differ too).
  const minDiff = {peg9:8, peg5:4, peg3:2}[id];
  for (const [a, b] of [['0', 'O'], ['1', 'I'], ['5', 'S'], ['8', 'B'], ['2', 'Z'], ['6', 'G'], ['0', 'D'], ['0', '8']]) {
    const A = face.glyph(a), B = face.glyph(b), w = Math.max(A.w, B.w);
    let diff = 0;
    for (let y = 0; y < A.h; y++) for (let x = 0; x < w; x++) diff += at(A, x, y) !== at(B, x, y);
    ok(A.w !== B.w ? diff >= minDiff / 2 : diff >= minDiff, `${id}: ${a}/${b} differ by ${diff} pegs`);
  }
}
{ // PEG-9 Heavy, as specified.
  const f = FACES.peg9, w = ch => f.glyph(ch).w;
  ok(f.rows === 9 && f.descent === 2 && f.space === 4 && f.tracking === 1, 'peg9: 9 rows + 2 descender, space 4, tracking 1');
  ok(w('I') === 2 && w('M') === 7 && w('W') === 7, 'peg9: I is 2 pegs, M and W are 7');
  const ap = lit(f.glyph("'"));
  ok(w("'") === 2 && Math.max(...ap.map(p => p[1])) === 2 && Math.min(...ap.map(p => p[1])) === 0, "peg9: the apostrophe is 2x3 on rows 0-2");
  const H = f.glyph('H'), E = f.glyph('E');
  ok([0, 1, 2, 3, 5, 6, 7, 8].every(y => lit(H).filter(p => p[1] === y).length === 4) && lit(H).filter(p => p[1] === 4).length === 6, 'peg9: 2-peg stems, 1-row crossbar on row 4');
  ok([0, 1, 7, 8].every(y => lit(E).filter(p => p[1] === y).length === E.w) && lit(E).filter(p => p[1] === 4).length >= 3 && [2, 3, 5, 6].every(y => lit(E).filter(p => p[1] === y).length === 2), 'peg9: 2-row top and bottom bars');
  for (const ch of 'OCGQ0S8') ok(!at(f.glyph(ch), 0, 0) && !at(f.glyph(ch), f.glyph(ch).w - 1, 0), `peg9: ${ch} cuts its corners`);
  ok(holes(f.glyph('%')) === 2, 'peg9: % keeps both rings open');
  ok(FACES.peg3.minPitch === 12, 'peg3: drawn for P >= 12 only');
}

// ===========================================================================
// 2. Stroke order: depth-first from the top-left peg, every lit peg exactly once.
for (const [id, face] of Object.entries(FACES)) for (const [ch, G] of Object.entries(face.glyphs)) {
  const hit = new Uint8Array(G.w * G.h);
  for (let i = 0; i < G.order.length; i += 2) hit[G.order[i + 1] * G.w + G.order[i]]++;
  ok(G.mask.every((m, i) => hit[i] === m), `${id} ${ch}: stroke order covers every lit peg exactly once`);
  const first = G.mask.indexOf(1);
  ok(G.order[0] === first % G.w && G.order[1] === ((first / G.w) | 0), `${id} ${ch}: stroke order starts at the top-left peg`);
}
{ // The walk prefers down, then right; an override must cover the glyph exactly.
  const L = compileFont({name:'t', rows:3, descent:1, tracking:1, space:2, glyphs:sheet(`
    L  T
    #. ###
    #. .#.
    ## .#.`)});
  ok(Array.from(L.glyph('L').order).join() === '0,0,0,1,0,2,1,2', 'stroke order: down the stem, then along the foot');
  ok(Array.from(L.glyph('T').order).join() === '0,0,1,0,1,1,1,2,2,0', 'stroke order: depth first, the arm after the stem');
  const custom = compileFont({name:'t', rows:3, descent:1, space:2, glyphs:{L:{w:2, bits:['#.', '#.', '##'], order:[[1, 2], [0, 2], [0, 1], [0, 0]]}}});
  ok(Array.from(custom.glyph('L').order).join() === '1,2,0,2,0,1,0,0', 'stroke order: def.order overrides the walk');
  assert.throws(() => compileFont({name:'t', rows:3, descent:1, space:2, glyphs:{L:{w:2, bits:['#.', '#.', '##'], order:[[0, 0], [0, 1]]}}})); checks++;
  assert.throws(() => compileFont({name:'t', rows:3, descent:1, space:2, glyphs:{L:{w:2, bits:['#.', '#', '##']}}})); checks++;
}

// ===========================================================================
// 3. normalize: everything a post can contain, reduced to the character set.
{
  const n = s => normalize(s).text;
  assert.equal(n('Here’s “what” I‘m'), `HERE'S "WHAT" I'M`); checks++;
  assert.equal(n('Café naïve résumé São Malmö Zürich Ñuñoa'), 'CAFE NAIVE RESUME SAO MALMO ZURICH NUNOA'); checks++;
  assert.equal(n('Straße Øresund Łódź Æsir œuvre'), 'STRASSE ORESUND LODZ AESIR OEUVRE'); checks++;
  assert.equal(n('a — b – c - d − e'), 'A – B – C - D - E'); checks++;
  assert.equal(n('wait... what… ok....'), 'WAIT… WHAT… OK…'); checks++;
  assert.equal(n('𝗕𝗶𝗴 𝗻𝗲𝘄𝘀 ＡＢＣ１２３'), 'BIG NEWS ABC123'); checks++;
  assert.equal(n('  spaced \n\t out here  '), 'SPACED OUT HERE'); checks++;
  assert.equal(n('10×ROI → growth'), '10XROI – GROWTH'); checks++;
  const e = normalize('Ship it 🚀🚀 👍🏽 👨‍👩‍👧 🇸🇪 now 👇 €5');
  assert.equal(e.text, 'SHIP IT NOW 5'); checks++;
  assert.deepEqual(e.dropped, ['🚀', '👍🏽', '👨‍👩‍👧', '🇸🇪', '👇', '€']); checks++;
  const src = normalize('Ça va… “Oui”');
  ok(src.source.length === src.text.length && src.source.every((v, i, a) => i === 0 || v >= a[i - 1]), 'normalize: source maps every output character');
  ok([...normalize(SAMPLE_POST).text].every(c => CHARSET.has(c)), 'normalize: output stays in the character set');
}

// ===========================================================================
// 4. Coverage: every character the song can show has a glyph in every face.
const LADY = json('../src/allhands/lady-phrases.json').map(p => p.text);
const POSTS = json('./fixtures/pixel-posts.json');
const SUNG = POSTS.flatMap(({post}) => { const l = lyricsFromPost(post); return [l.hook, ...l.verses]; });
const LINES = [...LADY, HOST.open, HOST.close, ...SUNG];
ok(LADY.length === 57 && POSTS.length === 60 && SUNG.length === 300, 'coverage: 57 lady phrases, 60 posts, 300 sung lines');
{
  const emoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u, all = new Set();
  for (const line of [...LINES, ...POSTS.map(p => p.post)]) {
    const r = normalize(line);
    for (const c of r.text) all.add(c);
    ok(r.dropped.every(d => emoji.test(d)), `coverage: only emoji dropped from ${JSON.stringify(line.slice(0, 40))}: ${r.dropped.join(' ')}`);
  }
  for (const [id, face] of Object.entries(FACES)) for (const c of all) ok(face.has(c), `coverage: ${id} draws ${JSON.stringify(c)}`);
}

// ===========================================================================
// 5. Kerning: automatic, at most one peg, never a collision, cached.
for (const [id, face] of Object.entries(FACES)) {
  const chars = Object.keys(face.glyphs);
  let kerned = 0;
  for (const a of chars) for (const b of chars) {
    const k = kern(face, a, b), A = face.glyph(a), B = face.glyph(b), off = A.w + face.tracking + k;
    assert.ok(k === 0 || k === -1, `${id} ${a}${b}: kern ${k}`);
    assert.ok(off >= A.w, `${id} ${a}${b}: ${b} enters ${a}'s box`);
    // Independent collision test: no lit peg of B within one peg (8-neighbourhood) of A.
    for (const [x, y] of lit(B)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      assert.ok(!at(A, x + off + dx, y + dy), `${id} ${a}${b}: kerning makes the glyphs touch`);
    kerned += k < 0;
  }
  checks += chars.length ** 2;
  ok(kerned > 0 && kerned < chars.length ** 2 / 4, `${id}: ${kerned} of ${chars.length ** 2} pairs kern`);
  ok(face.kerns.size >= chars.length ** 2 && kern(face, 'A', 'V') === face.kerns.get('A\u0000V'), `${id}: kerning is cached`);
}
for (const p of ['LT', 'TA', 'AV', 'T.', "L'", 'VA', 'P.', 'Y.']) ok(kern(FACES.peg9, p[0], p[1]) === -1, `peg9: ${p} kerns`);
for (const p of ['HH', 'TT', 'II', 'NN', 'OO', 'MW', '00']) ok(kern(FACES.peg9, p[0], p[1]) === 0, `peg9: ${p} stays put`);
{ // One peg at most: a glyph never enters the other's box (no hyphen in the mouth of a C).
  const f = FACES.peg9, C = f.glyph('C'), D = f.glyph('-');
  ok(C.w + f.tracking + kern(f, 'C', '-') + Math.min(...lit(D).map(p => p[0])) >= C.w, 'peg9: C- keeps the hyphen outside the C');
}
ok(kern(FACES.peg9, 'A', ' ') === 0 && kern(FACES.peg9, ' ', 'A') === 0, 'kerning: never across a space');

// ===========================================================================
// 6. Layout and fit: every lady phrase and every sung line, in every format.
const SHORT = w => /[A-Z0-9]/.test(w) && w.replace(/[^A-Z0-9]/g, '').length <= 2 && !/[.!?…,:;–-]["']?$/.test(w);
const words = layout => layout.pages.map(p => p.lines.map(l => {
  const out = [];
  for (const c of l.chars) { if (!out.length || out[out.length - 1].word !== c.word) out.push({word:c.word, text:''}); out[out.length - 1].text += c.ch; }
  return out;
}));
function checkLayout(L, face, {k, maxCols, maxLines, label}) {
  const norm = L.text, lines = L.pages.flatMap(p => p.lines);
  // Every visible character exactly once, in order, at its index; words whole.
  const chars = lines.flatMap(l => l.chars);
  assert.equal(chars.map(c => c.ch).join(''), norm.replace(/ /g, ''), `${label}: every character once, in order`);
  assert.ok(chars.every(c => norm[c.index] === c.ch), `${label}: character indices`);
  const lineOf = new Map();
  lines.forEach((l, li) => l.chars.forEach(c => { if (!lineOf.has(c.word)) lineOf.set(c.word, li); assert.equal(lineOf.get(c.word), li, `${label}: a word breaks`); }));
  for (const p of L.pages) {
    assert.ok(p.lines.length >= 1 && p.lines.length <= maxLines, `${label}: ${p.lines.length} lines on a page`);
    const taken = new Set();
    for (const l of p.lines) {
      assert.ok(l.width <= maxCols || new Set(l.chars.map(c => c.word)).size === 1, `${label}: line ${l.width} > ${maxCols}`);
      assert.ok(l.x >= 0 && l.x + l.width <= L.width, `${label}: line inside the block`);
      for (const c of l.chars) {
        const G = face.glyph(c.ch);
        assert.equal(c.pegs.length, G.count * k * k * 2, `${label}: ${c.ch} has every peg, k x k`);
        for (let i = 0; i < c.pegs.length; i += 2) {
          const x = c.pegs[i], y = c.pegs[i + 1], key = y * 4096 + x;
          assert.ok(x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h, `${label}: peg outside its glyph`);
          assert.ok(x >= 0 && x < L.width && y >= 0 && y < L.height, `${label}: peg outside the block`);
          assert.ok(!taken.has(key), `${label}: two pegs in one socket`);
          taken.add(key);
        }
      }
      // Kerning, checked on the set line: letters of a word never touch.
      for (let i = 1; i < l.chars.length; i++) {
        const a = l.chars[i - 1], b = l.chars[i];
        if (a.word !== b.word) continue;
        const A = new Set(); for (let j = 0; j < a.pegs.length; j += 2) A.add(a.pegs[j + 1] * 4096 + a.pegs[j]);
        for (let j = 0; j < b.pegs.length; j += 2) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
          assert.ok(!A.has((b.pegs[j + 1] + dy) * 4096 + b.pegs[j] + dx), `${label}: ${a.ch}${b.ch} touch`);
      }
    }
  }
  // A 1-2 letter word never ends a line (or a page), except at the very end.
  const ws = words(L).flat();
  ws.forEach((line, li) => { if (li < ws.length - 1) assert.ok(!SHORT(line[line.length - 1].text) || !L.strict, `${label}: line ends on ${line[line.length - 1].text}`); });
  checks++;
}

const stats = {fits:0, peg5:0, pages:{}, pitch:{}, relaxed:[]};
const results = [];
for (const [fmt, F] of Object.entries(FORMATS)) {
  const pitches = [];
  for (const line of LINES) {
    const r = fit(line, {font:[FACES.peg9, FACES.peg5], format:fmt});
    const label = `${fmt} "${line}"`;
    ok(r.layout && !r.belowMin && r.pitch >= 9, `${label}: fits at P ${r.pitch} >= 9`);
    // The short-word rule holds unless no face allows it at P >= 9 at all.
    if (!r.layout.strict) stats.relaxed.push(label);
    ok(r.layout.strict || [FACES.peg9, FACES.peg5].every(face => !fit(line, {font:face, format:fmt, maxPitch:9}).layout?.strict), `${label}: no line ends on a short word`);
    const face = FACES[r.font];
    // Every lit cell lies inside the safe area, on a board that covers the frame.
    const {safe} = F, P = r.pitch;
    ok(r.cols === Math.floor(F.width / P) && r.rows === Math.floor(F.height / P) && r.boardX >= 0 && r.boardY >= 0, `${label}: board covers the frame`);
    ok(r.boardX + (r.originX) * P >= safe.x && r.boardX + (r.originX + r.layout.width) * P <= safe.x + safe.w, `${label}: inside the safe width`);
    ok(r.boardY + (r.originY) * P >= safe.y && r.boardY + (r.originY + r.layout.height) * P <= safe.y + safe.h, `${label}: inside the safe height`);
    ok(r.originX + r.layout.width <= r.cols && r.originY + r.layout.height <= r.rows, `${label}: on the board`);
    const maxCols = Math.floor((safe.x + safe.w - r.boardX) / P) - Math.ceil((safe.x - r.boardX) / P);
    checkLayout(r.layout, face, {k:1, maxCols, maxLines:F.maxLines, label});
    stats.fits++; stats.peg5 += r.font === 'peg5';
    stats.pages[r.pages] = (stats.pages[r.pages] || 0) + 1;
    pitches.push(r.pitch);
    results.push([fmt, line, r.font, r.pitch, r.originX, r.originY, words(r.layout).map(p => p.map(l => l.map(w => w.text).join(' ')))]);
  }
  pitches.sort((a, b) => a - b);
  stats.pitch[fmt] = `${pitches[0]}-${pitches[pitches.length - 1]} (median ${pitches[pitches.length >> 1]})`;
}
{ // The spec's own examples.
  const r = fit("Couldn't have done it without my amazing team.", {font:FACES.peg9, format:'9:16'});
  ok(r.pages === 2, 'fit: "Couldn\'t have done it without my amazing team." pages in 9:16');
  const lets = fit("Let's circle back", {font:FACES.peg9, format:'9:16'});
  ok(lets.pages === 1 && lets.layout.pages[0].lines.length === 3 && lets.pitch > 20, "fit: LET'S / CIRCLE / BACK, large");
  ok(fit('Synergy', {font:FACES.peg9, format:'16:9'}).layout.pages[0].lines.length === 1, 'fit: one word, one line');
  const tiny = fit('Antidisestablishmentarianism', {font:FACES.peg9, width:300, height:300, safe:{x:0, y:0, w:300, h:300}});
  ok(tiny.belowMin && tiny.pitch < 9 && tiny.layout.width * tiny.pitch <= 300, 'fit: below minPitch only as a last resort, and says so');
  ok(fit('Pivot', {font:FACES.peg3, format:'9:16', minPitch:9}).pitch >= 12, 'fit: PEG-3 never below its own floor');
}
{ // Paging, k, alignment, edge cases.
  const f = FACES.peg9, text = 'It’s not about the tools. It’s about the mindset.';
  const L = layoutText(text, {font:f, maxCols:60, maxLines:2});
  checkLayout(L, f, {k:1, maxCols:60, maxLines:2, label:'paging'});
  ok(L.pages.length >= 2 && words(L).flat().length === L.pages.reduce((n, p) => n + p.lines.length, 0), 'layout: overflow becomes pages of whole words');
  const L2 = layoutText(text, {font:f, maxCols:120, maxLines:2, k:2});
  checkLayout(L2, f, {k:2, maxCols:120, maxLines:2, label:'k2'});
  const L1 = layoutText(text, {font:f, maxCols:60, maxLines:2});
  ok(L2.width === L1.width * 2 && L2.height === L1.height * 2, 'layout: k = 2 scales every advance');
  const left = layoutText('A BB CCC', {font:f, maxCols:16, align:'left'});
  ok(left.pages[0].lines.every(l => l.x === 0), 'layout: align left');
  ok(layoutText('Let that sink in', {font:f, maxCols:40}).pages[0].lines.at(-1).chars.at(-1).ch === 'N', 'layout: a short word may end the text');
  ok(words(layoutText('Not just a job — a calling.', {font:f, maxCols:60})).flat().every(l => l[0].text !== '–'), 'layout: a dash never opens a line');
  const empty = layoutText('🚀', {font:f});
  ok(empty.width === 0 && empty.height === 0 && empty.pages.length === 0 && empty.dropped[0] === '🚀', 'layout: nothing left to show, no pages');
  assert.throws(() => layoutText('ok', {font:compileFont({name:'t', rows:1, descent:1, space:1, glyphs:{O:{w:1, bits:['#']}}})})); checks++;
}

// ===========================================================================
// 7. Determinism: the same text always gives the same pegs.
{
  const digest = () => {
    const h = createHash('sha256'), faces = Object.fromEntries(Object.entries(DEFS).map(([id, d]) => [id, compileFont(d)]));
    for (const line of LINES) for (const fmt of Object.keys(FORMATS)) {
      const r = fit(line, {font:[faces.peg9, faces.peg5], format:fmt});
      h.update(`${fmt}|${r.font}|${r.pitch}|${r.originX},${r.originY}|`);
      for (const p of r.layout.pages) for (const l of p.lines) for (const c of l.chars) h.update(`${c.ch}${c.index}:${Array.from(c.pegs).join(',')};`);
    }
    return h.digest('hex');
  };
  const a = digest(), b = digest();
  ok(a === b, 'determinism: two runs, identical pegs');
  const once = JSON.stringify(layoutText(SAMPLE_POST, {font:FACES.peg5, maxCols:90, maxLines:3}), (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
  ok(once === JSON.stringify(layoutText(SAMPLE_POST, {font:FACES.peg5, maxCols:90, maxLines:3}), (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v), 'determinism: layout');
  console.log(`layout digest ${a.slice(0, 16)}`);
}

if (process.argv.includes('--list')) for (const r of results) console.log(r[0].padEnd(5), r[2], String(r[3]).padStart(2), r[6].map(p => p.join(' / ')).join('  ||  '));
console.log(`fits: ${stats.fits} (lines x formats), PEG-5 fallback ${stats.peg5}, pages ${JSON.stringify(stats.pages)}, short-word rule relaxed ${stats.relaxed.length}${stats.relaxed.length ? ': ' + stats.relaxed.join('; ') : ''}`);
console.log(`pitch px: ${Object.entries(stats.pitch).map(([f, s]) => `${f} ${s}`).join(', ')}`);

console.log(`pixel type: ${checks} checks passed`);
