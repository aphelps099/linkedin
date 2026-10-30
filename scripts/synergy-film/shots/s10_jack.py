"""S10 · f929-992 · the jack (E3_MACRO_INSERTS: socket and jack, inside the Long Room).

    blender -b --factory-startup -P shots/s10_jack.py -- --quality proof --only 929,937,939,941,945,953,961,963,964,982,983,992
    blender -b --factory-startup -P shots/s10_jack.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s10_jack.py -- --quality final
    S10_DEBUG=1 ... -- --no-render         # the per-frame gates (report): pads, contacts, cord, hub, colours

Macro of the brass socket in the walnut's head edge and the gold jack in it: env_room's approved
's10_jack_macro' set-up (insert kit, hidden far walls), looking back toward the hub along the
master cord (CAM: 100 mm f/5.6, 44 deg round from the jack's axis, 7.5 deg down, 0.48 m from the
knurl; shifted so the socket and knurl sit right of centre in the lower third). The hub fills
the top of the frame, soft, its green LEDs dying with the music on f961; the coil hooks under the
jack and climbs the left of the frame to the head edge, then leads back across the walnut to it.
His hand comes in from frame right (his side) and its mass leaves the frame there. The
colleagues' colours: Synthia's own ivory screen in the top-left corner, a disc where the lens sees
past the hub (place_bokeh), and cards mirrored in the hub's glossy dome and the walnut's top
(colour_cards), all driven by their screens. Locked off; a slow focus breathe as the fingers
enter, a late follow-focus onto the jack after the pull. Real time, motion blur on the pull.

    f929       the jack seated: the first still (the hand is above the frame)
    f925-934   his ivory left hand comes straight down from above the frame, thumb part open,
               index out, the other three already curled, to the knurl's height beside it
    f934-938   it moves across onto the knurl (ready_offset: the search for an approach on which
               nothing touches the jack, the socket, the cord or the walnut)
    f936-938   the index closes under the knurl                                    (servo f937)
    f938-940   the middle finger closes                                            (servo f939)
    f940-942   the thumb comes onto the knurl, 0.4 mm off it                       (servo f941)
    f944-945   grip: the thumb bites (both pads touching the knurl, calibrate_pinch) (click f945)
    f945-960   held; f952-953 one knuckle hub flexes 1 degree (resolve: knuckle_flex)
    f961-963   the pull, hand and jack as one: axial first (the 15 mm pin is out of the bore on
               f962), then up and back, 2.9 cm in all; a glint runs down the barrel (glint);
               the hub's LEDs die on f961 with the music
    f963-992   the hand holds still; the jack, pinched between the pads, sways about the line
               through the two pad contacts (fit_swing: inside the angles that clear his
               fingers): the first lobe carries the pull's momentum up, two damped cycles, then
               it hangs, tail down under the coil's weight
    f961-984   the yellow coil springs: kicked toward the jack, an overshoot and two damped
               settles, then slack (cord_follow: the hook under the jack sags out of the frame,
               the run on the walnut lies looser)
    f983-992   silence, the jack at rest in his fingers

Canon: left hand only; the cup stays at his chest in the right hand (the 8 degree lean from the
waist that the reach needs, the rig's most, is keyed with rig.lean(keep_cup=True) every frame);
no head dip; he never walks. No text anywhere.

The grip (solve_grip) is searched on the rig: the pinch axis's angle round the knurl, its turn,
shoulder protraction, elbow pole and the curl of the three free fingers, for a pose the arm
reaches exactly, clear of his body, the walnut, the jack, the socket nut and the cord, that
keeps the most of the jack, the socket, the hub and the cord in the lens's sight. calibrate_pinch
then measures the real pad surfaces (BVH) and moves the hand and closes the thumb until both pads
touch the knurl (and calibrate_pull again on the pulled jack). The solve is cached in out/cache
(keyed on this file, the rig, the props, the room, the camera and the jack's seat).

S11 hand-over (f992): handover(rig, room) keys this shot's whole left-hand performance, the jack
and the master cord (left_hand, key_jack, room.master.pulled, cord_follow), so S11's f993 is
exactly this f992. GAP holds the held thumb gap and GRIP_FINGERS the chosen curl once left_hand
has run; CORD_EDGE is where the re-laid cord rolls over the head edge.
"""

import hashlib
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as P  # noqa: E402
import synergy as S  # noqa: E402

SHOT = 's10'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']
DEBUG = bool(os.environ.get('S10_DEBUG'))

# ------------------------------------------------------------------ the beats (film frames)
F_PREROLL = 921          # S09's end: index on the walnut at the padlock (reach_L), upright
F_LEAN = 931             # the 6 degree lean is in by here (cup kept in place)
F_DESC0 = 925            # the hand starts down from above the frame (pre-roll)
F_READY = 934            # the open hand is down at the knurl's height, beside it
F_LAND = 936             # the open hand arrives at the barrel
F_INDEX, F_MIDDLE, F_THUMB = 937, 939, 941    # each finger's servo; its close straddles the frame
F_GRIP = 945             # the thumb bites the knurl
F_KNUCKLE = 953          # one knuckle hub flexes 1 degree
F_PULL = 961             # downbeat: the jack leaves the socket in 3 frames, the music dies
F_OUT = 963              # the pull is done: the hand holds still from here
F_SPRING_END = 982
LEAN_DEG = float(os.environ.get('S10_LEAN', '8.0'))   # the rig's most (lean() clamps at 8): the socket is low and far

# the pull path of the jack (offsets from its seat, world): axial first so the 15 mm pin
# clears the bore (out of the bushing on f962), then up and back: 2.9 cm in all
PULL = {F_PULL - 1: (0.0, 0.0), F_PULL: (0.010, 0.0), F_PULL + 1: (0.018, 0.006), F_OUT: (0.024, 0.017)}

# grip geometry: a pinch on the knurl with the fingertips (thumb pad against index pad)
PINCH_ALONG = float(os.environ.get('S10_PINCH_ALONG', '0.0215'))  # pinch point along the jack axis from its shoulder (knurl spans 2.0-22.5 mm)
KNURL_R = 0.0049         # the knurl's radius (props.gold_jack: 4.9 mm, teeth +-0.08 mm)
GAP = 0.0099             # thumb pad gap asked of rig.thumb_pinch; calibrate_pinch replaces it with
                         # the value at which the real pads touch the knurl (S11 reads it after left_hand)
PAD_TARGET = 0.00005     # each pad's distance to the knurl at the grip: touching (no interpenetration)
PAD_LAND = 0.0004        # the thumb lands this far off the knurl (f942-944), then bites (f945)
GAP_OPEN = 0.036         # thumb opened while the hand comes down
# the index curl of the rig's own 'pinch' hand shape: with it rig.thumb_pinch reaches the gap it is
# asked for (err 0.2 mm); the first build's (18, 44, 30) left the thumb 7 mm short of its target
PINCH_INDEX = tuple(float(x) for x in os.environ.get('S10_INDEX', '30,70,50').split(','))
GRIP_FINGERS = dict(index=PINCH_INDEX, middle=(70.0, 92.0, 60.0), ring=(80.0, 95.0, 60.0),
                    pinky=(84.0, 95.0, 58.0))
OPEN_FINGERS = dict(index=(10.0, 26.0, 18.0), middle=(46.0, 66.0, 44.0), ring=(54.0, 70.0, 46.0),
                    pinky=(52.0, 64.0, 42.0))
# the curl of the other three fingers at the grip, searched with the hand (solve_grip): the one
# that keeps them out of the jack, the cord and the walnut; GRIP_FINGERS becomes the chosen set
FINGER_SETS = {
    'grip': dict(middle=(70.0, 92.0, 60.0), ring=(80.0, 95.0, 60.0), pinky=(84.0, 95.0, 58.0)),
    'tuck': dict(middle=(84.0, 100.0, 70.0), ring=(86.0, 100.0, 70.0), pinky=(88.0, 100.0, 68.0)),
    'open': dict(middle=(40.0, 55.0, 35.0), ring=(48.0, 62.0, 40.0), pinky=(54.0, 68.0, 44.0)),
}
# on the way down: index out, middle half closed, ring and pinky tucked (their tips stay clear of
# the walnut's edge face while the hand comes down past it)
DESC_FINGERS = dict(index=OPEN_FINGERS['index'], middle=(58.0, 80.0, 52.0), ring=GRIP_FINGERS['ring'],
                    pinky=GRIP_FINGERS['pinky'])
DESC_H = 0.20            # the hand this far above the knurl at F_DESC0
GRIP_TH = float(os.environ['S10_TH']) if os.environ.get('S10_TH') else None     # pin the pinch axis's angle round the jack (debug)
GRIP_PS = float(os.environ['S10_PS']) if os.environ.get('S10_PS') else None     # pin its turn (debug)
REACH_MAX = float(os.environ.get('S10_REACH_MAX', '0.002'))   # the wrist's miss (m): the pads must really get there
SHOULDERS = ((30, 0, 0), (36, -4, 0), (40, -4, 0), (40, 4, 0), (24, -6, 0), (16, 0, 0), (46, -4, 0), (50, -6, 0),
             (56, -4, 0), (60, -6, 0))
POLES = ((0.8, 0.3, -0.5), (0.95, 0.25, 0.0), (0.6, 0.6, -0.5), (0.3, 0.9, -0.3))
# preferred direction of the pinch axis (index pad -> thumb pad), world; None = free
AXIS_PREF = tuple(float(x) for x in os.environ['S10_AXIS_PREF'].split(',')) if os.environ.get('S10_AXIS_PREF') else None
# sight-line weights (solve_grip): what the hand and forearm must not hide from the lens
SIGHT_W = dict(jack=1.0, socket=2.0, hub=3.0, led=4.0, cord=0.5)
HUB_U_MAX = 0.62
AXIS_VIEW_W = float(os.environ.get('S10_AXIS_VIEW_W', '4.0'))   # solve_grip: keep the pinch axis square to the view

# the jack's sway in the pinch after the pull, about the line through the two pad contacts
# (degrees; + = the tail lifts: sol['axis_w'] is oriented so). The first lobe carries the pull's
# up-and-back momentum on; two damped cycles; it settles with the tail lifted by the coil.
SWING = dict(rest=float(os.environ.get('S10_SWING_REST', '5')), amp=float(os.environ.get('S10_SWING_AMP', '9')),
             period=13.0, decay=2.4, tau=5.0)

CACHE = os.environ.get('S10_CACHE', os.path.join(C.ROOT, 'out', 'cache'))


def ease(t):
    return C.ease(t, 'inout')


# ------------------------------------------------------------------ room and props

def build_room():
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    T = room.terminals
    # S09 hand-over: Kevin's same padlock has slid in to the fingertip (it stays there)
    pad = room.props['kevin'][0]
    home = R.prop_home('kevin')
    stop = Vector(R.stop_for('padlock', obj=pad, start=home))
    dirn = (stop - Vector(home)).normalized()
    P.slide(pad, 838, 852, tuple(stop - dirn * 1.6), tuple(stop), settle=0.0, accel=0.2)
    T['kevin'].speak(833, 869, seed=7)
    # the hub's LEDs die with the music on the pull
    room.hub.leds_off(F_PULL)
    return room


