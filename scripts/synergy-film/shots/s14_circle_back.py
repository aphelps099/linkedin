"""S14 · f1345-1440 · 56.00-60.00 s · E2_LONG_ROOM (dark) to E1_OFFLINE (night, tilting): circle back.

    blender -b --factory-startup -P shots/s14_circle_back.py -- --quality proof --only 1345,1356,1357,1361,1363,1377,1382,1393,1397,1408,1409,1440
    blender -b --factory-startup -P shots/s14_circle_back.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s14_circle_back.py -- --quality final

Two renders stitched inside a white flare, then black. One process builds what the requested frames
need: the dark Long Room for f1345-1359, Offline at night for f1361-1403; pure white and pure black
frames are written directly (no scene).

Beats (film frames; 90 BPM = 16 frames a beat):
  f1345-1356  the dark room from straight above, 24 mm, deep focus: his faceted crown, the cup raised
              to his chin in his right hand (S13's contact pose, held: he is still sipping), the
              headset on the walnut beside the hub, the skylight slab down the table's spine. The lens
              starts 2 m over his crown and rises straight up, eased in (slow off the mark, then fast),
              toward the slot-shaped skylight. He is motionless; the room keeps tilting (the slab slides
              on across the walnut; gravity carries on from S13's 4 deg).
  f1357-1362  the 6-frame white flare: the room blows out from its brightest light (exposure ramp, then
              white) as the lens reaches the skylight (f1357-1359); f1360 is pure white; Offline comes
              up out of the white (f1361-1362). The stitch is hidden in it.
  f1361-1380  outside, at night: the lens rises along the moon-silver beam's axis toward the sip hole,
              looking back down the beam, holding the dark box and its glowing slot at frame centre for
              20 frames as it shrinks below (an exponential rise: the box shrinks at a constant rate). The
              island sits in the silver pool; the fireflies flash in unison on the beat (f1377), doubled in
              the terrace mirrors and the sea; the arch, the atoll and the paper falls' thin night
              trickle stand around it. The world is tilting: the sea (and its floes, glints and foam
              line) turns on the gravity rig, 4 -> 12 deg over f1345-1408, still S13's curve at the cut.
  f1381-1398  the lens tilts up toward the slot (a 180 deg eased tilt, top of frame leading, while it
              keeps rising up the beam): over the island and the arch (crest fireflies flash on f1393,
              doubled in the sea), up the slot-side cliff past the tilted horizon of the sea, to the lid
              and the slot burning in it, its long axis rolled level, as S01 opened on it.
  f1397-1403  the slot fills the frame (the lens is inside 60 m of it at f1401) and blooms to pure white.
  f1404-1408  pure white.
  f1409-1440  hard cut to black (the music stops dead on the kick), held to the end. In the black the
              printer feeds one more sheet (f1418, sound only).

Camera: interior 24 mm (treatment), exterior 18 mm (accepted lens change: env_offline S14_RISE), deep
focus, no shake. Both renders move on every frame: animated sampling seed (no screen-fixed noise).
"""

import copy
import json
import math
import os
import struct
import sys
import time
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import common as C  # noqa: E402

V3 = Vector

SHOT = 's14'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ---------------------------------------------------------------- the beats (film frames)
INSIDE = (START, 1359)       # rendered in the Long Room (f1360 is pure white)
FLARE = (1357, 1362)         # the white flare that hides the stitch
OUTSIDE = (1361, 1408)       # rendered in Offline (frames that are pure white are written directly)
HOLD_END = 1380              # the box held at frame centre f1361-1380 (20 frames)
TILT_UP = (1381, 1398)       # the tilt up toward the slot (eased)
FLASHES = (1377, 1393)       # firefly unison flashes (env_offline's clock: every beat from f1217)
BLOOM = (1397, 1403)         # the slot fills the frame and blooms to white; white held to f1408
BLACK = 1409                 # hard cut to black, held to f1440
PRINTER_FEED = 1418          # over black: sound only

