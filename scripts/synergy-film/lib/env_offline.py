"""E1_OFFLINE: the world inside Synergy's coffee cup, built at x9,000 scale.

The cup is the hero lidded paper cup (bottom r 0.03 m, top r 0.045 m, height
0.115 m) scaled by 9,000 and filled with espresso to 40% of its height. World
units are metres, Z up, the cup axis is the world Z axis and the espresso sea
is z = 0. Everything a shot needs to place a camera is in OFFLINE.

    import env_offline as E
    h = E.build_offline('day', include={'cup', 'lid', 'sea', 'arch', 'hero_padlock'}, frames=(529, 608))
    E.tune_render(bpy.context.scene, 'final')        # Offline's bounces and sample budget
    E.animate_hero_padlock(h, 529, 553, 566, 578)
    E.apply_look('day')

build_offline() returns a Handles dict: every built object, material control
and light is reachable by name so shot scripts can animate it. Parts are
opt-in through `include` so a shot only pays for what it sees.

Lighting model (pre-lit cup: cheap, clean and physically motivated):
  * the paper wall and the lid are lit from outside, so what the camera sees on
    them is transmitted light: both are pure emission (backlight field x paper
    transmittance, colour blooms as Gaussian glows in the paper), never sampled
    as lights. They light the world by bounce, like a sky;
  * the slot is a real hole in the lid (a shader mask: transparent for camera
    and shadow rays), so the SUN lamp aimed down the shaft only lands where a
    real sunbeam through a sip hole would: a slot-shaped pool on the island;
  * three helper lamps: a soft warm 'key' standing in for the hot slot-side
    paper (diffuse only), a 'top' disc (the moon dome fill at night) and a
    narrow 'glint' strip seen only by glossy rays (the glitter path);
  * the shaft is a surface with a volumetric profile (no volumes, no ovals);
  * aerial haze is the compositor mist pass (look()): linear, from 150 m;
  * tune_render() sets Offline's bounces, samples and camera culling.

Crowds (paper falls, murmuration, fireflies) are simulated in numpy and played
back from PC2 point caches (cache.py), so they are deterministic, need no
frame-change handlers and support motion blur.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

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
CAM_S06 = Vector((ARCH_C.x + 55.0 * _u.x, ARCH_C.y + 55.0 * _u.y, 2.0))    # S06 end of tilt: 50 mm, slot in the arch
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


def grid_skirt(V, nx, ny, z):
    """Extra verts/faces that close a (ny, nx) grid's border with a vertical wall down to z."""
    ring = np.concatenate([np.arange(nx), np.arange(1, ny) * nx + nx - 1, (ny - 1) * nx + np.arange(nx - 2, -1, -1),
                           np.arange(ny - 2, 0, -1) * nx])
    base = len(V)
    low = V[ring].copy()
    low[:, 2] = np.minimum(z, low[:, 2] - 1.0)
    k = np.arange(len(ring))
    F = np.stack([ring, ring[(k + 1) % len(ring)], base + (k + 1) % len(ring), base + k], 1)
    return low, F


def heightfield(name, cx, cy, half_w, half_h, step, fn, coll=None, mat=None, skirt=None):
    """Grid mesh over [cx-hw, cx+hw] x [cy-hh, cy+hh]; z = fn(X, Y) in world metres.

    skirt: close the border with a wall down to this z, so a tilted sea (S14)
    never shows an open edge or the underside.
    """
    xs = np.arange(-half_w, half_w + 1e-6, step) + cx
    ys = np.arange(-half_h, half_h + 1e-6, step) + cy
    X, Y = np.meshgrid(xs, ys)
    Z = fn(X, Y)
    verts = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)
    faces = [grid_faces(len(xs), len(ys))]
    if skirt is not None:
        low, Fs = grid_skirt(verts, len(xs), len(ys), skirt)
        verts = np.vstack([verts, low])
        faces.append(Fs)
    obj = np_mesh(name, verts, faces, coll=coll, mat=mat)
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


DAY_BLOOMS = ('keys', 'strategy', 'people', 'kevin', 'operations', 'linda', 'arjun', 'synthia')

# The paper is lit from outside, so what the camera sees on the cliffs and the lid is light
# transmitted through them. Both are pre-lit: pure emission = backlight field x transmittance.
# glow: radiance of the hottest (upper, slot-side) paper; col: its tint (3200K held at low
# saturation); bloom: Bloom_<name> value when that attendee's exterior bloom is on.
WALL_STATE = {
    'day': dict(glow=1.65, col=(1.0, 0.72, 0.45), bloom=1.25, lid=1.45, lid_col=(1.0, 0.97, 0.93)),
    'night': dict(glow=0.07, col=(0.74, 0.78, 0.88), bloom=0.12, lid=0.05, lid_col=(0.8, 0.86, 0.97)),
}
BLOOM_SIGMA = (62.0, 56.0)          # arc / vertical extent (m) of one exterior colour bloom


def bloom_names(state, blooms=None):
    """Attendee blooms that are on: `blooms` if given, else the state's default (night: Pat only)."""
    if blooms is not None:
        return tuple(blooms)
    return DAY_BLOOMS if state == 'day' else ('pat',)


def _bloom_centre(name):
    hx, az, zc = ATTENDEES[name]
    return _pol(az, float(cup_radius(zc)), zc)


def mat_paper_wall(state='day', blooms=None):
    """Backlit paper-cup wall at kilometre scale (pre-lit: emission only, never sampled as a light).

    Transmittance comes from three octaves of paper structure in the unrolled
    (arc length, height) plane: formation clouds (~150 m), flocs (~35 m) and
    fibres, plus vertical flutes; the overlap seam (double paper) and the glue
    line read darker, tide lines and the soaked lower 0-70 m band stain it
    brown. The backlight field is hottest on the slot side and high up. The
    attendee colour blooms are Gaussian glows in the paper (one keyable value
    node 'Bloom_<name>' each). Large-scale relief comes from the geometry's
    folds and flutes, shaded against a light above the cup centre.
    """
    st = WALL_STATE[state]
    on = set(bloom_names(state, blooms))
    m = new_mat('OFF_PaperWall')
    g = G(m)
    p = g.texco('Object')
    x, y, z = g.sep(p)
    a0 = math.radians(SEAM_AZ)
    xr = g.add(g.mul(x, math.cos(a0)), g.mul(y, math.sin(a0)))
    yr = g.math('SUBTRACT', g.mul(y, math.cos(a0)), g.mul(x, math.sin(a0)))
    th = g.math('ARCTAN2', yr, xr)                      # 0 at the seam, +-pi opposite
    s = g.mul(th, 340.0)                                # arc length (m)
    uv = g.comb(s, z, 0.0)
    # formation: fibrous flocs (grainy fBm with a little warp) inside large clouds
    flocs = g.remap(g.noise(g.mapping(uv, scale=(1 / 22.0, 1 / 19.0, 1)), 1.0, 5.0, 0.68, distortion=0.25, dims='2D'), 0.34, 0.66)
    clouds = g.remap(g.noise(g.mapping(uv, scale=(1 / 210.0, 1 / 160.0, 1), loc=(7, 2, 0)), 1.0, 1.0, 0.5, dims='2D'), 0.3, 0.7)
    flutes = g.remap(g.noise(g.mapping(uv, scale=(1 / 18.0, 1 / 320.0, 1), loc=(5, 3, 0)), 1.0, 2.0, 0.6, dims='2D'), 0.3, 0.7)
    # fibre bundles: short wandering flecks (isolines of stretched noise), visible only up close
    n = g.noise(g.mapping(uv, rot=(0, 0, math.radians(24)), scale=(1 / 14.0, 1 / 3.0, 1), loc=(3, 1, 0)), 1.0, 1.0, 0.5, dims='2D')
    fib = g.mul(g.remap(g.math('ABSOLUTE', g.math('SUBTRACT', n, 0.5)), 0.04, 0.0), g.remap(flocs, 0.3, 0.7))
    thick = g.add(g.mul(flocs, 0.62), g.mul(clouds, 0.16), g.mul(flutes, 0.1), g.mul(fib, 0.12))
    trans = g.remap(thick, 0.0, 1.0, 1.3, 0.58)
    # overlap seam: a 64 m band of double paper starting at the seam edge, glue line inside it
    band = g.mul(g.remap(s, -1.5, 0.5, 0.0, 1.0), g.remap(s, 62.0, 64.0, 1.0, 0.0))
    glue = g.mul(g.remap(s, 4.0, 5.0, 0.0, 1.0), g.remap(s, 11.0, 12.5, 1.0, 0.0))
    edge = g.remap(g.math('ABSOLUTE', s), 1.6, 0.0)
    trans = g.mul(trans, g.math('SUBTRACT', 1.0, g.add(g.mul(band, 0.25), g.mul(glue, 0.2), g.mul(edge, 0.35))))
    # tide lines (slightly wavy where the paper wicked unevenly) and the soaked lower band
    zw = g.add(z, g.mul(g.math('SUBTRACT', g.noise(g.mapping(uv, scale=(1 / 160.0, 1 / 160.0, 1)), 1.0, 1.0, 0.5, dims='2D'), 0.5), 6.0))
    stain = g.add(
        _ring_band(g, zw, 7.0, 1.2, 0.5, 9.0),
        _ring_band(g, zw, 24.0, 1.0, 0.34, 16.0),
        _ring_band(g, zw, 63.0, 0.9, 0.22, 26.0),
        _ring_band(g, zw, 141.0, 0.8, 0.12, 34.0),
    )
    # the falls keep a long wet streak on the cliff below the ledge (spray soaks the paper)
    s_f = math.radians((FALLS_AZ - SEAM_AZ + 540.0) % 360.0 - 180.0) * 340.0
    half_w = g.add(30.0, g.mul(g.math('MAXIMUM', g.math('SUBTRACT', FALLS_Z, z), 0.0), 0.12))
    ds = g.math('DIVIDE', g.math('SUBTRACT', s, s_f), half_w)
    streak = g.mul(g.math('EXPONENT', g.mul(g.math('POWER', g.math('ABSOLUTE', ds), 2.0), -1.0)),
                   g.remap(z, FALLS_Z + 6.0, FALLS_Z - 40.0), 0.8)
    stain = g.math('MINIMUM', g.add(stain, streak), 1.0)
    soak = g.remap(zw, -4.0, 70.0, 0.05, 1.0, smooth=True)
    # backlight field: the sun stands outside the slot side, light builds up toward the rim
    r = g.vmath('LENGTH', g.comb(x, y, 0.0))
    sa = math.radians(_SLOT_AZ)
    c = g.math('DIVIDE', g.add(g.mul(x, math.cos(sa)), g.mul(y, math.sin(sa))), g.math('MAXIMUM', r, 1.0))
    side = g.add(0.45, g.mul(g.math('POWER', g.add(0.5, g.mul(c, 0.5)), 2.0), 0.55))
    hgt = g.add(0.42, g.mul(g.math('POWER', g.remap(z, 20.0, 600.0, 0.0, 1.0, smooth=True), 2.2), 1.3))
    # relief: folds and flutes in the geometry, shaded against a light above the cup centre
    L = g.vmath('NORMALIZE', g.comb(g.mul(x, -1.0), g.mul(y, -1.0), g.math('SUBTRACT', 640.0, z)))
    lam = g.add(0.62, g.mul(g.math('MAXIMUM', g.vmath('DOT_PRODUCT', g.geo('Normal'), L), 0.0), 0.45))
    glow_v = g.value(st['glow'], 'WallGlow')
    field = g.mul(glow_v.outputs[0], side, hgt, soak, lam, trans)
    # exterior colour blooms glowing through the paper; where one glows, it outshines the warm base
    ps = g.mapping(p, scale=(1 / BLOOM_SIGMA[0], 1 / BLOOM_SIGMA[0], 1 / BLOOM_SIGMA[1]))
    bl, cover = None, None
    for name in ATTENDEES:
        b = _bloom_centre(name)
        bs = (b.x / BLOOM_SIGMA[0], b.y / BLOOM_SIGMA[0], b.z / BLOOM_SIGMA[1])
        d2 = g.math('POWER', g.vmath('DISTANCE', ps, bs), 2.0)
        bv = g.value(st['bloom'] if name in on else 0.0, 'Bloom_' + name)
        gs = g.mul(g.math('EXPONENT', g.mul(d2, -1.0)), bv.outputs[0])
        term = g.vmath('SCALE', srgb(ATTENDEES[name][0]), scale=g.mul(gs, trans))
        bl = term if bl is None else g.vmath('ADD', bl, term)
        cover = gs if cover is None else g.add(cover, gs)
    keep = g.math('SUBTRACT', 1.0, g.mul(g.math('MINIMUM', cover, 1.0), 0.5))
    # thicker paper absorbs blue first: thick flocs glow warmer, thin voids whiter
    tint = g.comb(1.0, g.math('POWER', trans, 0.3), g.math('POWER', trans, 0.75))
    warm = g.vmath('MULTIPLY', st['col'], tint)
    col = g.vmath('ADD', g.vmath('SCALE', warm, scale=g.mul(field, keep)), bl)
    col = g.mix(stain, col, g.cmul(col, (0.42, 0.21, 0.08)))
    m.cycles.emission_sampling = 'NONE'
    return g.output(g.emission(col, 1.0))


def mat_lid(slot_frame, state='day'):
    """White polystyrene lid seen from inside, backlit by the sky: pre-lit emission, ribs read by value.

    The slot is a stadium-shaped mask in the slot frame (projected along the
    slot normal, so from the S01 camera it is a perfect rounded oblong). Inside
    the mask the lid is transparent to every ray type: the S01 camera sees the
    sky emitter through it, and the sun lamp casts a real slot-shaped pool.
    Only a thin rim at the cut edge glows (light scattering in the cut
    polystyrene), keyed by the 'SlotGlow' value; the plastic around it does not
    halo, so the S01/S02 match cut stays crisp. The embossed rib walls are
    thinner plastic and read brighter; the plug ring at the rim reads darker.
    """
    st = WALL_STATE[state]
    m = new_mat('OFF_Lid')
    g = G(m)
    sp = g.texco('Object', slot_frame)
    sx, sy, sz = g.sep(sp)
    ax = g.math('MAXIMUM', g.math('SUBTRACT', g.math('ABSOLUTE', sx), 45.0), 0.0)
    d = g.math('SUBTRACT', g.vmath('LENGTH', g.comb(ax, sy, 0.0)), 22.5)     # stadium SDF (m)
    near = g.remap(g.math('ABSOLUTE', sz), 90.0, 75.0)          # the slope crosses the frame plane steeply
    hole = g.mul(g.remap(d, 0.3, -0.3), near)
    glow_v = g.value(1.0, 'SlotGlow')
    col = kelvin(7000) if state == 'day' else kelvin(9000)
    lip = g.mul(g.remap(d, 0.0, 0.25, 0.0, 1.0), g.remap(d, 0.25, 1.1, 1.0, 0.0), near)
    em_lip = g.emission(col, g.mul(lip, 4.0 if state == 'day' else 1.5, glow_v.outputs[0]))
    p = g.texco('Object')
    px, py, pz = g.sep(p)
    rr = g.vmath('LENGTH', g.comb(px, py, 0.0))
    mott = g.remap(g.noise(p, 1 / 11.0, 2.0, 0.55), 0.3, 0.7, 0.93, 1.05)
    tn = g.geo('True Normal')
    nx_, ny_, nz_ = g.sep(tn)
    flank = g.math('DIVIDE', g.add(g.mul(nx_, px), g.mul(ny_, py)), g.math('MAXIMUM', rr, 1.0))
    flank = g.mul(flank, g.math('SIGN', nz_))
    rib = g.add(0.9, g.mul(flank, 1.25), g.mul(g.math('SUBTRACT', 1.0, g.math('ABSOLUTE', nz_)), 0.8))
    plug = g.remap(rr, 352.0, 402.0, 1.0, 0.42, smooth=True)
    lid_v = g.value(st['lid'], 'LidGlow')
    em = g.emission(st['lid_col'], g.mul(lid_v.outputs[0], rib, plug, mott))
    lid = g.adds(em, em_lip)
    m.cycles.emission_sampling = 'NONE'
    return g.output(g.mixs(hole, lid, g.bsdf('Transparent', Color=(1, 1, 1))))


