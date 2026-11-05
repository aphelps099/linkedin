// A 20 s direction sketch, not a song: the pixel voices wandering over a Panda
// Bear-lane loop (Offsite's key and tempo: D major, 108 BPM, Dadd9 and G6/9,
// the changes an 8th early), with the synthesized tambourine shaking in it.
// Offline and seeded. Everything here is plain JS on Float32Arrays.
//
// The loop is two bars, rendered once and tiled, as a sampled loop would be:
// soft even stomps on the beats, a few people clapping on two and four, floor
// toms on the "e" and the "and" (never on the beat), the tambourine on 16ths
// leaning on the "and"s with a strike on four every other bar. Under it a pump
// organ drone and Pat humming the root on the offbeats, both pumped by the
// stomps. Over it Synthia and Strategy sing LinkedIn, one syllable per note, a
// line that keeps wandering from phrase to phrase in each voice's register;
// Synthia is doubled a pentatonic step up, panned. Then three couplets as call
// and response, and the two questions. An 8th-note tape echo and a long room.
import {pixelate, lowpass, highpass, midiHz} from './pixel.js';
import {makeTambourine, renderTambourine, tambourinePattern} from './tambourine.js';
import {rng, scaleNotes} from './melody.js';

const BPM = 108, STEP = 60 / BPM / 4, BAR = 16 * STEP, BARS = 9;   // 9 bars = 20.0 s

const CHORDS = {D:{root:38, keys:[50, 54, 57, 62, 64]}, G:{root:43, keys:[50, 55, 59, 64, 69]}};
const PROGRESSION = ['D', 'D', 'G', 'G', 'D', 'D', 'G', 'G', 'D'];

// Voice cues: bar, 16th, take id; the first vowel lands on the 16th.
const CUES = [
  [1, 0, 'synthia/humbled-to-announce'], [1, 10, 'strategy/proud'],
  [2, 0, 'synthia/thrilled-to-share'], [2, 10, 'strategy/grateful'],
  [3, 0, 'synthia/learnings'], [3, 6, 'synthia/delve'], [3, 10, 'strategy/north-star'],
  [4, 0, 'synthia/game-changer'], [4, 8, 'strategy/unpopular-opinion'],
  [5, 0, 'strategy/burnout-bandwidth-call'], [5, 8, 'synthia/burnout-bandwidth-response'],
  [6, 0, 'strategy/overtime-ownership-call'], [6, 8, 'synthia/overtime-ownership-response'],
  [7, 0, 'strategy/layoff-launch-call'], [7, 8, 'synthia/layoff-launch-response'],
  [8, 0, 'synthia/agree'], [8, 6, 'strategy/thoughts'],
];
const AMOUNT = {synthia:.45, strategy:.6};

// ---------------------------------------------------------------- the room
// An 8-line feedback delay network, Householder mixing, damped lines.
function room(L, R, sr, {decay = 2.6, damp = 5200, pre = .022} = {}) {
  const ms = [29.7, 37.1, 41.1, 43.7, 53.3, 59.9, 67.1, 73.3], N = ms.length;
  const len = ms.map(m => Math.round(m / 1000 * sr)), bufs = len.map(n => new Float32Array(n)), idx = new Array(N).fill(0);
  const g = len.map(n => 10 ** (-3 * n / (decay * sr))), a = Math.exp(-2 * Math.PI * damp / sr), lp = new Float32Array(N);
  const P = Math.round(pre * sr), n = L.length, oL = new Float32Array(n), oR = new Float32Array(n), out = new Float32Array(N);
  for (let i = 0; i < n; i++) {
    const inp = i >= P ? (L[i - P] + R[i - P]) * .5 : 0;
    let sum = 0;
    for (let k = 0; k < N; k++) { const v = bufs[k][idx[k]]; lp[k] = (1 - a) * v + a * lp[k]; out[k] = lp[k] * g[k]; sum += out[k]; }
    const h = 2 / N * sum;
    let l = 0, r = 0;
    for (let k = 0; k < N; k++) {
      bufs[k][idx[k]] = out[k] - h + inp * (k % 2 ? -.35 : .35);
      idx[k] = (idx[k] + 1) % len[k];
      if (k % 2) r += out[k]; else l += out[k];
    }
    oL[i] = l * .5; oR[i] = r * .5;
  }
  return [oL, oR];
}

// RMS of the 50 ms frames within 30 dB of the loudest, dB (stereo summed to mono).
function activeDb([L, R]) {
  const F = 2205, e = [];
  for (let i = 0; i + F <= L.length; i += F) { let s = 0; for (let j = i; j < i + F; j++) s += ((L[j] + R[j]) / 2) ** 2; e.push(s / F); }
  const top = Math.max(...e), act = e.filter(v => v > top / 1000);
  return 10 * Math.log10(act.reduce((a, b) => a + b, 0) / act.length + 1e-20);
}

