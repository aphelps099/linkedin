"""S12 · f1153-1248 · 48.00-52.00 s · E1_OFFLINE (night): the fireflies fall into step.

    blender -b --factory-startup -P shots/s12_fireflies.py -- --quality proof --only 1153,1185,1189,1201,1203,1217,1233,1248
    blender -b --factory-startup -P shots/s12_fireflies.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s12_fireflies.py -- --quality final

Night inside the cup, the music back clean and close. The colour blooms have left the paper (Pat's faint
grey one is the only glow left in the cliffs, upper left), the slot's shaft is a low moon-silver veil at
the right over the island and the box, the sea and the paddies are black mirrors, and the padlock arch
stands as a near-black shape left of centre, its crest haloed by fireflies. About 1,500 fireflies in the
colleagues' colours rise from the terraces, the drift over the water and the crest pines, and a near
layer of them hovers over the lens's own paddy, so every flash is doubled in its mirror; all colour
lives in them.

Beats (film frames; 90 BPM = 16 frames a beat; every flash is a 2-frame rise into the beat frame and a
10-frame decay, from env_offline's in-shader Kuramoto clock):
  f1153 (beat 72) the cut: the black paddy mirror fills the lower third with the arch's legs; the top
              edge cuts through the crest's mass; the swarm still on the grass and the water, lifting off
              (each firefly rises over 34 frames, the near paddy layer over 60), blinking at random
  f1153-1184  random blinking while the coupling ramps (env clock: f1150-1192); the tilt brings the
              crest into frame by ~f1195
  f1185 (74)  they flash together, doubled in the paddy mirror; Pat's grey firefly, alone in the arch's
              opening, peaks 4 frames late (f1189)
  f1201 (75)  together again; the grey one 2 late (f1203)
  f1217 (76)  bar 19 downbeat: all of them, grey included, flash in perfect unison
  f1233 (77)  unison again
  f1248       the lens comes to rest, the swarm held at its base glow (the clock is held from f1246, so
              the f1249 flash belongs to S13's cut, not to a one-frame pop here); cut to the dark room

Camera: env framing 's12_fireflies' (30 mm, the accepted lens change, f/2.8 focused at 16 m) from
E.CAM_S12 over the second paddy on the terraces' south-west flank, shifted 1.2 m left (square to the view)
so the terrace riser that stood at the frame's right edge (14 m away) parallaxes out of frame, and
panned 7.5 degrees left of the crest's azimuth (crest and opening left of centre, box right). One eased
crane move over the whole shot: a 1.2 m rise and a tilt from +2.5 to +7 degrees (a cubic already
drifting up at the cut, 0.6 x its mean speed, at rest on f1248).

Deviation from the treatment's camera numbers (direction and intent held): a 1.2 m rise and +7, not 3 m
and +18. The mirror under the lens is ~25 m deep and the swarm's far body hovers 2-15 m over land and
water 50-250 m out; at the treatment's numbers (and at r0's 3 m / +10) both mirrors leave the frame
before the f1217 lock (by ray cast, (0.5, 0.12) hit the sea at 113 m). Here a ray at (0.5, 0.12) hits
the paddy on every sync frame (report() checks it) and the crest arrives with ~8% headroom at the end.

Shot-level additions (the env's swarm is built here with env_offline.build_fireflies, because
build_offline does not pass near_bokeh / near_keep / near_add through):
  * near_bokeh 5 m, near_keep 0, near_add 0: no swarm firefly hovers by the lens, so every swarm point is
    a crisp, unblurred light-group point (a blurred 13 m firefly read as a 'J' glyph);
  * depth: past ~110 m the swarm's points shrink (1.4 -> 0.9 px radius) and dim (to 0.5 at 260 m), and
    each firefly's peak varies 0.6-1.0, so the swarm reads as a volume, not a flat band of dots;
  * a near paddy layer (PADDY_N fireflies 0.5-3 m over the lens's own paddy and the next, 8-40 m out,
    slow wander, 60-frame lift): their doubles land in the black mirror on every flash;
  * Pat's firefly: one dedicated grey firefly ~10 m out, riding the ray into the arch's dark opening
    (larger than the swarm's points); every swarm point that passes within PAT_CLEAR px of it in
    f1177-1209 is hidden, so its late bloom on f1189 and f1203 is the only change there;
  * three lens-side discs 0.32-0.42 m from the lens at true size (2-2.5 mm), so depth of field makes
    the bokeh (35-45 px soft discs at 1600); they ride with the lens (fireflies rising alongside it),
    drift <= 2 px/frame, and stay off the box, the opening and the frame edges;
  * the crest fireflies, which env firefly_layout seeds at centreline +8 m (under the 8.45 m core), are
    lifted CREST_CLEAR m off the stone along their own offset and hover there from the cut; any that
    still wander into the stone or its padlock shell are hidden, so none pops out of the padlocks.

Light: the env night state and the framing's levels, then for this shot a darker night (~1.2 EV under
the env: the shaft veil x0.4, the paper's backlight x0.45, the moon top disc x0.4 x0.5; view exposure
untouched, so the firefly cores keep their level and the flash is the brightest event on every beat),
the arch's albedo at 0.25 (the S01 silhouette range) and no firefly light on the arch's stone, padlocks
and scree or on the island (the swarm lit them as a pastel mottle that boiled under the moving seed); the
crest pines keep it. The sea's moon glitter at 0.2 (it out-counted the coloured doubles), the glint strip
light-linked off the paddies (its mirror image was a hard white bar), and no motion blur on any
never-denoised firefly point. The fireflies' own light stays out of the denoiser (env apply_look). The
falls are not built: they stand ~60 degrees right of the lens axis, outside the frame and every mirror.
Sampling: a new seed per frame while the lens moves (more than 0.3 px/frame at 20 m), the fixed seed
once it rests.
"""

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import cache as PC  # noqa: E402
import common as C  # noqa: E402
import env_offline as E  # noqa: E402

