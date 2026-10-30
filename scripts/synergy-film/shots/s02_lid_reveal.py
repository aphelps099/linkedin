"""S02 · f129-256 · the lid reveal (E3_MACRO_INSERTS -> E2_LONG_ROOM, lit).

    blender -b --factory-startup -P shots/s02_lid_reveal.py -- --quality proof --only 129,136,148,157,232,256
    blender -b --factory-startup -P shots/s02_lid_reveal.py -- --quality final

The match cut from S01: the slot-sun becomes the dark sip slot of his lid, seen
straight down through a 100 mm macro (env_room.preview_camera 's02_lid': slot
centred, long axis horizontal, 20% of the frame width). Ivory fingers press a
sealed envelope, folded once lengthwise, edge-first into the slot; it shrinks
into it, an amber glow pulses up, the fingers lift away. Then one continuous
motion-control pull-back (f157-232) rises off the lid, tilts from straight down
to level and zooms 100 -> 65 mm while focus pulls from the lid to the face, up
his front to the canonical portrait; he holds and blinks once (f240).

Sync points (film frames; 90 BPM, a beat every 16 frames):
  f131  the envelope's folded edge meets the spout (lid tick)
  f136  it passes the slot plane: the shrink starts (contact)
  f142  fastest slide (paper rustle peak)
  f148  gone (plip); the amber glow peaks
  f146-154 amber glow; f150-160 the fingers lift away; f150-175 the hand lowers to his side
  f157-232 the pull-back; f233-256 the hold; f240-247 the one slow blink
Nothing on the body moves but the left arm, the chest plates' 2 mm breath and the
blink: the cup is locked to hand.R at chest height for the whole shot.
"""

import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as P  # noqa: E402
import synergy as S  # noqa: E402

V = Vector
Z = V((0.0, 0.0, 1.0))

SHOT = 's02'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames)
APPROACH = 123          # the hand is already pressing down at the cut
TOUCH = 131             # the folded edge meets the spout: the lid tick
SINK0 = 136             # contact: the envelope passes the slot plane and starts to shrink
GONE = 148              # vanished (plip)
GLOW = 147              # amber pulse: dark at 146, peak 148, out by 154
LIFT0, LIFT1 = 150, 160  # the fingers lift away out of the macro frame
REST = 175              # the left hand hangs at his side
MOVE0, MOVE1 = 157, 232  # the motion-control pull-back
BLINK = 240             # middle row 240-241, dark 242-243, middle row 244-245, full 246
STEAM_ALPHA = 1.3       # opacity of a steam puff at its densest
STEAM_DRIFT_O = 0.030   # the draft carries it back over the lid's edge, where the dark room shows it
STEAM_GLOW = 0.45       # the light the steam scatters (emission), so it reads over the dark slot and room
STEAM_RISE = 0.17       # how high a puff climbs in its life (past the macro lens at 0.21 m)
STEAM_LIFE = 36         # frames a puff lives
STEAM_EVERY = 4         # a new puff per thread every N frames
STEAM_END = 178         # last puff born
STEAM_FADE = ((MOVE0 + 4, 1.0), (MOVE0 + 20, 0.0))    # gone before the lens turns side-on to the threads
ENV_RAKE = 0.8          # W, the raking card on the envelope
GLINT = 40.0            # the skylight's reflected slot along the top of the face glass
GLOW_PEAK = 0.12        # slot glow 'led' level (x30 emission): a warm amber, not a white hot slot

# ------------------------------------------------------------------ envelope and posting
ENV_L = 0.060           # a small sealed envelope (60 x 42 mm) folded once lengthwise: its ends stay in frame
ENV_H = 0.021           # folded height (fold edge to the two free edges)
ENV_T0, ENV_T1 = 0.0010, 0.0018   # thickness at the fold / at the free edges (the card inside springs it)
ENV_BOW = 0.0016        # the outer face bows out between the fold and the free edges
ENV_TILT = 32.0         # the envelope leans back toward his body (degrees from vertical): the lens sees its face
PINCH_UP = 0.015        # pinch point up the envelope from its folded edge
PINCH_X = 0.025         # ... and along it, at the end toward his left: the hand comes in from his left along
                        # the slot's long axis, so only the fingertips cross the macro frame's right edge
                        # (there is no room for a hand between the cup and his chest)
APPROACH_D = 0.020      # the press: distance travelled edge-first, APPROACH -> TOUCH
PINCH_INDEX = (30.0, 50.0, 35.0)   # a card pinch: the distal pad flat on the envelope, the finger rising off it
                        # (the rig's 'pinch' curls 150 deg and hooks over the paper; < 110 deg the thumb
                        # cannot oppose it), thumb solved opposite (rig.thumb_pinch(index_angles=...))
ENV_NUDGE = -0.0008     # the envelope sits this far toward the thumb pad (the index pad rests on the flap)
PRESS_D = 0.002         # the fingers follow the envelope a little toward the slot (SINK0 -> GONE)
SEAL_X = 0.008          # seal (and the flap's point) off centre, away from the pinching hand
SEAL_UP = 0.0060        # seal centre above the fold edge (in focus, near the slot plane)
SEAL = 0.0075           # seal side

