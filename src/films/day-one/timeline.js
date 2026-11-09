// Day One: the one clock. Pure (no DOM, no Web Audio), the same in Node and in the page.
//
//   frameAt(t, layout)  the picture at time t: camera (a, k), counters, the post's "…more",
//                       "Load more comments", the sticky social bar, Doug's reply
//   ticks()             every instant a number on screen changes (the counter is the song's hi-hat)
//   cues()              the statement grid the sound sings on (one phrase, "Congrats on the new role!")
//   rowBeats()          the beat each comment row is designed to arrive on the reading line
//   buildCamera(layout) the camera's segments, built from row tops the page measures after
//                       document.fonts.ready (never from constants, so SF Pro and Inter land on time)
//
// Notation: B is the beat index from 0 (100 BPM: a beat is 0.6 s, 36 frames at 60 fps; an 8th
// is 18 frames, a 16th 9). t = 0.6·B. A content point (x, y) draws at (180 + (x - 180)·k, 300 + (y - a)·k):
// a(t) is the content y on the reading line, k(t) the scale. Everything is in CSS px of the
// 360x640 page (x3 for the 1080x1920 frame).
//
// The frame is a phone screen recording: the phone's status bar and the app's top bar (TOP, 100 px)
// stay put at scale 1, and so does the counts row once it pins under them (STICKY_H). That keeps the
// counter, the film's clock, inside the 9:16 safe band (y >= 300 frame px) and legible at the wall.

export const FPS = 60;                        // a screen recording's rate: the roll moves half as far a frame
export const BPM = 100;
export const BEAT = 60 / BPM;                 // 0.6 s
export const BEATS = 98;                      // 24.5 bars
export const FRAMES = Math.round(BEATS * BEAT * FPS);   // 3,528 frames, 58.8 s
export const DURATION = FRAMES / FPS;
export const PAGE = Object.freeze({w:360, h:640, dpr:3});
export const TOP = 100;                       // status bar 44 + the app's top bar 56 (300 frame px: the safe band's top)
export const STICKY_H = 34;                   // the counts row, pinned under the top bar
export const READ_Y = 300;                    // the reading line (900 frame px)
export const END_Y = 270;                     // where Jamie's comment comes to rest (Doug's line ends above 1,380 frame px)
export const VMAX = 390;                      // on-screen speed limit, CSS px/s (6.5 px a frame at 60 fps; 19.5 frame px)
export const TAU = .25;                       // the settle's time constant (an iOS flick slowing down)
export const CREEP = 6;                       // px/s while a special row dwells
export const K_WALL = .45;                    // the pull-back's scale
export const COMPANY = 'Brightwick';          // Aaron's decision: "Brightwell" is a real payments company

export const tOf = B => B * BEAT;
// The first frame that shows something that happens on beat B (at 60 fps every 16th is a whole frame).
export const frameOf = B => Math.ceil(B * BEAT * FPS - 1e-6);

// The beats the picture changes on, other than the roll and the counter.
export const EVENTS = Object.freeze({
  more:2,          // "…more" opens: the text reflows to full length, no animation
  burst:[4, 7.5],  // the reaction burst, on 8ths
  roll:8,          // the roll eases in
  loadMore:20,     // "Load more comments" settles on the line
  press:21,        // pressed: #EBEBEB for 4 frames, then a spinner
  loaded:22,       // rows 12-14 appear, row 12 on the line; the comment counter starts
  flip:40,         // the reaction cluster flips to Celebrate, Like, Love
  pullBack:[71, 76],   // sine in-out over 5 beats: every point in view stays under the speed limit
  pushIn:[82, 85.5],
  jamie:88,        // Jamie's comment comes to rest (END_Y); the roll stops
  doug:92,         // Doug's reply appears: 1,204 and its one tick
});
export const PRESS_FRAMES = Math.round(4 / 30 * FPS);   // the press: #EBEBEB for 133 ms
export const FINAL_LAG = 4 / FPS;              // the last line starts 67 ms after Doug's reply appears (picture, tick, then the voice)

