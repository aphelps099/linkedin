// The pixel voice: Strategy and Synthia sung without the vocoder.
//
// Pure functions on Float32Array (no Web Audio, no Node APIs), so the same code
// bakes takes offline (scripts/render-song-voices.mjs) and in the page at song
// prepare time, the way lady.js bakes her deep voice. Deterministic: the same
// input and options give the same samples.
//
// The chain, in order (see README.md "The pixel chain"):
//   1. analyse   YIN f0 on a 4x decimated copy, 5 ms frames; pitch marks on the
//                glottal peaks of the full-rate signal.
//   2. place     TD-PSOLA onto a note contour in a key, one note per syllable
//                nucleus. Each grain is two periods of the source, so the
//                formants stay where the speaker put them (no chipmunk, no
//                growl) while the pitch lands on the note. Vowels sit flat on
//                their notes; onsets and codas keep their spoken motion,
//                transposed. `step` holds the analysis position for a few ms at
//                a time in voiced stretches: the voice's spectrum moves in
//                frames, like a picture at a low frame rate (granular
//                stepping). Unvoiced consonants are never held.
//   3. decimate  zero-order hold at `rate` Hz, sweepable; `antialias` 1 filters
//                first (clean, only the hold's images), 0 lets it alias (the
//                pixel sizzle).
//   4. crush     bit reduction to `bits` (fractional bits allowed), no dither,
//                with a shared power-of-two scale per 4 ms block (a coarse
//                floating point, as early samplers had), so the grain follows
//                the level instead of gating quiet sounds.
//                3 and 4 land on the vowels: in the consonants (unvoiced, or
//                voiced but fricated, as z and v) `consonants` of the clean
//                take is mixed back, so the words stay words.
//   5. space     a short tape echo (wow, a dark loop, soft saturation) that
//                ducks under the voice, widened by a gentle two-voice chorus;
//                the voice itself stays dry and centred (mono-safe). The engine
//                may do these live instead; the bank never bakes them.
//
// Steps 1-4 never move a sample in time, so the manifest's word boundaries hold
// for the processed take.

export const midiHz = m => 440 * 2 ** ((m - 69) / 12);
export const hzMidi = f => 69 + 12 * Math.log2(f / 440);

// ---------------------------------------------------------------- small filters
// RBJ biquad, direct form I, in place on a copy.
function biquad(x, sr, type, f, q = .7071) {
  const w = 2 * Math.PI * Math.min(f, sr * .49) / sr, c = Math.cos(w), a = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'low') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = B0 * x[i] + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
export const lowpass = (x, sr, f, q) => biquad(x, sr, 'low', f, q);
export const highpass = (x, sr, f, q) => biquad(x, sr, 'high', f, q);
// Butterworth-ish 4th order: two cascaded sections.
const lowpass4 = (x, sr, f) => lowpass(lowpass(x, sr, f, .5412), sr, f, 1.3066);

