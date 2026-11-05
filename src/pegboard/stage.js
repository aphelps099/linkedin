// A Peg Board on a page: one board sized to its canvas, the song's screens,
// the department chart, and one draw per animation frame. The live page, the
// specimen page and (later) the video export all go through this.
import {createBoard} from './board.js';
import {createRenderer, QUALITY_STEPS} from './renderer.js';
import {boardLuma, governorTrack} from './governor.js';
import {compileFont, layoutText} from './font.js';
import {PEG9} from './fonts/peg9.js';
import {PEG5} from './fonts/peg5.js';
import {buildScreens, paint, indexWords} from './choreo.js';
import {riverTrack, riverAt, paintPsych} from './psych.js';
import {bandLevels, fromAnalyser, createFollower, departments, scoreAccent, kickAt} from './eq.js';

const FACES = {peg9:compileFont(PEG9), peg5:compileFont(PEG5)};

// The chart: OUTPUT BY DEPARTMENT, four bands per player over the range each
// stem actually speaks in; the lady's group appears only in the drops.
const MODEL = departments({bands:4});
const GROUPS = MODEL.groups;
const CHART_KINDS = new Set(['hook', 'repeat', 'impact', 'punct']);

// The lines a screen may take: its own `lines` (1 at k 2 and up, else 3), or for a two-part band screen
// (screen.fill: a couplet, an exchange) as many as the room holds, so both parts share one page where they fit.
export function linesFor(screen, font, k, room) {
  const lines = screen.lines ?? ((screen.k ?? 1) > 1 ? 1 : 3);
  return screen.fill ? Math.max(lines, Math.floor((room - font.height * k) / (font.advance * k)) + 1) : lines;
}

// The stage's pitch: pitchFor, except that a narrow stage (a phone) keeps at least STAGE_COLS columns,
// so a long word ("DOUBLE-BOOKED.", 100 pegs in PEG-9) still sets: at 390 px, 97 columns of 4 px pegs
// instead of 55 of 7 (where it fit in neither face and the screen stayed dark). The film's 9:16 home
// shows its pegs smaller than that on the same phone (150 columns across 1080 px).
export const STAGE_COLS = 96;
export const stagePitch = (width, height) => { const p = pitchFor(width, height); return Math.floor(width / p) >= STAGE_COLS ? p : Math.max(3, Math.min(p, Math.floor(width / STAGE_COLS))); };

export function pitchFor(width, height) {
  // ~52 rows on a desktop stage, never under 7 px or over 16 px a peg.
  return Math.max(7, Math.min(16, Math.floor(Math.min(height / 44, width / 80))));
}

