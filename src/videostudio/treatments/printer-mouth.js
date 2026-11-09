// "Printer Song", the printer's music video (Aaron: "can we see a suuuupper weird music video 30s of the
// printer singing?"). The printer's face is built from one take, stacked down the 9:16 frame like a
// totem: its two amber status LEDs are the eyes (in big pixel blocks), its paper slot is the mouth (with
// the call's own name bar, "Printer · Deliverables", its speaking border lit while it sings), the Peg
// Board home is its display, and its output tray is the body, in pegs. The mouth sings the song's glides:
// the page comes out of the slot as the pitch rises and is swallowed back as it falls.
//
//   const plan = printerPlan();                                   // treatments/printer-song.js
//   const edl = printerMouth(plan, SHOTS, {format:'9:16'});
//   compile(edl, {plan, shots:SHOTS}).lint.errors                 // []
//
// It opens on a loading screen (Aaron's note): the whole frame is the Peg Board, a file loads in pegs,
// Synergy says "Loading." and the board lights LOADING.; at 100 % the screen folds into the printer's
// display and the face appears around it, on the first frame of the song. After loading, the printer
// dreams (Aaron's note): between its gestures it drifts off (the face floats, its lids droop, little
// stars turn in pegs over it, the colour drifts) and every glide wakes it to sing.
//
// The rule it breaks on purpose (overrides, rule G7): the shot index says printer pages never reverse
// (R0, "freeze instead"). Here they do, on purpose and in this film only: the paper slot is a mouth,
// and a mouth that cannot close cannot sing. Every mouth clip carries the waiver and says why.
// The scenes start on the song's gestures, not on bar lines (G4, waived with a note): the track has no
// audible downbeat.
//
// Written in song frames (the 30.5 s edit Aaron saw; printer-song.js): film frame = song frame + 72. The
// intro is song frames -72 to 0.
//   intro [full]   -72-0     the loading screen; the board folds into its home over the last 8 frames
//   face  [stack3] 0-323     eyes shut; READY. wakes it; it hums (g1, g2), then sings the glides;
//                            THRILLED TO PRINT. on g4; the eyes become a second mouth for PAGE 2 OF 1.;
//                            it dreams between them
//   bleed [L1]     323-348   the whole printer at last (FULL, boxed); on BLEED. edge to edge, 2×2, then 3×3,
//                            flooding into pegs
//   night [stack3] 348-732   a held note, leaning in; TONER LOW. (one eye goes out, the colour drains, the
//                            plates slip out of register); swallowed whole on the breath; B lands: the whole
//                            face goes blue, OUT OF OFFICE. struck, STILL PRINTING.; it dreams through the night
//                            (its old THRILLED TO PRINT. burnt into the display); it swallows, spits the page
//                            on the hard stop, and the board lets go: a grey printer, frozen. PAPER JAM.
// Pure: the same plan, shots and format give the same EDL. 9:16 only (the face is a vertical stack).
import {createEDL} from '../edl/schema.js';
import {FPS, INTRO, SONG_FRAMES, GLIDES, LINES, LINE_INDEX, stepOf, midStep} from './printer-song.js';

export const SCENE_LABELS = Object.freeze({intro:'Loading', face:'The face', bleed:'Full bleed', night:'Night shift'});
export const SHOT = 'printer-outward-feed-19442475';
const ASSET = `shot:${SHOT}`;

// Source frames of the take (printer-outward-feed, 241 frames): the mouth runs between CLOSED (the empty
// output tray, a page's edge just showing) and OPEN (the page out, the logo past the lip); JAM is the page
// stuck in the slot, its edge out (the logo's top only: from 86 the logo is whole in the tile, and the
// mouth only passes through there, never more than 12 frames at a time). The LEDs: open (both lit), shut
// (none), wink (the right one), bar (the long bar).
export const MOUTH = Object.freeze({closed:80, open:126, jam:85});
export const EYES = Object.freeze({open:60, shut:140, wink:200, bar:4});
// Crops in source px (1920×1080). The mouth: the slot with the printer's lip above it (upscale 1.39 in
// stack3's 531 px tiles). The second mouth (PAGE 2 OF 1.): the same slot 70 px higher, so its page shows its
// edge and not a second logo. The eyes: the LED row, centred on the two LEDs (x 1437.7 and 1488.3), 98 px
// wide so the panel's dark seam (x 1411-1414) stays out; the dots at 24 % and 76 % across, their lit
// rows 50-90 % down (source y 482-502), centred at y ≈ 384 in the frame, below the platforms' header. The tray: the pages sliding over the table, as
// peg video. The whole printer: a 9:16 window centred on the slot (x 728-1336).
export const CROPS = Object.freeze({
  mouth:Object.freeze({x:650, y:480, w:760, h:380}),
  mouth2:Object.freeze({x:650, y:410, w:760, h:380}),
  eyes:Object.freeze({x:1414, y:457.5, w:98, h:49.27}),
  tray:Object.freeze({x:420, y:640, w:1080, h:440}),
  whole:Object.freeze({x:728, y:0, w:608, h:1080}),
});
// The scene cuts and the night's moments (song frames).
export const CUTS = Object.freeze({intro:-INTRO, bleed:323, night:348, toner:404, swallow:421, b:428, bloom:559, burn:603, jam:714});

