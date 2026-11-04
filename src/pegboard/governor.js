// Flash limiting, before anything reaches a screen. A flash is a pair of
// opposing luminance changes of at least 10% where the darker state is below
// 0.8 (Harding-style). More than three flashes in any one-second window fails,
// so the governor precomputes a per-frame exposure track that tones down any
// change that would make a third flash within a second. It looks at the whole
// frame and at each quarter of it. Deterministic: a pure function of the frames.

const LUMA = [.32, .95, .86, .2];     // relative light of each tone at I = 1 (blue, white, signal, deep)

// Predicted relative luminance of a board, whole and per quadrant (0..1).
export function boardLuma(board) {
  const {cols, rows, I, tone, white} = board, q = [0, 0, 0, 0], n = cols * rows;
  let total = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x, v = I[i];
    if (v <= 0) continue;
    const l = Math.min(1.6, v) * (LUMA[tone[i]] + (1 - LUMA[tone[i]]) * white[i]);
    total += l; q[(y < rows / 2 ? 0 : 2) + (x < cols / 2 ? 0 : 1)] += l;
  }
  const scale = board.exposure / Math.max(1, n * .35);     // a third of the board fully lit reads as full
  return {whole:Math.min(1, total * scale), quads:q.map(v => Math.min(1, v * 4 * scale))};
}

// Count flashes in a luminance series at `fps`: transitions of >= 10% where the
// darker side is under .8; two opposing transitions make one flash.
export function flashes(series, fps) {
  const events = [];
  let ref = series[0] ?? 0, dir = 0;
  for (let f = 1; f < series.length; f++) {
    const v = series[f], d = v - ref, dark = Math.min(v, ref);
    if (Math.abs(d) >= .1 && dark < .8) {
      const sign = Math.sign(d);
      if (sign !== dir) { events.push({frame:f, sign}); dir = sign; }
      ref = v;
    } else if (Math.sign(v - ref) === dir) ref = v;   // keep following a continuing ramp
  }
  return events;                       // each event is half a flash
}

export function worstWindow(events, fps) {
  let worst = 0;
  for (let i = 0; i < events.length; i++) {
    let j = i; while (j < events.length && events[j].frame - events[i].frame < fps) j++;
    worst = Math.max(worst, (j - i) / 2);
  }
  return worst;
}

// Given the raw per-frame luminance (whole and quads), return per-frame gains in
// (0, 1] so that no window of one second holds more than `max` flashes. Inside
// an offending window, peaks are clamped toward the window's trough (its lower
// envelope + 9%), which removes the oscillation rather than one transition.
export function governorTrack(frames, fps, {max = 3, headroom = .09} = {}) {
  const gains = new Float32Array(frames.length).fill(1);
  const series = k => frames.map((f, i) => (k < 0 ? f.whole : f.quads[k]) * gains[i]);
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const k of [-1, 0, 1, 2, 3]) {
      const s = series(k), ev = flashes(s, fps);
      for (let i = 0; i + 2 * max < ev.length; i++) {
        const a = ev[i], b = ev[i + 2 * max];
        if (b.frame - a.frame >= fps) continue;
        const from = Math.max(0, a.frame - 2), to = Math.min(s.length - 1, b.frame + 2);
        let trough = Infinity;
        for (let f = from; f <= to; f++) trough = Math.min(trough, s[f]);
        const ceiling = trough + headroom;
        for (let f = from; f <= to; f++) if (s[f] > ceiling) {
          const g = gains[f] * Math.max(.2, ceiling / s[f]);
          if (g < gains[f] - 1e-6) { gains[f] = g; changed = true; }
        }
      }
    }
    if (!changed) break;
  }
  return gains;
}
