#!/usr/bin/env python3
"""Audio quality gates for an All Hands render (scripts/render-allhands.mjs output).

Measures a WAV with ffmpeg's ebur128 filter (peak=true) and numpy, prints a
PASS/FAIL/WARN summary and exits 1 when any gate fails (2 on usage/IO errors).

Gates (defaults; every limit has a flag):
  integrated loudness -10 +-1 LUFS; true peak <= -1.0 dBTP; LRA 5-8 LU (warn)
  every Drop* section >= +2.5 LU over the Verse* sections (section-integrated,
    BS.1770 gated), on the mix and through a phone speaker (mono, HP 300 Hz, LP 8 kHz)
  --silence windows: sample peak < -60 dBFS
  side/mid in each Drop* section -13..-10 dB (warn); mono fold-down loss < 2 dB
  clipped samples (digital full scale) == 0
Report only: per-section momentary/short-term loudness, octave-band balance,
crest factor, 1-4 kHz transient energy drop vs verse, Whisper WER (--whisper).
Cross-checks ffmpeg against an independent numpy BS.1770-4 implementation and
ffmpeg loudnorm (warns if they disagree).

Time: sections are bars; file seconds = offset + seconds(bar), offset 0.05 s
(the render's lead-in), seconds(bar) = bar * 4 * 60 / bpm unless the plan JSON
carries timing (seconds per 16th step, or step start times). Spans for
--silence / --whisper are file seconds ("39.49-40.00"), or bars with a b
prefix ("b16-b18").

  python3 scripts/measure-allhands.py render.wav [--plan render.json]
      [--sections "Intro:0-4,Verse:4-12,Breakdown:12-16,Drop:16-24,Outro:24-28"]
      [--silence 39.49-40.00] [--whisper "b4-b6:I used ChatGPT to ..."]
      [--whisper-lines] [--json out.json]

Needs ffmpeg on PATH, numpy, scipy; faster-whisper only for Whisper windows.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

OCTAVES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
STEPS_PER_BAR = 16
ABS_GATE = -70.0


class UsageError(Exception):
    pass


# ---------------------------------------------------------------- helpers

def db10(power):
    return 10 * math.log10(power) if power > 0 else -math.inf


def db20(amp):
    return 20 * math.log10(amp) if amp > 0 else -math.inf


def lufs(energy):
    """BS.1770 loudness of a (channel-weighted) mean-square energy."""
    return -0.691 + db10(energy)


def r(value, nd=2):
    """Round for JSON; infinities and NaN become None."""
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        return [r(v, nd) for v in value]
    value = float(value)
    return round(value, nd) if math.isfinite(value) else None


def fmt(value, nd=1, signed=False, width=0):
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        text = '-inf' if isinstance(value, float) and value == -math.inf else '--'
    else:
        text = f'{value:+.{nd}f}' if signed else f'{value:.{nd}f}'
    return text.rjust(width)


def ff_input(path):
    """An ffmpeg input URL that never parses as a protocol (a "x:" prefix) or option."""
    return 'file:' + os.path.abspath(path)


def need(tool):
    if not shutil.which(tool):
        raise UsageError(f'{tool} is not on the PATH')


# ---------------------------------------------------------------- input

def load_audio(path):
    """Returns sr, x[n, ch] float64 (1.0 = full scale), clip info, format string."""
    try:
        sr, raw = wavfile.read(path)
    except Exception:
        raw = None
    if raw is None:  # Not a PCM/float WAV scipy reads: decode with ffmpeg.
        need('ffprobe')
        probe = json.loads(subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels',
             '-of', 'json', ff_input(path)], capture_output=True, text=True, check=True).stdout)['streams'][0]
        sr, ch = int(probe['sample_rate']), int(probe['channels'])
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', ff_input(path), '-f', 'f32le', '-acodec', 'pcm_f32le', '-'],
                             capture_output=True, check=True).stdout
        raw = np.frombuffer(pcm, '<f4').reshape(-1, ch)
        fmt_name = f'decoded f32 ({os.path.splitext(path)[1] or "?"})'
    else:
        fmt_name = f'WAV {raw.dtype}'
    if raw.ndim == 1:
        raw = raw[:, None]
    if raw.shape[1] > 2:
        print(f'note: {raw.shape[1]} channels; measuring the first two', file=sys.stderr)
        raw = raw[:, :2]
    if raw.dtype.kind == 'f':
        x = raw.astype(np.float64)
        clipped = np.abs(x) >= 1.0
    elif raw.dtype == np.uint8:
        x = (raw.astype(np.float64) - 128) / 128
        clipped = (raw == 0) | (raw == 255)
    else:
        info = np.iinfo(raw.dtype)
        # scipy returns 24-bit WAVs left-justified in int32: the low byte is 0.
        lsb = 256 if raw.dtype == np.int32 and not np.any(raw & 0xFF) else 1
        if lsb == 256:
            fmt_name = 'WAV int24'
        x = raw.astype(np.float64) / -float(info.min)
        clipped = (raw >= info.max - (lsb - 1)) | (raw <= info.min)
    return sr, x, clipped, fmt_name


def clip_report(clipped, x, sr):
    count = int(clipped.sum())
    any_ch = clipped.any(axis=1)
    edges = np.diff(np.concatenate([[0], any_ch.astype(np.int8), [0]]))
    starts = np.flatnonzero(edges == 1)
    flat_runs = 0  # >= 3 identical samples above -1 dBFS: a hard limit below full scale
    for c in range(x.shape[1]):
        v = x[:, c]
        same = (v[1:] == v[:-1]) & (np.abs(v[1:]) >= 10 ** (-1 / 20))
        e = np.diff(np.concatenate([[0], same.astype(np.int8), [0]]))
        flat_runs += int(((np.flatnonzero(e == -1) - np.flatnonzero(e == 1)) >= 2).sum())
    return {'clipped_samples': count, 'clip_events': int(len(starts)),
            'first_clips_s': [r(s / sr, 4) for s in starts[:8]], 'flat_top_runs': flat_runs}


def load_plan(path):
    with open(path) as f:
        data = json.load(f)
    plan = data.get('plan', data) if isinstance(data, dict) else {}
    pick = lambda key: plan.get(key, data.get(key)) if isinstance(plan, dict) else data.get(key)
    return {'path': path, 'lines': pick('lines') or [], 'sections': pick('sections'), 'timing': pick('timing'),
            'bpm': pick('bpm'), 'swing': pick('swing')}


class Clock:
    """Converts bars and 16th steps to file seconds."""

    def __init__(self, bpm, offset, timing=None, first_bar=0.0, swing=0.0):
        self.offset, self.bpm, self.swing, self.source = offset, bpm, swing or 0.0, f'{bpm:g} BPM grid'
        self.starts = None
        if isinstance(timing, (int, float)) and timing > 0:
            self.step, self.source = float(timing), f'plan timing ({timing:g} s per step)'
        elif isinstance(timing, list) and len(timing) > 1:
            t = np.asarray(timing, float)
            if t[0] == 0 and np.all(np.diff(t) > 0):
                self.starts, kind = t, 'step start times'
            else:
                self.starts, kind = np.concatenate([[0.0], np.cumsum(t)]), 'step durations'
            self.step = float(self.starts[-1] - self.starts[-2])
            self.source = f'plan timing ({len(t)} {kind})'
        else:
            self.step = 60.0 / bpm / 4
        self.zero = self.step_time(first_bar * STEPS_PER_BAR)

    def step_time(self, step):
        if self.starts is None:
            whole = math.floor(step)
            swing = self.swing * self.step if (whole == step and whole % 2) else 0.0
            return step * self.step + swing
        last = len(self.starts) - 1
        if step <= last:
            return float(np.interp(step, np.arange(last + 1), self.starts))
        return float(self.starts[-1] + (step - last) * self.step)

    def at_step(self, step):
        return self.offset + self.step_time(step) - self.zero

    def at_bar(self, bar):
        return self.at_step(bar * STEPS_PER_BAR)


def parse_sections(spec):
    sections = []
    for item in filter(None, (s.strip() for s in spec.split(','))):
        m = re.fullmatch(r'(.+?)\s*:\s*(-?[\d.]+)\s*-\s*(-?[\d.]+)', item)
        if not m:
            raise UsageError(f'bad section "{item}" (want Name:from-to in bars)')
        sections.append({'name': m.group(1), 'from': float(m.group(2)), 'to': float(m.group(3))})
    return sections


def parse_span(text, clock):
    m = re.fullmatch(r'\s*(b?)([\d.]+)\s*-\s*(b?)([\d.]+)\s*', text)
    if not m:
        raise UsageError(f'bad span "{text}" (want seconds "a-b" or bars "b4-b6")')
    a = clock.at_bar(float(m.group(2))) if m.group(1) else float(m.group(2))
    b = clock.at_bar(float(m.group(4))) if m.group(3) else float(m.group(4))
    if b <= a:
        raise UsageError(f'empty span "{text}"')
    return a, b


# ---------------------------------------------------------------- loudness

def k_weighting(sr):
    """BS.1770-4 K-weighting (shelf + RLB high-pass) for any sample rate, as libebur128 derives it."""
    f0, gain, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = math.tan(math.pi * f0 / sr)
    vh = 10 ** (gain / 20)
    vb = vh ** 0.4996667741545416
    a0 = 1 + k / q + k * k
    shelf = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0,
             1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.13547087602444, 0.5003270373238773
    k = math.tan(math.pi * f0 / sr)
    a0 = 1 + k / q + k * k
    highpass = [1.0, -2.0, 1.0, 1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    return np.array([shelf, highpass])


class Loudness:
    """Independent BS.1770-4 / EBU Tech 3341-3342 meter over a whole signal.

    Blocks start every 100 ms from the file start (the same grid ffmpeg uses), so
    a section's integrated loudness gates exactly the 400 ms blocks inside it."""

    def __init__(self, x, sr, gain=1.0):
        y = signal.sosfilt(k_weighting(sr), x, axis=0)
        power = (y * y).sum(axis=1) * gain
        self.cum = np.concatenate([[0.0], np.cumsum(power)])
        self.sr, self.n = sr, len(power)

    def blocks(self, seconds, t0=0.0, t1=None):
        """Mean-square energies of `seconds` blocks (100 ms hop) lying inside [t0, t1]."""
        length = round(seconds * self.sr)
        hop = self.sr / 10
        t1 = self.n / self.sr if t1 is None else min(t1, self.n / self.sr)
        first = max(0, math.ceil(t0 * self.sr / hop - 1e-9))
        last = math.floor((t1 * self.sr - length) / hop + 1e-9)
        if last < first:
            return np.zeros(0)
        starts = np.round(np.arange(first, last + 1) * hop).astype(np.int64)
        starts = starts[starts + length <= self.n]
        return (self.cum[starts + length] - self.cum[starts]) / length

    def integrated(self, t0=0.0, t1=None):
        return gated_integrated(self.blocks(0.4, t0, t1))

    def lra(self, t0=0.0, t1=None):
        e = self.blocks(3.0, t0, t1)
        e = e[-0.691 + 10 * np.log10(np.maximum(e, 1e-30)) > ABS_GATE]
        if len(e) < 2:
            return 0.0
        threshold = lufs(e.mean()) - 20
        levels = -0.691 + 10 * np.log10(e)
        levels = levels[levels > threshold]
        return float(np.percentile(levels, 95) - np.percentile(levels, 10)) if len(levels) > 1 else 0.0


