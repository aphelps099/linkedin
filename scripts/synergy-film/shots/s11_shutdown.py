"""S11 · f993-1152 · E2_LONG_ROOM (lit to dark): the shutdown.

    blender -b --factory-startup -P shots/s11_shutdown.py -- --quality proof --only 993,995,1001,1036,1049,1061,1085,1097,1108,1113,1120,1129,1135,1140,1150,1152
    blender -b --factory-startup -P shots/s11_shutdown.py -- --quality final
    S11_DEBUG=1 ... -- --no-render          clearance / visibility / cup-drift report, no render

Camera: env_room's approved 's11_shutdown' framing, unchanged: 32 mm f/5.6 focused on him
(2.3 m), lens 1.6 m up, 1.4 m to his left and 1.8 m behind, panned 20 deg across the table and
tilted 10.5 deg down; him at frame right, every screen and Pat clear of his silhouette, the
table receding to the vanishing point frame left. Locked off for the whole shot (fixed sampling
seed): the comedy is stillness.

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S11):
  f993-994  S10's last frame held: a 6 deg lean from the waist, cup at chest height in the right
            hand (kept in place by rig.lean(keep_cup=True)), the left hand pinching the gold jack
            3 cm up and back from its socket. S10's left-hand performance is reused verbatim
            (shots/s10_jack.py, imported), so the hand-over is exact whatever S10 settles on.
  f995      the pads part and the jack drops on its coiled cord over the head edge: a damped
            spring-mass (the slack, then the coil takes it), bottoming out with a small bounce
            at f1000-1001, swinging pin-down under the edge and settling by ~f1015; the cord
            drapes over the edge with it. The hand holds exactly where it let go.
  f1001     the shutdown wave (Room.shutdown_wave: Synthia, Keys, Arjun, Kevin, Strategy,
            Operations, People & Culture, Linda, one every 5 frames): field -> white line (4 f)
            -> dot (3 f) -> black, 10 f afterglow; each collapse flares its colour on the walnut
            and, through a screen-driven rim card per colleague, on his silhouette.
  f1001-1055 the room's ambient falls with the wave (Room.set_state ramp) instead of popping.
  f1049     the printer's lime LED dies and its last sheet stops half-fed; the droid's pinlight
            goes out (both at the foot, tiny at the vanishing point).
  f1061-1084 darkness: the slab on the walnut and the brass channel; he is rim-lit from above.
  f1085-1092 far down the table Pat's dead screen comes on, grey, with a 6-frame degauss.
  f1097-1108 his head turns 6 deg toward Pat (his right), eased.
  f1109-1113 the film's only head dip: 8 deg down over 5 frames (neck 3 + head 5, the A-frame
            pistons closing as a pair); f1114-1120 back up over 7.
  f1121-1128 the left hand rises: out past his hip and pauldron, round to just outside the band
            with the hand already turned to its grip, fingers open, thumb laid back.
  f1129     it grips the band just above the left earcup (rig.grip_headband): head -> hand.
  f1129-1135 the headset comes straight up 10 cm, first unhooking (left side rolled up, the
            boom tipped forward off his jaw by f1132).
  f1136-1140 away to his left (6 cm), turning 75 deg about the vertical so the right earcup
            swings round in front of his face, clear.
  f1141-1150 lowered to the walnut beside the hub and stood on its earcups (the hull face it
            rests on with the least turn, earcups in line down the table, 25 mm clear of the hub, the
            padlock and the master cord, in the slab's edge): f1150 hand -> table (HEADSET_REST).
  f1150-1152 his fingers ease open on the band; nothing else moves. Cut to Offline at night.
The cup never moves (checked: 0.00 mm). One head dip. He never walks. No text anywhere.

Light: the room as built plus, light-linked to him alone and unseen by the lens: one card per
colleague on the line to its screen, driven by that screen's state (so the colours leave his
silhouette in the wave and Pat's grey arrives last); the slab's warm bounce off the walnut in
front of him (the rig owner's note); and the slab's cool bounce off the carpet behind him, so the
faceted back and the arm taking the headset off stay readable in the dark.
No Room.front_bokeh here: the lens looks down the table at the real screens, so disc stand-ins
floating in the dark above them would contradict the frame.
"""

import json
import math
import os
import sys
import time

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
sys.path.insert(0, HERE)

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as P  # noqa: E402
import synergy as S  # noqa: E402

SHOT = 's11'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']
DEBUG = bool(os.environ.get('S11_DEBUG'))

# ------------------------------------------------------------------ the beats (film frames)
F_RELEASE = 995                 # the left hand opens: the jack drops
F_WAVE = 1001                   # Synthia collapses first; a screen every 5 frames, near to far
F_PRINTER = 1049                # the printer's LED dies, its last sheet stops half-fed
F_DARK = 1053                   # the room's ambient fills are down (env_room demo_timeline)
F_PAT = 1085                    # Pat powers on: dot, line, field, 6-frame degauss (to f1092)
YAW = (1096, 1108)              # head turns 6 deg toward Pat (rest key, end key)
DIP = (1108, 1113, 1120)        # the film's only head dip: 8 deg down over 5 frames, up over 7
RISE = (1120, 1128)             # the left hand rises to the band (last still frame, arrival)
GRIP = 1129                     # grips the band above the left earcup: headset head -> hand
LIFT_UP = 1135                  # straight up 10 cm by here ...
LIFT_END = 1140                 # ... then away to his left (up and clear of the head)
SET = 1150                      # set down on the walnut beside the hub: headset hand -> table

# Where the headset rests from f1150 to the end of the film (S13, S14): the headset empty's world
# location and rotation (w, x, y, z), as solved here (headset_off prints it; S11_DEBUG warns if
# a rig change moves it more than 1 mm). Standing on its earcups beside the hub.
HEADSET_REST = ((0.3, -0.25, 0.8221), (0.70182, -0.0867, -0.08595, 0.70182))

YAW_DEG = -6.0                  # toward his right (Pat's side)
DIP_NECK, DIP_HEAD = 3.0, 5.0   # the dip, shared so the neck's A-frame pistons work as a pair


