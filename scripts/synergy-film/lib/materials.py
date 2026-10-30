"""Procedural Cycles materials for Synergy and his props.

Every public function returns a bpy material and caches it by name, so
calling cream_enamel(0.5) twice gives the same datablock. Everything is
procedural (noise / voronoi / bevel / AO nodes). Texture space is the
object's own coordinates plus a stable per-object random offset, so wear
never swims when a part moves and two plates never share a pattern. Rims and
seams come from the plates' 'edge_w' point attribute (Graph.plate_edge), and the
crevice AO is object-local, so no wear mask reacts to a neighbouring object (a hand,
the headset, the cup). SYNERGY_MASK=chip|rim|rust|grime|edge|seam|crev renders a mask.

Palette and finish values come from the visual canon (visual_canon.json),
warmed and aged per the director notes (enamel #D8BE98 with stains, grime clouds and
edge chips to oxidised steel; galvanized grey #827D76 at metallic 0.45 / roughness 0.58;
the head's grey plates darker and drier, #6E6860). Plate shaders read a per-plate random
(object random plus the 'plate_rand' face attribute) for tone drift between plates.
Rivet heads, rust blooms and tapering bleed stains are separate small decal materials.

Render cost: call set_quality('proof' | 'preview' | 'final' | 'hero') before or
after building; it sets the Bevel/AO ray samples of every Synergy material
(proof: 2, no AO on the small metals; final/hero: 4).
"""

import math

import bpy

# ------------------------------------------------------------------ colour


