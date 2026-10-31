"""S05 · f433-528 · E2_LONG_ROOM (lit): 'Outstanding.' One mouth sweep; posted without looking.

    blender -b --factory-startup -P shots/s05_outstanding.py -- --quality proof --only 433,446,460,461,479,497,508,518,528
    blender -b --factory-startup -P shots/s05_outstanding.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s05_outstanding.py -- --quality final
    S05_DIAG=1 ... --no-render      prints the searches, the sync points and a BVH clipping check

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S05):
  f433-446  his left hand rises into frame holding Kevin's padlock, thumb on one broad face, index
            and middle on the other (the shot's hand copy: the room's padlock leaves the walnut on
            the cut), decelerating to a stop at chin level 35 cm in front of the screen, its brass
            face turned toward the lens. Keyed every frame on one eased path.
  f447-460  the head rolls a further 4 deg (to 8) and pitches down 3 to study it: one servo move.
            The extra roll is taken in the neck, so the A-frame's pistons work against each other
            (near/his right -6 mm, far/his left +3 mm; the canon roll direction lifts his left).
  f461-496  ONE brightness wave crosses the mouth row, LED 1 on f461 to LED 22 on f496, 0.6 LED a
            frame, max(0.16, 1 - d/7) (face.wave); idle 11% again on f497. Brightness only, left to
            right only, fixed height.
  f489-500  the head returns to the canon 4 deg roll, eyes forward (no head dip).
  f501-507  without a head movement the hand carries the padlock on one eased path that ends
            straight down the slot's axis; contact on f508 (rig.post's contact pose, the lowest
            pinch whose arm stays clear of his chest: the padlock rides ~3 cm over the slot).
  f508-518  released at contact, the padlock shrinks into the sip slot (scaled toward a point 6 mm
            under it, so it sinks as it shrinks and the lid hides the rest); gone from f519.
  f509-513  released, the empty pinch draws straight back, 5 cm up the slot axis and 4.5 cm out to his
            left (a crisp release), so the lens sees the padlock shrink; it hovers to f520.
  f516-522  the faint amber glow in the slot (slot_glow 516): it spills on the spout, the lid's far
            rim and the hovering fingertips.
  f521-528  the hand swings out from the lid and lowers out of frame.
The eyes stay 2x3, no blink; the cup never moves (right hand, chest height: measured 0.000 mm); he
never walks. Every arm pose is keyed per frame and checked by BVH against his body, the headset and
the cup (searches below); rig.bake_pauldrons() re-keys the shoulder caps.

Camera: 85 mm, level at screen height (1.58 m), 10 deg toward his right, 2.87 m away (the
treatment's 2.6 m cannot hold the head apex and the cup's base in one 85 mm frame: the base falls
8% of the frame below the edge), framed by lens shift (verticals stay vertical): the apex 1.5% under
the top edge, the cup's base 2.7% over the bottom. Locked off with an imperceptible 1% linear push.
f/4 focused between the padlock and the screen, so the padlock, the LEDs and the lid all hold (the
treatment's f/2 puts the 35 cm padlock-to-face gap 5 px out of focus at 800 px; the colour bokeh
behind him comes from Room.front_bokeh's discs at any stop).
Light: the room as built (the skylight slab is his top key) plus Kevin's sky-blue edge from frame
left (his right), the slab's warm walnut bounce (his lower torso: rig owner's note), the skylight's
spill off the head wall as a cool rim on both sides, a warm card light-linked to the hand padlock
(its brass face reads gold, not black) and a small amber spill from the slot during the glow.
Room.front_bokeh puts the colleagues' colour discs in the void behind him.

GRIP='shackle' (S05_OPTS='{"GRIP": "shackle"}') is a tested alternative: the padlock pinched by its
shackle, the body hanging and swinging (damped pendulum) under the fingers, posted with a true
contact (1.5 mm over the slot). It reads well as a silhouette but forces the elbow out to the side
at chin height, so the face grip is the default.
"""

import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as P  # noqa: E402
import synergy as S  # noqa: E402

SHOT = 's05'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ---------------------------------------------------------------- the beats (film frames)
RISE = (433, 446)           # the hand rises into frame, stops at the chin
STUDY = (446, 460)          # head: canon on f446 -> roll 8 / pitch 3 on f460 (moves f447-460)
WAVE = (461, 497)           # 'Outstanding.': the wave leaves LED 1 on f461, idle again on f497
RETURN = (488, 500)         # head: study on f488 -> canon on f500 (moves f489-500)
CARRY = (500, 508)          # hand still on f500, contact with the slot on f508
CONTACT = 508
LIFT = 5                    # released, the empty pinch draws straight back by f513 ...
LIFT_D = 0.05               # ... this far up the slot axis ...
LIFT_SIDE = 0.045           # ... and this far out to his left, clearing the lens's view of the shrink
HOVER_END = 520             # ... and hovers there
LOWER = (520, 528)          # then lowers out of frame
SHRINK = (508, 518)         # the padlock shrinks into the slot; hidden from f519
GLOW = 516                  # slot_glow(516, 6): up on f517, out on f522

# ---------------------------------------------------------------- performance (rig space)
GRIP = 'face'                               # 'face': thumb on one broad face, index + middle on the other
                                            # (the rig's PADLOCK grip); 'shackle': pinched by the shackle,
                                            # the body hanging (and swinging) under the fingers
STUDY_PINCH = Vector((0.0, -0.50, 1.42))    # the pinch (chosen from STUDY_PINCHES): the body hangs at
STUDY_PINCHES = (((0.02, -0.50, 1.42),) if GRIP == 'face' else
                 ((0.0, -0.50, 1.40), (0.02, -0.50, 1.42), (0.04, -0.50, 1.44), (0.06, -0.50, 1.47)))
                                            # the chin, 35 cm in front of the screen
PINCH_W = 250.0                             # study: cost per metre the pinch sits toward his left
RISE_FROM = Vector((0.20, -0.42, 1.02))     # below the frame, up from the table
EXIT_TO = Vector((0.27, -0.36, 0.98))       # below the frame again, toward his left hip
STUDY_HEAD = (3.0, 8.0, 0.0)                # pitch down 3, roll to 8
NECK_ROLL = 4.0                             # share of the extra roll taken in the neck (pistons)
FACE_TURN = 20.0                            # shackle grip: the broad face this far off the lens (depth)
FACE_DEG = 30.0                             # face grip: the broad face turned this far toward the lens,
                                            # tipped up toward the skylight
FIT_UP, FIT_BEYOND, FIT_SIDE = 0.6, 4.0, 6.0    # face grip: shackle up, beyond the fingertips, clear of
                                            # the palm as the lens sees it
GAP = S.PADLOCK_GAP if GRIP == 'face' else 0.0098    # the pads either side of the 30 mm body / 9.2 mm shackle
GRIP_FINGERS = S.PADLOCK_FINGERS            # index and middle pads together
PIVOT_Z = 0.0885                            # the shackle's apex (tube centre) above the padlock's base
COM_Z = 0.030                               # its centre of mass (brass body + steel shackle)
HANG_DROP = 0.0                             # set by fit_hang
SWING_ZETA = 0.45                           # damping of the swing (fingertip friction)
GRIP_HZ = 1.6                               # the pinch's own stiffness against the swing
STEADY = 4                                  # frames before contact over which he steadies it
SINK = 0.006                                # the shrink converges this far under the slot plane
SHRINK_END = 0.02
POST_EXTENTS = (0.058, 0.050, 0.044, 0.038, 0.032)   # face grip: rig.post heights tried, high to low
CLEAR = 0.0015                              # the padlock's lowest point over the slot at contact
COVER_W = 2000.0                            # study hand: weight of the hand over the face screen
VIS_W = 60.0                                # study hand: weight of the padlock hidden by the hand
STUDY_TRIES = 16                            # hand frames solved for the study pose
STUDY_PICK = None                           # force one of the tried hand frames (index), for review

