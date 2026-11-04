// WebGL2 Peg Board renderer. One full-screen pass draws the whole board: each
// pixel sums its own peg and the 8 around it in linear light, so the cost per
// pixel is bounded however many pegs are lit (and a cell with no lit neighbour
// skips the gather: it is only a socket). Pegs knocked further than half a pitch
// out of their sockets (rain, wide detune) and any `add` layers are drawn as
// instanced quads into the same HDR framebuffer. Then: tone-map, bloom (soft
// threshold, dual-Kawase halation and atmosphere), dither, sRGB.
//
// Peg state goes up each draw as an RGBA16F texture (I, white, size, tone) and
// an RG16F texture (dx, dy), one texel per peg; only the band of rows that
// changed since the last draw is uploaded. The peg model (hash, profile, socket)
// mirrors the CPU reference in renderer-2d.js.
import {LINEAR, GLINT} from './renderer-2d.js';

// Bloom, in pitches. board.bloom scales both radii; `kick` (0..1) adds to the atmosphere.
export const BLOOM = {threshold:.6, knee:.2, halation:{radius:.8, weight:.30}, atmosphere:{radius:5, weight:.10, kick:.25}};
const OFF_GATHER = .5;   // pegs offset further than this (pitch units, either axis) become quads
const QUAD = 1.1;        // quad half-size in pitches: wide enough that the halo is ~0 at its edge

// Dual-Kawase calibration, measured by emulating the passes below with bilinear
// taps: SIGMA[n] is the blur (σ, in texels of the level the chain starts from)
// of n downs plus n ups at offset 1 (n 7-8 extrapolated); OFFSET_GAIN scales it by the up-pass offset.
const SIGMA = [0, 1.683, 3.764, 7.714, 15.519, 31.083, 62.189, 124.4, 248.8];
const OFFSET = [.5, .75, 1, 1.25, 1.5, 1.75, 2], OFFSET_GAIN = [.767, .874, 1, 1.112, 1.237, 1.393, 1.553];
// Levels and up-offset that best reach blur σ (texels); each level already carries ~.5 texel.
export function kawasePlan(sigma, maxN) {
  let best = {n:0, o:1, sigma:.5}, err = Math.abs(Math.log(Math.max(sigma, .5) / .5));
  for (let n = 1; n <= Math.min(maxN, SIGMA.length - 1); n++) {
    const want = Math.sqrt(Math.max(sigma * sigma - .25, 0)) / SIGMA[n];
    const g = Math.min(Math.max(want, OFFSET_GAIN[0]), OFFSET_GAIN[OFFSET_GAIN.length - 1]);
    let k = 0; while (k < OFFSET_GAIN.length - 2 && OFFSET_GAIN[k + 1] < g) k++;
    const o = OFFSET[k] + (OFFSET[k + 1] - OFFSET[k]) * (g - OFFSET_GAIN[k]) / (OFFSET_GAIN[k + 1] - OFFSET_GAIN[k]);
    const got = Math.hypot(.5, SIGMA[n] * g), e = Math.abs(Math.log(got / Math.max(sigma, 1e-6))) + .02 * Math.abs(Math.log(o));   // prefer offsets near 1
    if (e < err) { err = e; best = {n, o, sigma:got}; }
  }
  return best;
}

// ---------------------------------------------------------------- GLSL

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
`;
const FULLSCREEN = HEAD + `out vec2 vUv;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

