"""Review a render of the Delve. film (docs/vocabulary-film.md): the numbers a reviewer needs before anyone
watches it.

    python3 scripts/review-delve-video.py ~/Desktop/delve-9x16.mp4 [--first-frame 0] [--frames DIR]

  1. The file: codecs, pixel format, size, frame rate, frame count, both durations.
  2. Flashes (the governor's rule, measured on the decoded picture, not predicted): relative luminance
     (sRGB linearised, Rec. 709) of the whole frame, of each quadrant and of each band of the board (the
     header of stars, the words, the mouth, the floor); a flash is a pair of opposing changes of 10 % or more
     where the darker side is under 0.8 (pegboard/governor.js flashes); at most 3 in any one second.
  3. The loop seam and black: f2880 to f2894 true black (nothing over 24/255); no frame before it black (nothing
     lit over 60/255) after the sockets power up (f0-f2) and before the last star shrinks out (the last second); decode errors.
  4. Green: no peg reads green anywhere in the frame (type is never green; nothing in the palette is).
  5. The sound against its source (assets/delve/delve-song.flac, song time 0 at 0.05 s in, cut to the same
     span): the offset by cross-correlation (ms), integrated loudness and true peak of the file. The true peak of
     the decoded file must be at or under -1.0 dBTP (the master's spot gain keeps AAC there: scripts/master-delve.py).
  6. Sync, read from the pegs themselves (the board is 90 x 160 pegs at every scale; each peg's centre pixel):
     - her words: the white pegs in the words' band, frame by frame, against the program's own white light there
       (the board as the compositor paints it: type, figures, textures): the best lag must be 0; and each of the
       47 words brings new white pegs on the frame that holds her voice saying it (anchors.js hitFrame);
     - her mouth: the opening at the mouth's centre, peg rows between the lips, frame by frame against the
       program's own (lips.js sprites of the shape keyed on that frame): the best lag must be 0;
     - her mouth against her own sound, not the program: on P1 and P10, where she is alone in the mix, the mouth's
       opening against the decoded sound's 300-3000 Hz envelope; the best lag must be 0 or -1 (it never lags);
     - the kiss on f1425 (the round pucker) and the first star over her lips at f1440 (row 32, column 42).
  7. The picture against the song (a whole film only): the frame's mean light per second against the sound's
     short-term loudness (its source's, ebur128), r at least .5; the brightest two seconds inside the canon
     (98-107 s); the Pool (60-70 s) and the slowed "sink in" (71.25-77.5 s) at most .85 of the canon (100-106 s);
     the textures in the side margins at the swells' tops at least 1.5x the stream (bars 5-12); the frame's
     brightening repeating a beat later (15 frames) over 85-107 s, autocorrelation at least .5.

The plan, the words' frames and the program's mouth come from the repo (node: the song's plan, the delve-board
treatment, compile). --first-frame: the film frame the file starts on (an export of --span 1320-1500 starts on
1320; read from the sidecar JSON next to the file when there is one). --frames DIR writes f-1, f and f+1 of
the key moments as PNGs. Needs numpy, node, ffmpeg and ffprobe on the PATH. Exit status 1 when a gate fails.
"""
import argparse, json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'assets', 'delve', 'delve-song.flac')
OFFSET = .05                                  # song time 0 in the file (the engine's RENDER_OFFSET)
FPS, COLS, ROWS, BLACK_FROM, FRAMES = 24, 90, 160, 2880, 2895
BANDS = {'header':(0, 26), 'words':(26, 85), 'mouth':(76, 120), 'floor':(120, 160)}
LIPS_COL = 42
KEY = [(8, 'the mouth draws itself'), (15, 'DELVE. lit'), (125, 'a fifth down'), (240, 'the echo gone'), (1320, 'the body arrives'), (1425, 'the kiss'), (1440, 'the middle: A RICH, star 1'),
       (1712, 'SINK IN.'), (2038, 'OF... frozen'), (2460, 'the ring of eight'), (2640, 'the ring closed'), (2769, 'AGAIN.'), (2879, 'last lit frame'), (2880, 'the seam')]

