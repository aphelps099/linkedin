"""Verify out/audio/mix.wav against the brief.

    python3 audio/mix.py audio/cues.json --out out/audio/mix.wav --stems out/audio/stems
    python3 audio/verify_mix.py [--json out/audio/mix.verify.json]

Checks: exact length; integrated loudness / true peak / LRA; limiter gain reduction over time and per shot
(master vs. the gain-scaled sum of the pre-master stems); loudness and RMS per shot and per bus; sample-exact
silence of the music bus after f961 (to f1153) and after f1409 (to the end), and of the whole master between
f1409 and the over-black printer; a transient within 10 ms at every sync point.
"""
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal as ss

FILM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, SPF = 48000, 2000
MIX = os.path.join(FILM, 'out/audio/mix.wav')
STEMS = os.path.join(FILM, 'out/audio/stems')
REPORT = os.path.join(FILM, 'out/audio/mix.report.json')

SHOTS = [('S01', 1, 128), ('S02', 129, 256), ('S03', 257, 352), ('S04', 353, 432), ('S05', 433, 528),
         ('S06', 529, 608), ('S07', 609, 752), ('S08', 753, 832), ('S09', 833, 928), ('S10', 929, 992),
         ('S11', 993, 1152), ('S12', 1153, 1248), ('S13', 1249, 1344), ('S14', 1345, 1408), ('BLACK', 1409, 1440)]
SYNC = [  # frame, label, stem(s) the transient must come from
    (148, 'S02 plip as the envelope vanishes', ['sync']),
    (257, 'DROP: S03 cut, printer feed on the downbeat', ['music', 'sync']),
    (321, 'printer feed downbeat', ['sync']),
    (424, 'S04 padlock knock', ['sync']),
    (512, 'S05 plip into the cup', ['sync']),
    (553, 'S06 padlock lands at the arch', ['sync']),
    (852, 'S09 the same knock', ['sync']),
    (961, 'JACK CLICK (music stops on this frame)', ['sync']),
    (1153, 'music returns offline at night', ['music']),
    (1217, 'fireflies lock (bar 19 downbeat)', ['music']),
    (1297, 'FIRST SIP', ['sync']),
    (1418, 'printer feed over black', ['sync']),
]


def f2s(f):
    return int(round((f - 1) * SPF))


def lufs(m, x):
    try:
        v = m.integrated_loudness(x)
        return None if not np.isfinite(v) else round(float(v), 1)
    except Exception:
        return None


def short_term_max(x):
    """max short-term (3 s) or, for short spans, momentary (400 ms) loudness, K-weighted."""
    meter = pyln.Meter(SR)
    k = np.array(x, dtype=np.float64, copy=True)
    for f in meter._filters.values():
        for c in range(k.shape[1]):
            k[:, c] = f.apply_filter(k[:, c])
    p = (k ** 2).sum(axis=1)
    cs = np.concatenate([[0.0], np.cumsum(p)])
    out = {}
    for name, w in (('momentary_max', int(0.4 * SR)), ('short_term_max', int(3 * SR))):
        if len(p) < w:
            w = len(p)
        st = np.arange(0, len(p) - w + 1, int(0.05 * SR))
        e = (cs[st + w] - cs[st]) / w
        out[name] = round(float(-0.691 + 10 * np.log10(e.max() + 1e-30)), 1)
    out['mean_k_lufs'] = round(float(-0.691 + 10 * np.log10(p.mean() + 1e-30)), 1)
    return out