# ------------------------------------------------------------------ camera
LENS0, LENS1 = 100.0, 65.0
D0 = P.CUP['slot_len'] / 0.20 * LENS0 / 36.0   # 0.208 m: the approved s02_lid framing (slot 20% of the width)
END_DIST = 2.90         # 65 mm holds head (upper third), cup (lower left) and badge (lower centre) from here
END_ANG = 10.0          # toward his right: wedge to the viewer's left, earcup to the viewer's right
END_H = 1.58            # screen height; the camera ends level (lens shift frames him)
END_AIM_Z = 1.385       # world height at the frame centre at the end
FSTOP0, FSTOP1 = 4.0, 2.8
SHUTTER = ((184, 0.5), (192, 0.2), (204, 0.2), (214, 0.5))   # (frame, shutter) keys
MOVE_SHAPE = (2.0, 3.6)  # speed profile u^a (1-u)^b: peak a third of the way in, a long settle
EXPOSURE0 = -1.0        # the lid sits in the sun slab (env_room.PREVIEW_EXPOSURE['s02_lid']); back to 0 on him


def ease(t):
    return C.ease(t, 'inout')


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def move_progress(u, a=MOVE_SHAPE[0], b=MOVE_SHAPE[1], n=400):
    """Progress of the motion-control move for linear time u (0..1): speed ~ u^a (1-u)^b, so it
    starts and stops without a jolt, is quickest while the lens is still over the soft lid and
    cup, and settles slowly once his face is in frame (no motion-smeared LEDs on the way in)."""
    u = min(1.0, max(0.0, u))
    if u <= 0.0 or u >= 1.0:
        return u
    tot = acc = 0.0
    k = min(n - 1, int(u * n))
    for i in range(n):
        x = (i + 0.5) / n
        v = x ** a * (1.0 - x) ** b
        tot += v
        if i < k:
            acc += v
        elif i == k:
            acc += (u * n - k) * v                 # the partial cell: continuous and monotone
    return acc / tot


def bezier(p0, p1, p2, p3, t):
    s = 1.0 - t
    return p0 * (s * s * s) + p1 * (3 * s * s * t) + p2 * (3 * s * t * t) + p3 * (t * t * t)


# ================================================================== envelope

