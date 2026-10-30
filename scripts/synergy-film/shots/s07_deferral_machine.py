"""S07 · f609-752 · E2_LONG_ROOM (lit): the deferral machine.

    blender -b --factory-startup -P shots/s07_deferral_machine.py -- --quality proof --only 609,625,641,657,673,681,689,697,705,712,721,729,745,752
    blender -b --factory-startup -P shots/s07_deferral_machine.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s07_deferral_machine.py -- --quality final
    S07_DIAG=1 [S07_DIAG_FRAMES=a,b,..] ... --no-render   per-frame clearance report (arm x body, problem x
                                                         hand/body/cup, hand x walnut, glides x hub)
    S07_BORDER=x0,x1,y0,y1 ...                           render a crop (quick checks)

One continuous shot. Problems glide up the walnut to the host and arrive on the beat; for each
one his left index stops it, the mouth row gives one sweep, and the hand posts it through the
sip slot. Nothing else on him moves: head, torso and the cup in the right hand are locked.

Beats (film frames; 90 BPM, 16 frames a beat; TREATMENT.md S07). B = the arrival frame:
  normal time, one problem a beat (16-frame cycle)
    f609 Linda's glass zero   f625 Keys' envelope (spinning flat, a frisbee, 1.25 turns)
    f641 Strategy's tabs      f657 People & Culture's envelope
      B-1        the index is planted on the walnut; on B the problem stops dead against it (it
                 arrives at 1.2 m/s: stopped, not coasting to rest)
      B+2        the mouth sweep starts (1.8 LEDs a frame: the head reaches LED 22 on B+14)
      B+3        the pinch closes on the problem's near edge; B+3..B+10 it is lifted, carried and
                 brought straight down the slot axis on one eased curve, turning in the fingers from
                 flat to hanging (face to the lens) and, from B+5, shrinking in them so all of it
                 clears the lid: contact on B+10
      B+10..B+15 released at contact, it contracts toward the slot (staying over the lid) and
                 drops in; gone on B+16 (the plip, the next beat), the amber pulse in the slot
      B+10..B+15 the empty hand goes back down; the index is planted again on B+15
  double time, one problem every 8 frames (no wasted motion)
    f673 Arjun's tabs   f681 Operations' envelope   f689 Synthia's envelope   f697 Strategy's tabs
      B-1 planted, B the stop, B+1 the pinch, B+1..B+4 lifted and carried, contact on B+4,
      B+4..B+7 the shrink (gone on B+8: the plip), B+4..B+7 the hand goes back down; a 6-frame
      sweep B+1..B+7
  the binder
    f701-708  the hand comes back to his side and waits; the droid rolls up beside his left hip
              and makes its measured stop on f712 (env_room's path: up its lane, round behind the
              head of the table, down to the hand-off), the cobalt binder on its reams
    f713-720  the hand goes to the binder: a claw over its near edge, the curled tips on the cover
    f721      he lifts it with one hand (the hand copy replaces the trolley's binder), f722-723 the
              arm sags 3 cm with the weight, then up and over the cup by f729 (a half turn on the
              way); one slow full sweep of the mouth, 1 LED a frame, f722-744
    f729-737  it folds like a concertina (a lattice, 4 crisp pleats rising from its underside),
              closing onto the slot; the hand rides the edge it holds, squeezing it shut
    f738-744  he lets go; the closed block contracts into the slot; gone on f745 (the plop)
    f737-752  the droid reverses out the way it came; f745-752 the hand goes to rest, mouth idle
The colleague whose problem it is flares 60% for 8 frames as it glides in (B-6..B+2) and lights him
in its own colour (a soft card on the line from his chest to the screen, driven by the screen):
burgundy, cobalt, acid yellow, pink, lime, orange, ivory, acid yellow. Their colour discs hang in
the dark beyond him (Room.front_bokeh, the far wall hidden from the lens) and flare with them. No
blink. Also: the slab's warm walnut bounce on his lower torso, the skylight's cool spill off the
head wall on his crown and shoulder caps, the amber slot pulse on the lid and fingertips.

Camera: env_room's approved 's07_profile_lane' position and side (from his LEFT, down-table and
outboard at (2.85, -1.75); him at frame right in three-quarter, face ~55 deg to the lens, the
walnut receding frame left, the cup on his far side), at the treatment's 1.55 m and 35 mm instead
of 1.72 m and 26 mm, so he, the mouth sweeps and the posting read; f/5.6. The treatment's slow arc,
eased over the whole shot: 12 deg down-table and 0.25 m outward round him (face 55 -> 43 deg).
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

V = Vector
SHOT = 's07'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ---------------------------------------------------------------- the beats (film frames)
# (colleague, prop index, kind, arrival frame, double time?)
OBJECTS = [('linda', 0, 'zero', 609, False), ('keys', 0, 'envelope', 625, False),
           ('strategy', 0, 'tabs', 641, False), ('people', 0, 'envelope', 657, False),
           ('arjun', 0, 'tabs', 673, True), ('operations', 0, 'envelope', 681, True),
           ('synthia', 0, 'envelope', 689, True), ('strategy', 1, 'tabs', 697, True)]
# cycle offsets from the arrival B: (grip, lift end, contact, gone, next plant)
NORMAL = dict(grip=3, lift=7, contact=10, gone=16, plant=15, sweep=2, sweep_speed=43.2, sweep_end=16)
DOUBLE = dict(grip=1, lift=2, contact=4, gone=8, plant=7, sweep=1, sweep_speed=88.0, sweep_end=8)
FLARE_LEAD = 6                  # a colleague flares from B-6 for 8 frames (rims him as its problem glides in)
SPIN = {'keys': 540.0}          # the frisbee: turns 1.5 times flat on its glide
GLIDE_SPEED = 7.0               # m/s cruise up the walnut
ARRIVE_SPEED = 1.2              # m/s left when it meets the finger: it is stopped, it does not coast to rest
APPROACH_RUN = 1.4              # metres of straight run up the stop's lane at the end of every glide
TURN_DONE = 0.8                 # turns and spins are over by this fraction of the glide
REST_AT = 708                   # after the last post the hand is back at his side by here, waiting for the droid
BINDER_REACH = (713, 720)       # to the binder's spine
BINDER_LIFT = 721               # the weight dip f721-723 (3 cm), then up to the lid
BINDER_DIP = 0.03
BINDER_AT_LID = 729
SQUEEZE = (729, 744)            # the accordion squeeze through the slot; gone on f745 (plop)
BINDER_SWEEP = (722, 746)       # one slow full sweep, ~1 LED a frame
HAND_REST = (745, 752)
DROID_STOP = 712
WAIT_WRIST = (0.27, -0.33, 0.93)   # chest-rest space: the hand waits beside his left hip, in front of the trolley
BINDER_IN = 0.05                # he takes the binder this far in from its edge
BINDER_CURL = 0.45              # a claw: fingers over the edge, the curled tips on the cover
BINDER_PITCH = 0.9              # the fingers reach over the edge this steeply (tan of the angle down)
BINDER_LIFT_OFF = 0.004         # the palm's underside this far over the cover
BINDER_CHEST = 0.21             # world y of the binder's far edge over the cup (his chest plates start ~0.25)
BINDER_CLEAR = 0.004            # its underside over the slot
ACCORDION_PANELS = 4            # pleats across the binder (big ones: they read at this distance)
ACCORDION_CLOSE = 0.24          # the bellows close to this fraction of the width
ACCORDION_FRAMES = 8            # f729-737 the folds close
BINDER_RELEASE = 738            # he lets go of the closed concertina over the slot
DROID_OUT = 737

# ---------------------------------------------------------------- held objects
# per kind: pinch gap (thumb to index pads), the grip point and axes in the object's own space
# (origin at its bottom centre): `edge` = the edge he takes it by (it leads on the glide), as a
# local direction from the centre; `thin` = its thin axis (across the pinch)
HOLD = {
    'envelope': dict(gap=0.010, edge=V((0.0, -1.0, 0.0)), thin=V((0.0, 0.0, 1.0))),
    'tabs': dict(gap=0.024, edge=V((0.0, -1.0, 0.0)), thin=V((0.0, 0.0, 1.0))),
    'zero': dict(gap=0.034, edge=V((0.0, -1.0, 0.0)), thin=V((0.0, 0.0, 1.0))),
}
POST_LENS_MAX = 35.0            # posting hand frames tried: pinch axis within this of the line to the lens
POST_LENS_FRAMES = 60           # ... the best this many
POST_LENS_W = 0.004             # score per degree off the lens line
HANG_SIZE_W = 30.0              # score per unit of shrink the hang needs at contact (bigger reads better)
HANG_TOP = 0.02                 # nothing of it more than this above the pinch (clear of his chin)
HANG_OUT = 55.0                 # degrees the hanging problem leans from straight down toward frame left
HANG_MAX = 80.0                 # ... and never more than this from straight down
POST_H = 0.040                  # pinch point over the slot at contact (+ the pinch gap): the problem still
                                # reads as it goes in
POST_CLEAR = 0.002              # nothing of the problem below the slot plane + this over the cup
SHRINK_FROM = (5, 3)            # frames before contact the problem starts to shrink in the pinch (normal, double)
LIFT_H = (0.16, 0.10)           # first rise of the lift (normal, double)
APPROACH = (0.12, 0.08)         # last stretch straight down the slot axis (curve handle)
SHRINK_END = 0.02
SINK = 0.006                    # the shrink converges this far under the slot plane
GRIP_RAISE = 0.010              # the pinch closes this far above the object's near edge on the walnut
CORNER_IN = 0.018               # a corner grip sits this far in from the corner

# ---------------------------------------------------------------- camera
# env_room's approved 's07_profile_lane' sits at (2.85, -1.75, 1.72), 26 mm, yaw 163, pitch -13; this
# shot keeps its position and side, at the treatment's 1.55 m and 35 mm, so he and the posting read
CAM0 = dict(loc=(2.85, -1.75, 1.55), yaw=152.5, pitch=-7.5)
ARC_DEG = 12.0                  # down-table and outward round him over the shot (face 55 -> 43 deg to the lens)
ARC_OUT = 0.25                  # metres further out at the end
LENS, FSTOP, FOCUS = 35.0, 5.6, 3.4

# ---------------------------------------------------------------- light
BOUNCE_E = 3.5
BACK_E = (55.0, 35.0)
RIM_E, RIM_BASE, RIM_DIST, RIM_Z, RIM_SIZE = 24.0, 0.04, 2.4, 1.35, 0.6
AMBER_E = 1.0
BOKEH = dict(seed=5, n=8, region=(0.03, 0.97, 0.58, 0.95), disc_px=(36.0, 110.0))
BOKEH_FRAME = 681               # the discs are placed for the camera mid-arc (clear of his head at both ends)

DIAG = bool(os.environ.get('S07_DIAG'))
_opts = json.loads(os.environ.get('S07_OPTS', '{}') or '{}')
for _k, _v in _opts.items():
    globals()[_k] = tuple(_v) if isinstance(_v, list) else _v

HAND_L = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]
ARM_L = ['shoulder_L', 'upperarm_L', 'forearm_L'] + HAND_L


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def bezier(p0, p1, p2, p3, t):
    a = p0.lerp(p1, t)
    b = p1.lerp(p2, t)
    c = p2.lerp(p3, t)
    return a.lerp(b, t).lerp(b.lerp(c, t), t)


def key_matrix(obj, f, Mw, prev=None, interp='LINEAR'):
    loc, rot, sca = Mw.decompose()
    if prev is not None and rot.dot(prev) < 0:
        rot.negate()
    obj.location = loc
    obj.rotation_quaternion = rot
    obj.scale = sca
    for path in ('location', 'rotation_quaternion', 'scale'):
        obj.keyframe_insert(path, frame=f)
    ad = obj.animation_data
    for fc in C.fcurves(ad.action):
        if fc.data_path in ('location', 'rotation_quaternion', 'scale'):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - f) < 1e-3:
                    kp.interpolation = interp
    return rot


# ---------------------------------------------------------------- the room's side of the film

def room_timeline(room):
    """env_room.demo_timeline's events that touch f609-752, and this shot's own: the flares, the
    glides, the droid's hand-off and reverse-out, the printer far down the room."""
    pr = room.printer
    for f in (577, 641, 705, 769):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = R.ROOM['droid_lane_x']
    x0, y0 = R.ROOM['droid_start']
    d.place(299, x0, y0, R.ROOM['droid_start_heading'])
    d.drive(300, DROID_STOP, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + R.droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)
    d.drive(DROID_OUT, 985, R.droid_exit_path(lane), reverse=True, ease='cruise', accel=0.06)
    room.key_visible(room.props['kevin'][0], 433, False)      # in Offline since S05
    T = room.terminals
    for nm, i, kind, B, dbl in OBJECTS:
        T[nm].flare(B - FLARE_LEAD, dur=8)