def srgb(hexstr):
    """'#E3D2B4' -> linear RGB tuple."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


CREAM = srgb('#D8BE98')
CREAM_WARM = srgb('#B8976E')
CREAM_STAIN = srgb('#A68A66')
CREAM_DUST = srgb('#B9A584')
FINGER = srgb('#C4B298')
FINGER_WARM = srgb('#AC9576')
STEEL_BARE = srgb('#B4B0A8')
STEEL_OXIDE = srgb('#4A443C')
SCRATCH_DARK = srgb('#6D5A45')
GALV = srgb('#827D76')
GALV_HEAD = srgb('#78726A')
RIVET = srgb('#6E6962')
RIVET_RUST_A = srgb('#4F2E17')
RIVET_RUST_B = srgb('#6B4A30')
RUST_ORANGE = srgb('#8F4A1F')
RUST_CORE = srgb('#4F2E17')
RUST_BLEED = srgb('#A0643A')
GRIME = srgb('#2B2621')
GUN_PLATE = srgb('#3A3631')
GUN_INNER = srgb('#2E2B28')
CHROME = srgb('#D0D2D4')
BRONZE = srgb('#6B5236')
BRONZE_TIP = srgb('#6E4F33')
COPPER = srgb('#B87333')
RED_WIRE = srgb('#9E2A1E')
BLACK_PLASTIC = srgb('#161616')
LEATHER = srgb('#0E0E0E')
FOAM = srgb('#121212')
BRASS = srgb('#7A6247')
STREAK_TOP = srgb('#6B3A1A')
STRAP = srgb('#1C1C1B')
CLIP = srgb('#C8C8C8')
CARD = srgb('#F4F2EE')
CUP = srgb('#F2F0EB')
LID = srgb('#E3DFD8')
BAND = srgb('#121212')
BLUE_CHIP = srgb('#1F5FA8')
SLOT_WELL = srgb('#080503')
LED_INK = srgb('#2BB357')


# ------------------------------------------------------------------ render-cost switch

# Bevel / AO ray samples per quality tier. 'proof' halves the cost of every plate
# shader and skips AO on the small metals; hero close-ups keep 4 samples.
QUALITY_TIERS = {
    'animatic': dict(bevel=1, ao=1, metal_ao=False),
    'proof': dict(bevel=2, ao=2, metal_ao=False),
    'preview': dict(bevel=2, ao=2, metal_ao=True),
    'final': dict(bevel=4, ao=4, metal_ao=True),
    'hero': dict(bevel=4, ao=4, metal_ao=True),
}
_Q = dict(QUALITY_TIERS['final'])
EDGE_BAND = 0.012          # width of the plates' 'edge_w' ramp (metres), see synergy.MB / plate_edge()


def set_quality(level):
    """Pick Bevel/AO sample counts for every Synergy material (existing and future).
    level: 'animatic' | 'proof' | 'preview' | 'final' | 'hero'."""
    _Q.update(QUALITY_TIERS.get(level, QUALITY_TIERS['final']))
    for m in bpy.data.materials:
        if not m.get('synergy_mat') or not m.node_tree:
            continue
        metal = bool(m.get('metal_ao'))
        for n in m.node_tree.nodes:
            if n.type == 'BEVEL':
                n.samples = _Q['bevel']
            elif n.type == 'AMBIENT_OCCLUSION':
                n.samples = _Q['ao'] if (not metal or _Q['metal_ao']) else 1
                n.only_local = True     # wear never reacts to other objects (no swimming)
    return dict(_Q)


# ------------------------------------------------------------------ graph helper


class Graph:
    """Tiny node-graph builder: sockets or plain numbers are accepted everywhere."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.N = self.nt.nodes
        self.L = self.nt.links
        for n in list(self.N):
            self.N.remove(n)
        self.out = self.N.new('ShaderNodeOutputMaterial')
        self.bsdf = self.N.new('ShaderNodeBsdfPrincipled')
        self.L.new(self.bsdf.outputs['BSDF'], self.out.inputs['Surface'])

    # --- plumbing
    def _set(self, sock, val):
        if val is None:
            return
        if isinstance(val, bpy.types.NodeSocket):
            self.L.new(val, sock)
        else:
            if isinstance(val, (int, float)) and hasattr(sock, 'default_value') and \
                    hasattr(sock.default_value, '__len__'):
                n = len(sock.default_value)
                val = (val,) * n if n != 4 else (val, val, val, 1.0)
            elif isinstance(val, tuple) and hasattr(sock.default_value, '__len__') and \
                    len(sock.default_value) == 4 and len(val) == 3:
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

    def set_in(self, node, name, val):
        self._set(node.inputs[name], val)

    def p(self, name, val):
        """Set or link a Principled input."""
        self._set(self.bsdf.inputs[name], val)

    # --- coordinates
    def coords(self, offset_scale=(13.7, 29.3, 7.1)):
        """Object-space coordinates offset by a per-object random vector."""
        tc = self.node('ShaderNodeTexCoord')
        oi = self.node('ShaderNodeObjectInfo')
        off = self.vmath('SCALE', offset_scale, scale=oi.outputs['Random'])
        self.obj = tc.outputs['Object']
        self.uv = tc.outputs['UV']
        return self.vmath('ADD', tc.outputs['Object'], off)

    def geometry(self):
        return self.node('ShaderNodeNewGeometry')

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

    def maxf(self, *xs):
        acc = xs[0]
        for x in xs[1:]:
            acc = self.math('MAXIMUM', acc, x)
        return acc

    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self._set(n.inputs[0], a)
        if b is not None:
            self._set(n.inputs[1], b)
        if scale is not None:
            self._set(n.inputs['Scale'], scale)
        out = n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']
        return out

    def sep(self, v):
        n = self.node('ShaderNodeSeparateXYZ')
        self._set(n.inputs[0], v)
        return n.outputs['X'], n.outputs['Y'], n.outputs['Z']

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

    def mix(self, fac, a, b):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type='MIX', clamp_factor=True)
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
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY', clamp_factor=True)
        self._set(self.sock(n.inputs, 'Factor_Float'), 1.0)
        self._set(self.sock(n.inputs, 'A_Color'), a)
        self._set(self.sock(n.inputs, 'B_Color'), b)
        return self.sock(n.outputs, 'Result_Color')

    # --- textures
    def noise(self, vec, scale=5.0, detail=4.0, rough=0.55, lac=2.0, distortion=0.0, dims='3D'):
        n = self.node('ShaderNodeTexNoise', noise_dimensions=dims)
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
        return n.outputs['Distance'], n.outputs['Color']

    def red(self, col):
        n = self.node('ShaderNodeSeparateColor')
        self._set(n.inputs['Color'], col)
        return n.outputs['Red']

    # --- masks
    def edge_mask(self, radius=0.004, lo=0.004, hi=0.09):
        """1 on convex/concave edges, from the Bevel node's rounded normal."""
        bv = self.node('ShaderNodeBevel', samples=_Q['bevel'])
        self._set(bv.inputs['Radius'], radius)
        g = self.geometry()
        d = self.vmath('DOT_PRODUCT', bv.outputs['Normal'], g.outputs['Normal'])
        return self.remap(self.math('SUBTRACT', 1.0, d), lo, hi)

    def crevice_mask(self, distance=0.015, lo=0.97, hi=0.55, samples=None, metal=False):
        """1 around rivets and in folds: object-local ambient occlusion, so the wear never
        changes when another object (a hand, the headset, the cup) comes near."""
        if samples is None:
            samples = _Q['ao'] if (not metal or _Q['metal_ao']) else 1
        ao = self.node('ShaderNodeAmbientOcclusion', samples=samples, only_local=True, inside=False)
        self._set(ao.inputs['Distance'], distance)
        return self.remap(ao.outputs['AO'], lo, hi)

    def vrot(self, vec, angle_deg, axis=(0.577, 0.577, 0.577)):
        n = self.node('ShaderNodeVectorRotate', rotation_type='AXIS_ANGLE')
        self._set(n.inputs['Vector'], vec)
        self._set(n.inputs['Axis'], axis)
        self._set(n.inputs['Angle'], math.radians(angle_deg))
        return n.outputs['Vector']

    def attr(self, name):
        n = self.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name=name)
        return n.outputs['Fac']

    def hsv(self, col, hue=0.5, sat=1.0, val=1.0):
        n = self.node('ShaderNodeHueSaturation')
        self._set(n.inputs['Color'], col)
        self._set(n.inputs['Hue'], hue)
        self._set(n.inputs['Saturation'], sat)
        self._set(n.inputs['Value'], val)
        self._set(n.inputs['Fac'], 1.0)
        return n.outputs['Color']

    def plate_rand(self):
        """Stable 0..1 random per plate: object random, decorrelated by the per-face
        'plate_rand' attribute that Synergy's mesh builder writes on multi-plate objects."""
        oi = self.node('ShaderNodeObjectInfo')
        r = self.math('FRACT', self.add(oi.outputs['Random'], self.mul(self.attr('plate_rand'), 0.7713)))
        return r

    def plate_variation(self, col, value=0.06, sat=0.12, hue=0.006, sat_bias=0.0, hue_bias=0.0):
        """+-value brightness, +-sat saturation and a hair of hue drift per plate."""
        r = self.plate_rand()
        r2 = self.math('FRACT', self.add(self.mul(r, 7.13), 0.31))
        r3 = self.math('FRACT', self.add(self.mul(r, 13.7), 0.57))
        return self.hsv(col, hue=self.add(0.5 - hue + hue_bias, self.mul(r3, 2 * hue)),
                        sat=self.add(1.0 - sat + sat_bias, self.mul(r2, 2 * sat)),
                        val=self.add(1.0 - value, self.mul(r, 2 * value)))

    def plate_edge(self, band=EDGE_BAND):
        """Distance-to-rim masks for Synergy's plates. The mesh builder writes the point
        attribute 'edge_w' (1 on a plate's outline, falling linearly to 0 at EDGE_BAND inside
        it, 0 on objects without plates). Returns (dist, near): dist = metres from the rim
        (EDGE_BAND where the attribute is absent), near = 1 on the rim -> 0 at `band`."""
        ew = self.attr('edge_w')
        dist = self.mul(self.math('SUBTRACT', 1.0, ew), EDGE_BAND)
        return dist, self.remap(dist, 0.0, band, 1.0, 0.0)

    def debug(self, masks):
        """SYNERGY_MASK=<name> renders that mask as emission instead of the BSDF (wear tuning)."""
        import os
        want = os.environ.get('SYNERGY_MASK')
        if not want or want not in masks:
            return
        e = self.node('ShaderNodeEmission')
        self._set(e.inputs['Color'], masks[want])
        self._set(e.inputs['Strength'], 1.0)
        self.L.new(e.outputs[0], self.out.inputs['Surface'])

    def bump(self, height, strength=0.3, distance=0.0008, normal=None):
        b = self.node('ShaderNodeBump')
        self._set(b.inputs['Height'], height)
        self._set(b.inputs['Strength'], strength)
        self._set(b.inputs['Distance'], distance)
        if normal is not None:
            self._set(b.inputs['Normal'], normal)
        return b.outputs['Normal']


def _get(name):
    m = bpy.data.materials.get(name)
    if m is not None and m.get('synergy_mat'):
        return m
    return None


def _new(name):
    m = bpy.data.materials.new(name)
    m['synergy_mat'] = True
    return m


def _rust_color(g, P):
    n = g.noise(P, 160.0, 3.0, 0.6)
    c = g.mix(g.remap(n, 0.35, 0.65), RUST_CORE, RUST_ORANGE)
    return g.mix(g.remap(g.noise(P, 45.0, 2.0), 0.55, 0.8), c, RUST_BLEED)


# ------------------------------------------------------------------ painted plates