def ease(t):
    return C.ease(t, 'inout')


# ------------------------------------------------------------------ the room's side of the film

def room_timeline(room):
    """Every room event that touches f993-1152 (env_room.demo_timeline's hand-overs)."""
    pr = room.printer
    for f in (257, 321, 385, 449, 513, 577, 641, 705, 769, 833, 897):
        pr.feed(f)
    pr.led_pulse(1, F_PRINTER - 1)
    pr.stop_mid(F_PRINTER)
    pr.led_off(F_PRINTER)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = R.ROOM['droid_lane_x']
    x0, y0 = R.ROOM['droid_start']
    d.place(299, x0, y0, R.ROOM['droid_start_heading'])
    d.drive(300, 712, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + R.droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)
    d.drive(737, 985, R.droid_exit_path(lane), reverse=True, ease='cruise', accel=0.06)
    d.light_off(F_PRINTER)
    room.key_visible(d.binder, 729, False)
    for nm, i, f, dbl in R.S07_ARRIVALS:
        room.key_visible(room.props[nm][i], f + (8 if dbl else 16), False)
    # S09/S10: Kevin's same padlock slid in to his fingertip and stays on the walnut
    pad = room.props['kevin'][0]
    home = R.prop_home('kevin')
    stop = Vector(R.stop_for('padlock', obj=pad, start=home))
    dirn = (stop - Vector(home)).normalized()
    P.slide(pad, 838, 852, tuple(stop - dirn * 1.6), tuple(stop), settle=0.0, accel=0.2)
    room.hub.leds_off(961)
    room.shutdown_wave(F_WAVE)
    # the ambient (fills, diffuser) falls with the wave instead of popping after it: the screens
    # were the room's light; dark from the last afterglow on (env_room's switch is f1053)
    room.set_state(F_WAVE, 'dark', ramp=F_DARK + 2 - F_WAVE)
    room.terminals['pat'].power_on(F_PAT)


# ------------------------------------------------------------------ S10 hand-over

def s10_handover(rig, room):
    """S10's left-hand performance verbatim (its own module), so f993 is S10's f992: a 6 deg
    lean with the cup kept in place, the jack pinched 3 cm up and back from the socket."""
    import s10_jack as S10
    cam10, _ = S10.build_camera(room)
    M0, jax = S10.jack_seat(room)
    sol = S10.left_hand(rig, room, cam10, M0, jax)
    pinch_local = M0.inverted() @ sol['pinch_w']
    axis_local = (M0.to_3x3().inverted() @ sol['axis_w']).normalized()
    S10.key_jack(room, M0, pinch_local, axis_local)
    room.master.pulled(S10.F_PULL)
    bpy.data.objects.remove(cam10)
    return S10, sol


# ------------------------------------------------------------------ the head: one turn, one dip

def head_moves(rig):
    """f1097-1108 the head yaws 6 deg toward Pat, eased; f1109-1113 the film's only head dip
    (8 deg: neck 3 + head 5, the A-frame pistons closing as a pair), f1114-1120 back up. The
    canon 4 deg roll stays. Held to the cut."""
    k = 'BEZIER'
    r = S.CANON_HEAD[1]
    level = dict(neck=(0.0, 0.0, 0.0), head=(0.0, r, 0.0))
    turned = dict(neck=(0.0, 0.0, 0.0), head=(0.0, r, YAW_DEG))
    dipped = dict(neck=(DIP_NECK, 0.0, 0.0), head=(DIP_HEAD, r, YAW_DEG))
    for f, pose in ((START, level), (YAW[0], level), (YAW[1], turned), (DIP[1], dipped), (DIP[2], turned),
                    (END, turned)):
        rig.pose(f, k, **pose)


# ------------------------------------------------------------------ the jack drops

JACK = dict(edge=(0.2175, 0.0110, 0.7470),   # where the master cord rolls over the head edge
            slack=0.100,                     # cord length that hangs free before the coil takes the load
            k=220.0, zeta=0.22,              # coil stiffness (per unit mass, 1/s^2) and damping ratio
            face_y=0.0065,                   # the barrel's axis keeps off the head edge's face (walnut)
            k_rot=160.0, zeta_rot=0.45, drag=3.0)      # the jack swinging round to hang pin-down on its cord