# ---------------------------------------------------------------- the flare (view exposure EV, mix to white)
# Light floods the lens: the brightest things blow out first (exposure ramp), then everything goes
# to white. 1.0 = pure white (written directly).
FLARE_CURVE = {
    1355: (0.25, 0.0), 1356: (0.8, 0.0), 1357: (2.2, 0.06), 1358: (4.5, 0.3), 1359: (7.0, 0.72), 1360: (0.0, 1.0),
    1361: (5.5, 0.62), 1362: (2.2, 0.22), 1363: (0.5, 0.0), 1364: (0.1, 0.0),
    1396: (0.15, 0.0), 1397: (0.4, 0.0), 1398: (0.8, 0.0), 1399: (1.4, 0.02), 1400: (2.4, 0.08), 1401: (3.8, 0.22),
    1402: (6.0, 0.5), 1403: (8.0, 0.82),
}
WHITE_HOT = 1.0e4            # linear value the mix pulls toward: AgX maps it to display white

# ---------------------------------------------------------------- gravity (degrees; the room's frame / the cup's)
TILT_S13 = (1305, 1344, 4.0)  # S13: 4 deg by its cut, eased in (t^2), still accelerating
TILT_END = (1408, 12.0)       # S14: on to 12 deg by the white (treatment), coming to rest
SLAB_DX_PER_DEG = 0.05        # the slab slides 20 cm across the walnut per 4 deg (S13)

# ---------------------------------------------------------------- interior camera
LENS_IN = 24.0
CREST_GAP = 2.0              # m above his crown at f1345
Z_EXIT = 6.95                # just through the skylight's diffuser (6.88 m) at f1360
RISE_POW = 2.0               # eased in: z = z0 + (z1 - z0) * t^RISE_POW over f1345-1360
ROLL_IN = 90.0               # deg: frame top = his right (-X); the table runs to frame left
SHIFT_IN = (0.14, 0.0)       # lens shift: he sits right of centre, the walnut runs out to frame left
EXPOSURE_IN = -0.2
BOUNCE_E = 0.5               # rig owner's walnut bounce (W), as S13

# ---------------------------------------------------------------- exterior camera
LENS_OUT = 18.0
D0, K_RISE = 35.0, 0.0768    # distance up the beam from the roof target: D0 * exp(K (f - 1363))
D_STOP = 60.0                # never closer to the slot than this (m): the frame is white by then
ROLL_HOLD = 0.0              # deg, extra roll while looking down at the box (0: slot side at frame top)
EXPOSURE_OUT = None          # None: env look's own exposure
TOP_LEVEL = None             # override the framing's moon top fill scale

DIAG = bool(os.environ.get('S14_DIAG'))
_opts = json.loads(os.environ.get('S14_OPTS', '{}') or '{}')
for _k, _v in _opts.items():
    globals()[_k] = tuple(_v) if isinstance(_v, list) else _v


# ================================================================ shared curves

def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def hermite(t, s0, s1):
    t = min(1.0, max(0.0, t))
    t2, t3 = t * t, t * t * t
    return (t3 - 2 * t2 + t) * s0 + (-2 * t3 + 3 * t2) + (t3 - t2) * s1


def gravity_deg(f):
    """The world's tilt (degrees) on film frame f: S13's eased-in curve (4 deg by f1344, still
    accelerating), carried on smoothly (same value and slope at the cut) to 12 deg at f1408."""
    a, b, g0 = TILT_S13
    if f <= b:
        t = max(0.0, (f - a) / float(b - a))
        return g0 * t * t
    f1, g1 = TILT_END
    slope = 2.0 * g0 / float(b - a)                  # deg/frame at the cut
    s0 = slope * (f1 - b) / (g1 - g0)                # in units of the mean speed
    return g0 + (g1 - g0) * hermite((f - b) / float(f1 - b), s0, 0.0)


def flare_at(f):
    """(exposure EV, white mix) on frame f."""
    return FLARE_CURVE.get(f, (0.0, 0.0))


def plain_frame(f):
    """'white' / 'black' for frames written directly, else None."""
    if f >= BLACK:
        return 'black'
    if flare_at(f)[1] >= 1.0 or BLOOM[1] < f <= OUTSIDE[1]:
        return 'white'
    return None


def write_png(path, w, h, rgb):
    """A flat 8-bit RGB PNG (pure white or pure black frames: no scene, no colour management)."""
    row = b'\x00' + bytes(rgb) * w
    raw = row * h

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as fh:
        fh.write(data)


