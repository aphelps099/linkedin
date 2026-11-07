"""The Delve. delivery master: the song's render, with a spot gain on the few transients that a codec pushes over the
ceiling, so the encoded files (the film's AAC, the song's MP3) stay at or under -1 dBTP. The mix is locked: nothing
is rebalanced, limited or compressed. Outside the spots the master is the render, sample for sample.

    python3 scripts/master-delve.py RENDER.wav [--flac assets/delve/delve-song.flac] [--mp3 OUT.mp3] [--json OUT.json]

Why: the render peaks at -1.26 dBTP, but AAC and MP3 overshoot on a handful of sharp transients (the tambourine's
beat-4 accent in the swells, her consonants in P5 and P7) by up to a dB: the posted AAC measured -0.5 dBTP and the
MP3 -0.9. A plain gain cut would take the loudness out of -10 +-1 LUFS, and a limiter would trim hundreds of peaks.
How: encode both ways exactly as they ship (the film: export-videostudio.mjs muxRecording, AAC-LC 320k at 48 kHz
from song time 0, 0.05 s into the file, padded to the film's 2,895 frames; the song: libmp3lame 320k CBR of the whole
file), decode, find the 4x-oversampled peaks over CEILING, and cut only those spans in the source (the cluster plus
2 ms each side, raised-cosine ramps of 5 ms), by the overshoot plus a margin; repeat until both decodes are clean.
Deterministic: the same render and the same ffmpeg give the same spans and the same bytes.
"""
import argparse, json, os, subprocess, sys, tempfile, hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

CEILING = -1.3            # dBTP the decodes must stay under (0.3 dB under the brief's -1: room for another machine's ffmpeg)
MARGIN = .15              # dB cut beyond the measured overshoot
RAMP, PAD = .005, .002    # s: the ramps, and the span's margin round a cluster
OFFSET, FILM = .05, 2895 / 24

def run(cmd): return subprocess.run(cmd, check=True, capture_output=True)

def tp_clusters(x, sr, ceiling):
    up = np.stack([resample_poly(x[:, c], 4, 1) for c in range(x.shape[1])], 1)
    a = np.abs(up).max(1); db = 20 * np.log10(a + 1e-12)
    over = np.nonzero(db > ceiling)[0]
    out = []
    for i in over:
        t = i / (4 * sr)
        if out and t - out[-1][1] < .02: out[-1][1] = t; out[-1][2] = max(out[-1][2], db[i])
        else: out.append([t, t, db[i]])
    return float(db.max()), out

def decode(path, sr):
    raw = run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(sr), '-f', 'f32le', '-']).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

def encodes(wav, tmp, sr):
    """Both shipping encodes of `wav`; returns {name: (path, decoded, time offset of decode t=0 in the source)}."""
    a, b = round(OFFSET * sr), round((FILM + OFFSET) * sr)
    aac, mp3 = os.path.join(tmp, 'film.m4a'), os.path.join(tmp, 'song.mp3')
    run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', f'atrim=start_sample={a}:end_sample={b},asetpts=PTS-STARTPTS,apad=whole_len={b - a}',
         '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-map_metadata', '-1', aac])   # (exactly the mux's encode: +bitexact would change the AAC itself)
    run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '320k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3])
    return {'aac':(aac, decode(aac, 48000), OFFSET, 48000), 'mp3':(mp3, decode(mp3, sr), 0., sr)}

def apply(src, sr, spans):
    """The render with each span's gain (dB) and raised-cosine ramps; untouched (bit for bit) outside the spans."""
    g = np.ones(len(src))
    n = np.arange(len(src)) / sr
    for s in spans:
        t0, t1, d = s['from'], s['to'], 10 ** (-s['cut'] / 20)
        lo, hi = max(0, int((t0 - RAMP) * sr)), min(len(src), int(np.ceil((t1 + RAMP) * sr)) + 1)
        t = n[lo:hi]
        k = np.ones(hi - lo)
        k = np.where(t < t0, .5 - .5 * np.cos(np.pi * np.clip((t - (t0 - RAMP)) / RAMP, 0, 1)), k)
        k = np.where(t > t1, .5 - .5 * np.cos(np.pi * np.clip(((t1 + RAMP) - t) / RAMP, 0, 1)), k)
        g[lo:hi] = np.minimum(g[lo:hi], 1 - (1 - d) * k)
    out = src.astype(np.float64)
    m = g < 1
    out[m] = np.round(out[m] * g[m, None])
    return np.clip(out, -32768, 32767).astype(np.int16), g

