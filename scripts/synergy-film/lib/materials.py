"""Procedural Cycles materials for Synergy and his props.

Every public function returns a bpy material and caches it by name, so
calling cream_enamel(0.5) twice gives the same datablock. Everything is
procedural (noise / voronoi / bevel / AO nodes). Texture space is the
object's own coordinates plus a stable per-object random offset, so wear
never swims when a part moves and two plates never share a pattern.

Palette and finish values come from the visual canon (visual_canon.json).
"""

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


CREAM = srgb('#E3D2B4')
CREAM_WARM = srgb('#CDB28B')
STEEL_BARE = srgb('#B4B0A8')
GALV = srgb('#8C877F')
RIVET = srgb('#7A746C')
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
FOAM = srgb('#1A1A1A')
BRASS = srgb('#7A6247')
STRAP = srgb('#1C1C1B')
CLIP = srgb('#C8C8C8')
CARD = srgb('#F4F2EE')
CUP = srgb('#F2F0EB')
LID = srgb('#F7F5F1')
BAND = srgb('#121212')
BLUE_CHIP = srgb('#1F5FA8')
LED_INK = srgb('#2BB357')


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
        bv = self.node('ShaderNodeBevel', samples=4)
        self._set(bv.inputs['Radius'], radius)
        g = self.geometry()
        d = self.vmath('DOT_PRODUCT', bv.outputs['Normal'], g.outputs['Normal'])
        return self.remap(self.math('SUBTRACT', 1.0, d), lo, hi)

    def crevice_mask(self, distance=0.015, lo=0.97, hi=0.55, samples=4):
        """1 in seams and around rivets (ambient occlusion)."""
        ao = self.node('ShaderNodeAmbientOcclusion', samples=samples, only_local=False, inside=False)
        self._set(ao.inputs['Distance'], distance)
        return self.remap(ao.outputs['AO'], lo, hi)

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


def cream_enamel(wear=0.5):
    """Ivory enamel on riveted steel: yellowed patina, edge chips to bare steel,
    rust freckles with orange halos, rust bleed streaks, grime in the seams."""
    wear = max(0.0, min(1.0, float(wear)))
    name = f'cream_enamel_w{int(round(wear * 100)):03d}'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    g = Graph(m)
    P = g.coords()
    _, _, oz = g.sep(g.obj)
    edge = g.edge_mask(0.005, 0.004, 0.10)
    edge_hard = g.remap(edge, 0.45, 1.0)
    crev = g.crevice_mask(0.016)
    lower = g.remap(oz, 0.02, -0.07)
    n_big = g.noise(P, 3.0, 2.0, 0.5)
    n_mid = g.noise(P, 14.0, 5.0, 0.6)
    n_fine = g.noise(P, 70.0, 5.0, 0.65)
    n_chip = g.noise(P, 48.0, 8.0, 0.7, distortion=0.25)
    patina = g.remap(n_big, 0.32, 0.78)
    # edge chips to bare steel
    chip_f = g.add(g.mul(edge, 1.25), g.mul(g.math('SUBTRACT', n_chip, 0.5), 1.5),
                   g.mul(g.math('SUBTRACT', n_big, 0.5), 0.5), (wear - 0.5) * 0.55)
    chip = g.remap(chip_f, 0.60, 0.655)
    ding = g.mul(g.remap(g.noise(P, 110.0, 3.0, 0.5), 0.705, 0.725), g.remap(n_mid, 0.4, 0.75), wear)
    chip = g.maxf(chip, ding)
    # rust freckles + orange halos
    vd, vc = g.voronoi(P, 190.0)
    cell = g.red(vc)
    cluster = g.remap(g.noise(P, 9.0, 3.0, 0.6), 0.5, 0.75)
    dens = g.mul(g.add(0.015, g.mul(edge, 0.75), g.mul(crev, 1.0), g.mul(lower, 0.22),
                       g.mul(cluster, 0.35)), wear * 1.25)
    pick = g.remap(g.math('SUBTRACT', cell, dens), 0.03, -0.03)
    size = g.add(0.15, g.mul(cell, 0.3))
    freckle = g.mul(pick, g.remap(g.math('SUBTRACT', vd, size), 0.05, -0.05))
    halo = g.mul(pick, g.remap(g.math('SUBTRACT', vd, g.mul(size, 1.9)), 0.14, -0.04), 0.4)
    # rust bleed streaks: vertically stretched noise under seams and lower edges
    Ps = g.vmath('MULTIPLY', P, (85.0, 85.0, 4.5))
    n_streak = g.noise(Ps, 1.0, 3.0, 0.55)
    gate = g.remap(g.noise(P, 6.0, 2.0), 0.45, 0.72)
    streak = g.mul(g.remap(n_streak, 0.52, 0.70), gate,
                   g.add(g.mul(crev, 0.9), g.mul(lower, 0.6), g.mul(edge, 0.4), 0.2), wear * 1.25)
    streak = g.math('MINIMUM', streak, 1.0)
    chip_rust = g.mul(chip, g.add(g.mul(lower, 0.8), 0.25), g.remap(n_mid, 0.4, 0.6))
    rust = g.math('MINIMUM', g.maxf(freckle, halo, g.mul(streak, 0.7), chip_rust), 1.0)
    # fine scratches (bare metal glints)
    Pk = g.vmath('MULTIPLY', P, (650.0, 20.0, 20.0))
    scratch = g.mul(g.remap(g.noise(Pk, 1.0, 2.0), 0.69, 0.73), g.remap(n_big, 0.3, 0.7), wear)
    grime = g.math('MINIMUM', g.add(g.mul(crev, 0.75), g.mul(edge_hard, 0.4), g.mul(streak, 0.3),
                                    g.mul(patina, 0.12), g.mul(lower, 0.12 * wear)), 0.92)
    # colour
    base = g.mix(patina, CREAM, CREAM_WARM)
    base = g.mix(g.remap(n_mid, 0.2, 0.8), g.colmul(base, (0.9, 0.88, 0.84)), base)
    base = g.mix(g.mul(g.remap(n_fine, 0.58, 0.78), 0.35), base, srgb('#9C8463'))
    base = g.mix(g.mul(scratch, 0.45), base, (0.62, 0.60, 0.56))
    base = g.mix(grime, base, GRIME)
    steel = g.mix(g.remap(n_mid, 0.3, 0.7), STEEL_BARE, (0.24, 0.23, 0.21))
    col = g.mix(chip, base, steel)
    col = g.mix(rust, col, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(chip, g.math('SUBTRACT', 1.0, rust), 0.9))
    rough = g.add(0.40, g.mul(n_mid, 0.16), g.mul(grime, 0.15), g.mul(patina, 0.06))
    rough = g.mixf(chip, rough, 0.36)
    rough = g.mixf(rust, rough, 0.88)
    g.p('Roughness', rough)
    g.p('Coat Weight', g.mul(g.math('SUBTRACT', 1.0, g.maxf(chip, rust, grime)), 0.12))
    g.p('Coat Roughness', 0.25)
    h = g.add(g.mul(chip, -0.55), g.mul(n_big, 0.4), g.mul(freckle, 0.3), g.mul(scratch, -0.15),
              g.mul(g.noise(P, 380.0, 2.0), 0.06), g.mul(n_fine, 0.05))
    g.p('Normal', g.bump(h, 0.34, 0.0009))
    return m


