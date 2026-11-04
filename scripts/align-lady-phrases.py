#!/usr/bin/env python3
"""Exact word timing for the 57 "lady" recordings (public/phrases/01.wav..57.wav).

Writes src/allhands/lady-phrases.json, one entry per recording:

  {index, file, text, duration, voiced:[s,e], f0, rmsDb, gainDb,
   words:[{text, start, end, onset, check}], method, confidence}

All times are seconds from the start of the file, rounded to 1 ms.

  text     the bank line exactly as written in src/CircleBack.jsx PHRASES, the only
           source that lists all 57 (src/home/tracks.js LINES and src/v2/V2.jsx PADS
           are cross-checked against it). `words` are its whitespace tokens with their
           punctuation ("announce", "build.", "Thoughts?", "share…"). Tokens with no
           letters ("—", emoji) are not spoken and get no timing.
  start    first audible energy of the word; preceding silence is excluded.
  end      where the word's energy has decayed (stop releases are included).
           Consecutive words either share a boundary (end == next start, continuous
           speech) or have silence between them (end < next start).
  onset    attack of the word's first vowel: the steepest rise of 0.5-3 kHz energy
           within 25 ms of where the HMM puts that vowel. Put this on the beat;
           start..onset is the consonant lead-in (the "s" of "sink", the voiced b of "build").
  voiced   [first word start, last word end].
  rmsDb    active-speech RMS over the word spans (mono mix, dBFS: a full-scale square
           wave is 0 dB); gainDb = -14 - rmsDb.
  f0       median pitch over voiced frames (normalised autocorrelation), Hz.
  check    (--verify) Whisper on the cut word, with 10 ms fades: "isolated" = the slice
           alone is heard as the word; "context" = only heard correctly inside the
           exploded phrase (every slice re-joined with 250 ms of silence between);
           "fail" = neither.
  method   aligner plus one tag per boundary: gap (silence between the words) or
           join:<last>|<first> phone classes (V vowel, A approximant, N nasal,
           F voiceless fricative, Z voiced fricative, P stop) for continuous speech.

Method
  1. pocketsphinx HMM forced alignment of the known words (CMU dictionary, 10 ms
     frames) gives word and phone segments.
  2. CTC forced alignment with two independent models (torchaudio MMS_FA and
     WAV2VEC2_ASR_BASE_960H, CPU) cross-checks every boundary; disagreement lowers
     `confidence`. Optional: without torchaudio the check is skipped.
  3. Every boundary is snapped at 1 ms. A silent run near it (energy below the
     file's peak - 38 dB) splits the words at the run's edges, each side extended
     while the energy keeps fading down to peak - 50 dB. In continuous speech the cut
     goes to the steepest change of the band that the phone pair moves (frication
     onset for "to|share", frication end for "Let's|build", closure for "We're|just",
     nasal onset for "for|me"...), within 30 ms of the HMM boundary.
  4. Phrase edges: the speech run holding the first word, extended back while audible;
     the last speech run that starts before the aligned end (final stop releases
     included), extended while it decays.

Usage (needs numpy, scipy and `pip install pocketsphinx`; the CTC check needs CPU torch,
  e.g. pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu;
  --verify needs faster-whisper):
  python3 scripts/align-lady-phrases.py                       # align, write the JSON
  python3 scripts/align-lady-phrases.py --verify --report r.md --sheet s.png
  python3 scripts/align-lady-phrases.py --only 06,50          # print only, no JSON
"""
import argparse
import difflib
import json
import re
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfiltfilt

ROOT = Path(__file__).resolve().parent.parent
PHRASE_DIR = ROOT / 'public' / 'phrases'
OUT = ROOT / 'src' / 'allhands' / 'lady-phrases.json'
SR = 24000
HOP = 24                      # 1 ms feature hop at 24 kHz
TARGET_DB = -14.0             # gainDb normalises active-speech RMS to this
DROP_FILES = ['50', '06', '08', '07', '15', '18', '16', '05', '13']
SPOKEN_AS = {'x': 'ex', 'y': 'why'}   # letters read aloud, for the CTC lexicon


# ---------------------------------------------------------------- text sources
def js_strings(src, pattern):
    """(key, value) for each JS string literal following `pattern` (optional key group)."""
    out = []
    for m in re.finditer(pattern + r"(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')", src):
        raw = m.group(m.lastindex)
        body = raw[1:-1].replace("\\'", "'") if raw[0] == "'" else raw[1:-1]
        value = json.loads('"' + body.replace('\\"', '"').replace('"', '\\"') + '"')
        out.append((m.group(1) if m.lastindex > 1 else None, value))
    return out