# ---------------------------------------------------------------- camera
LENS, FSTOP = 85.0, 4.0
DIST, AZ, CAM_Z = 2.87, 10.0, 1.58
PUSH = 0.01
AIM_X = 0.0                 # horizontal aim (world x at his plane)
TOP_MARGIN = 0.015          # head apex this far (fraction of frame height) under the top edge

# ---------------------------------------------------------------- light (tuned on proof renders)
KEVIN_E = 40.0
KEVIN_DIR = (-122.0, 22.0)  # azimuth (deg toward his right from his front) and elevation: behind
                            # his right shoulder, so it only grazes the frame-left contours
KEVIN_DIST = 1.7
KEVIN_SAT = 2.4             # saturation push on Kevin's pale sky blue (it must read on warm enamel)
BOUNCE_E = 4.0
RIM_E = (70.0, 50.0)
CARD_E = 2.5
AMBER_E = 1.0
BOKEH = dict(seed=5)

HAND_L = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]
ARM_L = ['shoulder_L', 'upperarm_L', 'forearm_L'] + HAND_L

DIAG = bool(os.environ.get('S05_DIAG'))
_GRIP0 = GRIP
_opts = json.loads(os.environ.get('S05_OPTS', '{}') or '{}')
for _k, _v in _opts.items():
    if isinstance(globals().get(_k), Vector):
        _v = Vector(_v)
    globals()[_k] = tuple(_v) if isinstance(_v, list) else _v
if GRIP != _GRIP0:
    if 'GAP' not in _opts:
        GAP = S.PADLOCK_GAP if GRIP == 'face' else 0.0098
    if 'STUDY_PINCHES' not in _opts:
        STUDY_PINCHES = (((0.02, -0.50, 1.42),) if GRIP == 'face' else
                         ((0.0, -0.50, 1.40), (0.02, -0.50, 1.42), (0.04, -0.50, 1.44), (0.06, -0.50, 1.47)))


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def bezier(p0, p1, p2, p3, t):
    a = p0.lerp(p1, t)
    b = p1.lerp(p2, t)
    c = p2.lerp(p3, t)
    return a.lerp(b, t).lerp(b.lerp(c, t), t)


# ---------------------------------------------------------------- the room's side of the film

def room_timeline(room):
    """env_room.demo_timeline's events that touch f433-528 (the colleague discs behind him follow
    their terminals' states; the printer and the droid run on, off screen)."""
    pr = room.printer
    for f in (385, 449, 513):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = R.ROOM['droid_lane_x']
    x0, y0 = R.ROOM['droid_start']
    d.place(299, x0, y0, R.ROOM['droid_start_heading'])
    d.drive(300, 712, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + R.droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)
    pad = room.props['kevin'][0]
    room.key_visible(pad, START, False)          # in his hand now (the shot's copy)


# ---------------------------------------------------------------- face

def face_timeline():
    tl = F.FaceTimeline(START, END)
    tl.wave(WAVE[0], end=WAVE[1])                # canon: 14.4 LEDs/s, tail 7, floor 16%
    return tl


# ---------------------------------------------------------------- padlock in the hand

def _world_mesh(objs, dg):
    vs, ps = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        Mw = ev.matrix_world
        k = len(vs)
        vs += [Mw @ v.co for v in me.vertices]
        ps += [tuple(i + k for i in p.vertices) for p in me.polygons]
        ev.to_mesh_clear()
    return vs, ps


def hand_world(rig, f):
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ae = rig.arm.evaluated_get(dg)
    return ae.matrix_world @ ae.pose.bones['hand_L'].matrix


def pinch_world(rig, f):
    """(pinch point, pinch axis) of the left hand in world space at frame f. The axis is the one
    fit_hang found for the shackle between the pads (hand-rest space), else thumb tip -> index tip."""
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ae = rig.arm.evaluated_get(dg)
    D = ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()
    pin = rig.thumb_pinch('L', gap=GAP)
    axis = getattr(rig, '_s05_axis', None)
    if axis is None:
        axis = (pin['thumb_tip'] - pin['tip']).normalized()
    return D @ pin['point'], (D.to_3x3() @ axis).normalized()


_PAD_LOCAL = {}


def fit_padlock(rig, pad, f, cam_pos):
    """World matrix of the padlock pinched in the left hand at frame f with no part of it inside the
    fingers (tools/synergy_in_room.fit_padlock): broad faces on the pads, searched over the turn
    about the pinch axis and where the pads land on the face; prefers the shackle up, the body
    beyond the fingertips and the most of the body visible past the hand from the lens."""
    from mathutils.bvhtree import BVHTree
    pin = rig.thumb_pinch('L', gap=GAP)
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ae = rig.arm.evaluated_get(dg)
    D = ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()
    hd = rig.hands['L']
    hv, hp = _world_mesh(rig.parts_on_bones(HAND_L), dg)
    th = BVHTree.FromPolygons(hv, hp)
    pad.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lv, lp = _world_mesh(list(pad.children_recursive), dg)
    across = (D.to_3x3() @ (pin['thumb_tip'] - pin['tip'])).normalized()
    u_w = (D.to_3x3() @ hd['u']).normalized()
    up0 = (u_w - across * u_w.dot(across)).normalized()
    c = D @ pin['point']
    to_cam = (Vector(cam_pos) - c).normalized()
    palm = D @ (hd['W'] + hd['u'] * 0.045)
    best = None
    for phi in range(0, 360, 15):
        up = Matrix.Rotation(math.radians(phi), 3, across) @ up0
        x = across.cross(up)
        Rm = Matrix((x, across, up)).transposed().to_4x4()
        for qx in (-0.020, -0.012, -0.004, 0.004, 0.012, 0.020):
            for qz in (0.008, 0.016, 0.024, 0.032, 0.040, 0.047):
                Mp = Matrix.Translation(c) @ Rm @ Matrix.Translation((-qx, 0.0, -qz))
                tv = [Mp @ v for v in lv]
                n = len(th.overlap(BVHTree.FromPolygons(tv, lp)))
                body_c = Mp @ Vector((0, 0, 0.026))
                # body centre away from the palm, sideways to the lens (not hidden behind the hand)
                side = (body_c - palm) - to_cam * (body_c - palm).dot(to_cam)
                score = n * 100.0 - FIT_UP * up.z - FIT_BEYOND * (body_c - c).dot(u_w) - FIT_SIDE * side.length
                if best is None or score < best[0]:
                    best = (score, Mp, n, phi, qx, qz, up.z, side.length)
    print('S05 padlock fit: phi %d qx %.3f qz %.3f shackle up.z %.2f clear of the palm %.3f' % best[3:], flush=True)
    return best[1], best[2]