def cream_enamel(wear=0.5, coat=0.28):
    """Aged ivory enamel on riveted steel.

    Everything is fixed to the plate: tone drift per plate, a mid-scale mottle and stains
    (luminance std ~6-12/255 inside a lit plate), dust on up-facing plates, edge chips that
    bite 2-6 mm into the rim down to dark oxidised steel with a thin bright rim, rust
    freckles at rims and rivets, grime packed into the seams, faint scratches and a soft
    clearcoat sheen. Rims come from the plates' 'edge_w' attribute (distance to the outline,
    written by the mesh builder), with the Bevel node as a fallback on non-plate parts;
    crevices are object-local AO, so nothing changes when a hand or the headset comes near.
    coat: clearcoat weight on clean enamel."""
    wear = max(0.0, min(1.0, float(wear)))
    name = f'cream_enamel_w{int(round(wear * 100)):03d}'
    if abs(coat - 0.28) > 1e-6:
        name += f'_c{int(round(coat * 100)):02d}'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    g = Graph(m)
    P = g.coords()
    _, _, oz = g.sep(g.obj)
    geo = g.geometry()
    _, _, nz = g.sep(geo.outputs['Normal'])
    dist, near6 = g.plate_edge(0.006)
    near12 = g.remap(dist, 0.0, 0.012, 1.0, 0.0)
    bev = g.edge_mask(0.004, 0.004, 0.10)            # non-plate parts (bezel lip, caps)
    edge = g.maxf(near6, g.mul(bev, 0.8))
    crev = g.crevice_mask(0.012)                     # around rivets, inside folds (object-local)
    lower = g.remap(oz, 0.02, -0.07)
    n_big = g.noise(P, 3.0, 2.0, 0.5)
    n_mid = g.noise(P, 14.0, 5.0, 0.6)
    n_fine = g.noise(P, 70.0, 5.0, 0.65)
    patina = g.mul(g.remap(n_big, 0.40, 0.56), g.remap(nz, -0.25, -0.55, 1.0, 0.25))   # no warm pooling on down-facing plates
    # ---- edge chips: irregular 2-6 mm bites into the rim, down to dark oxidised steel
    n_chip = g.noise(P, 75.0, 8.0, 0.72, distortion=0.35)
    n_chip2 = g.noise(P, 240.0, 4.0, 0.6)
    chip_f = g.add(g.mul(edge, 0.95), g.mul(g.math('SUBTRACT', n_chip, 0.5), 2.2),
                   g.mul(g.math('SUBTRACT', n_chip2, 0.5), 0.6), g.mul(g.math('SUBTRACT', n_big, 0.5), 0.3),
                   (wear - 0.5) * 0.3)
    chip = g.remap(chip_f, 0.94, 0.99)
    ding = g.mul(g.remap(g.noise(P, 110.0, 3.0, 0.5), 0.715, 0.735), g.remap(n_mid, 0.45, 0.75), wear)
    chip = g.maxf(chip, ding)
    rim = g.mul(g.remap(chip_f, 0.89, 0.94), g.math('SUBTRACT', 1.0, chip))
    # ---- rust freckles: two sizes (0.5-2.5 mm and 2.5-6 mm), at rims, rivets and lower edges
    cluster = g.remap(g.noise(P, 9.0, 3.0, 0.6), 0.42, 0.72)
    dens = g.mul(g.add(g.mul(near12, 0.85), g.mul(crev, 1.0), g.mul(lower, g.add(crev, near12), 0.3)),
                 g.add(0.55, g.mul(cluster, 0.8)), wear * 1.25)
    vd, vc = g.voronoi(P, 190.0)
    cell = g.red(vc)
    pick = g.remap(g.math('SUBTRACT', cell, dens), 0.03, -0.03)
    size = g.add(0.12, g.mul(cell, 0.3))
    fr1 = g.mul(pick, g.remap(g.math('SUBTRACT', vd, size), 0.05, -0.05))
    halo = g.mul(pick, g.remap(g.math('SUBTRACT', vd, g.mul(size, 1.9)), 0.14, -0.04), 0.4)
    vd2, vc2 = g.voronoi(P, 60.0)
    cell2 = g.red(vc2)
    pick2 = g.remap(g.math('SUBTRACT', cell2, g.mul(dens, 0.35)), 0.03, -0.03)
    size2 = g.add(0.10, g.mul(cell2, 0.22))
    fr2 = g.mul(pick2, g.remap(g.math('SUBTRACT', vd2, size2), 0.04, -0.04))
    freckle = g.maxf(fr1, fr2)
    # ---- faint bleed running down from the upper rim of each plate (rivet streaks are decals)
    Ps = g.vmath('MULTIPLY', P, (85.0, 85.0, 4.5))
    n_streak = g.noise(Ps, 1.0, 3.0, 0.55)
    gate = g.remap(g.noise(P, 6.0, 2.0), 0.48, 0.74)
    streak = g.mul(g.remap(n_streak, 0.54, 0.72), gate, g.add(g.mul(near12, 0.6), g.mul(lower, 0.5)), wear * 1.1)
    streak = g.math('MINIMUM', streak, 1.0)
    chip_rust = g.mul(chip, g.add(g.mul(lower, 0.6), 0.25), g.remap(n_mid, 0.45, 0.62))
    rust = g.math('MINIMUM', g.maxf(fr1, fr2, halo, g.mul(streak, 0.5), chip_rust), 1.0)
    # ---- scratches: three layers at 0 / 60 / 120 degrees, dark (grime packed into them)
    sc = []
    for ang in (0.0, 60.0, 120.0):
        Pr = g.vrot(P, ang)
        Pk = g.vmath('MULTIPLY', Pr, (650.0, 20.0, 20.0))
        sc.append(g.remap(g.noise(Pk, 1.0, 2.0), 0.690, 0.720))
    scratch = g.mul(g.maxf(*sc), g.remap(n_big, 0.25, 0.65), wear)
    # ---- grime packed into the seam along every rim, broken up; a dirty lower edge
    breakup = g.add(0.30, g.mul(g.remap(g.noise(P, 22.0, 3.0), 0.3, 0.7), 0.70))
    seam = g.math('POWER', near12, 1.7)
    grime = g.math('MINIMUM', g.add(g.mul(seam, breakup, 0.80), g.mul(crev, 0.40), g.mul(streak, 0.25),
                                    g.mul(patina, 0.08), g.mul(lower, near12, 0.25 * wear)), 0.92)
    # ---- colour: warm ivory, per-plate drift, mottle, stains, speckle, dust on top surfaces
    base = g.mix(patina, CREAM, CREAM_WARM)
    mott = g.noise(P, 24.0, 4.0, 0.6)
    base = g.mix(g.remap(mott, 0.38, 0.62), g.colmul(base, (0.80, 0.77, 0.71)), g.colmul(base, (1.05, 1.04, 1.03)))
    stain = g.noise(P, 8.0, 5.0, 0.65, distortion=0.5)
    base = g.mix(g.mul(g.remap(stain, 0.46, 0.64), 0.72), base, CREAM_STAIN)
    cloud = g.noise(P, 4.5, 4.0, 0.6, distortion=0.8)          # big soft grime clouds (handled, never washed)
    base = g.mix(g.mul(g.remap(cloud, 0.50, 0.68), 0.42), base, srgb('#6E5A43'))
    base = g.mix(g.mul(g.remap(n_fine, 0.55, 0.75), 0.40), base, srgb('#9C8463'))
    speck = g.noise(P, 300.0, 3.0, 0.5)
    base = g.mix(g.mul(g.remap(speck, 0.58, 0.70), 0.30), base, srgb('#8A7458'))
    base = g.mix(g.mul(g.remap(nz, 0.50, 0.95), g.remap(n_mid, 0.3, 0.7, 0.06, 0.16)), base, CREAM_DUST)
    # per plate +-7% value / +-12% saturation; biased +16% saturation and a few degrees toward
    # yellow so the lit enamel stays warm cream (not pink, not white) under cool 6500K light;
    # down-facing plates (chin, undersides) lose some saturation so warm bounce never turns
    # them mustard
    base = g.plate_variation(base, value=0.07, sat_bias=0.16, hue_bias=0.008)
    base = g.hsv(base, sat=g.remap(nz, -0.25, -0.70, 1.0, 0.72))
    base = g.mix(g.mul(scratch, 0.75), base, SCRATCH_DARK)
    base = g.mix(grime, base, GRIME)
    oxide = g.mix(0.4, STEEL_OXIDE, RUST_CORE)
    oxide = g.mix(g.remap(n_fine, 0.3, 0.7), g.colmul(oxide, (0.70, 0.67, 0.64)), oxide)
    col = g.mix(rim, base, STEEL_BARE)
    col = g.mix(chip, col, oxide)
    col = g.mix(rust, col, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(g.add(g.mul(chip, 0.40), g.mul(rim, 0.85)), g.math('SUBTRACT', 1.0, rust)))
    rough = g.add(0.40, g.mul(mott, 0.10), g.mul(n_mid, 0.08), g.mul(grime, 0.18), g.mul(patina, 0.06))
    rough = g.mixf(chip, rough, 0.62)
    rough = g.mixf(rim, rough, 0.32)
    rough = g.mixf(rust, rough, 0.88)
    g.p('Roughness', rough)
    clean = g.math('SUBTRACT', 1.0, g.maxf(chip, rust, grime))
    g.p('Coat Weight', g.mul(clean, coat))
    g.p('Coat Roughness', g.add(0.30, g.mul(n_mid, 0.08)))
    h = g.add(g.mul(chip, -0.60), g.mul(rim, 0.12), g.mul(n_big, 0.35), g.mul(freckle, 0.3), g.mul(scratch, -0.2),
              g.mul(g.noise(P, 900.0, 2.0), 0.05), g.mul(n_fine, 0.05), g.mul(stain, 0.06))
    g.p('Normal', g.bump(h, 0.34, 0.0009))
    g.debug(dict(chip=chip, rim=rim, rust=rust, grime=grime, edge=edge, seam=seam, crev=crev))
    return m