def linear_keys(owner, a=-1e9, b=1e9, kind='LINEAR'):
    ad = owner.animation_data
    if ad is None or ad.action is None:
        return
    for fc in C.fcurves(ad.action):
        for kp in fc.keyframe_points:
            if a <= kp.co.x <= b:
                kp.interpolation = kind


def flare_nodes(sc, frames):
    """Append the flare to the compositor (after the house look): a mix toward a white so hot that
    AgX shows display white, keyed per frame; the exposure ramp is keyed on the view settings, so the
    brightest light blows out first."""
    nt = sc.node_tree
    comp = next(n for n in nt.nodes if n.bl_idname == 'CompositorNodeComposite')
    src = comp.inputs['Image'].links[0].from_socket
    mix = nt.nodes.new('CompositorNodeMixRGB')
    mix.name = 'S14_Flare'
    mix.blend_type = 'MIX'
    mix.inputs[2].default_value = (WHITE_HOT, WHITE_HOT, WHITE_HOT, 1.0)
    nt.links.new(src, mix.inputs[1])
    nt.links.new(mix.outputs[0], comp.inputs['Image'])
    base = sc.view_settings.exposure
    for f in range(frames[0] - 1, frames[1] + 2):
        ev, k = flare_at(f)
        mix.inputs[0].default_value = min(1.0, k)
        mix.inputs[0].keyframe_insert('default_value', frame=f)
        sc.view_settings.exposure = base + ev
        sc.keyframe_insert('view_settings.exposure', frame=f)
    linear_keys(nt, kind='CONSTANT')
    linear_keys(sc, kind='CONSTANT')
    sc.view_settings.exposure = base
    return mix


def animated_seed(sc):
    """Both cameras move on every frame: a fresh sampling seed per frame, so no noise pattern stays
    fixed to the screen while the world slides under it."""
    sc.cycles.use_animated_seed = True


# ================================================================ INSIDE: the dark Long Room

def room_timeline(R, room):
    """The room as S13 leaves it: every colleague dead but Pat, the printer stopped mid-sheet with
    its LED out, the droid parked at the foot (pinlight out), the hub dark, the master cord sprung,
    Kevin's padlock at his stop, everything else posted; the dark state. The slab keeps sliding
    across the walnut with the tilt (S13: 20 cm by 4 deg), re-keyed every frame on gravity_deg."""
    sc = bpy.context.scene
    T = room.terminals
    for nm in R.SHUTDOWN_ORDER:
        T[nm].off()
    T['pat'].power_on(1085)
    pr = room.printer
    pr.stop_mid(1049)
    pr.led_off(1049)
    d = room.droid
    d.place(START - 1, R.ROOM['droid_lane_x'], R.ROOM['droid_park_y'], R.ROOM['droid_start_heading'])
    d.light_off(1049)
    room.key_visible(d.binder, START - 1, False)
    for nm, i, f, dbl in R.S07_ARRIVALS:
        room.key_visible(room.props[nm][i], START - 1, False)
    pad = room.props['kevin'][0]
    pad.location = Vector((*R.stop_for('padlock', obj=pad, start=R.prop_home('kevin')), pad.location.z))
    room.hub.leds_off(961)
    room.master.pulled(961)
    room.set_state(START, 'dark')
    a, b, g0 = TILT_S13
    room.sun_drift(a, b, SLAB_DX_PER_DEG * g0)
    for s in (room.sun, getattr(room, 'sun_table', None)):
        if s is None:
            continue
        fcs = sorted([c for c in C.fcurves(s.animation_data.action) if c.data_path == 'rotation_euler'],
                     key=lambda c: c.array_index)
        r0 = [c.evaluate(a) for c in fcs]
        r1 = [c.evaluate(b) for c in fcs]
        for c in fcs:
            while len(c.keyframe_points):
                c.keyframe_points.remove(c.keyframe_points[0], fast=True)
        for f in range(START - 3, INSIDE[1] + 4):
            k = gravity_deg(f) / g0
            s.rotation_euler = tuple(x + (y - x) * k for x, y in zip(r0, r1))
            s.keyframe_insert('rotation_euler', frame=f)
        linear_keys(s)
    sc.frame_set(START)