export function createStage(canvas, {plan, table, reduced = false, chart = true} = {}) {
  const renderer = createRenderer(canvas, {pixelRatio:Math.min(2, window.devicePixelRatio || 1)});
  let board = null, pitch = 12, ox = 0, oy = 0, textRows = 0, chartRows = 0;
  const layouts = new Map(), screens = buildScreens(plan, {table}).map(indexWords);
  // The river (Offsite's wander form): the board is the texture, breathing with the loop's layers; its
  // clear phrases are the only type, and they win (paintPsych after paint).
  const river = plan.form === 'wander' ? riverTrack(plan) : null;
  // (Reduced motion: the light still follows the layers, the pattern holds still.)
  const texture = t => { if (!river || !(board.exposure > 0)) return; const r = riverAt(river, t); if (reduced) r.drive.beat = 0; paintPsych(board, r.spec, reduced ? 0 : t, {drive:r.drive}); };
  const followers = new Map(), scratch = {}, bands = {}, accentOut = {levels:{}, white:{}}, SILENT = new Float32Array(4);
  let lastT = -1;

  function resize(width, height) {
    pitch = stagePitch(width, height);
    const cols = Math.floor(width / pitch), rows = Math.floor(height / pitch);
    board = createBoard(cols, rows);
    ox = Math.floor((width - cols * pitch) / 2); oy = Math.floor((height - rows * pitch) / 2);
    chartRows = chart ? Math.max(6, Math.round(rows * .2)) : 0;
    textRows = rows - chartRows - 1;
    layouts.clear(); followers.clear(); stills?.clear(); gains = null;
    renderer.resize(width, height);
    setTimeout(governor, 0);                 // before Play, not on its first frame
  }

  // The largest size that fits: k from the screen's wish down to 1, then the
  // narrow face. Cached per screen for this board size. A held title (still)
  // owns the whole board and must fit on one page: its words all start at once,
  // so a second page would hide the first.
  const roomOf = screen => screen.full ? board.rows - 2 : textRows;
  function layoutOf(screen) {
    if (layouts.has(screen)) return layouts.get(screen);
    let out = null;
    for (const face of ['peg9', 'peg5']) {
      for (let k = screen.k; k >= 1 && !out; k--) {
        const font = FACES[face], l = layoutText(screen.text, {font, k, maxCols:board.cols - 4, maxLines:linesFor(screen, font, k, roomOf(screen))});
        if (l.width <= board.cols - 4 && l.height <= roomOf(screen) && (!screen.full || l.pages.length === 1)) out = l;
      }
      if (out) break;
    }
    layouts.set(screen, out);
    return out;
  }
  const place = (screen, layout, page) => {
    const h = page.lines.length ? Math.max(...page.lines.map(l => l.y + Math.max(...l.chars.map(c => c.y + c.h - l.y), 0))) : layout.height;
    const w = page.lines.length ? Math.max(...page.lines.map(l => l.width)) : layout.width;
    return {x:Math.floor((board.cols - w) / 2), y:Math.max(1, Math.floor((roomOf(screen) - Math.min(h, layout.height)) / 2))};
  };

  // The department chart: four bands per player, a white peak peg, in the
  // board's bottom rows; on kick steps OPS and PAT slam to full and flash white.
  let chartGroups = [];
  function chartPainter(analysers, dt, levelsOverride) {
    return (b, t, screen) => {
      chartGroups = [];
      if (!chartRows || !screen || !(CHART_KINDS.has(screen.kind) || /^Drop/.test(sectionAt(t)))) return;
      const drop = /^Drop/.test(sectionAt(t)), groups = GROUPS.filter(g => !g.drop || drop);
      const bandW = b.cols >= 90 ? 2 : 1, gap = 1, groupGap = bandW + 2;
      const groupW = 4 * bandW + 3 * gap, total = groups.length * groupW + (groups.length - 1) * groupGap;
      let x0 = Math.floor((b.cols - total) / 2);
      const base = b.rows - 3, raw = {};             // two rows under the chart hold its labels
      for (const g of groups) {
        const a = analysers?.[g.stem];
        raw[g.stem] = levelsOverride?.[g.stem] || (a ? bandLevels(fromAnalyser(a, scratch[g.stem] ||= {}), a.context.sampleRate, a.fftSize, g.edges, {out:bands[g.stem] ||= new Float32Array(4)}) : SILENT);
      }
      const accented = scoreAccent(raw, {kick:kickAt(plan, t)}, accentOut);
      for (const g of groups) {
        // One row short of the chart, so a full bar still has room for its peak peg.
        if (!followers.has(g.stem)) followers.set(g.stem, createFollower(4, {rows:chartRows - 1, edges:g.edges}));
        const {heights, peaks} = followers.get(g.stem).step(accented.levels[g.stem], dt), white = accented.white[g.stem];
        for (let band = 0; band < 4; band++) {
          const h = Math.round(heights[band]), p = Math.round(peaks[band]);
          for (let bx = 0; bx < bandW; bx++) {
            const x = x0 + band * (bandW + gap) + bx;
            for (let r = 0; r < h; r++) setPeg(b, x, base - r, .5 + .5 * (r / chartRows), 0, white?.[band] ? .9 : 0);
            if (p > 0) setPeg(b, x, base - Math.min(chartRows - 1, p), 1.25, 1, .85);
          }
        }
        chartGroups.push({label:g.label, col:x0, cols:groupW});
        x0 += groupW + groupGap;
      }
    };
  }
  const setPeg = (b, x, y, I, tone, white) => { if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) return; const i = y * b.cols + x; if (I > b.I[i]) { b.I[i] = I; b.tone[i] = tone; b.white[i] = white; } };
  const sectionAt = t => (plan.sections || []).find(s => t >= plan.timing[s.from * 16] && t < plan.timing[s.to * 16])?.name || '';

  // The flash governor's exposure track for this song and board, at 24 fps:
  // computed once, so every frame (live or exported) obeys the same limits.
  let gains = null;
  function governor() {
    if (gains || !board) return gains;
    const frames = [], fps = 24, n = Math.ceil(plan.duration * fps);
    for (let f = 0; f < n; f++) { paint(board, screens, f / fps, {plan, layoutOf, place, reduced, pitch}); texture(f / fps); frames.push(boardLuma(board)); }
    return gains = governorTrack(frames, fps);
  }

  // Phones: if frames run over 20 ms, step down bloom, then render scale, then socket shading.
  let quality = 0, slow = 0;
  function budget(ms) {
    slow = ms > 20 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 30 && quality < QUALITY_STEPS.length - 1) { renderer.setQuality(QUALITY_STEPS[++quality]); slow = 0; }
  }

  function draw(t, {analysers, levels} = {}) {
    if (!board) return;
    const started = performance.now();
    const dt = lastT < 0 || t < lastT ? 1 / 60 : Math.min(.1, t - lastT); lastT = t;
    paint(board, screens, t, {plan, layoutOf, place, eq:chart ? chartPainter(analysers, dt, levels) : null, reduced, pitch});
    texture(t);
    const g = governor(), f = Math.max(0, Math.floor(t * 24));
    if (g && f < g.length) board.exposure *= g[f];
    const kick = !reduced && /^Drop/.test(sectionAt(t)) && kickAt(plan, t) ? 1 : 0;
    renderer.draw(board, {pitch, x:ox, y:oy, time:reduced ? 0 : t, kick});
    budget(performance.now() - started);
  }

  // A title held still on the board (between performances), settled, no motion.
  const stills = new Map();
  function still(text, {tone = 'white', k = 1} = {}) {
    if (!board) return;
    const key = `${text}|${tone}|${k}`;
    if (!stills.has(key)) {
      const words = text.split(' ').map(w => ({text:w, start:0, end:1e9, units:[{chars:[0, w.length], start:0}]}));
      stills.set(key, indexWords({kind:'title', voice:'board', from:0, to:1e9, text, words, accent:-1, reveal:'pop', tone, k, lines:2, full:true, release:'cut', fx:{}}));
    }
    paint(board, [stills.get(key)], 10, {layoutOf, place, reduced:true});
    renderer.draw(board, {pitch, x:ox, y:oy, time:0});
  }

  // Where the chart's groups sit, in CSS px, so the page can label them in type.
  const chartLabels = () => chartGroups.map(g => ({label:g.label, x:ox + g.col * pitch, width:g.cols * pitch, y:oy + (board.rows - 1.75) * pitch}));
  return {resize, draw, still, chartLabels, governor, screens, get board() { return board; }, get pitch() { return pitch; }, get kind() { return renderer.kind; }, dispose:() => renderer.dispose()};
}

export {MODEL, GROUPS};
