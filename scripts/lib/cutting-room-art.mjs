// The Cutting Room's card art (the build spec, section 8), for scripts/publish-to-cutting-room.mjs.
//
//   typeArt({width, height, title, sub, levels | items, maxBytes, card}) -> JPEG
//     Audio and packs. The Peg Board drawn in Node: every socket of the board, the title lit in
//     PEG-9, a second line in PEG-5 white, LINKEDIN BEATS_ in PEG-3 with the underscore in signal.
//     A song's bottom third is its own loudness, one peg column per slice of the song (deep blue
//     up to blue, the loudest in signal); a pack's is one lit peg per item, a block per group, and
//     the count in PEG-9 signal. The same layout at 640x360 (the card) and 600x600 (the cover).
//     Never green: every colour is the board's own (blue, white, signal yellow on black).
//   framePoster(images, {width, height, maxBytes}) -> JPEG
//     Video. One image: a frame (cropped to fill when it is close to 16:9, else on black).
//     Three: a triptych, three portrait panels edge to edge with 8 px black gutters.
//   loudness(file, n) -> n levels in 0..1 (RMS per slice in dB, over the song's own range)
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {compileFont, layoutText} from '../../src/pegboard/font.js';
import {PEG9} from '../../src/pegboard/fonts/peg9.js';
import {PEG5} from '../../src/pegboard/fonts/peg5.js';
import {PEG3} from '../../src/pegboard/fonts/peg3.js';

const sharp = (() => { try { return createRequire(import.meta.url)('sharp'); } catch { return null; } })();
const need = () => { if (!sharp) throw new Error('sharp is not installed: run npm install'); return sharp; };
const F9 = compileFont(PEG9), F5 = compileFont(PEG5), F3 = compileFont(PEG3);

// The board's palette (src/pegboard): board, socket hole and lip, a lit peg's ring, core and glow,
// white type, signal yellow, and the deep blue the loudness columns start from.
export const PALETTE = {board:'#000000', hole:'#15181F', lip:'#232833', ring:'#2B78FF', core:'#DDEBFF', glow:'#1747FF',
  white:'#F5F8FF', signal:'#FFE14D', signalCore:'#FFF4C2', deep:'#1B3CFF', blue:'#2B78FF'};
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((x, i) => Math.round(x + (hex(b)[i] - x) * t).toString(16).padStart(2, '0')).join('');

// What the page lays over a card (src/cutting-room/style.css), in poster pixels. On a 175 px phone card
// the shortlist button covers x > 490, y < 125, and the kind and duration chips the bottom quarter; on a
// desktop card the chips cover the bottom 40-60 px. So a card's title stays left of x 490, the pack's
// count sits beside the second line (clear of both), and the data band is where the chips may cross it.
const CARD_FOOT = 40, CARD_TITLE_RIGHT = 490, CARD_BUTTON_FOOT = 130;

function lay(text, font, maxCols, maxLines) {
  try { const r = layoutText(text, {font, maxCols, maxLines, align:'left'}); return r.pages.length === 1 ? r : null; } catch { return null; }
}
const pegsOf = (layout, ox, oy) => layout.pages[0].lines.flatMap(l => l.chars.flatMap(c => {
  const out = [];
  for (let i = 0; i < c.pegs.length; i += 2) out.push([c.pegs[i] + ox, c.pegs[i + 1] + oy]);
  return out;
}));
const extent = pts => pts.reduce((e, [x, y]) => ({x0:Math.min(e.x0, x), x1:Math.max(e.x1, x), y0:Math.min(e.y0, y), y1:Math.max(e.y1, y)}), {x0:Infinity, x1:-Infinity, y0:Infinity, y1:-Infinity});

// The board's pitch: 5 px on a card (128 x 72 sockets), 8 on a square cover (75 x 75), always, so every
// card reads as one board and every cover as another. A title that does not set in PEG-9 at that pitch
// (2 lines on a card, 3 square) is refused: say it in fewer letters with --cover-text, never smaller.
const PITCH = {card:5, square:8}, MARGIN = 3;
function fit(width, height, title, square) {
  const P = square ? PITCH.square : PITCH.card, cols = Math.floor(width / P), right = square ? cols - MARGIN : Math.floor(CARD_TITLE_RIGHT / P);
  const t = lay(title, F9, right - MARGIN - 1, square ? 3 : 2);
  if (t && extent(pegsOf(t, MARGIN, 0)).x1 < right) return {P, T:t};               // inside the right edge too
  throw new Error(`"${title.replace(/\u2028/g, '|')}" does not set in PEG-9 on a ${width}x${height} board: give a shorter --cover-text (a | breaks the line)`);
}