def stage_synergy(R, S, F):
    """S13's contact pose, held: the lid's spout on the chin plate, the cup tipped toward the face in
    his right hand, the head eased back 5 deg (rig.sip_stage(k=3): the same solution S13's lift ends
    on). The mouth row full at 70% (S13's progress bar), the eyes open (reopened f1335)."""
    tl = F.FaceTimeline(START, END)
    tl.fill(1297, step=1.45, level=0.70)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    sp = Vector(R.SYNERGY_POS)
    k = 'CONSTANT'
    rig.rest(START - 2, k)
    rig.apply_preset(START - 2, 'idle_cup', k)
    rig.pose(START - 2, k, root_loc=tuple(sp), root_rot=0.0, head=S.CANON_HEAD, neck=(0, 0, 0), badge=(0, 0, 0))
    rig.sip_stage(START - 1, 3, k)
    rig.bake_pauldrons(START - 2, INSIDE[1] + 2)
    return rig


def headset_on_walnut(rig, R):
    """Where S13 left it: on the walnut beside the hub on his left, standing on its earcups, slid
    3.5 cm downhill (S13 f1318-1334). Motionless. (S13's workaround for the cord hooks: the cord wraps
    the left earcup instead of hanging in the air beside his ear.)"""
    hs = rig.headset
    if hs is None:
        return None
    sc = bpy.context.scene
    rig.detach_headset(START - 30)
    sc.frame_set(START - 30)
    hs.rotation_mode = 'QUATERNION'
    hs.location = (0.34, -0.12, 0.9)
    hs.rotation_quaternion = Matrix.Rotation(math.radians(-90), 4, 'Y').to_quaternion()
    hs.keyframe_insert('location', frame=START - 20)
    hs.keyframe_insert('rotation_quaternion', frame=START - 20)
    sc.frame_set(START - 20)
    dg = bpy.context.evaluated_depsgraph_get()
    zmin = 9.0
    for o in hs.children_recursive:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        zmin = min(zmin, min((ev.matrix_world @ Vector(c)).z for c in ev.bound_box))
    hs.location.z += R.TABLE_TOP + 0.0005 - zmin
    hs.location.x += 0.035                       # S13's slide, done
    hs.keyframe_insert('location', frame=START - 20)
    for e in rig.cord_hooks:
        for cn, v in (('worn', 0.0), ('route', 0.0), ('unplugged', 1.0)):
            if cn in e.constraints:
                con = e.constraints[cn]
                con.influence = v
                con.keyframe_insert('influence', frame=START - 20)
        for fc in C.fcurves(e.animation_data.action):
            for kp in fc.keyframe_points:
                if kp.co.x >= START - 20:
                    kp.interpolation = 'CONSTANT'
    linear_keys(hs, START - 20, END, 'CONSTANT')
    return hs


def badge_swing(rig):
    """S13's damped pendulum (7 cm) on its clip, carried on: the same simulation from f1305, so the
    swing is continuous across the cut, now following the tilt on toward 12 deg."""
    L = 0.07
    w0 = math.sqrt(9.81 / L)
    zeta = 0.12
    th, om = 0.0, 0.0
    sub = 20
    dt = 1.0 / C.FPS / sub
    for f in range(TILT_S13[0], INSIDE[1] + 3):
        for i in range(sub):
            g = gravity_deg(f - 1 + (i + 1) / sub)
            acc = -w0 * w0 * (th - g) - 2 * zeta * w0 * om
            om += acc * dt
            th += om * dt
        if f >= START - 2:
            rig.pose(f, 'LINEAR', badge=(0.0, th, 0.0))


def crown_point(rig):
    """World position of his crown apex (head parts' highest vertex) in the held pose."""
    sc = bpy.context.scene
    sc.frame_set(START)
    dg = bpy.context.evaluated_depsgraph_get()
    best = None
    for o in rig.parts_on_bones(['head']):
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            if best is None or p.z > best.z:
                best = p.copy()
        ev.to_mesh_clear()
    return best


