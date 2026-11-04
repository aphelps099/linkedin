#!/usr/bin/env python3
"""Build src/videostudio/media/shots.json, the Video Studio shot index.

Covers the 21 season plates (src/meeting-room/media-manifest.json), every
Cutting Room 'Source take' (src/cutting-room/catalog.json) and the runtime
Synthia tile. One record per unique master (sha256).

  python3 scripts/build-shot-index.py --cache DIR [--sheets DIR] [--jobs 2]

Needs ffmpeg/ffprobe, numpy and scipy. OpenCV (opencv-python-headless) is used
only for human face detection; without it faceBox stays null for humans and
the script says so. Contact sheets need Pillow.

Remote masters are fetched once through https://linkedinbeats.com/api/
cutting-room/media/<key> (302 to a signed URL; the URL is never printed or
stored) into <cache>/src/<sha256>.mp4 and verified against the catalog hash.
Measurements are cached per sha in <cache>/measure/. Hand-verified
classifications live in OVERRIDES below, so reruns keep them.

Everything is deterministic: same inputs, same bytes out. No clocks, no
randomness; floats are rounded before they are written.
"""
import argparse, base64, hashlib, json, os, re, subprocess, sys, tempfile
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from scipy import ndimage, signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src/videostudio/media/shots.json')
PROXY_MANIFEST = os.path.join(ROOT, 'public/videostudio/proxies/manifest.json')
ORIGIN = 'https://linkedinbeats.com'
ROUTE = '/api/videostudio/media/'
ANALYSIS = 'a5'          # bump when a measurement changes meaning
AW = 320                 # analysis width (frames decoded at AW x even(AW*h/w))
SAMPLE_EVERY = 12        # full-resolution sample stride, frames
E_REF = 6.0              # mean |dY| (0..255) at 320 px wide that reads as energy 1.0
LOOP_LENS = (12, 24, 48, 96, 192)
FORMATS = {'9:16': 9 / 16, '1:1': 1.0, '16:9': 16 / 9}
TIER_U = {'A': 1.8, 'B': 1.5, 'C': 1.2}
TIER_LINES = {'A': 540, 'B': 260}   # detailH = effScale * content height (lines of real detail)
STEMS = {'Operations': 'drums', 'Keys': 'keys', 'Kevin': 'guitar', 'Synergy': 'voice'}
NEVER_ON_SCREEN = {'Pat', 'the lady', 'The lady', 'Lady'}
ROBOTS = {'Synergy', 'Synthia'}
NAMES = {'Guitar': 'Kevin', 'guitar': 'Kevin', 'drums': 'Operations', 'Drums': 'Operations',
         'accountant': 'Arjun', 'people': 'People & Culture', 'People': 'People & Culture'}
CAT_STATUS = {'Current edit': 'C', 'Available edit': 'A', 'Source take': 'S',
              'Earlier version': 'E', 'Needs review': 'R'}
# The Synthia tile the live meeting room uses (catalog: Needs review). Not a
# manifest plate or a source take, but the compositor needs it and
# robot-tracking.json ('synthia', 454 frames) belongs to it.
EXTRA_CATALOG = ['synthia-listening-camera-v2-502b2afe']
TRACKING = {'synergy-camera-v2-listening.mp4': 'synergy', 'synthia-camera-v2-listening.mp4': 'synthia'}

# ---------------------------------------------------------------------------
# Hand-verified classifications. Keys are shot ids (or aliases). Every value
# here was checked on the contact sheets; the builder applies them after the
# rules and lists the overridden field names in record.overrides.
# ---------------------------------------------------------------------------
OVERRIDES = {}
MIRROR_SAFE = set()


def load_overrides():
    """Defined after the rules so the table reads top to bottom."""
    from_table = _OVERRIDE_TABLE()
    OVERRIDES.update(from_table['fields'])
    MIRROR_SAFE.update(from_table['mirrorSafe'])