// The warm block: read, not rolled. Each stop puts a row's top at y on screen and holds it from
// at[0] to at[1] (beats); the camera moves between stops with a minimum-jerk ease and comes to a
// full stop on "Load more comments" at B20. Dana (and Jamie's reply), then Mom (and "Mom 😭") with
// Tess under her, then Nadia above the button.
export const WARM_STOPS = Object.freeze([
  {row:1, y:200, at:[11, 12.5]},
  {row:3, y:150, at:[15.5, 17]},
]);

// The special rows: arrive on the line at B (settling in), creep while they dwell, launch on
// `launch` (one beat, eased in) so the next row arrives at `next`.
export const SPECIALS = Object.freeze([
  {row:10, B:26, launch:28, next:29, joke:'Congrats, Jordan!'},
  {row:15, B:34, launch:37, next:38, joke:'the recruiter'},
  {row:20, B:41, launch:42, next:43, joke:'So well deserved!'},
  {row:29, B:48, launch:49, next:50, joke:"Let's connect!"},
  {row:38, B:55, launch:59, next:60, joke:'the vendor pitch'},
  {row:57, B:70, launch:73, next:74, joke:'the anniversary'},
]);
const range = (a, b) => Array.from({length:b - a + 1}, (_, i) => a + i);
// The waves: uniform rows on a grid (a credit roll). Rows 49 (👏👏👏) and 53 ("Insightful")
// pass inside waves 6-8 without a dwell. The wall (rows 58-73) is 16 consecutive 8ths.
export const WAVES = Object.freeze([
  {wave:1, rows:range(7, 9), B:22, every:1},
  {wave:2, rows:range(11, 14), B:29, every:1},
  {wave:3, rows:range(16, 19), B:38, every:.5},
  {wave:4, rows:range(21, 28), B:43, every:.5},
  {wave:5, rows:range(30, 37), B:50, every:.5},
  {wave:6, rows:range(39, 56), B:60, every:.5},   // 6: 39-48, 👏👏👏 49, 7: 50-52, "Insightful" 53, 8: 54-56
  {wave:9, rows:range(58, 73), B:74, every:.5, wall:true},
]);
export const JAMIE_ROW = 80, DOUG_ROW = 81, LAST_WARM_ROW = 6, TYPO_ROW = 79;
export const DECEL = Object.freeze({from:82, to:88});   // wave 10 (rows 74-78) and the typo (79) slow into Jamie's comment

// The wave (the sound's sense of it) each comment row belongs to.
const WAVE_OF = [[1, 6, 0], [7, 9, 1], [11, 14, 2], [16, 19, 3], [21, 28, 4], [30, 37, 5], [39, 48, 6], [50, 52, 7], [54, 56, 8], [58, 73, 9], [74, 78, 10]];
export function waveOf(row) {
  for (const [a, b, w] of WAVE_OF) if (row >= a && row <= b) return w;
  return null;                                          // a special or species row
}

// The beat each row is designed to arrive on (rows the camera does not aim at are null:
// the warm block reads at a steady pace, and wave 10 slows down wherever its rows fall).
export function rowBeats() {
  const out = {};
  for (const w of WAVES) w.rows.forEach((r, i) => { out[r] = w.B + i * w.every; });
  for (const s of SPECIALS) out[s.row] = s.B;
  out[WAVES[0].rows[0]] = EVENTS.loaded; out[TYPO_ROW - 5] = DECEL.from; out[JAMIE_ROW] = EVENTS.jamie;
  return out;
}

