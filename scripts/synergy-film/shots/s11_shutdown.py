"""S11 · f993-1152 · E2_LONG_ROOM (lit to dark): the shutdown.

    blender -b --factory-startup -P shots/s11_shutdown.py -- --quality proof --only 993,995,1001,1036,1049,1061,1085,1097,1108,1113,1120,1124,1129,1135,1140,1145,1150,1152
    blender -b --factory-startup -P shots/s11_shutdown.py -- --quality final
    S11_DEBUG=1 ... -- --no-render          the gates (report): arm pops and speeds, frame-top headroom,
                                            clearances, hand x jack, the jack's stillness, cup drift;
                                            also re-runs the headset rest search (warns if HEADSET_REST moved)

Camera: env_room's approved 's11_shutdown' framing, unchanged: 32 mm f/5.6 focused on him
(2.3 m), lens 1.6 m up, 1.4 m to his left and 1.8 m behind, panned 20 deg across the table and
tilted 10.5 deg down; him at frame right, every screen and Pat clear of his silhouette, the
table receding to the vanishing point frame left. Locked off for the whole shot (fixed sampling
seed): the comedy is stillness. No Room.front_bokeh: this lens looks down the table at the real
screens, so disc stand-ins floating in the dark above them would contradict the frame.

The beats (film frames, 90 BPM = 16 frames a beat, 24 fps; TREATMENT.md S11):
  f993      S10's last frame (S10.handover keys its whole left-hand performance, the jack and the
            master cord, so the cut is exact whatever S10 settles on): the lean from the waist, the
            cup at chest height in the right hand (rig.lean(keep_cup=True)), the gold jack pinched.
  f993-995  the pads part (index and thumb; the jack stays in the pinch through f995, so nothing
            passes through a finger; the other three fingers, curled under the barrel and its coil,
            relax open over f997-1000, after it has gone); f996 on, the jack falls on its coiled cord
            over the head edge (S10.CORD_EDGE): a damped spring-mass, the coil catching it with a
            small bounce, swinging pin-down under the edge, blended to rest over f1015-1040 and
            dead still from f1040. The cord's last two free points drape down the edge face, below
            the walnut's bottom corner. The hand holds exactly where it let go.
  f1001     the shutdown wave (Room.shutdown_wave: Synthia, Keys, Arjun, Kevin, Strategy,
            Operations, People & Culture, Linda, one every 5 frames): field -> white line (4 f)
            -> dot (3 f) -> black, 10 f afterglow; each collapse flares its colour on the walnut
            and, through a screen-driven rim card per colleague, on his silhouette (inverse-square
            from the screen, so the far colleagues are whispers and the colour drains near to far).
  f1001-1055 the room's ambient falls with the wave (Room.set_state ramp) instead of popping.
  f1049     the printer's lime LED dies and its last sheet stops half-fed; the droid's pinlight
            goes out (both at the foot, tiny at the vanishing point: sound carries it).
  f1061-1084 darkness: the slab on the walnut and the brass channel; he is rim-lit from above.
  f1085-1092 far down the table Pat's dead screen comes on, a soft grey glow (crt_level and its
            glow light at 0.45x, full bloom), the degauss shimmer gone by f1092.
  f1097-1108 his head turns 6 deg toward Pat (his right), eased.
  f1109-1113 the film's only head dip: 8 deg down over 5 frames (neck 3 + head 5, the A-frame
            pistons closing as a pair); f1114-1120 back up over 7.
  f1121-1128 the left hand rises: one C1 curve from where it let go of the jack, out and up in
            front of the pauldron (the wrist kept >= 0.3 m from the shoulder joint, which retracts
            out of the 60 deg S10 reach early), up outside the earcup, then in to the band from the
            side, level with it (never above the grip), fingers open, thumb laid back. Timed by arc
            length with raised-cosine ramps of 2.5 frames: 22 mm on f1121, ~185 mm/frame at the
            peak (1.2 m in 9 frames: a shorter route takes the wrist past the shoulder joint and
            flips the elbow). The hand turns its 156 deg to the grip over the whole rise.
  f1129     it grips the band just above the left earcup (rig.grip_headband): head -> hand.
  f1129-1135 the lift: 7 cm up and 4.5 cm out to his left (the band's left side rolled up 8 deg,
            the boom tipped forward off the jaw), as high as the approved framing allows: the band
            already sits at the crown, 10% below the frame top, so the treatment's 10 cm would put
            the headset at 0.98 of frame height; at 7 cm its highest point is at 0.94 (gate 0.95).
  f1135-1150 one deliberate move: out, round and down to the walnut beside the hub, turning
            ~90 deg about the vertical over f1135-1149 (10 deg a frame at most; the right earcup swings
            round in front of his face, on the far side of his head from the lens), never rising,
            the last 22 cm straight down onto its earcups (HEADSET_REST: earcups in line down the
            table, clear of the hub, the padlock and the master cord, in the slab's edge); 0.91 m
            at ~84 mm/frame (2.0 m/s) at the peak, velocity continuous from the lift; f1150 hand
            -> table.
  f1150-1152 his fingers ease open on the band; nothing else moves. Cut to Offline at night.
The arm: only key poses are searched for clearance (chest, head, pauldron: every 2 frames on the
carry, each held near the last, then lightly smoothed); between them the shoulder angles and the
elbow pole are interpolated (Catmull-Rom) and only the wrist is solved, so the arm never pops (the
report gates it frame by frame). The cup never moves. One head dip. He never walks. No text.

Hand-over to S13/S14 (HEADSET_REST, YAW_DEG and JACK_REST below are authoritative; S13 and S14
import them): the headset stands on its earcups on the walnut; the jack hangs pin-down on its
coil under the head edge, out of the socket (the meeting stays unplugged), with the master
cord's last two control points draped down the edge face. His body at f1152: the S10 lean (8 deg
from the waist) is still in, the head yawed YAW_DEG toward Pat, the left hand on the set-down
headset. S13 starts upright, head kept at YAW_DEG, left arm at idle: the S12 cutaway (4 s) covers
that reset (director to confirm).

Light: the room as built plus, unseen by the lens: one card per colleague on the line to its
screen, driven by that screen's state, light-linked to him, diffuse only; the slab's warm bounce
off the walnut in front of him (the rig owner's note); the slab's cool bounce off the carpet
behind him; and a slab-coloured kicker that follows the headset (in front of and above it),
light-linked to the headset alone and constant through the shot, so the black headset keeps a
rim against the black room through the lift, the carry and at rest.
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
F_RELEASE = 995                 # the pads have parted (from f993); the jack falls from f996
F_WAVE = 1001                   # Synthia collapses first; a screen every 5 frames, near to far
F_PRINTER = 1049                # the printer's LED dies, its last sheet stops half-fed
F_DARK = 1053                   # the room's ambient fills are down (env_room demo_timeline)
F_PAT = 1085                    # Pat powers on: dot, line, field, 6-frame degauss (to f1092)
YAW = (1096, 1108)              # head turns 6 deg toward Pat (rest key, end key)
DIP = (1108, 1113, 1120)        # the film's only head dip: 8 deg down over 5 frames, up over 7
RISE = (1120, 1128)             # the left hand rises to the band (last still frame, arrival)
GRIP = 1129                     # grips the band above the left earcup: headset head -> hand
LIFT_UP = 1135                  # the lift is done (up and out) ...
SET = 1150                      # ... one move down to the walnut beside the hub: headset hand -> table
JACK_SETTLE = (1015, 1040)      # the swinging jack is blended to its hanging rest over these frames

# Where the headset rests from f1150 to the end of the film (S13, S14): the headset empty's world
# location and rotation (w, x, y, z). Standing on its earcups beside the hub. S11_DEBUG re-runs
# the search that found it and warns if a rig change moves it more than 1 mm.
HEADSET_REST = ((0.3, -0.25, 0.8221), (0.70182, -0.0867, -0.08595, 0.70182))
# Where the jack hangs from f1040 to the end of the film (S13, S14 key it so the meeting stays
# unplugged): the jack root's world location and rotation, and the master cord's draped control
# points. Printed by every build ('S11 JACK_REST'); S11_DEBUG warns if it moved.
JACK_REST = dict(root=((0.292, 0.0065, 0.5574), (0.70708, 0.70708, 0.00618, 0.00618)),
                 mids={'mid3': (0.292, 0.0105, 0.72), 'mid4': (0.292, 0.0105, 0.6346)})

YAW_DEG = -6.0                  # toward his right (Pat's side)
DIP_NECK, DIP_HEAD = 3.0, 5.0   # the dip, shared so the neck's A-frame pistons work as a pair


def ease(t):
    return C.ease(t, 'inout')


def smooth(t):
    """Cubic smoothstep (peak rate 1.5x the mean, gentler than common.ease's smootherstep)."""
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


# ------------------------------------------------------------------ the room's side of the film

PAT_LEVEL = 0.45                # Pat's field level x this: a soft grey disc and glow, not a white card


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
    pat = room.terminals['pat']
    pat.power_on(F_PAT)
    # the treatment's degauss window is f1085-1092: the shimmer is gone on f1092, not f1093
    pat.key(F_PAT + 7, 'LINEAR', deg=0.0)
    # Pat is a soft grey glow 23 m away (#8a8a8a at low emission), not a white card
    pat.screen['crt_level'] = float(pat.screen['crt_level']) * PAT_LEVEL
    pat.screen['crt_bloom'] = 1.0
    # ... and its glow light (the pool on the walnut and the case's chin under the glass) with it
    ad = pat.light.data.animation_data
    fc = ad.drivers.find('energy') if ad else None
    if fc is not None:
        fc.driver.expression = f'({fc.driver.expression})*{PAT_LEVEL:.3f}'


# ------------------------------------------------------------------ S10 hand-over

def s10_handover(rig, room):
    """S10's left-hand performance, the jack and the master cord, keyed by S10 itself
    (S10.handover: left_hand, key_jack, room.master.pulled, cord_follow), so f993 is S10's f992."""
    import s10_jack as S10
    sol = S10.handover(rig, room)
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

JACK = dict(slack=0.100,                     # cord length that hangs free before the coil takes the load
            k=220.0, zeta=0.40,              # coil stiffness (per unit mass, 1/s^2) and damping ratio
            face_y=0.0065,                   # the barrel's axis keeps off the head edge's face (walnut)
            k_rot=160.0, zeta_rot=0.55, drag=3.0)      # the jack swinging round to hang pin-down on its cord


def jack_edge(S10):
    """Where the master cord rolls over the head edge (S10's re-laid route), just off the face."""
    e = Vector(S10.CORD_EDGE)
    return Vector((e.x, JACK['face_y'], e.z - 0.002))


def jack_drop(room, S10):
    """f996 on: released from the pinch (held there through f995 while the pads part), the jack
    falls on its coiled cord over the head edge. A damped spring-mass on the cord (the free run
    slack first, then the coil takes the load and catches it: the small bounce), the barrel
    swinging round to hang pin-down, a short sway under the edge (the walnut's head-edge face is a
    collider), blended to its hanging rest over JACK_SETTLE, dead still after. The cord's last two
    free points drape down the edge face to below the walnut's bottom corner. Keyed every frame
    (LINEAR) so motion blur sees the true path."""
    sc = bpy.context.scene
    jr = room.jack.root
    sc.frame_set(F_RELEASE)
    M0 = jr.matrix_world.copy()
    tl = room.jack.tail_local.y
    a = (M0.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()     # barrel axis, toward the cord
    p = M0 @ Vector((0.0, tl, 0.0))                                 # cord exit (tail)
    v = Vector((0.0, 0.0, 0.0))
    w = Vector((0.0, 0.0, 0.0))                                     # angular velocity of the axis
    E = jack_edge(S10)
    k, c = JACK['k'], 2.0 * JACK['zeta'] * math.sqrt(JACK['k'])
    kr, cr = JACK['k_rot'], 2.0 * JACK['zeta_rot'] * math.sqrt(JACK['k_rot'])
    g = Vector((0.0, 0.0, -9.81))
    dt = 1.0 / C.FPS
    sub = 16
    R0 = M0.to_3x3()
    a0 = a.copy()
    zb = R.ROOM['table_bottom_z']
    if DEBUG:
        print(f'S11 JACK start: tail {tuple(round(x, 3) for x in p)} edge {tuple(round(x, 3) for x in E)} '
              f'dist {(E - p).length:.3f} tail_local {tl:.4f} axis {tuple(round(x, 2) for x in a)}', flush=True)
    out = {}
    contacts = []
    for f in range(F_RELEASE + 1, END + 3):
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
            if zb - 0.01 < p.z < R.TABLE_TOP + 0.004 and p.y < lo:
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
        out[f] = Matrix.Translation(p - a * tl) @ Rm.to_4x4()
    # its hanging rest: straight down under the edge, the coil stretched by the jack's weight
    p_eq = E - Vector((0.0, 0.0, JACK['slack'] + 9.81 / JACK['k']))
    a_eq = Vector((0.0, 0.0, 1.0))
    M_eq = Matrix.Translation(p_eq - a_eq * tl) @ (a0.rotation_difference(a_eq).to_matrix() @ R0).to_4x4()
    l_eq, q_eq, _ = M_eq.decompose()
    for f in out:
        t = smooth((f - JACK_SETTLE[0]) / float(JACK_SETTLE[1] - JACK_SETTLE[0]))
        if t > 0.0:
            l_, q_, _ = out[f].decompose()
            if q_.dot(q_eq) < 0:
                q_ = -q_
            out[f] = Matrix.Translation(l_.lerp(l_eq, t)) @ q_.slerp(q_eq, t).to_matrix().to_4x4()
    jr.rotation_mode = 'QUATERNION'
    for f in sorted(out):
        jr.matrix_world = out[f]
        jr.keyframe_insert('location', frame=f)
        jr.keyframe_insert('rotation_quaternion', frame=f)
    for fc in C.fcurves(jr.animation_data.action):
        for kp in fc.keyframe_points:
            if kp.co.x >= F_RELEASE:
                kp.interpolation = 'LINEAR'
    # the cord's last two free points drape down the edge face, below the walnut's bottom corner,
    # so the coil between them and the jack never cuts the walnut (the jack swings under the table)
    mc = room.master
    names = list(mc.mids)
    lip = Vector((E.x, JACK['face_y'] + 0.004, R.TABLE_TOP - 0.030))
    low = Vector((E.x, JACK['face_y'] + 0.004, zb - 0.025))
    drape = {}
    for nm, which in zip(names[-2:], ('lip', 'low')):
        e = mc.e[nm]
        sc.frame_set(F_RELEASE)
        base = e.matrix_world.translation.copy()
        e.keyframe_insert('location', frame=F_RELEASE)
        for f in range(F_RELEASE + 1, END + 3):
            tail = out[f] @ Vector((0.0, tl, 0.0))
            t = min(1.0, (f - F_RELEASE) / 4.0)
            if which == 'lip':
                tgt = lip.copy()
            else:
                tgt = low.lerp(tail, 0.25) if tail.z < low.z else low.copy()
                tgt.y = max(tgt.y, JACK['face_y'] + 0.004)     # in front of the face until below its corner
                tgt.z = min(tgt.z, zb - 0.02)
            e.location = base.lerp(tgt, C.ease(t, 'out'))
            e.keyframe_insert('location', frame=f)
            drape[nm] = tuple(round(x, 4) for x in e.location)
        for fc in C.fcurves(e.animation_data.action):
            for kp in fc.keyframe_points:
                if kp.co.x >= F_RELEASE:
                    kp.interpolation = 'LINEAR'
    l_, q_, _ = out[END].decompose()
    rest = dict(root=(tuple(round(x, 4) for x in l_), tuple(round(x, 5) for x in q_)), mids=drape)
    print(f'S11 JACK_REST = {rest}', flush=True)
    if (Vector(JACK_REST['root'][0]) - l_).length > 0.001:
        print('S11 NOTE: the jack rest differs from JACK_REST: update it for S13/S14', flush=True)
    if DEBUG:
        for f in (996, 997, 998, 999, 1000, 1001, 1003, 1006, 1010, 1020, 1030, 1040):
            o = out[f].translation
            print(f'S11 JACK f{f}: origin ({o.x:.3f}, {o.y:.3f}, {o.z:.3f})  axis.z '
                  f'{(out[f].to_3x3() @ Vector((0, 1, 0))).z:+.2f}', flush=True)
        print('S11 JACK edge contacts on frames', sorted(set(contacts)), flush=True)
    return out


def jack_at_rest(room, frame):
    """For S13/S14: key the jack hanging where S11 left it (JACK_REST) and the master cord's draped
    control points at `frame` (call after room.master.pulled()), so the meeting stays unplugged."""
    jr = room.jack.root
    jr.rotation_mode = 'QUATERNION'
    jr.matrix_world = Matrix.Translation(JACK_REST['root'][0]) @ Quaternion(JACK_REST['root'][1]).to_matrix().to_4x4()
    jr.keyframe_insert('location', frame=frame)
    jr.keyframe_insert('rotation_quaternion', frame=frame)
    for nm, p in JACK_REST['mids'].items():
        e = room.master.e[nm]
        e.location = p
        e.keyframe_insert('location', frame=frame)


FINGER_BONES = [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]


def release_hand(rig, S10):
    """f993-995: the pads part (index and thumb, from exactly S10's last pinch, the knuckle's 1
    degree included), so they are clear of the jack before it moves on f996; the other three
    fingers, curled under the barrel and its coil, hold until the jack has gone (f997) and relax
    open by f1000. The hand then holds exactly where it let go."""
    sc = bpy.context.scene
    sc.frame_set(START - 1)
    pinch = {b: rig.arm.pose.bones[b].rotation_quaternion.copy() for b in FINGER_BONES}
    for b in FINGER_BONES:
        rig.key_quat(b, START, pinch[b], 'BEZIER')
    S10.key_fingers(rig, F_RELEASE, 'index', S10.OPEN_FINGERS['index'], 'BEZIER')
    S10.key_thumb(rig, F_RELEASE, S10.GAP_OPEN, 'BEZIER')
    for nm in ('middle', 'ring', 'pinky'):
        for b in (f'{nm}_{i}_L' for i in (1, 2, 3)):
            rig.key_quat(b, F_RELEASE + 2, pinch[b], 'BEZIER')
        S10.key_fingers(rig, F_RELEASE + 5, nm, S10.OPEN_FINGERS[nm], 'BEZIER')


# ------------------------------------------------------------------ paths and speed profiles

def speed_profile(T, dist, v0=0.0, v1=0.0, a=2.5, b=2.5):
    """(s(t), V): arc length after t frames (0..T) of a move of `dist`: a raised-cosine ramp from
    v0 to V over `a` frames, V held, a raised-cosine ramp to v1 over the last `b` frames; V solved
    so s(T) = dist. Velocity and acceleration are continuous; the peak speed is V."""
    a = min(a, T)
    b = min(b, T - a)
    c = T - a - b
    V = (dist - v0 * a / 2.0 - v1 * b / 2.0) / (a / 2.0 + c + b / 2.0)

    def ramp(u, L, va, vb):
        if L <= 0.0:
            return 0.0
        return va * u + (vb - va) / 2.0 * (u - L / math.pi * math.sin(math.pi * u / L))
    sa = ramp(a, a, v0, V)
    sc_ = sa + V * c

    def s(t):
        t = min(T, max(0.0, t))
        if t <= a:
            return ramp(t, a, v0, V)
        if t <= a + c:
            return sa + V * (t - a)
        return sc_ + ramp(t - a - c, b, V, v1)
    return s, V


class Bezier:
    """A cubic Bezier with an arc-length table: at_s(s) for 0 <= s <= length."""

    def __init__(self, pts, n=600):
        self.P = [Vector(p) for p in pts]
        self.t = [i / float(n) for i in range(n + 1)]
        q = [self.at_t(t) for t in self.t]
        self.cum = [0.0]
        for i in range(1, len(q)):
            self.cum.append(self.cum[-1] + (q[i] - q[i - 1]).length)
        self.length = self.cum[-1]

    def at_t(self, t):
        P0, P1, P2, P3 = self.P
        u = 1.0 - t
        return P0 * (u * u * u) + P1 * (3 * u * u * t) + P2 * (3 * u * t * t) + P3 * (t * t * t)

    def at_s(self, s):
        s = min(self.length, max(0.0, s))
        lo, hi = 0, len(self.cum) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.cum[mid] < s:
                lo = mid
            else:
                hi = mid
        d = self.cum[hi] - self.cum[lo]
        f = (s - self.cum[lo]) / d if d > 1e-12 else 0.0
        return self.at_t(self.t[lo] + (self.t[hi] - self.t[lo]) * f)


def _cr(keys, x):
    """Catmull-Rom (C1) through [(x, Vector)] keys at uneven x; flat tangents at the ends."""
    xs = [k_[0] for k_ in keys]
    if x <= xs[0]:
        return keys[0][1].copy()
    if x >= xs[-1]:
        return keys[-1][1].copy()
    i = max(j for j in range(len(xs) - 1) if xs[j] <= x)
    (x0, p0), (x1, p1) = keys[i], keys[i + 1]

    def tan(j):
        if j == 0 or j == len(keys) - 1:
            return p0 * 0.0
        return (keys[j + 1][1] - keys[j - 1][1]) / float(keys[j + 1][0] - keys[j - 1][0])
    h = float(x1 - x0)
    t = (x - x0) / h
    m0, m1 = tan(i) * h, tan(i + 1) * h
    t2, t3 = t * t, t * t * t
    return p0 * (2 * t3 - 3 * t2 + 1) + m0 * (t3 - 2 * t2 + t) + p1 * (-2 * t3 + 3 * t2) + m1 * (t3 - t2)


# ------------------------------------------------------------------ the headset comes off

# lift: where the grip point is at LIFT_UP (offset from the grip, world) and the headset's turn
# about the grip there (yaw, roll, pitch: world Z, Y, X; roll < 0 lifts his left side, pitch > 0
# tips the boom forward off the jaw). up is capped by the frame top (report: 0.95).
HS = dict(lift=(0.045, -0.010, 0.070), lift_rot=(-4.0, -8.0, 8.0),
          carry_dir=(0.85, -0.53), carry_out=0.14, drop=0.22, mid_speed=0.012, turn=(LIFT_UP, SET - 1),
          carry_keys=(1131, 1133, LIFT_UP, 1137, 1139, 1141, 1143, 1145, 1147, SET), smooth=1,
          # the rise: waypoints off the grip (wrist, world): in front of the pauldron, then outside
          # the earcup just under the band (the approach); the first tangent (up, a little out)
          rise_via=((0.19, -0.233, -0.343), (0.13, -0.010, -0.020)), rise_t0=(0.3, 0.2, 1.0),
          rise_keys=(), rise_sched=((0.35, 0.7, 0.4),), ramp=2.5, turn_ramp=2.0, turn_frac=1.0, w_pole=3.0,
          slab_pref=0.5,
          rest_yaw=(60.0, 110.0), rest_x=(0.30, 0.62), rest_y=(-0.40, -0.10), clear=0.025, reach=0.565)
SH_OFFS = [(0, 0, 0), (6, 0, 0), (-6, 0, 0), (0, 5, 0), (0, -5, 0), (10, 4, 0), (-10, 4, 0), (12, -4, 0)]
AXES6 = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))
FRAME_TOP = 0.95                # highest image point of hand and headset (of frame height)


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