SHOT = 's12'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames, 16 per beat)
BEGIN = 1185            # beat 74: the swarm begins to flash together (the grey one peaks 4 late, f1189)
SECOND = 1201           # beat 75: together again (grey 2 late, f1203)
LOCK = 1217             # beat 76, bar 19 downbeat: all of them, grey included, in perfect unison
AGAIN = 1233            # beat 77: unison again
GREY_PEAKS = (1189, 1203)   # the grey (Pat's) firefly's late peaks (env_offline's firefly clock)
SYNC = (BEGIN, SECOND, LOCK, AGAIN)
CLOCK_HOLD = 1246       # the swarm clock holds here from f1246 (u = 13, base glow) through the cut

# ------------------------------------------------------------------ camera (starts on env framing 's12_fireflies')
LENS = 30.0             # accepted lens change (treatment 35 mm)
FSTOP = 2.8
FOCUS = 16.0            # m (the env framing): the near paddy layer and the mid-ground sharp
SHIFT_LEFT = 1.2        # m, square to the view: the riser 14 m off the lens's right parallaxes out of frame
RISE = 1.2              # m, from 1.5 m above the second paddy's mirror (E.CAM_S12)
PITCH0, PITCH1 = 2.5, 7.0    # deg: the top edge cuts through the crest's mass at the cut, the crest has ~8% headroom at rest
YAW_OFF = -7.5          # deg from the crest's azimuth (env framing -10): the crest left of centre, the shaft right
MOVE = (START, END)     # the rise and tilt run the whole shot
SLOPE0, SLOPE1 = 0.6, 0.0    # Hermite end slopes (x the mean speed): already drifting up at the cut, at rest at the end
SEED_PX = 0.3           # animated sampling seed while a point 20 m out moves more than this (px/frame at 1600 px)
HW = 18.0 / LENS        # tan of the half horizontal field (36 mm sensor)
HH = HW * 9.0 / 16.0

# ------------------------------------------------------------------ world
EXCLUDE = {'falls', 'fireflies'}    # the falls stand ~60 degrees right of the lens axis; the swarm is built here
GREY_AT = (-76.2, 20.6, 38.9)   # the env swarm's grey firefly (hidden: Pat's firefly is a dedicated one, below)
FILLS = {'padlock': 0.25, 'arch_stone': 0.25}   # arch albedo (env apply_fills): the S01 silhouette range
NIGHT = {'shaft': ('ShaftStrength', 0.24), 'wall': ('WallGlow', 0.27)}   # x the env night value (~-2 EV): frame
                        # median ~12 (8-bit) at the lock, as S14's exterior night; the paper reads, the shaft is a veil
TOP = 0.5               # x the framing's moon top disc (itself x0.4)
PAT_BLOOM = 2.5         # x the env's night bloom for Pat, the one glow left in the paper (upper left): under the
                        # darker paper it stays faint, but it reads; at the env level it vanished next to the shaft
SEA_GLINT = 0.2         # the sea's night moon glitter (env GlintLevel 1): a few silver glints, not a starfield
FIREFLY_LIGHT = 0.5     # x env FIREFLY_LIGHT_GAIN: each flash lights the grass and water round it
DARK_RECEIVERS = ('OFF_Island', 'OFF_ArchCore', 'OFF_ArchPadlocks', 'OFF_ArchScree', 'OFF_ArchMound',
                  'OFF_ArchRubble', 'OFF_PadlockTmpl', 'OFF_ShackleTmpl', 'OFF_HeroPadlock',
                  'OFF_Paddies', 'OFF_Sea', 'OFF_Floes')    # no firefly light (name prefixes): the stone stays a
                                                            # dark shape, the water a black mirror (its doubles are
                                                            # reflections of the points, not light pooled on it)
GLINT_OFF_PADDIES = True     # the glint strip would stand in the paddies' mirror as a hard white bar

# ------------------------------------------------------------------ the swarm (env build_fireflies, shot-tuned)
SWARM_N = 1500
NEAR_BOKEH = 5.0        # m: only a firefly this close would be a blurred, denoised disc (none is: NEAR_KEEP 0)
NEAR_KEEP = 0
DEPTH_R = ((90.0, 1.4), (260.0, 0.85))     # (distance m, point radius px): shrink past mid-field
DEPTH_DIM = ((70.0, 1.0), (260.0, 0.35))   # (distance m, peak scale): dim past mid-field
PEAK_VAR = (0.6, 1.0)   # each firefly's own peak
SHELL = 1.5             # m outside the arch's stone core still counts as inside (the padlock shell)
CREST_CLEAR = 4.0       # m: crest fireflies are lifted at least this far off the stone core