const add = (dst, src, at, gain = 1, pan = 0, sr = 44100) => {
  const o = Math.round(at * sr), gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  const [L, R] = dst, [sl, sr2] = Array.isArray(src) ? src : [src, src];
  for (let i = 0; i < sl.length; i++) { const j = o + i; if (j < 0 || j >= L.length) continue; L[j] += gl * sl[i]; R[j] += gr * sr2[i]; }
};

// ---------------------------------------------------------------- the loop
function stomp(sr, v, R) {
  const n = Math.round(.25 * sr), y = new Float32Array(n);
  let ph = 0, nz = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 58 + 40 * Math.exp(-t / .018);
    ph += 2 * Math.PI * f / sr;
    nz = .8 * nz + .2 * (R() * 2 - 1);
    y[i] = v * (Math.sin(ph) * Math.exp(-t / .09) + .5 * nz * Math.exp(-t / .012));
  }
  return y;
}
function tom(sr, f0, v, R) {
  const n = Math.round(.6 * sr), y = new Float32Array(n);
  let ph = 0, nz = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = f0 * (1 + .35 * Math.exp(-t / .025));
    ph += 2 * Math.PI * f / sr;
    nz = .6 * nz + .4 * (R() * 2 - 1);
    y[i] = v * (Math.sin(ph) * Math.exp(-t / .22) * Math.min(1, i / 30) + .18 * nz * Math.exp(-t / .008));
  }
  return y;
}
function clap(sr, v, R) {
  const n = Math.round(.18 * sr), y = new Float32Array(n);
  const bursts = [0, .009, .017], centre = 1100 + 500 * R();
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let e = 0;
    for (const b of bursts) if (t >= b) e = Math.max(e, Math.exp(-(t - b) / (b === .017 ? .045 : .004)));
    y[i] = v * e * (R() * 2 - 1);
  }
  return highpass(lowpass(y, sr, centre * 2.2, 1.2), sr, centre * .6, 1.2);
}

function loop(sr, tamb) {
  const R = rng(5), n = Math.round(2 * BAR * sr), L = new Float32Array(n), Rt = new Float32Array(n);
  const drums = [L, Rt], stomps = [];
  for (let bar = 0; bar < 2; bar++) for (let s = 0; s < 16; s++) {
    const t = (bar * 16 + s) * STEP + (s % 2 ? .1 * STEP : 0);
    if (s % 4 === 0) { add(drums, stomp(sr, s % 8 ? .42 : .38, R), t, 1, 0, sr); stomps.push(t); }
    if (s === 4 || s === 12) for (let p = 0; p < 4; p++) add(drums, clap(sr, .22 + .08 * R(), R), t + (R() - .5) * .016, 1, (p - 1.5) * .35, sr);
    const toms = {1:[146.8, .32], 2:[110, .5], 6:[110, .42], 9:[146.8, .28], 10:[110, .5], 14:[110, .38]};
    if (toms[s]) add(drums, tom(sr, toms[s][0], toms[s][1] * (.9 + .2 * R()), R), t, 1, toms[s][0] > 120 ? -.25 : .2, sr);
  }
  const events = tambourinePattern({bars:2, step:STEP, swing:.1, hits:[12], every:2, seed:9});
  const tambStem = renderTambourine(tamb, events, 2 * BAR + .5);
  return {drums, stomps, tamb:tambStem.subarray(0, n), tambTail:tambStem};
}

function organ(sr, n, R) {
  const L = new Float32Array(n), Rr = new Float32Array(n), H = [[1, 1], [2, .5], [3, .22], [4, .16], [6, .06]];
  // per bar chord, changing an 8th early (the "and" of four)
  const chordAt = t => { const b = Math.min(BARS - 1, Math.floor((t + 2 * STEP) / BAR)); return CHORDS[PROGRESSION[b]]; };
  const voices = [...new Set([...CHORDS.D.keys, ...CHORDS.G.keys])];
  const amp = voices.map(() => 0), ph = voices.map(() => H.map(() => R() * 6.283));
  const xf = Math.exp(-1 / (.06 * sr));
  for (let i = 0; i < n; i++) {
    const t = i / sr, ch = chordAt(t), wow = 1 + .0035 * Math.sin(2 * Math.PI * .37 * t) + .0012 * Math.sin(2 * Math.PI * 1.9 * t);
    let l = 0, r = 0;
    voices.forEach((m, v) => {
      const want = ch.keys.includes(m) ? 1 : 0;
      amp[v] = want + (amp[v] - want) * xf;
      if (amp[v] < 1e-4) return;
      const f = midiHz(m) * wow;
      let s = 0;
      H.forEach(([h, w], k) => { ph[v][k] += 2 * Math.PI * f * h / sr * (1 + .0008 * k); s += w * Math.sin(ph[v][k]); });
      const pan = (v / (voices.length - 1) - .5) * .6;
      l += s * amp[v] * (1 - pan); r += s * amp[v] * (1 + pan);
    });
    const fade = Math.min(1, t / 1.2);
    L[i] = .028 * l * fade; Rr[i] = .028 * r * fade;
  }
  return [lowpass(L, sr, 2400), lowpass(Rr, sr, 2400)];
}