def gated_integrated(energies):
    e = np.asarray(energies, float)
    e = e[e > 0]
    e = e[-0.691 + 10 * np.log10(e) > ABS_GATE]
    if not len(e):
        return -math.inf
    threshold = lufs(e.mean()) - 10
    e = e[-0.691 + 10 * np.log10(e) > threshold]
    return lufs(e.mean())


def true_peak_frames(x, sr, frame_s=0.1):
    """Per-100 ms, per-channel true peak (4x oversampled below 96 kHz)."""
    factor = 4 if sr < 96000 else 2 if sr < 192000 else 1
    hop = round(frame_s * sr)
    frames = math.ceil(len(x) / hop)
    out = np.zeros((frames, x.shape[1]))
    for c in range(x.shape[1]):
        up = np.abs(signal.resample_poly(x[:, c], factor, 1)) if factor > 1 else np.abs(x[:, c])
        pad = np.zeros(frames * hop * factor)
        pad[:len(up)] = up[:frames * hop * factor]
        out[:, c] = pad.reshape(frames, hop * factor).max(axis=1)
    return out


def ffmpeg_ebur128(path, sr):
    """Runs ebur128 (peak=true+sample, 100 ms frames) and returns frame series + summary."""
    hop = max(1, round(sr / 10))
    with tempfile.TemporaryDirectory() as tmp:
        meta_path = os.path.join(tmp, 'r128.txt')
        # A bare file name in the temp dir as cwd: no filtergraph escaping of the path.
        chain = (f'asetnsamples=n={hop}:p=0,ebur128=peak=true+sample:metadata=1:framelog=quiet,'
                 'ametadata=mode=print:file=r128.txt')
        p = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-i', ff_input(path), '-af', chain,
                            '-f', 'null', '-'], capture_output=True, text=True, cwd=tmp)
        if p.returncode != 0 or not os.path.exists(meta_path):
            raise RuntimeError('ffmpeg ebur128 failed:\n' + p.stderr[-2000:])
        with open(meta_path) as f:
            meta = f.read()
    frames, cur = [], None
    for line in meta.splitlines():
        if line.startswith('frame:'):
            m = re.search(r'pts_time:([\d.]+)', line)
            cur = {'t': float(m.group(1))}
            frames.append(cur)
        elif cur is not None and line.startswith('lavfi.r128.'):
            key, _, value = line[len('lavfi.r128.'):].partition('=')
            try:
                cur[key] = float(value)
            except ValueError:
                pass
    if not frames:
        raise RuntimeError('ffmpeg ebur128 produced no frames')
    log = p.stderr[p.stderr.rfind('Summary:'):]

    def summary(pattern):
        m = re.search(pattern, log, re.S)
        if not m:
            return None
        return -math.inf if m.group(1) == '-inf' else float(m.group(1))

    last = frames[-1]
    return {
        't_end': np.array([f['t'] for f in frames]) + hop / sr,
        'M': np.array([f.get('M', -120.0) for f in frames]),
        'S': np.array([f.get('S', -120.0) for f in frames]),
        'I': last.get('I'), 'LRA': last.get('LRA'), 'LRA_low': last.get('LRA.low'), 'LRA_high': last.get('LRA.high'),
        'TP': db20(max(f.get('true_peak', 0.0) for f in frames)),
        'SP': db20(max(f.get('sample_peak', 0.0) for f in frames)),
        'summary': {'I': summary(r'Integrated loudness:\s*I:\s*(-?[\d.]+|-inf)'),
                    'LRA': summary(r'Loudness range:\s*LRA:\s*(-?[\d.]+)'),
                    'TP': summary(r'True peak:\s*Peak:\s*(-?[\d.]+|-inf)')},
    }