// The peg model. rel is the pixel's offset from the peg's socket centre plus its
// offset (dx, dy), in pitch units. Returns linear light; cover is how much of the
// pixel the peg's body hides (it occludes the socket under it).
const PEG = `
uniform vec3 uRing[4], uCore[4], uGlow[4];
uniform float uTime, uPx;           // seconds; one device pixel in pitch units
uint hsh(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rnd(ivec2 c, uint k) { return float(hsh(uint(c.x) * 0x9e3779b1u ^ hsh(uint(c.y) + k * 0x85ebca77u)) >> 8u) / 16777216.; }
const vec3 LIGHT = normalize(vec3(-.6, -.66, .45));    // from the top left: the glint sits at ~.65 of the radius
const vec3 HALF = normalize(LIGHT + vec3(0., 0., 1.));
vec3 pegLight(ivec2 c, vec4 st, vec2 rel, out float cover) {
  cover = 0.;
  rel -= (vec2(rnd(c, 3u), rnd(c, 4u)) * 2. - 1.) * .02;                 // placed by hand: centre ±.02P
  float r = length(rel);
  if (r > 1.25) return vec3(0.);
  float s = st.z * (1. + (rnd(c, 2u) * 2. - 1.) * .025);                  // size ±2.5%
  float I = st.x * (1. + (rnd(c, 1u) * 2. - 1.) * .045)                   // brightness ±4.5%
          * (1. + .02 * sin(6.2831853 * fract((3. + 4. * rnd(c, 5u)) * uTime + rnd(c, 6u))))   // 2% shimmer, 3-7 Hz
          * (rnd(c, 7u) < .0025 ? .88 : 1.);                              // 1 in 400 is 12% dimmer
  int t = int(st.w + .5) & 3; float w = clamp(st.y, 0., 1.);    // st.w is tone, +8 when a neighbour is lit
  vec3 ring = mix(uRing[t], uRing[1], w), core = mix(uCore[t], uCore[1], w), glow = mix(uGlow[t], uGlow[1], w);
  float R = .35 * s, e = max(.02 * s, .5 * uPx);
  float body = smoothstep(R + e, R - e, r);                               // = smoothstep(.37s, .33s, r) when sharp
  float facet = 0., glint = 0.;
  if (body > 0.) {
    vec2 q = rel / R; vec3 n = normalize(vec3(q, sqrt(max(1. - dot(q, q), 0.)) + .35));
    facet = pow(max(dot(n, LIGHT), 0.), 3.);
    glint = ${GLINT.toFixed(3)} * pow(max(dot(n, HALF), 0.), 40.) * min(I, 1.) * body;
  }
  float px2 = uPx * uPx / 6.;                                             // pixel footprint, as a variance
  float wc = .14 * s, wc2 = wc * wc + px2, wr = sqrt(.025 * .025 + px2);
  cover = body * smoothstep(.02, .05, I);
  return core * (pow(I, 1.3) * 1.8 * (wc * wc / wc2) * exp(-r * r / wc2))                    // hot core
       + ring * (I * body * (.82 + .18 * facet))                                             // body + facet
       + ring * (I * .35 * (.025 / wr) * exp(-pow((r - .33 * s) / wr, 2.)))                  // edge rim
       + glow * (I * .55 * exp(-max(r - .33 * s, 0.) / .11))                                 // halo
       + vec3(glint);
}`;

const SCENE = HEAD + `
uniform sampler2D uState, uOffs;
uniform ivec2 uGrid;
uniform vec2 uOrigin;               // board top-left, device px from the canvas top-left
uniform float uP, uH, uSockets, uExposure;
uniform int uShade;
uniform vec3 uHole, uLip;
${PEG}
out vec4 o;
// An empty socket at q (pitch units from its centre): hole r < .30, shadow top left, lip lower right.
vec3 socket(vec2 q) {
  float d = length(q), rho = d / .3, e = .6 * uPx / .3;
  float disc = smoothstep(1. + e, 1. - e, rho);
  if (uShade == 0 || disc <= 0.) return uHole * disc;
  float g = (q.x + q.y) / (1.41421356 * .3), f = d > 1e-6 ? g / rho : 0.;   // g: -1 top left .. +1 lower right
  float lip = smoothstep(.62, .97, rho) * smoothstep(.1, .85, f), dark = smoothstep(.35, .95, rho) * smoothstep(.1, .85, -f);
  return mix(uHole * (1. + .35 * g), uLip * 1.15, lip) * (1. - .5 * dark) * disc;
}
void main() {
  vec2 u = (vec2(gl_FragCoord.x, uH - gl_FragCoord.y) - uOrigin) / uP;
  if (u.x < 0. || u.y < 0. || u.x >= float(uGrid.x) || u.y >= float(uGrid.y)) { o = vec4(0.); return; }
  ivec2 cell = ivec2(floor(u));
  vec3 L = vec3(0.); float cover = 0.;
  if (texelFetch(uState, cell, 0).w > 7.5)          // some peg in the 3x3 is lit
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = cell + ivec2(i, j);
    if (c.x < 0 || c.y < 0 || c.x >= uGrid.x || c.y >= uGrid.y) continue;
    vec4 st = texelFetch(uState, c, 0);
    if (st.x < .02) continue;
    vec2 home = vec2(c) + .5, a = abs(u - home);
    float win = smoothstep(1.5, 1.3, max(a.x, a.y)), cv;     // fade out at the edge of the 3x3 gather
    L += win * pegLight(c, st, u - home - texelFetch(uOffs, c, 0).xy, cv);
    cover = max(cover, cv * win);
  }
  L += socket(u - vec2(cell) - .5) * uSockets * (1. - cover);
  o = vec4(L * uExposure, 1.);
}`;