// ---------------------------------------------------------------- 1. analysis
// YIN (de Cheveigne and Kawahara 2002) on a copy decimated to about 11 kHz:
// the first dip of the normalised difference below `threshold`, else its global
// minimum if that is below `loose` (Kokoro's am_onyx is low and often creaky;
// a strict threshold left half his vowels unvoiced). Returns {hop, offset,
// f0:Float32Array (0 = unvoiced), rms} per frame; frame k is centred on
// k * hop + offset seconds.
export function pitchTrack(x, sr, {fmin = 60, fmax = 420, hop = .005, window = .032, threshold = .3, loose = .42, gateDb = -45} = {}) {
  const dec = Math.max(1, Math.floor(sr / 11025)), r = sr / dec;
  const lp = lowpass4(x, sr, Math.min(3000, r * .45));
  const n = Math.floor(lp.length / dec), y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = lp[i * dec];
  const W = Math.round(window * r), tauMin = Math.floor(r / fmax), tauMax = Math.ceil(r / fmin);
  const H = hop * r, frames = Math.max(0, Math.floor((n - W - tauMax) / H) + 1);
  const f0 = new Float32Array(frames), rms = new Float32Array(frames), d = new Float64Array(tauMax + 2);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const gate = peak * 10 ** (gateDb / 20);
  for (let k = 0; k < frames; k++) {
    const s = Math.round(k * H);
    let e = 0;
    for (let j = 0; j < W; j++) e += y[s + j] * y[s + j];
    rms[k] = Math.sqrt(e / W);
    if (rms[k] < gate) continue;
    d[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) { const v = y[s + j] - y[s + j + tau]; sum += v * v; }
      run += sum;
      d[tau] = run > 0 ? sum * tau / run : 1;
    }
    let best = -1, gmin = tauMin;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (d[tau] < d[gmin]) gmin = tau;
      if (d[tau] < threshold && d[tau] <= d[tau + 1]) { best = tau; break; }
    }
    if (best < 0 && d[gmin] < loose && gmin > tauMin && gmin < tauMax) best = gmin;
    if (best < 0) continue;
    const a = d[best - 1], b = d[best], c = d[best + 1], den = a - 2 * b + c;
    const t = den ? best + .5 * (a - c) / den : best;
    f0[k] = r / t;
  }
  // Clean the track: a 5-frame median, octave slips pulled back to the local
  // median, voiced runs shorter than 25 ms dropped.
  const med = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    const v = [];
    for (let j = k - 2; j <= k + 2; j++) if (j >= 0 && j < frames && f0[j] > 0) v.push(f0[j]);
    if (!f0[k] || v.length < 2) { med[k] = f0[k]; continue; }
    v.sort((p, q) => p - q);
    const m = v[v.length >> 1];
    let f = f0[k];
    if (f > m * 1.7) f /= 2; else if (f < m * .6) f *= 2;
    med[k] = f;
  }
  for (let k = 0; k < frames;) {
    if (!med[k]) { k++; continue; }
    let e = k;
    while (e < frames && med[e]) e++;
    if ((e - k) * hop < .025) for (let j = k; j < e; j++) med[j] = 0;
    k = e;
  }
  return {hop, offset:window / 2, f0:med, rms};
}

// Pitch marks: one per glottal period in voiced runs (on the strongest peak of
// a 1.2 kHz low-passed copy, polarity chosen per run), and every 1/150 s in
// unvoiced stretches. Each mark: {pos (samples), period (samples), voiced}.
export function pitchMarks(x, sr, track) {
  const {hop, f0} = track, off = track.offset ?? 0, lp = lowpass(lowpass(x, sr, 1200), sr, 1200), marks = [];
  const UNV = Math.round(sr / 150), N = x.length;
  const periodAt = t => { const k = Math.min(f0.length - 1, Math.max(0, Math.round((t / sr - off) / hop))); return f0[k] ? sr / f0[k] : 0; };
  // voiced runs in samples: frame k covers its centre +- half a hop
  const runs = [];
  for (let k = 0; k < f0.length;) {
    if (!f0[k]) { k++; continue; }
    let e = k;
    while (e < f0.length && f0[e]) e++;
    runs.push([Math.max(0, Math.round((k * hop + off - hop / 2) * sr)), Math.min(N, Math.round(((e - 1) * hop + off + hop / 2) * sr))]);
    k = e;
  }
  let cursor = 0;
  const unvoiced = (a, b) => { for (let p = a; p < b; p += UNV) marks.push({pos:p, period:UNV, voiced:false}); };
  for (const [a, b] of runs) {
    if (a > cursor) unvoiced(cursor, a);
    let mx = 0, mn = 0;
    for (let i = a; i < b; i++) { if (lp[i] > mx) mx = lp[i]; if (lp[i] < mn) mn = lp[i]; }
    const sign = mx >= -mn ? 1 : -1;
    let T = periodAt(a) || UNV, p = a, best = a;
    for (let i = a; i < Math.min(b, a + T); i++) if (sign * lp[i] > sign * lp[best]) best = i;
    p = best;
    while (p < b) {
      T = periodAt(p) || T;
      marks.push({pos:p, period:T, voiced:true});
      const lo = Math.round(p + .7 * T), hi = Math.round(p + 1.3 * T);
      if (lo >= b) break;
      let q = lo, score = -Infinity;
      for (let i = lo; i <= Math.min(hi, N - 1); i++) {
        const dist = Math.abs(i - (p + T)) / T;                 // prefer the expected spot
        const s = sign * lp[i] - .35 * dist * Math.abs(mx - mn);
        if (s > score) { score = s; q = i; }
      }
      p = q;
    }
    cursor = Math.max(cursor, p + Math.round(T));
  }
  if (cursor < N) unvoiced(cursor, N);
  // local period from neighbouring voiced marks
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (!m.voiced) continue;
    const l = marks[i - 1], r = marks[i + 1];
    const gaps = [];
    if (l?.voiced) gaps.push(m.pos - l.pos);
    if (r?.voiced) gaps.push(r.pos - m.pos);
    if (gaps.length) m.period = Math.max(sr / 500, Math.min(sr / 55, gaps.reduce((s, g) => s + g, 0) / gaps.length));
  }
  return marks;
}

