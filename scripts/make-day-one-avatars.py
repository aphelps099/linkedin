#!/usr/bin/env python3
"""Day One's avatars: abstract crops of the project's own footage, no faces.

Every crop comes from a shot in src/videostudio/media/shots.json that is an Office scene or an
Instrument, has faceBox null, and never shows Pat (he has no footage). The boxes below were
chosen by eye on the 540p proxies to show hands, instruments, desks, mugs, lamps and ceilings:
no face, no LinkedIn mark, no lettering. Jamie gets a warm, sunlit close crop (coffee on the
counter, an echo of the bakery). About 35% of the commenters keep the default silhouette
(drawn in CSS, not here), the robot, Doug and the viewer among them.

    python3 scripts/make-day-one-avatars.py   # writes public/films/day-one/avatars/*.jpg
                                              # and src/films/day-one/avatars.json
Needs ffmpeg and Pillow. Deterministic: the same footage gives the same files.
"""
import json, random, subprocess, io, os, sys
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = json.load(open(os.path.join(ROOT, 'src/videostudio/media/shots.json')))['shots']
OUT = os.path.join(ROOT, 'public/films/day-one/avatars')
MANIFEST = os.path.join(ROOT, 'src/films/day-one/avatars.json')
SCRIPT = os.path.join(ROOT, 'src/films/day-one/script.json')
PROXIES = os.path.join(ROOT, 'public/videostudio/proxies')

# id: (shot id, time s, [x, y, size] in the 540p proxy's pixels, grade)
CROPS = {
  'guitar-body':   ('blue-guitar-detail-a8838477', 3.0, [118, 296, 205], None),
  'guitar-head':   ('blue-guitar-detail-a8838477', 3.0, [812, 108, 148], None),
  'fret-hand':     ('blue-guitar-detail-a8838477', 3.0, [646, 150, 168], None),
  'desk-mug':      ('drummer-arrival-performance-c2bf484a', 3.0, [782, 272, 160], None),
  'sticks':        ('drummer-arrival-performance-c2bf484a', 3.0, [432, 300, 150], None),
  'office-window': ('drummer-arrival-performance-c2bf484a', 3.0, [52, 40, 190], None),
  'lamp':          ('keys-office-performance-87b9564e', 3.0, [712, 138, 170], None),
  'grey-mug':      ('keys-office-performance-87b9564e', 3.0, [760, 368, 172], None),
  'keys-hands':    ('keys-office-performance-87b9564e', 3.0, [440, 352, 188], None),
  'ceiling':       ('keys-office-performance-87b9564e', 3.0, [540, 8, 180], None),
  'notebook':      ('office-ensemble-e03c9edb', 3.0, [98, 300, 138], None),
  'blue-guitar':   ('office-ensemble-e03c9edb', 3.0, [818, 178, 140], None),
  'coffee-maker':  ('printer-outward-feed-19442475', 3.0, [44, 0, 214], None),
  'printer-leds':  ('printer-outward-feed-19442475', 3.0, [672, 150, 180], None),
  'woodgrain':     ('printer-outward-feed-19442475', 3.0, [742, 372, 168], None),
  'clap-1':        ('corporate-applause-closer-reaction-531fa4a4', 3.0, [448, 292, 124], None),
  'clap-2':        ('corporate-applause-closer-reaction-531fa4a4', 3.0, [744, 262, 128], None),
  'drum-pads':     ('drum-pad-detail-98b121e8', 3.0, [300, 290, 250], None),
  'shirt-pocket':  ('drum-pad-detail-98b121e8', 3.0, [520, 20, 200], None),
  'keys-detail':   ('keys-detail-92cca3c3', 3.0, [420, 0, 256], None),
  'corridor':      ('the-professionals-arrive-32aba023', 3.0, [0, 0, 230], None),
  'cabinet':       ('the-professionals-arrive-32aba023', 3.0, [1350 // 2, 140, 190], None),
  # Jamie: the mugs by the coffee maker, warmed into morning light.
  'jamie':         ('printer-outward-feed-19442475', 3.0, [474, 0, 118], 'sunlit'),
}

def shot(sid):
    for s in SHOTS:
        if s['id'] == sid: return s
    sys.exit(f'No shot {sid} in shots.json')

def frame(s, t):
    name = os.path.basename(s['proxy'])
    path = os.path.join(PROXIES, name)
    png = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', path,
                          '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(png)).convert('RGB')

def sunlit(im):
    """A warm, low-contrast morning grade with light falling from the upper left."""
    im = ImageEnhance.Color(im).enhance(.85)
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.10 + 14)))
    g = g.point(lambda v: min(255, int(v * 1.00 + 6)))
    b = b.point(lambda v: int(v * .80))
    im = Image.merge('RGB', (r, g, b))
    w, h = im.size
    glow = Image.new('L', (w, h))
    gp = glow.load()
    for y in range(h):
        for x in range(w):
            d = ((x / w) ** 2 + (y / h) ** 2) ** .5
            gp[x, y] = int(max(0, 1 - d / 1.25) ** 1.6 * 120)
    light = Image.new('RGB', (w, h), (255, 214, 150))
    im = Image.composite(light, im, glow)
    return ImageEnhance.Contrast(im).enhance(.92)