def finger_enamel():
    """Finger segments: a paler, less saturated enamel (#D4C6B4) worn smooth by handling,
    grime at both ends, small chips only at the segment ends, no scratches or streaks."""
    m = _get('finger_enamel')
    if m:
        return m
    m = _new('finger_enamel')
    g = Graph(m)
    P = g.coords()
    bev = g.edge_mask(0.003, 0.004, 0.12)
    crev = g.crevice_mask(0.008)
    n_mid = g.noise(P, 30.0, 4.0, 0.6)
    n_fine = g.noise(P, 160.0, 4.0, 0.6)
    n_chip = g.noise(P, 140.0, 6.0, 0.7, distortion=0.3)
    chip = g.remap(g.add(g.mul(bev, 0.9), g.mul(g.math('SUBTRACT', n_chip, 0.5), 2.0)), 0.95, 1.0)
    grime = g.math('MINIMUM', g.add(g.mul(crev, 0.55), g.mul(bev, 0.25)), 0.8)
    col = g.mix(g.remap(n_mid, 0.3, 0.7), FINGER_WARM, FINGER)
    col = g.mix(g.mul(g.remap(n_fine, 0.55, 0.75), 0.35), col, srgb('#9A8770'))
    stain = g.noise(P, 45.0, 5.0, 0.65, distortion=0.4)
    col = g.mix(g.mul(g.remap(stain, 0.48, 0.66), 0.45), col, srgb('#8E7A60'))
    Pk = g.vmath('MULTIPLY', g.vrot(P, 35.0), (900.0, 30.0, 30.0))
    scr = g.remap(g.noise(Pk, 1.0, 2.0), 0.69, 0.72)
    col = g.mix(g.mul(scr, 0.6), col, SCRATCH_DARK)
    col = g.plate_variation(col, value=0.05, sat=0.08)
    col = g.mix(grime, col, GRIME)
    col = g.mix(chip, col, g.mix(0.5, STEEL_OXIDE, STEEL_BARE))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(chip, 0.5))
    g.p('Roughness', g.add(0.38, g.mul(n_mid, 0.10), g.mul(grime, 0.2)))
    g.p('Coat Weight', g.mul(g.math('SUBTRACT', 1.0, g.maxf(chip, grime)), 0.30))
    g.p('Coat Roughness', 0.28)
    g.p('Normal', g.bump(g.add(g.mul(chip, -0.5), g.mul(n_fine, 0.1)), 0.25, 0.0005))
    return m


def galvanized_grey(wear=0.4, tone='torso'):
    """Recessed galvanized steel panels: fine zinc spangle, large zinc mottling, faint
    brushing, grime in the seams and light rust. Satin metal (metallic 0.45, roughness 0.58)
    per the director's note. tone='head' is darker and drier (#6E6860, roughness 0.65, a low
    dielectric specular) so the head cheek reads as grey beside the screen even under a key
    that hits the wedge head-on."""
    head = tone == 'head'
    name = f'galvanized_grey{"_head" if head else ""}_w{int(round(wear * 100)):03d}'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    g = Graph(m)
    P = g.coords()
    _, _, oz = g.sep(g.obj)
    dist, near = g.plate_edge(0.012)
    bev = g.edge_mask(0.004)
    edge = g.maxf(g.remap(dist, 0.0, 0.003, 1.0, 0.0), g.mul(bev, 0.6))
    crev = g.crevice_mask(0.012)
    seam = g.math('POWER', near, 1.6)
    lower = g.remap(oz, 0.02, -0.07)
    vd, vc = g.voronoi(P, 110.0, rand=0.9)
    spang = g.red(vc)
    mott = g.noise(P, 8.0, 3.0, 0.55)
    n_big = g.noise(P, 4.0, 2.0)
    n_mid = g.noise(P, 14.0, 4.0, 0.6)
    Pb = g.vmath('MULTIPLY', P, (380.0, 380.0, 7.0))
    brush = g.noise(Pb, 1.0, 2.0, 0.5)
    gc = GALV_HEAD if head else GALV
    base = g.mix(spang, g.colmul(gc, (0.93, 0.93, 0.93)), g.colmul(gc, (1.07, 1.07, 1.06)))
    base = g.mix(g.remap(mott, 0.35, 0.65), g.colmul(base, (0.88, 0.88, 0.88)), g.colmul(base, (1.10, 1.10, 1.09)))
    base = g.plate_variation(base, value=0.05, sat=0.10)
    base = g.mix(g.mul(g.remap(n_mid, 0.4, 0.8), 0.28), base, (0.11, 0.10, 0.09))
    base = g.mix(g.mul(edge, 0.30), base, STEEL_BARE)
    base = g.mix(g.math('MINIMUM', g.add(g.mul(seam, 0.75), g.mul(crev, 0.35), g.mul(g.remap(n_big, 0.55, 0.9), 0.2)),
                                    0.85), base, GRIME)
    vd2, vc2 = g.voronoi(P, 180.0)
    dens = g.mul(g.add(g.mul(crev, 0.6), g.mul(near, 0.35), g.mul(edge, 0.3), g.mul(lower, 0.15)), wear * 1.2)
    fr = g.mul(g.remap(g.math('SUBTRACT', g.red(vc2), dens), 0.03, -0.03),
               g.remap(g.math('SUBTRACT', vd2, 0.3), 0.05, -0.05))
    Ps = g.vmath('MULTIPLY', P, (85.0, 85.0, 4.5))
    streak = g.mul(g.remap(g.noise(Ps, 1.0, 3.0), 0.56, 0.74), g.remap(g.noise(P, 6.0, 2.0), 0.5, 0.75),
                   g.add(g.mul(near, 0.6), g.mul(lower, 0.4), 0.1), wear)
    rust = g.math('MINIMUM', g.maxf(fr, g.mul(streak, 0.5)), 1.0)
    col = g.mix(rust, base, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(g.math('SUBTRACT', 1.0, rust), 0.35 if head else 0.45))
    g.p('Specular IOR Level', 0.12 if head else 0.25)
    rough = g.add(0.65 if head else 0.58, g.mul(n_mid, 0.12), g.mul(spang, 0.05), g.mul(brush, 0.05),
                  g.mul(seam, 0.08), -0.06)
    g.p('Roughness', g.mixf(rust, rough, 0.85))
    h = g.add(g.mul(brush, 0.12), g.mul(n_big, 0.45), g.mul(spang, 0.06), g.mul(fr, 0.2))
    g.p('Normal', g.bump(h, 0.22, 0.0008))
    g.debug(dict(rust=rust, grime=seam, edge=edge, crev=crev))
    return m