# the near paddy layer
PADDY_N = 220
PADDY_D = (8.0, 40.0)   # m from the lens
PADDY_H = (0.5, 3.0)    # m over the water (or the bund)
PADDY_RISE = (1110.0, 1186.0, 60.0)   # lift-off frames (uniform) and lift duration
PADDY_WOB = ((0.25, 0.8), (0.18, 0.45))  # wander amplitude (m) and angular speed (rad/s)
PADDY_LIGHT = 0.25      # x the swarm's per-firefly light: 8-20 m from the lens, full light floodlit the bund

# Pat's firefly: (frame, screen x, screen y, distance m), eased between keys
PAT_PATH = ((START - 2, 0.437, 0.525, 11.0), (1185, 0.440, 0.560, 10.2), (1217, 0.441, 0.585, 9.6),
            (END + 2, 0.440, 0.600, 9.2))
PAT_R = 0.03            # m: ~9 px at 10 m, three times a swarm point
PAT_COL = '#8a8a8a'
PAT_GAIN = 1.0          # x the hex: a mid grey beside the saturated swarm (brighter read as white)
PAT_CLEAR = 45          # px at 1600: swarm points passing this close to it in PAT_WINDOW are hidden
PAT_WINDOW = (1177, 1209)

# lens-side bokeh discs: (colour, radius m, gain, [(frame, sx, sy, distance m), ...])
BOKEH = (
    ('arjun', 0.0025, 2.0, ((START - 2, 0.170, 0.270, 0.36), (END + 2, 0.125, 0.335, 0.33))),
    ('people', 0.0025, 1.8, ((START - 2, 0.620, 0.125, 0.42), (END + 2, 0.665, 0.180, 0.39))),
    ('kevin', 0.0020, 2.2, ((START - 2, 0.905, 0.560, 0.32), (END + 2, 0.885, 0.615, 0.34))),
)


def hermite(t, s0=None, s1=None):
    """Cubic from 0 to 1 on t in 0..1 with end slopes s0, s1 (x the mean speed)."""
    s0 = SLOPE0 if s0 is None else s0
    s1 = SLOPE1 if s1 is None else s1
    t = min(1.0, max(0.0, t))
    t2, t3 = t * t, t * t * t
    return (t3 - 2 * t2 + t) * s0 + (-2 * t3 + 3 * t2) + (t3 - t2) * s1


def ease_path(keys, f):
    """(sx, sy, d) at frame f on a list of (frame, sx, sy, d) keys, smoothstep-eased between keys."""
    if f <= keys[0][0]:
        return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if f <= b[0]:
            t = (f - a[0]) / float(b[0] - a[0])
            t = t * t * (3 - 2 * t)
            return tuple(x + (y - x) * t for x, y in zip(a[1:], b[1:]))
    return keys[-1][1:]


class Move:
    """The lens: shifted SHIFT_LEFT m, rises RISE m and tilts PITCH0 -> PITCH1 on a fixed azimuth."""

    def __init__(self):
        fr = E.framing('s12_fireflies')
        self.fr = fr
        crest = E.arch_crest()
        p = Vector(fr['location'])
        d = (crest - p).to_2d().normalized()
        self.yaw = math.atan2(d.y, d.x) + math.radians(YAW_OFF)
        left = Vector((-math.sin(self.yaw), math.cos(self.yaw), 0.0))
        self.p0 = p + left * SHIFT_LEFT

    def u(self, f):
        return hermite((f - MOVE[0]) / float(MOVE[1] - MOVE[0]))

    def state(self, f):
        u = self.u(f)
        loc = self.p0 + Vector((0.0, 0.0, RISE * u))
        pitch = math.radians(PITCH0 + (PITCH1 - PITCH0) * u)
        return loc, self.yaw, pitch

    def euler(self, f):
        _l, yaw, pitch = self.state(f)
        return Euler((math.pi / 2 + pitch, 0.0, yaw - math.pi / 2), 'XYZ')

    def basis(self, f):
        _l, yaw, pitch = self.state(f)
        fwd = Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))
        right = fwd.cross(Vector((0, 0, 1))).normalized()
        return fwd, right, right.cross(fwd)

    def forward(self, f):
        return self.basis(f)[0]

    def at_screen(self, f, sx, sy, dist):
        """World point `dist` m from the lens on the ray through screen (sx, sy) (0..1, y up) at frame f."""
        loc, _y, _p = self.state(f)
        fwd, right, up = self.basis(f)
        return loc + (fwd + right * ((sx - 0.5) * 2 * HW) + up * ((sy - 0.5) * 2 * HH)).normalized() * dist

    def to_screen(self, f, P):
        """Screen (x, y) (0..1, y up) and depth of world points P (n, 3) at frame f."""
        loc, _y, _p = self.state(f)
        fwd, right, up = (np.array(v) for v in self.basis(f))
        V = np.asarray(P, float) - np.array(loc)
        z = V @ fwd
        zs = np.where(np.abs(z) < 1e-6, 1e-6, z)
        return 0.5 + (V @ right) / zs / (2 * HW), 0.5 + (V @ up) / zs / (2 * HH), z

    def motion_px(self, f, near=20.0, width=1600):
        """Screen motion (px/frame at `width`) of a point `near` m away between f-1 and f."""
        la, _ya, pa = self.state(f - 1)
        lb, _yb, pb = self.state(f)
        fov = 2 * math.atan(HW)
        return ((lb - la).length / near + abs(pb - pa)) * width / fov

    def view(self, f, res_x=1600):
        loc, _y, _p = self.state(f)
        return dict(location=tuple(loc), lens=LENS, res_x=res_x, target=tuple(loc + self.forward(f) * 100.0))