def galvanized_grey(wear=0.4):
    """Bare galvanized steel panel: spangle crystals, faint brushing, grime, light rust."""
    name = f'galvanized_grey_w{int(round(wear * 100)):03d}'
    m = _get(name)
    if m:
        return m
    m = _new(name)
    g = Graph(m)
    P = g.coords()
    _, _, oz = g.sep(g.obj)
    edge = g.edge_mask(0.004)
    crev = g.crevice_mask(0.016)
    lower = g.remap(oz, 0.02, -0.07)
    vd, vc = g.voronoi(P, 26.0, rand=0.9)
    spang = g.red(vc)
    n_big = g.noise(P, 4.0, 2.0)
    n_mid = g.noise(P, 14.0, 4.0, 0.6)
    Pb = g.vmath('MULTIPLY', P, (380.0, 380.0, 7.0))
    brush = g.noise(Pb, 1.0, 2.0, 0.5)
    base = g.mix(spang, g.colmul(GALV, (0.80, 0.80, 0.80)), g.colmul(GALV, (1.08, 1.07, 1.05)))
    base = g.mix(g.mul(g.remap(n_mid, 0.35, 0.8), 0.6), base, (0.13, 0.12, 0.105))
    base = g.mix(g.mul(edge, 0.45), base, STEEL_BARE)
    base = g.mix(g.math('MINIMUM', g.add(g.mul(crev, 0.75), g.mul(g.remap(n_big, 0.5, 0.9), 0.25)), 0.85),
                 base, GRIME)
    vd2, vc2 = g.voronoi(P, 180.0)
    dens = g.mul(g.add(0.05, g.mul(crev, 0.6), g.mul(lower, 0.3), g.mul(edge, 0.35)), wear * 1.2)
    fr = g.mul(g.remap(g.math('SUBTRACT', g.red(vc2), dens), 0.03, -0.03),
               g.remap(g.math('SUBTRACT', vd2, 0.3), 0.05, -0.05))
    Ps = g.vmath('MULTIPLY', P, (85.0, 85.0, 4.5))
    streak = g.mul(g.remap(g.noise(Ps, 1.0, 3.0), 0.55, 0.72), g.remap(g.noise(P, 6.0, 2.0), 0.5, 0.75),
                   g.add(crev, g.mul(lower, 0.5), 0.2), wear)
    rust = g.math('MINIMUM', g.maxf(fr, g.mul(streak, 0.6)), 1.0)
    col = g.mix(rust, base, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(g.math('SUBTRACT', 1.0, rust), 0.78))
    rough = g.add(0.40, g.mul(spang, 0.14), g.mul(brush, 0.08), g.mul(crev, 0.15), g.mul(n_mid, 0.08))
    g.p('Roughness', g.mixf(rust, rough, 0.85))
    h = g.add(g.mul(brush, 0.15), g.mul(n_big, 0.45), g.mul(spang, 0.05), g.mul(fr, 0.2))
    g.p('Normal', g.bump(h, 0.25, 0.0008))
    return m