def ffmpeg_loudnorm(path):
    p = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-i', ff_input(path), '-af',
                        'loudnorm=I=-10:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', p.stderr)
    if p.returncode != 0 or not m:
        print('note: ffmpeg loudnorm cross-check failed; skipped', file=sys.stderr)
        return None
    d = json.loads(m.group(0))
    num = lambda k: -math.inf if d[k] == '-inf' else float(d[k])
    return {'I': num('input_i'), 'TP': num('input_tp'), 'LRA': num('input_lra')}


def frame_stats(values, t_end, t0, t1, window):
    """Stats of ffmpeg M/S values whose whole window lies inside [t0, t1]."""
    inside = (t_end - window >= t0 - 1e-6) & (t_end <= t1 + 1e-6)
    partial = False
    if not inside.any():  # Section shorter than the window: use windows ending inside it.
        inside, partial = (t_end > t0) & (t_end <= t1 + 1e-6), True
    v = values[inside]
    v = v[v > -120]
    if not len(v):
        return {'median': None, 'max': None, 'min': None, 'partial': partial}
    return {'median': float(np.median(v)), 'max': float(v.max()), 'min': float(v.min()), 'partial': partial}


# ---------------------------------------------------------------- stereo, spectrum, transients

def side_mid_db(x):
    if x.shape[1] < 2:
        return -math.inf
    mid, side = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    return db10(float(np.dot(side, side)) / max(float(np.dot(mid, mid)), 1e-30))


def octave_bands(x, sr):
    """Octave-band levels (dBFS mean-square, channel average), share of total, and side/mid per band."""
    n = len(x)
    if n < 256:
        return None
    nper = min(8192, 1 << int(math.log2(n)))
    f, p = signal.welch(x, fs=sr, nperseg=nper, axis=0)
    df = f[1] - f[0]
    power = p.mean(axis=1)
    if x.shape[1] > 1:
        _, pm = signal.welch((x[:, 0] + x[:, 1]) / 2, fs=sr, nperseg=nper)
        _, ps = signal.welch((x[:, 0] - x[:, 1]) / 2, fs=sr, nperseg=nper)
    total = power.sum() * df
    bands = []
    for fc in OCTAVES:
        lo, hi = fc / math.sqrt(2), fc * math.sqrt(2)
        if lo >= sr / 2:
            break
        sel = (f >= lo) & (f < hi)
        band = power[sel].sum() * df
        row = {'hz': fc, 'dbfs': r(db10(band)), 'share_db': r(db10(band / total) if total > 0 else -math.inf)}
        if x.shape[1] > 1:
            row['side_mid_db'] = r(db10(ps[sel].sum() / max(pm[sel].sum(), 1e-30)))
        bands.append(row)
    return bands