def unglint_paddies(h):
    """Keep the glossy-only glint strip off the paddies (it still glitters on the sea)."""
    L, pad = h['lights'].get('glint'), h['objects'].get('paddies')
    if L is None or pad is None:
        return
    rc = bpy.data.collections.new('S12_GlintExcluded')       # not in the scene: a link set
    rc.objects.link(pad)
    L.light_linking.receiver_collection = rc
    for co in rc.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'


def night_grade(h):
    """This shot's night (~2 EV under the env): the shaft veil, the paper's backlight and the moon disc; the
    sea's moon glitter down to a few glints; Pat's grey bloom lifted so it still reads in the darker paper."""
    for k, (node, scale) in NIGHT.items():
        m = h['mats'].get(k)
        if m is not None and node in m.node_tree.nodes:
            m.node_tree.nodes[node].outputs[0].default_value *= scale
    E.apply_light_levels(h, {'top': TOP})
    E.apply_values(h, {'sea': {'GlintLevel': SEA_GLINT}})
    node = h.get('bloom_nodes', {}).get('pat')
    if node is not None:
        node.outputs[0].default_value *= PAT_BLOOM


# ------------------------------------------------------------------ fireflies

def _ramp(x, pts):
    (x0, y0), (x1, y1) = pts
    return y0 + (y1 - y0) * np.clip((np.asarray(x, float) - x0) / (x1 - x0), 0.0, 1.0)


def _icosphere():
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
    ico = bpy.context.object
    tv = np.zeros(len(ico.data.vertices) * 3)
    ico.data.vertices.foreach_get('co', tv)
    tf = np.array([list(p.vertices) for p in ico.data.polygons])
    bpy.data.objects.remove(ico)
    return tv.reshape(-1, 3), tf


def _ff_attrs(me, k, phase, freq, grey, col, lgain):
    E.set_attr(me, 'ff_phase', np.repeat(phase, k))
    E.set_attr(me, 'ff_freq', np.repeat(freq, k))
    E.set_attr(me, 'ff_grey', np.repeat(grey, k))
    E.set_attr(me, 'ff_col', np.c_[np.repeat(col, k, 0), np.ones(len(col) * k)], 'FLOAT_COLOR')
    E.set_attr(me, 'ff_lgain', np.repeat(lgain, k))


def _as_point(obj, light=False):
    """Ray visibility of a firefly object: the seen points (camera and mirrors, the light group, never
    denoised) or the invisible light copy (lights the world)."""
    if light:
        E.hide_from(obj, camera=False, diffuse=True, glossy=False, transmission=True, shadow=False, scatter=False)
    else:
        E.hide_from(obj, camera=True, diffuse=False, glossy=True, transmission=False, shadow=False, scatter=False)
        obj.lightgroup = E.FIREFLY_LIGHTGROUP
        obj.cycles.use_motion_blur = False


def build_swarm(h, move, root):
    """The env swarm (build_fireflies), wired into the handles the way build_offline does it."""
    fi = {}
    obj, home, gi = E.build_fireflies(root, (START, END), E.CACHE_DIR, n=SWARM_N, grey_near=GREY_AT,
                                      view=move.view(LOCK), near_keep=NEAR_KEEP, near_add=0, info=fi,
                                      near_bokeh=NEAR_BOKEH)
    O = h['objects']
    h['firefly_cache'] = fi
    O['fireflies'] = obj
    h['mats']['firefly'] = obj.active_material
    h['mats']['firefly_light'] = fi['light'].material_slots[0].material
    O['fireflies_light'] = fi['light']
    if fi.get('near') is not None:
        O['fireflies_near'] = fi['near']
    h['grey_firefly'] = tuple(home[gi])
    h['swarm_grey'] = gi
    return fi


def pat_track(move):
    """{frame: world position} of Pat's firefly."""
    return {f: move.at_screen(f, *ease_path(PAT_PATH, f)) for f in range(START - 2, END + 3)}


