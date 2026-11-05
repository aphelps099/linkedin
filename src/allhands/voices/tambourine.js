// A synthesized tambourine: a wooden frame with pairs of metal jingles. Modal
// synthesis, offline, seeded: no samples.
//
// Each jingle pair is two thin dished discs that strike each other. A disc is a
// bank of seven damped resonators at inharmonic ratios (1, 1.43, 1.79, 2.28,
// 2.71, 3.2, 3.83) from a base between 3.3 and 4.8 kHz, so its partials spread
// from about 3.3 to 18 kHz, falling about 4 dB an octave and ringing
// 85 ms (lowest) to 45 ms (highest); the two discs of a pair sit 0.4 to 1.1%
// apart, so every pair beats. A collision excites both
// discs of its pair with a 3-sample burst plus a 1 ms click of high noise.
//   shake  the frame moves: each pair collides several times over 40 to 90 ms,
//          the hits bunched a third of the way in, with a faint swish of
//          5-11 kHz noise (the jingles sliding on their pins).
//   hit    a palm on the head: a membrane thump (two damped sines near 190 and
//          310 Hz), every pair at once within 3 ms, then a rattle that dies in
//          about 80 ms.
import {rng} from './melody.js';

const RATIOS = [1, 1.43, 1.79, 2.28, 2.71, 3.2, 3.83];

export function makeTambourine({sampleRate = 44100, seed = 11, pairs = 6} = {}) {
  const R = rng(seed), sr = sampleRate;
  const set = Array.from({length:pairs}, (_, p) => {
    const base = 3300 + 1500 * (p + R() * .8) / pairs;
    const detune = .004 + .007 * R();
    return [1 - detune / 2, 1 + detune / 2].map(k => RATIOS.map((ratio, m) => {
      const f = base * k * ratio * (1 + .012 * (R() - .5));
      if (f > sr * .45) return null;
      const tau = .085 * ratio ** -.45 * (.8 + .4 * R());           // the pins damp them: 85 ms down to 45 ms
      const w = 2 * Math.PI * f / sr;
      return {f, r:Math.exp(-1 / (tau * sr)), gain:(.6 + .4 * R()) * ratio ** -.6 * Math.sin(w)};   // sin(w): unit ring per strike
    }).filter(Boolean));
  });
  return {sr, pairs, set, R};
}

// Events: [{t (s), type:'shake'|'hit', v (0..1)}]. Returns mono Float32Array.
export function renderTambourine(tamb, events, duration) {
  const {sr, set, R} = tamb, n = Math.ceil(duration * sr);
  const exc = set.map(() => new Float32Array(n)), direct = new Float32Array(n);
  const hitAt = (p, t, a) => {
    const i = Math.round(t * sr);
    if (i < 0 || i + 3 >= n) return;
    const e = exc[p];
    e[i] += a; e[i + 1] -= .6 * a; e[i + 2] += .25 * a;
    const L = Math.round(.0012 * sr), M = Math.round(.004 * sr);
    let prev = 0, low = 0;
    for (let j = 0; j < M && i + j < n; j++) {                  // the click: high-passed noise, and a duller 4 ms chk under it
      const w = R() * 2 - 1, hp = w - prev; prev = w;
      low = .7 * low + .3 * w;
      direct[i + j] += (j < L ? .12 * a * hp * (1 - j / L) : 0) + .15 * a * low * (1 - j / M);
    }
  };
  for (const ev of events) {
    const v = ev.v ?? .7;
    if (ev.type === 'hit') {
      set.forEach((_, p) => hitAt(p, ev.t + .003 * R(), v * (.8 + .2 * R())));
      set.forEach((_, p) => {
        const k = 3 + Math.floor(4 * R());
        for (let c = 0; c < k; c++) { const dt = .008 + .075 * R() ** 1.6; hitAt(p, ev.t + dt, v * .45 * (1 - dt / .09) * (.5 + .5 * R())); }
      });
      // the membrane
      const i0 = Math.round(ev.t * sr);
      for (const [f, tau, g] of [[190, .045, .22], [310, .03, .14], [95, .06, .1]]) {
        for (let j = 0; j < Math.round(tau * 6 * sr) && i0 + j < n; j++) {
          if (i0 + j < 0) continue;
          direct[i0 + j] += v * g * Math.exp(-j / (tau * sr)) * Math.sin(2 * Math.PI * f * j / sr) * Math.min(1, j / 20);
        }
      }
    } else {
      const D = .04 + .05 * R() * (.5 + v / 2);
      set.forEach((_, p) => {
        const k = 2 + Math.floor((3 + 6 * v) * R());
        for (let c = 0; c < k; c++) {
          const u = (R() + R() + R()) / 3 * .9;                   // bunched a third of the way in
          hitAt(p, ev.t + D * u * u * 1.6, v * (.25 + .75 * R()) * .6);
        }
      });
      // the swish: noise, band-passed by a difference of one-poles, under a sine envelope
      const i0 = Math.round(ev.t * sr), L = Math.round(D * 1.3 * sr);
      let lo = 0, hi = 0;
      const aLo = Math.exp(-2 * Math.PI * 11000 / sr), aHi = Math.exp(-2 * Math.PI * 5000 / sr);
      for (let j = 0; j < L && i0 + j < n; j++) {
        if (i0 + j < 0) continue;
        const w = R() * 2 - 1;
        lo = (1 - aLo) * w + aLo * lo; hi = (1 - aHi) * w + aHi * hi;
        direct[i0 + j] += .05 * v * (lo - hi) * Math.sin(Math.PI * j / L) ** 2;
      }
    }
  }
  const y = Float32Array.from(direct);
  set.forEach((discs, p) => {
    for (const modes of discs) for (const {f, r, gain} of modes) {
      const c = 2 * r * Math.cos(2 * Math.PI * f / sr), r2 = r * r, e = exc[p];
      let y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const v = c * y1 - r2 * y2 + e[i];
        y2 = y1; y1 = v;
        y[i] += .08 * gain * v;
      }
    }
  });
  return y;
}

// A groove: per 16th, the shake velocity (0 = none); `hits` are 16th indexes
// struck instead. Timing breathes by up to `humanize` seconds.
export function tambourinePattern({bars, step, swing = 0, shakes = [.32, .16, .78, .26], hits = [], humanize = .004, seed = 3, every = 1}) {
  const R = rng(seed), events = [];
  for (let s = 0; s < bars * 16; s++) {
    const t = s * step + (s % 2 ? swing * step : 0) + (R() - .5) * 2 * humanize;
    const inBar = s % 16;
    if (hits.includes(inBar) && Math.floor(s / 16) % every === every - 1) events.push({t:Math.max(0, t), type:'hit', v:.8});
    else {
      const v = shakes[s % shakes.length];
      if (v > 0) events.push({t:Math.max(0, t), type:'shake', v:v * (.88 + .24 * R())});
    }
  }
  return events;
}