// options.track: a stored pitch track (voice-table.js trackOf) skips YIN, the
// costly part (about 60 ms per second of audio in Node; the marks take 5).
export function analyse(x, sr, options = {}) {
  const track = options.track || pitchTrack(x, sr, options);
  return {track, marks:pitchMarks(x, sr, track)};
}

// ---------------------------------------------------------------- 2. placement
// A note contour: notes = [{from, to, midi}] in seconds of the take (input time),
// one per syllable nucleus, in order. Between notes the pitch moves in `glide`
// seconds (centred on the midpoint between nuclei); before the first and after
// the last it holds. Inside a nucleus `keep` keeps that fraction of the
// speaker's own intonation around the note (0 = flat on the note, the pixel
// staircase); outside the nuclei (the consonants and codas between vowels)
// `keepOutside` does, ramping over `glide`: 1 lets an onset or a coda move as
// she said it, transposed to the note, so the vowel sings and the consonants
// still speak. `vibrato` {cents, hz, after} blooms in on held notes.
export function contour(notes, {glide = .02, keep = 0, keepOutside = 0, vibrato = null, natural = null} = {}) {
  const ns = [...notes].sort((a, b) => a.from - b.from);
  const bounds = ns.slice(1).map((n, i) => (ns[i].to + n.from) / 2);
  const ref = natural ? ns.map(n => natural.median(n.from, n.to)) : [];
  return t => {
    let i = 0;
    while (i < bounds.length && t >= bounds[i]) i++;
    let m = ns[i].midi;
    if (glide > 0) {
      if (i > 0 && t < bounds[i - 1] + glide / 2) {
        const u = (t - (bounds[i - 1] - glide / 2)) / glide;
        m = ns[i - 1].midi + (ns[i].midi - ns[i - 1].midi) * smooth(u);
      } else if (i < bounds.length && t > bounds[i] - glide / 2) {
        const u = (t - (bounds[i] - glide / 2)) / glide;
        m = ns[i].midi + (ns[i + 1].midi - ns[i].midi) * smooth(u);
      }
    }
    const n = ns[i], out = t < n.from ? n.from - t : t > n.to ? t - n.to : 0;
    const k = keep + (keepOutside - keep) * smooth(glide > 0 ? out / glide : out > 0 ? 1 : 0);
    if (k && natural && ref[i]) {
      const f = natural.at(t);
      if (f) m += k * (hzMidi(f) - hzMidi(ref[i]));
    }
    if (vibrato) {
      const held = t - n.from - (vibrato.after ?? .18);
      if (held > 0) m += (vibrato.cents / 100) * Math.min(1, held / .25) * Math.sin(2 * Math.PI * vibrato.hz * held);
    }
    return midiHz(m);
  };
}
const smooth = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

// The speaker's own pitch as a function of time, for `keep`.
export function naturalPitch(track) {
  const {hop, f0} = track, off = track.offset ?? 0;
  return {
    at:t => f0[Math.min(f0.length - 1, Math.max(0, Math.round((t - off) / hop)))] || 0,
    median(a, b) {
      const v = [];
      for (let k = Math.max(0, Math.floor((a - off) / hop)); k <= Math.min(f0.length - 1, Math.ceil((b - off) / hop)); k++) if (f0[k]) v.push(f0[k]);
      v.sort((p, q) => p - q);
      return v.length ? v[v.length >> 1] : 0;
    },
  };
}

