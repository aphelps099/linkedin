// SYNERGY.EXE art kit: palette, bitmap sprites and a pen that draws them.
// Canvas type is set in the site's own Peg Board faces (PEG-3 for labels,
// PEG-5 for signage), drawn pixel by pixel, so it is crisp at every scale and
// never waits on a font file.

import { PEG3 } from '../pegboard/fonts/peg3.js';
import { PEG5 } from '../pegboard/fonts/peg5.js';

export { PEG3, PEG5 };

export const C = { void:'#000', cobalt:'#1f6bff', dim:'#12306f', faint:'#0b1c44', deep:'#060d24', signal:'#ffe14a',
  cream:'#f0d9ae', tan:'#c9a877', grey:'#7d8597', visor:'#141a2b', led:'#3dff73', head:'#4a5163',
  white:'#fff', wall:'#f1e6cc', wall2:'#e6d8b8', carpet:'#1b2a59', carpet2:'#22346c', sky:'#a9d6f2',
  wood:'#d6c296', wood2:'#bfa978', ink:'#1a2140', paper:'#fbf6e6', hot:'#d9a400', night:'#050a1e' };

/* ---------- Synergy ---------- */
export const SP = { c:C.cream, d:C.tan, g:C.grey, k:C.visor, e:C.led, h:C.head, b:C.cobalt, w:C.white, n:'#3a4155' };
export const HEAD = [
  '......cc........',
  '.....cccc.......',
  '....ccgccc.hh...',
  '...ccggccccchh..',
  '..ccggkkkkkkkh..',
  '.cccgckekkekkhb.',
  'cccccckekkekkhb.',
  '.cccckkkkkkkkh..',
  '...ccckkeekkk...',
  '.....cggggc.h...',
  '......nnnn..h...'];
const TORSO = [
  '.....cbbbbc.....',
  '....ccbwwbcc....',
  '...dc.cggc.cd...',
  '...d..cggc..d...',
  '......cccc......'];
const LEGS = {
  idle:['.....cc..cc.....', '.....dd..dd.....', '.....cc..cc.....', '....ccc..ccc....'],
  runA:['....cc....cc....', '...dd......dd...', '..cc........cc..', '..cc.......ccc..'],
  runB:['......cccc......', '......dddd......', '......cccc......', '.....ccccc......'],
  jump:['....ccc..cc.....', '...dd.....dd....', '...c......cc....', '................'],
  sit: ['......ccccccc...', '......ddddddc...', '............c...', '...........cc...'] };
export const frame = k => HEAD.concat(TORSO, LEGS[k]);

/* ---------- colleagues ---------- */
export const PERSON = [
  '...hhhh...', '..hhhhhh..', '..hssssh..', '..ssssss..', '..ssssss..', '...ssss...',
  '..jjwwjj..', '.jjjwtjjj.', '.jjjwtjjj.', '.jjjjjjjj.', 'sjjjjjjjjs', 'sjjjjjjjjs', '..jjjjjj..',
  '..pppppp..', '..pp..pp..', '..pp..pp..', '..pp..pp..', '..pp..pp..', '..pp..pp..', '.kkk..kkk.'];
export const PERSON_FLAT = ['..hhhhhh..', '.hssssssh.', 'sjjjwtjjjs', 'sjjjjjjjjs', '.pppppppp.', '.kkk..kkk.'];
export const KEV = { h:'#5a3b22', s:'#e8b98f', j:'#f4f4f4', w:'#f4f4f4', t:C.cobalt, p:'#27356b', k:'#151a30' };
export const LIN = { h:'#2a2f45', s:'#c98f66', j:'#5d6788', w:'#f4f4f4', t:'#f4f4f4', p:'#3a4466', k:'#151a30' };
export const PEOPLE = {
  kev:{ n:'Kevin', h:'Partnerships | Connector of dots', pal:KEV },
  lin:{ n:'Linda', h:'Governance | Policy enthusiast', pal:LIN },
  arj:{ n:'Arjun', h:'Finance | Numbers person', pal:{ h:'#1d1d28', s:'#b98560', j:'#2f3a66', w:'#f4f4f4', t:'#8a6a00', p:'#27356b', k:'#151a30' } },
  rec:{ n:'Dana', h:'Talent Partner | Hiring rockstars', pal:{ h:'#a8672c', s:'#f0c9a4', j:'#7a2f4f', w:'#f4f4f4', t:'#f4f4f4', p:'#3a2a44', k:'#151a30' } },
  pat:{ n:'Pat', h:'Thought Leadership | Offline', pal:{ h:'#9aa3b8', s:'#c9cfdd', j:'#9aa3b8', w:'#c9cfdd', t:'#c9cfdd', p:'#8e97b3', k:'#6a7288' } } };

// The VP of Reactions. All face.
export const BOSS = [
  '..yyyyyyyy..', '.yyyyyyyyyy.', 'yykkyyyykkyy', 'yykkyyyykkyy', 'yyyyyyyyyyyy', 'ykyyyyyyyyky', 'yykkkkkkkkyy', '.yyyyyyyyyy.', '..yyyyyyyy..',
  '....jwwj....', '..jjjwtjjj..', '.jjjjwtjjjj.', 'yjjjjjtjjjjy', '..jjjjjjjj..', '..ppp..ppp..', '.kkkk..kkkk.'];
export const BOSS_PAL = { y:C.signal, k:C.ink, j:'#26336a', w:C.white, t:'#c0392b', p:'#1a2140' };

