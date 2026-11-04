// The Peg Board inside the film frame. Each board region (the layout's board strip, the
// whole frame, a gen:board tile, a board cue's cell) gets its own board grid at the pitch
// that region calls for, painted by choreo.paint() at the frame's board time and drawn by
// the Peg Board's own WebGL2 renderer (src/pegboard/renderer-gl.js) straight into a texture
// of the compositor's context: no second canvas, no copy. The board looks exactly as it
// does on /allhands/ and /pixel-type/, bloom and sockets included.
//
//   const boards = createBoardLayer(gl, {plan, scale});
//   const tex = boards.draw({w, h, screens, time, pitch?, sockets?, kick?, gain?})   // WebGLTexture, w×h output px
//   boards.luma({w, h, screens, time})       predicted luminance (governor.js boardLuma)
//
// Pegs light on floor((t + .010)·24): choreo keys every onset to the song time it is given,
// and the compositor passes frame.board.time, so a peg leads its sound by at most 25 ms.
import {createBoard} from '../../pegboard/board.js';
import {createRendererGL} from '../../pegboard/renderer-gl.js';
import {compileFont, layoutText} from '../../pegboard/font.js';
import {PEG9} from '../../pegboard/fonts/peg9.js';
import {PEG5} from '../../pegboard/fonts/peg5.js';
import {PEG3} from '../../pegboard/fonts/peg3.js';
import {paint, boardState} from '../../pegboard/choreo.js';
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
export function boardGrid(w, h, pitch = boardPitch(w, h)) {
  const cols = Math.max(1, Math.floor(w / pitch)), rows = Math.max(1, Math.floor(h / pitch));
  const board = createBoard(cols, rows), layouts = new Map();
  const ox = Math.floor((w - cols * pitch) / 2), oy = Math.floor((h - rows * pitch) / 2), textRows = rows - 1;
  const roomOf = screen => screen.full ? rows - 2 : textRows;
  function layoutOf(screen) {
    if (layouts.has(screen)) return layouts.get(screen);
    let out = null;
    for (const face of ORDER[screen.font] ?? ORDER.peg9) {
      for (let k = screen.k ?? 1; k >= 1 && !out; k--) {
        const l = layoutText(screen.text, {font:FACES[face], k, maxCols:cols - 4, maxLines:screen.lines ?? ((screen.k ?? 1) > 1 ? 1 : 3)});
        if (l.width <= cols - 4 && l.height <= roomOf(screen) && (!screen.full || l.pages.length === 1)) out = l;
      }
      if (out) break;
    }
    layouts.set(screen, out);
    return out;
  }
  const place = (screen, layout, page) => {
    const hh = page.lines.length ? Math.max(...page.lines.map(l => l.y + Math.max(...l.chars.map(c => c.y + c.h - l.y), 0))) : layout.height;
    const ww = page.lines.length ? Math.max(...page.lines.map(l => l.width)) : layout.width;
    return {x:Math.floor((cols - ww) / 2), y:Math.max(1, Math.floor((roomOf(screen) - Math.min(hh, layout.height)) / 2))};
  };
  return {board, cols, rows, pitch, ox, oy, layoutOf, place};
}

export function createBoardLayer(gl, {plan, scale = 1, quality} = {}) {
  const instances = new Map();
  let tick = 0;
  const MAX = 4;

  function instance(w, h, pitch) {
    const key = `${w}x${h}@${pitch}`;
    let it = instances.get(key);
    if (it) { it.used = ++tick; return it; }
    if (instances.size >= MAX) {
      const old = [...instances.values()].sort((a, b) => a.used - b.used)[0];
      old.dispose(); instances.delete(old.key);
    }
    const grid = boardGrid(w, h, pitch);
    const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // The renderer believes it owns a canvas of W × H; it draws into our framebuffer instead.
    const fake = {width:W, height:H};
    const renderer = createRendererGL(fake, {gl, output:() => fb, pixelRatio:scale, quality});
    renderer.resize(w, h);
    it = {key, grid, tex, fb, renderer, w, h, W, H, used:++tick,
      dispose() { renderer.dispose(); gl.deleteTexture(tex); gl.deleteFramebuffer(fb); }};
    instances.set(key, it);
    return it;
  }

  // Paint the board for a region at song time t. sockets: false hides the empty sockets
  // (the board laid over footage shows only its light).
  function paintGrid(grid, screens, t, {sockets = true, gain = 1} = {}) {
    paint(grid.board, screens, t, {plan, layoutOf:grid.layoutOf, place:grid.place});
    if (!sockets) grid.board.sockets = 0;
    grid.board.exposure *= gain;
    return grid.board;
  }

  return {
    // Draw a board region; returns the texture (RGBA8, w×h output px at the render scale, framebuffer rows).
    draw({w, h, screens, time, pitch, sockets = true, gain = 1}) {
      w = Math.round(w); h = Math.round(h);
      const it = instance(w, h, pitch ?? boardPitch(w, h));
      const board = paintGrid(it.grid, screens, time, {sockets, gain});
      const kick = /^Drop/.test(sectionAt(plan, time)) && kickAt(plan, time) ? 1 : 0;
      it.renderer.draw(board, {pitch:it.grid.pitch, x:it.grid.ox, y:it.grid.oy, time, kick});
      return {texture:it.tex, width:it.W, height:it.H, grid:it.grid, stats:it.renderer.stats};
    },
    // Predicted luminance of the board region at t, without drawing (the governor's input).
    luma({w, h, screens, time, pitch}, grids = new Map()) {
      const key = `${Math.round(w)}x${Math.round(h)}@${pitch ?? boardPitch(w, h)}`;
      let grid = grids.get(key);
      if (!grid) grids.set(key, grid = boardGrid(Math.round(w), Math.round(h), pitch ?? boardPitch(w, h)));
      return boardLuma(paintGrid(grid, screens, time));
    },
    state:t => boardState(plan, t),
    get size() { return instances.size; },
    setScale(s) { if (s !== scale) { scale = s; for (const it of instances.values()) it.dispose(); instances.clear(); } },
    dispose() { for (const it of instances.values()) it.dispose(); instances.clear(); },
  };
}

function sectionAt(plan, t) {
  return plan.sections.find(s => t >= plan.timing[Math.min(plan.timing.length - 1, s.from * 16)] && t < plan.timing[Math.min(plan.timing.length - 1, s.to * 16)])?.name || '';
}
