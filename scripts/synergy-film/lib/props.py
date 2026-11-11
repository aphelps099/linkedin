"""Props for the Long Room (E2_LONG_ROOM) and the macro inserts (E3_MACRO_INSERTS).

Everything here is modelled from nothing in Python: beige 1980s CRT terminals
that sit in charcoal office chairs, the 1990s laser printer and its paper
stack, the paper droid and its trolley of reams, the problem objects (hero
padlock, glass zero, envelopes, acrylic tabs, binder), the black starfish
conference hub, the brass socket and gold 3.5 mm jack, yellow coiled cords
(a geometry-nodes helix on a curve) and the hero cup and lid.

Conventions: metres, Z up, every builder returns a handle (a small class or a
dict) whose objects the shot scripts animate. Builders are deterministic
(seeded RNG). Hard edges get real bevels; surface life (fingerprints,
scratches, grain, weave) comes from procedural roughness and bump. Nothing
carries text, numbers or logos.

Animated state lives in keyframed object custom properties that materials
read with Attribute nodes (type Object), so one material serves every CRT
screen or LED. Light energies follow those properties through simple-
expression drivers (no Python needed at render time).
"""

import colorsys
import math
import random
import zlib

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common as C

# ================================================================== palette


def srgb(hexstr):
    """'#E3D2B4' -> linear RGB tuple."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# The colleagues, as screen colours (sRGB hex from the treatment).
TERMINAL_HEX = {
    'synthia': '#fbf6e8', 'keys': '#0757ec', 'kevin': '#b8d7fb', 'operations': '#ff814f',
    'pat': '#8a8a8a', 'arjun': '#e5ff8d', 'strategy': '#fff349', 'people': '#ffb9dc',
    'linda': '#8a2433',
}

# Screen calibration under the film's view (AgX, Medium High Contrast). An emission-patch
# sweep (tools: scratchpad crt calib, CIELAB dE76 displayed vs TERMINAL_HEX) picked a
# saturation boost about luma, an emission level and an HSV hue push per colleague.
# Bright saturated yellows sit outside what AgX can display: acid yellow bottoms out at
# dE ~26 and lime at ~15 (the best chroma at a readable level is used for both). A sweep of
# every field colour x level (r2fix/view_sweep.py) gives these floors per view transform:
#   AgX Medium High Contrast  strategy 26.5  arjun 15.1  keys/cobalt 10.6
#   AgX High Contrast         strategy 22.7  arjun 12.5  keys/cobalt 10.6
#   Khronos PBR Neutral       strategy  3.2  arjun  1.9  keys/cobalt  2.3
# so the view transform (common.new_scene) decides whether the acid yellow can read. Until the
# view is changed, the acid yellow and the lime carry a small white core (crt_core) and a wider
# bloom (crt_bloom), so they read as bright as People & Culture rather than mustard and olive.
CRT_CAL = {
    'synthia': dict(boost=3.2, level=3.0, hue=0.015),       # dE  3.9  #EFECE1
    'keys': dict(boost=1.4, level=0.8, hue=0.015, pool=0.8),      # dE 10.6  #1E54D6
    'kevin': dict(boost=3.2, level=2.2, hue=0.015),         # dE  2.8  #BCD9F8
    'operations': dict(boost=2.2, level=0.8, hue=0.015),    # dE  4.2  #F17A48
    'pat': dict(boost=1.0, level=0.65, hue=0.0),            # #707070 bare; glass, bloom and the dark room lift it to ~#8A
    'arjun': dict(boost=2.6, level=1.3, hue=0.0, core=0.12, bloom=0.3),   # dE 15.2  #C3DC80 (AgX gamut limit)
    'strategy': dict(rgb=(0.9, 1.0, 0.0), level=0.82, core=0.22, bloom=0.35),  # AgX MHC floor: lifted by a white core
    'people': dict(boost=3.2, level=1.3, hue=0.0),          # dE  3.9  #F3B5D5
    'linda': dict(boost=0.72, level=0.95, hue=0.0, pool=0.45),    # burgundy (#8A2433), not pink/crimson, in the room
}


def crt_field(name, hexcol=None):
    """(linear field rgb, emission level) that displays as the colleague's hex under AgX.
    Unknown names fall back to the plain colour at a luma-normalised level."""
    cal = CRT_CAL.get(name)
    rgb = srgb(hexcol or TERMINAL_HEX.get(name, '#888888'))
    if cal is None:
        lum = max(_luma(rgb), 1e-3)
        return rgb, min(3.5, max(0.8, 0.9 / lum ** 0.5))
    if 'rgb' in cal:
        return tuple(cal['rgb']), cal['level']
    lum = _luma(rgb)
    c = [max(0.0, lum + (x - lum) * cal['boost']) for x in rgb]
    if cal.get('hue'):
        h, s, v = colorsys.rgb_to_hsv(*c)
        c = list(colorsys.hsv_to_rgb((h + cal['hue']) % 1.0, s, v))
    return tuple(c), cal['level']


WALNUT_DARK = srgb('#2e1b10')
WALNUT_MID = srgb('#4d301d')
WALNUT_LIGHT = srgb('#74492b')
WALNUT_GREY = srgb('#3d2c29')       # purple-grey heartwood
WALNUT_HONEY = srgb('#6a4426')      # honey streaks near the sapwood
BRASS = (0.78, 0.55, 0.25)
BRASS_DARK = (0.42, 0.27, 0.11)
GOLD = (1.0, 0.76, 0.36)
CHROME = (0.86, 0.87, 0.88)
BEIGE = srgb('#d5c9ad')
BEIGE_DARK = srgb('#b9aa8a')
CHARCOAL = srgb('#2a2b2e')
WALL = srgb('#1a1b1e')
CARPET = srgb('#13286a')
CORD_YELLOW = srgb('#ffc61a')
PAPER = srgb('#f3f2ec')
COBALT = srgb('#0757ec')
GREEN_ACRYLIC = srgb('#1f9a52')
IVORY = srgb('#ece3cf')
LED_LIME = srgb('#d3ff66')
LED_GREEN = srgb('#4aff70')
LED_CYAN = srgb('#38e8ff')
AMBER = srgb('#ffa64a')
CUP_PAPER = srgb('#F2F0EB')
CUP_LID = srgb('#F7F5F1')
ESPRESSO = srgb('#2a160b')


# ================================================================== shader graph


class G:
    """Tiny node-graph builder; sockets or plain values are accepted everywhere."""

    def __init__(self, mat, principled=True):
        mat.use_nodes = True
        self.mat = mat
        self.nt = mat.node_tree
        self.N = self.nt.nodes
        self.L = self.nt.links
        for n in list(self.N):
            self.N.remove(n)
        self.out = self.N.new('ShaderNodeOutputMaterial')
        self.bsdf = None
        if principled:
            self.bsdf = self.N.new('ShaderNodeBsdfPrincipled')
            self.L.new(self.bsdf.outputs['BSDF'], self.out.inputs['Surface'])
        self._tc = None

    def _set(self, sock, val):
        if val is None:
            return
        if isinstance(val, bpy.types.NodeSocket):
            self.L.new(val, sock)
            return
        dv = getattr(sock, 'default_value', None)
        if isinstance(val, (int, float)) and hasattr(dv, '__len__'):
            n = len(dv)
            val = (val,) * n if n != 4 else (val, val, val, 1.0)
        elif isinstance(val, (tuple, list)) and hasattr(dv, '__len__') and len(dv) == 4 and len(val) == 3:
            val = (*val, 1.0)
        sock.default_value = val

    def node(self, kind, **props):
        n = self.N.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    @staticmethod
    def sock(coll, ident):
        for x in coll:
            if x.identifier == ident:
                return x
        raise KeyError(ident)

    def p(self, name, val):
        """Set or link a Principled input."""
        self._set(self.bsdf.inputs[name], val)

    # --- coordinates
    def texco(self):
        if self._tc is None:
            self._tc = self.node('ShaderNodeTexCoord')
        return self._tc

    def obj(self):
        return self.texco().outputs['Object']

    def uv(self):
        return self.texco().outputs['UV']

    def coords(self, jitter=(17.3, 29.1, 7.7)):
        """Object coordinates plus a stable per-object random offset (patterns never repeat)."""
        oi = self.node('ShaderNodeObjectInfo')
        off = self.vmath('SCALE', jitter, scale=oi.outputs['Random'])
        return self.vmath('ADD', self.obj(), off)

    def geo(self):
        return self.node('ShaderNodeNewGeometry')

    def attr(self, name, kind='OBJECT'):
        return self.node('ShaderNodeAttribute', attribute_type=kind, attribute_name=name)

    # --- maths
    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self._set(n.inputs[0], a)
        if b is not None:
            self._set(n.inputs[1], b)
        if c is not None:
            self._set(n.inputs[2], c)
        return n.outputs[0]

    def add(self, *xs):
        acc = xs[0]
        for x in xs[1:]:
            acc = self.math('ADD', acc, x)
        return acc

    def mul(self, *xs):
        acc = xs[0]
        for x in xs[1:]:
            acc = self.math('MULTIPLY', acc, x)
        return acc

    def sub(self, a, b):
        return self.math('SUBTRACT', a, b)

    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self._set(n.inputs[0], a)
        if b is not None:
            self._set(n.inputs[1], b)
        if scale is not None:
            self._set(n.inputs['Scale'], scale)
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']

    def sep(self, v):
        n = self.node('ShaderNodeSeparateXYZ')
        self._set(n.inputs[0], v)
        return n.outputs['X'], n.outputs['Y'], n.outputs['Z']

    def comb(self, x, y, z):
        n = self.node('ShaderNodeCombineXYZ')
        self._set(n.inputs[0], x)
        self._set(n.inputs[1], y)
        self._set(n.inputs[2], z)
        return n.outputs[0]

    def remap(self, v, a, b, c=0.0, d=1.0, clamp=True, smooth=False):
        n = self.node('ShaderNodeMapRange', clamp=clamp)
        if smooth:
            n.interpolation_type = 'SMOOTHSTEP'
        self._set(n.inputs['Value'], v)
        self._set(n.inputs['From Min'], a)
        self._set(n.inputs['From Max'], b)
        self._set(n.inputs['To Min'], c)
        self._set(n.inputs['To Max'], d)
        return n.outputs['Result']

    def mix(self, fac, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend, clamp_factor=True)
        self._set(self.sock(n.inputs, 'Factor_Float'), fac)
        self._set(self.sock(n.inputs, 'A_Color'), a)
        self._set(self.sock(n.inputs, 'B_Color'), b)
        return self.sock(n.outputs, 'Result_Color')

    def mixf(self, fac, a, b):
        n = self.node('ShaderNodeMix', data_type='FLOAT', clamp_factor=True)
        self._set(self.sock(n.inputs, 'Factor_Float'), fac)
        self._set(self.sock(n.inputs, 'A_Float'), a)
        self._set(self.sock(n.inputs, 'B_Float'), b)
        return self.sock(n.outputs, 'Result_Float')

    def colmul(self, a, b):
        return self.mix(1.0, a, b, 'MULTIPLY')

    def scale_vec(self, v, s):
        """Non-uniform scale of a vector by a 3-tuple."""
        return self.vmath('MULTIPLY', v, s)

    # --- textures
    def noise(self, vec, scale=5.0, detail=4.0, rough=0.55, distortion=0.0, lac=2.0):
        n = self.node('ShaderNodeTexNoise', noise_dimensions='3D')
        self._set(n.inputs['Vector'], vec)
        self._set(n.inputs['Scale'], scale)
        self._set(n.inputs['Detail'], detail)
        self._set(n.inputs['Roughness'], rough)
        self._set(n.inputs['Lacunarity'], lac)
        self._set(n.inputs['Distortion'], distortion)
        return n.outputs['Fac']

    def voronoi(self, vec, scale=50.0, feature='F1', rand=1.0, metric='EUCLIDEAN'):
        n = self.node('ShaderNodeTexVoronoi', feature=feature, distance=metric)
        self._set(n.inputs['Vector'], vec)
        self._set(n.inputs['Scale'], scale)
        self._set(n.inputs['Randomness'], rand)
        col = n.outputs['Color'] if 'Color' in n.outputs else None
        return n.outputs['Distance'], col

    def wave(self, vec, scale=5.0, distortion=4.0, detail=3.0, kind='BANDS', axis='X', profile='SIN'):
        n = self.node('ShaderNodeTexWave', wave_type=kind, wave_profile=profile)
        if kind == 'BANDS':
            n.bands_direction = axis
        else:
            n.rings_direction = axis
        self._set(n.inputs['Vector'], vec)
        self._set(n.inputs['Scale'], scale)
        self._set(n.inputs['Distortion'], distortion)
        self._set(n.inputs['Detail'], detail)
        return n.outputs['Fac']

    def bump(self, height, strength=0.3, distance=0.001, normal=None):
        b = self.node('ShaderNodeBump')
        self._set(b.inputs['Height'], height)
        self._set(b.inputs['Strength'], strength)
        self._set(b.inputs['Distance'], distance)
        if normal is not None:
            self._set(b.inputs['Normal'], normal)
        return b.outputs['Normal']

    def fingerprints(self, P, scale=40.0):
        """0..1 smudge mask: sparse oval blobs of fine concentric ridges (greasy touch marks)."""
        d, _ = self.voronoi(self.scale_vec(P, (1.0, 1.35, 1.0)), scale, 'F1', 0.8)
        blob = self.mul(self.remap(d, 0.32, 0.18), self.remap(self.noise(P, scale * 0.3, 2.0), 0.45, 0.6))
        ridge = self.remap(self.math('SINE', self.mul(d, 90.0)), -1.0, 1.0, 0.55, 1.0)
        return self.mul(blob, ridge)

    def scratches(self, P, scale=60.0, stretch=(1.0, 22.0, 1.0), lo=0.82, hi=0.9):
        """Thin directional hairline scratches (0..1). Kept for callers; see hairlines()."""
        return self.hairlines(P, (0.0,), across=scale * 20.0, along=scale * 20.0 / max(stretch))

    def vrot(self, v, deg, axis='Z'):
        n = self.node('ShaderNodeVectorRotate', rotation_type=axis + '_AXIS')
        self._set(n.inputs['Vector'], v)
        self._set(n.inputs['Angle'], math.radians(deg))
        return n.outputs['Vector']

    def hairlines(self, P, angles=(17.0, 74.0, 131.0), across=140.0, along=9.0, width=0.035, dash=260.0,
                  density=0.45, tilt=33.0):
        """Fine hairline scratches (0..1): iso-lines of noise stretched along a direction,
        one layer per angle (each tipped `tilt` deg out of the XY plane so every face of
        a solid gets lines), broken into dashes and gated to sparse patches.
        across: noise frequency across the line (1/m; with width sets the line width,
        about width / (1.5 * across) m); along: frequency along it; dash: dash frequency."""
        layers = []
        for i, ang in enumerate(angles):
            Pr = self.vrot(self.vrot(self.vmath('ADD', P, (3.7 * i, 1.3 * i, 5.1 * i)), ang, 'Z'), tilt * (1 - i), 'X')
            n = self.noise(self.scale_vec(Pr, (along, across, along)), 1.0, 0.0, 0.5)
            line = self.remap(self.math('ABSOLUTE', self.sub(n, 0.5)), width, width * 0.25)
            d = self.noise(self.scale_vec(Pr, (dash, dash * 0.3, dash)), 1.0, 1.0, 0.5)
            gate = self.remap(d, 0.5, 0.58)
            layers.append(self.mul(line, gate))
        acc = layers[0]
        for l in layers[1:]:
            acc = self.math('MAXIMUM', acc, l)
        patch = self.remap(self.noise(P, 35.0, 2.0, 0.5), 1.0 - density, 1.08 - density)
        return self.mul(acc, patch)

    def wear_scratches(self, P, N, cell=0.008, density=0.35, length=(0.002, 0.012), width=(0.00005, 0.00018),
                       bias=(1.0, 0.0, 0.3), spread=0.75, arc=0.0, seed=0.0):
        """True hairline wear scratches (0..1) on any surface, one per Voronoi cell (most cells
        empty). Each scratch has its own direction (a handling bias mixed with a random vector,
        projected into the surface), length, width and depth; both ends taper to nothing and
        `arc` bends some into shallow curves. P, N: object position and normal. Widths are
        metres (0.05-0.2 mm reads as a hairline at any shot distance), so the marks live in
        roughness and normal and only flash where they catch the light."""
        Pv = self.vmath('ADD', P, (seed * 3.17, seed * 1.73, seed * 2.31))
        vor = self.node('ShaderNodeTexVoronoi', feature='F1', distance='EUCLIDEAN', voronoi_dimensions='3D')
        self._set(vor.inputs['Vector'], Pv)
        self._set(vor.inputs['Scale'], 1.0 / cell)
        self._set(vor.inputs['Randomness'], 1.0)
        fpos = vor.outputs['Position']
        r1, r2, r3 = self.sep(vor.outputs['Color'])
        wn = self.node('ShaderNodeTexWhiteNoise', noise_dimensions='3D')
        self._set(wn.inputs['Vector'], self.vmath('ADD', fpos, (11.3, 5.9, 2.7)))
        w1, w2, w3 = self.sep(wn.outputs['Color'])
        gate = self.remap(wn.outputs['Value'], 1.0 - density, 1.0 - density + 0.001)
        # direction in the surface: bias + random, projected into the tangent plane
        rv = self.comb(self.sub(r1, 0.5), self.sub(r2, 0.5), self.sub(r3, 0.5))
        bn = self.vmath('NORMALIZE', bias)
        t0 = self.vmath('ADD', self.vmath('SCALE', bn, scale=1.0 - spread), self.vmath('SCALE', rv, scale=2.0 * spread))
        t = self.vmath('NORMALIZE', self.vmath('SUBTRACT', t0, self.vmath('SCALE', N, scale=self.vmath('DOT_PRODUCT', t0, N))))
        b = self.vmath('NORMALIZE', self.vmath('CROSS_PRODUCT', N, t))
        d = self.vmath('SUBTRACT', Pv, fpos)
        along = self.vmath('DOT_PRODUCT', d, t)
        across = self.vmath('DOT_PRODUCT', d, b)
        half = self.mul(self.add(length[0], self.mul(self.mul(w1, w1), length[1] - length[0])), 0.5)
        u = self.math('DIVIDE', along, half)
        if arc:
            across = self.sub(across, self.mul(self.mul(self.sub(w2, 0.5), 2.0 * arc), half, self.mul(u, u)))
        taper = self.math('SQRT', self.math('MAXIMUM', self.sub(1.0, self.mul(u, u)), 0.0))
        wid = self.mul(self.add(width[0], self.mul(w3, width[1] - width[0])), taper)
        line = self.sub(1.0, self.math('MINIMUM', self.math('DIVIDE', self.math('ABSOLUTE', across),
                                                                  self.math('MAXIMUM', wid, 1e-7)), 1.0))
        return self.mul(line, gate, self.add(0.45, self.mul(r1, 0.55)))

    def ao(self, distance=0.003, inside=False, samples=8, only_local=True):
        n = self.node('ShaderNodeAmbientOcclusion', inside=inside, only_local=only_local, samples=samples)
        n.inputs['Distance'].default_value = distance
        return n.outputs['AO']


def _get(name):
    m = bpy.data.materials.get(name)
    if m is not None and m.get('room_mat'):
        return m
    return None


def _new(name):
    m = bpy.data.materials.new(name)
    m['room_mat'] = True
    return m


def _argkey(a, k):
    def one(x):
        if isinstance(x, float):
            return f'{x:.3g}'
        if isinstance(x, (tuple, list)):
            return 'c' + ''.join(f'{int(round(min(1.0, max(0.0, c)) * 255)):02x}' for c in x[:3])
        return str(x)
    parts = [one(x) for x in a] + [f'{kk}{one(vv)}' for kk, vv in sorted(k.items())]
    return ''.join('_' + p for p in parts)


def cached(fn):
    """Cache a material builder by its name + arguments."""
    def wrap(*a, **k):
        key = fn.__name__ + _argkey(a, k)
        m = _get(key)
        if m is not None:
            return m
        m = _new(key)
        fn(m, *a, **k)
        return m
    wrap.__name__ = fn.__name__
    wrap.__doc__ = fn.__doc__
    return wrap


# ================================================================== materials


@cached
def walnut(m, axis='Y'):
    """Flat-sawn, book-matched American walnut under a glossy clearcoat (roughness ~0.08-0.12).

    Two 0.4 m boards a side, mirrored about the spine. Each board's growth rings are
    sliced by the surface at a height above the pith that wanders along the length,
    so the rings draw cathedral arches with irregular spacing. Colour runs from
    purple-grey heartwood to honey streaks (held brown, not orange, under the slab);
    pores are 0.2-0.4 mm dark dashes along the grain that resolve in a 100 mm macro. The
    coat carries directional wipe marks and fingerprints, so screen reflections stretch
    into long streaks at grazing angles. End grain (faces across the grain) is darker,
    satin, its rings irregular (+-40% spacing) with fine medullary rays and open pore dots.
    axis: the grain direction ('Y' = the table's length; 'X' = across, the breadboard ends)."""
    g = G(m)
    P0 = g.obj()
    x0, y0, z = g.sep(P0)
    nx0, ny0, _ = g.sep(g.geo().outputs['Normal'])
    if axis == 'X':
        x, y, ny = y0, x0, nx0
    else:
        x, y, ny = x0, y0, ny0
    P = g.comb(x, y, z)
    ax = g.math('ABSOLUTE', x)
    bw = 0.40
    bi = g.math('FLOOR', g.math('DIVIDE', ax, bw))
    wn = g.node('ShaderNodeTexWhiteNoise', noise_dimensions='2D')
    g._set(wn.inputs['Vector'], g.comb(g.add(g.mul(bi, 7.31), 1.7 if axis == 'Y' else 5.9), 3.3, 0.0))
    rnd = wn.outputs['Value']
    endg = g.remap(g.math('ABSOLUTE', ny), 0.55, 0.9, smooth=True)           # 1 on end grain
    # pith position across the board and the cut height above it (wanders along y)
    xl = g.sub(g.sub(ax, g.mul(g.add(bi, 0.5), bw)), g.mul(g.sub(rnd, 0.5), 0.30))
    hn = g.noise(g.comb(g.mul(y, 0.21), g.mul(rnd, 13.0), g.mul(bi, 5.0)), 1.0, 2.0, 0.5)
    h = g.add(0.095, g.mul(hn, 0.12))        # the pith always lies below the 8 cm slab: end grain shows arcs, never a bullseye
    h = g.sub(h, g.sub(0.75, z))          # below the top face (edges, end grain) the rings close round the pith
    r = g.math('SQRT', g.add(g.mul(xl, xl), g.mul(h, h)))
    # wobble of the rings at two scales (a slow irregular figure over 0.3-1 m and a finer
    # ripple), and growth-year spacing that varies with the radius
    fig = g.noise(g.scale_vec(P, (1.6, 0.9, 1.6)), 1.0, 3.0, 0.6, 0.6)
    wob = g.noise(g.scale_vec(P, (6.0, 0.35, 6.0)), 1.0, 3.0, 0.55)
    r = g.add(r, g.mul(g.sub(wob, 0.5), 0.010), g.mul(g.sub(fig, 0.5), 0.045))
    grow = g.noise(g.comb(g.mul(r, 9.0), g.mul(rnd, 7.0), 0.5), 1.0, 2.0, 0.5)
    # end grain: ring spacing wanders +-40% year to year (no lathe-like regularity)
    yr = g.noise(g.comb(g.mul(r, 60.0), g.mul(rnd, 3.0), 1.5), 1.0, 2.0, 0.6)
    spacing = g.add(1.0, g.mul(endg, g.mul(g.sub(yr, 0.5), 0.8)))
    rings = g.add(g.math('DIVIDE', r, g.mul(spacing, 0.0052)), g.mul(grow, 6.0))
    fr = g.math('FRACT', rings)
    late = g.mul(g.remap(fr, 0.50, 0.92, smooth=True), g.remap(fr, 1.0, 0.955))   # latewood, soft edge
    late = g.mul(late, g.sub(1.0, g.mul(endg, 0.45)))                            # end grain: quieter rings
    late = g.mul(late, g.add(0.55, g.mul(g.noise(g.scale_vec(P, (3.0, 0.5, 3.0)), 1.0, 2.0), 0.6)))
    # colour: purple-grey heartwood <-> honey streaks, per board and along the length, plus a
    # slow drift of the whole tone over 0.3-1 m (no two metres of the table alike)
    streak = g.noise(g.scale_vec(P, (4.5, 0.06, 4.5)), 1.0, 3.0, 0.6)
    tone = g.add(g.mul(g.remap(streak, 0.3, 0.75, smooth=True), 0.75), g.mul(rnd, 0.25))
    col = g.mix(tone, WALNUT_GREY, WALNUT_MID)
    hon = g.remap(g.noise(g.scale_vec(P, (2.6, 0.035, 2.6)), 1.0, 3.0, 0.5), 0.6, 0.82)
    col = g.mix(g.mul(hon, 0.6), col, WALNUT_HONEY)
    drift = g.noise(g.scale_vec(P, (2.2, 1.3, 2.2)), 1.0, 2.0, 0.5)
    col = g.mix(g.remap(drift, 0.35, 0.2), col, WALNUT_DARK)
    col = g.mix(g.mul(g.remap(drift, 0.62, 0.8), 0.5), col, WALNUT_LIGHT)
    col = g.mix(g.mul(late, 0.30), col, tuple(c * 0.5 for c in WALNUT_DARK))
    # pores: 0.2-0.4 mm x 2-5 mm dark dashes along the grain (stretched Voronoi cells),
    # denser in the latewood; on end grain they are open round dots
    pd, _ = g.voronoi(g.scale_vec(P, (1500.0, 150.0, 1500.0)), 1.0)
    dash = g.remap(pd, 0.20, 0.10, smooth=True)
    pn = g.noise(g.scale_vec(P, (300.0, 30.0, 300.0)), 1.0, 2.0, 0.5)
    pores = g.mul(dash, g.remap(pn, 0.38, 0.58), g.add(0.45, g.mul(late, 0.55)), g.sub(1.0, endg))
    dots, _ = g.voronoi(g.scale_vec(P, (2400.0, 2400.0, 2400.0)), 1.0)
    pdots = g.mul(g.remap(dots, 0.24, 0.12, smooth=True), endg, g.add(0.3, g.mul(late, 0.7)))
    # medullary rays: fine pale flecks radiating from the pith, seen on the end grain
    ang = g.math('ARCTAN2', h, xl)
    rays = g.remap(g.math('ABSOLUTE', g.sub(g.math('FRACT', g.add(g.mul(ang, 140.0),
                                                                 g.mul(g.noise(g.vmath('SCALE', P, scale=40.0), 1.0, 2.0), 1.5))), 0.5)),
                   0.47, 0.5, smooth=True)
    col = g.mix(g.mul(rays, endg, 0.25), col, WALNUT_LIGHT)
    col = g.mix(g.mul(g.add(pores, pdots), 0.7), col, (0.006, 0.0035, 0.0025))
    col = g.colmul(col, (0.82, 0.82, 0.82))
    col = g.mix(g.mul(endg, 0.30), col, tuple(c * 0.55 for c in WALNUT_DARK))    # end grain drinks the finish: darker
    # hold it brown under the slab: 30% toward its own grey and a touch darker (AgX pushes
    # lit walnut toward terracotta)
    bw_ = g.node('ShaderNodeRGBToBW')
    g._set(bw_.inputs['Color'], col)
    col = g.mix(0.30, col, g.comb(bw_.outputs['Val'], bw_.outputs['Val'], bw_.outputs['Val']))
    col = g.colmul(col, (0.86, 0.86, 0.86))
    g.p('Base Color', col)
    # the wood under the lacquer: a faint satin sheen combed along the grain (anisotropic),
    # so screens and the slot reflect as long streaks toward a down-table lens; the clear
    # coat on top keeps the crisp mirror
    g.p('Roughness', 0.42)
    g.p('Specular IOR Level', 0.10)
    g.p('Anisotropic', g.mul(0.85, g.sub(1.0, endg)))
    g.p('Tangent', g.comb(0.0, 1.0, 0.0) if axis == 'Y' else g.comb(1.0, 0.0, 0.0))
    g.p('Coat Weight', 1.0)
    g.p('Coat IOR', 1.52)
    wipe = g.noise(g.scale_vec(P, (34.0, 0.45, 34.0)), 1.0, 3.0, 0.6)
    swirl = g.remap(g.noise(P, 2.2, 3.0, 0.6), 0.4, 0.75)
    prints = g.fingerprints(g.coords(), 30.0)
    g.p('Coat Roughness', g.add(0.085, g.mul(g.remap(wipe, 0.35, 0.75), 0.035), g.mul(swirl, 0.02),
                                g.mul(prints, 0.07), g.mul(endg, 0.16)))
    g.p('Normal', g.bump(g.add(g.mul(late, 0.15), g.mul(pores, 0.8), g.mul(pdots, 0.8)), 0.06, 0.0004))
    peel = g.noise(P, 140.0, 2.0, 0.5)
    g.p('Coat Normal', g.bump(g.add(peel, g.mul(wipe, 0.4)), 0.010, 0.0004))


@cached
def brass(m, finish='brushed'):
    """Brass. 'brushed' = the channel's lip (anisotropic along Y), 'aged' = the channel
    walls (dark, oiled, tarnished: the glints stay on the lip), 'polished' = socket and
    hardware."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 45.0, 4.0, 0.6)
    tarnish = g.remap(g.noise(P, 6.0, 3.0), 0.55, 0.75)
    col = g.mix(g.mul(tarnish, 0.5), BRASS, BRASS_DARK)
    col = g.mix(g.mul(n, 0.2), col, (0.9, 0.68, 0.36))
    prints = g.fingerprints(P, 60.0)
    if finish == 'aged':
        grime = g.remap(g.noise(g.scale_vec(P, (8.0, 0.4, 8.0)), 3.0, 3.0, 0.6), 0.35, 0.75)
        col = g.mix(g.add(0.55, g.mul(grime, 0.35)), col, (0.16, 0.10, 0.045))
        g.p('Base Color', col)
        g.p('Metallic', 0.85)
        g.p('Roughness', g.add(0.42, g.mul(grime, 0.2)))
        return
    if finish == 'satin':
        # the socket: pale, fine satin brass (turned, then grained across), clearly whiter and
        # duller than the gold jack it holds
        col = g.mix(g.mul(tarnish, 0.35), (0.86, 0.72, 0.47), (0.66, 0.52, 0.31))
        g.p('Base Color', g.mix(g.mul(n, 0.15), col, (0.92, 0.80, 0.58)))
        g.p('Metallic', 1.0)
        g.p('Roughness', g.add(0.27, g.mul(tarnish, 0.08), g.mul(prints, 0.12)))
        g.p('Anisotropic', 0.55)
        tg = g.node('ShaderNodeTangent', direction_type='RADIAL', axis='Y')
        g.p('Tangent', tg.outputs['Tangent'])
        g.p('Normal', g.bump(g.noise(g.scale_vec(P, (1400.0, 30.0, 1400.0)), 1.0, 2.0), 0.05, 0.0002))
        return
    if finish == 'lip':
        # the channel's flush lip: paler, whiter brass than the cords beside it, polished along
        # the channel (UV u runs down the table), so the slab and the slot draw one narrow line
        col = g.mix(g.mul(tarnish, 0.35), (0.93, 0.80, 0.56), (0.62, 0.46, 0.22))
        g.p('Base Color', col)
        g.p('Metallic', 1.0)
        g.p('Roughness', g.add(0.21, g.mul(tarnish, 0.08), g.mul(prints, 0.1)))
        g.p('Anisotropic', 0.85)
        tg = g.node('ShaderNodeTangent', direction_type='UV_MAP', uv_map='UVMap')
        g.p('Tangent', tg.outputs['Tangent'])
        brush = g.noise(g.scale_vec(P, (900.0, 2.0, 900.0)), 1.0, 2.0)
        g.p('Normal', g.bump(brush, 0.04, 0.0002))
        return
    g.p('Base Color', col)
    g.p('Metallic', 1.0)
    if finish == 'brushed':
        g.p('Roughness', g.add(0.2, g.mul(tarnish, 0.12), g.mul(prints, 0.15)))
        g.p('Anisotropic', 0.6)
        tg = g.node('ShaderNodeTangent', direction_type='RADIAL', axis='Y')
        g.p('Tangent', tg.outputs['Tangent'])
        brush = g.noise(g.scale_vec(P, (60.0, 0.5, 60.0)), 30.0, 2.0)
        g.p('Normal', g.bump(brush, 0.06, 0.0003))
    else:
        g.p('Roughness', g.add(0.12, g.mul(tarnish, 0.1), g.mul(prints, 0.2)))


PADLOCK = dict(W=0.062, H=0.052, D=0.030, r=0.013, bevel=0.0045, leg=0.0205)


@cached
def hero_brass(m):
    """The padlock: heavy cast brass, handled for years. Wear masks come from the body's own
    analytic shape (no AO rays): the bevel crests and corners are rubbed bright and smooth,
    dark brown oxide is packed round the shackle collars and the keyway, the broad faces
    carry a mottled patina and greasy thumb prints. Scratches are true hairlines (0.05-0.2 mm,
    2-25 mm long, tapered, every one in its own direction with a loose handling bias, a few
    long shallow arcs) that live in roughness and normal, with a base-colour lift under 0.1,
    plus a faint micro-scratch grain. No engraving, no glyph-like marks."""
    g = G(m)
    P = g.coords()
    Po = g.obj()
    N = g.texco().outputs['Normal']
    x, y, z = g.sep(Po)
    W, H, D, rr = PADLOCK['W'], PADLOCK['H'], PADLOCK['D'], PADLOCK['r']
    # signed distance to the rounded-rect outline in the XZ plane (<0 inside), distance to the broad faces
    qx = g.sub(g.math('ABSOLUTE', x), W / 2 - rr)
    qz = g.sub(g.math('ABSOLUTE', g.sub(z, H / 2)), H / 2 - rr)
    outer = g.math('SQRT', g.add(g.mul(g.math('MAXIMUM', qx, 0.0), g.math('MAXIMUM', qx, 0.0)),
                                 g.mul(g.math('MAXIMUM', qz, 0.0), g.math('MAXIMUM', qz, 0.0))))
    sd = g.sub(g.add(outer, g.math('MINIMUM', g.math('MAXIMUM', qx, qz), 0.0)), rr)
    dface = g.sub(D / 2, g.math('ABSOLUTE', y))
    corner = g.add(g.math('ABSOLUTE', sd), g.math('MAXIMUM', dface, 0.0))
    edge = g.remap(corner, 0.0085, 0.0015, smooth=True)                                  # bevel crests
    # oxide: round the two shackle holes on the top face, round the keyway underneath
    rc = g.math('SQRT', g.add(g.mul(g.sub(g.math('ABSOLUTE', x), PADLOCK['leg']), g.sub(g.math('ABSOLUTE', x), PADLOCK['leg'])),
                              g.mul(y, y)))
    top = g.remap(z, H - 0.006, H - 0.001)
    bot = g.remap(z, 0.005, 0.0008)
    rb = g.math('SQRT', g.add(g.mul(x, x), g.mul(y, y)))
    recess = g.math('MAXIMUM', g.mul(g.remap(rc, 0.0125, 0.0068, smooth=True), top),
                    g.mul(g.remap(rb, 0.0115, 0.0066, smooth=True), bot))
    big = g.noise(P, 18.0, 4.0, 0.6)
    patina = g.remap(g.noise(P, 35.0, 5.0, 0.65), 0.48, 0.80)
    grime = g.mul(g.remap(dface, 0.0, 0.004), g.remap(g.math('ABSOLUTE', sd), 0.0, 0.006),
                  g.remap(g.noise(P, 60.0, 3.0, 0.6), 0.45, 0.72))                     # in the faces' margins
    # the broad faces were polished by handling: patina lives only in their margins (near the
    # bevels, the collars and the keyway), the open face is clean bright brass
    face_in = g.mul(g.remap(g.math('ABSOLUTE', sd), 0.004, 0.011, smooth=True), g.remap(dface, 0.003, 0.0))
    patina = g.mul(patina, g.sub(1.0, g.mul(face_in, 0.55)))
    col = g.mix(g.mul(patina, 0.55), (0.80, 0.60, 0.29), (0.36, 0.24, 0.10))
    col = g.mix(g.mul(g.remap(big, 0.4, 0.7), 0.2), col, (0.86, 0.66, 0.33))
    col = g.mix(g.mul(edge, 0.8), col, (0.97, 0.79, 0.46))                              # rubbed bright
    oxide = g.math('MINIMUM', g.add(g.mul(recess, g.add(0.6, g.mul(patina, 0.4))), g.mul(grime, 0.35)), 1.0)
    col = g.mix(oxide, col, (0.10, 0.058, 0.026))
    # hairlines: short dense, medium with a few arcs, sparse long ones; loose handling bias along X
    s1 = g.wear_scratches(P, N, cell=0.0045, density=0.24, length=(0.002, 0.006), width=(0.00005, 0.00012),
                          bias=(1.0, 0.0, 0.35), spread=0.8, seed=1.0)
    s2 = g.wear_scratches(P, N, cell=0.011, density=0.26, length=(0.005, 0.014), width=(0.00006, 0.00016),
                          bias=(1.0, 0.0, -0.2), spread=0.65, arc=0.25, seed=2.0)
    s3 = g.wear_scratches(P, N, cell=0.026, density=0.28, length=(0.012, 0.025), width=(0.00008, 0.0002),
                          bias=(1.0, 0.0, 0.1), spread=0.55, arc=0.5, seed=3.0)
    sc = g.math('MINIMUM', g.add(s1, s2, s3), 1.0)
    sc = g.mul(sc, g.sub(1.0, g.mul(oxide, 0.8)))
    col = g.mix(g.mul(sc, 0.08), col, (0.98, 0.84, 0.56))
    # micro-scratch grain along the handling direction (breaks the specular up finely)
    micro = g.noise(g.scale_vec(g.vrot(P, 18.0, 'Y'), (40.0, 900.0, 2600.0)), 1.0, 2.0, 0.6)
    pv, _ = g.voronoi(P, 1100.0, 'F1', 1.0)
    pits = g.mul(g.remap(pv, 0.10, 0.045), g.remap(g.noise(P, 12.0, 2.0), 0.55, 0.7))
    col = g.mix(g.mul(pits, 0.6), col, (0.10, 0.06, 0.03))
    g.p('Base Color', col)
    g.p('Metallic', g.sub(1.0, g.mul(oxide, 0.4)))
    prints = g.fingerprints(g.scale_vec(P, (1.0, 1.0, 1.6)), 55.0)
    # scratches: shiny lines in the matte margins, scattering (rougher) lines on the polished face
    sc_r = g.mul(sc, g.sub(g.mul(face_in, 0.22), 0.08))
    rough = g.add(0.17, g.mul(patina, 0.18), g.mul(prints, 0.12), g.mul(edge, -0.07), g.mul(oxide, 0.32),
                  sc_r, g.mul(g.sub(micro, 0.5), 0.06), g.mul(pits, 0.3), g.mul(face_in, -0.02))
    g.p('Roughness', g.math('MAXIMUM', rough, 0.06))
    # micro-scratch direction: the handling strokes run across the broad faces (along X), so
    # the face mirrors the dark room with one soft highlight band
    g.p('Anisotropic', g.mul(face_in, 0.55))
    tgx = g.node('ShaderNodeTangent', direction_type='RADIAL', axis='Z')
    g.p('Tangent', tgx.outputs['Tangent'])
    dents = g.remap(g.noise(P, 90.0, 2.0), 0.62, 0.8)
    g.p('Normal', g.bump(g.add(g.mul(sc, -0.6), g.mul(dents, 0.35), g.mul(big, 0.15), g.mul(pits, -0.8),
                               g.mul(micro, 0.05)), 0.2, 0.0003))


@cached
def shackle_steel(m):
    """Hardened steel shackle: dark, finely brushed round its length, tarnished and nicked."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 60.0, 3.0)
    tarn = g.remap(g.noise(P, 22.0, 4.0, 0.6), 0.5, 0.78)
    col = g.mix(g.mul(tarn, 0.7), (0.50, 0.50, 0.51), (0.30, 0.26, 0.21))
    N = g.texco().outputs['Normal']
    sc = g.math('MINIMUM', g.add(
        g.wear_scratches(P, N, cell=0.004, density=0.35, length=(0.002, 0.006), bias=(0.0, 0.0, 1.0), spread=0.8,
                         seed=4.0),
        g.wear_scratches(P, N, cell=0.012, density=0.3, length=(0.006, 0.016), bias=(0.0, 0.0, 1.0), spread=0.6,
                         arc=0.3, seed=5.0)), 1.0)
    col = g.mix(g.mul(sc, 0.08), col, (0.72, 0.72, 0.73))
    g.p('Base Color', col)
    g.p('Metallic', 1.0)
    prints = g.fingerprints(P, 60.0)
    g.p('Roughness', g.add(0.24, g.mul(n, 0.08), g.mul(tarn, 0.18), g.mul(prints, 0.15), g.mul(sc, -0.1)))
    g.p('Normal', g.bump(g.add(g.mul(n, 0.3), g.mul(sc, -0.6)), 0.12, 0.0003))


@cached
def gold(m):
    """Gold plating on the 3.5 mm jack: warm, bright, a little worn on the knurl peaks."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 300.0, 3.0)
    g.p('Base Color', g.mix(g.mul(n, 0.3), (0.88, 0.76, 0.38), (0.96, 0.85, 0.52)))
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(0.14, g.mul(n, 0.08)))


@cached
def chrome(m, rough=0.08):
    g = G(m)
    P = g.coords()
    n = g.noise(P, 120.0, 3.0)
    g.p('Base Color', CHROME)
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(rough, g.mul(n, 0.05)))


@cached
def steel(m, rough=0.28):
    """Brushed steel (trolley, tow bar, shackle)."""
    g = G(m)
    P = g.coords()
    brush = g.noise(g.scale_vec(P, (1.0, 40.0, 1.0)), 30.0, 3.0)
    prints = g.fingerprints(P, 40.0)
    g.p('Base Color', g.mix(g.mul(brush, 0.3), (0.58, 0.59, 0.6), (0.72, 0.73, 0.74)))
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(rough, g.mul(brush, 0.08), g.mul(prints, 0.15)))
    g.p('Anisotropic', 0.4)
    g.p('Normal', g.bump(brush, 0.05, 0.0003))


@cached
def beige_plastic(m, tone=0.0):
    """1980s ABS case: warm beige, sun-yellowed in places, fine orange-peel texture,
    grime settled in the seams. tone>0 = older, yellower unit."""
    g = G(m)
    P = g.coords()
    _, _, nz = g.sep(g.texco().outputs['Normal'])
    yel = g.remap(g.noise(P, 2.5, 3.0, 0.5), 0.35, 0.75)
    base = (BEIGE[0] * (1 - 0.06 * tone), BEIGE[1] * (1 - 0.1 * tone), BEIGE[2] * (1 - 0.22 * tone))
    col = g.mix(g.mul(yel, 0.35), base, BEIGE_DARK)
    # UV yellowing: the faces that saw the sky for a decade are warmer and a touch darker
    uvy = g.mul(g.remap(nz, 0.35, 0.95, smooth=True), g.add(0.6, g.mul(yel, 0.4)))
    col = g.mix(g.mul(uvy, 0.45), col, srgb('#c6b385'))
    grime = g.remap(g.noise(P, 40.0, 4.0, 0.6), 0.6, 0.8)
    col = g.mix(g.mul(grime, 0.25), col, (0.25, 0.21, 0.15))
    # settled dust on the up-facing faces (fine grey speckle), a few low scuffs on the sides
    dn = g.noise(P, 900.0, 2.0, 0.7)
    dust = g.mul(g.remap(nz, 0.55, 0.95), g.remap(dn, 0.52, 0.66), g.remap(g.noise(P, 9.0, 2.0), 0.35, 0.7))
    col = g.mix(g.mul(dust, 0.35), col, (0.42, 0.41, 0.39))
    scuff = g.mul(g.remap(g.noise(g.scale_vec(P, (60.0, 60.0, 900.0)), 1.0, 2.0, 0.6), 0.66, 0.74),
                  g.remap(g.noise(P, 14.0, 2.0), 0.58, 0.7), g.remap(g.math('ABSOLUTE', nz), 0.5, 0.2))
    col = g.mix(g.mul(scuff, 0.5), col, (0.30, 0.27, 0.22))
    g.p('Base Color', col)
    peel = g.noise(P, 700.0, 2.0, 0.5)
    stip = g.noise(P, 3200.0, 1.0, 0.5)                         # moulded stipple, ~0.3 mm
    prints = g.fingerprints(P, 25.0)
    g.p('Roughness', g.add(0.42, g.mul(peel, 0.1), g.mul(prints, -0.12), g.mul(dust, 0.2), g.mul(scuff, -0.1)))
    g.p('Specular IOR Level', 0.45)
    g.p('Normal', g.bump(g.add(g.mul(peel, 0.6), g.mul(stip, 0.5)), 0.07, 0.0002))


@cached
def ivory_enamel(m):
    """The droid's canister: glossy ivory enamel with tiny chips."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 12.0, 3.0)
    chips = g.remap(g.noise(P, 160.0, 2.0), 0.72, 0.76)
    col = g.mix(g.mul(n, 0.2), IVORY, (0.72, 0.66, 0.54))
    col = g.mix(chips, col, (0.35, 0.36, 0.37))
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.22, g.mul(n, 0.1)))
    g.p('Coat Weight', 0.6)
    g.p('Coat Roughness', 0.08)