class Transients:
    """1-4 kHz transient energy by harmonic/percussive separation (median filtering, Fitzgerald 2010).

    A spectrogram cell is percussive when the median across 17 frequency bins
    beats the median across 17 frames (~100 ms); the soft mask P^2 / (H^2 + P^2)
    splits the 1-4 kHz power into transient (hats, claps, chops, consonants) and
    sustained parts. Hits are peaks of the transient energy with >= 6 dB prominence."""

    def __init__(self, mono, sr, lo=1000.0, hi=4000.0, n_fft=1024, hop=256, kernel=17):
        from scipy.ndimage import median_filter
        f, t, z = signal.stft(mono, fs=sr, nperseg=n_fft, noverlap=n_fft - hop, boundary=None, padded=False)
        pad = kernel // 2 + 1
        rows = np.flatnonzero((f >= lo) & (f < hi))
        if not len(rows):
            raise ValueError('sample rate too low for the 1-4 kHz band')
        a, b = max(0, rows[0] - pad), min(len(f), rows[-1] + pad + 1)
        power = np.abs(z[a:b]) ** 2
        harm = median_filter(power, size=(1, kernel), mode='reflect')
        perc = median_filter(power, size=(kernel, 1), mode='reflect')
        mask = perc ** 2 / np.maximum(harm ** 2 + perc ** 2, 1e-30)
        band = slice(rows[0] - a, rows[-1] - a + 1)
        self.total = power[band].sum(axis=0)
        self.perc = (mask[band] * power[band]).sum(axis=0)
        self.times = t  # frame centres, seconds
        self.frame_s = hop / sr
        self.filtered = signal.sosfilt(signal.butter(4, [lo, hi], 'bandpass', fs=sr, output='sos'), mono)
        self.sr = sr

    def stats(self, t0, t1):
        sel = (self.times >= t0) & (self.times < t1)
        seg = self.filtered[int(round(t0 * self.sr)):int(round(t1 * self.sr))]
        if sel.sum() < 4 or not len(seg):
            return None
        total, perc = self.total[sel].sum(), self.perc[sel].sum()
        band_db = db10(float((seg ** 2).mean()))
        share = db10(perc / total) if total > 0 else -math.inf
        env = 10 * np.log10(np.maximum(self.perc[sel], 1e-20))
        peaks, _ = signal.find_peaks(env, prominence=6, distance=max(1, round(0.05 / self.frame_s)))
        return {'band_dbfs': band_db, 'transient_dbfs': band_db + share, 'transient_share_db': share,
                'hits_per_s': len(peaks) / (t1 - t0)}


# ---------------------------------------------------------------- whisper

def words(text):
    text = re.sub(r'[-\u2010-\u2014/]', ' ', text.lower().replace('\u2019', "'"))
    text = re.sub(r"[^a-z0-9' ]+", ' ', text)
    return [w.strip("'") for w in text.split() if w.strip("'")]


def edit_ops(ref, hyp):
    """Levenshtein alignment -> (substitutions, deletions, insertions)."""
    n, m = len(ref), len(hyp)
    d = np.zeros((n + 1, m + 1), int)
    d[:, 0], d[0, :] = np.arange(n + 1), np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (ref[i - 1] != hyp[j - 1]))
    s = dl = ins = 0
    i, j = n, m
    while i or j:
        if i and j and d[i, j] == d[i - 1, j - 1] + (ref[i - 1] != hyp[j - 1]):
            s += ref[i - 1] != hyp[j - 1]
            i, j = i - 1, j - 1
        elif i and d[i, j] == d[i - 1, j] + 1:
            dl, i = dl + 1, i - 1
        else:
            ins, j = ins + 1, j - 1
    return int(s), dl, ins


