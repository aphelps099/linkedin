#!/usr/bin/env python3
"""Offline film mixer: render a JSON cue sheet of real recordings to a 48 kHz stereo 24-bit WAV.

    python3 mix.py cues.json --out out.wav [--frames 1440]

No sound is synthesized here. Every signal in the output comes from a
recording named in the cue sheet. The only operations are editing, gain,
fades, panning, filtering, pitch and time processing of those recordings
(through ffmpeg), convolution with a *recorded* impulse response, dynamics
and loudness normalisation. There is deliberately no click track, test
tone, noise, comfort noise or dither. The beat grid goes to a CSV instead.

Timebase
    48 kHz, 24 fps, 2000 samples per film frame. Film frame f (1-indexed)
    covers samples [(f-1)*2000, f*2000). The default length is 1440 frames
    (2,880,000 samples, exactly 60.000 s).

Cue sheet (top level, all optional except "cues")
    frames          film length in frames (the --frames flag overrides it)
    library_root    relative "file" paths resolve here first, then next to the cue sheet
    manifest        licence manifest (default <library_root>/manifest.json)
    grid            {"bpm": 90, "zero_frame": 1, "beats_per_bar": 4} for the CSVs
    buses           {"music": {"gain_db": -3, "automation": {...}}, "sfx": {...}, "ambience": {...}}
    lanes           named automation presets that cues and buses can reference
    reverbs         {"name": {"ir": "auto" | path, "match": "hall", "src_in": 0, "src_out": null,
                     "gain_db": 0, "predelay_ms": 0, "highpass_hz": null, "lowpass_hz": null,
                     "return_bus": "sfx"}}
                    "auto" searches the manifest for recorded IRs (kind "ir" or a /ir/ folder).
                    If none is found, the reverb is disabled and every send to it is skipped.
    master          {"lufs": -14, "true_peak_dbtp": -1.0, "normalize": true,
                     "glue": {"enabled": false, "threshold_db": -16, "ratio": 1.5, "knee_db": 6,
                              "attack_ms": 30, "release_ms": 250, "rms_ms": 5},
                     "limiter": {"lookahead_ms": 3.0, "release_ms": 120}}
    calibration_ref {"file": ..., "src_in": ..., "src_out": ...}: reference recording for the
                    latency calibration of rubberband (default: the first music cue's file)

Cue fields
    file            recording (absolute path, or relative to library_root or to the cue sheet)
    id              name used in reports (default c###-<file stem>)
    bus             "music" | "sfx" | "ambience" | any bus in "buses" (default from the path)
    src_in, src_out region of the source in seconds (default the whole file)
    at_frame        film frame where the cue's anchor lands (float allowed; frame 1 = 0 s)
    offset_ms       extra fine offset added to at_frame
    anchor_s        source time that lands on at_frame (default src_in). "onset" or "peak"
                    detects the first transient or the loudest point of the processed region
    anchor_onset_db threshold re the region peak for "onset" (default -20)
    end_frame       hard stop: the cue is silent from the first sample of this frame
    duration_frames alternative to end_frame, counted from at_frame
    guard_ms        silence before the hard stop (fade_out ends guard_ms before it)
    gain_db         static gain
    fade_in, fade_out          fades in film frames (float); or fade_in_ms / fade_out_ms,
                               or fade_in_samples / fade_out_samples
    fade_shape      "cos" (raised cosine, default) | "lin" | "eqp" | "log"
    pan             -1..1 constant-power pan for mono sources, balance for stereo sources
    width           stereo width for stereo sources (0 = mono, 1 = as recorded)
    channels        "stereo" (default) | "mono" (fold down, then pan) | "L" | "R"
    pitch_semitones pitch change
    speed           tempo factor (>1 is faster)
    pitch_mode      "stretch" (default): rubberband, pitch and duration independent,
                    latency auto-aligned (within a few ms).
                    "tape": varispeed resample at 2**(pitch/12), so a pitch-down is also
                    slower, as with tape. Timing is sample-exact. "speed" then applies on top
                    as a rubberband tempo change.
    rb_options      extra ffmpeg rubberband options, e.g. "transients=smooth:window=long"
    reverse         play the region backwards
    loop            loop the region (ambiences) until end_frame / duration / film end
    loop_xfade_ms   equal-power crossfade at each loop seam (default 250)
    lowpass_hz, highpass_hz    static filters (value or null); slopes via lowpass_slope /
                               highpass_slope = 12 | 24 (default) | 36 | 48 dB/oct
    eq              static RBJ bands [{"type": "peak"|"lowshelf"|"highshelf"|"notch",
                                       "hz": f, "gain_db": g, "q": q}]
    reverb, reverb_send        reverb name (default the only one defined) and static send in dB
    automation      lanes keyed by FILM frame (or a "lanes" preset name, or {"$ref": name, ...}):
                    gain_db (added to gain_db), lowpass_hz, highpass_hz, reverb_send (dB), pan.
                    Each lane is [[frame, value], [frame, value, shape], ...] or {"frame": value}.
                    shape (of the segment arriving at that point): "lin" (default; log-frequency
                    for filters) | "smooth" | "ease_in" | "ease_out" | "step".
                    Filter value null / "open" = filter bypassed (crossfaded in and out over 10 ms).
                    Filters use a TPT state-variable biquad cascade whose coefficients are
                    interpolated per sample between 32-sample control blocks (no zipper noise).
    mute            skip this cue

Signal flow per cue: region -> reverse -> pitch/speed -> loop -> fades and hard stop ->
HP/LP lanes -> EQ -> stop gate -> gain lane -> width/pan -> bus (+ post-fader reverb send).
Buses: sum + reverb returns -> bus lanes -> bus gain -> master. Master: glue (optional) ->
gain -> true-peak limiter at -1 dBTP, iterated until the integrated loudness hits the target
(-14 LUFS by default) -> 24-bit PCM, rounded with no dither (nothing synthesized, not even dither).

Outputs: the WAV, <out>.report.json (loudness, true peak, limiter, cue placements, hard-stop
checks, licences and credits, warnings), <out>_beatgrid.csv (beat grid with cue events and the
measured music onset per beat) and <out>_cues.csv (one row per cue). --stems DIR writes
pre-master bus stems as float WAVs.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import subprocess
import sys
import time

import numpy as np

SR = 48000
FPS = 24
SPF = SR // FPS  # 2000 samples per film frame
DEFAULT_FRAMES = 1440
CACHE_DIR = os.environ.get('SYNERGY_MIX_CACHE',
                           os.path.join(os.path.expanduser('~'), '.cache', 'synergy-film-mix'))
os.makedirs(CACHE_DIR, exist_ok=True)
os.environ.setdefault('NUMBA_CACHE_DIR', os.path.join(CACHE_DIR, 'numba'))

import numba  # noqa: E402
import pyloudnorm as pyln  # noqa: E402
import soundfile as sf  # noqa: E402
from scipy import signal as ss  # noqa: E402
from scipy.ndimage import minimum_filter1d  # noqa: E402

DECODE_VERSION = 'dec-v1-soxr28'
PROC_VERSION = 'proc-v1'
LP_OPEN_HZ = 20000.0
HP_OPEN_HZ = 10.0
CONTROL_BLOCK = 32          # samples between exact coefficient evaluations
FILTER_XFADE_MS = 10.0      # crossfade when a filter engages / bypasses
DECLICK_MS = 1.0            # ramp applied to "step" moves of gain/pan/send lanes
BUTTERWORTH_Q = {12: [0.7071067811865476],
                 24: [0.5411961001461970, 1.3065629648763766],
                 36: [0.5176380902050415, 0.7071067811865476, 1.9318516525781366],
                 48: [0.5097955791041592, 0.6013448869350453, 0.8999762231364156, 2.5629154477415055]}
DEFAULT_RB = 'transients=crisp:detector=compound:phase=laminar:window=standard:pitchq=quality:channels=together'

CUE_KEYS = {'file', 'id', 'bus', 'src_in', 'src_out', 'at_frame', 'offset_ms', 'anchor_s', 'anchor_onset_db',
            'end_frame', 'duration_frames', 'guard_ms', 'guard_samples', 'gain_db', 'fade_in', 'fade_out',
            'fade_in_ms', 'fade_out_ms', 'fade_in_samples', 'fade_out_samples', 'fade_shape', 'pan', 'width',
            'channels', 'pitch_semitones', 'speed', 'pitch_mode', 'rb_options', 'reverse', 'loop', 'loop_xfade_ms',
            'lowpass_hz', 'highpass_hz', 'lowpass_slope', 'highpass_slope', 'eq', 'reverb', 'reverb_send',
            'automation', 'mute', 'note', 'notes', 'comment', '_comment', 'align', 'latency_ms'}
LANE_KEYS = {'gain_db', 'lowpass_hz', 'highpass_hz', 'reverb_send', 'pan'}

WARNINGS: list[str] = []


def warn(msg):
    WARNINGS.append(msg)
    print('WARNING:', msg, file=sys.stderr)


def db2lin(db):
    return 10.0 ** (np.asarray(db, dtype=np.float64) / 20.0)


def lin2db(x, floor=-200.0):
    x = np.asarray(x, dtype=np.float64)
    with np.errstate(divide='ignore'):
        return np.maximum(20.0 * np.log10(np.abs(x)), floor)


def frame_to_sample(frame):
    return (float(frame) - 1.0) * SPF


# ----------------------------------------------------------------------------------------------
# numba kernels
# ----------------------------------------------------------------------------------------------

@numba.njit(cache=True)
def _svf(x, g, k, highpass, s1, s2):
    """Cytomic/Simper TPT state-variable filter, one 2nd-order section, per-sample g."""
    n, nch = x.shape
    y = np.empty_like(x)
    for c in range(nch):
        ic1 = s1[c]
        ic2 = s2[c]
        for i in range(n):
            gi = g[i]
            a1 = 1.0 / (1.0 + gi * (gi + k))
            a2 = gi * a1
            a3 = gi * a2
            v0 = x[i, c]
            v3 = v0 - ic2
            v1 = a1 * ic1 + a2 * v3
            v2 = ic2 + a2 * ic1 + a3 * v3
            ic1 = 2.0 * v1 - ic1
            ic2 = 2.0 * v2 - ic2
            if highpass:
                y[i, c] = v0 - k * v1 - v2
            else:
                y[i, c] = v2
        s1[c] = ic1
        s2[c] = ic2
    return y


@numba.njit(cache=True)
def _slew(x, step, x0):
    y = np.empty_like(x)
    v = x0
    for i in range(x.shape[0]):
        t = x[i]
        if t > v + step:
            v += step
        elif t < v - step:
            v -= step
        else:
            v = t
        y[i] = v
    return y


@numba.njit(cache=True)
def _release(h, a):
    r = np.empty_like(h)
    v = h[0]
    for i in range(h.shape[0]):
        rec = v + (1.0 - v) * (1.0 - a)
        v = h[i] if h[i] < rec else rec
        r[i] = v
    return r


@numba.njit(cache=True)
def _glue(level_db, thr, ratio, knee, a_att, a_rel):
    n = level_db.shape[0]
    out = np.empty(n)
    yl = 0.0
    for i in range(n):
        xg = level_db[i]
        d = xg - thr
        if 2.0 * d < -knee:
            yg = xg
        elif 2.0 * abs(d) <= knee:
            yg = xg + (1.0 / ratio - 1.0) * (d + knee / 2.0) ** 2 / (2.0 * knee)
        else:
            yg = thr + d / ratio
        xl = xg - yg
        if xl > yl:
            yl = a_att * yl + (1.0 - a_att) * xl
        else:
            yl = a_rel * yl + (1.0 - a_rel) * xl
        out[i] = -yl
    return out


# ----------------------------------------------------------------------------------------------
# decoding and processing (ffmpeg), with a disk cache
# ----------------------------------------------------------------------------------------------

def _run(cmd, data=None):
    p = subprocess.run(cmd, input=data, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f'ffmpeg failed: {" ".join(cmd)}\n{p.stderr.decode(errors="replace")[-2000:]}')
    return p.stdout


def _key(*parts):
    return hashlib.sha1('|'.join(str(p) for p in parts).encode()).hexdigest()[:24]


_MEM = {}


def probe_channels(path):
    out = _run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels',
                '-of', 'json', path])
    return int(json.loads(out)['streams'][0]['channels'])


def decode(path):
    """Decode the first audio stream to float32 at 48 kHz (soxr, precision 28); >2 channels fold to stereo."""
    st = os.stat(path)
    key = _key(DECODE_VERSION, os.path.abspath(path), st.st_size, int(st.st_mtime))
    if key in _MEM:
        return _MEM[key]
    cpath = os.path.join(CACHE_DIR, 'dec', key + '.npy')
    if os.path.exists(cpath):
        x = np.load(cpath)
    else:
        ch = probe_channels(path)
        och = 2 if ch > 2 else ch
        raw = _run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', path, '-map', '0:a:0', '-vn',
                    '-ac', str(och), '-af', 'aresample=resampler=soxr:precision=28', '-ar', str(SR),
                    '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1'])
        x = np.frombuffer(raw, dtype='<f4').reshape(-1, och).copy()
        os.makedirs(os.path.dirname(cpath), exist_ok=True)
        np.save(cpath, x)
    _MEM[key] = (x, key)
    return _MEM[key]


def ffmpeg_af(x, af):
    ch = x.shape[1]
    raw = _run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR),
                '-ac', str(ch), '-i', 'pipe:0', '-af', af, '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), 'pipe:1'],
               np.ascontiguousarray(x, dtype='<f4').tobytes())
    return np.frombuffer(raw, dtype='<f4').reshape(-1, ch).copy()


def _flux(x, hop=24):
    m = x.mean(axis=1) if x.ndim == 2 else x
    _, _, Z = ss.stft(m.astype(np.float64), SR, nperseg=512, noverlap=512 - hop, boundary=None, padded=False)
    M = np.log1p(100.0 * np.abs(Z))
    return np.maximum(0.0, np.diff(M, axis=1)).sum(axis=0)


def flux_lag(src, out, rate, hop=24, max_ms=80.0):
    """Lag (samples, + = output late) of `out` against `src` time-scaled by `rate` (= len_out/len_src).

    Returns (lag_samples, confidence). Confidence is the normalised correlation at the peak."""
    fa = _flux(src, hop)
    fb = _flux(out, hop)
    if len(fa) < 8 or len(fb) < 8:
        return 0.0, 0.0
    to = np.arange(len(fb))
    fam = np.interp(to / rate, np.arange(len(fa)), fa, right=0.0)
    a = fb - fb.mean()
    b = fam - fam.mean()
    den = math.sqrt(float((a * a).sum() * (b * b).sum())) + 1e-20
    c = ss.correlate(a, b, mode='full', method='fft')
    lags = np.arange(-len(b) + 1, len(a))
    w = np.abs(lags) <= max_ms * SR / 1000.0 / hop
    i = int(np.argmax(np.where(w, c, -np.inf)))
    p = 0.0
    if 0 < i < len(c) - 1:
        y0, y1, y2 = c[i - 1], c[i], c[i + 1]
        dd = y0 - 2 * y1 + y2
        p = 0.5 * (y0 - y2) / dd if dd != 0 else 0.0
    return float((lags[i] + p) * hop), float(c[i] / den)


class Processor:
    """Region extraction + reverse + pitch/speed, cached on disk. Returns (y, rate, info)."""

    def __init__(self, sheet_ctx):
        self.ctx = sheet_ctx
        self.calib_cache_path = os.path.join(CACHE_DIR, 'rb_calibration.json')
        try:
            self.calib = json.load(open(self.calib_cache_path))
        except Exception:
            self.calib = {}

    def region(self, path, src_in, src_out):
        x, dkey = decode(path)
        n = len(x)
        a = int(round(src_in * SR))
        b = n if src_out is None else int(round(src_out * SR))
        if a < 0 or a >= n:
            raise ValueError(f'{path}: src_in {src_in} outside the file (0-{n / SR:.3f} s)')
        if b > n:
            warn(f'{os.path.basename(path)}: src_out {src_out} beyond the end of the file ({n / SR:.3f} s); clamped')
            b = n
        if b <= a:
            raise ValueError(f'{path}: empty region {src_in}-{src_out}')
        return x, dkey, a, b

    def rubberband(self, x, pitch_ratio, tempo, opts):
        parts = []
        if abs(tempo - 1.0) > 1e-9:
            parts.append(f'tempo={tempo:.10f}')
        if abs(pitch_ratio - 1.0) > 1e-9:
            parts.append(f'pitch={pitch_ratio:.10f}')
        if not parts:
            return x
        return ffmpeg_af(x, 'rubberband=' + ':'.join(parts) + (':' + opts if opts else ''))

    def ref_lag(self, pitch_ratio, tempo, opts):
        """Latency of a rubberband setting, measured once on the reference recording."""
        ref = self.ctx.get('calibration_ref')
        if not ref:
            return None
        k = _key('rbcal-v1', ref['file'], ref.get('src_in', 0), ref.get('src_out'), f'{pitch_ratio:.10f}',
                 f'{tempo:.10f}', opts)
        if k in self.calib:
            return self.calib[k]
        x, _, a, b = self.region(ref['file'], ref.get('src_in', 0.0), ref.get('src_out'))
        seg = x[a:b]
        y = self.rubberband(seg, pitch_ratio, tempo, opts)
        lag, conf = flux_lag(seg, y, len(y) / len(seg))
        self.calib[k] = {'lag': lag, 'conf': conf}
        try:
            json.dump(self.calib, open(self.calib_cache_path, 'w'), indent=1)
        except OSError:
            pass
        return self.calib[k]

    def process(self, cue, path):
        src_in = float(cue.get('src_in', 0.0))
        src_out = cue.get('src_out')
        src_out = None if src_out is None else float(src_out)
        x, dkey, a, b = self.region(path, src_in, src_out)
        st = float(cue.get('pitch_semitones', 0.0))
        speed = float(cue.get('speed', 1.0))
        mode = cue.get('pitch_mode', 'stretch')
        opts = cue.get('rb_options', DEFAULT_RB)
        rev = bool(cue.get('reverse', False))
        chsel = cue.get('channels', 'stereo')
        if mode not in ('stretch', 'tape'):
            raise ValueError(f'pitch_mode must be "stretch" or "tape", got {mode!r}')
        if speed <= 0:
            raise ValueError('speed must be > 0')
        info = {'src_samples': [a, b], 'pitch_mode': mode}
        tape_rate = 2.0 ** (st / 12.0) if mode == 'tape' else 1.0
        rb_pitch = 2.0 ** (st / 12.0) if mode == 'stretch' else 1.0
        rate = 1.0 / (tape_rate * speed)  # output length / input length
        key = _key(PROC_VERSION, dkey, a, b, f'{st:.6f}', f'{speed:.8f}', mode, opts, rev, chsel,
                   cue.get('align', 'auto'), cue.get('latency_ms'), json.dumps(self.ctx.get('calibration_ref')))
        cpath = os.path.join(CACHE_DIR, 'proc', key + '.npy')
        jpath = cpath[:-4] + '.json'
        if os.path.exists(cpath) and os.path.exists(jpath):
            info.update(json.load(open(jpath)))
            return np.load(cpath), rate, info
        need_rb = mode == 'stretch' and (abs(rb_pitch - 1) > 1e-9 or abs(speed - 1) > 1e-9) or \
            (mode == 'tape' and abs(speed - 1) > 1e-9)
        need_tape = mode == 'tape' and abs(tape_rate - 1) > 1e-9
        # padding around the region keeps rubberband / resampler edge effects out of it
        pad = int(0.25 * SR) if (need_rb or need_tape) else 0
        pa, pb = max(0, a - pad), min(len(x), b + pad)
        seg = x[pa:pb].astype(np.float32)
        # pad with digital silence where the file has no material before/after the region
        seg = np.concatenate([np.zeros((pad - (a - pa), seg.shape[1]), np.float32), seg,
                              np.zeros((pad - (pb - b), seg.shape[1]), np.float32)]) if pad else seg
        if chsel == 'mono' and seg.shape[1] == 2:
            seg = seg.mean(axis=1, keepdims=True)
        elif chsel in ('L', 'R') and seg.shape[1] == 2:
            seg = seg[:, [0 if chsel == 'L' else 1]]
        if rev:
            seg = seg[::-1].copy()
        y = seg
        lag_info = None
        if need_tape:
            # varispeed: relabel the rate, resample back to 48 kHz with soxr (sample-exact timing)
            y = ffmpeg_af(y, f'asetrate={int(round(SR * tape_rate))},aresample={SR}:resampler=soxr:precision=28')
        if need_rb:
            y_in = y
            p_ratio = rb_pitch if mode == 'stretch' else 1.0
            y = self.rubberband(y_in, p_ratio, speed, opts)
            if cue.get('latency_ms') is not None:
                lag = float(cue['latency_ms']) * SR / 1000.0
                lag_info = {'lag_ms': lag * 1000 / SR, 'method': 'manual'}
            elif cue.get('align', 'auto') == 'none':
                lag = 0.0
                lag_info = {'lag_ms': 0.0, 'method': 'none'}
            else:
                own_lag, conf = flux_lag(y_in, y, len(y) / max(1, len(y_in)))
                if conf >= 0.45:
                    lag = own_lag
                    lag_info = {'lag_ms': lag * 1000 / SR, 'method': 'own-material', 'confidence': round(conf, 3)}
                else:
                    ref = self.ref_lag(p_ratio, speed, opts)
                    if ref is not None and ref['conf'] >= 0.45:
                        lag = ref['lag']
                        lag_info = {'lag_ms': lag * 1000 / SR, 'method': 'reference',
                                    'confidence': round(ref['conf'], 3), 'own_confidence': round(conf, 3)}
                    else:
                        lag = 0.0
                        lag_info = {'lag_ms': 0.0, 'method': 'uncalibrated', 'own_confidence': round(conf, 3)}
                        warn(f'{cue.get("id")}: rubberband latency could not be calibrated; timing may be off by '
                             f'up to ~20 ms (use pitch_mode "tape" or latency_ms)')
            # compensate: drop `lag` samples from the start (negative lag: prepend silence)
            li = int(round(lag))
            if li > 0:
                y = y[li:]
            elif li < 0:
                y = np.concatenate([np.zeros((-li, y.shape[1]), y.dtype), y])
        if pad:
            p_out = int(round(pad * rate))
            n_out = int(round((b - a) * rate))
            y = y[p_out:p_out + n_out]
            if len(y) < n_out:
                y = np.concatenate([y, np.zeros((n_out - len(y), y.shape[1]), y.dtype)])
        y = np.ascontiguousarray(y, dtype=np.float32)
        meta = {'rate': rate, 'out_samples': int(len(y))}
        if lag_info:
            meta['rubberband_latency'] = lag_info
        os.makedirs(os.path.dirname(cpath), exist_ok=True)
        np.save(cpath, y)
        json.dump(meta, open(jpath, 'w'))
        info.update(meta)
        return y, rate, info


# ----------------------------------------------------------------------------------------------
# automation lanes
# ----------------------------------------------------------------------------------------------

def _is_open(v):
    return v is None or (isinstance(v, str) and v.lower() in ('open', 'off', 'bypass', 'none'))


class Lane:
    KINDS = {'gain_db': 'db', 'reverb_send': 'send', 'pan': 'lin', 'lowpass_hz': 'lp', 'highpass_hz': 'hp'}

    def __init__(self, name, spec, frames_total):
        self.name = name
        self.kind = self.KINDS[name]
        pts = []
        if isinstance(spec, (int, float)) or spec is None or isinstance(spec, str):
            spec = [[1, spec]]
        if isinstance(spec, dict):
            spec = [[float(k), v] for k, v in spec.items()]
        for p in spec:
            if not isinstance(p, (list, tuple)) or len(p) < 2:
                raise ValueError(f'lane {name}: bad point {p!r}')
            fr, val = float(p[0]), p[1]
            shape = p[2] if len(p) > 2 else 'lin'
            if shape not in ('lin', 'smooth', 'ease_in', 'ease_out', 'step'):
                raise ValueError(f'lane {name}: unknown shape {shape!r}')
            if fr < 1 or fr > frames_total + 1:
                warn(f'lane {name}: point at frame {fr} is outside the film (1-{frames_total})')
            pts.append((frame_to_sample(fr), val, shape))
        pts.sort(key=lambda t: t[0])
        self.pos = np.array([p[0] for p in pts])
        self.open = np.array([_is_open(p[1]) for p in pts])
        self.shape = [p[2] for p in pts]
        self.val = np.array([self._t(p[1]) for p in pts], dtype=np.float64)
        self.declick = int(DECLICK_MS * SR / 1000) if self.kind in ('db', 'send', 'lin') else 0

    def _t(self, v):
        if self.kind == 'lp':
            return math.log(LP_OPEN_HZ if _is_open(v) else min(max(float(v), 10.0), LP_OPEN_HZ))
        if self.kind == 'hp':
            return math.log(HP_OPEN_HZ if _is_open(v) else min(max(float(v), HP_OPEN_HZ), 20000.0))
        if self.kind in ('db', 'send'):
            if v is None or (isinstance(v, str) and v.lower() in ('off', '-inf', 'mute')):
                return -120.0
            return float(v)
        return float(v)

    def eval(self, t):
        """Value (transformed domain) at absolute sample positions t (sorted ascending)."""
        t = np.asarray(t, dtype=np.float64)
        out = np.empty(len(t))
        pos, val = self.pos, self.val
        idx = np.searchsorted(t, pos, side='left')
        out[:idx[0]] = val[0]
        out[idx[-1]:] = val[-1]
        for i in range(len(pos) - 1):
            s, e = idx[i], idx[i + 1]
            if e <= s:
                continue
            shape = self.shape[i + 1]
            if shape == 'step':
                out[s:e] = val[i]
                continue
            span = pos[i + 1] - pos[i]
            u = (t[s:e] - pos[i]) / span if span > 0 else np.ones(e - s)
            if shape == 'smooth':
                u = 0.5 - 0.5 * np.cos(np.pi * u)
            elif shape == 'ease_in':
                u = u * u
            elif shape == 'ease_out':
                u = 1 - (1 - u) ** 2
            out[s:e] = val[i] + (val[i + 1] - val[i]) * u
        if self.declick:
            for i in range(1, len(pos)):
                if self.shape[i] != 'step' or val[i] == val[i - 1]:
                    continue
                s = idx[i]
                e = min(len(t), s + self.declick)
                if e > s:
                    start_v = val[i - 1]
                    end_v = out[e - 1] if e < len(t) else val[i]
                    out[s:e] = np.linspace(start_v, end_v, e - s + 1)[1:]
        return out

    def wet(self, t):
        """Filter engagement target (1 = filtering, 0 = bypass) at sample positions t."""
        t = np.asarray(t, dtype=np.float64)
        out = np.empty(len(t))
        idx = np.searchsorted(t, self.pos, side='left')
        out[:idx[0]] = 0.0 if self.open[0] else 1.0
        out[idx[-1]:] = 0.0 if self.open[-1] else 1.0
        for i in range(len(self.pos) - 1):
            s, e = idx[i], idx[i + 1]
            if self.shape[i + 1] == 'step':
                out[s:e] = 0.0 if self.open[i] else 1.0
            else:
                out[s:e] = 0.0 if (self.open[i] and self.open[i + 1]) else 1.0
        return out


def resolve_automation(spec, presets, where):
    if spec is None:
        return {}
    if isinstance(spec, str):
        if spec not in presets:
            raise ValueError(f'{where}: unknown lanes preset {spec!r}')
        return dict(presets[spec])
    spec = dict(spec)
    base = {}
    if '$ref' in spec:
        ref = spec.pop('$ref')
        if ref not in presets:
            raise ValueError(f'{where}: unknown lanes preset {ref!r}')
        base = dict(presets[ref])
    base.update(spec)
    for k in base:
        if k not in LANE_KEYS:
            raise ValueError(f'{where}: unknown automation lane {k!r} (known: {sorted(LANE_KEYS)})')
    return base


# ----------------------------------------------------------------------------------------------
# filters
# ----------------------------------------------------------------------------------------------

def filter_lane(x, s0, lane: Lane, slope):
    """Apply a (possibly time-varying) HP or LP lane to x, whose first sample is at absolute s0."""
    n = len(x)
    if n == 0:
        return x
    t = s0 + np.arange(n, dtype=np.float64)
    wet_t = lane.wet(t)
    if not wet_t.any():
        return x
    xf = FILTER_XFADE_MS * SR / 1000.0
    wet = _slew(wet_t, 1.0 / xf, float(wet_t[0]))
    # coefficients: exact at control-block edges, interpolated per sample in between
    nb = n // CONTROL_BLOCK + 2
    tb = s0 + np.arange(nb, dtype=np.float64) * CONTROL_BLOCK
    fc = np.exp(lane.eval(tb))
    fc = np.clip(fc, 10.0, 0.45 * SR)
    gb = np.tan(np.pi * fc / SR)
    g = np.interp(t, tb, gb)
    if slope not in BUTTERWORTH_Q:
        raise ValueError(f'filter slope must be one of {sorted(BUTTERWORTH_Q)}')
    y = np.ascontiguousarray(x, dtype=np.float64)
    hp = lane.kind == 'hp'
    for q in BUTTERWORTH_Q[slope]:
        s1 = np.zeros(y.shape[1])
        s2 = np.zeros(y.shape[1])
        y = _svf(y, g, 1.0 / q, hp, s1, s2)
    if np.all(wet == 1.0):
        return y
    return y * wet[:, None] + x * (1.0 - wet[:, None])


def rbj_sos(band):
    typ = band['type']
    f0 = float(band['hz'])
    gdb = float(band.get('gain_db', 0.0))
    q = float(band.get('q', 0.7071))
    A = 10 ** (gdb / 40)
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if typ == 'peak':
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif typ == 'notch':
        b = [1, -2 * cw, 1]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif typ in ('lowshelf', 'highshelf'):
        sA = 2 * np.sqrt(A) * alpha
        if typ == 'lowshelf':
            b = [A * ((A + 1) - (A - 1) * cw + sA), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sA)]
            a = [(A + 1) + (A - 1) * cw + sA, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sA]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + sA), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sA)]
            a = [(A + 1) - (A - 1) * cw + sA, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sA]
    else:
        raise ValueError(f'unknown eq type {typ!r}')
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


# ----------------------------------------------------------------------------------------------
# envelopes, pan
# ----------------------------------------------------------------------------------------------

def fade_curve(n, shape, fade_in):
    if n <= 0:
        return np.ones(0)
    u = (np.arange(n) + 0.5) / n
    if shape == 'cos':
        c = 0.5 * (1 - np.cos(np.pi * u))
    elif shape == 'lin':
        c = u
    elif shape == 'eqp':
        c = np.sin(0.5 * np.pi * u)
    elif shape == 'log':
        c = db2lin(-60.0 * (1 - u)) * u  # dB-linear, landing exactly on 0 at the far end
    else:
        raise ValueError(f'unknown fade_shape {shape!r}')
    return c if fade_in else c[::-1]


def fade_len(cue, which):
    if cue.get(f'fade_{which}_samples') is not None:
        return int(cue[f'fade_{which}_samples'])
    if cue.get(f'fade_{which}_ms') is not None:
        return int(round(float(cue[f'fade_{which}_ms']) * SR / 1000.0))
    return int(round(float(cue.get(f'fade_{which}', 0.0)) * SPF))


def pan_gains(pan, nch):
    pan = np.clip(np.asarray(pan, dtype=np.float64), -1.0, 1.0)
    th = (pan + 1.0) * np.pi / 4.0
    if nch == 1:
        return np.cos(th), np.sin(th)
    return np.minimum(1.0, np.sqrt(2) * np.cos(th)), np.minimum(1.0, np.sqrt(2) * np.sin(th))


def detect_anchor(y, mode, onset_db=-20.0):
    env = np.abs(y).max(axis=1).astype(np.float64)
    if len(env) == 0 or env.max() <= 0:
        return 0
    k = 12
    sm = np.convolve(env, np.ones(k) / k, mode='same')
    pk = int(np.argmax(sm))
    if mode == 'peak':
        return pk
    thr = sm[pk] * 10 ** (onset_db / 20.0)
    i = int(np.argmax(sm >= thr))
    # backtrack along the monotonic rise to the start of the attack (at most 5 ms)
    j0 = max(0, i - int(0.005 * SR))
    while i > j0 and sm[i - 1] < sm[i]:
        i -= 1
    return i


# ----------------------------------------------------------------------------------------------
# master: loudness, true peak, glue, limiter
# ----------------------------------------------------------------------------------------------

def true_peak_series(x, os_factor=4):
    xs = ss.resample_poly(x, os_factor, 1, axis=0, window=('kaiser', 10.0))
    a = np.abs(xs).max(axis=1)
    half = os_factor // 2
    a = np.concatenate([np.zeros(half), a, np.zeros(os_factor)])
    return a[:len(x) * os_factor].reshape(len(x), os_factor).max(axis=1)


def true_peak_db(x, os_factor=4):
    if len(x) == 0:
        return -200.0
    xs = ss.resample_poly(x, os_factor, 1, axis=0, window=('kaiser', 10.0))
    return float(lin2db(np.abs(xs).max()))


def loudness_stats(y):
    meter = pyln.Meter(SR)
    out = {'integrated_lufs': float(meter.integrated_loudness(y))}
    k = np.array(y, dtype=np.float64, copy=True)
    for f in meter._filters.values():
        for c in range(k.shape[1]):
            k[:, c] = f.apply_filter(k[:, c])
    p = (k ** 2).sum(axis=1)
    cs = np.concatenate([[0.0], np.cumsum(p)])

    def win(nw, hop):
        st = np.arange(0, len(p) - nw + 1, hop)
        e = (cs[st + nw] - cs[st]) / nw
        with np.errstate(divide='ignore'):
            return -0.691 + 10 * np.log10(e + 1e-30)

    M = win(int(0.4 * SR), int(0.1 * SR))
    S = win(3 * SR, int(0.1 * SR))
    out['max_momentary_lufs'] = float(M.max())
    out['max_short_term_lufs'] = float(S.max())
    sa = S[S > -70]
    if len(sa):
        rel = 10 * np.log10(np.mean(10 ** (sa / 10))) - 20
        sg = sa[sa > rel]
        out['lra_lu'] = float(np.percentile(sg, 95) - np.percentile(sg, 10)) if len(sg) else 0.0
    else:
        out['lra_lu'] = 0.0
    return out


def lufs(y):
    try:
        return float(pyln.Meter(SR).integrated_loudness(y))
    except Exception:
        return -np.inf


def glue(x, cfg):
    rms_n = max(1, int(cfg.get('rms_ms', 5.0) * SR / 1000))
    p = (x ** 2).mean(axis=1)
    cs = np.concatenate([[0.0], np.cumsum(p)])
    idx = np.arange(len(p))
    lo = np.maximum(0, idx - rms_n + 1)
    ms = (cs[idx + 1] - cs[lo]) / (idx + 1 - lo)
    lvl = 10 * np.log10(ms + 1e-30)
    a_att = math.exp(-1.0 / (cfg.get('attack_ms', 30.0) * SR / 1000))
    a_rel = math.exp(-1.0 / (cfg.get('release_ms', 250.0) * SR / 1000))
    gdb = _glue(lvl, float(cfg.get('threshold_db', -16.0)), float(cfg.get('ratio', 1.5)),
                float(cfg.get('knee_db', 6.0)), a_att, a_rel)
    return x * db2lin(gdb)[:, None], float(-gdb.min())


def limiter(x, ceiling_db, lookahead_ms=3.0, release_ms=120.0):
    """Offline true-peak limiter: look-ahead hold, exponential release, box-smoothed attack.

    For every sample p the applied gain is <= the gain that p's own 4x-oversampled peak needs."""
    L = max(2, int(round(lookahead_ms * SR / 1000)))
    tp = true_peak_series(x)
    g = np.minimum(1.0, db2lin(ceiling_db) / np.maximum(tp, 1e-12))
    # h[n] = min(g[n .. n+L-1]); one extra sample of margin each side for inter-sample peaks
    W = L + 2
    gp = np.concatenate([g, np.ones(W)])
    h = minimum_filter1d(gp, size=W, origin=-(W // 2), mode='nearest')[:len(g)]
    h = np.minimum(h, np.concatenate([[g[0]], g[:-1]]))
    r = _release(h, math.exp(-1.0 / (release_ms * SR / 1000)))
    cs = np.concatenate([np.full(L, r[0]), r])
    c = np.concatenate([[0.0], np.cumsum(cs)])
    s = (c[L:L + len(r)] - c[0:len(r)]) / L  # mean of r[n-L+1 .. n]
    s = np.minimum(s, 1.0)
    return x * s[:, None], s


def master_process(mix, mcfg, report):
    target = float(mcfg.get('lufs', -14.0))
    ceiling = float(mcfg.get('true_peak_dbtp', -1.0))
    lcfg = mcfg.get('limiter', {})
    gcfg = mcfg.get('glue', {}) or {}
    normalize = mcfg.get('normalize', True)
    L0 = lufs(mix)
    info = {'pre_master_lufs': L0, 'target_lufs': target, 'ceiling_dbtp': ceiling}
    if not np.isfinite(L0):
        warn('master is silent; skipping normalisation')
        return mix, info
    G = (target - L0) if normalize else 0.0
    internal_ceiling = ceiling - 0.05
    y = mix
    for it in range(12):
        x = mix * db2lin(G)
        glue_gr = 0.0
        if gcfg.get('enabled'):
            x, glue_gr = glue(x, gcfg)
        y, s = limiter(x, internal_ceiling, lcfg.get('lookahead_ms', 3.0), lcfg.get('release_ms', 120.0))
        L = lufs(y)
        tp = true_peak_db(y)
        if tp > ceiling - 0.01:
            internal_ceiling -= (tp - ceiling) + 0.03
            continue
        if not normalize or abs(L - target) < 0.03:
            break
        G += target - L
    gr = -lin2db(s)
    info.update({'gain_db': G, 'iterations': it + 1, 'glue_max_gr_db': glue_gr,
                 'limiter_max_gr_db': float(gr.max()),
                 'limiter_pct_time_gr_over_1db': float((gr > 1.0).mean() * 100),
                 'limiter_pct_time_gr_over_3db': float((gr > 3.0).mean() * 100),
                 'limiter_internal_ceiling_dbtp': internal_ceiling})
    if gr.max() > 6.0:
        warn(f'limiter reaches {gr.max():.1f} dB of gain reduction: consider trimming the loudest cues '
             f'or lowering the loudness target')
    return y, info


# ----------------------------------------------------------------------------------------------
# the mixer
# ----------------------------------------------------------------------------------------------

def default_bus(path):
    p = path.replace('\\', '/').lower()
    if '/music' in p:
        return 'music'
    if '/ambience' in p:
        return 'ambience'
    return 'sfx'


class Mixer:
    def __init__(self, sheet, sheet_path, frames):
        self.sheet = sheet
        self.sheet_dir = os.path.dirname(os.path.abspath(sheet_path))
        self.frames = frames
        self.N = frames * SPF
        self.lib = os.environ.get('SYNERGY_AUDIO') or sheet.get('library_root')
        if self.lib and not os.path.isabs(self.lib):
            self.lib = os.path.normpath(os.path.join(self.sheet_dir, self.lib))
        self.presets = sheet.get('lanes', {})
        self.manifest = self._load_manifest()
        buses = {'music': {}, 'sfx': {}, 'ambience': {}}
        buses.update(sheet.get('buses', {}))
        self.bus_cfg = buses
        self.buses = {b: np.zeros((self.N, 2)) for b in buses}
        self.cue_info = []
        self.credits = {}
        ctx = {}
        cref = sheet.get('calibration_ref')
        if cref:
            ctx['calibration_ref'] = dict(cref, file=self.resolve(cref['file']))
        else:
            for c in sheet['cues']:
                p = self.resolve(c['file'])
                if (c.get('bus') or default_bus(p)) == 'music' and not c.get('mute'):
                    d = decode(p)[0]
                    mid = len(d) / SR / 2
                    ctx['calibration_ref'] = {'file': p, 'src_in': max(0.0, mid - 10), 'src_out': min(len(d) / SR, mid + 10)}
                    break
        self.proc = Processor(ctx)
        self.reverbs = self._load_reverbs()
        self.sends = {name: np.zeros((self.N, 2)) for name, r in self.reverbs.items() if r['ir'] is not None}

    # -- files & licences --
    def resolve(self, f):
        cands = [f] if os.path.isabs(f) else ([os.path.join(self.lib, f)] if self.lib else []) + \
            [os.path.join(self.sheet_dir, f)]
        for c in cands:
            if os.path.exists(c):
                return os.path.abspath(c)
        raise FileNotFoundError(f'cannot find {f!r} (tried {cands})')

    def _load_manifest(self):
        mp = self.sheet.get('manifest') or (os.path.join(self.lib, 'manifest.json') if self.lib else None)
        if not mp:
            return {}
        mp = mp if os.path.isabs(mp) else os.path.join(self.sheet_dir, mp)
        if not os.path.exists(mp):
            warn(f'manifest {mp} not found; licences cannot be checked')
            return {}
        m = json.load(open(mp))
        files = m.get('files', m if isinstance(m, list) else [])
        return {os.path.abspath(e['path']): e for e in files if 'path' in e}

    def credit(self, path):
        if path in self.credits:
            return self.credits[path]
        e = self.manifest.get(path)
        if e is None:
            warn(f'{path} is not in the licence manifest')
            c = {'file': path, 'license': None}
        else:
            c = {'file': path, 'title': e.get('title'), 'license': e.get('license'),
                 'attribution': e.get('attribution'), 'source_url': e.get('source_url') or e.get('file_url')}
        self.credits[path] = c
        return c

    # -- reverb --
    def _load_reverbs(self):
        out = {}
        for name, cfg in (self.sheet.get('reverbs') or {}).items():
            ir_spec = cfg.get('ir', 'auto')
            path = None
            if ir_spec == 'auto':
                match = (cfg.get('match') or '').lower()
                cands = [p for p, e in self.manifest.items()
                         if (e.get('kind') == 'ir' or '/ir/' in p.replace('\\', '/')) and match in p.lower()
                         and os.path.exists(p)]
                path = sorted(cands)[0] if cands else None
            elif ir_spec:
                path = self.resolve(ir_spec)
            if path is None:
                warn(f'reverb {name!r}: no recorded impulse response in the library; its sends are skipped')
                out[name] = {'ir': None, 'status': 'skipped: no recorded IR available'}
                continue
            x, _ = decode(path)
            a = int(round(float(cfg.get('src_in', 0.0)) * SR))
            b = len(x) if cfg.get('src_out') is None else int(round(float(cfg['src_out']) * SR))
            ir = x[a:b].astype(np.float64)
            if ir.shape[1] == 1:
                ir = np.repeat(ir, 2, axis=1)
            if cfg.get('highpass_hz'):
                ir = filter_lane(ir, 0, Lane('highpass_hz', cfg['highpass_hz'], 10 ** 9), 24)
            if cfg.get('lowpass_hz'):
                ir = filter_lane(ir, 0, Lane('lowpass_hz', cfg['lowpass_hz'], 10 ** 9), 24)
            e = math.sqrt((ir ** 2).sum() / 2.0) + 1e-20
            ir = ir / e * db2lin(cfg.get('gain_db', 0.0))
            pd = int(round(float(cfg.get('predelay_ms', 0.0)) * SR / 1000))
            if pd:
                ir = np.concatenate([np.zeros((pd, 2)), ir])
            self.credit(path)
            out[name] = {'ir': ir, 'path': path, 'return_bus': cfg.get('return_bus', 'sfx'),
                         'status': f'active: {os.path.basename(path)} ({len(ir) / SR:.2f} s)'}
        return out

    # -- one cue --
    def render_cue(self, i, cue):
        unknown = set(cue) - CUE_KEYS
        if unknown:
            warn(f'cue {cue.get("id", i)}: unknown keys {sorted(unknown)} ignored')
        path = self.resolve(cue['file'])
        cid = cue.get('id') or f'c{i:03d}-{os.path.splitext(os.path.basename(path))[0][:40]}'
        cue = dict(cue, id=cid)
        bus = cue.get('bus') or default_bus(path)
        if bus not in self.buses:
            warn(f'cue {cid}: bus {bus!r} not defined; created at 0 dB')
            self.bus_cfg[bus] = {}
            self.buses[bus] = np.zeros((self.N, 2))
        if 'at_frame' not in cue:
            raise ValueError(f'cue {cid}: at_frame is required')
        lic = self.credit(path)
        y, rate, pinfo = self.proc.process(cue, path)
        src_in = float(cue.get('src_in', 0.0))
        src_len_s = (pinfo['src_samples'][1] - pinfo['src_samples'][0]) / SR
        # anchor
        an = cue.get('anchor_s')
        if isinstance(an, str):
            if an not in ('onset', 'peak'):
                raise ValueError(f'cue {cid}: anchor_s must be a number, "onset" or "peak"')
            A = detect_anchor(y, an, float(cue.get('anchor_onset_db', -20.0)))
        elif an is None:
            A = 0
        else:
            rel = float(an) - src_in
            if cue.get('reverse'):
                rel = src_len_s - rel
            A = int(round(rel * SR * rate))
        T0 = int(round(frame_to_sample(cue['at_frame']) + float(cue.get('offset_ms', 0.0)) * SR / 1000.0))
        S = T0 - A
        # end
        hard = None
        if cue.get('end_frame') is not None:
            hard = int(round(frame_to_sample(cue['end_frame'])))
        if cue.get('duration_frames') is not None:
            d_end = int(round(frame_to_sample(cue['at_frame']) + float(cue['duration_frames']) * SPF))
            hard = d_end if hard is None else min(hard, d_end)
        guard = int(cue['guard_samples']) if cue.get('guard_samples') is not None else \
            int(round(float(cue.get('guard_ms', 0.0)) * SR / 1000))
        loop = bool(cue.get('loop', False))
        if loop:
            E = hard if hard is not None else self.N
        else:
            E = S + len(y) if hard is None else min(S + len(y), hard)
        E_eff = E - guard
        if E_eff <= S:
            warn(f'cue {cid}: ends before it starts (start {S}, end {E_eff}); skipped')
            return
        total = E_eff - S
        if loop:
            xf = int(round(float(cue.get('loop_xfade_ms', 250.0)) * SR / 1000))
            x = self.tile(y, total, xf, cid)
        else:
            x = y[:total].astype(np.float64)
        # crop to the film (keep a little pre-roll for filters)
        lo = max(0, -S)
        hi = min(total, self.N - S)
        if hi <= lo:
            warn(f'cue {cid}: lies entirely outside the film; skipped')
            return
        # envelope (pre-filter): fades + hard stop
        env = np.ones(total)
        fi, fo = fade_len(cue, 'in'), fade_len(cue, 'out')
        shape = cue.get('fade_shape', 'cos')
        if fi > 0:
            fi = min(fi, total)
            env[:fi] *= fade_curve(fi, shape, True)
        if fo > 0:
            fo = min(fo, total)
            env[total - fo:] *= fade_curve(fo, shape, False)
        x = x * env[:, None]
        # lanes
        lanes_spec = resolve_automation(cue.get('automation'), self.presets, f'cue {cid}')
        if cue.get('lowpass_hz') is not None and 'lowpass_hz' not in lanes_spec:
            lanes_spec['lowpass_hz'] = cue['lowpass_hz']
        if cue.get('highpass_hz') is not None and 'highpass_hz' not in lanes_spec:
            lanes_spec['highpass_hz'] = cue['highpass_hz']
        lanes = {k: Lane(k, v, self.frames) for k, v in lanes_spec.items()}
        if 'highpass_hz' in lanes:
            x = filter_lane(x, S, lanes['highpass_hz'], int(cue.get('highpass_slope', 24)))
        if 'lowpass_hz' in lanes:
            x = filter_lane(x, S, lanes['lowpass_hz'], int(cue.get('lowpass_slope', 24)))
        for band in cue.get('eq') or []:
            x = ss.sosfilt(rbj_sos(band), x, axis=0)
        if lanes or cue.get('eq'):
            # stop gate: filter tails never pass the cue's end
            gl = min(total, max(1, min(fo if fo > 0 else 96, 96)))
            x[total - gl:] *= fade_curve(gl, 'cos', False)[:, None]
        x = x[lo:hi]
        t = S + lo + np.arange(hi - lo, dtype=np.float64)
        g = db2lin(float(cue.get('gain_db', 0.0)) + (lanes['gain_db'].eval(t) if 'gain_db' in lanes else 0.0))
        # width / pan
        nch = x.shape[1]
        if nch == 2 and cue.get('width') is not None:
            w = float(cue['width'])
            m = 0.5 * (x[:, 0] + x[:, 1])
            s_ = 0.5 * (x[:, 0] - x[:, 1]) * w
            x = np.stack([m + s_, m - s_], axis=1)
        pan = lanes['pan'].eval(t) if 'pan' in lanes else float(cue.get('pan', 0.0))
        gl_, gr_ = pan_gains(pan, nch)
        if nch == 1:
            out = np.stack([x[:, 0] * gl_, x[:, 0] * gr_], axis=1)
        else:
            out = np.stack([x[:, 0] * gl_, x[:, 1] * gr_], axis=1)
        out *= np.asarray(g).reshape(-1, 1) if np.ndim(g) else g
        a0 = S + lo
        self.buses[bus][a0:a0 + len(out)] += out
        # reverb send (post-fader)
        send_info = None
        if self.reverbs and (cue.get('reverb_send') is not None or 'reverb_send' in lanes):
            rname = cue.get('reverb') or (list(self.reverbs)[0] if len(self.reverbs) == 1 else None)
            if rname not in self.reverbs:
                warn(f'cue {cid}: reverb {rname!r} not defined; send skipped')
            elif self.reverbs[rname]['ir'] is None:
                send_info = f'skipped ({rname}: no IR)'
            else:
                sdb = float(cue.get('reverb_send', 0.0)) if 'reverb_send' not in lanes else lanes['reverb_send'].eval(t)
                self.sends[rname][a0:a0 + len(out)] += out * db2lin(sdb).reshape(-1, 1) if np.ndim(sdb) else out * db2lin(sdb)
                send_info = f'sent to {rname}'
        elif cue.get('reverb_send') is not None and not self.reverbs:
            warn(f'cue {cid}: reverb_send given but no reverbs defined')
        # placement info for reports
        env_abs = np.abs(out).max(axis=1)
        pk = float(env_abs.max()) if len(env_abs) else 0.0
        nz = np.nonzero(env_abs > 0)[0]
        aud = np.nonzero(env_abs > pk * 10 ** (-40 / 20))[0] if pk > 0 else np.array([], int)
        onset = None
        if pk > 0:
            sm = np.convolve(env_abs, np.ones(12) / 12, mode='same')
            on = np.nonzero(sm >= sm.max() * 0.1)[0]
            onset = (int(on[0]) + a0 - T0) * 1000.0 / SR if len(on) else None
        info = {'id': cid, 'bus': bus, 'file': path, 'license': lic.get('license'), 'at_frame': cue['at_frame'],
                'anchor_sample': T0, 'anchor_offset_in_cue_samples': int(A), 'start_sample': int(S),
                'end_sample': int(E_eff), 'hard_stop_sample': hard, 'guard_samples': guard, 'loop': loop,
                'rate': rate, 'peak_dbfs': float(lin2db(pk)), 'first_nonzero_sample': int(nz[0] + a0) if len(nz) else None,
                'last_nonzero_sample': int(nz[-1] + a0) if len(nz) else None,
                'last_audible_sample_-40db': int(aud[-1] + a0) if len(aud) else None,
                'measured_onset_ms_re_anchor': onset, 'processing': pinfo, 'reverb': send_info,
                'map': {'file': path, 'region': pinfo['src_samples'], 'rate': rate, 'loop': loop,
                        'reverse': bool(cue.get('reverse', False))}}
        self.cue_info.append(info)

    def tile(self, y, total, xf, cid):
        m = len(y)
        if m <= 2 * xf + 1:
            xf = max(0, m // 4)
            warn(f'cue {cid}: loop region too short for the crossfade; reduced to {xf} samples')
        step = m - xf
        out = np.zeros((total, y.shape[1]))
        fin = np.sin(0.5 * np.pi * (np.arange(xf) + 0.5) / xf) if xf else np.ones(0)
        fout = fin[::-1]
        k = 0
        while k * step < total:
            seg = y.astype(np.float64).copy()
            if k > 0 and xf:
                seg[:xf] *= fin[:, None]
            if (k + 1) * step < total and xf:
                seg[m - xf:] *= fout[:, None]
            a = k * step
            n = min(m, total - a)
            out[a:a + n] += seg[:n]
            k += 1
        return out

    def run(self, solo_bus=None):
        for i, cue in enumerate(self.sheet['cues']):
            if cue.get('mute'):
                continue
            bus = cue.get('bus') or default_bus(self.resolve(cue['file']))
            if solo_bus and bus != solo_bus:
                continue
            self.render_cue(i, cue)
        # reverb returns
        for name, r in self.reverbs.items():
            if r['ir'] is None or name not in self.sends:
                continue
            snd = self.sends[name]
            if not snd.any():
                continue
            wet = np.stack([ss.oaconvolve(snd[:, c], r['ir'][:, c])[:self.N] for c in range(2)], axis=1)
            rb = r['return_bus'] if r['return_bus'] in self.buses else 'sfx'
            self.buses[rb] += wet
        # bus processing
        mix = np.zeros((self.N, 2))
        bus_out = {}
        for b, sig in self.buses.items():
            cfg = self.bus_cfg.get(b, {}) or {}
            lanes_spec = resolve_automation(cfg.get('automation'), self.presets, f'bus {b}')
            lanes = {k: Lane(k, v, self.frames) for k, v in lanes_spec.items()}
            y = sig
            if 'highpass_hz' in lanes:
                y = filter_lane(y, 0, lanes['highpass_hz'], int(cfg.get('highpass_slope', 24)))
            if 'lowpass_hz' in lanes:
                y = filter_lane(y, 0, lanes['lowpass_hz'], int(cfg.get('lowpass_slope', 24)))
            gdb = float(cfg.get('gain_db', 0.0))
            if 'gain_db' in lanes:
                y = y * db2lin(gdb + lanes['gain_db'].eval(np.arange(self.N, dtype=np.float64)))[:, None]
            else:
                y = y * db2lin(gdb)
            bus_out[b] = y
            mix += y
        return mix, bus_out


# ----------------------------------------------------------------------------------------------
# reports
# ----------------------------------------------------------------------------------------------

def beat_grid(sheet, frames):
    g = sheet.get('grid', {})
    bpm = float(g.get('bpm', 90.0))
    zf = float(g.get('zero_frame', 1))
    bpb = int(g.get('beats_per_bar', 4))
    spb = SR * 60.0 / bpm
    rows = []
    b = 0
    while True:
        s = frame_to_sample(zf) + b * spb
        if s >= frames * SPF:
            break
        rows.append({'beat': b, 'bar': b // bpb, 'beat_in_bar': b % bpb + 1, 'frame': round(s / SPF + 1, 4),
                     'time_s': round(s / SR, 6), 'sample': int(round(s))})
        b += 1
    return rows, spb


def music_alignment(music, rows, mixer, spb, win_ms=120.0, search_ms=20.0):
    """Per beat covered by a music cue: where the source file is at that instant, and a measured check.

    file_s / file_beat / file_phase_ms follow exactly from the cue placement (the file's own grid starts
    at grid.music_file_zero_s, default 0, at the sheet's bpm). measured_lag_ms cross-correlates the
    rendered music stem with the unprocessed source at its expected position (1 ms envelopes, +-20 ms):
    about 0 when the render puts the recording where the cue sheet says (filters add their group delay)."""
    zero = float(mixer.sheet.get('grid', {}).get('music_file_zero_s', 0.0))
    out = {}
    env_m = None
    if music is not None and np.any(music):
        env_m = np.convolve(np.abs(music).max(axis=1), np.ones(48) / 48, mode='same')
    for r in rows:
        s = r['sample']
        for ci in mixer.cue_info:
            mp = ci.get('map')
            if ci['bus'] != 'music' or not mp or mp['loop'] or mp['reverse']:
                continue
            if not (ci['start_sample'] <= s < ci['end_sample']):
                continue
            fpos = mp['region'][0] + (s - ci['start_sample']) / mp['rate']  # file sample (48 kHz)
            fs = fpos / SR
            fb = (fs - zero) * float(mixer.sheet.get('grid', {}).get('bpm', 90.0)) / 60.0
            phase = (fb - round(fb)) * 60.0 / float(mixer.sheet.get('grid', {}).get('bpm', 90.0)) * 1000.0
            rec = {'cue': ci['id'], 'file_s': fs, 'file_beat': fb, 'file_phase_ms': phase}
            if env_m is not None and abs(mp['rate'] - 1.0) < 1e-9:
                src, _ = decode(mp['file'])
                h = int(win_ms * SR / 2000)
                lo, hi = s - h, s + h
                fa = int(round(fpos)) - h
                if lo >= 0 and hi <= len(env_m) and fa >= 0 and fa + 2 * h <= len(src):
                    e_s = np.convolve(np.abs(src[fa:fa + 2 * h]).max(axis=1), np.ones(48) / 48, mode='same')
                    e_m = env_m[lo:hi]
                    if e_s.std() > 0 and e_m.std() > 0:
                        a_ = (e_m - e_m.mean()) / e_m.std()
                        b_ = (e_s - e_s.mean()) / e_s.std()
                        c = ss.correlate(a_, b_, mode='full', method='fft') / len(a_)
                        lags = np.arange(-len(b_) + 1, len(a_))
                        w = np.abs(lags) <= search_ms * SR / 1000
                        i = int(np.argmax(np.where(w, c, -np.inf)))
                        rec['measured_lag_ms'] = lags[i] * 1000.0 / SR
                        rec['measured_corr'] = float(c[i])
            out[r['beat']] = rec
            break
    return out


def write_csvs(out_path, sheet, frames, mixer, bus_out, grid_csv=None):
    stem = os.path.splitext(out_path)[0]
    grid_csv = grid_csv or stem + '_beatgrid.csv'
    rows, spb = beat_grid(sheet, frames)
    mal = music_alignment(bus_out.get('music'), rows, mixer, spb)
    events = {r['beat']: [] for r in rows}
    for ci in mixer.cue_info:
        s = ci['anchor_sample']
        b = int(round((s - rows[0]['sample']) / spb)) if rows else 0
        if b in events:
            off = (s - rows[b]['sample']) * 1000.0 / SR
            events[b].append(f"{ci['id']}({off:+.2f}ms)")
    with open(grid_csv, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['beat', 'bar', 'beat_in_bar', 'frame', 'time_s', 'sample', 'music_cue', 'music_file_s',
                    'music_file_beat', 'music_file_phase_ms', 'music_measured_lag_ms', 'music_measured_corr',
                    'cue_anchors_nearest_this_beat'])
        for r in rows:
            m = mal.get(r['beat'])
            w.writerow([r['beat'], r['bar'], r['beat_in_bar'], r['frame'], f"{r['time_s']:.6f}", r['sample'],
                        m['cue'] if m else '', f"{m['file_s']:.6f}" if m else '', f"{m['file_beat']:.4f}" if m else '',
                        f"{m['file_phase_ms']:+.3f}" if m else '',
                        f"{m['measured_lag_ms']:+.2f}" if m and 'measured_lag_ms' in m else '',
                        f"{m['measured_corr']:.2f}" if m and 'measured_corr' in m else '',
                        ' '.join(events[r['beat']])])
    cues_csv = stem + '_cues.csv'
    with open(cues_csv, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'bus', 'file', 'at_frame', 'anchor_sample', 'start_sample', 'end_sample', 'start_frame',
                    'end_frame_exclusive', 'nearest_beat', 'anchor_offset_from_beat_ms', 'measured_onset_ms_re_anchor',
                    'peak_dbfs', 'license'])
        for ci in mixer.cue_info:
            s = ci['anchor_sample']
            b = int(round((s - rows[0]['sample']) / spb)) if rows else 0
            off = (s - (rows[0]['sample'] + b * spb)) * 1000.0 / SR if rows else 0
            w.writerow([ci['id'], ci['bus'], os.path.basename(ci['file']), ci['at_frame'], s, ci['start_sample'],
                        ci['end_sample'], f"{ci['start_sample'] / SPF + 1:.3f}", f"{ci['end_sample'] / SPF + 1:.3f}", b,
                        f'{off:+.2f}', '' if ci['measured_onset_ms_re_anchor'] is None else
                        f"{ci['measured_onset_ms_re_anchor']:+.2f}", f"{ci['peak_dbfs']:.1f}", ci['license']])
    return grid_csv, cues_csv


def hard_stop_checks(mixer, master_q):
    """For every cue with a hard stop: is it silent from the boundary, and how sharp is the stop?"""
    out = []
    infos = mixer.cue_info
    for ci in infos:
        B = ci['hard_stop_sample']
        if B is None or B >= mixer.N:
            continue
        r = {'id': ci['id'], 'boundary_sample': B, 'boundary_frame': B / SPF + 1,
             'cue_last_nonzero_sample': ci['last_nonzero_sample'],
             'cue_silent_from_boundary': ci['last_nonzero_sample'] is None or ci['last_nonzero_sample'] < B,
             'samples_before_boundary_last_nonzero': None if ci['last_nonzero_sample'] is None else B - 1 - ci['last_nonzero_sample'],
             'ms_from_last_-40dB_to_boundary': None if ci['last_audible_sample_-40db'] is None else
             (B - ci['last_audible_sample_-40db']) * 1000.0 / SR}
        # master: silent from B until the next cue that is active after B?
        nxt = [c['first_nonzero_sample'] for c in infos if c['first_nonzero_sample'] is not None
               and c['last_nonzero_sample'] is not None and c['last_nonzero_sample'] >= B and c is not ci]
        others_active_at_B = [c['id'] for c in infos if c is not ci and c['first_nonzero_sample'] is not None
                              and c['first_nonzero_sample'] < B <= (c['last_nonzero_sample'] or -1)]
        if not others_active_at_B:
            until = min([n for n in nxt if n >= B], default=mixer.N)
            seg = master_q[B:until]
            r['master_window'] = [B, until]
            r['master_digital_silence_in_window'] = bool(not np.any(seg))
        else:
            r['master_window'] = None
            r['others_active_at_boundary'] = others_active_at_B
        out.append(r)
    return out


# ----------------------------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------------------------

def quantize24(y):
    q = np.clip(np.round(y * 8388608.0), -8388608, 8388607).astype(np.int32)
    return q


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0],
                                 epilog='Full cue-sheet reference: see the module docstring (python3 -c "import mix; help(mix)").')
    ap.add_argument('cues', help='JSON cue sheet')
    ap.add_argument('--out', required=True, help='output WAV (48 kHz stereo 24-bit)')
    ap.add_argument('--frames', type=int, help=f'film length in frames at 24 fps (default: sheet or {DEFAULT_FRAMES})')
    ap.add_argument('--lufs', type=float, help='integrated loudness target (default -14)')
    ap.add_argument('--tp', type=float, help='true-peak ceiling in dBTP (default -1.0)')
    ap.add_argument('--no-master', action='store_true',
                    help='raw bus sum: no glue, limiter or normalisation; writes 32-bit float (for checks)')
    ap.add_argument('--solo-bus', help='render only cues on this bus')
    ap.add_argument('--stems', help='directory for pre-master bus stems (float WAV)')
    ap.add_argument('--grid-csv', help='beat grid CSV path (default <out>_beatgrid.csv)')
    ap.add_argument('--click-track', action='store_true',
                    help='alias kept for the pipeline: writes only the beat-grid CSV; no audio is ever synthesized')
    ap.add_argument('--report', help='JSON report path (default <out>.report.json)')
    ap.add_argument('--validate', action='store_true', help='check the cue sheet and files, render nothing')
    ap.add_argument('--strict', action='store_true', help='exit with an error if there are any warnings')
    a = ap.parse_args(argv)

    t0 = time.time()
    sheet = json.load(open(a.cues))
    frames = a.frames or int(sheet.get('frames', DEFAULT_FRAMES))
    mixer = Mixer(sheet, a.cues, frames)
    if a.validate:
        for i, c in enumerate(sheet['cues']):
            p = mixer.resolve(c['file'])
            mixer.credit(p)
            resolve_automation(c.get('automation'), mixer.presets, f'cue {c.get("id", i)}')
            if set(c) - CUE_KEYS:
                warn(f'cue {c.get("id", i)}: unknown keys {sorted(set(c) - CUE_KEYS)}')
        print(f'{len(sheet["cues"])} cues OK, {len(WARNINGS)} warnings')
        return 1 if (a.strict and WARNINGS) else 0
    if a.click_track and not a.grid_csv:
        a.grid_csv = os.path.splitext(a.out)[0] + '_beatgrid.csv'

    mix, bus_out = mixer.run(a.solo_bus)
    mcfg = dict(sheet.get('master', {}))
    if a.lufs is not None:
        mcfg['lufs'] = a.lufs
    if a.tp is not None:
        mcfg['true_peak_dbtp'] = a.tp
    report = {'cue_sheet': os.path.abspath(a.cues), 'out': os.path.abspath(a.out), 'frames': frames,
              'samples': frames * SPF, 'sample_rate': SR, 'fps': FPS}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or '.', exist_ok=True)
    if a.no_master:
        y = mix
        sf.write(a.out, y.astype(np.float32), SR, subtype='FLOAT')
        report['master'] = {'bypassed': True}
        yq = y
    else:
        y, minfo = master_process(mix, mcfg, report)
        q = quantize24(y)
        sf.write(a.out, (q.astype(np.int32) << 8), SR, subtype='PCM_24')
        report['master'] = minfo
        yq = q.astype(np.float64) / 8388608.0
    if a.stems:
        os.makedirs(a.stems, exist_ok=True)
        for b, s in bus_out.items():
            sf.write(os.path.join(a.stems, f'{b}.wav'), s.astype(np.float32), SR, subtype='FLOAT')

    # verify what was written
    info = sf.info(a.out)
    back, _ = sf.read(a.out, dtype='float64', always_2d=True)
    stats = loudness_stats(back) if np.any(back) else {}
    report['file'] = {'frames_written': info.frames, 'duration_s': info.frames / info.samplerate,
                      'samplerate': info.samplerate, 'channels': info.channels, 'subtype': info.subtype,
                      'exact_length': info.frames == frames * SPF}
    report['loudness'] = dict(stats, true_peak_dbtp=true_peak_db(back), sample_peak_dbfs=float(lin2db(np.abs(back).max())),
                              clipped_samples=int((np.abs(back) >= 1.0 - 1.0 / 8388608).sum()))
    report['buses'] = {b: {'peak_dbfs': float(lin2db(np.abs(s).max())), 'lufs_pre_master': lufs(s) if np.any(s) else None}
                       for b, s in bus_out.items()}
    report['reverbs'] = {k: v['status'] for k, v in mixer.reverbs.items()}
    report['hard_stops'] = hard_stop_checks(mixer, (back * 8388608.0).round() if not a.no_master else back)
    report['cues'] = mixer.cue_info
    report['credits'] = sorted(mixer.credits.values(), key=lambda c: c['file'])
    report['credits_requiring_attribution'] = [c['attribution'] for c in report['credits']
                                               if c.get('license') and 'BY' in c['license'].upper() and c.get('attribution')]
    gcsv, ccsv = write_csvs(a.out, sheet, frames, mixer, bus_out, a.grid_csv)
    report['grid_csv'] = gcsv
    report['cues_csv'] = ccsv
    report['warnings'] = WARNINGS
    report['render_seconds'] = round(time.time() - t0, 2)
    rpath = a.report or os.path.splitext(a.out)[0] + '.report.json'
    json.dump(report, open(rpath, 'w'), indent=1, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))

    L = report['loudness']
    print(f"wrote {a.out}: {info.frames} samples = {info.frames / SR:.6f} s, {info.channels} ch, {info.subtype}")
    if L:
        print(f"  integrated {L.get('integrated_lufs', float('nan')):.2f} LUFS, true peak {L['true_peak_dbtp']:.2f} dBTP, "
              f"sample peak {L['sample_peak_dbfs']:.2f} dBFS, LRA {L.get('lra_lu', 0):.1f} LU, "
              f"max short-term {L.get('max_short_term_lufs', float('nan')):.1f} LUFS, clipped samples {L['clipped_samples']}")
    if not a.no_master:
        m = report['master']
        print(f"  master gain {m.get('gain_db', 0):+.2f} dB, glue max GR {m.get('glue_max_gr_db', 0):.2f} dB, "
              f"limiter max GR {m.get('limiter_max_gr_db', 0):.2f} dB ({m.get('limiter_pct_time_gr_over_1db', 0):.2f}% of time > 1 dB)")
    for hs in report['hard_stops']:
        mw = hs.get('master_window')
        if mw and mw[1] > mw[0]:
            tail = (f", master digital silence f{mw[0] / SPF + 1:.2f}-f{mw[1] / SPF + 1:.2f} "
                    f"({mw[1] - mw[0]} samples): {hs['master_digital_silence_in_window']}")
        elif mw:
            tail = ', next cue starts on the boundary'
        else:
            tail = f", other cues continue: {', '.join(hs.get('others_active_at_boundary', []))}"
        print(f"  hard stop {hs['id']} @ f{hs['boundary_frame']:.0f}: silent from boundary={hs['cue_silent_from_boundary']}, "
              f"last nonzero sample {hs['samples_before_boundary_last_nonzero']} before it" + tail)
    print(f"  {len(mixer.cue_info)} cues, {len(report['credits'])} files, reverbs: {report['reverbs'] or 'none'}")
    print(f"  report {rpath}\n  grid {gcsv}\n  cues {ccsv}\n  {len(WARNINGS)} warnings, {report['render_seconds']} s")
    return 1 if (a.strict and WARNINGS) else 0


if __name__ == '__main__':
    sys.exit(main())
