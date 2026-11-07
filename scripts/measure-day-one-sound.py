#!/usr/bin/env python3
"""Measure Day One's sound (src/films/day-one/score.js, rendered by scripts/render-day-one-sound.mjs).

  python3 scripts/measure-day-one-sound.py DIR/day-one.wav [--marks DIR/day-one.json] [--stem DIR/motif.wav]
          [--whisper small.en] [--no-whisper] [--json out.json]

Reads the WAV with ffmpeg (float32) and its marks (the JSON beside it), and reports, with a gate each:
  loudness   ffmpeg ebur128 (peak=true): integrated LUFS (-10 +-0.5) and true peak (<= -1 dBTP); a numpy
             BS.1770-4 cross-check; samples at full scale (no clipping)
  wall       the wall (B74-B82) over bars 12-16 (B48-B64), gated integrated loudness, on the mix and through a
             phone speaker (mono, 4th-order HP 300 Hz and LP 8 kHz, as scripts/measure-allhands.py): +2.5 LU each;
             and the short-term (3 s) medians for the record
  silence    digital silence: the choke (B91) to the first sample of the final line, and from 50 ms after the
             last voice to the end (every sample exactly zero)
  sync       the motif's "grats" vowel on frames 396 and 1656 (+-1 frame)
  release    the choir's voices sounding at each release cue (B82-B84.5: 5 down to 0)
  null       with --stem (the motif rendered alone): the final S1 against Voice 1, sample by sample (<= -120 dB)
  whisper    faster-whisper small.en on each statement of the motif in the mix (beam 5, temperature 0,
             decoded with ffmpeg to a float32 array): "congrats on the new role" exactly ("roll", its
             homophone, R OW L like it, counts as the word, as the voice bank counts "sink" for "sync"; the
             literal spelling is reported window by window)
Exit 1 if a gate fails.
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np
from scipy import signal

SR = 48000


def decode(path, sr=SR, channels=2):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(channels), '-ar', str(sr), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).astype(np.float64)


def ebur128(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    tail = p.stderr[p.stderr.rfind('Summary:'):]
    num = lambda key: float(re.search(rf'{key}:\s+(-?[\d.]+|-inf)', tail).group(1).replace('-inf', '-1e9'))
    return {'integrated_lufs': num('I'), 'lra_lu': num('LRA'), 'true_peak_dbtp': num('Peak')}


def k_filter(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


class Loudness:
    """BS.1770-4 at 48 kHz: K-weighted power in 100 ms hops; gated integrated loudness of any span."""
    def __init__(self, x):
        y = k_filter(x)
        hop = SR // 10
        n = len(y) // hop
        self.p = (y[:n * hop] ** 2).reshape(n, hop, -1).sum(axis=1).sum(axis=1) / hop   # per 100 ms, summed over channels

    def blocks(self, t0, t1, size=4):
        a, b = int(round(t0 * 10)), int(round(t1 * 10))
        return np.array([self.p[i:i + size].mean() for i in range(a, b - size + 1)])

    def integrated(self, t0, t1):
        e = self.blocks(t0, t1)
        L = lambda v: -0.691 + 10 * np.log10(v + 1e-30)
        e = e[L(e) > -70]
        if not len(e):
            return float('-inf')
        e = e[L(e) > L(e.mean()) - 10]
        return float(L(e.mean()))

    def short_term_median(self, t0, t1):
        e = self.blocks(t0, t1, 30)
        return float(np.median(-0.691 + 10 * np.log10(e + 1e-30)))


def phone(x):
    mono = x.mean(axis=1)
    sos = np.vstack([signal.butter(4, 300, 'highpass', fs=SR, output='sos'), signal.butter(4, 8000, 'lowpass', fs=SR, output='sos')])
    y = signal.sosfilt(sos, mono)
    return np.stack([y, y], axis=1) / np.sqrt(2)          # mono heard as one channel's worth


def words(text):
    text = re.sub(r'[-/]', ' ', text.lower().replace('’', "'"))
    return [w.strip("'") for w in re.sub(r"[^a-z0-9' ]+", ' ', text).split() if w.strip("'")]


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), int)
    d[:, 0], d[0, :] = np.arange(len(r) + 1), np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return float(d[-1, -1] / max(1, len(r)))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('wav')
    ap.add_argument('--marks')
    ap.add_argument('--stem')
    ap.add_argument('--whisper', default='small.en')
    ap.add_argument('--no-whisper', action='store_true')
    ap.add_argument('--json', dest='json_out')
    a = ap.parse_args(argv)
    meta = json.load(open(a.marks or re.sub(r'\.wav$', '.json', a.wav)))
    marks = meta['marks']
    x = decode(a.wav)
    out, gates = {'file': a.wav, 'seconds': len(x) / SR}, []
    gate = lambda name, ok, value, need: gates.append({'gate': name, 'pass': bool(ok), 'value': value, 'need': need})

    # Loudness, true peak, clipping.
    L = ebur128(a.wav)
    meter = Loudness(x)
    L['numpy_integrated_lufs'] = meter.integrated(0, len(x) / SR)
    L['sample_peak_dbfs'] = float(20 * np.log10(np.abs(x).max() + 1e-30))
    L['clipped_samples'] = int((np.abs(x) >= 1.0 - 1e-7).sum())
    out['loudness'] = L
    gate('integrated loudness', abs(L['integrated_lufs'] + 10) <= 0.5, f"{L['integrated_lufs']:.2f} LUFS (numpy {L['numpy_integrated_lufs']:.2f})", '-10 +-0.5')
    gate('true peak', L['true_peak_dbtp'] <= -1.0, f"{L['true_peak_dbtp']:.2f} dBTP", '<= -1.0')
    gate('no clipping', L['clipped_samples'] == 0, f"{L['clipped_samples']} samples at full scale, peak {L['sample_peak_dbfs']:.2f} dBFS", '0')

    # The wall over bars 12-16, on the mix and a phone.
    (w0, w1), (r0, r1) = marks['wall'], marks['ref']
    ph = Loudness(phone(x))
    wall = {'span': [w0, w1], 'ref': [r0, r1], 'wall_lufs': meter.integrated(w0, w1), 'ref_lufs': meter.integrated(r0, r1),
            'wall_phone_lufs': ph.integrated(w0, w1), 'ref_phone_lufs': ph.integrated(r0, r1),
            'wall_short_median': meter.short_term_median(w0, w1), 'ref_short_median': meter.short_term_median(r0, r1),
            'wall_phone_short_median': ph.short_term_median(w0, w1), 'ref_phone_short_median': ph.short_term_median(r0, r1)}
    wall['lift_lu'] = wall['wall_lufs'] - wall['ref_lufs']
    wall['phone_lift_lu'] = wall['wall_phone_lufs'] - wall['ref_phone_lufs']
    wall['short_lift_lu'] = wall['wall_short_median'] - wall['ref_short_median']
    wall['phone_short_lift_lu'] = wall['wall_phone_short_median'] - wall['ref_phone_short_median']
    out['wall'] = wall
    gate('wall over bars 12-16', wall['lift_lu'] >= 2.5, f"+{wall['lift_lu']:.2f} LU (short-term median +{wall['short_lift_lu']:.2f})", '>= +2.5')
    gate('wall over bars 12-16, phone', wall['phone_lift_lu'] >= 2.5, f"+{wall['phone_lift_lu']:.2f} LU (short-term median +{wall['phone_short_lift_lu']:.2f})", '>= +2.5')

    # Sections, for the record.
    out['sections'] = [{'name': s['name'], 't0': s['t0'], 't1': s['t1'], 'lufs': meter.integrated(s['t0'], s['t1']) if s['t1'] - s['t0'] >= 0.4 else None,
                        'phone_lufs': ph.integrated(s['t0'], s['t1']) if s['t1'] - s['t0'] >= 0.4 else None} for s in marks['sections']]
    out['bars'] = [{'bar': b, 'lufs': meter.integrated(b * 2.4, b * 2.4 + 2.4)} for b in range(int(len(x) / SR / 2.4))]

    # Digital silence.
    sil = []
    for s in marks['silence']:
        a0, a1 = int(np.ceil(s['from'] * SR)), int(np.floor(s['to'] * SR))
        seg = x[a0:a1]
        peak = float(np.abs(seg).max()) if len(seg) else 0.0
        sil.append({'span': f"{s['from']:.3f}-{s['to']:.3f} s", 'seconds': (a1 - a0) / SR, 'nonzero': int((seg != 0).sum()), 'peak_dbfs': None if peak == 0 else 20 * np.log10(peak)})
    out['silence'] = sil
    for s in sil:
        gate(f"digital silence {s['span']}", s['nonzero'] == 0 and s['seconds'] > 0, f"{s['seconds']:.3f} s, {s['nonzero']} non-zero samples", 'every sample 0')

    # The motif on its frames.
    sync = [{'B': g['B'], 'part': g['part'], 't': g['t'], 'frame': g['t'] * 30, 'target': round(g['B'] * 18)} for g in marks['grats']]
    out['sync'] = sync
    for s in sync:
        gate(f"grats B{s['B']} on frame {s['target']}", abs(s['frame'] - s['target']) <= 1, f"frame {s['frame']:.2f}", '+-1 frame')

    # The release: the choir's voices sounding at each release cue.
    copies = [c for c in marks['copies'] if c['part'] not in ('voice1', 'final')]
    rel = []
    for B, n in [(82, 5), (82.5, 4), (83, 3), (83.5, 2), (84, 1), (84.5, 0)]:
        t = B * 0.6
        rel.append({'B': B, 'want': n, 'sounding': sum(1 for c in copies if c['start'] <= t < c['end'])})
    out['release'] = rel

    # The null: the final S1 against Voice 1, in the motif's own stem.
    if a.stem:
        st = decode(a.stem)
        g1, g2 = [g for g in marks['grats'] if g['part'] == 'voice1'][0], [g for g in marks['grats'] if g['part'] == 'final'][0]
        n = int(round((g1['end'] - g1['start']) * SR))
        s1, s2 = int(round(g1['start'] * SR)), int(round(g2['start'] * SR))
        A, Bv = st[s1:s1 + n], st[s2:s2 + n]
        diff = A - Bv
        ref = np.sqrt((A ** 2).mean()) + 1e-30
        res = float(np.abs(diff).max())
        out['null'] = {'samples': n, 'max_abs_diff': res, 'residual_db': None if res == 0 else 20 * np.log10(np.sqrt((diff ** 2).mean()) / ref), 'identical': bool(res == 0)}
        gate('final S1 nulls against Voice 1', res == 0 or 20 * np.log10(np.sqrt((diff ** 2).mean()) / ref) <= -120,
             'identical samples' if res == 0 else f"{out['null']['residual_db']:.1f} dB", '<= -120 dB')

    # Whisper on the motif's two statements, in the mix: the bank's protocol (measure.py hear: the statement's own
    # extent, 0.3 s of silence each side), and a sweep of wider windows for the record ("role" and "roll" are the same
    # phones, R OW L: Whisper spells them either way as the window changes; any other word is an error).
    if not a.no_whisper:
        from faster_whisper import WhisperModel
        model = WhisperModel(a.whisper, device='cpu', compute_type='int8')
        mono16 = decode(a.wav, 16000, 1)[:, 0].astype(np.float32)
        def hear(t0, t1):
            y = np.concatenate([np.zeros(4800, np.float32), mono16[int(t0 * 16000):int(t1 * 16000)], np.zeros(4800, np.float32)])
            segs, _ = model.transcribe(y, language='en', beam_size=5, temperature=0.0, condition_on_previous_text=False, without_timestamps=True, vad_filter=False)
            return ' '.join(s.text.strip() for s in segs).strip()
        heard = []
        for g in marks['grats']:
            text = hear(g['start'], g['end'])
            sweep = [{'pre': pre, 'post': post, 'heard': hear(g['start'] - pre, g['end'] + post)} for pre, post in [(0.05, 0.05), (0.1, 0.25), (0, 0.1), (0.2, 0.4)]]
            for s_ in sweep:
                s_['wer'] = wer('congrats on the new role', s_['heard'])
                s_['homophone'] = words(s_['heard']) == words('congrats on the new roll')
            heard.append({'B': g['B'], 'part': g['part'], 'window': [round(g['start'], 3), round(g['end'], 3)], 'expected': 'Congrats on the new role!', 'heard': text,
                          'wer': wer('congrats on the new role', text), 'homophone': words(text) == words('congrats on the new roll'), 'sweep': sweep})
        out['whisper'] = heard
        # The gate is the bank's: every word exactly, a homophone counted as the word (measure.py HOMOPHONES: "a quick
        # sink" is "a quick sync"); how often Whisper spells it "role" literally is reported beside it.
        for h in heard:
            windows = [h] + h['sweep']
            literal = sum(1 for w_ in windows if w_['wer'] == 0)
            h['literal'] = f'{literal}/{len(windows)}'
            gate(f"Whisper hears the motif at B{h['B']} (its window)", h['wer'] == 0 or h['homophone'], h['heard'] + ('' if h['wer'] == 0 else ' (the homophone)'), 'congrats on the new role, "roll" its homophone')
            gate(f"  ... and in 4 wider windows", all(w_['wer'] == 0 or w_['homophone'] for w_ in h['sweep']),
                 f"{'; '.join(w_['heard'] for w_ in h['sweep'])} ('role' literally in {literal} of {len(windows)} windows)", 'every word, R OW L spelled either way')

    out['gates'] = gates
    w = max(len(g['gate']) for g in gates)
    for g in gates:
        print(f"{'PASS' if g['pass'] else 'FAIL'}  {g['gate']:<{w}}  {g['value']}  (need {g['need']})")
    print('release (voices sounding): ' + ', '.join(f"B{r['B']} {r['sounding']} (cue {r['want']})" for r in out['release']))
    if a.json_out:
        json.dump(out, open(a.json_out, 'w'), indent=1)
    return 0 if all(g['pass'] for g in gates) else 1


if __name__ == '__main__':
    sys.exit(main())