def study_hand_face(rig, cam_rig, top=30, pinch=None):
    """Hand frame (u along the fingers, w palm normal) for the padlock pinch at the chin: small turns
    of the fingers' direction and the roll about it, so the padlock's broad face turns FACE_DEG
    toward the lens, tipped up toward the skylight, in front of the hand (synergy_in_room)."""
    hd = rig.hands['L']
    u0 = Vector((-0.45, -0.70, 0.55)).normalized()
    w0 = Vector((-0.60, 0.70, 0.40))
    w0 = (w0 - u0 * w0.dot(u0)).normalized()
    pin = rig.thumb_pinch('L', gap=GAP)
    pinch = STUDY_PINCH if pinch is None else Vector(pinch)
    to_cam = (Vector(cam_rig) - pinch).normalized()
    up_p = (S.UP - to_cam * S.UP.dot(to_cam)).normalized()
    want = (to_cam * math.cos(math.radians(FACE_DEG)) + up_p * math.sin(math.radians(FACE_DEG))).normalized()
    cands = []
    for yaw in (-60, -45, -30, -15, 0, 15):
        for pitch in (-20, 0, 20, 35):
            Ry = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ \
                Matrix.Rotation(math.radians(pitch), 3, u0.cross(S.UP).normalized())
            u = (Ry @ u0).normalized()
            wb = Ry @ w0
            wb = (wb - u * wb.dot(u)).normalized()
            for a in range(-90, 91, 15):
                w = Matrix.Rotation(math.radians(a), 3, u) @ wb
                Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
                across = (Rt @ (pin['thumb_tip'] - pin['tip'])).normalized()
                ang = min(math.degrees(across.angle(want)), math.degrees((-across).angle(want)))
                front = (Rt @ (pin['point'] - (hd['W'] + hd['u'] * 0.05 - hd['w'] * 0.012))).dot(to_cam)
                score = ang + (abs(a) + abs(yaw) + abs(pitch)) * 0.08 + max(0.0, 0.03 - front) * 2000.0
                cands.append((score, u, w, ang, 0.0))
    cands.sort(key=lambda c: c[0])
    return cands[:top]


def pad_local(pad):
    """(shackle-and-collar verts, polys) and (whole padlock verts, polys) in the padlock's own space."""
    if not _PAD_LOCAL:
        keep = pad.matrix_world.copy()
        pad.matrix_world = Matrix.Identity(4)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        top = [o for o in pad.children_recursive if o.type == 'MESH' and ('shackle' in o.name or 'collar' in o.name)]
        _PAD_LOCAL['top'] = _world_mesh(top, dg)
        _PAD_LOCAL['all'] = _world_mesh([o for o in pad.children_recursive if o.type == 'MESH'], dg)
        pad.matrix_world = keep
        bpy.context.view_layer.update()
    return _PAD_LOCAL['top'], _PAD_LOCAL['all']


def fit_hang(rig, pad, f):
    """How the shackle lies between the pads: the pinch axis turned about the vertical (yaw) and
    tipped off level (tilt), and how far the padlock hangs below the pinch point (drop), searched
    nearest the thumb -> index line for the hanging padlock touching no finger, the palm or the thumb
    (BVH). Sets HANG_DROP; returns (axis in hand-rest space, pairs left, yaw, tilt)."""
    from mathutils.bvhtree import BVHTree
    global HANG_DROP
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ae = rig.arm.evaluated_get(dg)
    D = ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()
    pin = rig.thumb_pinch('L', gap=GAP)
    c = D @ pin['point']
    a0 = D.to_3x3() @ (pin['thumb_tip'] - pin['tip'])
    a0 = Vector((a0.x, a0.y, 0.0)).normalized()
    hv, hp = _world_mesh(rig.parts_on_bones(HAND_L), dg)
    th = BVHTree.FromPolygons(hv, hp)
    (sv, sp_), (av, ap) = pad_local(pad)
    combos = sorted(((b, t, d) for b in range(-90, 91, 6) for t in (0, -10, 10, -20, 20, -30, 30)
                     for d in (0.0, 0.002, 0.004, 0.006, 0.008)),
                    key=lambda x: abs(x[0]) + 1.5 * abs(x[1]) + 1500.0 * x[2])
    best = None
    for b, t, d in combos:
        ab = Matrix.Rotation(math.radians(b), 3, 'Z') @ a0
        h = ab.cross(Vector((0.0, 0.0, 1.0))).normalized()
        across = (Matrix.Rotation(math.radians(t), 3, h) @ ab).normalized()
        M = hang_matrix(c, across, drop=d)
        n = len(th.overlap(BVHTree.FromPolygons([M @ v for v in sv], sp_)))
        if n == 0:                                    # the shackle is clear: check the whole padlock
            n = len(th.overlap(BVHTree.FromPolygons([M @ v for v in av], ap)))
        if best is None or n < best[1]:
            best = (across, n, b, t, d)
        if n == 0:
            break
    across, n, b, t, d = best
    HANG_DROP = d
    return (D.to_3x3().inverted() @ across).normalized(), n, b, t


def padlock_matrix(rig, f):
    """World matrix of the padlock in the left hand at frame f (rigid in the face grip, hanging
    straight in the shackle grip)."""
    if GRIP == 'face':
        return hand_world(rig, f) @ rig._s05_rel
    return hang_matrix(*pinch_world(rig, f))


def hang_matrix(c, across, theta=0.0, drop=None):
    """World matrix of the padlock pinched by the shackle's apex at c (pads either side, along
    `across`), its body hanging `theta` radians off straight down about the pinch axis; `drop`
    (default HANG_DROP) lowers it that far in the pinch (the pads on the tube's upper flanks)."""
    drop = HANG_DROP if drop is None else drop
    down = Vector((0.0, 0.0, -1.0))
    d0 = (down - across * down.dot(across)).normalized()
    d = Matrix.Rotation(theta, 3, across) @ d0
    z = -d
    x = across.cross(z)
    Rm = Matrix((x, across, z)).transposed().to_4x4()
    return Matrix.Translation(c + d * drop) @ Rm @ Matrix.Translation((0.0, 0.0, -PIVOT_Z))


def swing(rig, frames, substeps=24):
    """The padlock as a damped pendulum about the pinch: driven by the pinch point's own
    acceleration (from its keyed path), starting at rest in its quasi-static hang. Returns
    {frame: world matrix}."""
    cs, axs = {}, {}
    f0, f1 = frames[0], frames[-1]
    for f in range(f0, f1 + 2):
        cs[f], axs[f] = pinch_world(rig, f)
    cs[f0 - 1] = 2 * cs[f0] - cs[f0 + 1]         # the hand is already moving on the cut
    L = PIVOT_Z - COM_Z
    wg = 2.0 * math.pi * GRIP_HZ                 # the pads' grip resists the turn like a spring
    wt = math.sqrt(9.81 / L + wg * wg)
    g = Vector((0.0, 0.0, -9.81))
    fps2 = C.FPS * C.FPS

    def frame_vecs(ax, th):
        down = Vector((0.0, 0.0, -1.0))
        d0 = (down - ax * down.dot(ax)).normalized()
        d = Matrix.Rotation(th, 3, ax) @ d0
        return d0, d, ax.cross(d)
    # start in the hang the hand's acceleration on the cut asks for
    a = (cs[f0 + 1] - 2 * cs[f0] + cs[f0 - 1]) * fps2
    d0, _, t0 = frame_vecs(axs[f0], 0.0)
    ge = g - a
    theta = math.atan2(ge.dot(t0), ge.dot(d0))
    omega = 0.0
    out = {}
    dt = 1.0 / C.FPS / substeps
    for f in range(f0, f1 + 1):
        # he steadies it over the last frames of the approach: it meets the slot hanging true
        k_ = 1.0 - smoother((f - (f1 - STEADY)) / STEADY) if f1 - STEADY < f else 1.0
        out[f] = hang_matrix(cs[f], axs[f], theta * k_)
        a = (cs[f + 1] - 2 * cs[f] + cs[f - 1]) * fps2
        for k in range(substeps):
            ax = axs[f].lerp(axs[f + 1], k / substeps).normalized()
            _, d, t = frame_vecs(ax, theta)
            alpha = (g - a).dot(t) / L - wg * wg * theta - 2.0 * SWING_ZETA * wt * omega
            omega += alpha * dt
            theta += omega * dt
    return out


def bake_matrices(pad, mats):
    pad.rotation_mode = 'QUATERNION'
    prev = None
    for f in sorted(mats):
        key_matrix(pad, f, mats[f], prev)
        prev = pad.rotation_quaternion.copy()