@cached
def fabric(m, color=CHARCOAL, weave=900.0, sheen=0.5):
    """Woven upholstery: charcoal chair cloth (and the acoustic wall fabric)."""
    g = G(m)
    P = g.obj()
    x, y, z = g.sep(P)
    wx = g.math('SINE', g.mul(g.add(x, z), weave))
    wy = g.math('SINE', g.mul(g.add(y, z), weave))
    w = g.mul(g.remap(wx, -1, 1, 0, 1), g.remap(wy, -1, 1, 0, 1))
    n = g.noise(g.coords(), 30.0, 4.0, 0.6)
    col = g.mix(g.mul(n, 0.3), color, tuple(c * 0.7 for c in color))
    col = g.mix(g.mul(w, 0.25), col, tuple(c * 1.3 for c in color))
    g.p('Base Color', col)
    g.p('Roughness', 0.88)
    g.p('Sheen Weight', sheen)
    g.p('Sheen Roughness', 0.4)
    g.p('Normal', g.bump(g.add(w, g.mul(n, 0.3)), 0.25, 0.0004))


@cached
def acoustic(m):
    """Charcoal acoustic panel fabric #1a1b1e, a coarse felt with faint mottling."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 4.0, 4.0, 0.6)
    f = g.noise(P, 260.0, 3.0, 0.7)
    g.p('Base Color', g.mix(g.mul(n, 0.4), WALL, (0.006, 0.0065, 0.008)))
    g.p('Roughness', 0.95)
    g.p('Sheen Weight', 0.35)
    g.p('Sheen Roughness', 0.5)
    g.p('Sheen Tint', (0.55, 0.62, 0.8))
    g.p('Normal', g.bump(f, 0.2, 0.001))


@cached
def carpet(m):
    """Cobalt loop-pile carpet: deep blue, velvety at grazing angles, faint tracks."""
    g = G(m)
    P = g.obj()
    pile = g.noise(P, 380.0, 2.0, 0.7)
    loops, _ = g.voronoi(P, 520.0)
    tracks = g.remap(g.noise(g.scale_vec(P, (1.0, 0.12, 1.0)), 1.2, 3.0), 0.4, 0.7)
    col = g.mix(g.mul(pile, 0.4), CARPET, tuple(c * 0.55 for c in CARPET))
    col = g.mix(g.mul(tracks, 0.18), col, tuple(c * 1.25 for c in CARPET))
    g.p('Base Color', col)
    g.p('Roughness', 1.0)
    g.p('Sheen Weight', 0.6)
    g.p('Sheen Roughness', 0.4)
    g.p('Sheen Tint', (0.5, 0.6, 0.9))
    g.p('Specular IOR Level', 0.2)
    g.p('Normal', g.bump(g.add(pile, g.mul(loops, 0.6)), 0.5, 0.002))


@cached
def plaster(m, value=0.55):
    """Light-well lining: warm white plaster, lit by the sun."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 30.0, 4.0)
    g.p('Base Color', g.mix(g.mul(n, 0.2), (value, value * 0.98, value * 0.95), (value * 0.8,) * 3))
    g.p('Roughness', 0.9)
    g.p('Normal', g.bump(n, 0.1, 0.002))


@cached
def black_plastic(m, rough=0.38, value=0.012):
    g = G(m)
    P = g.coords()
    n = g.noise(P, 200.0, 3.0)
    stip = g.noise(P, 3000.0, 1.0, 0.5)
    prints = g.fingerprints(P, 35.0)
    _, _, nz = g.sep(g.texco().outputs['Normal'])
    dust = g.mul(g.remap(nz, 0.5, 0.95), g.remap(g.noise(P, 800.0, 2.0, 0.7), 0.55, 0.7))
    g.p('Base Color', g.mix(g.mul(dust, 0.25), (value, value, value * 1.08), (0.10, 0.10, 0.10)))
    g.p('Roughness', g.add(rough, g.mul(n, 0.06), g.mul(prints, -0.15), g.mul(dust, 0.2)))
    g.p('Normal', g.bump(g.add(n, g.mul(stip, 0.6)), 0.05, 0.0002))


@cached
def rubber(m):
    g = G(m)
    P = g.coords()
    n = g.noise(P, 300.0, 2.0)
    g.p('Base Color', (0.008, 0.008, 0.008))
    g.p('Roughness', g.add(0.62, g.mul(n, 0.15)))


@cached
def lacquer_black(m):
    """The table plinth: satin black lacquer that swallows light."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 8.0, 3.0)
    g.p('Base Color', (0.006, 0.0058, 0.0055))
    g.p('Roughness', g.add(0.3, g.mul(n, 0.1)))


@cached
def cord_plastic(m):
    """Glossy yellow PVC of the coiled cords. Texture space is the coil's own turn index
    (attribute cord_t from SynCoil), so it never swims as a cord stretches."""
    g = G(m)
    t = g.attr('cord_t', 'GEOMETRY').outputs['Fac']
    oi = g.node('ShaderNodeObjectInfo')
    P = g.comb(g.mul(t, 0.6), g.mul(oi.outputs['Random'], 50.0), 0.0)
    n = g.noise(P, 1.0, 2.0)
    # where the wire faces its neighbouring turns (normal along the coil axis) it sits in the
    # crossing's shadow: darker, warmer, so each turn reads as a separate bead of yellow
    ax = g.attr('cord_axis', 'GEOMETRY').outputs['Vector']
    side = g.math('ABSOLUTE', g.vmath('DOT_PRODUCT', g.geo().outputs['Normal'], g.vmath('NORMALIZE', ax)))
    cross = g.remap(side, 0.35, 0.92, smooth=True)
    base = tuple(c * 0.65 for c in CORD_YELLOW)
    col = g.mix(g.mul(n, 0.25), base, (0.55, 0.26, 0.0))
    col = g.mix(g.mul(cross, 0.75), col, (0.16, 0.055, 0.0))
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.3, g.mul(n, 0.06)))
    g.p('Subsurface Weight', 0.12)
    g.p('Subsurface Radius', (1.0, 0.6, 0.2))
    g.p('Subsurface Scale', 0.002)
    g.p('Coat Weight', 0.12)
    g.p('Coat Roughness', 0.18)


@cached
def paper(m, tone=1.0, stripes=False):
    """Office paper. stripes=True adds the page-edge striations seen on a stack's sides."""
    g = G(m)
    P = g.coords()
    fib = g.noise(P, 600.0, 3.0, 0.7)
    base = tuple(c * tone for c in PAPER)
    col = g.mix(g.mul(fib, 0.12), base, tuple(c * 0.86 for c in base))
    h = g.mul(fib, 0.3)
    if stripes:
        # page edges: fine sheet lines plus irregular darker bands (sheets bunched by the
        # binding or the ream), visible from a metre away; only on the sides (not the top)
        x, y, z = g.sep(g.obj())
        _, _, nz = g.sep(g.texco().outputs['Normal'])
        sides = g.remap(g.math('ABSOLUTE', nz), 0.6, 0.3)
        s = g.math('SINE', g.mul(z, 9000.0))
        sn = g.noise(g.scale_vec(P, (3.0, 3.0, 300.0)), 4.0, 2.0)
        s = g.remap(g.add(s, g.mul(sn, 1.5)), -1.0, 2.5, 0.0, 1.0)
        bands = g.remap(g.noise(g.scale_vec(P, (8.0, 8.0, 420.0)), 1.0, 3.0, 0.6), 0.42, 0.7)
        wav = g.remap(g.math('SINE', g.add(g.mul(z, 1900.0), g.mul(g.noise(g.scale_vec(P, (20.0, 20.0, 60.0)), 1.0, 2.0), 9.0))),
                      0.2, 1.0)
        k = g.mul(sides, g.add(g.mul(s, 0.18), g.mul(bands, 0.35), g.mul(wav, 0.18)))
        col = g.mix(k, col, tuple(c * 0.6 for c in base))
        h = g.add(h, g.mul(sides, g.add(g.mul(s, 0.6), g.mul(wav, 0.5))))
    g.p('Base Color', col)
    g.p('Roughness', 0.78)
    g.p('Sheen Weight', 0.25)
    g.p('Subsurface Weight', 0.08)
    g.p('Subsurface Radius', (1.0, 0.95, 0.85))
    g.p('Subsurface Scale', 0.002)
    g.p('Normal', g.bump(h, 0.12, 0.0003))


@cached
def glass(m, tint=(0.94, 0.985, 0.975)):
    """Clear soda-lime glass with a whisper of green in thick sections."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 50.0, 2.0)
    g.p('Base Color', tint)
    g.p('Transmission Weight', 1.0)
    g.p('IOR', 1.5)
    g.p('Roughness', g.mul(g.remap(n, 0.6, 0.8), 0.04))


@cached
def acrylic(m, color=GREEN_ACRYLIC):
    """Polished cast acrylic (the 'spreadsheet tabs'): IOR 1.49, 70% transmission so the
    sheet shows depth and the walnut through it in green (95%), the rest a green body; glassy
    roughness with a faint frost of handling marks; the polished edge facets carry light
    along the sheet and glow a little brighter and more saturated (light piping)."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 90.0, 3.0)
    prints = g.fingerprints(P, 70.0)
    _, _, nz = g.sep(g.texco().outputs['Normal'])
    rim = g.remap(g.math('ABSOLUTE', nz), 0.45, 0.1)
    # Principled tints every refraction event: a sheet is two interfaces, so each gets the
    # square root of the sheet's colour (one sheet reads #1F9A52 over white, a stack darker)
    tint = tuple(c ** 0.5 for c in color)
    body = tuple(min(1.0, c * 1.25) for c in color)
    col = g.mix(g.mul(n, 0.2), tint, tuple(min(1.0, c * 1.1) for c in tint))
    g.p('Base Color', g.mix(g.mul(rim, 0.6), col, tuple(min(1.0, c * 1.3) for c in tint)))
    g.p('Transmission Weight', g.sub(0.95, g.mul(rim, 0.3)))
    g.p('IOR', 1.49)
    g.p('Roughness', g.add(0.008, g.mul(prints, 0.10), g.mul(g.remap(n, 0.6, 0.8), 0.02)))
    g.p('Specular IOR Level', 0.5)
    g.p('Coat Weight', 0.0)
    g.p('Subsurface Weight', 0.0)
    g.p('Emission Color', body)
    g.p('Emission Strength', g.mul(rim, 0.6))
    m.cycles.emission_sampling = 'NONE'


# Cobalt surfaces are lit far brighter than a screen field, and AgX lifts and desaturates them
# toward periwinkle: the base colour sits deeper than #0757EC so lit faces land on it.
COBALT_DEEP = (0.0, 0.024, 0.40)


@cached
def cobalt_vinyl(m):
    """Binder cover: cobalt PVC. A pebbled leather grain (1 mm cells over a 4-6 mm wobble)
    deep enough to break the highlight into a sparkle and to shade its own valleys darker;
    paler, rougher rubbed wear on the corners, the open edges and the spine's crown (the
    edge mask the binder writes as attribute 'wear'), and a few faint scuffs on the faces."""
    g = G(m)
    P = g.coords()
    grain, _ = g.voronoi(P, 950.0)
    grain2, _ = g.voronoi(P, 330.0)
    wob = g.noise(P, 180.0, 3.0, 0.6)
    n = g.noise(P, 20.0, 3.0)
    wear = g.attr('wear', 'GEOMETRY').outputs['Fac']
    wear = g.mul(wear, g.remap(g.noise(P, 120.0, 3.0, 0.6), 0.30, 0.60))
    scuff = g.mul(g.remap(g.noise(g.scale_vec(g.vrot(P, 22.0), (14.0, 160.0, 14.0)), 1.0, 3.0, 0.6), 0.66, 0.80),
                  g.remap(g.noise(P, 9.0, 2.0), 0.5, 0.7))
    valley = g.remap(grain, 0.0, 0.45, smooth=True)            # 0 in the pits between pebbles
    shade = g.add(0.72, g.mul(valley, 0.28))
    col = g.mix(g.mul(n, 0.12), COBALT_DEEP, (0.0, 0.018, 0.36))
    col = g.colmul(col, g.comb(shade, shade, shade))
    col = g.mix(g.add(g.mul(wear, 0.55), g.mul(scuff, 0.25)), col, (0.10, 0.17, 0.46))
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.26, g.mul(grain, 0.24), g.mul(wob, 0.08), g.mul(wear, 0.22), g.mul(scuff, 0.15)))
    g.p('Sheen Weight', 0.25)
    g.p('Normal', g.bump(g.add(g.mul(grain, 0.8), g.mul(grain2, 0.5), g.mul(wob, 0.5), g.mul(scuff, -0.3)), 0.8,
                         0.0007))


@cached
def cobalt_paint(m, rough=0.35):
    g = G(m)
    P = g.coords()
    n = g.noise(P, 60.0, 3.0)
    g.p('Base Color', g.mix(g.mul(n, 0.2), COBALT_DEEP, (0.0, 0.02, 0.42)))
    g.p('Roughness', g.add(rough, g.mul(n, 0.08)))
    g.p('Coat Weight', 0.4)
    g.p('Coat Roughness', 0.15)


