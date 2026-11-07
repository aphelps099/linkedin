"""Review a render of the printer's music video (docs/printer-song-video.md): the numbers a reviewer
needs before anyone watches it.

    python3 scripts/review-printer-video.py ~/Desktop/printer-song-9x16.mp4 [--first-frame 0] [--frames DIR]

  1. The file: codecs, pixel format, size, frame rate, frame count, both durations, A/V start times.
  2. Flashes (the governor's rule, measured on the decoded picture, not predicted): relative luminance
     (sRGB linearised, Rec. 709) of the whole frame, of each quadrant and of each row of the face (the
     eyes, the mouth, the board, the tray: a tile's own flicker, which a quadrant halves); a flash is a
     pair of opposing changes of 10 % or more where the darker side is under 0.8 (pegboard/governor.js
     flashes); at most 3 in any one second. Prints the worst second of each series and where it is.
  3. Black frames (whole-frame relative luminance under 0.01; in the dark intro, nothing lit after its 3 frames of
     power-on), decode errors, and green in the board home (the whole frame through the intro).
  4. The sound against its source (assets/printer-song/printer-song-film.flac, cut to the same span):
     the offset by cross-correlation (ms), true peak and integrated loudness of the file.
  5. Sync: at each cue of the cue sheet inside the file, the frame where the picture does it in the cue's
     region (within 3 frames: a cut, or the mouth's page furthest out or back in) and the strongest audio
     onset near it (spectral flux, within 2 frames). The intro's cues (LOADING. on Synergy's word, the word going
     as the board starts to fold into its home, the face on the song's first frame) are checked like the song's.

Frames are film frames: the 3 s intro is frames 0-71, and song frame n (the cut's, printer-mouth.js) is film
frame n + 72. --first-frame: the film frame the file starts on (an export of --span 428-572 starts on 428; read from
the sidecar JSON next to the file when there is one). --frames DIR also writes every cue's frames f-1,
f and f+1 as PNGs. Needs numpy and ffmpeg/ffprobe on the PATH. Exit status 1 when a gate fails.
"""
import argparse, json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'assets', 'printer-song', 'printer-song-film.flac')
INTRO = 72                                    # film frame = song frame + INTRO
FPS, W, H = 24, 135, 240                      # the picture is analysed at 135×240 (area-averaged)
# 9:16 regions as fractions of the frame (layouts.js stack3 and the home)
REGION = {'eyes':(.006, .283), 'mouth':(.289, .566), 'board':(.572, .750), 'tray':(.756, .994), 'frame':(0, 1), 'intro':(.3, .7)}
# The cue sheet (song frames; + INTRO for the file's): what happens, where, and how it shows. 'cut': the first frame within 2
# of the cue where the region changes by 20 % or more of the biggest change there (and twice its median: the looks
# move all the time). 'signal': the first frame where the region's signal-yellow pixels jump (the strike; a new word
# pops white-hot before it shows its colour, so words are 'cut').
# 'peak' / 'trough': the mouth at a glide's vertex (the page furthest out / swallowed); the
# picture can't place those to the frame (the page's brightness is not its position: the logo darkens it
# as it comes out), so they are listed for the eye (--frames) and not gated; check-videostudio section 16
# proves them on the program. treatments/printer-mouth.js, printer-song.js LINES.
# The intro (song frames -72 to -1): LOADING. lights on Synergy's word (film f12, his onset at 0.500 s); the board
# starts to fold into its home on film f65; the face appears on film f72 (song f0), where the sound turns round.
CUES = [(-60, 'intro', 'cut', 'LOADING. (Synergy: Loading.)'), (-7, 'intro', 'cut', 'loaded: the board folds home'), (0, 'frame', 'cut', 'the face (song f0)'),
        (47, 'board', 'cut', 'READY.'), (47, 'eyes', 'cut', 'eyes open'), (93, 'mouth', 'peak', 'g3 peak (3.893 s)'), (99, 'mouth', 'trough', 'g3 trough (4.137 s)'),
        (150, 'board', 'cut', 'THRILLED'), (152, 'mouth', 'peak', 'g4 peak (6.367 s)'), (158, 'board', 'cut', 'TO'), (158, 'mouth', 'trough', 'g4 trough (6.587 s)'),
        (161, 'board', 'cut', 'PRINT.'), (161, 'mouth', 'peak', 'g4 spit (6.716 s)'), (260, 'eyes', 'cut', 'second mouth'), (262, 'board', 'cut', 'PAGE'),
        (323, 'frame', 'cut', 'cut to the whole printer'), (331, 'frame', 'cut', 'BLEED. edge to edge, 2x2'), (337, 'frame', 'cut', 'tile 3x3'), (348, 'frame', 'cut', 'cut back to the face'),
        (404, 'board', 'cut', 'TONER'), (404, 'eyes', 'cut', 'wink'), (427, 'mouth', 'trough', 'swallowed'), (428, 'board', 'cut', 'OUT (B lands)'),
        (428, 'eyes', 'cut', 'asleep'), (477, 'eyes', 'cut', 'eyes open (b1)'), (477, 'board', 'signal', 'strike'), (494, 'board', 'cut', 'STILL (its own screen)'),
        (710, 'mouth', 'trough', 'swallowed'), (714, 'board', 'cut', 'PAPER JAM.'), (714, 'eyes', 'cut', 'the long bar')]