// The dream (Aaron: "after loading, the printer is dreaming"): [from, to, depth] in song frames, the
// stretches between its gestures. It drifts off over 8 frames and wakes over 8, always before the next
// glide opens the mouth: day-dreams in A (READY. and dozing, between the strokes, after PAGE 2 OF 1.),
// asleep under OUT OF OFFICE., and the long night (B's wordless 6 s) the deepest.
export const DREAMS = Object.freeze([[58, 86, .6], [114, 145, .6], [172, 192, .5], [211, 255, .7], [281, 318, .7], [438, 474, .85], [549, 702, 1]].map(d => Object.freeze(d)));
const RAMP = 8;
export function dreamAt(f) {
  let d = 0;
  for (const [a, b, k] of DREAMS) if (f > a && f < b) { const u = Math.min(1, (f - a) / RAMP, (b - f) / RAMP); d = Math.max(d, k * u * u * (3 - 2 * u)); }
  return d;
}
// The loading bar's progress (intro, song frames): it moves with the intro's own sound (the reversed bed's
// activity, spectral flux times level, summed: slow while it is near silence, faster as it swells) from the
// frame Synergy speaks to full on frame -9, then the screen folds away.
export const LOAD = Object.freeze([[-72, 0], [-61, 0], [-60, .06], [-52, .11], [-42, .2], [-34, .3], [-28, .4], [-24, .5], [-21, .58], [-17, .7], [-13, .83], [-9, 1]].map(k => Object.freeze(k)));

export const loadAt = f => { for (let i = 1; i < LOAD.length; i++) if (f <= LOAD[i][0]) { const [a, x] = LOAD[i - 1], [b, y] = LOAD[i]; return x + (y - x) * (f - a) / (b - a); } return 1; };

const SRC = n => +((n + .5) / FPS).toFixed(6);          // a source frame, at its centre (seconds)
const S = f => +stepOf(f).toFixed(6);                     // frames as steps (a length, or a local key time)
const AT = f => S(f + INTRO);                             // a song frame as the film's step (where a clip starts)
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const frameOf = t => Math.floor(t * FPS + 1e-9);          // the frame that holds song second t
const r4 = x => +x.toFixed(4);

// ---- the mouth ----------------------------------------------------------------------------------------
// A vertex's pitch opens the mouth: log-pitch from 700 Hz (closed) to 1600 Hz (open), times the glide's
// stroke: the big glides (g4, g7) a full stroke (the page bursts out), the hum at the top (g1, g2) a twitch,
// the rest a nibble (12 frames: the page's edge and the logo's top, never the whole page). Small notes
// nibble, big notes shout.
const STROKE = {g1:6, g2:6, g4:46, g7:46};
export const opening = hz => clamp(Math.log(hz / 700) / Math.log(1600 / 700));
// The mouth over the whole song: [frame, source frame] keys, linear between them (time.map). Between
// glides it rests closed and breathes (3 frames over a second); each glide opens it on its vertices.
export function mouthKeys() {
  const keys = [];
  const put = (f, src) => { const last = keys.at(-1); if (last && f <= last[0]) { if (f === last[0]) last[1] = src; return; } keys.push([f, +src.toFixed(3)]); };
  const breathe = (a, b, base, depth = 3, period = 24) => { for (let f = a + period / 2; f <= b - 6; f += period / 2) put(f, base + ((f - a) / (period / 2)) % 2 * depth); };
  put(0, MOUTH.closed);
  const glides = GLIDES.filter(x => x.id.startsWith('g')).map(g => {
    const A = STROKE[g.id] ?? 12, vs = g.vertices.map(([t, kind, hz]) => [frameOf(t), MOUTH.closed + A * opening(hz), kind]);
    // It opens toward a first peak over 4 frames, toward a first trough over 3; it closes over 8 after a
    // last peak, over 4 after a last trough.
    return {id:g.id, vs, pre:vs[0][0] - (vs[0][2] === 'hi' ? 4 : 3), post:vs.at(-1)[0] + (vs.at(-1)[2] === 'hi' ? 8 : 4)};
  });
  let rest = 0;
  glides.forEach((g, i) => {
    if (g.pre > rest) { breathe(rest, g.pre, MOUTH.closed); put(g.pre, MOUTH.closed); }
    for (const [f, src] of g.vs) put(f, src);
    // A glide that runs into the next one's opening flows into it; g7 runs into the cut back to the
    // face, where the mouth stays open into the held note.
    const next = glides[i + 1];
    if (next && g.post < next.pre) { put(g.post, MOUTH.closed); rest = g.post; }
    else rest = g.vs.at(-1)[0];
  });
  // Night (f348 on): the held note, open, with a slow vibrato; the drain; the swallow on the breath.
  for (const [f, s] of [[348, 126], [360, 123], [372, 126], [384, 123], [396, 126], [CUTS.swallow, 126], [427, MOUTH.closed]]) put(f, s);
  // B: asleep (a slower breath), b1's nibble as the eyes open, chewing on B's onsets while STILL
  // PRINTING. is up, then the slow page out on the 1.80 kHz line (hiccups on the onsets), the long note
  // held open, the swallow and the spit on the last glide, frozen on the stop with the page's edge stuck.
  breathe(CUTS.b, 474, MOUTH.closed, 3, 24);
  for (const [f, s] of [[474, 80], [478, 92], [486, 80], [494, 80], [500, 90], [508, 82], [517, 80], [521, 92], [525, 82], [528, 92], [533, 82], [548, 80],
    [CUTS.bloom, 80], [581, 83], [583, 81], [587, 84], [589, 82], [591, 85], [603, 85], [610, 126], [622, 126], [625, 120], [628, 126], [630, 121], [633, 126],
    [645, 123], [657, 126], [669, 123], [681, 126], [693, 123], [704, 126], [706, 126], [710, MOUTH.closed], [712, MOUTH.closed], [CUTS.jam, MOUTH.jam], [SONG_FRAMES, MOUTH.jam]]) put(f, s);
  return keys;
}
// The mouth's source frame at song frame f (fractional), from the keys.
export function mouthAt(keys, f) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) { const [a, x] = keys[i - 1], [b, y] = keys[i]; return x + (y - x) * (f - a) / (b - a); }
  return keys.at(-1)[1];
}
// A clip's time.map over [F0, F1): the keys inside it plus its two ends, in local steps and source
// seconds (a source frame n shows at its centre). lag: the mouth as it was `lag` frames earlier.
export function mouthMap(keys, F0, F1, lag = 0) {
  const fs = [...new Set([F0, ...keys.map(k => k[0] + lag).filter(f => f > F0 && f < F1), F1])].sort((a, b) => a - b);
  return fs.map(f => [S(f - F0), SRC(mouthAt(keys, f - lag))]);
}