# ---------------------------------------------------------------- the glides

def glide_progress(n_frames, length):
    """Distance travelled (0..length) per frame index 0..n of a glide that accelerates, cruises
    and decelerates to ARRIVE_SPEED, then stops dead on its last frame."""
    v = GLIDE_SPEED / 24.0              # metres per frame
    ve = ARRIVE_SPEED / 24.0
    # accelerate over the first 30% of the frames, decelerate over the last 35%, scale so the
    # integral is `length` (piecewise-linear speed, integrated per frame)
    n = n_frames
    sp = []
    for i in range(n):
        t = (i + 0.5) / n
        if t < 0.3:
            s = v * smoother(t / 0.3)
        elif t > 0.65:
            s = ve + (v - ve) * (1.0 - smoother((t - 0.65) / 0.35))
        else:
            s = v
        sp.append(s)
    k = length / sum(sp)
    out = [0.0]
    for s in sp:
        out.append(out[-1] + s * k)
    return out


def glide_frames(length):
    """Frames a glide of `length` metres takes (cruise GLIDE_SPEED with the ramps)."""
    return max(8, int(round(length / (GLIDE_SPEED / 24.0) / 0.78)))


def table_matrix(obj, xy, yaw):
    z = obj.location.z
    return Matrix.Translation((xy[0], xy[1], z)) @ Matrix.Rotation(yaw, 4, 'Z')


def glide_curve(a, b):
    """Plan path of a glide: a quadratic curve from the problem's home that straightens into the
    lane of the stop for its last stretch, so every problem makes the same final run up the
    walnut to the finger (clear of the hub). Returns (points, cumulative lengths)."""
    L0 = (b - a).length
    k = min(APPROACH_RUN, 0.45 * L0)
    c = V((b.x, b.y - k))
    pts = []
    for i in range(401):
        u = i / 400
        pts.append(a * (1 - u) ** 2 + c * 2 * u * (1 - u) + b * u * u)
    cum = [0.0]
    for p0, p1 in zip(pts, pts[1:]):
        cum.append(cum[-1] + (p1 - p0).length)
    return pts, cum


def _at(pts, cum, d):
    import bisect
    d = min(max(d, 0.0), cum[-1])
    i = max(1, min(len(cum) - 1, bisect.bisect_left(cum, d)))
    t = (d - cum[i - 1]) / max(1e-9, cum[i] - cum[i - 1])
    return pts[i - 1].lerp(pts[i], t)


def key_glide(obj, B, start_xy, end_xy, yaw0, yaw1):
    """Glide on the walnut from start_xy to end_xy, arriving (stopping dead) on frame B; keyed every
    frame (LINEAR) so motion blur sees the true speed. Any turn is done by TURN_DONE of the way, so
    the last run is straight. Returns the launch frame."""
    a, b = V(start_xy), V(end_xy)
    pts, cum = glide_curve(a, b)
    L = cum[-1]
    n = glide_frames(L)
    prog = glide_progress(n, L)
    f0 = B - n
    prev = None
    obj.rotation_mode = 'QUATERNION'
    key_matrix(obj, f0 - 1, table_matrix(obj, a, yaw0))
    for i in range(n + 1):
        e = prog[i] / L
        p = _at(pts, cum, prog[i])
        ty = smoother(min(1.0, e / TURN_DONE))
        prev = key_matrix(obj, f0 + i, table_matrix(obj, p, yaw0 + (yaw1 - yaw0) * ty), prev)
    return f0


# ---------------------------------------------------------------- Synergy

def hand_D(rig, f):
    """Hand-rest space -> world at frame f."""
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ae = rig.arm.evaluated_get(dg)
    return ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()


def rig_to_world(rig):
    return Matrix.Translation(V(R.SYNERGY_POS))