def run(cmd, **kw): return subprocess.run(cmd, check=True, capture_output=True, **kw)

def probe(path):
    out = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout)
    return out['streams'], out['format']

def decode_picture(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    x = np.frombuffer(p.stdout, np.uint8)
    return x.reshape(-1, H, W, 3), p.stderr.decode(errors='replace').strip()

def rel_luminance(rgb):
    c = rgb.astype(np.float32) / 255
    c = np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    return c[..., 0] * .2126 + c[..., 1] * .7152 + c[..., 2] * .0722

def flash_events(s):
    # pegboard/governor.js flashes(): transitions of >= 10 % with the darker side under .8; a ramp is followed.
    ev, ref, d0 = [], s[0], 0
    for f in range(1, len(s)):
        v = s[f]; d = v - ref
        if abs(d) >= .1 and min(v, ref) < .8:
            sg = 1 if d > 0 else -1
            if sg != d0: ev.append(f); d0 = sg
            ref = v
        elif d0 and np.sign(v - ref) == d0: ref = v
    return ev

def worst_second(ev):
    worst, at = 0, None
    for i in range(len(ev)):
        j = i
        while j < len(ev) and ev[j] - ev[i] < FPS: j += 1
        if (j - i) / 2 > worst: worst, at = (j - i) / 2, ev[i]
    return worst, at

def decode_audio(path, rate=48000, extra=()):
    p = run(['ffmpeg', '-v', 'error', '-i', path, *extra, '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'])
    return np.frombuffer(p.stdout, np.float32)

def flux(x, rate=48000, hop=240, n=1024):
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n, n)), n)[::hop] * np.hanning(n)
    m = np.log1p(1000 * np.abs(np.fft.rfft(frames, axis=1)))
    f = np.r_[0, np.maximum(np.diff(m, axis=0), 0).sum(1)]
    t = (np.arange(len(f)) * hop - n + n / 2) / rate
    return t, f

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file'); ap.add_argument('--first-frame', type=int, default=None); ap.add_argument('--frames')
    a = ap.parse_args()
    fails = []
    side = os.path.splitext(a.file)[0] + '.json'
    first = a.first_frame if a.first_frame is not None else (json.load(open(side))['film']['span'][0] if os.path.exists(side) else 0)
    streams, fmt = probe(a.file)
    v = next(s for s in streams if s['codec_type'] == 'video'); au = next((s for s in streams if s['codec_type'] == 'audio'), None)
    print('1. the file')
    print(f"   video {v['codec_name']} {v.get('profile')} {v['pix_fmt']} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('nb_frames')} frames, {float(v['duration']):.3f} s, starts {v.get('start_time')}")
    if au: print(f"   audio {au['codec_name']} {au.get('profile')} {au['sample_rate']} Hz {au['channels']} ch {int(au.get('bit_rate', 0)) // 1000} kb/s, {float(au['duration']):.3f} s, starts {au.get('start_time')}")
    else: fails.append('no audio stream')
    print(f"   container {fmt['format_name']} {float(fmt['duration']):.3f} s; film frames {first}-{first + int(v.get('nb_frames', 0)) - 1}")
    if v['pix_fmt'] != 'yuv420p': fails.append(f"pixel format {v['pix_fmt']}, not yuv420p")
    if v['r_frame_rate'] != '24/1': fails.append(f"frame rate {v['r_frame_rate']}")
    if au and abs(float(au['duration']) - float(v['duration'])) > 1 / FPS: fails.append('audio and video durations differ by more than a frame')

    pics, err = decode_picture(a.file)
    L = rel_luminance(pics)
    n = len(L)
    print(f'\n2. flashes (decoded picture, {n} frames; at most 3 a second)')
    series = {'whole':L.mean((1, 2)), 'top-left':L[:, :H // 2, :W // 2].mean((1, 2)), 'top-right':L[:, :H // 2, W // 2:].mean((1, 2)),
              'bottom-left':L[:, H // 2:, :W // 2].mean((1, 2)), 'bottom-right':L[:, H // 2:, W // 2:].mean((1, 2))}
    # Each row of the face (stack3: eyes, mouth, the board, the tray), gated the same way.
    for k in ('eyes', 'mouth', 'board', 'tray'):
        y0, y1 = (int(r * H) for r in REGION[k]); series[f'row {k}'] = L[:, y0:y1].mean((1, 2))
    for k, s in series.items():
        ev = flash_events(s); w, at = worst_second(ev)
        print(f"   {k:12s} {len(ev) / 2:4.1f} flashes in all, worst second {w:.1f}{'' if at is None else f' from film frame {first + at}'}; luminance {s.min():.3f}-{s.max():.3f}")
        if w > 3: fails.append(f'{k}: {w} flashes in one second')

    print('\n3. black frames and decode errors')
    # Black: the whole frame under 0.01. The intro is a dark screen by design (pegs on black): there a frame is black
    # only when nothing on it is lit (its brightest pixel under 40/255), and its first 3 frames are the board powering on.
    peak = pics.max((1, 2, 3))
    black = [first + i for i in range(n) if (series['whole'][i] < .01 and first + i >= INTRO) or (first + i < INTRO and first + i >= 3 and peak[i] < 40)]
    print(f"   black frames: {black if black else 'none'}; decoder: {err if err else 'no errors'}")
    if black: fails.append(f'{len(black)} black frames')
    # No green type: the board home's pixels (the words and the looks) never read green. (The call's
    # speaking border and mic dots are green by design: chrome, in the mouth's tile, not here.)
    # (Through the intro the board is the whole frame, so the whole frame is checked there.)
    y0, y1 = (int(r * H) for r in REGION['board'])
    def greens(a):
        a = a.astype(np.int16)
        return ((a[..., 1] > 90) & (a[..., 1] > a[..., 0] + 40) & (a[..., 1] > a[..., 2] + 40)).sum((1, 2))
    gcount = greens(pics[:, y0 + 1:y1 - 1])
    k = max(0, min(n, INTRO - first))
    if k: gcount[:k] = greens(pics[:k])
    gf = [first + i for i in np.nonzero(gcount > 3)[0]]
    print(f"   green in the board: {'none' if not gf else f'{len(gf)} frames from film frame {gf[0]}'}")
    if gf: fails.append(f'green in the board on {len(gf)} frames')
    if err: fails.append('decode errors')

    print('\n4. the sound')
    if au and os.path.exists(SOURCE):
        x = decode_audio(a.file)
        t0, t1 = first / FPS, first / FPS + len(x) / 48000
        y = decode_audio(SOURCE, extra=('-af', f'atrim=start={t0}:end={t1}'))
        m = min(len(x), len(y)); seg = slice(0, m)
        X, Y = np.fft.rfft(x[seg], 2 * m), np.fft.rfft(y[seg], 2 * m)
        cc = np.fft.irfft(X * np.conj(Y)); lag = int(np.argmax(np.r_[cc[-480:], cc[:481]])) - 480
        print(f'   offset of the file against its source: {lag / 48:.2f} ms (positive: the file is late)')
        if abs(lag) > 48: fails.append(f'audio offset {lag / 48:.2f} ms')
        p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', a.file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
        summ = p[p.rfind('Summary:'):]
        I = next((l.split()[1] for l in summ.splitlines() if l.strip().startswith('I:')), '?'); TP = next((l.split()[1] for l in summ.splitlines() if l.strip().startswith('Peak:')), '?')
        print(f'   integrated {I} LUFS, true peak {TP} dBTP')
        try:
            if float(TP) > 0: fails.append(f'true peak {TP} dBTP: clipping')
        except ValueError: pass
        tf, fl = flux(x)
    else: tf = fl = None; print('   (no audio, or the source FLAC is missing: skipped)')

    print('\n5. sync: cue frame / where the picture does it / the strongest audio onset within 2 frames')
    D = np.abs(np.diff(pics.astype(np.int16), axis=0)).mean(3)          # frame f+1 vs f, per pixel
    want = set()
    for sfr, region, how, label in CUES:
        f = sfr + INTRO
        i = f - first
        if not (1 <= i < n - 1): continue
        y0, y1 = (int(r * H) for r in REGION[region])
        lo, hi = max(1, i - 3), min(n - 1, i + 3)
        if how in ('cut', 'signal'):
            if how == 'cut': ch = np.array([D[k - 1, y0:y1].mean() for k in range(lo, hi + 1)])
            else:
                sig = lambda k: int(((pics[k, y0:y1, :, 0] > 190) & (pics[k, y0:y1, :, 1] > 160) & (pics[k, y0:y1, :, 2] < 140)).sum())
                ch = np.array([max(0, sig(k) - sig(k - 1)) for k in range(lo, hi + 1)], float)
            # (Within 2 frames: a bigger event 3 frames on, PRINT. after TO, must not hide this one.)
            near = slice(max(0, i - 2 - lo), i + 3 - lo)
            c2 = ch[near]
            # (A strike draws left to right over a 16th: its first pegs count; nothing else in the board is yellow.)
            hit = np.nonzero(c2 >= max(3, .1 * c2.max()))[0] if how == 'signal' else np.nonzero((c2 >= .2 * c2.max()) & (c2 >= 2 * np.median(c2)) & (c2 > 0))[0]
            pf = lo + near.start + int(hit[0] if len(hit) else np.argmax(c2))
        else: pf = lo + int(np.argmax([(1 if how == 'peak' else -1) * L[k, y0:y1].mean() for k in range(lo, hi + 1)]))
        onset = ''
        if tf is not None:
            sel = (tf >= (i - 2) / FPS) & (tf < (i + 3) / FPS)
            if sel.any():
                k = np.argmax(np.where(sel, fl, -1)); ot = tf[k]
                onset = f'onset {first / FPS + ot:6.3f} s (frame {first + int(np.floor(ot * FPS))}, flux {fl[k] / np.median(fl):.1f}x median)'
        gated = how in ('cut', 'signal')
        mark = ('ok' if pf == i else f'{pf - i:+d}') if gated else 'eye'
        if gated and pf != i: fails.append(f'f{f} {label}: the picture changes on f{first + pf}')
        print(f'   f{f:<4d} {region:6s} {label:26s} picture f{first + pf:<4d} {mark:3s} {onset}')
        if a.frames: want.update((i - 1, i, i + 1))
    if a.frames and want:
        # Every cue's f-1, f and f+1 in one pass, named by film frame.
        os.makedirs(a.frames, exist_ok=True)
        ks = sorted(want); tmp = os.path.join(a.frames, '_%04d.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.file, '-vf', 'select=' + '+'.join(f'eq(n\\,{k})' for k in ks), '-fps_mode', 'passthrough', tmp], check=True)
        for j, k in enumerate(ks): os.replace(tmp % (j + 1), os.path.join(a.frames, f'f{first + k:03d}.png'))
        print(f'\n   {len(ks)} cue frames written to {a.frames}')
    print('\n' + ('PASS' if not fails else 'FAIL: ' + '; '.join(fails)))
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