@cached
def smoked_glass(m):
    """Head-wall panels for the S02/S05 option (Room.head_mirror): smoked black glass that
    mirrors the screens and the slab behind the host as soft colour discs."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 3.0, 3.0, 0.5)
    g.p('Base Color', (0.004, 0.0045, 0.006))
    g.p('Roughness', g.add(0.035, g.mul(n, 0.02)))
    g.p('Specular IOR Level', 0.9)
    g.p('Coat Weight', 1.0)
    g.p('Coat Roughness', 0.02)
    g.p('Coat IOR', 1.6)


@cached
def dark_glass(m, value=0.01, rough=0.04):
    """Black glossy glass/plastic (droid visor, hub panel)."""
    g = G(m)
    g.p('Base Color', (value, value, value * 1.1))
    g.p('Roughness', rough)
    g.p('Coat Weight', 1.0)
    g.p('Coat Roughness', 0.02)


@cached
def flat(m, color=(0.5, 0.5, 0.5), rough=0.5, metal=0.0):
    g = G(m)
    g.p('Base Color', color)
    g.p('Roughness', rough)
    g.p('Metallic', metal)


@cached
def led(m, color=LED_GREEN, strength=8.0, prop='led', base=None):
    """Small indicator lamp: emission scaled by the object's keyed custom property `prop` (0..1).

    The lens stays visible when off (dark tinted dome); base= sets its unlit grey instead
    (the cup's slot glow: near black, so the slot reads dark when the glow is off)."""
    g = G(m)
    a = g.attr(prop)
    g.p('Base Color', tuple(0.15 * c for c in color) if base is None else (base, base, base))
    g.p('Roughness', 0.15)
    g.p('Coat Weight', 1.0)
    g.p('Emission Color', color)
    g.p('Emission Strength', g.mul(a.outputs['Fac'], strength))
    m.cycles.emission_sampling = 'NONE'


@cached
def emit(m, color=(1, 1, 1), strength=1.0, sample='AUTO'):
    g = G(m, principled=False)
    e = g.node('ShaderNodeEmission')
    g._set(e.inputs['Color'], color)
    g._set(e.inputs['Strength'], strength)
    g.L.new(e.outputs[0], g.out.inputs['Surface'])
    m.cycles.emission_sampling = sample


@cached
def skylight_diffuser(m, strength=1.9, width=0.77, pitch=2.6):
    """The skylight seen from the room: a daylight slot, not a tube fixture.

    Peaks near 0.85 display at its centre line and falls off softly toward its edges;
    glazing bars are only 20 mm every `pitch` m and barely darker. Glossy rays see it at
    40% (the walnut coat and the brass keep their texture under its reflection). Emission
    is front-facing only and the plane casts no shadow, so the sun lays the hard slab.
    Strength stays on the Math node feeding Emission.Strength (inputs[1]): Room.set_state
    keys it there."""
    g = G(m, principled=False)
    e = g.node('ShaderNodeEmission')
    bb = g.node('ShaderNodeBlackbody')
    bb.inputs['Temperature'].default_value = 6500
    x, y, z = g.sep(g.obj())
    u = g.math('DIVIDE', x, width / 2)
    grad = g.sub(1.0, g.mul(g.math('POWER', g.math('ABSOLUTE', u), 2.0), 0.38))
    ph = g.math('FRACT', g.math('DIVIDE', y, pitch))
    bar = g.remap(g.math('ABSOLUTE', g.sub(ph, 0.5)), 0.5 - 0.010 / pitch, 0.5 - 0.004 / pitch, 1.0, 0.9)
    lp = g.node('ShaderNodeLightPath')
    # a black flag for long glossy paths: the walnut at the table's foot mirrors the slot's
    # far end ~30 m away as a hot patch that pulls the eye to the near edge of the wide; a
    # glossy ray longer than ~20 m sees the slot fade out (face glass, brass, lid and padlock
    # near the head mirror it from a few metres and keep it)
    far = g.remap(lp.outputs['Ray Length'], 17.0, 24.0, smooth=True)
    gfac = g.sub(1.0, g.mul(lp.outputs['Is Glossy Ray'], g.add(0.6, g.mul(far, 0.4))))
    pat = g.mul(grad, bar, gfac)
    g._set(e.inputs['Color'], bb.outputs[0])
    g._set(e.inputs['Strength'], g.math('MULTIPLY', pat, strength))
    g.L.new(e.outputs[0], g.out.inputs['Surface'])
    m.cycles.emission_sampling = 'FRONT'


@cached
def skylight_well(m, z0=6.0, depth=0.9):
    """The light well's plaster: warm white, sunlit near the top and falling to a warm
    shadow at the ceiling line, so the slot reads as deep. A faint self-glow carries the
    sky bounce (no extra light to sample)."""
    g = G(m)
    P = g.coords()
    _, _, z = g.sep(g.obj())
    n = g.noise(P, 30.0, 4.0)
    t = g.remap(z, z0, z0 + depth * 0.95, smooth=True)
    col = g.mix(t, (0.32, 0.27, 0.21), (0.72, 0.64, 0.52))
    g.p('Base Color', g.mix(g.mul(n, 0.15), col, (0.5, 0.45, 0.38)))
    g.p('Roughness', 0.9)
    g.p('Emission Color', (1.0, 0.84, 0.64))
    g.p('Emission Strength', g.mul(g.mul(t, t), 0.55))
    g.p('Normal', g.bump(n, 0.1, 0.002))
    m.cycles.emission_sampling = 'NONE'


# ------------------------------------------------------------------ the CRT screen

CRT_DEFAULTS = dict(on=1.0, gain=1.0, sx=1.0, sy=1.0, white=0.0, band=-0.3, bamt=0.0, deg=0.0, glow=0.0,
                    flare=1.0)
SCAN = dict(lines=120.0, near=1.1, far=1.7)      # scanlines fade out between near and far (m), see scanline_range
# a coarse raster ripple (shadow-mask beat) that stays moire-safe at shot distances, so a
# screen in a close shot reads as a raster even where the true lines are sub-pixel
RASTER = dict(lines=48.0, amp=0.10, near=2.8, far=4.2)


def scanline_range(lens_mm, res_x, sensor_mm=36.0, lines=SCAN['lines'], screen_h=0.228):
    """View distances (full, gone) at which the CRT scanlines resolve at >= 3 px and fall
    below 2 px per line pair for a given lens and render width (moire-safe fade)."""
    pitch = screen_h / lines
    k = lens_mm * res_x / sensor_mm
    return pitch * k / 3.0, pitch * k / 2.0


def set_scanlines(lens_mm, res_x, sensor_mm=36.0):
    """Retune the shared CRT material's scanline fades (fine lines and the coarse raster
    ripple) for a camera (call once per shot). Returns the fine lines' (near, far)."""
    near, far = scanline_range(lens_mm, res_x, sensor_mm)
    rn, rf = scanline_range(lens_mm, res_x, sensor_mm, RASTER['lines'])
    m = crt_screen()
    for nm, v in (('scan_near', near), ('scan_far', far), ('raster_near', rn), ('raster_far', rf)):
        n = m.node_tree.nodes.get(nm)
        if n is not None:
            n.outputs[0].default_value = v
    return near, far


def _crt_state(g):
    """Shared CRT state graph: per-object props, field mask and intensity terms."""
    u, v, _ = g.sep(g.uv())
    A = {k: g.attr('crt_' + k).outputs['Fac'] for k in CRT_DEFAULTS}
    rgb = g.attr('crt_rgb').outputs['Color']
    level = g.attr('crt_level').outputs['Fac']
    du = g.math('DIVIDE', g.math('ABSOLUTE', g.sub(u, 0.5)), 0.93)
    dv = g.math('DIVIDE', g.math('ABSOLUTE', g.sub(v, 0.5)), 0.91)
    hx = g.mul(A['sx'], 0.5)
    hy = g.mul(A['sy'], 0.5)
    return u, v, A, rgb, level, du, dv, hx, hy


@cached
def crt_screen(m):
    """ONE material for every CRT. All state is read from the screen object's custom properties:

        crt_rgb   colour of the field (linear RGB)          crt_level  emission strength
        crt_on    power 0..1                                crt_gain   brightness multiplier (speech pulse)
        crt_flare flare multiplier (independent of gain)    crt_white  tint toward white (collapse)
        crt_sx/sy field extent (1 = full, ~0.01 = line/dot) crt_band   u position of the pale speech band
        crt_bamt  band strength 0..1                        crt_deg    degauss shimmer 0..1
        crt_glow  phosphor afterglow dot 0..1

    u runs left -> right as the viewer faces the screen. Field = colour x scanlines x
    CRT corner falloff; scanlines fade by view distance (set_scanlines retunes the fade
    per camera so they never moire). The glass is dark grey-green and glossy, so an
    off screen still reads as a curved tube. Phosphor bloom lives in crt_halo."""
    g = G(m)
    u, v, A, rgb, level, du, dv, hx, hy = _crt_state(g)
    # the lit raster: a rounded rectangle (corner radius 14 mm, shrinking with the field as
    # it collapses to a line and a dot), its edge soft over ~1 mm, measured in metres on the glass
    kx, ky = 0.93 * CRT['screen_w'], 0.91 * CRT['screen_h']
    ax, ay = g.mul(du, kx), g.mul(dv, ky)
    hxm, hym = g.mul(hx, kx), g.mul(hy, ky)
    rc = g.math('MINIMUM', g.math('MINIMUM', g.mul(hxm, 0.9), g.mul(hym, 0.9)), 0.014)
    qx = g.math('MAXIMUM', g.sub(ax, g.sub(hxm, rc)), 0.0)
    qy = g.math('MAXIMUM', g.sub(ay, g.sub(hym, rc)), 0.0)
    sdf = g.sub(g.math('SQRT', g.add(g.mul(qx, qx), g.mul(qy, qy))), rc)
    field = g.remap(sdf, 0.0012, -0.0008, smooth=True)
    cam = g.node('ShaderNodeCameraData')
    vn = g.node('ShaderNodeValue', name='scan_near', label='scan_near')
    vn.outputs[0].default_value = SCAN['near']
    vf = g.node('ShaderNodeValue', name='scan_far', label='scan_far')
    vf.outputs[0].default_value = SCAN['far']
    near = g.remap(cam.outputs['View Distance'], vf.outputs[0], vn.outputs[0], smooth=True)
    scan = g.remap(g.math('SINE', g.mul(v, 2 * math.pi * SCAN['lines'])), -1.0, 1.0, 0.0, 1.0)
    scan = g.sub(1.0, g.mul(near, g.mul(scan, 0.32)))
    rvn = g.node('ShaderNodeValue', name='raster_near', label='raster_near')
    rvn.outputs[0].default_value = RASTER['near']
    rvf = g.node('ShaderNodeValue', name='raster_far', label='raster_far')
    rvf.outputs[0].default_value = RASTER['far']
    rnear = g.remap(cam.outputs['View Distance'], rvf.outputs[0], rvn.outputs[0], smooth=True)
    rip = g.remap(g.math('SINE', g.mul(v, 2 * math.pi * RASTER['lines'])), -1.0, 1.0, 0.0, 1.0)
    scan = g.mul(scan, g.sub(1.0, g.mul(rnear, g.mul(rip, RASTER['amp'] * 2.0))))
    r2 = g.add(g.mul(du, du), g.mul(dv, dv))
    # centre-weighted phosphor falloff: the beam lands obliquely and defocuses toward the
    # corners. Brighter fields fall off harder in linear terms, so the corners read 25-35%
    # darker on the display whatever the field's level (AgX compresses bright fields)
    kv = g.add(1.2, g.mul(g.math('MINIMUM', level, 3.0), 0.7))
    vig = g.math('EXPONENT', g.mul(g.mul(kv, g.math('POWER', r2, 1.5)), -1.0))
    # inner halation: the field brightens a touch toward its centre
    halo_in = g.add(0.94, g.mul(g.sub(1.0, g.math('MINIMUM', r2, 1.0)), 0.06))
    # a small hot white core (crt_core, per screen: the acid yellow and the lime, which the
    # view transform can only show dim and olive, get a brighter, paler centre)
    core = g.mul(g.math('EXPONENT', g.mul(r2, -7.0)), g.attr('crt_core').outputs['Fac'])
    d = g.math('DIVIDE', g.sub(u, A['band']), 0.075)
    band = g.mul(g.math('EXPONENT', g.mul(g.mul(d, d), -1.0)), A['bamt'])
    sh = g.math('SINE', g.add(g.mul(u, 21.0), g.mul(v, 9.0), g.mul(A['deg'], 70.0)))
    hue = g.node('ShaderNodeHueSaturation')
    g._set(hue.inputs['Hue'], g.add(0.5, g.mul(g.mul(sh, A['deg']), 0.22)))
    g._set(hue.inputs['Saturation'], g.add(1.0, g.mul(A['deg'], 0.4)))
    g._set(hue.inputs['Value'], g.add(1.0, g.mul(g.mul(sh, A['deg']), 0.35)))
    g._set(hue.inputs['Color'], g.mix(g.add(g.mul(band, 0.55), A['white'], core), rgb, (1.0, 1.0, 1.0)))
    col = hue.outputs['Color']
    dot = g.mul(g.math('EXPONENT', g.mul(r2, -2500.0)), A['glow'])
    inten = g.mul(field, scan, vig, halo_in, A['gain'], A['flare'], A['on'], level, g.add(1.0, g.mul(band, 0.7)),
                  g.add(1.0, g.mul(core, 1.6)))
    e1 = g.mix(1.0, col, g.comb(inten, inten, inten), 'MULTIPLY')
    glowc = g.mix(0.5, rgb, (1.0, 1.0, 1.0))
    gd = g.mul(dot, level, 1.2)
    e2 = g.mix(1.0, glowc, g.comb(gd, gd, gd), 'MULTIPLY')
    em = g.mix(1.0, e1, e2, 'ADD')
    g.p('Base Color', (0.008, 0.010, 0.009))     # dark phosphor glass: a dead tube stays dead under a neighbour's glow
    # crt_dead (static, Pat): a dusty, filmed tube whose glass no longer mirrors the screen
    # across the table, so the dead colleague reads neutral dark grey, not a dim colour
    dead = g.attr('crt_dead').outputs['Fac']
    g.p('Roughness', g.add(0.07, g.mul(dead, 0.13)))
    g.p('Specular IOR Level', g.sub(0.55, g.mul(dead, 0.27)))
    g.p('Emission Color', em)
    g.p('Emission Strength', 1.0)
    g.p('Coat Weight', g.sub(0.5, g.mul(dead, 0.2)))
    g.p('Coat Roughness', g.add(0.03, g.mul(dead, 0.15)))
    m.cycles.emission_sampling = 'NONE'


@cached
def crt_halo(m):
    """Phosphor bloom: an additive glow card in front of each screen, seen by camera rays
    only (it lights nothing and is not reflected). It follows the field's extent, so the
    shutdown collapses it to a glowing line, then a dot."""
    g = G(m, principled=False)
    u, v, A, rgb, level, du, dv, hx, hy = _crt_state(g)
    W, H = CRT['screen_w'], CRT['screen_h']
    # distance (m) from a rectangle 4 mm inside the field's edge: the bloom starts on the
    # glass and runs out over the bezel, with no hard inner border
    ox = g.math('MAXIMUM', g.add(g.mul(g.sub(du, hx), W * 0.93), 0.004), 0.0)
    oy = g.math('MAXIMUM', g.add(g.mul(g.sub(dv, hy), H * 0.91), 0.004), 0.0)
    dist = g.math('SQRT', g.add(g.mul(ox, ox), g.mul(oy, oy)))
    inner = g.remap(dist, 0.0, 0.006, smooth=True)
    bloom = g.attr('crt_bloom').outputs['Fac']                     # wide soft bloom (Pat in the dark)
    far_r = g.add(0.032, g.mul(bloom, 0.06))
    lobe = g.add(g.mul(g.math('EXPONENT', g.mul(dist, -1.0 / 0.010)), 0.14),
                 g.mul(g.math('EXPONENT', g.math('DIVIDE', g.mul(dist, -1.0), far_r)), g.add(0.07, g.mul(bloom, 0.25))))
    r2 = g.add(g.mul(du, du), g.mul(dv, dv))
    dot = g.mul(g.math('EXPONENT', g.mul(r2, -350.0)), A['glow'], 0.35)
    window = g.remap(dist, 0.15, 0.075, smooth=True)               # fades to zero before the card edge
    k = g.add(g.mul(lobe, inner, window, A['gain'], A['flare'], A['on']), dot)
    k = g.mul(k, level)
    hue = g.attr('crt_hue').outputs['Color']                       # the colleague's own hex, not the boosted field
    col = g.mix(g.mul(A['white'], 0.8), hue, (1.0, 1.0, 1.0))
    em = g.node('ShaderNodeEmission')
    g._set(em.inputs['Color'], col)
    g._set(em.inputs['Strength'], k)
    tr = g.node('ShaderNodeBsdfTransparent')
    add = g.node('ShaderNodeAddShader')
    g.L.new(tr.outputs[0], add.inputs[0])
    g.L.new(em.outputs[0], add.inputs[1])
    lp = g.node('ShaderNodeLightPath')
    tr2 = g.node('ShaderNodeBsdfTransparent')
    mx = g.node('ShaderNodeMixShader')
    g.L.new(lp.outputs['Is Camera Ray'], mx.inputs['Fac'])
    g.L.new(tr2.outputs[0], mx.inputs[1])
    g.L.new(add.outputs[0], mx.inputs[2])
    g.L.new(mx.outputs[0], g.out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'


# ================================================================== mesh helpers


def rrect(w, h, r, seg=6, cx=0.0, cy=0.0):
    """Rounded-rectangle outline, CCW, 4*(seg+1) points (corner arcs always present,
    so rings of different sizes correspond point for point)."""
    r = max(1e-4, min(r, w / 2 - 1e-4, h / 2 - 1e-4))
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        ox, oy = cx + sx * (w / 2 - r), cy + sy * (h / 2 - r)
        for i in range(seg + 1):
            a = math.radians(90 * k + 90 * i / seg)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def stadium(length, width, seg=16, cx=0.0, cy=0.0):
    """Rounded slot (the sip-hole / skylight shape), long axis along X, CCW."""
    r = width / 2
    a = max(0.0, length / 2 - r)
    pts = []
    for i in range(seg + 1):
        t = -math.pi / 2 + math.pi * i / seg
        pts.append((cx + a + r * math.cos(t), cy + r * math.sin(t)))
    for i in range(seg + 1):
        t = math.pi / 2 + math.pi * i / seg
        pts.append((cx - a + r * math.cos(t), cy + r * math.sin(t)))
    return pts


def resample_closed(pts, n):
    """Resample a closed 2D polyline to n points evenly spaced by arc length."""
    P = np.asarray(pts + [pts[0]], dtype=float)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    t = np.linspace(0.0, s[-1], n, endpoint=False)
    x = np.interp(t, s, P[:, 0])
    y = np.interp(t, s, P[:, 1])
    return list(zip(x.tolist(), y.tolist()))


def catmull(points, samples_per_seg=12, closed=False):
    """Centripetal Catmull-Rom through 3D points -> dense polyline (list of Vector)."""
    P = [Vector(p) for p in points]
    if len(P) < 3:
        out = []
        for i in range(samples_per_seg + 1):
            out.append(P[0].lerp(P[-1], i / samples_per_seg))
        return out
    if closed:
        P = [P[-1]] + P + [P[0], P[1]]
    else:
        P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]

        def tj(ti, a, b):
            return ti + max((b - a).length, 1e-6) ** 0.5
        t0 = 0.0
        t1 = tj(t0, p0, p1)
        t2 = tj(t1, p1, p2)
        t3 = tj(t2, p2, p3)
        n = samples_per_seg
        for k in range(n):
            t = t1 + (t2 - t1) * k / n
            a1 = p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
            a2 = p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
            a3 = p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
            b1 = a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
            b2 = a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
            out.append(b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1)))
    if not closed:
        out.append(Vector(points[-1]))
    return out


def polyline_length(pts):
    return sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))


class Path:
    """Arc-length parametrised polyline: pos(s), tangent(s); extends linearly past both ends."""

    def __init__(self, pts):
        self.p = [Vector(x) for x in pts]
        d = [0.0]
        for i in range(len(self.p) - 1):
            d.append(d[-1] + (self.p[i + 1] - self.p[i]).length)
        self.s = d
        self.length = d[-1]

    def _seg(self, s):
        if s <= 0:
            return 0
        if s >= self.length:
            return len(self.p) - 2
        lo, hi = 0, len(self.s) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.s[mid] <= s:
                lo = mid
            else:
                hi = mid
        return lo

    def pos(self, s):
        i = self._seg(s)
        a, b = self.p[i], self.p[i + 1]
        L = max(self.s[i + 1] - self.s[i], 1e-9)
        return a.lerp(b, (s - self.s[i]) / L) if 0 <= s <= self.length else a + (b - a).normalized() * (s - self.s[i])

    def tangent(self, s, h=0.05):
        t = self.pos(s + h) - self.pos(s - h)
        return t.normalized() if t.length > 1e-9 else Vector((0, 1, 0))


def frames_along(pts, up=(0, 0, 1)):
    """Parallel-transport frames (T, N, B) along a 3D polyline."""
    P = [Vector(p) for p in pts]
    n = len(P)
    T = []
    for i in range(n):
        a = P[max(i - 1, 0)]
        b = P[min(i + 1, n - 1)]
        t = (b - a)
        T.append(t.normalized() if t.length > 1e-12 else Vector((0, 1, 0)))
    upv = Vector(up)
    N0 = upv - T[0] * upv.dot(T[0])
    if N0.length < 1e-6:
        N0 = Vector((1, 0, 0)) - T[0] * T[0].x
    N = [N0.normalized()]
    for i in range(1, n):
        v = N[-1] - T[i] * N[-1].dot(T[i])
        N.append(v.normalized() if v.length > 1e-9 else N[-1])
    B = [T[i].cross(N[i]) for i in range(n)]
    return T, N, B


# --- bmesh builders (all return created verts so callers can bridge/cap)


def bm_ring(bm, pts3):
    return [bm.verts.new(p) for p in pts3]


def bm_bridge(bm, a, b, mat=0, closed=True):
    faces = []
    n = len(a)
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        try:
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = mat
            faces.append(f)
        except ValueError:
            pass
    return faces


def bm_cap(bm, ring, mat=0, flip=False):
    try:
        f = bm.faces.new(list(reversed(ring)) if flip else ring)
        f.material_index = mat
        return f
    except ValueError:
        return None


def bm_fan(bm, ring, center, mat=0, flip=False):
    c = bm.verts.new(center)
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        vs = (ring[i], ring[j], c) if not flip else (ring[j], ring[i], c)
        f = bm.faces.new(vs)
        f.material_index = mat
    return c


def bm_loft(bm, rings, closed=True, cap0=False, cap1=False, mat=0):
    vr = [bm_ring(bm, r) for r in rings]
    for a, b in zip(vr, vr[1:]):
        bm_bridge(bm, a, b, mat, closed)
    if cap0:
        bm_cap(bm, vr[0], mat, flip=True)
    if cap1:
        bm_cap(bm, vr[-1], mat)
    return vr


def bm_prism(bm, outline, z0, z1, mat=0, cap0=True, cap1=True, axis='Z'):
    """Extrude a 2D outline between two levels along an axis."""
    def p3(x, y, z):
        if axis == 'Z':
            return (x, y, z)
        if axis == 'Y':     # outline in XZ, extruded along Y
            return (x, z, y)
        return (z, x, y)    # 'X': outline in YZ
    a = [p3(x, y, z0) for x, y in outline]
    b = [p3(x, y, z1) for x, y in outline]
    return bm_loft(bm, [a, b], True, cap0, cap1, mat)


def bm_lathe(bm, profile, seg=64, mat=0, a0=0.0, a1=2 * math.pi, axis_tol=1e-6):
    """Revolve a (r, z) profile about Z. Points with r==0 become poles."""
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    count = seg if full else seg + 1
    rings = []
    for r, z in profile:
        if r < axis_tol:
            rings.append(bm.verts.new((0.0, 0.0, z)))
        else:
            ring = []
            for i in range(count):
                a = a0 + (a1 - a0) * i / seg
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        if isinstance(ra, list) and isinstance(rb, list):
            bm_bridge(bm, ra, rb, mat, closed=full)
        elif isinstance(ra, list):
            n = len(ra)
            for i in range(n if full else n - 1):
                f = bm.faces.new((ra[i], ra[(i + 1) % n], rb))
                f.material_index = mat
        elif isinstance(rb, list):
            n = len(rb)
            for i in range(n if full else n - 1):
                f = bm.faces.new((ra, rb[(i + 1) % n], rb[i]))
                f.material_index = mat
    return rings


def bm_tube(bm, pts, radius, sides=12, caps=True, mat=0, up=(0, 0, 1)):
    """Sweep a circle along a polyline (radius may be a float or a per-point list)."""
    T, N, B = frames_along(pts, up)
    rings = []
    for i, p in enumerate(pts):
        r = radius[i] if isinstance(radius, (list, tuple)) else radius
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            ring.append(Vector(p) + (N[i] * math.cos(a) + B[i] * math.sin(a)) * r)
        rings.append(ring)
    vr = bm_loft(bm, rings, True, False, False, mat)
    if caps:
        bm_fan(bm, vr[0], Vector(pts[0]), mat, flip=False)
        bm_fan(bm, vr[-1], Vector(pts[-1]), mat, flip=True)
    return vr


def pillow_rings(w, d, h, r_plan, r_edge, steps=4, seg=6, width_fn=None, bend=0.0, z0=0.0):
    """Horizontal rounded-rect slices of a soft box (cushion, case), bottom to top.

    The vertical profile is a quarter-round of radius r_edge at both the bottom and
    top edges. width_fn(zn) scales the width with normalised height (rounded tops of
    chair backs); bend pushes points along +Y by bend*(2x/w)^2 (concave backs)."""
    rings = []
    prof = []
    for i in range(steps + 1):     # bottom quarter round: inset shrinks to 0
        a = math.pi / 2 * i / steps
        prof.append((r_edge * (1 - math.sin(a)), r_edge * (1 - math.cos(a))))
    for i in range(steps + 1):     # top quarter round
        a = math.pi / 2 * i / steps
        prof.append((r_edge * (1 - math.cos(a)), h - r_edge + r_edge * math.sin(a)))
    for inset, z in prof:
        zn = z / h
        ww = w * (width_fn(zn) if width_fn else 1.0)
        ring = []
        for x, y in rrect(ww - 2 * inset, d - 2 * inset, max(r_plan - inset, 0.002), seg):
            yy = y + bend * (2 * x / w) ** 2
            ring.append((x, yy, z0 + z))
        rings.append(ring)
    return rings


def bm_pillow(bm, w, d, h, r_plan, r_edge, mat=0, steps=4, seg=6, width_fn=None, bend=0.0, z0=0.0,
              crown=0.0, cap_rings=4):
    rings = pillow_rings(w, d, h, r_plan, r_edge, steps, seg, width_fn, bend, z0)
    vr = bm_loft(bm, rings, True, False, False, mat)
    # domed caps from concentric shrinking rings
    for end, sign in ((0, -1), (-1, 1)):
        base = rings[end]
        cx = sum(p[0] for p in base) / len(base)
        cy = sum(p[1] for p in base) / len(base)
        prev = vr[end]
        for k in range(1, cap_rings + 1):
            s = 1.0 - k / (cap_rings + 1)
            dz = crown * (1 - s * s) * (1 if sign > 0 else -0.3)
            ring = bm_ring(bm, [(cx + (p[0] - cx) * s, cy + (p[1] - cy) * s, p[2] + dz) for p in base])
            if sign > 0:
                bm_bridge(bm, prev, ring, mat)
            else:
                bm_bridge(bm, ring, prev, mat)
            prev = ring
        bm_fan(bm, prev, (cx, cy, base[0][2] + crown * (1 if sign > 0 else -0.3)), mat, flip=(sign < 0))
    return vr


def to_object(bm, name, mats=(), coll=None, smooth=None, recalc=True):
    """bmesh -> mesh object. smooth=angle (deg) shades smooth with sharp edges above it."""
    if recalc:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(obj)
    if smooth is not None:
        C.smooth(obj, smooth)
    return obj