def key_matrix(obj, f, Mw, prev=None):
    loc, rot, sca = Mw.decompose()
    if prev is not None and rot.dot(prev) < 0:
        rot.negate()
    obj.location = loc
    obj.rotation_quaternion = rot
    obj.scale = sca
    for path in ('location', 'rotation_quaternion', 'scale'):
        obj.keyframe_insert(path, frame=f)


def linear_keys(obj, a, b):
    ad = obj.animation_data
    if ad is None or ad.action is None:
        return
    for fc in C.fcurves(ad.action):
        for kp in fc.keyframe_points:
            if a <= kp.co.x <= b:
                kp.interpolation = 'LINEAR'


def lowest_along(pad, f, pos, ax):
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    low = 9.0
    for o in pad.children_recursive:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        Mw = ev.matrix_world
        low = min(low, min((Mw @ v.co - pos).dot(ax) for v in me.vertices))
        ev.to_mesh_clear()
    return low


def padlock_visible(pad, names, cam_pos, step=3):
    """Fraction of the padlock's sampled vertices whose ray from the lens meets the padlock first
    (not a finger, the hand or the arm)."""
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    org = Vector(cam_pos)
    vs, _ = _world_mesh(list(pad.children_recursive), dg)
    hit_pad = total = 0
    for p in vs[::step]:
        d = p - org
        ok, loc, nrm, idx, obj, _m = sc.ray_cast(dg, org, d.normalized(), distance=d.length + 0.002)
        total += 1
        if ok and obj is not None and obj.name in names:
            hit_pad += 1
    return hit_pad / max(1, total)


# ---------------------------------------------------------------- Synergy

def face_box(rig, cam, frames, margin=0.008):
    """Image-space box (x0, x1, y0, y1) of the face's lit LEDs (eyes and the mouth row) over
    `frames`, grown by `margin`."""
    from bpy_extras.object_utils import world_to_camera_view as w2c
    sc = bpy.context.scene
    xs, ys = [], []
    for f in frames:
        for u in (0.18, 0.82):
            for v in (0.12, 0.75):
                q = w2c(sc, cam, rig.screen_point(u, v, f))
                xs.append(q.x)
                ys.append(q.y)
    return min(xs) - margin, max(xs) + margin, min(ys) - margin, max(ys) + margin


def hand_over_face(rig, cam, box, f=None):
    """Fraction of the left hand's sampled surface points that the lens sees inside the face
    screen's box (the hand must never hide the eyes or the mouth row)."""
    from bpy_extras.object_utils import world_to_camera_view as w2c
    sc = bpy.context.scene
    sc.frame_set(f or RISE[1])
    dg = bpy.context.evaluated_depsgraph_get()
    vs, _ = _world_mesh(rig.parts_on_bones(HAND_L), dg)
    x0, x1, y0, y1 = box
    n = inside = 0
    for p in vs[::7]:
        q = w2c(sc, cam, p)
        n += 1
        inside += x0 <= q.x <= x1 and y0 <= q.y <= y1
    return inside / max(1, n)


def study_hand(rig, cam_rig, top=30, pinch=None):
    """Candidate hand frames (u along the fingers, w palm normal) for the shackle pinch at the
    chin: the fingers pointing down over the shackle, the pinch axis level and close to the line of
    sight (FACE_TURN off it), so the hanging body shows its broad face; the wrist toward his left
    and his body (the hand comes from his left side). Sorted, best first."""
    hd = rig.hands['L']
    pin = rig.thumb_pinch('L', gap=GAP)
    pinch = STUDY_PINCH if pinch is None else Vector(pinch)
    to_cam = Vector(cam_rig) - pinch
    to_cam = Vector((to_cam.x, to_cam.y, 0.0)).normalized()
    want = Matrix.Rotation(math.radians(-FACE_TURN), 3, 'Z') @ to_cam
    cands = []
    for yaw in range(0, 360, 15):
        for el in (-80, -65, -50, -35, -20, -8):
            e, y_ = math.radians(el), math.radians(yaw)
            u = Vector((math.cos(e) * math.cos(y_), math.cos(e) * math.sin(y_), math.sin(e)))
            side = u.cross(S.UP).normalized()
            for roll in range(0, 360, 15):
                w = Matrix.Rotation(math.radians(roll), 3, u) @ side
                Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
                across = (Rt @ (pin['thumb_tip'] - pin['tip'])).normalized()
                ang = min(math.degrees(across.angle(want)), math.degrees((-across).angle(want)))
                level = math.degrees(math.asin(min(1.0, abs(across.z))))
                wo = -(Rt @ (pin['point'] - hd['W']))          # pinch -> wrist
                pref = max(0.0, 0.02 - wo.x) * 600.0 + max(0.0, -0.01 - wo.y) * 400.0
                cands.append((ang + 1.5 * level + pref, u, w, ang, level))
    cands.sort(key=lambda c: c[0])
    return cands[:top]


def pinch_offset(rig, u, w):
    """Wrist -> pinch point (chest-rest space) for a hand frame (u, w)."""
    hd = rig.hands['L']
    Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
    return Rt @ (rig.thumb_pinch('L', gap=GAP)['point'] - hd['W'])


def key_hand(rig, f, pinch, u, w, pole, shoulder, interp='LINEAR', fingers=None):
    rig.place_arm(f, 'L', pinch - pinch_offset(rig, u, w), u, w, pole, interp, shoulder=tuple(shoulder))
    rig.pose(f, interp, fingers_L=fingers or GRIP_FINGERS, thumb_L=('pinch', GAP))


def blend_frames(a, b, t):
    """Slerp between two hand frames (u, w)."""
    qa = S.frame3(*a).to_quaternion()
    qb = S.frame3(*b).to_quaternion()
    if qa.dot(qb) < 0:
        qb.negate()
    Rm = qa.slerp(qb, t).to_matrix()
    return Rm.col[0].copy(), Rm.col[1].copy()