def mat_slot_sky(state='day'):
    m = new_mat('OFF_SlotSky')
    g = G(m)
    v = g.value(45.0 if state == 'day' else 9.0, 'SkyStrength')
    col = g.mix(0.25, kelvin(7500), kelvin(4800)) if state == 'day' else g.mix(0.6, kelvin(5500), (0.8, 0.84, 0.9))
    m.cycles.emission_sampling = 'NONE'
    return g.output(g.emission(col, v.outputs[0]))


SHAFT_HALF = (67.5, 22.5)            # semi-axes (m) of the ellipse that stands in for the stadium section


def mat_shaft(length, state='day'):
    """Light shaft as a surface with a volumetric profile (no volumes, no ovals).

    Object space: local -Z runs down the beam from the slot. For each camera
    or reflection ray that enters the prism, the shader finds how close that
    ray's line passes to the beam axis (in units of the stadium's half-widths)
    and emits the chord integral of a soft (1 - r^2) density: brightest
    through the core, exactly zero at the prism wall, so the beam has no edge
    and no footprint. Only the entry face emits (the exit face is plain
    transparent). If the camera sits inside the prism (S14) the first face it
    sees is a back face: it then emits a faint, even veil that grows with the
    ray length instead. The strength fades to zero over the last 30% of the
    length, and the prism runs on below the island, so no end cap is ever
    seen. Soft striations run along the beam.
    """
    m = new_mat('OFF_Shaft')
    g = G(m)
    p = g.texco('Object')
    px, py, pz = g.sep(p)
    vt = g.node('ShaderNodeVectorTransform', vector_type='VECTOR', convert_from='WORLD', convert_to='OBJECT')
    g._set(vt.inputs[0], g.geo('Incoming'))
    dx, dy, dz = g.sep(vt.outputs[0])
    depth = g.math('ABSOLUTE', pz)
    spread = g.add(1.0, g.mul(depth, 0.00022))
    hx = g.mul(spread, SHAFT_HALF[0])
    hy = g.mul(spread, SHAFT_HALF[1])
    X, Y = g.math('DIVIDE', px, hx), g.math('DIVIDE', py, hy)
    DX, DY = g.math('DIVIDE', dx, hx), g.math('DIVIDE', dy, hy)
    cross = g.math('ABSOLUTE', g.math('SUBTRACT', g.mul(X, DY), g.mul(Y, DX)))
    dn = g.math('MAXIMUM', g.vmath('LENGTH', g.comb(DX, DY, 0.0)), 1e-6)
    q = g.math('DIVIDE', cross, dn)
    prof = g.math('POWER', g.math('MAXIMUM', g.math('SUBTRACT', 1.0, g.mul(q, q)), 0.0), 1.5)
    # a grazing look along the beam passes through more of it
    klen = g.math('MINIMUM', g.math('DIVIDE', 1.0, g.math('MAXIMUM', g.vmath('LENGTH', g.comb(dx, dy, 0.0)), 0.05)), 2.0)
    bf = g.geo('Backfacing')
    front = g.mul(prof, klen, g.math('SUBTRACT', 1.0, bf))
    along = g.add(0.55, g.mul(g.math('EXPONENT', g.mul(depth, -1 / 420.0)), 0.45))
    head = g.remap(depth, 0.0, 30.0, 0.0, 1.0)
    tail = g.remap(depth, 0.78 * length, 1.04 * length, 1.0, 0.0, smooth=True)
    streak = g.remap(g.noise(g.mapping(p, scale=(1 / 20.0, 1 / 20.0, 1 / 300.0)), 1.0, 2.0, 0.55), 0.3, 0.7, 0.72, 1.18)
    v = g.value(1.5 if state == 'day' else 0.5, 'ShaftStrength')
    col = g.mix(0.35, kelvin(6200), kelvin(3600)) if state == 'day' else g.mix(0.7, kelvin(6000), (0.78, 0.83, 0.92))
    strength = g.mul(front, along, head, tail, streak, v.outputs[0])
    m.cycles.emission_sampling = 'NONE'
    return g.output(g.adds(g.bsdf('Transparent', Color=(1, 1, 1)), g.emission(col, strength)))


