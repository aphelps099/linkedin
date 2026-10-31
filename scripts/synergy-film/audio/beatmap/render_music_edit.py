#!/usr/bin/env python3
"""Render the music edit described by music_edit.json (sample-accurate, 48 kHz float).

usage: render_music_edit.py music_edit.json out.wav [--variant alt_button_f1409]
Only edits and gain/fades of the licensed recording are applied: no synthesis.
"""
import json, sys
import numpy as np, soundfile as sf

def raised_cos_in(n):
    return 0.5 * (1 - np.cos(np.pi * (np.arange(n) + 0.5) / n))

def raised_cos_out(n):
    return 0.5 * (1 + np.cos(np.pi * (np.arange(n) + 0.5) / n))

def render(plan, variant=None):
    src, sr = sf.read(plan['source']['decoded_48k'], dtype='float32', always_2d=True)
    assert sr == plan['film']['sr']
    out = np.zeros((plan['film']['total_samples'], src.shape[1]), dtype=np.float32)
    segs = [dict(s) for s in plan['segments']]
    if variant:
        ov = plan['variants'][variant]['segment_override']
        for s in segs:
            if s['id'] == ov['id']:
                f0, f1 = ov['film_frames']
                spf = plan['film']['samples_per_frame']
                s['film_samples_48k'] = [(f0 - 1) * spf, f1 * spf]
                s['file_samples_48k'] = ov['file_samples_48k']
                s['fade_out'] = ov['fade_out']
    for s in segs:
        a, b = s['film_samples_48k']
        c, d = s['file_samples_48k']
        assert b - a == d - c, s['id']
        x = src[c:d].copy() * np.float32(10 ** (s.get('gain_db', 0.0) / 20))
        fi = s.get('fade_in')
        if fi and fi['samples'] > 0:
            x[:fi['samples']] *= raised_cos_in(fi['samples'])[:, None]
        fo = s.get('fade_out')
        if fo and fo['samples'] > 0:
            g = fo.get('guard_samples', 0)
            end = len(x) - g
            x[end - fo['samples']:end] *= raised_cos_out(fo['samples'])[:, None]
            x[end:] = 0.0
        out[a:b] += x
    return out, sr

if __name__ == '__main__':
    plan = json.load(open(sys.argv[1]))
    variant = sys.argv[sys.argv.index('--variant') + 1] if '--variant' in sys.argv else None
    out, sr = render(plan, variant)
    sf.write(sys.argv[2], out, sr, subtype='FLOAT')
    print('wrote', sys.argv[2], out.shape, 'peak', float(np.abs(out).max()))