NODE = r"""
const ROOT = process.argv[1];
const {RECORDED, treatmentFor} = await import(`${ROOT}/src/videostudio/treatments/index.js`);
const {compile} = await import(`${ROOT}/src/videostudio/edl/compile.js`);
const {hitFrame} = await import(`${ROOT}/src/videostudio/edl/anchors.js`);
const {decode, lipsSprite, HERO} = await import(`${ROOT}/src/pegboard/lips.js`);
const {paint} = await import(`${ROOT}/src/pegboard/choreo.js`);
const {SAFE} = await import(`${ROOT}/src/videostudio/layouts.js`);
const {boardGrid, safeSpan} = await import(`${ROOT}/src/videostudio/gl/board-layer.js`);
const {boardScreens, boardTimeOf} = await import(`${ROOT}/src/videostudio/gl/compositor.js`);
const {paintPsych, isFigure} = await import(`${ROOT}/src/pegboard/psych.js`);
const plan = RECORDED.delve.plan(), edl = treatmentFor('delve').fn(plan, {}, {format:'9:16'}), p = compile(edl, {plan, shots:{}, format:'9:16'});
// The board's white light in the words' band (rows 26-88, columns 9-80) as the program paints it, frame by
// frame (board-layer.js: the type, then the figures, then the textures): pegs in white (or mixed half to white)
// at half light or more, the light the decoded picture shows as white.
const screens = boardScreens(p.board.screens), grid = boardGrid(1080, 1920, 12, safeSpan({x:0, y:0, w:1080, h:1920}, SAFE['9:16'])), type = [];
const LUMA = [.32, .95, .86, .2];
for (let f = 0; f < p.frames; f++) {
  const fr = p.frame(f), b = grid.board;
  paint(b, screens, boardTimeOf(fr), {plan, layoutOf:grid.layoutOf, place:grid.place, pitch:12});
  const ps = fr.board.rect ? fr.board.psych || [] : [];
  for (const x of [...ps.filter(q => isFigure(q.look)), ...ps.filter(q => !isFigure(q.look))]) paintPsych(b, x, x.time, {drive:x.drive});
  let n = 0;
  if (fr.board.rect) for (let y = 26; y < 89; y++) for (let x = 9; x < 81; x++) { const i = y * 90 + x, t = b.tone[i], w = b.white[i]; if ((t === 1 || w >= .5) && Math.min(1.6, b.I[i]) * (LUMA[t] + (1 - LUMA[t]) * w) * b.exposure >= .5) n++; }
  type.push(n);
}
const words = plan.band.flatMap(e => e.words.map((w, k) => ({id:e.id, k, text:w.display ?? w.text, f:hitFrame(w.start, plan)})));
// The opening at the mouth's centre (columns -1..1 of the sprite): rows with no peg between the lips' outer edges.
// (The outline alone, before bar 22: only its outline pegs; then the whole lips.)
const gapOf = (s, outline) => { let g = 0; for (const x of [-1, 0, 1]) { const ys = s.pegs.filter(q => q.x === x && (!outline || q.kind === 'outline')).map(q => q.y); if (!ys.length) continue; const set = new Set(ys); let n = 0; for (let y = Math.min(...ys); y <= Math.max(...ys); y++) if (!set.has(y)) n++; g += n; } return g / 3; };
const mouth = [];
for (let f = 0; f < p.frames; f++) {
  const x = p.frame(f).board.psych?.find(q => q.look === 'lips'), c = x ? decode(Math.round(x.params.mouth)) : null, P = x?.params;
  mouth.push(c && P.hero > .99 && P.draw >= 1 && (P.fill >= 1 || P.fill <= 0) && !(P.ring > 0) && !(P.mid >= .5) && !(P.trace > 0 && P.trace < 1) ? [c.shape, c.open, gapOf(lipsSprite(c.shape, c.open, HERO), P.fill <= 0)] : null);
}
const phrases = plan.band.map(e => ({id:e.id, a:hitFrame(e.words[0].start, plan), b:hitFrame(e.end, plan)}));
console.log(JSON.stringify({frames:p.frames, words, mouth, type, phrases, slow:plan.slow[0]}));
"""

def run(cmd, **kw): return subprocess.run(cmd, check=True, capture_output=True, **kw)

def probe(path):
    out = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout)
    return out['streams'], out['format']

