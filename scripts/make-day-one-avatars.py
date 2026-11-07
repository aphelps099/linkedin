#!/usr/bin/env python3
"""Day One's avatars: the default silhouette for most, then pictures people really use, no faces.

A real "Congrats on the new role!" crowd is largely photo-less, so 57% of the rows keep the default
silhouette (drawn in CSS, not here): the one-tap commenters, Doug, the anniversary comment and the
viewer among them. The rest, each matched to its owner's headline where it can be:
  - footage: close crops of the project's own footage that read as a person doing a thing (hands on
    keys, a hand on a fretboard, sticks, clapping hands, a camera operator seen from behind). Every
    one comes from a shot in src/videostudio/media/shots.json that is an Office scene or an
    Instrument with faceBox null and no Pat, and each box was checked by eye for no face, no
    lettering and no LinkedIn mark (noFace in avatars.json).
  - drawn (scripts/day_one_drawn_avatars.py): people from behind (at a window, in a park, on a trail,
    on a summit), a sunset, a skyline, a green, graduation caps, a sailboat, a peony, a latte, and
    three small-business marks for the owners whose headlines name a business. Never initials.
  - Jamie: a portrait from behind at a sunlit window, drawn at 288 px (her 48 px lockup is sharp).
No image is used more than twice, and never twice within 16 rows (so never twice on screen, even at
the wall). Recruiters and Open to Work commenters wear their ring on a silhouette or a portrait.

    python3 scripts/make-day-one-avatars.py   # writes public/films/day-one/avatars/*.jpg
                                              # and src/films/day-one/avatars.json
Needs ffmpeg, Pillow, numpy and scipy, and the 540p proxies for the footage crops.
Deterministic: the same footage and seeds give the same files.
"""
import io, json, os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import day_one_drawn_avatars as D  # noqa: E402

SHOTS = json.load(open(os.path.join(ROOT, 'src/videostudio/media/shots.json')))['shots']
OUT = os.path.join(ROOT, 'public/films/day-one/avatars')
MANIFEST = os.path.join(ROOT, 'src/films/day-one/avatars.json')
SCRIPT = os.path.join(ROOT, 'src/films/day-one/script.json')
PROXIES = os.path.join(ROOT, 'public/videostudio/proxies')

# id: (shot id, time s, [x, y, size] in the 540p proxy's pixels, what it shows)
FOOTAGE = {
    'keys-hands':  ('keys-office-performance-87b9564e', 3.0, [440, 352, 188], 'hands on a keyboard'),
    'fret-hand':   ('blue-guitar-detail-a8838477', 3.0, [646, 150, 168], 'a hand on a fretboard'),
    'guitar-body': ('blue-guitar-detail-a8838477', 3.0, [118, 296, 205], 'a hand strumming a blue guitar'),
    'sticks':      ('drummer-arrival-performance-c2bf484a', 3.0, [432, 300, 150], 'a hand with drumsticks'),
    'clap-1':      ('corporate-applause-closer-reaction-531fa4a4', 3.0, [448, 292, 124], 'clapping hands'),
    'camera-op':   ('corporate-applause-vhs-cameraman-a018b1c9', 5.0, [0, 8, 196], 'a camera operator seen from behind'),
}