# The master cord is re-laid for this insert (its hub end and the jack end are the room's): out
# of the jack's tail it hooks down under the jack, climbs the edge face on the far side of the
# socket from his hand (his left, frame left) and rolls over the head edge 4.5 cm outboard of the
# socket, then runs back across the walnut to the hub. It frames the socket and leads the eye up
# to the hub instead of arching over the knurl through his fingers.
# {key: (x, y, dz over the walnut or None)}, world.
CORD_MIDS = {'mid0': (0.065, -0.150, None), 'mid1': (0.185, -0.070, None), 'mid2': (0.292, 0.006, 0.004),
             'mid3': (0.304, 0.022, -0.030), 'mid4': (0.284, 0.050, -0.090)}
CORD_EDGE = (0.292, 0.0, R.TABLE_TOP)     # where it rolls over the head edge (S11's jack drop hangs from here)
if os.environ.get('S10_CORD') == 'room':
    CORD_MIDS = {}


def route_master_cord(room):
    """Re-lay the master cord's rest (seated) control points for this insert (CORD_MIDS).
    Idempotent; left_hand and key_jack call it, so S11's hand-over sees the same cord."""
    tz = R.TABLE_TOP + R.MASTER_RC
    for key, (x, y, dz) in CORD_MIDS.items():
        e = room.master.e[key]
        if e.animation_data and e.animation_data.action:
            continue                     # already sprung (keyed): leave it
        e.location = (x, y, tz if dz is None else tz + dz)
    bpy.context.view_layer.update()