def search_rest(rig, room, E0, Th0, loc_v, com):
    """The rest on the walnut that found HEADSET_REST: the stable face nearest to upright, a
    heading and a place the hand reaches, clear of the hub, the padlock and the master cord, in
    the slab's light. Slow (11 x 33 x 31 poses): only run under S11_DEBUG."""
    sc = bpy.context.scene
    E0i = E0.inverted()
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
                    loc, _, _, dist = obst_tree.find_nearest(o3 + q, 0.2)
                    if loc is not None:
                        clear = min(clear, dist)
                if clear < HS['clear']:
                    continue
                score = (reach + 0.25 * abs(yaw - 90.0) / 90.0 - 0.3 * min(clear, 0.08) +
                         HS['slab_pref'] * max(0.0, x - 0.30))
                if best is None or score < best[0]:
                    best = (score, yaw, x, y, reach, clear, T)
    if best is None:
        raise RuntimeError('S11: no reachable rest for the headset beside the hub')
    _, yaw_r, xr, yr, reach_r, clear_r, T_rest = best
    loc_r, q_r, _ = T_rest.decompose()
    # the authoritative rest (S13 and S14 hold it): still clear, still reachable?
    T_c = Matrix.Translation(HEADSET_REST[0]) @ Quaternion(HEADSET_REST[1]).to_matrix().to_4x4()
    clear_c = 1.0
    for q in loc_v[::6]:
        loc, _, _, dist = obst_tree.find_nearest(T_c @ q, 0.2)
        if loc is not None:
            clear_c = min(clear_c, dist)
    reach_c = ((T_c @ K).translation - Sh).length
    print(f'S11 HEADSET_REST (authoritative): clear of hub/padlock/cord by {clear_c * 1000:.0f} mm, hand reach '
          f'{reach_c:.3f} m', flush=True)
    if (loc_r - Vector(HEADSET_REST[0])).length > 0.001 or \
            q_r.rotation_difference(Quaternion(HEADSET_REST[1])).angle > 0.01:
        print('S11 NOTE: the rest search now prefers another place (below); HEADSET_REST is kept for S13/S14 '
              f'{"(still clear)" if clear_c > 0.010 and reach_c <= HS["reach"] else "- AND IT IS NO LONGER CLEAR: WARNING"}',
              flush=True)
    print(f'S11 HEADSET rest search: ({tuple(round(c, 4) for c in loc_r)}, {tuple(round(c, 5) for c in q_r)}) '
          f'heading {yaw_r:.0f} deg at ({xr:.3f}, {yr:.3f}), stable face {tuple(round(c, 2) for c in n_up)} '
          f'(margin {margin * 1000:.0f} mm), hand reach {reach_r:.3f} m, clear by {clear_r * 1000:.0f} mm', flush=True)
    return T_rest