def stage_synergy(tl, cam, pad):
    """Cup at chest height (never moves), breathing, the head's study and return, and the left
    hand's rise to the study pose at the chin (keyed every frame on one eased path)."""
    global HANG_DROP, STUDY_PINCH
    cam_pos = cam.matrix_world.translation.copy()
    cam_rig = cam_pos - Vector(R.SYNERGY_POS)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    k = 'BEZIER'
    rig.apply_preset(START, 'idle_cup', k)       # cup at chest height in the right hand, canon roll
    rig.breathe(START, END)
    # ---- head: study and return (one servo move each way)
    canon = dict(neck=(0.0, 0.0, 0.0), head=S.CANON_HEAD)
    study = dict(neck=(0.0, NECK_ROLL, 0.0), head=(STUDY_HEAD[0], STUDY_HEAD[1] - NECK_ROLL, STUDY_HEAD[2]))
    for f, pose in ((STUDY[0], canon), (STUDY[1], study), (RETURN[0], study), (RETURN[1], canon), (END, canon)):
        rig.pose(f, k, **pose)
    # ---- the study pose: the best few hand frames, each solved for the arm and scored by how much of
    # the hanging padlock the lens sees past the hand and whether the elbow stays down; the best one
    # whose arm is clear of his body (BVH) wins
    pad_names = {o.name for o in pad.children_recursive}
    screen_box = face_box(rig, cam, (STUDY[0], STUDY[1]))
    tries = []
    search = study_hand_face if GRIP == 'face' else study_hand
    cands = [(c_, Vector(pp)) for pp in STUDY_PINCHES for c_ in search(rig, cam_rig, STUDY_TRIES, pp)]
    if GRIP == 'face':
        # the padlock fitted once in the pinch (no part inside the fingers); it rides rigid in the hand
        (_, u0, w0, _, _), p0_ = cands[0]
        rig.place_arm_clear(RISE[1], 'L', p0_ - pinch_offset(rig, u0, w0), u0, w0, Vector((0.8, -0.3, -0.5)),
                            interp=k, fingers='pinch')
        rig.pose(RISE[1], k, fingers_L=GRIP_FINGERS, thumb_L=('pinch', GAP))
        M_fit, nfit = fit_padlock(rig, pad, RISE[1], cam_pos)
        rig._s05_rel = hand_world(rig, RISE[1]).inverted() @ M_fit
    for i, ((score, u, w, ang, level), pinch) in enumerate(cands):
        score += PINCH_W * max(0.0, pinch.x)
        sol = rig.place_arm_clear(RISE[1], 'L', pinch - pinch_offset(rig, u, w), u, w,
                                  Vector((0.8, -0.3, -0.5)), interp=k, fingers='pinch')
        rig.pose(RISE[1], k, fingers_L=GRIP_FINGERS, thumb_L=('pinch', GAP))
        pad.matrix_world = padlock_matrix(rig, RISE[1])
        vis = padlock_visible(pad, pad_names, cam_pos)
        cover = hand_over_face(rig, cam, screen_box)
        total = score + 40.0 * max(0.0, Vector(sol['pole']).z + 0.2) + VIS_W * (1.0 - vis) + sol['pen'] * 1e4 + \
            COVER_W * cover
        if STUDY_PICK is not None:
            total = (0.0 if i == STUDY_PICK else 1e6) + total
        tries.append((total, i, u, w, sol, ang, level, vis, pinch))
        if DIAG:
            print(f'S05 study try {i} at {tuple(pinch)}: face {ang:.0f} tilt {level:.0f} visible {vis:.2f} over the face {cover:.2f} pole z '
                  f'{Vector(sol["pole"]).z:+.2f} pen {sol["pen"]:.4f} -> {total:.1f}', flush=True)
    tries.sort(key=lambda t: t[0])
    best = None
    for total, i, u, w, sol, ang, level, vis, pinch in tries:
        rig.place_arm(RISE[1], 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], k, shoulder=sol['shoulder'])
        padm = [o for o in pad.children_recursive if o.type == 'MESH']
        if GRIP == 'face':
            axis, b, tilt_ = None, 0, 0
            pad.matrix_world = padlock_matrix(rig, RISE[1])
            nf = sum(rig.overlap_report(RISE[1], padm, rig.parts_on_bones(HAND_L)).values())
        else:
            rig._s05_axis = None
            axis, nf, b, tilt_ = fit_hang(rig, pad, RISE[1])
            rig._s05_axis = axis
            pad.matrix_world = padlock_matrix(rig, RISE[1])
        n = sum(arm_pairs(rig, RISE[1], padm).values()) + nf
        if DIAG:
            print(f'S05 study check {i}: shackle yaw {b:+d} tilt {tilt_:+d} deg drop {HANG_DROP * 1000:.0f} mm, padlock x fingers {nf}, '
                  f'x body {n - nf}', flush=True)
        if best is None or n < best[-1]:
            best = (i, u, w, sol, ang, level, vis, axis, (b, tilt_), HANG_DROP, pinch, n)
        if n == 0:
            break
    i, u_s, w_s, sol_s, ang, level, vis, axis, b, drop, pinch, n = best
    HANG_DROP = drop
    STUDY_PINCH = pinch
    rig._s05_axis = axis
    print(f'S05 study hand (try {i}) pinch at {tuple(round(x, 3) for x in pinch)}: face {ang:.0f} deg off the want, pinch axis {level:.0f} deg off level, '
          f'{vis:.0%} of the padlock in the clear, shackle turned {b[0]:+d} / tipped {b[1]:+d} deg, {drop * 1000:.0f} mm low in the pinch, arm + padlock x body + '
          f'fingers {n}', flush=True)
    pad.matrix_world = Matrix.Identity(4)
    sol_s['pole'], sol_s['shoulder'] = Vector(sol_s['pole']), Vector(sol_s['shoulder'])
    print(f'S05 study pose: pole {tuple(round(x, 2) for x in sol_s["pole"])} shoulder {tuple(sol_s["shoulder"])} '
          f'reach miss {sol_s["reach"] * 1000:.1f} mm pen {sol_s["pen"]:.4f}', flush=True)
    # rise: up from below the frame, decelerating into the study (x and y arrive a little later)
    for f in range(RISE[0], RISE[1] + 1):
        t = (f - RISE[0]) / (RISE[1] - RISE[0])
        tz = 1.0 - (1.0 - t) ** 3
        txy = 1.0 - (1.0 - t) ** 2.2
        p = Vector((RISE_FROM.x + (STUDY_PINCH.x - RISE_FROM.x) * txy,
                    RISE_FROM.y + (STUDY_PINCH.y - RISE_FROM.y) * txy,
                    RISE_FROM.z + (STUDY_PINCH.z - RISE_FROM.z) * tz))
        key_hand(rig, f, p, u_s, w_s, sol_s['pole'], sol_s['shoulder'], 'LINEAR' if f < RISE[1] else k)
    key_hand(rig, CARRY[0], STUDY_PINCH, u_s, w_s, sol_s['pole'], sol_s['shoulder'], k)
    rig._s05_study = (u_s, w_s, sol_s)
    rig._s05_axis_world_study = pinch_world(rig, RISE[1])[1]
    return rig


def contact_pose(rig, pad, lv, lp):
    """The contact on f508: the padlock hanging straight down the slot axis, its lowest point CLEAR
    over the slot. The hand keeps the study's frame turned about the vertical (so the pinch axis
    stays level and the padlock hangs true) by the least angle whose arm is clear of his body and
    the cup and whose padlock touches nothing of the cup. Keys f508; returns the solution."""
    k = 'BEZIER'
    u_s, w_s, sol_s = rig._s05_study
    pos, ax = rig.slot_world(CONTACT)
    Dc = rig._chest_delta(CONTACT)
    ax_r = (Dc.to_3x3() @ ax).normalized()
    if GRIP == 'face':
        return contact_post(rig, pad, lv, lp, pos, ax, ax_r)
    pin_0 = Dc @ (pos + ax * 0.12)                         # a first pinch height, measured and corrected
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']
    padm = [o for o in pad.children_recursive if o.type == 'MESH']
    from mathutils.bvhtree import BVHTree as _B
    best = None
    combos = [(sh_, yaw, tip) for yaw in sorted(range(-90, 91, 10), key=abs) for tip in (0, -15, 15, -30, 30)
              for sh_ in ([tuple(sol_s['shoulder'])], None)]
    for sh_, yaw, tip in combos:
        if True:
            Rz = Matrix.Rotation(math.radians(yaw), 3, 'Z')
            u, w = Rz @ u_s, Rz @ w_s
            if tip:
                ax_h = (Rz @ rig._s05_axis_world_study)
                Rt_ = Matrix.Rotation(math.radians(tip), 3, ax_h)
                u, w = Rt_ @ u, Rt_ @ w
            rig.place_arm(CONTACT, 'L', pin_0 - pinch_offset(rig, u, w), u, w, sol_s['pole'], k,
                          shoulder=tuple(sol_s['shoulder']))
            rig.pose(CONTACT, k, fingers_L=GRIP_FINGERS, thumb_L=('pinch', GAP))
            Mp = padlock_matrix(rig, CONTACT)
            pin_r = pin_0 + ax_r * (CLEAR - min((Mp @ v - pos).dot(ax) for v in lv))
            sol = rig.place_arm_clear(CONTACT, 'L', pin_r - pinch_offset(rig, u, w), u, w, sol_s['pole'], interp=k,
                                      fingers='pinch', shoulders=sh_)
            rig.pose(CONTACT, k, fingers_L=GRIP_FINGERS, thumb_L=('pinch', GAP))
            if sol['reach'] > 0.002 or sol['pen'] > 0.006:          # the BVH check below is the judge
                if DIAG:
                    print(f'S05 contact skip yaw {yaw:+d} tip {tip:+d}: reach miss {sol["reach"] * 1000:.1f} mm, '
                          f'pen {sol["pen"]:.4f}', flush=True)
                continue
            Mp = padlock_matrix(rig, CONTACT)
            tv = [Mp @ v for v in lv]
            low = min((v - pos).dot(ax) for v in tv)
            sc = bpy.context.scene
            sc.frame_set(CONTACT)
            dg = bpy.context.evaluated_depsgraph_get()
            cv, cp = _world_mesh(cup, dg)
            nc = len(_B.FromPolygons(cv, cp).overlap(_B.FromPolygons(tv, lp)))
            pad.matrix_world = Mp
            na = sum(arm_pairs(rig, CONTACT, padm).values())
            if DIAG:
                print(f'S05 contact try yaw {yaw:+d} tip {tip:+d}: padlock {low * 1000:+.1f} mm over the slot, '
                      f'x cup {nc}, arm + padlock x body/cup {na}', flush=True)
            if nc == 0 and na == 0:
                best = (yaw, tip, u, w, sol, low, pin_r)
                break
    pad.matrix_world = Matrix.Identity(4)
    if best is None:
        print('S05 WARNING: no clean contact pose; using the study frame', flush=True)
        pin_r = pin_0 + ax_r * 0.02
        sol = rig.place_arm_clear(CONTACT, 'L', pin_r - pinch_offset(rig, u_s, w_s), u_s, w_s, sol_s['pole'],
                                  interp=k, fingers='pinch')
        best = (0, 0, u_s, w_s, sol, None, pin_r)
    yaw, tip, u, w, sol, low, pin_r = best
    rig.place_arm(CONTACT, 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], 'LINEAR', shoulder=sol['shoulder'])
    rig.pose(CONTACT, 'LINEAR', fingers_L=GRIP_FINGERS, thumb_L=('pinch', GAP))
    print(f'S05 contact pose: study frame turned {yaw:+d} deg about the vertical, tipped {tip:+d}; the padlock '
          f'{(low or 0) * 1000:+.1f} mm over the slot', flush=True)
    sol = dict(sol)
    sol['pole'], sol['shoulder'] = Vector(sol['pole']), Vector(sol['shoulder'])
    return sol, pin_r, ax_r