def tune_swarm(h, move, root):
    """Depth (size and peak by distance, per-firefly peak), hide the crest fireflies that start inside
    the stone, the env's grey and every point that crosses Pat's firefly late in the ramp."""
    fi = h['firefly_cache']
    obj = h['objects']['fireflies']
    far_path, sel = fi['parts'][0]
    assert far_path == fi['path']
    home, ground = fi['home'][sel].copy(), fi['ground'][sel].copy()
    n = len(sel)
    Cc, Rr, _T = E.arch_curve(0.5)
    core = E._core_radius(Rr, Cc)
    # crest fireflies (env ground = crest centreline + 8 m, under the 8.45 m core): lift each one clear of
    # the stone and its padlock shell along its own offset (upward), and let it hover there from the cut
    # (it roosts in the crest pines: no rise out of the stone)
    crest = np.nonzero(ground > 60.0)[0]
    rngc = np.random.default_rng(1203)
    for i in crest:
        dd = np.linalg.norm(Cc - home[i], axis=1) - core
        j = int(np.argmin(dd))
        v = home[i] - Cc[j]
        v[2] = abs(v[2]) + 1e-3
        v /= np.linalg.norm(v)
        r_min = core[j] + CREST_CLEAR + rngc.uniform(0.0, 6.0)
        if np.linalg.norm(home[i] - Cc[j]) < r_min:
            home[i] = Cc[j] + v * r_min
        ground[i] = home[i, 2] - 0.6
    cam = np.array(move.view(LOCK)['location'])
    d = np.linalg.norm(home - cam, axis=1)
    px = d * (36.0 / LENS) / 1600.0
    rad = np.maximum(_ramp(d, DEPTH_R) * px, 0.012)
    rng = np.random.default_rng(1217)
    peak = _ramp(d, DEPTH_DIM) * rng.uniform(*PEAK_VAR, n)
    hide = np.zeros(n, bool)
    # the env's grey (Pat's firefly is a dedicated one)
    g = np.nonzero(sel == h['swarm_grey'])[0]
    hide[g] = True
    frames = list(range(START, END + 1))
    P = E.firefly_positions(home, ground, frames, fi['seed'] + 2, ids=sel)
    # any that still wander into the arch's stone (and its padlock shell)
    cand = np.nonzero(np.linalg.norm(home[:, :2] - np.array(E.ARCH_C)[:2], axis=1) < 140.0)[0]
    inside = np.zeros(len(cand), bool)
    for i in range(0, len(frames), 2):
        dd = np.linalg.norm(P[i, cand][:, None, :] - Cc[None], axis=2) - core[None]
        inside |= dd.min(1) < SHELL
    hide[cand[inside]] = True
    # every point passing within PAT_CLEAR px of Pat's firefly in PAT_WINDOW
    pt = pat_track(move)
    near_pat = np.zeros(n, bool)
    for f in range(PAT_WINDOW[0], PAT_WINDOW[1] + 1):
        sx, sy, z = move.to_screen(f, P[f - START])
        px_, py_, _ = move.to_screen(f, np.array([pt[f]]))
        dpx = np.hypot((sx - px_[0]) * 1600, (sy - py_[0]) * 900)
        near_pat |= (dpx < PAT_CLEAR) & (z > 0)
    hide |= near_pat
    rad = np.where(hide, 1e-5, rad)
    peak = np.where(hide, 0.0, peak)
    # rewrite the cache with the new radii, recolour, and re-even the light copy's gain
    tag = E._src_hash(tuple(np.round(rad, 4)), tuple(np.round(home.ravel(), 2)), tuple(np.round(ground, 2)), far_path,
                      E.firefly_positions)
    new = os.path.splitext(far_path)[0] + f'_s12_{tag}.pc2'
    if not os.path.exists(new):
        E._write_fireflies(new, home, ground, fi['frames'], fi['seed'], rad, fi['tv'], ids=sel)
    E._retarget_cache([obj, h['objects']['fireflies_light']], far_path, new)
    me = obj.data
    k = len(fi['tv'])
    col = np.zeros(n * k * 4, np.float32)
    me.attributes['ff_col'].data.foreach_get('color', col)
    col = col.reshape(n, k, 4)
    col[:, :, :3] *= peak[:, None, None]
    me.attributes['ff_col'].data.foreach_set('color', col.ravel())
    grey = np.zeros(n * k, np.float32)
    E.set_attr(me, 'ff_grey', grey)
    E.set_attr(me, 'ff_lgain', np.repeat((E.FIREFLY_LIGHT_R / rad) ** 2, k))
    h['s12_swarm'] = dict(hidden=int(hide.sum()), crest=len(crest), crest_inside=int(inside.sum()), near_pat=int(near_pat.sum()),
                          rad_px=(float((rad / px)[~hide].min()), float((rad / px)[~hide].max())))


def paddy_layer(move, rng):
    """Home positions of the near layer: 0.5-3 m over the paddy water (or bund) in the lens's view, 8-40 m out."""
    loc = np.array(move.p0)
    pts, ground = [], []
    while len(pts) < PADDY_N:
        az = move.yaw + rng.uniform(-1.0, 1.0) * math.atan(HW * 1.08)
        dist = math.sqrt(rng.uniform(PADDY_D[0] ** 2, PADDY_D[1] ** 2))
        x, y = loc[0] + dist * math.cos(az), loc[1] + dist * math.sin(az)
        hgt, e, lv, fr_, w = E.terrace_fields(np.array([x]), np.array([y]))
        if e[0] <= 0.0 or fr_[0] > 0.84:          # over the water of a paddy only
            continue
        gz = max(float(w[0]), float(hgt[0]))
        pts.append((x, y, gz + PADDY_H[0] + (PADDY_H[1] - PADDY_H[0]) * rng.uniform() ** 1.6))
        ground.append(gz)
    return np.array(pts), np.array(ground)


def paddy_positions(home, ground, frames, rng):
    """Lift off the water over PADDY_RISE[2] frames, then a slow wander (<= ~3 px/frame at 10 m)."""
    n = len(home)
    t_rise = rng.uniform(PADDY_RISE[0], PADDY_RISE[1], n)
    amp = rng.uniform(*PADDY_WOB[0], (n, 3)) * np.array([1.0, 1.0, 0.4])
    w = rng.uniform(*PADDY_WOB[1], (n, 3))
    ph = rng.uniform(0, 2 * np.pi, (n, 3))
    out = np.empty((len(frames), n, 3), np.float32)
    for i, f in enumerate(frames):
        r = E.smoothstep(0.0, 1.0, (f - t_rise) / PADDY_RISE[2])
        z = ground + 0.5 + (home[:, 2] - ground - 0.5) * r
        wob = amp * np.sin(w * (f / 24.0) + ph)
        x, y = home[:, 0] + wob[:, 0], home[:, 1] + wob[:, 1]
        floor = E._terrain_floor(x, y)
        out[i] = np.c_[x, y, np.maximum(z + wob[:, 2], floor + 0.5)]
    return out