def build_envelope(coll, seal_x=0.0):
    """A sealed white envelope folded once lengthwise: a solid strip (paper + the letter
    inside) with a rounded folded edge, its two free edges springing slightly apart, the back's
    pointed flap lying on the outer face with its edges converging on a small glossy cobalt
    square seal just above the fold. Local frame: origin at the middle of the folded edge,
    X along it, Z up the envelope, +Y the outer (seal) face. No marks anywhere."""
    L, H = ENV_L, ENV_H
    pap = P.envelope_paper()
    nx, nz, na = 60, 18, 8

    def half_t(z):
        return 0.5 * (ENV_T0 + (ENV_T1 - ENV_T0) * (z / H) ** 1.5)

    def bow(x, z):           # the folded sheet springs into a soft bow, plus a faint cockle
        return (ENV_BOW * math.cos(math.pi * x / L) * (z / H) ** 1.2 +
                0.00012 * math.sin(2 * math.pi * x / 0.037 + 1.3) * math.sin(math.pi * z / H))

    bm = bmesh.new()
    rings = []
    for i in range(nx + 1):
        x = L * (i / nx - 0.5)
        r0 = half_t(0.0)
        pts = []
        for j in range(nz + 1):                       # outer face, top down to the fold
            z = H - (H - r0) * j / nz
            pts.append((x, half_t(z) + bow(x, z), z))
        for k in range(1, na):                        # the rounded fold
            a = math.pi * k / na
            pts.append((x, r0 * math.cos(a), r0 - r0 * math.sin(a)))
        for j in range(nz + 1):                       # inner face, fold up to the top
            z = r0 + (H - r0) * j / nz
            pts.append((x, -half_t(z) + bow(x, z) * 0.6, z))
        rings.append([bm.verts.new(p) for p in pts])
    n = len(rings[0])
    for a_, b_ in zip(rings, rings[1:]):
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((a_[k], b_[k], b_[k2], a_[k2]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    body = P.to_object(bm, 's02_env_body', [pap], coll, smooth=40.0, recalc=False)

    # the back's top flap on the outer face: a 0.25 mm layer whose two edges run from the far
    # top corners down to the seal just above the fold (its free edges lift 0.75 mm: a shadow line)
    bm = bmesh.new()
    zp = SEAL_UP - 0.004
    rows = []
    for j in range(25):
        z = zp + (H - 0.0006 - zp) * j / 24
        k_ = (z - zp) / (H - zp)
        x0 = seal_x + (-L / 2 + 0.0008 - seal_x) * k_ - 0.0015         # the flap widens from its point
        x1 = seal_x + (L / 2 - 0.0008 - seal_x) * k_ + 0.0015          # to the envelope's top corners
        row = []
        for i in range(41):
            s_ = i / 40
            x = x0 + (x1 - x0) * s_
            d_edge = min(s_, 1 - s_) * (x1 - x0)
            lift = 0.00075 * max(0.0, 1.0 - d_edge / 0.0035) ** 2
            row.append(bm.verts.new((x, half_t(z) + bow(x, z) + 0.00004 + lift, z)))
        rows.append(row)
    for a_, b_ in zip(rows, rows[1:]):
        for i in range(40):
            bm.faces.new((a_[i], a_[i + 1], b_[i + 1], b_[i]))
    flap = P.to_object(bm, 's02_env_flap', [pap], coll, smooth=40.0, recalc=True)
    sol = flap.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = 0.00025
    sol.offset = 1.0
    # seal: a small glossy cobalt square over the flap's point
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = V((v.co.x * SEAL, v.co.y * 0.00016, v.co.z * SEAL))
    seal = P.to_object(bm, 's02_env_seal', [P.seal_mat()], coll, smooth=None, recalc=True)
    seal.location = (seal_x, half_t(SEAL_UP) + bow(seal_x, SEAL_UP) + 0.00062, SEAL_UP)
    bv = seal.modifiers.new('bevel', 'BEVEL')
    bv.width = 0.0004
    bv.segments = 2
    root = C.empty('s02_envelope', coll, display='ARROWS', size=0.02)
    root.rotation_mode = 'QUATERNION'
    for o in (body, flap, seal):
        o.parent = root
        o.visible_shadow = True
    return root, [body, flap, seal]


# ================================================================== posting (left hand)

class Post:
    """The envelope post, solved for the slot: the envelope's folded edge lies along the slot's
    long axis and leans ENV_TILT back toward his body; the left hand pinches it (thumb and
    index pads either side, PINCH_UP up the envelope) and moves it edge-first along the
    envelope's own plane. rig.post() solves the hand for a pinch point straight above the slot
    without regard to the slot's long axis (its pads end up along the slot), so this solves the
    hand orientation from the envelope instead, with the rig's own clearance search."""

    def __init__(self, rig, frame):
        self.rig = rig
        sc = bpy.context.scene
        sc.frame_set(frame)
        pos, ax, across = rig.slot_frame_world(frame)
        Ms = rig.slot.matrix_world.copy()
        self.c = pos
        self.ax = ax
        self.a = (Ms.to_3x3() @ V((1.0, 0.0, 0.0))).normalized()     # slot long axis
        self.o = -V((across.x, across.y, 0.0)).normalized()           # cup axis -> slot: toward his body
        t = math.radians(ENV_TILT)
        self.e = (Z * math.cos(t) + self.o * math.sin(t)).normalized()  # up the envelope
        n = self.a.cross(self.e).normalized()
        if n.z < 0:
            n = -n
        self.n = n                                                    # the outer (camera) face
        self.x = n.cross(self.e).normalized()                         # along the fold (right-handed)
        self.gap = S.PINCH_GAP
        self.pin = rig.thumb_pinch('L', index_angles=PINCH_INDEX, gap=self.gap)
        pinch = S.HAND_SHAPES['pinch']
        self.fingers = dict(index=PINCH_INDEX, middle=pinch['middle'], ring=pinch['ring'], pinky=pinch['pinky'])
        hd = rig.hands['L']
        # the hand comes from his left side: pinch on the half of the envelope toward +X world
        side = 1.0 if self.x.x > 0 else -1.0
        self.side = side                                              # the hand is at +side * x
        self.pinch = self.c + self.e * PINCH_UP + self.x * (PINCH_X * side)
        # solve the hand: the pads straddle the envelope (pinch axis along +-n), every turn about it
        # the pinch axis in the hand's rest frame: the index pad's normal, as rig.thumb_pinch builds
        # it (the palm normal turned by the index's total curl about its hinge); the thumb pad sits
        # opposite along it. (The line between the two tip ends is not this axis: the pads are 6
        # and 4 mm back from the tips.)
        fd = hd['fingers']['index']
        hinge = fd['dir'].cross(hd['w']).normalized()
        q_rest = (Matrix.Rotation(math.radians(sum(PINCH_INDEX)), 3, hinge) @ hd['w']).normalized()
        cup_base = rig.cup.matrix_world.translation.copy()
        Dc = rig._chest_delta(frame)
        R3 = Dc.to_3x3()
        tgt = Dc @ self.pinch
        cupc = (Dc @ cup_base, (R3 @ ax).normalized())
        xs_c = (R3 @ (self.x * side)).normalized()
        cand = []
        for sgn in (1.0, -1.0):
            qw = (R3 @ (self.n * sgn)).normalized()
            R0 = q_rest.rotation_difference(qw).to_matrix()
            for k in range(72):
                Rk = Matrix.Rotation(math.radians(5.0 * k), 3, qw) @ R0
                u = Rk @ hd['u']
                cand.append((u.dot(-xs_c), u, Rk @ hd['w']))
        # the fingers point along the envelope toward the slot (from his left): the hand then
        # stays outside the macro lens's narrow view cone (only the fingertips enter it). Keep the
        # turns within 40 deg of the best alignment this pinch allows.
        best = max(c[0] for c in cand)
        lim_a = math.cos(min(math.pi, math.acos(max(-1.0, min(1.0, best))) + math.radians(40.0)))
        frames = [(u, w) for al, u, w in cand if al >= lim_a]
        poles = [V((0.6, -0.6, -0.5)), V((0.9, -0.2, -0.4)), V((0.3, -0.9, -0.3)), V((0.8, -0.5, 0.0)),
                 V((0.5, -0.4, -0.8)), V((0.9, 0.3, -0.3))]
        shoulders = [(0, 0, 0), (12, 0, 0), (22, 3, 0), (32, 5, 0), (16, 8, 0), (26, 9, 0), (8, 6, 0)]
        lim = S.LID_TOP + 0.004
        fingers = rig.finger_angles('L', self.fingers)
        # the macro lens (locked until MOVE0): nothing but the fingertips may enter its view
        cam_c = Dc @ (self.c + Z * D0)
        rt_c = (R3 @ self.o.cross(Z)).normalized()
        up_c = (R3 @ self.o).normalized()
        dn_c = (R3 @ -Z).normalized()
        hx, hy = 0.18 * 1.06, 0.10125 * 1.06
        weight = {'finger': 0.15, 'thumb': 0.15, 'tip': 0.0}

        def in_view(chain):
            tot = 0.0
            for p, r, part in rig._arm_samples('L', chain, fingers, thumb=self.pin['rot']):
                rel = p - cam_c
                d = rel.dot(dn_c)
                if d < 0.01:
                    continue
                rr = r / d
                ox = hx + rr - abs(rel.dot(rt_c) / d)
                oy = hy + rr - abs(rel.dot(up_c) / d)
                if ox > 0 and oy > 0:
                    tot += weight.get(part, 1.0) * min(ox, oy) ** 2
            return tot
        self.in_view = in_view

        def keep_above(hu, hw, pole, sh, chain):
            pen = 0.0
            for p, r, part in rig._arm_samples('L', chain, fingers, thumb=self.pin['rot']):
                if part not in ('palm', 'finger', 'tip', 'thumb', 'wrist'):
                    continue
                rel = p - cupc[0]
                hh = rel.dot(cupc[1])
                if (rel - cupc[1] * hh).length < S.LID_R + 0.010 + r:
                    d = hh - r - lim
                    if d < 0:
                        pen -= d * 2000.0
            # keep the hand out of the macro frame; prefer the fingers laid along the envelope
            return pen + 400.0 * in_view(chain) + 0.05 * (1.0 - hu.dot(-xs_c))
        self.sol = rig.solve_arm_clear('L', tgt, frames, poles, shoulders, fingers=fingers, cup=cupc,
                                       point_local=self.pin['point'], prefer=keep_above, thumb=self.pin['rot'])
        W0 = rig.arm.data.bones['hand_L'].head_local
        Rt = S.frame3(self.sol['u'], self.sol['w']) @ S.frame3(hd['u'], hd['w']).transposed()
        self.off = Rt @ (self.pin['point'] - W0)      # chest-rest offset wrist -> pinch point
        print(f'S02 POST pen={self.sol["pen"]:.5f} score={self.sol["score"]:.3f} reach={self.sol["reach"]:.4f} '
              f'shoulder={self.sol["shoulder"]} pole={tuple(round(x, 2) for x in self.sol["pole"])} '
              f'u={tuple(round(x, 2) for x in self.sol["u"])} thumb_err={self.pin["err"]:.4f} '
              f'pad_gap={self.pin["pad_gap"] * 1000:.1f}mm', flush=True)

    def key(self, frame, pinch_world, interp='LINEAR'):
        """Key the left arm with the pinch point at `pinch_world`, the contact orientation kept."""
        rig = self.rig
        Dc = rig._chest_delta(frame)
        tgt = Dc @ V(pinch_world)
        rig.place_arm(frame, 'L', tgt - self.off, self.sol['u'], self.sol['w'], self.sol['pole'], interp,
                      shoulder=self.sol['shoulder'])
        rig.pose(frame, interp, fingers_L=self.fingers)
        for i, Rr in enumerate(self.pin['rot']):              # the thumb opposite this index (card pinch)
            rig.key_rest_rot(f'thumb_{i}_L', frame, Rr, interp)

    def envelope_matrix(self, frame_pinch):
        """World matrix of the envelope root when the pinch point sits at `frame_pinch`."""
        Rm = Matrix((self.x, self.n, self.e)).transposed()
        M = Rm.to_4x4()
        M.translation = self.c + (V(frame_pinch) - self.pinch) + self.n * ENV_NUDGE
        return M


def stage_post(rig, post, env_root, env_parts):
    """Left hand: press (APPROACH -> TOUCH), hold, follow in (SINK0 -> GONE), hold, lift
    (LIFT0 -> LIFT1), lower to his side (-> REST). Envelope: carried rigidly, then shrinks to
    the slot centre from SINK0 and is gone on GONE."""
    e, c = post.e, post.c
    pinch_at = {}
    for f in range(APPROACH - 2, LIFT0 + 1):
        if f <= TOUCH:
            t = min(1.0, (TOUCH - f) / (TOUCH - APPROACH))
            p = post.pinch + e * (APPROACH_D * smooth(t))
        elif f <= SINK0:
            p = post.pinch.copy()
        else:
            k = smooth((f - SINK0) / (GONE - 2 - SINK0))
            p = post.pinch - e * (PRESS_D * k)
        pinch_at[f] = p
    for f, p in sorted(pinch_at.items()):
        post.key(f, p, 'BEZIER' if f in (APPROACH - 2, LIFT0) else 'LINEAR')
    # the lift: up and out toward his left (the macro frame's right edge), clear of his chest
    right = post.o.cross(Z).normalized()
    up = (Z * 0.62 + right * 0.74 + post.o * 0.10).normalized()
    p_end = pinch_at[LIFT0]
    for f in range(LIFT0 + 1, LIFT1 + 1):
        k = smooth((f - LIFT0) / (LIFT1 - LIFT0))
        post.key(f, p_end + up * (0.10 * k), 'BEZIER' if f == LIFT1 else 'LINEAR')
    # envelope: carried by the pinch until SINK0, then shrinks to the slot centre
    for f in range(START - 2, GONE + 1):
        p = pinch_at.get(f, pinch_at[min(pinch_at)])
        Mf = post.envelope_matrix(p)
        s = 1.0
        if f > SINK0:
            u = (f - SINK0) / (GONE - SINK0)
            s = max(0.015, 1.0 - ease(u))
        loc = c + (Mf.translation - c) * s
        env_root.location = loc
        env_root.rotation_quaternion = Mf.to_quaternion()
        env_root.scale = (s, s, s)
        for path in ('location', 'rotation_quaternion', 'scale'):
            env_root.keyframe_insert(path, frame=f)
    for fc in C.fcurves(env_root.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    for o in [env_root] + env_parts:
        o.hide_render = False
        o.keyframe_insert('hide_render', frame=START - 2)
        o.hide_render = True
        o.keyframe_insert('hide_render', frame=GONE)
        for fc in C.fcurves(o.animation_data.action):
            if fc.data_path == 'hide_render':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'


def stage_lower(rig, post):
    """LIFT1 -> REST: the left hand swings down to hang at his side, through one intermediate
    pose out in front of his left hip (solved clear of the chest), so the swing does not cut
    across his torso; bake_pauldrons() then re-keys the shoulder caps along it."""
    mid = (LIFT1 + REST) // 2
    rig.place_arm_clear(mid, 'L', V((0.24, -0.17, 0.98)), hand_u=V((0.05, -0.35, -0.94)),
                        hand_w=V((-0.85, -0.45, 0.10)), pole=V((0.8, 0.5, -0.3)), interp='BEZIER',
                        fingers='relaxed')
    rig.pose(mid, 'BEZIER', fingers_L='relaxed', thumb_L=0.3)
    rig.relaxed_arm(REST, 'L', 'BEZIER')
    rig.relaxed_arm(END + 4, 'L', 'BEZIER')


# ================================================================== steam

def steam_material():
    """A steam puff: a soft round alpha card (radial falloff x drifting 4D noise in the puff's
    own coordinates, so no two puffs match), translucent and faintly luminous, so it reads as a
    pale veil over the dark slot and the room and almost vanishes over the white lid, as real
    steam does. Its opacity is the object property 'puff_a' (keyed per puff) times the
    'steam_fade' value (keyed for the whole shot)."""
    m = bpy.data.materials.get('s02_steam')
    if m:
        return m
    m = bpy.data.materials.new('s02_steam')
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)

    def math_(op, a=None, b=None, va=None, vb=None, clamp=False):
        node = N.new('ShaderNodeMath')
        node.operation = op
        node.use_clamp = clamp
        for i, (sock, val) in enumerate(((a, va), (b, vb))):
            if sock is not None:
                L.new(sock, node.inputs[i])
            elif val is not None:
                node.inputs[i].default_value = val
        return node.outputs[0]

    def remap(x, a, b):
        node = N.new('ShaderNodeMapRange')
        node.interpolation_type = 'SMOOTHSTEP'
        node.inputs['From Min'].default_value = a
        node.inputs['From Max'].default_value = b
        L.new(x, node.inputs['Value'])
        return node.outputs['Result']

    out = N.new('ShaderNodeOutputMaterial')
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['UV'], sep.inputs['Vector'])
    du = math_('SUBTRACT', sep.outputs['X'], vb=0.5)
    dv = math_('SUBTRACT', sep.outputs['Y'], vb=0.5)
    r2 = math_('MULTIPLY', math_('ADD', math_('MULTIPLY', du, du), math_('MULTIPLY', dv, dv)), vb=4.0)
    radial = math_('POWER', math_('SUBTRACT', None, r2, va=1.0, clamp=True), vb=1.8)
    info = N.new('ShaderNodeObjectInfo')
    off = N.new('ShaderNodeVectorMath')
    off.operation = 'SCALE'
    L.new(info.outputs['Random'], off.inputs['Vector'])      # (random, random, random) * 40
    off.inputs['Scale'].default_value = 40.0
    p_ = N.new('ShaderNodeVectorMath')
    p_.operation = 'ADD'
    L.new(tc.outputs['UV'], p_.inputs[0])
    L.new(off.outputs['Vector'], p_.inputs[1])
    nz = N.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 2.6
    nz.inputs['Detail'].default_value = 5.0
    nz.inputs['Roughness'].default_value = 0.62
    nz.inputs['Distortion'].default_value = 1.1
    nz.inputs['W'].driver_add('default_value').driver.expression = 'frame * 0.035'
    L.new(p_.outputs['Vector'], nz.inputs['Vector'])
    wisp = remap(nz.outputs['Fac'], 0.36, 0.72)
    pa = N.new('ShaderNodeAttribute')
    pa.attribute_type = 'OBJECT'
    pa.attribute_name = 'puff_a'
    fade = N.new('ShaderNodeValue')          # keyed by build_steam: gone as the camera leaves the cup
    fade.name = fade.label = 'steam_fade'
    fade.outputs[0].default_value = 1.0
    a_ = math_('MULTIPLY', math_('MULTIPLY', radial, wisp), math_('MULTIPLY', pa.outputs['Fac'], fade.outputs[0]))
    a_ = math_('MULTIPLY', a_, vb=STEAM_ALPHA, clamp=True)
    tr = N.new('ShaderNodeBsdfTranslucent')
    tr.inputs['Color'].default_value = (0.95, 0.96, 1.0, 1)
    df = N.new('ShaderNodeBsdfDiffuse')
    df.inputs['Color'].default_value = (0.88, 0.89, 0.92, 1)
    em = N.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.92, 0.94, 0.97, 1)
    em.inputs['Strength'].default_value = STEAM_GLOW
    mx = N.new('ShaderNodeMixShader')
    mx.inputs['Fac'].default_value = 0.55
    L.new(df.outputs[0], mx.inputs[1])
    L.new(tr.outputs[0], mx.inputs[2])
    add = N.new('ShaderNodeAddShader')
    L.new(mx.outputs[0], add.inputs[0])
    L.new(em.outputs[0], add.inputs[1])
    tp = N.new('ShaderNodeBsdfTransparent')
    m2 = N.new('ShaderNodeMixShader')
    L.new(a_, m2.inputs['Fac'])
    L.new(tp.outputs[0], m2.inputs[1])
    L.new(add.outputs[0], m2.inputs[2])
    L.new(m2.outputs[0], out.inputs['Surface'])
    try:
        m.cycles.emission_sampling = 'NONE'
    except (AttributeError, TypeError):
        pass
    return m