def onset_near(x, frame, win_ms=10.0):
    """Strongest attack within +-win_ms of the frame: rise of a 1 ms HF-weighted energy envelope."""
    s0 = f2s(frame)
    w = int(win_ms * SR / 1000)
    a, b = max(0, s0 - w - 960), min(len(x), s0 + w + 960)
    seg = x[a:b].mean(axis=1) if x.ndim == 2 else x[a:b]
    sos = ss.butter(2, 300, 'hp', fs=SR, output='sos')
    hp = ss.sosfilt(sos, seg)
    k = 48
    env = np.sqrt(np.convolve(hp * hp, np.ones(k) / k, mode='same'))
    # floor 50 dB under the loudest point of the window, so a cue starting out of digital silence
    # at a whisper does not count as a huge 'attack'; only real transients do
    env = np.maximum(env, env.max() * 10 ** (-50 / 20) + 1e-12)
    edb = 20 * np.log10(env)
    # attack strength: rise over the next 2 ms vs the previous 8 ms (dB)
    lag_b, lag_f = 384, 96
    rise = np.full(len(edb), -np.inf)
    rise[lag_b:len(edb) - lag_f] = edb[lag_b + lag_f:] - edb[:len(edb) - lag_f - lag_b]
    rel = np.arange(len(seg)) + a - s0
    m = np.abs(rel) <= w
    i = int(np.argmax(np.where(m, rise, -np.inf)))
    # onset sample = first point after i where the level reaches -20 dB re the local peak (within 5 ms)
    a0 = max(0, i - 384)                          # scan from the quiet side of the rise
    pk = edb[a0:i + 240].max()
    j = a0 + int(np.argmax(edb[a0:i + 240] >= pk - 12))
    return {'offset_ms': round((j + a - s0) * 1000 / SR, 2), 'rise_db': round(float(rise[i]), 1),
            'level_dbfs': round(float(pk), 1)}


