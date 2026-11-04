// Layout classes of the video call, laid out separately for each format: a
// 1:1 or 16:9 cut is a re-layout, never a crop of the 9:16 master. Every tile
// keeps a 12 px gutter to its neighbours and to the frame edge, and a 12 px
// corner radius. Cells have ids, `<class>.<index>` in reading order, so a clip
// addresses its tile ('G6.3'); 'full' is the whole frame in any class.
//
// Cells nest: 'split.1>G4.2' is the third tile of a 2×2 laid inside the second
// half of a split (breakout rooms), 'G4.0>g2x4.5' a generic 2-column 4-row grid
// inside a tile (cell split). Nested grids keep the gutter, with no outer margin.
//
// board: where the Peg Board draws in this layout (every class has one, inside the format's
// platform-safe area; boardOver: a panel laid over the picture). banner: the
// screen-share banner.
// All rects are output pixels {x, y, w, h}; cells add r (corner radius) and id.

import {FORMATS as TYPE_FORMATS} from '../pegboard/font.js';

export const FORMATS = {
  '9:16':{w:1080, h:1920},
  '1:1':{w:1080, h:1080},
  '16:9':{w:1920, h:1080},
};
export const FORMAT_NAMES = Object.keys(FORMATS);
// The platform-safe area of each format (pegboard/font.js): the Peg Board's type stays inside.
export const SAFE = Object.freeze(Object.fromEntries(Object.keys(FORMATS).map(k => [k, Object.freeze({...TYPE_FORMATS[k].safe})])));
// A board region sits inside the safe band (top to bottom) of its format; a full-bleed board
// (the whole frame) passes when its type does (boardTypeBounds in gl/board-layer.js).
export const insideSafeBand = (format, r) => r.y >= SAFE[format].y - 1e-9 && r.y + r.h <= SAFE[format].y + SAFE[format].h + 1e-9;
export const GUTTER = 12, RADIUS = 12;
export const CLASSES = ['L1', 'split', 'stack3', 'G4', 'G6', 'G9', 'BOARD', 'BOARD+STRIP'];

const rect = (x, y, w, h) => ({x, y, w, h});
// cols × rows tiles of w × h with gutter g, the block's top-left at (x, y).
function block(x, y, cols, rows, w, h, g = GUTTER) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(rect(x + c * (w + g), y + r * (h + g), w, h));
  return out;
}
// cols × rows tiles filling a rect exactly, gutter g between them (whole pixels:
// the remainder goes to the last row and column, never outside the rect).
export function gridIn(r, cols, rows, g = GUTTER) {
  const w = Math.floor((r.w - (cols - 1) * g) / cols), h = Math.floor((r.h - (rows - 1) * g) / rows), out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = r.x + i * (w + g), y = r.y + j * (h + g);
    out.push(rect(x, y, i === cols - 1 ? r.x + r.w - x : w, j === rows - 1 ? r.y + r.h - y : h));
  }
  return out;
}

