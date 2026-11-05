// GLSL for the compositor (gl/compositor.js). Conventions, everywhere:
//   output px   the film frame (1080×1920 for 9:16), origin top left, y down
//   device px   output px × render scale, origin top left (gl_FragCoord is flipped once, here)
//   textures    images (video, bitmaps, canvases) are uploaded top row first, so v = y / h;
//               framebuffer textures hold row 0 at the bottom, so they sample with uFlip = 1
// Every shader is a pure function of its uniforms and the pixel: no clock, no history.

export const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
`;

// A quad over a rect in device px (top-left origin), as a 4-vertex triangle strip.
export const RECT_VS = HEAD + `
uniform vec4 uRect; uniform vec2 uTarget;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)), p = uRect.xy + c * uRect.zw;
  gl_Position = vec4(p.x / uTarget.x * 2. - 1., 1. - p.y / uTarget.y * 2., 0., 1.);
}`;

export const FULL_VS = HEAD + `
out vec2 vUv;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

const HASH = `
uint hsh(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float hash3(uvec3 v) { return float(hsh(v.x * 0x9e3779b1u ^ hsh(v.y * 0x85ebca77u ^ hsh(v.z + 0x27d4eb2fu))) >> 8u) / 16777216.; }
`;

// ---- the uber layer shader -------------------------------------------------------------------
// One layer of the frame program: its picture through the 3×3 matrix (output px -> source px),
// every effect of the EDL vocabulary, the cell's rounded-rect mask, the iris and the opacity.
// Out: premultiplied colour, blended ONE, ONE_MINUS_SRC_ALPHA (or MAX for the board over footage).
//
// Order: warps in cell space (tile, fold, radial fold, mosaic, scanline wobble; the breathing mosaic
// samples two nested grids through them), then the matrix, then the sampling effects (zoom blur or
// directional blur, each tap RGB-split and chroma-drifted), then colour (saturation, chroma drop, the
// palette wash, scanline darkening), then peg video and the peg bloom, then the masks.
export const LAYER_FS = HEAD + HASH + `
uniform vec2 uTarget; uniform float uScale;
uniform vec4 uCell; uniform float uRadius;
uniform mat3 uM; uniform vec2 uSrcSize; uniform vec4 uBounds;
uniform sampler2D uTex; uniform int uKind; uniform int uFlip; uniform vec4 uColor;
uniform float uOpacity, uTime; uniform uint uSeed;
uniform vec4 uTile; uniform int uFold; uniform float uMosaic; uniform vec3 uScan;
uniform vec3 uRadial; uniform vec2 uDir; uniform vec2 uRgb;
uniform float uSat, uChroma; uniform vec4 uPeg; uniform vec4 uIris;
uniform vec3 uBreathe; uniform vec2 uWash; uniform vec4 uRadialFold; uniform vec4 uBloomPeg; uniform float uBloomReach; uniform vec3 uDrift;
out vec4 o;

const vec3 LUMA = vec3(.2126, .7152, .0722);
float rrect(vec2 q, vec2 size, float r) {
  vec2 h = size * .5, d = abs(q - h) - (h - vec2(r));
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r;
}

// The source at output px p, premultiplied (transparent outside the picture).
vec4 tap(vec2 p) {
  if (uKind == 1) return uColor;
  if (uKind == 2) {                                  // camera off: the meeting room's radial tile
    vec2 q = (p - uCell.xy) / uCell.zw - .5;
    return vec4(mix(vec3(.145, .153, .180), vec3(.106, .110, .129), smoothstep(0., .75, length(q * vec2(1., uCell.w / uCell.z)) * 1.2)), 1.);
  }
  vec3 s = uM * vec3(p, 1.);
  if (s.x < uBounds.x || s.y < uBounds.y || s.x > uBounds.z || s.y > uBounds.w) return vec4(0.);
  vec2 uv = s.xy / uSrcSize;
  if (uFlip == 1) uv.y = 1. - uv.y;
  return texture(uTex, uv);
}
vec4 tapSplit(vec2 p, vec2 d) {
  // rgbSplit: red moves +d on screen, blue -d. chromaDrift: each channel orbits, 120 degrees apart
  // (green at half), plus a radial split from the cell centre (red outwards, blue inwards).
  vec2 dr = d, dg = vec2(0.), db = -d;
  if (uDrift.x > 0. || uDrift.z > 0.) {
    float a = uDrift.y;
    dr += uDrift.x * vec2(cos(a), sin(a)); dg += .5 * uDrift.x * vec2(cos(a + 2.0943951), sin(a + 2.0943951)); db += uDrift.x * vec2(cos(a + 4.1887902), sin(a + 4.1887902));
    vec2 rr = (p - uCell.xy - .5 * uCell.zw) / (.5 * length(uCell.zw));
    dr += uDrift.z * rr; db -= uDrift.z * rr;
  }
  if (dr == vec2(0.) && dg == vec2(0.) && db == vec2(0.)) return tap(p);
  vec4 r = tap(p - dr), g = tap(p - dg), b = tap(p - db);
  return vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}
// Sampling effects at output px p: 16 taps, h places them within their sixteenths.
vec4 sampleAt(vec2 p, float h) {
  vec2 d = uRgb.x > 0. ? uRgb.x * vec2(cos(uRgb.y), sin(uRgb.y)) : vec2(0.);
  if (uRadial.x > 0.) {
    vec2 c = uCell.xy + uRadial.yz * uCell.zw; vec4 acc = vec4(0.);
    for (int k = 0; k < 16; k++) acc += tapSplit(mix(p, c, uRadial.x * (float(k) + h) / 16.), d);
    return acc / 16.;
  }
  if (uDir.x > 0.) {
    vec2 dir = vec2(cos(uDir.y), sin(uDir.y)) * uDir.x; vec4 acc = vec4(0.);
    for (int k = 0; k < 16; k++) acc += tapSplit(p + dir * ((float(k) + h) / 16. - .5), d);
    return acc / 16.;
  }
  return tapSplit(p, d);
}
// Cell-space warps: where in the cell this pixel takes its picture from.
vec2 warp(vec2 q) {
  if (uTile.w > 0.) {
    vec2 g = q / uCell.zw * uTile.xy, i = floor(g), f = fract(g);
    if (uTile.z > .5) { if (mod(i.x, 2.) >= 1.) f.x = 1. - f.x; if (mod(i.y, 2.) >= 1.) f.y = 1. - f.y; }
    q = f * uCell.zw;
  }
  if ((uFold & 1) != 0 && q.x > uCell.z * .5) q.x = uCell.z - q.x;
  if ((uFold & 2) != 0 && q.y > uCell.w * .5) q.y = uCell.w - q.y;
  if (uRadialFold.x >= 2.) {
    // A kaleidoscope: every wedge about the centre shows the first, alternate ones mirrored; a point
    // the turn carries out of the cell reflects back in at its edge, so there are no holes.
    vec2 c = uRadialFold.zw * uCell.zw, d = q - c;
    float w = 6.28318531 / uRadialFold.x, a = mod(atan(d.y, d.x) - uRadialFold.y, w);
    if (a > .5 * w) a = w - a;
    a += uRadialFold.y;
    q = c + length(d) * vec2(cos(a), sin(a));
    q = uCell.zw - abs(mod(q, 2. * uCell.zw) - uCell.zw);
  }
  if (uMosaic > 1.) q = (floor(q / uMosaic) + .5) * uMosaic;
  if (uScan.y > 0.) { float line = floor(q.y / max(uScan.z, 1.)); q.x += uScan.y * sin(line * 2.39996 + uTime * 37.7) * (.6 + .4 * hash3(uvec3(uint(line), uSeed, 7u))); }
  return q;
}
// The palette wash: luma onto a Peg Board duotone, luma kept (the tint is a zero-luma chroma vector,
// strongest in the shadows, gone at black and white). hue 0 blue (#2B78FF), 1 violet (#8C52FF),
// 2 warm (coral, #FF7366); fractional drifts between them, never through green.
vec3 washOf(vec3 rgb, float hue) {
  const vec3 B = vec3(.169, .471, 1.), V = vec3(.549, .322, 1.), W = vec3(1., .451, .4);
  vec3 cb = B - dot(B, LUMA), cv = V - dot(V, LUMA), cw = W - dot(W, LUMA);
  vec3 ch = mix(mix(cb, cv, clamp(hue, 0., 1.)), cw, clamp(hue - 1., 0., 1.));
  float l = dot(rgb, LUMA), k = smoothstep(0., .1, l) * (1. - smoothstep(.9, 1., l));
  return clamp(vec3(l) + ch * (1.1 - .6 * l) * k, 0., 1.);
}
// The picture at cell-local q (before warps), as straight colour + alpha.
vec4 pictureAt(vec2 q, float h) {
  vec4 c;
  if (uBreathe.x > 1.) {
    // A breathing mosaic: blocks of px from (cx, cy), the two nested grids an octave apart
    // crossfaded by where px sits between them, so a block size that follows the voices never steps.
    float L = log2(uBreathe.x), s0 = exp2(floor(L)), s1 = 2. * s0, w = smoothstep(0., 1., fract(L));
    vec2 o = uBreathe.yz * uCell.zw;
    vec2 q0 = clamp(o + (floor((q - o) / s0) + .5) * s0, vec2(.5), uCell.zw - .5), q1 = clamp(o + (floor((q - o) / s1) + .5) * s1, vec2(.5), uCell.zw - .5);
    c = mix(sampleAt(uCell.xy + warp(q0), h), sampleAt(uCell.xy + warp(q1), h), w);
  } else c = sampleAt(uCell.xy + warp(q), h);
  vec3 rgb = c.a > 1e-4 ? c.rgb / c.a : vec3(0.);
  float l = dot(rgb, LUMA);
  rgb = mix(vec3(l), rgb, uSat);
  rgb = mix(rgb, vec3(l), uChroma);
  if (uWash.x > 0.) rgb = mix(rgb, washOf(rgb, uWash.y), uWash.x);
  return vec4(rgb, c.a);
}

void main() {
  vec2 dev = vec2(gl_FragCoord.x, uTarget.y - gl_FragCoord.y), p = dev / uScale, q = p - uCell.xy;
  float mask = clamp(.5 - rrect(q, uCell.zw, uRadius) * uScale, 0., 1.);
  if (uIris.x >= 0.) {
    float R = uIris.x * .5 * length(uCell.zw), d = length(q - uIris.yz * uCell.zw), f = max(uIris.w, 1. / uScale);
    mask *= clamp((R - d) / f + .5, 0., 1.);
  }
  mask *= uOpacity;
  if (mask <= 0.) discard;
  vec4 c = pictureAt(q, .5);
  if (uScan.x > 0.) { float ph = fract(q.y / max(uScan.z, 1.)), e = .5 / (max(uScan.z, 1.) * uScale); c.rgb *= 1. - uScan.x * smoothstep(.5 - e, .5 + e, ph); }
  float pegMix = uPeg.x;
  if (uBloomPeg.x > 0.) {
    // Pegs bloom out of (cx, cy): peg cells nearer than the front are pegs, the cells in the front
    // (band) are pixel blocks a peg wide, the rest stays footage. amount 1 reaches the farthest corner
    // of the cell, or uBloomReach output px (a bloom centred on the frame: one circle across the call).
    float P = max(uPeg.y, 2.); vec2 cc = (floor(q / P) + .5) * P, o = uBloomPeg.yz * uCell.zw;
    float reach = uBloomReach > 0. ? uBloomReach : length(max(abs(o), abs(uCell.zw - o))), d = length(cc - o) / max(reach, 1.), r = uBloomPeg.x * (1. + uBloomPeg.w);
    if (d < r - uBloomPeg.w) pegMix = 1.;
    else if (d < r) c = pictureAt(clamp(cc, vec2(.5), uCell.zw - .5), .5);
  }
  if (pegMix > 0.) {
    // Peg video: the cell becomes a board. Luma^gamma in 'levels' blue steps, one peg per pitch,
    // pegs on the cell's own grid; a dark peg leaves its socket showing.
    float P = max(uPeg.y, 2.); vec2 ci = floor(q / P), cc = (ci + .5) * P;
    float L = 0., A = 0.;
    for (int k = 0; k < 4; k++) { vec2 off = (vec2(float(k & 1), float(k >> 1)) - .5) * .5 * P; vec4 s = pictureAt(cc + off, .5); L += dot(s.rgb, LUMA) * s.a; A += s.a; }
    L = pow(clamp(L / 4., 0., 1.), uPeg.w);
    float lev = floor(L * uPeg.z + .5) / uPeg.z;
    vec2 dd = (q - cc) / P; float r = length(dd), px = 1. / (P * uScale);
    float body = smoothstep(.36 + px, .34 - px, r);
    vec3 ring = vec3(.169, .471, 1.), core = vec3(.867, .922, 1.), glow = vec3(.09, .278, 1.);
    vec3 peg = (ring * (.78 + .22 * clamp(1. - r / .35, 0., 1.)) * lev + core * pow(lev, 1.6) * exp(-r * r / .014)) * body
             + glow * (lev * .42 * exp(-max(r - .33, 0.) / .09));
    vec3 sock = vec3(.082, .094, .122) * smoothstep(.31 + px, .28 - px, r) * (1. - step(.001, lev) * body);
    vec3 pv = min(peg + sock, vec3(1.));
    c = vec4(mix(c.rgb, pv, pegMix), mix(c.a, 1., pegMix * step(.001, A)));
  }
  o = vec4(c.rgb * c.a, c.a) * mask;
}`;