def _hand_frame(rig, Th, frame):
    """Hand-bone world matrix -> (wrist, u, w) in chest-rest space at `frame` (place_arm's)."""
    hd = rig.hands['L']
    Rd = Th.to_3x3() @ (rig.arm.matrix_world.to_3x3() @ rig._rest['hand_L'].to_3x3()).inverted()
    Dc = rig._chest_delta(frame)
    R3 = Dc.to_3x3()
    return Dc @ Th.translation, (R3 @ (Rd @ hd['u'])).normalized(), (R3 @ (Rd @ hd['w'])).normalized()


def _key_pose(rig, frame, Th, base_pole, base_sh, fingers=None, thumb=None, w_pole=2.0, w_sh=0.012):
    """A searched arm pose for a key frame: the elbow pole and shoulder round the given base (the
    interpolated or previous key's), clear of chest, head and pauldron, held near the base so
    neighbouring keys stay one continuous family. Not keyed."""
    wrist, u, w = _hand_frame(rig, Th, frame)
    p0 = Vector(base_pole).normalized()
    poles = [p0] + [(p0 + Vector(q) * k_).normalized() for k_ in (0.15, 0.35) for q in AXES6]
    shs = [tuple(float(b_ + d_) for b_, d_ in zip(base_sh, dd)) for dd in SH_OFFS]

    def prefer(hu, hw, pole, sh, chain):
        return w_pole * (Vector(pole).normalized() - p0).length + \
            w_sh * (abs(sh[0] - base_sh[0]) + abs(sh[1] - base_sh[1]))
    return rig.solve_arm_clear('L', wrist, [(u, w)], poles, shs, fingers=fingers, thumb=thumb, prefer=prefer)