def blue_chip():
    """Flaked cobalt enamel patch (#1F5FA8) on one cream plate: satin cobalt with a few
    cream and steel islands where it has flaked, fine scratches; the mesh adds a raised flake
    lip and a 0.5 mm bare-steel rim (chip_rim) around it."""
    m = _get('blue_chip')
    if m:
        return m
    m = _new('blue_chip')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 90.0, 6.0, 0.7)
    n2 = g.noise(P, 30.0, 3.0)
    isl = g.noise(P, 140.0, 5.0, 0.65, distortion=0.3)
    island = g.remap(isl, 0.64, 0.68)
    Pk = g.vmath('MULTIPLY', P, (500.0, 18.0, 18.0))
    scr = g.remap(g.noise(Pk, 1.0, 2.0), 0.69, 0.73)
    col = g.mix(g.remap(n2, 0.3, 0.7), g.colmul(BLUE_CHIP, (0.80, 0.82, 0.86)), BLUE_CHIP)
    col = g.plate_variation(col, value=0.04, sat=0.05, hue=0.004)
    col = g.mix(g.mul(scr, 0.5), col, CREAM)
    flake_under = g.mix(g.remap(n, 0.4, 0.6), CREAM, STEEL_OXIDE)
    col = g.mix(island, col, flake_under)
    g.p('Base Color', col)
    g.p('Roughness', g.mixf(island, g.add(0.40, g.mul(n, 0.08)), 0.55))
    g.p('Coat Weight', g.mul(g.math('SUBTRACT', 1.0, island), 0.2))
    g.p('Coat Roughness', 0.3)
    g.p('Normal', g.bump(g.add(g.mul(n, 0.3), g.mul(island, -0.6), g.mul(scr, -0.3)), 0.3, 0.0004))
    return m


def chip_rim():
    """Bare steel showing in the 0.5 mm ring where the cream enamel flaked round the blue chip."""
    m = _get('chip_rim')
    if m:
        return m
    m = _new('chip_rim')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 400.0, 3.0)
    g.p('Base Color', g.mix(g.remap(n, 0.35, 0.65), STEEL_OXIDE, STEEL_BARE))
    g.p('Metallic', 0.8)
    g.p('Roughness', g.add(0.32, g.mul(n, 0.15)))
    return m


def slot_well():
    """Inside of the cup under the sip slot: near-black coffee brown (#080503)."""
    m = _get('slot_well')
    if m:
        return m
    m = _new('slot_well')
    g = Graph(m)
    g.p('Base Color', SLOT_WELL)
    g.p('Roughness', 0.95)
    g.p('Specular IOR Level', 0.0)          # it must not mirror the key straight back up the slot
    return m


def slot_glow(strength=30.0):
    """The amber pulse inside the hero cup's slot well (object property 'led' 0..1, keyed by
    props.Cup.slot_glow). Off, it is as dark as the well (no glossy coat to mirror the key)."""
    m = _get('slot_glow')
    if m:
        return m
    m = _new('slot_glow')
    g = Graph(m)
    a = g.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='led')
    g.p('Base Color', srgb('#080503'))
    g.p('Roughness', 0.95)
    g.p('Specular IOR Level', 0.0)
    g.p('Emission Color', srgb('#FFA64A'))
    g.p('Emission Strength', g.mul(a.outputs['Fac'], strength))
    try:
        m.cycles.emission_sampling = 'NONE'
    except (AttributeError, TypeError):
        pass
    return m


def rust_streak():
    """Rust bleed decal under a rivet (UVs: u across 0..1, v from the rivet 0 to the tail 1).
    The mesh is wide under the head (8-12 mm) and tapers to ~2 mm; here the stain fades,
    breaks up and frays at the sides so it reads as a stain, never as a bar or a glyph."""
    m = _get('rust_streak')
    if m:
        return m
    m = _new('rust_streak')
    g = Graph(m)
    P = g.coords()
    u, v, _ = g.sep(g.uv)
    v = g.math('MINIMUM', v, 1.0)
    Pn = g.vmath('MULTIPLY', P, (260.0, 260.0, 60.0))
    wob = g.noise(Pn, 1.0, 4.0, 0.65)
    across = g.math('ABSOLUTE', g.add(g.math('SUBTRACT', g.mul(u, 2.0), 1.0), g.mul(g.math('SUBTRACT', wob, 0.5), 0.6)))
    side = g.remap(across, g.add(0.95, g.mul(v, -0.15)), 0.15, smooth=True)
    fade = g.mul(g.math('POWER', g.math('SUBTRACT', 1.0, v), 1.4), g.remap(v, 0.0, 0.10))
    Ps = g.vmath('MULTIPLY', P, (300.0, 300.0, 22.0))
    drip = g.remap(g.noise(Ps, 1.0, 4.0, 0.65), 0.38, 0.72)
    alpha = g.mul(side, fade, g.add(0.25, g.mul(drip, 0.75)), 0.42)
    col = g.mix(g.remap(v, 0.0, 0.35), g.mix(0.5, STREAK_TOP, RUST_BLEED), RUST_BLEED)
    col = g.mix(g.mul(drip, 0.35), col, RUST_ORANGE)
    g.p('Base Color', col)
    g.p('Roughness', 0.82)
    g.p('Alpha', alpha)
    return m