def glint(room, cam):
    """The pull's glint: a small hot card, seen only in the jack's gold and chrome (glossy rays,
    light-linked to the jack), riding with the jack on the lens side of the barrel and running
    from the tail to the tip over f961-963, so one bright point travels down the knurl as the
    jack leaves the socket (motion blur draws it as a streak). Large and dim enough that its
    core stays gold (only a 2-3 px core clips at final)."""
    jr = room.jack.root
    coll = C.collection('S10_lights')
    lt = C.area_light('s10_glint', (0.0, 0.0, 0.0), None, 0.0, 0.010, 0.004, color=(1.0, 0.90, 0.72), coll=coll)
    lt.visible_camera = False
    lt.visible_diffuse = False
    lt.visible_transmission = False
    lt.visible_glossy = True
    lt.data.spread = math.radians(90)
    bpy.context.view_layer.update()
    # the card 2.4 cm off the barrel's axis, between the lens and straight up, facing the axis
    Mj = jr.matrix_world
    cam_l = Mj.inverted() @ cam.matrix_world.translation
    rad = Vector((cam_l.x, 0.0, cam_l.z)).normalized()
    up = Vector((0.0, 0.0, 1.0))
    d = (rad + up).normalized()
    lt.parent = jr
    lt.matrix_parent_inverse = Matrix.Identity(4)
    recv = [o for o in jr.children_recursive if o.type == 'MESH']
    lc = bpy.data.collections.get('S10_glint_receivers') or bpy.data.collections.new('S10_glint_receivers')
    for o in recv:
        if lc.objects.get(o.name) is None:
            lc.objects.link(o)
    lt.light_linking.receiver_collection = lc
    for f, y, e in ((F_PULL - 1, 0.030, 0.0), (F_PULL, 0.024, 0.006), (F_PULL + 1, 0.012, 0.006), (F_OUT, 0.0, 0.003),
                    (F_OUT + 1, -0.006, 0.0)):
        lt.location = d * 0.024 + Vector((0.0, y, 0.0))
        lt.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        lt.keyframe_insert('location', frame=f)
        lt.keyframe_insert('rotation_euler', frame=f)
        lt.data.energy = e
        lt.data.keyframe_insert('energy', frame=f)
    for owner in (lt, lt.data):
        for fc in C.fcurves(owner.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    return lt


def jack_seat(room):
    """World matrix of the jack seated in the socket, its axis (+Y out of the socket)."""
    bpy.context.view_layer.update()
    M0 = room.jack.root.matrix_world.copy()
    return M0, (M0.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()


def pull_matrix(M0, f):
    """Jack world matrix on the pull (f961-963); seated before."""
    keys = sorted(PULL)
    if f <= keys[0]:
        dy, dz = PULL[keys[0]]
    elif f >= keys[-1]:
        dy, dz = PULL[keys[-1]]
    else:
        dy, dz = PULL[int(f)]
    return Matrix.Translation(Vector((0.0, dy, dz))) @ M0


def swing_deg(f):
    """Angle of the jack about the pad-contact axis after the pull (+ = tail up): the first lobe
    carries the pull's momentum on, two damped cycles, and a settle with the tail lifted."""
    if f <= F_OUT:
        return 0.0
    t = f - F_OUT
    sw = SWING
    w = 2.0 * math.pi / sw['period']
    lam = sw['decay'] / sw['period']
    settle = sw['rest'] * (1.0 - math.exp(-t / sw['tau']))
    return settle + sw['amp'] * math.exp(-lam * t) * math.sin(w * t)


def jack_matrix(M0, f, pivot_local, axis_local):
    """Jack world matrix at film frame f: seated, pulled with the hand, then pivoting between
    the pads (pivot and axis in the jack's local space, fixed in the hand once it holds still)."""
    if f <= F_OUT:
        return pull_matrix(M0, f)
    M_out = pull_matrix(M0, F_OUT)
    piv_w = M_out @ pivot_local
    ax_w = (M_out.to_3x3() @ axis_local).normalized()
    Rr = Matrix.Rotation(math.radians(swing_deg(f)), 4, ax_w)
    return Matrix.Translation(piv_w) @ Rr @ Matrix.Translation(-piv_w) @ M_out


def key_jack(room, M0, pivot_local, axis_local):
    """Key the jack root every frame (jack_matrix). Also lays the master cord's rest route for
    this insert (route_master_cord), so a room.master.pulled() after it springs that route."""
    route_master_cord(room)
    jr = room.jack.root
    jr.rotation_mode = 'QUATERNION'
    for f in range(START - 2, END + 3):
        jr.matrix_world = jack_matrix(M0, f, pivot_local, axis_local)
        jr.keyframe_insert('location', frame=f)
        jr.keyframe_insert('rotation_quaternion', frame=f)
    for fc in C.fcurves(jr.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


# ------------------------------------------------------------------ the master cord after the pull

# cord_follow: how much of the jack's own motion (pull + sway) each free control point near the
# jack carries (the rest springs on its own), and the coil's spring
FOLLOW = {'mid4': 0.3, 'mid3': 0.2, 'mid2': 0.08}
SPRING = dict(kick=0.018, cycles=2.0, dur=22, decay=3.0, sag=(0.004, -0.006, -0.022), slide=(0.004, 0.003, 0.0))
# how much of the spring each free point takes: the climb up the edge face (mid3, frame left) and
# the roll over the edge carry it; the hook's bottom under the jack stays low, below the empty socket
KICK_W = {'mid4': 0.25, 'mid3': 1.0, 'mid2': 0.8, 'mid1': 0.5, 'mid0': 0.3}


def _fc_location(obj, frame):
    """The object's keyed location at `frame` (its current location if it is not animated)."""
    ad = obj.animation_data
    if not ad or not ad.action:
        return Vector(obj.location)
    v = Vector(obj.location)
    for fc in C.fcurves(ad.action):
        if fc.data_path == 'location':
            v[fc.array_index] = fc.evaluate(frame)
    return v


def cord_follow(room, M0, sol):
    """Key the master cord's free control points every frame from the pull to past the cut,
    replacing whatever room.master.pulled() keyed (S11 calls it after pulled() too, so the cord
    is identical across the f992/f993 cut).

    Each point = its seated rest + the jack's own displacement, weighted toward the jack
    (FOLLOW: the coil near the strain relief is carried with the pull and the sway, so it never
    folds back over the relief) + the coil's spring: yanked toward the jack, an overshoot and two
    damped settles (SPRING), then slack: the overhang sags into a soft U and the run on the
    walnut lies looser. Points over the walnut bounce (lift off, drop back) and never go under
    the coil's floor."""
    mc = room.master
    names = list(mc.mids)
    n = len(names)
    rest = {nm: _fc_location(mc.e[nm], F_PULL - 4) for nm in names}
    pivot_local = M0.inverted() @ sol['pinch_w']
    axis_local = (M0.to_3x3().inverted() @ sol['axis_w']).normalized()
    M0i = M0.inverted()
    kick = Vector((0.0,) + tuple(PULL[F_OUT])).normalized()
    for k, nm in enumerate(names):
        e = mc.e[nm]
        if e.animation_data and e.animation_data.action:
            e.animation_data_clear()
        r0 = rest[nm]
        w = (k + 1) / n                          # the end near the jack springs most
        wf = FOLLOW.get(nm, 0.0)
        lag = int(round(2 * (1 - w)))            # the wave runs back toward the hub
        on_wood = mc._over_floor(r0)
        e.location = r0
        e.keyframe_insert('location', frame=F_PULL - 2)
        for f in range(F_PULL - 1, END + 3):
            Dj = jack_matrix(M0, f, pivot_local, axis_local) @ M0i
            p = r0 + (Dj @ r0 - r0) * wf
            i = f - (F_PULL + lag)
            if i > 0:
                t = min(1.0, i / SPRING['dur'])
                amp = math.exp(-SPRING['decay'] * t) * math.sin(2 * math.pi * SPRING['cycles'] * t)
                d = kick * (SPRING['kick'] * amp * KICK_W.get(nm, w))
                if on_wood:
                    d.z = abs(d.z)
                    sl = Vector(SPRING['slide'])
                    d += sl * (ease(t) * w)
                else:
                    d += Vector(SPRING['sag']) * (ease(t) * w)
                p = p + d
            if on_wood and mc.floor_z is not None:
                p.z = max(p.z, mc.floor_z)
            e.location = p
            e.keyframe_insert('location', frame=f)
        for fc in C.fcurves(e.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'


# ------------------------------------------------------------------ the hand on the jack

def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-12)))
    return (p - (a + ab * t)).length


def _seg_dist_np(Q, A, B):
    """Distances (N, M) from points Q (N, 3) to segments A (M, 3) - B (M, 3)."""
    AB = B - A
    AB2 = np.maximum((AB * AB).sum(1), 1e-12)
    AQ = Q[:, None, :] - A[None, :, :]
    t = np.clip((AQ * AB[None]).sum(2) / AB2[None], 0.0, 1.0)
    return np.linalg.norm(AQ - t[..., None] * AB[None], axis=2)


def index_pad(rig):
    """(index pad surface point, pad normal toward the thumb) in hand-rest space for the grip's
    index angles: rig.thumb_pinch's own index model (the pad 6 mm behind the tip, PAD_R_INDEX
    out along the pad normal). The hand is placed by this point, so the thumb's gap can change
    without moving the index."""
    hd = rig.hands['L']
    fd = hd['fingers']['index']
    w = hd['w']
    hinge = fd['dir'].cross(w).normalized()
    Pp = fd['K'].copy()
    d = fd['dir'].copy()
    acc = 0.0
    for L, a_ in zip(fd['lens'], PINCH_INDEX):
        acc += a_
        d = Matrix.Rotation(math.radians(acc), 3, hinge) @ fd['dir']
        Pp = Pp + d * L
    pad_n = (Matrix.Rotation(math.radians(acc), 3, hinge) @ w).normalized()
    return Pp - d * 0.006 + pad_n * S.PAD_R_INDEX, pad_n


def thumb_rots(rig, gap):
    return rig.thumb_pinch('L', index_angles=PINCH_INDEX, gap=gap)


def cord_obstacles(room, step=0.005, keep=lambda p: True):
    """Points along the master cord's centreline (world), from its hooked control points (an
    order-3 clamped NURBS, as props.master_cord builds it), every `step` metres."""
    bpy.context.view_layer.update()
    m = room.master
    names = ['anchor', 'anchor2'] + sorted(m.mids, key=lambda s: int(s[3:])) + ['tail2', 'tail']
    P_ = [m.e[n].matrix_world.translation.copy() for n in names]
    n = len(P_)
    k = 3
    knots = [0.0] * k + [float(i) for i in range(1, n - k + 1)] + [float(n - k + 1)] * k

    def basis(i, kk, t):
        if kk == 1:
            return 1.0 if (knots[i] <= t < knots[i + 1] or (t == knots[-1] and knots[i] < t <= knots[i + 1])) else 0.0
        a = 0.0 if knots[i + kk - 1] == knots[i] else (t - knots[i]) / (knots[i + kk - 1] - knots[i]) * basis(i, kk - 1, t)
        b = 0.0 if knots[i + kk] == knots[i + 1] else (knots[i + kk] - t) / (knots[i + kk] - knots[i + 1]) * basis(i + 1, kk - 1, t)
        return a + b
    tmax = knots[-1]
    pts = [sum((P_[i] * basis(i, k, tmax * j / 400.0) for i in range(n)), Vector()) for j in range(401)]
    out = [pts[0]]
    for p in pts[1:]:
        if (p - out[-1]).length >= step:
            out.append(p)
    return [p for p in out if keep(p)]


def hub_leds(room):
    """World centres of the hub's three mic LEDs."""
    bpy.context.view_layer.update()
    o = room.hub.leds
    mw = o.matrix_world
    c = room.hub.root.matrix_world.translation
    groups = {}
    for v in o.data.vertices:
        p = mw @ v.co
        a = round(math.degrees(math.atan2(p.y - c.y, p.x - c.x)) / 120.0)
        groups.setdefault(a % 3, []).append(p)
    return [sum(g, Vector()) / len(g) for g in groups.values()]


def in_frame(cam, p, margin=0.0):
    from bpy_extras.object_utils import world_to_camera_view
    uv = world_to_camera_view(bpy.context.scene, cam, p)
    return margin <= uv.x <= 1 - margin and margin <= uv.y <= 1 - margin and uv.z > 0


def sight_targets(room, cam, M0, jax):
    """[(world point, weight, kind)] the lens must see past his hand: the gold barrel's lens side,
    the socket's face, the hub (its disc and the LEDs in frame) and the cord's run (SIGHT_W)."""
    o = M0.translation
    cam_p = cam.matrix_world.translation
    v = cam_p - o
    rad = (v - jax * v.dot(jax)).normalized()
    out = [(o + jax * a + rad * 0.0045, SIGHT_W['jack'], 'jack') for a in (0.004, 0.010, 0.017, 0.024, 0.036, 0.045)]
    sock = Vector(R.SOCKET_POS) + Vector((0.0, P.SOCKET_FACE, 0.0))
    side = jax.cross(Vector((0.0, 0.0, 1.0))).normalized()
    out += [(sock + Vector((0.0, 0.0, 0.0105)), SIGHT_W['socket'], 'socket'),
            (sock + side * 0.009 + Vector((0.0, 0.0, 0.006)), SIGHT_W['socket'], 'socket'),
            (sock - side * 0.009 + Vector((0.0, 0.0, 0.006)), SIGHT_W['socket'], 'socket')]
    # the hub: its disc and its LEDs on the side of the frame away from his arm (which comes in
    # from frame right: the LED on the right lobe is his to cover)
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    hub = room.hub.root.matrix_world
    for q in (Vector((0.0, 0.0, 0.040)), Vector((0.0, 0.03, 0.044)), Vector((0.03, 0.04, 0.030)),
              Vector((-0.03, 0.04, 0.030)), Vector((0.06, 0.0, 0.030)), Vector((0.04, -0.04, 0.035))):
        p = hub @ q
        if in_frame(cam, p, 0.02) and world_to_camera_view(sc, cam, p).x < HUB_U_MAX:
            out.append((p, SIGHT_W['hub'], 'hub'))
    for p in hub_leds(room):
        if in_frame(cam, p, 0.02) and world_to_camera_view(sc, cam, p).x < HUB_U_MAX:
            out.append((p, SIGHT_W['led'], 'led'))
    for q in cord_obstacles(room, step=0.02):
        if in_frame(cam, q, 0.0):
            out.append((q, SIGHT_W['cord'], 'cord'))
    return out


def solve_grip(rig, room, cam, frame, M0, jax):
    """The left hand pinching the knurl with its fingertips. The hand starts from his natural
    hanging orientation (fingers down, palm toward his body) and is searched over the pinch
    axis's angle round the jack, its turn about that axis, elbow poles and shoulder offsets (the
    reach needs the shoulder protracted), for the pose that reaches the knurl, clears his body,
    the walnut, the socket and the cord, and leaves the most of the gold, the socket, the hub
    and the cord in view of the lens (sight_targets). Coarse grid, then a fine one round the
    best. The hand is placed by its index pad (index_pad) on the knurl's surface."""
    t0 = time.time()
    Dc = rig._chest_delta(frame)
    Dw = Dc.inverted()
    R3, Rw = Dc.to_3x3(), Dw.to_3x3()
    o = M0.translation
    pinch_w = o + jax * PINCH_ALONG
    pin = thumb_rots(rig, GAP)
    hd = rig.hands['L']
    W0 = rig.arm.data.bones['hand_L'].head_local
    fsets = {k: rig.finger_angles('L', dict(v, index=PINCH_INDEX)) for k, v in FINGER_SETS.items()}
    ip, a_h = index_pad(rig)
    jack_a, jack_b = np.array(o - jax * 0.015), np.array(o + jax * 0.047)
    sock = Vector(R.SOCKET_POS) + Vector((0.0, P.SOCKET_FACE, 0.0))
    sock_a, sock_b = np.array(sock - jax * 0.004), np.array(sock + jax * 0.001)
    tlo = np.array((-0.8, -30.0, R.ROOM['table_bottom_z']))
    thi = np.array((0.8, 0.0, R.TABLE_TOP))
    up = Vector((0.0, 0.0, 1.0))
    cam_p = cam.matrix_world.translation.copy()
    # the master cord's run near the jack, as spheres the hand must keep clear of (coil radius
    # 5.5 mm + 2.5 mm air), in chest space
    cord = [(Dc @ q, R.CORD_RC + 0.0025)
            for q in cord_obstacles(room, keep=lambda q: q.y > -0.06 and q.z < 0.86)]
    looks = sight_targets(room, cam, M0, jax)
    LK = np.array([tuple(p) for p, _, _ in looks])
    LW = np.array([w for _, w, _ in looks])
    CA = np.repeat(np.array(cam_p)[None], len(looks), 0)
    Dw_np = np.array(Dw)
    pinch_np = np.array(pinch_w)
    view_dir = (pinch_w - cam_p).normalized()

    def frame_for(th, ps):
        """Hand frame (chest space) whose pinch axis is square to the jack at angle th round it
        and turned ps about that axis."""
        a_w = (Matrix.Rotation(math.radians(th), 3, jax) @ Vector((1.0, 0.0, 0.0))).normalized()
        a_c = (R3 @ a_w).normalized()
        Rt = Matrix.Rotation(math.radians(ps), 3, a_c) @ a_h.rotation_difference(a_c).to_matrix()
        return Rt @ hd['u'], Rt @ hd['w'], a_w, Rt

    def score(th, ps, sh, pole):
        hu, hw, ax_w, Rt = frame_for(th, ps)
        tgt = Dc @ (pinch_w - ax_w * KNURL_R)
        wrist = tgt - Rt @ (ip - W0)
        Rsh, Ru, Rf, Rh = rig._arm_solution('L', wrist, hu, hw, Vector(pole), sh)
        chain = rig._arm_chain('L', Rsh, Ru, Rf, Rh)
        reach = (chain[3] @ W0 - wrist).length
        if reach > REACH_MAX:
            return None
        Dp = rig._pauldron_delta('L', chain, Ru)
        best_f = None
        for fname, fingers in fsets.items():
            r_ = score_fingers(th, ps, sh, pole, hu, hw, ax_w, wrist, chain, Dp, reach, fingers)
            r_['fingers'] = fname
            if best_f is None or r_['score'] < best_f['score']:
                best_f = r_
        return best_f

    def score_fingers(th, ps, sh, pole, hu, hw, ax_w, wrist, chain, Dp, reach, fingers):
        Ru = None
        smp = rig._arm_samples('L', chain, fingers, thumb=pin['rot'])
        pen = rig._penetration(smp, None, side='L', Dsh=Dp, obstacles=cord)
        smp = [s_ for s_ in smp if s_[2] not in ('hub', 'upper')]
        Pc = np.array([tuple(p) for p, _, _ in smp])
        Rr = np.array([r for _, r, _ in smp])
        parts = [pt for _, _, pt in smp]
        Q = Pc @ Dw_np[:3, :3].T + Dw_np[:3, 3]
        # the two pads (the index's distal segment, the thumb's last two samples) may touch the
        # knurl; everything else keeps clear of the jack, the socket's nut and the walnut
        pads = np.zeros(len(parts), bool)
        f0 = parts.index('finger')
        pads[f0 + 6:f0 + 9] = True                    # index (first finger), distal segment
        th_i = [i for i, pt in enumerate(parts) if pt == 'thumb']
        pads[th_i[-2:]] = True
        # the walnut (a box), with 3 mm air
        dd = np.maximum(tlo - Q, Q - thi)
        sdf = np.linalg.norm(np.maximum(dd, 0.0), axis=1) + np.minimum(dd.max(1), 0.0) - Rr
        tab = float((np.clip(0.003 - sdf, 0.0, None) ** 2).sum() * 4e5)
        dj = _seg_dist_np(Q, jack_a[None], jack_b[None])[:, 0] - Rr - 0.0050
        ds_ = _seg_dist_np(Q, sock_a[None], sock_b[None])[:, 0] - Rr - 0.0105
        jk = float((np.clip(0.0015 - dj[~pads], 0.0, None) ** 2).sum() * 4e5 +
                   (np.clip(0.0015 - ds_, 0.0, None) ** 2).sum() * 4e5)
        ds = _seg_dist_np(Q, CA, LK) - Rr[:, None]
        sight = float((np.clip((0.003 - ds) / 0.006, 0.0, 1.0) * LW[None]).sum())
        huw = (Rw @ hu).normalized()
        down = 1.0 + huw.z
        pref = 0.0 if AXIS_PREF is None else 1.0 - ax_w.dot(Vector(AXIS_PREF).normalized())
        # the pads above and below the knurl as the lens sees it (the gold between them), not one
        # pad in front of it: the pinch axis square to the line of sight
        pref += AXIS_VIEW_W * abs(ax_w.dot(view_dir))
        total = (pen * 1e5 + reach * 50 + tab + jk + down * 0.3 + sight * 0.25 + pref * 1.5 +
                 0.002 * abs(sh[0]))
        return dict(score=total, wrist=wrist, u=hu, w=hw, pole=Vector(pole), shoulder=tuple(sh), pen=pen, reach=reach,
                    table=tab, jack=jk, sight=sight, rot=(th, ps), down=down, pref=pref, axis=ax_w)
    best = None
    th_range = range(0, 360, 20) if GRIP_TH is None else [int(GRIP_TH)]
    ps_range = range(0, 360, 20) if GRIP_PS is None else [int(GRIP_PS)]
    per_th = {}
    per_rot = {}
    for th in th_range:
        for ps in ps_range:
            for sh in SHOULDERS:
                for pole in POLES:
                    s_ = score(th, ps, sh, pole)
                    if s_ is None:
                        continue
                    if best is None or s_['score'] < best['score']:
                        best = s_
                    if th not in per_th or s_['score'] < per_th[th]['score']:
                        per_th[th] = s_
                    if (th, ps) not in per_rot or s_['score'] < per_rot[(th, ps)]['score']:
                        per_rot[(th, ps)] = s_
    if DEBUG:
        for th, c in sorted(per_th.items()):
            print(f'S10 GRIP th={th:3d} best ps={c["rot"][1]:3d} score={c["score"]:.3f} reach={c["reach"]*1000:.1f} '
                  f'pen={c["pen"]*1e4:.3f} table={c["table"]:.3f} jack={c["jack"]:.3f} sight={c["sight"]:.2f} '
                  f'down={c["down"]:.2f} axis={tuple(round(x, 2) for x in c["axis"])} pole={tuple(c["pole"])} '
                  f'sh={c["shoulder"]} fingers={c["fingers"]}', flush=True)
    th0, ps0 = best['rot']
    for th in range(th0 - 12, th0 + 13, 4):
        for ps in range(ps0 - 12, ps0 + 13, 4):
            for sh in {best['shoulder'], (best['shoulder'][0] - 4, best['shoulder'][1], 0),
                       (best['shoulder'][0] + 4, best['shoulder'][1], 0)}:
                s_ = score(th, ps, sh, tuple(best['pole']))
                if s_ is not None and s_['score'] < best['score']:
                    best = s_
    sol = best
    GRIP_FINGERS.update(FINGER_SETS[sol['fingers']])
    sol['per_th'] = per_th
    sol['per_rot'] = per_rot
    sol['pin'] = pin
    sol['pinch_axis_w'] = best['axis'].copy()
    sol['anchor_w'] = pinch_w - best['axis'] * KNURL_R          # where the index pad goes (seated)
    sol['grip_w'] = pinch_w
    sol['pinch_w'] = pinch_w
    if DEBUG:
        print(f'S10 GRIP solve {time.time() - t0:.1f}s score={sol["score"]:.4f} pen={sol["pen"] * 1e4:.4f} '
              f'reach={sol["reach"] * 1000:.2f}mm table={sol["table"]:.3f} jack={sol["jack"]:.3f} '
              f'sight={sol["sight"]:.2f} rot={sol["rot"]} u_w={tuple(round(x, 2) for x in (Rw @ sol["u"]))} '
              f'pinch_axis_w={tuple(round(x, 2) for x in sol["pinch_axis_w"])} pole={tuple(round(x, 2) for x in sol["pole"])} '
              f'shoulder={sol["shoulder"]} fingers={sol["fingers"]} looks={len(looks)}', flush=True)
    return sol


def place_hand(rig, frame, sol, anchor_world, interp='LINEAR'):
    """Key the left arm so the index pad (index_pad) lands on `anchor_world` with the solved
    hand orientation, elbow pole and shoulder (only the arm re-solved: the hand never wobbles)."""
    hd = rig.hands['L']
    W0 = rig.arm.data.bones['hand_L'].head_local
    Rt = S.frame3(sol['u'], sol['w']) @ S.frame3(hd['u'], hd['w']).transposed()
    ip, _ = index_pad(rig)
    off = Rt @ (ip - W0)
    Dc = rig._chest_delta(frame)
    rig.place_arm(frame, 'L', Dc @ anchor_world - off, sol['u'], sol['w'], sol['pole'], interp,
                  shoulder=sol['shoulder'])


def _mesh_world(objs, dg):
    vs, ps = [], []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        k = len(vs)
        vs += [ev.matrix_world @ v.co for v in me.vertices]
        ps += [tuple(i + k for i in p.vertices) for p in me.polygons]
        ev.to_mesh_clear()
    return vs, ps


def _bvh(objs, dg):
    from mathutils.bvhtree import BVHTree
    vs, ps = _mesh_world(objs, dg)
    return BVHTree.FromPolygons(vs, ps)


HAND_BONES = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]
ARM_BONES = ['forearm_L'] + HAND_BONES
PADS = (('index', 'index_3_L'), ('thumb', 'thumb_2_L'))