// ---- chrome: rounded rects, strokes and atlas glyphs, one instance each --------------------------
// aRect: x, y, w, h (output px)   aColor: premultiplied rgba   aUv: atlas u0, v0, u1, v1 (or -1)
// aClip: the tile it lives in (x, y, w, h)   aShape: radius, mode (0 fill, 1 glyph, 2 stroke), stroke, clip radius
export const CHROME_VS = HEAD + `
in vec4 aRect, aColor, aUv, aClip, aShape;
uniform vec2 uTarget; uniform float uScale;
out vec2 vP; flat out vec4 vRect, vColor, vUv, vClip, vShape;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 p = (aRect.xy + c * aRect.zw) * uScale;
  vP = (aRect.xy + c * aRect.zw); vRect = aRect; vColor = aColor; vUv = aUv; vClip = aClip; vShape = aShape;
  gl_Position = vec4(p.x / uTarget.x * 2. - 1., 1. - p.y / uTarget.y * 2., 0., 1.);
}`;
export const CHROME_FS = HEAD + `
uniform sampler2D uAtlas; uniform vec2 uAtlasSize; uniform float uScale;
in vec2 vP; flat in vec4 vRect, vColor, vUv, vClip, vShape;
out vec4 o;
float rrect(vec2 q, vec2 size, float r) { vec2 h = size * .5, d = abs(q - h) - (h - vec2(r)); return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
void main() {
  float clip = clamp(.5 - rrect(vP - vClip.xy, vClip.zw, vShape.w) * uScale, 0., 1.);
  float a;
  int mode = int(vShape.y + .5);
  if (mode == 1) {
    vec2 f = (vP - vRect.xy) / vRect.zw, uv = mix(vUv.xy, vUv.zw, f);
    a = texture(uAtlas, uv / uAtlasSize).a;
  } else {
    float sd = rrect(vP - vRect.xy, vRect.zw, vShape.x) * uScale;
    a = clamp(.5 - sd, 0., 1.);
    if (mode == 2) a *= clamp(.5 + sd + vShape.z * uScale, 0., 1.);
  }
  a *= clip;
  if (a <= 0.) discard;
  o = vColor * a;
}`;