// ---- The counter ---------------------------------------------------------------------------
// Landmarks (comments, reactions, reposts). Between them the numbers jump once per 8th from
// B22 to B88, and once per 16th from B74 to B82: uneven, seeded, monotone, never zero.
export const OPEN = Object.freeze({comments:12, reactions:47, reposts:0});
export const BURST = Object.freeze({from:4, to:7.5, reactions:64});
export const LANDMARKS = Object.freeze([
  {B:26, comments:41, reactions:118, reposts:0},
  {B:34, comments:96, reactions:260, reposts:1},
  {B:41, comments:187, reactions:488, reposts:2},
  {B:48, comments:340, reactions:1126, reposts:4},
  {B:55, comments:512, reactions:1690, reposts:6},
  {B:62, comments:688, reactions:2214, reposts:8},
  {B:65.5, comments:803, reactions:2560, reposts:10},
  {B:70, comments:911, reactions:2931, reposts:12},
  {B:83, comments:1140, reactions:3604, reposts:16},
  {B:88, comments:1203, reactions:3851, reposts:18},
]);
export const FINAL = Object.freeze({B:92, comments:1204, reactions:3862, reposts:18});
export const ACCENTS = Object.freeze([340, 1204]);
const SEED = 0xDA1;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// `delta` split over n steps, each at least `min`, by seeded uneven weights (largest remainder).
function allocate(delta, n, rand, min = 1) {
  const extra = delta - n * min;
  if (extra < 0) throw Error(`Cannot split ${delta} into ${n} steps of at least ${min}.`);
  const w = Array.from({length:n}, () => .35 + rand() * 1.3), sum = w.reduce((s, x) => s + x, 0);
  const raw = w.map(x => x / sum * extra), out = raw.map(Math.floor);
  let left = extra - out.reduce((s, x) => s + x, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]).slice(0, left).forEach(([, i]) => out[i]++);
  return out.map(x => x + min);
}
// `delta` single steps placed among n instants (for reposts: 0, 1 or a few per landmark).
function sprinkle(delta, n, rand) {
  const out = new Array(n).fill(0);
  for (let k = 0; k < delta; k++) {
    const i = Math.min(n - 1, Math.floor((k + .25 + rand() * .5) * n / delta));
    out[i]++;
  }
  return out;
}

let TICKS = null;
// Every instant a number on screen changes: {B, t, frame, comments, reactions, reposts,
// d: {comments, reactions, reposts}, step, vel, accent, kind}. `frame` is the first frame
// showing the new value; `t` the exact time (a 16th falls between frames).
export function ticks() {
  if (TICKS) return TICKS;
  const rand = mulberry32(SEED), out = [];
  let cur = {...OPEN};
  const push = (B, d, kind) => {
    cur = {comments:cur.comments + d.comments, reactions:cur.reactions + d.reactions, reposts:cur.reposts + d.reposts};
    out.push({B, t:tOf(B), frame:frameOf(B), ...cur, d, kind});
  };
  // The burst: reactions only, on 8ths (8 soft ticks).
  const burstN = (BURST.to - BURST.from) * 2 + 1;
  allocate(BURST.reactions - OPEN.reactions, burstN, rand).forEach((r, i) => push(BURST.from + i / 2, {comments:0, reactions:r, reposts:0}, 'burst'));
  // The flood: from B22 (the counter starts) to B88.
  let prevB = EVENTS.loaded - .5;
  for (const L of LANDMARKS) {
    const at = [];
    for (let B = prevB + .5; B <= L.B + 1e-9; B += .5) {
      at.push(B);
      if (B >= 74 - 1e-9 && B < 82 - 1e-9) at.push(B + .25);   // 16ths through the wall
    }
    const c = allocate(L.comments - cur.comments, at.length, rand);
    const r = allocate(L.reactions - cur.reactions, at.length, rand);
    const p = sprinkle(L.reposts - cur.reposts, at.length, rand);
    at.forEach((B, i) => push(B, {comments:c[i], reactions:r[i], reposts:p[i]}, 'count'));
    prevB = L.B;
  }
  // Doug: one more.
  push(FINAL.B, {comments:FINAL.comments - cur.comments, reactions:FINAL.reactions - cur.reactions, reposts:FINAL.reposts - cur.reposts}, 'final');
  // Velocity by the log of the step size (comments; reactions for the burst), accents on 340 and 1,204.
  const stepOf = k => k.d.comments || k.d.reactions;
  const maxStep = Math.max(...out.filter(k => k.kind === 'count').map(stepOf));
  for (const k of out) {
    k.step = stepOf(k);
    k.accent = k.d.comments > 0 && ACCENTS.includes(k.comments);
    k.vel = k.kind === 'burst' ? .35 : +(.35 + .45 * Math.min(1, Math.log(k.step) / Math.log(maxStep))).toFixed(4);
  }
  return (TICKS = Object.freeze(out.map(Object.freeze)));
}

// The numbers on screen at frame f.
export function countsAt(frame) {
  const T = ticks();
  let lo = -1, hi = T.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m].frame <= frame) lo = m; else hi = m - 1; }
  if (lo < 0) return {...OPEN};
  return {comments:T[lo].comments, reactions:T[lo].reactions, reposts:T[lo].reposts};
}