def jack_meshes(room):
    return [o for o in room.jack.root.children_recursive if o.type == 'MESH']


def _walnut_tree(room):
    """BVH of the walnut near the head edge (static: built once)."""
    if getattr(room, '_s10_walnut', None) is None:
        from mathutils.bvhtree import BVHTree
        dg = bpy.context.evaluated_depsgraph_get()
        vs, ps = _mesh_world(R.walnut_objects(room), dg)
        keep = [p for p in ps if all(vs[i].y > -0.6 and abs(vs[i].x) < 0.9 for i in p)]
        room._s10_walnut = BVHTree.FromPolygons(vs, keep)
    return room._s10_walnut


def hand_overlaps(rig, room, frame, cord=False, walnut=False):
    """Triangle pairs where his left hand meets the jack and the socket (and, as further
    numbers, the master cord; his forearm and hand against the walnut)."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    hand = _bvh([o for o in rig.parts_on_bones(HAND_BONES) if o.type == 'MESH'], dg)
    hard = jack_meshes(room) + [o for o in room.socket.children_recursive if o.type == 'MESH']
    out = [len(hand.overlap(_bvh(hard, dg)))]
    if cord:
        out.append(len(hand.overlap(_bvh([room.master.obj], dg))))
    if walnut:
        arm = _bvh([o for o in rig.parts_on_bones(ARM_BONES) if o.type == 'MESH'], dg)
        out.append(len(arm.overlap(_walnut_tree(room))))
    return out if len(out) > 1 else out[0]


def pad_contacts(rig, room, frame):
    """{'index'|'thumb': (distance m, contact point on the knurl (world), overlapping pairs)}: how
    far each pad's real surface (the index_3_L / thumb_2_L meshes) is from the gold barrel at
    `frame`, measured from the barrel's dense knurl vertices onto the pad (BVH nearest)."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    barrel = [o for o in jack_meshes(room) if o.name.endswith('_barrel')]
    bv, bp = _mesh_world(barrel, dg)
    from mathutils.bvhtree import BVHTree
    btree = BVHTree.FromPolygons(bv, bp)
    out = {}
    for key, bone in PADS:
        parts = [o for o in rig.parts_on_bones([bone]) if o.type == 'MESH']
        pv, pp = _mesh_world(parts, dg)
        ptree = BVHTree.FromPolygons(pv, pp)
        best = (1e9, None)
        for v in bv:
            hit = ptree.find_nearest(v, 0.02)
            if hit[0] is not None and hit[3] < best[0]:
                best = (hit[3], v.copy())
        for v in pv:                                   # both ways (the pad's own vertices)
            hit = btree.find_nearest(v, 0.02)
            if hit[0] is not None and hit[3] < best[0]:
                best = (hit[3], hit[0].copy())
        out[key] = (best[0], best[1], len(ptree.overlap(btree)))
    return out