class Hand:
    """The left hand's performance, keyed every frame from a few solved anchor poses: the wrist
    travels on eased curves, the hand frame slerps, the elbow pole and shoulder offsets blend."""

    def __init__(self, rig):
        self.rig = rig
        self.keys = {}          # frame -> (wrist, u, w, pole, shoulder) in chest-rest space
        self.fixed = 0

    def put(self, f, wrist, u, w, pole, shoulder, interp='LINEAR', clear=True):
        """Key the arm; when the blended elbow pole / shoulder would put the arm into his chest,
        head or shoulder cap (the rig's own clearance model), search nearby ones, preferring the
        smallest change (so the elbow does not pop between frames)."""
        rig = self.rig
        wrist, u, w, pole, shoulder = V(wrist), V(u), V(w), V(pole), V(shoulder)
        if clear:
            pole, shoulder = self.clear(wrist, u, w, pole, shoulder)
        rig.place_arm(f, 'L', wrist, u, w, pole, interp, shoulder=tuple(shoulder))
        self.keys[f] = (wrist, u, w, pole, shoulder)

    def penetration(self, wrist, u, w, pole, shoulder):
        rig = self.rig
        Rsh, Ru, Rf, Rh = rig._arm_solution('L', wrist, u, w, pole, tuple(shoulder))
        chain = rig._arm_chain('L', Rsh, Ru, Rf, Rh)
        Dp = rig._pauldron_delta('L', chain, Ru)
        pen = rig._penetration(rig._arm_samples('L', chain, None, skip_tips=True), None, side='L', Dsh=Dp)
        th = rig._builder_hulls.get('torso')
        if th is not None:
            for q in rig._pauldron_pts.get('L', ()):
                dq = th.sdf(Dp @ q) - 0.003
                if dq < 0:
                    pen += dq * dq * 10.0
        return pen

    def clear(self, wrist, u, w, pole, shoulder):
        if self.penetration(wrist, u, w, pole, shoulder) <= 1e-7:
            return pole, shoulder
        best = None
        for dp in ((0, 0, 0), (1, 0, 0), (1, 0, -0.5), (1, 0.5, 0), (1, -0.5, 0), (0.5, 0.5, -0.5), (0, 0, -1),
                   (0, 1, 0), (0, -1, 0), (1, 0, 0.5)):
            for k in (0.25, 0.5, 0.9, 1.5):
                p = (pole + V(dp) * k).normalized() if V(dp).length else pole
                for dsh in ((0, 0, 0), (6, 0, 0), (0, 4, 0), (12, 2, 0), (-6, 0, 0), (18, 4, 0)):
                    sh = shoulder + V(dsh)
                    pen = self.penetration(wrist, u, w, p, sh)
                    score = pen * 1e4 + (p - pole).length * 0.02 + (sh - shoulder).length * 0.002
                    if best is None or score < best[0]:
                        best = (score, p, sh, pen)
                if not V(dp).length:
                    break
        self.fixed += 1
        return best[1], best[2]

    def fingers(self, f, fingers, thumb, interp='LINEAR'):
        self.rig.pose(f, interp, fingers_L=fingers, thumb_L=thumb)

    @staticmethod
    def blend(a, b, t):
        qa = S.frame3(a[1], a[2]).to_quaternion()
        qb = S.frame3(b[1], b[2]).to_quaternion()
        if qa.dot(qb) < 0:
            qb.negate()
        Rm = qa.slerp(qb, t).to_matrix()
        pole = a[3].lerp(b[3], t).normalized()
        sh = a[4].lerp(b[4], t)
        return Rm.col[0].copy(), Rm.col[1].copy(), pole, sh

    def move(self, f0, f1, a, b, path=None, ease=smoother, rot_ease=None):
        """Key frames f0+1..f1 from pose a (at f0) to pose b (at f1); `path(t)` gives the wrist
        (default: a straight eased line)."""
        for f in range(f0 + 1, f1 + 1):
            t = (f - f0) / (f1 - f0)
            e = ease(t)
            u, w, pole, sh = self.blend(a, b, (rot_ease or ease)(t))
            wrist = path(e) if path is not None else a[0].lerp(b[0], e)
            self.put(f, wrist, u, w, pole, sh)


def sol_pose(sol):
    return (V(sol['wrist']), V(sol['u']), V(sol['w']), V(sol['pole']), V(sol['shoulder']))


def pinch_offset(rig, u, w, gap):
    """Wrist -> pinch point (chest-rest space) for a hand frame (u, w)."""
    hd = rig.hands['L']
    Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
    return Rt @ (rig.thumb_pinch('L', gap=gap)['point'] - hd['W'])


# ---------------------------------------------------------------- face

def face_timeline():
    tl = F.FaceTimeline(START, END)
    for nm, i, kind, B, dbl in OBJECTS:
        c = DOUBLE if dbl else NORMAL
        tl.wave(B + c['sweep'], speed=c['sweep_speed'], end=B + c['sweep_end'], fade=2 if dbl else 3)
    tl.wave(BINDER_SWEEP[0], speed=24.0, end=BINDER_SWEEP[1], fade=3)
    return tl


# ---------------------------------------------------------------- object geometry

def local_points(obj):
    """Vertices of obj and every mesh under it, in obj's own space (at its current pose)."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    Mi = obj.matrix_world.inverted()
    out = []
    for o in [obj] + list(obj.children_recursive):
        if o.type != 'MESH' or o.name.endswith('_caustic'):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        Mw = Mi @ ev.matrix_world
        out.extend(Mw @ v.co for v in me.vertices)
        ev.to_mesh_clear()
    return out


def local_mesh(obj):
    """(verts, polys) of obj and every mesh under it, in obj's own space (for BVH checks)."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    Mi = obj.matrix_world.inverted()
    vs, ps = [], []
    for o in [obj] + list(obj.children_recursive):
        if o.type != 'MESH' or o.name.endswith('_caustic'):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        Mw = Mi @ ev.matrix_world
        k = len(vs)
        vs.extend(Mw @ v.co for v in me.vertices)
        ps.extend(tuple(i + k for i in p.vertices) for p in me.polygons)
        ev.to_mesh_clear()
    return vs, ps


def grip_point(pts, edge):
    """The middle of the object's edge in direction `edge` (local XY), at the mid height of
    the material along that edge."""
    m = max(p.dot(edge) for p in pts)
    near = [p for p in pts if p.dot(edge) > m - 0.006]
    z0, z1 = min(p.z for p in near), max(p.z for p in near)
    return edge * m + V((0.0, 0.0, 0.5 * (z0 + z1)))


def wrap_angle(a):
    return math.atan2(math.sin(a), math.cos(a))


# ---------------------------------------------------------------- the machine