def build_paddy_layer(h, move, root, tv, tf):
    """PADDY_N fireflies over the near paddies, seen (light group) and a light copy, on the swarm's clock."""
    rng = np.random.default_rng(1185)
    home, ground = paddy_layer(move, rng)
    n = len(home)
    cam = np.array(move.view(LOCK)['location'])
    d = np.linalg.norm(home - cam, axis=1)
    rad = np.maximum(1.4 * d * (36.0 / LENS) / 1600.0, 0.012)
    fr = list(range(START - 2, END + 3))
    P = paddy_positions(home, ground, fr, rng)
    pt = pat_track(move)
    near_pat = np.zeros(n, bool)
    for f in range(PAT_WINDOW[0], PAT_WINDOW[1] + 1):
        sx, sy, z = move.to_screen(f, P[f - fr[0]])
        px_, py_, _ = move.to_screen(f, np.array([pt[f]]))
        near_pat |= (np.hypot((sx - px_[0]) * 1600, (sy - py_[0]) * 900) < PAT_CLEAR) & (z > 0)
    rad = np.where(near_pat, 1e-5, rad)
    k = len(tv)
    tag = E._src_hash(tuple(np.round(home.ravel(), 2)), tuple(np.round(rad, 4)), paddy_positions, PADDY_RISE, PADDY_WOB)
    path = os.path.join(E.CACHE_DIR, f'fireflies_s12paddy_{n}_{fr[0]}_{fr[-1]}_{tag}.pc2')
    if not os.path.exists(path):
        E._write_pc2(path, (P[:, :, None, :] + tv[None, None] * rad[None, :, None, None]).reshape(len(fr), -1, 3), start=fr[0])
    F = (tf[None] + k * np.arange(n)[:, None, None]).reshape(-1, 3)
    obj = E.np_mesh('S12_FirefliesPaddy', (P[0][:, None, :] + tv[None] * rad[:, None, None]).reshape(-1, 3), F,
                    coll=root, mat=h['mats']['firefly'], smooth=True)
    cols = np.array([E.srgb(E.FIREFLY_EMIT[c]) for c in E.FIREFLY_COLOURS])
    col = cols[rng.integers(0, len(cols), n)] * (rng.uniform(*PEAK_VAR, n) * ~near_pat)[:, None]
    _ff_attrs(obj.data, k, rng.uniform(0, 1, n), rng.uniform(-0.18, 0.18, n), np.zeros(n), col,
              PADDY_LIGHT * (E.FIREFLY_LIGHT_R / rad) ** 2)
    PC.attach_pc2(obj, path, fr[0])
    lit = obj.copy()
    lit.name = 'S12_FirefliesPaddyLight'
    root.objects.link(lit)
    lit.material_slots[0].link = 'OBJECT'
    lit.material_slots[0].material = h['mats']['firefly_light']
    _as_point(obj)
    _as_point(lit, light=True)
    h['objects']['fireflies_paddy'] = obj
    h['objects']['fireflies_paddy_light'] = lit
    h['s12_paddy'] = dict(home=home, P=P, frames=fr, hidden=int(near_pat.sum()))
    return obj


