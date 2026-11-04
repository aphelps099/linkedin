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
// board: where the Peg Board draws when the layout gives it a region (null: the
// board lives in a cell, or over the frame). banner: the screen-share banner.
// All rects are output pixels {x, y, w, h}; cells add r (corner radius) and id.

export const FORMATS = {
  '9:16':{w:1080, h:1920},
  '1:1':{w:1080, h:1080},
  '16:9':{w:1920, h:1080},
};
export const FORMAT_NAMES = Object.keys(FORMATS);
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
// The geometry, per format. Where the plan fixes numbers they are used as given:
// 9:16 G6 is 2×3 tiles of 522×392 at y 288 / 692 / 1096; G9 is 3×3 of 344×258
// with a board strip; BOARD+STRIP puts the board at y 340–1100 over 3 tiles of
// 344×258; stack3 is three 16:9 tiles (1056×594 once the gutters are taken).
const GEOMETRY = {
  '9:16':{
    L1:{cells:[rect(M, M, 1056, 1896)]},
    split:{cells:gridIn(rect(M, M, 1056, 1896), 1, 2)},
    stack3:{cells:block(M, 57, 1, 3, 1056, 594)},
    G4:{cells:gridIn(rect(M, M, 1056, 1896), 2, 2)},
    G6:{cells:block(M, 288, 2, 3, 522, 392), board:rect(M, 1500, 1056, 408)},
    G9:{cells:block(M, 288, 3, 3, 344, 258), board:rect(M, 1098, 1056, 390)},
    BOARD:{cells:[rect(0, 0, 1080, 1920)], board:rect(0, 0, 1080, 1920), radius:0},
    'BOARD+STRIP':{cells:block(M, 1112, 3, 1, 344, 258), board:rect(0, 340, 1080, 760), banner:rect(M, 274, 1056, 54)},
  },
  '1:1':{
    L1:{cells:[rect(M, M, 1056, 1056)]},
    split:{cells:gridIn(rect(M, M, 1056, 1056), 1, 2)},
    stack3:{cells:gridIn(rect(M, M, 1056, 1056), 1, 3)},
    G4:{cells:gridIn(rect(M, M, 1056, 1056), 2, 2)},
    G6:{cells:gridIn(rect(M, M, 1056, 1056), 2, 3)},
    G9:{cells:block(M, M, 3, 3, 344, 256), board:rect(M, 816, 1056, 252)},
    BOARD:{cells:[rect(0, 0, 1080, 1080)], board:rect(0, 0, 1080, 1080), radius:0},
    'BOARD+STRIP':{cells:block(M, 810, 3, 1, 344, 258), board:rect(0, 72, 1080, 726), banner:rect(M, M, 1056, 48)},
  },
  '16:9':{
    L1:{cells:[rect(M, M, 1896, 1056)]},
    split:{cells:gridIn(rect(M, M, 1896, 1056), 2, 1)},
    stack3:{cells:gridIn(rect(M, M, 1896, 1056), 3, 1)},
    G4:{cells:gridIn(rect(M, M, 1896, 1056), 2, 2)},
    G6:{cells:gridIn(rect(M, M, 1896, 1056), 3, 2)},
    G9:{cells:block(M, M, 3, 3, 458, 344), board:rect(1422, M, 486, 1056)},
    BOARD:{cells:[rect(0, 0, 1920, 1080)], board:rect(0, 0, 1920, 1080), radius:0},
    'BOARD+STRIP':{cells:block(420, 810, 3, 1, 344, 258), board:rect(0, 72, 1920, 726), banner:rect(M, M, 1896, 48)},
  },
};

const cache = new Map();
// The layout of a class in a format: {cls, format, w, h, gutter, radius, cells, board, banner}.
export function layout(cls, format) {
  const key = `${cls}|${format}`;
  if (cache.has(key)) return cache.get(key);
  const F = FORMATS[format], G = GEOMETRY[format]?.[cls];
  if (!F) throw Error(`unknown format "${format}" (${FORMAT_NAMES.join(', ')})`);
  if (!G) throw Error(`unknown layout class "${cls}" (${CLASSES.join(', ')})`);
  const radius = G.radius ?? RADIUS;
  const out = Object.freeze({cls, format, w:F.w, h:F.h, gutter:GUTTER, radius,
    cells:G.cells.map((c, i) => Object.freeze({id:`${cls}.${i}`, ...c, r:radius})),
    board:G.board ? Object.freeze({...G.board}) : null, banner:G.banner ? Object.freeze({...G.banner}) : null});
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