def jack_drop(room):
    """f995: released from the pinch, the jack falls on its coiled cord over the head edge. A
    damped spring-mass on the cord (the free run slack first, then the coil takes the load and
    catches it: the small bounce, bottoming out at f1000-1001), the barrel swinging round to hang
    pin-down, a short sway under the edge, at rest by ~f1015 (the walnut's head-edge face is a
    collider). The cord's last free control point drapes over the edge with it. Keyed every frame
    (LINEAR) so motion blur sees the true path."""
    sc = bpy.context.scene
    jr = room.jack.root
    sc.frame_set(F_RELEASE - 1)
    M0 = jr.matrix_world.copy()
    tl = room.jack.tail_local.y
    a = (M0.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()     # barrel axis, toward the cord
    p = M0 @ Vector((0.0, tl, 0.0))                                 # cord exit (tail)
    v = Vector((0.0, 0.0, 0.0))
    w = Vector((0.0, 0.0, 0.0))                                     # angular velocity of the axis
    E = Vector(JACK['edge'])
    k, c = JACK['k'], 2.0 * JACK['zeta'] * math.sqrt(JACK['k'])
    kr, cr = JACK['k_rot'], 2.0 * JACK['zeta_rot'] * math.sqrt(JACK['k_rot'])
    g = Vector((0.0, 0.0, -9.81))
    dt = 1.0 / C.FPS
    sub = 16
    R0 = M0.to_3x3()
    a0 = a.copy()
    if DEBUG:
        print(f'S11 JACK start: tail {tuple(round(x, 3) for x in p)} edge {tuple(E)} dist {(E - p).length:.3f} '
              f'tail_local {tl:.4f} axis {tuple(round(x, 2) for x in a)}', flush=True)
    out = {}
    contacts = []
    for f in range(F_RELEASE, END + 3):
        for _ in range(sub):
            h = dt / sub
            d = E - p
            L = d.length
            acc = g.copy()
            if L > JACK['slack']:
                n = d / L
                acc += n * (k * (L - JACK['slack']) - c * v.dot(n))
            acc -= v * JACK['drag']                                 # air and the coil's own drag
            v += acc * h
            p += v * h
            # the edge face: below the walnut's top the barrel cannot enter the table
            lo = JACK['face_y']
            if R.ROOM['table_bottom_z'] - 0.01 < p.z < R.TABLE_TOP + 0.004 and p.y < lo:
                if v.y < -0.05:
                    contacts.append(f)
                p.y = lo
                v.y = -0.35 * v.y
                v.x *= 0.8
                v.z *= 0.8
            # the barrel swings round to point along its cord (pin down)
            dirc = (E - p).normalized()
            ax = a.cross(dirc)
            ang = math.asin(max(-1.0, min(1.0, ax.length)))
            if a.dot(dirc) < 0:
                ang = math.pi - ang
            ax = ax.normalized() if ax.length > 1e-9 else Vector((1.0, 0.0, 0.0))
            w += (ax * (kr * ang) - w * cr) * h
            if w.length > 1e-9:
                a = (Matrix.Rotation(w.length * h, 3, w.normalized()) @ a).normalized()
        Rm = a0.rotation_difference(a).to_matrix() @ R0
        origin = p - a * tl
        out[f] = Matrix.Translation(origin) @ Rm.to_4x4()
    jr.rotation_mode = 'QUATERNION'
    for f, Mw in out.items():
        jr.matrix_world = Mw
        jr.keyframe_insert('location', frame=f)
        jr.keyframe_insert('rotation_quaternion', frame=f)
    for fc in C.fcurves(jr.animation_data.action):
        for kp in fc.keyframe_points:
            if kp.co.x >= F_RELEASE - 1:
                kp.interpolation = 'LINEAR'
    # the cord's last free point drapes over the edge face and follows the jack down
    mc = room.master
    keys = [nm for nm in mc.mids][-1:]
    for nm in keys:
        e = mc.e[nm]
        sc.frame_set(F_RELEASE - 1)
        base = e.matrix_world.translation.copy()
        e.keyframe_insert('location', frame=F_RELEASE - 1)
        lip = Vector((E.x + 0.001, JACK['face_y'] + 0.004, R.TABLE_TOP - 0.035))
        for f in range(F_RELEASE, END + 3):
            tail = out[f] @ Vector((0.0, tl, 0.0))
            t = min(1.0, (f - F_RELEASE + 1) / 4.0)
            tgt = lip.lerp(tail, 0.18)
            tgt.y = max(tgt.y, JACK['face_y'] + 0.003)
            e.location = base.lerp(tgt, C.ease(t, 'out'))
            e.keyframe_insert('location', frame=f)
    if DEBUG:
        for f in (995, 996, 997, 998, 999, 1000, 1001, 1003, 1006, 1010, 1020, 1040):
            o = out[f].translation
            print(f'S11 JACK f{f}: origin ({o.x:.3f}, {o.y:.3f}, {o.z:.3f})  axis.z '
                  f'{(out[f].to_3x3() @ Vector((0, 1, 0))).z:+.2f}', flush=True)
        print('S11 JACK edge contacts on frames', sorted(set(contacts)), flush=True)
    return out


def release_hand(rig, S10):
    """f995: the pads part (thumb back to its open gap, fingers uncurl a little); the hand then
    holds exactly where it let go."""
    for nm, ang in S10.GRIP_FINGERS.items():
        S10.key_fingers(rig, F_RELEASE - 1, nm, ang, 'BEZIER')
        S10.key_fingers(rig, F_RELEASE + 2, nm, S10.OPEN_FINGERS[nm], 'BEZIER')
    S10.key_thumb(rig, F_RELEASE - 1, S10.GAP, 'BEZIER')
    S10.key_thumb(rig, F_RELEASE + 1, S10.GAP_OPEN, 'BEZIER')


# ------------------------------------------------------------------ the headset comes off

HS = dict(lift=[(1132, (0.0, 0.0, 0.05), (-6.0, -6.0, 8.0)),       # unhook: left side up, boom off the jaw
               (LIFT_UP, (0.0, 0.0, 0.10), (-6.0, -6.0, 8.0)),    # straight up 10 cm
               (LIFT_END, (0.06, 0.0, 0.09), (75.0, 0.0, 0.0))],  # away to his left, turning
          slab_pref=0.5,
          rest_yaw=(60.0, 110.0), approach=0.12, rest_x=(0.30, 0.62), rest_y=(-0.40, -0.10), clear=0.025, reach=0.565)
GRIP_SHOULDERS = [(30, 0, 0), (40, -4, 0), (50, -6, 0), (46, -4, 0), (36, -4, 0), (0, 0, 0), (0, 6, 0), (0, 12, 0), (0, 18, 0), (8, 8, 0), (8, 16, 0), (16, 10, 0), (16, 20, 0),
                  (24, 10, 0), (24, 20, 0), (32, 12, 0), (40, 12, 0), (-8, 10, 0)]


def _mesh_world(o, dg):
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    vs = [ev.matrix_world @ v.co for v in me.vertices]
    ps = [tuple(pl.vertices) for pl in me.polygons]
    area_c = [(ev.matrix_world @ pl.center, pl.area) for pl in me.polygons]
    ev.to_mesh_clear()
    return vs, ps, area_c


def _bvh(objs, dg):
    V, Pp = [], []
    for o in objs:
        if o.type not in ('MESH', 'CURVE'):
            continue
        try:
            vs, ps, _ = _mesh_world(o, dg)
        except RuntimeError:
            continue
        b0 = len(V)
        V += vs
        Pp += [tuple(i + b0 for i in pl) for pl in ps]
    return BVHTree.FromPolygons(V, Pp)


def _depth(tree, pts, cap=0.08):
    """Deepest point of `pts` inside the surface of `tree` (nearest-face normal test)."""
    worst = 0.0
    for q in pts:
        loc, nor, _, dist = tree.find_nearest(q, cap)
        if loc is not None and (q - loc).dot(nor) < 0.0 and dist > worst:
            worst = dist
    return worst


def _stable_faces(loc_v, com):
    """Faces of the convex hull of `loc_v` the object can rest on (its centre of mass projects
    inside the face with a margin): [(outward normal, margin)]."""
    import bmesh
    bm = bmesh.new()
    for v in loc_v:
        bm.verts.new(v)
    bmesh.ops.convex_hull(bm, input=bm.verts[:])
    groups = []
    for f in bm.faces:
        n = f.normal.normalized()
        d = n.dot(f.verts[0].co)
        for g in groups:
            if g['n'].dot(n) > math.cos(math.radians(3.0)) and abs(g['d'] - d) < 0.004:
                g['p'].extend(v.co.copy() for v in f.verts)
                break
        else:
            groups.append(dict(n=n, d=d, p=[v.co.copy() for v in f.verts]))
    bm.free()
    out = []
    for g in groups:
        n = g['n']
        t1 = n.orthogonal().normalized()
        t2 = n.cross(t1)
        pts = sorted(set((round(q.dot(t1), 6), round(q.dot(t2), 6)) for q in g['p']))
        if len(pts) < 3:
            continue

        def cross(o, a_, b_):
            return (a_[0] - o[0]) * (b_[1] - o[1]) - (a_[1] - o[1]) * (b_[0] - o[0])
        lo_, hi_ = [], []
        for q in pts:
            while len(lo_) >= 2 and cross(lo_[-2], lo_[-1], q) <= 0:
                lo_.pop()
            lo_.append(q)
        for q in reversed(pts):
            while len(hi_) >= 2 and cross(hi_[-2], hi_[-1], q) <= 0:
                hi_.pop()
            hi_.append(q)
        hull = lo_[:-1] + hi_[:-1]
        c2 = (com.dot(t1), com.dot(t2))
        m = 1e9
        for i in range(len(hull)):
            a_, b_ = hull[i], hull[(i + 1) % len(hull)]
            ex, ey = b_[0] - a_[0], b_[1] - a_[1]
            L = math.hypot(ex, ey)
            if L > 1e-9:
                m = min(m, (ex * (c2[1] - a_[1]) - ey * (c2[0] - a_[0])) / L)
        if m > 0.004:
            out.append((n, m))
    return out


def _hand_frame(rig, Th, frame):
    """Hand-bone world matrix -> (wrist, u, w) in chest-rest space at `frame` (place_arm's)."""
    hd = rig.hands['L']
    Rd = Th.to_3x3() @ (rig.arm.matrix_world.to_3x3() @ rig._rest['hand_L'].to_3x3()).inverted()
    Dc = rig._chest_delta(frame)
    R3 = Dc.to_3x3()
    return Dc @ Th.translation, (R3 @ (Rd @ hd['u'])).normalized(), (R3 @ (Rd @ hd['w'])).normalized()


def _solve_hand(rig, frame, Th, prev, fingers=None, thumb=None):
    """Key the left arm so the hand bone lands on world matrix `Th` at `frame`: elbow pole and
    shoulder searched round the previous frame's (continuity), clear of chest, head, pauldron."""
    wrist, u, w = _hand_frame(rig, Th, frame)
    p0 = Vector(prev['pole']).normalized()
    poles = [p0] + [(p0 + Vector(q) * 0.35).normalized() for q in
                    ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
    sh0 = prev['shoulder']
    shoulders = [tuple(sh0)] + [s_ for s_ in GRIP_SHOULDERS if s_ != tuple(sh0)]

    def prefer(hu, hw, pole, sh, chain):
        return 0.6 * (Vector(pole).normalized() - p0).length + 0.004 * (abs(sh[0] - sh0[0]) + abs(sh[1] - sh0[1]))
    sol = rig.solve_arm_clear('L', wrist, [(u, w)], poles, shoulders, fingers=fingers, thumb=thumb, prefer=prefer)
    rig.place_arm(frame, 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], 'LINEAR', shoulder=sol['shoulder'])
    return sol


def _hermite(keys, f):
    """C1 cubic through (frame, Vector) keys with Catmull-Rom tangents, zero at the ends."""
    fs = [k[0] for k in keys]
    if f <= fs[0]:
        return keys[0][1].copy()
    if f >= fs[-1]:
        return keys[-1][1].copy()
    i = max(j for j in range(len(fs) - 1) if fs[j] <= f)
    (f0, p0), (f1, p1) = keys[i], keys[i + 1]

    def tan(j):
        if j == 0 or j == len(keys) - 1:
            return Vector((0.0, 0.0, 0.0))
        return (keys[j + 1][1] - keys[j - 1][1]) / float(keys[j + 1][0] - keys[j - 1][0])
    h = float(f1 - f0)
    t = (f - f0) / h
    m0, m1 = tan(i) * h, tan(i + 1) * h
    t2, t3 = t * t, t * t * t
    return p0 * (2 * t3 - 3 * t2 + 1) + m0 * (t3 - 2 * t2 + t) + p1 * (-2 * t3 + 3 * t2) + m1 * (t3 - t2)


def headset_off(rig, room, sol10):
    """f1121-1128 the left hand rises to the band; f1129 grips it just above the left earcup
    (rig.grip_headband: the headset passes from the head to the hand); f1129-1135 straight up
    10 cm, unhooking first (left side rolled up 6 deg, the boom tipped forward off the jaw by
    f1132); f1136-1140 away to his left, turning 75 deg about the vertical so the right earcup
    swings round in front of his face; f1141-1150 lowered to the walnut beside the hub, standing
    on its earcups (the stable hull face with the least turn), released there (f1150: hand ->
    table). The rest is searched (heading, place) for an easy reach, clear of the hub, the
    padlock and the master cord, in the slab's light. Every frame of the arm is solved from the
    headset's own path (the hand rides the band), so nothing slides in the grip. The band hooks
    over the wedge head, so a rigid headset cannot come off without passing through it somewhere:
    the path keeps every intersection on the far side of his head from the lens (report())."""
    sc = bpy.context.scene
    t0 = time.time()
    # --- the grip
    sol = rig.grip_headband(GRIP, 'BEZIER')
    fing = {nm: [a_ * sol['curl'] * k_ for a_ in S.FIST] for nm, k_ in (('index', 0.9), ('middle', 1.0),
                                                                        ('ring', 1.05), ('pinky', 1.1))}
    thumb = rig.thumb_curl_rots('L', sol['thumb'])
    sc.frame_set(GRIP)
    dg = bpy.context.evaluated_depsgraph_get()
    hs = rig.headset
    E0 = hs.evaluated_get(dg).matrix_world.copy()
    Th0 = rig._bone_world('hand_L', GRIP)
    grip0 = Th0.translation.copy()
    wv, _, ac = _mesh_world(rig.parts['headset_parts'], dg)
    E0i = E0.inverted()
    loc_v = [E0i @ v for v in wv]
    com = sum(((E0i @ c) * a_ for c, a_ in ac), Vector()) / max(1e-9, sum(a_ for _, a_ in ac))
    # --- where it comes to rest: the stable face nearest to upright, a heading and a place on
    # the walnut that the hand reaches, clear of the hub, the padlock and the master cord
    faces = _stable_faces(loc_v, com)
    n_up, margin = max(faces, key=lambda fm: fm[0].dot(Vector((0.0, 0.0, -1.0))))
    Rtip = n_up.rotation_difference(Vector((0.0, 0.0, -1.0))).to_matrix().to_4x4()
    zmin = min((Rtip @ v).z for v in loc_v)
    Sh = rig._bone_world('upperarm_L', GRIP).translation.copy()
    K = E0i @ Th0
    sc.frame_set(SET)
    dg = bpy.context.evaluated_depsgraph_get()
    hub_objs = [o for o in [room.hub.root] + list(room.hub.root.children_recursive) if o.type == 'MESH']
    pad = room.props['kevin'][0]
    pad_objs = [o for o in [pad] + list(pad.children_recursive) if o.type == 'MESH']
    sock = room.socket if isinstance(room.socket, bpy.types.Object) else room.socket.root
    obst_tree = _bvh(hub_objs + pad_objs + [room.master.obj, sock] +
                     [o for o in sock.children_recursive if o.type == 'MESH'], dg)
    low_v = loc_v[::2]
    best = None
    for yaw in range(int(HS['rest_yaw'][0]), int(HS['rest_yaw'][1]) + 1, 5):
        Rl = Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Rtip
        rv = [Rl @ v for v in low_v]
        for xi in range(0, 33):
            x = HS['rest_x'][0] + (HS['rest_x'][1] - HS['rest_x'][0]) * xi / 32.0
            for yi in range(0, 31):
                y = HS['rest_y'][0] + (HS['rest_y'][1] - HS['rest_y'][0]) * yi / 30.0
                T = Matrix.Translation((x, y, R.TABLE_TOP - zmin + 0.0004)) @ Rl
                reach = ((T @ K).translation - Sh).length
                if reach > HS['reach']:
                    continue
                o3 = Vector((x, y, R.TABLE_TOP - zmin + 0.0004))
                if any((o3 + q).y > -0.006 or abs((o3 + q).x) > 0.78 for q in rv if q.z - zmin < 0.06):
                    continue
                clear = 1.0
                for q in rv[::3]:
                    w_ = o3 + q
                    loc, _, _, dist = obst_tree.find_nearest(w_, 0.2)
                    if loc is not None:
                        clear = min(clear, dist)
                if clear < HS['clear']:
                    continue
                # prefer: an easy reach, square to the table, clear, and in the slab's light
                score = (reach + 0.25 * abs(yaw - 90.0) / 90.0 - 0.3 * min(clear, 0.08) +
                         HS['slab_pref'] * max(0.0, x - 0.30))
                if best is None or score < best[0]:
                    best = (score, yaw, x, y, reach, clear, T)
    if best is None:
        raise RuntimeError('S11: no reachable rest for the headset beside the hub')
    _, yaw_r, xr, yr, reach_r, clear_r, T_rest = best
    D_rest = T_rest @ E0i
    q_rest = D_rest.to_quaternion()
    p_rest = D_rest @ grip0
    # --- the path: (frame, grip-point offset, (yaw, roll, pitch) about the grip, world axes).
    # The band hooks over the wedge head and the boom tucks under the jaw, so it comes off in
    # three moves, each checked clear of everything the lens can see (report()): a small
    # unhooking lift with the left side rolled up and the boom tipped forward off the jaw, on
    # straight up to 10 cm, then away to his left turning about the vertical so the right
    # earcup swings round in front of his face, clear; then down to the walnut.
    lift = [(GRIP, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0))] + [(f_, d_, r_) for f_, d_, r_ in HS['lift']]
    rot = lambda r_: (Matrix.Rotation(math.radians(r_[0]), 3, 'Z') @ Matrix.Rotation(math.radians(r_[1]), 3, 'Y') @
                      Matrix.Rotation(math.radians(r_[2]), 3, 'X')).to_quaternion()
    pkeys = [(f_, grip0 + Vector(d_)) for f_, d_, _ in lift] + [(SET, p_rest)]
    qkeys = [(f_, rot(r_)) for f_, _, r_ in lift] + [(SET, q_rest)]
    # rotations as rotation vectors (all well under 180 deg, one hemisphere): C1 through the keys
    rvec = []
    for f_, q_ in qkeys:
        if rvec and q_.dot(qkeys[len(rvec) - 1][1]) < 0:
            q_ = -q_
        ax_, an_ = q_.to_axis_angle()
        rvec.append((f_, Vector(ax_) * an_))

    def delta(f):
        p = _hermite(pkeys, f)
        v = _hermite(rvec, f)
        q = Quaternion(v.normalized(), v.length) if v.length > 1e-9 else Quaternion()
        return Matrix.Translation(p) @ q.to_matrix().to_4x4() @ Matrix.Translation(-grip0)
    # --- the rise to the band (f1121-1128), every frame: out past his hip and pauldron, round
    # to just outside the band (the hand already turned to its grip), then in onto it
    Ta = rig._bone_world('hand_L', RISE[0])
    pa, pb = Ta.translation.copy(), grip0.copy()
    qa, qb = Ta.to_quaternion(), Th0.to_quaternion()
    hc = rig._bone_world('head', GRIP).translation + Vector((0.0, 0.0, 0.10))
    out_n = Vector((pb.x - hc.x, pb.y - hc.y, 0.0)).normalized()
    out_n = (out_n + Vector((0.0, 0.0, 0.35))).normalized()
    w1 = pa.lerp(pb, 0.5) + Vector((0.24, 0.03, 0.04))
    w2 = pb + out_n * HS['approach']
    rise_keys = [(RISE[0], pa), (RISE[0] + 4, w1), (GRIP - 3, w2), (GRIP, pb)]
    prev = dict(pole=Vector(sol10['pole']), shoulder=tuple(sol10['shoulder']))
    sols = {}
    for f in range(RISE[0] + 1, GRIP):
        p = _hermite(rise_keys, f)
        t = min(1.0, (f - RISE[0]) / float(GRIP - 3 - RISE[0]))
        Th = Matrix.Translation(p) @ qa.slerp(qb, C.ease(t)).to_matrix().to_4x4()
        sols[f] = prev = _solve_hand(rig, f, Th, prev)
    open_f = {nm: tuple(a_ * 0.10 for a_ in S.FIST) for nm in ('index', 'middle', 'ring', 'pinky')}
    rig.pose(GRIP - 3, 'BEZIER', fingers_L=open_f, thumb_L=-0.6)
    # --- grip: head -> hand, then carry it
    rig.attach_headset(GRIP, 'hand_L')
    prev = dict(pole=sol['pole'], shoulder=sol['shoulder'])
    path = {}
    for f in range(GRIP + 1, SET + 1):
        Df = delta(f)
        path[f] = Df
        sols[f] = prev = _solve_hand(rig, f, Df @ Th0, prev, fingers=fing, thumb=thumb)
    # --- set down: hand -> table, the fingers ease open and the hand holds
    rig.detach_headset(SET)
    rig.pose(SET, 'BEZIER', fingers_L=fing, thumb_L=sol['thumb'])
    rig.pose(END, 'BEZIER', fingers_L={nm: tuple(a_ * 0.6 for a_ in v) for nm, v in fing.items()}, thumb_L=0.0)
    for f in range(SET + 1, END + 3):
        rig.place_arm(f, 'L', sols[SET]['wrist'], sols[SET]['u'], sols[SET]['w'], sols[SET]['pole'], 'LINEAR',
                      shoulder=sols[SET]['shoulder'])
    rig.bake_pauldrons(RISE[0], END + 2)
    fix_headset_cord(rig, GRIP, END + 2)
    info = dict(rest=(yaw_r, xr, yr), reach=reach_r, clear=clear_r, margin=margin, face=tuple(n_up),
                T_rest=T_rest, sols=sols, path=path, E0=E0, grip0=grip0, time=time.time() - t0)
    loc_r, q_r, _ = T_rest.decompose()
    if (loc_r - Vector(HEADSET_REST[0])).length > 0.001 or q_r.rotation_difference(Quaternion(HEADSET_REST[1])).angle > 0.01:
        print('S11 WARNING: the headset rest moved: update HEADSET_REST for S13/S14', flush=True)
    print(f'S11 HEADSET_REST = ({tuple(round(c, 4) for c in loc_r)}, {tuple(round(c, 5) for c in q_r)})  '
          f'(headset empty, world location + quaternion from f{SET})', flush=True)
    print(f'S11 HEADSET rest: heading {yaw_r:.0f} deg at ({xr:.3f}, {yr:.3f}) on the walnut, stable face '
          f'{tuple(round(c, 2) for c in n_up)} (margin {margin * 1000:.0f} mm), hand reach {reach_r:.3f} m, '
          f'clear of hub/padlock/cord by {clear_r * 1000:.0f} mm; solved in {info["time"]:.1f}s', flush=True)
    worst = max(sols.items(), key=lambda kv: kv[1]['reach'])
    print(f'S11 HEADSET arm: worst reach miss {worst[1]["reach"] * 1000:.1f} mm (f{worst[0]}), worst arm '
          f'penetration {max(s_["pen"] for s_ in sols.values()) * 1e6:.1f}', flush=True)
    return info