def _place(rig, frame, Th, pole, sh, fingers=None, thumb=None):
    """Key the arm at `frame` with a FIXED pole and shoulder (only the wrist solved). Returns the
    solution (with its penetration, for the report)."""
    wrist, u, w = _hand_frame(rig, Th, frame)
    sol = rig.solve_arm_clear('L', wrist, [(u, w)], [Vector(pole).normalized()], [tuple(float(x) for x in sh)],
                              fingers=fingers, thumb=thumb)
    rig.place_arm(frame, 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], 'LINEAR', shoulder=sol['shoulder'])
    return sol


def _smooth_keys(kx, n):
    """Laplacian smoothing of the interior keys' poles and shoulders (the ends stay)."""
    for _ in range(n):
        out = [kx[0]]
        for i in range(1, len(kx) - 1):
            (_, pa_, sa_), (x, p_, s_), (_, pb_, sb_) = kx[i - 1], kx[i], kx[i + 1]
            out.append((x, (pa_.normalized() * 0.25 + p_.normalized() * 0.5 + pb_.normalized() * 0.25).normalized(),
                        sa_ * 0.25 + s_ * 0.5 + sb_ * 0.25))
        out.append(kx[-1])
        kx = out
    return kx


def _arm_through(rig, frames, Ths, kx, xs, fingers=None, thumb=None):
    """Key the arm on every frame: the shoulder angles and the elbow pole by Catmull-Rom over x
    (frame or path fraction) through the keys kx = [(x, pole, shoulder)], only the wrist solved."""
    pk = [(x, Vector(p_).normalized()) for x, p_, _ in kx]
    sk = [(x, Vector(s_)) for x, _, s_ in kx]
    sols = {}
    for f in frames:
        pole = _cr(pk, xs[f]).normalized()
        sh = _cr(sk, xs[f])
        sols[f] = _place(rig, f, Ths[f], pole, tuple(sh), fingers=fingers, thumb=thumb)
    return sols


class Spline:
    """A C1 curve through points with unit tangents (interior: the bisector of the chords; the
    ends as given), one cubic per span with handles a third of the chord long; arc-length table
    over the whole: at_s(s), s_of_point(i) (arc length at the i-th point)."""

    def __init__(self, pts, t_start, t_end):
        pts = [Vector(p) for p in pts]
        tans = []
        for i, p in enumerate(pts):
            if i == 0:
                tans.append(Vector(t_start).normalized())
            elif i == len(pts) - 1:
                tans.append(Vector(t_end).normalized())
            else:
                tans.append(((p - pts[i - 1]).normalized() + (pts[i + 1] - p).normalized()).normalized())
        self.segs = []
        for i in range(len(pts) - 1):
            c = (pts[i + 1] - pts[i]).length
            self.segs.append(Bezier((pts[i], pts[i] + tans[i] * (c / 3.0), pts[i + 1] - tans[i + 1] * (c / 3.0),
                                     pts[i + 1])))
        self.starts = [0.0]
        for b in self.segs:
            self.starts.append(self.starts[-1] + b.length)
        self.length = self.starts[-1]

    def at_s(self, s):
        s = min(self.length, max(0.0, s))
        i = max(j for j in range(len(self.segs)) if self.starts[j] <= s + 1e-12)
        return self.segs[i].at_s(s - self.starts[i])

    def zmax(self, n=200):
        return max(self.at_s(self.length * k / n).z for k in range(n + 1))