// Pegs out of their sockets: instanced quads, added into the scene.
const QUAD_VS = HEAD + `
in vec2 aCorner; in vec4 aPeg; in vec4 aState;      // aPeg: home col, row, dx, dy
uniform vec2 uOrigin, uCanvas; uniform float uP, uExt;
out vec2 vRel; flat out vec4 vState; flat out ivec2 vHome;
void main() {
  vRel = aCorner * uExt;
  vec2 p = uOrigin + (aPeg.xy + .5 + aPeg.zw + vRel) * uP;
  gl_Position = vec4(p.x / uCanvas.x * 2. - 1., 1. - p.y / uCanvas.y * 2., 0., 1.);
  vState = aState; vHome = ivec2(aPeg.xy + .5);
}`;
const QUAD_FS = HEAD + `
uniform float uExposure, uExt;
in vec2 vRel; flat in vec4 vState; flat in ivec2 vHome;
${PEG}
out vec4 o;
void main() {
  float cv, win = smoothstep(uExt, uExt - .15, max(abs(vRel.x), abs(vRel.y)));
  o = vec4(pegLight(vHome, vState, vRel, cv) * win * uExposure, 0.);
}`;

// Bloom source at half resolution: 4 bilinear taps (a 4×4 tent), tone-mapped, soft threshold on the hottest channel.
const BRIGHT = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uT, uK;
in vec2 vUv; out vec4 o;
vec3 tap(vec2 uv) {
  vec3 c = 1. - exp(-1.1 * texture(uSrc, uv).rgb);
  float b = max(c.r, max(c.g, c.b)), s = clamp(b - uT + uK, 0., 2. * uK);
  return c * max(s * s / (4. * uK + 1e-5), b - uT) / max(b, 1e-5);
}
void main() {
  o = vec4((tap(vUv + uTexel) + tap(vUv - uTexel) + tap(vUv + vec2(uTexel.x, -uTexel.y)) + tap(vUv - vec2(uTexel.x, -uTexel.y))) * .25, 1.);
}`;
// Dual-Kawase (Bjørge 2015). uTexel is one source texel; uOff the tap offset.
const DOWN = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uOff;
in vec2 vUv; out vec4 o;
void main() {
  vec2 d = uTexel * uOff;
  o = (4. * texture(uSrc, vUv) + texture(uSrc, vUv + d) + texture(uSrc, vUv - d)
     + texture(uSrc, vUv + vec2(d.x, -d.y)) + texture(uSrc, vUv - vec2(d.x, -d.y))) / 8.;
}`;
const UP = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uOff;
in vec2 vUv; out vec4 o;
void main() {
  vec2 d = uTexel * uOff, h = .5 * d;
  o = (texture(uSrc, vUv + vec2(-d.x, 0.)) + texture(uSrc, vUv + vec2(d.x, 0.))
     + texture(uSrc, vUv + vec2(0., -d.y)) + texture(uSrc, vUv + vec2(0., d.y))
     + 2. * (texture(uSrc, vUv + h) + texture(uSrc, vUv - h) + texture(uSrc, vUv + vec2(h.x, -h.y)) + texture(uSrc, vUv - vec2(h.x, -h.y)))) / 12.;
}`;
// Tone-map, add bloom, ±.5 LSB triangular dither, sRGB. Black outside the board.
const COMPOSITE = HEAD + `
uniform sampler2D uScene, uHal, uAtm;
uniform float uWH, uWA, uH;
uniform vec4 uRect;                 // board x0, y0, x1, y1 in device px from the top-left
uint hsh(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
in vec2 vUv; out vec4 o;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y);
  if (p.x < uRect.x || p.y < uRect.y || p.x >= uRect.z || p.y >= uRect.w) { o = vec4(0., 0., 0., 1.); return; }
  vec3 c = 1. - exp(-1.1 * texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb);
  if (uWH > 0.) c += uWH * texture(uHal, vUv).rgb;
  if (uWA > 0.) c += uWA * texture(uAtm, vUv).rgb;
  c = clamp(c, 0., 1.);
  c = mix(12.92 * c, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c));
  uint h = hsh(uint(gl_FragCoord.x) * 0x9e3779b1u ^ hsh(uint(gl_FragCoord.y)));
  c += ((float(h & 0xffffu) + float(h >> 16)) / 65535. - 1.) * (.5 / 255.);
  o = vec4(c, 1.);
}`;

// ---------------------------------------------------------------- renderer

export function createRendererGL(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha:false, antialias:false, depth:false, stencil:false, premultipliedAlpha:false,
    preserveDrawingBuffer:!!opts.preserveDrawingBuffer, powerPreference:'high-performance',
  });
  if (!gl) throw new Error('WebGL2 unavailable');
  // HDR targets need a renderable half-float format; without one, use the 2D fallback.
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float'))
    throw new Error('No renderable float colour buffer');

  let pixelRatio = opts.pixelRatio ?? Math.min(2, globalThis.devicePixelRatio || 1);
  const quality = {bloom:2, renderScale:1, socketShading:true, ...opts.quality};
  let css = [canvas.width / pixelRatio, canvas.height / pixelRatio], scale = pixelRatio * quality.renderScale;

  // Programs, with every active uniform's location looked up once.
  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('Peg Board shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s); gl.deleteShader(s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('Peg Board program: ' + gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i).name; u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name);
    }
    return {p, u};
  }
  const P = {
    scene:program(FULLSCREEN, SCENE), quad:program(QUAD_VS, QUAD_FS), bright:program(FULLSCREEN, BRIGHT),
    down:program(FULLSCREEN, DOWN), up:program(FULLSCREEN, UP), comp:program(FULLSCREEN, COMPOSITE),
  };
  const flat = a => new Float32Array(a.flat());
  for (const k of ['scene', 'quad']) {
    gl.useProgram(P[k].p);
    gl.uniform3fv(P[k].u.uRing, flat(LINEAR.ring)); gl.uniform3fv(P[k].u.uCore, flat(LINEAR.core)); gl.uniform3fv(P[k].u.uGlow, flat(LINEAR.glow));
  }
  gl.useProgram(P.scene.p);
  gl.uniform3fv(P.scene.u.uHole, LINEAR.hole); gl.uniform3fv(P.scene.u.uLip, LINEAR.lip);
  gl.uniform1i(P.scene.u.uState, 0); gl.uniform1i(P.scene.u.uOffs, 1);
  gl.useProgram(P.comp.p);
  gl.uniform1i(P.comp.u.uScene, 0); gl.uniform1i(P.comp.u.uHal, 1); gl.uniform1i(P.comp.u.uAtm, 2);

  const empty = gl.createVertexArray();
  // Instanced quads: a unit corner strip plus per-peg attributes.
  const quadVao = gl.createVertexArray(), cornerBuf = gl.createBuffer(), instBuf = gl.createBuffer();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const attr = (name, size, stride, offset, divisor) => {
    const loc = gl.getAttribLocation(P.quad.p, name);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset); gl.vertexAttribDivisor(loc, divisor);
  };
  attr('aCorner', 2, 0, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  attr('aPeg', 4, 32, 0, 1); attr('aState', 4, 32, 16, 1);
  gl.bindVertexArray(null);

  function texture(w, h, internal, format, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h) {
    const tex = texture(w, h, gl.RGBA16F, gl.RGBA, gl.LINEAR), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) throw new Error('RGBA16F framebuffer incomplete');
    return {w, h, tex, fb};
  }
  const free = t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };

  // Framebuffers: the HDR scene at full size, then mip levels 1..K (halving)
  // with up-sample targets for the halation (UH) and atmosphere (UA) chains.
  let scene = null, M = [], UH = [], UA = [];
  function resize(w, h) {
    css = [w, h]; scale = pixelRatio * quality.renderScale;
    const W = Math.max(1, Math.round(w * scale)), Hh = Math.max(1, Math.round(h * scale));
    canvas.width = W; canvas.height = Hh;
    [scene, ...M, ...UH, ...UA].forEach(free);
    scene = target(W, Hh); M = []; UH = []; UA = [];
    for (let k = 1; k <= 10 && Math.min(W, Hh) >> k >= 2; k++) {
      const lw = Math.max(1, W >> k), lh = Math.max(1, Hh >> k);
      M[k] = target(lw, lh);
      if (k < 10) { UH[k] = target(lw, lh); if (k >= 3) UA[k] = target(lw, lh); }   // the atmosphere starts at 1/8
    }
  }

  // Peg state, packed and uploaded by the band of rows that changed. The state
  // texel's 4th channel is tone + 8 when any peg in its 3×3 neighbourhood is lit,
  // so the shader can skip the gather for the (usually many) empty cells.
  let grid = [0, 0], stateTex = null, offsTex = null, st = null, pk = null, of = null, lit = null, inst = new Float32Array(0);
  function upload(b) {
    const {cols, rows} = b, n = cols * rows;
    if (cols !== grid[0] || rows !== grid[1]) {
      if (stateTex) { gl.deleteTexture(stateTex); gl.deleteTexture(offsTex); }
      stateTex = texture(cols, rows, gl.RGBA16F, gl.RGBA, gl.NEAREST); offsTex = texture(cols, rows, gl.RG16F, gl.RG, gl.NEAREST);
      st = new Float32Array(n * 4).fill(NaN); pk = new Float32Array(n * 4); of = new Float32Array(n * 2).fill(NaN);
      lit = new Uint8Array(n); grid = [cols, rows];
    }
    let nq = 0, first = rows, last = -1;
    const quadsFrom = (B, all) => {
      for (let i = 0, m = B.cols * B.rows; i < m; i++) {
        const I = B.I[i]; if (I < .02) continue;
        const dx = B.dx[i], dy = B.dy[i];
        if (!all && Math.abs(dx) <= OFF_GATHER && Math.abs(dy) <= OFF_GATHER) continue;
        if ((nq + 1) * 8 > inst.length) { const g = new Float32Array(Math.max(64, inst.length * 2)); g.set(inst); inst = g; }
        const x = i % B.cols, o = nq++ * 8;
        inst[o] = x; inst[o + 1] = (i - x) / B.cols; inst[o + 2] = dx; inst[o + 3] = dy;
        inst[o + 4] = I; inst[o + 5] = B.white[i]; inst[o + 6] = B.size[i]; inst[o + 7] = B.tone[i];
      }
    };
    for (let y = 0; y < rows; y++) {
      let dirty = false;
      for (let i = y * cols, e = i + cols; i < e; i++) {
        let I = b.I[i];
        const dx = b.dx[i], dy = b.dy[i];
        if (Math.abs(dx) > OFF_GATHER || Math.abs(dy) > OFF_GATHER) I = 0;   // drawn as a quad; its socket shows empty
        const a = i * 4, c = i * 2, w = b.white[i], s = b.size[i], t = b.tone[i];
        if (st[a] !== I || st[a + 1] !== w || st[a + 2] !== s || st[a + 3] !== t || of[c] !== dx || of[c + 1] !== dy) {
          st[a] = I; st[a + 1] = w; st[a + 2] = s; st[a + 3] = t; of[c] = dx; of[c + 1] = dy; lit[i] = I >= .02 ? 1 : 0; dirty = true;
        }
      }
      if (dirty) { if (y < first) first = y; last = y; }
    }
    quadsFrom(b, false);
    if (last < 0) return {quadsFrom, count:() => nq, uploadedRows:0};
    // The neighbourhood flag reaches one row past the change on either side.
    const lo = Math.max(0, first - 1), hi = Math.min(rows, last + 2);
    for (let y = lo; y < hi; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, a = i * 4;
      let near = 0;
      for (let j = Math.max(0, y - 1); j <= Math.min(rows - 1, y + 1) && !near; j++)
        for (let k = Math.max(0, x - 1); k <= Math.min(cols - 1, x + 1); k++) if (lit[j * cols + k]) { near = 8; break; }
      pk[a] = st[a]; pk[a + 1] = st[a + 1]; pk[a + 2] = st[a + 2]; pk[a + 3] = st[a + 3] + near;
    }
    gl.bindTexture(gl.TEXTURE_2D, stateTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, lo, cols, hi - lo, gl.RGBA, gl.FLOAT, pk, lo * cols * 4);
    gl.bindTexture(gl.TEXTURE_2D, offsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, lo, cols, hi - lo, gl.RG, gl.FLOAT, of, lo * cols * 2);
    return {quadsFrom, count:() => nq, uploadedRows:hi - lo};
  }

  const pass = (prog, dst, src, texel, off) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(prog.u.uSrc, 0); gl.uniform2f(prog.u.uTexel, 1 / texel.w, 1 / texel.h);
    if (prog.u.uOff) gl.uniform1f(prog.u.uOff, off);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  // n downs from level `from` already exist; run n ups back to `from` into U.
  function upChain(from, plan, U) {
    let src = M[from + plan.n];
    for (let k = from + plan.n - 1; k >= from; k--) { pass(P.up, U[k], src, src, plan.o); src = U[k]; }
    return src;
  }

  let stats = {quads:0, uploadedRows:0, halation:null, atmosphere:null};
  function draw(b, {pitch, x = 0, y = 0, time = 0, kick = 0, add = []} = {}) {
    if (gl.isContextLost()) return;
    if (!scene) resize(...css);
    const W = canvas.width, Hc = canvas.height, Pp = pitch * scale, ox = x * scale, oy = y * scale;
    const up = upload(b);
    for (const a of add) up.quadsFrom(a, true);
    gl.bindVertexArray(empty);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);

    // 1. The board, in linear light, into the HDR scene.
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb); gl.viewport(0, 0, W, Hc);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const x0 = Math.max(0, Math.floor(ox)), x1 = Math.min(W, Math.ceil(ox + b.cols * Pp));
    const y0 = Math.max(0, Math.floor(oy)), y1 = Math.min(Hc, Math.ceil(oy + b.rows * Pp));
    if (x1 <= x0 || y1 <= y0) return composite(b, W, Hc, ox, oy, Pp, 0, 0, null, null);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, Hc - y1, x1 - x0, y1 - y0);
    const S = P.scene; gl.useProgram(S.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stateTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, offsTex);
    gl.uniform2i(S.u.uGrid, b.cols, b.rows); gl.uniform2f(S.u.uOrigin, ox, oy);
    gl.uniform1f(S.u.uP, Pp); gl.uniform1f(S.u.uH, Hc); gl.uniform1f(S.u.uPx, 1 / Pp); gl.uniform1f(S.u.uTime, time);
    gl.uniform1f(S.u.uSockets, Math.max(0, b.sockets)); gl.uniform1f(S.u.uExposure, Math.max(0, b.exposure));
    gl.uniform1i(S.u.uShade, quality.socketShading ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Pegs out of their sockets, added on top.
    const nq = up.count();
    if (nq) {
      const Q = P.quad; gl.useProgram(Q.p);
      gl.bindVertexArray(quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.subarray(0, nq * 8), gl.STREAM_DRAW);
      gl.uniform2f(Q.u.uOrigin, ox, oy); gl.uniform2f(Q.u.uCanvas, W, Hc); gl.uniform1f(Q.u.uP, Pp);
      gl.uniform1f(Q.u.uExt, QUAD); gl.uniform1f(Q.u.uPx, 1 / Pp); gl.uniform1f(Q.u.uTime, time);
      gl.uniform1f(Q.u.uExposure, Math.max(0, b.exposure));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nq);
      gl.disable(gl.BLEND); gl.bindVertexArray(empty);
    }
    gl.disable(gl.SCISSOR_TEST);

    // 3. Bloom: bright pass at 1/2, Kawase downs, then the two up chains.
    let hal = null, atm = null, wH = 0, wA = 0;
    const K = M.length - 1, mul = Math.max(0, b.bloom);
    stats.halation = stats.atmosphere = null;
    if (quality.bloom > 0 && K >= 1 && mul > 0) {
      const ph = kawasePlan(BLOOM.halation.radius * Pp * mul / 2, K - 1);
      const pa = quality.bloom > 1 && K >= 3 ? kawasePlan(BLOOM.atmosphere.radius * Pp * mul / 8, K - 3) : null;
      gl.useProgram(P.bright.p);
      gl.uniform1f(P.bright.u.uT, BLOOM.threshold); gl.uniform1f(P.bright.u.uK, BLOOM.knee);
      pass(P.bright, M[1], scene, scene, 1);
      for (let k = 2, deep = Math.max(1 + ph.n, pa ? 3 + pa.n : 0); k <= deep; k++) pass(P.down, M[k], M[k - 1], M[k - 1], 1);
      hal = upChain(1, ph, UH); wH = BLOOM.halation.weight;
      if (pa) { atm = upChain(3, pa, UA); wA = BLOOM.atmosphere.weight + BLOOM.atmosphere.kick * Math.max(0, kick); }
      stats.halation = {...ph, px:ph.sigma * 2}; stats.atmosphere = pa && {...pa, px:pa.sigma * 8};
    }
    stats.quads = nq; stats.uploadedRows = up.uploadedRows;
    composite(b, W, Hc, ox, oy, Pp, wH, wA, hal, atm);
  }

  // 4. To the canvas.
  function composite(b, W, Hc, ox, oy, Pp, wH, wA, hal, atm) {
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hc);
    const C = P.comp; gl.useProgram(C.p); gl.bindVertexArray(empty);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (hal || scene).tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, (atm || scene).tex);
    gl.uniform1f(C.u.uWH, wH); gl.uniform1f(C.u.uWA, wA); gl.uniform1f(C.u.uH, Hc);
    gl.uniform4f(C.u.uRect, ox, oy, ox + b.cols * Pp, oy + b.rows * Pp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // The canvas as RGBA rows, top row first. Call right after draw (or create with preserveDrawingBuffer).
  function read() {
    const W = canvas.width, Hc = canvas.height, raw = new Uint8Array(W * Hc * 4), out = new Uint8Array(W * Hc * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, Hc, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    for (let y = 0; y < Hc; y++) out.set(raw.subarray((Hc - 1 - y) * W * 4, (Hc - y) * W * 4), y * W * 4);
    return {width:W, height:Hc, data:out};
  }

  return {
    kind:'webgl2', canvas, gl,
    resize, draw, read,
    setQuality(q) { Object.assign(quality, q); resize(...css); },
    get quality() { return {...quality}; },
    setPixelRatio(r) { pixelRatio = r; resize(...css); },
    get stats() { return {...stats}; },
    dispose() {
      if (!gl.isContextLost()) {
        [scene, ...M, ...UH, ...UA].forEach(free);
        if (stateTex) { gl.deleteTexture(stateTex); gl.deleteTexture(offsTex); }
        Object.values(P).forEach(p => gl.deleteProgram(p.p));
        gl.deleteBuffer(cornerBuf); gl.deleteBuffer(instBuf); gl.deleteVertexArray(quadVao); gl.deleteVertexArray(empty);
      }
      scene = null; M = UH = UA = [];
    },
  };
}