def soft_bevel(obj, width=0.003, segments=3, angle=30.0):
    """Real geometric bevel on every hard edge, with hardened normals."""
    m = obj.modifiers.new('Bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = True
    m.miter_outer = 'MITER_ARC'
    return m


def box(name, size, center=(0, 0, 0), mat=None, coll=None, bevel=0.0, segments=3, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    obj = to_object(bm, name, [mat] if mat else [], coll, smooth=30.0)
    obj.location = center
    if rot is not None:
        obj.rotation_euler = rot
    if bevel > 0:
        soft_bevel(obj, bevel, segments)
    return obj


def cylinder(name, r, h, center=(0, 0, 0), mat=None, coll=None, seg=32, axis='Z', bevel=0.0):
    bm = bmesh.new()
    bm_lathe(bm, [(0, -h / 2), (r, -h / 2), (r, h / 2), (0, h / 2)], seg)
    obj = to_object(bm, name, [mat] if mat else [], coll, smooth=35.0)
    obj.location = center
    if axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    if bevel > 0:
        soft_bevel(obj, bevel, 2)
    return obj


def parent(child, par, keep=False):
    """Parent without the inverse matrix (child keeps its local transform)."""
    mw = child.matrix_world.copy()
    child.parent = par
    if keep:
        child.matrix_world = mw
    return child


def root(name, coll=None, location=(0, 0, 0), rot_z=0.0, size=0.2):
    e = C.empty(name, coll, location, 'PLAIN_AXES', size)
    e.rotation_euler = (0, 0, rot_z)
    return e


def proto(name):
    """A data-only collection (never linked to the scene) used as an instancing source."""
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
    return c


def instance(proto_coll, name, coll=None, location=(0, 0, 0), rot_z=0.0):
    e = bpy.data.objects.new(name, None)
    e.instance_type = 'COLLECTION'
    e.instance_collection = proto_coll
    e.location = location
    e.rotation_euler = (0, 0, rot_z)
    (coll or bpy.context.scene.collection).objects.link(e)
    return e


def kprop(obj, prop, frame, value, interp='LINEAR'):
    """Key an object custom property (the animation channel materials read)."""
    obj[prop] = value
    path = f'["{prop}"]'
    obj.keyframe_insert(data_path=path, frame=frame)
    C.style_last_keys(obj, path, frame, interp, 'AUTO', 'AUTO_CLAMPED')


def add_driver(target, path, expr, variables, index=-1):
    """variables: list of (name, id_object, data_path). Simple expressions only (no Python at render)."""
    fc = target.driver_add(path, index) if index >= 0 else target.driver_add(path)
    drv = fc.driver
    drv.type = 'SCRIPTED'
    for name, idb, dpath in variables:
        v = drv.variables.new()
        v.name = name
        v.type = 'SINGLE_PROP'
        v.targets[0].id_type = 'OBJECT'
        v.targets[0].id = idb
        v.targets[0].data_path = dpath
    drv.expression = expr
    return fc


def bake_keys(obj, frames, fn):
    """fn(frame) -> (location, rotation_euler) ; keyed linearly every frame (motion-blur safe)."""
    for f in frames:
        loc, rot = fn(f)
        obj.location = loc
        obj.rotation_euler = rot
        obj.keyframe_insert('location', frame=f)
        obj.keyframe_insert('rotation_euler', frame=f)
    ad = obj.animation_data
    if ad and ad.action:
        for fc in C.fcurves(ad.action):
            for kp in fc.keyframe_points:
                if frames[0] <= kp.co.x <= frames[-1]:
                    kp.interpolation = 'LINEAR'


# ================================================================== coiled cords


def coil_group():
    """Geometry-nodes group 'SynCoil': a helix wound around any input curve, swept into a wire.

    Inputs: Curve, Turns (total, constant as the cord stretches), Coil Radius, Wire
    Radius, Samples per Turn, Profile, Material. Stretching the curve spreads the
    same number of turns over more length, as a real coiled cord does."""
    ng = bpy.data.node_groups.get('SynCoil')
    if ng is not None:
        return ng
    ng = bpy.data.node_groups.new('SynCoil', 'GeometryNodeTree')
    io = ng.interface
    io.new_socket('Curve', in_out='INPUT', socket_type='NodeSocketGeometry')
    s_turns = io.new_socket('Turns', in_out='INPUT', socket_type='NodeSocketFloat')
    s_turns.default_value = 100.0
    s_cr = io.new_socket('Coil Radius', in_out='INPUT', socket_type='NodeSocketFloat')
    s_cr.default_value = 0.0042
    s_wr = io.new_socket('Wire Radius', in_out='INPUT', socket_type='NodeSocketFloat')
    s_wr.default_value = 0.0013
    s_spt = io.new_socket('Samples per Turn', in_out='INPUT', socket_type='NodeSocketInt')
    s_spt.default_value = 8
    s_prof = io.new_socket('Profile', in_out='INPUT', socket_type='NodeSocketInt')
    s_prof.default_value = 6
    io.new_socket('Material', in_out='INPUT', socket_type='NodeSocketMaterial')
    io.new_socket('Mesh', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi = N.new('NodeGroupInput')
    go = N.new('NodeGroupOutput')

    def m(op, a, b):
        n = N.new('ShaderNodeMath')
        n.operation = op
        for i, x in enumerate((a, b)):
            if isinstance(x, bpy.types.NodeSocket):
                L.new(x, n.inputs[i])
            else:
                n.inputs[i].default_value = x
        return n.outputs[0]

    count = m('MULTIPLY', gi.outputs['Turns'], gi.outputs['Samples per Turn'])
    count = m('ADD', count, 1.0)
    res = N.new('GeometryNodeResampleCurve')
    res.mode = 'COUNT'
    L.new(gi.outputs['Curve'], res.inputs['Curve'])
    L.new(count, res.inputs['Count'])
    sp = N.new('GeometryNodeSplineParameter')
    theta = m('MULTIPLY', m('MULTIPLY', sp.outputs['Factor'], gi.outputs['Turns']), 2 * math.pi)
    nrm = N.new('GeometryNodeInputNormal')
    tan = N.new('GeometryNodeInputTangent')
    cr = N.new('ShaderNodeVectorMath')
    cr.operation = 'CROSS_PRODUCT'
    L.new(tan.outputs[0], cr.inputs[0])
    L.new(nrm.outputs[0], cr.inputs[1])
    c = N.new('ShaderNodeVectorMath')
    c.operation = 'SCALE'
    L.new(nrm.outputs[0], c.inputs[0])
    L.new(m('COSINE', theta, 0.0), c.inputs['Scale'])
    s = N.new('ShaderNodeVectorMath')
    s.operation = 'SCALE'
    L.new(cr.outputs[0], s.inputs[0])
    L.new(m('SINE', theta, 0.0), s.inputs['Scale'])
    off = N.new('ShaderNodeVectorMath')
    off.operation = 'ADD'
    L.new(c.outputs[0], off.inputs[0])
    L.new(s.outputs[0], off.inputs[1])
    off2 = N.new('ShaderNodeVectorMath')
    off2.operation = 'SCALE'
    L.new(off.outputs[0], off2.inputs[0])
    L.new(gi.outputs['Coil Radius'], off2.inputs['Scale'])
    # store the coil parameter (turn index) so the PVC texture rides with the wire
    # when the cord stretches or springs (no swimming)
    st = N.new('GeometryNodeStoreNamedAttribute')
    st.data_type = 'FLOAT'
    st.domain = 'POINT'
    st.inputs['Name'].default_value = 'cord_t'
    L.new(res.outputs[0], st.inputs['Geometry'])
    L.new(m('MULTIPLY', sp.outputs['Factor'], gi.outputs['Turns']), st.inputs['Value'])
    # and the centreline direction (the coil axis), for the crossing shading between turns
    st2 = N.new('GeometryNodeStoreNamedAttribute')
    st2.data_type = 'FLOAT_VECTOR'
    st2.domain = 'POINT'
    st2.inputs['Name'].default_value = 'cord_axis'
    L.new(st.outputs[0], st2.inputs['Geometry'])
    L.new(tan.outputs[0], st2.inputs['Value'])
    setp = N.new('GeometryNodeSetPosition')
    L.new(st2.outputs[0], setp.inputs['Geometry'])
    L.new(off2.outputs[0], setp.inputs['Offset'])
    circ = N.new('GeometryNodeCurvePrimitiveCircle')
    circ.mode = 'RADIUS'
    L.new(gi.outputs['Profile'], circ.inputs['Resolution'])
    L.new(gi.outputs['Wire Radius'], circ.inputs['Radius'])
    c2m = N.new('GeometryNodeCurveToMesh')
    L.new(setp.outputs[0], c2m.inputs['Curve'])
    L.new(circ.outputs['Curve'], c2m.inputs['Profile Curve'])
    c2m.inputs['Fill Caps'].default_value = True
    sm = N.new('GeometryNodeSetShadeSmooth')
    L.new(c2m.outputs[0], sm.inputs['Geometry'])
    sm.inputs['Shade Smooth'].default_value = True
    smat = N.new('GeometryNodeSetMaterial')
    L.new(sm.outputs[0], smat.inputs['Geometry'])
    L.new(gi.outputs['Material'], smat.inputs['Material'])
    L.new(smat.outputs[0], go.inputs['Mesh'])
    return ng


def _set_mod_inputs(mod, **vals):
    ng = mod.node_group
    for item in ng.interface.items_tree:
        if getattr(item, 'in_out', None) != 'INPUT' or item.socket_type == 'NodeSocketGeometry':
            continue
        key = item.name.replace(' ', '_').lower()
        if key in vals:
            mod[item.identifier] = vals[key]


def build_coil(points, name='Cord', coll=None, pitch=0.0075, coil_radius=0.0042, wire_radius=0.0013,
               samples_per_turn=8, profile=6, smooth_points=True, turns=None, mat=None):
    """A yellow coiled cord following `points` (helix-on-curve, geometry nodes).

    points: 3D points the cord's centreline passes through (world space).
    pitch: distance between turns at this length; `turns` overrides it.
    Returns the curve object (its spline points can be keyed/hooked; the coil follows)."""
    pts = catmull(points, 10) if smooth_points and len(points) > 2 else [Vector(p) for p in points]
    length = polyline_length(pts)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    obj = bpy.data.objects.new(name, cu)
    (coll or bpy.context.scene.collection).objects.link(obj)
    mod = obj.modifiers.new('Coil', 'NODES')
    mod.node_group = coil_group()
    n_turns = turns if turns is not None else max(1.0, length / pitch)
    _set_mod_inputs(mod, turns=float(n_turns), coil_radius=coil_radius, wire_radius=wire_radius,
                    samples_per_turn=int(samples_per_turn), profile=int(profile),
                    material=mat or cord_plastic())
    obj['cord_length'] = length
    obj['cord_turns'] = n_turns
    return obj


class MasterCord:
    """The hub's master cord: a NURBS curve hooked to empties, wound into a coil.

    e['anchor'] sits in the hub's port; e['tail'] and e['tail2'] ride on the jack
    (parented), so the cord follows the hand; e['mid0'..] shape the free run over
    the walnut and the head edge, and pulled() springs them."""

    def __init__(self, obj, empties, mids, floor_z=None, floor_xy=None):
        self.obj = obj
        self.e = empties
        self.mids = mids            # names of the free control points, hub -> jack
        # the walnut under the free run: control points inside floor_xy = (x0, x1, y0, y1)
        # never go below floor_z (the coil's outer radius + 0.5 mm above the top, so the
        # order-3 curve, which can undershoot its control polygon, stays clear of the wood)
        self.floor_z = floor_z
        self.floor_xy = floor_xy

    def _over_floor(self, p):
        if self.floor_z is None:
            return False
        if self.floor_xy is None:
            return True
        x0, x1, y0, y1 = self.floor_xy
        return x0 <= p.x <= x1 and y0 <= p.y <= y1

    def pulled(self, frame, kick=(0.0, 0.022, 0.03), cycles=2.0, decay=3.2, dur=22, relax=(0.0, -0.006, -0.004)):
        """Spring the free run of the coil when the jack leaves the socket at `frame`:
        an overshoot along `kick` that rings `cycles` damped oscillations and settles
        `relax` looser than before (it relaxes across the walnut).

        Points over the walnut (floor_xy) bounce instead of dipping: their vertical kick is
        |sin| (it lifts off the wood and drops back), their relax never lowers them, and
        every key is clamped to floor_z. Only the overhang past the head edge sags."""
        n = len(self.mids)
        for k, key in enumerate(self.mids):
            e = self.e[key]
            base = Vector(e.location)
            w = (k + 1) / n                      # the end near the jack moves most
            lag = int(round(2 * (1 - w)))        # the wave runs back toward the hub
            on_wood = self._over_floor(base)
            if on_wood:
                base.z = max(base.z, self.floor_z)
                e.location = base
            e.keyframe_insert('location', frame=frame + lag - 1)
            for i in range(0, dur + 1):
                t = i / dur
                amp = math.exp(-decay * t) * math.sin(2 * math.pi * cycles * t + 0.35)
                d = Vector(kick) * amp * w + Vector(relax) * C.ease(t) * w
                if on_wood:
                    d.z = abs(kick[2] * amp * w) + max(0.0, relax[2]) * C.ease(t) * w
                p = base + d
                if on_wood:
                    p.z = max(p.z, self.floor_z)
                e.location = p
                e.keyframe_insert('location', frame=frame + lag + i)


def master_cord(anchor_pos, tail_obj, tail_local=(0.0, 0.0, 0.0), mid_points=(), name='MasterCord',
                coll=None, turns=46, coil_radius=0.0042, wire_radius=0.0013, floor_z=None, floor_xy=None):
    """Coiled master cord from a fixed anchor (hub port) to a moving tail (the jack).

    mid_points: world points (hub -> jack) the cord should pass close to; the curve is
    an order-3 NURBS so it hugs them. tail2 continues the jack's axis a little so the
    coil leaves the strain relief straight. floor_z / floor_xy: the table top under the
    free run (MasterCord.pulled never sinks a control point inside floor_xy below floor_z)."""
    coll = coll or bpy.context.scene.collection
    mw = tail_obj.matrix_world
    tail_world = mw @ Vector(tail_local)
    tail2 = mw @ (Vector(tail_local) + Vector((0, 0.012, 0)))
    ctrl = [Vector(anchor_pos), Vector(anchor_pos) + Vector((0.0, 0.012, -0.002))] + [Vector(p) for p in mid_points] + \
        [tail2, tail_world]
    names = ['anchor', 'anchor2'] + [f'mid{i}' for i in range(len(mid_points))] + ['tail2', 'tail']
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('NURBS')
    sp.points.add(len(ctrl) - 1)
    for i, p in enumerate(ctrl):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    sp.order_u = 3
    sp.use_endpoint_u = True
    sp.resolution_u = 24
    obj = bpy.data.objects.new(name, cu)
    coll.objects.link(obj)
    empties = {}
    for nm, p in zip(names, ctrl):
        e = C.empty(f'{name}_{nm}', coll, tuple(p), 'SPHERE', 0.003)
        if nm in ('tail', 'tail2'):
            e.parent = tail_obj
            e.matrix_parent_inverse = tail_obj.matrix_world.inverted()
        empties[nm] = e
    bpy.context.view_layer.update()
    for i, nm in enumerate(names):
        h = obj.modifiers.new(f'Hook_{nm}', 'HOOK')
        h.object = empties[nm]
        h.vertex_indices_set([i])
        h.matrix_inverse = empties[nm].matrix_world.inverted()
    mod = obj.modifiers.new('Coil', 'NODES')
    mod.node_group = coil_group()
    _set_mod_inputs(mod, turns=float(turns), coil_radius=coil_radius, wire_radius=wire_radius,
                    samples_per_turn=10, profile=8, material=cord_plastic())
    return MasterCord(obj, empties, [n for n in names if n.startswith('mid')], floor_z, floor_xy)


# ================================================================== CRT terminal

# Local frame of a terminal: origin on the seat surface under the base, screen facing +Y.
CRT = dict(
    stand=0.07,          # base plate + swivel column
    w=0.40, h=0.39,      # case front
    front=0.19,          # case front face (local y)
    screen_w=0.300, screen_h=0.228,
    screen_dz=0.028,     # screen centre above the case centre (leaves a chin)
    cord_exit=(0.0, 0.192, 0.082),
)
CRT['zc'] = CRT['stand'] + CRT['h'] / 2
CRT['zs'] = CRT['zc'] + CRT['screen_dz']


def _case_rings():
    """(y, w, h, r, zc) cross-sections of the case, front to back."""
    W, H, F, zc = CRT['w'], CRT['h'], CRT['front'], CRT['zc']
    rows = []
    R = 0.010
    for i in range(5):      # quarter-round front edge
        a = math.pi / 2 * i / 4
        inset = R * (1 - math.sin(a))
        rows.append((F - R * (1 - math.cos(a)), W - 2 * inset, H - 2 * inset, 0.028 - inset, zc))
    rows += [
        (0.000, W, H, 0.028, zc),
        (-0.002, W - 0.008, H - 0.008, 0.024, zc),      # shell seam groove
        (-0.009, W - 0.008, H - 0.008, 0.024, zc),
        (-0.011, W - 0.003, H - 0.003, 0.027, zc),
        (-0.060, W - 0.004, H - 0.004, 0.028, zc - 0.001),
        (-0.150, 0.355, 0.345, 0.034, zc - 0.004),
        (-0.228, 0.290, 0.280, 0.040, zc - 0.008),
        (-0.236, 0.282, 0.272, 0.036, zc - 0.008),
        (-0.240, 0.268, 0.258, 0.030, zc - 0.008),
    ]
    return rows


def crt_case_proto():
    """Beige case, stand, knob and vents of the 1980s terminal (shared by all nine)."""
    pc = proto('PROTO_CRT')
    if len(pc.objects):
        return pc
    beige = beige_plastic(0.3)
    dark = black_plastic(0.5, 0.006)
    bm = bmesh.new()
    rings = []
    for y, w, h, r, zc in _case_rings():
        rings.append([(x, y, z + zc) for x, z in rrect(w, h, r, 6)])
    vr = bm_loft(bm, rings, True, False, True, 0)
    # bezel: front ring -> screen opening -> tunnel to the glass
    zs = CRT['zs']
    op = [(x, CRT['front'] - 0.003, z + zs) for x, z in rrect(0.318, 0.246, 0.026, 6)]
    t1 = [(x, CRT['front'] - 0.014, z + zs) for x, z in rrect(0.307, 0.235, 0.021, 6)]
    t2 = [(x, CRT['front'] - 0.018, z + zs) for x, z in rrect(0.302, 0.230, 0.019, 6)]
    vo = bm_ring(bm, op)
    v1 = bm_ring(bm, t1)
    v2 = bm_ring(bm, t2)
    bm_bridge(bm, vr[0], vo, 2)
    bm_bridge(bm, vo, v1, 2)
    bm_bridge(bm, v1, v2, 1)
    case = to_object(bm, 'crt_case', [beige, dark, crt_bezel()], pc, smooth=38.0, recalc=False)
    # normals: the loft runs front->back, so flip to point outward
    bm2 = bmesh.new()
    bm2.from_mesh(case.data)
    bmesh.ops.recalc_face_normals(bm2, faces=[f for f in bm2.faces])
    bm2.to_mesh(case.data)
    bm2.free()
    # stand: soft base plate and swivel column
    bm = bmesh.new()
    bm_pillow(bm, 0.27, 0.27, 0.022, 0.035, 0.007, steps=3)
    base = to_object(bm, 'crt_base', [beige], pc, smooth=40.0)
    base.location = (0, 0.0, 0)
    col = cylinder('crt_column', 0.075, CRT['stand'] - 0.022, (0, -0.02, 0.022 + (CRT['stand'] - 0.022) / 2), beige,
                   pc, 40, bevel=0.003)
    # brightness knob on the chin, cord grommet under it
    kz = CRT['stand'] + 0.040
    knob = cylinder('crt_knob', 0.0085, 0.010, (0.118, CRT['front'] + 0.004, kz), dark, pc, 24, 'Y', bevel=0.0015)
    grom = cylinder('crt_grommet', 0.0085, 0.012, (CRT['cord_exit'][0], CRT['front'] - 0.002, CRT['cord_exit'][2]),
                    rubber(), pc, 20, 'Y', bevel=0.002)
    # vent slots on the rear slope
    bm = bmesh.new()
    rows = _case_rings()
    top = [(y, zc + h / 2) for y, w, h, r, zc in rows if y < -0.05]
    ys = [t[0] for t in top][::-1]
    zt = [t[1] for t in top][::-1]
    for i in range(9):
        y = -0.075 - i * 0.016
        z = float(np.interp(y, ys, zt))
        dzdy = (float(np.interp(y + 0.005, ys, zt)) - float(np.interp(y - 0.005, ys, zt))) / 0.01
        ang = math.atan(dzdy)
        geom = bmesh.ops.create_cube(bm, size=1.0)
        vs = geom['verts']
        for v in vs:
            v.co = Vector((v.co.x * 0.17, v.co.y * 0.0065, v.co.z * 0.003))
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(ang, 3, 'X'))
        bmesh.ops.translate(bm, verts=vs, vec=(0, y, z - 0.0012))
    vents = to_object(bm, 'crt_vents', [dark], pc, smooth=30.0)
    soft_bevel(vents, 0.0008, 2)
    # the chin stays clean (a fine seam line under the bezel only: nothing on the front can
    # read as a badge); the cooling louvres run along both flanks of the case instead
    bm = bmesh.new()
    geom = bmesh.ops.create_cube(bm, size=1.0)
    for v in geom['verts']:
        v.co = Vector((v.co.x * 0.36, v.co.y * 0.0012 + CRT['front'] + 0.0002, v.co.z * 0.0009 + CRT['stand'] + 0.067))
    for sx in (-1, 1):
        for i in range(7):
            geom = bmesh.ops.create_cube(bm, size=1.0)
            for v in geom['verts']:
                v.co = Vector((sx * (CRT["w"] / 2 - 0.0006) + v.co.x * 0.0024, v.co.y * 0.140 + 0.088,
                               v.co.z * 0.0042 + CRT['zc'] - 0.060 + i * 0.016))
    chin = to_object(bm, 'crt_chin_vents', [dark], pc, smooth=30.0)
    soft_bevel(chin, 0.0005, 1)
    return pc


@cached
def crt_bezel(m):
    """The CRT's front bezel: a darker, greyer moulding than the case, same orange peel."""
    g = G(m)
    P = g.coords()
    peel = g.noise(P, 700.0, 2.0, 0.5)
    grime = g.remap(g.noise(P, 40.0, 4.0, 0.6), 0.6, 0.8)
    col = g.mix(g.mul(grime, 0.3), srgb('#a59a85'), (0.2, 0.17, 0.12))
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.45, g.mul(peel, 0.1)))
    g.p('Specular IOR Level', 0.4)
    g.p('Normal', g.bump(peel, 0.05, 0.0002))


def crt_screen_mesh():
    """Curved glass (concentric rounded-rect rings bulging forward), the chin power LED and
    the camera-only phosphor halo card in front of the glass.

    UVs span the visible picture 0..1 with u running left -> right AS THE VIEWER FACES
    THE SCREEN (the glass faces +Y, so u = 0.5 - x / W). Material 0 = crt_screen,
    1 = power LED, 2 = crt_halo."""
    me = bpy.data.meshes.get('crt_screen_mesh')
    if me is not None:
        return me
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    zs, W, H = CRT['zs'], CRT['screen_w'], CRT['screen_h']
    y0, bulge = CRT['front'] - 0.020, 0.016
    outline = rrect(0.306, 0.234, 0.021, 8)
    rings = []
    for s in (1.0, 0.96, 0.9, 0.8, 0.68, 0.54, 0.38, 0.22, 0.08):
        rings.append([(x * s, y0 + bulge * (1 - s * s), z * s + zs) for x, z in outline])
    vr = bm_loft(bm, rings, True, False, False, 0)
    bm_fan(bm, vr[-1], (0, y0 + bulge, zs), 0, flip=False)
    # power LED dome on the chin
    led_c = Vector((0.152, CRT['front'] + 0.0005, CRT['stand'] + 0.040))
    prof = [(0.0040, 0.0), (0.0040, 0.0012), (0.0032, 0.0028), (0.0018, 0.0036), (0.0, 0.0039)]
    tmp = bmesh.new()
    bm_lathe(tmp, prof, 16, 1)
    bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'))
    bmesh.ops.translate(tmp, verts=tmp.verts, vec=led_c)
    tmpme = bpy.data.meshes.new('tmp_led')
    tmp.to_mesh(tmpme)
    tmp.free()
    bm.from_mesh(tmpme)
    bpy.data.meshes.remove(tmpme)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # halo card: a flat grid just in front of the bezel, facing +Y
    hw, hh, yc = 0.62, 0.53, CRT['front'] + 0.012
    nx, nz = 6, 5
    grid = [[bm.verts.new((hw * (i / nx - 0.5), yc, zs + hh * (j / nz - 0.5))) for i in range(nx + 1)]
            for j in range(nz + 1)]
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
            f.material_index = 2
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = (0.5 - co.x / W, (co.z - zs) / H + 0.5)
    me = bpy.data.meshes.new('crt_screen_mesh')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = p.material_index != 2
    me.materials.append(crt_screen())
    me.materials.append(led(LED_GREEN, 2.2, 'crt_on'))
    me.materials.append(crt_halo())
    return me


def _luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