def inside_camera(R, rig):
    """24 mm straight down from 2 m over his crown, rising straight up (eased in) through the
    slot-shaped skylight. Frame top = his right (the cup hand); the table runs out to frame left; a
    lens shift keeps him right of centre so the walnut and the slab carry the frame."""
    sc = bpy.context.scene
    crown = crown_point(rig)
    sk_end = R.ROOM['skylight_cy'] + 0.5 * R.ROOM['skylight_len']
    x, y = crown.x, min(crown.y, sk_end - 0.5 * R.ROOM['skylight_w'] - 0.02)   # inside the slot's round end
    z0 = crown.z + CREST_GAP
    cam = C.camera('cam_s14_in', lens=LENS_IN, location=(x, y, z0), clip=(0.02, 120.0))
    cam.rotation_mode = 'XYZ'
    cam.rotation_euler = (0.0, 0.0, math.radians(ROLL_IN))
    cam.data.shift_x, cam.data.shift_y = SHIFT_IN
    a, b = START, FLARE[0] + 3          # f1345 -> f1360
    for f in range(START - 2, INSIDE[1] + 3):
        t = max(0.0, (f - a) / float(b - a))
        cam.location = (x, y, z0 + (Z_EXIT - z0) * t ** RISE_POW)
        cam.keyframe_insert('location', frame=f)
    linear_keys(cam)
    sc.camera = cam
    print(f'S14 INSIDE camera: crown ({crown.x:+.3f}, {crown.y:+.3f}, {crown.z:.3f}); lens over ({x:+.3f}, {y:+.3f}) '
          f'from z {z0:.2f} to {Z_EXIT:.2f}', flush=True)
    return cam