def _grip_setup(rig):
    """The grip at f1129 (rig.grip_headband, keyed) and what the rise and the carry need: the hand
    and headset there, the grip's finger curl and thumb."""
    sol_g = rig.grip_headband(GRIP, 'LINEAR')
    fing = {nm: [a_ * sol_g['curl'] * k_ for a_ in S.FIST] for nm, k_ in (('index', 0.9), ('middle', 1.0),
                                                                          ('ring', 1.05), ('pinky', 1.1))}
    thumb = rig.thumb_curl_rots('L', sol_g['thumb'])
    sc = bpy.context.scene
    sc.frame_set(GRIP)
    dg = bpy.context.evaluated_depsgraph_get()
    E0 = rig.headset.evaluated_get(dg).matrix_world.copy()
    Th0 = rig._bone_world('hand_L', GRIP)
    return dict(sol_g=sol_g, fing=fing, thumb=thumb, E0=E0, Th0=Th0, grip0=Th0.translation.copy(),
                grip_key=dict(pole=Vector(sol_g['pole']), shoulder=tuple(float(x) for x in sol_g['shoulder'])))


def key_rise(rig, ctx, sol10, hs=None):
    """f1120 -> f1129: the hand from where it let go of the jack to the band. A C1 curve through
    waypoints set off the grip (out past the pauldron in front of it, up outside the earcup, in
    level with the band: it never rises above the grip), timed by arc length with raised-cosine
    ramps; the hand turns to its grip on the way (done at the approach point, so the last move is a
    pure translation). Arm: searched poses at HS['rise_keys'], interpolated between (path fraction)."""
    hs = hs or HS
    Ta = rig._bone_world('hand_L', RISE[0])
    Th0 = ctx['Th0']
    pa, pb = Ta.translation.copy(), Th0.translation.copy()
    qa, qb = Ta.to_quaternion(), Th0.to_quaternion()
    if qa.dot(qb) < 0:
        qa = -qa
    pts = [pa] + [pb + Vector(o) for o in hs['rise_via']] + [pb]
    approach = pts[-2]
    t_end = Vector((pb.x - approach.x, pb.y - approach.y, 0.0))
    path = Spline(pts, hs['rise_t0'], t_end)
    s_app = path.starts[-2]
    T_r = GRIP - RISE[0]
    s_r, V_r = speed_profile(T_r, path.length, a=hs['ramp'], b=hs['ramp'])
    t_app = next(t / 20.0 for t in range(0, T_r * 20 + 1) if s_r(t / 20.0) >= s_app - 1e-9)
    t_turn = t_app + hs['turn_frac'] * (T_r - t_app)
    s_q, _ = speed_profile(t_turn, 1.0, a=hs['turn_ramp'], b=hs['turn_ramp'])
    Ths, xs = {}, {}
    for f in range(RISE[0], GRIP + 1):
        s = s_r(f - RISE[0])
        q = qa.slerp(qb, s_q(f - RISE[0]))
        Ths[f] = Matrix.Translation(path.at_s(s)) @ q.to_matrix().to_4x4()
        xs[f] = s / path.length
    keys = {RISE[0]: dict(pole=Vector(sol10['pole']), shoulder=tuple(float(x) for x in sol10['shoulder'])),
            GRIP: ctx['grip_key']}
    # the base schedule (path fraction -> share of the pole's and the shoulder's change): the
    # shoulder's 60 deg protraction comes out early, while the hand is still low and in front
    P0_, P1_ = keys[RISE[0]]['pole'].normalized(), keys[GRIP]['pole'].normalized()
    S0_, S1_ = Vector(keys[RISE[0]]['shoulder']), Vector(keys[GRIP]['shoulder'])
    sched = [(0.0, 0.0, 0.0)] + [tuple(v) for v in hs['rise_sched']] + [(1.0, 1.0, 1.0)]

    def base(x):
        i = max(j for j in range(len(sched) - 1) if sched[j][0] <= x) if x < 1.0 else len(sched) - 2
        (x0, s0, p0), (x1, s1, p1) = sched[i], sched[i + 1]
        t = smooth((x - x0) / (x1 - x0))
        fs, fp = s0 + (s1 - s0) * t, p0 + (p1 - p0) * t
        return P0_.slerp(P1_, fp), S0_.lerp(S1_, fs)
    kx = [(0.0, P0_, S0_)]
    for x, _, _ in sched[1:-1]:
        kx.append((x,) + base(x))
    for f in hs['rise_keys']:
        bp, bs = base(xs[f])
        k_ = keys[f] = _key_pose(rig, f, Ths[f], bp, tuple(bs), w_pole=hs['w_pole'])
        kx.append((xs[f], Vector(k_['pole']), Vector(k_['shoulder'])))
    kx.append((1.0, P1_, S1_))
    kx = _smooth_keys(sorted(kx, key=lambda k_: k_[0]), hs.get('smooth', 0))
    sols = _arm_through(rig, range(RISE[0] + 1, GRIP + 1), Ths, kx, xs)
    open_f = {nm: tuple(a_ * 0.10 for a_ in S.FIST) for nm in ('index', 'middle', 'ring', 'pinky')}
    rig.pose(GRIP - 3, 'BEZIER', fingers_L=open_f, thumb_L=-0.6)
    turn = math.degrees(qa.rotation_difference(qb).angle)
    return dict(path=path, V=V_r, sols=sols, keys=keys, kx=kx, turn=min(turn, 360.0 - turn), t_app=t_app,
                t_turn=t_turn, zmax=path.zmax() - pb.z)