def phrase_texts():
    src = (ROOT / 'src' / 'CircleBack.jsx').read_text()
    start = src.index('const PHRASES = [')
    texts = [v for _, v in js_strings(src[start:src.index('];', start)], r'say:\s*')]
    if len(texts) != 57:
        sys.exit(f'expected 57 phrases in src/CircleBack.jsx, found {len(texts)}')
    spoken = lambda s: ' '.join(t for t in s.split() if re.search(r'[A-Za-z0-9]', t))
    warnings = []
    tracks = (ROOT / 'src' / 'home' / 'tracks.js').read_text()
    start = tracks.index('export const LINES')
    for k, v in js_strings(tracks[start:tracks.index('};', start)], r'(\d+):\s*'):
        if spoken(v) != spoken(texts[int(k)]):
            warnings.append(f'tracks.js LINES[{k}] {v!r} != CircleBack {texts[int(k)]!r}')
    for k, v in js_strings((ROOT / 'src' / 'v2' / 'V2.jsx').read_text(), r'bank:\s*(\d+),\s*line:\s*'):
        if spoken(v) != spoken(texts[int(k)]):
            warnings.append(f'V2.jsx PADS bank {k} {v!r} != CircleBack {texts[int(k)]!r}')
    return texts, warnings


def spoken_tokens(text):
    """[(display token, dictionary words for the HMM, letters for CTC)] for spoken tokens."""
    out = []
    for tok in text.split():
        if not re.search(r'[A-Za-z0-9]', tok):
            continue
        low = tok.lower().replace('’', "'")
        words = [w for w in re.sub(r"[^a-z' ]", '', low.replace('-', ' ')).split() if w.strip("'")]
        letters = re.sub(r"[^a-z']", '', low)
        out.append((tok, words, SPOKEN_AS.get(letters, letters)))
    return out


# ---------------------------------------------------------------- signal features
def load(path):
    sr, x = wavfile.read(path)
    if sr != SR:
        sys.exit(f'{path.name}: expected {SR} Hz, got {sr}')
    x = x.astype(np.float64)
    return (x.mean(axis=1) if x.ndim > 1 else x) / 32768.0


def envelope_db(y, win_s=0.008):
    k = np.hanning(int(win_s * SR))
    e = np.convolve(y * y, k / k.sum(), mode='same')[::HOP]
    return 10 * np.log10(e + 1e-12)


class Feat:
    """1 ms envelopes (8 ms Hann): E above 120 Hz, 120-500 Hz L (voicing),
    0.5-3 kHz M (vowel formants), >3 kHz H (frication); silence thresholds."""

    def __init__(self, x):
        self.x, self.dur = x, len(x) / SR
        band = lambda kind, f: sosfiltfilt(butter(4, f, kind, fs=SR, output='sos'), x)
        # 120 Hz high-pass: several files start with a sub-150 Hz thump before the voice
        # (the lady's f0 is 150-300 Hz), and some pauses carry low hum
        self.E = envelope_db(band('highpass', 120))
        self.L = envelope_db(band('bandpass', [120, 500]))
        self.M = envelope_db(band('bandpass', [500, 3000]))
        self.H = envelope_db(band('highpass', 3000))
        self.peak = float(np.percentile(self.E, 99.5))
        quiet = self.E[(self.E < self.peak - 30.0) & (self.E > -100)]   # pauses, not speech
        self.floor = float(np.percentile(quiet, 5)) if len(quiet) > 20 else self.peak - 70.0
        sm = lambda b: np.convolve(b, np.ones(5) / 5, mode='same')
        self.Ls, self.Ms, self.Hs = sm(self.L), sm(self.M), sm(self.H)
        self.h_floor = float(np.percentile(self.Hs, 5))
        self.t_on = max(self.peak - 38.0, self.floor + 12.0)    # speech / silence split
        self.t_aud = max(self.peak - 50.0, self.floor + 6.0)    # still audible: edges fade to here

    def frame(self, t):
        return int(np.clip(round(t * 1000), 0, len(self.E) - 1))

    def time(self, k):
        return float(min(k / 1000.0, self.dur))


def runs(mask):
    """[start, end) index pairs of the True runs in a boolean array."""
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    return list(zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)))


