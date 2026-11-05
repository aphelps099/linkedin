#!/usr/bin/env python3
"""Measurements for the pixel voices (src/allhands/voices). Offline, CPU, no API.

  align   word boundaries for bank takes, measured the way the lady's are
          (scripts/align-lady-phrases.py: pocketsphinx HMM forced alignment,
          CTC cross-check with torchaudio MMS_FA and WAV2VEC2_ASR_BASE_960H,
          1 ms snapping to the audio, vowel onsets, Whisper small.en re-hearing
          every word cut), plus syllable nuclei (the HMM's vowel phones) for
          placing notes, f0 per word and the level.
  hear    Whisper small.en on whole renders: transcript and word error rate.
  pitch   the sung pitch of each syllable nucleus against its target note, with
          two estimators that share no code with the JS chain (normalised
          autocorrelation, and subharmonic summation on the spectrum).
  tamb    spectral and envelope measurements of the synthesized tambourine.

Each reads a JSON job list and writes a JSON result:
  python3 -I src/allhands/voices/measure.py align jobs.json out.json [--verify]
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly, butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[3]
_spec = importlib.util.spec_from_file_location('lady_align', ROOT / 'scripts' / 'align-lady-phrases.py')
LADY = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(LADY)            # the lady's aligner, unchanged (its main() is guarded)
SR = LADY.SR                               # 24 kHz: the aligner's rate

# Spellings Whisper gives for the word itself (added to the lady aligner's list).
LADY.ALIKE.update({'grateful': {'greatful'}, 'thoughts': set(), 'delve': {'delv'}})

# Words the CMU dictionary lacks, in its phone set.
EXTRA_WORDS = {'learnings': 'L ER N IH NG Z', 'delve': 'D EH L V'}


def load(path):
    sr, raw = wavfile.read(path)
    x = raw.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if np.issubdtype(raw.dtype, np.integer):
        x /= 32768.0
    return sr, x


def to_rate(x, sr, rate):
    if sr == rate:
        return x
    g = np.gcd(int(sr), int(rate))
    return resample_poly(x, rate // g, sr // g)


# ---------------------------------------------------------------- align
def sphinx_phones(x16, toks):
    """pocketsphinx forced alignment with phone times. Per display token: start, end,
    phone classes at its edges, first vowel, and every vowel phone span (the syllable
    nuclei). None if the decoder cannot align the text."""
    from pocketsphinx import Decoder
    pad = np.zeros(int(0.3 * 16000))
    pcm = (np.clip(np.concatenate([pad, x16, pad]), -1, 1) * 32767).astype(np.int16).tobytes()
    dec = Decoder(samprate=16000, bestpath=False, loglevel='FATAL')
    for w, p in EXTRA_WORDS.items():
        if dec.lookup_word(w) is None:
            dec.add_word(w, p, True)
    dec.set_align_text(' '.join(w for _, ws, _ in toks for w in ws))
    for k in range(2):
        dec.start_utt()
        dec.process_raw(pcm, full_utt=True)
        dec.end_utt()
        if k == 0:
            dec.set_alignment()
    alignment = dec.get_alignment()
    found = [(w.name, w.start, w.start + w.duration, [(p.name, p.start, p.start + p.duration) for p in w])
             for w in (alignment or []) if w.name not in ('<sil>', '<s>', '</s>', '[NOISE]')]
    del alignment
    if len(found) != sum(len(ws) for _, ws, _ in toks):
        return None
    out, k = [], 0
    C = LADY.ARPA_CLASS
    for _, ws, _ in toks:
        seg = found[k:k + len(ws)]
        k += len(ws)
        phones = [p for w in seg for p in w[3]]
        vowels = [(s / 100 - 0.3, e / 100 - 0.3) for w in seg for p, s, e in w[3] if C.get(re.sub(r'\d', '', p)) == 'V']
        out.append(dict(start=seg[0][1] / 100 - 0.3, end=seg[-1][2] / 100 - 0.3,
                        first=C.get(phones[0][0], 'V'),
                        last=LADY.AFFRICATE_END.get(phones[-1][0], C.get(phones[-1][0], 'V')),
                        vowel=vowels[0][0] if vowels else seg[0][1] / 100 - 0.3,
                        vowels=vowels, phones=' '.join(p for p, _, _ in phones)))
    return out


def nuclei_from_energy(feat, s, e, n):
    """Fallback syllable nuclei: the n strongest 0.5-3 kHz energy peaks in [s, e]."""
    ka, kb = feat.frame(s), feat.frame(e)
    m = feat.Ms[ka:kb]
    if n <= 1 or len(m) < 40:
        return [(s, e)]
    peaks = []
    for k in np.argsort(-m):
        if all(abs(k - p) > 70 for p in peaks):
            peaks.append(int(k))
        if len(peaks) == n:
            break
    peaks.sort()
    cuts = [ka + p + int(np.argmin(m[p:q])) for p, q in zip(peaks, peaks[1:])]
    edges = [ka] + cuts + [kb]
    return [(feat.time(a), feat.time(b)) for a, b in zip(edges, edges[1:])]


def r3(t):
    return round(float(t), 3)


def align(jobs, verify):
    try:
        ctc = LADY.CTC()
    except ImportError:
        ctc = None
    verifier = LADY.Verifier('small.en') if verify else None
    rows = []
    for job in jobs:
        sr, x0 = load(job['path'])
        x = to_rate(x0, sr, SR)
        feat = LADY.Feat(x)
        toks = LADY.spoken_tokens(job['text'])
        x16 = resample_poly(x, 2, 3).astype(np.float32)
        hmm = sphinx_phones(x16, toks)
        ctc_words = ctc.align(x16, [l for _, _, l in toks]) if ctc else {}
        aligner = 'pocketsphinx-hmm'
        if hmm is None:
            base = ctc_words['mms_fa']
            hmm = [dict(start=w['start'], end=w['end'], first='?', last='?', vowel=None, vowels=[], phones='') for w in base]
            aligner = 'ctc-mms_fa'
        starts, ends, kinds = LADY.snap(feat, hmm, ctc_words)
        words = []
        for i, ((tok, ws, _), s, e) in enumerate(zip(toks, starts, ends)):
            onset = LADY.vowel_onset(feat, s, e, hmm[i].get('vowel'))
            vs = [(max(s, a), min(e, b)) for a, b in hmm[i].get('vowels', []) if min(e, b) - max(s, a) > 0.012]
            syl = vs if vs else nuclei_from_energy(feat, s, e, max(1, len(hmm[i].get('vowels', [])) or 1))
            words.append(dict(text=tok, start=r3(s), end=r3(e), onset=r3(onset),
                              syllables=[[r3(a), r3(b)] for a, b in syl],
                              f0=round(LADY.f0_median(x, [(s, e)]), 1)))
        spans = [(w['start'], w['end']) for w in words]
        active = np.concatenate([x[int(s * SR):int(e * SR)] for s, e in spans])
        rms_db = 10 * np.log10(np.mean(active ** 2) + 1e-12)
        probs = [float(np.mean([m[i]['prob'] for m in ctc_words.values()])) if ctc_words else 0.8 for i in range(len(words))]
        edge = [1.0]
        for i, kind in enumerate(kinds):
            mine = (words[i]['end'] + words[i + 1]['start']) / 2
            offs = [abs((m[i]['end'] + m[i + 1]['start']) / 2 - mine) for m in ctc_words.values()]
            a = float(np.exp(-np.mean(offs) / 0.05)) if offs else 0.8
            landmark = kind == 'gap' or not (kind[-3] in 'FZ' and kind[-1] in 'FZ' or kind[-3:] in ('V|V', 'V|A', 'A|V', 'A|A'))
            edge.append((1.0 if kind == 'gap' else 0.9 if landmark else 0.75) * (0.6 + 0.4 * a))
        edge.append(1.0)
        wconf = [min(1.0, 0.35 + 0.65 * p) * min(edge[i], edge[i + 1]) for i, p in enumerate(probs)]
        row = dict(id=job['id'], file=job['file'], voice=job['voice'], text=job['text'], kind=job.get('kind'),
                   duration=r3(len(x0) / sr), voiced=[words[0]['start'], words[-1]['end']],
                   f0=round(LADY.f0_median(x, spans), 1), rmsDb=round(float(rms_db), 2),
                   gainDb=round(float(LADY.TARGET_DB - rms_db), 2), words=words,
                   method=aligner + ('+ctc-check(mms_fa,w2v2_base_960h)' if ctc_words else '') + '+snap:' + (','.join(kinds) or 'single'),
                   confidence=0.0)
        if verifier:
            v = verifier.check(x, words)
            factor = []
            for w, (heard, ok), cok in zip(words, v['iso'], v['ctx']):
                w['check'] = 'isolated' if ok else ('context' if cok else 'fail')
                w['heard'] = heard
                factor.append(1.0 if ok else (0.85 if cok else 0.4))
            wconf = [c * f for c, f in zip(wconf, factor)]
            row['heard'] = v['full']
        row['confidence'] = round(float(min(wconf)), 2)
        rows.append(row)
        flag = lambda w: '' if w.get('check', 'isolated') == 'isolated' else ' ' + w['check'].upper()
        print(f"{job['id']:<36} conf {row['confidence']:.2f} f0 {row['f0']:6.1f} " +
              ' '.join(f"{w['text']}[{w['start']:.3f}-{w['end']:.3f} {len(w['syllables'])}syl{flag(w)}]" for w in words),
              file=sys.stderr, flush=True)
    return rows


# ---------------------------------------------------------------- hear
def words_of(s):
    return LADY.norm_words(s)


def wer(expected, heard):
    """Word error rate, with compounds allowed to join ("game changer" == "gamechanger")."""
    a, b = words_of(expected), words_of(heard)
    if ''.join(a).replace("'", '') == ''.join(b).replace("'", ''):
        return 0.0, 0
    d = np.zeros((len(a) + 1, len(b) + 1), int)
    d[:, 0] = range(len(a) + 1)
    d[0, :] = range(len(b) + 1)
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            same = a[i - 1] == b[j - 1] or b[j - 1] in LADY.ALIKE.get(a[i - 1], ())
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (0 if same else 1))
    return float(d[-1, -1] / max(1, len(a))), int(d[-1, -1])


def hear(jobs):
    from faster_whisper import WhisperModel
    model = WhisperModel('small.en', device='cpu', compute_type='int8')
    out = []
    for job in jobs:
        sr, x = load(job['path'])
        y = to_rate(x, sr, 16000)
        y = np.concatenate([np.zeros(4800), y, np.zeros(4800)]).astype(np.float32)
        segs, _ = model.transcribe(y, language='en', beam_size=5, temperature=0.0,
                                   condition_on_previous_text=False, without_timestamps=True, vad_filter=False)
        heard = ' '.join(s.text.strip() for s in segs).strip()
        rate, errors = wer(job['text'], heard)
        out.append(dict(job, heard=heard, wer=round(rate, 3), errors=errors, words=len(words_of(job['text']))))
        print(f"{job['path'].split('/')[-1]:<44} {rate:5.2f}  {heard}", file=sys.stderr, flush=True)
    return out


# ---------------------------------------------------------------- pitch
FR, HOPP = 0.04, 0.005


def frames(x, sr):
    fl, hop = int(FR * sr), int(HOPP * sr)
    for i in range(0, len(x) - fl, hop):
        yield i, x[i:i + fl]


def nccf_track(x, sr, fmin=55, fmax=500):
    """Normalised autocorrelation per 5 ms frame (40 ms window): (time, f0, clarity, level)."""
    lo, hi = int(sr / fmax), int(sr / fmin)
    out = []
    for i, fr in frames(x, sr):
        fr = fr - fr.mean()
        lev = np.sqrt(np.mean(fr ** 2))
        fl = len(fr)
        ac = np.correlate(fr, fr, 'full')[fl - 1:fl + hi + 1]
        csum = np.concatenate([[0], np.cumsum(fr ** 2)])
        energy = csum[fl - np.arange(hi + 2)]          # energy of fr[:fl-k] for each lag k
        n = ac / np.sqrt(ac[0] * energy + 1e-12)
        k = lo + int(np.argmax(n[lo:hi]))
        # parabolic refinement
        if 1 <= k < len(n) - 1:
            a, b, c = n[k - 1], n[k], n[k + 1]
            den = a - 2 * b + c
            kk = k + 0.5 * (a - c) / den if den else k
        else:
            kk = k
        out.append(((i + fl / 2) / sr, sr / kk, float(n[k]), float(lev)))
    return out


def shs_f0(fr, sr, fmin=55, fmax=500):
    """Subharmonic summation on the magnitude spectrum (Hermes 1988), 1-cent grid."""
    n = 1 << int(np.ceil(np.log2(len(fr) * 4)))
    spec = np.abs(np.fft.rfft(fr * np.hanning(len(fr)), n))
    freqs = np.fft.rfftfreq(n, 1 / sr)
    logspec = np.interp(np.arange(0, 5000, 1.0), freqs, spec)
    cands = fmin * 2 ** (np.arange(0, 1200 * np.log2(fmax / fmin), 2) / 1200)
    score = np.zeros(len(cands))
    for h in range(1, 11):
        idx = np.clip((cands * h).astype(int), 0, len(logspec) - 1)
        score += (0.84 ** (h - 1)) * logspec[idx]
    return float(cands[int(np.argmax(score))])


def cents(f, midi):
    return 1200 * np.log2(f / (440 * 2 ** ((midi - 69) / 12)))


def pitch(jobs):
    out = []
    for job in jobs:
        sr, x = load(job['path'])
        x16 = to_rate(x, sr, 16000)
        track = nccf_track(x16, 16000)
        res = []
        for nt in job['notes']:
            fr = [(t, f, c, l) for t, f, c, l in track if nt['from'] <= t <= nt['to'] and c > 0.6]
            if not fr:
                res.append(dict(nt, f0=None, cents=None, shs=None, frames=0))
                continue
            top = max(l for _, _, _, l in fr)
            fr = [r for r in fr if r[3] >= top * 10 ** (-6 / 20)]          # the vowel, not the glide into it
            f_nccf = float(np.median([f for _, f, _, _ in fr]))
            # octave check against the target (an estimator may lock on a sub-harmonic)
            tgt = 440 * 2 ** ((nt['midi'] - 69) / 12)
            shs = []
            for t, _, _, _ in fr[::2]:
                i = int((t - FR / 2) * 16000)
                seg = x16[max(0, i):i + int(FR * 16000)]
                if len(seg) == int(FR * 16000):
                    shs.append(shs_f0(seg - seg.mean(), 16000))
            f_shs = float(np.median(shs)) if shs else None
            within = float(np.mean([abs(cents(f, nt['midi'])) <= 50 for _, f, _, _ in fr]))
            res.append(dict(nt, f0=round(f_nccf, 2), cents=round(float(cents(f_nccf, nt['midi'])), 1),
                            shs=round(f_shs, 2) if f_shs else None,
                            shsCents=round(float(cents(f_shs, nt['midi'])), 1) if f_shs else None,
                            frames=len(fr), within50=round(within, 3), targetHz=round(tgt, 2)))
        out.append(dict(job, notes=res))
        cs = [abs(r['cents']) for r in res if r['cents'] is not None]
        print(f"{job['path'].split('/')[-1]:<44} notes {len(res)} median |c| {np.median(cs) if cs else float('nan'):5.1f} max {max(cs) if cs else float('nan'):6.1f}",
              file=sys.stderr, flush=True)
    return out


# ---------------------------------------------------------------- tambourine
def tamb(jobs):
    out = []
    for job in jobs:
        sr, x = load(job['path'])
        res = dict(job)
        n = 1 << int(np.ceil(np.log2(len(x))))
        spec = np.abs(np.fft.rfft(x * np.hanning(len(x)), n)) ** 2
        f = np.fft.rfftfreq(n, 1 / sr)
        tot = spec.sum()
        res['centroidHz'] = round(float((f * spec).sum() / tot), 0)
        bands = [(0, 1000), (1000, 3000), (3000, 6000), (6000, 10000), (10000, 16000), (16000, sr / 2)]
        res['bands'] = {f'{a / 1000:g}-{b / 1000:g}k': round(float(10 * np.log10(spec[(f >= a) & (f < b)].sum() / tot + 1e-12)), 1) for a, b in bands}
        geo = np.exp(np.mean(np.log(spec[(f > 2000) & (f < 16000)] + 1e-20)))
        res['flatness2to16k'] = round(float(geo / np.mean(spec[(f > 2000) & (f < 16000)])), 3)
        # strongest peaks 2-16 kHz (at least 150 Hz apart)
        band = (f > 2000) & (f < 16000)
        sm = np.convolve(spec, np.ones(9) / 9, 'same')
        idx = np.flatnonzero(band)
        order = idx[np.argsort(-sm[idx])]
        peaks = []
        for k in order:
            if all(abs(f[k] - p) > 150 for p in peaks):
                peaks.append(float(f[k]))
            if len(peaks) == 8:
                break
        peaks.sort()
        res['peaksHz'] = [round(p) for p in peaks]
        res['peakRatios'] = [round(p / peaks[0], 3) for p in peaks]
        env = np.sqrt(np.convolve(x ** 2, np.ones(int(0.002 * sr)) / int(0.002 * sr), 'same'))
        edb = 20 * np.log10(env + 1e-9)
        k0 = int(np.argmax(edb))
        pk = edb[k0]
        after = np.flatnonzero(edb[k0:] < pk - 20)
        before = np.flatnonzero(edb[:k0] < pk - 20)
        res['attackMs'] = round(float((k0 - (before[-1] if len(before) else 0)) / sr * 1000), 1)
        res['decay20dBms'] = round(float(after[0] / sr * 1000), 1) if len(after) else None
        above = np.flatnonzero(edb > pk - 20)
        res['widthMs'] = round(float((above[-1] - above[0]) / sr * 1000), 1)
        res['crestDb'] = round(float(20 * np.log10(np.abs(x).max() / (np.sqrt(np.mean(x ** 2)) + 1e-12))), 1)
        out.append(res)
        print(job['path'].split('/')[-1], json.dumps({k: v for k, v in res.items() if k != 'path'}), file=sys.stderr)
    return out


def main():
    cmd, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    jobs = json.loads(Path(src).read_text())
    if cmd == 'align':
        result = align(jobs, '--verify' in sys.argv)
    elif cmd == 'hear':
        result = hear(jobs)
    elif cmd == 'pitch':
        result = pitch(jobs)
    elif cmd == 'tamb':
        result = tamb(jobs)
    else:
        sys.exit(f'unknown command {cmd}')
    Path(dst).write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