// TD-PSOLA. `target(t)` gives Hz at input time t (seconds). `step` (s) holds the
// analysis position in voiced stretches (granular stepping); 0 = off.
export function place(x, sr, analysis, target, {step = 0} = {}) {
  const {marks} = analysis, y = new Float32Array(x.length);
  if (!marks.length) return y.set(x), y;
  const pos = marks.map(m => m.pos);
  const nearest = t => {
    let lo = 0, hi = pos.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pos[mid] <= t) lo = mid; else hi = mid; }
    return Math.abs(pos[lo] - t) <= Math.abs(pos[hi] - t) ? lo : hi;
  };
  const S = Math.round(step * sr);
  let ts = marks[0].pos;
  while (ts < x.length) {
    let k = nearest(ts), m = marks[k];
    if (m.voiced && S > 0) {
      const held = nearest(Math.floor(ts / S) * S);
      if (marks[held].voiced) { k = held; m = marks[k]; }
    }
    const Pa = m.period;
    let Po = Pa, gain = 1;
    if (m.voiced) {
      const f = target(ts / sr);
      Po = Math.max(sr / 900, Math.min(sr / 40, sr / f));
      gain = Math.sqrt(Po / Pa);
    }
    const L = Math.round(Pa), c = m.pos;
    for (let j = -L; j <= L; j++) {
      const src = c + j, dst = Math.round(ts) + j;
      if (src < 0 || src >= x.length || dst < 0 || dst >= y.length) continue;
      const w = .5 + .5 * Math.cos(Math.PI * j / L);
      y[dst] += gain * w * x[src];
    }
    ts += Po;
  }
  return y;
}

// ---------------------------------------------------------------- 3-4. pixels
// Zero-order hold at `rate` Hz. antialias 0..1: 1 low-passes at rate/2 first.
export function decimate(x, sr, rate, {antialias = 0} = {}) {
  if (!rate || rate >= sr) return Float32Array.from(x);
  let src = x;
  if (antialias > 0) {
    const f = rate / 2 * (1 + 3 * (1 - antialias));
    if (f < sr * .45) src = lowpass4(x, sr, f);
  }
  const y = new Float32Array(x.length), inc = rate / sr;
  let ph = 1, hold = 0;
  for (let i = 0; i < x.length; i++) {
    ph += inc;
    if (ph >= 1) { ph -= 1; hold = src[i]; }
    y[i] = hold;
  }
  return y;
}

// Quantise to 2^bits levels. No dither. With `block` (seconds) the scale is
// set per block, as a power of two at or above the block's peak (a floating
// point sample with a shared exponent, as early samplers and NICAM did): the
// steps follow the level, so a quiet l or v keeps its shape under the grain.
// Without it the steps are fixed across [-peak, peak] and quiet tails gate.
export function crush(x, bits, {peak = null, block = 0, sr = 44100} = {}) {
  if (!bits || bits >= 16) return Float32Array.from(x);
  const y = new Float32Array(x.length), half = 2 ** (bits - 1);
  if (block > 0) {
    const B = Math.max(8, Math.round(block * sr));
    for (let i = 0; i < x.length; i += B) {
      let p = 0;
      const end = Math.min(x.length, i + B);
      for (let j = i; j < end; j++) p = Math.max(p, Math.abs(x[j]));
      if (!p) continue;
      const q = half / 2 ** Math.ceil(Math.log2(p));
      for (let j = i; j < end; j++) y[j] = Math.round(x[j] * q) / q;
    }
    return y;
  }
  let p = peak;
  if (!p) { p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); }
  if (!p) return Float32Array.from(x);
  const q = half / p;
  for (let i = 0; i < x.length; i++) y[i] = Math.round(x[i] * q) / q;
  return y;
}

