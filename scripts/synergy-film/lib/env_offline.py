"""E1_OFFLINE: the world inside Synergy's coffee cup, built at x9,000 scale.

The cup is the hero lidded paper cup (bottom r 0.03 m, top r 0.045 m, height
0.115 m) scaled by 9,000 and filled with espresso to 40% of its height. World
units are metres, Z up, the cup axis is the world Z axis and the espresso sea
is z = 0. Everything a shot needs to place a camera is in OFFLINE.

    import env_offline as E
    h = E.build_offline('day', include={'cup', 'lid', 'sea', 'arch'}, frames=(529, 608))
    E.animate_hero_padlock(h, 529, 553, 566, 578)
    C.compositor(**E.look('day'))

build_offline() returns a Handles dict: every built object, material control
and light is reachable by name so shot scripts can animate it. Parts are
opt-in through `include` so a shot only pays for what it sees.

Lighting model (cheap, clean and physically motivated):
  * the slot is a real hole in the lid (a shader mask: transparent for camera
    and shadow rays), so the SUN lamp aimed down the shaft only lands where a
    real sunbeam through a sip hole would: a slot-shaped pool on the island;
  * the paper wall and the lid are translucent; large area lights outside them
    (warm 3200K ring, a neutral top light and the attendee colour blooms) glow
    through the paper for camera rays and, via shadow linking that ignores the
    cup, light the interior directly, so the world is lit by its own walls;
  * aerial haze is the compositor mist pass (look()), never a volume.

Crowds (paper falls, murmuration, fireflies) are simulated in numpy and played
back from PC2 point caches (cache.py), so they are deterministic, need no
frame-change handlers and support motion blur.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cache as PC  # noqa: E402
import common as C  # noqa: E402

# ================================================================== constants

SCALE = 9000.0
CUP_H = 0.115 * SCALE                 # 1035 m
CUP_R_BOTTOM = 0.030 * SCALE          # 270 m
CUP_R_TOP = 0.045 * SCALE             # 405 m
FILL = 0.40
Z_BOTTOM = -FILL * CUP_H              # -414 m: the cup floor, under the sea
Z_RIM = CUP_H + Z_BOTTOM              # 621 m: the rolled rim, above the sea
TAPER = (CUP_R_TOP - CUP_R_BOTTOM) / CUP_H


def cup_radius(z):
    """Inner wall radius (m) at height z (m above the sea)."""
    return CUP_R_BOTTOM + TAPER * (np.asarray(z, dtype=float) - Z_BOTTOM)


R_SEA = float(cup_radius(0.0))        # 324 m


def _pol(az_deg, r, z=0.0):
    a = math.radians(az_deg)
    return Vector((r * math.cos(a), r * math.sin(a), z))


def lid_z(r):
    """Height of the lid's underside at radius r (vectorised).

    From the rim inward: the plug ring that seals inside the wall, the raised
    sipping ring (from inside a high vaulted channel), its inner slope (where
    the slot is cut), a shallow valley, then the central dome rising to ~80 m
    above the rim, embossed with concentric rings.
    """
    r = np.asarray(r, dtype=float)
    z = np.empty_like(r)
    # central dome, gently rounded, 702 m at the axis
    dome = Z_RIM + 81.0 - 34.0 * (r / 300.0) ** 2.2
    # embossed concentric ribs on the dome (rounded, 3.2 m deep, every 26 m)
    rib_phase = np.clip((292.0 - r) / 26.0, 0, None)
    ribs = 3.2 * np.clip(np.sin(np.pi * np.clip(rib_phase, 0, 10.8)) ** 3, 0, None)
    ribs *= np.clip((r - 22.0) / 18.0, 0, 1)
    dome = dome + ribs          # thermoformed: embossed outside = grooves up inside
    # valley at r~296, then the inner slope of the sipping ring (34 deg)
    valley_z = Z_RIM + 32.0
    t = np.clip((r - 296.0) / 64.0, 0, 1)
    slope = valley_z + 56.0 * (t * t * (3 - 2 * t))         # up to 709 m at r 360
    t2 = np.clip((r - 360.0) / 34.0, 0, 1)
    channel = (valley_z + 56.0) - 6.0 * np.sin(np.pi * 0.5 * t2) - 88.0 * t2 ** 3   # down the plug
    w_dome = np.clip((300.0 - r) / 18.0, 0, 1)
    w_dome = w_dome * w_dome * (3 - 2 * w_dome)
    z = np.where(r < 300.0, w_dome * dome + (1 - w_dome) * slope, np.where(r < 360.0, slope, channel))
    return z


# Layout (plan, metres). The arch stands between the S01 camera and the slot so
# the slot hangs 'directly above the arch' from the glide and sits inside the
# arch's opening from the S06 worm's-eye; the island is near the centre in the
# shaft; atoll, falls, terraces spread across the north half for the S08 poster.
_SLOT_AZ = 130.0
_SLOT_R = 327.0
SLOT_C = _pol(_SLOT_AZ, _SLOT_R, float(lid_z(_SLOT_R)))
ARCH_C = Vector((-130.0, 40.0, 0.0))
_u = (ARCH_C - SLOT_C).to_2d().normalized()
CAM_S01 = Vector((ARCH_C.x + 236.0 * _u.x, ARCH_C.y + 236.0 * _u.y, 1.5))    # glide end (f128)
CAM_S06 = Vector((ARCH_C.x + 34.0 * _u.x, ARCH_C.y + 34.0 * _u.y, 2.0))
SLOT_N = (CAM_S01 - SLOT_C).normalized()           # into the cup, toward the S01 camera
_slot_x = Vector((-_u.y, _u.x, 0.0)).normalized()  # long axis: horizontal, square to the S01 view
if _slot_x.dot(Vector((1, 0, 0))) < 0:
    _slot_x = -_slot_x
ISLAND_C = Vector((55.0, 45.0, 0.0))
ATOLL_C = Vector((-52.0, 168.0, 0.0))
TERRACE_C = Vector((205.0, 22.0, 0.0))
FALLS_AZ = 68.0
FALLS_Z = Z_RIM * 2.0 / 3.0                        # ledge two-thirds up the cliff
SEAM_AZ = 152.0

ATTENDEES = {
    # name: (hex, wall azimuth deg, height m) for the exterior colour blooms
    'synthia': ('#fbf6e8', 38.0, 300.0),
    'keys': ('#0757ec', 72.0, 250.0),
    'kevin': ('#b8d7fb', 165.0, 320.0),
    'operations': ('#ff814f', 12.0, 210.0),
    'pat': ('#8a8a8a', 188.0, 170.0),
    'arjun': ('#e5ff8d', 228.0, 300.0),
    'strategy': ('#fff349', 112.0, 330.0),
    'people': ('#ffb9dc', 140.0, 200.0),
    'linda': ('#8a2433', 258.0, 260.0),
}

OFFLINE = {
    'scale': SCALE,
    'sea_level': 0.0,
    'cup_bottom_z': Z_BOTTOM,
    'rim_z': Z_RIM,
    'lid_apex_z': float(lid_z(0.0)),
    'cup_radius_by_height': {int(z): round(float(cup_radius(z)), 2) for z in (-100, 0, 100, 200, 300, 400, 500, 621)},
    'cup_radius_fn': 'cup_radius(z) = 324 + 0.13043 * z',
    'slot_center': tuple(SLOT_C),
    'slot_normal': tuple(SLOT_N),            # unit, pointing into the cup
    'slot_long_axis': tuple(_slot_x),
    'slot_size': (135.0, 45.0),
    'shaft_dir': None,                       # filled below: unit vector slot -> island
    'island_center': tuple(ISLAND_C),
    'box_center': None,                      # filled below
    'box_size': (30.0, 6.0, 5.0),
    'arch_base': tuple(ARCH_C),
    'arch_crest': None,                      # filled below
    'arch_height': 131.0,
    'atoll_center': tuple(ATOLL_C),
    'atoll_radius': 66.0,
    'terraces_center': tuple(TERRACE_C),
    'terrace_levels': 7,
    'falls_ledge': tuple(_pol(FALLS_AZ, float(cup_radius(FALLS_Z)) - 22.0, FALLS_Z)),
    'falls_base': tuple(_pol(FALLS_AZ, R_SEA - 30.0, 0.0)),
    'seam_azimuth': SEAM_AZ,
    'cam_s01_end': tuple(CAM_S01),
    'cam_s06': tuple(CAM_S06),
    'camera_clip': (0.1, 6000.0),
    'attendees': {k: v for k, v in ATTENDEES.items()},
}

_BOX_Z = 7.0
BOX_C = Vector((ISLAND_C.x, ISLAND_C.y, _BOX_Z + 2.5))
SHAFT_DIR = (Vector((ISLAND_C.x, ISLAND_C.y, _BOX_Z + 5.0)) - SLOT_C).normalized()
OFFLINE['shaft_dir'] = tuple(SHAFT_DIR)
OFFLINE['box_center'] = tuple(BOX_C)

# Kuramoto clock for the fireflies: unison flashes every beat from f1217.
FIREFLY_T0 = 1217
FIREFLY_PERIOD = 16

CACHE_DIR = os.environ.get('SYNERGY_CACHE', os.path.join(C.ROOT, 'out', 'cache', 'offline'))


# ================================================================== colour

def srgb(hexstr):
    """'#2a160b' -> linear RGB tuple."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def kelvin(k):
    """Blackbody colour temperature -> linear RGB, normalised to max 1."""
    t = k / 100.0
    if t <= 66:
        r = 255.0
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * (t - 60) ** -0.1332047592
        g = 288.1221695283 * (t - 60) ** -0.0755148492
        b = 255.0
    rgb = [min(255.0, max(0.0, x)) / 255.0 for x in (r, g, b)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    m = max(lin)
    return tuple(c / m for c in lin)


ESPRESSO = srgb('#2a160b')
AMBER = srgb('#6e4524')
CREMA = srgb('#b39272')
CREMA_LIGHT = srgb('#e2d2bb')
PAPER = srgb('#f2efe6')
LID_WHITE = srgb('#f7f5f1')
VERDIGRIS = srgb('#43a08a')
LICHEN = srgb('#e5ff8d')
FROST = srgb('#c9cec9')
DEEP_GREEN = srgb('#17372e')
LIME = srgb('#e5ff8d')
SAND = srgb('#efe6d2')
CARAMEL = srgb('#c47a2c')
BRASS = srgb('#b8913f')
PATINA = srgb('#5a3b22')
STONE = srgb('#6f6a62')
CHARCOAL = srgb('#1a1b1e')
COBALT = srgb('#0757ec')


# ================================================================== numpy noise

_TABLES = {}


def _table(seed, dims):
    """Random lattice values in [0,1] (256^2 for 2D, 64^3 for 3D), cached per seed."""
    key = (seed, dims)
    if key not in _TABLES:
        rng = np.random.default_rng(1000003 * seed + dims)
        _TABLES[key] = rng.random((256, 256) if dims == 2 else (64, 64, 64))
    return _TABLES[key]


def vnoise2(x, y, seed=0):
    """Smooth value noise in [-1, 1] on arrays x, y (unit cell, period 256 cells)."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    fx0, fy0 = np.floor(x), np.floor(y)
    ix, iy = fx0.astype(np.int64) & 255, fy0.astype(np.int64) & 255
    fx, fy = x - fx0, y - fy0
    ux, uy = fx * fx * fx * (fx * (fx * 6 - 15) + 10), fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    T = _table(seed, 2)
    ix1, iy1 = (ix + 1) & 255, (iy + 1) & 255
    a, b, c, d = T[ix, iy], T[ix1, iy], T[ix, iy1], T[ix1, iy1]
    return 2.0 * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) - 1.0


def vnoise3(x, y, z, seed=0):
    x, y, z = (np.asarray(v, dtype=np.float64) for v in (x, y, z))
    f0 = [np.floor(v) for v in (x, y, z)]
    i0 = [f.astype(np.int64) & 63 for f in f0]
    fr = [v - f for v, f in zip((x, y, z), f0)]
    u = [f * f * f * (f * (f * 6 - 15) + 10) for f in fr]
    T = _table(seed, 3)
    acc = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[0] if dx else 1 - u[0]) * (u[1] if dy else 1 - u[1]) * (u[2] if dz else 1 - u[2])
                acc = acc + w * T[(i0[0] + dx) & 63, (i0[1] + dy) & 63, (i0[2] + dz) & 63]
    return 2.0 * acc - 1.0


def fbm2(x, y, octaves=4, seed=0, lac=2.03, gain=0.5):
    amp, freq, tot, norm = 1.0, 1.0, 0.0, 0.0
    for o in range(octaves):
        tot = tot + amp * vnoise2(x * freq, y * freq, seed + 31 * o)
        norm += amp
        amp *= gain
        freq *= lac
    return tot / norm


def fbm3(x, y, z, octaves=3, seed=0, lac=2.03, gain=0.5):
    amp, freq, tot, norm = 1.0, 1.0, 0.0, 0.0
    for o in range(octaves):
        tot = tot + amp * vnoise3(x * freq, y * freq, z * freq, seed + 31 * o)
        norm += amp
        amp *= gain
        freq *= lac
    return tot / norm


def blur2(img, sigma_px):
    """Gaussian blur of a 2D array via FFT (periodic edges, keep borders padded)."""
    h, w = img.shape
    ky = np.fft.fftfreq(h)[:, None]
    kx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2.0 * (np.pi ** 2) * (sigma_px ** 2) * (kx * kx + ky * ky))
    return np.real(np.fft.ifft2(np.fft.fft2(img) * g))


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ================================================================== mesh helpers

def np_mesh(name, verts, faces, coll=None, mat=None, smooth=True, uv=None, mat_index=None):
    """Build a mesh object from numpy arrays.

    verts (V,3); faces (F,k) int array (all faces k-gons) or a list of such arrays.
    uv: optional (F*k, 2) per-loop UVs. mat: material or list of materials.
    """
    verts = np.asarray(verts, dtype=np.float32).reshape(-1, 3)
    groups = faces if isinstance(faces, (list, tuple)) else [faces]
    groups = [np.asarray(g, dtype=np.int32) for g in groups if len(g)]
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set('co', verts.ravel())
    if groups:
        loops = np.concatenate([g.ravel() for g in groups])
        totals = np.concatenate([np.full(len(g), g.shape[1], np.int32) for g in groups])
        starts = np.concatenate([[0], np.cumsum(totals)[:-1]]).astype(np.int32)
        me.loops.add(len(loops))
        me.loops.foreach_set('vertex_index', loops)
        me.polygons.add(len(totals))
        me.polygons.foreach_set('loop_start', starts)
        me.polygons.foreach_set('loop_total', totals)
        if uv is not None:
            layer = me.uv_layers.new(name='UVMap')
            layer.data.foreach_set('uv', np.asarray(uv, dtype=np.float32).ravel())
        if mat_index is not None:
            me.polygons.foreach_set('material_index', np.asarray(mat_index, dtype=np.int32))
    me.update(calc_edges=True)
    if groups and smooth:
        me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), dtype=bool))
    obj = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(obj)
    for m in (mat if isinstance(mat, (list, tuple)) else [mat]):
        if m is not None:
            me.materials.append(m)
    return obj


def grid_faces(nu, nv, wrap_u=False):
    """Quad indices for an nu x nv vertex grid (u fastest). wrap_u closes the u seam."""
    cu = nu if wrap_u else nu - 1
    i = np.arange(cu)
    j = np.arange(nv - 1)
    I, J = np.meshgrid(i, j)
    a = J * nu + I
    b = J * nu + (I + 1) % nu
    c = (J + 1) * nu + (I + 1) % nu
    d = (J + 1) * nu + I
    return np.stack([a, b, c, d], axis=-1).reshape(-1, 4)


def heightfield(name, cx, cy, half_w, half_h, step, fn, coll=None, mat=None):
    """Grid mesh over [cx-hw, cx+hw] x [cy-hh, cy+hh]; z = fn(X, Y) in world metres."""
    xs = np.arange(-half_w, half_w + 1e-6, step) + cx
    ys = np.arange(-half_h, half_h + 1e-6, step) + cy
    X, Y = np.meshgrid(xs, ys)
    Z = fn(X, Y)
    verts = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)
    obj = np_mesh(name, verts, grid_faces(len(xs), len(ys)), coll=coll, mat=mat)
    return obj, X, Y, Z


def tube_along(points, radii, sides=24, name='Tube', coll=None, mat=None, cap=True, disp=None):
    """Swept circle along a polyline (N,3) with per-point radii; optional disp(P, N) -> offsets."""
    P = np.asarray(points, dtype=float)
    n = len(P)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.array([0.0, 1.0, 0.0])
    N1 = np.cross(T, ref)
    bad = np.linalg.norm(N1, axis=1) < 1e-4
    N1[bad] = np.cross(T[bad], [1.0, 0.0, 0.0])
    N1 /= np.linalg.norm(N1, axis=1, keepdims=True)
    N2 = np.cross(T, N1)
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = np.cos(ang)[None, :, None] * N1[:, None, :] + np.sin(ang)[None, :, None] * N2[:, None, :]
    V = P[:, None, :] + ring * np.asarray(radii, dtype=float)[:, None, None]
    if disp is not None:
        V = V + disp(V, ring)
    V = V.reshape(-1, 3)
    faces = [grid_faces(sides, n, wrap_u=True)]
    if cap:
        c0 = len(V)
        V = np.vstack([V, P[0], P[-1]])
        k = np.arange(sides)
        faces.append(np.stack([np.full(sides, c0), (k + 1) % sides, k], axis=-1))
        faces.append(np.stack([np.full(sides, c0 + 1), (n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides], axis=-1))
    return np_mesh(name, V, faces, coll=coll, mat=mat)


def set_attr(me, name, values, kind='FLOAT', domain='POINT'):
    """Write a numpy array as a mesh attribute."""
    a = me.attributes.get(name) or me.attributes.new(name, kind, domain)
    key = {'FLOAT': 'value', 'INT': 'value', 'FLOAT_VECTOR': 'vector', 'FLOAT_COLOR': 'color',
           'BYTE_COLOR': 'color', 'BOOLEAN': 'value'}[kind]
    dt = np.int32 if kind == 'INT' else (bool if kind == 'BOOLEAN' else np.float32)
    a.data.foreach_set(key, np.asarray(values, dtype=dt).ravel())
    return a


def hide_from(obj, camera=True, diffuse=True, glossy=True, transmission=True, shadow=True, scatter=True):
    """Ray visibility switches (True = visible to that ray type)."""
    obj.visible_camera = camera
    obj.visible_diffuse = diffuse
    obj.visible_glossy = glossy
    obj.visible_transmission = transmission
    obj.visible_shadow = shadow
    obj.visible_volume_scatter = scatter
    return obj


def parent_keep(child, parent):
    """Parent without moving the child."""
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    child.matrix_world = mw
    return child


def rot_matrices_euler(rx, ry, rz):
    """(n,) Euler XYZ angles -> (n,3,3) rotation matrices (Blender convention)."""
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    n = len(rx)
    Rx = np.zeros((n, 3, 3)); Rx[:, 0, 0] = 1; Rx[:, 1, 1] = cx; Rx[:, 1, 2] = -sx; Rx[:, 2, 1] = sx; Rx[:, 2, 2] = cx
    Ry = np.zeros((n, 3, 3)); Ry[:, 1, 1] = 1; Ry[:, 0, 0] = cy; Ry[:, 0, 2] = sy; Ry[:, 2, 0] = -sy; Ry[:, 2, 2] = cy
    Rz = np.zeros((n, 3, 3)); Rz[:, 2, 2] = 1; Rz[:, 0, 0] = cz; Rz[:, 0, 1] = -sz; Rz[:, 1, 0] = sz; Rz[:, 1, 1] = cz
    return Rz @ Ry @ Rx


def matrices_to_euler(R):
    """(n,3,3) -> (n,3) Euler XYZ (Blender convention), for GN instance rotations."""
    sy = -R[:, 2, 0]
    ry = np.arcsin(np.clip(sy, -1, 1))
    rx = np.arctan2(R[:, 2, 1], R[:, 2, 2])
    rz = np.arctan2(R[:, 1, 0], R[:, 0, 0])
    return np.stack([rx, ry, rz], axis=1)


def frame_from(z_axis, y_hint):
    """(n,3) local-Z directions and (n,3) hints for local-Y -> (n,3,3) rotation matrices."""
    z = np.asarray(z_axis, dtype=float)
    z = z / np.linalg.norm(z, axis=1, keepdims=True)
    y = np.asarray(y_hint, dtype=float)
    x = np.cross(y, z)
    bad = np.linalg.norm(x, axis=1) < 1e-6
    x[bad] = np.cross([0.0, 0.0, 1.0], z[bad]) + np.array([1e-3, 0, 0])
    x /= np.linalg.norm(x, axis=1, keepdims=True)
    y = np.cross(z, x)
    return np.stack([x, y, z], axis=2)


# ================================================================== shader graph helper

class G:
    """Tiny shader-graph builder. Sockets or plain values are accepted everywhere."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.mat = mat
        self.nt = mat.node_tree
        for n in list(self.nt.nodes):
            self.nt.nodes.remove(n)
        self.out = self.nt.nodes.new('ShaderNodeOutputMaterial')
        self.out.target = 'CYCLES'

    def _set(self, sock, val):
        if val is None:
            return
        if isinstance(val, bpy.types.NodeSocket):
            self.nt.links.new(val, sock)
            return
        dv = sock.default_value
        if hasattr(dv, '__len__'):
            n = len(dv)
            if isinstance(val, (int, float)):
                val = (val,) * n if n != 4 else (val, val, val, 1.0)
            elif len(val) == 3 and n == 4:
                val = (*val, 1.0)
        sock.default_value = val

    def node(self, kind, inputs=None, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        for k, v in (inputs or {}).items():
            self._set(n.inputs[k], v)
        return n

    @staticmethod
    def sock(coll, ident):
        for s in coll:
            if s.identifier == ident:
                return s
        raise KeyError(ident)

    # maths
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

    def comb(self, x=0.0, y=0.0, z=0.0):
        n = self.node('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)):
            self._set(n.inputs[i], v)
        return n.outputs[0]

    def remap(self, v, a, b, c=0.0, d=1.0, clamp=True, smooth=False):
        n = self.node('ShaderNodeMapRange', clamp=clamp)
        if smooth:
            n.interpolation_type = 'SMOOTHSTEP'
        for i, x in enumerate((v, a, b, c, d)):
            self._set(n.inputs[i], x)
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

    def cmul(self, a, b):
        return self.mix(1.0, a, b, blend='MULTIPLY')

    def ramp(self, fac, stops, interp='LINEAR'):
        n = self.node('ShaderNodeValToRGB')
        cr = n.color_ramp
        cr.interpolation = interp
        while len(cr.elements) > len(stops):
            cr.elements.remove(cr.elements[-1])
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for el, (pos, col) in zip(cr.elements, stops):
            el.position = pos
            el.color = (*col, 1.0) if len(col) == 3 else col
        self._set(n.inputs[0], fac)
        return n.outputs['Color']

    # textures and inputs
    def noise(self, vec, scale=5.0, detail=2.0, rough=0.5, lac=2.0, distortion=0.0, dims='3D'):
        n = self.node('ShaderNodeTexNoise', noise_dimensions=dims)
        if vec is not None:
            self._set(n.inputs['Vector'], vec)
        for k, v in (('Scale', scale), ('Detail', detail), ('Roughness', rough), ('Lacunarity', lac),
                     ('Distortion', distortion)):
            self._set(n.inputs[k], v)
        return n.outputs['Fac']

    def voronoi(self, vec, scale=5.0, feature='F1', rand=1.0, out='Distance', dims='3D'):
        n = self.node('ShaderNodeTexVoronoi', feature=feature, voronoi_dimensions=dims)
        self._set(n.inputs['Vector'], vec)
        self._set(n.inputs['Scale'], scale)
        self._set(n.inputs['Randomness'], rand)
        return n.outputs[out]

    def mapping(self, vec, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        n = self.node('ShaderNodeMapping', vector_type='POINT')
        self._set(n.inputs['Vector'], vec)
        self._set(n.inputs['Location'], loc)
        self._set(n.inputs['Rotation'], rot)
        self._set(n.inputs['Scale'], scale)
        return n.outputs['Vector']

    def texco(self, kind='Object', obj=None):
        n = self.node('ShaderNodeTexCoord')
        if obj is not None:
            n.object = obj
        return n.outputs[kind]

    def geo(self, out='Position'):
        return self.node('ShaderNodeNewGeometry').outputs[out]

    def attr(self, name, kind='GEOMETRY', out='Fac'):
        return self.node('ShaderNodeAttribute', attribute_type=kind, attribute_name=name).outputs[out]

    def value(self, v, label=''):
        n = self.node('ShaderNodeValue')
        n.outputs[0].default_value = v
        n.label = n.name = label or n.name
        return n

    def bump(self, height, strength=0.2, distance=1.0, normal=None):
        n = self.node('ShaderNodeBump', inputs={'Strength': strength, 'Distance': distance})
        self._set(n.inputs['Height'], height)
        if normal is not None:
            self._set(n.inputs['Normal'], normal)
        return n.outputs['Normal']

    # shaders
    def principled(self, **inputs):
        n = self.node('ShaderNodeBsdfPrincipled')
        for k, v in inputs.items():
            self._set(n.inputs[k.replace('_', ' ')], v)
        return n.outputs[0]

    def bsdf(self, kind, **inputs):
        n = self.node('ShaderNodeBsdf' + kind)
        for k, v in inputs.items():
            self._set(n.inputs[k.replace('_', ' ')], v)
        return n.outputs[0]

    def emission(self, color, strength):
        n = self.node('ShaderNodeEmission')
        self._set(n.inputs['Color'], color)
        self._set(n.inputs['Strength'], strength)
        return n.outputs[0]

    def mixs(self, fac, a, b):
        n = self.node('ShaderNodeMixShader')
        self._set(n.inputs[0], fac)
        self.nt.links.new(a, n.inputs[1])
        self.nt.links.new(b, n.inputs[2])
        return n.outputs[0]

    def adds(self, a, b):
        n = self.node('ShaderNodeAddShader')
        self.nt.links.new(a, n.inputs[0])
        self.nt.links.new(b, n.inputs[1])
        return n.outputs[0]

    def output(self, shader, disp=None):
        self.nt.links.new(shader, self.out.inputs['Surface'])
        if disp is not None:
            self.nt.links.new(disp, self.out.inputs['Displacement'])
        return self.mat


def new_mat(name):
    old = bpy.data.materials.get(name)
    if old is not None:
        bpy.data.materials.remove(old)
    return bpy.data.materials.new(name)


def key_value(node_or_socket, frame, value, interp='LINEAR'):
    """Keyframe a Value node (or any input socket) inside a material's node tree."""
    sock = node_or_socket.outputs[0] if isinstance(node_or_socket, bpy.types.Node) else node_or_socket
    sock.default_value = value
    sock.keyframe_insert('default_value', frame=frame)
    tree = sock.id_data
    ad = tree.animation_data
    if ad and ad.action:
        for fc in C.fcurves(ad.action):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 1e-4:
                    kp.interpolation = interp


# ================================================================== geometry-nodes instancing

_INSTANCER = None


def _instancer_group():
    """GN group: instance a collection's children on the carrier's points.

    Point attributes: rot (Euler), scl (vector), var (child index). All other
    point attributes propagate to the instances (read them in shaders with an
    Attribute node of type INSTANCER).
    """
    global _INSTANCER
    try:
        if _INSTANCER is not None and bpy.data.node_groups.get(_INSTANCER.name) == _INSTANCER:
            return _INSTANCER
    except ReferenceError:          # the scene was reset: the cached group is gone
        pass
    ng = bpy.data.node_groups.new('OfflineInstancer', 'GeometryNodeTree')
    ng.interface.new_socket(name='Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket(name='Templates', in_out='INPUT', socket_type='NodeSocketCollection')
    ng.interface.new_socket(name='Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    n, l = ng.nodes, ng.links
    gi, go = n.new('NodeGroupInput'), n.new('NodeGroupOutput')
    ci = n.new('GeometryNodeCollectionInfo')
    ci.inputs['Separate Children'].default_value = True
    ci.inputs['Reset Children'].default_value = True
    iop = n.new('GeometryNodeInstanceOnPoints')
    iop.inputs['Pick Instance'].default_value = True
    na_r = n.new('GeometryNodeInputNamedAttribute'); na_r.data_type = 'FLOAT_VECTOR'; na_r.inputs['Name'].default_value = 'rot'
    na_s = n.new('GeometryNodeInputNamedAttribute'); na_s.data_type = 'FLOAT_VECTOR'; na_s.inputs['Name'].default_value = 'scl'
    na_v = n.new('GeometryNodeInputNamedAttribute'); na_v.data_type = 'INT'; na_v.inputs['Name'].default_value = 'var'
    l.new(gi.outputs['Templates'], ci.inputs['Collection'])
    l.new(gi.outputs['Geometry'], iop.inputs['Points'])
    l.new(ci.outputs[0], iop.inputs['Instance'])
    l.new(na_v.outputs['Attribute'], iop.inputs['Instance Index'])
    l.new(na_r.outputs['Attribute'], iop.inputs['Rotation'])
    l.new(na_s.outputs['Attribute'], iop.inputs['Scale'])
    l.new(iop.outputs[0], go.inputs[0])
    _INSTANCER = ng
    return ng


def template_collection(name, objects):
    """Hidden collection of template objects (never rendered directly)."""
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for i, o in enumerate(objects):
        for c in o.users_collection:
            c.objects.unlink(o)
        o.name = f'{name}_{i:02d}'
        coll.objects.link(o)
        o.location = (0, 0, 0)
    return coll


def instancer(name, pts, templates, rot=None, scl=None, var=None, attrs=None, coll=None):
    """Carrier object that instances template objects on pts (N,3).

    rot (N,3) Euler or (N,3,3) matrices; scl (N,) or (N,3); var (N,) template index.
    attrs: {name: (N,) floats or (N,3)} available in shaders as INSTANCER attributes.
    """
    pts = np.asarray(pts, dtype=np.float32).reshape(-1, 3)
    n = len(pts)
    me = bpy.data.meshes.new(name)
    me.vertices.add(n)
    me.vertices.foreach_set('co', pts.ravel())
    if rot is None:
        rot = np.zeros((n, 3))
    rot = np.asarray(rot, dtype=float)
    if rot.ndim == 3:
        rot = matrices_to_euler(rot)
    set_attr(me, 'rot', rot, 'FLOAT_VECTOR')
    if scl is None:
        scl = np.ones(n)
    scl = np.asarray(scl, dtype=float)
    if scl.ndim == 1:
        scl = np.repeat(scl[:, None], 3, axis=1)
    set_attr(me, 'scl', scl, 'FLOAT_VECTOR')
    set_attr(me, 'var', np.zeros(n, int) if var is None else var, 'INT')
    for k, v in (attrs or {}).items():
        v = np.asarray(v, dtype=float)
        set_attr(me, k, v, 'FLOAT_VECTOR' if v.ndim == 2 else 'FLOAT')
    obj = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(obj)
    mod = obj.modifiers.new('Instances', 'NODES')
    ng = _instancer_group()
    mod.node_group = ng
    tcoll = templates if isinstance(templates, bpy.types.Collection) else template_collection(name + '_T', templates)
    mod[ng.interface.items_tree['Templates'].identifier] = tcoll
    return obj


# ================================================================== materials

def _ring_band(g, z, h, width, amp, below=14.0):
    """Coffee tide line at height h: a sharp dark top edge plus a faint wash below."""
    d = g.math('SUBTRACT', z, h)
    line = g.remap(g.math('ABSOLUTE', d), width, 0.0, 0.0, 1.0, smooth=True)
    wash = g.mul(g.remap(d, -below, 0.0, 0.0, 1.0, smooth=True), g.remap(d, 0.0, 0.6, 1.0, 0.0))
    return g.mul(g.add(line, g.mul(wash, 0.35)), amp)


def mat_paper_wall():
    """Translucent paper-cup wall at kilometre scale.

    Three octaves of paper structure in the unrolled (arc length, height) plane:
    formation flocs (~100 m), fibre bundles (~10 m) and single fibres (~1 m),
    criss-crossed at several angles. The overlap seam (double thickness) reads
    as a darker vertical band; coffee tide lines record years of evaporation;
    below the waterline the paper is soaked brown. Light comes from behind
    (translucency) from the area lights outside the cup.
    """
    m = new_mat('OFF_PaperWall')
    g = G(m)
    p = g.texco('Object')
    x, y, z = g.sep(p)
    # azimuth rotated so the atan2 cut sits exactly on the paper seam
    a0 = math.radians(SEAM_AZ)
    xr = g.add(g.mul(x, math.cos(a0)), g.mul(y, math.sin(a0)))
    yr = g.math('SUBTRACT', g.mul(y, math.cos(a0)), g.mul(x, math.sin(a0)))
    th = g.math('ARCTAN2', yr, xr)                      # 0 at the seam, +-pi opposite
    s = g.mul(th, 340.0)                                # arc length (m)
    uv = g.comb(s, z, 0.0)
    # formation: flocs (~35 m) inside clouds (~140 m): the mottling you see in backlit paper
    flocs = g.remap(g.noise(g.mapping(uv, scale=(1 / 34.0, 1 / 30.0, 1)), 1.0, 3.0, 0.55, dims='2D'), 0.25, 0.75)
    clouds = g.remap(g.noise(g.mapping(uv, scale=(1 / 150.0, 1 / 120.0, 1), loc=(7, 2, 0)), 1.0, 3.0, 0.55, dims='2D'), 0.3, 0.7)
    # fibres: thin wandering lines (isolines of stretched noise), three orientations and sizes
    fib = None
    for rot, sc_, w, seed_loc in ((24, (1 / 26.0, 1 / 7.0), 0.03, (3, 1)), (-52, (1 / 18.0, 1 / 5.0), 0.028, (11, 7)),
                                 (83, (1 / 9.0, 1 / 2.4), 0.035, (2, 13))):
        n = g.noise(g.mapping(uv, rot=(0, 0, math.radians(rot)), scale=(sc_[0], sc_[1], 1), loc=(*seed_loc, 0)),
                    1.0, 1.0, 0.5, dims='2D')
        line = g.remap(g.math('ABSOLUTE', g.math('SUBTRACT', n, 0.5)), w, 0.0)
        fib = line if fib is None else g.math('MAXIMUM', fib, line)
    bund = fib
    thick = g.add(g.mul(flocs, 0.3), g.mul(clouds, 0.45), g.mul(fib, 0.25))
    # overlap seam: a 64 m band of double paper starting at the seam edge, glue line inside it
    band = g.mul(g.remap(s, -1.5, 0.5, 0.0, 1.0), g.remap(s, 62.0, 64.0, 1.0, 0.0))
    glue = g.mul(g.remap(s, 4.0, 5.0, 0.0, 1.0), g.remap(s, 11.0, 12.5, 1.0, 0.0))
    edge = g.remap(g.math('ABSOLUTE', s), 1.6, 0.0)
    # tide lines (slightly wavy where the paper wicked unevenly)
    zw = g.add(z, g.mul(g.math('SUBTRACT', g.noise(g.mapping(uv, scale=(1 / 160.0, 1 / 160.0, 1)), 1.0, 2.0, 0.5, dims='2D'), 0.5), 3.0))
    stain = g.add(
        _ring_band(g, zw, 7.0, 1.2, 0.6, 9.0),
        _ring_band(g, zw, 24.0, 1.0, 0.36, 16.0),
        _ring_band(g, zw, 63.0, 0.9, 0.2, 26.0),
        _ring_band(g, zw, 141.0, 0.8, 0.1, 34.0),
    )
    wet = g.remap(zw, 2.5, -0.5)
    # the falls keep a long wet streak on the cliff below the ledge (spray soaks the paper)
    s_f = math.radians((FALLS_AZ - SEAM_AZ + 540.0) % 360.0 - 180.0) * 340.0
    half_w = g.add(34.0, g.mul(g.math('MAXIMUM', g.math('SUBTRACT', FALLS_Z, z), 0.0), 0.16))
    ds = g.math('DIVIDE', g.math('SUBTRACT', s, s_f), half_w)
    streak = g.mul(g.math('EXPONENT', g.mul(g.math('POWER', g.math('ABSOLUTE', ds), 2.0), -1.0)),
                   g.remap(z, FALLS_Z + 8.0, FALLS_Z - 30.0), 0.75)
    stain = g.math('MINIMUM', g.add(stain, wet, streak), 1.0)
    trans = g.mix(thick, (1.24, 1.12, 0.9), (0.62, 0.52, 0.38))
    trans = g.cmul(trans, PAPER)
    trans = g.mix(g.mul(band, 0.42), trans, g.cmul(trans, (0.55, 0.5, 0.44)))
    trans = g.mix(g.mul(glue, 0.35), trans, g.cmul(trans, (0.75, 0.62, 0.45)))
    trans = g.mix(stain, trans, g.cmul(trans, (0.42, 0.2, 0.07)))
    trans = g.mix(g.mul(edge, 0.6), trans, g.cmul(trans, (0.45, 0.42, 0.38)))
    diff = g.mix(stain, PAPER, (0.32, 0.17, 0.08))
    nrm = g.bump(g.add(g.mul(fib, 0.5), g.mul(flocs, 0.5)), strength=0.08, distance=1.0)
    s_tr = g.bsdf('Translucent', Color=trans, Normal=nrm)
    s_df = g.bsdf('Diffuse', Color=diff, Roughness=0.7, Normal=nrm)
    return g.output(g.mixs(0.22, s_tr, s_df))


def mat_lid(slot_frame, state='day'):
    """White polystyrene lid, seen from inside: translucent, ribbed, with the slot cut out.

    The slot is a stadium-shaped mask in the slot frame (projected along the
    slot normal, so from the S01 camera it is a perfect rounded oblong). Inside
    the mask the lid is transparent to every ray type: the S01 camera sees the
    sky emitter through it, and the sun lamp casts a real slot-shaped pool.
    The cut edge and the plastic around the hole glow (light scattering in the
    polystyrene), keyed by the 'SlotGlow' value.
    """
    m = new_mat('OFF_Lid')
    g = G(m)
    sp = g.texco('Object', slot_frame)
    sx, sy, sz = g.sep(sp)
    ax = g.math('MAXIMUM', g.math('SUBTRACT', g.math('ABSOLUTE', sx), 45.0), 0.0)
    d = g.math('SUBTRACT', g.vmath('LENGTH', g.comb(ax, sy, 0.0)), 22.5)     # stadium SDF (m)
    near = g.remap(g.math('ABSOLUTE', sz), 90.0, 75.0)          # the slope crosses the frame plane steeply
    hole = g.mul(g.remap(d, 0.35, -0.35), near)
    glow_v = g.value(1.0, 'SlotGlow')
    col = kelvin(7000) if state == 'day' else kelvin(9000)
    lip = g.mul(g.remap(d, 3.2, 0.2), g.remap(d, 0.0, 0.5), near)
    halo = g.mul(g.math('EXPONENT', g.mul(g.math('MAXIMUM', d, 0.0), -1 / 22.0)), near, 0.25)
    em = g.emission(col, g.mul(g.add(g.mul(lip, 14.0), g.mul(halo, 0.9)), glow_v.outputs[0]))
    p = g.texco('Object')
    mott = g.noise(p, 1 / 9.0, 3.0, 0.6)
    rough = g.remap(mott, 0.3, 0.7, 0.3, 0.42)
    nrm = g.bump(g.noise(p, 1 / 2.2, 2.0, 0.5), strength=0.04, distance=1.0)
    base = g.principled(Base_Color=LID_WHITE, Roughness=rough, Normal=nrm)
    tr = g.bsdf('Translucent', Color=g.mix(mott, (0.95, 0.94, 0.92), (0.82, 0.8, 0.77)), Normal=nrm)
    lid = g.adds(g.mixs(0.4, base, tr), em)
    return g.output(g.mixs(hole, lid, g.bsdf('Transparent', Color=(1, 1, 1))))


def mat_slot_sky(state='day'):
    m = new_mat('OFF_SlotSky')
    g = G(m)
    v = g.value(45.0 if state == 'day' else 9.0, 'SkyStrength')
    col = g.mix(0.25, kelvin(7500), kelvin(4800)) if state == 'day' else g.mix(0.6, kelvin(5500), (0.8, 0.84, 0.9))
    return g.output(g.emission(col, v.outputs[0]))


def mat_shaft(length, state='day'):
    """Additive light shaft: transparent + emission, brightest along the core.

    Object space: local -Z runs down the beam from the slot. Edge falloff from
    the facing ratio, length falloff, and fine striations along the beam (dust
    and turbulence) so it never reads as a solid tube.
    """
    m = new_mat('OFF_Shaft')
    g = G(m)
    p = g.texco('Object')
    x, y, z = g.sep(p)
    face = g.node('ShaderNodeLayerWeight', inputs={'Blend': 0.5}).outputs['Facing']
    core = g.math('POWER', g.math('SUBTRACT', 1.0, face), 3.2)
    along = g.add(0.3, g.mul(g.math('EXPONENT', g.mul(g.math('ABSOLUTE', z), -1 / 380.0)), 0.7))
    tail = g.remap(g.math('ABSOLUTE', z), length - 60.0, length, 1.0, 0.25)
    head = g.remap(g.math('ABSOLUTE', z), 0.0, 25.0, 0.0, 1.0)
    streak = g.noise(g.mapping(p, scale=(1 / 7.0, 1 / 7.0, 1 / 600.0)), 1.0, 3.0, 0.6)
    streak = g.remap(streak, 0.32, 0.72, 0.15, 1.45)
    v = g.value(0.42 if state == 'day' else 0.16, 'ShaftStrength')
    col = g.mix(0.35, kelvin(6200), kelvin(3600)) if state == 'day' else g.mix(0.7, kelvin(6000), (0.78, 0.83, 0.92))
    strength = g.mul(core, along, tail, head, streak, v.outputs[0])
    return g.output(g.adds(g.bsdf('Transparent', Color=(1, 1, 1)), g.emission(col, strength)))


def shore_image(name, mask_fn, x0, y0, size, res=2048, cache_path=None):
    """Rasterise land masks into an RGBA float image over [x0, x0+size] x [y0, y0+size].

    mask_fn(X, Y) -> (land, lagoon, shelf) arrays in [0,1]. R = shallows (wide blur of
    the land, plus submerged reef shelves), G = shoreline foam band, B = lagoon, A = 1.
    """
    if cache_path and os.path.exists(cache_path):
        rgba = np.load(cache_path)
    else:
        xs = x0 + (np.arange(res) + 0.5) * size / res
        ys = y0 + (np.arange(res) + 0.5) * size / res
        X, Y = np.meshgrid(xs, ys)
        land, lagoon, shelf = mask_fn(X, Y)
        px = size / res
        near = np.clip(blur2(land, 2.2 / px) * 1.0, 0, 1)
        wide = np.clip(np.maximum(blur2(land, 16.0 / px) * 2.2, blur2(shelf, 4.0 / px) * 0.85), 0, 1)
        foam = np.clip((near - land) * 3.2, 0, 1)
        rgba = np.stack([wide, foam, np.clip(lagoon, 0, 1), np.ones_like(land)], axis=-1).astype(np.float32)
        if cache_path:
            np.save(cache_path, rgba)
    img = bpy.data.images.get(name)
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, res, res, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


def mat_sea(shore_img, x0, y0, size, state='day'):
    """Espresso: near-black, glossy, capillary ripples, amber shallows, crema foam.

    The shore image (sea object space) gives shallows, island foam lines and the
    atoll lagoon. The crema band at the cliff foot is computed from world
    position against the true wall radius, so it follows the wall even when the
    gravity rig tilts the sea.
    """
    m = new_mat('OFF_Sea')
    g = G(m)
    p = g.texco('Object')
    x, y, z = g.sep(p)
    uv = g.comb(g.mul(g.math('SUBTRACT', x, x0), 1.0 / size), g.mul(g.math('SUBTRACT', y, y0), 1.0 / size), 0.0)
    tex = g.node('ShaderNodeTexImage', interpolation='Linear', extension='EXTEND')
    tex.image = shore_img
    g._set(tex.inputs['Vector'], uv)
    sh = g.sep(tex.outputs['Color'])
    shallow, foam_i, lagoon = sh
    wp = g.geo('Position')
    wx, wy, wz = g.sep(wp)
    rw = g.add(R_SEA, g.mul(wz, TAPER))
    dwall = g.math('SUBTRACT', rw, g.vmath('LENGTH', g.comb(wx, wy, 0.0)))
    brk = g.noise(g.mapping(wp, scale=(1 / 18.0, 1 / 18.0, 1 / 18.0)), 1.0, 3.0, 0.6)
    wall_foam = g.mul(g.remap(dwall, 15.0, 3.0), g.remap(brk, 0.3, 0.6, 0.45, 1.0))
    wall_foam = g.math('MAXIMUM', wall_foam, g.remap(dwall, 4.0, 1.0))
    bub = g.voronoi(g.mapping(p, scale=(1 / 1.6, 1 / 1.6, 1)), 1.0, out='Distance')
    lace = g.noise(g.mapping(p, scale=(1 / 6.0, 1 / 6.0, 1)), 1.0, 4.0, 0.62)
    foam = g.math('MAXIMUM', g.mul(foam_i, g.remap(lace, 0.35, 0.6, 0.3, 1.0)), wall_foam)
    foam = g.mul(foam, g.remap(bub, 0.05, 0.45, 1.0, 0.55))
    foam = g.remap(foam, 0.18, 0.55)
    base = g.mix(g.mul(g.math('POWER', shallow, 2.2), 0.65), ESPRESSO, AMBER)
    base = g.mix(g.mul(lagoon, 0.9), base, CARAMEL)
    base = g.mix(foam, base, g.mix(lace, CREMA, CREMA_LIGHT))
    cap1 = g.noise(g.mapping(p, scale=(1 / 0.9, 1 / 0.9, 1)), 1.0, 3.0, 0.55)
    cap2 = g.noise(g.mapping(p, scale=(1 / 6.5, 1 / 6.5, 1), loc=(3, 7, 0)), 1.0, 2.0, 0.5)
    swell = g.noise(g.mapping(p, scale=(1 / 40.0, 1 / 95.0, 1)), 1.0, 1.0, 0.5)
    h = g.add(g.mul(cap1, 0.35), g.mul(cap2, 0.5), g.mul(swell, 0.6))
    nrm = g.bump(h, strength=g.remap(foam, 0.0, 1.0, 0.22, 0.05), distance=0.6)
    rough = g.add(0.035, g.mul(g.noise(g.mapping(p, scale=(1 / 30.0, 1 / 30.0, 1)), 1.0, 2.0, 0.5), 0.05))
    rough = g.mixf(foam, rough, 0.75)
    lag_v = g.value(1.0 if state == 'day' else 0.05, 'LagoonGlow')
    em_s = g.mul(lagoon, lag_v.outputs[0], g.remap(foam, 0.0, 0.5, 1.0, 0.0), 0.9)
    sea = g.principled(Base_Color=base, Roughness=rough, IOR=1.34, Normal=nrm,
                       Emission_Color=CARAMEL, Emission_Strength=em_s)
    return g.output(sea)


def mat_foam():
    m = new_mat('OFF_Foam')
    g = G(m)
    p = g.texco('Object')
    bub = g.voronoi(g.mapping(p, scale=(1 / 0.7, 1 / 0.7, 1 / 0.7)), 1.0)
    big = g.voronoi(g.mapping(p, scale=(1 / 3.0, 1 / 3.0, 1 / 3.0)), 1.0)
    n = g.noise(p, 1 / 4.0, 3.0, 0.6)
    col = g.mix(g.remap(n, 0.35, 0.65), g.cmul(CREMA, (0.62, 0.55, 0.48)), g.cmul(CREMA_LIGHT, (0.8, 0.75, 0.68)))
    col = g.mix(g.remap(big, 0.0, 0.25, 0.35, 0.0), col, g.cmul(col, (0.6, 0.45, 0.32)))
    nrm = g.bump(g.add(g.mul(bub, -1.0), g.mul(big, -0.5)), strength=0.5, distance=0.4)
    return g.output(g.principled(Base_Color=col, Roughness=0.7, Normal=nrm,
                                 Subsurface_Weight=0.25, Subsurface_Radius=(0.6, 0.4, 0.25), Subsurface_Scale=0.5))


def mat_stone(name='OFF_Stone', tint=STONE, lichen=0.0, wet_line=True):
    """Weathered stone; darker and stained at the waterline; optional lichen crust."""
    m = new_mat(name)
    g = G(m)
    p = g.texco('Object')
    wp = g.geo('Position')
    n1 = g.noise(g.mapping(p, scale=(1 / 9.0,) * 3), 1.0, 5.0, 0.6)
    n2 = g.noise(g.mapping(p, scale=(1 / 1.3,) * 3), 1.0, 3.0, 0.55)
    strata = g.noise(g.mapping(p, scale=(1 / 40.0, 1 / 40.0, 1 / 2.5)), 1.0, 2.0, 0.5)
    col = g.mix(g.remap(n1, 0.3, 0.7), g.cmul(tint, (0.7, 0.66, 0.62)), g.cmul(tint, (1.25, 1.2, 1.12)))
    col = g.mix(g.mul(g.remap(strata, 0.45, 0.6), 0.4), col, g.cmul(col, (0.75, 0.68, 0.6)))
    rough = 0.82
    if lichen > 0:
        lp = g.noise(g.mapping(p, scale=(1 / 3.5,) * 3), 1.0, 4.0, 0.65)
        lm = g.mul(g.remap(lp, 0.52, 0.58), lichen)
        fp = g.noise(g.mapping(p, scale=(1 / 2.2,) * 3, loc=(9, 1, 4)), 1.0, 4.0, 0.65)
        fm = g.mul(g.remap(fp, 0.55, 0.6), lichen)
        col = g.mix(fm, col, FROST)
        col = g.mix(lm, col, g.mix(n2, LICHEN, (0.62, 0.78, 0.25)))
    if wet_line:
        wz = g.sep(wp)[2]
        wet = g.remap(wz, 1.6, -0.3)
        band = g.mul(g.remap(wz, 3.5, 1.2), g.remap(wz, 1.2, 0.6, 1.0, 0.0))
        col = g.mix(g.math('MAXIMUM', wet, g.mul(band, 0.6)), col, g.cmul(col, (0.32, 0.2, 0.12)))
        rough = g.mixf(wet, 0.82, 0.25)
    nrm = g.bump(g.add(g.mul(n1, 0.6), g.mul(n2, 0.4)), strength=0.45, distance=0.5)
    return g.output(g.principled(Base_Color=col, Roughness=rough, Normal=nrm))


def mat_padlock(age=None):
    """Ageing padlock: brass -> brown patina -> verdigris #43a08a -> lichen-crusted stone.

    age: None reads the per-instance 'age' attribute (INSTANCER); a float fixes it
    (the hero padlock). The stages arrive in patches (verdigris in hollows first),
    so the transition reads as weather, not as a gradient.
    """
    m = new_mat('OFF_Padlock' if age is None else f'OFF_Padlock_{age:.2f}')
    g = G(m)
    p = g.texco('Object')
    rnd = g.node('ShaderNodeObjectInfo').outputs['Random']
    q = g.add(p, g.comb(g.mul(rnd, 37.0), g.mul(rnd, 11.0), g.mul(rnd, 5.0)))
    a = g.attr('age', 'INSTANCER') if age is None else age
    n1 = g.noise(g.mapping(q, scale=(2.2,) * 3), 1.0, 4.0, 0.6)
    n2 = g.noise(g.mapping(q, scale=(5.0,) * 3, loc=(3, 1, 7)), 1.0, 4.0, 0.62)
    n3 = g.noise(g.mapping(q, scale=(1.4,) * 3, loc=(8, 2, 1)), 1.0, 3.0, 0.6)
    scr = g.noise(g.mapping(q, scale=(60.0, 1.2, 60.0)), 1.0, 2.0, 0.5)
    scratch = g.remap(scr, 0.62, 0.7)
    m_pat = g.remap(g.add(a, g.mul(g.math('SUBTRACT', n1, 0.5), 0.35)), 0.16, 0.3)
    m_ver = g.remap(g.add(a, g.mul(g.math('SUBTRACT', n2, 0.5), 0.5)), 0.42, 0.52)
    m_sto = g.remap(g.add(a, g.mul(g.math('SUBTRACT', n3, 0.5), 0.4)), 0.68, 0.78)
    brass = g.mix(g.remap(n2, 0.3, 0.7), g.cmul(BRASS, (0.85, 0.82, 0.75)), g.cmul(BRASS, (1.1, 1.05, 0.95)))
    brass = g.mix(g.mul(scratch, 0.6), brass, (0.95, 0.85, 0.6))
    patina = g.mix(n1, PATINA, g.cmul(PATINA, (0.55, 0.45, 0.4)))
    verd = g.mix(g.remap(n3, 0.35, 0.65), g.cmul(VERDIGRIS, (0.75, 0.85, 0.85)), g.cmul(VERDIGRIS, (1.25, 1.15, 1.05)))
    stone = g.mix(n2, (0.33, 0.33, 0.31), (0.5, 0.5, 0.47))
    lp = g.noise(g.mapping(q, scale=(0.9,) * 3, loc=(4, 4, 4)), 1.0, 4.0, 0.7)
    lich = g.mul(g.remap(lp, 0.5, 0.56), m_sto)
    fp = g.noise(g.mapping(q, scale=(1.3,) * 3, loc=(1, 9, 3)), 1.0, 4.0, 0.7)
    frost = g.mul(g.remap(fp, 0.52, 0.58), m_sto)
    col = g.mix(m_pat, brass, patina)
    col = g.mix(m_ver, col, verd)
    col = g.mix(m_sto, col, stone)
    col = g.mix(frost, col, FROST)
    col = g.mix(lich, col, g.mix(n1, LICHEN, (0.6, 0.75, 0.3)))
    metal = g.math('SUBTRACT', 1.0, g.math('MAXIMUM', m_ver, g.mul(m_pat, 0.45)))
    rough = g.mixf(m_pat, g.add(0.22, g.mul(scratch, 0.15)), 0.5)
    rough = g.mixf(m_ver, rough, 0.85)
    rough = g.mixf(m_sto, rough, 0.92)
    crust = g.mul(g.add(m_ver, m_sto), g.add(g.mul(n2, 0.6), g.mul(lp, 0.4)))
    nrm = g.bump(g.add(crust, g.mul(scratch, -0.15)), strength=g.add(0.12, g.mul(m_sto, 0.5)), distance=0.08)
    return g.output(g.principled(Base_Color=col, Metallic=metal, Roughness=rough, Normal=nrm))


def mat_foliage(name, dark=DEEP_GREEN, light=LIME, attr='tip', trans=0.3):
    """Leaves/needles/grass: deep green to lime at the tips, a little translucency."""
    m = new_mat(name)
    g = G(m)
    t = g.attr(attr, 'GEOMETRY', 'Fac')
    rnd = g.node('ShaderNodeObjectInfo').outputs['Random']
    p = g.texco('Object')
    n = g.noise(g.add(p, g.mul(rnd, 13.0)), 0.8, 2.0, 0.5)
    col = g.mix(g.math('POWER', t, 1.6), g.cmul(dark, (0.8, 0.85, 0.85)), g.mix(0.55, dark, light))
    col = g.mix(g.remap(n, 0.35, 0.65, 0.0, 0.35), col, g.cmul(col, (1.3, 1.15, 0.8)))
    col = g.mix(g.mul(rnd, 0.3), col, g.cmul(col, (0.85, 1.05, 0.8)))
    s = g.principled(Base_Color=col, Roughness=0.55)
    return g.output(g.mixs(trans, s, g.bsdf('Translucent', Color=g.cmul(col, (1.2, 1.3, 0.8)))))


def mat_bark(name='OFF_Bark', tint=(0.12, 0.09, 0.07)):
    m = new_mat(name)
    g = G(m)
    p = g.texco('Object')
    rings = g.noise(g.mapping(p, scale=(1.0, 1.0, 9.0)), 1.0, 2.0, 0.5)
    col = g.mix(g.remap(rings, 0.4, 0.6), g.cmul(tint, (0.7, 0.7, 0.7)), g.cmul(tint, (1.6, 1.5, 1.35)))
    nrm = g.bump(rings, strength=0.5, distance=0.05)
    return g.output(g.principled(Base_Color=col, Roughness=0.85, Normal=nrm))


def mat_sand():
    m = new_mat('OFF_Sand')
    g = G(m)
    p = g.texco('Object')
    wz = g.sep(g.geo('Position'))[2]
    n = g.noise(g.mapping(p, scale=(1 / 7.0,) * 3), 1.0, 4.0, 0.6)
    ripple = g.noise(g.mapping(p, scale=(1 / 0.8, 1 / 2.5, 1)), 1.0, 2.0, 0.5)
    col = g.mix(g.remap(n, 0.35, 0.65), g.cmul(SAND, (0.86, 0.82, 0.76)), SAND)
    wet = g.remap(wz, 1.4, 0.2)
    col = g.mix(wet, col, g.cmul(col, (0.55, 0.45, 0.34)))
    nrm = g.bump(g.add(g.mul(ripple, 0.4), g.mul(n, 0.6)), strength=0.25, distance=0.2)
    return g.output(g.principled(Base_Color=col, Roughness=g.mixf(wet, 0.88, 0.35), Normal=nrm))


def mat_paddy():
    """Terrace water: black mirror (roughness 0.02) with a faint green tint."""
    m = new_mat('OFF_Paddy')
    g = G(m)
    p = g.texco('Object')
    rip = g.noise(g.mapping(p, scale=(1 / 0.6,) * 3), 1.0, 2.0, 0.5)
    nrm = g.bump(rip, strength=0.015, distance=0.2)
    return g.output(g.principled(Base_Color=(0.006, 0.01, 0.008), Roughness=0.02, IOR=1.33, Normal=nrm))


def mat_terrace_ground():
    """Bunds and risers: moss and grass green with darker wet soil near the water."""
    m = new_mat('OFF_TerraceGround')
    g = G(m)
    p = g.texco('Object')
    n1 = g.noise(g.mapping(p, scale=(1 / 6.0,) * 3), 1.0, 4.0, 0.6)
    n2 = g.noise(g.mapping(p, scale=(1 / 0.9,) * 3), 1.0, 3.0, 0.6)
    gr = g.attr('grass', 'GEOMETRY', 'Fac')
    col = g.mix(g.remap(n1, 0.3, 0.7), g.cmul(DEEP_GREEN, (0.9, 1.0, 0.9)), g.mix(0.25, DEEP_GREEN, LIME))
    col = g.mix(g.mul(g.remap(n2, 0.5, 0.7), 0.5), col, g.mix(0.5, DEEP_GREEN, LIME))
    col = g.mix(g.math('SUBTRACT', 1.0, gr), col, (0.07, 0.05, 0.035))
    nrm = g.bump(g.add(n1, g.mul(n2, 0.5)), strength=0.35, distance=0.3)
    return g.output(g.principled(Base_Color=col, Roughness=0.8, Normal=nrm))


def mat_paper_sheet(name='OFF_Sheet', glow=0.0):
    """Blank paper sheet, double sided: translucent glow when backlit."""
    m = new_mat(name)
    g = G(m)
    rnd = g.attr('tint', 'GEOMETRY', 'Fac')
    col = g.mix(rnd, PAPER, (0.93, 0.9, 0.84))
    s = g.mixs(0.25, g.principled(Base_Color=col, Roughness=0.55), g.bsdf('Translucent', Color=g.cmul(col, (1.0, 0.95, 0.85))))
    if glow > 0:
        s = g.adds(s, g.emission(col, glow))
    return g.output(s)


def mat_bird():
    """Origami paper bird: white, translucent, with a faint glowing edge."""
    m = new_mat('OFF_Bird')
    g = G(m)
    fres = g.node('ShaderNodeLayerWeight', inputs={'Blend': 0.15}).outputs['Fresnel']
    edge = g.value(1.4, 'BirdEdgeGlow')
    s = g.mixs(0.12, g.principled(Base_Color=g.cmul(PAPER, (0.42, 0.41, 0.4)), Roughness=0.55),
               g.bsdf('Translucent', Color=(0.95, 0.9, 0.82)))
    return g.output(g.adds(s, g.emission(kelvin(3600), g.mul(fres, edge.outputs[0]))))


def mat_envelope():
    """Hero envelope: white paper, small cobalt square seal (material index 1)."""
    m0 = mat_paper_sheet('OFF_EnvelopePaper', glow=0.0)
    m1 = new_mat('OFF_EnvelopeSeal')
    g = G(m1)
    g.output(g.principled(Base_Color=COBALT, Roughness=0.35))
    return m0, m1


def mat_firefly(clock_node_name='FireflyClock'):
    """Firefly emission computed in-shader from a keyed frame clock.

    Per-instance attributes: ff_phase (0..1), ff_freq (natural frequency detune),
    ff_grey (1 for Pat's grey firefly), ff_col (colour). The phase of every
    firefly is pulled to the common clock by a coupling term that ramps up
    between f1150 and f1192 (Kuramoto-style convergence); Pat's firefly keeps a
    lag of 4 frames at f1185 and 2 at f1201 and locks at f1217. Flash shape: a
    2-frame rise into the beat, then a 10-frame decay.
    """
    m = new_mat('OFF_Firefly')
    g = G(m)
    clock = g.value(1217.0, clock_node_name)
    t = clock.outputs[0]
    phi = g.attr('ff_phase', 'GEOMETRY', 'Fac')
    eps = g.attr('ff_freq', 'GEOMETRY', 'Fac')
    grey = g.attr('ff_grey', 'GEOMETRY', 'Fac')
    col = g.attr('ff_col', 'GEOMETRY', 'Color')
    P = float(FIREFLY_PERIOD)
    dt = g.math('SUBTRACT', t, float(FIREFLY_T0))
    coupling = g.remap(t, 1150.0, 1192.0, 0.0, 1.0, smooth=True)
    drift = g.mul(g.add(phi, g.mul(eps, g.math('DIVIDE', dt, P))), g.math('SUBTRACT', 1.0, coupling))
    # Pat: 4 frames late at 1185, 2 at 1201, 0 at 1217 (piecewise linear), random before.
    lag = g.remap(t, 1185.0, 1217.0, 4.0, 0.0)
    grey_drift = g.mul(g.add(0.37, g.mul(0.11, g.math('DIVIDE', dt, P))), g.remap(t, 1150.0, 1180.0, 1.0, 0.0, smooth=True))
    ph_n = g.add(g.math('DIVIDE', dt, P), drift)
    ph_g = g.add(g.math('DIVIDE', g.math('SUBTRACT', dt, lag), P), grey_drift)
    ph = g.mixf(grey, ph_n, ph_g)
    u = g.mul(g.math('FRACT', ph), P)                  # frames since the last flash peak
    rise = g.remap(u, P - 2.0, P, 0.0, 1.0)
    decay = g.math('POWER', g.remap(u, 0.0, 10.0, 1.0, 0.0), 2.0)
    b = g.add(g.math('MAXIMUM', rise, decay), 0.025)
    lvl = g.value(1.0, 'FireflyLevel')
    k = g.value(120.0, 'FireflyStrength')
    return g.output(g.emission(col, g.mul(b, k.outputs[0], lvl.outputs[0])))


def mat_box():
    m = new_mat('OFF_Box')
    g = G(m)
    p = g.texco('Object')
    n = g.noise(g.mapping(p, scale=(1 / 3.0,) * 3), 1.0, 3.0, 0.55)
    col = g.mix(g.remap(n, 0.3, 0.7), g.cmul(CHARCOAL, (0.8, 0.8, 0.8)), g.cmul(CHARCOAL, (1.3, 1.3, 1.3)))
    return g.output(g.principled(Base_Color=col, Roughness=g.remap(n, 0.3, 0.7, 0.35, 0.55)))


def mat_skylight(state='day'):
    m = new_mat('OFF_BoxSkylight')
    g = G(m)
    v = g.value(9.0 if state == 'day' else 5.0, 'SkylightStrength')
    return g.output(g.emission(kelvin(6000), v.outputs[0]))


def mat_mist(name='OFF_Mist', strength=0.35):
    """Soft spray card: transparent with a noisy emissive veil (alpha falloff to the edges)."""
    m = new_mat(name)
    g = G(m)
    uv = g.texco('UV')
    u, v, _ = g.sep(uv)
    edge = g.mul(g.remap(u, 0.0, 0.3), g.remap(u, 1.0, 0.7), g.remap(v, 0.0, 0.35), g.remap(v, 1.0, 0.55))
    n = g.noise(g.mapping(uv, scale=(3.0, 2.0, 1.0)), 1.0, 5.0, 0.62)
    a = g.mul(edge, g.remap(n, 0.38, 0.72))
    lvl = g.value(strength, 'MistStrength')
    em = g.emission((0.95, 0.9, 0.82), g.mul(a, lvl.outputs[0]))
    tr = g.bsdf('Transparent', Color=(1, 1, 1))
    veil = g.mixs(g.mul(a, 0.35), tr, g.bsdf('Translucent', Color=(0.9, 0.86, 0.8)))
    return g.output(g.adds(veil, em))


def mat_dust():
    m = new_mat('OFF_Dust')
    g = G(m)
    uv = g.texco('UV')
    u, v, _ = g.sep(uv)
    r = g.vmath('LENGTH', g.comb(g.math('SUBTRACT', u, 0.5), g.math('SUBTRACT', v, 0.5), 0.0))
    n = g.noise(g.mapping(uv, scale=(4.0, 4.0, 1.0)), 1.0, 4.0, 0.6)
    a = g.mul(g.remap(r, 0.5, 0.1), g.remap(n, 0.35, 0.7))
    lvl = g.value(0.0, 'DustAlpha')
    a = g.mul(a, lvl.outputs[0])
    return g.output(g.mixs(a, g.bsdf('Transparent', Color=(1, 1, 1)),
                           g.principled(Base_Color=(0.55, 0.47, 0.38), Roughness=1.0)))


# ================================================================== cup, lid, slot, shaft

def build_cup_wall(coll, mat):
    """Tapered interior wall from below the sea to the lid, one overlap seam.

    The inner paper layer's cut edge stands 2.8 m proud at the seam azimuth
    (paper is 0.3 mm thick: 2.7 m at this scale); low-frequency waviness gives
    the cliffs their slow relief.
    """
    nseg = 900
    az = np.radians(SEAM_AZ) + np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    zs = np.concatenate([np.linspace(-170, -10, 12), np.linspace(-8, 30, 30), np.linspace(32, 580, 120),
                         np.linspace(583, 615, 9)])
    A, Z = np.meshgrid(az, zs)
    R = cup_radius(Z)
    s = (A - A[0, 0]) * R                                  # arc length from the seam edge
    inset = np.where(s < 64.0, 2.8 * smoothstep(0.0, 2.6, s), 2.8 * (1 - smoothstep(64.0, 74.0, s)))
    wav = 1.4 * fbm2(s / 95.0, Z / 150.0, 3, seed=11) + 0.5 * fbm2(s / 22.0, Z / 60.0, 2, seed=12)
    R = R - inset + wav
    V = np.stack([R * np.cos(A), R * np.sin(A), Z], axis=-1).reshape(-1, 3)
    F = grid_faces(nseg, len(zs), wrap_u=True)[:, ::-1]      # normals face the axis
    return np_mesh('OFF_CupWall', V, F, coll=coll, mat=mat)


def build_lid(coll, mat):
    """Lid underside as a polar mesh (dense where the ribs and the slot are)."""
    nseg = 900
    r = np.unique(np.concatenate([np.linspace(1.5, 280, 200), np.linspace(280, 300, 14),
                                  np.linspace(300, 372, 110), np.linspace(372, 412, 28)]))
    az = np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    A, Rr = np.meshgrid(az, r)
    Z = lid_z(Rr)
    V = np.stack([Rr * np.cos(A), Rr * np.sin(A), Z], axis=-1).reshape(-1, 3)
    F = grid_faces(nseg, len(r), wrap_u=True)
    c = len(V)
    V = np.vstack([V, [[0.0, 0.0, float(lid_z(0.0))]]])
    k = np.arange(nseg)
    fan = np.stack([np.full(nseg, c), (k + 1) % nseg, k], axis=-1)
    return np_mesh('OFF_Lid', V, [F, fan], coll=coll, mat=mat)


def slot_matrix():
    """World matrix of the slot frame: X long axis, Z out of the cup (opposite SLOT_N)."""
    zax = -SLOT_N
    xax = _slot_x
    yax = zax.cross(xax).normalized()
    xax = yax.cross(zax).normalized()
    m = Matrix((xax, yax, zax)).transposed().to_4x4()
    m.translation = SLOT_C
    return m


def stadium(n, half_len=45.0, radius=22.5):
    """Points (n,2) around a stadium (rounded oblong), counter-clockwise."""
    per = 4 * half_len + 2 * np.pi * radius
    t = np.linspace(0, per, n, endpoint=False)
    pts = np.zeros((n, 2))
    for i, s in enumerate(t):
        if s < 2 * half_len:
            pts[i] = (-half_len + s, -radius)
        elif s < 2 * half_len + np.pi * radius:
            a = -np.pi / 2 + (s - 2 * half_len) / radius
            pts[i] = (half_len + radius * np.cos(a), radius * np.sin(a))
        elif s < 4 * half_len + np.pi * radius:
            pts[i] = (half_len - (s - 2 * half_len - np.pi * radius), radius)
        else:
            a = np.pi / 2 + (s - 4 * half_len - np.pi * radius) / radius
            pts[i] = (-half_len + radius * np.cos(a), radius * np.sin(a))
    return pts


def build_slot(coll, state):
    """Slot frame empty, the sky emitter beyond the hole, and the sun lamp down the shaft."""
    frame = C.empty('OFF_SlotFrame', coll, display='ARROWS', size=40.0)
    frame.matrix_world = slot_matrix()
    # sky: a disc beyond the slot, square to the slot normal, high enough to clear the lid
    n = 96
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False)
    V = np.vstack([[0, 0, 0], np.stack([280 * np.cos(ang), 280 * np.sin(ang), np.zeros(n)], axis=1)])
    k = np.arange(n)
    F = np.stack([np.zeros(n, int), 1 + k, 1 + (k + 1) % n], axis=1)
    sky = np_mesh('OFF_SlotSky', V, F, coll=coll, mat=mat_slot_sky(state))
    sky.matrix_world = slot_matrix() @ Matrix.Translation((0, 0, 270.0))
    hide_from(sky, camera=True, diffuse=False, glossy=True, transmission=False, shadow=False, scatter=False)
    sky.active_material.cycles.emission_sampling = 'NONE'
    return frame, sky


def build_shaft(coll, state):
    """Emissive prism from the slot to the island (cross-section = the slot, slight spread)."""
    rows = 48
    outline = stadium(64)
    X, Y = Vector(_slot_x), (-SLOT_N).cross(_slot_x).normalized()
    end = Vector((ISLAND_C.x, ISLAND_C.y, _BOX_Z + 1.0))
    length = (end - SLOT_C).dot(SHAFT_DIR) / max(1e-3, SHAFT_DIR.dot(SHAFT_DIR))
    ts = np.linspace(0.0, length, rows) ** 1.0
    zl = -SHAFT_DIR
    xl = Vector(X - zl * X.dot(zl)).normalized()
    yl = zl.cross(xl)
    M = Matrix((xl, yl, zl)).transposed().to_4x4()
    M.translation = SLOT_C
    Minv = M.inverted()
    verts = []
    for t in ts:
        spread = 1.0 + 0.00022 * t
        for (a, b) in outline:
            q = SLOT_C + X * (a * spread) + Y * (b * spread)
            # move q along the beam to the plane at distance t below the slot centre
            d = (SLOT_C + SHAFT_DIR * t - q).dot(SHAFT_DIR)
            w = q + SHAFT_DIR * d
            verts.append(tuple(Minv @ w))
    V = np.array(verts)
    F = grid_faces(len(outline), rows, wrap_u=True)
    obj = np_mesh('OFF_Shaft', V, F, coll=coll, mat=mat_shaft(length, state))
    obj.matrix_world = M
    hide_from(obj, camera=True, diffuse=False, glossy=True, transmission=False, shadow=False, scatter=False)
    obj.active_material.cycles.emission_sampling = 'NONE'
    return obj, length


def _blockers(objs):
    """Shadow-link collection that lets fill lights pass straight through the cup."""
    coll = bpy.data.collections.get('OFF_PassThrough') or bpy.data.collections.new('OFF_PassThrough')
    for o in objs:
        if o is not None and o.name not in coll.objects:
            coll.objects.link(o)
    for co in coll.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    return coll


def build_lights(coll, state, pass_coll):
    """Sun down the shaft, the warm wall ring, the top light, and the colour blooms."""
    lights = {}
    sun = C.sun_light('OFF_Sun', (0, 0, 0), energy=1.0, angle_deg=0.9, coll=coll)
    sun.rotation_euler = (-SHAFT_DIR).to_track_quat('Z', 'Y').to_euler()
    lights['sun'] = sun
    ring = []
    nring = 10
    for k in range(nring):
        az = 360.0 * (k + 0.5) / nring
        zc = 300.0
        rr = float(cup_radius(zc)) + 80.0
        pos = _pol(az, rr, zc)
        L = C.area_light(f'OFF_WallLight_{k}', pos, target=_pol(az, 0, zc + 0.0), energy=1.0,
                         size=2 * np.pi * rr / nring * 1.08, size_y=800.0, coll=coll)
        ring.append(L)
    lights['ring'] = ring
    top = C.area_light('OFF_TopLight', (0, 0, 900.0), target=(0, 0, 0), energy=1.0, size=880.0, shape='DISK', coll=coll)
    lights['top'] = top
    blooms = {}
    for name, (hx, az, zc) in ATTENDEES.items():
        # a lamp ~90 m behind the paper: a soft, peaked bloom ~150 m across
        rr = float(cup_radius(zc)) + 90.0
        L = C.point_light(f'OFF_Bloom_{name}', _pol(az, rr, zc), energy=0.0, radius=30.0, color=srgb(hx), coll=coll)
        blooms[name] = L
    lights['blooms'] = blooms
    for L in ring + [top] + list(blooms.values()):
        L.light_linking.blocker_collection = pass_coll
    # the sun only exists inside the cup as the beam through the hole: the paper and the
    # lid do not receive it (their glow comes from the ring, top and bloom lights)
    sun.light_linking.receiver_collection = pass_coll
    for L in [sun] + ring + [top] + list(blooms.values()):
        L.data.cycles.max_bounces = 6 if L is sun else 3
    return lights


# Energies: area-light watts are set so the irradiance through the paper is ~3 W/m2
# (ring), ~2 (top) and ~5 (blooms) against a 7 W/m2 sun pool.
DAY_LIGHT = dict(sun=4.6, sun_col=kelvin(5400), ring=4.4e5, ring_col=kelvin(3400), top=2.6e5, top_col=kelvin(5200),
                 bloom=4.5e5)
NIGHT_LIGHT = dict(sun=1.1, sun_col=(0.78, 0.84, 0.95), ring=0.0, ring_col=kelvin(3100), top=6.0e4,
                   top_col=(0.55, 0.62, 0.8), bloom=1.6e5)
DAY_BLOOMS = ('keys', 'strategy', 'people', 'kevin', 'operations', 'linda', 'arjun', 'synthia')


def apply_light_state(h, state, blooms=None):
    """Set energies/colours for 'day' or 'night'. blooms: names switched on (default per state)."""
    L = h['lights']
    p = DAY_LIGHT if state == 'day' else NIGHT_LIGHT
    L['sun'].data.energy = p['sun']
    L['sun'].data.color = p['sun_col']
    for r in L['ring']:
        # the sun is outside the slot side: that wall is backlit hardest, the far wall least
        az = math.atan2(r.location.y, r.location.x)
        k = 0.1 + 0.9 * (0.5 + 0.5 * math.cos(az - math.radians(_SLOT_AZ))) ** 2.2
        r.data.energy = p['ring'] * k
        r.data.color = p['ring_col']
    L['top'].data.energy = p['top']
    L['top'].data.color = p['top_col']
    on = set(blooms if blooms is not None else (DAY_BLOOMS if state == 'day' else ('pat',)))
    for name, b in L['blooms'].items():
        b.data.energy = p['bloom'] if name in on else 0.0
        if state == 'night' and name == 'pat':
            b.data.energy = p['bloom']


def key_bloom(h, name, frame, on, interp='CONSTANT'):
    """Key one attendee bloom on/off (S11 switches them off one by one)."""
    b = h['lights']['blooms'][name]
    b.data.energy = (DAY_LIGHT['bloom'] if on else 0.0) if not isinstance(on, (int, float)) or isinstance(on, bool) else on
    b.data.keyframe_insert('energy', frame=frame)
    for fc in C.fcurves(b.data.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = interp


def key_slot(h, frame, level, interp='BEZIER'):
    """Key the slot-sun brightness (1 = nominal). Drives the sun, sky, lid glow and shaft together.

    S01 eclipse: key_slot(h, 104, 1.0); key_slot(h, 124, 0.4).
    """
    st = h['state']
    base = DAY_LIGHT if st == 'day' else NIGHT_LIGHT
    sun = h['lights']['sun']
    sun.data.energy = base['sun'] * level
    sun.data.keyframe_insert('energy', frame=frame)
    for mat, node, nominal in ((h['mats'].get('lid'), 'SlotGlow', 1.0),
                               (h['mats'].get('shaft'), 'ShaftStrength', h['nominal']['shaft']),
                               (h['mats'].get('sky'), 'SkyStrength', h['nominal']['sky'])):
        if mat is not None:
            key_value(mat.node_tree.nodes[node], frame, nominal * level, 'BEZIER')


# ================================================================== sea

def build_sea(coll, state, focus, shore_img, img_box):
    """Polar sea mesh centred on the camera focus (fine near the lens, coarse far away).

    An Ocean modifier adds low swell; the shader adds capillaries. Near the wall
    the surface rises in a meniscus (coffee wets paper), carrying the crema line.
    """
    fx, fy = focus
    nr, ns = 170, 640
    rr = 0.35 * (1100.0 / 0.35) ** (np.arange(nr) / (nr - 1))
    az = np.linspace(0, 2 * np.pi, ns, endpoint=False)
    A, Rr = np.meshgrid(az, rr)
    X = fx + Rr * np.cos(A)
    Y = fy + Rr * np.sin(A)
    rax = np.hypot(X, Y)
    over = rax > R_SEA + 60.0                                   # fold far-outside rings back near the wall
    scale_back = np.where(over, (R_SEA + 60.0) / np.maximum(rax, 1e-6), 1.0)
    X, Y = X * scale_back, Y * scale_back
    rax = np.hypot(X, Y)
    dwall = R_SEA - rax
    Z = 5.5 * np.exp(-np.clip(dwall, 0, None) / 5.0) * (dwall > -3)
    V = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)
    c = len(V)
    V = np.vstack([V, [[fx, fy, 0.0]]])
    F = grid_faces(ns, nr, wrap_u=True)
    k = np.arange(ns)
    fan = np.stack([np.full(ns, c), k, (k + 1) % ns], axis=-1)
    x0, y0, size = img_box
    obj = np_mesh('OFF_Sea', V, [F, fan], coll=coll, mat=mat_sea(shore_img, x0, y0, size, state))
    oc = obj.modifiers.new('Swell', 'OCEAN')
    oc.geometry_mode = 'DISPLACE'
    oc.resolution = 10
    oc.spatial_size = 140
    oc.wave_scale = 0.32
    oc.wind_velocity = 9.0
    oc.choppiness = 0.7
    oc.damping = 0.7
    oc.wave_alignment = 0.4
    oc.wave_direction = math.radians(40)
    oc.random_seed = 7
    oc.time = 0.0
    oc.keyframe_insert('time', frame=0)
    oc.time = 1440 / 24.0 * 0.55
    oc.keyframe_insert('time', frame=1440)
    for fc in C.fcurves(obj.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
        fc.extrapolation = 'LINEAR'
    return obj


def build_floes(coll, mat, land_fn, seed=3, n=160):
    """Crema foam floes: flat lacy blobs, denser near shores and the cliff foot."""
    rng = np.random.default_rng(seed)
    verts, faces = [], []
    base = 0
    placed = 0
    tries = 0
    while placed < n and tries < n * 20:
        tries += 1
        r = R_SEA * math.sqrt(rng.uniform(0.0, 1.0))
        if rng.uniform() < 0.45:
            r = R_SEA - rng.exponential(18.0) - 4.0
        a = rng.uniform(0, 2 * np.pi)
        x, y = r * math.cos(a), r * math.sin(a)
        lm = land_fn(np.array([x]), np.array([y]))
        if lm[0][0] > 0.02 or lm[2][0] > 0.6:
            continue
        size = float(np.clip(rng.lognormal(0.7, 0.75), 0.6, 11.0))
        m = 18
        ang = np.linspace(0, 2 * np.pi, m, endpoint=False)
        rad = size * (0.75 + 0.35 * vnoise2(np.cos(ang) * 1.7 + placed * 3.1, np.sin(ang) * 1.7, seed=placed))
        rad *= np.where(rng.uniform(size=m) < 0.2, 0.7, 1.0)
        ring = np.stack([x + rad * np.cos(ang), y + rad * np.sin(ang), np.full(m, 0.25)], axis=1)
        verts.append([[x, y, 0.55]])
        verts.append(ring)
        k = np.arange(m)
        faces.append(np.stack([np.full(m, base), base + 1 + k, base + 1 + (k + 1) % m], axis=1))
        base += m + 1
        placed += 1
    V = np.vstack(verts)
    obj = np_mesh('OFF_Floes', V, [np.vstack(faces)], coll=coll, mat=mat)
    return obj


# ================================================================== landform height functions

BOX_AXIS = Vector((_slot_x.x, _slot_x.y, 0.0)).normalized()      # the room box is parallel to the sip slot
ARCH_SPAN = Vector((_slot_x.x, _slot_x.y, 0.0)).normalized()     # the arch plane faces the S01/S06 cameras
ARCH_FACE = Vector((_u.x, _u.y, 0.0))
ARCH_LEAN = 14.0          # degrees: the arch leans toward the S01/S06 cameras, so the slot sits in its opening


def _local(X, Y, c, axis):
    dx, dy = X - c[0], Y - c[1]
    return dx * axis[0] + dy * axis[1], -dx * axis[1] + dy * axis[0]


def island_h(X, Y):
    """Stone island: a low rocky table under the box, broken cliffs, boulders in the shallows."""
    u, v = _local(X, Y, ISLAND_C, BOX_AXIS)
    wu = u + 6.0 * fbm2(X / 40.0, Y / 40.0, 2, seed=41)
    wv = v + 6.0 * fbm2(X / 40.0 + 7, Y / 40.0, 2, seed=42)
    d = np.sqrt((wu / 46.0) ** 2 + (wv / 27.0) ** 2)
    rock = fbm2(X / 9.0, Y / 9.0, 4, seed=43)
    h = 11.0 * (1 - smoothstep(0.62, 1.12, d)) - 3.6 + 1.7 * rock + 0.8 * fbm2(X / 2.5, Y / 2.5, 2, seed=44)
    pad = (1 - smoothstep(0.0, 1.0, np.maximum(np.abs(u) - 17.5, 0) / 3.0)) * (1 - smoothstep(0.0, 1.0, np.maximum(np.abs(v) - 4.6, 0) / 3.0))
    h = h * (1 - pad) + (_BOX_Z + 0.05 * rock) * pad
    boulders = np.clip(3.5 * fbm2(X / 6.0, Y / 6.0, 2, seed=45) - 1.2, 0, None) * smoothstep(1.6, 1.0, d) * smoothstep(0.9, 1.1, d)
    return h + boulders * 2.0


def atoll_h(X, Y):
    """Ring atoll (the glass zero, carried forward): sand ring, two passes, reef shelf, shallow lagoon."""
    dx, dy = X - ATOLL_C.x, Y - ATOLL_C.y
    ang = np.arctan2(dy, dx)
    d = np.hypot(dx, dy) + 5.0 * fbm2(np.cos(ang) * 2.2 + 3, np.sin(ang) * 2.2, 3, seed=51)
    R = OFFLINE['atoll_radius']
    ring = 5.6 * np.exp(-((d - R) / 11.5) ** 2)
    passes = 1.0 - 0.95 * np.exp(-((np.angle(np.exp(1j * (ang - 0.9))) / 0.11) ** 2)) \
        - 0.8 * np.exp(-((np.angle(np.exp(1j * (ang + 2.35))) / 0.07) ** 2))
    shelf = -1.6 * np.exp(-((d - R) / 30.0) ** 2) - 4.5 * (1 - np.exp(-((d - R) / 30.0) ** 2))
    h = shelf + (ring + 1.5) * np.clip(passes, 0.05, 1) + 0.6 * fbm2(X / 7.0, Y / 7.0, 3, seed=52)
    lagoon_floor = -1.0 + 0.4 * fbm2(X / 15.0, Y / 15.0, 2, seed=53)
    inside = smoothstep(R - 8.0, R - 22.0, d)
    h = np.maximum(h, lagoon_floor * inside + h * (1 - inside))
    lagoon = smoothstep(R - 12.0, R - 20.0, d)
    return h, lagoon


_T_AXIS = Vector((math.cos(math.radians(28)), math.sin(math.radians(28)), 0.0))
TERRACE_STEP = 6.3
TERRACE_BASE = 1.6


def terrace_fields(X, Y):
    """Seven stepped paddies. Returns (h, e, level, frac, water_z).

    e is the hill parameter (1 at the summit); level = floor(7e); each level is a
    flat paddy held by a raised bund at its outer edge, with a steep grassy riser
    up to the next level. Contours are organic, tab-like rounded rectangles.
    """
    u, v = _local(X, Y, TERRACE_C, _T_AXIS)
    wu = u + 15.0 * fbm2(X / 75.0, Y / 75.0, 3, seed=61)
    wv = v + 15.0 * fbm2(X / 75.0 + 4, Y / 75.0 + 9, 3, seed=62)
    ang = np.arctan2(wv, wu)
    lobes = 1.0 + 0.1 * np.sin(3.0 * ang + 1.3) + 0.06 * np.sin(5.0 * ang + 0.4)
    d = (np.abs(wu / 90.0) ** 2.7 + np.abs((wv + 0.1 * wu) / 72.0) ** 2.7) ** (1 / 2.7) * lobes
    e = 1.0 - d
    lv = np.floor(np.clip(e, 0, 0.9999) * 7.0)
    fr = np.clip(e, 0, None) * 7.0 - lv
    riser = smoothstep(0.84, 1.0, fr)
    bund = 0.85 * (1 - smoothstep(0.0, 0.07, fr))
    h = TERRACE_BASE + TERRACE_STEP * (lv + riser) + bund * (lv < 7) + 0.25 * fbm2(X / 3.0, Y / 3.0, 2, seed=63)
    skirt = TERRACE_BASE + 0.85 + 60.0 * e
    h = np.where(e < 0, skirt + 0.6 * fbm2(X / 5.0, Y / 5.0, 2, seed=64), h)
    water = TERRACE_BASE + TERRACE_STEP * lv + 0.45
    return h, e, lv, fr, water


def arch_feet():
    """World positions of the two arch feet (left, right as seen from the S06 camera)."""
    return (ARCH_C - ARCH_SPAN * 34.0, ARCH_C + ARCH_SPAN * 38.0)


def mound_h(X, Y):
    """Scree mounds at the arch feet (the left one is the big landing slope)."""
    fl, fr = arch_feet()
    out = np.full(X.shape, -30.0)
    for c, r0, hh, sd in ((fl - ARCH_FACE * 6.0, 46.0, 15.0, 71), (fr, 34.0, 9.0, 72)):
        d = np.hypot(X - c.x, Y - c.y) * (1 + 0.15 * fbm2(X / 20.0, Y / 20.0, 2, seed=sd))
        out = np.maximum(out, hh * (1 - smoothstep(0.0, r0, d)) ** 1.5 - 2.0 + 0.8 * fbm2(X / 4, Y / 4, 2, seed=sd + 5))
    return out


def falls_base_pos():
    return _pol(FALLS_AZ, R_SEA - 26.0, 0.0)


def heap_h(X, Y):
    c = falls_base_pos()
    d = np.hypot(X - c.x, Y - c.y)
    d = d * (1 + 0.12 * fbm2(X / 15.0, Y / 15.0, 2, seed=81))
    return 13.0 * (1 - smoothstep(0.0, 44.0, d)) ** 1.3 - 3.0


def _boxed(X, Y, fn, c, r, fill):
    """Evaluate fn only inside the square of half-size r around c (fill elsewhere)."""
    sel = (np.abs(X - c[0]) < r) & (np.abs(Y - c[1]) < r)
    out = np.full(X.shape, fill, dtype=float)
    if sel.any():
        out[sel] = fn(X[sel], Y[sel])
    return out


def land_masks(X, Y, parts):
    """(land, lagoon, shelf) masks over world arrays for the parts that are present."""
    X = np.asarray(X, dtype=float)
    Y = np.asarray(Y, dtype=float)
    land = np.zeros(X.shape)
    lag = np.zeros(X.shape)
    shelf = np.zeros(X.shape)
    if 'island' in parts:
        h = _boxed(X, Y, island_h, ISLAND_C, 78.0, -10.0)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
        shelf = np.maximum(shelf, np.clip((h + 4.0) / 4.0, 0, 1))
    if 'atoll' in parts:
        h = _boxed(X, Y, lambda x, y: atoll_h(x, y)[0], ATOLL_C, 118.0, -10.0)
        lg = _boxed(X, Y, lambda x, y: atoll_h(x, y)[1], ATOLL_C, 118.0, 0.0)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
        shelf = np.maximum(shelf, np.clip((h + 4.5) / 4.5, 0, 1) * 0.8)
        lag = np.maximum(lag, lg)
    if 'terraces' in parts:
        h = _boxed(X, Y, lambda x, y: terrace_fields(x, y)[0], TERRACE_C, 128.0, -10.0)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
    if 'arch' in parts:
        for c in arch_feet():
            h = _boxed(X, Y, mound_h, c, 62.0, -10.0)
            land = np.maximum(land, np.clip(h / 0.4, 0, 1))
    if 'falls' in parts:
        h = _boxed(X, Y, heap_h, falls_base_pos(), 58.0, -10.0)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
    return land, lag, shelf


# ================================================================== templates

def _rounded_box(hx, hy, hz, rad, n=8, z0=0.0):
    """Rounded box (half extents) as a quad mesh: verts, faces."""
    g = np.linspace(-1, 1, n + 1)
    verts, faces = [], []
    base = 0
    for axis in range(3):
        for sgn in (-1, 1):
            U, V = np.meshgrid(g, g)
            P = np.zeros(U.shape + (3,))
            o = [a for a in range(3) if a != axis]
            P[..., axis] = sgn
            P[..., o[0]] = U
            P[..., o[1]] = V
            P = P.reshape(-1, 3) * np.array([hx, hy, hz])
            inner = np.array([hx - rad, hy - rad, hz - rad])
            cl = np.clip(P, -inner, inner)
            dvec = P - cl
            nrm = np.linalg.norm(dvec, axis=1, keepdims=True)
            P = cl + dvec / np.maximum(nrm, 1e-9) * rad
            verts.append(P)
            f = grid_faces(n + 1, n + 1)
            if (sgn > 0) != (axis == 1):
                f = f[:, ::-1]
            faces.append(f + base)
            base += len(P)
    V = np.vstack(verts)
    V[:, 2] += hz + z0
    return V, np.vstack(faces)


def padlock_template(open_shackle=False):
    """Padlock about 1 unit tall: rounded brass body, steel-thick shackle, keyway boss."""
    Vb, Fb = _rounded_box(0.31, 0.13, 0.26, 0.07, n=7)
    t = np.linspace(0, 1, 34)
    # U path: up the left leg, over the top, down the right leg
    pts = []
    for s in t:
        if s < 0.3:
            pts.append((-0.19, 0.0, 0.42 + (s / 0.3) * 0.33))
        elif s < 0.7:
            a = np.pi * (1 - (s - 0.3) / 0.4)
            pts.append((0.19 * np.cos(a), 0.0, 0.75 + 0.19 * np.sin(a)))
        else:
            pts.append((0.19, 0.0, 0.75 - ((s - 0.7) / 0.3) * 0.33))
    P = np.array(pts)
    if open_shackle:
        P[:, 2] += 0.14
        ang = math.radians(75)
        pv = np.array([-0.19, 0.0])
        xy = P[:, [0, 1]] - pv
        P[:, 0] = pv[0] + xy[:, 0] * math.cos(ang) - xy[:, 1] * math.sin(ang)
        P[:, 1] = pv[1] + xy[:, 0] * math.sin(ang) + xy[:, 1] * math.cos(ang)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    N1 = np.cross(T, [0, 1, 0]) + np.cross(T, [1e-3, 0, 0])
    N1 /= np.linalg.norm(N1, axis=1, keepdims=True)
    N2 = np.cross(T, N1)
    sides = 12
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = np.cos(ang)[None, :, None] * N1[:, None] + np.sin(ang)[None, :, None] * N2[:, None]
    Vs = (P[:, None] + ring * 0.048).reshape(-1, 3)
    Fs = grid_faces(sides, len(P), wrap_u=True) + len(Vb)
    # keyway boss on the front face
    m = 16
    a = np.linspace(0, 2 * np.pi, m, endpoint=False)
    c = np.array([0.0, 0.132, 0.16])
    rim = np.stack([0.055 * np.cos(a), np.zeros(m), 0.055 * np.sin(a)], axis=1) + c
    top = rim + [0, 0.012, 0]
    hole = np.stack([0.02 * np.cos(a), np.zeros(m), 0.02 * np.sin(a)], axis=1) + c + [0, 0.008, 0]
    base = len(Vb) + len(Vs)
    Vk = np.vstack([rim, top, hole])
    k = np.arange(m)
    Fk = np.vstack([np.stack([k, (k + 1) % m, m + (k + 1) % m, m + k], 1),
                    np.stack([m + k, m + (k + 1) % m, 2 * m + (k + 1) % m, 2 * m + k], 1)]) + base
    V = np.vstack([Vb, Vs, Vk])
    me_obj = np_mesh('PadlockT', V, [Fb, Fs, Fk[:, ::-1]])
    return me_obj


def pine_template(seed=0, whorls=8):
    """Small conifer, 1 unit tall: thin trunk and drooping jagged whorls. Attribute 'tip'."""
    rng = np.random.default_rng(seed)
    verts, faces, tips = [], [], []
    base = 0
    # trunk
    m = 6
    a = np.linspace(0, 2 * np.pi, m, endpoint=False)
    for z0, r0 in ((0.0, 0.025), (0.95, 0.004)):
        verts.append(np.stack([r0 * np.cos(a), r0 * np.sin(a), np.full(m, z0)], 1))
        tips.append(np.zeros(m))
    k = np.arange(m)
    faces.append(np.stack([k, (k + 1) % m, m + (k + 1) % m, m + k], 1))
    base = 2 * m
    for w in range(whorls):
        tz = w / (whorls - 1)
        z = 0.18 + 0.78 * tz
        R = 0.3 * (1 - tz) ** 1.1 + 0.035
        sp = 9
        a = np.linspace(0, 2 * np.pi, sp * 2, endpoint=False) + rng.uniform(0, 1)
        rad = np.where(np.arange(sp * 2) % 2 == 0, R * rng.uniform(0.85, 1.1, sp * 2), R * 0.45)
        droop = np.where(np.arange(sp * 2) % 2 == 0, -0.09 * (1 - tz) - 0.02, -0.01)
        ring = np.stack([rad * np.cos(a), rad * np.sin(a), z + droop], 1)
        hub = np.array([[0.0, 0.0, z + 0.07 * (1 - tz) + 0.02]])
        verts.append(np.vstack([hub, ring]))
        tips.append(np.concatenate([[0.0], np.where(np.arange(sp * 2) % 2 == 0, 1.0, 0.45)]))
        n = sp * 2
        kk = np.arange(n)
        faces.append(np.stack([np.full(n, base), base + 1 + kk, base + 1 + (kk + 1) % n], 1))
        base += n + 1
    obj = np_mesh('PineT', np.vstack(verts), [faces[0], np.vstack(faces[1:])])
    set_attr(obj.data, 'tip', np.concatenate(tips))
    return obj


def palm_template(seed=0):
    """Coconut palm about 1 unit tall: ringed curved trunk, 11 V-folded arching fronds."""
    rng = np.random.default_rng(seed)
    lean = rng.uniform(0.12, 0.3)
    n = 22
    t = np.linspace(0, 1, n)
    trunk = np.stack([lean * t ** 1.6, np.zeros(n), t * 0.88], 1)
    radii = 0.034 * (1 - 0.4 * t) * (1 + 0.08 * (np.sin(t * 90) > 0.6))
    T = np.gradient(trunk, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    N1 = np.cross(T, [0, 1, 0])
    N1 /= np.linalg.norm(N1, axis=1, keepdims=True)
    N2 = np.cross(T, N1)
    sides = 8
    a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = np.cos(a)[None, :, None] * N1[:, None] + np.sin(a)[None, :, None] * N2[:, None]
    Vt = (trunk[:, None] + ring * radii[:, None, None]).reshape(-1, 3)
    Ft = grid_faces(sides, n, wrap_u=True)
    top = trunk[-1]
    verts, faces, tips, mats = [Vt], [Ft], [np.zeros(len(Vt))], [np.zeros(len(Ft), int)]
    base = len(Vt)
    fronds = 11
    for f in range(fronds):
        az = 2 * np.pi * f / fronds + rng.uniform(-0.2, 0.2)
        elev = rng.uniform(0.15, 0.75) if f % 3 else rng.uniform(0.7, 1.1)
        L = rng.uniform(0.42, 0.55)
        seg = 12
        s = np.linspace(0, 1, seg)
        # spine arches up then droops under its own weight
        horiz = L * s
        vert = L * (np.sin(elev) * s - (0.55 + 0.25 * rng.uniform()) * s ** 2)
        d = np.array([np.cos(az), np.sin(az)])
        spine = np.stack([top[0] + d[0] * horiz * np.cos(0.0), top[1] + d[1] * horiz, top[2] + vert], 1)
        side = np.array([-d[1], d[0], 0.0])
        width = 0.13 * np.sin(np.pi * np.clip(s * 1.05, 0, 1)) ** 0.8 * (1 + 0.25 * (np.arange(seg) % 2))
        left = spine + side * width[:, None] + np.array([0, 0, -0.045]) * (width[:, None] / 0.13)
        right = spine - side * width[:, None] + np.array([0, 0, -0.045]) * (width[:, None] / 0.13)
        V = np.vstack([left, spine, right])
        kk = np.arange(seg - 1)
        F = np.vstack([np.stack([kk, kk + 1, seg + kk + 1, seg + kk], 1),
                       np.stack([seg + kk, seg + kk + 1, 2 * seg + kk + 1, 2 * seg + kk], 1)])
        verts.append(V)
        faces.append(F + base)
        tips.append(np.concatenate([s, s * 0.5, s]))
        mats.append(np.ones(len(F), int))
        base += len(V)
    obj = np_mesh('PalmT', np.vstack(verts), [np.vstack(faces)], mat_index=np.concatenate(mats))
    set_attr(obj.data, 'tip', np.concatenate(tips))
    return obj


def shrub_template(seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
    o = bpy.context.object
    V = np.zeros(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get('co', V)
    V = V.reshape(-1, 3)
    n = fbm3(V[:, 0] * 1.3 + seed, V[:, 1] * 1.3, V[:, 2] * 1.3, 2, seed=seed)
    V = V * (1 + 0.35 * n)[:, None]
    V[:, 2] = np.maximum(V[:, 2] * 0.55, -0.1) + 0.1
    o.data.vertices.foreach_set('co', V.ravel())
    set_attr(o.data, 'tip', np.clip(V[:, 2] / 0.6, 0, 1))
    for p in o.data.polygons:
        p.use_smooth = True
    o.name = 'ShrubT'
    return o


def grass_template(seed=0, blades=5):
    """Clump of curved rice-grass blades, 1 unit tall. Attribute 'tip' = height."""
    rng = np.random.default_rng(seed)
    verts, faces, tips = [], [], []
    base = 0
    for b in range(blades):
        az = rng.uniform(0, 2 * np.pi)
        lean = rng.uniform(0.15, 0.5)
        hgt = rng.uniform(0.7, 1.0)
        seg = 4
        s = np.linspace(0, 1, seg + 1)
        d = np.array([np.cos(az), np.sin(az), 0])
        sd = np.array([-np.sin(az), np.cos(az), 0])
        c = d[None] * (lean * s ** 2)[:, None] * hgt + np.array([0, 0, 1])[None] * (hgt * s)[:, None]
        c += d * rng.uniform(0, 0.08)
        w = 0.035 * (1 - s) + 0.002
        V = np.vstack([c + sd * w[:, None], c - sd * w[:, None]])
        kk = np.arange(seg)
        F = np.stack([kk, kk + 1, seg + 1 + kk + 1, seg + 1 + kk], 1) + base
        verts.append(V)
        faces.append(F)
        tips.append(np.concatenate([s, s]))
        base += len(V)
    obj = np_mesh('GrassT', np.vstack(verts), [np.vstack(faces)])
    set_attr(obj.data, 'tip', np.concatenate(tips))
    return obj


# ================================================================== island and box

def build_island(coll, mats):
    obj, X, Y, Z = heightfield('OFF_Island', ISLAND_C.x, ISLAND_C.y, 72.0, 72.0, 0.5,
                               lambda X, Y: island_h(X, Y), coll=coll, mat=mats['stone'])
    return obj


def build_box(coll, state):
    """The meeting room seen from outside: a dark 30 x 6 x 5 m box with a glowing slot skylight."""
    Vb, Fb = _rounded_box(15.0, 3.0, 2.5, 0.12, n=6)
    box = np_mesh('OFF_Box', Vb, Fb, coll=coll, mat=mat_box(), smooth=True)
    yaw = math.atan2(BOX_AXIS.y, BOX_AXIS.x)
    box.matrix_world = Matrix.Translation((ISLAND_C.x, ISLAND_C.y, _BOX_Z - 0.05)) @ Matrix.Rotation(yaw, 4, 'Z')
    # skylight: a stadium inset 1 m wide, 23 m long, in the roof
    out = stadium(48, half_len=10.8, radius=0.7)
    m = len(out)
    V = np.vstack([np.c_[out, np.full(m, 5.0)], np.c_[out * 0.94, np.full(m, 4.86)], [[0, 0, 4.86]]])
    k = np.arange(m)
    F = [np.stack([k, (k + 1) % m, m + (k + 1) % m, m + k], 1)[:, ::-1],
         np.stack([np.full(m, 2 * m), m + k, m + (k + 1) % m], 1)[:, ::-1]]
    sky = np_mesh('OFF_BoxSkylight', V, F, coll=coll, mat=mat_skylight(state))
    sky.parent = box
    sky.location = (0, 0, 0.02)
    sky.active_material.cycles.emission_sampling = 'FRONT'
    return box, sky


# ================================================================== the padlock arch

def _catmull(P, samples=400):
    P = np.asarray(P, dtype=float)
    Q = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    out = []
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        for t in np.linspace(0, 1, samples // (len(P) - 1), endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return np.array(out)


def arch_curve(step=1.0):
    """Arch centreline (world) resampled every `step` metres, with radius per point and t in 0..1."""
    loc = np.array([(-34, 0, -9), (-37, 2, 25), (-35, 1, 60), (-27, -1, 92), (-13, 0, 113), (3, 1, 121),
                    (19, 0, 112), (31, -1, 87), (38, 1, 54), (40, 0, 21), (38, 0, -9)], dtype=float)
    dense = _catmull(loc, 1200)
    seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    ss = np.arange(0, s[-1], step)
    pts = np.stack([np.interp(ss, s, dense[:, i]) for i in range(3)], 1)
    t = ss / s[-1]
    radius = 9.6 + 4.6 * (1 - np.sin(np.pi * t)) ** 1.4
    S, F_, U = np.array(ARCH_SPAN), np.array(ARCH_FACE), np.array([0, 0, 1.0])
    lean = np.tan(np.radians(ARCH_LEAN)) * np.clip(pts[:, 2:3], 0, None)
    world = np.array(ARCH_C)[None, :] + pts[:, :1] * S + (pts[:, 1:2] + lean) * F_ + pts[:, 2:3] * U
    return world, radius, t


def build_arch(coll, mats, seed=5):
    """~600 fused padlocks on a stone core, scree mounds at its feet, pines on the crest."""
    rng = np.random.default_rng(seed)
    out = {}
    P, R, T = arch_curve(1.0)
    world_c = np.array(ARCH_C)

    def core_disp(V, ring):
        n = fbm3(V[..., 0] / 9.0, V[..., 1] / 9.0, V[..., 2] / 9.0, 3, seed=91)
        return ring * (2.6 * n)[..., None]

    core_r = R * (0.68 + 0.2 * smoothstep(0.62, 0.95, P[:, 2] / 121.0))
    out['core'] = tube_along(P, core_r, sides=40, name='OFF_ArchCore', coll=coll, mat=mats['arch_stone'], disp=core_disp)
    # vertebrae: rings of padlocks around the curve, shackles pointing up toward the crest
    Pst, Rst, Tst = arch_curve(5.9)
    tang = np.gradient(Pst, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True)
    crest_i = int(np.argmax(Pst[:, 2]))
    up_dir = np.where((np.arange(len(Pst)) <= crest_i)[:, None], tang, -tang)
    N1 = np.cross(tang, [0, 0, 1.0])
    N1 /= np.maximum(np.linalg.norm(N1, axis=1, keepdims=True), 1e-6)
    N2 = np.cross(tang, N1)
    pts, zax, yax, scl, age, var = [], [], [], [], [], []
    for i in range(len(Pst)):
        for layer, (rf, dens) in enumerate(((0.84, 7.0), (0.46, 15.0))):
            k = max(3, int(round(2 * np.pi * rf * Rst[i] / dens)))
            off = rng.uniform(0, 2 * np.pi)
            for j in range(k):
                a = off + 2 * np.pi * j / k + rng.uniform(-0.2, 0.2)
                radial = np.cos(a) * N1[i] + np.sin(a) * N2[i]
                p = Pst[i] + radial * Rst[i] * rf * rng.uniform(0.9, 1.08) + tang[i] * rng.uniform(-2.0, 2.0)
                if p[2] < -6:
                    continue
                z = up_dir[i] + rng.normal(0, 0.28, 3)
                pts.append(p)
                zax.append(z)
                yax.append(radial + rng.normal(0, 0.2, 3))
                scl.append(rng.uniform(8.0, 14.0) * (0.85 if layer else 1.0))
                hn = np.clip(p[2] / 122.0, 0, 1)
                age.append(np.clip(hn * 1.05 + 0.1 * vnoise3(p[0] / 25, p[1] / 25, p[2] / 25, 7) + rng.uniform(-0.06, 0.06) - 0.03, 0, 1))
                var.append(1 if rng.uniform() < 0.12 else 0)
    Rm = frame_from(np.array(zax), np.array(yax))
    tmpl = template_collection('OFF_PadlockTmpl', [padlock_template(False), padlock_template(True)])
    for o in tmpl.objects:
        o.data.materials.append(mats['padlock'])
        for poly in o.data.polygons:
            poly.use_smooth = True
    out['padlocks'] = instancer('OFF_ArchPadlocks', pts, tmpl, rot=Rm, scl=np.array(scl), var=var,
                                attrs={'age': np.array(age)}, coll=coll)
    out['n_padlocks'] = len(pts)
    # scree mounds and loose padlocks at the feet
    fl, fr = arch_feet()
    mounds = []
    for c, w in ((fl, 62.0), (fr, 48.0)):
        o, X, Y, Z = heightfield('OFF_ArchScree', c.x, c.y, w, w, 0.7, lambda X, Y: mound_h(X, Y), coll=coll, mat=mats['scree'])
        mounds.append(o)
    out['mounds'] = mounds
    sp, sz, sy, ss, sa, sv = [], [], [], [], [], []
    for c, nmax, r0 in ((fl, 190, 44.0), (fr, 70, 32.0)):
        cnt = 0
        while cnt < nmax:
            x, y = c.x + rng.uniform(-r0, r0), c.y + rng.uniform(-r0, r0)
            hz = float(mound_h(np.array([x]), np.array([y]))[0])
            if hz < 0.2:
                continue
            sp.append((x, y, hz - rng.uniform(0.5, 2.5)))
            sz.append(rng.normal(0, 1, 3) + [0, 0, 0.3])
            sy.append(rng.normal(0, 1, 3))
            ss.append(rng.uniform(5.0, 11.5))
            sa.append(rng.uniform(0.0, 0.42) if rng.uniform() < 0.85 else rng.uniform(0.4, 0.75))
            sv.append(int(rng.uniform() < 0.2))
            cnt += 1
    out['scree'] = instancer('OFF_ScreePadlocks', sp, tmpl, rot=frame_from(np.array(sz), np.array(sy)),
                             scl=np.array(ss), var=sv, attrs={'age': np.array(sa)}, coll=coll)
    # pines on the crest: on top of the core, where the arch is old
    pp, ps, pr, pv = [], [], [], []
    for i in range(len(P)):
        if P[i, 2] < 96 or rng.uniform() > 0.42:
            continue
        side = rng.normal(0, 0.45)
        tn = np.gradient(P, axis=0)[i]
        tn /= np.linalg.norm(tn)
        lat = np.cross(tn, [0, 0, 1.0])
        lat /= max(np.linalg.norm(lat), 1e-6)
        q = P[i] + lat * side * core_r[i] * 0.7
        q[2] = P[i, 2] + core_r[i] * math.sqrt(max(0.05, 1 - side * side * 0.5)) * 0.92 - 0.8
        pp.append(q)
        ps.append(rng.uniform(5.5, 13.0))
        pr.append((rng.normal(0, 0.06), rng.normal(0, 0.06), rng.uniform(0, 2 * np.pi)))
        pv.append(int(rng.integers(0, 3)))
    ptm = template_collection('OFF_PineTmpl', [pine_template(s) for s in range(3)])
    for o in ptm.objects:
        o.data.materials.append(mats['pine'])
        o.data.materials.append(mats['bark'])
        for poly in o.data.polygons[:6]:
            poly.material_index = 1                    # the trunk ring
    out['pines'] = instancer('OFF_ArchPines', pp, ptm, rot=np.array(pr), scl=np.array(ps), var=pv, coll=coll)
    out['crest'] = Vector(P[int(np.argmax(P[:, 2]))]) + Vector((0, 0, core_r[int(np.argmax(P[:, 2]))]))
    out['pine_tmpl'] = ptm
    out['padlock_tmpl'] = tmpl
    return out


def hero_padlock_rest():
    """Where the S06 padlock comes to rest: on the big scree slope, toward the S06 camera."""
    fl, _ = arch_feet()
    p = fl + ARCH_FACE * 22.0 + ARCH_SPAN * 10.0
    z = float(mound_h(np.array([p.x]), np.array([p.y]))[0])
    return Vector((p.x, p.y, z + 0.6))


def build_hero_padlock(coll, tmpl_obj=None):
    src = padlock_template(False)
    src.name = 'OFF_HeroPadlock'
    for poly in src.data.polygons:
        poly.use_smooth = True
    src.data.materials.append(mat_padlock(age=0.03))
    for c in src.users_collection:
        c.objects.unlink(src)
    coll.objects.link(src)
    src.scale = (11.0, 11.0, 11.0)
    src.location = hero_padlock_rest()
    src.rotation_euler = (math.radians(84), math.radians(8), math.atan2(ARCH_FACE.y, ARCH_FACE.x) + 0.5)
    C.bevel(src, width=0.004, segments=2, angle=50)
    return src


def build_dust(coll, at):
    """Eight dust-puff cards around a landing spot; key their 'DustAlpha' and scale."""
    mat = mat_dust()
    cards = []
    rng = np.random.default_rng(17)
    for i in range(8):
        V = np.array([[-0.5, 0, 0], [0.5, 0, 0], [0.5, 0, 1], [-0.5, 0, 1]], float)
        uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)
        o = np_mesh(f'OFF_Dust_{i}', V, np.array([[0, 1, 2, 3]]), coll=coll, mat=mat, uv=uv)
        o.location = Vector(at) + Vector((rng.uniform(-4, 4), rng.uniform(-4, 4), -2.0))
        o.rotation_euler = (0, 0, math.atan2(ARCH_FACE.y, ARCH_FACE.x) + math.pi / 2 + rng.uniform(-0.5, 0.5))
        o.scale = (0.01, 0.01, 0.01)
        hide_from(o, camera=True, diffuse=False, glossy=True, transmission=False, shadow=False)
        cards.append(o)
    return cards, mat


def animate_hero_padlock(h, f_start=529, f_land=553, f_bounce=566, f_settle=578, start=None):
    """Keyframe the S06 hero padlock: tumbling fall out of the slot-sun, one bounce, slide, settle.

    It falls along the line of sight from the S06 camera to the slot (so it
    reads as dropping out of the sun), flashing as it turns, lands on the
    scree, hops once and slides to its rest pose. A dust puff fires on landing.
    """
    hp = h['objects']['hero_padlock']
    rest = hero_padlock_rest()
    rest_rot = hp.rotation_euler.copy()
    if start is None:
        view = (SLOT_C - CAM_S06).normalized()
        start = CAM_S06 + view * ((SLOT_C - CAM_S06).length * 0.62)
    start = Vector(start)
    land = rest + ARCH_SPAN * -6.0 + ARCH_FACE * -5.0 + Vector((0, 0, 1.0))
    n = f_land - f_start
    for i in range(n + 1):
        f = f_start + i
        t = i / n
        e = t * t                                     # accelerating fall
        pos = start.lerp(land, e)
        hp.location = pos
        hp.rotation_euler = (rest_rot.x + 4.2 * math.pi * (1 - (1 - t) ** 1.5), rest_rot.y + 0.9 * t, rest_rot.z - 1.3 * t)
        hp.keyframe_insert('location', frame=f)
        hp.keyframe_insert('rotation_euler', frame=f)
    land_rot = hp.rotation_euler.copy()
    # one bounce: a 9 m hop toward the rest pose, then slide and settle
    for i in range(1, f_bounce - f_land + 1):
        t = i / (f_bounce - f_land)
        pos = land.lerp(rest + ARCH_SPAN * -2.0, t)
        pos.z += 9.0 * 4 * t * (1 - t)
        hp.location = pos
        hp.rotation_euler = land_rot.copy()
        hp.rotation_euler.x += (rest_rot.x - land_rot.x) * t * 0.7
        hp.rotation_euler.z += (rest_rot.z - land_rot.z) * t * 0.7
        hp.keyframe_insert('location', frame=f_land + i)
        hp.keyframe_insert('rotation_euler', frame=f_land + i)
    for i in range(1, f_settle - f_bounce + 1):
        t = C.ease(i / (f_settle - f_bounce), 'out')
        hp.location = (rest + ARCH_SPAN * -2.0).lerp(rest, t)
        r0 = Vector(land_rot) + (Vector(rest_rot) - Vector(land_rot)) * 0.7
        hp.rotation_euler = Vector(r0).lerp(Vector(rest_rot), t)
        hp.keyframe_insert('location', frame=f_bounce + i)
        hp.keyframe_insert('rotation_euler', frame=f_bounce + i)
    for fc in C.fcurves(hp.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    cards = h['objects'].get('dust')
    if cards:
        mat = h['mats']['dust']
        node = mat.node_tree.nodes['DustAlpha']
        key_value(node, f_land - 1, 0.0)
        key_value(node, f_land + 2, 0.9, 'BEZIER')
        key_value(node, f_land + 30, 0.0, 'BEZIER')
        rng = np.random.default_rng(23)
        for o in cards:
            o.location = land + Vector((rng.uniform(-6, 6), rng.uniform(-6, 6), -3.0))
            o.scale = (0.2, 0.2, 0.2)
            o.keyframe_insert('scale', frame=f_land)
            s = rng.uniform(16, 30)
            o.scale = (s, s, s * rng.uniform(0.5, 0.8))
            o.keyframe_insert('scale', frame=f_land + 30)
            o.keyframe_insert('location', frame=f_land)
            o.location = o.location + Vector((rng.uniform(-6, 6), rng.uniform(-6, 6), 4.0))
            o.keyframe_insert('location', frame=f_land + 30)


# ================================================================== atoll

def build_atoll(coll, mats, seed=7):
    rng = np.random.default_rng(seed)
    out = {}
    obj, X, Y, Z = heightfield('OFF_Atoll', ATOLL_C.x, ATOLL_C.y, 112.0, 112.0, 0.7,
                               lambda X, Y: atoll_h(X, Y)[0], coll=coll, mat=mats['sand'])
    out['ground'] = obj
    land = Z > 1.3
    ys, xs = np.nonzero(land)
    idx = rng.choice(len(xs), size=min(420, len(xs)), replace=False)
    pts, rot, scl, var = [], [], [], []
    for i in idx:
        x, y, z = X[ys[i], xs[i]], Y[ys[i], xs[i]], Z[ys[i], xs[i]]
        x += rng.uniform(-0.3, 0.3)
        out_dir = math.atan2(y - ATOLL_C.y, x - ATOLL_C.x)
        pts.append((x, y, z - 0.3))
        rot.append((0.0, 0.0, out_dir + rng.normal(0, 0.7)))
        scl.append(rng.uniform(11.0, 17.5))
        var.append(int(rng.integers(0, 3)))
    ptm = template_collection('OFF_PalmTmpl', [palm_template(s) for s in range(3)])
    for o in ptm.objects:
        o.data.materials.append(mats['bark_palm'])
        o.data.materials.append(mats['frond'])
    out['palms'] = instancer('OFF_Palms', pts, ptm, rot=np.array(rot), scl=np.array(scl), var=var, coll=coll)
    land2 = Z > 1.0
    ys, xs = np.nonzero(land2)
    idx = rng.choice(len(xs), size=min(650, len(xs)), replace=False)
    sp = np.stack([X[ys[idx], xs[idx]], Y[ys[idx], xs[idx]], Z[ys[idx], xs[idx]] - 0.2], 1)
    stm = template_collection('OFF_ShrubTmpl', [shrub_template(s) for s in range(2)])
    for o in stm.objects:
        o.data.materials.append(mats['shrub'])
    out['shrubs'] = instancer('OFF_Shrubs', sp, stm, rot=np.c_[np.zeros((len(sp), 2)), rng.uniform(0, 6.3, len(sp))],
                              scl=np.c_[rng.uniform(1.6, 4.2, (len(sp), 2)), rng.uniform(1.2, 2.6, len(sp))],
                              var=rng.integers(0, 2, len(sp)), coll=coll)
    return out


# ================================================================== terraces

def build_terraces(coll, mats, seed=9, grass_count=52000):
    rng = np.random.default_rng(seed)
    out = {}
    step = 0.5
    hw, hh = 120.0, 112.0
    xs = np.arange(-hw, hw + 1e-6, step) + TERRACE_C.x
    ys = np.arange(-hh, hh + 1e-6, step) + TERRACE_C.y
    X, Y = np.meshgrid(xs, ys)
    Hh, E, LV, FR, W = terrace_fields(X, Y)
    grass = np.where(E < 0.0, 1.0, np.where((FR < 0.075) | (FR > 0.83), 1.0, 0.0))
    grass = np.where(Hh < 0.4, 0.0, grass)
    V = np.stack([X, Y, Hh], -1).reshape(-1, 3)
    F = grid_faces(len(xs), len(ys))
    ground = np_mesh('OFF_Terraces', V, F, coll=coll, mat=mats['terrace_ground'])
    set_attr(ground.data, 'grass', grass.ravel())
    out['ground'] = ground
    # water mirrors: one flat face per grid cell inside a paddy, at that paddy's water level
    nx = len(xs)
    cell_e = E[:-1, :-1]
    cell_fr = FR[:-1, :-1]
    inside = (cell_e > 0.0) & (cell_fr < 0.9)
    jj, ii = np.nonzero(inside)
    wz = W[:-1, :-1][jj, ii]
    a = np.stack([X[jj, ii], Y[jj, ii], wz], 1)
    b = np.stack([X[jj, ii + 1], Y[jj, ii + 1], wz], 1)
    c = np.stack([X[jj + 1, ii + 1], Y[jj + 1, ii + 1], wz], 1)
    d = np.stack([X[jj + 1, ii], Y[jj + 1, ii], wz], 1)
    Vw = np.stack([a, b, c, d], 1).reshape(-1, 3)
    Fw = np.arange(len(Vw)).reshape(-1, 4)
    water = np_mesh('OFF_Paddies', Vw, Fw, coll=coll, mat=mats['paddy'], smooth=False)
    out['water'] = water
    # rice grass on bunds, risers and the skirt
    gy, gx = np.nonzero(grass[:-1, :-1] > 0.5)
    pick = rng.choice(len(gx), size=min(grass_count, len(gx)), replace=len(gx) < grass_count)
    jx = rng.uniform(0, step, len(pick))
    jy = rng.uniform(0, step, len(pick))
    px = X[gy[pick], gx[pick]] + jx
    py = Y[gy[pick], gx[pick]] + jy
    pz = terrace_fields(px, py)[0] - 0.05
    gtm = template_collection('OFF_GrassTmpl', [grass_template(s) for s in range(3)])
    for o in gtm.objects:
        o.data.materials.append(mats['grass'])
    out['grass'] = instancer('OFF_RiceGrass', np.stack([px, py, pz], 1), gtm,
                             rot=np.c_[rng.normal(0, 0.08, (len(px), 2)), rng.uniform(0, 6.3, len(px))],
                             scl=rng.uniform(0.9, 1.7, len(px)), var=rng.integers(0, 3, len(px)), coll=coll)
    # a few pines on the summit level
    top = np.nonzero((E > 6.15 / 7.0) & (FR > 0.1) & (FR < 0.75))
    if len(top[0]):
        sel = rng.choice(len(top[0]), size=min(9, len(top[0])), replace=False)
        tp = np.stack([X[top][sel], Y[top][sel], Hh[top][sel] - 0.2], 1)
        out['summit_pines'] = instancer('OFF_SummitPines', tp, bpy.data.collections['OFF_PineTmpl'] if 'OFF_PineTmpl' in bpy.data.collections else
                                        template_collection('OFF_PineTmpl', [pine_template(s) for s in range(3)]),
                                        rot=np.c_[np.zeros((len(tp), 2)), rng.uniform(0, 6.3, len(tp))],
                                        scl=rng.uniform(7, 12, len(tp)), var=rng.integers(0, 3, len(tp)), coll=coll)
    out['levels'] = [(float(TERRACE_BASE + TERRACE_STEP * k + 0.45)) for k in range(7)]
    return out


# ================================================================== paper falls

def _rodrigues(axis, ang):
    """(n,3) unit axes, (n,) angles -> (n,3,3) rotation matrices."""
    a = axis
    c, s = np.cos(ang), np.sin(ang)
    x, y, z = a[:, 0], a[:, 1], a[:, 2]
    R = np.empty((len(a), 3, 3))
    R[:, 0, 0] = c + x * x * (1 - c); R[:, 0, 1] = x * y * (1 - c) - z * s; R[:, 0, 2] = x * z * (1 - c) + y * s
    R[:, 1, 0] = y * x * (1 - c) + z * s; R[:, 1, 1] = c + y * y * (1 - c); R[:, 1, 2] = y * z * (1 - c) - x * s
    R[:, 2, 0] = z * x * (1 - c) - y * s; R[:, 2, 1] = z * y * (1 - c) + x * s; R[:, 2, 2] = c + z * z * (1 - c)
    return R


FALLS_CYCLE = 8.6
SHEET_QUAD = np.array([[-1.6, -1.13, 0], [1.6, -1.13, 0], [1.6, 1.13, 0], [-1.6, 1.13, 0]])   # A4 proportions, ~3 m


def falls_positions(n, frames, seed=21, night=False):
    """Closed-form ballistic stream of n looping sheets; returns (len(frames), n*4, 3) float32.

    Each sheet slides off the ledge lip, carries outward with drag, falls toward
    a 68 m/s terminal speed, fans out with curl-like flutter that grows with the
    drop, and tumbles about its own axis. Sheets that reach the heap collapse to
    a point inside the mist (they are recycled on the loop).
    """
    rng = np.random.default_rng(seed)
    az = math.radians(FALLS_AZ)
    radial = np.array([math.cos(az), math.sin(az), 0.0])
    inward = -radial
    tang = np.array([-math.sin(az), math.cos(az), 0.0])
    lip = np.array(_pol(FALLS_AZ, float(cup_radius(FALLS_Z)) - 27.0, FALLS_Z - 5.0))
    half = 7.0 if night else 40.0
    # rivulets: the sheet-flow breaks into a few lanes of uneven weight, like water over a lip
    lanes = rng.uniform(-half * 0.85, half * 0.85, 7)
    lane_w = rng.uniform(1.5, 6.0, 7)
    pick = rng.choice(7, size=n, p=(lambda w: w / w.sum())(rng.uniform(0.4, 1.0, 7)))
    u0 = np.where(rng.uniform(size=n) < 0.8, lanes[pick] + rng.normal(0, 1, n) * lane_w[pick],
                  rng.uniform(-half, half, n))
    v0 = rng.uniform(5.0, 13.0, n)
    vz = rng.uniform(-3.0, 0.5, n)
    phase = rng.uniform(0, FALLS_CYCLE, n)
    amp = np.clip(rng.lognormal(-0.9, 0.7, n), 0.08, 2.2)        # most sheets ride the core, a few fly wide
    w = rng.uniform(0.8, 2.6, (n, 3))
    ph = rng.uniform(0, 2 * np.pi, (n, 3))
    ax = rng.normal(0, 1, (n, 3))
    ax /= np.linalg.norm(ax, axis=1, keepdims=True)
    spin = rng.uniform(2.0, 8.0, n) * np.where(rng.uniform(size=n) < 0.5, -1, 1)
    sz = rng.uniform(0.85, 1.15, n)
    quad = SHEET_QUAD
    vt, tz, th = 68.0, 2.4, 2.6
    out = np.empty((len(frames), n * 4, 3), np.float32)
    heap = np.array(falls_base_pos()) + np.array([0, 0, 2.0])
    base_rot = frame_from(np.tile([0, 0, 1.0], (n, 1)), np.tile(inward, (n, 1)))
    for fi, f in enumerate(frames):
        t = np.mod(f / 24.0 + phase, FALLS_CYCLE)
        drop = vt * (t - tz * (1 - np.exp(-t / tz))) - vz * t
        out_d = v0 * th * (1 - np.exp(-t / th))
        A = (0.4 + 0.075 * drop) * amp
        lat = u0 * (1 + 0.0025 * drop) + A * (np.sin(w[:, 0] * t + ph[:, 0]) + 0.5 * np.sin(2.3 * w[:, 1] * t + ph[:, 1]))
        rad = out_d + 0.6 * A * np.sin(w[:, 2] * t + ph[:, 2])
        pos = lip[None] + inward[None] * rad[:, None] + tang[None] * lat[:, None]
        pos[:, 2] = lip[2] - drop
        ang = spin * np.maximum(t - 0.25, 0) ** 1.15
        R = _rodrigues(ax, ang) @ base_rot
        corners = np.einsum('nij,kj->nki', R, quad) * sz[:, None, None]
        dead = pos[:, 2] < 3.0
        corners[dead] = 0.0
        pos[dead] = heap
        out[fi] = (corners + pos[:, None, :]).reshape(-1, 3)
    return out


def build_falls(coll, mats, state, frames, cache_dir, seed=21):
    """The binder's pages: ledge, falling sheets (PC2), heap of sheets, spray cards."""
    out = {}
    az = math.radians(FALLS_AZ)
    radial = Vector((math.cos(az), math.sin(az), 0))
    tang = Vector((-math.sin(az), math.cos(az), 0))
    # ledge: a drooping paper shelf with a torn lip
    ws = np.linspace(-36, 36, 73)
    ds = np.linspace(-6, 30, 37)
    W, D = np.meshgrid(ws, ds)
    rw = float(cup_radius(FALLS_Z))
    lipn = 2.5 * fbm2(W / 6.0, 0.0 * W, 2, seed=29)
    D2 = np.minimum(D, 28.0 + lipn - 6.0 * (np.abs(W) / 36.0) ** 2)
    Zl = FALLS_Z - 0.17 * np.clip(D2, 0, None) - 0.004 * W ** 2 + 0.6 * fbm2(W / 5.0, D2 / 5.0, 2, seed=28)
    P = (np.array(radial)[None, None] * (rw - D2)[..., None] + np.array(tang)[None, None] * W[..., None])
    V = np.dstack([P[..., 0], P[..., 1], Zl]).reshape(-1, 3)
    ledge = np_mesh('OFF_FallsLedge', V, grid_faces(len(ws), len(ds))[:, ::-1], coll=coll, mat=mats['sheet'])
    sol = ledge.modifiers.new('Thick', 'SOLIDIFY')
    sol.thickness = 2.6
    out['ledge'] = ledge
    # falling sheets
    n = 500 if state == 'night' else 24000
    a, b = frames
    fr = list(range(a - 2, b + 3))
    # closed form and cheap: always rebuilt, so parameter changes can never meet a stale cache
    path = os.path.join(cache_dir, f'falls_{state}_{n}_{seed}_{fr[0]}_{fr[-1]}.pc2')
    PC.write_pc2(path, falls_positions(n, fr, seed, night=(state == 'night')), start=fr[0])
    quad = SHEET_QUAD
    Vt = np.tile(quad, (n, 1)) + np.repeat(np.array(_pol(FALLS_AZ, rw, FALLS_Z))[None], n * 4, 0)
    Ft = np.arange(n * 4).reshape(-1, 4)
    sheets = np_mesh('OFF_FallsSheets', Vt, Ft, coll=coll, mat=mats['sheet_falls'], smooth=False)
    tint = np.repeat(np.random.default_rng(seed + 1).uniform(0, 1, n), 4)
    set_attr(sheets.data, 'tint', tint)
    PC.attach_pc2(sheets, path, fr[0])
    out['sheets'] = sheets
    # heap at the base: a white mound under a few thousand resting sheets
    c = falls_base_pos()
    hob, X, Y, Z = heightfield('OFF_FallsHeapMound', c.x, c.y, 50.0, 50.0, 1.0, lambda X, Y: heap_h(X, Y),
                               coll=coll, mat=mats['sheet'])
    out['heap_mound'] = hob
    rng = np.random.default_rng(seed + 2)
    m = 3200
    hx = c.x + rng.normal(0, 17, m)
    hy = c.y + rng.normal(0, 17, m)
    hz = heap_h(hx, hy) + 0.15
    keep = hz > -0.5
    hx, hy, hz = hx[keep], hy[keep], hz[keep]
    k = len(hx)
    nrm = np.c_[rng.normal(0, 0.45, (k, 2)), np.ones(k)]
    R = frame_from(nrm, rng.normal(0, 1, (k, 3)))
    corners = np.einsum('nij,kj->nki', R, quad * 1.0) + np.stack([hx, hy, hz], 1)[:, None]
    heap = np_mesh('OFF_FallsHeap', corners.reshape(-1, 3), np.arange(k * 4).reshape(-1, 4), coll=coll,
                   mat=mats['sheet'], smooth=False)
    set_attr(heap.data, 'tint', np.repeat(rng.uniform(0, 1, k), 4))
    out['heap'] = heap
    # spray: soft cards at the base, square to the cup centre
    mist = mat_mist('OFF_FallsMist', 0.45 if state == 'day' else 0.08)
    cards = []
    for i in range(9):
        wv = rng.uniform(55, 110)
        hv = rng.uniform(35, 80)
        Vc = np.array([[-wv / 2, 0, 0], [wv / 2, 0, 0], [wv / 2, 0, hv], [-wv / 2, 0, hv]])
        uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)
        o = np_mesh(f'OFF_FallsMist_{i}', Vc, np.array([[0, 1, 2, 3]]), coll=coll, mat=mist, uv=uv)
        o.location = c - radial * rng.uniform(0, 45) + tang * rng.uniform(-35, 35) + Vector((0, 0, rng.uniform(-6, 18 + 30 * (i > 6))))
        o.rotation_euler = (0, 0, math.atan2(radial.y, radial.x) + math.pi / 2 + rng.uniform(-0.6, 0.6))
        hide_from(o, camera=True, diffuse=False, glossy=True, transmission=True, shadow=False)
        cards.append(o)
    out['mist'] = cards
    return out


# ================================================================== origami birds

# 7-vertex origami bird: keel, head, tail, shoulders, wing tips (+Y forward, +Z up, ~6 m span)
BIRD = np.array([[0.0, 0.0, -0.35], [0.0, 2.7, 0.35], [0.0, -2.5, 0.25], [0.55, 0.9, 0.0], [-0.55, 0.9, 0.0],
                 [3.0, -0.7, 0.3], [-3.0, -0.7, 0.3]])
BIRD_F = np.array([[0, 1, 3], [0, 3, 5], [0, 5, 2], [0, 2, 6], [0, 6, 4], [0, 4, 1]])
BIRD_ROOST = np.array([[0.0, 0.0, -0.35], [0.0, 2.2, 0.75], [0.0, -2.3, 0.15], [0.45, 0.6, 0.1], [-0.45, 0.6, 0.1],
                       [0.9, -1.4, 1.5], [-0.9, -1.4, 1.5]])
ENVELOPE = np.array([[0.0, 0.0, 0.22], [0.0, 1.55, 0.05], [0.0, -1.55, 0.05], [2.2, 1.55, 0.0], [-2.2, 1.55, 0.0],
                     [2.2, -1.55, 0.0], [-2.2, -1.55, 0.0]])


def bird_shape(flap):
    """(n,) flap angles -> (n,7,3) bird vertices with wings rotated about the body axis."""
    n = len(flap)
    V = np.repeat(BIRD[None], n, 0).copy()
    for tip, sgn in ((5, 1), (6, -1)):
        x = BIRD[tip, 0]
        V[:, tip, 0] = sgn * abs(x) * np.cos(flap)
        V[:, tip, 2] = BIRD[tip, 2] + abs(x) * np.sin(flap)
    for sh, sgn in ((3, 1), (4, -1)):
        V[:, sh, 2] = BIRD[sh, 2] + 0.25 * np.sin(flap)
    return V


def _knn(P, k=7, chunk=500):
    """Indices of the k nearest neighbours of every point (brute force, chunked, float32)."""
    n = len(P)
    idx = np.empty((n, k), np.int64)
    sq = (P * P).sum(1)
    for s in range(0, n, chunk):
        e = min(n, s + chunk)
        d2 = sq[s:e, None] + sq[None, :] - 2.0 * (P[s:e] @ P.T)
        d2[np.arange(e - s), np.arange(s, e)] = np.inf
        idx[s:e] = np.argpartition(d2, k, axis=1)[:, :k]
    return idx


FLOCK_WINDOW = (640, 900)


def flock_target(t):
    """Moving attractor (world) for the murmuration, t in seconds of film time.

    During S08 (31.4-34.7 s) it sweeps across the bright north-west cliff, above
    the arch as seen from the poster camera, so the birds read dark on the glow.
    """
    u = min(1.5, max(-0.2, (t - 31.4) / 3.3))
    a = np.array([-255.0, -50.0, 240.0])
    b = np.array([-185.0, 115.0, 300.0])
    wob = np.array([25 * math.sin(2.1 * t), 25 * math.cos(1.7 * t), 18 * math.sin(2.9 * t)])
    return a + (b - a) * u + wob


def simulate_flock(n, f0=FLOCK_WINDOW[0], f1=FLOCK_WINDOW[1], seed=31, cache_dir=CACHE_DIR):
    """Boids (each bird follows its 7 nearest neighbours), cached to .npz.

    Alignment and cohesion over the 7 nearest (topological, as starlings do),
    short-range separation, a moving attractor, a sweeping 'predator' that sends
    waves through the flock, and soft containment inside the cup. Two substeps
    per frame; neighbours are refreshed every substep pair. Returns positions
    and velocities, both (frames, n, 3) float32, for film frames f0..f1.
    """
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f'flock_v3_{n}_{seed}_{f0}_{f1}.npz')
    if os.path.exists(path):
        d = np.load(path)
        return d['P'], d['V']
    rng = np.random.default_rng(seed)
    c = flock_target(f0 / 24.0)
    P = (c + rng.normal(0, 1, (n, 3)) * np.array([80.0, 40.0, 22.0])).astype(np.float32)
    Vv = (np.tile([12.0, 36.0, 4.0], (n, 1)) + rng.normal(0, 4, (n, 3))).astype(np.float32)
    frames = f1 - f0 + 1
    out_p = np.empty((frames, n, 3), np.float32)
    out_v = np.empty((frames, n, 3), np.float32)
    dt = 1.0 / 48.0
    for fi in range(frames):
        idx = _knn(P)
        for sub in range(2):
            t = (f0 + fi + sub * 0.5) / 24.0
            nbp = P[idx]
            mp = nbp.mean(1)
            mv = Vv[idx].mean(1)
            dv = P[:, None, :] - nbp
            dd = np.maximum(np.linalg.norm(dv, axis=-1, keepdims=True), 0.5)
            sep = (dv / dd ** 2 * (dd < 9.0)).sum(1)
            acc = 2.4 * (mv - Vv) + 0.55 * (mp - P) + 120.0 * sep
            tgt = flock_target(t)
            acc += 0.11 * (tgt - P)
            pr = tgt + np.array([110 * math.sin(t * 2.1), 70 * math.cos(t * 1.7), 25 * math.sin(t * 2.9)])
            dp = P - pr
            dpl = np.maximum(np.linalg.norm(dp, axis=1, keepdims=True), 1.0)
            acc += 2.2e4 * dp / dpl ** 3 * (dpl < 70)
            r = np.hypot(P[:, 0], P[:, 1])
            lim = cup_radius(P[:, 2]) - 45.0
            push = np.clip(r - lim, 0, None)
            acc[:, :2] -= (P[:, :2] / np.maximum(r, 1)[:, None]) * push[:, None] * 3.0
            acc[:, 2] += np.clip(140.0 - P[:, 2], 0, None) * 2.0 - np.clip(P[:, 2] - 520.0, 0, None) * 2.0
            Vv = Vv + (acc * dt).astype(np.float32)
            sp = np.linalg.norm(Vv, axis=1, keepdims=True)
            Vv = (Vv / sp * np.clip(sp, 30.0, 52.0)).astype(np.float32)
            P = P + Vv * dt
        out_p[fi] = P
        out_v[fi] = Vv
    np.savez(path, P=out_p, V=out_v)
    return out_p, out_v


def bird_frames(P, Vv, seed=33, template_flap=True):
    """Per-frame bird vertices (frames, n*7, 3) oriented along velocity, banked into turns, flapping."""
    rng = np.random.default_rng(seed)
    F_, n, _ = P.shape
    freq = rng.uniform(2.2, 3.4, n)
    ph = rng.uniform(0, 2 * np.pi, n)
    out = np.empty((F_, n * 7, 3), np.float32)
    for fi in range(F_):
        v = Vv[fi]
        acc = (Vv[min(fi + 1, F_ - 1)] - Vv[max(fi - 1, 0)]) * 12.0
        fwd = v / np.linalg.norm(v, axis=1, keepdims=True)
        lat = np.cross(fwd, [0, 0, 1.0])
        lat /= np.maximum(np.linalg.norm(lat, axis=1, keepdims=True), 1e-6)
        bank = np.clip((acc * lat).sum(1) / 25.0, -0.9, 0.9)
        up = np.array([0, 0, 1.0])[None] * np.cos(bank)[:, None] - lat * np.sin(bank)[:, None]
        up = up - fwd * (up * fwd).sum(1, keepdims=True)          # keep pitch: up square to the flight line
        R = frame_from(up, fwd)                                     # z = up, y = forward, x = right wing
        flap = 0.55 * np.sin(2 * np.pi * freq * (fi / 24.0) + ph) + 0.12
        shape = bird_shape(flap)
        out[fi] = (np.einsum('nij,nkj->nki', R, shape) + P[fi][:, None, :]).reshape(-1, 3)
    return out


def build_murmuration(coll, mat, frames, cache_dir, n=4000, seed=31):
    a, b = frames
    f0 = min(FLOCK_WINDOW[0], a - 62)
    f1 = max(FLOCK_WINDOW[1], b + 3)
    P, Vv = simulate_flock(n, f0, f1, seed, cache_dir)
    fr0 = a - 2
    f1 = b + 2
    sl = slice(fr0 - f0, f1 - f0 + 1)
    pos = bird_frames(P[sl], Vv[sl], seed + 2)
    path = os.path.join(cache_dir, f'birds_{n}_{seed}_{fr0}_{f1}.pc2')
    PC.write_pc2(path, pos, start=fr0)
    V0 = pos[0]
    F = (BIRD_F[None] + 7 * np.arange(n)[:, None, None]).reshape(-1, 3)
    obj = np_mesh('OFF_Murmuration', V0, F, coll=coll, mat=mat, smooth=False)
    PC.attach_pc2(obj, path, fr0)
    return obj, (P, Vv, f0)


def build_roost(coll, mat, seed=41, n=260):
    """Night: origami birds roosting along the arch crest, wings folded."""
    rng = np.random.default_rng(seed)
    P, R, T = arch_curve(0.7)
    top = np.nonzero(P[:, 2] > 92)[0]
    pick = rng.choice(top, size=n, replace=True)
    core = R * (0.68 + 0.2 * smoothstep(0.62, 0.95, P[:, 2] / 121.0))
    tn = np.gradient(P, axis=0)
    tn /= np.linalg.norm(tn, axis=1, keepdims=True)
    pts = P[pick] + np.c_[rng.normal(0, 3.0, (n, 2)), np.zeros(n)]
    pts[:, 2] = P[pick, 2] + core[pick] * 0.95 + rng.uniform(1.0, 3.0, n)
    fwd = tn[pick] * np.where(rng.uniform(size=n) < 0.5, 1, -1)[:, None] + rng.normal(0, 0.4, (n, 3))
    fwd[:, 2] = 0
    Rm = frame_from(np.tile([0, 0, 1.0], (n, 1)), fwd)
    s = rng.uniform(0.8, 1.1, n)
    V = (np.einsum('nij,kj->nki', Rm, BIRD_ROOST) * s[:, None, None] + pts[:, None]).reshape(-1, 3)
    F = (BIRD_F[None] + 7 * np.arange(n)[:, None, None]).reshape(-1, 3)
    return np_mesh('OFF_Roost', V, F, coll=coll, mat=mat, smooth=False)


def build_hero_envelope(coll, frames, cache_dir, flock=None, f_fall=753, f_unfold0=768, f_unfold1=790,
                        start=None, unfold_at=None, seed=55):
    """One envelope tumbles down the shaft, unfolds into a bird and joins the flock (PC2).

    Vertices 0-6 morph ENVELOPE -> BIRD (flapping once unfolded); vertices 7-10
    are the small cobalt square seal, which shrinks into the keel as it opens.
    """
    a, b = frames
    fr = list(range(a - 2, b + 3))
    if start is None:
        start = SLOT_C + SHAFT_DIR * 260.0
    start = Vector(start)
    if unfold_at is None:
        unfold_at = SLOT_C + SHAFT_DIR * 470.0 + Vector((0, 0, 0))
    unfold_at = Vector(unfold_at)
    seal = np.array([[-0.35, -0.35, 0.25], [0.35, -0.35, 0.25], [0.35, 0.35, 0.25], [-0.35, 0.35, 0.25]])
    pos = np.empty((len(fr), 11, 3), np.float32)
    jP = jV = None
    if flock is not None:
        jP, jV, jf0 = flock
    for i, f in enumerate(fr):
        u = np.clip((f - f_unfold0) / max(1, f_unfold1 - f_unfold0), 0, 1)
        u = u * u * (3 - 2 * u)
        flap = 0.55 * math.sin(2 * math.pi * 2.6 * (f / 24.0)) + 0.12
        shape = (1 - u) * ENVELOPE + u * bird_shape(np.array([flap * u]))[0]
        sl = seal * (1 - u) + ENVELOPE[0] * u * 0 + np.array([0, 0, 0.0])
        sl[:, 2] = (1 - u) * 0.25 + u * (-0.3)
        sl = sl * (1 - 0.95 * u) + BIRD[0] * 0.95 * u
        loc = np.concatenate([shape, sl], 0)
        if f <= f_unfold0:
            t = np.clip((f - f_fall) / max(1, f_unfold0 - f_fall), 0, 1)
            p = start.lerp(unfold_at, t * t * 0.4 + t * 0.6)
            R = np.array(Matrix.Rotation(3.4 * t * math.pi, 3, Vector((0.4, 1.0, 0.2)).normalized()))
        else:
            t = (f - f_unfold0) / 24.0
            fwd = Vector((0.85, 0.3, 0.15)).normalized()
            p = unfold_at + fwd * (25.0 * t + 10 * t * t) - Vector((0, 0, 12.0 * math.exp(-t * 2.0) * t))
            if jP is not None and f - jf0 < len(jP):
                w = np.clip((f - (f_unfold1 + 10)) / 40.0, 0, 1)
                tgt = Vector(jP[f - jf0, 0])
                p = p.lerp(tgt, w * w)
            spin = Matrix.Rotation(3.4 * math.pi * (1 - min(1.0, (f - f_unfold0) / 14.0)) * 0.15, 3, 'Y')
            look = fwd.to_track_quat('Y', 'Z').to_matrix()
            R = np.array(look @ spin)
        pos[i] = loc @ R.T + np.array(p)
    path = os.path.join(cache_dir, f'envelope_{fr[0]}_{fr[-1]}_{seed}.pc2')
    PC.write_pc2(path, pos, start=fr[0])
    F = np.vstack([BIRD_F, [[7, 8, 9], [7, 9, 10]]])
    m0, m1 = mat_envelope()
    obj = np_mesh('OFF_HeroEnvelope', pos[0], F, coll=coll, mat=[m0, m1], smooth=False,
                  mat_index=[0] * 6 + [1, 1])
    set_attr(obj.data, 'tint', np.zeros(11))
    PC.attach_pc2(obj, path, fr[0])
    return obj


# ================================================================== fireflies

FIREFLY_COLOURS = ('kevin', 'keys', 'operations', 'people', 'strategy', 'arjun', 'linda', 'synthia')


def firefly_layout(n=1500, seed=61):
    """Home positions over the terraces (and a few along the arch crest pines)."""
    rng = np.random.default_rng(seed)
    pts, ground = [], []
    while len(pts) < n - 140:
        x = TERRACE_C.x + rng.uniform(-115, 115)
        y = TERRACE_C.y + rng.uniform(-105, 105)
        h, e, lv, fr, w = terrace_fields(np.array([x]), np.array([y]))
        if e[0] < -0.12:
            continue
        g = max(float(h[0]), float(w[0]) if e[0] > 0 else 0.0)
        hover = g + rng.uniform(1.5, 4.0) + rng.exponential(5.0)
        pts.append((x, y, hover))
        ground.append(g)
    P, R, T = arch_curve(1.0)
    top = np.nonzero(P[:, 2] > 100)[0]
    for i in rng.choice(top, size=140):
        p = P[i] + np.r_[rng.normal(0, 9, 2), rng.uniform(8, 26)]
        pts.append(tuple(p))
        ground.append(P[i, 2] + 8)
    return np.array(pts), np.array(ground)


def firefly_positions(home, ground, frames, seed=63):
    """Rise from the grass (f1150-1190), then hover and wander. (frames, n, 3)."""
    rng = np.random.default_rng(seed)
    n = len(home)
    t_rise = rng.uniform(1148, 1186, n)
    amp = rng.uniform(1.0, 3.5, (n, 3)) * np.array([1, 1, 0.5])
    w = rng.uniform(0.25, 0.8, (n, 3))
    ph = rng.uniform(0, 2 * np.pi, (n, 3))
    out = np.empty((len(frames), n, 3), np.float32)
    for i, f in enumerate(frames):
        r = smoothstep(0.0, 1.0, (f - t_rise) / 34.0)
        z = ground + 0.5 + (home[:, 2] - ground - 0.5) * r
        t = f / 24.0
        wob = amp * np.sin(w * t + ph)
        out[i] = np.c_[home[:, 0] + wob[:, 0], home[:, 1] + wob[:, 1], z + wob[:, 2]]
    return out


def build_fireflies(coll, frames, cache_dir, n=1500, radius=0.16, grey_near=None, seed=61):
    home, ground = firefly_layout(n, seed)
    n = len(home)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius)
    ico = bpy.context.object
    tv = np.zeros(len(ico.data.vertices) * 3)
    ico.data.vertices.foreach_get('co', tv)
    tv = tv.reshape(-1, 3)
    tf = np.array([list(p.vertices) for p in ico.data.polygons])
    bpy.data.objects.remove(ico)
    k = len(tv)
    rng = np.random.default_rng(seed + 1)
    cols = np.array([srgb(ATTENDEES[c][0]) for c in FIREFLY_COLOURS])
    ci = rng.integers(0, len(FIREFLY_COLOURS), n)
    col = cols[ci]
    grey_i = int(np.argmin(np.linalg.norm(home - np.array(grey_near), axis=1))) if grey_near is not None else 0
    grey = np.zeros(n)
    grey[grey_i] = 1.0
    col[grey_i] = srgb(ATTENDEES['pat'][0])
    a, b = frames
    fr = list(range(a - 2, b + 3))
    P = firefly_positions(home, ground, fr, seed + 2)
    pos = (P[:, :, None, :] + tv[None, None]).reshape(len(fr), n * k, 3)
    path = os.path.join(cache_dir, f'fireflies_{n}_{seed}_{fr[0]}_{fr[-1]}.pc2')
    PC.write_pc2(path, pos, start=fr[0])
    F = (tf[None] + k * np.arange(n)[:, None, None]).reshape(-1, 3)
    obj = np_mesh('OFF_Fireflies', pos[0], F, coll=coll, mat=mat_firefly(), smooth=True)
    me = obj.data
    set_attr(me, 'ff_phase', np.repeat(rng.uniform(0, 1, n), k))
    set_attr(me, 'ff_freq', np.repeat(rng.uniform(-0.18, 0.18, n), k))
    set_attr(me, 'ff_grey', np.repeat(grey, k))
    set_attr(me, 'ff_col', np.c_[np.repeat(col, k, 0), np.ones(n * k)], 'FLOAT_COLOR')
    PC.attach_pc2(obj, path, fr[0])
    mat = obj.active_material
    clock = mat.node_tree.nodes['FireflyClock']
    key_value(clock, 0, 0.0)
    key_value(clock, 2000, 2000.0)
    ad = mat.node_tree.animation_data
    for fc in C.fcurves(ad.action):
        fc.extrapolation = 'LINEAR'
    obj.active_material.cycles.emission_sampling = 'FRONT'
    return obj, home, grey_i


# ================================================================== gravity rig

def build_gravity(coll):
    """Tilt rig. OFF_Gravity rotates (local X) about a horizontal axis through the island,
    raising the sea toward the slot side: the cup is being lifted to his mouth.
    OFF_BeamPivot sits on the slot and copies that rotation, so the sun and shaft
    swing about the hole (the cup and its landforms stay fixed).
    """
    d = (SLOT_C - ISLAND_C).to_2d().normalized()
    yax = Vector((d.x, d.y, 0.0))
    xax = yax.cross(Vector((0, 0, 1)))
    pivot = C.empty('OFF_GravityPivot', coll, location=(ISLAND_C.x, ISLAND_C.y, 0.0), display='SINGLE_ARROW', size=60)
    pivot.rotation_euler = (0, 0, math.atan2(xax.y, xax.x))
    grav = C.empty('OFF_Gravity', coll, display='CIRCLE', size=120)
    grav.parent = pivot
    beam = C.empty('OFF_BeamPivot', coll, location=SLOT_C, display='ARROWS', size=40)
    cr = beam.constraints.new('COPY_ROTATION')
    cr.name = 'FollowGravity'
    cr.target = grav
    cr.mix_mode = 'REPLACE'
    cr.influence = 0.0          # by default the beam stays on the box; key it with set_gravity(beam=...)
    bpy.context.view_layer.update()
    return pivot, grav, beam


def set_gravity(h, frame, degrees, interp='BEZIER', beam=None):
    """Key the world tilt (degrees; 0 = level). S13-S14 ramp 0 -> 4 -> 12.

    beam: optionally key how much the sun/shaft swing about the slot with the tilt
    (0 = the pool stays on the box, 1 = physically correct swing).
    """
    if beam is not None:
        c = h['objects']['beam_pivot'].constraints['FollowGravity']
        c.influence = beam
        c.keyframe_insert('influence', frame=frame)
    g = h['objects']['gravity']
    g.rotation_euler.x = math.radians(degrees)
    g.keyframe_insert('rotation_euler', index=0, frame=frame)
    for fc in C.fcurves(g.animation_data.action):
        for kp in fc.keyframe_points:
            if abs(kp.co.x - frame) < 1e-4:
                kp.interpolation = interp


# ================================================================== assembly

PARTS = ('cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'hero_padlock', 'atoll', 'terraces',
         'falls', 'murmuration', 'hero_envelope', 'fireflies', 'roost', 'blooms', 'gravity')
DEFAULT_PARTS = {
    'day': {'cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'atoll', 'terraces', 'falls',
            'murmuration', 'blooms', 'gravity'},
    'night': {'cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'atoll', 'terraces', 'falls',
              'fireflies', 'roost', 'blooms', 'gravity'},
}


def _mats(state):
    return {
        'stone': mat_stone('OFF_IslandStone', srgb('#4d4741')),
        'arch_stone': mat_stone('OFF_ArchStone', (0.36, 0.35, 0.33), lichen=1.0, wet_line=True),
        'scree': mat_stone('OFF_Scree', (0.3, 0.26, 0.2)),
        'padlock': mat_padlock(),
        'pine': mat_foliage('OFF_Pine', DEEP_GREEN, LIME, trans=0.2),
        'bark': mat_bark('OFF_PineBark'),
        'bark_palm': mat_bark('OFF_PalmBark', (0.2, 0.17, 0.13)),
        'frond': mat_foliage('OFF_Frond', srgb('#1f4a32'), LIME, trans=0.4),
        'shrub': mat_foliage('OFF_Shrub', DEEP_GREEN, srgb('#7fa860'), trans=0.15),
        'sand': mat_sand(),
        'paddy': mat_paddy(),
        'terrace_ground': mat_terrace_ground(),
        'grass': mat_foliage('OFF_Grass', srgb('#2f5a2c'), LIME, trans=0.45),
        'sheet': mat_paper_sheet('OFF_Sheet'),
        'sheet_falls': mat_paper_sheet('OFF_SheetFalls', glow=0.35 if state == 'day' else 0.05),
        'bird': mat_bird(),
        'foam': mat_foam(),
    }


def build_offline(state='day', include=None, frames=None, sea_focus=None, cache_dir=None, blooms=None,
                  grass_count=52000, falls_count=None, flock_count=4000, firefly_count=1500, grey_near=None):
    """Build E1_OFFLINE into the current scene and return a handles dict.

    state: 'day' | 'night'. include: subset of PARTS (default: DEFAULT_PARTS[state]).
    frames: (a, b) film frames to bake crowd caches for (default: the current scene range).
    sea_focus: (x, y) where the sea mesh is densest (put it under the camera).
    blooms: attendee names whose exterior colour bloom is on (default by state).

    Handles: h['objects'][name], h['mats'][name], h['lights'] (sun, ring, top, blooms),
    h['offline'] (= OFFLINE), plus helpers key_slot(), key_bloom(), set_gravity(),
    animate_hero_padlock() that take h.
    """
    assert state in ('day', 'night')
    parts = set(DEFAULT_PARTS[state] if include is None else include)
    sc = bpy.context.scene
    if frames is None:
        frames = (sc.frame_start, sc.frame_end)
    cache_dir = cache_dir or CACHE_DIR
    os.makedirs(cache_dir, exist_ok=True)
    root = C.collection('OFFLINE')
    h = {'state': state, 'parts': parts, 'objects': {}, 'mats': {}, 'lights': {}, 'offline': OFFLINE,
         'nominal': {}, 'frames': frames}
    O = h['objects']
    mats = _mats(state)
    h['mats'].update(mats)

    # the cup world is always there: wall, lid with the slot, sky beyond the slot, lights
    wall_mat = mat_paper_wall()
    h['mats']['wall'] = wall_mat
    O['wall'] = build_cup_wall(root, wall_mat)
    frame, sky = build_slot(root, state)
    O['slot_frame'], O['slot_sky'] = frame, sky
    h['mats']['sky'] = sky.active_material
    h['nominal']['sky'] = sky.active_material.node_tree.nodes['SkyStrength'].outputs[0].default_value
    lid_mat = mat_lid(frame, state)
    h['mats']['lid'] = lid_mat
    O['lid'] = build_lid(root, lid_mat)
    pass_coll = _blockers([O['wall'], O['lid']])
    h['lights'] = build_lights(root, state, pass_coll)
    apply_light_state(h, state, blooms if 'blooms' in parts else ())

    if 'shaft' in parts:
        O['shaft'], length = build_shaft(root, state)
        h['mats']['shaft'] = O['shaft'].active_material
        h['nominal']['shaft'] = h['mats']['shaft'].node_tree.nodes['ShaftStrength'].outputs[0].default_value
    else:
        h['nominal']['shaft'] = 0.0

    if 'island' in parts:
        O['island'] = build_island(root, mats)
    if 'box' in parts:
        O['box'], O['box_skylight'] = build_box(root, state)
        h['mats']['skylight'] = O['box_skylight'].active_material
    if 'arch' in parts:
        arch = build_arch(root, mats)
        O['arch_core'] = arch['core']
        O['arch_padlocks'] = arch['padlocks']
        O['arch_mounds'] = arch['mounds']
        O['scree'] = arch['scree']
        O['arch_pines'] = arch['pines']
        h['n_padlocks'] = arch['n_padlocks']
        OFFLINE['arch_crest'] = tuple(arch['crest'])
    if 'hero_padlock' in parts:
        O['hero_padlock'] = build_hero_padlock(root)
        O['dust'], h['mats']['dust'] = build_dust(root, hero_padlock_rest())
    if 'atoll' in parts:
        at = build_atoll(root, mats)
        O['atoll'], O['palms'], O['shrubs'] = at['ground'], at['palms'], at['shrubs']
    if 'terraces' in parts:
        tr = build_terraces(root, mats, grass_count=grass_count)
        O['terraces'], O['paddies'], O['rice_grass'] = tr['ground'], tr['water'], tr['grass']
        if 'summit_pines' in tr:
            O['summit_pines'] = tr['summit_pines']
        OFFLINE['terrace_water_levels'] = tr['levels']
    if 'sea' in parts:
        box = (-460.0, -460.0, 920.0)
        tag = '-'.join(sorted(p for p in parts if p in ('island', 'atoll', 'terraces', 'arch', 'falls')))
        img = shore_image('OFF_ShoreMap', lambda X, Y: land_masks(X, Y, parts), box[0], box[1], box[2], res=2048,
                          cache_path=os.path.join(cache_dir, f'shore_v1_{tag or "none"}.npy'))
        O['sea'] = build_sea(root, state, sea_focus or (ISLAND_C.x * 0.3, ISLAND_C.y * 0.3), img, box)
        h['mats']['sea'] = O['sea'].active_material
    if 'floes' in parts:
        O['floes'] = build_floes(root, mats['foam'], lambda X, Y: land_masks(X, Y, parts))
    if 'falls' in parts:
        fl = build_falls(root, mats, state, frames, cache_dir)
        O['falls_ledge'], O['falls_sheets'] = fl['ledge'], fl['sheets']
        O['falls_heap'], O['falls_heap_mound'], O['falls_mist'] = fl['heap'], fl['heap_mound'], fl['mist']
    flock = None
    if 'murmuration' in parts:
        O['murmuration'], flock = build_murmuration(root, mats['bird'], frames, cache_dir, n=flock_count)
    if 'hero_envelope' in parts:
        O['hero_envelope'] = build_hero_envelope(root, frames, cache_dir, flock=flock)
    if 'roost' in parts:
        O['roost'] = build_roost(root, mats['bird'])
    if 'fireflies' in parts:
        O['fireflies'], home, gi = build_fireflies(root, frames, cache_dir, n=firefly_count, grey_near=grey_near)
        h['mats']['firefly'] = O['fireflies'].active_material
        h['grey_firefly'] = tuple(home[gi])

    # gravity rig: the loose world tilts, the cup stays
    pivot, grav, beam = build_gravity(root)
    O['gravity_pivot'], O['gravity'], O['beam_pivot'] = pivot, grav, beam
    for name in ('sea', 'floes', 'fireflies', 'falls_sheets', 'murmuration', 'hero_envelope', 'roost'):
        if name in O:
            parent_keep(O[name], grav)
    for name in ('shaft',):
        if name in O:
            parent_keep(O[name], beam)
    parent_keep(h['lights']['sun'], beam)
    return h


def look(state='day'):
    """Compositor settings (common.compositor kwargs) for the state: glare, vignette, aerial mist."""
    if state == 'day':
        return dict(glare=0.32, glare_threshold=1.6, glare_size=8, vignette=0.22,
                    mist=dict(color=(0.5, 0.4, 0.29), start=60.0, depth=1500.0, amount=0.42, falloff='QUADRATIC'))
    return dict(glare=0.55, glare_threshold=0.9, glare_size=7, vignette=0.3,
                mist=dict(color=(0.010, 0.012, 0.017), start=40.0, depth=1300.0, amount=0.35, falloff='QUADRATIC'))


def apply_look(state='day', **over):
    """common.compositor(**look(state)), then set the 4.5 Glare node inputs directly.

    In Blender 4.5 the Glare node's threshold/size/mix moved to input sockets,
    so the legacy attributes common.compositor() sets are ignored; this keeps
    the intended threshold and strength and uses a relative bloom size.
    """
    kw = look(state)
    kw.update(over)
    nt = C.compositor(**kw)
    for n in nt.nodes:
        if n.bl_idname == 'CompositorNodeGlare' and 'Threshold' in n.inputs:
            n.inputs['Threshold'].default_value = kw.get('glare_threshold', 1.0)
            n.inputs['Strength'].default_value = kw.get('glare', 0.3)
            if 'Smoothness' in n.inputs:
                n.inputs['Smoothness'].default_value = 0.35
    return nt


def camera_offline(lens, location, target, fstop=0.0, focus=None, name='Camera', roll=0.0):
    """A camera with the Offline clip range (0.1 m - 6 km)."""
    cam = C.camera(name, lens=lens, location=location, target=target, fstop=fstop, focus=focus,
                   clip=OFFLINE['camera_clip'])
    cam.data.dof.aperture_blades = 0          # round bokeh for the fireflies
    if roll:
        cam.rotation_euler.rotate_axis('Z', math.radians(roll))
    return cam


def slot_match_camera(frac=0.20, aspect=16 / 9, height=1.5, location=None):
    """Camera that frames the slot centred, long axis horizontal, `frac` of the frame width.

    Default: lens 1.5 m above the water on the slot normal (the S01 end
    position), lens length solved for the width. Returns (location, lens).
    """
    loc = Vector(location) if location is not None else CAM_S01.copy()
    if location is None:
        loc.z = height
    dist = (SLOT_C - loc).length
    lens = frac * 36.0 * dist / 135.0
    return loc, lens


def s12_camera():
    """A point 1.5 m above a mid-level terrace mirror on the arch side of the hill."""
    d = (ARCH_C - TERRACE_C).to_2d().normalized()
    for r in np.arange(10.0, 140.0, 0.5):
        x, y = TERRACE_C.x + d.x * r, TERRACE_C.y + d.y * r
        h, e, lv, fr, w = terrace_fields(np.array([x]), np.array([y]))
        if lv[0] == 2 and 0.35 < fr[0] < 0.55:
            return Vector((x, y, float(w[0]) + 1.5))
    return Vector((TERRACE_C.x + d.x * 60, TERRACE_C.y + d.y * 60, 16.0))


def framing(name):
    """Preview/starting camera for a named framing: dict(frame, state, lens, location, target, include, ...)."""
    if name == 's01_glide':
        loc = CAM_S01 - Vector((_u.x, _u.y, 0)) * 7.0
        loc.z = 1.5
        fwd = (ARCH_C - loc).to_2d().normalized()
        yaw_off = math.radians(-5.0)                        # arch slightly right of centre
        fx = fwd.x * math.cos(yaw_off) - fwd.y * math.sin(yaw_off)
        fy = fwd.x * math.sin(yaw_off) + fwd.y * math.cos(yaw_off)
        tgt = loc + Vector((fx, fy, math.tan(math.radians(10.8)))) * 100.0
        return dict(frame=60, state='day', lens=21.0, location=loc, target=tgt, fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'blooms', 'gravity'},
                    blooms=('keys', 'strategy', 'people'), sea_focus=(loc.x, loc.y))
    if name == 's01_slot':
        loc, lens = slot_match_camera()
        return dict(frame=128, state='day', lens=lens, location=loc, target=SLOT_C, fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'island', 'box', 'arch', 'blooms', 'gravity'},
                    blooms=('keys', 'strategy', 'people'), sea_focus=(loc.x, loc.y))
    if name == 's06_arch':
        loc = CAM_S06.copy()
        tgt = SLOT_C.copy()
        return dict(frame=600, state='day', lens=16.0, location=loc, target=tgt, fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'hero_padlock',
                             'blooms', 'gravity'}, sea_focus=(loc.x, loc.y))
    if name == 's08_poster':
        loc = Vector((40.0, -300.0, 220.0))
        tgt = Vector((0.0, 150.0, 120.0))
        return dict(frame=832, state='day', lens=16.0, location=loc, target=tgt, fstop=0.0,
                    include=DEFAULT_PARTS['day'] | {'hero_envelope'}, sea_focus=(20.0, -40.0))
    if name == 's12_fireflies':
        loc = s12_camera()
        d = (ARCH_C - loc).to_2d().normalized()
        tgt = loc + Vector((d.x, d.y, math.tan(math.radians(12.0)))) * 100.0
        return dict(frame=1217, state='night', lens=35.0, location=loc, target=tgt, fstop=2.8,
                    focus=60.0, include=DEFAULT_PARTS['night'], sea_focus=(loc.x, loc.y),
                    grey_near=tuple(loc + Vector((d.x, d.y, 0)) * 35.0 + Vector((0, 0, 4.0))))
    if name == 's14_box':
        tgt = BOX_C.copy()
        loc = BOX_C - SHAFT_DIR * 230.0
        return dict(frame=1390, state='night', lens=24.0, location=loc, target=tgt, fstop=0.0,
                    include=DEFAULT_PARTS['night'], sea_focus=(ISLAND_C.x, ISLAND_C.y), gravity=(1345, 4.0, 1408, 12.0))
    raise KeyError(name)
