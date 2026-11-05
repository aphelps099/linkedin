// The Peg Board inside the film frame. Each board region (the layout's board strip, the
// whole frame, a gen:board tile, a board cue's cell) gets its own board grid at the pitch
// that region calls for, painted by choreo.paint() at the frame's board time and drawn by
// the Peg Board's own WebGL2 renderer (src/pegboard/renderer-gl.js) straight into a texture
// of the compositor's context: no second canvas, no copy. The board looks exactly as it
// does on /allhands/ and /pixel-type/, bloom and sockets included.
//
//   const boards = createBoardLayer(gl, {plan, scale});
//   const tex = boards.draw({w, h, screens, time, pitch?, sockets?, kick?, gain?, transient?, psych?, sample?})   // WebGLTexture, w×h output px
//   boards.luma({w, h, screens, time, psych?})       predicted luminance (governor.js boardLuma)
//
// psych: the frame's psych entries for this region (compile: frame.board.psych), painted after the
// screens by pegboard/psych.js paintPsych, so the type always wins. sample(grid): the picture under the
// region at one value per peg ({cols, rows, data} RGBA, top row first), for the 'footage' look.
//
// Pegs are hits (edl/anchors.js): each lights on the frame that holds its audible onset. choreo
// keys every onset to the time it is given, and the compositor passes the middle of the frame
// less the engine's latency (gl/compositor.js boardTimeOf).
//
// safe: the columns type may use, {x0, x1} in region px (the platform-safe area of the format
// clipped to the region: in 9:16 type keeps left of the right rail, x 944). Lit pegs of a reveal
// or the ignition may still run edge to edge; words never do.
import {createBoard} from '../../pegboard/board.js';
import {createRendererGL} from '../../pegboard/renderer-gl.js';
import {compileFont, layoutText} from '../../pegboard/font.js';
import {PEG9} from '../../pegboard/fonts/peg9.js';
import {PEG5} from '../../pegboard/fonts/peg5.js';
import {PEG3} from '../../pegboard/fonts/peg3.js';
import {paint, boardState} from '../../pegboard/choreo.js';
import {paintPsych} from '../../pegboard/psych.js';
import {boardLuma} from '../../pegboard/governor.js';
import {pitchFor} from '../../pegboard/stage.js';
import {kickAt} from '../../pegboard/eq.js';

const FACES = {peg9:compileFont(PEG9), peg5:compileFont(PEG5), peg3:compileFont(PEG3)};
const ORDER = {peg9:['peg9', 'peg5', 'peg3'], peg5:['peg5', 'peg3'], peg3:['peg3']};

// The pitch for a board region: the stage's rule (~44 rows, 7-16 px), or a caller's pitch
// (peg video under the board: the two grids must coincide).
export const boardPitch = (w, h) => pitchFor(w, h);