const M = GUTTER;
// The geometry, per format. Every call layout gives the Peg Board a region inside the
// platform-safe area of its format (pegboard/font.js FORMATS: 9:16 type stays between y 300
// and 1440, clear of the Reels / TikTok / Shorts header and caption; 1:1 between 60 and 900;
// 16:9 between 54 and 1026), so the song's words always have somewhere to light:
//   9:16  G6 and G9 are compact galleries from y 288 (the plan's 344×258 tile) with the board
//         strip under them, y 1098-1440. split and G4 fill the frame with the board across
//         the middle, y 790-1130; stack3 puts it between its second and third tile, y 1048-1390.
//   1:1   rows of 390 above and below a band at y 414-666 (stack3 and G9: below the first row).
//   16:9  the call on the left 1398 px, the board in a column on the right, y 54-1026.
// L1 keeps the whole frame for its picture; its board is a panel laid over the picture
// (boardOver), in the safe area below the face. BOARD is full bleed: its type is centred,
// inside the safe band. BOARD+STRIP puts the board at y 340-1100 over 3 tiles of 344×258.
const rows2 = (F, top, h, cols, w) => [...block(M, top, cols, 1, w, h), ...block(M, F - M - h, cols, 1, w, h)];
const GEOMETRY = {
  '9:16':{
    L1:{cells:[rect(M, M, 1056, 1896)], board:rect(M, 1098, 1056, 342), boardOver:true},
    split:{cells:rows2(1920, M, 766, 1, 1056), board:rect(M, 790, 1056, 340)},
    stack3:{cells:[rect(M, M, 1056, 506), rect(M, 530, 1056, 506), rect(M, 1402, 1056, 506)], board:rect(M, 1048, 1056, 342)},
    G4:{cells:rows2(1920, M, 766, 2, 522), board:rect(M, 790, 1056, 340)},
    G6:{cells:block(M, 288, 2, 3, 522, 258), board:rect(M, 1098, 1056, 342)},
    G9:{cells:block(M, 288, 3, 3, 344, 258), board:rect(M, 1098, 1056, 342)},
    BOARD:{cells:[rect(0, 0, 1080, 1920)], board:rect(0, 0, 1080, 1920), radius:0},
    'BOARD+STRIP':{cells:block(M, 1112, 3, 1, 344, 258), board:rect(0, 340, 1080, 760), banner:rect(M, 274, 1056, 54)},
  },
  '1:1':{
    L1:{cells:[rect(M, M, 1056, 1056)], board:rect(M, 648, 1056, 252), boardOver:true},
    split:{cells:rows2(1080, M, 390, 1, 1056), board:rect(M, 414, 1056, 252)},
    stack3:{cells:[rect(M, M, 1056, 256), rect(M, 544, 1056, 256), rect(M, 812, 1056, 256)], board:rect(M, 280, 1056, 252)},
    G4:{cells:rows2(1080, M, 390, 2, 522), board:rect(M, 414, 1056, 252)},
    G6:{cells:rows2(1080, M, 390, 3, 344), board:rect(M, 414, 1056, 252)},
    G9:{cells:[...block(M, M, 3, 1, 344, 256), ...block(M, 544, 3, 2, 344, 256)], board:rect(M, 280, 1056, 252)},
    BOARD:{cells:[rect(0, 0, 1080, 1080)], board:rect(0, 0, 1080, 1080), radius:0},
    'BOARD+STRIP':{cells:block(M, 810, 3, 1, 344, 258), board:rect(0, 72, 1080, 726), banner:rect(M, M, 1056, 48)},
  },
  '16:9':{
    L1:{cells:[rect(M, M, 1896, 1056)], board:rect(1422, 54, 486, 972), boardOver:true},
    split:{cells:gridIn(rect(M, M, 1398, 1056), 2, 1), board:rect(1422, 54, 486, 972)},
    stack3:{cells:gridIn(rect(M, M, 1398, 1056), 3, 1), board:rect(1422, 54, 486, 972)},
    G4:{cells:gridIn(rect(M, M, 1398, 1056), 2, 2), board:rect(1422, 54, 486, 972)},
    G6:{cells:gridIn(rect(M, M, 1398, 1056), 3, 2), board:rect(1422, 54, 486, 972)},
    G9:{cells:block(M, M, 3, 3, 458, 344), board:rect(1422, 54, 486, 972)},
    BOARD:{cells:[rect(0, 0, 1920, 1080)], board:rect(0, 0, 1920, 1080), radius:0},
    'BOARD+STRIP':{cells:block(420, 810, 3, 1, 344, 258), board:rect(0, 72, 1920, 726), banner:rect(M, M, 1896, 48)},
  },
};