def key_carry(rig, ctx, hs=None):
    """f1129 -> f1150 with the headset in hand: the lift (up and out, left side rolled up, the boom
    tipped forward off the jaw) to f1135, then one move out, round and down to HEADSET_REST, never
    rising, the last `drop` straight down; the turn about the vertical spread over HS['turn'].
    Velocity is continuous through f1135. Arm: searched poses at HS['carry_keys'] (each held near the
    previous one), interpolated between."""
    hs = hs or HS
    E0, Th0, grip0 = ctx['E0'], ctx['Th0'], ctx['grip0']
    T_rest = Matrix.Translation(HEADSET_REST[0]) @ Quaternion(HEADSET_REST[1]).to_matrix().to_4x4()
    D_rest = T_rest @ E0.inverted()
    q_rest = D_rest.to_quaternion()
    p_rest = D_rest @ grip0
    lx, ly, lz = hs['lift']
    p_L = grip0 + Vector((lx, ly, lz))
    dirB = Vector((hs['carry_dir'][0], hs['carry_dir'][1], 0.0)).normalized()
    lift = Bezier((grip0, grip0 + Vector((0.0, 0.0, lz * 0.75)), p_L - dirB * 0.025, p_L))
    carry = Bezier((p_L, p_L + dirB * hs['carry_out'], p_rest + Vector((0.0, 0.0, hs['drop'])), p_rest))
    v_mid = hs['mid_speed']
    s_a, V_a = speed_profile(LIFT_UP - GRIP, lift.length, 0.0, v_mid, a=3.0, b=2.0)
    s_b, V_b = speed_profile(SET - LIFT_UP, carry.length, v_mid, 0.0, a=4.0, b=5.0)
    rotq = lambda r_: (Matrix.Rotation(math.radians(r_[0]), 3, 'Z') @ Matrix.Rotation(math.radians(r_[1]), 3, 'Y') @
                       Matrix.Rotation(math.radians(r_[2]), 3, 'X')).to_quaternion()
    q_L = rotq(hs['lift_rot'])
    if q_L.dot(q_rest) < 0:
        q_rest = -q_rest
    t0_, t1_ = hs['turn']
    s_t, _ = speed_profile(t1_ - t0_, 1.0, a=4.0, b=4.0)

    def delta(f):
        if f <= LIFT_UP:
            p = lift.at_s(s_a(f - GRIP))
            q = Quaternion().slerp(q_L, smooth((f - GRIP) / float(LIFT_UP - GRIP)))
        else:
            p = carry.at_s(s_b(f - LIFT_UP))
            q = q_L.slerp(q_rest, s_t(f - t0_))
        return Matrix.Translation(p) @ q.to_matrix().to_4x4() @ Matrix.Translation(-grip0)
    path, Thc, xc = {}, {}, {}
    for f in range(GRIP, SET + 1):
        path[f] = delta(f)
        Thc[f] = path[f] @ Th0
        xc[f] = float(f)
    ckeys = {GRIP: ctx['grip_key']}
    prev = ckeys[GRIP]
    for f in hs['carry_keys']:
        prev = ckeys[f] = _key_pose(rig, f, Thc[f], prev['pole'], prev['shoulder'], fingers=ctx['fing'],
                                    thumb=ctx['thumb'], w_pole=hs['w_pole'])
    kx = _smooth_keys([(float(f), Vector(k_['pole']), Vector(k_['shoulder'])) for f, k_ in sorted(ckeys.items())],
                      hs.get('smooth', 0))
    sols = _arm_through(rig, range(GRIP + 1, SET + 1), Thc, kx, xc, fingers=ctx['fing'], thumb=ctx['thumb'])
    return dict(path=path, sols=sols, keys=ckeys, kx=kx, V=(V_a, V_b), lengths=(lift.length, carry.length))


def headset_off(rig, room, sol10):
    """f1121-1128 the left hand rises to the band (key_rise); f1129 grips it just above the left
    earcup (rig.grip_headband: the headset passes from the head to the hand); f1129-1135 the lift,
    up and out, as far as the frame top allows; f1135-1150 one move out, round and down onto the
    walnut (key_carry); f1150 hand -> table at HEADSET_REST. The hand rides the band (every arm
    frame is solved from the headset's own path), so nothing slides in the grip. The band hooks
    over the wedge head, so a rigid headset cannot come off without passing through it somewhere:
    the path keeps every intersection on the far side of his head from the lens (report())."""
    t0 = time.time()
    ctx = _grip_setup(rig)
    if DEBUG or os.environ.get('S11_REST_SEARCH'):
        bpy.context.scene.frame_set(GRIP)
        dg = bpy.context.evaluated_depsgraph_get()
        wv, _, ac = _mesh_world(rig.parts['headset_parts'], dg)
        E0i = ctx['E0'].inverted()
        loc_v = [E0i @ v for v in wv]
        com = sum(((E0i @ c) * a_ for c, a_ in ac), Vector()) / max(1e-9, sum(a_ for _, a_ in ac))
        search_rest(rig, room, ctx['E0'], ctx['Th0'], loc_v, com)
    ri = key_rise(rig, ctx, sol10)
    rig.attach_headset(GRIP, 'hand_L')
    ci = key_carry(rig, ctx)
    sols = dict(ri['sols'])
    sols.update(ci['sols'])
    # --- set down: hand -> table, the fingers ease open and the hand holds
    fing = ctx['fing']
    rig.detach_headset(SET)
    rig.pose(SET, 'BEZIER', fingers_L=fing, thumb_L=ctx['sol_g']['thumb'])
    rig.pose(END, 'BEZIER', fingers_L={nm: tuple(a_ * 0.6 for a_ in v) for nm, v in fing.items()}, thumb_L=0.0)
    for f in range(SET + 1, END + 3):
        rig.place_arm(f, 'L', sols[SET]['wrist'], sols[SET]['u'], sols[SET]['w'], sols[SET]['pole'], 'LINEAR',
                      shoulder=sols[SET]['shoulder'])
    rig.bake_pauldrons(RISE[0], END + 2)
    fix_headset_cord(rig, GRIP + 1, END + 2, unplug=20)
    V_a, V_b = ci['V']
    print(f'S11 HEADSET path: rise {ri["path"].length:.3f} m peak {ri["V"] * 1000:.0f} mm/f (hand turns '
          f'{ri["turn"]:.0f} deg by f{RISE[0] + ri["t_turn"]:.1f}, at the approach point on f{RISE[0] + ri["t_app"]:.1f}; '
          f'highest {ri["zmax"] * 1000:+.1f} mm vs the grip); '
          f'lift {ci["lengths"][0] * 1000:.0f} mm peak {V_a * 1000:.0f} mm/f; carry {ci["lengths"][1]:.3f} m peak '
          f'{V_b * 1000:.0f} mm/f ({V_b * C.FPS:.2f} m/s); solved in {time.time() - t0:.1f}s', flush=True)
    worst = max(sols.items(), key=lambda kv: kv[1]['pen'])
    fmt = lambda kx: [(round(x, 2), tuple(round(c, 2) for c in p_), tuple(round(c, 1) for c in s_)) for x, p_, s_ in kx]
    print(f'S11 HEADSET arm: worst reach miss {max(s_["reach"] for s_ in sols.values()) * 1000:.1f} mm, worst arm '
          f'penetration {worst[1]["pen"] * 1e6:.1f} (f{worst[0]}); keys rise (path fraction, pole, shoulder) {fmt(ri["kx"])}; '
          f'keys carry (frame, ...) {fmt(ci["kx"])}', flush=True)
    return dict(sols=sols, rise=ri, carry=ci, ctx=ctx)


def fix_headset_cord(rig, f0, f1, unplug=20):
    """Workaround for synergy.py: each cord hook stacks three Child Of constraints (worn, route,
    unplugged) and blends them by influence, but stacked Child Of constraints compound, so once
    the headset has moved more than a few cm from where it was worn the unplugged cord flies
    off in a long straight line. From f0 on, every hook (and the plug) is baked instead:
    each constraint is evaluated on its own and the hook keyed in world space on the rig's own
    path (worn -> route over the first half of the unplug, route -> wrapped round the earcup
    over the second), with the constraints switched off. Started a frame after the grip and
    spread over `unplug` frames, so the plug leaves the collar without a whip."""
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
                a_, b_, t_ = pts['worn'], pts['route'], smooth(s_ * 2.0)
            else:
                a_, b_, t_ = pts['route'], pts['unplugged'], smooth((s_ - 0.5) * 2.0)
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

# rim cards: energy at 3 m from his chest, falling with the square of the screen's distance (the
# far colleagues are whispers); Pat's faint grey breath; the walnut and carpet bounces; the
# headset's slab kicker (W) and its place relative to the headset (front, above).
RIM = dict(dist=2.6, z=1.25, size=0.7, energy=26.0, ref=3.0, pat=1.5, bounce=5.0, carpet=6.0,
           kick=20.0, kick_off=(0.05, -0.55, 0.30), kick_size=(0.6, 0.2))


def synergy_receivers(rig):
    objs = [o for o in rig.collection.all_objects if o.type in ('MESH', 'CURVE')]
    for o in ([rig.headset] + list(rig.headset.children_recursive) if rig.headset else []) + rig.cup_objects():
        if o.type in ('MESH', 'CURVE') and o not in objs:
            objs.append(o)
    return objs