def _OVERRIDE_TABLE():
    fields = {
        # Brand-film plates whose catalog cast is empty or partial.
        'drum-pad-detail': {'characters': ['Operations'], 'shotType': 'detail', 'action': ['play'],
                            'notes': 'Hands, sticks and the four pads; face out of frame.'},
        'drummer-arrival-performance': {'characters': ['Operations'], 'shotType': 'wide', 'action': ['walk', 'play'],
                                        'reverseWhy': 'walk-in ends on drumming',
                                        'notes': 'Walks in with sticks, sits, plays. Frames before the sit-down are walk-in only.'},
        'office-ensemble': {'characters': ['Keys', 'Operations', 'Synergy', 'Synthia', 'People & Culture', 'Strategy', 'Kevin', 'Printer'],
                            'shotType': 'wide', 'action': ['play', 'print'],
                            'notes': 'Master wide: the band, both robots, the printer and its LinkedIn pages.'},
        'corporate-applause-vhs-cameraman': {'shotType': 'wide', 'action': ['applaud'],
                                             'notes': 'In-world camcorder operator in the foreground; LinkedIn banner behind.'},
        'corporate-applause-closer-reaction': {'shotType': 'medium', 'action': ['applaud'],
                                               'notes': 'Synergy with People & Culture and Kevin (guitar slung). Badge readable.'},
        'the-professionals-arrive': {'shotType': 'wide', 'action': ['walk'],
                                     'notes': 'Walk toward camera carrying banner hardware; CIRCLE BACK shirt.'},
        'banner-installation-blank-plates': {'shotType': 'wide', 'action': ['install'],
                                             'notes': 'Clean blue banners: flat surfaces for tracked type.'},
        'bring-your-whole-self-to-work-banner-installation': {'shotType': 'wide', 'action': ['install']},
        'authenticity-starts-here-measuring': {'shotType': 'wide', 'action': ['install'],
                                               'notes': 'Tape measure against a printed banner.'},
        'measuring-authenticity-blank-plates': {'shotType': 'wide', 'action': ['install'],
                                                'notes': 'Contains a hard cut to a reverse angle (see cuts).'},
        'printer-outward-feed': {'shotType': 'medium', 'action': ['print'],
                                 'notes': 'Approved outward feed. Pages never reverse; freeze instead.'},
        'synergy-close-laptop-plate': {'shotType': 'insert', 'action': ['type'],
                                       'notes': 'Over-the-shoulder laptop, blank screen for the board or the equalizer.'},
        'synthia-clean-face-plate': {'shotType': 'plate', 'action': ['idle'],
                                     'notes': 'Clean black display for a tracked LED mouth. Not tracked yet. Holds a coffee cup; no sip seen on the sheet.'},
        'synthia-conference-closeup': {'shotType': 'medium', 'action': ['idle', 'type'],
                                       'notes': 'Seated at the table, opens a laptop. Raw face.'},
        'blue-guitar-detail': {'shotType': 'detail', 'action': ['play'], 'notes': 'Frets and pick hand; face cut at the mouth.'},
        'guitar-office-performance': {'shotType': 'medium', 'action': ['play']},
        'keys-office-performance': {'shotType': 'medium', 'action': ['play'], 'notes': 'Best keys hero: hands, keys and face.'},
        'keys-detail': {'shotType': 'detail', 'action': ['play'], 'notes': 'Hands strip, soft. Never crop out the hands.'},
        'people-linkedin-computer': {'shotType': 'insert', 'action': ['type'], 'notes': 'Blank monitor, ready for a screen composite.'},
        'synergy-types-into-chatgpt-finished-insert': {'shotType': 'insert', 'action': ['type', 'screen'],
                                                       'notes': 'Baked chat UI and audio mix.'},
        'the-meeting-loads-finished-insert': {'shotType': 'insert', 'action': ['screen'],
                                              'notes': 'Baked video-call UI with a third-party wordmark at the top left. Mask or crop it before use.',
                                              'rules': ['mask-call-ui-mark']},
        'the-post-reactions-and-comments': {'shotType': 'insert', 'action': ['screen'],
                                            'notes': 'Baked feed UI with names and comments.'},
        'humbled-and-honored-to-share-phrase-card': {'shotType': 'insert', 'action': ['screen'], 'characters': [],
                                                     'notes': 'Old blue phrase-card style: homage only. Baked audio.'},
        'let-s-circle-back-phrase-card': {'shotType': 'insert', 'action': ['screen'], 'characters': [],
                                          'notes': 'Old blue phrase-card style: homage only. Baked audio.'},
        'optimize-the-onboarding-phrase-card': {'shotType': 'insert', 'action': ['screen'], 'characters': [],
                                                'notes': 'Old blue phrase-card style: homage only. Baked audio.'},
        'synergy-caffeinated-typing-and-celebration': {'shotType': 'medium', 'action': ['type', 'celebrate'],
                                                       'notes': 'Raw generated face: needs the tracked glass display before it speaks.'},
        'synergy-enthusiastic-training-close-up': {'shotType': 'close', 'action': ['idle'],
                                                   'notes': 'Raw generated face: needs the tracked glass display before it speaks.'},
        'synergy-synergy-v2-original-take': {'shotType': 'plate', 'action': ['idle'],
                                             'notes': 'Source master of the approved Synergy tile; raw face, baked name strip.'},
        # Season plates.
        'keys-playing': {'notes': 'Hands nearly still: a weak hero. Keyboard at the bottom edge.'},
        'keys-full-playing': {'roles+': ['keys.hero'], 'notes': 'Mic icon and name label burned in over the lower left of the keyboard.',
                              'rules': ['baked-label-in-picture'], 'uiLabel': [160, 650, 180, 70]},
        'keys-full-listening': {'rules': ['baked-label-in-picture'], 'uiLabel': [160, 650, 180, 70]},
        'keys-full-speaking': {'rules': ['baked-label-in-picture'], 'uiLabel': [160, 650, 180, 70]},
        'drums-listening': {'notes': 'Keeps drumming while listening.'},
        'drums-playing': {'roles+': ['drums.hero']},
        'guitar-listening': {'roles+': ['guitar.hero']},
        'synergy-camera-v2-listening': {'roles+': ['voice.hero'], 'lipSync': 'envelope',
                                        'notes': 'Approved host tile; live 22-LED mouth row driven by the voice envelope. Ping-pong loop approved.'},
        'synthia-camera-v2-listening': {'roles+': ['harmony.hero'], 'lipSync': 'envelope', 'action': ['idle', 'listen'],
                                        'notes': 'Runtime Synthia tile. Catalog flags a light patch on the lower screen: fine in tiles, use the clean plate for close-ups.'},
        'synergy-listening': {'notes': 'Archived; superseded by synergy-camera-v2-listening.'},
        'synthia-listening': {'notes': 'Earlier body plate; superseded by synthia-camera-v2-listening.'},
        'printer-printing': {'notes': 'Inward feed; runtime uses its 3.75 s frame with canvas sheets. Prefer printer-outward-feed.'},
        'strategy-listening': {'notes': 'Only 3.5 s.'},
    }
    # Human tiles with nothing readable, no badge, no instrument and no
    # directional landmark inside the content box. Verified on the sheets.
    mirror_safe = {
        'people-listening', 'people-speaking', 'arjun-listening', 'arjun-speaking',
        'linda-listening', 'linda-speaking', 'drum-pad-detail',
    }
    for who in ('arjun', 'kevin', 'keys', 'linda', 'operations', 'people-culture'):
        for m in ('offline', 'onboarding', 'quarterly', 'standup', 'unlock'):
            for v in ('v1', 'v2', '0'):
                mirror_safe.add(f'{who}-{m}-{v}')
    mirror_safe |= {k + '-original-take' for k in mirror_safe if k.endswith('-0')}
    mirror_safe |= {'kevin-new-v1', 'kevin-kevin-pilot-original-take', 'arjun-offline-0-arjun-v2-original-take'}
    return {'fields': fields, 'mirrorSafe': mirror_safe}


# ---------------------------------------------------------------------------
# Numbers and output
# ---------------------------------------------------------------------------
def num(x, nd=3):
    v = round(float(x), nd)
    if v == 0:
        return 0
    return int(v) if v.is_integer() else v


def b64u8(arr):
    return base64.b64encode(np.asarray(arr, dtype=np.uint8).tobytes()).decode('ascii')


def dumps_line(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))


def write_index(meta, shots, path):
    """Header fields one per line, then one shot per line. Mirrored by
    writeIndex() in scripts/build-videostudio-proxies.mjs."""
    lines = ['{']
    for k, v in meta.items():
        lines.append(f'{dumps_line(k)}:{dumps_line(v)},')
    lines.append('"shots":[')
    for i, s in enumerate(shots):
        lines.append(dumps_line(s) + (',' if i < len(shots) - 1 else ''))
    lines.append(']}')
    text = '\n'.join(lines) + '\n'
    if path == '-':
        sys.stdout.write(text)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def scrub(text):
    return re.sub(r'https?://\S+', '<url>', text or '')


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------
def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def runtime_media():
    """Basenames and media prefixes the live meeting room loads."""
    names, prefixes = set(), set()
    d = os.path.join(ROOT, 'src/meeting-room')
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(('.js', '.jsx')):
            continue
        with open(os.path.join(d, fn), encoding='utf-8') as f:
            text = f.read()
        names |= set(re.findall(r'([a-z0-9-]+\.mp4)', text))
        prefixes |= set(re.findall(r"media:'([a-z0-9-]+)'", text))
    return names, prefixes