# ---------------------------------------------------------------- aligners
ARPA_CLASS = {**{p: 'V' for p in 'AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split()},
              **{p: 'A' for p in 'L R W Y'.split()}, **{p: 'N' for p in 'M N NG'.split()},
              **{p: 'F' for p in 'F TH S SH HH'.split()}, **{p: 'Z' for p in 'V DH Z ZH'.split()},
              **{p: 'P' for p in 'P T K B D G CH JH'.split()}}
AFFRICATE_END = {'CH': 'F', 'JH': 'Z'}       # affricates start as a stop, end as a fricative


def sphinx_align(x16, toks):
    """pocketsphinx forced alignment. Per display token: start, end and phone classes at
    its edges; None if the decoder cannot align the text."""
    from pocketsphinx import Decoder
    pad = np.zeros(int(0.3 * 16000))
    pcm = (np.clip(np.concatenate([pad, x16, pad]), -1, 1) * 32767).astype(np.int16).tobytes()
    dec = Decoder(samprate=16000, bestpath=False, loglevel='FATAL')
    dec.set_align_text(' '.join(w for _, ws, _ in toks for w in ws))
    for _ in range(2):                       # pass 1 finds words, pass 2 phones and states
        dec.start_utt()
        dec.process_raw(pcm, full_utt=True)
        dec.end_utt()
        if _ == 0:
            dec.set_alignment()
    alignment = dec.get_alignment()           # entries are only valid while this lives
    found = [(w.name, w.start, w.start + w.duration, [(p.name, p.start) for p in w])
             for w in (alignment or []) if w.name not in ('<sil>', '<s>', '</s>', '[NOISE]')]
    del alignment
    if len(found) != sum(len(ws) for _, ws, _ in toks):
        return None
    out, k = [], 0
    for _, ws, _ in toks:
        seg = found[k:k + len(ws)]
        k += len(ws)
        phones = [p for w in seg for p, _ in w[3]]
        vowel = next((t for w in seg for p, t in w[3] if ARPA_CLASS.get(p) == 'V'), seg[0][1])
        out.append(dict(start=seg[0][1] / 100 - 0.3, end=seg[-1][2] / 100 - 0.3,
                        first=ARPA_CLASS.get(phones[0], 'V'),
                        last=AFFRICATE_END.get(phones[-1], ARPA_CLASS.get(phones[-1], 'V')),
                        vowel=vowel / 100 - 0.3, phones=' '.join(phones)))
    return out


class CTC:
    """Cross-check: CTC forced alignment with two independent acoustic models."""

    def __init__(self):
        import torch
        import torchaudio
        torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
        self.torch, self.ta = torch, torchaudio
        fa, b2 = torchaudio.pipelines.MMS_FA, torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        self.models = [
            ('mms_fa', fa.get_model(with_star=False).eval(), fa.get_dict(star=None), False, None),
            ('w2v2_base_960h', b2.get_model().eval(), {c: i for i, c in enumerate(b2.get_labels())}, True, '|'),
        ]

    def align(self, x16, lex):
        """Per model: [{start, end, prob}] per word, seconds."""
        torch, F = self.torch, self.ta.functional
        pad = np.zeros(int(0.3 * 16000), np.float32)
        wav = torch.from_numpy(np.concatenate([pad, x16, pad]).astype(np.float32))[None]
        result = {}
        for name, model, vocab, upper, sep in self.models:
            with torch.inference_mode():
                em = torch.log_softmax(model(wav)[0], dim=-1)
            toks, owner = [], []
            for wi, w in enumerate(lex):
                if sep and wi:
                    toks.append(vocab[sep])
                    owner.append(-1)
                toks += [vocab[c.upper() if upper else c] for c in w]
                owner += [wi] * len(w)
            ali, scores = F.forced_align(em, torch.tensor([toks], dtype=torch.int32), blank=0)
            spans = F.merge_tokens(ali[0], scores[0].exp())
            fr = wav.shape[1] / em.shape[1] / 16000
            words = []
            for wi in range(len(lex)):
                ss = [s for s, o in zip(spans, owner) if o == wi]
                words.append(dict(start=ss[0].start * fr - 0.3, end=ss[-1].end * fr - 0.3,
                                  prob=float(np.mean([s.score for s in ss]))))
            result[name] = words
        return result


# ---------------------------------------------------------------- boundary snapping
def snap(feat, hmm, ctc):
    """Tight, ordered [start, end] per word plus a tag per boundary (see module doc)."""
    n = len(hmm)
    speech = feat.E > feat.t_on
    starts, ends, kinds = [0.0] * n, [0.0] * n, []
    ctc_first = [w[0]['start'] for w in ctc.values()]
    ctc_last = [w[-1]['end'] for w in ctc.values()]

    # phrase start: the first speech run reaching past the aligned start, faded in
    first = min([hmm[0]['start']] + ctc_first)
    cand = [a for a, b in runs(speech) if b / 1000 > first - 0.03 and b - a >= 8]
    k = cand[0] if cand else feat.frame(first)
    while k > 0 and feat.t_aud < feat.E[k - 1] <= feat.E[k] + 1.0:
        k -= 1
    starts[0] = feat.time(k)

    for i in range(n - 1):
        h_end, h_start = hmm[i]['end'], hmm[i + 1]['start']
        prior = (h_end + h_start) / 2
        # the CTC models vote too: the HMM sometimes runs a word over a pause
        # ("Humbled, and": it starts "and" 140 ms before the pause ends)
        votes = [prior] + ([float(np.median([(m[i]['end'] + m[i + 1]['start']) / 2 for m in ctc.values()]))]
                           if ctc else [])
        lo = max(starts[i] + 0.04, min([h_end] + votes) - 0.06)
        hi = min(hmm[i + 1]['end'] - 0.02, max([h_start] + votes) + 0.06)
        ka, kb = feat.frame(lo), feat.frame(max(hi, lo + 0.01)) + 1
        quiet = set()
        for a, b in runs(~speech[ka:kb]):
            if b - a < 6:
                continue
            a, b = a + ka, b + ka
            while a > 0 and not speech[a - 1]:          # the whole silent run
                a -= 1
            while b < len(speech) and not speech[b]:
                b += 1
            # a stop closure inside a word (the t of "Let's") is silent too: accept a
            # run only if the aligned boundary falls in or near it
            # and a weak fricative is not silence ("I'm thrilled": the θ sits under the
            # speech threshold but is plainly audible hiss); a long hissy run is a breath
            hiss = (hmm[i + 1]['first'] == 'F' and b - a <= 120
                    and np.median(feat.Hs[a:b]) > feat.h_floor + 15.0)
            if not hiss and any(abs((a + b) / 2000 - v) <= (b - a) / 2000 + 0.04 for v in votes):
                quiet.add((a, b))
        if quiet:
            a, b = max(quiet, key=lambda r: (r[1] - r[0]) - 0.5 * abs((r[0] + r[1]) / 2 - prior * 1000))
            mid = (a + b) // 2
            e = a                                          # word i's tail, while still fading
            while e < mid and feat.t_aud < feat.E[e] <= feat.E[e - 1] + 0.5:
                e += 1
            s = b                                          # word i+1's attack, back while fading
            while s > max(mid, e) and feat.t_aud < feat.E[s - 1] <= feat.E[s] + 0.5:
                s -= 1
            ends[i], starts[i + 1] = feat.time(e), feat.time(s)
            kinds.append('gap')
            # a word-final stop's silence is its closure: the burst (and aspiration) after it
            # still belongs to word i ("teamwork|makes", "paced|world"), up to the next voicing
            # (not before ð/v/z: "Let that" - the burst there is the ð; not after a real pause)
            if hmm[i]['last'] == 'P' and hmm[i + 1]['first'] in 'VAN' and b - a <= 150:
                cut = release_end(feat, b, min(b + 90, feat.frame(hmm[i + 1]['end'])), min_hf=0.0)
                if cut is not None:
                    ends[i] = starts[i + 1] = feat.time(cut)
                    kinds[-1] = f'release:P|{hmm[i + 1]["first"]}'
        else:
            last, first_cls = hmm[i]['last'], hmm[i + 1]['first']
            hi_cut = min(hmm[i + 1]['end'], (hmm[i + 1]['end'] + hmm[i + 2]['start']) / 2 if i + 2 < n else 1e9)
            cut = cut_point(feat, last, first_cls, prior, starts[i] + 0.03, hi_cut - 0.03)
            ends[i] = starts[i + 1] = cut
            kinds.append(f'join:{last}|{first_cls}')

    # phrase end: speech runs that begin before the aligned end (+40 ms) and follow on
    # with gaps under 120 ms (final stop closures), then the tail while it decays
    last_end = float(np.median(ctc_last)) if ctc_last else hmm[-1]['end']
    k0 = feat.frame(starts[-1])
    end_k = k0 + 1
    for a, b in runs(speech):
        if b <= k0 or b - a < 4:
            continue
        if a / 1000 > last_end + 0.04 or (end_k > k0 + 1 and a - end_k > 120):
            break
        end_k = max(end_k, b)
    if hmm[-1]['last'] == 'P':                    # a final stop: its release after the closure
        for a, b in runs(speech):
            if end_k <= a <= end_k + 150 and b - a <= 100:
                end_k = b
                break
    while end_k < len(feat.E) - 1 and feat.t_aud < feat.E[end_k] <= feat.E[end_k - 1] + 1.0:
        end_k += 1
    ends[-1] = feat.time(end_k)
    return starts, ends, kinds


def release_end(feat, k0, k_max, min_hf=-15.0):
    """After a stop burst at about frame k0: the frame where the next word's sound starts
    (voicing onset, or the burst's noise 12 dB down if the voicing never stopped).
    None if there is no burst there (a burst is >= 6 dB of sudden >3 kHz energy standing
    at least `min_hf` dB over the <500 Hz band; a vowel onset is far below that)."""
    H, L = feat.Hs, feat.Ls
    ks = np.arange(max(k0 - 8, 3), min(k0 + 15, len(H) - 3))
    if not len(ks):
        return None
    kb = int(ks[np.argmax(H[ks + 3] - H[ks - 3])])
    if H[kb + 3] - H[kb - 3] < 6.0:
        return None
    pk = kb + int(np.argmax(H[kb:kb + 15]))
    if H[pk] - L[pk] < min_hf:                           # a vowel or voicing onset, not a burst
        return None
    for k in range(pk + 3, min(k_max, len(L) - 4)):
        if L[k + 4] - L[k - 4] >= 8.0:                  # voicing starts: the next word
            return k - 4
    for k in range(pk, min(k_max, len(H))):
        if H[k] <= H[pk] - 12.0:                         # burst has died away
            return k
    return None


def cut_point(feat, last, first, prior, lo, hi, reach=0.03):
    """Boundary in continuous speech between a word ending in phone class `last` and one
    starting with `first`, within `reach` of the HMM boundary, at the acoustic landmark
    of that phone pair (steepest change of the band it moves, then to the edge of that
    change that belongs to the right word):

      next voiceless fricative ("to|share", "Full|stop")  frication onset: rise of >3 kHz
                                                          over <500 Hz, back to where it starts
      previous fricative ("this|incredible", "Let's|build")  frication end: fall of >3 kHz,
                                                          on to where it has died away
      previous stop ("big|lesson")                        after the burst (release_end)
      next stop / nasal / voiced fricative ("We're|just", "for|me")  fall of 0.5-3 kHz,
                                                          on to where it has died away
      previous nasal ("I'm|excited")                      rise of 0.5-3 kHz, on to its top
                                                          (the release transition is the nasal's)
      previous voiced fricative ("is|a")                  steepest rise of 0.5-3 kHz
      fricative|fricative ("Let's|circle"), vowel|vowel   the HMM boundary as it is
    Distance from the HMM boundary costs 0.15 dB per ms; a change under 3 dB is ignored.
    """
    lo, hi = max(lo, prior - reach), min(hi, prior + reach)
    if hi <= lo or (last in 'FZ' and first in 'FZ'):
        return float(prior)
    edge = None
    if first == 'F':
        curve, sign, edge = feat.Hs - feat.Ls, 1, 'rise_start'
    elif last == 'F':
        curve, sign, edge = feat.Hs, -1, 'fall_end'
    elif last == 'P' and first in 'VAN':
        ks = np.arange(max(feat.frame(lo), 3), min(feat.frame(hi) + 1, len(feat.Hs) - 3))
        if len(ks):
            kb = int(ks[np.argmax(feat.Hs[ks + 3] - feat.Hs[ks - 3] - 0.15 * np.abs(ks - prior * 1000))])
            cut = release_end(feat, kb, feat.frame(hi) + 1)
            if cut is not None:
                return feat.time(cut)
        curve, sign = feat.Ms, 1
    elif first in 'PNZ':
        curve, sign, edge = feat.Ms, -1, 'fall_end'
    elif last == 'N':
        curve, sign, edge = feat.Ms, 1, 'rise_end'
    elif last == 'Z':
        curve, sign = feat.Ms, 1
    else:
        return float(prior)
    k = np.arange(max(feat.frame(lo), 4), min(feat.frame(hi) + 1, len(curve) - 4))
    if not len(k):
        return float(prior)
    slope = sign * (curve[k + 4] - curve[k - 4])
    best = int(np.argmax(slope - 0.15 * np.abs(k - prior * 1000)))
    if slope[best] < 3.0:
        return float(prior)
    kk, k_lo, k_hi = int(k[best]), feat.frame(lo), feat.frame(hi)
    # walk to the edge of the change that belongs to the right word: a rise starts where
    # the band is still 20 dB (at most 80% of the rise) under the level it rises to; a fall
    # ends 20 dB down from where it fell from; a nasal release ends 3 dB under its top
    top, bottom = curve[kk:kk + 25].max(), curve[kk:kk + 25].min()
    before_hi, before_lo = curve[max(0, kk - 25):kk + 1].max(), curve[max(0, kk - 25):kk + 1].min()
    if edge == 'rise_start':
        level = top - min(20.0, 0.8 * (top - before_lo))
        while kk > k_lo and curve[kk - 1] > level:
            kk -= 1
    elif edge == 'fall_end':
        level = before_hi - min(20.0, 0.8 * (before_hi - bottom))
        while kk < k_hi and curve[kk] > level:
            kk += 1
    elif edge == 'rise_end':
        while kk < k_hi and curve[kk] < top - 3.0:
            kk += 1
    return feat.time(kk)


def vowel_onset(feat, s, e, vowel=None):
    """Attack of the word's first vowel: the steepest rise of 0.5-3 kHz energy within 25 ms
    of where the HMM puts that vowel (`vowel`). Without an HMM time: the first point within
    10 dB of the word's maximum in that band, searched back up to 40 ms."""
    ka, kb = feat.frame(s), max(feat.frame(e), feat.frame(s) + 2)
    m = feat.Ms
    if vowel is not None:
        lo, hi = max(ka, feat.frame(vowel) - 25), min(kb - 1, feat.frame(vowel) + 25)
        k = np.arange(max(lo, 2), min(hi, len(m) - 3) + 1)
        if len(k):
            rise = m[k + 2] - m[k - 2]
            if rise.max() >= 3.0:
                return feat.time(int(k[np.argmax(rise)]))
        return feat.time(int(np.clip(feat.frame(vowel), ka, kb - 1)))
    seg = m[ka:kb]
    cross = int(np.argmax(seg >= seg.max() - 10.0))
    lo = max(0, cross - 40)
    d = np.diff(seg[lo:cross + 6])
    return feat.time(ka + lo + int(np.argmax(d)) + 1) if len(d) else feat.time(ka)


def f0_median(x, spans):
    fl, hop, out = int(0.04 * SR), int(0.01 * SR), []
    lo_lag, hi_lag = int(SR / 450), int(SR / 70)
    for s, e in spans:
        seg = x[int(s * SR):int(e * SR)]
        for i in range(0, len(seg) - fl, hop):
            fr = seg[i:i + fl] - seg[i:i + fl].mean()
            if np.sqrt(np.mean(fr ** 2)) < 0.02:
                continue
            ac = np.correlate(fr, fr, 'full')[fl - 1:hi_lag + fl]
            energy = np.array([np.sum(fr[:fl - k] ** 2) for k in range(hi_lag + 1)])
            nccf = ac[:hi_lag + 1] / np.sqrt(ac[0] * energy + 1e-12)
            k = lo_lag + int(np.argmax(nccf[lo_lag:hi_lag]))
            if nccf[k] > 0.6:
                out.append(SR / k)
    return float(np.median(out)) if out else 0.0


# ---------------------------------------------------------------- Whisper verification
def norm_words(s):
    s = s.lower().replace('’', "'").replace('-', ' ')
    return [w for w in re.sub(r"[^a-z0-9' ]", ' ', s).split() if w.strip("'")]


ALIKE = {'to': {'too', 'two'}, 'in': {'inn'}, 'for': {'four', 'fore'}, 'read': {'reed'},
         'x': {'ex'}, 'y': {'why'}, 'a': {'uh', 'ah'}, 'i': {'eye', 'aye'}, 'new': {'knew'},
         "i'll": {'aisle', 'isle'}, 'some': {'sum'}, 'what': {'watt'}, 'more': {'moore'}}


def word_matches(expected, heard):
    exp, got = norm_words(expected), norm_words(heard)
    if not got:
        return False
    if got == exp or ''.join(got).replace("'", '') == ''.join(exp).replace("'", ''):
        return True
    return len(exp) == len(got) == 1 and got[0] in ALIKE.get(exp[0], ())


class Verifier:
    def __init__(self, name='small.en'):
        from faster_whisper import WhisperModel
        self.model = WhisperModel(name, device='cpu', compute_type='int8')

    def hear(self, y24):
        y16 = resample_poly(y24, 2, 3).astype(np.float32)
        segs, _ = self.model.transcribe(y16, language='en', beam_size=5, temperature=0.0,
                                        condition_on_previous_text=False, without_timestamps=True,
                                        vad_filter=False)
        return ' '.join(s.text.strip() for s in segs).strip()

    @staticmethod
    def cut(x, s, e, fade=0.010):
        y = x[int(round(s * SR)):int(round(e * SR))].copy()
        n = min(int(fade * SR), len(y) // 2)
        if n:
            ramp = np.linspace(0, 1, n)
            y[:n] *= ramp
            y[-n:] *= ramp[::-1]
        return y

    def check(self, x, words):
        pad, gap = np.zeros(int(0.3 * SR)), np.zeros(int(0.25 * SR))
        full = self.hear(x)
        iso = []
        for w in words:
            heard = self.hear(np.concatenate([pad, self.cut(x, w['start'], w['end']), pad]))
            iso.append((heard, word_matches(w['text'], heard)))
        parts = [pad]
        for w in words:
            parts += [self.cut(x, w['start'], w['end']), gap]
        exploded = self.hear(np.concatenate(parts + [pad]))
        expected = [(t, wi) for wi, w in enumerate(words) for t in norm_words(w['text'])]
        got = norm_words(exploded)
        sm = difflib.SequenceMatcher(a=[t for t, _ in expected], b=got, autojunk=False)
        hit = [False] * len(expected)
        for op, a1, a2, b1, b2 in sm.get_opcodes():
            for k in range(a2 - a1):
                if op == 'equal' or (op == 'replace' and a2 - a1 == b2 - b1
                                     and got[b1 + k] in ALIKE.get(expected[a1 + k][0], ())):
                    hit[a1 + k] = True
        ctx = [all(h for h, (_, o) in zip(hit, expected) if o == wi) for wi in range(len(words))]
        return dict(full=full, full_ok=norm_words(full) == [t for t, _ in expected],
                    exploded=exploded, iso=iso, ctx=ctx)


# ---------------------------------------------------------------- main
def r3(t):
    return round(float(t), 3)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--verify', action='store_true', help='re-transcribe every word slice with Whisper')
    ap.add_argument('--whisper', default='small.en', help='faster-whisper model for --verify')
    ap.add_argument('--only', default='', help='comma list of file numbers, e.g. 06,50 (writes JSON only with an explicit --out)')
    ap.add_argument('--out', default=str(OUT))
    ap.add_argument('--sheet', default='', help='PNG contact sheet of the drop phrases')
    ap.add_argument('--report', default='', help='Markdown verification report')
    ap.add_argument('--debug', default='', help='per-phrase diagnostics JSON')
    args = ap.parse_args()

    texts, warnings = phrase_texts()
    for w in warnings:
        print('text source mismatch:', w, file=sys.stderr)
    only = {f'{int(n):02d}' for n in args.only.split(',') if n.strip()}
    try:
        ctc = CTC()
    except ImportError:
        ctc = None
        print('torchaudio not installed: skipping the CTC cross-check', file=sys.stderr)
    verifier = Verifier(args.whisper) if args.verify else None

    rows, debug = [], []
    for index, text in enumerate(texts):
        stem = f'{index + 1:02d}'
        if only and stem not in only:
            continue
        x = load(PHRASE_DIR / f'{stem}.wav')
        feat = Feat(x)
        toks = spoken_tokens(text)
        x16 = resample_poly(x, 2, 3).astype(np.float32)
        hmm = sphinx_align(x16, toks)
        ctc_words = ctc.align(x16, [l for _, _, l in toks]) if ctc else {}
        aligner = 'pocketsphinx-hmm'
        if hmm is None:                       # HMM failed: CTC spans stand in (no phone classes)
            if not ctc_words:
                sys.exit(f'{stem}.wav: pocketsphinx could not align "{text}" and no CTC fallback')
            base = ctc_words['mms_fa']
            hmm = [dict(start=w['start'], end=w['end'], first='?', last='?', vowel=None, phones='')
                   for w in base]
            aligner = 'ctc-mms_fa'
        starts, ends, kinds = snap(feat, hmm, ctc_words)

        words = []
        for (tok, _, _), s, e in zip(toks, starts, ends):
            onset = vowel_onset(feat, s, e, hmm[len(words)].get('vowel'))
            words.append(dict(text=tok, start=r3(s), end=r3(e), onset=r3(onset)))
        spans = [(w['start'], w['end']) for w in words]
        active = np.concatenate([x[int(s * SR):int(e * SR)] for s, e in spans])
        rms_db = 10 * np.log10(np.mean(active ** 2) + 1e-12)

        # confidence per word: CTC posterior x boundary quality (x Whisper check below).
        # A boundary is good when it is a silence gap, or the acoustic landmark of the
        # phone pair, and when the CTC models put the boundary where the HMM did.
        probs = [float(np.mean([m[i]['prob'] for m in ctc_words.values()])) if ctc_words else 0.8
                 for i in range(len(words))]
        edge, agree = [1.0], []
        for i, kind in enumerate(kinds):
            mine = (words[i]['end'] + words[i + 1]['start']) / 2
            offs = [abs((m[i]['end'] + m[i + 1]['start']) / 2 - mine) for m in ctc_words.values()]
            a = float(np.exp(-np.mean(offs) / 0.05)) if offs else 0.8
            agree.append(round(a, 2))
            landmark = kind == 'gap' or not (kind[-3] in 'FZ' and kind[-1] in 'FZ' or kind[-3:] in ('V|V', 'V|A', 'A|V', 'A|A'))
            edge.append((1.0 if kind == 'gap' else 0.9 if landmark else 0.75) * (0.6 + 0.4 * a))
        edge.append(1.0)
        wconf = [min(1.0, 0.35 + 0.65 * p) * min(edge[i], edge[i + 1]) for i, p in enumerate(probs)]

        row = dict(index=index, file=f'{stem}.wav', text=text, duration=r3(feat.dur),
                   voiced=[words[0]['start'], words[-1]['end']], f0=round(f0_median(x, spans), 1),
                   rmsDb=round(float(rms_db), 2), gainDb=round(float(TARGET_DB - rms_db), 2), words=words,
                   method=aligner + ('+ctc-check(mms_fa,w2v2_base_960h)' if ctc_words else '')
                          + '+snap:' + (','.join(kinds) or 'single'),
                   confidence=0.0)
        dbg = dict(file=row['file'], kinds=kinds, probs=[round(p, 3) for p in probs], agree=agree,
                   floor=round(feat.floor, 1), peak=round(feat.peak, 1),
                   hmm=[(r3(w['start']), r3(w['end']), w['phones']) for w in hmm],
                   ctc={k: [(r3(w['start']), r3(w['end'])) for w in v] for k, v in ctc_words.items()})
        if verifier:
            v = verifier.check(x, words)
            factor = []
            for w, (heard, ok), cok in zip(words, v['iso'], v['ctx']):
                w['check'] = 'isolated' if ok else ('context' if cok else 'fail')
                factor.append(1.0 if ok else (0.85 if cok else 0.4))
            wconf = [c * f for c, f in zip(wconf, factor)]
            dbg.update(full=v['full'], full_ok=v['full_ok'], exploded=v['exploded'], heard=[h for h, _ in v['iso']])
        row['confidence'] = round(float(min(wconf)), 2)
        rows.append(row)
        debug.append(dbg)
        flag = lambda w: '' if w.get('check', 'isolated') == 'isolated' else ' ' + w['check'].upper()
        print(f'{stem} conf {row["confidence"]:.2f} ' +
              ' '.join(f"{w['text']}[{w['start']:.3f}-{w['end']:.3f}{flag(w)}]" for w in words), flush=True)

    validate(rows)
    if not only or args.out != str(OUT):        # a partial run never overwrites the real file
        Path(args.out).write_text(json.dumps(rows, indent=1, ensure_ascii=False) + '\n')
        print(f'wrote {args.out} ({len(rows)} phrases, {sum(len(r["words"]) for r in rows)} words)')
    if args.debug:
        Path(args.debug).write_text(json.dumps(debug, indent=1, ensure_ascii=False))
    if args.sheet:
        contact_sheet(rows, args.sheet)
    if args.report:
        report(rows, debug, warnings, args.report)


def validate(rows):
    for r in rows:
        prev = 0.0
        for w in r['words']:
            assert prev <= w['start'] < w['end'] <= r['duration'], (r['file'], w)
            assert w['start'] <= w['onset'] < w['end'], (r['file'], w)
            prev = w['end']


# ---------------------------------------------------------------- outputs
def contact_sheet(rows, path, files=DROP_FILES):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    surface, ink, ink2, grid = '#fcfcfb', '#0b0b0b', '#52514e', '#d9d8d4'
    series = ['#2a78d6', '#eb6834']
    picked = [r for f in files for r in rows if r['file'] == f'{f}.wav']
    if not picked:
        return
    cols = 3
    fig, axs = plt.subplots(-(-len(picked) // cols), cols, figsize=(18, 3.7 * -(-len(picked) // cols)),
                            facecolor=surface, squeeze=False)
    for ax in axs.ravel()[len(picked):]:
        ax.set_visible(False)
    for ax, r in zip(axs.ravel(), picked):
        x = load(PHRASE_DIR / r['file'])
        feat = Feat(x)
        ax.set_facecolor(surface)
        ax.plot(np.arange(len(x)) / SR, x, color='#8a8984', lw=0.35)
        ax.plot(np.arange(len(feat.E)) / 1000, 10 ** (feat.E / 20) * 1.414, color=ink2, lw=0.8)
        ax.set_xlim(0, feat.dur)
        ax.set_ylim(-1.05, 1.3)
        for i, w in enumerate(r['words']):
            c = series[i % 2]
            ax.axvspan(w['start'], w['end'], ymin=0.02, ymax=0.82, color=c, alpha=0.13, lw=0)
            ax.axvline(w['start'], color=c, lw=1.4, ymax=0.82)
            ax.axvline(w['end'], color=c, lw=1.4, ymax=0.82, ls=(0, (3, 2)))
            ax.plot([w['onset']], [-0.95], marker='^', color=c, ms=8, mec=surface, mew=1)
            mid = (w['start'] + w['end']) / 2
            ax.text(mid, 1.17, w['text'], ha='center', va='center', fontsize=10.5, color=ink, fontweight='bold')
            ax.text(mid, 0.97 - 0.12 * (i % 2), f"{w['start']:.3f}–{w['end']:.3f}", ha='center', va='center',
                    fontsize=7.5, color=ink2)
        title = ''.join(ch for ch in r['text'] if ord(ch) < 0x2190 or ch in '—…')
        ax.set_title(f"{r['file']}  “{title.strip()}”   conf {r['confidence']:.2f}", loc='left', fontsize=11, color=ink)
        ax.set_xticks(np.arange(0, feat.dur + 1e-9, 0.1))
        ax.set_xticks(np.arange(0, feat.dur + 1e-9, 0.02), minor=True)
        ax.tick_params(colors=ink2, labelsize=8)
        ax.set_yticks([])
        ax.grid(True, axis='x', which='major', color=grid, lw=0.6)
        for s in ax.spines.values():
            s.set_color(grid)
    fig.suptitle('Lady phrases: word boundaries (solid = start, dashed = end, ▲ = vowel onset). '
                 'Dark line = 8 ms RMS envelope; seconds on x.', x=0.01, ha='left', fontsize=12, color=ink)
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    fig.savefig(path, dpi=90, facecolor=surface)
    plt.close(fig)


def report(rows, debug, warnings, path):
    words = [(r, w) for r in rows for w in r['words']]
    n = len(words)
    iso = sum(1 for _, w in words if w.get('check') == 'isolated')
    ctx = sum(1 for _, w in words if w.get('check') == 'context')
    fail = sum(1 for _, w in words if w.get('check') == 'fail')
    dbg = {d['file']: d for d in debug}
    full_bad = [d for d in debug if 'full_ok' in d and not d['full_ok']]
    lines = ['# Lady phrase alignment: verification', '',
             f'{len(rows)} phrases, {n} words. Whisper small.en on each cut word (10 ms fades): '
             f'{iso} heard correctly alone ({100 * iso / max(n, 1):.1f}%), {ctx} more only inside the '
             f'exploded phrase, {fail} not at all.', '',
             f'Full recordings transcribed word for word as the text: {len(debug) - len(full_bad)}/{len(debug)}.', '']
    if full_bad:
        lines += ['| file | Whisper heard |', '|---|---|'] + [f"| {d['file']} | {d['full']} |" for d in full_bad] + ['']
    if warnings:
        lines += ['## Text source mismatches', ''] + [f'- {w}' for w in warnings] + ['']
    lines += ['## Words not heard correctly in isolation', '',
              '| file | word | check | span (s) | heard alone | exploded phrase heard |', '|---|---|---|---|---|---|']
    for r, w in words:
        if w.get('check') not in (None, 'isolated'):
            d = dbg[r['file']]
            heard = d['heard'][r['words'].index(w)]
            lines.append(f"| {r['file']} | {w['text']} | {w['check']} | {w['start']:.3f}–{w['end']:.3f} | "
                         f"{heard or '(nothing)'} | {d['exploded']} |")
    lines += ['', '## Drop slices', '', '| file | word | start | onset | end | check |', '|---|---|---|---|---|---|']
    for f in DROP_FILES:
        for r in rows:
            if r['file'] == f'{f}.wav':
                lines += [f"| {r['file']} | {w['text']} | {w['start']:.3f} | {w['onset']:.3f} | {w['end']:.3f} | "
                          f"{w.get('check', '-')} |" for w in r['words']]
    lines += ['', '## All phrases', '', '| file | conf | boundaries | words (start–end) |', '|---|---|---|---|']
    for r in rows:
        ws = ' · '.join(f"{w['text']} {w['start']:.3f}–{w['end']:.3f}" for w in r['words'])
        lines.append(f"| {r['file']} | {r['confidence']:.2f} | {r['method'].split('+snap:')[1]} | {ws} |")
    Path(path).write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