// The counts row, as LinkedIn writes it.
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const plural = (n, one, many) => `${comma(n)} ${n === 1 ? one : many}`;
export function countsText({comments, reactions, reposts}) {
  const right = [comments > 0 ? plural(comments, 'comment', 'comments') : null, reposts > 0 ? plural(reposts, 'repost', 'reposts') : null].filter(Boolean).join(' • ');
  return {reactions:comma(reactions), right};
}
// The reaction cluster: three kinds, sorted by count. Celebrate overtakes Like at B40.
export const clusterAt = frame => frame >= frameOf(EVENTS.flip) ? ['celebrate', 'like', 'love'] : ['like', 'celebrate', 'love'];

// ---- The sound's grid -------------------------------------------------------------------------
// One entry per statement of "Congrats on the new role!": the beat its "grats" vowel lands on,
// how many copies sing at once in that wave, and the part. Spec 2 and 5. The sound agent's chart
// (score.js) owns voicing, takes and space; this is the picture's side of the same clock.
export function cues() {
  const out = [];
  const add = (B, copies, part, more = {}) => out.push(Object.freeze({B, t:tOf(B), frame:Math.round(B * BEAT * FPS), copies, part, ...more}));
  add(22, 1, 'voice1', {take:'s1', dry:true, row:WAVES[0].rows[0]});
  add(30, 2, 'wave2', {take:'s2'});
  add(32, 2, 'wave2', {take:'y1'});
  add(38, 3, 'wave3');
  add(44, 4, 'wave4'); add(46, 4, 'wave4');
  add(50, 6, 'wave5'); add(52, 6, 'wave5');
  for (let i = 0; i < 8; i++) add(60 + i / 2, 8, 'wave6', {canon:i});   // the canon marches with the identical rows (the 1x pattern)
  add(64, 8, 'wave7'); add(66, 9, 'wave8'); add(68, 10, 'wave8');
  add(70, 0, 'robot', {choke:true});
  for (let i = 0; i < 16; i++) add(74 + i / 2, 16, 'wall', {entry:i, row:WAVES.at(-1).rows[i]});
  for (let i = 0; i < 6; i++) add(82 + i / 2, 5 - i, 'release');
  // The last line is placed by its first sample, not by "grats": after the choke there is no groove to land on,
  // so the picture leads (Doug's reply, 1,204, its tick) and the voice follows, 67 ms later.
  add(EVENTS.doug, 1, 'final', {take:'s1', dry:true, row:DOUG_ROW, start:tOf(EVENTS.doug) + FINAL_LAG});
  return Object.freeze(out);
}

// ---- The camera --------------------------------------------------------------------------------
// Segments of a(t) (content px; t in s): hold, linear (a credit roll), ease (a quintic with
// position, speed and acceleration at both ends), launch (a cubic Hermite: one beat, eased in),
// settle (an exponential approach that becomes a creep while a special row dwells).
function seg(kind, t0, t1, f, df, more = {}) { return {kind, t0, t1, f, df, ...more}; }
const hold = (t0, t1, a) => seg('hold', t0, t1, () => a, () => 0, {a});
const linear = (t0, t1, a0, v) => seg('linear', t0, t1, t => a0 + v * (t - t0), () => v, {a0, v});
function hermite3(t0, t1, p0, v0, p1, v1, kind = 'launch') {
  const T = t1 - t0, m0 = v0 * T, m1 = v1 * T;
  const f = t => { const s = (t - t0) / T, s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1; };
  const df = t => { const s = (t - t0) / T, s2 = s * s; return ((6 * s2 - 6 * s) * p0 + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * p1 + (3 * s2 - 2 * s) * m1) / T; };
  return seg(kind, t0, t1, f, df, {p0, v0, p1, v1});
}
function quintic(t0, t1, p0, v0, p1, v1, kind = 'ease') {    // zero acceleration at both ends
  const T = t1 - t0, d = p1 - p0, V0 = v0 * T, V1 = v1 * T;
  // p(s) = p0 + V0 s + c3 s^3 + c4 s^4 + c5 s^5 with p(1) = p1, p'(1) = V1, p''(1) = 0.
  const c3 = 10 * d - 6 * V0 - 4 * V1, c4 = -15 * d + 8 * V0 + 7 * V1, c5 = 6 * d - 3 * V0 - 3 * V1;
  const f = t => { const s = (t - t0) / T; return p0 + V0 * s + c3 * s ** 3 + c4 * s ** 4 + c5 * s ** 5; };
  const df = t => { const s = (t - t0) / T; return (V0 + 3 * c3 * s ** 2 + 4 * c4 * s ** 3 + 5 * c5 * s ** 4) / T; };
  return seg(kind, t0, t1, f, df, {p0, v0, p1, v1});
}
function settle(t0, t1, a0, vin, c, target, tAt) {
  // a(t) = A + c (t - t0) - (A - a0) e^{-(t - t0)/τ}, A - a0 = (vin - c) τ  (speed continuous at t0)
  const A = a0 + (vin - c) * TAU;
  const f = t => A + c * (t - t0) - (A - a0) * Math.exp(-(t - t0) / TAU);
  const df = t => c + (A - a0) / TAU * Math.exp(-(t - t0) / TAU);
  return seg('settle', t0, t1, f, df, {a0, vin, c, target, tAt});
}