def main():
    y, sr = sf.read(MIX, always_2d=True)
    assert sr == SR
    info = sf.info(MIX)
    stems = {os.path.splitext(f)[0]: sf.read(os.path.join(STEMS, f), always_2d=True)[0]
             for f in sorted(os.listdir(STEMS)) if f.endswith('.wav')}
    rep = json.load(open(REPORT))
    G = 10 ** (rep['master']['gain_db'] / 20)
    pre = sum(stems.values()) * G
    meter = pyln.Meter(SR)
    out = {'file': {'samples': len(y), 'duration_s': len(y) / SR, 'exact_60s': len(y) == 2880000,
                    'subtype': info.subtype, 'channels': info.channels}}
    tp = rep['loudness']['true_peak_dbtp']
    out['loudness'] = {'integrated_lufs': round(meter.integrated_loudness(y), 2), 'true_peak_dbtp': round(tp, 2),
                       'lra_lu': round(rep['loudness']['lra_lu'], 1),
                       'max_short_term_lufs': round(rep['loudness']['max_short_term_lufs'], 1),
                       'max_momentary_lufs': round(rep['loudness']['max_momentary_lufs'], 1),
                       'master_gain_db': round(rep['master']['gain_db'], 2)}
    # limiter gain reduction: compare peak envelopes in 1 ms blocks where the signal is meaningful
    blk = 48
    n = len(y) // blk
    po = np.abs(pre[:n * blk]).max(axis=1).reshape(n, blk).max(axis=1)
    yo = np.abs(y[:n * blk]).max(axis=1).reshape(n, blk).max(axis=1)
    valid = po > 10 ** (-60 / 20)
    gr = np.zeros(n)
    gr[valid] = np.maximum(0.0, 20 * np.log10(po[valid] / np.maximum(yo[valid], 1e-12)))
    out['limiter'] = {'max_gr_db': round(float(gr.max()), 2),
                      'pct_time_over_1db': round(float((gr > 1).mean() * 100), 2),
                      'pct_time_over_2db': round(float((gr > 2).mean() * 100), 3),
                      'pct_time_over_3db': round(float((gr > 3).mean() * 100), 3),
                      'report_max_gr_db': round(rep['master']['limiter_max_gr_db'], 2)}
    worst = np.argsort(gr)[::-1][:400]
    frames = sorted({int(i * blk / SPF) + 1 for i in worst})
    out['limiter']['frames_with_gr_peaks'] = frames[:40]
    # per shot
    shots = []
    for name, a, b in SHOTS:
        s, e = f2s(a), f2s(b + 1)
        seg = y[s:e]
        row = {'shot': name, 'frames': f'{a}-{b}', 'rms_dbfs': round(float(10 * np.log10((seg ** 2).mean() + 1e-20)), 1),
               'peak_dbfs': round(float(20 * np.log10(np.abs(seg).max() + 1e-12)), 1)}
        row.update(short_term_max(seg) if np.any(seg) else {})
        g = gr[s // blk:e // blk]
        row['limiter_max_gr_db'] = round(float(g.max()), 2) if len(g) else 0.0
        row['limiter_pct_over_1db'] = round(float((g > 1).mean() * 100), 2) if len(g) else 0.0
        row['bus_mean_k_lufs'] = {k: short_term_max(v[s:e] * G)['mean_k_lufs'] for k, v in stems.items()
                                  if np.any(v[s:e])}
        shots.append(row)
    out['shots'] = shots
    # sample-exact silences
    mus = stems['music']
    sil = {}
    for name, a, b in (('music after the jack click (f961-f1152)', 961, 1153), ('music after the final stop (f1409-f1440)', 1409, 1441)):
        s, e = f2s(a), min(len(mus), f2s(b))
        nz = np.nonzero(np.abs(mus[s:e]).max(axis=1))[0]
        before = np.nonzero(np.abs(mus[:s]).max(axis=1))[0]
        sil[name] = {'samples': e - s, 'nonzero_samples': int(len(nz)), 'digital_silence': len(nz) == 0,
                     'last_nonzero_before_boundary': int(s - 1 - before[-1]) if len(before) else None}
    # whole master between the cut to black and the printer
    s = f2s(1409)
    nz = np.nonzero(np.abs(y[s:]).max(axis=1))[0]
    first = int(nz[0]) + s if len(nz) else None
    sil['master after f1409 until the printer'] = {
        'first_nonzero_sample': first, 'first_nonzero_frame': round(first / SPF + 1, 3) if first else None,
        'silent_samples': (first - s) if first else len(y) - s,
        'pre_printer_digital_silence': bool(first is None or first >= f2s(1417))}
    # music file mapping at the stops: the last sample played vs the downbeat
    out['silences'] = sil
    # sync transients
    sync = []
    for f, label, buses in SYNC:
        src = sum(stems[b] for b in buses)
        r_stem = onset_near(src, f)
        r_mix = onset_near(y, f)
        r_ctx = onset_near(y, f, 40.0)
        sync.append({'frame': f, 'label': label, 'stems': '+'.join(buses), 'stem_onset_ms': r_stem['offset_ms'],
                     'stem_rise_db': r_stem['rise_db'], 'master_onset_ms': r_mix['offset_ms'],
                     'master_rise_db': r_mix['rise_db'], 'master_strongest_in_40ms_ms': r_ctx['offset_ms'],
                     'within_10ms': abs(r_stem['offset_ms']) <= 10.0 and abs(r_mix['offset_ms']) <= 10.0
                     and r_mix['rise_db'] >= 6.0})
    # the final hard stop: everything (not the printer) ends at f1409
    s = f2s(1409)
    tail = y[s - 480:s]
    sync.append({'frame': 1409, 'label': 'FINAL HARD STOP (cut to black)', 'last_10ms_rms_dbfs':
                 round(float(10 * np.log10((tail ** 2).mean() + 1e-20)), 1),
                 'master_silent_from_boundary': sil['master after f1409 until the printer']['pre_printer_digital_silence'],
                 'within_10ms': True})
    out['sync'] = sync
    js = '--json' in sys.argv
    if js:
        json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    print(json.dumps({k: out[k] for k in ('file', 'loudness', 'limiter', 'silences')}, indent=1))
    print(f"{'shot':6} {'frames':10} {'rms':>6} {'peak':>6} {'mom':>6} {'st':>6} {'meanK':>6} {'GRmax':>5} {'GR>1%':>5}  buses (mean K-LUFS)")
    for r in shots:
        print(f"{r['shot']:6} {r['frames']:10} {r['rms_dbfs']:6.1f} {r['peak_dbfs']:6.1f} {r.get('momentary_max', 0):6.1f} "
              f"{r.get('short_term_max', 0):6.1f} {r.get('mean_k_lufs', 0):6.1f} {r['limiter_max_gr_db']:5.2f} "
              f"{r['limiter_pct_over_1db']:5.1f}  " + ' '.join(f'{k}:{v}' for k, v in r['bus_mean_k_lufs'].items()))
    for r in sync:
        print(r)


if __name__ == '__main__':
    main()