function hum(sr, n) {
  const y = new Float32Array(n);
  for (let bar = 0; bar < BARS; bar++) for (const s of [2, 14]) {
    const next = s === 14 && bar + 1 < BARS ? PROGRESSION[bar + 1] : PROGRESSION[bar];
    const f = midiHz(CHORDS[next].root), at = (bar * 16 + s + .1) * STEP, len = 3.2 * STEP;
    for (let i = 0; i < len * sr; i++) {
      const j = Math.round(at * sr) + i; if (j >= n) break;
      const t = i / sr, env = Math.min(1, t / .04) * Math.min(1, (len - t) / .08);
      y[j] += .2 * env * (Math.sin(2 * Math.PI * f * t) + .25 * Math.sin(4 * Math.PI * f * t));
    }
  }
  return y;
}

// ---------------------------------------------------------------- the sketch
export function renderSketch({sr = 44100, entry, take, melodyFor, key = 'D', scale = 'majorPenta'}) {
  const n = Math.round((BARS * BAR + .02) * sr);
  const R = rng(17), tamb = makeTambourine({sampleRate:sr, seed:11});
  const lp = loop(sr, tamb);
  const drums = [new Float32Array(n), new Float32Array(n)], tambourine = new Float32Array(n), stomps = [];
  for (let k = 0; k * 2 * BAR < BARS * BAR; k++) {
    const at = k * 2 * BAR, o = Math.round(at * sr);
    add(drums, lp.drums, at, 1, 0, sr);
    for (let i = 0; i < lp.tamb.length && o + i < n; i++) tambourine[o + i] += lp.tamb[i];
    lp.stomps.forEach(t => stomps.push(at + t));
  }
  // the first bar fades the loop in
  for (let i = 0; i < Math.round(BAR * sr); i++) { const g = .45 + .55 * i / (BAR * sr); drums[0][i] *= g; drums[1][i] *= g; tambourine[i] *= g; }
  const pad = organ(sr, n, R), bass = hum(sr, n);
  // the stomps pump the pad and Pat
  const pump = new Float32Array(n).fill(1);
  for (const t of stomps) for (let i = 0; i < .3 * sr; i++) { const j = Math.round(t * sr) + i; if (j < n) pump[j] = Math.min(pump[j], 1 - .38 * Math.exp(-i / sr / .11)); }
  for (let i = 0; i < n; i++) { pad[0][i] *= pump[i]; pad[1][i] *= pump[i]; bass[i] *= pump[i]; }

  // voices
  const voices = [new Float32Array(n), new Float32Array(n)], cues = [], last = {};
  const notes = scaleNotes(key, scale, 36, 72);
  const shift = (m, d) => { const i = notes.indexOf(m); return i < 0 ? m : notes[Math.min(notes.length - 1, i + d)]; };
  const space = {echo:{time:3 * STEP, feedback:.3, mix:.16, tone:2200, tail:2.2}, chorus:{mix:.2}};
  for (const [bar, step, id] of CUES) {
    const e = entry(id), x = take(id), v = e.voice;
    let from = last[v] ?? null;
    if (e.kind === 'response' && last.callEnd) from = last.callEnd + 12;
    const line = melodyFor(e, {from});
    last[v] = line.at(-1).midi;
    if (e.kind === 'call') last.callEnd = line.at(-1).midi;
    const at = (bar * 16 + step) * STEP + (step % 2 ? .1 * STEP : 0) - e.words[0].onset;
    const lead = pixelate(x, sr, {notes:line, amount:AMOUNT[v], space});
    const own = [new Float32Array(lead.left.length + 600), new Float32Array(lead.left.length + 600)];   // this cue alone, for the check
    add(own, [lead.left, lead.right], 0, v === 'strategy' ? 1.05 : .9, v === 'strategy' ? -.08 : .1, sr);
    if (v === 'synthia') {
      const up = line.map(nt => ({...nt, midi:shift(nt.midi, 2)}));
      const harm = pixelate(x, sr, {notes:up, amount:AMOUNT[v] + .1, space});
      add(own, [harm.left, harm.right], .012, .2, -.55, sr);
    }
    add(voices, own, at, 1, 0, sr);
    cues.push({at:+(at + e.words[0].onset).toFixed(3), id, notes:line.map(nt => nt.midi), start:at, own, end:at + e.voiced[1]});
  }

  // mix: the voices sit 1 dB over the band (the constitution's verse balance,
  // active-speech RMS against the band's), then sends to the room, then the bus
  const band = [0, 1].map(c => Float32Array.from(drums[c], (v, i) => .9 * v + .55 * tambourine[i] + pad[c][i] + .9 * bass[i]));
  const vGain = 10 ** ((activeDb(band) + 1 - activeDb(voices)) / 20);
  // The band bus and the voices' bus each get their own pass through the room
  // (it is linear, so the sum is the same), so a cue can be heard alone in the band.
  const bandSends = [new Float32Array(n), new Float32Array(n)], voiceSends = [new Float32Array(n), new Float32Array(n)];
  const mixIn = (sends, src, g, send, pan = 0) => { const s = Array.isArray(src) ? src : [src, src]; add(sends, s, 0, send * g, pan, sr); return [s, g, pan]; };
  const parts = [mixIn(bandSends, drums, .9, .14), mixIn(bandSends, tambourine, .55, .12, .35), mixIn(bandSends, pad, 1, .3), mixIn(bandSends, bass, .9, 0)];
  const bandBus = [new Float32Array(n), new Float32Array(n)];
  for (const [s, g, pan] of parts) add(bandBus, s, 0, g, pan, sr);
  add(bandBus, room(bandSends[0], bandSends[1], sr, {decay:2.8}), 0, .55, 0, sr);
  const VOICE_SEND = .2, voiceBus = (src, len) => {
    const sends = [new Float32Array(len), new Float32Array(len)], bus = [new Float32Array(len), new Float32Array(len)];
    add(sends, src, 0, VOICE_SEND * vGain, 0, sr);
    add(bus, src, 0, vGain, 0, sr);
    add(bus, room(sends[0], sends[1], sr, {decay:2.8}), 0, .55, 0, sr);
    return bus;
  };
  const L = Float32Array.from(bandBus[0]), Rr = Float32Array.from(bandBus[1]);
  add([L, Rr], voiceBus(voices, n), 0, 1, 0, sr);
  // tape-ish bus: soft saturation, then a -1 dBFS peak
  const tape = v => Math.tanh(1.3 * v) / 1.3;
  let peak = 0;
  for (let i = 0; i < n; i++) { L[i] = tape(L[i]); Rr[i] = tape(Rr[i]); peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])); }
  const master = 10 ** (-1 / 20) / peak, fadeOut = Math.round(.6 * sr);
  for (let i = 0; i < n; i++) {
    const g = master * (i > n - fadeOut ? (n - i) / fadeOut : 1);
    L[i] *= g; Rr[i] *= g;
  }
  // Each cue alone over the whole band, through the same room and bus (mono),
  // from 0.25 s before its first vowel to 0.3 s after its last word.
  const cueCuts = () => cues.map(c => {
    const a = Math.max(0, Math.round((c.at - .25) * sr)), b = Math.min(n, Math.round((c.end + .3) * sr)), o = Math.round(c.start * sr);
    const len = b - a, own = c.own.map(ch => { const y = new Float32Array(len); for (let i = 0; i < len; i++) { const j = a + i - o; if (j >= 0 && j < ch.length) y[i] = ch[j]; } return y; });
    const vb = voiceBus(own, len), y = new Float32Array(len);
    for (let i = 0; i < len; i++) y[i] = master * (tape(bandBus[0][a + i] + vb[0][i]) + tape(bandBus[1][a + i] + vb[1][i])) / 2;
    return {id:c.id, at:c.at, samples:y};
  });
  return {left:L, right:Rr, cues:cues.map(({own, start, ...c}) => c), cueCuts, voiceGainDb:+(20 * Math.log10(vGain)).toFixed(1),
    stems:{tambourine, drums, pad, bass, voices:voices.map(c => c.map(v => v * vGain))}};
}

// The tambourine alone: one shake, one hit, and four bars of the groove.
export function renderTambourineSolo({sr = 44100} = {}) {
  const t = makeTambourine({sampleRate:sr, seed:11});
  const norm = y => { let p = 0; for (const v of y) p = Math.max(p, Math.abs(v)); for (let i = 0; i < y.length; i++) y[i] *= .89 / p; return y; };
  const shake = norm(renderTambourine(t, [{t:.02, type:'shake', v:.8}], .5));
  const hit = norm(renderTambourine(makeTambourine({sampleRate:sr, seed:11}), [{t:.02, type:'hit', v:.8}], .7));
  const groove = norm(renderTambourine(makeTambourine({sampleRate:sr, seed:11}),
    tambourinePattern({bars:4, step:STEP, swing:.1, hits:[12], every:2, seed:9}), 4 * BAR + .5));
  return {shake, hit, groove};
}