// ---------------------------------------------------------------- 5. space
// A short tape echo: one head, wow on the delay time, a dark loop, soft saturation.
// Returns a longer buffer (the tail).
export function tapeEcho(x, sr, {time = .139, feedback = .3, mix = .2, tone = 2800, wow = .0012, wowHz = .55, tail = 1.2, wetOnly = false} = {}) {
  const n = x.length + Math.round(tail * sr), y = new Float32Array(n), buf = new Float32Array(Math.ceil((time + wow * 2 + .01) * sr) + 4);
  const a = Math.exp(-2 * Math.PI * tone / sr);
  let w = 0, lpS = 0;
  for (let i = 0; i < n; i++) {
    const d = (time + wow * Math.sin(2 * Math.PI * wowHz * i / sr)) * sr;
    let r = w - d;
    while (r < 0) r += buf.length;
    const i0 = Math.floor(r), fr = r - i0, s0 = buf[i0 % buf.length], s1 = buf[(i0 + 1) % buf.length];
    const tap = s0 + (s1 - s0) * fr;
    lpS = (1 - a) * tap + a * lpS;
    const dry = i < x.length ? x[i] : 0;
    buf[w] = dry + Math.tanh(feedback * lpS * 1.2) / 1.2;
    w = (w + 1) % buf.length;
    y[i] = (wetOnly ? 0 : dry) + mix * lpS;
  }
  return y;
}

// A gentle chorus: two modulated taps, 11 and 16 ms, panned apart. [L, R].
export function chorus(x, sr, {mix = .22, depth = .0017, rates = [.31, .47], delays = [.011, .016]} = {}) {
  const L = Float32Array.from(x), R = Float32Array.from(x);
  rates.forEach((hz, v) => {
    const out = v % 2 ? R : L, other = v % 2 ? L : R;
    for (let i = 0; i < x.length; i++) {
      const d = (delays[v] + depth * Math.sin(2 * Math.PI * hz * i / sr + v * 1.7)) * sr, r = i - d;
      if (r < 0) continue;
      const i0 = Math.floor(r), fr = r - i0, s = x[i0] + ((x[i0 + 1] ?? 0) - x[i0]) * fr;
      out[i] += mix * s;
      other[i] += mix * .35 * s;
    }
  });
  const g = 1 / (1 + mix * 1.35);
  for (let i = 0; i < x.length; i++) { L[i] *= g; R[i] *= g; }
  return [L, R];
}

// ---------------------------------------------------------------- the sweep
// One knob, `amount` 0..1, sweeps every pixel parameter together. The three
// named amounts are the ones measured in README.md.
export const AMOUNTS = {light:.3, medium:.6, heavy:.9};

export function pixelParams(amount) {
  const a = Math.min(1, Math.max(0, amount));
  return {
    amount:a,
    rate:Math.round(16000 * (6400 / 16000) ** a),      // .3: 12.0 kHz, .6: 9.2 kHz, .9: 7.0 kHz
    antialias:+(1 - a).toFixed(2),
    bits:+(12 - 5.3 * a).toFixed(2),                    // .3: 10.4, .6: 8.8, .9: 7.2
    step:+(.0245 * a).toFixed(4),                       // .3: 7.4 ms, .6: 14.7 ms, .9: 22 ms
    keep:+(.2 * (1 - a)).toFixed(3),                    // .3: .14, .9: .02 of her own intonation on the vowel
    keepOutside:1,                                      // onsets and codas move as spoken, transposed
    glide:+(.035 - .025 * a).toFixed(4),                // .3: 28 ms, .9: 13 ms
    consonants:+(1 - .5 * a).toFixed(2),                // .3: .85, .6: .7, .9: .55 of the clean consonant
    block:.004,                                         // the crush's shared exponent, per 4 ms
  };
}