def contact_post(rig, pad, lv, lp, pos, ax, ax_r):
    """Face grip: rig.post's contact pose (the hand pointing down over the slot, solved for the
    padlock: gap PADLOCK_GAP, fingers PADLOCK_FINGERS) at the lowest pinch height (`extent`) whose arm
    and padlock touch nothing of his body or the cup. The rig cannot bring the face-gripped padlock
    lower than ~3 cm over the slot without the upper arm entering the chest, so the shrink starts at
    contact (director's note)."""
    from mathutils.bvhtree import BVHTree as _B
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']
    padm = [o for o in pad.children_recursive if o.type == 'MESH']
    sc = bpy.context.scene
    choice = None
    for ext in POST_EXTENTS:
        sol = rig.post_pose(CONTACT, 0.016, 'LINEAR', gap=GAP, extent=ext, fingers=GRIP_FINGERS)
        Mp = padlock_matrix(rig, CONTACT)
        tv = [Mp @ v for v in lv]
        low = min((v - pos).dot(ax) for v in tv)
        sc.frame_set(CONTACT)
        dg = bpy.context.evaluated_depsgraph_get()
        cv, cp = _world_mesh(cup, dg)
        nc = len(_B.FromPolygons(cv, cp).overlap(_B.FromPolygons(tv, lp)))
        pad.matrix_world = Mp
        na = sum(arm_pairs(rig, CONTACT, padm).values())
        if DIAG:
            print(f'S05 contact extent {ext * 1000:.0f} mm: padlock {low * 1000:+.1f} mm over the slot, x cup {nc}, '
                  f'arm + padlock x body/cup {na}', flush=True)
        if nc == 0 and na == 0 and low > 0.0:
            choice = (ext, sol, low)
        elif choice is not None:
            break
    pad.matrix_world = Matrix.Identity(4)
    ext, sol, low = choice or (POST_EXTENTS[0], None, None)
    sol = rig.post_pose(CONTACT, 0.016, 'LINEAR', gap=GAP, extent=ext, fingers=GRIP_FINGERS)
    print(f'S05 contact pose (rig.post, extent {ext * 1000:.0f} mm): the padlock {(low or 0) * 1000:+.1f} mm over '
          f'the slot', flush=True)
    sol = dict(sol)
    sol['pole'], sol['shoulder'] = Vector(sol['pole']), Vector(sol['shoulder'])
    return sol, sol['wrist'] + pinch_offset(rig, sol['u'], sol['w']), ax_r