class Terminal:
    """A colleague: a beige CRT whose screen state is keyed custom properties.

    Handles: root (empty, move/rotate it), screen (keyed props crt_*), light (area
    glow pooling on the walnut, driven by the screen props), case (instance).
    All frames are film frames."""

    def __init__(self, name, hexcol, root_obj, screen, light, level, energy):
        self.name = name
        self.hex = hexcol
        self.rgb = srgb(hexcol)
        self.root = root_obj
        self.screen = screen
        self.light = light
        self.level = level
        self.energy = energy
        self.streak = None

    # --- low level
    def key(self, frame, interp='LINEAR', **vals):
        for k, v in vals.items():
            kprop(self.screen, 'crt_' + k, frame, float(v), interp)

    def key_rest(self, frame=1, on=1.0):
        vals = dict(CRT_DEFAULTS)
        vals['on'] = on
        self.key(frame, 'LINEAR', **vals)

    def cord_exit(self):
        return self.root.matrix_world @ Vector(CRT['cord_exit'])

    def to_world(self, p):
        return self.root.matrix_world @ Vector(p)

    # --- performance
    def speak(self, f0, f1, pulse=0.25, seed=None, syllable=(6, 9), gap=(0, 2)):
        """Speech: a pale band sweeps left->right across the field (as the viewer faces it),
        syllable by syllable, while the whole field pulses about +-25%. Same grammar as
        Synergy's mouth. Each syllable's band crosses the field in its own frames (keys
        never collide, so every syllable shows), and the rhythm is deterministic: the
        default seed is a stable hash of the colleague and f0."""
        if seed is None:
            seed = zlib.crc32(f'{self.name}:{f0}'.encode()) & 0xffff
        rng = random.Random(seed)
        lo, hi = 1.0 - pulse * 0.4, 1.0 + pulse
        self.key(f0 - 1, 'LINEAR', band=-0.3, bamt=0.0, gain=1.0)
        t = f0
        while t < f1 - 4:
            dur = max(6, min(rng.randint(*syllable), f1 - t))
            g = rng.randint(*gap)
            self.key(t, 'LINEAR', band=-0.15, bamt=0.0, gain=lo)
            self.key(t + 1, 'LINEAR', bamt=1.0)
            self.key(t + dur // 2, 'LINEAR', gain=hi)
            self.key(t + dur - 2, 'LINEAR', bamt=0.9)
            self.key(t + dur - 1, 'CONSTANT', band=1.15, bamt=0.0, gain=lo)
            t += dur + g
        self.key(t + 1, 'LINEAR', band=-0.3, bamt=0.0, gain=1.0)

    def flare(self, frame, dur=8, gain=1.6):
        """Flare `gain` x brighter (60% by default) for `dur` frames: the colleague takes the
        floor. Uses its own channel (crt_flare), so it can overlap speak()."""
        self.key(frame - 1, 'LINEAR', flare=1.0, white=0.0)
        self.key(frame + 1, 'LINEAR', flare=gain, white=0.12)
        self.key(frame + dur - 3, 'LINEAR', flare=gain * 0.92, white=0.06)
        self.key(frame + dur, 'LINEAR', flare=1.0, white=0.0)

    def shutdown(self, frame):
        """field -> bright white-tinted horizontal line (4f) -> dot (3f) -> black, 10f afterglow.
        The first frames flash the colour onto the walnut."""
        f = frame
        self.key(f - 1, 'LINEAR', on=1.0, gain=1.0, sx=1.0, sy=1.0, white=0.0, glow=0.0, bamt=0.0, flare=1.0)
        self.key(f, 'LINEAR', gain=1.9, white=0.25)
        self.key(f + 2, 'LINEAR', sy=0.012, gain=2.8, white=0.85)
        self.key(f + 5, 'LINEAR', sx=1.0, sy=0.010, gain=2.6, white=0.9)
        self.key(f + 6, 'LINEAR', sx=0.022, sy=0.02, gain=3.4, white=1.0)
        self.key(f + 8, 'CONSTANT', sx=0.018, sy=0.018, gain=3.2, on=1.0, glow=0.0)
        self.key(f + 9, 'LINEAR', on=0.0, glow=1.0, gain=1.0)
        self.key(f + 19, 'LINEAR', glow=0.0, sx=1.0, sy=1.0, white=0.0)

    def power_on(self, frame):
        """Dot -> line -> field, then a 6-frame degauss shimmer. Every channel is held at
        rest up to the frame before, so a dead screen never drifts."""
        f = frame
        self.key(f - 1, 'CONSTANT', on=0.0, deg=0.0, glow=0.0, sx=1.0, sy=1.0, gain=1.0, white=0.0, flare=1.0,
                 bamt=0.0)
        self.key(f, 'LINEAR', on=1.0, sx=0.02, sy=0.02, white=1.0, gain=2.4)
        self.key(f + 1, 'LINEAR', sx=1.0, sy=0.012, gain=2.2, white=0.8)
        self.key(f + 2, 'LINEAR', sy=1.0, gain=1.5, white=0.25, deg=1.0)
        self.key(f + 8, 'LINEAR', gain=1.0, white=0.0, deg=0.0)

    def value(self, prop, frame):
        """The keyed value of crt_<prop> at `frame` (the static value when unkeyed)."""
        dp = f'["crt_{prop}"]'
        ad = self.screen.animation_data
        if ad and ad.action:
            for fc in C.fcurves(ad.action):
                if fc.data_path == dp:
                    return fc.evaluate(frame)
        return float(self.screen.get('crt_' + prop, CRT_DEFAULTS.get(prop, 0.0)))

    def off(self, frame=None):
        """Dead screen: from the start (frame=None) or cut at `frame`. The hold before the
        cut keys the value the screen actually has there (a screen already shut down
        stays dark: it never ramps back on)."""
        if frame is None:
            self.key_rest(1, on=0.0)
        else:
            cur = self.value('on', frame - 1)
            if cur > 1e-4:
                self.key(frame - 1, 'CONSTANT', on=cur)
            self.key(frame, 'CONSTANT', on=0.0)

    def on(self, frame):
        self.key(frame, 'CONSTANT', on=1.0)


def crt_terminal(name, hexcol, coll=None, location=(0, 0, 0), rot_z=0.0, level=None, energy=None,
                 powered=True):
    """Build one terminal (case instance + own screen + glow light). Returns a Terminal.

    The field colour and level come from CRT_CAL (calibrated to display as `hexcol`
    under AgX); `level` overrides the calibrated level. The glow light keeps the
    target hue, so the pool on the walnut is the colleague's colour."""
    coll = coll or bpy.context.scene.collection
    rgb = srgb(hexcol)
    lum = max(_luma(rgb), 1e-3)
    field, cal_level = crt_field(name, hexcol) if name in CRT_CAL and srgb(TERMINAL_HEX[name]) == rgb \
        else crt_field('', hexcol)
    if level is None:
        level = cal_level
    if energy is None:
        energy = 9.0 * min(2.2, 0.45 / max(lum, 0.2) ** 0.5)
    rt = root(f'term_{name}', coll, location, rot_z)
    case = instance(crt_case_proto(), f'term_{name}_case', coll)
    case.parent = rt
    scr = bpy.data.objects.new(f'term_{name}_screen', crt_screen_mesh())
    coll.objects.link(scr)
    scr.parent = rt
    scr['crt_rgb'] = list(field)
    scr['crt_level'] = float(level)
    # bloom tint: the colleague's own hue at the field's luminance (AgX leaves low-level
    # boosted colours oversaturated, so the halo must not use the boosted field)
    k_l = _luma(field) / max(_luma(rgb), 1e-4)
    scr['crt_hue'] = [min(4.0, c * k_l) for c in rgb]
    cal = CRT_CAL.get(name, {})
    scr['crt_bloom'] = 1.0 if name == 'pat' else float(cal.get('bloom', 0.0))
    scr['crt_core'] = float(cal.get('core', 0.0))
    scr['crt_dead'] = 0.0 if powered else 1.0
    for k, v in CRT_DEFAULTS.items():
        scr['crt_' + k] = float(v)
    # glow light just in front of the glass, tipped down toward the walnut
    ld = bpy.data.lights.new(f'term_{name}_glow', 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = 0.40, 0.28
    ld.spread = math.radians(165)              # no hard cut-off line where the pool meets the walnut
    mx = max(rgb)
    base = [c / mx for c in rgb]
    ld.color = base
    ld.energy = energy
    lo = bpy.data.objects.new(f'term_{name}_glow', ld)
    coll.objects.link(lo)
    lo.parent = rt
    lo.location = (0, CRT['front'] + 0.03, CRT['zs'] + 0.02)
    d = Vector((0, 1.0, -1.0)).normalized()        # tipped down into a pool on the walnut in front
    lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    lo.visible_camera = False
    lo.visible_glossy = False
    t = Terminal(name, hexcol, rt, scr, lo, level, energy)
    t.key_rest(1, on=1.0 if powered else 0.0)
    v = [('on', scr, '["crt_on"]'), ('gain', scr, '["crt_gain"]'), ('sx', scr, '["crt_sx"]'),
         ('sy', scr, '["crt_sy"]'), ('bamt', scr, '["crt_bamt"]'), ('glow', scr, '["crt_glow"]'),
         ('flare', scr, '["crt_flare"]')]
    add_driver(ld, 'energy', f'{energy:.4f}*on*gain*flare*(0.12+0.88*sx*sy)*(1+0.3*bamt)+{energy * 0.08:.4f}*glow', v)
    for i in range(3):
        add_driver(ld, 'color', f'{base[i]:.4f}+(1-{base[i]:.4f})*white', [('white', scr, '["crt_white"]')], i)
    return t


def _crt_streak_mat():
    """Emitter that stands in for a screen's reflection in the walnut coat (a reflection-card
    cheat: the real screens sit too low and too far outboard for the coat to mirror them toward
    the foot camera). Shaped like light in a wiped coat, not a neon inlay: a Gaussian profile
    across its width, a head that tapers in at the screen end, a tail that fades and loses
    about 30% of its saturation toward the foot, and its strength broken up 30-50% by slow
    wipe noise along the table (0.3-0.8 m features, a different stretch per card). Only its
    down-facing side emits (Backfacing mask). Colour and strength are object attributes the
    card's drivers copy from its terminal's screen state."""
    m = _get('crt_streak_card_v3')
    if m is not None:
        return m
    m = _new('crt_streak_card_v3')
    g = G(m, principled=False)
    u, v, _ = g.sep(g.uv())
    du = g.math('DIVIDE', g.sub(u, 0.5), 0.22)
    across = g.math('EXPONENT', g.mul(g.mul(du, du), -1.0))
    # v = 1 at the screen end, 0 at the foot end
    head = g.math('POWER', g.remap(v, 1.0, 0.74, smooth=True), 1.5)       # tapers in at the screen: no hard top
    tail = g.math('POWER', g.remap(v, 0.0, 0.78, smooth=True), 1.6)
    along = g.mul(head, tail)
    # wipe breakup along the table: object coords (metres along the card) + a per-card offset
    oi = g.node('ShaderNodeObjectInfo')
    P = g.vmath('ADD', g.obj(), g.comb(g.mul(oi.outputs['Random'], 41.0), g.mul(oi.outputs['Random'], 17.0), 0.0))
    px, py, _ = g.sep(P)
    n1 = g.noise(g.comb(g.mul(px, 3.0), g.mul(py, 1.6), 0.5), 1.0, 2.0, 0.55)
    n2 = g.noise(g.comb(g.mul(px, 6.0), g.mul(py, 3.4), 2.5), 1.0, 1.0, 0.5)
    brk = g.sub(1.0, g.mul(g.remap(g.add(g.mul(n1, 0.7), g.mul(n2, 0.3)), 0.36, 0.64, smooth=True), 0.45))
    bf = g.node('ShaderNodeNewGeometry')
    front = g.sub(1.0, bf.outputs['Backfacing'])
    k = g.mul(across, along, brk, front, g.attr('streak_k').outputs['Fac'])
    rgb = g.attr('streak_rgb').outputs['Color']
    lum = g.node('ShaderNodeRGBToBW')
    g._set(lum.inputs['Color'], rgb)
    sat = g.add(0.70, g.mul(g.remap(v, 0.25, 0.85, smooth=True), 0.30))
    col = g.mix(sat, g.comb(lum.outputs['Val'], lum.outputs['Val'], lum.outputs['Val']), rgb)
    e = g.node('ShaderNodeEmission')
    g._set(e.inputs['Color'], col)
    g._set(e.inputs['Strength'], k)
    g.L.new(e.outputs[0], g.out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'
    return m


def crt_streak_card(t, name, coll, center, size=(0.28, 5.5), gain=0.55, head=0.5, y_min=None):
    """Add a terminal's walnut-streak card: an emissive plane over the table, facing down,
    long along Y, seen ONLY by glossy rays (camera, diffuse, shadow, transmission and
    volume all off, no light sampling). Its colour is the screen's field (whitening with
    crt_white) and its strength follows crt_on/gain/flare/sx/sy/bamt, so it dies in the
    S11 wave and pulses with speech and flares. `head` m of it lies beyond the screen toward
    the host; y_min clamps its far end (the table's foot). Light-link it to the walnut
    (env_room does) so no other glossy surface mirrors it. Returns the card object."""
    coll = coll or bpy.context.scene.collection
    w, l = size
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    y0, y1 = -(l - head), head                 # `head` m beyond the screen toward the host, the rest toward the foot
    if y_min is not None:
        y0 = max(y0, y_min - center[1])
    vs = [bm.verts.new((x, y, 0.0)) for x, y in ((-w / 2, y0), (-w / 2, y1), (w / 2, y1), (w / 2, y0))]
    f = bm.faces.new(vs)                       # clockwise from above: the normal points down
    v0 = (y0 - y1) / l + 1.0                   # a clamped card keeps the full card's v (its tail is cut, not squeezed)
    for lp, (uu, vv) in zip(f.loops, ((0, v0), (0, 1), (1, 1), (1, v0))):
        lp[uvl].uv = (uu, vv)
    o = to_object(bm, name, [_crt_streak_mat()], coll, smooth=None, recalc=False)
    o.location = center
    for flag in ('visible_camera', 'visible_diffuse', 'visible_shadow', 'visible_transmission',
                 'visible_volume_scatter'):
        setattr(o, flag, False)
    o.visible_glossy = True
    scr = t.screen
    field = list(scr['crt_rgb'])
    lv = float(scr['crt_level'])
    o['streak_rgb'] = field
    o['streak_k'] = 0.0
    v = [('on', scr, '["crt_on"]'), ('gain', scr, '["crt_gain"]'), ('sx', scr, '["crt_sx"]'),
         ('sy', scr, '["crt_sy"]'), ('bamt', scr, '["crt_bamt"]'), ('flare', scr, '["crt_flare"]')]
    add_driver(o, '["streak_k"]', f'{lv * gain:.4f}*on*gain*flare*(0.1+0.9*sx*sy)*(1+0.4*bamt)', v)
    for i in range(3):
        add_driver(o, '["streak_rgb"]', f'{field[i]:.4f}+({max(field):.4f}-{field[i]:.4f})*white',
                   [('white', scr, '["crt_white"]')], i)
    t.streak = o
    return o


# ================================================================== office chair

CHAIR = dict(seat_top=0.55, seat_y=0.02, back_front=-0.215)


def chair_proto(low=False):
    """High-backed charcoal office chair (raised gas lift), facing +Y. Shared by all chairs.
    low=True: the typist's low-backed variant (the printer's chair, so it reads from behind)."""
    pc = proto('PROTO_ChairLow' if low else 'PROTO_Chair')
    if len(pc.objects):
        return pc
    fab = fabric(CHARCOAL, 900.0, 0.5)
    blk = black_plastic(0.4, 0.014)
    graph = flat((0.035, 0.035, 0.037), 0.32, 1.0)
    chrome_m = chrome(0.1)
    rub = rubber()
    # seat cushion
    bm = bmesh.new()
    bm_pillow(bm, 0.50, 0.48, 0.08, 0.07, 0.032, steps=4, crown=0.01, z0=0.47)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, CHAIR['seat_y'], 0))
    to_object(bm, 'chair_seat', [fab], pc, smooth=50.0, recalc=False)
    # seat shell + mechanism
    bm = bmesh.new()
    bm_pillow(bm, 0.47, 0.45, 0.022, 0.06, 0.008, steps=2, z0=0.45)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, CHAIR['seat_y'], 0))
    to_object(bm, 'chair_shell', [blk], pc, smooth=45.0, recalc=False)
    box('chair_mech', (0.22, 0.25, 0.05), (0, 0.0, 0.425), blk, pc, 0.006)
    # high back: rounded top corners, gently wrapped, tilted back 6 degrees
    H, Wb = (0.15, 0.40) if low else (0.74, 0.47)
    rc = 0.06 if low else 0.10

    def wfn(zn):
        z = zn * H
        k = 1.0
        if z > H - rc:
            dz = (z - (H - rc)) / rc
            k = 1 - (2 * rc / Wb) * (1 - math.sqrt(max(0.0, 1 - dz * dz)))
        return k * (0.955 + 0.045 * C.ease(min(1.0, zn / 0.35)))
    bm = bmesh.new()
    bm_pillow(bm, Wb, 0.075, H, 0.03, 0.03, steps=4, seg=6, width_fn=wfn, bend=0.035, crown=0.0)
    # lumbar: the front face swells forward low in the back, and a channel seam crosses it
    for v in bm.verts:
        if v.co.y > 0.0:
            zn = v.co.z / H
            k = max(0.0, 1.0 - (2.0 * v.co.x / Wb) ** 4)
            v.co.y += 0.022 * math.exp(-((zn - 0.22) / 0.13) ** 2) * k
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(6), 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, CHAIR['back_front'] - 0.04, 0.615))
    to_object(bm, 'chair_back', [fab], pc, smooth=50.0, recalc=False)
    # piping: a black welt round the front face of the back and across the lumbar seam
    def front_y(x, zz):
        k = max(0.0, 1.0 - (2.0 * x / Wb) ** 4)
        return 0.0375 + 0.035 * (2 * x / Wb) ** 2 + 0.022 * math.exp(-((zz / H - 0.22) / 0.13) ** 2) * k + 0.0012
    tilt = Matrix.Rotation(math.radians(6), 3, 'X')
    off = Vector((0, CHAIR['back_front'] - 0.04, 0.615))
    ring = [Vector((x, front_y(x, zz), zz)) for x, zz in rrect(Wb - 0.05, H - 0.05, 0.08, 8, 0.0, H / 2)]
    ring.append(ring[0])
    bm = bmesh.new()
    bm_tube(bm, [tilt @ q + off for q in catmull(ring, 3)], 0.0035, 8, caps=False)
    xs = [(-Wb / 2 + 0.035) + (Wb - 0.07) * i / 16 for i in range(17)]
    bm_tube(bm, [tilt @ Vector((x, front_y(x, H * 0.36) - 0.001, H * 0.36)) + off for x in xs], 0.0022, 6)
    to_object(bm, 'chair_welt', [blk], pc, smooth=50.0)
    # back spine bracket
    bm = bmesh.new()
    pts = catmull([(0, -0.09, 0.42), (0, -0.21, 0.44), (0, -0.30, 0.55), (0, -0.305, 0.72)], 8)
    bm_tube(bm, pts, 0.017, 12)
    to_object(bm, 'chair_spine', [graph], pc, smooth=50.0)
    # arms: post + pad
    for sx in (-1, 1):
        bm = bmesh.new()
        pts = catmull([(sx * 0.17, -0.03, 0.43), (sx * 0.27, -0.05, 0.46), (sx * 0.285, -0.04, 0.58),
                       (sx * 0.285, -0.02, 0.69)], 8)
        bm_tube(bm, pts, 0.013, 12)
        to_object(bm, f'chair_arm{sx}', [graph], pc, smooth=50.0)
        bm = bmesh.new()
        bm_pillow(bm, 0.065, 0.25, 0.028, 0.03, 0.01, steps=3, z0=0.685)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(sx * 0.285, 0.03, 0))
        to_object(bm, f'chair_pad{sx}', [blk], pc, smooth=50.0, recalc=False)
    # gas lift
    cylinder('chair_shroud', 0.032, 0.20, (0, 0, 0.215), blk, pc, 32, bevel=0.003)
    cylinder('chair_piston', 0.016, 0.10, (0, 0, 0.36), chrome_m, pc, 24)
    # five-star base with casters
    bm = bmesh.new()
    for k in range(5):
        a = math.pi / 2 + 2 * math.pi * k / 5
        ca, sa = math.cos(a), math.sin(a)
        verts = []
        for (r, w, z0, z1) in ((0.035, 0.05, 0.075, 0.118), (0.31, 0.034, 0.075, 0.098)):
            for dx, dz in ((-1, 0), (1, 0), (1, 1), (-1, 1)):
                x = r * ca - dx * w / 2 * sa
                y = r * sa + dx * w / 2 * ca
                verts.append(bm.verts.new((x, y, z0 if dz == 0 else z1)))
        a0, a1 = verts[:4], verts[4:]
        bm_bridge(bm, a0, a1, 0)
        bm_cap(bm, a0, 0, flip=True)
        bm_cap(bm, a1, 0)
    hub = bmesh.new()
    star = to_object(bm, 'chair_star', [graph], pc, smooth=30.0)
    hub.free()
    soft_bevel(star, 0.006, 3, 30)
    cylinder('chair_hub', 0.05, 0.05, (0, 0, 0.095), graph, pc, 32, bevel=0.004)
    for k in range(5):
        a = math.pi / 2 + 2 * math.pi * k / 5
        p = Vector((0.30 * math.cos(a), 0.30 * math.sin(a), 0.0))
        fork = box(f'chair_fork{k}', (0.03, 0.04, 0.035), (p.x, p.y, 0.062), blk, pc, 0.006)
        fork.rotation_euler = (0, 0, a)
        for s in (-1, 1):
            q = p + Vector((-math.sin(a), math.cos(a), 0)) * 0.0 + Vector((math.cos(a + math.pi / 2), math.sin(a + math.pi / 2), 0)) * 0.0
            w = cylinder(f'chair_wheel{k}{s}', 0.025, 0.012, (q.x + s * 0.011 * math.cos(a), q.y + s * 0.011 * math.sin(a), 0.025),
                         rub, pc, 24, bevel=0.003)
            w.rotation_euler = (0, math.pi / 2, a)
    return pc


def office_chair(name, coll=None, location=(0, 0, 0), rot_z=0.0, low=False):
    """One chair instance (facing local +Y). Seat top is CHAIR['seat_top'] above the floor.
    low=True gives the low-backed typist variant."""
    return instance(chair_proto(low), name, coll, location, rot_z)


# ================================================================== paper


A4 = (0.210, 0.297)


@cached
def paper_sheet(m):
    """Thin single-sided sheet: diffuse paper with light coming through. Texture space is
    the sheet's UV (in metres), so the fibres stay put while the shape keys bend it."""
    g = G(m, principled=False)
    oi = g.node('ShaderNodeObjectInfo')
    P = g.vmath('ADD', g.scale_vec(g.uv(), (A4[0], A4[1], 0.0)), g.vmath('SCALE', (17.3, 29.1, 7.7),
                                                                          scale=oi.outputs['Random']))
    fib = g.noise(P, 500.0, 3.0, 0.7)
    pb = g.node('ShaderNodeBsdfPrincipled')
    g._set(pb.inputs['Base Color'], g.mix(g.mul(fib, 0.1), PAPER, tuple(c * 0.88 for c in PAPER)))
    g._set(pb.inputs['Roughness'], 0.8)
    g._set(pb.inputs['Sheen Weight'], 0.2)
    g._set(pb.inputs['Normal'], g.bump(fib, 0.08, 0.0003))
    tr = g.node('ShaderNodeBsdfTranslucent')
    g._set(tr.inputs['Color'], (0.85, 0.82, 0.74))
    mx = g.node('ShaderNodeMixShader')
    mx.inputs['Fac'].default_value = 0.22
    g.L.new(pb.outputs[0], mx.inputs[1])
    g.L.new(tr.outputs[0], mx.inputs[2])
    # emerge mask: the part of the sheet still inside the printer (v < sheet_hide, keyed per
    # frame by Printer.feed) is fully transparent, so a sheet slides out of its exit slot
    _, v, _ = g.sep(g.uv())
    hide = g.attr('sheet_hide').outputs['Fac']
    vis = g.math('GREATER_THAN', v, hide)
    tp = g.node('ShaderNodeBsdfTransparent')
    m2 = g.node('ShaderNodeMixShader')
    g._set(m2.inputs['Fac'], vis)
    g.L.new(tp.outputs[0], m2.inputs[1])
    g.L.new(mx.outputs[0], m2.inputs[2])
    g.L.new(m2.outputs[0], g.out.inputs['Surface'])


def sheet_mesh(name='sheet', nx=3, ny=16, droop_keys=(0.25, 0.5, 0.75, 1.0)):
    """A4 sheet, origin at the trailing edge centre, leading edge at +Y.

    Shape keys 'out25'..'out100': the part beyond the printer's slot (fraction of the
    sheet that has emerged) bends down under its own weight; blend them while feeding."""
    W, Lh = A4
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rows = []
    for j in range(ny + 1):
        y = Lh * j / ny
        rows.append([bm.verts.new((W * (i / nx - 0.5), y, 0.0)) for i in range(nx + 1)])
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            for lp in f.loops:
                lp[uvl].uv = (lp.vert.co.x / W + 0.5, lp.vert.co.y / Lh)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(paper_sheet())
    obj = bpy.data.objects.new(name, me)
    obj.shape_key_add(name='Basis')
    for frac in droop_keys:
        kb = obj.shape_key_add(name=f'out{int(frac * 100)}')
        y0 = Lh * (1 - frac)          # slot position along the sheet
        for v in me.vertices:
            s = v.co.y - y0
            if s <= 0:
                continue
            # integrate a bend whose curvature grows with the overhang
            k = 3.2 + 4.0 * frac
            ang = min(math.radians(75), k * s)
            if k * s <= math.radians(75):
                y = y0 + math.sin(k * s) / k
                z = -(1 - math.cos(k * s)) / k
            else:
                s0 = math.radians(75) / k
                y = y0 + math.sin(k * s0) / k + (s - s0) * math.cos(ang)
                z = -(1 - math.cos(k * s0)) / k - (s - s0) * math.sin(ang)
            kb.data[v.index].co = Vector((v.co.x, y, z))
    kb = obj.shape_key_add(name='flutter')
    for v in me.vertices:
        kb.data[v.index].co = Vector((v.co.x, v.co.y, 0.012 * math.sin(v.co.y / Lh * math.pi) + 0.006 * (v.co.x / W) ** 2))
    return obj


def paper_stack(name, height, coll=None, location=(0, 0, 0), seed=3, loose=6):
    """A neat-but-human stack of printed-blank sheets (blocks + a few loose top sheets)."""
    rng = random.Random(seed)
    rt = root(name, coll, location)
    W, Lh = A4
    mat = paper(0.82, True)
    z = 0.0
    nblk = max(1, int(height / 0.03))
    for i in range(nblk):
        h = height / nblk
        b = box(f'{name}_blk{i}', (W + 0.002, Lh + 0.002, h), (rng.uniform(-0.002, 0.002), rng.uniform(-0.002, 0.002),
                                                               z + h / 2), mat, coll, 0.0008, 2)
        b.rotation_euler = (0, 0, math.radians(rng.uniform(-0.8, 0.8)))
        b.parent = rt
        z += h
    tops = []
    for i in range(loose):
        s = bpy.data.objects.new(f'{name}_top{i}', bpy.data.meshes.get('stack_sheet') or _flat_sheet('stack_sheet'))
        (coll or bpy.context.scene.collection).objects.link(s)
        s.parent = rt
        s.location = (rng.uniform(-0.005, 0.005), rng.uniform(-0.006, 0.006) - Lh / 2, z + 0.0004 * (i + 1))
        s.rotation_euler = (0, 0, math.radians(rng.uniform(-3, 3)))
        tops.append(s)
    rt['stack_top'] = z + 0.0004 * (loose + 1)
    return rt


def _flat_sheet(name):
    obj = sheet_mesh(name + '_src', 2, 2, droop_keys=())
    me = obj.data
    me.name = name
    obj.shape_key_clear()
    bpy.data.objects.remove(obj)
    return me


# ================================================================== laser printer


class Printer:
    """Beige 1990s desktop laser printer on its own chair. The body never moves.

    feed(frame): one blank sheet slides out of the exit slot at the back of the face-down
    top tray, runs forward across the tray, over its front lip (drooping), then glides down
    onto the floor stack beside the chair; the stack only grows.
    stop_mid(frame): a sheet stops half over the front lip and hangs there.
    led_pulse(f0, f1) / led_off(frame): the lime ready LED.
    slot_local is the tray's front lip (where sheets droop over); exit_local the exit slot."""

    def __init__(self, root_obj, led_obj, slot_local, stack, coll, exit_local=None):
        self.root = root_obj
        self.led = led_obj
        self.slot_local = Vector(slot_local)
        self.exit_local = Vector(exit_local) if exit_local is not None else Vector(slot_local)
        self.stack = stack
        self.coll = coll
        self.sheets = []
        self.landed = 0
        self.rng = random.Random(11)

    def _new_sheet(self, frame):
        s = sheet_mesh(f'printer_sheet{len(self.sheets)}')
        self.coll.objects.link(s)
        s.parent = self.root
        s['sheet_hide'] = 1.0
        # hidden until it starts feeding
        s.hide_render = True
        s.keyframe_insert('hide_render', frame=frame - 1)
        s.hide_render = False
        s.keyframe_insert('hide_render', frame=frame)
        self.sheets.append(s)
        return s

    def _key_shape(self, s, frame, out):
        """Blend the overhang shape keys for an emerged fraction `out` (0..1)."""
        ks = s.data.shape_keys.key_blocks
        names = [('out25', 0.25), ('out50', 0.5), ('out75', 0.75), ('out100', 1.0)]
        for nm, fr in names:
            # tent weights between neighbouring keys
            w = max(0.0, 1.0 - abs(out - fr) / 0.25) if out >= 0.25 else (out / 0.25 if nm == 'out25' else 0.0)
            ks[nm].value = w
            ks[nm].keyframe_insert('value', frame=frame)

    def _key_run(self, s, frame, trail_y):
        """Key a sheet lying in the tray with its trailing edge at local y = trail_y."""
        W, Lh = A4
        lip, ex = self.slot_local, self.exit_local
        out = max(0.0, min(1.0, (trail_y + Lh - lip.y) / Lh))
        s.location = (lip.x, trail_y, lip.z)
        s.rotation_euler = (0, 0, 0)
        s.keyframe_insert('location', frame=frame)
        s.keyframe_insert('rotation_euler', frame=frame)
        s['sheet_hide'] = max(0.0, min(1.0, (ex.y - trail_y) / Lh))
        s.keyframe_insert('["sheet_hide"]', frame=frame)
        self._key_shape(s, frame, out)

    def feed(self, frame, dur=20):
        """Feed one blank sheet outward onto the stack (lands at frame+dur)."""
        s = self._new_sheet(frame)
        W, Lh = A4
        lip, ex = self.slot_local, self.exit_local
        run = max(4, int(round(dur * 0.55)))
        y0 = ex.y - Lh                       # leading edge at the exit slot
        y1 = lip.y                           # trailing edge at the lip: fully over
        for i in range(0, run + 1):
            self._key_run(s, frame + i, y0 + (y1 - y0) * (i / run))
        # release: drop and glide onto the stack (stack is in the printer root's frame)
        top = self.stack_top_local()
        n = self.landed
        land = Vector((top.x + self.rng.uniform(-0.004, 0.004), top.y - Lh / 2 + self.rng.uniform(-0.004, 0.004),
                       top.z + 0.0004 * n))
        start = Vector((lip.x, lip.y, lip.z))
        rz = math.radians(self.rng.uniform(-2.5, 2.5))
        fall = dur - run
        ks = s.data.shape_keys.key_blocks
        for i in range(1, fall + 1):
            t = i / fall
            e = C.ease(t, 'in') * 0.3 + C.ease(t) * 0.7
            p = start.lerp(land, e)
            p.z += 0.06 * math.sin(math.pi * t) * (1 - t)
            s.location = p
            s.rotation_euler = (math.radians(-12) * math.sin(math.pi * t), math.radians(8) * math.sin(math.pi * t),
                                rz * e)
            s.keyframe_insert('location', frame=frame + run + i)
            s.keyframe_insert('rotation_euler', frame=frame + run + i)
            ks['out100'].value = max(0.0, 1 - t * 1.6)
            ks['out100'].keyframe_insert('value', frame=frame + run + i)
            ks['flutter'].value = math.sin(math.pi * t) * 0.8
            ks['flutter'].keyframe_insert('value', frame=frame + run + i)
            for nm in ('out25', 'out50', 'out75'):
                ks[nm].value = 0.0
                ks[nm].keyframe_insert('value', frame=frame + run + i)
        self.landed += 1
        return s

    def stop_mid(self, frame, frac=0.5, dur=10):
        """A sheet starts feeding and stops with `frac` of it over the tray's front lip,
        hanging there."""
        s = self._new_sheet(frame)
        W, Lh = A4
        lip, ex = self.slot_local, self.exit_local
        y0 = ex.y - Lh
        y1 = lip.y - Lh * (1 - frac)
        for i in range(0, dur + 1):
            self._key_run(s, frame + i, y0 + (y1 - y0) * C.ease(i / dur, 'out'))
        return s

    def stack_top_local(self):
        st = self.stack
        top = Vector(st.location)
        top.z += st['stack_top']
        return top

    def led_pulse(self, f0, f1, period=32, lo=0.35, hi=1.0):
        for f in range(f0, f1 + 1, 4):
            v = lo + (hi - lo) * (0.5 + 0.5 * math.cos(2 * math.pi * (f - f0) / period))
            kprop(self.led, 'led', f, v)

    def led_off(self, frame):
        kprop(self.led, 'led', frame - 1, self.led.get('led', 1.0))
        kprop(self.led, 'led', frame, 0.0, 'CONSTANT')

    def led_on(self, frame, value=1.0):
        kprop(self.led, 'led', frame, value, 'CONSTANT')