def rust_ring():
    """Rust bloom round a rivet head (UVs: disc centre 0.5,0.5, rim at radius 0.5): a ragged,
    noise-warped, soft-edged stain fading out well inside the disc rim, never a washer."""
    m = _get('rust_ring')
    if m:
        return m
    m = _new('rust_ring')
    g = Graph(m)
    P = g.coords()
    d = g.mul(g.vmath('LENGTH', g.vmath('SUBTRACT', g.uv, (0.5, 0.5, 0.0))), 2.0)
    warp = g.add(g.mul(g.noise(P, 110.0, 4.0, 0.65), 0.7), g.mul(g.noise(P, 400.0, 3.0, 0.6), 0.3))
    dw = g.add(d, g.mul(g.math('SUBTRACT', warp, 0.5), 1.1))
    ring = g.remap(dw, 0.85, 0.30, smooth=True)
    blot = g.remap(g.noise(P, 160.0, 3.0, 0.6), 0.35, 0.70)
    alpha = g.mul(g.math('POWER', ring, 1.6), blot, 0.42)
    col = g.mix(g.remap(d, 0.35, 0.9), RUST_CORE, RUST_BLEED)
    col = g.mix(g.mul(g.remap(warp, 0.55, 0.7), 0.4), col, RUST_ORANGE)
    g.p('Base Color', col)
    g.p('Roughness', 0.86)
    g.p('Alpha', alpha)
    return m


# ------------------------------------------------------------------ metals


def chrome(satin=False):
    """Hard chrome (pistons, rods). satin=True: bead-blasted caps (elbow and knee axles) that
    keep a soft sheen instead of mirroring a coloured light into a 'lamp'."""
    name = 'chrome_satin' if satin else 'chrome'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    m['metal_ao'] = True
    g = Graph(m)
    P = g.coords()
    crev = g.crevice_mask(0.01, 0.97, 0.6, metal=True)
    n = g.noise(P, 40.0, 4.0, 0.6)
    smudge = g.remap(g.noise(P, 9.0, 3.0), 0.5, 0.8)
    base = CHROME if not satin else srgb('#9C9A96')
    g.p('Base Color', g.mix(g.mul(crev, 0.7), base, GRIME))
    g.p('Metallic', 1.0)
    r0 = 0.36 if satin else 0.12
    g.p('Roughness', g.add(r0, g.mul(smudge, 0.12), g.mul(n, 0.04), g.mul(crev, 0.2)))
    Pb = g.vmath('MULTIPLY', P, (6.0, 6.0, 900.0))
    g.p('Normal', g.bump(g.noise(Pb, 1.0, 2.0), 0.05, 0.0005))
    return m


def gunmetal(tone='inner'):
    """Dark machined steel. tone='inner' (#2E2B28 internals) or 'plate' (#3A3631 underside plates)."""
    name = f'gunmetal_{tone}'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    m['metal_ao'] = True
    g = Graph(m)
    P = g.coords()
    base_c = GUN_PLATE if tone == 'plate' else GUN_INNER
    edge = g.edge_mask(0.003)
    crev = g.crevice_mask(0.012, 0.97, 0.6, metal=True)
    n = g.noise(P, 25.0, 4.0, 0.6)
    col = g.mix(g.remap(n, 0.3, 0.7), g.colmul(base_c, (0.8, 0.8, 0.8)), base_c)
    col = g.mix(g.mul(edge, 0.6), col, (0.25, 0.24, 0.22))
    col = g.mix(g.mul(crev, 0.6), col, (0.008, 0.007, 0.006))
    if tone == 'plate':
        vd, vc = g.voronoi(P, 180.0)
        fr = g.mul(g.remap(g.math('SUBTRACT', g.red(vc), g.add(0.05, g.mul(crev, 0.4))), 0.03, -0.03),
                   g.remap(g.math('SUBTRACT', vd, 0.3), 0.05, -0.05))
        col = g.mix(fr, col, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', 0.75)
    g.p('Roughness', g.add(0.38, g.mul(n, 0.2), g.mul(crev, 0.15)))
    g.p('Normal', g.bump(g.noise(P, 300.0, 2.0), 0.08, 0.0005))
    return m


def bronze(tone='disc'):
    """Tarnished dark bronze. tone='disc' (#6B5236 vertebrae) or 'tip' (#6E4F33 finger caps)."""
    name = f'bronze_{tone}'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    m['metal_ao'] = True
    g = Graph(m)
    P = g.coords()
    c = BRONZE if tone == 'disc' else BRONZE_TIP
    n = g.noise(P, 60.0, 5.0, 0.6)
    crev = g.crevice_mask(0.008, 0.97, 0.6, metal=True)
    col = g.mix(g.remap(n, 0.35, 0.7), g.colmul(c, (0.55, 0.55, 0.5)), c)
    col = g.mix(g.mul(crev, 0.6), col, (0.02, 0.016, 0.01))
    tip = tone == 'tip'
    if tip:   # tarnished brown cap: oxide film over the metal, no bright copper sheen
        col = g.mix(g.remap(g.noise(P, 25.0, 3.0), 0.4, 0.7, 0.2, 0.5), col, srgb('#4A3828'))
    g.p('Base Color', col)
    g.p('Metallic', 0.55 if tip else 0.95)
    g.p('Roughness', g.add(0.55 if tip else 0.3, g.mul(n, 0.15 if tip else 0.25)))
    g.p('Normal', g.bump(n, 0.1, 0.0004))
    return m


def brass():
    m = _get('brass')
    if m:
        return m
    m = _new('brass')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 50.0, 4.0)
    g.p('Base Color', g.mix(g.remap(n, 0.3, 0.7), g.colmul(BRASS, (0.72, 0.70, 0.66)), g.colmul(BRASS, (1.08, 1.05, 1.0))))
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(0.36, g.mul(n, 0.1)))
    return m


def rivet_steel():
    """Dull steel dome rivets, a little rust packed around the base."""
    m = _get('rivet_steel')
    if m:
        return m
    m = _new('rivet_steel')
    m['metal_ao'] = True
    g = Graph(m)
    P = g.coords()
    crev = g.crevice_mask(0.006, 0.97, 0.7, metal=True)
    n = g.noise(P, 120.0, 4.0, 0.6)
    pick = g.remap(g.noise(P, 26.0, 2.0), 0.45, 0.62)
    rust = g.math('MINIMUM', g.add(g.mul(crev, pick, 1.1), g.mul(g.remap(n, 0.6, 0.7), pick, 0.6)), 1.0)
    col = g.mix(g.remap(n, 0.3, 0.7), g.colmul(RIVET, (0.62, 0.60, 0.57)), RIVET)
    col = g.plate_variation(col, value=0.12, sat=0.2)
    col = g.mix(rust, col, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(g.math('SUBTRACT', 1.0, rust), 0.6))
    g.p('Roughness', g.mixf(rust, g.add(0.48, g.mul(n, 0.2)), 0.85))
    g.p('Normal', g.bump(g.add(g.mul(n, 0.4), g.mul(rust, 0.4)), 0.2, 0.0003))
    return m