def fix_headset_cord(rig, f0, f1, unplug=8):
    """Workaround for synergy.py: each cord hook stacks three Child Of constraints (worn, route,
    unplugged) and blends them by influence, but stacked Child Of constraints compound, so once
    the headset has moved more than a few cm from where it was worn the unplugged cord flies
    off in a long straight line. From the grip on, every hook (and the plug) is baked instead:
    each constraint is evaluated on its own and the hook keyed in world space on the rig's own
    path (worn -> route over the first half of the unplug, route -> wrapped round the earcup
    over the second), with the constraints switched off."""
    sc = bpy.context.scene
    hooks = list(rig.cord_hooks)
    if not hooks:
        return
    sc.frame_set(f0 - 1)
    base = {e.name: e.matrix_basis.copy() for e in hooks}
    want = {e.name: {} for e in hooks}
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ae = rig.arm.evaluated_get(dg)
        s_ = min(1.0, max(0.0, (f - f0) / float(unplug)))
        for e in hooks:
            pts = {}
            for c in e.constraints:
                if c.target is None:
                    continue
                if c.subtarget:
                    P_ = ae.matrix_world @ ae.pose.bones[c.subtarget].matrix
                else:
                    P_ = c.target.evaluated_get(dg).matrix_world
                pts[c.name] = P_ @ c.inverse_matrix @ base[e.name]
            if s_ < 0.5:
                a_, b_, t_ = pts['worn'], pts['route'], C.ease(s_ * 2.0)
            else:
                a_, b_, t_ = pts['route'], pts['unplugged'], C.ease((s_ - 0.5) * 2.0)
            la, ra, _ = a_.decompose()
            lb, rb, _ = b_.decompose()
            want[e.name][f] = (la.lerp(lb, t_), ra.slerp(rb, t_))
    for e in hooks:
        e.rotation_mode = 'QUATERNION'
        lb, rb, _ = base[e.name].decompose()
        e.location, e.rotation_quaternion = lb, rb
        e.keyframe_insert('location', frame=f0 - 1)
        e.keyframe_insert('rotation_quaternion', frame=f0 - 1)
        for c in e.constraints:
            ad = e.animation_data
            if ad and ad.action:
                for fc in list(C.fcurves(ad.action)):
                    if fc.data_path == f'constraints["{c.name}"].influence':
                        for kp in reversed(list(fc.keyframe_points)):
                            if kp.co.x >= f0 - 1:
                                fc.keyframe_points.remove(kp)
            c.influence = 1.0 if c.name == 'worn' else 0.0
            c.keyframe_insert('influence', frame=f0 - 1)
            c.influence = 0.0
            c.keyframe_insert('influence', frame=f0)
        for f, (loc, rq) in want[e.name].items():
            e.location, e.rotation_quaternion = loc, rq
            e.keyframe_insert('location', frame=f)
            e.keyframe_insert('rotation_quaternion', frame=f)
        for fc in C.fcurves(e.animation_data.action):
            for kp in fc.keyframe_points:
                if kp.co.x >= f0 - 1:
                    kp.interpolation = 'CONSTANT' if 'influence' in fc.data_path else 'LINEAR'