def laser_printer(name='printer', coll=None, location=(0, 0, 0), rot_z=0.0, stack_offset=(0.0, 0.52, 0.0),
                  stack_height=0.30, stack_floor_z=None):
    """Build the printer (origin = bottom centre, front +Y) with its output stack.

    A boxy 1990s desktop laser: a face-down output tray recessed into the top, sloping
    down to an exit slot under the rear cover; a front paper cassette with a finger pull;
    a tilted control panel at the front right (three blank keys, the lime ready LED); side
    louvres. The stack sits on the floor beside the printer's chair (stack_offset is in
    the printer's frame; stack_floor_z is the floor height in that frame)."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, rot_z)
    putty = beige_plastic(-0.6)
    dark = black_plastic(0.45, 0.01)
    grey = flat((0.09, 0.09, 0.095), 0.4)
    Wp, Dp, Hp = 0.42, 0.38, 0.25
    parts = []
    bm = bmesh.new()
    bm_pillow(bm, Wp, Dp, Hp, 0.03, 0.014, steps=4, seg=6, crown=0.0)
    parts.append(to_object(bm, f'{name}_body', [putty], coll, smooth=45.0, recalc=False))
    # rear top cover: the exit slot opens in its front face, over the tray
    rear_y0 = -Dp / 2 + 0.01
    bm = bmesh.new()
    bm_pillow(bm, Wp - 0.02, 0.13, 0.05, 0.02, 0.012, steps=3, z0=Hp - 0.02)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, rear_y0 + 0.065, 0))
    parts.append(to_object(bm, f'{name}_hump', [putty], coll, smooth=45.0, recalc=False))
    exit_y = rear_y0 + 0.13 + 0.001
    parts.append(box(f'{name}_exit', (0.26, 0.006, 0.010), (0, exit_y - 0.002, Hp + 0.010), dark, coll, 0.002))
    # face-down output tray: a dark recessed plate sloping toward the exit, with a raised lip
    tray_len = (Dp / 2 - 0.02) - exit_y
    tray = box(f'{name}_tray', (0.27, tray_len, 0.004), (0, exit_y + tray_len / 2, Hp + 0.0008), grey, coll, 0.0015)
    tray.rotation_euler = (math.radians(3.0), 0, 0)
    parts.append(tray)
    lip_y = Dp / 2 - 0.016
    parts.append(box(f'{name}_traylip', (0.28, 0.010, 0.010), (0, lip_y, Hp + 0.004), putty, coll, 0.003))
    # paper cassette: a full-width drawer in the lower front with a finger pull
    parts.append(box(f'{name}_cassette', (0.38, 0.014, 0.080), (0, Dp / 2 + 0.003, 0.062), putty, coll, 0.004))
    parts.append(box(f'{name}_cass_gap', (0.385, 0.004, 0.0025), (0, Dp / 2 + 0.0005, 0.104), dark, coll, 0.0008))
    parts.append(box(f'{name}_grip', (0.10, 0.010, 0.016), (0, Dp / 2 + 0.009, 0.074), dark, coll, 0.004))
    # control panel: tilted dark plate at the front right, three blank keys, the lime LED
    panel = box(f'{name}_panel', (0.10, 0.055, 0.006), (0.145, Dp / 2 - 0.045, Hp + 0.002), grey, coll, 0.002)
    panel.rotation_euler = (math.radians(12), 0, 0)
    parts.append(panel)
    for i in range(3):
        k = cylinder(f'{name}_key{i}', 0.0055, 0.004, (0.125 + i * 0.018, Dp / 2 - 0.05, Hp + 0.0075),
                     flat((0.45, 0.44, 0.42), 0.5), coll, 16, bevel=0.0012)
        parts.append(k)
    ledo = cylinder(f'{name}_led', 0.0038, 0.003, (0.178, Dp / 2 - 0.028, Hp + 0.009),
                    led(LED_LIME, 14.0, 'led'), coll, 16, bevel=0.001)
    ledo['led'] = 1.0
    parts.append(ledo)
    # side louvres
    for sx in (-1, 1):
        for i in range(6):
            parts.append(box(f'{name}_vent{sx}{i}', (0.004, 0.11, 0.006), (sx * (Wp / 2 + 0.0005), -0.05, 0.12 + i * 0.016),
                             dark, coll, 0.0012))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cylinder(f'{name}_foot{sx}{sy}', 0.012, 0.006, (sx * 0.17, sy * 0.15, -0.002), rubber(), coll, 16))
    for p in parts:
        p.parent = rt
    floor_z = stack_floor_z if stack_floor_z is not None else 0.0
    stack = paper_stack(f'{name}_stack', stack_height, coll, (stack_offset[0], stack_offset[1], floor_z), seed=5)
    stack.parent = rt
    pr = Printer(rt, ledo, (0.0, lip_y + 0.006, Hp + 0.0095), stack, coll, exit_local=(0.0, exit_y, Hp + 0.0095))
    return pr


# ================================================================== paper droid + trolley


class Droid:
    """The paper droid towing its trolley on a rigid bar.

    drive(f0, f1, path_points): the droid follows the path (eased); the trolley's tongue
    follows the trail of the droid's hitch one bar-length behind, so the bar stays rigid.
    The hitch can be offset: `hitch_x` puts the droid's clevis on a short outrigger arm to
    its right, `tongue_x` mounts the trolley's tongue left of the trolley's centre line, so
    on a straight run the trolley trails hitch_x + tongue_x to the droid's right (the room's
    droid: 0.35 m outboard, so an axial camera sees the droid clear of the reams).
    blink(f0, f1): the cyan pinlight blinks slowly; light_off(frame) puts it out."""

    BAR = 0.30           # hitch-to-hitch (pin centres)
    D_HITCH = 0.16       # droid centre -> its rear hitch (along its heading)
    T_HITCH = 0.36       # trolley centre -> its front hitch (along its heading)

    def __init__(self, droid_root, trolley_root, bar, light, wheels, hitch_x=0.0, tongue_x=0.0):
        self.root = droid_root
        self.trolley = trolley_root
        self.bar = bar
        self.light = light
        self.wheels = wheels
        self.hitch_x = hitch_x
        self.tongue_x = tongue_x

    @property
    def trail_offset(self):
        """How far right of the droid's track the trolley's centre runs on a straight."""
        return self.hitch_x + self.tongue_x

    @staticmethod
    def _right(face):
        return Vector((face.y, -face.x, 0.0))

    def _hitch(self, pos, face):
        return pos - face * self.D_HITCH + self._right(face) * self.hitch_x

    def _trolley_pose(self, hitch, tongue):
        tdir = (hitch - tongue)
        tdir = tdir.normalized() if tdir.length > 1e-9 else Vector((0.0, 1.0, 0.0))
        tc = tongue - tdir * self.T_HITCH + self._right(tdir) * self.tongue_x
        return tc, tdir

    def place(self, frame, x, y, heading_deg):
        """Park droid and trolley in line at a pose (heading = direction the droid faces)."""
        h = math.radians(heading_deg)
        f = Vector((-math.sin(h), math.cos(h), 0.0))
        d = Vector((x, y, 0.0))
        hitch = self._hitch(d, f)
        tf = hitch - f * self.BAR
        tc, tdir = self._trolley_pose(hitch, tf)
        self._key(frame, d, h, tc, math.atan2(-tdir.x, tdir.y), hitch, tf)

    def pose_at(self, frame):
        """(droid xy, trolley xy, binder top z) evaluated at a frame."""
        sc = bpy.context.scene
        cur = sc.frame_current
        sc.frame_set(frame)
        d = self.root.matrix_world.translation.copy()
        t = self.trolley.matrix_world.translation.copy()
        sc.frame_set(cur)
        return d, t

    def _key(self, f, dpos, dh, tpos, th, h1, h2):
        self.root.location = dpos
        self.root.rotation_euler = (0, 0, dh)
        self.trolley.location = tpos
        self.trolley.rotation_euler = (0, 0, th)
        mid = (h1 + h2) / 2
        dvec = h1 - h2
        self.bar.location = (mid.x, mid.y, 0.115)
        self.bar.rotation_euler = (0, 0, math.atan2(-dvec.x, dvec.y))
        for o in (self.root, self.trolley, self.bar):
            o.keyframe_insert('location', frame=f)
            o.keyframe_insert('rotation_euler', frame=f)
        for o in (self.root, self.trolley, self.bar):
            ad = o.animation_data
            if ad and ad.action:
                for fc in C.fcurves(ad.action):
                    for kp in fc.keyframe_points:
                        if abs(kp.co.x - f) < 1e-3:
                            kp.interpolation = 'LINEAR'

    @staticmethod
    def _cruise(t, a=0.08):
        """Trapezoid speed profile: smooth start over `a`, constant cruise, smooth stop."""
        v = 1.0 / (1.0 - a)
        if t < a:
            return v * t * t / (2 * a)
        if t > 1 - a:
            u = 1.0 - t
            return 1.0 - v * u * u / (2 * a)
        return v * (t - a / 2)

    def drive(self, f0, f1, path_points, reverse=False, ease='inout', accel=None):
        """Drive along `path_points` [(x, y), ...] from f0 to f1.

        ease: 'inout' (smootherstep), 'in', 'out', 'linear' or 'cruise' (a measured pace:
        a short smooth start, constant speed, a short smooth stop; `accel` = the fraction
        of the run spent getting up to speed, default 0.08). reverse=True backs up along
        the path (the droid faces against travel and the trolley leads). The trolley's
        tongue follows the trail of the droid's hitch (past the path's start it trails in
        line with the start heading), so the bar never stretches or bends."""
        pts = [Vector((p[0], p[1], 0.0)) for p in path_points]
        dense = catmull(pts, 16) if len(pts) > 2 else pts
        path = Path(dense)
        L = path.length
        sgn = -1.0 if reverse else 1.0

        def hitch_at(s):
            tan = path.tangent(s)
            return self._hitch(path.pos(s), tan * sgn)
        roll0 = getattr(self, '_rolled', 0.0)          # wheels keep turning from where the last drive left them
        for f in range(f0, f1 + 1):
            t = (f - f0) / max(1, f1 - f0)
            if ease == 'cruise':
                s = L * (self._cruise(t) if accel is None else self._cruise(t, accel))
            else:
                s = L * (C.ease(t) if ease == 'inout' else C.ease(t, ease))
            dpos = path.pos(s)
            face = path.tangent(s) * sgn
            hitch = hitch_at(s)
            # the tongue: the point on the hitch's own trail exactly BAR from the hitch,
            # behind it (forward) or ahead of it (reverse: the trolley leads)
            sh = self._find_back(hitch_at, s, hitch, self.BAR, 1 if reverse else -1)
            tf = hitch_at(sh)
            tc, tdir = self._trolley_pose(hitch, tf)
            dh = math.atan2(-face.x, face.y)
            th = math.atan2(-tdir.x, tdir.y)
            self._key(f, dpos, dh, tc, th, hitch, tf)
            # wheel spin from distance travelled: about each wheel's own axle (local Z,
            # rotation mode ZYX), so they roll and never swivel
            for w in self.wheels:
                w.rotation_euler[2] = (roll0 + s * (-1 if reverse else 1)) / w.get('wheel_r', 0.022)
                w.keyframe_insert('rotation_euler', index=2, frame=f)
        self._rolled = roll0 + L * (-1 if reverse else 1)

    @staticmethod
    def _find_back(fn, s, hitch, dist, direction):
        """Arc length (behind if direction=-1) whose trail point fn(s') is exactly `dist`
        from `hitch` (bracketed march, then bisection), so the bar never stretches."""
        step = 0.02 * direction
        a = s
        b = s + step
        for _ in range(4000):
            if (fn(b) - hitch).length >= dist:
                break
            a, b = b, b + step
        for _ in range(48):
            mid = 0.5 * (a + b)
            if (fn(mid) - hitch).length >= dist:
                b = mid
            else:
                a = mid
        return 0.5 * (a + b)

    def blink(self, f0, f1, period=48, on=6):
        """Slow cyan blink: lit for `on` frames every `period`."""
        for f in range(f0, f1, period):
            kprop(self.light, 'led', f - 1, 0.15, 'LINEAR')
            kprop(self.light, 'led', f, 1.0, 'LINEAR')
            kprop(self.light, 'led', f + on, 1.0, 'LINEAR')
            kprop(self.light, 'led', f + on + 3, 0.15, 'LINEAR')

    def light_off(self, frame, fade=3):
        """Put the pinlight out from `frame` (over `fade` frames) and keep it out: every
        later blink key is removed, so it never competes with the dark room."""
        o = self.light
        ad = o.animation_data
        dp = '["led"]'
        if ad and ad.action:
            for fc in C.fcurves(ad.action):
                if fc.data_path == dp:
                    v = fc.evaluate(frame)
                    for kp in reversed(list(fc.keyframe_points)):
                        if kp.co.x >= frame:
                            fc.keyframe_points.remove(kp)
                    kprop(o, 'led', frame, v, 'LINEAR')
        else:
            kprop(o, 'led', frame, float(o.get('led', 0.15)), 'LINEAR')
        kprop(o, 'led', frame + fade, 0.0, 'CONSTANT')


def ream(name='ream', coll=None, location=(0, 0, 0), rot_z=0.0, mat=None):
    """A 500-sheet ream in a blank white wrapper (fold seams, no print)."""
    bm = bmesh.new()
    bm_pillow(bm, A4[0] + 0.004, A4[1] + 0.004, 0.05, 0.004, 0.004, steps=2, seg=3)
    obj = to_object(bm, name, [mat or ream_wrap()], coll, smooth=40.0, recalc=False)
    obj.location = location
    obj.rotation_euler = (0, 0, rot_z)
    return obj


@cached
def ream_wrap(m):
    g = G(m)
    P = g.coords()
    x, y, z = g.sep(g.obj())
    crinkle = g.noise(P, 60.0, 4.0, 0.6)
    seam = g.remap(g.math('ABSOLUTE', y), 0.135, 0.149)   # folded ends
    g.p('Base Color', g.mix(g.mul(seam, 0.08), (0.70, 0.70, 0.68), (0.58, 0.58, 0.56)))
    g.p('Roughness', g.add(0.55, g.mul(crinkle, 0.15)))
    g.p('Normal', g.bump(g.add(g.mul(crinkle, 0.5), g.mul(seam, 0.4)), 0.15, 0.0008))


def _wear_attr(obj, fn, name='wear'):
    """Store a per-vertex float attribute fn(local co) -> 0..1 (edge wear masks for materials)."""
    me = obj.data
    at = me.attributes.get(name) or me.attributes.new(name, 'FLOAT', 'POINT')
    at.data.foreach_set('value', [float(fn(v.co)) for v in me.vertices])
    return at


def binder(name='binder', coll=None, location=(0, 0, 0), rot_z=0.0, thick=0.085):
    """The fat 300-page ring binder (blank everywhere). Cobalt vinyl covers overhang the
    pages by 6 mm and bow slightly, with a welded edge bead; a rounded spine carries a
    recessed, blank clear label window. Inside: a punched page block with sheet
    striations and blank tab dividers, held by three steel D-rings on a riveted plate,
    visible at the open head and tail. Origin at the bottom centre; spine along -X."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, rot_z)
    W, D = 0.318, 0.296
    cov = cobalt_vinyl()
    stl = steel(0.16)
    parts = []
    ct = 0.0032                        # cover board thickness
    hinge = 0.026                      # crease distance from the spine
    x0, x1 = -W / 2 + hinge, W / 2     # cover panel extent (hinge crease -> fore edge)

    def cover(nm, z0, up):
        """A bowed board: grid slab, rounded corners in plan, crowned by 1.8 mm."""
        bm = bmesh.new()
        outline = rrect(x1 - x0, D, 0.008, 4, (x0 + x1) / 2, 0.0)
        n = len(outline)
        cx = (x0 + x1) / 2
        rings = []
        for k, sc in enumerate((1.0, 0.85, 0.6, 0.3)):
            rings.append([(cx + (px - cx) * sc, py * sc) for px, py in outline])

        def bow(px, py):
            u = (px - cx) / ((x1 - x0) / 2)
            v = py / (D / 2)
            return 0.0018 * (1 - u * u) * (1 - v * v) * up
        top = [bm_ring(bm, [(px, py, z0 + ct + bow(px, py)) for px, py in r]) for r in rings]
        bot = [bm_ring(bm, [(px, py, z0 + bow(px, py)) for px, py in r]) for r in rings]
        bm_bridge(bm, top[0], bot[0], 0)
        for a_, b_ in zip(top, top[1:]):
            bm_bridge(bm, b_, a_, 0)
        for a_, b_ in zip(bot, bot[1:]):
            bm_bridge(bm, a_, b_, 0)
        bm_fan(bm, top[-1], (cx, 0.0, z0 + ct + bow(cx, 0.0)), 0, flip=True)
        bm_fan(bm, bot[-1], (cx, 0.0, z0 + bow(cx, 0.0)), 0, flip=False)
        o = to_object(bm, f'{name}_cover_{nm}', [cov], coll, smooth=40.0)

        def wear(co):          # rubbed corners and open edges (the hinge side stays crisp)
            ef, eh = x1 - co.x, D / 2 - abs(co.y)
            corner = max(0.0, 1.0 - math.hypot(max(ef, 0.0), max(eh, 0.0)) / 0.014)
            return min(1.0, max(corner, 0.45 * max(0.0, 1.0 - min(ef, eh) / 0.004)))
        _wear_attr(o, wear)
        soft_bevel(o, 0.0011, 2, 40)
        parts.append(o)
        # welded edge bead along the three open edges
        bead = [(x0 + 0.002, -D / 2 + 0.0035), (x1 - 0.0035, -D / 2 + 0.0035), (x1 - 0.0035, D / 2 - 0.0035),
                (x0 + 0.002, D / 2 - 0.0035)]
        pts = []
        for i in range(3):
            a0, a1 = Vector(bead[i]), Vector(bead[i + 1])
            for k in range(12):
                q = a0.lerp(a1, k / 12)
                pts.append(Vector((q.x, q.y, z0 + (ct if nm == 'hi' else 0.0008) + bow(q.x, q.y) * 1.0)))
        pts.append(Vector((bead[3][0], bead[3][1], z0 + (ct if nm == 'hi' else 0.0008))))
        bm = bmesh.new()
        bm_tube(bm, pts, 0.0007, 6)
        o = to_object(bm, f'{name}_bead_{nm}', [cov], coll, smooth=50.0)
        parts.append(o)
    cover('lo', 0.0, 0.35)
    cover('hi', thick - ct, 1)
    for k, z in (('lo', ct / 2), ('hi', thick - ct / 2)):
        parts.append(box(f'{name}_hinge_{k}', (hinge - 0.004, D - 0.004, ct * 0.85), (-W / 2 + hinge / 2 + 0.001, 0.0, z),
                         cov, coll, 0.0011))
    # fat rounded spine (C-section) with a recessed blank label window
    bm = bmesh.new()
    prof_o, prof_i = [], []
    for i in range(17):
        a_ = -math.pi / 2 + math.pi * i / 16
        prof_o.append((-W / 2 + 0.006 - 0.012 * math.cos(a_), thick / 2 + (thick / 2) * math.sin(a_)))
        prof_i.append((-W / 2 + 0.006 - 0.009 * math.cos(a_), thick / 2 + (thick / 2 - 0.003) * math.sin(a_)))
    ring = prof_o + prof_i[::-1]
    ra = bm_ring(bm, [(x, -D / 2, z) for x, z in ring])
    rb = bm_ring(bm, [(x, D / 2, z) for x, z in ring])
    bm_bridge(bm, ra, rb, 0)
    bm_cap(bm, ra, 0, flip=True)
    bm_cap(bm, rb, 0)
    sp = to_object(bm, f'{name}_spine', [cov], coll, smooth=40.0)
    xmin = -W / 2 + 0.006 - 0.012
    _wear_attr(sp, lambda co: min(1.0, max(0.0, 1.0 - (D / 2 - abs(co.y)) / 0.006) +
                                   0.15 * max(0.0, 1.0 - (co.x - xmin) / 0.0015)))
    soft_bevel(sp, 0.001, 2, 40)
    parts.append(sp)
    # recessed blank label window: a white card under a clear glossy film, on the spine
    bm = bmesh.new()
    rows = []
    amax = math.radians(26.0)
    y0_, y1_ = -0.087, 0.127
    for j in range(9):
        a_ = -amax + 2 * amax * j / 8
        xx = -W / 2 + 0.006 - 0.0124 * math.cos(a_)
        zz = thick / 2 + (thick / 2 + 0.0004) * math.sin(a_)
        rows.append([bm.verts.new((xx, y0_ + (y1_ - y0_) * i / 10, zz)) for i in range(11)])
    for j in range(8):
        for i in range(10):
            bm.faces.new((rows[j][i], rows[j + 1][i], rows[j + 1][i + 1], rows[j][i + 1]))
    win = to_object(bm, f'{name}_label', [label_window()], coll, smooth=60.0, recalc=False)
    parts.append(win)
    # finger hole in the spine: a dark pocket ringed in chrome, below the label
    fy = -0.112
    rim = bmesh.new()
    ring_pts = []
    for k in range(33):
        a_ = 2 * math.pi * k / 32
        ring_pts.append(Vector((-W / 2 - 0.0064, fy + 0.0105 * math.cos(a_), thick / 2 + 0.0105 * math.sin(a_))))
    bm_tube(rim, ring_pts, 0.0016, 10, caps=False, up=(1, 0, 0))
    parts.append(to_object(rim, f'{name}_fingerhole_rim', [chrome(0.12)], coll, smooth=50.0))
    hole = cylinder(f'{name}_fingerhole', 0.0098, 0.002, (-W / 2 - 0.0058, fy, thick / 2), black_plastic(0.6, 0.004),
                    coll, 32, 'X')
    parts.append(hole)
    # page block: inset 6 mm from the covers' fore/head/tail edges, a slight bulge
    xp0 = -W / 2 + hinge + 0.010                       # binding edge of the page block
    pw, pd = W / 2 - 0.006 - xp0, D - 0.012
    bm = bmesh.new()
    bm_pillow(bm, pw, pd, thick - 2 * ct - 0.003, 0.002, 0.0015, steps=2, seg=3, crown=0.0018, cap_rings=3)
    pages = to_object(bm, f'{name}_pages', [paper(0.95, True)], coll, smooth=40.0, recalc=False)
    pages.location = (xp0 + pw / 2, 0.0, ct + 0.0015)
    parts.append(pages)
    # blank tab dividers proud of the fore edge (pale card, no marks)
    for i, (yy, zz) in enumerate(((-0.09, 0.30), (-0.02, 0.52), (0.05, 0.71), (0.11, 0.42))):
        tab = box(f'{name}_tab{i}', (0.026, 0.044, 0.0014), (xp0 + pw + 0.006, yy,
                                                           ct + 0.0015 + (thick - 2 * ct - 0.003) * zz),
                  flat(srgb('#d9dfe8') if i % 2 else srgb('#eef0f2'), 0.45), coll, 0.0004)
        parts.append(tab)
    # mechanism: riveted plate on the lower cover, three D-rings through the punched pages
    xr = xp0 - 0.0035
    plate = box(f'{name}_mech', (0.020, D - 0.05, 0.0025), (xr + 0.004, 0.0, ct + 0.0013), stl, coll, 0.001)
    parts.append(plate)
    for yy in (-(D - 0.05) / 2 + 0.007, (D - 0.05) / 2 - 0.007):
        parts.append(cylinder(f'{name}_rivet{yy:.2f}', 0.0030, 0.0014, (xr + 0.004, yy, ct + 0.0030),
                              chrome(0.15), coll, 16, bevel=0.0006))
    rh = thick - 2 * ct - 0.004
    for k, yy in enumerate((-0.11, 0.0, 0.11)):
        pts = []
        for i in range(17):            # the straight back of the D, then the round
            t = i / 16
            pts.append(Vector((xr, yy, ct + 0.003 + rh * t)))
        for i in range(1, 25):
            a_ = math.pi / 2 - math.pi * i / 24
            pts.append(Vector((xr + 0.004 + 0.018 * math.cos(a_), yy, ct + 0.003 + rh / 2 + rh / 2 * math.sin(a_))))
        bm = bmesh.new()
        bm_tube(bm, pts, 0.0019, 10)
        parts.append(to_object(bm, f'{name}_ring{k}', [stl], coll, smooth=50.0))
    for o in parts:
        o.parent = rt
    rt['binder_thickness'] = thick
    return rt


@cached
def label_window(m):
    """A blank white card behind a clear, slightly hazy vinyl window (one surface)."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 300.0, 2.0)
    g.p('Base Color', g.mix(g.mul(n, 0.2), (0.80, 0.80, 0.79), (0.70, 0.70, 0.69)))
    g.p('Roughness', 0.7)
    g.p('Coat Weight', 1.0)
    g.p('Coat Roughness', g.add(0.06, g.mul(n, 0.08)))
    g.p('Coat Tint', (0.92, 0.95, 0.97))


def paper_droid(name='droid', coll=None, location=(0, 0, 0), rot_z=0.0, reams_high=11, with_binder=True,
                trail_offset=0.0):
    """Knee-high ivory canister droid + rigid tow bar + steel trolley of reams (+ binder on top).

    Its own silhouette: a tall, narrow canister with a brushed seam band, a cobalt collar
    with a small blue panel, a low, flattened brushed dome carrying an offset slot visor and
    a single small cyan pinlight, on three casters. trail_offset (m) > 0 hitches the
    trolley that far to the droid's right on a straight run: half on an outrigger arm at
    the droid's rear, half as an offset tongue on the trolley (the bar stays straight)."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, rot_z)
    ivory = ivory_enamel()
    dark = black_plastic(0.35, 0.012)
    silver = steel(0.22)
    parts = []
    wheels = []
    hx = 0.5 * trail_offset                 # outrigger arm (droid side)
    tx = trail_offset - hx                  # offset tongue (trolley side)
    R0 = 0.124                              # canister radius
    # skirt, canister (with a recessed seam groove), seam band, collar, dome
    bm = bmesh.new()
    bm_lathe(bm, [(0.0, 0.026), (0.128, 0.026), (0.133, 0.033), (0.133, 0.060), (0.128, 0.068), (0.0, 0.068)], 64)
    parts.append(to_object(bm, f'{name}_skirt', [dark], coll, smooth=40.0))
    prof = [(0.0, 0.064), (0.117, 0.064), (0.123, 0.071), (R0, 0.080), (R0, 0.262), (R0 - 0.004, 0.266),
            (R0 - 0.004, 0.282), (R0, 0.286), (R0, 0.458), (R0 - 0.004, 0.466), (0.0, 0.466)]
    bm = bmesh.new()
    bm_lathe(bm, prof, 72)
    parts.append(to_object(bm, f'{name}_body', [ivory], coll, smooth=40.0))
    bm = bmesh.new()
    bm_lathe(bm, [(0.0, 0.2672), (R0 - 0.0028, 0.2672), (R0 - 0.0012, 0.2690), (R0 - 0.0012, 0.2802),
                  (R0 - 0.0028, 0.2820), (0.0, 0.2820)], 72)
    parts.append(to_object(bm, f'{name}_seam', [steel(0.18)], coll, smooth=40.0))
    bm = bmesh.new()
    bm_lathe(bm, [(0.0, 0.462), (R0 + 0.002, 0.462), (R0 + 0.004, 0.465), (R0 + 0.004, 0.492), (R0 + 0.002, 0.495),
                  (0.0, 0.495)], 72)
    parts.append(to_object(bm, f'{name}_collar', [cobalt_paint(0.3)], coll, smooth=40.0))
    RD, HD, ZD = R0 + 0.001, 0.058, 0.494   # flattened dome: semi-axes RD (plan) x HD (height)
    dome = [(0.0, ZD)]
    for i in range(0, 21):
        a = math.pi / 2 * i / 20
        dome.append((RD * math.cos(a) + 1e-5 * (i == 20), ZD + HD * math.sin(a)))
    dome[-1] = (0.0, ZD + HD)
    bm = bmesh.new()
    bm_lathe(bm, dome, 72)
    parts.append(to_object(bm, f'{name}_dome', [silver], coll, smooth=50.0))

    def on_dome(el, az, lift=0.0):
        rr, hh = RD + lift, HD + lift
        return (rr * math.cos(el) * math.sin(az), rr * math.cos(el) * math.cos(az), ZD + hh * math.sin(el))
    # offset slot visor: a rounded slot of dark glass low on the dome, turned toward its right
    bm = bmesh.new()
    az0, az1, elc, elh = math.radians(-6), math.radians(58), math.radians(26), math.radians(7.5)
    cols = []
    nu = 25
    for j in range(nu):
        u = j / (nu - 1)
        az = az0 + (az1 - az0) * u
        k = max(0.0, 1.0 - (2 * u - 1) ** 8) ** 0.5          # rounded ends
        col_ = []
        for i in range(5):
            el = elc + elh * k * (i / 4 * 2 - 1)
            col_.append(on_dome(el, az, 0.0018))
        cols.append(col_)
    vr = [bm_ring(bm, c) for c in cols]
    for a_, b_ in zip(vr, vr[1:]):
        bm_bridge(bm, a_, b_, 0, closed=False)
    visor = to_object(bm, f'{name}_visor', [dark_glass(0.006, 0.03)], coll, smooth=50.0, recalc=True)
    sol = visor.modifiers.new('Solidify', 'SOLIDIFY')
    sol.thickness = 0.0025
    sol.offset = -1
    parts.append(visor)
    # small blue panel on the collar
    pnl = box(f'{name}_panel', (0.044, 0.006, 0.018), (0.0, R0 + 0.006, 0.4785), cobalt_paint(0.2), coll, 0.0015)
    parts.append(pnl)
    pnl2 = box(f'{name}_panel_in', (0.030, 0.004, 0.009), (0.0, R0 + 0.0085, 0.4785), flat(srgb('#4d8cff'), 0.25), coll,
               0.001)
    parts.append(pnl2)
    # single small cyan pinlight on the dome, left of the visor, in a chrome bezel
    el_p, az_p = math.radians(34), math.radians(-34)
    pc = Vector(on_dome(el_p, az_p, 0.0))
    nrm = Vector((math.cos(el_p) * math.sin(az_p) / RD, math.cos(el_p) * math.cos(az_p) / RD,
                  math.sin(el_p) / HD)).normalized()
    lt = bmesh.new()
    bm_lathe(lt, [(0.0, 0.0), (0.0042, 0.0), (0.0042, 0.0012), (0.0034, 0.0030), (0.0018, 0.0040), (0.0, 0.0043)], 20)
    beacon = to_object(lt, f'{name}_beacon', [led(LED_CYAN, 40.0, 'led')], coll, smooth=50.0)
    beacon.location = pc
    beacon.rotation_euler = nrm.to_track_quat('Z', 'Y').to_euler()
    beacon['led'] = 0.15
    parts.append(beacon)
    rb = bmesh.new()
    bm_lathe(rb, [(0.0042, -0.0008), (0.0062, -0.0008), (0.0064, 0.0006), (0.0058, 0.0012), (0.0044, 0.0012)], 24)
    ring = to_object(rb, f'{name}_beacon_ring', [chrome(0.1)], coll, smooth=50.0)
    ring.location = pc
    ring.rotation_euler = beacon.rotation_euler
    parts.append(ring)
    # casters (axle = the cylinder's local Z, turned to X; they spin about local Z)
    for k in range(3):
        a = math.pi / 2 + 2 * math.pi * k / 3
        w = cylinder(f'{name}_caster{k}', 0.022, 0.016, (0.09 * math.cos(a), 0.09 * math.sin(a), 0.022), rubber(), coll,
                     20)
        w.rotation_mode = 'ZYX'
        w.rotation_euler = (0, math.pi / 2, 0)
        w['wheel_r'] = 0.022
        parts.append(w)
        wheels.append(w)
    # rear clevis hitch at (hx, -D_HITCH): on an outrigger arm when offset
    hy = -Droid.D_HITCH
    for sz in (-1, 1):
        parts.append(box(f'{name}_clevis{sz}', (0.044, 0.07, 0.006), (hx, hy + 0.012, 0.115 + sz * 0.0165),
                         silver, coll, 0.0018))
    parts.append(box(f'{name}_clevis_web', (0.044, 0.012, 0.039), (hx, hy + 0.026, 0.115), silver, coll, 0.002))
    if hx > 0.01:
        a0 = Vector((0.0, -0.096, 0.115))
        a1 = Vector((hx, hy + 0.034, 0.115))
        bm = bmesh.new()
        bm_tube(bm, [a0, a0.lerp(a1, 0.5), a1], 0.011, 12)
        parts.append(to_object(bm, f'{name}_arm', [silver], coll, smooth=50.0))
        parts.append(cylinder(f'{name}_arm_boss', 0.024, 0.04, (0.0, -0.10, 0.115), silver, coll, 24, 'Y',
                              bevel=0.003))
    for p in parts:
        p.parent = rt
    # ---- trolley (front hitch toward +Y, tongue at -tx from its centre line)
    tr = root(f'{name}_trolley', coll, (0, -(Droid.D_HITCH + Droid.BAR + Droid.T_HITCH), 0))
    tparts = []
    deck = box(f'{name}_deck', (0.49, 0.65, 0.025), (0, 0, 0.115), silver, coll, 0.004)
    tparts.append(deck)
    for sx in (-1, 1):       # low side rails, clear of the reams
        bm = bmesh.new()
        bm_tube(bm, [(sx * 0.235, -0.31, 0.128), (sx * 0.235, -0.31, 0.165), (sx * 0.235, 0.31, 0.165),
                     (sx * 0.235, 0.31, 0.128)], 0.007, 10)
        tparts.append(to_object(bm, f'{name}_rail{sx}', [silver], coll, smooth=50.0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            fk = box(f'{name}_fork{sx}{sy}', (0.025, 0.04, 0.05), (sx * 0.17, sy * 0.26, 0.078), dark, coll, 0.004)
            tparts.append(fk)
            w = cylinder(f'{name}_wheel{sx}{sy}', 0.035, 0.02, (sx * 0.17, sy * 0.26, 0.035), rubber(), coll, 24)
            w.rotation_mode = 'ZYX'
            w.rotation_euler = (0, math.pi / 2, 0)
            w['wheel_r'] = 0.035
            tparts.append(w)
            wheels.append(w)
    for sz in (-1, 1):
        tparts.append(box(f'{name}_tclevis{sz}', (0.044, 0.07, 0.006), (-tx, Droid.T_HITCH - 0.012, 0.115 + sz * 0.0165),
                          silver, coll, 0.0018))
    tparts.append(box(f'{name}_tclevis_web', (0.044, 0.012, 0.039), (-tx, Droid.T_HITCH - 0.042, 0.115), silver, coll,
                      0.002))
    if tx > 0.01:            # the tongue runs back from the clevis to the deck's front edge
        tparts.append(box(f'{name}_tongue', (0.03, 0.05, 0.02), (-tx, Droid.T_HITCH - 0.072, 0.115), silver, coll,
                          0.003))
    rng = random.Random(7)
    wrap = ream_wrap()
    rmesh = None
    # columns spaced by the ream's rotated half-extent + 1 mm, jitter clamped to 1 mm, so
    # neighbouring reams never touch (ream 0.214 x 0.301, turned at most 0.6 deg)
    rw, rl = (A4[0] + 0.004) / 2, (A4[1] + 0.004) / 2
    amax = math.radians(0.6)
    hxr = rw * math.cos(amax) + rl * math.sin(amax)
    hyr = rl * math.cos(amax) + rw * math.sin(amax)
    colx, coly = hxr + 0.0005 + 0.001, hyr + 0.0005 + 0.001
    for cx in (-1, 1):
        for cy in (-1, 1):
            for k in range(reams_high):
                z = 0.1275 + k * 0.0505
                r = ream(f'{name}_ream{cx}{cy}{k}', coll, (cx * colx + rng.uniform(-0.001, 0.001),
                                                            cy * coly + rng.uniform(-0.001, 0.001), z),
                         math.radians(rng.uniform(-0.6, 0.6)), wrap)
                if rmesh is None:
                    rmesh = r.data
                else:
                    old = r.data
                    r.data = rmesh
                    bpy.data.meshes.remove(old)
                tparts.append(r)
    top = 0.1275 + reams_high * 0.0505
    bnd = None
    if with_binder:
        bnd = binder(f'{name}_binder', coll, (0.0, 0.0, top), math.radians(90))
        tparts.append(bnd)
    for p in tparts:
        p.parent = tr
    # rigid tow bar: 25 mm square steel with rounded tongues, a clevis pin through each end
    # (pin centres exactly BAR apart; drive() solves the hitch distance, never scales it)
    bar_steel = steel(0.3)
    bar = box(f'{name}_towbar', (0.025, Droid.BAR + 0.03, 0.025), (0, 0, 0), bar_steel, coll, 0.003)
    for sy in (-1, 1):
        pin = cylinder(f'{name}_pin{sy}', 0.0048, 0.046, (0, sy * Droid.BAR / 2, 0), chrome(0.12), coll, 20, bevel=0.0012)
        pin.parent = bar
        head = cylinder(f'{name}_pinhead{sy}', 0.0075, 0.004, (0, sy * Droid.BAR / 2, 0.0215), chrome(0.12), coll, 20,
                        bevel=0.0012)
        head.parent = bar
        clip = cylinder(f'{name}_pinclip{sy}', 0.0062, 0.0016, (0, sy * Droid.BAR / 2, -0.0215), steel(0.3), coll, 16)
        clip.parent = bar
    d = Droid(rt, tr, bar, beacon, wheels, hx, tx)
    d.binder = bnd
    d.trolley_top = top
    d.reams = [p for p in tparts if p.name.startswith(f'{name}_ream')]
    d.place(1, location[0], location[1], math.degrees(rot_z))
    return d


# ================================================================== problem props


def padlock(name='padlock', coll=None, location=(0, 0, 0), rot_z=0.0, hero=True):
    """Heavy scratched brass padlock with a hardened steel shackle (no engraving).
    Origin at the bottom centre, standing upright, broad face toward +/-Y."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, rot_z, 0.05)
    W, H, D = 0.062, 0.052, 0.030
    bm = bmesh.new()
    outline = rrect(W, H, 0.013, 8, 0.0, H / 2)
    bm_prism(bm, outline, -D / 2, D / 2, axis='Y')
    body = to_object(bm, f'{name}_body', [hero_brass() if hero else brass('polished')], coll, smooth=30.0)
    soft_bevel(body, 0.0045, 4, 30)
    # keyway plug on the underside (flush: its face sits 0.1 mm proud of the base)
    plug = cylinder(f'{name}_plug', 0.0062, 0.002, (0, 0, 0.0010), brass('polished'), coll, 32, bevel=0.0006)
    key = box(f'{name}_keyway', (0.0016, 0.0085, 0.0012), (0, 0.0, 0.0006), black_plastic(0.6, 0.003), coll, 0.0004)
    # shackle: steel U with the legs sunk into the body
    leg = 0.0205
    pts = [Vector((-leg, 0, H - 0.008)), Vector((-leg, 0, H + 0.016))]
    for i in range(1, 24):
        a = math.pi - math.pi * i / 24
        pts.append(Vector((leg * math.cos(a), 0, H + 0.016 + leg * math.sin(a))))
    pts += [Vector((leg, 0, H + 0.016)), Vector((leg, 0, H - 0.008))]
    bm = bmesh.new()
    bm_tube(bm, pts, 0.0046, 20, up=(0, 1, 0))
    shackle = to_object(bm, f'{name}_shackle', [shackle_steel() if hero else steel(0.18)], coll, smooth=60.0)
    collars = []
    for sx in (-1, 1):
        # crisp turned collar: flat top, 45-degree chamfers, a fine groove
        prof = [(0.0, -0.0006), (0.0061, -0.0006), (0.0067, 0.0000), (0.0067, 0.0009), (0.0064, 0.0011),
                (0.0064, 0.0013), (0.0067, 0.0015), (0.0067, 0.0021), (0.0060, 0.0028), (0.0, 0.0028)]
        cbm = bmesh.new()
        bm_lathe(cbm, prof, 40)
        c = to_object(cbm, f'{name}_collar{sx}', [brass('polished')], coll, smooth=30.0)
        c.location = (sx * leg, 0, H - 0.0004)
        collars.append(c)
    for o in [body, plug, key, shackle] + collars:
        o.parent = rt
    rt['height'] = H + 0.016 + leg + 0.0046
    return rt


def torus_bm(bm, R, r, nu=64, nv=24, mat=0, z0=0.0):
    rings = []
    for i in range(nu):
        a = 2 * math.pi * i / nu
        ring = []
        for j in range(nv):
            b = 2 * math.pi * j / nv
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z0 + r + r * math.sin(b))))
        rings.append(ring)
    for i in range(nu):
        a, b = rings[i], rings[(i + 1) % nu]
        bm_bridge(bm, a, b, mat)
    return rings


def glass_zero(name='glass_zero', coll=None, location=(0, 0, 0), rot_z=0.0, upright=False):
    """Linda's zero: a clear glass torus. Lies flat by default (origin at the bottom)."""
    R, r = 0.050, 0.0125                      # r/R = 0.25: a slim glass ring, not a bagel
    bm = bmesh.new()
    torus_bm(bm, R, r, 112, 32)
    obj = to_object(bm, name, [glass()], coll, smooth=80.0)
    if upright:
        # stand it on its rim: rotate about X so the hole faces +/-Y
        bm = bmesh.new()
        torus_bm(bm, R, r, 112, 32)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -r))
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, R + r))
        bm.to_mesh(obj.data)
        bm.free()
    obj.location = location
    obj.rotation_euler = (0, 0, rot_z)
    if not upright:
        _zero_caustic(obj, name, coll)
    return obj