def blue_chip():
    """Flaked cobalt enamel patch with scratched, ragged edges (decal on a plate)."""
    m = _get('blue_chip')
    if m:
        return m
    m = _new('blue_chip')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 90.0, 6.0, 0.7)
    n2 = g.noise(P, 30.0, 3.0)
    Pk = g.vmath('MULTIPLY', P, (500.0, 18.0, 18.0))
    scr = g.remap(g.noise(Pk, 1.0, 2.0), 0.68, 0.72)
    col = g.mix(g.remap(n2, 0.3, 0.7), BLUE_CHIP, srgb('#1A5F94'))
    col = g.mix(g.mul(scr, 0.7), col, CREAM)
    col = g.mix(g.mul(g.remap(n, 0.68, 0.74), 0.8), col, STEEL_BARE)
    g.p('Base Color', col)
    g.p('Roughness', g.add(0.32, g.mul(n, 0.2)))
    g.p('Coat Weight', 0.2)
    g.p('Normal', g.bump(g.add(g.mul(n, 0.5), g.mul(scr, -0.3)), 0.3, 0.0006))
    return m


# ------------------------------------------------------------------ metals


def chrome():
    m = _get('chrome')
    if m:
        return m
    m = _new('chrome')
    g = Graph(m)
    P = g.coords()
    crev = g.crevice_mask(0.01, 0.97, 0.6)
    n = g.noise(P, 40.0, 4.0, 0.6)
    smudge = g.remap(g.noise(P, 9.0, 3.0), 0.5, 0.8)
    g.p('Base Color', g.mix(g.mul(crev, 0.7), CHROME, GRIME))
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(0.12, g.mul(smudge, 0.12), g.mul(n, 0.04), g.mul(crev, 0.2)))
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
    g = Graph(m)
    P = g.coords()
    base_c = GUN_PLATE if tone == 'plate' else GUN_INNER
    edge = g.edge_mask(0.003)
    crev = g.crevice_mask(0.012, 0.97, 0.6)
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
    g = Graph(m)
    P = g.coords()
    c = BRONZE if tone == 'disc' else BRONZE_TIP
    n = g.noise(P, 60.0, 5.0, 0.6)
    crev = g.crevice_mask(0.008, 0.97, 0.6)
    col = g.mix(g.remap(n, 0.35, 0.7), g.colmul(c, (0.55, 0.55, 0.5)), c)
    col = g.mix(g.mul(crev, 0.6), col, (0.02, 0.016, 0.01))
    g.p('Base Color', col)
    g.p('Metallic', 0.95)
    g.p('Roughness', g.add(0.3, g.mul(n, 0.25)))
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
    g.p('Base Color', g.mix(g.remap(n, 0.3, 0.7), g.colmul(BRASS, (0.7, 0.7, 0.7)), g.colmul(BRASS, (1.6, 1.5, 1.3))))
    g.p('Metallic', 1.0)
    g.p('Roughness', g.add(0.25, g.mul(n, 0.2)))
    return m


