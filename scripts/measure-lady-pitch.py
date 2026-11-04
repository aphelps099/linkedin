#!/usr/bin/env python3
"""Pitch track for every lady recording (public/phrases/NN.wav).

drop.js tunes each cut of her phrase by the pitch of the audio it actually
plays, not by the phrase's median: "Let's" sits 2 to 5 semitones above
"build.", so the ladder's short cuts came out up to 240 cents sharp.

YIN (cumulative-mean-normalised difference) on the mono sum, 32 ms windows
every 10 ms, 85-560 Hz. A frame is voiced when its aperiodicity is under 0.3,
it is within 40 dB of the file's loudest frame and a neighbour is voiced too.
Octave slips (9 semitones or more from the frames around them) fold back.
Output: src/allhands/lady-pitch.json, {file: {hop, t0, m:[midi * 10, 0 when
unvoiced], e:[dB under the file's loudest frame]}}, frame k centred at t0 + k * hop.

  python3 scripts/measure-lady-pitch.py [--out src/allhands/lady-pitch.json]
"""
import argparse
import glob
import json
import math
import os

import numpy as np
from scipy.io import wavfile

HOP, WIN, FMIN, FMAX = 0.01, 0.032, 85.0, 560.0


def yin(frame, sr):
    y = frame - frame.mean()
    n = len(y)
    w = n // 2
    tmin, tmax = int(sr / FMAX), min(int(sr / FMIN), n - w - 1)
    d = np.array([np.sum((y[:w] - y[t:t + w]) ** 2) for t in range(tmax + 1)])
    cm = np.ones_like(d)
    cs = np.cumsum(d[1:])
    cm[1:] = d[1:] * np.arange(1, tmax + 1) / np.maximum(cs, 1e-12)
    seg = cm[tmin:tmax]
    below = np.where(seg < 0.15)[0]
    i = int(below[0]) if len(below) else int(np.argmin(seg))
    while i + 1 < len(seg) and seg[i + 1] < seg[i]:
        i += 1
    ap = float(seg[i])
    if 0 < i < len(seg) - 1:
        a, b, c = seg[i - 1], seg[i], seg[i + 1]
        den = a - 2 * b + c
        i = i + (0.5 * (a - c) / den if abs(den) > 1e-12 else 0)
    return sr / (tmin + i), ap


def track(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x /= 32768.0
    win = int(WIN * sr)
    hop = HOP
    t0 = WIN / 2
    frames = []
    k = 0
    rms_all = []
    while True:
        c = t0 + k * hop
        a = int(round((c - WIN / 2) * sr))
        if a + win > len(x):
            break
        seg = x[a:a + win]
        rms_all.append(math.sqrt(float(np.mean(seg ** 2))) + 1e-12)
        frames.append(seg)
        k += 1
    loud = max(rms_all)
    out = []
    for seg, rms in zip(frames, rms_all):
        if 20 * math.log10(rms / loud) < -40:
            out.append(None)
            continue
        f, ap = yin(seg, sr)
        out.append(69 + 12 * math.log2(f / 440) if ap < 0.3 else None)
    # A voiced frame alone between unvoiced ones is a guess: drop it. Octave
    # slips (9 semitones or more from the median of the voiced frames within
    # 0.15 s) fold back toward it; a real glide ("Let's" climbs 6, "quick" in
    # 40.wav sits 8 above its phrase) stays where it is.
    out = [m if m is not None and ((i > 0 and out[i - 1] is not None) or (i + 1 < len(out) and out[i + 1] is not None)) else None for i, m in enumerate(out)]
    raw = list(out)
    for i, m in enumerate(raw):
        if m is None:
            continue
        near = [v for v in raw[max(0, i - 15):i + 16] if v is not None]
        med = float(np.median(near))
        while m - med >= 9:
            m -= 12
        while med - m >= 9:
            m += 12
        out[i] = m
    return {'hop': hop, 't0': round(t0, 4), 'm': [int(round(m * 10)) if m is not None else 0 for m in out],
            'e': [int(round(20 * math.log10(r / loud))) for r in rms_all]}


def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--phrases', default=os.path.join(root, 'public', 'phrases'))
    ap.add_argument('--out', default=os.path.join(root, 'src', 'allhands', 'lady-pitch.json'))
    args = ap.parse_args()
    result = {}
    for path in sorted(glob.glob(os.path.join(args.phrases, '[0-9][0-9].wav'))):
        result[os.path.basename(path)] = track(path)
    with open(args.out, 'w') as f:
        f.write('{\n' + ',\n'.join(f' "{k}":{json.dumps(v, separators=(",", ":"))}' for k, v in result.items()) + '\n}\n')
    print(f'{len(result)} recordings -> {args.out}')


if __name__ == '__main__':
    main()