@cached
def caustic_mat(m):
    """The zero's focused light on the walnut: a thin bright ring just inside the tube's
    centre circle and a faint glow in the hole (a lens cheat: Cycles' caustics are off).
    Strength = object property 'caustic' (driven by whether the zero sits in the slab)."""
    g = G(m, principled=False)
    x, y, _ = g.sep(g.obj())
    r = g.math('SQRT', g.add(g.mul(x, x), g.mul(y, y)))
    ring = g.math('EXPONENT', g.mul(g.math('POWER', g.math('DIVIDE', g.sub(r, 0.0405), 0.0016), 2.0), -1.0))
    halo = g.mul(g.math('EXPONENT', g.mul(g.math('POWER', g.math('DIVIDE', g.sub(r, 0.040), 0.006), 2.0), -1.0)), 0.25)
    flick = g.add(0.85, g.mul(g.noise(g.vmath('SCALE', g.obj(), scale=90.0), 1.0, 1.0), 0.3))
    k = g.mul(g.add(ring, halo), flick, g.attr('caustic').outputs['Fac'])
    e = g.node('ShaderNodeEmission')
    g._set(e.inputs['Color'], (1.0, 0.97, 0.92))
    g._set(e.inputs['Strength'], k)
    tr = g.node('ShaderNodeBsdfTransparent')
    add = g.node('ShaderNodeAddShader')
    g.L.new(tr.outputs[0], add.inputs[0])
    g.L.new(e.outputs[0], add.inputs[1])
    g.L.new(add.outputs[0], g.out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'


def _zero_caustic(zero, name, coll, slab_half=0.375, peak=2.4):
    """A caustic decal under a flat glass zero, parented to it; its strength follows the
    zero's |x| (full inside the slab down the spine, gone 5 cm outside it)."""
    bm = bmesh.new()
    rings = []
    for rr in (0.0, 0.028, 0.036, 0.040, 0.043, 0.046):
        rings.append([bm.verts.new((rr * math.cos(2 * math.pi * k / 64), rr * math.sin(2 * math.pi * k / 64), 0.00025))
                      for k in range(64)] if rr > 0 else None)
    c = bm.verts.new((0.0, 0.0, 0.00025))
    for k in range(64):
        bm.faces.new((c, rings[1][k], rings[1][(k + 1) % 64]))
    for a_, b_ in zip(rings[1:], rings[2:]):
        bm_bridge(bm, a_, b_, 0)
    o = to_object(bm, f'{name}_caustic', [caustic_mat()], coll, smooth=None, recalc=True)
    o.parent = zero
    for flag in ('visible_diffuse', 'visible_shadow', 'visible_transmission', 'visible_volume_scatter'):
        setattr(o, flag, False)
    o['caustic'] = 0.0
    add_driver(o, '["caustic"]', f'{peak:.3f}*min(1.0,max(0.0,({slab_half + 0.05:.3f}-abs(x))/0.08))',
               [('x', zero, 'location[0]')])
    return o


@cached
def envelope_paper(m):
    """Laid white envelope stock: warm off-white at albedo ~0.48 (it holds detail in the slab
    and under the CRT pools), visible fibres (fine elongated strands in two crossing
    directions, slightly darker than the sheet), a fine paper tooth that breaks the sheen
    up, laid lines, and a soft cockle over a few centimetres."""
    g = G(m)
    P = g.coords()
    fib = g.noise(P, 700.0, 3.0, 0.7)
    tooth = g.noise(P, 2600.0, 2.0, 0.6)
    laid = g.remap(g.math('SINE', g.mul(g.sep(g.obj())[0], 2 * math.pi / 0.0011)), -1.0, 1.0, 0.0, 1.0)
    puff = g.noise(P, 30.0, 2.0)
    cockle = g.noise(P, 45.0, 3.0, 0.55)
    f1 = g.remap(g.noise(g.scale_vec(g.vrot(P, 28.0), (5200.0, 380.0, 5200.0)), 1.0, 2.0, 0.6), 0.62, 0.78)
    f2 = g.remap(g.noise(g.scale_vec(g.vrot(P, -61.0), (4600.0, 330.0, 4600.0)), 1.0, 2.0, 0.6), 0.64, 0.80)
    strands = g.math('MINIMUM', g.add(f1, f2), 1.0)
    col = g.mix(g.mul(fib, 0.10), (0.49, 0.48, 0.455), (0.43, 0.42, 0.395))
    col = g.mix(g.mul(strands, 0.10), col, (0.40, 0.39, 0.37))
    col = g.mix(g.mul(g.remap(tooth, 0.6, 0.8), 0.05), col, (0.55, 0.54, 0.51))
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.72, g.mul(tooth, 0.1)))
    g.p('Sheen Weight', 0.3)
    g.p('Sheen Roughness', 0.45)
    g.p('Subsurface Weight', 0.06)
    g.p('Subsurface Radius', (1.0, 0.95, 0.85))
    g.p('Subsurface Scale', 0.0015)
    g.p('Normal', g.bump(g.add(g.mul(fib, 0.3), g.mul(tooth, 0.5), g.mul(laid, 0.08), g.mul(puff, 0.5),
                               g.mul(cockle, 1.4), g.mul(strands, 0.35)), 0.22, 0.0005))


@cached
def seal_mat(m):
    """The small cobalt square seal: a glossy vinyl sticker (deep cobalt, crisp clear coat)."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 400.0, 2.0)
    g.p('Base Color', g.mix(g.mul(n, 0.15), COBALT_DEEP, (0.0, 0.02, 0.42)))
    g.p('Roughness', g.add(0.24, g.mul(n, 0.06)))
    g.p('Coat Weight', 1.0)
    g.p('Coat Roughness', g.add(0.11, g.mul(n, 0.03)))
    g.p('Coat IOR', 1.5)


def _point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def _dist_to_poly(x, y, poly):
    best = 1e9
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / max(dx * dx + dy * dy, 1e-12)))
        best = min(best, math.hypot(x - ax - t * dx, y - ay - t * dy))
    return best


def envelope(name='envelope', coll=None, location=(0, 0, 0), rot_z=0.0, seed=0):
    """Sealed white DL envelope, back up (no marks). The body is a heightfield with real
    paper thickness: 0.45 mm at the edges, pillowed to ~3 mm over the folded letter inside
    (a soft plateau 8-12 mm in from the edges), one corner lifting a little, and two faint
    handling creases. The bottom flap and the pointed top flap are 0.3 mm paper layers lying
    on it; the top flap's free edges curl up ~0.5 mm, so they cast a fine shadow line. A
    15 mm glossy vinyl square (0.15 mm, bevelled edge) seals the point. Origin bottom
    centre; long side along X."""
    coll = coll or bpy.context.scene.collection
    rng = random.Random(seed)
    rt = root(name, coll, location, rot_z, 0.05)
    W, D = 0.220, 0.110
    pap = envelope_paper()
    e = 0.0012
    bot = [(-W / 2 + e, -D / 2 + e), (W / 2 - e, -D / 2 + e), (W / 2 - 0.05, -0.004), (-W / 2 + 0.05, -0.004)]
    top = _fillet_polygon([(-W / 2 + e, D / 2 - e), (0.0, -0.016), (W / 2 - e, D / 2 - e)], 0.004, 4)
    cx, cy = rng.choice((-1, 1)), rng.choice((-1, 1))
    lift_c = (cx * W / 2, cy * D / 2)
    # two handling creases: soft shallow lines across the body
    creases = []
    for _ in range(2):
        a = math.radians(rng.uniform(-70, 70))
        c0 = (rng.uniform(-0.06, 0.06), rng.uniform(-0.03, 0.03))
        creases.append((c0, (math.cos(a), math.sin(a)), rng.choice((-1, 1)) * rng.uniform(0.00008, 0.00016)))

    def smooth01(t):
        t = min(1.0, max(0.0, t))
        return t * t * (3 - 2 * t)

    def lift(x, y):
        d = math.hypot(x - lift_c[0], y - lift_c[1])
        return 0.0012 * max(0.0, 1.0 - d / 0.05) ** 2

    def thick(x, y):
        u, v = 2 * abs(x) / W, 2 * abs(y) / D
        plateau = smooth01((1 - u) / 0.11) * smooth01((1 - v) / 0.22)
        dome = max(0.0, 1 - u * u) * max(0.0, 1 - v * v)
        z = 0.00045 + 0.0021 * plateau + 0.0006 * dome
        for (px, py), (dx, dy), amp in creases:
            dist = abs((x - px) * dy - (y - py) * dx)
            z += amp * math.exp(-(dist / 0.0016) ** 2) * plateau
        return z

    def top_z(x, y):
        return lift(x, y) + thick(x, y)

    # body: top grid, flat bottom (lifting at the corner), walls round the edge
    nx, ny = 88, 44
    bm = bmesh.new()
    T = [[bm.verts.new((W * (i / nx - 0.5), D * (j / ny - 0.5), 0.0)) for i in range(nx + 1)] for j in range(ny + 1)]
    B = [[bm.verts.new((W * (i / nx - 0.5), D * (j / ny - 0.5), 0.0)) for i in range(nx + 1)] for j in range(ny + 1)]
    for j in range(ny + 1):
        for i in range(nx + 1):
            x, y = T[j][i].co.x, T[j][i].co.y
            T[j][i].co.z = top_z(x, y)
            B[j][i].co.z = lift(x, y)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((T[j][i], T[j][i + 1], T[j + 1][i + 1], T[j + 1][i]))
            bm.faces.new((B[j][i], B[j + 1][i], B[j + 1][i + 1], B[j][i + 1]))
    edge_t = [T[0][i] for i in range(nx + 1)] + [T[j][nx] for j in range(1, ny + 1)] + \
        [T[ny][i] for i in range(nx - 1, -1, -1)] + [T[j][0] for j in range(ny - 1, 0, -1)]
    edge_b = [B[0][i] for i in range(nx + 1)] + [B[j][nx] for j in range(1, ny + 1)] + \
        [B[ny][i] for i in range(nx - 1, -1, -1)] + [B[j][0] for j in range(ny - 1, 0, -1)]
    bm_bridge(bm, edge_b, edge_t, 0)
    body = to_object(bm, f'{name}_body', [pap], coll, smooth=50.0)
    parts = [body]

    def layer(nm, poly, base_off, t=0.0003, extra=None):
        """A paper layer conforming to the body: concentric rings in plan, real thickness."""
        cxp = sum(p[0] for p in poly) / len(poly)
        cyp = sum(p[1] for p in poly) / len(poly)
        outline = resample_closed(list(poly), 160)
        scales = [1.0, 0.993, 0.982, 0.965, 0.94, 0.9, 0.84, 0.76, 0.66, 0.54, 0.41, 0.28, 0.15, 0.06]
        bm = bmesh.new()

        def z_at(x, y):
            z = top_z(x, y) + base_off
            if extra:
                z += extra(x, y)
            return z
        tops, bots = [], []
        for sc in scales:
            ring = [(cxp + (px - cxp) * sc, cyp + (py - cyp) * sc) for px, py in outline]
            tops.append(bm_ring(bm, [(x, y, z_at(x, y) + t) for x, y in ring]))
            bots.append(bm_ring(bm, [(x, y, z_at(x, y)) for x, y in ring]))
        for a_, b_ in zip(tops, tops[1:]):
            bm_bridge(bm, b_, a_, 0)
        for a_, b_ in zip(bots, bots[1:]):
            bm_bridge(bm, a_, b_, 0)
        bm_bridge(bm, tops[0], bots[0], 0)
        bm_fan(bm, tops[-1], (cxp, cyp, z_at(cxp, cyp) + t), 0, flip=True)
        bm_fan(bm, bots[-1], (cxp, cyp, z_at(cxp, cyp)), 0, flip=False)
        o = to_object(bm, f'{name}_{nm}', [pap], coll, smooth=35.0)
        return o, z_at

    flapb, zb = layer('flapb', bot, 0.00004)

    def over_bottom(x, y):        # the top flap drapes over the bottom flap, and its free edges curl up
        if _point_in_poly(x, y, bot):
            z = 0.00034
        else:
            z = 0.00034 * max(0.0, 1.0 - _dist_to_poly(x, y, bot) / 0.008) ** 2
        de = _dist_to_poly(x, y, top)
        if y < D / 2 - 0.004:       # the hinge (top) edge stays down
            z += 0.0005 * max(0.0, 1.0 - de / 0.006) ** 2
        return z
    flapt, zt = layer('flapt', top, 0.00004, extra=over_bottom)
    parts += [flapb, flapt]
    # seal: a 15 mm glossy vinyl square on the flap's point, 0.15 mm thick, bevelled edge
    sx0, sy0 = 0.0, -0.009
    ss = 0.0075
    # a stiff vinyl square: a flat plane fitted over the flap's point (it never takes up the
    # paper's bumps, so its gloss stays one smooth gradient), lifted to clear the paper
    samp = [(sx0 + ss * u, sy0 + ss * v) for u in (-1, -0.5, 0, 0.5, 1) for v in (-1, -0.5, 0, 0.5, 1)]
    A = np.array([[1.0, x, y] for x, y in samp])
    zs = np.array([zt(x, y) + 0.0003 for x, y in samp])
    coef = np.linalg.lstsq(A, zs, rcond=None)[0]
    plane = lambda x, y: float(coef[0] + coef[1] * x + coef[2] * y)   # noqa: E731
    lift_s = max(0.0, max(z - plane(x, y) for (x, y), z in zip(samp, zs))) + 0.00004
    bm = bmesh.new()
    rings = []
    for k, (inset, dz) in enumerate(((0.0, 0.0), (0.0, 0.00007), (0.00018, 0.00013), (0.00040, 0.00015))):
        sq = resample_closed(rrect(2 * (ss - inset), 2 * (ss - inset), 0.0009 - inset * 0.5, 4), 48)
        rings.append(bm_ring(bm, [(sx0 + x, sy0 + y, plane(sx0 + x, sy0 + y) + lift_s + dz) for x, y in sq]))
    for a_, b_ in zip(rings, rings[1:]):
        bm_bridge(bm, a_, b_, 0)
    bm_fan(bm, rings[-1], (sx0, sy0, plane(sx0, sy0) + lift_s + 0.00015), 0, flip=True)
    bm_fan(bm, rings[0], (sx0, sy0, plane(sx0, sy0) + lift_s), 0, flip=False)
    seal = to_object(bm, f'{name}_seal', [seal_mat()], coll, smooth=30.0)
    parts.append(seal)
    for o in parts:
        o.parent = rt
    rt['envelope_top'] = top_z(0.0, 0.0) + 0.0009
    return rt


def _fillet_polygon(pts, r, seg=6):
    """Round the corners of a convex CCW polygon with radius r."""
    out = []
    n = len(pts)
    P = [Vector((p[0], p[1])) for p in pts]
    for i in range(n):
        a, b, c = P[i - 1], P[i], P[(i + 1) % n]
        d1 = (a - b).normalized()
        d2 = (c - b).normalized()
        ang = math.acos(max(-1.0, min(1.0, d1.dot(d2))))
        t = r / math.tan(ang / 2)
        p1 = b + d1 * t
        p2 = b + d2 * t
        bis = (d1 + d2).normalized()
        cen = b + bis * (r / math.sin(ang / 2))
        a1 = math.atan2(p1.y - cen.y, p1.x - cen.x)
        a2 = math.atan2(p2.y - cen.y, p2.x - cen.x)
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(seg + 1):
            aa = a1 + da * k / seg
            out.append((cen.x + r * math.cos(aa), cen.y + r * math.sin(aa)))
    return out


def _index_tab_outline(w, h, tab_x, tab_w=0.034, tab_h=0.013, r=0.0035, r_tab=0.003):
    """Index-tab outline (CCW): a rounded card with one rounded, slightly tapered tab
    protruding from its top long edge at tab_x."""
    t0, t1 = tab_x - tab_w / 2, tab_x + tab_w / 2
    poly = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (t1, h / 2), (t1 - 0.004, h / 2 + tab_h),
            (t0 + 0.004, h / 2 + tab_h), (t0, h / 2), (-w / 2, h / 2)]
    out = []
    n = len(poly)
    for i in range(n):
        a, b, c = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % n])
        d1, d2 = (a - b).normalized(), (c - b).normalized()
        ang = math.acos(max(-1.0, min(1.0, d1.dot(d2))))
        rad = r_tab if abs(b.y - (h / 2 + tab_h)) < 1e-6 or (abs(b.y - h / 2) < 1e-6 and t0 - 1e-6 <= b.x <= t1 + 1e-6) else r
        rad = min(rad, 0.45 * min((a - b).length, (c - b).length) * math.tan(ang / 2))
        tt = rad / math.tan(ang / 2)
        p1, p2 = b + d1 * tt, b + d2 * tt
        bis = (d1 + d2).normalized()
        cen = b + bis * (rad / math.sin(ang / 2))
        a1 = math.atan2(p1.y - cen.y, p1.x - cen.x)
        a2 = math.atan2(p2.y - cen.y, p2.x - cen.x)
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(6 + 1):
            aa = a1 + da * k / 6
            out.append((cen.x + rad * math.cos(aa), cen.y + rad * math.sin(aa)))
    return out


def tab_stack(name='tabs', coll=None, location=(0, 0, 0), rot_z=0.0, color=GREEN_ACRYLIC):
    """Three green acrylic index tabs ('spreadsheet tabs') stacked loosely: each a 5 mm
    polished sheet with a rounded tab protruding from one long edge, the tabs staggered
    left, centre, right like file dividers. Edges bevelled and polished."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, rot_z, 0.05)
    mat = acrylic(color)
    T = 0.005
    w, h = 0.104, 0.050
    for i, tx in enumerate((-0.030, 0.0, 0.030)):
        outline = _index_tab_outline(w, h, tx)
        bm = bmesh.new()
        bm_prism(bm, outline, i * T, (i + 1) * T - 0.0002)
        o = to_object(bm, f'{name}_{i}', [mat], coll, smooth=30.0)
        soft_bevel(o, 0.0009, 2, 30)
        o.location = (0.0015 * (i - 1), -0.004 * i, 0.0)
        o.rotation_euler = (0, 0, math.radians((-2.5, 1.5, -1.0)[i]))
        o.parent = rt
    return rt


# ================================================================== conference hub


def _hub_r(theta, r_in=0.088, r_lobe=0.085, theta0=-math.pi / 2):
    return r_in + r_lobe * (0.5 + 0.5 * math.cos(3 * (theta - theta0))) ** 1.6


@cached
def hub_plastic(m):
    """Soft-touch black of the starfish hub. Each lobe carries an engineered speaker grille:
    1.2 mm holes on a 2.5 mm hex pitch with a slight bevel, inside a band that follows
    the lobe. No marks."""
    g = G(m)
    P = g.obj()
    x, y, z = g.sep(P)
    r = g.math('SQRT', g.add(g.mul(x, x), g.mul(y, y)))
    th = g.math('ARCTAN2', y, x)
    lobe = g.math('COSINE', g.mul(g.add(th, math.pi / 2), 3.0))
    grille = g.mul(g.remap(lobe, 0.70, 0.80), g.remap(r, 0.074, 0.080), g.remap(r, 0.140, 0.134))
    # hex grid of holes: two offset square lattices, nearest centre wins
    pitch = 0.0025

    def cell(px, py):
        qx = g.sub(g.math('FRACT', g.math('DIVIDE', px, pitch)), 0.5)
        qy = g.sub(g.math('FRACT', g.math('DIVIDE', py, pitch * 1.732)), 0.5)
        return g.math('SQRT', g.add(g.mul(g.mul(qx, pitch), g.mul(qx, pitch)),
                                    g.mul(g.mul(qy, pitch * 1.732), g.mul(qy, pitch * 1.732))))
    d1 = cell(x, y)
    d2 = cell(g.add(x, pitch / 2), g.add(y, pitch * 0.866))
    d = g.math('MINIMUM', d1, d2)
    hole = g.mul(g.remap(d, 0.00064, 0.00052), grille)
    bevel = g.mul(g.remap(d, 0.00085, 0.0006), g.remap(d, 0.00052, 0.0006), grille)
    n = g.noise(g.coords(), 200.0, 3.0)
    prints = g.fingerprints(g.coords(), 45.0)
    g.p('Base Color', g.mix(hole, (0.016, 0.016, 0.017), (0.0, 0.0, 0.0)))
    g.p('Roughness', g.add(0.44, g.mul(n, 0.05), g.mul(prints, -0.2), g.mul(grille, -0.06), g.mul(bevel, -0.15)))
    g.p('Normal', g.bump(g.add(g.mul(hole, -1.0), g.mul(bevel, -0.35), g.mul(n, 0.08)), 0.45, 0.0005))


class Hub:
    """The starfish conference hub. `port` is the master-cord port in world space (it
    follows the hub's root if the hub is moved)."""

    def __init__(self, root_obj, leds, port_local):
        self.root = root_obj
        self.leds = leds
        self.port_local = Vector(port_local)

    @property
    def port(self):
        return self.root.matrix_world @ self.port_local

    def leds_off(self, frame):
        kprop(self.leds, 'led', frame - 1, 1.0)
        kprop(self.leds, 'led', frame, 0.0, 'CONSTANT')


def conference_hub(name='hub', coll=None, location=(0, 0, 0)):
    """The black three-lobed 'starfish' conference phone. One lobe points -Y (down the
    table); the master-cord port faces +Y (toward the host). A flat circular centre
    disc stands 1 mm proud of the lobed body and carries a blank dark display window."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, 0.0, 0.1)
    nt = 216
    R_DISC = 0.058
    prof = []                       # (rho, z, lobe blend) of the top surface outward

    for i in range(0, 9):           # centre disc, flat, glossy (material 1)
        rho = 0.33 * i / 8
        prof.append((rho, 0.0475, 0.0, 1))
    prof += [(0.335, 0.0472, 0.0, 1), (0.338, 0.0465, 0.0, 0)]          # crisp 1 mm step down
    prof += [(0.343, 0.0462, 0.0, 0)]
    for i in range(1, 15):
        rho = 0.343 + (0.93 - 0.343) * i / 14
        prof.append((rho, 0.0462 - 0.0302 * ((rho - 0.343) / 0.587) ** 1.25, 1.0, 0))
    prof += [(0.96, 0.0145, 1.0, 0), (0.985, 0.0118, 1.0, 0), (0.998, 0.0085, 1.0, 0), (1.0, 0.005, 1.0, 0),
             (0.996, 0.0018, 1.0, 0), (0.985, 0.0, 1.0, 0)]
    bm = bmesh.new()
    rings = []
    for rho, z, bl, _ in prof:
        ring = []
        for j in range(nt):
            th = 2 * math.pi * j / nt
            # inside the disc the radius is circular; outside, the lobes grow out of it
            if rho <= 0.335:
                R = R_DISC * rho / 0.335
            else:
                R = R_DISC + (rho - 0.335) / (1 - 0.335) * (_hub_r(th) - R_DISC)
            ring.append(bm.verts.new((R * math.cos(th), R * math.sin(th), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        bm_bridge(bm, rings[k + 1], rings[k], prof[k][3])
    bm_fan(bm, rings[-1], (0, 0, 0.0), 0, flip=False)
    c = bm.verts.new((0, 0, prof[0][1] + 0.0001))
    for j in range(nt):
        f = bm.faces.new((rings[0][j], rings[0][(j + 1) % nt], c))
        f.material_index = 1
    body = to_object(bm, f'{name}_body', [hub_plastic(), black_plastic(0.22, 0.01)], coll, smooth=40.0)
    body.parent = rt
    # blank display window on the disc, toward the host (no glyphs)
    win = box(f'{name}_display', (0.034, 0.013, 0.0008), (0.0, 0.024, 0.0478), dark_glass(0.004, 0.03), coll, 0.0004)
    win.parent = rt
    # three mic LEDs near the lobe tips + the cord port grommet
    lbm = bmesh.new()
    for k in range(3):
        th = -math.pi / 2 + 2 * math.pi * k / 3
        rho = 0.86
        R = _hub_r(th) * rho
        zz = 0.0462 - 0.0302 * ((rho - 0.343) / 0.587) ** 1.25
        tmp = bmesh.new()
        bm_lathe(tmp, [(0.0, 0.0), (0.0032, 0.0), (0.0030, 0.0009), (0.0018, 0.0016), (0.0, 0.0018)], 16)
        bmesh.ops.translate(tmp, verts=tmp.verts, vec=(R * math.cos(th), R * math.sin(th), zz - 0.0004))
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        lbm.from_mesh(me)
        bpy.data.meshes.remove(me)
    leds = to_object(lbm, f'{name}_leds', [led(LED_GREEN, 9.0, 'led')], coll, smooth=60.0)
    leds['led'] = 1.0
    leds.parent = rt
    port_local = Vector((0.0, _hub_r(math.pi / 2) * 0.99, 0.0085))
    grom = cylinder(f'{name}_port', 0.0055, 0.008, tuple(port_local), rubber(), coll, 20, 'Y', 0.0015)
    grom.parent = rt
    return Hub(rt, leds, port_local + Vector((0, 0.004, 0)))


# ================================================================== socket + jack


def _lathe_y(bm, profile, seg=48, mat=0):
    """Lathe a (r, y) profile about the Y axis, adding it to `bm` (other geometry already
    in `bm` is left alone: the lathe is built in its own bmesh, turned, then merged)."""
    tmp = bmesh.new()
    bm_lathe(tmp, [(r, y) for r, y in profile], seg, mat)
    bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'))
    me = bpy.data.meshes.new('_lathe_tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


SOCKET_FACE = 0.0050        # the jack's shoulder seats this far in front of the socket origin (bushing face)


def brass_socket(name='socket', coll=None, location=(0, 0, 0)):
    """Brass panel socket flush in the table's head edge, facing +Y. Origin on the edge face.

    A polished flange sits on the walnut; a threaded brass bushing rises through a hex
    nut (a ring with a real bore) to SOCKET_FACE; inside it a black insulator sleeve
    leads to the dark 3.5 mm bore. Seat the jack at origin + (0, SOCKET_FACE, 0)."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, 0.0, 0.02)
    bm = bmesh.new()
    # flange: proud of the walnut by 2.8 mm, its face polished, a 45-degree bevelled lip
    # rolling into a soft shoulder, so it reads as a brass ring round the jack
    prof = [(0.0042, -0.010), (0.0042, 0.0020), (0.0048, 0.0028), (0.0086, 0.0029), (0.0094, 0.0027),
            (0.0100, 0.0022), (0.0108, 0.0014), (0.0113, 0.0007), (0.0115, 0.0), (0.0117, -0.0012)]
    _lathe_y(bm, prof, 72)
    fl = to_object(bm, f'{name}_flange', [brass('satin')], coll, smooth=40.0, recalc=False)
    # threaded bushing: a tube with fine thread ridges, chamfered mouth (face 0.3 mm behind the seat)
    BF = SOCKET_FACE - 0.0004
    prof = [(0.0030, -0.006), (0.0030, BF - 0.0003), (0.0033, BF), (0.0037, BF),
            (0.0040, BF - 0.0003)]
    yv = BF - 0.0005
    while yv > 0.0012:
        prof += [(0.00395, yv), (0.00412, yv - 0.00018), (0.00395, yv - 0.00036)]
        yv -= 0.00036
    prof += [(0.0040, 0.0010), (0.0040, -0.006)]
    bm = bmesh.new()
    _lathe_y(bm, prof, 48)
    bush = to_object(bm, f'{name}_bushing', [brass('satin')], coll, smooth=30.0)
    # black insulator sleeve and the dark bore
    bm = bmesh.new()
    _lathe_y(bm, [(0.0, -0.012), (0.0019, -0.012), (0.0019, BF - 0.0008), (0.0024, BF - 0.0002),
                  (0.0030, BF - 0.0002), (0.0030, -0.006)], 48)
    ins = to_object(bm, f'{name}_insulator', [black_plastic(0.5, 0.004)], coll, smooth=40.0)
    # hex nut: a ring with a real bore, chamfered faces
    N = 48
    hexo = [(0.0074 * math.cos(math.pi / 6 + k * math.pi / 3), 0.0074 * math.sin(math.pi / 6 + k * math.pi / 3))
            for k in range(6)]
    outer = resample_closed(_fillet_polygon(hexo, 0.0008, 3), N)
    a0 = math.atan2(outer[0][1], outer[0][0])
    inner = [(0.00425 * math.cos(a0 + 2 * math.pi * k / N), 0.00425 * math.sin(a0 + 2 * math.pi * k / N)) for k in range(N)]
    cham = [(0.0049 * math.cos(a0 + 2 * math.pi * k / N), 0.0049 * math.sin(a0 + 2 * math.pi * k / N)) for k in range(N)]
    y0, y1 = 0.0029, 0.0045
    bm = bmesh.new()

    def ring3(pts, y):
        return bm_ring(bm, [(x, y, z) for x, z in pts])
    o0, o1 = ring3(outer, y0), ring3(outer, y1)
    c0, c1 = ring3(cham, y0 + 0.0002), ring3(cham, y1 - 0.0002)
    i0, i1 = ring3(inner, y0 + 0.0002), ring3(inner, y1 - 0.0002)
    bm_bridge(bm, o0, o1, 0)
    bm_bridge(bm, o1, c1, 0)
    bm_bridge(bm, c1, i1, 0)
    bm_bridge(bm, i1, i0, 0)
    bm_bridge(bm, i0, c0, 0)
    bm_bridge(bm, c0, o0, 0)
    nut = to_object(bm, f'{name}_nut', [brass('satin')], coll, smooth=30.0)
    for o in (fl, bush, ins, nut):
        o.parent = rt
    return rt