def inside_lights(R):
    coll = C.collection('S14_light')
    sp = Vector(R.SYNERGY_POS)
    # the rig owner's warm walnut bounce (synergy_in_room's proposal; S13's level)
    b = C.area_light('s14_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                     BOUNCE_E, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=coll)
    b.visible_camera = False
    b.visible_glossy = False
    return b


def build_inside(args):
    import env_room as R
    import face as F
    import materials as M
    import synergy as S
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='dark', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(R, room)
    t1 = time.time()
    rig = stage_synergy(R, S, F)
    headset_on_walnut(rig, R)
    badge_swing(rig)
    t2 = time.time()
    cam = inside_camera(R, rig)
    inside_lights(R)
    room.render_budget(kind='wide', samples=args.samples or None, locked=False)
    room.compositor()
    sc.view_settings.exposure = EXPOSURE_IN
    room.tune_scanlines(cam)
    animated_seed(sc)
    flare_nodes(sc, INSIDE)
    sc.frame_set(START)
    if DIAG:
        report_inside(rig, cam, room)
    print(f'S14 BUILD inside: room {t1 - t0:.1f}s  synergy {t2 - t1:.1f}s  total {time.time() - t0:.1f}s', flush=True)
    return dict(room=room, rig=rig, cam=cam)


def report_inside(rig, cam, room):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    for f in (START, 1350, 1356, 1357, 1358, 1359):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        out = {}
        for nm, objs in (('head', rig.parts_on_bones(['head'])), ('cup', [o for o in rig.cup_objects() if o.type == 'MESH']),
                         ('headset', [o for o in rig.headset.children_recursive if o.type == 'MESH'])):
            xs, ys = [], []
            for o in objs:
                ev = o.evaluated_get(dg)
                for c in ev.bound_box:
                    q = world_to_camera_view(sc, cam, ev.matrix_world @ Vector(c))
                    xs.append(q.x)
                    ys.append(q.y)
            out[nm] = (min(xs), max(xs), min(ys), max(ys))
        print(f'S14 IN f{f} z {cam.matrix_world.translation.z:.2f} grav {gravity_deg(f):.2f} ' +
              '  '.join(f'{k} x {v[0]:.2f}-{v[1]:.2f} y {v[2]:.2f}-{v[3]:.2f}' for k, v in out.items()), flush=True)


# ================================================================ OUTSIDE: Offline at night

class Rise:
    """The exterior lens: on the beam's axis, D(f) metres up it from the box's roof (the point the
    beam is aimed at), looking back down the beam at the box (frame centre) until HOLD_END; then a
    180 deg tilt up (about the horizontal axis square to the beam, top of frame leading) to look up
    the beam at the slot, rolled on the way so the slot's long axis lies level."""

    def __init__(self, E):
        self.E = E
        self.T = Vector((E.ISLAND_C.x, E.ISLAND_C.y, E._BOX_Z + 5.0))
        self.down = Vector(E.SHAFT_DIR).normalized()          # slot -> box
        self.up = -self.down
        self.d_slot = (Vector(E.SLOT_C) - self.T).dot(self.up)
        hz = Vector((self.up.x, self.up.y, 0.0)).normalized()  # horizontal, toward the slot side
        self.s = Vector((0.0, 0.0, 1.0)).cross(hz).normalized()
        a = math.asin(self.up.z)
        u0 = (hz * math.sin(a) - Vector((0.0, 0.0, 1.0)) * math.cos(a)).normalized()   # frame top: slot side
        self.q0 = self._basis(self.down, u0)
        # tilt sense: forward must move toward the frame top
        sgn = 1.0
        f1 = Matrix.Rotation(0.01, 3, self.s) @ self.down
        if (f1 - self.down).dot(u0) < 0:
            sgn = -1.0
        self.sgn = sgn
        # end roll: the slot's long axis level in the frame
        qe = Quaternion(self.s, sgn * math.pi) @ self.q0
        xa = Vector(E.OFFLINE['slot_long_axis'])
        R3 = qe.to_matrix()
        right, top = R3.col[0], R3.col[1]
        ang = math.atan2(xa.dot(top), xa.dot(right))
        if ang > math.pi / 2:
            ang -= math.pi
        elif ang < -math.pi / 2:
            ang += math.pi
        self.roll_end = ang                  # rotate the camera by this about its view axis
        self.roll_hold = math.radians(ROLL_HOLD)

    @staticmethod
    def _basis(fwd, up):
        z = -fwd.normalized()
        x = up.cross(z).normalized()
        y = z.cross(x)
        return Matrix((x, y, z)).transposed().to_quaternion()

    def dist(self, f):
        return min(D0 * math.exp(K_RISE * (f - 1363)), self.d_slot - D_STOP)

    def theta(self, f):
        a, b = TILT_UP
        return math.pi * smoother((f - a) / float(b - a))

    def roll(self, f):
        a, b = TILT_UP
        return self.roll_hold + (self.roll_end - self.roll_hold) * smoother((f - a) / float(b - a))

    def location(self, f):
        return self.T + self.up * self.dist(f)

    def quat(self, f):
        q = Quaternion(self.s, self.sgn * self.theta(f)) @ self.q0
        return q @ Quaternion((0.0, 0.0, 1.0), self.roll(f))

    def forward(self, f):
        return self.quat(f) @ Vector((0.0, 0.0, -1.0))


def outside_camera(E, rise):
    sc = bpy.context.scene
    cam = E.camera_offline(LENS_OUT, rise.location(OUTSIDE[0]), rise.location(OUTSIDE[0]) + rise.down, name='cam_s14_out')
    cam.data.dof.use_dof = False                # deep focus
    cam.rotation_mode = 'QUATERNION'
    prev = None
    for f in range(OUTSIDE[0] - 2, OUTSIDE[1] + 3):
        cam.location = rise.location(f)
        q = rise.quat(f)
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        prev = q
        cam.rotation_quaternion = q
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_quaternion', frame=f)
    linear_keys(cam)
    sc.camera = cam
    return cam


def key_gravity(E, h):
    """The sea's tilt on gravity_deg (every frame, linear keys), then the crowd caches re-tilted."""
    g = h['objects']['gravity']
    for f in range(OUTSIDE[0] - 3, OUTSIDE[1] + 4):
        g.rotation_euler.x = math.radians(gravity_deg(f))
        g.keyframe_insert('rotation_euler', index=0, frame=f)
    linear_keys(g)
    E.retilt_crowds(h)


def build_outside(args):
    import env_offline as E
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    rise = Rise(E)
    fr = E.framing('s14_box')
    kw = E.build_kwargs(fr)
    fv = 1385
    kw['view'] = dict(location=tuple(rise.location(fv)), lens=LENS_OUT, res_x=1600)
    h = E.build_offline(fr['state'], include=fr['include'], frames=OUTSIDE, **kw)
    E.tune_render(sc, args.quality, args.samples)
    key_gravity(E, h)
    E.apply_fills(h, fr.get('fills'))
    E.apply_values(h, fr.get('values'))
    lv = dict(fr.get('lights') or {})
    if TOP_LEVEL is not None:
        lv['top'] = TOP_LEVEL
    E.apply_light_levels(h, lv)
    cam = outside_camera(E, rise)
    inside = all(E.camera_in_shaft(rise.location(f)) for f in range(OUTSIDE[0], BLOOM[1] + 1))
    E.set_shaft_camera(h, not inside)
    look = dict(fr.get('look', {}))
    look['inside_beam'] = inside
    E.apply_look(fr['state'], **look)
    if EXPOSURE_OUT is not None:
        sc.view_settings.exposure = EXPOSURE_OUT
    animated_seed(sc)
    flare_nodes(sc, OUTSIDE)
    sc.frame_set(OUTSIDE[0])
    report_outside(E, h, cam, rise)
    print(f'S14 BUILD outside: {time.time() - t0:.1f}s (camera inside the beam: {inside})', flush=True)
    return dict(h=h, cam=cam, rise=rise)


def report_outside(E, h, cam, rise):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene

    def pr(p):
        v = world_to_camera_view(sc, cam, Vector(p))
        return f'({v.x:.2f},{v.y:.2f}{"" if v.z > 0 else " behind"})'
    pts = dict(box=E.BOX_C, slot=E.SLOT_C, arch=E.OFFLINE['arch_crest'], atoll=E.ATOLL_C, terr=E.TERRACE_C)
    for f in (OUTSIDE[0], 1363, 1370, 1377, 1380, 1383, 1386, 1389, 1392, 1393, 1395, 1397, 1399, 1401, 1403):
        sc.frame_set(f)
        fw = rise.forward(f)
        pitch = math.degrees(math.asin(max(-1.0, min(1.0, fw.z))))
        print(f'S14 OUT f{f} d {rise.dist(f):6.1f} m  z {rise.location(f).z:6.1f}  tilt {math.degrees(rise.theta(f)):5.1f} '
              f'pitch {pitch:+6.1f} grav {gravity_deg(f):5.2f} | ' +
              ' '.join(f'{k} {pr(p)}' for k, p in pts.items()), flush=True)
    sc.frame_set(OUTSIDE[0])


# ================================================================ render

def main():
    a = C.shot_args()
    frames = C.frame_list(a, START, END)
    out_dir = os.path.join(os.path.abspath(a.out), SHOT)
    w, h_, *_ = C.QUALITY[a.quality]
    inside = [f for f in frames if INSIDE[0] <= f <= INSIDE[1] and plain_frame(f) is None]
    outside = [f for f in frames if OUTSIDE[0] <= f <= OUTSIDE[1] and plain_frame(f) is None]
    plain = [f for f in frames if plain_frame(f) is not None]
    for part, fl, builder in (('inside', inside, build_inside), ('outside', outside, build_outside)):
        if not fl and not (a.no_render and not a.only):
            continue
        builder(a)
        sub = copy.copy(a)
        sub.only = ','.join(str(f) for f in fl) if fl else str(INSIDE[0] if part == 'inside' else OUTSIDE[0])
        if a.save_blend:
            root, ext = os.path.splitext(a.save_blend)
            sub.save_blend = f'{root}_{part}{ext or ".blend"}'
        if not fl:
            sub.no_render = True
        t0 = time.time()
        C.render(SHOT, sub, START, END)
        if fl and not a.no_render:
            print(f'S14 RENDER {part}: {len(fl)} frames in {time.time() - t0:.1f}s '
                  f'({(time.time() - t0) / len(fl):.1f}s/frame)', flush=True)
    if a.no_render:
        return
    os.makedirs(out_dir, exist_ok=True)
    for f in plain:
        kind = plain_frame(f)
        path = os.path.join(out_dir, f'{f:04d}.png')
        write_png(path, w, h_, (255, 255, 255) if kind == 'white' else (0, 0, 0))
        print(f'RENDERED {SHOT} {f} {path} ({kind})', flush=True)


if __name__ == '__main__':
    main()
