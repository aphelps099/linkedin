#!/usr/bin/env python3
"""Whisper on Delve. (songbook/delve.js): does she go from crisp to dissolved?

Cuts each of her phrases out of a render (scripts/render-allhands.mjs --track delve:
the WAV and its plan JSON), decodes it with ffmpeg to a 16 kHz float32 array
(faster_whisper's own decoder is not used), and runs faster_whisper (small.en by
default) on each window, with the window's neighbours muted: from just before
her first word to just after her last (a tape phrase to the end of its warp).

Gates (exit 1 on a failure):
  exact     P1-P5, "Let that" of P7, and P10: WER 0
  WER .5    P6 ("A rich tapestry")
  report    P7 whole, P8 and P9: how far she has dissolved (exempt by design)
  the choir before 95 s: four windows where only the bed sings (her chant,
            "Momentum compounds.", stretched, stacked and pitched down) must not
            be heard as "momentum" or "compounds"

  python3 scripts/whisper-delve.py song/delve.wav [--plan song/delve.json] [--model small.en] [--json out.json]
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np

SR = 16000


def words(text):
    text = re.sub(r'[-‐-—/]', ' ', text.lower().replace('’', "'"))
    text = re.sub(r"[^a-z0-9' ]+", ' ', text)
    return [w.strip("'") for w in text.split() if w.strip("'")]


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), int)
    d[:, 0], d[0, :] = np.arange(len(r) + 1), np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return float(d[len(r), len(h)] / max(1, len(r)))


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split('\n', 1)[1])
    ap.add_argument('wav')
    ap.add_argument('--plan')
    ap.add_argument('--model', default='small.en')
    ap.add_argument('--json', dest='json_out')
    a = ap.parse_args(argv)
    plan = json.load(open(a.plan or re.sub(r'\.wav$', '.json', a.wav)))['plan']
    off, band = plan.get('offset', .05), plan['band']
    x = decode(a.wav)
    from faster_whisper import WhisperModel
    try:
        model = WhisperModel(a.model, device='cpu', compute_type='int8', local_files_only=True)
    except Exception:
        model = WhisperModel(a.model, device='cpu', compute_type='int8')

    def hear(t0, t1):
        seg = x[max(0, int((t0 + off) * SR)):int((t1 + off) * SR)].copy()
        # a 20 ms fade at the edges, so a cut-off word in a neighbour does not read as a word
        k = min(len(seg) // 4, int(.02 * SR))
        if k:
            seg[:k] *= np.linspace(0, 1, k)
            seg[-k:] *= np.linspace(1, 0, k)
        segs, _ = model.transcribe(seg, language='en', beam_size=5, temperature=0.0, vad_filter=False, condition_on_previous_text=False,
                                   without_timestamps=True, no_speech_threshold=None, log_prob_threshold=None, compression_ratio_threshold=None)
        return ' '.join(s.text.strip() for s in segs).strip()

    # How far a phrase stands over the stream it rises from: the RMS of her words against the 1.5 s of
    # stream before her first word (the river's own level there), in dB. Crisp is far over; dissolved, near it.
    def over_bed(t0, t1):
        lvl = lambda a, b: 10 * np.log10(np.mean(x[max(0, int((a + off) * SR)):int((b + off) * SR)] ** 2) + 1e-12)
        return float(lvl(t0, t1) - lvl(t0 - 1.6, t0 - .1))

    rows, fails = [], []
    exact = {'P1', 'P2', 'P3', 'P4', 'P5', 'P10'}
    for e in band:
        text = ' '.join(w['text'] for w in e['words'])
        t0, t1 = e['words'][0]['start'] - .12, e['words'][-1]['end'] + .25
        heard = hear(t0, t1)
        w = wer(text, heard)
        gate = 'exact' if e['id'] in exact else 'wer.5' if e['id'] == 'P6' else 'report'
        ok = w == 0 if gate == 'exact' else w <= .5 if gate == 'wer.5' else True
        rows.append({'phrase': e['id'], 'stage': e['stage'], 'clarity': e['clarity'], 'window': [round(t0, 3), round(t1, 3)], 'expected': text, 'heard': heard, 'wer': round(w, 3), 'gate': gate, 'ok': bool(ok),
                     'over_bed_db': round(over_bed(e['words'][0]['start'], e['words'][-1]['end']), 1)})
        if not ok:
            fails.append(e['id'])
        if e['id'] == 'P7':
            # "Let that", crisp and dry, before the tape slows
            let = e['words'][:2]
            heard = hear(let[0]['start'] - .12, let[1]['end'] + .08)
            w = wer('Let that', heard)
            rows.append({'phrase': 'P7 (Let that)', 'stage': 'dry', 'clarity': 1, 'window': [round(let[0]['start'] - .12, 3), round(let[1]['end'] + .08, 3)], 'expected': 'Let that', 'heard': heard, 'wer': round(w, 3), 'gate': 'exact', 'ok': w == 0,
                         'over_bed_db': round(over_bed(let[0]['start'], let[1]['end']), 1)})
            if w:
                fails.append('P7 (Let that)')
    # The choir before 95 s, where only the bed sings: it must not say her line yet.
    gaps, last = [], None
    for e in band:
        if last and e['start'] - last > 6 and e['start'] < 95:
            gaps.append((last + 1.5, min(e['start'] - .5, last + 6.5)))
        last = max(last or 0, e['end'])
    chant = []
    for t0, t1 in gaps:
        if t0 < 15:
            continue
        heard = hear(t0, t1)
        hit = any(w in ('momentum', 'compounds', 'compound') for w in words(heard))
        chant.append({'window': [round(t0, 2), round(t1, 2)], 'heard': heard, 'recognised': hit})
        if hit:
            fails.append(f'choir {t0:.0f}-{t1:.0f} s')
    print(f'{"phrase":15s} {"stage":8s} {"clarity":>9s} {"over bed":>8s} {"wer":>5s}  {"gate":6s}  heard')
    for r in rows:
        print(f'{r["phrase"]:15s} {r["stage"]:8s} {str(r["clarity"]):>9s} {r["over_bed_db"]:+7.1f}  {r["wer"]:5.2f}  {r["gate"]:6s}  {"" if r["ok"] else "FAIL "}"{r["heard"]}"  (expected "{r["expected"]}")')
    for c in chant:
        print(f'choir {c["window"][0]:6.1f}-{c["window"][1]:6.1f} s  {"RECOGNISED" if c["recognised"] else "unrecognised"}  "{c["heard"]}"')
    print('RESULT', 'FAIL: ' + ', '.join(fails) if fails else 'PASS')
    if a.json_out:
        json.dump({'phrases': rows, 'choir': chant, 'fails': fails, 'model': a.model}, open(a.json_out, 'w'), indent=1)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
