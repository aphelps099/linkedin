// The compositor: one WebGL2 canvas that draws a frame of the frame program
// (edl/compile.js) exactly, for the live preview and for the export.
//
//   const comp = createCompositor(canvas, {format:'9:16', scale:1});
//   await comp.ready;                                    // fonts for the chrome atlas
//   comp.prepare(program, {plan, shots});                // board screens, shot sizes, governor track
//   comp.drawFrame(program.frame(f), sources, {format}); // sources(layer, i) -> Source | null
//   comp.read()                                          // {width, height, data} RGBA, top row first
//
// Source: {image, key, version, width?, height?}
//   image    any TexImageSource of the shot's picture (a <video>, ImageBitmap, VideoFrame, canvas);
//            a 540p proxy and the master address the same source px (the proxy keeps the frame)
//   key      the GPU texture slot it uploads into (an element id, a cache entry); defaults to image
//   version  uploads only when it changes (rVFC presentedFrames, a frame number); undefined = always
//   width, height   the shot's source px (what layer.transform.matrix maps to); defaults to the
//            shot index entry given to prepare(), else the image's own size
// or {texture, width, height, flipY?} for a texture the caller owns.
// A video layer whose source is null draws as an empty tile (#181a1e); generated layers
// (gen:black, white, color, board, camera-off, feedback) need no source.
//
// A frame, bottom to top (all in one RGBA8 framebuffer, the feedback FBO):
//   the call's background, the Peg Board in its layout region (opaque, under the tiles),
//   board cues under their cell, then per layer: echo copies, the layer (uber shader:
//   crop + matrix, tile, fold, mosaic, scanline, zoom or directional blur, RGB split,
//   saturation, chroma drop, peg video, rounded mask, iris, opacity) and its chrome,
//   then psych imagery in its own cells (a peg board over the tile, faded in and out with its cue), the board over
//   full-frame pictures (light only, MAX blend) or over a psych cell that covers it, board cues
//   over cells, the screen-share banner. Psych imagery without a cell is painted into the board's
//   own region, under its type (pegboard/psych.js).
//   Droste: depth levels, each a copy of the frame with the feedback tile holding the level
//   before it, in two ping-pong framebuffers. The composite camera (cue matrix + effects).
//   Post: bloom (bright pass, dual Kawase), the governor's gain, grain, dither.
// Every pass is a pure function of the frame, its sources and the frame number.
import {RECT_VS, FULL_VS, LAYER_FS, CHROME_VS, CHROME_FS, MOUTH_VS, MOUTH_FS, COPY_FS, BRIGHT_FS, DOWN_FS, UP_FS, FINAL_FS, PEGS_FS} from './shaders.js';
import {createAtlas, loadFonts, chromeQuads, tileQuads, bannerQuads, packQuads, isLadyTile, LEGIBLE} from './chrome.js';
import {createBoardLayer, boardPitch, safeSpan} from './board-layer.js';
import {governorTrack} from '../../pegboard/governor.js';
import {FORMATS, SAFE} from '../layouts.js';
import {PEG_LEAD} from '../edl/anchors.js';

export const BACKGROUND = [16 / 255, 17 / 255, 20 / 255];     // the meeting room's stage, #101114
export const EMPTY_TILE = [24 / 255, 26 / 255, 30 / 255, 1];  // a tile still connecting, #181a1e
export const POST = {bloom:{threshold:.82, knee:.12, weight:.14, levels:4}, grain:1.6 / 255, dither:true};
// What the compositor does with every fx type of the EDL vocabulary (edl/schema.js FX).
export const FX_SUPPORT = {
  zoomBlur:'shader: 16 taps toward the centre', dirBlur:'shader: 16 taps along the angle',
  mosaic:'shader: blocks on the cell grid', chromaDrop:'shader', saturation:'shader', rgbSplit:'shader: red +px, blue -px per tap',
  fold:'shader: x, y, xy about the cell centre', tile:'shader: cols × rows copies, alternate mirrored', iris:'shader: soft circle mask',
  droste:'ping-pong levels of the frame in the feedback tile', pegVideo:'shader: luma^gamma in blue levels on a peg grid',
  scanline:'shader: line pairs and per-line wobble', echo:'trail copies at the transforms of earlier frames',
  breathe:'shader: two nested block grids an octave apart, crossfaded', paletteWash:'shader: luma onto a blue, violet or warm duotone, luma kept',
  trail:'compile: copies of the clip at its earlier source frames, laid over it (MAX for lighten)', radialFold:'shader: mirrored wedges about the centre, reflected at the edge',
  pegBloom:'shader: pegs from the centre out behind a front of peg-wide pixel blocks', chromaDrift:'shader: red, green and blue orbit 120 degrees apart, plus a radial split',
  sparkle:'shader: stars in pegs over the picture (lighten), turning, each growing and shrinking over its own life',
  contour:'shader: stepped contour bands of a squarish field in flat blocks, taking the picture block by block (or under it)',
  pixelTiles:'shader: tiles dealt per tick, each dropping to a coarser block, rolled inside itself and re-quantised',
};
// What the compositor does with a psych board cue (edl/schema.js PSYCH: {type:'psych', look, ...}).
export const PSYCH_SUPPORT = {
  region:'painted into the board region (home, share, full bleed) after its screens: the type wins (board-layer.js)',
  cell:'its own peg board, a panel over the tile at the cue\'s fade (opaque once faded in, so the picture dissolves into it), drawn after the layers; the board region is drawn over it when they overlap',
  footage:'the composite under the region averaged to one value per peg (PEGS_FS, 4 × 4 taps) and read back',
};