def shore_image(name, mask_fn, x0, y0, size, res=2048, cache_path=None):
    """Rasterise land masks into an RGBA float image over [x0, x0+size] x [y0, y0+size].

    mask_fn(X, Y) -> (land, lagoon, shelf) arrays in [0,1]. R = shallows (wide blur of
    the land, plus submerged reef shelves), G = shoreline foam band, B = lagoon glow
    (already depth-graded by the mask function), A = 1.
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
    """Espresso: near-black, nearly mirror-smooth, capillary ripples, amber shallows, broken crema.

    The shore image (sea object space) gives shallows, island foam lines and the
    depth-graded atoll lagoon. The crema band at the cliff foot is computed from
    world position against the true wall radius, so it follows the wall even
    when the gravity rig tilts the sea. The foam is broken by lace noise at two
    scales and its width varies 0.3-3x along the shore; at night it is
    desaturated and darker. Roughness stays at 0.01-0.02: the capillary normals
    break the reflections into glitter.
    """
    night = state == 'night'
    m = new_mat('OFF_Sea')
    g = G(m)
    p = g.texco('Object')
    uv = g.comb(g.mul(g.math('SUBTRACT', g.sep(p)[0], x0), 1.0 / size), g.mul(g.math('SUBTRACT', g.sep(p)[1], y0), 1.0 / size), 0.0)
    tex = g.node('ShaderNodeTexImage', interpolation='Linear', extension='EXTEND')
    tex.image = shore_img
    g._set(tex.inputs['Vector'], uv)
    shallow, foam_i, lagoon = g.sep(tex.outputs['Color'])
    wp = g.geo('Position')
    wx, wy, wz = g.sep(wp)
    rw = g.add(R_SEA, g.mul(wz, TAPER))
    dwall = g.math('SUBTRACT', rw, g.vmath('LENGTH', g.comb(wx, wy, 0.0)))
    width = g.noise(g.mapping(wp, scale=(1 / 45.0, 1 / 45.0, 1 / 45.0)), 1.0, 1.0, 0.5, dims='2D')   # band width 0.3-3x
    lace = g.noise(g.mapping(p, scale=(1 / 6.0, 1 / 6.0, 1)), 1.0, 3.0, 0.62, dims='2D')
    lace2 = g.noise(g.mapping(p, scale=(1 / 1.7, 1 / 1.7, 1), loc=(5, 2, 0)), 1.0, 2.0, 0.6, dims='2D')
    wall_w = g.remap(width, 0.3, 0.7, 2.5, 16.0)
    wall_foam = g.remap(g.math('DIVIDE', dwall, wall_w), 1.0, 0.25)
    thr = g.remap(width, 0.3, 0.7, 0.62, 0.12)
    shore_foam = g.remap(g.math('SUBTRACT', foam_i, thr), 0.0, 0.2)
    foam = g.math('MAXIMUM', shore_foam, wall_foam)
    brk = g.mul(g.remap(lace, 0.38, 0.6), g.remap(lace2, 0.3, 0.55, 0.35, 1.0))
    foam = g.mul(foam, brk)
    foam = g.remap(foam, 0.12, 0.5)
    base = g.mix(g.mul(g.math('POWER', shallow, 2.2), 0.55), ESPRESSO, AMBER)
    lag = g.mul(lagoon, g.remap(g.noise(g.mapping(p, scale=(1 / 2.2, 1 / 7.0, 1)), 1.0, 1.0, 0.5, dims='2D'), 0.35, 0.65, 0.75, 1.15))
    base = g.mix(g.mul(lag, 0.8), base, CARAMEL)
    crema = g.mix(lace2, CREMA, CREMA_LIGHT)
    if night:
        crema = g.mix(0.75, crema, (0.16, 0.16, 0.17))
    base = g.mix(g.mul(foam, g.remap(lace2, 0.45, 0.6), 0.5) if night else g.mul(foam, 0.85), base, crema)
    cap1 = g.noise(g.mapping(p, scale=(1 / 0.9, 1 / 0.9, 1)), 1.0, 1.0, 0.55, dims='2D')
    chop = g.noise(g.mapping(p, scale=(1 / 3.6, 1 / 2.9, 1), loc=(9, 1, 0)), 1.0, 3.0, 0.62, dims='2D')
    swell = g.noise(g.mapping(p, scale=(1 / 40.0, 1 / 95.0, 1)), 1.0, 0.0, 0.5, dims='2D')
    h = g.add(g.mul(cap1, 0.25), g.mul(chop, 1.0), g.mul(swell, 0.6))
    nrm = g.bump(h, strength=g.remap(foam, 0.0, 1.0, 0.35, 0.05), distance=1.0)
    rough = g.add(0.01, g.mul(g.noise(g.mapping(p, scale=(1 / 30.0, 1 / 30.0, 1)), 1.0, 0.0, 0.5, dims='2D'), 0.012))
    rough = g.mixf(foam, rough, 0.75)
    lag_v = g.value(0.6 if state == 'day' else 0.02, 'LagoonGlow')
    em_s = g.mul(lag, lag_v.outputs[0], g.remap(foam, 0.0, 0.5, 1.0, 0.0))
    spec = g.mixf(foam, 0.26, 0.5)
    sea = g.principled(Base_Color=base, Roughness=rough, IOR=1.34, Normal=nrm, Specular_IOR_Level=spec,
                       Specular_Tint=(0.92, 0.74, 0.55), Emission_Color=CARAMEL, Emission_Strength=em_s)
    m.cycles.emission_sampling = 'NONE'
    return g.output(sea)


def mat_foam(state='day'):
    """Crema floes: lacy, bubbly, broken (espresso shows through the lace)."""
    m = new_mat('OFF_Foam')
    g = G(m)
    p = g.texco('Object')
    bub = g.voronoi(g.mapping(p, scale=(1 / 0.5, 1 / 0.5, 1 / 0.5)), 1.0)
    big = g.voronoi(g.mapping(p, scale=(1 / 2.2, 1 / 2.2, 1 / 2.2)), 1.0)
    lace = g.noise(g.mapping(p, scale=(1 / 1.4, 1 / 1.4, 1)), 1.0, 3.0, 0.6)
    col = g.mix(g.remap(lace, 0.4, 0.7), g.cmul(CREMA, (0.8, 0.74, 0.66)), CREMA)
    col = g.mix(g.remap(big, 0.0, 0.22, 0.45, 0.0), col, g.cmul(col, (0.6, 0.45, 0.32)))
    holes = g.math('MAXIMUM', g.remap(lace, 0.42, 0.34), g.remap(g.attr('rim', 'GEOMETRY', 'Fac'), 0.45, 0.0))
    col = g.mix(holes, col, ESPRESSO)
    if state == 'night':
        col = g.mix(0.7, col, (0.12, 0.12, 0.13))
    nrm = g.bump(g.add(g.mul(bub, -1.0), g.mul(big, -0.5)), strength=0.45, distance=0.3)
    return g.output(g.principled(Base_Color=col, Roughness=g.mixf(holes, 0.7, 0.04), Normal=nrm))


def mat_stone(name='OFF_Stone', tint=STONE, lichen=0.0, wet_line=True, wet=0.0):
    """Weathered stone; darker and stained at the waterline; optional lichen crust.

    Lichen comes as frost-grey rosettes (#c9cec9) with chartreuse dots (#e5ff8d)
    at small scale, so a lichen-crusted surface still shows the stone's form.
    wet: 0..1 soaks the whole surface (darker, glossy, with puddled hollows).
    """
    wetness = wet
    m = new_mat(name)
    g = G(m)
    p = g.texco('Object')
    wp = g.geo('Position')
    n1 = g.noise(g.mapping(p, scale=(1 / 9.0,) * 3), 1.0, 4.0, 0.6)
    n2 = g.noise(g.mapping(p, scale=(1 / 1.3,) * 3), 1.0, 3.0, 0.55)
    strata = g.noise(g.mapping(p, scale=(1 / 40.0, 1 / 40.0, 1 / 2.5)), 1.0, 2.0, 0.5)
    col = g.mix(g.remap(n1, 0.3, 0.7), g.cmul(tint, (0.7, 0.66, 0.62)), g.cmul(tint, (1.25, 1.2, 1.12)))
    col = g.mix(g.mul(g.remap(strata, 0.45, 0.6), 0.4), col, g.cmul(col, (0.75, 0.68, 0.6)))
    rough = 0.82
    if lichen > 0:
        ros = g.voronoi(g.mapping(p, scale=(1 / 1.6,) * 3, loc=(9, 1, 4)), 1.0, out='Distance')
        lp = g.noise(g.mapping(p, scale=(1 / 6.0,) * 3), 1.0, 2.0, 0.6)
        fm = g.mul(g.remap(ros, 0.42, 0.3), g.remap(lp, 0.4, 0.55), lichen)
        dots = g.voronoi(g.mapping(p, scale=(1 / 0.35,) * 3, loc=(3, 3, 1)), 1.0, out='Distance')
        lm = g.mul(g.remap(dots, 0.22, 0.12), g.remap(lp, 0.48, 0.62), lichen)
        col = g.mix(fm, col, FROST)
        col = g.mix(lm, col, g.mix(n2, LICHEN, (0.62, 0.78, 0.25)))
    if wet_line:
        wz = g.sep(wp)[2]
        wet = g.remap(wz, 1.6, -0.3)
        band = g.mul(g.remap(wz, 3.5, 1.2), g.remap(wz, 1.2, 0.6, 1.0, 0.0))
        col = g.mix(g.math('MAXIMUM', wet, g.mul(band, 0.6)), col, g.cmul(col, (0.32, 0.2, 0.12)))
        rough = g.mixf(wet, 0.82, 0.22)
    if wetness > 0:
        pud = g.remap(g.noise(g.mapping(p, scale=(1 / 2.5,) * 3, loc=(2, 5, 1)), 1.0, 3.0, 0.6), 0.42, 0.6)
        col = g.mix(wetness, col, g.cmul(col, (0.5, 0.45, 0.4)))
        rough = g.mixf(g.mul(pud, wetness), rough, 0.06)
        rough = g.mixf(wetness * 0.6, rough, 0.3)
    nrm = g.bump(g.add(g.mul(n1, 0.6), g.mul(n2, 0.4)), strength=0.45, distance=0.5)
    return g.output(g.principled(Base_Color=col, Roughness=rough, Normal=nrm))


VERDIGRIS_CHALK = srgb('#80cfc4')     # pale, chalky verdigris (lands near hue 160 under the warm glow)
STONE_GREY = srgb('#8c8a84')


def mat_padlock(age=None):
    """Ageing padlock: brass -> brown patina -> chalky verdigris -> lichen-crusted stone.

    age: None reads the per-instance 'age' attribute (INSTANCER); a float fixes it
    (the hero padlock). Verdigris arrives in the recesses first (where the
    shackle enters the body, the lower edge, the body's sides) and as vertical
    drip streaks down each body, with dark brown patina showing through; it is
    pale, chalky and rough. The oldest stage is stone: grey, with frost-grey
    lichen rosettes and small chartreuse dots laid on top in patches, so the
    padlock silhouette survives at every age. Young brass is anisotropic and
    fairly glossy (roughness 0.18-0.25) so it throws gold glints.
    """
    m = new_mat('OFF_Padlock' if age is None else f'OFF_Padlock_{age:.2f}')
    g = G(m)
    p = g.texco('Object')
    px, py, pz = g.sep(p)
    rnd = g.node('ShaderNodeObjectInfo').outputs['Random']
    q = g.add(p, g.comb(g.mul(rnd, 37.0), g.mul(rnd, 11.0), g.mul(rnd, 5.0)))
    wp = g.geo('Position')
    a = g.attr('age', 'INSTANCER') if age is None else age
    n1 = g.noise(g.mapping(q, scale=(2.2,) * 3), 1.0, 1.0, 0.6)
    n2 = g.noise(g.mapping(q, scale=(5.0,) * 3, loc=(3, 1, 7)), 1.0, 1.0, 0.62)
    # recesses in template space (body top seam, lower edge, the flanks) and world-down drip streaks
    seam = g.remap(g.math('ABSOLUTE', g.math('SUBTRACT', pz, 0.5)), 0.08, 0.0)
    low = g.remap(pz, 0.1, 0.0)
    flank = g.remap(g.math('ABSOLUTE', px), 0.2, 0.3)
    rec = g.math('MAXIMUM', g.math('MAXIMUM', seam, low), g.mul(flank, 0.7))
    drip = g.noise(g.mapping(wp, scale=(1 / 0.45, 1 / 0.45, 1 / 5.0), loc=(2, 9, 0)), 1.0, 1.0, 0.55)
    drip = g.remap(drip, 0.52, 0.66)
    j1 = g.mul(g.math('SUBTRACT', n1, 0.5), 0.3)
    m_pat = g.remap(g.add(a, j1), 0.12, 0.26)
    m_ver = g.remap(g.add(a, g.mul(rec, 0.22), g.mul(drip, 0.2), g.mul(g.math('SUBTRACT', n2, 0.5), 0.3)), 0.4, 0.52)
    m_sto = g.remap(g.add(a, j1), 0.7, 0.82)
    brass = g.mix(g.remap(n2, 0.3, 0.7), g.cmul(BRASS, (0.85, 0.8, 0.7)), g.cmul(BRASS, (1.12, 1.06, 0.95)))
    patina = g.mix(n1, PATINA, g.cmul(PATINA, (0.5, 0.42, 0.36)))
    chalk = g.mix(g.remap(n2, 0.35, 0.7), g.cmul(VERDIGRIS_CHALK, (0.78, 0.86, 0.86)), VERDIGRIS_CHALK)
    chalk = g.mix(rnd, g.cmul(chalk, (0.8, 0.86, 0.8)), g.cmul(chalk, (1.08, 1.04, 1.1)))   # per-padlock variation
    verd = g.mix(g.mul(g.remap(n1, 0.6, 0.45), 0.4), chalk, patina)          # brown shows through
    verd = g.mix(g.mul(drip, 0.55), verd, g.cmul(verd, (0.45, 0.5, 0.48)))       # dark run-off streaks
    verd = g.mix(g.mul(g.remap(n2, 0.62, 0.75), 0.6), verd, (0.62, 0.8, 0.76))   # chalky blooms
    ros = g.voronoi(g.mapping(q, scale=(6.0,) * 3, loc=(1, 9, 3)), 1.0, out='Distance')
    stone = g.mix(n2, g.cmul(STONE_GREY, (0.8, 0.8, 0.8)), g.cmul(STONE_GREY, (1.1, 1.1, 1.08)))
    frost = g.mul(g.remap(ros, 0.4, 0.28), m_sto)
    chart = g.mul(g.remap(ros, 0.12, 0.05), g.remap(n1, 0.45, 0.6), m_sto)       # chartreuse cores in the rosettes
    # worn edges: the crust rubs off convex edges, showing dark bronze (Cycles pointiness)
    wear = g.mul(g.remap(g.geo('Pointiness'), 0.53, 0.62), g.remap(n2, 0.35, 0.6))
    col = g.mix(m_pat, brass, patina)
    col = g.mix(g.mul(m_ver, g.math('SUBTRACT', 1.0, g.mul(wear, 0.8))), col, verd)
    col = g.mix(m_sto, col, stone)
    col = g.mix(frost, col, FROST)
    col = g.mix(chart, col, LICHEN)
    metal = g.mul(g.math('SUBTRACT', 1.0, g.math('MAXIMUM', g.mul(m_ver, 0.8), m_sto)),
                  g.math('SUBTRACT', 1.0, g.mul(m_pat, 0.35)))
    rough = g.mixf(m_pat, g.add(0.18, g.mul(n2, 0.1)), 0.48)
    rough = g.mixf(m_ver, rough, 0.9)
    rough = g.mixf(m_sto, rough, 0.88)
    # crust relief: one cheap noise under the bump, its strength masked by age (evaluated once)
    grain = g.noise(g.mapping(q, scale=(9.0,) * 3, loc=(5, 5, 2)), 1.0, 0.0, 0.5)
    nrm = g.bump(grain, strength=g.add(0.06, g.mul(g.math('MAXIMUM', m_ver, m_sto), 0.4)), distance=0.08)
    aniso = g.mul(g.math('SUBTRACT', 1.0, m_pat), 0.55)
    return g.output(g.principled(Base_Color=col, Metallic=metal, Roughness=rough, Normal=nrm, Anisotropic=aniso))


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
    """Terrace water: black mirror (roughness 0.02) with a faint green tint.

    Its base normal is a 'WaterUp' Combine XYZ node: build_offline drives it from
    the gravity rig, so in S14 the paddies mirror the world like tilted water
    although their surfaces stay where they are.
    """
    m = new_mat('OFF_Paddy')
    g = G(m)
    p = g.texco('Object')
    up = g.node('ShaderNodeCombineXYZ')
    up.name = up.label = 'WaterUp'
    up.inputs[2].default_value = 1.0
    rip = g.noise(g.mapping(p, scale=(1 / 0.6,) * 3), 1.0, 2.0, 0.5)
    nrm = g.bump(rip, strength=0.015, distance=0.2, normal=up.outputs[0])
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
    s = g.mixs(0.3, g.bsdf('Diffuse', Color=col), g.bsdf('Translucent', Color=g.cmul(col, (1.0, 0.95, 0.85))))
    if glow > 0:
        s = g.adds(s, g.emission(col, glow))
    m.cycles.emission_sampling = 'NONE'
    return g.output(s)


def mat_bird():
    """Origami paper bird: white paper (0.88 of PAPER), backlit translucency, a 3600K glowing edge."""
    m = new_mat('OFF_Bird')
    g = G(m)
    fres = g.node('ShaderNodeLayerWeight', inputs={'Blend': 0.12}).outputs['Fresnel']
    edge = g.value(0.9, 'BirdEdgeGlow')
    s = g.mixs(0.38, g.bsdf('Diffuse', Color=g.cmul(PAPER, (0.88, 0.87, 0.85))),
               g.bsdf('Translucent', Color=(0.95, 0.88, 0.78)))
    m.cycles.emission_sampling = 'NONE'
    return g.output(g.adds(s, g.emission(kelvin(3600), g.mul(fres, edge.outputs[0]))))


def mat_envelope():
    """Hero envelope: white paper, small cobalt square seal (material index 1)."""
    m0 = mat_paper_sheet('OFF_EnvelopePaper', glow=0.0)
    m1 = new_mat('OFF_EnvelopeSeal')
    g = G(m1)
    g.output(g.principled(Base_Color=COBALT, Roughness=0.35))
    return m0, m1


FIREFLY_PEAK = 9.0           # emission at the flash peak: hue survives AgX; glare makes the halo
FIREFLY_BASE = 0.1           # between flashes, as a fraction of the peak


def mat_firefly(clock_node_name='FireflyClock'):
    """Firefly emission computed in-shader from a keyed frame clock.

    Per-instance attributes: ff_phase (0..1), ff_freq (natural frequency detune),
    ff_grey (1 for Pat's grey firefly), ff_col (colour). The phase of every
    firefly is pulled to the common clock by a coupling term that ramps up
    between f1150 and f1192 (Kuramoto-style convergence). Pat's firefly keeps a
    piecewise lag on the beat grid: 4 frames late on the f1185 beat (peak f1189),
    2 late on f1201 (peak f1203), locked from f1217. Flash shape: a 2-frame
    rise into the beat, then a 10-frame decay, over a faint base glow.
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
    lag = g.math('SUBTRACT', 4.0, g.mul(2.0, g.add(g.math('GREATER_THAN', t, 1195.5), g.math('GREATER_THAN', t, 1211.5))))
    grey_drift = g.mul(g.add(0.37, g.mul(0.11, g.math('DIVIDE', dt, P))), g.remap(t, 1150.0, 1180.0, 1.0, 0.0, smooth=True))
    ph_n = g.add(g.math('DIVIDE', dt, P), drift)
    ph_g = g.add(g.math('DIVIDE', g.math('SUBTRACT', dt, lag), P), grey_drift)
    ph = g.mixf(grey, ph_n, ph_g)
    u = g.mul(g.math('FRACT', ph), P)                  # frames since the last flash peak
    rise = g.remap(u, P - 2.0, P, 0.0, 1.0)
    decay = g.math('POWER', g.remap(u, 0.0, 10.0, 1.0, 0.0), 2.0)
    b = g.add(g.math('MAXIMUM', rise, decay), FIREFLY_BASE)
    lvl = g.value(1.0, 'FireflyLevel')
    k = g.value(FIREFLY_PEAK, 'FireflyStrength')
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
    v = g.value(9.0 if state == 'day' else 24.0, 'SkylightStrength')
    return g.output(g.emission(kelvin(6000) if state == 'day' else kelvin(4600), v.outputs[0]))


def mat_mist(name='OFF_Mist', strength=0.35):
    """Soft spray card (kept for API compatibility; Offline no longer uses cards)."""
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
    m.cycles.emission_sampling = 'NONE'
    return g.output(g.adds(tr, em))


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


def mat_silhouette():
    """The S01 eclipse: fingertips and envelope seen against the sky, a near-black matte."""
    m = new_mat('OFF_Silhouette')
    g = G(m)
    return g.output(g.principled(Base_Color=(0.012, 0.011, 0.01), Roughness=0.9))


# ================================================================== cup, lid, slot, shaft

def build_cup_wall(coll, mat):
    """Tapered interior wall from below the sea to the lid, one overlap seam.

    The inner paper layer's cut edge stands 2.8 m proud at the seam azimuth
    (paper is 0.3 mm thick: 2.7 m at this scale). Slow folds (~95 m) and
    vertical fibre flutes (~25 m) give the cliffs relief that the pre-lit
    shader reads as light and shadow at kilometre distance.
    """
    nseg = 480
    az = np.radians(SEAM_AZ) + np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    zs = np.concatenate([np.linspace(-170, -12, 6), np.linspace(-8, 30, 14), np.linspace(34, 580, 92),
                         np.linspace(586, 615, 5)])
    A, Z = np.meshgrid(az, zs)
    R = cup_radius(Z)
    s = (A - A[0, 0]) * R                                  # arc length from the seam edge
    inset = np.where(s < 64.0, 2.8 * smoothstep(0.0, 2.6, s), 2.8 * (1 - smoothstep(64.0, 74.0, s)))
    wav = 1.6 * fbm2(s / 95.0, Z / 150.0, 3, seed=11) + 0.5 * fbm2(s / 22.0, Z / 60.0, 2, seed=12)
    flute = 1.3 * fbm2(s / 26.0, Z / 420.0, 2, seed=13) * smoothstep(20.0, 120.0, Z)
    R = R - inset + wav + flute
    V = np.stack([R * np.cos(A), R * np.sin(A), Z], axis=-1).reshape(-1, 3)
    F = grid_faces(nseg, len(zs), wrap_u=True)[:, ::-1]      # normals face the axis
    return np_mesh('OFF_CupWall', V, F, coll=coll, mat=mat)


def build_lid(coll, mat):
    """Lid underside as a polar mesh (dense where the ribs are; the slot is a shader mask)."""
    nseg = 512
    r = np.unique(np.concatenate([np.linspace(1.5, 280, 124), np.linspace(280, 300, 10),
                                  np.linspace(300, 372, 56), np.linspace(372, 412, 16)]))
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


SHAFT_OVERRUN = 70.0          # the prism runs on this far past the island top, into the ground


def build_shaft(coll, state):
    """Emissive prism from the slot down past the island (cross-section = the slot, slight spread)."""
    rows = 40
    outline = stadium(48)
    X, Y = Vector(_slot_x), (-SLOT_N).cross(_slot_x).normalized()
    end = Vector((ISLAND_C.x, ISLAND_C.y, _BOX_Z + 1.0))
    length = (end - SLOT_C).dot(SHAFT_DIR) / max(1e-3, SHAFT_DIR.dot(SHAFT_DIR))
    ts = np.linspace(0.0, length + SHAFT_OVERRUN, rows)
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


def camera_in_shaft(location, margin=1.0):
    """True if a camera at `location` sits inside the shaft prism (S14 rises up the beam)."""
    v = Vector(location) - SLOT_C
    t = v.dot(SHAFT_DIR)
    if t < 0:
        return False
    xl = Vector(_slot_x - SHAFT_DIR * _slot_x.dot(SHAFT_DIR)).normalized()
    yl = SHAFT_DIR.cross(xl)
    sp = 1.0 + 0.00022 * t
    x, y = abs(v.dot(xl)) / sp, abs(v.dot(yl)) / sp
    ax = max(x - 45.0, 0.0)
    return math.hypot(ax, y) < 22.5 * margin


def set_shaft_camera(h, visible):
    """Show or hide the shaft surface to camera (and reflection) rays. Hide it while the
    camera is inside the prism (it would read as a tunnel, also in the sea's mirror);
    look(state, inside_beam=True) adds the beam's glow as a silver veil from the mist pass."""
    sh = h['objects'].get('shaft')
    if sh is not None:
        sh.visible_camera = bool(visible)
        sh.visible_glossy = bool(visible)


def _blockers(objs):
    """Shadow-link collection (kept for API compatibility; the pre-lit cup needs no linking)."""
    coll = bpy.data.collections.get('OFF_PassThrough') or bpy.data.collections.new('OFF_PassThrough')
    for o in objs:
        if o is not None and o.name not in coll.objects:
            coll.objects.link(o)
    for co in coll.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    return coll


def _light_vis(L, camera=False, diffuse=True, glossy=True, transmission=True):
    L.visible_camera = camera
    L.visible_diffuse = diffuse
    L.visible_glossy = glossy
    L.visible_transmission = transmission
    L.visible_volume_scatter = False
    return L


def build_lights(coll, state, pass_coll=None):
    """Three lamps; the cup itself (wall and lid) is pre-lit and lights the world by bounce.

    sun:   down the shaft; the lid blocks it except at the hole (a real slot-shaped pool)
    key:   a soft warm area lamp standing in for the hot slot-side paper (diffuse only:
           modelling and lower noise on the landforms, no blob in the sea)
    top:   a broad disc under the lid centre; the moon dome fill at night
    glint: a tall narrow strip on the slot-side cliff, seen only by glossy rays, so the
           espresso, the paddies and the brass carry a glitter path under the shaft
    """
    lights = {}
    sun = C.sun_light('OFF_Sun', (0, 0, 0), energy=1.0, angle_deg=0.9, coll=coll)
    sun.rotation_euler = (-SHAFT_DIR).to_track_quat('Z', 'Y').to_euler()
    _light_vis(sun)
    lights['sun'] = sun
    zk = 270.0
    key = C.area_light('OFF_Key', _pol(_SLOT_AZ + 8.0, float(cup_radius(zk)) - 45.0, zk), target=(ISLAND_C.x * 0.4, ISLAND_C.y * 0.4, 0.0),
                       energy=1.0, size=300.0, size_y=240.0, shape='ELLIPSE', coll=coll)
    _light_vis(key, glossy=False)
    lights['key'] = key
    top = C.area_light('OFF_TopLight', (0, 0, 640.0), target=(0, 0, 0), energy=1.0, size=520.0, shape='DISK', coll=coll)
    _light_vis(top, glossy=False)
    lights['top'] = top
    zg = 150.0
    gpos = _pol(_SLOT_AZ - 6.0, float(cup_radius(zg)) - 14.0, zg)
    glint = C.area_light('OFF_Glint', gpos, target=(gpos.x * 0.2, gpos.y * 0.2, zg - 40.0), energy=1.0, size=10.0, size_y=200.0,
                         coll=coll)
    _light_vis(glint, diffuse=False, transmission=False)
    lights['glint'] = glint
    lights['ring'] = []
    lights['blooms'] = {}
    for L in (sun, key, top, glint):
        L.data.cycles.max_bounces = 4
    return lights


# Sun: W/m2 in the pool. Area lamps: watts. The wall and lid glow is in WALL_STATE.
DAY_LIGHT = dict(sun=4.6, sun_col=kelvin(5600), key=3.2e5, key_col=kelvin(3500), top=6.0e4, top_col=kelvin(5000),
                 glint=2.2e6, glint_col=kelvin(2900), bloom=WALL_STATE['day']['bloom'])
NIGHT_LIGHT = dict(sun=1.15, sun_col=(0.78, 0.84, 0.95), key=0.0, key_col=kelvin(3100), top=5.0e5,
                   top_col=(0.62, 0.7, 0.88), glint=4.0e5, glint_col=(0.75, 0.82, 0.95), bloom=WALL_STATE['night']['bloom'])


def apply_light_state(h, state, blooms=None):
    """Set lamp energies/colours and the wall's bloom values for 'day' or 'night'.

    blooms: attendee names whose exterior bloom glows in the paper (None = the
    state's default: all but Pat by day, Pat alone by night; () = none).
    """
    L = h['lights']
    p = DAY_LIGHT if state == 'day' else NIGHT_LIGHT
    L['sun'].data.energy = p['sun']
    L['sun'].data.color = p['sun_col']
    for k in ('key', 'top', 'glint'):
        if k in L:
            L[k].data.energy = p[k]
            L[k].data.color = p[k + '_col']
    on = set(bloom_names(state, blooms))
    for name, node in h.get('bloom_nodes', {}).items():
        node.outputs[0].default_value = p['bloom'] if name in on else 0.0


def key_bloom(h, name, frame, on, interp='CONSTANT'):
    """Key one attendee's colour bloom in the paper on/off (or to a level, 1 = nominal)."""
    node = h['bloom_nodes'][name]
    nominal = (DAY_LIGHT if h['state'] == 'day' else NIGHT_LIGHT)['bloom']
    if isinstance(on, bool):
        v = nominal if on else 0.0
    else:
        v = nominal * float(on)
    key_value(node, frame, v, interp)


def key_slot(h, frame, level, interp='BEZIER'):
    """Key the slot-sun brightness (1 = nominal). Drives the sun, sky, lid rim and shaft together.

    S01 eclipse: key_slot(h, 104, 1.0); key_slot(h, 124, 0.4) (build_eclipse does this).
    """
    st = h['state']
    base = DAY_LIGHT if st == 'day' else NIGHT_LIGHT
    sun = h['lights']['sun']
    sun.data.energy = base['sun'] * level
    sun.data.keyframe_insert('energy', frame=frame)
    for fc in C.fcurves(sun.data.animation_data.action):
        for kp in fc.keyframe_points:
            if abs(kp.co.x - frame) < 1e-4:
                kp.interpolation = interp
    for mat, node, nominal in ((h['mats'].get('lid'), 'SlotGlow', 1.0),
                               (h['mats'].get('shaft'), 'ShaftStrength', h['nominal']['shaft']),
                               (h['mats'].get('sky'), 'SkyStrength', h['nominal']['sky'])):
        if mat is not None:
            key_value(mat.node_tree.nodes[node], frame, nominal * level, interp)


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
    obj.cycles.use_deform_motion = False      # the swell moves ~1 cm per shutter: blur only the rig's tilt
    oc.time = 0.0
    oc.keyframe_insert('time', frame=0)
    oc.time = 1440 / 24.0 * 0.55
    oc.keyframe_insert('time', frame=1440)
    for fc in C.fcurves(obj.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
        fc.extrapolation = 'LINEAR'
    return obj


def _floe_blob(rng, x, y, size, seed, m=16):
    """One lacy floe: an irregular fan, sometimes broken into 2-4 drifting pieces."""
    pieces = 1 if size < 0.8 or rng.uniform() < 0.55 else int(rng.integers(2, 5))
    verts, faces, rim = [], [], []
    base = 0
    for k in range(pieces):
        s = size * (1.0 if pieces == 1 else rng.uniform(0.35, 0.7))
        ox, oy = (0.0, 0.0) if k == 0 else rng.normal(0, size * 0.6, 2)
        ang = np.linspace(0, 2 * np.pi, m, endpoint=False)
        rad = s * (0.72 + 0.38 * vnoise2(np.cos(ang) * 1.7 + seed * 3.1 + k, np.sin(ang) * 1.7, seed=seed))
        rad *= np.where(rng.uniform(size=m) < 0.25, 0.62, 1.0)
        ring = np.stack([x + ox + rad * np.cos(ang), y + oy + rad * np.sin(ang), np.full(m, 0.25)], axis=1)
        verts.append([[x + ox, y + oy, 0.3 + 0.05 * s]])
        verts.append(ring)
        rim.append(np.r_[1.0, np.zeros(m)])
        kk = np.arange(m)
        faces.append(np.stack([np.full(m, base), base + 1 + kk, base + 1 + (kk + 1) % m], axis=1))
        base += m + 1
    return np.vstack(verts), np.vstack(faces), np.concatenate(rim)


def build_floes(coll, mat, land_fn, seed=3, n=70, near=None, near_n=0, near_r=(2.0, 80.0)):
    """Crema foam floes: lacy blobs, denser near shores and the cliff foot.

    near: optional camera path, a list of (x, y) points; near_n extra floes of
    0.3-4 m are scattered within near_r metres of it, so a lens at human scale
    has foam drifting past it (S01 glide, the S08 foreground).
    """
    rng = np.random.default_rng(seed)
    verts, faces, rims = [], [], []
    base = 0

    def ok(x, y):
        lm = land_fn(np.array([x]), np.array([y]))
        return lm[0][0] <= 0.02 and lm[2][0] <= 0.6 and math.hypot(x, y) < R_SEA - 1.0

    def add(x, y, size, i):
        nonlocal base
        V, F, rm = _floe_blob(rng, x, y, size, i)
        verts.append(V)
        rims.append(rm)
        faces.append(F + base)
        base += len(V)

    placed = tries = 0
    while placed < n and tries < n * 20:
        tries += 1
        r = R_SEA * math.sqrt(rng.uniform(0.0, 1.0))
        if rng.uniform() < 0.45:
            r = R_SEA - rng.exponential(18.0) - 4.0
        a = rng.uniform(0, 2 * np.pi)
        x, y = r * math.cos(a), r * math.sin(a)
        if not ok(x, y):
            continue
        add(x, y, float(np.clip(rng.lognormal(0.4, 0.6), 0.6, 5.0)), placed)
        placed += 1
    if near is not None and near_n > 0:
        path = np.asarray(near, dtype=float).reshape(-1, 2)
        placed = tries = 0
        while placed < near_n and tries < near_n * 20:
            tries += 1
            c = path[rng.integers(0, len(path))]
            rr = math.sqrt(rng.uniform(near_r[0] ** 2, near_r[1] ** 2))
            a = rng.uniform(0, 2 * np.pi)
            x, y = c[0] + rr * math.cos(a), c[1] + rr * math.sin(a)
            if not ok(x, y):
                continue
            add(x, y, float(np.clip(rng.lognormal(-0.1, 0.7), 0.3, 4.0)), 10000 + placed)
            placed += 1
    obj = np_mesh('OFF_Floes', np.vstack(verts), [np.vstack(faces)], coll=coll, mat=mat)
    set_attr(obj.data, 'rim', np.concatenate(rims))
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


def land_masks(X, Y, parts, shelf=None):
    """(land, lagoon, shelf) masks over world arrays for the parts that are present.

    The lagoon mask is depth-graded: bright over the shallow sand inside the ring,
    dark over the deep centre.
    """
    X = np.asarray(X, dtype=float)
    Y = np.asarray(Y, dtype=float)
    land = np.zeros(X.shape)
    lag = np.zeros(X.shape)
    reef = np.zeros(X.shape)
    if 'island' in parts:
        h = _boxed(X, Y, island_h, ISLAND_C, 78.0, -10.0)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
        reef = np.maximum(reef, np.clip((h + 4.0) / 4.0, 0, 1))
    if 'atoll' in parts:
        h = _boxed(X, Y, lambda x, y: atoll_h(x, y)[0], ATOLL_C, 118.0, -10.0)
        lg = _boxed(X, Y, lambda x, y: atoll_h(x, y)[1], ATOLL_C, 118.0, 0.0)
        dd = np.hypot(X - ATOLL_C.x, Y - ATOLL_C.y)
        R0 = OFFLINE['atoll_radius']
        lg = lg * (0.1 + 0.9 * smoothstep(R0 - 52.0, R0 - 16.0, dd) ** 1.4)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
        reef = np.maximum(reef, np.clip((h + 4.5) / 4.5, 0, 1) * 0.8)
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
    if shelf is not None:
        h = _boxed(X, Y, lambda x, y: shelf_h(x, y, shelf), shelf[:2], shelf[2] * 1.1, -10.0)
        land = np.maximum(land, np.clip(h / 0.4, 0, 1))
    return land, lag, reef


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


# body half extents (x, y, z), corner radius, shackle half-width, shackle top (z), wire radius, open angle (deg)
PADLOCK_VARIANTS = (
    (0.31, 0.13, 0.26, 0.07, 0.19, 0.75, 0.048, 0.0),     # classic
    (0.25, 0.12, 0.31, 0.06, 0.15, 0.84, 0.042, 0.0),     # tall, narrow
    (0.36, 0.14, 0.21, 0.08, 0.22, 0.62, 0.054, 0.0),     # wide, squat, heavy shackle
    (0.28, 0.12, 0.25, 0.07, 0.17, 0.96, 0.040, 0.0),     # long shackle
    (0.31, 0.13, 0.26, 0.07, 0.19, 0.75, 0.048, 38.0),    # classic, shackle sprung open
    (0.34, 0.14, 0.22, 0.08, 0.21, 0.66, 0.052, 75.0),    # squat, shackle swung open
)


def padlock_template(open_shackle=False, variant=0):
    """Padlock about 1 unit tall, origin at the body's bottom centre, keyhole-free.

    A rounded brass body (broad faces along +-Y) and a round-section U shackle
    rising out of its top. variant picks body proportions, shackle height and
    open angle from PADLOCK_VARIANTS; open_shackle=True swings a closed variant
    75 degrees open. The faces are plain: no keyway, no boss, nothing that can
    read as a glyph.
    """
    hx, hy, hz, rad, sw, top, wr, open_deg = PADLOCK_VARIANTS[variant % len(PADLOCK_VARIANTS)]
    if open_shackle and not open_deg:
        open_deg = 75.0
    Vb, Fb = _rounded_box(hx, hy, hz, rad, n=7)
    t = np.linspace(0, 1, 34)
    leg0 = 2 * hz - 0.1
    straight = top - leg0
    pts = []
    for s in t:
        if s < 0.3:
            pts.append((-sw, 0.0, leg0 + (s / 0.3) * straight))
        elif s < 0.7:
            a = np.pi * (1 - (s - 0.3) / 0.4)
            pts.append((sw * np.cos(a), 0.0, top + sw * np.sin(a)))
        else:
            pts.append((sw, 0.0, top - ((s - 0.7) / 0.3) * straight))
    P = np.array(pts)
    if open_deg:
        P[:, 2] += 0.12
        ang = math.radians(open_deg)
        pv = np.array([-sw, 0.0])
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
    Vs = (P[:, None] + ring * wr).reshape(-1, 3)
    Fs = grid_faces(sides, len(P), wrap_u=True) + len(Vb)
    c0 = len(Vb) + len(Vs)
    k = np.arange(sides)
    caps = np.vstack([np.stack([np.full(sides, c0), len(Vb) + (k + 1) % sides, len(Vb) + k], 1),
                      np.stack([np.full(sides, c0 + 1), len(Vb) + (len(P) - 1) * sides + k,
                                len(Vb) + (len(P) - 1) * sides + (k + 1) % sides], 1)])
    V = np.vstack([Vb, Vs, P[0] - T[0] * wr * 0.6, P[-1] + T[-1] * wr * 0.6])
    obj = np_mesh('PadlockT', V, [Fb, Fs, caps])
    obj['padlock_variant'] = variant
    return obj


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
                               lambda X, Y: island_h(X, Y), coll=coll, mat=mats['stone'], skirt=-70.0)
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
    V = np.vstack([np.c_[out, np.full(m, 5.16)], np.c_[out * 0.94, np.full(m, 5.06)], [[0, 0, 5.06]]])   # sits on the roof
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


def _arch_frames(P):
    """Tangent and two normals along the arch centreline (N1 horizontal, N2 = T x N1)."""
    tang = np.gradient(P, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True)
    N1 = np.cross(tang, [0, 0, 1.0])
    N1 /= np.maximum(np.linalg.norm(N1, axis=1, keepdims=True), 1e-6)
    N2 = np.cross(tang, N1)
    return tang, N1, N2


def _core_radius(R, P):
    return R * (0.68 + 0.2 * smoothstep(0.62, 0.95, P[:, 2] / 121.0))


def padlock_shell(seed=5, period=1.72, layers=((0.0, 0.0), (0.5, 0.11))):
    """Instance placement for the arch's shell of interlocked padlocks.

    Padlocks lie flat on the stone core in rows that run along the arch. Along
    a row they alternate shackle-up / shackle-down so neighbouring shackles
    overlap and link like a chain (vertebrae), the broad faces face outward,
    and a second, staggered layer sits over the joints. Returns arrays: pts,
    rotation matrices, scale, age, variant.
    """
    rng = np.random.default_rng(seed)
    P, R, T = arch_curve(0.5)
    core_r = _core_radius(R, P)
    tang, N1, N2 = _arch_frames(P)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    S = np.concatenate([[0], np.cumsum(seg)])
    crest_s = S[int(np.argmax(P[:, 2]))]
    pts, rots, scl, age, var = [], [], [], [], []
    for li, (s_off, lift) in enumerate(layers):
        n_rows = 11 if li == 0 else 10
        for row in range(n_rows):
            a_row = 2 * np.pi * (row + 0.5 * li) / n_rows + rng.uniform(-0.12, 0.12)
            s = rng.uniform(0, 6.0) + s_off * 9.5
            k = 0
            while s < S[-1]:
                sc = rng.uniform(8.5, 13.5)
                i = int(np.searchsorted(S, s).clip(0, len(S) - 1))
                a = a_row + rng.normal(0, 0.06)
                radial = np.cos(a) * N1[i] + np.sin(a) * N2[i]
                z_here = P[i, 2]
                hn = float(np.clip(z_here / 122.0, 0, 1))
                ag = float(np.clip(hn * 1.05 + 0.1 * vnoise3(P[i, 0] / 25, P[i, 1] / 25, P[i, 2] / 25, 7)
                                   + rng.uniform(-0.06, 0.06) - 0.03, 0, 1))
                fuse = smoothstep(0.72, 0.95, ag)              # the oldest sink into the stone
                up = 1.0 if (k % 2 == 0) == (s < crest_s) else -1.0
                # shackle along the arch, leaning out; alternate pairs face each other
                lean = math.radians(rng.uniform(0, 8) + (5 if k % 2 else 0) + 6 * smoothstep(0.75, 0.95, hn))
                zdir = tang[i] * up * math.cos(lean) + radial * math.sin(lean)
                roll = rng.normal(0, 0.12)
                side = np.cross(radial, zdir)
                ydir = radial * math.cos(roll) + side * math.sin(roll)
                ydir = ydir - zdir * np.dot(ydir, zdir)
                Rm = frame_from(zdir[None], ydir[None])[0]
                hz_body = 0.26 * sc
                centre = P[i] + radial * (core_r[i] + (0.12 + lift - 0.13 * fuse) * sc * 1.0)
                origin = centre - zdir * hz_body                  # template origin is the body's bottom
                if origin[2] > -4.0:
                    pts.append(origin)
                    rots.append(Rm)
                    scl.append(sc)
                    age.append(ag)
                    var.append(int(rng.integers(0, 4)) if rng.uniform() < 0.9 else int(rng.integers(4, len(PADLOCK_VARIANTS))))
                # advance: half a pair period per padlock (pairs interlock at the shackles)
                s += period * sc * 0.5 * rng.uniform(0.92, 1.08)
                k += 1
    return np.array(pts), np.array(rots), np.array(scl), np.array(age), np.array(var)


def _template_tris(obj):
    me = obj.data
    V = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    V = V.reshape(-1, 3)
    tris = []
    for p in me.polygons:
        vs = list(p.vertices)
        for j in range(1, len(vs) - 1):
            tris.append((vs[0], vs[j], vs[j + 1]))
    return V, np.array(tris)


def crest_surface(core_obj, tmpl_objs, pts, rots, scl, var, n=200, seed=43, zmin=93.0):
    """Points (n,3) and normals on the arch's top surface (core + padlock shell), by ray casting."""
    from mathutils.bvhtree import BVHTree
    rng = np.random.default_rng(seed)
    me = core_obj.data
    Vc = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', Vc)
    Vc = Vc.reshape(-1, 3)
    Mw = np.array(core_obj.matrix_world)
    Vc = Vc @ Mw[:3, :3].T + Mw[:3, 3]
    Vs, Fs = [Vc], [np.array([list(p.vertices) for p in me.polygons if len(p.vertices) == 4])]
    tri_faces = [np.array([list(p.vertices) for p in me.polygons if len(p.vertices) == 3])]
    base = len(Vc)
    tm = [_template_tris(o) for o in tmpl_objs]
    sel = np.nonzero(pts[:, 2] > zmin - 25.0)[0]
    tri_list = []
    for i in sel:
        V, F = tm[int(var[i]) % len(tm)]
        W = (V * scl[i]) @ rots[i].T + pts[i]
        Vs.append(W)
        tri_list.append(F + base)
        base += len(W)
    verts = np.vstack(Vs)
    polys = [list(f) for f in Fs[0]] + [list(f) for f in tri_faces[0] if len(tri_faces[0])] + \
        [list(f) for F in tri_list for f in F]
    bvh = BVHTree.FromPolygons([tuple(v) for v in verts], polys)
    P, R, T = arch_curve(0.5)
    core_r = _core_radius(R, P)
    tang, N1, N2 = _arch_frames(P)
    top = np.nonzero(P[:, 2] > zmin)[0]
    out_p, out_n = [], []
    tries = 0
    while len(out_p) < n and tries < n * 30:
        tries += 1
        i = int(rng.choice(top))
        lat = rng.normal(0, 0.42) * core_r[i]
        q = P[i] + N1[i] * lat
        hit = bvh.ray_cast(Vector((q[0], q[1], P[i, 2] + 60.0)), Vector((0, 0, -1.0)), 120.0)
        if hit[0] is None:
            continue
        nrm = np.array(hit[1])
        if nrm[2] < 0.45:
            continue
        out_p.append(np.array(hit[0]))
        out_n.append(nrm)
    return np.array(out_p), np.array(out_n)


def pine_templates(mats):
    """The shared pine template collection, always with needle and bark materials."""
    coll = bpy.data.collections.get('OFF_PineTmpl')
    if coll is not None and len(coll.objects):
        return coll
    coll = template_collection('OFF_PineTmpl', [pine_template(s) for s in range(3)])
    for o in coll.objects:
        o.data.materials.append(mats['pine'])
        o.data.materials.append(mats['bark'])
        for poly in o.data.polygons[:6]:
            poly.material_index = 1                    # the trunk ring
    return coll


def build_arch(coll, mats, seed=5, n_pines=200):
    """~600 interlocked padlocks on a stone core, scree mounds at its feet, pines on the crest."""
    rng = np.random.default_rng(seed)
    out = {}
    P, R, T = arch_curve(1.0)

    def core_disp(V, ring):
        n = fbm3(V[..., 0] / 9.0, V[..., 1] / 9.0, V[..., 2] / 9.0, 3, seed=91)
        return ring * (2.6 * n)[..., None]

    core_r = _core_radius(R, P)
    out['core'] = tube_along(P, core_r, sides=40, name='OFF_ArchCore', coll=coll, mat=mats['arch_stone'], disp=core_disp)
    pts, rots, scl, age, var = padlock_shell(seed)
    tobjs = [padlock_template(False, v) for v in range(len(PADLOCK_VARIANTS))]
    tmpl = template_collection('OFF_PadlockTmpl', tobjs)
    for o in tmpl.objects:
        o.data.materials.append(mats['padlock'])
        for poly in o.data.polygons:
            poly.use_smooth = True
    out['padlocks'] = instancer('OFF_ArchPadlocks', pts, tmpl, rot=rots, scl=scl, var=var,
                                attrs={'age': age}, coll=coll)
    out['n_padlocks'] = len(pts)
    # scree mounds and loose padlocks at the feet
    fl, fr = arch_feet()
    mounds = []
    for c, w in ((fl, 62.0), (fr, 48.0)):
        o, X, Y, Z = heightfield('OFF_ArchScree', c.x, c.y, w, w, 0.7, lambda X, Y: mound_h(X, Y), coll=coll,
                                 mat=mats['scree'], skirt=-70.0)
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
            sp.append((x, y, hz - rng.uniform(0.6, 2.2)))
            sz.append(rng.normal(0, 1, 3) + [0, 0, 0.3])
            sy.append(rng.normal(0, 1, 3))
            ss.append(rng.uniform(5.0, 11.5))
            sa.append(rng.uniform(0.0, 0.42) if rng.uniform() < 0.85 else rng.uniform(0.4, 0.75))
            sv.append(int(rng.integers(0, len(PADLOCK_VARIANTS))))
            cnt += 1
    out['scree'] = instancer('OFF_ScreePadlocks', sp, tmpl, rot=frame_from(np.array(sz), np.array(sy)),
                             scl=np.array(ss), var=sv, attrs={'age': np.array(sa)}, coll=coll)
    # pines on the crest: ray cast onto the core and the padlock shell, standing up from the surface
    cp, cn = crest_surface(out['core'], tobjs, pts, rots, scl, var, n=n_pines, seed=seed + 40)
    ptm = pine_templates(mats)
    k = len(cp)
    tilt = cn * 0.25 + np.array([0, 0, 1.0])
    pr = frame_from(tilt, np.c_[np.cos(rng.uniform(0, 6.3, k)), np.sin(rng.uniform(0, 6.3, k)), np.zeros(k)])
    psz = np.clip(rng.lognormal(math.log(4.8), 0.3, k), 3.0, 8.0)
    out['pines'] = instancer('OFF_ArchPines', cp - np.array([0, 0, 0.25]), ptm, rot=pr, scl=psz,
                             var=rng.integers(0, 3, k), coll=coll)
    out['crest'] = Vector(P[int(np.argmax(P[:, 2]))]) + Vector((0, 0, core_r[int(np.argmax(P[:, 2]))]))
    out['crest_surface'] = (cp, cn)
    out['pine_tmpl'] = ptm
    out['padlock_tmpl'] = tmpl
    return out


def hero_padlock_rest():
    """Where the S06 padlock comes to rest: on the big scree slope, in the S06 opening frame."""
    fl, _ = arch_feet()
    p = fl - ARCH_FACE * 6.0 + ARCH_FACE * 15.0 + ARCH_SPAN * 9.0
    z = float(mound_h(np.array([p.x]), np.array([p.y]))[0])
    return Vector((p.x, p.y, z + 0.6))


HERO_SCALE = 11.0


def build_hero_padlock(coll, tmpl_obj=None):
    src = padlock_template(False, 0)
    src.name = 'OFF_HeroPadlock'
    for poly in src.data.polygons:
        poly.use_smooth = True
    src.data.materials.append(mat_padlock(age=0.03))
    for c in src.users_collection:
        c.objects.unlink(src)
    coll.objects.link(src)
    src.scale = (HERO_SCALE,) * 3
    src.rotation_mode = 'QUATERNION'
    src.rotation_quaternion = Euler((math.radians(84), math.radians(8), math.atan2(ARCH_FACE.y, ARCH_FACE.x) + 0.5)).to_quaternion()
    src.location = hero_padlock_rest()
    _sit_on_scree(src, src.location, src.rotation_quaternion)
    C.bevel(src, width=0.004, segments=2, angle=50)
    return src


def _hero_local_verts(obj):
    me = obj.data
    V = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    return V.reshape(-1, 3) * np.array(obj.scale)


def _sit_on_scree(obj, loc, quat, lift=0.0):
    """Set obj.location so its lowest vertex (at orientation quat) rests on the scree at loc.xy."""
    V = _hero_local_verts(obj) @ np.array(quat.to_matrix()).T
    j = int(np.argmin(V[:, 2]))
    cx, cy = loc.x + V[j, 0], loc.y + V[j, 1]
    ground = float(np.maximum(mound_h(np.array([cx]), np.array([cy]))[0], 0.0))
    obj.location = Vector((loc.x, loc.y, ground - V[j, 2] + lift))
    return obj.location.copy()


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


def animate_hero_padlock(h, f_start=529, f_land=553, f_bounce=566, f_settle=578, start=None, impact_speed=85.0):
    """Keyframe the S06 hero padlock: the last second of a long fall, one hop, slide, settle.

    A padlock the size of a three-storey building dropped from the lid falls
    for about nine seconds; the shot sees the last (f_land - f_start) frames of
    it, arriving at `impact_speed` m/s (so it reads as huge, not as a toy). It
    tumbles about one axis (1.5 turns, so it flashes gold as it turns), lands
    on the scree in an orientation near its rest pose, hops once (~3 m), slides
    and settles. Orientation is keyed as quaternions (no Euler unwinding) and
    every key after the landing is solved against the scree so the lowest
    vertex sits on the surface. start: optional position at f_start (default:
    straight above the landing, drifting in from the slot side). A dust puff
    fires on landing.
    """
    hp = h['objects']['hero_padlock']
    hp.rotation_mode = 'QUATERNION'
    rest_loc = hero_padlock_rest()
    rest_q = Euler((math.radians(84), math.radians(8), math.atan2(ARCH_FACE.y, ARCH_FACE.x) + 0.5)).to_quaternion()
    land_xy = rest_loc + ARCH_SPAN * 6.0 + ARCH_FACE * 5.0
    tilt_axis = Vector(ARCH_SPAN).cross(Vector((0, 0, 1))).normalized()
    land_q = Quaternion(tilt_axis, 0.55) @ rest_q
    tumble_axis = (Vector(ARCH_SPAN) * 0.8 + Vector((0, 0, 0.35))).normalized()
    g = 9.81
    T = (f_land - f_start) / 24.0
    v0 = impact_speed - g * T
    drop = v0 * T + 0.5 * g * T * T
    probe = hp.location.copy()
    land = _sit_on_scree(hp, land_xy, land_q)
    hp.location = probe
    if start is None:
        start = land + Vector((0, 0, drop)) - ARCH_FACE * (0.1 * drop)
    start = Vector(start)
    turns = 1.5 * 2 * math.pi
    for i in range(f_land - f_start + 1):
        t = i / (f_land - f_start)
        tt = t * T
        e = (v0 * tt + 0.5 * g * tt * tt) / drop
        hp.location = start.lerp(land, e)
        hp.rotation_quaternion = Quaternion(tumble_axis, -turns * (1.0 - t) ** 1.15) @ land_q
        hp.keyframe_insert('location', frame=f_start + i)
        hp.keyframe_insert('rotation_quaternion', frame=f_start + i)
    # one hop toward the rest pose, then slide and settle; every key sits on the scree
    mid = rest_loc + ARCH_SPAN * 2.0
    for i in range(1, f_bounce - f_land + 1):
        t = i / (f_bounce - f_land)
        q = land_q.slerp(rest_q, 0.65 * t)
        xy = land.lerp(mid, t)
        _sit_on_scree(hp, xy, q, lift=3.2 * 4 * t * (1 - t))
        hp.rotation_quaternion = q
        hp.keyframe_insert('location', frame=f_land + i)
        hp.keyframe_insert('rotation_quaternion', frame=f_land + i)
    q_mid = land_q.slerp(rest_q, 0.65)
    for i in range(1, f_settle - f_bounce + 1):
        t = C.ease(i / (f_settle - f_bounce), 'out')
        q = q_mid.slerp(rest_q, t)
        _sit_on_scree(hp, mid.lerp(rest_loc, t), q)
        hp.rotation_quaternion = q
        hp.keyframe_insert('location', frame=f_bounce + i)
        hp.keyframe_insert('rotation_quaternion', frame=f_bounce + i)
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
                               lambda X, Y: atoll_h(X, Y)[0], coll=coll, mat=mats['sand'], skirt=-70.0)
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
    low, Fs = grid_skirt(V, len(xs), len(ys), -70.0)
    ground = np_mesh('OFF_Terraces', np.vstack([V, low]), [F, Fs], coll=coll, mat=mats['terrace_ground'])
    set_attr(ground.data, 'grass', np.concatenate([grass.ravel(), np.zeros(len(low))]))
    out['ground'] = ground
    # water mirrors: one flat face per grid cell inside a paddy, at that paddy's water level
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
    pick = rng.choice(len(gx), size=grass_count, replace=grass_count > len(gx))
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
        out['summit_pines'] = instancer('OFF_SummitPines', tp, pine_templates(mats),
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
FALLS_HALF = 40.0                     # half-width (m) of the day curtain at the lip
FADE_S = 0.16                         # sheets grow in / shrink out over this long (s): no motion-blur streaks


def falls_lip(u):
    """Lip height (m) of the torn ledge edge at lateral offset u (m)."""
    u = np.asarray(u, dtype=float)
    return FALLS_Z - 5.0 + 5.5 * fbm2(u / 11.0, 0.37 * np.ones_like(u), 3, seed=27) - 0.0025 * u * u


def falls_positions(n, frames, seed=21, night=False):
    """Closed-form ballistic stream of n looping sheets; returns (len(frames), n*4, 3) float32.

    Each sheet slides off the torn lip with an outward throw, arcs away from the
    cliff with drag, falls toward a 68 m/s terminal speed, fans out with
    flutter that grows with the drop, and tumbles about its own axis. The
    curtain breaks into lanes of uneven weight with real gaps between them.
    Every sheet grows from zero size over its first FADE_S seconds and shrinks
    back to zero just before it lands, where it stays (zero size) until it
    loops: a wrap goes from a zero quad to a zero quad, so motion blur never
    draws a streak and nothing collapses to the heap centre.
    """
    rng = np.random.default_rng(seed)
    az = math.radians(FALLS_AZ)
    radial = np.array([math.cos(az), math.sin(az), 0.0])
    inward = -radial
    tang = np.array([-math.sin(az), math.cos(az), 0.0])
    lip0 = np.array(_pol(FALLS_AZ, float(cup_radius(FALLS_Z)) - 27.0, 0.0))
    half = 7.0 if night else FALLS_HALF
    nl = 3 if night else 9
    lanes = np.sort(rng.uniform(-half * 0.9, half * 0.9, nl))
    lane_w = rng.uniform(1.2, 4.5, nl)
    weight = rng.uniform(0.2, 1.0, nl) ** 1.6
    pick = rng.choice(nl, size=n, p=weight / weight.sum())
    u0 = np.where(rng.uniform(size=n) < 0.9, lanes[pick] + rng.normal(0, 1, n) * lane_w[pick],
                  rng.uniform(-half, half, n))
    lz = falls_lip(u0)
    v0 = rng.uniform(7.0, 15.0, n)
    vz = rng.uniform(-2.0, 2.5, n)
    phase = rng.uniform(0, FALLS_CYCLE, n)
    amp = np.clip(rng.lognormal(-0.9, 0.7, n), 0.08, 2.2)        # most sheets ride the core, a few fly wide
    w = rng.uniform(0.8, 2.6, (n, 3))
    ph = rng.uniform(0, 2 * np.pi, (n, 3))
    ax = rng.normal(0, 1, (n, 3))
    ax /= np.linalg.norm(ax, axis=1, keepdims=True)
    spin = rng.uniform(2.0, 8.0, n) * np.where(rng.uniform(size=n) < 0.5, -1, 1)
    sz = rng.uniform(0.85, 1.15, n)
    vt, tz, th = 68.0, 2.4, 2.6

    def drop_at(t):
        return vt * (t - tz * (1 - np.exp(-t / tz))) - vz * t

    # landing time per sheet (the heap surface is ~3 m above the sea): Newton on drop(t) = lz - 3
    target = lz - 3.0
    tl = np.full(n, 6.0)
    for _ in range(8):
        f = drop_at(tl) - target
        df = vt * (1 - np.exp(-tl / tz)) - vz
        tl = np.clip(tl - f / np.maximum(df, 1.0), 0.3, FALLS_CYCLE - 0.05)
    out = np.empty((len(frames), n * 4, 3), np.float32)
    base_rot = frame_from(np.tile([0, 0, 1.0], (n, 1)), np.tile(inward, (n, 1)))
    for fi, f in enumerate(frames):
        t = np.mod(f / 24.0 + phase, FALLS_CYCLE)
        te = np.minimum(t, tl)                               # landed sheets stay where they landed
        drop = drop_at(te)
        out_d = v0 * th * (1 - np.exp(-te / th))
        A = (0.35 + 0.07 * drop) * amp
        lat = u0 * (1 + 0.0025 * drop) + A * (np.sin(w[:, 0] * te + ph[:, 0]) + 0.5 * np.sin(2.3 * w[:, 1] * te + ph[:, 1]))
        rad = out_d + 0.6 * A * np.sin(w[:, 2] * te + ph[:, 2])
        pos = lip0[None] + inward[None] * rad[:, None] + tang[None] * lat[:, None]
        pos[:, 2] = lz - drop
        ang = spin * np.maximum(te - 0.25, 0) ** 1.15
        R = _rodrigues(ax, ang) @ base_rot
        grow = smoothstep(0.0, FADE_S, t) * (1 - smoothstep(tl - FADE_S, tl, t))
        corners = np.einsum('nij,kj->nki', R, SHEET_QUAD) * (sz * grow)[:, None, None]
        out[fi] = (corners + pos[:, None, :]).reshape(-1, 3)
    return out


SPRAY_CYCLE = 2.6


def spray_positions(n, frames, seed=25, scale=0.45):
    """Paper spray at the falls' base: small sheets thrown up and out of the heap, looping, fading in/out."""
    rng = np.random.default_rng(seed)
    c = np.array(falls_base_pos())
    az = rng.uniform(0, 2 * np.pi, n)
    r0 = np.abs(rng.normal(0, 12.0, n))
    vh = rng.uniform(3.0, 11.0, n)
    vz = rng.uniform(6.0, 17.0, n)
    phase = rng.uniform(0, SPRAY_CYCLE, n)
    dur = rng.uniform(1.4, SPRAY_CYCLE - 0.1, n)
    ax = rng.normal(0, 1, (n, 3))
    ax /= np.linalg.norm(ax, axis=1, keepdims=True)
    spin = rng.uniform(4.0, 12.0, n)
    dirs = np.stack([np.cos(az), np.sin(az), np.zeros(n)], 1)
    out = np.empty((len(frames), n * 4, 3), np.float32)
    for fi, f in enumerate(frames):
        t = np.minimum(np.mod(f / 24.0 + phase, SPRAY_CYCLE), dur)
        h = r0 + vh * 1.8 * (1 - np.exp(-t / 1.8))
        z = 6.0 + vz * 1.2 * (1 - np.exp(-t / 1.2)) - 4.5 * t * t
        pos = c[None] + dirs * h[:, None]
        pos[:, 2] = np.maximum(z, 1.0)
        grow = smoothstep(0.0, FADE_S, t) * (1 - smoothstep(dur - FADE_S, dur, t))
        R = _rodrigues(ax, spin * t)
        corners = np.einsum('nij,kj->nki', R, SHEET_QUAD * scale) * grow[:, None, None]
        out[fi] = (corners + pos[:, None, :]).reshape(-1, 3)
    return out


def build_falls(coll, mats, state, frames, cache_dir, seed=21):
    """The binder's pages: torn ledge, falling sheets (PC2), heap of sheets, paper spray at the base."""
    out = {}
    az = math.radians(FALLS_AZ)
    radial = Vector((math.cos(az), math.sin(az), 0))
    tang = Vector((-math.sin(az), math.cos(az), 0))
    # ledge: a drooping paper shelf with a torn lip that the sheets pour over
    ws = np.linspace(-46, 46, 93)
    ds = np.linspace(-6, 30, 37)
    W, D = np.meshgrid(ws, ds)
    rw = float(cup_radius(FALLS_Z))
    lipn = 2.5 * fbm2(W / 6.0, 0.0 * W, 2, seed=29) + 1.2 * fbm2(W / 1.7, 0.0 * W + 3, 2, seed=30)
    D2 = np.minimum(D, 28.0 + lipn - 6.0 * (np.abs(W) / 46.0) ** 2)
    Zl = FALLS_Z - 0.17 * np.clip(D2, 0, None) - 0.003 * W ** 2 + 0.6 * fbm2(W / 5.0, D2 / 5.0, 2, seed=28)
    P = (np.array(radial)[None, None] * (rw - D2)[..., None] + np.array(tang)[None, None] * W[..., None])
    V = np.dstack([P[..., 0], P[..., 1], Zl]).reshape(-1, 3)
    ledge = np_mesh('OFF_FallsLedge', V, grid_faces(len(ws), len(ds))[:, ::-1], coll=coll, mat=mats['sheet'])
    sol = ledge.modifiers.new('Thick', 'SOLIDIFY')
    sol.thickness = 2.6
    out['ledge'] = ledge
    # falling sheets
    n = 500 if state == 'night' else 22000
    a, b = frames
    fr = list(range(a - 2, b + 3))
    # closed form and cheap: always rebuilt, so parameter changes can never meet a stale cache
    path = os.path.join(cache_dir, f'falls_{state}_{n}_{seed}_{fr[0]}_{fr[-1]}.pc2')
    PC.write_pc2(path, falls_positions(n, fr, seed, night=(state == 'night')), start=fr[0])
    Vt = np.tile(SHEET_QUAD, (n, 1)) + np.repeat(np.array(_pol(FALLS_AZ, rw, FALLS_Z))[None], n * 4, 0)
    Ft = np.arange(n * 4).reshape(-1, 4)
    sheets = np_mesh('OFF_FallsSheets', Vt, Ft, coll=coll, mat=mats['sheet_falls'], smooth=False)
    set_attr(sheets.data, 'tint', np.repeat(np.random.default_rng(seed + 1).uniform(0, 1, n), 4))
    PC.attach_pc2(sheets, path, fr[0])
    out['sheets'] = sheets
    # heap at the base: a white mound under a few thousand resting sheets
    c = falls_base_pos()
    hob, X, Y, Z = heightfield('OFF_FallsHeapMound', c.x, c.y, 50.0, 50.0, 1.0, lambda X, Y: heap_h(X, Y),
                               coll=coll, mat=mats['sheet'], skirt=-70.0)
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
    corners = np.einsum('nij,kj->nki', R, SHEET_QUAD * 1.0) + np.stack([hx, hy, hz], 1)[:, None]
    heap = np_mesh('OFF_FallsHeap', corners.reshape(-1, 3), np.arange(k * 4).reshape(-1, 4), coll=coll,
                   mat=mats['sheet'], smooth=False)
    set_attr(heap.data, 'tint', np.repeat(rng.uniform(0, 1, k), 4))
    out['heap'] = heap
    # spray: small sheets thrown up out of the heap (no translucent cards)
    ns = 70 if state == 'night' else 900
    spath = os.path.join(cache_dir, f'spray_{state}_{ns}_{seed}_{fr[0]}_{fr[-1]}.pc2')
    PC.write_pc2(spath, spray_positions(ns, fr, seed + 4), start=fr[0])
    Vs = np.tile(SHEET_QUAD * 0.45, (ns, 1)) + np.repeat(np.array(c)[None], ns * 4, 0)
    spray = np_mesh('OFF_FallsSpray', Vs, np.arange(ns * 4).reshape(-1, 4), coll=coll, mat=mats['sheet_falls'], smooth=False)
    set_attr(spray.data, 'tint', np.repeat(rng.uniform(0, 1, ns), 4))
    PC.attach_pc2(spray, spath, fr[0])
    out['spray'] = spray
    out['mist'] = []                      # the old spray cards are gone (they read as ovals)
    return out


# ================================================================== origami birds

BIRD_SCALE = 0.7              # ~4.2 m span: small against the cliffs, a particulate ribbon
BIRD = np.array([[0.0, 0.0, -0.35], [0.0, 2.7, 0.35], [0.0, -2.5, 0.25], [0.55, 0.9, 0.0], [-0.55, 0.9, 0.0],
                 [3.0, -0.7, 0.3], [-3.0, -0.7, 0.3]]) * BIRD_SCALE
BIRD_F = np.array([[0, 1, 3], [0, 3, 5], [0, 5, 2], [0, 2, 6], [0, 6, 4], [0, 4, 1]])
BIRD_ROOST = np.array([[0.0, 0.0, -0.35], [0.0, 2.2, 0.75], [0.0, -2.3, 0.15], [0.45, 0.6, 0.1], [-0.45, 0.6, 0.1],
                       [0.9, -1.4, 1.5], [-0.9, -1.4, 1.5]]) * BIRD_SCALE
ENVELOPE = np.array([[0.0, 0.0, 0.22], [0.0, 1.55, 0.05], [0.0, -1.55, 0.05], [2.2, 1.55, 0.0], [-2.2, 1.55, 0.0],
                     [2.2, -1.55, 0.0], [-2.2, -1.55, 0.0]])


def _src_hash(*objs):
    """Short digest of functions' source and values, for cache file names that cannot go stale."""
    import hashlib
    import inspect
    h = hashlib.sha1()
    for o in objs:
        try:
            h.update(inspect.getsource(o).encode())
        except (TypeError, OSError):
            h.update(repr(o).encode())
    return h.hexdigest()[:10]


def bird_shape(flap):
    """(n,) flap angles -> (n,7,3) bird vertices with wings rotated about the body axis."""
    n = len(flap)
    V = np.repeat(BIRD[None], n, 0).copy()
    for tip, sgn in ((5, 1), (6, -1)):
        x = BIRD[tip, 0]
        V[:, tip, 0] = sgn * abs(x) * np.cos(flap)
        V[:, tip, 2] = BIRD[tip, 2] + abs(x) * np.sin(flap)
    for sh, sgn in ((3, 1), (4, -1)):
        V[:, sh, 2] = BIRD[sh, 2] + 0.25 * BIRD_SCALE * np.sin(flap)
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
FLOCK_TRAIL = 2.4             # seconds of path the ribbon spreads over


def flock_target(t):
    """Moving attractor (world) for the murmuration, t in seconds of film time (scalar or array).

    During S08 (31.4-34.7 s) it sweeps across the bright north-west cliff, above
    the arch as seen from the poster camera, so the birds read dark on the glow.
    """
    t = np.asarray(t, dtype=float)
    u = np.clip((t - 31.4) / 3.3, -0.2, 1.5)
    a = np.array([-255.0, -50.0, 240.0])
    b = np.array([-185.0, 115.0, 300.0])
    wob = np.stack([25 * np.sin(2.1 * t), 25 * np.cos(1.7 * t), 18 * np.sin(2.9 * t)], -1)
    return a + (b - a) * u[..., None] + wob


def simulate_flock(n, f0=FLOCK_WINDOW[0], f1=FLOCK_WINDOW[1], seed=31, cache_dir=CACHE_DIR):
    """Boids (each bird follows its 7 nearest neighbours), cached to .npz.

    Alignment and cohesion over the 7 nearest (topological, as starlings do),
    short-range separation, a moving attractor that each bird follows with its
    own delay (so the flock pours along the path as a ribbon), a sweeping
    'predator' that sends waves through it, and soft containment inside the
    cup. Two substeps per frame. The cache name hashes this code, so edits can
    never replay a stale flock. Returns positions and velocities, both
    (frames, n, 3) float32, for film frames f0..f1.
    """
    os.makedirs(cache_dir, exist_ok=True)
    tag = _src_hash(simulate_flock, flock_target, FLOCK_TRAIL, R_SEA, TAPER)
    path = os.path.join(cache_dir, f'flock_{tag}_{n}_{seed}_{f0}_{f1}.npz')
    if os.path.exists(path):
        d = np.load(path)
        return d['P'], d['V']
    rng = np.random.default_rng(seed)
    lag = (rng.uniform(0, 1, n) ** 1.3 * FLOCK_TRAIL)[:, None]
    c = flock_target(f0 / 24.0 - lag[:, 0])
    P = (c + rng.normal(0, 1, (n, 3)) * np.array([30.0, 18.0, 12.0])).astype(np.float32)
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
            sep = (dv / dd ** 2 * (dd < 7.0)).sum(1)
            acc = 2.4 * (mv - Vv) + 0.55 * (mp - P) + 80.0 * sep
            tgt = flock_target(t - lag[:, 0])
            acc += 0.16 * (tgt - P)
            pr = flock_target(t - FLOCK_TRAIL * 0.5) + np.array([110 * math.sin(t * 2.1), 70 * math.cos(t * 1.7), 25 * math.sin(t * 2.9)])
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


def build_roost(coll, mat, seed=41, n=260, surface=None):
    """Night: origami birds roosting along the arch crest, wings folded, sitting on the surface.

    surface: (points, normals) on the crest (build_arch's ray-cast crest surface);
    without it the birds sit on the core's nominal top.
    """
    rng = np.random.default_rng(seed)
    if surface is not None and len(surface[0]):
        sp, sn = surface
        pick = rng.choice(len(sp), size=n, replace=True)
        pts = sp[pick] + np.c_[rng.normal(0, 0.8, (n, 2)), np.zeros(n)]
        pts[:, 2] = sp[pick, 2] + 0.25 * BIRD_SCALE
    else:
        P, R, T = arch_curve(0.7)
        top = np.nonzero(P[:, 2] > 92)[0]
        pick = rng.choice(top, size=n, replace=True)
        core = _core_radius(R, P)
        pts = P[pick] + np.c_[rng.normal(0, 3.0, (n, 2)), np.zeros(n)]
        pts[:, 2] = P[pick, 2] + core[pick] * 0.95 + rng.uniform(1.0, 3.0, n)
    fwd = np.c_[rng.normal(0, 1, (n, 2)), np.zeros(n)]
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


def _terrain_floor(x, y):
    """Highest solid or water surface under (x, y) on the terraces (sea level elsewhere)."""
    h, e, lv, fr, w = terrace_fields(x, y)
    return np.where(e > -0.12, np.maximum(h, np.where(e > 0, w, 0.0)), 0.0)


def firefly_positions(home, ground, frames, seed=63):
    """Rise from the grass (f1150-1190), then hover and wander, never below the terrain. (frames, n, 3)."""
    rng = np.random.default_rng(seed)
    n = len(home)
    t_rise = rng.uniform(1148, 1186, n)
    amp = rng.uniform(1.0, 3.5, (n, 3)) * np.array([1, 1, 0.5])
    w = rng.uniform(0.25, 0.8, (n, 3))
    ph = rng.uniform(0, 2 * np.pi, (n, 3))
    terr = np.linalg.norm(home[:, :2] - np.array(TERRACE_C)[:2], axis=1) < 160.0
    out = np.empty((len(frames), n, 3), np.float32)
    for i, f in enumerate(frames):
        r = smoothstep(0.0, 1.0, (f - t_rise) / 34.0)
        z = ground + 0.5 + (home[:, 2] - ground - 0.5) * r
        t = f / 24.0
        wob = amp * np.sin(w * t + ph)
        x, y = home[:, 0] + wob[:, 0], home[:, 1] + wob[:, 1]
        z = z + wob[:, 2]
        floor = np.where(terr, _terrain_floor(x, y), -1e9)
        out[i] = np.c_[x, y, np.maximum(z, floor + 0.5)]
    return out


def build_fireflies(coll, frames, cache_dir, n=1500, radius=0.012, grey_near=None, seed=61, view=None, near_keep=4):
    """Firefly points (PC2) with the in-shader Kuramoto clock.

    view: optional dict(location, lens, res_x) of the camera; each firefly's
    radius is then raised to at least ~0.8 px at its distance, so distant ones
    stay crisp 1.5-2 px points instead of sparkling sub-pixel noise, while near
    ones keep the true small size (and bloom only through depth of field).
    """
    home, ground = firefly_layout(n, seed)
    if view is not None:            # only a few fireflies bloom into bokeh right at the lens
        d = np.linalg.norm(home - np.array(view['location']), axis=1)
        near = np.nonzero(d < 12.0)[0]
        drop = near[np.argsort(d[near])][::-1][near_keep:] if len(near) > near_keep else []
        keep = np.setdiff1d(np.arange(len(home)), drop)
        home, ground = home[keep], ground[keep]
    n = len(home)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
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
    rad = np.full(n, radius)
    if view is not None:
        d = np.linalg.norm(home - np.array(view['location']), axis=1)
        px = d * (36.0 / view['lens']) / view.get('res_x', 1600)
        rad = np.clip(1.1 * px, radius, 60 * radius)
    pos = (P[:, :, None, :] + tv[None, None] * rad[None, :, None, None]).reshape(len(fr), n * k, 3)
    path = os.path.join(cache_dir, f'fireflies_{n}_{seed}_{fr[0]}_{fr[-1]}_{_src_hash(tuple(np.round(rad, 3)))}.pc2')
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
         'falls', 'murmuration', 'hero_envelope', 'fireflies', 'roost', 'blooms', 'gravity', 'shelf')
DEFAULT_PARTS = {
    'day': {'cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'atoll', 'terraces', 'falls',
            'murmuration', 'blooms', 'gravity'},
    'night': {'cup', 'lid', 'shaft', 'sea', 'floes', 'island', 'box', 'arch', 'atoll', 'terraces', 'falls',
              'fireflies', 'roost', 'blooms', 'gravity'},
}

# Offline render budget (samples, adaptive threshold) per quality tier; see tune_render().
OFFLINE_SPP = {'animatic': (6, 0.1), 'proof': (10, 0.07), 'preview': (12, 0.06), 'final': (12, 0.05),
               'hero': (28, 0.035)}


def tune_render(sc=None, quality=None, samples=0):
    """Offline's render settings, set on the scene (common.py stays untouched).

    Always: max 4 bounces (diffuse 2, glossy 2, transmission 2, transparent 8),
    no volumes, indirect clamp 6, and Cycles camera culling (Simplify) so the
    instanced small stuff the lens cannot see (grass, palms, shrubs, pines,
    scree) is not synced. With `quality`, also the sample budget from
    OFFLINE_SPP (`samples` overrides it): the pre-lit cup converges fast, so
    final quality needs ~12 spp, adaptive 0.05, with OIDN.
    """
    sc = sc or bpy.context.scene
    cy = sc.cycles
    cy.max_bounces = 4
    cy.diffuse_bounces = 2
    cy.glossy_bounces = 2
    cy.transmission_bounces = 2
    cy.transparent_max_bounces = 8
    cy.volume_bounces = 0
    cy.sample_clamp_indirect = 6.0
    cy.use_light_tree = True
    sc.render.use_simplify = True
    sc.render.simplify_subdivision_render = 6
    sc.render.simplify_child_particles_render = 1.0
    cy.use_camera_cull = True
    cy.camera_cull_margin = 0.1
    if quality:
        spp, thr = OFFLINE_SPP[quality]
        cy.samples = samples or spp
        cy.adaptive_threshold = thr
        cy.adaptive_min_samples = max(4, cy.samples // 3)
    return sc


def _cull(objs):
    """Let Cycles camera culling drop these (and, for instancers, their template objects)."""
    for o in objs:
        if o is None:
            continue
        o.cycles.use_camera_cull = True
        for m in o.modifiers:
            if m.type == 'NODES':
                for k in m.keys():
                    v = m[k]
                    if isinstance(v, bpy.types.Collection):
                        for t in v.objects:
                            t.cycles.use_camera_cull = True


def _mats(state):
    return {
        'stone': mat_stone('OFF_IslandStone', srgb('#4d4741')),
        'arch_stone': mat_stone('OFF_ArchStone', STONE_GREY, lichen=1.0, wet_line=True),
        'scree': mat_stone('OFF_Scree', (0.17, 0.15, 0.13), wet=0.3),
        'shelf': mat_stone('OFF_ShelfStone', srgb('#4a423b'), wet=1.0),
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
        'sheet_falls': mat_paper_sheet('OFF_SheetFalls', glow=0.12 if state == 'day' else 0.02),
        'bird': mat_bird(),
        'foam': mat_foam(state),
    }


def shelf_h(X, Y, shelf):
    """A low wet-stone shelf (x, y, radius, height): the S08 foreground at human scale."""
    cx, cy, r0, hh = shelf
    d = np.hypot(X - cx, (Y - cy) * 1.25) * (1 + 0.22 * fbm2(X / 9.0, Y / 9.0, 3, seed=97))
    top = hh * (1 - smoothstep(0.55, 1.0, d / r0)) + 0.7 * fbm2(X / 2.2, Y / 2.2, 3, seed=98) \
        + 1.4 * fbm2(X / 7.0, Y / 7.0, 2, seed=99)
    return top - 1.5


def build_shelf(coll, mats, shelf):
    cx, cy, r0, hh = shelf
    obj, X, Y, Z = heightfield('OFF_Shelf', cx, cy, r0 * 1.1, r0 * 1.1, 0.25, lambda X, Y: shelf_h(X, Y, shelf),
                               coll=coll, mat=mats['shelf'], skirt=-20.0)
    return obj


def build_offline(state='day', include=None, frames=None, sea_focus=None, cache_dir=None, blooms=None,
                  grass_count=52000, falls_count=None, flock_count=4000, firefly_count=1500, grey_near=None,
                  view=None, floes_near=None, shelf=None, tune=True):
    """Build E1_OFFLINE into the current scene and return a handles dict.

    state: 'day' | 'night'. include: subset of PARTS (default: DEFAULT_PARTS[state]).
    frames: (a, b) film frames to bake crowd caches for (default: the current scene range).
    sea_focus: (x, y) where the sea mesh is densest (put it under the camera).
    blooms: attendee names whose colour bloom glows in the paper (default by state).
    view: dict(location, lens, res_x) of the (mean) camera: sizes fireflies to stay crisp points.
    floes_near: camera path [(x, y), ...]: scatter human-scale foam floes along it.
    shelf: (x, y, radius, height) of a foreground wet-stone shelf (part 'shelf').
    tune: apply tune_render() bounces and camera culling to the scene.

    Handles: h['objects'][name], h['mats'][name], h['lights'] (sun, key, top, glint),
    h['bloom_nodes'][name], h['offline'] (= OFFLINE), plus helpers key_slot(),
    key_bloom(), set_gravity(), animate_hero_padlock(), build_eclipse() that take h.
    """
    assert state in ('day', 'night')
    parts = set(DEFAULT_PARTS[state] if include is None else include)
    sc = bpy.context.scene
    if frames is None:
        frames = (sc.frame_start, sc.frame_end)
    cache_dir = cache_dir or CACHE_DIR
    os.makedirs(cache_dir, exist_ok=True)
    if tune:
        tune_render(sc)
    root = C.collection('OFFLINE')
    h = {'state': state, 'parts': parts, 'objects': {}, 'mats': {}, 'lights': {}, 'offline': OFFLINE,
         'nominal': {}, 'frames': frames}
    O = h['objects']
    mats = _mats(state)
    h['mats'].update(mats)
    on_blooms = bloom_names(state, blooms) if 'blooms' in parts else ()

    # the cup world is always there: wall, lid with the slot, sky beyond the slot, lamps
    wall_mat = mat_paper_wall(state, on_blooms)
    h['mats']['wall'] = wall_mat
    h['bloom_nodes'] = {n: wall_mat.node_tree.nodes['Bloom_' + n] for n in ATTENDEES}
    O['wall'] = build_cup_wall(root, wall_mat)
    frame, sky = build_slot(root, state)
    O['slot_frame'], O['slot_sky'] = frame, sky
    h['mats']['sky'] = sky.active_material
    h['nominal']['sky'] = sky.active_material.node_tree.nodes['SkyStrength'].outputs[0].default_value
    lid_mat = mat_lid(frame, state)
    h['mats']['lid'] = lid_mat
    O['lid'] = build_lid(root, lid_mat)
    h['lights'] = build_lights(root, state)
    apply_light_state(h, state, on_blooms)

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
    arch = None
    if 'arch' in parts:
        arch = build_arch(root, mats)
        O['arch_core'] = arch['core']
        O['arch_padlocks'] = arch['padlocks']
        O['arch_mounds'] = arch['mounds']
        O['scree'] = arch['scree']
        O['arch_pines'] = arch['pines']
        h['n_padlocks'] = arch['n_padlocks']
        OFFLINE['arch_crest'] = tuple(arch['crest'])
        _cull([arch['pines'], arch['scree']])
    if 'hero_padlock' in parts:
        O['hero_padlock'] = build_hero_padlock(root)
        O['dust'], h['mats']['dust'] = build_dust(root, hero_padlock_rest())
    if 'atoll' in parts:
        at = build_atoll(root, mats)
        O['atoll'], O['palms'], O['shrubs'] = at['ground'], at['palms'], at['shrubs']
        _cull([at['palms'], at['shrubs']])
    if 'terraces' in parts:
        tr = build_terraces(root, mats, grass_count=grass_count)
        O['terraces'], O['paddies'], O['rice_grass'] = tr['ground'], tr['water'], tr['grass']
        if 'summit_pines' in tr:
            O['summit_pines'] = tr['summit_pines']
        OFFLINE['terrace_water_levels'] = tr['levels']
        _cull([tr['grass'], tr.get('summit_pines')])
    if 'shelf' in parts and shelf is not None:
        O['shelf'] = build_shelf(root, mats, shelf)
    if 'sea' in parts:
        box = (-460.0, -460.0, 920.0)
        land_parts = tuple(sorted(p for p in parts if p in ('island', 'atoll', 'terraces', 'arch', 'falls')))
        tag = _src_hash(land_masks, island_h, atoll_h, terrace_fields, mound_h, heap_h, arch_feet, falls_base_pos,
                        shore_image, land_parts)
        sh = shelf if 'shelf' in parts else None
        tag = tag + _src_hash(shelf_h, sh)
        img = shore_image('OFF_ShoreMap', lambda X, Y: land_masks(X, Y, parts, shelf=sh), box[0], box[1], box[2], res=2048,
                          cache_path=os.path.join(cache_dir, f'shore_{tag}.npy'))
        O['sea'] = build_sea(root, state, sea_focus or (ISLAND_C.x * 0.3, ISLAND_C.y * 0.3), img, box)
        h['mats']['sea'] = O['sea'].active_material
    if 'floes' in parts:
        land = lambda X, Y: land_masks(X, Y, parts, shelf=shelf if 'shelf' in parts else None)  # noqa: E731
        O['floes'] = build_floes(root, mats['foam'], land, near=floes_near, near_n=520 if floes_near else 0,
                                 near_r=(2.0, 140.0))
    if 'falls' in parts:
        fl = build_falls(root, mats, state, frames, cache_dir)
        O['falls_ledge'], O['falls_sheets'] = fl['ledge'], fl['sheets']
        O['falls_heap'], O['falls_heap_mound'], O['falls_mist'] = fl['heap'], fl['heap_mound'], fl['mist']
        O['falls_spray'] = fl['spray']
    flock = None
    if 'murmuration' in parts:
        O['murmuration'], flock = build_murmuration(root, mats['bird'], frames, cache_dir, n=flock_count)
    if 'hero_envelope' in parts:
        O['hero_envelope'] = build_hero_envelope(root, frames, cache_dir, flock=flock)
    if 'roost' in parts:
        O['roost'] = build_roost(root, mats['bird'], surface=arch['crest_surface'] if arch else None)
    if 'fireflies' in parts:
        O['fireflies'], home, gi = build_fireflies(root, frames, cache_dir, n=firefly_count, grey_near=grey_near,
                                                   view=view)
        h['mats']['firefly'] = O['fireflies'].active_material
        h['grey_firefly'] = tuple(home[gi])

    # gravity rig: the loose world tilts, the cup stays
    pivot, grav, beam = build_gravity(root)
    O['gravity_pivot'], O['gravity'], O['beam_pivot'] = pivot, grav, beam
    for name in ('sea', 'floes', 'fireflies', 'falls_sheets', 'falls_spray', 'murmuration', 'hero_envelope', 'roost'):
        if name in O:
            parent_keep(O[name], grav)
    for name in ('shaft',):
        if name in O:
            parent_keep(O[name], beam)
    parent_keep(h['lights']['sun'], beam)
    if 'paddies' in O:
        _paddies_follow_gravity(mats['paddy'], grav, pivot)
    return h


def _paddies_follow_gravity(mat, grav, pivot):
    """Drive the paddy material's 'WaterUp' normal from the rig: world up of the tilted sea."""
    node = mat.node_tree.nodes['WaterUp']
    yaw = pivot.rotation_euler.z
    exprs = (f'sin({yaw:.6f}) * sin(t)', f'-cos({yaw:.6f}) * sin(t)', 'cos(t)')
    for i, ex in enumerate(exprs):
        fc = node.inputs[i].driver_add('default_value')
        drv = fc.driver
        drv.type = 'SCRIPTED'
        v = drv.variables.new()
        v.name = 't'
        v.type = 'TRANSFORMS'
        v.targets[0].id = grav
        v.targets[0].transform_type = 'ROT_X'
        v.targets[0].transform_space = 'LOCAL_SPACE'
        drv.expression = ex


def build_eclipse(h, f0=104, f1=124, level=0.4, travel=330.0):
    """S01 eclipse: fingertips pinching a folded envelope slide across the slot from frame left.

    Real silhouette geometry (not a fade) between the lid and the sky disc, in
    the slot frame, visible to camera and shadow rays, so it also cuts the sun
    pool. It moves in one straight, mechanical line (linear keys) from fully
    off the slot at f0 to covering it at f1, leaving a thin bright rim; the
    sun, sky, lid rim and shaft are keyed down to `level` with key_slot().
    Returns the silhouette root (an empty parented to the slot frame).
    """
    frame = h['objects']['slot_frame']
    root = C.collection('OFFLINE')
    mat = mat_silhouette()
    rig = C.empty('OFF_Eclipse', root, display='ARROWS', size=30.0)
    rig.parent = frame
    rig.matrix_parent_inverse = Matrix.Identity(4)
    parts_ = []
    # clear of the lid (the slope crosses the slot plane at up to ~90 m); 120 m out, seen from the
    # S01 end camera, a 144 x 42 m envelope covers the 135 x 45 m slot but for a thin bright rim
    Vb, Fb = _rounded_box(72.0, 21.0, 1.6, 1.4, n=4)
    env = np_mesh('OFF_EclipseEnvelope', Vb + np.array([0, 0, 120.0]), Fb, coll=root, mat=mat)
    parts_.append(env)
    for sgn, zc, r in ((1, 132.0, 17.0), (-1, 146.0, 19.0)):   # index above, thumb below the envelope edge
        x = np.linspace(-260.0, -40.0, 24)
        pts = np.stack([x, np.full_like(x, sgn * (14.0 + 0.04 * (x + 40.0))), zc - 0.12 * (x + 40.0)], 1)
        rad = r * np.sqrt(np.clip((-40.0 - x) / r + 0.15, 0.0, 1.0))
        tube = tube_along(pts, rad, sides=16, name=f'OFF_EclipseFinger_{sgn:+d}', coll=root, mat=mat)
        parts_.append(tube)
    for o in parts_:
        o.parent = rig
        o.matrix_parent_inverse = Matrix.Identity(4)
    rig.location = (-travel, 0.0, 0.0)
    rig.keyframe_insert('location', frame=f0)
    rig.location = (0.0, 0.0, 0.0)
    rig.keyframe_insert('location', frame=f1)
    for fc in C.fcurves(rig.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    key_slot(h, f0, 1.0)
    key_slot(h, f1, level)
    h['objects']['eclipse'] = rig
    return rig


def look(state='day', inside_beam=False):
    """Compositor settings (common.compositor kwargs) for the state: glare, vignette, aerial mist.

    The mist is LINEAR from 150 m and reaches ~12% at the far cliff (600 m), in a
    neutral warm grey, so aerial perspective acts only at real distance. Glare
    starts above the paper's brightest glow: only the slot, specks and the
    fireflies bloom.
    """
    if state == 'day':
        return dict(glare=0.22, glare_threshold=6.0, glare_size=3, glare_rel_size=0.14, vignette=0.2,
                    mist=dict(color=(0.6, 0.53, 0.45), start=150.0, depth=750.0, amount=0.16, falloff='LINEAR'))
    if inside_beam:          # S14: the camera rises inside the moon-silver beam: its glow is a depth veil
        return dict(glare=0.25, glare_threshold=2.5, glare_size=2, glare_rel_size=0.12, vignette=0.28,
                    mist=dict(color=(0.1, 0.11, 0.13), start=30.0, depth=900.0, amount=0.28, falloff='LINEAR'))
    return dict(glare=0.25, glare_threshold=2.5, glare_size=2, glare_rel_size=0.12, vignette=0.28,
                mist=dict(color=(0.012, 0.014, 0.02), start=150.0, depth=900.0, amount=0.15, falloff='LINEAR'))


def apply_look(state='day', **over):
    """common.compositor(**look(state)), then set the 4.5 Glare node inputs directly.

    In Blender 4.5 the Glare node's threshold/size/mix moved to input sockets,
    so the legacy attributes common.compositor() sets are ignored; this keeps
    the intended threshold, strength and relative bloom size.
    """
    kw = look(state, over.pop('inside_beam', False))
    kw.update(over)
    rel = kw.pop('glare_rel_size', None)
    nt = C.compositor(**kw)
    for n in nt.nodes:
        if n.bl_idname == 'CompositorNodeGlare' and 'Threshold' in n.inputs:
            n.inputs['Threshold'].default_value = kw.get('glare_threshold', 1.0)
            n.inputs['Strength'].default_value = kw.get('glare', 0.3)
            if rel is not None and 'Size' in n.inputs:
                n.inputs['Size'].default_value = rel
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
    position), lens length solved for the width (43.7 mm: the S01 glide's 21 mm
    must zoom to it during the tilt, see OFFLINE['s01']). Returns (location, lens).
    """
    loc = Vector(location) if location is not None else CAM_S01.copy()
    if location is None:
        loc.z = height
    dist = (SLOT_C - loc).length
    lens = frac * 36.0 * dist / 135.0
    return loc, lens


def _yaw_pitch_target(loc, yaw_deg, pitch_deg, dist=100.0):
    a, p = math.radians(yaw_deg), math.radians(pitch_deg)
    return Vector(loc) + Vector((math.cos(a) * math.cos(p), math.sin(a) * math.cos(p), math.sin(p))) * dist


_s01_end, _s01_lens = slot_match_camera()
OFFLINE['s01'] = {
    'glide_lens': 21.0,
    'end_location': tuple(_s01_end),
    'end_lens': round(_s01_lens, 2),
    'end_pitch_deg': round(math.degrees(math.asin((SLOT_C - _s01_end).normalized().z)), 2),
    'note': 'glide on 21 mm, zoom to end_lens during the f81-128 tilt (eased); slot = 20% of frame width',
}
CAM_S06_START = Vector((ARCH_C.x + 75.0 * _u.x, ARCH_C.y + 75.0 * _u.y, 2.0))
OFFLINE['cam_s06_start'] = tuple(CAM_S06_START)
CAM_S08 = Vector((math.cos(math.radians(232.0)) * 312.0, math.sin(math.radians(232.0)) * 312.0, 32.0))
OFFLINE['cam_s08'] = tuple(CAM_S08)
CAM_S12 = Vector((232.0, 78.0, 16.2))
OFFLINE['cam_s12'] = tuple(CAM_S12)


def s12_camera():
    """The S12 lens: 1.5 m above a level-2 paddy on the terraces' north flank, lower paddies in front."""
    return CAM_S12.copy()


def framing(name):
    """Preview/starting camera for a named framing: dict(frame, state, lens, location, target, include, ...)."""
    if name == 's01_glide':
        loc = CAM_S01 + Vector((_u.x, _u.y, 0)) * 7.0
        loc.z = 1.5
        fwd = (ARCH_C - loc).to_2d().normalized()
        yaw = math.degrees(math.atan2(fwd.y, fwd.x)) + 3.0          # arch a little right of centre, box out of frame
        path = [tuple((CAM_S01 + Vector((_u.x, _u.y, 0)) * d).to_2d()) for d in np.linspace(-2.0, 16.0, 10)]
        return dict(frame=60, state='day', lens=21.0, location=loc, target=_yaw_pitch_target(loc, yaw, 8.0), fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'floes', 'arch', 'blooms', 'gravity'},
                    blooms=('keys', 'strategy', 'people'), sea_focus=(loc.x, loc.y), floes_near=path)
    if name == 's01_slot':
        loc, lens = slot_match_camera()
        return dict(frame=128, state='day', lens=lens, location=loc, target=SLOT_C, fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'arch', 'blooms', 'gravity'},
                    blooms=('keys', 'strategy', 'people'), sea_focus=(loc.x, loc.y))
    if name == 's06_arch':
        loc = CAM_S06.copy()
        return dict(frame=600, state='day', lens=50.0, location=loc, target=SLOT_C.copy(), fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'floes', 'arch', 'hero_padlock', 'blooms', 'gravity'},
                    sea_focus=(loc.x, loc.y))
    if name == 's06_land':
        loc = CAM_S06_START.copy()
        aim = hero_padlock_rest() + ARCH_SPAN * 4.0
        d = (aim - loc).to_2d().normalized()
        el = math.degrees(math.atan2(aim.z - loc.z, (aim - loc).to_2d().length))
        return dict(frame=556, state='day', lens=50.0, location=loc,
                    target=_yaw_pitch_target(loc, math.degrees(math.atan2(d.y, d.x)), el + 6.0), fstop=0.0,
                    include={'cup', 'lid', 'shaft', 'sea', 'floes', 'arch', 'hero_padlock', 'blooms', 'gravity'},
                    sea_focus=(loc.x, loc.y), floes_near=[tuple(loc.to_2d())])
    if name == 's08_poster':
        loc = CAM_S08.copy()
        yaw, pitch = 60.0, 8.0
        fwd = Vector((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0.0))
        side = Vector((fwd.y, -fwd.x, 0.0))
        sh = loc + fwd * 118.0 - side * 46.0
        return dict(frame=832, state='day', lens=22.0, location=loc, target=_yaw_pitch_target(loc, yaw, pitch),
                    fstop=0.0, include=DEFAULT_PARTS['day'] | {'hero_envelope', 'shelf'}, sea_focus=(loc.x, loc.y),
                    floes_near=[tuple((loc + fwd * d).to_2d()) for d in (60.0, 110.0, 170.0)],
                    shelf=(sh.x, sh.y, 34.0, 8.0))
    if name == 's12_fireflies':
        loc = s12_camera()
        crest = Vector((ARCH_C.x, ARCH_C.y, 0.0)) + ARCH_FACE * (math.tan(math.radians(ARCH_LEAN)) * 121.0)
        d = (crest - loc).to_2d().normalized()
        yaw = math.degrees(math.atan2(d.y, d.x))
        return dict(frame=1217, state='night', lens=35.0, location=loc, target=_yaw_pitch_target(loc, yaw, 7.0),
                    fstop=4.0, focus=116.0, include=DEFAULT_PARTS['night'], sea_focus=(loc.x, loc.y),
                    grey_near=tuple(loc + Vector((d.x, d.y, 0)) * 70.0 + Vector((0, 0, 8.0))),
                    view=dict(location=tuple(loc), lens=35.0, res_x=1600))
    if name == 's14_box':
        tgt = BOX_C.copy()
        loc = BOX_C - SHAFT_DIR * 230.0
        return dict(frame=1393, state='night', lens=24.0, location=loc, target=tgt, fstop=0.0,
                    include=DEFAULT_PARTS['night'], sea_focus=(ISLAND_C.x, ISLAND_C.y), gravity=(1345, 4.0, 1408, 12.0),
                    view=dict(location=tuple(loc), lens=24.0, res_x=1600), shaft_camera=not camera_in_shaft(loc),
                    look=dict(inside_beam=camera_in_shaft(loc)))
    raise KeyError(name)


def build_kwargs(fr):
    """build_offline() keyword arguments carried by a framing() dict."""
    keys = ('sea_focus', 'blooms', 'grey_near', 'view', 'floes_near', 'shelf')
    return {k: fr[k] for k in keys if k in fr}