# Who wears what (rows of script.json). Everyone else: the silhouette.
ASSIGN = {
    1: 'mark-loaf',        # Dana Whitfield, Owner at Second Rise Bakery
    3: 'peony',            # Rose Okafor (Mom), Retired School Nurse
    5: 'latte',            # Tess Moreno, Shift Lead at Second Rise Bakery
    6: 'park-woman',       # Nadia Ferrante, People Partner at Brightwick
    8: 'city-night',       # Sunil Varghese, Senior Software Engineer
    10: 'golf',            # Gregory Pham, Regional Sales Manager ("Congrats, Jordan!")
    11: 'summit-day',      # Derek Fenwick, 2x Founder
    14: 'grad-caps',       # Lauren Pike, Student at Merrow State
    15: 'window-man',      # Kyle Henshaw, Senior Talent Partner (#Hiring)
    17: 'sunset-sea',      # Bianca Ferreira, Fractional CMO
    19: 'fret-hand',       # Ines Duarte, Product Designer
    20: 'camera-op',       # Devon Marchetti, Keynote Speaker, personal brands
    22: 'clap-1',          # Sofia Lindgren, Head of People
    24: 'sailboat',        # Rob Castellanos, Regional VP, Sales
    32: 'hiker',           # Samuel Adeyemi, Growth, Ex-Founder
    35: 'summit-dawn',     # Erin McAllister, Teacher
    38: 'mark-ramplight',  # Brett Lorimer, Account Executive at Ramplight (the vendor)
    39: 'sunset-sea',      # Wade Tolliver, Gym Owner, Father of 3
    42: 'park-woman',      # Rosa Quintero, Nurse Practitioner
    43: 'golf',            # Trevor Lindahl, Mortgage Loan Officer
    52: 'grad-caps',       # Grace Obi, Sophomore at Merrow State
    53: 'summit-dawn',     # Neil Varma-Hollis, Futurist
    55: 'mark-leaf',       # Scott Dumont, Owner, Dumont Landscaping
    56: 'fret-hand',       # Jessica Tran, Brand Strategist, Storyteller
    60: 'hiker',           # Eli Navarrete, Student
    64: 'sticks',          # Hiro Matsunaga, Product @ Lumaro
    68: 'summit-day',      # Chris Mbatha, Founder, Investor, Dad
    71: 'guitar-body',     # Kelsey Ward, Barista, Aspiring Marketer
    73: 'office-woman',    # Monica Strauss, VP of Sales at Wexley
    75: 'keys-hands',      # Dmitri Arkhipenko, QA Engineer
    77: 'camera-op',       # Tariq Benali, Financial Advisor
    79: 'peony',           # Terri Lynn Baxter, Retired Realtor, Proud Grandma of 6 (the typo)
}


def shot(sid):
    for s in SHOTS:
        if s['id'] == sid: return s
    sys.exit(f'No shot {sid} in shots.json')


def frame(s, t):
    path = os.path.join(PROXIES, os.path.basename(s['proxy']))
    png = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', path,
                          '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(png)).convert('RGB')


def save(im, fn):
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=92, optimize=False, progressive=False, subsampling=0)
    open(os.path.join(OUT, fn), 'wb').write(buf.getvalue())


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.jpg'): os.remove(os.path.join(OUT, f))
    made = {}
    for cid, (sid, t, (x, y, size), what) in FOOTAGE.items():
        s = shot(sid)
        assert s['faceBox'] is None, f'{sid} has a face box'
        assert s['category'] in ('Office scenes', 'Instruments'), f'{sid} is {s["category"]}'
        assert 'Pat' not in s['characters'], f'{sid} shows Pat'
        im = frame(s, t)
        W, H = im.size
        box = (max(0, x), max(0, y), min(W, x + size), min(H, y + size))
        save(im.crop(box).resize((96, 96), Image.LANCZOS), f'{cid}-96.jpg')
        made[cid] = {'kind': 'footage', 'shot': sid, 'title': s['title'], 'category': s['category'], 'faceBox': s['faceBox'], 'noFace': True,
                     'what': what, 'time': t, 'box': list(box), 'proxy': os.path.basename(s['proxy']), 'files': {'96': f'{cid}-96.jpg'}}
    for cid, (fn, what) in D.DRAWN.items():
        files = {}
        if cid == 'jamie':
            big = fn(288)
            for px in (96, 144):
                save(big.resize((px, px), Image.LANCZOS), f'{cid}-{px}.jpg'); files[str(px)] = f'{cid}-{px}.jpg'
        else:
            save(fn(), f'{cid}-96.jpg'); files['96'] = f'{cid}-96.jpg'
        made[cid] = {'kind': 'drawn', 'genre': cid, 'what': what, 'files': files}

    script = json.load(open(SCRIPT))
    assign = {}
    for row in script['rows']:
        if row['kind'] == 'ui': continue
        n = row['n']
        assign[str(n)] = 'jamie' if row['name'].startswith('Jamie ') else ASSIGN.get(n, 'silhouette')
    used = {v for v in assign.values() if v != 'silhouette'}
    unused = [k for k in made if k not in used]
    for k in unused:                                    # ship only what a row wears
        for f in made[k]['files'].values(): os.remove(os.path.join(OUT, f))
        del made[k]
    json.dump({'about': 'Day One\'s avatars: ' + __doc__.strip().splitlines()[0].split(': ', 1)[1], 'crops': made, 'assign': assign,
               'viewer': 'silhouette'}, open(MANIFEST, 'w'), indent=1, ensure_ascii=False)
    sil = sum(1 for v in assign.values() if v == 'silhouette')
    print(f'{len(made)} images ({sum(1 for m in made.values() if m["kind"] == "footage")} footage), {len(assign)} rows, '
          f'{sil} silhouettes ({sil / len(assign):.0%}); unused: {unused}')


if __name__ == '__main__':
    main()
