"""S02 · f129-256 · the lid reveal (E3_MACRO_INSERTS -> E2_LONG_ROOM, lit).

    blender -b --factory-startup -P shots/s02_lid_reveal.py -- --quality proof --only 129,136,148,157,232,256
    blender -b --factory-startup -P shots/s02_lid_reveal.py -- --quality final

The match cut from S01: the slot-sun becomes the dark sip slot of his lid, seen
straight down through a 100 mm macro (env_room.preview_camera 's02_lid': slot
centred, long axis horizontal, 20% of the frame width). Ivory fingers press a
sealed envelope, folded once lengthwise, edge-first into the slot; the pads open
and the slot takes it (it shrinks into the slot), an amber glow pulses up out of
the well, the fingers lift away. The macro holds f/16 so the fold, the flap and the
seal read; focus sits on the envelope's seal plane and racks to the slot rim as it
goes. Then one continuous motion-control pull-back (f157-232): the camera orbits
off the lid round the cup (the cup stays near frame centre while the lens comes
down to cup height), passes the cup, the lanyard V and the badge with the lens at
or below his collar (no look into the collar cavity), then pulls back and cranes up
past the chest plates and chip, the pistons and the mic until the face lands
(about f216) and settles. Lens 100 -> 65 mm, f/16 -> f/2.8, 180-degree shutter
throughout; it ends level with the lens shifted. He holds and blinks once (f240).

End framing (a deliberate change from the treatment's 2.1 m, for the director to
sign off): 65 mm from 3.15 m (END_DIST, measured from SYNERGY_POS), 10 deg toward
his right, lens 1.58 m high. At 2.1 m a 65 mm lens frames about 0.65 m of height,
which cannot hold the head in the upper third, the cup in the lower-left third and
the badge at lower centre together. From 3.15 m the frame runs from just above the
crown down into the pelvis plates, so the bottom edge no longer cuts through the
dark waist gap and its cables. The frame is aimed off centre (END_AIM_X): the cup
sits on the left third line and the head just left of centre (at this distance the
cup is only ~10% of the frame width from his centre line, so the head cannot also
sit right of centre). The colleague bokeh (cobalt, acid yellow, pink, sky) is
placed by hand in the voids (place_bokeh).

Sync points (film frames; 90 BPM, a beat every 16 frames):
  f131  the envelope's folded edge meets the spout (lid tick)
  f136  it passes the slot plane: the shrink starts (contact); the pads open f136-138
  f142  fastest slide (paper rustle peak)
  f148  gone (plip); the amber glow peaks
  f146-154 amber glow; f150-160 the fingers lift away; f150-181 the hand lowers to his side
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
RELEASE = SINK0 + 2     # the pads have opened: the slot takes the envelope from an opening pinch
GONE = 148              # vanished (plip)
GLOW = 147              # amber pulse: dark at 146, peak 148, out by 154
LIFT0, LIFT1 = 150, 160  # the fingers lift away out of the macro frame
REST = 181              # the left hand hangs at his side (off screen until then)
MOVE0, MOVE1 = 157, 232  # the motion-control pull-back
BLINK = 240             # middle row 240-241, dark 242-243, middle row 244-245, full 246

# ------------------------------------------------------------------ steam: two thin threads
STEAM_ALPHA = 0.65      # opacity of a wisp at its densest
STEAM_GLOW = 0.22       # the light the steam scatters (emission)
STEAM_RISE = 0.035      # a thread climbs 35 mm in a puff's life: it stays near the focal zone
STEAM_DRIFT_O = 0.026   # the draft carries it over the lid's far rim (frame top), where the dark band shows it
STEAM_DRIFT_A = 0.005   # and a little outward along the slot
STEAM_W = (0.0016, 0.0062)   # wisp width at birth / at the end of its life
STEAM_STRETCH = 2.4     # each wisp is this much longer along its path than wide (a thread, not a puff)
STEAM_LIFE = 30         # frames a wisp lives
STEAM_EVERY = 2         # a new wisp per thread every N frames
STEAM_END = 176         # last wisp born
STEAM_FADE = ((MOVE0 + 4, 1.0), (MOVE0 + 18, 0.0))    # gone before the lens turns side-on to the threads

# ------------------------------------------------------------------ light
ENV_RAKE = 2.5          # W, the raking card on the envelope (and the pinching fingertips)
GLINT = 40.0            # the skylight's reflected slot along the top of the face glass
GLOW_EMIT = 2.6         # slot glow emission at the well's centre at the pulse peak (#FF8A2A)
GLOW_LAMP = 0.05        # W, the glow as light: a soft lamp above the slot
GLOW_LAMP_H = 0.012     # its height above the slot (lights the spout lip, the lid round it, the fingertips)
TOP_CARD = 14.0         # W, a soft cool top card over his crown and shoulders (portrait)

# ------------------------------------------------------------------ envelope and posting
ENV_L = 0.060           # a small sealed envelope (60 x 42 mm) folded once lengthwise: its ends stay in frame
ENV_H = 0.021           # folded height (fold edge to the two free edges)
ENV_T0, ENV_T1 = 0.0010, 0.0018   # thickness at the fold / at the free edges (the card inside springs it)
ENV_BOW = 0.0016        # the outer face bows out between the fold and the free edges
ENV_TILT = 32.0         # the envelope leans back toward his body (degrees from vertical): the lens sees its face
PINCH_UP = 0.015        # pinch point up the envelope from its folded edge
PINCH_X = 0.017         # ... and along it, toward his left: the index tip, its black band and bronze cap sit
                        # inside the macro frame's right edge (the rest of the hand stays out of it)
APPROACH_D = 0.020      # the press: distance travelled edge-first, APPROACH -> TOUCH
PINCH_INDEX = (30.0, 50.0, 35.0)   # a card pinch: the distal pad flat on the envelope, the finger rising off it
                        # (the rig's 'pinch' curls 150 deg and hooks over the paper; < 110 deg the thumb
                        # cannot oppose it), thumb solved opposite (rig.thumb_pinch(index_angles=...))
ENV_NUDGE = -0.0008     # the envelope sits this far toward the thumb pad (the index pad rests on the flap)
PRESS_D = 0.0015        # the last push edge-first as the pads open (SINK0 -> RELEASE)
OPEN = 0.0025           # the pads part this much as they let go (each pad 1.25 mm off the paper)
SEAL_X = 0.008          # seal (and the flap's point) off centre, away from the pinching hand
SEAL_UP = 0.0060        # seal centre above the fold edge (in focus, near the slot plane)
SEAL = 0.0075           # seal side

# ------------------------------------------------------------------ camera
LENS0, LENS1 = 100.0, 65.0
D0 = P.CUP['slot_len'] / 0.20 * LENS0 / 36.0   # 0.208 m: the approved s02_lid framing (slot 20% of the width)
FSTOP_POST = 16.0       # the post: deep enough to hold the fold, flap and seal (about +-4 mm at 0.2 m)
FOCUS_UP = 0.006        # focus during the post: the envelope's seal and fold plane, this far above the slot
RACK = (144, 148)       # focus racks down to the slot rim as the envelope disappears
FSTOP1 = 2.8
END_DIST = 3.15         # from SYNERGY_POS: crown to pelvis plates at 65 mm (see the docstring)
END_ANG = 10.0          # toward his right: wedge to the viewer's left, earcup to the viewer's right
END_H = 1.58            # screen height; the camera ends level (lens shift frames him)
END_AIM_Z = 1.335       # world height at the frame centre at the end (in the face plane)
END_AIM_X = 0.095       # frame centre this far to the viewer's right of his centre line: cup on the left third
SHUTTER = 0.5           # the film's 180-degree shutter, unchanged through the move
EXPOSURE0 = -1.0        # the lid sits in the sun slab (env_room.PREVIEW_EXPOSURE['s02_lid']); back to 0 on him
# the move's channels (see Move): frame-centre keys, frame-height ease, view elevation, lens
MOVE_T = (('slot', MOVE0), ('cup_top', 171), ('cup_badge', 192), ('chest', 206), ('aim', 227))
MOVE_H = (1.0, 1.5, 228)       # frame height: log-space ease u^a (1-u)^b, MOVE0 -> frame
MOVE_EL = ((MOVE0, 90.0), (194, 5.5), (226, None))   # elevation of the lens over the frame centre (deg)
MOVE_LENS = (MOVE0, 228)
MOVE_LEVEL = (198, 230)        # the tilt hands over to the lens shift: level by the end
MOVE_YAW = 200                 # heading eased from the macro's (slot long axis horizontal) to the end's
FOCUS_FACE = (200, 214)        # focus walks the featured surfaces (Move.FK), landing on the face glass at the end
STOP_OPEN = (MOVE0, 212)       # f/16 -> f/2.8 over the move (log-space)
SEED_PX = 1.0           # sampling seed animated only where the picture moves more than this (px/f at 1600)


def ease(t):
    return C.ease(t, 'inout')


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def beta_ease(u, a, b, n=800):
    """Progress for linear time u (0..1) of a motion whose speed is ~ u^a (1-u)^b (a, b > 1: it starts
    and stops without a jolt)."""
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


def hermite_keys(f, keys):
    """C1 curve through (frame, Vector) keys at their frames: tangents from the neighbours (scaled for
    uneven spacing), zero at both ends, so the walk starts and stops softly."""
    fs = [k[0] for k in keys]
    ps = [V(k[1]) for k in keys]
    if f <= fs[0]:
        return ps[0].copy()
    if f >= fs[-1]:
        return ps[-1].copy()
    i = max(j for j in range(len(fs) - 1) if fs[j] <= f)
    t = (f - fs[i]) / (fs[i + 1] - fs[i])

    def tan(j):
        if j == 0 or j == len(ps) - 1:
            return ps[j] * 0.0
        return (ps[j + 1] - ps[j - 1]) / (fs[j + 1] - fs[j - 1])
    m1 = tan(i) * (fs[i + 1] - fs[i])
    m2 = tan(i + 1) * (fs[i + 1] - fs[i])
    t2, t3 = t * t, t * t * t
    return ps[i] * (2 * t3 - 3 * t2 + 1) + m1 * (t3 - 2 * t2 + t) + ps[i + 1] * (-2 * t3 + 3 * t2) + m2 * (t3 - t2)


def eased_keys(f, keys, fn=smoother):
    """Piecewise interpolation through (frame, value) keys, each segment eased in and out."""
    if f <= keys[0][0]:
        return keys[0][1]
    for (fa, va), (fb, vb) in zip(keys, keys[1:]):
        if f <= fb:
            t = fn((f - fa) / (fb - fa))
            return va * (1 - t) + vb * t
    return keys[-1][1]


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
        # the let-go: the thumb re-solved OPEN wider; the index pad lifts off the flap by half of it
        # (q_out, world), so each pad ends OPEN / 2 off the paper
        self.pin_open = rig.thumb_pinch('L', index_angles=PINCH_INDEX, gap=self.gap + OPEN)
        q_c = (Rt @ q_rest).normalized()                      # index pad -> thumb pad (chest-rest space)
        self.q_out = -(Dc.inverted().to_3x3() @ q_c).normalized()
        print(f'S02 POST pen={self.sol["pen"]:.5f} score={self.sol["score"]:.3f} reach={self.sol["reach"]:.4f} '
              f'shoulder={self.sol["shoulder"]} pole={tuple(round(x, 2) for x in self.sol["pole"])} '
              f'u={tuple(round(x, 2) for x in self.sol["u"])} thumb_err={self.pin["err"]:.4f} '
              f'pad_gap={self.pin["pad_gap"] * 1000:.1f}mm', flush=True)

    def key(self, frame, pinch_world, interp='LINEAR', open_k=0.0):
        """Key the left arm with the pinch point at `pinch_world`, the contact orientation kept;
        open_k 0..1 opens the thumb from the card pinch to the let-go (OPEN wider)."""
        rig = self.rig
        Dc = rig._chest_delta(frame)
        tgt = Dc @ V(pinch_world)
        rig.place_arm(frame, 'L', tgt - self.off, self.sol['u'], self.sol['w'], self.sol['pole'], interp,
                      shoulder=self.sol['shoulder'])
        rig.pose(frame, interp, fingers_L=self.fingers)
        for i, (R0, R1) in enumerate(zip(self.pin['rot'], self.pin_open['rot'])):   # thumb opposite the index
            Rr = R0 if open_k <= 0.0 else R0.to_quaternion().slerp(R1.to_quaternion(), min(1.0, open_k)).to_matrix()
            rig.key_rest_rot(f'thumb_{i}_L', frame, Rr, interp)

    def envelope_matrix(self, frame_pinch):
        """World matrix of the envelope root when the pinch point sits at `frame_pinch`."""
        Rm = Matrix((self.x, self.n, self.e)).transposed()
        M = Rm.to_4x4()
        M.translation = self.c + (V(frame_pinch) - self.pinch) + self.n * ENV_NUDGE
        return M


def stage_post(rig, post, env_root, env_parts):
    """Left hand: press (APPROACH -> TOUCH), hold, one last push edge-first while the pads open
    (SINK0 -> RELEASE: the slot takes the envelope from an opening pinch), hold still, lift
    (LIFT0 -> LIFT1), lower to his side (-> REST). Envelope: carried rigidly, then from SINK0 it
    shrinks to the slot centre (the lid occludes the rest) and is gone on GONE."""
    e, c = post.e, post.c
    pinch_at, open_at, env_at = {}, {}, {}
    for f in range(APPROACH - 2, RELEASE + 1):
        k = 0.0
        if f <= TOUCH:
            t = min(1.0, (TOUCH - f) / (TOUCH - APPROACH))
            p = post.pinch + e * (APPROACH_D * smooth(t))
        elif f <= SINK0:
            p = post.pinch.copy()
        else:
            k = smooth((f - SINK0) / (RELEASE - SINK0))
            p = post.pinch - e * (PRESS_D * k)
        env_at[f] = p.copy()                                   # where the paper is pinched
        pinch_at[f] = p + post.q_out * (0.5 * OPEN * k)        # the index pad lifts off it, the thumb opens
        open_at[f] = k
    for f, p in sorted(pinch_at.items()):
        post.key(f, p, 'BEZIER' if f == APPROACH - 2 else 'LINEAR', open_k=open_at[f])
    post.key(LIFT0, pinch_at[RELEASE], 'BEZIER', open_k=1.0)    # open and still until the lift
    # the lift: up and out toward his left (the macro frame's right edge), clear of his chest
    right = post.o.cross(Z).normalized()
    up = (Z * 0.62 + right * 0.74 + post.o * 0.10).normalized()
    p_end = pinch_at[RELEASE]
    for f in range(LIFT0 + 1, LIFT1 + 1):
        k = smooth((f - LIFT0) / (LIFT1 - LIFT0))
        post.key(f, p_end + up * (0.10 * k), 'BEZIER' if f == LIFT1 else 'LINEAR', open_k=1.0)
    # envelope: carried by the pinch until SINK0, then shrinks to the slot centre
    first = min(env_at)
    for f in range(START - 2, GONE + 1):
        p = env_at.get(f, env_at[first] if f < first else env_at[RELEASE])
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
    """A steam wisp: a soft elliptical alpha card (radial falloff x drifting 4D noise in the card's
    own UVs, so no two match), translucent and faintly luminous, so it reads as a pale thread over
    the dark band beyond the lid and almost vanishes over the white lid, as real steam does. Its
    opacity is the object property 'puff_a' (keyed per wisp) times the 'steam_fade' value (keyed
    for the whole shot)."""
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
    """Two thin threads of steam out of the ends of the slot, each a stream of narrow wisps (cards
    that face the lens, stretched along their own path): every wisp is born at the slot end, climbs
    STEAM_RISE (so the thread stays near the focal zone instead of rising into the lens's blur)
    and is carried by a draft across the lid and over its far rim, where the dark band beyond the
    lid shows it. A wisp leaves every STEAM_EVERY frames per thread; it is keyed on every frame of
    its life (location, facing, size, opacity), hidden outside it, and hidden for good once the
    shot's steam fade is done (no transparent bounces through invisible cards)."""
    mat = steam_material()
    rng = random.Random(11)
    right = post.o.cross(Z).normalized()
    hide_at = STEAM_FADE[-1][0] + 1
    cams = {}
    out = []
    for k, sgn in enumerate((-1.0, 1.0)):
        base = post.c + post.a * (sgn * 0.0058) + Z * 0.0012
        b0 = START - STEAM_LIFE - 4 + k
        idx = 0
        for birth in range(b0, min(STEAM_END, hide_at), STEAM_EVERY):
            jit = (rng.uniform(0.8, 1.2), rng.uniform(-1.0, 1.0), rng.uniform(0.85, 1.2), rng.uniform(0, 6.28))

            def path(t, jit=jit, sgn=sgn, base=base):
                rise = STEAM_RISE * jit[0] * t ** 1.1
                drift = post.a * (sgn * STEAM_DRIFT_A * t * jit[2]) + \
                    post.o * (STEAM_DRIFT_O * t ** 1.4 + 0.002 * jit[1] * t) + \
                    right * (0.0010 * math.sin(7.0 * t + jit[3]))
                return base + Z * rise + drift
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
            last = min(birth + STEAM_LIFE, hide_at)
            for f in range(birth, last + 1):
                t = (f - birth) / STEAM_LIFE
                if f not in cams:
                    cams[f] = move.state(f)[0]
                p = path(t)
                vel = path(min(1.0, t + 0.02)) - path(max(0.0, t - 0.02))
                view = (cams[f] - p).normalized()
                yax = vel - view * vel.dot(view)
                if yax.length < 1e-7:
                    yax = post.o - view * post.o.dot(view)
                yax.normalize()
                xax = yax.cross(view).normalized()
                q = Matrix((xax, yax, view)).transposed().to_quaternion()
                if q_prev is not None and q_prev.dot(q) < 0:
                    q.negate()
                q_prev = q
                w = STEAM_W[0] + (STEAM_W[1] - STEAM_W[0]) * t * jit[2]
                o.location = p
                o.rotation_quaternion = q
                o.scale = (w, w * STEAM_STRETCH, w)
                o['puff_a'] = math.sin(math.pi * min(1.0, t * 1.15)) ** 1.3 * (1.0 - 0.35 * t)
                for path_ in ('location', 'rotation_quaternion', 'scale', '["puff_a"]'):
                    o.keyframe_insert(path_, frame=f)
            for fc in C.fcurves(o.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
            for f, hide in ((min(birth - 1, START - 60), True), (birth, False), (last, True)):
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


# ================================================================== the slot: glow and wall

def _nodes(m):
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
    return N, L, math_


def slot_glow_material():
    """The amber pulse in the well: brightest at the centre of the well and falling off to a deeper
    red-amber at the lip, in a saturated amber (#FF8A2A) whose level stays under AgX's highlight
    roll-off so the hue survives. Reads the glow object's keyed 'led' (props.Cup.slot_glow, 0..1);
    object coordinates (the glow is a stadium of the slot's size + 1 mm, long axis along local X)."""
    m = bpy.data.materials.get('s02_slot_glow')
    if m:
        return m
    m = bpy.data.materials.new('s02_slot_glow')
    N, L, math_ = _nodes(m)
    hl = 0.5 * (P.CUP['slot_len'] + 0.001)
    hw = 0.5 * (P.CUP['slot_w'] + 0.001)
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Object'], sep.inputs['Vector'])
    ax = math_('ABSOLUTE', sep.outputs['X'])
    qx = math_('MAXIMUM', math_('SUBTRACT', ax, vb=hl - hw), vb=0.0)
    r = math_('SQRT', math_('ADD', math_('MULTIPLY', qx, qx), math_('MULTIPLY', sep.outputs['Y'], sep.outputs['Y'])))
    k = math_('SUBTRACT', None, math_('DIVIDE', r, vb=hw), va=1.0, clamp=True)          # 1 centre line, 0 lip
    lx = math_('SUBTRACT', None, math_('MULTIPLY', math_('POWER', math_('DIVIDE', ax, vb=hl), vb=2.0), vb=0.45),
               va=1.0, clamp=True)                                                    # hottest mid-slot
    core = math_('MULTIPLY', math_('POWER', k, vb=1.3), lx)
    led = N.new('ShaderNodeAttribute')
    led.attribute_type = 'OBJECT'
    led.attribute_name = 'led'
    lvl = math_('MULTIPLY', math_('ADD', math_('MULTIPLY', core, vb=0.88), vb=0.12), led.outputs['Fac'])
    lvl = math_('MULTIPLY', lvl, vb=GLOW_EMIT)
    mix = N.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    L.new(k, mix.inputs['Factor'])
    mix.inputs['A'].default_value = (0.62, 0.075, 0.006, 1.0)        # #CC4A12-ish at the lip (linear)
    mix.inputs['B'].default_value = (1.0, 0.254, 0.023, 1.0)         # #FF8A2A at the centre (linear)
    em = N.new('ShaderNodeEmission')
    L.new(mix.outputs['Result'], em.inputs['Color'])
    L.new(lvl, em.inputs['Strength'])
    df = N.new('ShaderNodeBsdfDiffuse')
    df.inputs['Color'].default_value = (0.0024, 0.0015, 0.0009, 1.0)     # #080503: dark as the well when off
    df.inputs['Roughness'].default_value = 1.0
    add = N.new('ShaderNodeAddShader')
    L.new(df.outputs[0], add.inputs[0])
    L.new(em.outputs[0], add.inputs[1])
    out = N.new('ShaderNodeOutputMaterial')
    L.new(add.outputs[0], out.inputs['Surface'])
    try:
        m.cycles.emission_sampling = 'NONE'
    except (AttributeError, TypeError):
        pass
    return m


def slot_wall_material():
    """The slot's drafted inner wall seen from above: the lid's polystyrene in the slot's own shadow,
    so the dark opening reads as wide as S01's silhouette (the match cut) and the wall still picks
    up the amber pulse."""
    m = bpy.data.materials.get('s02_slot_wall')
    if m:
        return m
    m = bpy.data.materials.new('s02_slot_wall')
    N, L, _ = _nodes(m)
    b = N.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (0.034, 0.031, 0.027, 1.0)
    b.inputs['Roughness'].default_value = 0.5
    b.inputs['Specular IOR Level'].default_value = 0.25
    out = N.new('ShaderNodeOutputMaterial')
    L.new(b.outputs[0], out.inputs['Surface'])
    return m


def dress_slot(rig):
    """The shot's own finish on the rig's hero slot (rig and library untouched): the glow gets
    slot_glow_material, and the lip overlay's drafted inner wall (the 5 face bands from the slot
    edge down; synergy.Rig._slot_lip builds 9 bands of equal size, top first) gets
    slot_wall_material."""
    glow = rig.parts.get('cup_glow')
    if glow is not None:
        glow.data.materials.clear()
        glow.data.materials.append(slot_glow_material())
    lip = rig.parts.get('cup_lip')
    if lip is not None:
        me = lip.data
        n = len(me.polygons)
        if n % 9 == 0:
            me.materials.append(slot_wall_material())
            idx = len(me.materials) - 1
            k = n // 9
            for p in me.polygons:
                if p.index // k >= 4:
                    p.material_index = idx
        else:
            print(f'S02 WARNING: cup lip has {n} faces, not 9 bands; inner wall left as built', flush=True)


# ================================================================== camera

class Move:
    """The motion-control move, built from channels a camera operator would think in:
      - T, the frame centre: from the slot to the lid and cup, to between the cup and the badge,
        up the chest, to the end's aim point (a C1 walk through MOVE_T, keyed on frames);
      - H, the frame's height at the frame centre: log-space growth from the macro's 4 cm to the
        portrait's 0.94 m, eased so the picture's scale changes at a steady rate (MOVE_H);
      - the lens's elevation over the frame centre: straight down at the start, down to about cup
        height by f194 (an orbit round the cup: the cup stays near frame centre while the lid
        tilts away), then rising to the end's 5 deg (MOVE_EL); the heading turns from the
        macro's (the slot's long axis horizontal) to the end's (MOVE_YAW);
      - the lens, 100 -> 65 mm.
    The camera sits at distance H * lens / 20.25 mm from T along that elevation and heading, and
    looks at T; from MOVE_LEVEL the tilt hands over to the lens shift so it ends level. Because the
    distance follows the frame height, the lens stays low (at or under his collar) while it is
    close, and cranes up only as it pulls back. Focus walks with the frame centre and lands on the
    face glass; the aperture opens from f/16 to f/2.8."""

    def __init__(self, post, rig):
        sp = V(R.SYNERGY_POS)
        self.post = post
        self.c = post.c.copy()
        self.o = post.o.copy()
        self.P0 = self.c + Z * D0
        a = math.radians(END_ANG)
        h1 = V((math.sin(a), math.cos(a), 0.0))
        r1 = h1.cross(Z).normalized()
        self.face = rig.screen_point(0.5, 0.5, START)
        self.P1 = V((sp.x, sp.y, 0.0)) - h1 * END_DIST
        self.P1.z = END_H
        self.T1 = V((self.face.x, self.face.y, END_AIM_Z)) + r1 * END_AIM_X
        cup_base = rig.cup.matrix_world.translation.copy()
        self.cup_c = cup_base + Z * 0.065
        badge = getattr(rig, 'badge', None)
        if isinstance(badge, bpy.types.Object):
            bb = [badge.matrix_world @ V(c_) for c_ in badge.bound_box]
            self.badge = sum(bb, V()) / len(bb)
        else:
            self.badge = sp + V((0.0, -0.185, 1.048))
        pts = dict(slot=self.c, cup_top=V((cup_base.x, cup_base.y, cup_base.z + 0.097)),
                   cup_badge=sp + V((-0.07, -0.23, 1.16)), chest=sp + V((0.04, -0.17, 1.31)), aim=self.T1)
        self.TK = [(f, pts[n]) for n, f in MOVE_T]
        # focus walks the nearest featured surface: the lid, the cup's front and the hand on it, the
        # cup-badge plane, the badge and chest plates, then the face glass as it lands
        cup_front = self.cup_c + V((0.0, -0.045, 0.0))
        self.FK = [(MOVE0, self.c), (172, V((cup_base.x, cup_base.y, cup_base.z + 0.130))), (183, cup_front),
                   (193, cup_front.lerp(self.badge, 0.5)), (203, self.badge + V((0.0, 0.0, 0.15))),
                   (FOCUS_FACE[1], self.face)]
        d1 = self.P1 - self.T1
        self.H0 = D0 * 20.25 / LENS0
        self.H1 = d1.length * 20.25 / LENS1
        self.el_end = math.degrees(math.asin(d1.z / d1.length))
        hd1 = -V((d1.x, d1.y, 0.0)).normalized()
        self.yaw0 = math.atan2(self.o.y, self.o.x)
        y1 = math.atan2(hd1.y, hd1.x)
        self.yaw1 = self.yaw0 + (y1 - self.yaw0 + math.pi) % (2 * math.pi) - math.pi

    def elevation(self, f):
        (f0, e0), (f1, e1), (f2, _) = MOVE_EL
        if f <= f1:
            return e0 + (e1 - e0) * beta_ease((f - f0) / (f1 - f0), 1.4, 1.25)
        return e1 + (self.el_end - e1) * smoother((f - f1) / (f2 - f1))

    def raw(self, f):
        """(camera position, frame centre, lens, heading) before the level hand-over."""
        T = hermite_keys(f, self.TK)
        u = beta_ease((f - MOVE0) / (MOVE_H[2] - MOVE0), MOVE_H[0], MOVE_H[1])
        H = math.exp(math.log(self.H0) + (math.log(self.H1) - math.log(self.H0)) * u)
        lens = LENS0 + (LENS1 - LENS0) * beta_ease((f - MOVE_LENS[0]) / (MOVE_LENS[1] - MOVE_LENS[0]), 1.4, 1.4)
        el = math.radians(self.elevation(f))
        yaw = self.yaw0 + (self.yaw1 - self.yaw0) * smoother((f - MOVE0) / (MOVE_YAW - MOVE0))
        hd = V((math.cos(yaw), math.sin(yaw), 0.0))
        dist = H * lens / 20.25
        Pc = T + (-hd * math.cos(el) + Z * math.sin(el)) * dist
        return Pc, T, lens, hd

    def state(self, f):
        """(location, rotation quaternion, lens, shift_y, focus distance, fstop, exposure)."""
        P_, T, lens, hdg = self.raw(f)
        d = T - P_
        hd = V((d.x, d.y, 0.0))
        psi = math.atan2(hdg.y, hdg.x) if hd.length < 1e-4 else math.atan2(hd.y, hd.x)
        theta = math.atan2(d.z, max(hd.length, 1e-9))
        k = smooth((f - MOVE_LEVEL[0]) / (MOVE_LEVEL[1] - MOVE_LEVEL[0]))
        pitch = theta * (1.0 - k)
        shift = math.tan(theta - pitch) * lens / 36.0
        h = V((math.cos(psi), math.sin(psi), 0.0))
        fwd = h * math.cos(pitch) + Z * math.sin(pitch)
        right = h.cross(Z).normalized()
        upv = (-fwd).cross(right).normalized()
        Rm = Matrix((right, upv, -fwd)).transposed()
        if f <= MOVE0:
            # the post: on the envelope's seal and fold plane, racking down to the slot rim as it goes
            up = FOCUS_UP * (1.0 - smooth((f - RACK[0]) / (RACK[1] - RACK[0])))
            focus = D0 - up
            fstop = FSTOP_POST
        else:
            fp = hermite_keys(f, self.FK)
            focus = max(0.05, (fp - P_).dot(fwd))
            ks = smoother((f - STOP_OPEN[0]) / (STOP_OPEN[1] - STOP_OPEN[0]))
            fstop = math.exp(math.log(FSTOP_POST) + (math.log(FSTOP1) - math.log(FSTOP_POST)) * ks)
        expo = EXPOSURE0 * (1.0 - smoother((f - (MOVE0 + 2)) / (186 - MOVE0 - 2)))
        return P_, Rm.to_quaternion(), lens, shift, focus, fstop, expo

    @staticmethod
    def project(st, p, res_x=1600.0, res_y=900.0):
        """Pixel position (x right, y down) of world point p for a state, or None behind the lens."""
        loc, q, lens, shift = st[:4]
        R3 = q.to_matrix()
        rel = V(p) - loc
        depth = -rel.dot(R3.col[2])
        if depth < 0.01:
            return None
        fpx = lens / 36.0 * res_x
        return (res_x / 2 + rel.dot(R3.col[0]) / depth * fpx,
                res_y / 2 - (rel.dot(R3.col[1]) / depth * fpx - shift * res_x))

    def moving_frames(self, rig):
        """Frames whose picture moves more than SEED_PX (px/frame at 1600 wide) at any of a few
        points on the subject that are in or near frame: those get an animated sampling seed."""
        pts = [self.c, self.cup_c, self.badge, self.face, rig.screen_point(0.5, 0.9, START)]
        out = set()
        prev = None
        for f in range(MOVE0 - 1, MOVE1 + 2):
            st = self.state(f)
            xy = [self.project(st, p) for p in pts]
            if prev is not None:
                d = 0.0
                for a, b in zip(prev, xy):
                    if a and b and -320 < b[0] < 1920 and -180 < b[1] < 1080:
                        d = max(d, math.hypot(b[0] - a[0], b[1] - a[1]))
                if d > SEED_PX:
                    out.update((f - 1, f))
            prev = xy
        return out


def build_camera(move):
    sc = bpy.context.scene
    cam = C.camera('cam_s02', LENS0, tuple(move.P0), None, fstop=FSTOP_POST, focus=D0, clip=(0.005, 200.0))
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


def top_light(rig, coll):
    """The treatment's cool 6500K top light from the skylight slab on the portrait: a soft card over
    his crown and shoulder tops, a little cooler than the slab, so a cool crown sits about half a
    stop against the warm walnut bounce on his belly and cup hand. It leaves the cup alone (the
    macro's lid keeps its own 'lid' kit) and is never seen by the camera."""
    sp = V(R.SYNERGY_POS)
    lt = C.area_light('s02_top', (sp.x + 0.08, sp.y - 0.30, 2.50), (sp.x, sp.y - 0.10, 1.50), TOP_CARD, 0.70, 0.45,
                      color=(0.80, 0.88, 1.0), coll=coll)
    lt.visible_camera = False
    R._unlink_light(lt, [o for o in rig.cup_objects() if o.type == 'MESH'], 'S02_top_excluded')
    return lt


def envelope_light(rig, post, parts, coll):
    """A low warm card raking across the envelope's face from the side away from the hand,
    light-linked to the envelope and the pinching thumb and index alone: the paper reads white
    against the lid with its tooth, the flap's lifted edges and the seal's bevel, and the thumb's
    underside reads ivory instead of a dark bite in the lid's rim; the lid keeps the room's light
    and its 'lid' kit."""
    side = 1.0 if post.x.x > 0 else -1.0
    ctr = post.c + post.e * (ENV_H * 0.45)
    loc = ctr - post.x * (side * 0.16) + post.n * 0.035 + Z * 0.02
    lt = C.area_light('s02_env_rake', tuple(loc), tuple(ctr), ENV_RAKE, 0.10, 0.03, color=(1.0, 0.94, 0.86),
                      coll=coll)
    lt.visible_camera = False
    digits = [f'thumb_{i}_L' for i in range(3)] + [f'index_{i}_L' for i in (1, 2, 3)]
    fingers = [o for o in rig.parts_on_bones(digits) if o.type == 'MESH']
    R._link_light(lt, list(parts) + fingers, 'S02_envelope_receivers')
    return lt


def slot_glow_light(post, coll):
    """The amber pulse as light: a soft lamp just above the slot, keyed with the glow, so the raised
    spout lip, the lid round the slot and the lifting fingertips catch warm light that rises and
    falls with the pulse."""
    lt = C.point_light('s02_slot_glow', tuple(post.c + post.ax * GLOW_LAMP_H), energy=0.0, radius=0.004,
                       color=(1.0, 0.42, 0.10), coll=coll)
    lt.visible_camera = False
    for f, e in ((GLOW - 1, 0.0), (GLOW + 1, GLOW_LAMP), (GLOW + 5, 0.6 * GLOW_LAMP), (GLOW + 7, 0.0)):
        lt.data.energy = e
        lt.data.keyframe_insert('energy', frame=f)
    return lt


# ================================================================== the colleagues as bokeh

# (terminal, x, y from the top, width in px at 1600, brightness gain): cobalt, acid yellow, pink and
# sky, placed in the portrait's voids: cobalt high left beside the wedge, sky beside the head on the
# right, pink right and lower, acid yellow low left past his elbow; none within 5% of an edge
BOKEH = (('keys', 0.13, 0.27, 92.0, 2.6), ('kevin', 0.69, 0.21, 74.0, 1.0),
         ('people', 0.865, 0.55, 68.0, 1.0), ('strategy', 0.085, 0.70, 70.0, 0.85))


def place_bokeh(room, cam, frame):
    """room.front_bokeh's discs (one per colleague, driven by their screens), moved to BOKEH's
    places at the same distance behind him and resized so each reads its width (geometry plus
    this lens's defocus); the rest (Pat, dark) hidden."""
    discs = room.front_bokeh(cam, frame, n=4, disc_px=(60.0, 90.0), seed=5)
    sc = bpy.context.scene
    sc.frame_set(frame)
    bpy.context.view_layer.update()
    mw = cam.matrix_world.copy()
    loc, rot = mw.translation, mw.to_3x3()
    cd = cam.data
    res_x = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
    res_y = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
    sw = cd.sensor_width
    sh = sw * res_y / res_x
    lens = cd.lens
    f_px = lens / sw * res_x
    fs, Fd = cd.dof.aperture_fstop, cd.dof.focus_distance
    spec = {b[0]: b[1:] for b in BOKEH}
    for o in discs:
        nm = o.get('bokeh_terminal')
        if nm not in spec:
            o.hide_render = True
            continue
        x, y_top, px, gain = spec[nm]
        y = 1.0 - y_top
        D = (o.location - loc).length
        dirc = V(((x - 0.5 + cd.shift_x) * sw / lens, (y - 0.5) * sh / lens + cd.shift_y * sw / lens, -1.0))
        dw = (rot @ dirc).normalized()
        o.location = loc + dw * D
        o.rotation_euler = (-dw).to_track_quat('Z', 'Y').to_euler()
        fl = lens / 1000.0
        blur = (fl * fl / (fs * max(Fd - fl, 1e-3))) * abs(D - Fd) / D / (sw / 1000.0) * res_x
        target = px * res_x / 1600.0
        g_px = max(target - 0.8 * blur, 0.35 * target)
        cur = 2.0 * max(abs(v.co.x) for v in o.data.vertices)
        s = g_px / f_px * D / cur
        o.scale = (s, s, s)
        if gain != 1.0 and o.animation_data:
            for fc in o.animation_data.drivers:
                if fc.data_path == '["bokeh_k"]':
                    fc.driver.expression = f'({fc.driver.expression})*{gain:.3f}'
    return discs


# ================================================================== build

def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(placeholder=False, state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room.render_budget(kind='macro', samples=args.samples or None)
    sc.cycles.transparent_max_bounces = max(sc.cycles.transparent_max_bounces, 12)   # stacked steam wisps

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
    rig.breathe(END - 3 * 72, END)              # whole 36-frame halves, at rest on the cut either side
    dress_slot(rig)
    rig.cup_handle.slot_glow(GLOW, dur=7, peak=1.0)

    # ---- set dressing: light (steam after the camera: its wisps face the lens)
    sc.frame_set(START)
    room.insert_lights('lid', target=rig.cup_handle)
    room.use_kits('lid')
    bounce_light(coll)
    rim_light(coll)
    top_light(rig, coll)
    slot_glow_light(post, coll)
    envelope_light(rig, post, env_parts, coll)

    # ---- camera
    move = Move(post, rig)
    cam = build_camera(move)
    sc.camera = cam
    build_steam(post, move, coll)
    for f in range(185, END + 1):
        rig.glass_glint(cam, f, strength=GLINT)
    sc.frame_set(END)
    place_bokeh(room, cam, END)
    room.tune_scanlines(cam)
    room.compositor(threshold=1.6)

    # the film's 180-degree shutter for the whole shot (one motion texture through the move)
    sc.render.motion_blur_shutter = SHUTTER

    # sampling seed: fixed wherever the picture is still (the macro, the settle, the hold), animated
    # only where it moves more than SEED_PX a frame
    cy = sc.cycles
    cy.use_animated_seed = False
    moving = move.moving_frames(rig)
    for f in range(START - 2, END + 3):
        cy.seed = f if f in moving else 0
        cy.keyframe_insert('seed', frame=f)
    if sc.animation_data and sc.animation_data.action:
        for fc in C.fcurves(sc.animation_data.action):
            if fc.data_path == 'cycles.seed':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'
    print(f'S02 SEED animated f{min(moving) if moving else "-"}-{max(moving) if moving else "-"} '
          f'({len(moving)} frames)', flush=True)
    sc.frame_set(START)
    return dict(room=room, rig=rig, post=post, cam=cam, move=move, envelope=env_root)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