def build_steam(post, move, coll):
    """Two thin threads of steam out of the ends of the slot, built as streams of soft puffs
    (billboards that always face the lens, so they never turn edge-on): each puff is born at
    the slot end, rises, swells and drifts outward toward the macro frame's side, climbing past
    the lens as it fades. A puff leaves every STEAM_EVERY frames per thread; they are keyed on
    every frame of their life (location, facing, size, opacity) and hidden outside it."""
    mat = steam_material()
    rng = random.Random(11)
    right = post.o.cross(Z).normalized()
    cams = {}
    out = []
    for k, sgn in enumerate((-1.0, 1.0)):
        base = post.c + post.a * (sgn * 0.0058) + Z * 0.0012
        b0 = START - STEAM_LIFE - 4 + 2 * k
        idx = 0
        for birth in range(b0, STEAM_END, STEAM_EVERY):
            jit = (rng.uniform(0.75, 1.3), rng.uniform(-1.0, 1.0), rng.uniform(0.8, 1.25), rng.uniform(0, 6.28))
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.new('UVMap')
            vs = [bm.verts.new((x, y, 0.0)) for x, y in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5))]
            f_ = bm.faces.new(vs)
            for lp in f_.loops:
                lp[uvl].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
            o = P.to_object(bm, f's02_puff{k}_{idx:02d}', [mat], coll, smooth=None, recalc=False)
            idx += 1
            for flag in ('visible_shadow', 'visible_diffuse', 'visible_glossy', 'visible_transmission'):
                setattr(o, flag, False)
            o.rotation_mode = 'QUATERNION'
            q_prev = None
            for f in range(birth, birth + STEAM_LIFE + 1):
                t = (f - birth) / STEAM_LIFE
                if f not in cams:
                    cams[f] = move.state(f)[0]
                rise = STEAM_RISE * jit[0] * t ** 1.25
                drift = post.a * (sgn * (0.004 * t + 0.022 * t * t) * jit[2]) + \
                    post.o * (STEAM_DRIFT_O * t ** 1.5 + 0.003 * jit[1] * t) + \
                    right * (0.002 * math.sin(6.0 * t + jit[3]))
                p = base + Z * rise + drift
                size = 0.003 + 0.026 * t ** 1.1 * jit[2]
                view = (cams[f] - p).normalized()
                q = view.to_track_quat('Z', 'Y')
                if q_prev is not None and q_prev.dot(q) < 0:
                    q.negate()
                q_prev = q
                o.location = p
                o.rotation_quaternion = q
                o.scale = (size, size, size)
                o['puff_a'] = math.sin(math.pi * min(1.0, t * 1.15)) ** 1.3 * (1.0 - 0.35 * t)
                for path in ('location', 'rotation_quaternion', 'scale', '["puff_a"]'):
                    o.keyframe_insert(path, frame=f)
            for fc in C.fcurves(o.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
            for f, hide in ((min(birth - 1, START - 60), True), (birth, False), (birth + STEAM_LIFE, True)):
                o.hide_render = hide
                o.keyframe_insert('hide_render', frame=f)
            for fc in C.fcurves(o.animation_data.action):
                if fc.data_path == 'hide_render':
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'CONSTANT'
            out.append(o)
    v = mat.node_tree.nodes['steam_fade'].outputs[0]
    for f, val in STEAM_FADE:
        v.default_value = val
        v.keyframe_insert('default_value', frame=f)
    return out


# ================================================================== camera

class Move:
    """The motion-control move: locked top-down macro until MOVE0, one eased pull-back that rises
    off the lid, tilts from -90 to 0 deg and zooms LENS0 -> LENS1 while focus pulls from the slot
    rim to the face glass, locked again from MOVE1. The frame centre travels on a path from the
    slot up his front; the camera yaw is continuous with the macro's (the slot's long axis
    horizontal) because the camera first backs away along the slot's outward normal. Level at
    the end: the lens shift (keyed with the tilt) keeps the frame centre on its path."""

    def __init__(self, post, rig):
        sp = V(R.SYNERGY_POS)
        self.c = post.c.copy()
        self.o = post.o.copy()
        self.P0 = self.c + Z * D0
        a = math.radians(END_ANG)
        self.P1 = V((sp.x - END_DIST * math.sin(a), sp.y - END_DIST * math.cos(a), END_H))
        scr = rig.screen_point(0.5, 0.5, START)
        self.face = scr
        self.T1 = V((scr.x - 0.01, scr.y, END_AIM_Z))
        h1 = V((self.T1.x - self.P1.x, self.T1.y - self.P1.y, 0.0)).normalized()
        self.h1 = h1
        # camera path: back away along -o (yaw continuity), rise a little, arrive level moving back
        self.B = (self.P0, self.P0 - self.o * 0.30 + Z * 0.03, self.P1 + h1 * 1.10 + Z * 0.0, self.P1)
        # frame-centre path: stay on the cup while the camera clears it, then up his front
        self.T = (self.c, self.c + V((0.0, 0.0, -0.02)), self.T1 + V((0.0, -0.02, -0.06)), self.T1)

    def state(self, f):
        """(location, rotation quaternion, lens, shift_y, focus distance, fstop, exposure)."""
        u = move_progress((f - MOVE0) / (MOVE1 - MOVE0))
        t = u
        tt = u + 0.06 * u * (1.0 - u)           # the frame centre leads the camera a touch
        P_ = bezier(*self.B, t)
        T_ = bezier(*self.T, tt)
        d = T_ - P_
        hd = V((d.x, d.y, 0.0))
        if hd.length < 1e-5:
            psi = math.atan2(self.o.y, self.o.x)
        else:
            psi = math.atan2(hd.y, hd.x)
        theta = math.atan2(d.z, max(hd.length, 1e-9))
        k = smooth((u - 0.35) / 0.65)
        pitch = theta * (1.0 - k)
        lens = LENS0 + (LENS1 - LENS0) * ease(min(1.0, max(0.0, (u - 0.05) / 0.9)))
        shift = math.tan(theta - pitch) * lens / 36.0
        h = V((math.cos(psi), math.sin(psi), 0.0))
        fwd = h * math.cos(pitch) + Z * math.sin(pitch)
        right = h.cross(Z).normalized()
        upv = (-fwd).cross(right).normalized()
        Rm = Matrix((right, upv, -fwd)).transposed()
        # focus: the slot rim, then up to the face glass
        kf = smooth((u - 0.10) / 0.72)
        fp = self.c.lerp(self.face, kf)
        focus = max(0.05, (fp - P_).dot(fwd))
        fstop = FSTOP0 + (FSTOP1 - FSTOP0) * smooth((u - 0.2) / 0.6)
        expo = EXPOSURE0 * (1.0 - smooth((u - 0.05) / 0.6))
        return P_, Rm.to_quaternion(), lens, shift, focus, fstop, expo


def build_camera(move):
    sc = bpy.context.scene
    cam = C.camera('cam_s02', LENS0, tuple(move.P0), None, fstop=FSTOP0, focus=D0, clip=(0.005, 200.0))
    cam.rotation_mode = 'QUATERNION'
    cd = cam.data
    cd.dof.aperture_blades = 7
    q_prev = None
    for f in range(START - 2, END + 3):
        loc, q, lens, shift, focus, fstop, expo = move.state(f)
        if q_prev is not None and q_prev.dot(q) < 0:
            q.negate()
        q_prev = q
        cam.location = loc
        cam.rotation_quaternion = q
        cd.lens = lens
        cd.shift_y = shift
        cd.dof.focus_distance = focus
        cd.dof.aperture_fstop = fstop
        sc.view_settings.exposure = expo
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_quaternion', frame=f)
        cd.keyframe_insert('lens', frame=f)
        cd.keyframe_insert('shift_y', frame=f)
        cd.dof.keyframe_insert('focus_distance', frame=f)
        cd.dof.keyframe_insert('aperture_fstop', frame=f)
        sc.view_settings.keyframe_insert('exposure', frame=f)
    for owner in (cam, cd, sc):
        ad = owner.animation_data
        if ad and ad.action:
            for fc in C.fcurves(ad.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
    return cam


# ================================================================== light

def bounce_light(coll):
    """The treatment's warm walnut bounce (the rig owner's proposal, tools/synergy_in_room.py):
    the slab's warm reflection off the table in front of him lifts the lower torso, the arms and
    the cup hand, which the room as built leaves unlit. Invisible to camera and glossy rays."""
    sp = V(R.SYNERGY_POS)
    lt = C.area_light('s02_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                      9.0, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=coll)
    lt.visible_camera = False
    lt.visible_glossy = False
    return lt


def rim_light(coll):
    """The skylight slab's spill off the head wall, high behind him (tools/synergy_in_room.py
    proposal): the crown, headband and shoulders separate from the black void of the portrait."""
    sp = V(R.SYNERGY_POS)
    lt = C.area_light('s02_rim', (sp.x + 0.35, sp.y + 1.05, 2.55), (sp.x, sp.y, 1.55), 55.0, 0.9, 0.35,
                      color=(0.86, 0.91, 1.0), coll=coll)
    lt.visible_camera = False
    return lt


def envelope_light(post, parts, coll):
    """A low warm card raking across the envelope's face from the side away from the hand,
    light-linked to the envelope alone: the paper's tooth, the flap's lifted edges and the
    seal's bevel read in the macro, while the lid keeps the room's light and its 'lid' kit."""
    side = 1.0 if post.x.x > 0 else -1.0
    ctr = post.c + post.e * (ENV_H * 0.45)
    loc = ctr - post.x * (side * 0.16) + post.n * 0.035 + Z * 0.02
    lt = C.area_light('s02_env_rake', tuple(loc), tuple(ctr), ENV_RAKE, 0.10, 0.03, color=(1.0, 0.94, 0.86),
                      coll=coll)
    lt.visible_camera = False
    R._link_light(lt, parts, 'S02_envelope_receivers')
    return lt


def slot_glow_light(post, coll):
    """The amber pulse as light: a tiny lamp just inside the slot, keyed with the glow, so it
    spills up out of the slot onto the lid round it and the lifting fingertips."""
    lt = C.point_light('s02_slot_glow', tuple(post.c - post.ax * 0.0016), energy=0.0, radius=0.002,
                       color=(1.0, 0.55, 0.20), coll=coll)
    lt.visible_camera = False
    for f, e in ((GLOW - 1, 0.0), (GLOW + 1, 0.030), (GLOW + 5, 0.018), (GLOW + 7, 0.0)):
        lt.data.energy = e
        lt.data.keyframe_insert('energy', frame=f)
    return lt


# ================================================================== build

def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(placeholder=False, state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room.render_budget(kind='macro', samples=args.samples or None)
    sc.cycles.transparent_max_bounces = max(sc.cycles.transparent_max_bounces, 12)   # stacked steam puffs

    # ---- Synergy: canon idle with the cup, the post, the breath, the blink
    tl = F.FaceTimeline(START - 8, END + 8).blink(BLINK)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    for f in (START - 12, END + 4):
        rig.apply_preset(f, 'idle_cup', 'BEZIER')
    post = Post(rig, SINK0)
    coll = C.collection('S02')
    env_root, env_parts = build_envelope(coll, seal_x=-post.side * SEAL_X)
    stage_post(rig, post, env_root, env_parts)
    stage_lower(rig, post)
    rig.bake_pauldrons(START - 2, END + 2)
    rig.breathe(START, END)
    rig.cup_handle.slot_glow(GLOW, dur=7, peak=GLOW_PEAK)

    # ---- set dressing: light (steam after the camera: its puffs face the lens)
    sc.frame_set(START)
    room.insert_lights('lid', target=rig.cup_handle)
    room.use_kits('lid')
    bounce_light(coll)
    rim_light(coll)
    slot_glow_light(post, coll)
    envelope_light(post, env_parts, coll)

    # ---- camera
    move = Move(post, rig)
    cam = build_camera(move)
    sc.camera = cam
    build_steam(post, move, coll)
    for f in range(185, END + 1):
        rig.glass_glint(cam, f, strength=GLINT)
    sc.frame_set(END)
    room.front_bokeh(cam, END)
    room.tune_scanlines(cam)
    room.compositor(threshold=1.6)

    # shutter: the film's half-frame, closed down while his face slides into frame on the move,
    # so the LED eyes keep their 2x3 squares instead of smearing into bars
    rd = sc.render
    for f, v in SHUTTER:
        rd.motion_blur_shutter = v
        rd.keyframe_insert('motion_blur_shutter', frame=f)
    if sc.animation_data and sc.animation_data.action:
        for fc in C.fcurves(sc.animation_data.action):
            if fc.data_path == 'render.motion_blur_shutter':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'BEZIER'
                    kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'

    # sampling seed: fixed while the camera is locked off, animated during the move
    cy = sc.cycles
    cy.use_animated_seed = False
    for f in range(START - 2, END + 3):
        cy.seed = f if MOVE0 <= f <= MOVE1 else 0
        cy.keyframe_insert('seed', frame=f)
    sc.frame_set(START)
    return dict(room=room, rig=rig, post=post, cam=cam, move=move, envelope=env_root)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