def stage_post(rig, pad, lv, lp):
    """Carry (f501-507) on one eased path from the chin that ends straight down the slot axis,
    contact on f508, the empty pinch straight back up the slot axis (f509-514, the hand's frame,
    elbow pole and shoulder held, so it never arcs: rig.post's line), hover, and lower out of frame
    toward his left hip."""
    k = 'BEZIER'
    u_s, w_s, sol_s = rig._s05_study
    sol_c, pin_c, ax_r = contact_pose(rig, pad, lv, lp)
    u_c, w_c = sol_c['u'], sol_c['w']
    # carry: a few path bulges and shoulder/elbow schedules, the first whose arm stays clear of his
    # body on every frame wins
    p0, p3 = STUDY_PINCH, pin_c
    p2 = p3 + ax_r * 0.07
    variants = [(b_, kp, ks) for b_ in ((0.0, -0.02, 0.0), (0.0, -0.06, 0.02), (0.03, -0.08, 0.04))
                for kp, ks in ((1.0, 1.0), (0.5, 0.5), (2.0, 2.0), (0.5, 2.0), (2.0, 0.5))]
    for b_, kp, ks in variants:
        p1 = p0 + (p3 - p0) * 0.35 + Vector(b_)
        for f in range(CARRY[0] + 1, CONTACT):
            t = smoother((f - CARRY[0]) / (CONTACT - CARRY[0]))
            u, w = blend_frames((u_s, w_s), (u_c, w_c), smoother(min(1.0, t * 1.25)))
            pole = sol_s['pole'].lerp(sol_c['pole'], t ** kp).normalized()
            sh = sol_s['shoulder'].lerp(sol_c['shoulder'], t ** ks)
            key_hand(rig, f, bezier(p0, p1, p2, p3, t), u, w, pole, sh, 'LINEAR')
        bad = first_clip(rig, range(CARRY[0] + 1, CONTACT))
        if DIAG:
            print(f'S05 carry bulge {b_} pole^{kp} shoulder^{ks}: {bad or "clear"}', flush=True)
        if bad is None:
            break
    print(f'S05 carry: bulge {b_}, pole^{kp}, shoulder^{ks}: {"clear" if bad is None else bad}', flush=True)
    lift = ax_r * LIFT_D + Vector((LIFT_SIDE, 0.0, 0.0))
    for f in range(CONTACT + 1, CONTACT + LIFT + 1):
        t = (f - CONTACT) / LIFT
        e = 1.0 - (1.0 - t) ** 2                 # a crisp release: fastest at once, easing into the hover
        key_hand(rig, f, pin_c + lift * e, u_c, w_c, sol_c['pole'], sol_c['shoulder'],
                 k if f == CONTACT + LIFT else 'LINEAR')
    bad = first_clip(rig, range(CONTACT + 1, CONTACT + LIFT + 1))
    print(f'S05 release: {"clear" if bad is None else bad}', flush=True)
    pin_l = pin_c + lift
    key_hand(rig, HOVER_END, pin_l, u_c, w_c, sol_c['pole'], sol_c['shoulder'], k)
    # lower out of frame: away from the lid first (out to his left), then down past the cup's side;
    # the first exit whose arm stays clear of his body wins
    u_e, w_e = Vector((0.05, -0.55, -0.83)).normalized(), Vector((-0.95, 0.15, -0.05))
    w_e = (w_e - u_e * w_e.dot(u_e)).normalized()
    keep = [tuple(sol_c['shoulder'])]
    for exit_, mid, kp, sh_e in ((EXIT_TO, (0.09, -0.01, 0.015), 1.0, keep), (EXIT_TO, (0.09, -0.01, 0.015), 2.5, keep),
                                 (EXIT_TO + Vector((0.06, -0.04, 0.0)), (0.12, -0.05, 0.0), 1.0, keep),
                                 (EXIT_TO + Vector((0.06, -0.04, 0.0)), (0.12, -0.05, 0.0), 2.5, keep),
                                 (EXIT_TO, (0.09, -0.01, 0.015), 2.5, None),
                                 (EXIT_TO + Vector((0.08, -0.12, 0.04)), (0.12, -0.08, 0.0), 2.5, keep)):
        sol_e = rig.place_arm_clear(END, 'L', exit_ - pinch_offset(rig, u_e, w_e), u_e, w_e,
                                    Vector((0.8, 0.2, -0.5)), interp=k, fingers='relaxed', shoulders=sh_e)
        for f in range(LOWER[0] + 1, LOWER[1] + 1):
            t = ((f - LOWER[0]) / (LOWER[1] - LOWER[0]))
            te = t * t * (1.6 - 0.6 * t)
            u, w = blend_frames((u_c, w_c), (u_e, w_e), smoother(t))
            p = bezier(pin_l, pin_l + Vector(mid), exit_ + Vector((0.0, 0.0, 0.16)), exit_, te)
            pole = sol_c['pole'].lerp(Vector(sol_e['pole']), t ** kp).normalized()
            sh = sol_c['shoulder'].lerp(Vector(sol_e['shoulder']), t ** kp)
            key_hand(rig, f, p, u, w, pole, sh, 'LINEAR' if f < END else k,
                     fingers=GRIP_FINGERS if f < END - 3 else 'relaxed')
        bad = first_clip(rig, range(LOWER[0] + 1, LOWER[1] + 1))
        if DIAG:
            print(f'S05 lower to {tuple(round(x, 2) for x in exit_)} via {mid} ^{kp} shoulder {sol_e["shoulder"]} '
                  f'(contact {tuple(sol_c["shoulder"])}), pole {tuple(round(x, 2) for x in sol_e["pole"])} '
                  f'(contact {tuple(round(x, 2) for x in sol_c["pole"])}): {bad or "clear"}', flush=True)
        if bad is None:
            break
    print(f'S05 lower: to {tuple(round(x, 2) for x in exit_)} via {mid}: {"clear" if bad is None else bad}',
          flush=True)
    rig.bake_pauldrons(START, END)
    return CONTACT + LIFT


# ---------------------------------------------------------------- camera

def camera():
    sp = Vector(R.SYNERGY_POS)
    a = math.radians(-AZ)
    loc = Vector((sp.x + DIST * math.sin(a), sp.y - DIST * math.cos(a), CAM_Z))
    d = Vector((sp.x + AIM_X, sp.y, CAM_Z)) - loc
    d.z = 0.0
    yaw = math.atan2(-d.x, d.y)
    cam = C.camera('cam_s05', LENS, tuple(loc), None, fstop=FSTOP, clip=(0.02, 120.0))
    cam.rotation_euler = (math.pi / 2, 0.0, yaw)
    dn = d.normalized()
    for f, k in ((START, 0.0), (END, PUSH)):
        cam.location = loc + dn * (DIST * k)
        cam.keyframe_insert('location', frame=f)
    linear_keys(cam, START, END)
    return cam


def frame_shot(cam, rig, pad):
    """Lens shift so the head apex sits TOP_MARGIN under the top edge at its highest (pushed in);
    reports where the cup's bottom lands."""
    sc = bpy.context.scene
    res = sc.render.resolution_y / sc.render.resolution_x
    lens, sw = cam.data.lens, cam.data.sensor_width
    head = rig.parts_on_bones(['head'])
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']

    def ys(objs, f):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        Mi = cam.matrix_world.inverted()
        out = []
        for o in objs:
            if o.type != 'MESH':
                continue
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            Mw = Mi @ ev.matrix_world
            for v in me.vertices:
                q = Mw @ v.co
                out.append((q.y / -q.z) * lens / sw)
            ev.to_mesh_clear()
        return out
    top = max(max(ys(head, f)) for f in (START, STUDY[1], END))
    bot = min(min(ys(cup, f)) for f in (START, END))
    half = 0.5 * res
    shift = top + 2 * half * TOP_MARGIN - half
    cam.data.shift_y = shift
    print(f'S05 framing: shift_y {shift:.4f}; cup bottom at {((bot - (shift - half)) / (2 * half)):.3f} of the '
          f'frame height above the bottom edge (want > 0)', flush=True)
    return shift


# ---------------------------------------------------------------- light