// The second line is always PEG-5 on one line, the same words on the card and the cover. "Made in" values
// have short forms; any other line too long for the square cover loses words from the end ("Original track"
// sets as ORIGINAL). One word that still does not fit is refused.
export const SHORT = {"Aaron's tracks":'Aaron', 'Claude Code films':'Claude Code', 'Studio and meeting rooms':'Meeting rooms', 'Cutting Room originals':'Cutting Room'};
const SUB_ROOM = Math.floor(600 / PITCH.square) - 2 * MARGIN;                       // the square cover's 69 columns
export function subLine(sub) {
  let words = String(SHORT[sub] ?? sub ?? '').trim().split(/\s+/).filter(Boolean);
  for (; words.length; words = words.slice(0, -1)) {
    const t = lay(words.join(' '), F5, SUB_ROOM, 1);
    if (t && extent(pegsOf(t, 0, 0)).x1 < SUB_ROOM) return words.join(' ');
    if (words.length === 1) break;
  }
  if (!words.length) return '';
  throw new Error(`"${sub}" does not set in PEG-5 on one line of the cover: give a shorter --cover-sub`);
}

export async function typeArt({width, height, title, sub = '', levels = null, items = null, maxBytes = Infinity, card = width / height > 1.2}) {
  const S = need(), square = !card;
  title = String(title).replace(/\s*\|\s*/g, '\u2028');                              // "Studio 2|Song Kits": break there
  const {P, T} = fit(width, height, title, square);
  const cols = Math.floor(width / P), rows = Math.floor(height / P);
  const ox = (width - cols * P) / 2 + P / 2, oy = (height - rows * P) / 2 + P / 2;
  const m = 3;                                                            // margin, in pegs
  const lit = new Map();                                                  // "x,y" -> role
  const put = (pts, role) => { for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < cols && y < rows) lit.set(`${x},${y}`, role); };

  // LINKEDIN BEATS_ (PEG-3 white, the underscore in signal), top left.
  const mark = lay('LINKEDIN BEATS', F3, cols, 1), markPegs = pegsOf(mark, m, m), me = extent(markPegs);
  put(markPegs, 'white');
  put([0, 1, 2].map(i => [me.x1 + 2 + i, me.y1]), 'signal');
  // The title, lit, and the second line in white under it.
  const ty = me.y1 + 4;
  const titlePegs = pegsOf(T, m, ty), te = extent(titlePegs);
  put(titlePegs, 'lit');
  let bottom = te.y1, textRight = te.x1;
  sub = subLine(sub);
  if (sub) {
    const S5 = lay(sub, F5, cols - 2 * m, 1);
    const sp = pegsOf(S5, m, te.y1 + 3), se = extent(sp); put(sp, 'white'); bottom = se.y1; textRight = Math.max(textRight, se.x1);
  }
  // The data band: the bottom third, above the card's chips (or the margin, square).
  const floor = rows - (card ? Math.ceil(CARD_FOOT / P) + 1 : m);
  const top = Math.max(bottom + 3, Math.floor(rows * 2 / 3));
  const span = cols - 2 * m;

  if (levels && levels.length && floor - top >= 3) {
    // One column per slice of the song, its height the slice's loudness: deep blue at the foot up to
    // blue; the loudest column in signal.
    const n = span, h = floor - top;
    const bars = Array.from({length:n}, (_, i) => {
      const a = Math.floor(i * levels.length / n), b = Math.max(a + 1, Math.floor((i + 1) * levels.length / n));
      return Math.max(...levels.slice(a, b));
    });
    const peak = bars.indexOf(Math.max(...bars));
    bars.forEach((v, i) => {
      const k = Math.max(1, Math.round(v * h));
      for (let j = 0; j < k; j++) lit.set(`${m + i},${floor - 1 - j}`, i === peak ? 'signal' : `col:${(j / Math.max(1, h - 1)).toFixed(3)}`);
    });
  }
  if (items && items.count) {
    // One lit block per item, stacked in columns from the floor like a song's loudness: groups in order,
    // each its own columns, alternately lit and deep, so a pack's shape is its groups' sizes. A block is
    // as many pegs square as the band allows (one empty socket between blocks, three between groups), so
    // five takes fill the band as fully as 294 do. The count in PEG-9 signal: on a card, right-aligned on
    // the second line's baseline (where nothing on the page covers it); square, at the band's bottom right.
    const N = lay(String(items.count), F9, cols, 1), np = pegsOf(N, 0, 0), ne = extent(np);
    const nx = cols - m - ne.x1 - 1, ny = Math.max(bottom - ne.y1, Math.ceil(CARD_BUTTON_FOOT / P));   // below the button
    const beside = card && textRight + 4 < nx && ny + ne.y1 < top;
    put(np.map(([x, y]) => [x + nx, beside ? y + ny : y + floor - 1 - ne.y1]), 'signal');
    const room = span - (beside ? 0 : (ne.x1 + 1) + 4), h = floor - top;
    const sizes = items.groups && items.groups.length ? items.groups : [items.count];
    // The largest block that fits, laid out two ways: each group its own columns (the pack's shape is its
    // groups' sizes), or one grid filled from the floor, groups told apart by colour alone, which lets a
    // few items (seven auditions, one each) grow as large as the band allows. The bigger block wins; a
    // tie keeps the groups' columns. At one peg the grid is every other socket (the board's own rhythm);
    // failing that, every socket.
    const n = sizes.reduce((a, g) => a + g, 0), groupOf = sizes.flatMap((g, gi) => Array(g).fill(gi));
    let cols_ = null, grid = null;
    for (let b = Math.min(h, 16); b >= 1 && !cols_; b--) {
      const R = Math.floor((h + 1) / (b + 1));
      if (R < 1) continue;
      const width = sizes.reduce((w, g) => w + Math.ceil(g / R) * (b + 1) - 1, 0) + (sizes.length - 1) * 2;
      if (width <= room) cols_ = {b, step:b + 1, R, gap:2};
    }
    for (let b = Math.min(h, 16); b >= 1 && !grid; b--) {
      const C = Math.floor((room + 1) / (b + 1)), R = Math.floor((h + 1) / (b + 1));
      if (C >= 1 && R >= 1 && C * R >= n) grid = {b, step:b + 1, C};
    }
    if (!cols_ && !grid && sizes.reduce((w, g) => w + Math.ceil(g / h), 0) + (sizes.length - 1) * 2 <= room) cols_ = {b:1, step:1, R:h, gap:2};
    const block = (cx, cy, b, gi) => { for (let dx = 0; dx < b; dx++) for (let dy = 0; dy < b; dy++) lit.set(`${m + cx + dx},${cy - dy}`, gi % 2 ? 'deep' : 'lit'); };
    if (grid && (!cols_ || grid.b > cols_.b)) {
      groupOf.forEach((gi, i) => block((i % grid.C) * grid.step, floor - 1 - Math.floor(i / grid.C) * grid.step, grid.b, gi));
    } else if (cols_) {
      let x = 0;
      sizes.forEach((g, gi) => {
        for (let i = 0; i < g; i++) block(x + Math.floor(i / cols_.R) * cols_.step, floor - 1 - (i % cols_.R) * cols_.step, cols_.b, gi);
        x += Math.ceil(g / cols_.R) * cols_.step - (cols_.step - cols_.b) + cols_.gap;
      });
    }
  }

  // Draw: every socket, then the glow under the lit pegs, then the pegs.
  const r = P * .36, holes = [], glow = [], pegs = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cx = +(ox + x * P).toFixed(2), cy = +(oy + y * P).toFixed(2), role = lit.get(`${x},${y}`);
    if (!role) { holes.push(`<circle cx="${cx}" cy="${cy}" r="${(r * .82).toFixed(2)}"/>`); continue; }
    if (role === 'lit') {
      glow.push(`<circle cx="${cx}" cy="${cy}" r="${(r * 1.25).toFixed(2)}"/>`);
      pegs.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${PALETTE.ring}"/><circle cx="${cx}" cy="${cy}" r="${(r * .55).toFixed(2)}" fill="${PALETTE.core}"/>`);
    } else if (role === 'white') pegs.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${PALETTE.white}"/>`);
    else if (role === 'signal') pegs.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${PALETTE.signal}"/><circle cx="${cx}" cy="${cy}" r="${(r * .5).toFixed(2)}" fill="${PALETTE.signalCore}"/>`);
    else if (role === 'deep') pegs.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${PALETTE.deep}"/>`);
    else pegs.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${mix(PALETTE.deep, PALETTE.blue, Number(role.slice(4)))}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(P * .45).toFixed(2)}"/></filter></defs>`
    + `<rect width="100%" height="100%" fill="${PALETTE.board}"/>`
    + `<g fill="${PALETTE.hole}" stroke="${PALETTE.lip}" stroke-width="${(P * .12).toFixed(2)}">${holes.join('')}</g>`
    + `<g fill="${PALETTE.glow}" filter="url(#g)" opacity=".7">${glow.join('')}</g>${pegs.join('')}</svg>`;
  const png = await S(Buffer.from(svg)).png().toBuffer();
  return jpeg(png, maxBytes, {typeArt:true});
}