def ebur(path):
    q = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = q[q.rfind('Summary:'):]
    val = lambda k: float(next(l.split()[1] for l in s.splitlines() if l.strip().startswith(k)))
    return {'I':val('I:'), 'LRA':val('LRA:'), 'TP':val('Peak:')}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wav'); ap.add_argument('--flac'); ap.add_argument('--mp3'); ap.add_argument('--json'); ap.add_argument('--wav-out')
    a = ap.parse_args()
    sr, src = wavfile.read(a.wav)
    assert src.dtype == np.int16 and src.ndim == 2, 'a 16-bit stereo render'
    spans, log = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for it in range(12):
            out, g = apply(src, sr, spans)
            wav = os.path.join(tmp, 'master.wav'); wavfile.write(wav, sr, out)
            enc = encodes(wav, tmp, sr)
            new = 0; peaks = {}
            for name, (path, x, off, rate) in enc.items():
                peak, cl = tp_clusters(x, rate, CEILING); peaks[name] = round(peak, 2)
                for t0, t1, p in cl:
                    s0, s1 = t0 + off, t1 + off
                    hit = next((s for s in spans if s0 <= s['to'] + .004 and s1 >= s['from'] - .004), None)
                    if hit: hit['from'] = round(min(hit['from'], s0 - PAD), 5); hit['to'] = round(max(hit['to'], s1 + PAD), 5); hit['cut'] = round(hit['cut'] + p - CEILING + MARGIN, 3)
                    else: spans.append({'from':round(s0 - PAD, 5), 'to':round(s1 + PAD, 5), 'cut':round(max(.3, p - CEILING + MARGIN), 3)})
                    new += 1
            log.append({'pass':it, 'peaks':peaks, 'over':new, 'spans':len(spans)})
            print(f'pass {it}: decoded true peaks {peaks}, {new} clusters over {CEILING} dBTP, {len(spans)} spans', flush=True)
            if not new: break
            spans.sort(key=lambda s: s['from'])
        else: sys.exit('did not converge')
        touched = int((g < 1).sum())
        final = {'render':a.wav, 'render_sha256':hashlib.sha256(open(a.wav, 'rb').read()).hexdigest(), 'ceiling_dBTP':CEILING, 'ramp_s':RAMP,
                 'spans':spans, 'touched_s':round(touched / sr, 4), 'max_cut_dB':max((s['cut'] for s in spans), default=0), 'passes':log,
                 'decoded_tp':{k:v for k, v in log[-1]['peaks'].items()}, 'render_ebur':ebur(a.wav), 'master_ebur':ebur(wav),
                 'aac_ebur':ebur(enc['aac'][0]), 'mp3_ebur':ebur(enc['mp3'][0])}
        same = np.array_equal(out[g >= 1], src[g >= 1])
        final['identical_outside_spans'] = bool(same)
        if a.wav_out: wavfile.write(a.wav_out, sr, out)
        if a.flac:
            run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', a.flac])
            final['flac'] = a.flac; final['flac_sha256'] = hashlib.sha256(open(a.flac, 'rb').read()).hexdigest()
        if a.mp3:
            run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '320k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', a.mp3])
            final['mp3'] = a.mp3; final['mp3_sha256'] = hashlib.sha256(open(a.mp3, 'rb').read()).hexdigest(); final['mp3_ebur'] = ebur(a.mp3)
        master_sha = hashlib.sha256(out.tobytes()).hexdigest(); final['master_pcm_sha256'] = master_sha
    print(json.dumps({k:v for k, v in final.items() if k not in ('passes', 'spans')}, indent=1))
    print(f"{len(spans)} spans, {final['touched_s']} s touched, deepest cut {final['max_cut_dB']} dB; identical outside the spans: {final['identical_outside_spans']}")
    if a.json: json.dump(final, open(a.json, 'w'), indent=1)

if __name__ == '__main__':
    main()