def lin(c):
    c = c.astype(np.float32) / 255
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)

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
    return np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', path, *extra, '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-']).stdout, np.float32)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file'); ap.add_argument('--first-frame', type=int, default=None); ap.add_argument('--frames')
    a = ap.parse_args()
    fails, notes = [], []
    side = os.path.splitext(a.file)[0] + '.json'
    first = a.first_frame if a.first_frame is not None else (json.load(open(side))['film']['span'][0] if os.path.exists(side) else 0)
    streams, fmt = probe(a.file)
    v = next(s for s in streams if s['codec_type'] == 'video'); au = next((s for s in streams if s['codec_type'] == 'audio'), None)
    W, H = int(v['width']), int(v['height']); P = W / COLS
    print('1. the file')
    print(f"   video {v['codec_name']} {v.get('profile')} {v['pix_fmt']} {W}x{H} {v['r_frame_rate']} {v.get('nb_frames')} frames, {float(v['duration']):.3f} s")
    if au: print(f"   audio {au['codec_name']} {au.get('profile')} {au['sample_rate']} Hz {au['channels']} ch {int(au.get('bit_rate', 0)) // 1000} kb/s, {float(au['duration']):.3f} s")
    else: fails.append('no audio stream')
    if v['pix_fmt'] != 'yuv420p': fails.append(f"pixel format {v['pix_fmt']}")
    if v['r_frame_rate'] != '24/1': fails.append(f"frame rate {v['r_frame_rate']}")
    if abs(W * 16 - H * 9) > 16 or abs(P - round(P)) > 1e-6: fails.append(f'{W}x{H} is not a 9:16 frame of whole 90 x 160 pegs')
    if au and abs(float(au['duration']) - float(v['duration'])) > 1 / FPS: fails.append('audio and video durations differ by more than a frame')

    # One pass over the decoded picture: per peg, the mean relative luminance of its cell and its centre pixel's colour.
    p = int(round(P)); cy = (np.arange(ROWS) * p + p // 2); cx = (np.arange(COLS) * p + p // 2)
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', a.file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    lum, centre = [], []
    size = W * H * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size: break
        fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        L = lin(fr) @ np.array([.2126, .7152, .0722], np.float32)
        lum.append(L[:ROWS * p, :COLS * p].reshape(ROWS, p, COLS, p).mean((1, 3)))
        centre.append(fr[cy][:, cx])
    err = proc.stderr.read().decode(errors='replace').strip(); proc.wait()
    lum = np.array(lum); centre = np.array(centre); n = len(lum)
    print(f"   film frames {first}-{first + n - 1} ({n} decoded); peg {p} px")

    print(f'\n2. flashes (decoded picture; at most 3 a second)')
    series = {'whole':lum.mean((1, 2)), 'top-left':lum[:, :80, :45].mean((1, 2)), 'top-right':lum[:, :80, 45:].mean((1, 2)),
              'bottom-left':lum[:, 80:, :45].mean((1, 2)), 'bottom-right':lum[:, 80:, 45:].mean((1, 2))}
    for k, (r0, r1) in BANDS.items(): series[f'band {k}'] = lum[:, r0:r1].mean((1, 2))
    for k, s in series.items():
        ev = flash_events(s); w, at = worst_second(ev)
        print(f"   {k:13s} {len(ev) / 2:4.1f} flashes in all, worst second {w:.1f}{'' if at is None else f' from f{first + at}'}; luminance {s.min():.4f}-{s.max():.4f}")
        if w > 3: fails.append(f'{k}: {w} flashes in one second')

    print('\n3. the loop seam, black frames, decode errors')
    peak = centre.max((1, 2, 3))
    seam = [first + i for i in range(n) if first + i >= BLACK_FROM]
    lit_seam = [f for f in seam if peak[f - first] > 24]
    black = [first + i for i in range(n) if 3 <= first + i < BLACK_FROM - FPS and peak[i] < 60]
    print(f"   seam frames f{BLACK_FROM}-f{FRAMES - 1} in this file: {len(seam)}, lit: {lit_seam or 'none'}; black frames before the seam: {black or 'none'}; decoder: {err or 'no errors'}")
    if lit_seam: fails.append(f'{len(lit_seam)} seam frames not black')
    if black: fails.append(f'{len(black)} black frames before the seam')
    if err: fails.append('decode errors')

    print('\n4. green')
    c = centre.astype(np.int16)
    green = ((c[..., 1] > 90) & (c[..., 1] > c[..., 0] + 40) & (c[..., 1] > c[..., 2] + 40)).sum((1, 2))
    gf = [first + i for i in np.nonzero(green > 0)[0]]
    print(f"   green pegs: {'none' if not gf else f'{int(green.sum())} on {len(gf)} frames from f{gf[0]}'}")
    if gf: fails.append(f'green pegs on {len(gf)} frames')

    print('\n5. the sound')
    if au and os.path.exists(SOURCE):
        x = decode_audio(a.file)
        t0 = first / FPS + OFFSET
        y = decode_audio(SOURCE, extra=('-af', f'atrim=start={t0}:end={t0 + len(x) / 48000}'))
        m = min(len(x), len(y), 48000 * 30)
        X, Y = np.fft.rfft(x[:m], 2 * m), np.fft.rfft(y[:m], 2 * m)
        cc = np.fft.irfft(X * np.conj(Y)); lag = int(np.argmax(np.r_[cc[-480:], cc[:481]])) - 480
        print(f'   offset of the file against its source: {lag / 48:.2f} ms (positive: the file is late)')
        if abs(lag) > 48: fails.append(f'audio offset {lag / 48:.2f} ms')
        q = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', a.file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
        summ = q[q.rfind('Summary:'):]
        I = next((l.split()[1] for l in summ.splitlines() if l.strip().startswith('I:')), '?'); TP = next((l.split()[1] for l in summ.splitlines() if l.strip().startswith('Peak:')), '?')
        print(f'   integrated {I} LUFS, true peak {TP} dBTP (the master: -10.4 LUFS, -1.5 dBTP; AAC adds up to a dB on a few transients: at most -1.0)')
        try:
            if float(TP) > -1.0: fails.append(f'true peak {TP} dBTP: over the -1 dBTP ceiling')
        except ValueError: pass
    else: print('   (no audio, or assets/delve/delve-song.flac missing: skipped)')

    print('\n6. sync')
    cues = json.loads(run(['node', '--input-type=module', '-e', NODE, ROOT]).stdout)
    # Her words: white pegs at full light (all three channels over 200) in the words' band, away from the star
    # margins, frame by frame, against the program's own count (choreo paint): the change from frame to frame
    # must line up at lag 0; then each word: white pegs appear on its frame.
    wc = centre[:, 26:89, 9:81].astype(np.int16)
    whiteM = (wc[..., 0] > 200) & (wc[..., 1] > 200) & (wc[..., 2] > 200)
    white = whiteM.sum((1, 2)).astype(float)
    prog = np.array(cues['type'][first:first + n], float)
    dv, dp = np.diff(white), np.diff(prog[:len(white)])
    best = None
    for lag in range(-3, 4):
        a_ = dv[max(0, lag):len(dv) + min(0, lag)]; b_ = dp[max(0, -lag):len(dp) - max(0, lag)]
        r = np.corrcoef(a_, b_)[0, 1] if a_.std() > 0 and b_.std() > 0 else 0
        if best is None or r > best[1]: best = (lag, r)
        if lag in (-1, 0, 1): print(f'   words lighting vs the program at lag {lag:+d} frames: r = {r:.3f}')
    print(f'   words: best lag {best[0]:+d} (positive: the picture is late), r = {best[1]:.3f}')
    # (The counts differ in detail: a pop overshoots, a dimmed word drops under the threshold; the lag is the gate.)
    if best[0] != 0 or best[1] < .6: fails.append(f'words best lag {best[0]:+d}, r {best[1]:.2f}')
    newly = np.r_[0, (whiteM[1:] & ~whiteM[:-1]).sum((1, 2))]
    late = []
    for w in cues['words']:
        i = w['f'] - first
        if 1 <= i < n and newly[i] == 0: late.append(f"{w['id']}#{w['k']} {w['text']}@f{w['f']}")
    print(f"   each word: new white pegs on its own frame for {len(cues['words']) - len(late)} of {len(cues['words'])}" + (f"; none on {', '.join(late)}" if late else ''))
    if late: fails.append(f'{len(late)} words without new light on their frame')
    # Her mouth: the opening at its centre (pegs 44-46), the rows between the lips' signal pegs, against the program's.
    mc = centre[:, 76:118, LIPS_COL - 1:LIPS_COL + 2].astype(np.int16)
    lipmask = (mc[..., 0] > 180) & (mc[..., 1] > 150) & (mc[..., 2] < mc[..., 0] - 50)
    meas, expd = [], []
    for i in range(n):
        e = cues['mouth'][first + i] if first + i < len(cues['mouth']) else None
        if e is None: meas.append(np.nan); expd.append(np.nan); continue
        g = []
        for k in range(3):
            ys = np.nonzero(lipmask[i, :, k])[0]
            g.append(0 if len(ys) < 2 else (ys.max() - ys.min() + 1) - len(ys))
        meas.append(np.mean(g)); expd.append(e[2])
    meas, expd = np.array(meas), np.array(expd)
    best = None
    for lag in range(-3, 4):
        a_ = meas[max(0, lag):n + min(0, lag)]; b_ = expd[max(0, -lag):n - max(0, lag)]
        ok = ~np.isnan(a_) & ~np.isnan(b_)
        if ok.sum() < 48: continue
        r = np.corrcoef(a_[ok], b_[ok])[0, 1]
        print(f'   mouth opening vs the program at lag {lag:+d} frames: r = {r:.3f} ({ok.sum()} frames)')
        if best is None or r > best[1]: best = (lag, r)
    if best:
        print(f'   best lag {best[0]:+d} (positive: the picture is late), r = {best[1]:.3f}')
        if best[0] != 0 or best[1] < .8: fails.append(f'mouth best lag {best[0]:+d}, r {best[1]:.2f}')
    for f, label in [(1425, 'the kiss: the round pucker'), (1440, 'star 1 over her lips')]:
        i = f - first
        if not (0 <= i < n): continue
        if f == 1425:
            lips = centre[i, 80:112].astype(np.int16); lm = (lips[..., 0] > 180) & (lips[..., 1] > 150) & (lips[..., 2] < lips[..., 0] - 50)
            cols = np.nonzero(lm.any(0))[0]; width = cols.max() - cols.min() + 1 if len(cols) else 0
            before = centre[i - 6, 80:112].astype(np.int16); bm = (before[..., 0] > 180) & (before[..., 1] > 150) & (before[..., 2] < before[..., 0] - 50)
            bc = np.nonzero(bm.any(0))[0]; bw = bc.max() - bc.min() + 1 if len(bc) else 0
            print(f'   f1425 {label}: {width} pegs wide (the kiss sprite: 35; f1419: {bw})')
            # (The kiss sprite is 35 pegs wide; the mouth at rest 63, mouthing the choir 39 to 57.)
            if not (0 < width <= 37): fails.append('no kiss on f1425')
        else:
            hd = centre[i, 26:40, 35:50].max(); hb = centre[i - 20, 26:40, 35:50].max() if i >= 20 else 0
            print(f'   f1440 {label}: brightest peg {hd} (f1420: {hb})')
            if hd < 200: fails.append('no star 1 over her lips on f1440')

    # Her mouth against her own sound (not the program): P1 and P10, where she is alone in the mix.
    if au:
        xa = decode_audio(a.file)
        X = np.fft.rfft(xa); fq = np.fft.rfftfreq(len(xa), 1 / 48000); X[(fq < 300) | (fq > 3000)] = 0; band = np.fft.irfft(X, len(xa))
        env = np.array([np.sqrt(np.mean(band[int(i * 2000):int((i + 1) * 2000)] ** 2)) if (i + 1) * 2000 <= len(band) else 0 for i in range(n)])
        sel = np.zeros(n, bool)
        for ph in cues['phrases']:
            if ph['id'] in ('P1', 'P10'):
                lo, hi = ph['a'] - first - 4, ph['b'] - first + 8
                sel[max(0, lo):max(0, min(n, hi))] = True
        sel &= ~np.isnan(meas)
        if sel.sum() >= 24:
            res = []
            for lag in range(-3, 4):
                ia = np.nonzero(sel)[0]; ib = ia - lag; ok_ = (ib >= 0) & (ib < n); ia, ib = ia[ok_], ib[ok_]
                r = np.corrcoef(meas[ia], env[ib])[0, 1]; res.append((lag, r))
                print(f'   mouth opening vs her sound (P1, P10: 300-3000 Hz) at lag {lag:+d} frames: r = {r:.3f}')
            bl = max(res, key=lambda q: q[1])
            print(f'   her own sound: best lag {bl[0]:+d} (negative: the mouth leads), r = {bl[1]:.3f} ({int(sel.sum())} frames)')
            if bl[0] not in (0, -1) or bl[1] < .3: fails.append(f'mouth against her sound: best lag {bl[0]:+d}, r {bl[1]:.2f}')

    # 7. The picture against the song (a whole film).
    if first == 0 and n >= FRAMES - 1 and os.path.exists(SOURCE):
        print('\n7. the picture against the song')
        q = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', SOURCE, '-af', f'atrim=start={OFFSET},asetpts=PTS-STARTPTS,ebur128=metadata=1,ametadata=mode=print:file=-', '-f', 'null', '-'], capture_output=True, text=True).stdout
        ts, Ss = [], []
        for line in q.splitlines():
            if line.startswith('frame:'): ts.append(float(line.split('pts_time:')[1]))
            elif 'r128.S=' in line: Ss.append(float(line.split('=')[1]))
        ts, Ss = np.array(ts[:len(Ss)]), np.array(Ss)
        whole = lum.mean((1, 2))
        secs = range(3, 117)
        ls = np.array([whole[s_ * FPS:(s_ + 1) * FPS].mean() for s_ in secs]); sl = np.array([Ss[(ts >= s_) & (ts < s_ + 1)].mean() for s_ in secs])
        r = np.corrcoef(ls, sl)[0, 1]
        win = np.array([whole[f:f + 2 * FPS].mean() for f in range(3 * FPS, 115 * FPS)]); bw = (int(np.argmax(win)) + 3 * FPS) / FPS
        mean = lambda a_, b_: whole[int(a_ * FPS):int(b_ * FPS)].mean()
        canon, pool, slow = mean(100, 106), mean(60, 70), mean(cues['slow']['from'], cues['slow']['to'])
        M = np.concatenate([lum[:, 26:120, :10], lum[:, 26:120, 80:]], 2); mb = lambda b0, b1: M[b0 * 60:b1 * 60].mean()
        ref, s1, s2 = mb(5, 13), mb(19, 22), mb(39, 42)
        br = np.r_[0, np.clip(np.diff(lum, axis=0), 0, None).sum((1, 2))]
        seg = br[85 * FPS:107 * FPS]; ac = np.corrcoef(seg[:-15], seg[15:])[0, 1]
        print(f'   light per second against short-term loudness (3-117 s): r = {r:.3f} (at least .5)')
        print(f'   the brightest two seconds start at {bw:.2f} s (inside 98-107: the canon)')
        print(f'   the Pool {pool / canon:.2f} and the slowed "sink in" {slow / canon:.2f} of the canon\'s light (at most .85)')
        print(f'   the side margins at the swells\' tops: {s1 / ref:.2f}x and {s2 / ref:.2f}x the stream (at least 1.5x)')
        print(f'   the beat: the brightening repeats a beat later over 85-107 s, autocorrelation {ac:.2f} (at least .5)')
        if r < .5: fails.append(f'light against loudness r {r:.2f}')
        if not (98 <= bw <= 105): fails.append(f'brightest two seconds at {bw:.2f} s')
        if pool > .85 * canon or slow > .85 * canon: fails.append('the Pool or the slow span as bright as the canon')
        if s1 < 1.5 * ref or s2 < 1.5 * ref: fails.append('a swell without its light')
        if ac < .5: fails.append(f'beat autocorrelation {ac:.2f}')

    if a.frames:
        os.makedirs(a.frames, exist_ok=True)
        ks = sorted({k - first + d for k, _ in KEY for d in (-1, 0, 1) if 0 <= k - first + d < n})
        tmp = os.path.join(a.frames, '_%04d.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.file, '-vf', 'select=' + '+'.join(f'eq(n\\,{k})' for k in ks), '-fps_mode', 'passthrough', tmp], check=True)
        for j, k in enumerate(ks): os.replace(tmp % (j + 1), os.path.join(a.frames, f'f{first + k:04d}.png'))
        print(f'\n   {len(ks)} key frames written to {a.frames}')
    print('\n' + ('PASS' if not fails else 'FAIL: ' + '; '.join(fails)))
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
