// The export's last stage: a true-peak limiter. Inter-sample peaks are found by
// 4× polyphase (windowed-sinc) interpolation; the gain looks 5 ms ahead so it
// is already down when a peak arrives, then recovers over ~80 ms. Pure: works
// on Float32Arrays, so Node can test it.

const PHASES = 4, TAPS = 24;  // 24 taps per phase: a 96-tap interpolator, accurate to ~0.05 dB
const KERNEL = (() => {
  const k = [];
  for (let p = 1; p < PHASES; p++) {
    const frac = p / PHASES, row = new Float32Array(TAPS);
    let sum = 0;
    for (let j = 0; j < TAPS; j++) {
      const x = j - (TAPS / 2 - 1) - frac, sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = .42 + .5 * Math.cos(Math.PI * x / (TAPS / 2)) + .08 * Math.cos(2 * Math.PI * x / (TAPS / 2));   // Blackman
      row[j] = sinc * Math.max(0, w); sum += row[j];
    }
    for (let j = 0; j < TAPS; j++) row[j] /= sum;
    k.push(row);
  }
  return k;
})();

// The largest |value| between sample n and n+1 of the band-limited signal.
export function truePeaks(data) {
  const n = data.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let peak = Math.abs(data[i]);
    for (const row of KERNEL) {
      let v = 0;
      for (let j = 0; j < TAPS; j++) { const k = i + j - (TAPS / 2 - 1); if (k >= 0 && k < n) v += data[k] * row[j]; }
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    out[i] = peak;
  }
  return out;
}

export function truePeakLimit(channels, sampleRate, {ceilingDb = -1.3, lookaheadMs = 5, releaseMs = 80} = {}) {
  const n = channels[0].length, ceiling = 10 ** (ceilingDb / 20), L = Math.max(1, Math.round(sampleRate * lookaheadMs / 1000));
  const peaks = channels.map(truePeaks), need = new Float32Array(n);
  for (let i = 0; i < n; i++) { let p = 0; for (const c of peaks) if (c[i] > p) p = c[i]; need[i] = p > ceiling ? ceiling / p : 1; }
  // Forward-looking minimum over [i, i + L] (monotonic deque).
  const ahead = new Float32Array(n), deque = new Int32Array(n + L + 1);
  let head = 0, tail = 0, next = 0;
  for (let i = 0; i < n; i++) {
    while (next < n && next <= i + L) { while (tail > head && need[deque[tail - 1]] >= need[next]) tail--; deque[tail++] = next++; }
    while (deque[head] < i) head++;
    ahead[i] = need[deque[head]];
  }
  // A causal moving average of the look-ahead minimum ramps the gain down
  // smoothly and can never exceed what sample i needs; release is exponential.
  const release = Math.exp(-1 / (sampleRate * releaseMs / 1000)), gain = new Float32Array(n);
  let sum = 0, env = 1, reduction = 0;
  for (let i = 0; i < n; i++) {
    sum += ahead[i]; if (i >= L) sum -= ahead[i - L];
    const smooth = sum / Math.min(i + 1, L);
    env = Math.min(smooth, env * release + (1 - release));
    gain[i] = env; if (1 - env > reduction) reduction = 1 - env;
  }
  for (const c of channels) for (let i = 0; i < n; i++) c[i] *= gain[i];
  return {maxReductionDb:reduction > 0 ? 20 * Math.log10(1 - reduction) : 0};
}
