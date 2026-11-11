// SYNERGY.EXE app icons and share card, drawn from the game's own sprites and
// the site's pixel faces. Writes PNGs to public/game/. No dependencies.
//
//   node scripts/make-game-icons.mjs

import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { C, SP, HEAD, frame, PEG5 } from '../src/game/art.js';

const out = new URL('../public/game/', import.meta.url);
mkdirSync(out, { recursive:true });
const ARCADE = JSON.parse(readFileSync(new URL('../public/home-arcade/assets/fonts/glyphs.json', import.meta.url), 'utf8'));

const rgb = hex => { const h = hex.replace('#', ''), f = h.length === 3 ? [...h].map(c => c + c).join('') : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
function canvas(w, h, bg) {
  const px = new Uint8Array(w * h * 4), [br, bgc, bb] = rgb(bg);
  for (let i = 0; i < w * h; i++) { px[i * 4] = br; px[i * 4 + 1] = bgc; px[i * 4 + 2] = bb; px[i * 4 + 3] = 255; }
  const R = (x, y, rw, rh, c) => { const [r, g, b] = rgb(c); x = Math.round(x); y = Math.round(y);
    for (let j = Math.max(0, y); j < Math.min(h, y + rh); j++) for (let i = Math.max(0, x); i < Math.min(w, x + rw); i++) { const o = (j * w + i) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; } };
  const bmp = (rows, pal, x, y, k) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') R(x + i * k, y + j * k, k, k, pal[ch]); }));
  // bits: array of row strings, lit where the character is `on`
  const glyphs = (s, x, y, k, c, get, gap, space) => { for (const ch of s) { if (ch === ' ') { x += space * k; continue; } const g = get(ch); if (!g) continue;
    g.rows.forEach((row, j) => [...row].forEach((b, i) => { if (b === g.on) R(x + i * k, y + j * k, k, k, c); })); x += (g.rows[0].length + gap) * k; } return x; };
  const peg = (s, x, y, k, c) => glyphs(s.toUpperCase(), x, y, k, c, ch => PEG5.glyphs[ch] && { rows:PEG5.glyphs[ch].bits, on:'#' }, 1, 3);
  const arcade = (s, x, y, k, c) => glyphs(s.toUpperCase(), x, y, k, c, ch => ARCADE[ch] && { rows:ARCADE[ch].split('/'), on:'1' }, 1, 5);
  const png = () => {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let j = 0; j < h; j++) { raw[j * (w * 4 + 1)] = 0; Buffer.from(px.buffer, j * w * 4, w * 4).copy(raw, j * (w * 4 + 1) + 1); }
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0); return Buffer.concat([len, body, crc]); };
    const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level:9 })), chunk('IEND', Buffer.alloc(0))]);
  };
  return { w, h, R, bmp, peg, arcade, png };
}
const dots = (c, step, size) => { for (let y = step / 2; y < c.h; y += step) for (let x = step / 2; x < c.w; x += step) c.R(x, y, size, size, '#0a1533'); };

// The icon: Synergy's head on the void. `fill` is how much of the square the head takes.
function icon(size, fill) {
  const c = canvas(size, size, C.void), k = Math.max(1, Math.floor(size * fill / 16));
  dots(c, k * 2, Math.max(1, k >> 2));
  c.bmp(HEAD, SP, Math.round((size - 16 * k) / 2), Math.round((size - 11 * k) / 2), k);
  return c.png();
}
writeFileSync(new URL('icon-192.png', out), icon(192, .74));
writeFileSync(new URL('icon-512.png', out), icon(512, .74));
writeFileSync(new URL('icon-maskable-512.png', out), icon(512, .52));
writeFileSync(new URL('apple-touch-icon.png', out), icon(180, .74));

// The share card, 1200 x 630.
{
  const c = canvas(1200, 630, C.void);
  dots(c, 24, 3);
  c.bmp(frame('idle'), SP, 84, 105, 21);
  const x = 500;
  c.arcade('SYNERGY.EXE', x, 118, 7, '#eef1f8');
  c.arcade('CAREER MODE', x, 196, 3, C.cobalt);
  for (let i = x; i < 1116; i += 12) c.R(i, 246, 6, 6, C.cobalt);
  c.peg('SYNERGY SAID', x, 292, 6, C.cream); c.peg('SOMETHING TRUE.', x, 352, 6, C.cream); c.peg('NOBODY REACTED.', x, 412, 6, C.signal);
  for (let i = x; i < 1116; i += 12) c.R(i, 492, 6, 6, C.cobalt);
  c.peg('REALITY: THE COFFEE MACHINE BROKE.', x, 522, 3, '#8794b8');
  writeFileSync(new URL('og.png', out), c.png());
}
console.log('SYNERGY.EXE: wrote icon-192, icon-512, icon-maskable-512, apple-touch-icon and og to public/game/');