// A board grid for a region: cols × rows at the pitch, centred, plus the stage's fitting
// rules (largest k that fits, then a narrower face; a full-board title fits on one page).
export function boardGrid(w, h, pitch = boardPitch(w, h), safe = null) {
  const cols = Math.max(1, Math.floor(w / pitch)), rows = Math.max(1, Math.floor(h / pitch));
  const board = createBoard(cols, rows), layouts = new Map();
  const ox = Math.floor((w - cols * pitch) / 2), oy = Math.floor((h - rows * pitch) / 2), textRows = rows - 1;
  // The columns type may use: two pegs of margin each side, inside the safe span.
  const c0 = safe ? Math.max(2, Math.ceil((safe.x0 - ox) / pitch)) : 2, c1 = safe ? Math.min(cols - 2, Math.floor((safe.x1 - ox) / pitch)) : cols - 2;
  const span = Math.max(1, c1 - c0);
  const roomOf = screen => screen.full ? rows - 2 : textRows;
  function layoutOf(screen) {
    if (layouts.has(screen)) return layouts.get(screen);
    let out = null;
    for (const face of ORDER[screen.font] ?? ORDER.peg9) {
      for (let k = screen.k ?? 1; k >= 1 && !out; k--) {
        const l = layoutText(screen.text, {font:FACES[face], k, maxCols:span, maxLines:screen.lines ?? ((screen.k ?? 1) > 1 ? 1 : 3)});
        if (l.width <= span && l.height <= roomOf(screen) && (!screen.full || l.pages.length === 1)) out = l;
      }
      if (out) break;
    }
    layouts.set(screen, out);
    return out;
  }
  const place = (screen, layout, page) => {
    const hh = page.lines.length ? Math.max(...page.lines.map(l => l.y + Math.max(...l.chars.map(c => c.y + c.h - l.y), 0))) : layout.height;
    const ww = page.lines.length ? Math.max(...page.lines.map(l => l.width)) : layout.width;
    return {x:c0 + Math.floor((span - ww) / 2), y:Math.max(1, Math.floor((roomOf(screen) - Math.min(hh, layout.height)) / 2))};
  };
  return {board, cols, rows, pitch, ox, oy, layoutOf, place, safe};
}
// The type columns of a region at (x, y, w, h) in a frame: the format's safe area, region-local.
export function safeSpan(rect, safe) {
  if (!safe) return null;
  const x0 = Math.max(0, safe.x - rect.x), x1 = Math.min(rect.w, safe.x + safe.w - rect.x);
  return x1 > x0 && (x0 > 0 || x1 < rect.w) ? {x0:Math.round(x0), x1:Math.round(x1)} : null;
}