// ---- Synergy's mouth row ----------------------------------------------------------------------------
// The meeting room's drawRobotMouth (src/meeting-room/Participant.jsx), as 22 instanced bars:
// rgba(74, 255, 112, strength) over the clean plate with the canvas's shadowBlur 2 (a Gaussian
// of sigma 1 source px under each bar). Each bar is 3.2 × 6 units, 4.3 apart from x −46, at
// the tracked point, rotated with the head, scaled by the track's scale (uS: output px per
// unit; uPx: output px per source px). strength = level > .08 ? max(.16, (1 − d/7)·level) : .11,
// d = (phase − i) mod 22, phase = (t·15) mod 22: speech runs a bright wave along the row; at
// rest it glows at .11. Masked like the layer it belongs to (cell, iris, opacity, saturation).
export const MOUTH_VS = HEAD + `
uniform vec2 uTarget; uniform float uScale;
uniform vec2 uC; uniform float uAng, uS, uPx, uLevel, uPhase;
out vec2 vL, vP; flat out float vA;
void main() {
  int i = gl_InstanceID;
  float d = mod(uPhase - float(i) + 22., 22.);
  vA = uLevel > .08 ? max(.16, (1. - d / 7.) * uLevel) : .11;
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  float m = 3.5 * uPx / uS + 1. / (uS * uScale), x0 = -46. + float(i) * 4.3;
  vec2 l = mix(vec2(x0 - m, -3. - m), vec2(x0 + 3.2 + m, 3. + m), c);
  vL = (l - vec2(x0 + 1.6, 0.)) * uS;
  vec2 r = vec2(cos(uAng) * l.x - sin(uAng) * l.y, sin(uAng) * l.x + cos(uAng) * l.y) * uS;
  vP = uC + r;
  vec2 p = vP * uScale;
  gl_Position = vec4(p.x / uTarget.x * 2. - 1., 1. - p.y / uTarget.y * 2., 0., 1.);
}`;
export const MOUTH_FS = HEAD + `
uniform float uScale, uS, uPx, uOpacity, uRadius, uSat, uChroma; uniform vec4 uCell, uIris;
in vec2 vL, vP; flat in float vA;
out vec4 o;
float rrect(vec2 q, vec2 size, float r) { vec2 h = size * .5, d = abs(q - h) - (h - vec2(r)); return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
float erf1(float x) { float t = x * x, a = .147; return sign(x) * sqrt(1. - exp(-t * (1.2732395 + a * t) / (1. + a * t))); }
void main() {
  vec2 h = vec2(1.6, 3.) * uS, d = abs(vL) - h;
  float shape = clamp(.5 - (length(max(d, 0.)) + min(max(d.x, d.y), 0.)) * uScale, 0., 1.);
  float sg = max(uPx, .5 / uScale) * 1.41421356;
  vec2 a = (h - vL) / sg, b = (-h - vL) / sg;
  float blur = .25 * (erf1(a.x) - erf1(b.x)) * (erf1(a.y) - erf1(b.y));
  float as = vA * shape, alpha = as + vA * blur * (1. - as);
  vec2 q = vP - uCell.xy;
  float mask = clamp(.5 - rrect(q, uCell.zw, uRadius) * uScale, 0., 1.);
  if (uIris.x >= 0.) {
    float R = uIris.x * .5 * length(uCell.zw), e = length(q - uIris.yz * uCell.zw), f = max(uIris.w, 1. / uScale);
    mask *= clamp((R - e) / f + .5, 0., 1.);
  }
  alpha *= mask * uOpacity;
  if (alpha <= 0.) discard;
  vec3 g = vec3(74., 255., 112.) / 255.;
  float l = dot(g, vec3(.2126, .7152, .0722));
  g = mix(mix(vec3(l), g, uSat), vec3(l), uChroma);
  o = vec4(g * alpha, alpha);
}`;