// Keys for a param, in local steps from a clip's first frame: [[frame, value, ease?], ...]. A 'step' key
// jumps on its frame: it sits a quarter frame early, so rounding never pushes the jump to the next frame.
const keysAt = (F0, list) => list.map(([f, v, e]) => e === 'step' ? [+((f - F0 - .25) / 3).toFixed(6), v, e] : e ? [S(f - F0), v, e] : [S(f - F0), v]);
// A value that follows a function of the song frame over [F0, F1): sampled every 3 frames (and on the
// dream windows' edges), runs of one value kept to their ends, as keys. Plain numbers when it never moves.
function follow(F0, F1, fn, extra = []) {
  // (On whole multiples of 3 frames of the song, so two clips that overlap carry the same keys there.)
  const fs = new Set([F0, F1 - 1, ...extra.filter(f => f > F0 && f < F1 - 1)]);
  for (let f = Math.ceil(F0 / 3) * 3; f < F1; f += 3) fs.add(f);
  for (const [a, b] of DREAMS) for (const f of [a, a + RAMP / 2, a + RAMP, b - RAMP, b - RAMP / 2, b]) if (f > F0 && f < F1 - 1) fs.add(f);
  const pts = [...fs].sort((a, b) => a - b).map(f => [f, r4(fn(f))]);
  if (pts.every(p => p[1] === pts[0][1])) return pts[0][1];
  const out = pts.filter((p, i) => i === 0 || i === pts.length - 1 || p[1] !== pts[i - 1][1] || p[1] !== pts[i + 1][1]);
  return keysAt(F0, out);
}
// When it sings (the speaking border's light): each glide from its opening to its close, the held note,
// b1's stroke, STILL PRINTING. and the slow page through the night; dark asleep and on the jam.
export function speakingKeys() {
  const spans = GLIDES.filter(g => g.id.startsWith('g')).map(g => [frameOf(g.vertices[0][0]) - 4, frameOf(g.vertices.at(-1)[0]) + 6]);
  spans.push([CUTS.night, CUTS.swallow + 3], [474, 486], [494, 548], [CUTS.bloom, CUTS.jam]);
  // Spans that touch (closer than the 3-frame fades) merge, so the border never blinks between them.
  const merged = [];
  for (const [a, b] of spans.sort((x, y) => x[0] - y[0])) { const m = merged.at(-1); if (m && a - 6 <= m[1]) m[1] = Math.max(m[1], b); else merged.push([a, b]); }
  const out = [[0, 0]];
  for (const [a, b] of merged) { if (a - 3 > out.at(-1)[0]) out.push([a - 3, 0]); out.push([a, 1], [b, 1], [b + 3, 0]); }
  return out;
}
// The vertex frames (for the scanline's wobble: the print raster shudders on each turn of the pitch).
const VERTICES = GLIDES.filter(g => g.id.startsWith('g')).flatMap(g => g.vertices.map(([t]) => frameOf(t)));
function wobbleKeys(F0, F1) {
  const out = [[F0, 0]];
  for (const f of VERTICES) if (f - 1 > out.at(-1)[0] && f + 3 < F1) out.push([f - 1, 0], [f, 4], [f + 3, 0]);
  return keysAt(F0, out);
}