def terminal_rims(room, rig):
    """The colleagues' screens light him from down the table: one soft card per screen on the
    line from his chest to it (2.6 m out, at shoulder height), its colour and level driven by the
    screen's own state, so his silhouette carries the near colours and loses them one by one in
    the shutdown wave (each collapse flares white first). Inverse-square from the real screen:
    Synthia at 3 m is the strongest, Linda at 23 m a whisper. Diffuse only (no glossy: the real
    screens already mirror in his glass and enamel); Pat's grey arrives last, a faint breath.
    Light-linked to him alone (the walnut, chairs and walls keep the room's own CRT pools). Not
    seen by camera."""
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
        lt.visible_glossy = False
        lt.data.spread = math.radians(90)
        lt.light_linking.receiver_collection = lcoll
        E = RIM['pat'] if nm == 'pat' else RIM['energy'] * min(1.0, (RIM['ref'] / d.length) ** 2)
        scr_o = t.screen
        v = [('on', scr_o, '["crt_on"]'), ('gain', scr_o, '["crt_gain"]'), ('sx', scr_o, '["crt_sx"]'),
             ('sy', scr_o, '["crt_sy"]'), ('flare', scr_o, '["crt_flare"]')]
        P.add_driver(lt.data, 'energy', f'{E:.3f}*on*gain*flare*(0.06+0.94*sx*sy)', v)
        lt['rim_peak'] = E
        out.append(lt)
    if DEBUG:
        print('S11 RIM energies (W at full field):', {lt.name[8:]: round(lt['rim_peak'], 2) for lt in out}, flush=True)
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


def headset_kicker(rig):
    """The film's last action in the room needs a visible prop: a small slab-coloured strip light
    in front of and above the headset (the slab's side, out of the lens's view), following it,
    light-linked to the headset and its cord alone, so the band's top edge and the earcup shells
    carry a thin rim against the black room through the lift, the carry and at rest. Constant for
    the whole shot (a light fading up in a locked-off dark frame would read as a lighting cue; in
    the lit opening it is lost under the room's light). Not seen by camera."""
    hs = rig.headset
    if hs is None:
        return None
    objs = [o for o in [hs] + list(hs.children_recursive) if o.type in ('MESH', 'CURVE')]
    objs += [o for o in rig.collection.all_objects if o.type in ('MESH', 'CURVE') and 'headset' in o.name.lower()
             and o not in objs]
    lcoll = bpy.data.collections.get('S11_headset_receivers') or bpy.data.collections.new('S11_headset_receivers')
    for o in objs:
        if lcoll.objects.get(o.name) is None:
            lcoll.objects.link(o)
    sx, sy = RIM['kick_size']
    lt = C.area_light('s11_headset_kick', (0.0, 0.0, 0.0), None, 0.0, sx, sy, color=(0.92, 0.95, 1.0),
                      coll=C.collection('S11_light'))
    lt.visible_camera = False
    lt.light_linking.receiver_collection = lcoll
    cl = lt.constraints.new('COPY_LOCATION')
    cl.target = hs
    cl.use_offset = True
    lt.location = RIM['kick_off']
    tt = lt.constraints.new('TRACK_TO')
    tt.target = hs
    tt.track_axis = 'TRACK_NEGATIVE_Z'
    tt.up_axis = 'UP_Y'
    lt.data.energy = RIM['kick']
    return lt


def hold_left_arm(rig, frame, from_frame):
    """Key the left arm, its fingers and thumb at `frame` exactly as evaluated at `from_frame`
    (S10's last keys), so nothing drifts through the long stillness."""
    sc = bpy.context.scene
    sc.frame_set(from_frame)
    bones = ['shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L'] + FINGER_BONES
    qs = {b: rig.arm.pose.bones[b].rotation_quaternion.copy() for b in bones}
    for b, q in qs.items():
        rig.key_quat(b, frame, q, 'LINEAR')


# ------------------------------------------------------------------ checks

ARM_L = ['shoulder_L', 'pauldron_L', 'upperarm_L', 'forearm_L', 'hand_L'] + FINGER_BONES
HAND_L = ['hand_L'] + FINGER_BONES
GATE = dict(bone_deg=15.0, elbow_ratio=1.5, top=FRAME_TOP)


def _turn(Ma, Mb):
    """Degrees between two world matrices' rotations (q and -q are the same turn)."""
    a = math.degrees(Ma.to_quaternion().rotation_difference(Mb.to_quaternion()).angle)
    return min(a, 360.0 - a)