def part_overlaps(rig, room, frame):
    """Which of his arm's parts overlap the jack, the socket, the cord and the walnut at
    `frame` (triangle pairs per part), as a printable string."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    targets = {'jack': _bvh(jack_meshes(room), dg),
               'socket': _bvh([o for o in room.socket.children_recursive if o.type == 'MESH'], dg),
               'cord': _bvh([room.master.obj], dg), 'walnut': _walnut_tree(room)}
    out = []
    for o in rig.parts_on_bones(ARM_BONES):
        if o.type != 'MESH':
            continue
        t = _bvh([o], dg)
        hits = {k: len(t.overlap(v)) for k, v in targets.items()}
        hits = {k: v for k, v in hits.items() if v}
        if hits:
            pb = o.parent_bone if o.parent is rig.arm else (o.parent.parent_bone if o.parent else '')
            out.append(f'{o.name}[{pb}] {hits}')
    return '; '.join(out) or 'none'


def calibrate_pinch(rig, room, sol, M0):
    """Close the pinch onto the real pads: the hand is moved along the pinch axis until the index
    pad's surface touches the knurl, and the thumb's gap shrunk until the thumb pad does
    (PAD_TARGET), measured on the meshes (pad_contacts). rig.thumb_pinch's pad model leaves
    several millimetres of air at its nominal gap. Sets sol['anchor_w'], sol['gap'] and the
    module's GAP; sol['pinch_w'] / sol['axis_w'] become the midpoint of and the line through the
    two contacts (the jack's sway pivots about it, so the pads stay on the knurl)."""
    global GAP
    t0 = time.time()
    a = sol['pinch_axis_w']
    base = sol['anchor_w'].copy()
    log = []

    def measure(s_, g_):
        sol['anchor_w'] = base + a * s_
        place_hand(rig, F_GRIP, sol, sol['anchor_w'])
        key_thumb(rig, F_GRIP, g_, 'LINEAR')
        r_ = pad_contacts(rig, room, F_GRIP)
        di_ = -1.0 if r_['index'][2] else r_['index'][0]       # overlapping: into the knurl
        dt_ = -1.0 if r_['thumb'][2] else r_['thumb'][0]
        log.append(f'shift {s_ * 1000:+.2f} gap {g_ * 1000:.2f}: index {di_ * 1000:.2f} thumb {dt_ * 1000:.2f}')
        return di_, dt_, r_
    # the index: the hand slides along the pinch axis (secant steps while clear, bisection once
    # a step goes in), then the thumb's gap the same way, then once more for the index
    s, g = 0.0, GAP
    res = None
    for _round in range(2):
        lo_s, hi_s = None, None                   # shifts known clear (lo) / into (hi)
        for it in range(8):
            di, dt, res = measure(s, g)
            if di < 0:
                hi_s = s
            else:
                lo_s = s
                if abs(di - PAD_TARGET) < 3e-5:
                    break
            if hi_s is None:
                s = s + (di - PAD_TARGET)
            elif lo_s is None:
                s = hi_s - 0.0003
            else:
                s = 0.5 * (lo_s + hi_s) if di < 0 or (hi_s - lo_s) < 2 * (di - PAD_TARGET) else s + (di - PAD_TARGET)
        s = lo_s if lo_s is not None else s
        lo_g, hi_g = None, None                   # gaps known into (lo) / clear (hi)
        for it in range(8):
            di, dt, res = measure(s, g)
            if dt < 0:
                lo_g = g
            else:
                hi_g = g
                if abs(dt - PAD_TARGET) < 3e-5:
                    break
            if lo_g is None:
                g = max(0.0, g - (dt - PAD_TARGET))
            elif hi_g is None:
                g = lo_g + 0.0003
            else:
                g = 0.5 * (lo_g + hi_g) if dt < 0 or (hi_g - lo_g) < 2 * (dt - PAD_TARGET) else g - (dt - PAD_TARGET)
        g = hi_g if hi_g is not None else g
    di, dt, res = measure(s, g)
    GAP = g
    sol['gap'] = g
    sol['shift'] = s
    ci, ct = res['index'][1], res['thumb'][1]
    sol['contacts_w'] = (ci, ct)
    sol['pinch_w'] = (ci + ct) * 0.5
    ax = (ct - ci).normalized()
    # orient the sway axis so a positive angle lifts the jack's tail (jack_matrix, swing_deg)
    tail = M0 @ Vector((0.0, 0.046, 0.0))
    if ax.cross(tail - sol['pinch_w']).z < 0:
        ax = -ax
    sol['axis_w'] = ax
    if DEBUG:
        print('S10 PINCH ' + ' | '.join(log) + f'  ({time.time() - t0:.1f}s)', flush=True)
        print('S10 PINCH parts at the grip: ' + part_overlaps(rig, room, F_GRIP), flush=True)
        print(f'S10 PINCH contacts {tuple(round(x, 4) for x in ci)} {tuple(round(x, 4) for x in ct)} '
              f'axis {tuple(round(x, 2) for x in ax)} (pad gap model {sol["pin"]["pad_gap"] * 1000:.2f} mm, '
              f'err {sol["pin"]["err"]:.4f})', flush=True)
    return sol


def open_states(rig, room, sol):
    """The most open thumb gap (up to GAP_OPEN), index and middle curls that touch nothing at
    the grip position, open and half-way closed: they are what the hand holds while it arrives
    and as each finger closes in turn (f936-941), so they must be clear there. Sets
    sol['thumb_open'] and DESC_FINGERS['index'] / ['middle']."""
    k = 'LINEAR'
    place_hand(rig, F_GRIP, sol, sol['anchor_w'])

    def grip_all():
        for nm, ang in GRIP_FINGERS.items():
            key_fingers(rig, F_GRIP, nm, ang, k)

    def clear():
        return not sum(hand_overlaps(rig, room, F_GRIP, cord=True, walnut=True))

    def blend(a, b, t):
        return tuple(x + (y - x) * t for x, y in zip(a, b))
    grip_all()
    best_g = GAP + 0.003
    for g in (GAP_OPEN, 0.030, 0.025, 0.021, 0.018, 0.015, 0.0125):
        key_thumb(rig, F_GRIP, g, k)
        if clear():
            best_g = g
            break
    key_thumb(rig, F_GRIP, best_g, k)
    chosen = {}
    for nm in ('index', 'middle'):
        G_, O_ = GRIP_FINGERS[nm], OPEN_FINGERS[nm]
        cands = [blend(G_, O_, t) for t in (1.0, 0.8, 0.6, 0.45, 0.3, 0.2)]
        cands += [(G_[0], G_[1] * 0.7, G_[2] * 0.6), (G_[0] * 0.75, G_[1], G_[2]), (G_[0] * 0.8, G_[1] * 0.85, G_[2] * 0.8),
                  (G_[0], G_[1] * 0.85, G_[2] * 0.8)]
        if nm == 'middle':
            cands += [(G_[0] - 8.0, G_[1], G_[2]), (G_[0] - 14.0, G_[1], G_[2]), (G_[0] - 8.0, G_[1] - 15.0, G_[2] - 10.0),
                      (G_[0] + 4.0, G_[1] - 25.0, G_[2] - 20.0), (G_[0], G_[1] - 20.0, G_[2] - 15.0)]
        chosen[nm] = G_
        tried = []
        for c in cands:
            ok = True
            for st in (c, blend(c, G_, 0.5)):
                key_fingers(rig, F_GRIP, nm, st, k)
                hits = hand_overlaps(rig, room, F_GRIP, cord=True, walnut=True)
                if sum(hits):
                    ok = False
                    tried.append(f'{tuple(round(a) for a in st)}:{hits}')
                    break
            if ok:
                chosen[nm] = c
                break
        if DEBUG and chosen[nm] == G_:
            print(f'S10 OPEN {nm}: nothing clear: ' + ' '.join(tried), flush=True)
        # each finger closes with the ones before it already closed (index f937, middle f939)
        key_fingers(rig, F_GRIP, nm, G_, k)
    sol['thumb_open'] = best_g
    DESC_FINGERS['index'] = chosen['index']
    DESC_FINGERS['middle'] = chosen['middle']
    grip_all()
    key_thumb(rig, F_GRIP, GAP, k)
    if DEBUG:
        print(f'S10 OPEN thumb {best_g * 1000:.1f} mm, index {tuple(round(a) for a in chosen["index"])}, '
              f'middle {tuple(round(a) for a in chosen["middle"])}', flush=True)
    return best_g, chosen


def finger_clearance(rig, room, sol, clear_m=0.0005):
    """The three free fingers' grip curl eased (at the knuckle hub, a degree at a time, either way)
    until each stays `clear_m` off the jack and the socket at the grip: the pull and the sway
    move the jack a fraction of a millimetre against the hand. Updates GRIP_FINGERS."""
    from mathutils.bvhtree import BVHTree
    k = 'LINEAR'
    sc = bpy.context.scene

    def dist(nm):
        sc.frame_set(F_GRIP)
        dg = bpy.context.evaluated_depsgraph_get()
        hard = _bvh(jack_meshes(room) + [o for o in room.socket.children_recursive if o.type == 'MESH'], dg)
        parts = [o for o in rig.parts_on_bones([f'{nm}_{i}_L' for i in (1, 2, 3)]) if o.type == 'MESH']
        vs, ps = _mesh_world(parts, dg)
        tree = BVHTree.FromPolygons(vs, ps)
        if tree.overlap(hard):
            return -1.0
        d = 1.0
        for v in vs:
            h = hard.find_nearest(v, 0.01)
            if h[0] is not None:
                d = min(d, h[3])
        return d
    log = []
    for nm in ('middle', 'ring', 'pinky'):
        ang = tuple(GRIP_FINGERS[nm])
        d0 = dist(nm)
        best = (d0, ang)
        if d0 < clear_m:
            for step in range(1, 9):
                for sgn in (-1.0, 1.0):
                    a = (ang[0] + sgn * step, ang[1], ang[2])
                    key_fingers(rig, F_GRIP, nm, a, k)
                    d = dist(nm)
                    if d > best[0]:
                        best = (d, a)
                if best[0] >= clear_m:
                    break
        GRIP_FINGERS[nm] = best[1]
        key_fingers(rig, F_GRIP, nm, best[1], k)
        log.append(f'{nm} {d0 * 1000:.2f} -> {best[0] * 1000:.2f} mm ({best[1][0] - ang[0]:+.0f} deg)')
    if DEBUG:
        print('S10 CLEAR ' + ', '.join(log), flush=True)


def knuckle_flex(rig, room, sol):
    """The resolve (f953): which knuckle hub flexes 1 degree. The first of the ring's, the
    pinky's and the middle's (closing, then opening) that touches nothing."""
    k = 'LINEAR'
    for nm, d in (('ring', 1.0), ('pinky', 1.0), ('middle', 1.0), ('middle', -1.0), ('ring', -1.0)):
        ang = GRIP_FINGERS[nm]
        key_fingers(rig, F_KNUCKLE, nm, (ang[0] + d, ang[1], ang[2]), k)
        n = sum(hand_overlaps(rig, room, F_KNUCKLE, cord=True, walnut=True))
        key_fingers(rig, F_KNUCKLE, nm, ang, k)
        if not n:
            if DEBUG:
                print(f'S10 KNUCKLE {nm} {d:+.0f} deg', flush=True)
            return nm, d
    return 'middle', -1.0


def calibrate_pull(rig, room, sol, M0):
    """After the pull the arm's IK lands the hand a fraction of a millimetre differently on the
    moved jack: re-measure the pads at F_OUT and return (anchor correction in the jack's local
    space, thumb gap) that keep both on the knurl (PAD_TARGET) through the held beat."""
    a_l = (M0.to_3x3().inverted() @ sol['pinch_axis_w']).normalized()
    anchor_local = M0.inverted() @ sol['anchor_w']
    M_out = pull_matrix(M0, F_OUT)
    jr = room.jack.root
    jr.rotation_mode = 'QUATERNION'
    jr.matrix_world = M_out                      # (key_jack keys every frame afterwards)
    jr.keyframe_insert('location', frame=F_OUT)
    jr.keyframe_insert('rotation_quaternion', frame=F_OUT)
    s, g = 0.0, GAP
    log = []
    for it in range(6):
        place_hand(rig, F_OUT, sol, M_out @ (anchor_local + a_l * s), 'LINEAR')
        key_thumb(rig, F_OUT, g, 'LINEAR')
        res = pad_contacts(rig, room, F_OUT)
        di = -0.0002 if res['index'][2] else res['index'][0]
        dt = -0.0002 if res['thumb'][2] else res['thumb'][0]
        log.append(f'{s * 1000:+.2f}/{g * 1000:.2f}: {di * 1000:.2f} {dt * 1000:.2f}')
        if 0.0 <= di <= 0.0002 and 0.0 <= dt <= 0.0002:
            break
        s += (di - PAD_TARGET) if di >= 0 else 0.00015
        g -= (dt - PAD_TARGET) if dt >= 0 else -0.00015
    if DEBUG:
        print('S10 PULL pads ' + ' | '.join(log), flush=True)
    return a_l * s, g


def fit_swing(rig, room, sol, M0):
    """The sway's range in the pinch: the angles about the pad-contact axis through which the jack
    stays clear of his other fingers (tested in 1 degree steps at F_OUT); the first lobe carries the
    pull's momentum up as far as that allows, then it hangs, tail down under the coil's weight."""
    jr = room.jack.root
    piv_l = M0.inverted() @ sol['pinch_w']
    ax_l = (M0.to_3x3().inverted() @ sol['axis_w']).normalized()
    sc = bpy.context.scene
    M_out = pull_matrix(M0, F_OUT)
    piv = M_out @ piv_l
    ax = (M_out.to_3x3() @ ax_l).normalized()
    jr.rotation_mode = 'QUATERNION'

    def clear(deg):
        Rr = Matrix.Rotation(math.radians(deg), 4, ax)
        jr.matrix_world = Matrix.Translation(piv) @ Rr @ Matrix.Translation(-piv) @ M_out
        jr.keyframe_insert('location', frame=F_OUT)
        jr.keyframe_insert('rotation_quaternion', frame=F_OUT)
        return hand_overlaps(rig, room, F_OUT, cord=False) == 0
    up = 0
    for d in range(1, 16):
        if not clear(d):
            break
        up = d
    down = 0
    for d in range(1, 16):
        if not clear(-d):
            break
        down = d
    clear(0.0)
    jr.animation_data_clear()
    jr.matrix_world = M0
    # the first lobe reaches about `up` (less a degree), the rest sits two thirds into `down`, and
    # the whole sway stays half a degree inside the clear range
    rest = -min(7.0, 0.65 * down)
    sw = dict(SWING, rest=rest)

    def curve(amp):
        sw['amp'] = amp
        old = dict(SWING)
        SWING.update(sw)
        v = [swing_deg(F_OUT + t) for t in range(0, 40)]
        SWING.update(old)
        return min(v), max(v)
    amp = 12.0
    while amp > 0.5:
        lo, hi = curve(amp)
        if hi <= max(0.0, up - 0.5) and lo >= -max(0.0, down - 0.5):
            break
        amp -= 0.5
    if DEBUG:
        print(f'S10 SWING clear {-down} .. +{up} deg: rest {rest:.1f}, amp {amp:.1f}', flush=True)
    return dict(rest=rest, amp=amp)


def ready_offset(rig, room, sol, jax, approach):
    """Where the open hand stops beside the knurl before the fingers close: the smallest
    offset (square to the jack, toward one side of the pinch, or back toward him) for which the
    whole descent with the fingers open, and the settle onto the pinch as the index closes,
    touch neither the jack, the socket, the cord nor the walnut. `approach(offset)` keys the
    descent and the settle."""
    ax = sol['pinch_axis_w']
    side = jax.cross(ax).normalized()
    best = None
    checks = list(range(F_INDEX + 1, F_DESC0 - 1, -1))
    lat = Vector((-1.0, 0.0, 0.0))
    back = Vector((0.0, 1.0, 0.0))
    dirs = [-ax, (-ax + back).normalized(), side, -side, lat, (lat + back).normalized(), back, ax]
    for mag in (0.0, 0.008, 0.016, 0.024, 0.032, 0.040, 0.050, 0.060):
        for d in dirs:
            off = d * mag
            approach(off)
            n = 0
            for f in checks:
                hits = hand_overlaps(rig, room, f, cord=True, walnut=True)
                n += sum(hits)
                if n:
                    if DEBUG:
                        print(f'S10 READY try {tuple(round(x * 1000) for x in off)} mm: f{f} {hits}', flush=True)
                    break
            if n == 0:
                best = off
                break
            if mag == 0.0:
                break
        if best is not None:
            break
    if best is None:
        print('S10 WARNING: no clear approach found; coming in from his side of the jack', flush=True)
        best = Vector((-0.05, 0.03, 0.0))
    approach(best)
    if DEBUG:
        print(f'S10 READY offset {tuple(round(x * 1000, 1) for x in best)} mm', flush=True)
    return best


def key_fingers(rig, frame, name, angles, interp='BEZIER'):
    for i, a in enumerate(angles):
        rig.pose(frame, interp, **{f'{name}_{i + 1}_L': float(a)})


def key_thumb(rig, frame, gap, interp='BEZIER'):
    for i, Rm in enumerate(thumb_rots(rig, gap)['rot']):
        rig.key_rest_rot(f'thumb_{i}_L', frame, Rm, interp)


# ------------------------------------------------------------------ the solve cache

def _cache_key(cam, M0):
    h = hashlib.sha1()
    for fn in (os.path.abspath(__file__), os.path.join(os.path.dirname(HERE), 'lib', 'synergy.py'),
               os.path.join(os.path.dirname(HERE), 'lib', 'props.py'),
               os.path.join(os.path.dirname(HERE), 'lib', 'env_room.py')):
        with open(fn, 'rb') as fh:
            h.update(fh.read())
    h.update(repr([round(x, 6) for row in cam.matrix_world for x in row]).encode())
    h.update(repr([round(x, 6) for row in M0 for x in row]).encode())
    h.update(repr(sorted((k, v) for k, v in os.environ.items()
                         if k.startswith('S10_') and k not in ('S10_DEBUG', 'S10_REPORT', 'S10_NOCACHE'))).encode())
    return h.hexdigest()[:16]


def _vec(x):
    return Vector(x) if x is not None else None


def load_solution(key):
    if os.environ.get('S10_NOCACHE'):
        return None
    path = os.path.join(CACHE, f's10_grip_{key}.json')
    try:
        with open(path) as fh:
            d = json.load(fh)
    except (OSError, ValueError):
        return None
    sol = {k: (_vec(v) if isinstance(v, list) and len(v) == 3 and k not in ('rot', 'shoulder') else v)
           for k, v in d.items() if k != 'contacts_w'}
    sol['contacts_w'] = tuple(Vector(c) for c in d['contacts_w'])
    sol['rot'] = tuple(d['rot'])
    sol['shoulder'] = tuple(d['shoulder'])
    return sol


def save_solution(key, sol):
    keep = ('u', 'w', 'pole', 'shoulder', 'rot', 'pinch_axis_w', 'anchor_w', 'grip_w', 'pinch_w', 'axis_w', 'gap',
            'shift', 'ready', 'score', 'sight', 'fingers', 'thumb_open', 'desc_middle', 'desc_index', 'knuckle', 'pull_shift',
            'pull_gap', 'swing', 'gap_held', 'grip_fingers')
    d = {k: (list(sol[k]) if isinstance(sol[k], (Vector, tuple)) else sol[k]) for k in keep if k in sol}
    d['contacts_w'] = [list(c) for c in sol['contacts_w']]
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f's10_grip_{key}.json')
    tmp = f'{path}.{os.getpid()}.tmp'
    with open(tmp, 'w') as fh:
        json.dump(d, fh)
    os.replace(tmp, path)