def collect_sources():
    manifest = load_json('src/meeting-room/media-manifest.json')
    catalog = load_json('src/cutting-room/catalog.json')
    by_sha, order = {}, []
    for a in manifest['assets']:
        by_sha[a['sha256']] = {'sha': a['sha256'], 'manifest': a, 'catalog': None}
        order.append(a['sha256'])
    for x in catalog['assets']:
        wanted = x['status'] == 'Source take' or x['id'] in EXTRA_CATALOG
        if not wanted and x['sha256'] not in by_sha:
            continue
        e = by_sha.get(x['sha256'])
        if e is None:
            e = by_sha[x['sha256']] = {'sha': x['sha256'], 'manifest': None, 'catalog': None}
            order.append(x['sha256'])
        if e['catalog'] is None:
            e['catalog'] = x
    return [by_sha[s] for s in order]


def source_location(e):
    if e['manifest']:
        return {'local': 'public/studio/season/' + e['manifest']['video']}
    src = e['catalog']['src']
    if src.startswith('/api/cutting-room/media/'):
        return {'remote': src.rsplit('/', 1)[-1]}
    return {'local': 'public' + src}


def fetch(key, sha, cache):
    dst = os.path.join(cache, 'src', sha + '.mp4')
    if os.path.exists(dst) and sha256_file(dst) == sha:
        return dst, None
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    part = dst + '.part'
    r = subprocess.run(['curl', '-sS', '-L', '--fail', '--retry', '3', '-o', part,
                        f'{ORIGIN}/api/cutting-room/media/{key}'], capture_output=True, text=True)
    if r.returncode != 0:
        if os.path.exists(part):
            os.remove(part)
        return None, f'download failed (curl {r.returncode}): {scrub(r.stderr).strip()[:200]}'
    got = sha256_file(part)
    if got != sha:
        os.remove(part)
        return None, f'sha256 mismatch: got {got[:12]}, catalog {sha[:12]}'
    os.replace(part, dst)
    return dst, None


def resolve(e, cache, download=True):
    loc = source_location(e)
    if 'local' in loc:
        p = os.path.join(ROOT, loc['local'])
        if not os.path.exists(p):
            return None, f'missing local file {loc["local"]}'
        got = sha256_file(p)
        if got != e['sha']:
            return None, f'sha256 mismatch for {loc["local"]}: got {got[:12]}'
        return p, None
    if not download:
        p = os.path.join(cache, 'src', e['sha'] + '.mp4')
        return (p, None) if os.path.exists(p) else (None, 'not cached and --no-download')
    return fetch(loc['remote'], e['sha'], cache)


# ---------------------------------------------------------------------------
# Decoding
# ---------------------------------------------------------------------------
def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path],
                       capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    v = next(s for s in j['streams'] if s['codec_type'] == 'video')
    a = any(s['codec_type'] == 'audio' for s in j['streams'])
    n, d = v['r_frame_rate'].split('/')
    return {'width': int(v['width']), 'height': int(v['height']), 'fps': float(n) / float(d),
            'codec': v['codec_name'], 'pix_fmt': v.get('pix_fmt'), 'audio': a,
            'nb_frames': int(v.get('nb_frames') or 0), 'duration': float(j['format'].get('duration') or 0)}


def decode(path, vf, w, h, pix='rgb24'):
    ch = 3 if pix == 'rgb24' else 1
    r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-threads', '2', '-i', path, '-an',
                        '-vf', vf, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', pix, '-'],
                       capture_output=True, check=True)
    buf = np.frombuffer(r.stdout, np.uint8)
    n = buf.size // (w * h * ch)
    buf = buf[: n * w * h * ch]
    return buf.reshape(n, h, w, ch) if ch == 3 else buf.reshape(n, h, w)


def luma(rgb):
    rgb = rgb.astype(np.float32)
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def even(x):
    return int(round(x / 2.0)) * 2


# ---------------------------------------------------------------------------
# Measurements
# ---------------------------------------------------------------------------
def content_box(samples, crop_bottom):
    """Picture minus dark static bars, at full resolution. samples: (n,h,w) gray."""
    F = samples.astype(np.float32)
    M, S = F.mean(0), F.std(0)
    bar = (M < 30) & (S < 4)
    h, w = M.shape
    cf, rf = bar.mean(0), bar.mean(1)

    def run(fr, n, rev=False):
        idx = range(n - 1, -1, -1) if rev else range(n)
        k = 0
        for i in idx:
            if fr[i] > 0.9:
                k += 1
            else:
                break
        return k
    x0, x1 = run(cf, w), w - run(cf, w, True)
    y0, y1 = run(rf, h), h - run(rf, h, True)
    if crop_bottom:
        y1 = min(y1, h - crop_bottom)
    # snap inward to even pixels
    x0, y0 = x0 + (x0 & 1), y0 + (y0 & 1)
    x1, y1 = x1 - (x1 & 1), y1 - (y1 & 1)
    if x1 - x0 < w * 0.3 or y1 - y0 < h * 0.3:
        return [0, 0, w, h], {'pillarbox': False, 'letterbox': False, 'bottomStrip': 0}
    ui = {'pillarbox': bool(x0 > 0 or x1 < w), 'letterbox': bool(y0 > 0), 'bottomStrip': int(h - y1)}
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)], ui


def lapvar(gray):
    g = gray.astype(np.float32)
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