def lights(room, rig, pad, cam, M_study):
    coll = C.collection('S05_light')
    sp = Vector(R.SYNERGY_POS)
    head = sp + Vector((0.0, -0.06, 1.56))
    # Kevin's sky-blue edge from down the table on frame left (his right)
    az, el = (math.radians(x) for x in KEVIN_DIR)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    t = room.terminals['kevin']
    c0 = Vector(t.light.data.color)
    lum = 0.2126 * c0.x + 0.7152 * c0.y + 0.0722 * c0.z
    col = tuple(max(0.0, lum + (x - lum) * KEVIN_SAT) for x in c0)
    kev = C.area_light('s05_kevin_edge', tuple(head + d * KEVIN_DIST), tuple(head + Vector((0, 0, -0.12))), KEVIN_E, 1.1,
                       0.7, color=col, coll=coll)
    kev.visible_camera = False
    kev.data.spread = math.radians(80)
    # the slab's warm bounce off the walnut in front of him
    b = C.area_light('s05_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                     BOUNCE_E, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=coll)
    b.visible_camera = False
    b.visible_glossy = False
    # the skylight's spill off the head wall: crown, headband, shoulder caps
    for sx, e in zip((1.0, -1.0), RIM_E):
        lt = C.area_light(f's05_rim_{"L" if sx > 0 else "R"}', (sp.x + 0.35 * sx, sp.y + 1.05, 2.55),
                          (sp.x, sp.y, 1.55), e, 0.9, 0.35, color=(0.86, 0.91, 1.0), coll=coll)
        lt.visible_camera = False
    # warm card for the hand padlock, where its broad face mirrors toward the lens at the study
    c = M_study.translation
    n = (M_study.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
    v = (cam.matrix_world.translation - c).normalized()
    if n.dot(v) < 0:
        n = -n
    mirror = (n * (2.0 * n.dot(v)) - v).normalized()
    pos = c + mirror * 0.6
    card = C.area_light('s05_padlock_card', tuple(pos), tuple(c), CARD_E, 0.5, 0.3, color=(1.0, 0.80, 0.55), coll=coll)
    card.visible_camera = False
    recv = bpy.data.collections.new('S05_padlock_receivers')
    for o in pad.children_recursive:
        if o.type == 'MESH':
            recv.objects.link(o)
    card.light_linking.receiver_collection = recv
    # amber spill from the slot while it glows (lid spout, fingertips)
    pos, ax = rig.slot_world(GLOW)
    amb = C.point_light('s05_slot_amber', tuple(pos + ax * 0.004), 0.0, 0.003, color=(1.0, 0.55, 0.18), coll=coll)
    amb.visible_camera = False
    glow = rig.cup_handle.glow
    P.add_driver(amb.data, 'energy', f'{AMBER_E:.4f}*led', [('led', glow, '["led"]')])
    return kev


def glint(rig, cam):
    """The reflected skylight slot on the face glass, re-aimed through the head moves."""
    keys = sorted({START, *range(STUDY[0], STUDY[1] + 1), *range(RETURN[0], RETURN[1] + 1), END})
    for f in keys:
        rig.glass_glint(cam, f)


# ---------------------------------------------------------------- diagnostics

def report(rig, cam, pad):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene

    def plen(f, s):
        sc.frame_set(f)
        a = bpy.data.objects[f'{rig.name}_neck_piston_{s}_A'].matrix_world.translation
        b = bpy.data.objects[f'{rig.name}_neck_piston_{s}_B'].matrix_world.translation
        return (a - b).length
    cup0 = rig.cup.matrix_world.copy() if sc.frame_set(START) is None else None
    drift = 0.0
    for f in range(START, END + 1, 4):
        sc.frame_set(f)
        drift = max(drift, (rig.cup.matrix_world.translation - cup0.translation).length)
    print(f'S05 cup drift over the shot: {drift * 1000:.3f} mm', flush=True)
    for s in 'RL':
        print(f'S05 neck piston {s}: {(plen(STUDY[1], s) - plen(STUDY[0], s)) * 1000:+.1f} mm on the study',
              flush=True)
    for f in (START, 436, 440, RISE[1], STUDY[1], 497, CARRY[0], 504, CONTACT, 512, 518, HOVER_END, 524, END):
        sc.frame_set(f)
        q = world_to_camera_view(sc, cam, pad.matrix_world.translation)
        sp = rig.screen_point(0.5, 0.5)
        qf = world_to_camera_view(sc, cam, sp)
        print(f'S05 f{f}: padlock at image ({q.x:.3f}, {q.y:.3f}) scale {pad.scale.x:.3f}; '
              f'face centre ({qf.x:.3f}, {qf.y:.3f})', flush=True)


def _real(a, b):
    """Pairs that count as interpenetration (joint seats, pistons and cables excluded)."""
    if any(x in a or x in b for x in ('piston', 'rail', 'wire', 'cable', 'cord', 'plug', 'bicep', 'slotglow')):
        return False
    for x, y in (('forearm_', 'upperarm_'), ('palm_', 'forearm_'), ('shoulder_hub', 'upperarm')):
        if (x in a and y in b) or (x in b and y in a):
            return False
    return True


def arm_pairs(rig, f, extra=()):
    """{(a, b): pairs} of the left arm (and `extra` objects) against his body, headset and cup."""
    if not hasattr(rig, '_s05_groups'):
        arm = rig.parts_on_bones(ARM_L + ['pauldron_L'])
        body = rig.parts_on_bones(['chest', 'neck', 'head', 'spine', 'pelvis', 'badge', 'upperarm_R', 'forearm_R',
                                   'hand_R', 'shoulder_R'])
        hs = [o for o in rig.headset.children_recursive if o.type == 'MESH'] if rig.headset else []
        cup = [o for o in rig.cup_objects() if o.type == 'MESH']
        rig._s05_groups = (arm, body + hs + cup)
    arm, rest = rig._s05_groups
    r = rig.overlap_report(f, arm + list(extra), rest)
    return {k: v for k, v in r.items() if _real(*k)}


def first_clip(rig, frames):
    """(frame, pairs) of the first frame whose left arm meets his body, the headset or the cup."""
    for f in frames:
        n = sum(arm_pairs(rig, f).values())
        if n:
            return (f, n)
    return None


def overlaps(rig, pad, frames):
    padm = [o for o in pad.children_recursive if o.type == 'MESH']
    for f in frames:
        r = arm_pairs(rig, f, padm if f <= SHRINK[1] else ())
        n = sum(r.values())
        worst = ', '.join(f'{a.split("_", 1)[-1]}x{b.split("_", 1)[-1]} {v}' for (a, b), v in
                          sorted(r.items(), key=lambda x: -x[1])[:3])
        print(f'S05 overlaps f{f}: {n} {worst}', flush=True)


# ---------------------------------------------------------------- build

def build(args):
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    cam = camera()
    sc.camera = cam
    sc.frame_set(START)
    cam_rig = cam.matrix_world.translation - Vector(R.SYNERGY_POS)
    pad = P.padlock('s05_padlock', C.collection('S05_props'), (0, 0, 0), 0.0, hero=True)
    rig = stage_synergy(face_timeline(), cam, pad)
    # the post height that makes the contact a contact, the post, then the padlock's swing in the
    # pinch baked on every frame to contact
    pad.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    lv, lp = _world_mesh(list(pad.children_recursive), bpy.context.evaluated_depsgraph_get())
    lift_end = stage_post(rig, pad, lv, lp)
    pos, ax = rig.slot_world(CONTACT)
    if GRIP == 'face':
        baked = {f: padlock_matrix(rig, f) for f in range(START, CONTACT + 1)}
    else:
        baked = swing(rig, list(range(START, CONTACT + 1)))
    bake_matrices(pad, baked)
    low = lowest_along(pad, CONTACT, pos, ax)
    print(f'S05 the padlock\'s lowest point {low * 1000:+.1f} mm above the slot at contact', flush=True)
    # the shrink into the slot, from contact
    c = pos - ax * SINK
    M0 = baked[CONTACT]
    prev = pad.rotation_quaternion.copy()
    for f in range(CONTACT + 1, SHRINK[1] + 1):
        t = (f - SHRINK[0]) / (SHRINK[1] - SHRINK[0])
        s = SHRINK_END ** (t * t)
        Mw = Matrix.Translation(c) @ Matrix.Diagonal((s, s, s, 1.0)) @ Matrix.Translation(-c) @ M0
        key_matrix(pad, f, Mw, prev)
    linear_keys(pad, START, SHRINK[1])
    for o in [pad] + list(pad.children_recursive):
        for f, hide in ((START, False), (SHRINK[1] + 1, True)):
            o.hide_render = hide
            o.keyframe_insert('hide_render', frame=f)
    rig.cup_handle.slot_glow(GLOW, dur=6)
    frame_shot(cam, rig, pad)
    # focus: between the padlock at the chin and the face screen (an empty, so the push keeps it)
    sc.frame_set(STUDY[1])
    fp = (baked[STUDY[1]] @ Vector((0.0, 0.0, 0.03))).lerp(rig.screen_point(0.5, 0.45), 0.55)
    foc = C.empty('s05_focus', None, tuple(fp))
    cam.data.dof.focus_object = foc
    lights(room, rig, pad, cam, baked[STUDY[1]])
    glint(rig, cam)
    room.front_bokeh(cam, frame=470, **BOKEH)
    room.render_budget(kind='macro', samples=args.samples or None, locked=True)
    room.compositor()
    room.tune_scanlines(cam)
    sc.view_settings.exposure = 0.0
    border = os.environ.get('S05_BORDER')
    if border:                                  # x0,x1,y0,y1 (0..1, y up): a crop for quick checks
        x0, x1, y0, y1 = (float(v) for v in border.split(','))
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        sc.render.border_min_x, sc.render.border_max_x = x0, x1
        sc.render.border_min_y, sc.render.border_max_y = y0, y1
    print(f'S05 BUILD {time.time() - t0:.1f}s', flush=True)
    if DIAG:
        report(rig, cam, pad)
        overlaps(rig, pad, [START, 437, 441, RISE[1], 470, 502, 504, 506, CONTACT, 511, lift_end, 522, 524,
                            526, END])
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