# ------------------------------------------------------------------ the left hand

def left_hand(rig, room, cam, M0, jax):
    """The whole left-hand performance (S10, and S11's start state). Returns the grip solution:
    'pinch_w' / 'axis_w' are the sway's pivot and axis (the pad contacts), 'gap' the thumb's."""
    global GAP
    sc = bpy.context.scene
    sp = Vector(R.SYNERGY_POS)
    k = 'BEZIER'
    route_master_cord(room)
    # S09's end: the canon idle (cup at the chest, head level with the canon roll), the left
    # index on the walnut at the padlock; then the lean comes in, keyed every frame with the
    # cup re-held exactly where it was (each frame starts from the previous one's pose)
    rig.apply_preset(F_PREROLL, 'idle_cup', k)
    rig.pose(F_PREROLL, k, root_loc=tuple(sp), root_rot=0.0)
    rig.reach_L(F_PREROLL, interp=k)
    for f in range(F_DESC0, F_LEAN + 1):
        t = (f - F_DESC0) / float(F_LEAN - F_DESC0)
        rig.lean(f, LEAN_DEG * ease(t), 'LINEAR', keep_cup=True)
    key = _cache_key(cam, M0)
    sol = load_solution(key)
    cached = sol is not None
    if cached:
        GAP = sol['gap']                          # the bite's gap (the held one is set after the pull)
        GRIP_FINGERS.update(FINGER_SETS[sol.get('fingers', 'grip')])
        sol['pin'] = thumb_rots(rig, GAP)
        if DEBUG:
            print(f'S10 GRIP from cache {key}: rot {sol["rot"]} fingers {sol.get("fingers")} gap {GAP * 1000:.2f} mm',
                  flush=True)
    else:
        sol = solve_grip(rig, room, cam, F_GRIP, M0, jax)
    # the grip's finger curl at the bite (calibrate_pinch measures the pads in it)
    for nm, ang in GRIP_FINGERS.items():
        key_fingers(rig, F_GRIP, nm, ang, k)
    if not cached:
        calibrate_pinch(rig, room, sol, M0)
        finger_clearance(rig, room, sol)
        sol['grip_fingers'] = {nm: list(a) for nm, a in GRIP_FINGERS.items()}
    else:
        GRIP_FINGERS.update({nm: tuple(a) for nm, a in sol.get('grip_fingers', {}).items()})
        for nm, ang in GRIP_FINGERS.items():
            key_fingers(rig, F_GRIP, nm, ang, k)
    # on the way down: index out, middle part closed, ring and pinky already at their grip curl,
    # the thumb open: as open as is clear at the grip (open_states)
    DESC_FINGERS.update(ring=GRIP_FINGERS['ring'], pinky=GRIP_FINGERS['pinky'])
    if cached and 'thumb_open' in sol:
        DESC_FINGERS['middle'] = tuple(sol['desc_middle'])
        DESC_FINGERS['index'] = tuple(sol['desc_index'])
    else:
        open_states(rig, room, sol)
        sol['desc_middle'] = DESC_FINGERS['middle']
        sol['desc_index'] = DESC_FINGERS['index']
    t_open = sol['thumb_open']
    anchor_local = M0.inverted() @ sol['anchor_w']
    up = Vector((0.0, 0.0, 1.0))
    for nm, ang in DESC_FINGERS.items():
        key_fingers(rig, F_DESC0, nm, ang, 'LINEAR')
        key_fingers(rig, F_LAND, nm, ang, 'BEZIER')
    key_thumb(rig, F_DESC0, t_open, 'LINEAR')
    for f in range(F_INDEX + 1, F_PULL):
        place_hand(rig, f, sol, sol['anchor_w'], 'LINEAR')

    # one finger at a time: index, middle, thumb (each close straddles its servo frame)
    key_fingers(rig, F_INDEX - 1, 'index', DESC_FINGERS['index'])
    key_fingers(rig, F_INDEX + 1, 'index', GRIP_FINGERS['index'])
    key_fingers(rig, F_MIDDLE - 1, 'middle', DESC_FINGERS['middle'])
    key_fingers(rig, F_MIDDLE + 1, 'middle', GRIP_FINGERS['middle'])
    for nm in ('ring', 'pinky'):
        key_fingers(rig, F_MIDDLE - 1, nm, DESC_FINGERS[nm])
        key_fingers(rig, F_MIDDLE + 2, nm, GRIP_FINGERS[nm])
    # the thumb: lands just off the knurl, then bites (the grip click)
    key_thumb(rig, F_THUMB - 1, t_open, k)
    key_thumb(rig, F_THUMB + 1, GAP + PAD_LAND, k)
    key_thumb(rig, F_GRIP - 1, GAP + PAD_LAND, k)
    key_thumb(rig, F_GRIP, GAP, k)
    # resolve: one knuckle hub flexes 1 degree (the first of these that stays clear of the jack)
    if cached and 'knuckle' in sol:
        kn_name, kn_d = sol['knuckle'][0], float(sol['knuckle'][1])
    else:
        kn_name, kn_d = knuckle_flex(rig, room, sol)
        sol['knuckle'] = (kn_name, kn_d)
    ang = GRIP_FINGERS[kn_name]
    key_fingers(rig, F_KNUCKLE - 1, kn_name, ang, k)
    key_fingers(rig, F_KNUCKLE, kn_name, (ang[0] + kn_d, ang[1], ang[2]), k)
    def approach(ready):
        # straight down from above the frame to the ready point beside the knurl (eased in and
        # out), then across onto it as the index closes
        for f in range(F_DESC0, F_READY + 1):
            t = (f - F_DESC0) / float(F_READY - F_DESC0)
            place_hand(rig, f, sol, sol['anchor_w'] + ready + up * (DESC_H * (1.0 - ease(t))), 'LINEAR')
        for f in range(F_READY + 1, F_INDEX + 1):
            t = (f - F_READY) / float(F_INDEX + 1 - F_READY)
            place_hand(rig, f, sol, sol['anchor_w'] + ready * (1.0 - ease(t)), 'LINEAR')
    if cached and 'ready' in sol:
        ready = Vector(sol['ready'])
        approach(ready)
    else:
        ready = ready_offset(rig, room, sol, jax, approach)
        sol['ready'] = ready
    # the pull: the hand and the jack as one, then the hand holds still
    if cached and 'pull_shift' in sol:
        pull_shift, pull_gap = Vector(sol['pull_shift']), sol['pull_gap']
    else:
        pull_shift, pull_gap = calibrate_pull(rig, room, sol, M0)
        sol['pull_shift'], sol['pull_gap'] = pull_shift, pull_gap
    for f in range(F_PULL - 1, END + 3):
        place_hand(rig, f, sol, pull_matrix(M0, min(f, F_OUT)) @ (anchor_local + pull_shift * min(1.0, max(0.0, (f - F_PULL + 1) / 2.0))),
                   'LINEAR')
    key_thumb(rig, F_PULL - 1, GAP, 'LINEAR')
    key_thumb(rig, F_PULL + 1, pull_gap, 'LINEAR')
    GAP = pull_gap
    sol['gap_held'] = pull_gap
    if not (cached and 'swing' in sol):
        sol['swing'] = fit_swing(rig, room, sol, M0)
    SWING.update(sol['swing'])
    rig.bake_pauldrons(F_PREROLL, END + 2)
    if not cached:
        save_solution(key, sol)
    sc.frame_set(START)
    return sol