def eff_scale(gray):
    """Smallest scale s whose down-then-up round trip keeps PSNR >= 38 dB:
    the picture holds about s * height lines of real detail."""
    g = gray.astype(np.float32)
    for s in (0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
        d = ndimage.zoom(ndimage.gaussian_filter(g, 0.5 / s), s, order=1)
        u = ndimage.zoom(d, (g.shape[0] / d.shape[0], g.shape[1] / d.shape[1]), order=3)
        u = u[:g.shape[0], :g.shape[1]]
        mse = float(np.mean((g[:u.shape[0], :u.shape[1]] - u) ** 2))
        if mse == 0 or 10 * np.log10(255 * 255 / mse) >= 38:
            return s
    return 1.0


def green_eyes(rgb):
    F = rgb.astype(np.int16)
    R, G, B = F[..., 0], F[..., 1], F[..., 2]
    m = (G > 150) & (G - R > 60) & (G - B > 40)
    if m.sum() < 12:
        return None
    md = ndimage.binary_dilation(m, iterations=max(2, rgb.shape[0] // 180))
    lab, n = ndimage.label(md)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    order = np.argsort(-sizes, kind='stable')
    keep = [order[0] + 1]
    if n > 1 and sizes[order[1]] > 0.3 * sizes[order[0]]:
        keep.append(order[1] + 1)
    eye = m & np.isin(lab, keep)
    ys, xs = np.where(eye)
    if len(xs) < 12 or len(keep) < 2:
        return None
    return eye, (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))


def robot_display(rgb):
    """Robot 'face': the dark glass display around the two green LED eyes."""
    found = green_eyes(rgb)
    if not found:
        return None
    eye, (ex0, ey0, ex1, ey1) = found
    span = max(ex1 - ex0, 20)
    h, w = rgb.shape[:2]
    model = [ex0 - 0.5 * span, ey0 - 0.66 * span, ex1 + 0.52 * span, ey1 + 0.76 * span]
    gray = luma(rgb)
    x0, x1 = int(max(0, ex0 - 1.1 * span)), int(min(w, ex1 + 1.1 * span))
    y0, y1 = int(max(0, ey0 - 1.0 * span)), int(min(h, ey1 + 1.2 * span))
    win = np.zeros(gray.shape, bool)
    win[y0:y1, x0:x1] = gray[y0:y1, x0:x1] < 55
    win = ndimage.binary_opening(win, iterations=2) | eye
    win = ndimage.binary_closing(win, iterations=2)
    lab, _ = ndimage.label(win)
    l = int(np.bincount(lab[eye]).argmax()) if eye.any() else 0
    method = 'led-eyes-model'
    box = model
    if l:
        yy, xx = np.where(lab == l)
        bw, bh = xx.max() - xx.min(), yy.max() - yy.min()
        if 1.5 * span <= bw <= 2.8 * span and 1.0 * span <= bh <= 2.4 * span:
            box = [xx.min(), yy.min(), xx.max() + 1, yy.max() + 1]
            method = 'led-eyes+glass'
    box = [max(0, box[0]), max(0, box[1]), min(w, box[2]), min(h, box[3])]
    return box, method


_HAAR = None


def haar():
    global _HAAR
    if _HAAR is None:
        try:
            import cv2
            _HAAR = (cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'),
                     cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml'))
        except Exception:
            _HAAR = False
    return _HAAR


def human_face(gray, cbox):
    cascades = haar()
    if not cascades:
        return None
    import cv2
    cas, eyes = cascades
    x, y, w, h = cbox
    sub = np.ascontiguousarray(gray[y:y + h, x:x + w])
    scale = 1.0
    if sub.shape[0] > 720:
        scale = 720.0 / sub.shape[0]
        sub = cv2.resize(sub, (int(round(sub.shape[1] * scale)), 720), interpolation=cv2.INTER_AREA)
    m = int(sub.shape[0] * 0.08)
    fs = cas.detectMultiScale(sub, scaleFactor=1.1, minNeighbors=6, minSize=(m, m))
    # a face counts only with at least one eye in its upper 60 percent
    valid = []
    for fx, fy, fw, fh in fs:
        roi = sub[fy:fy + int(fh * .6), fx:fx + fw]
        e = eyes.detectMultiScale(roi, scaleFactor=1.1, minNeighbors=3, minSize=(max(8, fw // 10),) * 2)
        if len(e):
            valid.append((fx, fy, fw, fh))
    if not valid:
        return None
    fx, fy, fw, fh = max(valid, key=lambda r: (r[2] * r[3], -r[0], -r[1]))
    return [x + fx / scale, y + fy / scale, x + (fx + fw) / scale, y + (fy + fh) / scale]


def median_box(boxes):
    a = np.array(boxes, dtype=np.float64)
    return [float(np.median(a[:, i])) for i in range(4)]


def pool2(C):
    n, h, w = C.shape
    h2, w2 = h // 2, w // 2
    return C[:, :h2 * 2, :w2 * 2].reshape(n, h2, 2, w2, 2).mean((2, 4))


def find_loops(G, d, cuts):
    """Best seam per length. G: (n,h,w) float gray analysis frames."""
    n = len(G)
    base = max(float(np.median(d[1:])) if n > 2 else 1.0, 0.25)
    cutset = set(cuts)
    flat = G.reshape(n, -1)
    out = []
    tried = set()

    def best_for(L):
        if L >= n - 1 or L < 6:
            return None
        D = np.abs(flat[L:] - flat[:-L]).mean(1)  # D[a] = |G[a+L]-G[a]|
        ok = np.ones(len(D), bool)
        for c in cutset:  # window a..a+L must not contain a hard cut
            ok[max(0, c - L):c] = False
        if not ok.any():
            return None
        Dm = np.where(ok, D, np.inf)
        a = int(np.argmin(Dm))
        seam = float(D[a] / base)
        method = 'cut' if seam <= 1.5 else ('xfade2' if seam <= 3 else 'pingpong')
        return {'in': a, 'out': a + L, 'len': L, 'seam': num(seam, 2), 'method': method}
    for L in LOOP_LENS:
        r = best_for(L)
        tried.add(L)
        if r:
            out.append(r)
    extra = []
    for L in range(8, min(n - 1, 241)):
        if L in tried:
            continue
        r = best_for(L)
        if r and r['seam'] <= 1.5:
            extra.append(r)
    extra.sort(key=lambda r: (r['seam'], r['len']))
    picked = []
    for r in extra:
        if all(abs(r['len'] - p['len']) >= 3 for p in picked):
            picked.append(r)
        if len(picked) == 6:
            break
    return out + sorted(picked, key=lambda r: r['len'])


def measure(path, crop_bottom, robot, want_face, track=None):
    p = probe(path)
    w, h = p['width'], p['height']
    ah = max(2, even(AW * h / w))
    rgb = decode(path, f'scale={AW}:{ah}:flags=area', AW, ah)
    n = len(rgb)
    G = luma(rgb)
    samples = decode(path, f"select='not(mod(n\\,{SAMPLE_EVERY}))'", w, h, 'gray')
    cbox, ui = content_box(samples, crop_bottom)
    cx, cy, cw, chh = cbox
    sx, sy = AW / w, ah / h
    ax0, ay0 = int(np.floor(cx * sx)), int(np.floor(cy * sy))
    ax1, ay1 = int(np.ceil((cx + cw) * sx)), int(np.ceil((cy + chh) * sy))
    # 1 px inset at analysis scale keeps bar edges out of the statistics
    ax0, ay0 = min(ax0 + 1, ax1 - 2), min(ay0 + 1, ay1 - 2)
    ax1, ay1 = max(ax1 - 1, ax0 + 2), max(ay1 - 1, ay0 + 2)
    C = G[:, ay0:ay1, ax0:ax1]
    lum = np.clip(np.round(C.mean((1, 2))), 0, 255).astype(np.uint8)
    d = np.zeros(n, np.float64)
    if n > 1:
        d[1:] = np.abs(np.diff(C, axis=0)).mean((1, 2))
        d[0] = d[1]
    med = float(np.median(d[1:])) if n > 2 else 0.0
    cuts = [int(i) for i in np.where(d > max(8 * med, 12))[0] if i > 0]
    dn = d.copy()
    for c in cuts:  # a hard cut is not motion
        dn[c] = d[c - 1] if c > 0 else 0
    energy = np.clip(np.round(np.minimum(1.0, dn / E_REF) * 255), 0, 255).astype(np.uint8)
    # motion map: where change accumulates (subject box and hits region)
    A = np.abs(np.diff(C, axis=0)).mean(0) if n > 1 else np.zeros(C.shape[1:])
    thr = float(np.percentile(A, 85))
    mys, mxs = np.where(A >= thr)
    motion_box = None
    if len(mxs) and A.max() > 0.3:
        motion_box = [(ax0 + np.percentile(mxs, 5)) / sx, (ay0 + np.percentile(mys, 5)) / sy,
                      (ax0 + np.percentile(mxs, 95) + 1) / sx, (ay0 + np.percentile(mys, 95) + 1) / sy]
        wts = A[A >= thr]
        centroid = [(ax0 + float((mxs * wts).sum() / wts.sum()) + .5) / sx,
                    (ay0 + float((mys * wts).sum() / wts.sum()) + .5) / sy]
    else:
        centroid = None
    region = A >= float(np.percentile(A, 80))
    dr = np.zeros(n)
    if n > 1 and region.any():
        dr[1:] = np.abs(np.diff(C, axis=0))[:, region].mean(1)
        dr[0] = dr[1]
    # sharpness, native and at <=720 lines
    ss = samples[:, cy:cy + chh, cx:cx + cw]
    lv_native = float(np.median([lapvar(s) for s in ss]))
    lv720 = lv_native
    if chh > 720:
        tw = even(cw * 720 / chh)
        s720 = decode(path, f"select='not(mod(n\\,{SAMPLE_EVERY}))',crop={cw}:{chh}:{cx}:{cy},scale={tw}:720:flags=area",
                      tw, 720, 'gray')
        lv720 = float(np.median([lapvar(s) for s in s720]))
    picks = [len(ss) // 3, (2 * len(ss)) // 3] if len(ss) > 2 else [0]
    eff = float(np.median([eff_scale(ss[i]) for i in picks]))
    # faces
    face, faces, method = None, [], None
    if robot:
        rgbs = decode(path, f"select='not(mod(n\\,{SAMPLE_EVERY}))'", w, h, 'rgb24')
        hits = []
        for s in rgbs:
            r = robot_display(s)
            if r:
                hits.append(r)
        if len(hits) >= max(2, 0.4 * len(rgbs)):
            faces = [b for b, _ in hits]
            methods = sorted({m for _, m in hits})
            method = 'led-eyes+glass' if 'led-eyes+glass' in methods and \
                sum(m == 'led-eyes+glass' for _, m in hits) >= len(hits) / 2 else 'led-eyes-model'
        face_ratio = len(hits) / max(1, len(rgbs))
    elif want_face and haar():
        for s in samples:
            b = human_face(s, cbox)
            if b:
                faces.append(b)
        if len(faces) >= max(2, 0.4 * len(samples)):
            method = 'haar'
        else:
            faces = []
        face_ratio = len(faces) / max(1, len(samples))
    else:
        face_ratio = 0.0
    if faces:
        mb = median_box(faces)
        a = np.array(faces)
        spread = [float(np.percentile(a[:, 0], 10)), float(np.percentile(a[:, 1], 10)),
                  float(np.percentile(a[:, 2], 90)), float(np.percentile(a[:, 3], 90))]
        face = {'box': mb, 'union': spread, 'method': method, 'hits': face_ratio}
    if track is not None:
        face = face or {}
        face['track'] = track
    return {
        'probe': p, 'frames': int(n), 'contentBox': cbox, 'ui': ui,
        'luma': lum, 'energy': energy, 'motion': d, 'regionMotion': dr, 'cuts': cuts,
        'motionBox': motion_box, 'centroid': centroid, 'lapvar': [lv_native, lv720], 'effScale': eff,
        'face': face, 'faceTried': bool(robot or (want_face and haar())),
        'loops': find_loops(pool2(C), d, cuts),
    }


def find_hits(dr, fps):
    if len(dr) < 8 or dr.std() < 1e-6:
        return [], None
    x = dr - ndimage.uniform_filter1d(dr, 25, mode='nearest')
    pk, _ = signal.find_peaks(x, distance=4, prominence=0.6 * float(x.std()))
    pk = [int(p) for p in pk]
    period = float(np.median(np.diff(pk))) / fps if len(pk) > 2 else None
    return pk, period


# ---------------------------------------------------------------------------
# Measurement cache (json-safe)
# ---------------------------------------------------------------------------
def cache_path(cache, sha):
    return os.path.join(cache, 'measure', f'{sha}-{ANALYSIS}.json')


def to_jsonable(m):
    m = dict(m)
    for k in ('luma', 'energy'):
        m[k] = b64u8(m[k])
    for k in ('motion', 'regionMotion'):
        m[k] = [round(float(v), 4) for v in m[k]]
    return m


def from_jsonable(m):
    m = dict(m)
    for k in ('luma', 'energy'):
        m[k] = np.frombuffer(base64.b64decode(m[k]), np.uint8)
    for k in ('motion', 'regionMotion'):
        m[k] = np.array(m[k], np.float64)
    return m


def measure_cached(args):
    path, sha, crop_bottom, robot, track, cache, use_cache = args
    cp = cache_path(cache, sha) if cache else None
    if use_cache and cp and os.path.exists(cp):
        with open(cp, encoding='utf-8') as f:
            return from_jsonable(json.load(f))
    m = to_jsonable(measure(path, crop_bottom, robot, True, track))
    # round-trip through JSON so cached and fresh runs are byte-identical
    m = json.loads(json.dumps(m))
    if cp:
        os.makedirs(os.path.dirname(cp), exist_ok=True)
        with open(cp + '.tmp', 'w', encoding='utf-8') as f:
            json.dump(m, f)
        os.replace(cp + '.tmp', cp)
    return from_jsonable(m)


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------
def norm_chars(names):
    out = []
    for c in names:
        c = NAMES.get(c, c)
        if c in NEVER_ON_SCREEN or c in out:
            continue
        out.append(c)
    return out


def base_id(cid):
    return re.sub(r'-[0-9a-f]{8}$', '', cid)


def classify(e, m, runtime):
    man, cat = e['manifest'], e['catalog']
    loc = source_location(e)
    sha8 = e['sha'][:8]
    sid = f'{man["id"]}-{sha8}' if man else cat['id']
    file_base = os.path.basename(loc.get('local', loc.get('remote', ''))).rsplit('.', 1)[0]
    aliases = []
    for a in [man and man['id'], cat and cat['id'], cat and base_id(cat['id']), file_base if 'local' in loc else None]:
        if a and a != sid and a not in aliases:
            aliases.append(a)
    keys = [sid] + aliases
    ov = {}
    for k in keys[::-1]:  # the shot id wins over aliases
        if k in OVERRIDES:
            ov.update(OVERRIDES[k])

    # status
    cstat = CAT_STATUS.get(cat['status']) if cat else None
    is_plate = 'local' in loc and loc['local'].startswith('public/studio/season/clips/')
    is_exact = 'local' in loc and loc['local'].startswith('public/studio/performances/')
    names, prefixes = runtime
    base = os.path.basename(loc.get('local', ''))
    in_runtime = bool(man) or base in names or any(base.startswith(p + '-') for p in prefixes if is_plate)
    if cstat in ('E', 'R'):
        status = cstat
    elif in_runtime:
        status = 'C'
    else:
        status = cstat or 'C'

    # kind
    title = (cat or {}).get('title', man['id'] if man else sid)
    if is_plate:
        kind = 'plate'
    elif is_exact:
        kind = 'exact'
    elif cat and 'original-take' in cat['id']:
        kind = 'take'
    else:
        kind = 'brand'

    chars = norm_chars([man['character']] if man else (cat.get('cast') or []))
    if man and cat:
        chars = norm_chars([man['character']] + cat.get('cast', []))
    state = (man or {}).get('state', '')
    sidl = sid.lower()
    # action
    action = []
    if state:
        action = {'instrumental': ['play'], 'speaking-playing': ['speak', 'play'], 'listening-playing': ['listen', 'play'],
                  'speaking': ['speak'], 'listening': ['listen'], 'robot-idle': ['idle', 'listen'],
                  'printing': ['print']}.get(state, [])
    if not action:
        if kind in ('exact', 'take') and not (set(chars) & ROBOTS):
            action = ['speak']
        elif re.search(r'listening', sidl):
            action = ['listen'] + (['play'] if re.search(r'^(keys|kevin|guitar|operations|drums)-', sidl) else [])
        elif re.search(r'speaking', sidl):
            action = ['speak'] + (['play'] if re.search(r'^(keys|kevin|guitar|operations|drums)-', sidl) else [])
        elif re.search(r'playing|detail|performance', sidl):
            action = ['play']
    if 'action' in ov:
        action = list(ov['action'])

    # lip sync
    lip = 'none'
    if kind == 'exact' or (kind == 'take' and not (set(chars) & ROBOTS)):
        lip = 'exact'
    elif 'speak' in action:
        lip = 'loose'
    lip = ov.get('lipSync', lip)

    # shot type
    if 'shotType' in ov:
        shot_type = ov['shotType']
    elif kind == 'plate' and re.search(r'detail', sidl):
        shot_type = 'detail'
    elif kind == 'plate':
        shot_type = 'plate'
    elif kind in ('exact', 'take'):
        shot_type = 'close'
    elif cat and cat['category'] == 'Screen inserts':
        shot_type = 'insert'
    else:
        shot_type = 'medium'

    chars = norm_chars(ov.get('characters', chars))
    # stem: only for a single primary performer of a stem
    primary = chars[0] if len(chars) == 1 else None
    stem = STEMS.get(primary) if primary and shot_type != 'insert' else None

    # roles
    roles = []
    if stem and 'play' in action:
        roles.append(f'{stem}.play')
    if stem == 'voice':
        roles.append('voice.lead')
    if primary == 'Synthia':
        roles.append('harmony')
    if 'Printer' in chars and 'print' in action and len(chars) == 1:
        roles.append('shaker')
    if 'listen' in action or 'idle' in action:
        roles.append('listener')
    if 'speak' in action:
        roles.append('speaker')
    if 'applaud' in action:
        roles.append('reaction')
    if shot_type == 'wide':
        roles.append('wide')
    if shot_type == 'insert':
        roles.append('insert')
    if 'install' in action or 'walk' in action:
        roles.append('banner' if 'Banner crew' in chars else 'walk-in')
    if stem and shot_type in ('detail', 'medium') and 'play' in action:
        roles.append(f'{stem}.cutaway')
    for r in ov.get('roles+', []):
        if r not in roles:
            roles.append(r)

    # reverse class
    why = None
    if 'play' in action:
        why = 'instrument'
    elif 'print' in action:
        why = 'printer-pages'
    elif lip == 'exact':
        why = 'lip-sync'
    elif 'drink' in action:
        why = 'drinking'
    rclass = 'R0' if why else 'R1'
    if not why:
        why = next((a for a in ('listen', 'idle', 'walk', 'applaud', 'install', 'type', 'screen', 'celebrate', 'speak')
                    if a in action), 'free')
    rclass = ov.get('reverseClass', rclass)
    why = ov.get('reverseWhy', why)

    # mirror blockers (anything a flip would make read wrong)
    blockers = []
    if set(chars) & ROBOTS and shot_type not in ('insert',):
        blockers.append('badge')
    if 'Kevin' in chars and ('play' in action or kind in ('plate', 'brand')):
        blockers.append('guitar')
    if 'Keys' in chars and kind in ('plate', 'brand'):
        blockers.append('keyboard')
    if chars == ['Strategy']:
        blockers.append('skyline')
    if 'Printer' in chars:
        blockers.append('logo')
    if 'Banner crew' in chars:
        blockers.append('banner-text')
    if shot_type == 'insert' or (cat and cat['category'] == 'Screen inserts'):
        blockers.append('screen-text')
    if 'applaud' in action:
        blockers.append('logo')
    for r in ov.get('rules', []):
        if r == 'baked-label-in-picture' and 'name-label' not in blockers:
            blockers.append('name-label')
        if r == 'mask-call-ui-mark' and 'call-ui' not in blockers:
            blockers.append('call-ui')
    blockers = sorted(set(blockers))
    safe = any(k in MIRROR_SAFE for k in keys)
    mirrorable = bool(safe and not blockers)

    # geometry
    p = m['probe']
    w, h = p['width'], p['height']
    cbox = m['contentBox']
    cx, cy, cw, chh = cbox
    face = m['face'] or {}
    face_box = None
    humans = [c for c in chars if c not in ROBOTS and c not in ('Printer', 'Paper droid')]
    several = len(chars) > 1 or 'Banner crew' in chars
    if 'box' in face and several:
        face = {k: v for k, v in face.items() if k not in ('box', 'union')}
        face_note = 'Several people in frame: no single faceBox; crops use motion.'
    else:
        face_note = ''
    if 'box' in face:
        b = face['box']
        face_box = {'x': int(round(b[0])), 'y': int(round(b[1])), 'w': int(round(b[2] - b[0])), 'h': int(round(b[3] - b[1])),
                    'method': face['method'], 'hits': num(face['hits'], 2)}
    if face_box and face.get('track'):
        face_box['track'] = face['track']
    subject = None
    parts = []
    if 'union' in face:
        u = face['union']
        pw, ph = (u[2] - u[0]) * .15, (u[3] - u[1]) * .15
        parts.append([u[0] - pw, u[1] - ph, u[2] + pw, u[3] + ph])
    if m['motionBox'] and ('play' in action or not parts):
        parts.append(m['motionBox'])
    if parts:
        a = np.array(parts)
        subject = [max(cx, a[:, 0].min()), max(cy, a[:, 1].min()), min(cx + cw, a[:, 2].max()), min(cy + chh, a[:, 3].max())]
    if face_box:
        basis = 'face'
        fx = face_box['x'] + face_box['w'] / 2
        fy = face_box['y'] + face_box['h'] / 2
        focus = [fx, fy]
    elif m['centroid']:
        basis = 'motion'
        focus = m['centroid']
    else:
        basis = 'centre'
        focus = [cx + cw / 2, cy + chh / 2]
    if 'play' in action and subject:
        # instruments: centre on the performer plus the instrument, not the face alone
        focus = [(subject[0] + subject[2]) / 2, focus[1] if basis == 'face' else (subject[1] + subject[3]) / 2]
        basis = basis + '+instrument'
    crops, crop_notes = {}, []
    for fmt, r in FORMATS.items():
        if cw / chh > r:
            ch_, cw_ = chh, even(chh * r)
            x = int(round(min(max(focus[0] - cw_ / 2, cx), cx + cw - cw_)))
            y = cy
        else:
            cw_, ch_ = cw, even(cw / r)
            target = focus[1] - (0.4 * ch_ if basis.startswith('face') else 0.5 * ch_)
            y = int(round(min(max(target, cy), cy + chh - ch_)))
            x = cx
        x, y = x - (x & 1), y - (y & 1)
        crops[fmt] = [int(x), int(y), int(cw_), int(ch_)]
        if subject:
            sw = subject[2] - subject[0]
            sh = subject[3] - subject[1]
            if sw > cw_ * 1.02 or sh > ch_ * 1.02:
                crop_notes.append(f'{fmt}: subject wider than the crop')
    # sharpness
    detail_h = int(round(m['effScale'] * chh))
    tier = 'A' if detail_h >= TIER_LINES['A'] else 'B' if detail_h >= TIER_LINES['B'] else 'C'
    fps = p['fps']
    hits, period = ([], None)
    if 'play' in action:
        hits, period = find_hits(np.asarray(m['regionMotion']), fps)
    motion = np.asarray(m['motion'])
    energy = np.asarray(m['energy'])
    tags = sorted(set([kind, shot_type] + action + [c.lower().replace(' & ', '-').replace(' ', '-') for c in chars]
                      + (cat.get('tags', []) if cat else [])))
    notes = ov.get('notes', '')
    for c in m['cuts']:
        tail = '; the frames after it belong to the next shot, trim them' if c >= m['frames'] - 3 else ''
        notes = (notes + ' ' if notes else '') + f'Hard cut at f{c}{tail}.'
    if face_note:
        notes = (notes + ' ' if notes else '') + face_note
    elif not face_box and m['faceTried'] and chars and shot_type not in ('insert', 'detail'):
        notes = (notes + ' ' if notes else '') + 'No face measured; crops use ' + basis + '.'
    elif not m['faceTried'] and humans and not several:
        notes = (notes + ' ' if notes else '') + 'Face detector unavailable on this run.'
    rec = {
        'id': sid, 'aliases': aliases, 'catalogId': cat['id'] if cat else None, 'manifestId': man['id'] if man else None,
        'title': title, 'sha256': e['sha'],
        'src': ('/' + loc['local'][len('public/'):]) if 'local' in loc else ROUTE + loc['remote'],
        'proxy': None, 'rev': None, 'poster': None, 'proxyInfo': None,
        'status': status, 'catalogStatus': cat['status'] if cat else None, 'kind': kind,
        'category': cat['category'] if cat else 'Season plates',
        'characters': chars, 'stem': stem, 'roles': roles, 'shotType': shot_type, 'action': action,
        'lipSync': lip, 'audio': bool(p['audio']), 'tracking': face.get('track'),
        'width': w, 'height': h, 'fps': num(fps), 'duration': num(m['frames'] / fps), 'frames': m['frames'],
        'contentBox': cbox, 'uiBaked': dict(m['ui'], **({'label': ov['uiLabel']} if 'uiLabel' in ov else {})),
        'subjectBox': [int(round(v)) for v in subject] if subject else None,
        'faceBox': face_box, 'safeCrops': crops, 'cropBasis': basis, 'cropNotes': crop_notes,
        'sharpTier': tier, 'maxUpscale': TIER_U[tier], 'detailH': detail_h, 'lapvar': [num(v, 1) for v in m['lapvar']],
        'energy': b64u8(energy), 'energyMean': num(energy.mean() / 255, 3),
        'motion': {'mean': num(motion.mean(), 2), 'p90': num(np.percentile(motion, 90), 2)},
        'hits': hits, 'hitPeriod': num(period, 4) if period else None, 'cuts': m['cuts'],
        'loops': m['loops'],
        'reverseClass': rclass, 'reverseWhy': why, 'mirrorable': mirrorable, 'mirrorBlockers': blockers,
        'lumaTrack': b64u8(m['luma']),
        'rules': list(ov.get('rules', [])),
        'tags': tags, 'notes': notes.strip(),
        'overrides': sorted(k for k in ov.keys() if k not in ('notes', 'uiLabel')),
    }
    return rec


# ---------------------------------------------------------------------------
# Contact sheets
# ---------------------------------------------------------------------------
def contact_sheet(path, rec, m, out_dir):
    from PIL import Image, ImageDraw
    w, h = rec['width'], rec['height']
    n = rec['frames']
    idx = [int(round(k * (n - 1) / 7)) for k in range(8)]
    tw = 400
    th = even(tw * h / w)
    sel = '+'.join(f'eq(n\\,{i})' for i in idx)
    fr = decode(path, f"select='{sel}',scale={tw}:{th}:flags=area", tw, th)
    s = tw / w
    pad = 6
    head = 96
    sheet = Image.new('RGB', (4 * (tw + pad) + pad, head + 2 * (th + pad + 14) + 40), (245, 244, 240))
    dr = ImageDraw.Draw(sheet)

    def rect(d, r, col, wd=2):
        x, y, rw, rh = r
        d.rectangle([x * s + ox, y * s + oy, (x + rw) * s + ox - 1, (y + rh) * s + oy - 1], outline=col, width=wd)
    lines = [
        f"{rec['id']}   status {rec['status']} ({rec['catalogStatus'] or 'manifest'})   kind {rec['kind']}   {rec['shotType']}   {w}x{h} {rec['frames']}f",
        f"characters {', '.join(rec['characters']) or '-'}   stem {rec['stem']}   action {', '.join(rec['action'])}   lipSync {rec['lipSync']}",
        f"reverse {rec['reverseClass']} ({rec['reverseWhy']})   mirrorable {rec['mirrorable']} {rec['mirrorBlockers']}   tier {rec['sharpTier']} lapvar {rec['lapvar']}",
        f"face {rec['faceBox'] and rec['faceBox']['method']}   crops by {rec['cropBasis']}   hits {len(rec['hits'])}   cuts {rec['cuts']}   roles {rec['roles']}",
        f"cyan content   red face   magenta 9:16   yellow 1:1   green 16:9 (crop guides, not type)",
    ]
    for i, t in enumerate(lines):
        dr.text((pad, 6 + i * 17), t, fill=(20, 20, 20))
    for k, im in enumerate(fr):
        ox = pad + (k % 4) * (tw + pad)
        oy = head + (k // 4) * (th + pad + 14)
        sheet.paste(Image.fromarray(im), (ox, oy))
        dr.text((ox, oy + th + 1), f'f{idx[k]}', fill=(60, 60, 60))
        rect(dr, rec['contentBox'], (0, 200, 220))
        if rec['faceBox']:
            fb = rec['faceBox']
            rect(dr, [fb['x'], fb['y'], fb['w'], fb['h']], (230, 30, 30))
        if k == 0:
            rect(dr, rec['safeCrops']['9:16'], (220, 0, 220), 3)
            rect(dr, rec['safeCrops']['1:1'], (240, 200, 0), 2)
            rect(dr, rec['safeCrops']['16:9'], (60, 200, 60), 2)
    # energy and luma strips
    y0 = head + 2 * (th + pad + 14) + 4
    W = sheet.size[0] - 2 * pad
    e = np.asarray(m['energy'], np.float64) / 255
    L = np.asarray(m['luma'], np.float64) / 255
    for i in range(W):
        j = int(i * len(e) / W)
        dr.line([pad + i, y0 + 16, pad + i, y0 + 16 - e[j] * 16], fill=(30, 30, 30))
        v = int(L[j] * 255)
        dr.line([pad + i, y0 + 20, pad + i, y0 + 32], fill=(v, v, v))
    for hf in rec['hits']:
        x = pad + hf * W / len(e)
        dr.line([x, y0, x, y0 + 4], fill=(220, 0, 0))
    os.makedirs(out_dir, exist_ok=True)
    sheet.save(os.path.join(out_dir, rec['id'] + '.jpg'), quality=84)


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=os.path.join(ROOT, '.cache/videostudio'))
    ap.add_argument('--out', default=OUT, help="output path, or '-' for stdout")
    ap.add_argument('--sheets', help='write one contact sheet per shot into this folder')
    ap.add_argument('--only', help='comma-separated shot ids or aliases (output holds only these)')
    ap.add_argument('--no-cache', action='store_true', help='re-measure even if cached')
    ap.add_argument('--no-download', action='store_true')
    ap.add_argument('--jobs', type=int, default=2)
    args = ap.parse_args()
    if args.only and args.out == OUT:
        args.out = '-'  # a partial run never overwrites the committed index
    load_overrides()
    runtime = runtime_media()
    entries = collect_sources()
    if not haar():
        log('note: OpenCV not importable; human faceBox will be null. pip install opencv-python-headless')

    failures = []
    work = []
    for e in entries:
        man, cat = e['manifest'], e['catalog']
        sid = f'{man["id"]}-{e["sha"][:8]}' if man else cat['id']
        names = {sid, man and man['id'], cat and cat['id'], cat and base_id(cat['id'])}
        if args.only and not (names & set(args.only.split(','))):
            continue
        path, err = resolve(e, args.cache, not args.no_download)
        if err:
            failures.append({'id': sid, 'error': err})
            log(f'FAIL {sid}: {err}')
            continue
        crop = (man or {}).get('cropBottomPixels') or 0
        chars = norm_chars([man['character']] if man else (cat.get('cast') or []))
        robot = bool(set(chars) & ROBOTS) and len(chars) <= 1
        loc = source_location(e)
        track = TRACKING.get(os.path.basename(loc['local'])) if 'local' in loc else None
        work.append((e, path, (path, e['sha'], crop, robot, track, args.cache, not args.no_cache)))

    log(f'measuring {len(work)} shots ({len(failures)} failed to resolve)')
    with ProcessPoolExecutor(max_workers=max(1, args.jobs)) as ex:
        results = list(ex.map(measure_cached, [w[2] for w in work]))
    shots = []
    for (e, path, _), m in zip(work, results):
        rec = classify(e, m, runtime)
        shots.append(rec)
        if args.sheets:
            contact_sheet(path, rec, m, args.sheets)
    apply_proxy_manifest(shots)
    shots.sort(key=lambda r: (KIND_ORDER.get(r['kind'], 9), r['id']))
    meta = {
        'version': 1, 'analysis': ANALYSIS, 'fps': 24,
        'about': 'Video Studio shot index. Built by scripts/build-shot-index.py; proxies by scripts/build-videostudio-proxies.mjs. Rects are [x,y,w,h] in source pixels. energy and lumaTrack are base64 Uint8Array, one value per source frame.',
        'statusKey': {'C': 'current: approved and used by the live meeting room', 'A': 'available edit',
                      'S': 'source take: usable after review', 'E': 'earlier version: never selected',
                      'R': 'needs review: selected only with an override'},
        'counts': counts(shots), 'failures': failures,
    }
    write_index(meta, shots, args.out)
    log(f'wrote {len(shots)} shots to {args.out}' + (f'; {len(failures)} failures' if failures else ''))
    return 1 if failures else 0


KIND_ORDER = {'plate': 0, 'brand': 1, 'exact': 2, 'take': 3}


def counts(shots):
    c = {'shots': len(shots), 'byKind': {}, 'byCategory': {}, 'byStatus': {}, 'byCharacter': {}, 'withProxy': 0}
    for s in shots:
        for key, v in (('byKind', s['kind']), ('byCategory', s['category']), ('byStatus', s['status'])):
            c[key][v] = c[key].get(v, 0) + 1
        for ch in s['characters']:
            c['byCharacter'][ch] = c['byCharacter'].get(ch, 0) + 1
        c['withProxy'] += 1 if s['proxy'] else 0
    for key in ('byKind', 'byCategory', 'byStatus', 'byCharacter'):
        c[key] = dict(sorted(c[key].items()))
    return c


def apply_proxy_manifest(shots):
    """Keep proxy fields across rebuilds: read what the proxy builder wrote, or
    what the committed index already records (for proxies uploaded elsewhere)."""
    known = {}
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding='utf-8') as f:
                for s in json.load(f).get('shots', []):
                    if s.get('proxy'):
                        known[s['id']] = s
        except Exception:
            pass
    if os.path.exists(PROXY_MANIFEST):
        with open(PROXY_MANIFEST, encoding='utf-8') as f:
            pm = json.load(f)
        for sid, ent in pm.get('shots', {}).items():
            if ent.get('sha256'):
                known[sid] = {'proxy': ROUTE + ent['fwd'], 'rev': ROUTE + ent['rev'], 'poster': ROUTE + ent['poster'],
                              'proxyInfo': ent['info'], 'sha256': ent['sha256']}
    for s in shots:
        k = known.get(s['id'])
        if k and k.get('sha256') == s['sha256']:
            for f in ('proxy', 'rev', 'poster', 'proxyInfo'):
                s[f] = k[f]


if __name__ == '__main__':
    sys.exit(main())