def rivet_steel():
    """Dull steel dome rivets; many carry rust rings and rusty heads."""
    m = _get('rivet_steel')
    if m:
        return m
    m = _new('rivet_steel')
    g = Graph(m)
    P = g.coords()
    crev = g.crevice_mask(0.006, 0.97, 0.7)
    n = g.noise(P, 120.0, 4.0, 0.6)
    pick = g.remap(g.noise(P, 26.0, 2.0), 0.38, 0.58)
    rust = g.math('MINIMUM', g.add(g.mul(crev, pick, 1.3), g.mul(g.remap(n, 0.55, 0.68), pick)), 1.0)
    col = g.mix(g.remap(n, 0.3, 0.7), g.colmul(RIVET, (0.6, 0.58, 0.55)), RIVET)
    col = g.mix(rust, col, _rust_color(g, P))
    g.p('Base Color', col)
    g.p('Metallic', g.mul(g.math('SUBTRACT', 1.0, rust), 0.8))
    g.p('Roughness', g.mixf(rust, g.add(0.42, g.mul(n, 0.2)), 0.85))
    g.p('Normal', g.bump(g.add(g.mul(n, 0.4), g.mul(rust, 0.4)), 0.2, 0.0003))
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
    g.p('Roughness', g.add(0.22 if gloss else 0.42, g.mul(n, 0.08)))
    g.p('Specular IOR Level', 0.5)
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
    g.p('Sheen Weight', 0.3)
    g.p('Sheen Roughness', 0.5)
    g.p('Sheen Tint', (0.25, 0.25, 0.25))
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
    m = _get('cup_lid')
    if m:
        return m
    m = _new('cup_lid')
    g = Graph(m)
    P = g.coords()
    n = g.noise(P, 200.0, 3.0)
    g.p('Base Color', LID)
    g.p('Roughness', g.add(0.3, g.mul(n, 0.06)))
    g.p('Subsurface Weight', 0.06)
    g.p('Subsurface Radius', (0.8, 0.8, 0.7))
    g.p('Subsurface Scale', 0.003)
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
    """Blank white ID card with a tiny printed 2x3 green LED-eye glyph (no letters).

    Needs UVs spanning the card face 0..1 (u left->right seen from the front)."""
    m = _get('badge_card')
    if m:
        return m
    m = _new('badge_card')
    g = Graph(m)
    P = g.coords()
    u, v, _ = g.sep(g.uv)
    # 7 x 3 cell grid: eye columns 0-1 and 5-6, rows 0-2; cells 4.2 mm wide on a 100 x 72 mm card
    pu, pv = 0.042, 0.042 * 100.0 / 72.0
    u0, v0 = 0.5 - 3.5 * pu, 0.47 - 1.5 * pv
    fx = g.math('DIVIDE', g.math('SUBTRACT', u, u0), pu)
    fy = g.math('DIVIDE', g.math('SUBTRACT', v, v0), pv)
    ix, iy = g.math('FLOOR', fx), g.math('FLOOR', fy)
    eye1 = g.mul(g.math('GREATER_THAN', ix, -0.5), g.math('LESS_THAN', ix, 1.5))
    eye2 = g.mul(g.math('GREATER_THAN', ix, 4.5), g.math('LESS_THAN', ix, 6.5))
    in_x = g.maxf(eye1, eye2)
    in_y = g.mul(g.math('GREATER_THAN', iy, -0.5), g.math('LESS_THAN', iy, 2.5))
    sx = g.math('ABSOLUTE', g.math('SUBTRACT', g.math('FRACT', fx), 0.5))
    sy = g.math('ABSOLUTE', g.math('SUBTRACT', g.math('FRACT', fy), 0.5))
    sq = g.mul(g.remap(sx, 0.40, 0.37), g.remap(sy, 0.40, 0.37))
    ink = g.mul(in_x, in_y, sq)
    n = g.noise(P, 400.0, 3.0)
    col = g.mix(g.mul(n, 0.08), CARD, (0.8, 0.79, 0.76))
    col = g.mix(ink, col, LED_INK)
    g.p('Base Color', col)
    g.p('Roughness', g.mixf(ink, 0.55, 0.35))
    g.p('Normal', g.bump(n, 0.05, 0.0003))
    return m


def clear_vinyl():
    """Thin clear PVC sleeve: transparent with a fresnel gloss (light passes to the card)."""
    m = _get('clear_vinyl')
    if m:
        return m
    m = _new('clear_vinyl')
    g = Graph(m)
    P = g.coords()
    crinkle = g.noise(P, 40.0, 4.0, 0.6)
    N_ = g.N
    tr = N_.new('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = (0.97, 0.98, 0.98, 1)
    gl = N_.new('ShaderNodeBsdfGlossy')
    g.set_in(gl, 'Roughness', g.add(0.04, g.mul(g.remap(crinkle, 0.4, 0.8), 0.1)))
    nrm = g.bump(crinkle, 0.05, 0.001)
    g.L.new(nrm, gl.inputs['Normal'])
    lw = N_.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.12
    g.L.new(nrm, lw.inputs['Normal'])
    mix = N_.new('ShaderNodeMixShader')
    g.L.new(g.add(g.mul(lw.outputs['Fresnel'], 0.85), 0.04), mix.inputs['Fac'])
    g.L.new(tr.outputs[0], mix.inputs[1])
    g.L.new(gl.outputs[0], mix.inputs[2])
    g.L.new(mix.outputs[0], g.out.inputs['Surface'])
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