def report(rig, room, cam, S10=None, frames=None):
    """The gates, frame by frame. Motion f1119-1152: left-arm bones' world turn per frame (pops),
    elbow vs wrist travel, hand and headset speeds, the headset's turn per frame; the highest
    image point of hand, fingers and headset (all vertices) against FRAME_TOP on f1121-1150; the
    left arm against his body, head, cup and the headset; the headset against his body (deepest
    point, and whether the lens can see it) and the walnut/hub/padlock/cord at the set-down; hand
    x jack on f993-1000; the jack's stillness from JACK_SETTLE's end; the cup's drift."""
    from bpy_extras.object_utils import world_to_camera_view as w2c
    sc = bpy.context.scene
    arm = rig.parts_on_bones(ARM_L)
    arm_names = {o.name for o in arm}
    handm = [o for o in rig.parts_on_bones(HAND_L) if o.type == 'MESH']
    body = [o for o in rig.collection.all_objects if o.type == 'MESH' and o.name not in arm_names and
            not o.name.startswith(f'{rig.name}_headset')]
    hs = [o for o in rig.headset.children_recursive if o.type == 'MESH'] if rig.headset else []
    cupm = [o for o in rig.cup_objects() if o.type == 'MESH']
    body = [o for o in body if o not in hs and o not in cupm]
    ign = (('thumb', 'palm'), ('index_1', 'palm'), ('middle_1', 'palm'), ('ring_1', 'palm'), ('pinky_1', 'palm'),
           ('forearm', 'upperarm'), ('palm', 'forearm'), ('shoulder_hub', 'upperarm'), ('pauldron', 'shoulder_hub'),
           ('pauldron', 'upperarm'), ('bicep', 'upperarm'), ('bicep', 'forearm'), ('bicep', 'shoulder'))
    fails = []
    # --- the cup
    sc.frame_set(START)
    cup0 = rig.cup.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.copy() if rig.cup else None
    drift = 0.0
    for f in range(START, END + 1, 4):
        sc.frame_set(f)
        if cup0 is not None:
            m_ = rig.cup.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world
            drift = max(drift, (m_.translation - cup0.translation).length,
                        m_.to_quaternion().rotation_difference(cup0.to_quaternion()).angle * 0.1)
    print(f'S11 CHECK the cup: worst drift over the shot {drift * 1000:.2f} mm (rotation counted at 0.1 m/rad)', flush=True)
    # --- hand x jack at the release
    if S10 is not None:
        hj = {f: S10.hand_overlaps(rig, room, f, cord=True) for f in range(START, 1001)}
        print(f'S11 CHECK hand x (jack+socket, cord) triangle pairs f993-1000: {hj} (f993 is S10\'s last pinch; '
              f'gate from f{F_RELEASE}, when the pads have parted)', flush=True)
        if any(sum(v) for f, v in hj.items() if f >= F_RELEASE):
            fails.append('hand x jack')
    # --- the jack is dead still after it settles
    jm = {}
    for f in range(JACK_SETTLE[1], END + 1):
        sc.frame_set(f)
        jm[f] = room.jack.root.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.copy()
    jd = max((m_.translation - jm[JACK_SETTLE[1]].translation).length for m_ in jm.values())
    print(f'S11 CHECK the jack from f{JACK_SETTLE[1]}: worst move {jd * 1000:.3f} mm', flush=True)
    # --- the coil never cuts the walnut's head edge while the jack swings under it
    zb = R.ROOM['table_bottom_z']
    cut = {}
    for f in range(F_RELEASE, JACK_SETTLE[1] + 1):
        sc.frame_set(f)
        vs, _, _ = _mesh_world(room.master.obj, bpy.context.evaluated_depsgraph_get())
        n = [q for q in vs if 0.12 < q.x < 0.50 and q.y < -0.001 and zb + 0.001 < q.z < R.TABLE_TOP - 0.014]
        if n:
            cut[f] = (len(n), round(-min(q.y for q in n) * 1000, 1))
    print(f'S11 CHECK master cord inside the walnut head edge f{F_RELEASE}-{JACK_SETTLE[1]} (verts, depth mm): {cut}',
          flush=True)
    if cut:
        fails.append('cord x walnut')
    # --- motion: pops, speeds, the headset's turn
    bones = ['shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L', 'pauldron_L']
    prev = None
    worst_deg, worst_ratio = (0.0, '', 0), (0.0, 0)
    rows = []
    for f in range(RISE[0] - 1, END + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ae = rig.arm.evaluated_get(dg)
        Mb = {b: ae.matrix_world @ ae.pose.bones[b].matrix for b in bones}
        elbow = Mb['forearm_L'].translation.copy()
        wrist = Mb['hand_L'].translation.copy()
        Hm = rig.headset.evaluated_get(dg).matrix_world.copy() if rig.headset else None
        cur = dict(M=Mb, elbow=elbow, wrist=wrist, H=Hm)
        if prev is not None:
            degs = {b: _turn(Mb[b], prev['M'][b]) for b in bones}
            bmax = max(degs.items(), key=lambda kv: kv[1])
            de, dw = (elbow - prev['elbow']).length, (wrist - prev['wrist']).length
            ratio = de / dw if dw > 0.004 else 0.0
            hv = hr = 0.0
            if Hm is not None:
                hv = (Hm.translation - prev['H'].translation).length
                hr = _turn(Hm, prev['H'])
            rows.append((f, bmax, dw, de, ratio, hv, hr))
            if bmax[1] > worst_deg[0]:
                worst_deg = (bmax[1], bmax[0], f)
            if ratio > worst_ratio[0]:
                worst_ratio = (ratio, f)
        prev = cur
    for f, bmax, dw, de, ratio, hv, hr in rows:
        print(f'S11 MOTION f{f}: worst bone {bmax[0]} {bmax[1]:5.1f} deg/f  wrist {dw * 1000:5.1f} mm/f  elbow '
              f'{de * 1000:5.1f} mm/f (x{ratio:.2f})  headset {hv * 1000:5.1f} mm/f {hr:4.1f} deg/f', flush=True)
    print(f'S11 GATE arm pops: worst {worst_deg[0]:.1f} deg/f ({worst_deg[1]} f{worst_deg[2]}), gate {GATE["bone_deg"]}; '
          f'worst elbow/wrist {worst_ratio[0]:.2f} (f{worst_ratio[1]}), gate {GATE["elbow_ratio"]}', flush=True)
    if worst_deg[0] > GATE['bone_deg']:
        fails.append('bone deg/frame')
    if worst_ratio[0] > GATE['elbow_ratio']:
        fails.append('elbow/wrist')
    # --- frame-top headroom: every vertex of hand, fingers and headset
    top_w = (0.0, 0, '')
    dump = {}
    for f in range(RISE[0] + 1, END + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        tops = {}
        for o in handm + hs:
            try:
                vs, _, _ = _mesh_world(o, dg)
            except RuntimeError:
                continue
            if vs:
                tops[o.name] = max(w2c(sc, cam, q).y for q in vs)
        nm, t_ = max(tops.items(), key=lambda kv: kv[1])
        print(f'S11 TOP f{f}: {t_:.3f} ({nm})', flush=True)
        if os.environ.get('S11_DUMP'):              # the headset's image points, for render analysis
            pts = []
            for o in hs:
                vs, _, _ = _mesh_world(o, dg)
                pts += [tuple(round(c, 4) for c in w2c(sc, cam, q)[:2]) for q in vs[::3]]
            dump[f] = pts
        if t_ > top_w[0] and f <= SET:
            top_w = (t_, f, nm)
    if dump:
        with open(os.environ['S11_DUMP'], 'w') as fh:
            json.dump(dump, fh)
    print(f'S11 GATE frame top: highest {top_w[0]:.3f} (f{top_w[1]}, {top_w[2]}), gate {GATE["top"]}', flush=True)
    if top_w[0] > GATE['top']:
        fails.append('frame top')
    # --- clearances
    obst = []
    if hs:
        hub_objs = [o for o in [room.hub.root] + list(room.hub.root.children_recursive) if o.type == 'MESH']
        pad = room.props['kevin'][0]
        obst = hub_objs + [o for o in [pad] + list(pad.children_recursive) if o.type == 'MESH'] + [room.master.obj]
    for f in frames or [993, 995, 1000, 1060, 1110, 1113] + list(range(RISE[0], END + 1)):
        r = rig.overlap_report(f, arm, body + cupm + (hs if f < GRIP else []), ignore=ign)
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        deep = vis = 0.0
        deep_o = ''
        zlow = obst_n = 0.0
        if hs and f >= GRIP - 1:
            tree = _bvh(body + cupm, dg)
            camp = cam.matrix_world.translation
            for o in hs:
                vs, _, _ = _mesh_world(o, dg)
                for q in vs[::2]:
                    loc, nor, _, dist = tree.find_nearest(q, 0.08)
                    if loc is not None and (q - loc).dot(nor) < 0.0:
                        if dist > deep:
                            deep_o = o.name
                        deep = max(deep, dist)
                        d_ = loc - camp
                        hit, hp, *_ = sc.ray_cast(dg, camp, d_.normalized(), distance=d_.length + 0.002)
                        if hit and (hp - loc).length < 0.004:
                            vis = max(vis, dist)
            if f >= SET - 6:
                zlow = min(min(_mesh_world(o, dg)[0], key=lambda q: q.z).z for o in hs) - R.TABLE_TOP
                obst_n = len(_bvh(hs, dg).overlap(_bvh(obst, dg)))
        worst = sorted(r.items(), key=lambda kv: -kv[1])[:3]
        print(f'S11 CHECK f{f}: arm x body {sum(r.values()):4d} pairs {worst}  headset in body {deep * 1000:4.1f} mm '
              f'(visible {vis * 1000:4.1f} mm) {deep_o}' +
              (f'  headset low point {zlow * 1000:+.1f} mm over the walnut, x hub/padlock/cord {obst_n}'
               if f >= SET - 6 else ''), flush=True)
        if vis > 0.0005:
            fails.append(f'visible headset penetration f{f}')
        if sum(r.values()):
            fails.append(f'arm x body f{f}')
    print(f'S11 GATES: {"PASS" if not fails else "FAIL " + str(sorted(set(fails)))}', flush=True)
    return fails


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
    release_hand(rig, S10)
    jack_drop(room, S10)
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
    headset_kicker(rig)
    room.render_budget(kind='wide', samples=args.samples or None, locked=True)
    room.compositor()
    room.tune_scanlines(cam)
    sc.frame_set(START)
    if DEBUG:
        report(rig, room, cam, S10)
    print(f'S11 BUILD room+rig {t1 - t0:.1f}s  s10 hand {t2 - t1:.1f}s  jack+head {t3 - t2:.1f}s  headset '
          f'{t4 - t3:.1f}s  total {time.time() - t0:.1f}s', flush=True)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