def run_whisper(windows, x, sr, model_name):
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise UsageError('--whisper needs faster-whisper (pip install faster-whisper)') from e
    try:
        model = WhisperModel(model_name, device='cpu', compute_type='int8', local_files_only=True)
    except Exception:
        model = WhisperModel(model_name, device='cpu', compute_type='int8')
    mono = x.mean(axis=1)
    g = math.gcd(16000, sr)
    results = []
    for w in windows:
        a, b = max(0.0, w['start']), min(len(mono) / sr, w['end'])
        audio = signal.resample_poly(mono[int(a * sr):int(b * sr)], 16000 // g, sr // g).astype(np.float32)
        segments, _ = model.transcribe(audio, language='en', beam_size=5, temperature=0.0, vad_filter=False,
                                       condition_on_previous_text=False, without_timestamps=True,
                                       no_speech_threshold=None, log_prob_threshold=None,
                                       compression_ratio_threshold=None)
        hyp_text = ' '.join(s.text.strip() for s in segments).strip()
        ref, hyp = words(w['expected']), words(hyp_text)
        s, d, i = edit_ops(ref, hyp)
        cs, cd, ci = edit_ops(list(''.join(ref)), list(''.join(hyp)))
        results.append({**w, 'start': r(a, 3), 'end': r(b, 3), 'heard': hyp_text,
                        'wer': r((s + d + i) / max(len(ref), 1), 3), 'sub': s, 'del': d, 'ins': i,
                        'cer': r((cs + cd + ci) / max(len(''.join(ref)), 1), 3)})
    return results


# ---------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split('\n', 1)[1])
    ap.add_argument('wav')
    ap.add_argument('--plan', help='render JSON (default: <wav>.json next to the WAV, if present)')
    ap.add_argument('--no-plan', action='store_true', help='ignore a sibling plan JSON')
    ap.add_argument('--sections', help='"Name:from-to,..." in bars (overrides plan.sections)')
    ap.add_argument('--bpm', type=float, help='tempo for bars -> seconds; overrides plan timing (default plan.bpm or 120)')
    ap.add_argument('--offset', type=float, default=0.05, help='file seconds before bar 0 (default 0.05)')
    ap.add_argument('--first-bar', type=float, default=0.0, help='bar at --offset, for --bars excerpts (default 0)')
    ap.add_argument('--silence', action='append', default=[], metavar='A-B', help='silent window(s), comma-separated')
    ap.add_argument('--whisper', action='append', default=[], metavar='A-B:TEXT', help='transcribe a window, report WER')
    ap.add_argument('--whisper-lines', action='store_true', help='add one Whisper window per plan line')
    ap.add_argument('--whisper-model', default='base.en')
    ap.add_argument('--max-wer', type=float, help='make Whisper a gate: FAIL if any window WER exceeds this')
    ap.add_argument('--json', dest='json_out', help='write every number to this file')
    ap.add_argument('--no-loudnorm', action='store_true', help='skip the ffmpeg loudnorm cross-check pass')
    g = ap.add_argument_group('limits')
    g.add_argument('--target-lufs', type=float, default=-10.0)
    g.add_argument('--lufs-tol', type=float, default=1.0)
    g.add_argument('--max-tp', type=float, default=-1.0, help='dBTP')
    g.add_argument('--lra-min', type=float, default=5.0)
    g.add_argument('--lra-max', type=float, default=8.0)
    g.add_argument('--drop-lift', type=float, default=2.5, help='LU the Drop must exceed the Verse by')
    g.add_argument('--phone-hp', type=float, default=300.0)
    g.add_argument('--phone-lp', type=float, default=8000.0)
    g.add_argument('--silence-max', type=float, default=-60.0, help='dBFS sample peak')
    g.add_argument('--side-mid-min', type=float, default=-13.0)
    g.add_argument('--side-mid-max', type=float, default=-10.0)
    g.add_argument('--max-mono-loss', type=float, default=2.0)
    args = ap.parse_args(argv)

    need('ffmpeg')
    if not os.path.isfile(args.wav):
        raise UsageError(f'no such file: {args.wav}')
    sr, x, clipped, fmt_name = load_audio(args.wav)
    n, channels = x.shape
    duration = n / sr
    stereo = x if channels == 2 else np.column_stack([x[:, 0], x[:, 0]])

    plan_path = args.plan or (None if args.no_plan else os.path.splitext(args.wav)[0] + '.json')
    plan = load_plan(plan_path) if plan_path and os.path.isfile(plan_path) else None
    if args.plan and plan is None:
        raise UsageError(f'no such plan: {args.plan}')
    bpm = args.bpm or (plan or {}).get('bpm') or 120.0
    clock = Clock(bpm, args.offset, None if args.bpm else (plan or {}).get('timing'), args.first_bar,
                  (plan or {}).get('swing'))
    if args.sections:
        raw_sections, section_source = parse_sections(args.sections), '--sections'
    elif plan and plan.get('sections'):
        raw_sections = [{'name': s['name'], 'from': float(s.get('from', s.get('start'))), 'to': float(s.get('to', s.get('end')))}
                        for s in plan['sections']]
        section_source = 'plan'
    else:
        raw_sections, section_source = [], 'none'
    sections = []
    for s in raw_sections:
        t0, t1 = clock.at_bar(s['from']), clock.at_bar(s['to'])
        sections.append({**s, 'start': t0, 'end': min(t1, duration), 'truncated': t1 > duration + 1e-6,
                         'missing': t0 >= duration})

    # ---- measurements
    ff = ffmpeg_ebur128(args.wav, sr)
    meter = Loudness(x, sr)
    np_tp_frames = true_peak_frames(x, sr)
    np_tp = db20(float(np_tp_frames.max()))
    mono = (stereo[:, 0] + stereo[:, 1]) / 2
    fold = Loudness(mono[:, None], sr, gain=2.0)  # (L+R)/2 on both speakers
    phone_sos = [signal.butter(4, args.phone_hp, 'highpass', fs=sr, output='sos')]
    if args.phone_lp < sr / 2:
        phone_sos.append(signal.butter(4, args.phone_lp, 'lowpass', fs=sr, output='sos'))
    phone_sig = signal.sosfilt(np.vstack(phone_sos), mono)
    phone = Loudness(phone_sig[:, None], sr)
    hpss = Transients(mono, sr) if sr > 8000 else None  # needs the 1-4 kHz band below Nyquist
    loudnorm = None if args.no_loudnorm else ffmpeg_loudnorm(args.wav)

    def span_stats(t0, t1):
        a, b = int(round(t0 * sr)), int(round(t1 * sr))
        seg = x[a:b]
        ms = float((seg ** 2).mean()) if len(seg) else 0.0
        peak = float(np.abs(seg).max()) if len(seg) else 0.0
        f0, f1 = int(t0 * 10), int(math.ceil(t1 * 10))
        tp = float(np_tp_frames[f0:f1].max()) if f1 > f0 else 0.0
        stereo_i, fold_i = meter.integrated(t0, t1), fold.integrated(t0, t1)
        m_blocks = frame_stats(ff['M'], ff['t_end'], t0, t1, 0.4)
        inside = (ff['t_end'] - 0.4 >= t0 - 1e-6) & (ff['t_end'] <= t1 + 1e-6)
        return {
            'integrated_lufs': stereo_i,
            'integrated_lufs_ffmpeg_blocks': gated_integrated(10 ** ((ff['M'][inside] + 0.691) / 10)),
            'short_term': frame_stats(ff['S'], ff['t_end'], t0, t1, 3.0),
            'momentary': m_blocks,
            'lra_lu': meter.lra(t0, t1),
            'phone_lufs': phone.integrated(t0, t1),
            'side_mid_db': side_mid_db(stereo[a:b]) if channels == 2 else None,
            'mono_fold_loss_db': stereo_i - fold_i if channels == 2 and math.isfinite(stereo_i) and math.isfinite(fold_i) else None,
            'rms_dbfs': db10(ms), 'sample_peak_dbfs': db20(peak), 'true_peak_dbtp': db20(tp),
            'crest_db': db20(peak) - db10(ms) if ms > 0 else None,
            'octaves': octave_bands(x[a:b], sr),
            'transients_1_4k': hpss.stats(t0, t1) if hpss else None,
        }

    overall = span_stats(0.0, duration)
    for s in sections:
        if not s['missing']:
            s.update(span_stats(s['start'], s['end']))

    clip = clip_report(clipped, x, sr)

    silences = []
    for spec in args.silence:
        for item in filter(None, (t.strip() for t in spec.split(','))):
            a, b = parse_span(item, clock)
            ia, ib = int(round(a * sr)), int(round(b * sr))
            seg = x[ia:min(ib, n)]
            silences.append({'span': item, 'start': a, 'end': b, 'inside_file': ib <= n and len(seg) > 0,
                             'peak_dbfs': db20(float(np.abs(seg).max())) if len(seg) else None,
                             'rms_dbfs': db10(float((seg ** 2).mean())) if len(seg) else None})

    windows = []
    for spec in args.whisper:
        span, sep, text = spec.partition(':')
        if not sep or not text.strip():
            raise UsageError(f'bad --whisper "{spec}" (want "A-B:expected text")')
        a, b = parse_span(span, clock)
        windows.append({'label': span.strip(), 'start': a, 'end': b, 'expected': text.strip()})
    if args.whisper_lines:
        if not plan or not plan['lines']:
            raise UsageError('--whisper-lines needs a plan JSON with lines')
        lines = sorted((l for l in plan['lines'] if l.get('words')), key=lambda l: l['words'][0][1])
        spans = [(clock.at_step(l['words'][0][1]), clock.at_step(l['words'][-1][1] + l['words'][-1][2])) for l in lines]
        for i, line in enumerate(lines):
            # 150 ms before the first word, 400 ms of release after the last, never into a neighbour's words.
            a = max(spans[i][0] - 0.15, spans[i - 1][1] if i else 0.0)
            b = min(spans[i][1] + 0.4, spans[i + 1][0] if i + 1 < len(spans) else duration)
            windows.append({'label': f'bar {line["bar"]}', 'start': a, 'end': b,
                            'expected': ' '.join(str(w[0]) for w in line['words'])})
    whisper = run_whisper(windows, stereo, sr, args.whisper_model) if windows else []

    # ---- gates
    gates = []

    def gate(name, status, value, limit, note=''):
        gates.append({'gate': name, 'status': status, 'value': value, 'limit': limit, 'note': note})

    I, TP, LRA = ff['I'], ff['TP'], ff['LRA']
    gate('Integrated loudness', 'PASS' if abs(I - args.target_lufs) <= args.lufs_tol else 'FAIL',
         f'{I:.2f} LUFS', f'{args.target_lufs:g} +-{args.lufs_tol:g}')
    gate('True peak', 'PASS' if TP <= args.max_tp else 'FAIL', f'{TP:+.2f} dBTP', f'<= {args.max_tp:g}')
    gate('Loudness range', 'PASS' if args.lra_min <= LRA <= args.lra_max else 'WARN', f'{LRA:.1f} LU',
         f'{args.lra_min:g}-{args.lra_max:g}')

    present = [s for s in sections if not s['missing']]
    drops = [s for s in present if s['name'].strip().lower().startswith('drop')]
    verses = [s for s in present if s['name'].strip().lower().startswith('verse')]
    drop_vs_verse = []
    if drops and verses:
        ref_mix = gated_integrated(np.concatenate([meter.blocks(0.4, v['start'], v['end']) for v in verses]))
        ref_phone = gated_integrated(np.concatenate([phone.blocks(0.4, v['start'], v['end']) for v in verses]))
        ref_trans = [v['transients_1_4k'] for v in verses if v['transients_1_4k']]
        for d in drops:
            lift, lift_phone = d['integrated_lufs'] - ref_mix, d['phone_lufs'] - ref_phone
            row = {'drop': d['name'], 'verse_lufs': ref_mix, 'drop_lufs': d['integrated_lufs'], 'lift_lu': lift,
                   'verse_phone_lufs': ref_phone, 'drop_phone_lufs': d['phone_lufs'], 'phone_lift_lu': lift_phone,
                   'short_term_median_lift_lu': None}
            st_v = [v['short_term']['median'] for v in verses if v['short_term']['median'] is not None]
            if d['short_term']['median'] is not None and st_v:
                row['short_term_median_lift_lu'] = d['short_term']['median'] - float(np.median(st_v))
            if ref_trans and d['transients_1_4k']:
                vt = ref_trans[0] if len(ref_trans) == 1 else {k: db10(np.mean([10 ** (t[k] / 10) for t in ref_trans]))
                                                               for k in ('band_dbfs', 'transient_dbfs')}
                row['transient_1_4k_lift_db'] = d['transients_1_4k']['transient_dbfs'] - vt['transient_dbfs']
                row['band_1_4k_lift_db'] = d['transients_1_4k']['band_dbfs'] - vt['band_dbfs']
            drop_vs_verse.append(row)
            label = f'{d["name"]} vs Verse'
            gate(f'{label} (mix)', 'PASS' if lift >= args.drop_lift else 'FAIL', f'{lift:+.2f} LU', f'>= +{args.drop_lift:g}')
            gate(f'{label} (phone)', 'PASS' if lift_phone >= args.drop_lift else 'FAIL', f'{lift_phone:+.2f} LU',
                 f'>= +{args.drop_lift:g}', f'mono, HP {args.phone_hp:g} Hz, LP {args.phone_lp:g} Hz')
    else:
        outside = [s['name'] for s in sections if s['missing']]
        gate('Drop vs Verse', 'WARN', '--', f'>= +{args.drop_lift:g}',
             'no sections given' if not sections else 'needs a Drop* and a Verse* section'
             + (f'; outside the file: {", ".join(outside)}' if outside else ''))

    for s in silences:
        ok = s['inside_file'] and s['peak_dbfs'] < args.silence_max
        gate(f'Silence {s["span"]} s', 'PASS' if ok else 'FAIL',
             f'{fmt(s["peak_dbfs"])} dBFS' if s['peak_dbfs'] is not None else 'outside file', f'< {args.silence_max:g}')

    if channels < 2:
        gate('Stereo checks', 'WARN', 'mono file', '--', 'side/mid and mono fold-down need two channels')
    else:
        for d in drops:
            v = d['side_mid_db']
            gate(f'Side/mid {d["name"]}', 'PASS' if args.side_mid_min <= v <= args.side_mid_max else 'WARN',
                 f'{fmt(v)} dB', f'{args.side_mid_min:g} to {args.side_mid_max:g}')
        for label, s in [('overall', overall)] + [(d['name'], d) for d in drops]:
            v = s['mono_fold_loss_db']
            gate(f'Mono fold-down loss {label}', 'PASS' if v is not None and v < args.max_mono_loss else 'FAIL',
                 f'{fmt(v, 2)} dB', f'< {args.max_mono_loss:g}')
    gate('Clipped samples', 'PASS' if clip['clipped_samples'] == 0 else 'FAIL', str(clip['clipped_samples']), '0',
         f'{clip["clip_events"]} events, first at {clip["first_clips_s"][:3]} s' if clip['clipped_samples'] else '')
    if args.max_wer is not None and whisper:
        worst = max(w['wer'] for w in whisper)
        gate('Whisper WER (worst window)', 'PASS' if worst <= args.max_wer else 'FAIL', f'{worst:.2f}', f'<= {args.max_wer:g}')

    cross = {'ffmpeg': {'I': ff['I'], 'LRA': ff['LRA'], 'TP': ff['TP']},
             'ffmpeg_summary': ff['summary'],
             'numpy': {'I': meter.integrated(), 'LRA': meter.lra(), 'TP': np_tp}, 'loudnorm': loudnorm}
    cross['delta_numpy'] = {k: cross['numpy'][k] - cross['ffmpeg'][k] for k in ('I', 'LRA', 'TP')}
    if loudnorm:
        cross['delta_loudnorm'] = {k: loudnorm[k] - cross['ffmpeg'][k] for k in ('I', 'LRA', 'TP')}
    sec_deltas = [s['integrated_lufs'] - s['integrated_lufs_ffmpeg_blocks'] for s in present
                  if math.isfinite(s['integrated_lufs']) and math.isfinite(s['integrated_lufs_ffmpeg_blocks'])]
    cross['section_max_abs_delta'] = max(map(abs, sec_deltas)) if sec_deltas else None
    worst_i = max([abs(cross['delta_numpy']['I'])] + ([abs(cross['delta_loudnorm']['I'])] if loudnorm else [])
                  + ([cross['section_max_abs_delta']] if sec_deltas else []))
    worst_tp = max([abs(cross['delta_numpy']['TP'])] + ([abs(cross['delta_loudnorm']['TP'])] if loudnorm else []))
    gate('Meter cross-check', 'PASS' if worst_i <= 0.2 and worst_tp <= 0.3 else 'WARN',
         f'dI {worst_i:.2f} LU, dTP {worst_tp:.2f} dB', '<= 0.2 LU, 0.3 dB', 'numpy BS.1770 + ffmpeg loudnorm vs ebur128')

    failed = [g_ for g_ in gates if g_['status'] == 'FAIL']
    warned = [g_ for g_ in gates if g_['status'] == 'WARN']
    result = 'FAIL' if failed else 'PASS'

    # ---- report
    out = print
    out(f'All Hands audio gates: {args.wav}')
    out(f'  {fmt_name}, {sr} Hz, {channels} ch, {duration:.2f} s; plan: {plan["path"] if plan else "none"}; '
        f'sections: {section_source}; time: {clock.source}, offset {args.offset:g} s')
    out(f'\nLoudness   I {I:.2f} LUFS   LRA {LRA:.1f} LU   true peak {TP:+.2f} dBTP   sample peak {ff["SP"]:+.2f} dBFS'
        f'   PLR {TP - I:.1f} dB   crest {fmt(overall["crest_db"])} dB')
    out(f'Stereo     side/mid {fmt(overall["side_mid_db"])} dB   mono fold-down loss {fmt(overall["mono_fold_loss_db"], 2)} dB'
        f'   clipped {clip["clipped_samples"]}   flat-top runs {clip["flat_top_runs"]}')
    if present:
        out('\nSection     bars       seconds         I    S med  S max  M max  phone   S/M  monoL  crest  TP')
        for s in present:
            out(f'{s["name"][:10]:<10} {s["from"]:>4g}-{s["to"]:<4g} {s["start"]:6.2f}-{s["end"]:<6.2f} '
                f'{fmt(s["integrated_lufs"], 1, width=6)} {fmt(s["short_term"]["median"], 1, width=6)} '
                f'{fmt(s["short_term"]["max"], 1, width=6)} {fmt(s["momentary"]["max"], 1, width=6)} '
                f'{fmt(s["phone_lufs"], 1, width=6)} {fmt(s["side_mid_db"], 1, width=5)} '
                f'{fmt(s["mono_fold_loss_db"], 2, width=5)} {fmt(s["crest_db"], 1, width=6)} '
                f'{fmt(s["true_peak_dbtp"], 1, signed=True, width=5)}'
                + ('  (truncated)' if s['truncated'] else '') + ('  (S partial)' if s['short_term']['partial'] else ''))
        out('  I = section-integrated LUFS (BS.1770 gated); S = 3 s short-term, M = 400 ms momentary (ffmpeg);'
            ' phone = I through the phone simulation')
    for d in drop_vs_verse:
        out(f'\n{d["drop"]} vs Verse: mix {d["lift_lu"]:+.2f} LU ({d["verse_lufs"]:.2f} -> {d["drop_lufs"]:.2f}), '
            f'phone {d["phone_lift_lu"]:+.2f} LU ({d["verse_phone_lufs"]:.2f} -> {d["drop_phone_lufs"]:.2f}), '
            f'short-term median {fmt(d["short_term_median_lift_lu"], 2, signed=True)} LU')
        if 'transient_1_4k_lift_db' in d:
            out(f'  1-4 kHz: transient energy {d["transient_1_4k_lift_db"]:+.1f} dB, band energy '
                f'{d["band_1_4k_lift_db"]:+.1f} dB (drop vs verse)')
    rows = [('overall', overall)] + [(s['name'], s) for s in present]
    if overall['octaves']:
        out('\nOctave balance (dB share of total power)')
        out(f'{"":<10}' + ''.join(f'{(f"{b:g}" if b < 1000 else f"{b / 1000:g}k"):>6}' for b in OCTAVES[:len(overall['octaves'])]))
        for name, s in rows:
            if s.get('octaves'):
                out(f'{name[:10]:<10}' + ''.join(fmt(b['share_db'], 1, width=6) for b in s['octaves']))
    out('\n1-4 kHz (HPSS)   band dBFS  transient dBFS  transient share dB  hits/s')
    for name, s in rows:
        t = s.get('transients_1_4k')
        if t:
            out(f'{name[:14]:<14} {fmt(t["band_dbfs"], 1, width=11)} {fmt(t["transient_dbfs"], 1, width=15)} '
                f'{fmt(t["transient_share_db"], 1, width=19)} {t["hits_per_s"]:7.1f}')
    for s in silences:
        out(f'\nSilence {s["start"]:.3f}-{s["end"]:.3f} s: peak {fmt(s["peak_dbfs"])} dBFS, rms {fmt(s["rms_dbfs"])} dBFS')
    if whisper:
        out('\nWhisper ' + args.whisper_model)
        for w in whisper:
            out(f'  {w["label"]:<12} {w["start"]:6.2f}-{w["end"]:<6.2f} WER {w["wer"]:.2f} CER {w["cer"]:.2f}  '
                f'expected "{w["expected"]}"\n{"":<40}heard    "{w["heard"]}"')
    ln = f', loudnorm I {loudnorm["I"]:.2f} TP {loudnorm["TP"]:+.2f} LRA {loudnorm["LRA"]:.1f}' if loudnorm else ''
    out(f'\nCross-check  ebur128 I {I:.2f} TP {TP:+.2f} LRA {LRA:.1f}; numpy I {cross["numpy"]["I"]:.2f} '
        f'TP {np_tp:+.2f} LRA {cross["numpy"]["LRA"]:.1f}{ln}; sections max |dI| {fmt(cross["section_max_abs_delta"], 2)}')
    out('\nGate                               Value                   Limit           Status')
    for g_ in gates:
        out(f'{g_["gate"][:34]:<34} {g_["value"]:<23} {g_["limit"]:<15} {g_["status"]}'
            + (f'  ({g_["note"]})' if g_['note'] and g_['status'] != 'PASS' else ''))
    out(f'\nRESULT {result}: {len(failed)} failed, {len(warned)} warnings, {len(gates)} gates')

    if args.json_out:
        def clean(obj):
            if isinstance(obj, dict):
                return {k: clean(v) for k, v in obj.items()}
            if isinstance(obj, (list, tuple)):
                return [clean(v) for v in obj]
            if isinstance(obj, (float, np.floating)):
                return r(obj, 3)
            if isinstance(obj, np.integer):
                return int(obj)
            return obj
        bars, b = [], math.floor(args.first_bar)
        while clock.at_bar(b + 1) <= duration + 1e-6:
            t0, t1 = clock.at_bar(b), clock.at_bar(b + 1)
            if t0 >= 0:
                bars.append({'bar': b, 'start': t0, 'lufs': meter.integrated(t0, t1), 'phone_lufs': phone.integrated(t0, t1),
                             'momentary_max': frame_stats(ff['M'], ff['t_end'], t0, t1, 0.4)['max']})
            b += 1
        report = {
            'file': os.path.abspath(args.wav), 'format': fmt_name, 'sample_rate': sr, 'channels': channels,
            'duration_s': duration, 'plan': plan['path'] if plan else None, 'section_source': section_source,
            'timing': {'source': clock.source, 'bpm': bpm, 'offset_s': args.offset, 'first_bar': args.first_bar},
            'loudness': {'integrated_lufs': I, 'lra_lu': LRA, 'lra_low': ff['LRA_low'], 'lra_high': ff['LRA_high'],
                         'true_peak_dbtp': TP, 'sample_peak_dbfs': ff['SP'], 'plr_db': TP - I},
            'overall': {k: v for k, v in overall.items() if k not in ('short_term', 'momentary')},
            'clipping': clip, 'sections': present, 'drop_vs_verse': drop_vs_verse, 'silence': silences,
            'whisper': whisper, 'crosscheck': cross, 'bars': bars, 'gates': gates, 'result': result,
        }
        with open(args.json_out, 'w') as f:
            json.dump(clean(report), f, indent=1)
        out(f'JSON: {args.json_out}')
    return 1 if failed else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except UsageError as e:
        print(f'measure-allhands: {e}', file=sys.stderr)
        sys.exit(2)
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as e:
        print(f'measure-allhands: {e}', file=sys.stderr)
        sys.exit(2)