// Pixels the check calls green (hue 80 to 160 degrees, saturation over .25, value over .2).
export async function greenPixels(image) {
  const {data, info} = await need()(image).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    if (max <= .2 || d / max <= .25) continue;
    const hue = ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    if (hue >= 80 && hue <= 160) n++;
  }
  return n;
}
// The best quality that fits the budget. Type art is drawn without green, but JPEG's ringing can
// tip a dark pixel between blue and black over the line; a quality that does is skipped.
async function jpeg(input, maxBytes, {typeArt = false} = {}) {
  const S = need();
  let out, last = '';
  for (const quality of [86, 83, 80, 77, 74, 71, 68, 65, 62, 59, 56, 53, 50, 47, 44, 41, 38]) {
    out = await S(input).jpeg({quality, chromaSubsampling:'4:4:4', mozjpeg:true}).toBuffer();
    if (out.length > maxBytes) { last = `${out.length} bytes at quality ${quality}`; continue; }
    if (typeArt && await greenPixels(out)) { last = `green ringing at quality ${quality}`; continue; }
    return out;
  }
  throw new Error(`art does not fit ${maxBytes} bytes without artifacts (${last})`);
}

// Video posters: one frame, or three as a triptych. `images` are file paths or Buffers.
export async function framePoster(images, {width = 640, height = 360, maxBytes = Infinity, gutter = 8} = {}) {
  const S = need();
  if (images.length === 3) {
    const pw = Math.floor((width - 2 * gutter) / 3), extra = width - 3 * pw - 2 * gutter;
    const panels = await Promise.all(images.map((img, i) => S(img).resize(pw + (i === 1 ? extra : 0), height, {fit:'cover', position:'centre'}).toBuffer()));
    const base = S({create:{width, height, channels:3, background:'#000000'}});
    const png = await base.composite(panels.map((input, i) => ({input, left:i * (pw + gutter) + (i === 2 ? extra : 0), top:0}))).png().toBuffer();
    return jpeg(png, maxBytes);
  }
  if (images.length !== 1) throw new Error('a poster is one frame or three (a triptych)');
  const meta = await S(images[0]).metadata(), ratio = meta.width / meta.height, want = width / height;
  const close = Math.abs(ratio / want - 1) <= .12;                         // 1988x1080 (1.84) fills; 9:16 sits on black
  const png = await S(images[0]).resize(width, height, {fit:close ? 'cover' : 'contain', background:'#000000'}).flatten({background:'#000000'}).png().toBuffer();
  return jpeg(png, maxBytes);
}

// A song's loudness: RMS per slice in dB, 0..1 over the song's own range.
export function loudness(file, n = 240) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], {maxBuffer:1 << 29});
  const s = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
  const slices = Math.max(1, Math.min(n, Math.floor(s.length / 80)));
  const db = Array.from({length:slices}, (_, i) => {
    const a = Math.floor(i * s.length / slices), b = Math.floor((i + 1) * s.length / slices);
    let e = 0; for (let j = a; j < b; j++) e += (s[j] / 32768) ** 2;
    return 10 * Math.log10(e / Math.max(1, b - a) + 1e-12);
  });
  // The song's own range: its loudest slice at the top, its 10th percentile near the floor (silence stays
  // at zero), so a steady master still shows its shape and a quiet intro reads as quiet.
  const top = Math.max(...db), sorted = db.filter(v => v > top - 60).sort((a, b) => a - b);
  const lo = Math.min(top - 6, sorted[Math.floor(sorted.length * .1)] ?? top - 24);
  return db.map(v => v <= top - 60 ? 0 : Math.max(.06, Math.min(1, .12 + .88 * (v - lo) / (top - lo))));
}