def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    for cid, (sid, t, (x, y, size), grade) in CROPS.items():
        s = shot(sid)
        assert s['faceBox'] is None, f'{sid} has a face box'
        assert s['category'] in ('Office scenes', 'Instruments'), f'{sid} is {s["category"]}'
        assert 'Pat' not in s['characters'], f'{sid} shows Pat'
        im = frame(s, t)
        W, H = im.size
        box = (max(0, x), max(0, y), min(W, x + size), min(H, y + size))
        c = im.crop(box)
        c = c.resize((144, 144), Image.LANCZOS)
        if grade == 'sunlit': c = sunlit(c)
        sizes = [96, 144] if cid == 'jamie' else [96]
        files = {}
        for px in sizes:
            out = c if px == 144 else c.resize((px, px), Image.LANCZOS)
            fn = f'{cid}-{px}.jpg'
            buf = io.BytesIO(); out.save(buf, 'JPEG', quality=92, optimize=False, progressive=False, subsampling=0)
            open(os.path.join(OUT, fn), 'wb').write(buf.getvalue())
            files[px] = fn
        made[cid] = {'shot': sid, 'title': s['title'], 'category': s['category'], 'faceBox': s['faceBox'],
                     'time': t, 'box': list(box), 'proxy': os.path.basename(s['proxy']), 'grade': grade, 'files': files}

    # Assignment: about 35% silhouettes (seeded), forced for the robot, Doug and the viewer;
    # frames always on a photo; no crop repeats within 12 rows.
    script = json.load(open(SCRIPT))
    rnd = random.Random(1204)
    pool = [c for c in CROPS if c != 'jamie']
    rnd.shuffle(pool)
    # The warm block (her people) by hand: the bakery's owner and shift lead in the bakery's colours,
    # Mom without a photo (as many parents' profiles are), the professor with a notebook.
    WARM = {1: 'coffee-maker', 3: 'silhouette', 4: 'silhouette', 6: 'notebook', 7: 'office-window',
            8: 'silhouette', 9: 'woodgrain', 10: 'silhouette', 11: 'desk-mug'}
    assign, recent, i = {}, [], 0
    for row in script['rows']:
        if row['kind'] == 'ui': continue
        n, name = row['n'], row['name']
        if name.startswith('Jamie '): a = 'jamie'
        elif n in WARM: a = WARM[n]
        elif n in (70, 94): a = 'silhouette'
        elif row.get('frame'): a = None
        else: a = 'silhouette' if rnd.random() < .43 else None
        if a not in (None, 'silhouette', 'jamie'): recent.append(a)
        if a is None:
            while pool[i % len(pool)] in recent[-11:]: i += 1
            a = pool[i % len(pool)]; i += 1
            recent.append(a)
        assign[str(n)] = a
    json.dump({'about': __doc__.strip().splitlines()[0], 'crops': made, 'assign': assign,
               'viewer': 'silhouette'}, open(MANIFEST, 'w'), indent=1)
    sil = sum(1 for v in assign.values() if v == 'silhouette')
    print(f'{len(made)} crops, {len(assign)} rows, {sil} silhouettes ({sil / len(assign):.0%})')

if __name__ == '__main__':
    main()
