#!/usr/bin/env python3
"""Verify the rendered music edit against the 16-frame / 90 BPM film grid.

usage: verify_music_edit.py music_edit.json test_music_edit.wav [--write]
Checks: (1) sample-exact mapping of every segment to the source, (2) measured transient
onsets in the RENDER vs the film beat grid, (3) hard stops / starts, (4) click metrics at edits.
"""
import json, sys
import numpy as np, soundfile as sf, scipy.signal as ss

plan = json.load(open(sys.argv[1]))
out, SR = sf.read(sys.argv[2], dtype='float64', always_2d=True)
src, sr2 = sf.read(plan['source']['decoded_48k'], dtype='float64', always_2d=True)
assert SR == sr2 == 48000
SPB = plan['film']['samples_per_beat']; SPF = plan['film']['samples_per_frame']
mo, ms = out.mean(1), src.mean(1)
res = dict(test_wav=sys.argv[2], total_samples=len(out), duration_s=len(out) / SR)

# ---- 1. mapping exactness
mapping = []
for s in plan['segments']:
    a, b = s['film_samples_48k']; c, d = s['file_samples_48k']
    fi = s['fade_in']['samples']; fo = s['fade_out']['samples'] + s['fade_out'].get('guard_samples', 0)
    diff = np.abs(out[a + fi:b - fo] - src[c + fi:d - fo]).max()
    lags = []
    for off in (fi + 2400, (b - a) // 2, (b - a) - fo - 4800):          # 50 ms windows at head, middle, tail
        w = out[a + off:a + off + 2400, 0]
        ref = src[c + off - 240:c + off + 2400 + 240, 0]
        cc = ss.correlate(ref, w, 'valid'); k = int(np.argmax(cc))
        y0, y1, y2 = cc[k - 1], cc[k], cc[k + 1]; frac = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)
        lags.append(round(float(k + frac - 240), 4))
    mapping.append(dict(id=s['id'], max_abs_diff_outside_fades=float(diff), xcorr_lag_samples_head_mid_tail=lags,
                        lag_ms_max=round(max(abs(l) for l in lags) / SR * 1000, 5)))

# ---- 2. onsets in the render vs grid
B = 12  # 0.25 ms bins
def onset(x, g, lo=-0.006, hi=0.008):
    """Main-attack onset near grid sample g, in ms relative to g (0.25 ms resolution).
    Finds the steepest 0.75 ms rise of the 0.25 ms RMS envelope inside [lo, hi), then walks back
    to where that rise starts. Returns (onset_ms, rise_db); onset is None when the rise is < 6 dB
    (no clear transient on that beat)."""
    i0 = g + int(-0.020 * SR); i1 = g + int(0.020 * SR)
    pad = max(0, -i0)
    seg = np.r_[np.zeros(pad), x[max(0, i0):i1]]
    nb = len(seg) // B
    e = 20 * np.log10(np.sqrt((seg[:nb * B] ** 2).reshape(nb, B).mean(1)) + 1e-7)
    t = (np.arange(nb) * B + i0 - g) / SR
    rise = np.full(nb, -np.inf)
    rise[:-3] = e[3:] - e[:-3]
    win = np.where((t >= lo) & (t < hi))[0]
    def start_of_rise(k):
        j = k
        while j - 1 >= win[0] - 2 and e[j - 1] < e[j] - 0.5:
            j -= 1
        while j + 1 < nb and e[j + 1] < -120:     # digital silence before the rise: skip to its last bin
            j += 1
        return float((t[j] + B / SR) * 1000)      # the rise begins at the end of the lowest bin
    k = win[np.argmax(rise[win])]
    total = float(e[min(nb - 1, k + 3)] - e[k])
    if total < 6.0:
        return None, total, None
    first = next(i for i in win if rise[i] >= max(6.0, 0.6 * total))
    return start_of_rise(k), total, start_of_rise(first)

def music_at(n):
    for s in plan['segments']:
        a, b = s['film_samples_48k']
        if a <= n < b - s['fade_out']['samples'] - s['fade_out'].get('guard_samples', 0):
            return s
    return None

beats = []
for b in range(90):
    g = b * SPB
    s = music_at(g)
    if not s:
        continue
    o, jump, first = onset(mo, g)
    beats.append(dict(beat=b, frame=16 * b + 1, segment=s['id'], onset_err_ms=None if o is None else round(o, 3),
                      first_transient_ms=None if first is None else round(first, 3), rise_db=round(jump, 1)))
per_seg = {}
for sid in ('M1', 'M2', 'M3'):
    v = np.array([x['onset_err_ms'] for x in beats if x['segment'] == sid and x['onset_err_ms'] is not None])
    per_seg[sid] = dict(beats_with_clear_onset=int(len(v)), beats_total=sum(1 for x in beats if x['segment'] == sid),
                        mean_ms=round(float(v.mean()), 3), median_ms=round(float(np.median(v)), 3),
                        std_ms=round(float(v.std()), 3), max_abs_ms=round(float(np.abs(v).max()), 3))

# sync-averaged onset per segment (robust 'feel' of the grid)
def sync_avg(sid):
    idx = [x['beat'] * SPB for x in beats if x['segment'] == sid and x['beat'] * SPB > 0]
    P, Q = int(0.02 * SR), int(0.03 * SR)
    acc = np.zeros(P + Q)
    for g in idx:
        acc += mo[g - P:g + Q] ** 2
    acc /= len(idx)
    nb = len(acc) // B; e = np.sqrt(acc[:nb * B].reshape(nb, B).mean(1)); t = (np.arange(nb) * B - P) / SR * 1000
    base = np.median(e[(t > -15) & (t < -5)]); pk = e[(t > -6) & (t < 15)].max()
    return round(float(t[np.where((t > -6) & (e > base + 0.1 * (pk - base)))[0][0]]), 3)