// How long the settle into a row at tS must be, coming in linearly at v from (tL, aL).
function settleLength(aL, tL, v, c, target, tS) {
  const g = (L) => aL + v * (tS - L - tL) + (v - c) * TAU * (1 - Math.exp(-L / TAU)) + c * L - target;
  let lo = 0, hi = tS - tL + 2;                           // the settle may begin before tL (the wave ends early)
  if (g(lo) < 0) throw Error(`The roll cannot reach the row at ${target} by ${tS.toFixed(3)} s at ${v.toFixed(1)} px/s.`);
  if (g(hi) > 0) throw Error(`The settle into ${target} needs more than ${hi.toFixed(2)} s.`);
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const peakSpeed = (s, n = 60) => { let m = -Infinity; for (let i = 0; i <= n; i++) m = Math.max(m, s.df(s.t0 + (s.t1 - s.t0) * i / n)); return m; };

// The zoom: sine in-out. With the cubic over B73-76 (the first plan) the bottom of the frame moved
// 23 px a frame at B74.5, where the zoom and the wall's 380 px/s add up; starting the pull-back
// during the robot's dwell (B71, when the roll only creeps) and easing by sine keeps every
// point in view under 13 px a frame.
const easeInOut = x => (1 - Math.cos(Math.PI * x)) / 2;
export function kAt(t) {
  const [a0, a1] = EVENTS.pullBack.map(tOf), [b0, b1] = EVENTS.pushIn.map(tOf);
  if (t <= a0) return 1;
  if (t < a1) return 1 + (K_WALL - 1) * easeInOut((t - a0) / (a1 - a0));
  if (t <= b0) return K_WALL;
  if (t < b1) return K_WALL + (1 - K_WALL) * easeInOut((t - b0) / (b1 - b0));
  return 1;
}

const CAMERAS = new WeakMap();
// layout: {rows: {[n]: {top, height}}, loadMore: {top}, counts: {top}} in content px.
// The first wave's first row replaces "Load more comments" at its y.
export function buildCamera(layout) {
  if (CAMERAS.has(layout)) return CAMERAS.get(layout);
  const top = r => { const row = layout.rows[r]; if (!row) throw Error(`The layout has no row ${r}.`); return row.top; };
  const S = [], notes = [];
  const last = () => S[S.length - 1];
  const end = () => { const s = last(); return {t:s.t1, a:s.f(s.t1), v:s.df(s.t1)}; };

  // 1. Still: the thumbnail, "…more", the burst. Content y 0 sits under the top bar (screen y TOP).
  const a0 = READ_Y - TOP;
  S.push(hold(0, tOf(EVENTS.roll), a0));
  // 2. The warm block, read: from rest to each stop and from it to the next with a minimum-jerk
  //    ease (rest to rest), holding at each, then a full stop on "Load more comments" at B20. A move
  //    that would break the speed limit leaves its stop earlier (in 16ths).
  {
    const stops = WARM_STOPS.map(w => ({a:top(w.row) + READ_Y - w.y, at:w.at.map(tOf), row:w.row}));
    stops.push({a:layout.loadMore.top, at:[tOf(EVENTS.loadMore), tOf(EVENTS.loaded)], row:'load'});
    let from = {a:a0, t:tOf(EVENTS.roll)};
    for (let i = 0; i < stops.length; i++) {
      const st = stops[i], D = st.a - from.a;
      // Peak speed of the quintic is 1.875 D / T; start earlier (cutting the previous hold) if it must.
      while (1.875 * D / (st.at[0] - from.t) > VMAX * .98 && i > 0 && from.t - BEAT / 4 > stops[i - 1].at[0] + BEAT) {
        from = {...from, t:from.t - BEAT / 4};
        S[S.length - 1].t1 = from.t;
        notes.push({warmStop:stops[i - 1].row, leavesEarlier:+(stops[i - 1].at[1] - from.t).toFixed(3)});
      }
      S.push(quintic(from.t, st.at[0], from.a, 0, st.a, 0, 'warm'));
      S.push(hold(st.at[0], st.at[1], st.a));
      notes.push({warm:st.row, D:+D.toFixed(1), peak:+(1.875 * D / (st.at[0] - from.t)).toFixed(1)});
      from = {a:st.a, t:st.at[1]};
    }
    S.pop();                                                // the Load more hold is step 3's
  }
  // 3. The press and the spinner: still. Rows 12+ replace the button at the same y.
  S.push(hold(tOf(EVENTS.loadMore), tOf(EVENTS.loaded), layout.loadMore.top));
  const rowTopFirst = top(WAVES[0].rows[0]);
  if (Math.abs(rowTopFirst - layout.loadMore.top) > .5) notes.push({warning:`row ${WAVES[0].rows[0]} top ${rowTopFirst} differs from Load more ${layout.loadMore.top}`});

  // 4. The waves and the specials.
  const specialAfter = new Map(SPECIALS.map(s => [s.row, s]));
  for (let wi = 0; wi < WAVES.length; wi++) {
    const w = WAVES[wi], rows = w.rows, times = rows.map((r, i) => tOf(w.B + i * w.every));
    const speedOut = (top(rows[1]) - top(rows[0])) / (times[1] - times[0]);
    // Into the wave's first row: from rest (wave 1, after the spinner), or the launch out of a special.
    if (wi === 0) {
      // Row 12 is already on the line; launch to row 13 in one beat.
      const e = end();
      S.push(hermite3(e.t, times[1], e.a, 0, top(rows[1]), (top(rows[2]) - top(rows[1])) / (times[2] - times[1])));
    }
    // Linear through the wave's rows (from the first row it does not already reach).
    for (let i = wi === 0 ? 2 : 1; i < rows.length; i++) {
      const v = (top(rows[i]) - top(rows[i - 1])) / (times[i] - times[i - 1]);
      S.push(linear(times[i - 1], times[i], top(rows[i - 1]), v));
    }
    // After the wave: a special row, or (after the wall) the slow-down into Jamie's comment.
    const lastRow = rows[rows.length - 1], sp = specialAfter.get(lastRow + 1);
    if (sp) {
      const tL = times[times.length - 1], aL = top(lastRow), v = last().v ?? end().v, tS = tOf(sp.B);
      const L = settleLength(aL, tL, v, CREEP, top(sp.row), tS);
      const t0 = tS - L;
      // Truncate the wave's linear segments at t0 (the settle may start before the last row).
      while (last().t0 >= t0 - 1e-12) S.pop();
      const lin = last(); if (lin.kind !== 'linear') throw Error(`The settle into row ${sp.row} would start inside a ${lin.kind}.`);
      lin.t1 = t0;
      const a0 = lin.f(t0);
      // A wave row the settle overtakes arrives a little off its grid: noted in arrivals.
      let launchAt = tOf(sp.launch);
      const tN = tOf(sp.next), next = WAVES[wi + 1], nextTop = top(next.rows[0]);
      const vN = (top(next.rows[1]) - top(next.rows[0])) / ((next.every) * BEAT);
      // The launch is one beat, eased in; start it earlier (in 16ths) only if the speed limit needs it.
      let sSettle, sLaunch;
      for (let tries = 0; ; tries++) {
        sSettle = settle(t0, launchAt, a0, v, CREEP, top(sp.row), tS);
        sLaunch = hermite3(launchAt, tN, sSettle.f(launchAt), sSettle.df(launchAt), nextTop, vN);
        if (peakSpeed(sLaunch) <= VMAX - 3 || tries === 4) break;
        launchAt -= BEAT / 4;
      }
      if (launchAt < tOf(sp.launch) - 1e-9) notes.push({row:sp.row, launchEarlier:+(tOf(sp.launch) - launchAt).toFixed(3)});
      S.push(sSettle, sLaunch);
      notes.push({row:sp.row, settle:+L.toFixed(3), launch:+(tN - launchAt).toFixed(3), launchPeak:+peakSpeed(sLaunch).toFixed(1)});
    } else if (w.wall) {
      // Wave 10: keep the wall's speed to B82 (row 74 on the grid), then slow to a full stop with
      // Jamie's comment at END_Y at B88 (a quintic: smooth at both ends), Terri's typo just above it.
      const e = end(), t82 = tOf(DECEL.from);
      S.push(linear(e.t, t82, e.a, e.v));
      const e2 = end();
      S.push(quintic(t82, tOf(DECEL.to), e2.a, e2.v, top(JAMIE_ROW) + READ_Y - END_Y, 0, 'stop'));
    }
  }
  // 5. The end: still; Doug's reply appears under Jamie's at B92.
  S.push(hold(tOf(DECEL.to), DURATION + 1, top(JAMIE_ROW) + READ_Y - END_Y));

  // Continuity (position) and monotonicity.
  for (let i = 1; i < S.length; i++) {
    const p = S[i - 1], q = S[i];
    if (Math.abs(p.t1 - q.t0) > 1e-9) throw Error(`Camera gap between ${p.kind} and ${q.kind} at ${p.t1}.`);
    const jump = Math.abs(p.f(p.t1) - q.f(q.t0));
    if (jump > .01) throw Error(`Camera jumps ${jump.toFixed(3)} px at ${q.t0.toFixed(3)} s (${p.kind} -> ${q.kind}).`);
  }
  const segAt = t => { let lo = 0, hi = S.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].t0 <= t) lo = m; else hi = m - 1; } return S[lo]; };
  const a = t => segAt(t).f(t), v = t => segAt(t).df(t);
  // When each row's top reaches the line (a is monotone: bisection on the frame grid, then exact).
  const arrive = y => {
    if (a(0) >= y) return 0;
    let lo = 0, hi = DURATION;
    if (a(hi) < y - 1e-6) return null;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (a(m) >= y - 1e-6) hi = m; else lo = m; }
    return hi;
  };
  const designed = rowBeats(), arrivals = {};
  for (const r of Object.keys(layout.rows)) {
    const at = arrive(layout.rows[r].top);
    arrivals[r] = {t:at, B:at === null ? null : +(at / BEAT).toFixed(4), designedB:designed[r] ?? null};
  }
  const cam = {segments:S, a, v, k:kAt, arrivals, notes, arrive};
  CAMERAS.set(layout, cam);
  return cam;
}

// ---- The picture at time t ----------------------------------------------------------------------
export function frameAt(t, layout) {
  const cam = buildCamera(layout), frame = Math.round(t * FPS);
  const a = cam.a(t), k = kAt(t), counts = countsAt(frame);
  const fPress = frameOf(EVENTS.press), fLoaded = frameOf(EVENTS.loaded);
  const loadMore = frame < fPress ? 'idle' : frame < fPress + PRESS_FRAMES ? 'pressed' : frame < fLoaded ? 'loading' : 'done';
  // The counts row pins once its top reaches the bottom of the top bar.
  const countsY = READ_Y + (layout.counts.top - a) * k;
  return {
    t, frame, B:t / BEAT, a, k, speed:cam.v(t) * k,
    expanded:frame >= frameOf(EVENTS.more),
    counts, text:countsText(counts), cluster:clusterAt(frame),
    loadMore, spinner:loadMore === 'loading' ? Math.round((frame - fPress - PRESS_FRAMES) / FPS * 360) % 360 : 0,   // a turn a second
    loaded:frame >= fLoaded,
    doug:frame >= frameOf(EVENTS.doug),
    sticky:countsY <= TOP,
  };
}