const cache = new Map();
// The layout of a class in a format: {cls, format, w, h, gutter, radius, cells, board, boardOver, banner}.
export function layout(cls, format) {
  const key = `${cls}|${format}`;
  if (cache.has(key)) return cache.get(key);
  const F = FORMATS[format], G = GEOMETRY[format]?.[cls];
  if (!F) throw Error(`unknown format "${format}" (${FORMAT_NAMES.join(', ')})`);
  if (!G) throw Error(`unknown layout class "${cls}" (${CLASSES.join(', ')})`);
  const radius = G.radius ?? RADIUS;
  const out = Object.freeze({cls, format, w:F.w, h:F.h, gutter:GUTTER, radius,
    cells:G.cells.map((c, i) => Object.freeze({id:`${cls}.${i}`, ...c, r:radius})),
    board:G.board ? Object.freeze({...G.board}) : null, boardOver:!!G.boardOver, banner:G.banner ? Object.freeze({...G.banner}) : null});
  cache.set(key, out);
  return out;
}
export const allLayouts = format => CLASSES.map(c => layout(c, format));
export const capacity = cls => GEOMETRY['9:16'][cls].cells.length;
// The auto-director's rule: 1 active stem → L1, 2 → split, 3–4 → G4, 5–6 → G6, 7 or more → G9.
export const classForCount = n => n <= 1 ? 'L1' : n === 2 ? 'split' : n <= 4 ? 'G4' : n <= 6 ? 'G6' : 'G9';

// Grid shape of a class when nested inside a rect: tall rects stack, wide ones row up.
function nestedShape(cls, r) {
  const tall = r.h > r.w;
  switch (cls) {
    case 'L1': case 'BOARD': return [1, 1];
    case 'split': return tall ? [1, 2] : [2, 1];
    case 'stack3': return tall ? [1, 3] : [3, 1];
    case 'G4': return [2, 2];
    case 'G6': return tall ? [2, 3] : [3, 2];
    case 'G9': return [3, 3];
    default: return null;
  }
}

// The top-level class of a cell id ('G6' for 'G6.3>g2x2.1'), or 'full'.
export function layoutClassOf(cellId) {
  const top = String(cellId).split('>')[0];
  if (top === 'full') return 'full';
  const i = top.lastIndexOf('.');
  return i > 0 ? top.slice(0, i) : null;
}

const rectCache = new Map();
// A cell id to its rect in a format: {id, cls, x, y, w, h, r}, or null when it does not exist.
export function cellRect(format, cellId) {
  const key = `${format}|${cellId}`;
  if (rectCache.has(key)) return rectCache.get(key);
  let out = null;
  try {
    const F = FORMATS[format];
    if (!F) return null;
    const parts = String(cellId).split('>');
    let r;
    const top = parts[0];
    if (top === 'full') r = {x:0, y:0, w:F.w, h:F.h, r:0};
    else {
      const i = top.lastIndexOf('.'), cls = top.slice(0, i), n = +top.slice(i + 1);
      if (i <= 0 || !GEOMETRY[format][cls] || !Number.isInteger(n)) return null;
      const L = layout(cls, format);
      if (n < 0 || n >= L.cells.length) return null;
      r = {...L.cells[n]};
    }
    for (const part of parts.slice(1)) {
      const g = /^g(\d+)x(\d+)\.(\d+)$/.exec(part), c = /^([A-Za-z0-9+]+)\.(\d+)$/.exec(part);
      let cols, rows, n;
      if (g) { cols = +g[1]; rows = +g[2]; n = +g[3]; }
      else if (c) { const shape = nestedShape(c[1], r); if (!shape) return null; [cols, rows] = shape; n = +c[2]; }
      else return null;
      if (!(cols >= 1 && rows >= 1 && n < cols * rows)) return null;
      const sub = gridIn(r, cols, rows)[n];
      if (!(sub.w > 0 && sub.h > 0)) return null;
      r = {...sub, r:Math.min(RADIUS, r.r ?? RADIUS)};
    }
    out = Object.freeze({id:cellId, cls:layoutClassOf(cellId), x:r.x, y:r.y, w:r.w, h:r.h, r:r.r ?? RADIUS});
    return out;
  } finally { rectCache.set(key, out); }
}

// Every cell of a class, as ids, for moves that fill a grid.
export const cellIds = (cls, format = '9:16') => layout(cls, format).cells.map(c => c.id);