def handover(rig, room):
    """S11's start state: this shot's left hand, the jack and the master cord, keyed exactly as
    S10 keys them (its own camera is built for the solve and removed). Returns the solution."""
    cam10, _ = build_camera(room)
    M0, jax = jack_seat(room)
    sol = left_hand(rig, room, cam10, M0, jax)
    key_jack(room, M0, M0.inverted() @ sol['pinch_w'], (M0.to_3x3().inverted() @ sol['axis_w']).normalized())
    room.master.pulled(F_PULL)
    cord_follow(room, M0, sol)
    bpy.data.objects.remove(cam10)
    return sol


# ------------------------------------------------------------------ camera

# The lens looks back along the master cord toward the hub from beyond the head edge: azimuth
# from the jack's axis (+Y, toward him) round toward +X, elevation, distance from the knurl. The
# hub-to-socket line is at 36 deg; the lens sits 6 mm above the walnut's plane, so the walnut top
# reads as a thin glossy band at the horizon with the cord's run and the hub on it.
CAM = dict(az=44.0, el=7.5, dist=0.48, lens=100.0, fstop=5.6, shift_x=-0.12, shift_y=0.185)
for _k in ('az', 'el', 'dist', 'fstop', 'shift_x', 'shift_y'):
    if os.environ.get(f'S10_CAM_{_k.upper()}'):
        CAM[_k] = float(os.environ[f'S10_CAM_{_k.upper()}'])


def knurl_point(room):
    M0, jax = jack_seat(room)
    return M0.translation + jax * 0.0122


def build_camera(room):
    """(camera, focus empty): env_room's approved 's10_jack_macro' set-up (kit, hidden far walls,
    locked off) placed by CAM round the knurl; focus on the knurl."""
    f0, cam = R.preview_camera(room, 's10_jack_macro')
    foc = cam.data.dof.focus_object
    bpy.context.view_layer.update()
    kn = knurl_point(room)
    a, e = math.radians(CAM['az']), math.radians(CAM['el'])
    d = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = kn + d * CAM['dist']
    C.look_at(cam, kn)
    cam.data.lens = CAM['lens']
    cam.data.shift_x = CAM['shift_x']
    cam.data.shift_y = CAM['shift_y']
    cam.data.dof.aperture_fstop = CAM['fstop']
    if foc is not None:
        foc.location = kn
    bpy.context.view_layer.update()
    return cam, foc