// Pegs are hits (edl/anchors.js): an onset at song time t lights on floor((t + L)·24), the frame
// that holds its audible onset (L = frame.board.lead, the engine's measured latency, 16.33 ms).
// choreo paints the middle of a frame: it lights a unit once the time it is painted at reaches its
// onset less half a frame, so frame f paints at f/24 + 1/48 − L; a screen switches on at its own
// start with no lead, so the compositor hands choreo its screens half a frame early
// (boardScreens). Every onset is then lit from the frame that holds its sound, never after it;
// true black starts on the first frame after her tag stops sounding; the ignition lands on the
// frame that holds the impact.
export const PEG_PAINT_LEAD = 1 / 48 - PEG_LEAD;
export const boardTimeOf = frame => frame.board.time + 1 / 48 - (frame.board.lead ?? PEG_LEAD);
const shifted = new WeakMap();
export function boardScreens(list) {
  if (!shifted.has(list)) shifted.set(list, list.map(s => ({...s, from:s.from - 1 / 48, to:s.to - 1 / 48})));
  return shifted.get(list);
}

const hexRGB = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const NO_SCREENS = Object.freeze([]);
const DEG = Math.PI / 180;

export function createCompositor(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', {alpha:false, antialias:false, depth:false, stencil:false, premultipliedAlpha:true,
    preserveDrawingBuffer:!!opts.preserveDrawingBuffer, powerPreference:'high-performance', desynchronized:false});
  if (!gl) throw Error('WebGL2 is not available in this browser.');
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw Error('This GPU cannot render the Peg Board (no float colour buffer).');

  let format = opts.format ?? '9:16', scale = opts.scale ?? 1, F = FORMATS[format];
  // The board-only fast path (drawFrame): on unless a caller turns it off to compare it with the slow one.
  const fastBoard = opts.fastBoard !== false;
  let post = {...POST, ...(opts.post || {})};
  const ready = loadFonts(opts.fontBase ?? '');

  // ---- programs ----
  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw Error('Compositor shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s); gl.deleteShader(s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw Error('Compositor program: ' + gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name); }
    return {p, u};
  }
  const P = {layer:program(RECT_VS, LAYER_FS), chrome:program(CHROME_VS, CHROME_FS), mouth:program(MOUTH_VS, MOUTH_FS), copy:program(FULL_VS, COPY_FS),
    bright:program(FULL_VS, BRIGHT_FS), down:program(FULL_VS, DOWN_FS), up:program(FULL_VS, UP_FS), final:program(FULL_VS, FINAL_FS), pegs:program(FULL_VS, PEGS_FS)};
  const empty = gl.createVertexArray();

  // Chrome instances.
  const chromeVao = gl.createVertexArray(), chromeBuf = gl.createBuffer();
  gl.bindVertexArray(chromeVao); gl.bindBuffer(gl.ARRAY_BUFFER, chromeBuf);
  ['aRect', 'aColor', 'aUv', 'aClip', 'aShape'].forEach((name, i) => {
    const loc = gl.getAttribLocation(P.chrome.p, name);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 80, i * 16); gl.vertexAttribDivisor(loc, 1);
  });
  gl.bindVertexArray(null);
  let chromeData = new Float32Array(64 * 20);

  // ---- targets ----
  function texture(w, h, internal = gl.RGBA8, filter = gl.LINEAR) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h) {
    const tex = texture(w, h), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return {w, h, tex, fb};
  }
  const free = t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };
  let W = 0, H = 0, T = {};
  function resize() {
    F = FORMATS[format];
    W = Math.max(1, Math.round(F.w * scale)); H = Math.max(1, Math.round(F.h * scale));
    canvas.width = W; canvas.height = H;
    Object.values(T).flat().forEach(free);
    T = {comp:target(W, H), ping:[target(W, H), target(W, H)], cam:target(W, H), mip:[], ups:[]};
    for (let k = 1; k <= post.bloom.levels; k++) { const w = Math.max(1, W >> k), h = Math.max(1, H >> k); T.mip[k] = target(w, h); T.ups[k] = target(w, h); }
    T.mip = T.mip.filter(Boolean); T.ups = T.ups.filter(Boolean);
  }
  resize();

  // ---- the atlas ----
  const atlas = createAtlas({size:2048, scale});
  const atlasTex = texture(atlas.size, atlas.size);
  function uploadAtlas() {
    if (!atlas.dirty) return;
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    atlas.clean();
  }

  // ---- source textures ----
  const cache = new Map();
  let drawCount = 0, stats = {};
  function upload(src) {
    if (src.texture) return {tex:src.texture, flip:src.flipY ? 1 : 0};
    const key = src.key ?? src.image;
    let t = cache.get(key);
    if (!t) {
      t = {tex:gl.createTexture(), version:Symbol('none'), w:0, h:0};
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      cache.set(key, t);
    }
    t.used = drawCount;
    if (src.version === undefined || src.version !== t.version) {
      const img = src.image, w = img.videoWidth || img.displayWidth || img.codedWidth || img.width, h = img.videoHeight || img.displayHeight || img.codedHeight || img.height;
      if (!w || !h) return null;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (w === t.w && h === t.h) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
      else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); t.w = w; t.h = h; }
      t.version = src.version; stats.uploads++;
    }
    return {tex:t.tex, flip:0, w:t.w, h:t.h};
  }
  function prune() {
    for (const [k, t] of cache) if (drawCount - t.used > 240) { gl.deleteTexture(t.tex); cache.delete(k); }
  }

  // ---- program context: board, shots, governor ----
  let ctx = {program:null, plan:null, shots:null, gains:null, screens:[], cells:[]};
  let boards = null;
  function prepare(program, {plan, shots, governor = true} = {}) {
    if (!plan) throw Error('prepare needs {plan}');
    if (program.format !== format) setFormat(program.format);
    if (!boards || ctx.plan !== plan) { boards?.dispose(); boards = createBoardLayer(gl, {plan, scale}); }
    const shotMap = shots ? (shots instanceof Map ? shots : new Map((shots.shots ?? shots.all ?? shots).map(s => [s.id, s]))) : null;
    ctx = {program, plan, shots:shotMap, gains:null, screens:boardScreens(program.board.screens), cells:boardScreens(program.board.cells)};
    if (governor) ctx.gains = governorGains(program, {plan, shots:shotMap, boards});
    return {gains:ctx.gains};
  }

  // ---- GL helpers ----
  function bindTarget(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, t ? t.w : W, t ? t.h : H); }
  function resetState() {
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(empty);
  }
  function clear(rgb) { gl.disable(gl.SCISSOR_TEST); gl.clearColor(rgb[0], rgb[1], rgb[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); }

  // One layer through the uber shader. `look` = {kind 0 texture | 1 colour | 2 camera off, tex, flip, color, srcW, srcH}.
  function drawLayerPass(layer, look, {matrix = layer.transform.matrix, opacity = layer.opacity, fx = layer.fx, cell = layer.cell, radius = layer.radius, seed = 0, time = 0} = {}) {
    const L = P.layer, u = L.u;
    gl.useProgram(L.p); gl.bindVertexArray(empty);
    const x0 = Math.floor(cell.x * scale), y0 = Math.floor(cell.y * scale), x1 = Math.ceil((cell.x + cell.w) * scale), y1 = Math.ceil((cell.y + cell.h) * scale);
    gl.uniform4f(u.uRect, x0, y0, x1 - x0, y1 - y0);
    gl.uniform2f(u.uTarget, W, H); gl.uniform1f(u.uScale, scale);
    gl.uniform4f(u.uCell, cell.x, cell.y, cell.w, cell.h); gl.uniform1f(u.uRadius, radius || 0);
    const m = matrix;
    gl.uniformMatrix3fv(u.uM, false, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
    gl.uniform2f(u.uSrcSize, look.srcW || 1, look.srcH || 1);
    gl.uniform4f(u.uBounds, 0, 0, look.srcW || 1, look.srcH || 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, look.tex || null); gl.uniform1i(u.uTex, 0);
    gl.uniform1i(u.uKind, look.kind); gl.uniform1i(u.uFlip, look.flip || 0);
    const c = look.color || [0, 0, 0, 1];
    gl.uniform4f(u.uColor, c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
    gl.uniform1f(u.uOpacity, opacity); gl.uniform1f(u.uTime, time); gl.uniform1ui(u.uSeed, seed >>> 0);
    // Effects, at their identity unless the layer has them.
    let tile = [1, 1, 0, 0], fold = 0, mosaic = 0, scan = [0, 0, 6], zoom = [0, .5, .5], dir = [0, 0], rgb = [0, 0], sat = 1, chroma = 0, peg = [0, 12, 6, 1.4], iris = [-1, .5, .5, 2];
    let breathe = [0, .5, .5], wash = [0, 0], radial = [0, 0, .5, .5], bloom = [0, .5, .5, .2], reach = 0, drift = [0, 0, 0], hasPeg = false, spark = [0, 12, 6, 0], spark2 = [3, .2, 0, 0];
    let con = [0, 24, 3, 1 / 3], con2 = [0, .5, .5, 0], con3 = [1.6, .7, 0, 0], con4 = [0, 0, 0, 0], tiles = [0, 96, 24, 0], tiles2 = [1, 4, 0, 0];
    for (const x of fx) switch (x.type) {
      case 'breathe': breathe = [x.px, x.cx ?? .5, x.cy ?? .5]; break;
      case 'paletteWash': wash = [Math.min(1, x.mix), Math.max(0, Math.min(2, x.hue ?? 0))]; break;
      case 'radialFold': radial = [Math.max(2, Math.round(x.wedges)), (x.angle ?? 0) * DEG, x.cx ?? .5, x.cy ?? .5]; break;
      case 'pegBloom': bloom = [Math.min(1, x.amount), x.cx ?? .5, x.cy ?? .5, Math.max(.01, x.band ?? .2)]; reach = x.reach ?? 0; if (!hasPeg) peg = [0, x.pitch ?? 12, Math.max(1, x.levels ?? 6), x.gamma ?? 1.4]; break;
      case 'chromaDrift': drift = [x.px ?? 0, (x.angle ?? 0) * DEG, x.radial ?? 0]; break;
      case 'sparkle': spark = [Math.min(1, x.amount), x.pitch ?? 12, Math.max(1, Math.min(12, Math.round(x.count ?? 6))), Math.round(x.seed ?? 0)]; spark2 = [x.size ?? 3, x.spin ?? .2, x.tone ?? 0, time]; break;
      case 'contour': con = [Math.min(1, x.mix), x.px ?? 24, x.band ?? 3, x.duty ?? 1 / 3]; con2 = [x.travel ?? 0, x.cx ?? .5, x.cy ?? .5, x.twin ?? 0]; con3 = [x.aspect ?? 1.6, x.corner ?? .7, x.luma ?? 0, x.hole ?? 0]; con4 = [x.grow ?? 0, x.reach ?? 0, x.under ?? 0, x.tone ?? 0]; break;
      case 'pixelTiles': tiles = [Math.min(1, x.amount), x.tile ?? 96, x.px ?? 24, x.tick ?? 0]; tiles2 = [x.slide ?? 1, x.levels ?? 4, x.seed ?? 0, 0]; break;
      case 'tile': tile = [Math.max(1, x.cols), Math.max(1, x.rows), x.mirror ?? 1, 1]; break;
      case 'fold': fold = x.axis === 'y' ? 2 : x.axis === 'xy' ? 3 : 1; break;
      case 'mosaic': mosaic = x.px; break;
      case 'scanline': scan = [x.amount ?? 0, x.wobble ?? 0, x.period ?? 6]; break;
      case 'zoomBlur': zoom = [Math.min(1, x.amount), x.cx ?? .5, x.cy ?? .5]; break;
      case 'dirBlur': dir = [x.px, (x.angle ?? 0) * DEG]; break;
      case 'rgbSplit': rgb = [x.px, (x.angle ?? 0) * DEG]; break;
      case 'saturation': sat *= x.amount; break;
      case 'chromaDrop': chroma = Math.max(chroma, Math.min(1, x.amount)); break;
      case 'pegVideo': peg = [Math.min(1, x.mix), x.pitch ?? 12, Math.max(1, x.levels ?? 6), x.gamma ?? 1.4]; hasPeg = true; break;
      case 'iris': iris = [Math.max(0, x.r), x.cx ?? .5, x.cy ?? .5, x.feather ?? 2]; break;
      default: break;                      // droste and echo are passes, trail is layers: not shader terms
    }
    gl.uniform3f(u.uBreathe, ...breathe); gl.uniform2f(u.uWash, ...wash); gl.uniform4f(u.uRadialFold, ...radial); gl.uniform4f(u.uBloomPeg, ...bloom); gl.uniform1f(u.uBloomReach, reach); gl.uniform3f(u.uDrift, ...drift); gl.uniform4f(u.uSparkle, ...spark); gl.uniform4f(u.uSparkle2, ...spark2);
    gl.uniform4f(u.uContour, ...con); gl.uniform4f(u.uContour2, ...con2); gl.uniform4f(u.uContour3, ...con3); gl.uniform4f(u.uContour4, ...con4); gl.uniform4f(u.uTiles, ...tiles); gl.uniform4f(u.uTiles2, ...tiles2);
    gl.uniform4f(u.uTile, ...tile); gl.uniform1i(u.uFold, fold); gl.uniform1f(u.uMosaic, mosaic);
    gl.uniform3f(u.uScan, ...scan); gl.uniform3f(u.uRadial, ...zoom); gl.uniform2f(u.uDir, ...dir); gl.uniform2f(u.uRgb, ...rgb);
    gl.uniform1f(u.uSat, sat); gl.uniform1f(u.uChroma, chroma); gl.uniform4f(u.uPeg, ...peg); gl.uniform4f(u.uIris, ...iris);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    stats.passes++;
  }

  function drawChrome(quads) {
    if (!quads.length) return;
    uploadAtlas();
    const packed = packQuads(quads, chromeData); chromeData = packed.data;
    gl.useProgram(P.chrome.p); gl.bindVertexArray(chromeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, chromeBuf); gl.bufferData(gl.ARRAY_BUFFER, chromeData.subarray(0, packed.count * 20), gl.STREAM_DRAW);
    gl.uniform2f(P.chrome.u.uTarget, W, H); gl.uniform1f(P.chrome.u.uScale, scale);
    gl.uniform2f(P.chrome.u.uAtlasSize, atlas.size, atlas.size);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(P.chrome.u.uAtlas, 0);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, packed.count);
    gl.bindVertexArray(empty);
    stats.chrome += packed.count;
  }

  // Synergy's mouth row, over his picture, inside his tile (meeting room drawRobotMouth).
  // His voice level comes with the layer (compile: the voice stem while he sings); the wave's
  // phase is the song time. Drawn right after his layer, under his chrome, so it zooms and
  // fades with his face and is never mirrored or warped (G11 refuses both on Synergy).
  function drawMouth(layer, time) {
    const r = layer.robot, m = r?.mouth;
    if (!m || !(m.scale > 0)) return;
    const M = P.mouth, u = M.u, cell = layer.cell;
    let sat = 1, chroma = 0, iris = [-1, .5, .5, 2];
    for (const x of layer.fx) {
      if (x.type === 'saturation') sat *= x.amount;
      else if (x.type === 'chromaDrop') chroma = Math.max(chroma, Math.min(1, x.amount));
      else if (x.type === 'iris') iris = [Math.max(0, x.r), x.cx ?? .5, x.cy ?? .5, x.feather ?? 2];
    }
    gl.useProgram(M.p); gl.bindVertexArray(empty);
    gl.uniform2f(u.uTarget, W, H); gl.uniform1f(u.uScale, scale);
    gl.uniform2f(u.uC, m.x, m.y); gl.uniform1f(u.uAng, m.angle); gl.uniform1f(u.uS, m.scale); gl.uniform1f(u.uPx, m.px ?? m.scale);
    gl.uniform1f(u.uLevel, r.level ?? 0); gl.uniform1f(u.uPhase, (time * 15) % 22);
    gl.uniform4f(u.uCell, cell.x, cell.y, cell.w, cell.h); gl.uniform1f(u.uRadius, layer.radius || 0);
    gl.uniform4f(u.uIris, ...iris); gl.uniform1f(u.uOpacity, layer.opacity); gl.uniform1f(u.uSat, sat); gl.uniform1f(u.uChroma, chroma);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 22);
    stats.mouths++;
  }

  const identity = rect => [1, 0, -rect.x, 0, 1, -rect.y, 0, 0, 1];     // output px -> rect-local px
  // Type stays inside the format's platform-safe area (in 9:16, left of the right rail).
  const safeOf = rect => safeSpan(rect, SAFE[format]);
  // transient: a moving board (a board move eases its rect every frame) draws through one reused
  // instance, resized, instead of a new board for every size.
  // The picture under a board region at one value per peg, for the psych 'footage' look: the
  // composite averaged over each peg's cell into a cols × rows target, read back top row first.
  let pegTarget = null, pegData = null;
  function samplePegs(rect, grid) {
    const cols = grid.cols, rows = grid.rows;
    if (!pegTarget || pegTarget.w !== cols || pegTarget.h !== rows) { free(pegTarget); pegTarget = target(cols, rows); }
    gl.disable(gl.BLEND); bindTarget(pegTarget); gl.useProgram(P.pegs.p); gl.bindVertexArray(empty);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.comp.tex); gl.uniform1i(P.pegs.u.uSrc, 0);
    gl.uniform4f(P.pegs.u.uRect, (rect.x + grid.ox) * scale, (rect.y + grid.oy) * scale, cols * grid.pitch * scale, rows * grid.pitch * scale);
    gl.uniform2f(P.pegs.u.uSize, W, H); gl.uniform2f(P.pegs.u.uGrid, cols, rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const n = cols * rows * 4, raw = new Uint8Array(n);
    gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    if (!pegData || pegData.length !== n) pegData = new Uint8Array(n);
    for (let y = 0; y < rows; y++) pegData.set(raw.subarray((rows - 1 - y) * cols * 4, (rows - y) * cols * 4), y * cols * 4);
    resetState(); bindTarget(T.comp);
    stats.pegSamples = (stats.pegSamples || 0) + 1;
    return {cols, rows, data:pegData};
  }
  function drawBoardRegion(rect, screens, time, {sockets = true, blend = 'over', pitch, cell = null, radius = 0, target = null, opacity = 1, transient = false, psych = null} = {}) {
    if (!boards) return;
    const sample = psych?.some(p => p.look === 'footage') ? grid => samplePegs(rect, grid) : null;
    const b = boards.draw({w:rect.w, h:rect.h, screens, time, pitch, sockets, safe:safeOf(rect), transient, psych, sample});
    stats.boards++;
    resetState(); bindTarget(target ?? T.comp);
    if (blend === 'max') gl.blendEquation(gl.MAX);
    const r = cell ?? {x:rect.x, y:rect.y, w:rect.w, h:rect.h};
    drawLayerPass({transform:{matrix:identity(rect)}, opacity, fx:[], cell:r, radius}, {kind:0, tex:b.texture, flip:1, srcW:Math.round(rect.w), srcH:Math.round(rect.h)}, {matrix:identity(rect)});
    gl.blendEquation(gl.FUNC_ADD);
    return b;
  }

  function lookOf(layer, sources, index, time) {
    if (layer.kind === 'generated') {
      const g = layer.gen || '';
      if (g === 'black') return {kind:1, color:[0, 0, 0, 1]};
      if (g === 'white') return {kind:1, color:[1, 1, 1, 1]};
      if (g.startsWith('color:')) return {kind:1, color:[...hexRGB(g.slice(6)), 1]};
      if (g === 'camera-off' || g === 'feedback') return {kind:2};
      if (g === 'board') {
        const b = boards?.draw({w:layer.cell.w, h:layer.cell.h, screens:ctx.screens, time, safe:safeOf(layer.cell)});
        if (b) { stats.boards++; resetState(); bindTarget(T.comp); return {kind:0, tex:b.texture, flip:1, srcW:Math.round(layer.cell.w), srcH:Math.round(layer.cell.h)}; }
        return {kind:1, color:[0, 0, 0, 1]};
      }
      return {kind:1, color:EMPTY_TILE};
    }
    const src = typeof sources === 'function' ? sources(layer, index) : sources?.get?.(layer.clipId) ?? sources?.[layer.clipId] ?? null;
    if (!src) { stats.missing++; return {kind:1, color:EMPTY_TILE}; }
    const t = upload(src);
    if (!t) { stats.missing++; return {kind:1, color:EMPTY_TILE}; }
    const shot = ctx.shots?.get(layer.shotId);
    return {kind:0, tex:t.tex, flip:t.flip, srcW:src.width ?? shot?.width ?? t.w, srcH:src.height ?? shot?.height ?? t.h};
  }

  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // ---- the frame ----
  function drawFrame(frame, sources, o = {}) {
    const t0 = performance.now();
    if (o.format && o.format !== format) setFormat(o.format);
    const program = o.program ?? ctx.program;
    drawCount++;
    stats = {passes:0, uploads:0, boards:0, chrome:0, missing:0, mouths:0, layers:frame.layers.length, droste:0};
    const time = frame.time, seed = (frame.f * 2654435761) >>> 0, btime = boardTimeOf(frame);
    resetState(); bindTarget(T.comp); clear(BACKGROUND);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // The board's own region (frame.board.rect: the format's home in every call layout, eased
    // only inside a board move): under the tiles, unless a picture covers it (then over, below).
    // It stays up whether or not a screen is on it, so its panel never comes and goes.
    // A camera move that does not own the board leaves it out of the composite: it is drawn
    // after the camera, fixed in its region, so a push or a Droste dive never carries the
    // words out of frame.
    const rect = frame.board?.rect, screens = ctx.screens, fixed = !!(rect && frame.camera && !frame.camera.board), moving = !!frame.board?.move;
    const under = rect ? frame.layers.filter(l => overlaps(l.cell, rect)) : [];
    // Psych imagery: in the board's region (no cell) under its type, or in its own cells over the tiles;
    // a psych cell over the board's region puts the board over it, so the type still wins.
    const psychAll = frame.board?.psych || [], psychMain = psychAll.filter(p => !p.rect), psychCells = psychAll.filter(p => p.rect);
    const covered = !!rect && psychCells.some(p => overlaps(p.rect, rect));
    const pegUnder = moving ? null : under.find(l => l.fx.some(x => x.type === 'pegVideo' && x.mix >= .5));
    const videoUnder = under.some(l => l.kind === 'video');
    // panel: 1 the whole board, sockets and all (L1's panel laid over the picture, so its type
    // reads over a bright frame; a board over generated tiles); 0 only its light over a full-frame
    // picture (MAX); between, inside a board move, the light with the panel fading in over it.
    const panel = frame.board?.panel ?? (!under.length || frame.board?.over || !videoUnder ? 1 : 0);
    const regionRadius = rect && (rect.w < F.w || rect.h < F.h) ? 12 : 0;
    const drawMain = (target = null) => {
      // (Over peg video the board takes its pitch, so the two grids coincide: the ignition, the loop seam's ghost.)
      // (An EDL's own board grid, edl.boardPitch, holds otherwise: Delve.'s 90 x 160 pegs at every render scale.)
      const pitch = pegUnder && !frame.board.over ? pegUnder.fx.find(x => x.type === 'pegVideo').pitch : frame.board.pitch, base = {cell:rect, radius:regionRadius, target, transient:moving, pitch, psych:psychMain.length ? psychMain : null};
      if (panel >= 1) drawBoardRegion(rect, screens, btime, base);
      else {
        drawBoardRegion(rect, screens, btime, {...base, sockets:!videoUnder, blend:videoUnder ? 'max' : 'over'});
        if (panel > 0) drawBoardRegion(rect, screens, btime, {...base, opacity:panel});
      }
    };
    // The board-only fast path (Delve.): a full-frame board panel over nothing but flat colour clips of the whole
    // frame (no effects, no trails, no camera, no cells, no banner, no footage look): the board's texture is opaque
    // over the whole frame, so the composite is that texture, copied in with one texel fetch a pixel instead of the
    // uber shader's two passes (under SwiftShader about 2.5 s a pass at 540 x 960; on a GPU, nothing to speak of).
    // Pixel for pixel what the slow path draws (check-videostudio-export section 9 compares them).
    const fullRect = !!rect && rect.x === 0 && rect.y === 0 && rect.w === F.w && rect.h === F.h;
    let fast = fastBoard && o.fast !== false && fullRect && !frame.camera && !moving && !frame.board.over && panel >= 1 && !psychCells.length && !(frame.board.cells || []).length && !frame.board.banner
      && !psychMain.some(p => p.look === 'footage') && frame.layers.every(l => l.kind === 'generated' && /^color:/.test(l.gen || '') && l.cell.id === 'full' && !l.fx.length && !l.trail && l.opacity >= .999);
    if (fast) {
      const b = boards.draw({w:rect.w, h:rect.h, screens, time:btime, pitch:frame.board.pitch, sockets:true, safe:safeOf(rect), psych:psychMain.length ? psychMain : null});
      if (b.width === W && b.height === H) {
        stats.boards++; stats.fast = true;
        resetState(); bindTarget(T.comp); gl.disable(gl.BLEND); gl.useProgram(P.copy.p); gl.bindVertexArray(empty);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, b.texture); gl.uniform1i(P.copy.u.uSrc, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3); stats.passes++;
      } else fast = false;
    }
    if (!fast) {
    if (rect && !under.length && !fixed && !covered) drawMain();
    for (const cs of frame.board?.cells || []) if (cs.z !== 'over') drawBoardRegion(cs.rect, [ctx.cells[cs.screen]], btime, {cell:cs.rect, radius:12});

    // The layers, each with its chrome.
    const bannerRect = frame.board?.banner ?? null;
    frame.layers.forEach((layer, i) => {
      if (layer.trail) return;             // drawn with the layer it trails, below
      resetState(); bindTarget(T.comp);
      const look = lookOf(layer, sources, i, btime);
      resetState(); bindTarget(T.comp);
      const echo = layer.fx.find(x => x.type === 'echo');
      if (echo && program && look.kind === 0) {
        for (let k = Math.min(8, Math.round(echo.taps)); k >= 1; k--) {
          const g = frame.f - k * Math.max(1, Math.round(echo.frames ?? 1));
          const prev = g >= 0 && g < program.frames ? program.frame(g).layers.find(l => l.clipId === layer.clipId) : null;
          if (prev) drawLayerPass(layer, look, {matrix:prev.transform.matrix, opacity:layer.opacity * (echo.decay ?? .6) ** k, fx:layer.fx.filter(x => x.type !== 'echo'), seed, time});
        }
      }
      drawLayerPass(layer, look, {seed, time});
      // Its trail: the clip's own earlier frames over it, a copy only brightening (MAX) for lighten.
      frame.layers.forEach((tap, j) => {
        if (tap.trail?.of !== layer.clipId) return;
        const tl = lookOf(tap, sources, j, btime);
        resetState(); bindTarget(T.comp);
        if (tap.trail.blend === 'lighten') gl.blendEquation(gl.MAX);
        drawLayerPass(tap, tl, {seed, time});
        gl.blendEquation(gl.FUNC_ADD); stats.trails = (stats.trails || 0) + 1;
      });
      if (layer.robot && look.kind === 0) drawMouth(layer, time);
      const quads = [];
      if (layer.gen === 'camera-off' || layer.gen === 'feedback' || layer.chrome?.cameraOff) {
        if (layer.cell.id !== 'full') quads.push(...tileQuads(layer, atlas, {scale, time, legible:LEGIBLE[format]}));
      }
      const m = layer.robot?.mouth, avoid = m ? {x:m.x - m.w / 2 - 4, y:m.y - m.h / 2 - 4, w:m.w + 8, h:m.h + 8} : null;
      quads.push(...chromeQuads(layer, atlas, {scale, time, bannerRect, avoid, legible:LEGIBLE[format]}));
      if (quads.length) { resetState(); bindTarget(T.comp); drawChrome(quads); }
    });

    // Psych cells: their own peg board, a panel over the tile (its footage sampled first), laid on at the
    // cue's fade, so the picture dissolves into the dot grid and back instead of cutting to its panel.
    for (const p of psychCells) drawBoardRegion(p.rect, NO_SCREENS, btime, {cell:p.rect, radius:p.cell === 'full' ? 0 : 12, psych:[p], opacity:Math.min(1, Math.max(0, p.fade ?? 1))});
    // The board over full-frame pictures: its light over footage (MAX), or the whole board over generated tiles.
    if (rect && (under.length || covered) && !fixed) drawMain();
    for (const cs of frame.board?.cells || []) if (cs.z === 'over') drawBoardRegion(cs.rect, [ctx.cells[cs.screen]], btime, {cell:cs.rect, radius:12, blend:'max', sockets:false});
    if (bannerRect) {
      const text = frame.layers.find(l => l.chrome?.banner)?.chrome.banner;
      if (text) { resetState(); bindTarget(T.comp); drawChrome(bannerQuads(text, bannerRect, atlas, {scale, legible:LEGIBLE[format]})); }
    }
    }

    // Droste: each level is the frame with the feedback tile holding the level before.
    let out = T.comp;
    const dro = frame.layers.find(l => l.gen === 'feedback' && l.fx.some(x => x.type === 'droste'));
    if (dro) {
      const fx = dro.fx.find(x => x.type === 'droste'), n = Math.min(4, Math.ceil(fx.depth - 1e-9)), s = fx.scale ?? 1 / 3;
      const cx = dro.cell.x + (fx.cx ?? .5) * dro.cell.w, cy = dro.cell.y + (fx.cy ?? .5) * dro.cell.h;
      // output px -> previous level px: the whole frame at `s`, centred on (cx, cy).
      const M = [1 / s, 0, F.w / 2 - cx / s, 0, 1 / s, F.h / 2 - cy / s, 0, 0, 1];
      const m = dro.robot?.mouth;
      for (let k = 1; k <= n; k++) {
        const dst = T.ping[(k - 1) % 2];
        gl.disable(gl.BLEND); bindTarget(dst); gl.useProgram(P.copy.p); gl.bindVertexArray(empty);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.comp.tex); gl.uniform1i(P.copy.u.uSrc, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        resetState(); bindTarget(dst);
        const alpha = k < n ? 1 : Math.min(1, fx.depth - (n - 1));
        drawLayerPass(dro, {kind:0, tex:out.tex, flip:1, srcW:F.w, srcH:F.h}, {matrix:M, opacity:dro.opacity * alpha, fx:dro.fx.filter(x => x.type !== 'droste'), seed, time});
        drawChrome(chromeQuads(dro, atlas, {scale, time, avoid:m ? {x:m.x - m.w / 2, y:m.y - m.h / 2, w:m.w, h:m.h} : null, legible:LEGIBLE[format]}));
        out = dst; stats.droste++;
      }
    }

    // The composite camera: the whole frame through the cue's matrix and effects.
    if (frame.camera) {
      resetState(); bindTarget(T.cam); clear(BACKGROUND);
      const full = {id:'full', x:0, y:0, w:F.w, h:F.h};
      drawLayerPass({transform:{matrix:frame.camera.matrix}, opacity:1, fx:frame.camera.fx || [], cell:full, radius:0}, {kind:0, tex:out.tex, flip:1, srcW:F.w, srcH:F.h}, {seed, time});
      out = T.cam;
      if (fixed) { drawMain(T.cam); stats.fixedBoard = true; }
    }

    // Post: bloom, gain, grain, dither, to the canvas.
    gl.disable(gl.BLEND); gl.bindVertexArray(empty);
    let bloomTex = null;
    const B = post.bloom;
    if (B && B.weight > 0 && T.mip.length) {
      const pass = (prog, dst, src, texel) => {
        bindTarget(dst); gl.useProgram(prog.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(prog.u.uSrc, 0);
        gl.uniform2f(prog.u.uTexel, 1 / texel.w, 1 / texel.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      gl.useProgram(P.bright.p); gl.uniform1f(P.bright.u.uT, B.threshold); gl.uniform1f(P.bright.u.uK, B.knee);
      pass(P.bright, T.mip[0], out, out);
      for (let k = 1; k < T.mip.length; k++) pass(P.down, T.mip[k], T.mip[k - 1], T.mip[k - 1]);
      let src = T.mip.at(-1);
      for (let k = T.mip.length - 2; k >= 0; k--) { pass(P.up, T.ups[k], src, src); src = T.ups[k]; }
      bloomTex = src.tex;
    }
    bindTarget(null);
    const Fp = P.final; gl.useProgram(Fp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, out.tex); gl.uniform1i(Fp.u.uSrc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomTex || out.tex); gl.uniform1i(Fp.u.uBloom, 1);
    gl.uniform1f(Fp.u.uBloomW, bloomTex ? B.weight : 0);
    const gain = o.gain ?? ctx.gains?.[frame.f] ?? 1;
    gl.uniform1f(Fp.u.uGain, gain);
    gl.uniform1f(Fp.u.uGrain, post.grain || 0); gl.uniform1f(Fp.u.uDither, post.dither ? 1 : 0); gl.uniform1ui(Fp.u.uSeed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    if (drawCount % 60 === 0) prune();
    stats.gain = gain; stats.ms = performance.now() - t0;
    return stats;
  }

  // The canvas as RGBA rows, top row first. Call right after drawFrame (or with preserveDrawingBuffer).
  function read() {
    const raw = new Uint8Array(W * H * 4), out = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    for (let y = 0; y < H; y++) out.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return {width:W, height:H, data:out};
  }

  function setFormat(next) {
    if (!FORMATS[next]) throw Error(`unknown format ${next}`);
    if (next === format && W) return;
    format = next; resize();
  }
  function setScale(s) {
    if (s === scale) return;
    scale = s; atlas.setScale(s); boards?.setScale(s); resize();
  }

  return {
    gl, canvas, ready, prepare, drawFrame, read, setFormat, setScale,
    setPost(p) { post = {...post, ...p}; resize(); },
    get format() { return format; }, get scale() { return scale; }, get width() { return W; }, get height() { return H; },
    get stats() { return {...stats}; }, get gains() { return ctx.gains; },
    get textures() { return cache.size; },
    dispose() {
      boards?.dispose(); Object.values(T).flat().forEach(free); free(pegTarget); pegTarget = null;
      for (const t of cache.values()) gl.deleteTexture(t.tex);
      cache.clear(); gl.deleteTexture(atlasTex);
      Object.values(P).forEach(p => gl.deleteProgram(p.p));
      gl.deleteBuffer(chromeBuf); gl.deleteVertexArray(chromeVao); gl.deleteVertexArray(empty);
    },
  };
}

// ---- the flash governor over the whole composite (rule G6) -------------------------------------
// Predicted relative luminance per frame, whole and per quadrant, from a 9 × 16 grid of the
// frame: the top layer at each grid point gives its luma (footage: the shot's lumaTrack at the
// layer's source frame; generated tiles: exact), the board region its boardLuma. Then the
// Peg Board's governor turns it into a gain per frame: never more than 3 flashes a second.
export function governorGains(program, {plan, shots, boards}) {
  const F = {w:program.width, h:program.height}, GX = 9, GY = 16, frames = [], grids = new Map();
  const lumaOf = new Map();
  const shotLuma = (id, f) => {
    if (!lumaOf.has(id)) { const s = shots?.get(id); lumaOf.set(id, s?.lumaTrack ? decode(s.lumaTrack) : null); }
    const tr = lumaOf.get(id);
    return tr ? lin(tr[Math.min(tr.length - 1, Math.max(0, f))] / 255) : .18;
  };
  for (let f = 0; f < program.frames; f++) {
    const fr = program.frame(f), q = [0, 0, 0, 0];
    let boardL = null;
    const psych = fr.board?.psych || [], psychMain = psych.filter(p => !p.rect), psychCells = psych.filter(p => p.rect), cellL = new Map();
    const boardLuma = () => boardL ??= fr.board?.rect && boards ? boards.luma({w:fr.board.rect.w, h:fr.board.rect.h, screens:boardScreens(program.board.screens), time:boardTimeOf(fr), pitch:fr.board.pitch, safe:safeSpan(fr.board.rect, SAFE[program.format]), psych:psychMain}, grids).whole : 0;
    // A psych cell's own board (footage: predicted as the picture it takes over).
    const cellLuma = p => { if (!cellL.has(p)) cellL.set(p, boards ? boards.luma({w:p.rect.w, h:p.rect.h, screens:[], time:boardTimeOf(fr), psych:[p]}, grids).whole : 0); return cellL.get(p); };
    const covered = !!fr.board?.rect && psychCells.some(p => p.rect.x < fr.board.rect.x + fr.board.rect.w && fr.board.rect.x < p.rect.x + p.rect.w && p.rect.y < fr.board.rect.y + fr.board.rect.h && fr.board.rect.y < p.rect.y + p.rect.h);
    let whole = 0;
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      const x = (gx + .5) * F.w / GX, y = (gy + .5) * F.h / GY;
      let v = 0;
      const r = fr.board?.rect, inBoard = r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      if (inBoard) v = boardLuma();
      for (const l of fr.layers) {
        const c = l.cell;
        if (x < c.x || x >= c.x + c.w || y < c.y || y >= c.y + c.h) continue;
        const g = l.gen || '';
        let lv = l.kind === 'video' ? shotLuma(l.shotId, l.srcFrame) : g === 'white' ? 1 : g.startsWith('color:') ? lin(lumaHex(g.slice(6))) : g === 'board' ? boardLuma() : g === 'camera-off' || g === 'feedback' ? .012 : 0;
        // Pegs blooming over footage: a peg lights about a third of its cell.
        const pb = l.fx.find(x => x.type === 'pegBloom');
        if (pb) lv *= 1 - .65 * Math.min(1, pb.amount);
        if (l.trail?.blend === 'lighten') v = Math.max(v, lv * l.opacity);
        else v = v * (1 - l.opacity) + lv * l.opacity;
      }
      for (const p of psychCells) { const c = p.rect, a = Math.min(1, Math.max(0, p.fade ?? 1)); if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h && p.look !== 'footage') v = v * (1 - a) + cellLuma(p) * a; }
      // A panel laid over the picture (L1's, a moving board, a board over a psych cell) covers it.
      if (inBoard && (fr.board.over || covered)) { const p = fr.board.panel ?? 1; v = v * (1 - p) + boardLuma() * p; }
      whole += v; q[(gy < GY / 2 ? 0 : 2) + (gx < GX / 2 ? 0 : 1)] += v;
    }
    frames.push({whole:whole / (GX * GY), quads:q.map(v => v / (GX * GY / 4))});
  }
  return governorTrack(frames, 24);
}
const lin = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const lumaHex = h => { const [r, g, b] = hexRGB(h); return .2126 * r + .7152 * g + .0722 * b; };
function decode(b64) {
  if (b64 instanceof Uint8Array) return b64;
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