// ---- the dream's looks ---------------------------------------------------------------------------------
// The colour drifts while it dreams: by day a light duotone wash (at most .22) whose hue drifts slowly
// between violet and warm; by night the blue wash deepens a little and drifts toward violet. Never green.
const dayHue = f => 1 + .85 * Math.sin(2 * Math.PI * f / 240);
const nightHue = f => .6 * dreamAt(f) * (.5 + .5 * Math.sin(2 * Math.PI * f / 200));
const dayWash = (F0, F1) => ({type:'paletteWash', mix:follow(F0, F1, f => .22 * dreamAt(f)), hue:follow(F0, F1, dayHue)});
// Stars in pegs over a tile while it dreams (schema.js sparkle): amber by the eyes, blue and white over the
// mouth, white over the body's blue pegs.
const stars = (F0, F1, {level, count, pitch, size, tone, seed}) => ({type:'sparkle', amount:follow(F0, F1, f => level * dreamAt(f)), count, pitch, size, spin:.18, tone, seed});
// The eyes' blocks swell and soften with the song's voice band (the 600-3000 Hz line it sings in).
const BREATHE = {type:'breathe', px:{bind:'voice', base:16, scale:20, attack:.04, release:.3}, cx:.5, cy:.7};
// ---- square edges (Aaron's note, after his studio's loader: hard-edged big-pixel stepped rings opening like an eye
// or a tunnel, flat colour, no anti-aliasing; and pixelation as motion tiles) -----------------------------------
// A value that jumps on the song's grid: one key every `every` frames (song frames: film = song + 72, a whole
// number of steps, so the grid runs on), each a step on its frame. The tiles are dealt and the rings move on the
// eighths (6 frames) while it dreams, on the sixteenths (3) in the intro and the bleed.
function stepped(F0, F1, every, fn) {
  const out = [[F0, r4(fn(F0))]];
  for (let f = Math.ceil((F0 + 1) / every) * every; f < F1; f += every) { const v = r4(fn(f)); if (v !== out.at(-1)[1]) out.push([f, v, 'step']); }
  return out.length === 1 ? out[0][1] : keysAt(F0, out);
}
// The eyes dream in rings: stepped bands round each LED (two centres, the LEDs at 24 % and 76 % across, 70 % down),
// the LED itself the pupil, growing out of the eyes as it drifts off and back into them as it wakes; white with an
// amber stripe by day, blue with a white one by night. They flow outward an eighth at a time.
const eyeRings = (F0, F1, night) => ({type:'contour', mix:follow(F0, F1, f => .75 * dreamAt(f)), px:24, band:2, duty:.5,
  travel:stepped(F0, F1, 6, f => f / 48), cx:.5, cy:.7, twin:.52, aspect:1.15, corner:.7, hole:3, grow:1, reach:600, tone:night ? 1 : 2});
// The mouth dreams in tiles: 96 px tiles dealt again on every eighth, a share of them dropping to blocks of 24, 12
// or 6 px, their picture rolled a block inside them and re-quantised to 4 levels: the face's picture re-sampling
// itself while it dreams. Never while it sings (the share follows the dream: 0 on every glide).
const mouthTiles = (F0, F1, k = .38) => ({type:'pixelTiles', amount:follow(F0, F1, f => k * dreamAt(f)), tile:96, px:24, slide:1, levels:4, tick:stepped(F0, F1, 6, f => Math.floor(f / 6)), seed:3});
// The board's dream leaks into the face: one field of stepped rings centred on the board home (frame units), the
// same block (21 px: 3 of the home's 7 px pegs), bands and phase as the board's own contour look at night, so the
// rings run on from the display into the tiles. RING_TRAVEL (bands outward, a third of a band a second) is shared by both.
const HOME_C = {cx:.5, cy:.661};
const RING_TRAVEL = f => f / 36;
const homeRings = (F0, F1, mix, tone = 1, reach = 720) => ({type:'contour', space:'frame', ...HOME_C, mix, px:21, band:3, duty:1 / 3, travel:stepped(F0, F1, 6, RING_TRAVEL), aspect:1.6, corner:.7, grow:1, reach, tone});
// The half-shut lids: where the edge of a lid crosses the LEDs (tile px from the top; the LEDs' lit rows
// are 264-480), as an iris centred far above the tile (cy -3), so its edge is a gentle arc: at 0 it clears
// the LEDs, at 1 it covers their top half.
const LID = {top:250, half:372, cy:-3};
const lidR = d => r4((LID.top + (LID.half - LID.top) * d - LID.cy * 531) / (.5 * Math.hypot(1056, 531)));