# ------------------------------------------------------------------ light

RIM = dict(dist=2.6, z=1.25, size=0.7, energy=26.0, pat=12.0, bounce=5.0, carpet=6.0)


def synergy_receivers(rig):
    objs = [o for o in rig.collection.all_objects if o.type in ('MESH', 'CURVE')]
    for o in ([rig.headset] + list(rig.headset.children_recursive) if rig.headset else []) + rig.cup_objects():
        if o.type in ('MESH', 'CURVE') and o not in objs:
            objs.append(o)
    return objs


def terminal_rims(room, rig):
    """The colleagues' screens light him from down the table: one soft card per screen on the
    line from his chest to it (2.6 m out, at shoulder height), its colour and level driven by the
    screen's own state, so his silhouette carries every colour and loses them one by one in the
    shutdown wave (each collapse flares white first); Pat's grey arrives last, faint. Light-linked
    to him alone (the walnut, chairs and walls keep the room's own CRT pools). Not seen by camera."""
    coll = C.collection('S11_light')
    recv = synergy_receivers(rig)
    lcoll = bpy.data.collections.get('S11_rim_receivers') or bpy.data.collections.new('S11_rim_receivers')
    for o in recv:
        if lcoll.objects.get(o.name) is None:
            lcoll.objects.link(o)
    sp = Vector(R.SYNERGY_POS)
    centre = Vector((sp.x, sp.y, 1.30))
    out = []
    for nm in list(R.SHUTDOWN_ORDER) + ['pat']:
        t = room.terminals[nm]
        scr = t.to_world((0.0, P.CRT['front'], P.CRT['zs']))
        d = scr - centre
        dirn = Vector((d.x, d.y, 0.0)).normalized()
        pos = centre + dirn * RIM['dist']
        pos.z = RIM['z']
        lt = C.area_light(f's11_rim_{nm}', tuple(pos), tuple(centre), 1.0, RIM['size'], RIM['size'],
                          color=tuple(t.light.data.color), coll=coll)
        lt.visible_camera = False
        lt.data.spread = math.radians(90)
        lt.light_linking.receiver_collection = lcoll
        E = RIM['pat'] if nm == 'pat' else RIM['energy'] * min(1.0, math.sqrt(6.0 / d.length))
        scr_o = t.screen
        v = [('on', scr_o, '["crt_on"]'), ('gain', scr_o, '["crt_gain"]'), ('sx', scr_o, '["crt_sx"]'),
             ('sy', scr_o, '["crt_sy"]'), ('flare', scr_o, '["crt_flare"]')]
        P.add_driver(lt.data, 'energy', f'{E:.3f}*on*gain*flare*(0.06+0.94*sx*sy)', v)
        out.append(lt)
    return out


