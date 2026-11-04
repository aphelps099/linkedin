// Canvas2D Peg Board renderer: the fallback when WebGL2 fails or its context is
// lost (renderer.js decides). It also holds the CPU reference of the peg model
// that the GLSL in renderer-gl.js mirrors: the per-peg hash, the palette in
// linear light, the peg profile and the socket. Change one, change both.
//
// The fallback trades fidelity for speed: sockets are drawn once into a cached
// layer, lit pegs are pre-drawn sprites (4 tones × 6 intensities, tone-mapped)
// added together, bloom is the light layer halved down (to 1/8 and beyond, by
// pitch) and scaled back up, and at most 4,000 pegs (the brightest) are drawn per frame. Sprites add
// with 'screen' rather than 'lighter': for tone-mapped light, 1 - exp(-(a + b))
// is exactly 1 - (1 - ta)(1 - tb), so overlapping halos sum as they do in GL
// instead of clipping to white.
import {TONES, SOCKET} from './board.js';

// ---------------------------------------------------------------- shared model

export const srgbToLinear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
export const linearToSrgb = v => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;
export const hexLinear = hex => [1, 3, 5].map(i => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
// Palette and sockets in linear light, by TONES index.
export const LINEAR = {
  ring:TONES.map(t => hexLinear(t.ring)), core:TONES.map(t => hexLinear(t.core)), glow:TONES.map(t => hexLinear(t.glow)),
  hole:hexLinear(SOCKET.hole), lip:hexLinear(SOCKET.lip),
};
export const WHITE = 1;   // TONES index the `white` mix heads toward
export const tonemap = L => 1 - Math.exp(-1.1 * L);   // per channel: overdriven blue burns to white

// Integer hash of a peg's column and row. GLSL's uint arithmetic wraps exactly
// like Math.imul, so both renderers vary the same pegs the same way.
const mix32 = x => {
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return x >>> 0;
};
// Uniform in [0, 1) for peg (x, y) and channel k.
export const pegRandom = (x, y, k) => (mix32((Math.imul(x, 0x9e3779b1) ^ mix32((y + Math.imul(k, 0x85ebca77)) >>> 0)) >>> 0) >>> 8) / 16777216;
// Hand-placed variation (channels: 1 brightness, 2 size, 3-4 centre, 5-6 shimmer, 7 the late peg).
export const VARIATION = {bright:.045, size:.025, centre:.02, shimmer:.02, hz:[3, 7], late:1 / 400, lateDim:.12};
// One peg in 400 is 12% dimmer; choreography also lights it 2 frames late.
export const isLatePeg = (x, y) => pegRandom(x, y, 7) < VARIATION.late;
export function pegVariation(x, y, time = 0) {
  const V = VARIATION, f = V.hz[0] + (V.hz[1] - V.hz[0]) * pegRandom(x, y, 5), ph = f * time + pegRandom(x, y, 6);
  return {
    gain:(1 + (pegRandom(x, y, 1) * 2 - 1) * V.bright) * (1 + V.shimmer * Math.sin(2 * Math.PI * (ph - Math.floor(ph))))
      * (isLatePeg(x, y) ? 1 - V.lateDim : 1),
    size:1 + (pegRandom(x, y, 2) * 2 - 1) * V.size,
    jx:(pegRandom(x, y, 3) * 2 - 1) * V.centre, jy:(pegRandom(x, y, 4) * 2 - 1) * V.centre,
  };
}

// The peg's light at (qx, qy) pitch units from its centre, in linear RGB (added
// into `out`). I is the varied intensity, s the varied size, px one pixel in
// pitch units (narrow features widen to at least a pixel so they never alias).
const LIGHT = [-.6, -.66, .45], LN = Math.hypot(...LIGHT), NO_FACET = {f:0, g:0};
export function pegLight(out, qx, qy, I, s, ring, core, glow, px, halo = 1) {
  const r = Math.hypot(qx, qy);
  if (r > 1.25 || I < .02) return 0;
  const R = .35 * s, e = Math.max(.02 * s, .5 * px);
  const body = smooth(R + e, R - e, r);
  const facet = body > 0 ? domeFacet(qx / R, qy / R) : NO_FACET;
  const wc = .14 * s, wc2 = wc * wc + px * px / 6, wr = Math.sqrt(.025 * .025 + px * px / 6);
  const kC = Math.pow(I, 1.3) * 1.8 * (wc * wc / wc2) * Math.exp(-r * r / wc2);
  const kB = I * body * (.82 + .18 * facet.f) + I * .35 * (.025 / wr) * Math.exp(-(((r - .33 * s) / wr) ** 2));
  const kH = halo * I * .55 * Math.exp(-Math.max(r - .33 * s, 0) / .11), kS = facet.g * Math.min(I, 1) * body;
  for (let c = 0; c < 3; c++) out[c] += core[c] * kC + ring[c] * kB + glow[c] * kH + kS;
  return body;
}
// A domed cap lit from the top left: a broad facet (the spec's .82 + .18·facet)
// and a small glossy glint.
const H = (() => { const h = [LIGHT[0] / LN, LIGHT[1] / LN, LIGHT[2] / LN + 1], n = Math.hypot(...h); return h.map(v => v / n); })();
function domeFacet(x, y) {
  const z = Math.sqrt(Math.max(1 - x * x - y * y, 0)) + .35, n = Math.hypot(x, y, z);
  const d = Math.max((x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]) / (n * LN), 0);
  const g = Math.max((x * H[0] + y * H[1] + z * H[2]) / n, 0);
  return {f:d * d * d, g:GLINT * Math.pow(g, 40)};
}
export const GLINT = .3;
// An empty socket at (qx, qy) from its centre: a dark hole (r < .30) with an
// inner shadow at the top left and a lighter lip at the lower right.
export function socketColour(out, qx, qy, px, shade = true) {
  const rho = Math.hypot(qx, qy) / .3, e = .6 * px / .3, disc = smooth(1 + e, 1 - e, rho);
  if (disc <= 0) return;
  const H0 = LINEAR.hole, L0 = LINEAR.lip;
  if (!shade) { for (let c = 0; c < 3; c++) out[c] += H0[c] * disc; return; }
  const g = (qx + qy) / (Math.SQRT2 * .3), f = rho > 1e-6 ? g / rho : 0;   // g: -1 top left .. +1 lower right
  const lip = smooth(.62, .97, rho) * smooth(.1, .85, f), dark = smooth(.35, .95, rho) * smooth(.1, .85, -f);
  for (let c = 0; c < 3; c++) out[c] += (H0[c] * (1 + .35 * g) * (1 - lip) + L0[c] * 1.15 * lip) * (1 - .5 * dark) * disc;
}
export function smooth(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }

// ---------------------------------------------------------------- Canvas2D renderer

const LEVELS = [.08, .2, .45, 1, 1.6, 2.2];   // sprite intensities; a peg uses the nearest (by ratio), scaled
const MAX_LIT = 4000;
// Screen-adding sRGB sprites still over-counts where halos overlap (inside words), so the 2D halo is trimmed.
const HALO_2D = .6;

export function createRenderer2D(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', {alpha:false});
  if (!ctx) throw new Error('Canvas2D unavailable');
  const doc = canvas.ownerDocument;
  const mk = (w, h) => { const c = doc ? doc.createElement('canvas') : new OffscreenCanvas(w, h); c.width = w; c.height = h; return c; };
  let pixelRatio = opts.pixelRatio ?? Math.min(2, globalThis.devicePixelRatio || 1);
  const quality = {bloom:2, renderScale:1, socketShading:true, ...opts.quality};
  let css = [canvas.width / pixelRatio, canvas.height / pixelRatio], scale = pixelRatio;
  let light = null, lctx = null, chain = [], sprites = null, spriteKey = '', sockets = null, socketKey = '';
  const maxLit = opts.maxLit ?? MAX_LIT;

  function resize(w, h) {
    css = [w, h]; scale = pixelRatio * quality.renderScale;
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    light = mk(canvas.width, canvas.height); lctx = light.getContext('2d');
    chain = [2, 4, 8, 16, 32, 64, 128].map(d => { const c = mk(Math.max(1, Math.ceil(canvas.width / d)), Math.max(1, Math.ceil(canvas.height / d))); return {c, x:c.getContext('2d')}; });
    socketKey = '';
  }

  // Sprites: one per tone and level, tone-mapped and sRGB-encoded on black.
  // The sprite's centre sits at floor(S/2) + (fx, fy), the fractional part of every
  // peg centre on this grid, so seated pegs land on whole pixels (no resampling blur).
  function buildSprites(P, fx, fy) {
    const S = Math.ceil(2.5 * P) + 1, cx = Math.floor(S / 2) + fx, cy = Math.floor(S / 2) + fy;
    const img = new ImageData(S, S), acc = [0, 0, 0], px = 1 / P;
    const list = TONES.map((_, t) => LEVELS.map(I => {
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        acc[0] = acc[1] = acc[2] = 0;
        pegLight(acc, (i + .5 - cx) * px, (j + .5 - cy) * px, I, 1, LINEAR.ring[t], LINEAR.core[t], LINEAR.glow[t], px, HALO_2D);
        const o = (j * S + i) * 4;
        for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(255 * linearToSrgb(tonemap(acc[c])));
        img.data[o + 3] = 255;
      }
      const c = mk(S, S); c.getContext('2d').putImageData(img, 0, 0); return c;
    }));
    return {S, cx, cy, list};
  }

  // The socket layer for this geometry, cached until pitch, grid or offset changes.
  function buildSockets(b, P, ox, oy) {
    const W = Math.ceil(b.cols * P + 2), Hh = Math.ceil(b.rows * P + 2), fx = ox - Math.floor(ox), fy = oy - Math.floor(oy);
    const S = Math.ceil(.7 * P) + 2, img = new ImageData(S, S), acc = [0, 0, 0], px = 1 / P;
    const ax = (fx + P / 2) % 1, ay = (fy + P / 2) % 1, sx = Math.floor(S / 2) + ax, sy = Math.floor(S / 2) + ay;   // pixel-aligned stamp
    const layer = mk(W, Hh), g = layer.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      acc[0] = acc[1] = acc[2] = 0;
      socketColour(acc, (i + .5 - sx) * px, (j + .5 - sy) * px, px, quality.socketShading);
      const o = (j * S + i) * 4;
      for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(255 * linearToSrgb(tonemap(acc[c])));
      img.data[o + 3] = 255;
    }
    const stamp = mk(S, S); stamp.getContext('2d').putImageData(img, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++)
      g.drawImage(stamp, Math.round(fx + (x + .5) * P - sx), Math.round(fy + (y + .5) * P - sy));
    return layer;
  }

  // The brightest `maxLit` pegs (by intensity) above .02, across the board and any added layers.
  function litPegs(boards) {
    const lit = [];
    for (const b of boards) for (let i = 0, n = b.cols * b.rows; i < n; i++) if (b.I[i] >= .02) lit.push(b, i);
    if (lit.length / 2 <= maxLit) return lit;
    const v = []; for (let k = 0; k < lit.length; k += 2) v.push(lit[k].I[lit[k + 1]]);
    const cut = Float32Array.from(v).sort()[v.length - maxLit], out = [];
    for (let k = 0; k < lit.length && out.length < 2 * maxLit; k += 2) if (lit[k].I[lit[k + 1]] >= cut) out.push(lit[k], lit[k + 1]);
    return out;
  }

  function draw(b, {pitch, x = 0, y = 0, time = 0, kick = 0, add = []} = {}) {
    if (!light) resize(...css);
    const P = pitch * scale, ox = x * scale, oy = y * scale, W = canvas.width, Hc = canvas.height;
    const key = P.toFixed(3), fx = ox + P / 2 - Math.floor(ox + P / 2), fy = oy + P / 2 - Math.floor(oy + P / 2);
    const spk = [key, fx.toFixed(3), fy.toFixed(3)].join();
    if (spk !== spriteKey) { sprites = buildSprites(P, fx, fy); spriteKey = spk; }
    const sk = [b.cols, b.rows, key, (ox % 1).toFixed(3), (oy % 1).toFixed(3), quality.socketShading].join();
    if (sk !== socketKey) { sockets = buildSockets(b, P, ox, oy); socketKey = sk; }
    const rw = b.cols * P, rh = b.rows * P, ex = b.exposure;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hc);
    ctx.beginPath(); ctx.rect(ox, oy, rw, rh); ctx.clip();
    const sa = Math.min(1, b.sockets * ex);
    if (sa > 0) { ctx.globalAlpha = sa; ctx.drawImage(sockets, Math.floor(ox), Math.floor(oy)); }

    // Lit pegs, additive, into the light layer.
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, Hc);
    lctx.globalCompositeOperation = 'screen';
    const lit = litPegs([b, ...add]), S = sprites.S;
    for (let k = 0; k < lit.length; k += 2) {
      const B = lit[k], i = lit[k + 1], cx = i % B.cols, cy = (i - cx) / B.cols, v = pegVariation(cx, cy, time);
      const I = B.I[i] * v.gain * ex, w = Math.min(Math.max(B.white[i], 0), 1), t = B.tone[i] & 3;
      let l = 0; while (l < LEVELS.length - 1 && LEVELS[l] * LEVELS[l + 1] < I * I) l++;   // nearest level in log terms
      // Seated pegs at their own size snap to the pixel grid; anything else is resampled.
      const a = Math.min(1, I / LEVELS[l]), sz = B.size[i] * v.size, seated = B.dx[i] === 0 && B.dy[i] === 0 && Math.abs(sz - 1) < .03;
      const d = seated ? S : S * sz, k0 = seated ? 1 : sz;
      let px = ox + (cx + .5 + B.dx[i] + v.jx) * P - sprites.cx * k0, py = oy + (cy + .5 + B.dy[i] + v.jy) * P - sprites.cy * k0;
      if (seated) { px = Math.round(px); py = Math.round(py); }
      // The white mix: tone sprite, white sprite, or (in between) a crossfade. Screen-adding a
      // crossfade dims the core, so the ends snap (white-hot w .8 is drawn as white).
      const wq = w < .25 ? 0 : w > .75 ? 1 : (w - .25) * 2;
      if (wq < 1) { lctx.globalAlpha = a * (1 - wq); lctx.drawImage(sprites.list[t][l], px, py, d, d); }
      if (wq > 0) { lctx.globalAlpha = a * wq; lctx.drawImage(sprites.list[WHITE][l], px, py, d, d); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(light, 0, 0);

    // Cheap bloom: halve the light layer repeatedly and scale one level back up. A
    // level 2^k down blurs by σ ≈ .65·2^k px, so the halation (.8P) and atmosphere
    // (5P) pick their level by pitch. Multiplying the 1/2 level by itself squares
    // it: a soft threshold, so (as in GL) mostly the hot pegs bloom.
    if (quality.bloom > 0) {
      const lv = s => Math.min(chain.length, Math.max(1, Math.round(Math.log2(s * P * Math.max(b.bloom, .1) / .65))));
      const kH = lv(.8), kA = quality.bloom > 1 ? Math.max(kH + 1, lv(5)) : 0;
      let src = light;
      for (let k = 1; k <= Math.max(kH, Math.min(kA, chain.length)); k++) {
        const {c, x:g} = chain[k - 1];
        g.globalCompositeOperation = 'copy'; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
        if (k === 1) { g.globalCompositeOperation = 'multiply'; g.drawImage(c, 0, 0); }
        src = c;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = Math.min(1, .18 * b.bloom); ctx.drawImage(chain[kH - 1].c, 0, 0, W, Hc);
      if (kA && kA <= chain.length) { ctx.globalAlpha = Math.min(1, .12 + .25 * kick); ctx.drawImage(chain[kA - 1].c, 0, 0, W, Hc); }
    }
    ctx.restore();
  }

  function read() {
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {width:d.width, height:d.height, data:new Uint8Array(d.data.buffer)};
  }

  return {
    kind:'2d', canvas,
    resize, draw, read,
    setQuality(q) { Object.assign(quality, q); resize(...css); },
    get quality() { return {...quality}; },
    setPixelRatio(r) { pixelRatio = r; resize(...css); },
    dispose() { light = lctx = sprites = sockets = null; chain = []; },
  };
}