// ---- the film ----------------------------------------------------------------------------------------
export function printerMouth(plan, shots, {format = '9:16'} = {}) {
  if (format !== '9:16') throw Error('printer-mouth is a vertical film: its face is a stack of 9:16 tiles (format 9:16).');
  const keys = mouthKeys(), clips = [], overrides = [], camera = [];
  const clip = (id, F0, F1, cell, extra) => { const c = {id, at:AT(F0), len:S(F1 - F0), cell, asset:ASSET, ...extra}; clips.push(c); return c; };
  const G7 = id => overrides.push({target:id, rule:'G7', note:'Printer pages run backwards on purpose, in this film only (Aaron asked for it super weird): the paper slot is a mouth, and it swallows its page as the pitch falls.'});
  const G4 = id => overrides.push({target:id, rule:'G4', note:'The track has no audible downbeat (its 16th grid has no measurable bar phase): this scene starts on a glide or on the end of the intro.'});
  const raster = F0 => ({type:'scanline', amount:.15, period:6, wobble:wobbleKeys(F0, F0 + 1e9)});
  // The call's own chrome: the mouth's tile carries the printer's name bar ("Printer · Deliverables"),
  // its speaking border lit while it sings (SPEAKING), its mic muted while it is out of office and on the
  // jam. The eyes and the tray carry none: they are parts of one face.
  const voice = F0 => ({speaking:keysAt(F0, speakingKeys().filter(([f]) => f >= F0)), mic:keysAt(F0, [[F0, 1], [CUTS.b, 0, 'step'], [494, 1, 'step'], [CUTS.jam, 0, 'step']].filter(([f]) => f >= F0))});
  const bare = {name:''};
  const A1 = CUTS.bleed, B0 = CUTS.night;

  // The intro (song -72 to 0): black under a full-frame board; the loading screen is the board's (below).
  clip('boot', CUTS.intro, 0, 'full', {asset:'gen:color:#000000', scene:'intro', chrome:bare, why:'the loading screen: the Peg Board takes the whole frame while the file loads'});

  // The mouth, face A (f0-323): the slot sings, under a print raster that shudders on every vertex; the
  // nibble of g3 and the full stroke of g4 leave trails (the page's earlier frames, lightening); g4's spit
  // blurs down the page's path. While it dreams the colour drifts and stars turn over it.
  clip('mouth-a', 0, A1, 'stack3.1', {scene:'face', time:{map:mouthMap(keys, 0, A1)}, frame:{crop:{'9:16':CROPS.mouth}}, chrome:voice(0),
    fx:[raster(0), {type:'trail', taps:keysAt(0, [[0, 0], [89, 0], [90, 3, 'step'], [112, 3], [113, 0, 'step'], [147, 0], [148, 2, 'step'], [170, 2], [171, 0, 'step']]), frames:2, decay:.55},
      {type:'dirBlur', angle:90, px:keysAt(0, [[0, 0], [158, 0], [160, 24], [161, 24], [165, 0]])}, dayWash(0, A1), mouthTiles(0, A1), stars(0, A1, {level:.8, count:4, pitch:12, size:3.5, tone:.2, seed:3})],
    why:'the paper slot as a mouth: the page comes out as the pitch rises and is swallowed as it falls'});
  G7('mouth-a'); G4('mouth-a');
  // The eyes: the LED row, held frames, cut on the song's moments (READY. opens them; blinks at 5.0 and
  // 10.25 s, the second on an onset), in big pixel blocks that breathe with the song (the amber LEDs become
  // two square eyes on the beige). By night they drain with the toner and go blue with the face; the long
  // bar on the jam is a dead stare in fixed blocks, and the first warm light in 13 s.
  const night = F0 => F0 >= B0;
  const eyeFx = (F0, F1, jam) => {
    if (jam) return [{type:'mosaic', px:22}];
    const out = [BREATHE];
    if (night(F0)) out.push(...drain(F0), nightWash(F0, F1), ...(F0 < CUTS.b ? [slip(F0)] : []));
    else out.push(dayWash(F0, F1));
    if (DREAMS.some(([a, b]) => a < F1 && b > F0)) out.push(eyeRings(F0, F1, night(F0)), stars(F0, F1, {level:.9, count:5, pitch:11, size:3, tone:.85, seed:7}));
    return out;
  };
  const eye = (id, F0, F1, src, scene) => clip(id, F0, F1, 'stack3.0', {scene, time:{in:SRC(src), freezeAt:{src:SRC(src)}}, frame:{crop:{'9:16':CROPS.eyes}}, chrome:bare, fx:eyeFx(F0, F1, src === EYES.bar)});
  eye('eyes-shut', 0, 47, EYES.shut, 'face');
  eye('eyes-ready', 47, 120, EYES.open, 'face');
  eye('eyes-blink', 120, 122, EYES.shut, 'face');
  eye('eyes-open', 122, 246, EYES.open, 'face');
  eye('eyes-blink-1', 246, 248, EYES.shut, 'face');
  eye('eyes-open-1', 248, 260, EYES.open, 'face');
  // PAGE 2 OF 1.: the eyes tile becomes a second mouth, one step behind the first (its slot 70 px higher, so
  // the page there shows its edge, not a second logo).
  clip('eyes-mouth', 260, 274, 'stack3.0', {scene:'face', time:{map:mouthMap(keys, 260, 274, 3)}, frame:{crop:{'9:16':CROPS.mouth2}}, chrome:bare, fx:[raster(260)],
    why:'PAGE 2 OF 1: the eyes become a second mouth, one step behind'});
  G7('eyes-mouth');
  eye('eyes-back', 274, A1, EYES.open, 'face');
  // The lids: over the open eyes while it dreams, the same eyes with the LEDs out, showing only above a
  // lid's edge that sinks to the middle of the LEDs and rises again as it wakes (the printer's own beige:
  // half-shut LEDs). Same crop, blocks, colour and stars as the eyes under them (the same star field, so the
  // stars run on across the lid's edge), only the LEDs differ.
  const lids = [];
  for (const [a, b] of DREAMS) {
    const F0 = a, F1 = b, id = `lids-${a}`;
    lids.push(clip(id, F0, F1, 'stack3.0', {scene:night(F0) ? 'night' : 'face', z:1, time:{in:SRC(EYES.shut), freezeAt:{src:SRC(EYES.shut)}}, frame:{crop:{'9:16':CROPS.eyes}}, chrome:bare,
      fx:[...eyeFx(F0, F1, false), {type:'iris', r:follow(F0, F1, f => lidR(dreamAt(f) / Math.max(...DREAMS.filter(d => d[0] === a).map(d => d[2])))), cx:.5, cy:LID.cy, feather:4}],
      why:'it dreams: the lids droop over the LEDs between its gestures'}));
  }
  // The body: the output tray as peg video, its pages piling at half speed (the take's clean 75-frame
  // loop, 141-216, a cut seam of 1.43; the stepping at 12 fps is the printer's own), in big dim pegs
  // (pitch 16, 3 levels, gamma 2.2: the pages' logos dissolve into texture), under the platforms' caption.
  // While it dreams the pegs smear (a trail of two copies) and stars turn among them, on their grid.
  const trayFx = (F0, F1, extra = []) => [{type:'pegVideo', mix:1, pitch:16, levels:3, gamma:2.2},
    {type:'trail', taps:2, frames:3, decay:follow(F0, F1, f => .5 * dreamAt(f)), blend:'lighten'}, stars(F0, F1, {level:.8, count:4, pitch:16, size:2.5, tone:.5, seed:5}), ...extra];
  const tray = (id, F0, F1, scene, extra, time) => clip(id, F0, F1, 'stack3.2', {scene, time:time ?? {in:SRC(141) - .5 / FPS, rate:.5, repeat:{unit:{frames:150}, loop:true}}, frame:{crop:{'9:16':CROPS.tray}},
    fx:trayFx(F0, F1, extra), chrome:bare});
  tray('tray-a', 0, A1, 'face', [homeRings(0, A1, follow(0, A1, f => .9 * dreamAt(f)), 0, 900)]);

  // Full bleed (f323-348): the whole printer for the first time. FULL: boxed, zoomed out on black (the
  // take's width at .55); BLEED.: the picture breaks out to all four edges (the 9:16 window, upscale 1.74)
  // as it tiles 2×2, then 3×3 (copies, never reflections); from the 3×3 it floods into pegs, the tray's own
  // look (the nine pages' logos dissolve as they appear), stars among the pegs, before the cut back. No
  // chrome: the frame is pure picture, nothing in the caption band.
  clip('whole', A1, B0, 'L1.0', {scene:'bleed', time:{map:mouthMap(keys, A1, B0)}, frame:{crop:{'9:16':CROPS.whole}, zoom:keysAt(A1, [[A1, .55], [331, 1, 'step']]), cx:.7347, cy:.64}, chrome:bare,
    fx:[raster(A1), {type:'tile', mirror:0, cols:keysAt(A1, [[A1, 1], [331, 2, 'step'], [337, 3, 'step']]), rows:keysAt(A1, [[A1, 1], [331, 2, 'step'], [337, 3, 'step']])},
      // FULL: the black round the boxed printer (y 293-1335) is a tunnel of stepped rings centred on it, rushing out on
      // every sixteenth of g7 (Aaron's loader, round his own printer); on BLEED. the picture covers it.
      {type:'contour', mix:keysAt(A1, [[A1, 1], [331, 0, 'step']]), under:1, px:30, band:2, duty:.5, travel:stepped(A1, 331, 3, f => (f - A1) / 6), cx:.5, cy:.423, aspect:1, corner:.7, tone:0},
      // From the 2×2 the copies come apart in motion tiles, dealt on every sixteenth of g7's last rise, until
      // the pegs take them.
      {type:'pixelTiles', amount:keysAt(A1, [[A1, 0], [332, 0], [343, .55, 'inQuad'], [346, .3]]), tile:120, px:30, slide:1, levels:4, tick:stepped(A1, B0, 3, f => Math.floor(f / 3)), seed:9},
      {type:'pegVideo', mix:keysAt(A1, [[A1, 0], [337, 0], [346, 1, 'inQuad']]), pitch:16, levels:3, gamma:2.2},
      {type:'sparkle', amount:keysAt(A1, [[A1, 0], [338, 0], [346, .8, 'inQuad']]), count:10, pitch:16, size:3, spin:.25, tone:0, seed:11}],
    why:'the reveal: the face was a printer all along; FULL BLEED. as it breaks out and multiplies'});
  G7('whole'); G4('whole');

  // Night (f348-732). The colour drains with the toner (f404-414) and the plates slip out of register (the
  // printer's own failure: red and blue part, 8 px by f414); B lands at f428 and the whole face goes blue
  // (the palette wash, drifting toward violet while it dreams). From f559 the board eats it: one peg bloom,
  // centred on the board's home in frame units (reach 720 px), grows up through the tray and the mouth to
  // .75 by the last glide. On the hard stop (f714) the board lets go: the wash and the bloom are gone, and
  // a grey, real printer freezes.
  function drain(F0) {
    if (F0 >= 414) return [{type:'saturation', amount:.1}, {type:'chromaDrop', amount:.8}];
    const k = (a, b) => keysAt(F0, (F0 < CUTS.toner ? [[F0, a], [CUTS.toner, a]] : [[F0, a]]).concat([[414, b, 'outQuad']]));
    return [{type:'saturation', amount:k(1, .1)}, {type:'chromaDrop', amount:k(0, .8)}];
  }
  function nightWash(F0, F1) {
    // The mix steps on B and on the jam (on their frames), and between them deepens while it dreams.
    const mix = f => f < CUTS.b || f >= CUTS.jam ? 0 : .7 + .12 * dreamAt(f);
    const fs = new Set([F0, F1 - 1]);
    for (const [a, b] of DREAMS) for (let f = a; f <= b; f += 3) if (f > F0 && f < F1 - 1) fs.add(f);
    const steps = [CUTS.b, CUTS.jam].filter(f => f > F0 && f < F1);
    for (const f of steps) { fs.add(f); fs.add(f - 1); }
    const pts = [...fs].sort((a, b) => a - b).map(f => steps.includes(f) ? [f, r4(mix(f)), 'step'] : [f, r4(mix(f))]);
    return {type:'paletteWash', hue:follow(F0, F1, nightHue), mix:pts.every(p => p[1] === pts[0][1]) ? pts[0][1] : keysAt(F0, pts)};
  }
  const slip = F0 => ({type:'rgbSplit', px:keysAt(F0, [[F0, 0], [Math.max(F0, 392), 0], [414, 8, 'outQuad'], [CUTS.b, 0, 'step']]), angle:0});
  // (The rings, not the dots: the board's stepped field grows out of the home through the tray and up the mouth,
  // to .75 by the last glide, and lets go on the stop.)
  const bloom = F0 => homeRings(F0, SONG_FRAMES, keysAt(F0, [[F0, 0], [CUTS.bloom, 0], [706, .75, 'inOutSine'], [CUTS.jam, 0, 'step']]));
  // The mouth by night: the held note leans in (zoom 1.25 by TONER LOW., upscale 1.74), drains and slips, is
  // swallowed, goes blue; through the night's dream its page trails; the spit blurs down; the jam.
  clip('mouth-night', B0, SONG_FRAMES, 'stack3.1', {scene:'night', time:{map:mouthMap(keys, B0, SONG_FRAMES)},
    frame:{crop:{'9:16':CROPS.mouth}, zoom:keysAt(B0, [[B0, 1], [CUTS.toner, 1.25, 'inOutSine'], [427, 1.25], [CUTS.b, 1, 'step']])}, chrome:voice(B0),
    fx:[raster(B0), ...drain(B0), nightWash(B0, SONG_FRAMES), slip(B0), bloom(B0),
      {type:'trail', taps:3, frames:3, decay:follow(B0, SONG_FRAMES, f => f >= 549 ? .45 * dreamAt(f) : 0), blend:'lighten'}, mouthTiles(B0, SONG_FRAMES, .3),
      {type:'dirBlur', angle:90, px:keysAt(B0, [[B0, 0], [711, 0], [712, 24], [713, 24], [CUTS.jam, 0, 'step']])},
      stars(B0, SONG_FRAMES, {level:.8, count:5, pitch:12, size:3.5, tone:.35, seed:13})],
    why:'the held note, the drain, the swallow, the night shift, the jam'});
  G7('mouth-night'); G4('mouth-night');
  eye('eyes-night-open', B0, CUTS.toner, EYES.open, 'night');
  eye('eyes-wink', CUTS.toner, CUTS.b, EYES.wink, 'night');
  eye('eyes-sleep', CUTS.b, 477, EYES.shut, 'night');
  eye('eyes-wake', 477, 616, EYES.open, 'night');
  eye('eyes-blink-2', 616, 618, EYES.shut, 'night');
  eye('eyes-wake-2', 618, 641, EYES.open, 'night');
  eye('eyes-blink-3', 641, 643, EYES.shut, 'night');
  eye('eyes-late', 643, CUTS.jam, EYES.open, 'night');
  eye('eyes-jam', CUTS.jam, SONG_FRAMES, EYES.bar, 'night');
  // The body by night: the board's bloom eats it; on the stop it freezes with everything else (the frame
  // the loop shows on f714, source 174).
  tray('tray-night', B0, CUTS.jam, 'night', [bloom(B0)]);
  tray('tray-jam', CUTS.jam, SONG_FRAMES, 'night', [], {in:SRC(174), freezeAt:{src:SRC(174)}});

  // The camera: while it dreams the face floats (a few px of drift and half a degree of sway, slow,
  // different periods so it never loops); on THRILLED TO PRINT. (g4) and on b1 it lunges at the words, 6 %
  // in two frames and back over a second. The board holds still under all of it, so the words never move.
  for (const [a, b] of DREAMS) {
    camera.push({id:`float-${a}`, at:AT(a), len:S(b - a), clock:'film', board:false,
      dx:follow(a, b, f => 5 * dreamAt(f) * Math.sin(2 * Math.PI * f / 137 + 1)), dy:follow(a, b, f => 9 * dreamAt(f) * Math.sin(2 * Math.PI * f / 90)),
      rot:follow(a, b, f => .6 * dreamAt(f) * Math.sin(2 * Math.PI * f / 113 + 2))});
  }
  for (const [id, f] of [['lunge-g4', 150], ['lunge-b1', 477]]) camera.push({id, at:AT(f), len:S(24), clock:'film', board:false, zoom:[[0, 1], [S(2), 1.06, 'outQuad'], [S(24), 1, 'inOutSine']], cx:.5, cy:.42});

  // The board: the printer's display. Its words (printer-song.js LINES) land on their frames; the
  // status words are white, its enthusiasm blue, the jam the one signal word (with the strike, the house's
  // own). Under them, looks with no signal in them: the loading bar on the intro's full-frame board, one
  // lissajous figure while it sings A, then through the night a slow moiré, and from f603 its old
  // THRILLED TO PRINT. burnt into the display, a ghost, while it dreams through the night shift.
  const line = (name, extra = {}) => { const l = LINES[LINE_INDEX[name]], at = midStep(l.words[0][1]); return {id:name, at:+at.toFixed(6), len:+(midStep(l.to) - at).toFixed(6), text:{ref:`line:printer#${LINE_INDEX[name]}`}, ...extra}; };
  const strike = LINES[LINE_INDEX.office].strike;
  const board = [
    // The loading screen: the bar, and round it an eye of stepped rings (Aaron's loader, in the board's own pegs, 2 × 2
    // a block: 41 blocks across) that opens as Synergy speaks, flows in toward the bar on every sixteenth, faster
    // as the sound swells and the file loads, and shuts onto the full bar before the screen folds home. One
    // stripe in six is amber: the printer's eyes before it has a face.
    {type:'psych', id:'loading', at:AT(CUTS.intro), len:S(INTRO), look:'loading', params:{progress:keysAt(CUTS.intro, LOAD), cx:.47, cy:.6, level:1, breath:.3,
      rings:keysAt(CUTS.intro, [[CUTS.intro, 0], [-69, 0], [-61, 1, 'inOutSine']]), rx:.47, ry:.54, block:2, band:3, duty:1 / 3, aspect:1.7, corner:.7, pupil:9, every:6, flow:0,
      open:keysAt(CUTS.intro, [[CUTS.intro, 0], [-69, 0], [-44, 1, 'outQuad'], [-17, 1], [-9, 0, 'inOutSine']]), travel:stepped(CUTS.intro, 0, 3, f => (f - CUTS.intro) / 16 + 6 * loadAt(f))}, fade:2},
    {type:'psych', id:'hum', at:AT(0), len:S(CUTS.toner), look:'lissajous', params:{level:.5, speed:.5, curves:1}, fade:4},
    // The night: the display dreams in stepped rings (blue, every fourth white), blocks of 3 × 3 pegs (21 px), flowing
    // out on the eighths; the same field, block and phase as the rings it sends into the face (homeRings).
    {type:'psych', id:'night', at:AT(CUTS.b), len:S(CUTS.burn - CUTS.b), look:'contour', params:{level:.45, breath:.3, tone:1, block:3, band:3, duty:1 / 3, aspect:1.6, corner:.7, pupil:0, flow:0,
      travel:stepped(CUTS.b, CUTS.burn, 6, f => -RING_TRAVEL(f))}, fade:4},
    line('loading', {palette:'white', k:2}),
    line('ready', {palette:'white', k:2, release:'afterglow'}),
    line('thrilled', {palette:'blue', k:2, lines:2}),
    line('page', {palette:'white', k:2, lines:2}),
    line('bleed', {palette:'blue', k:2}),
    line('toner', {palette:'white', k:2, lines:2}),
    line('office', {palette:'white', k:2, lines:2, fx:{strike:{at:+((strike.frame + .5) / FPS).toFixed(6), words:strike.words, draw:.125, tone:'signal'}}}),
    line('still', {palette:'blue', k:2, lines:2}),
    line('jam', {palette:'signal', k:2, lines:2}),
    {id:'burn', at:AT(CUTS.burn), len:S(700 - CUTS.burn), text:{ref:`line:printer#${LINE_INDEX.thrilled}`}, ghost:.3, palette:'blue', k:2, lines:2, why:'it dreams of its first enthusiasm, burnt into the display'},
  ];
  // The loading screen folds into the printer's display over the intro's last 8 frames, landing on the
  // song's first frame, where the face appears around it.
  const boardMoves = [{id:'intro.home', at:AT(0), frames:8, ease:'inOutSine', align:'end', why:'the loading screen folds into the printer\'s display as the face appears'}];
  return createEDL({form:plan.form, track:plan.track, format, clips, board, camera, boardMoves, overrides});
}