def _key_track(obj, pos):
    for f, p in sorted(pos.items()):
        obj.location = p
        obj.keyframe_insert('location', frame=f)
    for fc in C.fcurves(obj.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


def _single(name, root, mat, tv, tf, radius, col, grey=0.0, phase=0.0, freq=0.0):
    k = len(tv)
    obj = E.np_mesh(name, tv * radius, tf, coll=root, mat=mat, smooth=True)
    _ff_attrs(obj.data, k, np.array([phase]), np.array([freq]), np.array([grey]), np.array([col]), np.array([0.0]))
    return obj


def build_pat(h, move, root, tv, tf):
    """Pat's firefly: one grey point ~10 m out on the ray into the arch's dark opening, 4 then 2 frames late."""
    col = np.array(E.srgb(PAT_COL)) * PAT_GAIN
    obj = _single('S12_PatFirefly', root, h['mats']['firefly'], tv, tf, PAT_R, col, grey=1.0)
    _as_point(obj)
    _key_track(obj, pat_track(move))
    h['objects']['pat_firefly'] = obj
    return obj


def build_bokeh(h, move, root, tv, tf):
    """Lens-side fireflies at true size 0.45-0.8 m from the lens: depth of field makes the discs (denoised
    with the frame, outside the light group). They rise with the lens and drift a few px a frame."""
    rng = np.random.default_rng(1249)
    out = []
    for i, (cname, rad, gain, keys) in enumerate(BOKEH):
        col = np.array(E.srgb(E.FIREFLY_EMIT[cname])) * gain
        obj = _single(f'S12_Bokeh_{cname}', root, h['mats']['firefly'], tv, tf, rad, col,
                      phase=rng.uniform(0, 1), freq=rng.uniform(-0.18, 0.18))
        E.hide_from(obj, camera=True, diffuse=False, glossy=False, transmission=False, shadow=False, scatter=False)
        _key_track(obj, {f: move.at_screen(f, *ease_path(keys, f)) for f in range(START - 2, END + 3)})
        h['objects'][f'bokeh_{cname}'] = obj
        out.append(obj)
    return out


def hold_clock(h):
    """Hold the swarm's clock at CLOCK_HOLD (base glow) from there through the cut: the f1249 flash's
    2-frame rise would otherwise pop the last frame to ~60%."""
    for k in ('firefly', 'firefly_light'):
        m = h['mats'].get(k)
        if m is not None and 'FireflyClock' in m.node_tree.nodes:
            node = m.node_tree.nodes['FireflyClock']
            E.key_value(node, CLOCK_HOLD, float(CLOCK_HOLD))
            E.key_value(node, END + 2, float(CLOCK_HOLD))


def tune_fireflies(h):
    """S12's levels for the swarm's light on the world, crisp (unblurred) points, and no firefly light
    on the island or the arch's stone, padlocks and scree."""
    m = h['mats'].get('firefly_light')
    if m is not None and 'FireflyLightGain' in m.node_tree.nodes:
        m.node_tree.nodes['FireflyLightGain'].outputs[0].default_value = E.FIREFLY_LIGHT_GAIN * FIREFLY_LIGHT
    for k in ('fireflies', 'fireflies_light', 'fireflies_near', 'fireflies_paddy', 'fireflies_paddy_light'):
        o = h['objects'].get(k)
        if o is not None:
            o.cycles.use_motion_blur = False
    rc = bpy.data.collections.new('S12_FireflyLightExcluded')     # not in the scene: a link set
    for o in bpy.data.objects:
        if o.name.startswith(DARK_RECEIVERS) and o.type == 'MESH' and o.name not in rc.objects:
            rc.objects.link(o)
    for k in ('fireflies_light', 'fireflies_paddy_light'):
        L = h['objects'].get(k)
        if L is not None:
            L.light_linking.receiver_collection = rc
    for co in rc.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    h['s12_dark'] = sorted(o.name for o in rc.objects)


def build_camera(move):
    loc0, _y, _p = move.state(START)
    cam = E.camera_offline(LENS, loc0, loc0 + move.forward(START), fstop=FSTOP, focus=FOCUS)
    cam.rotation_mode = 'XYZ'
    for f in range(START - 2, END + 3):
        loc, _y, _p = move.state(f)
        cam.location = loc
        cam.rotation_euler = move.euler(f)
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
    for fc in C.fcurves(cam.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return cam


def key_seed(sc, move):
    """A fresh sampling seed per frame while the lens moves (no noise pattern stuck to the screen as the
    world slides under it), the fixed seed where it is (near) still (nothing static boils)."""
    cy = sc.cycles
    cy.use_animated_seed = False
    for f in range(START - 2, END + 3):
        moving = START <= f <= END and max(move.motion_px(f), move.motion_px(min(f + 1, END))) > SEED_PX
        cy.seed = f if moving else 0
        cy.keyframe_insert('seed', frame=f)
    for fc in C.fcurves(sc.animation_data.action):
        if fc.data_path == 'cycles.seed':
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def project(cam, p):
    from bpy_extras.object_utils import world_to_camera_view
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return v.x, v.y, v.z


def ray(cam, sx, sy, skip=0.0):
    """(object name, distance) of the first hit through screen (sx, sy) at the current frame, starting
    `skip` m out from the lens."""
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    tr, br, bl, tl = cam.data.view_frame(scene=sc)
    p = bl + (br - bl) * sx + (tl - bl) * sy
    M = cam.matrix_world
    d = (M.to_3x3() @ p).normalized()
    o = M.translation + d * skip
    hit, loc, _n, _i, ob, _m = sc.ray_cast(dg, o, d)
    return (ob.name if hit else None), ((loc - M.translation).length if hit else None)


def report(h, cam, move):
    """Print the lens; where the crest, the box, Pat's firefly and the horizon sit in frame; and the ray
    checks: the paddy's mirror at (0.5, 0.12) on every sync frame, no terrace riser at the right edge."""
    sc = bpy.context.scene
    crest = E.arch_crest()
    pat = h['objects']['pat_firefly']
    for f in (START, 1161, 1169, 1177, BEGIN, GREY_PEAKS[0], SECOND, GREY_PEAKS[1], 1209, LOCK, 1225, AGAIN, 1241, END):
        sc.frame_set(f)
        loc, _yaw, pitch = move.state(f)
        cx, cy_, _ = project(cam, crest)
        bx, by, _ = project(cam, E.BOX_C)
        gx, gy, gz = project(cam, pat.matrix_world.translation)
        hz = project(cam, loc + Vector((math.cos(move.yaw), math.sin(move.yaw), 0.0)) * 5000.0)[1]
        if f in (START, LOCK, END):
            bx_, by_, _ = project(cam, E._bloom_centre('pat'))
            print(f'S12 f{f} Pat bloom centre {bx_:.3f},{by_:.3f}', flush=True)
        print(f'S12 f{f} cam z {loc.z:.2f} pitch {math.degrees(pitch):.2f} move {move.motion_px(f):.2f}px '
              f'seed {sc.cycles.seed} | crest {cx:.3f},{cy_:.3f} box {bx:.3f},{by:.3f} horizon y {hz:.3f} '
              f'| pat {gx:.3f},{gy:.3f} at {gz:.1f} m', flush=True)
    for f in SYNC:
        sc.frame_set(f)
        nm, dist = ray(cam, 0.5, 0.12)
        print(f'S12 RAY f{f} (0.5,0.12) {nm} {dist and round(dist, 1)} {"OK" if nm == "OFF_Paddies" else "FAIL"}', flush=True)
    sc.frame_set(START)
    for sx, sy in ((0.97, 0.4), (0.95, 0.3), (0.99, 0.35), (0.97, 0.25)):
        nm, dist = ray(cam, sx, sy)
        print(f'S12 RAY f{START} ({sx},{sy}) {nm} {dist and round(dist, 1)} {"FAIL" if nm == "OFF_Terraces" else "OK"}', flush=True)
    # Pat's firefly must sit in the arch's dark opening (rays round it reach the far wall, not the arch)
    for f in (START, BEGIN, GREY_PEAKS[0], SECOND, GREY_PEAKS[1], LOCK, END):
        sc.frame_set(f)
        gx, gy, _ = project(cam, pat.matrix_world.translation)
        hits = []
        for dx, dy in ((0, 0), (-0.012, 0), (0.012, 0), (0, -0.02), (0, 0.02)):
            nm, _d = ray(cam, gx + dx, gy + dy, skip=12.0)
            hits.append((nm or '-').replace('OFF_', ''))
        xs = [gx + k * 0.004 for k in range(-25, 26)]
        clear = [x for x in xs if (ray(cam, x, gy, skip=12.0)[0] or '').startswith('OFF_CupWall')]
        lo = max([x for x in xs if x < gx and x not in clear] or [0.0])
        hi = min([x for x in xs if x > gx and x not in clear] or [1.0])
        print(f'S12 PAT f{f} screen {gx:.3f},{gy:.3f} opening {lo:.3f}-{hi:.3f} behind: {" ".join(hits)}', flush=True)
    # screen speeds (px/frame at 1600) of the lens-side discs, Pat's firefly and the near paddy layer
    def track(obj):
        out = []
        for f in range(START, END + 1):
            sc.frame_set(f)
            x, y, _z = project(cam, obj.matrix_world.translation)
            out.append((x * 1600, y * 900))
        v = np.diff(np.array(out), axis=0)
        return np.hypot(v[:, 0], v[:, 1]).max(), out[0], out[-1]
    for k in sorted(h['objects']):
        if k.startswith('bokeh_') or k == 'pat_firefly':
            vmax, a0, a1 = track(h['objects'][k])
            print(f'S12 TRACK {k} max {vmax:.1f} px/frame from {a0[0]:.0f},{a0[1]:.0f} to {a1[0]:.0f},{a1[1]:.0f}', flush=True)
    pd = h.get('s12_paddy')
    if pd:
        sp = []
        for i, f in enumerate(pd['frames'][2:-2]):
            j = i + 2
            x0, y0, z0 = move.to_screen(f - 1, pd['P'][j - 1])
            x1, y1, z1 = move.to_screen(f, pd['P'][j])
            ok = (z1 > 0) & (x1 > 0) & (x1 < 1) & (y1 > 0) & (y1 < 1)
            sp.append(np.where(ok, np.hypot((x1 - x0) * 1600, (y1 - y0) * 900), 0.0))
        sp = np.array(sp)
        print(f'S12 TRACK paddy layer px/frame p50 {np.median(sp[sp > 0]):.1f} p99 {np.percentile(sp[sp > 0], 99):.1f} '
              f'max {sp.max():.1f}; in frame at f{LOCK}: {int((sp[LOCK - START - 1] > 0).sum())}', flush=True)
    print('S12 SWARM', h.get('s12_swarm'), 'paddy layer hidden near Pat', h.get('s12_paddy', {}).get('hidden'), flush=True)
    print('S12 DARK', h.get('s12_dark'), flush=True)
    sc.frame_set(START)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    move = Move()
    fr = move.fr
    kw = E.build_kwargs(fr)
    kw.pop('view', None)
    kw.pop('grey_near', None)
    parts = set(fr['include']) - EXCLUDE
    h = E.build_offline(fr['state'], include=parts, frames=(START, END), **kw)
    root = C.collection('OFFLINE')
    build_swarm(h, move, root)
    tv, tf = _icosphere()
    tune_swarm(h, move, root)
    build_paddy_layer(h, move, root, tv, tf)
    build_pat(h, move, root, tv, tf)
    build_bokeh(h, move, root, tv, tf)
    E.tune_render(sc, args.quality, args.samples)
    E.apply_fills(h, FILLS)
    E.apply_values(h, fr.get('values'))
    E.apply_light_levels(h, fr.get('lights'))
    night_grade(h)
    if GLINT_OFF_PADDIES:
        unglint_paddies(h)
    tune_fireflies(h)
    hold_clock(h)
    cam = build_camera(move)
    sc.camera = cam
    E.set_shaft_camera(h, fr.get('shaft_camera', True))
    E.apply_look(fr['state'], **fr.get('look', {}))
    key_seed(sc, move)
    report(h, cam, move)
    sc.frame_set(START)
    return dict(h=h, cam=cam, move=move)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
