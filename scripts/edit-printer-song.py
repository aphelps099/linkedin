"""The sound of the printer's music video (docs/printer-song-video.md): a 3 s intro, then the 30.5 s edit
of Aaron's "Printer Song".

    python3 scripts/edit-printer-song.py SOURCE.wav [--voice assets/printer-song/printer-intro-voice.flac]
        [--out assets/printer-song/printer-song-film.flac] [--variant swell|tape]

SOURCE is Aaron's untouched master (40.12 s, 44.1 kHz 16-bit stereo); it stays out of the repo.

The intro (film 0.000-3.000, frames 0-71): Aaron's own opening, played backwards and slowed, swelling into
the film's first frame. Source 0.000-2.250 runs in reverse through a varispeed that rises from half speed
(an octave down) to normal speed, so the last sample of the intro is the source's first sample, at its
own pitch and at full level: the song then plays forwards from that same sample (a palindrome join, no
fade, no click). Its level rises from -30 dB to 0 dB (a square law), so the word sits on a near-quiet bed.
Synergy's "Loading." (scripts/render-printer-intro.mjs) sits on top: its onset at film 0.500 s (frame 12),
3 dB under the take's -6 dBFS peak.
  --variant tape is Aaron's literal idea, kept for comparison: source 6.0-7.5 (g4, the film's signature
  glide) reversed at half speed, faded in, and cut 30 ms before the film. It measures worse (100 ms RMS either
  side of the join; Welch centroid over 0.3 s; the word against the bed alone in 600-3000 Hz): a +6.5 dB step
  into the film (the swell: +1.0), an octave's change of timbre (centroid 0.59 to 1.11 kHz; the swell: 1.12 to
  1.11), and the word 3 dB under the bed in its own band (the swell: 11 dB over it).

The song (film 3.000-33.500): source 0.000-14.250, then 24.000-39.520, joined by a 30 ms equal-power
crossfade centred on both points. 24.000 - 14.250 = 9.750 s is the track's own repeat (78 sixteenths of
0.125 s, measured by envelope cross-correlation), so the 16th grid runs on through the join. (The first
cut joined at 14.500 / 24.250: a +6 dB step in 100 ms, the largest in the film; this join measures +0.7.)
Aaron's hard stop (source 39.500, film 32.750) is the ending: nothing fades out. Silence pads the file to
33.500 s (804 frames at 24 fps). Song time = film time - 3; source = song time before 14.25 s, song + 9.75 after.
Outside the intro and the crossfade every sample is the source's own. Needs numpy and scipy, and ffmpeg.
"""
import argparse, os, subprocess, tempfile
import numpy as np
import scipy.io.wavfile as wavfile
import scipy.signal as signal

INTRO, OUT_AT, IN_AT, XFADE, END_AT, SONG = 3.000, 14.250, 24.000, 0.030, 39.520, 30.500
SWELL = dict(rate=(.5, 1.0), db=(-30.0, 0.0), power=2.0)      # the intro: varispeed and level, start to end
VOICE_AT, VOICE_DB = 0.450, -3.0                               # the take's start in the film (its onset +0.05 s), its gain

def song(X, sr):
    o, i, h, e = (int(round(v * sr)) for v in (OUT_AT, IN_AT, XFADE / 2, END_AT))
    u = np.linspace(0, 1, 2 * h, endpoint=False)[:, None]
    join = X[o - h:o + h] * np.cos(u * np.pi / 2) + X[i - h:i + h] * np.sin(u * np.pi / 2)
    y = np.vstack([X[:o - h], join, X[i + h:e]])
    return np.vstack([y, np.zeros((int(round(SONG * sr)) - len(y), y.shape[1]))])

def swell(X, sr):
    # Output time tau in [0, T): the reversed source consumed is s(tau) = r0 tau + (r1 - r0) tau^2 / 2T, so the
    # read position (forward source seconds) falls from `total` to exactly 0 on the last sample.
    T, N = INTRO, int(round(INTRO * sr)); (r0, r1), (d0, d1) = SWELL['rate'], SWELL['db']
    tau = np.arange(1, N + 1) / sr
    total = r0 * T + (r1 - r0) * T / 2
    pos = (total - (r0 * tau + (r1 - r0) * tau ** 2 / (2 * T))) * sr
    up = 4; Xu = signal.resample_poly(X[:int((total + .1) * sr)], up, 1, axis=0)
    p = np.clip(pos * up, 0, len(Xu) - 1)
    y = np.stack([np.interp(p, np.arange(len(Xu)), Xu[:, c]) for c in range(X.shape[1])], 1)
    gain = 10 ** ((d0 + (d1 - d0) * (tau / T) ** SWELL['power']) / 20)
    return y * gain[:, None]

def tape(X, sr):
    N = int(round(INTRO * sr)); seg = X[int(6.0 * sr):int(7.5 * sr)][::-1]
    y = signal.resample_poly(seg, 2, 1, axis=0)[:N]; g = np.ones(len(y)); fi, fo = int(.25 * sr), int(.03 * sr)
    g[:fi] = np.linspace(0, 1, fi) ** 2; g[-fo:] = np.linspace(1, 0, fo)
    return np.vstack([y * g[:, None] * 10 ** (-6 / 20), np.zeros((N - len(y), X.shape[1]))])

def read_flac(path, sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '2', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float64)

def film(x, sr, voice, variant='swell'):
    X = x.astype(np.float64)
    intro = (swell if variant == 'swell' else tape)(X, sr)
    v, at = np.zeros_like(intro), int(round(VOICE_AT * sr)); n = min(len(voice), len(v) - at)
    v[at:at + n] = voice[:n] * 10 ** (VOICE_DB / 20)
    y = np.vstack([intro + v, song(X, sr)])
    return np.clip(np.round(y), -32768, 32767).astype(np.int16)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('--voice', default='assets/printer-song/printer-intro-voice.flac')
    ap.add_argument('--out', default='assets/printer-song/printer-song-film.flac')
    ap.add_argument('--variant', default='swell', choices=['swell', 'tape'])
    a = ap.parse_args()
    sr, x = wavfile.read(a.source)
    assert sr == 44100 and x.dtype == np.int16 and x.ndim == 2, 'expects the 44.1 kHz 16-bit stereo master'
    y = film(x, sr, read_flac(a.voice, sr), a.variant)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'edit.wav')
        wavfile.write(wav, sr, y)
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', a.out], check=True)
    print(f'{a.out}: {len(y)} samples, {len(y) / sr:.3f} s: the intro ({a.variant}) 0-{INTRO:.3f} s, the song from {INTRO:.3f} s; Aaron\'s hard stop sounds at {INTRO + OUT_AT + (39.5 - IN_AT):.3f}')