/* ---------- things ---------- */
export const ICONS = {
  like:['.....##....', '.....##....', '....###....', '....##.....', '.#########.', '.##.######.', '.##.######.', '.##.######.', '.##.#####..', '.##.####...', '...........'],
  celebrate:['..#..#..#..', '...#.#.#...', '...........', '...####....', '..######...', '.########..', '.########..', '..#######..', '...######..', '....####...', '...........'],
  support:['...........', '...##.##...', '..#######..', '...#####...', '....###....', '.....#.....', '#.........#', '##.......##', '.###...###.', '..#######..', '...........'],
  love:['...........', '..##...##..', '.####.####.', '.#########.', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....', '...........', '...........'],
  insightful:['....###....', '...#####...', '..#######..', '..#######..', '..#######..', '...#####...', '....###....', '....###....', '...........', '....###....', '...........'],
  funny:['...#####...', '..#.....#..', '.#.......#.', '#..##.##..#', '#.........#', '#.#.....#.#', '#..#####..#', '.#..###..#.', '..#.....#..', '...#####...', '...........'] };
export const ICON_KEYS = Object.keys(ICONS);
export const MUG = ['.s.s..', 's.s...', 'wwww..', 'wbbwww', 'wbbw.w', 'wwwwww', 'wwww..'];
export const MUG_PAL = { w:C.cream, b:C.cobalt, s:C.grey };
export const MAIL = ['wwwwwww', 'wbwwwbw', 'wwbbbww', 'wwwwwww'];
export const NOTE = ['yyyyy', 'ykkky', 'yyyyy', 'ykkyy', 'yyyy.'];

/* ---------- the pen ---------- */
const FOLD = { '’':"'", '‘':"'", '“':'"', '”':'"', '—':'–', '·':'-', '|':'/' };
const glyph = (font, ch) => font.glyphs[ch] || font.glyphs[FOLD[ch]] || font.glyphs[ch.toUpperCase()] || null;

export function measure(s, font = PEG3, k = 1) {
  let w = 0;
  for (const ch of String(s)) { const g = ch === ' ' ? null : glyph(font, ch); w += (ch === ' ' ? font.space : g ? g.w + font.tracking : 0); }
  return Math.max(0, w - (s.length && s[s.length - 1] !== ' ' ? font.tracking : 0)) * k;
}

// A pen draws in game units on one canvas context.
export function makePen(ctx) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const wire = (x, y, w, h, c) => { R(x, y, w, 1, c); R(x, y + h - 1, w, 1, c); R(x, y, 1, h, c); R(x + w - 1, y, 1, h, c); };
  function bmp(rows, pal, x, y, flip = false, k = 1) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < rows.length; j++) { const row = rows[j], n = row.length;
      for (let i = 0; i < n; i++) { const ch = row[i]; if (ch === '.') continue;
        ctx.fillStyle = typeof pal === 'string' ? pal : pal[ch];
        ctx.fillRect(x + (flip ? n - 1 - i : i) * k, y + j * k, k, k); } }
  }
  // Same sprite, fewer pixels: one block per `q` source pixels. The VP loses resolution as he loses the room.
  function mosaic(rows, pal, x, y, flip, k, q) {
    x = Math.round(x); y = Math.round(y);
    const n = rows[0].length;
    for (let j = 0; j < rows.length; j += q) for (let i = 0; i < n; i += q) {
      const ch = (rows[Math.min(rows.length - 1, j + (q >> 1))] || '')[Math.min(n - 1, i + (q >> 1))];
      if (!ch || ch === '.') continue;
      ctx.fillStyle = pal[ch];
      const w = Math.min(q, n - i), h = Math.min(q, rows.length - j);
      ctx.fillRect(x + (flip ? n - i - w : i) * k, y + j * k, w * k, h * k);
    }
  }
  // y is the top of the capitals. Returns the width drawn.
  function text(s, x, y, color, { font = PEG3, align = 'left', k = 1 } = {}) {
    s = String(s);
    const w = measure(s, font, k);
    let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    y = Math.round(y); ctx.fillStyle = color;
    for (const ch of s) {
      if (ch === ' ') { cx += font.space * k; continue; }
      const g = glyph(font, ch); if (!g) continue;
      for (let j = 0; j < g.bits.length; j++) { const row = g.bits[j]; for (let i = 0; i < g.w; i++) if (row[i] === '#') ctx.fillRect(cx + i * k, y + j * k, k, k); }
      cx += (g.w + font.tracking) * k;
    }
    return w;
  }
  const ticks = (cx, y, c) => { R(cx, y - 4, 1, 3, c); R(cx - 4, y - 2, 1, 1, c); R(cx - 3, y - 1, 1, 1, c); R(cx + 4, y - 2, 1, 1, c); R(cx + 3, y - 1, 1, 1, c); };
  // A boxed label, centred on cx with its top at y.
  function chip(s, cx, y, fg, edge, bg = C.void) {
    const w = measure(s) + 8, x = Math.round(cx - w / 2);
    R(x, y, w, 11, bg); wire(x, y, w, 11, edge); text(s, x + 4, y + 3, fg);
    return w;
  }
  return { ctx, R, wire, bmp, mosaic, text, ticks, chip };
}

// A little portrait for the DOM (post header, comments).
export function avatar(rows, pal, flip) {
  const c = document.createElement('canvas'), n = rows[0].length; c.width = c.height = n; c.className = 'av';
  const g = c.getContext('2d'), oy = Math.max(0, (n - rows.length) >> 1);
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(flip ? n - 1 - i : i, j + oy, 1, 1); } }));
  return c;
}