// 1 on vowels (voiced and not fricated), 0 in consonants and silence, with
// `ramp` s edges. A voiced stretch counts as fricated (z, v, the burst of a d)
// where more than `hf` of a 5 ms frame's energy is above 3.5 kHz.
export function vowelMask(x, marks, sr, {ramp = .006, hf = .22} = {}) {
  const n = x.length, m = new Float32Array(n), R = Math.max(1, Math.round(ramp * sr));
  for (let k = 0; k < marks.length; k++) {
    if (!marks[k].voiced) continue;
    const a = Math.round(marks[k].pos - marks[k].period / 2), b = Math.round(marks[k].pos + marks[k].period / 2);
    for (let i = Math.max(0, a); i < Math.min(n, b); i++) m[i] = 1;
  }
  const hi = highpass(highpass(x, sr, 3500), sr, 3500), F = Math.round(.005 * sr);
  for (let i = 0; i < n; i += F) {
    let e = 0, h = 0;
    const end = Math.min(n, i + F);
    for (let j = i; j < end; j++) { e += x[j] * x[j]; h += hi[j] * hi[j]; }
    if (e > 0 && h / e > hf) for (let j = i; j < end; j++) m[j] = 0;
  }
  // raised-cosine edges, both ways
  const out = Float32Array.from(m);
  for (let i = 1; i < n; i++) if (m[i] && !m[i - 1]) for (let j = 1; j <= R && i - j >= 0; j++) out[i - j] = Math.max(out[i - j], .5 + .5 * Math.cos(Math.PI * j / R));
  for (let i = 0; i < n - 1; i++) if (m[i] && !m[i + 1]) for (let j = 1; j <= R && i + j < n; j++) out[i + j] = Math.max(out[i + j], .5 + .5 * Math.cos(Math.PI * j / R));
  return out;
}

// The whole chain on one take. `notes` as for contour(); null keeps the
// speaker's pitch (decimate and crush only). Returns {samples, params}.
// `space` adds the echo and chorus and returns stereo {left, right}.
// The pixels land on the vowels: in consonants the clean (placed) take is
// mixed back by `consonants` (1 = consonants untouched), so the s, t, d and v
// that carry the words survive the decimation and the bits.
export function pixelate(x, sr, {notes = null, amount = .6, analysis = null, space = null, vibrato = null, ...over} = {}) {
  const p = {...pixelParams(amount), ...over};
  const an = analysis || analyse(x, sr);
  let y = Float32Array.from(x);
  if (notes && notes.length) {
    const natural = naturalPitch(an.track);
    y = place(x, sr, an, contour(notes, {glide:p.glide, keep:p.keep, keepOutside:p.keepOutside, natural, vibrato}), {step:p.step});
  }
  let peak = 0;
  for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (p.amount > 0) {
    const clean = y;
    y = decimate(y, sr, p.rate, {antialias:p.antialias});
    y = crush(y, p.bits, {peak, block:p.block, sr});
    if (p.consonants > 0) {
      const mask = vowelMask(x, an.marks, sr);
      for (let i = 0; i < y.length; i++) { const c = (1 - mask[i]) * p.consonants; y[i] = c * clean[i] + (1 - c) * y[i]; }
    }
  }
  if (!space) return {samples:y, params:p};
  // The chorus widens only the echo: the voice itself stays one clean, centred
  // voice, so it survives a mono phone speaker (a chorus on the voice combs it
  // in mono, and Whisper heard "Grateful" as "Great fight").
  // The echo ducks under the voice (`duck`, default .85 of its level while she
  // sings, down to her final s; 5 ms attack, 250 ms release), so its repeats
  // speak in the gaps: an
  // undocked dotted 8th landed "Grate-" on "-ful" and Whisper heard "Great fight".
  const wet = tapeEcho(y, sr, {...space.echo, wetOnly:true});
  const depth = space.duck ?? .85;
  if (depth > 0) {
    const att = Math.exp(-1 / (.005 * sr)), rel = Math.exp(-1 / (.25 * sr));
    let env = 0, top = 0;
    const e = new Float32Array(wet.length);
    for (let i = 0; i < wet.length; i++) { const v = i < y.length ? Math.abs(y[i]) : 0; env = v > env ? att * env + (1 - att) * v : rel * env + (1 - rel) * v; e[i] = env; top = Math.max(top, env); }
    for (let i = 0; i < wet.length; i++) wet[i] *= 1 - depth * Math.min(1, e[i] / (.12 * top || 1));
  }
  const [left, right] = chorus(wet, sr, space.chorus || {});
  for (let i = 0; i < y.length; i++) { left[i] += y[i]; right[i] += y[i]; }
  return {left, right, params:p};
}