def rivet_rust():
    """Rivet heads rusted through: dark brown #4F2E17-#6B4A30, crusty."""
    m = _get('rivet_rust')
    if m:
        return m
    m = _new('rivet_rust')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 220.0, 5.0, 0.7)
    n2 = g.noise(P, 60.0, 3.0)
    col = g.mix(g.remap(n2, 0.3, 0.7), RIVET_RUST_A, RIVET_RUST_B)
    col = g.mix(g.mul(g.remap(n, 0.6, 0.75), 0.5), col, RUST_ORANGE)
    g.p('Base Color', col)
    g.p('Metallic', 0.15)
    g.p('Roughness', g.add(0.75, g.mul(n, 0.15)))
    g.p('Normal', g.bump(n, 0.5, 0.0004))
    return m


def copper_wire():
    m = _get('copper_wire')
    if m:
        return m
    m = _new('copper_wire')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 80.0, 4.0)
    g.p('Base Color', g.mix(g.remap(n, 0.3, 0.7), g.colmul(COPPER, (0.6, 0.55, 0.5)), COPPER))
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(0.22, g.mul(n, 0.18)))
    return m


def dark_core():
    """Unlit interior of shells: oily dark steel that swallows light."""
    m = _get('dark_core')
    if m:
        return m
    m = _new('dark_core')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 30.0, 3.0)
    g.p('Base Color', g.mix(n, (0.006, 0.0055, 0.005), (0.018, 0.016, 0.014)))
    g.p('Metallic', 0.5)
    g.p('Roughness', 0.55)
    return m


# ------------------------------------------------------------------ plastics and soft goods


def black_plastic(gloss=False):
    name = 'black_plastic_gloss' if gloss else 'black_plastic'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 220.0, 3.0)
    g.p('Base Color', BLACK_PLASTIC)
    g.p('Roughness', g.add(0.38 if gloss else 0.55, g.mul(n, 0.08)))
    g.p('Specular IOR Level', 0.25)
    g.p('Normal', g.bump(g.noise(P, 900.0, 2.0), 0.04, 0.0003))
    return m


def leatherette():
    m = _get('leatherette')
    if m:
        return m
    m = _new('leatherette')
    g = Graph(m)
    P = g.coords()
    vd, _ = g.voronoi(P, 420.0, rand=1.0)
    wr = g.noise(g.vmath('MULTIPLY', P, (40.0, 40.0, 140.0)), 1.0, 3.0, 0.6)
    g.p('Base Color', LEATHER)
    g.p('Roughness', g.add(0.42, g.mul(vd, 0.2)))
    g.p('Sheen Weight', 0.25)
    g.p('Sheen Roughness', 0.4)
    g.p('Normal', g.bump(g.add(g.mul(vd, 0.3), g.mul(g.remap(wr, 0.55, 0.7), -0.6)), 0.35, 0.0008))
    return m


def rubber():
    """Black rubber / anodized joint bands and knuckle hubs (#121212)."""
    m = _get('rubber')
    if m:
        return m
    m = _new('rubber')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 300.0, 3.0)
    g.p('Base Color', BAND)
    g.p('Roughness', g.add(0.5, g.mul(n, 0.15)))
    g.p('Normal', g.bump(n, 0.05, 0.0003))
    return m


def mic_foam():
    m = _get('mic_foam')
    if m:
        return m
    m = _new('mic_foam')
    g = Graph(m)
    P = g.coords()
    vd, _ = g.voronoi(P, 900.0, feature='F1')
    n = g.noise(P, 500.0, 4.0)
    g.p('Base Color', FOAM)
    g.p('Roughness', 0.95)
    g.p('Specular IOR Level', 0.2)
    g.p('Sheen Weight', 0.6)
    g.p('Sheen Roughness', 0.5)
    g.p('Sheen Tint', (0.22, 0.22, 0.22))
    g.p('Normal', g.bump(g.add(vd, g.mul(n, 0.5)), 0.6, 0.0008))
    return m


def red_wire():
    m = _get('red_wire')
    if m:
        return m
    m = _new('red_wire')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 60.0, 3.0)
    g.p('Base Color', g.mix(n, g.colmul(RED_WIRE, (0.7, 0.7, 0.7)), RED_WIRE))
    g.p('Roughness', 0.32)
    g.p('Coat Weight', 0.3)
    return m


def orange_wire():
    m = _get('orange_wire')
    if m:
        return m
    m = _new('orange_wire')
    g = Graph(m)
    g.p('Base Color', srgb('#B5561C'))
    g.p('Roughness', 0.35)
    return m


def paper_cup():
    """Plain white paper hot cup, slightly translucent, faint vertical seam."""
    m = _get('paper_cup')
    if m:
        return m
    m = _new('paper_cup')
    g = Graph(m)
    P = g.coords((0, 0, 0))
    x, y, z = g.sep(g.obj)
    ang = g.math('ARCTAN2', y, x)
    seam = g.remap(g.math('ABSOLUTE', g.math('SUBTRACT', ang, 2.6)), 0.012, 0.004)
    n = g.noise(P, 300.0, 4.0, 0.6)
    g.p('Base Color', g.mix(g.mul(seam, 0.25), CUP, (0.72, 0.70, 0.66)))
    g.p('Roughness', g.add(0.5, g.mul(n, 0.1)))
    g.p('Subsurface Weight', 0.12)
    g.p('Subsurface Radius', (0.8, 0.7, 0.5))
    g.p('Subsurface Scale', 0.004)
    g.p('Sheen Weight', 0.15)
    g.p('Normal', g.bump(g.add(g.mul(n, 0.2), g.mul(seam, 0.6)), 0.15, 0.0005))
    return m


def cup_lid():
    """Hero sip lid: white polystyrene #E3DFD8 (lit top ~L0.88, not clipped), satin 0.33
    roughness with a faint orange-peel micro bump and a few greasy touch marks, a hint of
    translucency. Used on Synergy's own cup (props' lid material elsewhere)."""
    m = _get('cup_lid')
    if m:
        return m
    m = _new('cup_lid')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 200.0, 3.0)
    peel = g.noise(P, 1400.0, 2.0, 0.5)
    smudge = g.remap(g.noise(P, 60.0, 3.0), 0.55, 0.75)
    g.p('Base Color', g.mix(g.mul(g.remap(n, 0.4, 0.7), 0.25), LID, srgb('#DDD9D2')))
    g.p('Roughness', g.add(0.33, g.mul(n, 0.05), g.mul(smudge, -0.10)))
    g.p('Subsurface Weight', 0.06)
    g.p('Subsurface Radius', (0.8, 0.8, 0.7))
    g.p('Subsurface Scale', 0.002)
    g.p('Normal', g.bump(g.add(g.mul(peel, 0.6), g.mul(n, 0.3)), 0.06, 0.00015))
    return m


