"""Synergy: the deadpan robot host of the LinkedIn Beats office.

Procedural model + FK rig, built from nothing in Blender 4.5 (Cycles).

    import synergy as S
    rig = S.build(timeline=face.FaceTimeline(1, 96))
    rig.apply_preset(1, 'idle_cup')
    rig.pose(24, head=(0, 4, 0), interp='BEZIER')

Conventions (visual canon): metres, Z up, the character faces -Y, the
character's LEFT is +X. The armature origin sits on the floor between the
feet; the head apex is at 1.75 m. Every rigid part is its own mesh,
bone-parented (no skin weights). Head and torso plates are separate objects
with their origin at their own centroid (rig.head_plates / rig.torso_plates);
a warped plate is ONE folded object (one sharp crease: no bevel, seam or rivets on the
fold). Every plate carries the point attribute 'edge_w' (distance to its rim) that the
enamel and steel shaders use for chips, seam grime and freckles; all wear is fixed to the
part (object-local AO), so it never changes when another object comes near. Builds are
deterministic: the same vertices, faces and loop order in every process.

Pose controls (degrees). Tuples are (x, y, z), applied x then y then z, each
about an axis fixed in the parent's rest frame:
  centre chain  pelvis, spine, chest, neck, head
      x > 0 pitches forward/down, y > 0 rolls so the character's LEFT side
      (earcup side) goes up, z > 0 turns toward the character's left.
      Canonical head roll: head=CANON_HEAD=(0, 4, 0) (treatment).
  limbs  shoulder_*, upperarm_*, thigh_*  (and forearm_*/shin_*/foot_* as tuples)
      x > 0 swings the limb forward, y > 0 swings it outward (away from the
      body), z > 0 twists its front outward. L and R are mirrored, so equal
      values give a symmetric pose. shoulder_*: x forward (protraction), y shrug up.
  forearm_*  number = elbow flex (> 0 bends the forearm forward/up)
  shin_*     number = knee flex (> 0 bends the shin back)
  foot_*     number = ankle (> 0 lifts the toes)
  hand_*     (flex toward the palm, twist palm toward the pinky side,
              deviation toward the pinky side)
  fingers_*  curl 0..1 (all four), 'grip' (wrap the cup), a HAND_SHAPES name
             ('point', 'pinch', 'relaxed'), or a dict per finger whose values are a
             curl or an (MCP, PIP, DIP) tuple: fingers_L=dict(index=0, middle=0.8, ring=1, pinky=1)
  <finger>_<n>_*  one joint, number = curl toward the palm (index_1_L=30, ...)
  thumb_*    curl 0..1, or 'grip', 'up' (thumbs-up), 'pinch' (pad opposite the index pad,
             2 mm apart) or ('pinch', gap); thumb_<n>_* = one joint curl in degrees
  root_loc   (x, y, z) world position of the point between the feet
  root_rot   world heading in degrees (0 = facing -Y)
  root_z     drop/raise the whole body (metres, keyed on the root's Z only)
  badge      (x, y, z) swing of the badge on its clip (centre convention)
  pauldron_* (x, y, z) extra pauldron lift. The pauldrons are caps on the shoulder joints
             (children of the shoulder bones, enclosing the hub, apex level with the yoke):
             they take the shoulder's protraction and shrug, follow half of the arm's sideways
             lift (at most PAULDRON_FOLLOW = 8 deg, about the inner seat) and PAULDRON_FLEX of
             its forward swing about the hub axis (at most PAULDRON_FLEX_MAX); place_arm keys that (and a
             ride-up for an arm raised past 80 deg, S11) so they never dip into the chest.
Poses are keyed as bone quaternions (sign-continuous). Key poses first, then
call attach_cup / detach_headset / attach_headset / post (they read the posed rig).

Presets (rig.apply_preset(frame, name)) set arms and hands plus the canon 4 deg
head roll; any other head or chest acting is keyed by the shot:
  idle_cup       canon: cup centre 1.22 m in the right hand, 30 cm in front of the
                 chest, elbow low; sip slot toward the sternum (SLOT_BETA); left arm relaxed
  idle_cup_high  the approved plate: cup raised beside the head (hero framing)
  thumbs_up      idle cup + left fist 38 cm in front of the chest, thumb up toward camera
  sip            S13 contact: the cup tipped SIP_TILT = 16 deg toward the face, the spout edge on
                 the chin plate just under the screen and the far side of the lid raised, head
                 eased back 5 deg (not a dip), the elbow ~15 cm out in front of the chest at
                 about shoulder height, the forearm one clean diagonal up to the chin (rig.sip(1249) keys the whole four-beat lift on a clear path every
                 frame; rig.sip_stage(frame, k): 0 chest, 1 sternum, 2 collar, 2.5 chin level, 3 contact)
  reach_L        S04/S09: left index tip resting on the walnut at env_room's fingertip_L
                 contract (palm down, index straight, 1 mm above the table top);
                 rig.reach_L(frame, tip_world) for any other point
  hands_clasped  executive steeple: wrists at (+-0.17, -0.30, 1.10), fingertips just
                 touching. Needs both hands free: park the cup first with
                 attach_cup(frame, None) (or hide rig.cup_objects()).
  post_L         idle cup + the left hand pinching 16 mm above the sip slot (2 mm between
                 the pads: an envelope; post(..., gap=PADLOCK_GAP=0.030, extent=PADLOCK_EXTENT)
                 holds the 30 mm padlock with its lowest point 2 mm above the slot)
  seated         thighs/knees 88 deg, body dropped to a 0.40 m seat, cup held,
                 left hand resting on the thigh
  neutral        everything at rest
Arm poses are solved with a clearance search (elbow pole, small shoulder offsets)
against the chest, the arm's own pauldron (and its seat), the head, the held cup and,
when posting, the cup being posted into; idle_cup, idle_cup_high, thumbs_up, sip (and the
whole rig.sip lift), reach_L, hands_clasped and post_L are free of BVH interpenetration
apart from deliberate joint seats (hubs in sockets, piston stages, cable ends):
tools/synergy_in_room.py prints the report.

S10 / S11 helpers: rig.lean(frame, deg, keep_cup=True) (spine + chest, at most 8 deg; the right
arm re-solved so the cup keeps its world place) for the jack reach with a world-space target;
rig.breathe(start, end) (S02: the chest plates rise 2 mm on a 3 s cycle, nothing else moves);
rig.bake_pauldrons(start, end) re-keys the shoulder caps every frame after sparse arm keys; rig.grip_headband(frame) grips the band just above the left
earcup (palm on the band, fingers past its front edge), then attach_headset(frame, 'hand_L').

Posting (S02, S05, S07): rig.post(frame) keys the LEFT hand every frame along one straight
line into the slot: approach (from frame - 8), contact (pinch 16 mm above the slot,
fingertips ~5-10 mm) and lift (to frame + 6), without moving the head or the cup;
rig.post_pose(frame, height) keys one pose. gap= sets the air between thumb and index pads
(0.002 envelope, 0.030 padlock = PADLOCK_GAP); extent= is how far the held object reaches below
the pinch point along the slot axis (padlock: PADLOCK_EXTENT), so the pinch rises to extent + 2 mm
and nothing of the hand or the object enters the lid before the shot's shrink starts at contact. place_arm / place_arm_clear take space='world' targets
(they then honour a keyed root, spine or chest lean: rig.lean(frame, deg)).
rig.cup_handle is the props.Cup (rig.slot = the slot empty, Z out of the slot;
rig.cup_handle.slot_glow(frame) keys the amber pulse).

Props: the cup (props.cup_and_lid(hero=True); rig.cup is its root empty) and the
headset group are unparented objects driven by Child Of constraints with keyed
influence (cup: 'hold_R' / 'hold_L'; headset: 'on_head' / 'in_hand_L'). While
detached, key their location/rotation_quaternion in world space. The headset cord
unplugs on detach: over 8 frames the plug leaves the collar and the cord wraps the
left earcup, so it leaves with the headset. rig.glass_glint(camera, frame) adds the
thin reflected skylight slot to the face glass for a shot camera.
Grip: fingers_*='grip' / thumb_*='grip' are solved once per hand by curling each
segment until it touches the cup (no interpenetration with the cup or the hand).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

try:
    import common as C
    import face as F
    import materials as M
    import props as PR
except ImportError:  # imported as a package
    from . import common as C, face as F, materials as M, props as PR

V = Vector
UP = V((0, 0, 1))
FWD = V((0, -1, 0))
BACK = V((0, 1, 0))
LEFT = V((1, 0, 0))

# ---------------------------------------------------------------- canon geometry

HEAD_SCALE = 0.95
HEAD_ORIGIN = V((0.0, 0.0, 1.422))
HEAD_PTS = {
    'apex': (0.065, 0.010, 0.345), 'Rtip': (-0.265, 0.030, 0.190), 'L1': (0.210, 0.050, 0.225),
    'L2': (0.170, 0.020, 0.030), 'chin': (-0.015, -0.090, 0.000), 'LR': (-0.140, -0.040, 0.055),
    'BrowR': (-0.109, -0.150, 0.212), 'BrowL': (0.109, -0.150, 0.212), 'JawL': (0.109, -0.158, 0.050),
    'JawR': (-0.109, -0.158, 0.050), 'BK1': (0.020, 0.210, 0.270), 'BK2': (-0.120, 0.200, 0.140),
    'BK3': (0.120, 0.190, 0.090), 'BK4': (-0.020, 0.150, 0.020),
}


def H(p):
    """Head-local canon coordinates (scale 1.0) -> rest world."""
    return HEAD_ORIGIN + V(p) * HEAD_SCALE


def HP(name):
    return H(HEAD_PTS[name])


SHOULDER = 0.31
SHOULDER_Z = 1.265
ARM_SPLAY = math.radians(9.0)
UPPER_LEN = 0.275
FORE_LEN = 0.245
HIP_X = 0.115
HIP_Z = 0.84
KNEE_Z = 0.47
ANKLE_Z = 0.085
THIGH_LEN = HIP_Z - KNEE_Z
SHIN_LEN = KNEE_Z - ANKLE_Z

FINGERS = {  # name: (segment lengths, knuckle offset along v, knuckle u, splay deg)
    'index': ((0.040, 0.030, 0.026), -0.03075, 0.097, -1.5),
    'middle': ((0.044, 0.032, 0.027), -0.01025, 0.099, 0.0),
    'ring': ((0.041, 0.030, 0.026), 0.01025, 0.097, 1.2),
    'pinky': ((0.034, 0.025, 0.022), 0.03075, 0.092, 3.0),
}
FINGER_R = 0.0085          # proximal segment half-width (canon 0.017-0.015 dia; 3.5 mm gaps at 20.5 mm pitch)
FIST = (80.0, 90.0, 58.0)  # MCP / PIP / DIP at curl 1.0
# named hand shapes: per-finger (MCP, PIP, DIP) degrees; thumb handled separately
HAND_SHAPES = {
    'point': dict(index=(2.0, 4.0, 2.0), middle=FIST, ring=FIST, pinky=FIST),
    'pinch': dict(index=(30.0, 70.0, 50.0), middle=(78.0, 95.0, 60.0), ring=(82.0, 95.0, 60.0),
                  pinky=(84.0, 95.0, 58.0)),
    'relaxed': dict(index=tuple(a * 0.35 for a in FIST), middle=tuple(a * 0.42 for a in FIST),
                    ring=tuple(a * 0.50 for a in FIST), pinky=tuple(a * 0.55 for a in FIST)),
}
CANON_HEAD = (0.0, 4.0, 0.0)   # head roll 4 deg, earcup side up (treatment)
BADGE_TILT = 2.5               # sleeve + card face tip down this much (soft strap reflection)
PAULDRON_FOLLOW = 8.0          # max sideways follow of the pauldron (degrees)
PAULDRON_SHOULDER = 1.0        # the pauldron is a cap on the shoulder joint: it takes all of its
                               # protraction / shrug (kept for compatibility; the bone is the shoulder's child)
PAULDRON_FLEX = 0.6            # share of the upper arm's forward swing the cap follows (about the hub axis)
PAULDRON_FLEX_FROM = 12.0      # forward swing (deg) before the cap starts to follow
PAULDRON_FLEX_MAX = 30.0       # most the cap turns with a forward swing (it stays clear of the chest side)
PAULDRON_RIDE_FROM = 80.0      # arm lift (deg) beyond which the pauldron starts to ride up
PAULDRON_PROTRACT_TIP = 10.0   # most the cap tips its inner edge up for a strongly protracted shoulder
PINCH_GAP = 0.002              # default air between thumb and index pads (an envelope)
HEADBAND_SIDE = 0.032          # headband centreline off the head where it rises from the left earcup (room
                               # for the S11 grip's thumb); over the crown it rests on the head
PADLOCK_GAP = 0.030            # the hero padlock (props.PADLOCK D = 30 mm) between the pads
PADLOCK_FINGERS = dict(index=(30.0, 70.0, 50.0), middle=(30.0, 60.0, 40.0), ring=(80.0, 90.0, 58.0),
                       pinky=(80.0, 90.0, 58.0))   # thumb / index + middle on the padlock's faces
PADLOCK_EXTENT = 0.058         # how far the padlock (held as tools/synergy_in_room.hold_padlock, fingers
                               # PADLOCK_FINGERS) reaches below the pinch point along the slot axis when
                               # posted: the pinch then rides 6 cm above the slot, the hand clear of the lid
REACH_DEBUG = False
REACH_THUMB = 0.30             # thumb tucked beside the fist while the index rests on the walnut
SIP_GAP = 0.0025               # spout top to chin plate at the S13 contact (reads as touching)
SIP_DEBUG = False
PAD_R_INDEX, PAD_R_THUMB = 0.0070, 0.0072   # pad radii 6 / 4 mm behind the index / thumb tips

# cup + lid: props.cup_and_lid(hero=True) (h 0.111, r 0.030 -> 0.0442, lid r 0.0472, lid top ~0.129)
CUP_H = PR.CUP['h']
CUP_R0, CUP_R1 = PR.CUP['r_bot'], PR.CUP['r_top']
LID_R = PR.CUP['lid_r']
LID_SKIRT_Z = 0.1075            # lid skirt bottom
LID_TOP = 0.1295                # top of the lid rim
SLOT_BETA = math.radians(35.0)  # slot direction: from the thumb side toward the side opposite the palm.
                                # 35 deg: at the chest the slot faces the sternum (and the posting left
                                # hand); raised to the chin in the same grip it faces the chin plate


def cup_radius(h):
    """Outer radius of the cup (and lid skirt) at height h above the base."""
    if h >= LID_SKIRT_Z:
        return LID_R + 0.0005
    h = min(max(h, 0.0), CUP_H)
    return CUP_R0 + (CUP_R1 - CUP_R0) * h / CUP_H


# grip: cup placement in the hand frame (u along fingers, v toward pinky, w palm normal)
GRIP_U, GRIP_W = 0.086, 0.0575
GRIP_TILT = math.radians(16.0)   # fingers spiral slightly down the cup
GRIP_H_MID = 0.054               # cup height at the hand's centre line (index ~8.5 cm up the cup)


def grip_frame(W, u, v, w):
    """Cup axis and base centre for a hand frame (rest or posed)."""
    c = (-v * math.cos(GRIP_TILT) - u * math.sin(GRIP_TILT)).normalized()
    mid = W + u * GRIP_U + w * GRIP_W
    return c, mid - c * GRIP_H_MID


# canonical cup hold (right hand): cup centre 1.22 m, 30 cm in front, elbow tucked low;
# the sip slot faces the sternum (and the posting left hand)
IDLE_CUP = dict(cup_base=V((-0.19, -0.30, 1.163)), finger_dir=V((0.06, -1.0, 0.0)), pole=V((-0.25, 0.1, -1.0)))

# the approved plate (video_synergy-v2-source t=3s): cup raised beside the head, forearm near vertical
IDLE_CUP_HIGH = dict(cup_base=V((-0.37, -0.25, 1.255)), finger_dir=V((0.35, -1.0, 0.0)), pole=V((-0.15, 0.25, -1.0)))

# ---------------------------------------------------------------- small maths

def rot_to(a, b, deg):
    """Rotation (Matrix 3x3) that turns direction a toward b by deg degrees."""
    ax = V(a).cross(V(b))
    if ax.length < 1e-9:
        return Matrix.Identity(3)
    return Matrix.Rotation(math.radians(deg), 3, ax.normalized())


def frame3(x, y):
    """Orthonormal matrix with columns (x, y', x*y') built from two directions."""
    x = V(x).normalized()
    y = (V(y) - x * x.dot(V(y))).normalized()
    z = x.cross(y)
    return Matrix((x, y, z)).transposed()


def newell(poly):
    n = V((0, 0, 0))
    k = len(poly)
    for i in range(k):
        a, b = poly[i], poly[(i + 1) % k]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n.normalized()


def inset_poly(poly, n, d):
    k = len(poly)
    out = []
    for i in range(k):
        p0, p1, p2 = poly[i - 1], poly[i], poly[(i + 1) % k]
        e0 = (p1 - p0).normalized()
        e1 = (p2 - p1).normalized()
        in0 = n.cross(e0).normalized()
        in1 = n.cross(e1).normalized()
        b = in0 + in1
        b = in1 if b.length < 1e-6 else b.normalized()
        out.append(p1 + b * (d / max(0.25, b.dot(in1))))
    return out


def lerp(a, b, t):
    return V(a).lerp(V(b), t)


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- hull SDF

class Hull:
    """Convex hull as a set of planes: signed distance and push-out."""

    def __init__(self, pts):
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        bm.normal_update()
        c = sum((v.co for v in bm.verts), V()) / len(bm.verts)
        self.planes = []
        for f in bm.faces:
            n = f.normal.copy()
            p = f.calc_center_median()
            if n.dot(p - c) < 0:
                n = -n
            self.planes.append((n, n.dot(p)))
        bm.free()

    def sdf(self, p):
        return max(n.dot(p) - d for n, d in self.planes)

    def push(self, p, margin):
        p = V(p)
        for _ in range(12):
            best = max(self.planes, key=lambda nd: nd[0].dot(p) - nd[1])
            s = best[0].dot(p) - best[1]
            if s >= margin - 1e-6:
                break
            p = p + best[0] * (margin - s)
        return p


# ---------------------------------------------------------------- mesh builder

def _dome(seg=10):
    vs = [(math.cos(2 * math.pi * i / seg), math.sin(2 * math.pi * i / seg), -0.45) for i in range(seg)]
    rings = [(1.0, 0.0), (0.93, 0.45), (0.72, 0.78), (0.38, 0.97)]
    for r, z in rings:
        vs += [(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z) for i in range(seg)]
    vs.append((0, 0, 1.0))
    fs = []
    nr = len(rings) + 1
    for k in range(nr - 1):
        for i in range(seg):
            j = (i + 1) % seg
            fs.append((k * seg + i, k * seg + j, (k + 1) * seg + j, (k + 1) * seg + i))
    top = len(vs) - 1
    last = (nr - 1) * seg
    for i in range(seg):
        fs.append((last + i, last + (i + 1) % seg, top))
    return vs, fs


DOME_V, DOME_F = _dome()


class MB:
    """bmesh accumulator with per-face material slots."""

    def __init__(self, point_attrs=()):
        self.bm = bmesh.new()
        self.mats = []
        # custom layers are created up front: adding one later invalidates live BMesh references
        self.bm.faces.layers.float.new('plate_rand')
        self.bm.loops.layers.uv.new('UVMap')
        self.bm.verts.layers.float.new('edge_w')      # plate rim distance (materials.plate_edge)
        for nm in point_attrs:
            self.bm.verts.layers.float.new(nm)

    # --- per-face plate random (read by the plate shaders) and point attributes
    def set_rand(self, faces, value):
        lay = self.bm.faces.layers.float.get('plate_rand') or self.bm.faces.layers.float.new('plate_rand')
        for f in faces:
            if f.is_valid:
                f[lay] = value

    def set_point_attr(self, name, verts, values):
        lay = self.bm.verts.layers.float.get(name) or self.bm.verts.layers.float.new(name)
        for v, x in zip(verts, values):
            v[lay] = x

    def uv(self):
        return self.bm.loops.layers.uv.get('UVMap') or self.bm.loops.layers.uv.new('UVMap')

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _tag(self, before, mat, smooth=True):
        i = self.mi(mat)
        new = [f for f in self.bm.faces if f not in before]
        for f in new:
            f.material_index = i
            f.smooth = smooth
        return new

    # --- primitives (all coordinates in rest world space)
    def cylinder(self, mat, p0, p1, r0, r1=None, seg=16, caps=True, smooth=True):
        p0, p1 = V(p0), V(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-7:
            return []
        q = UP.rotation_difference(d.normalized())
        M_ = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        before = set(self.bm.faces)
        bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r0,
                              radius2=r1 if r1 is not None else r0, depth=L, matrix=M_)
        return self._tag(before, mat, smooth)

    def box(self, mat, center, size, rot=None, smooth=False, bevel=0.0):
        M_ = Matrix.Translation(V(center))
        if rot is not None:
            M_ = M_ @ (rot.to_4x4() if len(rot) == 3 else rot)
        M_ = M_ @ Matrix.Diagonal((*size, 1.0))
        before = set(self.bm.faces)
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M_)
        self.bm.edges.index_update()
        if bevel > 0:
            edges = sorted({e for v in r['verts'] for e in v.link_edges}, key=lambda e: e.index)
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=2,
                            profile=0.5, affect='EDGES', clamp_overlap=True)
        return self._tag(before, mat, smooth)

    def sphere(self, mat, center, r, seg=16, rings=8, scale=(1, 1, 1), rot=None):
        M_ = Matrix.Translation(V(center))
        if rot is not None:
            M_ = M_ @ rot.to_4x4()
        M_ = M_ @ Matrix.Diagonal((*scale, 1.0))
        before = set(self.bm.faces)
        bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=r, matrix=M_)
        return self._tag(before, mat, True)

    def torus(self, mat, center, axis, R, r, seg=32, seg2=10, arc=(0.0, 2 * math.pi), ref=None):
        axis = V(axis).normalized()
        ref = V(ref) if ref is not None else (V((1, 0, 0)) if abs(axis.x) < 0.9 else V((0, 1, 0)))
        e1 = (ref - axis * ref.dot(axis)).normalized()
        e2 = axis.cross(e1)
        full = abs(arc[1] - arc[0] - 2 * math.pi) < 1e-6
        n = seg if full else seg + 1
        rings = []
        before = set(self.bm.faces)
        for i in range(n):
            a = arc[0] + (arc[1] - arc[0]) * i / (seg if full else seg)
            radial = e1 * math.cos(a) + e2 * math.sin(a)
            cc = V(center) + radial * R
            ring = []
            for j in range(seg2):
                b = 2 * math.pi * j / seg2
                ring.append(self.bm.verts.new(cc + (radial * math.cos(b) + axis * math.sin(b)) * r))
            rings.append(ring)
        for i in range(n if full else n - 1):
            ra, rb = rings[i], rings[(i + 1) % n]
            for j in range(seg2):
                k = (j + 1) % seg2
                self.bm.faces.new((ra[j], rb[j], rb[k], ra[k]))
        if not full:
            for ring in (rings[0], rings[-1]):
                self.bm.faces.new(ring)
        new = self._tag(before, mat, True)
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        return new

    def lathe(self, mat, profile, base, axis, seg=40, ref=None, smooth=True, close_top=True, close_bottom=True):
        """profile: [(radius, height)] from bottom to top, revolved around axis at base."""
        axis = V(axis).normalized()
        ref = V(ref) if ref is not None else (V((1, 0, 0)) if abs(axis.x) < 0.9 else V((0, 1, 0)))
        e1 = (ref - axis * ref.dot(axis)).normalized()
        e2 = axis.cross(e1)
        before = set(self.bm.faces)
        rings = []
        for r, h in profile:
            if r < 1e-7:
                rings.append([self.bm.verts.new(V(base) + axis * h)])
                continue
            ring = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                ring.append(self.bm.verts.new(V(base) + axis * h + (e1 * math.cos(a) + e2 * math.sin(a)) * r))
            rings.append(ring)
        for k in range(len(rings) - 1):
            A, B = rings[k], rings[k + 1]
            for i in range(seg):
                j = (i + 1) % seg
                if len(A) == 1:
                    self.bm.faces.new((B[i], A[0], B[j]))
                elif len(B) == 1:
                    self.bm.faces.new((A[i], A[j], B[0]))
                else:
                    self.bm.faces.new((A[i], A[j], B[j], B[i]))
        if close_bottom and profile[0][0] > 1e-6:
            self.bm.faces.new(list(reversed(rings[0])))
        if close_top and profile[-1][0] > 1e-6:
            self.bm.faces.new(rings[-1])
        new = self._tag(before, mat, smooth)
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        return new

    def hull(self, mat, pts, smooth=False):
        before = set(self.bm.faces)
        vs = [self.bm.verts.new(V(p)) for p in pts]
        bmesh.ops.convex_hull(self.bm, input=vs)
        for v in vs:
            if not v.link_faces:
                self.bm.verts.remove(v)
        new = self._tag(before, mat, smooth)
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        return new

    def prism(self, mat, poly, n, thick, bevel=0.0, smooth=False):
        """Extrude polygon (world points) by -n*thick; returns faces."""
        n = V(n).normalized()
        before = set(self.bm.faces)
        top = [self.bm.verts.new(V(p)) for p in poly]
        bot = [self.bm.verts.new(V(p) - n * thick) for p in poly]
        k = len(poly)
        self.bm.faces.new(top)
        self.bm.faces.new(list(reversed(bot)))
        for i in range(k):
            j = (i + 1) % k
            self.bm.faces.new((top[j], top[i], bot[i], bot[j]))
        new = [f for f in self.bm.faces if f not in before]
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        if bevel > 0:
            self.bm.edges.index_update()
            edges = sorted({e for f in new for e in f.edges}, key=lambda e: e.index)
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=2,
                            profile=0.5, affect='EDGES', clamp_overlap=True)
        return self._tag(before, mat, smooth)

    def rivets(self, mat, pts, n, sizes):
        n = V(n).normalized()
        R = UP.rotation_difference(n).to_matrix()
        i = self.mi(mat)
        for p, (r, h) in zip(pts, sizes):
            vs = [self.bm.verts.new(V(p) + R @ V((x * r, y * r, z * h))) for (x, y, z) in DOME_V]
            for f in DOME_F:
                face = self.bm.faces.new([vs[k] for k in f])
                face.material_index = i
                face.smooth = True

    def sweep(self, mat, pts, profile, normals=None, caps=True, closed_profile=True, uv=False, smooth=True):
        """Sweep a 2D profile [(x, y)] along a polyline. normals: per-point 'y' axis hint."""
        pts = [V(p) for p in pts]
        n = len(pts)
        tang = []
        for i in range(n):
            a = pts[max(0, i - 1)]
            b = pts[min(n - 1, i + 1)]
            tang.append((b - a).normalized())
        # frames
        frames = []
        if normals is None:
            ref = UP if abs(tang[0].dot(UP)) < 0.9 else V((1, 0, 0))
            y = (ref - tang[0] * ref.dot(tang[0])).normalized()
            for i in range(n):
                if i > 0:
                    q = tang[i - 1].rotation_difference(tang[i])
                    y = q @ y
                    y = (y - tang[i] * y.dot(tang[i])).normalized()
                frames.append((tang[i].cross(y), y))
        else:
            for i in range(n):
                y = V(normals[i])
                y = (y - tang[i] * y.dot(tang[i])).normalized()
                frames.append((tang[i].cross(y), y))
        before = set(self.bm.faces)
        rings = []
        for i in range(n):
            x, y = frames[i]
            rings.append([self.bm.verts.new(pts[i] + x * px + y * py) for px, py in profile])
        m = len(profile)
        faces_side = []
        for i in range(n - 1):
            for j in range(m if closed_profile else m - 1):
                k = (j + 1) % m
                faces_side.append(self.bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j])))
        if caps and closed_profile:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])
        new = self._tag(before, mat, smooth)
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        if uv:
            lay = self.bm.loops.layers.uv.verify()
            acc = [0.0]
            for i in range(1, n):
                acc.append(acc[-1] + (pts[i] - pts[i - 1]).length)
            index = {}
            for i, ring in enumerate(rings):
                for j, v in enumerate(ring):
                    index[v] = (acc[i], j / max(1, m - 1))
            for f in new:
                for loop in f.loops:
                    if loop.vert in index:
                        loop[lay].uv = index[loop.vert]
        return new

    def to_object(self, name, coll, origin=None, sharp=40.0):
        me = bpy.data.meshes.new(name)
        # canonical element order: bmesh ops (convex hull, dissolve, bevel) hash pointers, so
        # their output order can differ between processes; sorting keeps every build identical
        bm = self.bm
        bm.verts.index_update()
        bm.verts.ensure_lookup_table()
        order = sorted(range(len(bm.verts)), key=lambda i: tuple(round(x, 6) for x in bm.verts[i].co))
        rank = {i: r for r, i in enumerate(order)}
        bm.verts.sort(key=lambda v: rank[v.index])
        bm.verts.index_update()
        # n-gons from hull / dissolve ops start their loop at an arbitrary vertex: restart each at
        # its lowest vertex (UV-less n-gons only; their face data is copied over)
        uvl = bm.loops.layers.uv.active
        for f in list(bm.faces):
            if len(f.verts) <= 4:
                continue
            vs = [l.vert for l in f.loops]
            k0 = min(range(len(vs)), key=lambda i: vs[i].index)
            if k0 == 0 or (uvl is not None and any(l[uvl].uv.length > 1e-9 for l in f.loops)):
                continue
            mi_, sm_ = f.material_index, f.smooth
            pr_ = bm.faces.layers.float.get('plate_rand')
            rv_ = f[pr_] if pr_ is not None else None
            bm.faces.remove(f)
            nf = bm.faces.new(vs[k0:] + vs[:k0])
            nf.material_index = mi_
            nf.smooth = sm_
            if pr_ is not None:
                nf[pr_] = rv_
        bm.faces.ensure_lookup_table()
        bm.faces.index_update()
        forder = sorted(range(len(bm.faces)), key=lambda i: (bm.faces[i].material_index,) +
                        tuple(round(x, 6) for x in bm.faces[i].calc_center_median()))
        frank = {i: r for r, i in enumerate(forder)}
        bm.faces.sort(key=lambda f: frank[f.index])
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        if origin is not None:
            me.transform(Matrix.Translation(-V(origin)))
        for m in self.mats:
            me.materials.append(m)
        try:
            me.set_sharp_from_angle(angle=math.radians(sharp))
        except (AttributeError, TypeError):
            pass
        obj = bpy.data.objects.new(name, me)
        coll.objects.link(obj)
        if origin is not None:
            obj.location = V(origin)
        return obj


def circle_profile(r, n=10):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rect_profile(w, h):
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]


def rrect2d(w, h, r, k=6):
    """Rounded rectangle, CCW, k segments per corner, starting at the bottom-right corner."""
    pts = []
    corners = [(w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
               (-w / 2 + r, -h / 2 + r, 180)]
    for cx, cy, a0 in corners:
        for i in range(k + 1):
            a = math.radians(a0 + 90 * i / k)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def spline_pts(ctrl, n=24):
    """Catmull-Rom through control points (uniform), n samples per span."""
    P = [V(p) for p in ctrl]
    if len(P) < 3:
        return [P[0].lerp(P[-1], i / n) for i in range(n + 1)]
    out = []
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return out


def _hash(q, k=0):
    """Stable 0..1 hash of a point (rivet variants, plate random)."""
    x = math.sin(q[0] * 12.9898 * (k + 1) + q[1] * 78.233 + q[2] * 37.719 * (k + 3) + k * 4.1) * 43758.5453
    return x - math.floor(x)


def _project_to_tris(q, tris):
    """Project q onto the triangle (of a folded plate) that contains it; returns
    (point, outward normal, triangle)."""
    from mathutils.geometry import intersect_point_tri
    best = None
    for a, b, c in tris:
        nn = (b - a).cross(c - a)
        if nn.length < 1e-12:
            continue
        nn.normalize()
        hit = intersect_point_tri(q, a, b, c)
        d = abs(nn.dot(q - a))
        qp = q - nn * nn.dot(q - a)
        if hit is not None:
            return qp, nn, [a, b, c]
        if best is None or d < best[0]:
            best = (d, qp, nn, [a, b, c])
    return best[1], best[2], best[3]


def _ray_to_edges(q, d, n, edges):
    """In-plane distance from q along d to the nearest polygon edge (inf if none)."""
    e2 = n.cross(d)
    best = 1e9
    for a, b in edges:
        A = (a - q)
        B = (b - q)
        ay, by = A.dot(e2), B.dot(e2)
        if (ay > 0) == (by > 0) or abs(ay - by) < 1e-12:
            continue
        t = ay / (ay - by)
        x = A.dot(d) + t * (B.dot(d) - A.dot(d))
        if x > 1e-5:
            best = min(best, x)
    return best


# ---------------------------------------------------------------- the builder

class _Builder:
    def __init__(self, name, coll, timeline):
        self.name = name
        self.coll = coll
        self.timeline = timeline
        self.parts = {}
        self.head_plates = []
        self.torso_plates = []
        self.later_parent = []      # (obj, bone)
        self.rivet_reg = {}
        self.mat = dict(
            cream=M.cream_enamel(0.65), cream_head=M.cream_enamel(0.7, head=True), grey=M.galvanized_grey(0.45),
            grey_head=M.galvanized_grey(0.45, 'head'), chip_rim=M.chip_rim(), well=M.slot_well(),
            chrome_satin=M.chrome(satin=True), hero_lid=M.cup_lid(), slot_glow=M.slot_glow(),
            gun=M.gunmetal('inner'), gun_plate=M.gunmetal('plate'), chrome=M.chrome(), bronze=M.bronze('disc'),
            tip=M.bronze('tip'), rivet=M.rivet_steel(), core=M.dark_core(), black=M.black_plastic(),
            black_gloss=M.black_plastic(gloss=True), leather=M.leatherette(), rubber=M.rubber(),
            foam=M.mic_foam(), brass=M.brass(), copper=M.copper_wire(), red=M.red_wire(),
            orange=M.orange_wire(), strap=M.lanyard_strap(), card=M.badge_card(), vinyl=M.clear_vinyl(),
            clip=M.chrome_clip(), chip=M.blue_chip(), cup=M.paper_cup(), lid=M.cup_lid(),
            rivet_rust=M.rivet_rust(), streak=M.rust_streak(), ring=M.rust_ring(), frosted=M.frosted_clip(),
            earcup=M.earcup_face(), finger=M.finger_enamel(), gun_satin=M.gunmetal('satin'),
            # cables and cords are hooked curves: materials without positional texture (no swimming)
            copper_c=M.copper_wire(curve=True), red_c=M.red_wire(curve=True), black_c=M.black_plastic(curve=True),
        )
        self.curve_mat = {self.mat['copper']: self.mat['copper_c'], self.mat['red']: self.mat['red_c'],
                          self.mat['black']: self.mat['black_c']}

    # ---------------------------------------------------- registry
    def add(self, key, obj, bone):
        obj.name = f'{self.name}_{key}'
        self.parts[key] = obj
        self.later_parent.append((obj, bone))
        return obj

    def obj_from(self, key, mb, bone, origin=None, sharp=40.0):
        return self.add(key, mb.to_object(key, self.coll, origin=origin, sharp=sharp), bone)

    # ---------------------------------------------------- plates
    PLATE_RECESS = {'cream': 0.0, 'cream_head': 0.0, 'grey': 0.0028, 'grey_head': 0.0028, 'dark': 0.001}

    def plate(self, key, poly, outward, kind, bone, group=None, recess=None, thick=None, gap=0.0013,
              rivets=True, reg='head', rivet_scale=1.0, spacing=0.042, fan=None):
        """One riveted sheet-metal plate as its own object (origin at its centroid).

        A warped polygon becomes ONE folded plate: the triangles share a crease (bevelled,
        no gap, no rivets on the fold). Cream plates sit on the hull; grey plates are
        recessed under them and reach 2 mm further, so every cream plate shows a raised,
        bevelled lip over the grey."""
        mb = MB()
        info = self._plate_into(mb, poly, outward, kind, reg, rivets=rivets, rivet_scale=rivet_scale,
                                spacing=spacing, thick=thick, gap=gap, recess=recess, fan=fan)
        c = sum(info['top'], V()) / len(info['top'])
        obj = self.obj_from(key, mb, bone, origin=c)
        obj['plate_R'] = max((q - c).length for q in info['top'])     # oil-can dome radius (materials)
        obj['plate_normal'] = tuple(info['n'])
        obj['plate_kind'] = kind
        obj['plate_poly'] = [x for q in info['top'] for x in q]
        obj['plate_tris'] = [x for t in info['tri3'] for p_ in t for x in p_]
        if group is not None:
            group.append(obj)
        return obj

    def _plate_into(self, mb, poly, outward, kind, reg, rivets=True, rivet_scale=1.0, spacing=0.042, thick=None,
                    gap=0.0013, recess=None, fan=None, bevel=None, inner_mat=None, streaks=True):
        """Add one plate to mb. The top is an inset polygon ringed by a rim band; the band's
        outer verts carry edge_w = 1 and its inner verts 1 - d/EDGE_BAND, so the enamel
        shader knows how far every point is from the rim (chips, seam grime, freckles).
        Only the outline and the corners are bevelled: a fold stays one sharp crease.
        inner_mat: material for the plate's underside (default: the dark core)."""
        poly = [V(p) for p in poly]
        n = newell(poly)
        if n.dot(V(outward)) < 0:
            poly.reverse()
            n = -n
            if fan is not None:
                fan = len(poly) - 1 - fan
        grey = kind in ('grey', 'grey_head')
        if thick is None:
            thick = 0.0016 if grey else 0.0025
        if recess is None:
            recess = self.PLATE_RECESS[kind]
        if bevel is None:
            bevel = 0.0007 if grey else 0.0015
        pts = inset_poly(poly, n, -0.002 if grey else gap / 2)
        k = len(pts)
        cc = sum(pts, V()) / k
        warp = max(abs((q - cc).dot(n)) for q in pts)
        if k == 3 or warp <= 0.0015:
            tris = [list(range(k))]
        elif k == 4 and fan is None:
            mA = (pts[0] + pts[2]) / 2
            mB = (pts[1] + pts[3]) / 2
            tris = [[0, 1, 2], [0, 2, 3]] if (mA - mB).dot(n) >= 0 else [[1, 2, 3], [1, 3, 0]]
        elif fan is not None:
            o = [(fan + i) % k for i in range(k)]
            tris = [[o[0], o[i], o[i + 1]] for i in range(1, k - 1)]
        else:
            from mathutils.geometry import tessellate_polygon
            tris = [list(t) for t in tessellate_polygon([pts])]
        fn = []
        for t in tris:
            nn = newell([pts[i] for i in t])
            if nn.dot(n) < 0:            # keep every face wound counter-clockwise around n
                t.reverse()
                nn = -nn
            fn.append(nn)
        vn = [V((0, 0, 0)) for _ in range(k)]
        for t, nn in zip(tris, fn):
            for i in t:
                vn[i] += nn
        vn = [x.normalized() for x in vn]
        top = [pts[i] - vn[i] * recess for i in range(k)]
        bot = [top[i] - vn[i] * thick for i in range(k)]
        tri3 = []
        for t in tris:
            tri3 += [(top[t[0]], top[t[j]], top[t[j + 1]]) for j in range(1, len(t) - 1)]
        # rim band: inner ring inset by d_in (at most EDGE_BAND, less on slim plates)
        area = sum(((b_ - a_).cross(c_ - a_)).length * 0.5 for a_, b_, c_ in tri3)
        perim = sum((top[(i + 1) % k] - top[i]).length for i in range(k))
        d_in = max(0.002, min(M.EDGE_BAND, 0.45 * 2.0 * area / max(1e-6, perim)))
        inner = inset_poly(top, n, d_in)
        if len(tri3) > 1:
            inner = [_project_to_tris(q, tri3)[0] for q in inner]
        bm = mb.bm
        ew = bm.verts.layers.float.get('edge_w')
        before = set(bm.faces)
        Tv = [bm.verts.new(p) for p in top]
        Bv = [bm.verts.new(p) for p in bot]
        Iv = [bm.verts.new(p) for p in inner]
        if ew is not None:
            for v_ in Tv + Bv:
                v_[ew] = 1.0
            for v_ in Iv:
                v_[ew] = 1.0 - d_in / M.EDGE_BAND
        for t in tris:
            bm.faces.new([Iv[i] for i in t])
            bm.faces.new([Bv[i] for i in reversed(t)])
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((Tv[i], Tv[j], Iv[j], Iv[i]))
            bm.faces.new((Tv[j], Tv[i], Bv[i], Bv[j]))
        bm.edges.index_update()
        edges = []
        for i in range(k):
            for e in (bm.edges.get((Tv[i], Tv[(i + 1) % k])), bm.edges.get((Tv[i], Bv[i]))):
                if e is not None:
                    edges.append(e)
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=edges, offset=min(bevel, 0.3 * d_in), offset_type='OFFSET',
                            segments=3 if bevel > 0.001 else 2, profile=0.5, affect='EDGES', clamp_overlap=True)
        new = [f for f in bm.faces if f not in before]
        mat = {'cream': self.mat['cream'], 'cream_head': self.mat['cream_head'], 'grey': self.mat['grey'],
               'grey_head': self.mat['grey_head'], 'dark': self.mat['gun_plate']}[kind]
        mi, mi_core = mb.mi(mat), mb.mi(inner_mat or self.mat['core'])
        for f in new:
            f.normal_update()
            f.material_index = mi_core if f.normal.dot(n) < -0.7 else mi
            f.smooth = False
        mb.set_rand(new, _hash(cc, 5))
        if rivets:
            rp, rs = self.rivet_points(top, n, reg, rivet_scale, spacing)
            placed = []
            for q, sz in zip(rp, rs):
                q2, nq, tri = _project_to_tris(q, tri3)
                placed.append((q2, nq, sz, tri))
            self.rivet_mesh(mb, placed, top if len(tris) == 1 else None, streaks=streaks,
                            streak_rate=0.12 if grey else 0.20)
        return dict(n=n, top=top, tris=tris, tri3=tri3)

    def rivet_points(self, poly, n, reg, scale=1.0, spacing=0.048, inset=0.0085, min_dist=0.024):
        regl = self.rivet_reg.setdefault(reg, [])
        k = len(poly)
        edges = []
        for i in range(k):
            a, b = poly[i], poly[(i + 1) % k]
            m = n.cross((b - a).normalized()).normalized()
            edges.append((a, b, m))

        def inside(p, margin):
            return all((p - a).dot(m) >= margin for a, b, m in edges)

        def free(p):
            return all((p - q).length >= min_dist for q in regl)

        pts, sizes = [], []
        for i in range(k):
            p1 = poly[i]
            in0 = edges[i - 1][2]
            in1 = edges[i][2]
            bis = (in0 + in1)
            if bis.length < 1e-6:
                continue
            bis.normalize()
            q = p1 + bis * (0.012 / max(0.3, bis.dot(in1)))
            if inside(q, 0.0065) and free(q):
                j = 1.0 + 0.12 * (2 * _hash(q, 1) - 1)
                pts.append(q)
                sizes.append((0.00525 * scale * j, 0.0026 * scale))
                regl.append(q)
        for a, b, m in edges:
            L = (b - a).length
            cnt = max(1, int(round(L / spacing)))
            for j in range(cnt):
                t = (j + 0.5) / cnt
                q = a.lerp(b, t) + m * inset
                hsh = math.sin(q.x * 1731.0 + q.y * 977.0 + q.z * 1313.0) * 43758.5453
                if hsh - math.floor(hsh) < 0.12:
                    continue  # a few rivets are missing
                if inside(q, 0.006) and free(q):
                    jj = 1.0 + 0.12 * (2 * _hash(q, 1) - 1)
                    pts.append(q)
                    sizes.append((0.00425 * scale * jj, 0.0024 * scale))
                    regl.append(q)
        return pts, sizes

    def rivet_mesh(self, mb, placed, clip_poly=None, streaks=True, streak_rate=0.20):
        """Rivets with character: ~10% empty holes, ~25% rusted-through heads, the rest dull
        steel; a ragged rust bloom (1.35-2.1x the head) round ~10% of them and a tapering
        bleed stain under ~`streak_rate` of them (kept on the rivet's own plate).
        placed: [(point, normal, (radius, height), triangle-or-None)]."""
        m = self.mat
        for q, nq, (r, hgt), tri in placed:
            h1, h2, h3, h4 = _hash(q, 11), _hash(q, 23), _hash(q, 37), _hash(q, 53)
            if h1 < 0.10:
                self._disc(mb, m['core'], q + nq * 0.00006, nq, 0.002, 12)
                if h2 < 0.25:
                    self._disc(mb, m['ring'], q + nq * 0.00012, nq, r * (1.3 + 0.6 * h4), 14, uv=True)
                head_r = 0.002
            else:
                mat = m['rivet_rust'] if h1 < 0.35 else m['rivet']
                mb.rivets(mat, [q], nq, [(r, hgt)])
                head_r = r
                if h2 < 0.11:
                    self._disc(mb, m['ring'], q + nq * 0.00015, nq, r * (1.35 + 0.75 * h4), 18, uv=True)
            if streaks and h3 < streak_rate:
                down = V((0, 0, -1))
                down = down - nq * down.dot(nq)
                if down.length < 0.5:
                    continue
                down.normalize()
                edges = list(zip(tri, tri[1:] + tri[:1])) if tri is not None else []
                if clip_poly is not None:
                    edges = list(zip(clip_poly, clip_poly[1:] + clip_poly[:1]))
                side = nq.cross(down).normalized()
                wtop = max(head_r, r) * (1.9 + 0.5 * _hash(q, 43))      # never a hairline (empty holes too)
                room = min(_ray_to_edges(q + side * s_ * wtop * 0.5, down, nq, edges) for s_ in (-1, 0, 1))
                L = min(0.022 + 0.022 * _hash(q, 41), room - 0.004)
                if L < 0.012:
                    continue
                self._streak(mb, m['streak'], q + nq * 0.00015, down, nq, wtop, L, head_r)

    def _disc(self, mb, mat, c, nrm, r, seg=12, uv=False):
        nrm = V(nrm).normalized()
        e1 = nrm.orthogonal().normalized()
        e2 = nrm.cross(e1)
        bm = mb.bm
        cv = bm.verts.new(c)
        ring = [bm.verts.new(c + (e1 * math.cos(2 * math.pi * i / seg) + e2 * math.sin(2 * math.pi * i / seg)) * r)
                for i in range(seg)]
        mi = mb.mi(mat)
        lay = mb.uv() if uv else None
        for i in range(seg):
            j = (i + 1) % seg
            f = bm.faces.new((cv, ring[i], ring[j]))
            f.material_index = mi
            f.smooth = False
            if lay is not None:
                for loop, (a_, b_) in zip(f.loops, ((0.5, 0.5),
                                                    (0.5 + 0.5 * math.cos(2 * math.pi * i / seg),
                                                     0.5 + 0.5 * math.sin(2 * math.pi * i / seg)),
                                                    (0.5 + 0.5 * math.cos(2 * math.pi * j / seg),
                                                     0.5 + 0.5 * math.sin(2 * math.pi * j / seg)))):
                    loop[lay].uv = (a_, b_)
            if f.normal.dot(nrm) < 0:
                f.normal_flip()

    def _streak(self, mb, mat, top, down, nrm, wtop, L, head_r):
        """Bleed stain decal: wtop wide just under the rivet head, tapering to ~2 mm over L;
        UV u across, v down the stain (rust_streak shades it)."""
        side = nrm.cross(down).normalized()
        start = top + down * (head_r * 0.15)
        rows = [(0.0, 1.0), (0.35, 0.62), (1.0, 0.22)]
        bm = mb.bm
        lay = mb.uv()
        mi = mb.mi(mat)
        ring = []
        for t, wf in rows:
            c = start + down * (L * t)
            w = max(0.002, wtop * wf)
            ring.append((bm.verts.new(c - side * w / 2), bm.verts.new(c + side * w / 2), t))
        for (a0, a1, ta), (b0, b1, tb) in zip(ring, ring[1:]):
            f = bm.faces.new((a0, a1, b1, b0))
            f.material_index = mi
            f.smooth = False
            for loop, uvv in zip(f.loops, ((0, ta), (1, ta), (1, tb), (0, tb))):
                loop[lay].uv = uvv
            f.normal_update()
            if f.normal.dot(nrm) < 0:
                f.normal_flip()

    # ================================================================= HEAD
    def build_head(self):
        P = {k: HP(k) for k in HEAD_PTS}
        names = list(P)
        self.head_hull = Hull(list(P.values()))
        hc = sum(P.values(), V()) / len(P)
        self.head_center = hc

        def L(a, b, t):
            return P[a].lerp(P[b], t)

        E = lambda t: L('BrowR', 'Rtip', t)
        Rr = lambda t: L('apex', 'Rtip', t)       # on the apex-Rtip ridge
        Fp = lambda s: L('JawR', 'Rtip', s)
        Q11 = (L('Rtip', 'apex', 0.5)).lerp(P['BK1'], 0.42)
        Mc = L('JawR', 'JawL', 0.5)
        plates = [
            # (key, poly, kind)
            ('crown_c', [P['BrowR'], P['BrowL'], P['apex']], 'cream_head'),
            # canon facet 3: a cream strip along BrowR-apex, a broad grey band (~6.5 cm, parallel
            # to that edge) and a cream triangle along the apex-Rtip ridge
            ('crown_strip', [P['BrowR'], E(0.075), Rr(0.075), P['apex']], 'cream_head'),
            ('crown_tri', [E(0.36), P['Rtip'], Rr(0.36)], 'cream_head'),
            ('crown_left', [P['BrowL'], P['L1'], P['apex']], 'cream_head'),
            ('cheek_tri', [Fp(0.24), E(0.27), P['Rtip']], 'cream_head'),
            ('jaw_wedge', [P['LR'], P['JawR'], P['Rtip']], 'cream_head'),
            ('chin_r', [P['JawR'], Mc, P['chin']], 'cream_head'),
            ('chin_right', [P['chin'], P['JawR'], P['LR']], 'cream_head'),
            ('cheek_l_up', [P['BrowL'], P['JawL'], P['L1']], 'cream_head'),
            ('cheek_l_low', [P['JawL'], P['L2'], P['L1']], 'cream_head'),
            ('side_back_l', [P['L2'], P['BK3'], P['L1']], 'cream_head'),
            ('top_back_a', [P['Rtip'], P['apex'], Q11], 'cream_head'),
            ('top_back_b', [P['apex'], P['BK1'], Q11], 'cream_head'),
            ('back_a', [P['apex'], P['L1'], P['BK1']], 'cream_head'),
            ('back_b', [P['L1'], P['BK3'], P['BK1']], 'cream_head'),
            ('back_c', [P['BK2'], P['Rtip'], P['BK1']], 'cream_head'),
            ('crown_band', [E(0.075), E(0.36), Rr(0.36), Rr(0.075)], 'grey_head'),
            ('cheek_grey', [P['JawR'], P['BrowR'], E(0.27), Fp(0.24)], 'grey_head'),
            ('chin_l', [Mc, P['JawL'], P['chin']], 'grey_head'),
            ('chin_left', [P['chin'], P['L2'], P['JawL']], 'grey_head'),
            ('top_back_g', [P['BK1'], P['Rtip'], Q11], 'grey_head'),
            ('back_d', [P['BK3'], P['BK2'], P['BK1']], 'grey_head'),
            ('under_1', [P['chin'], P['BK4'], P['L2']], 'dark'),
            ('under_2', [P['BK4'], P['Rtip'], P['BK2']], 'dark'),
            ('under_3', [P['BK4'], P['LR'], P['Rtip']], 'dark'),
            ('under_4', [P['chin'], P['LR'], P['BK4']], 'dark'),
            ('under_5', [P['L2'], P['BK4'], P['BK3']], 'dark'),
            ('under_6', [P['BK4'], P['BK2'], P['BK3']], 'dark'),
        ]
        for key, poly, kind in plates:
            c = sum(poly, V()) / len(poly)
            self.plate('head_' + key, poly, c - hc, kind, 'head', self.head_plates, reg='head')
        self.build_face(P)
        # inner core: hull shrunk 4 mm along vertex normals
        bm = bmesh.new()
        for p in P.values():
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        bm.normal_update()
        core_pts = []
        for v in bm.verts:
            nv = sum((f.normal for f in v.link_faces), V()).normalized()
            core_pts.append(v.co - nv * 0.0045)
        bm.free()
        mb = MB()
        mb.hull(self.mat['core'], core_pts)
        self.obj_from('head_core', mb, 'head')
        # neck socket under the head
        piv = H((0, 0.02, 0.0))
        self.neck_top = piv
        mb = MB()
        mb.cylinder(self.mat['gun'], piv + V((0, 0, -0.016)), piv + V((0, 0, 0.012)), 0.043, seg=24)
        mb.cylinder(self.mat['rubber'], piv + V((0, 0, -0.024)), piv + V((0, 0, -0.014)), 0.036, 0.04, seg=24)
        for a in range(6):
            ang = a * math.pi / 3
            mb.cylinder(self.mat['rivet'], piv + V((0.037 * math.cos(ang), 0.037 * math.sin(ang), -0.0175)),
                        piv + V((0.037 * math.cos(ang), 0.037 * math.sin(ang), -0.0155)), 0.004, seg=8)
        self.obj_from('head_socket', mb, 'head')

    def build_face(self, P):
        BR, BL, JL, JR = P['BrowR'], P['BrowL'], P['JawL'], P['JawR']
        c = (BR + BL + JL + JR) / 4
        ex = (BL - BR).normalized()
        up_raw = (BR + BL) / 2 - (JR + JL) / 2
        ey = (up_raw - ex * ex.dot(up_raw)).normalized()
        n = ex.cross(ey)
        Wf = (BL - BR).length - 0.0013
        Hf = up_raw.length - 0.0013
        # the glass fills the face opening up to a thin bezel lip (5.8 mm, ~3% of the glass width,
        # as in the reference), so the head's plates meet the screen instead of framing a TV
        lip = 0.0058
        sw, sh = Wf - 2 * lip, Hf - 2 * lip
        self.face_frame = (c, ex, ey, n, sw, sh)
        k = 6

        def to3(x, y, z):
            return c + ex * x + ey * y + n * z

        outer = rrect2d(Wf, Hf, 0.0012, k)
        inner = rrect2d(sw, sh, 0.006 * HEAD_SCALE, k)
        zf, zbo, zbi, zg = 0.0022, -0.0025, -0.0068, -0.001
        bm = bmesh.new()
        Of = [bm.verts.new(to3(x, y, zf)) for x, y in outer]
        Ob = [bm.verts.new(to3(x, y, zbo)) for x, y in outer]
        If = [bm.verts.new(to3(x, y, zf)) for x, y in inner]
        Ib = [bm.verts.new(to3(x, y, zbi)) for x, y in inner]
        N = len(outer)
        for i in range(N):
            j = (i + 1) % N
            bm.faces.new((Of[i], Of[j], If[j], If[i]))
            bm.faces.new((Of[j], Of[i], Ob[i], Ob[j]))
            bm.faces.new((If[i], If[j], Ib[j], Ib[i]))
            bm.faces.new((Ob[i], Ib[i], Ib[j], Ob[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        front_edges = [e for e in bm.edges if all(abs((v.co - c).dot(n) - zf) < 1e-5 for v in e.verts)
                       and not ((e.verts[0] in Of) != (e.verts[1] in Of))]
        bmesh.ops.bevel(bm, geom=front_edges, offset=0.0009, offset_type='OFFSET', segments=2, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
        for f in bm.faces:
            f.smooth = True
        mb = MB()
        mb.bm.free()
        bm.faces.layers.float.new('plate_rand')
        bm.loops.layers.uv.new('UVMap')
        mb.bm = bm
        mb.mi(self.mat['cream_head'])
        # no rivets on the thin lip: the surrounding plates carry them
        bez = self.obj_from('head_bezel', mb, 'head', origin=c)
        bez['plate_normal'] = tuple(n)
        bez['plate_kind'] = 'cream_head'
        self.head_plates.append(bez)
        # glass: flat, except its top 22% rolls back ~18 deg inside the recess, so the overhead
        # skylight reflects as one thin bright band along the top edge (treatment S02/S05)
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new('UVMap')
        rr = 0.006 * HEAD_SCALE
        y_roll = sh * 0.28
        roll_d = 0.0034

        def half_w(y):
            dy = abs(y) - (sh / 2 - rr)
            if dy <= 0:
                return sw / 2
            return sw / 2 - rr + math.sqrt(max(0.0, rr * rr - dy * dy))

        def depth(y):
            if y <= y_roll:
                return zg
            t = (y - y_roll) / (sh / 2 - y_roll)
            return zg - roll_d * t * t
        ys = [-sh / 2 + sh * k / 40 for k in range(1, 26)] + [y_roll + (sh / 2 - y_roll) * k / 14 for k in range(1, 14)]
        ys = [-sh / 2] + sorted(set(round(y, 7) for y in ys if -sh / 2 < y < sh / 2)) + [sh / 2]
        ncol = 28
        rows = []
        for y in ys:
            hw = half_w(y)
            if hw < 1e-5:
                hw = 1e-5
            rows.append([bm.verts.new(to3(-hw + 2 * hw * i / ncol, y, depth(y))) for i in range(ncol + 1)])
        for j in range(len(rows) - 1):
            for i in range(ncol):
                f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
                f.smooth = True
                for loop in f.loops:
                    q = loop.vert.co - c
                    x_, y_ = q.dot(ex), q.dot(ey)
                    loop[uvl].uv = ((x_ + sw / 2) / sw, (y_ + sh / 2) / sh)
        bm.normal_update()
        for f in bm.faces:
            if f.normal.dot(n) < 0:
                f.normal_flip()
        me = bpy.data.meshes.new('screen')
        bm.to_mesh(me)
        bm.free()
        me.transform(Matrix.Translation(-c))
        tl = self.timeline
        smat = F.screen_material(tl, name=f'{self.name}_screen', glass_roughness=0.06, specular=0.25, aspect=sw / sh)
        me.materials.append(smat)
        scr = bpy.data.objects.new('screen', me)
        self.coll.objects.link(scr)
        scr.location = c
        self.add('screen', scr, 'head')
        self.screen = scr

    # ================================================================= HEADSET
    def build_headset(self):
        hull = self.head_hull
        self.hs_parts = []
        mb = MB(point_attrs=('ring_r',))
        m = self.mat

        def cup_frame(center, axis, upref):
            axis = V(axis).normalized()
            up = (V(upref) - axis * axis.dot(V(upref))).normalized()
            x = up.cross(axis)
            return center, axis, up, x

        def seat(center, axis, margin=0.0022):
            """Slide the earcup along -axis until its cushion ring just touches the head."""
            axis = V(axis).normalized()
            up = (UP - axis * axis.dot(UP))
            up = up.normalized() if up.length > 1e-6 else V((0, 1, 0))
            x = up.cross(axis)
            ring = [(x * math.cos(a) + up * math.sin(a)) * r for a in
                    [2 * math.pi * i / 24 for i in range(24)] for r in (0.032, 0.046, 0.059)]
            lo, hi = -0.08, 0.08
            for _ in range(40):
                mid = (lo + hi) / 2
                o = V(center) + axis * mid
                d = min(hull.sdf(o + q) for q in ring)
                if d > margin:
                    hi = mid
                else:
                    lo = mid
            return V(center) + axis * hi

        def earcup(center, axis, upref, side):
            o, a, up, x = cup_frame(center, axis, upref)
            # z along axis from the cushion inner face (z=0)
            P_ = lambda r_ang, rr, z: o + a * z + (x * math.cos(r_ang) + up * math.sin(r_ang)) * rr
            mb.torus(m['leather'], o + a * 0.0135, a, 0.0445, 0.0135, seg=40, seg2=12)
            mb.cylinder(m['black'], o + a * 0.004, o + a * 0.012, 0.034, seg=32)
            prof = [(0.0565, 0.022), (0.0575, 0.030), (0.0565, 0.040), (0.052, 0.047), (0.045, 0.051),
                    (0.030, 0.0535), (0.0, 0.0545)]
            shell = mb.lathe(m['earcup'], prof, o, a, seg=48, close_bottom=True)
            sv = list({v_ for f_ in shell for v_ in f_.verts})
            mb.set_point_attr('ring_r', sv, [((v_.co - o) - a * (v_.co - o).dot(a)).length for v_ in sv])
            mb.torus(m['black_gloss'], o + a * 0.0505, a, 0.041, 0.0022, seg=48, seg2=8)
            mb.torus(m['brass'], o + a * 0.0305, a, 0.0577, 0.0011, seg=48, seg2=6)
            for i in range(4):
                ang = math.pi / 4 + i * math.pi / 2
                mb.cylinder(m['brass'], P_(ang, 0.034, 0.0525), P_(ang, 0.034, 0.0545), 0.0018, seg=8)
            # yoke: U fork around the cup in the plane z=0.034, joined at the top
            yoke = [P_(math.radians(a_), 0.0655, 0.034) for a_ in range(-10, 191, 10)]
            mb.sweep(m['black'], yoke, rect_profile(0.008, 0.005), normals=[a] * len(yoke))
            for a_ in (-10, 190):
                mb.cylinder(m['black_gloss'], P_(math.radians(a_), 0.0655, 0.028),
                            P_(math.radians(a_), 0.0655, 0.040), 0.0045, seg=12)
            top = P_(math.pi / 2, 0.0655, 0.034)
            slider_c = top + up * 0.012
            rot = frame3(x, up)
            mb.box(m['black'], slider_c, (0.024, 0.026, 0.015), rot=rot, bevel=0.003)
            return dict(o=o, a=a, up=up, x=x, top=slider_c + up * 0.012, P=P_)

        # left earcup (character left, +X), yawed 12 deg toward the front
        axL = V((math.cos(math.radians(12)), -math.sin(math.radians(12)), 0.0))
        oL = seat(H((0.228, -0.005, 0.118)) - axL * 0.025, axL)
        cupL = earcup(oL, axL, UP, 'L')
        # right earcup: under/behind the wedge, facing the lower wedge facets
        axR = V((-0.62, 0.56, -0.28)).normalized()
        oR = seat(H((-0.165, 0.178, 0.170)) - axR * 0.025, axR)
        cupR = earcup(oR, axR, V((0, 0.4, 1)), 'R')
        self.earcups = (cupL, cupR)
        # headband: flat band over the crown behind the apex, flat side facing the head. Its middle
        # control points are snapped onto the head (band half-thickness + pad + ~1 mm), so the pad
        # rests on the crown over and behind the apex instead of hovering; the earcup tops stay put
        hc = self.head_center

        def snap(p, margin):
            d = (V(p) - hc).normalized()
            lo, hi = 0.0, 0.6
            for _ in range(40):
                mid = (lo + hi) / 2
                if hull.sdf(hc + d * mid) < margin:
                    lo = mid
                else:
                    hi = mid
            return hc + d * hi
        ctrl = [cupL['top'], H((0.232, 0.012, 0.280)), H((0.14, 0.032, 0.345)), H((0.02, 0.055, 0.350)),
                H((-0.13, 0.11, 0.28)), cupR['top']]
        ctrl = [ctrl[0], snap(ctrl[1], HEADBAND_SIDE)] + [snap(p, 0.0094) for p in ctrl[2:-1]] + [ctrl[-1]]
        path = spline_pts(ctrl, 14)
        path = [path[0]] + [hull.push(p, 0.0094) if 0 < i < len(path) - 1 else p for i, p in enumerate(path[1:], 1)]
        # lift any point whose band or pad EDGE (not just the centreline) would dip into the head
        # where the band crosses a ridge obliquely
        for i in range(1, len(path) - 1):
            nv = (path[i] - hc).normalized()
            tg = (path[i + 1] - path[i - 1]).normalized()
            lat = tg.cross(nv).normalized()
            for _ in range(6):
                cs = [path[i] - nv * 0.00825 + lat * k * 0.011 for k in (-1, 1)] + \
                     [path[i] - nv * 0.00375 + lat * k * 0.013 for k in (-1, 1)]
                worst = min(hull.sdf(q) for q in cs)
                if worst >= 0.0004:
                    break
                path[i] = path[i] + nv * (0.0004 - worst)
        nrm = [(p - self.head_center).normalized() for p in path]
        self.headband = ([p.copy() for p in path], [n_.copy() for n_ in nrm])     # rest space (head bone)
        mb.sweep(m['black_gloss'], path, rect_profile(0.026, 0.0075), normals=nrm, caps=True)
        inner_path = [p - nv * 0.0055 for p, nv in zip(path, nrm)]
        mb.sweep(m['leather'], inner_path[1:-1], rect_profile(0.022, 0.0055), normals=nrm[1:-1], caps=True)
        # boom mic: pivot hub on the left cup's lower front, rod curving under the screen
        P_ = cupL['P']
        hub = P_(math.radians(-140), 0.040, 0.050)
        mb.cylinder(m['black_gloss'], hub, hub + cupL['a'] * 0.012, 0.009, seg=24)
        mb.torus(m['brass'], hub + cupL['a'] * 0.0122, cupL['a'], 0.0085, 0.0009, seg=24, seg2=6)
        mic_c = H((0.058, -0.205, 0.022))
        boom_ctrl = [hub + cupL['a'] * 0.010, H((0.215, -0.10, 0.040)), H((0.15, -0.185, 0.024)),
                     H((0.105, -0.207, 0.022)), mic_c + V((0.026, 0, 0))]
        boom_ctrl = [boom_ctrl[0]] + [hull.push(p, 0.012) for p in boom_ctrl[1:]]
        bpath = spline_pts(boom_ctrl, 12)
        mb.sweep(m['black_gloss'], bpath, circle_profile(0.0033, 10))
        # foam windscreen capsule
        d = (bpath[-1] - bpath[-3]).normalized()
        mc = bpath[-1] + d * 0.030
        mb.cylinder(m['black'], bpath[-1] - d * 0.002, bpath[-1] + d * 0.008, 0.006, 0.007, seg=16)
        q = UP.rotation_difference(d)
        mb.sphere(m['foam'], mc, 0.0155, seg=24, rings=14, scale=(1, 1, 2.05), rot=q.to_matrix())
        self.mic_center = mc
        self.cord_start = P_(math.radians(-90), 0.050, 0.030)
        hs = self.obj_from('headset_parts', mb, None)
        self.headset_mesh = hs

    # ================================================================= NECK
    def build_neck(self):
        m = self.mat
        base = V((0, 0.0, 1.30))
        top = self.neck_top
        mb = MB()
        mb.cylinder(m['chrome'], V((0, 0.0, 1.26)), top + V((0, 0, -0.01)), 0.0105, seg=16)
        for i in range(7):
            t = (i + 0.5) / 7
            p = base.lerp(top + V((0, 0, -0.026)), t)
            mb.cylinder(m['bronze'], p - V((0, 0, 0.004)), p + V((0, 0, 0.004)), 0.025, seg=24)
            mb.cylinder(m['gun'], p + V((0, 0, 0.004)), p + V((0, 0, 0.0095)), 0.0165, seg=16)
        self.obj_from('neck_spine', mb, 'neck')
        # A-frame pistons (canon): from the collar's front corners (+-0.08, -0.08, 1.31) converging
        # upward to (+-0.03, -0.03) just under the head; two thin back rods
        for sx in (-1, 1):
            s = 'L' if sx > 0 else 'R'
            self.piston(f'neck_piston_{s}', V((0.08 * sx, -0.08, 1.31)), 'chest',
                        V((0.030 * sx, -0.030, top.z - 0.009)), 'head', 0.011, 0.0062)
            self.piston(f'neck_rod_{s}', V((0.03 * sx, 0.055, 1.30)), 'chest',
                        V((0.022 * sx, 0.06, top.z - 0.006)), 'head', 0.0055, 0.0034, cyl_mat='gun')
        # collar cavity (inside the yoke's trapezoid opening): a dark floor 4 cm below the rim, the
        # piston brackets, two meshing brass gears and a black servo between the pistons
        mb = MB()
        for sx in (-1, 1):
            mb.box(m['gun'], V((0.08 * sx, -0.08, 1.292)), (0.03, 0.03, 0.030), bevel=0.002)
            mb.cylinder(m['chrome_satin'], V((0.08 * sx - 0.016, -0.08, 1.309)), V((0.08 * sx + 0.016, -0.08, 1.309)),
                        0.006, seg=12)
            mb.box(m['gun'], V((0.03 * sx, 0.055, 1.290)), (0.02, 0.02, 0.025), bevel=0.002)
        floor = [V((-0.104, -0.134, 1.279)), V((0.104, -0.134, 1.279)), V((0.071, 0.040, 1.279)),
                 V((-0.071, 0.040, 1.279))]
        mb.prism(m['core'], floor, UP, 0.004)
        self.gear(mb, V((0.0, -0.088, 1.287)), 0.020, 0.007, 16, m['brass'])
        self.gear(mb, V((-0.033, -0.108, 1.286)), 0.0135, 0.006, 11, m['brass'])
        mb.box(m['black'], V((0.040, -0.106, 1.291)), (0.030, 0.022, 0.018), bevel=0.002)
        mb.cylinder(m['brass'], V((0.040, -0.106, 1.300)), V((0.040, -0.106, 1.304)), 0.005, seg=12)
        self.obj_from('collar_mech', mb, 'chest')
        # neck cables (hooked chest -> neck -> head): four black ones loop out round the sides and
        # back, the copper one loops up the front right, the red one in a slack S up the front left
        def bone_for(z):
            return 'chest' if z < 1.33 else ('neck' if z < 1.39 else 'head')
        for i, (r, ang) in enumerate(((0.0045, 0.5), (0.0040, 2.4), (0.0036, 3.6), (0.0042, 5.55))):
            dx, dy = math.cos(ang), math.sin(ang)
            yax = lambda z: 0.019 * max(0.0, min(1.0, (z - 1.31) / 0.112))
            pts = [(V((0.054 * dx, 0.036 * dy, 1.283)), 'chest'),
                   (V((0.060 * dx, 0.044 * dy + yax(1.318), 1.318)), 'chest'),
                   (V((0.066 * dx, 0.052 * dy + yax(1.355), 1.355)), 'neck'),
                   (top + V((0.046 * dx, 0.042 * dy, -0.036)), 'head'),
                   (top + V((0.021 * dx, 0.02 * dy, -0.013)), 'head')]
            self.hooked_cable(f'neck_cable_{i}', pts, r, m['black'])
        copper = [V((-0.030, -0.060, 1.283)), V((-0.044, -0.066, 1.312)), V((-0.052, -0.050, 1.345)),
                  V((-0.036, -0.036, 1.372)), top + V((-0.030, -0.040, -0.030)), top + V((-0.016, -0.022, -0.012))]
        self.hooked_cable('neck_cable_4', [(q, bone_for(q.z)) for q in copper], 0.0026, m['copper'])
        red = [V((0.028, -0.060, 1.283)), V((0.012, -0.070, 1.308)), V((0.036, -0.062, 1.333)),
               V((0.008, -0.052, 1.360)), V((0.022, -0.038, 1.384)), top + V((0.012, -0.030, -0.014))]
        self.hooked_cable('neck_cable_5', [(q, bone_for(q.z)) for q in red], 0.0021, m['red'])

    def gear(self, mb, c, r, th, teeth, mat):
        pts = []
        for i in range(teeth * 4):
            a = 2 * math.pi * i / (teeth * 4)
            rr = r if (i % 4) in (1, 2) else r * 0.86
            pts.append(c + V((rr * math.cos(a), rr * math.sin(a), th / 2)))
        mb.prism(mat, pts, UP, th)
        mb.cylinder(self.mat['gun'], c - V((0, 0, th)), c + V((0, 0, th)), r * 0.25, seg=12)

    def piston(self, key, a, bone_a, b, bone_b, r_cyl, r_rod, cyl_mat='chrome', ratio=(0.6, 0.56)):
        """Telescoping piston: cylinder on bone_a aims at b, rod on bone_b aims at a."""
        m = self.mat
        D = (b - a).length
        ea = C.empty(f'{self.name}_{key}_A', self.coll, a, size=0.01)
        eb = C.empty(f'{self.name}_{key}_B', self.coll, b, size=0.01)
        self.later_parent += [(ea, bone_a), (eb, bone_b)]
        Lc, Lr = D * ratio[0], D * ratio[1]
        mb = MB()
        mb.cylinder(m[cyl_mat], V((0, 0, 0)), V((0, 0, Lc)), r_cyl, seg=16)
        mb.cylinder(m['gun'], V((0, 0, -0.004)), V((0, 0, 0.012)), r_cyl * 1.15, seg=16)
        mb.cylinder(m['gun'], V((0, 0, Lc - 0.003)), V((0, 0, Lc + 0.003)), r_cyl * 1.08, seg=16)
        cyl = self.obj_from(key + '_cyl', mb, bone_a)
        cyl.location = a
        mb = MB()
        mb.cylinder(m['chrome'], V((0, 0, 0)), V((0, 0, Lr)), r_rod, seg=12)
        mb.cylinder(m['gun'], V((0, 0, -0.005)), V((0, 0, 0.008)), r_rod * 1.6, seg=12)
        rod = self.obj_from(key + '_rod', mb, bone_b)
        rod.location = b
        for o, t in ((cyl, eb), (rod, ea)):
            con = o.constraints.new('DAMPED_TRACK')
            con.target = t
            con.track_axis = 'TRACK_Z'
        return cyl, rod

    def piston3(self, key, a, bone_a, b, bone_b, r_cyl, r_rod, stage=0.39):
        """Three-stage telescoping piston (handles ~2.5x length change): cylinder on bone_a,
        a free middle sleeve kept at the midpoint, rod on bone_b."""
        m = self.mat
        D = (b - a).length
        L = D * stage
        r_mid = (r_cyl + r_rod) / 2 + 0.0008
        ea = C.empty(f'{self.name}_{key}_A', self.coll, a, size=0.01)
        eb = C.empty(f'{self.name}_{key}_B', self.coll, b, size=0.01)
        self.later_parent += [(ea, bone_a), (eb, bone_b)]
        mb = MB()
        mb.cylinder(m['chrome'], V((0, 0, 0)), V((0, 0, L)), r_cyl, seg=16)
        mb.cylinder(m['gun'], V((0, 0, -0.004)), V((0, 0, 0.010)), r_cyl * 1.15, seg=16)
        mb.cylinder(m['gun'], V((0, 0, L - 0.003)), V((0, 0, L + 0.002)), r_cyl * 1.08, seg=16)
        cyl = self.obj_from(key + '_cyl', mb, bone_a)
        cyl.location = a
        mb = MB()
        mb.cylinder(m['chrome'], V((0, 0, -L / 2)), V((0, 0, L / 2)), r_mid, seg=14)
        mb.cylinder(m['gun'], V((0, 0, L / 2 - 0.003)), V((0, 0, L / 2 + 0.002)), r_mid * 1.1, seg=14)
        mid = mb.to_object(f'{self.name}_{key}_mid', self.coll)
        self.parts[key + '_mid'] = mid
        mid.location = (a + b) / 2
        mid.parent = ea                     # inherits the limb's roll; constraints place and aim it
        mid.matrix_parent_inverse = Matrix.Translation(a).inverted()
        c1 = mid.constraints.new('COPY_LOCATION')
        c1.target = ea
        c2 = mid.constraints.new('COPY_LOCATION')
        c2.target = eb
        c2.influence = 0.5
        mb = MB()
        mb.cylinder(m['chrome'], V((0, 0, 0)), V((0, 0, L)), r_rod, seg=12)
        mb.cylinder(m['gun'], V((0, 0, -0.005)), V((0, 0, 0.007)), r_rod * 1.7, seg=12)
        rod = self.obj_from(key + '_rod', mb, bone_b)
        rod.location = b
        for o, t in ((cyl, eb), (mid, eb), (rod, ea)):
            con = o.constraints.new('DAMPED_TRACK')
            con.target = t
            con.track_axis = 'TRACK_Z'
        return cyl, mid, rod

    def hooked_cable(self, key, pts_bones, radius, mat):
        cu = bpy.data.curves.new(f'{self.name}_{key}', 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = radius
        cu.bevel_resolution = 2
        cu.use_fill_caps = True
        cu.resolution_u = 8
        sp = cu.splines.new('NURBS')
        sp.points.add(len(pts_bones) - 1)
        for p, (co, _) in zip(sp.points, pts_bones):
            p.co = (*co, 1.0)
        sp.use_endpoint_u = True
        sp.order_u = 3
        cu.materials.append(self.curve_mat.get(mat, mat))
        ob = bpy.data.objects.new(f'{self.name}_{key}', cu)
        self.coll.objects.link(ob)
        self.parts[key] = ob
        for i, (co, bone) in enumerate(pts_bones):
            e = C.empty(f'{self.name}_{key}_h{i}', self.coll, co, size=0.005)
            if isinstance(bone, bpy.types.Object):
                e.parent = bone
                e.matrix_parent_inverse = bone.matrix_basis.inverted()
            else:
                self.later_parent.append((e, bone))
            h = ob.modifiers.new(f'h{i}', 'HOOK')
            h.object = e
            h.vertex_indices_set([i])
            h.center = co
            h.matrix_inverse = Matrix.Translation(co).inverted()
        return ob

    def headset_cord(self, cs, hs, worn, off, arm, route=None):
        """Cord from the left earcup into the collar. Each hook (and the plug) carries three Child
        Of constraints, in this order: 'worn' (on the body), 'route' (a waypoint out beyond the
        left earcup, on the headset) and 'unplugged' (wrapped round the earcup). Unplugging
        blends worn -> route, then route -> unplugged (Rig._key_cord), so the cord swings out and
        round the earcup and never passes through the head."""
        m = self.mat
        cu = bpy.data.curves.new(f'{self.name}_headset_cord', 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = 0.0021
        cu.bevel_resolution = 2
        cu.use_fill_caps = True
        cu.resolution_u = 10
        sp = cu.splines.new('NURBS')
        sp.points.add(len(worn))
        cos = [cs] + [co for co, _ in worn]
        for pt, co in zip(sp.points, cos):
            pt.co = (*co, 1.0)
        sp.use_endpoint_u = True
        sp.order_u = 3
        cu.materials.append(m['black_c'])
        ob = bpy.data.objects.new(f'{self.name}_headset_cord', cu)
        self.coll.objects.link(ob)
        self.parts['headset_cord'] = ob
        hs_rest = hs.matrix_basis.copy()      # matrix_world is not evaluated yet at build time
        hooks = []

        def dual(e, co, tgt, off_co, route_co=None):
            c1 = e.constraints.new('CHILD_OF')
            c1.name = 'worn'
            if isinstance(tgt, bpy.types.Object):
                c1.target = tgt
                c1.inverse_matrix = hs_rest.inverted()
            else:
                c1.target = arm
                c1.subtarget = tgt
                c1.inverse_matrix = arm.data.bones[tgt].matrix_local.inverted()
            cr = e.constraints.new('CHILD_OF')
            cr.name = 'route'
            cr.target = hs
            rc = route_co if route_co is not None else off_co
            cr.inverse_matrix = hs_rest.inverted() @ Matrix.Translation(rc) @ Matrix.Translation(co).inverted()
            cr.influence = 0.0
            c2 = e.constraints.new('CHILD_OF')
            c2.name = 'unplugged'
            c2.target = hs
            c2.inverse_matrix = hs_rest.inverted() @ Matrix.Translation(off_co) @ Matrix.Translation(co).inverted()
            c2.influence = 0.0

        for i, co in enumerate(cos):
            e = C.empty(f'{self.name}_headset_cord_h{i}', self.coll, co, size=0.005)
            if i == 0:
                e.parent = hs
                e.matrix_parent_inverse = hs_rest.inverted()
            else:
                dual(e, co, worn[i - 1][1], off[i - 1], route[i - 1] if route else None)
                hooks.append(e)
            h = ob.modifiers.new(f'h{i}', 'HOOK')
            h.object = e
            h.vertex_indices_set([i])
            h.center = co
            h.matrix_inverse = Matrix.Translation(co).inverted()
        # the plug at the collar end of the cord
        pc = cos[-1]
        mb = MB()
        mb.cylinder(m['black'], V((0, 0, -0.012)), V((0, 0, 0.004)), 0.0032, seg=12)
        mb.cylinder(m['chrome'], V((0, 0, -0.019)), V((0, 0, -0.012)), 0.0013, seg=8)
        plug = mb.to_object(f'{self.name}_headset_plug', self.coll)
        plug.location = pc
        dual(plug, pc, worn[-1][1], off[-1], route[-1] if route else None)
        self.parts['headset_plug'] = plug
        hooks.append(plug)
        self.cord_hooks = hooks

    # ================================================================= TORSO
    TORSO = {
        'T0': (-0.256, -0.094, 1.315), 'T1': (-0.11, -0.14, 1.32), 'T2': (0.11, -0.14, 1.32),
        'T3': (0.256, -0.094, 1.315),
        'M0': (-0.284, -0.078, 1.18), 'M1': (-0.16, -0.165, 1.18), 'M2': (0.0, -0.175, 1.16), 'M3': (0.16, -0.165, 1.165),
        'M4': (0.284, -0.078, 1.18),
        'B0': (-0.24, -0.07, 1.05), 'B1': (-0.10, -0.155, 1.05), 'B2': (0.10, -0.155, 1.05), 'B3': (0.24, -0.07, 1.05),
        'D0': (-0.17, -0.06, 0.99), 'D1': (0.0, -0.12, 0.99), 'D2': (0.17, -0.06, 0.99),
        'T0b': (-0.268, 0.098, 1.315), 'T1b': (-0.11, 0.13, 1.32), 'T2b': (0.11, 0.13, 1.32),
        'T3b': (0.268, 0.098, 1.315),
        'M0b': (-0.284, 0.078, 1.18), 'M1b': (-0.15, 0.14, 1.18), 'M2b': (0.0, 0.145, 1.17), 'M3b': (0.15, 0.14, 1.18),
        'M4b': (0.284, 0.078, 1.18),
        'B0b': (-0.24, 0.07, 1.05), 'B1b': (-0.10, 0.13, 1.05), 'B2b': (0.10, 0.13, 1.05), 'B3b': (0.24, 0.07, 1.05),
        'D0b': (-0.17, 0.06, 0.99), 'D1b': (0.0, 0.10, 0.99), 'D2b': (0.17, 0.06, 0.99),
        'C2': (0.075, 0.045, 1.322), 'C3': (-0.075, 0.045, 1.322),
        # the bold reference layout (video_synergy-v2-source / torso close-up): a tall grey
        # triangle on his right starting a quarter below the collar, and one big folded grey
        # panel under the chip whose tip reaches the lanyard's V
        'G0': (-0.277, -0.082, 1.215), 'G1': (-0.135, -0.153, 1.245), 'Lc': (-0.05, -0.165, 1.105),
        'M3p': (0.148, -0.158, 1.225), 'Rb': (0.200, -0.095, 1.035), 'Bc': (0.030, -0.155, 1.045),
    }

    def build_torso(self):
        T = {k: V(v) for k, v in self.TORSO.items()}
        self.torso_hull = Hull([v for k, v in T.items() if not k.startswith('C')])
        tc = V((0, 0, 1.16))
        # side plates close the upper flank up to z 1.28, leaving a 3.5 cm armpit slot under the
        # pauldron (the shoulder hub sits just outside it)
        zf = 1.28
        for sx_, (t, m_, mb_, tb) in ((-1, ('T0', 'G0', 'M0b', 'T0b')), (1, ('T3', 'M4', 'M4b', 'T3b'))):
            k = (zf - T[m_].z) / (T[t].z - T[m_].z)
            T['F%d' % sx_] = T[m_].lerp(T[t], k) - V((0.010 * sx_, 0, 0))
            T['Fb%d' % sx_] = T[mb_].lerp(T[tb], k) - V((0.010 * sx_, 0, 0))
        plates = [
            # front: ten bold plates (2 grey + the chip plate), no seam or rivets on a fold
            ('f_collar_r', ['T0', 'T1', 'G1', 'G0'], 'cream', None),
            ('f_grey_r', ['G0', 'G1', 'B0'], 'grey', None),
            ('f_mid_r', ['G1', 'M2', 'Lc', 'B0'], 'cream', None),
            ('f_v', ['T1', 'T2', 'M2', 'G1'], 'cream', None),
            ('f_chip', ['T2', 'T3', 'M3p', 'M2'], 'cream', None),
            ('f_chip_in', ['M2', 'M3p', 'Lc'], 'cream', None),
            ('f_grey_big', ['Lc', 'M3p', 'Rb', 'Bc'], 'grey', None),
            ('f_outer_l', ['M3p', 'T3', 'M4', 'B3', 'Rb'], 'cream', None),
            ('f_bot_r', ['B0', 'Lc', 'Bc', 'D1', 'D0'], 'cream', None),
            ('f_bot_l', ['Bc', 'Rb', 'B3', 'D2', 'D1'], 'cream', None),
            # sides: closed up to z 1.28 (a 3.5 cm armpit slot under the pauldron)
            ('s_top_r', ['F-1', 'G0', 'M0b', 'Fb-1'], 'cream', None),
            ('s_mid_r', ['G0', 'B0', 'B0b', 'M0b'], 'cream', None),
            ('s_low_r', ['B0', 'D0', 'D0b', 'B0b'], 'cream', None),
            ('s_top_l', ['F1', 'Fb1', 'M4b', 'M4'], 'cream', None),
            ('s_mid_l', ['M4', 'M4b', 'B3b', 'B3'], 'cream', None),
            ('s_low_l', ['B3', 'B3b', 'D2b', 'D2'], 'cream', None),
            # top yoke around the collar opening
            ('t_r', ['T0', 'T1', 'C3', 'T1b', 'T0b'], 'cream', None),
            ('t_l', ['T3b', 'T2b', 'C2', 'T2', 'T3'], 'cream', None),
            ('t_back', ['C3', 'C2', 'T2b', 'T1b'], 'grey', None),
            # back: near-planar quads and triangles only (no degenerate fans)
            ('b_top_r', ['T0b', 'T1b', 'M1b', 'M0b'], 'cream', None),
            ('b_top_c', ['T1b', 'T2b', 'M2b'], 'cream', None),
            ('b_top_cr', ['T1b', 'M2b', 'M1b'], 'grey', None),
            ('b_top_l', ['T2b', 'T3b', 'M4b', 'M3b'], 'cream', None),
            ('b_top_l2', ['T2b', 'M3b', 'M2b'], 'cream', None),
            ('b_mid_r', ['M0b', 'M1b', 'B1b', 'B0b'], 'cream', None),
            ('b_mid_c', ['M1b', 'M2b', 'B2b', 'B1b'], 'cream', None),
            ('b_mid_cl', ['M2b', 'M3b', 'B2b'], 'grey', None),
            ('b_mid_l', ['M3b', 'M4b', 'B3b', 'B2b'], 'cream', None),
            ('b_bot_r', ['B0b', 'B1b', 'D1b', 'D0b'], 'cream', None),
            ('b_bot_l', ['B1b', 'B2b', 'D2b', 'D1b'], 'grey', None),
            ('b_bot_l2', ['B2b', 'B3b', 'D2b'], 'cream', None),
        ]
        for key, names, kind, fan in plates:
            poly = [T[n] for n in names]
            c = sum(poly, V()) / len(poly)
            out = c - tc
            if key.startswith('t_'):
                out = UP
            if key.startswith('s_'):
                out = V((c.x, 0, 0))
            self.plate('torso_' + key, poly, out, kind, 'chest', self.torso_plates, reg='torso', fan=fan)
        # inner core: everything below the collar cavity floor, dark
        used = sorted({nm for _, names, _, _ in plates for nm in names if not nm.startswith('C')})
        core = [T[k] - (T[k] - tc).normalized() * 0.020 for k in used]     # well inside the concave front
        core = [V((p.x, p.y, min(p.z, 1.245))) for p in core]
        mb = MB()
        mb.hull(self.mat['core'], core)
        # upper flank mechanics visible through the open armpits
        for sx in (-1, 1):
            mb.box(self.mat['gun'], V((0.235 * sx, 0.0, 1.255)), (0.06, 0.12, 0.06), bevel=0.004)
            mb.cylinder(self.mat['chrome'], V((0.25 * sx, -0.06, 1.20)), V((0.25 * sx, 0.06, 1.20)), 0.008)
            for k, z in enumerate((1.25, 1.27)):
                mb.cylinder(self.mat['rubber'], V((0.21 * sx, -0.05 + 0.03 * k, z)), V((0.268 * sx, -0.04 + 0.03 * k, z)),
                            0.005)
        self.obj_from('torso_core', mb, 'chest')
        # blue paint chip on the chest plate (character's left, beside the strap)
        self.blue_chip(T)

    def blue_chip(self, T, centre=(0.115, 0.0, 1.250)):
        """Flaked cobalt paint patch (#1F5FA8) just right of the lanyard strap, wholly on the
        chip plate: one ragged, angular flake (about 55 x 30 mm) with a raised lip, ringed by a
        0.5 mm band of bare steel where the cream enamel flaked round it, plus two tiny flakes
        beside it (none below: no drips)."""
        plate = self.parts.get('torso_f_chip')
        if plate is None:
            return
        flat = list(plate['plate_tris'])
        tris = [tuple(V(flat[i + 3 * j:i + 3 * j + 3]) for j in range(3)) for i in range(0, len(flat), 9)]
        n = V(plate['plate_normal'])
        cen = V(centre)
        cen.y = -1.0
        hit = None
        from mathutils.geometry import intersect_ray_tri
        for a_, b_, c_ in tris:
            hit = intersect_ray_tri(a_, b_, c_, V((0, 1, 0)), cen, False)
            if hit is not None:
                break
        if hit is None:
            return
        cen = V(hit)
        ax = V((1, 0, 0))
        ax = (ax - n * ax.dot(n)).normalized()
        ay = n.cross(ax).normalized()
        if ay.z < 0:
            ay = -ay
        poly = [V(plate['plate_poly'][i:i + 3]) for i in range(0, len(plate['plate_poly']), 3)]
        poly2 = [V(((q - cen).dot(ax), (q - cen).dot(ay))) for q in poly]

        def inside(q2, margin):
            k = len(poly2)
            area = sum(poly2[i].x * poly2[(i + 1) % k].y - poly2[(i + 1) % k].x * poly2[i].y for i in range(k))
            sgn = 1.0 if area > 0 else -1.0
            for i in range(k):
                a2, b2 = poly2[i], poly2[(i + 1) % k]
                e = (b2 - a2).normalized()
                nrm_in = V((-e.y, e.x)) * sgn
                if (q2 - a2).dot(nrm_in) < margin:
                    return False
            return True
        import random
        rnd = random.Random(7)
        ph = [rnd.uniform(0, 6.283) for _ in range(6)]

        def outline(c2, sx_, sy_, K, rough):
            out = []
            for i in range(K):
                a = 2 * math.pi * i / K
                r = (1.0 + 0.16 * math.sin(3 * a + ph[0]) + 0.10 * math.sin(5 * a + ph[1]) +
                     0.07 * math.sin(11 * a + ph[2]) + 0.05 * math.sin(23 * a + ph[3]) +
                     rough * (rnd.random() - 0.5))
                # angular, flaked look: snap the radius into short straight runs
                out.append(c2 + V((sx_ * r * math.cos(a), sy_ * r * math.sin(a))))
            return out

        flakes = [outline(V((0, 0)), 0.0275, 0.0150, 96, 0.22)]
        for (fx, fy, fr) in ((0.036, 0.006, 0.0030), (-0.031, 0.011, 0.0022)):
            flakes.append(outline(V((fx, fy)), fr, fr * 0.7, 16, 0.35))
        # keep every flake (and its steel rim) 5 mm inside the plate
        for fl in flakes:
            c2 = sum(fl, V((0, 0))) / len(fl)
            for _ in range(20):
                if all(inside(q + (q - c2).normalized() * 0.001, 0.005) for q in fl):
                    break
                fl[:] = [c2 + (q - c2) * 0.92 for q in fl]
        mb = MB()
        mi = mb.mi(self.mat['chip'])
        mr = mb.mi(self.mat['chip_rim'])
        for fl in flakes:
            c2 = sum(fl, V((0, 0))) / len(fl)
            inner = [c2 + (q - c2) * max(0.0, 1.0 - 0.0009 / max(1e-4, (q - c2).length)) for q in fl]
            outer = [c2 + (q - c2) * (1.0 + 0.0005 / max(1e-4, (q - c2).length)) for q in fl]

            def to3(q2, h):
                p3 = cen + ax * q2.x + ay * q2.y
                p3, nn, _ = _project_to_tris(p3, tris)
                return p3 + nn * h
            R_ = [mb.bm.verts.new(to3(q, 0.00012)) for q in outer]
            O = [mb.bm.verts.new(to3(q, 0.00055)) for q in fl]
            Ib = [mb.bm.verts.new(to3(q, 0.00035)) for q in inner]
            D = [mb.bm.verts.new(to3(q, 0.00012)) for q in fl]
            k = len(fl)
            for i in range(k):
                j = (i + 1) % k
                for f in (mb.bm.faces.new((O[i], O[j], Ib[j], Ib[i])), mb.bm.faces.new((D[i], D[j], O[j], O[i]))):
                    f.material_index = mi
                f = mb.bm.faces.new((R_[i], R_[j], D[j], D[i]))
                f.material_index = mr
            f = mb.bm.faces.new(Ib)
            f.material_index = mi
        bmesh.ops.triangulate(mb.bm, faces=[f for f in mb.bm.faces if len(f.verts) > 4])
        bmesh.ops.recalc_face_normals(mb.bm, faces=mb.bm.faces[:])
        for f in mb.bm.faces:
            f.smooth = False
            f.normal_update()
            if f.normal.dot(n) < -0.5:
                f.normal_flip()
        ob = mb.to_object(f'{self.name}_blue_chip', self.coll, origin=cen)
        ob.parent = plate
        ob.matrix_parent_inverse = Matrix.Translation(plate.location).inverted()
        self.parts['blue_chip'] = ob

    # ================================================================= WAIST / PELVIS
    PELVIS = {
        'PT0': (-0.17, -0.09, 0.90), 'PT1': (-0.055, -0.112, 0.90), 'PT2': (0.055, -0.112, 0.90),
        'PT3': (0.17, -0.09, 0.90),
        'PB0': (-0.100, -0.078, 0.800), 'PBc0': (-0.036, -0.096, 0.790), 'PBc1': (0.036, -0.096, 0.790),
        'PB2': (0.100, -0.078, 0.800),
        'PT0b': (-0.17, 0.09, 0.90), 'PT1b': (-0.06, 0.10, 0.90), 'PT2b': (0.06, 0.10, 0.90), 'PT3b': (0.17, 0.09, 0.90),
        'PB0b': (-0.085, 0.075, 0.795), 'PB1b': (0.0, 0.085, 0.785), 'PB2b': (0.085, 0.075, 0.795),
    }

    def build_pelvis(self):
        T = {k: V(v) for k, v in self.PELVIS.items()}
        pc = V((0, 0, 0.85))
        # front: three plates side by side under one level top seam (cream | grey | cream),
        # the lower edge a shallow V (canon inverted trapezoid 0.34 -> 0.20)
        plates = [
            ('f_r', ['PT0', 'PT1', 'PBc0', 'PB0'], 'cream'), ('f_c', ['PT1', 'PT2', 'PBc1', 'PBc0'], 'grey'),
            ('f_l', ['PT2', 'PT3', 'PB2', 'PBc1'], 'cream'),
            ('s_r', ['PT0', 'PB0', 'PB0b', 'PT0b'], 'cream'), ('s_l', ['PT3', 'PT3b', 'PB2b', 'PB2'], 'cream'),
            ('b_r', ['PT0b', 'PB0b', 'PB1b', 'PT1b'], 'cream'), ('b_c', ['PT1b', 'PB1b', 'PT2b'], 'grey'),
            ('b_l', ['PT2b', 'PB1b', 'PB2b', 'PT3b'], 'cream'),
            ('u', ['PB0', 'PBc0', 'PBc1', 'PB2', 'PB2b', 'PB1b', 'PB0b'], 'dark'),
        ]
        for key, names, kind in plates:
            poly = [T[n] for n in names]
            c = sum(poly, V()) / len(poly)
            out = c - pc if key != 'u' else -UP
            self.plate('pelvis_' + key, poly, out, kind, 'pelvis', reg='pelvis', spacing=0.038)
        m = self.mat
        mb = MB()
        top = [T[k] for k in ('PT0', 'PT1', 'PT2', 'PT3', 'PT3b', 'PT2b', 'PT1b', 'PT0b')]
        mb.prism(m['gun'], [p + V((0, 0, -0.001)) for p in top], UP, 0.006, bevel=0.002)
        core = [T[k] - (T[k] - pc).normalized() * 0.006 for k in T]
        mb.hull(m['core'], core)
        for sx in (-1, 1):
            # hip hubs
            mb.cylinder(m['gun'], V((0.105 * sx, 0, HIP_Z)), V((0.165 * sx, 0, HIP_Z)), 0.045, seg=28)
            mb.torus(m['bronze'], V((0.150 * sx, 0, HIP_Z)), LEFT, 0.045, 0.004, seg=28, seg2=6)
            # servo boxes
            mb.box(m['black'], V((0.10 * sx, -0.055, 0.915)), (0.035, 0.03, 0.025), bevel=0.002)
        # waist spine stub
        mb.cylinder(m['gun'], V((0, 0, 0.885)), V((0, 0, 0.91)), 0.04, seg=24)
        self.obj_from('pelvis_mech', mb, 'pelvis')
        # spine column + discs (spine bone)
        mb = MB()
        mb.cylinder(m['gun'], V((0, 0, 0.89)), V((0, 0, 1.015)), 0.03, seg=24)
        for z in (0.926, 0.951, 0.976):
            mb.cylinder(m['bronze'], V((0, 0, z - 0.006)), V((0, 0, z + 0.006)), 0.0375, seg=28)
        mb.cylinder(m['gun'], V((0, 0, 0.99)), V((0, 0, 1.005)), 0.06, seg=24)
        self.obj_from('waist_spine', mb, 'spine')
        # chest underside plate (dark ring) so the torso reads closed from below
        mb = MB()
        Tt = {k: V(v) for k, v in self.TORSO.items()}
        ring = [Tt[k] for k in ('D0', 'D1', 'D2', 'D2b', 'D1b', 'D0b')]
        mb.prism(m['gun'], [p + V((0, 0, 0.001)) for p in ring], UP, 0.005, bevel=0.0015)
        self.obj_from('chest_floor', mb, 'chest')
        # waist pistons and wiring (pelvis -> chest)
        for sx in (-1, 1):
            s = 'L' if sx > 0 else 'R'
            self.piston(f'waist_piston_{s}', V((0.085 * sx, 0.02, 0.905)), 'pelvis',
                        V((0.095 * sx, 0.02, 0.993)), 'chest', 0.012, 0.0068)
        for sx in (-1, 1):
            s = 'L' if sx > 0 else 'R'
            self.piston(f'waist_rail_{s}', V((0.14 * sx, -0.01, 0.895)), 'pelvis', V((0.15 * sx, -0.01, 0.995)),
                        'chest', 0.0105, 0.007, cyl_mat='gun', ratio=(0.62, 0.6))
            self.piston(f'waist_rail_b_{s}', V((0.12 * sx, 0.06, 0.895)), 'pelvis', V((0.13 * sx, 0.06, 0.995)),
                        'chest', 0.009, 0.0055, ratio=(0.62, 0.6))
        wires = [(-0.07, 'red', 0.0042), (-0.035, 'orange', 0.0036), (0.0, 'copper', 0.0028), (0.03, 'black', 0.0055),
                 (0.065, 'black', 0.0048), (0.095, 'red', 0.0032), (-0.10, 'black', 0.005), (-0.125, 'orange', 0.003),
                 (0.115, 'black', 0.0045), (-0.05, 'black', 0.0062), (0.045, 'copper', 0.0024)]
        for i, (x, mk, r) in enumerate(wires):
            bulge = -0.07 - 0.012 * math.sin(i * 1.7)
            pts = [(V((x * 0.8, -0.052, 0.895)), 'pelvis'), (V((x, bulge + 0.006, 0.915)), 'pelvis'),
                   (V((x * 1.05, bulge, 0.948)), 'spine'), (V((x, bulge + 0.005, 0.978)), 'chest'),
                   (V((x * 0.85, -0.068, 1.008)), 'chest')]
            self.hooked_cable(f'waist_wire_{i}', pts, r, m['black'] if mk == 'black' else m[mk])

    # ================================================================= ARMS
    def arm_frames(self, sx):
        S = V((SHOULDER * sx, 0, SHOULDER_Z))
        d = V((math.sin(ARM_SPLAY) * sx, 0, -math.cos(ARM_SPLAY)))
        E = S + d * UPPER_LEN
        W = E + d * FORE_LEN
        out = V((sx, 0, 0))
        w = (-out - d * d.dot(-out)).normalized()       # palm faces the body
        v = V((0, 1, 0))                                 # index (front) -> pinky (back)
        v = (v - d * d.dot(v) - w * w.dot(v)).normalized()
        return S, E, W, d, out, w, v

    def build_arm(self, sx):
        s = 'L' if sx > 0 else 'R'
        m = self.mat
        S, E, W, d, out, w, v = self.arm_frames(sx)
        f = FWD
        hinge = d.cross(f).normalized()       # elbow / wrist flex axis
        hz = hinge if hinge.dot(out) > 0 else -hinge
        # ---- pauldron (pauldron bone): a faceted cap over the shoulder drum, hanging from the
        # chest's upper outer corner: its apex level with the yoke (z 1.325, within 1 cm of the
        # chest top), the inner face close beside the chest side (covering the armpit slot), the
        # outer face dropping to z ~1.20 at x 0.40 (span / chest ~1.42). It encloses the hub
        # (open only underneath, where the arm leaves) and follows the arm's forward swing about
        # the hub axis (Rig._pauldron_xform), so it reads as a rigid cap on the shoulder, never as
        # an epaulette perched on the yoke. Inside: a grey liner and a gunmetal hinge block.
        PI, PF, PB = 0.2725, -0.090, 0.094     # inner face 3 mm outside the chest's (convex) hull
        pts = [V((PI * sx, PF + 0.004, 1.316)), V((PI * sx, PB - 0.004, 1.316)),            # inner top edge
               V((0.305 * sx, -0.060, 1.325)), V((0.305 * sx, 0.062, 1.325)),               # apex ridge
               V((0.372 * sx, -0.066, 1.300)), V((0.374 * sx, 0.068, 1.298)),               # outer top edge
               V((0.392 * sx, PF + 0.006, 1.262)), V((0.398 * sx, PB - 0.004, 1.232)),      # outer corners
               V((0.404 * sx, 0.004, 1.205)),                                               # outer lower edge
               V((0.335 * sx, PF - 0.008, 1.264)), V((0.335 * sx, PB + 0.006, 1.230)),      # front / back faces
               V((0.281 * sx, PF + 0.006, 1.268)), V((0.281 * sx, PB - 0.006, 1.262))]   # inner lower edge
        hull = Hull(pts)
        self.pauldron_hulls = getattr(self, 'pauldron_hulls', {})
        self.pauldron_hulls[s] = hull
        self.pauldron_pts = getattr(self, 'pauldron_pts', {})
        self.pauldron_pts[s] = [p.copy() for p in pts]
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(2), verts=bm.verts, edges=bm.edges)
        bm.normal_update()
        pc = sum(pts, V()) / len(pts)
        polys = []
        for fc in sorted(bm.faces, key=lambda f_: tuple(round(x, 5) for x in f_.calc_center_median())):
            poly = [vv.co.copy() for vv in fc.verts]
            k0 = min(range(len(poly)), key=lambda i: tuple(round(x, 5) for x in poly[i]))
            poly = poly[k0:] + poly[:k0]
            nn = fc.normal.copy()
            if nn.dot(fc.calc_center_median() - pc) < 0:
                nn = -nn
            polys.append((poly, nn))
        bm.free()
        mb = MB()
        for poly, nn in polys:
            # open underside (faces pointing down toward the arm); the inner face (against the
            # chest side) is plain grey steel, the lower outer facet grey per canon
            if nn.z < -0.45:
                continue
            kind = 'grey' if (nn.z < -0.1 and nn.x * sx > 0.4) else 'cream'
            if nn.x * sx < -0.8:
                kind = 'grey'
            self._plate_into(mb, poly, nn, kind, 'pauldron_' + s, rivet_scale=0.9, spacing=0.04,
                             inner_mat=self.mat['grey'], rivets=nn.x * sx > -0.8)
        # hinge block + strut from the chest seat into the cap (seen from below in S13), a grey
        # underside plate closing the cap behind the hub, and a grey liner under the top facets
        hb = V((0.2815 * sx, 0.0, 1.294))
        mb.box(m['gun_satin'], hb, (0.011, 0.150, 0.036), bevel=0.0025)
        for y_ in (-0.05, 0.05):
            mb.cylinder(m['chrome_satin'], hb + V((0.0, y_, 0.0)) - LEFT * sx * 0.010,
                        hb + V((0.0, y_, 0.0)) + LEFT * sx * 0.010, 0.0065, seg=14)
        under = [V((0.284 * sx, 0.066, 1.262)), V((0.395 * sx, 0.066, 1.214)), V((0.396 * sx, PB - 0.008, 1.231)),
                 V((0.284 * sx, PB - 0.008, 1.264))]
        self._plate_into(mb, under, V((0, 0.2, -1.0)), 'grey', 'pauldron_in_' + s, rivets=False,
                         inner_mat=self.mat['grey'])
        self.obj_from(f'pauldron_{s}', mb, f'pauldron_{s}')
        # ---- shoulder hub (shoulder bone)
        mb = MB()
        mb.cylinder(m['gun'], S - out * 0.022, S + out * 0.025, 0.031, seg=28)
        mb.cylinder(m['chrome_satin'], S + out * 0.025, S + out * 0.031, 0.013, seg=16)
        mb.torus(m['bronze'], S, out, 0.031, 0.003, seg=28, seg2=6)
        self.obj_from(f'shoulder_hub_{s}', mb, f'shoulder_{s}')
        # ---- upper arm (upperarm bone)
        mb = MB()
        rot = frame3(d, f)
        mb.box(m['gun'], S + d * 0.1275, (0.215, 0.035, 0.028), rot=rot, bevel=0.003)
        for k in (-1, 1):
            off = f * 0.028 * k + out * 0.004
            mb.cylinder(m['chrome'], S + d * 0.045 + off, S + d * 0.13 + off, 0.011, seg=16)
            mb.cylinder(m['gun'], S + d * 0.04 + off, S + d * 0.05 + off, 0.0125, seg=16)
            mb.cylinder(m['chrome'], S + d * 0.13 + off, S + d * 0.172 + off, 0.006, seg=12)
            mb.cylinder(m['gun'], S + d * 0.168 + off, S + d * 0.18 + off, 0.009, seg=12)
        # three ROUND cables (black 8.4 mm, red 5.6 mm, copper 5 mm) loosely twisted down the
        # inner back of the arm between two clamps, each end plugged into a rubber grommet on a
        # block bolted to the bar (they never end in mid-air beside the elbow)
        ax0 = S + (-f) * 0.046 + out * 0.012
        cab = (('black', 0.0042, 0.0), ('red', 0.0028, 2.2), ('copper', 0.0025, 4.2))
        t0_, t1_ = 0.04, 0.205
        for mk, r, ph0 in cab:
            path = []
            for i in range(17):
                t = i / 16
                ang = ph0 + t * math.pi * 1.1
                rad = 0.0075 * (0.35 + 0.65 * math.sin(math.pi * min(1.0, t * 1.25)) ** 0.5) + 0.002 * math.sin(math.pi * t)
                sag = 0.008 * math.sin(math.pi * t)
                q = ax0 + d * (t0_ + (t1_ - t0_) * t) + (out * math.cos(ang) + (-f) * math.sin(ang)) * rad + (-f) * sag
                path.append(q)
            mb.sweep(m['black'] if mk == 'black' else m[mk], path, circle_profile(r, 12))
        for t in (0.35, 0.72):
            c = ax0 + d * (t0_ + (t1_ - t0_) * t) + (-f) * (0.008 * math.sin(math.pi * t))
            mb.cylinder(m['gun'], c - d * 0.0045, c + d * 0.0045, 0.0135, seg=14)
        for tz, sgn in ((t0_, -1.0), (t1_, 1.0)):
            gc = ax0 + d * tz
            mb.cylinder(m['rubber'], gc - d * 0.006 * sgn, gc + d * 0.004 * sgn, 0.0118, seg=16)     # grommet
            mb.box(m['gun_satin'], S + d * (tz + 0.007 * sgn) + (-f) * 0.034 + out * 0.006, (0.024, 0.030, 0.026),
                   rot=frame3(d, f), bevel=0.002)                                                     # block on the bar
        # canon cream plate on the outer upper arm (0.07 x 0.09) and a smaller one on its front
        pc = S + d * 0.085 + out * 0.024
        a1 = d * 0.045
        a2 = f * 0.035
        poly = [pc - a1 - a2, pc - a1 + a2, pc + a1 + a2 * 0.8, pc + a1 - a2 * 0.8]
        self._plate_into(mb, poly, out, 'cream', 'uarm_' + s, rivet_scale=0.8, spacing=0.04)
        pf = S + d * 0.11 + f * 0.043
        b1 = d * 0.04
        b2 = out * 0.022
        poly = [pf - b1 - b2, pf - b1 + b2 * 1.1, pf + b1 + b2 * 0.9, pf + b1 - b2]
        self._plate_into(mb, poly, f, 'cream', 'uarm_' + s, rivet_scale=0.75, spacing=0.04)
        mb.box(m['gun'], pf - f * 0.006, (0.07, 0.05, 0.008), rot=frame3(d, out), bevel=0.0015)
        # bracket for the outer elbow piston
        mb.box(m['gun'], S + d * 0.122 + hz * 0.040, (0.014, 0.03, 0.03), rot=frame3(d, hz), bevel=0.002)
        # elbow hub: a compact satin-machined drum (52 mm, 42 mm wide) with turned, light-catching
        # chamfers and a broad satin axle cap; it sits behind the bicep piston and the forearm's
        # clevis plates cover its lower half, so it never reads as a dark wheel
        prof = [(0.0, -0.021), (0.0205, -0.021), (0.0240, -0.0185), (0.0256, -0.0145), (0.0260, -0.006),
                (0.0260, 0.006), (0.0256, 0.0145), (0.0240, 0.0185), (0.0205, 0.021), (0.0, 0.021)]
        mb.lathe(m['gun_satin'], prof, E, hinge, seg=36, smooth=True)
        e1 = hinge.orthogonal().normalized()
        e2 = hinge.cross(e1)
        for k in (-1, 1):
            mb.cylinder(m['chrome_satin'], E + hinge * 0.0205 * k, E + hinge * 0.0232 * k, 0.0120, 0.0112, seg=24)
            for i in range(4):
                a_ = math.pi / 2 * i + 0.4
                bp = E + hinge * 0.0208 * k + (e1 * math.cos(a_) + e2 * math.sin(a_)) * 0.0165
                mb.cylinder(m['rivet'], bp, bp + hinge * 0.0014 * k, 0.0017, seg=6, smooth=False)
        self.obj_from(f'upperarm_{s}', mb, f'upperarm_{s}')
        # bicep piston (upper arm -> forearm)
        hz = hinge if hinge.dot(out) > 0 else -hinge
        self.piston3(f'bicep_{s}', S + d * 0.13 + hz * 0.046 - f * 0.016, f'upperarm_{s}',
                     E + d * 0.12 + hz * 0.042 - f * 0.012,
                     f'forearm_{s}', 0.0085, 0.0045, stage=0.34)
        # ---- forearm shell (forearm bone): a slim 8-sided cream shell, 60 mm across at the elbow
        # tapering to 48 mm at the wrist (about half the cup's width, as in the reference), a grey
        # inlay on the top (front) facet, a dark vent slot on the outer facet and the inner facet
        # open over two chrome rods; two cream clevis plates cover the lower half of the elbow hub,
        # and a 14 mm black band rings the wrist end
        mb = MB()
        a0 = E + d * 0.040
        a1_ = W - d * 0.030
        sides = 8
        RA, RB = 0.030, 0.024
        ringA, ringB = [], []
        for i in range(sides):
            ang = 2 * math.pi * (i - 0.5) / sides            # facet i is centred on angle i * 45 deg
            dirv = out * math.cos(ang) + f * math.sin(ang)
            ringA.append(a0 + dirv * RA / math.cos(math.pi / sides))
            ringB.append(a1_ + dirv * RB / math.cos(math.pi / sides))
        for i in range(sides):
            j = (i + 1) % sides
            ang = 2 * math.pi * i / sides
            nn = (out * math.cos(ang) + f * math.sin(ang)).normalized()
            if i == 4:
                continue                                   # inner facet open (chrome rods show)
            poly = [ringA[i], ringA[j], ringB[j], ringB[i]]
            self._plate_into(mb, poly, nn, 'cream', 'farm_' + s, rivet_scale=0.65, spacing=0.07, gap=0.0011)
            fc = sum(poly, V()) / 4
            along = (ringB[i] + ringB[j] - ringA[i] - ringA[j]).normalized()
            if i == 2:                                     # grey inlay, inset 4.5 mm from the facet edges
                inl = inset_poly([q + nn * 0.0004 for q in poly], nn, 0.0045)
                self._plate_into(mb, inl, nn, 'grey', 'farm_in_' + s, rivets=False, recess=-0.0006, thick=0.0012)
            if i == 0:                                     # vent slot
                vc = fc + nn * 0.0016 - along * 0.012
                mb.box(m['black'], vc, (0.056, 0.009, 0.0022), rot=frame3(along, ringA[j] - ringA[i]), bevel=0.0008)
        # clevis plates over the forearm side of the elbow hub, past its axle (they turn with the forearm)
        for k in (-1, 1):
            nk = hinge * k
            off = nk * 0.0240
            tab = [(0.046, -0.024), (0.046, 0.024), (0.008, 0.026), (-0.004, 0.020), (-0.010, 0.008), (-0.010, -0.008),
                   (-0.004, -0.020), (0.008, -0.026)]                   # covers ~2/3 of the drum face
            poly = [E + off + d * a_ + f * b_ for a_, b_ in tab]
            self._plate_into(mb, poly, nk, 'cream', 'farm_' + s, rivet_scale=0.6, spacing=0.05, gap=0.0011)
        # inner rods and core
        mb.cylinder(m['core'], a0, a1_, 0.016, seg=12)
        for k in (-1, 1):
            mb.cylinder(m['chrome'], a0 - out * 0.017 + f * 0.010 * k, a1_ - out * 0.013 + f * 0.008 * k, 0.0040, seg=10)
        # wrist band (canon black band 14 mm wide at the wrist end)
        bandA, bandB = W - d * 0.044, W - d * 0.030
        mb.cylinder(m['rubber'], bandA, bandB, 0.0270, 0.0265, seg=8)
        mb.cylinder(m['gun'], W - d * 0.031, W - d * 0.014, 0.0155, seg=12)
        mb.box(m['gun'], E + d * 0.127 + hz * 0.036, (0.012, 0.026, 0.024), rot=frame3(d, hz), bevel=0.002)
        self.obj_from(f'forearm_{s}', mb, f'forearm_{s}')
        # ---- hand
        self.build_hand(sx, W, d, w, v)

    def hand_layout(self, sx, W, u, w, v):
        """Knuckle positions, finger directions and thumb chain at rest."""
        fingers = {}
        for name, (lens, voff, uoff, splay) in FINGERS.items():
            K = W + u * uoff + v * voff + w * 0.001
            dirn = (u * math.cos(math.radians(splay)) + v * math.sin(math.radians(splay))).normalized()
            pts = [K]
            for L in lens:
                pts.append(pts[-1] + dirn * L)
            fingers[name] = dict(K=K, dir=dirn, pts=pts, lens=lens)
        T0 = W + u * 0.037 + v * (-0.031) + w * 0.010
        d0 = (u * 0.55 + v * (-0.5) + w * 0.67).normalized()
        T1 = T0 + d0 * 0.036
        d1 = (u * 0.80 + v * (-0.22) + w * 0.55).normalized()
        T2 = T1 + d1 * 0.035
        T3 = T2 + d1 * 0.028
        thumb = dict(pts=[T0, T1, T2, T3], d0=d0, d1=d1)
        return fingers, thumb

    def build_hand(self, sx, W, u, w, v):
        s = 'L' if sx > 0 else 'R'
        m = self.mat
        fingers, thumb = self.hand_layout(sx, W, u, w, v)
        self.hands = getattr(self, 'hands', {})
        self.hands[s] = dict(W=W, u=u, w=w, v=v, fingers=fingers, thumb=thumb)
        # wrist hub + palm (hand bone)
        mb = MB()
        hinge = v
        mb.sphere(m['gun'], W, 0.0215, seg=24, rings=12)
        mb.torus(m['chrome'], W, w, 0.0215, 0.0022, seg=32, seg2=8)
        rot = frame3(u, v)
        palm = []
        for uu, hv in ((0.026, 0.026), (0.05, 0.0415), (0.091, 0.0415)):
            for vv in (-hv, hv):
                for ww in (-0.0145, 0.0125):
                    palm.append(W + u * uu + v * vv + w * ww)
        mb.hull(m['gun'], palm)
        mb.box(m['gun'], W + u * 0.016 - w * 0.001, (0.026, 0.034, 0.02), rot=rot, bevel=0.003)
        # back-of-hand cream plate (canon ~0.08 x 0.07) and two cheek plates that wrap the
        # palm's sides, so the hand reads cream (not a black hinge block) from the side
        bc = W + u * 0.062 - w * 0.0158
        poly = [bc - u * 0.034 - v * 0.034, bc + u * 0.032 - v * 0.043, bc + u * 0.035 + v * 0.043,
                bc - u * 0.030 + v * 0.032]
        self._plate_into(mb, poly, -w, 'cream', 'hand_' + s, rivet_scale=0.7, spacing=0.034, gap=0.001)
        for sv in (-1, 1):
            cc = W + v * (0.0446 * sv)
            poly = [cc + u * 0.034 - w * 0.0150, cc + u * 0.088 - w * 0.0150, cc + u * 0.086 + w * 0.0045,
                    cc + u * 0.040 + w * 0.0035]
            self._plate_into(mb, poly, v * sv, 'cream', 'hand_' + s, rivets=False, gap=0.001)
        # knuckle hubs (canon: dia 0.020, width 0.017)
        for name, fd in fingers.items():
            K = fd['K']
            mb.cylinder(m['rubber'], K - v * 0.0085, K + v * 0.0085, 0.0100, seg=18)
        # thumb base housing
        T0 = thumb['pts'][0]
        mb.sphere(m['gun'], T0, 0.0105, seg=14, rings=8)
        self.obj_from(f'palm_{s}', mb, f'hand_{s}')
        # fingers: one object per segment
        for name, fd in fingers.items():
            pts = fd['pts']
            dirn = fd['dir']
            for i in range(3):
                a, b = pts[i], pts[i + 1]
                mb = MB()
                r0 = FINGER_R - 0.00045 * i
                r1 = r0 - 0.0004
                start = a + dirn * (0.0068 if i == 0 else 0.0034)
                end = b - dirn * 0.0034 if i < 2 else b
                self.finger_segment(mb, start, end, r0, r1, w, last=(i == 2))
                if i > 0:
                    # joint band (canon 6-7 mm wide, ~1 mm proud) centred on the joint
                    mb.cylinder(m['rubber'], a - dirn * 0.0032, a + dirn * 0.0032, r0 + 0.0010, seg=20)
                self.obj_from(f'{name}_{i + 1}_{s}', mb, f'{name}_{i + 1}_{s}')
        # thumb: metacarpal (dark) + two cream segments
        T0, T1, T2, T3 = thumb['pts']
        mb = MB()
        mb.cylinder(m['gun'], T0, T1 - thumb['d0'] * 0.002, 0.0095, 0.0085, seg=12)
        self.obj_from(f'thumb_0_{s}', mb, f'thumb_0_{s}')
        mb = MB()
        d1 = thumb['d1']
        mb.cylinder(m['rubber'], T1 - d1 * 0.004, T1 + d1 * 0.004, 0.0105, seg=16)
        self.finger_segment(mb, T1 + d1 * 0.004, T2 - d1 * 0.0036, 0.0090, 0.0086, w, last=False)
        self.obj_from(f'thumb_1_{s}', mb, f'thumb_1_{s}')
        mb = MB()
        mb.cylinder(m['rubber'], T2 - d1 * 0.0034, T2 + d1 * 0.0034, 0.0102, seg=16)
        self.finger_segment(mb, T2 + d1 * 0.0036, T3, 0.0086, 0.0080, w, last=True)
        self.obj_from(f'thumb_2_{s}', mb, f'thumb_2_{s}')

    def finger_segment(self, mb, a, b, r0, r1, w, last=False):
        """Cream segment with a rounded-square, slightly flattened section (aspect 0.85, crisp
        chamfered corners) and chamfered ends; bronze rounded tip cap if last."""
        m = self.mat
        d = (b - a)
        L = d.length
        d.normalize()
        flat = 0.90
        seg = 20
        x = (w - d * d.dot(w)).normalized()   # flattened toward the palm normal
        y = d.cross(x)
        prof = []
        for k in range(seg):
            t = 2 * math.pi * (k + 0.5) / seg
            c_, s_ = math.cos(t), math.sin(t)
            e = 2.0 / 2.6                     # superellipse exponent 2.6: a softly squared round
            prof.append((math.copysign(abs(c_) ** e, c_), math.copysign(abs(s_) ** e, s_)))

        def ring(c, r):
            return [c + x * (px * r * flat) + y * (py * r) for px, py in prof]

        def ring_round(c, r):
            return [c + (x * math.cos(2 * math.pi * (k + 0.5) / seg) * r * flat +
                         y * math.sin(2 * math.pi * (k + 0.5) / seg) * r) for k in range(seg)]

        tipL = 0.0085 if last else 0.0
        bodyL = L - tipL
        rings = [(0.0, r0 * 0.70, False), (0.0012, r0 * 0.94, False), (0.0024, r0, True),
                 ((bodyL - 0.0024) if not last else bodyL - 0.0004, r1, True)]
        if not last:
            rings += [(bodyL - 0.0012, r1 * 0.94, False), (bodyL, r1 * 0.70, False)]
        before = set(mb.bm.faces)
        vr = []
        for t, r, sq in rings:
            vr.append([mb.bm.verts.new(p) for p in (ring(a + d * t, r) if sq else ring_round(a + d * t, r))])
        for k in range(len(vr) - 1):
            for i in range(seg):
                j = (i + 1) % seg
                mb.bm.faces.new((vr[k][i], vr[k][j], vr[k + 1][j], vr[k + 1][i]))
        mb.bm.faces.new(list(reversed(vr[0])))
        if not last:
            mb.bm.faces.new(vr[-1])
        mb._tag(before, m['finger'], True)
        if last:
            before = set(mb.bm.faces)
            prof_t = [(r1, 0.0), (r1 * 0.98, 0.0035), (r1 * 0.88, 0.0062), (r1 * 0.62, 0.0080), (r1 * 0.3, 0.0088),
                      (0.0, 0.0090)]
            ringsT = []
            for rr, t in prof_t:
                if rr < 1e-6:
                    ringsT.append([mb.bm.verts.new(a + d * (bodyL + t))])
                else:
                    ringsT.append([mb.bm.verts.new(p) for p in ring_round(a + d * (bodyL + t), rr)])
            for k in range(len(ringsT) - 1):
                A, B = ringsT[k], ringsT[k + 1]
                for i in range(seg):
                    j = (i + 1) % seg
                    if len(B) == 1:
                        mb.bm.faces.new((A[i], A[j], B[0]))
                    else:
                        mb.bm.faces.new((A[i], A[j], B[j], B[i]))
            mb.bm.faces.new(list(reversed(ringsT[0])))
            mb._tag(before, m['tip'], True)
        bmesh.ops.recalc_face_normals(mb.bm, faces=mb.bm.faces[:])

    # ================================================================= LEGS
    def build_leg(self, sx):
        s = 'L' if sx > 0 else 'R'
        m = self.mat
        X = HIP_X * sx
        Hp = V((X, 0, HIP_Z))
        K = V((X, 0, KNEE_Z))
        A = V((X, 0, ANKLE_Z))
        out = V((sx, 0, 0))
        # ---- thigh
        mb = MB()
        mb.cylinder(m['gun'], V((0.055 * sx, 0, HIP_Z)), V((0.09 * sx, 0, HIP_Z)), 0.026, seg=24)
        mb.box(m['gun'], V((0.175 * sx, 0, 0.808)), (0.013, 0.066, 0.12), bevel=0.003)
        mb.cylinder(m['chrome'], V((0.168 * sx, 0, HIP_Z)), V((0.186 * sx, 0, HIP_Z)), 0.017, seg=16)
        # faceted thigh (team-master): the front is five triangular plates on diagonal seams that
        # zig-zag down a ridge (>= 15 deg between neighbouring facets), with a grey triangle insert
        # on the outer front face; the shell tapers from 0.18 at the hip to 0.12 at the knee
        rings = [(0.775, [(-0.078, -0.062), (-0.010, -0.094), (0.096, -0.052), (0.088, 0.058), (0.0, 0.070),
                          (-0.082, 0.050)]),
                 (0.655, [(0.034, -0.090)]),
                 (0.540, [(-0.054, -0.044), (0.002, -0.068), (0.064, -0.034), (0.058, 0.040), (0.0, 0.052),
                          (-0.056, 0.036)])]
        fp = lambda r, i: (r, i)
        self.facet_shell(mb, sx, X, rings, [
            ([fp(0, 0), fp(0, 1), fp(1, 0), fp(2, 0)], 'cream'),
            ([fp(2, 0), fp(1, 0), fp(2, 1)], 'cream'),
            ([fp(0, 1), fp(0, 2), fp(1, 0)], 'cream'),
            ([fp(0, 2), fp(2, 2), fp(1, 0)], 'grey'),
            ([fp(1, 0), fp(2, 2), fp(2, 1)], 'cream'),
            ([fp(0, 2), fp(0, 3), fp(2, 3), fp(2, 2)], 'cream'),
            ([fp(0, 3), fp(0, 4), fp(2, 4), fp(2, 3)], 'cream'),
            ([fp(0, 4), fp(0, 5), fp(2, 5), fp(2, 4)], 'grey'),
            ([fp(0, 5), fp(0, 0), fp(2, 0), fp(2, 5)], 'cream'),
        ], 'thigh_' + s)
        mb.cylinder(m['gun'], V((X, 0, 0.543)), V((X, 0, 0.505)), 0.04, 0.036, seg=16)
        self.obj_from(f'thigh_{s}', mb, f'thigh_{s}')
        # hamstring piston: thigh -> shin
        self.piston3(f'hamstring_{s}', V((X - 0.02 * sx, 0.088, 0.66)), f'thigh_{s}',
                     V((X - 0.02 * sx, 0.07, 0.40)), f'shin_{s}', 0.011, 0.006)
        # ---- knee hub (thigh) and kneecap (shin)
        mb = MB()
        mb.cylinder(m['gun'], K - out * 0.048, K + out * 0.048, 0.04, seg=28)
        for k in (-1, 1):
            mb.cylinder(m['chrome'], K + out * 0.048 * k, K + out * 0.054 * k, 0.015, seg=16)
        self.obj_from(f'knee_{s}', mb, f'thigh_{s}')
        mb = MB()
        kc = K + V((0, -0.052, 0.0))
        kp = [kc + V((-0.05, 0.012, 0.045)), kc + V((0.05, 0.012, 0.045)), kc + V((0.05, 0.012, -0.045)),
              kc + V((-0.05, 0.012, -0.045)), kc + V((0, -0.016, 0.006)), kc + V((-0.03, -0.008, 0.03)),
              kc + V((0.03, -0.008, 0.03)), kc + V((0.03, -0.006, -0.03)), kc + V((-0.03, -0.006, -0.03))]
        self.hull_plates(mb, kp, 'knee_' + s, grey_pick=lambda nn: nn.z < -0.5)
        self.obj_from(f'kneecap_{s}', mb, f'shin_{s}')
        # ---- shin
        mb = MB()
        # shin: triangular front plates on a diagonal ridge, a grey triangle on the inner front;
        # the kneecap overlaps its top
        rings = [(0.432, [(-0.062, -0.022), (0.006, -0.068), (0.066, -0.020), (0.050, 0.052), (-0.050, 0.052)]),
                 (0.290, [(-0.018, -0.063)]),
                 (0.142, [(-0.046, -0.016), (0.004, -0.050), (0.046, -0.014), (0.036, 0.040), (-0.036, 0.040)])]
        fp = lambda r, i: (r, i)
        self.facet_shell(mb, sx, X, rings, [
            ([fp(0, 0), fp(0, 1), fp(1, 0)], 'cream'),
            ([fp(0, 1), fp(0, 2), fp(2, 2), fp(1, 0)], 'cream'),
            ([fp(0, 0), fp(1, 0), fp(2, 0)], 'grey'),
            ([fp(1, 0), fp(2, 2), fp(2, 1), fp(2, 0)], 'cream'),
            ([fp(0, 2), fp(0, 3), fp(2, 3), fp(2, 2)], 'cream'),
            ([fp(0, 3), fp(0, 4), fp(2, 4), fp(2, 3)], 'cream'),
            ([fp(0, 4), fp(0, 0), fp(2, 0), fp(2, 4)], 'cream'),
        ], 'shin_' + s)
        mb.cylinder(m['gun'], V((X, 0, 0.46)), V((X, 0, 0.425)), 0.03, seg=16)
        mb.cylinder(m['gun'], V((X, 0, 0.14)), V((X, 0, 0.105)), 0.03, 0.026, seg=16)
        # ankle hub
        mb.cylinder(m['gun'], A - out * 0.04, A + out * 0.04, 0.03, seg=24)
        for k in (-1, 1):
            mb.cylinder(m['chrome'], A + out * 0.04 * k, A + out * 0.045 * k, 0.012, seg=16)
        self.obj_from(f'shin_{s}', mb, f'shin_{s}')
        self.piston(f'achilles_{s}', V((X, 0.07, 0.27)), f'shin_{s}', V((X, 0.088, 0.055)), f'foot_{s}',
                    0.0075, 0.0045)
        # ---- foot
        mb = MB()
        sole = [V((X - 0.055, 0.075, 0.0)), V((X + 0.055, 0.075, 0.0)), V((X + 0.056, -0.15, 0.0)),
                V((X + 0.04, -0.185, 0.0)), V((X - 0.04, -0.185, 0.0)), V((X - 0.056, -0.15, 0.0))]
        mb.prism(m['rubber'], [p + V((0, 0, 0.015)) for p in sole], UP, 0.015, bevel=0.002)
        mb.box(m['gun'], V((X, 0.083, 0.055)), (0.03, 0.022, 0.03), bevel=0.002)
        fp = [V((X - 0.054, 0.072, 0.015)), V((X + 0.054, 0.072, 0.015)), V((X + 0.055, -0.148, 0.015)),
              V((X + 0.039, -0.182, 0.015)), V((X - 0.039, -0.182, 0.015)), V((X - 0.055, -0.148, 0.015)),
              V((X - 0.046, 0.055, 0.07)), V((X + 0.046, 0.055, 0.07)), V((X - 0.042, -0.04, 0.062)),
              V((X + 0.042, -0.04, 0.062)), V((X - 0.034, -0.16, 0.038)), V((X + 0.034, -0.16, 0.038)),
              V((X, -0.11, 0.056))]
        self.hull_plates(mb, fp, 'foot_' + s, grey_pick=lambda nn: abs(nn.x) > 0.8 and nn.y < 0, skip_down=True)
        self.obj_from(f'foot_{s}', mb, f'foot_{s}')

    def facet_shell(self, mb, sx, X, rings, plates, reg, cap_top=True, cap_bot=True):
        """Faceted limb shell from explicit plates. rings: [(z, [(x_out, y), ...])] (x_out > 0 =
        away from the body); plates: [([(ring, index), ...], kind)]. A dark core hull fills the
        inside and recessed machined caps close both ends."""
        m = self.mat
        P = [[V((X + px * sx, py, z)) for px, py in pts] for z, pts in rings]
        axis = lambda z: V((X, 0.004, z))
        for idx, kind in plates:
            poly = [P[r][i] for r, i in idx]
            c = sum(poly, V()) / len(poly)
            out = c - axis(c.z)
            out.z = 0.0
            self._plate_into(mb, poly, out, kind, reg, rivet_scale=0.8, spacing=0.045)
        core = []                                          # top and bottom rings only, well inside: the
        for ring in (P[0], P[-1]):                         # zig-zag ridge makes the shell locally concave
            for p in ring:
                core.append(p + (axis(p.z) - p).normalized() * 0.014)
        mb.hull(m['core'], core)
        for ring, sgn, ok in ((P[0], -1.0, cap_top), (P[-1], 1.0, cap_bot)):
            if not ok:
                continue
            cc = sum(ring, V()) / len(ring)
            cap = [cc + (q - cc) * 0.86 + V((0, 0, 0.009 * sgn)) for q in ring]
            nrm = V((0, 0, -sgn))
            if newell(cap).dot(nrm) < 0:
                cap.reverse()
            mb.prism(m['gun'], cap, nrm, 0.004, bevel=0.0012)
            mb.cylinder(m['gun'], cc + V((0, 0, 0.009 * sgn)), cc - nrm * 0.012 + V((0, 0, 0.009 * sgn)), 0.022,
                        seg=20)

    def hull_plates(self, mb, pts, reg, grey_pick=lambda n: False, skip_down=False):
        m = self.mat
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(2), verts=bm.verts, edges=bm.edges)
        bm.normal_update()
        pc = sum(pts, V()) / len(pts)
        polys = []
        for fc in sorted(bm.faces, key=lambda f_: tuple(round(x, 5) for x in f_.calc_center_median())):
            nn = fc.normal.copy()
            if nn.dot(fc.calc_center_median() - pc) < 0:
                nn = -nn
            vs_ = [v_.co.copy() for v_ in fc.verts]
            k0 = min(range(len(vs_)), key=lambda i: tuple(round(x, 5) for x in vs_[i]))
            polys.append((vs_[k0:] + vs_[:k0], nn))
        bm.free()
        for poly, nn in polys:
            if skip_down and nn.z < -0.9:
                continue
            kind = 'grey' if grey_pick(nn) else 'cream'
            self._plate_into(mb, poly, nn, kind, reg, rivet_scale=0.75, spacing=0.04, gap=0.001)
        mb.hull(m['core'], [p + (pc - p).normalized() * 0.004 for p in pts])

    # ================================================================= CUP
    def build_cup(self):
        """The hero cup + lid from props.cup_and_lid(hero=True): a separate polystyrene lid with
        an overhang shadow line and a real 15 x 5 mm rounded-oblong sip slot. Its root empty
        (origin = cup base centre, +Z up, slot toward +Y) is the rig's cup object, driven by the
        hands' Child Of constraints; body, lid, coffee, the amber slot glow and the `slot` empty
        are its children (rig.cup_objects() lists them)."""
        handle = PR.cup_and_lid(f'{self.name}_cup', self.coll, (0, 0, 0), 0.0, hero=True)
        root = handle.root
        root.name = f'{self.name}_cup'
        self.cup_handle = handle
        self.parts['cup'] = root
        self.parts['cup_slot'] = handle.slot
        self.parts['cup_glow'] = handle.glow
        # hero finish: the lid gets its own #ECE9E3 polystyrene (ring shading survives the top
        # light), and a dark stadium well under the slot so the slot reads as a real opening
        # from outside (S01/S02 match cut); the amber glow sits inside the well
        lid = handle.parts.get('lid')
        if lid is not None and lid.data.materials:
            lid.data.materials[0] = self.mat['hero_lid']
        sz = PR._lid_z(PR.CUP['slot_r'], PR.CUP['slot_theta'])
        L_, W_ = PR.CUP['slot_len'] + 0.0010, PR.CUP['slot_w'] + 0.0010
        z0, z1 = -0.0050, -0.0020                  # top hidden inside the lid shell, floor 5 mm down
        bm = bmesh.new()
        outline = PR.stadium(L_, W_, 16)
        lo = [bm.verts.new((x, y, z0)) for x, y in outline]
        hi = [bm.verts.new((x, y, z1)) for x, y in outline]
        k = len(outline)
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        bm.faces.new(lo)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for f_ in bm.faces:                        # normals point into the well (seen from above)
            f_.normal_update()
            cen = f_.calc_center_median()
            if f_.normal.dot(V((0, 0, 1)) if len(f_.verts) > 4 else -V((cen.x, cen.y, 0))) < 0:
                f_.normal_flip()
        me = bpy.data.meshes.new(f'{self.name}_cup_well')
        bm.to_mesh(me)
        bm.free()
        me.materials.append(self.mat['well'])
        well = bpy.data.objects.new(f'{self.name}_cup_well', me)
        self.coll.objects.link(well)
        well.parent = root
        well.location = (handle.slot.location.x, handle.slot.location.y, sz)
        well.rotation_euler = handle.slot.rotation_euler.copy()
        well.visible_shadow = False
        self.parts['cup_well'] = well
        g = handle.glow
        g.location.z = sz - 0.0040
        if g.data.materials:
            g.data.materials[0] = self.mat['slot_glow']
        self.parts['cup_lip'] = self._slot_lip(root)
        return root

    def _slot_lip(self, root):
        """Moulded rim of the sip slot (an overlay on props' lid, which stays read-only): a 0.6 mm
        rolled lip standing on the spout round the slot and a drafted inner wall (~2.6 mm deep,
        0.6 mm draft) that catches the key on the far side, so at 100 mm the slot reads as a
        moulded opening with wall thickness, not a painted stadium. Bent round the lid like the
        slot itself (slot-local t along the slot, n radial)."""
        rs, ths = PR.CUP['slot_r'], PR.CUP['slot_theta']
        st = [V(q) for q in PR.resample_closed(PR.stadium(PR.CUP['slot_len'], PR.CUP['slot_w'], 24), 96)]
        k = len(st)
        prof = [(0.0010, -0.00012), (0.0008, 0.00022), (0.0005, 0.00042), (0.0002, 0.00034), (0.0000, 0.00004),
                (-0.0001, -0.00030), (-0.0003, -0.00080), (-0.0005, -0.00140), (-0.0006, -0.00200),
                (-0.0006, -0.00260)]

        def to3(tn, dz):
            r = rs + tn.y
            th = ths + tn.x / rs
            return V((r * math.cos(th), r * math.sin(th), PR._lid_z(r, th) + dz))
        bm = bmesh.new()
        rings = []
        for off, dz in prof:
            ring = []
            for i in range(k):
                tg = (st[(i + 1) % k] - st[i - 1]).normalized()
                mo = V((tg.y, -tg.x))
                if mo.dot(st[i]) < 0:
                    mo = -mo
                ring.append(bm.verts.new(to3(st[i] + mo * off, dz)))
            rings.append(ring)
        for a_, b_ in zip(rings, rings[1:]):
            for i in range(k):
                j = (i + 1) % k
                f_ = bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
                f_.smooth = True
        bm.normal_update()
        top = [f_ for f_ in bm.faces if any(v in rings[1] for v in f_.verts) and any(v in rings[2] for v in f_.verts)]
        if sum(f_.normal.z for f_ in top) < 0:      # consistent winding: one check orients them all (lip up)
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(f'{self.name}_cup_lip')
        bm.to_mesh(me)
        bm.free()
        me.materials.append(self.mat['hero_lid'])
        ob = bpy.data.objects.new(f'{self.name}_cup_lip', me)
        self.coll.objects.link(ob)
        ob.parent = root
        return ob

    # ================================================================= LANYARD + BADGE
    def build_lanyard(self):
        m = self.mat
        hull = self.torso_hull
        Vp = V((0.0, -0.186, 1.141))
        self.badge_pivot = Vp
        # the straps rise out of the dark collar cavity (they loop round the neck down inside it,
        # canon), fold over the yoke's front lip and run down the chest to the clip
        seqs = []
        for sx in (-1, 1):
            cav = [V((0.100 * sx, -0.126, 1.282)), V((0.101 * sx, -0.130, 1.300)), V((0.102 * sx, -0.1335, 1.3150)),
                   V((0.103 * sx, -0.1395, 1.3228)), V((0.103 * sx, -0.1440, 1.3170))]
            down = [V((0.103 * sx, -0.1440, 1.3170)).lerp(Vp + V((0.007 * sx, 0, 0.004)), t)
                    for t in [i / 10 for i in range(1, 11)]]
            down = [hull.push(p, 0.0022) for p in down]
            seqs.append(cav + down)
        path = seqs[0] + list(reversed(seqs[1]))
        pts = spline_pts(path, 3)
        # normals (the strap's face): +Y against the lip's inner face, up over the lip, the torso's
        # outward normal down the chest
        nrm = []
        for p in pts:
            if p.z > 1.3205:
                nrm.append(UP.copy())
            elif p.y > -0.1375:
                nrm.append(V((0.0, 1.0, 0.0)))
            else:
                best = max(hull.planes, key=lambda nd: nd[0].dot(p) - nd[1])
                nrm.append(best[0])
        # the strap lies flat: profile x across the width, y along the surface normal
        prof = [(-0.010, -0.00075), (0.010, -0.00075), (0.010, 0.00075), (-0.010, 0.00075)]
        mb = MB()
        mb.sweep(m['strap'], pts, prof, normals=nrm, uv=True)
        self.obj_from('lanyard', mb, 'chest')
        # crimp, swivel + lobster clip, frosted strap clip, sleeve and card (badge bone).
        # Every link touches the next (no visible gap); card centre z ~1.045, bottom 15 mm
        # above the breastplate's lower edge.
        mb = MB()
        mb.box(m['black'], Vp + V((0, 0, -0.0055)), (0.012, 0.006, 0.015), bevel=0.0015)
        z = Vp.z - 0.013
        mb.cylinder(m['clip'], V((0, Vp.y, z + 0.001)), V((0, Vp.y, z - 0.004)), 0.0028, seg=12)       # swivel
        mb.torus(m['clip'], V((0, Vp.y, z - 0.0065)), V((0, 1, 0)), 0.0028, 0.0009, seg=20, seg2=6)   # eye
        lob_c = V((0, Vp.y - 0.0004, z - 0.0149))      # body top meets the swivel eye (no gap)
        mb.sphere(m['clip'], lob_c, 0.0050, seg=20, rings=12, scale=(0.62, 0.42, 1.0))              # lobster body
        mb.torus(m['clip'], lob_c + V((0, 0, -0.0062)), V((0, 1, 0)), 0.0032, 0.0011, seg=20, seg2=6,
                 arc=(math.radians(-200), math.radians(20)))                                       # jaw
        mb.cylinder(m['clip'], lob_c + V((0.0026, -0.0012, 0.003)), lob_c + V((0.0034, -0.0012, -0.004)), 0.0007,
                    seg=6)                                                                         # gate lever
        # frosted vinyl strap loop through the jaw, down into the sleeve's slot punch
        jaw_z = lob_c.z - 0.0094
        strap_top = jaw_z - 0.0011
        sleeve_top = strap_top - 0.0115
        mb.torus(m['frosted'], V((0, Vp.y, jaw_z)), V((1, 0, 0)), 0.0021, 0.0006, seg=16, seg2=6,
                 arc=(math.radians(-10), math.radians(190)))
        mb.box(m['frosted'], V((0, Vp.y - 0.0015, strap_top - 0.008)), (0.012, 0.0011, 0.0165), bevel=0.0004)
        mb.box(m['frosted'], V((0, Vp.y + 0.0015, strap_top - 0.008)), (0.012, 0.0011, 0.0165), bevel=0.0004)
        mb.cylinder(m['clip'], V((0, Vp.y - 0.0021, sleeve_top + 0.0018)), V((0, Vp.y - 0.0032, sleeve_top + 0.0018)),
                    0.0024, seg=14)                                                                # snap stud
        badge_top = sleeve_top
        bc = V((0.0, Vp.y + 0.0006, badge_top - 0.040))
        nv = len(mb.bm.verts)
        self.sleeve(mb, bc, 0.105, 0.080, 0.0012, 0.003)
        mb.bm.verts.ensure_lookup_table()
        tilt = Matrix.Translation((0, bc.y, badge_top)) @ Matrix.Rotation(math.radians(BADGE_TILT), 4, 'X') @ \
            Matrix.Translation((0, -bc.y, -badge_top))
        bmesh.ops.transform(mb.bm, matrix=tilt, verts=mb.bm.verts[nv:])
        self.obj_from('badge_hw', mb, 'badge')
        # card: 100 x 72 mm, 3 mm corner radius, sitting at the bottom of the sleeve
        mb = MB()
        bm = mb.bm
        uvl = mb.uv()                       # the render-active 'UVMap' (MB made it), not a second layer
        w_, h_ = 0.100, 0.072
        y0 = bc.y
        cz = bc.z - 0.003
        rr = rrect2d(w_, h_, 0.003, 4)
        for yy, flip in ((y0, False), (y0 + 0.0004, True)):
            vs = [bm.verts.new(V((x, yy, cz + zz))) for x, zz in rr]
            f = bm.faces.new(vs if not flip else list(reversed(vs)))
            f.normal_update()
            if (f.normal.y > 0) != flip:
                f.normal_flip()
            for loop in f.loops:
                co = loop.vert.co
                loop[uvl].uv = ((co.x + w_ / 2) / w_, (co.z - cz + h_ / 2) / h_)
        mb.mi(m['card'])
        tilt = Matrix.Translation((0, bc.y, badge_top)) @ Matrix.Rotation(math.radians(BADGE_TILT), 4, 'X') @ \
            Matrix.Translation((0, -bc.y, -badge_top))
        bmesh.ops.transform(bm, matrix=tilt, verts=bm.verts[:])
        card = self.obj_from('badge', mb, 'badge', origin=bc)
        self.badge = card

    def sleeve(self, mb, bc, W, H, thick, rad):
        """Clear vinyl sleeve: rounded corners and a stadium slot punch at the top centre; flat
        (flat-shaded), so the sheen across it stays one soft broad highlight."""
        k = 96
        o2 = [V(p) for p in PR.resample_closed(rrect2d(W, H, rad, 8), k)]
        sc = V((0.0, H / 2 - 0.006))
        st = [V(p) for p in PR.resample_closed(PR.stadium(0.013, 0.0032, 16, sc.x, sc.y), k)]
        ang = lambda p: math.atan2(p.y - sc.y, p.x - sc.x)
        a0 = ang(o2[0])
        j0 = min(range(k), key=lambda j: abs(math.atan2(math.sin(ang(st[j]) - a0), math.cos(ang(st[j]) - a0))))
        st = st[j0:] + st[:j0]

        def curl(x, z):
            return 0.0           # flat: the radial faces round the slot punch must not crease the sheen
        bm = mb.bm
        mi = mb.mi(self.mat['vinyl'])
        rings = []
        for yy in (-thick / 2, thick / 2):
            ro = [bm.verts.new(V((bc.x + p.x, bc.y + yy + curl(p.x, p.y), bc.z + p.y))) for p in o2]
            ri = [bm.verts.new(V((bc.x + p.x, bc.y + yy, bc.z + p.y))) for p in st]
            rings.append((ro, ri))
        new = []
        (fo, fi), (bo, bi) = rings
        for i in range(k):
            j = (i + 1) % k
            new.append(bm.faces.new((fo[i], fo[j], fi[j], fi[i])))
            new.append(bm.faces.new((bo[j], bo[i], bi[i], bi[j])))
            new.append(bm.faces.new((fo[j], fo[i], bo[i], bo[j])))
            new.append(bm.faces.new((fi[i], fi[j], bi[j], bi[i])))
        bmesh.ops.recalc_face_normals(bm, faces=new)
        for f in new:
            f.material_index = mi
            f.smooth = False

    # ================================================================= ARMATURE
    def build_armature(self):
        arm_d = bpy.data.armatures.new(self.name + '_rig')
        arm = bpy.data.objects.new(self.name + '_rig', arm_d)
        self.coll.objects.link(arm)
        arm_d.display_type = 'STICK'
        arm.show_in_front = True
        vl = bpy.context.view_layer
        for o in vl.objects:
            o.select_set(False)
        vl.objects.active = arm
        arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        eb = arm_d.edit_bones

        def bone(name, head, tail, parent=None, roll_to=None, connect=False):
            b = eb.new(name)
            b.head = V(head)
            b.tail = V(tail)
            if roll_to is not None:
                b.align_roll(V(roll_to))
            if parent:
                b.parent = eb[parent]
                b.use_connect = connect
            return b

        bone('root', (0, 0, 0), (0, 0, 0.3), roll_to=FWD)
        bone('pelvis', (0, 0, HIP_Z), (0, 0, 0.92), 'root', roll_to=FWD)
        bone('spine', (0, 0, 0.90), (0, 0, 1.0), 'pelvis', roll_to=FWD)
        bone('chest', (0, 0, 1.0), (0, 0, 1.31), 'spine', roll_to=FWD)
        bone('neck', (0, 0, 1.31), self.neck_top, 'chest', roll_to=FWD)
        bone('head', self.neck_top, self.neck_top + V((0, 0, 0.23)), 'neck', roll_to=FWD)
        bone('badge', self.badge_pivot, self.badge_pivot + V((0, 0, -0.07)), 'chest', roll_to=FWD)
        for sx in (-1, 1):
            s = 'L' if sx > 0 else 'R'
            S, E, W, d, out, w, v = self.arm_frames(sx)
            bone(f'shoulder_{s}', (0.07 * sx, 0, 1.28), S, 'chest', roll_to=UP)
            # a cap on the shoulder joint (child of the shoulder bone, so it takes the shoulder's
            # protraction and shrug with the hub); its head is the inner seat, where the sideways
            # follow hinges, and Rig._pauldron_local turns it about the hub axis with the forward swing
            bone(f'pauldron_{s}', V((0.262 * sx, 0.0, 1.3215)), S + d * 0.1, f'shoulder_{s}', roll_to=FWD)
            bone(f'upperarm_{s}', S, E, f'shoulder_{s}', roll_to=FWD)
            bone(f'forearm_{s}', E, W, f'upperarm_{s}', roll_to=FWD, connect=True)
            hd = self.hands[s]
            u = d
            bone(f'hand_{s}', W, W + u * 0.095, f'forearm_{s}', roll_to=w, connect=True)
            for name, fd in hd['fingers'].items():
                pts = fd['pts']
                for i in range(3):
                    bone(f'{name}_{i + 1}_{s}', pts[i], pts[i + 1], f'hand_{s}' if i == 0 else f'{name}_{i}_{s}',
                         roll_to=w, connect=(i > 0))
            tp = hd['thumb']['pts']
            for i in range(3):
                bone(f'thumb_{i}_{s}', tp[i], tp[i + 1], f'hand_{s}' if i == 0 else f'thumb_{i - 1}_{s}',
                     roll_to=w, connect=(i > 0))
            X = HIP_X * sx
            bone(f'thigh_{s}', (X, 0, HIP_Z), (X, 0, KNEE_Z), 'pelvis', roll_to=FWD)
            bone(f'shin_{s}', (X, 0, KNEE_Z), (X, 0, ANKLE_Z), f'thigh_{s}', roll_to=FWD, connect=True)
            bone(f'foot_{s}', (X, 0, ANKLE_Z), (X, -0.13, 0.03), f'shin_{s}', roll_to=UP)
        bpy.ops.object.mode_set(mode='OBJECT')
        for pb in arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
        for s in 'LR':
            # the pauldron rides up with half of the arm's sideways lift (never with the forward swing)
            con = arm.pose.bones[f'pauldron_{s}'].constraints.new('COPY_ROTATION')
            con.target = arm
            con.subtarget = f'upperarm_{s}'
            con.target_space = 'LOCAL'
            con.owner_space = 'LOCAL'
            con.use_x = False
            con.use_y = False
            con.use_z = True
            con.mix_mode = 'REPLACE'
            con.influence = 0.5
            lim = arm.pose.bones[f'pauldron_{s}'].constraints.new('LIMIT_ROTATION')
            lim.owner_space = 'LOCAL'
            lim.use_limit_z = True
            # lift only (abduction is +Z local on the left, -Z on the right): an adducted arm
            # never tips the pauldron's inner edge down into the chest
            if s == 'L':
                lim.min_z, lim.max_z = 0.0, math.radians(PAULDRON_FOLLOW)
            else:
                lim.min_z, lim.max_z = math.radians(-PAULDRON_FOLLOW), 0.0
        self.arm = arm
        return arm

    def parent_all(self):
        arm = self.arm
        for obj, bone in self.later_parent:
            if bone is None:
                continue
            b = arm.data.bones[bone]
            Pb = b.matrix_local @ Matrix.Translation((0, b.length, 0))
            mw = obj.matrix_basis.copy()
            obj.parent = arm
            obj.parent_type = 'BONE'
            obj.parent_bone = bone
            obj.matrix_parent_inverse = Pb.inverted()
            obj.matrix_basis = mw


# ---------------------------------------------------------------- rig

class Rig:
    """Handle on a built Synergy. See the module docstring for pose conventions."""

    CENTRE = ('pelvis', 'spine', 'chest', 'neck', 'head', 'badge')

    def __init__(self, b):
        self.name = b.name
        self.arm = b.arm
        self.parts = b.parts
        self.head_plates = b.head_plates
        self.torso_plates = b.torso_plates
        self.cup = b.parts.get('cup')
        self.headset = b.parts.get('headset')
        self.screen = b.screen
        self.badge = b.badge
        self.hands = b.hands
        self.collection = b.coll
        self._fc_cache = {}
        self._grip = {}
        self._rest = {bn.name: bn.matrix_local.copy() for bn in self.arm.data.bones}
        self._cup_rest = getattr(b, 'cup_rest', None)
        self._cup_rest_L = getattr(b, 'cup_rest_L', None)
        self._hs_rest = getattr(b, 'hs_rest', None)
        self.cord_hooks = getattr(b, 'cord_hooks', [])
        self.cup_handle = getattr(b, 'cup_handle', None)     # props.Cup: .slot empty, .slot_glow(frame)
        self.slot = self.cup_handle.slot if self.cup_handle else None
        self._builder_hulls = dict(torso=getattr(b, 'torso_hull', None), head=getattr(b, 'head_hull', None))
        self._pauldron_hulls = getattr(b, 'pauldron_hulls', {})
        # the cap's walls without its open underside (the upper arm leaves through it)
        self._pauldron_walls = {k: [(n_, d_) for n_, d_ in h_.planes if n_.z > -0.45]
                                for k, h_ in self._pauldron_hulls.items()}
        self._pauldron_pts = getattr(b, 'pauldron_pts', {})
        self.face_frame = getattr(b, 'face_frame', None)
        self.headband = getattr(b, 'headband', None)       # (points, normals), head-bone rest space
        cups = getattr(b, 'earcups', None)
        self._earcup_L = (cups[0]['o'] + cups[0]['a'] * 0.030, cups[0]['top']) if cups else None

    # ---------------------------------------------------- inspection helpers
    def screen_point(self, u, v, frame=None):
        """World position of screen UV (u, v) (u left->right seen from the front, v bottom->top)."""
        if frame is not None:
            bpy.context.scene.frame_set(frame)
        c, ex, ey, n, sw, sh = self.face_frame
        local = ex * ((u - 0.5) * sw) + ey * ((v - 0.5) * sh) + n * (-0.001)
        dg = bpy.context.evaluated_depsgraph_get()
        return self.screen.evaluated_get(dg).matrix_world @ local

    def glass_glint(self, camera, frame, strength=7.0, length=0.12, width=0.04, dist=2.2, v=0.88):
        """The treatment's thin reflected skylight slot on the face glass: key a hot stadium card,
        visible to glossy rays only (no camera, diffuse or shadow rays), where the glass reflects
        `camera`'s ray through screen height v (0 bottom .. 1 top). Call once per shot camera and
        frame (the card is created on first use; it also adds a matching glint to chrome)."""
        card = getattr(self, '_glint', None)
        if card is None:
            # a soft-ended slot: a strip whose emission falls off smoothly toward both ends and
            # edges (UV u along, v across), so the reflection reads as a thin skylight, not a bar
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.new('UVMap')
            nu, nv = 12, 3
            grid = [[bm.verts.new(((i / nu - 0.5) * length, (j / nv - 0.5) * width, 0.0)) for j in range(nv + 1)]
                    for i in range(nu + 1)]
            for i in range(nu):
                for j in range(nv):
                    f_ = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
                    for loop, (a_, b_) in zip(f_.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                        loop[uvl].uv = (a_ / nu, b_ / nv)
            me = bpy.data.meshes.new(f'{self.name}_glint')
            bm.to_mesh(me)
            bm.free()
            card = bpy.data.objects.new(f'{self.name}_glint', me)
            self.collection.objects.link(card)
            mat = bpy.data.materials.new(f'{self.name}_glint_emit')
            mat.use_nodes = True
            nt = mat.node_tree
            for n_ in list(nt.nodes):
                nt.nodes.remove(n_)
            out_ = nt.nodes.new('ShaderNodeOutputMaterial')
            em = nt.nodes.new('ShaderNodeEmission')
            em.inputs['Color'].default_value = (0.93, 0.96, 1.0, 1.0)
            tc = nt.nodes.new('ShaderNodeTexCoord')
            sep = nt.nodes.new('ShaderNodeSeparateXYZ')
            nt.links.new(tc.outputs['UV'], sep.inputs['Vector'])

            def bell(sock, power):
                a_ = nt.nodes.new('ShaderNodeMath')
                a_.operation = 'MULTIPLY_ADD'
                a_.inputs[1].default_value = 2.0
                a_.inputs[2].default_value = -1.0
                nt.links.new(sock, a_.inputs[0])
                b_ = nt.nodes.new('ShaderNodeMath')
                b_.operation = 'POWER'
                b_.inputs[1].default_value = power
                ab = nt.nodes.new('ShaderNodeMath')
                ab.operation = 'ABSOLUTE'
                nt.links.new(a_.outputs[0], ab.inputs[0])
                nt.links.new(ab.outputs[0], b_.inputs[0])
                c_ = nt.nodes.new('ShaderNodeMath')
                c_.operation = 'SUBTRACT'
                c_.use_clamp = True
                c_.inputs[0].default_value = 1.0
                nt.links.new(b_.outputs[0], c_.inputs[1])
                return c_.outputs[0]
            mu = nt.nodes.new('ShaderNodeMath')
            mu.operation = 'MULTIPLY'
            nt.links.new(bell(sep.outputs['X'], 2.0), mu.inputs[0])
            nt.links.new(bell(sep.outputs['Y'], 2.5), mu.inputs[1])
            st = nt.nodes.new('ShaderNodeMath')
            st.operation = 'MULTIPLY'
            st.inputs[1].default_value = strength
            nt.links.new(mu.outputs[0], st.inputs[0])
            nt.links.new(st.outputs[0], em.inputs['Strength'])
            nt.links.new(em.outputs[0], out_.inputs['Surface'])
            try:
                mat.cycles.emission_sampling = 'NONE'
            except AttributeError:
                pass
            me.materials.append(mat)
            for attr in ('visible_camera', 'visible_diffuse', 'visible_transmission', 'visible_volume_scatter',
                         'visible_shadow'):
                setattr(card, attr, False)
            card.visible_glossy = True
            card.rotation_mode = 'QUATERNION'
            self._glint = card
        sc = bpy.context.scene
        sc.frame_set(frame)
        cam_loc = camera.matrix_world.translation.copy() if isinstance(camera, bpy.types.Object) else V(camera)
        p0 = self.screen_point(0.5, v)
        p1 = self.screen_point(0.5, 0.5)
        n = (self.screen_point(0.6, 0.5) - p1).cross(self.screen_point(0.5, 0.6) - p1).normalized()
        d = (p0 - cam_loc).normalized()
        if n.dot(d) > 0:
            n = -n
        # the rolled top of the glass tips its normal back by ~12 deg near v = 0.9
        n = (Matrix.Rotation(math.radians(12.0 * max(0.0, (v - 0.78) / 0.22)), 3, n.cross(V((0, 0, 1)))) @ n)
        r = d - n * (2 * d.dot(n))
        card.location = p0 + r * dist
        card.rotation_quaternion = (-r).to_track_quat('Z', 'Y')
        card.keyframe_insert('location', frame=frame)
        card.keyframe_insert('rotation_quaternion', frame=frame)
        return card

    def parts_on_bones(self, bones):
        """Mesh parts parented to any of the named bones (plus piston pieces aimed from them)."""
        bones = set(bones)
        out = []
        for o in self.collection.all_objects:
            if o.type not in ('MESH', 'CURVE'):
                continue
            pb = o.parent_bone if o.parent is self.arm and o.parent_type == 'BONE' else None
            if pb is None and o.parent is not None and o.parent.parent is self.arm:
                pb = o.parent.parent_bone
            if pb in bones:
                out.append(o)
        return out

    def overlap_report(self, frame, group_a, group_b, ignore=()):
        """Triangle-pair overlaps between two groups of objects at `frame` (world-space BVH).
        Returns {(a_name, b_name): pairs}; pairs listed in `ignore` (name substrings) are skipped."""
        from mathutils.bvhtree import BVHTree
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        cache = {}

        def tree(o):
            if o.name in cache:
                return cache[o.name]
            ev = o.evaluated_get(dg)
            try:
                me = ev.to_mesh()
            except RuntimeError:
                cache[o.name] = None
                return None
            if me is None or not len(me.polygons):
                ev.to_mesh_clear()
                cache[o.name] = None
                return None
            Mw = ev.matrix_world
            vs = [Mw @ v.co for v in me.vertices]
            ps = [tuple(p.vertices) for p in me.polygons]
            t = BVHTree.FromPolygons(vs, ps)
            ev.to_mesh_clear()
            cache[o.name] = t
            return t
        out = {}
        for a in group_a:
            ta = tree(a)
            if ta is None:
                continue
            for b_ in group_b:
                if a is b_ or any(x in a.name and y in b_.name or x in b_.name and y in a.name for x, y in ignore):
                    continue
                tb = tree(b_)
                if tb is None:
                    continue
                n = len(ta.overlap(tb))
                if n:
                    out[(a.name, b_.name)] = n
        return out

    def cup_objects(self):
        """The cup's root and every object riding on it (hide/show them together)."""
        if self.cup is None:
            return []
        return [self.cup] + list(self.cup.children_recursive)

    # ---------------------------------------------------- low level keys
    def _fcurves(self, path):
        ad = self.arm.animation_data
        if ad is None or ad.action is None:
            return []
        out = [fc for fc in C.fcurves(ad.action) if fc.data_path == path]
        return sorted(out, key=lambda fc: fc.array_index)

    def _style(self, path, frame, interp):
        for fc in self._fcurves(path):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 1e-4:
                    kp.interpolation = interp
                    kp.handle_left_type = 'AUTO_CLAMPED'
                    kp.handle_right_type = 'AUTO_CLAMPED'

    def _eval_quat(self, bone, frame):
        fcs = self._fcurves(f'pose.bones["{bone}"].rotation_quaternion')
        if len(fcs) != 4:
            return None
        q = Quaternion([fc.evaluate(frame) for fc in fcs])
        return q.normalized() if q.magnitude > 1e-6 else None

    def key_quat(self, bone, frame, q, interp='BEZIER'):
        """Key a bone-local rotation quaternion, keeping sign continuity."""
        pb = self.arm.pose.bones[bone]
        q = Quaternion(q).normalized()
        cur = self._eval_quat(bone, frame)
        if cur is not None and cur.dot(q) < 0:
            q.negate()
        pb.rotation_quaternion = q
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        self._style(f'pose.bones["{bone}"].rotation_quaternion', frame, interp)

    def key_rest_rot(self, bone, frame, R, interp='BEZIER'):
        """Key a rotation given in the bone's rest (armature-aligned) frame."""
        B = self._rest[bone].to_3x3()
        q = (B.inverted() @ R @ B).to_quaternion()
        self.key_quat(bone, frame, q, interp)

    def key_loc(self, bone, frame, delta_arm, interp='BEZIER', index=-1):
        pb = self.arm.pose.bones[bone]
        B = self._rest[bone].to_3x3()
        pb.location = B.inverted() @ V(delta_arm)
        pb.keyframe_insert('location', frame=frame, index=index)
        self._style(f'pose.bones["{bone}"].location', frame, interp)

    # ---------------------------------------------------- control -> rotation
    def _dir(self, bone):
        b = self.arm.data.bones[bone]
        return (b.tail_local - b.head_local).normalized()

    def _side(self, bone):
        return 1 if bone.endswith('_L') else -1

    def control_rotation(self, ctrl, val):
        """Rest-space rotation matrix for a pose control value (see module doc)."""
        if ctrl in self.CENTRE:
            x, y, z = val
            return rot_to(FWD, LEFT, z) @ rot_to(UP, -LEFT, y) @ rot_to(UP, FWD, x)
        s = self._side(ctrl)
        out = V((s, 0, 0))
        d = self._dir(ctrl)
        if ctrl.startswith('hand_'):
            hd = self.hands[ctrl[-1]]
            u, w, v = hd['u'], hd['w'], hd['v']
            x, y, z = val
            return rot_to(u, v, z) @ rot_to(w, v, y) @ rot_to(u, w, x)
        if ctrl.startswith('forearm_') and not isinstance(val, (tuple, list)):
            return rot_to(d, FWD, val)
        if ctrl.startswith('shin_') and not isinstance(val, (tuple, list)):
            return rot_to(d, BACK, val)
        if ctrl.startswith('foot_'):
            val = (val, 0, 0) if not isinstance(val, (tuple, list)) else val
            x, y, z = val
            return rot_to(UP, out, z) @ rot_to(d, out, y) @ rot_to(d, UP, x)
        if ctrl.startswith('shoulder_'):
            x, y, z = val
            return rot_to(FWD, UP, z) @ rot_to(d, UP, y) @ rot_to(d, FWD, x)
        x, y, z = val
        return rot_to(FWD, out, z) @ rot_to(d, out, y) @ rot_to(d, FWD, x)

    def finger_angles(self, s, val):
        """{finger: [MCP, PIP, DIP] degrees} for a fingers_* value: a curl 0..1, 'grip', a
        HAND_SHAPES name ('point', 'pinch', 'relaxed'), or a dict per finger whose values are
        a curl 0..1 or an (MCP, PIP, DIP) tuple, e.g. dict(index=0.0, middle=0.8, ring=1, pinky=1)."""
        if isinstance(val, str):
            if val == 'grip':
                return {k: list(a) for k, a in self.grip_angles(s)['fingers'].items()}
            return {n: list(HAND_SHAPES[val][n]) for n in FINGERS}
        if isinstance(val, dict):
            out = {}
            for n in FINGERS:
                x = val.get(n, 0.0)
                out[n] = list(x) if isinstance(x, (tuple, list)) else [a * float(x) for a in FIST]
            return out
        return {n: [a * float(val) for a in FIST] for n in FINGERS}

    def _finger_keys(self, frame, s, val, interp):
        hd = self.hands[s]
        w = hd['w']
        angles = self.finger_angles(s, val)
        for name, fd in hd['fingers'].items():
            for i in range(3):
                bn = f'{name}_{i + 1}_{s}'
                d = self._dir(bn)
                self.key_rest_rot(bn, frame, rot_to(d, w, angles[name][i]), interp)

    def _thumb_curl_axis(self, s):
        hd = self.hands[s]
        T0, T1, T2, T3 = hd['thumb']['pts']
        d1 = (T2 - T1).normalized()
        toward = (hd['W'] + hd['u'] * 0.06) - T2
        toward = (toward - d1 * toward.dot(d1)).normalized()
        return d1.cross(toward).normalized()

    def thumb_pinch(self, s, index_angles=None, gap=None):
        """Thumb rotations (rest frames, [R0, R1, R2]) that bring the thumb pad opposite the index
        pad with `gap` metres of air between the two pad surfaces (default PINCH_GAP = 2 mm, an
        envelope's thickness; HEADBAND_SIDE = 0.032          # headband centreline off the head where it rises from the left earcup (room
                               # for the S11 grip's thumb); over the crown it rests on the head
PADLOCK_GAP = 0.030 holds the 30 mm padlock between thumb, index and
        middle), and the
        pinch point (midway between the pads, where the held object sits) in hand-rest space."""
        gap = PINCH_GAP if gap is None else float(gap)
        key = ('pinch', s, tuple(index_angles) if index_angles else None, round(gap, 4))
        if key in self._grip:
            return self._grip[key]
        hd = self.hands[s]
        W, u, w, v = hd['W'], hd['u'], hd['w'], hd['v']
        fd = hd['fingers']['index']
        ang = index_angles or HAND_SHAPES['pinch']['index']
        hinge = fd['dir'].cross(w).normalized()
        P = fd['K'].copy()
        d = fd['dir'].copy()
        acc = 0.0
        segs = []
        for L, a_ in zip(fd['lens'], ang):
            acc += a_
            d = Matrix.Rotation(math.radians(acc), 3, hinge) @ fd['dir']
            segs.append((P.copy(), P + d * L))
            P = P + d * L
        tip = P
        pad_n = (Matrix.Rotation(math.radians(acc), 3, hinge) @ w).normalized()
        index_pad = tip - d * 0.006
        target = index_pad + pad_n * (PAD_R_INDEX + PAD_R_THUMB + gap)
        T0, T1, T2, T3 = hd['thumb']['pts']
        h_loc = self._thumb_curl_axis(s)

        def fk(a0, b0, c1, c2):
            R0 = Matrix.Rotation(math.radians(b0), 3, u) @ Matrix.Rotation(math.radians(a0), 3, v)
            R1 = Matrix.Rotation(math.radians(c1), 3, h_loc)
            R2 = Matrix.Rotation(math.radians(c2), 3, h_loc)
            t1 = T0 + R0 @ (T1 - T0)
            t2 = t1 + R0 @ R1 @ (T2 - T1)
            t3 = t2 + R0 @ R1 @ R2 @ (T3 - T2)
            return (R0, R1, R2), (t1, t2, t3)

        def cost(a0, b0, c1, c2):
            Rs, (t1, t2, t3) = fk(a0, b0, c1, c2)
            dt = (t3 - t2).normalized()
            pad = t3 - dt * 0.004
            c = (pad - target).length
            for pt in (t1.lerp(t2, 0.5), t2, t2.lerp(t3, 0.5)):
                q = pt - W
                if -0.0175 < q.dot(w) < 0.016 and 0.0 < q.dot(u) < 0.10 and abs(q.dot(v)) < 0.046:
                    c += 0.05
                for a_, b_ in segs[:2]:
                    ab = b_ - a_
                    t = max(0.0, min(1.0, (pt - a_).dot(ab) / ab.dot(ab)))
                    dd = (pt - (a_ + ab * t)).length
                    if dd < 0.017:
                        c += (0.017 - dd) * 3
            return c + (abs(a0) + abs(b0)) * 0.00002
        best = None
        for a0 in range(-60, 61, 10):
            for b0 in range(-60, 61, 10):
                for c1 in range(-20, 91, 10):
                    for c2 in range(-20, 91, 10):
                        c = cost(a0, b0, c1, c2)
                        if best is None or c < best[0]:
                            best = (c, a0, b0, c1, c2)
        for step in (5, 2.5, 1.0):
            improved = True
            while improved:
                improved = False
                c0, a0, b0, c1, c2 = best
                for da in (-step, 0, step):
                    for db in (-step, 0, step):
                        for dc1 in (-step, 0, step):
                            for dc2 in (-step, 0, step):
                                c = cost(a0 + da, b0 + db, c1 + dc1, c2 + dc2)
                                if c < best[0] - 1e-7:
                                    best = (c, a0 + da, b0 + db, c1 + dc1, c2 + dc2)
                                    improved = True
        _, a0, b0, c1, c2 = best
        Rs, (t1, t2, t3) = fk(a0, b0, c1, c2)
        thumb_pad = t3 - (t3 - t2).normalized() * 0.004
        mid = (index_pad + pad_n * PAD_R_INDEX + thumb_pad + (index_pad - thumb_pad).normalized() * PAD_R_THUMB) / 2
        out = dict(rot=list(Rs), point=mid, err=best[0], tip=tip, thumb_tip=t3, gap=gap,
                   pad_gap=(thumb_pad - index_pad).length - PAD_R_INDEX - PAD_R_THUMB)
        self._grip[key] = out
        return out

    def _thumb_keys(self, frame, s, val, interp):
        if isinstance(val, str) and val == 'grip':
            g = self.grip_angles(s)['thumb']
            for i, R in enumerate(g):
                self.key_rest_rot(f'thumb_{i}_{s}', frame, R, interp)
            return
        if (isinstance(val, str) and val == 'pinch') or (isinstance(val, (tuple, list)) and val and val[0] == 'pinch'):
            gap = val[1] if isinstance(val, (tuple, list)) and len(val) > 1 else None
            for i, R in enumerate(self.thumb_pinch(s, gap=gap)['rot']):
                self.key_rest_rot(f'thumb_{i}_{s}', frame, R, interp)
            return
        hd = self.hands[s]
        u, v, w = hd['u'], hd['v'], hd['w']
        tp = hd['thumb']['pts']
        if isinstance(val, str) and val == 'up':
            # straighten the thumb along -v (index side) for a thumbs-up
            d0 = (tp[1] - tp[0]).normalized()
            target = (-v * 0.92 + w * 0.2 + u * 0.12).normalized()
            R0 = Quaternion().slerp(d0.rotation_difference(target), 0.55).to_matrix()
            d1 = (tp[2] - tp[1]).normalized()
            R1w = (R0 @ d1).rotation_difference(target).to_matrix()
            R1 = R0.inverted() @ R1w @ R0
            self.key_rest_rot(f'thumb_0_{s}', frame, R0, interp)
            self.key_rest_rot(f'thumb_1_{s}', frame, R1, interp)
            self.key_rest_rot(f'thumb_2_{s}', frame, Matrix.Identity(3), interp)
            return
        for i, R in enumerate(self.thumb_curl_rots(s, float(val))):
            self.key_rest_rot(f'thumb_{i}_{s}', frame, R, interp)

    def thumb_curl_rots(self, s, c):
        """Rest-frame rotations [R0, R1, R2] of the thumb joints for a curl 0..1 toward the palm."""
        hd = self.hands[s]
        tp = hd['thumb']['pts']
        palm_c = hd['W'] + hd['u'] * 0.06
        out = []
        for i, deg in ((0, 22.0), (1, 38.0), (2, 45.0)):
            a, b = tp[i], tp[i + 1]
            d = (b - a).normalized()
            toward = (palm_c - b)
            toward = (toward - d * toward.dot(d)).normalized()
            out.append(rot_to(d, toward, deg * c))
        return out

    def pose(self, frame, interp='BEZIER', **controls):
        """Key FK controls at `frame` (degrees; see module docstring)."""
        for ctrl, val in controls.items():
            if val is None:
                continue
            if ctrl == 'root_loc':
                world = V(val)
                local = self.arm.matrix_world.inverted() @ world
                self.key_loc('root', frame, local, interp)
            elif ctrl == 'root_rot':
                yaw = float(val) - math.degrees(self.arm.matrix_world.to_euler().z)
                self.key_rest_rot('root', frame, Matrix.Rotation(math.radians(yaw), 3, 'Z'), interp)
            elif ctrl == 'root_z':
                self.key_loc('root', frame, V((0, 0, float(val))), interp, index=1)
            elif ctrl.startswith('fingers_'):
                self._finger_keys(frame, ctrl[-1], val, interp)
            elif ctrl in self.arm.pose.bones and ctrl.split('_')[0] in FINGERS and \
                    not isinstance(val, (tuple, list)):
                # one finger joint: number = curl toward the palm (degrees)
                self.key_rest_rot(ctrl, frame, rot_to(self._dir(ctrl), self.hands[ctrl[-1]]['w'], float(val)), interp)
            elif ctrl.startswith('thumb_') and ctrl.count('_') == 2 and not isinstance(val, (tuple, list)):
                bn = ctrl
                s_ = bn[-1]
                d = self._dir(bn)
                hd = self.hands[s_]
                toward = (hd['W'] + hd['u'] * 0.06) - self.arm.data.bones[bn].tail_local
                toward = (toward - d * toward.dot(d)).normalized()
                self.key_rest_rot(bn, frame, rot_to(d, toward, float(val)), interp)
            elif ctrl.startswith('thumb_'):
                self._thumb_keys(frame, ctrl[-1], val, interp)
            elif ctrl in self.arm.pose.bones:
                self.key_rest_rot(ctrl, frame, self.control_rotation(ctrl, val), interp)
            else:
                raise KeyError(f'unknown pose control {ctrl!r}')

    def rest(self, frame, interp='BEZIER'):
        """Key every bone back to its rest pose."""
        for pb in self.arm.pose.bones:
            self.key_quat(pb.name, frame, Quaternion(), interp)
        self.key_loc('root', frame, V(), interp)
        self.key_loc('pelvis', frame, V(), interp)

    # ---------------------------------------------------- arm placement (IK helper)
    def solve_arm(self, s, wrist, hand_u, hand_w, pole):
        """Rest-space rotations (upperarm, forearm, hand) that put the wrist at `wrist`
        (chest-rest space) with the hand frame (u along the fingers, w palm normal)."""
        b = self.arm.data.bones
        S = b[f'upperarm_{s}'].head_local.copy()
        E0 = b[f'forearm_{s}'].head_local.copy()
        W0 = b[f'hand_{s}'].head_local.copy()
        l1, l2 = (E0 - S).length, (W0 - E0).length
        d0 = (E0 - S).normalized()
        h0 = d0.cross(FWD).normalized()
        D = V(wrist) - S
        dist = max(abs(l1 - l2) + 1e-3, min(D.length, l1 + l2 - 1e-4))
        Dn = D.normalized()
        a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
        h = math.sqrt(max(0.0, l1 * l1 - a * a))
        p = V(pole)
        pn = (p - Dn * p.dot(Dn)).normalized()
        E = S + Dn * a + pn * h
        Wp = S + Dn * dist
        du = (E - S).normalized()
        df = (Wp - E).normalized()
        h1 = du.cross(df)
        h1 = h1.normalized() if h1.length > 1e-6 else du.cross(FWD).normalized()
        Ru = frame3(du, h1) @ frame3(d0, h0).transposed()
        kappa = math.degrees(du.angle(df))
        Rf = Matrix.Rotation(math.radians(kappa), 3, h0)
        hd = self.hands[s]
        Rt = frame3(V(hand_u), V(hand_w)) @ frame3(hd['u'], hd['w']).transposed()
        Rh = (Ru @ Rf).transposed() @ Rt
        return Ru, Rf, Rh

    def to_chest(self, frame, p=None, d=None):
        """World point p (or direction d) -> chest-rest space at frame (root, spine and chest as
        keyed: key them first). place_arm(..., space='world') uses it."""
        Dc = self._chest_delta(frame)
        if p is not None:
            return Dc @ V(p)
        return (Dc.to_3x3() @ V(d)).normalized()

    def place_arm(self, frame, s, wrist, hand_u, hand_w, pole, interp='BEZIER', shoulder=(0.0, 0.0, 0.0),
                  space='chest'):
        """Key shoulder (control tuple: x protraction forward, y shrug), upper arm, forearm and
        hand so the wrist reaches `wrist` with hand axes (u along the fingers, w palm normal); the
        elbow swings toward `pole`. space='chest' (default): chest-rest coordinates; 'world': world
        coordinates, converted with the root/spine/chest pose keyed at `frame` (so a lean or a
        moved root is honoured). The pauldron cap follows: the shoulder fully, PAULDRON_FLEX of the
        forward swing about the hub axis, and it rides up for an arm lifted past 80 deg."""
        if space == 'world':
            wrist = self.to_chest(frame, wrist)
            hand_u, hand_w, pole = (self.to_chest(frame, d=x) for x in (hand_u, hand_w, pole))
        Rsh, Ru, Rf, Rh = self._arm_solution(s, wrist, hand_u, hand_w, pole, shoulder)
        self.key_pauldron(frame, s, Rsh, Ru, interp)
        self.key_rest_rot(f'shoulder_{s}', frame, Rsh, interp)
        self.key_rest_rot(f'upperarm_{s}', frame, Ru, interp)
        self.key_rest_rot(f'forearm_{s}', frame, Rf, interp)
        self.key_rest_rot(f'hand_{s}', frame, Rh, interp)

    def place_arm_clear(self, frame, s, wrist, hand_u, hand_w, pole, interp='BEZIER', fingers=None,
                        shoulders=None, space='chest', obstacles=None):
        """place_arm, searching the elbow pole around `pole` and small shoulder offsets for the
        pose that clears the chest, pauldron and head (and `obstacles`: [(point, radius)] in the
        same space, e.g. the headband). space as in place_arm. Returns the chosen solution
        (in chest-rest space)."""
        if space == 'world':
            wrist = self.to_chest(frame, wrist)
            hand_u, hand_w, pole = (self.to_chest(frame, d=x) for x in (hand_u, hand_w, pole))
            if obstacles:
                obstacles = [(self.to_chest(frame, q), r) for q, r in obstacles]
        key = ('place', s, tuple(round(x, 4) for x in wrist), tuple(round(x, 3) for x in hand_u),
               tuple(round(x, 3) for x in hand_w), tuple(round(x, 3) for x in pole), str(fingers),
               tuple((tuple(round(x, 4) for x in q), round(r, 4)) for q, r in (obstacles or ())))
        sol = self._grip.get(key)
        if sol is None:
            p0 = V(pole).normalized()
            poles = [p0] + [(p0 + V(q) * 0.6).normalized() for q in
                            ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
            fa = self.finger_angles(s, fingers) if fingers is not None else None
            poles += [(p0 + V(q).normalized() * 1.2).normalized() for q in
                      ((1, 1, 0), (-1, 1, 0), (1, -1, 0), (-1, -1, 0), (1, 0, 1), (-1, 0, 1))]
            sol = self.solve_arm_clear(s, wrist, [(hand_u, hand_w)], poles,
                                       shoulders or [(0, 0, 0), (6, 0, 0), (12, 2, 0), (0, 5, 0), (18, 4, 0),
                                                     (24, 4, 0), (30, 6, 0), (12, 8, 0), (-6, 2, 0)],
                                       fingers=fa, obstacles=obstacles)
            self._grip[key] = sol
        self.place_arm(frame, s, sol['wrist'], sol['u'], sol['w'], sol['pole'], interp, shoulder=sol['shoulder'])
        return sol

    def finger_points(self, s, name, angles):
        """Joint and end points (hand-rest space) of a finger for (MCP, PIP, DIP) angles."""
        hd = self.hands[s]
        fd = hd['fingers'][name]
        hinge = fd['dir'].cross(hd['w']).normalized()
        P = fd['K'].copy()
        acc = 0.0
        out = []
        for L, a_ in zip(fd['lens'], angles):
            acc += a_
            P = P + (Matrix.Rotation(math.radians(acc), 3, hinge) @ fd['dir']) * L
            out.append(P.copy())
        return out

    def fingertip(self, s, name, angles):
        """Tip of a finger in hand-rest space for (MCP, PIP, DIP) angles."""
        hd = self.hands[s]
        fd = hd['fingers'][name]
        hinge = fd['dir'].cross(hd['w']).normalized()
        P = fd['K'].copy()
        acc = 0.0
        for L, a_ in zip(fd['lens'], angles):
            acc += a_
            P = P + (Matrix.Rotation(math.radians(acc), 3, hinge) @ fd['dir']) * L
        return P + (Matrix.Rotation(math.radians(acc), 3, hinge) @ fd['dir']) * 0.009

    # ---------------------------------------------------- IK with clearance
    @staticmethod
    def _about(c, R):
        c = V(c)
        return Matrix.Translation(c) @ R.to_4x4() @ Matrix.Translation(-c)

    def _arm_solution(self, s, wrist, hand_u, hand_w, pole, shoulder=(0.0, 0.0, 0.0)):
        b = self.arm.data.bones
        Rsh = self.control_rotation(f'shoulder_{s}', shoulder) if not isinstance(shoulder, Matrix) else shoulder
        Dsh = self._about(b[f'shoulder_{s}'].head_local, Rsh)
        Di = Dsh.inverted()
        Ri = Rsh.inverted()
        Ru, Rf, Rh = self.solve_arm(s, Di @ V(wrist), Ri @ V(hand_u), Ri @ V(hand_w), Ri @ V(pole))
        return Rsh, Ru, Rf, Rh

    def _pauldron_rot(self, s, Ru):
        """Ride-up of the pauldron for a raised arm (lift past PAULDRON_RIDE_FROM = 80 deg, e.g.
        the S11 headband grip): it tips toward the arm by 25% of the excess (at most 30 deg),
        hinging on the cap corner that keeps it clear of the chest. Past 110 deg (an arm
        overhead) it rises a further 80% of the excess (up to 65 deg in all)."""
        d0 = self._dir(f'upperarm_{s}')
        du = Ru @ d0
        lift = math.degrees(d0.angle(du))
        if lift <= PAULDRON_RIDE_FROM:
            return Matrix.Identity(3)
        ang = min(30.0, 0.25 * (lift - PAULDRON_RIDE_FROM)) + max(0.0, min(35.0, 0.8 * (lift - 110.0)))
        return rot_to(d0, du, ang)

    def _pauldron_flex(self, s, Ru):
        """Degrees the cap turns about the hub axis for the upper arm's forward swing (Ru in the
        shoulder's frame): PAULDRON_FLEX of the swing past PAULDRON_FLEX_FROM, at most
        PAULDRON_FLEX_MAX; a backward swing leaves it put."""
        du = Ru @ self._dir(f'upperarm_{s}')
        flex = math.degrees(math.atan2(-du.y, -du.z))
        return min(PAULDRON_FLEX_MAX, PAULDRON_FLEX * max(0.0, flex - PAULDRON_FLEX_FROM))

    def _pauldron_hinge(self, s, Rp=None, L=None, Dsh=None):
        """Pivot (shoulder-rest space) of the ride-up rotation Rp: the cap corner about which the
        rotation keeps every corner of the (already flex-turned, L) cap furthest out of the
        chest (posed by the shoulder delta Dsh); ties go to the higher corner."""
        b = self.arm.data.bones
        c = b[f'pauldron_{s}'].head_local.copy()
        if Rp is None or Rp.to_quaternion().angle < 1e-4:
            return c
        th = self._builder_hulls.get('torso')
        pts = [(L @ q) if L is not None else q.copy() for q in self._pauldron_pts.get(s, ())]
        if th is None or not pts:
            return c
        D = Dsh if Dsh is not None else Matrix.Identity(4)
        best, best_v = c, None
        for e in pts:
            v_ = min(th.sdf(D @ ((Rp @ (q - e)) + e)) for q in pts) + e.z * 1e-3
            if best_v is None or v_ > best_v + 1e-6:
                best, best_v = e, v_
        return best

    def _pauldron_local(self, s, Ru, Dsh=None):
        """Rest -> posed transform of the pauldron relative to its parent (the shoulder joint), in
        armature-rest axes: a turn about the hub axis (world X through the shoulder pivot) with the
        forward swing, then the ride-up of a raised arm."""
        b = self.arm.data.bones
        Spiv = b[f'upperarm_{s}'].head_local.copy()
        L = self._about(Spiv, Matrix.Rotation(math.radians(-self._pauldron_flex(s, Ru)), 3, 'X'))
        if Dsh is not None:
            # a strongly protracted shoulder (S10's long reach) carries the cap round toward the
            # chest's front corner: tip its inner edge up and out about the hub's front-back axis
            sx = 1.0 if s == 'L' else -1.0
            d_sh = (Spiv - b[f'shoulder_{s}'].head_local).normalized()
            dp = Dsh.to_3x3() @ d_sh
            prot = math.degrees(math.atan2(-dp.y, abs(dp.x)))
            beta = min(PAULDRON_PROTRACT_TIP, max(0.0, 0.6 * (prot - 12.0)))
            if beta > 0.0:
                L = self._about(L @ Spiv, Matrix.Rotation(math.radians(beta * sx), 3, 'Y')) @ L
        Rr = self._pauldron_rot(s, Ru)
        if Rr.to_quaternion().angle > 1e-4:
            L = self._about(self._pauldron_hinge(s, Rr, L, Dsh), Rr) @ L
        return L

    def key_pauldron(self, frame, s, Rsh, Ru, interp='BEZIER'):
        """Key the pauldron cap for an arm pose (shoulder Rsh, upper arm Ru): its rotation about the
        bone head plus the location shift that turns it about its real pivot."""
        b = self.arm.data.bones
        Dsh = self._about(b[f'shoulder_{s}'].head_local, Rsh)
        L = self._pauldron_local(s, Ru, Dsh)
        c = b[f'pauldron_{s}'].head_local
        self.key_rest_rot(f'pauldron_{s}', frame, L.to_3x3(), interp)
        self.key_loc(f'pauldron_{s}', frame, (L @ c) - c, interp)

    def bake_pauldrons(self, start, end, step=1, sides='LR'):
        """Re-key both pauldron caps on every `step`-th frame of [start, end] from the arm pose
        actually evaluated there (LINEAR), so between two sparse arm keys the cap keeps turning
        about the hub instead of interpolating its rotation and pivot shift separately (which can
        dip it toward the chest by a few mm). Call after the shot's arm keys."""
        sc = bpy.context.scene
        for f in range(int(start), int(end) + 1, max(1, int(step))):
            sc.frame_set(f)
            for s_ in sides:
                rots = []
                for bn in (f'shoulder_{s_}', f'upperarm_{s_}'):
                    B = self._rest[bn].to_3x3()
                    q = self.arm.pose.bones[bn].rotation_quaternion
                    rots.append(B @ q.to_matrix() @ B.inverted())
                self.key_pauldron(f, s_, rots[0], rots[1], 'LINEAR')

    def _pauldron_shift(self, s, Rp):
        """Pose-bone location (armature-rest axes) for a rotation Rp about the bone head: none
        (kept for compatibility; key_pauldron keys the full shift)."""
        return V((0.0, 0.0, 0.0))

    def _pauldron_total(self, s, Rsh, Ru):
        """Rotation part of the pauldron's own (shoulder-relative) transform for an arm pose."""
        b = self.arm.data.bones
        return self._pauldron_local(s, Ru, self._about(b[f'shoulder_{s}'].head_local, Rsh)).to_3x3()

    def _pauldron_delta(self, s, chain, Ru, Rsh=None):
        """Rest -> posed transform of the pauldron for an arm chain (chest-rest space)."""
        Dsh = chain[0]
        return Dsh @ self._pauldron_local(s, Ru, Dsh)

    def _arm_chain(self, s, Rsh, Ru, Rf, Rh):
        """Delta transforms (chest-rest space) of shoulder, upper arm, forearm and hand."""
        b = self.arm.data.bones
        Dsh = self._about(b[f'shoulder_{s}'].head_local, Rsh)
        Du = Dsh @ self._about(b[f'upperarm_{s}'].head_local, Ru)
        Df = Du @ self._about(b[f'forearm_{s}'].head_local, Rf)
        Dh = Df @ self._about(b[f'hand_{s}'].head_local, Rh)
        return Dsh, Du, Df, Dh

    def _arm_samples(self, s, chain, fingers=None, skip_tips=False, thumb=None):
        """Capsule samples (point, radius, part) of a posed arm in chest-rest space.
        thumb: [R0, R1, R2] thumb rotations to include the thumb."""
        Dsh, Du, Df, Dh = chain
        b = self.arm.data.bones
        S0 = b[f'upperarm_{s}'].head_local
        E0 = b[f'forearm_{s}'].head_local
        W0 = b[f'hand_{s}'].head_local
        hd = self.hands[s]
        sx = 1.0 if s == 'L' else -1.0
        out = []
        for k in range(8):                         # rim of the shoulder hub's inner face
            a_ = 2 * math.pi * k / 8
            out.append((Dsh @ (S0 + V((-0.022 * sx, 0.029 * math.cos(a_), 0.029 * math.sin(a_)))), 0.003, 'hub'))
        if thumb is not None:
            T0, T1, T2, T3 = hd['thumb']['pts']
            R0, R1, R2 = thumb
            t1 = T0 + R0 @ (T1 - T0)
            t2 = t1 + R0 @ R1 @ (T2 - T1)
            t3 = t2 + R0 @ R1 @ R2 @ (T3 - T2)
            for q in (T0.lerp(t1, 0.5), t1, t1.lerp(t2, 0.5), t2, t2.lerp(t3, 0.5), t3):
                out.append((Dh @ q, 0.0095, 'thumb'))
        f_ = FWD
        o_ = V((sx, 0.0, 0.0))
        for t in (0.15, 0.25, 0.4, 0.55, 0.7, 0.85):
            q = S0.lerp(E0, t)
            out.append((Du @ q, 0.040, 'upper'))
            out.append((Du @ (q - f_ * 0.050 + o_ * 0.012), 0.013, 'upper'))      # cable bundle
            if 0.2 < t < 0.6:
                out.append((Du @ (q + f_ * 0.042), 0.012, 'upper'))               # front cream plate
        out.append((Du @ E0, 0.029, 'elbow'))
        for t in (0.2, 0.4, 0.6, 0.8):
            out.append((Df @ E0.lerp(W0, t), 0.034 - 0.007 * t, 'fore'))
        out.append((Dh @ W0, 0.023, 'wrist'))
        u, v, w = hd['u'], hd['v'], hd['w']
        for uu in (0.035, 0.065, 0.09):
            for vv in (-0.028, 0.0, 0.028):
                out.append((Dh @ (W0 + u * uu + v * vv), 0.016, 'palm'))
        if fingers is not None:
            for name, fd in hd['fingers'].items():
                hinge = fd['dir'].cross(w).normalized()
                P = fd['K'].copy()
                acc = 0.0
                for i, (L, a_) in enumerate(zip(fd['lens'], fingers[name])):
                    acc += a_
                    d = Matrix.Rotation(math.radians(acc), 3, hinge) @ fd['dir']
                    Q = P + d * L
                    tag = 'tip' if (skip_tips and name == 'index' and i == 2) else 'finger'
                    for t_ in (0.3, 0.7):
                        out.append((Dh @ P.lerp(Q, t_), 0.009, tag))
                    out.append((Dh @ Q, 0.0095, tag))
                    P = Q
        return out

    def _penetration(self, samples, cup=None, margin=0.004, side=None, Dsh=None, obstacles=None, cup_arm=None):
        """Sum of squared penetrations of the samples into torso, head, the arm's own pauldron
        shell (side, Dsh), optionally the cup (cup = (base, axis) in chest-rest space) and
        spherical obstacles [(point, radius)]."""
        pen = 0.0
        for q, rq in (obstacles or ()):
            for p, r, part in samples:
                d = (p - q).length - r - rq - 0.002
                if d < 0:
                    pen += d * d
        hulls = [h for h in (self._builder_hulls.get('torso'), self._builder_hulls.get('head')) if h is not None]
        ph = self._pauldron_hulls.get(side) if side else None
        Di = Dsh.inverted() if (ph is not None and Dsh is not None) else None
        for p, r, part in samples:
            if part != 'tip':
                for h in hulls:
                    d = h.sdf(p) - (r + margin if part != 'hub' else r + 0.002)
                    if d < 0:
                        pen += d * d
            if Di is not None and part in ('upper', 'elbow', 'fore', 'wrist'):
                q_ = Di @ p
                if part == 'upper':     # it leaves the cap through the open underside: walls only
                    sd = max(n_.dot(q_) - d_ for n_, d_ in self._pauldron_walls[side])
                else:
                    sd = ph.sdf(q_)
                # the upper arm may run inside the cap; forearm, elbow and wrist keep clear of the shell
                if sd > -0.05 and (part != 'upper' or sd > 0.0):
                    d = abs(sd) - r - 0.003
                    if d < 0:
                        pen += d * d
            if cup_arm is not None and part in ('upper', 'elbow', 'fore', 'wrist'):
                base_, ax_ = cup_arm
                rel = p - base_
                hh = rel.dot(ax_)
                rr = r + 0.003
                if -rr < hh < LID_TOP + rr:
                    rad = (rel - ax_ * hh).length
                    din = max(rad - cup_radius(max(0.0, min(hh, LID_TOP))) - rr, hh - LID_TOP - rr, -hh - rr)
                    if din < 0:
                        pen += din * din * 4
            if cup is not None:
                r = r + (0.002 if part in ('tip', 'thumb') else 0.004)
                base, ax = cup
                rel = p - base
                hh = rel.dot(ax)
                top = LID_TOP + 0.0040                      # the raised spout round the slot
                if -r < hh < top + r:
                    rad = (rel - ax * hh).length
                    din = max(rad - LID_R - r, hh - top - r, -hh - r)
                    if din < 0:
                        pen += din * din * 12
        return pen

    def solve_arm_clear(self, s, target, hand_frames, pole_dirs, shoulders, fingers=None, cup=None,
                        point_local=None, prefer=None, thumb=None, obstacles=None, cup_arm=None):
        """Search hand orientations x elbow poles x shoulder offsets for the arm pose that reaches
        `target` with the least penetration (torso, head, cup). hand_frames: [(u, w)];
        point_local: hand-rest point that must land on target (default: the wrist).
        Returns dict(wrist, u, w, pole, shoulder, pen)."""
        b = self.arm.data.bones
        W0 = b[f'hand_{s}'].head_local
        hd = self.hands[s]
        best = None
        for (hu, hw) in hand_frames:
            hu = V(hu).normalized()
            hw = (V(hw) - hu * V(hw).dot(hu)).normalized()
            Rt = frame3(hu, hw) @ frame3(hd['u'], hd['w']).transposed()
            wrist = V(target) - Rt @ ((point_local - W0) if point_local is not None else V((0, 0, 0)))
            for sh in shoulders:
                for pole in pole_dirs:
                    Rsh, Ru, Rf, Rh = self._arm_solution(s, wrist, hu, hw, pole, sh)
                    chain = self._arm_chain(s, Rsh, Ru, Rf, Rh)
                    reach = (chain[3] @ W0 - wrist).length
                    Dp = self._pauldron_delta(s, chain, Ru)
                    pen = self._penetration(self._arm_samples(s, chain, fingers, skip_tips=True, thumb=thumb), cup,
                                            side=s, Dsh=Dp, obstacles=obstacles, cup_arm=cup_arm)
                    th = self._builder_hulls.get('torso')
                    if th is not None:
                        for q in self._pauldron_pts.get(s, ()):        # the cap never dips into the chest
                            dq = th.sdf(Dp @ q) - 0.003
                            if dq < 0:
                                pen += dq * dq * 10.0
                    ph_ = self._pauldron_hulls.get(s)
                    if ph_ is not None:                                # ... nor the chest's corner into the cap
                        Dpi = Dp.inverted()
                        for q in self._chest_corner_pts(s):
                            dq = ph_.sdf(Dpi @ q) - 0.002
                            if dq < 0:
                                pen += dq * dq * 10.0
                    score = pen * 1e4 + reach * 50 + 0.0004 * (abs(sh[0]) + abs(sh[1]))
                    if prefer is not None:
                        score += prefer(hu, hw, pole, sh, chain)
                    if best is None or score < best['score']:
                        best = dict(score=score, wrist=wrist, u=hu, w=hw, pole=V(pole), shoulder=tuple(sh), pen=pen,
                                    reach=reach)
        return best

    def _chest_corner_pts(self, s):
        """Points on the chest's upper outer corner on side s (yoke edge, side and front plates
        near the shoulder), for the cap-vs-chest clearance test."""
        key = ('chest_corner', s)
        if key in self._grip:
            return self._grip[key]
        sx = 1.0 if s == 'L' else -1.0
        T = {k: V(v) for k, v in _Builder.TORSO.items()}
        base = [q for k, q in T.items() if q.x * sx > 0.10 and q.z > 1.14 and not k.startswith('C')]
        pts = list(base)
        for i, a in enumerate(base):
            for b in base[i + 1:]:
                if (a - b).length < 0.26:
                    pts += [a.lerp(b, t) for t in (0.2, 0.4, 0.6, 0.8)]
        self._grip[key] = pts
        return pts

    def cup_hand_frame(self, s, cup_base, cup_axis, finger_dir):
        """Wrist position and hand axes (u, w) that hold the cup (base centre, axis up)."""
        c = V(cup_axis).normalized()
        u0 = V(finger_dir)
        u0 = (u0 - c * u0.dot(c)).normalized()
        u = (u0 * math.cos(GRIP_TILT) - c * math.sin(GRIP_TILT)).normalized()
        v = (-(c + u * math.sin(GRIP_TILT))).normalized()
        w = u.cross(v) if s == 'R' else v.cross(u)
        mid = V(cup_base) + c * GRIP_H_MID
        wrist = mid - u * GRIP_U - w * GRIP_W
        return wrist, u, w

    # ---------------------------------------------------- grip solver
    def grip_angles(self, s):
        """Finger joint angles (deg) and thumb rotations that wrap the cup in hand s."""
        if s in self._grip:
            return self._grip[s]
        hd = self.hands[s]
        W, u, w, v = hd['W'], hd['u'], hd['w'], hd['v']
        c, base = grip_frame(W, u, v, w)

        def clearance(p, rad):
            rel = p - base
            h = rel.dot(c)
            radial = (rel - c * h).length
            if h > LID_TOP + 0.002 or h < -0.002:
                return 1.0
            rr = cup_radius(h)
            return radial - rr - rad

        def seg_clear(a, d, L, rad, start=0.0):
            return min(clearance(a + d * (L * (start + (1 - start) * k / 8)), rad) for k in range(9))

        out = {'fingers': {}}
        for name, fd in hd['fingers'].items():
            hinge = fd['dir'].cross(w).normalized()
            P = fd['K'].copy()
            d = fd['dir'].copy()
            angs = []
            for i, L in enumerate(fd['lens']):
                rad = FINGER_R - 0.0004 * i + 0.0016
                lo = -20.0 if i == 0 else -5.0
                skip = 0.15 if i == 0 else 0.35
                best = lo
                a = lo
                while a <= 110.0:
                    dd = Matrix.Rotation(math.radians(a), 3, hinge) @ d
                    if seg_clear(P, dd, L, rad, skip) < 0.0:
                        break
                    best = a
                    a += 1.0
                angs.append(best)
                d = Matrix.Rotation(math.radians(best), 3, hinge) @ d
                P = P + d * L
            out['fingers'][name] = angs
            fsegs = out.setdefault('_segs', [])
            P2 = fd['K'].copy()
            d2 = fd['dir'].copy()
            for a_, L_ in zip(angs, fd['lens']):
                d2 = Matrix.Rotation(math.radians(a_), 3, hinge) @ d2
                fsegs.append((P2.copy(), P2 + d2 * L_))
                P2 = P2 + d2 * L_
        # thumb: search metacarpal opposition, then curl the two segments to contact
        fsegs = out.pop('_segs', [])

        def hand_clear(p, rad):
            q = p - W
            pu, pv, pw = q.dot(u), q.dot(v), q.dot(w)
            du = max(0.0 - pu, pu - 0.104, 0.0)
            dv = max(abs(pv) - 0.044, 0.0)
            dw = max(-0.0155 - pw, pw - 0.0135, 0.0)
            dout = math.sqrt(du * du + dv * dv + dw * dw)
            if dout <= 0.0:
                dout = -min(pu, 0.104 - pu, 0.044 - abs(pv), pw + 0.0155, 0.0135 - pw)
            best_ = dout - rad
            for a_, b_ in fsegs:
                ab = b_ - a_
                t = max(0.0, min(1.0, (p - a_).dot(ab) / max(1e-9, ab.dot(ab))))
                best_ = min(best_, (p - (a_ + ab * t)).length - rad - 0.0080)
            return best_

        def seg_ok(a_, d_, L, rad, start):
            for k in range(9):
                pt = a_ + d_ * (L * (start + (1 - start) * k / 8))
                if clearance(pt, rad) < 0.0 or hand_clear(pt, rad) < 0.0:
                    return False
            return True

        tp = hd['thumb']['pts']
        T0, T1, T2, T3 = tp
        best = None
        for a0 in range(-66, 67, 6):
            for b0 in range(-66, 67, 6):
                R0 = Matrix.Rotation(math.radians(b0), 3, u) @ Matrix.Rotation(math.radians(a0), 3, v)
                t1 = T0 + R0 @ (T1 - T0)
                d0 = (t1 - T0).normalized()
                if not seg_ok(T0, d0, (t1 - T0).length, 0.0103, 0.65):
                    continue
                d1 = R0 @ (T2 - T1).normalized()
                pos = t1
                d = d1
                radial = (base - pos) - c * (base - pos).dot(c)
                hinge = d1.cross(radial)
                if hinge.length < 1e-4:
                    continue
                hinge.normalize()
                curls = []
                okay = True
                for L in (0.035, 0.028):
                    bb = None
                    a = -12.0
                    while a <= 100.0:
                        dd = Matrix.Rotation(math.radians(a), 3, hinge) @ d
                        if not seg_ok(pos, dd, L, 0.0103, 0.3):
                            break
                        bb = a
                        a += 3.0
                    if bb is None:
                        okay = False
                        break
                    curls.append(bb)
                    d = Matrix.Rotation(math.radians(bb), 3, hinge) @ d
                    pos = pos + d * L
                if not okay:
                    continue
                tip_gap = clearance(pos, 0.0085)
                rel = pos - base
                hh = rel.dot(c)
                side = (rel - c * hh).normalized().dot(-u)   # far side of the cup from the fingers
                score = min(abs(tip_gap), 0.03) * 60 - side * 0.8 + abs(hh - GRIP_H_MID - 0.01) * 5 \
                    + (abs(a0) + abs(b0)) * 0.0015
                if best is None or score < best[0]:
                    best = (score, R0, hinge, curls)
        if best is None:
            out['thumb'] = [Matrix.Identity(3)] * 3
        else:
            _, R0, hinge, curls = best
            out['thumb'] = [R0, Matrix.Rotation(math.radians(curls[0]), 3, R0.inverted() @ hinge),
                            Matrix.Rotation(math.radians(curls[1]), 3, R0.inverted() @ hinge)]
        self._grip[s] = out
        return out

    # ---------------------------------------------------- presets
    PRESETS = ('neutral', 'idle_cup', 'idle_cup_high', 'thumbs_up', 'sip', 'hands_clasped', 'reach_L', 'seated',
               'post_L')

    def apply_preset(self, frame, name, interp='BEZIER'):
        """Key a named pose. Presets set the arms and hands (and the canonical 4 deg head roll);
        any further head or chest acting is keyed by the shot. 'sip' also tips the head back 5 deg
        to meet the cup (S13)."""
        p = self.pose
        if name == 'neutral':
            self.rest(frame, interp)
            return
        if name not in self.PRESETS:
            raise KeyError(f'unknown preset {name!r}')
        # body defaults
        p(frame, interp, pelvis=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=CANON_HEAD)
        p(frame, interp, thigh_L=(0, 0, 0), thigh_R=(0, 0, 0), shin_L=0, shin_R=0, foot_L=0, foot_R=0)
        if name == 'idle_cup':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.relaxed_arm(frame, 'L', interp)
        elif name == 'idle_cup_high':
            self.hold_cup(frame, 'R', **IDLE_CUP_HIGH, interp=interp)
            self.relaxed_arm(frame, 'L', interp)
        elif name == 'thumbs_up':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            # fist in front of the chest, knuckles to camera, thumb straight up and clear of the fist
            self.place_arm_clear(frame, 'L', V((0.19, -0.38, 1.13)), hand_u=V((-0.42, -0.90, 0.10)),
                                 hand_w=V((-0.90, 0.42, 0.0)), pole=V((0.55, 0.25, -0.8)), interp=interp,
                                 fingers=1.0)
            p(frame, interp, fingers_L=1.0, thumb_L='up')
        elif name == 'sip':
            self.sip_stage(frame, 3, interp)
            self.relaxed_arm(frame, 'L', interp)
        elif name == 'hands_clasped':
            # executive steeple: wrists at (+-0.17, -0.30, 1.10), fingertips touching in front of the
            # sternum, elbows out ~20 deg. Needs both hands free: park the cup first
            # (rig.attach_cup(frame, None) and key it on a desk).
            curl = 0.10
            ang = [a * curl for a in FIST]
            for s_, sx in (('R', -1.0), ('L', 1.0)):
                wrist = V((0.17 * sx, -0.30, 1.10))
                lo, hi = 0.3, 1.2
                for _ in range(24):            # turn the hand in until the middle fingertip meets the centre line
                    kx = (lo + hi) / 2
                    u = V((-kx * sx, -0.32, 0.50)).normalized()
                    w = V((-sx, 0.0, 0.0))
                    w = (w - u * w.dot(u)).normalized()
                    hd = self.hands[s_]
                    Rt = frame3(u, w) @ frame3(hd['u'], hd['w']).transposed()
                    tip = wrist + Rt @ (self.fingertip(s_, 'middle', ang) - hd['W'])
                    if tip.x * sx > 0.0045:
                        lo = kx
                    else:
                        hi = kx
                self.place_arm_clear(frame, s_, wrist, hand_u=u, hand_w=w, pole=V((0.95 * sx, 0.15, -0.35)),
                                     interp=interp, fingers=curl)
            p(frame, interp, fingers_L=curl, fingers_R=curl, thumb_L=0.3, thumb_R=0.3)
        elif name == 'reach_L':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.reach_L(frame, interp=interp)
        elif name == 'seated':
            drop = -(HIP_Z - KNEE_Z)
            p(frame, interp, thigh_L=(88, 3, 0), thigh_R=(88, 3, 0), shin_L=88, shin_R=88, foot_L=0, foot_R=0)
            self.key_loc('root', frame, V((0, 0, drop)), interp, index=1)
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.place_arm_clear(frame, 'L', V((0.15, -0.14, 0.955)), hand_u=V((0.0, -1.0, 0.0)),
                                 hand_w=V((0.2, 0, -1)), pole=V((0.9, 0.4, -0.2)), interp=interp, fingers=0.06)
            p(frame, interp, fingers_L=0.06, thumb_L='up')
        elif name == 'post_L':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.post_pose(frame, height=0.016, interp=interp)

    def hold_cup(self, frame, s, cup_base, finger_dir, pole, cup_axis=UP, interp='BEZIER',
                 chest_rest_offset=V((0, 0, 0)), shoulder=None, clear=True):
        """Pose arm s so its hand holds the cup with its base centre at cup_base
        (chest-rest space) and its axis along cup_axis; fingers wrap the cup. With clear=True
        (and no explicit shoulder) the elbow pole and a small shoulder offset are searched
        around `pole` so the arm clears the chest, pauldron and head."""
        base = V(cup_base) - chest_rest_offset
        wrist, u, w = self.cup_hand_frame(s, base, cup_axis, finger_dir)
        if shoulder is None and clear:
            sol = self._cup_solution(base, finger_dir, s=s, axis=cup_axis, pole=pole)
            pole, shoulder = sol['pole'], sol['shoulder']
        self.place_arm(frame, s, wrist, u, w, pole, interp, shoulder=shoulder or (0.0, 0.0, 0.0))
        self.pose(frame, interp, **{f'fingers_{s}': 'grip', f'thumb_{s}': 'grip'})

    def lean(self, frame, deg, interp='BEZIER', turn=0.0, keep_cup=False):
        """A small forward lean from the waist (S10 jack reach): spine and chest pitch half each,
        clamped to 8 deg in total; `turn` yaws the chest the same way. Key it before any
        place_arm(..., space='world') at that frame. keep_cup=True re-solves the right arm so
        the cup keeps the world position and orientation it had at `frame` before the lean
        (canon: the cup does not move until S13)."""
        held = self._cup_grip_world(frame) if keep_cup else None
        d = max(-8.0, min(8.0, float(deg)))
        t = max(-8.0, min(8.0, float(turn)))
        self.pose(frame, interp, spine=(d * 0.5, 0.0, t * 0.5), chest=(d * 0.5, 0.0, t * 0.5))
        if held is not None:
            self.hold_cup_world(frame, *held, interp=interp)

    def _cup_grip_world(self, frame, s='R'):
        """(cup base, cup axis, finger direction) in world space at frame, from the posed hand
        (None when the cup is not in hand s)."""
        if self.cup is None or self.cup.constraints[f'hold_{s}'].influence < 0.5:
            return None
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        Mc = self.cup.evaluated_get(dg).matrix_world.copy()
        ae = self.arm.evaluated_get(dg)
        Dh = ae.matrix_world @ ae.pose.bones[f'hand_{s}'].matrix @ self._rest[f'hand_{s}'].inverted()
        ax = (Mc.to_3x3() @ UP).normalized()
        u = (Dh.to_3x3() @ self.hands[s]['u']).normalized()
        fdir = (u - ax * u.dot(ax)).normalized()
        return Mc.translation.copy(), ax, fdir

    def hold_cup_world(self, frame, base, axis, finger_dir, s='R', interp='BEZIER', pole=None):
        """hold_cup with a world-space cup base, axis and finger direction, honouring the root,
        spine and chest keyed at `frame` (key them first)."""
        Dc = self._chest_delta(frame)
        R3 = Dc.to_3x3()
        self.hold_cup(frame, s, cup_base=Dc @ V(base), finger_dir=(R3 @ V(finger_dir)).normalized(),
                      pole=V(pole) if pole is not None else V(IDLE_CUP['pole']),
                      cup_axis=(R3 @ V(axis)).normalized(), interp=interp)

    def breathe(self, start, end, amp=0.002, period=72, interp='BEZIER'):
        """Faint mechanical breathing (S02): the torso plates (and the blue chip on its plate) rise
        `amp` metres and settle once every `period` frames between start and end. Keyed on the
        plates only, so the shoulders, arms, cup and head never move with it."""
        objs = list(self.torso_plates)
        half = max(1, int(round(period / 2)))
        for o in objs:
            if '_breath_rest' not in o:
                o['_breath_rest'] = tuple(o.location)
            L0 = V(o['_breath_rest'])
            f, up = start, False
            while f <= end:
                o.location = L0 + UP * (amp if up else 0.0)
                o.keyframe_insert('location', frame=f)
                f += half
                up = not up
            o.location = L0
            o.keyframe_insert('location', frame=end)
            for fc in C.fcurves(o.animation_data.action):
                if fc.data_path == 'location':
                    for kp in fc.keyframe_points:
                        if start <= kp.co.x <= end:
                            kp.interpolation = interp

    def headband_world(self, frame):
        """(points, outward normals) of the headset's band in world space at frame (it rides on the head)."""
        if not self.headband:
            return [], []
        Pw = self._bone_world('head', frame)
        D = Pw @ self._rest['head'].inverted()
        R3 = D.to_3x3()
        pts, nrm = self.headband
        return [D @ p for p in pts], [(R3 @ n_).normalized() for n_ in nrm]

    def grip_headband(self, frame, interp='BEZIER', above=None, curl=None):
        """S11 f1129: the LEFT hand grips the headband just above the left earcup: palm flat on
        the band's outer face, fingers up and forward with their tips curled in past the band's
        front edge, thumb behind it. Solved against the torso, head, its own pauldron (which
        hinges up for the raised arm) and the band itself. Key the head and chest at `frame`
        first, then call attach_headset(frame, 'hand_L'). Returns the solution."""
        pts, nrm = self.headband_world(frame)
        if not pts:
            return None
        acc = [0.0]
        for a_, b_ in zip(pts, pts[1:]):
            acc.append(acc[-1] + (b_ - a_).length)
        Dhw = self._bone_world('head', frame) @ self._rest['head'].inverted()
        best = None
        for ab in ((above,) if above is not None else (0.03, 0.045, 0.06)):
            sol = self._grip_band_at(frame, pts, nrm, acc, ab, curl, Dhw)
            if best is None or sol['score'] < best['score']:
                best = sol
        self.place_arm(frame, 'L', best['wrist'], best['u'], best['w'], best['pole'], interp, shoulder=best['shoulder'])
        self.pose(frame, interp, fingers_L={nm: tuple(a * best['curl'] * k_ for a in FIST)
                                            for nm, k_ in (('index', 0.9), ('middle', 1.0), ('ring', 1.05),
                                                           ('pinky', 1.1))}, thumb_L=best['thumb'])
        return best

    def _grip_band_at(self, frame, pts, nrm, acc, above, curl, Dhw):
        i = min(range(len(pts)), key=lambda k: abs(acc[k] - above))
        p, n_out = pts[i], nrm[i]
        tan = (pts[min(len(pts) - 1, i + 1)] - pts[max(0, i - 1)]).normalized()
        wdir = tan.cross(n_out).normalized()
        if wdir.y > 0:
            wdir = -wdir                                  # across the band, toward the front
        Dc = self._chest_delta(frame)
        R3 = Dc.to_3x3()
        hd = self.hands['L']
        W0 = self.arm.data.bones['hand_L'].head_local
        palm_pt = W0 + hd['u'] * 0.058 + hd['w'] * 0.0125
        obstacles = []
        for k in range(len(pts)):                          # the flat band (26 x 7.5 mm + its inner pad)
            tk = (pts[min(len(pts) - 1, k + 1)] - pts[max(0, k - 1)]).normalized()
            wk = tk.cross(nrm[k]).normalized()
            for off in (-0.0105, 0.0, 0.0105):
                obstacles.append((Dc @ (pts[k] + wk * off - nrm[k] * 0.002), 0.0058))
        if self._earcup_L is not None:                    # the left earcup and its slider
            obstacles.append((Dc @ (Dhw @ self._earcup_L[0]), 0.073))      # shell + yoke
            obstacles.append((Dc @ (Dhw @ self._earcup_L[1]), 0.022))
        best = None
        for c_, tc in [(c0, t0) for c0 in ((curl,) if curl is not None else (0.30, 0.45))
                       for t0 in (-0.6, -0.3, 0.0, 0.25, 0.5)]:     # < 0: thumb laid back along the band
            fing = {nm: [a * c_ * k_ for a in FIST] for nm, k_ in (('index', 0.9), ('middle', 1.0), ('ring', 1.05),
                                                                     ('pinky', 1.1))}
            frames_ = []
            for a_ in (-30, -15, 0, 15, 30):
                u = (Matrix.Rotation(math.radians(a_), 3, n_out) @ (tan * 0.55 + wdir * 0.83)).normalized()
                w = -n_out
                w = (w - u * w.dot(u)).normalized()
                frames_.append((R3 @ u, R3 @ w))
            sol = self.solve_arm_clear('L', Dc @ (p + n_out * 0.0072), frames_,
                                       [V(q).normalized() for q in ((0.9, -0.3, -0.1), (0.8, -0.5, 0.2), (0.7, 0.2, -0.3),
                                                                    (0.6, -0.7, -0.2), (0.4, -0.9, -0.1), (0.3, -0.9, -0.3),
                                                                    (0.5, -0.8, -0.35), (0.2, -0.95, -0.2))],
                                       [(0, 0, 0), (8, 0, 0), (14, 2, 0), (20, 0, 0), (0, 5, 0), (25, 2, 0)],
                                       fingers=fing, point_local=palm_pt, obstacles=obstacles,
                                       thumb=self.thumb_curl_rots('L', tc))
            sol['curl'] = c_
            sol['thumb'] = tc
            sol['above'] = above
            if best is None or sol['score'] < best['score']:
                best = sol
        return best

    def relaxed_arm(self, frame, s, interp='BEZIER'):
        """Arm hanging relaxed: fingers curled 0.35 (index) to 0.55 (pinky), thumb 0.3."""
        self.pose(frame, interp, **{f'upperarm_{s}': (6, 3, 0), f'forearm_{s}': 18, f'hand_{s}': (6, 0, 0),
                                    f'fingers_{s}': 'relaxed', f'thumb_{s}': 0.3, f'shoulder_{s}': (0, 0, 0),
                                    f'pauldron_{s}': (0, 0, 0)})
        self.key_loc(f'pauldron_{s}', frame, V((0, 0, 0)), interp)

    # ---------------------------------------------------- cup slot, posting and the sip
    def slot_dir_for(self, s, finger_dir, cup_axis=UP):
        """Horizontal direction the sip slot faces for a hold_cup finger_dir."""
        wrist, u, w = self.cup_hand_frame(s, V((0, 0, 0)), cup_axis, finger_dir)
        c = V(cup_axis).normalized()
        un = (u - c * u.dot(c)).normalized()
        wn = (w - c * w.dot(c)).normalized()
        return (-un * math.cos(SLOT_BETA) + wn * math.sin(SLOT_BETA)).normalized()

    def finger_dir_for_slot(self, slot_dir, s='R'):
        """finger_dir for hold_cup (level cup) that turns the sip slot toward slot_dir."""
        sd = V((slot_dir[0], slot_dir[1], 0.0)).normalized()
        best = None
        for k in range(360):
            a = math.radians(k)
            fdir = V((math.cos(a), math.sin(a), 0.0))
            d = (self.slot_dir_for(s, fdir) - sd).length
            if best is None or d < best[0]:
                best = (d, fdir)
        return best[1]

    def _chest_delta(self, frame):
        """Armature-world -> chest-rest-space transform at frame (shots may move root/chest)."""
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        ae = self.arm.evaluated_get(dg)
        pb = ae.pose.bones['chest']
        D = pb.matrix @ self._rest['chest'].inverted()
        return (ae.matrix_world @ D).inverted()

    def slot_world(self, frame):
        """(position, axis out of the slot) of the sip slot in world space at frame."""
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        Mw = self.slot.evaluated_get(dg).matrix_world
        return Mw.translation.copy(), (Mw.to_3x3() @ V((0, 0, 1))).normalized()

    def slot_frame_world(self, frame, slot=None):
        """(position, axis out of the slot, across) of a slot at `frame`: slot None (the rig's own
        cup), an Object (a slot empty: Z out of the slot, X along it, Y across toward the cup's
        axis) or a (position, axis[, across]) tuple (across None when unknown)."""
        if slot is None:
            slot = self.slot
        if isinstance(slot, bpy.types.Object):
            sc = bpy.context.scene
            sc.frame_set(frame)
            dg = bpy.context.evaluated_depsgraph_get()
            Mw = slot.evaluated_get(dg).matrix_world
            R3 = Mw.to_3x3()
            return Mw.translation.copy(), (R3 @ V((0, 0, 1))).normalized(), (R3 @ V((0, 1, 0))).normalized()
        pos, ax = V(slot[0]), V(slot[1]).normalized()
        across = V(slot[2]).normalized() if len(slot) > 2 and slot[2] is not None else None
        return pos, ax, across

    @staticmethod
    def _post_height(height, extent):
        return height if extent is None else max(height, float(extent) + 0.002)

    def post_pose(self, frame, height=0.016, interp='BEZIER', slot=None, gap=None, extent=None, fingers=None):
        """Key the LEFT hand pinching (thumb + index, `gap` metres between the pads) with the
        pinch point `height` above the sip slot along its axis (fingertip surfaces ~5-10 mm
        above it; cup and head untouched). Pose the cup arm at `frame` first.
        slot: optional slot (see slot_frame_world); default: the cup's slot at that frame.
        extent: how far the held object reaches below the pinch point along the slot axis (the
        padlock: PADLOCK_EXTENT); the pinch then sits at least extent + 2 mm above the slot.
        fingers: the left hand's finger shape (default 'pinch'; the padlock: PADLOCK_FINGERS)."""
        pos, ax, across = self.slot_frame_world(frame, slot)
        height = self._post_height(height, extent)
        Dc = self._chest_delta(frame)
        tgt = Dc @ (pos + ax * height)
        axr = (Dc.to_3x3() @ ax).normalized()
        cup_base = Dc @ self._cup_base_world(frame, pos, ax, across)
        fingers = 'pinch' if fingers is None else fingers
        sol = self._post_solution(tgt, axr, cup_base, gap, fingers)
        self.place_arm(frame, 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], interp, shoulder=sol['shoulder'])
        self.pose(frame, interp, fingers_L=fingers, thumb_L=('pinch', gap))
        return sol

    def post(self, frame, approach=0.045, height=0.016, approach_frames=8, lift_frames=6, interp='BEZIER',
             slot=None, gap=None, approach_dir=None, step=1, extent=None, fingers=None):
        """The posting action of the LEFT hand. The pinch point travels in ONE straight,
        mechanical line: `approach` metres out along `approach_dir` (world; default the slot's
        axis, i.e. straight down into the slot) at frame - approach_frames, eased in to contact
        (`height` above the slot, fingertips 5-10 mm) on `frame`, then back out along the same
        line by frame + lift_frames. The contact pose is solved once (clearance search); every
        other frame (each `step` frames) keeps that hand orientation, elbow pole and shoulder and
        only re-solves the arm, so the hand never arcs or wobbles (LINEAR keys in between).
        Head and cup do not move. The shot shrinks its object into the slot (from contact on)
        and calls rig.cup_handle.slot_glow(). The padlock (S05, S09):
        post(f, gap=PADLOCK_GAP, extent=PADLOCK_EXTENT, fingers=PADLOCK_FINGERS). Returns {frame: solution}."""
        pos, ax, across = self.slot_frame_world(frame, slot)
        height = self._post_height(height, extent)
        line = V(approach_dir).normalized() if approach_dir is not None else ax
        fingers = 'pinch' if fingers is None else fingers
        sol = self.post_pose(frame, height, 'LINEAR', slot=(pos, ax, across), gap=gap, fingers=fingers)
        pin = self.thumb_pinch('L', gap=gap)
        hd = self.hands['L']
        W0 = self.arm.data.bones['hand_L'].head_local
        Rt = frame3(sol['u'], sol['w']) @ frame3(hd['u'], hd['w']).transposed()
        off = Rt @ (pin['point'] - W0)
        out = {frame: sol}
        frames = sorted(set(list(range(frame - approach_frames, frame, max(1, step))) + [frame - approach_frames] +
                            list(range(frame + max(1, step), frame + lift_frames + 1, max(1, step))) +
                            [frame + lift_frames]))
        for f in frames:
            if f == frame:
                continue
            if f < frame:
                t = (frame - f) / max(1, approach_frames)
            else:
                t = (f - frame) / max(1, lift_frames)
            d = approach * (t * t * (3 - 2 * t))
            Dc = self._chest_delta(f)
            tgt = Dc @ (pos + ax * height + line * d)
            ip = interp if f in (frame - approach_frames, frame + lift_frames) else 'LINEAR'
            self.place_arm(f, 'L', tgt - off, sol['u'], sol['w'], sol['pole'], ip, shoulder=sol['shoulder'])
            self.pose(f, ip, fingers_L=fingers, thumb_L=('pinch', gap))
            out[f] = sol
        return out

    @staticmethod
    def _slot_z():
        return PR._lid_z(PR.CUP['slot_r'], PR.CUP['slot_theta'])

    def _cup_base_world(self, frame, pos, ax, across=None):
        """World centre of the cup's base for a slot at (pos, axis): the cup root itself when the
        rig's cup carries that slot, else the point under the slot moved in to the cup's axis
        (`across`: the slot empty's local Y, which points from the slot to the cup's axis; without
        it the axis is assumed to pass through the slot, which is off by slot_r)."""
        if self.cup is not None and self.slot is not None:
            sc = bpy.context.scene
            sc.frame_set(frame)
            dg = bpy.context.evaluated_depsgraph_get()
            sp_ = self.slot.evaluated_get(dg).matrix_world.translation
            if (sp_ - V(pos)).length < 1e-4:
                return self.cup.evaluated_get(dg).matrix_world.translation.copy()
        # slot empty: X along the slot, Z out of it, Y across it toward the cup's axis (slot_r away)
        base = V(pos) - V(ax) * self._slot_z()
        if across is not None:
            base = base + V(across).normalized() * PR.CUP['slot_r']
        return base

    def _post_solution(self, tgt, ax, cup_base, gap=None, fingers='pinch'):
        key = ('post', tuple(round(x, 4) for x in tgt), tuple(round(x, 3) for x in ax), gap, str(fingers))
        if key in self._grip:
            return self._grip[key]
        pin = self.thumb_pinch('L', gap=gap)
        fingers = self.finger_angles('L', fingers)
        frames = []
        ax = V(ax).normalized()
        for el in (35, 50, 62, 75):                      # how steeply the hand points down
            for az in range(150, 271, 20):              # where it comes from (around the slot)
                e, a_ = math.radians(el), math.radians(az)
                hu = V((math.cos(e) * math.cos(a_), math.cos(e) * math.sin(a_), -math.sin(e)))
                side = hu.cross(V((0, 0, 1))).normalized()
                for roll in (-50, -25, 0, 25, 50):
                    hw = Matrix.Rotation(math.radians(roll), 3, hu) @ side
                    frames.append((hu, hw))
        poles = [V((0.6, -0.6, -0.5)), V((0.9, -0.2, -0.4)), V((0.3, -0.9, -0.3)), V((0.8, -0.5, 0.0)),
                 V((0.5, -0.4, -0.8))]
        shoulders = [(0, 0, 0), (12, 0, 0), (22, 3, 0), (32, 5, 0), (16, 8, 0), (26, 9, 0), (8, 6, 0)]
        lim = LID_TOP + 0.003

        def keep_above(hu, hw, pole, sh, chain):
            """Reject any palm, finger or thumb sample that reaches below the lid top + 3 mm
            within the lid's footprint (a padlock-sized gap opens the hand)."""
            pen = 0.0
            for p, r, part in self._arm_samples('L', chain, fingers, thumb=pin['rot']):
                if part not in ('palm', 'finger', 'tip', 'thumb', 'wrist'):
                    continue
                rel = p - cup_base
                hh = rel.dot(ax)
                if (rel - ax * hh).length < LID_R + 0.008 + r:
                    d = hh - r - lim
                    if d < 0:
                        pen -= d * 2000.0
            return pen
        sol = self.solve_arm_clear('L', tgt, frames, poles, shoulders, fingers=fingers, cup=(cup_base, ax),
                                   point_local=pin['point'], thumb=pin['rot'], prefer=keep_above)
        self._grip[key] = sol
        return sol

    # ---------------------------------------------------- reach (S04 / S09 table touch)
    REACH_L_TIP = (0.29, -0.49, 0.755)    # = env_room ROOM['fingertip_L'] at SYNERGY_POS (0, 0.40, 0), rig space
    TABLE_Z = 0.75

    def _reach_solution(self, tip, table_z):
        """Left hand palm-down, index straight, the other fingers loosely curled: the index tip
        end at `tip` (chest-rest space) with the lowest point of the finger 1 mm above table_z,
        every other part of the hand >= 6 mm above it."""
        key = ('reach', tuple(round(x, 4) for x in tip), round(table_z, 4))
        if key in self._grip:
            return self._grip[key]
        hd = self.hands['L']
        W0 = hd['W']
        fd = hd['fingers']['index']
        best = None
        for pitch in (28, 32, 36, 40, 44, 48, 52):
            for yaw in (-6, 0, 6):
                p, y = math.radians(pitch), math.radians(yaw)
                u = V((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), -math.sin(p)))
                w = V((math.sin(y) * math.sin(p), -math.cos(y) * math.sin(p), math.cos(p))) * -1.0
                Rt = frame3(u, w) @ frame3(hd['u'], hd['w']).transposed()
                for curl in (0.75, 0.9, 1.0):          # the other three tuck into a loose fist
                    ang = {'index': (0.0, 0.0, 0.0)}
                    for nm, k_ in (('middle', 1.0), ('ring', 1.15), ('pinky', 1.3)):
                        ang[nm] = tuple(a * min(1.0, curl * k_) for a in FIST)
                    # index distal underside (local, hand-rest) and the tip end
                    end = fd['K'] + fd['dir'] * sum(fd['lens'])
                    dd = fd['dir']
                    low_index = min((Rt @ (end - dd * t_ - W0)).z - r_ for t_, r_ in
                                    ((0.0003, 0.0022), (0.001, 0.0045), (0.0028, 0.0063), (0.0055, 0.0071),
                                     (0.009, 0.0072), (0.02, 0.0074), (0.03, 0.0076)))
                    tip_rel = Rt @ (end - W0)
                    others = []
                    for nm in ('middle', 'ring', 'pinky'):
                        for q in self.finger_points('L', nm, ang[nm]):
                            others.append((Rt @ (q - W0)).z - 0.0085)
                    palm = min((Rt @ (W0 + hd['u'] * uu + hd['v'] * vv + hd['w'] * ww - W0)).z
                               for uu in (0.0, 0.1) for vv in (-0.045, 0.045) for ww in (-0.018, 0.016))
                    T0, T1, T2, T3 = hd['thumb']['pts']
                    R0, R1, R2 = self.thumb_curl_rots('L', REACH_THUMB)
                    t1 = T0 + R0 @ (T1 - T0)
                    t2 = t1 + R0 @ R1 @ (T2 - T1)
                    t3 = t2 + R0 @ R1 @ R2 @ (T3 - T2)
                    palm = min([palm] + [(Rt @ (q - W0)).z - 0.0105 for q in (t1, t2, t3, t2.lerp(t3, 0.5))])
                    wrist_z = table_z + 0.001 - low_index
                    clear = min(min(others), palm) + wrist_z - table_z
                    if REACH_DEBUG:
                        print('REACH', pitch, yaw, curl, 'low_index', round(low_index, 4), 'others',
                              round(min(others), 4), 'palm', round(palm, 4), 'clear', round(clear, 4))
                    if clear < 0.006:
                        continue
                    wrist = V(tip) - V((tip_rel.x, tip_rel.y, 0.0))
                    wrist.z = wrist_z
                    tip_z = wrist_z + tip_rel.z
                    score = pitch * 0.01 + abs(yaw) * 0.005 - curl * 0.1 + abs(tip_z - tip[2]) * 100
                    if best is None or score < best[0]:
                        best = (score, wrist, u, w, ang, tip_z)
        if best is None:
            raise RuntimeError('reach_L: no palm-down hand pose clears the table')
        _, wrist, u, w, ang, tip_z = best
        sol = self.solve_arm_clear('L', wrist, [(u, w)],
                                   [V((0.6, 0.35, -0.7)), V((0.9, 0.2, -0.4)), V((0.5, 0.6, -0.6)), V((0.8, -0.1, -0.6)),
                                    V((0.95, 0.3, 0.0))],
                                   [(0, 0, 0), (8, 0, 0), (16, 2, 0), (24, 4, 0), (-6, 0, 0)],
                                   fingers=ang)
        sol['fingers'] = ang
        sol['tip_z'] = tip_z
        self._grip[key] = sol
        return sol

    def reach_L(self, frame, tip=None, interp='BEZIER', table_z=None):
        """S04/S09: the LEFT index fingertip resting on the walnut, palm down, index straight.
        tip: world point (default env_room's fingertip_L contract: rig-space REACH_L_TIP, used as
        is when the rig stands at the origin); table_z: world height of the walnut (0.75). Key
        the root/chest at `frame` first when tip is given in world space."""
        if tip is None:
            tipc, tz = V(self.REACH_L_TIP), self.TABLE_Z if table_z is None else table_z
        else:
            Dc = self._chest_delta(frame)
            tipc = Dc @ V(tip)
            tz = (Dc @ V((tip[0], tip[1], self.TABLE_Z if table_z is None else table_z))).z
        sol = self._reach_solution(tipc, tz)
        self.place_arm(frame, 'L', sol['wrist'], sol['u'], sol['w'], sol['pole'], interp, shoulder=sol['shoulder'])
        self.pose(frame, interp, fingers_L=sol['fingers'], thumb_L=REACH_THUMB)
        return sol

    # ---------------------------------------------------- the sip (S13)
    # the spout meets the chin plate just below the screen (head-local canon point), the head
    # tips back 5 deg; the cup is held exactly as at the chest (palm on its right side, fingers
    # round the front), so the lift is one rigid move and the cup reads beside the hand
    SIP_TARGET = (-0.016, -0.146, 0.041)
    SIP_HEAD = (-5.0, 4.0, 0.0)
    SIP_TILT = 16.0                       # at contact the cup tips 16 deg toward the face (spout edge on the chin)
    SIP_STAGE_T = {0: 0.0, 1: 0.30, 2: 0.60, 2.5: 0.86, 3: 1.0}   # path fraction per stage (2.5 = chin level)

    def _head_fk(self, neck=(0, 0, 0), head=(0, 0, 0)):
        b = self.arm.data.bones
        Dn = self._about(b['neck'].head_local, self.control_rotation('neck', neck))
        Dh = Dn @ self._about(b['head'].head_local, self.control_rotation('head', head))
        return Dh

    def _cup_hull_pen(self, base, Dh=None, margin=0.005, spare=None, axis=UP):
        """Squared penetration of the cup + lid (base centre `base`, axis `axis`) into the torso
        hull and the head (posed by Dh), samples within 2 cm of `spare` (the spout contact) excused."""
        pen = 0.0
        th = self._builder_hulls.get('torso')
        hh = self._builder_hulls.get('head')
        Di = Dh.inverted() if Dh is not None else None
        ax = V(axis).normalized()
        e1 = ax.orthogonal().normalized()
        e2 = ax.cross(e1)
        for h_ in (0.0, 0.03, 0.06, 0.09, 0.108, 0.122):
            r = cup_radius(h_) if h_ < LID_SKIRT_Z else LID_R
            for i in range(12):
                a = 2 * math.pi * i / 12
                p = V(base) + (e1 * math.cos(a) + e2 * math.sin(a)) * r + ax * h_
                if th is not None:
                    d = th.sdf(p) - margin
                    if d < 0:
                        pen += d * d
                if hh is not None and Di is not None and (spare is None or (p - spare).length > 0.02):
                    d = hh.sdf(Di @ p) - margin
                    if d < 0:
                        pen += d * d
        return pen

    def _sip_prefer(self, base):
        b = self.arm.data.bones
        S0, E0 = b['upperarm_R'].head_local, b['forearm_R'].head_local
        W0 = b['hand_R'].head_local

        def pref(hu, hw, pole, sh, chain):
            S_ = chain[0] @ S0
            E = chain[1] @ E0
            Wp = chain[2] @ W0
            pen = 0.0
            if E.z > base.z - 0.015:                         # the elbow stays below the cup
                pen += (E.z - base.z + 0.015) * 60.0
            if E.z > S_.z + 0.075:                           # ... and not lifted much above the shoulder
                pen += (E.z - S_.z - 0.075) * 60.0
            du = (E - S_).normalized()
            abd = math.degrees(math.asin(max(-1.0, min(1.0, -du.x))))     # outward (his right is -X)
            if abd > 40.0:
                pen += (abd - 40.0) * 0.06
            fz = (Wp - E).normalized().z
            if fz < 0.45:                                    # the forearm angles UP to the cup
                pen += (0.45 - fz) * 3.0
            if E.y > -0.30:                                  # elbow out in front of the chest plates (~12-15 cm)
                pen += (E.y + 0.30) * 20.0
            fdir_ = (Wp - E).normalized()
            if fdir_.dot(hw) < -0.25:                        # never flex the wrist into the palm
                pen += (-0.25 - fdir_.dot(hw)) * 6.0
            pen += abs(sh[1]) * 0.01 + max(0.0, abs(sh[0]) - 15.0) * 0.02
            if base.z > 1.30:                                # near the face: keep the cup in view of S13
                pen += max(0.0, 0.62 - self._cup_visibility(base, None, chain=chain)) * 6.0
                # ... and let the forearm read as one clean diagonal in that frame (~50 deg on screen)
                cam = V(self.SIP_CAM)
                fw = (V((0.0, -0.05, 1.40)) - cam).normalized()
                rt = fw.cross(UP).normalized()
                up_ = rt.cross(fw)

                def scr(p_):
                    d_ = p_ - cam
                    return V((d_.dot(rt) / d_.dot(fw), d_.dot(up_) / d_.dot(fw)))
                fe = scr(Wp) - scr(E)
                ang = abs(math.degrees(math.atan2(fe.y, abs(fe.x) + 1e-9)))
                pen += abs(ang - 50.0) * 0.02
            return pen
        return pref

    def _sip_arm(self, base, fdir, prev=None, axis=UP):
        """Arm solution (chest-rest) holding the cup at `base` (axis `axis`: tilted toward the face
        at the contact), low elbow held forward, forearm up."""
        axis = V(axis).normalized()
        key = ('siparm', tuple(round(x, 4) for x in base), tuple(round(x, 3) for x in fdir),
               tuple(round(x, 3) for x in axis),
               None if prev is None else (tuple(round(x, 2) for x in prev['pole']), prev['shoulder']))
        if key in self._grip:
            return self._grip[key]
        wrist, u, w = self.cup_hand_frame('R', base, axis, fdir)
        poles = [V(q).normalized() for q in ((-0.30, -0.65, -0.70), (-0.50, -0.55, -0.65), (-0.15, -0.80, -0.55),
                                              (-0.65, -0.35, -0.65), (0.0, -0.75, -0.65), (-0.40, -0.80, -0.45),
                                              (-0.75, -0.50, -0.45), (-0.25, -0.45, -0.85), (-0.10, -0.40, -0.90),
                                              (0.10, -0.55, -0.83), (-0.35, -0.25, -0.90), (-0.60, -0.60, -0.55),
                                              (-0.55, -0.70, -0.35), (-0.70, -0.65, -0.30), (-0.45, -0.65, -0.60),
                                              (-0.80, -0.35, -0.50))]
        shoulders = [(0, 0, 0), (8, 0, 0), (14, 0, 0), (20, 0, 0), (25, 0, 0), (22, 2, 0)]
        pref0 = self._sip_prefer(base)
        if prev is not None:
            def pref(hu, hw, pole, sh, chain):
                return pref0(hu, hw, pole, sh, chain) + (V(pole) - prev['pole']).length * 0.6 + \
                    (abs(sh[0] - prev['shoulder'][0]) + abs(sh[1] - prev['shoulder'][1])) * 0.02
            poles = [prev['pole']] + poles
            shoulders = [prev['shoulder']] + shoulders
        else:
            pref = pref0
        sol = self.solve_arm_clear('R', wrist, [(u, w)], poles, shoulders, fingers=self.finger_angles('R', 'grip'),
                                   thumb=self.grip_angles('R')['thumb'], prefer=pref, cup_arm=(V(base), axis))
        sol['base'] = V(base)
        sol['fdir'] = V(fdir)
        sol['axis'] = axis
        self._grip[key] = sol
        return sol

    SIP_CAM = (-0.264, -1.881, 1.35)      # S13 camera in rig space (1.9 m, 8 deg to his right, 1.35 m high)

    def _cup_visibility(self, base, fdir, sol=None, chain=None):
        """Fraction of the cup's camera-facing surface (S13 camera) not hidden by the right hand,
        wrist or forearm (capsule samples)."""
        cam = V(self.SIP_CAM)
        if chain is None:
            chain = self._arm_chain('R', *self._arm_solution('R', sol['wrist'], sol['u'], sol['w'], sol['pole'],
                                                              sol['shoulder']))
        caps = [(p, r) for p, r, part in self._arm_samples('R', chain, self.finger_angles('R', 'grip'),
                                                          thumb=self.grip_angles('R')['thumb'])
                if part in ('fore', 'wrist', 'palm', 'finger', 'tip', 'thumb', 'elbow')]
        tot = vis = 0
        for hh in (0.01, 0.03, 0.05, 0.07, 0.09, 0.105, 0.12):
            r = cup_radius(hh) if hh < LID_SKIRT_Z else LID_R
            for i in range(24):
                a = 2 * math.pi * i / 24
                n_ = V((math.cos(a), math.sin(a), 0.0))
                p = V(base) + n_ * r + UP * hh
                d = cam - p
                if n_.dot(d) <= 0:
                    continue
                tot += 1
                dn = d.normalized()
                hit = False
                for q, rq in caps:
                    t = (q - p).dot(dn)
                    if t > 0 and (p + dn * t - q).length < rq * 0.9:
                        hit = True
                        break
                vis += 0 if hit else 1
        return vis / max(1, tot)

    def _sip_path(self, head=None):
        """(base(t), fdir(t)) of the lift, t 0 (idle) -> 1 (contact). The hand turns the cup
        (as one with the wrist) just far enough that the sip slot faces straight back at the chin
        plate, choosing the turn that keeps the elbow low, the wrist natural and most of the cup
        in view of the S13 camera; the cup rises level along a line pushed forward where needed
        so it clears the breastplate and the head by >= 5 mm all the way."""
        head = tuple(head or self.SIP_HEAD)
        key = ('sippath', head)
        if key in self._grip:
            return self._grip[key]
        Dh = self._head_fk((0, 0, 0), head)
        spout = Dh @ H(self.SIP_TARGET)
        f0 = V(IDLE_CUP['finger_dir'])
        idle_base = V(IDLE_CUP['cup_base'])
        best = None
        for yaw in range(0, 61, 2):
            fdir = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ f0
            sd = self.slot_dir_for('R', fdir)
            if math.degrees(sd.angle(V((0.0, 1.0, 0.0)))) > 5.0:
                continue
            Rt = rot_to(UP, sd, self.SIP_TILT)            # the top tips toward the face: a real sip
            sip_base = spout - Rt @ (UP * (self._slot_z() + SIP_GAP) + sd * PR.CUP['slot_r'])
            sol = self._sip_arm(sip_base, Rt @ fdir, axis=Rt @ UP)
            vis = self._cup_visibility(sip_base, fdir, sol)
            score = sol['score'] + max(0.0, 0.62 - vis) * 25.0
            if SIP_DEBUG:
                print('SIP yaw', yaw, 'sd', tuple(round(x, 2) for x in sd), 'score', round(sol['score'], 3), 'pen',
                      round(sol['pen'], 6), 'vis', round(vis, 2), 'pole', tuple(round(x, 2) for x in sol['pole']),
                      'sh', sol['shoulder'])
            if best is None or score < best[0]:
                best = (score, yaw, fdir, sip_base, vis)
        if best is None:
            raise RuntimeError('sip: no hand turn faces the slot to the chin')
        _, yaw, fdir_sip, sip_base, vis = best
        sd_sip = self.slot_dir_for('R', fdir_sip)
        zf = lambda t: t * t * (3 - 2 * t) * 0.35 + t * 0.65

        def tilt_at(t):        # level until chin height, then it tips toward the face on the final rise
            x = max(0.0, min(1.0, (t - 0.86) / 0.14))
            return rot_to(UP, sd_sip, self.SIP_TILT * x * x * (3 - 2 * x))

        def fdir_at(t):
            return tilt_at(t) @ (Matrix.Rotation(math.radians(yaw * min(1.0, t / 0.86)), 3, 'Z') @ f0)

        def axis_at(t):
            return tilt_at(t) @ UP
        bulge = 0.0
        for _ in range(12):
            ok = True
            for i in range(1, 20):
                t = i / 20
                bt = idle_base.lerp(sip_base, t) + FWD * bulge * math.sin(math.pi * t)
                bt.z = idle_base.z + (sip_base.z - idle_base.z) * zf(t)
                Dt = self._head_fk((0, 0, 0), tuple(CANON_HEAD[j] + (head[j] - CANON_HEAD[j]) * max(0.0, t - 0.86) / 0.14
                                                 for j in range(3)))
                if self._cup_hull_pen(bt, Dt, spare=spout if t > 0.9 else None, axis=axis_at(t)) > 0:
                    ok = False
                    break
            if ok:
                break
            bulge += 0.01

        def base_at(t):
            bt = idle_base.lerp(sip_base, t) + FWD * bulge * math.sin(math.pi * t)
            bt.z = idle_base.z + (sip_base.z - idle_base.z) * zf(t)
            return bt
        out = dict(base=base_at, fdir=fdir_at, axis=axis_at, spout=spout, sip_base=sip_base, bulge=bulge, head=head,
                   yaw=yaw, visibility=vis, tilt=self.SIP_TILT)
        self._grip[key] = out
        return out

    def sip_stage(self, frame, k, interp='BEZIER', head=None):
        """S13 lift, one call per stage on its beat: k = 0 chest (idle), 1 sternum, 2 collar,
        2.5 chin level, 3 contact: the lid's spout touches the chin plate just below the screen and
        the head tips back 5 deg. The cup rises level and only on the final rise tips SIP_TILT
        toward the face (it never turns in the hand); the
        elbow stays out in front of the ribs, the forearm one diagonal up to the chin. For the whole move with
        a clear path on every frame use rig.sip(start)."""
        head = tuple(head or self.SIP_HEAD)
        k = 3 if k > 3 else (0 if k < 0 else k)
        t = self.SIP_STAGE_T.get(k, k / 3.0)
        path = self._sip_path(head)
        if t <= 0.0:
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.pose(frame, interp, head=CANON_HEAD, neck=(0, 0, 0))
            return V(IDLE_CUP['cup_base'])
        base = path['base'](t)
        sol = self._sip_arm(base, path['fdir'](t), axis=path['axis'](t))
        self._key_cup_arm(frame, sol, interp)
        self.pose(frame, interp, head=head if k == 3 else CANON_HEAD, neck=(0, 0, 0))
        return base

    def _key_cup_arm(self, frame, sol, interp):
        self.place_arm(frame, 'R', sol['wrist'], sol['u'], sol['w'], sol['pole'], interp, shoulder=sol['shoulder'])
        self.pose(frame, interp, fingers_R='grip', thumb_R='grip')

    def sip(self, start=1249, beat=16, move=10, touch=4, head=None, step=1):
        """The whole S13 lift on the treatment's beats, keyed every `step` frames so the cup runs
        on its clear, level path (no in-between can swing it into the breastplate): stage 1
        (sternum) moves start..start+move then holds, stage 2 (collar) from start+beat, stage 3
        (chin level) from start+2*beat, and the spout meets the chin exactly on start+3*beat
        (f1297) after a `touch`-frame final rise while the head tips back 5 deg. Returns the
        contact frame."""
        head = tuple(head or self.SIP_HEAD)
        path = self._sip_path(head)
        T = self.SIP_STAGE_T
        segs = [(start, start + move, T[0], T[1]), (start + beat, start + beat + move, T[1], T[2]),
                (start + 2 * beat, start + 2 * beat + move, T[2], T[2.5]),
                (start + 3 * beat - touch, start + 3 * beat, T[2.5], T[3])]
        prev = None
        self.hold_cup(start, 'R', **IDLE_CUP, interp='LINEAR')
        self.pose(start, 'LINEAR', head=CANON_HEAD, neck=(0, 0, 0))
        for i, (f0, f1, t0, t1) in enumerate(segs):
            for f in range(f0 + (0 if i else max(1, step)), f1 + 1, max(1, step)):
                x = (f - f0) / max(1, f1 - f0)
                e = x * x * (3 - 2 * x)
                t = t0 + (t1 - t0) * e
                if t <= 0.0:
                    continue
                sol = self._sip_arm(path['base'](t), path['fdir'](t), prev, axis=path['axis'](t))
                prev = sol
                last = f == f1
                self._key_cup_arm(f, sol, 'CONSTANT' if last and i < 3 else 'LINEAR')
                if i == 3:
                    hk = tuple(CANON_HEAD[j] + (head[j] - CANON_HEAD[j]) * e for j in range(3))
                    self.pose(f, 'LINEAR', head=hk, neck=(0, 0, 0))
            # hold until the next stage begins
        return start + 3 * beat


    def _cup_solution(self, base, fdir, s='R', axis=UP, pole=None):
        key = ('cup', s, tuple(round(x, 4) for x in base), tuple(round(x, 3) for x in fdir),
               tuple(round(x, 3) for x in axis), tuple(round(x, 2) for x in pole) if pole is not None else None)
        if key in self._grip:
            return self._grip[key]
        wrist, u, w = self.cup_hand_frame(s, V(base), axis, fdir)
        sx = -1.0 if s == 'R' else 1.0
        poles = [V((0.3 * sx, -0.2, -1.0)), V((0.7 * sx, -0.3, -0.6)), V((0.9 * sx, 0.0, -0.4)),
                 V((0.5 * sx, -0.7, -0.5)), V((0.2 * sx, -0.8, -0.6)), V((1.0 * sx, -0.2, 0.0)),
                 V((0.45 * sx, 0.1, -0.9))]
        if pole is not None:
            p0 = V(pole).normalized()
            poles = [p0] + [(p0 + V(q).normalized() * 0.6).normalized() for q in poles] + poles
        shoulders = [(0, 0, 0), (6, 0, 0), (12, 2, 0), (18, 4, 0), (24, 6, 0), (0, 6, 0), (10, 8, 0), (-8, 2, 0)]
        grip = self.finger_angles(s, 'grip')
        sol = self.solve_arm_clear(s, wrist, [(u, w)], poles, shoulders, fingers=grip,
                                   thumb=self.grip_angles(s)['thumb'], cup_arm=(V(base), V(axis).normalized()))
        self._grip[key] = sol
        return sol

    # ---------------------------------------------------- props: cup and headset
    def _bone_world(self, bone, frame):
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        ae = self.arm.evaluated_get(dg)
        return ae.matrix_world @ ae.pose.bones[bone].matrix

    def _key_obj(self, obj, frame, M_, interp):
        loc, rot, sca = M_.decompose()
        obj.rotation_mode = 'QUATERNION'
        obj.location = loc
        obj.rotation_quaternion = rot
        obj.keyframe_insert('location', frame=frame)
        obj.keyframe_insert('rotation_quaternion', frame=frame)
        for fc in C.fcurves(obj.animation_data.action):
            if fc.data_path in ('location', 'rotation_quaternion'):
                for kp in fc.keyframe_points:
                    if abs(kp.co.x - frame) < 1e-4:
                        kp.interpolation = interp

    def _key_influence(self, obj, con_name, frame, value):
        con = obj.constraints[con_name]
        con.influence = value
        con.keyframe_insert('influence', frame=frame)
        for fc in C.fcurves(obj.animation_data.action):
            if fc.data_path == f'constraints["{con_name}"].influence':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'

    def _attached_world(self, obj, rest, bone, frame, rest_target=None):
        Pw = self._bone_world(bone, frame)
        Pr = self._rest[bone]
        tgt = rest_target if rest_target is not None else rest
        return Pw @ Pr.inverted() @ tgt

    def _basis_at(self, obj, frame):
        """obj's keyed (un-constrained) local matrix at frame, read from its own animation."""
        sc = bpy.context.scene
        sc.frame_set(frame)
        return obj.matrix_basis.copy()

    def attach_cup(self, frame, to='hand_R'):
        """Switch the cup between hands ('hand_R', 'hand_L') and the world (None) at `frame`.
        Call after the poses around `frame` are keyed. frame - 1 keeps exactly the state the cup
        had (its basis and influences), so nothing before the switch moves; on `frame` it is
        either in the new hand's grip or left in the world where it was."""
        cup = self.cup
        if cup is None:
            return
        cons = {'hand_R': 'hold_R', 'hand_L': 'hold_L'}
        sc = bpy.context.scene
        if cup.animation_data is None or cup.animation_data.action is None:
            # first key: pin the build state at the scene start so earlier frames stay put
            self._key_obj(cup, sc.frame_start, self._cup_rest, 'CONSTANT')
            for cn in cons.values():
                self._key_influence(cup, cn, sc.frame_start, cup.constraints[cn].influence)
        prev = self._basis_at(cup, frame - 1)
        infl = {cn: cup.constraints[cn].influence for cn in cons.values()}
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        now = cup.evaluated_get(dg).matrix_world.copy()
        self._key_obj(cup, frame - 1, prev, 'CONSTANT')
        for cn, v in infl.items():
            self._key_influence(cup, cn, frame - 1, v)
        if to is None:
            self._key_obj(cup, frame, now, 'BEZIER')
            for cn in cons.values():
                self._key_influence(cup, cn, frame, 0.0)
            return
        self._key_obj(cup, frame, self._cup_rest, 'CONSTANT')
        for key, cn in cons.items():
            self._key_influence(cup, cn, frame, 1.0 if key == to else 0.0)

    def _key_cord(self, frame, worn, unplug_frames=8):
        """Move the cord hooks between the body (worn=1) and the earcup wrap (worn=0) over
        `unplug_frames`, by way of the route waypoints out beyond the left earcup: the
        constraint stack is worn -> route -> unplugged, keyed (worn, route, unplugged) =
        (1, 0, 0) -> (1, 1, 0) at the midpoint -> (1, 1, 1), so every in-between is a blend of
        two points outside the head (never a straight line through it). Re-plugging runs it backwards."""
        h = max(1, unplug_frames // 2)
        if worn < 0.5:          # unplug
            stages = ((frame, (1.0, 0.0, 0.0)), (frame + h, (1.0, 1.0, 0.0)), (frame + unplug_frames, (1.0, 1.0, 1.0)))
        else:                   # plug back in
            stages = ((frame, (1.0, 1.0, 1.0)), (frame + unplug_frames - h, (1.0, 1.0, 0.0)),
                      (frame + unplug_frames, (1.0, 0.0, 0.0)))
        for e in self.cord_hooks:
            if 'route' not in e.constraints:
                continue
            for f, vals in stages:
                for cn, v in zip(('worn', 'route', 'unplugged'), vals):
                    con = e.constraints[cn]
                    con.influence = v
                    con.keyframe_insert('influence', frame=f)
            for fc in C.fcurves(e.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'BEZIER'

    def _hs_influences(self, frame, head, hand):
        hs = self.headset
        self._key_influence(hs, 'on_head', frame - 1, hs.constraints['on_head'].influence)
        self._key_influence(hs, 'in_hand_L', frame - 1, hs.constraints['in_hand_L'].influence)
        self._key_influence(hs, 'on_head', frame, head)
        self._key_influence(hs, 'in_hand_L', frame, hand)

    def detach_headset(self, frame, unplug_frames=8):
        """Release the headset into world space at `frame` (key its location/rotation afterwards).
        The cord unplugs: over `unplug_frames` the plug leaves the collar and the cord wraps
        round the left earcup, so it leaves with the headset."""
        hs = self.headset
        if hs is None:
            return
        sc = bpy.context.scene
        prev = self._basis_at(hs, frame - 1)
        infl = (hs.constraints['on_head'].influence, hs.constraints['in_hand_L'].influence)
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        now = hs.evaluated_get(dg).matrix_world.copy()
        worn = 1.0 - self.cord_hooks[0].constraints['unplugged'].influence if self.cord_hooks else 0.0
        self._key_obj(hs, frame - 1, prev, 'CONSTANT')
        self._key_obj(hs, frame, now, 'BEZIER')
        self._key_influence(hs, 'on_head', frame - 1, infl[0])
        self._key_influence(hs, 'in_hand_L', frame - 1, infl[1])
        self._key_influence(hs, 'on_head', frame, 0.0)
        self._key_influence(hs, 'in_hand_L', frame, 0.0)
        if self.cord_hooks and worn > 0.5:
            self._key_cord(frame, 0.0, unplug_frames)

    def attach_headset(self, frame, to='head', unplug_frames=8):
        """to='head' (back on, cord plugged in again), 'hand_L' (gripped by the left hand at its
        current place: pose the hand on the headband first) or None (= detach_headset)."""
        hs = self.headset
        if hs is None:
            return
        if to is None:
            self.detach_headset(frame, unplug_frames)
            return
        if to == 'head':
            self._key_obj(hs, frame - 1, self._basis_at(hs, frame - 1), 'CONSTANT')
            self._key_obj(hs, frame, self._hs_rest, 'CONSTANT')
            self._hs_influences(frame, 1.0, 0.0)
            if self.cord_hooks and self.cord_hooks[0].constraints['unplugged'].influence > 0.5:
                self._key_cord(frame - unplug_frames, 1.0, unplug_frames)
            return
        if to != 'hand_L':
            raise KeyError(to)
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        now = hs.evaluated_get(dg).matrix_world.copy()
        Th = self._bone_world('hand_L', frame)
        con = hs.constraints['in_hand_L']
        con.inverse_matrix = Th.inverted() @ now @ self._hs_rest.inverted()
        self._key_obj(hs, frame - 1, self._basis_at(hs, frame - 1), 'CONSTANT')
        self._key_obj(hs, frame, self._hs_rest, 'CONSTANT')
        self._hs_influences(frame, 0.0, 1.0)
        if self.cord_hooks and self.cord_hooks[0].constraints['unplugged'].influence < 0.5:
            self._key_cord(frame, 0.0, unplug_frames)

    # ---------------------------------------------------- walking
    def walk(self, start, end, start_xy, end_xy, step_frames=14, lift=0.032, arm_swing=3.0, bob=1.0):
        """Stiff protocol-droid walk from start_xy to end_xy (world) over [start, end].

        Short steps, near-straight knees, flat feet, rigid torso, tiny bob.
        Keys root (every frame), pelvis height, thighs, shins and feet; adds a
        small arm swing on top of whatever the upper arms already do."""
        a = V((*start_xy, 0.0))
        b = V((*end_xy, 0.0))
        D = (b - a).length
        T = end - start
        heading = math.degrees(math.atan2((b - a).x, -(b - a).y)) if D > 1e-6 else \
            math.degrees(self.arm.matrix_world.to_euler().z)
        n = max(2, int(round(T / step_frames)))
        sp = T / n
        swing_len = 0.82 * sp
        step = D / (n - 1)
        # footstep plan: feet start together at 0
        pos = {'L': 0.0, 'R': 0.0}
        swings = []
        for k in range(1, n + 1):
            foot = 'L' if k % 2 else 'R'
            target = D * min(k, n - 1) / (n - 1)
            t0 = start + (k - 1) * sp
            swings.append((foot, t0, t0 + swing_len, pos[foot], target))
            pos[foot] = target

        def foot_state(foot, f):
            x, z = 0.0, 0.0
            for ft, t0, t1, x0, x1 in swings:
                if ft != foot:
                    continue
                if f >= t1:
                    x = x1
                elif f > t0:
                    tau = (f - t0) / (t1 - t0)
                    x = x0 + (x1 - x0) * smoothstep(tau)
                    z = lift * math.sin(math.pi * tau) ** 1.2 if x1 != x0 else 0.0
                    return x, z
                else:
                    return x, z
            return x, z

        # root path: support midpoints after each swing, smoothed
        keys = [(start, 0.0)]
        pl, pr = 0.0, 0.0
        for ft, t0, t1, x0, x1 in swings:
            if ft == 'L':
                pl = x1
            else:
                pr = x1
            keys.append((t1 + 0.18 * sp, (pl + pr) / 2))
        keys.append((end, D))

        def lin(f):
            if f <= keys[0][0]:
                return keys[0][1]
            for (f0, x0), (f1, x1) in zip(keys, keys[1:]):
                if f <= f1:
                    return x0 + (x1 - x0) * (f - f0) / max(1e-6, f1 - f0)
            return keys[-1][1]

        sig = sp / 2.5
        frames = list(range(start, end + 1))

        def root_x(f):
            acc, wsum = 0.0, 0.0
            for k in range(-int(3 * sig), int(3 * sig) + 1):
                ww = math.exp(-0.5 * (k / sig) ** 2)
                acc += ww * lin(min(end, max(start, f + k)))
                wsum += ww
            return acc / wsum

        dirv = (b - a).normalized() if D > 1e-6 else V((0, -1, 0))
        l1, l2 = THIGH_LEN, SHIN_LEN
        Lmax = (l1 + l2) * 0.9935
        heights = {}
        for f in frames:
            rx = root_x(f)
            hmax = HIP_Z
            for foot in 'LR':
                fx, fz = foot_state(foot, f)
                off = fx - rx
                vz = math.sqrt(max(1e-6, Lmax * Lmax - off * off)) - fz
                hmax = min(hmax, ANKLE_Z + vz)
            heights[f] = hmax
        # smooth heights a little, then key
        hs = {}
        for f in frames:
            vals = [heights[min(end, max(start, f + k))] for k in (-2, -1, 0, 1, 2)]
            hs[f] = min(heights[f], sum(vals) / 5)
        for f in frames:
            rx = root_x(f)
            world = a + dirv * rx
            self.pose(f, 'LINEAR', root_loc=world, root_rot=heading)
            hip_h = hs[f]
            if bob != 1.0:
                hip_h = HIP_Z - (HIP_Z - hip_h) * bob
            self.key_loc('pelvis', f, V((0, 0, hip_h - HIP_Z)), 'LINEAR')
            phase = 0.0
            for foot in 'LR':
                fx, fz = foot_state(foot, f)
                off = fx - rx            # + = ahead of the hip (forward)
                vz = hip_h - (ANKLE_Z + fz)
                L = min(math.hypot(off, vz), (l1 + l2) - 1e-4)
                phi = math.atan2(off, vz)
                cg = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L)
                gamma = math.acos(max(-1.0, min(1.0, cg)))
                ck = (l1 * l1 + l2 * l2 - L * L) / (2 * l1 * l2)
                knee = math.pi - math.acos(max(-1.0, min(1.0, ck)))
                thigh = phi + gamma
                shin_abs = thigh - knee
                self.pose(f, 'LINEAR', **{f'thigh_{foot}': (math.degrees(thigh), 0, 0),
                                          f'shin_{foot}': math.degrees(knee),
                                          f'foot_{foot}': -math.degrees(shin_abs)})
            if arm_swing:
                # opposite arm to the leading leg
                lx, _ = foot_state('L', f)
                rx_, _ = foot_state('R', f)
                sw = max(-1.0, min(1.0, (rx_ - lx) / max(1e-3, step)))
                for s, sgn in (('L', 1), ('R', -1)):
                    bn = f'upperarm_{s}'
                    cur = self._eval_quat(bn, f) or Quaternion()
                    B = self._rest[bn].to_3x3()
                    Rs = rot_to(self._dir(bn), FWD, arm_swing * sw * sgn)
                    qs = (B.inverted() @ Rs @ B).to_quaternion()
                    self.key_quat(bn, f, qs @ cur, 'LINEAR')


# ---------------------------------------------------------------- build()

def build(name='Synergy', timeline=None, cup=True, headset=True, badge=True, location=(0, 0, 0), rotation_z=0.0,
          coll=None):
    """Build Synergy and return a Rig. See the module docstring."""
    sc = bpy.context.scene
    if coll is None:
        coll = C.collection(name)
    if timeline is None:
        timeline = F.FaceTimeline(sc.frame_start, sc.frame_end)
    b = _Builder(name, coll, timeline)
    b.build_head()
    b.build_neck()
    b.build_torso()
    b.build_pelvis()
    for sx in (1, -1):
        b.build_arm(sx)
        b.build_leg(sx)
    b.build_lanyard()
    if headset:
        b.build_headset()
    arm = b.build_armature()
    b.parent_all()
    # headset group: empty at the head centre, Child Of the head bone
    if headset:
        hs = C.empty(f'{name}_headset', coll, b.head_center, display='SPHERE', size=0.05)
        mesh = b.headset_mesh
        mesh.parent = hs
        mesh.matrix_parent_inverse = Matrix.Translation(b.head_center).inverted()
        b.parts['headset'] = hs
        hs.rotation_mode = 'QUATERNION'
        con = hs.constraints.new('CHILD_OF')
        con.name = 'on_head'
        con.target = arm
        con.subtarget = 'head'
        con.inverse_matrix = arm.data.bones['head'].matrix_local.inverted()
        b.hs_rest = hs.matrix_basis.copy()
        con = hs.constraints.new('CHILD_OF')         # carried in the left hand (attach_headset 'hand_L')
        con.name = 'in_hand_L'
        con.target = arm
        con.subtarget = 'hand_L'
        con.influence = 0.0
        # cord: from the left cup down into the collar. On detach it unplugs: the plug slides out
        # of the collar and the cord wraps round the left earcup, leaving with the headset.
        cs = b.cord_start
        P_ = b.earcups[0]['P']
        worn = [(cs + V((0.018, -0.012, -0.05)), hs), (V((0.066, -0.022, 1.36)), 'neck'),
                (V((0.05, -0.016, 1.30)), 'chest'), (V((0.04, -0.01, 1.258)), 'chest')]
        off = [P_(math.radians(a_), 0.0605, 0.022) for a_ in (-128, -168, 152, 118)]
        route = [P_(math.radians(a_), 0.070, 0.080) for a_ in (-128, -168, 152, 118)]   # out beyond the earcup
        b.headset_cord(cs, hs, worn, off, arm, route)
    # parent the empties created after parent_all (cord hooks)
    for obj, bone in b.later_parent:
        if bone is not None and obj.parent is None:
            bb = arm.data.bones[bone]
            Pb = bb.matrix_local @ Matrix.Translation((0, bb.length, 0))
            mw = obj.matrix_basis.copy()
            obj.parent = arm
            obj.parent_type = 'BONE'
            obj.parent_bone = bone
            obj.matrix_parent_inverse = Pb.inverted()
            obj.matrix_basis = mw
    if cup:
        cobj = b.build_cup()
        cobj.rotation_mode = 'QUATERNION'
        # rest grip placement in each hand
        rests = {}
        for s in 'RL':
            hd = b.hands[s]
            c, basep = grip_frame(hd['W'], hd['u'], hd['v'], hd['w'])
            # cup local: Z = axis, +Y = sip slot: SLOT_BETA from the thumb side toward the side
            # away from the palm (idle: the slot faces the sternum and the posting left hand;
            # raised to the chin with the palm in front, it faces the face)
            zc = c
            un = (hd['u'] - zc * hd['u'].dot(zc)).normalized()
            wn = (hd['w'] - zc * hd['w'].dot(zc)).normalized()
            yc = (-un * math.cos(SLOT_BETA) + wn * math.sin(SLOT_BETA)).normalized()
            xc = yc.cross(zc)
            Rm = Matrix((xc, yc, zc)).transposed()
            rests[s] = Matrix.Translation(basep) @ Rm.to_4x4()
        cobj.matrix_basis = rests['R']
        for s, cn in (('R', 'hold_R'), ('L', 'hold_L')):
            con = cobj.constraints.new('CHILD_OF')
            con.name = cn
            con.target = arm
            con.subtarget = f'hand_{s}'
            hr = arm.data.bones[f'hand_{s}'].matrix_local
            con.inverse_matrix = hr.inverted() @ rests[s] @ rests['R'].inverted()
            con.influence = 1.0 if s == 'R' else 0.0
        b.cup_rest = rests['R'].copy()
        b.cup_rest_L = rests['L'].copy()
    if not badge:
        for k in ('badge', 'badge_hw', 'lanyard'):
            o = b.parts.get(k)
            if o:
                o.hide_render = True
                o.hide_viewport = True
    rig = Rig(b)
    arm.location = V(location)
    arm.rotation_euler = (0, 0, rotation_z)
    # make sure the rig has an action and every bone a rest key at the scene start
    bpy.context.view_layer.update()
    return rig
