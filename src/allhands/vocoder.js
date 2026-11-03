// Channel vocoder. Synergy's speech (the modulator) is split into bands; each
// band's loudness opens the matching band of a synth chord (the carrier). The
// carrier decides the notes, so the robot sings in key whatever eSpeak did.
import {biquad, amp} from './instruments.js';

const rectifiers = new WeakMap();
function rectifier(ctx) {
  let curve = rectifiers.get(ctx);
  if (!curve) {
    curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.abs(i / 1024 - 1);
    rectifiers.set(ctx, curve);
  }
  const w = ctx.createWaveShaper(); w.curve = curve; return w;
}

// Defaults tuned against Whisper transcripts of sung vs spoken takes: a fast
// 70 Hz envelope and narrow bands keep the consonants that carry the words.
export function createVocoder(ctx, {bands = 28, low = 105, high = 7800, q = 5, follow = 70, air = 4500, airLevel = .5, tilt = .42} = {}) {
  const input = amp(ctx, 1), carrier = amp(ctx, 1), output = amp(ctx, 1);
  const hp = biquad(ctx, 'highpass', 85), presence = biquad(ctx, 'highshelf', 2200, .707, 10);
  input.connect(hp); hp.connect(presence);
  const levels = [];
  for (let i = 0; i < bands; i++) {
    const f = low * (high / low) ** (i / (bands - 1));
    const m1 = biquad(ctx, 'bandpass', f, q), m2 = biquad(ctx, 'bandpass', f, q), rect = rectifier(ctx);
    const l1 = biquad(ctx, 'lowpass', follow, .6), l2 = biquad(ctx, 'lowpass', follow, .6);
    // Bandpassed speech loses level fast toward the top; the tilt keeps the
    // consonants audible, which is what keeps the joke intelligible.
    const makeup = amp(ctx, 26 * (f / 400) ** tilt);
    const c1 = biquad(ctx, 'bandpass', f, q), c2 = biquad(ctx, 'bandpass', f, q), vca = amp(ctx, 0);
    presence.connect(m1); m1.connect(m2); m2.connect(rect); rect.connect(l1); l1.connect(l2); l2.connect(makeup); makeup.connect(vca.gain);
    carrier.connect(c1); c1.connect(c2); c2.connect(vca); vca.connect(output);
    levels.push(makeup);
  }
  // Unvoiced air above 4.5 kHz passes straight through: s, t, ch.
  const airPass = biquad(ctx, 'highpass', air, .8), airGain = amp(ctx, airLevel);
  presence.connect(airPass); airPass.connect(airGain); airGain.connect(output);
  return {input, carrier, output, air:airGain};
}