class Machine:
    """Builds the whole left-hand performance and the problems' paths."""

    def __init__(self, room, rig):
        self.room, self.rig = room, rig
        self.hand = Hand(rig)
        self.sp = V(R.SYNERGY_POS)
        self.log = []
        self.obj = {}            # object name -> its stash (local points, grip, stop matrix, ...)


    def chest(self, p):
        return V(p) - self.sp

    def world(self, p):
        return V(p) + self.sp

    # ---- anchor poses
    def reach(self):
        if not hasattr(self, '_reach'):
            rig = self.rig
            tip = self.chest(R.ROOM['fingertip_L'])
            sol = rig._reach_solution(tip, R.TABLE_TOP - self.sp.z)
            self._reach = sol
        return self._reach

    def key_reach(self, f, interp='LINEAR'):
        sol = self.reach()
        self.hand.put(f, sol['wrist'], sol['u'], sol['w'], sol['pole'], sol['shoulder'], interp)
        self.hand.fingers(f, sol['fingers'], S.REACH_THUMB, interp)

    def reach_pose(self):
        return sol_pose(self.reach())

    # ---- the post, turned to the lens
    def post_lens(self, f, height, gap, cam_pos):
        """The rig's posting pose (pinch `height` over the sip slot, nothing of the hand below the lid
        top + 3 mm, clear of chest, head and cup), searched over a wider fan of hand frames and
        preferring a pinch axis along the line to the lens: the problem then hangs face-on to the
        camera. Keys the arm and the pinch at f; returns the solution (chest-rest space)."""
        rig = self.rig
        pos, ax, across = rig.slot_frame_world(f)
        Dc = rig._chest_delta(f)
        tgt = Dc @ (pos + ax * height)
        axr = (Dc.to_3x3() @ ax).normalized()
        cup_base = Dc @ rig._cup_base_world(f, pos, ax, across)
        lens = (Dc.to_3x3() @ (V(cam_pos) - pos)).normalized()
        key = ('post_lens', tuple(round(x, 4) for x in tgt), round(gap, 4), tuple(round(x, 2) for x in lens))
        sol = rig._grip.get(key)
        if sol is None:
            pin = rig.thumb_pinch('L', gap=gap)
            fingers = rig.finger_angles('L', 'pinch')
            hd = rig.hands['L']
            A_rest = (pin['thumb_tip'] - pin['tip']).normalized()
            frames = []
            for el in (30, 42, 54, 66, 78):
                for az in range(60, 331, 15):
                    e, a_ = math.radians(el), math.radians(az)
                    hu = V((math.cos(e) * math.cos(a_), math.cos(e) * math.sin(a_), -math.sin(e)))
                    side = hu.cross(V((0, 0, 1))).normalized()
                    for roll in range(-90, 91, 15):
                        hw = Matrix.Rotation(math.radians(roll), 3, hu) @ side
                        Rt = S.frame3(hu, hw) @ S.frame3(hd['u'], hd['w']).transposed()
                        ang = math.degrees(math.acos(min(1.0, abs((Rt @ A_rest).dot(lens)))))
                        if ang < POST_LENS_MAX:
                            frames.append((hu, hw, ang))
            frames.sort(key=lambda x: x[2])
            frames = frames[:POST_LENS_FRAMES]
            angs = {(tuple(round(c, 5) for c in hu), tuple(round(c, 5) for c in hw)): a for hu, hw, a in frames}
            lim = S.LID_TOP + 0.003

            def prefer(hu, hw, pole, sh, chain):
                pen = 0.0
                for p_, r, part in rig._arm_samples('L', chain, fingers, thumb=pin['rot']):
                    if part not in ('palm', 'finger', 'tip', 'thumb', 'wrist'):
                        continue
                    rel = p_ - cup_base
                    hh = rel.dot(axr)
                    if (rel - axr * hh).length < S.LID_R + 0.008 + r:
                        d = hh - r - lim
                        if d < 0:
                            pen -= d * 2000.0
                a = angs.get((tuple(round(c, 5) for c in hu), tuple(round(c, 5) for c in hw)), 90.0)
                return pen + a * POST_LENS_W
            poles = [V((0.6, -0.6, -0.5)), V((0.9, -0.2, -0.4)), V((0.3, -0.9, -0.3)), V((0.8, -0.5, 0.0)),
                     V((0.5, -0.4, -0.8))]
            shoulders = [(0, 0, 0), (12, 0, 0), (22, 3, 0), (32, 5, 0), (16, 8, 0), (8, 6, 0)]
            sol = rig.solve_arm_clear('L', tgt, [(a, b) for a, b, _ in frames], poles, shoulders, fingers=fingers,
                                      cup=(cup_base, axr), point_local=pin['point'], thumb=pin['rot'], prefer=prefer)
            Rt = S.frame3(sol['u'], sol['w']) @ S.frame3(hd['u'], hd['w']).transposed()
            sol['lens_deg'] = math.degrees(math.acos(min(1.0, abs((Rt @ A_rest).dot(lens)))))
            rig._grip[key] = sol
            print(f'S07 post to the lens: pinch axis {sol["lens_deg"]:.0f} deg off the lens line, pen {sol["pen"]:.5f}, '
                  f'reach {sol["reach"] * 1000:.1f} mm ({len(frames)} hand frames)', flush=True)
        rig.place_arm(f, 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], 'LINEAR', shoulder=sol['shoulder'])
        rig.pose(f, 'LINEAR', fingers_L='pinch', thumb_L=('pinch', gap))
        return sol

    # ---- held-object transforms
    def hang_matrix(self, f, kind, grips, cam_pos, mesh):
        """World matrix of a problem hanging from the pinch at frame f, and the grip point used:
        its thin axis across the pinch, held at one of `grips` (local points on its near edge: the
        middle, or near either corner), hanging in the direction (in the plane across the pinch,
        never more than HANG_MAX from straight down) that keeps it clear of the fingers, leaning
        toward the lens."""
        from mathutils.bvhtree import BVHTree
        rig = self.rig
        h = HOLD[kind]
        pin = rig.thumb_pinch('L', gap=h['gap'])
        D = hand_D(rig, f)
        P = D @ pin['point']
        A = (D.to_3x3() @ (pin['thumb_tip'] - pin['tip'])).normalized()
        pos, ax = rig.slot_world(f)
        e_l = V(h['edge']).normalized()
        t_l = V(h['thin']).normalized()
        b_l = -e_l
        c_l = t_l.cross(b_l)
        Ml = Matrix((b_l, t_l, c_l)).transposed()             # columns: body, thin, third (local)

        def frame(hdir, thin, g):
            c_w = thin.cross(hdir)
            Mw = Matrix((hdir, thin, c_w)).transposed()
            return Matrix.Translation(P) @ (Mw @ Ml.inverted()).to_4x4() @ Matrix.Translation(-g)
        down = -ax
        d0 = (down - A * down.dot(A)).normalized()
        if not hasattr(self, '_hand_tree') or self._hand_tree[0] != f:
            sc = bpy.context.scene
            sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()

            def tree_of(objs):
                hv, hp = [], []
                for o in objs:
                    if o.type != 'MESH':
                        continue
                    ev = o.evaluated_get(dg)
                    me = ev.to_mesh()
                    k = len(hv)
                    hv += [ev.matrix_world @ v.co for v in me.vertices]
                    hp += [tuple(i + k for i in p.vertices) for p in me.polygons]
                    ev.to_mesh_clear()
                return BVHTree.FromPolygons(hv, hp)
            body = rig.parts_on_bones(['chest', 'neck', 'head', 'spine', 'badge', 'upperarm_R', 'forearm_R', 'hand_R',
                                       'upperarm_L', 'forearm_L'] +
                                      [f'{n}_{i}_R' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)])
            body += [o for o in rig.cup_objects() if o.type == 'MESH']
            body += [o for o in rig.headset.children_recursive if o.type == 'MESH'] if rig.headset else []
            self._hand_tree = (f, tree_of(rig.parts_on_bones(HAND_L)), tree_of(body))
        tree, btree = self._hand_tree[1], self._hand_tree[2]
        vs, ps = mesh
        # hanging out over the front of the cup, to the frame-left of it, it reads against the dark
        # room instead of the cream chest plates behind the cup
        tc = V(cam_pos) - P
        lens = tc.normalized()
        right = lens.cross(V((0.0, 0.0, 1.0)))            # the frame's right, horizontal
        side = V((-right.x, -right.y, 0.0)).normalized()  # frame-left
        want = (down * math.cos(math.radians(HANG_OUT)) + side * math.sin(math.radians(HANG_OUT))).normalized()
        best = None
        for gi, g in enumerate(grips):
            for sgn in (1.0, -1.0):
                thin = A * sgn
                for deg in range(0, 360, 10):
                    hdir = (Matrix.Rotation(math.radians(deg), 3, A) @ d0).normalized()
                    if hdir.dot(down) < math.cos(math.radians(HANG_MAX)):
                        continue                          # it hangs: never above the pinch
                    Mw = frame(hdir, thin, g)
                    wv = [Mw @ v for v in vs]
                    # the most of it that can hang there over the lid: shrunk toward the pinch until
                    # its lowest point clears the slot plane by POST_CLEAR
                    hP = (P - pos).dot(ax)
                    low = min((v - pos).dot(ax) for v in wv)
                    sc_ = min(1.0, max(0.05, (hP - POST_CLEAR) / max(1e-4, hP - low)))
                    wv = [P + (v - P) * sc_ for v in wv]
                    ot = BVHTree.FromPolygons(wv, ps)
                    n = len(tree.overlap(ot))
                    nb = len(btree.overlap(ot))
                    top = max((v - P).dot(ax) for v in wv)
                    off = math.degrees(hdir.angle(down))
                    score = (n * 2.0 + nb * 20.0 + max(0.0, top - HANG_TOP) * 3000.0 + (1.0 - sc_) * HANG_SIZE_W +
                             math.degrees(hdir.angle(want)) * 0.3 + (3.0 if gi else 0.0) +
                             (4.0 if thin.dot(lens) < 0 else 0.0))
                    if best is None or score < best[0]:
                        best = (score, Mw, g, n, round(off), gi, nb, round(top * 1000), sc_)
        self.log_hang = best[3:]
        return best[1], best[2], best[8]

    # ---- one problem
    def cycle(self, obj, o, nm, kind, B, dbl, cam_pos, nxt):
        rig, room = self.rig, self.room
        c = DOUBLE if dbl else NORMAL
        h = HOLD[kind]
        gap = h['gap']
        pts, M_T = o['pts'], o['M_T']
        f_grip, f_lift, f_con, f_gone = B + c['grip'], B + c['lift'], B + c['contact'], B + c['gone']
        Rp = self.reach_pose()
        # planted: B-1 .. grip-1 (the object stops against the index on B)
        for f in sorted({B - 1, f_grip - 1}):
            self.key_reach(f)
        # contact: the post (the pinch POST_H + gap over the slot); the problem hangs from the pinch,
        # clear of the fingers, and has shrunk in them on the way down so all of it clears the lid
        sol = self.post_lens(f_con, POST_H + gap, gap, cam_pos)
        Cp = sol_pose(sol)
        self.hand.fingers(f_con, 'pinch', ('pinch', gap))
        pos, ax = rig.slot_world(f_con)
        ax_c = ax.copy()
        M_C, g_l, s_hang = self.hang_matrix(f_con, kind, o['grips'], cam_pos, o['mesh'])
        # the pinch closes on that point of the near edge
        gw = M_T @ g_l
        g_c = self.chest(gw) + V((0.0, 0.0, GRIP_RAISE))
        wrist_g = g_c - pinch_offset(rig, Rp[1], Rp[2], gap)
        Gp = (wrist_g, Rp[1], Rp[2], Rp[3], Rp[4])
        self.hand.put(f_grip, *Gp)
        self.hand.fingers(f_grip, 'pinch', ('pinch', gap))
        # lift + carry: one eased curve from the grip, up off the walnut, round and down the slot axis
        lift_h = LIFT_H[1] if dbl else LIFT_H[0]
        p0, p3 = Gp[0], Cp[0]
        p1 = p0 + V((0.0, 0.0, lift_h))
        p2 = p3 + ax_c * (APPROACH[1] if dbl else APPROACH[0])
        self.hand.move(f_grip, f_con, Gp, Cp, path=lambda e: bezier(p0, p1, p2, p3, e),
                       ease=lambda t: smoother(t) if not dbl else t * t * (3 - 2 * t),
                       rot_ease=lambda t: smoother(min(1.0, t * 1.3)))
        # the problem rides in the pinch from the grip: it turns from flat to hanging, and from
        # SHRINK_FROM frames before contact it shrinks toward the pinch, never into the lid
        pin = rig.thumb_pinch('L', gap=gap)
        D_g = hand_D(rig, f_grip)
        D_c = hand_D(rig, f_con)
        rel_T = D_g.inverted() @ M_T
        rel_C = D_c.inverted() @ M_C
        lT, rT, _ = rel_T.decompose()
        lC, rC, _ = rel_C.decompose()
        if rT.dot(rC) < 0:
            rC.negate()
        hP = ((D_c @ pin['point']) - pos).dot(ax_c)
        lowC = min(((M_C @ p) - pos).dot(ax_c) for p in pts)
        s_c = s_hang
        print(f'S07 {nm} hang: grip {self.log_hang[2]}, {self.log_hang[1]} deg off straight down, {self.log_hang[0]} pairs with '
              f'the fingers, {self.log_hang[3]} with his body, top {self.log_hang[4]} mm over the pinch; '
              f'pinch {hP * 1000:.1f} mm over the slot, lowest {lowC * 1000:.1f} mm -> scale {s_c:.3f}', flush=True)
        f_sh = f_con - (SHRINK_FROM[1] if dbl else SHRINK_FROM[0])
        prev = None
        n = f_con - f_grip
        Mw = M_T
        for f in range(f_grip, f_con + 1):
            t = (f - f_grip) / n
            k = smoother(min(1.0, t * 1.25))
            D_f = hand_D(rig, f)
            Pf = D_f @ pin['point']
            ss = 1.0 if f <= f_sh else s_c ** smoother((f - f_sh) / (f_con - f_sh))
            for _ in range(10):
                rel = Matrix.Translation(lT.lerp(lC, k)) @ rT.slerp(rC, k).to_matrix().to_4x4()
                M0 = D_f @ rel
                Mw = Matrix.Translation(Pf) @ Matrix.Diagonal((ss, ss, ss, 1.0)) @ Matrix.Translation(-Pf) @ M0
                wp = [Mw @ p for p in pts]
                bad = min(p.z for p in wp) < R.TABLE_TOP + 0.0005 and k > 0.0
                # over the cup: nothing below the slot plane + POST_CLEAR
                near = [p for p in wp if ((p - pos) - ax_c * (p - pos).dot(ax_c)).length < 0.075]
                if near and min((p - pos).dot(ax_c) for p in near) < POST_CLEAR - 1e-4:
                    ss *= 0.75
                    continue
                if bad:
                    k *= 0.6
                    continue
                break
            if f == f_grip:
                Mw = M_T
            prev = key_matrix(obj, f, Mw, prev)
        M_con = Mw
        low = min(((M_con @ p) - pos).dot(ax_c) for p in pts)
        wp = [M_con @ p for p in pts]
        print(f'S07 {nm} at contact f{f_con}: scale {ss:.3f} k {k:.2f}; bbox '
              f'{tuple(round(min(p[j] for p in wp), 3) for j in range(3))} .. '
              f'{tuple(round(max(p[j] for p in wp), 3) for j in range(3))}', flush=True)
        # released at contact: it contracts toward the slot (staying over the lid) and drops in
        cc = pos + ax_c * low
        nsh = f_gone - 1 - f_con
        for f in range(f_con + 1, f_gone):
            t = (f - f_con) / nsh
            s = (SHRINK_END / s_c) ** (t ** 1.2) if s_c > SHRINK_END else 1.0
            drop = ax_c * (-(low + SINK) * smoother((t - 0.55) / 0.45))
            Mw = Matrix.Translation(cc + drop) @ Matrix.Diagonal((s, s, s, 1.0)) @ Matrix.Translation(-cc) @ M_con
            prev = key_matrix(obj, f, Mw, prev)
        ext = s_c
        room.key_visible(obj, f_gone, False)
        cau = bpy.data.objects.get(obj.name + '_caustic')
        if cau is not None:                         # the walnut's caustic stays on the walnut
            for f, hide in ((f_grip, False), (f_grip + 1, True), (f_gone - 1, True), (f_gone, True)):
                for path in ('hide_render', 'hide_viewport'):
                    setattr(cau, path, hide)
                    cau.keyframe_insert(path, frame=f)
        rig.cup_handle.slot_glow(f_gone - (3 if not dbl else 2), dur=4 if not dbl else 3)
        self.log.append((nm, kind, B, f_con, s_c, low))
        # back down to the walnut for the next one (or to his side after the last)
        if nxt is not None:
            f_pl = B + c['plant']
            wr = Rp[0]
            q0, q3 = Cp[0], wr
            q1 = q0 + ax_c * 0.06 + V((0.06, -0.02, 0.0))
            q2 = q3 + V((0.0, 0.03, 0.10))
            self.hand.move(f_con, f_pl, Cp, Rp, path=lambda e: bezier(q0, q1, q2, q3, e),
                           ease=lambda t: t * t * (3 - 2 * t), rot_ease=smoother)
            self.hand.fingers(f_pl, self.reach()['fingers'], S.REACH_THUMB)
        return Cp

    # ---- the binder and the rest pose
    def wait_pose(self, f):
        """After the last post: the hand back at his side, open, clear of the incoming trolley."""
        rig = self.rig
        if not hasattr(self, '_wait'):
            u = V((0.10, -0.25, -0.96)).normalized()
            w = V((0.95, 0.0, 0.10))
            w = (w - u * w.dot(u)).normalized()
            self._wait = rig.place_arm_clear(f, 'L', V(WAIT_WRIST), u, w, V((0.9, 0.3, -0.3)), 'LINEAR',
                                             fingers='relaxed')
        sol = self._wait
        self.hand.put(f, sol['wrist'], sol['u'], sol['w'], sol['pole'], sol['shoulder'])
        self.hand.fingers(f, 'relaxed', 0.3)
        return sol_pose(sol)

    def binder(self, cam_pos):
        """f713-744: to the binder on the trolley, the one-handed lift with its weight dip, over the
        cup, the accordion squeeze into the slot; then the hand goes to rest."""
        rig, room = self.rig, self.room
        sc = bpy.context.scene
        d = room.droid
        src = d.binder
        sc.frame_set(BINDER_REACH[1])
        Mb0 = src.matrix_world.copy()
        thick = float(src.get('binder_thickness', 0.085))
        # the hand copy, swapped in for the trolley's binder on the frame the hand takes it
        coll = C.collection('S07_props')
        b = P.binder('s07_binder', coll, (0.0, 0.0, 0.0), 0.0, thick=thick)
        b.rotation_mode = 'QUATERNION'
        prev = key_matrix(b, BINDER_REACH[1], Mb0)
        room.key_visible(src, BINDER_REACH[1] + 1, False)
        room.key_visible(b, BINDER_REACH[1] + 1, True)
        pts = local_points(b)
        x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
        y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
        R3 = Mb0.to_3x3()
        # the edge facing him (toward -X in the world): he takes it there, palm on the top cover
        cands = [(V((1, 0, 0)), x1), (V((-1, 0, 0)), -x0), (V((0, 1, 0)), y1), (V((0, -1, 0)), -y0)]
        e_l, half = min(cands, key=lambda c: (R3 @ c[0]).x)
        e_w = (R3 @ e_l).normalized()
        top = thick
        grip_l = e_l * (half - BINDER_IN) + V((0.0, 0.0, top + 0.009))     # the curled fingertips on the cover
        g_w = Mb0 @ grip_l
        hd = rig.hands['L']
        ang = {n: [a * BINDER_CURL for a in S.FIST] for n in ('index', 'middle', 'ring', 'pinky')}
        tip_l = rig.fingertip('L', 'middle', ang['middle'])

        def claw(e_world, target_world):
            """Hand frame and wrist for the claw on the cover: fingers reaching over the edge
            and down, the curled tips on the cover."""
            eh = V((e_world.x, e_world.y, 0.0)).normalized()
            u_ = (-eh + V((0.0, 0.0, -BINDER_PITCH))).normalized()
            dn = V((0.0, 0.0, -1.0))
            w_ = (dn - u_ * dn.dot(u_)).normalized()
            Rt_ = S.frame3(u_, w_) @ S.frame3(hd['u'], hd['w']).transposed()
            return u_, w_, self.chest(target_world) - Rt_ @ (tip_l - hd['W'])
        u, w, wrist = claw(e_w, g_w)
        sol_g = rig.place_arm_clear(BINDER_REACH[1], 'L', wrist, u, w, V((0.8, 0.2, -0.6)), 'LINEAR',
                                    fingers=ang)
        self.hand.fingers(BINDER_REACH[1], ang, 0.35)
        Gp = sol_pose(sol_g)
        print(f'S07 binder grip: reach miss {sol_g["reach"] * 1000:.1f} mm pen {sol_g["pen"]:.4f}', flush=True)
        self.log_binder = dict(sol=sol_g, grip=g_w)
        # ---- the hand's path: from waiting at his side to the cover (f713-720)
        Wp = self.wait_pose(REST_AT)
        self.hand.move(BINDER_REACH[0] - 1, BINDER_REACH[1], Wp, Gp,
                       path=lambda e: bezier(Wp[0], Wp[0] + V((0.03, 0.0, 0.10)), Gp[0] + V((0.0, 0.0, 0.10)), Gp[0], e))
        self.hand.fingers(BINDER_REACH[1] - 2, 'relaxed', 0.3)
        self.hand.fingers(BINDER_REACH[1], ang, 0.35)
        # ---- over the cup: flat, its bottom just over the slot, its far edge clear of his chest,
        # the edge he holds turned toward his left (a half turn on the way)
        pos, ax = rig.slot_world(BINDER_AT_LID)
        Rz = Matrix.Rotation(math.pi, 4, 'Z')
        Rl = Rz.to_3x3() @ R3                                   # binder axes at the lid
        Ml = Rl.to_4x4()
        wpts = [Ml @ p for p in pts]
        zmin = min(p.z for p in wpts)
        ymax = max(p.y for p in wpts)
        xs = [p.x for p in wpts]
        cx = 0.5 * (min(xs) + max(xs))
        cy_ = 0.5 * (min(p.y for p in wpts) + ymax)
        # far edge (toward his chest) at y = BINDER_CHEST; x centred on the slot
        tx = pos.x - cx
        ty = min(pos.y - cy_, BINDER_CHEST - ymax)
        tz = pos.z + BINDER_CLEAR - zmin
        M_lid = Matrix.Translation((tx, ty, tz)) @ Ml
        g_lid = M_lid @ grip_l
        e_lid = (M_lid.to_3x3() @ e_l).normalized()
        u_l, w_l, wrist_l = claw(e_lid, g_lid)
        sol_l = rig.place_arm_clear(BINDER_AT_LID, 'L', wrist_l, u_l, w_l, V((0.9, -0.2, -0.4)), 'LINEAR',
                                    fingers=ang)
        Lp = sol_pose(sol_l)
        print(f'S07 binder at the lid: reach miss {sol_l["reach"] * 1000:.1f} mm pen {sol_l["pen"]:.4f}', flush=True)
        # f721: a quick lift off the reams; f722-723 the arm sags 3 cm with the weight; then up and
        # over to the lid by f729 (keyed every frame on one curve)
        up = V((0.0, 0.0, 1.0))
        L1 = (Gp[0] + up * 0.045, Gp[1], Gp[2], Gp[3], Gp[4])
        L2 = (Gp[0] + up * (0.045 - BINDER_DIP), Gp[1], Gp[2], Gp[3], Gp[4])
        self.hand.move(BINDER_REACH[1], BINDER_LIFT, Gp, L1, ease=lambda t: t)
        self.hand.move(BINDER_LIFT, BINDER_LIFT + 2, L1, L2)
        a0, a3 = L2[0], Lp[0]
        a1 = a0 + V((0.0, 0.0, 0.25))
        a2 = a3 + V((0.12, -0.06, 0.10))
        self.hand.move(BINDER_LIFT + 2, BINDER_AT_LID, L2, Lp, path=lambda e: bezier(a0, a1, a2, a3, e),
                       rot_ease=smoother)
        self.hand.fingers(BINDER_AT_LID, ang, 0.35)
        # the binder rides under the palm f720-729
        D0 = hand_D(rig, BINDER_REACH[1])
        rel = D0.inverted() @ Mb0
        D1 = hand_D(rig, BINDER_AT_LID)
        rel1 = D1.inverted() @ M_lid
        l0, r0, _ = rel.decompose()
        l1, r1, _ = rel1.decompose()
        if r0.dot(r1) < 0:
            r1.negate()
        for f in range(BINDER_REACH[1] + 1, BINDER_AT_LID + 1):
            t = (f - BINDER_REACH[1]) / (BINDER_AT_LID - BINDER_REACH[1])
            k = smoother(t)
            relf = Matrix.Translation(l0.lerp(l1, k)) @ r0.slerp(r1, k).to_matrix().to_4x4()
            prev = key_matrix(b, f, hand_D(rig, f) @ relf, prev)
        self.binder_obj = (b, M_lid, pos, ax, pts)
        edge = self.accordion(b, M_lid, pos, ax, pts, e_l, grip_l, prev)
        # the hand rides the near edge in as the bellows close (it squeezes the concertina shut),
        # then lets go over the slot
        prevp = Lp
        for f in range(BINDER_AT_LID + 1, BINDER_RELEASE + 1):
            uu, ww, wr = claw(e_lid, edge[f])
            pose = (wr, uu, ww, prevp[3], prevp[4])
            self.hand.put(f, *pose)
            prevp = self.hand.keys[f]
        self.hand.fingers(BINDER_RELEASE, ang, 0.35)
        self.release = prevp
        return b

    def accordion(self, b, M_lid, pos, ax, pts, e_l, grip_l, prev):
        """The binder folds like a concertina (a lattice with crisp linear folds, keyed through a
        shape key) along the direction he holds it by, closing toward the slot: the pleats rise
        from its underside (nothing dips into the lid). Then the folded block contracts into the
        slot and is gone on f745 (the plop). Returns {frame: world point of the edge he holds}."""
        rig, room = self.rig, self.room
        xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
        lo = V((min(xs), min(ys), min(zs)))
        hi = V((max(xs), max(ys), max(zs)))
        size = hi - lo + V((0.004, 0.004, 0.004))
        ctr = (lo + hi) / 2
        fold_x = abs(e_l.x) > 0.5                       # fold along the axis he holds it by
        ai = 0 if fold_x else 1
        n = ACCORDION_PANELS + 1
        lat_d = bpy.data.lattices.new('s07_binder_lattice')
        lat_d.points_u = n if fold_x else 2
        lat_d.points_v = 2 if fold_x else n
        lat_d.points_w = 2
        for ax_ in ('u', 'v', 'w'):
            setattr(lat_d, f'interpolation_type_{ax_}', 'KEY_LINEAR')
        lat = bpy.data.objects.new('s07_binder_lattice', lat_d)
        C.collection('S07_props').objects.link(lat)
        lat.parent = b
        lat.location = ctr
        lat.scale = size
        lat.hide_render = True
        # the slot, in lattice units along the fold axis: the concertina closes onto it
        sl = M_lid.inverted() @ pos
        c_a = max(-0.5, min(0.5, (sl[ai] - ctr[ai]) / size[ai]))
        L = size[ai]
        panel = L / ACCORDION_PANELS
        amp = panel * math.sin(math.acos(ACCORDION_CLOSE)) / size.z
        lat.shape_key_add(name='Basis', from_mix=False)
        key = lat.shape_key_add(name='fold', from_mix=False)
        for i, pt in enumerate(lat_d.points):
            iu = i % lat_d.points_u
            iv = (i // lat_d.points_u) % lat_d.points_v
            k = iu if fold_x else iv
            co = V(pt.co)
            co[ai] = c_a + (co[ai] - c_a) * ACCORDION_CLOSE
            co.z = co.z + amp * (k % 2)
            key.data[i].co = co
        for o in b.children_recursive:
            if o.type == 'MESH':
                m = o.modifiers.new('accordion', 'LATTICE')
                m.object = lat
        kb = lat.data.shape_keys.key_blocks['fold']
        f0, f1 = SQUEEZE
        fold_end = f0 + ACCORDION_FRAMES
        vals = {}
        for f in range(f0 - 1, f1 + 2):
            vals[f] = smoother((f - f0) / (fold_end - f0))
            kb.value = vals[f]
            kb.keyframe_insert('value', frame=f)
        for fc in C.fcurves(lat.data.shape_keys.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
        # the edge he holds (lattice end k = 0: no pleat lift), deformed
        q = V([(grip_l[j] - ctr[j]) / size[j] for j in range(3)])
        # the folded block contracts toward the slot (it stays above the lid), then drops in
        low = BINDER_CLEAR
        cc = pos + ax * low
        nsh = f1 - fold_end + 2
        edge = {}
        for f in range(f0, f1 + 1):
            t = max(0.0, (f - (fold_end - 2)) / nsh)
            s_ = SHRINK_END ** (t ** 1.3)
            drop = ax * (-(low + SINK) * smoother((t - 0.7) / 0.3))
            Msq = Matrix.Translation(cc + drop) @ Matrix.Diagonal((s_, s_, s_, 1.0)) @ Matrix.Translation(-cc)
            if f > f0:
                prev = key_matrix(b, f, Msq @ M_lid, prev)
            qq = q.copy()
            qq[ai] = q[ai] + ((c_a + (q[ai] - c_a) * ACCORDION_CLOSE) - q[ai]) * vals[f]
            gl = V([ctr[j] + qq[j] * size[j] for j in range(3)])
            edge[f] = Msq @ M_lid @ gl
        room.key_visible(b, f1 + 1, False)
        rig.cup_handle.slot_glow(f1 - 2, dur=6)
        return edge


def prepare_objects(mc, cam_pos):
    """Grip points, arrival yaws and exact stops (against the posed hand) for every problem."""
    room, rig = mc.room, mc.rig
    sc = bpy.context.scene
    f_probe = START - 20
    mc.key_reach(f_probe)
    sc.frame_set(f_probe)
    hand = rig.parts_on_bones(HAND_L)
    tip = V(R.ROOM['fingertip_L'])
    for nm, idx, kind, B, dbl in OBJECTS:
        obj = room.props[nm][idx]
        obj.rotation_mode = 'QUATERNION'
        home = V(R.prop_home(nm, idx))
        yaw0 = obj.rotation_quaternion.to_euler('XYZ').z
        e_l = V(HOLD[kind]['edge'])
        pts = local_points(obj)
        d = V((0.0, 1.0))                                  # the last run is straight up the lane
        # the grip edge leads: R(yaw) @ edge = d
        yaw_e = math.atan2(e_l.y, e_l.x)
        yaw1 = math.atan2(d.y, d.x) - yaw_e
        turn = wrap_angle(yaw1 - yaw0)
        if nm in SPIN:
            turn += 2 * math.pi * round((math.radians(SPIN[nm]) - turn) / (2 * math.pi))
        yaw1 = yaw0 + turn
        obj.rotation_quaternion = Quaternion((0, 0, 1), yaw1)
        bpy.context.view_layer.update()
        lane0 = (tip.x, tip.y - APPROACH_RUN)
        stop = R.stop_for(kind if kind != 'zero' else 'glass_zero', obj=obj, start=lane0, hand=hand)
        obj.rotation_quaternion = Quaternion((0, 0, 1), yaw0)
        obj.location = (home.x, home.y, obj.location.z)
        bpy.context.view_layer.update()
        g_l = grip_point(pts, e_l)
        grips = [g_l]
        if kind == 'zero':                                 # the rim, or the tube's centre line
            grips.append(g_l - e_l * 0.0125)
        else:                                              # or near either corner of that edge
            t_l = V(HOLD[kind]['thin'])
            side = t_l.cross(e_l).normalized()
            half = max(p.dot(side) for p in pts)
            grips += [g_l + side * (half - CORNER_IN), g_l - side * (half - CORNER_IN)]
        M_T = table_matrix(obj, stop, yaw1)
        mc.obj[obj.name] = dict(pts=pts, mesh=local_mesh(obj), grips=grips, M_T=M_T, home=home, stop=V(stop),
                                                           yaw0=yaw0, yaw1=yaw1)
        print(f'S07 {nm:10s} {kind:8s} B{B}: home ({home.x:+.2f},{home.y:+.2f}) stop ({stop[0]:+.3f},{stop[1]:+.3f}) '
              f'turn {math.degrees(turn):+.0f} deg', flush=True)


# ---------------------------------------------------------------- build

def build(args):
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    rig = S.build(timeline=face_timeline(), location=R.SYNERGY_POS)
    for f in (START - 40, START - 20, END + 8):
        rig.apply_preset(f, 'idle_cup', 'LINEAR')
    print(f'S07 BUILD room+rig {time.time() - t0:.1f}s', flush=True)
    cam = camera()
    sc.camera = cam
    cam_pos = cam.matrix_world.translation.copy()
    mc = Machine(room, rig)
    prepare_objects(mc, cam_pos)
    # the glides
    for nm, idx, kind, B, dbl in OBJECTS:
        obj = room.props[nm][idx]
        o = mc.obj[obj.name]
        f0 = key_glide(obj, B, o['home'].to_2d(), o['stop'].to_2d(), o['yaw0'], o['yaw1'])
        o['launch'] = f0
        print(f'S07 {nm} launches f{f0} ({(o["stop"] - o["home"]).length:.1f} m)', flush=True)
    # the hand: planted for the first, then each cycle
    mc.key_reach(START - 6)
    Cp = None
    for i, (nm, idx, kind, B, dbl) in enumerate(OBJECTS):
        obj = room.props[nm][idx]
        t1 = time.time()
        Cp = mc.cycle(obj, mc.obj[obj.name], nm, kind, B, dbl, cam_pos,
                      OBJECTS[i + 1] if i + 1 < len(OBJECTS) else None)
        print(f'S07 cycle {nm} {time.time() - t1:.1f}s', flush=True)
    # after the last post: back to his side to wait for the droid, then the binder
    nm, idx, kind, B, dbl = OBJECTS[-1]
    f_con = B + (DOUBLE if dbl else NORMAL)['contact']
    Wp = mc.wait_pose(REST_AT)
    q0, q3 = Cp[0], Wp[0]
    mc.hand.move(f_con, REST_AT, Cp, Wp, path=lambda e: bezier(q0, q0 + V((0.08, 0.0, 0.06)), q3 + V((0.0, 0.0, 0.12)),
                                                                q3, e))
    mc.hand.fingers(REST_AT, 'relaxed', 0.3)
    mc.wait_pose(BINDER_REACH[0] - 1)
    t1 = time.time()
    mc.binder(cam_pos)
    print(f'S07 binder {time.time() - t1:.1f}s', flush=True)
    # the hand lets go over the folding binder, hovers, then goes to rest
    Lp = mc.release
    Hv = (Lp[0] + V((0.05, -0.03, 0.05)), Lp[1], Lp[2], Lp[3], Lp[4])
    mc.hand.move(BINDER_RELEASE, BINDER_RELEASE + 4, Lp, Hv)
    mc.hand.fingers(BINDER_RELEASE + 4, 'relaxed', 0.3)
    mc.hand.put(HAND_REST[0], *Hv)
    Wp2 = mc.wait_pose(HAND_REST[1])
    mc.hand.move(HAND_REST[0], HAND_REST[1], Hv, Wp2,
                 path=lambda e: bezier(Hv[0], Hv[0] + V((0.06, 0.0, 0.0)), Wp2[0] + V((0.0, 0.0, 0.15)), Wp2[0], e))
    mc.hand.fingers(HAND_REST[1], 'relaxed', 0.3)
    rig.bake_pauldrons(START - 8, END)
    print(f'S07 BUILD performance {time.time() - t0:.1f}s', flush=True)
    for row in mc.log:
        print('S07 post %-10s %-8s B%d contact f%d scale at contact %.3f low %.4f' % row, flush=True)
    lights(room, rig, cam)
    glint(rig, cam)
    room.insert_lights('zero', target=room.props['linda'][0])
    room.use_kits('zero')
    room.front_bokeh(cam, frame=BOKEH_FRAME, **BOKEH)
    room.hide_from_camera('head', 'left')       # the colleagues' discs hang in the dark beyond the far wall too
    room.render_budget(kind='wide', samples=args.samples or None)
    room.compositor()
    room.tune_scanlines(cam)
    border = os.environ.get('S07_BORDER')
    if border:                                  # x0,x1,y0,y1 (0..1, y up): a crop for quick checks
        x0, x1, y0, y1 = (float(v) for v in border.split(','))
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        sc.render.border_min_x, sc.render.border_max_x = x0, x1
        sc.render.border_min_y, sc.render.border_max_y = y0, y1
    if DIAG:
        b = getattr(mc, 'binder_obj', None)
        if b is not None:
            for f in range(BINDER_AT_LID - 1, SQUEEZE[1] + 2):
                sc.frame_set(f)
                dg = bpy.context.evaluated_depsgraph_get()
                ps = []
                for o in b[0].children_recursive:
                    if o.type == 'MESH':
                        ev = o.evaluated_get(dg)
                        me = ev.to_mesh()
                        ps += [ev.matrix_world @ v.co for v in me.vertices]
                        ev.to_mesh_clear()
                if ps:
                    lo = V((min(p.x for p in ps), min(p.y for p in ps), min(p.z for p in ps)))
                    hi = V((max(p.x for p in ps), max(p.y for p in ps), max(p.z for p in ps)))
                    print(f'S07 binder f{f}: lo {tuple(round(x, 3) for x in lo)} hi {tuple(round(x, 3) for x in hi)} '
                          f'hidden {b[0].hide_render}', flush=True)
        fr = os.environ.get('S07_DIAG_FRAMES', '')
        diagnostics(mc, cam, [int(x) for x in fr.split(',')] if fr else None)
    print(f'S07 BUILD {time.time() - t0:.1f}s', flush=True)
    return room, rig, cam


# ---------------------------------------------------------------- camera

def camera():
    sp = V(R.SYNERGY_POS)
    loc0 = V(CAM0['loc'])
    cam = C.camera('cam_s07', LENS, tuple(loc0), None, fstop=FSTOP, focus=FOCUS, clip=(0.02, 120.0))
    cam.rotation_mode = 'XYZ'
    off0 = loc0 - V((sp.x, sp.y, loc0.z))
    r0 = off0.length
    az0 = math.atan2(off0.y, off0.x)
    for f in range(START, END + 1):
        t = smoother((f - START) / (END - START))
        az = az0 - math.radians(ARC_DEG) * t
        r = r0 + ARC_OUT * t
        cam.location = (sp.x + r * math.cos(az), sp.y + r * math.sin(az), loc0.z)
        yaw = math.radians(CAM0['yaw']) - math.radians(ARC_DEG) * t
        cam.rotation_euler = (math.radians(90.0 + CAM0['pitch']), 0.0, yaw - math.pi / 2)
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
    for fc in C.fcurves(cam.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    bpy.context.scene.frame_set(START)
    return cam


# ---------------------------------------------------------------- light

def receivers(rig, room, name):
    """A collection of Synergy's meshes (headset and cup included) and the problems he handles."""
    objs = [o for o in rig.collection.all_objects if o.type in ('MESH', 'CURVE')]
    extra = ([rig.headset] + list(rig.headset.children_recursive) if rig.headset else []) + rig.cup_objects()
    for nm, i, k, B, d in OBJECTS:
        extra += _meshes(room.props[nm][i])
    for o in extra:
        if o.type in ('MESH', 'CURVE') and o not in objs:
            objs.append(o)
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for o in objs:
        if coll.objects.get(o.name) is None:
            coll.objects.link(o)
    return coll


def lights(room, rig, cam):
    coll = C.collection('S07_light')
    sp = V(R.SYNERGY_POS)
    recv = receivers(rig, room, 'S07_synergy_receivers')
    # the slab's warm bounce off the walnut in front of him (rig owner's note: the room as built
    # leaves his lower torso unlit)
    b = C.area_light('s07_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                     BOUNCE_E, 1.1, 0.5, color=(1.0, 0.88, 0.76), coll=coll)
    b.visible_camera = False
    b.visible_glossy = False
    # the skylight's spill off the head wall behind him: crown, headband and shoulder caps
    for sx, e in zip((1.0, -1.0), BACK_E):
        lt = C.area_light(f's07_back_{"L" if sx > 0 else "R"}', (sp.x + 0.35 * sx, sp.y + 1.05, 2.55),
                          (sp.x, sp.y, 1.55), e, 0.9, 0.35, color=(0.86, 0.91, 1.0), coll=coll)
        lt.visible_camera = False
        lt.light_linking.receiver_collection = recv
    # each colleague's screen reaches him from down the table: a soft card on the line from his
    # chest to the screen, its level following the screen (a low glow, the flare a full rim)
    centre = V((sp.x, sp.y, 1.30))
    done = set()
    for nm, i, k, B, d in OBJECTS:
        if nm in done:
            continue
        done.add(nm)
        t = room.terminals[nm]
        scr = t.to_world((0.0, P.CRT['front'], P.CRT['zs']))
        dv = scr - centre
        dirn = V((dv.x, dv.y, 0.0)).normalized()
        pos = centre + dirn * RIM_DIST
        pos.z = RIM_Z
        col = V(t.light.data.color)
        mx = max(col)
        col = col / mx if mx > 0 else col
        lum = 0.2126 * col.x + 0.7152 * col.y + 0.0722 * col.z
        E = RIM_E * min(1.8, max(0.8, (0.45 / max(lum, 1e-3)) ** 0.5))
        lt = C.area_light(f's07_rim_{nm}', tuple(pos), tuple(centre), 1.0, RIM_SIZE, RIM_SIZE, color=tuple(col), coll=coll)
        lt.visible_camera = False
        lt.data.spread = math.radians(90)
        lt.light_linking.receiver_collection = recv
        scr_o = t.screen
        v = [('on', scr_o, '["crt_on"]'), ('gain', scr_o, '["crt_gain"]'), ('flare', scr_o, '["crt_flare"]')]
        P.add_driver(lt.data, 'energy', f'{E:.3f}*on*gain*({RIM_BASE:.3f}+max(0.0,flare-1.0)/0.6)', v)
    # the amber pulse in the slot spills on the lid, the spout and the fingertips
    pos, ax = rig.slot_world(START)
    amb = C.point_light('s07_slot_amber', tuple(pos + ax * 0.004), 0.0, 0.003, color=(1.0, 0.55, 0.18), coll=coll)
    amb.visible_camera = False
    amb.parent = rig.cup
    amb.matrix_parent_inverse = rig.cup.matrix_world.inverted()
    P.add_driver(amb.data, 'energy', f'{AMBER_E:.4f}*led', [('led', rig.cup_handle.glow, '["led"]')])


def glint(rig, cam):
    """The reflected skylight slot on the face glass, re-aimed along the camera's arc."""
    for f in sorted(set(list(range(START, END + 1, 12)) + [END])):
        rig.glass_glint(cam, f)


# ---------------------------------------------------------------- diagnostics

def _real(a, b):
    """Pairs that count as interpenetration (joint seats, pistons and cables excluded)."""
    if any(x in a or x in b for x in ('piston', 'rail', 'wire', 'cable', 'cord', 'plug', 'bicep', 'slotglow')):
        return False
    for x, y in (('forearm_', 'upperarm_'), ('palm_', 'forearm_'), ('shoulder_hub', 'upperarm')):
        if (x in a and y in b) or (x in b and y in a):
            return False
    return True


def _meshes(obj):
    return [o for o in [obj] + list(obj.children_recursive) if o.type == 'MESH' and not o.name.endswith('_caustic')]


def diagnostics(mc, cam, frames=None):
    """Per frame: the left arm against his body, cup and headset; the held problem against the
    hand and the cup; the hand's lowest point against the walnut; gliding problems against the hub."""
    rig, room = mc.rig, mc.room
    sc = bpy.context.scene
    arm = rig.parts_on_bones(ARM_L + ['pauldron_L'])
    hand = rig.parts_on_bones(HAND_L)
    body = rig.parts_on_bones(['chest', 'neck', 'head', 'spine', 'pelvis', 'badge', 'upperarm_R', 'forearm_R',
                               'hand_R', 'shoulder_R', 'pauldron_R'] +
                              [f'{n}_{i}_R' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] +
                              [f'thumb_{i}_R' for i in range(3)])
    hs = [o for o in rig.headset.children_recursive if o.type == 'MESH'] if rig.headset else []
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']
    hub = _meshes(room.hub.root)
    objs = {nm: room.props[nm][i] for nm, i, k, B, d in OBJECTS}
    sched = {room.props[nm][i].name: (B, B + (DOUBLE if d else NORMAL)['gone']) for nm, i, k, B, d in OBJECTS}
    worst = {}
    for f in frames or range(START, END + 1):
        out = []
        r = {k: v for k, v in rig.overlap_report(f, arm, body + hs + cup).items() if _real(*k)}
        if r:
            out.append('arm ' + ', '.join(f'{a.split("_", 1)[-1]}x{b.split("_", 1)[-1]}:{n}' for (a, b), n in
                                          sorted(r.items(), key=lambda x: -x[1])[:4]))
        dg = bpy.context.evaluated_depsgraph_get()
        zmin = 9.0
        for o in hand:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            Mw = ev.matrix_world
            zmin = min([zmin] + [(Mw @ v.co).z for v in me.vertices if (Mw @ v.co).y < 0.0])
            ev.to_mesh_clear()
        if zmin < R.TABLE_TOP + 0.0005:
            out.append(f'hand below walnut {1000 * (zmin - R.TABLE_TOP):+.1f} mm')
        for o in objs.values():
            B, gone = sched[o.name]
            if f >= gone:
                continue
            om = _meshes(o)
            if f >= B:
                r2 = rig.overlap_report(f, om, hand + cup + body + hs)
                if r2:
                    out.append(f'{o.name} x ' + ', '.join(f'{b.split("_", 1)[-1]}:{n}' for (a, b), n in r2.items()))
            else:
                r3 = rig.overlap_report(f, om, hub)
                if r3:
                    out.append(f'{o.name} x hub {sum(r3.values())}')
        if out:
            print(f'S07 CHECK f{f}: ' + ' | '.join(out), flush=True)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
