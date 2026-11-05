// The Peg Board's state: one entry per peg, plain typed arrays. Choreography
// writes it, renderers read it. A board has one pitch per shot; pegs are never
// resampled, type sizes are whole multiples, and an empty socket stays visible.

// Colour of a peg's light. Ring / hot core / glow, from the rendering spec.
// Type is never green: green belongs to Synergy's face.
export const PALETTE = {
  blue:  {id:0, ring:'#2B78FF', core:'#DDEBFF', glow:'#1747FF'},
  white: {id:1, ring:'#F5F8FF', core:'#FFFFFF', glow:'#A9C4FF'},
  signal:{id:2, ring:'#FFE14D', core:'#FFF8D6', glow:'#FFB800'},   // the hook's one accent word
  deep:  {id:3, ring:'#1B3CFF', core:'#9DB6FF', glow:'#0A1FD0'},   // slow-mo, k >= 2 only
};
export const TONES = Object.values(PALETTE).sort((a, b) => a.id - b.id);
// An unlit socket: a dark hole with a lighter lower-right lip on a black board.
// Kept at #15 or brighter: H.264 crushes anything under 16/255 to black.
export const SOCKET = {hole:'#15181F', lip:'#232833', board:'#000000'};

export function createBoard(cols, rows) {
  const n = cols * rows;
  return {
    cols, rows,
    I:new Float32Array(n),            // intensity 0..2; above 1 is overdrive (burns toward white)
    white:new Float32Array(n),        // 0..1: mix of the peg's tone toward white-hot
    tone:new Uint8Array(n),           // TONES index
    size:new Float32Array(n).fill(1), // peg radius multiplier (pop springs to 1.25)
    dx:new Float32Array(n),           // offset from the socket, in pitch units (detune, rain)
    dy:new Float32Array(n),
    sockets:1,                        // 0..1: how visible the empty sockets are (board power)
    exposure:1,                       // whole-board gain (kick lift, breakdown dim)
    bloom:1,                          // bloom radius multiplier (slow-mo 1.6)
    ambient:1,                        // 0..1: gain on light that is not type (choreo.paint: the build's dim under a held screen)
  };
}

export function clearBoard(b) {
  b.I.fill(0); b.white.fill(0); b.tone.fill(0); b.size.fill(1); b.dx.fill(0); b.dy.fill(0);
  b.sockets = 1; b.exposure = 1; b.bloom = 1; b.ambient = 1;
  return b;
}

export const index = (b, x, y) => y * b.cols + x;

// Light one peg, keeping the brightest value where layers overlap.
export function light(b, x, y, I, {tone = 0, white = 0, size = 1, dx = 0, dy = 0} = {}) {
  if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) return;
  const i = y * b.cols + x;
  if (I < b.I[i]) return;
  b.I[i] = I; b.tone[i] = tone; b.white[i] = white; b.size[i] = size; b.dx[i] = dx; b.dy[i] = dy;
}

// Board geometry for a frame: how many pegs fit at pitch P inside a W×H area.
export function gridFor(width, height, pitch) {
  return {cols:Math.floor(width / pitch), rows:Math.floor(height / pitch), pitch};
}

// The contract every renderer (renderer-gl.js, renderer-2d.js) implements:
//   const r = createRenderer(canvas, {pixelRatio});
//   r.kind                      'webgl2' | '2d'
//   r.resize(cssWidth, cssHeight)
//   r.draw(board, {pitch, x, y, time})   board's top-left at (x, y) CSS px; black elsewhere
//   r.dispose()
// Pure function of (board, options): the same inputs draw the same pixels.