// Where a screen's type lands in a board region of w × h output px: {x, y, w, h} over every
// page, in region px, or null when it does not fit. The full-frame board centres its type, so
// this is how a check proves the words stay inside the platform-safe band.
export function boardTypeBounds(w, h, screen, grid = boardGrid(w, h)) {
  const layout = grid.layoutOf(screen);
  if (!layout?.pages?.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const page of layout.pages) {
    const o = grid.place(screen, layout, page);
    for (const line of page.lines) for (const ch of line.chars) {
      const p = ch.pegs;
      for (let i = 0; i < p.length; i += 2) { const x = o.x + p[i], y = o.y + p[i + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
  }
  if (!Number.isFinite(x0)) return null;
  return {x:grid.ox + x0 * grid.pitch, y:grid.oy + y0 * grid.pitch, w:(x1 - x0 + 1) * grid.pitch, h:(y1 - y0 + 1) * grid.pitch};
}

export function createBoardLayer(gl, {plan, scale = 1, quality} = {}) {
  const instances = new Map();
  let tick = 0, moving = null;
  const MAX = 6;                       // the home, cue cells and psych cells: room for each without thrash

  function target(W, H) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return {tex, fb};
  }
  const keyOf = (w, h, pitch, safe) => `${w}x${h}@${pitch}${safe ? `|${safe.x0}-${safe.x1}` : ''}`;

  function instance(w, h, pitch, safe) {
    const key = keyOf(w, h, pitch, safe);
    let it = instances.get(key);
    if (it) { it.used = ++tick; return it; }
    if (instances.size >= MAX) {
      const old = [...instances.values()].sort((a, b) => a.used - b.used)[0];
      old.dispose(); instances.delete(old.key);
    }
    const grid = boardGrid(w, h, pitch, safe);
    const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
    const {tex, fb} = target(W, H);
    // The renderer believes it owns a canvas of W × H; it draws into our framebuffer instead.
    const fake = {width:W, height:H};
    const renderer = createRendererGL(fake, {gl, output:() => fb, pixelRatio:scale, quality});
    renderer.resize(w, h);
    it = {key, grid, tex, fb, renderer, w, h, W, H, used:++tick,
      dispose() { renderer.dispose(); gl.deleteTexture(tex); gl.deleteFramebuffer(fb); }};
    instances.set(key, it);
    return it;
  }
  // A moving board (a board move eases its rect every frame) has a new size on every frame: one
  // instance, its renderer resized and its texture remade, so no frame compiles shaders.
  function transient(w, h, pitch, safe) {
    const key = keyOf(w, h, pitch, safe), W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
    if (moving?.key === key) return moving;
    if (!moving) {
      const fake = {width:W, height:H}, out = {fb:null};
      const renderer = createRendererGL(fake, {gl, output:() => out.fb, pixelRatio:scale, quality});
      moving = {renderer, out, fake, tex:null, fb:null,
        dispose() { renderer.dispose(); if (this.tex) { gl.deleteTexture(this.tex); gl.deleteFramebuffer(this.fb); } }};
    }
    if (moving.tex) { gl.deleteTexture(moving.tex); gl.deleteFramebuffer(moving.fb); }
    const {tex, fb} = target(W, H);
    Object.assign(moving, {key, grid:boardGrid(w, h, pitch, safe), tex, fb, w, h, W, H});
    moving.out.fb = fb; moving.fake.width = W; moving.fake.height = H;
    moving.renderer.resize(w, h);
    return moving;
  }

  // Paint the board for a region at song time t. sockets: false hides the empty sockets
  // (the board laid over footage shows only its light).
  function paintGrid(grid, screens, t, {sockets = true, gain = 1, psych = null, sample = null} = {}) {
    paint(grid.board, screens, t, {plan, layoutOf:grid.layoutOf, place:grid.place});
    // Imagery on the dot grid, under the type: each entry carries its own time, drive and params.
    if (psych?.length) for (const p of psych) paintPsych(grid.board, p, p.time, {drive:p.drive, frame:p.look === 'footage' && sample ? sample(grid) : null});
    if (!sockets) grid.board.sockets = 0;
    grid.board.exposure *= gain;
    return grid.board;
  }

  return {
    // Draw a board region; returns the texture (RGBA8, w×h output px at the render scale, framebuffer rows).
    draw({w, h, screens, time, pitch, sockets = true, gain = 1, safe = null, transient:passing = false, psych = null, sample = null}) {
      w = Math.round(w); h = Math.round(h);
      const it = (passing ? transient : instance)(w, h, pitch ?? boardPitch(w, h), safe);
      const board = paintGrid(it.grid, screens, time, {sockets, gain, psych, sample});
      // The kick's lift is a hit: it shows from the frame that holds the kick's sound (time is the
      // middle of the frame less the latency, so half a frame of lead lands it there).
      const kick = /^Drop/.test(sectionAt(plan, time)) && kickAt(plan, time, 1 / 48) ? 1 : 0;
      it.renderer.draw(board, {pitch:it.grid.pitch, x:it.grid.ox, y:it.grid.oy, time, kick});
      return {texture:it.tex, width:it.W, height:it.H, grid:it.grid, stats:it.renderer.stats};
    },
    // Predicted luminance of the board region at t, without drawing (the governor's input).
    luma({w, h, screens, time, pitch, safe = null, psych = null}, grids = new Map()) {
      const key = `${Math.round(w)}x${Math.round(h)}@${pitch ?? boardPitch(w, h)}${safe ? `|${safe.x0}-${safe.x1}` : ''}`;
      let grid = grids.get(key);
      if (!grid) grids.set(key, grid = boardGrid(Math.round(w), Math.round(h), pitch ?? boardPitch(w, h), safe));
      // (Footage is predicted from the picture it takes over, by the caller: no frame here.)
      return boardLuma(paintGrid(grid, screens, time, {psych:psych?.filter(p => p.look !== 'footage')}));
    },
    state:t => boardState(plan, t),
    get size() { return instances.size; },
    setScale(s) { if (s !== scale) { scale = s; for (const it of instances.values()) it.dispose(); instances.clear(); moving?.dispose(); moving = null; } },
    dispose() { for (const it of instances.values()) it.dispose(); instances.clear(); moving?.dispose(); moving = null; },
  };
}

function sectionAt(plan, t) {
  return plan.sections.find(s => t >= plan.timing[Math.min(plan.timing.length - 1, s.from * 16)] && t < plan.timing[Math.min(plan.timing.length - 1, s.to * 16)])?.name || '';
}