def walnut_bounce():
    """The slab's warm bounce off the walnut in front of him (rig owner's note: the room as built
    gives his lower torso no light): it edges his hips, the left arm and the hand at the band."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s11_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                      RIM['bounce'], 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=C.collection('S11_light'))
    lt.visible_camera = False
    lt.visible_glossy = False
    return lt


def carpet_bounce(rig):
    """The skylight slab reaches over him (the sun leans 10 deg toward the head wall) and lands
    on the cobalt carpet behind him; that patch lifts his back a little, a cool low fill that
    keeps the faceted silhouette (and the arm taking the headset off) readable once the screens
    are dead. Light-linked to him alone; not seen by camera."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s11_carpet_bounce', (sp.x + 0.15, sp.y + 0.95, 0.04), (sp.x + 0.05, sp.y, 0.95),
                      RIM['carpet'], 1.3, 0.9, color=(0.62, 0.70, 1.0), coll=C.collection('S11_light'))
    lt.visible_camera = False
    lt.visible_glossy = False
    lt.light_linking.receiver_collection = bpy.data.collections['S11_rim_receivers']
    return lt


def hold_left_arm(rig, frame, from_frame):
    """Key the left arm, its fingers and thumb at `frame` exactly as evaluated at `from_frame`
    (S10's last keys), so nothing drifts through the long stillness."""
    sc = bpy.context.scene
    sc.frame_set(from_frame)
    bones = ['shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L'] + \
        [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + [f'thumb_{i}_L' for i in range(3)]
    qs = {b: rig.arm.pose.bones[b].rotation_quaternion.copy() for b in bones}
    for b, q in qs.items():
        rig.key_quat(b, frame, q, 'LINEAR')


# ------------------------------------------------------------------ checks

ARM_L = ['shoulder_L', 'pauldron_L', 'upperarm_L', 'forearm_L', 'hand_L'] + \
    [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + [f'thumb_{i}_L' for i in range(3)]


def report(rig, room, cam, frames=None):
    """Clearances that matter on camera, frame by frame: the left arm against his body, head,
    cup and the headset; the headset against his body (deepest point, and whether the camera can
    see any of it); the jack in frame."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    arm = rig.parts_on_bones(ARM_L)
    arm_names = {o.name for o in arm}
    body = [o for o in rig.collection.all_objects if o.type == 'MESH' and o.name not in arm_names and
            not o.name.startswith(f'{rig.name}_headset')]
    hs = [o for o in rig.headset.children_recursive if o.type == 'MESH'] if rig.headset else []
    cupm = [o for o in rig.cup_objects() if o.type == 'MESH']
    body = [o for o in body if o not in hs and o not in cupm]
    ign = (('thumb', 'palm'), ('index_1', 'palm'), ('middle_1', 'palm'), ('ring_1', 'palm'), ('pinky_1', 'palm'),
           ('forearm', 'upperarm'), ('palm', 'forearm'), ('shoulder_hub', 'upperarm'), ('pauldron', 'shoulder_hub'),
           ('pauldron', 'upperarm'), ('bicep', 'upperarm'), ('bicep', 'forearm'), ('bicep', 'shoulder'))
    sc.frame_set(START)
    cup0 = rig.cup.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.copy() if rig.cup else None
    drift = 0.0
    for f in range(START, END + 1, 4):
        sc.frame_set(f)
        if cup0 is not None:
            m_ = rig.cup.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world
            drift = max(drift, (m_.translation - cup0.translation).length,
                        math.radians(1) * 0 + (m_.to_quaternion().rotation_difference(cup0.to_quaternion()).angle * 0.1))
    print(f'S11 CHECK the cup: worst drift over the shot {drift * 1000:.2f} mm (rotation counted at 0.1 m/rad)', flush=True)
    for f in frames or [993, 995, 1000, 1060, 1110, 1113] + list(range(1120, 1153)):
        r = rig.overlap_report(f, arm, body + cupm + (hs if f < GRIP else []), ignore=ign)
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        deep = vis = 0.0
        deep_o = ''
        if hs and f >= GRIP - 1:
            tree = _bvh(body + cupm, dg)
            owners = []
            for o in body + cupm:
                if o.type in ('MESH', 'CURVE'):
                    try:
                        n_ = len(o.evaluated_get(dg).to_mesh().polygons)
                        o.evaluated_get(dg).to_mesh_clear()
                    except RuntimeError:
                        n_ = 0
                    owners.append((o.name, n_))
            camp = cam.matrix_world.translation
            for o in hs:
                vs, _, _ = _mesh_world(o, dg)
                for q in vs[::2]:
                    loc, nor, _, dist = tree.find_nearest(q, 0.08)
                    if loc is not None and (q - loc).dot(nor) < 0.0:
                        if dist > deep:
                            acc_ = 0
                            loc2, nor2, idx2, _d2 = tree.find_nearest(q, 0.08)
                            for nm_, n_ in owners:
                                if idx2 < acc_ + n_:
                                    deep_o = f'{o.name}->{nm_}'
                                    break
                                acc_ += n_
                        deep = max(deep, dist)
                        d_ = loc - camp
                        hit, hp, *_ = sc.ray_cast(dg, camp, d_.normalized(), distance=d_.length + 0.002)
                        if hit and (hp - loc).length < 0.004:
                            vis = max(vis, dist)
        jw = room.jack.root.matrix_world.translation
        uv = world_to_camera_view(sc, cam, jw)
        top = 0.0
        for o in hs:
            vs, _, _ = _mesh_world(o, dg)
            top = max(top, max(world_to_camera_view(sc, cam, q).y for q in vs[::7]))
        worst = sorted(r.items(), key=lambda kv: -kv[1])[:3]
        print(f'S11 CHECK f{f}: arm x body {sum(r.values()):4d} pairs {worst}  headset in body {deep * 1000:4.1f} mm '
              f'(visible {vis * 1000:4.1f} mm) {deep_o}  jack at image ({uv.x:.2f}, {uv.y:.2f})  headset top y {top:.3f}', flush=True)


# ------------------------------------------------------------------ build

def build(args):
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    rig = S.build(timeline=F.FaceTimeline(START, END), location=R.SYNERGY_POS)
    t1 = time.time()
    S10, sol10 = s10_handover(rig, room)
    t2 = time.time()
    jack_drop(room)
    release_hand(rig, S10)
    hold_left_arm(rig, RISE[0], F_RELEASE + 3)
    head_moves(rig)
    t3 = time.time()
    headset_off(rig, room, sol10)
    t4 = time.time()
    f, cam = R.preview_camera(room, 's11_shutdown')
    sc.camera = cam
    if os.environ.get('S11_ZOOM'):                  # debug: same lens position, magnified on a point
        z_, *aim = [float(x) for x in os.environ['S11_ZOOM'].split(',')]
        cam.data.lens *= z_
        C.look_at(cam, Vector(aim))
        cam.data.dof.use_dof = False
    if os.environ.get('S11_DEBUGLIGHT'):            # debug: flat grey world so the forms read
        dl = C.area_light('s11_debug_fill', tuple(cam.matrix_world.translation + Vector((0.0, 0.0, 0.4))),
                          (0.1, 0.3, 1.3), float(os.environ['S11_DEBUGLIGHT']), 2.0)
        dl.visible_camera = False
    terminal_rims(room, rig)
    walnut_bounce()
    carpet_bounce(rig)
    room.render_budget(kind='wide', samples=args.samples or None, locked=True)
    room.compositor()
    room.tune_scanlines(cam)
    sc.frame_set(START)
    if DEBUG:
        report(rig, room, cam)
    print(f'S11 BUILD room+rig {t1 - t0:.1f}s  s10 hand {t2 - t1:.1f}s  jack+head {t3 - t2:.1f}s  headset '
          f'{t4 - t3:.1f}s  total {time.time() - t0:.1f}s', flush=True)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