for sid in per_seg:
    per_seg[sid]['sync_avg_onset_10pct_ms'] = sync_avg(sid)
    f_ = np.array([x['first_transient_ms'] for x in beats if x['segment'] == sid and x['first_transient_ms'] is not None])
    per_seg[sid]['first_transient_mean_ms'] = round(float(f_.mean()), 3)
    per_seg[sid]['first_transient_max_abs_ms'] = round(float(np.abs(f_).max()), 3)

# ---- 3. section boundaries
def last_nonzero_before(n):
    seg = np.abs(out[n - 4800:n]).max(1)
    nz = np.where(seg > 0)[0]
    return n - 4800 + nz[-1] if len(nz) else None
bounds = []
for f, label in [(1, 'S01 start / intro'), (129, 'f129 loop splice (match cut)'), (257, 'f257 DROP'), (321, 'f321 printer downbeat'),
                 (705, 'f705 file bar 9 (busiest bar)'), (769, 'f769 file bar 10 (groove B)'), (833, 'f833 S09 cut'),
                 (961, 'f961 JACK CLICK hard stop'), (1153, 'f1153 intro returns'), (1217, 'f1217 firefly lock'),
                 (1281, 'f1281 full kit re-enters'), (1297, 'f1297 sip'), (1345, 'f1345 final bar'), (1409, 'f1409 HARD STOP')]:
    g = (f - 1) * SPF
    if f in (961, 1409):
        ln = last_nonzero_before(g)
        after = float(np.abs(out[g:g + 24000]).max())
        fo = next(s for s in plan['segments'] if s['film_samples_48k'][1] == g)['fade_out']
        end = g - fo.get('guard_samples', 0)
        bounds.append(dict(frame=f, label=label, grid_s=round(g / SR, 6), type='stop',
                           silent_from_ms=round((ln + 1 - g) / SR * 1000, 3),
                           fade_minus6db_ms=round((end - fo['samples'] / 2 - g) / SR * 1000, 3),
                           peak_after_grid_500ms=after, error_ms=round((ln + 1 - g) / SR * 1000, 3)))
    else:
        o, jump, first = onset(mo, g)
        sg = next((s for s in plan['segments'] if s['film_samples_48k'][0] == g), None)
        d = dict(frame=f, label=label, grid_s=round(g / SR, 6), type='onset',
                 error_ms=None if o is None else round(o, 3), first_transient_ms=None if first is None else round(first, 3), rise_db=round(jump, 1))
        if sg is not None:   # segment start: where the first audible sample lands
            pre = np.abs(out[max(0, g - 48):g]).max() if g > 0 else 0.0
            nz = np.where(np.abs(out[g:g + 480]).max(1) > 0)[0]
            d['silent_1ms_before'] = bool(pre == 0.0)
            d['first_nonzero_sample_offset'] = int(nz[0])
            d['source_sample_at_grid'] = sg['file_samples_48k'][0]
        bounds.append(d)
res['mapping'] = mapping
res['section_boundaries'] = bounds
res['per_segment_beat_stats'] = per_seg
res['beats'] = beats

# ---- 4. click metrics at each edit
hp = ss.sosfilt(ss.butter(4, 5000, 'highpass', fs=SR, output='sos'), out, axis=0).mean(1)
hps = ss.sosfilt(ss.butter(4, 5000, 'highpass', fs=SR, output='sos'), src, axis=0).mean(1)
def hfwin(x, n):
    return np.mean(x[n:n + 48] ** 2) + 1e-14
clicks = []
for f, kind in [(129, 'splice'), (961, 'stop'), (1153, 'start'), (1409, 'stop')]:
    g = (f - 1) * SPF
    excess = []
    for k in range(-8, 8):          # 1 ms windows from -8 ms to +8 ms
        n = g + k * 48
        refs = []
        for s in plan['segments']:   # what the unedited source would have here
            a, b = s['film_samples_48k']; c = s['file_samples_48k'][0]
            if a - 960 <= n < b + 960:
                m = c + n - a
                if 0 <= m < len(hps) - 48:
                    refs.append(hfwin(hps, m))
        ref = max(refs) if refs else 1e-14
        excess.append(10 * np.log10(hfwin(hp, n) / ref))
    d = np.abs(np.diff(mo[g - 144:g + 144]))
    local = np.abs(np.diff(mo[g - 48000:g + 48000]))
    local = local[local > 0]
    clicks.append(dict(frame=f, kind=kind, hf_gt5k_excess_db_max=round(float(max(excess)), 2),
                       max_step_near_edit=round(float(d.max()), 5), p999_step_program=round(float(np.percentile(local, 99.9)), 5),
                       verdict='click-free' if max(excess) < 1.0 and d.max() <= np.percentile(local, 99.9) else 'CHECK'))
res['clicks'] = clicks
try:
    import pyloudnorm as pyln
    res['integrated_lufs'] = round(float(pyln.Meter(SR).integrated_loudness(out)), 2)
except Exception:
    pass
res['peak_dbfs'] = round(float(20 * np.log10(np.abs(out).max())), 2)

print(json.dumps(dict(mapping=mapping, section_boundaries=bounds, per_segment=per_seg, clicks=clicks,
                      lufs=res.get('integrated_lufs'), peak=res['peak_dbfs']), indent=1))
if '--write' in sys.argv:
    plan['verification'] = res
    json.dump(plan, open(sys.argv[1], 'w'), indent=1)
    print('verification written into', sys.argv[1])