def lanyard_strap():
    """Flat black woven polyester. Needs UVs: u along the strap, v across."""
    m = _get('lanyard_strap')
    if m:
        return m
    m = _new('lanyard_strap')
    g = Graph(m)
    P = g.coords()
    u, v, _ = g.sep(g.uv)
    rib = g.math('SINE', g.mul(u, 2400.0))
    weave = g.math('SINE', g.mul(v, 160.0))
    n = g.noise(P, 120.0, 3.0)
    g.p('Base Color', g.mix(g.mul(n, 0.4), g.colmul(STRAP, (0.7, 0.7, 0.7)), (0.02, 0.02, 0.02)))
    g.p('Roughness', 0.78)
    g.p('Specular IOR Level', 0.3)
    g.p('Sheen Weight', 0.18)
    g.p('Sheen Roughness', 0.4)
    g.p('Sheen Tint', (0.3, 0.3, 0.3))
    g.p('Normal', g.bump(g.add(g.mul(rib, 0.5), g.mul(weave, 0.15), g.mul(n, 0.2)), 0.25, 0.0004))
    return m


def badge_card():
    """Blank white ID card with ONE small printed 2x3 green LED-eye glyph (director's note:
    no letters, no second eye). Cells 4.2 mm wide (3.4 mm ink squares), the glyph centred
    across and a little above the middle of a 100 x 72 mm card.

    Needs UVs spanning the card face 0..1 (u left->right seen from the front)."""
    m = _get('badge_card')
    if m:
        return m
    m = _new('badge_card')
    g = Graph(m)
    P = g.coords()
    u, v, _ = g.sep(g.uv)
    pu, pv = 0.042, 0.042 * 100.0 / 72.0
    u0, v0 = 0.5 - 1.0 * pu, 0.56 - 1.5 * pv
    fx = g.math('DIVIDE', g.math('SUBTRACT', u, u0), pu)
    fy = g.math('DIVIDE', g.math('SUBTRACT', v, v0), pv)
    ix, iy = g.math('FLOOR', fx), g.math('FLOOR', fy)
    in_x = g.mul(g.math('GREATER_THAN', ix, -0.5), g.math('LESS_THAN', ix, 1.5))
    in_y = g.mul(g.math('GREATER_THAN', iy, -0.5), g.math('LESS_THAN', iy, 2.5))
    sx = g.math('ABSOLUTE', g.math('SUBTRACT', g.math('FRACT', fx), 0.5))
    sy = g.math('ABSOLUTE', g.math('SUBTRACT', g.math('FRACT', fy), 0.5))
    sq = g.mul(g.remap(sx, 0.415, 0.39), g.remap(sy, 0.415, 0.39))
    ink = g.mul(in_x, in_y, sq)
    n = g.noise(P, 400.0, 3.0)
    smudge = g.remap(g.noise(P, 40.0, 3.0), 0.55, 0.8)
    col = g.mix(g.add(g.mul(n, 0.06), g.mul(smudge, 0.08)), CARD, (0.78, 0.76, 0.72))
    col = g.mix(ink, col, LED_INK)
    g.p('Base Color', col)
    g.p('Roughness', g.mixf(ink, 0.55, 0.38))
    g.p('Normal', g.bump(n, 0.05, 0.0003))
    return m


def clear_vinyl():
    """Clear PVC badge sleeve: a faint milky body, a soft broad sheen (roughness ~0.3, so
    nothing mirrors crisply across the card) and brighter edges (fresnel)."""
    m = _get('clear_vinyl')
    if m:
        return m
    m = _new('clear_vinyl')
    g = Graph(m)
    P = g.coords()
    crinkle = g.noise(P, 18.0, 4.0, 0.6)
    N_ = g.N
    tr = N_.new('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = (0.96, 0.97, 0.97, 1)
    gl = N_.new('ShaderNodeBsdfGlossy')
    g.set_in(gl, 'Roughness', g.add(0.40, g.mul(g.remap(crinkle, 0.4, 0.8), 0.15)))
    nrm = g.bump(crinkle, 0.22, 0.001)                # a soft, slightly wavy sheet: no straight mirror edges
    g.L.new(nrm, gl.inputs['Normal'])
    df = N_.new('ShaderNodeBsdfDiffuse')
    df.inputs['Color'].default_value = (0.85, 0.87, 0.88, 1)
    lw = N_.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.2
    g.L.new(nrm, lw.inputs['Normal'])
    body = N_.new('ShaderNodeMixShader')
    body.inputs['Fac'].default_value = 0.06
    g.L.new(tr.outputs[0], body.inputs[1])
    g.L.new(df.outputs[0], body.inputs[2])
    mix = N_.new('ShaderNodeMixShader')
    g.L.new(g.add(g.mul(lw.outputs['Fresnel'], 0.38), 0.04), mix.inputs['Fac'])
    g.L.new(body.outputs[0], mix.inputs[1])
    g.L.new(gl.outputs[0], mix.inputs[2])
    g.L.new(mix.outputs[0], g.out.inputs['Surface'])
    return m


def frosted_clip():
    """Frosted vinyl strap clip: translucent milky plastic (alpha ~0.6) with bright edges."""
    m = _get('frosted_clip')
    if m:
        return m
    m = _new('frosted_clip')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 600.0, 3.0)
    lw = g.node('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.3
    g.p('Base Color', (0.80, 0.82, 0.83))
    g.p('Roughness', g.add(0.32, g.mul(n, 0.1)))
    g.p('Alpha', g.math('MINIMUM', g.add(0.55, g.mul(lw.outputs['Fresnel'], 0.45)), 1.0))
    g.p('Normal', g.bump(n, 0.05, 0.0002))
    return m


def earcup_face():
    """Matte black earcup shell with fine concentric machining (needs the 'ring_r' point
    attribute: distance from the earcup axis in metres)."""
    m = _get('earcup_face')
    if m:
        return m
    m = _new('earcup_face')
    g = Graph(m)
    P = g.coords()
    rr = g.attr('ring_r')
    rings = g.math('SINE', g.mul(rr, 2 * math.pi / 0.0003))
    n = g.noise(P, 220.0, 3.0)
    g.p('Base Color', BLACK_PLASTIC)
    g.p('Roughness', g.add(0.5, g.mul(n, 0.08)))
    g.p('Specular IOR Level', 0.25)
    g.p('Normal', g.bump(g.add(g.mul(rings, 0.5), g.mul(n, 0.2)), 0.05, 0.0002))
    return m


def chrome_clip():
    m = _get('chrome_clip')
    if m:
        return m
    m = _new('chrome_clip')
    g = Graph(m)
    g.p('Base Color', CLIP)
    g.p('Metallic', 1.0)
    g.p('Roughness', 0.2)
    return m


def flat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    """Plain utility material (studio, debug)."""
    m = _get(name)
    if m:
        return m
    m = _new(name)
    g = Graph(m)
    g.p('Base Color', color)
    g.p('Roughness', rough)
    g.p('Metallic', metal)
    if emit is not None:
        g.p('Emission Color', emit)
        g.p('Emission Strength', strength)
    return m