def key_focus(cam, foc, M0, jax, sol):
    """Slow focus breathe as the fingers enter (the plane drifts 5 mm toward the lens and back),
    then after the pull a late follow-focus onto the jack in his fingers."""
    rest = foc.location.copy()
    cam_p = cam.matrix_world.translation
    toward = (cam_p - rest).normalized()
    after = pull_matrix(M0, F_OUT) @ (M0.inverted() @ rest)
    fwd = (cam.matrix_world.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
    d_rest = (rest - cam_p).dot(fwd)
    d_after = (after - cam_p).dot(fwd)
    keys = [(START, 0.0), (933, 0.0035), (938, 0.0050), (946, 0.0), (F_PULL + 2, 0.0), (F_PULL + 9, d_rest - d_after)]
    for f, d in keys:
        foc.location = rest + (toward * d if f <= F_PULL else fwd * -d)
        foc.keyframe_insert('location', frame=f)


# ------------------------------------------------------------------ the colour glow behind

# Room.front_bokeh lays its discs round his head for a lens that faces him. This lens looks
# down-table past the hub: only the top of the frame sees beyond the walnut's horizon, the black
# hub fills its middle, and Synthia's own ivory screen glows in the top-left corner. The discs are
# re-laid where the lens sees past the hub and his hand (place_bokeh ray-tests every frame), each
# the size a distant screen's glow takes at 100 mm f/5.6 focused at half a metre, and they are
# also seen by glossy rays, so the gold barrel and the brass nut carry the colleagues' colours.
BOKEH_ORDER = ('keys', 'people', 'kevin', 'arjun', 'operations')
BOKEH_SIZE = 0.060               # disc diameter as a fraction of the frame width (with its defocus)
BOKEH_DIST = (1.3, 3.2)          # nearest (just beyond the hub) and preferred distance from the lens
BOKEH_N = 2


def place_bokeh(room, cam, rig):
    """Re-lay the front_bokeh discs (their material and screen-state drivers kept): candidate
    image points on a grid, each ray-cast (centre and four rim points) on every second frame; a
    point qualifies when its whole disc is inside the frame and the lens sees at least
    BOKEH_DIST[0] past it from the hand's arrival (F_LAND) to the end. Up to BOKEH_N discs are
    placed from the top-left, spaced so they overlap a little at most, preferring points also
    clear while the hand comes down. Discs not placed are hidden. Returns {name: (u, v, D)}."""
    sc = bpy.context.scene
    discs = list(getattr(room, 'bokeh', []))
    for o in discs:
        o.hide_render = True
        o.hide_viewport = True
    bpy.context.view_layer.update()
    mw = cam.matrix_world
    loc, rot = mw.translation.copy(), mw.to_3x3()
    cd = cam.data
    res_x = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
    res_y = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
    sw, lens = cd.sensor_width, cd.lens
    sh = sw * res_y / res_x
    aspect = res_y / res_x

    def ray_dir(u, v):
        dirc = Vector(((u - 0.5 + cd.shift_x) * sw / lens, (v - 0.5) * sh / lens + cd.shift_y * sw / lens, -1.0))
        return (rot @ dirc).normalized()
    r_img = BOKEH_SIZE / 2.0                      # disc radius in u units
    grid = [(round(u, 3), round(v, 3)) for u in np.arange(r_img + 0.01, 1.0 - r_img, 0.02)
            for v in np.arange(0.55, 1.0 - r_img / aspect - 0.01, 0.02)]
    frames = sorted(set(list(range(START, END + 1, 2)) + [END, F_LAND]))
    offs = [(0.0, 0.0), (0.6, 0.0), (-0.6, 0.0), (0.0, 0.6), (0.0, -0.6)]
    free = {g: np.zeros(len(frames), bool) for g in grid}
    depth = {g: 50.0 for g in grid}
    for fi, f in enumerate(frames):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for g in grid:
            if fi and not free[g][:fi].any() and f > F_LAND:
                continue
            ok = True
            for ou, ov in offs:
                u, v = g[0] + ou * r_img, g[1] + ov * r_img / aspect
                hit, hp, *_ = sc.ray_cast(dg, loc, ray_dir(u, v), distance=50.0)
                d = (hp - loc).length if hit else 50.0
                depth[g] = min(depth[g], d)
                if d < BOKEH_DIST[0]:
                    ok = False
                    break
            free[g][fi] = ok
    late = np.array([f >= F_LAND for f in frames])
    cands = [g for g in grid if free[g][late].all()]
    by_name = {o.get('bokeh_terminal'): o for o in discs}
    placed = {}
    for nm in BOKEH_ORDER:
        if len(placed) >= BOKEH_N:
            break
        o = by_name.get(nm)
        if o is None:
            continue
        ok = [g for g in cands if all(math.hypot(g[0] - p[0], (g[1] - p[1]) * aspect) > 1.5 * r_img
                                      for p in placed.values())]
        if not ok:
            break
        u, v = min(ok, key=lambda g: (-int(free[g].sum()), g[0] * 0.8 - g[1]))
        placed[nm] = (u, v, min(BOKEH_DIST[1], depth[(u, v)] - 0.15))
    fs = cd.dof.aperture_fstop
    Fd = (cd.dof.focus_object.matrix_world.translation - loc).length if cd.dof.focus_object else cd.dof.focus_distance
    f_px = lens / sw * res_x
    for nm, (u, v, D) in placed.items():
        o = by_name[nm]
        dw = ray_dir(u, v)
        fl = lens / 1000.0
        blur = (fl * fl / (fs * max(Fd - fl, 1e-3))) * abs(D - Fd) / D / (sw / 1000.0) * res_x
        target = BOKEH_SIZE * res_x
        g_px = max(target - 0.8 * blur, 0.35 * target)
        diam = g_px / f_px * D
        r0 = max(v_.co.length for v_ in o.data.vertices)
        o.scale = (diam / (2.0 * r0),) * 3
        o.location = loc + dw * D
        o.rotation_euler = (-dw).to_track_quat('Z', 'Y').to_euler()
        o.hide_render = False
        o.hide_viewport = False
        o.visible_glossy = True
        if o.animation_data:
            for drv in o.animation_data.drivers:
                if drv.data_path == '["bokeh_k"]' and not drv.driver.expression.startswith(f'{DISC_GAIN}*'):
                    drv.driver.expression = f'{DISC_GAIN}*({drv.driver.expression})'
        if DEBUG:
            print(f'S10 BOKEH {nm}: at ({u:.2f}, {v:.2f}) {D:.2f} m, blur {blur:.0f}px, disc {g_px:.0f}px of '
                  f'{target:.0f}px, clear on {int(free[(u, v)].sum())}/{len(frames)} frames', flush=True)
    if DEBUG:
        print(f'S10 BOKEH {len(cands)} of {len(grid)} points clear from f{F_LAND}; placed {len(placed)}', flush=True)
    bpy.context.view_layer.update()
    return placed


# The rest of the colleagues glow from down-table where the lens sees them only mirrored: in
# the black hub's glossy dome at the top of the frame. Cards (their front_bokeh discs, still
# driven by their screens, so they die in S11's wave) seen by glossy rays only, each laid on a
# mirror ray off the hub (colour_cards), on the side of the frame his hand leaves clear.
CARDS = ('kevin', 'people', 'arjun', 'operations')
CARD_U = (0.18, 0.32, 0.46, 0.58)            # where on the hub (image x) each is mirrored
CARD_DIST = 1.8                              # metres out along the mirror ray
CARD_SIZE = 0.45                             # metres across
CARD_GAIN = 10.0                             # on the disc's camera-calibrated strength (seen in a dark mirror)
DISC_GAIN = 4.0                              # place_bokeh's discs: their light spread over a 190 px defocus


def _cam_ray(cam, u, v):
    sc = bpy.context.scene
    cd = cam.data
    aspect = sc.render.resolution_y / sc.render.resolution_x
    return (cam.matrix_world.to_3x3() @ Vector(((u - 0.5 + cd.shift_x) * cd.sensor_width / cd.lens,
                                                 ((v - 0.5) * aspect + cd.shift_y) * cd.sensor_width / cd.lens,
                                                 -1.0))).normalized()


def colour_cards(room, cam):
    """Re-lay the front_bokeh discs named in CARDS (and not placed by place_bokeh) as glossy-only
    cards on mirror rays off the hub's dome: for each CARD_U, the ray through the frame's top band
    at that x that hits the hub, reflected, clear for CARD_DIST. Returns them."""
    sc = bpy.context.scene
    sc.frame_set(START)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    loc = cam.matrix_world.translation.copy()
    by_name = {o.get('bokeh_terminal'): o for o in getattr(room, 'bokeh', [])}
    out = []
    for nm, u in zip(CARDS, CARD_U):
        o = by_name.get(nm)
        if o is None or not o.hide_render:
            continue
        best = None
        for v in np.arange(0.97, 0.70, -0.015):
            d = _cam_ray(cam, u, v)
            hit, hp, nrm, _, ob, _ = sc.ray_cast(dg, loc, d, distance=3.0)
            if not hit or not ob.name.startswith('hub'):
                continue
            r = d - nrm * (2.0 * d.dot(nrm))
            if r.z < 0.02 or sc.ray_cast(dg, hp + nrm * 1e-4, r, distance=CARD_DIST + 0.2)[0]:
                continue
            best = (hp, r)
            break
        if best is None:
            continue
        hp, r = best
        r0 = max(v_.co.length for v_ in o.data.vertices)
        o.scale = (CARD_SIZE / (2.0 * r0),) * 3
        o.location = hp + r * CARD_DIST
        o.rotation_euler = (-r).to_track_quat('Z', 'Y').to_euler()
        o.hide_render = False
        o.hide_viewport = False
        o.visible_camera = False
        o.visible_glossy = True
        if o.animation_data:
            for drv in o.animation_data.drivers:
                if drv.data_path == '["bokeh_k"]' and not drv.driver.expression.startswith(f'{CARD_GAIN}*'):
                    drv.driver.expression = f'{CARD_GAIN}*({drv.driver.expression})'
        out.append(o)
        if DEBUG:
            print(f'S10 CARD {nm}: mirrored at image x {u:.2f}, card at {tuple(round(x, 2) for x in o.location)}',
                  flush=True)
    bpy.context.view_layer.update()
    return out


def mirrored_colours(room, cam, frame, cards, n_u=40, n_v=14):
    """Which cards the lens sees mirrored in the hub at `frame`: rays through a grid over the
    frame's top band, reflected (mirror direction) off the hub where they hit it first."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    loc = cam.matrix_world.translation.copy()
    names = {o.name: o.get('bokeh_terminal') for o in cards}
    seen = set()
    for i in range(n_u):
        for j in range(n_v):
            u, v = (i + 0.5) / n_u, 0.70 + 0.30 * (j + 0.5) / n_v
            d = _cam_ray(cam, u, v)
            hit, hp, nrm, _, ob, _ = sc.ray_cast(dg, loc, d, distance=3.0)
            if not hit or not ob.name.startswith('hub'):
                continue
            r = d - nrm * (2.0 * d.dot(nrm))
            hit2, _, _, _, ob2, _ = sc.ray_cast(dg, hp + nrm * 1e-4, r, distance=10.0)
            if hit2 and ob2.name in names:
                seen.add(names[ob2.name])
    return seen


# ------------------------------------------------------------------ dust in the slab

def dust(room, cache_dir):
    """The kit's motes are swapped for sparse, finer ones that only drift where the slab backlights
    them against a dark field: over the walnut in front of the black hub (soft, beyond the
    focus), and a few in the sunlit air in front of the head edge, well short of the lens."""
    kit = room.insert.get('dust')
    if kit is not None:
        kit.hide_render = True
        kit.hide_viewport = True
    coll = C.collection('S10_dust')
    a = P.dust_motes('s10_dust_hub', coll, center=(0.09, -0.10, 0.80), size=(0.26, 0.20, 0.07), n=26,
                     cache_dir=cache_dir, seed=21, radius=(0.00018, 0.00034))
    b = P.dust_motes('s10_dust_edge', coll, center=(0.27, 0.10, 0.79), size=(0.16, 0.12, 0.08), n=10,
                     cache_dir=cache_dir, seed=23, radius=(0.00012, 0.00022))
    return a, b


# ------------------------------------------------------------------ build

def build(args):
    t0 = time.time()
    C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = build_room()
    cache_dir = os.path.join(os.path.abspath(args.out), '_cache')
    room.insert_lights('jack', cache_dir=cache_dir)
    cam, foc = build_camera(room)
    room.use_kits('jack')
    dust(room, cache_dir)
    M0, jax = jack_seat(room)

    # Synergy: face idle (unseen here), the left hand performs
    tl = F.FaceTimeline(START, END)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    t1 = time.time()
    sol = left_hand(rig, room, cam, M0, jax)
    t2 = time.time()

    # the jack follows the pinch: seated, pulled, then pivoting about the pad contacts; the
    # cord springs and is carried with it
    pivot_local = M0.inverted() @ sol['pinch_w']
    axis_local = (M0.to_3x3().inverted() @ sol['axis_w']).normalized()
    key_jack(room, M0, pivot_local, axis_local)
    room.master.pulled(F_PULL)
    cord_follow(room, M0, sol)
    glint(room, cam)
    key_focus(cam, foc, M0, jax, sol)

    # warm walnut bounce for his lower body (tools/synergy_in_room.bounce_light)
    sp = Vector(R.SYNERGY_POS)
    b = C.area_light('syn_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                     9.0, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=C.collection('S10_lights'))
    b.visible_camera = False
    b.visible_glossy = False

    # colleagues' colour glow in the bokeh beyond the walnut's horizon
    room.front_bokeh(cam, START)
    sc = bpy.context.scene
    sc.camera = cam
    place_bokeh(room, cam, rig)
    colour_cards(room, cam)

    # render look: macro budget, locked-off seed, macro glare threshold, scanlines for this lens
    room.render_budget(kind='macro', samples=args.samples or None, locked=True)
    room.compositor(threshold=1.6)
    room.tune_scanlines(cam)
    sc.frame_set(START)
    print(f'S10 BUILD room+rig {t1 - t0:.1f}s  performance {t2 - t1:.1f}s  total {time.time() - t0:.1f}s', flush=True)
    if DEBUG and os.environ.get('S10_REPORT', '1') != '0':
        report(rig, room, cam, sol, M0)
    return room, rig, cam


# ------------------------------------------------------------------ gates

def report(rig, room, cam, sol, M0):
    """Every frame: the pads on the knurl (f945-992, within 0.3 mm), his hand against the jack,
    the socket and the cord, his forearm and hand against the walnut, the coil against the jack
    (beyond 3 mm from the tail), the hub in frame (0.1-0.9) with an LED unoccluded until it dies,
    and at least three colour discs unoccluded. Raises when a gate fails (S10_DEBUG runs)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    fails = []
    # pads on the knurl
    worst = {}
    for f in range(F_GRIP, END + 1):
        pc = pad_contacts(rig, room, f)
        for kk, (d, _, ov) in pc.items():
            if kk not in worst or d > worst[kk][0]:
                worst[kk] = (d, f)
            if d > 0.0003:
                fails.append(f'f{f} {kk} pad {d * 1000:.2f} mm off the knurl')
            if ov:
                fails.append(f'f{f} {kk} pad into the knurl ({ov} pairs)')
        if f in (F_GRIP, 953, F_PULL, F_OUT, 966, 970, 975, 982, END):
            print(f'S10 REPORT f{f} pads: ' + '  '.join(f'{kk} {d * 1000:.2f} mm ({ov})' for kk, (d, _, ov) in pc.items()),
                  flush=True)
    print('S10 REPORT pads worst: ' + '  '.join(f'{kk} {d * 1000:.2f} mm @f{f}' for kk, (d, f) in worst.items()),
          flush=True)
    # hand/arm contacts
    bad = []
    for f in range(START, END + 1):
        n = hand_overlaps(rig, room, f, cord=True, walnut=True)
        if any(n):
            bad.append((f, n))
    print('S10 REPORT hand contacts (frame, (jack+socket, cord, walnut) pairs):', bad or 'none', flush=True)
    for f, _ in bad[:1] + bad[-1:]:
        print(f'S10 REPORT f{f} parts: ' + part_overlaps(rig, room, f), flush=True)
    fails += [f'f{f} hand contacts {n}' for f, n in bad]
    # coil vs jack beyond 3 mm from the tail
    tail = room.master.e['tail']
    cbad = []
    for f in range(F_PULL - 1, END + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        cv, cp = _mesh_world([room.master.obj], dg)
        from mathutils.bvhtree import BVHTree
        ct = BVHTree.FromPolygons(cv, cp)
        jt = _bvh(jack_meshes(room), dg)
        tp = tail.matrix_world.translation
        n = 0
        for i, _ in ct.overlap(jt):
            c = sum((cv[k] for k in cp[i]), Vector()) / len(cp[i])
            if (c - tp).length > 0.003:
                n += 1
        if n:
            cbad.append((f, n))
    print('S10 REPORT coil through the jack (frame, pairs > 3 mm from the tail):', cbad or 'none', flush=True)
    fails += [f'f{f} coil through the jack ({n})' for f, n in cbad]
    # hub in frame, an LED seen until it dies
    leds = [p for p in hub_leds(room) if in_frame(cam, p)]
    hub_p = room.hub.root.matrix_world @ Vector((0.0, 0.0, 0.024))
    for f in range(START, END + 1):
        sc.frame_set(f)
        uv = world_to_camera_view(sc, cam, hub_p)
        if not (0.1 <= uv.x <= 0.9 and 0.1 <= uv.y <= 0.9):
            fails.append(f'f{f} hub at ({uv.x:.2f}, {uv.y:.2f})')
        if f <= F_PULL:
            dg = bpy.context.evaluated_depsgraph_get()
            cp_ = cam.matrix_world.translation
            seen = 0
            for p in leds:
                d = p - cp_
                hit, hl, _, _, ho, _ = sc.ray_cast(dg, cp_, d.normalized(), distance=d.length + 0.01)
                if hit and ho.name.startswith('hub'):
                    seen += 1
            if not seen:
                fails.append(f'f{f} no hub LED seen')
    sc.frame_set(START)
    uv = world_to_camera_view(sc, cam, hub_p)
    print(f'S10 REPORT hub at ({uv.x:.2f}, {uv.y:.2f}); LEDs in frame {len(leds)}', flush=True)
    # colleagues' colours: discs the lens sees directly, cards it sees mirrored in the hub and the
    # walnut (at least three colours every frame; checked every second frame)
    discs = [o for o in getattr(room, 'bokeh', []) if not o.hide_render and o.visible_camera]
    cards = [o for o in getattr(room, 'bokeh', []) if not o.hide_render and not o.visible_camera]
    low = []
    for f in list(range(START, END + 1, 2)) + [END]:
        seen = mirrored_colours(room, cam, f, cards)
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        cp_ = cam.matrix_world.translation
        for o in discs:
            p = o.matrix_world.translation
            d = p - cp_
            if not sc.ray_cast(dg, cp_, d.normalized(), distance=d.length - 0.05)[0]:
                seen.add(o.get('bokeh_terminal'))
        if f in (START, 945, 961, END):
            print(f'S10 REPORT f{f} colours seen: {sorted(seen)}', flush=True)
        if len(seen) < 3:
            low.append((f, sorted(seen)))
    print(f'S10 REPORT colour discs {len(discs)}, mirrored cards {len(cards)}; frames with fewer than 3 colours:',
          low or 'none', flush=True)
    fails += [f'f{f} only {n} colours seen' for f, n in low]
    for f in (929, 937, 945, 961, 963, 975, 992):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        jr = room.jack.root.evaluated_get(dg).matrix_world
        uv = world_to_camera_view(sc, cam, jr @ Vector((0, PINCH_ALONG, 0)))
        print(f'S10 REPORT f{f}: pinch in frame ({uv.x:.2f}, {uv.y:.2f})  swing {swing_deg(f):.1f}', flush=True)
    sc.frame_set(START)
    if fails:
        for line in fails[:60]:
            print('S10 GATE FAIL', line, flush=True)
        raise RuntimeError(f'S10: {len(fails)} gate failures (first: {fails[0]})')
    print('S10 REPORT all gates pass', flush=True)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
