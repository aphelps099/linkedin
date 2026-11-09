"""Day One's drawn avatars: small pictures that read as photos at 32 px, with no face in any of them.

The kinds of profile picture people use when they do not use a headshot: a view from behind (at a
window, in a park, on a trail, on a summit), a sunset, a skyline, a golf course, a flower, a latte,
graduation caps, a sailboat; and three small-business marks for the owners whose headlines name a
business (a loaf, a leaf, a product's mark). Never initials. Jamie's is a portrait from behind at a
sunlit window, drawn at 288 px so her 48 px lockup avatar is sharp.

Each picture is painted at 4x on a numpy canvas (gradients, anti-aliased shapes, depth-of-field blur),
then given a photograph's grain and a slight vignette, and saved as JPEG. Deterministic: seeded noise.
Used by scripts/make-day-one-avatars.py.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 384          # working size (4x the 96 px file)


def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


class Canvas:
    def __init__(self, size=S, seed=1):
        self.n = size
        self.a = np.zeros((size, size, 3), float)
        self.rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:size, 0:size]
        self.x = (xx + .5) / size
        self.y = (yy + .5) / size

    # -- fills
    def vgrad(self, stops):
        """stops: [(y, '#hex'), ...] top to bottom."""
        ys = [p for p, _ in stops]
        cs = np.array([rgb(c) for _, c in stops])
        for k in range(3):
            self.a[..., k] = np.interp(self.y, ys, cs[:, k])
        return self

    def glow(self, cx, cy, r, color, amount=1.0, power=2.0):
        d = np.sqrt((self.x - cx) ** 2 + (self.y - cy) ** 2) / r
        w = np.clip(1 - d, 0, 1) ** power * amount
        self.a = self.a * (1 - w[..., None]) + rgb(color) * w[..., None]
        return self

    def mask(self, draw_fn, blur=0.0):
        """An anti-aliased mask in [0, 1]: draw_fn(draw, scale) draws in unit coordinates x scale (4x supersampled)."""
        big = self.n * 4
        m = Image.new('L', (big, big), 0)
        draw_fn(ImageDraw.Draw(m), big)
        m = m.resize((self.n, self.n), Image.LANCZOS)
        if blur:
            m = m.filter(ImageFilter.GaussianBlur(blur * self.n))
        return np.asarray(m, float) / 255

    def paint(self, m, color, alpha=1.0):
        c = rgb(color) if isinstance(color, str) else color
        w = (m * alpha)[..., None]
        self.a = self.a * (1 - w) + c * w
        return self

    def shade(self, m, top, bottom, axis='y', alpha=1.0, lo=0.0, hi=1.0):
        """Paint mask m with a gradient from `top` to `bottom` along y (or x) between lo and hi."""
        t = np.clip(((self.y if axis == 'y' else self.x) - lo) / (hi - lo), 0, 1)[..., None]
        c = rgb(top) * (1 - t) + rgb(bottom) * t
        w = (m * alpha)[..., None]
        self.a = self.a * (1 - w) + c * w
        return self

    def blur(self, r):
        im = Image.fromarray(np.clip(self.a, 0, 255).astype(np.uint8))
        self.a = np.asarray(im.filter(ImageFilter.GaussianBlur(r * self.n)), float)
        return self

    def texture(self, m, amount, scale=0.01, streak=None):
        """Noise inside m (hair, knit, grass): streak=(angle) blurs it along a direction."""
        z = self.rng.normal(0, 1, (self.n, self.n))
        im = Image.fromarray(np.clip(z * 40 + 128, 0, 255).astype(np.uint8))
        im = im.filter(ImageFilter.GaussianBlur(max(.4, scale * self.n)))
        if streak is not None:
            im = im.rotate(-streak, resample=Image.BILINEAR, expand=False)
            im = im.resize((self.n, max(4, self.n // 8)), Image.BILINEAR).resize((self.n, self.n), Image.BILINEAR)
            im = im.rotate(streak, resample=Image.BILINEAR, expand=False)
        z = (np.asarray(im, float) - 128) / 40
        self.a = self.a + (z * amount * m)[..., None]
        return self

    def finish(self, out_size=96, grain=3.2, vignette=.10, warm=None):
        a = self.a
        if warm:
            a = a * np.array(warm)[None, None, :]
        d = np.sqrt((self.x - .5) ** 2 + (self.y - .5) ** 2) / .7071
        a = a * (1 - vignette * d[..., None] ** 2)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((out_size, out_size), Image.LANCZOS)
        b = np.asarray(im, float)
        g = self.rng.normal(0, grain, (out_size, out_size, 1)) + self.rng.normal(0, grain * .35, (out_size, out_size, 3))
        return Image.fromarray(np.clip(b + g, 0, 255).astype(np.uint8))


def ellipse(cx, cy, rx, ry):
    return lambda d, s: d.ellipse([(cx - rx) * s, (cy - ry) * s, (cx + rx) * s, (cy + ry) * s], fill=255)


def poly(pts):
    return lambda d, s: d.polygon([(x * s, y * s) for x, y in pts], fill=255)


def rect(x0, y0, x1, y1, r=0):
    return lambda d, s: d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=r * s, fill=255)


def union(*fns):
    def f(d, s):
        for fn in fns:
            fn(d, s)
    return f


def ridge(rng, y0, amp, rough, seed_shift=0, peaks=None):
    """A mountain ridge polygon (to the bottom) as unit points."""
    xs = np.linspace(-.02, 1.02, 90)
    ys = np.full_like(xs, y0)
    for k, (f, a) in enumerate([(1.3, 1), (2.9, .45), (6.1, .22), (13, .09)]):
        ph = rng.uniform(0, 2 * math.pi)
        ys -= amp * a * np.sin(xs * f * math.pi + ph)
    ys += rng.normal(0, rough, xs.shape)
    if peaks:
        for px, ph, pw in peaks:
            ys -= ph * np.clip(1 - np.abs(xs - px) / pw, 0, 1) ** 1.3
    return [(x, y) for x, y in zip(xs, ys)] + [(1.02, 1.02), (-.02, 1.02)]


# ---------------------------------------------------------------------------------------------------
# People from behind

def bezier(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in np.linspace(0, 1, n)]


def volume(c, m, dark, light, L, *, rim=None, rim_amount=.0, flat=.35, tex=0.0, tex_scale=.003, streak=None, sheen=None):
    """Paint mask m as a rounded volume lit from L (x, y, z): a normal from the mask's distance field,
    Lambert between `dark` and `light`, a rim of `rim` where the surface turns toward the light."""
    from scipy.ndimage import distance_transform_edt, gaussian_filter
    inside = m > .5
    if not inside.any():
        return
    d = distance_transform_edt(inside)
    h = np.sqrt(d / max(d.max(), 1e-6))
    h = gaussian_filter(h, 1.2)
    gy, gx = np.gradient(h)
    k = 9.0
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / norm, ny / norm, nz / norm
    lx, ly, lz = L
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    lam = np.clip((nx * lx + ny * ly + nz * lz) / ln, 0, 1)
    lam = flat + (1 - flat) * lam
    col = rgb(dark)[None, None, :] * (1 - lam[..., None]) + rgb(light)[None, None, :] * lam[..., None]
    if tex:
        z = c.rng.normal(0, 1, (c.n, c.n))
        im = Image.fromarray(np.clip(z * 40 + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(.4, tex_scale * c.n)))
        if streak is not None:
            im = im.rotate(-streak, resample=Image.BILINEAR).resize((c.n, max(4, c.n // 10)), Image.BILINEAR).resize((c.n, c.n), Image.BILINEAR).rotate(streak, resample=Image.BILINEAR)
        z = (np.asarray(im, float) - 128) / 40
        col = col * (1 + tex * z)[..., None]
    if sheen is not None:
        sy, sw, sa = sheen
        band = np.exp(-((c.y - sy) / sw) ** 2) * sa
        col = col + (255 - col) * band[..., None] * lam[..., None]
    if rim is not None and rim_amount:
        facing = np.clip((nx * lx + ny * ly) / math.sqrt(lx * lx + ly * ly), 0, 1) * (1 - nz)
        r = np.clip(facing * 3.2, 0, 1) ** 1.5 * rim_amount
        col = col * (1 - r[..., None]) + rgb(rim) * r[..., None]
    w = m[..., None]
    c.a = c.a * (1 - w) + col * w


def figure_back(c, cx, top, W, *, hair, hair_dark, hair_light, skin, skin_dark, cloth, cloth_dark, collar=None, collar_dark=None,
                L=(-.7, -.35, .6), rim='#FFE6C0', rim_amount=.5, shoulders=1.0, hair_tex=.22):
    """Head and shoulders seen from behind, lit from L. W: the head's width (unit); top: the crown's y."""
    hy, rx, ry = top + .62 * W, .5 * W, .62 * W
    ys = top + 1.5 * W                                    # the shoulder line at the neck
    sh = 1.5 * W * shoulders
    left = bezier((cx - .3 * W, ys - .04 * W), (cx - .7 * W, ys + .06 * W), (cx - sh, ys + .5 * W)) + \
           bezier((cx - sh, ys + .5 * W), (cx - sh - .16 * W, ys + .72 * W), (cx - sh - .2 * W, 1.08))
    right = [(2 * cx - x, y) for x, y in reversed(left)]
    torso = c.mask(poly(left + [(cx - sh - .25 * W, 1.1), (cx + sh + .25 * W, 1.1)] + right), blur=.0015)
    volume(c, torso, cloth_dark, cloth, L, rim=rim, rim_amount=rim_amount * .7, flat=.4, tex=.05, tex_scale=.002)
    # the spine's shallow crease
    c.paint(c.mask(rect(cx - .012 * W, ys + .1 * W, cx + .012 * W, 1.1), blur=.01) * torso, cloth_dark, alpha=.35)
    neck = c.mask(poly([(cx - .25 * W, hy + .3 * W), (cx + .25 * W, hy + .3 * W), (cx + .33 * W, ys + .06 * W), (cx - .33 * W, ys + .06 * W)]), blur=.001)
    volume(c, neck, skin_dark, skin, L, rim=rim, rim_amount=rim_amount * .5, flat=.45)
    # neck shadow under the hair
    c.paint(c.mask(ellipse(cx, hy + .5 * W, .3 * W, .16 * W), blur=.012) * neck, skin_dark, alpha=.6)
    if collar:
        band = c.mask(poly(bezier((cx - .4 * W, ys + .02 * W), (cx, ys - .16 * W), (cx + .4 * W, ys + .02 * W)) +
                           list(reversed(bezier((cx - .45 * W, ys + .14 * W), (cx, ys - .02 * W), (cx + .45 * W, ys + .14 * W))))), blur=.001)
        volume(c, band, collar_dark or collar, collar, L, flat=.55)
    if hair == 'short':
        for sgn in (-1, 1):
            ear = c.mask(ellipse(cx + sgn * .49 * W, hy + .06 * W, .085 * W, .15 * W), blur=.001)
            volume(c, ear, skin_dark, skin, L, flat=.5)
        nape = c.mask(ellipse(cx, hy + .12 * W, .43 * W, .5 * W))
        volume(c, nape, skin_dark, skin, L, flat=.45)
        cap = c.mask(union(ellipse(cx, hy - .05 * W, .5 * W, .58 * W), ellipse(cx, hy + .22 * W, .4 * W, .25 * W)), blur=.002)
        volume(c, cap, hair_dark, hair_light, L, rim=rim, rim_amount=rim_amount * .6, flat=.3, tex=hair_tex * .6, tex_scale=.0015, streak=85)
        return
    shape = [ellipse(cx, hy, rx, ry)]
    if hair == 'bob':
        shape.append(poly(bezier((cx - .5 * W, hy - .2 * W), (cx - .64 * W, hy + .45 * W), (cx - .5 * W, hy + .8 * W)) +
                          bezier((cx - .5 * W, hy + .8 * W), (cx, hy + .9 * W), (cx + .5 * W, hy + .8 * W)) +
                          bezier((cx + .5 * W, hy + .8 * W), (cx + .64 * W, hy + .45 * W), (cx + .5 * W, hy - .2 * W))))
    if hair == 'long':
        shape.append(poly(bezier((cx - .5 * W, hy - .1 * W), (cx - .66 * W, ys + .2 * W), (cx - .5 * W, ys + .95 * W)) +
                          bezier((cx - .5 * W, ys + .95 * W), (cx, ys + 1.08 * W), (cx + .5 * W, ys + .95 * W)) +
                          bezier((cx + .5 * W, ys + .95 * W), (cx + .66 * W, ys + .2 * W), (cx + .5 * W, hy - .1 * W))))
    if hair == 'bun':
        shape.append(ellipse(cx + .03 * W, top + .16 * W, .29 * W, .25 * W))
    hm = c.mask(union(*shape), blur=.0015)
    lx = -1 if L[0] < 0 else 1
    fly = c.mask(lambda d, s_: [d.arc([(cx - rx * 1.06) * s_, (hy - ry * 1.04) * s_, (cx + rx * 1.06) * s_, (hy + ry * .9) * s_],
                                      start=a0, end=a0 + 22, fill=255, width=max(1, int(.0035 * s_))) for a0 in ((150, 172, 196, 214) if lx < 0 else (-34, -12, 8, 26))], blur=.0008)
    volume(c, hm, hair_dark, hair_light, L, rim=rim, rim_amount=rim_amount, flat=.25, tex=hair_tex, tex_scale=.0012, streak=80 if hair != 'bun' else 70,
           sheen=(hy - .1 * W, .1 * W, .18))
    c.paint(fly, rim, alpha=.35)
    if hair == 'bun':
        b = c.mask(ellipse(cx + .03 * W, top + .16 * W, .29 * W, .25 * W), blur=.001)
        volume(c, b, hair_dark, hair_light, L, rim=rim, rim_amount=rim_amount, flat=.25, tex=hair_tex * 1.2, tex_scale=.0012, streak=25)
        # a few loose strands at the nape
        c.paint(c.mask(lambda d, s: [d.line([( (cx + o * W) * s, (hy + .45 * W) * s), ((cx + o * W + .03 * W) * s, (hy + .78 * W) * s)], fill=255, width=max(1, int(.006 * s))) for o in (-.18, -.12, .16)]),
                hair_light, alpha=.5)
    if hair == 'ponytail':
        tail = c.mask(poly(bezier((cx - .13 * W, hy + .1 * W), (cx - .34 * W, ys + .1 * W), (cx - .06 * W, ys + .62 * W)) +
                           bezier((cx - .06 * W, ys + .62 * W), (cx + .26 * W, ys + .2 * W), (cx + .13 * W, hy + .1 * W))), blur=.002)
        volume(c, tail, hair_dark, hair_light, L, rim=rim, rim_amount=rim_amount, flat=.3, tex=hair_tex * 1.2, tex_scale=.0012, streak=92)
        c.paint(c.mask(ellipse(cx, hy + .14 * W, .11 * W, .05 * W)), hair_dark, alpha=.9)


def jamie(size=288):
    """Jamie: from behind at a sunlit window, morning light from the left, her hair up, an oatmeal sweater."""
    c = Canvas(S, seed=7)
    c.vgrad([(0, '#C9A27C'), (1, '#9C7354')])
    win = c.mask(rect(-.05, -.05, .44, .78, r=.01))
    c.shade(win, '#FFF6E4', '#FBE3BE', axis='y')
    # the window's frame and a mullion, soft (far behind her)
    c.paint(c.mask(rect(.27, -.05, .305, .78)), '#D9B994', alpha=.8)
    c.paint(c.mask(rect(-.05, .37, .44, .395)), '#D9B994', alpha=.7)
    c.paint(c.mask(rect(.43, -.05, .47, .82)), '#B38A66', alpha=.9)
    # a plant on the sill, out of focus
    for (x, y, r) in [(.08, .66, .07), (.15, .62, .06), (.04, .58, .05), (.19, .69, .05)]:
        c.paint(c.mask(ellipse(x, y, r, r * .8)), '#7C8A5A', alpha=.75)
    c.glow(.12, .25, .65, '#FFF3DA', amount=.45, power=1.6)
    c.blur(.016)
    figure_back(c, .6, .1, .37, hair='bun', hair_dark='#24150D', hair_light='#8C5F3A', skin='#E2B08E', skin_dark='#8F5E44',
                cloth='#EADBC4', cloth_dark='#8E7558', collar='#F6F1E8', collar_dark='#BDB2A2', L=(-.8, -.3, .55), rim='#FFE9C4', rim_amount=.7)
    c.glow(0, .25, .8, '#FFE7C2', amount=.16, power=1.2)
    c.blur(.002)
    return c.finish(size, grain=2.4, vignette=.12)


def window_man(seed=11):
    """A man from behind at an office window, a city in the haze, a navy jacket and a white collar."""
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#C9D6E0'), (.55, '#AFC0CE'), (1, '#7E8E9C')])
    for i in range(14):
        x = c.rng.uniform(-.05, 1.0); w = c.rng.uniform(.04, .1); h = c.rng.uniform(.18, .45)
        c.paint(c.mask(rect(x, .62 - h, x + w, .9)), ['#8D9DAB', '#9AA9B6', '#7F909F'][i % 3], alpha=.8)
    c.paint(c.mask(rect(.0, .58, 1, 1.0)), '#7A8794', alpha=.5)
    c.paint(c.mask(rect(.31, -.05, .335, 1.05)), '#55606B', alpha=.85)
    c.blur(.02)
    figure_back(c, .5, .13, .34, hair='short', hair_dark='#1E1814', hair_light='#5A4A3E', skin='#D29C7E', skin_dark='#7C5240',
                cloth='#3A4A63', cloth_dark='#141B27', collar='#F4F5F6', collar_dark='#AEB4BA', L=(.7, -.4, .6), rim='#EAF2FA', rim_amount=.45, shoulders=1.08)
    return c.finish(grain=3.0, vignette=.14)


def office_woman(seed=13):
    """A woman from behind at a bright window, a dark bob, a camel coat."""
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#EEF1F2'), (1, '#C7CFD3')])
    c.paint(c.mask(rect(.62, -.05, .66, 1.05)), '#9AA5AC', alpha=.7)
    for (x, y, r, col) in [(.15, .75, .1, '#A9B79A'), (.86, .78, .12, '#B7C2A6'), (.3, .82, .08, '#9EAF8C')]:
        c.paint(c.mask(ellipse(x, y, r, r)), col, alpha=.7)
    c.blur(.022)
    figure_back(c, .47, .12, .36, hair='bob', hair_dark='#120C09', hair_light='#4E3A2C', skin='#C48E70', skin_dark='#6E4534',
                cloth='#C29466', cloth_dark='#6E5034', L=(.6, -.5, .65), rim='#FFFFFF', rim_amount=.35)
    return c.finish(grain=3.0, vignette=.12)


def park_woman(seed=17):
    """A woman from behind in a park, a fair ponytail, a denim jacket, green bokeh."""
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#B8CFA0'), (.5, '#7E9F62'), (1, '#55703F')])
    for i in range(22):
        x, y, r = c.rng.uniform(0, 1), c.rng.uniform(0, .75), c.rng.uniform(.03, .09)
        c.paint(c.mask(ellipse(x, y, r, r)), ['#E4EFC9', '#C9DDA6', '#F4F6DC'][i % 3], alpha=c.rng.uniform(.25, .6))
    c.blur(.02)
    figure_back(c, .5, .12, .34, hair='ponytail', hair_dark='#6E4E28', hair_light='#E9CF9A', skin='#E8BB9B', skin_dark='#9A6A50',
                cloth='#6F8FB5', cloth_dark='#2E4766', collar='#8DA9C8', collar_dark='#4F6B8C', L=(-.6, -.6, .6), rim='#FFF8E0', rim_amount=.5)
    return c.finish(grain=3.0, vignette=.12)


def hiker(seed=19):
    """A figure from behind on a forest trail, an orange pack."""
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#D7E4DA'), (.45, '#7F9C84'), (1, '#4B5E46')])
    for i in range(26):
        x = c.rng.uniform(-.05, 1.05); w = c.rng.uniform(.015, .04)
        c.paint(c.mask(rect(x, -.05, x + w, .8)), ['#3F5141', '#56685A', '#2F3D31'][i % 3], alpha=c.rng.uniform(.4, .8))
    c.paint(c.mask(poly([(.38, .55), (.62, .55), (1.1, 1.05), (-.1, 1.05)])), '#9C8466', alpha=.85)
    c.blur(.012)
    fx, fy = .5, .5
    c.paint(c.mask(union(ellipse(fx, fy - .1, .032, .04), rect(fx - .06, fy - .06, fx + .06, fy + .1, r=.025),
                         rect(fx - .045, fy + .08, fx - .008, fy + .26, r=.012), rect(fx + .008, fy + .08, fx + .045, fy + .26, r=.012))), '#2C2A28')
    c.paint(c.mask(rect(fx - .055, fy - .07, fx + .055, fy + .06, r=.025)), '#D5732E')
    c.paint(c.mask(ellipse(fx, fy - .1, .032, .04)), '#3A2C22')
    c.glow(.5, .1, .7, '#F3F6EA', amount=.25)
    return c.finish(grain=3.2)


# ---------------------------------------------------------------------------------------------------
# Places

def summit(seed=23, dawn=False):
    c = Canvas(S, seed=seed)
    if dawn:
        c.vgrad([(0, '#5E6E9E'), (.35, '#D9A0A0'), (.55, '#F5C79A'), (1, '#F5C79A')])
        cols = ['#9C8AA6', '#6F6487', '#3E3852']
    else:
        c.vgrad([(0, '#3F7FC2'), (.5, '#9CC4E4'), (1, '#DDEBF3')])
        cols = ['#A9BCCF', '#6E87A0', '#34475A']
    rng = c.rng
    for i, (y0, amp, col, snow) in enumerate([(.5, .05, cols[0], False), (.62, .07, cols[1], not dawn), (.82, .05, cols[2], False)]):
        pk = [(.35, .12, .2)] if i == 1 else None
        m = c.mask(poly(ridge(rng, y0, amp, .003, peaks=pk)))
        c.paint(m, col)
        if snow:
            cap = c.mask(poly(ridge(np.random.default_rng(3), y0 - .02, amp * .6, .002, peaks=[(.35, .12, .2)])))
            c.paint(m * (1 - cap) * c.mask(rect(0, 0, 1, y0 - .07)), '#F2F5F8', alpha=.85)
    c.blur(.006)
    # the figure on the near rock, arms up
    fx, fy = .68, .72
    fig = c.mask(union(ellipse(fx, fy - .085, .018, .022), rect(fx - .022, fy - .065, fx + .022, fy + .03, r=.01),
                       poly([(fx - .02, fy - .055), (fx - .07, fy - .13), (fx - .06, fy - .135), (fx - .012, fy - .065)]),
                       poly([(fx + .02, fy - .055), (fx + .07, fy - .13), (fx + .06, fy - .135), (fx + .012, fy - .065)]),
                       rect(fx - .02, fy + .02, fx - .004, fy + .085), rect(fx + .004, fy + .02, fx + .02, fy + .085)))
    c.paint(fig, '#1C1F26')
    c.paint(c.mask(poly([(.45, .84), (.6, .79), (.8, .8), (1.05, .86), (1.05, 1.05), (.4, 1.05)])), '#232731')
    return c.finish(grain=2.8)


def sunset_sea(seed=29):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#3E3D73'), (.3, '#B2607A'), (.52, '#F29A62'), (.58, '#F7C27E'), (.6, '#D9875E'), (1, '#4A3550')])
    c.glow(.42, .57, .12, '#FFF0C8', amount=1, power=1.2)
    sea = c.mask(rect(0, .6, 1, 1))
    c.shade(sea, '#9A5568', '#2E2440', lo=.6, hi=1)
    streak = c.mask(poly([(.36, .6), (.48, .6), (.56, 1), (.28, 1)]), blur=.02)
    c.paint(streak * sea, '#F7B57A', alpha=.45)
    c.blur(.004)
    c.paint(c.mask(poly([(-.05, .9), (.4, .86), (1.05, .88), (1.05, 1.05), (-.05, 1.05)])), '#251C2E')
    fx, fy = .7, .76
    c.paint(c.mask(union(ellipse(fx, fy - .07, .016, .02), rect(fx - .02, fy - .05, fx + .02, fy + .05, r=.01),
                         rect(fx - .018, fy + .04, fx - .003, fy + .11), rect(fx + .003, fy + .04, fx + .018, fy + .11))), '#1E1626')
    return c.finish(grain=3.0)


def city_night(seed=31):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#0F1730'), (.6, '#27355C'), (1, '#121A2E')])
    for i in range(16):
        x = c.rng.uniform(-.05, 1.0); w = c.rng.uniform(.05, .12); h = c.rng.uniform(.25, .62)
        c.paint(c.mask(rect(x, .9 - h, x + w, 1.05)), ['#18213A', '#1F2A47', '#141B30'][i % 3])
        for j in range(int(h * 40)):
            wx, wy = c.rng.uniform(x + .01, x + w - .01), c.rng.uniform(.9 - h + .02, 1.0)
            if c.rng.uniform() < .55:
                c.paint(c.mask(rect(wx, wy, wx + .008, wy + .01)), ['#F6D38A', '#FBE7B5', '#A9C6F0'][j % 3], alpha=.9)
    c.blur(.012)
    for i in range(16):
        x, y, r = c.rng.uniform(0, 1), c.rng.uniform(.45, 1), c.rng.uniform(.025, .06)
        c.paint(c.mask(ellipse(x, y, r, r)), ['#F7C873', '#F3A35E', '#E8EEF8'][i % 3], alpha=c.rng.uniform(.25, .55))
    return c.finish(grain=3.4, vignette=.18)


def golf(seed=37):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#5E9BD6'), (.42, '#B9D7EE'), (.45, '#3E5A35'), (.55, '#5C8A3E'), (1, '#86B552')])
    trees = c.mask(poly(ridge(c.rng, .44, .025, .006)))
    c.paint(trees * c.mask(rect(0, 0, 1, .56)), '#2F4A2B')
    for i in range(6):
        y = .56 + i * .08
        c.paint(c.mask(poly([(-.1, y), (1.1, y + .03), (1.1, y + .07), (-.1, y + .04)])), '#9CC660' if i % 2 else '#78A845', alpha=.35)
    c.blur(.008)
    c.paint(c.mask(ellipse(.62, .74, .16, .045)), '#A8D46A', alpha=.8)
    c.paint(c.mask(rect(.615, .45, .623, .74)), '#F4F4F2')
    c.paint(c.mask(poly([(.623, .45), (.71, .48), (.623, .51)])), '#D8473A')
    c.paint(c.mask(ellipse(.62, .74, .012, .006)), '#2B3324')
    return c.finish(grain=2.8)


def grad_caps(seed=41):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#3E86CC'), (1, '#BCD8EF')])
    for (x, y, r) in [(.2, .75, .2), (.4, .82, .16), (.75, .8, .22), (.95, .7, .14)]:
        c.paint(c.mask(ellipse(x, y, r, r * .6)), '#F4F7FA', alpha=.8)
    c.blur(.02)
    for (x, y, s, rot) in [(.32, .32, .17, -18), (.68, .46, .21, 14), (.42, .68, .13, 30), (.8, .2, .11, -8)]:
        ang = math.radians(rot)
        pts = [(x + s * math.cos(ang + k * math.pi / 2) , y + s * .45 * math.sin(ang + k * math.pi / 2)) for k in range(4)]
        c.paint(c.mask(rect(x - s * .35, y, x + s * .35, y + s * .35, r=.01)), '#15171C')
        c.paint(c.mask(poly(pts)), '#202329')
        c.paint(c.mask(poly([(px, py - .006) for px, py in pts])), '#2E323A', alpha=.6)
        c.paint(c.mask(union(rect(x - .004, y, x + .004, y + s * .55), ellipse(x, y + s * .58, .012, .018))), '#E9B949')
    return c.finish(grain=2.6)


def sailboat(seed=43):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#8DB6DA'), (.55, '#DCE9F2'), (.56, '#2D6A92'), (1, '#173F5C')])
    for i in range(30):
        y = c.rng.uniform(.58, 1); x = c.rng.uniform(0, 1); w = c.rng.uniform(.05, .2)
        c.paint(c.mask(rect(x, y, x + w, y + .006)), '#8FB9D6', alpha=.5)
    c.blur(.004)
    c.paint(c.mask(poly([(.5, .14), (.5, .66), (.26, .66)])), '#F7F7F4')
    c.paint(c.mask(poly([(.53, .2), (.53, .66), (.72, .66)])), '#E9ECEE')
    c.paint(c.mask(rect(.497, .12, .533, .7)), '#3B3F45')
    c.paint(c.mask(poly([(.2, .68), (.8, .68), (.72, .75), (.28, .75)])), '#22303C')
    return c.finish(grain=2.6)


def peony(seed=47):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#5E7D4A'), (1, '#2F4527')])
    for (x, y, r) in [(.1, .2, .2), (.9, .85, .25), (.85, .1, .15)]:
        c.paint(c.mask(ellipse(x, y, r, r * .7)), '#7E9C5E', alpha=.6)
    c.blur(.03)
    cx, cy = .5, .52
    rng = c.rng
    for ring, (rad, n, col, dark) in enumerate([(.42, 9, '#F3B6C3', '#C7708A'), (.33, 8, '#F6C4CF', '#D27F96'), (.24, 7, '#F9D3DB', '#D98CA0'), (.14, 6, '#FBE1E6', '#E09BAE')]):
        for k in range(n):
            a = 2 * math.pi * k / n + ring * .4 + rng.uniform(-.15, .15)
            px, py = cx + math.cos(a) * rad * .45, cy + math.sin(a) * rad * .42
            m = c.mask(ellipse(px, py, rad * .55, rad * .42))
            c.shade(m, col, dark, axis='y', lo=py - rad * .4, hi=py + rad * .5)
    c.paint(c.mask(ellipse(cx, cy, .05, .045)), '#E9A3B5')
    c.blur(.003)
    return c.finish(grain=2.6)


def latte(seed=53):
    c = Canvas(S, seed=seed)
    c.vgrad([(0, '#7A5235'), (1, '#5A3A24')])
    for i in range(12):
        y = i / 12 + c.rng.uniform(-.02, .02)
        c.paint(c.mask(rect(-.05, y, 1.05, y + .012)), '#4A2E1C', alpha=.35)
    c.texture(np.ones((S, S)), 6, scale=.004, streak=0)
    c.paint(c.mask(ellipse(.5, .55, .36, .36), blur=.03), '#2E1C10', alpha=.45)          # its shadow on the table
    c.paint(c.mask(ellipse(.46, .5, .34, .34)), '#F1EEE8')                                 # the saucer
    c.paint(c.mask(ellipse(.46, .5, .25, .25)), '#FAF8F4')                                 # the cup
    c.paint(c.mask(ellipse(.46, .5, .205, .205)), '#B07A4C')
    c.glow(.46, .5, .205, '#8A5A34', amount=.5, power=1)
    heart = union(ellipse(.42, .46, .06, .056), ellipse(.5, .46, .06, .056), poly([(.362, .475), (.558, .475), (.46, .6)]))
    c.paint(c.mask(heart, blur=.004), '#F3E6D2')
    c.paint(c.mask(rect(.7, .46, .8, .54, r=.03)), '#EDEAE4')                              # the handle
    c.paint(c.mask(rect(.08, .78, .3, .8, r=.01)), '#C9C6C0', alpha=.9)                     # a spoon
    return c.finish(grain=2.4)


# ---------------------------------------------------------------------------------------------------
# Marks (small businesses): a flat ground and a simple mark, never initials

def mark_loaf():
    c = Canvas(S, seed=59)
    c.vgrad([(0, '#F3E7D3'), (1, '#EBDCC3')])
    loaf = c.mask(union(ellipse(.5, .52, .3, .2), rect(.2, .52, .8, .66, r=.04)))
    c.paint(loaf, '#8A4E25')
    for k in range(3):
        x = .36 + k * .13
        c.paint(c.mask(poly([(x - .02, .42), (x + .035, .4), (x + .09, .6), (x + .045, .62)])), '#E8C99A')
    c.paint(c.mask(rect(.18, .7, .82, .715)), '#8A4E25')
    return c.finish(grain=0.8, vignette=0)


def mark_leaf():
    c = Canvas(S, seed=61)
    c.vgrad([(0, '#2F5D3A'), (1, '#28513A')])
    leaf = c.mask(union(ellipse(.5, .46, .16, .27)))
    c.paint(leaf, '#F4F1E6')
    c.paint(c.mask(rect(.494, .3, .506, .78)), '#2F5D3A')
    for k in range(4):
        y = .36 + k * .085
        c.paint(c.mask(poly([(.5, y + .03), (.62, y - .03), (.63, y - .015), (.5, y + .045)])), '#2F5D3A')
        c.paint(c.mask(poly([(.5, y + .03), (.38, y - .03), (.37, y - .015), (.5, y + .045)])), '#2F5D3A')
    c.paint(c.mask(rect(.494, .7, .506, .8)), '#F4F1E6')
    return c.finish(grain=0.8, vignette=0)


def mark_ramplight():
    c = Canvas(S, seed=67)
    c.vgrad([(0, '#2C2F72'), (1, '#24275F')])
    c.paint(c.mask(poly([(.24, .72), (.68, .32), (.78, .42), (.34, .82)])), '#F5B33E')
    c.paint(c.mask(ellipse(.72, .28, .07, .07)), '#FFE3A1')
    c.paint(c.mask(rect(.22, .76, .78, .8)), '#F5B33E', alpha=.6)
    return c.finish(grain=0.8, vignette=0)


DRAWN = {
    'jamie': (jamie, 'Jamie: a portrait from behind at a sunlit window, her hair up, an oatmeal sweater (no face)'),
    'window-man': (window_man, 'a man from behind at an office window (no face)'),
    'office-woman': (office_woman, 'a woman from behind at a bright window, a dark bob (no face)'),
    'park-woman': (park_woman, 'a woman from behind in a park, a fair ponytail (no face)'),
    'hiker': (hiker, 'a small figure from behind on a forest trail'),
    'summit-day': (lambda: summit(23, False), 'a figure from behind on a summit, a blue sky'),
    'summit-dawn': (lambda: summit(29, True), 'a figure from behind on a summit at dawn'),
    'sunset-sea': (sunset_sea, 'a figure on a shore at sunset'),
    'city-night': (city_night, 'a skyline at night, out of focus'),
    'golf': (golf, 'a green and its flag'),
    'grad-caps': (grad_caps, 'graduation caps against the sky'),
    'sailboat': (sailboat, 'a sailboat'),
    'peony': (peony, 'a pink peony, close'),
    'latte': (latte, 'a latte from above'),
    'mark-loaf': (mark_loaf, 'a bakery\'s mark: a loaf (Second Rise Bakery)'),
    'mark-leaf': (mark_leaf, 'a landscaper\'s mark: a leaf (Dumont Landscaping)'),
    'mark-ramplight': (mark_ramplight, 'a software company\'s mark: a ramp and a light (Ramplight)'),
}