def _knurl_barrel(bm, r0, y0, y1, n_around=40, pitch=0.0011, depth=0.00016, seg_a=200, seg_y=None, band=0.0012, mat=0):
    """Diamond-knurled cylinder along Y (real geometry, crisp at macro)."""
    L = y1 - y0
    seg_y = seg_y or max(8, int(L / (pitch / 4)))
    rows = []
    for j in range(seg_y + 1):
        y = y0 + L * j / seg_y
        edge = min(1.0, min(y - y0, y1 - y) / band)
        row = []
        for i in range(seg_a):
            a = 2 * math.pi * i / seg_a
            u = a * n_around / (2 * math.pi)
            v = y / pitch

            def tri(x):
                return abs((x % 1.0) - 0.5) * 2
            h = min(tri(u + v), tri(u - v))
            r = r0 + depth * (h - 0.5) * edge - depth * 0.5 * (1 - edge)
            row.append(bm.verts.new((r * math.cos(a), y, r * math.sin(a))))
        rows.append(row)
    for a, b in zip(rows, rows[1:]):
        bm_bridge(bm, a, b, mat)
    return rows


class Jack:
    def __init__(self, root_obj, tail_local):
        self.root = root_obj
        self.tail_local = Vector(tail_local)


def gold_jack(name='jack', coll=None, location=(0, 0, 0)):
    """Gold 3.5 mm TRS plug, axis +Y (pin toward -Y into the socket, cord out of +Y).
    Origin at the plug shoulder (flush with the socket face when inserted)."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, 0.0, 0.02)
    chrome_m = chrome(0.06)
    ins = black_plastic(0.35, 0.006)
    gld = gold()
    # pin: tip, notch, insulators, ring, sleeve (material per segment)
    bm = bmesh.new()
    segs = [
        ([(0.0, -0.0150), (0.0009, -0.0149), (0.0015, -0.0145), (0.00175, -0.0138), (0.00175, -0.0131),
          (0.0012, -0.0128), (0.0012, -0.0126)], 0),
        ([(0.0012, -0.0126), (0.00172, -0.0125), (0.00172, -0.0114)], 1),
        ([(0.00172, -0.0114), (0.00175, -0.0113), (0.00175, -0.0081)], 0),
        ([(0.00175, -0.0081), (0.00172, -0.0080), (0.00172, -0.0070)], 1),
        ([(0.00172, -0.0070), (0.00176, -0.0069), (0.00176, -0.0002), (0.0, -0.0002)], 0),
    ]
    for prof, mi in segs:
        tmp = bmesh.new()
        _lathe_y(tmp, prof, 40, mi)
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    pin = to_object(bm, f'{name}_pin', [chrome_m, ins], coll, smooth=40.0, recalc=False)
    # shoulder + knurled barrel + taper (gold)
    bm = bmesh.new()
    _lathe_y(bm, [(0.0, -0.0003), (0.0044, -0.0003), (0.0047, 0.0002), (0.0047, 0.0020)], 64)
    _knurl_barrel(bm, 0.0049, 0.0020, 0.0225)
    _lathe_y(bm, [(0.0047, 0.0225), (0.0047, 0.0262), (0.0043, 0.0285), (0.0039, 0.0300), (0.0, 0.0300)], 64)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    barrel = to_object(bm, f'{name}_barrel', [gld], coll, smooth=50.0, recalc=False)
    # strain relief, black rubber: a taper of six soft rounded beads (no saw teeth)
    prof = []
    n = 72
    for i in range(n + 1):
        t = i / n
        y = 0.0295 + 0.0165 * t
        bead = 0.5 - 0.5 * math.cos(2 * math.pi * 6 * t)
        r = 0.0037 - 0.0012 * t + 0.00020 * bead ** 0.7 - 0.0001
        prof.append((r, y))
    prof = [(0.0, 0.0295)] + prof + [(0.0, 0.0460)]
    bm = bmesh.new()
    _lathe_y(bm, prof, 40)
    relief = to_object(bm, f'{name}_relief', [rubber()], coll, smooth=60.0, recalc=False)
    for o in (pin, barrel, relief):
        o.parent = rt
    return Jack(rt, (0.0, 0.046, 0.0))


# ================================================================== hero cup + lid

CUP = dict(h=0.111, r_bot=0.030, r_top=0.0442, bead=0.0016, lid_r=0.0472,
           slot_len=0.015, slot_w=0.005, slot_r=0.0385, slot_theta=math.pi / 2)


def _lid_profile():
    """(r, z) outer surface of the lid from the centre to the bottom of the skirt."""
    zc = 0.1235
    out = []
    n = 248
    for i in range(n + 1):           # recessed centre with embossed rings: 0.9 mm relief, crisp shoulders
        r = 0.031 * i / n
        z = zc + 0.0006 * (r / 0.031) ** 2
        for rc, hw in ((0.0095, 0.0010), (0.0165, 0.0011), (0.0235, 0.0012)):
            t = min(1.0, max(0.0, (hw - abs(r - rc)) / 0.00032))
            z += 0.0009 * t * t * (3 - 2 * t)
        out.append((r, z))
    for i in range(1, 21):            # rise to the drink-through ring
        t = i / 20
        r = 0.031 + 0.0035 * t
        out.append((r, zc + 0.0006 + 0.0049 * (0.5 - 0.5 * math.cos(math.pi * t))))
    for i in range(1, 25):            # plateau, faintly domed
        t = i / 24
        r = 0.0345 + 0.0080 * t
        out.append((r, 0.1290 + 0.0003 * math.sin(math.pi * t)))
    cx, cz, rr = 0.0425, 0.1262, 0.0028
    for i in range(1, 13):            # rolled outer edge
        a = math.pi / 2 - math.pi / 2 * i / 12
        out.append((cx + (0.0047 - rr) * 0 + rr * math.cos(a) + (0.0047 - rr) * (i / 12), cz + rr * math.sin(a)))
    out += [(0.0472, 0.1225), (0.0473, 0.1150), (0.0476, 0.1095), (0.0478, 0.1080), (0.0472, 0.1078)]
    return out


def _spout(r, th):
    """Raised spout bump around the sip slot (metres of extra height)."""
    t = CUP['slot_r'] * math.atan2(math.sin(th - CUP['slot_theta']), math.cos(th - CUP['slot_theta']))
    n = r - CUP['slot_r']

    def S(x):
        x = min(1.0, abs(x))
        return (1 - x * x) ** 2
    return 0.0034 * S(t / 0.0150) * S(n / 0.0072)


class Cup:
    """Hero cup + lid. root carries everything; `slot` is an empty at the sip-slot centre
    (Z out of the slot, X along its long axis) for posting objects; slot_glow keys the
    amber pulse inside the slot."""

    def __init__(self, root_obj, slot, glow, parts):
        self.root = root_obj
        self.slot = slot
        self.glow = glow
        self.parts = parts

    def slot_glow(self, frame, dur=6, peak=1.0):
        kprop(self.glow, 'led', frame - 1, 0.0)
        kprop(self.glow, 'led', frame + 1, peak)
        kprop(self.glow, 'led', frame + dur - 2, peak * 0.6)
        kprop(self.glow, 'led', frame + dur, 0.0)


def cup_and_lid(name='cup', coll=None, location=(0, 0, 0), rot_z=0.0, hero=True):
    """Plain white paper hot cup (faint seam, rolled rim) with a polystyrene sip lid:
    embossed concentric rings, a raised drink-through ring and a rounded-oblong
    1.5 x 0.5 cm sip slot on a slightly raised spout. No text anywhere.
    Origin at the bottom centre of the cup. hero=False builds a lighter mesh."""
    coll = coll or bpy.context.scene.collection
    rt = root(name, coll, location, rot_z, 0.05)
    seg = 160 if hero else 64
    # ---- cup: lathe of a thin paper wall with a recessed base and a rolled rim
    h, rb, rt_ = CUP['h'], CUP['r_bot'], CUP['r_top']

    def wall_r(z):
        return rb + (rt_ - rb) * z / h
    prof = [(0.0, 0.0055), (rb - 0.0012, 0.0055), (rb - 0.0006, 0.0010), (rb - 0.0002, 0.0)]
    for i in range(0, 25):
        z = 0.001 + (h - 0.001) * i / 24
        prof.append((wall_r(z), z))
    bc = Vector((rt_ + 0.0004, h + CUP['bead'] * 0.9))
    for i in range(1, 17):
        a = -math.pi * 0.62 + (math.pi * 1.62) * i / 16
        prof.append((bc.x + CUP['bead'] * math.cos(a), bc.y + CUP['bead'] * math.sin(a)))
    for i in range(0, 13):
        z = h - 0.001 - (h - 0.008) * i / 12
        prof.append((wall_r(z) - 0.0006, z))
    prof.append((0.0, 0.0075))
    bm = bmesh.new()
    rings = bm_lathe(bm, prof, seg)
    # faint overlap seam: a hair-thin radial step on the outer wall
    th_s = math.radians(200)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        d = math.atan2(math.sin(a - th_s), math.cos(a - th_s))
        if 0.001 < v.co.z < h - 0.0005 and 0 <= d < math.radians(5):
            rr = math.hypot(v.co.x, v.co.y)
            k = (rr + 0.00025) / rr
            v.co.x *= k
            v.co.y *= k
    cup = to_object(bm, f'{name}_cup', [cup_paper()], coll, smooth=50.0, recalc=False)
    # ---- lid: polar grid with a clean stadium cut through the spout
    lid = _build_lid(f'{name}_lid', coll, hero)
    # coffee surface and the amber glow under the slot
    coffee = cylinder(f'{name}_coffee', wall_r(0.100) - 0.0008, 0.0005, (0, 0, 0.100), coffee_mat(), coll, seg // 2)
    gx = CUP['slot_r'] * math.cos(CUP['slot_theta'])
    gy = CUP['slot_r'] * math.sin(CUP['slot_theta'])
    # amber glow: a stadium matching the slot (16 x 6 mm), just under it and inside the lid
    gbm = bmesh.new()
    outline = stadium(CUP['slot_len'] + 0.001, CUP['slot_w'] + 0.001, 12)
    bm_prism(gbm, outline, -0.0002, 0.0002)
    glow = to_object(gbm, f'{name}_slotglow', [led(AMBER, 30.0, 'led', base=0.004)], coll, smooth=None)
    glow.location = (gx, gy, _lid_z(CUP['slot_r'], CUP['slot_theta']) - 0.0045)
    glow.rotation_euler = (0, 0, CUP['slot_theta'] + math.pi / 2)
    glow['led'] = 0.0
    glow.visible_shadow = False
    slot = C.empty(f'{name}_slot', coll, (gx, gy, _lid_z(CUP['slot_r'], CUP['slot_theta'])), 'ARROWS', 0.01)
    slot.rotation_euler = (0, 0, CUP['slot_theta'] + math.pi / 2)
    for o in (cup, lid, coffee, glow, slot):
        o.parent = rt
    return Cup(rt, slot, glow, dict(cup=cup, lid=lid, coffee=coffee))


def _lid_z(r, th, prof_cache={}):
    if 'p' not in prof_cache:
        p = _lid_profile()
        top = [(rr, zz) for rr, zz in p if rr <= 0.0436]
        prof_cache['p'] = (np.array([x[0] for x in top]), np.array([x[1] for x in top]))
    rs, zs = prof_cache['p']
    z = float(np.interp(r, rs, zs))
    w = 1.0 if r < 0.0430 else max(0.0, 1 - (r - 0.0430) / 0.002)
    return z + _spout(r, th) * w


def _build_lid(name, coll, hero=True):
    prof = _lid_profile()
    nt = 288 if hero else 144
    ths = [2 * math.pi * j / nt for j in range(nt)]
    bm = bmesh.new()

    # top region rows use the spout-aware height; skirt rows follow the profile
    grid = []
    pole_z = prof[0][1]
    prof = prof[1:]
    for (r, z) in prof:
        row = []
        for th in ths:
            zz = z
            if r <= 0.0445:
                zz = z + _spout(r, th) * (1.0 if r < 0.0430 else max(0.0, 1 - (r - 0.0430) / 0.0015))
            row.append(bm.verts.new((r * math.cos(th), r * math.sin(th), zz)))
        grid.append(row)
    # window around the slot (indices in theta and profile rows)
    rs = [p[0] for p in prof]
    k0 = min(range(len(rs)), key=lambda k: abs(rs[k] - (CUP['slot_r'] - 0.0042)))
    k1 = min(range(len(rs)), key=lambda k: abs(rs[k] - (CUP['slot_r'] + 0.0040)))
    jc = int(round(CUP['slot_theta'] / (2 * math.pi) * nt)) % nt
    half = int(math.ceil((CUP['slot_len'] / 2 + 0.0035) / CUP['slot_r'] / (2 * math.pi / nt)))
    j0, j1 = jc - half, jc + half

    def inwin(k, j):
        jj = (j - jc + nt // 2) % nt - nt // 2
        return k0 <= k < k1 and -half <= jj < half
    for k in range(len(grid) - 1):
        a, b = grid[k], grid[k + 1]
        for j in range(nt):
            if inwin(k, j):
                continue
            f = bm.faces.new((a[j], a[(j + 1) % nt], b[(j + 1) % nt], b[j]))
    bm_fan(bm, grid[0], (0, 0, pole_z), 0, flip=True)
    # window boundary loop (CCW in t,n): bottom (k0) j0->j1, right (j1) k0->k1, top (k1) j1->j0, left (j0) k1->k0
    loop = []
    for j in range(j0, j1):
        loop.append(grid[k0][j % nt])
    for k in range(k0, k1):
        loop.append(grid[k][j1 % nt])
    for j in range(j1, j0, -1):
        loop.append(grid[k1][j % nt])
    for k in range(k1, k0, -1):
        loop.append(grid[k][j0 % nt])
    nb = len(loop)
    # boundary in slot-local (t, n) coordinates
    rs_, ths_ = CUP['slot_r'], CUP['slot_theta']

    def to_tn(v):
        r = math.hypot(v.co.x, v.co.y)
        th = math.atan2(v.co.y, v.co.x)
        d = math.atan2(math.sin(th - ths_), math.cos(th - ths_))
        return Vector((rs_ * d, r - rs_))

    btn = [to_tn(v) for v in loop]
    # stadium (tangential length, radial width), starting at the same angle as loop[0], same winding
    st = stadium(CUP['slot_len'], CUP['slot_w'], 24)
    st = resample_closed(st, nb)
    a0 = math.atan2(btn[0].y, btn[0].x)
    best = min(range(nb), key=lambda i: abs(math.atan2(math.sin(math.atan2(st[i][1], st[i][0]) - a0),
                                                          math.cos(math.atan2(st[i][1], st[i][0]) - a0))))
    st = st[best:] + st[:best]
    st = [Vector(p) for p in st]

    def to_3d(tn, dz=0.0):
        r = rs_ + tn.y
        th = ths_ + tn.x / rs_
        return Vector((r * math.cos(th), r * math.sin(th), _lid_z(r, th) + dz))

    prev = loop
    J = 4
    for jj in range(1, J + 1):
        t = jj / J
        ring = [bm.verts.new(to_3d(btn[i].lerp(st[i], t ** 0.8))) for i in range(nb)]
        for i in range(nb):
            ii = (i + 1) % nb
            try:
                bm.faces.new((prev[i], prev[ii], ring[ii], ring[i]))
            except ValueError:
                pass
        prev = ring
    # slot walls: down through the lid thickness, then a soft lip inside
    wall = [bm.verts.new(to_3d(st[i] * 1.0, -0.0016)) for i in range(nb)]
    for i in range(nb):
        ii = (i + 1) % nb
        bm.faces.new((prev[i], prev[ii], wall[ii], wall[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # make the top face up (solidify then thickens inward/down)
    up = sum(f.normal.z for f in bm.faces if f.calc_center_median().length < 0.02)
    if up < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(cup_lid_mat())
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    C.smooth(obj, 50.0)
    sol = obj.modifiers.new('Solidify', 'SOLIDIFY')
    sol.thickness = 0.0006
    sol.offset = -1.0
    sol.use_even_offset = True
    return obj


@cached
def cup_paper(m):
    """Paper hot cup #F2F0EB: matte, slightly translucent, faint vertical seam line."""
    g = G(m)
    P = g.coords()
    x, y, z = g.sep(g.obj())
    ang = g.math('ARCTAN2', y, x)
    seam = g.remap(g.math('ABSOLUTE', g.sub(ang, math.radians(201))), 0.006, 0.0)
    fib = g.noise(P, 500.0, 4.0, 0.65)
    col = g.mix(g.mul(fib, 0.07), CUP_PAPER, tuple(c * 0.86 for c in CUP_PAPER))
    col = g.mix(g.mul(seam, 0.18), col, (0.68, 0.66, 0.62))
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.55, g.mul(fib, 0.1)))
    g.p('Subsurface Weight', 0.12)
    g.p('Subsurface Radius', (1.0, 0.85, 0.6))
    g.p('Subsurface Scale', 0.003)
    g.p('Sheen Weight', 0.15)
    g.p('Normal', g.bump(g.add(g.mul(fib, 0.3), g.mul(seam, 0.4)), 0.12, 0.0004))


@cached
def cup_lid_mat(m):
    """White polystyrene lid #F7F5F1, roughness ~0.35, a little translucent."""
    g = G(m)
    P = g.coords()
    n = g.noise(P, 300.0, 3.0)
    prints = g.fingerprints(P, 80.0)
    g.p('Base Color', CUP_LID)
    g.p('Roughness', g.add(0.32, g.mul(n, 0.05), g.mul(prints, -0.12)))
    g.p('Subsurface Weight', 0.1)
    g.p('Subsurface Radius', (1.0, 1.0, 0.9))
    g.p('Subsurface Scale', 0.002)
    g.p('Normal', g.bump(n, 0.03, 0.0002))


@cached
def coffee_mat(m):
    g = G(m)
    g.p('Base Color', ESPRESSO)
    g.p('Roughness', 0.08)
    g.p('Coat Weight', 0.3)


@cached
def steam_mat(m):
    """Rising wisps: animated stretched noise as alpha, backlight-friendly (translucent)."""
    g = G(m, principled=False)
    P = g.obj()
    x, y, z = g.sep(P)
    nz = g.node('ShaderNodeTexNoise', noise_dimensions='4D')
    mp = g.node('ShaderNodeMapping')
    g._set(mp.inputs['Vector'], g.coords((3.0, 5.0, 0.0)))
    g._set(mp.inputs['Scale'], (60.0, 60.0, 9.0))
    drv = mp.inputs['Location'].driver_add('default_value', 2)
    drv.driver.expression = '-frame*0.012'
    g._set(nz.inputs['Vector'], mp.outputs['Vector'])
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = 4.0
    nz.inputs['Roughness'].default_value = 0.6
    nz.inputs['Distortion'].default_value = 1.2
    d2 = nz.inputs['W'].driver_add('default_value')
    d2.driver.expression = 'frame*0.03'
    wisp = g.remap(nz.outputs['Fac'], 0.52, 0.70, smooth=True)
    # fade in from the lid, out at the top, soft at the card sides
    fade = g.mul(g.remap(z, 0.0, 0.03), g.remap(z, 0.16, 0.06), g.remap(g.math('ABSOLUTE', x), 0.03, 0.012))
    alpha = g.mul(wisp, fade, 0.45)
    tr = g.node('ShaderNodeBsdfTranslucent')
    tr.inputs['Color'].default_value = (0.95, 0.96, 1.0, 1)
    df = g.node('ShaderNodeBsdfDiffuse')
    df.inputs['Color'].default_value = (0.9, 0.9, 0.92, 1)
    mx = g.node('ShaderNodeMixShader')
    mx.inputs['Fac'].default_value = 0.6
    g.L.new(df.outputs[0], mx.inputs[1])
    g.L.new(tr.outputs[0], mx.inputs[2])
    tp = g.node('ShaderNodeBsdfTransparent')
    m2 = g.node('ShaderNodeMixShader')
    g._set(m2.inputs['Fac'], alpha)
    g.L.new(tp.outputs[0], m2.inputs[1])
    g.L.new(mx.outputs[0], m2.inputs[2])
    g.L.new(m2.outputs[0], g.out.inputs['Surface'])


def steam_cards(name='steam', coll=None, location=(0, 0, 0), n=3, seed=2, parent=None):
    """3-4 crossed alpha cards of animated wisps rising from the lid (no shadows).
    parent: an object to follow (e.g. a Cup's root); location is then local to it."""
    coll = coll or bpy.context.scene.collection
    rng = random.Random(seed)
    rt = root(name, coll, location, 0.0, 0.03)
    if parent is not None:
        rt.parent = parent
    for i in range(n):
        bm = bmesh.new()
        W, H = 0.07, 0.17
        uv = bm.loops.layers.uv.new('UVMap')
        vs = [bm.verts.new((x, 0, z)) for x, z in ((-W / 2, 0), (W / 2, 0), (W / 2, H), (-W / 2, H))]
        bm.faces.new(vs)
        o = to_object(bm, f'{name}{i}', [steam_mat()], coll, smooth=None, recalc=False)
        o.rotation_euler = (0, 0, math.radians(180 * i / n + rng.uniform(-10, 10)))
        o.location = (rng.uniform(-0.004, 0.004), rng.uniform(-0.004, 0.004), 0.0)
        o.visible_shadow = False
        o.parent = rt
    return rt


# ================================================================== motion helpers


def slide(obj, f0, f1, start_xy, end_xy, settle=0.004, spin_deg=0.0, accel=0.45):
    """Glide `obj` across the walnut from start_xy to end_xy between f0 and f1.

    Eased in (it 'decides' to go) and out, arriving `settle` metres past the mark at
    f1 and easing back onto it by f1+4 (a tiny settle; settle=0 stops dead).
    accel (0..1) is the fraction of the move spent speeding up. Z is untouched;
    spin_deg turns it about Z over the glide (the frisbee envelope). Keys every
    frame (linear), so motion blur sees the true speed."""
    a = Vector((start_xy[0], start_xy[1]))
    b = Vector((end_xy[0], end_xy[1]))
    d = b - a
    dirn = d.normalized() if d.length > 1e-9 else Vector((0.0, 0.0))
    over = b + dirn * settle
    z = obj.location.z
    rz0 = obj.rotation_euler.z
    n = max(1, f1 - f0)
    ta = min(0.95, max(0.05, accel))
    # piecewise: quadratic ease-in to cruise speed, then cubic ease-out (C1 continuous)
    v = 1.0 / (ta / 2 + (1 - ta) / 3 * 1.0 + (1 - ta) * 0.0)

    def prog(t):
        if t <= ta:
            return v * t * t / (2 * ta)
        u = (t - ta) / (1 - ta)
        return v * ta / 2 + v * (1 - ta) * (1 - (1 - u) ** 3) / 3
    norm = prog(1.0)
    for i in range(n + 1):
        e = prog(i / n) / norm
        p = a + (over - a) * e
        obj.location = (p.x, p.y, z)
        obj.rotation_euler.z = rz0 + math.radians(spin_deg) * e
        obj.keyframe_insert('location', frame=f0 + i)
        obj.keyframe_insert('rotation_euler', index=2, frame=f0 + i)
    if settle > 0:
        for k in range(1, 5):
            p = over.lerp(b, C.ease(k / 4))
            obj.location = (p.x, p.y, z)
            obj.keyframe_insert('location', frame=f1 + k)
    ad = obj.animation_data
    if ad and ad.action:
        for fc in C.fcurves(ad.action):
            if fc.data_path in ('location', 'rotation_euler'):
                for kp in fc.keyframe_points:
                    if f0 <= kp.co.x <= f1 + 4:
                        kp.interpolation = 'LINEAR'
    return obj


# ================================================================== dust in the slab


@cached
def dust_mat(m):
    """Tiny airborne specks: bright only where the sun slab catches them."""
    g = G(m)
    g.p('Base Color', (0.9, 0.88, 0.84))
    g.p('Roughness', 0.6)
    g.p('Sheen Weight', 0.6)
    g.p('Subsurface Weight', 0.0)


def dust_motes(name='dust', coll=None, center=(0.0, 0.0, 1.0), size=(0.8, 0.8, 0.6), n=260, f0=1, f1=1440,
               cache_dir=None, seed=9, radius=(0.00018, 0.0005)):
    """Slow-drifting dust specks (a box of `size` around `center`), baked to a PC2 cache
    (default <film>/out/cache/, so a saved .blend keeps them).

    Each speck is a tiny octahedron; positions follow a gentle curl-ish random drift
    with a slight sink, wrapping inside the box. Visible only where light hits them
    (the skylight slab), so they read as motes in the beam in macro shots."""
    import os
    import cache as K
    coll = coll or bpy.context.scene.collection
    rng = np.random.default_rng(seed)
    tv = np.array([(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)], np.float32)
    tf = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    cen = np.array(center, np.float32)
    half = np.array(size, np.float32) / 2
    p = rng.uniform(-half, half, (n, 3)).astype(np.float32)
    rad = rng.uniform(radius[0], radius[1], n).astype(np.float32)
    phase = rng.uniform(0, 2 * np.pi, (n, 3)).astype(np.float32)
    freq = rng.uniform(0.15, 0.45, (n, 3)).astype(np.float32)
    frames = f1 - f0 + 1
    pos = np.zeros((frames, n * 6, 3), np.float32)
    rot = np.tile(np.eye(3, dtype=np.float32), (n, 1, 1))
    for k in range(frames):
        t = k / 24.0
        drift = 0.012 * np.sin(freq * t + phase) + np.array((0.0015, 0.0, -0.0025), np.float32) * t
        q = p + drift
        q = (q + half) % (2 * half) - half
        # each speck shrinks to nothing in the outer 15% of the box, so a wrap (it leaves one
        # face and re-enters at the opposite one) happens at zero size: no jump, no blur streak
        edge = np.clip((half - np.abs(q)) / (0.15 * half), 0.0, 1.0)
        fade = np.prod(edge * edge * (3.0 - 2.0 * edge), axis=1).astype(np.float32)
        pos[k] = K.transform_instances(tv, rot, q + cen, rad * fade)
    verts, faces = K.instance_mesh(tv, tf, n)
    obj = K.mesh_from(pos[0], faces, name, coll, dust_mat())
    obj.visible_shadow = False
    if cache_dir is None:            # persistent, so a saved .blend keeps its dust
        cache_dir = os.path.join(C.ROOT, 'out', 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f'{name}_{seed}.pc2')
    K.write_pc2(path, pos, start=f0)
    K.attach_pc2(obj, path, f0)
    return obj