// ---- copies and the post chain ---------------------------------------------------------------------
export const COPY_FS = HEAD + `
uniform sampler2D uSrc; out vec4 o;
void main() { o = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }`;

// Bloom source at half resolution: a 4-tap tent with a soft knee on the hottest channel.
export const BRIGHT_FS = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uT, uK;
in vec2 vUv; out vec4 o;
vec3 tap(vec2 uv) {
  vec3 c = texture(uSrc, uv).rgb; float b = max(c.r, max(c.g, c.b)), s = clamp(b - uT + uK, 0., 2. * uK);
  return c * max(s * s / (4. * uK + 1e-5), b - uT) / max(b, 1e-5);
}
void main() { o = vec4((tap(vUv + uTexel) + tap(vUv - uTexel) + tap(vUv + vec2(uTexel.x, -uTexel.y)) + tap(vUv - vec2(uTexel.x, -uTexel.y))) * .25, 1.); }`;
export const DOWN_FS = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
void main() { vec2 d = uTexel; o = (4. * texture(uSrc, vUv) + texture(uSrc, vUv + d) + texture(uSrc, vUv - d) + texture(uSrc, vUv + vec2(d.x, -d.y)) + texture(uSrc, vUv - vec2(d.x, -d.y))) / 8.; }`;
export const UP_FS = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
void main() {
  vec2 d = uTexel, h = .5 * d;
  o = (texture(uSrc, vUv + vec2(-d.x, 0.)) + texture(uSrc, vUv + vec2(d.x, 0.)) + texture(uSrc, vUv + vec2(0., -d.y)) + texture(uSrc, vUv + vec2(0., d.y))
     + 2. * (texture(uSrc, vUv + h) + texture(uSrc, vUv - h) + texture(uSrc, vUv + vec2(h.x, -h.y)) + texture(uSrc, vUv - vec2(h.x, -h.y)))) / 12.;
}`;
// The last pass: bloom added, the governor's gain, grain weighted to the mid-tones (seeded
// by the frame number), then ±.5 LSB triangular dither. Opaque.
export const FINAL_FS = HEAD + HASH + `
uniform sampler2D uSrc, uBloom; uniform float uBloomW, uGain, uGrain, uDither; uniform uint uSeed;
in vec2 vUv; out vec4 o;
void main() {
  vec3 c = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0).rgb;
  if (uBloomW > 0.) c += uBloomW * texture(uBloom, vUv).rgb;
  c *= uGain;
  // True black stays 0: grain and dither never lift a pixel nothing lit (the choke, the tape stop's tail).
  bool black = max(c.r, max(c.g, c.b)) <= 0.;
  uvec3 k = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uSeed);
  if (uGrain > 0.) { float l = dot(clamp(c, 0., 1.), vec3(.2126, .7152, .0722)); c += (hash3(k) + hash3(k + uvec3(0u, 0u, 7919u)) - 1.) * uGrain * (.35 + 2.6 * l * (1. - l)); }
  if (uDither > 0.) c += (hash3(k + uvec3(0u, 0u, 104729u)) + hash3(k + uvec3(0u, 0u, 1299709u)) - 1.) * (.5 / 255.);
  o = vec4(black ? vec3(0.) : clamp(c, 0., 1.), 1.);
}`;
